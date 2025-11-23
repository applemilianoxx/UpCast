import { NextRequest, NextResponse } from "next/server";

// Using Neynar API - free tier endpoints with rate limiting
const NEYNAR_API = "https://api.neynar.com/v2";
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY || ""; // Get free API key from https://neynar.com

// Helper to get the best available fetch (try multiple options)
async function getFetch(): Promise<typeof fetch> {
  // Try node-fetch first (most reliable in serverless environments)
  try {
    const nodeFetch = await import('node-fetch');
    console.log("🔵 [API] Using node-fetch for serverless compatibility");
    const fetchFn = (nodeFetch.default || nodeFetch) as unknown as typeof fetch;
    return fetchFn;
  } catch {
    console.log("🔵 [API] node-fetch not available, trying undici...");
  }
  
  // Try undici as second option
  try {
    const { fetch: undiciFetch } = await import('undici');
    console.log("🔵 [API] Using undici fetch for better serverless compatibility");
    return undiciFetch as unknown as typeof fetch;
  } catch {
    console.log("🔵 [API] Using native fetch (fallback)");
    return fetch;
  }
}

// Retry logic with exponential backoff for rate limiting
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  safeFetch: typeof fetch,
  maxRetries = 3
): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await safeFetch(url, options);
    
    // If rate limited (429), wait and retry
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      let waitTime = retryAfter 
        ? parseInt(retryAfter, 10) * 1000 
        : Math.pow(2, attempt) * 1000; // Exponential backoff: 1s, 2s, 4s
      
      // Cap wait time at 30 seconds to avoid very long waits
      const maxWaitTime = 30000; // 30 seconds
      waitTime = Math.min(waitTime, maxWaitTime);
      
      if (attempt < maxRetries - 1) {
        console.warn(`🔵 [fetchWithRetry] ⚠️ Rate limited (429), waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
    }
    
    return response;
  }
  
  // If all retries failed, return the last response
  return await safeFetch(url, options);
}

interface Cast {
  hash: string;
  text: string;
  author: {
    fid: number;
    username: string;
    displayName: string;
    pfp?: { url?: string };
  };
  reactions?: {
    likes: number;
    recasts: number;
    replies: number;
  };
  timestamp: number;
  embeds?: Array<{ url?: string }>;
  score?: number;
}

async function fetchUserCastsWithPagination(
  fid: number,
  cursor?: string,
  limit: number = 25
): Promise<{ casts: unknown[]; nextCursor?: string }> {
  const safeFetch = await getFetch();
  
  if (!NEYNAR_API_KEY) {
    throw new Error('NEYNAR_API_KEY environment variable is not set');
  }
  
  try {
    // Use /v2/farcaster/feed/user/casts - 4 credits per request (free tier)
    // Docs: https://docs.neynar.com/reference/fetch-user-casts
    const url = new URL(`${NEYNAR_API}/farcaster/feed/user/casts`);
    url.searchParams.set("fid", fid.toString());
    url.searchParams.set("limit", Math.min(limit, 25).toString()); // Max 25 per request
    if (cursor) {
      url.searchParams.set("cursor", cursor);
    }

    console.log(`🔵 [fetchUserCasts] Fetching casts for FID ${fid}: ${url.toString()}`);
    
    const response = await fetchWithRetry(
      url.toString(),
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'x-api-key': NEYNAR_API_KEY,
          'User-Agent': 'UPLYST-MiniApp/1.0',
        },
        cache: 'no-store',
      } as RequestInit,
      safeFetch
    );
    
    if (!response.ok) {
      if (response.status === 402) {
        console.warn(`🔵 [fetchUserCasts] ⚠️ Payment required for FID ${fid}`);
        return { casts: [], nextCursor: undefined };
      }
      if (response.status === 404) {
        console.warn(`🔵 [fetchUserCasts] ⚠️ User FID ${fid} not found (404)`);
        return { casts: [], nextCursor: undefined };
      }
      if (response.status === 429) {
        console.warn(`🔵 [fetchUserCasts] ⚠️ Rate limited for FID ${fid} after retries`);
        return { casts: [], nextCursor: undefined };
      }
      const errorText = await response.text().catch(() => 'Could not read error text');
      console.error(`🔵 [fetchUserCasts] ❌ Error fetching FID ${fid}: ${response.status} ${errorText}`);
      throw new Error(`Neynar API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    // Response format: { result: { casts: [...], next: { cursor: "..." } } } or { casts: [...], next: { cursor: "..." } }
    const casts = data.result?.casts || data.casts || [];
    const nextCursor = data.result?.next?.cursor || data.next?.cursor;
    
    console.log(`🔵 [fetchUserCasts] ✅ Got ${casts.length} casts for FID ${fid}, nextCursor: ${nextCursor}`);
    
    return { casts, nextCursor };
  } catch (error) {
    console.error(`🔵 [fetchUserCasts] ❌ Error fetching casts for FID ${fid}:`, {
      error: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : 'Unknown',
    });
    throw error;
  }
}

function calculateScore(cast: Cast): number {
  const likes = cast.reactions?.likes || 0;
  const recasts = cast.reactions?.recasts || 0;
  const replies = cast.reactions?.replies || 0;
  const timestamp = cast.timestamp || Date.now();
  
  const age = Date.now() - timestamp;
  const hoursOld = age / (1000 * 60 * 60);
  const engagement = likes * 1 + recasts * 2 + replies * 1.5;
  const recencyBonus = Math.max(0, 24 - hoursOld) / 24;
  
  return engagement * (1 + recencyBonus * 0.5);
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const fidParam = searchParams.get("fid");

    if (!fidParam) {
      return NextResponse.json(
        { error: "FID parameter is required" },
        { status: 400 }
      );
    }

    const fid = parseInt(fidParam, 10);
    if (isNaN(fid)) {
      return NextResponse.json(
        { error: "Invalid FID parameter" },
        { status: 400 }
      );
    }

    const allCasts: Cast[] = [];
    let cursor: string | undefined;
    let hasMore = true;
    let pageCount = 0;
    const maxPages = 50; // Fetch up to 50 pages (25 casts per page = 1250 casts max)

    // Fetch all user casts with pagination
    while (hasMore && pageCount < maxPages) {
      const { casts, nextCursor } = await fetchUserCastsWithPagination(fid, cursor, 25);
      
      console.log(`Fetched page ${pageCount + 1} for FID ${fid}: ${casts?.length || 0} casts, nextCursor: ${nextCursor}`);
      
      if (!casts || casts.length === 0) {
        console.log("No more casts to fetch");
        hasMore = false;
        break;
      }

      // Process casts
      for (const cast of casts) {
        const castRecord = cast as unknown as Record<string, unknown>;
        const author = castRecord.author as { 
          fid?: number; 
          username?: string; 
          displayName?: string; 
          pfp?: { url?: string } 
        } | undefined;
        
        const reactions = castRecord.reactions as { 
          likes?: number; 
          recasts?: number; 
          replies?: number 
        } | undefined;

        // Neynar API returns timestamps in different formats - try multiple fields
        let timestamp: number;
        if (castRecord.timestamp) {
          timestamp = typeof castRecord.timestamp === 'string' 
            ? new Date(castRecord.timestamp).getTime() 
            : (castRecord.timestamp as number);
        } else if (castRecord.published_at) {
          timestamp = typeof castRecord.published_at === 'string'
            ? new Date(castRecord.published_at).getTime()
            : (castRecord.published_at as number);
        } else if (castRecord.publishedAt) {
          timestamp = typeof castRecord.publishedAt === 'string'
            ? new Date(castRecord.publishedAt).getTime()
            : (castRecord.publishedAt as number);
        } else if (castRecord.created_at) {
          timestamp = typeof castRecord.created_at === 'string'
            ? new Date(castRecord.created_at).getTime()
            : (castRecord.created_at as number);
        } else {
          // If no timestamp found, use current time
          timestamp = Date.now();
        }
        
        // Convert to milliseconds if it's in seconds (Neynar sometimes returns seconds)
        if (timestamp < 10000000000) {
          timestamp = timestamp * 1000;
        }

        const processedCast: Cast = {
          hash: (castRecord.hash as string | undefined) || 
                (castRecord.id as string | undefined) || "",
          text: (castRecord.text as string | undefined) || 
                (castRecord.content as string | undefined) || "",
          author: {
            fid: author?.fid || (castRecord.fid as number | undefined) || 0,
            username: author?.username || 
                     (castRecord.username as string | undefined) || "unknown",
            displayName: author?.displayName || 
                        (castRecord.displayName as string | undefined) || "Unknown",
            pfp: { 
              url: author?.pfp?.url || 
                   ((castRecord.pfp as { url?: string } | undefined)?.url) || "" 
            },
          },
          reactions: {
            likes: reactions?.likes || (castRecord.likes as number | undefined) || 0,
            recasts: reactions?.recasts || (castRecord.recasts as number | undefined) || 0,
            replies: reactions?.replies || (castRecord.replies as number | undefined) || 0,
          },
          timestamp,
          embeds: (castRecord.embeds as Array<{ url?: string }> | undefined) || [],
        };

        // Calculate score for ranking
        processedCast.score = calculateScore(processedCast);
        allCasts.push(processedCast);
      }

      // Check if we should continue
      if (!nextCursor || nextCursor === cursor) {
        hasMore = false;
      } else {
        cursor = nextCursor;
        pageCount++;
      }
    }

    // Sort by score (engagement + recency)
    const sortedCasts = allCasts.sort((a, b) => (b.score || 0) - (a.score || 0));

    // Return top 10 for profile page
    return NextResponse.json({
      casts: sortedCasts.slice(0, 10),
      total: allCasts.length,
    });
  } catch (error) {
    console.error("Error fetching user casts:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch user casts", details: errorMessage },
      { status: 500 }
    );
  }
}


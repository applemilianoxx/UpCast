import { NextRequest, NextResponse } from "next/server";

// Using Neynar API - free tier endpoints
const NEYNAR_API = "https://api.neynar.com/v2";
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY || ""; // Get free API key from https://neynar.com

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
  limit: number = 100
): Promise<{ casts: unknown[]; nextCursor?: string }> {
  // Try Neynar API first, fallback to Farcaster Kit
  const useNeynar = !!NEYNAR_API_KEY;
  
  if (useNeynar) {
    try {
      // Use /v2/farcaster/feed/user/casts - free tier endpoint (4 credits)
      // Docs: https://docs.neynar.com/reference/fetch-user-casts
      const url = new URL(`${NEYNAR_API}/farcaster/feed/user/casts`);
      url.searchParams.set("fid", fid.toString());
      url.searchParams.set("limit", Math.min(limit, 25).toString()); // Max 25 per request
      if (cursor) {
        url.searchParams.set("cursor", cursor);
      }

      console.log(`🔵 [fetchUserCasts] Fetching user casts from Neynar for FID ${fid}: ${url.toString()}`);
      
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'x-api-key': NEYNAR_API_KEY, // Fixed: was 'api_key', should be 'x-api-key'
          'User-Agent': 'UPLYST-MiniApp/1.0',
        },
        cache: 'no-store',
      });
      
      if (!response.ok) {
        if (response.status === 402) {
          console.warn(`🔵 [fetchUserCasts] ⚠️ Payment required for FID ${fid}`);
          return { casts: [], nextCursor: undefined };
        }
        if (response.status === 429) {
          console.warn(`🔵 [fetchUserCasts] ⚠️ Rate limited for FID ${fid}`);
          return { casts: [], nextCursor: undefined };
        }
        const errorText = await response.text().catch(() => 'Could not read error text');
        throw new Error(`Neynar API error: ${response.status} ${errorText}`);
      }
      
      const data = await response.json();
      // Response format: { result: { casts: [...] } } or { casts: [...] }
      const casts = data.result?.casts || data.casts || [];
      const nextCursor = data.result?.next?.cursor || data.next?.cursor;
      
      console.log(`🔵 [fetchUserCasts] ✅ Neynar API response for FID ${fid}:`, { castsCount: casts.length, nextCursor });
      
      return { casts, nextCursor };
    } catch (error) {
      console.error(`🔵 [fetchUserCasts] ❌ Neynar API failed for FID ${fid}:`, error instanceof Error ? error.message : String(error));
      // Don't fallback to Farcaster Kit - it has SSL issues
      // Return empty array so the API doesn't crash
      return { casts: [], nextCursor: undefined };
    }
  }
  
  // No fallback - Neynar API is the only source
  // Farcaster Kit has SSL certificate issues
  if (!useNeynar) {
    throw new Error('NEYNAR_API_KEY environment variable is not set. Please configure it in Vercel environment variables.');
  }
  
  // If we get here, Neynar failed and we returned empty array
  return { casts: [], nextCursor: undefined };
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
    const maxPages = 50; // Fetch up to 50 pages (5000 casts max)

    // Fetch all user casts with pagination
    while (hasMore && pageCount < maxPages) {
      const { casts, nextCursor } = await fetchUserCastsWithPagination(fid, cursor, 100);
      
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

        const timestamp = (castRecord.timestamp as number | undefined) || 
                         (castRecord.publishedAt as number | undefined) || 
                         Date.now();

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
    console.error("🔵 [API /casts/user] ❌ Error fetching user casts:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    // Return 200 with empty casts array so UI doesn't break
    return NextResponse.json(
      { 
        error: "Failed to fetch user casts", 
        details: errorMessage,
        casts: [], // Return empty array so UI doesn't break
        total: 0,
      },
      { status: 200 } // Return 200 to prevent client-side error handling
    );
  }
}


import { NextRequest, NextResponse } from "next/server";

// Using Neynar API - more reliable than Farcaster Kit
const NEYNAR_API = "https://api.neynar.com/v2";
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY || ""; // Get free API key from https://neynar.com
const FARCASTER_KIT_API = "https://api.farcasterkit.com";

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
      const url = new URL(`${NEYNAR_API}/farcaster/casts`);
      url.searchParams.set("fid", fid.toString());
      url.searchParams.set("limit", limit.toString());
      if (cursor) {
        url.searchParams.set("cursor", cursor);
      }

      console.log(`Fetching user casts from Neynar: ${url.toString()}`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      const response = await fetch(url.toString(), {
        headers: {
          'Accept': 'application/json',
          'api_key': NEYNAR_API_KEY,
        },
        signal: controller.signal,
        cache: 'no-store',
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Neynar API error: ${response.status}`);
      }
      
      const data = await response.json();
      const casts = data.result?.casts || data.casts || [];
      const nextCursor = data.result?.next?.cursor || data.next?.cursor;
      
      console.log(`Neynar API response for FID ${fid}:`, { castsCount: casts.length, nextCursor });
      
      return { casts, nextCursor };
    } catch (error) {
      console.error("Neynar API failed, trying Farcaster Kit:", error);
    }
  }
  
  // Fallback to Farcaster Kit API
  const url = new URL(`${FARCASTER_KIT_API}/casts/latest`);
  url.searchParams.set("fid", fid.toString());
  url.searchParams.set("limit", limit.toString());
  if (cursor) {
    url.searchParams.set("cursor", cursor);
  }

  try {
    console.log(`Fetching user casts from Farcaster Kit: ${url.toString()}`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'UPLYST/1.0',
      },
      signal: controller.signal,
      cache: 'no-store',
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API error for FID ${fid}: ${response.status} ${response.statusText}`, errorText);
      throw new Error(`Failed to fetch user casts: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const casts = Array.isArray(data) ? data : (data.casts || data.data || []);
    const nextCursor = data.nextCursor || data.cursor || data.next?.cursor;
    
    console.log(`Farcaster Kit API response for FID ${fid}:`, { castsCount: casts.length, nextCursor });
    
    return { casts, nextCursor };
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      if (error.message.includes('fetch failed')) {
        throw new Error(`Network error: ${error.message}`);
      }
    }
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
    console.error("Error fetching user casts:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch user casts", details: errorMessage },
      { status: 500 }
    );
  }
}


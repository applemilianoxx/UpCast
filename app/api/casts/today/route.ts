import { NextResponse } from "next/server";

// Using Neynar API - more reliable than Farcaster Kit
const NEYNAR_API = "https://api.neynar.com/v2";
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY || ""; // Get free API key from https://neynar.com

interface Cast {
  hash: string;
  text: string;
  author: {
    fid: number;
    username: string;
    displayName: string;
    pfp?: { url: string };
  };
  reactions?: {
    likes: number;
    recasts: number;
    replies: number;
  };
  timestamp: number;
  embeds?: Array<{ url?: string }>;
}

async function fetchCastsWithPagination(
  cursor?: string,
  limit: number = 100
): Promise<{ casts: unknown[]; nextCursor?: string }> {
  // Try Neynar API first, fallback to Farcaster Kit
  const useNeynar = !!NEYNAR_API_KEY;
  
  if (useNeynar) {
    try {
      const url = new URL(`${NEYNAR_API}/farcaster/feed`);
      url.searchParams.set("feed_type", "filter");
      url.searchParams.set("filter_type", "global_trending");
      url.searchParams.set("limit", limit.toString());
      if (cursor) {
        url.searchParams.set("cursor", cursor);
      }

      console.log(`Fetching from Neynar: ${url.toString()}`);
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
      
      console.log("Neynar API response:", { castsCount: casts.length, nextCursor });
      
      return { casts, nextCursor };
    } catch (error) {
      console.error("Neynar API failed, trying Farcaster Kit:", error);
    }
  }
  
  // Fallback to Farcaster Kit API
  const url = new URL("https://api.farcasterkit.com/casts/latest");
  url.searchParams.set("limit", limit.toString());
  if (cursor) {
    url.searchParams.set("cursor", cursor);
  }

  try {
    console.log(`Fetching from Farcaster Kit: ${url.toString()}`);
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
      console.error(`API error: ${response.status} ${response.statusText}`, errorText);
      throw new Error(`Failed to fetch casts: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    const casts = Array.isArray(data) ? data : (data.casts || data.data || []);
    const nextCursor = data.nextCursor || data.cursor || data.next?.cursor;
    
    console.log("Farcaster Kit API response:", { castsCount: casts.length, nextCursor });
    
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

export async function GET() {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStartTimestamp = todayStart.getTime();
    const nowTimestamp = Date.now();

    const allCasts: Cast[] = [];
    let cursor: string | undefined;
    let hasMore = true;
    let pageCount = 0;
    const maxPages = 20; // Limit to prevent infinite loops

    // Fetch casts in pages until we have enough from today or run out
    while (hasMore && pageCount < maxPages) {
      const { casts, nextCursor } = await fetchCastsWithPagination(cursor, 100);
      
      console.log(`Fetched page ${pageCount + 1}: ${casts?.length || 0} casts, nextCursor: ${nextCursor}`);
      
      if (!casts || casts.length === 0) {
        console.log("No more casts to fetch");
        hasMore = false;
        break;
      }

      // Process and filter casts
      for (const cast of casts) {
        const castRecord = cast as unknown as Record<string, unknown>;
        const timestamp = (castRecord.timestamp as number | undefined) || 
                         (castRecord.publishedAt as number | undefined) || 
                         Date.now();

        // If we've gone past today, stop fetching
        if (timestamp < todayStartTimestamp) {
          hasMore = false;
          break;
        }

        // Only include casts from today
        if (timestamp >= todayStartTimestamp && timestamp <= nowTimestamp) {
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

          allCasts.push(processedCast);
        }
      }

      // Check if we should continue
      if (!nextCursor || nextCursor === cursor) {
        hasMore = false;
      } else {
        cursor = nextCursor;
        pageCount++;
      }

      // If we have enough casts from today, we can stop
      if (allCasts.length >= 1000) {
        hasMore = false;
      }
    }

    // Sort by engagement (likes + recasts + replies)
    const sortedCasts = allCasts.sort((a, b) => {
      const aEngagement = (a.reactions?.likes || 0) + 
                         (a.reactions?.recasts || 0) + 
                         (a.reactions?.replies || 0);
      const bEngagement = (b.reactions?.likes || 0) + 
                         (b.reactions?.recasts || 0) + 
                         (b.reactions?.replies || 0);
      return bEngagement - aEngagement;
    });

    // Return top 20
    return NextResponse.json({
      casts: sortedCasts.slice(0, 20),
      total: allCasts.length,
    });
  } catch (error) {
    console.error("Error fetching today's casts:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error("Error details:", { errorMessage, errorStack, error });
    
    // Return a more detailed error response
    return NextResponse.json(
      { 
        error: "Failed to fetch today's casts", 
        details: errorMessage,
        type: error instanceof Error ? error.name : typeof error,
      },
      { status: 500 }
    );
  }
}


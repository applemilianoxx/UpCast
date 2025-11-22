import { NextResponse } from "next/server";

const FARCASTER_KIT_API = "https://api.farcasterkit.com";

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
  cursor?: number,
  limit: number = 100
): Promise<{ casts: unknown[]; nextCursor?: number }> {
  const url = new URL(`${FARCASTER_KIT_API}/casts/latest`);
  url.searchParams.set("limit", limit.toString());
  if (cursor) {
    url.searchParams.set("cursor", cursor.toString());
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'UPLYST/1.0',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API error: ${response.status} ${response.statusText}`, errorText);
      throw new Error(`Failed to fetch casts: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Handle different response formats
    const casts = Array.isArray(data) ? data : (data.casts || data.data || []);
    const nextCursor = data.nextCursor || data.cursor || data.next?.cursor;
    
    console.log("Farcaster Kit API response:", { 
      isArray: Array.isArray(data), 
      hasCasts: !!data.casts, 
      castsCount: casts.length,
      keys: Object.keys(data),
      nextCursor
    });
    
    return {
      casts,
      nextCursor,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('Request timeout');
      throw new Error('Request timeout');
    }
    console.error('Fetch error:', error);
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
    let cursor: number | undefined;
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
    return NextResponse.json(
      { error: "Failed to fetch today's casts", details: errorMessage },
      { status: 500 }
    );
  }
}


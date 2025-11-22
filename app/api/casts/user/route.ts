import { NextRequest, NextResponse } from "next/server";

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
  cursor?: number,
  limit: number = 100
): Promise<{ casts: unknown[]; nextCursor?: number }> {
  const url = new URL(`${FARCASTER_KIT_API}/casts/latest`);
  url.searchParams.set("fid", fid.toString());
  url.searchParams.set("limit", limit.toString());
  if (cursor) {
    url.searchParams.set("cursor", cursor.toString());
  }

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Failed to fetch user casts: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    casts: data.casts || data || [],
    nextCursor: data.nextCursor || data.cursor,
  };
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
    let cursor: number | undefined;
    let hasMore = true;
    let pageCount = 0;
    const maxPages = 50; // Fetch up to 50 pages (5000 casts max)

    // Fetch all user casts with pagination
    while (hasMore && pageCount < maxPages) {
      const { casts, nextCursor } = await fetchUserCastsWithPagination(fid, cursor, 100);
      
      if (!casts || casts.length === 0) {
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
    return NextResponse.json(
      { error: "Failed to fetch user casts" },
      { status: 500 }
    );
  }
}


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
  console.log(`🔵 [fetchCastsWithPagination] useNeynar: ${useNeynar}, hasKey: ${!!NEYNAR_API_KEY}`);
  
  if (useNeynar) {
    try {
      const url = new URL(`${NEYNAR_API}/farcaster/feed`);
      url.searchParams.set("feed_type", "filter");
      url.searchParams.set("filter_type", "global_trending");
      url.searchParams.set("limit", limit.toString());
      if (cursor) {
        url.searchParams.set("cursor", cursor);
      }

      console.log(`🔵 [fetchCastsWithPagination] Attempting Neynar fetch: ${url.toString()}`);
      const fetchStart = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log(`🔵 [fetchCastsWithPagination] ⏱️ Neynar request timeout after 15s`);
        controller.abort();
      }, 15000);
      
      let response;
      try {
        response = await fetch(url.toString(), {
          headers: {
            'Accept': 'application/json',
            'api_key': NEYNAR_API_KEY,
          },
          signal: controller.signal,
          cache: 'no-store',
        });
        clearTimeout(timeoutId);
        const fetchTime = Date.now() - fetchStart;
        console.log(`🔵 [fetchCastsWithPagination] Neynar fetch completed in ${fetchTime}ms, status: ${response.status}`);
      } catch (fetchError: unknown) {
        clearTimeout(timeoutId);
        const fetchTime = Date.now() - fetchStart;
        const error = fetchError instanceof Error ? fetchError : new Error(String(fetchError));
        const errorDetails = {
          message: error.message,
          name: error.name,
          stack: error.stack,
          cause: (error as Error & { cause?: unknown }).cause,
          type: typeof fetchError,
          toString: String(fetchError),
        };
        console.error(`🔵 [fetchCastsWithPagination] ❌ Neynar fetch failed after ${fetchTime}ms:`, errorDetails);
        throw new Error(`Neynar fetch failed: ${errorDetails.message} (${errorDetails.name})`, { cause: fetchError });
      }
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Could not read error text');
        console.error(`🔵 [fetchCastsWithPagination] ❌ Neynar API error ${response.status}:`, errorText);
        throw new Error(`Neynar API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      const casts = data.result?.casts || data.casts || [];
      const nextCursor = data.result?.next?.cursor || data.next?.cursor;
      
      console.log(`🔵 [fetchCastsWithPagination] ✅ Neynar success:`, { castsCount: casts.length, nextCursor });
      
      return { casts, nextCursor };
    } catch (error) {
      console.error(`🔵 [fetchCastsWithPagination] ❌ Neynar API failed, trying Farcaster Kit:`, {
        error: error instanceof Error ? error.message : String(error),
        name: error instanceof Error ? error.name : 'Unknown',
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }
  
  // Fallback to Farcaster Kit API - try with simpler approach
  const urlString = `https://api.farcasterkit.com/casts/latest?limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`;
  
  try {
    console.log(`🔵 [fetchCastsWithPagination] Attempting Farcaster Kit fetch: ${urlString}`);
    console.log(`🔵 [fetchCastsWithPagination] Fetch function type: ${typeof fetch}`);
    console.log(`🔵 [fetchCastsWithPagination] URL object test:`, new URL(urlString).toString());
    
    const fetchStart = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log(`🔵 [fetchCastsWithPagination] ⏱️ Farcaster Kit request timeout after 15s`);
      controller.abort();
    }, 15000);
    
    let response;
    try {
      // Try with minimal options first
      const fetchOptions: RequestInit = {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal,
      };
      
      console.log(`🔵 [fetchCastsWithPagination] Making fetch call with options:`, JSON.stringify(fetchOptions, null, 2));
      response = await fetch(urlString, fetchOptions);
      clearTimeout(timeoutId);
      const fetchTime = Date.now() - fetchStart;
      console.log(`🔵 [fetchCastsWithPagination] ✅ Farcaster Kit fetch completed in ${fetchTime}ms, status: ${response.status}`);
    } catch (fetchError: unknown) {
      clearTimeout(timeoutId);
      const fetchTime = Date.now() - fetchStart;
      const error = fetchError instanceof Error ? fetchError : new Error(String(fetchError));
      const errorDetails = {
        error: error.message,
        name: error.name,
        cause: (error as Error & { cause?: unknown }).cause,
        stack: error.stack,
        toString: String(fetchError),
        type: typeof fetchError,
        constructor: error.constructor?.name,
      };
      console.error(`🔵 [fetchCastsWithPagination] ❌ Farcaster Kit fetch failed after ${fetchTime}ms:`, errorDetails);
      console.error(`🔵 [fetchCastsWithPagination] ❌ Full error object:`, JSON.stringify(errorDetails, null, 2));
      
      // Re-throw with more context
      const enhancedError = new Error(`Fetch failed: ${errorDetails.error} (${errorDetails.name})`);
      (enhancedError as Error & { originalError?: unknown }).originalError = fetchError;
      throw enhancedError;
    }
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Could not read error text');
      console.error(`🔵 [fetchCastsWithPagination] ❌ Farcaster Kit API error ${response.status}:`, errorText);
      throw new Error(`Failed to fetch casts: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    const casts = Array.isArray(data) ? data : (data.casts || data.data || []);
    const nextCursor = data.nextCursor || data.cursor || data.next?.cursor;
    
    console.log(`🔵 [fetchCastsWithPagination] ✅ Farcaster Kit success:`, { castsCount: casts.length, nextCursor });
    
    return { casts, nextCursor };
  } catch (error) {
    console.error(`🔵 [fetchCastsWithPagination] ❌ Farcaster Kit failed:`, {
      error: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : 'Unknown',
      cause: error instanceof Error ? (error as Error & { cause?: unknown }).cause : undefined,
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      if (error.message.includes('fetch failed') || error.name === 'TypeError') {
        throw new Error(`Network error: ${error.message} (${error.name})`);
      }
    }
    throw error;
  }
}

export async function GET() {
  const startTime = Date.now();
  console.log("🔵 [API /casts/today] GET request received");
  console.log("🔵 [API /casts/today] Node version:", process.version);
  console.log("🔵 [API /casts/today] Fetch available:", typeof fetch !== 'undefined');
  console.log("🔵 [API /casts/today] NEYNAR_API_KEY present:", !!NEYNAR_API_KEY);
  
  // Declare allCasts outside try block so it's accessible in catch block
  const allCasts: Cast[] = [];
  
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStartTimestamp = todayStart.getTime();
    const nowTimestamp = Date.now();
    
    console.log("🔵 [API /casts/today] Date range:", {
      todayStart: new Date(todayStartTimestamp).toISOString(),
      now: new Date(nowTimestamp).toISOString(),
      todayStartTimestamp,
      nowTimestamp,
    });
    let cursor: string | undefined;
    let hasMore = true;
    let pageCount = 0;
    const maxPages = 20; // Limit to prevent infinite loops

    // Fetch casts in pages until we have enough from today or run out
    console.log("🔵 [API /casts/today] Starting pagination loop, maxPages:", maxPages);
    while (hasMore && pageCount < maxPages) {
      const pageStartTime = Date.now();
      console.log(`🔵 [API /casts/today] Fetching page ${pageCount + 1} with cursor: ${cursor}`);
      
      const { casts, nextCursor } = await fetchCastsWithPagination(cursor, 100);
      const pageTime = Date.now() - pageStartTime;
      
      console.log(`🔵 [API /casts/today] Page ${pageCount + 1} fetched in ${pageTime}ms:`, {
        castsCount: casts?.length || 0,
        nextCursor,
        hasCasts: !!casts && casts.length > 0,
      });
      
      if (!casts || casts.length === 0) {
        console.log("🔵 [API /casts/today] ⚠️ No casts in this page, stopping pagination");
        hasMore = false;
        break;
      }

      // Process and filter casts
      console.log(`🔵 [API /casts/today] Processing ${casts.length} casts from page ${pageCount + 1}`);
      let todayCastsCount = 0;
      let pastCastsCount = 0;
      let futureCastsCount = 0;
      
      for (const cast of casts) {
        const castRecord = cast as unknown as Record<string, unknown>;
        const timestamp = (castRecord.timestamp as number | undefined) || 
                         (castRecord.publishedAt as number | undefined) || 
                         Date.now();

        // If we've gone past today, stop fetching
        if (timestamp < todayStartTimestamp) {
          pastCastsCount++;
          if (pastCastsCount === 1) {
            console.log(`🔵 [API /casts/today] ⚠️ Found cast from past (${new Date(timestamp).toISOString()}), stopping pagination`);
          }
          hasMore = false;
          break;
        }

        // Only include casts from today
        if (timestamp >= todayStartTimestamp && timestamp <= nowTimestamp) {
          todayCastsCount++;
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
        } else {
          futureCastsCount++;
        }
      }
      
      console.log(`🔵 [API /casts/today] Page ${pageCount + 1} processing results:`, {
        totalCasts: casts.length,
        todayCasts: todayCastsCount,
        pastCasts: pastCastsCount,
        futureCasts: futureCastsCount,
        allCastsTotal: allCasts.length,
      });

      // Check if we should continue
      if (!nextCursor || nextCursor === cursor) {
        console.log(`🔵 [API /casts/today] No next cursor or cursor unchanged, stopping pagination`);
        hasMore = false;
      } else {
        cursor = nextCursor;
        pageCount++;
        console.log(`🔵 [API /casts/today] Continuing to page ${pageCount + 1} with cursor: ${cursor}`);
      }

      // If we have enough casts from today, we can stop
      if (allCasts.length >= 1000) {
        console.log(`🔵 [API /casts/today] Reached 1000 casts limit, stopping pagination`);
        hasMore = false;
      }
    }
    
    console.log(`🔵 [API /casts/today] Pagination complete:`, {
      totalPages: pageCount,
      totalCasts: allCasts.length,
    });

    // Sort by engagement (likes + recasts + replies)
    console.log("🔵 [API /casts/today] Sorting casts by engagement...");
    const sortedCasts = allCasts.sort((a, b) => {
      const aEngagement = (a.reactions?.likes || 0) + 
                         (a.reactions?.recasts || 0) + 
                         (a.reactions?.replies || 0);
      const bEngagement = (b.reactions?.likes || 0) + 
                         (b.reactions?.recasts || 0) + 
                         (b.reactions?.replies || 0);
      return bEngagement - aEngagement;
    });

    const top20 = sortedCasts.slice(0, 20);
    console.log("🔵 [API /casts/today] ✅ Returning response:", {
      totalCasts: allCasts.length,
      top20Count: top20.length,
      top3Engagement: top20.slice(0, 3).map(c => ({
        hash: c.hash.substring(0, 10),
        engagement: (c.reactions?.likes || 0) + (c.reactions?.recasts || 0) + (c.reactions?.replies || 0),
      })),
    });
    
    const totalTime = Date.now() - startTime;
    console.log(`🔵 [API /casts/today] 🏁 Request completed in ${totalTime}ms`);

    // Return top 20
    return NextResponse.json({
      casts: top20,
      total: allCasts.length,
    });
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`🔵 [API /casts/today] ❌ Error after ${totalTime}ms:`, error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    const errorName = error instanceof Error ? error.name : typeof error;
    
    console.error("🔵 [API /casts/today] ❌ Error details:", { 
      errorMessage, 
      errorStack, 
      error,
      errorType: errorName,
      errorCause: error instanceof Error ? (error as Error & { cause?: unknown }).cause : undefined,
    });
    
    // If we have some casts collected before the error, return them
    if (allCasts.length > 0) {
      console.log(`🔵 [API /casts/today] ⚠️ Returning ${allCasts.length} casts collected before error`);
      const sortedCasts = allCasts.sort((a, b) => {
        const aEngagement = (a.reactions?.likes || 0) + 
                           (a.reactions?.recasts || 0) + 
                           (a.reactions?.replies || 0);
        const bEngagement = (b.reactions?.likes || 0) + 
                           (b.reactions?.recasts || 0) + 
                           (b.reactions?.replies || 0);
        return bEngagement - aEngagement;
      });
      
      return NextResponse.json({
        casts: sortedCasts.slice(0, 20),
        total: allCasts.length,
        partial: true,
        error: errorMessage,
      });
    }
    
    // Return a more detailed error response
    return NextResponse.json(
      { 
        error: "Failed to fetch today's casts", 
        details: errorMessage,
        type: errorName,
        timestamp: new Date().toISOString(),
        casts: [], // Return empty array so UI doesn't break
      },
      { status: 500 }
    );
  }
}


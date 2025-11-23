import { NextResponse } from "next/server";

// Using Neynar API - more reliable than Farcaster Kit
// API key should be set in Vercel environment variables as NEYNAR_API_KEY
const NEYNAR_API = "https://api.neynar.com/v2";
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY || ""; // Get free API key from https://neynar.com

// Helper to get the best available fetch (undici if available, otherwise native)
async function getFetch(): Promise<typeof fetch> {
  try {
    const { fetch: undiciFetch } = await import('undici');
    console.log("🔵 [API] Using undici fetch for better serverless compatibility");
    // undici's fetch is compatible but has slightly different types
    return undiciFetch as unknown as typeof fetch;
  } catch {
    console.log("🔵 [API] Using native fetch (undici not available)");
    return fetch;
  }
}

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
  cursor: string | undefined,
  limit: number
): Promise<{ casts: unknown[]; nextCursor?: string }> {
  // Get the best available fetch implementation
  const safeFetch = await getFetch();
  
  // Try Neynar API first, fallback to Farcaster Kit
  const useNeynar = !!NEYNAR_API_KEY;
  console.log(`🔵 [fetchCastsWithPagination] useNeynar: ${useNeynar}, hasKey: ${!!NEYNAR_API_KEY}`);
  
  if (useNeynar) {
    try {
      // Verify API key is present
      console.log(`🔵 [fetchCastsWithPagination] Neynar API key present: ${!!NEYNAR_API_KEY}, length: ${NEYNAR_API_KEY.length}`);
      
      // Try trending feed endpoint first (simpler, more reliable)
      // Docs: https://docs.neynar.com/reference/fetch-trending-feed
      // This endpoint already sorts by engagement and supports 24h time window
      // Limit is only 10 per request, so we'll need to paginate
      // Note: NEYNAR_API already includes /v2, so we don't add it again
      const url = new URL(`${NEYNAR_API}/farcaster/feed/trending/`);
      
      url.searchParams.set("time_window", "24h"); // Get trending casts from last 24 hours
      url.searchParams.set("limit", Math.min(limit, 10).toString()); // Max 10 per trending endpoint
      if (cursor) {
        url.searchParams.set("cursor", cursor);
      }

      const finalUrl = url.toString();
      console.log(`🔵 [fetchCastsWithPagination] Attempting Neynar cast search fetch: ${finalUrl}`);
      console.log(`🔵 [fetchCastsWithPagination] URL components:`, {
        protocol: url.protocol,
        host: url.host,
        pathname: url.pathname,
        search: url.search,
        fullUrl: finalUrl,
      });
      console.log(`🔵 [fetchCastsWithPagination] Headers: x-api-key present: ${!!NEYNAR_API_KEY}`);
      const fetchStart = Date.now();
      const fetchUrl = url.toString(); // Declare outside try block so it's accessible in catch
      
      console.log(`🔵 [fetchCastsWithPagination] Fetch URL: ${fetchUrl}`);
      console.log(`🔵 [fetchCastsWithPagination] API Key first 4 chars: ${NEYNAR_API_KEY.substring(0, 4)}...`);
      
      // Try with minimal fetch options first - sometimes AbortController causes issues
      let response;
      try {
        // Use safeFetch (undici if available, otherwise native fetch)
        // This might help with Vercel's serverless environment
        response = await safeFetch(fetchUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'x-api-key': NEYNAR_API_KEY,
            'User-Agent': 'UPLYST-MiniApp/1.0',
          },
          // Add cache control to help with connection reuse
          cache: 'no-store',
          // Try without keepalive first as it might not be supported
        } as RequestInit);
        const fetchTime = Date.now() - fetchStart;
        console.log(`🔵 [fetchCastsWithPagination] Neynar fetch completed in ${fetchTime}ms, status: ${response.status}`);
      } catch (fetchError: unknown) {
        const fetchTime = Date.now() - fetchStart;
        const error = fetchError instanceof Error ? fetchError : new Error(String(fetchError));
        
        // Extract more detailed error information
        const errorDetails: Record<string, unknown> = {
          message: error.message,
          name: error.name,
          stack: error.stack?.split('\n').slice(0, 10), // First 10 lines
          type: typeof fetchError,
        };
        
        // Check for specific error types
        if (error.name === 'TypeError' && error.message.includes('fetch failed')) {
          errorDetails.errorType = 'NetworkError';
          errorDetails.suggestion = 'This is likely a DNS or network connectivity issue from Vercel to Neynar API';
        }
        
        // Try to extract cause if available
        if (error instanceof Error) {
          const cause = (error as Error & { cause?: unknown }).cause;
          if (cause) {
            errorDetails.cause = cause instanceof Error ? {
              message: cause.message,
              name: cause.name,
            } : String(cause);
          }
        }
        
        // Log the full error object for debugging
        console.error(`🔵 [fetchCastsWithPagination] ❌ Neynar fetch failed after ${fetchTime}ms`);
        console.error(`🔵 [fetchCastsWithPagination] Error details:`, errorDetails);
        console.error(`🔵 [fetchCastsWithPagination] Full error:`, error);
        console.error(`🔵 [fetchCastsWithPagination] Error stack:`, error.stack);
        console.error(`🔵 [fetchCastsWithPagination] Fetch URL that failed:`, fetchUrl);
        
        // Try to get more info from the error
        if (error instanceof Error) {
          const err = error as Error & { code?: string; errno?: string; syscall?: string };
          if (err.code) {
            console.error(`🔵 [fetchCastsWithPagination] Error code:`, err.code);
          }
          if (err.errno) {
            console.error(`🔵 [fetchCastsWithPagination] Error errno:`, err.errno);
          }
          if (err.syscall) {
            console.error(`🔵 [fetchCastsWithPagination] Error syscall:`, err.syscall);
          }
        }
        
        throw new Error(`Neynar fetch failed: ${errorDetails.message} (${errorDetails.name})`, { cause: fetchError });
      }
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Could not read error text');
        console.error(`🔵 [fetchCastsWithPagination] ❌ Neynar API error ${response.status}:`, errorText);
        throw new Error(`Neynar API error: ${response.status} ${response.statusText}`);
      }
      
          const data = await response.json();
          // Trending feed endpoint returns { casts: [...], next: { cursor: "..." } }
          const casts = data.casts || [];
          const nextCursor = data.next?.cursor;

          console.log(`🔵 [fetchCastsWithPagination] ✅ Neynar trending feed success:`, { castsCount: casts.length, nextCursor });
      
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
    
    let response;
    try {
      // Try with minimal options - no AbortController to avoid potential issues
      console.log(`🔵 [fetchCastsWithPagination] Making Farcaster Kit fetch call`);
      response = await safeFetch(urlString, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });
      const fetchTime = Date.now() - fetchStart;
      console.log(`🔵 [fetchCastsWithPagination] ✅ Farcaster Kit fetch completed in ${fetchTime}ms, status: ${response.status}`);
    } catch (fetchError: unknown) {
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
      // Don't try to JSON.stringify errorDetails as it may contain circular references
      
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
  console.log("🔵 [API /casts/today] NEYNAR_API_KEY length:", NEYNAR_API_KEY?.length || 0);
  console.log("🔵 [API /casts/today] NEYNAR_API_KEY first 10 chars:", NEYNAR_API_KEY?.substring(0, 10) || 'none');
  
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
        const maxPages = 50; // Trending feed only returns 10 per page, so we need more pages

    // Fetch casts in pages until we have enough from today or run out
    console.log("🔵 [API /casts/today] Starting pagination loop, maxPages:", maxPages);
    while (hasMore && pageCount < maxPages) {
      const pageStartTime = Date.now();
      console.log(`🔵 [API /casts/today] Fetching page ${pageCount + 1} with cursor: ${cursor}`);
      
      const { casts, nextCursor } = await fetchCastsWithPagination(cursor, 10);
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
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    const errorName = error instanceof Error ? error.name : typeof error;
    
    // Safely extract error details without circular references
    const safeErrorDetails: Record<string, unknown> = {
      errorMessage,
      errorStack,
      errorType: errorName,
    };
    
    // Try to extract cause safely (avoid circular references)
    if (error instanceof Error) {
      const cause = (error as Error & { cause?: unknown }).cause;
      if (cause instanceof Error) {
        safeErrorDetails.errorCause = {
          message: cause.message,
          name: cause.name,
          stack: cause.stack,
        };
      } else if (typeof cause === 'string') {
        safeErrorDetails.errorCause = cause;
      }
    }
    
    console.error(`🔵 [API /casts/today] ❌ Error after ${totalTime}ms:`, errorMessage);
    console.error("🔵 [API /casts/today] ❌ Error details:", safeErrorDetails);
    
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
    
    // Return a more detailed error response (without circular references)
    const errorResponse: Record<string, unknown> = {
      error: "Failed to fetch today's casts", 
      details: errorMessage,
      type: errorName,
      timestamp: new Date().toISOString(),
      casts: [], // Return empty array so UI doesn't break
      debug: {
        nodeVersion: process.version,
        fetchAvailable: typeof fetch !== 'undefined',
        neynarApiKeyPresent: !!NEYNAR_API_KEY,
        neynarApiKeyLength: NEYNAR_API_KEY.length,
      },
    };

    // Add stack trace (first 10 lines) for debugging
    if (error instanceof Error && error.stack) {
      errorResponse.stack = error.stack.split('\n').slice(0, 10);
    }

    // Add cause if available
    if (error instanceof Error) {
      const cause = (error as Error & { cause?: unknown }).cause;
      if (cause) {
        errorResponse.cause = cause instanceof Error ? {
          message: cause.message,
          name: cause.name,
        } : String(cause);
      }
    }

    // Return 200 with empty casts array so UI doesn't break
    // The error details are still included for debugging
    return NextResponse.json(errorResponse);
  }
}


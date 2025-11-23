import { NextResponse } from "next/server";

// Using Neynar API - more reliable than Farcaster Kit
// API key should be set in Vercel environment variables as NEYNAR_API_KEY
const NEYNAR_API = "https://api.neynar.com/v2";
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY || ""; // Get free API key from https://neynar.com

// Helper to get the best available fetch (try multiple options)
async function getFetch(): Promise<typeof fetch> {
  // Try node-fetch first (most reliable in serverless environments)
  try {
    const nodeFetch = await import('node-fetch');
    console.log("🔵 [API] Using node-fetch for serverless compatibility");
    // node-fetch v2 exports default, v3 exports named
    // Use double cast to handle type incompatibility
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

// List of popular Farcaster users to fetch casts from
// These are well-known accounts that post frequently
const POPULAR_FARCASTER_USERS = [
  "dwr", "v", "farcaster", "base", "optimism", "a16z", "paradigm",
  "danromero", "jesse", "varunsrinivasan", "rish", "balajis"
];

async function fetchCastsFromUser(
  username: string,
  safeFetch: typeof fetch
): Promise<unknown[]> {
  try {
    // Use /v2/farcaster/feed/user/casts - 4 credits per request (free tier)
    // Docs: https://docs.neynar.com/reference/fetch-user-casts
    // First, get the user's FID by username
    const userUrl = new URL(`${NEYNAR_API}/farcaster/user/by_username`);
    userUrl.searchParams.set("username", username);
    
    const userResponse = await safeFetch(userUrl.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'x-api-key': NEYNAR_API_KEY,
        'User-Agent': 'UPLYST-MiniApp/1.0',
      },
      cache: 'no-store',
    } as RequestInit);
    
    if (!userResponse.ok) {
      console.warn(`🔵 [fetchCastsFromUser] ⚠️ Could not get user info for @${username}: ${userResponse.status}`);
      return [];
    }
    
    const userData = await userResponse.json();
    const fid = userData.result?.fid || userData.fid;
    
    if (!fid) {
      console.warn(`🔵 [fetchCastsFromUser] ⚠️ No FID found for @${username}`);
      return [];
    }
    
    // Now fetch casts using FID
    const url = new URL(`${NEYNAR_API}/farcaster/feed/user/casts`);
    url.searchParams.set("fid", fid.toString());
    url.searchParams.set("limit", "25"); // Get up to 25 casts per user
    
    console.log(`🔵 [fetchCastsFromUser] Fetching casts from @${username}: ${url.toString()}`);
    
    const response = await safeFetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'x-api-key': NEYNAR_API_KEY,
        'User-Agent': 'UPLYST-MiniApp/1.0',
      },
      cache: 'no-store',
    } as RequestInit);
    
    if (!response.ok) {
      if (response.status === 402) {
        console.warn(`🔵 [fetchCastsFromUser] ⚠️ Payment required for @${username}`);
        return [];
      }
      const errorText = await response.text().catch(() => 'Could not read error text');
      console.error(`🔵 [fetchCastsFromUser] ❌ Error fetching @${username}: ${response.status} ${errorText}`);
      return [];
    }
    
    const data = await response.json();
    // Response format: { result: { casts: [...] } } or { casts: [...] }
    const casts = data.result?.casts || data.casts || [];
    console.log(`🔵 [fetchCastsFromUser] ✅ Got ${casts.length} casts from @${username}`);
    return casts;
  } catch (error) {
    console.error(`🔵 [fetchCastsFromUser] ❌ Error fetching casts from @${username}:`, error instanceof Error ? error.message : String(error));
    return [];
  }
}

async function fetchCastsWithPagination(
  cursor: string | undefined,
  limit: number
): Promise<{ casts: unknown[]; nextCursor?: string }> {
  // Get the best available fetch implementation
  const safeFetch = await getFetch();
  
  // Only use Neynar API (Farcaster Kit has SSL certificate issues)
  const useNeynar = !!NEYNAR_API_KEY;
  console.log(`🔵 [fetchCastsWithPagination] useNeynar: ${useNeynar}, hasKey: ${!!NEYNAR_API_KEY}, keyLength: ${NEYNAR_API_KEY?.length || 0}`);
  
  if (!useNeynar) {
    throw new Error('NEYNAR_API_KEY environment variable is not set. Please configure it in Vercel environment variables.');
  }
  
  // For the first page, fetch from popular users
  // For subsequent pages, we'll use cursor-based pagination if available
  if (!cursor || cursor === 'initial') {
    try {
      console.log(`🔵 [fetchCastsWithPagination] Fetching casts from ${POPULAR_FARCASTER_USERS.length} popular users...`);
      
      // Fetch casts from all popular users in parallel (but limit concurrency)
      const allCasts: unknown[] = [];
      const batchSize = 3; // Process 3 users at a time to avoid rate limits
      
      for (let i = 0; i < POPULAR_FARCASTER_USERS.length; i += batchSize) {
        const batch = POPULAR_FARCASTER_USERS.slice(i, i + batchSize);
        const batchPromises = batch.map(username => fetchCastsFromUser(username, safeFetch));
        const batchResults = await Promise.all(batchPromises);
        
        // Flatten results
        for (const casts of batchResults) {
          allCasts.push(...casts);
        }
        
        // Small delay between batches to avoid rate limits
        if (i + batchSize < POPULAR_FARCASTER_USERS.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      console.log(`🔵 [fetchCastsWithPagination] ✅ Fetched ${allCasts.length} total casts from popular users`);
      return { casts: allCasts, nextCursor: 'done' }; // No pagination for this approach
    } catch (error) {
      console.error(`🔵 [fetchCastsWithPagination] ❌ Error fetching from popular users:`, {
        error: error instanceof Error ? error.message : String(error),
        name: error instanceof Error ? error.name : 'Unknown',
      });
      throw error;
    }
  }
  
  // If cursor is 'done', return empty (no more pages)
  return { casts: [], nextCursor: undefined };
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
    let cursor: string | undefined = 'initial'; // Start with 'initial' to fetch from popular users
    let hasMore = true;
    let pageCount = 0;
    const maxPages = 1; // We fetch all popular users in one go, so only need 1 page

    // Fetch casts from popular users
    console.log("🔵 [API /casts/today] Starting fetch from popular users");
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
    
    // Check if this is a payment required error
    const isPaymentRequired = errorMessage.includes('402') || errorMessage.includes('Payment Required');
    
    // Return a more detailed error response (without circular references)
    const errorResponse: Record<string, unknown> = {
      error: isPaymentRequired 
        ? "Neynar API requires a paid plan. Please upgrade your API key or use a different data source."
        : "Failed to fetch today's casts", 
      details: errorMessage,
      type: errorName,
      timestamp: new Date().toISOString(),
      casts: [], // Return empty array so UI doesn't break
      requiresPayment: isPaymentRequired,
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


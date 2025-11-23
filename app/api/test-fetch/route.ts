import { NextResponse } from "next/server";

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY || "";

export async function GET() {
  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    fetchAvailable: typeof fetch !== 'undefined',
    neynarApiKeyPresent: !!NEYNAR_API_KEY,
    neynarApiKeyLength: NEYNAR_API_KEY.length,
  };

  try {
    // Test 1: Basic fetch to Google
    console.log("🧪 [test-fetch] Test 1: Basic fetch to Google");
    const googleStart = Date.now();
    const googleResponse = await fetch("https://www.google.com", {
      method: "GET",
      headers: {
        "User-Agent": "UPLYST-Test/1.0",
      },
    });
    results.googleTest = {
      success: true,
      status: googleResponse.status,
      timeMs: Date.now() - googleStart,
    };
  } catch (error) {
    results.googleTest = {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      type: error instanceof Error ? error.name : typeof error,
    };
  }

  try {
    // Test 2: Neynar API fetch - using /v2/farcaster/cast/search (10 credits, available on Beginner plan)
    console.log("🧪 [test-fetch] Test 2: Neynar API fetch");
    const neynarStart = Date.now();
    const neynarUrl = new URL("https://api.neynar.com/v2/farcaster/cast/search/"); // Note: trailing slash
    neynarUrl.searchParams.set("q", "*"); // Search for all casts
    neynarUrl.searchParams.set("limit", "10");
    
    console.log(`🧪 [test-fetch] Neynar URL: ${neynarUrl.toString()}`);
    console.log(`🧪 [test-fetch] URL components:`, {
      protocol: neynarUrl.protocol,
      host: neynarUrl.host,
      pathname: neynarUrl.pathname,
      search: neynarUrl.search,
    });
    
    console.log(`🧪 [test-fetch] Neynar URL: ${neynarUrl.toString()}`);
    
    const neynarResponse = await fetch(neynarUrl.toString(), {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "x-api-key": NEYNAR_API_KEY,
        "Content-Type": "application/json",
      },
    });
    
    const neynarTime = Date.now() - neynarStart;
    const neynarData = await neynarResponse.json().catch(() => ({ error: "Failed to parse JSON" }));
    
    results.neynarTest = {
      success: neynarResponse.ok,
      status: neynarResponse.status,
      statusText: neynarResponse.statusText,
      timeMs: neynarTime,
      hasCasts: Array.isArray(neynarData.casts),
      castsCount: Array.isArray(neynarData.casts) ? neynarData.casts.length : 0,
      responseKeys: Object.keys(neynarData),
    };
  } catch (error) {
    const errorDetails = error instanceof Error ? {
      message: error.message,
      name: error.name,
      stack: error.stack?.split('\n').slice(0, 5), // First 5 lines of stack
    } : {
      error: String(error),
      type: typeof error,
    };
    
    results.neynarTest = {
      success: false,
      ...errorDetails,
    };
  }

  // Determine status code based on test results
  const neynarSuccess = (results.neynarTest as { success?: boolean })?.success;
  const googleSuccess = (results.googleTest as { success?: boolean })?.success;
  const statusCode = neynarSuccess === false && googleSuccess === false ? 500 : 200;

  return NextResponse.json(results, {
    status: statusCode,
  });
}


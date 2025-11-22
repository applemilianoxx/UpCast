import { NextResponse } from "next/server";

export async function GET() {
  try {
    console.log("🧪 [test-fetch] Testing fetch capability...");
    
    // Test 1: Simple fetch to a known working endpoint
    try {
      console.log("🧪 [test-fetch] Test 1: Fetching from httpbin.org...");
      const testUrl = "https://httpbin.org/json";
      const response = await fetch(testUrl, {
        headers: {
          'Accept': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log("🧪 [test-fetch] ✅ Test 1 passed - httpbin works");
        return NextResponse.json({
          success: true,
          test1: "httpbin.org - PASSED",
          data: data,
        });
      } else {
        console.log(`🧪 [test-fetch] ❌ Test 1 failed - httpbin returned ${response.status}`);
        return NextResponse.json({
          success: false,
          test1: `httpbin.org - FAILED (${response.status})`,
        }, { status: 500 });
      }
    } catch (error) {
      console.error("🧪 [test-fetch] ❌ Test 1 error:", error);
      return NextResponse.json({
        success: false,
        test1: "httpbin.org - ERROR",
        error: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
        } : String(error),
      }, { status: 500 });
    }
  } catch (error) {
    console.error("🧪 [test-fetch] ❌ Overall error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}


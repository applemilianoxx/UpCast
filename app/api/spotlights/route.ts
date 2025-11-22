import { NextResponse } from "next/server";

// TODO: Connect to database for persistent storage
// This is a placeholder API route for spotlight slots

export async function GET() {
  // Fetch active spotlights
  const spotlights: any[] = [];

  return NextResponse.json({ spotlights });
}


import { NextResponse } from "next/server";

// TODO: Connect to database for persistent storage
// This is a placeholder API route for spotlight slots

interface Spotlight {
  id: string;
  castHash: string;
  bidder: string;
  bidAmount: number;
  expiresAt: number;
}

export async function GET() {
  // Fetch active spotlights
  const spotlights: Spotlight[] = [];

  return NextResponse.json({ spotlights });
}


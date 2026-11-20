import { NextResponse } from "next/server";

// Old archive endpoint deliberately retired. Historical source data remains
// in the database for generation of finished AI summaries.
export async function GET() {
  return NextResponse.json({ error: "Arkivet er erstattet af det samlede nyhedsfeed." }, { status: 410 });
}

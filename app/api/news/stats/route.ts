import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type MediaCounts = { media: unknown[]; [key: string]: unknown };
let lastGood: { data: MediaCounts; fetchedAt: number } | null = null;
let inflight: Promise<MediaCounts> | null = null;

const FRESH_MS = 60_000;
const STALE_MS = 30 * 60_000;

async function readMediaCounts(): Promise<MediaCounts> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Missing media statistics configuration");

  const response = await fetch(`${url}/rest/v1/rpc/oeldk_media_article_counts`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: "{}",
    cache: "no-store",
    signal: AbortSignal.timeout(5000)
  });
  if (!response.ok) throw new Error(`Media statistics returned ${response.status}`);
  const data: unknown = await response.json();
  if (!data || typeof data !== "object" || !("media" in data) || !Array.isArray(data.media)) {
    throw new Error("Invalid media statistics");
  }
  return data as MediaCounts;
}

/** Brief Supabase interruptions must not blank an otherwise usable media overview. */
export async function GET() {
  const now = Date.now();
  if (lastGood && now - lastGood.fetchedAt < FRESH_MS) {
    return NextResponse.json(lastGood.data, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" }
    });
  }

  try {
    if (!inflight) {
      inflight = readMediaCounts().finally(() => { inflight = null; });
    }
    const data = await inflight;
    lastGood = { data, fetchedAt: Date.now() };
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" }
    });
  } catch (error) {
    console.warn("ØL media stats read failed", String(error));
    if (lastGood && Date.now() - lastGood.fetchedAt < STALE_MS) {
      // Serve temporarily stale counts, never pretend they were freshly updated.
      return NextResponse.json(lastGood.data, {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
          "X-OEL-Stats-Stale": "1"
        }
      });
    }
    return NextResponse.json({ error: "Oversigten kunne ikke hentes." }, {
      status: 503, headers: { "Cache-Control": "no-store" }
    });
  }
}

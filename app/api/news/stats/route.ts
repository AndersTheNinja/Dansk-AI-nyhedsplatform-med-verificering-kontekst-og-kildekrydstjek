import { NextResponse } from "next/server";

export const revalidate = 60;

export async function GET() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Oversigten kunne ikke hentes." }, { status: 503 });
  try {
    const response = await fetch(`${url}/rest/v1/rpc/oeldk_media_article_counts`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: "{}",
      cache: "no-store",
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) throw new Error("Media statistics unavailable");
    const data = await response.json();
    if (!Array.isArray(data?.media)) throw new Error("Invalid media statistics");
    return NextResponse.json(data, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=60" } });
  } catch {
    return NextResponse.json({ error: "Oversigten kunne ikke hentes." }, { status: 503 });
  }
}

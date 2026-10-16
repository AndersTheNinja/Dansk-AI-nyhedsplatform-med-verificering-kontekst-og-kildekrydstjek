import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { getLiveStories } from "@/lib/live-news";
import { getVisibleArchiveCount } from "@/lib/news-store";

export const revalidate = 60;

const getCachedStories = unstable_cache(
  async () => getLiveStories(),
  ["oel-live-news-v4"],
  { revalidate: 60 }
);

export async function GET(req: NextRequest) {
  try {
    const stories = await getCachedStories();
    const totalCount = await getVisibleArchiveCount();
    const requestedLimit = Number(req.nextUrl.searchParams.get("limit"));
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(Math.floor(requestedLimit), stories.length)
      : stories.length;
    return NextResponse.json(
      { stories: stories.slice(0, limit), totalCount: Math.max(totalCount, stories.length), generatedAt: new Date().toISOString(), availableStories: stories.length },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } }
    );
  } catch (error) {
    console.error("News API failed", error);
    return NextResponse.json(
      { stories: [], error: "Nyhederne kunne ikke hentes." },
      { status: 500 }
    );
  }
}

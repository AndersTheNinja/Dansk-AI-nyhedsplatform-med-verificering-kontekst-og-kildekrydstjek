import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { getLiveStories } from "@/lib/live-news";
import { getAndersWinnerskjoldArchiveStories, getVisibleArchiveCount } from "@/lib/news-store";

export const revalidate = 60;

const getCachedStories = unstable_cache(
  async () => getLiveStories(),
  ["oel-live-news-v4"],
  { revalidate: 60 }
);

const getFastStories = unstable_cache(
  async () => getLiveStories({ fast: true, limit: 20 }),
  ["oel-live-news-fast-v1"],
  { revalidate: 60 }
);

export async function GET(req: NextRequest) {
  try {
    const requestedLimit = Number(req.nextUrl.searchParams.get("limit"));
    const wantsFast = req.nextUrl.searchParams.get("fast") === "1";
    const liveStories = wantsFast ? await getFastStories() : await getCachedStories();
    const andersArchive = wantsFast ? [] : await getAndersWinnerskjoldArchiveStories();
    const seen = new Set(liveStories.map((story) => story.id));
    const stories = [
      ...liveStories,
      ...andersArchive.filter((story) => !seen.has(story.id))
    ].sort((a, b) => {
      const at = a.publishedAt ? Date.parse(a.publishedAt) : 0;
      const bt = b.publishedAt ? Date.parse(b.publishedAt) : 0;
      return bt - at;
    });
    const totalCount = await getVisibleArchiveCount();
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

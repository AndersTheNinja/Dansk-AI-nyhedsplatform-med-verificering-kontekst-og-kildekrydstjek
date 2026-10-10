import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { getLiveStories } from "@/lib/live-news";
import { getVisibleArchiveCount } from "@/lib/news-store";

export const revalidate = 60;

const getCachedStories = unstable_cache(
  async () => getLiveStories(),
  ["oel-live-news-v4"],
  { revalidate: 60 }
);

export async function GET() {
  try {
    const stories = await getCachedStories();
    const totalCount = await getVisibleArchiveCount();
    return NextResponse.json(
      { stories, totalCount: Math.max(totalCount, stories.length), generatedAt: new Date().toISOString() },
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

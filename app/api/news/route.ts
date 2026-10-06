import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { getLiveStories } from "@/lib/live-news";

export const revalidate = 60;

const getCachedStories = unstable_cache(
  async () => getLiveStories(),
  ["oel-live-news-v3"],
  { revalidate: 60 }
);

export async function GET() {
  try {
    const stories = await getCachedStories();
    return NextResponse.json(
      { stories, generatedAt: new Date().toISOString() },
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

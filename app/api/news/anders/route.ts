import { NextResponse } from "next/server";
import { getAndersWinnerskjoldArchiveStories } from "@/lib/news-store";
import { getSummaryStates, onlyCompletedStories } from "@/lib/ready-summaries";
import { deduplicateNewsStories } from "@/lib/news-quality";

export const dynamic = "force-dynamic";

export async function GET() {
  const archive = await getAndersWinnerskjoldArchiveStories();
  const matching = deduplicateNewsStories(archive
    .filter(story => story.mentions?.includes("anders-winnerskjold") ||
      /\bwinners(?:kjold|kiold)\b/i.test([story.title, story.summary,
        ...story.sources.map(source => [source.title, source.url].join(" "))].join(" ")))
    .sort((a, b) => (Date.parse(b.publishedAt || "") || 0) - (Date.parse(a.publishedAt || "") || 0)));
  let ready = new Map<string, (typeof matching)[number]>();
  try {
    ready = new Map(onlyCompletedStories(matching, await getSummaryStates(matching))
      .map(story => [story.id, story]));
  } catch (error) {
    console.warn("Anders W. archive summaries unavailable", error);
  }
  // Headline-only archive cards are explicitly marked; never invent AI summaries.
  const stories = matching.map(story => ({ ...(ready.get(story.id) || {
    ...story, summary: "", archiveOnly: true
  }), andersOnly: true, mentions: ["anders-winnerskjold"] }));
  return NextResponse.json({ stories, totalCount: stories.length },
    { headers: { "Cache-Control": "no-store" } });
}

import { NextResponse } from "next/server";
import { getAndersWinnerskjoldArchiveStories, getRecentStoredNewsCandidates, getNewsSnapshot } from "@/lib/news-store";
import { getSummaryStates, onlyCompletedStories } from "@/lib/ready-summaries";
import { deduplicateNewsStories } from "@/lib/news-quality";
import { isAndersWinnerskjoldStory, type Story } from "@/lib/stories";

export const dynamic = "force-dynamic";

// Search recent stored articles and the live snapshot as well as the historic
// person index. The index alone misses older imports with incomplete metadata.
export async function GET() {
  const [archive, recent, snapshot] = await Promise.all([
    getAndersWinnerskjoldArchiveStories(),
    getRecentStoredNewsCandidates(500),
    getNewsSnapshot()
  ]);
  const byUrl = new Map<string, Story>();
  for (const story of [...archive, ...recent, ...(snapshot?.stories || [])]) {
    const url = story.sources[0]?.url;
    if (!url || !story.title) continue;
    const previous = byUrl.get(url);
    if (!previous) { byUrl.set(url, story); continue; }
    const best = story.summary.length > previous.summary.length ? story : previous;
    byUrl.set(url, { ...best, aiSummary: story.aiSummary || previous.aiSummary,
      mentions: [...new Set([...(previous.mentions || []), ...(story.mentions || [])])] });
  }
  const candidates = [...byUrl.values()];
  const ready = new Map<string, Story>();
  try {
    // Summaries can name the mayor even when the RSS title and teaser do not.
    for (const story of onlyCompletedStories(candidates, await getSummaryStates(candidates))) {
      ready.set(story.sources[0].url, story);
    }
  } catch (error) {
    console.warn("Anders W. archive summaries unavailable", error);
  }
  const matching = candidates.flatMap(story => {
    const prepared = ready.get(story.sources[0].url);
    if (!isAndersWinnerskjoldStory(prepared || story)) return [];
    return [{ ...(prepared || { ...story, summary: "", archiveOnly: true }),
      andersOnly: true, mentions: [...new Set([...(story.mentions || []), "anders-winnerskjold"])] }];
  }).sort((a, b) => (Date.parse(b.publishedAt || "") || 0) - (Date.parse(a.publishedAt || "") || 0));
  const stories = deduplicateNewsStories(matching);
  return NextResponse.json({ stories, totalCount: stories.length },
    { headers: { "Cache-Control": "no-store" } });
}

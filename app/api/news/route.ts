import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { auditNewsStories, deduplicatePublisherHeadlines } from "@/lib/news-quality";
import { auditCurrentImageLinks } from "@/lib/image-health";
import { getLiveStories, cleanNewsStories, addPublisherFeaturedImages, loadPublisherArticleEnricher } from "@/lib/live-news";
import { getNewsSnapshot, getRecentStoredNewsCandidates, combineNewsCandidates } from "@/lib/news-store";
import { getSummaryStates, onlyCompletedStories } from "@/lib/ready-summaries";
import { selectAcrossPublishers } from "@/lib/media-publishers";

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

// If the shared database is temporarily restricted, keep a wider feed of
// verified publisher teasers available. This is NOT an AI summary cache.
const getFallbackStories = unstable_cache(
  async () => getLiveStories({ fast: true, limit: 120 }),
  ["oel-live-news-fallback-v1"],
  { revalidate: 120 }
);

function limitPublicYExcerpt(story: Awaited<ReturnType<typeof getLiveStories>>[number]) {
  const url = story.sources?.[0]?.url || "";
  if (!/^https:\/\/(?:www\.)?y\.dk\//i.test(url)) return story;

  const words = story.summary.trim().split(/\s+/);
  if (words.length <= 100) return story;

  return { ...story, summary: words.slice(0, 100).join(" ") + " …" };
}

export async function GET(req: NextRequest) {
  try {
    const requestedLimit = Number(req.nextUrl.searchParams.get("limit"));
    const wantsFast = req.nextUrl.searchParams.get("fast") === "1";
    // The scheduled collector must still fetch publishers and build a new feed.
    // Visitors read the precomputed snapshot instead of waiting for publishers.
    const collectorMode = req.nextUrl.searchParams.get("collector");
    const isFastCollector = collectorMode === "fast";
    const isCollector = collectorMode === "scheduled" || isFastCollector;
    if (!isCollector) {
      const isFirstBatch = wantsFast && requestedLimit > 0 && requestedLimit <= 20;
      // The first batch needs both lookups, but neither depends on the other.
      const firstBatchEnricher = isFirstBatch ? loadPublisherArticleEnricher() : null;
      const snapshot = await getNewsSnapshot();
      if (snapshot) {
        try {
        const storedStories = isFirstBatch ? [] : await getRecentStoredNewsCandidates(500);
        const cleanedStories = cleanNewsStories(combineNewsCandidates(snapshot.stories, storedStories, 500));
        // Publication gate: no article goes to visitors without a completed
        // AI summary already stored in the shared database.
        const summaryStates = await getSummaryStates(cleanedStories);
        const readyStories = deduplicatePublisherHeadlines(onlyCompletedStories(cleanedStories, summaryStates));
        // Publish only articles with a completed, stored AI summary.
        // Never surface archive-only headlines as a replacement for AI text.
        // Preserve at least two AI-ready articles from each available publisher
        // before filling the remaining 500 slots with the freshest stories.
        const displayStories = selectAcrossPublishers(readyStories, 500, 2);
        // Enrich only the already-published stories, never hundreds of pending
        // articles, which also speeds up the first five news cards.
        const displayCandidates = isFirstBatch ? readyStories.slice(0, 20) : displayStories;
        const enrichedStories = firstBatchEnricher
          ? (await firstBatchEnricher)(displayCandidates)
          : await addPublisherFeaturedImages(displayCandidates);
        const visibleStories = cleanNewsStories(enrichedStories).filter(story =>
          typeof (story as {aiSummary?: string}).aiSummary === "string"
        ).sort((a, b) => {
          const at = a.publishedAt ? Date.parse(a.publishedAt) : 0;
          const bt = b.publishedAt ? Date.parse(b.publishedAt) : 0;
          return (Number.isFinite(bt) ? bt : 0) - (Number.isFinite(at) ? at : 0);
        });
        if (!visibleStories.length) throw new Error("Snapshot has no publication-ready stories");
        const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
          ? Math.min(Math.floor(requestedLimit), 500, visibleStories.length)
          : Math.min(500, visibleStories.length);
        return NextResponse.json({
          ...snapshot,
          stories: visibleStories.slice(0, limit).map(limitPublicYExcerpt),
          availableStories: Math.min(500, visibleStories.length),
          totalCount: Math.min(500, visibleStories.length)
        }, { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } });
        } catch (error) { console.warn("Snapshot summary lookup unavailable; using publisher feed fallback", error); }
      }
    }
    // Degraded mode: Supabase may time out even while Railway is healthy.
    // Never block the entire homepage on a failed database lookup. Use short,
    // attributed publisher excerpts, NOT fabricated AI summaries.
    if (!isCollector) {
      const live = wantsFast ? await getFastStories() : await getFallbackStories();
      const fallbackStories = deduplicatePublisherHeadlines(cleanNewsStories(live))
        .filter(story => typeof story.summary === "string" && story.summary.trim().length >= 40 && story.sources[0]?.url)
        .slice(0, wantsFast ? 5 : 120)
        .map(story => {
          const excerpt = story.summary.replace(/\s+/g, " ").trim().slice(0, 260);
          const sentenceEnd = Math.max(excerpt.lastIndexOf(". "), excerpt.lastIndexOf("! "), excerpt.lastIndexOf("? "));
          const shortText = sentenceEnd >= 60 ? excerpt.slice(0, sentenceEnd + 1) : excerpt.replace(/\\s+\\S*$/, "").trim() + "…";
          return { ...story, aiSummary: shortText, publisherExcerptFallback: true };
        });
      if (fallbackStories.length) return NextResponse.json({
        stories: fallbackStories.map(limitPublicYExcerpt), availableStories: fallbackStories.length,
        totalCount: fallbackStories.length, generatedAt: new Date().toISOString(),
        degraded: true
      }, { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } });
    }
    // Scheduled fast collection only reads fresh RSS metadata; it must never
    // trigger the 1,500-article enrichment job on the visitor-facing service.
    const liveStories = isFastCollector ? await getLiveStories({ fast: true, limit: 100 }) : wantsFast ? await getFastStories() : await getCachedStories();
    let stories = cleanNewsStories(liveStories).sort((a, b) =>
      (b.publishedAt ? Date.parse(b.publishedAt) || 0 : 0) -
      (a.publishedAt ? Date.parse(a.publishedAt) || 0 : 0)
    );
    // Image health checks belong to scheduled ingestion, never public requests.
    // Only confirmed invalid links are removed; CDN blocks/timeouts remain unknown.
    if (isCollector && !isFastCollector) {
      try {
        const imageHealth = await auditCurrentImageLinks(stories, 24);
        stories = imageHealth.stories;
        console.info("ØL.dk image health", JSON.stringify({
          checked: imageHealth.checked, invalid: imageHealth.invalid, uncertain: imageHealth.uncertain
        }));
      } catch (error) { console.warn("ØL.dk image health failed", String(error)); }
      console.info("ØL.dk quality audit", JSON.stringify(auditNewsStories(stories)));
    }
    // Collectors keep returning their raw snapshot to the scheduled database
    // refresh. All public fallback responses are strictly ready-only.
    if (!isCollector) {
      const states = await getSummaryStates(stories);
      stories = deduplicatePublisherHeadlines(onlyCompletedStories(stories, states));
    }
    const totalCount = stories.length;
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(Math.floor(requestedLimit), stories.length)
      : stories.length;
    const responseStories = stories.slice(0, limit);
    return NextResponse.json(
      { stories: isCollector ? responseStories : responseStories.map(limitPublicYExcerpt), totalCount: Math.max(totalCount, stories.length), generatedAt: new Date().toISOString(), availableStories: stories.length, ...(isCollector ? { collectorSnapshot: true } : {}) },
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

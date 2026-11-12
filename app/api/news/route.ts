import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { auditNewsStories } from "@/lib/news-quality";
import { auditCurrentImageLinks } from "@/lib/image-health";
import { getLiveStories, cleanNewsStories, addPublisherFeaturedImages, loadPublisherArticleEnricher } from "@/lib/live-news";
import { getAndersWinnerskjoldArchiveStories, getVisibleArchiveCount, getNewsSnapshot, queuePreviewRepairs } from "@/lib/news-store";
import { getSummaryStates, onlyCompletedStories } from "@/lib/ready-summaries";

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
    // The scheduled collector must still fetch publishers and build a new feed.
    // Visitors read the precomputed snapshot instead of waiting for publishers.
    const isCollector = req.nextUrl.searchParams.get("collector") === "scheduled";
    if (!isCollector) {
      const isFirstBatch = wantsFast && requestedLimit > 0 && requestedLimit <= 20;
      // The first batch needs both lookups, but neither depends on the other.
      const firstBatchEnricher = isFirstBatch ? loadPublisherArticleEnricher() : null;
      const snapshot = await getNewsSnapshot();
      if (snapshot) {
        const cleanedStories = cleanNewsStories(snapshot.stories);
        // Publication gate: no article goes to visitors without a completed
        // AI summary already stored in the shared database.
        const summaryStates = await getSummaryStates(cleanedStories);
        const readyStories = onlyCompletedStories(cleanedStories, summaryStates);
        // Enrich only the already-published stories, never hundreds of pending
        // articles, which also speeds up the first five news cards.
        const displayCandidates = isFirstBatch ? readyStories.slice(0, 20) : readyStories;
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
        const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
          ? Math.min(Math.floor(requestedLimit), visibleStories.length)
          : visibleStories.length;
        return NextResponse.json({
          ...snapshot,
          stories: visibleStories.slice(0, limit),
          availableStories: visibleStories.length
        }, { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } });
      }
    }
    // Degraded mode: Supabase may time out even while Railway is healthy.
    // Never block the entire homepage on a failed database lookup. Use short,
    // attributed publisher excerpts, NOT fabricated AI summaries.
    if (!isCollector) {
      const live = await getFastStories();
      const fallbackStories = cleanNewsStories(live)
        .filter(story => typeof story.summary === "string" && story.summary.trim().length >= 40 && story.sources[0]?.url)
        .slice(0, wantsFast ? 5 : 20)
        .map(story => {
          const excerpt = story.summary.replace(/\\s+/g, " ").trim().slice(0, 260);
          const sentenceEnd = Math.max(excerpt.lastIndexOf(". "), excerpt.lastIndexOf("! "), excerpt.lastIndexOf("? "));
          const shortText = sentenceEnd >= 60 ? excerpt.slice(0, sentenceEnd + 1) : excerpt.replace(/\\s+\\S*$/, "").trim() + "…";
          return { ...story, aiSummary: shortText, publisherExcerptFallback: true };
        });
      if (fallbackStories.length) return NextResponse.json({
        stories: fallbackStories, availableStories: fallbackStories.length,
        totalCount: fallbackStories.length, generatedAt: new Date().toISOString(),
        degraded: true
      }, { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } });
    }
    const liveStories = wantsFast ? await getFastStories() : await getCachedStories();
    const rawArchive = wantsFast ? [] : await getAndersWinnerskjoldArchiveStories();
    if (isCollector) {
      try {
        await queuePreviewRepairs(rawArchive.filter((story) => story.summary.length < 180 || (story.sources[0]?.url?.includes("stiften.dk/") && story.summary.length < 700)));
      } catch (error) { console.error("Archive preview repair failed", error); }
    }
    const andersArchive = rawArchive.length ? await addPublisherFeaturedImages(rawArchive) : [];
    const seen = new Set(liveStories.map((story) => story.id));
    let stories = cleanNewsStories([
      ...liveStories,
      ...andersArchive.filter((story) => !seen.has(story.id))
    ]).sort((a, b) => {
      const at = a.publishedAt ? Date.parse(a.publishedAt) : 0;
      const bt = b.publishedAt ? Date.parse(b.publishedAt) : 0;
      return bt - at;
    });
    // Image health checks belong to scheduled ingestion, never public requests.
    // Only confirmed invalid links are removed; CDN blocks/timeouts remain unknown.
    if (isCollector) {
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
      stories = onlyCompletedStories(stories, states);
    }
    const totalCount = await getVisibleArchiveCount();
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(Math.floor(requestedLimit), stories.length)
      : stories.length;
    return NextResponse.json(
      { stories: stories.slice(0, limit), totalCount: Math.max(totalCount, stories.length), generatedAt: new Date().toISOString(), availableStories: stories.length, ...(isCollector ? { collectorSnapshot: true } : {}) },
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

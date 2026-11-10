import { NextRequest, NextResponse } from "next/server";
import { getNewsSnapshot } from "@/lib/news-store";
import { cleanNewsStories } from "@/lib/live-news";
import { getSummaryStates, summaryCacheKey } from "@/lib/ready-summaries";
import { POST as generateAndStoreSummary } from "@/app/api/summary/route";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

const BATCH_SIZE = 8;
const CONCURRENCY = 4;

/** Background-only collector. Never invoked by the browser/news feed. */
export async function POST(req: NextRequest) {
  const secret = process.env.OEL_INGEST_SECRET;
  if (!secret || req.headers.get("x-oel-ingest-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const snapshot = await getNewsSnapshot();
    if (!snapshot) {
      return NextResponse.json({ status: "no_fresh_snapshot", processed: 0 }, { status: 503 });
    }
    const stories = cleanNewsStories(snapshot.stories);
    const known = await getSummaryStates(stories);
    const missing = stories.filter(story => {
      const key = summaryCacheKey(story);
      if (!key) return false;
      const status = known.get(key)?.status;
      // Skip summaries already published and in-flight/temporarily failed
      // tasks. The DB also holds an atomic lease against concurrency.
      return !status || status === "failed" || status === "generating";
    });
    const work = missing.slice(0, BATCH_SIZE);

    let stored = 0, skipped = 0, failed = 0;
    for (let start = 0; start < work.length; start += CONCURRENCY) {
      await Promise.all(work.slice(start, start + CONCURRENCY).map(async story => {
        try {
          const internalRequest = new NextRequest(new URL("/api/summary", req.url), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-oel-ingest-secret": secret
            },
            body: JSON.stringify({
              url: story.sources[0]?.url,
              title: story.title,
              source: story.sources[0]?.label ?? story.sourceLabel,
              feedText: story.summary
            })
          });
          const response = await generateAndStoreSummary(internalRequest);
          if (response.ok) stored++;
          else if (response.status === 202) skipped++;
          else failed++;
        } catch (error) {
          failed++;
          console.warn("AI background summary failed", story.sources[0]?.url, String(error));
        }
      }));
    }
    console.info("ØL.dk summary collector", JSON.stringify({
      readyBefore: stories.length - missing.length, pending: missing.length,
      attempted: work.length, stored, skipped, failed
    }));
    return NextResponse.json({
      status: "ok", feedArticles: stories.length,
      readyBefore: stories.length - missing.length,
      remainingBefore: missing.length, attempted: work.length, stored, skipped, failed
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("AI background summary collection failed", error);
    return NextResponse.json({ error: "Summary collection failed" }, { status: 500 });
  }
}

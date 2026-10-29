"use client";

import { useEffect, useRef, useState } from "react";
import { NewsFeed } from "@/components/news-feed";
import type { Story } from "@/lib/stories";
import { FIRST_NEWS_CACHE_KEY, parseFirstNewsCache } from "@/lib/first-news-cache";

export function NewsLoader() {
  const [stories, setStories] = useState<Story[] | null>(null);
  const [error, setError] = useState(false);
  const fullNewsLoadedRef = useRef(false);
  const latestFullRequestRef = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    let fullLoadTimer: number | undefined;

    function notifyNewsCount(totalCount: number) {
      window.dispatchEvent(new CustomEvent("oel-news-loaded", { detail: { totalCount } }));
    }

    // Repeat visits in the same tab can paint up to two-minute-old headlines
    // instantly while a fresh request updates the feed in the background.
    try {
      const cache = parseFirstNewsCache(sessionStorage.getItem(FIRST_NEWS_CACHE_KEY));
      if (cache) {
        setStories(cache.stories);
        notifyNewsCount(cache.totalCount);
      }
    } catch {}

    async function loadNews(limit?: number) {
      const isPreview = typeof limit === "number";
      const requestId = isPreview ? 0 : ++latestFullRequestRef.current;
      try {
        const response = await fetch(isPreview ? `/api/news?fast=1&limit=${limit}` : "/api/news", {
          signal: controller.signal
        });
        if (!response.ok) throw new Error("News request failed");
        const data = await response.json();
        const nextStories: Story[] = Array.isArray(data.stories) ? data.stories : [];
        if (!nextStories.length) throw new Error("Empty news response");
        if (controller.signal.aborted) return;

        // Don't let a slow preview overwrite the full list or an older refresh
        // replace a newer one.
        if (isPreview && fullNewsLoadedRef.current) return;
        if (!isPreview && requestId !== latestFullRequestRef.current) return;
        if (!isPreview) fullNewsLoadedRef.current = true;

        const totalCount = typeof data.totalCount === "number" ? data.totalCount : nextStories.length;
        notifyNewsCount(totalCount);
        setStories(nextStories);
        setError(false);

        try {
          sessionStorage.setItem(FIRST_NEWS_CACHE_KEY, JSON.stringify({
            savedAt: Date.now(),
            stories: nextStories.slice(0, 20),
            totalCount
          }));
        } catch {}
      } catch {
        if (controller.signal.aborted) return;
        if (isPreview && fullNewsLoadedRef.current) return;
        if (!isPreview && requestId !== latestFullRequestRef.current) return;
        // Keep the last successful headlines visible during network trouble.
        setError(true);
      }
    }

    // The quick first page starts immediately. Only request the large feed
    // after it has returned, avoiding two simultaneous expensive news reads.
    void loadNews(20).finally(() => {
      if (!controller.signal.aborted) {
        fullLoadTimer = window.setTimeout(() => { void loadNews(); }, 1000);
      }
    });
    const interval = window.setInterval(() => { void loadNews(); }, 60000);
    return () => {
      controller.abort();
      if (fullLoadTimer !== undefined) window.clearTimeout(fullLoadTimer);
      window.clearInterval(interval);
    };
  }, []);

  if (stories === null) {
    if (error) {
      return <div className="newsLoadError" role="alert">Nyhederne kunne ikke hentes. Siden prøver automatisk igen.</div>;
    }
    return (
      <section id="feed" aria-busy="true">
        <div className="sectionTitle">
          Seneste nyheder <span className="sectionTitleNote">(indlæses nu).</span>
        </div>
        <div className="newsLoadingState" role="status" aria-live="polite">
          <span className="newsLoadingBrand" aria-hidden="true">
            <span className="newsLoadingBrandLogo">ØL</span>
            <span className="newsLoadingProgressTrack">
              <span className="newsLoadingProgressBar" />
            </span>
          </span>
          <span className="newsLoadingText">Henter de seneste nyheder…</span>
        </div>
      </section>
    );
  }

  if (error && stories.length === 0) {
    return <div className="newsLoadError" role="alert">Nyhederne kunne ikke hentes. Siden prøver automatisk igen.</div>;
  }

  return <NewsFeed initialStories={stories} />;
}

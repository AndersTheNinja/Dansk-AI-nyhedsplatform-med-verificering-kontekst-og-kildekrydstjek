"use client";

import { useEffect, useRef, useState } from "react";
import { NewsFeed } from "@/components/news-feed";
import type { Story } from "@/lib/stories";

export function NewsLoader() {
  const [stories, setStories] = useState<Story[] | null>(null);
  const [error, setError] = useState(false);
  const fullNewsLoadedRef = useRef(false);
  const latestFullRequestRef = useRef(0);

  async function loadNews(limit?: number) {
    const isPreview = typeof limit === "number";
    const requestId = isPreview ? 0 : ++latestFullRequestRef.current;
    try {
      const response = await fetch(limit ? `/api/news?fast=1&limit=${limit}` : "/api/news");
      if (!response.ok) throw new Error("News request failed");
      const data = await response.json();
      const nextStories: Story[] = Array.isArray(data.stories) ? data.stories : [];

      // The quick 20-story response must never replace a complete feed, even
      // when its network request finishes after the full request.
      if (isPreview && fullNewsLoadedRef.current) return;
      if (!isPreview && requestId !== latestFullRequestRef.current) return;
      if (!isPreview) fullNewsLoadedRef.current = true;

      setStories(nextStories);
      setError(false);
    } catch {
      // Ignore stale failures; preserve the last successfully loaded news.
      if (isPreview && fullNewsLoadedRef.current) return;
      if (!isPreview && requestId !== latestFullRequestRef.current) return;
      setError(true);
    }
  }

  useEffect(() => {
    // Paint the first 20 stories quickly, then hydrate the full feed just after.
    const start = window.setTimeout(() => loadNews(20), 20);
    const fullLoad = window.setTimeout(() => loadNews(), 350);
    const interval = window.setInterval(() => loadNews(), 60000);

    return () => {
      window.clearTimeout(start);
      window.clearTimeout(fullLoad);
      window.clearInterval(interval);
    };
  }, []);

  if (stories === null) {
    if (error) {
      return <div className="newsLoadError" role="alert">Nyhederne kunne ikke hentes. Siden prøver automatisk igen.</div>;
    }
    return (
      <section id="feed" aria-busy="true">
        <div className="newsLoadingFilters" aria-hidden="true">
          <span /><span /><span /><span /><span />
        </div>
        <div className="sectionTitle">
          Seneste nyheder <span className="sectionTitleNote">(indlæses nu).</span>
        </div>
        <div className="newsSkeleton" aria-hidden="true">
          <div /><div /><div /><div />
        </div>
      </section>
    );
  }

  if (error && stories.length === 0) {
    return <div className="newsLoadError">Nyhederne kunne ikke hentes. Siden prøver automatisk igen.</div>;
  }

  return <NewsFeed initialStories={stories} />;
}

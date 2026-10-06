"use client";

import { useEffect, useState } from "react";
import { NewsFeed } from "@/components/news-feed";
import type { Story } from "@/lib/stories";

export function NewsLoader() {
  const [stories, setStories] = useState<Story[] | null>(null);
  const [error, setError] = useState(false);

  async function loadNews() {
    try {
      const response = await fetch("/api/news");
      if (!response.ok) throw new Error("News request failed");
      const data = await response.json();
      const nextStories: Story[] = Array.isArray(data.stories) ? data.stories : [];

      setStories(nextStories);
      setError(false);

      const cutoff24h = Date.now() - 24 * 60 * 60 * 1000;
      const stories24h = nextStories.filter((story) => {
        if (!story.publishedAt) return false;
        const time = new Date(story.publishedAt).getTime();
        return Number.isFinite(time) && time >= cutoff24h;
      }).length;

      const countNode = document.getElementById("news-count");
      if (countNode) countNode.textContent = `${stories24h} nyheder (24t.)`;
    } catch {
      setError(true);
      const countNode = document.getElementById("news-count");
      if (countNode) countNode.textContent = "Nyheder utilgængelige";
    }
  }

  useEffect(() => {
    const start = window.setTimeout(loadNews, 40);
    const interval = window.setInterval(loadNews, 60000);

    return () => {
      window.clearTimeout(start);
      window.clearInterval(interval);
    };
  }, []);

  if (stories === null) {
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

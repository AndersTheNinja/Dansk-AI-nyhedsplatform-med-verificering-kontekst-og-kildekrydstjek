"use client";

import { useEffect, useState } from "react";
import { NewsFeed } from "@/components/news-feed";
import type { Story } from "@/lib/stories";

export function NewsLoader() {
  const [stories, setStories] = useState<Story[] | null>(null);
  const [error, setError] = useState(false);
  const [newsCount, setNewsCount] = useState<number | null>(null);
  const [visitorCount, setVisitorCount] = useState<number | null>(null);

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

      setNewsCount(stories24h);
    } catch {
      setError(true);
      setNewsCount(null);
    }
  }

  useEffect(() => {
    const start = window.setTimeout(loadNews, 40);
    const interval = window.setInterval(loadNews, 60000);

    let visitorId = sessionStorage.getItem("oel-presence-id");
    if (!visitorId) {
      visitorId = crypto.randomUUID();
      sessionStorage.setItem("oel-presence-id", visitorId);
    }

    const pingPresence = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch("/api/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ visitorId }),
          cache: "no-store"
        });
        const data = await response.json();
        if (typeof data.count === "number") setVisitorCount(data.count);
      } catch {}
    };

    const presenceStart = window.setTimeout(pingPresence, 100);
    const presenceInterval = window.setInterval(pingPresence, 30000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") pingPresence();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearTimeout(start);
      window.clearInterval(interval);
      window.clearTimeout(presenceStart);
      window.clearInterval(presenceInterval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    const countNode = document.getElementById("news-count");
    if (!countNode) return;
    const newsText = newsCount === null ? "Indlæser…" : `${newsCount} nyheder`;
    const peopleText = visitorCount === null ? "– pers." : `${visitorCount} pers.`;
    countNode.textContent = `${newsText} / ${peopleText}`;
  }, [newsCount, visitorCount]);

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

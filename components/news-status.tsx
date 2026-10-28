"use client";

import { useEffect, useState } from "react";
import { NewsStats } from "@/components/news-stats";

export function NewsStatus() {
  const [newsCount, setNewsCount] = useState<number | null>(null);
  const [visitorCount, setVisitorCount] = useState<number | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    // Reuse the feed response rather than sending a third /api/news request
    // during the critical first paint. Also refresh count with each feed update.
    function onNewsLoaded(event: Event) {
      const count = (event as CustomEvent<{ totalCount?: number }>).detail?.totalCount;
      if (typeof count !== "number" || !Number.isFinite(count)) return;
      setNewsCount(count);
      setError(false);
    }
    window.addEventListener("oel-news-loaded", onNewsLoaded);
    let visitorId: string;
    try {
      visitorId = sessionStorage.getItem("oel-presence-id") || crypto.randomUUID();
      sessionStorage.setItem("oel-presence-id", visitorId);
    } catch { visitorId = crypto.randomUUID(); }
    async function pingPresence() {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch("/api/presence", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ visitorId }), cache: "no-store", signal: controller.signal
        });
        const data = await response.json();
        if (typeof data.count === "number") setVisitorCount(data.count);
      } catch {}
    }
    pingPresence();
    const presenceInterval = window.setInterval(pingPresence, 30000);
    const onVisibility = () => { if (document.visibilityState === "visible") pingPresence(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      controller.abort();
      window.removeEventListener("oel-news-loaded", onNewsLoaded);
      window.clearInterval(presenceInterval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <NewsStats newsCount={newsCount} visitorCount={visitorCount} error={error} />;
}

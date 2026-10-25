"use client";

import { useEffect, useState } from "react";
import { NewsStats } from "@/components/news-stats";

export function NewsStatus() {
  const [newsCount, setNewsCount] = useState<number | null>(null);
  const [visitorCount, setVisitorCount] = useState<number | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    async function refreshCount() {
      try {
        const response = await fetch("/api/news?limit=1", { signal: controller.signal });
        if (!response.ok) throw new Error("News count unavailable");
        const data = await response.json();
        if (typeof data.totalCount !== "number") throw new Error("Invalid news count");
        setNewsCount(data.totalCount);
        setError(false);
      } catch { if (!controller.signal.aborted) setError(true); }
    }
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
    refreshCount();
    pingPresence();
    const newsInterval = window.setInterval(refreshCount, 60000);
    const presenceInterval = window.setInterval(pingPresence, 30000);
    const onVisibility = () => { if (document.visibilityState === "visible") pingPresence(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      controller.abort();
      window.clearInterval(newsInterval);
      window.clearInterval(presenceInterval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <div className="headerStatus">
    <div className="liveStatusLine"><span className="liveDot" /> LIVE</div>
    <div className="headerStats" id="news-count">
      <NewsStats newsCount={newsCount} visitorCount={visitorCount} error={error} />
    </div>
  </div>;
}

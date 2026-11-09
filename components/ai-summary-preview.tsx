"use client";

import { useEffect, useRef, useState } from "react";
import type { Story } from "@/lib/stories";

type SummaryResponse = { summary: string; basisType?: "article_text" | "excerpt" };
const cache = new Map<string, SummaryResponse>();

/**
 * Trial: display an independently generated AI summary in the news feed,
 * never a verbatim publisher excerpt. Generate only when a card enters view.
 */
export function AiSummaryPreview({ story }: { story: Story }) {
  const target = useRef<HTMLSpanElement | null>(null);
  const [result, setResult] = useState<SummaryResponse | null>(null);
  const [status, setStatus] = useState<"waiting" | "loading" | "error">("waiting");

  useEffect(() => {
    let cancelled = false;
    const node = target.current;
    if (!node) return;
    const key = story.id + ":" + story.summary;
    const stored = cache.get(key);
    if (stored) {
      setResult(stored);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      setStatus("loading");
      const sourceUrl = story.sources[0]?.url;
      if (!sourceUrl) {
        setStatus("error");
        return;
      }
      const requestSummary = async () => {
        // A different visitor may currently be generating this exact article.
        // Poll the shared database result instead of paying for a new AI call.
        for (let attempt = 0; attempt < 35 && !cancelled; attempt++) {
          const response = await fetch("/api/summary", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              url: sourceUrl,
              title: story.title,
              source: story.sources[0]?.label ?? story.sourceLabel,
              feedText: story.summary
            })
          });
          if (response.status === 202) {
            await new Promise<void>(resolve => setTimeout(resolve, 3000));
            continue;
          }
          if (!response.ok) throw new Error("Summary failed");
          const data = await response.json();
          if (cancelled) return;
          if (typeof data?.summary !== "string" || !data.summary.trim()) throw new Error("Empty summary");
          const summary = { summary: data.summary.trim(), basisType: data.basisType };
          cache.set(key, summary);
          setResult(summary);
          return;
        }
        if (!cancelled) setStatus("error");
      };
      void requestSummary().catch(() => {
        if (!cancelled) setStatus("error");
      });
    }, { rootMargin: "150px 0px" });
    observer.observe(node);
    return () => { cancelled = true; observer.disconnect(); };
  }, [story.id, story.summary, story.title, story.sources, story.sourceLabel]);

  return (
    <span ref={target}>
      {result ? result.summary
        : status === "error" ? "AI-resumé kunne ikke dannes. Læs nyheden hos originalkilden."
        : "AI-resumé udarbejdes…"}
    </span>
  );
}

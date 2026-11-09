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
  const [visibleText, setVisibleText] = useState<string | null>(null);
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

  // Use the actual news paragraph's font and usable width, not the span's
  // default font shorthand (which Safari can report as an empty string).
  // No AI requests are involved in responsive fitting.
  useEffect(() => {
    const element = target.current;
    const paragraph = element?.closest("p");
    if (!element || !paragraph || !result?.summary) return;
    const full = result.summary.trim();
    const sentences = Array.from(new Intl.Segmenter("da", { granularity: "sentence" }).segment(full))
      .map(part => part.segment.trim()).filter(Boolean);
    const candidates = sentences.reduce<string[]>((items, sentence) => {
      const prev = items.at(-1);
      items.push(prev ? prev + " " + sentence : sentence);
      return items;
    }, []);
    const probe = document.createElement("div");
    probe.setAttribute("aria-hidden", "true");
    probe.style.cssText = "position:fixed;left:-10000px;top:0;display:block;visibility:hidden;pointer-events:none;white-space:normal;overflow:visible;max-width:none;";
    document.body.appendChild(probe);

    const fit = () => {
      const width = paragraph.getBoundingClientRect().width;
      if (width <= 20) return;
      const style = getComputedStyle(paragraph);
      probe.style.width = width + "px";
      probe.style.fontFamily = style.fontFamily;
      probe.style.fontSize = style.fontSize;
      probe.style.fontWeight = style.fontWeight;
      probe.style.fontStyle = style.fontStyle;
      probe.style.letterSpacing = style.letterSpacing;
      probe.style.lineHeight = style.lineHeight;
      probe.style.wordBreak = style.wordBreak;
      const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.5;
      let best = "";
      for (const candidate of candidates) {
        probe.textContent = candidate;
        const lines = probe.getBoundingClientRect().height / lineHeight;
        if (lines <= 4.05) best = candidate;
        else break;
      }
      // A full first sentence takes precedence over truncation mid-sentence.
      setVisibleText(best || candidates[0] || full);
    };
    const observer = new ResizeObserver(fit);
    observer.observe(paragraph);
    window.addEventListener("resize", fit);
    fit();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", fit);
      probe.remove();
    };
  }, [result?.summary]);

  return (
    <span ref={target} className="aiSummaryPreview">
      {result ? (visibleText ?? "Tilpasser resumé…")
        : status === "error" ? "AI-resumé kunne ikke dannes. Læs nyheden hos originalkilden."
        : "AI-resumé udarbejdes…"}
    </span>
  );
}

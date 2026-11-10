"use client";

import { useEffect, useRef, useState } from "react";
import type { Story } from "@/lib/stories";

/** Display only a ready, persisted summary; layout changes cost no AI tokens. */
export function AiSummaryPreview({ story }: { story: Story }) {
  const target = useRef<HTMLSpanElement | null>(null);
  const [visibleText, setVisibleText] = useState<string | null>(null);

  // Use the actual news paragraph's font and usable width, not the span's
  // default font shorthand (which Safari can report as an empty string).
  // No AI requests are involved in responsive fitting.
  useEffect(() => {
    const element = target.current;
    const paragraph = element?.closest("p");
    if (!element || !paragraph || !story.aiSummary) return;
    const full = story.aiSummary.trim();
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
  }, [story.aiSummary]);

    // The entire story is already prepared in Supabase before publication.
  // No browser request to /api/summary, and no loading/error placeholder.
  return <span ref={target} className="aiSummaryPreview">{visibleText ?? ""}</span>;
}

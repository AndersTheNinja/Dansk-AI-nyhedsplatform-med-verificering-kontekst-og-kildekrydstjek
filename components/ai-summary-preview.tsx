"use client";

import type { Story } from "@/lib/stories";

export const SUMMARY_PREVIEW_WORDS = 25;

/** Show a compact headline-like lead, with the rest of the stored summary on demand. */
export function AiSummaryPreview({ story, expanded = false }: { story: Story; expanded?: boolean }) {
  const isPublisherFallback = Boolean((story as Story & { publisherExcerptFallback?: boolean }).publisherExcerptFallback);
  const summary = story.aiSummary?.trim() || "";
  const words = summary.split(/\s+/).filter(Boolean);
  const isTruncated = !expanded && words.length > SUMMARY_PREVIEW_WORDS;
  const visible = isTruncated ? words.slice(0, SUMMARY_PREVIEW_WORDS).join(" ") + "…" : summary;
  return <span className="aiSummaryPreview">{isPublisherFallback ? "Fra kildens uddrag: " : ""}{visible}</span>;
}

"use client";

import type { Story } from "@/lib/stories";

export const SUMMARY_PREVIEW_WORDS = 25;
export const DESKTOP_SUMMARY_PREVIEW_WORDS = 65;

/** Show a compact headline-like lead, with the rest of the stored summary on demand. */
export function AiSummaryPreview({ story, expanded = false }: { story: Story; expanded?: boolean }) {
  const isPublisherFallback = Boolean((story as Story & { publisherExcerptFallback?: boolean }).publisherExcerptFallback);
  const summary = story.aiSummary?.trim() || "";
  const words = summary.split(/\s+/).filter(Boolean);
  const preview = (count: number) => words.length > count ? words.slice(0, count).join(" ") + "…" : summary;

  return (
    <span className="aiSummaryPreview">
      {isPublisherFallback ? "Fra kildens uddrag: " : ""}
      {expanded ? summary : (
        <>
          <span className="aiSummaryPreviewMobile">{preview(SUMMARY_PREVIEW_WORDS)}</span>
          <span className="aiSummaryPreviewDesktop">{preview(DESKTOP_SUMMARY_PREVIEW_WORDS)}</span>
        </>
      )}
    </span>
  );
}

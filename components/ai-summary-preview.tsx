"use client";

import type { Story } from "@/lib/stories";

/** Always display the full precomputed summary without an expansion step. */
export function AiSummaryPreview({ story }: { story: Story; expanded?: boolean }) {
  const isPublisherFallback = Boolean((story as Story & { publisherExcerptFallback?: boolean }).publisherExcerptFallback);
  return <span className="aiSummaryPreview">{isPublisherFallback ? "Fra kildens uddrag: " : ""}{story.aiSummary?.trim() || ""}</span>;
}

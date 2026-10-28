import type { Story } from "./stories";
import { hasPublisherInterfaceText, stripPublisherBoilerplate } from "./article-preview-quality";
import { isGenericArticleImage } from "./article-image-quality";

export type QualityIssue = "short_text" | "publisher_ui" | "generic_image" | "missing_image" | "invalid_date" | "future_date" | "duplicate";
export type QualityFinding = { id: string; source: string; issues: QualityIssue[] };
export type QualityReport = { checked: number; issueCounts: Record<QualityIssue, number>; examples: QualityFinding[] };

const issueTypes: QualityIssue[] = ["short_text","publisher_ui","generic_image","missing_image","invalid_date","future_date","duplicate"];
export function auditNewsStories(stories: Story[], now = Date.now()): QualityReport {
 const counts = Object.fromEntries(issueTypes.map(key => [key,0])) as Record<QualityIssue,number>;
 const seen = new Set<string>();
 const examples: QualityFinding[] = [];
 for (const story of stories) {
  const issues: QualityIssue[] = [];
  const text = story.summary?.trim() || "";
  const primary = story.sources?.[0];
  const source = primary?.label || story.sourceLabel || "";
  if (text.split(/\s+/).filter(Boolean).length < 25) issues.push("short_text");
  if (hasPublisherInterfaceText(text) || stripPublisherBoilerplate(text) !== text) issues.push("publisher_ui");
  if (!story.imageUrl) issues.push("missing_image");
  else if (isGenericArticleImage(story.imageUrl,story.title,source)) issues.push("generic_image");
  const timestamp = story.publishedAt ? Date.parse(story.publishedAt) : NaN;
  if (!Number.isFinite(timestamp)) issues.push("invalid_date");
  else if (timestamp > now + 15*60_000) issues.push("future_date");
  // Same publisher and link is a duplicate; different publisher reports
  // are legitimate cross-check coverage.
  const key = (primary?.url || story.id).trim().toLowerCase().replace(/[?#].*$/,"");
  if (seen.has(key)) issues.push("duplicate");
  seen.add(key);
  for (const issue of issues) counts[issue]++;
  if (issues.length && examples.length < 30) examples.push({ id: story.id, source, issues });
 }
 return { checked: stories.length, issueCounts: counts, examples };
}

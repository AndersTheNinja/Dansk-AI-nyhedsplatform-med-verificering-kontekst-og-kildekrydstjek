import { hasPublisherInterfaceText, joinArticleParagraphs } from "./article-preview-quality.ts";

function visibleText(value: string): string {
  const decoded = value.replace(/<[^>]*>/g, " ").replace(/&(?:nbsp|amp|quot|apos|lt|gt);/gi, match => ({
    "&nbsp;": " ", "&amp;": "&", "&quot;": '"', "&apos;": "'", "&lt;": "<", "&gt;": ">"
  } as Record<string,string>)[match.toLowerCase()] || match)
    .replace(/&#(\d+);/g, (_, number: string) => String.fromCodePoint(Number(number)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)));
  return decoded.replace(/\s+/g, " ").trim();
}

function terms(text: string): Set<string> {
  return new Set(text.toLocaleLowerCase("da-DK").replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(/\s+/).filter(word => word.length >= 4));
}

function overlap(a: string, b: string): number {
  const first = terms(a), second = terms(b);
  if (!first.size || !second.size) return 0;
  return [...first].filter(word => second.has(word)).length /
    Math.max(1, Math.min(first.size, second.size));
}

/**
 * Y's RSS frequently contains only one introductory sentence.
 * Extract MORE PUBLIC PARAGRAPHS only when the actual article's <main>
 * contains the expected headline AND the matching RSS introduction.
 * Never take the first unrelated paragraphs from the homepage, recommendations,
 * or a different article. No attempt to access gated/client-only content.
 */
export function extractYPublicArticlePreview(html: string, title: string, rssIntro: string): string {
  if (!rssIntro.trim() || !title.trim()) return "";
  const main = /<main\b[^>]*>([\s\S]*?)<\/main\s*>/i.exec(html)?.[1] || "";
  if (!main) return "";
  const headings = [...main.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1\s*>/gi)];
  const matching = headings.find(match => overlap(visibleText(match[1]), title) >= 0.75);
  if (!matching || matching.index === undefined) return "";

  const from = matching.index + matching[0].length;
  let article = main.slice(from);
  // Y's "Redaktionen anbefaler" and other story carousels are not part
  // of the same article. Stop before their headings, not after.
  const recommendation = /<h[1-4]\b[^>]*>\s*(?:Redaktionen anbefaler|Relaterede artikler|Læs også|Seneste nyheder)\s*<\/h[1-4]\s*>/i.exec(article);
  if (recommendation?.index !== undefined) article = article.slice(0, recommendation.index);
  article = article.replace(/<(?:script|style|noscript|nav|aside|footer)\b[^>]*>[\s\S]*?<\/(?:script|style|noscript|nav|aside|footer)\s*>/gi, " ");
  const paragraphs = [...article.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p\s*>/gi)]
    .map(match => visibleText(match[1]))
    .filter(text => text.length >= 30 && !hasPublisherInterfaceText(text));
  const start = paragraphs.findIndex(text =>
    overlap(text, rssIntro) >= 0.6 ||
    text.toLocaleLowerCase("da-DK").includes(rssIntro.trim().slice(0, 55).toLocaleLowerCase("da-DK"))
  );
  if (start < 0) return "";
  const selected = paragraphs.slice(start, start + 6);
  const joined = joinArticleParagraphs(selected);
  // A single RSS lead is no improvement; only return verified EXTRA text.
  return joined.length >= rssIntro.trim().length + 50 ? joined : "";
}

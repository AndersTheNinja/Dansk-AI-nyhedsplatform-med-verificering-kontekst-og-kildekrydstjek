import { hasPublisherInterfaceText, isEditorialParagraph, joinArticleParagraphs } from "./article-preview-quality.ts";

function clean(value: string): string {
  return value
    .replace(/<(?:script|style|noscript|svg|figure|figcaption|nav|aside|footer|header)\b[^>]*>[\s\S]*?<\/(?:script|style|noscript|svg|figure|figcaption|nav|aside|footer|header)>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&(?:nbsp|amp|quot|apos|lt|gt);/gi, value => ({
      "&nbsp;": " ", "&amp;": "&", "&quot;": '"', "&apos;": "'",
      "&lt;": "<", "&gt;": ">"
    } as Record<string, string>)[value.toLowerCase()] || value)
    .replace(/\s+/g, " ").trim();
}

function relevantTerms(text: string): Set<string> {
  return new Set(text.toLocaleLowerCase("da-DK")
    .replace(/[^\p{L}\p{N}]+/gu, " ").split(/\s+/)
    .filter(word => word.length >= 5 && !/^(?:eller|efter|andre|denne|havde|kunne|blive|deres|større|mindre|siger|sagde|artikel)$/.test(word)));
}

/**
 * Stiften's JFM page sometimes keeps its PUBLIC editorial paragraphs in a
 * data-load-async-url fragment, not in the initial HTML or RSS.
 *
 * Only call this with a fragment fetched from the SAME validated article page.
 * Reject unrelated teaser widgets: require a recognisable topical connection
 * to either the article headline or its RSS lead and at least two paragraphs.
 * A public excerpt is not an AI summary and is capped by previewWordCount.
 */
export function extractStiftenPublicFragment(fragment: string, title: string, lead: string): string {
  const html = fragment
    .replace(/<(?:script|style|noscript|svg|figure|figcaption|aside|nav|header|footer)\b[^>]*>[\s\S]*?<\/(?:script|style|noscript|svg|figure|figcaption|aside|nav|header|footer)>/gi, " ");
  const stop = /<(?:h[1-6]|section|div)\b[^>]*>\s*(?:Relaterede artikler|Redaktionen anbefaler|Læs også|Mest læste)(?:\s*<\/[^>]+>)?/i.exec(html);
  const scoped = stop?.index !== undefined ? html.slice(0, stop.index) : html;
  const parts = Array.from(scoped.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p\s*>/gi))
    .map(match => clean(match[1]))
    .filter(text => text.length >= 28 && isEditorialParagraph(text) &&
      !hasPublisherInterfaceText(text) &&
      !/^(?:læs også|se også|bliv abonnent|log ind|relateret|annonce|redaktionen anbefaler)\b/i.test(text));

  if (parts.length < 2) return "";
  const articleTerms = new Set([...relevantTerms(title), ...relevantTerms(lead)]);
  const matches = parts.slice(0, 6).flatMap(paragraph => [...relevantTerms(paragraph)])
    .filter(term => articleTerms.has(term));
  if (new Set(matches).size < 2) return "";
  const unique = Array.from(new Set(parts));
  const result = joinArticleParagraphs(unique.slice(0, 8));
  return result.length > lead.length + 50 ? result : "";
}

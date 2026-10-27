/**
 * The "Læs mere" badge must describe the linked article, not the publisher
 * site shell, global subscription banners or teasers for other stories.
 * Return null when we cannot substantiate free/paid access for this article.
 */
export type ArticleAccessResult = {
  requiresSubscription: boolean | null;
  basis: "article-jsonld" | "article-content-tier" | "article-html" | "conflict" | "unknown";
};

function getAttribute(tag: string, name: string): string | null {
  const pattern = new RegExp("(?:^|\\s)" + name + "\\s*=\\s*([\"'])(.*?)\\1", "i");
  return pattern.exec(tag)?.[2] ?? null;
}

function sameArticleUrl(value: string, articleUrl: string): boolean {
  try {
    const actual = new URL(value, articleUrl);
    const expected = new URL(articleUrl);
    const host = (value: string) => value.replace(/^www\./i, "").toLowerCase();
    const path = (value: string) => value.replace(/\/+$/, "") || "/";
    return actual.protocol === "https:" &&
      host(actual.hostname) === host(expected.hostname) &&
      path(actual.pathname) === path(expected.pathname);
  } catch {
    return false;
  }
}

function nodeUrlCandidates(node: Record<string, unknown>): string[] {
  const values: unknown[] = [node.url, node["@id"], node.mainEntityOfPage];
  const candidates: string[] = [];
  for (const value of values) {
    if (typeof value === "string") candidates.push(value);
    else if (value && typeof value === "object" && !Array.isArray(value)) {
      const obj = value as Record<string, unknown>;
      if (typeof obj.url === "string") candidates.push(obj.url);
      if (typeof obj["@id"] === "string") candidates.push(obj["@id"]);
    }
  }
  return candidates;
}

function toAccessBoolean(value: unknown): boolean | null {
  if (value === true || value === false) return value;
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  return null;
}

function currentArticleJsonLd(html: string, articleUrl: string): boolean[] {
  const result: boolean[] = [];
  const scripts = html.match(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi) ?? [];
  for (const script of scripts) {
    const open = script.match(/^<script\b[^>]*>/i)?.[0] ?? "";
    if (!/application\/ld\+json/i.test(getAttribute(open, "type") ?? "")) continue;
    const raw = script.slice(open.length).replace(/<\/script\s*>$/i, "").trim();
    if (raw.length > 250000) continue;

    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { continue; }

    const queue: unknown[] = [parsed];
    let visited = 0;
    while (queue.length && visited++ < 250) {
      const node = queue.shift();
      if (Array.isArray(node)) { queue.push(...node); continue; }
      if (!node || typeof node !== "object") continue;
      const obj = node as Record<string, unknown>;
      const type = [obj["@type"]].flat().filter(v => typeof v === "string").join(" ").toLowerCase();
      if (/(?:article|blogposting|webpage)/.test(type) &&
          nodeUrlCandidates(obj).some(url => sameArticleUrl(url, articleUrl))) {
        const free = toAccessBoolean(obj.isAccessibleForFree);
        if (free !== null) result.push(!free);
      }
      if (obj["@graph"]) queue.push(obj["@graph"]);
      if (obj.mainEntity) queue.push(obj.mainEntity);
    }
  }
  return result;
}

function contentTier(html: string): boolean[] {
  const result: boolean[] = [];
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const name = (getAttribute(tag, "name") ?? getAttribute(tag, "property") ?? "").toLowerCase();
    if (name !== "article:content_tier") continue;
    const value = (getAttribute(tag, "content") ?? "").trim().toLowerCase();
    if (/^(free|public|unmetered)$/.test(value)) result.push(false);
    else if (/^(locked|premium|paid|subscription|subscriber-only)$/.test(value)) result.push(true);
  }
  return result;
}

function articleHtmlAccess(html: string, articleUrl: string): boolean[] {
  const result: boolean[] = [];
  // Only trust flags on an article tag that identifies the *current* URL.
  // A linked recommendation can itself be premium without this article being so.
  for (const tag of html.match(/<article\b[^>]*>/gi) ?? []) {
    const linked = ["data-url", "data-article-url", "data-canonical-url", "itemid"]
      .map(name => getAttribute(tag, name))
      .filter((value): value is string => Boolean(value));
    if (!linked.some(value => sameArticleUrl(value, articleUrl))) continue;
    for (const name of ["data-requires-subscription", "data-is-premium", "data-paywall"]) {
      const value = getAttribute(tag, name)?.toLowerCase();
      if (value === "true" || value === "1" || value === "locked") result.push(true);
      if (value === "false" || value === "0" || value === "free") result.push(false);
    }
  }
  return result;
}

export function classifyArticleAccess(html: string, articleUrl: string): ArticleAccessResult {
  const scoped = html.slice(0, 1200000);
  const sources: { values: boolean[]; basis: ArticleAccessResult["basis"] }[] = [
    { values: currentArticleJsonLd(scoped, articleUrl), basis: "article-jsonld" },
    { values: contentTier(scoped), basis: "article-content-tier" },
    { values: articleHtmlAccess(scoped, articleUrl), basis: "article-html" }
  ];
  const values = sources.flatMap(source => source.values);
  if (!values.length) return { requiresSubscription: null, basis: "unknown" };
  if (values.some(value => value !== values[0])) return { requiresSubscription: null, basis: "conflict" };
  const matched = sources.find(source => source.values.length > 0);
  return { requiresSubscription: values[0], basis: matched?.basis ?? "unknown" };
}

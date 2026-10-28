// A missing paywall marker is NOT evidence that an article is free.
// Use the article's own access metadata and keep uncertain cases unlabelled.
export type AccessResult = {
  requiresSubscription: boolean | null;
  basis: "article-jsonld" | "article-meta" | "article-gate" | "explicit-paywall" | "unknown";
};

function declaredAccess(value: unknown): boolean | null {
  if (value === false || value === "false" || value === "False") return true;
  if (value === true || value === "true" || value === "True") return false;
  return null;
}

function canonicalPath(reference: string, base: URL): string | null {
  try {
    const url = new URL(reference, base);
    if (url.protocol !== "https:" || url.hostname.replace(/^www\./i, "") !== base.hostname.replace(/^www\./i, "")) return null;
    return url.pathname.replace(/\/+$/, "") || "/";
  } catch { return null; }
}

function getReference(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record["@id"] === "string") return record["@id"];
    if (typeof record.url === "string") return record.url;
  }
  return "";
}

function paywalledSection(parts: unknown): boolean {
  if (Array.isArray(parts)) return parts.some(paywalledSection);
  if (!parts || typeof parts !== "object") return false;
  const record = parts as Record<string, unknown>;
  // A free teaser with a gated article section still requires access.
  if (declaredAccess(record.isAccessibleForFree) === true) return true;
  return paywalledSection(record.hasPart);
}

export function accessFromArticleJsonLd(html: string, requestedUrl: URL): boolean | null {
  const expected = requestedUrl.pathname.replace(/\/+$/, "") || "/";
  const scripts = Array.from(html.matchAll(/<script\b(?=[^>]*\btype\s*=\s*["']application\/ld\+json["'])[^>]*>([\s\S]*?)<\/script\s*>/gi));
  const matchedArticles: boolean[] = [];
  const matchedPages: boolean[] = [];

  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const child of node) visit(child);
      return;
    }
    if (!node || typeof node !== "object") return;
    const record = node as Record<string, unknown>;
    const types = Array.isArray(record["@type"]) ? record["@type"] : [record["@type"]];
    const article = types.some(type => typeof type === "string" && /(?:Article|BlogPosting)$/i.test(type));
    const webPage = types.some(type => typeof type === "string" && /WebPage$/i.test(type));
    if (article || webPage) {
      const references = [
        getReference(record["@id"]),
        getReference(record.url),
        getReference(record.mainEntityOfPage)
      ].filter(Boolean);
      if (references.some(ref => canonicalPath(ref, requestedUrl) === expected)) {
        const status = paywalledSection(record.hasPart)
          ? true
          : declaredAccess(record.isAccessibleForFree);
        if (status !== null) (article ? matchedArticles : matchedPages).push(status);
      }
    }
    // Traverse only the schema graph and explicit main entity, never arbitrary
    // embedded recommendations or generic site subscription banners.
    if (record["@graph"]) visit(record["@graph"]);
    if (record.mainEntity && typeof record.mainEntity === "object") visit(record.mainEntity);
  };
  for (const script of scripts) {
    try { visit(JSON.parse(script[1])); } catch {}
  }
  // The specific NewsArticle takes precedence over a more generic WebPage.
  const relevant = matchedArticles.length ? matchedArticles : matchedPages;
  if (!relevant.length || (relevant.includes(true) && relevant.includes(false))) return null;
  return relevant[0];
}

function attribute(tag: string, name: string): string {
  const pattern = new RegExp("(?:^|\\s)" + name + "\\s*=\\s*([\"'])(.*?)\\1", "i");
  return pattern.exec(tag)?.[2]?.trim() || "";
}

/**
 * Publisher article-level meta markers (e.g. article:content_tier=locked).
 * Trust only metadata with a matching canonical URL for the requested story.
 */
export function accessFromArticleMeta(html: string, requestedUrl: URL): boolean | null {
  const head = /<head\b[^>]*>([\s\S]*?)<\/head\s*>/i.exec(html)?.[1];
  if (!head) return null;

  const metas = Array.from(head.matchAll(/<meta\b[^>]*>/gi), match => match[0]);
  const links = Array.from(head.matchAll(/<link\b[^>]*>/gi), match => match[0]);
  const references = [
    ...links.filter(link => /\bcanonical\b/i.test(attribute(link, "rel"))).map(link => attribute(link, "href")),
    ...metas.filter(meta => attribute(meta, "property").toLowerCase() === "og:url").map(meta => attribute(meta, "content"))
  ].filter(Boolean);
  const requestedPath = requestedUrl.pathname.replace(/\/+$/, "") || "/";
  if (!references.length || !references.some(ref => canonicalPath(ref, requestedUrl) === requestedPath)) return null;

  let paid = false, free = false;
  for (const meta of metas) {
    const kind = (attribute(meta, "property") || attribute(meta, "name") || attribute(meta, "itemprop")).toLowerCase();
    const value = attribute(meta, "content").toLowerCase();
    if (kind === "article:content_tier" || kind === "article:content-tier") {
      if (["locked", "subscriber", "subscription", "premium", "paid"].includes(value)) paid = true;
      if (value === "free") free = true;
      // "metered" does not establish the current visitor's access.
    }
    if (kind === "isaccessibleforfree" && (value === "true" || value === "false")) {
      if (value === "false") paid = true;
      else free = true;
    }
    if ((kind === "article:paywall" || kind === "paywall") &&
        ["true", "locked", "subscriber", "subscription"].includes(value)) paid = true;
  }
  // Conflicting publisher metadata cannot establish free access.
  return paid && free ? null : paid ? true : free ? false : null;
}

/** Paywall gates within an article are more specific than global marketing. */
export function accessFromArticleGate(html: string): boolean | null {
  const article = /<article\b[^>]*>([\s\S]*?)<\/article\s*>/i.exec(html);
  if (!article) return null;
  const scoped = article[0].slice(0, 250000);
  const marker = /<(?:div|section|aside|article)\b[^>]*(?:data-(?:paywall|paywall-state|article-paywall|access-status|content-tier)\s*=\s*["'](?:true|locked|subscriber|subscription|premium|paid)["']|(?:class|data-testid)\s*=\s*["'][^"']*(?:article-paywall|paywall-gate|subscription-wall|premium-gate|article-subscription)[^"']*["'])[^>]*>/i;
  const textGate = /(?:for at læse (?:resten af )?artiklen (?:skal du|kræves)|bliv abonnent for at læse videre|log ind for at læse videre|læs videre med abonnement)/i;
  if (marker.test(scoped) || textGate.test(scoped)) return true;
  return null;
}

const explicitPaywall = [
  /(?:log ind|login) for at læse videre/i,
  /bliv abonnent for at læse/i,
  /læs videre med abonnement/i,
  /kun for abonnenter/i,
  /kræver (?:et )?abonnement/i,
  /"paywall"\s*:\s*true/i
];

export function classifyArticleAccess(html: string, url: URL): AccessResult {
  const article = accessFromArticleJsonLd(html, url);
  const meta = accessFromArticleMeta(html, url);
  const gate = accessFromArticleGate(html);
  // A global paywall advertisement can describe a *different* article.
  // If there is an article element, only trust scoped gates within that article.
  const hasArticle = /<article\b/i.test(html);
  const articleHtml = hasArticle ? (/<article\b[^>]*>([\s\S]*?)<\/article\s*>/i.exec(html)?.[0] || "") : "";
  const paywallSignal = explicitPaywall.some(re =>
    re.test(hasArticle ? articleHtml.slice(0, 250000) : html.slice(0, 400000))
  );

  const paid = article === true || meta === true || gate === true || paywallSignal;
  const free = article === false || meta === false;
  if (paid && free) return { requiresSubscription: null, basis: "unknown" };
  if (article === true) return { requiresSubscription: true, basis: "article-jsonld" };
  if (meta === true) return { requiresSubscription: true, basis: "article-meta" };
  if (gate === true) return { requiresSubscription: true, basis: "article-gate" };
  if (paywallSignal) return { requiresSubscription: true, basis: "explicit-paywall" };
  if (article === false) return { requiresSubscription: false, basis: "article-jsonld" };
  if (meta === false) return { requiresSubscription: false, basis: "article-meta" };
  return { requiresSubscription: null, basis: "unknown" };
}

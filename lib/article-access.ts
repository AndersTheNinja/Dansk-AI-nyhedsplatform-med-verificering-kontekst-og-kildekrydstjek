// A missing paywall marker is NOT evidence that an article is free.
// Use the article's own access metadata and keep uncertain cases unlabelled.
export type AccessResult = {
  requiresSubscription: boolean | null;
  basis: "article-jsonld" | "explicit-paywall" | "unknown";
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
  const visit = (node: unknown): boolean | null => {
    if (Array.isArray(node)) {
      for (const child of node) {
        const result = visit(child);
        if (result !== null) return result;
      }
      return null;
    }
    if (!node || typeof node !== "object") return null;
    const record = node as Record<string, unknown>;
    const types = Array.isArray(record["@type"]) ? record["@type"] : [record["@type"]];
    const article = types.some(type => typeof type === "string" && /(?:NewsArticle|Article|ReportageNewsArticle)$/i.test(type));
    if (article) {
      const references = [
        getReference(record["@id"]),
        getReference(record.url),
        getReference(record.mainEntityOfPage)
      ].filter(Boolean);
      if (references.some(ref => canonicalPath(ref, requestedUrl) === expected)) {
        // Article-level partial paywalls override a freely readable teaser.
        if (paywalledSection(record.hasPart)) return true;
        return declaredAccess(record.isAccessibleForFree);
      }
    }
    // Support @graph but don't attribute another article's access to this one.
    const graph = record["@graph"];
    if (graph && typeof graph === "object") return visit(graph);
    return null;
  };
  for (const script of scripts) {
    try {
      const result = visit(JSON.parse(script[1]));
      if (result !== null) return result;
    } catch {}
  }
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
  // Use a limited set of explicit signals; generic marketing widgets alone
  // can be present even when the requested article is free.
  const paywallSignal = explicitPaywall.some(re => re.test(html.slice(0, 400000)));
  if (article === true) return { requiresSubscription: true, basis: "article-jsonld" };
  if (article === false && !paywallSignal) return { requiresSubscription: false, basis: "article-jsonld" };
  if (article === false && paywallSignal) {
    // Conflicting page signals: don't claim the article is free.
    return { requiresSubscription: null, basis: "unknown" };
  }
  if (paywallSignal) return { requiresSubscription: true, basis: "explicit-paywall" };
  return { requiresSubscription: null, basis: "unknown" };
}

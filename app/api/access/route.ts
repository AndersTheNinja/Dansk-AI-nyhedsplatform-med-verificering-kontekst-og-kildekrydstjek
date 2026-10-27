import { NextRequest, NextResponse } from "next/server";

const ALLOWED_HOSTS = new Set([
  "dr.dk","www.dr.dk","politiken.dk","www.politiken.dk","version2.dk","www.version2.dk",
  "ing.dk","www.ing.dk","computerworld.dk","www.computerworld.dk","techsavvy.media","www.techsavvy.media",
  "altinget.dk","www.altinget.dk","nordjyske.dk","www.nordjyske.dk","fyens.dk","www.fyens.dk",
  "jv.dk","www.jv.dk","hsfo.dk","www.hsfo.dk","frdb.dk","www.frdb.dk","journalisten.dk","www.journalisten.dk",
  "berlingske.dk","www.berlingske.dk","borsen.dk","www.borsen.dk",
  "stiften.dk","www.stiften.dk","migogaarhus.dk","www.migogaarhus.dk",
  "tv2.dk","www.tv2.dk","nyheder.tv2.dk"
]);

function looksLikePaywall(html: string) {
  const sample = html.slice(0, 400000).toLowerCase();
  return [
    /"isaccessibleforfree"\s*:\s*false/,
    /data-paywall/,
    /class=["'][^"']*paywall[^"']*["']/,
    /kun for abonnenter/,
    /kræver abonnement/,
    /log ind for at læse videre/,
    /bliv abonnent for at læse/,
    /læs videre med abonnement/,
    /abonnentindhold/,
    /subscriber[-_ ]only/,
    /premium[-_ ]content/,
    /"paywall"\s*:\s*true/
  ].some((pattern) => pattern.test(sample));
}

// JFM pages can contain paywall indicators for recommended articles or
// subscription widgets even while the requested article is free.
// Only attribute structured access information to the matching article.
function articleAccessFromJsonLd(html: string, requestedUrl: URL): boolean | null {
  const scripts = Array.from(html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi));
  const requestedPath = requestedUrl.pathname.replace(/\/$/, "");
  const objects: unknown[] = [];
  for (const script of scripts) {
    try { objects.push(JSON.parse(script[1])); } catch {}
  }
  const walk = (node: unknown): boolean | null => {
    if (Array.isArray(node)) {
      for (const child of node) { const result = walk(child); if (result !== null) return result; }
      return null;
    }
    if (!node || typeof node !== "object") return null;
    const record = node as Record<string, unknown>;
    const type = record["@type"];
    const types = Array.isArray(type) ? type : [type];
    const isArticle = types.some(t => typeof t === "string" && /(?:NewsArticle|Article|ReportageNewsArticle)$/i.test(t));
    if (isArticle) {
      const id = typeof record["@id"] === "string" ? record["@id"] : "";
      const url = typeof record.url === "string" ? record.url : "";
      const main = record.mainEntityOfPage;
      const mainUrl = typeof main === "string" ? main :
        main && typeof main === "object" ? String((main as Record<string,unknown>)["@id"] || (main as Record<string,unknown>).url || "") : "";
      const references = [id, url, mainUrl].filter(Boolean);
      const matches = references.some(ref => {
        try { const found = new URL(ref, requestedUrl); return found.hostname === requestedUrl.hostname && found.pathname.replace(/\/$/, "") === requestedPath; }
        catch { return false; }
      });
      if (matches) {
        const accessible = record.isAccessibleForFree;
        if (accessible === true || accessible === "True" || accessible === "true") return false;
        if (accessible === false || accessible === "False" || accessible === "false") return true;
      }
    }
    for (const child of Object.values(record)) {
      if (child && typeof child === "object") {
        const result = walk(child);
        if (result !== null) return result;
      }
    }
    return null;
  };
  for (const object of objects) { const result = walk(object); if (result !== null) return result; }
  return null;
}

export async function POST(req: NextRequest) {
  const { url } = await req.json();
  let parsed: URL;

  try {
    parsed = new URL(String(url ?? ""));
  } catch {
    return NextResponse.json({ requiresSubscription: null }, { status: 400 });
  }

  if (parsed.protocol !== "https:" || !ALLOWED_HOSTS.has(parsed.hostname)) {
    return NextResponse.json({ requiresSubscription: null }, { status: 400 });
  }

  // Børsens almindelige artikelunivers kræver abonnement.
  if (/^(www\.)?borsen\.dk$/i.test(parsed.hostname)) {
    return NextResponse.json({ requiresSubscription: true, basis: "publisher-rule" });
  }

  try {
    const response = await fetch(parsed.toString(), {
      redirect: "follow",
      cache: "no-store",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; KONTEKST/0.5)",
        Accept: "text/html,application/xhtml+xml"
      },
      signal: AbortSignal.timeout(6000)
    });

    if (!response.ok) return NextResponse.json({ requiresSubscription: null });
    const html = await response.text();
    if (/(?:^|\\.)stiften\\.dk$/i.test(parsed.hostname)) {
      const scopedResult = articleAccessFromJsonLd(html, parsed);
      // Absence of article-level evidence is unknown, not a subscription.
      // Generic subscription banners often belong to the publisher or other stories.
      return NextResponse.json({ requiresSubscription: scopedResult, basis: "article-jsonld" });
    }
    return NextResponse.json({ requiresSubscription: looksLikePaywall(html) });
  } catch {
    return NextResponse.json({ requiresSubscription: null });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { classifyArticleAccess } from "@/lib/article-access";

const ALLOWED_HOSTS = new Set([
  "dr.dk","www.dr.dk","politiken.dk","www.politiken.dk","version2.dk","www.version2.dk",
  "ing.dk","www.ing.dk","computerworld.dk","www.computerworld.dk","techsavvy.media","www.techsavvy.media",
  "altinget.dk","www.altinget.dk","nordjyske.dk","www.nordjyske.dk","fyens.dk","www.fyens.dk",
  "jv.dk","www.jv.dk","hsfo.dk","www.hsfo.dk","frdb.dk","www.frdb.dk","journalisten.dk","www.journalisten.dk",
  "berlingske.dk","www.berlingske.dk","borsen.dk","www.borsen.dk",
  "stiften.dk","www.stiften.dk","migogaarhus.dk","www.migogaarhus.dk",
  "tv2.dk","www.tv2.dk","nyheder.tv2.dk"
]);

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

    if (!response.ok || !/(?:text\/html|application\/xhtml\+xml)/i.test(response.headers.get("content-type") || "")) {
      return NextResponse.json({ requiresSubscription: null });
    }
    // A redirect to a login page, front page or another article must not
    // transfer that page's access status to the originally requested story.
    const finalUrl = new URL(response.url);
    const sameSite = finalUrl.hostname.replace(/^www\./i, "") === parsed.hostname.replace(/^www\./i, "");
    const samePath = finalUrl.pathname.replace(/\/+$/, "") === parsed.pathname.replace(/\/+$/, "");
    if (!sameSite || !samePath) return NextResponse.json({ requiresSubscription: null });

    const html = (await response.text()).slice(0, 750000);
    const result = classifyArticleAccess(html, parsed);
    // Sample anonymous source-level evidence for later accuracy improvements.
    // Do not log URLs, titles, article text or visitor details.
    const sample = [...parsed.pathname].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) >>> 0, 0) % 16;
    if (sample === 0) {
      console.info("ØL.dk access evidence", JSON.stringify({
        publisher: parsed.hostname.replace(/^www\./i, ""),
        access: result.requiresSubscription === null ? "unknown" : result.requiresSubscription ? "abb" : "free",
        basis: result.basis
      }));
    }
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ requiresSubscription: null });
  }
}

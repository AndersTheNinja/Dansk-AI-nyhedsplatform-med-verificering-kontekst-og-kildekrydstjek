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

    if (!response.ok) return NextResponse.json({ requiresSubscription: null });
    const html = await response.text();
    // Never infer "gratis" merely because a paywall is not visible.
    // Classify against metadata for this very article, or leave unknown.
    return NextResponse.json(classifyArticleAccess(html, parsed));
  } catch {
    return NextResponse.json({ requiresSubscription: null });
  }
}

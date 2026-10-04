import { NextRequest, NextResponse } from "next/server";

const ALLOWED_HOSTS = new Set([
  "dr.dk","www.dr.dk","politiken.dk","www.politiken.dk","version2.dk","www.version2.dk",
  "ing.dk","www.ing.dk","computerworld.dk","www.computerworld.dk","techsavvy.media","www.techsavvy.media",
  "altinget.dk","www.altinget.dk","nordjyske.dk","www.nordjyske.dk","fyens.dk","www.fyens.dk",
  "jv.dk","www.jv.dk","hsfo.dk","www.hsfo.dk","frdb.dk","www.frdb.dk","journalisten.dk","www.journalisten.dk",
  "berlingske.dk","www.berlingske.dk"
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
    /læs videre med abonnement/
  ].some((pattern) => pattern.test(sample));
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
    return NextResponse.json({ requiresSubscription: looksLikePaywall(await response.text()) });
  } catch {
    return NextResponse.json({ requiresSubscription: null });
  }
}

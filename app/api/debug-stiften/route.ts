import { NextResponse } from "next/server";

export async function GET() {
  const url = "https://stiften.dk/debat/nu-kommer-regningen-til-boern-og-unge";
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; OELdk-debug/1.0)",
      Accept: "text/html,application/xhtml+xml"
    },
    redirect: "follow",
    cache: "no-store"
  });
  const html = await response.text();

  const picks = {
    status: response.status,
    finalUrl: response.url,
    length: html.length,
    titleIndex: html.toLowerCase().indexOf("nu kommer regningen til børn og unge".toLowerCase()),
    articleBodyIndex: html.indexOf('"articleBody"'),
    articleIndex: html.toLowerCase().indexOf("<article"),
    pIndex: html.toLowerCase().indexOf("<p"),
    nextDataIndex: html.indexOf("__NEXT_DATA__"),
    bodyKeys: Array.from(html.matchAll(/"(?:articleBody|body|content|text|intro|lead|teaser|description)"\s*:/gi))
      .slice(0, 80)
      .map((m) => ({ index: m.index, key: m[0] }))
  };

  const center = picks.titleIndex >= 0 ? picks.titleIndex : Math.max(picks.articleBodyIndex, picks.articleIndex, picks.pIndex, 0);
  const start = Math.max(0, center - 2500);
  const end = Math.min(html.length, center + 12000);

  return NextResponse.json({
    ...picks,
    snippet: html.slice(start, end)
  });
}

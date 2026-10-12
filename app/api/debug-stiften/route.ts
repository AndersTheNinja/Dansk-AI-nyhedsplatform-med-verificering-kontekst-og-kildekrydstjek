import { NextResponse } from "next/server";

export async function GET() {
  const base = "https://stiften.dk/debat/nu-kommer-regningen-til-boern-og-unge";
  const variants = [
    base,
    base + "?rss",
    base + "?amp",
    base + "?output=1",
    base + "?output=amp",
    base + "/amp",
    base.replace("https://stiften.dk", "https://www.stiften.dk")
  ];

  const results = [];

  for (const url of variants) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "da-DK,da;q=0.9,en;q=0.8"
        },
        redirect: "follow",
        cache: "no-store"
      });
      const text = await response.text();
      results.push({
        url,
        status: response.status,
        finalUrl: response.url,
        length: text.length,
        titleIndex: text.toLowerCase().indexOf("nu kommer regningen til børn og unge"),
        articleBodyIndex: text.indexOf('"articleBody"'),
        pCount: Array.from(text.matchAll(/<p\b/gi)).length,
        articleCount: Array.from(text.matchAll(/<article\b/gi)).length,
        head: text.slice(0, 500)
      });
    } catch (error) {
      results.push({ url, error: String(error) });
    }
  }

  return NextResponse.json({ results });
}

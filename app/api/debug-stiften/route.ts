import { NextResponse } from "next/server";

export async function GET() {
  const feeds = [
    "https://stiften.dk/feed/forside",
    "https://stiften.dk/feed/aarhus",
    "https://stiften.dk/feed/erhverv",
    "https://stiften.dk/feed/sport"
  ];

  const title = "Nu kommer regningen til børn og unge";
  const results = [];

  for (const url of feeds) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; OELdk-debug/1.0)",
          Accept: "application/rss+xml,application/xml,text/xml,*/*"
        },
        cache: "no-store"
      });
      const xml = await response.text();
      const index = xml.toLowerCase().indexOf(title.toLowerCase());
      results.push({
        url,
        status: response.status,
        length: xml.length,
        index,
        snippet: index >= 0 ? xml.slice(Math.max(0, index - 3500), Math.min(xml.length, index + 9000)) : ""
      });
    } catch (error) {
      results.push({ url, error: String(error) });
    }
  }

  return NextResponse.json({ results });
}

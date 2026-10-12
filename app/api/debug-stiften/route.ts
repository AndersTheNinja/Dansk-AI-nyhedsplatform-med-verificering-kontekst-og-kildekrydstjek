import { NextResponse } from "next/server";

export async function GET() {
  const articleUrl = "https://stiften.dk/debat/nu-kommer-regningen-til-boern-og-unge";
  const articleResponse = await fetch(articleUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
      Accept: "text/html,application/xhtml+xml"
    },
    cache: "no-store"
  });
  const html = await articleResponse.text();
  const path = html.match(/data-load-async-url=["']([^"']+)["']/i)?.[1] || "";

  let asyncStatus = 0;
  let asyncText = "";
  if (path) {
    const asyncUrl = new URL(path, articleUrl).toString();
    const response = await fetch(asyncUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
        Accept: "text/html,application/xhtml+xml,*/*"
      },
      cache: "no-store"
    });
    asyncStatus = response.status;
    asyncText = await response.text();
  }

  return NextResponse.json({
    articleStatus: articleResponse.status,
    asyncPath: path,
    asyncStatus,
    asyncLength: asyncText.length,
    asyncHead: asyncText.slice(0, 18000)
  });
}

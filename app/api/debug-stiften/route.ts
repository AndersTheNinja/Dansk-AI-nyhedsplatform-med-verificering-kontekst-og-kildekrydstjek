import { NextResponse } from "next/server";

const URL = "https://stiften.dk/debat/traek-nu-plasteret-af-winnerskjold-aarhus-kan-ikke-holde-til-mere-letbane";

function clean(value: string) {
  return value
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&aelig;/gi, "æ")
    .replace(/&oslash;/gi, "ø")
    .replace(/&aring;/gi, "å")
    .replace(/\s+/g, " ")
    .trim();
}

export async function GET() {
  const response = await fetch(URL, {
    cache: "no-store",
    redirect: "follow",
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; OELdk/1.0; +https://øl.dk)",
      Accept: "text/html,application/xhtml+xml"
    }
  });
  const html = await response.text();
  const asyncPath = html.match(/data-load-async-url=["']([^"']+)["']/i)?.[1] || "";
  const paragraphs = Array.from(html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi))
    .map((m) => clean(m[1] || ""))
    .filter(Boolean);
  let asyncStatus = 0;
  let asyncHtml = "";
  let asyncParagraphs: string[] = [];
  if (asyncPath) {
    const asyncUrl = new URL(asyncPath, URL).toString();
    const ar = await fetch(asyncUrl, {
      cache: "no-store",
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; OELdk/1.0; +https://øl.dk)",
        Accept: "text/html,application/xhtml+xml,*/*"
      }
    });
    asyncStatus = ar.status;
    asyncHtml = await ar.text();
    asyncParagraphs = Array.from(asyncHtml.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi))
      .map((m) => clean(m[1] || ""))
      .filter(Boolean);
  }
  return NextResponse.json({
    status: response.status,
    finalUrl: response.url,
    htmlLength: html.length,
    asyncPath,
    asyncStatus,
    asyncLength: asyncHtml.length,
    paragraphs: paragraphs.slice(0, 30),
    asyncParagraphs: asyncParagraphs.slice(0, 30),
    hasArticleBody: /"articleBody"\s*:/i.test(html),
    ogTitle: html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i)?.[1] || ""
  });
}

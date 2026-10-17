import { NextResponse } from "next/server";

const URL = "https://politiken.dk/kultur/boger/art11019372/Lone-Frank-er-skeptisk-over-for-tidens-f%C3%B8lekultur.-Men-hvad-g%C3%B8r-hun-selv";
const SEED = "Lone Frank rejser ud i verden for at finde meningen med livet";

function strip(html: string) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function around(text: string, needle: string) {
  const i = text.toLowerCase().indexOf(needle.toLowerCase());
  if (i < 0) return "";
  return text.slice(Math.max(0, i - 150), i + 1600);
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
  const visible = strip(html);
  const article = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] || "";
  const articleVisible = strip(article);
  const paragraphs = Array.from(html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)).map(m => strip(m[1] || "")).filter(Boolean);
  return NextResponse.json({
    status: response.status,
    htmlLength: html.length,
    articleLength: article.length,
    hasSeedVisible: visible.toLowerCase().includes(SEED.toLowerCase()),
    seedContextVisible: around(visible, SEED),
    seedContextArticle: around(articleVisible, SEED),
    paragraphCount: paragraphs.length,
    matchingParagraphs: paragraphs.filter(p => p.toLowerCase().includes("lone frank") || p.toLowerCase().includes("meningen med livet")).slice(0, 20),
    firstParagraphs: paragraphs.slice(0, 25)
  });
}

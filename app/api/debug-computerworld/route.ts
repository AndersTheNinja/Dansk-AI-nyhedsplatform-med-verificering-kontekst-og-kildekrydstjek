import { NextResponse } from "next/server";

const URL = "https://www.computerworld.dk/art/297203/amerikanske-cloud-giganter-advarer-saa-dyrt-vil-det-blive-for-europa-at-sige-farvel-til-os?utm_source=RSS&utm_medium=RSS&utm_campaign=RSS";
const SEED = "EU vil gøre sig mindre afhængig af udenlandsk cloud";

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
  return text.slice(Math.max(0, i - 120), i + 650);
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
  const article = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] || "";
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] || "";
  const visible = strip(html);
  const mainVisible = strip(main);
  const paragraphs = Array.from(html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)).map(m => strip(m[1] || "")).filter(Boolean);
  return NextResponse.json({
    status: response.status,
    finalUrl: response.url,
    htmlLength: html.length,
    articleLength: article.length,
    mainLength: main.length,
    hasSeedRaw: html.toLowerCase().includes(SEED.toLowerCase()),
    hasSeedVisible: visible.toLowerCase().includes(SEED.toLowerCase()),
    hasOverviewRaw: html.toLowerCase().includes("det får du i artiklen"),
    hasOverviewVisible: visible.toLowerCase().includes("det får du i artiklen"),
    paragraphCount: paragraphs.length,
    seedContextVisible: around(visible, SEED),
    seedContextMain: around(mainVisible, SEED),
    overviewContextVisible: around(visible, "det får du i artiklen"),
    firstParagraphs: paragraphs.slice(0, 12)
  });
}

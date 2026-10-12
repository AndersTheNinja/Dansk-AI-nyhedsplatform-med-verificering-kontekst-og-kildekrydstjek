import { NextResponse } from "next/server";

function stripHtml(html: string) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--([\s\S]*?)-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&raquo;/gi, "»")
    .replace(/&laquo;/gi, "«")
    .replace(/\s+/g, " ")
    .trim();
}

export async function GET() {
  const url = "https://stiften.dk/debat/nu-kommer-regningen-til-boern-og-unge";
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "da-DK,da;q=0.9,en;q=0.8"
    },
    redirect: "follow",
    cache: "no-store"
  });
  const html = await response.text();
  const needle = "Nu kommer regningen til børn og unge";
  const indices = [];
  let from = 0;
  while (true) {
    const i = html.toLowerCase().indexOf(needle.toLowerCase(), from);
    if (i < 0) break;
    indices.push(i);
    from = i + needle.length;
    if (indices.length >= 20) break;
  }

  const classes = Array.from(html.matchAll(/class=(["'])([^"']*(?:article|body|content|lead|intro|story|text)[^"']*)\1/gi))
    .map((m) => m[2])
    .filter(Boolean);
  const uniqueClasses = Array.from(new Set(classes)).slice(0, 120);

  const plain = stripHtml(html);
  const plainNeedle = plain.toLowerCase().indexOf(needle.toLowerCase());

  return NextResponse.json({
    status: response.status,
    length: html.length,
    indices,
    classNames: uniqueClasses,
    plainNeedle,
    plainText: plain.slice(Math.max(0, plainNeedle - 1500), Math.min(plain.length, plainNeedle + 14000)),
    htmlSnippets: indices.slice(0, 8).map((i) => html.slice(Math.max(0, i - 1000), Math.min(html.length, i + 3500)))
  });
}

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const allowedHosts = new Set([
  "dr.dk", "www.dr.dk", "politiken.dk", "www.politiken.dk",
  "borsen.dk", "www.borsen.dk", "stiften.dk", "www.stiften.dk",
  "migogaarhus.dk", "www.migogaarhus.dk", "tv2.dk", "www.tv2.dk", "nyheder.tv2.dk",
  "berlingske.dk", "www.berlingske.dk", "journalisten.dk", "www.journalisten.dk",
  "altinget.dk", "www.altinget.dk", "version2.dk", "www.version2.dk",
  "ing.dk", "www.ing.dk", "computerworld.dk", "www.computerworld.dk",
  "techsavvy.media", "www.techsavvy.media"
]);

function metadata(html: string, name: string) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const identity = tag.match(/(?:property|name)\s*=\s*["']([^"']+)["']/i)?.[1];
    if (identity?.toLowerCase() !== name.toLowerCase()) continue;
    const content = tag.match(/\bcontent\s*=\s*["']([^"']+)["']/i)?.[1];
    if (content) return content.replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').trim();
  }
  return "";
}

function titleMatches(expected: string, actual: string) {
  const tokens = (value: string) => new Set(
    value.toLocaleLowerCase("da-DK")
      .replace(/[^a-z0-9æøå]+/g, " ")
      .split(/\s+/)
      .filter((word) => word.length >= 4)
  );
  const a = tokens(expected);
  const b = tokens(actual);
  if (!a.size || !b.size) return false;
  const overlap = [...a].filter((w) => b.has(w)).length;
  return overlap >= Math.min(2, a.size) &&
    overlap / Math.min(a.size, b.size) >= 0.6;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const page = new URL(String(body?.url || ""));
    const expectedTitle = String(body?.title || "").trim().slice(0, 300);

    if (page.protocol !== "https:" || !allowedHosts.has(page.hostname) ||
        page.username || page.password || expectedTitle.length < 8) {
      return NextResponse.json({ imageUrl: null }, { status: 400 });
    }

    let current = page;
    let response: Response | undefined;
    for (let i = 0; i < 2; i++) {
      response = await fetch(current.toString(), {
        redirect: "manual",
        next: { revalidate: 900 },
        headers: { Accept: "text/html,application/xhtml+xml" },
        signal: AbortSignal.timeout(4500)
      });
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      const location = response.headers.get("location");
      if (!location) break;
      const next = new URL(location, current);
      if (next.protocol !== "https:" || !allowedHosts.has(next.hostname)) break;
      current = next;
    }

    if (!response?.ok || !(response.headers.get("content-type") || "").includes("text/html")) {
      return NextResponse.json({ imageUrl: null });
    }

    const html = (await response.text()).slice(0, 500000);
    const actualTitle = metadata(html, "og:title") || metadata(html, "twitter:title");
    if (!titleMatches(expectedTitle, actualTitle)) {
      return NextResponse.json({ imageUrl: null });
    }

    const value = metadata(html, "og:image") || metadata(html, "twitter:image");
    if (!value) return NextResponse.json({ imageUrl: null });
    const image = new URL(value, current);
    if (image.protocol !== "https:" || image.username || image.password ||
        /(?:^|\/)(?:logo|favicon|avatar|placeholder)(?:[-_.\/]|$)/i.test(image.pathname)) {
      return NextResponse.json({ imageUrl: null });
    }

    return NextResponse.json({ imageUrl: image.toString() }, {
      headers: { "Cache-Control": "private, max-age=900" }
    });
  } catch {
    return NextResponse.json({ imageUrl: null });
  }
}

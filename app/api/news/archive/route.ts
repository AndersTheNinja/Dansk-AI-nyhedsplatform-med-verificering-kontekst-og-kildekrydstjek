import { NextRequest, NextResponse } from "next/server";
import { databaseRpc } from "@/lib/database-rpc";
import type { Story } from "@/lib/stories";

export const dynamic = "force-dynamic";

type ArchiveRow = {
  id: number; url: string; title: string; source: string;
  sourceMethod?: string; publishedAt?: string; category?: string;
  mentions?: unknown; andersOnly?: boolean;
};

const categories = new Set<Story["category"]>(["AI/Tech", "Erhverv", "Danmark", "Aarhus"]);

function validArticleUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

function publishedLabel(raw?: string) {
  if (!raw) return "Dato ukendt";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "Dato ukendt";
  return [
    new Intl.DateTimeFormat("da-DK", { timeZone: "Europe/Copenhagen", hour: "2-digit", minute: "2-digit" }).format(date),
    new Intl.DateTimeFormat("da-DK", { timeZone: "Europe/Copenhagen", day: "numeric", month: "short", year: "numeric" }).format(date)
  ].join(" · ");
}

function toArchiveStory(value: ArchiveRow): Story {
  const category = categories.has(value.category as Story["category"])
    ? value.category as Story["category"] : "Danmark";
  const source = typeof value.source === "string" && value.source.trim() ? value.source : "Ukendt medie";
  const method = value.sourceMethod === "WEB" ? "WEB" as const : "RSS" as const;
  return {
    id: "archive:" + value.id,
    title: value.title,
    category,
    sourceLabel: source,
    published: "Arkiv",
    publishedAt: value.publishedAt,
    publishedDate: publishedLabel(value.publishedAt),
    sourceMethod: method,
    summary: "",
    archiveOnly: true,
    mentions: Array.isArray(value.mentions) ? value.mentions.filter((item): item is string => typeof item === "string") : [],
    andersOnly: value.andersOnly === true,
    why: "Historisk nyhed fra ØL.dk's arkiv.",
    verification: "unverified",
    verificationText: "Arkivlink til originaludgiveren. Intet AI-resumé er genereret.",
    neutrality: {
      wording: 100, wordingNote: "Arkivlink uden genereret tekst.", wordingExamples: [],
      sources: null, sourcesNote: "Ikke vurderet for arkivlink.", sourcesExamples: []
    },
    sources: [{ label: source, url: value.url, title: value.title, method }]
  };
}

// Historical publisher metadata is loaded separately, so the newest news feed
// stays fast and no archived article incurs a new AI summary request.
export async function GET(req: NextRequest) {
  const offsetParam = Number(req.nextUrl.searchParams.get("offset") ?? "0");
  const limitParam = Number(req.nextUrl.searchParams.get("limit") ?? "100");
  const offset = Number.isSafeInteger(offsetParam) ? Math.max(0, Math.min(offsetParam, 20000)) : 0;
  const limit = Number.isSafeInteger(limitParam) ? Math.max(1, Math.min(limitParam, 100)) : 100;
  try {
    const response = await databaseRpc("oeldk_archive_page", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ p_limit: limit, p_offset: offset }),
      cache: "no-store",
      signal: AbortSignal.timeout(6000)
    });
    if (!response.ok) throw new Error("Archive database response " + response.status);
    const data: unknown = await response.json();
    if (!data || typeof data !== "object" || !("stories" in data) ||
        !Array.isArray(data.stories) || !("totalCount" in data)) {
      throw new Error("Unexpected archive response");
    }
    const rows = data.stories as ArchiveRow[];
    const totalCount = Number(data.totalCount) || 0;
    const stories = rows.filter(row =>
      row && typeof row.id === "number" && typeof row.title === "string" &&
      row.title.trim().length >= 5 && typeof row.url === "string" &&
      validArticleUrl(row.url)
    ).map(toArchiveStory);

    return NextResponse.json({
      stories, totalCount, offset, limit, hasMore: offset + rows.length < totalCount
    }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } });
  } catch (error) {
    console.error("News archive lookup failed", String(error));
    return NextResponse.json(
      { error: "Arkivet kunne ikke indlæses." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}

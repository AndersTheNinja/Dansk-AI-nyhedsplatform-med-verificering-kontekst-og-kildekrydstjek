// ØL.dk persistent news archive
import type { Story } from "@/lib/stories";

type StoredStory = {
  canonical_url: string;
  title: string;
  source: string;
  source_method?: string;
  category: string;
  published_at?: string;
  teaser: string;
  story_group: string;
  raw_metadata: Record<string, unknown>;
  sources: Story["sources"];
};

export async function persistStories(stories: Story[]) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  const secret = process.env.OEL_INGEST_SECRET;

  if (!url || !key || !secret || !stories.length) return;

  const payload: StoredStory[] = stories
    .filter((story) => story.sources[0]?.url)
    .map((story) => ({
      canonical_url: story.sources[0].url,
      title: story.title,
      source: story.sourceLabel,
      source_method: story.sourceMethod,
      category: story.category,
      published_at: story.publishedAt,
      teaser: story.summary,
      story_group: story.id,
      raw_metadata: {
        verification: story.verification,
        verificationText: story.verificationText,
        neutrality: story.neutrality
      },
      sources: story.sources
    }));

  if (!payload.length) return;

  const response = await fetch(`${url}/rest/v1/rpc/ingest_news_batch`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "x-oel-ingest-secret": secret
    },
    body: JSON.stringify({ payload }),
    signal: AbortSignal.timeout(8000),
    cache: "no-store"
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(`Supabase ingest failed (${response.status}): ${message.slice(0, 250)}`);
  }
}


export async function getVisibleArchiveCount() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return 0;

  try {
    const response = await fetch(`${url}/rest/v1/rpc/visible_news_archive_count`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: "{}",
      cache: "no-store",
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) return 0;
    const value = await response.json();
    return typeof value === "number" ? value : Number(value) || 0;
  } catch {
    return 0;
  }
}


function formatArchivePublishedDate(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;

  const timePart = new Intl.DateTimeFormat("da-DK", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Copenhagen"
  }).format(date);

  const datePart = new Intl.DateTimeFormat("da-DK", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Copenhagen"
  }).format(date);

  const keyFormatter = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Europe/Copenhagen"
  });
  const isToday = keyFormatter.format(date) === keyFormatter.format(new Date());

  return `${timePart} · ${isToday ? "I dag, " : ""}${datePart}`;
}

export async function getAndersWinnerskjoldArchiveStories(): Promise<Story[]> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return [];

  try {
    const response = await fetch(`${url}/rest/v1/rpc/anders_winnerskjold_archive`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: "{}",
      cache: "no-store",
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) return [];
    const rows = await response.json();
    if (!Array.isArray(rows)) return [];

    return rows.map((row: any) => {
      const raw = row?.raw_metadata || {};
      const sources = Array.isArray(row?.sources) && row.sources.length
        ? row.sources
        : [{
            label: String(row?.source || "Ukendt"),
            url: String(row?.canonical_url || ""),
            title: String(row?.title || ""),
            method: row?.source_method === "WEB" ? "WEB" : "RSS"
          }];

      return {
        id: String(row?.story_group || `archive:${row?.id}`),
        category: (["AI/Tech", "Erhverv", "Danmark", "Aarhus"].includes(row?.category)
          ? row.category
          : "Aarhus") as Story["category"],
        title: String(row?.title || ""),
        sourceLabel: String(row?.source || "Ukendt"),
        published: "Arkiv",
        publishedAt: row?.published_at ? String(row.published_at) : undefined,
        publishedDate: formatArchivePublishedDate(row?.published_at ? String(row.published_at) : undefined),
        sourceMethod: row?.source_method === "WEB" ? "WEB" : "RSS",
        summary: String(row?.teaser || ""),
        why: "Gemte ØL.dk-nyheder om Aarhus-borgmester Anders Winnerskjold.",
        verification: raw?.verification === "confirmed" || raw?.verification === "nuance"
          ? raw.verification
          : "unverified",
        verificationText: String(raw?.verificationText || "Arkivhistorie fra ØL.dk."),
        neutrality: raw?.neutrality || {
          wording: 100,
          wordingNote: "Arkivhistorie.",
          wordingExamples: [],
          sources: null,
          sourcesNote: "Arkivhistorie.",
          sourcesExamples: []
        },
        sources
      } satisfies Story;
    }).filter((story: Story) => story.title && story.sources[0]?.url);
  } catch {
    return [];
  }
}

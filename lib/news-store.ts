import { databaseConfigured, databaseRpc } from "@/lib/database-rpc";
// ØL.dk persistent news archive
import type { Story } from "@/lib/stories";
import { selectAcrossPublishers } from "@/lib/media-publishers";

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

// Keep failed previews outside the visible archive until verified text is available.
export async function queuePreviewRepairs(stories: Story[]) {

  const secret = process.env.OEL_INGEST_SECRET;
  if (!databaseConfigured() || !secret || !stories.length) return;
  const payload = stories.slice(0, 100).flatMap((story) => {
    const lead = story.sources[0];
    if (!lead) return [];
    try {
      const link = new URL(lead.url);
      if (link.protocol !== "https:" || link.username || link.password || link.port) return [];
      return [{ url: link.origin + link.pathname.replace(/\/$/, ""), source: lead.label, title: story.title }];
    } catch { return []; }
  });
  if (!payload.length) return;
  const response = await databaseRpc("oeldk_queue_preview_repairs", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-oel-ingest-secret": secret },
    body: JSON.stringify({ payload }),
    signal: AbortSignal.timeout(8000),
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`Preview repair queue failed (${response.status})`);
}

export async function persistStories(stories: Story[]) {

  const secret = process.env.OEL_INGEST_SECRET;

  if (!databaseConfigured() || !secret || !stories.length) return;

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
        neutrality: story.neutrality,
        mentions: story.mentions || [],
        andersOnly: Boolean(story.andersOnly)
      },
      sources: story.sources
    }));

  if (!payload.length) return;

  const response = await databaseRpc("ingest_news_batch", {
    method: "POST",
    headers: {
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

  if (!databaseConfigured()) return 0;

  try {
    const response = await databaseRpc("visible_news_archive_count", {
      method: "POST",
      headers: {
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

  if (!databaseConfigured()) return [];

  try {
    const request = () => ({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
      cache: "no-store" as const,
      signal: AbortSignal.timeout(5000)
    });
    let response: Response | undefined;
    if (process.env.OEL_DATABASE_URL) {
      try { response = await databaseRpc("oeldk_anders_archive_v2", request()); }
      catch (error) { console.warn("Full Anders archive not available yet", String(error)); }
    }
    if (!response?.ok) response = await databaseRpc("anders_winnerskjold_archive", request());

    if (!response.ok) return [];
    const rows = await response.json();
    if (!Array.isArray(rows)) return [];

    return Promise.all(rows.map(async (row: any) => {
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
        mentions: Array.isArray(raw?.mentions) ? raw.mentions.map(String) : [],
        andersOnly: Boolean(raw?.andersOnly) || /^(?:Jyllands-Posten|JP Kronik)/i.test(String(row?.source || "")),
        // Public previews are applied with the same URL/title validation as current stories.
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
    })).then((stories) => stories.filter((story: Story) => story.title && story.sources[0]?.url));
  } catch {
    return [];
  }
}


type StoredNewsCandidate = {
  id: number;
  url: string;
  title: string;
  source: string;
  method?: string;
  category?: string;
  publishedAt?: string;
  summary: string;
  storyId?: string;
  meta?: Record<string, unknown>;
};

// Reuse an existing batch of published stories without publishing old
// headlines as archive links or generating AI text in the visitor's browser.
let recentCandidateCache: { stories: Story[]; checkedAt: number } | null = null;
let recentCandidateInFlight: Promise<Story[]> | null = null;
export async function getRecentStoredNewsCandidates(limit = 500): Promise<Story[]> {
  const count = Math.max(1, Math.min(500, Math.trunc(limit)));
  if (recentCandidateCache && Date.now() - recentCandidateCache.checkedAt < 45_000) {
    return recentCandidateCache.stories.slice(0, count);
  }
  if (recentCandidateInFlight) return (await recentCandidateInFlight).slice(0, count);
  if (!databaseConfigured()) return [];

  recentCandidateInFlight = (async () => {
    try {
      const response = await databaseRpc("oeldk_recent_news_candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ p_limit: 500 }),
        cache: "no-store",
        signal: AbortSignal.timeout(7000)
      });
      if (!response.ok) throw new Error("Stored news candidates returned " + response.status);
      const rows: unknown = await response.json();
      if (!Array.isArray(rows)) throw new Error("Invalid stored news candidates");
      const categories = new Set(["AI/Tech", "Erhverv", "Danmark", "Aarhus"]);
      const stories: Story[] = rows.flatMap((entry: StoredNewsCandidate) => {
        if (!entry || typeof entry.url !== "string" ||
            typeof entry.title !== "string" || typeof entry.summary !== "string" ||
            entry.summary.trim().length < 50 || entry.title.trim().length < 5) return [];
        try {
          const url = new URL(entry.url);
          if (url.protocol !== "https:" || url.username || url.password || url.port) return [];
        } catch { return []; }
        const raw = entry.meta && typeof entry.meta === "object" ? entry.meta : {};
        const neutrality = raw.neutrality;
        const method = entry.method === "WEB" ? "WEB" as const : "RSS" as const;
        const source = typeof entry.source === "string" && entry.source.trim() ? entry.source : "Ukendt kilde";
        return [{
          id: typeof entry.storyId === "string" && entry.storyId ? entry.storyId : "stored:" + entry.id,
          category: (categories.has(entry.category || "") ? entry.category : "Danmark") as Story["category"],
          title: entry.title,
          sourceLabel: source,
          sourceMethod: method,
          published: "Tidligere",
          publishedAt: entry.publishedAt,
          publishedDate: formatArchivePublishedDate(entry.publishedAt),
          summary: entry.summary.slice(0, 2200),
          mentions: Array.isArray(raw.mentions) ? raw.mentions.filter((value): value is string => typeof value === "string") : [],
          andersOnly: raw.andersOnly === true,
          why: "Redaktionel nyhed fra en angivet kilde.",
          verification: raw.verification === "confirmed" || raw.verification === "nuance" ? raw.verification : "unverified",
          verificationText: typeof raw.verificationText === "string" ? raw.verificationText : "Nyhed fra en angivet kilde.",
          neutrality: neutrality && typeof neutrality === "object" &&
            "wording" in neutrality ? neutrality as Story["neutrality"] : {
              wording: 100, wordingNote: "Ikke vurderet.", wordingExamples: [],
              sources: null, sourcesNote: "Ikke vurderet.", sourcesExamples: []
            },
          sources: [{ label: source, url: entry.url, title: entry.title, method }]
        } satisfies Story];
      });
      recentCandidateCache = { stories, checkedAt: Date.now() };
      return stories;
    } catch (error) {
      console.warn("Stored news candidates unavailable", String(error));
      return [];
    }
  })();
  try { return (await recentCandidateInFlight).slice(0, count); }
  finally { recentCandidateInFlight = null; }
}

/** Prefer the freshest live RSS metadata and add recent stored articles once. */
export function combineNewsCandidates(live: Story[], stored: Story[], limit = 500): Story[] {
  const seen = new Set<string>();
  const candidates = [...live, ...stored]
    .sort((a, b) => (b.publishedAt ? Date.parse(b.publishedAt) || 0 : 0) -
      (a.publishedAt ? Date.parse(a.publishedAt) || 0 : 0))
    .filter(story => {
      const url = story.sources[0]?.url;
      if (!url || seen.has(url)) return false;
      seen.add(url);
      return true;
    });
  // Keep at least two candidates per available publisher for the background
  // summary collector, even if a quieter source posted yesterday.
  return selectAcrossPublishers(candidates, Math.max(1, limit), 2);
}

// A single Railway instance can serve many visitors at once. Briefly reuse
// successful snapshots to reduce paid database egress without showing old news.
let recentSnapshot: { value: { stories: Story[]; totalCount: number; generatedAt: string; availableStories: number }; checkedAt: number } | null = null;

/** Read the latest precomputed feed. Never return stale news as current. */
export async function getNewsSnapshot(timeoutMs = 3500): Promise<{
  stories: Story[]; totalCount: number; generatedAt: string; availableStories: number
} | null> {
  if (recentSnapshot && Date.now() - recentSnapshot.checkedAt < 45_000) {
    const age = Date.now() - Date.parse(recentSnapshot.value.generatedAt);
    if (Number.isFinite(age) && age >= -120_000 && age <= 20 * 60_000)
      return recentSnapshot.value;
  }

  if (!databaseConfigured()) { console.warn("ØL snapshot unavailable: missing database configuration"); return null; }

  try {
    const response = await databaseRpc("oeldk_latest_news_snapshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!response.ok) { console.warn("ØL snapshot RPC non-200", response.status); return null; }
    const value = await response.json();
    if (!value || !Array.isArray(value.stories) || value.stories.length < 5) { console.warn("ØL snapshot RPC invalid result", typeof value, Array.isArray(value?.stories) ? value.stories.length : "missing"); return null; }
    const created = Date.parse(value.generatedAt);
    if (!Number.isFinite(created) || Date.now() - created > 20 * 60 * 1000 || created > Date.now() + 120000) { console.warn("ØL snapshot outside freshness window", { snapshotDate: value.generatedAt, ageSeconds: (Date.now()-created)/1000 }); return null; }
    const result = {
      stories: value.stories as Story[],
      totalCount: Number(value.totalCount) || value.stories.length,
      generatedAt: value.generatedAt as string,
      availableStories: value.stories.length
    };
    recentSnapshot = { value: result, checkedAt: Date.now() };
    return result;
  } catch (error) {
    console.warn("ØL snapshot RPC request failed", String(error));
    return null;
  }
}

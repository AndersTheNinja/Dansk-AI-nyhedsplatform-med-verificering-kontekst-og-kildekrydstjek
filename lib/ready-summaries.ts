import { createHash } from "node:crypto";
import type { Story } from "@/lib/stories";

export type PreparedStory = Story & { aiSummary: string };
export type SummaryState = { key: string; status: string; summary?: string; basisType?: string };

const SUPPORTED_HOSTS = new Set([
  "dr.dk", "www.dr.dk", "politiken.dk", "www.politiken.dk",
  "version2.dk", "www.version2.dk", "ing.dk", "www.ing.dk",
  "computerworld.dk", "www.computerworld.dk", "techsavvy.media", "www.techsavvy.media",
  "altinget.dk", "www.altinget.dk", "nordjyske.dk", "www.nordjyske.dk",
  "fyens.dk", "www.fyens.dk", "jv.dk", "www.jv.dk",
  "hsfo.dk", "www.hsfo.dk", "frdb.dk", "www.frdb.dk",
  "journalisten.dk", "www.journalisten.dk", "berlingske.dk", "www.berlingske.dk",
  "borsen.dk", "www.borsen.dk", "stiften.dk", "www.stiften.dk",
  "migogaarhus.dk", "www.migogaarhus.dk", "tv2.dk", "www.tv2.dk"
]);

// Must match /api/summary cache-key algorithm exactly to reuse existing summaries.
export function summaryCacheKey(story: Story): string | null {
  const source = story.sources[0]?.url;
  if (!source || story.title.length < 5 || story.title.length > 500) return null;
  try {
    const url = new URL(source);
    if (url.protocol !== "https:" || url.username || url.password || url.port ||
        !SUPPORTED_HOSTS.has(url.hostname)) return null;
    return createHash("sha256").update(
      JSON.stringify([url.href, story.title, story.summary])
    ).digest("hex");
  } catch { return null; }
}

export async function getSummaryStates(stories: Story[]): Promise<Map<string, SummaryState>> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  const secret = process.env.OEL_INGEST_SECRET;
  if (!url || !key || !secret) throw new Error("AI summary storage not configured");
  const ids = [...new Set(stories.map(summaryCacheKey).filter((id): id is string => Boolean(id)))];
  const states = new Map<string, SummaryState>();
  for (let offset = 0; offset < ids.length; offset += 800) {
    const response = await fetch(`${url}/rest/v1/rpc/oeldk_summary_batch_status`, {
      method: "POST",
      headers: {
        apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json",
        "x-oel-ingest-secret": secret
      },
      body: JSON.stringify({ p_keys: ids.slice(offset, offset + 800) }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) throw new Error(`AI summary batch lookup failed: ${response.status}`);
    const rows: unknown = await response.json();
    if (!Array.isArray(rows)) throw new Error("Unexpected AI summary cache response");
    for (const row of rows) {
      if (row && typeof row === "object" &&
          typeof row.key === "string" && typeof row.status === "string") {
        states.set(row.key, row as SummaryState);
      }
    }
  }
  return states;
}

export function onlyCompletedStories(stories: Story[], states: Map<string, SummaryState>): PreparedStory[] {
  return stories.flatMap(story => {
    const key = summaryCacheKey(story);
    const stored = key ? states.get(key) : null;
    if (stored?.status !== "ready" || typeof stored.summary !== "string" ||
        stored.summary.trim().length < 40) return [];
    return [{ ...story, aiSummary: stored.summary.trim() }];
  });
}

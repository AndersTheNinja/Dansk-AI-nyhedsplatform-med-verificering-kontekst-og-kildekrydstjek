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

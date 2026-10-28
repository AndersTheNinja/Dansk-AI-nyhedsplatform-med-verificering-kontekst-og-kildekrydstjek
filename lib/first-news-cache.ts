import type { Story } from "@/lib/stories";

// Short-lived public feed cache: useful when reopening ØL.dk on a phone.
// Never use old cached news in place of a fresh fetch.
export const FIRST_NEWS_CACHE_KEY = "oel-first-news-v1";
export const FIRST_NEWS_CACHE_TTL_MS = 2 * 60 * 1000;

export type FirstNewsCache = {
  savedAt: number;
  stories: Story[];
  totalCount: number;
};

export function parseFirstNewsCache(raw: string | null, now = Date.now()): FirstNewsCache | null {
  if (!raw) return null;
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object") return null;
    const { savedAt, stories, totalCount } = data as Partial<FirstNewsCache>;
    if (typeof savedAt !== "number" || !Number.isFinite(savedAt) ||
        savedAt > now || now - savedAt > FIRST_NEWS_CACHE_TTL_MS) return null;
    if (!Array.isArray(stories) || stories.length === 0 ||
        stories.length > 20 || !stories.every(story =>
          story && typeof story.id === "string" &&
          typeof story.title === "string" && typeof story.summary === "string" &&
          Array.isArray(story.sources))) return null;
    if (typeof totalCount !== "number" || !Number.isFinite(totalCount) || totalCount < stories.length) return null;
    return { savedAt, stories: stories as Story[], totalCount };
  } catch {
    return null;
  }
}

import type { Story } from "@/lib/stories";

/** One stable publisher label, even for clustered articles with 2+ sources. */
export function canonicalMediaName(label: string, link?: string): string {
  let host = "";
  try {
    host = new URL(link || "").hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    // Older stories may not carry a primary URL.
  }

  if (host === "dr.dk") return "DR";
  if (host === "nyheder.tv2.dk" || host === "tv2.dk") return "TV2.dk";
  if (host === "berlingske.dk") return "Berlingske";
  if (host === "politiken.dk") return "Politiken";
  if (host === "borsen.dk") return "Børsen";
  if (host === "altinget.dk") return "Altinget";
  if (host === "stiften.dk") return "Stiften.dk";
  if (host === "migogaarhus.dk") return "MigogAarhus";
  if (host === "journalisten.dk") return "Journalisten";
  if (host === "computerworld.dk") return "Computerworld";
  if (host === "ing.dk") return "Ingeniøren";
  if (host === "version2.dk") return "Version2";
  if (host === "techsavvy.media") return "TechSavvy";
  if (host === "y.dk") return "Y.dk";
  if (host === "fyens.dk") return "Fyens.dk";
  if (host === "nordjyske.dk") return "Nordjyske";
  if (host === "jv.dk") return "JydskeVestkysten";
  if (host === "hsfo.dk") return "Horsens Folkeblad";
  if (host === "frdb.dk") return "Fredericia Dagblad";

  const name = (label || "")
    .replace(/\s*[·•]\s*\d+\s*kilder?\s*$/i, "")
    .trim();
  if (/^(DR\b|Danmarks Radio)/i.test(name)) return "DR";
  if (/^TV\s?2/i.test(name)) return "TV2.dk";
  if (/^Berlingske/i.test(name)) return "Berlingske";
  if (/^Politiken/i.test(name)) return "Politiken";
  if (/^Børsen/i.test(name)) return "Børsen";
  if (/^Altinget/i.test(name)) return "Altinget";
  if (/^Fyens Stiftstidende/i.test(name)) return "Fyens.dk";
  return name || "Ukendt kilde";
}

/** A small allocation per active source keeps one major publisher from hiding others. */
export function selectAcrossPublishers<T extends Story>(
  stories: T[], limit: number, guaranteedPerMedia = 2
): T[] {
  const ordered = [...stories].sort((a, b) =>
    (b.publishedAt ? Date.parse(b.publishedAt) || 0 : 0) -
    (a.publishedAt ? Date.parse(a.publishedAt) || 0 : 0)
  );
  const reserved = new Set<string>();
  const usedPerMedia = new Map<string, number>();
  for (const story of ordered) {
    const media = canonicalMediaName(story.sources[0]?.label || story.sourceLabel, story.sources[0]?.url);
    const used = usedPerMedia.get(media) || 0;
    if (used >= guaranteedPerMedia) continue;
    if (reserved.size >= limit) break;
    reserved.add(story.sources[0]?.url || story.id);
    usedPerMedia.set(media, used + 1);
  }
  const selected = ordered.filter(story => reserved.has(story.sources[0]?.url || story.id));
  for (const story of ordered) {
    if (selected.length >= limit) break;
    if (!reserved.has(story.sources[0]?.url || story.id)) {
      selected.push(story);
    }
  }
  return selected.sort((a, b) =>
    (b.publishedAt ? Date.parse(b.publishedAt) || 0 : 0) -
    (a.publishedAt ? Date.parse(a.publishedAt) || 0 : 0)
  ).slice(0, Math.max(1, limit));
}

import { XMLParser } from "fast-xml-parser";
import type { Story } from "@/lib/stories";

type Category = Story["category"];

type RawItem = {
  title?: string;
  link?: string;
  pubDate?: string;
  description?: string;
  source?: string | { "#text"?: string };
};

const feeds: { category: Category; query: string }[] = [
  { category: "Danmark", query: "Danmark nyheder" },
  { category: "Erhverv", query: "dansk erhverv OR virksomheder OR startup" },
  { category: "AI/Tech", query: "AI OR kunstig intelligens OR teknologi Danmark" },
  { category: "Aarhus", query: "Aarhus" }
];

const parser = new XMLParser({
  ignoreAttributes: false,
  processEntities: true,
  trimValues: true
});

function stripHtml(value = "") {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function sourceName(source: RawItem["source"]) {
  if (typeof source === "string") return source;
  return source?.["#text"] || "Nyhedskilde";
}

function timeAgo(pubDate?: string) {
  if (!pubDate) return "Senest";
  const date = new Date(pubDate);
  if (Number.isNaN(date.getTime())) return "Senest";
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 60) return minutes <= 1 ? "Nu" : `${minutes} min. siden`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} t. siden`;
  const days = Math.floor(hours / 24);
  return `${days} d. siden`;
}

function words(title: string) {
  const stop = new Set([
    "og","i","på","af","for","til","med","en","et","den","det","de","der","som","fra",
    "har","er","at","om","nu","ny","nye","efter","kan","vil","skal","sig","ikke"
  ]);
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-zæøå0-9 ]/gi, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !stop.has(w))
  );
}

function similarity(a: string, b: string) {
  const wa = words(a);
  const wb = words(b);
  if (!wa.size || !wb.size) return 0;
  let overlap = 0;
  for (const word of wa) if (wb.has(word)) overlap++;
  return overlap / Math.min(wa.size, wb.size);
}

function categoryWhy(category: Category) {
  switch (category) {
    case "AI/Tech":
      return "Relevant som tidligt signal om teknologi, AI eller nye digitale forretningsmodeller.";
    case "Erhverv":
      return "Relevant for dansk erhvervsliv, investeringer og nye forretningsmuligheder.";
    case "Aarhus":
      return "Relevant for udviklingen i Aarhus og det lokale erhvervs- og byliv.";
    default:
      return "Relevant som en aktuel dansk historie, der fylder i nyhedsstrømmen.";
  }
}

async function fetchFeed(category: Category, query: string) {
  const url =
    "https://news.google.com/rss/search?q=" +
    encodeURIComponent(query) +
    "&hl=da&gl=DK&ceid=DK:da";

  const response = await fetch(url, {
    next: { revalidate: 300 },
    headers: { "User-Agent": "KONTEKST-News-MVP/0.2" }
  });

  if (!response.ok) throw new Error(`Feed failed: ${response.status}`);

  const xml = await response.text();
  const parsed = parser.parse(xml);
  const items = parsed?.rss?.channel?.item;
  const list: RawItem[] = Array.isArray(items) ? items : items ? [items] : [];

  return list.slice(0, 12).map((item, index) => ({
    category,
    title: stripHtml(item.title || "Ukendt historie"),
    link: item.link || url,
    pubDate: item.pubDate,
    description: stripHtml(item.description || ""),
    source: sourceName(item.source),
    id: `${category}-${index}-${item.link || item.title || index}`
  }));
}

export async function getLiveStories(): Promise<Story[]> {
  const results = await Promise.allSettled(
    feeds.map((feed) => fetchFeed(feed.category, feed.query))
  );

  const all = results
    .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
    .sort((a, b) => {
      const ad = new Date(a.pubDate || 0).getTime();
      const bd = new Date(b.pubDate || 0).getTime();
      return bd - ad;
    });

  const clusters: typeof all[] = [];
  for (const item of all) {
    const match = clusters.find(
      (cluster) =>
        cluster[0]?.category === item.category &&
        similarity(cluster[0].title, item.title) >= 0.58
    );
    if (match) match.push(item);
    else clusters.push([item]);
  }

  return clusters.slice(0, 18).map((cluster, index) => {
    const lead = cluster[0];
    const uniqueSources = Array.from(
      new Map(cluster.map((item) => [item.source, item])).values()
    ).slice(0, 4);

    const hasCrossCheck = uniqueSources.length >= 2;
    const summary =
      lead.description && lead.description.length > 70
        ? lead.description.slice(0, 310).replace(/\s+\S*$/, "") + "…"
        : `Historien er aktuelt omtalt af ${lead.source}. Åbn kilden for den fulde artikel og detaljerne.`;

    return {
      id: `live-${index}-${lead.id}`,
      category: lead.category,
      title: lead.title,
      sourceLabel: hasCrossCheck
        ? `${uniqueSources.length} kilder`
        : lead.source,
      published: timeAgo(lead.pubDate),
      summary,
      why: categoryWhy(lead.category),
      verification: hasCrossCheck ? "nuance" : "unverified",
      verificationText: hasCrossCheck
        ? `Foreløbigt kildekrydstjek: ${uniqueSources.length} forskellige medier omtaler en meget lignende historie. Det bekræfter, at historien er bredt rapporteret, men er endnu ikke en fuld faktaverifikation af alle centrale påstande.`
        : "Historien kommer foreløbigt fra én registreret mediekilde. KONTEKST markerer den derfor ikke som bekræftet, før flere uafhængige kilder eller en primærkilde er koblet på.",
      sources: uniqueSources.map((item) => ({
        label: item.source,
        url: item.link
      }))
    } satisfies Story;
  });
}

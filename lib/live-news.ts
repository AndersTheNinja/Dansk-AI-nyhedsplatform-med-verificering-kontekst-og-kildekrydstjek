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

type NewsItem = {
  category: Category;
  title: string;
  link: string;
  pubDate?: string;
  description: string;
  source: string;
  id: string;
};

const feeds: { category: Category; query: string }[] = [
  { category: "Danmark", query: "Danmark nyheder -sport" },
  { category: "Erhverv", query: "dansk erhverv virksomheder startup investering -sport" },
  { category: "AI/Tech", query: "AI kunstig intelligens teknologi Danmark virksomheder" },
  { category: "Aarhus", query: "Aarhus kommune erhverv byudvikling kultur ejendom trafik -sport" }
];

const parser = new XMLParser({
  ignoreAttributes: false,
  processEntities: true,
  trimValues: true
});

const trustedSources: Record<string, number> = {
  "DR": 14,
  "TV 2": 14,
  "Ritzau": 14,
  "Børsen": 13,
  "Finans": 12,
  "Berlingske": 11,
  "Politiken": 11,
  "Jyllands-Posten": 11,
  "Jyllands-posten": 11,
  "Altinget": 11,
  "Version2": 10,
  "Ingeniøren": 10,
  "Computerworld": 9,
  "TechSavvy": 8,
  "Aarhus Stiftstidende": 11,
  "Stiften": 11,
  "Aarhus Kommune": 14,
  "Erhvervsstyrelsen": 14,
  "Finansministeriet": 14,
  "Danmarks Statistik": 14,
  "Folketinget": 14,
  "Nationalbanken": 14
};

const danishSourcePatterns = [
  /^DR$/i,
  /^TV 2$/i,
  /TV2/i,
  /Ritzau/i,
  /Børsen/i,
  /Finans(?!avisen)/i,
  /FinansWatch/i,
  /Berlingske/i,
  /Politiken/i,
  /Jyllands-Posten/i,
  /Jyllands-posten/i,
  /JP\.dk/i,
  /Altinget/i,
  /Version2/i,
  /Ingeniøren/i,
  /Computerworld/i,
  /TechSavvy/i,
  /Aarhus Stiftstidende/i,
  /Stiften/i,
  /TV2 Østjylland/i,
  /TV 2 Østjylland/i,
  /DK Nyt/i,
  /dknyt/i,
  /Kommunen\.dk/i,
  /Aarhus Kommune/i,
  /Erhvervsstyrelsen/i,
  /Finansministeriet/i,
  /Danmarks Statistik/i,
  /Folketinget/i,
  /Nationalbanken/i
];

const foreignSourcePatterns = [
  /Finansavisen/i,
  /Vietnam\.vn/i,
  /VG\b/i,
  /Aftenposten/i,
  /Dagbladet/i,
  /Nettavisen/i,
  /NRK/i,
  /E24/i,
  /Dagens Næringsliv/i,
  /Svenska Dagbladet/i,
  /Aftonbladet/i,
  /Expressen/i
];

function isLikelyDanish(item: NewsItem) {
  if (foreignSourcePatterns.some((pattern) => pattern.test(item.source))) return false;
  if (danishSourcePatterns.some((pattern) => pattern.test(item.source))) return true;

  // Google News-feedet er allerede låst til dansk sprog/region (da-DK).
  // Ukendte kilder får derfor lov at passere, medmindre de matcher en kendt udenlandsk kilde.
  return true;
}

function isFresh(pubDate?: string) {
  if (!pubDate) return false;
  const time = new Date(pubDate).getTime();
  if (Number.isNaN(time)) return false;
  const ageHours = (Date.now() - time) / 3600000;
  return ageHours >= -1 && ageHours <= 56;
}

const lowValueSourcePatterns = [
  /fotmob/i,
  /flashscore/i,
  /livescore/i,
  /bold\.dk/i,
  /tipsbladet/i,
  /transfermarkt/i,
  /odds/i,
  /resultat/i,
  /statistik.*division/i
];

const lowValueTitlePatterns = [
  /statistik for/i,
  /blokeringer per 90/i,
  /opstilling/i,
  /startopstilling/i,
  /odds/i,
  /live score/i,
  /kampreferat/i
];

const categorySignals: Record<Category, RegExp[]> = {
  Danmark: [
    /regering|folketing|lovforslag|minister|kommune|skat|økonomi|sundhed|uddannelse|bolig|energi|infrastruktur|politi|domstol|forsvar/i
  ],
  Erhverv: [
    /virksomhed|milliard|million|investering|opkøb|fusion|regnskab|omsætning|overskud|underskud|startup|iværksætter|aktie|børs|arbejdsplads|fabrik|produktion/i
  ],
  "AI/Tech": [
    /\bAI\b|kunstig intelligens|chatgpt|openai|anthropic|nvidia|microsoft|google|apple|robot|software|chip|teknologi|cyber|digital|startup/i
  ],
  Aarhus: [
    /aarhus|århus|midtbyen|havnen|letbane|kommune|byråd|byudvikling|bolig|ejendom|erhverv|kultur|trafik|universitet|skejby/i
  ]
};

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

function sourceScore(source: string) {
  for (const [name, score] of Object.entries(trustedSources)) {
    if (source.toLowerCase().includes(name.toLowerCase())) return score;
  }
  return 3;
}

function recencyScore(pubDate?: string) {
  if (!pubDate) return 0;
  const ageHours = Math.max(0, (Date.now() - new Date(pubDate).getTime()) / 3600000);
  if (ageHours <= 2) return 16;
  if (ageHours <= 6) return 13;
  if (ageHours <= 12) return 10;
  if (ageHours <= 24) return 7;
  if (ageHours <= 48) return 3;
  return 0;
}

function relevanceScore(item: NewsItem) {
  const text = `${item.title} ${item.description}`;
  let score = sourceScore(item.source) + recencyScore(item.pubDate);

  for (const pattern of categorySignals[item.category]) {
    if (pattern.test(text)) score += 7;
  }

  if (item.description.length > 100) score += 2;
  if (item.title.length >= 28 && item.title.length <= 120) score += 2;

  if (item.category === "Aarhus" && /aarhus|århus/i.test(text)) score += 8;
  if (item.category === "Erhverv" && /regnskab|investering|opkøb|fusion|milliard|million|startup|virksomhed/i.test(text)) score += 6;
  if (item.category === "AI/Tech" && /\bAI\b|kunstig intelligens|openai|anthropic|nvidia|chatgpt/i.test(text)) score += 6;

  if (lowValueSourcePatterns.some((pattern) => pattern.test(item.source))) score -= 30;
  if (lowValueTitlePatterns.some((pattern) => pattern.test(item.title))) score -= 30;

  return score;
}

function categoryWhy(category: Category) {
  switch (category) {
    case "AI/Tech":
      return "Udvalgt som et stærkt aktuelt signal om AI, teknologi eller nye digitale forretningsmodeller.";
    case "Erhverv":
      return "Udvalgt for sin relevans for dansk erhvervsliv, investeringer eller nye forretningsmuligheder.";
    case "Aarhus":
      return "Udvalgt for sin betydning for Aarhus, byudvikling, erhverv eller lokale beslutninger.";
    default:
      return "Udvalgt som en væsentlig aktuel dansk historie med højere relevans end den øvrige nyhedsstrøm.";
  }
}

async function fetchFeed(category: Category, query: string) {
  const url =
    "https://news.google.com/rss/search?q=" +
    encodeURIComponent(query) +
    "&hl=da&gl=DK&ceid=DK:da";

  const response = await fetch(url, {
    next: { revalidate: 300 },
    headers: { "User-Agent": "KONTEKST-News-MVP/0.3" }
  });

  if (!response.ok) throw new Error(`Feed failed: ${response.status}`);

  const xml = await response.text();
  const parsed = parser.parse(xml);
  const items = parsed?.rss?.channel?.item;
  const list: RawItem[] = Array.isArray(items) ? items : items ? [items] : [];

  return list.slice(0, 30).map((item, index): NewsItem => ({
    category,
    title: stripHtml(item.title || "Ukendt historie"),
    link: item.link || url,
    pubDate: item.pubDate,
    description: stripHtml(item.description || ""),
    source: sourceName(item.source),
    id: `${category}-${index}-${item.link || item.title || index}`
  }));
}

function selectBalanced<T extends { category: Category; score: number }>(items: T[]) {
  const quotas: Record<Category, number> = {
    Danmark: 5,
    Erhverv: 5,
    "AI/Tech": 5,
    Aarhus: 5
  };

  const selected: T[] = [];
  const used = new Set<T>();

  for (const category of Object.keys(quotas) as Category[]) {
    const categoryItems = items
      .filter((item) => item.category === category)
      .sort((a, b) => b.score - a.score)
      .slice(0, quotas[category]);

    for (const item of categoryItems) {
      selected.push(item);
      used.add(item);
    }
  }

  if (selected.length < 20) {
    const extras = items
      .filter((item) => !used.has(item))
      .sort((a, b) => b.score - a.score)
      .slice(0, 20 - selected.length);
    selected.push(...extras);
  }

  return selected.sort((a, b) => b.score - a.score).slice(0, 20);
}

export async function getLiveStories(): Promise<Story[]> {
  const results = await Promise.allSettled(
    feeds.map((feed) => fetchFeed(feed.category, feed.query))
  );

  const fetched = results
    .flatMap((result) => (result.status === "fulfilled" ? result.value : []));

  const strict = fetched
    .filter((item) => isLikelyDanish(item))
    .filter((item) => isFresh(item.pubDate))
    .filter((item) => relevanceScore(item) > 4);

  // Robust fallback: hvis det stramme filter mod forventning giver 0 historier,
  // vises stadig friske da-DK-resultater, dog med kendte udenlandske kilder blokeret.
  const all = (strict.length ? strict : fetched
    .filter((item) => !foreignSourcePatterns.some((pattern) => pattern.test(item.source)))
    .filter((item) => isFresh(item.pubDate)))
    .sort((a, b) => relevanceScore(b) - relevanceScore(a));

  const clusters: NewsItem[][] = [];
  for (const item of all) {
    const match = clusters.find(
      (cluster) =>
        cluster[0]?.category === item.category &&
        similarity(cluster[0].title, item.title) >= 0.52
    );
    if (match) match.push(item);
    else clusters.push([item]);
  }

  const ranked = clusters.map((cluster) => {
    const uniqueSources = Array.from(
      new Map(cluster.map((item) => [item.source, item])).values()
    ).slice(0, 5);

    const lead = [...cluster].sort(
      (a, b) => relevanceScore(b) - relevanceScore(a)
    )[0];

    const crossCheckBonus = Math.min(15, (uniqueSources.length - 1) * 5);
    return {
      cluster,
      lead,
      uniqueSources,
      category: lead.category,
      score: relevanceScore(lead) + crossCheckBonus
    };
  });

  const selected = selectBalanced(ranked);

  return selected.map((entry, index) => {
    const { lead, uniqueSources } = entry;
    const hasCrossCheck = uniqueSources.length >= 2;
    const summary =
      lead.description && lead.description.length > 70
        ? lead.description.slice(0, 340).replace(/\s+\S*$/, "") + "…"
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
        ? `KONTEKST har fundet ${uniqueSources.length} forskellige mediekilder med meget lignende omtale. Det er et stærkere signal end én kilde, men ikke i sig selv en fuld faktaverifikation af alle centrale påstande.`
        : "Historien er foreløbigt kun fundet hos én registreret kilde. Den markeres derfor ikke som bekræftet, før flere uafhængige kilder eller en primærkilde er koblet på.",
      sources: uniqueSources.map((item) => ({
        label: item.source,
        url: item.link
      }))
    } satisfies Story;
  });
}

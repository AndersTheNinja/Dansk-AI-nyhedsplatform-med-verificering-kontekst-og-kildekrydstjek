import { XMLParser } from "fast-xml-parser";
import type { Story } from "@/lib/stories";

type Category = Story["category"];

type FeedConfig = {
  name: string;
  url: string;
  category: Category;
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

const feeds: FeedConfig[] = [
  {
    name: "DR Nyheder",
    url: "https://www.dr.dk/nyheder/service/feeds/allenyheder",
    category: "Danmark"
  },
  {
    name: "DR Indland",
    url: "https://www.dr.dk/nyheder/service/feeds/indland",
    category: "Danmark"
  },
  {
    name: "DR Penge",
    url: "https://www.dr.dk/nyheder/service/feeds/penge",
    category: "Erhverv"
  },
  {
    name: "DR Østjylland",
    url: "https://www.dr.dk/Nyheder/Service/feeds/regionale/oestjylland/",
    category: "Aarhus"
  },
  {
    name: "Politiken",
    url: "https://politiken.dk/rss/senestenyt.rss",
    category: "Danmark"
  },
  {
    name: "Version2",
    url: "https://www.version2.dk/feeds/nyheder",
    category: "AI/Tech"
  },
  {
    name: "Ingeniøren",
    url: "https://www.ing.dk/rss",
    category: "AI/Tech"
  }
];

const parser = new XMLParser({
  ignoreAttributes: false,
  processEntities: true,
  trimValues: true
});

function stripHtml(value = "") {
  return String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function textValue(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return textValue(obj["#text"] ?? obj["@_href"] ?? obj["href"] ?? "");
  }
  return "";
}

function linkValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const alternate = value.find((item) => {
      if (!item || typeof item !== "object") return false;
      const rel = String((item as Record<string, unknown>)["@_rel"] ?? "");
      return !rel || rel === "alternate";
    });
    return linkValue(alternate ?? value[0]);
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return String(obj["@_href"] ?? obj["href"] ?? obj["#text"] ?? "");
  }
  return "";
}

function publishedValue(item: Record<string, unknown>): string | undefined {
  const raw =
    item.pubDate ??
    item.published ??
    item.updated ??
    item["dc:date"] ??
    item.date;
  const value = textValue(raw);
  return value || undefined;
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

function isFresh(pubDate?: string, category?: Category) {
  if (!pubDate) return true;
  const time = new Date(pubDate).getTime();
  if (Number.isNaN(time)) return true;
  const ageHours = (Date.now() - time) / 3600000;
  const maxHours = category === "Aarhus" ? 168 : 72;
  return ageHours >= -2 && ageHours <= maxHours;
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

const loadedWords = [
  "chokerende","skandaløs","skandale","katastrofal","katastrofe","fantastisk","fremragende",
  "forfærdelig","voldsom","ekstrem","sensationel","opsigtsvækkende","rasende","raseri",
  "fiasko","sejr","triumf","knusende","uhørt","vanvittig","brutal","dramatisk","massiv",
  "farlig","genial","elendige","elendigt","historisk","bombe","kaos","krise","mirakel",
  "afslører","smadrer","slagter","hylder","angriber","advarer","dødelig","dødelige",
  "alvorlig","alvorlige","vild","vilde","giftig","giftige","raser","kritiserer","kritik",
  "presser","truer","truet","frygt","frygter","succes","rekord","rekordstor","udsat",
  "heftig","heftigt","kontroversiel","kontroversielle","mystisk","mystiske"
];

const absolutistWords = [
  "altid","aldrig","alle","ingen","helt sikkert","uden tvivl","beviser","åbenlyst","klart"
];

function scoreWordingNeutrality(text: string) {
  const normalized = text.toLowerCase();
  const wordsInText = normalized.split(/\s+/).filter(Boolean);
  const loadedMatches = loadedWords.filter((word) => normalized.includes(word));
  const absoluteMatches = absolutistWords.filter((word) => normalized.includes(word));
  const loadedHits = loadedMatches.length;
  const absoluteHits = absoluteMatches.length;
  const exclamations = (text.match(/!/g) || []).length;
  const questionMarks = (text.match(/\?/g) || []).length;
  const quoteMarks = (text.match(/['"“”‘’]/g) || []).length;
  const colonHeadlines = text.includes(":") ? 1 : 0;
  const densityPenalty = wordsInText.length
    ? Math.min(48, Math.round((loadedHits / wordsInText.length) * 520))
    : 0;
  const rhetoricPenalty = Math.min(10, questionMarks * 2 + Math.floor(quoteMarks / 2) + colonHeadlines);
  const score = Math.max(35, Math.min(100, 100 - densityPenalty - absoluteHits * 5 - exclamations * 4 - rhetoricPenalty));

  const examples: string[] = [];
  if (loadedMatches.length) examples.push(`Ladede ord: ${loadedMatches.slice(0, 6).join(", ")}`);
  if (absoluteMatches.length) examples.push(`Absolutte ord: ${absoluteMatches.slice(0, 5).join(", ")}`);
  if (exclamations) examples.push(`Udråbstegn: ${exclamations}`);
  if (questionMarks) examples.push(`Spørgsmålstegn: ${questionMarks}`);
  if (quoteMarks >= 2) examples.push("Citat-/anførselstegn påvirker retorikscoren svagt");
  if (colonHeadlines) examples.push("Kolon i overskrift/feedtekst påvirker retorikscoren svagt");

  const note = loadedHits === 0 && absoluteHits === 0 && exclamations === 0 && questionMarks === 0
    ? "Sproget fremstår overvejende neutralt i den tekst, som feedet stiller til rådighed."
    : "Scoren er beregnet ud fra konkrete sproglige markører i overskrift og feedtekst.";

  return { score, note, examples };
}

function scoreSourceNeutrality(lead: NewsItem, sources: NewsItem[]) {
  if (sources.length < 2) {
    return {
      score: null,
      note: "Ikke nok data: kun én kilde er fundet, så vinklen kan ikke krydstjekkes pålideligt.",
      examples: [`Fundet kilde: ${lead.source}`]
    };
  }

  const similarities = sources
    .filter((source) => source.id !== lead.id)
    .map((source) => similarity(lead.title, source.title));

  const average = similarities.length
    ? similarities.reduce((sum, value) => sum + value, 0) / similarities.length
    : 0.5;

  const score = Math.max(45, Math.min(98, Math.round(58 + average * 40 + Math.min(8, (sources.length - 2) * 4))));
  const comparisonExamples = sources
    .filter((source) => source.id !== lead.id)
    .slice(0, 3)
    .map((source) => `${source.source}: “${source.title.slice(0, 105)}${source.title.length > 105 ? "…" : ""}”`);

  return {
    score,
    note: `Vurderet ud fra ${sources.length} kilder og hvor ens deres centrale framing/overskrifter er. Høj score betyder større overensstemmelse, ikke nødvendigvis fuld sandhed.`,
    examples: comparisonExamples
  };
}

function categoryWhy(category: Category) {
  switch (category) {
    case "AI/Tech":
      return "Aktuel dansk teknologi- eller AI-historie fra en redaktionel kilde.";
    case "Erhverv":
      return "Aktuel erhvervshistorie med relevans for danske virksomheder og økonomi.";
    case "Aarhus":
      return "Aktuel historie fra Østjylland med lokal relevans for Aarhus-området.";
    default:
      return "Aktuel dansk nyhed fra en redaktionel kilde.";
  }
}

async function fetchFeed(feed: FeedConfig): Promise<NewsItem[]> {
  const response = await fetch(feed.url, {
    next: { revalidate: 300 },
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; KONTEKST/0.4; +https://vercel.app)",
      Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8"
    }
  });

  if (!response.ok) {
    throw new Error(`${feed.name} returned ${response.status}`);
  }

  const xml = await response.text();
  const parsed = parser.parse(xml);

  const rssItems = parsed?.rss?.channel?.item;
  const atomItems = parsed?.feed?.entry;
  const rawItems = rssItems ?? atomItems ?? [];
  const items = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];

  return items.slice(0, 25).map((raw: unknown, index: number) => {
    const item = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const title = stripHtml(textValue(item.title) || "Ukendt historie");
    const link = linkValue(item.link) || feed.url;
    const description = stripHtml(
      textValue(item.description ?? item.summary ?? item.content ?? "")
    );
    const pubDate = publishedValue(item);

    return {
      category: feed.category,
      title,
      link,
      pubDate,
      description,
      source: feed.name,
      id: `${feed.name}-${index}-${link || title}`
    };
  }).filter((item: NewsItem) => item.title && item.link);
}

export async function getLiveStories(): Promise<Story[]> {
  const results = await Promise.allSettled(feeds.map(fetchFeed));

  const fetched = results
    .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
    .filter((item) => isFresh(item.pubDate, item.category));

  if (!fetched.length) return [];

  const clusters: NewsItem[][] = [];
  for (const item of fetched) {
    const match = clusters.find(
      (cluster) =>
        cluster[0]?.category === item.category &&
        similarity(cluster[0].title, item.title) >= 0.56
    );
    if (match) match.push(item);
    else clusters.push([item]);
  }

  const ranked = clusters
    .map((cluster) => {
      const lead = cluster[0];
      const sources = Array.from(
        new Map(cluster.map((item) => [item.source, item])).values()
      );
      const age = lead.pubDate ? new Date(lead.pubDate).getTime() : 0;
      return { lead, sources, age };
    })
    .sort((a, b) => b.age - a.age);

  const quotas: Record<Category, number> = {
    Danmark: 6,
    Erhverv: 4,
    "AI/Tech": 5,
    Aarhus: 5
  };

  const selected = ranked
    .filter((entry) => {
      if (quotas[entry.lead.category] <= 0) return false;
      quotas[entry.lead.category]--;
      return true;
    })
    .slice(0, 20);

  return selected.map((entry, index) => {
    const { lead, sources } = entry;
    const hasCrossCheck = sources.length >= 2;
    const wordingNeutrality = scoreWordingNeutrality(`${lead.title} ${lead.description}`);
    const sourceNeutrality = scoreSourceNeutrality(lead, sources);
    const summary =
      lead.description.length > 70
        ? lead.description.slice(0, 300).replace(/\s+\S*$/, "") + "…"
        : `Historien er publiceret af ${lead.source}. Åbn originalkilden for detaljerne.`;

    return {
      id: `live-${index}-${lead.id}`,
      category: lead.category,
      title: lead.title,
      sourceLabel: hasCrossCheck ? `${sources.length} kilder` : lead.source,
      published: timeAgo(lead.pubDate),
      summary,
      why: categoryWhy(lead.category),
      verification: hasCrossCheck ? "nuance" : "unverified",
      verificationText: hasCrossCheck
        ? `KONTEKST har fundet samme historie hos ${sources.length} forskellige kilder. Det er et kildekrydstjek, men ikke en fuld faktaverifikation.`
        : "Historien er foreløbigt kun fundet hos én kilde og markeres derfor ikke som fuldt verificeret.",
      neutrality: {
        wording: wordingNeutrality.score,
        wordingNote: wordingNeutrality.note,
        wordingExamples: wordingNeutrality.examples,
        sources: sourceNeutrality.score,
        sourcesNote: sourceNeutrality.note,
        sourcesExamples: sourceNeutrality.examples
      },
      sources: sources.slice(0, 4).map((item) => ({
        label: item.source,
        url: item.link
      }))
    } satisfies Story;
  });
}

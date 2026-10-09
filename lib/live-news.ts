import { XMLParser } from "fast-xml-parser";
import type { Story } from "@/lib/stories";
import { persistStories } from "@/lib/news-store";

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
  method: "RSS" | "WEB";
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
  },
  {
    name: "Computerworld",
    url: "https://www.computerworld.dk/rss/all",
    category: "AI/Tech"
  },
  {
    name: "TechSavvy",
    url: "https://techsavvy.media/feed",
    category: "AI/Tech"
  },
  {
    name: "Altinget",
    url: "https://www.altinget.dk/christiansborg/rss.aspx",
    category: "Danmark"
  },
  {
    name: "Nordjyske",
    url: "https://nordjyske.dk/rss/nyheder",
    category: "Danmark"
  },
  {
    name: "Fyens Stiftstidende",
    url: "https://fyens.dk/feed/danmark",
    category: "Danmark"
  },
  {
    name: "JydskeVestkysten",
    url: "https://jv.dk/feed/danmark",
    category: "Danmark"
  },
  {
    name: "Horsens Folkeblad",
    url: "https://hsfo.dk/feed/danmark",
    category: "Danmark"
  },
  {
    name: "Fredericia Dagblad",
    url: "https://frdb.dk/feed/danmark",
    category: "Danmark"
  },
  {
    name: "Journalisten",
    url: "https://journalisten.dk/feed/",
    category: "Erhverv"
  },
  {
    name: "Berlingske",
    url: "https://www.berlingske.dk/content/rss",
    category: "Danmark"
  },
  {
    name: "Stiften.dk",
    url: "https://stiften.dk/feed/forside",
    category: "Aarhus"
  },
  {
    name: "Stiften.dk",
    url: "https://stiften.dk/feed/erhverv",
    category: "Erhverv"
  },
  {
    name: "MigogAarhus",
    url: "https://migogaarhus.dk/feed/",
    category: "Aarhus"
  },
  {
    name: "TV2.dk",
    url: "https://feeds.tv2.dk/nyhederne_seneste/rss",
    category: "Danmark"
  },
  {
    name: "TV2.dk",
    url: "https://tv2.dk/rss/seneste.xml",
    category: "Danmark"
  },
  {
    name: "DR Udland",
    url: "https://www.dr.dk/nyheder/service/feeds/udland",
    category: "Danmark"
  },
  {
    name: "DR Politik",
    url: "https://www.dr.dk/nyheder/service/feeds/politik",
    category: "Danmark"
  },
  {
    name: "Fyens Stiftstidende",
    url: "https://fyens.dk/feed/erhverv",
    category: "Erhverv"
  },
  {
    name: "Fyens Stiftstidende",
    url: "https://fyens.dk/feed/sport",
    category: "Danmark"
  },
  {
    name: "JydskeVestkysten",
    url: "https://jv.dk/feed/erhverv",
    category: "Erhverv"
  },
  {
    name: "JydskeVestkysten",
    url: "https://jv.dk/feed/sport",
    category: "Danmark"
  },
  {
    name: "Horsens Folkeblad",
    url: "https://hsfo.dk/feed/erhverv",
    category: "Erhverv"
  },
  {
    name: "Horsens Folkeblad",
    url: "https://hsfo.dk/feed/sport",
    category: "Danmark"
  },
  {
    name: "Fredericia Dagblad",
    url: "https://frdb.dk/feed/erhverv",
    category: "Erhverv"
  },
  {
    name: "Fredericia Dagblad",
    url: "https://frdb.dk/feed/sport",
    category: "Danmark"
  },
  {
    name: "Stiften.dk",
    url: "https://stiften.dk/feed/aarhus",
    category: "Aarhus"
  },
  {
    name: "Stiften.dk",
    url: "https://stiften.dk/feed/sport",
    category: "Aarhus"
  },
  {
    name: "Nordjyske",
    url: "https://nordjyske.dk/rss/erhverv",
    category: "Erhverv"
  }
];

const hiddenPublishers = new Set([
  "JydskeVestkysten",
  "Horsens Folkeblad",
  "Fredericia Dagblad",
  "Nordjyske",
  "Fyens Stiftstidende"
]);

function isVisiblePublisher(source: string) {
  return !hiddenPublishers.has(source);
}

const parser = new XMLParser({
  ignoreAttributes: false,
  processEntities: true,
  trimValues: true
});

function decodeHtmlEntities(value: string) {
  const named: Record<string, string> = {
    amp: "&",
    quot: '"',
    apos: "'",
    nbsp: " ",
    lt: "<",
    gt: ">",
    aelig: "æ",
    AElig: "Æ",
    oslash: "ø",
    Oslash: "Ø",
    aring: "å",
    Aring: "Å",
    ndash: "–",
    mdash: "—",
    rsquo: "’",
    lsquo: "‘",
    rdquo: "”",
    ldquo: "“"
  };

  let decoded = value;

  // Some WordPress feeds (notably Journalisten) contain entities escaped
  // several times, e.g. &amp;amp;aelig;. Decode until stable, with a safe cap.
  for (let pass = 0; pass < 5; pass++) {
    const previous = decoded;
    decoded = decoded
      .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
        String.fromCodePoint(parseInt(hex, 16))
      )
      .replace(/&#(\d+);/g, (_, num: string) =>
        String.fromCodePoint(parseInt(num, 10))
      )
      .replace(/&([a-z]+);/gi, (match, name: string) =>
        named[name.toLowerCase()] ?? match
      );
    if (decoded === previous) break;
  }

  return decoded;
}

function stripHtml(value = "") {
  return decodeHtmlEntities(String(value))
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\[(?:caption|gallery|embed|video|audio|playlist)[^\]]*\]/gi, " ")
    .replace(/\[\/(?:caption|gallery|embed|video|audio|playlist)\]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function cleanPreviewText(value = "", title = "") {
  const unescaped = String(value)
    .replace(/\\u([0-9a-f]{4})/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\n|\\r|\\t/g, " ")
    .replace(/\\\//g, "/");
  let text = stripHtml(unescaped);

  const boilerplatePatterns = [
    /^(?:annonce|advertorial|sponsoreret indhold|sponsoreret)\b[:\s-]*/i,
    /^(?:læs også|se også|hør også|følg også)\b[:\s-]*/i,
    /^(?:tilmeld dig|få vores nyhedsbrev|modtag nyhedsbrev|nyhedsbrev)\b[^.!?]*(?:[.!?]|$)\s*/i,
    /^(?:du har nu adgang til|log ind for at læse|bliv abonnent|kun for abonnenter)\b[^.!?]*(?:[.!?]|$)\s*/i,
    /^du skal være abonnent for at lytte til denne automatiske oplæsning\.?\s*/i,
    /^(?:artiklen fortsætter efter annoncen|fortsætter efter annoncen)\.?\s*/i,
    /^(?:klik her|tryk her)\b[^.!?]*(?:[.!?]|$)\s*/i,
    /^dette er et debatindlæg skrevet af en eller flere eksterne skribenter\.\s*indlægget afspejler en personlig holdning\.\s*forslag til debatindlæg kan sendes til børsen opinion:\s*opinion@borsen\.dk\s*/i,
    /^med ["”']?auto["”']? skiftes der automatisk mellem lys og mørk tilstand baseret på din enheds indstillinger\.?s*/i,
    /^pro indhold med dybdegående analyser og nyhedsbreve indenfor finans og iværksætteri\.?s*/i,
    /^klik her og få adgang\s*/i
  ];

  let changed = true;
  while (changed && text) {
    changed = false;
    for (const pattern of boilerplatePatterns) {
      const next = text.replace(pattern, "").trim();
      if (next !== text) {
        text = next;
        changed = true;
      }
    }
  }

  // Remove recurring publisher boilerplate wherever it appears, without deleting
  // the actual article sentence that follows it.
  text = text
    .replace(/pro indhold med dybdegående analyser og nyhedsbreve indenfor finans og iværksætteri\.?\s*/gi, "")
    .replace(/klik her og få adgang\s*/gi, "")
    .replace(/du skal være abonnent for at lytte til denne automatiske oplæsning\.?\s*/gi, "")
    .replace(/som abonnent kan du ubegrænset dele artikler med dine venner og familie\.\s*læs mere om fordelene ved et abonnement her\s*\.?\s*/gi, "")
    .replace(/\s*læs mere og bliv(?: abonnent)?\.?\s*$/gi, "")
    .replace(/\s*bliv abonnent for at læse videre\.?\s*$/gi, "")
    .replace(/med ["”']?auto["”']? skiftes der automatisk mellem lys og mørk tilstand baseret på din enheds indstillinger\.?s*/gi, "")
    .replace(/\s*the post\b[\s\S]*?appeared first on\b[\s\S]*$/i, "")
    .replace(/\s*(?:læs|se) hele artiklen hos\b[\s\S]*$/i, "")
    .trim();

  // Cut off subscription/marketing copy once the editorial teaser has ended.
  const marketingStarts = [
    /\s+opret et gratis prøveabonnement\b/i,
    /\s+opret et prøveabonnement\b/i,
    /\s+få adgang til alt premium[- ]indhold\b/i,
    /\s+prøv premium gratis\b/i,
    /\s+uden binding eller kreditkort\b/i,
    /\s+det er gratis at oprette\b/i,
    /\s+tilmeld dig gratis\b/i,
    /\s+få fri adgang\b/i,
    /\s+abonnér(?: nu)?\b/i,
    /(?:^|\s+)du kan modtage notifikationer\b/i,
    /(?:^|\s+)opret et personligt gavelink\b/i,
    /(?:^|\s+)log ind for at følge\b/i,
    /(?:^|\s+)du er godt i gang\b/i,
    /(?:^|\s+)få adgang til hele artiklen\b/i,
    /(?:^|\s+)dagens e-avis\b/i,
    /(?:^|\s+)børneavisen\b/i,
    /(?:^|\s+)politiken fylder \d+ år\b/i,
    /(?:^|\s+)abonnementet giver adgang til nordjyske\.dk\b/i,
    /(?:^|\s+)vi har opdateret vore vilkår\b/i,
    /(?:^|\s+)det er gratis at oprette et intro-abonnement\b/i,
    /(?:^|\s+)ubegrænset adgang til alt premium-indhold\b/i,
    /(?:^|\s+)vi sender et link til dig\b/i,
    /(?:^|\s+)mit navn er\b/i,
    /(?:^|\s+)jeg er \d{1,3} år gammel\b/i,
    /(?:^|\s+)siden \d{4} har jeg været en del af redaktionen hos migogaarhus\b/i,
    /(?:^|\s+)har du et godt tip til noget, vi skal smage, opleve eller fortælle om\b/i,
    /(?:^|\s+)mister trump grebet om usa\?/i,
    /(?:^|\s+)kom med til valgfest\b/i
  ];

  let cutAt = text.length;
  for (const pattern of marketingStarts) {
    const match = pattern.exec(text);
    if (match && match.index < cutAt) cutAt = match.index;
  }
  if (cutAt < text.length) text = text.slice(0, cutAt).trim();

  if (title) {
    const normalizedTitle = stripHtml(title).trim();
    if (normalizedTitle && text.toLowerCase().startsWith(normalizedTitle.toLowerCase())) {
      text = text.slice(normalizedTitle.length).replace(/^\s*[-–—:|]\s*/, "").trim();
    }
  }

  return text.replace(/\s+/g, " ").trim();
}

function isBoilerplatePreview(value: string) {
  const text = value.toLowerCase();
  if (!text.trim()) return true;

  const junkSignals = [
    "du kan modtage notifikationer",
    "opret et personligt gavelink",
    "log ind for at følge",
    "du er godt i gang",
    "få adgang til hele artiklen",
    "dagens e-avis",
    "børneavisen",
    "abonnementet giver adgang til nordjyske.dk",
    "det er gratis at oprette et intro-abonnement",
    "ubegrænset adgang til alt premium-indhold",
    "vi sender et link til dig",
    "bliv abonnent",
    "tilmeld dig vores nyhedsbrev",
    "mit navn er freja dumont",
    "en del af redaktionen hos migogaarhus",
    "har du et godt tip til noget, vi skal smage, opleve eller fortælle om"
  ];

  return junkSignals.some((signal) => text.includes(signal));
}

function previewQuality(value: string) {
  const text = value.trim();
  if (!text) return -1000;
  if (isBoilerplatePreview(text)) return -500;
  let score = Math.min(text.length, 600);
  if (/[.!?](?:["”’])?(?:\s|$)/.test(text)) score += 80;
  if (text.length >= 100) score += 80;
  return score;
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

function parseNewsDate(value?: string) {
  if (!value) return undefined;

  // Several Danish publishers expose an ISO-like local timestamp without any
  // timezone. Node otherwise interprets that as UTC, which shifts Danish news
  // one or two hours into the future. Treat timezone-less timestamps as
  // Europe/Copenhagen local time.
  const naive = value.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/);
  if (naive) {
    const [, ys, mos, ds, hs, mis, ss = "0"] = naive;
    const guess = Date.UTC(+ys, +mos - 1, +ds, +hs, +mis, +ss);
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Copenhagen",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    });
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date(guess)).map((part) => [part.type, part.value])
    );
    const represented = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second)
    );
    const offset = represented - guess;
    return new Date(guess - offset);
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function formatPublishedDate(pubDate?: string) {
  if (!pubDate) return undefined;
  const date = parseNewsDate(pubDate);
  if (!date) return undefined;

  const datePart = new Intl.DateTimeFormat("da-DK", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Copenhagen"
  }).format(date);

  const timePart = new Intl.DateTimeFormat("da-DK", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
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

function timeAgo(pubDate?: string) {
  if (!pubDate) return "Senest";
  const date = parseNewsDate(pubDate);
  if (!date) return "Senest";
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 60) return minutes <= 1 ? "Nu" : `${minutes} min. siden`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} t. siden`;
  const days = Math.floor(hours / 24);
  return `${days} d. siden`;
}

function isFresh(pubDate?: string) {
  if (!pubDate) return true;
  const parsed = parseNewsDate(pubDate);
  if (!parsed) return true;
  const time = parsed.getTime();
  const ageHours = (Date.now() - time) / 3600000;
  const maxHours = 21 * 24;
  return ageHours >= -2 && ageHours <= maxHours;
}

function isLiveCoverage(item: NewsItem) {
  const haystack = `${item.title} ${item.description} ${item.link}`.toLowerCase();
  return [
    "livechat",
    "live-chat",
    "live chat",
    "liveblog",
    "live-blog",
    "live blog",
    "livedækning",
    "live-dækning",
    "liveopdatering",
    "live-opdatering"
  ].some((signal) => haystack.includes(signal));
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

function sameStory(a: NewsItem, b: NewsItem) {
  const aTime = a.pubDate ? parseNewsDate(a.pubDate)?.getTime() ?? 0 : 0;
  const bTime = b.pubDate ? parseNewsDate(b.pubDate)?.getTime() ?? 0 : 0;
  if (aTime && bTime && Math.abs(aTime - bTime) > 72 * 3600000) return false;

  const titleScore = similarity(a.title, b.title);
  const descriptionScore = similarity(
    `${a.title} ${a.description.slice(0, 320)}`,
    `${b.title} ${b.description.slice(0, 320)}`
  );

  // Match across categories too: the same event may be tagged "Danmark" by one
  // outlet and "Erhverv" by another. Strong title overlap is enough; otherwise
  // require support from article descriptions.
  return titleScore >= 0.55 || (titleScore >= 0.35 && descriptionScore >= 0.45);
}

function publisherName(source: string) {
  if (/^DR\b/i.test(source)) return "Danmarks Radio";
  if (/TV\s?2/i.test(source)) return "TV2.dk";
  if (/Berlingske/i.test(source)) return "Berlingske Tidende";
  return source;
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

function scoreOriginality(lead: NewsItem, sources: NewsItem[]) {
  if (sources.length <= 1) {
    return {
      score: 100,
      note: "Historien er kun fundet hos denne ene medieudgiver i KONTEKSTs aktuelle nyhedsscan.",
      examples: ["Ingen andre matchende mediekilder fundet."]
    };
  }

  const otherSources = sources.filter((source) => source.id !== lead.id);
  const similarities = otherSources.map((source) => similarity(lead.title, source.title));
  const averageSimilarity = similarities.length
    ? similarities.reduce((sum, value) => sum + value, 0) / similarities.length
    : 0.5;

  // Flere matchende udgivere og meget ens framing sænker originalitetsscoren.
  const sourcePenalty = Math.min(75, (sources.length - 1) * 18);
  const similarityPenalty = Math.round(Math.min(20, averageSimilarity * 20));
  const score = Math.max(5, Math.min(100, 100 - sourcePenalty - similarityPenalty));

  const comparisonExamples = otherSources
    .slice(0, 4)
    .map((source) => `${source.source}: “${source.title.slice(0, 105)}${source.title.length > 105 ? "…" : ""}”`);

  return {
    score,
    note: `Historien er fundet hos ${sources.length} forskellige medieudgivere. 100 % betyder, at KONTEKST ikke har fundet samme historie andre steder; en lavere score betyder, at historien deles bredt af andre medier.`,
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
      "User-Agent": "Mozilla/5.0 (compatible; OELdk/1.0; +https://øl.dk)",
      Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8"
    },
    signal: AbortSignal.timeout(7000)
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

  return items.slice(0, 500).map((raw: unknown, index: number) => {
    const item = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const title = stripHtml(textValue(item.title) || "Ukendt historie");
    const link = linkValue(item.link) || feed.url;
    const rawDescription = cleanPreviewText(
      textValue(
        item.description ??
        item.summary ??
        item["media:description"] ??
        item["content:encoded"] ??
        item.content ??
        ""
      ),
      title
    );
    const isMigogAarhusAuthorBio =
      /^mit navn er\b/i.test(rawDescription) ||
      /en del af redaktionen hos migogaarhus/i.test(rawDescription) ||
      /har du et godt tip til noget, vi skal smage, opleve eller fortælle om/i.test(rawDescription);
    const description =
      isBoilerplatePreview(rawDescription) || isMigogAarhusAuthorBio
        ? ""
        : rawDescription;
    const pubDate = publishedValue(item);

    return {
      category: feed.category,
      title,
      link,
      pubDate,
      description,
      source: feed.name,
      method: "RSS" as const,
      id: `${feed.name}-${index}-${link || title}`
    };
  }).filter((item: NewsItem) => item.title && item.link);
}


function extractMetaContent(html: string, key: string) {
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["']`, "i")
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtmlEntities(match[1]).trim();
  }
  return "";
}

function extractPublishedDateFromHtml(html: string) {
  const meta =
    extractMetaContent(html, "article:published_time") ||
    extractMetaContent(html, "datePublished") ||
    extractMetaContent(html, "date");

  if (meta && parseNewsDate(meta)) return meta;

  const jsonLd = html.match(/"datePublished"\s*:\s*"([^"]+)"/i)?.[1];
  if (jsonLd && parseNewsDate(jsonLd)) return jsonLd;

  return undefined;
}
function extractArticleBodyFromJson(html: string) {
  const match = html.match(/"articleBody"\s*:\s*"((?:\\.|[^"\\])*)"/i);
  if (!match?.[1]) return "";

  const decoded = match[1]
    .replace(/\\u([0-9a-f]{4})/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\n|\\r|\\t/g, " ")
    .replace(/\\"/g, '"')
    .replace(/\\\//g, "/");

  return cleanPreviewText(decoded);
}

function extractMetadataPreview(html: string) {
  const meta = cleanPreviewText(
    extractMetaContent(html, "description") ||
    extractMetaContent(html, "og:description")
  );

  const jsonDescription =
    html.match(/"description"\s*:\s*"((?:\\.|[^"\\])*)"/i)?.[1] || "";
  const jsonText = cleanPreviewText(jsonDescription);

  return [meta, jsonText]
    .filter((text) => text.length >= 40)
    .sort((a, b) => b.length - a.length)[0] || "";
}

function extractPublicPreview(html: string) {
  const meta = cleanPreviewText(
    extractMetaContent(html, "description") ||
    extractMetaContent(html, "og:description")
  );

  const jsonDescription =
    html.match(/"description"\s*:\s*"((?:\\.|[^"\\])*)"/i)?.[1] || "";
  const jsonText = cleanPreviewText(
    jsonDescription
      .replace(/\\n/g, " ")
      .replace(/\\t/g, " ")
      .replace(/\\"/g, '"')
  );

  const paragraphs = Array.from(html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi))
    .map((match) => cleanPreviewText(match[1] || ""))
    .filter((text) => text.length >= 55)
    .slice(0, 5)
    .join(" ");

  return [meta, jsonText, paragraphs]
    .filter((text) => text.length >= 80)
    .sort((a, b) => b.length - a.length)[0] || "";
}

async function enrichPreview(item: NewsItem): Promise<NewsItem> {
  let hostname = "";
  try {
    hostname = new URL(item.link).hostname.toLowerCase();
  } catch {}

  // JFM pages can expose unrelated article metadata in the HTML. For Stiften
  // we now allow only structured articleBody/metadata extraction, never arbitrary
  // page paragraphs. Other JFM publishers keep the RSS teaser only.
  const isStiften = /(?:^|\.)stiften\.dk$/i.test(hostname);
  const isOtherJfmPublisher = /(?:^|\.)(?:fyens|jv|hsfo|frdb)\.dk$/i.test(hostname);
  if (isOtherJfmPublisher) return item;

  // A long teaser is only trusted if it is actually editorial text.
  if (!isStiften && item.description.length >= 340 && !isBoilerplatePreview(item.description)) return item;

  try {
    const response = await fetch(item.link, {
      next: { revalidate: 900 },
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; OELdk/1.0; +https://vercel.app)",
        Accept: "text/html,application/xhtml+xml"
      },
      signal: AbortSignal.timeout(3500)
    });

    if (!response.ok) return item;
    const html = await response.text();

    // These publishers have lots of account/navigation paragraphs in the DOM.
    // Only use explicit metadata for them, never arbitrary <p> elements.
    const isPolitiken = /(?:^|\.)politiken\.dk$/i.test(hostname);
    const metadataOnly = /(?:^|\.)(?:ing|version2|computerworld|nordjyske)\.dk$/i.test(hostname);
    const preview = isStiften
      ? (extractArticleBodyFromJson(html) || extractMetadataPreview(html))
      : isPolitiken
        ? [
            extractArticleBodyFromJson(html),
            extractMetadataPreview(html),
            extractPublicPreview(html)
          ]
            .filter((text) => text && !isBoilerplatePreview(text))
            .sort((a, b) => previewQuality(b) - previewQuality(a))[0] || ""
        : metadataOnly
          ? extractMetadataPreview(html)
          : extractPublicPreview(html);

    const normalizedPreview = isPolitiken
      ? cleanPreviewText(preview, item.title)
      : preview;
    const cleanedPreview = isBoilerplatePreview(normalizedPreview) ? "" : normalizedPreview;

    // Stiften/JFM pages occasionally expose structured text from a neighbouring
    // article. Only accept an enriched Stiften preview when it actually overlaps
    // meaningfully with the current article title; otherwise keep the RSS teaser.
    const stiftenPreviewMatchesTitle = !isStiften || (
      similarity(item.title, cleanedPreview) >= 0.2 ||
      similarity(item.description, cleanedPreview) >= 0.3
    );

    const bestDescription =
      stiftenPreviewMatchesTitle && previewQuality(cleanedPreview) > previewQuality(item.description)
        ? cleanedPreview
        : item.description;

    return {
      ...item,
      description: bestDescription,
      pubDate: extractPublishedDateFromHtml(html) || item.pubDate
    };
  } catch {
    return item;
  }
}

async function enrichTV2Item(item: NewsItem): Promise<NewsItem> {
  try {
    const response = await fetch(item.link, {
      next: { revalidate: 300 },
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; OELdk/1.0; +https://øl.dk)",
        Accept: "text/html,application/xhtml+xml"
      },
      signal: AbortSignal.timeout(7000)
    });

    if (!response.ok) return item;
    const html = await response.text();

    const jsonHeadline =
      html.match(/"headline"\s*:\s*"((?:\\.|[^"\\])*)"/i)?.[1] || "";
    const headline = cleanPreviewText(
      jsonHeadline
        .replace(/\\u([0-9a-f]{4})/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
        .replace(/\\n|\\r|\\t/g, " ")
        .replace(/\\"/g, '"')
        .replace(/\\\//g, "/")
    ) || extractMetaContent(html, "og:title") || item.title;

    const description =
      extractArticleBodyFromJson(html) ||
      extractPublicPreview(html) ||
      item.description;

    return {
      ...item,
      title: stripHtml(headline).replace(/^TV 2[:\s|-]+/i, "").trim() || item.title,
      description: cleanPreviewText(description, headline),
      pubDate: extractPublishedDateFromHtml(html) || item.pubDate
    };
  } catch {
    return item;
  }
}

async function enrichBorsenItem(item: NewsItem): Promise<NewsItem> {
  try {
    const response = await fetch(item.link, {
      next: { revalidate: 900 },
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; KONTEKST/0.6; +https://vercel.app)",
        Accept: "text/html,application/xhtml+xml"
      },
      signal: AbortSignal.timeout(6000)
    });

    if (!response.ok) return item;
    const html = await response.text();

    const description =
      extractPublicPreview(html) ||
      item.description;

    const headline = extractMetaContent(html, "og:title") || item.title;

    return {
      ...item,
      title: stripHtml(headline) || item.title,
      description: cleanPreviewText(description, headline),
      pubDate: extractPublishedDateFromHtml(html) || item.pubDate
    };
  } catch {
    return item;
  }
}

async function fetchTV2Website(): Promise<NewsItem[]> {
  const pages = [
    "https://nyheder.tv2.dk/",
    "https://tv2.dk/"
  ];

  const responses = await Promise.allSettled(
    pages.map((page) =>
      fetch(page, {
        next: { revalidate: 120 },
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; OELdk/1.0; +https://øl.dk)",
          Accept: "text/html,application/xhtml+xml"
        },
        signal: AbortSignal.timeout(7000)
      }).then(async (response) => ({
        page,
        ok: response.ok,
        html: response.ok ? await response.text() : ""
      }))
    )
  );

  const items: NewsItem[] = [];
  const seen = new Set<string>();
  const anchorPattern = /<a\b([^>]*?)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi;

  for (const result of responses) {
    if (result.status !== "fulfilled" || !result.value.ok) continue;

    const { page, html } = result.value;
    let match: RegExpExecArray | null;

    while ((match = anchorPattern.exec(html)) && items.length < 140) {
      const href = decodeHtmlEntities(match[2] || "").trim();
      const rawTitle = stripHtml(match[4] || "").replace(/\s+/g, " ").trim();

      if (rawTitle.length < 24 || rawTitle.length > 220) continue;

      let url: URL;
      try {
        url = new URL(href, page);
      } catch {
        continue;
      }

      if (!/(^|\.)tv2\.dk$/i.test(url.hostname)) continue;
      if (!/(?:^\/nyheder\/|^\/politik\/|^\/samfund\/|^\/udland\/|^\/krimi\/)/i.test(url.pathname)) continue;

      const canonical = `${url.origin}${url.pathname}`;
      if (seen.has(canonical)) continue;
      seen.add(canonical);

      items.push({
        category: "Danmark",
        title: rawTitle,
        link: canonical,
        description: "",
        source: "TV2.dk",
        method: "WEB",
        id: `TV2-web-${items.length}-${canonical}`
      });
    }
  }

  return Promise.all(items.slice(0, 100).map(enrichTV2Item));
}

async function fetchBorsenWebsite(): Promise<NewsItem[]> {
  const response = await fetch("https://borsen.dk/", {
    next: { revalidate: 300 },
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; KONTEKST/0.6; +https://vercel.app)",
      Accept: "text/html,application/xhtml+xml"
    }
  });

  if (!response.ok) {
    throw new Error(`Børsen website returned ${response.status}`);
  }

  const html = await response.text();
  const items: NewsItem[] = [];
  const seen = new Set<string>();

  const anchorPattern = /<a\b([^>]*?)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = anchorPattern.exec(html)) && items.length < 80) {
    const href = decodeHtmlEntities(match[2] || "").trim();
    const rawTitle = stripHtml(match[4] || "");

    if (rawTitle.length < 25 || rawTitle.length > 220) continue;

    let url: URL;
    try {
      url = new URL(href, "https://borsen.dk/");
    } catch {
      continue;
    }

    if (!/(^|\.)borsen\.dk$/i.test(url.hostname)) continue;
    if (!/^\/nyheder\//i.test(url.pathname)) continue;

    const canonical = `${url.origin}${url.pathname}`;
    if (seen.has(canonical)) continue;
    seen.add(canonical);

    items.push({
      category: "Erhverv",
      title: rawTitle,
      link: canonical,
      description: "",
      source: "Børsen",
      method: "WEB",
      id: `Børsen-web-${items.length}-${canonical}`
    });
  }

  return Promise.all(items.map(enrichBorsenItem));
}

export async function getLiveStories(): Promise<Story[]> {
  const results = await Promise.allSettled([
    ...feeds.map(fetchFeed),
    fetchBorsenWebsite(),
    fetchTV2Website()
  ]);

  const fetched = results
    .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
    .filter((item) => isFresh(item.pubDate))
    .filter((item) => isVisiblePublisher(item.source))
    .filter((item) => !isLiveCoverage(item));

  if (!fetched.length) return [];

  const clusters: NewsItem[][] = [];
  for (const item of fetched) {
    const match = clusters.find(
      (cluster) => cluster[0] && sameStory(cluster[0], item)
    );
    if (match) match.push(item);
    else clusters.push([item]);
  }

  const ranked = clusters
    .map((cluster) => {
      const orderedCluster = [...cluster].sort((a, b) => {
        const aTime = a.pubDate ? parseNewsDate(a.pubDate)?.getTime() ?? 0 : 0;
        const bTime = b.pubDate ? parseNewsDate(b.pubDate)?.getTime() ?? 0 : 0;
        return bTime - aTime;
      });
      const chronologicalLead = orderedCluster[0];
      const bestContent = [...orderedCluster].sort(
        (a, b) => previewQuality(b.description) - previewQuality(a.description)
      )[0];
      const lead = bestContent && previewQuality(bestContent.description) > previewQuality(chronologicalLead.description)
        ? { ...chronologicalLead, description: bestContent.description }
        : chronologicalLead;
      const sources = Array.from(
        new Map(orderedCluster.map((item) => [publisherName(item.source), item])).values()
      );
      const age = chronologicalLead?.pubDate ? parseNewsDate(chronologicalLead.pubDate)?.getTime() ?? 0 : 0;
      return { lead, sources, age };
    })
    .filter((entry) => entry.lead)
    .sort((a, b) => b.age - a.age);

  const quotas: Record<Category, number> = {
    Danmark: 700,
    Erhverv: 400,
    "AI/Tech": 250,
    Aarhus: 250
  };

  const selected = ranked
    .filter((entry) => {
      if (quotas[entry.lead.category] <= 0) return false;
      quotas[entry.lead.category]--;
      return true;
    })
    .slice(0, 1500);

  // Only fetch article pages for stories whose RSS/web teaser is too short.
  // This also works for subscriber articles because we only use public metadata/teasers.
  const enrichedSelected = await Promise.all(
    selected.map(async (entry, index) => {
      if ((entry.lead.description.length >= 340 && !isBoilerplatePreview(entry.lead.description)) || index >= 220) return entry;
      return { ...entry, lead: await enrichPreview(entry.lead) };
    })
  );

  const stories = enrichedSelected.map((entry, index) => {
    const { lead, sources } = entry;
    const hasCrossCheck = sources.length >= 2;
    const wordingNeutrality = scoreWordingNeutrality(`${lead.title} ${lead.description}`);
    const originality = scoreOriginality(lead, sources);
    const cleanDescription = isBoilerplatePreview(lead.description) ? "" : lead.description.trim();
    let summary = cleanDescription || lead.title;
    if (summary.length > 700) {
      const clipped = summary.slice(0, 700);
      const sentenceMatches = Array.from(clipped.matchAll(/[.!?](?:["”’])?(?=\s|$)/g));
      const lastSentence = sentenceMatches.at(-1);
      if (lastSentence?.index !== undefined && lastSentence.index > 180) {
        summary = clipped.slice(0, lastSentence.index + lastSentence[0].length).trim();
      } else {
        summary = clipped.replace(/\s+\S*$/, "").trim() + "…";
      }
    }

    return {
      id: `live-${index}-${lead.id}`,
      category: lead.category,
      title: lead.title,
      sourceLabel: hasCrossCheck ? `${publisherName(lead.source)} · ${sources.length} kilder` : lead.source,
      published: timeAgo(lead.pubDate),
      publishedAt: lead.pubDate,
      publishedDate: formatPublishedDate(lead.pubDate),
      sourceMethod: lead.method,
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
        sources: originality.score,
        sourcesNote: originality.note,
        sourcesExamples: originality.examples
      },
      sources: sources.slice(0, 4).map((item) => ({
        label: publisherName(item.source),
        url: item.link,
        title: item.title,
        method: item.method
      }))
    } satisfies Story;
  });

  const chronologicalStories = [...stories].sort((a, b) => {
    const aTime = parseNewsDate(a.publishedAt)?.getTime() ?? 0;
    const bTime = parseNewsDate(b.publishedAt)?.getTime() ?? 0;
    const safeA = Number.isFinite(aTime) ? aTime : 0;
    const safeB = Number.isFinite(bTime) ? bTime : 0;
    return safeB - safeA;
  });

  try {
    await persistStories(chronologicalStories);
  } catch (error) {
    console.error("Supabase news persistence failed:", error);
  }

  return chronologicalStories;
}

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
  mentions?: string[];
  imageUrl?: string;
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
    url: "https://techsavvy.media/feed/",
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
    url: "https://www.berlingske.dk/next-api/feeds/alle",
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
    name: "MigogAarhus",
    url: "https://migogaarhus.dk/feed/?paged=2",
    category: "Aarhus"
  },
  {
    name: "MigogAarhus",
    url: "https://migogaarhus.dk/feed/?paged=3",
    category: "Aarhus"
  },
  {
    name: "MigogAarhus",
    url: "https://migogaarhus.dk/feed/?paged=4",
    category: "Aarhus"
  },
  {
    name: "MigogAarhus",
    url: "https://migogaarhus.dk/feed/?paged=5",
    category: "Aarhus"
  },
  {
    name: "MigogAarhus",
    url: "https://migogaarhus.dk/feed/?paged=6",
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
// Remove image credits embedded between the photo caption and article text.
// They are metadata, not part of the editorial article body.
function removeInlinePhotoCredits(value: string) {
  const creditStart = /(?:foto|fotograf|fotocredit|photo|billedkredit)\s*:\s*(?:\/\s*)?/gi;
  const editorialStart = /\s+(?:(?:En|Et|Den|Det|Der|For|Fra|Efter|Mens|Men|Ifølge|Han|Hun|De|På|Til|I|Samtidig|Alligevel)\s+|Olfi,\s+)(?=[A-Za-zÆØÅæøå0-9»"'(])/g;
  let result = "";
  let from = 0;
  for (const match of value.matchAll(creditStart)) {
    const start = match.index;
    if (start < from) continue;
    const contentStart = start + match[0].length;
    const after = value.slice(contentStart, contentStart + 145);
    let end = value.length;
    for (const boundary of after.matchAll(editorialStart)) {
      if (boundary.index < 5) continue;
      end = contentStart + boundary.index + 1;
      break;
    }
    if (end === value.length) {
      const nextPeriod = after.match(/\.\s+(?=[A-ZÆØÅ])/);
      if (nextPeriod?.index !== undefined) end = contentStart + nextPeriod.index + 2;
    }
    result += value.slice(from, start);
    from = end;
  }
  return (result + value.slice(from)).replace(/\s+/g, " ").trim();
}

function collapseRepeatedOpening(value: string) {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length < 120) return text;

  const openingWords = text.split(/\s+/).slice(0, 9).join(" ");
  if (openingWords.length < 35) return text;
  const normalized = text.toLocaleLowerCase("da-DK");
  const second = normalized.indexOf(
    openingWords.toLocaleLowerCase("da-DK"),
    Math.max(45, openingWords.length + 5)
  );
  if (second < 0 || second > 420) return text;

  const firstBlock = text.slice(0, second).trim();
  const secondBlock = text.slice(second, second + Math.min(firstBlock.length, 260)).trim();
  if (similarity(firstBlock, secondBlock) < 0.72) return text;
  return text.slice(second).trim();
}

function cleanPreviewText(value = "", title = "") {
  const unescaped = String(value)
    .replace(/\\u([0-9a-f]{4})/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\n|\\r|\\t/g, " ")
    .replace(/\\\//g, "/");
  let text = removeInlinePhotoCredits(stripHtml(unescaped));

  const boilerplatePatterns = [
    /^(?:annonce|advertorial|sponsoreret indhold|sponsoreret)\b[:\s-]*/i,
    /^(?:læs også|se også|hør også|følg også)\b[:\s-]*/i,
    /^(?:tilmeld dig|få vores nyhedsbrev|modtag nyhedsbrev|nyhedsbrev)\b[^.!?]*(?:[.!?]|$)\s*/i,
    /^(?:du har nu adgang til|log ind for at læse|bliv abonnent|kun for abonnenter)\b[^.!?]*(?:[.!?]|$)\s*/i,
    /^du skal være abonnent for at lytte til denne automatiske oplæsning\.?\s*/i,
    /^(?:artiklen fortsætter efter annoncen|fortsætter efter annoncen)\.?\s*/i,
    /^(?:klik her|tryk her)\b[^.!?]*(?:[.!?]|$)\s*/i,
    /^dette er et debatindlæg skrevet af en eller flere eksterne skribenter\.\s*indlægget afspejler en personlig holdning\.\s*forslag til debatindlæg kan sendes til børsen opinion:\s*opinion@borsen\.dk\s*/i,
    /^tak fordi du læser med\s+danske bank og rambøll er partnere på børsen bæredygtig\.\s*derfor er alle artikler frit tilgængelige for alle læsere\.\s*danske bank og rambøll har ingen indflydelse på indhold eller redaktionelle valg på børsen bæredygtig\.\s*læs mere om partnerskab\.?\s*/i,
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
    .replace(/\((?:foto|fotograf|photo|billede|fotocredit)\s*:\s*[^)]{1,140}\)/gi, "")
    .replace(/(?:^|\s)(?:foto|fotograf|photo|billede|fotocredit)\s*:\s*(?:\/\s*)?(?:ritzau(?:\s+scanpix)?|scanpix(?:\s+denmark)?|reuters|getty images?|afp|associated press|ap|tv\s?2|dr)(?=\s|[.,;]|$)[.,;]?\s*/gi, " ")
    .replace(/(?:^|\s)(?:foto|fotograf|photo|billede|fotocredit)\s*:\s*(?:\/\s*)?[^.!?]{1,80}?\s*\/\s*(?:ritzau|scanpix|reuters|getty images?|afp|ap|tv\s?2|dr)(?=\s|[.,;]|$)[.,;]?\s*/gi, " ")
    .replace(/\b(?:foto|fotograf|photo|billede)\s*:\s*\/?\s*[^.!?]{0,100}?(?:scanpix(?: denmark)?|ritzau(?: scanpix)?|reuters|getty images?|afp|associated press|\bap\b|tv\s?2|dr)\b/gi, "")
    .replace(/tak fordi du læser med\s+danske bank og rambøll er partnere på børsen bæredygtig\.\s*derfor er alle artikler frit tilgængelige for alle læsere\.\s*danske bank og rambøll har ingen indflydelse på indhold eller redaktionelle valg på børsen bæredygtig\.\s*læs mere om partnerskab\.?\s*/gi, "")
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
    /(?:^|\s+)kom med til valgfest\b/i,
    /(?:^|\s+)som abonnent får du\b/i,
    /(?:^|\s+)lyd kan du få alt det\b/i,
    /(?:^|\s+)få ubegrænset adgang til computerworld premium\b/i,
    /(?:^|\s+)opret et gratis intro-abonnement\b/i,
    /(?:^|\s+)for at støtte den demokratiske samtale\b/i,
    /(?:^|\s+)vi vil gerne spørge om din tilladelse til at vise dig politiske reklamer\b/i,
    /(?:^|\s+)du vil altid kunne se, hvem der er afsender af reklamen\b/i,
    /(?:^|\s+)vi anvender aldrig følsomme oplysninger\b/i,
    /(?:^|\s+)se billedet af\b/i,
    /(?:^|\s+)s\s*e billedet af\b/i
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
    } else if (normalizedTitle && text) {
      const opening = text.split(/(?<=[.!?])\s+/)[0]?.trim() || "";
      const headlineWords = (value: string) => value.toLocaleLowerCase("da-DK").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
      // An editorial introduction often paraphrases the headline. Remove only
      // the same words in the same order, allowing punctuation differences.
      if (opening && headlineWords(normalizedTitle) === headlineWords(opening)) {
        text = text.slice(opening.length).replace(/^\s*[-–—:|]\s*/, "").trim();
      }
    }
  }

  text = collapseRepeatedOpening(text);
  return text.replace(/\s+/g, " ").trim();
}

function cleanPublisherTeaser(value: string, title: string, source: string) {
  if (/^TV2(?:\.dk)?\b/i.test(source)) return cleanTV2PhotoCaptions(value, title);
  let text = cleanPreviewText(value, title);
  if (/^journalisten\b/i.test(source)) {
    text = text.replace(/\s*Indlægget\s+[\s\S]*?blev først udgivet på\s+Journalisten\s*\.?\s*$/i, "").trim();
    // WordPress includes the entire article in content:encoded. Show a short
    // introduction for this publisher, ending at a sentence boundary.
    const sentences = Array.from(new Intl.Segmenter("da", { granularity: "sentence" }).segment(text), (part) => part.segment.trim());
    const excerpt: string[] = [];
    for (const sentence of sentences) {
      if (excerpt.length >= 4 || [...excerpt, sentence].join(" ").length > 750) break;
      excerpt.push(sentence);
    }
    if (excerpt.length) return excerpt.join(" ");
    if (text.length <= 750) return text;
    const prefix = text.slice(0, 747);
    return prefix.slice(0, prefix.lastIndexOf(" ")).trimEnd() + "…";
  }
  if (!/^politiken\b/i.test(source)) return text;

  // Some Politiken pages include this sequence in the public visible text:
  // intro, headline, photo credit, date, "Gem artiklen Gemt Læst", body.
  // Keep the real intro/body and discard the intervening UI and credits.
  const chrome = /\bGem artiklen\s+Gemt\s+Læst\b/i.exec(text);
  if (chrome) {
    const before = text.slice(0, chrome.index);
    let after = text.slice(chrome.index + chrome[0].length).trim();
    const titleIndex = before.toLocaleLowerCase("da-DK")
      .lastIndexOf(title.toLocaleLowerCase("da-DK"));
    if (titleIndex >= 40 && titleIndex < 450 && after.length >= 70 &&
        !/^læs videre\b/i.test(after)) {
      const intro = before.slice(0, titleIndex).trim();
      // A second navigation bar must not be appended after the story excerpt.
      const secondChrome = /\bGem artiklen\s+Gemt\s+Læst\b/i.exec(after);
      if (secondChrome && secondChrome.index > 100) {
        const prefix = after.slice(0, secondChrome.index);
        const repeatMeta = /\b(?:Danmark|Internationalt|Erhverv|Sport|Kultur|Fodbold|Bøger|Kunst|iBYEN)\s+\d{1,2}\.\s+[a-zæøå]+\s+\d{4},\s+\d{1,2}\.\d{2}\s*$/i.exec(prefix);
        after = (repeatMeta ? prefix.slice(0, repeatMeta.index) : prefix).trim();
      }
      text = [intro, after].filter(Boolean).join(" ");
    }
  }

  // The headline is already displayed separately above the teaser.
  if (title.length >= 18) {
    const at = text.toLocaleLowerCase("da-DK")
      .indexOf(title.toLocaleLowerCase("da-DK"), 40);
    if (at >= 40 && at <= 450) {
      text = (text.slice(0, at) + " " + text.slice(at + title.length)).replace(/\s+/g, " ").trim();
    }
  }
  return cleanPreviewText(text, title);
}

function cleanTV2PhotoCaptions(value: string, title: string) {
  // Remove only credits with a recognizable end marker BEFORE generic cleaning.
  // Otherwise the generic cleaner can consume the following editorial sentence.
  const withoutCredits = value
    .replace(/\bFoto:\s*[^.!?]{2,100}?\s*\/\s*(?:Ritzau Scanpix|Getty Images|Reuters)\b/gi, " ")
    .replace(/\bArkivfoto\.\s+[^.!?]{2,100}?\s*\/\s*Ritzau Scanpix\b/gi, " ");
  return cleanPreviewText(withoutCredits, title);
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
  // A two-hour tolerance made future-dated publisher items jump above actual breaking news.
  return ageHours >= -0.25 && ageHours <= maxHours;
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

async function fetchFeed(feed: FeedConfig, timeoutMs = 7000, retry = false): Promise<NewsItem[]> {
  const isBerlingske = feed.name === "Berlingske";
  const fallback = () => fetchFeed({ ...feed, url: "https://www.berlingske.dk/content/rss" }, timeoutMs, true);
  const cacheRpc = isBerlingske ? "oeldk_berlingske_rss"
    : feed.name === "TechSavvy" ? "oeldk_techsavvy_rss" : "";
  let xml = "";
  // The scheduled database collector can reach the public RSS feed when the
  // publisher rejects requests from the web host. It exposes only this fixed
  // feed, and discards responses older than 20 minutes.
  if (cacheRpc && !retry && process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY) {
    try {
      const key = process.env.SUPABASE_PUBLISHABLE_KEY;
      const cached = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/${cacheRpc}`, {
        method: "POST",
        headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: "{}",
        cache: "no-store",
        signal: AbortSignal.timeout(4000)
      });
      if (cached.ok) {
        const value = await cached.json();
        if (typeof value === "string" && value.includes("<rss ")) xml = value;
      }
    } catch {}
  }
  if (!xml) {
    let response: Response;
    try {
      response = await fetch(feed.url, {
      next: { revalidate: 300 },
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; OELdk/1.0; +https://øl.dk)",
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8"
      },
      signal: AbortSignal.timeout(isBerlingske && timeoutMs > 2200 ? 15000 : timeoutMs)
      });
    } catch (error) {
      if (isBerlingske && !retry) return fallback();
      throw error;
    }

    if (!response.ok) {
      if (isBerlingske && !retry && response.status >= 500) return fallback();
      throw new Error(`${feed.name} returned ${response.status}`);
    }

    xml = await response.text();
  }
  const parsed = parser.parse(xml);

  const rssItems = parsed?.rss?.channel?.item;
  const atomItems = parsed?.feed?.entry;
  const rawItems = rssItems ?? atomItems ?? [];
  const items = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];
  // A publisher error page can return HTTP 200. Do not accept it as an empty feed.
  if (!parsed?.rss?.channel && !parsed?.feed) {
    if (isBerlingske && !retry) return fallback();
    throw new Error(`${feed.name} did not return RSS or Atom`);
  }

  return items.slice(0, 500).map((raw: unknown, index: number) => {
    const item = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const title = stripHtml(textValue(item.title) || "Ukendt historie");
    const link = linkValue(item.link) || feed.url;
    const descriptionCandidates = [
      item.description,
      item.summary,
      item["media:description"],
      item["content:encoded"],
      item.content
    ]
      .map((value) => cleanPreviewText(textValue(value ?? ""), title))
      .filter((text) => text && !isBoilerplatePreview(text));

    const rawDescription = descriptionCandidates
      .sort((a, b) => previewQuality(b) - previewQuality(a))[0] || "";
    const isMigogAarhusAuthorBio =
      /^mit navn er\b/i.test(rawDescription) ||
      /en del af redaktionen hos migogaarhus/i.test(rawDescription) ||
      /har du et godt tip til noget, vi skal smage, opleve eller fortælle om/i.test(rawDescription);
    const description =
      isBoilerplatePreview(rawDescription) || isMigogAarhusAuthorBio
        ? ""
        : rawDescription;
    const pubDate = publishedValue(item);
    const imageUrl =
      imageUrlFromFeedValue(item["media:content"]) ||
      imageUrlFromFeedValue(item["media:thumbnail"]) ||
      imageUrlFromFeedValue(item.enclosure);

    return {
      category: feed.category,
      title,
      link,
      pubDate,
      description,
      imageUrl,
      source: feed.name,
      method: "RSS" as const,
      id: `${feed.name}:${link || title}`
    };
  }).filter((item: NewsItem) => item.title && item.link);
}


async function fetchMigogAarhusApi(): Promise<NewsItem[]> {
  const response = await fetch("https://migogaarhus.dk/wp-json/wp/v2/posts?per_page=100&_embed=1", {
    next: { revalidate: 300 },
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; OELdk/1.0; +https://øl.dk)",
      Accept: "application/json"
    },
    signal: AbortSignal.timeout(7000)
  });

  if (!response.ok) {
    throw new Error(`MigogAarhus API returned ${response.status}`);
  }

  const posts = await response.json();
  if (!Array.isArray(posts)) return [];

  return posts.map((post: any) => {
    const title = stripHtml(String(post?.title?.rendered ?? ""));
    const link = String(post?.link ?? "").trim();
    const rawText = String(
      post?.excerpt?.rendered ||
      post?.content?.rendered ||
      ""
    );
    const description = cleanPreviewText(rawText, title);
    const imageUrl = String(
      post?._embedded?.["wp:featuredmedia"]?.[0]?.source_url ||
      ""
    ).trim() || undefined;

    return {
      category: "Aarhus" as const,
      title,
      link,
      pubDate: String(post?.date ?? post?.date_gmt ?? "") || undefined,
      description: isBoilerplatePreview(description) ? "" : description,
      imageUrl,
      source: "MigogAarhus",
      method: "WEB" as const,
      id: `MigogAarhus-wp:${link || post?.id || title}`
    };
  }).filter((item: NewsItem) => item.title && item.link);
}

function extractMetaContent(html: string, key: string) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const identities = Array.from(tag.matchAll(/\b(?:property|name)\s*=\s*(["'])(.*?)\1/gi), (match) => match[2].toLowerCase());
    if (!identities.includes(key.toLowerCase())) continue;
    const content = tag.match(/\bcontent\s*=\s*(["'])([\s\S]*?)\1/i)?.[2];
    if (content) return decodeHtmlEntities(content).trim();
  }
  return "";
}

function articleTitleMatchesPage(expectedTitle: string, html: string) {
  const pageTitle =
    extractMetaContent(html, "og:title") ||
    extractMetaContent(html, "twitter:title");
  if (!pageTitle) return false;

  const expected = words(expectedTitle);
  const found = words(pageTitle);
  const overlap = [...expected].filter((word) => found.has(word)).length;
  return overlap >= Math.min(2, expected.size) &&
    overlap / Math.max(1, Math.min(expected.size, found.size)) >= 0.6;
}

function extractArticleImageUrl(html: string, expectedTitle: string) {
  if (!articleTitleMatchesPage(expectedTitle, html)) return undefined;
  return extractImageUrlFromHtml(html);
}

function extractImageUrlFromHtml(html: string) {
  const candidate =
    extractMetaContent(html, "og:image") ||
    extractMetaContent(html, "twitter:image") ||
    html.match(/"image"\s*:\s*"([^"]+)"/i)?.[1] ||
    "";
  if (!candidate) return undefined;
  try {
    const decoded = decodeHtmlEntities(candidate).replace(/\\\//g, "/").trim();
    const url = new URL(decoded);
    return /^https?:$/.test(url.protocol) ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function imageUrlFromFeedValue(value: unknown): string | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = imageUrlFromFeedValue(item);
      if (found) return found;
    }
    return undefined;
  }
  if (typeof value === "string") {
    try {
      const url = new URL(value);
      return /^https?:$/.test(url.protocol) ? url.toString() : undefined;
    } catch {
      return undefined;
    }
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const type = String(obj["@_type"] ?? obj["type"] ?? "");
    const url = String(obj["@_url"] ?? obj["url"] ?? obj["@_href"] ?? obj["href"] ?? "");
    if (url && (!type || /^image\//i.test(type))) {
      try {
        const parsed = new URL(url);
        if (/^https?:$/.test(parsed.protocol)) return parsed.toString();
      } catch {}
    }
  }
  return undefined;
}

function extractPublishedDateFromHtml(html: string, expectedTitle: string) {
  // The page may contain dates for recommended articles. Trust an explicit
  // publication meta tag; never take the first datePublished from arbitrary JSON.
  const meta =
    extractMetaContent(html, "article:published_time") ||
    extractMetaContent(html, "datePublished");
  if (meta && parseNewsDate(meta)) return meta;

  const dates = Array.from(html.matchAll(/"datePublished"\s*:\s*"([^"]+)"/gi))
    .map((match) => match[1])
    .filter((value) => Boolean(parseNewsDate(value)));
  // A single structured date is useful when tied to the same page headline.
  // Multiple dates usually indicate related stories or other page widgets.
  return dates.length === 1 && articleTitleMatchesPage(expectedTitle, html)
    ? dates[0]
    : undefined;
}

function extractArticleBodyFromJson(html: string, title = "", seed = "") {
  const bodies = Array.from(html.matchAll(/"articleBody"\s*:\s*"((?:\\.|[^"\\])*)"/gi))
    .map((match) => {
      const raw = decodeJsonString(match[1] || "");
      return {
        body: cleanPreviewText(raw, title),
        // Score the original body BEFORE removing a repeated headline:
        // the headline itself is often the strongest provenance evidence.
        match: Math.max(similarity(title, raw), seed ? similarity(seed, raw) : 0)
      };
    })
    .filter(({ body }) => body.length >= 50 && !isBoilerplatePreview(body));
  if (bodies.length === 1) return bodies[0].body;
  if (bodies.length < 2) return "";

  // When embedded data contains multiple articles, only accept a body with
  // meaningful overlap to this headline or its own RSS lead.
  const relevant = bodies.filter((candidate) => candidate.match >= 0.5);
  relevant.sort((a, b) => b.match - a.match);
  return relevant[0]?.body || "";
}

function extractMetadataPreview(html: string) {
  // A first arbitrary JSON "description" often describes a suggested story.
  // Page-level metadata is a much safer fallback for the current headline.
  const metaCandidates = [
    extractMetaContent(html, "og:description"),
    extractMetaContent(html, "description")
  ].map((value) => cleanPreviewText(value))
    .filter((value) => value.length >= 40 && !isBoilerplatePreview(value));
  if (metaCandidates.length) {
    return metaCandidates.sort((a, b) => previewQuality(b) - previewQuality(a))[0];
  }

  const jsonDescriptions = Array.from(
    html.matchAll(/"description"\s*:\s*"((?:\\.|[^"\\])*)"/gi)
  );
  return jsonDescriptions.length === 1
    ? cleanPreviewText(decodeJsonString(jsonDescriptions[0][1]))
    : "";
}

function joinEditorialParagraphs(paragraphs: string[]) {
  return paragraphs
    .map((paragraph) => {
      const text = paragraph.trim();
      if (!text) return "";
      return /[.!?…]["”’']?$/.test(text) ? text : `${text}.`;
    })
    .filter(Boolean)
    .join(" ");
}

function editorialHtml(html: string) {
  // These blocks may contain paragraphs and names from other stories.
  return html
    .replace(/<(script|style|noscript|figure|figcaption|aside|nav|header|footer)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<([a-z][\w-]*)\b[^>]*(?:class|data-testid)=["'][^"']*(?:caption|photo-credit|related-articles|related-stories)[^"']*["'][^>]*>[\s\S]*?<\/\1\s*>/gi, " ");
}

function articleMentionText(html: string, asyncHtml = "") {
  if (asyncHtml) return stripHtml(editorialHtml(asyncHtml));
  const body = extractArticleBodyFromJson(html);
  const article = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] || "";
  // Never search a whole page: navigation and related cards are not evidence
  // that the person is mentioned in the current story.
  return `${body} ${stripHtml(editorialHtml(article))}`;
}

function extractPublicPreview(html: string, title: string, seed: string) {
  // Never scrape the first paragraphs from a whole publisher page: those
  // frequently belong to navigation, recommendations or a different article.
  return [
    extractArticleBodyFromJson(html, title, seed),
    extractScopedArticlePreview(html, title, seed),
    extractEmbeddedArticlePreview(html, title, seed),
    extractMetadataPreview(html)
  ]
    .filter((text) => text.length >= 60 && !isBoilerplatePreview(text))
    .sort((a, b) => previewQuality(b) - previewQuality(a))[0] || "";
}

function extractComputerworldOverview(html: string, title: string) {
  // Computerworld renders the useful body text outside its <article> element,
  // so search the full visible HTML after removing scripts/styles.
  const plain = decodeHtmlEntities(stripHtml(
    html
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<svg\b[\s\S]*?<\/svg>/gi, " ")
  ))
    .replace(/\s+/g, " ")
    .trim();

  const marker = "det får du i artiklen";
  const start = plain.toLocaleLowerCase("da-DK").indexOf(marker);
  if (start < 0) return "";

  let excerpt = plain.slice(start + marker.length, start + marker.length + 2400).trim();

  // Prefer the actual article body that follows Computerworld's "Antal ord /
  // Læsetid" overview box. If that marker is absent, keep the overview text.
  const readingTime = excerpt.match(/\blæsetid\s+\d+\s*min\b/i);
  if (readingTime?.index !== undefined) {
    excerpt = excerpt.slice(readingTime.index + readingTime[0].length).trim();
  }

  excerpt = excerpt
    .replace(/\bantal ord\s+\d+\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  const stop = excerpt.search(/\b(?:få ubegrænset adgang|computerworld premium|opret et gratis intro-abonnement|bliv abonnent|log ind|opret bruger|seneste nyt|mest læste)\b/i);
  if (stop > 180) excerpt = excerpt.slice(0, stop).trim();

  return cleanPreviewText(excerpt, title);
}

function extractPolitikenArticlePreview(html: string, title: string, seed: string) {
  if (!seed.trim()) return "";
  const blocks = Array.from(editorialHtml(html).matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/gi))
    .map((match) => match[1] || "");
  const anchor = seed.replace(/\s+/g, " ").trim().split(" ").slice(0, 9).join(" ").toLocaleLowerCase("da-DK");
  const results: string[] = [];

  for (const block of blocks) {
    const paragraphs = Array.from(block.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi))
      .map((match) => cleanPreviewText(match[1] || "", title))
      .filter(Boolean);
    // A matching lead must be inside THIS article. A lead in a related-story
    // widget or site navigation is not proof that its following text is ours.
    const start = paragraphs.findIndex((text) =>
      (anchor.length >= 20 && text.toLocaleLowerCase("da-DK").includes(anchor)) ||
      similarity(seed, text) >= 0.7
    );
    if (start < 0) continue;

    const selected: string[] = [];
    const seen = new Set<string>();
    for (let i = start; i < paragraphs.length && selected.length < 5; i++) {
      const text = paragraphs[i].trim();
      const normalized = text.toLocaleLowerCase("da-DK");
      if (/^(?:læs næste|du er ikke logget ind|gem artiklen|gemt|læst|annonce)$/i.test(text)) continue;
      if (/^(?:læs videre for|du er godt i gang|bliv abonnent|allerede abonnent|log ind)\b/i.test(text)) break;
      if (/^(?:bøger\s+)?\d{1,2}\.\s*[a-z]+\s+\d{4}/i.test(text)) continue;
      if (text.length < 45 || similarity(title, text) > 0.8 || seen.has(normalized)) continue;
      seen.add(normalized);
      selected.push(text);
    }
    const excerpt = cleanPreviewText(joinEditorialParagraphs(selected), title);
    if (excerpt.length >= 50) results.push(excerpt);
  }
  return results.sort((a, b) => previewQuality(b) - previewQuality(a))[0] || "";
}

function extractVisibleTextFollowingSeed(html: string, title: string, seed: string) {
  if (!seed.trim()) return "";

  const visible = decodeHtmlEntities(stripHtml(
    html
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<svg\b[\s\S]*?<\/svg>/gi, " ")
  ))
    .replace(/\s+/g, " ")
    .trim();

  const anchor = seed
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 9)
    .join(" ");

  if (anchor.length < 32) return "";
  const start = visible.toLocaleLowerCase("da-DK").indexOf(anchor.toLocaleLowerCase("da-DK"));
  if (start < 0) return "";

  return cleanPreviewText(visible.slice(start, start + 1800), title);
}

function extractTextFollowingSeed(html: string, title: string, seed: string) {
  if (!seed.trim()) return "";

  const scope =
    html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] ||
    html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ||
    html;

  const plain = cleanPreviewText(scope, title);
  const normalizedPlain = plain.toLocaleLowerCase("da-DK");
  const anchor = seed
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 10)
    .join(" ")
    .toLocaleLowerCase("da-DK");

  if (anchor.length < 35) return "";
  const start = normalizedPlain.indexOf(anchor);
  if (start < 0) return "";

  const excerpt = plain.slice(start, start + 1400);
  return cleanPreviewText(excerpt, title);
}

function extractMainScopedPreview(html: string, title: string, seed: string) {
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] || "";
  if (!main) return "";
  return extractScopedArticlePreview(main, title, seed);
}

function extractScopedArticlePreview(html: string, title: string, seed: string) {
  html = editorialHtml(html);
  const articleBlocks = Array.from(html.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/gi))
    .map((match) => match[1] || "");
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] || "";
  const candidates = articleBlocks.length ? articleBlocks : main ? [main] : [];

  const ranked = candidates
    .map((block) => {
      const paragraphs = Array.from(block.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi))
        .map((match) => cleanPreviewText(match[1] || ""))
        .filter((text) => text.length >= 35 && !isBoilerplatePreview(text));
      const headline = cleanPreviewText(block.match(/<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/i)?.[1] || "");
      const headingScore = headline ? similarity(title, headline) : 0;
      const firstRelevant = paragraphs.findIndex((text) =>
        (seed && similarity(seed, text) >= 0.5) || similarity(title, text) >= 0.5
      );
      // Do not prepend sidebars or unrelated teasers that precede the article lead.
      const start = firstRelevant >= 0 ? firstRelevant : 0;
      const joined = joinEditorialParagraphs(paragraphs.slice(start, start + 6));
      const textScore = Math.max(
        similarity(title, joined),
        seed ? similarity(seed, joined) : 0
      );
      const score = Math.max(headingScore, textScore);
      return { joined, score, headingScore, firstRelevant };
    })
    .filter((candidate) => candidate.joined.length >= 80)
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  if (!best || best.score < 0.12) return "";
  // A page with multiple article cards needs strong evidence of ownership.
  if (articleBlocks.length > 1 &&
      best.headingScore < 0.5 && (best.firstRelevant < 0 || best.score < 0.5)) return "";
  return cleanPreviewText(best.joined, title);
}

function decodeJsonString(value: string) {
  return value
    .replace(/\\u([0-9a-f]{4})/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\n|\\r|\\t/g, " ")
    .replace(/\\"/g, '"')
    .replace(/\\\//g, "/");
}

function extractEmbeddedArticlePreview(html: string, title: string, seed: string) {
  const candidates: string[] = [];
  const pattern = /"(?:articleBody|body|content|text|intro|lead|teaser|description)"\s*:\s*"((?:\\.|[^"\\])*)"/gi;

  for (const match of html.matchAll(pattern)) {
    const cleaned = cleanPreviewText(decodeJsonString(match[1] || ""), title);
    if (cleaned.length >= 80 && !isBoilerplatePreview(cleaned)) candidates.push(cleaned);
  }

  const ranked = candidates
    .map((text) => {
      const titleScore = similarity(title, text);
      const seedScore = seed ? similarity(seed, text) : 0;
      const score = Math.max(titleScore, seedScore) * 4 + Math.min(text.length, 900) / 900;
      return { text, titleScore, seedScore, score };
    })
    .filter((candidate) => candidate.titleScore >= 0.12 || candidate.seedScore >= 0.25)
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.text || "";
}

function extractJfmAsyncArticleText(html: string, title: string) {
  if (!html) return "";
  html = editorialHtml(html);

  // This is the current article's public JFM async endpoint, not a full page.
  // Drop repeated introductions and unrelated subscription/navigation blocks.
  const seen = new Set<string>();
  const paragraphs = Array.from(html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi))
    .map((match) => cleanPreviewText(match[1] || "", title))
    .filter((text) => {
      const key = text.toLocaleLowerCase("da-DK");
      if (text.length < 25 || isBoilerplatePreview(text) || seen.has(key) ||
          /^(?:læs også|se også|relateret|annonce|bliv abonnent|log ind)\b/i.test(text)) return false;
      seen.add(key);
      return true;
    });

  if (!paragraphs.length) return "";
  return cleanPreviewText(joinEditorialParagraphs(paragraphs.slice(0, 10)), title);
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
  if (!isStiften && item.category !== "Aarhus" && item.description.length >= 340 && !isBoilerplatePreview(item.description) && item.imageUrl) return item;

  try {
    let articleFetchUrl = item.link;
    if (isStiften) {
      try {
        const parsed = new URL(item.link);
        parsed.searchParams.delete("rss");
        articleFetchUrl = parsed.toString();
      } catch {}
    }

    // For Stiften articles with missing or very short RSS text, a 26-second attempt works
    // better than two short attempts that both abort before JFM responds.
    // The scheduled collector does this work off the visitor's request path.
    const needsStiftenText = isStiften && (
      item.description.trim().length < 180 ||
      /ingen selvstændig artikeltekst tilgængelig/i.test(item.description)
    );
    const fetchArticlePage = (retry = false) => fetch(articleFetchUrl, {
      ...(retry ? { cache: "no-store" as const } : { next: { revalidate: 900 } }),
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; OELdk/1.0; +https://øl.dk)",
        Accept: "text/html,application/xhtml+xml"
      },
      signal: AbortSignal.timeout(needsStiftenText ? (retry ? 12000 : 26000) : 3500)
    });
    let response: Response;
    try {
      response = await fetchArticlePage();
    } catch {
      if (!needsStiftenText) return item;
      try {
        response = await fetchArticlePage(true);
      } catch {
        return item;
      }
    }

    if (!response.ok) return item;
    const html = await response.text();

    // Never enrich an RSS item from a page whose own article title points to a
    // different story. Publisher pages can contain metadata/paragraphs from
    // neighbouring or recommended stories; accepting those is what creates
    // mismatched intros on ØL.dk.
    const explicitPageTitle =
      extractMetaContent(html, "og:title") ||
      extractMetaContent(html, "twitter:title");
    if (explicitPageTitle && !articleTitleMatchesPage(item.title, html)) {
      return item;
    }

    // JFM/Stiften renders the actual article body from a separate async endpoint.
    // The RSS description can be empty even for a freely available article, so
    // follow the page's own data-load-async-url and merge that HTML into the
    // extraction scope. This avoids scraping unrelated teaser blocks.
    let articleHtml = html;
    let stiftenAsyncHtml = "";
    if (isStiften) {
      const asyncPath = html.match(/data-load-async-url=["']([^"']+)["']/i)?.[1];
      if (asyncPath) {
        try {
          const asyncEndpoint = new URL(asyncPath, articleFetchUrl);
          // Never follow a publisher-supplied async path to a different host.
          if (asyncEndpoint.protocol !== "https:" ||
              asyncEndpoint.hostname !== new URL(articleFetchUrl).hostname) {
            throw new Error("Stiften article endpoint was outside the source host");
          }
          const fetchBody = (retry = false) => fetch(asyncEndpoint.toString(), {
            ...(retry ? { cache: "no-store" as const } : { next: { revalidate: 900 } }),
            redirect: "follow",
            headers: {
              "User-Agent": "Mozilla/5.0 (compatible; OELdk/1.0; +https://øl.dk)",
              Accept: "text/html,application/xhtml+xml,*/*"
            },
            signal: AbortSignal.timeout(needsStiftenText ? (retry ? 12000 : 26000) : 8000)
          });
          let asyncResponse: Response | null = null;
          try {
            asyncResponse = await fetchBody();
          } catch {
            // Do not repeat slow publisher work for articles with a usable
            // RSS description. Retry missing and very short excerpts.
            if (needsStiftenText) {
              try { asyncResponse = await fetchBody(true); } catch {}
            }
          }
          if (asyncResponse?.ok) {
            stiftenAsyncHtml = await asyncResponse.text();
            articleHtml = `${html}\n${stiftenAsyncHtml}`;
          }
        } catch {}
      }
    }

    const pageImageUrl = extractArticleImageUrl(articleHtml, item.title);

    // These publishers have lots of account/navigation paragraphs in the DOM.
    // Only use explicit metadata for them, never arbitrary <p> elements.
    const isPolitiken = /(?:^|\.)politiken\.dk$/i.test(hostname);
    const isDr = /(?:^|\.)dr\.dk$/i.test(hostname);
    const isComputerworld = /(?:^|\.)computerworld\.dk$/i.test(hostname);
    const metadataOnly = /(?:^|\.)(?:ing|version2|nordjyske)\.dk$/i.test(hostname);
    const trustedStiftenAsyncPreview = isStiften
      ? extractJfmAsyncArticleText(stiftenAsyncHtml, item.title)
      : "";
    // The page's own description is tied to the verified og:title and can be
    // trusted even if it shares few words with the headline (e.g. opinion).
    const trustedStiftenMetadata = isStiften && explicitPageTitle &&
      articleTitleMatchesPage(item.title, html)
      ? extractMetadataPreview(html)
      : "";

    const preview = isStiften
      ? (trustedStiftenAsyncPreview.length >= 80 ? trustedStiftenAsyncPreview :
          trustedStiftenMetadata.length >= 80 ? trustedStiftenMetadata : [
          extractArticleBodyFromJson(articleHtml, item.title, item.description),
          extractScopedArticlePreview(articleHtml, item.title, item.description),
          extractEmbeddedArticlePreview(articleHtml, item.title, item.description),
          extractMetadataPreview(articleHtml)
        ]
          .filter((text) => text && !isBoilerplatePreview(text))
          .sort((a, b) => previewQuality(b) - previewQuality(a))[0] || "")
      : isPolitiken
        ? [
            extractPolitikenArticlePreview(html, item.title, item.description),
            extractArticleBodyFromJson(html, item.title, item.description),
            extractScopedArticlePreview(html, item.title, item.description),
            extractMetadataPreview(html)
          ]
            .filter((text) => text && !isBoilerplatePreview(text))
            .sort((a, b) => previewQuality(b) - previewQuality(a))[0] || ""
        : isDr
          ? [
              extractArticleBodyFromJson(html, item.title, item.description),
              extractScopedArticlePreview(html, item.title, item.description),
              extractMetadataPreview(html)
            ]
              .filter((text) => text && !isBoilerplatePreview(text))
              .sort((a, b) => previewQuality(b) - previewQuality(a))[0] || ""
        : isComputerworld
          ? [
              extractArticleBodyFromJson(html, item.title, item.description),
              extractComputerworldOverview(html, item.title),
              extractEmbeddedArticlePreview(html, item.title, item.description),
              extractMetadataPreview(html)
            ]
              .filter((text) => text && !isBoilerplatePreview(text))
              .sort((a, b) => previewQuality(b) - previewQuality(a))[0] || ""
        : metadataOnly
          ? extractMetadataPreview(html)
          : extractPublicPreview(html, item.title, item.description);

    const normalizedPreview = cleanPreviewText(preview, item.title);
    const cleanedPreview = isBoilerplatePreview(normalizedPreview) ? "" : normalizedPreview;

    // Stiften/JFM pages occasionally expose structured text from a neighbouring
    // article. Only accept an enriched Stiften preview when it actually overlaps
    // meaningfully with the current article title; otherwise keep the RSS teaser.
    const stiftenSeedIsEmpty =
      !item.description.trim() ||
      /ingen selvstændig artikeltekst tilgængelig/i.test(item.description);

    const stiftenPreviewMatchesTitle = !isStiften || (
      // Text returned by Stiften/JFM's own async article endpoint is already
      // scoped to this article, so do not reject it just because the body uses
      // different wording than the headline.
      trustedStiftenAsyncPreview.length >= 80 ||
      (trustedStiftenMetadata.length >= 80 &&
        cleanedPreview === cleanPreviewText(trustedStiftenMetadata, item.title)) ||
      similarity(item.title, cleanedPreview) >= (stiftenSeedIsEmpty ? 0.12 : 0.2) ||
      (!stiftenSeedIsEmpty && similarity(item.description, cleanedPreview) >= 0.3)
    );

    const bestDescription =
      stiftenPreviewMatchesTitle && previewQuality(cleanedPreview) > previewQuality(item.description)
        ? cleanedPreview
        : item.description;

    const fullArticleMentionText = articleMentionText(html, stiftenAsyncHtml);
    const fullArticleMentions = /\bwinners(?:kjold|kiold)\b/i.test(fullArticleMentionText)
      ? Array.from(new Set([...(item.mentions || []), "anders-winnerskjold"]))
      : (item.mentions || []);

    return {
      ...item,
      description: bestDescription,
      mentions: fullArticleMentions,
      imageUrl: isStiften && !stiftenPreviewMatchesTitle ? item.imageUrl : (pageImageUrl || item.imageUrl),
      pubDate: extractPublishedDateFromHtml(html, item.title) || item.pubDate
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
    const explicitPageTitle = extractMetaContent(html, "og:title") ||
      extractMetaContent(html, "twitter:title");
    if (explicitPageTitle && !articleTitleMatchesPage(item.title, html)) return item;

    const pageImageUrl = extractArticleImageUrl(html, item.title);

    const jsonHeadline =
      html.match(/"headline"\s*:\s*"((?:\\.|[^"\\])*)"/i)?.[1] || "";
    const embeddedHeadline = cleanPreviewText(decodeJsonString(jsonHeadline));
    const headline = embeddedHeadline && similarity(item.title, embeddedHeadline) >= 0.6
      ? embeddedHeadline
      : extractMetaContent(html, "og:title") || item.title;

    const description =
      extractArticleBodyFromJson(html, item.title, item.description) ||
      extractScopedArticlePreview(html, item.title, item.description) ||
      extractMetadataPreview(html) ||
      item.description;

    return {
      ...item,
      title: stripHtml(headline).replace(/^TV 2[:\s|-]+/i, "").trim() || item.title,
      description: cleanPreviewText(description, headline),
      imageUrl: pageImageUrl || item.imageUrl,
      pubDate: extractPublishedDateFromHtml(html, item.title) || item.pubDate
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
    const explicitPageTitle = extractMetaContent(html, "og:title") ||
      extractMetaContent(html, "twitter:title");
    if (explicitPageTitle && !articleTitleMatchesPage(item.title, html)) return item;

    const pageImageUrl = extractArticleImageUrl(html, item.title);

    const candidates = [
      extractArticleBodyFromJson(html, item.title, item.description),
      extractScopedArticlePreview(html, item.title, item.description),
      extractMetadataPreview(html)
    ].filter((text) => text && !isBoilerplatePreview(text));
    const description = candidates
      .sort((a, b) => previewQuality(b) - previewQuality(a))[0] || item.description;

    const pageHeadline = extractMetaContent(html, "og:title");
    const headline = pageHeadline && articleTitleMatchesPage(item.title, html)
      ? pageHeadline
      : item.title;

    return {
      ...item,
      title: stripHtml(headline) || item.title,
      description: cleanPreviewText(description, headline),
      imageUrl: pageImageUrl || item.imageUrl,
      pubDate: extractPublishedDateFromHtml(html, item.title) || item.pubDate
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
        id: `TV2-web:${canonical}`
      });
    }
  }

  return Promise.all(items.slice(0, 100).map(enrichTV2Item));
}

function berlingskeTextNodes(value: unknown): string {
  if (Array.isArray(value)) return value.map(berlingskeTextNodes).join("");
  if (!value || typeof value !== "object") return "";
  const node = value as Record<string, unknown>;
  if (node.type === "TextNode") return typeof node.value === "string" ? node.value : "";
  return berlingskeTextNodes(node.children);
}

function parseBerlingskeWebArticle(raw: Record<string, unknown>): NewsItem | null {
  const link = String(raw.url || "");
  if (!/^https:\/\/www\.berlingske\.dk\/[a-z-]+\/[^/?#]+$/.test(link)) return null;
  const title = cleanPreviewText(String(raw.title || ""));
  const pubDate = String(raw.publicationDate || "");
  if (!title || !parseNewsDate(pubDate)) return null;
  const paragraphs = Array.isArray(raw.body) ? raw.body
    .filter((node) => node && node.type === "ParagraphNode")
    .map((node) => cleanPreviewText(berlingskeTextNodes(node), title))
    .filter(Boolean) : [];
  const description = paragraphs.join(" ") || cleanPreviewText(berlingskeTextNodes(raw.subheadline), title);
  if (description.length < 50) return null;
  const assets = Array.isArray(raw.leadAssets) ? raw.leadAssets : [];
  const imageUrl = assets.flatMap((node) => {
    if (node.type === "FigureNode" && node.asset?.type === "ImageNode") return node.asset.image?.assets || [];
    if (node.type === "ImageNode") return node.image?.assets || [];
    return !node.type && Array.isArray(node.assets) ? node.assets : [];
  }).find((asset) => typeof asset.url === "string" && /^https:\/\//.test(asset.url) &&
    /image\//.test(String(asset.contentType)))?.url;
  return {
    id: `Berlingske-web:${link}`, source: "Berlingske", method: "WEB", link, title,
    description, pubDate, imageUrl,
    category: /\/(?:business|virksomheder|oekonomi|penge)\//.test(link) ? "Erhverv" : "Danmark",
    mentions: /\bwinners(?:kjold|kiold)\b/i.test(description) ? ["anders-winnerskjold"] : []
  };
}

function mergeBerlingskeWebsiteText(items: NewsItem[]): NewsItem[] {
  const canonical = (link: string) => { try { const u = new URL(link); return u.origin + u.pathname.replace(/\/$/, ""); } catch { return link; } };
  const web = new Map(items.filter((item) => item.source === "Berlingske" && item.method === "WEB")
    .map((item) => [canonical(item.link), item]));
  return items.map((item) => {
    if (item.source !== "Berlingske" || item.method !== "RSS") return item;
    const article = web.get(canonical(item.link));
    return article && article.description.length > item.description.length
      ? { ...item, description: article.description, imageUrl: article.imageUrl || item.imageUrl, mentions: article.mentions, method: "WEB" }
      : item;
  });
}

async function fetchBerlingskeWebsite(): Promise<NewsItem[]> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return [];
  const response = await fetch(`${url}/rest/v1/rpc/oeldk_berlingske_web`, {
    method: "POST", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: "{}", cache: "no-store", signal: AbortSignal.timeout(5000)
  });
  if (!response.ok) throw new Error(`Berlingske website collection returned ${response.status}`);
  const rows = await response.json();
  if (!Array.isArray(rows)) return [];
  return rows.map(parseBerlingskeWebArticle).filter((item): item is NewsItem => item !== null);
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
      id: `Børsen-web:${canonical}`
    });
  }

  return Promise.all(items.map(enrichBorsenItem));
}

function hasEditorialPreview(text: string, title = "") {
  const clean = cleanPreviewText(text, title);
  return clean.length >= 20 && !isBoilerplatePreview(clean) &&
    !/ØL\.dk har endnu ikke kunnet hente et sikkert tekstuddrag/i.test(clean);
}

function applyPublisherPreviews(stories: Story[], value: unknown): Story[] {
  if (!Array.isArray(value)) return stories;
  const canonical = (link: string) => { try { const u = new URL(link); return u.origin + u.pathname.replace(/\/$/, ""); } catch { return ""; } };
  const rows = new Map(value.filter((row) => row && typeof row === "object" && typeof row.description === "string")
    .map((row) => [`${row.source}:${canonical(String(row.url || ""))}`, row]));
  return stories.map((story) => {
    if (hasEditorialPreview(story.summary, story.title)) return story;
    const lead = story.sources[0];
    const row = lead && rows.get(`${lead.label}:${canonical(lead.url)}`);
    if (!row || similarity(story.title, stripHtml(String(row.title || ""))) < 0.6) return story;
    const summary = cleanPublisherTeaser(String(row.description), story.title, lead.label);
    if (!hasEditorialPreview(summary, story.title)) return story;
    return { ...story, summary, mentions: Array.from(new Set([
      ...(story.mentions || []), ...(/\bwinners(?:kjold|kiold)\b/i.test(summary) ? ["anders-winnerskjold"] : [])
    ])) };
  });
}

function applyPublisherFeaturedImages(stories: Story[], value: unknown): Story[] {
  if (!Array.isArray(value)) return stories;
  const canonical = (link: string) => {
    try { const url = new URL(link); return url.protocol === "https:" && !url.username && !url.password ? url.origin + url.pathname.replace(/\/$/, "") : ""; }
    catch { return ""; }
  };
  const images = new Map<string, { title: string; imageUrl: string }>();
  const publisherHosts: Record<string, string[]> = {
    Journalisten: ["journalisten.dk"], TechSavvy: ["techsavvy.media"],
    Computerworld: ["computerworld.dk"], "Stiften.dk": ["stiften.dk"],
    Ingeniøren: ["ing.dk"], Version2: ["version2.dk"],
    "Berlingske Tidende": ["berlingske.dk"], "Danmarks Radio": ["dr.dk"],
    "TV2.dk": ["nyheder.tv2.dk", "tv2.dk"], Børsen: ["borsen.dk"], MigogAarhus: ["migogaarhus.dk"]
  };
  for (const row of value) {
    if (!row || typeof row !== "object" || !publisherHosts[row.source]) continue;
    const link = canonical(String(row.url || ""));
    if (!link || !publisherHosts[row.source].includes(new URL(link).hostname.replace(/^www\./, ""))) continue;
    try {
      const image = new URL(decodeHtmlEntities(String(row.imageUrl || "")));
      if (image.protocol !== "https:" || image.username || image.password ||
          /(?:^|\/)(?:logo|favicon|avatar|placeholder)(?:[-_.\/]|$)/i.test(image.pathname)) continue;
      images.set(`${row.source}:${link}`, { title: stripHtml(String(row.title || "")), imageUrl: image.toString() });
    } catch {}
  }
  return stories.map((story) => {
    if (story.imageUrl) return story;
    const lead = story.sources[0];
    if (!lead) return story;
    const image = images.get(`${lead.label}:${canonical(lead.url)}`);
    return image && similarity(story.title, image.title) >= 0.6 ? { ...story, imageUrl: image.imageUrl } : story;
  });
}

async function addPublisherFeaturedImages(stories: Story[]): Promise<Story[]> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return stories;
  const metadata = await Promise.allSettled(["oeldk_featured_images", "oeldk_article_previews"].map(async (rpc) => {
    const response = await fetch(`${url}/rest/v1/rpc/${rpc}`, {
      method: "POST", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: "{}", cache: "no-store", signal: AbortSignal.timeout(4000)
    });
    return response.ok ? response.json() : [];
  }));
  const images = metadata[0].status === "fulfilled" ? metadata[0].value : [];
  const previews = metadata[1].status === "fulfilled" ? metadata[1].value : [];
  return applyPublisherFeaturedImages(applyPublisherPreviews(stories, previews), images);
}

export async function getLiveStories(options?: { fast?: boolean; limit?: number }): Promise<Story[]> {
  const fast = Boolean(options?.fast);
  const fastFeeds = feeds.filter((feed) =>
    isVisiblePublisher(feed.name) &&
    !/[?&]paged=\d+/i.test(feed.url)
  );

  const results = await Promise.allSettled(
    fast
      ? fastFeeds.map((feed) => fetchFeed(feed, 2200))
      : [
          ...feeds.map((feed) => fetchFeed(feed)),
          fetchMigogAarhusApi(),
          fetchBorsenWebsite(),
          fetchBerlingskeWebsite(),
          fetchTV2Website()
        ]
  );

  results.forEach((result, index) => {
    if (result.status === "rejected") {
      const source = (fast ? fastFeeds : feeds)[index]?.name || "Website source";
      console.warn("News source fetch failed", source, String(result.reason));
    }
  });

  const fetched = mergeBerlingskeWebsiteText(results
    .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
    .filter((item) => isFresh(item.pubDate))
    .filter((item) => isVisiblePublisher(item.source))
    .filter((item) => !isLiveCoverage(item)));

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
        const byDate = bTime - aTime;
        if (byDate) return byDate;
        // For the same publisher and publication time, keep the fuller text
        // from its free web article instead of the short RSS teaser.
        return a.source === b.source ? b.description.length - a.description.length : 0;
      });
      const chronologicalLead = orderedCluster[0];
      // Keep the headline, body and URL from the same article. Clustering
      // establishes related coverage, not interchangeable editorial text.
      const lead = chronologicalLead;
      const sources = [lead, ...orderedCluster.filter((item) => item !== lead)]
        .filter((item, index, items) =>
          items.findIndex((candidate) => publisherName(candidate.source) === publisherName(item.source)) === index
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
    .slice(0, fast ? Math.max(20, options?.limit || 20) : 1500);

  // Only fetch article pages for stories whose RSS/web teaser is too short.
  // This also works for subscriber articles because we only use public metadata/teasers.
  const enrichedSelected = fast
    ? selected
    : await Promise.all(
    selected.map(async (entry, index) => {
      let leadHost = "";
      try {
        leadHost = new URL(entry.lead.link).hostname.toLowerCase();
      } catch {}
      const alwaysEnrichStiften = /(?:^|\.)stiften\.dk$/i.test(leadHost);
      const alwaysEnrichComputerworld = /(?:^|\.)computerworld\.dk$/i.test(leadHost);
      const alwaysEnrich = alwaysEnrichStiften || alwaysEnrichComputerworld || entry.lead.category === "Aarhus";

      // Stiften and Computerworld frequently publish short RSS teasers while
      // additional article text is available on the article page. Always attempt
      // enrichment for those publishers, even outside the general request budget.
      if (!alwaysEnrich && (
        (entry.lead.description.length >= 340 && !isBoilerplatePreview(entry.lead.description) && entry.lead.imageUrl) ||
        index >= 220
      )) return entry;

      return { ...entry, lead: await enrichPreview(entry.lead) };
    })
  );

  const stories = enrichedSelected.map((entry, index) => {
    const { lead, sources } = entry;
    const hasCrossCheck = sources.length >= 2;
    const wordingNeutrality = scoreWordingNeutrality(`${lead.title} ${lead.description}`);
    const originality = scoreOriginality(lead, sources);
    // Apply the same final safeguards to every source, including RSS-only items:
    // photo credits are not article text, and the headline must not repeat at
    // the beginning of the teaser.
    const cleanDescription = cleanPublisherTeaser(lead.description, lead.title, lead.source);
    const mentionHaystack = `${lead.title} ${cleanDescription}`;
    const mentions = Array.from(new Set([
      ...(lead.mentions || []),
      ...(/\bwinners(?:kjold|kiold)\b/i.test(mentionHaystack) ? ["anders-winnerskjold"] : [])
    ]));
    let summary = isBoilerplatePreview(cleanDescription) ? "" : cleanDescription;
    if (!summary) {
      summary = `${publisherName(lead.source)} har publiceret historien “${lead.title}”. ØL.dk har endnu ikke kunnet hente et sikkert tekstuddrag fra selve artiklen.`;
    }
    // Preserve the fetched editorial excerpt; the feed handles visual collapse.


    return {
      id: `live:${lead.id}`,
      category: lead.category,
      title: lead.title,
      sourceLabel: hasCrossCheck ? `${publisherName(lead.source)} · ${sources.length} kilder` : lead.source,
      published: timeAgo(lead.pubDate),
      publishedAt: parseNewsDate(lead.pubDate)?.toISOString(),
      publishedDate: formatPublishedDate(lead.pubDate),
      sourceMethod: lead.method,
      summary,
      mentions,
      imageUrl: lead.imageUrl,
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

  const illustratedStories = fast ? stories : await addPublisherFeaturedImages(stories);
  const chronologicalStories = illustratedStories.filter((story) => hasEditorialPreview(story.summary, story.title)).sort((a, b) => {
    const aTime = parseNewsDate(a.publishedAt)?.getTime() ?? 0;
    const bTime = parseNewsDate(b.publishedAt)?.getTime() ?? 0;
    const safeA = Number.isFinite(aTime) ? aTime : 0;
    const safeB = Number.isFinite(bTime) ? bTime : 0;
    return safeB - safeA;
  });

  if (!fast) {
    try {
      await persistStories(chronologicalStories);
    } catch (error) {
      console.error("Supabase news persistence failed:", error);
    }
  }

  return options?.limit ? chronologicalStories.slice(0, options.limit) : chronologicalStories;
}

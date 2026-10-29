// Publisher account widgets can appear inside an <article> tag.
// A word count from those widgets must never determine the Resumé button.
const publisherInterfacePatterns = [
  /\bopret (?:et )?personligt gavelink\b/i,
  /\bdu skal selv have adgang til denne artikel\b/i,
  /\b(?:enten via|via) et betalt abonnement eller et ida-medlemskab\b/i,
  /\bkunne ikke generere link\b/i,
  /\blog ind for at følge\b/i,
  /\bdu skal være logget ind for at følge\b/i,
  /\blog ind for at læse videre\b/i,
  /\bbliv abonnent for at læse videre\b/i,
  /\bfå ubegrænset adgang til\b/i,
  /\btilmeld dig (?:vores|mit) nyhedsbrev\b/i,
  // Publisher-wide RSS/about descriptions, not the body of any individual story.
  /\bNyheder, analyser, viden, blogs og debat om it\b/i,
  /\bComputerworld er dit medie om det digitale Danmark\b/i,
  /\bComputerworld skriver om nye teknologier, hardware, software\b/i
];


/**
 * Publisher-independent site/about text. Keep these deliberately specific:
 * a normal news story can also contain the words "nyheder" and "medie".
 */
const genericPublisherAboutPatterns = [
  /(?:^|\s+)[\p{Lu}][\p{L}\p{N}.-]*(?:\s+[\p{L}\p{N}.-]+){0,3}\s+er\s+(?:dit|din|vores)\s+(?:medie|avis|nyhedssite|nyhedskilde|nyhedsportal)\b/iu,
  /(?:^|\s+)Her (?:finder|læser|får) du (?:de |alle |vores )?(?:seneste )?(?:nyheder|artikler|analyser)\s+(?:om|fra|og)\b/i,
  /(?:^|\s+)Hold dig opdateret (?:med|på) (?:de |alle )?(?:seneste )?(?:nyheder|artikler|analyser)\b/i,
  /(?:^|\s+)Velkommen til [^.!?]{0,70}\b(?:nyheder|artikler|analyser)\b/i
];

/** Normalize public, non-personal description text for same-publisher comparison. */
export function publisherDescriptionKey(source: string, description: string): string {
  return source.trim().toLocaleLowerCase("da-DK") + "\u0001" +
    description.replace(/\s+/g, " ").trim().toLocaleLowerCase("da-DK");
}

type SourceTeaser = { source: string; title: string; description: string };

/**
 * Same long text on three clearly unrelated headlines from the SAME publisher
 * is very likely feed/site-wide boilerplate, whatever the publisher is called.
 * Require distinct headline vocabularies to avoid rejecting story updates.
 */
export function repeatedPublisherDescriptionKeys(items: SourceTeaser[]): Set<string> {
  const groups = new Map<string, Set<string>>();
  for (const item of items) {
    const description = item.description.replace(/\s+/g, " ").trim();
    if (description.length < 80 || description.split(/\s+/).length < 12 || !item.source.trim()) continue;
    const title = item.title.toLocaleLowerCase("da-DK")
      .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    if (!title) continue;
    const key = publisherDescriptionKey(item.source, description);
    if (!groups.has(key)) groups.set(key, new Set());
    groups.get(key)!.add(title);
  }

  const suspicious = new Set<string>();
  for (const [key, titles] of groups) {
    if (titles.size < 3) continue;
    const unrelated: Set<string>[] = [];
    for (const title of titles) {
      const terms = new Set(title.split(" ").filter(word => word.length >= 4));
      if (terms.size < 2) continue;
      const isUnrelated = unrelated.every(existing => {
        const shared = [...terms].filter(word => existing.has(word)).length;
        return shared / Math.max(1, Math.min(terms.size, existing.size)) < 0.4;
      });
      if (isUnrelated) unrelated.push(terms);
      if (unrelated.length >= 3) {
        suspicious.add(key);
        break;
      }
    }
  }
  return suspicious;
}

export function hasPublisherInterfaceText(value: string): boolean {
  return publisherInterfacePatterns.some(pattern => pattern.test(value)) ||
    genericPublisherAboutPatterns.some(pattern => pattern.test(value));
}

export function isEditorialParagraph(value: string): boolean {
  const text = value.trim();
  if (text.length < 35 || hasPublisherInterfaceText(text)) return false;
  return !/^(?:læs også|læs mere|se også|annonce|foto:|fotograf:|abonnér|nyhedsbrev|tilmeld|relaterede artikler)(?:\s|:|$)/i.test(text);
}

/**
 * Some publisher exports flatten consecutive sentences/paragraphs without
 * their punctuation: "stor begejstring Især i de delstater".
 *
 * Only repair a small group of unambiguous uppercase sentence openers after
 * a lower-case word (not a capitalized name). Do not insert periods at every capital letter:
 * that would corrupt names, abbreviations and direct quotations.
 */
export function repairMissingSentenceStops(value: string): string {
  // HTML/RSS flattening can separate a period from the preceding word:
  // "New York Times . Og" must display as "New York Times. Og".
  // Danish punctuation is attached to the word before it; don't otherwise
  // rewrite publisher quotes or guess sentence boundaries around names.
  const punctuationJoined = value.replace(/[ \t\u00a0]+(?=[.,!?;:])/g, "");
  return punctuationJoined.replace(
    /(?<![\p{L}\p{M}])([\p{Ll}][\p{L}\p{M}’'-]*)(\s+)(?=(?:Især|Samtidig|Desuden|Derudover|Alligevel|Imidlertid|Derfor|Til gengæld|I øvrigt)\b)/gu,
    "$1.$2"
  );
}

/** Preserve HTML paragraph boundaries that would otherwise be collapsed. */
export function joinArticleParagraphs(paragraphs: string[]): string {
  const items = paragraphs.map(text => text.trim()).filter(Boolean);
  return items.map((paragraph, index) => {
    if (index === items.length - 1) return paragraph;
    // Don't invent a stop before a lower-case continuation, headings or
    // punctuation already present. A clear new paragraph can be a new sentence.
    const next = items[index + 1];
    if (!/^[A-ZÆØÅ]/u.test(next) || /[.!?…:;,-](?:["'»”’)\]]*)$/u.test(paragraph)) return paragraph;
    return /[\p{Ll}\p{N}»”’]$/u.test(paragraph) ? paragraph + "." : paragraph;
  }).join(" ");
}

// A teaser must end on a sentence boundary rather than after word 100.
// If the source itself ends in an unfinished sentence, use its last completed
// sentence instead of displaying a fragment as finished journalism.
export function previewWordCount(value: string): {excerpt: string; hasMore: boolean; wordCount: number} {
  const normalized = repairMissingSentenceStops(stripPublisherBoilerplate(value.replace(/\s+/g, " ").trim()));
  const words = normalized ? normalized.split(" ") : [];
  const count = words.length;
  if (!count) return { excerpt: "", hasMore: false, wordCount: 0 };

  const sentences = new Intl.Segmenter("da", { granularity: "sentence" }).segment(normalized);
  let usedWords = 0;
  let lastCompleted = "";
  let firstCompletedAfter100 = "";

  for (const sentence of sentences) {
    const segment = sentence.segment.trim();
    usedWords += segment ? segment.split(/\s+/).length : 0;
    // Preserve punctuation from the publisher; never invent a full stop.
    if (!/[.!?](?:["'»”’)\]]*)$/.test(segment)) continue;
    const completed = normalized.slice(0, sentence.index + sentence.segment.length).trim();
    lastCompleted = completed;
    if (usedWords >= 100) {
      firstCompletedAfter100 = completed;
      break;
    }
  }

  // A complete sentence just after 100 words is better than a broken one.
  // If none exists, fall back to the last already-completed sentence.
  // No reliable boundary at all: explicitly mark the source as incomplete.
  const excerpt = firstCompletedAfter100 || lastCompleted ||
    (count > 100 ? words.slice(0, 100).join(" ") + " …" : normalized);

  return { excerpt, hasMore: count > 100, wordCount: count };
}

/** Remove publisher UI added after genuine editorial content. */
export function stripPublisherBoilerplate(value: string): string {
  const patterns = [
    /(?:^|\s+)Da du er ved at tilmelde dig en gratis prøve\b/i,
    /(?:^|\s+)Angiver du Ingeniøren som foretrukken kilde\b/i,
    /(?:^|\s+)ved at vælge et eller flere emner der interesserer dig\b/i,
    /(?:^|\s+)Google vise vores artikler højere oppe i dine søgeresultater\b/i,
    /(?:^|\s+)Opret et personligt gavelink\b/i,
    /(?:^|\s+)Log ind for at følge\b/i,
    /(?:^|\s+)Nyheder, analyser, viden, blogs og debat om it\b/i,
    /(?:^|\s+)Computerworld er dit medie om det digitale Danmark\b/i,
    /(?:^|\s+)Computerworld skriver om nye teknologier, hardware, software\b/i
  ];
  let end=value.length;
  for(const pattern of [...patterns, ...genericPublisherAboutPatterns]) {
    const found=pattern.exec(value);
    if(found && found.index<end) end=found.index;
  }
  return value.slice(0,end).trim();
}

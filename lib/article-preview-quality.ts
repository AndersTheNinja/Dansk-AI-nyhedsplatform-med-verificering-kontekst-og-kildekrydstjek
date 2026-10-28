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
  /\btilmeld dig (?:vores|mit) nyhedsbrev\b/i
];

export function hasPublisherInterfaceText(value: string): boolean {
  return publisherInterfacePatterns.some(pattern => pattern.test(value));
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
 * a lower-case word or number. Do not insert periods at every capital letter:
 * that would corrupt names, abbreviations and direct quotations.
 */
export function repairMissingSentenceStops(value: string): string {
  return value.replace(
    /([\p{Ll}\p{N}»”’])(\s+)(?=(?:Især|Samtidig|Desuden|Derudover|Alligevel|Imidlertid|Derfor|Til gengæld|I øvrigt)\b)/gu,
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
    /(?:^|\s+)Log ind for at følge\b/i
  ];
  let end=value.length;
  for(const pattern of patterns) {
    const found=pattern.exec(value);
    if(found && found.index<end) end=found.index;
  }
  return value.slice(0,end).trim();
}

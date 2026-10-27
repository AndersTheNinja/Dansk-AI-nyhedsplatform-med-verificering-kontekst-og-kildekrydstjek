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

// Preserve the first complete sentence ending at or after word 100.
// If the available publisher text has no sentence ending, keep all of it.
export function previewWordCount(value: string): {excerpt: string; hasMore: boolean; wordCount: number} {
  const text = value.trim().replace(/\s+/g, " ");
  const words = Array.from(text.matchAll(/\S+/g));
  let excerpt = text;

  if (words.length > 100) {
    // Start inside word 100 so its final period also qualifies.
    const from = words[99].index ?? 0;
    const sentenceEnd = /[.!?](?:["'”’»)\]]+)?(?=\s|$)/g;
    sentenceEnd.lastIndex = from;
    const abbreviations = new Set([
      "kl", "dr", "prof", "hr", "fr", "fru", "frk", "ca", "fx",
      "f.eks", "bl.a", "m.fl", "m.m", "nr", "kr", "mia", "mio",
      "pct", "dvs", "osv", "jf", "evt", "inkl", "eks"
    ]);

    for (const match of text.matchAll(sentenceEnd)) {
      const before = text.slice(0, match.index);
      const previousWord = before.match(/(?:^|\s)(\S+)$/)?.[1] ?? "";
      const token = previousWord.replace(/^[("“‘]+/g, "").toLocaleLowerCase("da-DK");
      if (abbreviations.has(token)) continue;
      excerpt = text.slice(0, (match.index ?? 0) + match[0].length);
      break;
    }
  }

  return { excerpt, hasMore: words.length > 100, wordCount: words.length };
}

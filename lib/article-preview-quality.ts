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

export function previewWordCount(value: string): {excerpt: string; hasMore: boolean; wordCount: number} {
  const words = value.trim().split(/\s+/).filter(Boolean);
  return {
    excerpt: words.slice(0, 100).join(" "),
    hasMore: words.length > 100,
    wordCount: words.length
  };
}

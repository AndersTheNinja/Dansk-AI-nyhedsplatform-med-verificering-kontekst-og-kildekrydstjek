const genericImageTokens = /(?:^|[-_\/.])(?:standard|default|placeholder|fallback|generic|breaking[-_]?news|news[-_]?graphic|news[-_]?image|world[-_]?map|globe|jordklode|verdenskort|nyhedsgrafik|illustration[-_]?generic|logo|favicon|avatar)(?:[-_\/.]|$)/i;
const stopWords = new Set(["dette","denne","efter","blevet","havde","under","over","med","fra","til","som","der","det","for","dømt","årig","års","gammel","nye","nyhed","nyheder"]);

export function isGenericArticleImage(imageUrl: string, title: string, publisher: string, imageDescription = ""): boolean {
  let path = "";
  try {
    const image = new URL(imageUrl);
    if (!["https:", "http:"].includes(image.protocol)) return true;
    path = decodeURIComponent(image.pathname).toLocaleLowerCase("da-DK");
  } catch { return true; }
  if (genericImageTokens.test(path)) return true;
  const description = imageDescription.toLocaleLowerCase("da-DK").trim();
  if (/\b(?:standardbillede|standardgrafik|generisk billede|arkivillustration|illustrationsfoto|breaking news grafik|verdenskort|jordklode)\b/i.test(description)) return true;
  // DR sometimes exposes an unrelated generic news graphic as an image without
  // any article-specific context. On DR require actual image description or URL
  // filename to share at least one distinctive article keyword.
  if (/^(?:dr|dr nyheder|danmarks radio)$/i.test(publisher.trim())) {
    const titleWords = [...new Set(title.toLocaleLowerCase("da-DK")
      .split(/[^a-z0-9æøå]+/).filter(word => word.length >= 5 && !stopWords.has(word)))];
    const evidence = (path + " " + description).replace(/[^a-z0-9æøå]+/g," ");
    const isRelevant = titleWords.some(word => evidence.includes(word));
    if (!isRelevant) return true;
  }
  return false;
}

/**
 * Politiken sometimes publishes alternative RSS headlines for the same article.
 * Accept the publisher's canonical identity only when both URLs identify the
 * very same Politiken article ID; never equate articles just by similar topics.
 */
export function samePolitikenArticleUrl(requested: URL, canonicalValue: string): boolean {
  const isPolitiken = (host: string) => host === "politiken.dk" || host === "www.politiken.dk";
  if (!isPolitiken(requested.hostname) || requested.protocol !== "https:") return false;
  const articleId = (url: URL) => url.pathname.match(/\/art(\d{6,})(?:\/|$)/i)?.[1] || "";
  const requestedId = articleId(requested);
  if (!requestedId || !canonicalValue) return false;
  try {
    const canonical = new URL(canonicalValue, requested);
    return canonical.protocol === "https:" && isPolitiken(canonical.hostname) &&
      articleId(canonical) === requestedId;
  } catch {
    return false;
  }
}


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

export function techSavvyPostEndpoint(page: URL): URL | null {
  const isTechSavvy = page.hostname === "techsavvy.media" || page.hostname === "www.techsavvy.media";
  const slug = page.pathname.match(/^\/([a-z0-9-]+)\/?$/)?.[1];
  if (!isTechSavvy || !slug || page.protocol !== "https:" || page.port || page.username || page.password) return null;
  const endpoint = new URL("https://techsavvy.media/wp-json/wp/v2/posts");
  endpoint.search = new URLSearchParams({
    slug, _embed: "wp:featuredmedia", _fields: "link,featured_media,_links,_embedded", per_page: "1"
  }).toString();
  return endpoint;
}

export function techSavvyFeaturedImage(posts: unknown, page: URL): URL | null {
  if (!Array.isArray(posts) || posts.length !== 1) return null;
  const post = posts[0];
  const media = post?._embedded?.["wp:featuredmedia"]?.[0];
  if (typeof post?.link !== "string" || typeof media?.source_url !== "string" ||
      !Number.isSafeInteger(post.featured_media) || post.featured_media <= 0 ||
      media?.id !== post.featured_media || media?.media_type !== "image") return null;
  try {
    const link = new URL(post.link);
    const image = new URL(media.source_url);
    if (link.origin !== "https://techsavvy.media" || link.username || link.password ||
        link.pathname.replace(/\/$/, "") !== page.pathname.replace(/\/$/, "") ||
        image.origin !== link.origin || image.username || image.password ||
        !image.pathname.startsWith("/wp-content/uploads/")) return null;
    return image;
  } catch {
    return null;
  }
}

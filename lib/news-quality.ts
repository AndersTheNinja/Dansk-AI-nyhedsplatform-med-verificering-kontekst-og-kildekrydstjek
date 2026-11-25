import { politikenArticleId } from "./article-image-quality.ts";
import type { Story } from "./stories";
import { canonicalMediaName } from "./media-publishers.ts";


/** Editorial exclusion: ice hockey, including reports that only name teams. */
export function isIceHockeyNews(title: string, summary = "", url = ""): boolean {
  const text = (title + " " + summary).normalize("NFKC").replace(/[‐‑‒–—]/g, "-");
  const hockey = /(?:\bishockey[\p{L}-]*|\bice[ -]hockey\b|\bNHL\b|\bKHL\b|\bIIHF\b|\bMetal[ -]?Ligaen\b|\bStanley Cup\b|\b(?:hockeyspillere?|hockeyklub(?:ben|ber)?|hockeyhold(?:et)?|hockeykamp(?:en|e)?|hockeylandshold(?:et)?|ishockeyligaen)\b|\b(?:Frederikshavn White Hawks|Odense Bulldogs|Herning Blue Fox|Aalborg Pirates|Esbjerg Energy|Rungsted Seier Capital|Rødovre Mighty Bulls|SønderjyskE Ishockey|Herlev Eagles|Aarhus Hockey|Toronto Maple Leafs|Edmonton Oilers|Florida Panthers|Vegas Golden Knights|New York Rangers)\b)/iu;
  if (hockey.test(text)) return true;
  try { return /(?:^|[\/_-])(?:ishockey|ice-hockey|nhl|metal-?ligaen)(?:[\/_-]|$)/i.test(decodeURIComponent(new URL(url).pathname)); } catch { return false; }
}

export type QualityIssue = "short_text" | "publisher_ui" | "generic_image" | "missing_image" | "invalid_date" | "future_date" | "duplicate" | "truncated_sentence" | "weak_source_check" | "reading_time" | "photo_credit" | "repeated_lead";
export type QualityFinding = { id: string; source: string; issues: QualityIssue[] };
export type QualityReport = { checked: number; issueCounts: Record<QualityIssue, number>; examples: QualityFinding[] };

const uiPattern = /\b(?:opret et personligt gavelink|log ind for at følge|gratis prøve beder vi dig|angiver du ingeniøren som foretrukken kilde|kunne ikke generere link|bliv abonnent for at læse videre|nyheder, analyser, viden, blogs og debat om it|computerworld er dit medie om det digitale danmark|computerworld skriver om nye teknologier, hardware, software)\b/i;
const genericPicture = /(?:^|[-_\/.])(?:default|placeholder|fallback|generic|standard|nyhedsgrafik|verdenskort|jordklode|logo|favicon)(?:[-_\/.]|$)/i;
const issueTypes: QualityIssue[] = ["short_text","publisher_ui","generic_image","missing_image","invalid_date","future_date","duplicate","truncated_sentence","weak_source_check","reading_time","photo_credit","repeated_lead"];
export function auditNewsStories(stories: Story[], now = Date.now()): QualityReport {
 const counts = Object.fromEntries(issueTypes.map(key => [key,0])) as Record<QualityIssue,number>;
 const seen = new Set<string>();
 const examples: QualityFinding[] = [];
 for (const story of stories) {
  const issues: QualityIssue[] = [];
  const text = story.summary?.trim() || "";
  const primary = story.sources?.[0];
  const source = primary?.label || story.sourceLabel || "";
  if (text.split(/\s+/).filter(Boolean).length < 25) issues.push("short_text");
  if (uiPattern.test(text)) issues.push("publisher_ui");
  if (text.length > 75 && /(?:[,;:]|\b(?:og|men|fordi|at|som|der|med|til|på))\s*$/i.test(text)) issues.push("truncated_sentence");
  // Detect publisher metadata leaking into editorial copy.
  if (/\blæsetid\s*:?\s*\d{1,3}(?::\d{2})?\s*(?:min|minutter)?\b/i.test(text)) issues.push("reading_time");
  if (/\b(?:foto|fotograf|fotocredit)\s*:\s*[^.!?]{2,100}\b(?:ritzau|scanpix|wikimedia|commons)\b/i.test(text)) issues.push("photo_credit");
  const sentences = Array.from(new Intl.Segmenter("da", { granularity: "sentence" }).segment(text), part => part.segment.trim());
  if (sentences.length >= 3) {
    const normalize = (value: string) => value.toLocaleLowerCase("da-DK").replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(/\s+/);
    const first = normalize(sentences[0]);
    if (first.length >= 8 && sentences.slice(1,4).some(sentence => {
      const candidate = normalize(sentence);
      return candidate.length >= 8 && first.slice(0,6).join(" ") === candidate.slice(0,6).join(" ");
    })) issues.push("repeated_lead");
  }
  if (story.sources.length < 2 && story.verification === "confirmed") issues.push("weak_source_check");
  if (!story.imageUrl) issues.push("missing_image");
  else { try { if (genericPicture.test(decodeURIComponent(new URL(story.imageUrl).pathname))) issues.push("generic_image"); } catch { issues.push("generic_image"); } }
  const timestamp = story.publishedAt ? Date.parse(story.publishedAt) : NaN;
  if (!Number.isFinite(timestamp)) issues.push("invalid_date");
  else if (timestamp > now + 15*60_000) issues.push("future_date");
  // Same publisher and link is a duplicate; different publisher reports
  // are legitimate cross-check coverage.
  const key = (primary?.url || story.id).trim().toLowerCase().replace(/[?#].*$/,"");
  if (seen.has(key)) issues.push("duplicate");
  seen.add(key);
  for (const issue of issues) counts[issue]++;
  if (issues.length && examples.length < 30) examples.push({ id: story.id, source, issues });
 }
 return { checked: stories.length, issueCounts: counts, examples };
}


/** Apply only deterministic, reversible display-level fixes. Do not invent text or images. */
export function repairNewsStories(stories: Story[]): { stories: Story[]; repairs: Record<string,number> } {
 const repairs={ boilerplate:0,genericImage:0,duplicate:0,verification:0 };
 const seen=new Set<string>();
 const result:Story[]=[];
 const cutPatterns=[
   /(?:^|\s+)da du er ved at tilmelde dig en gratis prøve\b/i,
   /(?:^|\s+)angiver du ingeniøren som foretrukken kilde\b/i,
   /(?:^|\s+)opret et personligt gavelink\b/i,
   /(?:^|\s+)log ind for at følge\b/i,
   /(?:^|\s+)kunne ikke generere link\b/i,
   /(?:^|\s+)bliv abonnent for at læse videre\b/i
 ];
 for(const story of stories){
   if (isIceHockeyNews(story.title, story.summary, story.sources?.[0]?.url) || isIceHockeyNews(story.title, story.aiSummary)) continue;
   const source=story.sources?.[0];
   let key="";
   if(source?.url){
     try { const u=new URL(source.url); key=u.hostname.toLowerCase()+u.pathname.replace(/\/$/,"").toLowerCase(); }
     catch { key=""; }
   }
   // Only deduplicate confident same-URL items; leave distinct coverage intact.
   if(key && seen.has(key)){repairs.duplicate++;continue;}
   if(key)seen.add(key);
   let summary=story.summary || "";
   for(const pattern of cutPatterns){
     const match=pattern.exec(summary);
     if(match && match.index>0 && match.index<summary.length){
       summary=summary.slice(0,match.index).trim();
     }
   }
   if(summary!==story.summary && summary.length>20)repairs.boilerplate++;
   else summary=story.summary;
   let imageUrl=story.imageUrl;
   if(imageUrl){
     try {
       const path=decodeURIComponent(new URL(imageUrl).pathname);
       if(genericPicture.test(path)){imageUrl=undefined;repairs.genericImage++;}
     }catch{imageUrl=undefined;repairs.genericImage++;}
   }
   const verification = story.verification === "confirmed" && story.sources.length < 2 ? "unverified" : story.verification;
   if (verification !== story.verification) repairs.verification++;
   result.push({...story,summary,imageUrl,verification});
 }
 return {stories:result,repairs};
}

/** Suppress same-publisher duplicate versions after summary readiness.
 * Preserve independent coverage and avoid fuzzy matching across publication windows.
 */
export function deduplicatePublisherHeadlines<T extends Story>(stories: T[]): T[] {
  const normalize = (value: string) => value.normalize("NFKC").toLocaleLowerCase("da-DK").replace(/\s+/g, " ").trim();
  const stop = new Set("artiklen nyheden skribenten teksten klumme beskriver kritiserer ifølge handler medier mediet dagens denne dette deres bliver været være også ikke eller mens hvor hvordan efter under over som der det den til for med fra ved har om og på af en et at i er".split(" "));
  const tokens = (value: string) => new Set((normalize(value).match(/[\p{L}\p{N}]+/gu) || []).filter(word => word.length >= 4 && !stop.has(word)));
  const overlap = (a: Set<string>, b: Set<string>) => [...a].filter(word => b.has(word));
  const urlKey = (story: Story) => {
    try {
      const url = new URL(story.sources?.[0]?.url || "");
      const articleId = politikenArticleId(url);
      if (articleId) return `politiken.dk/art${articleId}`;
      return url.hostname.replace(/^www\./i, "").toLowerCase() + url.pathname.replace(/\/$/, "");
    } catch { return ""; }
  };
  const seen = new Map<string, { title: string; time: number; url: string; titleWords: Set<string>; texts: Set<string>[] }[]>();
  return stories.filter(story => {
    if (isIceHockeyNews(story.title, story.summary, story.sources?.[0]?.url) || isIceHockeyNews(story.title, story.aiSummary)) return false;
    const publisher = normalize(canonicalMediaName(story.sources?.[0]?.label || story.sourceLabel || "", story.sources?.[0]?.url));
    const title = normalize(story.title || "");
    const time = story.publishedAt ? Date.parse(story.publishedAt) : NaN;
    if (!publisher || publisher === "ukendt kilde") return true;
    const url = urlKey(story);
    const titleWords = tokens(title);
    const texts = [story.summary || "", story.aiSummary || ""].map(tokens).filter(words => words.size >= 8);
    const previous = seen.get(publisher) || [];
    const duplicate = previous.some(item => {
      if (url && item.url === url) return true;
      if (!Number.isFinite(time) || !Number.isFinite(item.time)) return false;
      // Strict display rule: one story per canonical publisher and absolute minute.
      // Keep the first eligible version; do not delete the stored original.
      if (Math.floor(time / 60_000) === Math.floor(item.time / 60_000)) return true;
      const elapsed = Math.abs(time - item.time);
      if (elapsed <= 60 * 60_000 && title.length >= 24 && title === item.title) return true;
      if (elapsed > 10 * 60_000) return false;
      const anchors = overlap(titleWords, item.titleWords).filter(word => word.length >= 5 && !tokens(publisher).has(word));
      return texts.some(a => item.texts.some(b => {
        const shared = overlap(a, b);
        const containment = shared.length / Math.min(a.size, b.size);
        const jaccard = shared.length / (a.size + b.size - shared.length);
        // Different headlines require both a shared subject and substantial
        // editorial-text agreement; generic publisher names are not anchors.
        return shared.length >= 7 && containment >= 0.50 && jaccard >= 0.34 &&
          anchors.some(word => a.has(word) && b.has(word));
      }));
    });
    if (duplicate) return false;
    previous.push({ title, time, url, titleWords, texts });
    seen.set(publisher, previous);
    return true;
  });
}

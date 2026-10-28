import type { Story } from "./stories";


export type QualityIssue = "short_text" | "publisher_ui" | "generic_image" | "missing_image" | "invalid_date" | "future_date" | "duplicate";
export type QualityFinding = { id: string; source: string; issues: QualityIssue[] };
export type QualityReport = { checked: number; issueCounts: Record<QualityIssue, number>; examples: QualityFinding[] };

const uiPattern = /\b(?:opret et personligt gavelink|log ind for at følge|gratis prøve beder vi dig|angiver du ingeniøren som foretrukken kilde|kunne ikke generere link|bliv abonnent for at læse videre)\b/i;
const genericPicture = /(?:^|[-_\/.])(?:default|placeholder|fallback|generic|standard|nyhedsgrafik|verdenskort|jordklode|logo|favicon)(?:[-_\/.]|$)/i;
const issueTypes: QualityIssue[] = ["short_text","publisher_ui","generic_image","missing_image","invalid_date","future_date","duplicate"];
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
 const repairs={ boilerplate:0,genericImage:0,duplicate:0 };
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
   result.push({...story,summary,imageUrl});
 }
 return {stories:result,repairs};
}

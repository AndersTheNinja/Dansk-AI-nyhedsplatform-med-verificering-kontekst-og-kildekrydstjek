import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const hosts = new Set(["dr.dk","www.dr.dk","politiken.dk","www.politiken.dk","borsen.dk","www.borsen.dk","stiften.dk","www.stiften.dk","migogaarhus.dk","www.migogaarhus.dk","tv2.dk","www.tv2.dk","nyheder.tv2.dk","berlingske.dk","www.berlingske.dk","journalisten.dk","www.journalisten.dk","altinget.dk","www.altinget.dk","version2.dk","www.version2.dk","ing.dk","www.ing.dk","computerworld.dk","www.computerworld.dk","techsavvy.media","www.techsavvy.media"]);

function clean(value: string) {
  return value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ")
    .replace(/<(?:style|noscript|svg|figure|figcaption|aside|nav|header|footer)\b[^>]*>[\s\S]*?<\/(?:style|noscript|svg|figure|figcaption|aside|nav|header|footer)>/gi," ")
    .replace(/<[^>]+>/g," ")
    .replace(/&#x([0-9a-f]+);/gi,(_,n:string)=>String.fromCodePoint(parseInt(n,16)))
    .replace(/&#(\d+);/g,(_,n:string)=>String.fromCodePoint(parseInt(n,10)))
    .replace(/&(?:nbsp|amp|quot|apos|lt|gt);/gi,(v)=>({"&nbsp;":" ","&amp;":"&","&quot;":'"',"&apos;":"'","&lt;":"<","&gt;":">"}[v.toLowerCase()]||v))
    .replace(/\\n|\\t/g," ").replace(/\s+/g," ").trim();
}
function editorial(html:string) {
  return html
    .replace(/<(?:script|style|noscript|svg|figure|figcaption|aside|nav|header|footer)\b[^>]*>[\s\S]*?<\/(?:script|style|noscript|svg|figure|figcaption|aside|nav|header|footer)>/gi," ")
    .replace(/<([a-z][\w-]*)\b[^>]*(?:class|data-testid)=["'][^"']*(?:caption|photo-credit|related-articles|related-stories|recommended|advert|paywall|newsletter)[^"']*["'][^>]*>[\s\S]*?<\/\1\s*>/gi," ");
}
function editorialParagraphs(html:string) {
 const paragraphs=Array.from(html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi))
  .map(match=>clean(match[1]||""))
  .filter(text=>text.length>=35 && !/^(?:Læs også|Læs mere|Annonce|Foto:|Abonnér|Tilmeld nyhedsbrev)/i.test(text));
 return paragraphs.join(" ");
}
function jsonBody(html:string) {
 const match=html.match(/"articleBody"\s*:\s*"((?:\\.|[^"\\])*)"/i);
 if(!match)return "";
 try{return clean(JSON.parse('"'+match[1]+'"'));}catch{return "";}
}
function titleMatches(title:string,html:string) {
 const tags=html.match(/<meta\b[^>]*>/gi)||[];
 const ogTitle=tags.map(tag=>{
  const identity=tag.match(/(?:property|name)\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();
  return identity==="og:title"||identity==="twitter:title"
   ? tag.match(/\bcontent\s*=\s*["']([^"']+)["']/i)?.[1]||"" : "";
 }).find(Boolean);
 const actual=ogTitle || html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "";
 const tokenize=(s:string)=>new Set(clean(s).toLocaleLowerCase("da-DK").replace(/[^a-z0-9æøå]+/g," ").split(/\s+/).filter(x=>x.length>=4));
 const expected=tokenize(title),received=tokenize(actual);
 if(!expected.size||!received.size)return false;
 const matching=[...expected].filter(x=>received.has(x)).length;
 return matching>=Math.min(2,expected.size)&&matching/Math.min(expected.size,received.size)>=0.6;
}

export async function POST(request:Request) {
 try {
  const body=await request.json();
  const url=new URL(String(body?.url||""));
  const title=String(body?.title||"").slice(0,300);
  if(url.protocol!=="https:"||!hosts.has(url.hostname)||url.username||url.password||title.length<8)return NextResponse.json({excerpt:null,hasMore:null},{status:400});
  const response=await fetch(url.toString(),{redirect:"follow",next:{revalidate:900},headers:{"Accept":"text/html,application/xhtml+xml","User-Agent":"Mozilla/5.0 (compatible; OEL.dk/1.0)"},signal:AbortSignal.timeout(4500)});
  if(!response.ok||!(response.headers.get("content-type")||"").includes("text/html"))return NextResponse.json({excerpt:null,hasMore:null});
  const html=(await response.text()).slice(0,750000);
  if(!titleMatches(title,html))return NextResponse.json({excerpt:null,hasMore:null});
  // Only an article-scoped body or explicitly identified articleBody is safe.
  const bodyText=jsonBody(html);
  // Børsen, Politiken and Berlingske may wrap the editorial body in
  // different containers. Accept only article-scoped text: no page-wide
  // paragraph scraping, which could include recommendations.
  const article=html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1]||"";
  const scoped=article?editorial(article):"";
  const paragraphs=scoped?editorialParagraphs(scoped):"";
  const publisher=url.hostname.replace(/^www\./,"");
  const restrictedPublisher=["borsen.dk","politiken.dk","berlingske.dk"].includes(publisher);
  // For these sites reject a body that appears to consist mainly of
  // paywall/navigation prompts rather than actual article paragraphs.
  const suspicious=/\b(?:bliv abonnent|opret abonnement|log ind for at læse|få fuld adgang|mest læste artikler)\b/i;
  const cleanedBody=restrictedPublisher&&suspicious.test(bodyText.slice(0,220))?"":bodyText;
  const cleanedParagraphs=restrictedPublisher&&suspicious.test(paragraphs.slice(0,220))?"":paragraphs;
  // Prefer articleBody where available. Otherwise use only editorial paragraphs
  // inside the article element, never generic navigation/main page text.
  const selected=cleanedBody.length>=120?cleanedBody:cleanedParagraphs.length>=120?cleanedParagraphs:"";
  if(!selected)return NextResponse.json({excerpt:null,hasMore:null});
  const words=selected.split(/\s+/).filter(Boolean);
  return NextResponse.json({excerpt:words.slice(0,100).join(" "),hasMore:words.length>100,wordCount:words.length},{headers:{"Cache-Control":"private, max-age=900"}});
 }catch{return NextResponse.json({excerpt:null,hasMore:null});}
}

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
function jsonBody(html:string) {
 const match=html.match(/"articleBody"\s*:\s*"((?:\\.|[^"\\])*)"/i);
 if(!match)return "";
 try{return clean(JSON.parse('"'+match[1]+'"'));}catch{return "";}
}
function titleMatches(title:string,html:string) {
 const actual=html.match(/<meta\b[^>]*(?:property|name)=["']og:title["'][^>]*content=["']([^"']+)/i)?.[1] ||
 html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "";
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
  const article=html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1]||"";
  const articleText=article?clean(article):"";
  const selected=bodyText.length>=120?bodyText:articleText.length>=120?articleText:"";
  if(!selected)return NextResponse.json({excerpt:null,hasMore:null});
  const words=selected.split(/\s+/).filter(Boolean);
  return NextResponse.json({excerpt:words.slice(0,100).join(" "),hasMore:words.length>100,wordCount:words.length},{headers:{"Cache-Control":"private, max-age=900"}});
 }catch{return NextResponse.json({excerpt:null,hasMore:null});}
}

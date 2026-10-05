import { concertArtists } from "@/data/concert-artists";
import { getCalendarBrief } from "@/lib/morgenpakke-calendar";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 300;

const TO = process.env.MORGENPAKKE_TO || "info@agronborg.dk";
const FROM = process.env.MORGENPAKKE_FROM || "onboarding@resend.dev";

function copenhagenDate() {
  const parts = new Intl.DateTimeFormat("da-DK", {
    timeZone: "Europe/Copenhagen", day: "2-digit", month: "2-digit", year: "numeric"
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
  return { display: `${get("day")}-${get("month")}-${get("year")}`, iso: `${get("year")}-${get("month")}-${get("day")}` };
}

function runningDay(iso: string) {
  const base = Date.UTC(2026, 8, 25);
  const [y,m,d] = iso.split("-").map(Number);
  return 2170 + Math.round((Date.UTC(y,m-1,d)-base)/86400000);
}

async function ai(prompt: string) {
  const key=process.env.OPENAI_API_KEY, model=process.env.OPENAI_MODEL;
  if (!key || !model) throw new Error("OPENAI_API_KEY/OPENAI_MODEL mangler");
  const r=await fetch("https://api.openai.com/v1/responses",{
    method:"POST", headers:{"Content-Type":"application/json",Authorization:`Bearer ${key}`},
    body:JSON.stringify({model,input:prompt,tools:[{type:"web_search"}],max_output_tokens:3500})
  });
  if(!r.ok) throw new Error(`OpenAI ${r.status}: ${(await r.text()).slice(0,500)}`);
  const data=await r.json();
  return data.output_text ?? data.output?.flatMap((x:any)=>x.content??[]).find((x:any)=>x.type==="output_text")?.text ?? "";
}

async function send(subject:string, html:string, key:string) {
  const apiKey=process.env.RESEND_API_KEY;
  if(!apiKey) throw new Error("RESEND_API_KEY mangler");
  const r=await fetch("https://api.resend.com/emails",{
    method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${apiKey}`,"Idempotency-Key":key},
    body:JSON.stringify({from:FROM,to:[TO],subject,html})
  });
  if(!r.ok) throw new Error(`Resend ${r.status}: ${(await r.text()).slice(0,500)}`);
  return r.json();
}

function html(text:string){return `<div style="font-family:Arial,sans-serif;line-height:1.5;max-width:760px">${text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\n/g,"<br>")}</div>`}

export async function GET(req:NextRequest){
  const secret=process.env.CRON_SECRET;
  const auth=req.headers.get("authorization");
  if(!secret || auth!==`Bearer ${secret}`) return NextResponse.json({error:"Unauthorized"},{status:401});

  const localHour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Copenhagen", hour: "2-digit", hour12: false }).format(new Date()));
  const manual = req.nextUrl.searchParams.get("manual") === "1";
  if (!manual && localHour !== 7) {
    return NextResponse.json({ skipped: true, reason: "Not 07:xx Europe/Copenhagen", localHour });
  }

  const date=copenhagenDate();
  const run=runningDay(date.iso);
  const years=(run/365.2425).toFixed(2).replace(".",",");
  const results:any[]=[];

  const jobs=[
    {
      id:"news", subject:`Morgenbriefing – ${date.display}`,
      make:()=>ai(`Lav dagens danske morgenbriefing med PRÆCIS 5 aktuelle historier. Fokus: AI/tech/nye forretningsmodeller, dansk erhverv/startups og Aarhus/lokalpolitik/lokale nyheder. Prioritér Danmark og tidlige handlingsrelevante signaler. For hver: overskrift, 3-6 linjers resumé, 1-2 linjer HVORFOR RELEVANT, status som enten ✅ Bekræftet, ⚠️ Delvist bekræftet / nuancer kræves eller ❓ Ikke tilstrækkeligt verificeret, samt kilder. Brug web search og krydstjek primærkilde + uafhængig kilde når muligt. Dato: ${date.iso}. Skriv på dansk.`)
    },
    {
      id:"running", subject:`Løbedag – ${date.display}`,
      make:async()=>`Kære Anders, i dag er løbedag nr. ${run} – svarende til ${years} år.`
    },
    {
      id:"concerts", subject:"Europa koncertalarm – næste 30 dage",
      make:()=>ai(`Find offentligt annoncerede koncerter i Europa de næste 30 dage for kunstnere på MORGENPAKKE_CONCERT_ARTISTS-listen nedenfor. Brug officielle artist/tour-sider, venues/festivaler og primære billetudbydere; krydstjek når muligt; dedupliker. Formatér hver: ARTISTNAVN, BY / DATO, BILLET: direkte officielt billet/event-link, separator. Hvis ingen findes, sig det klart. Skriv på dansk. Liste: ${concertArtists.join(", ")}`)
    },
    {
      id:"calendar", subject:`Kalender – ${date.display}`,
      make:()=>getCalendarBrief(date.iso)
    }
  ];

  for(const job of jobs){
    try{
      const body=await job.make();
      const sent=await send(job.subject,html(body),`morgenpakke-${date.iso}-${job.id}`);
      results.push({id:job.id,ok:true,emailId:sent.id});
    }catch(e:any){
      console.error("MORGENPAKKE",job.id,e);
      results.push({id:job.id,ok:false,error:String(e?.message||e).slice(0,500)});
    }
  }
  return NextResponse.json({date:date.iso,results});
}

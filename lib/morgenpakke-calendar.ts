import { GoogleAuth } from "google-auth-library";

const SPREADSHEET_ID = "1nBqvucbo4xkXi-inIN4jICdENzrkPIh94qthEiDHs90";

function dates(iso:string){
  const [y,m,d]=iso.split("-").map(Number);
  return Array.from({length:3},(_,i)=>{
    const x=new Date(Date.UTC(y,m-1,d+i));
    return `${String(x.getUTCDate()).padStart(2,"0")}-${String(x.getUTCMonth()+1).padStart(2,"0")}-${x.getUTCFullYear()}`;
  });
}

export async function getCalendarBrief(iso:string){
  const raw=process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if(!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON mangler");
  const credentials=JSON.parse(raw);
  const auth=new GoogleAuth({credentials,scopes:["https://www.googleapis.com/auth/spreadsheets.readonly"]});
  const client=await auth.getClient();
  const token=await client.getAccessToken();
  if(!token.token) throw new Error("Google access token mangler");
  const range=encodeURIComponent("KALENDER!A1:Z500");
  const r=await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}`,{headers:{Authorization:`Bearer ${token.token}`}});
  if(!r.ok) throw new Error(`Google Sheets ${r.status}: ${(await r.text()).slice(0,300)}`);
  const values=((await r.json()).values||[]) as unknown[][];
  const wanted=new Set(dates(iso));
  const rows=values.filter(row=>row.some(cell=>wanted.has(String(cell).trim())));
  if(!rows.length) return "Ingen kalenderposter fundet for i dag og de næste to dage.";
  return rows.map(row=>{
    const i=row.findIndex(cell=>wanted.has(String(cell).trim()));
    const date=String(row[i]||"");
    const day=String(row[i+1]||"");
    const helper=String(row[i-1]||"").trim();
    const notes=row.slice(i+2).filter(Boolean).map(String).join(" – ");
    return [`${date} ${day}`,helper?`Hjælp: ${helper}`:"",notes].filter(Boolean).join("\n");
  }).join("\n\n");
}

import type { Story } from "./stories";

// Strictly limit outgoing checks to known image-provider domains.
const hosts = ["dr.dk","tv2i.dk","borsen.dk","bmcdn.dk","politiken.dk","jfmedier.dk","jfm.dk","stiften.dk","ing.dk","computerworld.dk","techsavvy.media","journalisten.dk","berlingske.dk","migogaarhus.dk","version2.dk","altinget.dk","y.dk","cloudfront.net"];
type Verdict = "valid" | "invalid" | "unknown";
const checks = new Map<string, { verdict: Verdict; until: number }>();
function allowed(url: URL) {
  return url.protocol === "https:" && !url.port && !url.username && !url.password &&
    hosts.some(host => url.hostname === host || url.hostname.endsWith("." + host));
}
async function probe(raw: string): Promise<Verdict> {
  let url: URL;
  try { url = new URL(raw); } catch { return "invalid"; }
  if (!allowed(url)) return "unknown";
  const cached = checks.get(url.href);
  if (cached && cached.until > Date.now()) return cached.verdict;
  let verdict: Verdict = "unknown";
  try {
    const response = await fetch(url, {
      method: "GET", redirect: "manual", cache: "no-store",
      headers: { Range: "bytes=0-31", Accept: "image/avif,image/webp,image/png,image/jpeg,image/gif" },
      signal: AbortSignal.timeout(3000)
    });
    if (response.status === 404 || response.status === 410) verdict = "invalid";
    else if (response.status === 200 || response.status === 206) {
      const type = response.headers.get("content-type") || "";
      if (/^text\/html(?:;|$)/i.test(type) || /^application\/json(?:;|$)/i.test(type)) verdict = "invalid";
      else if (/^image\/(?:jpeg|png|webp|gif|avif)(?:;|$)/i.test(type)) {
        const reader = response.body?.getReader();
        if (reader) {
          const first = await reader.read();
          await reader.cancel().catch(() => {});
          const b = first.value;
          if (b && b.length >= 4) {
            const ascii = (a: number,z: number) => String.fromCharCode(...b.slice(a,z));
            verdict = (b[0]===255 && b[1]===216 && b[2]===255) ||
              (b[0]===137 && ascii(1,4)==="PNG") ||
              (ascii(0,4)==="RIFF" && ascii(8,12)==="WEBP") ||
              ascii(0,3)==="GIF" ||
              (ascii(4,8)==="ftyp" && /^(avif|avis)$/i.test(ascii(8,12)))
              ? "valid" : "invalid";
          }
        }
      }
    }
    await response.body?.cancel().catch(() => {});
  } catch { /* Timeouts and blocked image CDNs are not proof of dead links. */ }
  if (checks.size > 500) checks.clear();
  checks.set(url.href,{ verdict, until: Date.now() + (verdict === "unknown" ? 120_000 : 900_000) });
  return verdict;
}

/** Bounded scheduled-only checks; never slow down public feed requests. */
export async function auditCurrentImageLinks(stories: Story[], limit = 24): Promise<{
  stories: Story[]; checked: number; invalid: number; uncertain: number;
}> {
  const selected = stories.slice(0,limit);
  const verdicts = new Map<string,Verdict>();
  const candidates = [...new Set(selected.map(story => story.imageUrl).filter((v):v is string => Boolean(v)))];
  for(let i=0;i<candidates.length;i+=6) {
    await Promise.all(candidates.slice(i,i+6).map(async url => {
      verdicts.set(url,await probe(url));
    }));
  }
  const invalid = candidates.filter(url=>verdicts.get(url)==="invalid").length;
  const uncertain = candidates.filter(url=>verdicts.get(url)==="unknown").length;
  return {
    stories: stories.map((story,i) => i<limit && story.imageUrl && verdicts.get(story.imageUrl)==="invalid"
      ? {...story,imageUrl:undefined} : story),
    checked:candidates.length,invalid,uncertain
  };
}

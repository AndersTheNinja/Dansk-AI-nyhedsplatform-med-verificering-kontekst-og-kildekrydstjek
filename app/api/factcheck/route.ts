import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { runFactCheck, publicSourceUrl, type FactArticle, type FactResult } from '@/lib/factcheck';

export const maxDuration = 90;
const cache = new Map<string, { expires: number; result: FactResult }>();
const pending = new Map<string, Promise<FactResult>>();
const ttl = 15 * 60 * 1000;

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Ugyldig forespørgsel.' }, { status: 400 }); }
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Artikeldata mangler.' }, { status: 400 });
  const article: FactArticle = {
    title: String(body.title ?? '').trim().slice(0, 500), text: String(body.text ?? '').trim().slice(0, 4500),
    url: publicSourceUrl(body.url || body.sources?.[0]?.url) || '', publishedAt: String(body.publishedAt ?? '').slice(0, 50), primarySource: String(body.primarySource ?? '').slice(0, 120)
  };
  if (article.title.length < 8 || article.text.length < 20) return NextResponse.json({ error: 'Der er for lidt artikeltekst til et faktatjek.' }, { status: 400 });
  if (!article.url) return NextResponse.json({ error: 'Artiklens offentlige kildehenvisning mangler.' }, { status: 400 });
  const key = process.env.OPENAI_API_KEY, model = process.env.OPENAI_FACTCHECK_MODEL || process.env.OPENAI_MODEL;
  if (!key || !model) return NextResponse.json({ error: 'Faktatjek er ikke aktiveret.' }, { status: 503 });
  const hash = createHash('sha256').update(JSON.stringify({ article, model, version: 3 })).digest('hex');
  const hit = cache.get(hash);
  if (hit && hit.expires > Date.now()) return NextResponse.json(hit.result);
  if (!pending.has(hash) && pending.size >= 8) return NextResponse.json({ error: 'Der er mange faktatjek i gang. Prøv igen om lidt.' }, { status: 429 });
  let work = pending.get(hash);
  if (!work) {
    work = runFactCheck(article, { key, model }).then(result => {
      for (const [id, value] of cache) if (value.expires <= Date.now()) cache.delete(id);
      if (cache.size >= 64) cache.delete(cache.keys().next().value!);
      cache.set(hash, { expires: Date.now() + ttl, result }); return result;
    }).finally(() => pending.delete(hash));
    pending.set(hash, work);
  }
  try { return NextResponse.json(await work); }
  catch (error) {
    const message = error instanceof Error && !['TimeoutError', 'AbortError'].includes(error.name) ? error.message : 'Faktatjekket tog for lang tid. Prøv igen.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

import { NextRequest, NextResponse } from "next/server";

const ALLOWED_HOSTS = new Set([
  "dr.dk","www.dr.dk","politiken.dk","www.politiken.dk","version2.dk","www.version2.dk",
  "ing.dk","www.ing.dk","computerworld.dk","www.computerworld.dk","techsavvy.media","www.techsavvy.media",
  "altinget.dk","www.altinget.dk","nordjyske.dk","www.nordjyske.dk","fyens.dk","www.fyens.dk",
  "jv.dk","www.jv.dk","hsfo.dk","www.hsfo.dk","frdb.dk","www.frdb.dk","journalisten.dk","www.journalisten.dk",
  "berlingske.dk","www.berlingske.dk","borsen.dk","www.borsen.dk"
]);

function decodeHtml(value: string) {
  const named: Record<string, string> = {
    amp: "&", quot: '"', apos: "'", nbsp: " ", lt: "<", gt: ">"
  };

  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num: string) => String.fromCodePoint(parseInt(num, 10)))
    .replace(/&([a-z]+);/gi, (match, name: string) => named[name.toLowerCase()] ?? match);
}

function looksLikePaywall(html: string) {
  const sample = html.slice(0, 500000).toLowerCase();
  const strongSignals = [
    /"isaccessibleforfree"\s*:\s*false/,
    /kun for abonnenter/,
    /kræver abonnement/,
    /abonnement kræves/,
    /log ind for at læse videre/,
    /bliv abonnent for at læse/,
    /læs videre med abonnement/
  ];
  return strongSignals.some((pattern) => pattern.test(sample));
}

function cleanText(value: string) {
  return decodeHtml(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\\u003c/gi, "<")
    .replace(/\\u003e/gi, ">")
    .replace(/\\n/g, " ")
    .replace(/\\t/g, " ")
    .replace(/\\"/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function extractArticleText(html: string) {
  const articleBodyMatch = html.match(/"articleBody"\s*:\s*"((?:\\.|[^"\\])*)"/i);
  if (articleBodyMatch?.[1]) {
    const text = cleanText(articleBodyMatch[1]);
    if (text.length > 700) return text;
  }

  const articleMatch = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  if (articleMatch?.[1]) {
    const text = cleanText(articleMatch[1]);
    if (text.length > 700) return text;
  }

  const mainMatch = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch?.[1]) {
    const text = cleanText(mainMatch[1]);
    if (text.length > 700) return text;
  }

  const paragraphs = Array.from(html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi))
    .map((match) => cleanText(match[1] || ""))
    .filter((text) => text.length > 45)
    .join(" ");
  if (paragraphs.length > 500) return paragraphs;

  const description =
    html.match(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["'](?:description|og:description)["']/i)?.[1] ||
    "";
  return cleanText(description);
}

function parseSummary(text: string) {
  const cleaned = text.trim().replace(/^\`\`\`(?:json)?/i, "").replace(/\`\`\`$/i, "").trim();
  const parsed = JSON.parse(cleaned);
  return {
    summary: String(parsed.summary ?? "").slice(0, 1600),
    bullets: Array.isArray(parsed.bullets) ? parsed.bullets.slice(0, 4).map(String) : []
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;

  if (!apiKey || !model) {
    return NextResponse.json({ error: "AI-resumé er ikke aktiveret." }, { status: 503 });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(String(body.url ?? ""));
  } catch {
    return NextResponse.json({ error: "Ugyldigt artikel-link." }, { status: 400 });
  }

  if (parsedUrl.protocol !== "https:" || !ALLOWED_HOSTS.has(parsedUrl.hostname)) {
    return NextResponse.json({ error: "Denne kilde understøttes ikke endnu." }, { status: 400 });
  }

  try {
    const feedText = String(body.feedText ?? "").slice(0, 2500);
    let articleText = "";
    let basis = "det frit tilgængelige artikeluddrag";
    let articleFetched = false;

    try {
      const articleResponse = await fetch(parsedUrl.toString(), {
        redirect: "follow",
        cache: "no-store",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; KONTEKST/0.8)",
          Accept: "text/html,application/xhtml+xml"
        },
        signal: AbortSignal.timeout(8000)
      });

      if (articleResponse.ok) {
        const html = await articleResponse.text();
        const paywall = looksLikePaywall(html);
        const extracted = extractArticleText(html).slice(0, 14000);

        if (!paywall && extracted.length >= 500) {
          articleText = extracted;
          basis = "frit tilgængelig artikeltekst";
          articleFetched = true;
        }
      }
    } catch {
      // Fall back to feed text below.
    }

    if (!articleFetched && feedText.length >= 120) {
      articleText = feedText;
      basis = "det frit tilgængelige artikeluddrag";
    }

    if (articleText.length < 120) {
      return NextResponse.json(
        { error: "Der var ikke nok frit tilgængelig tekst til at lave et pålideligt resumé." },
        { status: 422 }
      );
    }

    const title = String(body.title ?? "").slice(0, 500);
    const source = String(body.source ?? "").slice(0, 120);

    const prompt = `Du laver et kort, neutralt dansk nyhedsresumé til KONTEKST.
Brug kun oplysninger fra artikelteksten. Tilføj intet, som ikke står i teksten.
Skriv ikke lange citater og gengiv ikke artiklen. Opsummer selvstændigt.

Returnér KUN gyldig JSON:
{
  "summary": "3-5 korte sætninger med historiens vigtigste indhold",
  "bullets": ["2-4 meget korte nøglepunkter"]
}

Kilde: ${source}
Overskrift: ${title}
Artikeltekst:
${articleText}`;

    const aiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        input: prompt,
        max_output_tokens: 650
      })
    });

    if (!aiResponse.ok) {
      return NextResponse.json({ error: "AI-tjenesten kunne ikke lave resuméet." }, { status: 502 });
    }

    const data = await aiResponse.json();
    const output =
      data.output_text ??
      data.output?.flatMap((x: any) => x.content ?? []).find((x: any) => x.type === "output_text")?.text ??
      "";

    return NextResponse.json({ ...parseSummary(output), basis });
  } catch {
    return NextResponse.json({ error: "Artiklen kunne ikke behandles." }, { status: 502 });
  }
}

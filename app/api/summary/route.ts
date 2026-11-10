import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";

const ALLOWED_HOSTS = new Set([
  "dr.dk","www.dr.dk","politiken.dk","www.politiken.dk","version2.dk","www.version2.dk",
  "ing.dk","www.ing.dk","computerworld.dk","www.computerworld.dk","techsavvy.media","www.techsavvy.media",
  "altinget.dk","www.altinget.dk","nordjyske.dk","www.nordjyske.dk","fyens.dk","www.fyens.dk",
  "jv.dk","www.jv.dk","hsfo.dk","www.hsfo.dk","frdb.dk","www.frdb.dk","journalisten.dk","www.journalisten.dk",
  "berlingske.dk","www.berlingske.dk","borsen.dk","www.borsen.dk",
  "stiften.dk","www.stiften.dk","migogaarhus.dk","www.migogaarhus.dk","tv2.dk","www.tv2.dk"
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

function normalizeSummaryText(value: string) {
  let text = value
    .replace(/^\s*(?:resumé|resume|summary)\s*:\s*/i, "")
    .replace(/^\s*[-*•]\s*/gm, "")
    .replace(/\s+/g, " ")
    .trim();

  // Never cut the visible summary in the middle of a sentence.
  if (text.length > 1800) {
    const candidate = text.slice(0, 1800);
    const matches = Array.from(candidate.matchAll(/[.!?](?:["”’])?(?=\s|$)/g));
    const last = matches.at(-1);
    if (last?.index !== undefined && last.index > 200) {
      text = candidate.slice(0, last.index + last[0].length).trim();
    } else {
      text = candidate.trim();
    }
  }

  // A model occasionally returns a perfectly readable final clause without
  // punctuation. Add punctuation only when the text is otherwise intact.
  if (text && !/[.!?]["”’]?$/.test(text) && !/[,:;–—-]$/.test(text)) {
    text += ".";
  }

  return text;
}

function summaryLooksReadable(text: string) {
  if (text.length < 90) return false;
  if (/\b(?:undefined|null|NaN)\b/i.test(text)) return false;
  if (/^[-*•]|\n[-*•]/m.test(text)) return false;
  if (/[,:;–—-]$/.test(text)) return false;

  const sentenceEnds = text.match(/[.!?](?:["”’])?(?=\s|$)/g) || [];
  return sentenceEnds.length >= 2 && sentenceEnds.length <= 8;
}

function parseSummary(text: string) {
  const cleaned = text
    .trim()
    .replace(/^\`\`\`(?:json|text)?/i, "")
    .replace(/\`\`\`$/i, "")
    .trim();

  if (!cleaned) throw new Error("Tomt AI-svar");

  // Resumé-prompten beder om almindelig tekst. Hvis en model alligevel
  // returnerer JSON, accepterer vi det også.
  if (cleaned.startsWith("{")) {
    try {
      const parsed = JSON.parse(cleaned);
      const summary = normalizeSummaryText(String(parsed.summary ?? parsed.text ?? ""));
      if (summary) {
        return {
          summary,
          bullets: Array.isArray(parsed.bullets) ? parsed.bullets.slice(0, 4).map(String) : []
        };
      }
    } catch {
      // Fall through: malformed JSON-looking output is still useful as text.
    }
  }

  return {
    summary: normalizeSummaryText(cleaned),
    bullets: []
  };
}

async function generateSummary(req: NextRequest) {
  const body = await req.json();
  const apiKey = process.env.OPENAI_API_KEY;
  const preferredModel = process.env.OPENAI_MODEL || "gpt-6-luna";

  if (!apiKey) {
    return NextResponse.json({ error: "Resumé er ikke aktiveret: OPENAI_API_KEY mangler." }, { status: 503 });
  }

  let parsedUrl: URL | null = null;
  try {
    const candidate = new URL(String(body.url ?? ""));
    if (candidate.protocol === "https:" && ALLOWED_HOSTS.has(candidate.hostname)) {
      parsedUrl = candidate;
    }
  } catch {
    parsedUrl = null;
  }

  try {
    const title = String(body.title ?? "").slice(0, 500);
    const feedText = String(body.feedText ?? "").slice(0, 2500);
    let articleText = "";
    let basis = "overskrift og tilgængeligt uddrag";
    let basisType: "article_text" | "excerpt" = "excerpt";
    let articleTruncated = false;
    let articleFetched = false;

    try {
      if (!parsedUrl) throw new Error("Article host not eligible for direct fetch");
      const articleResponse = await fetch(parsedUrl.toString(), {
        redirect: "follow",
        cache: "no-store",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; KONTEKST/0.8)",
          Accept: "text/html,application/xhtml+xml"
        },
        signal: AbortSignal.timeout(4000)
      });

      if (articleResponse.ok) {
        const html = await articleResponse.text();
        const paywall = looksLikePaywall(html);
        let fullExtracted = extractArticleText(html);
        // Stiften/JFM loads public article paragraphs separately. The visible
        // article body is more informative than the page's metadata teaser.
        if (!paywall && /^(?:www\\.)?stiften\\.dk$/i.test(parsedUrl.hostname)) {
          const asyncPath = html.match(/data-load-async-url=["']([^"']+)["']/i)?.[1];
          if (asyncPath) {
            try {
              const asyncUrl = new URL(asyncPath.replace(/&amp;/g, "&"), parsedUrl);
              if (asyncUrl.protocol === "https:" && asyncUrl.hostname === parsedUrl.hostname &&
                  !asyncUrl.username && !asyncUrl.password && !asyncUrl.port) {
                const fragmentResponse = await fetch(asyncUrl.toString(), {
                  headers: { Accept: "text/html,application/xhtml+xml,*/*" },
                  signal: AbortSignal.timeout(9000),
                  cache: "no-store"
                });
                if (fragmentResponse.ok && new URL(fragmentResponse.url).hostname === parsedUrl.hostname) {
                  const fragmentHtml = await fragmentResponse.text();
                  const editorial = fragmentHtml.replace(/<(?:script|style|nav|aside|footer|figure|figcaption)\b[^>]*>[\s\S]*?<\/(?:script|style|nav|aside|footer|figure|figcaption)>/gi, " ");
                  const paragraphs = Array.from(editorial.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi))
                    .map((match) => cleanText(match[1] || ""))
                    .filter((paragraph) => paragraph.length >= 35 && !/^(?:læs også|se også|annonce|bliv abonnent|log ind)\b/i.test(paragraph));
                  const unique = [...new Set(paragraphs)].join(" ");
                  if (unique.length > fullExtracted.length + 100) fullExtracted = unique;
                }
              }
            } catch {
              // Continue with verified page text or the feed excerpt.
            }
          }
        }
        articleTruncated = fullExtracted.length > 14000;
        const extracted = fullExtracted.slice(0, 14000);

        if (!paywall && extracted.length >= 500) {
          articleText = extracted;
          basisType = "article_text";
          basis = articleTruncated
            ? "uddrag af hentet artikeltekst (maks. 14.000 tegn)"
            : "hentet artikeltekst (hele artiklen er ikke nødvendigvis tilgængelig)";
          articleFetched = true;
        }
      }
    } catch {
      // Fall back to feed text below.
    }

    if (!articleFetched) {
      const fallbackText = [title, feedText].filter(Boolean).join(". ").trim();
      if (fallbackText.length >= 40) {
        articleText = fallbackText;
        basis = "overskrift og tilgængeligt uddrag";
        basisType = "excerpt";
        articleTruncated = false;
      }
    }

    if (articleText.length < 40) {
      return NextResponse.json(
        { error: "Der var ikke nok frit tilgængelig tekst til at lave et pålideligt resumé." },
        { status: 422 }
      );
    }

    const source = String(body.source ?? "").slice(0, 120);

    const prompt = `Du laver et kort, neutralt dansk nyhedsresumé til ØL.dk.
Brug kun oplysninger fra teksten nedenfor. Tilføj intet, som ikke fremgår af materialet.
Skriv 4 korte, sammenhængende og grammatisk komplette sætninger på naturligt dansk.\nSigt efter 60-85 ord totalt, så teksten kan tilpasses til omtrent fire linjer på desktop.\nSæt de vigtigste oplysninger i de første to sætninger, så en kort mobilversion også giver mening.
Hver sætning skal kunne læses og forstås selvstændigt. Undgå sætningsfragmenter, afbrudte
sætninger, gentagelser, reklame-/abonnementstekst og formuleringer, der ender midt i en tanke.
Afslut altid resuméet med en komplet sætning og korrekt tegnsætning.
Ingen markdown, ingen overskrift, ingen punktopstilling og ingen lange citater.
Gengiv ikke artiklen; opsummer den selvstændigt.

Kilde: ${source}
Overskrift: ${title}
Artikeltekst:
${articleText}`;

    const candidateModels = Array.from(new Set([
      preferredModel,
      "gpt-6-luna",
      "gpt-5.4-mini"
    ]));

    let lastError = "";
    let lastStatus = 502;
    let usedModel = candidateModels[0];

    for (const model of candidateModels) {
      usedModel = model;

      let aiResponse: Response;
      try {
        aiResponse = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model,
            input: prompt,
            max_output_tokens: 450
          }),
          signal: AbortSignal.timeout(20000)
        });
      } catch (error) {
        lastError = error instanceof Error ? error.message : "AI-kaldet fik timeout.";
        lastStatus = 504;
        continue;
      }

      if (!aiResponse.ok) {
        const detail = await aiResponse.text();
        lastStatus = aiResponse.status;
        lastError = detail;

        console.error("AI summary failed", {
          status: aiResponse.status,
          detail,
          model
        });

        // Authentication, billing and rate-limit errors are account-level.
        // Retrying another model will not help.
        if ([401, 403, 429].includes(aiResponse.status)) {
          let reason = "AI-tjenesten kunne ikke lave resuméet.";
          try {
            const parsed = JSON.parse(detail);
            const upstream = parsed?.error?.message;
            if (typeof upstream === "string" && upstream) reason = upstream;
          } catch {}

          return NextResponse.json(
            { error: reason, upstreamStatus: aiResponse.status, model },
            { status: 502 }
          );
        }

        // For model/parameter errors, try the next known-supported model.
        continue;
      }

      const data = await aiResponse.json();
      const contentItems = Array.isArray(data.output)
        ? data.output.flatMap((item: any) => Array.isArray(item?.content) ? item.content : [])
        : [];

      const output = [
        typeof data.output_text === "string" ? data.output_text : "",
        ...contentItems
          .filter((item: any) => item?.type === "output_text" || typeof item?.text === "string")
          .map((item: any) => typeof item?.text === "string" ? item.text : "")
      ].find((text) => typeof text === "string" && text.trim().length > 0) || "";

      if (!output.trim()) {
        lastStatus = 502;
        lastError = "OpenAI returnerede et tomt tekstsvar.";
        console.error("AI summary empty output", { model, data });
        continue;
      }

      try {
        let parsedSummary = parseSummary(output);

        // If the first model response is fragmented or malformed, ask once for
        // a grammatical rewrite instead of showing broken prose to the user.
        if (!summaryLooksReadable(parsedSummary.summary)) {
          const repairResponse = await fetch("https://api.openai.com/v1/responses", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model,
              input: `Omskriv teksten nedenfor til 3-5 korte, neutrale, grammatisk komplette danske sætninger.
Bevar kun oplysninger, der allerede står i teksten. Ingen overskrift, ingen punktopstilling,
ingen forkortede eller afbrudte sætninger. Afslut med en komplet sætning.

Tekst:
${parsedSummary.summary}`,
              max_output_tokens: 350
            }),
            signal: AbortSignal.timeout(15000)
          });

          if (repairResponse.ok) {
            const repairData = await repairResponse.json();
            const repairItems = Array.isArray(repairData.output)
              ? repairData.output.flatMap((item: any) => Array.isArray(item?.content) ? item.content : [])
              : [];
            const repairedOutput = [
              typeof repairData.output_text === "string" ? repairData.output_text : "",
              ...repairItems
                .filter((item: any) => item?.type === "output_text" || typeof item?.text === "string")
                .map((item: any) => typeof item?.text === "string" ? item.text : "")
            ].find((text) => typeof text === "string" && text.trim().length > 0) || "";

            if (repairedOutput.trim()) {
              const repaired = parseSummary(repairedOutput);
              if (summaryLooksReadable(repaired.summary)) parsedSummary = repaired;
            }
          }
        }

        return NextResponse.json({
          ...parsedSummary,
          basis,
          basisType,
          articleTruncated,
          model: usedModel
        });
      } catch (error) {
        lastStatus = 502;
        lastError = error instanceof Error ? error.message : "AI-svaret kunne ikke fortolkes.";
        console.error("AI summary parse failed", { model, output, error });
      }
    }

    let reason = "AI-tjenesten kunne ikke lave resuméet.";
    try {
      const parsed = JSON.parse(lastError);
      const upstream = parsed?.error?.message;
      if (typeof upstream === "string" && upstream) reason = upstream;
    } catch {
      if (lastError) reason = lastError;
    }

    return NextResponse.json(
      { error: reason, upstreamStatus: lastStatus, model: usedModel },
      { status: 502 }
    );
  } catch (error) {
    console.error("AI summary route failed", error);
    return NextResponse.json({ error: "Artiklen kunne ikke behandles." }, { status: 502 });
  }
}

/**
 * Only the winning request generates a summary. The private Supabase cache
 * persists across deployments, replicas, browsers and visitors. A failed
 * database lookup must never trigger unmetered AI work.
 */
export async function POST(req: NextRequest) {
  // Summary generation is reserved for the scheduled collector, not readers.
  // The browser only receives already-stored summaries via /api/news.
  const ingestSecret = process.env.OEL_INGEST_SECRET;
  if (!ingestSecret || req.headers.get("x-oel-ingest-secret") !== ingestSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const dbUrl = process.env.SUPABASE_URL;
  const dbKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  const secret = process.env.OEL_INGEST_SECRET;
  if (!dbUrl || !dbKey || !secret) {
    return NextResponse.json({ error: "Resumé-cache er ikke tilgængelig." }, { status: 503 });
  }
  let body: any;
  try { body = await req.clone().json(); }
  catch { return NextResponse.json({ error: "Ugyldig forespørgsel." }, { status: 400 }); }
  const url = String(body?.url || "");
  const title = String(body?.title || "");
  const feedText = String(body?.feedText || "");
  let parsed: URL;
  try {
    parsed = new URL(url);
    if (parsed.protocol !== "https:" || !ALLOWED_HOSTS.has(parsed.hostname) ||
        parsed.username || parsed.password || parsed.port) throw new Error("url");
  } catch {
    return NextResponse.json({ error: "Ugyldig artikelkilde." }, { status: 400 });
  }
  const key = createHash("sha256").update(JSON.stringify([parsed.href, title])).digest("hex");
  const headers = {
    apikey: dbKey,
    Authorization: `Bearer ${dbKey}`,
    "Content-Type": "application/json",
    "x-oel-ingest-secret": secret
  };
  const rpc = async (functionName: string, payload: object) => {
    const response = await fetch(`${dbUrl}/rest/v1/rpc/${functionName}`, {
      method: "POST", headers, body: JSON.stringify(payload),
      cache: "no-store", signal: AbortSignal.timeout(6000)
    });
    if (!response.ok) throw new Error(`Summary cache error ${response.status}`);
    return response.json();
  };
  let claimed: any;
  try {
    claimed = await rpc("oeldk_summary_claim", { p_key: key, p_url: parsed.href, p_title: title });
  } catch (error) {
    console.error("Summary cache claim failed", error);
    return NextResponse.json({ error: "Resumé-cache er midlertidigt utilgængelig." }, { status: 503 });
  }
  if (claimed?.status === "ready") {
    return NextResponse.json({ summary: claimed.summary, bullets: [], basisType: claimed.basisType, cached: true });
  }
  if (claimed?.status === "busy") {
    return NextResponse.json({ status: "generating" }, { status: 202, headers: { "Retry-After": "3" } });
  }
  if (claimed?.status === "failed") {
    return NextResponse.json({ error: "Resuméet kan ikke dannes lige nu." }, { status: 503 });
  }
  if (claimed?.status !== "claimed" || !claimed.ticket) {
    return NextResponse.json({ error: "Ugyldig cache-status." }, { status: 503 });
  }
  let generated: NextResponse;
  try { generated = await generateSummary(req); }
  catch (error) {
    console.error("Summary generation failed", error);
    generated = NextResponse.json({ error: "Resuméet kunne ikke genereres." }, { status: 502 });
  }
  let result: any = {};
  try { result = await generated.clone().json(); } catch {}
  const good = generated.ok && typeof result?.summary === "string" && result.summary.trim().length >= 40;
  try {
    await rpc("oeldk_summary_finish", {
      p_key: key, p_ticket: claimed.ticket,
      p_summary: good ? result.summary.trim() : "",
      p_basis_type: good ? (result.basisType || "excerpt") : "",
      p_success: good
    });
  } catch (error) {
    console.error("Failed to persist AI summary", error);
    // Avoid claiming success when other visitors cannot reuse the result.
    return NextResponse.json({ error: "Resuméet kunne ikke gemmes." }, { status: 503 });
  }
  return generated;
}

import { NextRequest, NextResponse } from "next/server";

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

export async function POST(req: NextRequest) {
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
    let basis = "det frit tilgængelige artikeluddrag";
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

    if (!articleFetched) {
      const fallbackText = [title, feedText].filter(Boolean).join(". ").trim();
      if (fallbackText.length >= 40) {
        articleText = fallbackText;
        basis = "overskrift og frit tilgængeligt artikeluddrag";
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
Skriv 3-5 korte, sammenhængende og grammatisk komplette sætninger på naturligt dansk.
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

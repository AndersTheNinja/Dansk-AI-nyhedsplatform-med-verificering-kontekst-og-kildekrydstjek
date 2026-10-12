import { NextRequest, NextResponse } from "next/server";

type FactResult = {
  verdict: "understøttet" | "blandet" | "usikkert";
  score: number;
  neutrality: {
    score: number;
    balance: string;
    language: string;
    explanation: string;
  };
  otherMedia: {
    count: number;
    names: string[];
    agreement: string;
  };
  truth: {
    score: number;
    support: string[];
    discrepancies: string[];
  };
  conclusion: string;
  claims: string[];
};

function clampScore(value: unknown) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function stringArray(value: unknown, max = 6) {
  return Array.isArray(value) ? value.slice(0, max).map((item) => String(item).slice(0, 300)) : [];
}

function parseResult(text: string): FactResult {
  const cleaned = text.trim().replace(/^\`\`\`(?:json)?/i, "").replace(/\`\`\`$/i, "").trim();
  const parsed = JSON.parse(cleaned);
  const verdict = ["understøttet", "blandet", "usikkert"].includes(parsed.verdict)
    ? parsed.verdict
    : "usikkert";

  return {
    verdict,
    score: clampScore(parsed.score ?? parsed.truth?.score),
    neutrality: {
      score: clampScore(parsed.neutrality?.score),
      balance: String(parsed.neutrality?.balance ?? "").slice(0, 500),
      language: String(parsed.neutrality?.language ?? "").slice(0, 500),
      explanation: String(parsed.neutrality?.explanation ?? "").slice(0, 900)
    },
    otherMedia: {
      count: Math.max(0, Math.round(Number(parsed.otherMedia?.count) || 0)),
      names: stringArray(parsed.otherMedia?.names, 8),
      agreement: String(parsed.otherMedia?.agreement ?? "").slice(0, 900)
    },
    truth: {
      score: clampScore(parsed.truth?.score ?? parsed.score),
      support: stringArray(parsed.truth?.support, 6),
      discrepancies: stringArray(parsed.truth?.discrepancies, 6)
    },
    conclusion: String(parsed.conclusion ?? parsed.explanation ?? "").slice(0, 1200),
    claims: stringArray(parsed.claims, 6)
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;

  if (!apiKey || !model) {
    return NextResponse.json({ error: "Faktatjek er ikke aktiveret." }, { status: 503 });
  }

  const title = String(body.title ?? "").slice(0, 500);
  const text = String(body.text ?? "").slice(0, 4500);
  const suppliedNeutrality = body.neutrality && typeof body.neutrality === "object"
    ? {
        wording: clampScore(body.neutrality.wording),
        wordingNote: String(body.neutrality.wordingNote ?? "").slice(0, 700),
        sources: body.neutrality.sources == null ? null : clampScore(body.neutrality.sources),
        sourcesNote: String(body.neutrality.sourcesNote ?? "").slice(0, 700)
      }
    : null;

  const sources = Array.isArray(body.sources)
    ? body.sources.slice(0, 10).map((source: any) => ({
        label: String(source?.label ?? "").slice(0, 120),
        title: String(source?.title ?? "").slice(0, 500)
      }))
    : [];

  const distinctMedia = Array.from(
    new Set(sources.map((source: { label: string }) => source.label).filter(Boolean))
  );

  const prompt = `Du laver et forsigtigt og transparent faktatjek af en dansk nyhed til ØL.dk.

Du har KUN den angivne overskrift, tekst, eventuel eksisterende neutralitetsanalyse og de fundne medieoverskrifter. Du må ikke foregive at have verificeret noget uden dokumentation. Brug "Truth-score" som et mål for DOKUMENTATIONSSTYRKE — aldrig som en procent-sandsynlighed for sandhed.

Analysen skal have fire tydelige dele:
1) Neutralitet: vurder både om relevante sider af sagen ser ud til at blive belyst, og om sproget er neutralt, ladet eller sensationspræget.
2) Andre medier: opsummér hvor mange andre medier/kilder der findes i materialet, hvilke de er, og om deres centrale oplysninger ser ud til at stemme overens.
3) Truth-score: vurder underbygning, kildeuafhængighed og eventuelle uoverensstemmelser. Hvis materialet kun har én reel kilde, skal scoren afspejle den begrænsning.
4) Samlet AI-konklusion: 2-4 korte sætninger, der forklarer den samlede vurdering og vigtigste forbehold.

Returnér KUN gyldig JSON i dette format:
{
  "verdict": "understøttet" | "blandet" | "usikkert",
  "score": 0-100,
  "neutrality": {
    "score": 0-100,
    "balance": "kort vurdering af om sagen belyses fra relevante sider",
    "language": "kort vurdering af sprogbrug",
    "explanation": "kort samlet neutralitetsforklaring"
  },
  "otherMedia": {
    "count": 0,
    "names": ["medienavne"],
    "agreement": "kort vurdering af om kilderne er enige om de centrale fakta"
  },
  "truth": {
    "score": 0-100,
    "support": ["2-5 forhold der underbygger historien"],
    "discrepancies": ["0-5 uoverensstemmelser, mangler eller usikkerheder"]
  },
  "conclusion": "kort samlet AI-konklusion på dansk",
  "claims": ["2-5 centrale faktuelle påstande og hvordan de står dokumenteret"]
}

100 betyder stærkt dokumenteret af flere uafhængige kilder i det materiale, du har fået.
0 betyder at materialet modsiger centrale påstande eller er helt utilstrækkeligt.
Kald aldrig resultatet en endelig sandhedsdom.

Overskrift: ${title}
Tekst: ${text}
Eksisterende neutralitetsdata: ${JSON.stringify(suppliedNeutrality)}
Fundne mediekilder: ${JSON.stringify(sources)}
Antal forskellige medier i materialet: ${distinctMedia.length}`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      input: prompt,
      max_output_tokens: 1200
    })
  });

  if (!response.ok) {
    return NextResponse.json({ error: "AI-tjenesten kunne ikke lave faktatjekket." }, { status: 502 });
  }

  const data = await response.json();
  const output =
    data.output_text ??
    data.output?.flatMap((x: any) => x.content ?? []).find((x: any) => x.type === "output_text")?.text ??
    "";

  try {
    const result = parseResult(output);
    // Keep the displayed media count grounded in the supplied source list.
    result.otherMedia.count = distinctMedia.length;
    if (result.otherMedia.names.length === 0) result.otherMedia.names = distinctMedia.slice(0, 8);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Faktatjekket kunne ikke fortolkes." }, { status: 502 });
  }
}

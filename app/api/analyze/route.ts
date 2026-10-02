import { NextRequest, NextResponse } from "next/server";

type Analysis = {
  wordingScore: number;
  wordingNote: string;
  wordingExamples: string[];
  sourcesScore: number | null;
  sourcesNote: string;
  sourcesExamples: string[];
};

function clampScore(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 50;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function parseJson(text: string): Analysis {
  const cleaned = text.trim().replace(/^\`\`\`(?:json)?/i, "").replace(/\`\`\`$/i, "").trim();
  const parsed = JSON.parse(cleaned);

  return {
    wordingScore: clampScore(parsed.wordingScore),
    wordingNote: String(parsed.wordingNote ?? "AI-vurdering af formuleringen."),
    wordingExamples: Array.isArray(parsed.wordingExamples)
      ? parsed.wordingExamples.slice(0, 5).map(String)
      : [],
    sourcesScore:
      parsed.sourcesScore === null || parsed.sourcesScore === undefined
        ? null
        : clampScore(parsed.sourcesScore),
    sourcesNote: String(parsed.sourcesNote ?? "Ingen sikker kildevurdering."),
    sourcesExamples: Array.isArray(parsed.sourcesExamples)
      ? parsed.sourcesExamples.slice(0, 5).map(String)
      : []
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;

  if (!apiKey || !model) {
    return NextResponse.json(
      { error: "AI-analyse er ikke aktiveret. OPENAI_API_KEY og OPENAI_MODEL mangler." },
      { status: 503 }
    );
  }

  const title = String(body.title ?? "").slice(0, 500);
  const text = String(body.text ?? "").slice(0, 1800);
  const sources = Array.isArray(body.sources)
    ? body.sources.slice(0, 6).map((source: any) => ({
        label: String(source?.label ?? "").slice(0, 100),
        title: String(source?.title ?? "").slice(0, 500)
      }))
    : [];

  const prompt = `Du er en neutral, kildekritisk dansk medieanalytiker.
Du vurderer ARTIKLENS SPROG OG FRAMING — ikke om en politiker, et parti, en holdning eller et politisk valg er godt eller dårligt.

Returnér KUN gyldig JSON uden markdown med præcis disse felter:
{
  "wordingScore": 0-100,
  "wordingNote": "kort dansk forklaring",
  "wordingExamples": ["2-5 konkrete ord eller formuleringer fra teksten, som påvirker vurderingen"],
  "sourcesScore": 0-100 eller null,
  "sourcesNote": "kort dansk forklaring",
  "sourcesExamples": ["konkrete forskelle/ligheder mellem de fundne kilders overskrifter"]
}

Skala:
100 = meget nøgtern, faktuel og ikke-værdiladet formulering.
0 = meget stærkt værdiladet, polemisk, manipulerende eller sensationel formulering.
Vurder bl.a. værdiladede adjektiver, insinuationer, generaliseringer, absolutte påstande, følelsesord,
clickbait, dramatisk framing og om vurderinger præsenteres som fakta.
Citattegn eller kolon er IKKE i sig selv tegn på lav objektivitet.

For sourcesScore:
- Sæt null hvis der kun er én reel medieudgiver.
- Hvis der er mindst to reelle medieudgivere, vurder hvor ens den centrale faktuelle kerne og framing er.
- En høj score betyder stor overensstemmelse mellem kildernes faktuelle kerne/framing — ikke at noget dermed er bevist sandt.
- Ved politiske historier: bedøm kun artiklernes framing og kildeoverensstemmelse. Bedøm aldrig politikernes kvalitet, motiver, kompetence eller politiske valg.

Overskrift: ${title}
Feedtekst: ${text}
Fundne kilder: ${JSON.stringify(sources)}`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      input: prompt,
      max_output_tokens: 700
    })
  });

  if (!response.ok) {
    return NextResponse.json({ error: "AI-tjenesten svarede med en fejl." }, { status: 502 });
  }

  const data = await response.json();
  const output =
    data.output_text ??
    data.output?.flatMap((x: any) => x.content ?? []).find((x: any) => x.type === "output_text")?.text ??
    "";

  try {
    return NextResponse.json(parseJson(output));
  } catch {
    return NextResponse.json({ error: "AI-svaret kunne ikke fortolkes." }, { status: 502 });
  }
}

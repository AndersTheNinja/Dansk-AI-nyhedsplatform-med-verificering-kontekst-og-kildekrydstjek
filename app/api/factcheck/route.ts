import { NextRequest, NextResponse } from "next/server";

type FactResult = {
  verdict: "understøttet" | "blandet" | "usikkert";
  score: number;
  explanation: string;
  claims: string[];
};

function parseResult(text: string): FactResult {
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const parsed = JSON.parse(cleaned);
  const score = Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0)));
  const verdict = ["understøttet", "blandet", "usikkert"].includes(parsed.verdict)
    ? parsed.verdict
    : "usikkert";

  return {
    verdict,
    score,
    explanation: String(parsed.explanation ?? "").slice(0, 1200),
    claims: Array.isArray(parsed.claims) ? parsed.claims.slice(0, 5).map(String) : []
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
  const text = String(body.text ?? "").slice(0, 3500);
  const sources = Array.isArray(body.sources)
    ? body.sources.slice(0, 6).map((source: any) => ({
        label: String(source?.label ?? "").slice(0, 100),
        title: String(source?.title ?? "").slice(0, 500)
      }))
    : [];

  const prompt = `Du laver et forsigtigt faktatjek af en dansk nyhed til KONTEKST.
Du har KUN den angivne overskrift, tekst og de fundne medieoverskrifter. Du må ikke foregive at have verificeret noget uden dokumentation.
Vurder om de centrale faktuelle påstande er understøttet af det tilgængelige materiale.
Hvis der kun er én kilde, eller materialet er utilstrækkeligt, skal du tydeligt sige det.

Returnér KUN gyldig JSON:
{
  "verdict": "understøttet" | "blandet" | "usikkert",
  "score": 0-100,
  "explanation": "kort dansk forklaring på 2-4 sætninger",
  "claims": ["2-5 centrale påstande og hvordan de står dokumenteret"]
}

100 betyder stærkt understøttet af flere uafhængige kilder i det materiale, du har fået.
0 betyder at materialet modsiger påstanden eller er helt utilstrækkeligt.
Kald aldrig dette en endelig sandhedsdom.

Overskrift: ${title}
Tekst: ${text}
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
    return NextResponse.json({ error: "AI-tjenesten kunne ikke lave faktatjekket." }, { status: 502 });
  }

  const data = await response.json();
  const output =
    data.output_text ??
    data.output?.flatMap((x: any) => x.content ?? []).find((x: any) => x.type === "output_text")?.text ??
    "";

  try {
    return NextResponse.json(parseResult(output));
  } catch {
    return NextResponse.json({ error: "Faktatjekket kunne ikke fortolkes." }, { status: 502 });
  }
}

import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;

  if (!apiKey || !model) {
    return NextResponse.json(
      {
        error:
          "AI-analyse er ikke aktiveret endnu. Sæt OPENAI_API_KEY og OPENAI_MODEL i miljøvariablerne."
      },
      { status: 503 }
    );
  }

  const input = {
    title: String(body.title ?? ""),
    text: String(body.text ?? ""),
    sources: Array.isArray(body.sources) ? body.sources : []
  };

  const prompt = `Du er kildekritisk redaktør på en dansk nyhedsplatform.
Analyser historien neutralt og faktuelt. Skeln mellem dokumenterede fakta,
usikkerheder og fortolkninger. Returnér kort JSON med felterne:
status (confirmed|nuance|unverified), summary, verification, whyItMatters.
Historie: ${JSON.stringify(input)}`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      input: prompt
    })
  });

  if (!response.ok) {
    return NextResponse.json({ error: "AI-tjenesten svarede med en fejl." }, { status: 502 });
  }

  const data = await response.json();
  const text =
    data.output_text ??
    data.output?.flatMap((x: any) => x.content ?? []).find((x: any) => x.type === "output_text")?.text ??
    "";

  return NextResponse.json({ raw: text });
}

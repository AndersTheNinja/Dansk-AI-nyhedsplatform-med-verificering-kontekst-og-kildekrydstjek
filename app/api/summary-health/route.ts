import { NextRequest, NextResponse } from "next/server";
import { POST as analyzePost } from "../analyze/route";

export async function GET() {
  try {
    const testRequest = new NextRequest("http://internal/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Test",
        text: "Dette er en neutral testtekst.",
        sources: [{ label: "KONTEKST", title: "Test" }]
      })
    });

    const response = await analyzePost(testRequest);

    let detail: unknown = null;
    try {
      detail = await response.json();
    } catch {
      detail = null;
    }

    return NextResponse.json({
      ok: response.ok,
      status: response.status,
      stage: response.ok ? "openai-ok" : "openai-error",
      detail: response.ok ? "AI-kald virker" : detail
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      status: 500,
      stage: "healthcheck-error",
      detail: error instanceof Error ? error.message : "Ukendt fejl"
    });
  }
}

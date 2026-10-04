export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { POST as summaryPost } from "../summary/route";

export async function GET() {
  try {
    const testRequest = new NextRequest("http://internal/api/summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Test af resumé",
        source: "ØL.dk test",
        feedText:
          "Dette er en testtekst med nok indhold til at kontrollere hele resuméfunktionen. " +
          "Formålet er at sikre, at OpenAI-forbindelsen, modellen, svarformatet og parseren fungerer korrekt."
      })
    });

    const response = await summaryPost(testRequest);

    let detail: unknown = null;
    try {
      detail = await response.json();
    } catch {
      detail = null;
    }

    return NextResponse.json(
      {
        version: "v3-summary-end-to-end",
        ok: response.ok,
        status: response.status,
        stage: response.ok ? "summary-ok" : "summary-error",
        detail
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    return NextResponse.json(
      {
        version: "v3-summary-end-to-end",
        ok: false,
        status: 500,
        stage: "healthcheck-error",
        detail: error instanceof Error ? error.message : "Ukendt fejl"
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }
}

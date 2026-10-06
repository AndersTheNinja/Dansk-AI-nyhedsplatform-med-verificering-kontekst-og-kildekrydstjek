import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ count: 0 }, { status: 200 });
  }

  try {
    const body = await request.json();
    const visitorId = typeof body?.visitorId === "string" ? body.visitorId.slice(0, 120) : "";
    if (visitorId.length < 8) {
      return NextResponse.json({ count: 0 }, { status: 400 });
    }

    const response = await fetch(`${url}/rest/v1/rpc/presence_ping`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ p_visitor_id: visitorId }),
      cache: "no-store",
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      return NextResponse.json({ count: 0 }, { status: 200 });
    }

    const result = await response.json();
    const count = typeof result === "number" ? result : Number(result) || 0;
    return NextResponse.json({ count }, {
      headers: { "Cache-Control": "no-store, max-age=0" }
    });
  } catch {
    return NextResponse.json({ count: 0 }, { status: 200 });
  }
}

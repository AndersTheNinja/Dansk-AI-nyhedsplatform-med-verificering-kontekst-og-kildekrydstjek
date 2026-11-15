import { Pool } from "pg";

const queries: Readonly<Record<string, { args: readonly string[]; sql: string }>> = {
  anders_winnerskjold_archive: { args: [], sql: "select public.anders_winnerskjold_archive() as result" },
  ingest_news_batch: { args: ["payload"], sql: "select public.ingest_news_batch($1::jsonb) as result" },
  oeldk_article_previews: { args: [], sql: "select public.oeldk_article_previews() as result" },
  oeldk_berlingske_rss: { args: [], sql: "select public.oeldk_berlingske_rss() as result" },
  oeldk_berlingske_web: { args: [], sql: "select public.oeldk_berlingske_web() as result" },
  oeldk_featured_images: { args: [], sql: "select public.oeldk_featured_images() as result" },
  oeldk_latest_news_snapshot: { args: [], sql: "select public.oeldk_latest_news_snapshot() as result" },
  oeldk_media_article_counts: { args: [], sql: "select public.oeldk_media_article_counts() as result" },
  oeldk_queue_preview_repairs: { args: ["payload"], sql: "select public.oeldk_queue_preview_repairs($1::jsonb) as result" },
  oeldk_summary_batch_status: { args: ["p_keys"], sql: "select public.oeldk_summary_batch_status($1::jsonb) as result" },
  oeldk_summary_claim: { args: ["p_key", "p_url", "p_title"], sql: "select public.oeldk_summary_claim($1::text, $2::text, $3::text) as result" },
  oeldk_summary_finish: {
    args: ["p_key", "p_ticket", "p_summary", "p_basis_type", "p_success"],
    sql: "select public.oeldk_summary_finish($1::text, $2::uuid, $3::text, $4::text, $5::boolean) as result"
  },
  oeldk_techsavvy_rss: { args: [], sql: "select public.oeldk_techsavvy_rss() as result" },
  presence_ping: { args: ["p_visitor_id"], sql: "select public.presence_ping($1::text) as result" },
  visible_news_archive_count: { args: [], sql: "select public.visible_news_archive_count() as result" }
};

let pool: Pool | undefined;

export function databaseConfigured() {
  return Boolean(process.env.OEL_DATABASE_URL || (process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY));
}

export async function databaseRpc(name: string, request: RequestInit): Promise<Response> {
  const databaseUrl = process.env.OEL_DATABASE_URL;
  const headers = new Headers(request.headers);
  if (!databaseUrl) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!supabaseUrl || !key) return new Response(null, { status: 503 });
    headers.set("apikey", key);
    headers.set("authorization", `Bearer ${key}`);
    return fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, { ...request, headers });
  }

  if (!Object.hasOwn(queries, name)) throw new Error("Unknown database RPC");
  const query = queries[name];
  const body = JSON.parse(String(request.body ?? "{}")) as Record<string, unknown>;
  const values = query.args.map(arg => {
    const value = body[arg];
    return value !== null && typeof value === "object" ? JSON.stringify(value) : value;
  });
  const secret = headers.get("x-oel-ingest-secret");
  const requestHeaders = secret ? { "x-oel-ingest-secret": secret } : {};
  const client = await (pool ??= new Pool({
    connectionString: databaseUrl,
    max: 5,
    connectionTimeoutMillis: 3000,
    statement_timeout: 7500
  })).connect();
  try {
    await client.query("begin");
    await client.query("select set_config('request.headers', $1, true)", [JSON.stringify(requestHeaders)]);
    const result = await client.query(query.sql, values);
    await client.query("commit");
    return Response.json(result.rows[0]?.result ?? null);
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

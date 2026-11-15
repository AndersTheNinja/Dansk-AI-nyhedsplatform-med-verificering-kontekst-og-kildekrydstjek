import {readFile} from "node:fs/promises";
import pg from "pg";

const webUrl = "https://oel-dk-web-production.up.railway.app";
const sources = new Set([
  "computerworld.dk", "journalisten.dk", "techsavvy.media", "stiften.dk", "ing.dk",
  "version2.dk", "berlingske.dk", "dr.dk", "nyheder.tv2.dk", "tv2.dk",
  "borsen.dk", "migogaarhus.dk", "politiken.dk", "altinget.dk", "y.dk"
]);
const appFunctions = [
  "anders_winnerskjold_archive()", "ingest_news_batch(jsonb)", "oeldk_article_previews()",
  "oeldk_berlingske_rss()", "oeldk_berlingske_web()", "oeldk_featured_images()",
  "oeldk_latest_news_snapshot()", "oeldk_media_article_counts()", "oeldk_queue_preview_repairs(jsonb)",
  "oeldk_summary_batch_status(jsonb)", "oeldk_summary_claim(text,text,text)",
  "oeldk_summary_finish(text,uuid,text,text,boolean)", "oeldk_techsavvy_rss()", "presence_ping(text)",
  "visible_news_archive_count()"
];
const cacheJobs = {
  berlingske: "select private.oeldk_collect_berlingske()",
  berlingskeWeb: "select private.oeldk_collect_berlingske_web()",
  berlingskeRefresh: "select private.oeldk_refresh_berlingske_web_cache()",
  techsavvy: "select private.oeldk_collect_techsavvy()",
  featured: "select private.oeldk_collect_featured_images()",
  images: "select private.oeldk_collect_article_images()",
  previews: "select private.oeldk_collect_article_previews()",
  counts: "select private.oeldk_refresh_media_counts_cache()"
};

function publisherUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.port || url.username || url.password ||
      !sources.has(url.hostname.replace(/^www\./, ""))) throw new Error("Unsupported publisher address");
  return url;
}

async function fetchPublisher(item) {
  let url = publisherUrl(item.url);
  const signal = AbortSignal.timeout(item.timeout_milliseconds);
  for (let redirects = 0; redirects <= 3; redirects++) {
    const response = await fetch(url, {
      headers: item.headers?.Accept ? { Accept: item.headers.Accept } : {},
      redirect: "manual",
      signal
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location || redirects === 3) throw new Error("Unusable publisher redirect");
      url = publisherUrl(new URL(location, url).href);
      continue;
    }
    const type = response.headers.get("content-type") ?? "";
    const decode = /^(?:text\/|application\/(?:xhtml\+xml|rss\+xml|atom\+xml|xml|json))/i.test(type);
    let content = "";
    if (decode && response.body) {
      const chunks = [];
      let size = 0;
      for await (const chunk of response.body) {
        size += chunk.length;
        if (size > 3_000_000) throw new Error("Publisher response too large");
        chunks.push(chunk);
      }
      content = Buffer.concat(chunks).toString("utf8");
    } else {
      await response.body?.cancel();
    }
    return [response.status, type, content, false, null];
  }
}

async function drain(client) {
  const { rows } = await client.query("select * from net.http_request_queue order by id limit 220");
  for (let i = 0; i < rows.length; i += 8) {
    const batch = rows.slice(i, i + 8);
    const results = await Promise.all(batch.map(async item => {
      try { return await fetchPublisher(item); }
      catch (error) { return [null, null, null, error?.name === "TimeoutError", error?.name ?? "Error"]; }
    }));
    for (const [index, item] of batch.entries()) {
      await client.query(`with saved as (
        insert into net._http_response(id,status_code,content_type,content,timed_out,error_msg)
        values($1,$2,$3,$4,$5,$6) on conflict(id) do nothing
      ) delete from net.http_request_queue where id=$1`, [item.id, ...results[index]]);
    }
  }
  return rows.length;
}

async function refreshNews(client) {
  const response = await fetch(webUrl + "/api/news?collector=fast", {
    headers: { "x-oel-ingest-secret": process.env.OEL_INGEST_SECRET },
    cache: "no-store", redirect: "error", signal: AbortSignal.timeout(60_000)
  });
  if (!response.ok) throw new Error("News collection returned " + response.status);
  const snapshot = await response.json();
  const timestamp = Date.parse(snapshot.generatedAt);
  if (snapshot.collectorSnapshot !== true || !Array.isArray(snapshot.stories) ||
      snapshot.stories.length < 5 || snapshot.stories.length > 2000 || !Number.isFinite(timestamp) ||
      timestamp < Date.now() - 20 * 60_000 || timestamp > Date.now() + 120_000) {
    throw new Error("News collection returned an unusable snapshot");
  }
  const entries = snapshot.stories.filter(story => story.sources?.[0]?.url).map(story => ({
    canonical_url: story.sources[0].url, title: story.title, source: story.sourceLabel,
    source_method: story.sourceMethod, category: story.category, published_at: story.publishedAt,
    teaser: story.summary, story_group: story.id,
    raw_metadata: { verification: story.verification, verificationText: story.verificationText,
      neutrality: story.neutrality, mentions: story.mentions ?? [], andersOnly: Boolean(story.andersOnly) },
    sources: story.sources
  }));
  await client.query("begin");
  try {
    await client.query("select set_config('request.headers', $1, true)",
      [JSON.stringify({ "x-oel-ingest-secret": process.env.OEL_INGEST_SECRET })]);
    await client.query("select public.ingest_news_batch($1::jsonb)", [JSON.stringify(entries)]);
    await client.query(
      `insert into public.oeldk_news_snapshot(slot,response_id,generated_at,updated_at,payload)
       values(1,1000000000000 + $1::bigint,to_timestamp($1::bigint / 1000.0),now(),$2::jsonb)
       on conflict(slot) do update set response_id=excluded.response_id, generated_at=excluded.generated_at,
         updated_at=excluded.updated_at, payload=excluded.payload
       where public.oeldk_news_snapshot.generated_at < excluded.generated_at`,
      [timestamp, JSON.stringify(snapshot)]
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
  console.log("News snapshot:", snapshot.stories.length, new Date(timestamp).toISOString());
}

async function initialize(client) {
  const secret = process.env.OEL_INGEST_SECRET;
  const appPassword = process.env.OEL_APP_DATABASE_PASSWORD;
  if (!secret || !/^[a-f0-9]{64}$/.test(appPassword ?? "")) throw new Error("Missing worker configuration");
  await client.query(await readFile(new URL("bootstrap.sql", import.meta.url), "utf8"));
  await client.query("insert into private.ingest_config(id,secret) values(true,$1) on conflict(id) do update set secret=excluded.secret", [secret]);
  const existing = await client.query("select 1 from pg_roles where rolname='oeldk_web'");
  if (!existing.rowCount) await client.query("create role oeldk_web login connection limit 20");
  const literal = await client.query("select quote_literal($1) as password", [appPassword]);
  await client.query("alter role oeldk_web password " + literal.rows[0].password);
  await client.query("grant usage on schema public to oeldk_web");
  await client.query("grant execute on function " + appFunctions.map(fn => "public." + fn).join(", ") + " to oeldk_web");
  const webConnection = new URL(process.env.TARGET_URL);
  webConnection.username = "oeldk_web";
  webConnection.password = appPassword;
  const web = new pg.Client({ connectionString: webConnection.href, connectionTimeoutMillis: 5000 });
  try {
    await web.connect();
    await web.query("select public.visible_news_archive_count(), public.oeldk_article_previews()");
    const access = await web.query("select has_table_privilege(current_user, 'public.articles', 'UPDATE') as writable");
    if (access.rows[0].writable) throw new Error("Web role has direct archive write access");
  } finally {
    await web.end();
  }
  console.log("Worker schema and scoped web database role verified");
}

async function runJobs(client) {
  const minute = new Date().getUTCMinutes();
  const initial = process.argv.includes("--initial");
  await refreshNews(client);
  const jobs = [];
  if (initial || minute % 30 >= 10 && minute % 30 < 15) jobs.push("berlingske", "berlingskeWeb", "berlingskeRefresh");
  if (initial || minute >= 15 && minute < 20) jobs.push("techsavvy", "featured", "images", "previews");
  if (initial || minute % 15 < 5) jobs.push("counts");
  for (const job of jobs) await client.query(cacheJobs[job]);
  const publisherResponses = await drain(client);
  if (publisherResponses && jobs.includes("berlingskeRefresh")) await client.query(cacheJobs.berlingskeRefresh);
  console.log("Publisher jobs:", jobs.join(","), "responses:", publisherResponses);

  if (process.env.OEL_RUN_SUMMARIES === "1" && minute % 10 < 5) {
    const response = await fetch(webUrl + "/api/summary/collect", {
      method: "POST", headers: { "x-oel-ingest-secret": process.env.OEL_INGEST_SECRET },
      redirect: "error", signal: AbortSignal.timeout(90_000)
    });
    if (!response.ok) throw new Error("Summary collection returned " + response.status);
    const result = await response.json();
    console.log("Summary collection:", result.readyBefore, result.stored, result.failed);
  }
  await client.query("delete from net._http_response where created < now() - interval '3 hours'");
  await client.query("delete from net.http_request_queue where created < now() - interval '3 hours'");
}

const client = new pg.Client({ connectionString: process.env.TARGET_URL, connectionTimeoutMillis: 5000, statement_timeout: 30_000 });
try {
  await client.connect();
  const lock = await client.query("select pg_try_advisory_lock(850542113) as acquired");
  if (lock.rows[0].acquired) {
    if (process.argv.includes("--initialize")) await initialize(client);
    await runJobs(client);
  }
} catch (error) {
  console.error("ØL.dk worker failed:", error.code ?? "", error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}

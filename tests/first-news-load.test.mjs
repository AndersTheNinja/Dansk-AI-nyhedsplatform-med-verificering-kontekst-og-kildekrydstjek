import test from "node:test";
import assert from "node:assert/strict";
import { FIRST_NEWS_CACHE_TTL_MS, parseFirstNewsCache } from "../lib/first-news-cache.ts";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const first = { id:"a", title:"Seneste nyhed", summary:"Nyhedens indhold", sources:[{label:"DR",url:"https://www.dr.dk/nyheder/nyhed"}] };
const now = Date.parse("2026-10-28T18:00:00Z");

test("accepts very recent verified public stories",()=>{
 const raw=JSON.stringify({savedAt:now-30_000,stories:[first],totalCount:500});
 const cache=parseFirstNewsCache(raw,now);
 assert.equal(cache.stories[0].title,first.title);
 assert.equal(cache.totalCount,500);
});

test("never displays stale cached headlines as live",()=>{
 const stale=JSON.stringify({savedAt:now-FIRST_NEWS_CACHE_TTL_MS-1,stories:[first],totalCount:500});
 assert.equal(parseFirstNewsCache(stale,now),null);
 const future=JSON.stringify({savedAt:now+1,stories:[first],totalCount:500});
 assert.equal(parseFirstNewsCache(future,now),null);
});

test("never renders invalid cache payloads",()=>{
 for(const value of ["{}","no json",JSON.stringify({savedAt:now,stories:[],totalCount:0}),
  JSON.stringify({savedAt:now,stories:[{id:"x"}],totalCount:50}),
  JSON.stringify({savedAt:now,stories:[first],totalCount:0})]){
  assert.equal(parseFirstNewsCache(value,now),null);
 }
});

test("initial view does not issue a redundant third news-count fetch",()=>{
 const loader=readFileSync(new URL("../components/news-loader.tsx",import.meta.url),"utf8");
 const status=readFileSync(new URL("../components/news-status.tsx",import.meta.url),"utf8");
 assert.match(loader, /loadNews\(20\)\.finally/);
 assert.match(loader, /"oel-news-loaded"/);
 assert.match(status, /addEventListener\("oel-news-loaded"/);
 assert.doesNotMatch(status, /fetch\("\/api\/news\?limit=1"/);
});


test("loading uses the ØL brand with a progress line, not the generic spinner",()=>{
 const loader=readFileSync(new URL("../components/news-loader.tsx",import.meta.url),"utf8");
 const css=readFileSync(new URL("../app/globals.css",import.meta.url),"utf8");
 assert.match(loader, /newsLoadingBrandLogo">ØL<\/span>/);
 assert.match(loader, /className="newsLoadingProgressBar"/);
 assert.match(loader, /role="status" aria-live="polite"/);
 assert.match(loader, /Henter de seneste nyheder…/);
 assert.doesNotMatch(loader, /newsLoadingSpinner/);
 assert.match(loader, /className="newsLoadingEmblem"/);
 assert.match(loader, /className="newsLoadingOrbit"/);
 assert.match(css, /@keyframes oelLoadingHalo/);
 assert.match(css, /@keyframes oelLoadingFlow/);
 assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
 assert.doesNotMatch(css, /\.newsLoadingBrandLogo::?after\b/);
 assert.doesNotMatch(css, /@keyframes oelNewsSpin|@keyframes oelBrandPulse|@keyframes oelBrandProgress|@keyframes oelLoadingGleam/);
});

test("premium loading animation adds no scripts, assets or progress claim",()=>{
 const loader=readFileSync(new URL("../components/news-loader.tsx",import.meta.url),"utf8");
 const css=readFileSync(new URL("../app/globals.css",import.meta.url),"utf8");
 const segment=css.slice(css.indexOf(".newsLoadingState{"),css.indexOf(".newsLoadMore{"));
 assert.match(segment,/transform:translateX/);
 assert.doesNotMatch(segment,/@import|url\(|backdrop-filter:/i);
 assert.match(loader, /<span className="newsLoadingBrand" aria-hidden="true">/);
 assert.doesNotMatch(loader, /progressbar|aria-valuenow|aria-valuemax/);
});

test("the first batch starts the snapshot and metadata reads together and preserves enrichment", async () => {
 const older = { id: "older", publishedAt: "2026-10-28T17:00:00Z", summary: "Original excerpt" };
 const newer = { id: "newer", publishedAt: "2026-10-28T18:00:00Z", summary: "Original excerpt" };
 const placeholder = { id: "placeholder", publishedAt: "2026-10-28T19:00:00Z" };
 const stories = [older, placeholder, newer];
 const calls = [];
 const enrich = entries => entries.map(story => ({ ...story, imageUrl: "https://example.com/article.jpg" }));
 let finishMetadata;
 const pendingMetadata = new Promise(resolve => { finishMetadata = resolve; });
 const modules = {
  "next/server": { NextResponse: { json: data => data } },
  "next/cache": { unstable_cache: fn => fn },
  "@/lib/news-quality": {},
  "@/lib/image-health": {},
  "@/lib/live-news": {
   cleanNewsStories: entries => entries.filter(story => story.summary),
   loadPublisherArticleEnricher: () => {
    calls.push("metadata");
    return pendingMetadata;
   },
   addPublisherFeaturedImages: async entries => {
    calls.push("metadata");
    return enrich(entries);
   },
  },
  "@/lib/news-store": {
   getNewsSnapshot: async () => {
    calls.push("snapshot");
    return { stories, totalCount: 200, availableStories: 3 };
   },
  },
 };
 const source = readFileSync(new URL("../app/api/news/route.ts", import.meta.url), "utf8");
 const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
 const exports = {};
 runInNewContext(compiled.outputText, { exports, require: id => modules[id], console });
 const request = query => ({ nextUrl: new URL(query, "https://example.com/api/news") });

 const firstRequest = exports.GET(request("?fast=1&limit=1"));
 assert.deepEqual(calls, ["metadata", "snapshot"]);
 finishMetadata(enrich);
 const firstBatch = await firstRequest;
 assert.equal(firstBatch.totalCount, 200);
 assert.equal(firstBatch.availableStories, 2);
 assert.equal(firstBatch.stories.length, 1);
 assert.equal(firstBatch.stories[0].id, newer.id);
 assert.equal(firstBatch.stories[0].summary, newer.summary);
 assert.equal(firstBatch.stories[0].imageUrl, "https://example.com/article.jpg");

 calls.length = 0;
 const full = await exports.GET(request("?limit=1"));
 assert.deepEqual(calls, ["snapshot", "metadata"]);
 assert.deepEqual(full, firstBatch);
});

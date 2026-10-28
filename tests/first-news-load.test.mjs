import test from "node:test";
import assert from "node:assert/strict";
import { FIRST_NEWS_CACHE_TTL_MS, parseFirstNewsCache } from "../lib/first-news-cache.ts";
import { readFileSync } from "node:fs";

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

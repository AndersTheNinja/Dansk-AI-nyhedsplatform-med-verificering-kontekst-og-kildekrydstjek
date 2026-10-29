import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const live = readFileSync(new URL("../lib/live-news.ts", import.meta.url),"utf8");
const preview = readFileSync(new URL("../app/api/article-preview/route.ts", import.meta.url),"utf8");
const image = readFileSync(new URL("../app/api/article-image/route.ts", import.meta.url),"utf8");
const access = readFileSync(new URL("../app/api/access/route.ts", import.meta.url),"utf8");

test("Y.dk is configured as an official, visible Danish RSS source", () => {
 assert.match(live, /name:\s*"Y\.dk",\s*\/\/[^\n]*\n\s*url:\s*"https:\/\/y\.dk\/rss",\s*category:\s*"Danmark"/);
 const sourceCount=(live.match(/name:\s*"Y\.dk"/g) || []).length;
 assert.equal(sourceCount,1);
 const hidden=live.match(/const hiddenPublishers = new Set\(\[([\s\S]*?)\]\)/)?.[1] || "";
 assert.doesNotMatch(hidden, /"Y\.dk"/);
});

test("TechSavvy continues to be included unchanged",()=>{
 assert.match(live, /name:\s*"TechSavvy",\s*url:\s*"https:\/\/techsavvy\.media\/feed\/"/);
});

test("Y.dk metadata endpoints are authorized, without broadening to arbitrary hosts",()=>{
 for(const code of [preview,image,access]){
  assert.match(code, /"y\.dk"/);
  assert.match(code, /"www\.y\.dk"/);
  assert.doesNotMatch(code, /endsWith\(["']y\.dk["']\)/);
 }
});

test("Y articles use existing universal editorial-quality and story filters",()=>{
 assert.match(live, /repeatedPublisherDescriptionKeys\(fetched\)/);
 assert.match(live, /cleanPublisherTeaser\(lead\.description, lead\.title, lead\.source\)/);
 assert.match(live, /filter\(\(item\) => !isLiveCoverage\(item\)\)/);
});

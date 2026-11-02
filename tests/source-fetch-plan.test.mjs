import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const news = readFileSync(new URL("../lib/live-news.ts", import.meta.url), "utf8");
const feedConfig = news.match(/const feeds: FeedConfig\[\] = \[([\s\S]*?)\n\];/)?.[1] ?? "";
const collector = news.slice(news.indexOf("export async function getLiveStories("),news.indexOf("  const fetched = mergeBerlingskeWebsiteText(results"));

test("MigogAarhus uses one latest RSS feed, not five redundant paginated feeds", () => {
  assert.ok(feedConfig.includes('name: "MigogAarhus"'));
  assert.equal((feedConfig.match(/name:\s*"MigogAarhus"/g) || []).length, 1);
  assert.match(feedConfig, /url:\s*"https:\/\/migogaarhus\.dk\/feed\/"/);
  assert.doesNotMatch(feedConfig, /https:\/\/migogaarhus\.dk\/feed\/\?paged=/);
  assert.match(news, /async function fetchMigogAarhusApi\(/);
  assert.match(collector, /label: "MigogAarhus WordPress API", run: fetchMigogAarhusApi/);
});

test("fast and scheduled collectors skip publisher feeds already hidden from readers", () => {
  assert.match(collector, /const activeFeeds = feeds\.filter\(\(feed\) =>\s*isVisiblePublisher\(feed\.name\)/);
  assert.match(collector, /!\s*\/\[\?&\]paged=\\d\+\/i\.test\(feed\.url\)/);
  assert.match(collector, /const sourceTasks = activeFeeds\.map/);
  assert.match(collector, /if \(!fast\)\s*\{\s*sourceTasks\.push/);
  assert.doesNotMatch(collector, /\.\.\.feeds\.map\(\(feed\) => fetchFeed\(feed\)\)/);
});

test("each optional website source is labelled, not silently counted as generic failures", () => {
  for (const [label, fn] of [
    ["MigogAarhus WordPress API","fetchMigogAarhusApi"],
    ["Børsen website","fetchBorsenWebsite"],
    ["Berlingske website","fetchBerlingskeWebsite"],
    ["TV 2 website","fetchTV2Website"]
  ]) {
    assert.ok(collector.includes('label: "'+label+'", run: '+fn), label);
  }
  assert.match(collector, /Promise\.allSettled\(sourceTasks\.map\(\(source\) => source\.run\(\)\)\)/);
  assert.match(collector, /"News source fetch failed", sourceTasks\[index\]\.label/);
  assert.doesNotMatch(collector, /"Website source"/);
});

test("all existing source filtering and freshness safeguards remain",()=>{
  assert.match(news, /\.filter\(\(item\) => isFresh\(item\.pubDate\)\)/);
  assert.match(news, /\.filter\(\(item\) => isVisiblePublisher\(item\.source\)\)/);
  assert.match(news, /repeatedPublisherDescriptionKeys\(fetched\)/);
});

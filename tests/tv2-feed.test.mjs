import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../lib/live-news.ts", import.meta.url), "utf8");

test("TV 2 uses the current dedicated news RSS feed", () => {
  assert.match(source, /url:\s*"https:\/\/feeds\.services\.tv2\.dk\/api\/feeds\/nyheder\/rss"/);
  assert.doesNotMatch(source, /https:\/\/feeds\.tv2\.dk\/nyhederne_seneste\/rss/);
  assert.doesNotMatch(source, /https:\/\/tv2\.dk\/rss\/seneste\.xml/);
});

test("only one TV 2 RSS fetch is configured", () => {
  const declared = source.match(/name:\s*"TV2\.dk"/g) || [];
  assert.equal(declared.length, 1);
});

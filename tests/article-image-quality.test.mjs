import test from "node:test";
import assert from "node:assert/strict";
import { isGenericArticleImage, techSavvyFeaturedImage, techSavvyPostEndpoint } from "../lib/article-image-quality.ts";

test("generic publisher graphics are rejected",()=>{
 assert.equal(isGenericArticleImage("https://cdn.dr.dk/images/standard-nyhedsgrafik.webp","43-årig dømt efter DNA-match","DR"),true);
 assert.equal(isGenericArticleImage("https://cdn.example.dk/verdenskort.png","Nyhed om en retssag","Politiken"),true);
});
test("DR opaque unrelated pictures are rejected",()=>{
 assert.equal(isGenericArticleImage("https://asset.dr.dk/images/abcdef123456.jpg","43-årig dømt for voldtægt efter DNA-match","DR"),true);
});
test("DR article-related image descriptions are permitted",()=>{
 assert.equal(isGenericArticleImage("https://asset.dr.dk/images/abcdef123456.jpg","43-årig dømt for voldtægt efter DNA-match","DR","DNA match i politiets efterforskning"),false);
});
test("real images from other publishers are unaffected",()=>{
 assert.equal(isGenericArticleImage("https://static.stiften.dk/portraits/tomas-hoeffding.jpg","Tomas Høffding lever et musikalsk dobbeltliv","Stiften.dk"),false);
});

test("TechSavvy looks up only the article slug on the publisher's public endpoint", () => {
  const page = new URL("https://techsavvy.media/kunstige-muskler-faar-3d-printet-robot-froe-til-at-svoemme/?utm_source=rss");
  const endpoint = techSavvyPostEndpoint(page);
  assert.equal(endpoint.origin + endpoint.pathname, "https://techsavvy.media/wp-json/wp/v2/posts");
  assert.equal(endpoint.searchParams.get("slug"), "kunstige-muskler-faar-3d-printet-robot-froe-til-at-svoemme");
  assert.equal(techSavvyPostEndpoint(new URL("https://example.com/article/")), null);
  assert.equal(techSavvyPostEndpoint(new URL("https://techsavvy.media/kategori/nyheder/")), null);
});

test("TechSavvy validates the canonical article, featured media ID and image host", () => {
  const page = new URL("https://techsavvy.media/artikel-navn/");
  const original = "https://techsavvy.media/wp-content/uploads/2026/11/foto.jpg";
  const response = (link, source, id = 43) => [{
    link, featured_media: 43,
    _embedded: { "wp:featuredmedia": [{ id, media_type: "image", source_url: source }] }
  }];
  assert.equal(techSavvyFeaturedImage(response(page.href, original), page).href, original);
  assert.equal(techSavvyFeaturedImage(response("https://techsavvy.media/anden-artikel/", original), page), null);
  assert.equal(techSavvyFeaturedImage(response(page.href, original, 44), page), null);
  assert.equal(techSavvyFeaturedImage(response(page.href, "https://example.com/foto.jpg"), page), null);
});

import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

test("TechSavvy fallback diagnostics identify failures without logging article data", async () => {
  const page = "https://techsavvy.media/private-test-title/";
  const title = "Sensitive test headline for image";
  const image = "https://techsavvy.media/wp-content/uploads/2026/11/photo.jpg";
  const metadata = (source = image, link = page) => [{
    link, featured_media: 43,
    _embedded: { "wp:featuredmedia": [{ id: 43, media_type: "image", source_url: source }] }
  }];
  const compiled = ts.transpileModule(
    readFileSync(new URL("../app/api/article-image/route.ts", import.meta.url), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
  ).outputText;
  const cases = [
    { name: "HTTP rejection", response: () => new Response("", { status: 403 }), outcome: "http-error", stage: "metadata-fetch", status: 403 },
    { name: "non-JSON response", response: () => new Response("private upstream body"), outcome: "invalid-content-type", stage: "metadata-fetch" },
    { name: "invalid JSON", response: () => new Response("{", { headers: { "content-type": "application/json" } }), outcome: "error", stage: "metadata-parse" },
    { name: "unrelated article", response: () => Response.json(metadata(image, "https://techsavvy.media/other/")), outcome: "invalid-metadata", stage: "metadata-parse" },
    { name: "unsafe image host", response: () => Response.json(metadata("https://example.com/photo.jpg")), outcome: "invalid-metadata", stage: "metadata-parse" },
    { name: "previously failed image", response: () => Response.json(metadata()), failedImageUrl: image, outcome: "previously-failed", stage: "metadata-parse" },
    { name: "generic image", response: () => Response.json(metadata(image.replace("photo.jpg", "default.jpg"))), outcome: "generic-image", stage: "metadata-parse" },
    { name: "invalid image response", response: () => Response.json(metadata()), outcome: "unreachable-image", stage: "image-probe" },
    { name: "valid original image", response: () => Response.json(metadata()), validImage: true, outcome: "selected", stage: "image-probe" },
    { name: "network error", response: () => { throw new Error(page + title); }, outcome: "error", stage: "metadata-fetch" },
    { name: "another publisher", otherPublisher: true },
    { name: "invalid title", invalidTitle: true }
  ];
  for (const fixture of cases) {
    const records = [];
    const exported = { exports: {} };
    let requests = 0;
    const context = {
      exports: exported.exports, module: exported, URL, AbortSignal,
      console: { info: (...args) => records.push(args) },
      require: (name) => {
        if (name === "next/server") return { NextResponse: { json: (body, init) => Response.json(body, init) } };
        if (name === "@/lib/article-image-quality") return { isGenericArticleImage, techSavvyFeaturedImage, techSavvyPostEndpoint };
        throw new Error("Unexpected import");
      },
      fetch: async () => {
        requests++;
        if (requests === 1) return new Response("", { status: 503 });
        if (requests === 2) return fixture.response();
        if (!fixture.validImage) return new Response("<html>not an image</html>");
        return new Response(new Uint8Array([255, 216, 255, 224]), { headers: { "content-type": "image/jpeg" } });
      }
    };
    vm.runInNewContext(compiled, context);
    const response = await exported.exports.POST(new Request("https://example.test/api/article-image", {
      method: "POST", body: JSON.stringify({
        url: fixture.otherPublisher ? "https://ing.dk/test/" : page,
        title: fixture.invalidTitle ? "" : title, failedImageUrl: fixture.failedImageUrl
      })
    }));
    assert.deepEqual(await response.json(), fixture.validImage
      ? { imageUrl: image, imageDescription: "", photoCredit: null }
      : { imageUrl: null }, fixture.name);
    assert.equal(response.status, fixture.invalidTitle ? 400 : 200, fixture.name);
    if (!fixture.outcome) { assert.equal(records.length, 0, fixture.name); continue; }
    assert.equal(records.length, 1, fixture.name);
    assert.equal(records[0][0], "ØL.dk image evidence");
    const evidence = JSON.parse(records[0][1]);
    assert.deepEqual(evidence, {
      publisher: "techsavvy.media", stage: fixture.stage, outcome: fixture.outcome,
      ...(fixture.status ? { status: fixture.status } : {})
    }, fixture.name);
    assert.ok(!JSON.stringify(records).includes(page));
    assert.ok(!JSON.stringify(records).includes(title));
    assert.ok(!JSON.stringify(records).includes(image));
  }
});

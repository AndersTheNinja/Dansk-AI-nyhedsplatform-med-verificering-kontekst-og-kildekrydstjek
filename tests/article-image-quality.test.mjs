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

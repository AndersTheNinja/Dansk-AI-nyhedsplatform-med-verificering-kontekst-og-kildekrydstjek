import test from "node:test";
import assert from "node:assert/strict";
import { isGenericArticleImage } from "../lib/article-image-quality.ts";

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

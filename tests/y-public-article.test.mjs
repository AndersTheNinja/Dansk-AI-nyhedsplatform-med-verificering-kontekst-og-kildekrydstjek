import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { extractYPublicArticlePreview } from "../lib/y-article-preview.ts";

const title='Eksplosiv afsløring: "Han er bange for de mennesker, og det er jeg også"';
const intro="Der Tagesspiegel har afsløret, at Die Linkes borgmesterkandidat frygter en terrorsympatisør med tråde til hendes eget bagland.";
const second="Ifølge den offentliggjorte artikel har konflikten skabt bekymring hos flere politikere, og der bliver efterspurgt en grundigere undersøgelse af forbindelserne.";
const third="De involverede afviser nogle af beskyldningerne, mens andre mener, at der bør fremlægges yderligere oplysninger, inden der drages en endelig konklusion.";
const page=(headline,paragraphs)=>'<html><main><article><h1>'+headline+'</h1>'+paragraphs.map(p=>'<p>'+p+'</p>').join('')+'</article><section class="recommendations"><h2>Redaktionen anbefaler</h2><p>Anden historie som er meget lang og intet har med artiklen at gøre.</p></section></main></html>';

test("verified Y.dk article main provides multiple public paragraphs",()=>{
 const result=extractYPublicArticlePreview(page(title,[intro,second,third]),title,intro);
 assert.match(result,/Der Tagesspiegel/);
 assert.match(result,/Ifølge den offentliggjorte artikel/);
 assert.match(result,/De involverede/);
 assert.doesNotMatch(result,/Anden historie/);
 assert.ok(result.length>intro.length+50);
});

test("do not use body from different headline even with same intro",()=>{
 assert.equal(extractYPublicArticlePreview(page("Helt anden historie om fodbold",[intro,second]),title,intro),"");
});

test("do not use unrelated article paragraphs when RSS intro is absent",()=>{
 assert.equal(extractYPublicArticlePreview(page(title,[second,third]),title,intro),"");
});

test("single introduction is not mislabelled as an expanded article",()=>{
 assert.equal(extractYPublicArticlePreview(page(title,[intro]),title,intro),"");
});

test("a missing main or article headline cannot justify a replacement",()=>{
 assert.equal(extractYPublicArticlePreview("<div><p>"+intro+"</p><p>"+second+"</p></div>",title,intro),"");
});

test("the on-demand endpoint uses the actual RSS intro and marks short Y copy",()=>{
 const api=readFileSync(new URL("../app/api/article-preview/route.ts",import.meta.url),"utf8");
 const card=readFileSync(new URL("../components/news-feed.tsx",import.meta.url),"utf8");
 const live=readFileSync(new URL("../lib/live-news.ts",import.meta.url),"utf8");
 assert.match(api,/extractYPublicArticlePreview\(html, title, rssIntro\)/);
 assert.match(card,/intro:story\.summary/);
 assert.match(card,/Kort introduktion fra Y\.dk/);
 assert.match(live,/extractYPublicArticlePreview\(html, item\.title, item\.description\)/);
});

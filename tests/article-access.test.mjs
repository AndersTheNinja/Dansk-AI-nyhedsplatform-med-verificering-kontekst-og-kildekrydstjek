import test from "node:test";
import assert from "node:assert/strict";
import { accessFromArticleJsonLd, accessFromArticleMeta, accessFromArticleGate, classifyArticleAccess } from "../lib/article-access.ts";

const requested = new URL("https://politiken.dk/internationalt/art10990001/En-avis-om-Europa");
function ld(records) {
 return '<script id="article-ld" type="application/ld+json">'+JSON.stringify({"@context":"https://schema.org","@graph":records})+"</script>";
}
function news(url,isAccessibleForFree,extra={}) {
 return {"@type":"NewsArticle","url":url,"isAccessibleForFree":isAccessibleForFree,...extra};
}

test("a Politiken page without paywall signals is UNKNOWN, never free",()=>{
 const html="<html><head><title>En avis om Europa | Politiken</title></head><body>Nyhedens korte intro</body></html>";
 assert.deepEqual(classifyArticleAccess(html,requested),{
   requiresSubscription:null,basis:"unknown"
 });
});

test("same-article structured paywall correctly returns abb.",()=>{
 const html=ld([news(requested.toString(),false)]);
 assert.deepEqual(classifyArticleAccess(html,requested),{
   requiresSubscription:true,basis:"article-jsonld"
 });
});

test("verified article metadata can confirm free access",()=>{
 const html=ld([news(requested.toString(),true)]);
 assert.deepEqual(classifyArticleAccess(html,requested),{
   requiresSubscription:false,basis:"article-jsonld"
 });
});

test("a paywalled article section overrides a free introduction",()=>{
 const html=ld([news(requested.toString(),true,{hasPart:{
   "@type":"WebPageElement",isAccessibleForFree:false,cssSelector:".locked"
 }})]);
 assert.equal(classifyArticleAccess(html,requested).requiresSubscription,true);
});

test("unrelated subscription article on same page cannot make the target free",()=>{
 const html=ld([
  news("https://politiken.dk/internationalt/art99999/Anden-artikel",true),
  {"@type":"WebPage","url":requested.toString()}
 ]);
 assert.equal(accessFromArticleJsonLd(html,requested),null);
 assert.equal(classifyArticleAccess(html,requested).requiresSubscription,null);
});

test("conflicting metadata never claims gratis",()=>{
 const html=ld([news(requested.toString(),true)])+"<div>Log ind for at læse videre</div>";
 assert.equal(classifyArticleAccess(html,requested).requiresSubscription,null);
});

test("explicit paywall text is strong enough to mark abb.",()=>{
 const html="<h1>Artiklen</h1><div>Bliv abonnent for at læse videre</div>";
 assert.equal(classifyArticleAccess(html,requested).requiresSubscription,true);
});

test("free metadata on same article with WWW and tracking parameters is accepted",()=>{
 const html=ld([news("https://www.politiken.dk/internationalt/art10990001/En-avis-om-Europa?utm_source=rss",true)]);
 assert.equal(classifyArticleAccess(html,requested).requiresSubscription,false);
});

test("a generic subscription promotion is not proof of a paywall",()=>{
 const html="<footer>Få meget mere med vores abonnement</footer>";
 assert.equal(classifyArticleAccess(html,requested).requiresSubscription,null);
});


function withHead(url, tags, article = "<article><h1>Historien</h1></article>") {
 return '<html><head><link rel="canonical" href="' + url + '"/>' + tags + '</head><body>' + article + '</body></html>';
}
test("Berlingske locked content tier on matching canonical is abb.", () => {
 const url = new URL("https://www.berlingske.dk/indland/en-nyhed");
 const html = withHead(url.toString(), '<meta property="article:content_tier" content="locked"/>');
 assert.deepEqual(classifyArticleAccess(html,url),{requiresSubscription:true,basis:"article-meta"});
});
test("Berlingske free content tier on matching canonical is free", () => {
 const url = new URL("https://www.berlingske.dk/indland/en-nyhed");
 const html = withHead(url.toString(), '<meta content="free" property="article:content_tier"/>');
 assert.deepEqual(classifyArticleAccess(html,url),{requiresSubscription:false,basis:"article-meta"});
});
test("metered does not guarantee access for the user", () => {
 const url = new URL("https://www.berlingske.dk/indland/en-nyhed");
 const html = withHead(url.toString(), '<meta property="article:content_tier" content="metered"/>');
 assert.equal(classifyArticleAccess(html,url).requiresSubscription,null);
});
test("meta from another article cannot establish access for requested URL", () => {
 const url = new URL("https://www.berlingske.dk/indland/en-nyhed");
 const html = withHead("https://www.berlingske.dk/indland/andet", '<meta property="article:content_tier" content="free"/>');
 assert.equal(accessFromArticleMeta(html,url),null);
 assert.equal(classifyArticleAccess(html,url).requiresSubscription,null);
});
test("schema.org access meta with a canonical can indicate a paywall", () => {
 const url = new URL("https://politiken.dk/indland/art10000");
 const html = withHead(url.toString(), '<meta itemprop="isAccessibleForFree" content="false"/>');
 assert.equal(classifyArticleAccess(html,url).requiresSubscription,true);
});
test("locked article gate is stronger than generic article marketing text", () => {
 const url = new URL("https://www.berlingske.dk/indland/en-nyhed");
 const html = withHead(url.toString(), "",
 '<article><h1>Historien</h1><div data-paywall-state="locked"></div></article>');
 assert.equal(classifyArticleAccess(html,url).requiresSubscription,true);
 assert.equal(classifyArticleAccess(html,url).basis,"article-gate");
});
test("paywall ads outside article are not a paywall for the requested story", () => {
 const url = new URL("https://www.berlingske.dk/indland/en-nyhed");
 const html = withHead(url.toString(), "",
 '<article><h1>Historien</h1><p>Almindelig tekst</p></article><aside><div class="article-paywall">Bliv abonnent for at læse videre</div></aside>');
 assert.equal(classifyArticleAccess(html,url).requiresSubscription,null);
});
test("conflicting article-level free and locked metadata stays unknown", () => {
 const url = new URL("https://www.berlingske.dk/indland/en-nyhed");
 const html = withHead(url.toString(),
 '<meta property="article:content_tier" content="locked"/><meta itemprop="isAccessibleForFree" content="true"/>');
 assert.equal(classifyArticleAccess(html,url).requiresSubscription,null);
});
test("attribute order and og:url canonical identity supported", () => {
 const url = new URL("https://www.berlingske.dk/indland/en-nyhed");
 const html = '<head><meta content="https://www.berlingske.dk/indland/en-nyhed?ref=rss" property="og:url">' +
 '<meta content="premium" name="article:content_tier"></head>';
 assert.equal(classifyArticleAccess(html,url).requiresSubscription,true);
});

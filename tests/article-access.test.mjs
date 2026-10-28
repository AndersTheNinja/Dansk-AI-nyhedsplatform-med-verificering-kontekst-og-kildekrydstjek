import test from "node:test";
import assert from "node:assert/strict";
import { accessFromArticleJsonLd, classifyArticleAccess } from "../lib/article-access.ts";

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

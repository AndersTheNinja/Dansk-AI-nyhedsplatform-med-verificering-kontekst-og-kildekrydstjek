import test from "node:test";
import assert from "node:assert/strict";
import { classifyArticleAccess } from "../lib/article-access.ts";

const stiften = "https://stiften.dk/byliv/victor-emil-troede-at-ingen-ville-komme-til-hans-gaatur-det-gik-over-al-forventning?rss";
const other = "https://stiften.dk/byliv/anden-historie";

function jsonLd(obj) {
  return '<script type="application/ld+json">' + JSON.stringify(obj) + '</script>';
}

test("subscription elements in publisher navigation must not mark a free article paid", () => {
  const html = [
    '<nav data-paywall="true" class="paywall">Bliv abonnent for at læse mere</nav>',
    '<script>window.globalSettings={"paywall":true,"premium-content":true};</script>',
    '<article><p>Den redaktionelle artikel er tilgængelig for alle.</p></article>'
  ].join("");
  assert.deepEqual(classifyArticleAccess(html, stiften), { requiresSubscription: null, basis: "unknown" });
});

test("Stiften free article structured data overrides generic paywall components", () => {
  const html = '<div data-paywall class="paywall">Tilbud på abonnement</div>' +
    jsonLd({ "@type": "NewsArticle", url: stiften.replace("?rss", ""),
      isAccessibleForFree: true });
  assert.deepEqual(classifyArticleAccess(html, stiften), { requiresSubscription: false, basis: "article-jsonld" });
});

test("paid article JSON-LD is recognized only when the URL matches", () => {
  const html = jsonLd({ "@graph": [
    { "@type": "NewsArticle", url: other, isAccessibleForFree: false },
    { "@type": "NewsArticle", mainEntityOfPage: { "@id": stiften.replace("?rss", "") + "#article" },
      isAccessibleForFree: true }
  ] });
  assert.equal(classifyArticleAccess(html, stiften).requiresSubscription, false);
  assert.equal(classifyArticleAccess(jsonLd({ "@type": "NewsArticle", url: stiften, isAccessibleForFree: false }), stiften).requiresSubscription, true);
  assert.equal(classifyArticleAccess(jsonLd({ "@type": "NewsArticle", url: other, isAccessibleForFree: false }), stiften).requiresSubscription, null);
});

test("explicit article content tier, regardless of attribute order, is recognized", () => {
  assert.equal(classifyArticleAccess('<meta content="free" property="article:content_tier">', stiften).requiresSubscription, false);
  assert.equal(classifyArticleAccess('<meta name="article:content_tier" content="premium">', stiften).requiresSubscription, true);
});

test("Børsen articles can be free; never label a whole publisher as paid", () => {
  const url = "https://borsen.dk/nyheder/virksomheder/gratis-artikel";
  assert.equal(classifyArticleAccess(jsonLd({ "@type": "Article", url, isAccessibleForFree: true }), url).requiresSubscription, false);
  assert.equal(classifyArticleAccess('<nav>Bliv abonnent</nav>', url).requiresSubscription, null);
});

test("article-specific paywall attributes work without affecting unrelated article cards", () => {
  const html = '<article data-article-url="' + other + '" data-paywall="true"></article>' +
    '<article data-article-url="' + stiften.replace("?rss", "") + '" data-paywall="false"></article>';
  assert.equal(classifyArticleAccess(html, stiften).requiresSubscription, false);
});

test("contradictory access metadata remains unknown rather than guessing", () => {
  const html = jsonLd({ "@type": "NewsArticle", url: stiften, isAccessibleForFree: true }) +
    '<meta property="article:content_tier" content="premium">';
  assert.deepEqual(classifyArticleAccess(html, stiften), { requiresSubscription: null, basis: "conflict" });
});

test("string schema booleans and JSON-LD script attribute order are handled", () => {
  const html = '<script data-id="article" type="application/ld+json">' +
    JSON.stringify({ "@type": ["NewsArticle"], url: stiften, isAccessibleForFree: "False" }) + "</script>";
  assert.equal(classifyArticleAccess(html, stiften).requiresSubscription, true);
});

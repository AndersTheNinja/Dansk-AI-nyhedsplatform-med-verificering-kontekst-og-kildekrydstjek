import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { extractStiftenPublicFragment } from "../lib/stiften-public-article.ts";
import { previewWordCount } from "../lib/article-preview-quality.ts";

const title="Anders solgte verdenskendt Risskov-succes for 750 millioner: I dag fortryder han";
const lead="Anders Fauerskov og hans medejere havde betænkeligheder ved køberen, men blev overbeviste om, at en større ejer kunne sætte ekstra fart på virksomheden.";
const p1="Anders Fauerskov solgte med sine medejere den store virksomhed fra Risskov, men i dag beskriver han hvordan beslutningen blev truffet og hvilke overvejelser der var dengang.";
const p2="Den tidligere Risskov-virksomhed er efter salget blevet en anden forretning, og fortællingen handler om, hvad de oprindelige ejere håbede at kunne opnå, og hvad der faktisk skete efterfølgende.";
const p3="Fauerskov fortæller om erfaringerne med overdragelsen, og Risskov-succesens historie rejser derfor spørgsmål om at overdrage kontrollen over et selskab til en ny ejer.";
const content="<article><p>"+p1+"</p><p>"+p2+"</p><p>"+p3+"</p></article>";
const wrap=(body)=>"<html><section data-load-async-url='/article/body'>"+body+"</section></html>";

test("verified Stiften public fragment adds article-specific paragraphs",()=>{
 const result=extractStiftenPublicFragment(wrap(content),title,lead);
 assert.match(result,/Anders Fauerskov solgte/);
 assert.match(result,/Den tidligere Risskov-virksomhed/);
 assert.match(result,/Fauerskov fortæller/);
 assert.ok(result.length>lead.length+50);
});

test("reject unrelated recommendations, even when they contain plausible news",()=>{
 const unrelated="<p>En anden historie handler om trafikken omkring Odense og et nyt vejprojekt, der ventes at blive præsenteret i denne uge.</p>"+
 "<p>Kommunen har modtaget flere spørgsmål til projektet, og lokale politikere har kommenteret forløbet i går.</p>";
 assert.equal(extractStiftenPublicFragment(wrap(unrelated),title,lead),"");
});

test("reject a single marketing/intro paragraph and strip publisher chrome",()=>{
 assert.equal(extractStiftenPublicFragment(wrap("<p>"+lead+"</p>"),title,lead),"");
 const withRelated=content+"<h3>Redaktionen anbefaler</h3><p>En anden historie om Anders Fauerskov og Risskov bliver anbefalet.</p>";
 const excerpt=extractStiftenPublicFragment(wrap(withRelated),title,lead);
 assert.doesNotMatch(excerpt,/bliver anbefalet/);
});

test("a public article excerpt respects the existing ~100 word display boundary",()=>{
 const extended="<article>"+Array.from({length:9},(_,i)=>"<p>"+p1+" "+p2+" "+p3+" Kapitel "+i+".</p>").join("")+"</article>";
 const source=extractStiftenPublicFragment(extended,title,lead);
 const excerpt=previewWordCount(source);
 assert.equal(excerpt.hasMore,true);
 assert.ok(excerpt.excerpt.trim().split(/\s+/).length>=100);
 assert.ok(excerpt.excerpt.length<source.length);
});

test("on-demand preview follows only same-host, validated Stiften async fragments",()=>{
 const api=readFileSync(new URL("../app/api/article-preview/route.ts",import.meta.url),"utf8");
 const feed=readFileSync(new URL("../lib/live-news.ts",import.meta.url),"utf8");
 const card=readFileSync(new URL("../components/news-feed.tsx",import.meta.url),"utf8");
 assert.match(api,/articleUrl.searchParams.delete\("rss"\)/);
 assert.match(api,/endpoint.hostname===articleUrl.hostname/);
 assert.match(api,/resolved.hostname===articleUrl.hostname/);
 assert.match(api,/extractStiftenPublicFragment\(fragment,title,rssIntro\)/);
 assert.match(api,/titleMatches\(title,html\)/);
 assert.match(feed,/const wantsStiftenExpansion = isStiften/);
 assert.match(card,/Kort artikeluddrag fra Stiften\.dk – ikke et AI-resumé/);
});

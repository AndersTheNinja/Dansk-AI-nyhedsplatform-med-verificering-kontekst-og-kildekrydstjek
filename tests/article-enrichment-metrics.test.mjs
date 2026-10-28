import test from "node:test";
import assert from "node:assert/strict";
import { measureArticleEnrichment } from "../lib/article-enrichment-metrics.ts";

const entry=(source,description)=>({lead:{source,description}});

test("reports how many short publisher teasers actually become sufficient",()=>{
 const initial=[
  entry("Version2","For kort"),
  entry("Ingeniøren","Ligeledes ganske kort"),
  entry("DR",Array(30).fill("ord").join(" "))
 ];
 const after=[
  entry("Version2",Array(40).fill("ord").join(" ")),
  entry("Ingeniøren","Ligeledes ganske kort"),
  initial[2]
 ];
 const r=measureArticleEnrichment(initial,after,2);
 assert.equal(r.examined,3);
 assert.equal(r.attempted,2);
 assert.equal(r.beforeShort,2);
 assert.equal(r.afterShort,1);
 assert.equal(r.resolved,1);
 assert.equal(r.expanded,1);
 assert.equal(r.stillShort,1);
 assert.equal(r.resolvedPct,50);
 assert.equal(r.anyTextExpanded,1);
 assert.deepEqual(r.publishers,[
  {source:"Version2",beforeShort:1,resolved:1,expanded:1},
  {source:"Ingeniøren",beforeShort:1,resolved:0,expanded:0}
 ]);
});

test("counts no invented improvements when responses remain unchanged",()=>{
 const stories=[entry("Politiken","Et kort uddrag")];
 const r=measureArticleEnrichment(stories,stories,1);
 assert.equal(r.resolved,0);
 assert.equal(r.expanded,0);
 assert.equal(r.resolvedPct,0);
});

test("never includes article body or URLs in metrics",()=>{
 const secret="Personlig tekst der kun findes i artiklen";
 const report=measureArticleEnrichment([entry("Børsen",secret)],[entry("Børsen",Array(35).fill("ord").join(" "))],1);
 assert.equal(JSON.stringify(report).includes(secret),false);
});

import test from "node:test";
import assert from "node:assert/strict";
import { auditNewsStories, repairNewsStories, deduplicatePublisherHeadlines } from "../lib/news-quality.ts";
const base = {
 id:"a",title:"Nyhed om DNA og kriminalsag",sourceLabel:"DR",published:"I dag",
 publishedAt:"2026-10-27T12:00:00.000Z",
 summary:"En nyhed om efterforskning med DNA og politiets arbejde. Sagen handler om forhold som er beskrevet i den offentliggjorte artikel og rummer flere konkrete oplysninger, som læserne kan undersøge nærmere.",
 imageUrl:"https://img.dr.dk/DNA-efterforskning.jpg",
 sources:[{label:"DR",url:"https://www.dr.dk/nyheder/a"}]
};
test("quality audit detects editorial boilerplate and short texts",()=>{
 const report=auditNewsStories([{...base,summary:"Kort intro. Da du er ved at tilmelde dig en gratis prøve beder vi dig vælge interesser."}],Date.parse("2026-10-28T00:00:00Z"));
 assert.equal(report.issueCounts.publisher_ui,1);
 assert.equal(report.issueCounts.short_text,1);
 assert.equal(report.checked,1);
});
test("flags exact publisher duplicate but not second publisher",()=>{
 const another={...base,id:"b",sources:[{label:"Version2",url:"https://version2.dk/article/b"}],sourceLabel:"Version2"};
 const report=auditNewsStories([base,{...base,id:"dup"},another],Date.parse("2026-10-28T00:00:00Z"));
 assert.equal(report.issueCounts.duplicate,1);
});
test("detects future timestamp and generic imagery without dropping stories",()=>{
 const report=auditNewsStories([{...base,publishedAt:"2026-11-01T12:00:00.000Z",imageUrl:"https://cdn.dr.dk/default.jpg"}],Date.parse("2026-10-28T00:00:00Z"));
 assert.equal(report.issueCounts.future_date,1);
 assert.equal(report.issueCounts.generic_image,1);
 assert.equal(report.checked,1);
});
test("repair removes trailing publisher signup text but keeps editorial paragraph",()=>{
 const clean="Her er nyheden. Den indeholder oplysninger fra artiklen og bygger på publiceret tekst.";
 const contaminated=clean+" Da du er ved at tilmelde dig en gratis prøve beder vi dig vælge interesser.";
 const result=repairNewsStories([{...base,summary:contaminated}]);
 assert.equal(result.stories[0].summary,clean);
 assert.equal(result.repairs.boilerplate,1);
});
test("repair discards only duplicate URLs and generic pictures, not short stories",()=>{
 const short={...base,id:"short",summary:"Kort nyhed.",imageUrl:"https://cdn.dr.dk/default.jpg"};
 const duplicate={...short,id:"duplicate",summary:"Andet uddrag"};
 const different={...short,id:"separate",sources:[{label:"DR",url:"https://www.dr.dk/nyheder/other"}]};
 const out=repairNewsStories([short,duplicate,different]);
 assert.equal(out.stories.length,2);
 assert.equal(out.stories[0].summary,"Kort nyhed.");
 assert.equal(out.stories[0].imageUrl,undefined);
 assert.equal(out.repairs.duplicate,1);
 assert.equal(out.repairs.genericImage,2);
});


test("quality audit flags Computerworld site description in a real news headline",()=>{
 const generic="Nyheder, analyser, viden, blogs og debat om it. Computerworld er dit medie om det digitale Danmark. Computerworld skriver om nye teknologier, hardware, software, informationssamfundet, internettet, it-branchen, telebranchen, it-ledelse, it-strategi, forretnings-it, it-job og meget mere.";
 const bad={...base,id:"computerworld-generic",title:"Få dage efter lancering: Brugere klager over tydelig ridse i foldbar iPhone",sourceLabel:"Computerworld",summary:generic,sources:[{label:"Computerworld",url:"https://www.computerworld.dk/art/999"}]};
 const report=auditNewsStories([bad],Date.parse("2026-10-28T00:00:00Z"));
 assert.equal(report.issueCounts.publisher_ui,1);
 assert.equal(report.examples[0].source,"Computerworld");
});

test("same publisher, title and publication time collapse even with different URLs and summaries", () => {
 const title = "Her er de ni modtagere af Politikens Undervisningspris";
 const first = {...base,id:"pol-1",title,publishedAt:"2026-11-24T05:56:00Z",sourceLabel:"Politiken",sources:[{label:"Politiken",url:"https://politiken.dk/art/1"}]};
 const duplicate = {...first,id:"pol-2",summary:"Et andet AI-resumé",sources:[{label:"Politiken",url:"https://politiken.dk/art/2"}]};
 const otherPublisher = {...first,id:"other",sourceLabel:"DR",sources:[{label:"DR",url:"https://dr.dk/art/3"}]};
 const later = {...first,id:"later",publishedAt:"2026-11-25T05:56:00Z",sources:[{label:"Politiken",url:"https://politiken.dk/art/4"}]};
 const otherTitle = {...first,id:"distinct",title:"Andre modtagere af en ny undervisningspris",sources:[{label:"Politiken",url:"https://politiken.dk/art/5"}]};
 assert.deepEqual(deduplicatePublisherHeadlines([first,duplicate,otherPublisher,later,otherTitle]).map(x=>x.id),["pol-1","other","later","distinct"]);
});

test("same-minute Politiken versions with rewritten headlines collapse; different reporting remains", () => {
 const first = {...base,id:"kejs-1",title:"Netflix-serien forgylder et kejserrige med blod på hænderne",sourceLabel:"Politiken",publishedAt:"2026-11-24T05:53:00Z",summary:"Politikens klumme kritiserer Netflix-serien Kejserinden for at være præget af pragt og romantik. Ifølge skribenten lader serien Østrigs mørke historie stå i baggrunden, mens kejserinden",sources:[{label:"Politiken",url:"https://politiken.dk/art/1"}]};
 const duplicate = {...first,id:"kejs-2",title:"Netflix-serie er underholdende som karneval i Rio",summary:"Politikens klumme beskriver Netflix-serien Kejserinden som pragtfuld og romantisk, men kritiserer dens historiske fokus. Ifølge teksten lægger serien Østrigs mørke historie i baggrunden, mens den",sources:[{label:"Politiken",url:"https://politiken.dk/art/2"}]};
 const crossPublisher = {...duplicate,id:"other-publisher",sourceLabel:"DR",sources:[{label:"DR",url:"https://dr.dk/art/2"}]};
 const different = {...first,id:"distinct",title:"Netflix-serien får rekordmange seere",summary:"Netflix-serien har slået streamingrekorder i Danmark, hvor seerne i weekenden har set flere millioner timer af den nye sæson. Selskabet offentliggør tallene tirsdag.",sources:[{label:"Politiken",url:"https://politiken.dk/art/3"}]};
 const later = {...duplicate,id:"later",publishedAt:"2026-11-25T05:53:00Z",sources:[{label:"Politiken",url:"https://politiken.dk/art/4"}]};
 assert.deepEqual(deduplicatePublisherHeadlines([first,duplicate,crossPublisher,different,later]).map(x=>x.id),["kejs-1","other-publisher","distinct","later"]);
 // Stored AI summaries can carry the match even if the raw publisher excerpts differ.
 assert.equal(deduplicatePublisherHeadlines([{...first,aiSummary:first.summary,summary:"Kort teaser"},{...duplicate,aiSummary:duplicate.summary,summary:"Anden teaser"}]).length,1);
});

test("real Politiken article ID survives rewritten slugs and dissimilar short excerpts", () => {
 const first = {...base,id:"actual-current",title:"Netflix-serien forgylder et kejserrige med blod på hænderne",sourceLabel:"Politiken",publishedAt:"2026-11-24T05:53:55Z",summary:"Kort aktuelt kildeuddrag.",sources:[{label:"Politiken",url:"https://politiken.dk/kultur/set_og_hoert/art11053519/Netflix-serien-forgylder-et-kejserrige-med-blod-p%C3%A5-h%C3%A6nderne"}]};
 const rewritten = {...first,id:"actual-old",title:"Netflix-serie er underholdende som karneval i Rio",publishedAt:"2026-11-24T05:53:55+00:00",summary:"En anden tidligere introduktion.",sources:[{label:"Politiken",url:"https://www.politiken.dk/kultur/set_og_hoert/art11053519/Netflix-serie-er-underholdende-som-karneval-i-Rio?rss"}]};
 const distinct = {...first,id:"different-id",title:"Et selvstændigt interview med seriens instruktør",sources:[{label:"Politiken",url:"https://politiken.dk/kultur/art11053520/Interview"}]};
 const independent = {...rewritten,id:"independent",sourceLabel:"DR",sources:[{label:"DR",url:"https://dr.dk/kultur/art11053519/Anmeldelse"}]};
 const lookalike = {...rewritten,id:"lookalike",sources:[{label:"Politiken",url:"https://politiken.dk.example.org/kultur/art11053519/Anden"}]};
 assert.deepEqual(deduplicatePublisherHeadlines([first,rewritten,distinct,independent,lookalike]).map(x=>x.id),["actual-current","different-id","independent","lookalike"]);
 assert.equal(deduplicatePublisherHeadlines([rewritten,first])[0],rewritten);
 assert.equal(deduplicatePublisherHeadlines([rewritten,first]).length,1);
});

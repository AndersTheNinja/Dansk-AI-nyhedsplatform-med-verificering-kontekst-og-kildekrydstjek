import test from "node:test";
import assert from "node:assert/strict";
import { auditNewsStories, repairNewsStories } from "../lib/news-quality.ts";
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

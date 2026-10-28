import test from "node:test";
import assert from "node:assert/strict";
import { auditNewsStories } from "../lib/news-quality.ts";
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
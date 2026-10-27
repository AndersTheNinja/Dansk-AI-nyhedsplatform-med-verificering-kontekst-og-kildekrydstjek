import test from "node:test";
import assert from "node:assert/strict";
import { hasPublisherInterfaceText, isEditorialParagraph, previewWordCount } from "../lib/article-preview-quality.ts";

const bad = [
  "Opret et personligt gavelink til nogen, du synes skal læse denne artikel.",
  "Du skal selv have adgang til denne artikel for at kunne give den i gave, enten via et betalt abonnement eller et IDA-medlemskab.",
  "Kunne ikke generere link. Prøv igen.",
  "Log ind for at følge Du skal være logget ind for at følge en skribent.",
  "Med hjælp fra kunstig intelligens skal mediet Y producere nyheder på dansk. Log ind for at følge en skribent."
];

test("Ingeniøren interface text never counts as article copy", () => {
 for (const text of bad) assert.equal(hasPublisherInterfaceText(text), true, text);
});

test("reject contaminated article paragraphs even with genuine story copy at the end", () => {
 const contaminated = bad[0] + " " + bad[2] + " Med hjælp fra kunstig intelligens skal Danmarks nyeste nyhedsmedie producere nyheder på dansk.";
 assert.equal(isEditorialParagraph(contaminated), false);
});

test("preserve genuine news paragraphs", () => {
 const genuine = "Med hjælp fra kunstig intelligens skal Danmarks nyeste nyhedsmedie producere nyheder på dansk. Det nye medie går i luften tirsdag.";
 assert.equal(hasPublisherInterfaceText(genuine), false);
 assert.equal(isEditorialParagraph(genuine), true);
});

test("skip image credits, recommendations, and short navigation fragments", () => {
 for (const value of ["Læs også: Nyheder om medier og teknologi i Danmark", "Foto: Ritzau Scanpix og fotografens navn", "Klik", "Abonnér og få adgang til vores artikelarkiv i dag"]) {
   assert.equal(isEditorialParagraph(value), false, value);
 }
});

test("a 100-word article excerpt only permits summary for 101+ words", () => {
 const exactly100 = Array.from({length:100},(_,i)=>"ord"+i).join(" ");
 const a=previewWordCount(exactly100);
 assert.equal(a.wordCount,100);
 assert.equal(a.hasMore,false);
 assert.equal(a.excerpt.split(" ").length,100);
 const b=previewWordCount(exactly100+" sidste");
 assert.equal(b.wordCount,101);
 assert.equal(b.hasMore,true);
 assert.equal(b.excerpt, a.excerpt);
});

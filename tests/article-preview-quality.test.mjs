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

test("article excerpts preserve at least 100 words and end at the next full stop", () => {
 const first99=Array.from({length:99},(_,i)=>"ord"+i).join(" ");
 const exactly100=first99+" ord99";
 const a=previewWordCount(exactly100);
 assert.equal(a.wordCount,100);
 assert.equal(a.hasMore,false);
 assert.equal(a.excerpt,exactly100);

 const article=first99+" ord99 fortsætter kl. 13.54 med 800.000 kr. i en vigtig sag. Næste sætning udelades.";
 const b=previewWordCount(article);
 assert.equal(b.hasMore,true);
 assert.equal(b.excerpt,first99+" ord99 fortsætter kl. 13.54 med 800.000 kr. i en vigtig sag.");
 assert.ok(b.excerpt.split(" ").length>100);
});

test("excerpt includes a sentence ending on word 100", () => {
 const first99=Array.from({length:99},(_,i)=>"ord"+i).join(" ");
 const result=previewWordCount(first99+" færdig. Dette skal ikke med.");
 assert.equal(result.excerpt,first99+" færdig.");
 assert.equal(result.hasMore,true);
});

test("excerpt does not stop at an earlier sentence or cut if none follows word 100", () => {
 const first90=Array.from({length:89},(_,i)=>"ord"+i).join(" ");
 const article=first90+" slut. "+Array.from({length:14},(_,i)=>"fortsættelse"+i).join(" ")+" rigtig slutning. Resten skjules.";
 const result=previewWordCount(article);
 assert.ok(result.excerpt.endsWith("rigtig slutning."));
 assert.doesNotMatch(result.excerpt,/Resten skjules/);
 const withoutEnding=Array.from({length:112},(_,i)=>"ord"+i).join(" ");
 assert.equal(previewWordCount(withoutEnding).excerpt,withoutEnding);
});

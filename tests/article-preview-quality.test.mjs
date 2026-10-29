import test from "node:test";
import assert from "node:assert/strict";
import { hasPublisherInterfaceText, isEditorialParagraph, joinArticleParagraphs, previewWordCount, publisherDescriptionKey, repeatedPublisherDescriptionKeys, repairMissingSentenceStops, stripPublisherBoilerplate } from "../lib/article-preview-quality.ts";

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

test("the summary button becomes eligible only when the source exceeds 100 words", () => {
 const exactly100 = Array.from({length:100},(_,i)=>"ord"+i).join(" ")+".";
 const a=previewWordCount(exactly100);
 assert.equal(a.wordCount,100);
 assert.equal(a.hasMore,false);
 assert.equal(a.excerpt.split(" ").length,100);
 const b=previewWordCount(exactly100+" Nu skal");
 assert.equal(b.wordCount,102);
 assert.equal(b.hasMore,true);
 assert.equal(b.excerpt,exactly100);
});

test("complete the first sentence after word 100 instead of cutting abruptly", () => {
 const first=Array.from({length:80},(_,i)=>"ord"+i).join(" ")+".";
 const second=Array.from({length:35},(_,i)=>"fortsættelse"+i).join(" ")+".";
 const text=first+" "+second+" Nu skal næste historie i gang.";
 const out=previewWordCount(text);
 assert.equal(out.excerpt, first+" "+second);
 assert.equal(out.wordCount,121);
 assert.equal(out.hasMore,true);
 assert.match(out.excerpt,/\.$/);
});

test("use the last complete sentence if the source ends mid-sentence", () => {
 const text="Vi starter dagens overblik med en tur ned ad Frederiksgade. "+
 "Der er gang i den, når det kommer til take-away, men også i byens restaurationsliv generelt. Nu skal";
 const out=previewWordCount(text);
 assert.equal(out.excerpt.endsWith("restaurationsliv generelt."),true);
 assert.equal(out.excerpt.includes("Nu skal"),false);
});

test("do not treat abbreviations and bare URLs as full sentences", () => {
 const text="Du kan læse historien på stiften.dk/spoerg og følge udviklingen i Aarhus. "+
 Array.from({length:95},(_,i)=>"ord"+i).join(" ")+" og nu slutter sætningen.";
 const out=previewWordCount(text);
 assert.equal(out.excerpt.endsWith("sætningen."),true);
 assert.equal(out.excerpt.includes("stiften.dk/spoerg"),true);
});

test("source with no full sentence is marked as incomplete, not given fake punctuation", () => {
 const text=Array.from({length:130},(_,i)=>"ord"+i).join(" ");
 const out=previewWordCount(text);
 assert.equal(out.hasMore,true);
 assert.equal(out.excerpt.endsWith("…"),true);
});

test("remove Ingeniøren standard subscription and preference copy after article", () => {
 const editorial="Tipper du de danske myndigheder om landmænd, der dyrker ulovligt helt ned til vandløb, så sker der ingenting. Det er nemlig en helt fast praksis på området. Og det har været kommunikeret ud til landets kommuner gennem 12 år.";
 const noisy=editorial+" Da du er ved at tilmelde dig en gratis prøve beder vi dig hjælpe os med at gøre vores indhold mere relevant for dig, ved at vælge et eller flere emner der interesserer dig. Angiver du Ingeniøren som foretrukken kilde vil Google vise vores artikler højere oppe i dine søgeresultater.";
 const result=previewWordCount(noisy);
 assert.equal(result.excerpt, editorial);
 assert.equal(result.excerpt.includes("prøve"),false);
});

test("TV2 article screenshot: missing stop before capitalized Især is restored", () => {
 const original="Jeg tror aldrig før, man har oplevet så stor begejstring Især i de delstater, hvor der er mest spænding om udfaldet ved midtvejsvalget, viser tallene, at der er højere valgdeltagelse.";
 const expected="Jeg tror aldrig før, man har oplevet så stor begejstring. Især i de delstater, hvor der er mest spænding om udfaldet ved midtvejsvalget, viser tallene, at der er højere valgdeltagelse.";
 assert.equal(repairMissingSentenceStops(original),expected);
 assert.equal(previewWordCount(original).excerpt,expected);
});

test("restore only clear sentence openers, not capitals inside names", () => {
 const original="Det skriver New York Times og DR Nyheder. Især i Florida er køerne lange. USA's præsident sagde, at det især er vigtigt.";
 assert.equal(repairMissingSentenceStops(original),original);
 assert.equal(repairMissingSentenceStops("Vi så stor fremgang Samtidig voksede interessen."),"Vi så stor fremgang. Samtidig voksede interessen.");
 assert.equal(repairMissingSentenceStops("Det skete i København Især blev det bemærket."),"Det skete i København Især blev det bemærket.");
 assert.equal(repairMissingSentenceStops("Det var især svært for dem."),"Det var især svært for dem.");
});

test("preserve punctuation between verified separate HTML article paragraphs", () => {
 const parts=["Jeg har aldrig set så stor begejstring","Især i de delstater, hvor valget bliver tæt.", "Det fremgår af de nye tal!"];
 assert.equal(joinArticleParagraphs(parts),
 "Jeg har aldrig set så stor begejstring. Især i de delstater, hvor valget bliver tæt. Det fremgår af de nye tal!");
 assert.equal(joinArticleParagraphs(["Tallet var 48.", "Her er forklaringen."]), "Tallet var 48. Her er forklaringen.");
});

test("do not invent punctuation between lower-case continuations or after colons", () => {
 assert.equal(joinArticleParagraphs(["Ifølge rapporten", "er forholdene ændret"]), "Ifølge rapporten er forholdene ændret");
 assert.equal(joinArticleParagraphs(["Ministeriet oplyser:", "Det bliver undersøgt."]), "Ministeriet oplyser: Det bliver undersøgt.");
 assert.equal(joinArticleParagraphs(["", "En enkelt sætning"]), "En enkelt sætning");
});


test("DR article: no stray spaces before punctuation in article excerpts", () => {
 const original="De siger en række kampagnemedarbejdere til New York Times . Og hvis det er sandt, kan det skade tilliden.";
 const expected="De siger en række kampagnemedarbejdere til New York Times. Og hvis det er sandt, kan det skade tilliden.";
 assert.equal(repairMissingSentenceStops(original), expected);
 assert.equal(previewWordCount(original).excerpt, expected);
 assert.equal(repairMissingSentenceStops(expected), expected);
});

test("punctuation cleanup leaves proper names, quotation dashes and ordinary dates intact", () => {
 const source="Den 3. november udtaler Trine Maria Ilsøe. - Beskidte tricks er set før, siger hun!";
 assert.equal(repairMissingSentenceStops(source), source);
 assert.equal(repairMissingSentenceStops("Hvem ? Svar : ja !"), "Hvem? Svar: ja!");
});


const computerworldAboutText = "Nyheder, analyser, viden, blogs og debat om it. Computerworld er dit medie om det digitale Danmark. Computerworld skriver om nye teknologier, hardware, software, informationssamfundet, internettet, it-branchen, telebranchen, it-ledelse, it-strategi, forretnings-it, it-job og meget mere.";

test("Computerworld site-wide RSS description is not article text", () => {
 assert.equal(hasPublisherInterfaceText(computerworldAboutText), true);
 assert.equal(isEditorialParagraph(computerworldAboutText), false);
 assert.equal(stripPublisherBoilerplate(computerworldAboutText), "");
 assert.equal(previewWordCount(computerworldAboutText).excerpt, "");
 assert.equal(previewWordCount(computerworldAboutText).wordCount, 0);
});

test("keep article text before unrelated Computerworld publisher blurb", () => {
 const intro = "Der er opdaget en tydelig ridse i en foldbar telefon få dage efter lanceringen.";
 assert.equal(stripPublisherBoilerplate(intro+" "+computerworldAboutText),intro);
});

test("do not reject genuinely editorial Computerworld article descriptions", () => {
 const article = "Få dage efter lanceringen klager nogle brugere over en tydelig ridse på skærmen af en foldbar telefon. Producenten undersøger nu anmeldelserne.";
 assert.equal(hasPublisherInterfaceText(article), false);
 assert.equal(previewWordCount(article).excerpt,article);
});

test("detect publisher-site description even without its leading sentence", () => {
 const middle = "Computerworld er dit medie om det digitale Danmark. Computerworld skriver om nye teknologier, hardware, software og meget mere.";
 assert.equal(isEditorialParagraph(middle),false);
 assert.equal(stripPublisherBoilerplate(middle),"");
});


test("site/about copy from any publisher is rejected while true article intros survive", () => {
 const generic = [
  "Berlingske er din avis for nyheder om Danmark og verden. Her får du overblikket.",
  "Her finder du de seneste nyheder fra Danmark og udlandet, sport og erhverv.",
  "Hold dig opdateret med de seneste analyser fra politik og erhverv hos os.",
  "Velkommen til Danmarks nyhedssite med artikler, analyser og debat."
 ];
 for (const text of generic) {
  assert.equal(hasPublisherInterfaceText(text), true, text);
  assert.equal(stripPublisherBoilerplate(text), "", text);
  assert.equal(isEditorialParagraph(text), false, text);
 }
 const news = [
  "Berlingske skriver, at den nye direktør tiltræder stillingen i november.",
  "Et medie skriver om nye regler for elbiler, som træder i kraft næste år.",
  "De seneste nyheder fra Ukraine handler om forhandlingerne mellem landene."
 ];
 for (const text of news) {
  assert.equal(hasPublisherInterfaceText(text), false, text);
  assert.equal(stripPublisherBoilerplate(text), text, text);
 }
});

test("same generic description on three unrelated stories from the same unknown publisher is rejected", () => {
 const source = "NytMedie.dk";
 const description = "Vi dækker de store begivenheder og giver læserne nyheder, perspektiver, debat og baggrund fra både indland, erhverv og udland. Følg os hver dag.";
 const entries = [
  {source,title:"Regeringen præsenterer finanslov for næste år",description},
  {source,title:"Ny software ændrer arbejdsdagen i danske virksomheder",description},
  {source,title:"Stort jordskælv ryster regionen tidligt om morgenen",description}
 ];
 const key = publisherDescriptionKey(source, description);
 assert.equal(repeatedPublisherDescriptionKeys(entries).has(key), true);
 // Same rules independently for other publishers, including future feeds.
 assert.equal(repeatedPublisherDescriptionKeys(entries.map(item=>({...item,source:"DR"}))).has(publisherDescriptionKey("DR",description)),true);
});

test("do not mistake same teaser on one developing story for publisher boilerplate", () => {
 const source="Politiken";
 const description="Den nye rapport om renten viser, at den økonomiske udvikling i Danmark fortsat er usikker. Økonomer diskuterer nu centralbankens beslutning.";
 const titles=[
   "Nationalbanken hæver renten efter ny rapport",
   "Ny rapport: Nationalbanken hæver renten",
   "Renten hæves ifølge ny rapport fra Nationalbanken",
   "Eksperter vurderer ny rapport om renten"
 ];
 const entries=titles.map(title=>({source,title,description}));
 assert.equal(repeatedPublisherDescriptionKeys(entries).size,0);
});

test("repeated publisher descriptions never combine across different publishers", () => {
 const description="Nyheder og analyser fra danske medier giver indsigt i samfundets udvikling, økonomi, sport og kultur og kan læses på nyhedssider verden over.";
 const entries=[
  {source:"DR",title:"Klimakrise forværres",description},
  {source:"Berlingske",title:"Bank får ny direktør",description},
  {source:"Version2",title:"Robot udvikles på universitet",description}
 ];
 assert.equal(repeatedPublisherDescriptionKeys(entries).size,0);
});

test("different legitimate descriptions for different stories are never removed", () => {
 const entries=[
  {source:"DR",title:"Statsministeren møder nye ministre",description:"Regeringen præsenterede onsdag en række nye initiativer i forbindelse med det kommende folketingsår."},
  {source:"DR",title:"Et stort fly forsinket i Aalborg",description:"Afgangene er sat på pause efter en teknisk fejl på et fly i lufthavnen torsdag morgen."},
  {source:"DR",title:"Kommunen får ny direktør",description:"Bestyrelsen har besluttet at udpege en ny leder, som skal begynde til januar."}
 ];
 assert.equal(repeatedPublisherDescriptionKeys(entries).size,0);
});

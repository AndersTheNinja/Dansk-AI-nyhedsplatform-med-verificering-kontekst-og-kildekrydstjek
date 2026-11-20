import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import {createRequire} from "node:module";
import {renderToStaticMarkup} from "react-dom/server";
import ts from "typescript";
const exports={};
runInNewContext(ts.transpileModule(readFileSync(new URL("../components/ai-summary-preview.tsx",import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:createRequire(import.meta.url)});
const rendered=(text,expanded)=>renderToStaticMarkup(exports.AiSummaryPreview({story:{aiSummary:text},expanded})).replace(/<[^>]+>/g,"");
test("summary shows 35 words collapsed and keeps the complete stored summary when expanded",()=>{
 const summary=Array.from({length:90},(_,i)=>`ord${i+1}`).join(" ");
 assert.equal(rendered(summary,false),summary.split(" ").slice(0,35).join(" ")+"…");
 assert.equal(rendered(summary,true),summary);
 assert.equal(rendered(summary,false).split(" ").length,35);
});
test("short verified summaries are never padded or needlessly truncated",()=>{
 const summary=Array(22).fill("ord").join(" ")+".";
 assert.equal(rendered(summary,false),summary);
 assert.equal(rendered(summary,true),summary);
});

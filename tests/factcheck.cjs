const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync('lib/factcheck.ts','utf8');
const context = { exports: {}, URL, AbortSignal, Date, fetch: () => { throw Error('Unexpected network'); } };
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
const api=context.exports;
const article={ title:'En konkret påstand om en begivenhed',text:'Det offentlige uddrag fortæller om begivenheden.',url:'https://www.dr.dk/nyheder/artikel',publishedAt:'2026-10-25T12:00:00Z',primarySource:'DR' };
const citation=(url,title='Kildedokument')=>({type:'url_citation',url,title});
const research=(annotations,withSearch=true)=>({status:'completed',output:[...(withSearch?[{type:'web_search_call',status:'completed',action:{sources:[{url:'https://myndighed.dk/rapport'}]}}]:[]),{type:'message',content:[{type:'output_text',text:'Research med kildehenvisning.',annotations}]}]});
const refs=[{id:1,url:'https://myndighed.dk/rapport',title:'Rapport',domain:'myndighed.dk'}];
test('citation positions bind research statements to the same numbered links used in claims',()=>{
 const text='Rapporten dokumenterer påstanden. CITE';
 const data={output:[{content:[{type:'output_text',text,annotations:[{...citation(refs[0].url),start_index:text.indexOf('CITE'),end_index:text.length}]}]}]};
 assert.equal(api.annotatedResearchText(data,refs),'Rapporten dokumenterer påstanden.  [1]');
});

test('only retrieved citations can become evidence; own publisher, unsafe URLs and duplicates are excluded',()=>{
 const result=api.researchReferences(research([citation('https://www.dr.dk/nyheder/egen'),citation('https://www.dr.dk.evil.example/a'),citation('javascript:alert(1)'),citation('https://127.0.0.1/a'),citation('https://user:secret@myndighed.dk/rapport'),citation('https://myndighed.dk/rapport'),citation('https://myndighed.dk/rapport#fragment')]),article.url);
 assert.equal(result.length,2);
 assert.equal(result[1].url,refs[0].url);
 assert.equal(api.researchReferences(research([citation('https://under.dr.dk/egen')]),article.url).length,0);
});
test('fabricated source IDs cannot confirm or contradict claims',()=>{
 for(const status of ['bekræftet','modstridt']){
  const result=api.normalizeFactResult({score:100,conclusion:'Helt sikkert sandt!',claims:[{statement:'Påstand',status,sourceIds:[99,'1'],explanation:'Opfundet bevis'}]},refs,article,1);
  assert.equal(result.claims[0].status,'ikke verificeret');
  assert.equal(result.verdict,'usikkert');
  assert.equal(result.references.length,0);
  assert.ok(result.score<=40);
  assert.doesNotMatch(result.conclusion,/Helt sikkert/);
 }
});
test('source-linked contradiction and mixed evidence retain their distinct statuses',()=>{
 const result=api.normalizeFactResult({score:95,claims:[{statement:'A',status:'modstridt',sourceIds:[1,1]},{statement:'B',status:'ikke verificeret',sourceIds:[]}]},refs,article,2);
 assert.equal(result.verdict,'blandet'); assert.equal(result.claims[0].status,'modstridt');
 assert.equal(result.claims[0].sourceIds.length,1); assert.equal(result.otherMedia.count,1); assert.equal(result.score,75);
});
test('actual search precedes structured assessment, with retrieved source IDs and original article text',async()=>{
 const calls=[];
 const analysis={score:80,neutrality:{score:90,balance:'Kun uddrag vurderet',language:'Neutralt',explanation:''},conclusion:'Dokumenteret med et forbehold.',claims:[{statement:'En konkret påstand',status:'bekræftet',explanation:'Dokumenteret af rapporten.',sourceIds:[1]}]};
 const result=await api.runFactCheck(article,{key:'fixture-key',model:'fixture-model'},async(url,options)=>{
  const payload=JSON.parse(options.body);calls.push(payload);
  return {ok:true,json:async()=>calls.length===1?research([citation(refs[0].url)]):{status:'completed',output_text:JSON.stringify(analysis)}};
 });
 assert.equal(calls.length,2);assert.equal(calls[0].tool_choice,'required');assert.equal(calls[0].max_tool_calls,3);
 assert.ok(calls[0].tools[0].filters.blocked_domains.includes('dr.dk'));
 assert.equal(calls[1].text.format.strict,true);assert.equal(JSON.parse(calls[1].input).article.text,article.text);
 assert.equal(result.references[0].url,refs[0].url);assert.equal(result.claims[0].status,'bekræftet');
 assert.equal(result.search.performed,true);assert.equal(result.otherMedia.count,1);
});
test('absence of results is unverified and never a contradiction; failed search is an explicit error',async()=>{
 const noResults=await api.runFactCheck(article,{key:'test',model:'fixture'},async()=>({ok:true,json:async()=>research([])}));
 assert.equal(noResults.verdict,'usikkert');assert.equal(noResults.neutrality.score,null);
 await assert.rejects(api.runFactCheck(article,{key:'test',model:'fixture'},async()=>({ok:true,json:async()=>research([],false)})),/ikke gennemført/);
 await assert.rejects(api.runFactCheck(article,{key:'test',model:'fixture'},async()=>({ok:false})),/kunne ikke/);
});

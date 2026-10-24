const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(fetch, env) {
  const source = fs.readFileSync('lib/news-store.ts', 'utf8');
  const compiled = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const context = {exports:{},process:{env},fetch,URL,AbortSignal,console};
  vm.runInNewContext(compiled,context);
  return context.exports;
}
const env = {SUPABASE_URL:'https://test.supabase.co',SUPABASE_PUBLISHABLE_KEY:'public-test-key',OEL_INGEST_SECRET:'test-secret'};
const story = url => ({title:'En ny artikel om Aarhus',sources:[{url,label:'DR'}]});
test('repair queue sends canonical original URLs through the authenticated ingestion channel',async()=>{
  const calls=[];
  const api=load(async(url,options)=>{calls.push({url,options});return {ok:true};},env);
  await api.queuePreviewRepairs([story('https://www.dr.dk/nyheder/artikel/?utm_source=rss'),story('https://user:pass@www.dr.dk/secret'),story('http://www.dr.dk/insecure'),story('https://www.dr.dk:8443/other')]);
  assert.equal(calls.length,1);
  assert.equal(calls[0].options.headers['x-oel-ingest-secret'],'test-secret');
  assert.deepEqual(JSON.parse(calls[0].options.body).payload,[{url:'https://www.dr.dk/nyheder/artikel',source:'DR',title:'En ny artikel om Aarhus'}]);
});
test('missing configuration does not send requests and queue errors remain observable',async()=>{
  let calls=0;
  await load(async()=>{calls++;},{}).queuePreviewRepairs([story('https://www.dr.dk/nyheder/artikel')]);
  assert.equal(calls,0);
  await assert.rejects(load(async()=>({ok:false,status:503}),env).queuePreviewRepairs([story('https://www.dr.dk/nyheder/artikel')]),/503/);
});

const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

// Run the real adapter with fixture-only configuration and networking.
module.exports = function loadDatabaseRpc(fetch, env = {}) {
  const context = { exports: {}, process: { env }, fetch, Headers, Response, require };
  const source = fs.readFileSync('lib/database-rpc.ts', 'utf8');
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText, context);
  return context.exports;
};

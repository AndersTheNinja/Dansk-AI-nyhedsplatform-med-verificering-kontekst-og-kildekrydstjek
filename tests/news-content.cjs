const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(fetch) {
  const source = fs.readFileSync('lib/live-news.ts', 'utf8') + '\nexport { enrichTV2Item, enrichBorsenItem, parseNewsDate, enrichPreview, extractScopedArticlePreview, articleMentionText };';
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const context = { exports: {}, fetch, AbortSignal, URL, console, require: (id) => id === 'fast-xml-parser' ? require(id) : { persistStories: async () => {} } };
  vm.runInNewContext(compiled, context);
  return context.exports;
}

const item = { title: 'Aarhus åbner svømmehal ved havnen', description: 'Det oprindelige uddrag.', link: 'https://nyheder.tv2.dk/samfund/artikel', source: 'TV2.dk', category: 'Danmark', method: 'RSS', id: 'original' };
test('publisher local timestamps resolve to Copenhagen time in summer and winter', () => {
  const api = load();
  assert.equal(api.parseNewsDate('2026-10-18 16:50:20').toISOString(), '2026-10-18T14:50:20.000Z');
  assert.equal(api.parseNewsDate('2026-01-18 16:50:20').toISOString(), '2026-01-18T15:50:20.000Z');
  assert.equal(api.parseNewsDate('Sun, 18 Oct 2026 16:54:43 +0200').toISOString(), '2026-10-18T14:54:43.000Z');
});
for (const fn of ['enrichTV2Item', 'enrichBorsenItem']) {
  test(`${fn} retains original article when landing page describes another story`, async () => {
    const api = load(async () => ({ ok: true, text: async () => '<meta property="og:title" content="Amerikansk præsident vinder valget"><script>{"headline":"Amerikansk præsident vinder valget","articleBody":"Helt anden artikeltekst om valget i USA."}</script>' }));
    assert.equal(await api[fn](item), item);
  });
  test(`${fn} excludes unrelated navigation paragraphs`, async () => {
    const api = load(async () => ({ ok: true, text: async () => `<meta property="og:title" content="${item.title}"><meta name="description" content="Aarhus får en ny svømmehal ved havnen. Kommunen åbner anlægget for byens borgere til sommer."><p>${'Uvedkommende navigation og abonnementstilbud. '.repeat(20)}</p>` }));
    const result = await api[fn](item);
    assert.match(result.description, /Kommunen åbner/);
    assert.doesNotMatch(result.description, /Uvedkommende/);
  });
}
test('related stories retain the newest article body and its original source URL', async () => {
  const title = item.title;
  const newest = new Date(Date.now() - 60000).toUTCString();
  const older = new Date(Date.now() - 120000).toISOString();
  const api = load(async (url) => ({ ok: true, text: async () => {
    const articles = url.includes('allenyheder') ? [{ link: 'https://dr.dk/new', pubDate: newest, description: 'Kommunen åbner snart svømmehallen.' }] : url.includes('feeds/indland') ? [{ link: 'https://dr.dk/old', pubDate: older, description: 'Ældre tekst fra samme udgiver. '.repeat(10) }] : url.includes('politiken.dk') ? [{ link: 'https://politiken.dk/other', pubDate: older, description: 'En anden redaktions lange beskrivelse. '.repeat(12) }] : [];
    return '<rss><channel>' + articles.map(a => `<item><title>${title}</title><link>${a.link}</link><pubDate>${a.pubDate}</pubDate><description>${a.description}</description></item>`).join('') + '</channel></rss>';
  } }));
  const stories = await api.getLiveStories({ fast: true });
  assert.equal(stories.length, 1);
  assert.equal(stories[0].summary, 'Kommunen åbner snart svømmehallen.');
  assert.equal(stories[0].publishedAt, new Date(newest).toISOString());
  assert.equal(stories[0].sources[0].url, 'https://dr.dk/new');
  assert.equal(stories[0].sources.length, 2);
});

test('scoped previews exclude image captions and related-story paragraphs', () => {
  const api = load();
  const html = `<article><p>Aarhus åbner en ny svømmehal ved havnen. Kommunen inviterer alle borgere til åbningen.</p><figure><p>Arkivfoto af en svømmehal i en anden by.</p></figure><p class="image-caption">Billedtekst som ikke hører til brødteksten.</p><aside><p>Anders Winnerskjold omtales i en anden historie.</p></aside><p>Svømmehallen får åbent hver dag fra morgen til aften.</p></article>`;
  const result = api.extractScopedArticlePreview(html, item.title, 'Aarhus åbner en ny svømmehal');
  assert.match(result, /morgen til aften/);
  assert.doesNotMatch(result, /Arkivfoto|Billedtekst|Winnerskjold/);
});

test('person detection searches the article, excluding navigation and related stories', () => {
  const api = load();
  assert.doesNotMatch(api.articleMentionText('<nav>Anders Winnerskjold</nav><article><p>Kommunen åbner en svømmehal.</p><aside>Anders Winnerskjold</aside></article>'), /Winnerskjold/);
  assert.match(api.articleMentionText('<article><p>Borgmester Anders Winnerskjold deltager i åbningen.</p></article>'), /Winnerskjold/);
});

test('Stiften prefers its public article endpoint and detects names beyond the teaser', async () => {
  const title = item.title;
  const body = '<p>Kommunen åbner det nye anlæg til sommer. Der bliver plads til både familier og foreninger.</p><p>Borgmester Anders Winnerskjold deltager ved åbningen sammen med lokale svømmeklubber.</p>';
  const api = load(async (url) => ({ ok: true, text: async () => url.includes('/article-body') ? body : `<meta property="og:title" content="${title}"><div data-load-async-url="/article-body"></div><article><p>${'Aarhus svømmehal ved havnen. '.repeat(35)}</p></article>` }));
  const result = await api.enrichPreview({...item, link:'https://stiften.dk/aarhus/svoemmehal', source:'Stiften.dk', category:'Aarhus'});
  assert.match(result.description, /familier og foreninger/);
  assert.ok(result.mentions.includes('anders-winnerskjold'));
  assert.doesNotMatch(result.description, /Aarhus svømmehal ved havnen/);
});

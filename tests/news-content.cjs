const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(fetch, env = {}) {
  const source = fs.readFileSync('lib/live-news.ts', 'utf8') + '\nexport { fetchFeed, enrichTV2Item, enrichBorsenItem, parseNewsDate, enrichPreview, extractScopedArticlePreview, articleMentionText, extractPublicPreview, extractPublishedDateFromHtml, extractArticleBodyFromJson, isFresh, cleanPublisherTeaser };';
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const context = { exports: {}, process: { env }, fetch, AbortSignal, URL, console, require: (id) => id === 'fast-xml-parser' ? require(id) : { persistStories: async () => {} } };
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

test('whole-page navigation paragraphs never replace a real article preview', () => {
  const api = load();
  const html = `<meta property="og:title" content="${item.title}">
    <meta name="description" content="Kommunen åbner en ny svømmehal ved Aarhus havn. Borgere får adgang til den i næste uge.">
    <nav><p>${'Uvedkommende annoncer og vejledning til abonnement. '.repeat(35)}</p></nav>
    <p>${'Flere ugyldige nyheder fra andre artikler. '.repeat(25)}</p>`;
  const excerpt = api.extractPublicPreview(html, item.title, 'Kommunen åbner en ny svømmehal');
  assert.match(excerpt, /Borgere får adgang/);
  assert.doesNotMatch(excerpt, /Uvedkommende|ugyldige nyheder/);
});

test('multiple unrelated JSON article bodies cannot hijack the current article', () => {
  const api = load();
  const html = `<script>{"articleBody":"Aarhus åbner en svømmehal ved havnen. Den nye svømmehal skal være åben for borgerne hele året.","articleBody":"Politikerne i København diskuterer en anden sag. Det er en helt anden nyhed med andre mennesker og begivenheder."}</script>`;
  const excerpt = api.extractArticleBodyFromJson(html, item.title, item.description);
  assert.match(excerpt, /Den nye svømmehal/);
  assert.doesNotMatch(excerpt, /København/);
});

test('dates from unrelated JSON stories are not assigned to the current article', () => {
  const api = load();
  const html = `<meta property="og:title" content="${item.title}"><script>{"datePublished":"2026-10-17T08:00:00Z","datePublished":"2026-10-19T12:00:00Z"}</script>`;
  assert.equal(api.extractPublishedDateFromHtml(html, item.title), undefined);
  const withMeta = html.replace('<script>', '<meta property="article:published_time" content="2026-10-18T11:45:00+02:00"><script>');
  assert.equal(api.extractPublishedDateFromHtml(withMeta, item.title), '2026-10-18T11:45:00+02:00');
});

test('articles dated far in the future cannot jump above breaking news', () => {
  const api = load();
  assert.equal(api.isFresh(new Date(Date.now() + 60 * 60 * 1000).toISOString()), false);
  assert.equal(api.isFresh(new Date(Date.now() - 60 * 1000).toISOString()), true);
});

test('unscoped page paragraphs are rejected when no article or main section exists', () => {
  const api = load();
  const html = `<nav><p>${'Aarhus svømmehal nyheden blev omtalt i en menu. '.repeat(12)}</p></nav>`;
  assert.equal(api.extractScopedArticlePreview(html, item.title, 'Aarhus svømmehal'), '');
});


test('Politiken prefers matching article paragraphs over longer site navigation', async () => {
  const seed = 'Kommunen åbner en ny svømmehal ved havnen, og alle byens borgere inviteres til en stor indvielse på søndag.';
  const html = '<meta property="og:title" content="Aarhus åbner svømmehal ved havnen">' +
    '<nav><p>' + seed + ' ' + 'Forkerte anbefalinger og abonnementsinformation. '.repeat(30) + '</p></nav>' +
    '<article><p>' + seed + '</p><p>Den nye svømmehal kommer til at rumme både motionsbaner og faciliteter for børn i alle aldre.</p>' +
    '<p>Kommunen forventer, at tusindvis af besøgende vil bruge anlægget, når det åbner for offentligheden.</p></article>';
  const api = load(async () => ({ ok: true, text: async () => html }));
  const story = await api.enrichPreview({ ...item, link: 'https://politiken.dk/danmark/artikel', source: 'Politiken', description: seed });
  assert.match(story.description, /motionsbaner/);
  assert.doesNotMatch(story.description, /Forkerte anbefalinger/);
});

test('Børsen ignores unrelated article cards even when they have much longer text', async () => {
  const other = '<article><h2>Udenlandske virksomheder ændrer regnskab</h2><p>' +
    'Udenlandske selskaber og investorer i andre lande. '.repeat(30) + '</p></article>';
  const correct = '<article><h2>Aarhus åbner svømmehal ved havnen</h2>' +
    '<p>Aarhus åbner en ny svømmehal ved havnen med flere baner og faciliteter for børn og foreninger.</p>' +
    '<p>Svømmehallen skal være åben for publikum hele ugen, og kommunen forventer mange besøgende.</p></article>';
  const api = load(async () => ({ ok: true, text: async () =>
    '<meta property="og:title" content="Aarhus åbner svømmehal ved havnen">' + other + correct
  }));
  const story = await api.enrichBorsenItem({ ...item, link: 'https://borsen.dk/nyheder/artikel', source: 'Børsen' });
  assert.match(story.description, /åben for publikum/);
  assert.doesNotMatch(story.description, /Udenlandske selskaber/);
});

test('TV 2 picks the matching JSON article rather than unrelated embedded news', async () => {
  const html = '<meta property="og:title" content="Aarhus åbner svømmehal ved havnen"><script>' +
    '{"articleBody":"En helt anden historie om udenrigspolitik og internationale handelsaftaler med mange detaljer fra udlandet.",' +
    '"articleBody":"Aarhus åbner svømmehal ved havnen. Svømmehallen får flere bassiner og nye faciliteter for alle byens borgere."}' +
    '</script>';
  const api = load(async () => ({ ok: true, text: async () => html }));
  const story = await api.enrichTV2Item(item);
  assert.match(story.description, /flere bassiner/);
  assert.doesNotMatch(story.description, /handelsaftaler/);
});

test('Stiften removes repeated paragraphs and sidebar mentions from its article endpoint', async () => {
  const lead = 'Kommunen åbner en ny svømmehal ved havnen. Der er plads til mange børn og familier i området.';
  const asyncBody = '<p>' + lead + '</p><p>' + lead + '</p>' +
    '<aside><p>Relaterede nyheder om andre steder i Danmark.</p></aside>' +
    '<p>Den nye hal kan benyttes af foreningerne efter den officielle åbning på søndag.</p>';
  const api = load(async (url) => ({ ok: true, text: async () => url.includes('/article-body') ? asyncBody :
    '<meta property="og:title" content="Aarhus åbner svømmehal ved havnen"><div data-load-async-url="/article-body"></div>' }));
  const story = await api.enrichPreview({ ...item, source: 'Stiften.dk', category: 'Aarhus', link: 'https://stiften.dk/aarhus/test' });
  assert.equal(story.description.split('Kommunen åbner en ny svømmehal').length - 1, 1);
  assert.match(story.description, /officielle åbning/);
  assert.doesNotMatch(story.description, /Relaterede nyheder/);
});

test('Stiften does not fetch an async article endpoint on another website', async () => {
  const urls = [];
  const api = load(async (url) => {
    urls.push(String(url));
    return { ok: true, text: async () =>
      '<meta property="og:title" content="Aarhus åbner svømmehal ved havnen"><div data-load-async-url="https://other.example/article-body"></div>'
    };
  });
  await api.enrichPreview({ ...item, source: 'Stiften.dk', category: 'Aarhus', link: 'https://stiften.dk/aarhus/test' });
  assert.equal(urls.length, 1);
  assert.match(urls[0], /stiften\.dk/);
});

test('Politiken public-page chrome is removed while real article context remains', () => {
  const api = load();
  const title = 'Ronaldo får kosmetisk karantæne fra landsholdet efter drama i København';
  const original = 'Cristiano Ronaldo har fået 30 dages karantæne for at forlade Portugals lejr forud for kampen mod Danmark. ' +
    title + ' De Melo Moreira/Ritzau Scanpix Fodbold 19. oktober 2026, 21.28 Gem artiklen Gemt Læst ' +
    'Det portugisiske fodboldforbunds disciplinærudvalg har tildelt Cristiano Ronaldo 30 kalenderdages karantæne. Det oplyser forbundet ifølge mediet A Bola.';
  const teaser = api.cleanPublisherTeaser(original, title, 'Politiken');
  assert.match(teaser, /Cristiano Ronaldo har fået/);
  assert.match(teaser, /disciplinærudvalg/);
  assert.doesNotMatch(teaser, /Gem artiklen|Ritzau Scanpix|19\. oktober 2026/);
  assert.equal(teaser.split(title).length - 1, 0);
});

test('Politiken duplicated headline without reader chrome is removed', () => {
  const api = load();
  const title = 'FCM indhenter FCK med sejr i lokalopgør';
  const excerpt = 'FC Midtjylland er på siden af FC København i Superligaens top. ' + title +
    ' For to runder siden havde FC Midtjylland fem point op til FC København. Det er nu ændret.';
  const teaser = api.cleanPublisherTeaser(excerpt, title, 'Politiken');
  assert.match(teaser, /For to runder siden/);
  assert.doesNotMatch(teaser, /FCM indhenter FCK/);
});

test('Politiken second navigation bar is removed after the available body', () => {
  const api = load();
  const title = 'Overgravet kabel forårsager flere togaflysninger';
  const excerpt = 'DSB har bestilt togbusser efter et overgravet kabel på Fyn. ' +
    title + ' Danmark 19. oktober 2026, 10.10 Gem artiklen Gemt Læst ' +
    'Der kører i øjeblikket ingen regionaltog mellem Odense og Fredericia. Trafikken er berørt efter et overgravet kabel. ' +
    'Danmark 19. oktober 2026, 10.10 Gem artiklen Gemt Læst Læs videre for 1 kr.';
  const teaser = api.cleanPublisherTeaser(excerpt, title, 'Politiken');
  assert.match(teaser, /ingen regionaltog/);
  assert.doesNotMatch(teaser, /Gem artiklen|Læs videre for 1 kr/);
});

test('non-Politiken previews remain intact and ambiguous Politiken page chrome is not overstripped', () => {
  const api = load();
  const title = 'Aktieluk i USA';
  const intact = 'Det amerikanske aktiemarked steg efter en stærk handelsdag med kursstigninger til flere teknologiselskaber.';
  assert.equal(api.cleanPublisherTeaser(intact, title, 'Børsen'), intact);
  const tooShort = 'Den nye artikel. ' + title + ' Foto: presse Gem artiklen Gemt Læst Læs videre for 1 kr.';
  assert.match(api.cleanPublisherTeaser(tooShort, title, 'Politiken'), /Den nye artikel/);
});

test('TV2 image photo credits are removed without losing the following article text', () => {
  const api = load();
  const text = 'Det nye projekt har fået mange besøgende. Foto: Alex Wong / Ritzau Scanpix Kommunen fortæller, at byggeriet står færdigt og borgerne kan benytte faciliteterne.';
  const cleaned = api.cleanPublisherTeaser(text, 'Nyt byggeri åbner', 'TV2.dk');
  assert.doesNotMatch(cleaned, /Foto:|Ritzau Scanpix/);
  assert.match(cleaned, /Kommunen fortæller/);
});
test('TV2 clean teaser leaves ordinary credited journalism intact', () => {
  const api = load();
  const text = 'Fotojournalisten forklarer, at billederne dokumenterer hændelsen. Politiet undersøger stadig sagen.';
  assert.equal(api.cleanPublisherTeaser(text, 'Politiet undersøger', 'TV2.dk'), text);
});


test('Stiften retries a stalled public article when RSS supplies no text', async () => {
  const title = 'I kan ikke trylle milliarder frem - men letbane-aftalen forpligter stadig';
  const url = 'https://stiften.dk/debat/i-kan-ikke-trylle-milliarder-frem-men-letbane-aftalen-forpligter-stadig?rss';
  const calls = [];
  const api = load(async (requestUrl, options = {}) => {
    calls.push({ url: String(requestUrl), options });
    if (String(requestUrl).includes('/article-body')) {
      return { ok: true, text: async () =>
        '<p>En aftale om letbanens fremtid forpligter stadig de involverede parter. Borgerne bør få en forklaring på de politiske beslutninger.</p>' +
        '<p>Spørgsmålet handler ikke kun om økonomien, men også om hvordan kommunen prioriterer sine kommende investeringer.</p>' };
    }
    if (calls.length === 1) throw new Error('Simulated publisher timeout');
    return { ok: true, text: async () =>
      '<meta property="og:title" content="' + title + '">' +
      '<div data-load-async-url="/article-body"></div>' };
  });
  const article = await api.enrichPreview({
    ...item, title, link: url, source: 'Stiften.dk', category: 'Aarhus', description: ''
  });
  assert.equal(calls.length, 3);
  assert.doesNotMatch(calls[1].url, /\\?rss/);
  assert.equal(calls[1].options.cache, 'no-store');
  assert.match(article.description, /aftale om letbanens fremtid/);
  assert.match(article.description, /kommunen prioriterer/);
});

test('Stiften keeps the RSS teaser when article fetch fails instead of inventing content', async () => {
  const teaser = 'Kommunen forventer at arbejde videre med kollektiv trafik i den kommende tid. Borgerne får flere oplysninger om tidsplanen på næste møde. Den samlede plan bliver offentliggjort efter de politiske drøftelser.';
  let calls = 0;
  const api = load(async () => { calls++; throw new Error('Simulated publisher timeout'); });
  const original = { ...item, link: 'https://stiften.dk/debat/ny-artikel?rss', source: 'Stiften.dk', description: teaser };
  const article = await api.enrichPreview(original);
  assert.equal(calls, 1);
  assert.equal(article.description, teaser);
});

test('Stiften does not retry an explicit publisher HTTP rejection', async () => {
  let calls = 0;
  const api = load(async () => { calls++; return { ok: false, status: 403 }; });
  const original = { ...item, link: 'https://stiften.dk/debat/ny-artikel?rss', source: 'Stiften.dk', description: '' };
  const article = await api.enrichPreview(original);
  assert.equal(calls, 1);
  assert.equal(article.description, '');
});


test('Stiften verified article metadata can describe a story without repeating the headline', async () => {
  const title = 'I kan ikke trylle milliarder frem - men letbane-aftalen forpligter stadig';
  const description = 'Jeg deltog selv i aftalen om grøn kollektiv trafik i Aarhus. Vi har et ansvar for at sikre en ordentlig forbindelse til uddannelse og arbejdspladser.';
  const html = '<meta property="og:title" content="' + title + '">' +
    '<meta property="og:description" content="' + description + '">';
  const api = load(async () => ({ ok: true, text: async () => html }));
  const news = await api.enrichPreview({ ...item, title, description: '', source: 'Stiften.dk', link: 'https://stiften.dk/debat/letbane-aftalen?rss' });
  assert.equal(news.description, description);
});

test('Stiften metadata from a different article is never accepted', async () => {
  const api = load(async () => ({ ok: true, text: async () =>
    '<meta property="og:title" content="Helt anden historie om udlandet">' +
    '<meta property="og:description" content="Den fremmede nyhedsartikel beskriver en anden hændelse."'
  }));
  const news = await api.enrichPreview({ ...item, description: '', source: 'Stiften.dk', link: 'https://stiften.dk/debat/letbane-aftalen?rss' });
  assert.equal(news.description, '');
});

test('Stiften retries its article-body endpoint when public text is otherwise missing', async () => {
  const urls = [];
  const api = load(async (url, options) => {
    urls.push({ url: String(url), cache: options?.cache });
    if (!String(url).includes('jfm-load-article-content')) {
      return { ok: true, text: async () =>
        '<meta property="og:title" content="Aarhus åbner svømmehal ved havnen">' +
        '<div data-load-async-url="/jfm-load-article-content/abc123"></div>' };
    }
    if (urls.length === 2) throw new Error('Simulated article-body timeout');
    return { ok: true, text: async () =>
      '<p>Kommunen åbner den nye svømmehal ved havnen til sommer, og offentligheden inviteres til arrangementet.</p>' +
      '<p>Foreninger og borgere får adgang til den store svømmehal, som også rummer aktiviteter for børn.</p>' };
  });
  const news = await api.enrichPreview({ ...item, description: '', source: 'Stiften.dk', link: 'https://stiften.dk/aarhus/ny-svoemmehal?rss' });
  assert.equal(urls.length, 3);
  assert.equal(urls[2].cache, 'no-store');
  assert.match(news.description, /Foreninger og borgere/);
  assert.doesNotMatch(news.description, /kan endnu ikke/);
});


test('feed retains available editorial text beyond 700 characters', async () => {
  const description = 'Kommunen offentliggør flere detaljer om den nye svømmehal. '.repeat(20) + 'Til sidst beskrives åbningstiderne for familier.';
  const published = new Date(Date.now() - 60000).toUTCString();
  const api = load(async (url) => ({ ok: true, text: async () => url.includes('allenyheder') ? `<rss><channel><item><title>${item.title}</title><link>https://dr.dk/long-article</link><pubDate>${published}</pubDate><description>${description}</description></item></channel></rss>` : '<rss><channel></channel></rss>' }));
  const stories = await api.getLiveStories({ fast: true });
  assert.equal(stories.length, 1);
  assert.ok(stories[0].summary.length > 700);
  assert.match(stories[0].summary, /Til sidst beskrives åbningstiderne for familier/);
});


test('Stiften retries short RSS excerpts and preserves the teaser if recovery fails', async () => {
  let calls = 0;
  const teaser = 'En kort introduktion til den aktuelle artikel.';
  const api = load(async () => { calls++; throw new Error('Simulated timeout'); });
  const news = await api.enrichPreview({ ...item, description: teaser, source: 'Stiften.dk', link: 'https://stiften.dk/aarhus/test?rss' });
  assert.equal(calls, 2);
  assert.equal(news.description, teaser);
});

test('Stiften recovers article body after a timeout even with a short RSS teaser', async () => {
  let calls = 0;
  const api = load(async (url) => {
    calls++;
    if (String(url).includes('/article-body')) {
      if (calls === 2) throw new Error('Simulated body timeout');
      return { ok: true, text: async () => '<p>Kommunen åbner den nye svømmehal ved havnen til sommer. Der bliver plads til familier og foreninger.</p><p>Borgmester Anders Winnerskjold deltager ved åbningen, hvor alle byens borgere er inviteret.</p>' };
    }
    return { ok: true, text: async () => `<meta property="og:title" content="${item.title}"><div data-load-async-url="/article-body"></div>` };
  });
  const news = await api.enrichPreview({ ...item, description: 'En kort introduktion.', source: 'Stiften.dk', link: 'https://stiften.dk/aarhus/test?rss' });
  assert.equal(calls, 3);
  assert.match(news.description, /familier og foreninger/);
  assert.ok(news.mentions.includes('anders-winnerskjold'));
});


test('Berlingske retries its legacy feed when the primary URL returns HTML with HTTP 200', async () => {
  const urls = [];
  const api = load(async (url) => {
    urls.push(url);
    return { ok: true, text: async () => urls.length === 1 ? '<html><h1>Unavailable</h1></html>' : '<rss><channel><item><title>En aktuel nyhed</title><link>https://www.berlingske.dk/danmark/nyhed</link><description>Et redaktionelt uddrag fra Berlingske.</description></item></channel></rss>' };
  });
  const stories = await api.fetchFeed({ name: 'Berlingske', category: 'Danmark', url: 'https://www.berlingske.dk/next-api/feeds/alle' });
  assert.equal(urls.length, 2);
  assert.equal(urls[1], 'https://www.berlingske.dk/content/rss');
  assert.equal(stories.length, 1);
  assert.equal(stories[0].source, 'Berlingske');
});

test('Berlingske reports an invalid feed after one fallback rather than returning silent success', async () => {
  let calls = 0;
  const api = load(async () => { calls++; return { ok: true, text: async () => '<html>Unavailable</html>' }; });
  await assert.rejects(api.fetchFeed({ name: 'Berlingske', category: 'Danmark', url: 'https://www.berlingske.dk/next-api/feeds/alle' }), /did not return RSS or Atom/);
  assert.equal(calls, 2);
});


test('Berlingske uses the fresh scheduled RSS cache without contacting the rejecting web endpoint', async () => {
  const urls = [];
  const api = load(async (url) => {
    urls.push(url);
    return { ok: true, json: async () => '<rss version="2.0"><channel><item><title>Aktuel Berlingske-nyhed</title><link>https://www.berlingske.dk/danmark/nyhed</link></item></channel></rss>' };
  }, { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'test-publishable' });
  const rows = await api.fetchFeed({ name: 'Berlingske', category: 'Danmark', url: 'https://www.berlingske.dk/next-api/feeds/alle' });
  assert.equal(urls.length, 1);
  assert.match(urls[0], /oeldk_berlingske_rss$/);
  assert.equal(rows[0].source, 'Berlingske');
});

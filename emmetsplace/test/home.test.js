const { test } = require('node:test');
const assert = require('node:assert');
const { cardType, renderCards, replaceBetweenMarkers } = require('../site/home');

const ep = (o = {}) => ({
  id: 'abc123', title: "Live From Emmet's Place Vol. 134 - Kurt Elling", number: 134, guests: 'Kurt Elling',
  streamDate: '2025-03-03T20:00:00Z', year: 2025, duration: 5400, location: 'Harlem, New York',
  artists: [{ name: 'Kurt Elling', instrument: 'vocals' }, { name: 'Joe Farnsworth', instrument: 'drums' }],
  songs: [{ title: 'Nature Boy', start: 125 }], description: '', restreams: [], ...o,
});
const slugs = { abc123: 'vol-134', b: 'b-slug', c: 'c-slug', d: 'd-slug', e: 'e-slug' };

test('cardType', () => {
  assert.strictEqual(cardType({ id: 'x', title: "Live From Emmet's Place Vol. 134 - Kurt Elling" }), 'studio');
  assert.strictEqual(cardType({ id: 'mX912vvfmdo', title: 'Whatever' }), 'studio');
  assert.strictEqual(cardType({ id: 'x', title: 'Emmet Cohen Trio - Live at Birdland 2023' }), 'road');
  assert.strictEqual(cardType({ id: 'x', title: 'Emmet Cohen Trio feat. Houston Person' }), 'other');
});

test('renderCards: headers per quarter, year-start only first of each year', () => {
  const eps = [
    ep({ id: 'abc123', streamDate: '2025-12-09T00:30:00Z' }),
    ep({ id: 'b', streamDate: '2025-11-01T00:00:00Z' }),
    ep({ id: 'c', streamDate: '2025-06-02T00:00:00Z' }),
    ep({ id: 'd', streamDate: '2024-12-31T23:59:00Z' }),
  ];
  const html = renderCards(eps, slugs);
  const headers = [...html.matchAll(/<div class="tune-section-header episode-year-header( year-start)?" data-year="([^"]+)" id="([^"]+)">([^<]*)<\/div>/g)];
  assert.deepStrictEqual(headers.map((h) => [!!h[1], h[2], h[3], h[4]]), [
    [true, '2025-10', 'eqsec-2025-10', '2025'],
    [false, '2025-04', 'eqsec-2025-04', 'Apr 2025'],
    [true, '2024-10', 'eqsec-2024-10', '2024'],
  ]);
  assert.strictEqual((html.match(/class="video-card"/g) || []).length, 4);
});

test('renderCards: card structure, artists, links', () => {
  const html = renderCards([ep()], slugs);
  assert.match(html, /<div class="video-card" data-type="studio" data-id="abc123" data-titles="[^"]*" data-artists="kurt elling joe farnsworth">/);
  assert.match(html, /data-titles="live from emmet&#39;s place vol\. 134 - kurt elling nature boy"/);
  assert.match(html, /<a class="video-link" href="\/episodes\/vol-134\/" onclick="if\(event\.metaKey\|\|event\.ctrlKey\|\|event\.shiftKey\)return true;playInHero\('abc123',true,false\);return false;" style="background-image: url\('https:\/\/img\.youtube\.com\/vi\/abc123\/hqdefault\.jpg'\)"><\/a>/);
  assert.match(html, /<h2><a class="title-link" href="\/episodes\/vol-134\/" onclick="if\(event\.metaKey\|\|event\.ctrlKey\|\|event\.shiftKey\)return true;playInHero\('abc123',true,false\);return false;">Live From Emmet&#39;s Place Vol\. 134 - Kurt Elling<\/a><\/h2>/);
  assert.match(html, /<span class="studio-badge">In Studio<\/span>/);
  assert.match(html, /<div class="stream-date">March 3, 2025<\/div>/);
  assert.match(html, /<strong class="artist-name" data-text="Kurt Elling">Kurt Elling<\/strong> · vocals/);
  assert.match(html, /<a class="video-entry-link" data-text="Nature Boy" href="https:\/\/www\.youtube\.com\/watch\?v=abc123&amp;t=125" onclick="if\(event\.metaKey\|\|event\.ctrlKey\|\|event\.shiftKey\)return true;playInHero\('abc123',true,false,125\);return false;">Nature Boy<\/a>/);
  assert.match(html, /<div id="collapse-abc123" style="display:none">/);
  assert.match(html, /<button class="card-expand-btn" onclick="[^"]*">Show more<\/button>/);
});

test('renderCards: song without start has no t param; no artists/songs means no collapse block', () => {
  const html = renderCards([ep({ songs: [{ title: 'A', start: 0 }] })], slugs);
  assert.match(html, /href="https:\/\/www\.youtube\.com\/watch\?v=abc123" onclick="if\(event\.metaKey\|\|event\.ctrlKey\|\|event\.shiftKey\)return true;playInHero\('abc123',true,false\);return false;"/);
  const bare = renderCards([ep({ artists: [], songs: [] })], slugs);
  assert.doesNotMatch(bare, /collapse-|card-expand-btn/);
});

test('renderCards: songs after the sixth go in more-<id>', () => {
  const songs = Array.from({ length: 8 }, (_, i) => ({ title: `Song ${i + 1}`, start: i * 10 }));
  const html = renderCards([ep({ songs })], slugs);
  const m = html.match(/<div id="more-abc123" style="display:none;flex-direction:column;gap:6px">(.*?)<\/div><button class="show-more-btn"[^>]*>Show 2 more\.\.\.<\/button>/);
  assert.ok(m);
  assert.match(m[1], /Song 7/);
  assert.match(m[1], /Song 8/);
  assert.doesNotMatch(m[1], /Song 6/);
  assert.match(html.split('id="more-abc123"')[0], /Song 6/);
});

test('renderCards: escapes apostrophes and ampersands in text and data-text', () => {
  const html = renderCards([ep({
    title: "Rock & Roll's \"Best\"", artists: [{ name: 'Tom & Jerry', instrument: 'x' }],
    songs: [{ title: "Don't & Stop", start: 5 }],
  })], slugs);
  assert.match(html, />Rock &amp; Roll&#39;s &quot;Best&quot;<\/a>/);
  assert.match(html, /data-text="Don&#39;t &amp; Stop"/);
  assert.match(html, /data-text="Tom &amp; Jerry">Tom &amp; Jerry</);
  assert.doesNotMatch(html, /Roll's|Tom & Jerry/);
});

test('renderCards: throws on missing slug', () => {
  assert.throws(() => renderCards([ep({ id: 'nope' })], slugs), /nope/);
});

test('replaceBetweenMarkers', () => {
  const html = 'A\n<!-- build:cards:start -->old<!-- build:cards:end -->\nB';
  const out = replaceBetweenMarkers(html, 'cards', '<p>new</p>');
  assert.strictEqual(out, 'A\n<!-- build:cards:start --><p>new</p><!-- build:cards:end -->\nB');
  assert.strictEqual(replaceBetweenMarkers(out, 'cards', '<p>new</p>'), out);
  assert.throws(() => replaceBetweenMarkers('no markers', 'cards', 'x'), /cards/);
  assert.throws(() => replaceBetweenMarkers('<!-- build:cards:start -->x', 'cards', 'x'), /cards/);
  assert.throws(() => replaceBetweenMarkers(html + html, 'cards', 'x'), /cards/);
  assert.strictEqual(replaceBetweenMarkers(html, 'cards', '$&$1'), 'A\n<!-- build:cards:start -->$&$1<!-- build:cards:end -->\nB');
});

// ---- final-review fix wave ----
test('card date and quarter use America/New_York', () => {
  const html = renderCards([ep({ id: 'abc123', streamDate: '2025-03-04T00:30:00Z' }), ep({ id: 'b', streamDate: '2025-01-01T03:00:00Z' })], slugs);
  assert.match(html, /<div class="stream-date">March 3, 2025<\/div>/);
  assert.match(html, /<div class="stream-date">December 31, 2024<\/div>/);
  const qs = [...html.matchAll(/data-year="([^"]+)"/g)].map((m) => m[1]);
  assert.deepStrictEqual(qs, ['2025-01', '2024-10']);
});

test('card handlers let modified clicks through to the episode page', () => {
  const html = renderCards([ep()], slugs);
  const handlers = [...html.matchAll(/onclick="([^"]*playInHero[^"]*)"/g)].map((m) => m[1]);
  assert.strictEqual(handlers.length, 3);
  for (const h of handlers) assert.ok(h.startsWith('if(event.metaKey||event.ctrlKey||event.shiftKey)return true;'), h);
});

test('songLink start is a floored number', () => {
  const html = renderCards([ep({ songs: [{ title: 'A', start: '125.7' }, { title: 'B', start: 'abc' }, { title: 'C', start: '1);alert(1' }] })], slugs);
  assert.match(html, /watch\?v=abc123&amp;t=125" onclick="[^"]*playInHero\('abc123',true,false,125\);return false;">A</);
  assert.match(html, /watch\?v=abc123" onclick="[^"]*playInHero\('abc123',true,false\);return false;">B</);
  assert.doesNotMatch(html, /alert/);
});

test('renderCards: sub-path config prefixes card hrefs', () => {
  const { setConfig, resetConfig } = require('../site/config');
  setConfig({ siteUrl: 'https://www.sambenediktson.com', basePath: '/emmetsplace' });
  try {
    const html = renderCards([ep()], slugs);
    assert.strictEqual((html.match(/href="\/emmetsplace\/episodes\/vol-134\/"/g) || []).length, 2);
    assert.ok(!html.includes('href="/episodes/'));
  } finally {
    resetConfig();
  }
});

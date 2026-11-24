const { test } = require('node:test');
const assert = require('node:assert');
const { renderSitemap, renderLlmsTxt } = require('../site/feeds');

const ep = (o = {}) => ({
  id: 'a', title: "Live From Emmet's Place Vol. 134 - Kurt Elling", number: 134, guests: 'Kurt Elling',
  streamDate: '2025-03-03T20:00:00Z', year: 2025, artists: [], songs: [], restreams: [], ...o,
});

test('renderSitemap: xml header, one url per input, escaping, optional lastmod', () => {
  const xml = renderSitemap([{ loc: 'https://emmetsplace.com/' }, { loc: 'https://emmetsplace.com/a?x=1&y=2', lastmod: '2025-03-03' }]);
  assert.ok(xml.startsWith('<?xml'));
  assert.strictEqual(xml.split('<url>').length - 1, 2);
  assert.ok(xml.includes('?x=1&amp;y=2'));
  assert.strictEqual(xml.split('<lastmod>').length - 1, 1);
  assert.ok(xml.includes('<lastmod>2025-03-03</lastmod>'));
});

test('renderLlmsTxt: episodes, musicians, sitemap pointer, no writers', () => {
  const e = ep();
  const m = { name: 'Kurt Elling', instruments: [], appearances: [e] };
  const txt = renderLlmsTxt([e], [m], { episodes: { a: 'vol-134-kurt-elling' }, musicians: { 'Kurt Elling': 'kurt-elling' } });
  assert.ok(txt.startsWith("# Emmet's Place\n"));
  assert.ok(txt.includes('https://emmetsplace.com/episodes/vol-134-kurt-elling/'));
  assert.ok(txt.includes('- [Kurt Elling](https://emmetsplace.com/musicians/kurt-elling/): 1 episode'));
  assert.ok(txt.includes('https://emmetsplace.com/sitemap.xml'));
  assert.ok(txt.includes('## Episodes') && txt.includes('## Musicians'));
  assert.ok(!txt.includes('/writers/'));
  assert.ok(txt.includes(': 2025-03-03'));
});

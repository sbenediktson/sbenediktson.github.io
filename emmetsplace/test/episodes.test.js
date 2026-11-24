const test = require('node:test');
const assert = require('node:assert');
const { selectEpisodes, pageTitle } = require('../site/episodes');
const data = require('./fixtures/videos.sample.json');

const eps = selectEpisodes(data);
const byId = (id) => eps.find((e) => e.id === id);

test('selects only duration >= 1800', () => {
  const ids = eps.map((e) => e.id);
  assert.ok(!ids.includes('ml4'));
  assert.ok(!ids.includes('short'));
  assert.ok(ids.includes('v134'));
});

test('folds re-streams into canonical', () => {
  assert.strictEqual(eps.filter((e) => e.number === 134).length, 1);
  assert.deepStrictEqual(byId('v134').restreams, [{ id: 'v134r', title: data.v134r.title }]);
  assert.ok(!byId('v134r'));
  assert.strictEqual(byId('sf').restreams.length, 1);
  assert.strictEqual(byId('sf').restreams[0].id, 'sfr');
  assert.ok(!byId('sfr'));
});

test('re-stream without original becomes the page', () => {
  const ep = byId('orph');
  assert.ok(ep);
  assert.deepStrictEqual(ep.restreams, []);
});

test('number parsing', () => {
  assert.strictEqual(byId('v134').number, 134);
  assert.strictEqual(byId('v137').number, 137);
  assert.strictEqual(byId('sf').number, null);
  assert.strictEqual(byId('ml4'), undefined);
});

test('location', () => {
  assert.strictEqual(byId('v136').location, 'Harlem, New York');
  assert.strictEqual(byId('v137').location, 'Power Station at Berklee NYC');
  assert.strictEqual(byId('sf').location, null);
});

test('episode fields', () => {
  const ep = byId('v134');
  assert.strictEqual(ep.guests, 'Kurt Elling');
  assert.strictEqual(ep.year, 2025);
  assert.strictEqual(ep.duration, 7000);
  assert.strictEqual(ep.description, 'Kurt joins the trio.');
  assert.strictEqual(ep.artists.length, 2);
  assert.deepStrictEqual(ep.songs, [{ title: 'Nature Boy', start: 120 }]);
});

test('pageTitle', () => {
  assert.strictEqual(pageTitle(byId('v134')), "Kurt Elling - Live From Emmet's Place Vol. 134 (2025)");
  assert.strictEqual(pageTitle(byId('sf')), 'Emmet Cohen Quintet Celebrates Miles and Coltrane at 100 (Live at @sfjazz) (2026)');
  assert.strictEqual(pageTitle(byId('v137')), "Emmet’s Place Revival: Joshua Redman Ignites the New Era - Live From Emmet's Place Vol. 137 (2025)");
  const t = pageTitle(byId('v100'));
  assert.strictEqual(byId('v100').year, null);
  assert.ok(!t.includes('undefined') && !/\(\d{4}\)/.test(t));
  assert.strictEqual(t, "Nobody Yet - Live From Emmet's Place Vol. 100");
});

test('sorted newest first', () => {
  const dated = eps.filter((e) => e.streamDate);
  for (let i = 1; i < dated.length; i++) assert.ok(dated[i - 1].streamDate >= dated[i].streamDate);
  assert.strictEqual(eps[eps.length - 1].id, 'v100');
});

test('apostrophe-less "Re-Stream -" title folds into numbered original', () => {
  assert.strictEqual(eps.filter((e) => e.number === 33).length, 1);
  const ep = byId('v33');
  assert.strictEqual(ep.location, 'Harlem, New York');
  assert.deepStrictEqual(ep.restreams.map((r) => r.id), ['v33r']);
  assert.ok(!byId('v33r'));
});

test('pageTitle strips Re-Stream prefix for orphan re-stream', () => {
  const t = pageTitle(byId('orph'));
  assert.ok(!/re-?stream/i.test(t));
  assert.strictEqual(t, 'Emmet Cohen Trio | Live in Spain (2024)'); // title already has a year: none appended
});

// ---- final-review fix wave ----
const { episodeSlugBase, allocateSlugs } = require('../site/slugs');
const v = (title, streamDate, extra = {}) => ({ title, streamDate, duration: 5000, ...extra });

const RESTREAM_PAIRS = {
  eeGOC0JB2rY: ['Re-Stream: Emmet Cohen Trio - Live at Dazzle Denver', '2026-02-10T00:30:06Z', 'JqdIoQgOGnw', 'Emmet Cohen Trio Live at Dazzle Denver', '2021-10-04T23:30:13Z'],
  wCafMBaQAmA: ['Re-Stream: Emmet Cohen Trio - Live at the Gilmore', '2025-05-12T23:30:06Z', 'MpCkfoGQbQY', 'Emmet Cohen Trio Live at the Gilmore', '2022-02-22T00:30:10Z'],
  oGlBqHDPpuU: ['Re-Stream: Emmet Cohen Trio and Guests Live from Moscow, Russia (2021)', '2025-02-11T00:34:06Z', 'q5SwTPZLM5o', 'Emmet Cohen Trio and Guests Live from Moscow, Russia', '2021-03-15T23:28:15Z'],
  p5VizNFuJKw: ['Re-Stream: Emmet Cohen Trio Live at Budapest Jazz Club (2021)', '2025-01-21T00:32:06Z', 'cHfRl3Mf6jw', 'Emmet Cohen Trio Live at Budapest Jazz Club', '2022-01-25T00:24:47Z'],
  'wgAkz3uM-pM': ['Re-Stream: Emmet Cohen Trio w/ Tootie Heath | Live In New Mexico (2022)', '2024-04-08T23:30:52Z', '7iRF3nhL0X4', 'Emmet Cohen Trio W/ Tootie Heath | Live In New Mexico', '2022-09-19T23:30:10Z'],
  jgd8NAg0__g: ['Re-Stream: Emmet Cohen Trio feat. Ricardo Toscano - Live in Funchal, Portugal 2023', '2025-02-04T00:34:06Z', 'OsOOjFhfbE0', 'Live in Funchal, Portugal 2023', '2023-07-17T23:30:02Z'],
  U7_sjYqu7UU: ["Re-Stream: Live From Emmet's Place at Purdue feat. Mary Stallings, Patrick Bartley & Bruce Harris", '2024-09-02T23:34:06Z', 'Hdc1ExQMZ4A', "Live From Emmet's Place at Purdue Convocations feat. Mary Stallings, Patrick Bartley & Bruce Harris", '2022-03-08T00:30:29Z'],
};

test('the 7 known orphan re-streams fold into their originals, which get the clean slug', () => {
  const data = {};
  // Re-streams first so insertion order cannot hand them the clean slug.
  for (const [rid, [rt, rd]] of Object.entries(RESTREAM_PAIRS)) data[rid] = v(rt, rd);
  for (const [, [, , oid, ot, od]] of Object.entries(RESTREAM_PAIRS)) data[oid] = v(ot, od);
  const out = selectEpisodes(data);
  assert.strictEqual(out.length, 7);
  const slugs = allocateSlugs(out.map((e) => ({ key: e.id, base: episodeSlugBase(e) })), {});
  for (const [rid, [rt, , oid]] of Object.entries(RESTREAM_PAIRS)) {
    assert.ok(!out.find((e) => e.id === rid), `${rid} has no page`);
    const orig = out.find((e) => e.id === oid);
    assert.deepStrictEqual(orig.restreams, [{ id: rid, title: rt }], oid);
    assert.ok(!/-\d+$/.test(slugs[oid]) || /-20\d\d$/.test(slugs[oid]), `${oid} clean slug: ${slugs[oid]}`);
  }
  assert.strictEqual(slugs.JqdIoQgOGnw, 'emmet-cohen-trio-live-at-dazzle-denver');
  assert.strictEqual(slugs.MpCkfoGQbQY, 'emmet-cohen-trio-live-at-the-gilmore');
});

test('RESTREAM_OF target missing: the re-stream stands alone', () => {
  const out = selectEpisodes({ eeGOC0JB2rY: v('Re-Stream: Emmet Cohen Trio - Live at Dazzle Denver', '2026-02-10T00:30:06Z') });
  assert.deepStrictEqual(out.map((e) => e.id), ['eeGOC0JB2rY']);
});

test('a re-stream with a trailing year folds into its year-less original; distinct originals never merge', () => {
  const out = selectEpisodes({
    r: v('Re-Stream: Foo Trio Live at Bar (2021)', '2025-01-01T12:00:00Z'),
    o: v('Foo Trio - Live at Bar', '2021-05-01T12:00:00Z'),
    s23: v('Emmet Cohen Trio - Live in Spain (2023)', '2023-05-01T12:00:00Z'),
    s24: v('Emmet Cohen Trio | Live in Spain (2024)', '2024-05-01T12:00:00Z'),
    s24r: v('Re-Stream: Emmet Cohen Trio | Live in Spain (2024)', '2026-03-23T23:30:06Z'),
    b24: v("Best of Live From Emmet's Place 2024!", '2024-12-30T12:00:00Z'),
    b25: v("Best of Live From Emmet's Place 2025!", '2025-12-30T12:00:00Z'),
  });
  const ids = out.map((e) => e.id).sort();
  assert.deepStrictEqual(ids, ['b24', 'b25', 'o', 's23', 's24']);
  assert.deepStrictEqual(out.find((e) => e.id === 'o').restreams.map((r) => r.id), ['r']);
  assert.deepStrictEqual(out.find((e) => e.id === 's24').restreams.map((r) => r.id), ['s24r']);
  assert.deepStrictEqual(out.find((e) => e.id === 's23').restreams, []);
});

test('guests parsed for "-", "feat.", "feat", "ft." and "featuring" forms', () => {
  const out = selectEpisodes({
    a: v("Live From Emmet's Place Vol. 31 feat. Veronica Swift and Jerry Weldon", '2020-11-17T00:28:55Z'),
    b: v("Live at Emmet's Place Vol. 12 feat Veronica Swift", '2020-06-15T23:28:43Z'),
    c: v("Live From Emmet's Place Vol. 26 ft. Godwin Louis", '2020-09-21T23:30:09Z'),
    d: v("Live at Emmet's Place Vol. 19 featuring Cyrille Aimée", '2020-08-03T23:28:26Z'),
    e: v("Live From Emmet's Place Vol. 134 - Kurt Elling", '2025-06-02T23:30:00Z'),
  });
  const g = Object.fromEntries(out.map((e) => [e.id, e.guests]));
  assert.deepStrictEqual(g, { a: 'Veronica Swift and Jerry Weldon', b: 'Veronica Swift', c: 'Godwin Louis', d: 'Cyrille Aimée', e: 'Kurt Elling' });
  assert.strictEqual(episodeSlugBase(out.find((e) => e.id === 'a')), 'vol-31-veronica-swift-and-jerry-weldon');
});

test('"Live from Emmet\'s Vol. 5" is numbered', () => {
  const [ep] = selectEpisodes({ _iW1MSSNUds: v("Live from Emmet's Vol. 5", '2020-04-20T23:27:56Z') });
  assert.strictEqual(ep.number, 5);
});

test('pageTitle keeps series name and number for guest-less numbered episodes', () => {
  const [ep] = selectEpisodes({ e9Qtrm_4SpU: v('The Most Fearless Voice in Jazz Today? Veronica Swift (Ep. 140)', '2026-04-27T23:31:22Z') });
  assert.strictEqual(pageTitle(ep), "The Most Fearless Voice in Jazz Today? Veronica Swift - Live From Emmet's Place Vol. 140 (2026)");
  const [vol5] = selectEpisodes({ x: v("Live from Emmet's Vol. 5", '2020-04-20T23:27:56Z') });
  assert.strictEqual(pageTitle(vol5), "Live from Emmet's Vol. 5 (2020)");
});

test('pageTitle does not append a year when the title already has one', () => {
  const out = selectEpisodes({
    p: v('Emmet Cohen Trio - Live in Poland 2024', '2024-10-14T23:34:06Z'),
    s: v('Emmet Cohen Trio - Live in Spain (2023)', '2023-05-01T12:00:00Z'),
    b: v("Best of Live From Emmet's Place 2025!", '2025-12-30T12:00:00Z'),
  });
  const t = Object.fromEntries(out.map((e) => [e.id, pageTitle(e)]));
  assert.deepStrictEqual(t, {
    p: 'Emmet Cohen Trio - Live in Poland 2024',
    s: 'Emmet Cohen Trio - Live in Spain (2023)',
    b: "Best of Live From Emmet's Place 2025!",
  });
});

test('year is computed in America/New_York', () => {
  const out = selectEpisodes({
    a: v('Concert A', '2025-01-01T03:00:00Z'),
    b: v('Concert B', '2025-03-04T00:30:00Z'),
  });
  assert.strictEqual(out.find((e) => e.id === 'a').year, 2024);
  assert.strictEqual(out.find((e) => e.id === 'b').year, 2025);
});

test('selectEpisodes cleans artists', () => {
  const [ep] = selectEpisodes({ x: v('Concert', '2025-01-01T12:00:00Z', { artists: [{ name: 'Bass', instrument: 'Russell Hall' }, { name: 'Cameraman', instrument: 'Joe' }, { name: 'Feat. Sean Jones', instrument: 'Trumpet' }] }) });
  assert.deepStrictEqual(ep.artists, [{ name: 'Russell Hall', instrument: 'Bass' }, { name: 'Sean Jones', instrument: 'Trumpet' }]);
});

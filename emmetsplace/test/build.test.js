const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { selectEpisodes } = require('../site/episodes');
const { buildSite, writeSite } = require('../build-site');

const REPO = path.join(__dirname, '..');
const MINI_HOME = '<html><body><!-- build:intro:start --><!-- build:intro:end --><div><!-- build:cards:start --><!-- build:cards:end --></div></body></html>';

function project(opts = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ep-'));
  fs.mkdirSync(path.join(root, 'content'));
  const sample = JSON.parse(fs.readFileSync(path.join(REPO, 'test/fixtures/videos.sample.json'), 'utf8'));
  fs.writeFileSync(path.join(root, 'videos.json'), opts.videos ?? JSON.stringify({ data: sample }));
  fs.writeFileSync(path.join(root, 'index.html'), opts.home ?? MINI_HOME);
  fs.writeFileSync(path.join(root, 'content/home-intro.html'), '<p>INTRO TEXT</p>');
  return root;
}

function snapshot(dir, rel = '') {
  const out = {};
  for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    const r = path.join(rel, e.name);
    if (e.isDirectory()) { out[r + '/'] = 1; Object.assign(out, snapshot(dir, r)); } else out[r] = fs.readFileSync(path.join(dir, r), 'utf8');
  }
  return out;
}

function cli(root) {
  return spawnSync(process.execPath, [path.join(REPO, 'build-site.js'), '--root', root], { encoding: 'utf8' });
}

test('buildSite: outputs, marker replacement, no writes', () => {
  const root = project();
  const before = snapshot(root);
  const { files } = buildSite({ root });
  assert.deepStrictEqual(snapshot(root), before);
  const home = files.get('index.html');
  assert.ok(home.includes('INTRO TEXT') && home.includes('class="video-card"'));
  const eps = [...files.keys()].filter((k) => k.startsWith('episodes/'));
  const expected = selectEpisodes(JSON.parse(fs.readFileSync(path.join(root, 'videos.json'), 'utf8')).data).length;
  assert.ok(expected > 1);
  assert.strictEqual(eps.length, expected);
  assert.ok(files.has('sitemap.xml') && files.has('llms.txt') && files.has('slugs.json'));
  assert.ok([...files.keys()].every((k) => !k.includes('undefined')));
  assert.ok([...files.values()].every((v) => !v.includes('/undefined')));
  assert.ok(files.get('sitemap.xml').includes('<loc>https://emmetsplace.com/</loc>'));
  assert.ok(files.get('sitemap.xml').includes('<lastmod>2025-06-02</lastmod>'));
});

test('buildSite: second run with written slugs.json is identical; writeSite is idempotent', () => {
  const root = project();
  const first = buildSite({ root });
  writeSite(root, first.files);
  const second = buildSite({ root });
  assert.deepStrictEqual([...second.files], [...first.files]);
  const f = path.join(root, 'sitemap.xml');
  const old = new Date(2020, 0, 1);
  fs.utimesSync(f, old, old);
  writeSite(root, second.files);
  assert.strictEqual(fs.statSync(f).mtimeMs, old.getTime());
});

test('buildSite: pinned slug is respected', () => {
  const root = project();
  fs.writeFileSync(path.join(root, 'slugs.json'), JSON.stringify({ episodes: { v134: 'custom-slug' }, musicians: {} }));
  assert.ok(buildSite({ root }).files.has('episodes/custom-slug/index.html'));
});

test('buildSite: missing marker throws', () => {
  assert.throws(() => buildSite({ root: project({ home: '<html></html>' }) }), /marker/);
});

test('writers: page only under /writers/, nowhere else', () => {
  const root = project();
  fs.writeFileSync(path.join(root, 'content/writers.json'), JSON.stringify([{ slug: 'jane-doe', name: 'Jane Doe', episodeIds: ['v134'] }]));
  const { files } = buildSite({ root });
  assert.ok(files.get('writers/jane-doe/index.html').includes('Jane Doe'));
  for (const [k, v] of files) {
    if (k.startsWith('writers/')) continue;
    assert.ok(!v.includes('writers/') && !v.includes('Jane Doe'), k);
  }
});

test('CLI failures exit 1 and leave the tree untouched', () => {
  const cases = {
    malformed: project({ videos: '{nope' }),
    missing: project(),
    noData: project({ videos: '{}' }),
    zero: project({ videos: JSON.stringify({ data: {} }) }),
  };
  fs.rmSync(path.join(cases.missing, 'videos.json'));
  for (const [name, root] of Object.entries(cases)) {
    const before = snapshot(root);
    const r = cli(root);
    assert.strictEqual(r.status, 1, name);
    assert.ok(r.stderr.startsWith('build-site:'), name);
    assert.deepStrictEqual(snapshot(root), before, name);
  }
});

test('CLI: marker failure writes nothing', () => {
  const root = project({ home: '<html></html>' });
  const before = snapshot(root);
  assert.strictEqual(cli(root).status, 1);
  assert.deepStrictEqual(snapshot(root), before);
});

test('CLI: writes site, removes stale generated dirs, keeps hand-written ones', () => {
  const root = project();
  fs.mkdirSync(path.join(root, 'episodes/old'), { recursive: true });
  fs.writeFileSync(path.join(root, 'episodes/old/index.html'), '<!-- generated by build-site.js -->old');
  fs.mkdirSync(path.join(root, 'musicians/hand'), { recursive: true });
  fs.writeFileSync(path.join(root, 'musicians/hand/index.html'), '<html>mine</html>');
  const r = cli(root);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.ok(!fs.existsSync(path.join(root, 'episodes/old')));
  assert.ok(fs.existsSync(path.join(root, 'musicians/hand/index.html')));
  assert.ok(fs.existsSync(path.join(root, 'sitemap.xml')) && fs.existsSync(path.join(root, 'slugs.json')));
  assert.ok(fs.readFileSync(path.join(root, 'index.html'), 'utf8').includes('INTRO TEXT'));
});

function pin(root, episodes, musicians = {}) {
  fs.writeFileSync(path.join(root, 'slugs.json'), JSON.stringify({ episodes, musicians }));
}

test('pinned slugs are validated: traversal, non-string, duplicates', () => {
  for (const bad of ['../x', '..', 'a/b', '/abs', 42]) {
    const root = project();
    pin(root, { v134: bad });
    assert.throws(() => buildSite({ root }), /Invalid slug for episode v134/, String(bad));
  }
  const root = project();
  pin(root, { v134: 'same', v136: 'same' });
  assert.throws(() => buildSite({ root }), /Duplicate slug "same"/);
  const m = project();
  pin(m, {}, { 'Kurt Elling': '../evil' });
  assert.throws(() => buildSite({ root: m }), /Invalid slug for musician Kurt Elling/);
});

test('CLI: traversal slug exits 1 and leaves tree untouched', () => {
  const root = project();
  pin(root, { v134: '../x' });
  const before = snapshot(root);
  const r = cli(root);
  assert.strictEqual(r.status, 1);
  assert.match(r.stderr, /Invalid slug/);
  assert.deepStrictEqual(snapshot(root), before);
});

// ---- final-review fix wave ----
test('pager: "Previous" is the older episode, "Next" the newer', () => {
  const data = {
    a: { title: 'Concert Alpha', streamDate: '2025-01-10T12:00:00Z', duration: 5000 },
    b: { title: 'Concert Beta', streamDate: '2025-02-10T12:00:00Z', duration: 5000 },
    c: { title: 'Concert Gamma', streamDate: '2025-03-10T12:00:00Z', duration: 5000 },
  };
  const { files } = buildSite({ root: project({ videos: JSON.stringify({ data }) }) });
  const mid = files.get('episodes/concert-beta/index.html');
  assert.match(mid, /<a href="\/episodes\/concert-alpha\/">Previous: Concert Alpha \(2025\)<\/a>/);
  assert.match(mid, /<a href="\/episodes\/concert-gamma\/">Next: Concert Gamma \(2025\)<\/a>/);
  assert.doesNotMatch(files.get('episodes/concert-alpha/index.html'), /Previous:/);
  assert.doesNotMatch(files.get('episodes/concert-gamma/index.html'), /Next:/);
});

test('writers: duplicate slug throws a clear error', () => {
  const root = project();
  fs.writeFileSync(path.join(root, 'content/writers.json'), JSON.stringify([
    { slug: 'jane-doe', name: 'Jane Doe', episodeIds: [] },
    { slug: 'jane-doe', name: 'Jane Other', episodeIds: [] },
  ]));
  assert.throws(() => buildSite({ root }), /Duplicate writer slug "jane-doe"/);
});

const SUB_CONFIG = { siteUrl: 'https://www.sambenediktson.com', basePath: '/emmetsplace' };

test('buildSite: site.config.json puts the whole site under a sub-path', () => {
  const root = project({ home: MINI_HOME });
  fs.writeFileSync(path.join(root, 'site.config.json'), JSON.stringify(SUB_CONFIG));
  const { files } = buildSite({ root });
  const prefix = 'https://www.sambenediktson.com/emmetsplace/';
  const slug = Object.values(JSON.parse(files.get('slugs.json')).episodes)[0];
  const page = files.get(`episodes/${slug}/index.html`);
  assert.ok(page.includes(`<link rel="canonical" href="${prefix}episodes/${slug}/">`));
  assert.ok(page.includes(`property="og:url" content="${prefix}episodes/${slug}/"`));
  assert.ok(page.includes('href="/emmetsplace/page.css"'));
  assert.ok(page.includes('href="/emmetsplace/"'));
  assert.ok(files.get('index.html').includes(`href="/emmetsplace/episodes/${slug}/"`));
  for (const [name, content] of files) {
    if (!name.endsWith('.html')) continue;
    assert.ok(!/href="\/(episodes\/|musicians\/|page\.css"|")/.test(content), `${name} has a root-relative link`);
    assert.ok(!/src="\/(?!\/)/.test(content), `${name} has a root-relative src`);
  }
  const locs = [...files.get('sitemap.xml').matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
  assert.ok(locs.length > 2);
  assert.ok(locs.every((l) => l.startsWith(prefix)));
  assert.ok(locs.includes(prefix));
  const llms = files.get('llms.txt');
  assert.ok(llms.includes(`Sitemap: ${prefix}sitemap.xml`));
  const urls = [...llms.matchAll(/\]\((https?:[^)]*)\)/g)].map((m) => m[1]);
  assert.ok(urls.length > 2 && urls.every((u) => u.startsWith(prefix)));
  for (const content of files.values()) assert.ok(!content.includes('emmetsplace.com'));
});

test('buildSite: config does not leak between builds', () => {
  const sub = project();
  fs.writeFileSync(path.join(sub, 'site.config.json'), JSON.stringify(SUB_CONFIG));
  buildSite({ root: sub });
  const { files } = buildSite({ root: project() });
  assert.ok(files.get('sitemap.xml').includes('<loc>https://emmetsplace.com/</loc>'));
  assert.ok(!files.get('index.html').includes('/emmetsplace/'));
});

test('buildSite: invalid site.config.json throws; CLI exits 1 and leaves the tree untouched', () => {
  for (const cfg of ['{ not json', JSON.stringify({ basePath: '/emmetsplace/' }), JSON.stringify({ siteUrl: 'https://x/' }), JSON.stringify({ nope: 1 })]) {
    const root = project();
    fs.writeFileSync(path.join(root, 'site.config.json'), cfg);
    const before = snapshot(root);
    assert.throws(() => buildSite({ root }), /site\.config\.json|site config|Site config/i);
    const r = cli(root);
    assert.strictEqual(r.status, 1);
    assert.match(r.stderr, /^build-site: /);
    assert.deepStrictEqual(snapshot(root), before);
  }
});

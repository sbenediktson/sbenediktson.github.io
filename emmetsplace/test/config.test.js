const { test, afterEach } = require('node:test');
const assert = require('node:assert');
const { DEFAULTS, setConfig, getConfig, resetConfig } = require('../site/config');

afterEach(() => resetConfig());

test('getConfig returns the defaults', () => {
  assert.deepStrictEqual(DEFAULTS, { siteUrl: 'https://emmetsplace.com', basePath: '' });
  assert.deepStrictEqual(getConfig(), { siteUrl: 'https://emmetsplace.com', basePath: '' });
});

test('setConfig merges a valid partial onto the defaults; resetConfig restores them', () => {
  setConfig({ basePath: '/emmetsplace' });
  assert.deepStrictEqual(getConfig(), { siteUrl: 'https://emmetsplace.com', basePath: '/emmetsplace' });
  setConfig({ siteUrl: 'https://www.sambenediktson.com:8080', basePath: '/a/b.c_d-e' });
  assert.deepStrictEqual(getConfig(), { siteUrl: 'https://www.sambenediktson.com:8080', basePath: '/a/b.c_d-e' });
  setConfig();
  assert.deepStrictEqual(getConfig(), DEFAULTS);
  setConfig({ basePath: '/x' });
  resetConfig();
  assert.deepStrictEqual(getConfig(), DEFAULTS);
});

test('setConfig rejects bad values with a clear message and keeps the previous config', () => {
  const bad = [
    [{ basePath: 'emmetsplace' }, /basePath/],
    [{ basePath: '/emmetsplace/' }, /basePath/],
    [{ basePath: '/../x' }, /basePath/],
    [{ basePath: '/..' }, /basePath/],
    [{ basePath: '/a/./b' }, /basePath/],
    [{ basePath: '/' }, /basePath/],
    [{ siteUrl: 'http://x' }, /siteUrl/],
    [{ siteUrl: 'https://x/' }, /siteUrl/],
    [{ siteUrl: 'https://x/emmetsplace' }, /siteUrl/],
    [{ siteUrl: 5 }, /siteUrl.*string/],
    [{ basePath: null }, /basePath.*string/],
    [{ bogus: 1 }, /Unknown site config key "bogus"/],
    [[], /object/],
    [null, /object/],
  ];
  for (const [input, re] of bad) {
    assert.throws(() => setConfig(input), (e) => e instanceof Error && re.test(e.message), JSON.stringify(input));
  }
  assert.deepStrictEqual(getConfig(), DEFAULTS);
});

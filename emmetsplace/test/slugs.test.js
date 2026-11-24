const test = require('node:test');
const assert = require('node:assert');
const { slugify, episodeSlugBase, allocateSlugs } = require('../site/slugs');

test('slugify folds diacritics and punctuation', () => {
  assert.strictEqual(slugify('Cyrille Aimée'), 'cyrille-aimee');
  assert.strictEqual(slugify('Béla Fleck & Friends!'), 'bela-fleck-friends');
});

test('slugify never returns empty', () => {
  assert.strictEqual(slugify('😀'), 'untitled');
  assert.strictEqual(slugify(''), 'untitled');
});

test('episodeSlugBase for numbered episodes', () => {
  assert.strictEqual(
    episodeSlugBase({ title: 'x', number: 134, guests: 'Kurt Elling' }),
    'vol-134-kurt-elling'
  );
  assert.strictEqual(episodeSlugBase({ title: 'x', number: 7, guests: null }), 'vol-7');
});

test('episodeSlugBase for non-numbered episodes strips emoji and Re-Stream prefix', () => {
  assert.strictEqual(
    episodeSlugBase({ title: '🎷 Re-Stream: Holiday Special', number: null, guests: null }),
    'holiday-special'
  );
});

test('allocateSlugs keeps pinned slugs', () => {
  const out = allocateSlugs([{ key: 'a', base: 'new-base' }], { a: 'old-slug' });
  assert.deepStrictEqual(out, { a: 'old-slug' });
});

test('allocateSlugs disambiguates equal bases', () => {
  const out = allocateSlugs([{ key: 'a', base: 'x' }, { key: 'b', base: 'x' }], {});
  assert.deepStrictEqual(out, { a: 'x', b: 'x-2' });
});

test('allocateSlugs avoids pinned slugs of other keys', () => {
  const out = allocateSlugs([{ key: 'b', base: 'x' }], { a: 'x' });
  assert.deepStrictEqual(out, { a: 'x', b: 'x-2' });
});

test('allocateSlugs is stable when re-run with its own output', () => {
  const items = [{ key: 'a', base: 'x' }, { key: 'b', base: 'x' }, { key: 'c', base: 'y' }];
  const first = allocateSlugs(items, {});
  assert.deepStrictEqual(allocateSlugs(items, first), first);
});

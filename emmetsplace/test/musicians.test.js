const { test } = require('node:test');
const assert = require('node:assert');
const { collectMusicians, isNoiseName, cleanArtists, MUSICIAN_ALIASES } = require('../site/musicians');

const ep = (id, artists) => ({ id, artists });
const a = (name, instrument) => ({ name, instrument });

test('isNoiseName flags empty, colon, @, http, and long names', () => {
  assert.strictEqual(isNoiseName(''), true);
  assert.strictEqual(isNoiseName("Charlie Parker: Now's the Time"), true);
  assert.strictEqual(isNoiseName('@someone'), true);
  assert.strictEqual(isNoiseName('see http://x.com'), true);
  assert.strictEqual(isNoiseName('one two three four five'), true);
  assert.strictEqual(isNoiseName('Joe Farnsworth'), false);
});

test('noise names are dropped', () => {
  const out = collectMusicians([ep('1', [a("Charlie Parker: Now's the Time", ''), a('', 'x'), a('Ann', 'bass')])]);
  assert.deepStrictEqual(out.map((m) => m.name), ['Ann']);
});

test('aliases merge variants', () => {
  const eps = [ep('2', [a('Joe Farnsworth Jr.', 'drums')]), ep('1', [a('Joe Farnsworth', 'drums')])];
  const out = collectMusicians(eps, { 'Joe Farnsworth Jr.': 'Joe Farnsworth' });
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].name, 'Joe Farnsworth');
  assert.deepStrictEqual(out[0].appearances.map((e) => e.id), ['2', '1']);
});

test('a name listed twice in one episode counts once', () => {
  const out = collectMusicians([ep('1', [a('Ann', 'bass'), a('Ann', 'vocals')])]);
  assert.strictEqual(out[0].appearances.length, 1);
});

test('instruments dedupe in first-seen order', () => {
  const eps = [ep('2', [a('Ann', 'bass')]), ep('1', [a('Ann', 'vocals'), a('Ann', 'bass'), a('Ann', '')])];
  assert.deepStrictEqual(collectMusicians(eps)[0].instruments, ['bass', 'vocals']);
});

test('sorted by appearance count desc then name', () => {
  const eps = [
    ep('2', [a('Zed', 'x'), a('Bob', 'y'), a('Cy', 'z')]),
    ep('1', [a('Cy', 'z'), a('Amy', 'w')]),
  ];
  assert.deepStrictEqual(collectMusicians(eps).map((m) => m.name), ['Cy', 'Amy', 'Bob', 'Zed']);
});

// ---- cleanArtists (final-review fix wave) ----
test('cleanArtists drops non-string and empty names', () => {
  assert.deepStrictEqual(cleanArtists([a(null, 'x'), a(42, 'x'), a('  ', 'x'), a('Ann', 'Bass'), null]), [a('Ann', 'Bass')]);
  assert.deepStrictEqual(cleanArtists(undefined), []);
});

test('cleanArtists strips leading feat./ft. and applies aliases', () => {
  assert.deepStrictEqual(cleanArtists([a('Feat. Sean Jones', 'Trumpet')]), [a('Sean Jones', 'Trumpet')]);
  assert.deepStrictEqual(cleanArtists([a('ft. Joe Farnsworth', 'Drums')]), [a('Joe Farnsworth', 'Drums')]);
  assert.deepStrictEqual(cleanArtists([a('feat Ann', 'Bass')]), [a('Ann', 'Bass')]);
});

test('cleanArtists drops names with parentheses', () => {
  assert.deepStrictEqual(cleanArtists([a('Lee Hill)', 'ft. Terell Stafford, trumpet'), a('Lea DeLaria (Big Boo)', 'voice'), a('Ann', 'Bass')]), [a('Ann', 'Bass')]);
});

test('cleanArtists drops crew and role names', () => {
  const crew = ['Cameraman', 'Director', 'Director of Photography', 'Concert Sound', 'Lighting Technician', 'Recording', 'Sound Engineer', 'Sound Technics', 'Audio', 'Michael Perez', 'cameraman', 'Live Recording Team', 'Mixing by Joe', 'Mastering'];
  assert.deepStrictEqual(cleanArtists(crew.map((n) => a(n, 'Somebody'))), []);
});

test('cleanArtists swaps instrument-as-name pairs', () => {
  assert.deepStrictEqual(cleanArtists([a('Bass', 'Russell Hall'), a('Piano', 'Emmet Cohen'), a('Vocals', 'Jazzmeia Horn')]),
    [a('Russell Hall', 'Bass'), a('Emmet Cohen', 'Piano'), a('Jazzmeia Horn', 'Vocals')]);
  // Only swapped when the instrument looks like a person name.
  assert.deepStrictEqual(cleanArtists([a('Bass', 'bass')]), [a('Bass', 'bass')]);
});

test('cleanArtists repairs hyphen-split names', () => {
  assert.deepStrictEqual(cleanArtists([a('Ann Hampton', 'Calloway - Vocals')]), [a('Ann Hampton Callaway', 'Vocals')]);
  assert.deepStrictEqual(cleanArtists([a('Jon', 'Erik Kellso - Trumpet')]), [a('Jon-Erik Kellso', 'Trumpet')]);
  assert.deepStrictEqual(cleanArtists([a('Hank Allen', 'Barfield - Drums')]), [a('Hank Allen-Barfield', 'Drums')]);
  // Left part starting with an instrument word is not a name fragment: keep the name, take the instrument.
  assert.deepStrictEqual(cleanArtists([a('Kyle Poole', 'drums Russell Hall - bass')]), [a('Kyle Poole', 'drums')]);
});

test('cleanArtists trims instruments containing a colon', () => {
  assert.deepStrictEqual(cleanArtists([a('Kyle Poole', 'Drums Donation Options:')]), [a('Kyle Poole', 'Drums')]);
});

test('cleanArtists dedupes a repeated name+instrument case-insensitively', () => {
  assert.deepStrictEqual(cleanArtists([a('Ann', 'Bass'), a('Ann', 'bass'), a('Ann', 'Vocals')]), [a('Ann', 'Bass'), a('Ann', 'Vocals')]);
});

test('cleanArtists seeded aliases', () => {
  const names = ['Feat. Sean Jones', 'Benny Benack', "Albert 'Tootie' Heath", 'Albert "Tootie" Heath', 'Ann Hampton-Calloway', 'Vanisha Could'];
  assert.deepStrictEqual(cleanArtists(names.map((n, i) => a(n, `x${i}`))).map((m) => m.name),
    ['Sean Jones', 'Benny Benack III', 'Tootie Heath', 'Tootie Heath', 'Ann Hampton Callaway', 'Vanisha Gould']);
  assert.strictEqual(MUSICIAN_ALIASES['Benny Benack'], 'Benny Benack III');
});

test('John Lumpkin III is an alias of John Lumpkin II (owner decision)', () => {
  const eps = [ep('2', cleanArtists([a('John Lumpkin III', 'Drums')])), ep('1', cleanArtists([a('John Lumpkin II', 'Drums')]))];
  const out = collectMusicians(eps);
  assert.deepStrictEqual(out.map((m) => m.name), ['John Lumpkin II']);
  assert.deepStrictEqual(out[0].appearances.map((e) => e.id), ['2', '1']);
});

test('cleanArtists drops noise names so lineups match musician pages', () => {
  assert.deepStrictEqual(cleanArtists([a("Charlie Parker: Now's the Time", 'Celebrating Bird at 100')]), []);
});

test('collectMusicians dedupes instruments case-insensitively and merges cleaned splits', () => {
  const eps = [ep('2', cleanArtists([a('Russell Hall', 'Bass')])), ep('1', cleanArtists([a('Bass', 'Russell Hall'), a('Russell Hall', 'bass')]))];
  const out = collectMusicians(eps);
  assert.strictEqual(out.length, 1);
  assert.deepStrictEqual(out[0].instruments, ['Bass']);
  assert.strictEqual(out[0].appearances.length, 2);
});

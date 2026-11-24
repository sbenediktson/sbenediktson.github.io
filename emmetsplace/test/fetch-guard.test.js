const test = require("node:test");
const assert = require("node:assert");
const { assertNotTruncated, assertEnoughDetails } = require("../fetch-guard");

const ids = (n) => Array.from({ length: n }, (_, i) => "v" + i);

test("assertNotTruncated passes when counts are equal", () => {
  assert.doesNotThrow(() => assertNotTruncated(ids(1300), ids(1300)));
});

test("assertNotTruncated passes on growth", () => {
  assert.doesNotThrow(() => assertNotTruncated(ids(1300), ids(1310)));
});

test("assertNotTruncated passes on a shrink within 10%", () => {
  assert.doesNotThrow(() => assertNotTruncated(ids(1300), ids(1200)));
});

test("assertNotTruncated passes at exactly the boundary", () => {
  assert.doesNotThrow(() => assertNotTruncated(ids(1300), ids(1170)));
});

test("assertNotTruncated throws just below the boundary", () => {
  assert.throws(() => assertNotTruncated(ids(1300), ids(1169)), Error);
});

test("assertNotTruncated throws when next is empty", () => {
  assert.throws(() => assertNotTruncated(ids(10), []), /Refusing to overwrite/);
  assert.throws(() => assertNotTruncated(null, []), Error);
});

test("assertNotTruncated passes with null or empty existing", () => {
  assert.doesNotThrow(() => assertNotTruncated(null, ids(5)));
  assert.doesNotThrow(() => assertNotTruncated(undefined, ids(5)));
  assert.doesNotThrow(() => assertNotTruncated([], ids(5)));
});

test("assertNotTruncated message contains the three numbers", () => {
  assert.throws(
    () => assertNotTruncated(ids(1300), ids(750)),
    (err) => /fetched 750 videos/.test(err.message) && /has 1300/.test(err.message) && /minimum allowed 1170/.test(err.message)
  );
});

test("assertNotTruncated honours opts.minRatio", () => {
  assert.throws(() => assertNotTruncated(ids(100), ids(60), { minRatio: 0.7 }), Error);
  assert.doesNotThrow(() => assertNotTruncated(ids(100), ids(70), { minRatio: 0.7 }));
});

test("assertEnoughDetails passes when all ids have details", () => {
  const list = ids(10);
  const data = Object.fromEntries(list.map((i) => [i, {}]));
  assert.doesNotThrow(() => assertEnoughDetails(list, data));
});

test("assertEnoughDetails passes at 90% and throws below, naming counts", () => {
  const list = ids(100);
  const mk = (n) => Object.fromEntries(list.slice(0, n).map((i) => [i, {}]));
  assert.doesNotThrow(() => assertEnoughDetails(list, mk(90)));
  assert.throws(
    () => assertEnoughDetails(list, mk(89)),
    (err) => /89/.test(err.message) && /100/.test(err.message) && /90/.test(err.message)
  );
});

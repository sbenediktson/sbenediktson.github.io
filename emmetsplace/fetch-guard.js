// Guards that stop a truncated YouTube fetch from overwriting videos.json.

function assertNotTruncated(existingIds, nextIds, opts = {}) {
  const minRatio = opts.minRatio === undefined ? 0.9 : opts.minRatio;
  const existingCount = Array.isArray(existingIds) ? existingIds.length : 0;
  const minimum = Math.ceil(existingCount * minRatio);
  if (nextIds.length === 0 || (existingCount > 0 && nextIds.length < minimum)) {
    throw new Error(
      `Refusing to overwrite videos.json: fetched ${nextIds.length} videos but the existing file has ${existingCount} (minimum allowed ${minimum}). The fetch looks truncated.`
    );
  }
}

function assertEnoughDetails(ids, data, opts = {}) {
  const minRatio = opts.minRatio === undefined ? 0.9 : opts.minRatio;
  const have = ids.filter((id) => data[id]).length;
  const minimum = Math.ceil(ids.length * minRatio);
  if (have < minimum) {
    throw new Error(
      `Refusing to overwrite videos.json: fetched details for only ${have} of ${ids.length} videos (minimum allowed ${minimum}). The fetch looks truncated.`
    );
  }
}

module.exports = { assertNotTruncated, assertEnoughDetails };

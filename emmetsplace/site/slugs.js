const { stripEmoji, RESTREAM_PREFIX } = require('./episodes');

function slugify(text) {
  const slug = String(text)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'untitled';
}

function episodeSlugBase(ep) {
  if (ep.number !== null) {
    return ep.guests ? slugify(`vol-${ep.number}-${ep.guests}`) : `vol-${ep.number}`;
  }
  return slugify(stripEmoji(ep.title).replace(RESTREAM_PREFIX, ''));
}

function allocateSlugs(items, pinned) {
  const result = { ...pinned };
  const used = new Set(Object.values(pinned));
  for (const { key, base } of items) {
    if (key in pinned) continue;
    let slug = base;
    for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;
    used.add(slug);
    result[key] = slug;
  }
  return result;
}

module.exports = { slugify, episodeSlugBase, allocateSlugs };

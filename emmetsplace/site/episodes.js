'use strict';

const { cleanArtists } = require('./musicians');
const { nyParts } = require('./dates');

const MIN_DURATION = 1800;

// A live/upcoming stream that has no duration yet but is scheduled.
const isUpcoming = (v) => v.isLive === true && v.duration === 0 && Boolean(v.scheduledStartTime);

// Re-streams whose title differs too much from the original to match by title (re-stream id -> original id).
const RESTREAM_OF = {
  eeGOC0JB2rY: 'JqdIoQgOGnw', // Dazzle Denver
  wCafMBaQAmA: 'MpCkfoGQbQY', // the Gilmore
  oGlBqHDPpuU: 'q5SwTPZLM5o', // Moscow
  p5VizNFuJKw: 'cHfRl3Mf6jw', // Budapest Jazz Club
  'wgAkz3uM-pM': '7iRF3nhL0X4', // New Mexico w/ Tootie Heath
  jgd8NAg0__g: 'OsOOjFhfbE0', // Funchal, Portugal
  U7_sjYqu7UU: 'Hdc1ExQMZ4A', // Purdue
};

function stripEmoji(s) {
  return String(s).replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '').replace(/\s+/g, ' ').trim();
}

function normalizeApos(s) {
  return s.replace(/[‘’ʼ`´]/g, "'");
}

const RESTREAM_PREFIX = /^\s*re-?stream\b\s*[:\-\u2013\u2014]?\s*/i;
const isRestream = (title) => RESTREAM_PREFIX.test(title);
const stripRestream = (title) => title.replace(RESTREAM_PREFIX, '');

// Series number, or null. "Masters Legacy Series" is a different series.
function parseNumber(title) {
  const t = normalizeApos(title);
  if (/masters legacy/i.test(t)) return null;
  const ep = t.match(/\(\s*Ep(?:isode|\.)?\s*(\d+)\s*\)/i);
  if (ep) return Number(ep[1]);
  if (/emmet'?s?\s*place/i.test(t) || /live (from|at) emmet'?s\b/i.test(t)) {
    const vol = t.match(/\b(?:Vol(?:ume)?|Ep(?:isode)?)\.?\s*(\d+)/i);
    if (vol) return Number(vol[1]);
  }
  return null;
}

function parseGuests(title) {
  const m = stripRestream(stripEmoji(title)).match(/\bVol\.?\s*\d+\s*(?:[-–—]|\bfeat(?:uring)?\b\.?|\bft\b\.?)\s*(.+)$/i);
  return m ? m[1].trim() : null;
}

function locationFor(number) {
  if (number === null) return null;
  return number <= 136 ? 'Harlem, New York' : 'Power Station at Berklee NYC';
}

// Title key: punctuation-insensitive, so "Trio - Live at X" and "Trio Live at X" match.
function titleKey(title) {
  const { slugify } = require('./slugs'); // lazy: slugs.js requires this module
  return slugify(normalizeApos(stripRestream(stripEmoji(title))));
}
const looseKey = (key) => key.replace(/-(19|20)\d\d$/, '');

function groupKey(title, number) {
  if (number !== null) return 'n:' + number;
  return 't:' + titleKey(title);
}

// Earliest date first; missing dates last.
function byDateAsc(a, b) {
  if (a.streamDate === b.streamDate) return 0;
  if (!a.streamDate) return 1;
  if (!b.streamDate) return -1;
  return a.streamDate < b.streamDate ? -1 : 1;
}

function selectEpisodes(data) {
  const entries = [];
  for (const [id, v] of Object.entries(data || {})) {
    if (!v || !(v.duration >= MIN_DURATION || isUpcoming(v))) continue;
    const number = parseNumber(v.title);
    entries.push({ id, v, number, key: groupKey(v.title, number) });
  }
  const byId = new Map(entries.map((e) => [e.id, e]));
  // Explicitly mapped re-streams join their original's group (if the original is selected).
  for (const e of entries) {
    const target = byId.get(RESTREAM_OF[e.id]);
    if (target) e.key = target.key;
  }
  // A re-stream that matches no original may match one by ignoring a trailing year
  // ("... (2021)"). Originals are never merged with each other this way.
  const originalKeys = new Set(entries.filter((e) => !isRestream(e.v.title)).map((e) => e.key));
  const looseOriginals = new Map();
  for (const k of originalKeys) {
    if (!k.startsWith('t:')) continue;
    const lk = looseKey(k);
    looseOriginals.set(lk, looseOriginals.has(lk) ? null : k);
  }
  for (const e of entries) {
    if (!isRestream(e.v.title) || originalKeys.has(e.key) || !e.key.startsWith('t:')) continue;
    const match = looseOriginals.get(looseKey(e.key));
    if (match) e.key = match;
  }
  const groups = new Map();
  for (const e of entries) {
    if (!groups.has(e.key)) groups.set(e.key, []);
    groups.get(e.key).push(e);
  }

  const episodes = [];
  for (const members of groups.values()) {
    members.sort((a, b) => byDateAsc(a.v, b.v));
    const originals = members.filter((m) => !isRestream(m.v.title));
    const canonical = (originals.length ? originals : members)[0];
    const { id, v, number } = canonical;
    // Upcoming streams: streamDate is only the publish date, so use the scheduled start.
    const streamDate = (isUpcoming(v) ? v.scheduledStartTime : v.streamDate) || null;
    episodes.push({
      id,
      title: v.title,
      number,
      guests: number !== null ? parseGuests(v.title) : null,
      streamDate,
      year: nyParts(streamDate) ? nyParts(streamDate).year : null,
      duration: v.duration,
      location: locationFor(number),
      artists: cleanArtists(v.artists),
      songs: v.songs || [],
      description: v.description || '',
      restreams: members.filter((m) => m !== canonical).map((m) => ({ id: m.id, title: m.v.title })),
    });
  }
  episodes.sort((a, b) => {
    if (!a.streamDate || !b.streamDate) return byDateAsc(a, b);
    return byDateAsc(b, a);
  });
  return episodes;
}

function pageTitle(ep) {
  let base;
  if (ep.number !== null && ep.guests) {
    base = `${ep.guests} - Live From Emmet's Place Vol. ${ep.number}`;
  } else {
    base = stripRestream(stripEmoji(ep.title))
      .replace(/\(\s*Ep(?:isode|\.)?\s*\d+\s*\)/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (ep.number !== null && !/\bvol\.?\s*\d/i.test(base)) base += ` - Live From Emmet's Place Vol. ${ep.number}`;
  }
  return ep.year && !/\b(19|20)\d{2}\b/.test(base) ? `${base} (${ep.year})` : base;
}

module.exports = { selectEpisodes, pageTitle, stripEmoji, RESTREAM_PREFIX, RESTREAM_OF };

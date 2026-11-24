// Canonical spellings, applied to cleaned names. Targets must not themselves be keys.
const MUSICIAN_ALIASES = {
  'Feat. Sean Jones': 'Sean Jones',
  'Benny Benack': 'Benny Benack III',
  "Albert 'Tootie' Heath": 'Tootie Heath',
  'Albert "Tootie" Heath': 'Tootie Heath',
  'Ann Hampton-Calloway': 'Ann Hampton Callaway',
  'Vanisha Could': 'Vanisha Gould',
  'John Lumpkin III': 'John Lumpkin II', // owner decision: same person
};

function isNoiseName(name) {
  const n = String(name).trim();
  if (!n) return true;
  if (/[:@]/.test(n) || n.includes('http')) return true;
  return n.split(/\s+/).length > 4;
}

const FEAT_PREFIX = /^(feat\.?|ft\.?)\s+/i;
const CREW = /^(cameraman|director|director of photography|concert sound|lighting technician|recording|sound engineer|sound technics|audio|michael perez)$/i;
const CREW_WORDS = /recording|mixing|mastering/i;
const INSTRUMENT_WORD = /^(bass|drums|piano|vocals|saxophone|trumpet|guitar)$/i;
const PERSONISH = /^\p{Lu}[\p{L}'’.-]*(\s+\p{Lu}[\p{L}'’.-]*)+$/u;

// Repair one raw { name, instrument } from the video descriptions; null means drop it.
function cleanArtist(raw) {
  if (!raw || typeof raw.name !== 'string') return null;
  let name = raw.name.trim().replace(FEAT_PREFIX, '').trim();
  let instrument = typeof raw.instrument === 'string' ? raw.instrument.trim() : '';
  if (!name || /[()]/.test(name) || CREW.test(name) || CREW_WORDS.test(name)) return null;
  if (INSTRUMENT_WORD.test(name) && PERSONISH.test(instrument) && !INSTRUMENT_WORD.test(instrument)) {
    [name, instrument] = [instrument, name];
  }
  const dash = instrument.indexOf(' - ');
  if (dash >= 0) {
    const left = instrument.slice(0, dash).trim();
    const right = instrument.slice(dash + 3).trim();
    const firstWord = left.split(/\s+/)[0];
    if (INSTRUMENT_WORD.test(firstWord)) {
      // "drums Russell Hall - bass": the left part is this player's instrument, not a name fragment.
      instrument = firstWord;
    } else if (left) {
      // "Ann Hampton" + "Calloway - Vocals" -> "Ann Hampton-Calloway" / "Vocals".
      name = `${name}-${left}`;
      instrument = right;
    }
  }
  if (instrument.includes(':')) instrument = instrument.split(':')[0].trim().split(/\s+/)[0] || '';
  if (isNoiseName(name)) return null;
  name = MUSICIAN_ALIASES[name] || name;
  return { name, instrument };
}

// Clean a video's artist list: repaired entries, junk dropped, repeated name+instrument once.
function cleanArtists(artists) {
  const out = [];
  const seen = new Set();
  for (const raw of Array.isArray(artists) ? artists : []) {
    const a = cleanArtist(raw);
    if (!a) continue;
    const key = `${a.name}\u0000${a.instrument.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(a);
  }
  return out;
}

function collectMusicians(episodes, aliases = MUSICIAN_ALIASES) {
  const byName = new Map();
  for (const ep of episodes) {
    for (const artist of ep.artists) {
      const raw = String(artist.name).trim();
      if (isNoiseName(raw)) continue;
      const name = aliases[raw] || raw;
      let m = byName.get(name);
      if (!m) {
        m = { name, instruments: [], appearances: [] };
        byName.set(name, m);
      }
      const instrument = String(artist.instrument || '').trim();
      if (instrument && !m.instruments.some((i) => i.toLowerCase() === instrument.toLowerCase())) m.instruments.push(instrument);
      if (!m.appearances.includes(ep)) m.appearances.push(ep);
    }
  }
  return [...byName.values()].sort(
    (a, b) => b.appearances.length - a.appearances.length || a.name.localeCompare(b.name)
  );
}

module.exports = { MUSICIAN_ALIASES, isNoiseName, cleanArtists, collectMusicians };

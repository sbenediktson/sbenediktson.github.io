'use strict';

// All human-facing dates, quarter keys and years are shown in the stream's home timezone.
const TIME_ZONE = 'America/New_York';
const PARTS = new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, year: 'numeric', month: 'numeric', day: 'numeric' });
const LONG = new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, year: 'numeric', month: 'long', day: 'numeric' });

function toDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d) ? null : d;
}

// { year, month (1-12), day } in New York, or null.
function nyParts(value) {
  const d = toDate(value);
  if (!d) return null;
  const p = Object.fromEntries(PARTS.formatToParts(d).map((x) => [x.type, x.value]));
  return { year: Number(p.year), month: Number(p.month), day: Number(p.day) };
}

// "March 3, 2025", or '' for a missing/invalid date.
function formatLongDate(value) {
  const d = toDate(value);
  return d ? LONG.format(d) : '';
}

module.exports = { TIME_ZONE, nyParts, formatLongDate };

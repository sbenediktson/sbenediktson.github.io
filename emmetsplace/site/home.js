'use strict';

const { esc } = require('./html');
const { link } = require('./config');
const { stripEmoji } = require('./episodes');
const { nyParts, formatLongDate } = require('./dates');

const QNAME = { '01': 'Jan', '04': 'Apr', '07': 'Jul', '10': 'Oct' };
const MAX_VISIBLE_SONGS = 6;

function cardType(ep) {
  const title = stripEmoji(ep.title);
  if (/\b(vol|ep)\b/i.test(title) || ep.id === 'mX912vvfmdo') return 'studio';
  if (/live at/i.test(title)) return 'road';
  return 'other';
}

// "YYYY-MM" of the quarter's first month, in New York time; null for a bad date.
function quarterKey(value) {
  const p = nyParts(value);
  if (!p) return null;
  const qs = Math.floor((p.month - 1) / 3) * 3;
  return `${p.year}-${String(qs + 1).padStart(2, '0')}`;
}

function quarterHeaderText(key) {
  const [yyyy, mm] = key.split('-');
  return `${QNAME[mm]} ${yyyy}`;
}


// Cmd/Ctrl/Shift-click follows the link instead of playing in the hero player.
const LET_MODIFIED_CLICK = 'if(event.metaKey||event.ctrlKey||event.shiftKey)return true;';

function songLink(id, song) {
  const title = stripEmoji(song.title);
  const start = Math.floor(Number(song.start) || 0);
  const href = `https://www.youtube.com/watch?v=${id}` + (start ? `&t=${start}` : '');
  const startArg = start ? `,true,false,${start}` : ',true,false';
  return `<a class="video-entry-link" data-text="${esc(title)}" href="${esc(href)}" onclick="${LET_MODIFIED_CLICK}playInHero('${esc(id)}'${esc(startArg)});return false;">${esc(title)}</a>`;
}

function renderCard(ep, slug) {
  const id = ep.id;
  const videoTitle = stripEmoji(ep.title);
  const type = cardType(ep);
  const thumb = `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
  const href = link(`/episodes/${slug}/`);
  const play = `${LET_MODIFIED_CLICK}playInHero('${esc(id)}',true,false);return false;`;

  const artistsHTML = ep.artists.length
    ? `<div class="video-artists">${ep.artists.map((a) =>
      `<span class="video-artist"><strong class="artist-name" data-text="${esc(a.name)}">${esc(a.name)}</strong> · ${esc(a.instrument)}</span>`).join('')}</div>`
    : '';

  const links = ep.songs.map((s) => songLink(id, s));
  let entriesHTML = '';
  if (links.length && links.length <= MAX_VISIBLE_SONGS) {
    entriesHTML = links.join('');
  } else if (links.length) {
    const uid = `more-${esc(id)}`;
    const n = links.length - MAX_VISIBLE_SONGS;
    entriesHTML = links.slice(0, MAX_VISIBLE_SONGS).join('') +
      `<div id="${uid}" style="display:none;flex-direction:column;gap:6px">${links.slice(MAX_VISIBLE_SONGS).join('')}</div>` +
      `<button class="show-more-btn" onclick="var el=document.getElementById('${uid}');var isOpen=el.style.display==='flex';el.style.display=isOpen?'none':'flex';this.textContent=isOpen?'Show ${n} more...':'Show less'">Show ${n} more...</button>`;
  }

  const collapseId = `collapse-${esc(id)}`;
  const hasExtra = artistsHTML || entriesHTML;
  const titles = [videoTitle, ...ep.songs.map((s) => s.title)].join(' ').toLowerCase();
  const artists = ep.artists.map((a) => a.name).join(' ').toLowerCase();

  return `<div class="video-card" data-type="${type}" data-id="${esc(id)}" data-titles="${esc(titles)}" data-artists="${esc(artists)}">` +
    `<div class="video-card-thumb"><a class="video-link" href="${esc(href)}" onclick="${play}" style="background-image: url('${esc(thumb)}')"></a></div>` +
    `<div class="video-card-body">` +
    (type === 'studio' ? '<span class="studio-badge">In Studio</span>' : '') +
    `<h2><a class="title-link" href="${esc(href)}" onclick="${play}">${esc(videoTitle)}</a></h2>` +
    (formatLongDate(ep.streamDate) ? `<div class="stream-date">${esc(formatLongDate(ep.streamDate))}</div>` : '') +
    (hasExtra
      ? `<div id="${collapseId}" style="display:none">${artistsHTML}<div class="video-entries">${entriesHTML}</div></div>` +
        `<button class="card-expand-btn" onclick="var el=document.getElementById('${collapseId}');var open=el.style.display!=='none';el.style.display=open?'none':'';this.textContent=open?'Show more':'Show less'">Show more</button>`
      : '') +
    `</div></div>`;
}

function renderCards(episodes, slugs) {
  const out = [];
  let lastQuarter = null;
  for (const ep of episodes) {
    const slug = slugs[ep.id];
    if (!slug) throw new Error(`No slug for episode ${ep.id}`);
    const q = quarterKey(ep.streamDate);
    if (q && q !== lastQuarter) {
      const yr = q.split('-')[0];
      const isNewYear = !lastQuarter || lastQuarter.split('-')[0] !== yr;
      out.push(`<div class="tune-section-header episode-year-header${isNewYear ? ' year-start' : ''}" data-year="${q}" id="eqsec-${q}">${isNewYear ? yr : quarterHeaderText(q)}</div>`);
      lastQuarter = q;
    }
    out.push(renderCard(ep, slug));
  }
  return out.join('\n');
}

function replaceBetweenMarkers(html, name, content) {
  const start = `<!-- build:${name}:start -->`;
  const end = `<!-- build:${name}:end -->`;
  const count = (s) => html.split(s).length - 1;
  if (count(start) !== 1 || count(end) !== 1) {
    throw new Error(`Expected exactly one ${start} and one ${end} marker`);
  }
  const a = html.indexOf(start) + start.length;
  const b = html.indexOf(end);
  if (b < a) throw new Error(`Marker ${end} appears before ${start}`);
  return html.slice(0, a) + content + html.slice(b);
}

module.exports = { cardType, renderCards, replaceBetweenMarkers };

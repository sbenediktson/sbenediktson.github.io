'use strict';

const { esc } = require('./html');
const { absoluteUrl } = require('./config');
const { pageTitle } = require('./episodes');
const { episodeUrl, musicianUrl } = require('./pages');

// Placeholder: the owner may rewrite this summary.
const LLMS_SUMMARY = "Emmet's Place is a series of live jazz streams hosted by pianist Emmet Cohen. Each episode page has the full video, date, location, lineup and setlist; each musician page lists every episode they appear in.";

function renderSitemap(urls) {
  const items = urls.map((u) => `  <url>\n    <loc>${esc(u.loc)}</loc>\n${u.lastmod ? `    <lastmod>${esc(u.lastmod)}</lastmod>\n` : ''}  </url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items.join('\n')}\n</urlset>\n`;
}

const dateOf = (ep) => (ep.streamDate ? String(ep.streamDate).slice(0, 10) : '');

function renderLlmsTxt(episodes, musicians, slugs) {
  const eps = episodes.map((e) => {
    const d = dateOf(e);
    return `- [${pageTitle(e)}](${absoluteUrl(episodeUrl(slugs.episodes[e.id]))})${d ? `: ${d}` : ''}`;
  });
  const ms = musicians.map((m) => {
    const n = m.appearances.length;
    return `- [${m.name}](${absoluteUrl(musicianUrl(slugs.musicians[m.name]))}): ${n} episode${n === 1 ? '' : 's'}`;
  });
  return `# Emmet's Place\n\n> ${LLMS_SUMMARY}\n\nSitemap: ${absoluteUrl('/sitemap.xml')}\n\n## Episodes\n\n${eps.join('\n')}\n\n## Musicians\n\n${ms.join('\n')}\n`;
}

module.exports = { LLMS_SUMMARY, renderSitemap, renderLlmsTxt, dateOf };

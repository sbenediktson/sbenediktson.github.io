'use strict';

const DEFAULTS = Object.freeze({ siteUrl: 'https://emmetsplace.com', basePath: '' });
const SITE_URL_RE = /^https:\/\/[a-z0-9.-]+(:\d+)?$/;
const BASE_PATH_RE = /^\/[a-z0-9._-]+(\/[a-z0-9._-]+)*$/;

let current = { ...DEFAULTS };

function setConfig(partial) {
  const p = partial === undefined ? {} : partial;
  if (p === null || typeof p !== 'object' || Array.isArray(p)) throw new Error('Site config must be an object');
  for (const key of Object.keys(p)) {
    if (!Object.prototype.hasOwnProperty.call(DEFAULTS, key)) throw new Error(`Unknown site config key ${JSON.stringify(key)}`);
    if (typeof p[key] !== 'string') throw new Error(`Site config "${key}" must be a string`);
  }
  const next = { ...DEFAULTS, ...p };
  if (!SITE_URL_RE.test(next.siteUrl)) {
    throw new Error(`Site config "siteUrl" must be an https origin with no path or trailing slash, e.g. "https://example.com" (got ${JSON.stringify(next.siteUrl)})`);
  }
  if (next.basePath !== '' && (!BASE_PATH_RE.test(next.basePath) || next.basePath.split('/').some((s) => s === '.' || s === '..'))) {
    throw new Error(`Site config "basePath" must be "" or start with "/" with no trailing slash or ".." segments, e.g. "/emmetsplace" (got ${JSON.stringify(next.basePath)})`);
  }
  current = next;
}

const getConfig = () => ({ ...current });
const resetConfig = () => { current = { ...DEFAULTS }; };

// Internal href/src: basePath + root-relative path.
const link = (p) => current.basePath + p;
// Absolute URL (canonical, og:url, sitemap, llms.txt): siteUrl + basePath + path.
const absoluteUrl = (p) => current.siteUrl + current.basePath + p;

module.exports = { DEFAULTS, setConfig, getConfig, resetConfig, link, absoluteUrl };

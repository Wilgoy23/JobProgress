import { PORTALS } from './constants.js';

const pad = (n) => String(n).padStart(2, '0');

export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function dayNum(s) {
  const [y, m, d] = s.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
}

/** "Nov 14", or "Nov 14, 2025" when not in the current year. */
export function fmtDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  const opts = { month: 'short', day: 'numeric' };
  if (y !== new Date().getFullYear()) opts.year = 'numeric';
  return new Date(y, m - 1, d).toLocaleDateString(undefined, opts);
}

/** "today", "3 days ago", "in 5 days", … */
export function relDays(s) {
  const diff = dayNum(s) - dayNum(todayStr());
  if (diff === 0) return 'today';
  if (diff === -1) return 'yesterday';
  if (diff === 1) return 'tomorrow';
  return diff < 0 ? `${-diff} days ago` : `in ${diff} days`;
}

export function fmtTimestamp(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** Accepts links pasted without a scheme; returns '' for anything that isn't http(s). */
export function normalizeUrl(raw) {
  const s = (raw || '').trim();
  if (!s) return '';
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    if (!u.hostname.includes('.')) return '';
    return u.href;
  } catch {
    return '';
  }
}

export function portalName(url) {
  if (!url) return '';
  let host;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
  for (const [re, name] of PORTALS) if (re.test(host)) return name;
  return host.replace(/^www\./, '');
}

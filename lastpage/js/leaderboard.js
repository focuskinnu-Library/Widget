/* LAST PAGE — the class ranking.
 *
 * Works with no server at all: your own results are kept on the device and the
 * back wall shows the legends. Point it at an endpoint (a same-origin /api, or
 * window.LASTPAGE_API) and the same board becomes worldwide.
 */

import { load } from './store.js';
import { HALL_OF_FAME } from './universe.js';

const base = () =>
  (typeof window !== 'undefined' && window.LASTPAGE_API) ||
  (location.protocol.startsWith('http') ? '/api' : null);

let online = null;           // null = unknown, true/false once probed
let lastError = null;

export const isOnline = () => online === true;
export const statusNote = () =>
  online === true ? 'live · worldwide'
  : online === false ? 'offline · this device only'
  : 'checking…';

async function req(path, opts = {}, ms = 6000) {
  const root = base();
  if (!root) throw new Error('no endpoint');
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(root + path, {
      ...opts,
      signal: ctl.signal,
      headers: { 'content-type': 'application/json', ...(opts.headers || {}) },
    });
    if (!res.ok) throw new Error('http ' + res.status);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function probe() {
  try {
    await req('/health', {}, 3500);
    online = true;
  } catch (e) {
    online = false;
    lastError = e.message;
  }
  return online;
}

/** Push the player's running total. Fire and forget — never blocks the game. */
export async function submit(extra = {}) {
  const p = load();
  if (!p.name) return null;
  const payload = {
    name: p.name,
    ink: p.ink,
    played: p.played,
    won: p.won,
    bestCombo: p.bestCombo,
    ladder: Object.values(p.ladder).filter((x) => x.beaten).length,
    stars: Object.values(p.ladder).reduce((n, x) => n + (x.stars || 0), 0),
    client: clientId(),
    ...extra,
  };
  try {
    const out = await req('/scores', { method: 'POST', body: JSON.stringify(payload) });
    online = true;
    return out;
  } catch (e) {
    online = false;
    lastError = e.message;
    return null;
  }
}

/** The world board, or the device board when there is nowhere to reach. */
export async function fetchBoard(scope = 'world') {
  try {
    const out = await req(`/scores?scope=${encodeURIComponent(scope)}&limit=50`);
    online = true;
    return { source: 'world', rows: out.rows || [], you: out.you || null };
  } catch {
    online = false;
    return { source: 'local', rows: localRows(), you: null };
  }
}

function localRows() {
  const p = load();
  if (!p.name) return [];
  return [{
    name: p.name,
    ink: p.ink,
    played: p.played,
    won: p.won,
    stars: Object.values(p.ladder).reduce((n, x) => n + (x.stars || 0), 0),
    you: true,
  }];
}

export function hallOfFame() {
  return HALL_OF_FAME.map((h, i) => ({ ...h, rank: i + 1, legend: true }));
}

/** A stable per-device id, so a returning player updates their own row. */
export function clientId() {
  const k = 'lastpage.client';
  let v = null;
  try { v = localStorage.getItem(k); } catch { /* ignore */ }
  if (!v) {
    v = 'c' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
    try { localStorage.setItem(k, v); } catch { /* ignore */ }
  }
  return v;
}

export async function fetchDaily(dayKey) {
  try {
    const out = await req(`/daily?day=${encodeURIComponent(dayKey)}&limit=50`);
    online = true;
    return { source: 'world', rows: out.rows || [] };
  } catch {
    online = false;
    return { source: 'local', rows: [] };
  }
}

export async function submitDaily(dayKey, entry) {
  const p = load();
  if (!p.name) return null;
  try {
    const out = await req('/daily', {
      method: 'POST',
      body: JSON.stringify({ day: dayKey, name: p.name, client: clientId(), ...entry }),
    });
    online = true;
    return out;
  } catch {
    online = false;
    return null;
  }
}

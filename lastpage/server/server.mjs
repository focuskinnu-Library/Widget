#!/usr/bin/env node
/* LAST PAGE — the optional bit.
 *
 * The game is a static site and works with no server at all. Run this and two
 * extra things switch on: the worldwide class ranking and the daily page board.
 *
 *   node server/server.mjs            # port 3000
 *   PORT=8080 node server/server.mjs
 *
 * No dependencies. Scores live in a JSON file next to this one.
 */

import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DB = path.join(__dirname, 'scores.json');
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
};

/* ------------------------------------------------------------ storage -- */

let db = { scores: {}, daily: {} };
try {
  db = JSON.parse(fs.readFileSync(DB, 'utf8'));
  db.scores ||= {};
  db.daily ||= {};
} catch { /* first run */ }

let writeTimer = null;
function persist() {
  clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    fsp.writeFile(DB, JSON.stringify(db), 'utf8').catch((e) => console.error('save failed', e.message));
  }, 400);
}

const clean = (s, n = 16) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);
const num = (v, max = 1e9) => {
  const x = Number(v);
  return Number.isFinite(x) ? Math.max(0, Math.min(max, Math.round(x))) : 0;
};

/* Enough to stop idle nonsense, not enough to be annoying. */
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const bucket = hits.get(ip) || { n: 0, t: now };
  if (now - bucket.t > 60000) { bucket.n = 0; bucket.t = now; }
  bucket.n++;
  hits.set(ip, bucket);
  return bucket.n > 90;
}

/* --------------------------------------------------------------- api --- */

function send(res, code, body, type = 'application/json; charset=utf-8') {
  res.writeHead(code, {
    'content-type': type,
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'cache-control': 'no-store',
  });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => {
      raw += c;
      if (raw.length > 8000) { reject(new Error('too big')); req.destroy(); }
    });
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch { reject(new Error('bad json')); } });
    req.on('error', reject);
  });
}

async function api(req, res, url) {
  const route = url.pathname.replace(/^\/api/, '') || '/';

  if (req.method === 'OPTIONS') return send(res, 204, '');

  if (route === '/health') {
    return send(res, 200, { ok: true, players: Object.keys(db.scores).length, at: Date.now() });
  }

  if (route === '/scores' && req.method === 'GET') {
    const limit = Math.min(100, num(url.searchParams.get('limit')) || 50);
    const rows = Object.values(db.scores)
      .sort((a, b) => b.ink - a.ink)
      .slice(0, limit)
      .map(({ client, ...r }) => r);
    return send(res, 200, { rows, total: Object.keys(db.scores).length });
  }

  if (route === '/scores' && req.method === 'POST') {
    const b = await readBody(req).catch(() => null);
    if (!b) return send(res, 400, { error: 'bad body' });
    const client = clean(b.client, 40);
    const name = clean(b.name);
    if (!client || !name) return send(res, 400, { error: 'name and client required' });
    const prev = db.scores[client];
    const row = {
      client,
      name,
      ink: num(b.ink, 5e7),
      played: num(b.played, 1e5),
      won: num(b.won, 1e5),
      stars: num(b.stars, 36),
      ladder: num(b.ladder, 12),
      bestCombo: num(b.bestCombo, 200),
      at: Date.now(),
    };
    // Only ever move forward: a stale tab cannot rewind a real total.
    if (prev && prev.ink > row.ink) row.ink = prev.ink;
    db.scores[client] = row;
    persist();
    const sorted = Object.values(db.scores).sort((a, b2) => b2.ink - a.ink);
    return send(res, 200, { ok: true, rank: sorted.findIndex((r) => r.client === client) + 1, of: sorted.length });
  }

  if (route === '/daily' && req.method === 'GET') {
    const day = clean(url.searchParams.get('day'), 10);
    const limit = Math.min(100, num(url.searchParams.get('limit')) || 50);
    const rows = Object.values(db.daily[day] || {})
      .sort((a, b) => b.ink - a.ink || a.seconds - b.seconds)
      .slice(0, limit)
      .map(({ client, ...r }) => r);
    return send(res, 200, { day, rows });
  }

  if (route === '/daily' && req.method === 'POST') {
    const b = await readBody(req).catch(() => null);
    if (!b) return send(res, 400, { error: 'bad body' });
    const day = clean(b.day, 10);
    const client = clean(b.client, 40);
    const name = clean(b.name);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !client || !name) return send(res, 400, { error: 'bad entry' });
    db.daily[day] ||= {};
    if (db.daily[day][client]) return send(res, 200, { ok: true, note: 'one go per day' });
    db.daily[day][client] = {
      client, name,
      ink: num(b.ink, 1e6),
      margin: Math.max(-99, Math.min(99, Math.round(Number(b.margin) || 0))),
      seconds: num(b.seconds, 86400),
      at: Date.now(),
    };
    // Keep a fortnight of pages, no more.
    const days = Object.keys(db.daily).sort();
    while (days.length > 14) delete db.daily[days.shift()];
    persist();
    return send(res, 200, { ok: true });
  }

  return send(res, 404, { error: 'no such route' });
}

/* ------------------------------------------------------------ static --- */

async function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/') rel = '/index.html';
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT)) return send(res, 403, 'no', 'text/plain');
  try {
    const st = await fsp.stat(file);
    if (st.isDirectory()) return serveStatic(req, res, new URL(rel.replace(/\/$/, '') + '/index.html', 'http://x'));
    const buf = await fsp.readFile(file);
    res.writeHead(200, {
      'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-cache',
      'x-content-type-options': 'nosniff',
    });
    res.end(buf);
  } catch {
    // single page app: unknown paths fall back to the notebook
    try {
      const buf = await fsp.readFile(path.join(ROOT, 'index.html'));
      res.writeHead(200, { 'content-type': MIME['.html'] });
      res.end(buf);
    } catch {
      send(res, 404, 'not found', 'text/plain');
    }
  }
}

/* ------------------------------------------------------------- serve --- */

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || 'x';
  try {
    if (url.pathname.startsWith('/api')) {
      if (rateLimited(ip)) return send(res, 429, { error: 'slow down' });
      return await api(req, res, url);
    }
    await serveStatic(req, res, url);
  } catch (e) {
    console.error(e);
    send(res, 500, { error: 'server' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Last Page — http://${HOST}:${PORT}`);
  console.log(`  ${Object.keys(db.scores).length} players on the board`);
});

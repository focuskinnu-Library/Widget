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
function rateLimited(ip, budget = 90) {
  const now = Date.now();
  const bucket = hits.get(ip) || { n: 0, t: now };
  if (now - bucket.t > 60000) { bucket.n = 0; bucket.t = now; }
  bucket.n++;
  hits.set(ip, bucket);
  return bucket.n > budget;
}

/* ---------------------------------------------------------- the rooms -- */
/* A dumb relay. The host's browser owns the game; this just passes notes
 * between desks, over server-sent events one way and POST the other. No
 * WebSocket upgrade, so it survives every proxy we are likely to sit behind. */

const rooms = new Map();
const ROOM_IDLE_MS = 45 * 60 * 1000;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // no I, O, 0, 1

function newCode() {
  for (let tries = 0; tries < 50; tries++) {
    let c = '';
    for (let i = 0; i < 5; i++) c += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    if (!rooms.has(c)) return c;
  }
  return 'R' + Date.now().toString(36).slice(-4).toUpperCase();
}

const newId = () => 'p' + Math.random().toString(36).slice(2, 10);

function roster(room) {
  return {
    seats: room.seats,
    started: room.started,
    players: [...room.players.values()]
      .sort((a, b) => a.seat - b.seat)
      .map((p) => ({ id: p.id, name: p.name, seat: p.seat })),
  };
}

function sse(res, event, data) {
  if (!res || res.writableEnded) return;
  try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch { /* gone */ }
}

function pushRoster(room) {
  for (const p of room.players.values()) sse(p.res, 'roster', roster(room));
}

function touch(room) { room.at = Date.now(); }

function dropPlayer(room, playerId) {
  const p = room.players.get(playerId);
  if (!p) return;
  room.players.delete(playerId);
  try { p.res && p.res.end(); } catch { /* ignore */ }

  if (p.seat === 0) {
    // The host's tab held the room. Without it there is no game.
    for (const other of room.players.values()) {
      sse(other.res, 'closed', { reason: 'host left' });
      try { other.res && other.res.end(); } catch { /* ignore */ }
    }
    rooms.delete(room.code);
    return;
  }
  // Before kick-off, close the gap so seats stay 0..n-1.
  if (!room.started) {
    [...room.players.values()].sort((a, b) => a.seat - b.seat).forEach((q, i) => { q.seat = i; });
  }
  pushRoster(room);
}

setInterval(() => {
  const now = Date.now();
  for (const room of [...rooms.values()]) {
    if (now - room.at > ROOM_IDLE_MS) {
      for (const p of room.players.values()) { sse(p.res, 'closed', { reason: 'idle' }); try { p.res.end(); } catch { /* ignore */ } }
      rooms.delete(room.code);
    } else {
      for (const p of room.players.values()) sse(p.res, 'ping', { t: now });
    }
  }
}, 20000).unref?.();

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
    return send(res, 200, { ok: true, players: Object.keys(db.scores).length, rooms: rooms.size, relay: true, at: Date.now() });
  }

  /* ------------------------------------------------------------ rooms -- */

  if (route === '/room/create' && req.method === 'POST') {
    const b = await readBody(req).catch(() => null);
    if (!b) return send(res, 400, { error: 'bad body' });
    const name = clean(b.name) || 'Host';
    const seats = Math.max(2, Math.min(4, num(b.seats) || 2));
    const code = newCode();
    const id = newId();
    const room = { code, seats, started: false, at: Date.now(), players: new Map() };
    room.players.set(id, { id, name, seat: 0, res: null });
    rooms.set(code, room);
    return send(res, 200, { code, playerId: id, seat: 0, seats });
  }

  if (route === '/room/join' && req.method === 'POST') {
    const b = await readBody(req).catch(() => null);
    if (!b) return send(res, 400, { error: 'bad body' });
    const code = clean(b.code, 6).toUpperCase();
    const room = rooms.get(code);
    if (!room) return send(res, 404, { error: 'no-room' });
    if (room.started) return send(res, 409, { error: 'started' });
    if (room.players.size >= room.seats) return send(res, 409, { error: 'full' });
    const id = newId();
    const seat = room.players.size;
    room.players.set(id, { id, name: clean(b.name) || `Player ${seat + 1}`, seat, res: null });
    touch(room);
    pushRoster(room);
    return send(res, 200, { code, playerId: id, seat, seats: room.seats });
  }

  if (route === '/room/stream' && req.method === 'GET') {
    const code = clean(url.searchParams.get('code'), 6).toUpperCase();
    const playerId = clean(url.searchParams.get('playerId'), 20);
    const room = rooms.get(code);
    const me = room && room.players.get(playerId);
    if (!me) return send(res, 404, { error: 'no-room' });

    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      'connection': 'keep-alive',
      'x-accel-buffering': 'no',          // tell any proxy not to buffer us
      'access-control-allow-origin': '*',
    });
    res.write(': welcome\n\n');
    me.res = res;
    touch(room);
    sse(res, 'roster', roster(room));

    req.on('close', () => {
      if (room.players.get(playerId) === me && me.res === res) dropPlayer(room, playerId);
    });
    return undefined;
  }

  if (route === '/room/send' && req.method === 'POST') {
    const b = await readBody(req).catch(() => null);
    if (!b) return send(res, 400, { error: 'bad body' });
    const room = rooms.get(clean(b.code, 6).toUpperCase());
    const me = room && room.players.get(clean(b.playerId, 20));
    if (!me) return send(res, 404, { error: 'no-room' });
    touch(room);
    // The host declaring a board means seats are now fixed for the game.
    if (me.seat === 0 && b.msg && b.msg.t === 'state') room.started = true;
    const envelope = { from: me.id, seat: me.seat, msg: b.msg };
    for (const p of room.players.values()) {
      if (p.id === me.id) continue;
      if (b.to === 'host' && p.seat !== 0) continue;
      sse(p.res, 'msg', envelope);
    }
    return send(res, 200, { ok: true });
  }

  if (route === '/room/leave' && req.method === 'POST') {
    const b = await readBody(req).catch(() => null);
    const room = b && rooms.get(clean(b.code, 6).toUpperCase());
    if (room) dropPlayer(room, clean(b.playerId, 20));
    return send(res, 200, { ok: true });
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
      // Room traffic is chatty by nature; scoring is not.
      const budget = url.pathname.startsWith('/api/room') ? 900 : 90;
      if (rateLimited(ip, budget)) return send(res, 429, { error: 'slow down' });
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

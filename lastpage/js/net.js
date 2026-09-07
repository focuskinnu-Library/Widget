/* LAST PAGE — passing the notebook across the internet.
 *
 * Peer to peer over WebRTC (PeerJS). The host owns the game state; guests send
 * intents and receive the board back. No server of ours in the middle, so an
 * invite link works from any static host.
 */

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // no I, O, 0, 1
const PREFIX = 'lastpage-9x-';

export function makeCode(len = 5) {
  let s = '';
  for (let i = 0; i < len; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return s;
}

export const linkFor = (code) => {
  const u = new URL(location.href);
  u.hash = '';
  u.searchParams.set('join', code);
  return u.toString();
};

export const codeFromUrl = () => {
  const c = new URL(location.href).searchParams.get('join');
  return c ? c.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) : null;
};

export function clearUrlCode() {
  const u = new URL(location.href);
  u.searchParams.delete('join');
  history.replaceState({}, '', u.toString());
}

function peerReady() {
  return typeof window !== 'undefined' && typeof window.Peer === 'function';
}

const PEER_OPTS = { debug: 0 };

/* ------------------------------------------------------------ the host -- */

export class Host {
  constructor({ name, seats = 2, onEvent }) {
    this.name = name;
    this.seats = seats;
    this.onEvent = onEvent || (() => {});
    this.code = makeCode();
    this.peer = null;
    this.conns = [];
    this.players = [{ id: 'host', name, seat: 0, ready: true }];
    this.started = false;
    this.dead = false;
  }

  async open() {
    if (!peerReady()) throw new Error('offline');
    return new Promise((resolve, reject) => {
      let settled = false;
      const attempt = (code) => {
        this.code = code;
        const peer = new window.Peer(PREFIX + code, PEER_OPTS);
        this.peer = peer;
        peer.on('open', () => { settled = true; resolve(code); });
        peer.on('error', (err) => {
          if (!settled && String(err.type) === 'unavailable-id') {
            try { peer.destroy(); } catch { /* ignore */ }
            attempt(makeCode());
            return;
          }
          if (!settled) { settled = true; reject(err); }
          else this.onEvent({ t: 'error', message: String(err.type || err) });
        });
        peer.on('connection', (conn) => this._accept(conn));
        setTimeout(() => { if (!settled) { settled = true; reject(new Error('timeout')); } }, 12000);
      };
      attempt(this.code);
    });
  }

  _accept(conn) {
    if (this.players.length >= this.seats || this.started) {
      conn.on('open', () => { conn.send({ t: 'full' }); setTimeout(() => conn.close(), 300); });
      return;
    }
    conn.on('open', () => {
      this.conns.push(conn);
      conn.on('data', (msg) => this._onData(conn, msg));
      conn.on('close', () => this._drop(conn));
      conn.on('error', () => this._drop(conn));
    });
  }

  _onData(conn, msg) {
    if (!msg || typeof msg !== 'object') return;
    if (msg.t === 'hello') {
      const seat = this.players.length;
      conn.seat = seat;
      this.players.push({ id: conn.peer, name: String(msg.name || 'Guest').slice(0, 16), seat, ready: true });
      conn.send({ t: 'seated', seat, code: this.code });
      this.broadcastLobby();
      this.onEvent({ t: 'join', players: this.players });
      return;
    }
    if (msg.t === 'move') { this.onEvent({ t: 'move', seat: conn.seat, edge: msg.edge }); return; }
    if (msg.t === 'emoji') { this.relay({ t: 'emoji', seat: conn.seat, key: msg.key }); this.onEvent({ t: 'emoji', seat: conn.seat, key: msg.key }); return; }
    if (msg.t === 'rematch') { this.onEvent({ t: 'rematch', seat: conn.seat }); return; }
    if (msg.t === 'bye') this._drop(conn);
  }

  _drop(conn) {
    const i = this.conns.indexOf(conn);
    if (i >= 0) this.conns.splice(i, 1);
    const p = this.players.findIndex((x) => x.id === conn.peer);
    if (p >= 0) {
      const gone = this.players[p];
      this.players.splice(p, 1);
      this.players.forEach((x, k) => { x.seat = k; });
      this.conns.forEach((c) => { const q = this.players.find((x) => x.id === c.peer); c.seat = q ? q.seat : c.seat; });
      this.broadcastLobby();
      this.onEvent({ t: 'leave', who: gone, players: this.players });
    }
  }

  broadcastLobby() {
    this.relay({ t: 'lobby', players: this.players, seats: this.seats });
  }

  relay(msg) {
    for (const c of this.conns) { try { c.send(msg); } catch { /* ignore */ } }
  }

  sendState(state, names, meta = {}) {
    this.started = true;
    this.relay({ t: 'state', state, names, ...meta });
  }

  close() {
    this.dead = true;
    this.relay({ t: 'closed' });
    setTimeout(() => { try { this.peer && this.peer.destroy(); } catch { /* ignore */ } }, 200);
  }
}

/* ----------------------------------------------------------- the guest -- */

export class Guest {
  constructor({ name, code, onEvent }) {
    this.name = name;
    this.code = code.toUpperCase();
    this.onEvent = onEvent || (() => {});
    this.peer = null;
    this.conn = null;
    this.seat = -1;
  }

  async open() {
    if (!peerReady()) throw new Error('offline');
    return new Promise((resolve, reject) => {
      let settled = false;
      const peer = new window.Peer(undefined, PEER_OPTS);
      this.peer = peer;
      peer.on('open', () => {
        const conn = peer.connect(PREFIX + this.code, { reliable: true });
        this.conn = conn;
        conn.on('open', () => {
          conn.send({ t: 'hello', name: this.name });
          settled = true;
          resolve(true);
        });
        conn.on('data', (msg) => {
          if (msg && msg.t === 'seated') this.seat = msg.seat;
          this.onEvent(msg);
        });
        conn.on('close', () => this.onEvent({ t: 'closed' }));
        conn.on('error', (e) => {
          if (!settled) { settled = true; reject(e); } else this.onEvent({ t: 'error', message: String(e) });
        });
      });
      peer.on('error', (err) => {
        if (!settled) {
          settled = true;
          reject(new Error(String(err.type) === 'peer-unavailable' ? 'no-room' : String(err.type || err)));
        }
      });
      setTimeout(() => { if (!settled) { settled = true; reject(new Error('timeout')); } }, 14000);
    });
  }

  send(msg) { try { this.conn && this.conn.send(msg); } catch { /* ignore */ } }
  close() {
    this.send({ t: 'bye' });
    setTimeout(() => { try { this.peer && this.peer.destroy(); } catch { /* ignore */ } }, 200);
  }
}

export const available = peerReady;

/* ====================================================== the relay ======= */
/* Same two roles, same messages, but carried by our own server instead of a
 * public broker: server-sent events downstream, POST upstream. This is the
 * preferred transport whenever an API is reachable, because it depends on
 * nothing we do not ship ourselves. */

const apiBase = () =>
  (typeof window !== 'undefined' && window.LASTPAGE_API) ||
  (location.protocol.startsWith('http') ? '/api' : null);

async function apiCall(path, body, ms = 8000) {
  const root = apiBase();
  if (!root) throw new Error('offline');
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(root + path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctl.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'http ' + res.status);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

/** Is our own relay reachable? Decides which transport the app offers. */
export async function relayAvailable() {
  const root = apiBase();
  if (!root || typeof EventSource !== 'function') return false;
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 3500);
    const res = await fetch(root + '/health', { signal: ctl.signal });
    clearTimeout(timer);
    if (!res.ok) return false;
    const j = await res.json();
    return !!j.relay;
  } catch {
    return false;
  }
}

/** Shared plumbing: hold the event stream open and hand messages up. */
class RelayLink {
  constructor(onEvent) {
    this.onEvent = onEvent || (() => {});
    this.code = null;
    this.playerId = null;
    this.seat = -1;
    this.players = [];
    this.seats = 2;
    this.es = null;
    this.dead = false;
  }

  listen() {
    const root = apiBase();
    const es = new EventSource(`${root}/room/stream?code=${encodeURIComponent(this.code)}&playerId=${encodeURIComponent(this.playerId)}`);
    this.es = es;
    es.addEventListener('roster', (ev) => {
      const d = JSON.parse(ev.data);
      this.players = d.players;
      this.seats = d.seats;
      const me = d.players.find((p) => p.id === this.playerId);
      if (me) this.seat = me.seat;
      this.onRoster(d);
    });
    es.addEventListener('msg', (ev) => {
      const d = JSON.parse(ev.data);
      this.onMessage(d);
    });
    es.addEventListener('closed', () => { this.dead = true; this.onEvent({ t: 'closed' }); this.stop(); });
    es.onerror = () => {
      // EventSource retries by itself; only shout if the room is really gone.
      if (this.es && this.es.readyState === 2 && !this.dead) {
        this.dead = true;
        this.onEvent({ t: 'closed' });
      }
    };
    return new Promise((resolve) => {
      const ready = () => resolve(true);
      es.addEventListener('roster', ready, { once: true });
      setTimeout(ready, 4000);
    });
  }

  post(msg, to = 'all') {
    if (this.dead) return;
    apiCall('/room/send', { code: this.code, playerId: this.playerId, to, msg }).catch(() => {});
  }

  stop() {
    try { this.es && this.es.close(); } catch { /* ignore */ }
    this.es = null;
  }

  bye() {
    this.dead = true;
    const root = apiBase();
    const body = JSON.stringify({ code: this.code, playerId: this.playerId });
    // sendBeacon survives the tab closing; fetch is the fallback.
    if (navigator.sendBeacon) navigator.sendBeacon(root + '/room/leave', new Blob([body], { type: 'application/json' }));
    else apiCall('/room/leave', { code: this.code, playerId: this.playerId }).catch(() => {});
    this.stop();
  }

  onRoster() {}
  onMessage() {}
}

export class RelayHost extends RelayLink {
  constructor({ name, seats = 2, onEvent }) {
    super(onEvent);
    this.name = name;
    this.wantSeats = seats;
    this.started = false;
  }

  async open() {
    const r = await apiCall('/room/create', { name: this.name, seats: this.wantSeats });
    this.code = r.code;
    this.playerId = r.playerId;
    this.seat = 0;
    this.seats = r.seats;
    this.players = [{ id: r.playerId, name: this.name, seat: 0 }];
    await this.listen();
    return this.code;
  }

  onRoster(d) {
    const before = this.knownCount ?? 1;
    this.knownCount = d.players.length;
    if (d.players.length > before) this.onEvent({ t: 'join', players: d.players });
    else if (d.players.length < before) this.onEvent({ t: 'leave', who: { name: 'someone', seat: -1 }, players: d.players });
    else this.onEvent({ t: 'roster', players: d.players });
  }

  onMessage({ seat, msg }) {
    if (!msg) return;
    if (msg.t === 'move') this.onEvent({ t: 'move', seat, edge: msg.edge });
    else if (msg.t === 'emoji') { this.post({ t: 'emoji', seat, key: msg.key }); this.onEvent({ t: 'emoji', seat, key: msg.key }); }
    else if (msg.t === 'rematch') this.onEvent({ t: 'rematch', seat });
  }

  broadcastLobby() { /* the server owns the roster */ }
  relay(msg) { this.post(msg); }

  sendState(state, names, meta = {}) {
    this.started = true;
    this.post({ t: 'state', state, names, ...meta });
  }

  close() { this.bye(); }
}

export class RelayGuest extends RelayLink {
  constructor({ name, code, onEvent }) {
    super(onEvent);
    this.name = name;
    this.code = code.toUpperCase();
  }

  async open() {
    const r = await apiCall('/room/join', { code: this.code, name: this.name });
    this.playerId = r.playerId;
    this.seat = r.seat;
    this.seats = r.seats;
    await this.listen();
    return true;
  }

  onRoster(d) { this.onEvent({ t: 'lobby', players: d.players, seats: d.seats }); }
  onMessage({ msg }) { if (msg) this.onEvent(msg); }

  send(msg) { this.post(msg, 'host'); }
  close() { this.bye(); }
}


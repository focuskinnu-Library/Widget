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

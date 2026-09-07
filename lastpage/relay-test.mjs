/* Relay test — two players, one room, a real game over the wire.
 * Needs the server running:  node lastpage/server/server.mjs
 * Run:                        node lastpage/relay-test.mjs
 */
import http from 'node:http';
import { Game } from './js/engine.js';

const BASE = process.env.BASE || 'http://localhost:3000';
let pass = 0, fail = 0;
const ok = (n, c, d = '') => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${d ? '  · ' + d : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function post(path, body) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

/** A minimal server-sent-events client, since node has no EventSource. */
function stream(code, playerId, onEvent) {
  return new Promise((resolve) => {
    const url = new URL(`${BASE}/api/room/stream?code=${code}&playerId=${playerId}`);
    const req = http.get(url, (res) => {
      let buf = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        buf += chunk;
        let i;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const block = buf.slice(0, i);
          buf = buf.slice(i + 2);
          let event = 'message', data = '';
          for (const line of block.split('\n')) {
            if (line.startsWith('event: ')) event = line.slice(7).trim();
            else if (line.startsWith('data: ')) data += line.slice(6);
          }
          if (data) { try { onEvent(event, JSON.parse(data)); } catch { /* ignore */ } }
        }
      });
      resolve({ close: () => req.destroy() });
    });
    req.on('error', () => resolve({ close: () => {} }));
  });
}

console.log('── THE ROOM ──');
const health = await fetch(BASE + '/api/health').then((r) => r.json()).catch(() => null);
if (!health) { console.log('FAIL  server is not running at ' + BASE); process.exit(1); }
ok('server advertises the relay', health.relay === true);

const create = await post('/api/room/create', { name: 'Kinnu', seats: 2 });
ok('host opens a room', create.status === 200 && !!create.data.code, create.data.code);
const code = create.data.code;
ok('code is easy to read out loud', /^[A-HJ-NP-Z2-9]{5}$/.test(code), code);
ok('host takes seat zero', create.data.seat === 0);

const hostMsgs = [], guestMsgs = [];
let hostRoster = null, guestRoster = null;
const hostES = await stream(code, create.data.playerId, (e, d) => {
  if (e === 'roster') hostRoster = d;
  if (e === 'msg') hostMsgs.push(d);
});
await sleep(200);
ok('host gets a roster straight away', !!hostRoster && hostRoster.players.length === 1);

console.log('\n── A FRIEND OPENS THE LINK ──');
const bad = await post('/api/room/join', { code: 'ZZZZZ', name: 'Nobody' });
ok('a wrong code is refused clearly', bad.status === 404 && bad.data.error === 'no-room');

const join = await post('/api/room/join', { code, name: 'Golu' });
ok('the friend gets in', join.status === 200);
ok('and is given seat one', join.data.seat === 1);
const guestES = await stream(code, join.data.playerId, (e, d) => {
  if (e === 'roster') guestRoster = d;
  if (e === 'msg') guestMsgs.push(d);
});
await sleep(300);
ok('the host is told somebody joined', hostRoster.players.length === 2);
ok('both see the same desk', guestRoster.players.length === 2);
ok('names carried across', hostRoster.players.map((p) => p.name).join(',') === 'Kinnu,Golu');

const third = await post('/api/room/join', { code, name: 'Gatecrasher' });
ok('a full room turns people away', third.status === 409 && third.data.error === 'full');

console.log('\n── PLAYING THROUGH THE WIRE ──');
const game = new Game(4, 4, 2);
const names = ['Kinnu', 'Golu'];
await post('/api/room/send', { code, playerId: create.data.playerId, msg: { t: 'state', state: game.toJSON(), names } });
await sleep(250);
ok('the guest receives the board', guestMsgs.length === 1 && guestMsgs[0].msg.t === 'state');
ok('with both names on it', guestMsgs[0].msg.names.join(',') === 'Kinnu,Golu');

const started = await post('/api/room/join', { code, name: 'Late' });
ok('nobody can join once it has started', started.status === 409 && started.data.error === 'started');

// guest asks for a line, host applies it and sends the board back
let moves = 0;
for (let n = 0; n < 6 && !game.isOver(); n++) {
  const mover = game.turn;
  const edge = game.availableEdges()[0];
  if (mover === 1) {
    await post('/api/room/send', { code, playerId: join.data.playerId, to: 'host', msg: { t: 'move', edge } });
    await sleep(160);
    const got = hostMsgs.filter((m) => m.msg.t === 'move').pop();
    if (!got || got.msg.edge !== edge) { ok('guest move reached the host', false); break; }
    if (got.seat !== 1) { ok('host knows which seat moved', false); break; }
  }
  game.play(edge);
  moves++;
  await post('/api/room/send', { code, playerId: create.data.playerId, msg: { t: 'state', state: game.toJSON(), names, last: { edge, boxes: [], player: mover } } });
  await sleep(140);
}
ok('moves flow both ways', moves === 6);
const lastState = guestMsgs.filter((m) => m.msg.t === 'state').pop();
ok('the guest ends on the current board', lastState.msg.state.moves.length === game.moves.length,
   `${lastState.msg.state.moves.length} of ${game.moves.length}`);

console.log('\n── EMOJI AND REMATCH ──');
await post('/api/room/send', { code, playerId: join.data.playerId, to: 'host', msg: { t: 'emoji', key: '🔥' } });
await sleep(160);
ok('the host sees the emoji', hostMsgs.some((m) => m.msg.t === 'emoji' && m.msg.key === '🔥'));
await post('/api/room/send', { code, playerId: join.data.playerId, to: 'host', msg: { t: 'rematch' } });
await sleep(160);
ok('and a rematch request', hostMsgs.some((m) => m.msg.t === 'rematch'));

console.log('\n── LEAVING ──');
let guestClosed = false;
const gES2 = guestES;
// when the host walks out, the room goes with them
await post('/api/room/leave', { code, playerId: create.data.playerId });
await sleep(300);
const after = await post('/api/room/join', { code, name: 'Anyone' });
ok('the room dies with the host', after.status === 404);

hostES.close(); gES2.close();
await sleep(100);
const h2 = await fetch(BASE + '/api/health').then((r) => r.json());
ok('no rooms left behind', h2.rooms === 0, `${h2.rooms} open`);

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);

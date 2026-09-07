/* LAST PAGE — the app.
 * Screens, flow, and the four ways to play: the ladder, the daily page,
 * pass-and-play, and a link to a friend.
 */

import { Game } from './engine.js';
import { chooseMove, thinkingTime, makeRng, LEVELS } from './ai.js';
import { Board, paletteFor } from './render.js';
import * as store from './store.js';
import * as lb from './leaderboard.js';
import * as snd from './sound.js';
import * as net from './net.js';
import {
  RIVALS, ROWS, BOARDS, BADGES, CROWD, rivalById,
  rankFor, nextRank, inkFor, starsFor, SCHOOL,
} from './universe.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const rand = (a) => a[Math.floor(Math.random() * a.length)];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const app = {
  screen: 'name',
  game: null,
  board: null,
  seats: [],          // { type: 'you'|'bot'|'local'|'remote', name, level }
  youSeat: 0,
  mode: 'quick',
  level: 'mild',
  rival: null,
  size: 'medium',
  first: 'you',
  busy: false,
  over: false,
  rng: Math.random,
  net: null,          // { role:'host'|'guest', host?, guest?, code }
  lobbySeats: 2,
  history: [],
  dailySeed: 0,
};

/* ==========================================================  screens  == */

function show(id, push = true) {
  $$('.screen').forEach((s) => s.classList.toggle('on', s.id === `screen-${id}`));
  if (push && app.screen !== id) app.history.push(app.screen);
  app.screen = id;
  window.scrollTo(0, 0);
}

function back() {
  const prev = app.history.pop() || 'home';
  show(prev, false);
  if (prev === 'home') renderHome();
  if (prev === 'ladder') renderLadder();
}

function openModal(html) {
  $('#modalPanel').innerHTML = html;
  $('#modal').classList.add('on');
}
function closeModal() { $('#modal').classList.remove('on'); }
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });

/* ==========================================================    boot   == */

function boot() {
  const p = store.load();
  document.body.dataset.skin = p.skin || 'paper';
  applyThemeColor();

  app.board = new Board($('#board'), { skin: p.skin, motion: p.motion });
  app.board.onPlay = (edge) => humanPlay(edge);
  snd.setEnabled(p.sound !== false);

  store.markDay();
  wireChrome();

  const joinCode = net.codeFromUrl();
  if (!p.name) {
    show('name', false);
    $('#nameInput').value = '';
    if (joinCode) $('#nameGo').textContent = 'Join the game';
  } else {
    show('home', false);
    renderHome();
    if (joinCode) setTimeout(() => openOnline(joinCode), 300);
  }

  lb.probe().then(() => { if (app.screen === 'board') renderBoardScreen(); });
  window.addEventListener('resize', () => app.board && app.board.resize());
}

function applyThemeColor() {
  const skin = document.body.dataset.skin;
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.content = skin === 'neon' ? '#06070d' : '#cfc7b4';
}

function wireChrome() {
  $('#nameGo').addEventListener('click', submitName);
  $('#nameInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') submitName(); });

  $$('[data-back]').forEach((b) => b.addEventListener('click', () => { snd.tap(); back(); }));
  $$('[data-go]').forEach((b) => b.addEventListener('click', () => { snd.tap(); go(b.dataset.go); }));

  $('#skinBtn').addEventListener('click', toggleSkin);
  $('#lbBtn').addEventListener('click', () => { snd.tap(); show('board'); renderBoardScreen(); });
  $('#avatarBtn').addEventListener('click', openReportCard);
  $('#howBtn').addEventListener('click', openHow);
  $('#lbRefresh').addEventListener('click', () => renderBoardScreen(true));
  $('#pauseBtn').addEventListener('click', openPause);
  $('#mResume').addEventListener('click', resumeSaved);

  $$('#lbTabs button').forEach((b) => b.addEventListener('click', () => {
    $$('#lbTabs button').forEach((x) => x.classList.toggle('on', x === b));
    renderBoardScreen();
  }));

  $$('#emojiBar button').forEach((b) => b.addEventListener('click', () => sendEmoji(b.dataset.emoji)));

  document.addEventListener('pointerdown', () => snd.unlock(), { once: true });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if ($('#modal').classList.contains('on')) closeModal();
      else if (app.screen === 'game') openPause();
    }
  });
}

function submitName() {
  const v = $('#nameInput').value.trim();
  if (!v) { $('#nameInput').focus(); return; }
  store.setName(v);
  snd.tap();
  const joinCode = net.codeFromUrl();
  show('home', false);
  renderHome();
  if (joinCode) setTimeout(() => openOnline(joinCode), 200);
}

function toggleSkin() {
  const next = document.body.dataset.skin === 'paper' ? 'neon' : 'paper';
  document.body.dataset.skin = next;
  store.setSkin(next);
  applyThemeColor();
  app.board.setSkin(next);
  if (app.screen === 'game') renderScoreStrip();
  snd.tap();
  flashToast(next === 'neon' ? 'lights off' : 'back to paper');
}

function go(where) {
  if (where === 'ladder') { show('ladder'); renderLadder(); }
  else if (where === 'quick') openSetup('quick');
  else if (where === 'pass') openSetup('pass');
  else if (where === 'online') openOnline(null);
  else if (where === 'daily') startDaily();
}

/* ==========================================================    home   == */

function renderHome() {
  const p = store.load();
  $('#homeName').textContent = p.name || 'you';
  const rk = rankFor(p.ink);
  $('#homeRank').textContent = `${rk.name} · ${p.ink.toLocaleString()} ink`;
  $('#avatarGlyph').textContent = rk.glyph;

  const beaten = store.ladderProgress();
  $('#ladderDesc').textContent = beaten >= RIVALS.length
    ? 'All twelve beaten. The Golden Nib is yours.'
    : `${beaten} of ${RIVALS.length} benches beaten · next up ${rivalById(store.nextRivalId(RIVALS))?.name || ''}`;

  const dk = store.today();
  const done = store.dailyDone(dk);
  $('#dailyTag').style.display = done ? 'none' : '';
  $('#dailyDesc').textContent = done
    ? `Done today · ${p.daily[dk].margin > 0 ? 'won' : 'lost'} by ${Math.abs(p.daily[dk].margin)}. Come back tomorrow.`
    : 'The same board for the whole world today.';

  const stats = [
    ['played', p.played], ['won', p.won],
    ['streak', p.streak], ['best chain', p.bestCombo],
    ['stars', store.totalStars()], ['days', store.attendance()],
  ];
  $('#homeStats').innerHTML = stats
    .map(([k, v]) => `<div class="stat"><div class="v">${v}</div><div class="k">${k}</div></div>`).join('');

  const r = store.loadResume();
  const btn = $('#mResume');
  if (r && r.state) {
    btn.style.display = '';
    $('#resumeDesc').textContent = `${r.label} · ${r.state.scores.join(' – ')}`;
  } else btn.style.display = 'none';
}

/* ==========================================================   ladder  == */

function renderLadder() {
  const p = store.load();
  const beaten = store.ladderProgress();
  $('#ladderProg').textContent = `${beaten}/${RIVALS.length} beaten · ${store.totalStars()} stars`;

  $('#prizeShelf').innerHTML = RIVALS.map((r) => {
    const got = p.prizes.includes(r.prize.id);
    return `<div class="prize ${got ? '' : 'locked'}" title="${esc(r.prize.name)}">
      <div class="g">${r.prize.glyph}</div><div class="n">${got ? esc(r.prize.name) : '???'}</div></div>`;
  }).join('');

  let html = '';
  for (const row of ROWS) {
    const list = RIVALS.filter((r) => r.row === row.id);
    if (!list.length) continue;
    html += `<div class="rowhead"><div class="n">${esc(row.name)}</div><div class="note">${esc(row.note)}</div></div>`;
    for (const r of list) {
      const rec = p.ladder[r.id] || {};
      const unlocked = store.isUnlocked(r.id, RIVALS);
      const stars = '★'.repeat(rec.stars || 0) + '☆'.repeat(3 - (rec.stars || 0));
      const b = BOARDS[r.board];
      html += `<button class="rival ${unlocked ? '' : 'locked'} ${rec.beaten ? 'beaten' : ''}" data-rival="${r.id}">
        <span class="no">${unlocked ? r.id : '🔒'}</span>
        <span><span class="nm">${esc(r.name)}</span><span class="ds">${esc(r.desc)}</span></span>
        <span class="rt"><span class="stars">${stars}</span><br>${LEVELS[r.level].label} · ${b.label}</span>
      </button>`;
    }
  }
  $('#ladderList').innerHTML = html;
  $$('#ladderList .rival').forEach((el) => el.addEventListener('click', () => {
    snd.tap();
    startLadder(Number(el.dataset.rival));
  }));
}

/* ==========================================================   setup   == */

function openSetup(mode) {
  app.mode = mode;
  show('setup');
  $('#setupTitle').textContent = mode === 'pass' ? 'Pass & Play' : 'Quick Match';
  $('#setupBench').style.display = mode === 'pass' ? 'none' : '';
  $('#setupPlayers').style.display = mode === 'pass' ? '' : 'none';
  $('#setupFirst').style.display = mode === 'pass' ? 'none' : '';
  updateLevelNote();
  renderNameFields();

  $$('#levelSeg button').forEach((b) => b.onclick = () => {
    $$('#levelSeg button').forEach((x) => x.classList.toggle('on', x === b));
    app.level = b.dataset.level;
    updateLevelNote();
    snd.tap();
  });
  $$('#sizeSeg button').forEach((b) => b.onclick = () => {
    $$('#sizeSeg button').forEach((x) => x.classList.toggle('on', x === b));
    app.size = b.dataset.size;
    snd.tap();
  });
  $$('#firstSeg button').forEach((b) => b.onclick = () => {
    $$('#firstSeg button').forEach((x) => x.classList.toggle('on', x === b));
    app.first = b.dataset.first;
    snd.tap();
  });
  $$('#countSeg button').forEach((b) => b.onclick = () => {
    $$('#countSeg button').forEach((x) => x.classList.toggle('on', x === b));
    renderNameFields();
    snd.tap();
  });
  $('#setupGo').onclick = () => (mode === 'pass' ? startPass() : startQuick());
}

function updateLevelNote() {
  const notes = {
    easy: 'Recess — grabs whatever is going. Beatable on a bad day.',
    mild: 'Unit Test — never hands you a box, but loses the chain fight.',
    tough: 'Board Exam — counts chains, plays the double-cross, finishes perfectly. It will punish one loose line.',
  };
  $('#levelNote').textContent = notes[app.level];
}

function playerCount() {
  return Number($$('#countSeg button').find((b) => b.classList.contains('on'))?.dataset.count || 2);
}

function renderNameFields() {
  const n = playerCount();
  const p = store.load();
  const prev = $$('#nameFields input').map((i) => i.value);
  $('#nameFields').innerHTML = Array.from({ length: n }, (_, i) =>
    `<input type="text" maxlength="12" data-pi="${i}" placeholder="player ${i + 1}"
      value="${esc(prev[i] || (i === 0 ? p.name : ''))}">`).join('');
}

/* ==========================================================   start   == */

function seatsFor(config) { return config; }

function startLadder(rivalId) {
  const r = rivalById(rivalId);
  const b = BOARDS[r.board];
  app.mode = 'ladder';
  app.rival = r;
  app.level = r.level;
  const you = store.load().name || 'You';
  begin({
    rows: b.rows, cols: b.cols,
    seats: [
      { type: 'you', name: you },
      { type: 'bot', name: r.name, level: r.level, slip: r.slip },
    ],
    youSeat: 0,
    firstSeat: Math.random() < 0.5 ? 0 : 1,
    label: `Bench ${r.id} · ${r.name}`,
  });
  setTimeout(() => sayTaunt(rand(r.taunt)), 900);
}

function startQuick() {
  const b = BOARDS[app.size];
  app.mode = 'quick';
  app.rival = null;
  const you = store.load().name || 'You';
  const firstSeat = app.first === 'you' ? 0 : app.first === 'them' ? 1 : (Math.random() < 0.5 ? 0 : 1);
  begin({
    rows: b.rows, cols: b.cols,
    seats: [
      { type: 'you', name: you },
      { type: 'bot', name: LEVELS[app.level].label, level: app.level, slip: 0 },
    ],
    youSeat: 0,
    firstSeat,
    label: `Quick · ${LEVELS[app.level].label}`,
  });
  if (app.first === 'toss') flashToast(firstSeat === 0 ? 'toss: you start' : 'toss: they start');
}

function startPass() {
  const b = BOARDS[app.size];
  app.mode = 'pass';
  app.rival = null;
  const inputs = $$('#nameFields input');
  const seats = inputs.map((el, i) => ({
    type: 'local',
    name: (el.value.trim() || `Player ${i + 1}`).slice(0, 12),
  }));
  begin({
    rows: b.rows, cols: b.cols,
    seats,
    youSeat: -1,
    firstSeat: 0,
    label: `Pass & Play · ${seats.length}`,
  });
}

function startDaily() {
  const key = store.today();
  const seed = Array.from(key).reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  app.dailySeed = seed;
  app.mode = 'daily';
  app.rival = null;
  app.level = 'tough';
  app.rng = makeRng(seed);
  const sizes = ['medium', 'wide', 'big'];
  const b = BOARDS[sizes[seed % sizes.length]];
  const you = store.load().name || 'You';
  begin({
    rows: b.rows, cols: b.cols,
    seats: [
      { type: 'you', name: you },
      { type: 'bot', name: 'The Daily Page', level: 'tough', slip: 0 },
    ],
    youSeat: 0,
    firstSeat: seed % 2,
    label: `Daily Page · ${key}`,
    noResume: true,
  });
  flashToast('same board for everyone today');
}

function begin(cfg) {
  app.seats = cfg.seats;
  app.youSeat = cfg.youSeat;
  app.over = false;
  app.busy = false;
  app.label = cfg.label;
  app.noResume = !!cfg.noResume;
  if (app.mode !== 'daily') app.rng = Math.random;

  const g = new Game(cfg.rows, cfg.cols, cfg.seats.length);
  g.turn = cfg.firstSeat || 0;
  app.game = g;

  app.board.setGame(g);
  app.board.initials = cfg.seats.map((s) => (s.name || '?').trim()[0].toUpperCase());
  app.board.setMotion(store.load().motion !== false);
  app.board.locked = false;

  show('game');
  $('#emojiBar').style.display = app.net ? '' : 'none';
  hideTaunt();
  renderScoreStrip();
  renderTurn();
  requestAnimationFrame(() => app.board.resize());
  maybeBot();
}

/* ==========================================================    play   == */

function currentSeat() { return app.seats[app.game.turn]; }

function isMyTurn() {
  if (app.over || app.busy) return false;
  const s = currentSeat();
  if (!s) return false;
  if (app.net) return app.game.turn === app.youSeat;
  return s.type === 'you' || s.type === 'local';
}

function humanPlay(edge) {
  if (!isMyTurn()) return;
  if (app.net && app.net.role === 'guest') {
    app.net.guest.send({ t: 'move', edge });
    app.board.locked = true;
    return;
  }
  applyMove(edge);
}

function applyMove(edge) {
  const g = app.game;
  if (!g || g.edges[edge]) return;
  const before = g.turn;
  const res = g.play(edge);
  if (!res.ok) return;

  app.board.commit(edge, res.boxes, before);
  if (res.boxes.length) {
    res.boxes.forEach((_, i) => setTimeout(() => snd.pop(res.combo - res.boxes.length + i), i * 70));
    if (res.combo >= 3) showCombo(`×${res.combo}`);
    if (res.combo >= 5) { snd.murmur(); flashToast(rand(CROWD.combo)); }
  } else {
    snd.scratch();
    const dcs = g.doubleCrosses.reduce((a, b) => a + b, 0);
    if (dcs > (app.lastDcs || 0)) {
      app.lastDcs = dcs;
      snd.clever();
      flashToast(rand(CROWD.doubleCross));
    }
  }

  renderScoreStrip();
  renderTurn();
  saveResumeState();
  broadcast({ edge, boxes: res.boxes, player: before });

  if (g.isOver()) { setTimeout(finish, 620); return; }
  maybeBot();
}

function maybeBot() {
  const s = currentSeat();
  if (!s || s.type !== 'bot' || app.over) { app.board.locked = false; return; }
  app.busy = true;
  app.board.locked = true;
  renderTurn();
  const level = slipLevel(s);
  const delay = thinkingTime(level);
  setTimeout(() => {
    if (app.over || !app.game) return;
    const edge = chooseMove(app.game, level, app.rng);
    app.busy = false;
    applyMove(edge);
    if (!app.over) app.board.locked = currentSeat()?.type === 'bot';
  }, delay);
}

/** A rival with `slip` occasionally plays a rung below itself — that is what
 *  makes bench 1 feel like a classmate and bench 12 feel like a wall. */
function slipLevel(seat) {
  const order = ['easy', 'mild', 'tough'];
  if (!seat.slip || Math.random() > seat.slip) return seat.level;
  const i = order.indexOf(seat.level);
  return order[Math.max(0, i - 1)];
}

/* ==========================================================     hud   == */

function renderScoreStrip() {
  const pal = paletteFor(document.body.dataset.skin);
  const g = app.game;
  $('#scoreStrip').innerHTML = app.seats.map((s, i) => `
    <div class="pscore ${g.turn === i ? 'active' : ''}" style="--pc:${pal.players[i % 4]}">
      <div class="nm"><b>${esc((s.name || '?')[0].toUpperCase())}</b> ${esc(s.name)}${s.type === 'bot' ? ' 🤖' : ''}</div>
      <div class="v">${g.scores[i]}</div>
    </div>`).join('');
}

function renderTurn() {
  const g = app.game;
  const pal = paletteFor(document.body.dataset.skin);
  const s = currentSeat();
  $('#turnDot').style.setProperty('--pc', pal.players[g.turn % 4]);
  let txt;
  if (app.over) txt = 'game over';
  else if (s.type === 'bot') txt = `${s.name} is thinking…`;
  else if (app.net) txt = g.turn === app.youSeat ? 'your turn' : `${s.name}'s turn`;
  else if (s.type === 'local') txt = `${s.name}, your line`;
  else txt = 'your turn';
  if (g.combo > 0 && !app.over) txt += ` · chain ×${g.combo}`;
  $('#turnText').textContent = txt;
  $('#boxesLeft').textContent = `${g.boxesLeft()} left`;
}

let toastTimer = null;
function flashToast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1600);
}

function showCombo(txt) {
  const el = $('#comboFx');
  el.textContent = txt;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
}

let tauntTimer = null;
function sayTaunt(msg) {
  const el = $('#taunt');
  el.textContent = `“${msg}”`;
  el.classList.add('show');
  clearTimeout(tauntTimer);
  tauntTimer = setTimeout(() => el.classList.remove('show'), 3400);
}
function hideTaunt() { $('#taunt').classList.remove('show'); }

/* ==========================================================   pause   == */

function openPause() {
  snd.tap();
  const p = store.load();
  openModal(`
    <h2 style="margin-bottom:4px">Paused</h2>
    <p class="muted small" style="margin-bottom:16px">${esc(app.label || '')}</p>
    <div class="stack">
      <button class="btn primary" data-act="resume">Back to the page</button>
      <div class="row">
        <button class="btn ghost" data-act="sound">${p.sound !== false ? 'Sound on' : 'Sound off'}</button>
        <button class="btn ghost" data-act="skin">${document.body.dataset.skin === 'paper' ? 'Old school' : 'Trendy'}</button>
      </div>
      <button class="btn ghost" data-act="restart">Start this game again</button>
      <button class="btn ghost" data-act="quit" style="color:var(--bad)">Leave the game</button>
    </div>
    <p class="tiny muted" style="margin-top:12px;text-align:center">
      Leaving a solo game keeps it on the shelf — you can pick it up from the front page.
    </p>`);
  $$('#modalPanel [data-act]').forEach((b) => b.addEventListener('click', () => {
    const a = b.dataset.act;
    if (a === 'resume') closeModal();
    if (a === 'sound') { store.update((s) => { s.sound = !(s.sound !== false); }); snd.setEnabled(store.load().sound !== false); openPause(); }
    if (a === 'skin') { toggleSkin(); openPause(); }
    if (a === 'restart') { closeModal(); restart(); }
    if (a === 'quit') { closeModal(); quitGame(); }
  }));
}

function restart() {
  const g = app.game;
  begin({
    rows: g.R, cols: g.C,
    seats: app.seats,
    youSeat: app.youSeat,
    firstSeat: Math.random() < 0.5 ? 0 : (app.seats.length > 1 ? 1 : 0),
    label: app.label,
    noResume: app.noResume,
  });
}

function quitGame() {
  app.over = true;
  app.board.locked = true;
  if (app.net) leaveOnline();
  if (app.noResume) store.clearResume();
  app.history = [];
  show('home', false);
  renderHome();
}

function saveResumeState() {
  if (app.net || app.noResume || app.over) return;
  store.saveResume({
    label: app.label,
    mode: app.mode,
    seats: app.seats,
    youSeat: app.youSeat,
    rivalId: app.rival?.id || null,
    state: app.game.toJSON(),
  });
}

function resumeSaved() {
  const r = store.loadResume();
  if (!r) return;
  snd.tap();
  app.mode = r.mode;
  app.seats = r.seats;
  app.youSeat = r.youSeat;
  app.rival = r.rivalId ? rivalById(r.rivalId) : null;
  app.level = app.rival?.level || app.level;
  app.label = r.label;
  app.over = false;
  app.busy = false;
  app.noResume = false;
  app.rng = Math.random;

  const g = Game.from(r.state);
  app.game = g;
  app.board.setGame(g);
  app.board.initials = app.seats.map((s) => (s.name || '?').trim()[0].toUpperCase());
  app.board.locked = false;
  show('game');
  $('#emojiBar').style.display = 'none';
  renderScoreStrip();
  renderTurn();
  requestAnimationFrame(() => app.board.resize());
  maybeBot();
}

/* ==========================================================  finish   == */

function finish() {
  if (app.over) return;
  app.over = true;
  app.board.locked = true;
  store.clearResume();

  const g = app.game;
  const seconds = Math.round((Date.now() - g.startedAt) / 1000);
  const { index: winner, tie } = g.leader();

  let mine = app.youSeat >= 0 ? app.youSeat : winner;
  const myScore = g.scores[mine];
  const best = Math.max(...g.scores.filter((_, i) => i !== mine));
  const margin = myScore - best;
  const won = app.youSeat >= 0 ? (!tie && winner === mine) : false;
  const drawn = tie;

  snd.bell(won || app.youSeat < 0);

  let ink = 0, stars = 0, newBadges = [];
  if (app.youSeat >= 0) {
    ink = inkFor({
      won, margin, level: app.level, boxes: g.totalBoxes(),
      bestCombo: g.bestCombo[mine], doubleCrosses: g.doubleCrosses[mine], seconds,
      opponent: app.net ? 'online' : app.mode === 'daily' ? 'daily' : 'bot',
    });
    stars = starsFor(margin, g.totalBoxes(), best);
    newBadges = store.recordResult({
      won, drawn, margin, ink, level: app.level, mode: app.mode,
      bestCombo: g.bestCombo[mine], doubleCrosses: g.doubleCrosses[mine],
      conceded: best, seconds, opponent: app.rival?.name || app.seats[1 - mine]?.name || '',
    });

    if (app.mode === 'ladder' && app.rival) {
      store.recordLadder(app.rival.id, { stars, margin, won });
      if (won) store.addPrize(app.rival.prize.id);
      if (store.ladderProgress() >= RIVALS.length && store.awardBadge('ladder')) newBadges.push('ladder');
      sayTaunt(rand(won ? app.rival.lose : app.rival.win));
    }
    if (app.mode === 'daily') {
      store.recordDaily(store.today(), { ink, margin, seconds, done: true });
      lb.submitDaily(store.today(), { ink, margin, seconds });
    }
    lb.submit();
  }

  setTimeout(() => showResult({ won, drawn, margin, ink, stars, newBadges, seconds, winner, tie }), 500);
}

function showResult(r) {
  const g = app.game;
  const pal = paletteFor(document.body.dataset.skin);
  const mine = app.youSeat >= 0 ? app.youSeat : 0;

  let big, line;
  if (app.youSeat < 0) {
    const { index, tie } = g.leader();
    big = tie ? 'Dead heat' : `${app.seats[index].name} wins`;
    line = tie ? 'nobody gets the last page' : `${g.scores[index]} boxes on the board`;
  } else if (r.drawn) { big = 'Level'; line = 'the bell went with the scores tied'; }
  else if (r.won) { big = rand(['You win', 'Page yours', 'Took it']); line = rand(CROWD.won); }
  else { big = rand(['You lost', 'Gone', 'Beaten']); line = rand(CROWD.lost); }
  if (Math.abs(r.margin) === 1) line = rand(CROWD.close);

  const scoreHtml = app.seats.map((s, i) =>
    `<span class="n" style="color:${pal.players[i % 4]}">${g.scores[i]}</span>`)
    .join('<span class="vs">–</span>');

  const stars = app.mode === 'ladder'
    ? `<div class="starrow">${[0, 1, 2].map((i) => `<span class="${i < r.stars ? '' : 'off'}">★</span>`).join('')}</div>` : '';

  const badges = r.newBadges.length
    ? `<div class="notice" style="margin-top:12px"><b>New on your card:</b> ${r.newBadges
        .map((id) => { const b = BADGES.find((x) => x.id === id); return b ? `${b.glyph} ${esc(b.name)}` : ''; })
        .filter(Boolean).join(' · ')}</div>` : '';

  const nextRival = app.mode === 'ladder' && r.won ? rivalById(store.nextRivalId(RIVALS)) : null;
  const prize = app.mode === 'ladder' && r.won && app.rival
    ? `<div class="notice" style="margin-top:10px"><b>${app.rival.prize.glyph} ${esc(app.rival.prize.name)}</b> goes on the shelf.</div>` : '';

  const statBits = [
    ['boxes', g.scores[mine]],
    ['best chain', g.bestCombo[mine]],
    ['double crosses', g.doubleCrosses[mine]],
    ['seconds', r.seconds],
  ];

  openModal(`
    <div class="verdict">
      <div class="big">${esc(big)}</div>
      <div class="line">${esc(line)}</div>
    </div>
    <div class="finalscore">${scoreHtml}</div>
    ${stars}
    ${app.youSeat >= 0 ? `<div class="inkgain">+${r.ink.toLocaleString()} ink</div>` : ''}
    <div class="statgrid" style="margin:16px 0">
      ${statBits.map(([k, v]) => `<div class="stat"><div class="v">${v}</div><div class="k">${esc(k)}</div></div>`).join('')}
    </div>
    ${prize}${badges}
    <div class="stack" style="margin-top:16px">
      ${nextRival ? `<button class="btn primary" data-act="next">Next bench · ${esc(nextRival.name)}</button>` : ''}
      <button class="btn ${nextRival ? '' : 'primary'}" data-act="again">${app.net ? 'Ask for a rematch' : 'One more'}</button>
      <button class="btn ghost" data-act="board">The class ranking</button>
      <button class="btn ghost" data-act="home">Shut the notebook</button>
    </div>`);

  $$('#modalPanel [data-act]').forEach((b) => b.addEventListener('click', () => {
    const a = b.dataset.act;
    closeModal();
    if (a === 'again') { if (app.net) requestRematch(); else restart(); }
    if (a === 'next') startLadder(nextRival.id);
    if (a === 'board') { app.history = ['home']; show('board'); renderBoardScreen(); }
    if (a === 'home') { app.history = []; if (app.net) leaveOnline(); show('home', false); renderHome(); }
  }));
}

/* ==========================================================  online   == */

function openOnline(prefillCode) {
  show('online');
  const p = store.load();
  const canNet = typeof window.Peer === 'function';
  const body = $('#onlineBody');

  if (!canNet) {
    body.innerHTML = `<div class="notice">Online play needs the connection library, which did not load.
      Check your network and reload — everything else works offline.</div>`;
    return;
  }

  body.innerHTML = `
    <div class="card">
      <div class="up muted" style="margin-bottom:8px">Start a game</div>
      <p class="small muted" style="margin-bottom:10px">Make a room, send the link, play from anywhere. No accounts.</p>
      <div class="seg" id="seatSeg" style="margin-bottom:10px">
        <button data-seats="2" class="on">2 players</button>
        <button data-seats="3">3</button>
        <button data-seats="4">4</button>
      </div>
      <div class="seg" id="onlineSize" style="margin-bottom:12px">
        <button data-size="small">4×4</button>
        <button data-size="medium" class="on">5×5</button>
        <button data-size="wide">5×6</button>
        <button data-size="big">6×6</button>
      </div>
      <button class="btn primary" id="hostBtn">Create a room</button>
    </div>
    <div class="card">
      <div class="up muted" style="margin-bottom:8px">Join a game</div>
      <input type="text" id="joinCode" placeholder="room code" maxlength="6"
        style="text-transform:uppercase;text-align:center;letter-spacing:.2em" value="${esc(prefillCode || '')}">
      <button class="btn" id="joinBtn" style="margin-top:10px">Join</button>
    </div>
    <p class="tiny muted" style="text-align:center">
      Connections are peer to peer. Keep this tab open — the room lives in it.
    </p>`;

  $$('#seatSeg button').forEach((b) => b.onclick = () => {
    $$('#seatSeg button').forEach((x) => x.classList.toggle('on', x === b));
    app.lobbySeats = Number(b.dataset.seats);
  });
  $$('#onlineSize button').forEach((b) => b.onclick = () => {
    $$('#onlineSize button').forEach((x) => x.classList.toggle('on', x === b));
    app.size = b.dataset.size;
  });
  $('#hostBtn').onclick = createRoom;
  $('#joinBtn').onclick = () => joinRoom($('#joinCode').value.trim().toUpperCase());
  $('#joinCode').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#joinBtn').click(); });
  if (prefillCode) setTimeout(() => joinRoom(prefillCode), 120);
}

async function createRoom() {
  const p = store.load();
  const body = $('#onlineBody');
  body.innerHTML = `<div class="card" style="text-align:center"><span class="spinner"></span>
    <p class="small muted" style="margin-top:10px">opening a room…</p></div>`;

  const host = new net.Host({
    name: p.name, seats: app.lobbySeats,
    onEvent: (e) => onHostEvent(e),
  });
  try {
    await host.open();
  } catch (err) {
    body.innerHTML = `<div class="notice">Could not open a room (${esc(err.message || err)}).
      The signalling service may be busy — try again in a moment.</div>
      <button class="btn" style="margin-top:10px" onclick="location.reload()">Reload</button>`;
    return;
  }
  app.net = { role: 'host', host, code: host.code };
  app.youSeat = 0;
  renderLobby();
}

function renderLobby() {
  const host = app.net.host;
  const link = net.linkFor(host.code);
  const seats = Array.from({ length: host.seats }, (_, i) => host.players[i] || null);
  $('#onlineBody').innerHTML = `
    <div class="card" style="text-align:center">
      <div class="up muted" style="margin-bottom:8px">Room code</div>
      <div class="codebox">${esc(host.code)}</div>
      <div class="row" style="margin-top:12px">
        <button class="btn" id="copyLink">Copy link</button>
        <button class="btn" id="shareLink">Share</button>
      </div>
    </div>
    <div class="card">
      <div class="up muted" style="margin-bottom:8px">At the desk</div>
      <div class="seatlist">
        ${seats.map((s, i) => `<div class="seat ${s ? '' : 'empty'}"><span class="d"></span>
          ${s ? esc(s.name) + (i === 0 ? ' · you' : '') : 'waiting…'}</div>`).join('')}
      </div>
    </div>
    <button class="btn primary" id="startOnline" ${host.players.length < 2 ? 'disabled' : ''}>
      ${host.players.length < 2 ? 'Waiting for someone to join' : `Start with ${host.players.length}`}
    </button>
    <button class="btn ghost" id="cancelRoom">Close the room</button>`;

  $('#copyLink').onclick = async () => {
    try { await navigator.clipboard.writeText(link); flashToastGlobal('link copied'); }
    catch { prompt('Copy this link', link); }
  };
  $('#shareLink').onclick = async () => {
    const data = { title: 'Last Page', text: `Room ${host.code} — come play squares`, url: link };
    if (navigator.share) { try { await navigator.share(data); } catch { /* cancelled */ } }
    else { try { await navigator.clipboard.writeText(link); flashToastGlobal('link copied'); } catch { prompt('Copy this link', link); } }
  };
  $('#startOnline').onclick = startOnlineGame;
  $('#cancelRoom').onclick = () => { leaveOnline(); back(); };
}

function onHostEvent(e) {
  if (e.t === 'join' || e.t === 'leave') {
    if (app.screen === 'online') renderLobby();
    if (e.t === 'join') flashToastGlobal(`${e.players[e.players.length - 1].name} joined`);
    if (e.t === 'leave' && app.screen === 'game') {
      flashToast(`${e.who.name} left`);
      app.seats = app.seats.map((s, i) => (i === e.who.seat ? { ...s, gone: true } : s));
    }
  }
  if (e.t === 'move') {
    if (app.game && app.game.turn === e.seat && !app.over) applyMove(e.edge);
    else if (app.net) app.net.host.sendState(app.game.toJSON(), app.seats.map((s) => s.name));
  }
  if (e.t === 'emoji') showEmoji(e.seat, e.key);
  if (e.t === 'rematch' && app.over) { flashToast('rematch, then'); closeModal(); startOnlineGame(); }
}

function startOnlineGame() {
  const host = app.net.host;
  const b = BOARDS[app.size] || BOARDS.medium;
  const seats = host.players.map((p) => ({ type: p.seat === 0 ? 'you' : 'remote', name: p.name }));
  app.mode = 'online';
  app.level = 'mild';
  app.youSeat = 0;
  const firstSeat = Math.floor(Math.random() * seats.length);
  begin({
    rows: b.rows, cols: b.cols, seats, youSeat: 0, firstSeat,
    label: `Room ${host.code}`, noResume: true,
  });
  host.sendState(app.game.toJSON(), seats.map((s) => s.name), { size: app.size });
}

function broadcast(last) {
  if (!app.net || app.net.role !== 'host') return;
  app.net.host.sendState(app.game.toJSON(), app.seats.map((s) => s.name), { last });
}

async function joinRoom(code) {
  if (!code) return;
  const p = store.load();
  const body = $('#onlineBody');
  body.innerHTML = `<div class="card" style="text-align:center"><span class="spinner"></span>
    <p class="small muted" style="margin-top:10px">knocking on room ${esc(code)}…</p></div>`;

  const guest = new net.Guest({ name: p.name, code, onEvent: onGuestEvent });
  try {
    await guest.open();
  } catch (err) {
    const why = err.message === 'no-room' ? 'No room with that code. Check it and try again.'
      : err.message === 'timeout' ? 'No answer. The host may have closed the tab.'
      : `Could not connect (${esc(err.message || err)}).`;
    body.innerHTML = `<div class="notice">${why}</div>
      <button class="btn" style="margin-top:10px" id="againBtn">Try another code</button>`;
    $('#againBtn').onclick = () => openOnline(null);
    return;
  }
  app.net = { role: 'guest', guest, code };
  net.clearUrlCode();
  body.innerHTML = `<div class="card" style="text-align:center">
      <div class="up muted">Room ${esc(code)}</div>
      <p style="margin:12px 0"><span class="spinner"></span></p>
      <p class="small muted">you are in. waiting for the host to start.</p>
    </div>
    <button class="btn ghost" id="leaveRoom">Leave</button>`;
  $('#leaveRoom').onclick = () => { leaveOnline(); back(); };
}

function onGuestEvent(msg) {
  if (!msg || typeof msg !== 'object') return;
  if (msg.t === 'lobby' && app.screen === 'online') {
    $('#onlineBody').innerHTML = `<div class="card">
        <div class="up muted" style="margin-bottom:8px">Room ${esc(app.net.code)}</div>
        <div class="seatlist">${msg.players.map((p) => `<div class="seat"><span class="d"></span>${esc(p.name)}</div>`).join('')}
        ${Array.from({ length: Math.max(0, msg.seats - msg.players.length) }, () => `<div class="seat empty"><span class="d"></span>waiting…</div>`).join('')}
        </div></div>
      <p class="small muted" style="text-align:center">waiting for the host to start</p>
      <button class="btn ghost" id="leaveRoom">Leave</button>`;
    $('#leaveRoom').onclick = () => { leaveOnline(); back(); };
    return;
  }
  if (msg.t === 'state') {
    const g = Game.from(msg.state);
    const first = !app.game || app.screen !== 'game' || app.game.E !== g.E;
    app.game = g;
    app.mode = 'online';
    app.over = false;
    app.youSeat = app.net.guest.seat;
    app.seats = msg.names.map((n, i) => ({ type: i === app.youSeat ? 'you' : 'remote', name: n }));
    if (first) {
      app.board.setGame(g);
      app.board.initials = app.seats.map((s) => (s.name || '?')[0].toUpperCase());
      app.label = `Room ${app.net.code}`;
      app.noResume = true;
      show('game');
      $('#emojiBar').style.display = '';
      requestAnimationFrame(() => app.board.resize());
    } else {
      app.board.game = g;
      if (msg.last) {
        app.board.commit(msg.last.edge, msg.last.boxes, msg.last.player);
        if (msg.last.boxes.length) snd.pop(msg.last.boxes.length); else snd.scratch();
      }
      app.board.draw();
    }
    app.board.locked = g.turn !== app.youSeat;
    renderScoreStrip();
    renderTurn();
    if (g.isOver() && !app.over) setTimeout(finish, 500);
    return;
  }
  if (msg.t === 'emoji') showEmoji(msg.seat, msg.key);
  if (msg.t === 'full') { flashToastGlobal('that room is full'); openOnline(null); }
  if (msg.t === 'closed') {
    flashToastGlobal('the host closed the room');
    app.net = null;
    app.over = true;
    app.history = [];
    show('home', false);
    renderHome();
  }
}

function sendEmoji(key) {
  if (!app.net) return;
  if (app.net.role === 'guest') app.net.guest.send({ t: 'emoji', key });
  else { app.net.host.relay({ t: 'emoji', seat: 0, key }); }
  showEmoji(app.youSeat, key);
}

function showEmoji(seat, key) {
  const name = app.seats[seat]?.name || 'someone';
  flashToast(`${key}  ${name}`);
}

function requestRematch() {
  if (!app.net) return;
  if (app.net.role === 'host') startOnlineGame();
  else { app.net.guest.send({ t: 'rematch' }); flashToast('asked for a rematch'); }
}

function leaveOnline() {
  if (!app.net) return;
  try { app.net.role === 'host' ? app.net.host.close() : app.net.guest.close(); } catch { /* ignore */ }
  app.net = null;
  $('#emojiBar').style.display = 'none';
}

function flashToastGlobal(msg) {
  if (app.screen === 'game') { flashToast(msg); return; }
  const el = document.createElement('div');
  el.className = 'toast show';
  el.style.cssText = 'position:fixed;top:14px;left:50%;z-index:200';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1800);
}

/* ==========================================================   board   == */

let lbCache = { world: null, daily: null };

async function renderBoardScreen(force = false) {
  const tab = $$('#lbTabs button').find((b) => b.classList.contains('on'))?.dataset.tab || 'world';
  const body = $('#lbBody');
  $('#lbStatus').textContent = lb.statusNote();

  if (tab === 'wall') { renderWall(body); return; }
  if (tab === 'me') { renderMe(body); return; }

  if (tab === 'world') {
    if (!lbCache.world || force) {
      body.innerHTML = `<div class="card" style="text-align:center"><span class="spinner"></span></div>`;
      lbCache.world = await lb.fetchBoard('world');
    }
    paintRows(body, lbCache.world, 'ink');
    return;
  }
  if (tab === 'daily') {
    if (!lbCache.daily || force) {
      body.innerHTML = `<div class="card" style="text-align:center"><span class="spinner"></span></div>`;
      lbCache.daily = await lb.fetchDaily(store.today());
    }
    paintRows(body, lbCache.daily, 'daily');
    return;
  }
}

function paintRows(body, data, kind) {
  const me = store.load().name;
  $('#lbStatus').textContent = lb.statusNote();
  if (!data.rows.length) {
    body.innerHTML = `<div class="notice">
      ${data.source === 'local'
        ? 'No world board reachable from here, so this shows only your own desk. Point the app at an endpoint and the same screen goes worldwide — see the readme.'
        : kind === 'daily' ? 'Nobody has finished today’s page yet. Be the first name on it.'
        : 'The board is empty. Play a game and put your name up.'}
    </div>${data.source === 'local' ? renderLocalRow() : ''}`;
    return;
  }
  body.innerHTML = data.rows.map((r, i) => {
    const you = r.you || r.name === me;
    const sub = kind === 'daily'
      ? `${r.margin > 0 ? `won by ${r.margin}` : r.margin === 0 ? 'level' : `lost by ${-r.margin}`} · ${r.seconds}s`
      : `${r.won || 0} won of ${r.played || 0} · ${r.stars || 0}★`;
    return `<div class="lbrow ${you ? 'you' : ''} top${i + 1}">
      <div class="pos">${i + 1}</div>
      <div><div class="nm">${esc(r.name)}${you ? ' · you' : ''}</div><div class="sub">${esc(sub)}</div></div>
      <div class="ink">${(r.ink || 0).toLocaleString()}</div>
    </div>`;
  }).join('');
}

function renderLocalRow() {
  const p = store.load();
  if (!p.name) return '';
  return `<div class="lbrow you" style="margin-top:10px">
    <div class="pos">1</div>
    <div><div class="nm">${esc(p.name)} · you</div><div class="sub">${p.won} won of ${p.played} · ${store.totalStars()}★</div></div>
    <div class="ink">${p.ink.toLocaleString()}</div></div>`;
}

function renderWall(body) {
  body.innerHTML = `<div class="notice" style="margin-bottom:12px">
      The names painted on the back wall of IX-B. They are characters in this game,
      not real players — the World tab is where living people are ranked.
    </div>` +
    lb.hallOfFame().map((h) => `<div class="lbrow legend top${h.rank}">
      <div class="pos">${h.rank}</div>
      <div><div class="nm">${esc(h.name)}</div><div class="sub">${esc(h.note)}</div></div>
      <div class="ink">${h.ink.toLocaleString()}</div></div>`).join('');
}

function renderMe(body) {
  const p = store.load();
  const rk = rankFor(p.ink);
  const nx = nextRank(p.ink);
  const pct = nx ? Math.round(((p.ink - rk.min) / (nx.min - rk.min)) * 100) : 100;
  body.innerHTML = `
    <div class="card" style="text-align:center;margin-bottom:12px">
      <div style="font-size:2rem">${rk.glyph}</div>
      <h2 style="margin:4px 0">${esc(p.name)}</h2>
      <div class="muted small">${esc(rk.name)} · ${p.ink.toLocaleString()} ink</div>
      ${nx ? `<div style="margin-top:12px">
        <div style="height:7px;border-radius:99px;background:var(--field-bg);overflow:hidden">
          <div style="height:100%;width:${pct}%;background:var(--accent)"></div></div>
        <div class="tiny muted" style="margin-top:5px">${(nx.min - p.ink).toLocaleString()} ink to ${esc(nx.name)}</div>
      </div>` : `<div class="tiny muted" style="margin-top:10px">top of the school</div>`}
    </div>
    <div class="card" style="margin-bottom:12px">
      <div class="up muted" style="margin-bottom:9px">Report card</div>
      <div class="statgrid">
        ${[['played', p.played], ['won', p.won], ['lost', p.lost], ['drawn', p.drawn],
           ['best streak', p.bestStreak], ['best chain', p.bestCombo],
           ['double crosses', p.doubleCrosses], ['benches', store.ladderProgress()]]
          .map(([k, v]) => `<div class="stat"><div class="v">${v}</div><div class="k">${esc(k)}</div></div>`).join('')}
      </div>
    </div>
    <div class="card">
      <div class="up muted" style="margin-bottom:9px">Badges</div>
      <div class="badgegrid">${BADGES.map((b) => {
        const got = !!p.badges[b.id];
        return `<div class="badge ${got ? '' : 'off'}"><div class="g">${b.glyph}</div>
          <div class="n">${esc(b.name)}</div><div class="d">${esc(b.desc)}</div></div>`;
      }).join('')}</div>
    </div>
    <button class="btn ghost" style="margin-top:12px" id="wipeBtn">Start a new notebook</button>`;
  $('#wipeBtn').onclick = () => {
    openModal(`<h2>Start a new notebook?</h2>
      <p class="muted small" style="margin:10px 0 16px">Every box, badge and prize goes. There is no undo.</p>
      <div class="stack">
        <button class="btn" data-w="no">Keep it</button>
        <button class="btn ghost" data-w="yes" style="color:var(--bad)">Throw it away</button>
      </div>`);
    $$('#modalPanel [data-w]').forEach((b) => b.onclick = () => {
      closeModal();
      if (b.dataset.w === 'yes') { store.reset(); location.reload(); }
    });
  };
}

/* ==========================================================   extras  == */

function openReportCard() {
  snd.tap();
  app.history.push(app.screen);
  show('board', false);
  $$('#lbTabs button').forEach((x) => x.classList.toggle('on', x.dataset.tab === 'me'));
  renderBoardScreen();
}

function openHow() {
  snd.tap();
  openModal(`
    <h2>How the last page works</h2>
    <div class="stack" style="margin-top:14px;gap:14px">
      <p class="small">Take turns drawing one line between two dots. Close the fourth
      side of a box and it is yours — <b>and you go again</b>. Most boxes at the end wins.</p>
      <div class="notice"><b>The trap.</b> Never draw the third side of a box. Do that
      and your opponent takes it, and everything joined to it, in one turn.</div>
      <div class="notice"><b>The real game.</b> Late on, the board becomes chains of boxes.
      Whoever is forced to open a chain loses it. So the fight is about who runs out of
      safe lines first — count the long chains and make that number odd or even in your favour.</div>
      <div class="notice"><b>The double cross.</b> Handed a long chain, take all but the last two
      and stop. Your opponent must take those two and then open the next chain for you.
      Give up two, win the rest. This is how Board Exam beats you.</div>
      <p class="tiny muted">Nine dots on the back of a notebook. Elwyn Berlekamp wrote a whole book about it.</p>
    </div>
    <button class="btn primary" style="margin-top:16px" id="gotIt">Got it</button>`);
  $('#gotIt').onclick = closeModal;
}

window.__app = app;
boot();

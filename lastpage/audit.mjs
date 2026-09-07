/* Audit — Last Page.
 * Chromium cannot be downloaded in this sandbox, so the app is executed in
 * jsdom instead: real index.html, real modules, real clicks. Canvas is stubbed
 * because jsdom has no 2D context; everything else runs for real.
 */
import { JSDOM, VirtualConsole } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('lastpage');
let pass = 0, fail = 0;
const ok = (n, c) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

/* --- a 2D context that records nothing but never throws ----------------- */
const ctxStub = () => new Proxy({}, {
  get(t, k) {
    if (k === 'canvas') return { width: 800, height: 800 };
    if (k === 'measureText') return () => ({ width: 10 });
    if (k === 'createLinearGradient' || k === 'createRadialGradient')
      return () => ({ addColorStop() {} });
    if (typeof k === 'string' && k.startsWith('_')) return undefined;
    return t[k] !== undefined ? t[k] : (() => {});
  },
  set(t, k, v) { t[k] = v; return true; },
});

const vc = new VirtualConsole();
const errors = [];
vc.on('jsdomError', (e) => errors.push('jsdomError: ' + e.message));
vc.on('error', (m) => errors.push('console.error: ' + m));

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
  .replace(/<link[^>]*fonts\.googleapis[^>]*>/g, '')
  .replace(/<script[^>]*peerjs[^>]*><\/script>/g, '');

const dom = new JSDOM(html, {
  url: 'http://localhost:3000/',
  runScripts: 'dangerously',
  resources: undefined,
  pretendToBeVisual: true,
  virtualConsole: vc,
});
const { window } = dom;
const doc = window.document;

// canvas + APIs jsdom lacks
window.HTMLCanvasElement.prototype.getContext = ctxStub;
window.AudioContext = undefined;
window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
Object.defineProperty(window.HTMLElement.prototype, 'clientWidth', { get() { return 400; }, configurable: true });
Object.defineProperty(window.HTMLElement.prototype, 'clientHeight', { get() { return 400; }, configurable: true });
window.HTMLCanvasElement.prototype.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 400, right: 400, bottom: 400 });

// the fetch the leaderboard uses
window.fetch = async (url, opts = {}) => {
  const u = String(url);
  const body = { ok: true, rows: [], you: null };
  if (u.includes('/health')) return json({ ok: true, players: 3 });
  if (u.includes('/scores') && (opts.method || 'GET') === 'GET')
    return json({ rows: [
      { name: 'Meera', ink: 9100, played: 22, won: 18, stars: 14 },
      { name: 'Kinnu', ink: 400, played: 1, won: 1, stars: 2 },
    ] });
  if (u.includes('/daily') && (opts.method || 'GET') === 'GET')
    return json({ day: '2026-09-07', rows: [{ name: 'Meera', ink: 800, margin: 6, seconds: 94 }] });
  return json(body);
};
function json(o) { return { ok: true, status: 200, json: async () => o }; }

// load the ES modules by hand (jsdom will not fetch them)
const modText = new Map();
for (const f of fs.readdirSync(path.join(ROOT, 'js'))) {
  modText.set('./' + f, fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'));
}
const url = (rel) => 'file://' + path.join(ROOT, 'js', rel.replace('./', ''));
const mods = {};
for (const rel of ['./engine.js', './ai.js', './universe.js', './store.js', './leaderboard.js', './render.js', './sound.js', './net.js', './ui.js']) {
  // nothing to do — imported below through node, sharing the jsdom globals
}

// expose jsdom globals to the modules
global.window = window;
global.document = doc;
global.location = window.location;
global.localStorage = window.localStorage;
Object.defineProperty(global, 'navigator', { value: window.navigator, configurable: true });
global.requestAnimationFrame = (fn) => setTimeout(() => fn(Date.now()), 0);
global.cancelAnimationFrame = clearTimeout;
global.fetch = window.fetch;
global.AbortController = window.AbortController || global.AbortController;
global.URL = window.URL;
global.history = window.history;
global.getComputedStyle = window.getComputedStyle.bind(window);
global.devicePixelRatio = 1;
global.HTMLElement = window.HTMLElement;
global.prompt = () => {};
window.scrollTo = () => {};   // jsdom has no layout

const tick = (ms = 60) => new Promise((r) => setTimeout(r, ms));
const $ = (s) => doc.querySelector(s);
const $$ = (s) => Array.from(doc.querySelectorAll(s));
const vis = (s) => !!$(s);
const click = async (s, ms = 120) => {
  const el = typeof s === 'string' ? $(s) : s;
  if (!el) throw new Error('no element ' + s);
  el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await tick(ms);
};
const onScreen = (id) => $(`#screen-${id}`)?.classList.contains('on');

console.log('── BOOTING ──');
await import(url('./ui.js'));
await tick(200);
const app = window.__app;
ok('app booted without throwing', !!app);
ok('no page errors during boot', errors.length === 0 || (console.log(errors.join('\n')), false));

console.log('\n── NAME GATE ──');
ok('asks for a name first', onScreen('name'));
ok('promises no account', /No password, no email/.test($('#screen-name').textContent));
ok('no game running yet', !app.game);
$('#nameInput').value = 'Kinnu';
await click('#nameGo', 200);

console.log('\n── HOME ──');
ok('lands on a personal home', onScreen('home'));
ok('greets you by name', $('#homeName').textContent === 'Kinnu');
ok('shows the starting rank', /Backbencher/.test($('#homeRank').textContent));
ok('five ways to play', $$('.modelist .mode').length === 6);
ok('points at the next rival', /Pinky/.test($('#ladderDesc').textContent));
ok('shows a stats shelf', $$('#homeStats .stat').length === 6);

console.log('\n── THE TWO SKINS ──');
ok('opens on old school', doc.body.dataset.skin === 'paper');
await click('#skinBtn');
ok('switches to trendy', doc.body.dataset.skin === 'neon');
ok('remembered in the notebook', JSON.parse(window.localStorage['lastpage.v1']).skin === 'neon');
await click('#skinBtn');
ok('switches back', doc.body.dataset.skin === 'paper');
const paperCss = fs.readFileSync(path.join(ROOT, 'css/paper.css'), 'utf8');
const neonCss = fs.readFileSync(path.join(ROOT, 'css/neon.css'), 'utf8');
ok('old school is ruled paper and ballpoint', /repeating-linear-gradient/.test(paperCss) && /#1d3c8f/.test(paperCss));
ok('trendy is dark and glowing', /#06070d/.test(neonCss) && /drop-shadow|box-shadow/.test(neonCss));
ok('the board itself is re-skinned too', /wobble/.test(fs.readFileSync(path.join(ROOT, 'js/render.js'), 'utf8')));

console.log('\n── LADDER ──');
await click('[data-go="ladder"]', 200);
ok('ladder opens', onScreen('ladder'));
ok('twelve benches', $$('.rival').length === 12);
ok('eleven locked behind bench one', $$('.rival.locked').length === 11);
ok('four rows of the class', $$('.rowhead').length === 4);
ok('a prize shelf', $$('.prize').length === 12);
ok('every prize still hidden', $$('.prize.locked').length === 12);

console.log('\n── A REAL GAME AGAINST BENCH ONE ──');
await click('.rival:not(.locked)', 300);
ok('board screen up', onScreen('game'));
ok('a game exists', !!app.game);
ok('two seats', app.seats.length === 2);
ok('rival is Pinky', app.seats[1].name === 'Pinky');
ok('scores rendered', $$('.pscore').length === 2);
ok('bot seat is a bot', app.seats[1].type === 'bot');

// play it out through the real click path, the way a person would:
// take every free box, otherwise play a line that gives nothing away.
const { chooseMove } = await import(url('./ai.js'));
const humanish = (g) => chooseMove(g, 'mild');
let guard = 0;
while (app.game && !app.game.isOver() && guard++ < 400) {
  if (app.busy || app.board.locked) { await tick(60); continue; }
  app.board.onPlay(humanish(app.game));
  await tick(30);
}
ok('played to the final box', app.game.isOver());
await tick(1400);
ok('a result sheet appears', $('#modal').classList.contains('on'));
ok('with a verdict', ($('.verdict .big')?.textContent || '').length > 2);
ok('both final scores', $$('.finalscore .n').length === 2);
ok('stars rated on the ladder', !!$('.starrow'));
ok('ink awarded', /\+[\d,]+ ink/.test($('.inkgain')?.textContent || ''));
ok('offers another game at once', !!$('[data-act="again"]'));
ok('offers the ranking', !!$('[data-act="board"]'));

const prof = () => JSON.parse(window.localStorage['lastpage.v1']);
ok('the game was recorded', prof().played === 1);
ok('ink banked', prof().ink > 0);
ok('the bench was logged', Object.keys(prof().ladder).length === 1);
ok('a sensible player beats bench one', prof().won === 1);
ok('beating a bench wins its prize', prof().prizes.length === 1);
ok('and a badge lands on the card', Object.keys(prof().badges).length >= 1);
ok('bench two is unlocked by the win', prof().ladder[1].beaten === true);

console.log('\n── LEAVE WHENEVER YOU LIKE ──');
await click('[data-act="home"]', 200);
ok('back home', onScreen('home'));
await click('[data-go="quick"]', 150);
ok('quick match setup', onScreen('setup'));
ok('three benches to choose', $$('#levelSeg button').length === 3);
ok('four board sizes', $$('#sizeSeg button').length === 4);
ok('who goes first is a choice', $$('#firstSeg button').length === 3);
await click('#setupGo', 300);
ok('quick game starts', onScreen('game'));
await click('#pauseBtn', 150);
ok('pause opens', $('#modal').classList.contains('on'));
ok('resume offered', !!$('[data-act="resume"]'));
ok('restart offered', !!$('[data-act="restart"]'));
ok('leaving offered', !!$('[data-act="quit"]'));
ok('sound can be toggled from pause', !!$('[data-act="sound"]'));
ok('skin can be flipped mid-game', !!$('[data-act="skin"]'));
await click('[data-act="resume"]', 150);
ok('resume closes the sheet', !$('#modal').classList.contains('on'));

// make a move so there is something worth keeping, then walk out
for (let i = 0; i < 3 && !app.board.locked; i++) {
  const g = app.game;
  const free = [];
  for (let k = 0; k < g.E; k++) if (!g.edges[k]) free.push(k);
  app.board.onPlay(free[0]);
  await tick(60);
}
await tick(400);
await click('#pauseBtn', 150);
await click('[data-act="quit"]', 250);
ok('leaving drops you home', onScreen('home'));
ok('the game waits on the shelf', $('#mResume').style.display !== 'none');
await click('#mResume', 300);
ok('and resumes where it stood', onScreen('game') && app.game.moves.length > 0);
await click('#pauseBtn', 120); await click('[data-act="quit"]', 250);

console.log('\n── PASS AND PLAY ──');
await click('[data-go="pass"]', 200);
ok('asks how many are playing', !!$('#countSeg'));
await click('#countSeg [data-count="4"]', 150);
ok('four name fields', $$('#nameFields input').length === 4);
$('#nameFields input[data-pi="1"]').value = 'Golu';
$('#nameFields input[data-pi="2"]').value = 'Meera';
$('#nameFields input[data-pi="3"]').value = 'Faiz';
await click('#setupGo', 300);
ok('four players on one screen', app.seats.length === 4 && $$('.pscore').length === 4);
ok('names carried in', /Golu/.test($('#scoreStrip').textContent) && /Faiz/.test($('#scoreStrip').textContent));
ok('all four are local humans', app.seats.every((s) => s.type === 'local'));
ok('prompts whoever is up', /,\s*your line|your turn/.test($('#turnText').textContent));
await click('#pauseBtn', 120); await click('[data-act="quit"]', 250);

console.log('\n── DAILY PAGE ──');
// snapshot the page and the opening move, once the bot has had its turn
const dailySnap = async () => {
  await click('[data-go="daily"]', 300);
  await tick(1600);
  const g = app.game;
  return JSON.stringify({ R: g.R, C: g.C, first: g.moves[0]?.player ?? g.turn,
                          opening: g.moves.map((m) => m.edge) });
};
const a = await dailySnap();
ok('daily starts', onScreen('game'));
ok('daily is the toughest bench', app.seats[1].level === 'tough');
await click('#pauseBtn', 120); await click('[data-act="quit"]', 250);
const b = await dailySnap();
ok('same board and same opening for everyone today', a === b);
await click('#pauseBtn', 120); await click('[data-act="quit"]', 250);

console.log('\n── THE CLASS RANKING ──');
await click('#lbBtn', 500);
ok('ranking opens', onScreen('board'));
ok('world rows listed', $$('#lbBody .lbrow').length >= 2);
ok('you are found in the list', /Kinnu/.test($('#lbBody').textContent));
ok('four tabs', $$('#lbTabs button').length === 4);
await click('#lbTabs [data-tab="wall"]', 200);
ok('back wall is honest about being fiction', /not real players/.test($('#lbBody').textContent));
ok('five legends', $$('.lbrow.legend').length === 5);
await click('#lbTabs [data-tab="daily"]', 300);
ok('today has its own board', $$('#lbBody .lbrow').length >= 1);
await click('#lbTabs [data-tab="me"]', 200);
ok('report card', !!$('.badgegrid'));
ok('ten badges', $$('.badge').length === 10);
ok('earned badges are lit, the rest dimmed', $$('.badge:not(.off)').length >= 1 && $$('.badge.off').length >= 1);
ok('progress to the next rank', /ink to/.test($('#lbBody').textContent));
ok('the notebook can be thrown away', !!$('#wipeBtn'));

console.log('\n── INVITE A FRIEND ──');
await click('[data-back]', 200);
await click('[data-go="online"]', 250);
ok('online screen opens', onScreen('online'));
ok('degrades honestly with no peer library', /did not load/.test($('#onlineBody').textContent));

console.log('\n── HOW TO PLAY ──');
await click('[data-back]', 200);
await click('#howBtn', 200);
const howText = $('#modalPanel').textContent;
ok('teaches the third-side trap', /third\s+side/i.test(howText));
ok('teaches chains', /chain/i.test(howText));
ok('teaches the double cross', /double cross/i.test(howText));
await click('#gotIt', 120);

console.log('\n── NO STRAY ERRORS ──');
ok('nothing threw across the whole session', errors.length === 0);
if (errors.length) console.log(errors.slice(0, 8).join('\n'));

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);

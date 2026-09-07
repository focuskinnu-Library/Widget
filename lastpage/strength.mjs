/* Strength test — the three benches must actually be three benches.
 * Run: node lastpage/strength.mjs
 */
import { Game } from './js/engine.js';
import { chooseMove, makeRng } from './js/ai.js';

let pass = 0, fail = 0;
const ok = (n, c, detail = '') => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${detail ? '  · ' + detail : ''}`); };

function match(aLevel, bLevel, R, C, seed) {
  const g = new Game(R, C, 2);
  const rng = makeRng(seed);
  let guard = 0;
  while (!g.isOver() && guard++ < 4000) g.play(chooseMove(g, g.turn === 0 ? aLevel : bLevel, rng));
  return g.scores;
}

function series(a, b, R, C, n, offset = 0) {
  let aw = 0, bw = 0, dr = 0;
  for (let i = 1; i <= n; i++) {
    // alternate who opens, so nobody wins on the first-move advantage alone
    const [x, y] = i % 2 ? match(a, b, R, C, i * 7919 + offset) : match(b, a, R, C, i * 7919 + offset).slice().reverse();
    if (x > y) aw++; else if (y > x) bw++; else dr++;
  }
  return { aw, bw, dr };
}

console.log('── THE BENCHES ARE DIFFERENT BENCHES ──');
const em = series('easy', 'mild', 4, 4, 24);
ok('Unit Test crushes Recess', em.bw >= em.aw * 4, `${em.aw}–${em.bw} (${em.dr} level)`);

const mt = series('mild', 'tough', 4, 4, 24);
ok('Board Exam beats Unit Test on a small page', mt.bw > mt.aw * 2, `${mt.aw}–${mt.bw} (${mt.dr} level)`);

const mt5 = series('mild', 'tough', 5, 5, 16);
ok('Board Exam beats Unit Test on a big page', mt5.bw > mt5.aw * 2, `${mt5.aw}–${mt5.bw} (${mt5.dr} level)`);

const et = series('easy', 'tough', 4, 4, 16);
ok('Board Exam never really loses to Recess', et.bw >= 15, `${et.aw}–${et.bw} (${et.dr} level)`);

console.log('\n── THE TOUGH BENCH PLAYS THE REAL GAME ──');
{
  // it must be willing to give boxes away to take control
  let sawDecline = false, sawBigChain = false;
  for (let s = 1; s <= 12 && !(sawDecline && sawBigChain); s++) {
    const g = new Game(5, 5, 2);
    const rng = makeRng(s * 104729);
    while (!g.isOver()) g.play(chooseMove(g, g.turn === 0 ? 'tough' : 'mild', rng));
    if (g.doubleCrosses[0] > 0) sawDecline = true;
    if (g.bestCombo[0] >= 6) sawBigChain = true;
  }
  ok('it plays the double-cross', sawDecline);
  ok('it cashes long chains', sawBigChain);
}

console.log('\n── IT IS FAST ENOUGH TO FEEL INSTANT ──');
{
  const g = new Game(6, 6, 2);
  const rng = makeRng(42);
  let worst = 0, total = 0, n = 0;
  while (!g.isOver()) {
    const t = Date.now();
    const m = chooseMove(g, g.turn === 0 ? 'tough' : 'mild', rng);
    if (g.turn === 0) { const d = Date.now() - t; worst = Math.max(worst, d); total += d; n++; }
    g.play(m);
  }
  ok('worst move on the biggest board stays under 1s', worst < 1000, `worst ${worst}ms, avg ${(total / n).toFixed(0)}ms`);
}

console.log('\n── THE RULES HOLD ──');
{
  const g = new Game(3, 3, 2);
  const rng = makeRng(5);
  while (!g.isOver()) g.play(chooseMove(g, 'mild', rng));
  ok('every box ends up owned', g.scores[0] + g.scores[1] === 9, `${g.scores.join('–')}`);
  ok('every wall ends up drawn', g.availableEdges().length === 0);
  ok('nobody owns a box twice', g.owner.every((o) => o === 0 || o === 1));
}
{
  const g = new Game(2, 2, 2);
  g.play(g.hIndex(0, 0)); ok('a plain line passes the turn', g.turn === 1);
  g.play(g.vIndex(0, 0)); g.play(g.vIndex(0, 1));
  const before = g.turn;
  const res = g.play(g.hIndex(1, 0));
  ok('closing a box scores it', res.boxes.length === 1);
  ok('and you go again', g.turn === before);
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);

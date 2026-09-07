/* LAST PAGE — the three benches you play against.
 *
 *   easy  ("recess")     grabs boxes, otherwise wanders
 *   mild  ("unit test")  greedy + never hands you a box, but loses the chain fight
 *   tough ("board exam") chain theory, the double-cross, and a perfect endgame
 *
 * The tough bot is the reason this game has a ceiling. It counts long chains,
 * plays for parity, declines boxes to keep control, and solves the loony
 * endgame exactly with the classic chains-and-loops recursion.
 */

import { analyse, chainCount } from './engine.js';

const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];

export function makeRng(seed) {
  let s = seed >>> 0 || 1;
  return function rng() {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

/* ---------------------------------------------------------------- easy --- */

function easyMove(game, rng) {
  const caps = game.capturingEdges();
  if (caps.length && rng() < 0.8) return pick(caps, rng);
  const safe = game.safeEdges();
  if (safe.length && rng() < 0.55) return pick(safe, rng);
  return pick(game.availableEdges(), rng);
}

/* ---------------------------------------------------------------- mild --- */

function mildMove(game, rng) {
  const caps = game.capturingEdges();
  if (caps.length) return pick(caps, rng);

  const safe = game.safeEdges();
  if (safe.length) {
    // Prefer walls that keep boxes roomy — a crude but human instinct.
    let best = [], bestScore = -Infinity;
    for (const e of safe) {
      let score = 0;
      for (const b of game.edgeBoxes(e)) {
        const r = Math.floor(b / game.C), c = b % game.C;
        score -= game.boxSides(r, c);
      }
      score += rng() * 0.5;
      if (score > bestScore) { bestScore = score; best = [e]; }
      else if (score === bestScore) best.push(e);
    }
    return pick(best, rng);
  }

  // Forced to open something: give away as little as possible, but with no
  // idea about who ends up in control.
  return smallestSacrifice(game, rng);
}

function smallestSacrifice(game, rng) {
  const comps = analyse(game);
  const sizeOf = new Map();
  for (const k of comps) for (const cell of k.cells) sizeOf.set(cell, k.size);
  let best = [], bestCost = Infinity;
  for (const e of game.availableEdges()) {
    let cost = 0;
    for (const b of game.edgeBoxes(e)) cost = Math.max(cost, sizeOf.get(b) || 0);
    if (cost < bestCost) { bestCost = cost; best = [e]; }
    else if (cost === bestCost) best.push(e);
  }
  return pick(best, rng);
}

/* --------------------------------------------------------------- tough --- */

/**
 * Exact value of a loony endgame made only of chains and loops.
 * f(S) = best net score for the player who must open next.
 * Opening a component of size s, the opponent either takes it all and opens
 * next, or double-crosses: takes all but two (all but four in a loop) and
 * hands the opening back.
 */
function loonyValue(chains, loops, memo = new Map()) {
  if (!chains.length && !loops.length) return 0;
  const key = chains.join(',') + '|' + loops.join(',');
  const hit = memo.get(key);
  if (hit !== undefined) return hit;

  let best = -Infinity;
  const tried = new Set();

  for (let i = 0; i < chains.length; i++) {
    const s = chains[i];
    if (tried.has('c' + s)) continue;
    tried.add('c' + s);
    const rest = chains.slice(0, i).concat(chains.slice(i + 1));
    const f = loonyValue(rest, loops, memo);
    const takeAll = -(s + f);
    const decline = s >= 2 ? (4 - s + f) : -Infinity;
    best = Math.max(best, Math.min(takeAll, decline));
  }
  for (let i = 0; i < loops.length; i++) {
    const s = loops[i];
    if (tried.has('l' + s)) continue;
    tried.add('l' + s);
    const rest = loops.slice(0, i).concat(loops.slice(i + 1));
    const f = loonyValue(chains, rest, memo);
    const takeAll = -(s + f);
    const decline = s >= 4 ? (8 - s + f) : -Infinity;
    best = Math.max(best, Math.min(takeAll, decline));
  }
  memo.set(key, best);
  return best;
}

function componentsToLists(comps) {
  const chains = [], loops = [];
  for (const k of comps) {
    if (k.type === 'loop') loops.push(k.size);
    else chains.push(k.size);
  }
  chains.sort((a, b) => a - b);
  loops.sort((a, b) => a - b);
  return { chains, loops };
}

const allSimple = (comps) => comps.every((k) => k.type !== 'complex');

/**
 * Value of a position for the side to move, in net boxes.
 * Quiet ("safe") moves never score, so we can shuffle through them at random
 * and stop the moment the position turns loony — at which point the chains and
 * loops recursion gives the exact answer. Because safe moves strictly alternate
 * the turn, this samples the chain-parity fight honestly rather than guessing it.
 */
function playoutValue(game, rollouts, rng, memo) {
  let total = 0;
  for (let n = 0; n < rollouts; n++) {
    const s = game.clone();
    let guard = 0;
    while (guard++ < 400) {
      const safe = s.safeEdges();
      if (!safe.length) break;
      s.play(safe[Math.floor(rng() * safe.length)]);
    }
    const comps = analyse(s);
    const { chains, loops } = componentsToLists(comps);
    const v = loonyValue(chains, loops, memo);   // net for whoever must open
    total += s.turn === game.turn ? v : -v;
  }
  return total / rollouts;
}

/** Exact alpha-beta for the last handful of walls. */
function exactSearch(game, budget) {
  const memo = new Map();
  let nodes = 0;

  function search(state, alpha, beta) {
    if (nodes++ > budget) return null;
    const avail = state.availableEdges();
    if (!avail.length) return { value: 0, move: -1 };
    const key = state.edges.join('') + state.turn;
    const hit = memo.get(key);
    if (hit) return hit;

    let bestVal = -Infinity, bestMove = avail[0];
    // Capturing moves first: they keep the turn and prune hard.
    avail.sort((a, b) => state.wouldComplete(b).length - state.wouldComplete(a).length);
    for (const e of avail) {
      const next = state.clone();
      const res = next.play(e);
      const gained = res.boxes.length;
      const sub = search(next, res.again ? alpha : -beta, res.again ? beta : -alpha);
      if (sub === null) return null;
      const val = res.again ? gained + sub.value : gained - sub.value;
      if (val > bestVal) { bestVal = val; bestMove = e; }
      if (bestVal > alpha) alpha = bestVal;
      if (alpha >= beta) break;
    }
    const out = { value: bestVal, move: bestMove };
    memo.set(key, out);
    return out;
  }

  return search(game, -Infinity, Infinity);
}

function toughMove(game, rng) {
  const avail = game.availableEdges();
  if (avail.length === 1) return avail[0];

  // 1. Perfect finish. Cheap, and it is exactly where humans throw games away.
  if (avail.length <= 16) {
    const res = exactSearch(game, 400000);
    if (res && res.move >= 0) return res.move;
  }

  const comps = analyse(game);
  const caps = game.capturingEdges();

  // 2. Boxes on offer — take them all, or decline to keep control.
  if (caps.length) {
    const openComp = comps.find((k) =>
      k.cells.some((cell) => {
        const r = Math.floor(cell / game.C), c = cell % game.C;
        return game.boxSides(r, c) === 3;
      })
    );
    const others = comps.filter((k) => k !== openComp);
    if (openComp) {
      const { chains, loops } = componentsToLists(others);
      const rest = loonyValue(chains, loops);
      const s = openComp.size;
      const takeAll = s + rest;
      const isLoop = openComp.type === 'loop';
      const keep = isLoop ? 4 : 2;
      const decline = s >= keep + 1 ? (s - keep) - (keep + rest) : -Infinity;
      if (decline > takeAll) {
        const dc = declineMove(game, openComp, isLoop, rng);
        if (dc >= 0) return dc;
      }
    }
    // Take the box that opens the least new ground.
    return pick(bestCapture(game, caps), rng);
  }

  // 3. Nothing free. If every safe wall is gone, choose which chain to hand over.
  const safe = game.safeEdges();
  if (!safe.length) {
    if (allSimple(comps)) {
      const { chains, loops } = componentsToLists(comps);
      let bestVal = -Infinity, bestComp = null;
      const seen = new Set();
      for (const k of comps) {
        const tag = k.type + k.size;
        if (seen.has(tag)) continue;
        seen.add(tag);
        const c2 = chains.slice(), l2 = loops.slice();
        const arr = k.type === 'loop' ? l2 : c2;
        arr.splice(arr.indexOf(k.size), 1);
        const f = loonyValue(c2, l2);
        const s = k.size;
        const takeAll = -(s + f);
        const keep = k.type === 'loop' ? 4 : 2;
        const decline = s >= keep ? ((keep * 2) - s + f) : -Infinity;
        const val = Math.min(takeAll, decline);
        if (val > bestVal) { bestVal = val; bestComp = k; }
      }
      if (bestComp) {
        const m = openingMove(game, bestComp, rng);
        if (m >= 0) return m;
      }
    }
    return smallestSacrifice(game, rng);
  }

  // 4. Midgame: every safe wall is a vote on how many long chains there will be.
  return parityMove(game, safe, comps, rng);
}

/** Of the capturing moves, the one that exposes the least. */
function bestCapture(game, caps) {
  let best = [], bestScore = -Infinity;
  for (const e of caps) {
    const next = game.clone();
    next.play(e);
    const comps = analyse(next);
    let score = game.wouldComplete(e).length * 10;
    score -= comps.filter((k) => k.type === 'complex').length;
    if (score > bestScore) { bestScore = score; best = [e]; }
    else if (score === bestScore) best.push(e);
  }
  return best.length ? best : caps;
}

/** The double-cross: stop two short and hand the opening back. */
function declineMove(game, comp, isLoop, rng) {
  const want = isLoop ? 4 : 2;
  const cells = new Set(comp.cells);
  const candidates = [];
  for (const e of game.availableEdges()) {
    const boxes = game.edgeBoxes(e);
    if (!boxes.some((b) => cells.has(b))) continue;
    if (game.wouldComplete(e).length) continue;
    const next = game.clone();
    next.play(e);
    const left = comp.cells.filter((cell) => next.owner[cell] < 0).length;
    if (left === want) candidates.push(e);
  }
  if (!candidates.length) return -1;
  return pick(candidates, rng);
}

/** Open a chain from its end, which gives away the fewest boxes. */
function openingMove(game, comp, rng) {
  const cells = new Set(comp.cells);
  let best = [], bestSides = -1;
  for (const e of game.availableEdges()) {
    const boxes = game.edgeBoxes(e);
    if (!boxes.some((b) => cells.has(b))) continue;
    let sides = 0;
    for (const b of boxes) {
      if (!cells.has(b)) continue;
      const r = Math.floor(b / game.C), c = b % game.C;
      sides = Math.max(sides, game.boxSides(r, c));
    }
    if (sides > bestSides) { bestSides = sides; best = [e]; }
    else if (sides === bestSides) best.push(e);
  }
  return best.length ? pick(best, rng) : -1;
}

/**
 * Chain parity, decided by playing the position out rather than by rule of
 * thumb. Every quiet wall is a vote on how many long chains the board ends up
 * with; we sample each vote and keep the one that wins the endgame.
 */
function parityMove(game, safe, comps, rng) {
  const D = (game.R + 1) * (game.C + 1);
  const firstPlayer = game.moves.length ? game.moves[0].player : game.turn;
  const botIsFirst = game.turn === firstPlayer;
  const wantOdd = botIsFirst ? (D % 2 === 1) : (D % 2 === 0);

  // Deeper look when the board is nearly settled, wider when it is still open.
  const budget = safe.length > 34 ? 6 : safe.length > 18 ? 10 : 18;
  const memo = new Map();

  let best = [], bestScore = -Infinity;
  for (const e of safe) {
    const next = game.clone();
    next.play(e);

    // The opponent is to move in `next`, so negate to get our view.
    let score = -playoutValue(next, budget, rng, memo);

    const nc = analyse(next);
    const L = chainCount(nc);
    if ((L % 2 === 1) === wantOdd) score += 0.15;         // gentle prior only
    score -= 0.05 * nc.filter((k) => k.type === 'chain' && k.size <= 2).length;
    score += rng() * 0.02;

    if (score > bestScore) { bestScore = score; best = [e]; }
    else if (score === bestScore) best.push(e);
  }
  return pick(best, rng);
}

/* --------------------------------------------------------------- public -- */

export const LEVELS = {
  easy: { key: 'easy', label: 'Recess', fn: easyMove, think: [280, 620] },
  mild: { key: 'mild', label: 'Unit Test', fn: mildMove, think: [380, 820] },
  tough: { key: 'tough', label: 'Board Exam', fn: toughMove, think: [420, 1000] },
};

export function chooseMove(game, level = 'mild', rng = Math.random) {
  const spec = LEVELS[level] || LEVELS.mild;
  try {
    const m = spec.fn(game, rng);
    if (m >= 0 && !game.edges[m]) return m;
  } catch (err) {
    console.warn('bot stumbled, playing safe', err);
  }
  const avail = game.availableEdges();
  return avail[Math.floor(rng() * avail.length)];
}

export function thinkingTime(level, speed = 1) {
  const spec = LEVELS[level] || LEVELS.mild;
  const [a, b] = spec.think;
  return (a + Math.random() * (b - a)) / speed;
}

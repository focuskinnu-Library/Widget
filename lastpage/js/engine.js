/* LAST PAGE — game engine
 * Dots & Boxes, the "squares" game from the back page of the notebook.
 *
 * Board of R x C boxes => (R+1) x (C+1) dots.
 * Edges are stored in one flat array:
 *   H(r,c) = r*C + c              0 <= r <= R, 0 <= c < C     (NH = (R+1)*C)
 *   V(r,c) = NH + r*(C+1) + c     0 <= r < R,  0 <= c <= C    (NV = R*(C+1))
 */

export function edgeCounts(R, C) {
  const NH = (R + 1) * C;
  const NV = R * (C + 1);
  return { NH, NV, E: NH + NV };
}

export class Game {
  constructor(rows, cols, players = 2) {
    this.R = rows;
    this.C = cols;
    this.players = players;
    const { NH, NV, E } = edgeCounts(rows, cols);
    this.NH = NH;
    this.NV = NV;
    this.E = E;
    this.edges = new Uint8Array(E);        // 0 = empty, else playerIndex + 1
    this.owner = new Int8Array(rows * cols).fill(-1);
    this.scores = new Array(players).fill(0);
    this.turn = 0;
    this.moves = [];                        // {edge, player, boxes:[i], combo}
    this.combo = 0;                         // consecutive captures by current player
    this.bestCombo = new Array(players).fill(0);
    this.doubleCrosses = new Array(players).fill(0);
    this.startedAt = Date.now();
  }

  static from(json) {
    const g = new Game(json.R, json.C, json.players);
    g.edges = Uint8Array.from(json.edges);
    g.owner = Int8Array.from(json.owner);
    g.scores = json.scores.slice();
    g.turn = json.turn;
    g.moves = json.moves ? json.moves.slice() : [];
    g.combo = json.combo || 0;
    g.bestCombo = json.bestCombo ? json.bestCombo.slice() : new Array(json.players).fill(0);
    g.doubleCrosses = json.doubleCrosses ? json.doubleCrosses.slice() : new Array(json.players).fill(0);
    g.startedAt = json.startedAt || Date.now();
    return g;
  }

  toJSON() {
    return {
      R: this.R, C: this.C, players: this.players,
      edges: Array.from(this.edges), owner: Array.from(this.owner),
      scores: this.scores, turn: this.turn, moves: this.moves,
      combo: this.combo, bestCombo: this.bestCombo,
      doubleCrosses: this.doubleCrosses, startedAt: this.startedAt,
    };
  }

  clone() {
    const g = new Game(this.R, this.C, this.players);
    g.edges = this.edges.slice();
    g.owner = this.owner.slice();
    g.scores = this.scores.slice();
    g.turn = this.turn;
    g.combo = this.combo;
    return g;
  }

  hIndex(r, c) { return r * this.C + c; }
  vIndex(r, c) { return this.NH + r * (this.C + 1) + c; }

  /** The four edge indices of box (r,c). */
  boxEdges(r, c) {
    return [
      this.hIndex(r, c),
      this.hIndex(r + 1, c),
      this.vIndex(r, c),
      this.vIndex(r, c + 1),
    ];
  }

  /** How many sides of box (r,c) are drawn. */
  boxSides(r, c) {
    const e = this.boxEdges(r, c);
    let n = 0;
    for (let i = 0; i < 4; i++) if (this.edges[e[i]]) n++;
    return n;
  }

  /** Boxes (as flat indices) touching an edge. */
  edgeBoxes(idx) {
    const out = [];
    if (idx < this.NH) {
      const r = Math.floor(idx / this.C), c = idx % this.C;
      if (r - 1 >= 0) out.push((r - 1) * this.C + c);
      if (r < this.R) out.push(r * this.C + c);
    } else {
      const k = idx - this.NH;
      const r = Math.floor(k / (this.C + 1)), c = k % (this.C + 1);
      if (c - 1 >= 0) out.push(r * this.C + (c - 1));
      if (c < this.C) out.push(r * this.C + c);
    }
    return out;
  }

  /** Geometry of an edge, for drawing + hit tests. Unit grid coordinates. */
  edgeGeom(idx) {
    if (idx < this.NH) {
      const r = Math.floor(idx / this.C), c = idx % this.C;
      return { x1: c, y1: r, x2: c + 1, y2: r, horizontal: true };
    }
    const k = idx - this.NH;
    const r = Math.floor(k / (this.C + 1)), c = k % (this.C + 1);
    return { x1: c, y1: r, x2: c, y2: r + 1, horizontal: false };
  }

  availableEdges() {
    const out = [];
    for (let i = 0; i < this.E; i++) if (!this.edges[i]) out.push(i);
    return out;
  }

  isOver() {
    for (let i = 0; i < this.E; i++) if (!this.edges[i]) return false;
    return true;
  }

  /** Would drawing `idx` complete boxes? Returns the flat box indices. */
  wouldComplete(idx) {
    const res = [];
    for (const b of this.edgeBoxes(idx)) {
      const r = Math.floor(b / this.C), c = b % this.C;
      if (this.boxSides(r, c) === 3) res.push(b);
    }
    return res;
  }

  /**
   * Play an edge. Returns { ok, boxes, again, player, combo }.
   * The player keeps the turn when they complete at least one box.
   */
  play(idx) {
    if (idx < 0 || idx >= this.E || this.edges[idx]) return { ok: false };
    const player = this.turn;
    const gained = this.wouldComplete(idx);
    this.edges[idx] = player + 1;
    for (const b of gained) {
      this.owner[b] = player;
      this.scores[player]++;
    }
    if (gained.length > 0) {
      this.combo += gained.length;
      if (this.combo > this.bestCombo[player]) this.bestCombo[player] = this.combo;
    } else {
      // A player who hands over the turn straight after taking boxes, while
      // boxes were still on offer, has played a double-cross.
      if (this.combo > 0 && this.hasFreeBox()) this.doubleCrosses[player]++;
      this.combo = 0;
      this.turn = (this.turn + 1) % this.players;
    }
    const rec = { edge: idx, player, boxes: gained, combo: this.combo };
    this.moves.push(rec);
    return { ok: true, boxes: gained, again: gained.length > 0, player, combo: this.combo };
  }

  hasFreeBox() {
    for (let r = 0; r < this.R; r++)
      for (let c = 0; c < this.C; c++)
        if (this.owner[r * this.C + c] < 0 && this.boxSides(r, c) === 3) return true;
    return false;
  }

  /** Edges that immediately win a box. */
  capturingEdges() {
    const out = [];
    for (let i = 0; i < this.E; i++) {
      if (this.edges[i]) continue;
      if (this.wouldComplete(i).length > 0) out.push(i);
    }
    return out;
  }

  /** Edges that do not leave any box on 3 sides ("safe" / non-loony moves). */
  safeEdges() {
    const out = [];
    for (let i = 0; i < this.E; i++) {
      if (this.edges[i]) continue;
      let safe = true;
      for (const b of this.edgeBoxes(i)) {
        const r = Math.floor(b / this.C), c = b % this.C;
        if (this.boxSides(r, c) === 2) { safe = false; break; }
      }
      if (safe && this.wouldComplete(i).length === 0) out.push(i);
    }
    return out;
  }

  leader() {
    let best = 0;
    for (let i = 1; i < this.players; i++) if (this.scores[i] > this.scores[best]) best = i;
    const tie = this.scores.filter((s) => s === this.scores[best]).length > 1;
    return { index: best, tie };
  }

  totalBoxes() { return this.R * this.C; }
  boxesLeft() { return this.owner.reduce((n, o) => n + (o < 0 ? 1 : 0), 0); }
}

/**
 * Decompose the undrawn part of the board into components ("chains" and
 * "loops") — the structure the whole endgame turns on.
 * Two unclaimed boxes are joined when the wall between them is not yet drawn.
 * A box with an undrawn outer wall is joined to the ground (the page edge).
 */
export function analyse(game) {
  const { R, C } = game;
  const N = R * C;
  const deg = new Int8Array(N);         // undrawn walls per box
  const openToGround = new Uint8Array(N);
  const alive = new Uint8Array(N);

  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; c++) {
      const i = r * C + c;
      if (game.owner[i] >= 0) continue;
      alive[i] = 1;
      const e = game.boxEdges(r, c);
      let d = 0;
      for (const idx of e) if (!game.edges[idx]) d++;
      deg[i] = d;
      if (r === 0 && !game.edges[game.hIndex(0, c)]) openToGround[i] = 1;
      if (r === R - 1 && !game.edges[game.hIndex(R, c)]) openToGround[i] = 1;
      if (c === 0 && !game.edges[game.vIndex(r, 0)]) openToGround[i] = 1;
      if (c === C - 1 && !game.edges[game.vIndex(r, C)]) openToGround[i] = 1;
    }
  }

  const seen = new Uint8Array(N);
  const comps = [];
  const neighbours = (i) => {
    const r = Math.floor(i / C), c = i % C;
    const out = [];
    if (r > 0 && !game.edges[game.hIndex(r, c)]) out.push((r - 1) * C + c);
    if (r < R - 1 && !game.edges[game.hIndex(r + 1, c)]) out.push((r + 1) * C + c);
    if (c > 0 && !game.edges[game.vIndex(r, c)]) out.push(r * C + (c - 1));
    if (c < C - 1 && !game.edges[game.vIndex(r, c + 1)]) out.push(r * C + (c + 1));
    return out.filter((j) => alive[j]);
  };

  for (let i = 0; i < N; i++) {
    if (!alive[i] || seen[i]) continue;
    const stack = [i];
    seen[i] = 1;
    const cells = [];
    while (stack.length) {
      const cur = stack.pop();
      cells.push(cur);
      for (const j of neighbours(cur)) if (!seen[j]) { seen[j] = 1; stack.push(j); }
    }
    let ground = 0, maxDeg = 0;
    for (const cell of cells) {
      if (openToGround[cell]) ground++;
      if (deg[cell] > maxDeg) maxDeg = deg[cell];
    }
    // A loop is a closed ring: every box has exactly two open walls and none
    // of them opens onto the page edge.
    const isLoop = ground === 0 && cells.every((x) => deg[x] === 2);
    const simple = cells.every((x) => deg[x] <= 2);
    comps.push({
      cells,
      size: cells.length,
      type: isLoop ? 'loop' : simple ? 'chain' : 'complex',
      ground,
      maxDeg,
      openings: cells.filter((x) => openToGround[x]).length,
    });
  }
  return comps;
}

/** Long chains (3+) and loops are what decide the game. */
export function chainCount(comps) {
  return comps.filter((k) => (k.type === 'chain' && k.size >= 3) || k.type === 'loop').length;
}

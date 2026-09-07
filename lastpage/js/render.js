/* LAST PAGE — the board.
 *
 * One canvas, two worlds.
 *   paper — ruled sheet, ballpoint ink, lines that wobble the way a hand does
 *   neon  — glass and glow, the same game with the lights turned down
 */

const PALETTES = {
  paper: {
    bg: 'transparent',
    dot: '#3a4a6b',
    dotHalo: 'rgba(58,74,107,0.13)',
    ghost: 'rgba(40,60,110,0.32)',
    players: ['#1d3c8f', '#c0392b', '#1a7a46', '#6b3fa0'],
    fills: ['rgba(29,60,143,0.13)', 'rgba(192,57,43,0.13)', 'rgba(26,122,70,0.13)', 'rgba(107,63,160,0.13)'],
    initial: ['#1d3c8f', '#c0392b', '#1a7a46', '#6b3fa0'],
    lineWidth: 3.4,
    font: '"Caveat", "Bradley Hand", "Segoe Print", cursive',
    wobble: 1,
    glow: 0,
  },
  neon: {
    bg: 'transparent',
    dot: '#5f6d8c',
    dotHalo: 'rgba(120,160,255,0.10)',
    ghost: 'rgba(150,200,255,0.30)',
    players: ['#22e0ff', '#ff3ba7', '#9dff3b', '#ffb020'],
    fills: ['rgba(34,224,255,0.16)', 'rgba(255,59,167,0.16)', 'rgba(157,255,59,0.16)', 'rgba(255,176,32,0.16)'],
    initial: ['#7ef0ff', '#ff86c8', '#c4ff86', '#ffd27a'],
    lineWidth: 4.2,
    font: '"Space Grotesk", ui-sans-serif, system-ui, sans-serif',
    wobble: 0,
    glow: 14,
  },
};

export const paletteFor = (skin) => PALETTES[skin] || PALETTES.paper;

/* A fixed wobble per edge, so a hand-drawn line stays where it was drawn. */
function hash(n) {
  let h = (n ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export class Board {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.game = null;
    this.skin = opts.skin || 'paper';
    this.motion = opts.motion !== false;
    this.hover = -1;
    this.lastMove = -1;
    this.locked = false;
    this.particles = [];
    this.flashes = new Map();     // boxIndex -> { t, player }
    this.inkAnim = new Map();     // edge -> progress 0..1
    this.shake = 0;
    this.raf = null;
    this.onPlay = null;
    this._loop = this._loop.bind(this);
    this._bind();
  }

  setGame(game) {
    this.game = game;
    this.hover = -1;
    this.lastMove = -1;
    this.particles.length = 0;
    this.flashes.clear();
    this.inkAnim.clear();
    for (let i = 0; i < game.E; i++) if (game.edges[i]) this.inkAnim.set(i, 1);
    this.resize();
  }

  setSkin(skin) { this.skin = skin; this.draw(); }
  setMotion(on) { this.motion = on; }

  /* --------------------------------------------------------- geometry --- */

  layout() {
    const g = this.game;
    const w = this.canvas.clientWidth || 320;
    const h = this.canvas.clientHeight || 320;
    const pad = Math.max(26, Math.min(w, h) * 0.085);
    const cell = Math.min((w - pad * 2) / g.C, (h - pad * 2) / g.R);
    const bw = cell * g.C, bh = cell * g.R;
    return { cell, ox: (w - bw) / 2, oy: (h - bh) / 2, w, h };
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.draw();
  }

  edgePoints(idx) {
    const { cell, ox, oy } = this.layout();
    const g = this.game.edgeGeom(idx);
    return {
      x1: ox + g.x1 * cell, y1: oy + g.y1 * cell,
      x2: ox + g.x2 * cell, y2: oy + g.y2 * cell,
    };
  }

  /** Nearest undrawn wall to a pointer, if it is close enough to mean it. */
  hitTest(px, py) {
    const g = this.game;
    if (!g) return -1;
    const { cell } = this.layout();
    const limit = Math.min(cell * 0.46, 34);
    let best = -1, bestD = Infinity;
    for (let i = 0; i < g.E; i++) {
      if (g.edges[i]) continue;
      const p = this.edgePoints(i);
      const d = distToSegment(px, py, p.x1, p.y1, p.x2, p.y2);
      if (d < bestD) { bestD = d; best = i; }
    }
    return bestD <= limit ? best : -1;
  }

  /* ----------------------------------------------------------- events --- */

  _bind() {
    const c = this.canvas;
    const pos = (ev) => {
      const r = c.getBoundingClientRect();
      const t = ev.touches ? ev.touches[0] : ev;
      return { x: t.clientX - r.left, y: t.clientY - r.top };
    };
    c.addEventListener('pointermove', (ev) => {
      if (this.locked || !this.game) return;
      const { x, y } = pos(ev);
      const h = this.hitTest(x, y);
      if (h !== this.hover) { this.hover = h; c.style.cursor = h >= 0 ? 'pointer' : 'default'; this.draw(); }
    });
    c.addEventListener('pointerleave', () => { this.hover = -1; this.draw(); });
    c.addEventListener('pointerdown', (ev) => {
      if (this.locked || !this.game) return;
      ev.preventDefault();
      const { x, y } = pos(ev);
      const h = this.hitTest(x, y);
      if (h >= 0 && this.onPlay) this.onPlay(h);
    });
    window.addEventListener('resize', () => this.resize());
  }

  /* --------------------------------------------------------- feedback --- */

  /** Called after a move lands, whoever made it. */
  commit(edge, boxes, player) {
    this.lastMove = edge;
    this.inkAnim.set(edge, this.motion ? 0 : 1);
    for (const b of boxes) {
      this.flashes.set(b, { t: 0, player });
      if (this.motion) this.burst(b, player);
    }
    if (boxes.length >= 3 && this.motion) this.shake = Math.min(9, 3 + boxes.length);
    this.start();
  }

  burst(boxIndex, player) {
    const g = this.game;
    const { cell, ox, oy } = this.layout();
    const r = Math.floor(boxIndex / g.C), c = boxIndex % g.C;
    const cx = ox + (c + 0.5) * cell, cy = oy + (r + 0.5) * cell;
    const pal = paletteFor(this.skin);
    const n = this.skin === 'neon' ? 16 : 9;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 0.6 + Math.random() * 2.6;
      this.particles.push({
        x: cx, y: cy,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.6,
        life: 1, size: 1.4 + Math.random() * 2.6,
        color: pal.players[player % 4],
      });
    }
  }

  start() {
    if (this.raf) return;
    this.raf = requestAnimationFrame(this._loop);
  }

  _loop() {
    this.raf = null;
    let busy = false;

    for (const [k, v] of this.inkAnim) {
      if (v < 1) { this.inkAnim.set(k, Math.min(1, v + 0.16)); busy = true; }
    }
    for (const [k, f] of this.flashes) {
      f.t += 0.045;
      if (f.t >= 1) this.flashes.delete(k); else busy = true;
    }
    if (this.particles.length) {
      busy = true;
      this.particles = this.particles.filter((p) => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.14; p.vx *= 0.985; p.life -= 0.028;
        return p.life > 0;
      });
    }
    if (this.shake > 0.2) { this.shake *= 0.82; busy = true; } else this.shake = 0;

    this.draw();
    if (busy) this.start();
  }

  /* ------------------------------------------------------------- draw --- */

  draw() {
    const g = this.game;
    if (!g) return;
    const ctx = this.ctx;
    const pal = paletteFor(this.skin);
    const { cell, ox, oy, w, h } = this.layout();
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    if (this.shake > 0.2) {
      ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    }

    // claimed boxes
    for (let r = 0; r < g.R; r++) {
      for (let c = 0; c < g.C; c++) {
        const i = r * g.C + c;
        const o = g.owner[i];
        if (o < 0) continue;
        const x = ox + c * cell, y = oy + r * cell;
        const flash = this.flashes.get(i);
        const pop = flash ? 1 + Math.sin(flash.t * Math.PI) * 0.09 : 1;

        ctx.save();
        ctx.translate(x + cell / 2, y + cell / 2);
        ctx.scale(pop, pop);
        ctx.translate(-cell / 2, -cell / 2);

        ctx.fillStyle = pal.fills[o % 4];
        if (this.skin === 'neon') {
          const grd = ctx.createLinearGradient(0, 0, cell, cell);
          grd.addColorStop(0, pal.fills[o % 4]);
          grd.addColorStop(1, 'rgba(255,255,255,0.02)');
          ctx.fillStyle = grd;
        }
        ctx.fillRect(cell * 0.06, cell * 0.06, cell * 0.88, cell * 0.88);

        if (flash) {
          ctx.globalAlpha = (1 - flash.t) * 0.55;
          ctx.fillStyle = pal.players[o % 4];
          ctx.fillRect(cell * 0.06, cell * 0.06, cell * 0.88, cell * 0.88);
          ctx.globalAlpha = 1;
        }

        const label = (this.initials && this.initials[o]) || String(o + 1);
        ctx.fillStyle = pal.initial[o % 4];
        ctx.font = `${this.skin === 'paper' ? '' : '700 '}${Math.round(cell * (this.skin === 'paper' ? 0.62 : 0.42))}px ${pal.font}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.globalAlpha = 0.92;
        if (this.skin === 'paper') {
          ctx.save();
          ctx.translate(cell / 2, cell / 2);
          ctx.rotate((hash(i * 31) - 0.5) * 0.28);
          ctx.fillText(label, 0, 0);
          ctx.restore();
        } else {
          ctx.shadowColor = pal.players[o % 4];
          ctx.shadowBlur = 10;
          ctx.fillText(label, cell / 2, cell / 2);
          ctx.shadowBlur = 0;
        }
        ctx.globalAlpha = 1;
        ctx.restore();
      }
    }

    // the wall under the pointer
    if (this.hover >= 0 && !g.edges[this.hover] && !this.locked) {
      const p = this.edgePoints(this.hover);
      ctx.save();
      ctx.strokeStyle = pal.ghost;
      ctx.lineWidth = pal.lineWidth;
      ctx.lineCap = 'round';
      ctx.setLineDash([5, 6]);
      ctx.beginPath();
      ctx.moveTo(p.x1, p.y1);
      ctx.lineTo(p.x2, p.y2);
      ctx.stroke();
      ctx.restore();
    }

    // drawn walls
    for (let i = 0; i < g.E; i++) {
      if (!g.edges[i]) continue;
      const owner = g.edges[i] - 1;
      const prog = this.inkAnim.has(i) ? this.inkAnim.get(i) : 1;
      this._stroke(i, pal.players[owner % 4], pal, prog, i === this.lastMove);
    }

    // dots
    ctx.save();
    for (let r = 0; r <= g.R; r++) {
      for (let c = 0; c <= g.C; c++) {
        const x = ox + c * cell, y = oy + r * cell;
        const rad = Math.max(2.1, cell * 0.055);
        if (this.skin === 'neon') {
          ctx.fillStyle = pal.dotHalo;
          ctx.beginPath(); ctx.arc(x, y, rad * 2.6, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = pal.dot;
        ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();

    // sparks
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      if (this.skin === 'neon') { ctx.shadowColor = p.color; ctx.shadowBlur = 12; }
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  _stroke(idx, color, pal, prog, isLast) {
    const ctx = this.ctx;
    const p = this.edgePoints(idx);
    const t = Math.max(0.04, prog);
    const x2 = p.x1 + (p.x2 - p.x1) * t;
    const y2 = p.y1 + (p.y2 - p.y1) * t;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineWidth = pal.lineWidth * (isLast ? 1.18 : 1);
    if (pal.glow) { ctx.shadowColor = color; ctx.shadowBlur = isLast ? pal.glow * 1.6 : pal.glow; }

    if (pal.wobble) {
      // two passes with a little jitter — a ballpoint never runs straight
      const j = pal.wobble;
      for (let pass = 0; pass < 2; pass++) {
        ctx.globalAlpha = pass === 0 ? 0.95 : 0.4;
        ctx.beginPath();
        const steps = 5;
        for (let s = 0; s <= steps; s++) {
          const f = s / steps;
          const hx = hash(idx * 97 + s * 13 + pass * 7) - 0.5;
          const hy = hash(idx * 41 + s * 29 + pass * 11) - 0.5;
          const x = p.x1 + (x2 - p.x1) * f + hx * j * 2.1;
          const y = p.y1 + (y2 - p.y1) * f + hy * j * 2.1;
          if (s === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    } else {
      ctx.beginPath();
      ctx.moveTo(p.x1, p.y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = dx * dx + dy * dy;
  let t = len ? ((px - x1) * dx + (py - y1) * dy) / len : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx, cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

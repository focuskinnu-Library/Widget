/* LAST PAGE — the sound of a classroom.
 * All synthesised: no files to download, nothing to wait for.
 */

let ctx = null;
let master = null;
let enabled = true;

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function setEnabled(on) { enabled = on; }
export const isEnabled = () => enabled;
export function unlock() { if (enabled) ac(); }

function env(node, t0, a, d, peak = 1) {
  node.gain.setValueAtTime(0.0001, t0);
  node.gain.exponentialRampToValueAtTime(peak, t0 + a);
  node.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
}

function noise(dur) {
  const c = ac();
  const n = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  return src;
}

/** Pen on paper. */
export function scratch() {
  if (!enabled || !ac()) return;
  const c = ctx, t = c.currentTime;
  const src = noise(0.13);
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(1900 + Math.random() * 900, t);
  bp.Q.value = 1.4;
  const g = c.createGain();
  env(g, t, 0.006, 0.1, 0.16);
  src.connect(bp); bp.connect(g); g.connect(master);
  src.start(t); src.stop(t + 0.16);
}

/** A box closes. Rises with the combo. */
export function pop(step = 0) {
  if (!enabled || !ac()) return;
  const c = ctx, t = c.currentTime;
  const o = c.createOscillator();
  o.type = 'triangle';
  const base = 420 * Math.pow(1.085, Math.min(step, 14));
  o.frequency.setValueAtTime(base, t);
  o.frequency.exponentialRampToValueAtTime(base * 1.7, t + 0.09);
  const g = c.createGain();
  env(g, t, 0.005, 0.14, 0.22);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + 0.2);
}

/** The double-cross: two boxes left on the desk on purpose. */
export function clever() {
  if (!enabled || !ac()) return;
  const c = ctx, t = c.currentTime;
  [660, 880, 1320].forEach((f, i) => {
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f, t + i * 0.07);
    const g = c.createGain();
    env(g, t + i * 0.07, 0.008, 0.18, 0.14);
    o.connect(g); g.connect(master);
    o.start(t + i * 0.07); o.stop(t + i * 0.07 + 0.24);
  });
}

/** End of period. */
export function bell(happy = true) {
  if (!enabled || !ac()) return;
  const c = ctx, t = c.currentTime;
  const notes = happy ? [523, 659, 784, 1047] : [392, 349, 294];
  notes.forEach((f, i) => {
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f, t + i * 0.11);
    const g = c.createGain();
    env(g, t + i * 0.11, 0.01, 0.42, 0.2);
    o.connect(g); g.connect(master);
    o.start(t + i * 0.11); o.stop(t + i * 0.11 + 0.6);
  });
}

export function tap() {
  if (!enabled || !ac()) return;
  const c = ctx, t = c.currentTime;
  const o = c.createOscillator();
  o.type = 'square';
  o.frequency.setValueAtTime(320, t);
  const g = c.createGain();
  env(g, t, 0.004, 0.045, 0.07);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + 0.08);
}

/** Somebody at the back has an opinion. */
export function murmur() {
  if (!enabled || !ac()) return;
  const c = ctx, t = c.currentTime;
  const src = noise(0.5);
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(520, t);
  bp.frequency.linearRampToValueAtTime(320, t + 0.5);
  bp.Q.value = 3;
  const g = c.createGain();
  env(g, t, 0.12, 0.4, 0.06);
  src.connect(bp); bp.connect(g); g.connect(master);
  src.start(t); src.stop(t + 0.55);
}

/* LAST PAGE — everything the notebook remembers.
 * One key in localStorage. No account, no server needed for any of it.
 */

const KEY = 'lastpage.v1';

const blank = () => ({
  version: 1,
  name: '',
  skin: 'paper',
  sound: true,
  motion: true,
  ink: 0,
  played: 0,
  won: 0,
  lost: 0,
  drawn: 0,
  streak: 0,
  bestStreak: 0,
  bestCombo: 0,
  doubleCrosses: 0,
  ladder: {},          // rivalId -> { stars, best, beaten, tries }
  badges: {},          // badgeId -> ISO date
  prizes: [],          // prize ids, in the order they were won
  days: [],            // ISO dates played, for the attendance badge
  daily: {},           // 'YYYY-MM-DD' -> { ink, margin, seconds, done }
  results: [],         // recent games, newest first
  lastSeen: null,
});

let state = null;

export function load() {
  if (state) return state;
  try {
    const raw = localStorage.getItem(KEY);
    state = raw ? { ...blank(), ...JSON.parse(raw) } : blank();
  } catch {
    state = blank();
  }
  return state;
}

export function save() {
  if (!state) return;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ }
}

export function update(fn) {
  const s = load();
  fn(s);
  save();
  return s;
}

export const profile = () => load();
export const hasName = () => !!load().name;

export function setName(name) {
  return update((s) => { s.name = String(name || '').trim().slice(0, 16); });
}

export function setSkin(skin) {
  return update((s) => { s.skin = skin; });
}

export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function markDay() {
  return update((s) => {
    const t = today();
    if (!s.days.includes(t)) s.days.push(t);
    s.days = s.days.slice(-90);
    s.lastSeen = t;
  });
}

/** Consecutive days ending today. */
export function attendance() {
  const s = load();
  const set = new Set(s.days);
  let n = 0;
  const d = new Date();
  for (;;) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!set.has(key)) break;
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export function awardBadge(id) {
  let fresh = false;
  update((s) => {
    if (!s.badges[id]) { s.badges[id] = new Date().toISOString(); fresh = true; }
  });
  return fresh;
}

export function addPrize(id) {
  update((s) => { if (!s.prizes.includes(id)) s.prizes.push(id); });
}

/** Record a finished game. Returns the badges newly earned. */
export function recordResult(r) {
  const earned = [];
  update((s) => {
    s.played++;
    if (r.won) { s.won++; s.streak++; if (s.streak > s.bestStreak) s.bestStreak = s.streak; }
    else if (r.drawn) { s.drawn++; }
    else { s.lost++; s.streak = 0; }
    s.ink += r.ink || 0;
    if ((r.bestCombo || 0) > s.bestCombo) s.bestCombo = r.bestCombo;
    s.doubleCrosses += r.doubleCrosses || 0;
    s.results.unshift({ ...r, at: Date.now() });
    s.results = s.results.slice(0, 40);
  });
  const s = load();
  if (r.won && s.won === 1) earned.push('first');
  if ((r.doubleCrosses || 0) > 0) earned.push('cross');
  if ((r.bestCombo || 0) >= 8) earned.push('chain');
  if (r.won && r.conceded === 0) earned.push('clean');
  if (r.won && r.margin === 1) earned.push('buzzer');
  if (r.won && r.level === 'tough') earned.push('giant');
  if (s.streak >= 3) earned.push('streak3');
  if (attendance() >= 7) earned.push('streak7');
  if (r.mode === 'daily') earned.push('daily');
  return earned.filter(awardBadge);
}

export function recordLadder(rivalId, { stars, margin, won }) {
  update((s) => {
    const cur = s.ladder[rivalId] || { stars: 0, best: -99, beaten: false, tries: 0 };
    cur.tries++;
    if (won) cur.beaten = true;
    if (stars > cur.stars) cur.stars = stars;
    if (margin > cur.best) cur.best = margin;
    s.ladder[rivalId] = cur;
  });
}

export const ladderProgress = () => {
  const s = load();
  return Object.values(s.ladder).filter((x) => x.beaten).length;
};

export const totalStars = () => {
  const s = load();
  return Object.values(s.ladder).reduce((n, x) => n + (x.stars || 0), 0);
};

/** The next rival you have not beaten. */
export function nextRivalId(rivals) {
  const s = load();
  for (const r of rivals) if (!s.ladder[r.id]?.beaten) return r.id;
  return null;
}

export function isUnlocked(rivalId, rivals) {
  const s = load();
  const i = rivals.findIndex((r) => r.id === rivalId);
  if (i <= 0) return true;
  return !!s.ladder[rivals[i - 1].id]?.beaten;
}

export function recordDaily(key, entry) {
  update((s) => { s.daily[key] = entry; });
}

export const dailyDone = (key) => !!load().daily[key]?.done;

export function reset() {
  state = blank();
  save();
  return state;
}

/* ------------------------------------------------------ resume a game ---- */

const RESUME = 'lastpage.resume.v1';

export function saveResume(payload) {
  try { localStorage.setItem(RESUME, JSON.stringify(payload)); } catch { /* ignore */ }
}
export function loadResume() {
  try { return JSON.parse(localStorage.getItem(RESUME) || 'null'); } catch { return null; }
}
export function clearResume() {
  try { localStorage.removeItem(RESUME); } catch { /* ignore */ }
}

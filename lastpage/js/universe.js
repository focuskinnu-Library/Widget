/* LAST PAGE — the universe.
 *
 * Class IX-B, Nutan Vidya Mandir, monsoon term. Marks are decided in the front
 * of the notebook. Rank is decided on the last page.
 */

export const SCHOOL = {
  name: 'Nutan Vidya Mandir',
  klass: 'IX-B',
  term: 'monsoon term',
  tagline: 'the last page of the notebook was never blank',
};

/* Boards get bigger as you move back through the class. */
export const BOARDS = {
  small:  { rows: 4, cols: 4, label: '4 × 4' },
  medium: { rows: 5, cols: 5, label: '5 × 5' },
  wide:   { rows: 5, cols: 6, label: '5 × 6' },
  big:    { rows: 6, cols: 6, label: '6 × 6' },
  huge:   { rows: 6, cols: 7, label: '6 × 7' },
};

export const ROWS = [
  { id: 'front',  name: 'Front Bench',  note: 'where the answers are copied from' },
  { id: 'middle', name: 'Middle Rows',  note: 'where the notebook changes hands' },
  { id: 'back',   name: 'Back Bench',   note: 'where the last page is law' },
  { id: 'staff',  name: 'The Staffroom', note: 'you were warned' },
];

/**
 * Twelve rivals between you and the Golden Nib.
 * `flair` is a small handicap knob: the bot occasionally plays a rung below
 * its level, which keeps early rivals human and late rivals merciless.
 */
export const RIVALS = [
  { id: 1,  name: 'Pinky',   row: 'front',  level: 'easy',  slip: 0.45, board: 'small',
    desc: 'borrowed your eraser in June, still has it',
    taunt: ['i go first, i always go first', 'wait wait wait, let me think'],
    lose:  ['okay one more, best of three', 'my pen was not working'],
    win:   ['HA! told you', 'that is my square, write my name'],
    prize: { id: 'chalk',   name: 'Chalk Stub',     glyph: '▱' } },

  { id: 2,  name: 'Golu',    row: 'front',  level: 'easy',  slip: 0.3,  board: 'small',
    desc: 'eats during second period, shares never',
    taunt: ['finish fast, lunch break is coming', 'you draw so slow'],
    lose:  ['i was hungry', 'again after tiffin'],
    win:   ['now give me your samosa', 'easy easy'],
    prize: { id: 'band',    name: 'Rubber Band',    glyph: '◠' } },

  { id: 3,  name: 'Tinku',   row: 'front',  level: 'easy',  slip: 0.12, board: 'wide',
    desc: 'carved his name into the desk in class six',
    taunt: ['this desk is mine, so this page is mine', 'watch the corner'],
    lose:  ['the lines were crooked', 'rematch, bigger page'],
    win:   ['carve it in, i won', 'front bench champion'],
    prize: { id: 'sharp',   name: 'Sharpener',      glyph: '◺' } },

  { id: 4,  name: 'Meera',   row: 'middle', level: 'mild',  slip: 0.25, board: 'medium',
    desc: 'topper, but only in maths, and she will remind you',
    taunt: ['there are twenty five boxes, i need thirteen', 'you left me a chain'],
    lose:  ['i miscounted, that is all', 'the parity was against me'],
    win:   ['count the chains next time', 'thirteen. as calculated'],
    prize: { id: 'refill',  name: 'Blue Refill',    glyph: '│' } },

  { id: 5,  name: 'Sam',     row: 'middle', level: 'mild',  slip: 0.15, board: 'medium',
    desc: 'owns the four colour pen and clicks all four in your ear',
    taunt: ['click. click. your turn', 'red for my boxes, obviously'],
    lose:  ['blue was jammed', 'i want green next time'],
    win:   ['four colours, one winner', 'click click click'],
    prize: { id: 'fourcol', name: 'Four Colour Pen', glyph: '✦' } },

  { id: 6,  name: 'Ritu',    row: 'middle', level: 'mild',  slip: 0.08, board: 'medium',
    desc: 'writes with both hands so nobody can see the page',
    taunt: ['left hand today', 'you are giving me everything'],
    lose:  ['wrong hand', 'switch sides and again'],
    win:   ['both hands, both halves', 'that was never yours'],
    prize: { id: 'compass', name: 'Compass',        glyph: '⊙' } },

  { id: 7,  name: 'Faiz',    row: 'middle', level: 'mild',  slip: 0.0,  board: 'wide',
    desc: 'brings graph paper from home, sells it at two rupees a sheet',
    taunt: ['proper squares today, no freehand', 'i have another sheet, relax'],
    lose:  ['keep the sheet', 'that one is on the house'],
    win:   ['two rupees please', 'graph paper never lies'],
    prize: { id: 'graph',   name: 'Graph Sheet',    glyph: '▦' } },

  { id: 8,  name: 'Bunty',   row: 'back',   level: 'tough', slip: 0.35, board: 'wide',
    desc: 'undefeated at pen fight, thinks that counts here',
    taunt: ['one flick and your pen is off the desk', 'boxes, pens, same thing'],
    lose:  ['this is not my game', 'bring a pen and fight properly'],
    win:   ['told you. same thing', 'off the desk'],
    prize: { id: 'scale',   name: 'Steel Scale',    glyph: '▬' } },

  { id: 9,  name: 'Neha',    row: 'back',   level: 'tough', slip: 0.2,  board: 'big',
    desc: 'counts the chains out loud just to put you off',
    taunt: ['three long chains. odd. good for me', 'do not open that one'],
    lose:  ['i counted wrong, out loud, in front of everyone', 'one chain short'],
    win:   ['three, five, and the loop. i said it at the start', 'parity, that is all it is'],
    prize: { id: 'gel',     name: 'Gel Pen',        glyph: '✒' } },

  { id: 10, name: 'Vicky',   row: 'back',   level: 'tough', slip: 0.08, board: 'big',
    desc: 'has never lost a last page, and the whole class knows it',
    taunt: ['sit properly, this takes a while', 'you already lost, you just cannot see it'],
    lose:  ['first time. do not tell anyone', 'nobody saw that'],
    win:   ['still undefeated', 'next'],
    prize: { id: 'geobox',  name: 'Geometry Box',   glyph: '⬒' } },

  { id: 11, name: "Miss D'Souza", row: 'staff', level: 'tough', slip: 0.0, board: 'big',
    desc: 'confiscated the notebook in March and finished the game herself',
    taunt: ['I have been playing this since before you were born', 'Hands where I can see them'],
    lose:  ['Well played. Take the notebook back', 'You may sit'],
    win:   ['The bell does not save you', 'Detention, and the last page is mine'],
    prize: { id: 'notebook', name: 'Confiscated Notebook', glyph: '❏' } },

  { id: 12, name: 'The Senior', row: 'staff', level: 'tough', slip: 0.0, board: 'huge',
    desc: 'left school in 2003. the record on the back wall is still his',
    taunt: ['forty two boxes. that was the record', 'i have seen this page before'],
    lose:  ['the record is yours now. write your name on the wall', 'took you long enough'],
    win:   ['still 2003', 'come back when you can count'],
    prize: { id: 'goldnib', name: 'The Golden Nib', glyph: '✷' } },
];

export const rivalById = (id) => RIVALS.find((r) => r.id === id);

/* Ranks are earned in Ink, the only currency the last page recognises. */
export const RANKS = [
  { min: 0,     name: 'Backbencher',   glyph: '✎' },
  { min: 300,   name: 'Monitor',       glyph: '✐' },
  { min: 900,   name: 'Class Rep',     glyph: '✒' },
  { min: 2000,  name: 'Topper',        glyph: '★' },
  { min: 4000,  name: 'School Captain',glyph: '✷' },
  { min: 8000,  name: 'Legend of the Last Page', glyph: '☗' },
];

export function rankFor(ink) {
  let out = RANKS[0];
  for (const r of RANKS) if (ink >= r.min) out = r;
  return out;
}

export function nextRank(ink) {
  return RANKS.find((r) => r.min > ink) || null;
}

/* Badges — the small reasons to start one more game. */
export const BADGES = [
  { id: 'first',    name: 'First Blood',    desc: 'win your first game',                 glyph: '✔' },
  { id: 'cross',    name: 'Double Cross',   desc: 'decline two boxes to take control',   glyph: '✕' },
  { id: 'chain',    name: 'Chain Reaction', desc: 'take 8 boxes in one turn',            glyph: '⛓' },
  { id: 'clean',    name: 'Clean Sheet',    desc: 'win without conceding a single box',  glyph: '○' },
  { id: 'buzzer',   name: 'Buzzer Beater',  desc: 'win by exactly one box',              glyph: '!' },
  { id: 'giant',    name: 'Giant Killer',   desc: 'beat a Board Exam bench',             glyph: '⚑' },
  { id: 'streak3',  name: 'Hat-trick',      desc: 'win three in a row',                  glyph: '³' },
  { id: 'streak7',  name: 'Full Attendance',desc: 'play seven days running',             glyph: '☰' },
  { id: 'ladder',   name: 'Golden Nib',     desc: 'clear all twelve benches',            glyph: '✷' },
  { id: 'daily',    name: 'Bell Ringer',    desc: 'finish a Daily Page',                 glyph: '🔔' },
];

/* The names on the back wall. Fiction, and labelled as such in the app. */
export const HALL_OF_FAME = [
  { name: 'The Senior',   ink: 42000, note: 'batch of 2003 · never beaten' },
  { name: "Miss D'Souza", ink: 31000, note: 'staffroom · confiscated 41 notebooks' },
  { name: 'Vicky',        ink: 19500, note: 'back bench · undefeated until you' },
  { name: 'Neha',         ink: 15200, note: 'counts chains out loud' },
  { name: 'Bunty',        ink: 11800, note: 'pen fight champion, 1999–2002' },
];

/**
 * Ink: the score that feeds the world board.
 * Winning matters most, then the margin, then who you beat and how big the page
 * was. Speed and combos are the garnish that make you want one more.
 */
export function inkFor({ won, margin, level, boxes, bestCombo, doubleCrosses, seconds, opponent }) {
  const levelMul = { easy: 1, mild: 1.6, tough: 2.6 }[level] || 1;
  const oppMul = { bot: 1, human: 1.15, online: 1.3, daily: 1.4 }[opponent] || 1;
  const sizeMul = 0.7 + boxes / 50;

  let ink = 0;
  if (won) ink += 100;
  ink += Math.max(0, margin) * 12;
  ink += (bestCombo || 0) * 6;
  ink += (doubleCrosses || 0) * 25;
  if (won && seconds > 0) ink += Math.max(0, Math.round(120 - seconds / 2));

  ink = ink * levelMul * sizeMul * oppMul;
  return Math.max(won ? 25 : 5, Math.round(ink));
}

export function starsFor(margin, boxes, conceded) {
  if (margin <= 0) return 0;
  if (conceded === 0) return 3;
  if (margin >= Math.max(6, Math.round(boxes * 0.3))) return 3;
  if (margin >= Math.max(3, Math.round(boxes * 0.14))) return 2;
  return 1;
}

/* Voices from around the room, for the moments that deserve one. */
export const CROWD = {
  combo:      ['ohhoooo', 'chain chal gayi', 'stop him', 'ek aur', 'that is five'],
  doubleCross:['ooooo clever', 'he left two', 'trap', 'maan gaye'],
  lost:       ['gaya', 'ouch', 'that was the whole chain'],
  won:        ['bell bajne wali hai', 'write your name in it', 'undefeated'],
  close:      ['one box difference', 'nobody breathe', 'last page decider'],
};

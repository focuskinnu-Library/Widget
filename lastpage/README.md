# Last Page

The squares game from the back of the notebook. Dots, lines, boxes, and your
initial in every square you took.

`lastpage/index.html` is the whole game. It is a static site — no build step, no
bundler, no framework. `lastpage/server/server.mjs` is optional and adds exactly
two things: the worldwide ranking and the daily page board.

## The universe

Class IX-B, Nutan Vidya Mandir, monsoon term. Marks are decided in the front of
the notebook. Rank is decided on the last page.

Twelve rivals sit between you and the Golden Nib, four rows deep — Pinky who
borrowed your eraser in June, Bunty who is undefeated at pen fight and thinks
that counts here, Neha who counts the chains out loud to put you off, Miss
D'Souza who confiscated the notebook in March and finished the game herself, and
The Senior, who left in 2003 and whose record is still on the back wall. Each
one taunts you before, and has something to say after. Each one drops a piece of
stationery on your shelf when you beat them.

## Why this game

Every "90s Indian classroom games" list puts Dots & Boxes next to pen fight
itself, and unlike most of that list it has a real ceiling. Elwyn Berlekamp
wrote a book about it. The rules take one line; the endgame is a parity problem
about long chains, and the winning move is usually to *refuse* two free boxes so
your opponent is forced to open the next chain for you. That gap between "I know
the rules" and "I know the game" is the whole product.

## The three benches

| Bench | Called | Plays |
|---|---|---|
| Easy | **Recess** | Grabs whatever is going, wanders otherwise. |
| Mild | **Unit Test** | Never hands you a box. Loses the chain fight, because it does not know there is one. |
| Tough | **Board Exam** | Counts chains, plays for parity, declines boxes to keep control, and finishes perfectly. |

Board Exam is not a bigger search — it is the actual theory:

- **Exact endgame.** Once the position is loony (every move gives something
  away), the remaining chains and loops are solved exactly by the classic
  recursion: open a component and your opponent either takes it all and opens
  next, or takes all-but-two and hands the opening back to you.
- **The double-cross.** With boxes on offer it compares "take all" against "take
  all but two", using that solver on what is left, and declines when declining
  wins.
- **Parity by playing it out.** Quiet moves never score, so mid-game it shuffles
  through random quiet lines to the point the board turns loony, then scores
  that with the exact solver. Because quiet moves strictly alternate the turn,
  this samples the chain-parity fight honestly instead of guessing at it.
- **A perfect finish.** Under 16 walls left it just solves the position with
  alpha-beta.

Measured over even series with the opening alternated (`node lastpage/strength.mjs`):

```
Unit Test vs Recess ......... 21–0
Board Exam vs Unit Test 4×4 . 19–1
Board Exam vs Unit Test 5×5 . 12–4
worst move, 6×6 ............. 344ms   (avg 27ms)
```

Ladder rivals also carry a `slip` value — a chance of playing one rung below
their level — so bench 1 feels like a classmate and bench 12 feels like a wall.

## The two skins

One toggle, top right of the home page, remembered across visits.

- **Old school** — a ruled sheet with a red margin, a blue ballpoint, sellotape
  on the corners of the board, handwriting, and lines that wobble the way a hand
  does. Each line's wobble is hashed from its index, so it stays where it was
  drawn.
- **Trendy** — glass and glow on near-black, a grid that hums, neon strokes with
  bloom, particle bursts and a screen shake when a chain cashes.

Both are the same canvas and the same game. Nothing about play changes.

## Ways to play

- **Class Championship** — the twelve-bench ladder, 1–3 stars per bench, prizes
  on a shelf.
- **Daily Page** — one board seeded from the date, the same for everyone in the
  world, one attempt, its own leaderboard.
- **Quick Match** — pick a bench, a board size, and who draws first.
- **Pass & Play** — 2 to 4 people, one screen, one notebook.
- **Invite a Friend** — a room code and a link. Peer to peer over WebRTC, so it
  works from any static host with no server of ours in the middle. 2 to 4
  players; the host's tab holds the room.

## Reasons to start one more

Ink is the score that feeds the world board: winning first, then the margin,
then how tough the bench was and how big the page was, with combos, double
crosses and speed on top. Ink buys ranks, from Backbencher up to Legend of the
Last Page. Ten badges, including one for declining two boxes to take control —
which is the moment somebody stops playing dots and starts playing this game.

## Naming, leaving, and coming back

You pick a name before anything else and it stays on the device. No password, no
email, nothing sent anywhere unless a ranking endpoint is configured.

Pause is always one tap away, and it offers resume, restart, sound, skin, and
leave. Leaving a solo game keeps it — it comes back as "Back to the game" on the
home page with the score on it.

## The ranking

The app is honest about where it is getting its rows.

- **World** — real players, when an endpoint is reachable. The header says
  `live · worldwide` or `offline · this device only`.
- **Today** — the daily page board.
- **Back Wall** — the legends of IX-B. These are characters in the game, and the
  tab says so in as many words rather than padding the world board with fiction.
- **Me** — report card, rank progress, badges.

With no endpoint the app is fully playable and the world tab shows your own
desk with an explanation.

### Turning the world board on

```bash
node lastpage/server/server.mjs        # serves the site + /api on :3000
PORT=8080 node lastpage/server/server.mjs
```

No dependencies. Scores land in `lastpage/server/scores.json` (gitignored).
Endpoints: `GET /api/health`, `GET|POST /api/scores`, `GET|POST /api/daily`.
Totals only ever move forward, submissions are rate limited and field-clamped,
and the daily board takes one entry per device per day.

Hosting the static files elsewhere? Point the app at the API by setting
`window.LASTPAGE_API` before `js/ui.js` loads:

```html
<script>window.LASTPAGE_API = 'https://your-host.example/api';</script>
```

Otherwise it uses same-origin `/api`.

Note the leaderboard trusts the client, because there is no account system to
hang trust on. It is a scoreboard among friends, not an anti-cheat system. Real
integrity would mean replaying submitted games server-side.

## Tests

```bash
node lastpage/strength.mjs    # the bots really are three different bots
node lastpage/audit.mjs       # boots the real app and plays it (needs: npm i -D jsdom)
```

`audit.mjs` runs the actual `index.html` and the actual modules in jsdom and
plays real games through the real click path — 88 checks covering the name gate,
both skins, the ladder, a game to the last box, scoring and prizes, pause and
resume, pass-and-play with four, daily determinism, all four ranking tabs, and
the how-to. Chromium could not be downloaded in this sandbox, so canvas is
stubbed; everything else is the real thing.

## Notes

- Served, not opened from disk — ES modules need `http://`, like any modern
  static site.
- Data lives in `localStorage` under `lastpage.v1`, plus `lastpage.resume.v1`
  for the game you walked out of.
- PeerJS is loaded from a CDN and is the only third-party runtime dependency. If
  it fails to load, the online screen says so and everything else still works.
- LingoBox's service worker at the repo root was scoped to ignore `/lastpage/`,
  so the two can share an origin without it serving the wrong shell or caching
  the rankings.

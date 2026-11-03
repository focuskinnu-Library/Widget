# LingoBox

A quiet reading companion. Keep the words, the page, the lines and the pictures in your head — all attached to the book you met them in.

`index.html` is the page that explains it — tap a word in the passage and watch it land in your dictionary, then tap a genre and watch the weather change.
`app.html` is LingoBox itself. No install, no account, no server.

## What it does

**Your shelf** — a greeting, a streak, and every book as a card with its cover, in its own colours, with a progress ring and what you've saved inside it.

**Adding a book takes one search** — type part of a title and [Open Library](https://openlibrary.org/developers/api) fills in the author, the length and the cover. Free, no key, no account. Type it all in by hand if you'd rather.

**A world per book** — pick a genre and the whole app dresses for it, palette *and* weather: petals for romance, embers for fantasy, rain for thrillers, dust motes for literary, stars for sci-fi, leaves for nature, fog for horror, drifting light for poetry. It runs on a canvas behind the page and turns itself off for anyone who asks for reduced motion.

**A dictionary that ships with the app** — `lexicon.json` holds 93,000 headwords beside the page. Look-up answers instantly with no network, no key and no account, inflections included (`quivering` → `quiver`). The online sources are still consulted afterwards and take over only when they bring more — pronunciation, examples, synonyms, or a word the lexicon never met. Built from [Webster's 1913](https://github.com/matthewreagan/WebstersEnglishDictionary) by `tools-build-lexicon.py`, with modern entries added by hand.

**Inside a book**
- **Words** — tap **Look up** and the built-in dictionary returns pronunciation, several senses, examples and synonyms. Tap a sense to keep it, then write what it means to *you* underneath. Both are saved separately; yours is what the flashcard shows first. Save the sentence you found it in too.
- **Quotes** — the line that made you stop and read it twice.
- **Journal** — what you saw. The room, the casting, the film playing in your head.

**Pronunciation** — a play button beside every word: a real recording when the dictionary has one, otherwise the voice built into the browser, which needs no network. Every word also links out to **YouGlish** (hear it said by real people in real videos), **Cambridge** and **Forvo**.

**Dictionary** — every word you've ever saved, A–Z, searchable, each one still carrying the book and page you met it on.

**Quotes as images** — any quote becomes a square image in that book's colours, drawn on a canvas here and handed straight to the share sheet. Nothing is uploaded.

**Backup & export** — download everything as JSON and restore it later, or take it out as Markdown for Obsidian and Notion, or as a deck for Anki. Restoring only adds what's missing, so it never overwrites what you already have.

**Mastery and rank** — every word carries New / Learning / Known / Mastered, read straight off its SM-2 schedule so a badge can never disagree with the practice. The concordance shows the mix and what the next rank needs; a session ends on a score, not a shrug.

**Reading pace** — every bookmark move is dated, so the shelf can say *about 33 days left* the way a Kindle does for a paperback it has never seen.

**Practice** — three ways, all on the same SM-2 schedule so every answer moves the word's forgetting curve:
- **Flashcards** — your wording first, the dictionary's underneath
- **Quiz** — four words, one meaning; the fastest way to find the gaps
- **Spelling** — hear it, then spell it
- **Say it** — the browser listens and tells you whether you got it. Your voice never leaves the device, and there is no key or service behind it

**Reminders** — the browser nudges you when words go stale. Only ever about your own words. They need the app to have been opened, because there is no server behind this.

## How it looks

**Bodoni · Parma, 1791.** Giambattista Bodoni cut his types for the Duke of
Parma and printed the *Manuale Tipografico*: hairline serifs against stems four
times their weight, acres of white, letterspaced capitals, and a rule thin
enough to be a scratch. Nothing rounded, nothing glowing.

So the app is real white and real black rather than cream and brown, every
corner is square, every shadow is a crisp offset rather than a halo, and there
is exactly one accent — the *rosso pompeiano* the Manuale used for its initials.
The drama is the type scale: 9px letterspaced capitals beside 44px Didone, with
the gap between them left empty on purpose.

The genre worlds survive, re-cut as flat pigments a colourman of 1791 could
have ground — oxblood, olive, aubergine, verdigris. The weather still falls
behind the page; the page itself stays white and black and keeps its one red.

## The library it pretends to be

Everything a circulating library stamps on a book, LingoBox derives — never stored, so an old shelf gets it for free.

- **Call numbers** — a Dewey-ish class from the genre plus the author's surname, printed on a paste-on spine label the way a circulating copy carries one
- **Accession numbers** — running in the order volumes joined the shelf
- **A date-due slip** pasted into each volume, stamped in red with every bookmark move you have ever made
- **Catalogue cards** — the concordance is a drawer of buff 3×5s: ruled heading, call number typed top-left, rod hole punched through the foot
- **A bookplate** on your own page: double gilt rule, *Ex Libris*, your name

## Why it exists

The market splits cleanly in two. Book trackers (Goodreads, StoryGraph, Bookmory, Basmo) track *what* you read. Vocabulary apps (Anki, WordBook, My Words) drill words with no idea where they came from. Kindle is the only thing that joins them — and only if you read on a Kindle.

Two things nobody does: words anchored to the page you met them on, and a place for the pictures a book puts in your head.

## Notes

- **No account, by design.** You pick a name on first run and that's it — no password, no email, nothing sent anywhere. Real sign-in would need a server, which would mean your journal leaving your device.
- **Everything stays on the device.** Data lives in `localStorage` under `lingobox.v1`. Nothing is sent anywhere.
- **Renamed from Margin.** Anything saved under the old `margin.v1` key still loads, and the first write moves it across. The old key is left in place as a safety net.
- **The browser is asked to keep it.** On first run LingoBox calls `navigator.storage.persist()`, which asks the browser not to evict this data when space runs short. It is a request, not a guarantee.
- **Which is why backups matter.** `localStorage` is per-browser and per-origin, and it goes when browsing data is cleared — iOS Safari also evicts it after about a week of not visiting, unless the app has been added to the home screen. Take a backup now and then; it is the only copy that survives a new phone.
- **One exception:** looking a word up sends just that single word to a dictionary. Two are tried in order — [dictionaryapi.dev](https://dictionaryapi.dev) first, since it also carries pronunciation and synonyms, then [Wiktionary](https://en.wiktionary.org/api/rest_v1/), which runs on Wikimedia infrastructure and stays up when the first one doesn't. Wiktionary answers in many languages — English first, then whichever language actually has the word — so `pyar` resolves as Hindi. The panel names the source and the language.
- **Lookup needs a real origin.** Sandboxed previews (claude.ai artifacts, most embedded viewers) apply a strict CSP that blocks all outbound requests, so lookup cannot work there however healthy your connection. Open `index.html` from disk, or from the GitHub Pages URL, and it works. When a request can't leave, the panel says so and offers a web search rather than pretending the word doesn't exist.
- **No Google, no LLM, and that is a constraint rather than a choice.** Google has no free search API and browsers cannot fetch google.com at all, and every LLM API needs a secret key — which in a page with no server would be readable by anyone. Both become possible the day there is a backend. Until then, any word that neither dictionary has offers a web search instead.
- Light and dark, following the system, with a manual toggle. Both are Bodoni —
  black on near-white, or reversed out of near-black.
- **The type is served from here, not from Google.** `fonts/` holds two woff2
  cuts of Bodoni Moda, about 100KB for the pair, precached by the service worker.
  Nothing is requested from a third party, and the face is right with the network
  off. Apple devices get Didot or Bodoni 72 locally before the download even
  finishes. SIL Open Font License 1.1 — `fonts/OFL.txt`.
- Keyboard, during review: `space` to flip, `1` / `2` / `3` to rate.

## Testing

Every suite drives the real app in a real browser.

```
npm i playwright
node audit.mjs            # all of it, with a total and a real exit code
node audit.mjs shelf      # just the suites whose names match
```

`audit.mjs` starts the static server the two HTTP-bound suites need and stops it
again, so there is nothing to remember. It exits non-zero the moment a check
fails, and the same command runs on every push and pull request
(`.github/workflows/test.yml`).

| Suite | Covers | Checks |
|---|---|---|
| `audit-app.mjs` | a whole session, first launch to practice | 46 |
| `audit-extras.mjs` | covers from Open Library, speech practice, quote images | 25 |
| `audit-shelf.mjs` | the built-in dictionary with the network dead, the shelf, mastery | 22 |
| `audit-library.mjs` | call numbers, spine labels, date-due slip, catalogue cards, bookplate | 23 |
| `audit-landing.mjs` | the landing page, genre worlds included | 20 |
| `audit-lookup.mjs` | the two-dictionary chain and every failure mode | 18 |
| `audit-export.mjs` | backup, export, restore, junk files | 18 |
| `audit-say.mjs` | recording vs voice, and that play never flips a card | 11 |
| `audit-languages.mjs` | words in languages other than English | 11 |
| `audit-migration.mjs` | old Margin data surviving the rename | 9 |
| `audit-offline.mjs` | telling a blocked page apart from a lost connection | 7 |

210 checks in total, all green.

Two of them — `audit-shelf.mjs` and `audit-library.mjs` — need the app served
over HTTP, because `fetch` cannot read a sibling file under `file://`. Run them
on their own and they look for `127.0.0.1:8777`; `LINGOBOX_URL` points them
somewhere else.

`audit-browser.mjs` is the one place that knows where Chromium lives. It prefers
the browser at `/opt/pw-browsers/chromium` when that exists and otherwise lets
Playwright use the one it downloaded; `CHROMIUM_PATH` overrides both.

A live call to dictionaryapi.dev still cannot be covered here — the build
environment blocks that host — so online success paths are asserted against the
documented response shapes. The built-in lexicon is exercised for real.

## Ahead

Accounts and sync (needs a server) · scheduled push reminders (same) · OCR a quote from a photo of the page · surfacing an old journal entry when you return to a book.

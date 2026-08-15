# LingoBox

A quiet reading companion. Keep the words, the page, the lines and the pictures in your head — all attached to the book you met them in.

`index.html` is the page that explains it — tap a word in the passage and watch it land in your dictionary, then tap a genre and watch the weather change.
`app.html` is LingoBox itself. No install, no account, no server.

## What it does

**Your shelf** — a greeting, a streak, and every book as a card in its own colours, with a progress ring and what you've saved inside it.

**A world per book** — pick a genre and the whole app dresses for it, palette *and* weather: petals for romance, embers for fantasy, rain for thrillers, dust motes for literary, stars for sci-fi, leaves for nature, fog for horror, drifting light for poetry. It runs on a canvas behind the page and turns itself off for anyone who asks for reduced motion.

**Inside a book**
- **Words** — tap **Look up** and the built-in dictionary returns pronunciation, several senses, examples and synonyms. Tap a sense to keep it, then write what it means to *you* underneath. Both are saved separately; yours is what the flashcard shows first. Save the sentence you found it in too.
- **Quotes** — the line that made you stop and read it twice.
- **Journal** — what you saw. The room, the casting, the film playing in your head.

**Pronunciation** — a play button beside every word: a real recording when the dictionary has one, otherwise the voice built into the browser, which needs no network. Every word also links out to **YouGlish** (hear it said by real people in real videos), **Cambridge** and **Forvo**.

**Dictionary** — every word you've ever saved, A–Z, searchable, each one still carrying the book and page you met it on.

**Backup & export** — download everything as JSON and restore it later, or take it out as Markdown for Obsidian and Notion, or as a deck for Anki. Restoring only adds what's missing, so it never overwrites what you already have.

**Practice** — three ways, all on the same SM-2 schedule so every answer moves the word's forgetting curve:
- **Flashcards** — your wording first, the dictionary's underneath
- **Quiz** — four words, one meaning; the fastest way to find the gaps
- **Spelling** — hear it, then spell it

**Reminders** — the browser nudges you when words go stale. Only ever about your own words. They need the app to have been opened, because there is no server behind this.

## Why it exists

The market splits cleanly in two. Book trackers (Goodreads, StoryGraph, Bookmory, Basmo) track *what* you read. Vocabulary apps (Anki, WordBook, My Words) drill words with no idea where they came from. Kindle is the only thing that joins them — and only if you read on a Kindle.

Two things nobody does: words anchored to the page you met them on, and a place for the pictures a book puts in your head.

## Notes

- **No account, by design.** You pick a name on first run and that's it — no password, no email, nothing sent anywhere. Real sign-in would need a server, which would mean your journal leaving your device.
- **Everything stays on the device.** Data lives in `localStorage` under `lingobox.v1`. Nothing is sent anywhere.
- **Renamed from Margin.** Anything saved under the old `margin.v1` key still loads, and the first write moves it across. The old key is left in place as a safety net.
- **Which is why backups matter.** `localStorage` is per-browser and per-origin, and it goes when browsing data is cleared — iOS Safari also evicts it after about a week of not visiting, unless the app has been added to the home screen. Take a backup now and then; it is the only copy that survives a new phone.
- **One exception:** looking a word up sends just that single word to a dictionary. Two are tried in order — [dictionaryapi.dev](https://dictionaryapi.dev) first, since it also carries pronunciation and synonyms, then [Wiktionary](https://en.wiktionary.org/api/rest_v1/), which runs on Wikimedia infrastructure and stays up when the first one doesn't. The panel names whichever answered.
- **Lookup needs a real origin.** Sandboxed previews (claude.ai artifacts, most embedded viewers) apply a strict CSP that blocks all outbound requests, so lookup cannot work there however healthy your connection. Open `index.html` from disk, or from the GitHub Pages URL, and it works. When a request can't leave, the panel says so and offers a web search rather than pretending the word doesn't exist.
- Light and dark, following the system, with a manual toggle.
- Keyboard, during review: `space` to flip, `1` / `2` / `3` to rate.

## Testing

Every suite drives the real app in a real browser.

```
npm i playwright
for f in audit-*.mjs; do node $f; done
```

| Suite | Covers | Checks |
|---|---|---|
| `audit-app.mjs` | a whole session, first launch to practice | 46 |
| `audit-lookup.mjs` | the two-dictionary chain and every failure mode | 18 |
| `audit-export.mjs` | backup, export, restore, junk files | 18 |
| `audit-landing.mjs` | the landing page, genre worlds included | 20 |
| `audit-say.mjs` | recording vs voice, and that play never flips a card | 11 |
| `audit-migration.mjs` | old Margin data surviving the rename | 9 |
| `audit-offline.mjs` | telling a blocked page apart from a lost connection | 7 |

123 checks in total.

The one thing it cannot cover is a live call to dictionaryapi.dev: the build
environment blocks that host, so the success path is asserted against the
documented response shape rather than the wire.

## Ahead

Accounts and sync (needs a server) · scheduled push reminders (same) · OCR a quote from a photo of the page · surfacing an old journal entry when you return to a book.

# Margin

A quiet reading companion. Keep the words, the page, the lines and the pictures in your head — all attached to the book you met them in.

Open `index.html`. That's it. No install, no account, no server.

`landing.html` is the page that explains it — tap a word in the passage and watch it land in your dictionary.

## What it does

**Shelf** — your books, with the page you stopped on and a thin line showing how far in you are.

**Inside a book**
- **Words** — tap **Look up** and the built-in dictionary returns pronunciation, several senses, examples and synonyms. Tap a sense to keep it, then write what it means to *you* underneath. Both are saved separately; yours is what the flashcard shows first. Save the sentence you found it in too.
- **Quotes** — the line that made you stop and read it twice.
- **Journal** — what you saw. The room, the casting, the film playing in your head.

**Pronunciation** — a play button beside every word. A real recording when the dictionary has one, otherwise the voice built into the browser, which needs no network and so works offline too.

**Dictionary** — every word you've ever saved, A–Z, searchable, each one still carrying the book and page you met it on.

**Vibes** — every book carries a palette (Paper, Dusk, Ember, Fern, Tide, Blush). Open the book and the whole app, your dictionary included, wears it. The mood of what you're reading follows you around.

**Review** — proper spaced repetition (SM-2). Every word runs its own forgetting curve: answer well and it steps further away, stumble and it comes straight back. The shelf nudges you when words start to fade.

## Why it exists

The market splits cleanly in two. Book trackers (Goodreads, StoryGraph, Bookmory, Basmo) track *what* you read. Vocabulary apps (Anki, WordBook, My Words) drill words with no idea where they came from. Kindle is the only thing that joins them — and only if you read on a Kindle.

Two things nobody does: words anchored to the page you met them on, and a place for the pictures a book puts in your head.

## Notes

- **Everything stays on the device.** Data lives in `localStorage` under `margin.v1`. Nothing is sent anywhere.
- **One exception:** looking a word up sends just that single word to a dictionary. Two are tried in order — [dictionaryapi.dev](https://dictionaryapi.dev) first, since it also carries pronunciation and synonyms, then [Wiktionary](https://en.wiktionary.org/api/rest_v1/), which runs on Wikimedia infrastructure and stays up when the first one doesn't. The panel names whichever answered.
- **Lookup needs a real origin.** Sandboxed previews (claude.ai artifacts, most embedded viewers) apply a strict CSP that blocks all outbound requests, so lookup cannot work there however healthy your connection. Open `index.html` from disk, or from the GitHub Pages URL, and it works. When a request can't leave, the panel says so and offers a web search rather than pretending the word doesn't exist.
- Light and dark, following the system, with a manual toggle.
- Keyboard, during review: `space` to flip, `1` / `2` / `3` to rate.

## Testing

`audit.mjs` drives the real app in Chromium — 67 checks across books, lookup and its
failure modes, quotes, journal, dictionary search, SM-2 arithmetic, review, vibes,
themes, persistence, escaping of hostile input, corrupt and legacy storage, and
delete cascades.

```
npm i playwright && node audit.mjs && node audit-lookup.mjs && node audit-say.mjs && node audit-landing.mjs
```

`audit-say.mjs` covers pronunciation (10) and `audit-landing.mjs` the landing page (14).
`audit-lookup.mjs` adds 17 checks over the two-dictionary fallback: primary
success without touching the fallback, primary down, primary 404, both 404,
both unreachable, malformed JSON, and an empty-but-valid response.

The one thing it cannot cover is a live call to dictionaryapi.dev: the build
environment blocks that host, so the success path is asserted against the
documented response shape rather than the wire.

## Ahead

Sync across devices · export to Markdown or Anki · OCR a quote from a photo of the page · surfacing an old journal entry when you return to a book.

# Margin

A quiet reading companion. Keep the words, the page, the lines and the pictures in your head — all attached to the book you met them in.

Open `index.html`. That's it. No install, no account, no server.

## What it does

**Shelf** — your books, with the page you stopped on and a thin line showing how far in you are.

**Inside a book**
- **Words** — tap **Look up** and the built-in dictionary returns pronunciation, several senses, examples and synonyms. Tap a sense to keep it, then write what it means to *you* underneath. Both are saved separately; yours is what the flashcard shows first. Save the sentence you found it in too.
- **Quotes** — the line that made you stop and read it twice.
- **Journal** — what you saw. The room, the casting, the film playing in your head.

**Dictionary** — every word you've ever saved, A–Z, searchable, each one still carrying the book and page you met it on.

**Vibes** — every book carries a palette (Paper, Dusk, Ember, Fern, Tide, Blush). Open the book and the whole app, your dictionary included, wears it. The mood of what you're reading follows you around.

**Review** — proper spaced repetition (SM-2). Every word runs its own forgetting curve: answer well and it steps further away, stumble and it comes straight back. The shelf nudges you when words start to fade.

## Why it exists

The market splits cleanly in two. Book trackers (Goodreads, StoryGraph, Bookmory, Basmo) track *what* you read. Vocabulary apps (Anki, WordBook, My Words) drill words with no idea where they came from. Kindle is the only thing that joins them — and only if you read on a Kindle.

Two things nobody does: words anchored to the page you met them on, and a place for the pictures a book puts in your head.

## Notes

- **Everything stays on the device.** Data lives in `localStorage` under `margin.v1`. Nothing is sent anywhere.
- **One exception:** the dictionary calls [dictionaryapi.dev](https://dictionaryapi.dev) with just the single word you typed. Offline or blocked, it degrades quietly and you write the meaning yourself.
- Light and dark, following the system, with a manual toggle.
- Keyboard, during review: `space` to flip, `1` / `2` / `3` to rate.

## Ahead

Sync across devices · export to Markdown or Anki · OCR a quote from a photo of the page · surfacing an old journal entry when you return to a book.

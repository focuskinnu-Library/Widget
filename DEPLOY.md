# LingoBox — deploy guide

Everything below lives in this folder. Copy it into the `Widget/` folder of your
`focuskinnu-Library` repo and push — that's the whole deploy.

## What shipped in 3.0 — “The Manuscript”

A full interface redesign (see `DESIGN.md`): the app now reads like a privately
printed book — paper grain, hairline and double rules, roman-numeral chapters,
a literal shelf of book spines, a concordance with drop caps and leader dots
instead of a word list, practice as a table of contents, flashcards as index
cards, and stats as the book's colophon. Every feature from 2.0 is intact
(fingerprints, word of the day, memories, heatmap, offline, exports).

## What shipped in 2.0

**New & unique**
- **Book fingerprints** — every book earns a constellation: one star per word,
  placed by the word itself (seeded hash, not chance), growing brighter as the
  word settles into memory. Shareable as a 1080×1080 image.
- **Word of the day** — chosen from *your own shelf*, deterministic per day.
- **"N days ago you kept…"** — words, lines and journal entries resurface on
  their 30/90/180/365-day anniversaries.
- **Reading weather** — a 26-week activity heatmap (kept + reviewed things).
- **Your shelf in numbers** — a recap card with first word, longest word,
  favourite genre, pages deep… shareable as an image.

**Deploy-readiness**
- `sw.js` — offline-first service worker. The whole app opens and works with
  no connection; dictionary lookups, Open Library search and cover art are
  cached when the network is available (covers work offline after first view).
- Full icon set: SVG + PNG 192/512 + maskable + apple-touch-icon + favicons.
- Manifest with app shortcuts (long-press the icon → *Practice*, *Words*),
  deep links `#practice` and `#words`.
- Update flow: ship a change → visitors get a toast "A new LingoBox is ready →
  Reload".
- Offline pill: says what stopped (lookups), not "you're broken".
- Data safety: backup nudges when the shelf has grown and the last copy is
  old; storage-quota readout; save() survives a full quota; global error net.
- Social cards (OG/Twitter) for `app.html` and the landing page + `og-image.png`.

## Files

| file | role |
|---|---|
| `app.html` | the app (still one file, still no build step) |
| `index.html` | landing page (now with proper meta/head) |
| `sw.js` | service worker — **must sit next to app.html** |
| `manifest.json` | install metadata + shortcuts |
| `icon.svg`, `icon-192.png`, `icon-512.png` | app icons |
| `icon-maskable-192/512.png` | adaptive icons (Android) |
| `apple-touch-icon.png`, `favicon-16/32.png` | iOS + browser tabs |
| `og-image.png` | social share card (1200×630) |
| `make_icons.py` | regenerates every icon from `icon.svg` (needs `cairosvg`, `pillow`) |

## Deploy

```bash
cd Widget
git add app.html index.html sw.js manifest.json *.svg *.png DEPLOY.md
git commit -m "LingoBox 3.0 — the manuscript: offline, installable, fingerprints"
git push
```

GitHub Pages serves it within a minute or two.

## When the custom domain is ready

1. Repo → **Settings → Pages → Custom domain** → enter it, save (this creates
   a `CNAME` file — commit it), then DNS: a `CNAME` record pointing at
   `focuskinnu-library.github.io` (or `A` records `185.199.108–111.153` for an
   apex domain). Wait for the HTTPS checkbox, tick it.
2. Swap the URL in exactly **three places** (search for
   `focuskinnu-library.github.io`):
   - `app.html` → the `og:url` line (canonical link + og:url are right by it)
   - `index.html` → the `og:url` line
   - that's it — everything else is relative.
3. Push. Note: the service worker caches the old shell for up to one visit —
   the update toast handles the move for returning visitors.

## Shipping a future version

1. Change something in `app.html`.
2. Bump `VER` at the top of `sw.js` (`3.0` → `3.1`).
3. Push. Returning visitors get the reload toast on their next visit.

## Post-deploy checklist

- [ ] Lighthouse (Chrome → DevTools → Lighthouse, mobile): aim 90+ on
      Performance / Best practices / SEO; "Installable" should pass.
- [ ] Phone: Chrome menu → *Add to Home screen* → icon, splash, standalone.
- [ ] iPhone: Safari → Share → *Add to Home Screen* (apple-touch-icon shows).
- [ ] Airplane mode → open the app → everything works; lookups show the
      offline message; the pill appears.
- [ ] Add a word, then share its book's fingerprint image.
- [ ] Post the app URL in a chat — the preview card should show the OG image.

*No account, no tracking, nothing sent anywhere — still true. The only network
the app ever speaks to is two public dictionaries, one book search, and its own
home on GitHub Pages.*

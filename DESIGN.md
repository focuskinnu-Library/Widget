# LingoBox 3.0 — “The Manuscript” design system

## The idea

Every vocabulary app looks the same: white cards, blue accents, progress bars,
streak flames. LingoBox is a *reading* companion — so the interface became the
thing it loves: **a privately printed book**. Warm paper, ink, hairline and
double rules, a neo-serif for reading and a monospace for the parts a printer
sets. Genre worlds still colour the ink; the weather still falls behind the page.

Grounded in 2026 design research:

- **Typography as the interface** — viewport-scaled serif display type paired
  with monospace metadata, replacing imagery as the visual carrier.
- **Tactile textures over soft UI** — paper grain (pure CSS/SVG noise), 1px
  rules, offset shadows instead of blur-glow-float.
- **Reading-first editorial serifs** — the swing back to print-like, longform,
  warm typography.
- **Quiet kinetic type** — choreographed entrances, never on body copy,
  disabled under `prefers-reduced-motion`.

## The parts

| Element | Treatment |
|---|---|
| Onboarding | A book's **title page**: fleuron ❦, double rules, centred italic name |
| Home | **Chapter I · The Shelf** — greeting in 31px italic serif, ghost roman numeral watermark behind every chapter |
| Due words | An **errata slip** — slightly rotated paper note, red "DUE" stamp |
| Word of the day | **Front matter** — the ad card at the front of a book |
| Memories | **Marginalia** — rotated, italic, ruled in the margin |
| Books | **Spines on a ledge** — height by length, genre gradient, vertical titles, hover lifts the book out |
| Dictionary | **The Concordance** — drop caps, leader dots to page numbers, bracketed due-dates |
| Practice menu | **A table of contents** — roman numerals, dotted leaders to states |
| Flashcards | **Index cards** — ruled lines, red top rule |
| Stats | **The Colophon** — the book's closing page: "Printed entirely on this device" |
| Heatmap | **The pressman's calendar** — 26 weeks of quiet→busy ink |
| Fingerprint | **A plate figure** — "Plate II · the fingerprint", corner ticks |
| Navigation | **The platen** — roman-numeral tabs, ink fill when active |
| Sheets | **Tipped-in plates** — paper panels sliding up |
| Forms | **Register entries** — underlined rules, italic serif placeholders |
| Offline | The pill speaks in the same voice: "everything but lookups still works" |

## Type

- Display/reading: `--serif` — Iowan Old Style → Palatino → Georgia stack
  (installed everywhere, honours offline-first: no webfonts, ever)
- Printer's matter: `--mono` — system mono, 8–11px, 0.1–0.3em tracking,
  uppercase
- Ghost numerals: italic serif at 148px, 5.5% opacity, behind each chapter

## Motion

One choreographed entrance per view (`.rise` stagger, ≤.45s), hover lifts on
spines, letterpress press-down on buttons. All of it dies instantly under
`prefers-reduced-motion: reduce`.

## Colour

Paper `#f2ecdf` / ink `#211b12` (light), midnight press `#131009` / cream
`#eee5cf` (dark). Genre ink is mixed into soft tints via `color-mix()`; the
red of due-ness (`--due`) is the only colour that never changes meaning.

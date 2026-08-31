/* ══════════════════════════════════════════════════════════════════
   LingoBox service worker — offline-first, nothing chatty.
   Bump VER to ship an update; every visitor gets it within a visit.
══════════════════════════════════════════════════════════════════ */
'use strict';
const VER = '3.0';
const CACHE = `lingobox-${VER}`;

/* The shell: everything the app needs to open with no network at all. */
const CORE = [
  './',
  './app.html',
  './index.html',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-192.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
  './favicon-32.png',
  './og-image.png'
];

/* Cover art is immutable per id — the safest cache-first there is.
   Everything else that leaves this origin is a lookup: try the network,
   keep what worked, fall back to what's kept. */
const CACHE_FIRST_HOSTS = ['covers.openlibrary.org'];
const NET_FIRST_HOSTS = ['api.dictionaryapi.dev', 'en.wiktionary.org', 'openlibrary.org'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(CORE.map(u => c.add(u).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

async function staleWhileRevalidate(c, req) {
  const kept = await c.match(req);
  const fresh = fetch(req).then(r => { if (r && r.ok) c.put(req, r.clone()); return r; }).catch(() => null);
  return kept || (await fresh) || Response.error();
}

async function networkFirst(c, req) {
  try {
    const r = await fetch(req);
    if (r && r.ok) c.put(req, r.clone());
    return r;
  } catch (e) {
    const kept = await c.match(req);
    if (kept) return kept;
    throw e;
  }
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  /* Another origin: only the quiet, well-known ones. */
  if (url.origin !== self.location.origin) {
    if (CACHE_FIRST_HOSTS.some(h => url.hostname === h || url.hostname.endsWith('.' + h))) {
      e.respondWith((async () => {
        const c = await caches.open(CACHE + '-api');
        const kept = await c.match(req);
        if (kept) return kept;
        try {
          const r = await fetch(req);
          /* cover art arrives as opaque no-cors responses — those cache fine */
          if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone());
          return r;
        } catch (err) { return kept || Response.error(); }
      })());
    } else if (NET_FIRST_HOSTS.some(h => url.hostname === h || url.hostname.endsWith('.' + h))) {
      e.respondWith(networkFirst(caches.open(CACHE + '-api'), req));
    }
    return; /* anything else crosses the wire untouched */
  }

  /* Same origin — the app itself works fully offline. */
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    if (req.mode === 'navigate') {
      /* Pages: serve the shell instantly, refresh it quietly behind. */
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.ok) { c.put('./app.html', fresh.clone()); return fresh; }
      } catch (err) {}
      const shell = await c.match('./app.html') || await c.match('./');
      return shell || Response.error();
    }
    return staleWhileRevalidate(c, req);
  })());
});

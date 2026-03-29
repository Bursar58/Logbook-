// Glass Cockpit Logbuch — Service Worker v2
// Cached-Ressourcen für vollständige Offline-Funktion auf See

const CACHE_NAME = 'logbuch-v2';

// App Shell — alles was für den Start benötigt wird
const PRECACHE = [
  './',
  './index.html',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&family=Inter:wght@300;400;600&display=swap',
];

// API-Domains die IMMER live abgerufen werden (GPS-Daten, Wetter, Pegel)
const NETWORK_ONLY = [
  'api.open-meteo.com',
  'marine-api.open-meteo.com',
  'pegelonline.wsv.de',
  'hzb.bmk.gv.at',
  'api.tidesandcurrents.noaa.gov',
  'api.rainviewer.com',
  'tilecache.rainviewer.com',
  'tile.openstreetmap.org',
  'tiles.openseamap.org',
];

// ── Install: App Shell precachen ─────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // index.html zuerst (kritisch), dann Rest best-effort
      return cache.add('./index.html').then(() =>
        Promise.allSettled(
          PRECACHE.filter(u => u !== './index.html').map(url =>
            cache.add(url).catch(e => console.warn('Precache miss:', url, e))
          )
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ── Activate: Alte Caches aufräumen ──────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch: Cache-First für App Shell, Network-Only für APIs ──────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // API-Calls immer live (Pegel, Wetter, Kartenkacheln)
  if (NETWORK_ONLY.some(domain => url.hostname.includes(domain))) {
    return; // Browser-Standard: network request
  }

  // App Shell: Cache-First, bei Miss ins Netz + in Cache schreiben
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request)
        .then(response => {
          if (response && response.status === 200 && response.type !== 'opaque') {
            const clone = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => cache.put(event.request, clone))
              .catch(() => {}); // ignoriere Cache-Fehler
          }
          return response;
        })
        .catch(() => {
          // Offline-Fallback: index.html für Navigation-Requests
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
    })
  );
});

/* Service worker: guarda la app en el teléfono para que abra al instante y funcione sin señal.
   Estrategia "responder con lo guardado y actualizar en segundo plano": después de publicar una
   versión nueva, se ve la primera vez que se abre la app y la segunda ya queda actualizada. */
const CACHE = 'tenis-caja-v1';
const ASSETS = [
  './', 'index.html', 'styles.css', 'app.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'fonts/barlow-latin-400-normal.woff2', 'fonts/barlow-latin-500-normal.woff2', 'fonts/barlow-latin-600-normal.woff2',
  'fonts/barlow-condensed-latin-600-normal.woff2', 'fonts/barlow-condensed-latin-700-normal.woff2', 'fonts/barlow-condensed-latin-800-normal.woff2'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  // Solo archivos de la propia app. Las llamadas a Google (planilla) pasan directo.
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = (await cache.match(req, { ignoreSearch: true })) ||
      (req.mode === 'navigate' ? await cache.match(new URL('index.html', self.registration.scope)) : undefined);
    const net = fetch(req, hit ? { cache: 'no-cache' } : undefined)
      .then(r => { if (r && r.ok) cache.put(req, r.clone()); return r; })
      .catch(() => undefined);
    if (hit) { e.waitUntil(net); return hit; }
    return (await net) || Response.error();
  })());
});

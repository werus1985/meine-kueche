const CACHE = 'meine-kueche-v9-locations';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(CORE);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('meine-kueche-') && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Always check the network first for pages, so published HTML changes appear promptly.
  if (request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request, { cache: 'no-store' });
        if (response && response.ok) {
          const cache = await caches.open(CACHE);
          cache.put(request, response.clone()).catch(() => {});
        }
        return response;
      } catch (error) {
        return (await caches.match(request)) || (await caches.match('./index.html')) || Response.error();
      }
    })());
    return;
  }

  // For other local files, use the cache when available and refresh it from the network.
  event.respondWith((async () => {
    const cached = await caches.match(request);
    const network = fetch(request).then(response => {
      if (response && response.ok) {
        caches.open(CACHE).then(cache => cache.put(request, response.clone())).catch(() => {});
      }
      return response;
    });
    if (cached) {
      event.waitUntil(network.then(() => {}).catch(() => {}));
      return cached;
    }
    try { return await network; }
    catch (error) { return Response.error(); }
  })());
});

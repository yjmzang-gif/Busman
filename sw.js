const CACHE_NAME = 'bus-punctuality-pwa-v1';
const APP_SHELL = [
  './', './index.html', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-180.png'
];
const EXTERNAL_ASSETS = [
  'https://cdn.tailwindcss.com/',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  'https://unpkg.com/lucide@latest',
  'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&display=swap'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);
    // Cache the app's CDN dependencies during installation as well, so the first
    // installed version has a better chance of opening offline after setup.
    await Promise.allSettled(EXTERNAL_ASSETS.map(async url => {
      const request = new Request(url, { mode: 'no-cors' });
      const response = await fetch(request);
      if (response && (response.ok || response.type === 'opaque')) {
        await cache.put(request, response.clone());
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('bus-punctuality-') && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        const cache = await caches.open(CACHE_NAME);
        cache.put('./index.html', response.clone()).catch(() => {});
        return response;
      } catch (error) {
        return (await caches.match('./index.html')) || (await caches.match('./'));
      }
    })());
    return;
  }

  const isAppAsset = url.origin === self.location.origin;
  const isExternalLibrary = EXTERNAL_ASSETS.some(asset => url.href === asset || url.href.startsWith(asset + '?')) || ['script', 'style', 'font', 'image'].includes(request.destination);
  if (!isAppAsset && !isExternalLibrary) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) {
      event.waitUntil(fetch(request).then(response => {
        if (response && (response.ok || response.type === 'opaque')) return cache.put(request, response.clone());
      }).catch(() => {}));
      return cached;
    }
    try {
      const response = await fetch(request);
      if (response && (response.ok || response.type === 'opaque')) event.waitUntil(cache.put(request, response.clone()));
      return response;
    } catch (error) {
      if (cached) return cached;
      throw error;
    }
  })());
});

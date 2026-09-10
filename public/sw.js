const CACHE_NAME = 'cloudnav-shell-v20-workspace-20260910';
const SHELL = ['/', '/manifest.webmanifest', '/icon.svg'];
const MAX_RUNTIME_ENTRIES = 80;

const cacheSuccessfulResponse = async (request, response) => {
  if (!response.ok) return;
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response.clone());
  const keys = await cache.keys();
  const runtimeKeys = keys.filter(key => !SHELL.includes(new URL(key.url).pathname));
  if (runtimeKeys.length > MAX_RUNTIME_ENTRIES) {
    await Promise.all(runtimeKeys.slice(0, runtimeKeys.length - MAX_RUNTIME_ENTRIES).map(key => cache.delete(key)));
  }
};

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith('cloudnav-shell-') && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  const isDevModule = url.pathname.startsWith('/@vite/')
    || url.pathname.startsWith('/node_modules/.vite/')
    || /\.(?:tsx?|jsx?)$/.test(url.pathname);
  if (request.method !== 'GET' || url.origin !== self.location.origin || (url.pathname.startsWith('/api/') && url.pathname !== '/api/content') || isDevModule) return;

  if (url.pathname === '/api/content') {
    event.respondWith(fetch(request).then(response => {
      void cacheSuccessfulResponse(request, response);
      return response;
    }).catch(() => caches.match(request).then(cached => cached || new Response(JSON.stringify({ error: 'offline' }), { status: 503, headers: { 'Content-Type': 'application/json' } }))));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => {
      void cacheSuccessfulResponse(request, response);
      return response;
    }).catch(() => caches.match(request).then(cached => cached || caches.match('/'))));
    return;
  }

  event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
    if (request.destination === 'script' || request.destination === 'style' || request.destination === 'image' || url.pathname.startsWith('/assets/')) void cacheSuccessfulResponse(request, response);
    return response;
  })));
});

const CACHE = 'ax-academy-shell-v1';
const SHELL = ['/', '/arcade', '/arcade/island-resilience', '/ax-academy-logo.jpg', '/neon-drift-card.svg'];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', event => { event.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', event => { const request = event.request; if (request.method !== 'GET') return; event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => { if (response.ok && new URL(request.url).origin === self.location.origin) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(request, copy)); } return response; }).catch(() => cached || caches.match('/'))); });
self.addEventListener('sync', event => { if (event.tag !== 'ax-sync') return; event.waitUntil((async () => { const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true }); clients.forEach(client => client.postMessage({ type: 'AX_FLUSH_MUTATIONS' })); })()); });

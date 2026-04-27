
const CACHE_NAME = 'gnannt-aix-v1';
const ASSETS = ['/', '/index.html', '/manifest.webmanifest', '/gnannt-logo.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)).catch(()=>null));
  self.skipWaiting();
});
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(r => {
    const copy = r.clone();
    caches.open(CACHE_NAME).then(c => c.put(e.request, copy)).catch(()=>null);
    return r;
  }).catch(() => caches.match(e.request).then(c => c || caches.match('/index.html'))));
});

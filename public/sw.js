
const CACHE_NAME = 'gnannt-aix-v2';
const ASSETS = ['/', '/index.html', '/manifest.webmanifest', '/monteur.webmanifest', '/gnannt-logo.png', '/monteur-icon-192.png', '/monteur-icon-512.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)).catch(()=>null));
  self.skipWaiting();
});
self.addEventListener('activate', e => e.waitUntil(Promise.all([
  caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('gnannt-aix-') && key !== CACHE_NAME).map(key => caches.delete(key)))),
  self.clients.claim()
])));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  if (e.request.mode !== 'navigate' && !['script', 'style', 'image', 'font', 'manifest'].includes(e.request.destination)) return;
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE_NAME).then(c => c.put(e.request, copy)).catch(()=>null); }
    return r;
  }).catch(() => caches.match(e.request).then(c => c || (e.request.mode === 'navigate' ? caches.match('/index.html') : Response.error()))));
});

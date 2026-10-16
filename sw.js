// Caches the sprite sheets, fonts and level files after the first visit so later visits start almost instantly.
// Pictures and fonts never change under the same name, so they are served from the cache first; the small lists (json, plist) are
// served from the cache and refreshed in the background so updates still arrive.
const CACHE = 'gdv-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith('gdv-') && k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || r.headers.has('range')) return;
  const p = u.pathname;
  const firstChoice = /\/(assets\/.*\.(png|fnt)|levels\/(?!index\.json).*)$/.test(p);
  const refresh = /\/assets\/.*\.(json|plist)$/.test(p) || /\/levels\/index\.json$/.test(p);
  if (!firstChoice && !refresh) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE), hit = await cache.match(r);
    const fetchAndStore = async () => { const res = await fetch(r); if (res.ok) cache.put(r, res.clone()); return res; };
    if (hit) { if (refresh) fetchAndStore().catch(() => { }); return hit; }
    return fetchAndStore();
  })());
});
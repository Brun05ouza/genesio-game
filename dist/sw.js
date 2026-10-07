// Service worker do Genésio: guarda o jogo no aparelho (abre rápido e funciona sem internet depois da primeira vez).
// VERSION e CORE são trocados pelo build-dist.py a cada publicação; os demais arquivos entram no cache conforme o jogo os usa.
const VERSION = '7c5b135507';
const CORE = ["./", "assets/lobby-loading.webp", "assets/menu-bg.webp", "assets/menu-foliage.webp", "assets/menu-g-a-blink.webp", "assets/menu-g-a.webp", "assets/menu-g-b-blink.webp", "assets/menu-g-b.webp", "assets/menu-g-c-blink.webp", "assets/menu-g-c.webp", "assets/menu-g-d-blink.webp", "assets/menu-g-d.webp", "assets/menu-g-e-blink.webp", "assets/menu-g-e.webp", "assets/settings-bg.webp", "assets/settings-mask.webp", "audio.js?v=7c5b135507", "climb.js?v=7c5b135507", "favicon.ico", "flow-data.js?v=7c5b135507", "flow.js?v=7c5b135507", "game.js?v=7c5b135507", "hop-data.js?v=7c5b135507", "hop.js?v=7c5b135507", "icons/apple-touch-icon.png", "icons/favicon-48.png", "icons/favicon-64.png", "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "index.html", "loader.js?v=7c5b135507", "manifest.webmanifest", "menu.css?v=7c5b135507", "menu.js?v=7c5b135507", "nature.js?v=7c5b135507", "pwa.js?v=7c5b135507", "runner.js?v=7c5b135507", "settings.css?v=7c5b135507", "settings.js?v=7c5b135507", "solar-data.js?v=7c5b135507", "solar.js?v=7c5b135507", "style.css?v=7c5b135507", "talk.js?v=7c5b135507", "touch.css?v=7c5b135507", "touch.js?v=7c5b135507", "tower-data.js?v=7c5b135507"];
const CACHE = 'genesio-' + VERSION;

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.allSettled(CORE.map(u => c.add(new Request(u, { cache: 'reload' }))));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('genesio-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  const url = new URL(req.url);
  const font = /(^|\.)(fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(url.hostname);
  if (url.origin !== location.origin && !font) return;
  if (req.mode === 'navigate') {                 // página: rede primeiro (pega a versão nova); sem internet usa o cache
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        const c = await caches.open(CACHE); c.put('index.html', res.clone());
        return res;
      } catch (err) { return (await caches.match('index.html')) || (await caches.match('./')) || Response.error(); }
    })());
    return;
  }
  e.respondWith((async () => {                   // resto: usa o que já tem e atualiza em segundo plano
    const c = await caches.open(CACHE);
    const hit = await c.match(req);
    const net = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone()); return res; }).catch(() => null);
    return hit || (await net) || Response.error();
  })());
});

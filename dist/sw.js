// Service worker do Genésio: guarda o jogo no aparelho (abre rápido e funciona sem internet depois da primeira vez).
// VERSION e CORE são trocados pelo build-dist.py a cada publicação; os demais arquivos entram no cache conforme o jogo os usa.
const VERSION = '82761c40ce';
const CORE = ["./", "account.js?v=82761c40ce", "assets/lobby-loading.webp", "assets/menu-bg.webp", "assets/menu-foliage.webp", "assets/menu-g-a-blink.webp", "assets/menu-g-a.webp", "assets/menu-g-b-blink.webp", "assets/menu-g-b.webp", "assets/menu-g-c-blink.webp", "assets/menu-g-c.webp", "assets/menu-g-d-blink.webp", "assets/menu-g-d.webp", "assets/menu-g-e-blink.webp", "assets/menu-g-e.webp", "assets/settings-bg.webp", "assets/settings-mask.webp", "audio.js?v=82761c40ce", "climb.js?v=82761c40ce", "favicon.ico", "flow-data.js?v=82761c40ce", "flow.js?v=82761c40ce", "frames/idle0.webp", "frames/jump0.webp", "frames/jump1.webp", "frames/jump2.webp", "frames/jump3.webp", "frames/jump4.webp", "frames/run0.webp", "frames/run1.webp", "frames/run10.webp", "frames/run11.webp", "frames/run12.webp", "frames/run2.webp", "frames/run3.webp", "frames/run4.webp", "frames/run5.webp", "frames/run6.webp", "frames/run7.webp", "frames/run8.webp", "frames/run9.webp", "frames/walk0.webp", "frames/walk1.webp", "frames/walk10.webp", "frames/walk11.webp", "frames/walk12.webp", "frames/walk2.webp", "frames/walk3.webp", "frames/walk4.webp", "frames/walk5.webp", "frames/walk6.webp", "frames/walk7.webp", "frames/walk8.webp", "frames/walk9.webp", "game.js?v=82761c40ce", "hop.js?v=82761c40ce", "icons/apple-touch-icon.png", "icons/favicon-48.png", "icons/favicon-64.png", "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "index.html", "loader.js?v=82761c40ce", "lobby.js?v=82761c40ce", "manifest.webmanifest", "map/lobby-mask.webp", "map/new-map.webp", "menu.css?v=82761c40ce", "menu.js?v=82761c40ce", "nature.js?v=82761c40ce", "pwa.js?v=82761c40ce", "ranking.js?v=82761c40ce", "runner.js?v=82761c40ce", "settings.css?v=82761c40ce", "settings.js?v=82761c40ce", "solar-data.js?v=82761c40ce", "solar.js?v=82761c40ce", "style.css?v=82761c40ce", "talk.js?v=82761c40ce", "touch.css?v=82761c40ce", "touch.js?v=82761c40ce", "tower-data.js?v=82761c40ce", "updater.js?v=82761c40ce"];
const CACHE = 'genesio-' + VERSION;
const notify = async data => {
  for (const client of await self.clients.matchAll({ type: 'window', includeUncontrolled: true })) client.postMessage({ ...data, version: VERSION });
};

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    let done = 0;
    const results = await Promise.allSettled(CORE.map(async u => {
      await c.add(new Request(u, { cache: 'reload' }));
      await notify({ type: 'UPDATE_PROGRESS', done: ++done, total: CORE.length });
    }));
    if (results.some(result => result.status === 'rejected')) {
      await caches.delete(CACHE); await notify({ type: 'UPDATE_ERROR' });
      throw Error('Não foi possível preparar todos os arquivos do jogo');
    }
    // Mantém a migração dos clientes antigos, que só conhecem controllerchange.
    await self.skipWaiting();
  })());
});

self.addEventListener('message', e => {
  if (e.data?.type === 'GET_VERSION') e.ports[0]?.postMessage({ version: VERSION });
  if (e.data?.type === 'SKIP_WAITING') e.waitUntil(self.skipWaiting());
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
  if (url.pathname.endsWith('/version.json')) return; // consulta sempre a versão publicada, sem cache offline
  if (url.pathname.startsWith('/api/')) return; // contas e presença precisam de dados atuais, nunca do cache offline
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

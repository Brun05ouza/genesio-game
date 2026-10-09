// Service worker do Genésio: guarda o jogo no aparelho (abre rápido e funciona sem internet depois da primeira vez).
// VERSION e CORE são trocados pelo build-dist.py a cada publicação; os demais arquivos entram no cache conforme o jogo os usa.
const VERSION = 'dev';
const CORE = [];
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

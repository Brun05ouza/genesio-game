// Atualização do app: bloqueia uma versão antiga, prepara o cache e mantém o loading até o jogo novo abrir.
const Updater = (() => {
  const el = id => document.getElementById(id);
  const current = document.querySelector('meta[name="genesio-version"]')?.content || 'dev';
  const valid = version => typeof version === 'string' && /^[a-f0-9]{10}$/.test(version);
  let registration = null, registrationPromise = null, target = null, activeVersion = null;
  let blocking = false, applying = false, reloading = false, started = false, lastCheck = 0, checking = false, deadline = null;
  const STORAGE = 'genesio-update-loading';
  function block() {
    blocking = true; el('updateOverlay').hidden = false; el('updateOverlay').classList.add('active');
    if (typeof keys !== 'undefined') for (const key in keys) keys[key] = false;
  }
  function loading(text) {
    block(); el('updateTitle').textContent = 'Atualizando o Genésio';
    el('updateText').textContent = text; el('updateStatus').textContent = 'Mantenha esta tela aberta.';
    el('updateGo').hidden = true; el('updateSpinner').hidden = false;
  }
  function error(text) {
    clearTimeout(deadline); applying = false; block();
    el('updateTitle').textContent = 'Não foi possível atualizar'; el('updateText').textContent = text;
    el('updateStatus').textContent = 'Confira a conexão e tente novamente.';
    el('updateSpinner').hidden = true; el('updateGo').hidden = false; el('updateGo').textContent = 'Tentar novamente'; el('updateGo').focus();
  }
  function available(version) {
    if (!valid(version) || version === current || applying || reloading) return;
    target = version; block();
    el('updateTitle').textContent = 'Nova versão disponível';
    el('updateText').textContent = 'Tem novidade no Genésio! Atualize para continuar jogando com a versão mais recente.';
    el('updateStatus').textContent = 'Atualizar reinicia a partida atual. Moedas e recordes já salvos são mantidos.';
    el('updateSpinner').hidden = true; el('updateGo').hidden = false; el('updateGo').textContent = 'Atualizar agora'; el('updateGo').focus();
  }
  async function workerVersion(worker) {
    if (!worker) return null;
    return new Promise(resolve => {
      const channel = new MessageChannel();
      const timer = setTimeout(() => { channel.port1.close(); resolve(null); }, 1200);
      channel.port1.onmessage = e => { clearTimeout(timer); channel.port1.close(); resolve(valid(e.data?.version) ? e.data.version : null); };
      try { worker.postMessage({ type: 'GET_VERSION' }, [channel.port2]); }
      catch (e) { clearTimeout(timer); channel.port1.close(); resolve(null); }
    });
  }
  function reloadFresh() {
    if (reloading) return;
    reloading = true; clearTimeout(deadline); loading('Abrindo a nova versão...');
    try { sessionStorage.setItem(STORAGE, target || activeVersion || ''); } catch (e) {}
    // Deixa o loading ser pintado antes da navegação; o parâmetro evita reutilizar HTML antigo.
    setTimeout(() => { const next = new URL(location.href); next.searchParams.set('_v', target || activeVersion || Date.now()); location.replace(next.href); }, 350);
  }
  async function apply() {
    if (applying || reloading) return;
    applying = true; loading('Preparando a nova versão...');
    deadline = setTimeout(() => error('A atualização demorou mais que o esperado.'), 45000);
    try {
      if (registrationPromise) await registrationPromise;
      if (!registration) {
        const response = await fetch('index.html?_v=' + encodeURIComponent(target || ''), { cache: 'no-store' });
        if (!response.ok) throw Error('download');
        reloadFresh(); return;
      }
      activeVersion = await workerVersion(navigator.serviceWorker.controller);
      if (activeVersion === target && activeVersion !== current) { reloadFresh(); return; }
      if (registration.waiting) registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      await registration.update();
      activeVersion = await workerVersion(navigator.serviceWorker.controller);
      if (activeVersion === target && activeVersion !== current) reloadFresh();
    } catch (e) { error('Não conseguimos baixar a nova versão agora.'); }
  }
  function watch(worker) {
    if (!worker) return;
    let becameActive = worker.state === 'activated';
    worker.addEventListener('statechange', async () => {
      if (worker.state === 'activated') becameActive = true;
      if (worker.state === 'installed' && navigator.serviceWorker.controller) {
        const version = await workerVersion(worker); if (version) available(version);
      }
      // Um worker que já funcionou fica redundant ao ser substituído: isso é sucesso, não erro de download.
      if (worker.state === 'redundant' && !becameActive && applying) error('O download da atualização não terminou.');
    });
  }
  async function check(force = false) {
    if (checking || document.hidden || navigator.onLine === false || reloading || (!force && Date.now() - lastCheck < 15000)) return;
    checking = true; lastCheck = Date.now();
    try {
      if (current !== 'dev') {
        const response = await fetch('version.json?check=' + Date.now(), { cache: 'no-store' });
        if (response.ok) { const next = await response.json(); available(next.version); }
      }
      await registration?.update();
    } catch (e) { /* Offline: a versão já instalada continua funcionando. */ }
    finally { checking = false; }
  }
  function init() {
    if (started) return; started = true;
    el('updateGo').addEventListener('click', apply);
    // A atualização fica legível também em pé; o teclado não aciona o jogo por trás da tela.
    addEventListener('keydown', e => {
      if (!blocking) return;
      e.stopImmediatePropagation();
      if (e.key === 'Tab') { e.preventDefault(); if (!el('updateGo').hidden) el('updateGo').focus(); }
    }, true);
    let pending = null;
    try { pending = sessionStorage.getItem(STORAGE); } catch (e) {}
    if (pending !== null) {
      target = pending; loading('Carregando a nova versão...');
      const timer = setInterval(() => {
        if (typeof ready === 'undefined' || !ready) return;
        clearInterval(timer); clearTimeout(deadline);
        if (valid(pending) && current !== pending) { error('O servidor ainda está preparando a nova versão.'); return; }
        try { sessionStorage.removeItem(STORAGE); } catch (e) {}
        blocking = false; el('updateOverlay').hidden = true; el('updateOverlay').classList.remove('active');
      }, 100);
      deadline = setTimeout(() => { clearInterval(timer); error('A nova versão ainda não terminou de carregar.'); }, 45000);
    }
    const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
    if ('serviceWorker' in navigator && (!local || /[?&]sw=1/.test(location.search))) {
      navigator.serviceWorker.addEventListener('message', e => {
        const data = e.data;
        if (!valid(data?.version) || data.version === current) return;
        if (data.type === 'UPDATE_PROGRESS' && applying) {
          target = data.version;
          const percentage = Math.round(data.done / Math.max(1, data.total) * 100);
          el('updateText').textContent = `Baixando a nova versão... ${percentage}%`;
          el('updateStatus').textContent = `${data.done} de ${data.total} arquivos preparados`;
        } else if (data.type === 'UPDATE_ERROR' && applying) error('Não conseguimos baixar todos os arquivos da atualização.');
      });
      navigator.serviceWorker.addEventListener('controllerchange', async () => {
        activeVersion = await workerVersion(navigator.serviceWorker.controller);
        if (!activeVersion || activeVersion === current) return;
        if (applying) { target = activeVersion; reloadFresh(); } else available(activeVersion);
      });
      const register = () => {
        registrationPromise = navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(async reg => {
          registration = reg; watch(reg.installing);
          reg.addEventListener('updatefound', () => watch(reg.installing));
          if (reg.waiting) { const version = await workerVersion(reg.waiting); if (version) available(version); }
          check(); return reg;
        }).catch(() => null);
      };
      register();
    }
    setInterval(check, 90000);
    addEventListener('online', () => check()); addEventListener('focus', () => check());
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
    check();
  }
  return { init, check: () => check(true), isBlocking: () => blocking };
})();

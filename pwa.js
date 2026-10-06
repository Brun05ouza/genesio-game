// App instalável: registra o cache offline, mostra "Instalar" (Android/Chrome) ou como instalar no iPhone, e avisa de erros inesperados.
(() => {
  const body = document.body;
  const isStandalone = () => matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true;
  if (isStandalone()) body.classList.add('app');

  // service worker (não em localhost, para não atrapalhar o desenvolvimento; use ?sw=1 para testar)
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  if ('serviceWorker' in navigator && (!local || /[?&]sw=1/.test(location.search))) {
    addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  // instalar
  const bar = document.getElementById('installBar'), btnBar = document.getElementById('installGo'), btnX = document.getElementById('installX'), icon = document.getElementById('btnInstall');
  const help = document.getElementById('iosHelp'), helpOk = document.getElementById('iosHelpOk');
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let deferred = null;
  const dismissedAt = () => { try { return +localStorage.getItem('genesio-install-dismissed') || 0; } catch (e) { return 0; } };
  function refresh() {
    const ok = !isStandalone() && (deferred || isIOS);
    if (icon) icon.hidden = !ok;
    if (bar) bar.hidden = !(ok && Date.now() - dismissedAt() > 7 * 864e5);
  }
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; refresh(); });
  addEventListener('appinstalled', () => { deferred = null; body.classList.add('app'); refresh(); });
  async function install() {
    if (deferred) { deferred.prompt(); try { await deferred.userChoice; } catch (e) {} deferred = null; refresh(); }
    else if (isIOS && help) help.hidden = false;
  }
  if (btnBar) btnBar.addEventListener('click', install);
  if (icon) icon.addEventListener('click', install);
  if (btnX) btnX.addEventListener('click', () => { try { localStorage.setItem('genesio-install-dismissed', Date.now()); } catch (e) {} bar.hidden = true; });
  if (helpOk) helpOk.addEventListener('click', () => { help.hidden = true; });
  refresh();

  // erros inesperados: mostra o motivo e um botão para recarregar (ajuda a descobrir problemas no celular)
  const err = document.getElementById('errBar'), errMsg = document.getElementById('errMsg');
  let shown = 0;
  function report(msg) {
    if (!err || shown >= 2 || !msg || /ResizeObserver|^Script error/i.test(String(msg))) return;
    shown++; errMsg.textContent = String(msg).slice(0, 140); err.hidden = false;
  }
  addEventListener('error', e => report(e.message || (e.error && e.error.message)));
  addEventListener('unhandledrejection', e => report(e.reason && (e.reason.message || e.reason)));
  const er = document.getElementById('errReload'), ex = document.getElementById('errX');
  if (er) er.addEventListener('click', () => location.reload());
  if (ex) ex.addEventListener('click', () => { err.hidden = true; });
})();

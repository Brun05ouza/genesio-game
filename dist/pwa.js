// App instalável: registra o cache offline, mostra "Instalar" (Android/Chrome) ou como instalar no iPhone, e avisa de erros inesperados.
(() => {
  const body = document.body;
  const isStandalone = () => matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true;
  if (isStandalone()) body.classList.add('app');

  Updater.init();

  // instalar
  const bar = document.getElementById('installBar'), btnBar = document.getElementById('installGo'), btnX = document.getElementById('installX'), icon = document.getElementById('btnInstall');
  const help = document.getElementById('iosHelp'), helpOk = document.getElementById('iosHelpOk');
  const ua = navigator.userAgent || '';
  const isIPad = /iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isIOS = /iPhone|iPod/.test(ua) || isIPad;
  const iosVer = (ua.match(/OS (\d+)[_.](\d+)/) || [0, 0, 0]).slice(1).map(Number);
  const newIOS = iosVer[0] > 16 || (iosVer[0] === 16 && iosVer[1] >= 4);               // iOS 16.4+: outros navegadores também instalam
  const inApp = /FBAN|FBAV|FB_IAB|Instagram|Line\/|MicroMessenger|WhatsApp|TikTok|musical_ly|Snapchat|Twitter|LinkedInApp|Pinterest|GSA\//i.test(ua);
  const browser = inApp ? 'inapp' : /CriOS/.test(ua) ? 'chrome' : /EdgiOS/.test(ua) ? 'edge' : /FxiOS/.test(ua) ? 'firefox' : /OPiOS|OPT\//.test(ua) ? 'other' : 'safari';
  const device = isIPad ? 'iPad' : 'iPhone';
  let deferred = null;
  const store = { get: k => { try { return +localStorage.getItem(k) || 0; } catch (e) { return 0; } }, set: k => { try { localStorage.setItem(k, Date.now()); } catch (e) {} } };
  function refresh() {
    const ok = !isStandalone() && (deferred || isIOS);
    if (icon) icon.hidden = !ok;
    if (bar) bar.hidden = !(ok && Date.now() - store.get('genesio-install-dismissed') > 7 * 864e5);
  }
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; refresh(); });
  addEventListener('appinstalled', () => { deferred = null; body.classList.add('app'); refresh(); });

  // iPhone/iPad: a Apple não deixa o site instalar sozinho; mostramos o passo certo para o navegador da pessoa
  const SHARE = '<span class="ico-share">⬆︎</span>';
  const li = a => a.map(t => '<li>' + t + '</li>').join('');
  function iosGuide() {
    const add = ['Role e toque em <b>Adicionar à Tela de Início</b>.', 'Toque em <b>Adicionar</b>. Pronto: o Genésio abre como app, em tela cheia.'];
    const toSafari = ['Abra este link no <b>Safari</b> (o navegador azul com bússola).', 'Toque em <b>Compartilhar</b> ' + SHARE + ' → <b>Adicionar à Tela de Início</b>.'];
    if (browser === 'inapp') return { title: 'Abra no Safari para instalar', copy: true, note: 'Este navegador (Instagram, WhatsApp, etc.) não permite instalar. Copie o link e cole no Safari, ou use ⋯ / compartilhar → "Abrir no Safari".', steps: li(toSafari) };
    if (browser === 'safari') return { title: 'Instalar no ' + device, arrow: true, note: isIPad ? 'O botão Compartilhar fica no canto superior da barra do Safari.' : 'O botão Compartilhar fica na barra de baixo do Safari. Se não aparecer, deixe o celular em pé.',
      steps: li(['Toque em <b>Compartilhar</b> ' + SHARE + ' na barra do Safari.'].concat(add)) };
    if (!newIOS) return { title: 'Instalar pelo Safari', copy: true, note: 'Neste iOS só o Safari consegue instalar. Copie o link e cole nele.', steps: li(toSafari) };
    const name = { chrome: 'Chrome', edge: 'Edge', firefox: 'Firefox', other: 'navegador' }[browser];
    return { title: 'Instalar pelo ' + name, copy: true, note: 'Se não encontrar a opção, abra o link no Safari: lá o caminho é sempre o mesmo.',
      steps: li(['Toque em <b>Compartilhar</b> ' + SHARE + ' (na barra de endereço) ou no menu <b>⋯</b>.'].concat(add)) };
  }
  const arrow = document.getElementById('iosArrow'), copyBtn = document.getElementById('iosCopy');
  function openIosHelp() {
    const g = iosGuide();
    document.getElementById('iosTitle').textContent = g.title;
    document.getElementById('iosSteps').innerHTML = g.steps;
    document.getElementById('iosNote').textContent = g.note;
    copyBtn.hidden = !g.copy; copyBtn.textContent = 'Copiar link';
    arrow.hidden = !g.arrow; arrow.className = isIPad ? 'top' : 'bottom';
    help.hidden = false;
  }
  function closeIosHelp() { help.hidden = true; store.set('genesio-ios-seen'); }
  async function install() {
    if (deferred) { deferred.prompt(); try { await deferred.userChoice; } catch (e) {} deferred = null; refresh(); }
    else if (isIOS && help) openIosHelp();
  }
  if (copyBtn) copyBtn.addEventListener('click', async () => {
    const url = location.origin + location.pathname;
    try { await navigator.clipboard.writeText(url); copyBtn.textContent = 'Link copiado ✓'; }
    catch (e) {
      const t = document.createElement('textarea'); t.value = url; document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); copyBtn.textContent = 'Link copiado ✓'; } catch (e2) { copyBtn.textContent = url; }
      t.remove();
    }
  });
  if (btnBar) btnBar.addEventListener('click', install);
  if (icon) icon.addEventListener('click', install);
  if (btnX) btnX.addEventListener('click', () => { store.set('genesio-install-dismissed'); bar.hidden = true; });
  if (helpOk) helpOk.addEventListener('click', closeIosHelp);
  refresh();
  // primeira visita no iPhone/iPad: mostra o passo a passo sozinho (uma vez), com o jogo no menu
  if (isIOS && !isStandalone() && !store.get('genesio-ios-seen')) {
    const t = setInterval(() => { if (typeof state !== 'undefined' && state === 'menu' && !document.querySelector('.screen.active:not(#menu)')) { clearInterval(t); setTimeout(openIosHelp, 1200); } }, 500);
    setTimeout(() => clearInterval(t), 60000);
  }
  window.__pwa = { iosGuide, browser, openIosHelp };

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

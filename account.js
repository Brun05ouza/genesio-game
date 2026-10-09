// Conta do jogador: login/cadastro (nome + senha) e sincronização das GenesisCoins e recordes com a API (server/).
// As fases continuam lendo e gravando no localStorage como sempre; este módulo percebe o que mudou e envia para a conta:
//   - moedas: só o que foi GANHO desde o último envio (assim duas telas abertas não apagam moedas uma da outra)
//   - recordes: o servidor guarda sempre o maior valor
// Sem servidor (localhost, Netlify, sem internet e sem conta) o jogo segue como antes, salvando só no aparelho.
const Account = (() => {
  const API = (window.GENESIO_API || '/api').replace(/\/$/, '');
  const PROGRESS = /^genesio-(coins|best-(facil|normal|dificil)|nature-best-[a-z]+|climb-best|hop-best|flow-best|solar-cleared)$/;
  const SESSION_KEY = 'genesio-session';
  const $ = id => document.getElementById(id);
  const ls = window.localStorage;
  const rawSet = Storage.prototype.setItem, rawRemove = Storage.prototype.removeItem;
  const lsGet = k => { try { return ls.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { rawSet.call(ls, k, v); } catch (e) {} };
  const lsDel = k => { try { rawRemove.call(ls, k); } catch (e) {} };

  let session = null;            // { token, name }
  let pending = { coins: 0, scores: {} };
  let applying = false, flushTimer = null, flushing = false, online = null;
  try { session = JSON.parse(lsGet(SESSION_KEY) || 'null'); } catch (e) { session = null; }
  const pendingKey = () => 'genesio-pending-' + (session ? session.name.toLowerCase() : '');
  const loadPending = () => { try { pending = Object.assign({ coins: 0, scores: {} }, JSON.parse(lsGet(pendingKey()) || '{}')); } catch (e) { pending = { coins: 0, scores: {} }; } };
  const savePending = () => lsSet(pendingKey(), JSON.stringify(pending));
  if (session) loadPending();
  const hasPending = () => pending.coins > 0 || Object.keys(pending.scores).length > 0;

  // ---- percebe as gravações das fases ----
  Storage.prototype.setItem = function (k, v) {
    if (this === ls && session && !applying && PROGRESS.test(k)) {
      if (k === 'genesio-coins') { const d = (+v || 0) - (+lsGet(k) || 0); if (d > 0) pending.coins += d; }
      else { const n = k === 'genesio-solar-cleared' ? (v === '1' ? 1 : 0) : (+v || 0); if (n > 0) pending.scores[k] = Math.max(pending.scores[k] || 0, n); }
      savePending(); schedule();
    }
    return rawSet.call(this, k, v);
  };

  // ---- rede ----
  async function call(method, route, body, opts = {}) {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), opts.timeout || 8000);
    try {
      const r = await fetch(API + route, {
        method, signal: ctl.signal, keepalive: !!opts.keepalive, cache: 'no-store',
        headers: Object.assign({ 'Content-Type': 'application/json' }, session ? { Authorization: 'Bearer ' + session.token } : {}),
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await r.json().catch(() => ({}));
      return { status: r.status, data };
    } finally { clearTimeout(t); }
  }
  async function serverUp() {
    try { const r = await call('GET', '/health', null, { timeout: 3000 }); return r.status === 200 && r.data && r.data.ok === true; }
    catch (e) { return false; }
  }

  // ---- aplica no aparelho o que está na conta (+ o que ainda não foi enviado) ----
  function applyProfile(p) {
    applying = true;
    try {
      for (let i = ls.length - 1; i >= 0; i--) { const k = ls.key(i); if (k && PROGRESS.test(k)) lsDel(k); }   // nada de outra conta fica no aparelho
      lsSet('genesio-coins', String((p.coins || 0) + pending.coins));
      const all = Object.assign({}, p.scores || {});
      for (const [k, v] of Object.entries(pending.scores)) all[k] = Math.max(all[k] || 0, v);
      for (const [k, v] of Object.entries(all)) lsSet(k, k === 'genesio-solar-cleared' ? (v ? '1' : '0') : String(v));
    } finally { applying = false; }
    refreshChip();
  }

  // ---- envio (com atraso curto, em lote) ----
  function schedule(ms = 1500) { clearTimeout(flushTimer); flushTimer = setTimeout(() => flush(), ms); }
  async function flush(keepalive) {
    if (!session || flushing || !hasPending()) return;
    flushing = true;
    const sent = { coins: pending.coins, scores: Object.assign({}, pending.scores) };
    try {
      const r = await call('POST', '/progress', sent, { keepalive });
      if (r.status === 200) {
        pending.coins = Math.max(0, pending.coins - sent.coins);
        for (const [k, v] of Object.entries(sent.scores)) if (pending.scores[k] === v) delete pending.scores[k];
        savePending(); online = true;
      } else if (r.status === 401) expired();
    } catch (e) { online = false; schedule(30000); }
    finally { flushing = false; if (hasPending() && online) schedule(); }
  }
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(true); });
  addEventListener('online', () => { if (session) { schedule(500); refreshProfile(); } });
  setInterval(() => { if (hasPending()) flush(); }, 30000);

  async function refreshProfile() {
    if (!session) return;
    try {
      await flush();
      const r = await call('GET', '/me');
      if (r.status === 200) { online = true; applyProfile(r.data.profile); }
      else if (r.status === 401) expired();
    } catch (e) { online = false; }
  }
  function expired() {
    endSession();
    if (typeof state !== 'undefined' && (state === 'menu' || state === 'login')) openLogin('Sua sessão expirou. Entre de novo.');
  }
  function startSession(token, profile, keepGuest) {
    // conta nova: o que a pessoa já tinha jogado neste aparelho (sem conta) vai junto
    let carry = { coins: 0, scores: {} };
    if (keepGuest) for (let i = 0; i < ls.length; i++) {
      const k = ls.key(i); if (!k || !PROGRESS.test(k)) continue;
      const v = lsGet(k);
      if (k === 'genesio-coins') carry.coins = +v || 0;
      else { const n = k === 'genesio-solar-cleared' ? (v === '1' ? 1 : 0) : (+v || 0); if (n > 0) carry.scores[k] = n; }
    }
    session = { token, name: profile.name }; lsSet(SESSION_KEY, JSON.stringify(session));
    loadPending();
    pending.coins += carry.coins; Object.assign(pending.scores, carry.scores); savePending();
    applyProfile(profile);
    if (hasPending()) schedule(300);
  }
  function endSession() {
    applying = true;
    try { for (let i = ls.length - 1; i >= 0; i--) { const k = ls.key(i); if (k && PROGRESS.test(k)) lsDel(k); } } finally { applying = false; }
    session = null; lsDel(SESSION_KEY); pending = { coins: 0, scores: {} };
    refreshChip();
  }

  // ---- tela de login / cadastro ----
  let mode = 'login';
  function setMode(m) {
    mode = m;
    $('acTabLogin').classList.toggle('on', m === 'login'); $('acTabNew').classList.toggle('on', m === 'new');
    $('acTabLogin').setAttribute('aria-selected', m === 'login'); $('acTabNew').setAttribute('aria-selected', m === 'new');
    $('acPass2Row').hidden = m !== 'new';
    $('acPass').autocomplete = m === 'new' ? 'new-password' : 'current-password';
    $('acSubmit').textContent = m === 'new' ? 'Criar conta' : 'Entrar';
    $('acHint').textContent = m === 'new' ? 'Escolha um nome (3 a 20 letras ou números) e uma senha de pelo menos 6 caracteres.' : 'Sua conta guarda suas GenesisCoins e seus recordes em qualquer aparelho.';
    msg('');
  }
  function msg(t, ok) { const e = $('acMsg'); e.textContent = t; e.classList.toggle('ok', !!ok); }
  function openLogin(text) {
    setMode(mode); if (typeof show === 'function') show('login');
    if (text) msg(text);
    setTimeout(() => { if (!matchMedia('(pointer: coarse)').matches) $('acName').focus(); }, 50);
  }
  async function submit(e) {
    e.preventDefault();
    const name = $('acName').value.trim(), password = $('acPass').value;
    if (name.length < 3) return msg('Digite seu nome (pelo menos 3 letras).');
    if (password.length < 6) return msg('A senha precisa ter pelo menos 6 caracteres.');
    if (mode === 'new' && password !== $('acPass2').value) return msg('As duas senhas não são iguais.');
    const btn = $('acSubmit'); btn.disabled = true; msg(mode === 'new' ? 'Criando sua conta...' : 'Entrando...', true);
    try {
      const r = await call('POST', mode === 'new' ? '/register' : '/login', { name, password });
      if ((r.status === 200 || r.status === 201) && r.data.token) {
        startSession(r.data.token, r.data.profile, mode === 'new');
        $('acPass').value = ''; $('acPass2').value = '';
        msg('');
        if (typeof show === 'function') show('menu');
        if (typeof toast === 'function') toast((mode === 'new' ? 'Conta criada! Bem-vindo, ' : 'Olá de novo, ') + r.data.profile.name + '!', 2600);
      } else msg(r.data.error || 'Não foi possível entrar agora. Tente de novo.');
    } catch (err) { msg('Sem conexão com o servidor. Verifique a internet e tente de novo.'); }
    finally { btn.disabled = false; }
  }
  function refreshChip() {
    if (typeof refreshProfileCard === 'function') refreshProfileCard();
  }
  async function logout() {
    if (typeof Sound !== 'undefined') { Sound.init(); Sound.click(); }
    try { await flush(); } catch (e) {}
    try { await call('POST', '/logout', null, { timeout: 3000 }); } catch (e) {}
    endSession(); mode = 'login'; $('acName').value = '';
    openLogin('Você saiu da conta.');
  }

  function wire() {
    $('acForm').addEventListener('submit', submit);
    $('acTabLogin').addEventListener('click', () => setMode('login'));
    $('acTabNew').addEventListener('click', () => setMode('new'));
    $('acLogout').addEventListener('click', logout);
    $('acLogin').addEventListener('click', async () => {
      if (typeof Sound !== 'undefined') { Sound.init(); Sound.click(); }
      openLogin();
      if (!(await serverUp())) msg('O servidor de contas não respondeu. Você pode tentar entrar mesmo assim ou jogar sem conta.');
    });
    $('acGuest').addEventListener('click', () => {
      if (typeof Sound !== 'undefined') { Sound.init(); Sound.click(); }
      if (typeof show === 'function') show('menu');
    });
    refreshChip();
  }
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', wire); else wire();

  // chamado pelo game.js quando o carregamento inicial termina: decide entre menu e login
  // (a tela de carregamento continua até a resposta; se algo já mudou de tela nesse meio-tempo, não mexe)
  async function gate() {
    if (session) { show('menu'); refreshProfile(); return; }
    online = await serverUp();
    if (state !== 'loading') return;
    if (online) openLogin(); else show('menu');      // sem servidor: joga sem conta (salva só no aparelho)
  }

  return { gate, logout, flush, openLogin, isLogged: () => !!session, user: () => session && session.name, _pending: () => pending };
})();

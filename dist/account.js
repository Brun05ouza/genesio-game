// Conta do jogador: login/cadastro (nome + senha) e sincronização das GenesisCoins e recordes com a API (server/).
// As fases continuam lendo e gravando no localStorage como sempre; este módulo percebe o que mudou e envia para a conta:
//   - moedas: só o que foi GANHO desde o último envio (assim duas telas abertas não apagam moedas uma da outra)
//   - recordes: maior pontuação; menor tempo para a missão dos EPIs
//   - tudo vai junto com a partida em que aconteceu (runStart): o servidor confere se é possível no tempo jogado
// Sem servidor (localhost, Netlify, sem internet e sem conta) o jogo segue como antes, salvando só no aparelho.
const Account = (() => {
  const API = (window.GENESIO_API || '/api').replace(/\/$/, '');
  const PROGRESS = /^genesio-(coins|best-(facil|normal|dificil)|nature-best-[a-z]+|nature-time-epi|climb-best|hop-best|flow-best|solar-best(-(facil|normal|dificil))?|solar-cleared)$/;
  const bestValue = (key, a, b) => key === 'genesio-nature-time-epi' ? (a > 0 ? Math.min(a, b) : b) : Math.max(a || 0, b);
  const SESSION_KEY = 'genesio-session';
  const $ = id => document.getElementById(id);
  const ls = window.localStorage;
  const rawSet = Storage.prototype.setItem, rawRemove = Storage.prototype.removeItem;
  const lsGet = k => { try { return ls.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { rawSet.call(ls, k, v); } catch (e) {} };
  const lsDel = k => { try { rawRemove.call(ls, k); } catch (e) {} };

  let session = null;            // { token, name, avatar }
  let pending = { runs: {} };      // { [idLocal]: { game, server, coins, scores, at } }
  let current = null;              // partida em andamento (idLocal)
  let applying = false, flushTimer = null, flushing = false, online = null;
  try { session = JSON.parse(lsGet(SESSION_KEY) || 'null'); } catch (e) { session = null; }
  const pendingKey = () => 'genesio-pending-' + (session ? session.name.toLowerCase() : '');
  const loadPending = () => {
    try { pending = JSON.parse(lsGet(pendingKey()) || '{}'); } catch (e) { pending = {}; }
    if (!pending || typeof pending.runs !== 'object') pending = { runs: {} };      // formato antigo (sem partida): descartado
    for (const [id, r] of Object.entries(pending.runs)) if (!r || Date.now() - (r.at || 0) > 3 * 3600e3) delete pending.runs[id];
  };
  const savePending = () => lsSet(pendingKey(), JSON.stringify(pending));
  if (session) loadPending();
  const bucketHas = r => r.coins > 0 || Object.keys(r.scores).length > 0;
  const hasPending = () => Object.values(pending.runs).some(r => r.server && bucketHas(r));
  const pendingTotals = () => {                          // soma de tudo que ainda não foi enviado (para mostrar no aparelho)
    const t = { coins: 0, scores: {} };
    for (const r of Object.values(pending.runs)) { t.coins += r.coins; for (const [k, v] of Object.entries(r.scores)) t.scores[k] = bestValue(k, t.scores[k], v); }
    return t;
  };

  // ---- percebe as gravações das fases ----
  Storage.prototype.setItem = function (k, v) {
    if (this === ls && session && !applying && PROGRESS.test(k)) {
      const b = current && pending.runs[current];          // fora de uma partida nada é enviado (o servidor recusaria)
      if (b) {
        if (k === 'genesio-coins') { const d = (+v || 0) - (+lsGet(k) || 0); if (d > 0) b.coins += d; }
        else { const n = k === 'genesio-solar-cleared' ? (v === '1' ? 1 : 0) : (+v || 0); if (n > 0) b.scores[k] = bestValue(k, b.scores[k], n); }
        savePending(); schedule();
      }
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
    if (session && p) {                                   // nome/foto podem ter mudado em outro aparelho
      const oldKey = pendingKey();
      if (p.name && p.name !== session.name) { session.name = p.name; lsDel(oldKey); savePending(); }
      if (p.avatar) session.avatar = p.avatar;
      if (p.skin) session.skin = p.skin;
      lsSet(SESSION_KEY, JSON.stringify(session));
    }
    applying = true;
    try {
      for (let i = ls.length - 1; i >= 0; i--) { const k = ls.key(i); if (k && PROGRESS.test(k)) lsDel(k); }   // nada de outra conta fica no aparelho
      const pt = pendingTotals();
      lsSet('genesio-coins', String((p.coins || 0) + pt.coins));
      const all = Object.assign({}, p.scores || {});
      for (const [k, v] of Object.entries(pt.scores)) all[k] = bestValue(k, all[k], v);
      for (const [k, v] of Object.entries(all)) lsSet(k, k === 'genesio-solar-cleared' ? (v ? '1' : '0') : String(v));
    } finally { applying = false; }
    refreshChip();
  }

  // ---- envio (com atraso curto, em lote) ----
  function schedule(ms = 1500) { clearTimeout(flushTimer); flushTimer = setTimeout(() => flush(), ms); }
  async function flush(keepalive) {
    if (!session || flushing || !hasPending()) return;
    flushing = true;
    let changed = false;
    try {
      for (const [id, r] of Object.entries(pending.runs)) {
        if (!r.server || !bucketHas(r)) continue;
        const sent = { run: r.server, coins: r.coins, scores: Object.assign({}, r.scores) };
        const res = await call('POST', '/progress', sent, { keepalive });
        if (res.status === 200 || res.status === 409) {   // 409 = partida encerrada: não adianta reenviar
          r.coins = Math.max(0, r.coins - sent.coins);
          for (const [k, v] of Object.entries(sent.scores)) if (r.scores[k] === v) delete r.scores[k];
          if (id !== current && !bucketHas(r)) delete pending.runs[id];
          if (res.data && res.data.profile) { lastProfile = res.data.profile; changed = true; }
          online = true;
        } else if (res.status === 401) { expired(); return; }
        else if (res.status === 429) { schedule(20000); break; }
      }
      savePending();
      if (changed && lastProfile) applyProfile(lastProfile);   // o aparelho mostra o que o servidor aceitou
    } catch (e) { online = false; schedule(30000); }
    finally { flushing = false; if (hasPending() && online) schedule(); }
  }
  let lastProfile = null;
  // ---- partidas: cada fase avisa quando começa; moedas e recordes vão junto com ela ----
  async function runStart(game) {
    if (!session) return;
    const id = Math.random().toString(36).slice(2);
    if (current && pending.runs[current] && !bucketHas(pending.runs[current])) delete pending.runs[current];
    current = id; pending.runs[id] = { game, server: null, coins: 0, scores: {}, at: Date.now() }; savePending();
    try {
      const r = await call('POST', '/run', { game });
      if (r.status === 200 && r.data.run && pending.runs[id]) { pending.runs[id].server = r.data.run; savePending(); if (bucketHas(pending.runs[id])) schedule(300); }
      else if (r.status === 401) expired();
    } catch (e) { /* sem internet: o que for ganho nesta partida fica só no aparelho */ }
  }
  function runEnd() { if (current) { const b = pending.runs[current]; current = null; if (b && !bucketHas(b)) for (const [k, v] of Object.entries(pending.runs)) if (v === b) delete pending.runs[k]; savePending(); schedule(300); } }
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
    // (o progresso de visitante não é transferido: o servidor só aceita o que foi jogado com a conta, partida a partida)
    session = { token, name: profile.name, avatar: profile.avatar || 'a', skin: profile.skin || 'classico' }; lsSet(SESSION_KEY, JSON.stringify(session));
    loadPending();
    applyProfile(profile);
    if (hasPending()) schedule(300);
  }
  function endSession() {
    applying = true;
    try { for (let i = ls.length - 1; i >= 0; i--) { const k = ls.key(i); if (k && PROGRESS.test(k)) lsDel(k); } } finally { applying = false; }
    session = null; lsDel(SESSION_KEY); pending = { runs: {} }; current = null;
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

  // ---- perfil: nome, foto e senha ----
  async function updateProfile(fields) {
    if (!session) return { error: 'Entre na sua conta primeiro.' };
    try {
      const r = await call('POST', '/profile', fields);
      if (r.status === 200) { applyProfile(r.data.profile); return { ok: true, profile: r.data.profile }; }
      if (r.status === 401) { expired(); return { error: 'Sua sessão expirou. Entre de novo.' }; }
      return { error: r.data.error || 'Não foi possível salvar agora.' };
    } catch (e) { return { error: 'Sem conexão com o servidor. Tente de novo.' }; }
  }
  async function changePassword(current, password) {
    if (!session) return { error: 'Entre na sua conta primeiro.' };
    try {
      const r = await call('POST', '/password', { current, password });
      if (r.status === 200) return { ok: true };
      if (r.status === 401) { expired(); return { error: 'Sua sessão expirou. Entre de novo.' }; }
      return { error: r.data.error || 'Não foi possível trocar a senha agora.' };
    } catch (e) { return { error: 'Sem conexão com o servidor. Tente de novo.' }; }
  }

  return { gate, logout, flush, openLogin, runStart, runEnd, updateProfile, changePassword, isLogged: () => !!session, user: () => session && session.name,
    avatar: () => (session && session.avatar) || 'a', skin: () => (session && session.skin) || 'classico',
    // imagem que representa a pessoa: a roupa escolhida, ou a foto do Genésio clássico
    picture: () => { const s = session && session.skin; return s && s !== 'classico' ? 'assets/skins/' + s + '.webp' : 'assets/menu-g-' + ((session && session.avatar) || 'a') + '.webp'; },
    token: () => session && session.token, _pending: () => pending };
})();

// Ranking: quadro no lobby (mostra os 3 com mais GenesisCoins) e a tela com os melhores de cada empreendimento.
// Os dados vêm da API (GET /api/ranking?key=...). Sem servidor, a tela avisa que o ranking está indisponível.
const Ranking = (() => {
  const API = (window.GENESIO_API || '/api').replace(/\/$/, '');
  const $ = id => document.getElementById(id);
  const fmt = n => Number(n || 0).toLocaleString('pt-BR');
  // empreendimentos e suas tabelas (a primeira é a que abre)
  const GROUPS = [
    { id: 'geral', name: 'Geral', icon: '🪙', boards: [{ key: 'coins', name: 'GenesisCoins', unit: v => '🪙 ' + fmt(v) }] },
    { id: 'oasis', name: 'Oásis Residencial', logo: 'assets/logos/Oasis.png', boards: [
      { key: 'genesio-best-facil', name: 'Fácil', unit: v => fmt(v) + ' pts' },
      { key: 'genesio-best-normal', name: 'Normal', unit: v => fmt(v) + ' pts' },
      { key: 'genesio-best-dificil', name: 'Difícil', unit: v => fmt(v) + ' pts' }] },
    { id: 'nature', name: 'Nature', logo: 'assets/logos/Nature.png', boards: [
      { key: 'genesio-nature-time-epi', name: 'EPIs', time: true, unit: v => (v / 1000).toFixed(2).replace('.', ',') + ' s' },
      { key: 'genesio-climb-best', name: 'Torre', unit: v => fmt(v) + ' m' },
      { key: 'genesio-hop-best', name: 'Subida infinita', unit: v => fmt(v) + ' pts' }] },
    { id: 'solar', name: 'Solar do Bosque', logo: 'assets/logos/solar-do-bosque.png', boards: [
      { key: 'genesio-solar-best-facil', name: 'Fácil', unit: v => fmt(v) + ' pts' },
      { key: 'genesio-solar-best', name: 'Normal', unit: v => fmt(v) + ' pts' },
      { key: 'genesio-solar-best-dificil', name: 'Difícil', unit: v => fmt(v) + ' pts' }] },
    { id: 'flow', name: 'Flow Residencial', logo: 'assets/logos/Flow.png', boards: [{ key: 'genesio-flow-best', name: 'Pilares', unit: v => fmt(v) + ' pilares' }] },
  ];
  let group = GROUPS[0], board = group.boards[0], back = 'playing', reqId = 0;
  const cache = {};                       // key -> { at, data }
  const pic = r => r.skin && r.skin !== 'classico' ? 'assets/skins/' + r.skin + '.png' : 'assets/menu-g-' + (r.avatar || 'a') + '.png';
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  async function fetchBoard(key, limit = 10) {
    const c = cache[key + ':' + limit];
    if (c && Date.now() - c.at < 20000) return c.data;
    let token = null; try { token = JSON.parse(localStorage.getItem('genesio-session') || 'null')?.token; } catch (e) {}
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 8000);
    try {
      const r = await fetch(`${API}/ranking?key=${encodeURIComponent(key)}&limit=${limit}`, { signal: ctl.signal, cache: 'no-store', headers: token ? { Authorization: 'Bearer ' + token } : {} });
      if (!r.ok) throw new Error('http ' + r.status);
      const data = await r.json();
      if (!Array.isArray(data.top)) throw new Error('resposta inválida');
      cache[key + ':' + limit] = { at: Date.now(), data };
      return data;
    } finally { clearTimeout(t); }
  }

  // ---- tela ----
  function tabs() {
    $('rkTabs').innerHTML = GROUPS.map(g => `<button type="button" class="rk-tab${g === group ? ' on' : ''}${g.logo ? ' rk-brand' : ' rk-general'}" data-g="${g.id}" role="tab" aria-selected="${g === group}" tabindex="${g === group ? 0 : -1}" aria-controls="rkResults">${g.logo ? `<img src="${g.logo}" alt="" width="48" height="48" draggable="false">` : '<span class="pc-coin" aria-hidden="true"></span>'}<span>${esc(g.name)}</span></button>`).join('');
    const sub = group.boards.length > 1;
    $('rkSub').hidden = !sub;
    $('rkSub').innerHTML = sub ? group.boards.map(b => `<button type="button" class="rk-subtab${b === board ? ' on' : ''}" data-k="${b.key}">${esc(b.name)}</button>`).join('') : '';
    $('rkTitle2').textContent = group.name + (sub ? ' · ' + board.name + (board.time ? ' · menor tempo para os 8 EPIs' : '') : group.id === 'geral' ? ' · mais GenesisCoins' : '');
  }
  function row(r, rank, isMe) {
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank + 'º';
    return `<li class="rk-row${rank <= 3 ? ' top' + rank : ''}${isMe ? ' me' : ''}">
      <span class="rk-pos">${medal}</span><img src="${pic(r)}" alt="" draggable="false"><b class="rk-name">${esc(r.name)}${isMe ? ' <small>(você)</small>' : ''}</b>
      <span class="rk-val">${esc(board.unit(r.value))}</span></li>`;
  }
  async function load() {
    const id = ++reqId, key = board.key;
    $('rkList').innerHTML = '<li class="rk-info">Carregando...</li>'; $('rkMe').hidden = true;
    let data;
    try { data = await fetchBoard(key); } catch (e) {
      if (id !== reqId) return;
      $('rkList').innerHTML = '<li class="rk-info">O ranking precisa do servidor de contas, e ele não respondeu agora. Tente de novo daqui a pouco.</li>';
      return;
    }
    if (id !== reqId) return;
    const me = typeof Account !== 'undefined' && Account.user();
    if (!data.top.length) { $('rkList').innerHTML = '<li class="rk-info">' + (board.time ? 'Colete os 8 EPIs para registrar seu tempo. O menor tempo vence! ⏱' : 'Ninguém pontuou aqui ainda. Que tal ser o primeiro? 🏁') + '</li>'; }
    else $('rkList').innerHTML = data.top.map((r, i) => row(r, i + 1, me && data.me && data.me.rank === i + 1)).join('');
    const inTop = data.me && data.me.rank <= data.top.length;
    if (data.me && !inTop) { $('rkMe').hidden = false; $('rkMe').innerHTML = '<p>Sua posição</p><ul class="rk-list">' + row(data.me, data.me.rank, true) + '</ul>'; }
    else if (me && !data.me && data.top.length) { $('rkMe').hidden = false; $('rkMe').innerHTML = '<p>Você ainda não pontuou aqui. Jogue para entrar no ranking!</p>'; }
    else if (!me) { $('rkMe').hidden = false; $('rkMe').innerHTML = '<p>Entre na sua conta para aparecer no ranking.</p>'; }
    $('rkCount').textContent = data.total ? data.total + (data.total === 1 ? ' jogador' : ' jogadores') : '';
  }
  function open() {
    back = typeof state !== 'undefined' && state === 'menu' ? 'menu' : 'playing';
    for (const k in keys) keys[k] = false;
    tabs(); show('ranking'); load();
  }
  function close() { show(back); }
  function wire() {
    $('rkTabs').addEventListener('click', e => {
      const b = e.target.closest('[data-g]'); if (!b) return;
      Sound.init(); Sound.click();
      group = GROUPS.find(g => g.id === b.dataset.g); board = group.boards[0]; tabs(); load();
      $('rkTabs').querySelector(`[data-g="${group.id}"]`).focus();
    });
    $('rkTabs').addEventListener('keydown', e => {
      if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
      e.preventDefault();
      const i = GROUPS.indexOf(group), next = e.key === 'Home' ? 0 : e.key === 'End' ? GROUPS.length - 1
        : (i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1) + GROUPS.length) % GROUPS.length;
      $('rkTabs').querySelector(`[data-g="${GROUPS[next].id}"]`).click();
    });
    $('rkSub').addEventListener('click', e => {
      const b = e.target.closest('[data-k]'); if (!b) return;
      Sound.init(); Sound.click();
      board = group.boards.find(x => x.key === b.dataset.k); tabs(); load();
    });
    $('rkClose').addEventListener('click', () => { Sound.init(); Sound.click(); close(); });
  }
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', wire); else wire();

  // ---- quadro no lobby (desenhado no mapa): os 3 com mais GenesisCoins ----
  const BOARD = { x: 383, y: 290, w: 132 };          // lobby: no calçadão à esquerda do portal de Teresópolis
  let top3 = null, top3At = 0;
  function refreshTop3() {
    if (Date.now() - top3At < 30000) return;
    top3At = Date.now();
    fetchBoard('coins', 3).then(d => { top3 = d.top; }).catch(() => { top3 = null; });
  }
  let blocked = false, hover = false;
  function boardRect(cam, Z) {                 // retângulo do quadro em pixels do canvas
    const px = VW / 2 + (BOARD.x - cam.x) * Z, py = VH / 2 + (BOARD.y - cam.y) * Z;
    const w = BOARD.w * Z, h = 92 * Z, legs = 34 * Z;
    return { px, py, x: px - w / 2, y: py - legs - h, w, h, legs };
  }
  function draw(ctx, cam, Z) {
    refreshTop3();
    const r = boardRect(cam, Z);
    if (r.x > VW + 40 || r.x + r.w < -40 || r.y > VH + 40 || r.py < -40) return;
    ctx.save();
    // sombra e pés
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(r.px, r.py, r.w * .48, 6 * Z, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#6b4a2b'; ctx.strokeStyle = '#2a1a0c'; ctx.lineWidth = 2;
    for (const sx of [-.36, .36]) { ctx.fillRect(r.px + sx * r.w - 3 * Z, r.y + r.h - 4, 6 * Z, r.legs + 4); ctx.strokeRect(r.px + sx * r.w - 3 * Z, r.y + r.h - 4, 6 * Z, r.legs + 4); }
    // moldura e quadro
    if (hover) { ctx.shadowColor = '#fff3b0'; ctx.shadowBlur = 18 * Z; }
    ctx.fillStyle = '#8a5a2e'; ctx.beginPath(); ctx.roundRect(r.x - 5 * Z, r.y - 5 * Z, r.w + 10 * Z, r.h + 10 * Z, 6 * Z); ctx.fill(); ctx.shadowBlur = 0; ctx.stroke();
    ctx.fillStyle = '#1d5a3c'; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 4 * Z); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(r.x + 3 * Z, r.y + 3 * Z, r.w - 6 * Z, r.h - 6 * Z, 3 * Z); ctx.stroke();
    // título
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `700 ${12 * Z}px 'Fredoka', sans-serif`; ctx.fillStyle = '#ffd34d';
    ctx.fillText('🏆 RANKING', r.px, r.y + 13 * Z);
    // top 3 (ou um convite)
    ctx.font = `600 ${8.6 * Z}px 'Fredoka', sans-serif`; ctx.textAlign = 'left';
    const lines = top3 && top3.length ? top3 : null;
    if (lines) lines.forEach((p, i) => {
      const y = r.y + (31 + i * 17) * Z, medal = ['🥇', '🥈', '🥉'][i];
      ctx.fillStyle = '#fff';
      let name = p.name; while (ctx.measureText(medal + ' ' + name).width > r.w * .62 && name.length > 3) name = name.slice(0, -1);
      ctx.fillText(medal + ' ' + (name !== p.name ? name + '…' : name), r.x + 7 * Z, y);
      ctx.textAlign = 'right'; ctx.fillStyle = '#ffd34d'; ctx.fillText(fmt(p.value), r.x + r.w - 7 * Z, y); ctx.textAlign = 'left';
    });
    else { ctx.textAlign = 'center'; ctx.fillStyle = '#d8f5e6'; ctx.fillText('Os melhores', r.px, r.y + 38 * Z); ctx.fillText('de cada fase', r.px, r.y + 52 * Z); }
    ctx.textAlign = 'center'; ctx.font = `700 ${7.4 * Z}px 'Fredoka', sans-serif`; ctx.fillStyle = '#b8ffcf';
    ctx.fillText('toque para ver', r.px, r.y + r.h - 8 * Z);
    ctx.restore();
  }
  // perto do quadro abre a tela (como as placas); depois de fechar, só reabre quando a pessoa se afastar
  function check(player, level) {
    if (level !== 'praca') return;
    const d = Math.hypot(player.wx - BOARD.x, player.wy - BOARD.y);
    if (blocked) { if (d > 90) blocked = false; return; }
    if (d < 40) { blocked = true; open(); }
  }
  function hit(sx, sy, cam, Z) {               // ponto do canvas em cima do quadro?
    const r = boardRect(cam, Z);
    return sx >= r.x - 8 && sx <= r.x + r.w + 8 && sy >= r.y - 8 && sy <= r.py + 4;
  }
  function setHover(v) { hover = v; }
  function block() { blocked = true; }

  return { open, close, draw, check, hit, setHover, block, BOARD, _cache: cache };
})();

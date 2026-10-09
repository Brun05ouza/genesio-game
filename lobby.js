// Lobby online: conexão autenticada, presença por mapa e movimento interpolado.
const Lobby = (() => {
  const button = document.getElementById('lobbyOnline'), label = document.getElementById('lobbyOnlineLabel');
  const offlineButton = document.getElementById('btnOffline');
  const peers = new Map(), pictures = new Map();
  let ws = null, token = null, selfId = null, status = 'offline', enabled = true, retryAt = 0, failures = 0, blockedToken = null, fullUntil = 0;
  let lastPacket = '', lastSent = 0, now = 0, count = 0;
  try { enabled = localStorage.getItem('genesio-lobby-online') !== '0'; } catch (e) {}
  const mapVisible = () => ['playing', 'prompt', 'talk'].includes(state) && !document.hidden;
  function endpoint() {
    const url = new URL((window.GENESIO_API || '/api').replace(/\/$/, '') + '/lobby', location.href);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'; return url.href;
  }
  function disconnect() {
    const old = ws; ws = null; selfId = null; peers.clear(); count = 0;
    if (old) old.close(); status = 'offline'; lastPacket = '';
  }
  function connect() {
    const connection = new WebSocket(endpoint()); ws = connection; status = 'connecting';
    connection.onopen = () => {
      if (ws !== connection) return connection.close();
      connection.send(JSON.stringify({ type: 'hello', token }));
    };
    connection.onmessage = e => {
      if (ws !== connection) return;
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'welcome') { selfId = data.id; status = 'online'; failures = 0; lastPacket = ''; sendState(true); }
        else if (data.type === 'full') { fullUntil = now + 5000; status = 'full'; peers.clear(); sendState(true); }
        else if (data.type === 'snapshot' && data.level === levelId && Array.isArray(data.players)) {
          count = data.players.length;
          const seen = new Set();
          for (const p of data.players.slice(0, 32)) {
            if (p.id === selfId || ![p.x, p.y, p.z].every(Number.isFinite)) continue;
            seen.add(p.id);
            const old = peers.get(p.id);
            if (old && old.level === p.level) { old.target = p; old.name = p.name; old.avatar = p.avatar; old.skin = p.skin; old.facing = p.facing; old.moving = p.moving; old.running = p.running; old.vz = p.vz; }
            else peers.set(p.id, { ...p, wx: p.x, wy: p.y, z: p.z, t: 0, target: p });
          }
          for (const id of peers.keys()) if (!seen.has(id)) peers.delete(id);
        }
        paintStatus();
      } catch (e) { /* pacote incompleto: aguarda a próxima atualização */ }
    };
    connection.onerror = () => {}; // onclose informa a perda sem interromper o jogo
    connection.onclose = e => {
      if (ws !== connection) return;
      ws = null; selfId = null; peers.clear(); count = 0; lastPacket = '';
      if (e.code === 4401 || e.code === 4409) { blockedToken = token; status = e.code === 4409 ? 'other-window' : 'login-required'; }
      else { status = 'reconnecting'; retryAt = now + Math.min(30000, 1000 * 2 ** Math.min(failures++, 5)); }
      paintStatus();
    };
  }
  function sendState(force = false) {
    if (!ws || ws.readyState !== WebSocket.OPEN || selfId === null) return;
    const visible = mapVisible() && now >= fullUntil;
    const packet = JSON.stringify({ type: 'state', level: levelId, visible, x: player.wx, y: player.wy, z: player.z, vz: player.vz, facing: player.facing, moving: visible && state === 'playing' && player.moving, running: visible && state === 'playing' && !!player.running });
    if (force || now - lastSent >= 100 && (packet !== lastPacket || now - lastSent >= 5000)) {
      if (ws.bufferedAmount < 8192) { ws.send(packet); lastPacket = packet; lastSent = now; }
    }
  }
  function paintStatus() {
    const offline = !enabled;
    if (offlineButton.getAttribute('aria-pressed') !== String(offline)) {
      offlineButton.setAttribute('aria-pressed', String(offline));
      offlineButton.textContent = offline ? 'Sim' : 'Não';
    }
    button.hidden = !['menu', 'playing', 'prompt', 'talk'].includes(state);
    const logged = Account.isLogged();
    const text = !enabled ? 'Offline · conectar' : !logged ? 'Jogar online' : status === 'online' ? `Online · ${count} neste mapa` : status === 'full' ? 'Mapa cheio · aguardando' : status === 'other-window' ? 'Online em outra janela' : status === 'login-required' ? 'Online · entre novamente' : status === 'connecting' ? 'Conectando...' : 'Reconectando...';
    if (label.textContent !== text) label.textContent = text;
    button.classList.toggle('connected', status === 'online' && enabled && logged);
    button.title = status === 'online' ? 'Clique para ficar offline. As fases são individuais.' : 'Conectar ao lobby online';
    button.setAttribute('aria-label', text + (status === 'online' ? '. Clique para ficar offline.' : '. Clique para conectar.'));
  }
  function update(dt) {
    now = performance.now();
    const current = Account.token();
    if (current !== token) { disconnect(); token = current; retryAt = 0; blockedToken = null; failures = 0; }
    if (!enabled || !current || !navigator.onLine) { if (ws) disconnect(); }
    else if (!ws && token !== blockedToken && now >= retryAt) {
      try { connect(); } catch (e) { status = 'reconnecting'; retryAt = now + 5000; }
    }
    if (status === 'full' && now >= fullUntil) { status = 'online'; lastPacket = ''; }
    sendState();
    for (const p of peers.values()) {
      const k = 1 - Math.exp(-dt * 15);
      p.wx += (p.target.x - p.wx) * k; p.wy += (p.target.y - p.wy) * k; p.z += (p.target.z - p.z) * k; p.t += dt;
    }
    paintStatus();
  }
  function imageFor(p) {
    const skin = /^[a-z]+$/.test(p.skin || '') ? p.skin : 'classico';
    const src = skin !== 'classico' ? 'assets/skins/' + skin + '.png' : 'assets/menu-g-' + (/^[a-e]$/.test(p.avatar) ? p.avatar : 'a') + '.png';
    if (!pictures.has(src)) { const image = new Image(); image.src = src; pictures.set(src, image); }
    return pictures.get(src);
  }
  function drawName(p, x, y, scale) {
    const name = String(p.name || 'Jogador').slice(0, 20), img = imageFor(p);
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = "700 15px 'Fredoka',sans-serif";
    const w = Math.min(220, ctx.measureText(name).width + 42), top = y - 30;
    ctx.fillStyle = 'rgba(8,40,26,.95)'; ctx.strokeStyle = '#5cc494'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(x - w / 2, top, w, 28, 9); ctx.fill(); ctx.stroke();
    if (img.complete && img.naturalWidth) ctx.drawImage(img, x - w / 2 + 5, top + 2, 24, 24);
    ctx.fillStyle = '#fff'; ctx.fillText(name, x + 11, top + 14); ctx.restore();
  }
  function drawPeer(p) { drawPlayer(p); }
  function actors() { return status === 'online' && mapVisible() ? [...peers.values()].filter(p => p.level === levelId).map(p => ({ y: p.wy, draw: () => drawPeer(p) })) : []; }
  function setEnabled(value) {
    enabled = !!value;
    try { localStorage.setItem('genesio-lobby-online', enabled ? '1' : '0'); } catch (e) {}
    blockedToken = null; retryAt = 0; failures = 0; disconnect(); update(0);
  }
  offlineButton.addEventListener('click', () => {
    Sound.init(); Sound.click(); setEnabled(!enabled);
  });
  button.addEventListener('click', () => {
    Sound.init(); Sound.click();
    if (!Account.isLogged()) { setEnabled(true); Account.openLogin('Entre na sua conta para encontrar outros jogadores no lobby.'); return; }
    if (status === 'login-required') { Account.openLogin('Entre novamente para conectar ao lobby online.'); return; }
    setEnabled(status !== 'online');
  });
  addEventListener('visibilitychange', () => { now = performance.now(); sendState(true); });
  addEventListener('online', () => { retryAt = 0; });
  addEventListener('pagehide', disconnect);
  return { update, actors, drawName, imageFor, setEnabled, isEnabled: () => enabled, _debug: () => ({ status, selfId, count, peers: [...peers.values()], enabled }) };
})();

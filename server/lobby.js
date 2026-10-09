// Presença do lobby: efêmera, autenticada e separada de moedas/recordes/combate.
'use strict';
const { WebSocketServer, WebSocket } = require('ws');
const MAPS = { praca: [1254, 1254], iguacu: [1254, 1254], teresopolis: [1448, 1086] };
const GAMES = new Set(['oasis', 'epi', 'climb', 'hop', 'solar', 'flow']);
function createLobby(server, { authenticate, profile }) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 2048, perMessageDeflate: false });
  const players = new Map(), dirty = new Set();
  const send = (ws, data) => {
    if (ws.readyState !== WebSocket.OPEN) return;
    if (ws.bufferedAmount > 128 * 1024) { ws.close(4408, 'Conexão lenta'); return; }
    ws.send(JSON.stringify(data));
  };
  const publicPlayer = p => ({ id: p.id, name: p.name, avatar: p.avatar, skin: p.skin, ...p.position });
  function snapshot(ws, level) {
    const list = [...players.values()].filter(p => p.position?.level === level && p.position?.visible);
    send(ws, { type: 'snapshot', level, players: list.map(publicPlayer) });
  }
  server.on('upgrade', (req, socket, head) => {
    if (new URL(req.url, 'http://local').pathname !== '/api/lobby' || wss.clients.size >= 256) { socket.destroy(); return; }
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws));
  });
  wss.on('connection', ws => {
    let entry = null, token = null, authenticating = false, alive = true, messages = 0, windowAt = Date.now();
    const timeout = setTimeout(() => ws.close(4408, 'Tempo de conexão esgotado'), 5000);
    ws.on('error', () => {});
    ws.on('pong', () => { alive = true; });
    ws.on('message', async (raw, binary) => {
      try {
        if (binary) return ws.close(4400, 'Mensagem inválida');
        const now = Date.now();
        if (now - windowAt > 1000) { windowAt = now; messages = 0; }
        if (++messages > 40) return ws.close(4408, 'Muitas mensagens');
        const data = JSON.parse(raw.toString());
        if (!entry) {
          if (authenticating) return;
          if (data.type !== 'hello' || !/^[a-f0-9]{64}$/.test(data.token || '')) return ws.close(4401, 'Entre na sua conta');
          authenticating = true; token = data.token;
          const user = await authenticate(token);
          if (!user) return ws.close(4401, 'Sessão expirada');
          const identity = await profile(user.id);
          if (ws.readyState !== WebSocket.OPEN) return;
          const old = players.get(user.id);
          if (old) { dirty.add(old.position?.level); old.ws.close(4409, 'Conta conectada em outra janela'); }
          entry = { id: user.id, name: identity.name, avatar: identity.avatar || 'a', skin: identity.skin || 'classico', ws, position: null, lastState: now };
          players.set(user.id, entry); clearTimeout(timeout);
          send(ws, { type: 'welcome', id: user.id });
          return;
        }
        if (data.type !== 'state' || !Object.hasOwn(MAPS, data.level) || ![data.x, data.y, data.z, data.vz].every(Number.isFinite)) return ws.close(4400, 'Posição inválida');
        const previous = entry.position, [w, h] = MAPS[data.level];
        if ((!previous || previous.level !== data.level || !previous.visible) && data.visible && [...players.values()].filter(p => p !== entry && p.position?.level === data.level && p.position.visible).length >= 32) {
          if (previous) { previous.visible = false; dirty.add(previous.level); }
          send(ws, { type: 'full', message: 'Este mapa está cheio. Tente novamente em instantes.' });
          return;
        }
        if (previous) dirty.add(previous.level);
        const game = GAMES.has(data.game) ? data.game : null;
        entry.position = { level: data.level, visible: data.visible === true, game, x: Math.max(0, Math.min(w, data.x)), y: Math.max(0, Math.min(h, data.y)), z: game ? 0 : Math.max(0, Math.min(160, data.z)), vz: game ? 0 : Math.max(-700, Math.min(700, data.vz)), facing: data.facing < 0 ? -1 : 1, moving: !game && data.moving === true, running: !game && data.running === true };
        entry.lastState = now; dirty.add(data.level);
        if (!previous || previous.level !== data.level) snapshot(ws, data.level);
      } catch (e) { ws.close(4400, 'Não foi possível entrar no lobby'); }
    });
    ws.on('close', () => {
      clearTimeout(timeout);
      if (entry && players.get(entry.id) === entry) { players.delete(entry.id); dirty.add(entry.position?.level); }
    });
    ws.check = async () => {
      if (ws.readyState !== WebSocket.OPEN) return;
      if (!alive) return ws.terminate();
      alive = false; ws.ping();
      if (entry) {
        try { if (!(await authenticate(token))) ws.close(4401, 'Sessão expirada'); }
        catch (e) { ws.close(1011, 'Servidor indisponível'); }
      }
    };
    ws.matchesToken = value => token === value;
  });
  const tick = setInterval(() => {
    // O marcador de uma fase permanece mesmo quando o navegador suspende o loop
    // da aba; o heartbeat e o fechamento do socket removem conexões abandonadas.
    for (const p of players.values()) if (p.position?.visible && !p.position.game && Date.now() - p.lastState > 15000) { p.position.visible = false; dirty.add(p.position.level); }
    for (const level of dirty) if (Object.hasOwn(MAPS, level)) for (const p of players.values()) if (p.position?.level === level) snapshot(p.ws, level);
    dirty.clear();
  }, 100);
  const heartbeat = setInterval(() => { for (const ws of wss.clients) ws.check().catch(() => ws.terminate()); }, 25000);
  tick.unref(); heartbeat.unref();
  server.on('close', () => { clearInterval(tick); clearInterval(heartbeat); for (const ws of wss.clients) ws.terminate(); wss.close(); });
  return {
    closeToken(token) { for (const ws of wss.clients) if (ws.matchesToken(token)) ws.close(4401, 'Sessão encerrada'); },
    updateProfile(id, p) { const player = players.get(id); if (player) { player.name = p.name; player.avatar = p.avatar || 'a'; player.skin = p.skin || 'classico'; dirty.add(player.position?.level); } },
    closeOthers(id, token) { for (const ws of wss.clients) if (players.get(id)?.ws === ws && !ws.matchesToken(token)) ws.close(4401, 'Sessão encerrada'); },
  };
}
module.exports = { createLobby };

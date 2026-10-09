// Requer a API com banco de teste: DATABASE_URL= DEV_DB= NO_RATE_LIMIT=1 node server/server.js --port 8012 --static ..
const { chromium } = require('C:/Users/bs902/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const WS = require('../server/node_modules/ws');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const URL = process.argv[2] || 'http://localhost:8012';
const out = path.join(__dirname, 'out'); fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const c1 = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const c2 = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
    const p1 = await c1.newPage(), p2 = await c2.newPage(), errors = [];
    for (const p of [p1, p2]) p.on('pageerror', e => errors.push(e.message));
    const suffix = Date.now().toString().slice(-8), names = ['OnlineA' + suffix, 'OnlineB' + suffix];
    for (const [i, p] of [p1, p2].entries()) {
      await p.goto(URL); await p.waitForFunction(() => ready);
      await p.click('#acTabNew'); await p.fill('#acName', names[i]); await p.fill('#acPass', 'teste123'); await p.fill('#acPass2', 'teste123'); await p.click('#acSubmit');
      await p.waitForFunction(() => state === 'menu');
      await p.evaluate(() => { started = true; show('playing'); });
    }
    for (const p of [p1, p2]) await p.waitForFunction(() => Lobby._debug().status === 'online' && Lobby._debug().peers.length === 1);
    assert.equal(await p1.evaluate(() => Lobby._debug().peers[0].name), names[1]);
    assert.equal(await p2.evaluate(() => Lobby._debug().peers[0].name), names[0]);
    assert.match(await p2.locator('#lobbyOnlineLabel').innerText(), /2 neste mapa/);
    // Movimento real + corrida e salto chegam ao outro aparelho.
    const x0 = await p1.evaluate(() => player.wx);
    await p1.keyboard.down('Shift'); await p1.keyboard.down('KeyD');
    await p2.waitForFunction(x => { const p = Lobby._debug().peers[0]; return p?.target.x > x + 15 && p.running && p.moving; }, x0);
    await p1.keyboard.up('KeyD'); await p1.keyboard.up('Shift');
    await p1.keyboard.down('Space'); await p2.waitForFunction(() => Lobby._debug().peers[0]?.target.z > 5); await p1.keyboard.up('Space');
    await p1.waitForFunction(() => player.z === 0);
    await p1.screenshot({ path: path.join(out, 'multiplayer-desktop.png') });
    await p2.screenshot({ path: path.join(out, 'multiplayer-mobile.png') });
    // Perfil vem da conta no servidor e muda ao salvar.
    await p1.evaluate(name => Account.updateProfile({ name, avatar: 'd' }), names[0] + 'x');
    await p2.waitForFunction(name => Lobby._debug().peers[0]?.name === name && Lobby._debug().peers[0]?.avatar === 'd', names[0] + 'x');
    // Cada fase é individual; o jogador permanece no mapa com a imagem de quem está jogando.
    await p1.evaluate(() => openSolarDifficulty()); await p2.waitForFunction(() => Lobby._debug().peers.length === 0);
    await p1.click('#solarDiff-facil'); await p1.waitForFunction(() => state === 'splay');
    await p2.waitForFunction(() => Lobby._debug().peers[0]?.game === 'solar');
    await p2.waitForFunction(() => Lobby.playingImage().complete && Lobby.playingImage().naturalWidth > 0);
    const firstImage = await p2.evaluate(() => Lobby.playingImage().src);
    await p2.waitForFunction(src => Lobby.playingImage().src !== src && Lobby.playingImage().complete && Lobby.playingImage().naturalWidth > 0, firstImage);
    await p2.screenshot({ path: path.join(out, 'multiplayer-jogando-mobile.png') });
    assert.equal(await p2.evaluate(() => state === 'playing' && !Solar.isRunning()), true);
    await p1.click('#btnPause'); await p1.click('#sSettings');
    assert.equal(await p2.evaluate(() => Lobby._debug().peers[0]?.game), 'solar');
    await p1.click('#btnOffline');
    assert.equal(await p1.locator('#btnOffline').getAttribute('aria-pressed'), 'true');
    await p1.screenshot({ path: path.join(out, 'offline-settings-desktop.png') });
    await p1.click('#btnOffline'); await p1.click('#btnBack');
    assert.equal(await p1.evaluate(() => state === 'splay' && Solar._debug().paused), true);
    await p1.click('#sExit');
    await p2.waitForFunction(() => Lobby._debug().peers.length === 1 && !Lobby._debug().peers[0].game);
    for (const [mod, game, screen, arg] of [['Runner', 'oasis', 'runner', 'facil'], ['Nature', 'epi', 'nplay', 'epi'], ['Climb', 'climb', 'kplay'], ['Hop', 'hop', 'hplay'], ['Flow', 'flow', 'fplay']]) {
      await p1.evaluate(async ({ mod, screen, arg }) => { await ({ Runner, Nature, Climb, Hop, Flow }[mod]).start(arg); show(screen); }, { mod, screen, arg });
      await p2.waitForFunction(game => Lobby._debug().peers[0]?.game === game, game);
      await p1.evaluate(mod => { ({ Runner, Nature, Climb, Hop, Flow }[mod]).stop(); show('playing'); }, mod);
      await p2.waitForFunction(() => !Lobby._debug().peers[0]?.game && Lobby._debug().peers.length === 1);
    }
    // Isolamento entre mapas, seguido de reencontro em Teresópolis.
    await p1.evaluate(() => goToLevel('teresopolis')); await p2.waitForFunction(() => Lobby._debug().peers.length === 0);
    await p2.evaluate(() => goToLevel('teresopolis'));
    for (const p of [p1, p2]) await p.waitForFunction(() => Lobby._debug().peers.length === 1 && Lobby._debug().peers[0].level === 'teresopolis');
    // Desconecta e reconecta sem duplicar o personagem.
    await p1.click('#lobbyOnline'); await p2.waitForFunction(() => Lobby._debug().peers.length === 0);
    await p1.click('#lobbyOnline'); await p2.waitForFunction(() => Lobby._debug().peers.length === 1);
    // A opção nas configurações usa a mesma preferência e persiste ao recarregar.
    await p1.click('#btnPause'); await p1.click('#btnSettings'); await p1.click('#btnOffline');
    assert.equal(await p1.evaluate(() => !Lobby.isEnabled() && Lobby._debug().status === 'offline'), true);
    await p1.reload(); await p1.waitForFunction(() => ready && state === 'menu');
    assert.equal(await p1.evaluate(() => Lobby.isEnabled()), false);
    assert.equal(await p1.locator('#lobbyOnlineLabel').innerText(), 'Offline · conectar');
    await p1.click('#btnSettings');
    assert.equal(await p1.locator('#btnOffline').getAttribute('aria-pressed'), 'true');
    await p1.click('#btnBack'); await p1.evaluate(async () => { started = true; await goToLevel('teresopolis'); });
    await p2.waitForFunction(() => Lobby._debug().peers.length === 0);
    await p1.click('#lobbyOnline');
    assert.equal(await p1.locator('#btnOffline').getAttribute('aria-pressed'), 'false');
    await p2.waitForFunction(() => Lobby._debug().peers.length === 1);
    // A opção também é acessível por toque e os controles cabem no painel.
    await p2.tap('#btnPause'); await p2.tap('#btnSettings'); await p2.tap('#btnOffline');
    assert.equal(await p2.evaluate(() => Lobby.isEnabled()), false);
    await p2.screenshot({ path: path.join(out, 'offline-settings-mobile.png') });
    const boxes = await p2.locator('#settings .srow .sbtn:visible').evaluateAll(nodes => nodes.map(n => { const r = n.getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; }));
    for (let i = 1; i < boxes.length; i++) assert.ok(boxes[i].top > boxes[i - 1].bottom, 'botões separados no celular');
    await p2.tap('#btnOffline'); await p2.tap('#btnBack'); await p2.evaluate(() => show('playing'));
    for (const p of [p1, p2]) await p.waitForFunction(() => Lobby._debug().peers.length === 1);
    await c1.setOffline(true); await p2.waitForFunction(() => Lobby._debug().peers.length === 0);
    await c1.setOffline(false); await p2.waitForFunction(() => Lobby._debug().peers.length === 1);
    // Logout remove imediatamente a presença.
    await p1.evaluate(() => Account.logout()); await p2.waitForFunction(() => Lobby._debug().peers.length === 0);
    // Protocolo: não admite visitante nem nome forjado e limita coordenadas ao mapa.
    const socketURL = URL.replace(/^http/, 'ws') + '/api/lobby';
    await new Promise((resolve, reject) => {
      const ws = new WS(socketURL); ws.on('error', reject);
      ws.on('open', () => ws.send(JSON.stringify({ type: 'hello', token: 'a'.repeat(64) })));
      ws.on('close', code => { try { assert.equal(code, 4401); resolve(); } catch (e) { reject(e); } });
    });
    const response = await fetch(URL + '/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Probe' + suffix, password: 'teste123' }) });
    const account = await response.json(); assert.equal(response.status, 201);
    await new Promise((resolve, reject) => {
      const ws = new WS(socketURL), timeout = setTimeout(() => { ws.terminate(); reject(new Error('snapshot não recebido')); }, 25000);
      let stage = 'position', checkTimer = null;
      ws.on('error', reject);
      ws.on('open', () => ws.send(JSON.stringify({ type: 'hello', token: account.token })));
      ws.on('message', raw => {
        const m = JSON.parse(raw);
        if (m.type === 'welcome') ws.send(JSON.stringify({ type: 'state', level: 'praca', visible: true, x: 999999, y: -100, z: 999, vz: 0, name: 'Forjado', avatar: 'd' }));
        if (m.type === 'snapshot') {
          try {
            const p = m.players.find(p => p.name === account.profile.name);
            if (stage === 'position') {
              assert.equal(p.avatar, 'a'); assert.deepEqual([p.x, p.y, p.z], [1254, 0, 160]);
              stage = 'game'; ws.send(JSON.stringify({ type: 'state', level: 'praca', visible: true, game: 'hop', x: 627, y: 780, z: 99, vz: 99, moving: true, running: true }));
            } else if (stage === 'game' && p?.game === 'hop') {
              assert.deepEqual([p.z, p.vz, p.moving, p.running], [0, 0, false, false]); stage = 'waiting';
              // Sem novos movimentos/heartbeats da página por mais de 15 s, o marcador da fase permanece.
              checkTimer = setTimeout(async () => {
                stage = 'check';
                try { await fetch(URL + '/api/me', { headers: { Authorization: 'Bearer ' + account.token } }); }
                catch (e) { clearTimeout(timeout); ws.terminate(); reject(e); }
              }, 16000);
            } else if (stage === 'check') {
              assert.equal(p?.game, 'hop'); clearTimeout(timeout); ws.close(); resolve();
            }
          } catch (e) { clearTimeout(timeout); clearTimeout(checkTimer); ws.terminate(); reject(e); }
        }
      });
    });
    assert.deepEqual(errors, []);
    console.log('Lobby multiplayer: 2 contas, movimento, mapas, fases, offline persistente nas configurações (desktop/celular), reconexão e validação OK');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });

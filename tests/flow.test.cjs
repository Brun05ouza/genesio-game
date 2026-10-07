const { chromium } = require('C:/Users/bs902/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.status() >= 400 && r.url().startsWith('http://localhost')) errors.push(r.url()); });
  await page.goto((process.argv[2] || 'http://localhost:8000')); await page.waitForFunction(() => ready);
  // entrada pela placa real
  await page.evaluate(() => { levelId = 'teresopolis'; player.wx = 470; player.wy = 850; show('playing'); checkOasisSign(); });
  assert.equal(await page.locator('#prompt').getAttribute('class'), 'screen active');
  assert.match(await page.locator('#promptText').innerText(), /Flow/);
  await page.locator('#btnYes').click();
  await page.waitForFunction(() => state === 'fplay');

  const r = await page.evaluate(async () => {
    state = 'test'; localStorage.removeItem('genesio-flow-best'); localStorage.removeItem('genesio-coins');
    const tick = s => { for (let i = 0; i < Math.round(s * 60); i++) Flow.update(1 / 60); };
    const g = Flow._debug(), out = {};
    out.ready = g.phase === 'ready' && g.score === 0 && g.cam === 0;
    tick(1); out.waitsForTap = g.cam === 0 && g.phase === 'ready';
    keys.Space = true; Flow.update(1 / 60); keys.Space = false; Flow.update(1 / 60);
    out.flapStarts = g.phase === 'play' && g.vy < 0;
    const P0 = Flow._pillars(); out.hasPillars = P0.length >= 12;
    // pontuação: um ponto por pilar ultrapassado
    g.y = 470; g.cam = 1400; Flow.update(1 / 60);
    out.scoresPerPillar = g.score >= 1 && P0.filter(p => p.passed).length === g.score;
    // mapa infinito: o mundo continua sendo gerado e os pilares antigos são descartados
    for (const c of [5000, 10000, 20000, 40000]) { g.cam = c; for (let i = 0; i < 3; i++) { g.y = 470; g.dead = false; g.ended = false; Flow.update(1 / 60); } }
    out.infinite = Flow._pillars().some(p => p.x0 > 40000) && Flow._pillars().length < 200;
    // colisão com pilar
    g.dead = false; g.ended = false; const pil = Flow._pillars().find(p => p.x0 > g.cam + 500 && p.top);
    g.cam = pil.x0 - Flow.BX + 40; g.y = pil.y1 - 30; Flow.update(1 / 60);
    out.hitKills = g.dead === true;
    tick(1.6); out.overlay = g.ended && document.getElementById('fOverlay').classList.contains('active');
    out.title = document.getElementById('fTitle').textContent;
    out.reward = +localStorage.getItem('genesio-coins') === Math.floor(g.score / 5) && +localStorage.getItem('genesio-flow-best') === g.score;
    // recomeçar; cair no chão também mata
    Flow.primary(); state = 'test'; const g2 = Flow._debug(); out.restarted = g2.phase === 'ready' && g2.score === 0 && !g2.dead;
    Flow.flap(); g2.y = 1100; Flow.update(1 / 60); out.floorKills = g2.dead === true;
    // teto só encosta
    Flow.primary(); state = 'test'; const g3 = Flow._debug(); Flow.flap(); g3.y = 10; g3.vy = -500; Flow.update(1 / 60); out.ceilingSafe = !g3.dead && g3.y >= 50;
    // pausa congela o mundo
    Flow.togglePause(); out.paused = g3.paused === true; const camP = g3.cam; Flow.update(1); out.pauseFreezes = g3.cam === camP; Flow.togglePause();
    return out;
  });
  console.log(r);
  for (const [k, v] of Object.entries(r)) if (typeof v === 'boolean') assert.ok(v, k);
  // captura para ver a nave, o foguinho e os pilares
  await page.evaluate(async () => {
    await Flow.start(); state = 'test'; const g = Flow._debug();
    Flow.flap(); for (let i = 0; i < 40; i++) Flow.update(1 / 60);
    g.y = 400; g.vy = -300; g.flapT = .05; g.cam = 560; g.paused = true; show('fplay'); Flow.draw(ctx);
  });
  await page.screenshot({ path: 'flow-preview.png' });
  assert.deepEqual(errors, []);
  await browser.close(); console.log('Flow: OK');
})().catch(e => { console.error(e); process.exit(1); });

// Modos da subida: layout real em pé, inclinação, permissões, fallback e retorno aos menus.
const { chromium } = require('C:/Users/bs902/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const URL = process.argv[2] || 'http://localhost:8012';
const out = path.join(__dirname, 'out'); fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const errors = [];
    async function phone(permission = 'granted') {
      const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, serviceWorkers: 'block' });
      await context.addInitScript(value => {
        window.motionRequests = 0;
        if (value === 'missing') Object.defineProperty(window, 'DeviceOrientationEvent', { value: undefined });
        else DeviceOrientationEvent.requestPermission = async () => { motionRequests++; return value; };
      }, permission);
      const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
      await page.goto(URL); await page.waitForFunction(() => ready);
      if (await page.evaluate(() => state === 'login')) await page.locator('#acGuest').tap();
      await page.evaluate(() => openNature()); await page.locator('[data-challenge="hop"]').tap();
      assert.equal(await page.evaluate(() => motionRequests), 0);
      return { context, page };
    }
    const { context, page } = await phone();
    const requests = []; page.on('request', r => requests.push(r.url()));
    await page.screenshot({ path: path.join(out, 'hop-choice-landscape.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.locator('#rotate').isVisible(), false);
    await page.screenshot({ path: path.join(out, 'hop-choice-portrait.png') });
    await page.locator('#hopVertical').tap(); await page.waitForFunction(() => state === 'hplay');
    assert.equal(await page.evaluate(() => motionRequests), 1);
    assert.deepEqual(await page.evaluate(() => [canvas.width, canvas.height, Hop.W, Hop.mode]), [720, Math.round(720 * 844 / 390), 940, 'vertical']);
    const rect = await page.locator('#c').boundingBox(); assert.ok(Math.abs(rect.width - 390) < 1 && Math.abs(rect.height - 844) < 1);
    await page.waitForSelector('#touch[data-mode="hopVertical"].show');
    assert.equal(await page.locator('#rotate').isVisible(), false);
    assert.equal(requests.some(url => /hop_h\d|hop-data/.test(url)), false);
    await page.screenshot({ path: path.join(out, 'hop-game-portrait.png') });
    const tilt = await page.evaluate(() => {
      Hop.restart();
      const emit = gamma => dispatchEvent(new DeviceOrientationEvent('deviceorientation', { gamma, beta: 30, alpha: 0 }));
      const g = Hop._debug();
      emit(10); g.vx = 0; Hop.update(.05); const neutral = g.vx === 0;
      emit(12); g.vx = 0; Hop.update(.05); const deadZone = g.vx === 0;
      emit(32); g.vx = 0; Hop.update(.05); const right = g.vx > 0;
      emit(-12); g.vx = 0; Hop.update(.05); const left = g.vx < 0;
      emit(32); g.vx = 0; keys.KeyA = true; Hop.update(.05); keys.KeyA = false; const manual = g.vx < 0;
      emit(null); g.vx = 0; Hop.update(.05); const nullIgnored = Number.isFinite(g.x) && g.vx > 0;
      Hop.togglePause(); const saved = JSON.stringify(g); emit(-30); Hop.update(.1); const pause = saved === JSON.stringify(g);
      Hop.primary(); g.vx = 0; emit(-30); Hop.update(.05); const recentered = g.vx === 0;
      return { neutral, deadZone, right, left, manual, nullIgnored, pause, recentered };
    });
    for (const [name, ok] of Object.entries(tilt)) assert.ok(ok, name);
    // Mesmo na tela estreita, cada rota gerada cabe no alcance do salto.
    const routeCount = await page.evaluate(() => {
      Hop.restart(); const seen = new Map();
      for (let band = 0; band < 24; band++) {
        const g = Hop._debug(); g.cam = -1800 - band * 800; g.y = g.cam + 500; g.minY = g.y; g.vy = 0;
        Hop.update(1 / 120); for (const p of Hop._plats()) if (p.route) seen.set(p.serial, p);
      }
      const route = [...seen.values()].sort((a, b) => b.y - a.y);
      for (let i = 1; i < route.length; i++) if (!Hop.canHop(route[i - 1], route[i])) throw Error('Rota vertical impossível');
      Hop.restart(); return route.length;
    });
    assert.ok(routeCount > 100);
    await page.setViewportSize({ width: 844, height: 390 });
    assert.equal(await page.locator('#rotate').isVisible(), true);
    const frozen = await page.evaluate(() => { const g = Hop._debug(), saved = JSON.stringify(g); Hop.update(.1); return saved === JSON.stringify(g); });
    assert.ok(frozen); assert.match(await page.locator('#rotateText').textContent(), /vertical/);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#btnPause').tap(); await page.locator('#hSettings').tap();
    assert.equal(await page.locator('#rotate').isVisible(), false);
    const fits = await page.locator('#settings .srow').evaluateAll(rows => rows.filter(r => getComputedStyle(r).display !== 'none').every(r => [...r.children].every(el => {
      const b = el.getBoundingClientRect(); return b.left >= 0 && b.right <= innerWidth && b.top >= 0 && b.bottom <= innerHeight;
    })));
    assert.ok(fits, 'configurações visíveis em pé');
    await page.screenshot({ path: path.join(out, 'hop-settings-portrait.png') });
    await page.locator('#btnBack').tap(); assert.equal(await page.locator('#hOverlay').isVisible(), true);
    await page.locator('#hMode').tap(); await page.locator('#hopHorizontal').tap(); await page.waitForFunction(() => state === 'hplay');
    assert.deepEqual(await page.evaluate(() => [canvas.width, canvas.height]), [1280, 720]);
    assert.equal(await page.locator('#rotate').isVisible(), true);
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForSelector('#touch[data-mode="hop"].show');
    await page.locator('#btnPause').tap(); await page.locator('#hExit').tap();
    assert.equal(await page.evaluate(() => document.body.classList.contains('hop-vertical')), false);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.locator('#rotate').isVisible(), true);
    await context.close();
    for (const permission of ['denied', 'missing']) {
      const { context, page } = await phone(permission);
      await page.setViewportSize({ width: 390, height: 844 }); await page.locator('#hopVertical').tap();
      await page.waitForFunction(() => state === 'hplay');
      assert.equal(await page.evaluate(() => Hop.tiltStatus), permission === 'denied' ? 'denied' : 'unavailable');
      await page.waitForSelector('#touch .b-right');
      const button = await page.locator('#touch .b-right').boundingBox();
      // Toque real pelo protocolo CDP, incluindo captura e soltura do ponteiro.
      const session = await context.newCDPSession(page);
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: button.x + 20, y: button.y + 20 }] });
      await page.waitForFunction(() => keys.KeyD && Hop._debug().vx > 0);
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForFunction(() => !keys.KeyD);
      await context.close();
    }
    // Falha de download continua legível em pé; tentar novamente preserva a permissão do sensor.
    const recovery = await phone();
    let blocked = true;
    await recovery.page.route('**/hop-platform.*', route => blocked ? route.abort() : route.continue());
    await recovery.page.setViewportSize({ width: 390, height: 844 }); await recovery.page.locator('#hopVertical').tap();
    await recovery.page.waitForSelector('#lvload.err');
    assert.equal(await recovery.page.locator('#rotate').isVisible(), false);
    blocked = false; await recovery.page.locator('#lvRetry').tap(); await recovery.page.waitForFunction(() => state === 'hplay');
    const sensorAfterRetry = await recovery.page.evaluate(() => {
      dispatchEvent(new DeviceOrientationEvent('deviceorientation', { gamma: 0 }));
      dispatchEvent(new DeviceOrientationEvent('deviceorientation', { gamma: 22 }));
      Hop.update(.05); return Hop._debug().vx > 0 && motionRequests === 1;
    });
    assert.ok(sensorAfterRetry);
    await recovery.context.close();
    // Contexto novo evita reutilizar a imagem já decodificada no teste de retorno após falha.
    const failed = await phone('missing');
    await failed.page.route('**/hop-platform.*', route => route.abort());
    await failed.page.setViewportSize({ width: 390, height: 844 }); await failed.page.locator('#hopVertical').tap();
    await failed.page.waitForSelector('#lvload.err'); await failed.page.locator('#lvBack').tap();
    assert.equal(await failed.page.evaluate(() => state), 'hopMode');
    assert.equal(await failed.page.locator('#rotate').isVisible(), false);
    await failed.context.close();
    assert.deepEqual(errors, []);
    console.log('Subida: modos, paisagem contínua, inclinação simulada, calibração, permissão recusada/ausente, toque, pausa, rotação e configurações OK');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });

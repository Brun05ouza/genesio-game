// Clicar/tocar numa placa abre o convite para iniciar a fase (além do aviso ao chegar perto).
// Rode com o jogo em http://localhost:8000 (ou passe a URL como argumento).
const { chromium } = require('C:/Users/bs902/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const URL = process.argv[2] || 'http://localhost:8000';
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const r = {};
  const setup = async (ctxOpts) => {
    const ctx = await browser.newContext(ctxOpts); const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto(URL); await page.waitForFunction(() => ready);
    return { ctx, page, errs };
  };
  // ponto (px da página) do meio da placa, com o Genésio posto a `dx` px (do canvas) de distância dela
  const signPoint = (page, text, dx, dy = 160) => page.evaluate(([text, dx, dy]) => {
    const sg = SIGNS.find(s => s.text === text);
    levelId = sg.level; MAP_ZOOM = LEVELS[sg.level].zoom || 1.5; show('playing'); promptBlocked = true; promptSign = sg;
    const Z = MAP_ZOOM * (sg.ss || 1);
    player.wx = sg.x + dx / MAP_ZOOM; player.wy = sg.y + dy / MAP_ZOOM;          // o aviso automático fica bloqueado para essa placa
    updateCamera(player.wx, player.wy);
    const c = document.getElementById('c'), rc = c.getBoundingClientRect();
    const px = VW / 2 + (sg.x - cam.x) * MAP_ZOOM, py = VH / 2 + (sg.y - cam.y) * MAP_ZOOM;
    return { x: rc.left + px * rc.width / VW, y: rc.top + (py - 70 * Z - 10 * Z) * rc.height / VH, kind: signKind(sg) };
  }, [text, dx, dy]);

  // ---- computador: clique com o mouse ----
  {
    const { ctx, page, errs } = await setup({ viewport: { width: 1280, height: 720 } });
    for (const [text, kind] of [['OÁSIS RESIDENCIAL', 'oasis'], ['NATURE', 'nature'], ['SOLAR DO BOSQUE', 'solar'], ['FLOW RESIDENCIAL', 'flow']]) {
      const pt = await signPoint(page, text, 0);
      await page.mouse.move(pt.x, pt.y); await page.waitForTimeout(80);
      r['hover:' + kind] = await page.evaluate(() => document.getElementById('c').style.cursor === 'pointer' && hoverSign !== null);
      await page.mouse.click(pt.x, pt.y); await page.waitForTimeout(150);
      r['clique:' + kind] = await page.evaluate(k => state === 'prompt' && promptKind === k, kind);
      await page.evaluate(() => document.getElementById('btnNo').click()); await page.waitForTimeout(100);
      r['nao:' + kind] = await page.evaluate(() => state === 'playing');
    }
    // clicar fora da placa não faz nada; placa sem fase (Nova Iguaçu) também não
    const far = await signPoint(page, 'NATURE', 0);
    await page.mouse.click(far.x + 400, far.y + 200); await page.waitForTimeout(100);
    r.foraNaoAbre = await page.evaluate(() => state === 'playing');
    const ni = await signPoint(page, 'NOVA IGUAÇU', 0);
    await page.mouse.click(ni.x, ni.y); await page.waitForTimeout(100);
    r.placaSemFaseNaoAbre = await page.evaluate(() => state === 'playing');
    // "Sim" inicia a fase escolhida pela placa
    const pf = await signPoint(page, 'FLOW RESIDENCIAL', 0);
    await page.mouse.click(pf.x, pf.y); await page.waitForTimeout(100);
    await page.evaluate(() => document.getElementById('btnYes').click());
    await page.waitForFunction(() => state === 'fplay', null, { timeout: 15000 });
    r.simInicia = true;
    r.semErros = errs.length === 0;
    await ctx.close();
  }
  // ---- celular: toque na placa, inclusive na área do joystick ----
  {
    const { ctx, page, errs } = await setup({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    for (const [text, kind, dx, dy] of [['SOLAR DO BOSQUE', 'solar', 0, -70], ['SOLAR DO BOSQUE', 'solar', -300, -40], ['NATURE', 'nature', 380, -40], ['FLOW RESIDENCIAL', 'flow', 420, -60]]) {
      await page.evaluate(() => { show('playing'); });
      const pt = await signPoint(page, text, dx, dy);
      await page.waitForTimeout(200);                                          // os controles de toque aparecem no quadro seguinte
      const zone = await page.evaluate(([x, y]) => { const z = document.querySelector('.joy-zone').getBoundingClientRect(); return x >= z.left && x <= z.right && y >= z.top; }, [pt.x, pt.y]);
      await page.touchscreen.tap(pt.x, pt.y); await page.waitForTimeout(250);
      r[`toque:${kind}:${dx}${zone ? ':naAreaDoJoystick' : ''}`] = await page.evaluate(k => state === 'prompt' && promptKind === k, kind);
      if (await page.evaluate(() => state === 'prompt')) { await page.locator('#btnNo').tap(); await page.waitForTimeout(100); } else console.log('não abriu', text, dx, dy, pt);
    }
    r.semErrosCelular = errs.length === 0;
    await ctx.close();
  }
  await browser.close();
  console.log(r);
  for (const [k, v] of Object.entries(r)) assert.ok(v, k);
  console.log('Placas clicáveis: OK');
})().catch(e => { console.error(e); process.exit(1); });

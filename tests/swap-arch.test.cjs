// Inverter botões (só celular, fica salvo) e o arco de Teresópolis desenhado por cima do Genésio.
// Rode com o jogo em http://localhost:8000 (ou passe a URL como argumento).
const { chromium } = require('C:/Users/bs902/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const URL = process.argv[2] || 'http://localhost:8000';
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const r = {};
  // ---- celular ----
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  const m = await ctx.newPage(); const errs = []; m.on('pageerror', e => errs.push(e.message));
  await m.goto(URL); await m.waitForFunction(() => ready);
  await m.evaluate(() => show('settings'));
  r.opcaoNoCelular = await m.evaluate(() => getComputedStyle(document.querySelector('.srow.r4')).display !== 'none');
  await m.locator('#btnSwap').tap();
  r.liga = await m.evaluate(() => document.body.classList.contains('swap') && document.getElementById('btnSwap').textContent === 'Sim');
  await m.evaluate(() => show('playing')); await m.waitForTimeout(250);
  r.joystickDireita = await m.evaluate(() => { const z = document.querySelector('.joy-zone').getBoundingClientRect(); return z.left > innerWidth / 2 - 5; });
  r.botoesEsquerda = await m.evaluate(() => [...document.querySelectorAll('.tbtn')].every(b => b.getBoundingClientRect().right < innerWidth / 2));
  // o joystick do lado direito move o Genésio
  const x0 = await m.evaluate(() => player.wx);
  const cdp = await ctx.newCDPSession(m);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 0 }] });
  await touch('touchStart', 640, 300); await touch('touchMove', 700, 300); await m.waitForTimeout(600); await touch('touchEnd');
  r.joystickMove = (await m.evaluate(() => player.wx)) - x0 > 20;
  await cdp.detach(); await m.goto(URL); await m.waitForFunction(() => ready, null, { timeout: 60000 });
  r.ficaSalvo = await m.evaluate(() => document.body.classList.contains('swap'));
  await m.evaluate(() => show('settings')); await m.locator('#btnSwap').tap();
  r.desliga = await m.evaluate(() => !document.body.classList.contains('swap'));
  r.semErros = errs.length === 0;
  await ctx.close();
  // ---- computador: a opção não aparece ----
  const p = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  await p.goto(URL); await p.waitForFunction(() => ready);
  r.semOpcaoNoPC = await p.evaluate(() => { show('settings'); return getComputedStyle(document.querySelector('.srow.r4')).display === 'none'; });
  // ---- arco: o telhado cobre o Genésio quando ele passa por trás ----
  await p.evaluate(() => { show('playing'); return goToLevel('teresopolis'); });
  await p.waitForFunction(() => state === 'playing' && levelId === 'teresopolis', null, { timeout: 20000 });
  const covered = () => p.evaluate(() => {
    const c = document.getElementById('c'), x = c.getContext('2d');
    const sx = Math.round(VW / 2 + (player.wx - cam.x) * MAP_ZOOM), sy = Math.round(VH / 2 + (player.wy - cam.y) * MAP_ZOOM) - 30;
    const d = x.getImageData(sx - 3, sy - 3, 6, 6).data; let green = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 1] > d[i] + 40 && d[i + 1] > d[i + 2] + 10) green++;
    return green;                                          // pixels verdes (o Genésio) no meio do corpo
  });
  await p.evaluate(() => { player.wx = 640; player.wy = 870; }); await p.waitForTimeout(250);
  r.atrasDoTelhado = (await covered()) < 4;
  await p.evaluate(() => { player.wx = 640; player.wy = 760; }); await p.waitForTimeout(250);
  r.visivelForaDoArco = (await covered()) >= 4;
  await browser.close();
  console.log(r);
  for (const [k, v] of Object.entries(r)) assert.ok(v, k);
  console.log('Inverter botões e arco: OK');
})().catch(e => { console.error(e); process.exit(1); });

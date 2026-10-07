const { chromium } = require('C:/Users/bs902/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36';
  const open = async (o) => { const ctx = await browser.newContext({ deviceScaleFactor: 1, ...o }); const page = await ctx.newPage(); await page.goto((process.argv[2] || 'http://localhost:8000')); await page.waitForFunction(() => ready); await page.evaluate(() => show('playing')); await page.waitForTimeout(150); return { ctx, page }; };
  const st = page => page.evaluate(() => ({ touch: document.body.classList.contains('touch'), controls: !!document.querySelector('#touch.show') }));
  const res = {};
  // 1) desktop comum: sem controles de toque, mesmo mexendo mouse/teclado
  let { ctx, page } = await open({ viewport: { width: 1366, height: 768 } });
  res.desktop = await st(page); await page.mouse.move(300, 300); await page.keyboard.press('KeyD'); res.desktopAfterInput = await st(page);
  assert.ok(!res.desktop.touch && !res.desktop.controls && !res.desktopAfterInput.touch, 'desktop sem controles de toque'); await ctx.close();
  // 2) notebook com tela de toque (aparece como "só dedo" no emulador): começa em toque, mouse/teclado desligam, toque religa
  ({ ctx, page } = await open({ viewport: { width: 1366, height: 768 }, hasTouch: true }));
  res.hybridStart = await st(page);
  await page.mouse.move(400, 400); await page.mouse.move(420, 410); res.hybridMouse = await st(page);
  await page.touchscreen.tap(600, 300); await page.waitForTimeout(100); res.hybridTouchAgain = await st(page);
  await page.keyboard.press('KeyA'); res.hybridKey = await st(page);
  assert.ok(!res.hybridMouse.touch && !res.hybridMouse.controls, 'mouse desliga'); assert.ok(res.hybridTouchAgain.touch && res.hybridTouchAgain.controls, 'toque religa'); assert.ok(!res.hybridKey.touch, 'teclado desliga'); await ctx.close();
  // 3) celular: começa e continua em toque
  ({ ctx, page } = await open({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, userAgent: UA }));
  res.phone = await st(page); await page.touchscreen.tap(300, 200); await page.waitForTimeout(100); res.phoneAfterTap = await st(page);
  assert.ok(res.phone.touch && res.phone.controls && res.phoneAfterTap.touch, 'celular com controles'); await ctx.close();
  // 4) desktop com janela baixa não vira "modo celular"
  ({ ctx, page } = await open({ viewport: { width: 1366, height: 460 } }));
  res.shortDesktop = await st(page); assert.ok(!res.shortDesktop.touch && !res.shortDesktop.controls); await ctx.close();
  console.log(res); await browser.close(); console.log('Detecção: OK');
})().catch(e => { console.error(e); process.exit(1); });

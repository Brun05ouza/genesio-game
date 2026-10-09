// Guia de instalação no iPhone/iPad: o passo certo para cada navegador (rode com o jogo em http://localhost:8010 (servidor só de arquivos: python -m http.server 8010))
const { chromium } = require('C:/Users/bs902/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const CASES = {
  safari: { ua: SAFARI, title: /Instalar no iPhone/, arrow: true, copy: false },
  chrome: { ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/123.0.6312.52 Mobile/15E148 Safari/604.1', title: /Chrome/, arrow: false, copy: true },
  chromeOld: { ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/110.0.5481.83 Mobile/15E148 Safari/604.1', title: /Safari/, arrow: false, copy: true },
  instagram: { ua: SAFARI + ' Instagram 300.0.0.12.100', title: /Abra no Safari/, arrow: false, copy: true },
  ipad: { ua: SAFARI.replace('iPhone; CPU iPhone OS', 'iPad; CPU OS'), title: /Instalar no iPad/, arrow: true, copy: false, w: 1024, h: 768 },
};
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  for (const [name, c] of Object.entries(CASES)) {
    const ctx = await browser.newContext({ viewport: { width: c.w || 390, height: c.h || 844 }, hasTouch: true, isMobile: true, userAgent: c.ua });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto((process.argv[2] || 'http://localhost:8010')); await page.waitForFunction(() => ready);
    // abre sozinho na primeira visita, com o jogo no menu
    await page.waitForFunction(() => !document.getElementById('iosHelp').hidden, null, { timeout: 8000 });
    const r = await page.evaluate(() => ({ title: document.getElementById('iosTitle').textContent, steps: document.querySelectorAll('#iosSteps li').length,
      arrow: !document.getElementById('iosArrow').hidden, copy: !document.getElementById('iosCopy').hidden, bar: !document.getElementById('installBar').hidden }));
    assert.match(r.title, c.title, name); assert.equal(r.arrow, c.arrow, name + ' arrow'); assert.equal(r.copy, c.copy, name + ' copy'); assert.ok(r.steps >= 2, name + ' steps');
    await page.screenshot({ path: 'ios-' + name + '.png' });
    // "Entendi" fecha e não reabre sozinho na próxima visita
    await page.locator('#iosHelpOk').tap(); assert.ok(await page.evaluate(() => document.getElementById('iosHelp').hidden), name + ' fecha');
    await page.reload(); await page.waitForFunction(() => ready); await page.waitForTimeout(2500);
    assert.ok(await page.evaluate(() => document.getElementById('iosHelp').hidden), name + ' não reabre');
    // mas a barra Instalar abre de novo
    await page.locator('#installGo').tap(); assert.ok(await page.evaluate(() => !document.getElementById('iosHelp').hidden), name + ' botão');
    assert.deepEqual(errs, [], name); await ctx.close(); console.log('ok', name, JSON.stringify(r));
  }
  // Android/desktop: nada de guia do iPhone
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 } }); const page = await ctx.newPage();
  await page.goto((process.argv[2] || 'http://localhost:8010')); await page.waitForFunction(() => ready); await page.waitForTimeout(2500);
  assert.ok(await page.evaluate(() => document.getElementById('iosHelp').hidden && document.getElementById('btnInstall').hidden), 'desktop sem guia');
  await browser.close(); console.log('iOS: OK');
})().catch(e => { console.error(e); process.exit(1); });

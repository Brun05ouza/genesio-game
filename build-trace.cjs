// Percorre todas as telas/fases e anota cada arquivo que o jogo realmente pede (para montar a pasta dist/)
const { chromium } = require('C:/Users/bs902/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('fs');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const seen = new Set(), bad = [];
  for (const vp of [{ width: 1280, height: 720 }, { width: 740, height: 360, hasTouch: true, isMobile: true }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: !!vp.hasTouch, isMobile: !!vp.isMobile });
    const page = await ctx.newPage();
    page.on('response', r => { const u = new URL(r.url()); if (u.hostname === 'localhost') { seen.add(decodeURIComponent(u.pathname.slice(1)) || 'index.html'); if (r.status() >= 400) bad.push(r.url()); } });
    page.on('pageerror', e => bad.push('ERR ' + e.message));
    await page.goto('http://localhost:8000'); await page.waitForFunction(() => ready);
    const step = async (fn) => { try { await page.evaluate(fn); } catch (e) { bad.push('step ' + e.message); } await page.waitForTimeout(300); };
    await step(() => { show('menu'); show('settings'); show('menu'); show('oasis'); show('difficulty'); show('nature'); show('serra'); show('desert'); show('prompt'); show('menu'); });
    await step(async () => { await Runner.start('normal'); Runner.stop(); });
    await step(async () => { await Nature.start('epi'); Nature.stop(); await Climb.start(); Climb.stop(); await Hop.start(); Hop.stop(); });
    await step(async () => { await Solar.start(); Solar.stop(); });
    await step(async () => { await Flow.start(); Flow.stop(); });
    // mapas e fases do lobby (carregamento real)
    await step(async () => { await goToLevel('iguacu'); });
    await page.waitForTimeout(6500);
    await step(async () => { await goToLevel('praca'); });
    await page.waitForTimeout(6500);
    await step(async () => { await goToLevel('teresopolis'); });
    await page.waitForTimeout(9500);
    await step(() => { show('playing'); });
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync('build-files.json', JSON.stringify([...seen].sort(), null, 1));
  console.log('arquivos:', seen.size, 'problemas:', bad);
})();

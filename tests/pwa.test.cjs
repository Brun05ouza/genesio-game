// App instalável: manifesto, ícones, service worker e uso sem internet (rode com o dist em http://localhost:8001)
const { chromium } = require('C:/Users/bs902/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, serviceWorkers: 'allow' });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:8001/?sw=1'); await page.waitForFunction(() => ready);
  const r = {};
  const mf = await page.evaluate(async () => { const l = document.querySelector('link[rel=manifest]'); const m = await (await fetch(l.href)).json(); const ok = []; for (const i of m.icons) ok.push((await fetch(new URL(i.src, l.href))).ok); return { m, ok }; });
  r.manifest = mf.m.display_override.includes('fullscreen') && mf.m.orientation === 'landscape' && mf.m.icons.length >= 3;
  r.icons = mf.ok.every(Boolean);
  r.tags = await page.evaluate(() => !!document.querySelector('link[rel=apple-touch-icon]') && !!document.querySelector('link[rel=icon]'));
  await page.waitForFunction(() => navigator.serviceWorker.ready.then(() => true), null, { timeout: 15000 });
  await page.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 15000 }).catch(async () => { await page.reload(); await page.waitForFunction(() => ready); });
  r.swActive = await page.evaluate(() => !!navigator.serviceWorker.controller);
  r.cached = await page.evaluate(async () => { const k = await caches.keys(); const c = await caches.open(k[0]); return (await c.keys()).length; });
  r.installHidden = await page.evaluate(() => document.getElementById('installBar').hidden);   // sem evento de instalação: não aparece
  await ctx.setOffline(true);
  await page.reload(); await page.waitForFunction(() => ready, null, { timeout: 15000 });
  r.offlineOpens = await page.evaluate(() => state === 'menu' || typeof state === 'string');
  await page.screenshot({ path: 'pwa-offline.png' });
  // erro inesperado mostra o aviso
  await page.evaluate(() => setTimeout(() => { throw new Error('teste de erro'); }, 0)); await page.waitForTimeout(200);
  r.errBar = await page.evaluate(() => !document.getElementById('errBar').hidden && document.getElementById('errMsg').textContent.includes('teste'));
  console.log(r);
  for (const [k, v] of Object.entries(r)) assert.ok(v, k);
  await browser.close(); console.log('PWA: OK');
})().catch(e => { console.error(e); process.exit(1); });

// API local de teste: node server/server.js --port 8012 --static .. (DATABASE_URL e DEV_DB vazios).
const { chromium } = require('C:/Users/bs902/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const out = path.join(__dirname, 'out'); fs.mkdirSync(out, { recursive: true });
const URL = process.argv[2] || 'http://localhost:8012';
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(URL); await page.waitForFunction(() => ready);
    await page.click('#acGuest');
    for (const [mod, screen, prefix, arg] of [
      ['Runner', 'runner', 'r', 'facil'], ['Nature', 'nplay', 'n', 'epi'],
      ['Climb', 'kplay', 'k'], ['Hop', 'hplay', 'h'], ['Solar', 'splay', 's'], ['Flow', 'fplay', 'f'],
    ]) {
      await page.evaluate(async ({ mod, screen, arg }) => {
        const phase = { Runner, Nature, Climb, Hop, Solar, Flow }[mod];
        await phase.start(arg); show(screen); phase.togglePause();
      }, { mod, screen, arg });
      assert.ok(await page.locator(`#${prefix}Settings`).isVisible(), mod + ': botão na pausa');
      const snapshot = await page.evaluate(mod => JSON.stringify({ ...({ Runner, Nature, Climb, Hop, Solar, Flow }[mod]._debug()) }), mod);
      await page.click(`#${prefix}Settings`);
      await page.waitForFunction(() => state === 'settings');
      await page.locator('#volMusic').fill('24');
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(150);
      assert.equal(await page.evaluate(mod => JSON.stringify({ ...({ Runner, Nature, Climb, Hop, Solar, Flow }[mod]._debug()) }), mod), snapshot, mod + ': fase congelada nas configurações');
      if (prefix === 'f') await page.keyboard.press('Escape');
      else await page.click('#btnBack');
      assert.ok(await page.evaluate(({ mod, screen, prefix }) => state === screen && ({ Runner, Nature, Climb, Hop, Solar, Flow }[mod]._debug()).paused && document.getElementById(prefix + 'Overlay').classList.contains('active'), { mod, screen, prefix }), mod + ': retorna pausado');
      await page.keyboard.press('Escape');
      assert.ok(await page.evaluate(mod => !({ Runner, Nature, Climb, Hop, Solar, Flow }[mod]._debug()).paused, mod), mod + ': retoma');
      await page.evaluate(mod => { ({ Runner, Nature, Climb, Hop, Solar, Flow }[mod]).stop(); show('menu'); }, mod);
    }
    await page.click('#btnSettings'); await page.keyboard.press('Escape');
    assert.ok(await page.evaluate(() => state === 'menu'));
    // Enter no novo item do menu Flow também abre as configurações.
    await page.evaluate(async () => { await Flow.start(); show('fplay'); Flow.togglePause(); });
    await page.waitForTimeout(500); // proteção existente contra confirmar o menu no mesmo toque
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
    assert.ok(await page.evaluate(() => state === 'settings'));
    await page.keyboard.press('Escape'); await page.evaluate(() => { Flow.stop(); show('menu'); });
    // Ranking com dados determinísticos, sem alterar contas ou recordes.
    await page.route('**/api/ranking?*', route => route.fulfill({ json: { top: [{ name: 'Bruno', avatar: 'a', value: 3163 }, { name: 'Hiumy', avatar: 'b', value: 252 }], me: null, total: 2 } }));
    await page.evaluate(() => Ranking.open());
    await page.waitForSelector('.rk-row');
    for (const viewport of [{ width: 1280, height: 720 }, { width: 844, height: 390 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await page.evaluate(() => document.getElementById('rotate').style.display = 'none');
      await page.waitForFunction(() => [...document.querySelectorAll('.rk-brand img')].every(img => img.complete && img.naturalWidth > 0));
      assert.ok(await page.evaluate(() => {
        const tabs = document.getElementById('rkTabs'), r = tabs.getBoundingClientRect();
        return tabs.scrollWidth <= tabs.clientWidth && [...tabs.children].every(b => { const x = b.getBoundingClientRect(); return x.left >= r.left && x.right <= r.right + 1; });
      }), 'logos cabem: ' + viewport.width);
      await page.screenshot({ path: path.join(out, `ranking-${viewport.width}.png`) });
    }
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.locator('[data-g="geral"]').focus();
    await page.keyboard.press('End');
    assert.ok(await page.evaluate(() => document.activeElement.dataset.g === 'flow' && document.activeElement.getAttribute('aria-selected') === 'true'));
    assert.deepEqual(errors, []);
    console.log('Configurações nas 6 pausas, retorno e ranking responsivo: OK');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });

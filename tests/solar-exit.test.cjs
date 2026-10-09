const { chromium } = require('C:/Users/bs902/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto((process.argv[2] || 'http://localhost:8010')); await page.waitForFunction(() => ready);
  const visible = id => page.locator(id).isVisible();
  // 1) sair pela pausa, no meio da fase
  await page.evaluate(() => { levelId = 'teresopolis'; player.wx = 960; player.wy = 860; show('playing'); checkOasisSign(); });
  await page.locator('#btnYes').click(); await page.waitForFunction(() => state === 'splay');
  await page.evaluate(() => { localStorage.removeItem('genesio-coins'); Solar._debug().kills = 3; });
  await page.keyboard.press('Escape');
  assert.ok(await visible('#sExit'), 'botão de sair aparece na pausa');
  await page.locator('#sExit').click();
  assert.equal(await page.evaluate(() => state), 'playing');
  assert.equal(await page.evaluate(() => levelId), 'teresopolis');
  assert.equal(await page.evaluate(() => +localStorage.getItem('genesio-coins')), 6, 'moedas dos mobs derrotados');
  // 2) sair ao morrer na arena
  await page.evaluate(() => { player.wx = 960; player.wy = 860; promptBlocked = false; promptSign = null; checkOasisSign(); });
  await page.locator('#btnYes').click(); await page.waitForFunction(() => state === 'splay');
  await page.evaluate(() => { state = 'test'; const g = Solar._debug(); g.arenaReached = true; g.hp = 0; g.dead = true; g.deadT = 2; Solar.update(.02); state = 'splay'; });
  assert.ok(await visible('#sExit'), 'botão de sair aparece ao perder');
  await page.locator('#sExit').click();
  assert.equal(await page.evaluate(() => state), 'playing');
  // 3) depois de sair dá para entrar em outra fase pela placa vizinha
  await page.evaluate(() => { player.wx = 570; player.wy = 460; checkOasisSign(); });
  assert.match(await page.locator('#promptText').innerText(), /Nature/);
  assert.deepEqual(errors, []);
  await browser.close(); console.log('Sair do Solar: OK');
})().catch(e => { console.error(e); process.exit(1); });

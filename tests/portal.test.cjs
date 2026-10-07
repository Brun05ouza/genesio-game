// Lobby: encostar no portal de Teresópolis (pelo meio ou pelos lados) já entra na fase; ao voltar, não entra de novo sozinho.
const { chromium } = require('C:/Users/bs902/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const URL = process.argv[2] || 'http://localhost:8000';
(async () => {
  const b = await chromium.launch({ headless: true, channel: 'msedge' }); const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  await p.goto(URL); await p.waitForFunction(() => ready);
  const r = {};
  for (const x of [627, 580, 680]) {
    await p.evaluate(x => { show('playing'); levelId = 'praca'; player.wx = x; player.wy = 300; }, x);
    await p.keyboard.down('KeyW');
    await p.waitForFunction(() => state === 'transition', null, { timeout: 6000 }).catch(() => {});
    await p.keyboard.up('KeyW');
    r['entra:' + x] = await p.evaluate(() => state === 'transition');
    await p.waitForFunction(() => state === 'playing' && levelId === 'teresopolis', null, { timeout: 20000 });
    await p.evaluate(() => goToLevel('praca')); await p.waitForFunction(() => state === 'playing' && levelId === 'praca', null, { timeout: 20000 });
    await p.waitForTimeout(500);
    r['voltaSemReentrar:' + x] = await p.evaluate(() => state === 'playing' && levelId === 'praca');
  }
  await b.close(); console.log(r);
  for (const [k, v] of Object.entries(r)) assert.ok(v, k);
  console.log('Portal: OK');
})().catch(e => { console.error(e); process.exit(1); });

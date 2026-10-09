// Setas = WASD em todo o jogo (lobby, Nature, Solar e Subida).
// Rode com o jogo em http://localhost:8010 (servidor só de arquivos: python -m http.server 8010) (ou passe a URL como argumento).
const { chromium } = require('C:/Users/bs902/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const URL = process.argv[2] || 'http://localhost:8010';
(async () => {
  const b = await chromium.launch({ headless: true, channel: 'msedge' }); const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  await p.goto(URL); await p.waitForFunction(() => ready); await p.evaluate(() => show('playing'));
  const r = {};
  for (const [k, ax] of [['ArrowRight', 'wx'], ['ArrowLeft', 'wx'], ['ArrowUp', 'wy'], ['ArrowDown', 'wy']]) {
    const v0 = await p.evaluate(a => player[a], ax); await p.keyboard.down(k); await p.waitForTimeout(400); await p.keyboard.up(k);
    r['lobby:' + k] = (await p.evaluate(a => player[a], ax)) !== v0;
  }
  await p.evaluate(async () => { levelId = 'teresopolis'; await beginChallenge('epi'); }); await p.waitForFunction(() => state === 'nplay'); await p.waitForTimeout(2700);
  let x0 = await p.evaluate(() => Nature._debug().x); await p.keyboard.down('ArrowRight'); await p.waitForTimeout(400); await p.keyboard.up('ArrowRight'); r.nature = (await p.evaluate(() => Nature._debug().x)) > x0 + 10;
  await p.evaluate(async () => { Nature.stop(); await beginSolar(); }); await p.waitForFunction(() => state === 'splay'); await p.waitForTimeout(3200);
  x0 = await p.evaluate(() => Solar._debug().x); await p.keyboard.down('ArrowRight'); await p.waitForTimeout(400); await p.keyboard.up('ArrowRight'); r.solar = (await p.evaluate(() => Solar._debug().x)) > x0 + 10;
  await p.evaluate(async () => { Solar.stop(); await beginChallenge('hop'); }); await p.waitForFunction(() => state === 'hplay'); await p.waitForTimeout(500);
  x0 = await p.evaluate(() => Hop._debug().x); await p.keyboard.down('ArrowLeft'); await p.waitForTimeout(400); await p.keyboard.up('ArrowLeft'); r.hop = (await p.evaluate(() => Hop._debug().x)) < x0 - 5;
  await b.close(); console.log(r);
  for (const [k, v] of Object.entries(r)) assert.ok(v, k);
  console.log('Setas: OK');
})().catch(e => { console.error(e); process.exit(1); });

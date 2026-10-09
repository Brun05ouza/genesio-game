const { chromium } = require('C:/Users/bs902/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto((process.argv[2] || 'http://localhost:8010')); await page.waitForFunction(() => ready);
  const ev = fn => page.evaluate(fn);
  const prompt = async () => ({ open: (await page.locator('#prompt').getAttribute('class')).includes('active'), text: (await page.locator('#promptText').innerText()).replace(/\s+/g, ' ') });
  const at = async (x, y) => { await ev(`player.wx = ${x}; player.wy = ${y}; checkOasisSign()`); return prompt(); };
  await ev(() => { levelId = 'teresopolis'; show('playing'); });
  // 1) Solar: abre, entra na fase e sai (terminar a fase não é necessário: usa a saída do menu de pausa do Nature para o mesmo caminho de retorno)
  let p = await at(960, 860); assert.ok(p.open && /Solar/.test(p.text), 'solar abre');
  await page.locator('#btnNo').click();
  assert.equal(await ev(() => state), 'playing');
  // continua parado em cima da placa: não reabre sozinha
  p = await at(960, 860); assert.ok(!p.open, 'mesma placa não reabre em cima dela');
  // 2) vai direto para a placa vizinha (antes ficava bloqueado): Nature
  p = await at(570, 460); assert.ok(p.open && /Nature/.test(p.text), 'nature abre logo depois');
  await page.locator('#btnYes').click(); assert.equal(await ev(() => state), 'nature');
  await ev(() => { show('nplay'); });                // simula estar dentro de um desafio e sair pelo botão
  await page.evaluate(() => { document.getElementById('nExit').click(); });
  assert.equal(await ev(() => state), 'playing');
  // 3) depois de sair de uma fase, vai para a placa do Flow: tem que abrir
  p = await at(470, 850); assert.ok(p.open && /Flow/.test(p.text), 'flow abre depois de sair de outra fase');
  await page.locator('#btnNo').click();
  // 4) volta para o Solar sem ter se afastado de todas as placas
  p = await at(960, 860); assert.ok(p.open && /Solar/.test(p.text), 'solar abre de novo vindo de outra placa');
  await page.locator('#btnNo').click();
  // 5) a placa usada reabre depois que o Genésio se afasta dela
  await at(690, 760); p = await at(960, 860); assert.ok(p.open, 'reabre depois de se afastar');
  assert.deepEqual(errors, []);
  await browser.close(); console.log('Placas: OK');
})().catch(e => { console.error(e); process.exit(1); });

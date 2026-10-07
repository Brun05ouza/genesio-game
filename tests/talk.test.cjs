// Conversa de boas-vindas (estilo Pokémon FireRed): aparece ao Começar, texto surge aos poucos, clique/toque/Enter avançam, Pular e Esc encerram.
// Rode com o jogo em http://localhost:8000 (ou passe a URL como argumento).
const { chromium } = require('C:/Users/bs902/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const URL = process.argv[2] || 'http://localhost:8000';
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const r = {};
  const run = async (name, ctxOpts, tapStart, advance) => {
    const ctx = await browser.newContext(ctxOpts); const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto(URL); await page.waitForFunction(() => ready);
    const ev = f => page.evaluate(f);
    await page.evaluate(() => document.getElementById('btnStart').click());           // Começar
    await page.waitForFunction(() => state === 'talk');
    r[name + ':abre'] = await ev(() => !document.getElementById('talk').hidden && Talk.isActive());
    // o texto vai aparecendo (máquina de escrever)
    await page.waitForTimeout(250);
    const part = await ev(() => document.getElementById('talkText').textContent.length);
    r[name + ':digitando'] = part > 0 && part < 30 && await ev(() => document.getElementById('talkMore').hidden);
    await page.screenshot({ path: `talk-${name}-1.png` });
    // o toque que abriu a conversa não pula a fala; tocar durante a digitação completa a fala
    await page.waitForTimeout(250);                                                  // passa o bloqueio inicial de 450 ms
    await ev(() => { Talk._debug(); });
    await advance(page); await page.waitForTimeout(40);                              // completa a fala (ou já passa para a próxima)
    if (!(await ev(() => Talk._debug().typing))) { await advance(page); await page.waitForTimeout(40); }   // se a fala já tinha terminado, avança
    await advance(page); await page.waitForTimeout(60);                              // tocar enquanto digita completa a fala
    r[name + ':completa'] = await ev(() => { const d = Talk._debug(); return !d.typing && !document.getElementById('talkMore').hidden; });
    await page.screenshot({ path: `talk-${name}-2.png` });
    // jogador parado enquanto conversa
    const x0 = await ev(() => player.wx); await page.keyboard.down('KeyD'); await page.waitForTimeout(300); await page.keyboard.up('KeyD');
    r[name + ':semMover'] = (await ev(() => player.wx)) === x0;
    // passa as falas até o fim
    const n = await ev(() => Talk._debug().n);
    for (let k = 1; k < n; k++) { await advance(page); await page.waitForTimeout(60); await advance(page); await page.waitForTimeout(60); }
    await advance(page); await page.waitForTimeout(60); await advance(page);
    await page.waitForFunction(() => state === 'playing', null, { timeout: 5000 });
    await page.waitForTimeout(300);
    r[name + ':terminaNoJogo'] = await ev(() => !Talk.isActive() && document.getElementById('talk').hidden);
    // andar depois da conversa funciona
    const x1 = await ev(() => player.wx); await page.keyboard.down('KeyD'); await page.waitForTimeout(400); await page.keyboard.up('KeyD');
    const x2 = await ev(() => player.wx); console.log(name, 'x', x1, x2, await ev(() => JSON.stringify({ s: state, k: keys.KeyD, touch: document.body.classList.contains('touch') })));
    r[name + ':andaDepois'] = x2 > x1 + 5;
    // Continuar (menu → de novo) não repete a conversa
    await ev(() => openMenu()); await ev(() => document.getElementById('btnStart').click());
    await page.waitForTimeout(300);
    r[name + ':naoRepete'] = await ev(() => state === 'playing' && !Talk.isActive());
    assert.deepEqual(errs, [], name); await ctx.close();
  };
  // desktop: clique e teclado
  await run('desktop', { viewport: { width: 1280, height: 720 } }, null, async page => { await page.mouse.click(640, 300); });
  // celular deitado: toque
  await run('phone', { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }, null, async page => { await page.touchscreen.tap(500, 200); });

  // teclado (Enter) e Pular / Esc
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } }); const page = await ctx.newPage();
  await page.goto(URL); await page.waitForFunction(() => ready);
  await page.evaluate(() => document.getElementById('btnStart').click()); await page.waitForFunction(() => state === 'talk'); await page.waitForTimeout(600);
  await page.keyboard.press('Enter'); await page.waitForTimeout(60);
  const a = await page.evaluate(() => Talk._debug()); await page.keyboard.press('Enter'); await page.waitForTimeout(80);
  const b = await page.evaluate(() => Talk._debug());
  r['teclado:enter'] = !a.typing && b.i === 1;
  await page.locator('#talkSkip').click(); await page.waitForFunction(() => state === 'playing');
  await page.waitForTimeout(300);
  r['pular'] = await page.evaluate(() => !Talk.isActive() && document.getElementById('talk').hidden);
  await page.evaluate(() => { started = false; show('menu'); document.getElementById('btnStart').click(); }); await page.waitForFunction(() => state === 'talk'); await page.waitForTimeout(500);
  await page.keyboard.press('Escape'); await page.waitForFunction(() => state === 'playing');
  r['esc'] = await page.evaluate(() => !Talk.isActive());
  await browser.close();
  console.log(r);
  for (const [k, v] of Object.entries(r)) assert.ok(v, k);
  console.log('Conversa: OK');
})().catch(e => { console.error(e); process.exit(1); });

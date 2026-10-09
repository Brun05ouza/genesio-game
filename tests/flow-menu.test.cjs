// Atalhos do menu do Flow: Espaço = voar de novo, Esc = sair, ↑/↓ escolhem e Enter confirma; na pausa Esc/Espaço continuam.
// Rode com o jogo em http://localhost:8010 (servidor só de arquivos: python -m http.server 8010) (ou passe a URL como argumento).
const { chromium } = require('C:/Users/bs902/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const URL = process.argv[2] || 'http://localhost:8010';
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto(URL); await page.waitForFunction(() => ready);
  const ev = (f, a) => page.evaluate(f, a);
  const r = {};
  const startFlow = async () => { await ev(async () => { levelId = 'teresopolis'; show('playing'); await beginFlow(); }); await page.waitForFunction(() => state === 'fplay' && Flow.isRunning()); };
  const die = async () => {
    await ev(() => { const g = Flow._debug(); g.phase = 'play'; g.y = Flow.MH + 400; });
    await page.waitForFunction(() => document.getElementById('fOverlay').classList.contains('active') && Flow._debug().ended, null, { timeout: 8000 });
  };
  await startFlow();
  // setinhas/W também voam
  for (const key of ['ArrowUp', 'KeyW', 'Space']) {
    await ev(() => { const g = Flow._debug(); g.vy = 300; g.phase = 'ready'; });
    await page.keyboard.down(key); await page.waitForTimeout(350); await page.keyboard.up(key);
    r['voa:' + key] = await ev(() => Flow._debug().phase === 'play');
  }
  await die();
  r.dicas = await ev(() => document.getElementById('fPrimaryKey').textContent === 'Espaço' && document.getElementById('fExitKey').textContent === 'Esc' && !document.getElementById('fExitKey').hidden);
  r.selecionaPrimeiro = await ev(() => document.getElementById('fPrimary').classList.contains('sel'));
  // Espaço logo após bater não reinicia (ainda está apertando para voar)
  await page.keyboard.press('Space'); await page.waitForTimeout(100);
  r.espacoCedoIgnorado = await ev(() => Flow._debug().ended);
  await page.waitForTimeout(500);
  await page.keyboard.press('Space'); await page.waitForTimeout(200);
  r.espacoReinicia = await ev(() => !Flow._debug().ended && !Flow._debug().dead && !document.getElementById('fOverlay').classList.contains('active') && Flow._debug().phase === 'ready' && Flow._debug().score === 0);
  // ↓ seleciona "Sair", ↑ volta; Enter confirma o selecionado
  await die(); await page.waitForTimeout(500);
  await page.keyboard.press('ArrowDown');
  r.desce = await ev(() => document.getElementById('fExit').classList.contains('sel') && !document.getElementById('fPrimary').classList.contains('sel'));
  await page.keyboard.press('ArrowUp');
  r.sobe = await ev(() => document.getElementById('fPrimary').classList.contains('sel'));
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  await page.waitForFunction(() => state === 'playing' && !Flow.isRunning(), null, { timeout: 5000 });
  r.enterSai = await ev(() => state === 'playing');
  // Enter no botão principal reinicia
  await startFlow(); await die(); await page.waitForTimeout(500);
  await page.keyboard.press('Enter'); await page.waitForTimeout(200);
  r.enterReinicia = await ev(() => !Flow._debug().ended && Flow.isRunning());
  // Esc na tela "Você bateu" sai
  await die(); await page.waitForTimeout(500);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => state === 'playing' && !Flow.isRunning(), null, { timeout: 5000 });
  r.escSai = true;
  // na pausa: Esc continua, e Espaço continua sem dar impulso
  await startFlow(); await ev(() => { const g = Flow._debug(); g.phase = 'play'; });
  await page.keyboard.press('Escape'); await page.waitForTimeout(100);
  r.pausa = await ev(() => Flow._debug().paused && document.getElementById('fExitKey').hidden);
  await page.keyboard.press('Escape'); await page.waitForTimeout(100);
  r.escContinua = await ev(() => !Flow._debug().paused);
  await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  const vy0 = await ev(() => Flow._debug().vy);
  await page.keyboard.press('Space'); await page.waitForTimeout(100);
  r.espacoContinuaSemImpulso = await ev(() => !Flow._debug().paused) && (await ev(() => Flow._debug().vy)) >= vy0 - 1;
  await browser.close();
  console.log(r);
  for (const [k, v] of Object.entries(r)) assert.ok(v, k);
  assert.deepEqual(errs, []);
  console.log('Flow (atalhos): OK');
})().catch(e => { console.error(e); process.exit(1); });

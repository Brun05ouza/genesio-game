// Oásis: a velocidade cresce com os pontos (a cada 500 pontos um nível a mais, com aviso), até o teto da dificuldade.
const { chromium } = require('C:/Users/bs902/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const URL = process.argv[2] || 'http://localhost:8000';
(async () => {
  const b = await chromium.launch({ headless: true, channel: 'msedge' }); const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL); await p.waitForFunction(() => ready);
  const r = await p.evaluate(async () => {
    await Runner.start('normal'); state = 'test';
    const g = Runner._debug(); g.phase = 'run'; g.invul = 1e9; g.lives = 99;
    const tick = s => { for (let i = 0; i < s * 60; i++) { g.obst = []; g.invul = 1e9; Runner.update(1 / 60); } };
    const out = {};
    tick(4); out.inicio = Math.round(g.speed); g.dist = 400 * 10; tick(20); g.dist = 400 * 10; tick(1); out.inicioTrava = Math.round(g.speed);   // antes dos 500 pontos: no máximo vmax
    g.level = 0; g.speed = 700; g.dist = 600 * 10; g.bonus = 0; tick(0.3); out.aviso = g.popups.some(q => q.text === 'MAIS RÁPIDO!'); tick(3); out.nivel1 = Math.round(g.speed);
    g.dist = 2600 * 10; tick(6); out.nivel5 = Math.round(g.speed);
    g.dist = 99999 * 10; tick(12); out.teto = Math.round(g.speed);
    return out;
  });
  await b.close(); console.log(r);
  assert.ok(r.inicioTrava <= 700, 'antes de 500 pontos fica no máximo inicial');
  assert.ok(r.nivel1 > 700 && r.aviso, 'nível 1 mais rápido e com aviso');
  assert.ok(r.nivel5 > r.nivel1, 'mais pontos = mais rápido');
  assert.equal(r.teto, 1050, 'para no teto da dificuldade');
  assert.deepEqual(errs, []);
  console.log('Oásis (velocidade): OK');
})().catch(e => { console.error(e); process.exit(1); });

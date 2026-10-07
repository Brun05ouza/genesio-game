// Solar do Bosque: cura ao chegar no boss, conversas Genésio × Golem (entrada, fúria e vitória) e chuva de pregos.
// Rode com o jogo em http://localhost:8000 (ou passe a URL como argumento).
const { chromium } = require('C:/Users/bs902/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const URL = process.argv[2] || 'http://localhost:8000';
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto(URL); await page.waitForFunction(() => ready);
  const ev = (f, a) => page.evaluate(f, a);
  const r = {};
  const tick = (s) => ev(s => { for (let i = 0; i < s * 60; i++) Solar.update(1 / 60); }, s);
  const shot = async name => { await ev(() => { state = 'splay'; }); await page.waitForTimeout(60); await page.screenshot({ path: name }); await ev(() => { state = 'test'; }); };
  const pass = async () => {                                   // passa uma fala (completa a digitação e avança)
    await page.waitForTimeout(520);
    await ev(() => { const d = Talk._debug(); if (d.typing) { Talk.advance(); } Talk.advance(); });
    await page.waitForTimeout(60);
  };

  await ev(async () => { await beginSolar(); });
  await page.waitForFunction(() => Solar.isRunning() && Solar._debug(), null, { timeout: 30000 });
  await ev(() => { state = 'test'; Solar._debug().phase = 'run'; });
  await tick(3.1);
  r.martelo = await ev(() => { const g = Solar._debug(); return g.helmets.length === 3 && !g.special; });
  // pega o martelo especial
  await ev(() => { const g = Solar._debug(), h = g.helmets[0]; g.x = h.x; g.y = h.y + 64; g.plat = null; g.vy = 0; });
  await tick(.05);
  r.pegou = await ev(() => Solar._debug().special === true);

  // ---------------- chegada no boss: cura total ----------------
  await ev(() => { const g = Solar._debug(); g.hp = 2; g.hurtT = 0; g.invul = 0; g.vx = 0; g.x = Solar.ARENA_TRIGGER + 50; });
  await tick(.05);
  r.curaComeca = await ev(() => { const g = Solar._debug(); return g.phase === 'intro' && !!g.heal && g.boss.st === 'pre' && g.hp === 2; });
  await tick(.9);
  const mid = await ev(() => Solar._debug().hp);
  r.curaProgressiva = mid > 2 && mid < 5;
  await shot('solar-heal.png');
  await tick(1.6);
  r.curaTotal = await ev(() => { const g = Solar._debug(); return g.hp === 5 && g.heal === null && ['fall', 'land'].includes(g.boss.st); });
  // golem cai, ruge e a conversa abre
  await tick(.2);
  await ev(() => { const g = Solar._debug(); g.noTalk = false; });
  for (let i = 0; i < 40 && !(await ev(() => Solar._debug().talking)); i++) await tick(.2);
  r.conversaAbre = await ev(() => Solar._debug().talking && Talk.isActive() && Talk._debug().n === 6);
  const frozen0 = await ev(() => Solar._debug().boss.t);
  await page.waitForTimeout(400); await tick(1);
  r.mundoParado = await ev(t => Math.abs(Solar._debug().boss.t - t) < 0.001, frozen0);
  r.golemPrimeiro = await ev(() => document.getElementById('talkWho').textContent === 'Golem Demolidor' && document.getElementById('talk').classList.contains('right') && document.getElementById('talk').classList.contains('boss'));
  await shot('solar-talk-golem.png');
  await pass();
  r.genesioFala = await ev(() => document.getElementById('talkWho').textContent === 'Genésio' && !document.getElementById('talk').classList.contains('right'));
  await shot('solar-talk-genesio.png');
  for (let i = 0; i < 5; i++) await pass();
  await page.waitForTimeout(300);
  r.conversaFecha = await ev(() => !Solar._debug().talking && !Talk.isActive());
  await tick(.2);
  r.luta = await ev(() => Solar._debug().phase === 'fight');

  // ---------------- fúria ----------------
  await ev(() => { const g = Solar._debug(), b = g.boss; b.st = 'idle'; b.acd = 99; b.hp = 21; g.invul = 99; });
  await ev(() => { const g = Solar._debug(), b = g.boss; b.hp = 20.5; g.x = b.x - 150; });
  // um golpe que cruza a metade da vida
  await ev(() => { const g = Solar._debug(), b = g.boss; b.hp = 20.2; b.st = 'rec'; b.rec = 9; b.t = 0; g.x = b.x - 170; g.y = Solar.GY; g.plat = Solar.PLATS[0]; g.face = 1; keys.KeyJ = true; });
  await tick(.3); await ev(() => { keys.KeyJ = false; });
  r.furiaConversa = await ev(() => Solar._debug().boss.p2 && Solar._debug().talking && Talk._debug().n === 2);
  await pass(); await pass(); await page.waitForTimeout(300);
  r.furiaFecha = await ev(() => !Solar._debug().talking);
  await tick(2);

  // ---------------- chuva de pregos ----------------
  await ev(() => { const g = Solar._debug(), b = g.boss; g.special = true; g.invul = 0; g.hp = 5; b.hp = 30; b.p2 = true; b.st = 'idle'; b.acd = 99; g.x = b.x - 380; g.y = Solar.GY; g.plat = Solar.PLATS[0]; g.vx = 0; keys.KeyF = true; });
  await tick(.04); await ev(() => { keys.KeyF = false; });
  r.pregos = await ev(() => { const g = Solar._debug(); return !!g.rain && g.rain.hammers.length === 18; });
  await tick(1.1);
  await ev(() => { show('splay'); Solar.draw(ctx); });
  await page.screenshot({ path: 'solar-nails.png' });
  await tick(2.2);
  r.pregosDano = await ev(() => { const b = Solar._debug().boss; return b.hp < 30 && b.hp > 14; });

  // ---------------- vitória ----------------
  await ev(() => { const g = Solar._debug(), b = g.boss; g.rain = null; b.st = 'rec'; b.rec = 9; b.t = 0; b.hp = 1; g.x = b.x - 170; g.y = Solar.GY; g.plat = Solar.PLATS[0]; g.face = 1; g.invul = 99; g.hurtT = 0; g.stumble = 0; g.atk = null; g.atkQ = false; g.atkHeld = false; g.comboT = 0; keys.KeyJ = true; });
  await tick(.45); await ev(() => { keys.KeyJ = false; });
  for (let i = 0; i < 40 && !(await ev(() => Solar._debug().talking)); i++) await tick(.2);
  r.vitoriaConversa = await ev(() => Solar._debug().talking && Talk._debug().n === 4 && Solar._debug().boss.st === 'dead');
  // Esc encerra a conversa
  await page.waitForTimeout(500);
  await page.keyboard.press('Escape'); await page.waitForTimeout(100);
  r.escPula = await ev(() => !Solar._debug().talking && !Talk.isActive());
  await tick(2.5);
  r.vence = await ev(() => Solar._debug().ended && Solar._debug().phase === 'win');

  // ---------------- lutar de novo: sem repetir a conversa de entrada ----------------
  await ev(async () => { await beginSolar(); state = 'test'; const g = Solar._debug(); g.arenaReached = true; g.hp = 0; g.dead = true; g.deadT = 9; });
  await ev(() => { Solar.primary ? Solar.primary() : null; });
  await browser.close();
  console.log(r);
  for (const [k, v] of Object.entries(r)) assert.ok(v, k);
  assert.deepEqual(errs, []);
  console.log('Solar (cura, conversas, pregos): OK');
})().catch(e => { console.error(e); process.exit(1); });

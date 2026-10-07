const { chromium } = require('C:/Users/bs902/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto((process.argv[2] || 'http://localhost:8000')); await page.waitForFunction(() => ready);
  const r = await page.evaluate(async () => {
    await beginSolar(); state = 'test';
    const tick = s => { for (let i = 0; i < s * 60; i++) Solar.update(1 / 60); };
    const g = Solar._debug(); g.noTalk = true; tick(3.1);
    const out = {};
    out.helmetsOnMap = g.helmets.length === 3 && g.helmets[0].x < 900 && !g.special;
    // pega o capacete da fase
    const h = g.helmets[0]; g.x = h.x; g.y = h.y + 64; g.plat = null; g.vy = 0; tick(.05);
    out.picked = g.special === true && h.got;
    // F fora do boss não gasta o especial
    keys.KeyF = true; tick(.05); keys.KeyF = false; tick(.05);
    out.keptForBoss = g.special === true && !g.rain;
    // vai para a arena
    g.hp = 5; g.invul = 0; g.x = Solar.ARENA_TRIGGER + 50; tick(.02); tick(5.8);
    out.fight = g.phase === 'fight';
    const b = g.boss;
    // ataques sorteados: nunca 'slam' e nenhuma onda de terra
    const seen = new Set(); let waves = 0;
    for (let i = 0; i < 300; i++) { b.st = 'idle'; b.acd = 0; b.last = ''; b.t = 0; g.x = b.x + (i % 3 === 0 ? -200 : i % 3 === 1 ? -500 : -900); g.invul = 99; Solar.update(1 / 60); seen.add(b.st); if (g.waves.length) waves++; g.waves.length = 0; }
    out.noSlam = !seen.has('slamW') && seen.has('punchW') && seen.has('swingW') && seen.has('stompW');
    out.attacksSeen = [...seen].join(',');
    // tempos de aviso maiores
    b.st = 'swingW'; b.t = 0; b.p2 = false; tick(.8); out.longWind = b.st === 'swingW'; tick(.5); out.thenSwings = b.st === 'swing';
    // chuva
    b.st = 'idle'; b.t = 0; b.acd = 99; g.invul = 0; g.hp = 5; g.x = b.x - 400; g.y = Solar.GY; g.plat = Solar.PLATS[0]; g.vx = 0;
    const hp0 = b.hp; keys.KeyF = true; tick(.03); keys.KeyF = false;
    out.rainStarted = !!g.rain && b.st === 'rainStun' && g.special === false && Solar.canRain() === false;
    tick(1.2); const mid = b.hp;
    out.damagedWhileRaining = mid < hp0 && b.st === 'rainStun';
    // imune: coloca um golem de tijolo em cima e o Genésio não perde vida
    g.mobs = [{ type: 'rock', x: g.x, y: g.y, plat: Solar.PLATS[0], hp: 9, dir: 1, vx: 0, t: 0, stun: 0, flash: 0, dead: false, mode: 'patrol', stride: 0, lunge: 0, windT: 0, cdAtk: 9, hitT: 0 }];
    tick(.3); out.immune = g.hp === 5;
    g.mobs = [];
    tick(1.4);
    out.rainEnded = !g.rain && b.st !== 'rainStun';
    out.totalDamage = hp0 - b.hp;
    out.cantAgain = !Solar.canRain();
    out.immuneAfter = g.invul > 0;
    // chuva que mata o boss
    g.special = true; g.invul = 0; b.hp = 3; b.st = 'idle'; b.p2 = false; b.acd = 99; keys.KeyF = true; tick(.03); keys.KeyF = false; tick(2.6);
    out.killsBoss = b.st === 'dead' && b.hp === 0;
    return out;
  });
  console.log(r);
  for (const [k, v] of Object.entries(r)) if (typeof v === 'boolean') assert.ok(v, k);
  // captura: chuva em andamento
  await page.evaluate(async () => {
    await beginSolar(); state = 'test'; const g = Solar._debug(); g.noTalk = true;
    const tick = s => { for (let i = 0; i < s * 60; i++) Solar.update(1 / 60); };
    tick(3.1); g.x = Solar.ARENA_TRIGGER + 50; tick(.02); tick(5.8);
    g.special = true; g.x = g.boss.x - 380; g.invul = 0; g.hp = 5; g.boss.acd = 99; g.boss.st = 'idle';
    keys.KeyF = true; tick(.03); keys.KeyF = false; tick(1.05); g.paused = true; show('splay'); Solar.draw(ctx);
  });
  await page.screenshot({ path: 'solar-rain-preview.png' });
  assert.deepEqual(errors, []);
  await browser.close(); console.log('Chuva de martelos: OK');
})().catch(e => { console.error(e); process.exit(1); });

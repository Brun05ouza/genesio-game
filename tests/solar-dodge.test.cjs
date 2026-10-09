const { chromium } = require('C:/Users/bs902/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto((process.argv[2] || 'http://localhost:8010')); await page.waitForFunction(() => ready);
  const r = await page.evaluate(async () => {
    await beginSolar(); state = 'test';
    const tick = s => { for (let i = 0; i < Math.round(s * 60); i++) Solar.update(1 / 60); };
    const g = Solar._debug(); g.noTalk = true; tick(3.1);
    const rock = { type: 'rock', x: 0, y: Solar.GY, plat: Solar.PLATS[0], hp: 9, dir: 1, vx: 0, t: 0, stun: 999, flash: 0, dead: false, mode: 'patrol', stride: 0, lunge: 0, windT: 0, cdAtk: 9, hitT: 0 };
    g.mobs = [rock]; g.face = 1; g.hp = 5; g.invul = 0; g.hurtT = 0;
    const out = {};
    keys.ShiftLeft = true; tick(1 / 60); keys.ShiftLeft = false;
    out.dashing = !!g.dodge;
    // ataques de todos os tipos durante o dash não machucam
    for (let i = 0; i < 18; i++) { rock.x = g.x; rock.y = g.y; tick(1 / 60); }          // 0,3 s encostado
    out.immuneDuringDash = g.hp === 5 && !!g.dodge;
    tick(.03); out.dashEnded = !g.dodge;
    rock.x = g.x; rock.y = g.y; tick(.05);
    out.graceAfterDash = g.hp === 5 && g.dodgeGrace > 0;
    tick(.2); rock.x = g.x; rock.y = g.y; tick(.02);
    out.damageAfterGrace = g.hp === 4;
    // ondas e pedras também passam por hurtPlayer (testado pela mesma via)
    g.invul = 0; g.hurtT = 0; g.hp = 5; g.vx = 0; g.dodgeCd = 0; g.mobs = [];
    keys.ShiftLeft = true; tick(1 / 60); keys.ShiftLeft = false; g.waves.push({ x: g.x, dir: 1, v: 0, h: 200, t: 0, life: .5 }); tick(.2);
    out.waveBlocked = g.hp === 5;
    return out;
  });
  console.log(r);
  for (const [k, v] of Object.entries(r)) assert.ok(v, k);
  assert.deepEqual(errors, []);
  await browser.close(); console.log('Esquiva imune: OK');
})().catch(e => { console.error(e); process.exit(1); });

const { chromium } = require('C:/Users/bs902/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.status() >= 400 && r.url().startsWith('http://localhost')) errors.push(r.url()); });
  await page.goto((process.argv[2] || 'http://localhost:8000'));
  await page.waitForFunction(() => ready);
  // Enter through the actual map sign and confirmation button.
  await page.evaluate(() => { levelId = 'teresopolis'; player.wx = 960; player.wy = 860; show('playing'); checkOasisSign(); });
  assert.equal(await page.locator('#prompt').getAttribute('class'), 'screen active');
  await page.locator('#btnYes').click();
  await page.waitForFunction(() => state === 'splay');
  // Stop the display loop while advancing deterministic simulation ticks.
  const result = await page.evaluate(() => {
    state = 'test';
    const tick = seconds => { for (let i = 0; i < seconds * 60; i++) Solar.update(1 / 60); };
    const g = Solar._debug(); g.noTalk = true; tick(3.1);
    const mobs = g.mobs.length;
    const rock = g.mobs.find(m => m.type === 'rock');
    rock.x = g.x + 80; rock.y = g.y; rock.stun = 5;
    keys.KeyJ = true; tick(.2); keys.KeyJ = false; tick(.25);
    const hammerDamage = rock.hp === 1;
    g.invul = 0; rock.x = g.x; tick(.05);
    const playerDamage = g.hp === 4;
    g.hp = 5; g.hurtT = 0; g.invul = 0; g.vx = 0; g.x = Solar.ARENA_TRIGGER + 50; tick(.02);
    const entry = g.phase === 'intro' && g.boss.st === 'pre' && g.mobs.length === 0 && !Solar.canExit();
    const introHP = g.hp; tick(5.2);
    const fight = g.phase === 'fight' && g.hp === introHP && g.bossBar > .8;
    keys.KeyA = true; tick(1.5); keys.KeyA = false;
    const locked = g.x >= g.wallL + 30 && !Solar.canExit();
    // Place the golem in a recovery window to exercise real hammer collision.
    const hitBoss = () => {
      g.boss.st = 'rec'; g.boss.rec = 5; g.boss.t = 0; g.boss.y = Solar.GY;
      g.x = g.boss.x - 170; g.y = Solar.GY; g.plat = Solar.PLATS[0];
      g.hp = 5; g.invul = 10; g.hurtT = 0; g.stumble = 0; g.face = 1;
      g.atk = null; g.atkQ = false; g.atkHeld = false; g.comboT = 0;
      keys.KeyJ = true; tick(.24); keys.KeyJ = false; tick(.18);
    };
    const before = g.boss.hp; hitBoss();
    const bossDamage = g.boss.hp === before - 1;
    g.boss.hp = 1; hitBoss();
    const death = g.boss.st === 'dead' && !Solar.canExit();
    tick(3.5);
    const celebration = g.phase === 'victory' && !Solar.canExit();
    tick(2);
    const win = Solar.canExit() && g.boss.hp === 0 && localStorage.getItem('genesio-solar-cleared') === '1';
    const coins = localStorage.getItem('genesio-coins'); tick(2);
    const singleReward = coins === localStorage.getItem('genesio-coins');
    Solar.draw(ctx);
    return { mobs, hammerDamage, playerDamage, entry, fight, locked, bossDamage, death, celebration, win, singleReward };
  });
  console.log(result);
  for (const [key, value] of Object.entries(result)) assert.ok(value, key);
  await page.locator('#sExit').click();
  assert.equal(await page.evaluate(() => state), 'playing');
  const combat = await page.evaluate(async () => {
    await beginSolar(); state = 'test';
    const tick = seconds => { for (let i = 0; i < seconds * 60; i++) Solar.update(1 / 60); };
    const g = Solar._debug(); g.noTalk = true; tick(3.1);
    const rock = g.mobs.find(m => m.type === 'rock'); g.mobs = [rock]; rock.stun = 99;
    keys.KeyD = true; tick(.5); keys.KeyD = false;
    const strideMoves = g.stride > 0; tick(.3); const stride = g.stride; tick(.3);
    const strideStops = Math.abs(g.stride - stride) < .01;
    g.vx = 0; g.invul = 0; g.face = 1;
    keys.ShiftLeft = true;
    for (let i = 0; i < 16; i++) { rock.x = g.x + 10; rock.y = g.y; tick(1 / 60); }
    const dodgeImmune = g.hp === 5 && !!g.dodge;
    rock.x = g.x + 800; tick(1); const heldOnce = !g.dodge && g.dodgeCd === 0;
    rock.x = g.x; tick(.02); const damageAfterDodge = g.hp === 4;
    keys.ShiftLeft = false; tick(.5);
    g.hp = 5; g.hurtT = 0; g.invul = 0; g.vx = 0; g.y = Solar.GY; g.plat = Solar.PLATS[0];
    g.face = 1; rock.x = g.x + 500; rock.y = g.y; rock.vx = 0; rock.hp = 2; rock.stun = 99;
    keys.KeyC = true; tick(1 / 60); keys.KeyC = false; tick(1 / 60);
    const launched = !!g.hammer && g.hammer.damage === 3 && g.hammer.dx === 1 && g.hammer.dy === 0;
    tick(.6); const rangedKill = g.kills === 1; tick(2);
    const returned = !g.hammer;
    keys.KeyC = true; tick(1.5); const heldCharge = !g.hammer && g.charge === 1.1;
    Solar.togglePause(); keys.KeyC = false; Solar.togglePause(); tick(.02);
    const cancelledCharge = !g.hammer && g.charge === null;
    keys.KeyJ = true; tick(1.1); const meleeNeverThrows = !g.hammer;
    Solar.togglePause(); keys.KeyJ = false; Solar.togglePause(); tick(.1);
    const pauseCancels = !g.hammer && !g.atkQ;
    // During a boss strike, immunity is granted by the dodge, not hurt invulnerability.
    g.x = Solar.ARENA_TRIGGER + 50; g.vx = 0; tick(.02); tick(5.7);
    const b = g.boss; b.st = 'punch'; b.t = 0; b.face = -1;
    g.x = b.x - 100; g.y = Solar.GY; g.plat = Solar.PLATS[0]; g.invul = 0; g.hp = 5;
    keys.ShiftLeft = true; tick(.1); keys.ShiftLeft = false;
    const bossDodge = g.hp === 5 && !!g.dodge;
    g.waves.push({ x: g.x, dir: 1, v: 0, h: 200, t: 0, life: .1 });
    g.debris.push({ x: g.x, y: g.y - 70, vy: 0, warn: 0, t: 0, st: 'fall' });
    tick(.04); const hazardDodge = g.hp === 5;
    tick(.5); b.st = 'rec'; b.t = 0; b.rec = 10;
    g.x = b.x - 600; g.vx = 0; g.face = 1; g.invul = 0;
    const bossHP = b.hp; keys.KeyC = true; tick(1 / 60); keys.KeyC = false; tick(.8);
    const rangedBoss = b.hp === bossHP - 3; tick(1.5);
    const oncePerThrow = b.hp === bossHP - 3;
    return { strideMoves, strideStops, dodgeImmune, heldOnce, damageAfterDodge, launched, rangedKill, returned, heldCharge, cancelledCharge, meleeNeverThrows, pauseCancels, bossDodge, hazardDodge, rangedBoss, oncePerThrow };
  });
  console.log(combat);
  for (const [key, value] of Object.entries(combat)) assert.ok(value, key);
  // Mouse attacks immediately; a short C press throws horizontally on release.
  await page.evaluate(async () => { await beginSolar(); state = 'test'; Solar._debug().phase = 'run'; });
  await page.mouse.move(500, 450); await page.mouse.down();
  await page.evaluate(() => Solar.update(1 / 60));
  assert.equal(await page.evaluate(() => !!Solar._debug().atk && !Solar._debug().hammer), true);
  await page.mouse.up();
  await page.evaluate(() => { for (let i = 0; i < 30; i++) Solar.update(1 / 60); });
  await page.keyboard.down('c');
  await page.evaluate(() => Solar.update(1 / 60));
  assert.equal(await page.evaluate(() => Solar._debug().hammer), null);
  await page.keyboard.up('c');
  await page.evaluate(() => Solar.update(1 / 60));
  assert.equal(await page.evaluate(() => Solar._debug().hammer.damage), 3);
  await page.evaluate(() => { for (let i = 0; i < 180; i++) Solar.update(1 / 60); keys.KeyD = true; for (let i = 0; i < 20; i++) Solar.update(1 / 60); keys.KeyD = false; Solar._debug().paused = true; show('splay'); Solar.draw(ctx); });
  await page.screenshot({ path: 'solar-movement-preview.png' });
  await page.evaluate(() => { state = 'test'; Solar._debug().paused = false; keys.ShiftLeft = true; Solar.update(.1); keys.ShiftLeft = false; Solar._debug().paused = true; show('splay'); Solar.draw(ctx); });
  await page.screenshot({ path: 'solar-dodge-preview.png' });
  // Mouse aim must account for CSS scaling, canvas offsets and camera position.
  await page.setViewportSize({ width: 960, height: 640 });
  await page.evaluate(async () => { await beginSolar(); state = 'test'; const g = Solar._debug(); g.phase = 'run'; g.x = 2200; g.cam = 1750; g.mobs = []; });
  await page.keyboard.down('c');
  await page.evaluate(() => { for (let i = 0; i < 75; i++) Solar.update(1 / 60); });
  const target = await page.evaluate(() => {
    const g = Solar._debug(), rect = document.getElementById('c').getBoundingClientRect();
    return { x: rect.left + (g.x + 400 - g.cam) * (720 / 941) * rect.width / 1280, y: rect.top + (g.y - 85 - 300) * (720 / 941) * rect.height / 720 };
  });
  await page.mouse.move(target.x, target.y);
  await page.evaluate(() => {
    const g = Solar._debug();
    g.mobs = [[400, -300], [250, 0]].map(([dx, dy]) => ({ type: 'fly', x: g.x + dx, y: g.y - 85 + dy, hx: g.x + dx, hy: g.y - 85 + dy, hp: 3, cd: 99, t: 0, st: 'hover', flash: 0, dead: false }));
  });
  await page.evaluate(() => { const g = Solar._debug(); g.paused = true; show('splay'); Solar.draw(ctx); });
  await page.screenshot({ path: 'solar-aim-preview.png' });
  await page.keyboard.up('c');
  const aim = await page.evaluate(() => { state = 'test'; const g = Solar._debug(); g.paused = false; Solar.update(1 / 60); return { x: g.hammer.dx, y: g.hammer.dy, damage: g.hammer.damage }; });
  assert.ok(Math.abs(aim.x - .8) < .01 && Math.abs(aim.y + .6) < .01, JSON.stringify(aim));
  assert.equal(aim.damage, 5);
  await page.evaluate(() => { for (let i = 0; i < 35; i++) Solar.update(1 / 60); });
  assert.equal(await page.evaluate(() => Solar._debug().kills), 1);
  assert.equal(await page.evaluate(() => Solar._debug().mobs.length), 1);
  await page.evaluate(() => { for (let i = 0; i < 200; i++) Solar.update(1 / 60); });
  assert.equal(await page.evaluate(() => Solar._debug().hammer), null);
  // A tap ignores the mouse, including when facing left. Dodge cancels a charge.
  const followup = await page.evaluate(() => {
    const g = Solar._debug(); g.face = -1;
    keys.KeyC = true; Solar.update(1 / 60); keys.KeyC = false; Solar.update(1 / 60);
    const leftTap = g.hammer.dx === -1 && g.hammer.dy === 0;
    for (let i = 0; i < 200; i++) Solar.update(1 / 60);
    keys.KeyC = true; for (let i = 0; i < 30; i++) Solar.update(1 / 60);
    keys.ShiftLeft = true; Solar.update(1 / 60); keys.KeyC = false; keys.ShiftLeft = false; Solar.update(1 / 60);
    return { leftTap, dodgeCancelsCharge: g.charge === null && !g.hammer };
  });
  assert.ok(followup.leftTap && followup.dodgeCancelsCharge);
  await page.setViewportSize({ width: 1280, height: 720 });
  // Render every supplied movement pose at game scale for visual verification.
  await page.evaluate(async () => {
    await beginSolar(); state = 'test'; const g = Solar._debug();
    g.phase = 'run'; g.x = 400; g.cam = 0; g.mobs = []; g.paused = true;
    const preview = document.createElement('canvas'); preview.id = 'movement-sheet-preview'; preview.width = 960; preview.height = 600;
    preview.style.cssText = 'position:fixed;left:0;top:0;transform:none;width:960px;height:600px;z-index:100';
    const p = preview.getContext('2d'), source = document.getElementById('c');
    for (let i = 0; i < 12; i++) {
      g.dodge = null; g.jumpT = 0; g.landT = 0; g.plat = Solar.PLATS[0]; g.y = Solar.GY; g.vx = 0; g.runBlend = 0;
      if (i < 4) { g.vx = 360; g.stride = i / 4; }
      else if (i < 8) g.dodge = { t: (i - 4) * .08 + .01, dir: 1 };
      else if (i < 11) { g.plat = null; g.jumpT = i === 8 ? .04 : 0; g.vy = i === 9 ? -600 : 0; }
      else g.landT = .1;
      Solar.draw(ctx);
      const x = (i % 4) * 240, y = Math.floor(i / 4) * 200;
      p.drawImage(source, 200, 500, 210, 190, x, y, 240, 200);
      p.fillStyle = '#fff'; p.font = 'bold 16px sans-serif'; p.fillText(String(i + 1), x + 10, y + 20);
    }
    document.body.appendChild(preview);
  });
  await page.locator('#movement-sheet-preview').screenshot({ path: 'solar-sheet-preview.png' });
  await page.locator('#movement-sheet-preview').evaluate(e => e.remove());
  // Retry checkpoint, pause, resume, and damage must remain functional.
  await page.evaluate(async () => { await beginSolar(); const g = Solar._debug(); g.arenaReached = true; g.hp = 0; g.dead = true; g.deadT = 2; state = 'test'; Solar.update(.02); Solar.primary(); });
  assert.equal(await page.evaluate(() => Solar._debug().phase), 'intro');
  await page.evaluate(() => { show('splay'); Solar.togglePause(); });
  await page.locator('#sPrimary').click();
  assert.equal(await page.evaluate(() => Solar._debug().paused), false);
  await page.evaluate(() => { state = 'test'; for (let i = 0; i < 260; i++) Solar.update(1 / 60); Solar._debug().paused = true; show('splay'); Solar.draw(ctx); });
  await page.screenshot({ path: 'solar-preview.png' });
  assert.deepEqual(errors, []);
  await browser.close();
  console.log('Solar: mapa, assets, martelo, dano, arena, boss, morte, vitória e pausa OK.');
})().catch(e => { console.error(e); process.exit(1); });

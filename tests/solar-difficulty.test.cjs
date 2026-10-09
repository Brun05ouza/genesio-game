// Seleção real, equilíbrio do combate, tentativas, recompensas e recordes por dificuldade.
const { chromium } = require('C:/Users/bs902/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const path = require('node:path'), fs = require('node:fs');
const out = path.join(__dirname, 'out'); fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(process.argv[2] || 'http://localhost:8010'); await page.waitForFunction(() => ready);
    await page.evaluate(() => { localStorage.setItem('genesio-solar-best', '777'); levelId = 'teresopolis'; player.wx = 960; player.wy = 860; show('playing'); checkOasisSign(); });
    await page.click('#btnYes');
    assert.equal(await page.evaluate(() => state), 'solarDifficulty');
    assert.match(await page.locator('#solar-best-normal').innerText(), /777/);
    for (const viewport of [{ width: 1280, height: 720 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(viewport);
      assert.ok(await page.evaluate(() => [...document.querySelectorAll('#solarDifficulty button')].every(b => { const r = b.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight; })), 'seleção cabe: ' + viewport.width);
      await page.screenshot({ path: path.join(out, `solar-difficulty-${viewport.width}.png`) });
    }
    await page.keyboard.press('Escape'); assert.equal(await page.evaluate(() => state), 'playing');
    await page.setViewportSize({ width: 1280, height: 720 });
    const results = [];
    for (const [key, hp, bossHp, rockHp, flyHp, reward] of [
      ['facil', 7, 28, 1, 1, 100], ['normal', 5, 40, 2, 1, 150], ['dificil', 4, 56, 3, 2, 225],
    ]) {
      await page.evaluate(() => openSolarDifficulty()); await page.click('#solarDiff-' + key);
      await page.waitForFunction(() => state === 'splay');
      const r = await page.evaluate(() => {
        state = 'test';
        const tick = s => { for (let i = 0; i < Math.round(s * 100); i++) Solar.update(.01); };
        let g = Solar._debug(); g.noTalk = true; g.phase = 'run';
        const rock = g.mobs.find(m => m.type === 'rock'), fly = g.mobs.find(m => m.type === 'fly');
        const data = { key: g.diff.key, hp: g.hp, rockHp: rock.hp, flyHp: fly.hp };
        g.mobs = [rock]; rock.x = g.x + 250; rock.y = Solar.GY; rock.cdAtk = 99;
        const startX = rock.x; tick(.1); data.mobTravel = startX - rock.x;
        g.mobs = []; g.x = Solar.ARENA_TRIGGER + 50; g.vx = 0; tick(.01);
        const boss = g.boss; data.bossHp = boss.hp;
        g.heal = null; g.phase = 'fight'; g.stumble = 0; boss.y = Solar.GY; boss.st = 'punchW'; boss.t = 0;
        let elapsed = 0; while (boss.st === 'punchW' && elapsed < 3) { tick(.01); elapsed += .01; }
        data.wind = elapsed;
        g.x = boss.x - 250; g.y = Solar.GY; g.plat = Solar.PLATS[0]; g.vx = 0; g.invul = 0; g.hurtT = 0;
        boss.st = 'swing'; boss.t = 0; boss.face = -1; const hp0 = g.hp; tick(.01);
        data.swingDamage = hp0 - g.hp;
        g.hp = 0; g.dead = true; g.deadT = 2; tick(.01); Solar.primary();
        g = Solar._debug(); g.noTalk = true;
        data.checkpoint = g.diff.key === data.key && g.hp === data.hp && g.boss.hp === data.bossHp && g.phase === 'intro';
        Solar.restartAll(); g = Solar._debug(); g.noTalk = true;
        data.restart = g.diff.key === data.key && g.hp === data.hp && g.mobs.some(m => m.hp === data.rockHp && m.type === 'rock');
        g.kills = 60; g.phase = 'victory'; g.phaseT = 2;
        const coins0 = +localStorage.getItem('genesio-coins') || 0; tick(.01);
        data.coins = (+localStorage.getItem('genesio-coins') || 0) - coins0;
        data.best = Solar.best(data.key); data.score = 600 + 500 + data.hp * 100;
        data.won = Solar.canExit();
        const saved = localStorage.getItem('genesio-coins'); tick(1); data.paysOnce = saved === localStorage.getItem('genesio-coins');
        return data;
      });
      assert.deepEqual([r.key, r.hp, r.bossHp, r.rockHp, r.flyHp], [key, hp, bossHp, rockHp, flyHp]);
      assert.equal(r.swingDamage, key === 'facil' ? 1 : 2);
      assert.ok(r.checkpoint && r.restart && r.won && r.paysOnce, key + ': tentativas e vitória');
      assert.equal(r.coins, 120 + reward); assert.equal(r.best, r.score);
      results.push(r);
      await page.evaluate(() => { Solar.stop(); show('playing'); });
    }
    assert.ok(results[0].mobTravel < results[1].mobTravel && results[1].mobTravel < results[2].mobTravel);
    assert.ok(results[0].wind > results[1].wind && results[1].wind > results[2].wind);
    assert.deepEqual(await page.evaluate(() => ['facil', 'normal', 'dificil'].map(k => Solar.best(k))), results.map(r => r.score));
    await page.evaluate(() => { show('playing'); Ranking.open(); }); await page.click('[data-g="solar"]');
    assert.deepEqual(await page.locator('#rkSub button').allTextContents(), ['Fácil', 'Normal', 'Difícil']);
    assert.deepEqual(errors, []); console.log('Solar: 3 dificuldades, combate, checkpoint, vitória, recordes e ranking OK', results);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });

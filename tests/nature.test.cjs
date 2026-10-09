// Rotas da subida, física das plataformas móveis e recordes reais da missão dos EPIs.
const { chromium } = require('C:/Users/bs902/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const URL = process.argv[2] || 'http://localhost:8012';
const out = path.join(__dirname, 'out'); fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(URL); await page.waitForFunction(() => ready); await page.click('#acGuest');
    await page.evaluate(async () => { await Hop.start(); state = 'test'; });
    const routes = await page.evaluate(() => {
      let checked = 0, moving = 0, lowExtras = 0, highExtras = 0;
      for (let trial = 0; trial < 25; trial++) {
        Hop.restart(); const seen = new Map();
        for (let band = 0; band < 24; band++) {
          const g = Hop._debug(); g.cam = -941 - band * 800; g.y = g.cam + 420; g.minY = g.y; g.vy = 0;
          Hop.update(1 / 120);
          for (const p of Hop._plats()) if (p.route) seen.set(p.serial || 0, p);
          if (trial === 0) {
            const extras = Hop._plats().filter(p => p.step && !p.route);
            if (band === 2) lowExtras = extras.length;
            if (band === 20) highExtras = extras.length;
          }
        }
        const route = [...seen.values()].sort((a, b) => b.y - a.y);
        for (let i = 1; i < route.length; i++) {
          if (!Hop.canHop(route[i - 1], route[i])) throw new Error('Rota impossível no salto ' + route[i].serial);
          checked++; if (route[i].amplitude) moving++;
        }
      }
      return { checked, moving, lowExtras, highExtras };
    });
    assert.ok(routes.checked > 2000 && routes.moving > 100); assert.ok(routes.highExtras < routes.lowExtras);
    const physics = await page.evaluate(() => {
      Hop.restart(); const g = Hop._debug(), p = Hop._plats().find(p => p.amplitude);
      const oldX = p.x0; g.y = p.y - 8; g.x = (p.x0 + p.x1) / 2; g.cam = g.y - 400; g.vy = 500; g.t = 4;
      Hop.update(0.03); const bounced = g.vy < 0 && g.y <= p.y && g.sinceBounce < 0.03;
      const moved = p.x0 !== oldX;
      g.paused = true; const saved = JSON.stringify({ g, p }); Hop.update(0.1); const pause = saved === JSON.stringify({ g, p });
      g.paused = false; g.x = 1; g.vx = -Hop.SPEED; keys.KeyA = true; Hop.update(1 / 60); keys.KeyA = false;
      const wrap = g.x > Hop.W - 10;
      // Queda rápida ainda pousa: não atravessa o topo de uma ilha.
      const q = Hop._plats().find(p => !p.amplitude && p.step); g.x = (q.x0 + q.x1) / 2; g.y = q.y - 10; g.cam = g.y - 400; g.vy = 2000; g.vx = 0;
      Hop.update(1 / 30); return { bounced, moved, pause, wrap, fastLanding: g.vy < 0 };
    });
    for (const [key, ok] of Object.entries(physics)) assert.ok(ok, key);
    await page.evaluate(() => { const g = Hop._debug(); g.paused = true; show('hplay'); });
    await page.screenshot({ path: path.join(out, 'nature-hop-upper.png') });
    await page.evaluate(async () => { Hop.stop(); await Nature.start('epi'); state = 'test'; });
    const times = await page.evaluate(() => {
      localStorage.removeItem('genesio-nature-time-epi');
      Nature.update(2.5); const countdownExcluded = Nature._debug().elapsed === 0;
      Nature._debug().paused = true; Nature.update(5); const pauseExcluded = Nature._debug().elapsed === 0; Nature._debug().paused = false;
      const win = elapsed => {
        Nature.restart(); const g = Nature._debug(), last = Nature.EPIS[Nature.EPIS.length - 1];
        g.phase = 'play'; g.elapsed = elapsed; g.got = new Set(Nature.EPIS.slice(0, -1).map(e => e.id)); g.x = last.x; g.y = last.y + 6; g.plat = null;
        Nature.update(0.01); return { won: g.won, best: Nature.bestTime(), count: Nature.best('epi') };
      };
      const first = win(12.34), slower = win(20), faster = win(10);
      Nature.restart(); const g = Nature._debug(); g.phase = 'play'; g.timeLeft = 0.001; Nature.update(0.01);
      return { countdownExcluded, pauseExcluded, first, slower, faster, afterLoss: Nature.bestTime(), loss: !g.won };
    });
    assert.ok(times.countdownExcluded && times.pauseExcluded && times.loss);
    assert.deepEqual(times.first, { won: true, best: 12350, count: 8 });
    assert.equal(times.slower.best, 12350); assert.equal(times.faster.best, 10010); assert.equal(times.afterLoss, 10010);
    await page.evaluate(() => { Nature.stop(); show('menu'); });
    assert.deepEqual(errors, []); console.log('Nature: rotas até 20.000 px, menos apoios no alto, plataformas móveis, pouso, pause e melhor tempo dos 8 EPIs OK');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });

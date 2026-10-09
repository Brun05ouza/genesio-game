const { chromium } = require('C:/Users/bs902/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', e => console.log('ERR', e.message));
  await page.goto('http://localhost:8010'); await page.waitForFunction(() => ready);
  const res = await page.evaluate(async ([MINGAP, FIXED]) => {
    const out = [];
    const GRAV = Flow.GRAV, FLAP = Flow.FLAP, MAXFALL = Flow.MAXFALL, HW = Flow.HIT.w, HH = Flow.HIT.h, HDY = Flow.HIT.dy, BX = Flow.BX, MH = Flow.MH;
    for (let trial = 0; trial < 12; trial++) {
      await Flow.start(); state = 'test'; const g = Flow._debug();
      const world = Flow._pillars(); const segs = Flow._segs();
      // percorre ~4 cenários
      for (let i = 0; i < 3; i++) { g.cam = 6000 * (i + 1); }
      g.cam = 0; Flow._debug();
      // gera mundo ate 9000
      for (let c = 0; c < 6000; c += 600) { g.cam = c; Flow.update(0); }
      g.cam = 0;
      const P = Flow._pillars().slice().sort((a, b) => a.x0 - b.x0);
      let states = new Map([[Math.round(470 / 4) + ',0,99', { y: 470, vy: 0, since: 99 }]]);
      let cam = 0, score = 0, frames = 0, alive = true, endCam = 6500;
      const passedAt = new Set();
      while (cam < endCam && alive) {
        const speed = FIXED || Math.min(540, 330 + 5.5 * Math.floor(cam / 520));
        const next = new Map(); cam += speed / 60; const wx = cam + BX, x0 = wx - HW / 2, x1 = wx + HW / 2;
        const near = P.filter(p => p.x1 > x0 - 5 && p.x0 < x1 + 5);
        for (const s of states.values()) {
          for (const fl of [0, 1]) {
            if (fl && s.since < MINGAP) continue;
            let vy = s.vy, y = s.y, since = s.since + 1;
            if (fl) { vy = -FLAP; since = 0; }
            vy = Math.min(MAXFALL, vy + GRAV / 60); y += vy / 60; if (y < 50) { y = 50; vy = Math.max(vy, 0); }
            if (y > MH + 20) continue;
            const y0 = y - HH / 2 + HDY, y1 = y + HH / 2 + HDY; let hit = false;
            for (const p of near) if (x1 > p.x0 + 4 && x0 < p.x1 - 4 && y1 > p.y0 + 4 && y0 < p.y1 - 4) { hit = true; break; }
            if (hit) continue;
            const key = Math.round(y / 5) + ',' + Math.round(vy / 50) + ',' + Math.min(since, 8);
            if (!next.has(key)) next.set(key, { y, vy, since });
          }
        }
        states = next; frames++; if (states.size === 0) alive = false;
        if (states.size > 40000) { const arr = [...states.entries()]; states = new Map(arr.filter((_, i) => i % 2 === 0)); }
      }
      out.push({ trial, firstSegK: Flow._segs()[0].k, segs: Flow._segs().map(s => s.k + (s.flip ? 'f' : '')).join(','), survived: alive, cam: Math.round(cam), states: states.size });
    }
    return out;
  }, [8, 540]);
  for (const r of res) console.log(JSON.stringify(r));
  await browser.close();
})();

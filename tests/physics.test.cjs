// Física do Nature e da Torre: pontes ligadas (sem "vão" no final), paredões nos penhascos e escadas com animação.
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

  // ---------------- NATURE (EPIs) ----------------
  await ev(async () => { levelId = 'teresopolis'; show('playing'); await beginChallenge('epi'); });
  await page.waitForFunction(() => state === 'nplay'); await page.waitForTimeout(2800);
  const natGo = async (x, key, ms, wi) => {
    await ev(([x, wi]) => { const g = Nature._debug(); const p = wi >= 0 ? Nature._walls()[wi].L : Nature._platforms().filter(q => x >= q.x0 && x <= q.x1).sort((a, b) => a.y - b.y)[0]; g.plat = p; g.x = x; g.y = Nature.platY(p, x); g.vx = g.vy = 0; g.timeLeft = 9999; }, [x, wi === undefined ? -1 : wi]);
    await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key);
    return ev(() => { const g = Nature._debug(); return { x: g.x, y: g.y, on: !!g.plat }; });
  };
  // atravessa a ponte de corda e chega ao penhasco de cima
  let p = await natGo(1100, 'KeyD', 4200);
  r.nat_ponteAteOPenhasco = p.on && p.x > 1560 && Math.abs(p.y - 268) < 3;
  // e volta pela ponte
  p = await natGo(1620, 'KeyA', 1900);

  r.nat_voltaPelaPonte = p.on && p.x < 1230 && Math.abs(p.y - 328) < 4;
  // paredões: encostar no penhasco pelo lado de baixo para (sem cair no vão)
  const natWalls = await ev(() => Nature._walls().map(w => ({ x: w.x, y0: w.y0, dir: w.dir, lx: w.dir === 1 ? w.L.x1 : w.L.x0 })));
  r.nat_temParedoes = natWalls.length >= 1;
  let okWalls = true;
  for (const [wi, w] of natWalls.entries()) {
    const sx = w.lx - w.dir * 40;
    const q = await natGo(sx, w.dir === 1 ? 'KeyD' : 'KeyA', 1300, wi);
    if (!(q.on && Math.abs(q.x - w.x) <= 2)) { okWalls = false; console.log('parede falhou (Nature)', w, q); }
  }
  r.nat_paredoesSegurar = okWalls;
  await ev(() => Nature.stop()); await ev(() => show('playing'));

  // ---------------- TORRE (Climb) ----------------
  await ev(async () => { levelId = 'teresopolis'; show('playing'); await beginChallenge('climb'); });
  await page.waitForFunction(() => state === 'kplay'); await page.waitForTimeout(2000);
  const towGo = async (x, wy, key, ms) => {
    await ev(([x, wy]) => {
      const W = Climb._world(), g = Climb._debug();
      const p = W.ALL.filter(q => x >= q.x0 && x <= q.x1 && Math.abs(Climb.platY(q, x) - wy) < 6).sort((a, b) => a.y - b.y)[0];
      g.plat = p; g.climb = null; g.x = x; g.y = Climb.platY(p, x); g.vx = g.vy = 0; g.takeoffY = g.y; g.lives = 5; g.hurtT = 0; g.invul = 5; g.minY = Math.min(g.minY, g.y);
    }, [x, wy]);
    await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key);
    return ev(() => { const g = Climb._debug(); return { x: g.x, y: g.y, on: !!g.plat, climb: !!g.climb, t: g.climbT, lives: g.lives }; });
  };
  // ponte do mapa 0 (a mesma do Nature)
  p = await towGo(1100, 3408, 'KeyD', 4200);
  r.tor_ponteAteOPenhasco = p.on && p.x > 1560 && Math.abs(p.y - 3348) < 3;
  // todas as escadas: sobe até a plataforma de cima (com animação) e desce até a de baixo
  const ladders = await ev(() => Climb._world().LADDERS.slice(0, 5).map(l => ({ x: l.x, top: l.top, bottom: l.bottom })));
  let okLadders = true, okAnim = true;
  for (const l of ladders) {
    let q = await towGo(l.x - 12, l.bottom, 'KeyD', 60);          // chega perto, depois sobe
    await ev(([x]) => { Climb._debug().x = x; }, [l.x - 12]);
    await page.keyboard.down('KeyW'); await page.waitForTimeout(500);
    const mid = await ev(() => { const g = Climb._debug(); return { climb: !!g.climb, y: g.y, t: g.climbT }; });
    await page.waitForTimeout(((l.bottom - l.top) / 150) * 1000 + 600); await page.keyboard.up('KeyW');
    q = await ev(() => { const g = Climb._debug(); return { y: g.y, on: !!g.plat, climb: !!g.climb, lives: g.lives }; });
    if (!(mid.climb && mid.t > 0.2)) okAnim = false;
    if (!(q.on && !q.climb && Math.abs(q.y - l.top) < 2)) { okLadders = false; console.log('subir falhou', l, mid, q); }
    // descer
    await page.keyboard.down('KeyS'); await page.waitForTimeout(((l.bottom - l.top) / 150) * 1000 + 700); await page.keyboard.up('KeyS');
    q = await ev(() => { const g = Climb._debug(); return { y: g.y, on: !!g.plat, climb: !!g.climb, lives: g.lives }; });
    if (!(q.on && !q.climb && Math.abs(q.y - l.bottom) < 2 && q.lives === 5)) { okLadders = false; console.log('descer falhou', l, q); }
  }
  r.tor_escadasSubirDescer = okLadders;
  r.tor_escadaAnima = okAnim;
  // paredões de todos os mapas da base e de uma cópia do mapa 4
  const walls = await ev(() => { const W = Climb._world(); return W.WALLS.map(w => ({ x: w.x, y0: w.y0, dir: w.dir, ly: Math.round(Climb.platY(w.L, w.dir === 1 ? w.L.x1 : w.L.x0)), lx: w.dir === 1 ? w.L.x1 : w.L.x0 })); });
  r.tor_temParedoes = walls.length >= 10;
  let okT = true, nT = 0;
  for (const w of walls) {
    const sx = w.x - w.dir * 40;
    const inRange = await ev(([sx, ly]) => Climb._world().ALL.some(q => sx >= q.x0 && sx <= q.x1 && Math.abs(Climb.platY(q, sx) - ly) < 6), [sx, w.ly]);
    if (!inRange) continue;                                       // ponta curta demais para testar andando
    nT++;
    const q = await towGo(sx, w.ly, w.dir === 1 ? 'KeyD' : 'KeyA', 1300);
    if (!(q.on && Math.abs(q.x - w.x) <= 2 && q.lives === 5)) { okT = false; console.log('parede falhou (Torre)', w, q); }
  }
  r.tor_paredoesSegurar = okT && nT >= 8;
  console.log('paredões testados na Torre:', nT, 'de', walls.length);
  await browser.close();
  console.log(r);
  for (const [k, v] of Object.entries(r)) assert.ok(v, k);
  assert.deepEqual(errs, []);
  console.log('Física (pontes, paredões, escadas): OK');
})().catch(e => { console.error(e); process.exit(1); });

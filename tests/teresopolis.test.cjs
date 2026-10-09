// Mapa de Teresópolis: só a parte de baixo é andável, as placas ficam alcançáveis e o arco da entrada leva de volta ao lobby.
// Rode com o jogo em http://localhost:8010 (servidor só de arquivos: python -m http.server 8010) (ou passe a URL como argumento).
const { chromium } = require('C:/Users/bs902/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const URL = process.argv[2] || 'http://localhost:8010';
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto(URL); await page.waitForFunction(() => ready);
  await page.waitForFunction(() => ['login', 'menu'].includes(state));
  if (await page.evaluate(() => state === 'login')) await page.click('#acGuest');
  const ev = (f, a) => page.evaluate(f, a);
  const r = {};
  // entra pelo arco do lobby (passando pelo vão lateral), como o jogador faz
  await ev(() => { show('playing'); player.wx = 560; player.wy = 260; });
  await page.keyboard.down('KeyW');
  await page.waitForFunction(() => levelId === 'teresopolis' && state === 'playing', null, { timeout: 20000 });
  await page.keyboard.up('KeyW');
  r.chegaNoInicio = await ev(() => Math.abs(player.wx - 690) < 4 && Math.abs(player.wy - 760) < 4 && !!walkMask && walkMask.w === mapImg.width);
  // andável x bloqueado
  r.andavel = (await ev(() => [[690, 760], [470, 850], [960, 860], [570, 460], [655, 1000], [760, 1000], [690, 560], [160, 700]].map(([x, y]) => canWalk(x, y)))).every(Boolean);
  r.bloqueado = (await ev(() => [[500, 150], [900, 150], [300, 520], [1100, 450], [1200, 700], [100, 980], [1300, 1000], [690, 920], [598, 920], [20, 600]].map(([x, y]) => canWalk(x, y)))).every(v => !v);
  // tudo importante é alcançável a pé (preenchimento a partir do início, passo de 2 px)
  const reach = await ev(() => {
    const w = walkMask.w, h = walkMask.h, step = 2, seen = new Set(), q = [[690, 760]], key = (x, y) => Math.round(x / step) + ',' + Math.round(y / step);
    seen.add(key(690, 760));
    while (q.length) {
      const [x, y] = q.pop();
      for (const [dx, dy] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h || !canWalk(nx, ny) || seen.has(key(nx, ny))) continue;
        seen.add(key(nx, ny)); q.push([nx, ny]);
      }
    }
    const ok = (x, y) => { for (let dx = -step; dx <= step; dx += step) for (let dy = -step; dy <= step; dy += step) if (seen.has(key(x + dx, y + dy))) return true; return false; };
    return { signs: SIGNS.filter(s => s.level === 'teresopolis').map(s => ok(s.x, s.y)), arch: [ok(655, 960), ok(760, 960)], plaza: ok(690, 480), cells: seen.size };
  });
  r.placasAlcancaveis = reach.signs.length === 3 && reach.signs.every(Boolean);
  r.arcoAlcancavel = reach.arch.every(Boolean);
  r.praçaAlcancavel = reach.plaza;
  // Percorre as rotas pelo resolvedor de movimento, incluindo esquinas perto das placas.
  r.rotasSemPrender = await ev(() => {
    const step = 4, start = [690, 760], index = (x, y) => y * walkMask.w + x;
    const parents = new Map([[index(...start), null]]), queue = [start];
    for (let i = 0; i < queue.length; i++) {
      const [x, y] = queue[i];
      for (const [dx, dy] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
        const nx = x + dx, ny = y + dy, key = index(nx, ny);
        if (parents.has(key) || !canWalk(nx, ny) || !canWalk(x + dx / 2, y + dy / 2)) continue;
        parents.set(key, [x, y]); queue.push([nx, ny]);
      }
    }
    for (const [tx, ty] of [[570, 460], [960, 860], [470, 850], [640, 570], [752, 812], [900, 850]]) {
      const end = queue.find(([x, y]) => Math.hypot(x - tx, y - ty) <= 4);
      if (!end) throw new Error('Ponto sem rota: ' + tx + ',' + ty);
      const path = []; let p = end;
      while (p) { path.push(p); p = parents.get(index(...p)); }
      player.wx = start[0]; player.wy = start[1];
      for (const [x, y] of path.reverse()) {
        moveOnMap(x - player.wx, y - player.wy);
        if (Math.hypot(x - player.wx, y - player.wy) > 0.1 || !canWalk(player.wx, player.wy)) throw new Error('Travou indo para ' + x + ',' + y + ' em ' + player.wx + ',' + player.wy);
      }
    }
    return true;
  });
  r.paredeFinaERecuperacao = await ev(() => {
    const saved = { mask: walkMask, image: mapImg, level: levelId, x: player.wx, y: player.wy };
    try {
      levelId = 'praca'; mapImg = { width: 40, height: 30 }; walkMask = { w: 40, h: 30, data: new Uint8Array(1200).fill(1) };
      for (let y = 0; y < 30; y++) walkMask.data[y * 40 + 15] = 0;
      player.wx = 5; player.wy = 10; moveOnMap(25, 0); const solid = player.wx < 15 && canWalk(player.wx, player.wy);
      walkMask.data[10 * 40 + 9] = 0; player.wx = 9.2; player.wy = 10.2; moveOnMap(0, 0);
      return solid && canWalk(player.wx, player.wy) && Math.hypot(player.wx - 9.2, player.wy - 10.2) <= 2;
    } finally { walkMask = saved.mask; mapImg = saved.image; levelId = saved.level; player.wx = saved.x; player.wy = saved.y; }
  });
  // as placas abrem o convite quando o Genésio chega perto
  for (const [x, y, kind] of [[570, 460, 'nature'], [960, 860, 'solar'], [470, 850, 'flow']]) {
    await ev(([x, y]) => { show('playing'); promptBlocked = false; promptSign = null; player.wx = x; player.wy = y + 4; checkOasisSign(); }, [x, y]);
    r['placa:' + kind] = await ev(k => state === 'prompt' && promptKind === k, kind);
    await ev(() => document.getElementById('btnNo').click());
  }
  // arco: o pilar do meio barra; pelos vãos laterais volta ao lobby
  const hold = async (x, y, key, ms) => { await ev(([x, y]) => { show('playing'); promptBlocked = true; player.wx = x; player.wy = y; }, [x, y]); await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); return ev(() => ({ lv: levelId, st: state, y: player.wy })); };
  let p = await hold(700, 780, 'KeyS', 2000);
  r.pilarDoMeioBarra = p.lv === 'teresopolis' && p.st === 'playing' && p.y < 884;
  p = await hold(655, 800, 'KeyS', 3500);
  r.vaoEsquerdo = p.lv === 'praca' || p.st === 'transition';
  await page.waitForFunction(() => state === 'playing' && levelId === 'praca', null, { timeout: 20000 });
  await ev(() => { show('playing'); return goToLevel('teresopolis'); });
  await page.waitForFunction(() => state === 'playing' && levelId === 'teresopolis', null, { timeout: 20000 });
  p = await hold(760, 800, 'KeyS', 3500);
  r.vaoDireito = p.lv === 'praca' || p.st === 'transition';
  await page.waitForFunction(() => state === 'playing' && levelId === 'praca', null, { timeout: 20000 });
  await browser.close();
  console.log(r);
  for (const [k, v] of Object.entries(r)) assert.ok(v, k);
  assert.deepEqual(errs, []);
  console.log('Teresópolis: OK');
})().catch(e => { console.error(e); process.exit(1); });

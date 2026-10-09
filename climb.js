// Nature · Desafio 2: Torre de moedas. Os 5 mapas empilhados e, acima deles, o último mapa se repete sem fim:
// suba o máximo que conseguir, sem tempo. Pegue os G alados (viram GenesisCoins no fim); pulo duplo; quedas altas tiram vidas.
const Climb = (() => {
  const VW = 1280, VH = 720, S = VH / 941, VIEW_H = 941;
  const WALK = 250, RUN = 410, GRAV = 1800, JUMP = 810, JUMP2 = 740;
  const LIVES = 5, FALL_SAFE = 200, FALL_BIG = 600;        // queda líquida (px) a partir da qual tira 1 vida / 2 vidas
  const COIN_RATE = 2, PX_PER_M = 40;
  const REP_PITCH = 770, REP_CONN = [1478, 1604, 130];       // cópias do último mapa: espaçamento e ilha de ligação (x0, x1, y local)
  const T = TOWER;
  const FRAMES = { idle: 1, walk: 13, run: 13, jump: 5, hurt: 4, die: 4, fly: 8, heart: 5, ladder: 6 };
  const SCALE = { idle: 0.78 * 0.577, walk: 0.577, run: 1.05 * 0.577, jump: 1.35 * 0.577, hurt: 1.4 * 0.577, die: 1.4 * 0.577, heart: 0.6, ladder: 0.5 };
  const CLIMB = 150;
  const OASIS = 'fase-nova-igua%C3%A7u/oasis/';
  const el = id => document.getElementById(id);

  let imgs = null, loading = null, g = null, running = false, timer = null;
  let ALL = [], COINS = [], HEARTS = [], copies = [];       // mundo atual
  let LADDERS = [], WALLS = [];                              // escadas (x, top, bottom: y das plataformas de cima e de baixo) e paredões

  function load() {
    if (imgs) return Promise.resolve();
    if (loading) return loading;
    const get = Loader.img;
    imgs = { frames: {}, maps: [], rep: [] };
    const jobs = [
      get(OASIS + 'heart.png').then(i => imgs.heart = i),
      get(OASIS + 'heart_empty.png').then(i => imgs.heartEmpty = i),
    ];
    const slice = (im, sy, h, extra, mirror) => {              // recorte do mapa; a borda de baixo se dissolve sobre o mapa de baixo
      const c = document.createElement('canvas'); c.width = 1672; c.height = h + extra;
      const x = c.getContext('2d');
      if (mirror) { x.translate(1672, 0); x.scale(-1, 1); }
      x.drawImage(im, 0, sy, 1672, h + extra, 0, 0, 1672, h + extra);
      x.setTransform(1, 0, 0, 1, 0, 0);
      if (extra) {
        x.globalCompositeOperation = 'destination-out';
        const gr = x.createLinearGradient(0, h, 0, h + extra);
        gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,1)');
        x.fillStyle = gr; x.fillRect(0, h, 1672, extra);
      }
      return c;
    };
    for (let k = 0; k < 5; k++) jobs.push(get(`fase-teresopolis/nature/m${k}.jpg`).then(im => {
      imgs.maps[k] = slice(im, T.SY[k], T.EY[k] - T.SY[k], k > 0 ? 40 : 0, false);
      if (k === 0) {                                   // ilha pequena do mapa 0 vira "ilha de ligação"
        const s = document.createElement('canvas'); s.width = 96; s.height = 64;
        s.getContext('2d').drawImage(im, 932, 578, 96, 64, 0, 0, 96, 64);
        imgs.island = s;
      }
      if (k === 4) { imgs.rep[0] = slice(im, 60, REP_PITCH, 40, false); imgs.rep[1] = slice(im, 60, REP_PITCH, 40, true); }
    }));
    for (const [name, n] of Object.entries(FRAMES)) {
      imgs.frames[name] = [];
      for (let i = 0; i < n; i++) jobs.push(get(`frames/${name}${i}.png`).then(im => imgs.frames[name][i] = im));
    }
    return loading = Promise.all(jobs).catch(e => { imgs = null; loading = null; throw e; });
  }

  // ---- dados salvos ----
  const COINS_KEY = 'genesio-coins', BEST_KEY = 'genesio-climb-best';
  const getCoins = () => { try { return +localStorage.getItem(COINS_KEY) || 0; } catch (e) { return 0; } };
  const addCoins = n => { try { localStorage.setItem(COINS_KEY, getCoins() + n); } catch (e) {} };
  const getBest = () => { try { return +localStorage.getItem(BEST_KEY) || 0; } catch (e) { return 0; } };
  const setBest = v => { try { localStorage.setItem(BEST_KEY, v); } catch (e) {} };

  // ---- mundo: base (5 mapas) + cópias do último mapa para cima ----
  // escadas do cenário (x = meio da escada; top/bottom = y das plataformas onde ela começa e termina) e do mapa 4, que se repete
  const BASE_LADDERS = [
    { x: 1526, top: 3580, bottom: 3765 },                  // mapa 0 (escada da direita)
    { x: 183, top: 2686, bottom: 2810 }, { x: 301, top: 2972, bottom: 3100 },   // mapa 1
    { x: 155, top: 296, bottom: 478 }, { x: 1440, top: 415, bottom: 572 },      // mapa 4
  ];
  const M4_LADDERS = [{ x: 155, top: 296, bottom: 478 }, { x: 1440, top: 415, bottom: 572 }];
  // ponte de corda do mapa 0: o chão dela sobe até o penhasco (antes era reto e o Genésio caía na ponta)
  const BRIDGE0 = [[1230, 3409], [1400, 3411], [1440, 3406], [1480, 3392], [1520, 3376], [1530, 3374]];
  // plataformas inclinadas (pontes de corda): pts = [[x, y], ...] com o chão de verdade da ponte
  const platY = (p, x) => {
    const q = p.pts; if (!q) return p.y;
    if (x <= q[0][0]) return q[0][1];
    for (let i = 1; i < q.length; i++) if (x <= q[i][0]) return q[i - 1][1] + (q[i][1] - q[i - 1][1]) * (x - q[i - 1][0]) / (q[i][0] - q[i - 1][0]);
    return q[q.length - 1][1];
  };
  const rng = seed => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  let startPlat = null;
  function buildBase() {
    ALL = T.PLATFORMS.map(p => ({ x0: p[0], x1: p[1], y: p[2], solid: p[2] >= T.START[1] - 1 }));
    const br = ALL.find(p => p.x0 === 1230 && p.x1 === 1530 && p.y === 3400); if (br) { br.pts = BRIDGE0; br.y = 3411; }
    LADDERS = BASE_LADDERS.map(l => ({ ...l }));
    for (const e of T.EXTRA) ALL.push({ x0: e[0], x1: e[1], y: e[2], solid: false, island: true });
    COINS = T.COINS.map(c => ({ x: c[0], y: c[1], got: false }));
    HEARTS = T.HEARTS.map(c => ({ x: c[0], y: c[1], got: false }));
    copies = [];
    WALLS = buildWalls(ALL);
    startPlat = ALL.find(p => p.y === T.START[1] && p.x0 === 0);
  }
  // k-ésima cópia do último mapa (k >= 1), por cima do mapa anterior; mesma orientação para o caminho de subida ficar alinhado
  function addCopy() {
    const k = copies.length + 1, top = -REP_PITCH * k, mir = false, r = rng(k * 977);   // sem espelhar: as ilhas de ligação ficam sempre alinhadas
    const mx = (a, b) => mir ? [1672 - b, 1672 - a] : [a, b];
    const ly = y => top + y - 60;
    const added = [];
    for (const p of T.M4) { const [a, b] = mx(p[0], p[1]); const q = { x0: a, x1: b, y: ly(p[2]), solid: false }; ALL.push(q); added.push(q); }
    WALLS.push(...buildWalls(added));
    // ilha que liga a plataforma mais alta do mapa de baixo ao chão desta cópia
    const [ca, cb] = mx(REP_CONN[0], REP_CONN[1]);
    ALL.push({ x0: ca, x1: cb, y: top + REP_PITCH + REP_CONN[2] - 60 + 10, solid: false, island: true });
    const cand = T.M4.filter(p => p[1] - p[0] >= 100 && p[2] < 700);
    for (let i = 0; i < 4; i++) {
      const p = cand[Math.floor(r() * cand.length)], [a, b] = mx(p[0], p[1]);
      COINS.push({ x: Math.round(a + (b - a) * (0.3 + r() * 0.4)), y: ly(p[2]) - 58, got: false });
    }
    if (k % 2 === 0) { const p = cand[Math.floor(r() * cand.length)], [a, b] = mx(p[0], p[1]); HEARTS.push({ x: Math.round((a + b) / 2), y: ly(p[2]) - 58, got: false }); }
    for (const l of M4_LADDERS) LADDERS.push({ x: mx(l.x, l.x)[0], top: ly(l.top), bottom: ly(l.bottom) });
    copies.push({ top, mir });
  }
  const ensureWorld = upTo => { while (copies.length === 0 || -REP_PITCH * copies.length > upTo - 1400) addCopy(); };

  // ---- partida ----
  function newGame() {
    buildBase();
    g = {
      x: T.START[0], y: T.START[1], vx: 0, vy: 0, plat: startPlat, facing: 1, animT: 0, climb: null, climbT: 0, jumpHeld: true, jumps: 0, takeoffY: T.START[1],
      drop: null, dropT: 0, lives: LIVES, hurtT: 0, invul: 0, dying: false, deadT: 0, phase: 'ready', readyT: 0,
      minY: T.START[1], cam: T.START[1] - 600, nCoins: 0, popups: [], puffs: [], fx: null, paused: false,
    };
    ensureWorld(g.y - 3000);
    hideOverlay();
  }
  async function start() { await load(); newGame(); running = true; }
  function stop() { running = false; clearInterval(timer); hideOverlay(); unload(); }
  // libera as imagens da fase ao sair (no celular várias fases abertas em sequência estouravam a memória)
  function unload() { imgs = null; loading = null; }
  const meters = () => Math.max(0, Math.floor((T.START[1] - g.minY) / PX_PER_M));

  // ---- telas ----
  function hideOverlay() { clearInterval(timer); el('kOverlay').classList.remove('active'); }
  function showOverlay(kind) {
    el('kSettings').hidden = kind !== 'pause';
    const m = meters();
    el('kTitle').textContent = kind === 'pause' ? 'Pausado' : 'Fim da subida';
    el('kConvert').style.display = kind === 'pause' ? 'none' : 'flex';
    el('kPrimary').textContent = kind === 'pause' ? 'Continuar' : 'Subir de novo';
    el('kPrimary').dataset.kind = kind;
    el('kEnd').style.display = kind === 'pause' ? '' : 'none';
    el('kBonus').textContent = '';
    if (kind === 'pause') {
      el('kInfo').innerHTML = `Altura: <b>${m} m</b> · Recorde: <b>${Math.max(getBest(), m)} m</b><br>G alados: <b>${g.nCoins}</b>`;
    } else {
      el('kInfo').innerHTML = `Altura: <b>${m} m</b> · Recorde: <b>${getBest()} m</b>${g.newRecord ? ' 🏆 novo!' : ''}`;
      const total = g.nCoins * COIN_RATE;
      el('kN').textContent = g.nCoins; el('kG').textContent = 0;
      el('kBonus').textContent = `${g.nCoins} × ${COIN_RATE} GenesisCoins`;
      let shown = 0;
      clearInterval(timer);
      timer = setInterval(() => {                  // contagem das moedas virando GenesisCoins
        shown = Math.min(total, shown + Math.max(1, Math.ceil(total / 40)));
        el('kG').textContent = shown;
        if (shown >= total) clearInterval(timer);
      }, 40);
    }
    el('kOverlay').classList.add('active');
  }
  function togglePause() {
    if (!running || g.phase === 'end') return;
    g.paused = !g.paused;
    g.paused ? showOverlay('pause') : hideOverlay();
  }
  function primary() {
    if (el('kPrimary').dataset.kind === 'pause') { g.paused = false; hideOverlay(); } else newGame();
  }
  function finish() {
    if (g.phase === 'end') return;
    g.phase = 'end';
    const m = meters();
    g.newRecord = m > getBest();
    if (g.newRecord) setBest(m);
    addCoins(g.nCoins * COIN_RATE);
    g.paused = false;
    showOverlay('over');
  }
  function endNow() { if (running && g.phase !== 'end') { g.paused = false; finish(); } }

  // ---- física ----
  // Paredões automáticos: quando uma plataforma (ponte, ilha, chão) termina colada num penhasco bem mais alto, o miolo do penhasco é
  // sólido; sem isso o Genésio entrava nele e caía num "vão". Só bloqueia abaixo do topo do penhasco (por cima dele dá para passar).
  function buildWalls(list) {
    const w = [];
    for (const L of list) for (const H of list) {
      if (L === H) continue;
      for (const [lx, hx] of [[L.x1, H.x0], [L.x0, H.x1]]) {
        if (Math.abs(lx - hx) > 8) continue;
        const ly = platY(L, lx), hy = platY(H, hx);
        if (ly - hy > 34 && ly - hy <= 170) w.push({ x: lx + (lx === L.x1 ? 2 : -2), y0: hy + 4, y1: ly + 40, L, H, dir: lx === L.x1 ? 1 : -1 });
      }
    }
    return w;
  }
  function wallPush(px) {                                  // aplica os paredões ao movimento horizontal deste quadro
    for (const w of WALLS) {
      if (g.y <= w.y0 || g.y > w.y1) continue;
      if (px <= w.x && g.x > w.x) g.x = w.x;
      else if (px >= w.x && g.x < w.x) g.x = w.x;
    }
  }
  const inRange = (p, x) => x >= p.x0 - 3 && x <= p.x1 + 3;
  function landing(x, prevY, y) {
    let best = null, by = 0;
    for (const p of ALL) {
      if (p === g.drop) continue;
      const py = platY(p, x);
      if (inRange(p, x) && prevY <= py + 2 && y >= py && (!best || py < by)) { best = p; by = py; }
    }
    return best;
  }
  const popup = (text, x, y, color) => g.popups.push({ text, x, y, t: 0, color: color || '#fff3b0' });

  function damage(n) {
    if (g.invul > 0 || g.dying) return;
    g.lives -= n; Sound.hit();
    popup('-' + n + (n > 1 ? ' vidas' : ' vida'), g.x, g.y - 130, '#ff9a8a');
    if (g.lives <= 0) { g.lives = 0; g.dying = true; g.deadT = 0; g.vx = 0; Sound.die(); }
    else { g.hurtT = 0.6; g.invul = 1.6; g.vx = 0; }
  }
  function leavePlatform(jumped) { g.plat = null; g.takeoffY = g.y; g.jumps = jumped ? 1 : 1; }

  function update(dt) {
    if (!running || g.paused) return;
    g.animT += dt;
    for (const p of g.popups) p.t += dt;
    g.popups = g.popups.filter(p => p.t < 1.2);
    for (const p of g.puffs) p.t += dt;
    g.puffs = g.puffs.filter(p => p.t < 0.4);
    if (g.phase === 'end') return;
    if (g.phase === 'ready') { g.readyT += dt; if (g.readyT >= 1.6) g.phase = 'play'; return; }
    if (g.hurtT > 0) g.hurtT -= dt;
    if (g.invul > 0) g.invul -= dt;
    if (g.dying) { g.deadT += dt; if (g.deadT > 1.4) finish(); return; }

    // animação de pegar coração: o tempo "para" por um instante e a vida volta no fim
    if (g.fx) {
      g.fx.t += dt;
      if (g.fx.t >= g.fx.dur) { g.lives = Math.min(LIVES, g.lives + 1); g.invul = Math.max(g.invul, 0.8); g.fx = null; }
      return;
    }

    const left = keys.KeyA || keys.ArrowLeft, right = keys.KeyD || keys.ArrowRight;
    const down = keys.KeyS || keys.ArrowDown;
    const ax = g.hurtT > 0 ? 0 : (right ? 1 : 0) - (left ? 1 : 0);
    const jump = !!keys.Space && g.hurtT <= 0;
    const edge = jump && !g.jumpHeld;                      // aperto novo da tecla de pulo
    g.jumpHeld = jump;
    const speed = (keys.ShiftLeft || keys.ShiftRight) ? RUN : WALK;
    if (ax) g.facing = ax;
    if (g.dropT > 0) { g.dropT -= dt; if (g.dropT <= 0) g.drop = null; }

    const up = keys.KeyW || keys.ArrowUp;
    if (!down) g.noDrop = false;
    if (g.climb) {                                         // subindo / descendo a escada
      const L = g.climb;
      g.vx = 0;
      if (edge) { g.climb = null; g.vy = -520; g.vx = ax * 160; leavePlatform(true); Sound.jump(); }
      else if (ax && !up && !down) { g.climb = null; g.vy = 0; leavePlatform(false); }
      else {
        const dy = (down ? 1 : 0) - (up ? 1 : 0);
        g.y += dy * CLIMB * dt;
        if (dy) g.climbT += dt;
        if (g.y <= L.top || g.y >= L.bottom) {             // chegou numa ponta: fica em pé na plataforma
          const yEnd = g.y <= L.top ? L.top : L.bottom;
          g.y = yEnd; g.climb = null; g.noDrop = true;           // não fura a plataforma se continuar apertando para baixo
          g.plat = ALL.find(p => p.y === yEnd && inRange(p, g.x)) || null;
          if (g.plat) { g.takeoffY = g.y; g.jumps = 0; g.vy = 0; } else leavePlatform(false);
        }
      }
    } else {
      // entrar na escada (perto dela, apertando para cima / para baixo)
      const L = LADDERS.find(l => Math.abs(g.x - l.x) < 26 && ((up && g.y > l.top + 2 && g.y <= l.bottom + 4) || (down && g.y >= l.top - 4 && g.y < l.bottom - 2)));
      if (L && g.hurtT <= 0) { g.climb = L; g.x = L.x; g.plat = null; g.vy = 0; g.vx = 0; g.takeoffY = g.y; g.jumps = 0; g.climbT = 0; }
    }
    if (g.climb) {                                          // na escada: só olha os coletáveis e a câmera
      collect(dt); return;
    }
    g.vx = ax * speed;
    const px = g.x;
    g.x = Math.min(1650, Math.max(22, g.x + g.vx * dt));
    wallPush(px);
    if (edge && g.plat) { g.vy = -JUMP; leavePlatform(true); g.jumps = 1; Sound.jump(); }
    else if (edge && !g.plat && g.jumps > 0) {            // pulo duplo
      g.vy = -JUMP2; g.jumps--; Sound.jump(); g.puffs.push({ x: g.x, y: g.y, t: 0 });
    } else if (down && g.plat && !g.plat.solid && !g.noDrop) { g.drop = g.plat; g.dropT = 0.3; g.y += 3; leavePlatform(false); }
    if (g.plat) {
      if (!inRange(g.plat, g.x)) leavePlatform(false);
      else for (const p of ALL) { const py = platY(p, g.x); if (p !== g.plat && inRange(p, g.x) && py < g.y && py >= g.y - 34) { g.plat = p; g.y = py; break; } }
    }
    if (g.plat) { g.vy = 0; g.y = platY(g.plat, g.x); }
    else {
      const prevY = g.y;
      g.vy += GRAV * dt; g.y += g.vy * dt;
      if (g.vy >= 0) {
        const p = landing(g.x, prevY, g.y);
        if (p) {
          const py = platY(p, g.x), drop = py - g.takeoffY;   // queda líquida: quanto ele ficou abaixo de onde saiu
          g.plat = p; g.y = py;
          if (g.vy > 300) Sound.land();
          g.vy = 0; g.takeoffY = py; g.jumps = 0;
          if (drop > FALL_BIG) damage(2); else if (drop > FALL_SAFE) damage(1);
        }
      }
      if (g.y > T.WORLD_H + 200) { g.x = T.START[0]; g.y = T.START[1]; g.plat = startPlat; g.vy = 0; g.takeoffY = g.y; }
    }

    collect(dt);
  }
  // altura máxima, coletáveis e câmera (a cada quadro, no chão, no ar ou na escada)
  function collect(dt) {
    if (g.y < g.minY) g.minY = g.y;
    ensureWorld(g.y - 3000);
    for (const c of COINS) {
      if (c.got) continue;
      if (Math.hypot(g.x - c.x, (g.y - 46) - c.y) < 44) { c.got = true; g.nCoins++; Sound.coin(); popup('+1', c.x, c.y - 30); }
    }
    for (const h of HEARTS) {
      if (h.got || g.lives >= LIVES) continue;
      if (Math.hypot(g.x - h.x, (g.y - 46) - h.y) < 46) {
        h.got = true; Sound.power(); popup('+1 vida', g.x, g.y - 150, '#ffb0b8');
        g.fx = { kind: 'heart', t: 0, dur: 1.1 }; g.vy = 0;
      }
    }
    const target = Math.min(T.WORLD_H - VIEW_H, g.y - VIEW_H * 0.58);      // sem limite para cima: a torre continua
    g.cam += (target - g.cam) * Math.min(1, dt * 6);
  }

  // ---- desenho ----
  const sy = y => (y - g.cam) * S;
  function outlined(ctx, text, x, y, fill, w) {
    ctx.lineWidth = w || 6; ctx.strokeStyle = '#08150f'; ctx.fillStyle = fill || '#fff';
    ctx.strokeText(text, x, y); ctx.fillText(text, x, y);
  }
  function frame() {
    if (g.dying) return ['die', Math.min(3, Math.floor(g.deadT / 0.35))];
    if (g.fx) return ['heart', Math.min(4, Math.floor(g.fx.t / g.fx.dur * 5))];
    if (g.hurtT > 0) return ['hurt', Math.min(3, Math.floor((0.6 - g.hurtT) / 0.15))];     // cai e se levanta
    if (g.climb) return ['ladder', Math.floor(g.climbT * 9) % 6];
    if (!g.plat) return ['jump', g.vy < -350 ? 1 : g.vy < 150 ? 2 : 3];
    if (Math.abs(g.vx) > 1) return (keys.ShiftLeft || keys.ShiftRight) ? ['run', Math.floor(g.animT * 17) % 13] : ['walk', Math.floor(g.animT * 11) % 13];
    return ['idle', 0];
  }

  function draw(ctx) {
    if (!running) return;
    ctx.fillStyle = '#6fb6e6'; ctx.fillRect(0, 0, VW, VH);
    for (let k = 0; k < 5; k++) {                         // mapas de baixo para cima
      const c = imgs.maps[k], y0 = sy(T.TOPS[k]), h = c.height * S;
      if (y0 > VH || y0 + h < 0) continue;
      ctx.drawImage(c, 0, y0, VW, h + 1);
    }
    for (const cp of copies) {                            // cópias do último mapa, cada vez mais alto
      const c = imgs.rep[cp.mir ? 1 : 0], y0 = sy(cp.top), h = c.height * S;
      if (y0 > VH || y0 + h < 0) continue;
      ctx.drawImage(c, 0, y0, VW, h + 1);
    }
    for (const e of ALL) {                                // ilhas de ligação
      if (!e.island) continue;
      const w = (e.x1 - e.x0) * S, h = w * imgs.island.height / imgs.island.width, y = sy(e.y) - 20 * S;
      if (y > VH || y + h < 0) continue;
      ctx.drawImage(imgs.island, e.x0 * S, y, w, h);
    }
    // moedas (G alado) e corações
    for (const c of COINS) {
      if (c.got) continue;
      const y = sy(c.y + Math.sin(g.animT * 4 + c.x) * 5);
      if (y < -60 || y > VH + 60) continue;
      const fr = imgs.frames.fly[Math.floor(g.animT * 12 + c.x / 40) % 8], k = 0.34, cx = c.x * S;
      const gl = ctx.createRadialGradient(cx, y, 3, cx, y, 34);
      gl.addColorStop(0, 'rgba(120,255,255,.5)'); gl.addColorStop(1, 'rgba(120,255,255,0)');
      ctx.fillStyle = gl; ctx.fillRect(cx - 36, y - 36, 72, 72);
      ctx.drawImage(fr, cx - fr.width * k / 2, y - fr.height * k / 2, fr.width * k, fr.height * k);
    }
    for (const h of HEARTS) {
      if (h.got) continue;
      const y = sy(h.y + Math.sin(g.animT * 4 + h.x) * 5), cx = h.x * S;
      if (y < -60 || y > VH + 60) continue;
      const gl = ctx.createRadialGradient(cx, y, 3, cx, y, 40);
      gl.addColorStop(0, 'rgba(255,90,110,.6)'); gl.addColorStop(1, 'rgba(255,90,110,0)');
      ctx.fillStyle = gl; ctx.fillRect(cx - 42, y - 42, 84, 84);
      ctx.drawImage(imgs.heart, cx - 20, y - 19, 40, 40 * imgs.heart.height / imgs.heart.width);
    }

    // anel do pulo duplo
    for (const p of g.puffs) {
      ctx.strokeStyle = `rgba(255,255,255,${0.8 * (1 - p.t / 0.4)})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(p.x * S, sy(p.y), (14 + p.t * 90) * 1, (4 + p.t * 22) * 1, 0, 0, Math.PI * 2); ctx.stroke();
    }

    // Genésio
    const blink = g.invul > 0 && g.hurtT <= 0 && !g.dying && !g.fx && Math.floor(g.invul * 12) % 2 === 0;
    if (!blink) {
      const [anim, i] = frame();
      const im = imgs.frames[anim][i], sc = SCALE[anim], w = im.width * sc, h = im.height * sc;
      const fx = g.x * S, fy = sy(g.y);
      if (g.fx) {                                         // brilho rosado enquanto pega o coração
        const gl = ctx.createRadialGradient(fx, fy - 50, 8, fx, fy - 50, 110), a = 0.35 + 0.25 * Math.sin(g.fx.t * 14);
        gl.addColorStop(0, `rgba(255,110,130,${a})`); gl.addColorStop(1, 'rgba(255,110,130,0)');
        ctx.fillStyle = gl; ctx.fillRect(fx - 120, fy - 170, 240, 240);
      }
      if (g.plat) { ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(fx, fy - 1, 24, 6, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.save();
      if (g.facing < 0 && !g.climb) { ctx.translate(fx, 0); ctx.scale(-1, 1); ctx.translate(-fx, 0); }
      ctx.drawImage(im, fx - w / 2, fy - h, w, h);
      ctx.restore();
    }

    // textos flutuantes
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = "700 22px 'Fredoka', sans-serif";
    for (const p of g.popups) {
      ctx.globalAlpha = Math.max(0, 1 - p.t / 1.2);
      outlined(ctx, p.text, Math.min(VW - 80, Math.max(80, p.x * S)), sy(p.y) - p.t * 40, p.color, 5);
    }
    ctx.globalAlpha = 1;

    // HUD
    for (let i = 0; i < LIVES; i++) {
      const im = i < g.lives ? imgs.heart : imgs.heartEmpty;
      ctx.drawImage(im, 84 + i * 38, 20, 34, 34 * im.height / im.width);
    }
    ctx.textAlign = 'center'; ctx.font = "700 38px 'Fredoka', sans-serif";
    outlined(ctx, `⬆ ${meters()} m`, VW / 2, 40, '#fff', 7);
    ctx.font = "700 17px 'Fredoka', sans-serif";
    outlined(ctx, `Recorde ${Math.max(getBest(), meters())} m`, VW / 2, 70, '#d9ffb0', 4);
    ctx.textAlign = 'right';
    const fr0 = imgs.frames.fly[Math.floor(g.animT * 12) % 8], k0 = 0.24;
    ctx.drawImage(fr0, VW - 150 - fr0.width * k0, 16, fr0.width * k0, fr0.height * k0);
    ctx.font = "700 32px 'Fredoka', sans-serif";
    outlined(ctx, `× ${g.nCoins}`, VW - 24, 38, '#9ff3ff', 6);
    ctx.font = "700 16px 'Fredoka', sans-serif";
    outlined(ctx, `🪙 ${getCoins()}`, VW - 24, 70, '#fff3b0', 4);

    if (g.phase === 'ready') {
      ctx.textAlign = 'center'; ctx.font = "700 60px 'Fredoka', sans-serif";
      outlined(ctx, 'Suba o máximo que puder!', VW / 2, 200, '#fff3b0', 9);
      ctx.font = "700 22px 'Fredoka', sans-serif";
      outlined(ctx, 'Espaço duas vezes = pulo duplo · pegue os G alados · cuidado com quedas altas', VW / 2, 250, '#fff', 5);
    }
  }

  return {
    load, start, stop, update, draw, togglePause, primary, endNow, best: getBest, coins: getCoins,
    isRunning: () => running, restart: newGame, _debug: () => g, _world: () => ({ ALL, COINS, HEARTS, copies, WALLS, LADDERS }), platY,
  };
})();

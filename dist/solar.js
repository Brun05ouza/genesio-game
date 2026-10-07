// Fase "Solar do Bosque": plataforma lateral (estilo Mario) com martelo, mobs e boss final (Golem Demolidor).
// A/D mover · Shift esquivar · Espaço pular · J/clique: golpe · C: toque direto / segure, mire e solte
const Solar = (() => {
  const VW = 1280, VH = 720, S = VH / 941, IMGW = 1672, OV = 100, PITCH = IMGW - OV, NIMG = 5;
  const WORLD_W = (NIMG - 1) * PITCH + IMGW, VIEW_W = IMGW;
  const GY = SOLAR_DATA.GROUND;                                   // linha do chão (pés), igual em todos os cenários
  const GRAV = 2500, JUMP = 1060, WALK = 360;
  const DODGE_TIME = .32, DODGE_COOLDOWN = .85, DODGE_GRACE = .14;   // imune durante o dash e mais um instante depois dele
  const CHARGE_DELAY = .22, CHARGE_FULL = 1.1;
  const MAXHP = 5, BOSS_HP = 40, GS = 1.15, BS = 2.0, REWARD = 150, COIN_VALUE = 2;
  const ARENA_X = (NIMG - 1) * PITCH, ARENA_TRIGGER = ARENA_X + 300, CAM_ARENA = WORLD_W - VIEW_W;
  const M = { hm: { w: 230, h: 166, ax: 101, ay: 154 }, hh: { w: 182, h: 127, ax: 95, ay: 124 }, gb: { w: 445, h: 297, ax: 170, ay: 240 } };
  M.run = { ax: 95, ay: 154 };
  M.motion = { ax: 115, ay: 198 };
  const el = id => document.getElementById(id);
  const isTouch = () => document.body.classList.contains('touch');
  const OASIS = 'fase-nova-igua%C3%A7u/oasis/', DIR = 'fase-solar-do-bosque/';

  let imgs = null, loading = null, g = null, running = false, debug = false;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function load() {
    if (loading) return loading;
    if (imgs) return Promise.resolve();
    const get = Loader.img;
    imgs = { hm: [], hh: [], gb: [], fly: [], bg: [], run: [], motion: [], part: {} };
    const jobs = [
      get(OASIS + 'heart.webp').then(i => imgs.heart = i), get(OASIS + 'heart_empty.webp').then(i => imgs.heartEmpty = i),
      get(DIR + 'sprites/fly.webp').then(i => imgs.mobFly = i), get(DIR + 'sprites/rock.webp').then(i => imgs.mobRock = i),
      get(OASIS + 'hammer.webp').then(i => imgs.hammer = i), get(DIR + 'sprites/nail.webp').then(i => imgs.nail = i), get(DIR + 'sprites/nail-box.webp').then(i => imgs.nailBox = i),
      ...['fly_body', 'fly_wingL', 'fly_wingR', 'fly_clawL', 'fly_clawR', 'rock_body', 'rock_armL', 'rock_armR', 'rock_legL', 'rock_legR']
        .map(n => get(DIR + 'sprites/' + n + '.webp').then(i => imgs.part[n] = i)),
      get(DIR + 'genesio-movement-sheet.webp').then(i => imgs.movementSheet = i),
    ];
    for (let i = 0; i < 20; i++) {
      jobs.push(get(`${DIR}sprites/hm${i}.webp`).then(im => imgs.hm[i] = im));
      jobs.push(get(`${DIR}sprites/hh${i}.webp`).then(im => imgs.hh[i] = im));
      jobs.push(get(`${DIR}sprites/gb${i}.webp`).then(im => imgs.gb[i] = im));
    }
    for (let i = 0; i < 8; i++) jobs.push(get(`frames/fly${i}.webp`).then(im => imgs.fly[i] = im));
    for (let i = 0; i < 4; i++) jobs.push(get(`frames/run${i}.webp`).then(im => {
      // Retira margens transparentes e ancora cada passada na mesma linha de pés.
      const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
      const x = c.getContext('2d'); x.drawImage(im, 0, 0);
      const pixels = x.getImageData(0, 0, c.width, c.height).data;
      let x0 = im.width, y0 = im.height, x1 = 0, y1 = 0;
      for (let y = 0; y < im.height; y++) for (let xx = 0; xx < im.width; xx++) {
        if (pixels[(y * im.width + xx) * 4 + 3] > 100) { x0 = Math.min(x0, xx); x1 = Math.max(x1, xx); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      }
      const h = y1 - y0 + 1, w = x1 - x0 + 1, scale = 138 / h;
      c.width = 190; c.height = 166;
      x.drawImage(im, x0, y0, w, h, 95 - w * scale / 2, 16, w * scale, 138);
      imgs.run[i] = c;
    }));
    for (let k = 0; k < NIMG; k++) jobs.push(get(`${DIR}bg${k}.webp`).then(im => {
      // cada imagem (menos a primeira) tem a borda esquerda dissolvendo sobre a anterior
      const c = document.createElement('canvas'); c.width = IMGW; c.height = 941; const x = c.getContext('2d');
      x.drawImage(im, 0, 0);
      if (k > 0) {
        x.globalCompositeOperation = 'destination-out';
        const gr = x.createLinearGradient(0, 0, OV, 0); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = gr; x.fillRect(0, 0, OV, 941);
      }
      imgs.bg[k] = c;
    }));
    return loading = Promise.all(jobs).then(() => buildMovementFrames(imgs.movementSheet))
      .catch(e => { imgs = null; loading = null; throw e; });
  }

  function buildMovementFrames(sheet) {
    // Folha fornecida: 1448 x 1086, quatro colunas e três linhas.
    // Corrida 0–3; esquiva 4–7; preparação, subida, ápice e pouso 8–11.
    const rows = [3, 363, 716, 1083], columns = [4, 362, 724, 1085, 1444];
    for (let frame = 0; frame < 12; frame++) {
      const row = Math.floor(frame / 4), col = frame % 4;
      const x0 = Math.round(columns[col] * sheet.width / 1448) + 3;
      const y0 = Math.round(rows[row] * sheet.height / 1086) + 3;
      const w = Math.round(columns[col + 1] * sheet.width / 1448) - x0 - 3;
      const h = Math.round(rows[row + 1] * sheet.height / 1086) - y0 - 3;
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const ctx = c.getContext('2d'); ctx.drawImage(sheet, x0, y0, w, h, 0, 0, w, h);
      const pixels = ctx.getImageData(0, 0, w, h), data = pixels.data;
      const candidate = new Uint8Array(w * h), visited = new Uint8Array(w * h);
      for (let i = 0; i < candidate.length; i++) {
        const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
        candidate[i] = Math.max(r, g, b) < 135 || Math.max(r, g, b) - Math.min(r, g, b) > 38 ? 1 : 0;
      }
      const neighbors = i => [i % w ? i - 1 : -1, i % w < w - 1 ? i + 1 : -1, i >= w ? i - w : -1, i < w * (h - 1) ? i + w : -1];
      let largest = [];
      for (let i = 0; i < candidate.length; i++) {
        if (!candidate[i] || visited[i]) continue;
        const group = [i]; visited[i] = 1;
        for (let j = 0; j < group.length; j++) for (const n of neighbors(group[j])) {
          if (n >= 0 && candidate[n] && !visited[n]) { visited[n] = 1; group.push(n); }
        }
        if (group.length > largest.length) largest = group;
      }
      if (largest.length < 1000) throw new Error('Quadro de movimento inválido: ' + frame);
      const keep = new Uint8Array(w * h); for (const i of largest) keep[i] = 1;
      // Preserva o rosto branco e o metal cercados pelo contorno do personagem.
      const outside = new Uint8Array(w * h), queue = [];
      const push = i => { if (!keep[i] && !outside[i]) { outside[i] = 1; queue.push(i); } };
      for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
      for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
      for (let j = 0; j < queue.length; j++) for (const n of neighbors(queue[j])) if (n >= 0) push(n);
      let feet = 0, top = h; const green = [];
      for (let i = 0; i < keep.length; i++) {
        data[i * 4 + 3] = outside[i] ? 0 : 255;
        if (!outside[i] && data[i * 4 + 1] > data[i * 4] + 35 && data[i * 4 + 1] > data[i * 4 + 2] + 15) {
          const y = Math.floor(i / w); feet = Math.max(feet, y); top = Math.min(top, y); green.push([i % w, y]);
        }
      }
      ctx.putImageData(pixels, 0, 0);
      const torso = green.filter(p => p[1] < top + (feet - top) * .65);
      const center = torso.reduce((sum, p) => sum + p[0], 0) / torso.length;
      const out = document.createElement('canvas'); out.width = 230; out.height = 210;
      const scale = .55 * 1448 / sheet.width;
      out.getContext('2d').drawImage(c, 115 - center * scale, 198 - feet * scale, w * scale, h * scale);
      imgs.motion[frame] = out;
    }
  }
  // ---- dados salvos ----
  const COINS_KEY = 'genesio-coins';
  const getCoins = () => { try { return +localStorage.getItem(COINS_KEY) || 0; } catch (e) { return 0; } };
  const addCoins = n => { try { localStorage.setItem(COINS_KEY, getCoins() + n); } catch (e) {} };
  const cleared = () => { try { return localStorage.getItem('genesio-solar-cleared') === '1'; } catch (e) { return false; } };
  const markCleared = () => { try { localStorage.setItem('genesio-solar-cleared', '1'); } catch (e) {} };

  // ---- mundo ----
  const rng = seed => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const PLATS = [{ x0: 0, x1: WORLD_W, y: GY, solid: true }];
  const LOCALP = [];     // plataformas por cenário (mundo)
  SOLAR_DATA.PLATS.forEach((list, k) => {
    LOCALP[k] = [];
    for (const [a, b, y] of list) {
      const x0 = k * PITCH + (k > 0 ? Math.max(a, OV + 10) : a), x1 = k * PITCH + (k < NIMG - 1 ? Math.min(b, PITCH - 10) : b);
      if (x1 - x0 < 40) { LOCALP[k].push(null); continue; }
      const p = { x0, x1, y, solid: false }; PLATS.push(p); LOCALP[k].push(p);
    }
  });
  const inRange = (p, x) => x >= p.x0 - 6 && x <= p.x1 + 6;

  function buildMobs() {
    const mobs = [], r = rng(77);
    const rock = (x, plat) => mobs.push({ type: 'rock', x, y: plat.y, plat, hp: 2, dir: r() < .5 ? -1 : 1, vx: 0, t: r() * 5, stun: 0, flash: 0, dead: false, mode: 'patrol', stride: r() * 6, lunge: 0, windT: 0, cdAtk: 1 + r() * 2, hitT: 0, squash: 0, spawnT: 0 });
    const fly = (x, y) => mobs.push({ type: 'fly', x, y, hx: x, hy: y, hp: 1, st: 'hover', t: r() * 6, cd: 1 + r() * 2, tx: 0, ty: 0, flash: 0, dead: false, dive: 0, wind: 0, vx: 0, vy: 0, bank: 0, hitT: 0 });
    const groundX = [[900, 1300], [450, 850, 1250], [500, 900, 1300], [350, 650, 950, 1300]];
    const platRocks = [[2], [1, 6, 9], [1, 4, 8], [3, 6, 9, 12]];
    const flyers = [[[700, 600], [1200, 520]], [[650, 560], [1100, 500], [1450, 600]], [[600, 520], [950, 600], [1350, 480]], [[500, 500], [900, 560], [1200, 480], [1450, 540]]];
    for (let k = 0; k < 4; k++) {
      for (const lx of groundX[k]) rock(k * PITCH + lx, PLATS[0]);
      for (const i of platRocks[k]) { const p = LOCALP[k][i]; if (p) rock((p.x0 + p.x1) / 2, p); }
      for (const [lx, ly] of flyers[k]) fly(k * PITCH + lx, ly);
    }
    return mobs;
  }
  function buildHelmets() {
    // um perto do começo (cenário 1), outro no 3 e outro no 4, sempre numa plataforma. Só dá para carregar um por vez.
    return [[0, 3], [2, 8], [3, 7]].map(([k, i]) => { const pl = LOCALP[k][i]; return pl ? { x: (pl.x0 + pl.x1) / 2, y: pl.y - 64, got: false } : null; }).filter(Boolean);
  }
  function buildHearts() {
    return [[1, 900, 570], [2, 880, 487], [3, 800, 432]].map(([k, x, y]) => ({ x: k * PITCH + x, y, got: false }));
  }

  // ---- partida ----
  function newGame(fromCheckpoint) {
    const arena = !!(g && g.arenaReached) && fromCheckpoint;
    g = {
      x: arena ? ARENA_X + 330 : 150, y: GY, vx: 0, vy: 0, face: 1, plat: PLATS[0], coyote: 0, jbuf: 0, jhold: false, drop: null, dropT: 0,
      hp: MAXHP, invul: 0, hurtT: 0, dead: false, deadT: 0, atk: null, atkQ: false, combo: 0, comboT: 0, atkHeld: false, animT: 0,
      stumble: 0, kx: 0,
      stride: 0, runBlend: 0, lean: 0, landT: 0, jumpT: 0, charge: null, throwHeld: false, throwT: 0, hammer: null, dodge: null, dodgeCd: 0, dodgeHeld: false, trails: [], dodgeGrace: 0,
      cam: arena ? CAM_ARENA : 0, camLock: arena, shake: 0, flash: 0, hitstop: 0,
      phase: arena ? 'intro' : 'ready', phaseT: 0, t: 0, paused: false, kills: 0, popups: [], parts: [], waves: [], debris: [],
      mobs: arena ? [] : buildMobs(), hearts: arena ? [] : buildHearts(), helmets: arena ? [] : buildHelmets(), special: arena, rain: null, rainKey: false, arenaReached: arena, arenaRetry: arena, boss: null, bossBar: 0, titleT: -1, introSkip: false, ended: false,
      wallL: 0, wallR: WORLD_W,
    };
    if (arena) startIntro();
    pointerAttack = false; pointerTap = false;
    hideOverlay();
  }
  async function start() { await load(); newGame(false); running = true; }
  function stop() { running = false; if (typeof Talk !== 'undefined' && Talk.isActive()) Talk.skip(); hideOverlay(); unload(); }
  // libera as imagens da fase ao sair (no celular várias fases abertas em sequência estouravam a memória)
  function unload() { imgs = null; loading = null; }
  // sair no meio da fase: guarda as moedas dos mobs derrotados (uma vez) e fecha a fase
  function leave() { if (g && !g.ended) { g.ended = true; addCoins(g.kills * COIN_VALUE); } stop(); }

  // ---- telas ----
  function hideOverlay() { el('sOverlay').classList.remove('active'); }
  function showOverlay(kind) {
    const coins = g.kills * COIN_VALUE + (kind === 'win' ? REWARD : 0);
    el('sTitle').textContent = kind === 'pause' ? 'Pausado' : kind === 'win' ? 'Fase concluída! 🏆' : 'Você caiu!';
    el('sInfo').innerHTML = kind === 'pause'
      ? `Vidas: <b>${g.hp}/${MAXHP}</b> · Mobs derrotados: <b>${g.kills}</b>${g.boss && g.boss.state !== 'dead' && g.bossBar > .5 ? `<br>Golem: <b>${Math.max(0, Math.ceil(g.boss.hp))}/${BOSS_HP}</b>` : ''}`
      : kind === 'win'
        ? `O Golem Demolidor foi derrotado!<br>Mobs derrotados: <b>${g.kills}</b><br>🪙 <b>+${coins} GenesisCoins</b> <small>(${g.kills} × ${COIN_VALUE} + ${REWARD} do boss)</small>`
        : `${g.arenaReached ? 'O Golem ainda está de pé.' : 'O bosque não é fácil.'}<br>Mobs derrotados: <b>${g.kills}</b>${g.kills ? `<br>🪙 <b>+${g.kills * COIN_VALUE} GenesisCoins</b>` : ''}`;
    el('sPrimary').textContent = kind === 'pause' ? 'Continuar' : kind === 'win' ? 'Jogar de novo' : (g.arenaReached ? 'Lutar de novo' : 'Tentar de novo');
    el('sPrimary').dataset.kind = kind;
    el('sRestart').hidden = !(kind === 'lose' && g.arenaReached);
    el('sExit').hidden = false;                       // dá para sair pela pausa, ao perder ou ao vencer
    el('sOverlay').classList.add('active');
  }
  function togglePause() {
    if (g && g.talking) return;                                // na conversa, quem fecha é o Esc/Pular da própria conversa
    if (!running || g.ended) return;
    g.paused = !g.paused;
    cancelAttackInput();
    g.paused ? showOverlay('pause') : hideOverlay();
  }
  function primary() {
    const k = el('sPrimary').dataset.kind;
    if (k === 'pause') { g.paused = false; hideOverlay(); }
    else if (k === 'win') { g.arenaReached = false; newGame(false); }
    else newGame(true);
  }
  function restartAll() { g.arenaReached = false; newGame(false); }

  // ---- efeitos ----
  const rnd = (a, b) => a + Math.random() * (b - a);
  const popup = (text, x, y, color) => g.popups.push({ text, x, y, t: 0, color: color || '#fff3b0' });
  function burst(x, y, n, kind, spread = 1, up = 1) {
    for (let i = 0; i < n; i++) {
      const a = rnd(-Math.PI, 0) , sp = rnd(120, 620) * spread;
      g.parts.push({ k: kind, x: x + rnd(-20, 20), y: y + rnd(-10, 10), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * up - rnd(0, 180), life: rnd(0.7, 1.6), t: 0, s: rnd(5, 15), rot: rnd(0, 6), vr: rnd(-8, 8), c: Math.floor(rnd(0, 3)) });
    }
  }
  const dust = (x, y, n = 8, s = 1) => { for (let i = 0; i < n; i++) g.parts.push({ k: 'dust', x: x + rnd(-40, 40), y: y - rnd(0, 20), vx: rnd(-140, 140) * s, vy: rnd(-90, -10), life: rnd(0.5, 1.1), t: 0, s: rnd(18, 42) * s, rot: 0, vr: 0, c: 0 }); };
  const stars = (x, y, n = 6) => { for (let i = 0; i < n; i++) g.parts.push({ k: 'star', x, y, vx: rnd(-260, 260), vy: rnd(-420, -100), life: rnd(0.4, 0.8), t: 0, s: rnd(8, 14), rot: rnd(0, 6), vr: rnd(-6, 6), c: 0 }); };
  const doShake = a => { g.shake = Math.max(g.shake, reducedMotion.matches ? 0 : a); };

  // ---- dano ----
  function hurtPlayer(dmg, srcX) {
    if (g.dodge || g.dodgeGrace > 0 || g.invul > 0 || g.dead || g.phase === 'intro' || g.phase === 'victory' || g.phase === 'win' || g.boss && g.boss.st === 'dead') return;
    g.hp -= dmg; Sound.hit(); doShake(7);
    popup('-' + dmg, g.x, g.y - 150, '#ff9a8a');
    g.atk = null; g.atkQ = false;
    cancelAttackInput();
    const dir = g.x >= srcX ? 1 : -1;
    if (g.hp <= 0) { g.hp = 0; g.dead = true; g.deadT = 0; g.vx = 220 * dir; g.vy = -520; g.plat = null; Sound.die(); return; }
    g.hurtT = 0.45; g.invul = 1.5; g.vx = 340 * dir; g.vy = -480; g.plat = null;
  }

  // ---- ataque do martelo ----
  const ATK = {
    A: { wind: 0.10, act: 0.12, tail: 0.12, dmg: 1, fr: [2, 3, 4], box: [16, 190, -150, -8] },
    B: { wind: 0.18, act: 0.14, tail: 0.18, dmg: 2, fr: [5, 6, 6], box: [16, 215, -200, 0] },
    AIR: { wind: 0.06, act: 0.26, tail: 0.06, dmg: 1, fr: [13, 18, 18], box: [8, 185, -150, 24] },
  };
  function startAttack() {
    if (g.dead || g.dodge || g.hammer || g.throwT > 0 || g.hurtT > 0 || g.atk || g.phase === 'intro' || g.phase === 'win' || g.phase === 'ready' && g.phaseT < 0.9) return;
    const air = !g.plat;
    const type = air ? 'AIR' : (g.comboT > 0 && g.combo === 1 ? 'B' : 'A');
    g.combo = type === 'A' ? 1 : 0; g.comboT = 0.7;
    g.atk = { type, t: 0, hit: new Set() }; Sound.swing();
  }
  function atkBox() {
    if (!g.atk) return null;
    const a = ATK[g.atk.type];
    if (g.atk.t < a.wind || g.atk.t > a.wind + a.act + (g.atk.type === 'AIR' ? 0 : 0.03)) return null;
    const [x0, x1, y0, y1] = a.box, f = g.face;
    return { x0: g.x + Math.min(x0 * f, x1 * f), x1: g.x + Math.max(x0 * f, x1 * f), y0: g.y + y0, y1: g.y + y1, dmg: a.dmg };
  }
  const overlap = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
  const pBox = () => ({ x0: g.x - 24, x1: g.x + 24, y0: g.y - 118, y1: g.y - 4 });

  const canActForRain = () => !g.dead && g.phase !== 'intro' && g.phase !== 'victory' && g.phase !== 'win' && !g.paused;
  function cancelAttackInput() { g.charge = null; g.atkQ = false; pointerAttack = false; pointerTap = false; }
  // celular: a mira vem do botão Lançar (window.touchAim, definido em touch.js); o toque rápido lança para a frente
  const touchAimed = () => isTouch() && !!window.touchAim && window.touchAim.set;
  function aimDirection() {
    if (isTouch()) return touchAimed() ? { x: window.touchAim.x, y: window.touchAim.y } : { x: g.face, y: 0 };
    if (!pointerAim.valid) return { x: g.face, y: 0 };
    const canvas = el('c'), rect = canvas.getBoundingClientRect();
    const mx = (pointerAim.x - rect.left) * VW / rect.width / S + g.cam;
    const my = (pointerAim.y - rect.top) * VH / rect.height / S;
    const dx = mx - g.x, dy = my - (g.y - 85), length = Math.hypot(dx, dy);
    return length > 12 ? { x: dx / length, y: dy / length } : { x: g.face, y: 0 };
  }
  function throwHammer(charge) {
    const aimed = isTouch() ? touchAimed() : charge >= CHARGE_DELAY, aim = aimed ? aimDirection() : { x: g.face, y: 0 };
    const power = !aimed ? 0 : isTouch() ? window.touchAim.mag : Math.min(1, (charge - CHARGE_DELAY) / (CHARGE_FULL - CHARGE_DELAY));
    g.atk = null; g.atkQ = false;
    g.hammer = { x: g.x + aim.x * 55, y: g.y - 85 + aim.y * 55, dir: aim.x < 0 ? -1 : 1, dx: aim.x, dy: aim.y, speed: 1000 + 250 * power, t: 0, distance: 0,
      range: 720 + 440 * power, damage: 3 + Math.round(2 * power), returning: false, hit: new Set() };
    g.throwT = .24; g.combo = 0; g.comboT = 0; Sound.swing();
  }
  const mobBox = m => m.type === 'rock' ? { x0: m.x - 40, x1: m.x + 40, y0: m.y - 92, y1: m.y } : { x0: m.x - 46, x1: m.x + 46, y0: m.y - 40, y1: m.y + 40 };
  function sweptHammerHit(x0, y0, x1, y1, box) {
    let entry = 0, exit = 1;
    for (const [start, delta, min, max] of [[x0, x1 - x0, box.x0 - 28, box.x1 + 28], [y0, y1 - y0, box.y0 - 28, box.y1 + 28]]) {
      if (Math.abs(delta) < .0001) { if (start < min || start > max) return false; }
      else {
        const a = (min - start) / delta, b = (max - start) / delta;
        entry = Math.max(entry, Math.min(a, b)); exit = Math.min(exit, Math.max(a, b));
        if (entry > exit) return false;
      }
    }
    return true;
  }
  function hammerUpdate(dt) {
    const h = g.hammer;
    if (!h) return;
    if (g.dead || g.phase === 'intro' || g.phase === 'victory' || g.phase === 'win' || g.boss && g.boss.st === 'dead') { g.hammer = null; return; }
    h.t += dt;
    const oldX = h.x, oldY = h.y;
    if (h.returning) {
      const dx = g.x - h.x, dy = g.y - 85 - h.y, distance = Math.hypot(dx, dy);
      if (distance <= 1200 * dt + 25 || h.t > 3) { g.hammer = null; Sound.block(); return; }
      h.x += dx / distance * 1200 * dt; h.y += dy / distance * 1200 * dt;
    } else {
      h.x += h.dx * h.speed * dt; h.y += h.dy * h.speed * dt; h.distance += h.speed * dt;
      h.x = Math.max(g.wallL + 24, Math.min(g.wallR - 24, h.x));
      h.y = Math.max(-120, Math.min(GY - 20, h.y));
      if (h.distance >= h.range || h.x <= g.wallL + 24 || h.x >= g.wallR - 24 || h.y <= -120 || h.y >= GY - 20) h.returning = true;
    }
    // Varre todo o deslocamento do quadro, evitando atravessar alvos em FPS baixo.
    for (const m of g.mobs) {
      if (m.dead || h.hit.has(m) || !sweptHammerHit(oldX, oldY, h.x, h.y, mobBox(m))) continue;
      h.hit.add(m); m.hp -= h.damage; m.flash = .12; Sound.hit();
      if (m.type === 'rock') { m.stun = .3; m.vx = h.dir * 200; }
      if (m.hp <= 0) killMob(m); else stars(m.x, m.y - 50, 4);
    }
    if (g.boss && !h.hit.has('boss') && sweptHammerHit(oldX, oldY, h.x, h.y, bossHurtbox()) && damageBoss(h.damage)) h.hit.add('boss');
  }

  // ---- cura ao chegar no boss: os corações se enchem um a um, com brilho verde e corações subindo ----
  function healUpdate(dt) {
    const h = g.heal; h.t += dt;
    const t0 = .55;
    if (!reducedMotion.matches || h.filled === 0) {
      if (Math.random() < dt * 34) g.parts.push({ k: 'heal', x: g.x + rnd(-34, 34), y: g.y - rnd(8, 120), vx: rnd(-18, 18), vy: -rnd(80, 190), life: .95, t: 0, s: rnd(.8, 1.6), rot: 0, vr: 0, c: 0 });
    }
    while (h.filled < h.need && h.t >= t0 + h.filled * .32) {
      g.hp++; h.filled++; g.pulse[g.hp - 1] = g.t;
      Sound.coin(); g.hitstop = 0;
      popup('+1', g.x + rnd(-24, 24), g.y - 150, '#b8ffcf');
      for (let i = 0; i < 3; i++) g.parts.push({ k: 'healHeart', x: g.x + rnd(-40, 40), y: g.y - rnd(40, 110), vx: rnd(-30, 30), vy: -rnd(110, 210), life: 1.1, t: 0, s: rnd(.8, 1.2), rot: 0, vr: 0, c: 0 });
    }
    if (!h.done && h.t >= t0 + h.need * .32 + .1) {
      h.done = true; g.flash = .3; Sound.power();
      popup(h.need > 0 ? 'VIDA RESTAURADA!' : 'VIDA CHEIA!', g.x, g.y - 190, '#b8ffcf');
      stars(g.x, g.y - 90, 12);
    }
    if (h.t >= h.dur) g.heal = null;
  }

  // ---- conversa entre o Genésio e o Golem (estilo Pokémon: toque/clique/Enter passa) ----
  const GENESIO_PIC = DIR + 'sprites/hm1.webp', GOLEM_PIC = DIR + 'sprites/golem-portrait.webp';
  const TALK = {
    intro: [
      { who: 'Golem Demolidor', boss: true, text: 'QUEM OUSA PISAR NO MEU BOSQUE?!' },
      { who: 'Genésio', text: 'Eu sou o Genésio! Vim ajudar o bosque e todo mundo que mora aqui.' },
      { who: 'Golem Demolidor', boss: true, text: 'Ajudar? Com esse martelinho de brinquedo? Ha! Vou te transformar em pedregulho!' },
      { who: 'Genésio', text: 'Esse martelo já construiu muita coisa por aí... e agora vai consertar a sua má educação!' },
      { who: 'Golem Demolidor', boss: true, text: 'Então venha, pequeno cubo! Não vou pegar leve!' },
      { who: 'Genésio', text: 'Eu também não! E tenho uns pregos guardados para você. Vamos lá!' },
    ],
    fury: [
      { who: 'Golem Demolidor', boss: true, text: 'GRRR... CHEGA DE BRINCADEIRA! AGORA VOCÊ ME DEIXOU FURIOSO!' },
      { who: 'Genésio', text: 'Eu já esperava por isso. Respira fundo e vem de novo!' },
    ],
    victory: [
      { who: 'Golem Demolidor', boss: true, text: 'Impossível... derrotado por um cubinho verde...' },
      { who: 'Genésio', text: 'Nada pessoal. Agora o bosque pode respirar em paz.' },
      { who: 'Golem Demolidor', boss: true, text: 'Hmpf... Você luta com honra. O bosque é seu. Cuide bem dele.' },
      { who: 'Genésio', text: 'Pode deixar! Obrigado pela luta, Golem!' },
    ],
  };
  function say(kind, done) {
    const lines = TALK[kind];
    if (!lines || typeof Talk === 'undefined' || g.noTalk) { if (done) done(); return; }
    for (const k in keys) keys[k] = false;
    g.talking = true; g.vx = 0; g.charge = null; g.atkQ = false; cancelAttackInput();
    Talk.start(lines.map(l => l.boss ? { ...l, pic: GOLEM_PIC, side: 'right', dim: true } : { ...l, pic: GENESIO_PIC, side: 'left', dim: true }), () => { if (g) g.talking = false; if (done) done(); });
  }

  // ---- boss ----
  function startIntro() {
    g.phase = 'intro'; g.phaseT = 0; g.camLock = true; g.wallL = CAM_ARENA + 40; g.wallR = CAM_ARENA + VIEW_W - 40; g.arenaReached = true;
    g.atk = null; g.vx = 0;
    cancelAttackInput(); g.hammer = null; g.dodge = null; g.trails.length = 0;
    g.atkQ = false; g.mobs.length = 0;
    // A última imagem vira uma arena fechada até a vitória.
    burst(g.wallL, GY, 26, 'rock'); dust(g.wallL, GY, 10, 1.3);
    g.heal = { t: 0, need: MAXHP - g.hp, filled: 0, done: false, dur: MAXHP - g.hp > 0 ? .55 + (MAXHP - g.hp) * .32 + .9 : .7 };   // o Genésio recupera toda a vida antes do golem cair
    g.pulse = {};
    g.boss = { x: CAM_ARENA + VIEW_W - 340, y: -520, face: -1, hp: BOSS_HP, st: 'pre', t: 0, fr: 15, flash: 0, vy: 0, acd: 1, last: '', p2: false, hitFx: 0, vx: 0, tx: 0, rec: 0, sq: 0, hurtV: 0, ghosts: [], walk: 0, slow: 0, prev: 0 };
    g.bossBar = 0; g.titleT = -1; g.introSkip = false;
  }
  const B = () => g.boss;
  function bossDir() { return B().face; }
  function bossAttack() {
    const b = B(), dist = Math.abs(g.x - b.x), r = Math.random();
    let a;
    if (dist < 360) a = r < .55 ? 'punch' : 'swing';
    else if (dist < 680) a = r < .5 ? 'swing' : 'stomp';
    else a = r < .75 ? 'stomp' : 'swing';
    if (a === b.last && Math.random() < 0.65) a = a === 'swing' ? (dist < 360 ? 'punch' : 'stomp') : a === 'punch' ? 'swing' : 'swing';
    b.last = a; b.face = g.x < b.x ? -1 : 1; b.t = 0;
    b.st = a === 'punch' ? 'punchW' : a === 'swing' ? 'swingW' : 'stompW';
  }
  // duração do aviso de cada golpe (antes do golpe sair) e do descanso depois dele
  const WIND = { punchW: .85, swingW: 1.2, stompW: .65 };
  const windDur = (st, p2) => WIND[st] * (p2 ? .8 : 1);
  function wave(x, dir, speed, h = 80) { g.waves.push({ x, dir, v: speed, h, t: 0, life: 1.9 }); }
  function bossLand(big) {
    const b = B(); b.sq = big ? 1 : .55; Sound.smash(); doShake(big ? 30 : 16); g.flash = big ? .5 : .2;
    burst(b.x, GY, big ? 70 : 34, 'dirt', 1.15); burst(b.x, GY, big ? 24 : 12, 'rock', 1); dust(b.x, GY, 14, 1.6);
  }
  function bossHurtbox() { const b = B(); return { x0: b.x - 125, x1: b.x + 125, y0: b.y - 335, y1: b.y }; }
  function bossTitleCard() { g.titleT = 0; }

  function bossUpdate(dt) {
    const b = B(); b.t += dt; if (b.flash > 0) b.flash -= dt;
    if (b.sq) b.sq *= Math.exp(-dt * 9);                           // squash de pouso/dano volta ao normal
    if (b.hurtV) b.hurtV *= Math.exp(-dt * 8);
    b.ghosts = b.ghosts.filter(q => g.t - q.t < .16);
    if ((b.st === 'punch' || b.st === 'swing' || b.st === 'stompJ') && (!b.ghosts.length || g.t - b.ghosts[b.ghosts.length - 1].t > .035) && !reducedMotion.matches)
      b.ghosts.push({ x: b.x, y: b.y, fr: b.fr, face: b.face, t: g.t });
    const d = b.face, wl = g.wallL + 190, wr = g.wallR - 190;
    switch (b.st) {
      case 'pre':                                                  // espera a cura do Genésio terminar
        b.fr = 15; if (!g.heal) { b.st = 'fall'; b.t = 0; }
        break;
      case 'fall':
        b.vy += 3400 * dt; b.y += b.vy * dt; b.fr = 15;
        if (Math.random() < dt * 60) g.parts.push({ k: 'dirt', x: b.x + rnd(-150, 150), y: b.y - 150, vx: rnd(-60, 60), vy: rnd(100, 380), life: 1.2, t: 0, s: rnd(5, 13), rot: rnd(0, 6), vr: rnd(-8, 8), c: Math.floor(rnd(0, 3)) });
        if (b.y >= GY) {
          b.y = GY; b.vy = 0; b.st = 'land'; b.t = 0; bossLand(true);
          g.stumble = 0.8; g.kx = g.x < b.x ? -1 : 1; g.vx = 380 * g.kx; g.vy = -420; g.plat = null;   // o tremor derruba o Genésio (sem dano)
        }
        break;
      case 'land':
        b.fr = 16; if (b.t > 0.8) { b.st = 'roar'; b.t = 0; Sound.roar(); g.flash = .6; doShake(26); bossTitleCard(); }
        break;
      case 'roar':
        b.fr = 12; doShake(11 + 5 * Math.sin(b.t * 34));
        if (Math.random() < dt * 40) g.parts.push({ k: 'dirt', x: g.cam + rnd(0, VIEW_W), y: -10, vx: rnd(-30, 30), vy: rnd(200, 520), life: 1.6, t: 0, s: rnd(5, 12), rot: rnd(0, 6), vr: rnd(-8, 8), c: Math.floor(rnd(0, 3)) });
        if (b.t > 2.3) {
          const go = () => { b.st = 'idle'; b.t = 0; g.phase = 'fight'; b.acd = 1.5; g.stumble = 0; };
          if (!g.arenaRetry && !g.introTalked) { g.introTalked = true; say('intro', go); } else go();     // ao lutar de novo não repete a conversa
        }
        break;
      case 'p2roar':
        b.fr = 12; doShake(10 + 4 * Math.sin(b.t * 34)); b.flash = 0.05;
        if (Math.random() < dt * 40) g.parts.push({ k: 'dirt', x: g.cam + rnd(0, VIEW_W), y: -10, vx: rnd(-30, 30), vy: rnd(200, 520), life: 1.6, t: 0, s: rnd(5, 12), rot: rnd(0, 6), vr: rnd(-8, 8), c: Math.floor(rnd(0, 3)) });
        if (b.t > 1.6) { b.st = 'idle'; b.t = 0; b.acd = 1.0; }
        break;
      case 'idle': {
        b.face = g.x < b.x ? -1 : 1;
        const dist = Math.abs(g.x - b.x), sp = b.p2 ? 150 : 110;
        if (dist > 150 && !g.dead) b.x += b.face * sp * dt;
        b.x = Math.max(wl, Math.min(wr, b.x));
        b.fr = dist > 150 ? 2 + Math.floor(b.t * 8) % 4 : (Math.floor(b.t * 2) % 2);
        if (dist > 150) { const step = Math.floor(b.t * 8); if (step !== b.prev && (step % 2 === 0)) { doShake(2.5); dust(b.x - b.face * 60, GY, 2, .6); } b.prev = step; }
        b.acd -= dt;
        if (b.acd <= 0 && !g.dead && g.phase === 'fight') bossAttack();
        // encostar no golem andando machuca
        if (!g.dead && overlap(pBox(), { x0: b.x - 95, x1: b.x + 95, y0: GY - 250, y1: GY })) hurtPlayer(1, b.x);
        break;
      }
      case 'rainStun':
        b.fr = (Math.floor(b.t * 9) % 2) ? 13 : 14; b.face = g.x < b.x ? -1 : 1;
        if (Math.random() < dt * 22) stars(b.x + rnd(-110, 110), GY - rnd(180, 330), 1);
        break;
      case 'hit': b.fr = 13; if (b.t > 0.22) { b.st = 'idle'; b.t = 0; } break;
      case 'punchW': b.fr = 6; if (b.t > windDur('punchW', b.p2)) { b.st = 'punch'; b.t = 0; Sound.swing(); } break;
      case 'punch':
        b.fr = 7; { const f = b.face; const hb = { x0: b.x + Math.min(30 * f, 340 * f), x1: b.x + Math.max(30 * f, 340 * f), y0: GY - 300, y1: GY - 20 };
          if (b.t < 0.22 && overlap(pBox(), hb)) hurtPlayer(1, b.x); }
        if (b.t > 0.3) { b.st = 'rec'; b.t = 0; b.rec = b.p2 ? 0.85 : 1.1; }
        break;
      case 'swingW': b.fr = 6; if (b.t > windDur('swingW', b.p2)) { b.st = 'swing'; b.t = 0; Sound.swing(); } break;
      case 'swing':
        b.fr = b.t < 0.17 ? 8 : 9;
        { const f = b.face; const hb = { x0: b.x + Math.min(-30 * f, 680 * f), x1: b.x + Math.max(-30 * f, 680 * f), y0: GY - 300, y1: GY - 30 };
          if (b.t < 0.42 && overlap(pBox(), hb)) hurtPlayer(2, b.x); }
        if (b.t > 0.5) { b.st = 'rec'; b.t = 0; b.rec = b.p2 ? 1.2 : 1.6; }
        break;
      case 'stompW': b.fr = 14; if (b.t > windDur('stompW', b.p2)) { b.st = 'stompJ'; b.t = 0; b.vy = -1450; b.tx = Math.max(wl, Math.min(wr, g.x)); b.vx = (b.tx - b.x) / (2 * 1450 / 3400); Sound.jump(); } break;
      case 'stompJ':
        b.fr = 15; b.vy += 3400 * dt; b.y += b.vy * dt; b.x += b.vx * dt;
        if (b.y >= GY && b.vy > 0) {
          b.y = GY; b.vy = 0; b.st = 'stompL'; b.t = 0; bossLand(true);
          if (Math.abs(g.x - b.x) < 200 && g.y > GY - 120) hurtPlayer(1, b.x);
          if (b.p2) spawnDebris(6);              // sem onda de terra: o pouso só machuca quem está embaixo
        }
        break;
      case 'stompL': b.fr = 16; if (b.t > 0.6) { b.st = 'rec'; b.t = 0; b.rec = b.p2 ? 1.1 : 1.5; } break;
      case 'rec': b.fr = 17; if (b.t > b.rec) { b.st = 'idle'; b.t = 0; b.acd = b.p2 ? rnd(0.8, 1.3) : rnd(1.2, 2.0); } break;
      case 'dead':
        b.fr = b.t < 0.5 ? 13 : b.t < 1.7 ? 18 : 19;
        if (b.t < .08 && !b.slow) { b.slow = 1; g.hitstop = .22; }                // pausa dramática no golpe final
        if (b.t > .5 && b.t < 1.75 && Math.floor(b.t * 11) !== Math.floor((b.t - dt) * 11)) { burst(b.x + rnd(-170, 170), GY - rnd(0, 120), 4, 'rock', .5); dust(b.x + rnd(-170, 170), GY, 2, 1.2); }
        if (b.t > 1.7 && b.t < 1.75) { b.sq = .9; doShake(20); dust(b.x, GY, 14, 2); }  // baque ao cair no chão
        if (b.t < 2.4 && Math.random() < dt * 14) { burst(b.x + rnd(-130, 130), GY - rnd(20, 200), 6, 'rock', 0.6); dust(b.x + rnd(-130, 130), GY - rnd(0, 150), 2, 1); }
        if (Math.floor(b.t * 4) !== Math.floor((b.t - dt) * 4) && b.t < 2.4) { doShake(14); Sound.rumble(); }
        if (b.t > 3.4 && g.phase === 'fight') {
          g.phase = 'victory'; g.phaseT = 0; g.atk = null; g.atkQ = false;
          Sound.power(); popup('BOSQUE LIBERADO!', g.x, g.y - 210, '#d9ffb0');
          stars(g.x, g.y - 100, 24);
          say('victory');
        }
        break;
    }
    if (b.st !== 'dead' && b.st !== 'fall' && b.st !== 'land' && b.st !== 'roar') {
      b.x = Math.max(wl - 40, Math.min(wr + 40, b.x));
    }
  }
  function spawnDebris(n) { for (let i = 0; i < n; i++) g.debris.push({ x: rnd(g.wallL + 60, g.wallR - 60), y: -140, vy: 0, warn: 0.9 + i * 0.12, t: 0, st: 'warn' }); }

  function damageBoss(n, fromRain) {
    const b = B();
    if (!b || b.st === 'dead' || b.st === 'fall' || b.st === 'land' || b.st === 'roar' || b.st === 'p2roar') return false;
    b.hp -= n; b.flash = 0.12; g.hitstop = fromRain ? 0 : 0.05; Sound.hit(); doShake(5); b.hurtV = (g.x < b.x ? 1 : -1); b.sq = Math.max(b.sq, .25);
    burst(b.x + rnd(-80, 80), GY - rnd(80, 260), 8, 'rock', 0.55); stars(b.x + (g.x < b.x ? -90 : 90), GY - 190, 4);
    popup('-' + (+n.toFixed(1)), b.x + rnd(-40, 40), GY - 340, '#ffe58a');
    if (b.hp <= 0) { b.hp = 0; b.st = 'dead'; b.t = 0; b.y = GY; b.vy = 0; g.waves.length = 0; g.debris.length = 0; doShake(32); g.flash = .7; Sound.smash(); return true; }
    if (fromRain) return true;                       // durante a chuva o boss continua atordoado; a fúria vem no fim
    if (!b.p2 && b.hp <= BOSS_HP / 2) { b.p2 = true; b.st = 'p2roar'; b.t = 0; Sound.roar(); g.flash = .4; g.waves.length = 0; popup('FÚRIA!', b.x, GY - 380, '#ff9a8a'); say('fury'); return true; }
    if (b.st === 'idle') { b.st = 'hit'; b.t = 0; }
    return true;
  }

  function win() {
    g.ended = true; g.phase = 'win';
    const total = g.kills * COIN_VALUE + REWARD;
    addCoins(total); markCleared(); Sound.power();
    showOverlay('win');
  }
  function lose() {
    g.ended = true; g.rain = null;
    addCoins(g.kills * COIN_VALUE);
    showOverlay('lose');
  }

  // ---- especial (caixa de pregos): chuva de pregos no boss ----
  const RAIN_DUR = 2.3, RAIN_HITS = 18, RAIN_DMG = 0.8;   // ~14 de 40 de vida do golem (35%)
  function canRain() {
    const b = g.boss;
    return g.special && !g.rain && !g.dead && g.phase === 'fight' && b && b.st !== 'dead' && b.st !== 'fall' && b.st !== 'land' && b.st !== 'roar' && b.st !== 'p2roar' && !g.hammer;
  }
  function startRain() {
    const b = g.boss;
    g.special = false; g.atk = null; g.atkQ = false; cancelAttackInput(); g.dodge = null; g.charge = null;
    g.waves.length = 0; g.debris.length = 0;
    g.rain = { t: 0, hammers: [], fired: 0 };
    for (let i = 0; i < RAIN_HITS; i++) g.rain.hammers.push({ delay: .35 + i * (RAIN_DUR - .7) / RAIN_HITS, dx: rnd(-130, 130) + (i % 2 ? 40 : -40), ty: GY - rnd(60, 330), y: -140, vy: 0, st: 'wait', rot: rnd(-.12, .12), vr: 0, sT: 0 });
    b.st = 'rainStun'; b.t = 0; b.fr = 13; b.ghosts.length = 0; b.hitDone = false;
    g.invul = Math.max(g.invul, RAIN_DUR + .8); g.flash = .35; doShake(8);
    Sound.power(); Sound.roar();
    popup('CHUVA DE PREGOS!', g.x, g.y - 190, '#dff0ff');
  }
  function rainUpdate(dt) {
    const r = g.rain, b = g.boss; if (!r) return;
    r.t += dt; g.invul = Math.max(g.invul, .3); g.hurtT = 0; g.vx = 0;
    for (const h of r.hammers) {
      if (h.st === 'wait' && r.t >= h.delay) { h.st = 'fall'; h.x = b.x + h.dx; Sound.swing(); }
      else if (h.st === 'done') h.sT += dt;
      else if (h.st === 'fall') {
        h.vy += 5200 * dt; h.y += h.vy * dt;
        if (h.y >= h.ty) {
          h.st = 'done'; r.fired++;
          if (b.st !== 'dead') {
            damageBoss(RAIN_DMG, true);
            stars(h.x, h.y, 5); burst(h.x, h.y, 5, 'rock', .5); b.sq = Math.max(b.sq, .35); b.hurtV = (r.fired % 2 ? 1 : -1) * .8; b.flash = .1;
            if (r.fired % 3 === 0) { doShake(10); Sound.smash(); }
          }
        }
      }
    }
    if (b.st === 'dead') { g.rain = null; return; }
    if (r.t >= RAIN_DUR && r.hammers.every(h => h.st === 'done')) {
      g.rain = null; g.invul = Math.max(g.invul, .8);
      if (!b.p2 && b.hp <= BOSS_HP / 2) { b.p2 = true; b.st = 'p2roar'; b.t = 0; Sound.roar(); g.flash = .4; popup('FÚRIA!', b.x, GY - 380, '#ff9a8a'); say('fury'); }
      else { b.st = 'idle'; b.t = 0; b.acd = 1.2; }
    }
  }

  // ---- mobs ----
  function killMob(m) {
    m.dead = true; g.kills++; Sound.coin(); stars(m.x, m.y - 50, 7); burst(m.x, m.y - 40, 10, m.type === 'rock' ? 'rock' : 'dirt', 0.5);
    // a morte vira peças que voam: tijolos laranja (rock) ou chapas amarelas, asas e garras (voador)
    const pieces = m.type === 'rock' ? ['rock_armL', 'rock_armR', 'rock_legL', 'rock_legR', 'rock_body'] : ['fly_wingL', 'fly_wingR', 'fly_clawL', 'fly_clawR', 'fly_body'];
    const cy = m.type === 'rock' ? m.y - 45 : m.y;
    for (const n of pieces) g.parts.push({ k: 'piece', img: n, x: m.x, y: cy, vx: rnd(-320, 320) + (g.x < m.x ? 90 : -90), vy: rnd(-620, -260), life: 1.15, t: 0, s: 1, rot: 0, vr: rnd(-9, 9), c: 0, flip: m.dir < 0 || m.vx < 0, g: m.type === 'rock' ? 1900 : 1600 });
    popup('+' + COIN_VALUE + ' 🪙', m.x, m.y - 100);
  }
  function mobsUpdate(dt) {
    const px = g.x, py = g.y;
    for (const m of g.mobs) {
      if (m.dead) continue;
      if (Math.abs(m.x - px) > VIEW_W + 500) continue;       // só mexe o que está perto
      m.t += dt; if (m.flash > 0) m.flash -= dt; if (m.hitT > 0) m.hitT -= dt;
      if (m.type === 'rock') {
        const dist = Math.abs(m.x - px), see = dist < 430 && Math.abs(m.y - py) < 170 && !g.dead;
        if (m.stun > 0) { m.stun -= dt; m.x += m.vx * dt; m.vx *= 0.9; m.mode = 'hurt'; }
        else if (m.mode === 'wind') {                          // agacha, treme e avisa antes do bote
          m.windT -= dt; m.dir = px > m.x ? 1 : -1;
          if (m.windT <= 0) { m.mode = 'lunge'; m.lunge = .34; Sound.swing(); dust(m.x, m.y, 4, .5); }
        } else if (m.mode === 'lunge') {                       // bote rápido em direção ao Genésio
          m.lunge -= dt; m.x += m.dir * 430 * dt;
          const lo = m.plat.x0 + 28, hi = m.plat.x1 - 28; m.x = Math.max(lo, Math.min(hi, m.x));
          if (Math.random() < dt * 30) dust(m.x - m.dir * 30, m.y, 1, .5);
          if (m.lunge <= 0) { m.mode = 'rest'; m.windT = .55; }
        } else if (m.mode === 'rest') {                        // ofega depois do bote
          m.windT -= dt; if (m.windT <= 0) { m.mode = 'patrol'; m.cdAtk = 1.6 + Math.random() * 1.6; }
        } else {
          m.mode = 'patrol';
          const sp = see ? 120 : 58;
          m.dir = see ? (px > m.x ? 1 : -1) : m.dir;
          m.x += m.dir * sp * dt; m.stride += sp * dt / 120;
          const lo = m.plat.x0 + 28, hi = m.plat.x1 - 28;
          if (m.x < lo) { m.x = lo; m.dir = 1; } else if (m.x > hi) { m.x = hi; m.dir = -1; }
          m.cdAtk -= dt;
          if (see && dist < 330 && dist > 120 && m.cdAtk <= 0) { m.mode = 'wind'; m.windT = .5; }
        }
        if (overlap(pBox(), { x0: m.x - 38, x1: m.x + 38, y0: m.y - 88, y1: m.y })) hurtPlayer(1, m.x);
      } else {
        const prevX = m.x, prevY = m.y;
        if (m.st === 'hover') {
          m.x = m.hx + Math.sin(m.t * 1.1) * 70; m.y = m.hy + Math.sin(m.t * 2.3) * 16;
          m.cd -= dt;
          if (m.cd <= 0 && Math.abs(m.x - px) < 420 && !g.dead) { m.st = 'wind'; m.wind = .42; m.tx = px; m.ty = py - 55; Sound.swing(); }
        } else if (m.st === 'wind') {                          // recua e vibra antes de mergulhar
          m.wind -= dt; m.tx = px; m.ty = py - 55;
          const away = m.x < px ? -1 : 1; m.x += away * 90 * dt; m.y -= 55 * dt;
          if (m.wind <= 0) { m.st = 'dive'; m.dive = 0; }
        } else if (m.st === 'dive') {
          m.dive += dt; const dx = m.tx - m.x, dy = m.ty - m.y, L = Math.hypot(dx, dy) || 1;
          m.x += dx / L * 470 * dt; m.y += dy / L * 470 * dt;
          if (Math.random() < dt * 40) g.parts.push({ k: 'dust', x: m.x, y: m.y, vx: 0, vy: 0, life: .3, t: 0, s: 10, rot: 0, vr: 0, c: 0 });
          if (L < 30 || m.dive > 1.1) { m.st = 'return'; }
        } else {
          const dx = m.hx - m.x, dy = m.hy - m.y, L = Math.hypot(dx, dy) || 1;
          m.x += dx / L * 220 * dt; m.y += dy / L * 220 * dt;
          if (L < 14) { m.st = 'hover'; m.cd = 2 + Math.random() * 1.5; m.t = Math.asin(0); }
        }
        m.vx = (m.x - prevX) / Math.max(dt, .0001); m.vy = (m.y - prevY) / Math.max(dt, .0001);
        m.bank += ((Math.max(-1, Math.min(1, m.vx / 400))) - m.bank) * Math.min(1, dt * 10);
        if (overlap(pBox(), { x0: m.x - 42, x1: m.x + 42, y0: m.y - 34, y1: m.y + 34 })) hurtPlayer(1, m.x);
      }
    }
    g.mobs = g.mobs.filter(m => !m.dead);
  }

  // ---- jogador ----
  function playerUpdate(dt) {
    const left = keys.KeyA || keys.ArrowLeft, right = keys.KeyD || keys.ArrowRight, down = keys.KeyS || keys.ArrowDown;
    const jump = !!(keys.Space || keys.KeyW || keys.ArrowUp);
    const atkKey = !!(keys.KeyJ || keys.KeyK || keys.KeyZ || keys.KeyX || keys.Enter) || pointerAttack;
    const dodgeKey = !!(keys.ShiftLeft || keys.ShiftRight);
    const throwKey = !!keys.KeyC;
    const rainKey = !!keys.KeyF;
    if (rainKey && !g.rainKey && canActForRain()) { if (canRain()) startRain(); else if (g.special && !g.rain) popup('Guarde para o boss!', g.x, g.y - 150, '#ffe28a'); }
    g.rainKey = rainKey;
    const canAct = !g.dead && g.hurtT <= 0 && g.stumble <= 0 && g.phase !== 'intro' && g.phase !== 'victory' && g.phase !== 'win' && !(g.boss && g.boss.st === 'dead');
    g.dodgeCd = Math.max(0, g.dodgeCd - dt); g.throwT = Math.max(0, g.throwT - dt);
    g.landT = Math.max(0, g.landT - dt); g.jumpT = Math.max(0, g.jumpT - dt);
    if (g.dodgeGrace > 0) g.dodgeGrace -= dt;
    if (g.dodge) { g.dodge.t += dt; if (g.dodge.t >= DODGE_TIME) { g.dodge = null; g.vx *= .35; g.dodgeGrace = DODGE_GRACE; } }
    if (dodgeKey && !g.dodgeHeld && canAct && !g.dodge && g.dodgeCd <= 0) {
      const dir = !!left !== !!right ? (right ? 1 : -1) : g.face;
      g.dodge = { t: 0, dir }; g.dodgeGrace = 0; g.dodgeCd = DODGE_COOLDOWN; g.face = dir;
      g.atk = null; cancelAttackInput(); g.throwT = 0; g.jbuf = 0;
      dust(g.x, g.y, 6, .7); Sound.swing();
    }
    g.dodgeHeld = dodgeKey;
    const control = canAct && !g.dodge && !g.rain;
    if (g.hurtT > 0) g.hurtT -= dt; if (g.invul > 0) g.invul -= dt; if (g.comboT > 0) g.comboT -= dt;
    if (g.stumble > 0) g.stumble -= dt;
    if (g.dropT > 0) { g.dropT -= dt; if (g.dropT <= 0) g.drop = null; }

    if (control && !g.hammer && g.throwT <= 0) {
      if (throwKey && !g.throwHeld) { g.charge = 0; g.atk = null; g.atkQ = false; }
      if (g.charge !== null) {
        if (throwKey) g.charge = Math.min(CHARGE_FULL, g.charge + dt);
        else { throwHammer(g.charge); g.charge = null; }
      } else if ((atkKey && !g.atkHeld || pointerTap) && !g.hammer) g.atkQ = true;
    } else { g.atkQ = false; g.charge = null; }
    pointerTap = false; g.atkHeld = atkKey; g.throwHeld = throwKey;
    if (control && g.atkQ && !g.atk) { g.atkQ = false; startAttack(); }
    if (g.atk) {
      g.atk.t += dt; const a = ATK[g.atk.type];
      if (g.atk.t >= a.wind + a.act + a.tail) { g.atk = null; if (g.atkQ && control) { g.atkQ = false; startAttack(); } }
    }

    let ax = control ? (right ? 1 : 0) - (left ? 1 : 0) : 0;
    const speed = WALK * (g.atk && g.plat ? .3 : g.charge !== null && g.charge >= CHARGE_DELAY ? .65 : 1);
    if (ax && !(g.atk && g.plat)) g.face = ax;
    const target = control ? ax * speed : 0;
    if (g.dodge) g.vx = g.dodge.dir * (820 - 280 * g.dodge.t / DODGE_TIME);
    else if (control || g.plat) g.vx += (target - g.vx) * Math.min(1, dt * (g.plat ? 18 : 7)); else g.vx *= 0.99;

    // pulo (com tolerância ao sair da plataforma e ao apertar um pouco antes)
    if (g.plat) g.coyote = 0.09; else g.coyote -= dt;
    if (jump && !g.jhold) g.jbuf = 0.11; else g.jbuf -= dt;
    if (control && g.jbuf > 0 && g.coyote > 0) {
      if (down && g.plat && !g.plat.solid) { g.drop = g.plat; g.dropT = 0.3; g.y += 3; g.plat = null; g.jbuf = 0; }
      else { g.vy = -JUMP; g.plat = null; g.coyote = 0; g.jbuf = 0; g.jumpT = .08; Sound.jump(); }
    }
    if (control && !jump && g.vy < -380 && !g.plat) g.vy = -380;                 // soltou cedo: pulo mais baixo
    g.jhold = jump;

    const prevX = g.x;
    g.x += g.vx * dt;
    g.x = Math.max(g.wallL + 30 > 40 ? g.wallL + 30 : 40, Math.min(g.wallR - 30 < WORLD_W - 40 ? g.wallR - 30 : WORLD_W - 40, g.x));
    if (g.plat && !g.dodge && !g.atk && Math.abs(g.x - prevX) > .1) g.stride += Math.abs(g.x - prevX) / 150;
    const moving = g.plat && control && !g.atk && g.charge === null ? Math.min(1, Math.abs(g.x - prevX) / dt / WALK) : 0;
    g.runBlend += (moving - g.runBlend) * (1 - Math.exp(-dt * 14));
    g.lean += (((target - g.vx) / WALK) * .055 - g.lean) * (1 - Math.exp(-dt * 12));
    if (g.dodge && !reducedMotion.matches) {
      if (!g.trails.length || g.t - g.trails[g.trails.length - 1].t > .045) g.trails.push({ x: g.x, y: g.y, face: g.face, t: g.t, set: g.hammer ? 'run' : 'motion', frame: g.hammer ? 0 : 4 + Math.min(3, Math.floor(g.dodge.t / DODGE_TIME * 4)) });
    }
    g.trails = g.trails.filter(p => g.t - p.t < .18);
    if (g.plat) {
      if (!inRange(g.plat, g.x)) { g.plat = null; }
      else { g.vy = 0; g.y = g.plat.y; }
    }
    if (!g.plat) {
      const prev = g.y; g.vy += GRAV * dt; g.y += g.vy * dt;
      if (g.vy >= 0) {
        let best = null;
        for (const p of PLATS) { if (p === g.drop) continue; if (inRange(p, g.x) && prev <= p.y + 2 && g.y >= p.y && (!best || p.y < best.y)) best = p; }
        if (best) { g.plat = best; g.y = best.y; if (g.vy > 400) { g.landT = .12; Sound.land(); dust(g.x, g.y, 3, 0.5); } g.vy = 0; }
      }
    }
    if (g.dead) { g.deadT += dt; if (g.plat) g.vx *= 0.9; if (g.deadT > 1.9 && !g.ended) lose(); }

    // martelo acerta
    const ab = atkBox();
    if (ab) {
      for (const m of g.mobs) {
        if (m.dead || g.atk.hit.has(m)) continue;
        const mb = m.type === 'rock' ? { x0: m.x - 40, x1: m.x + 40, y0: m.y - 92, y1: m.y } : { x0: m.x - 46, x1: m.x + 46, y0: m.y - 40, y1: m.y + 40 };
        if (overlap(ab, mb)) {
          g.atk.hit.add(m); m.hp -= ab.dmg; m.flash = 0.12; g.hitstop = 0.04; Sound.hit(); doShake(3);
          if (m.type === 'rock') { m.stun = 0.25; m.vx = g.face * 260; }
          if (m.hp <= 0) killMob(m); else stars(m.x, m.y - 50, 3);
        }
      }
      if (g.boss && !g.atk.hit.has('boss') && overlap(ab, bossHurtbox())) { g.atk.hit.add('boss'); damageBoss(ab.dmg); }
    }
  }

  // ---- loop ----
  let pointerAttack = false, pointerTap = false;
  const pointerAim = { x: 0, y: 0, valid: false };
  addEventListener('pointermove', e => { pointerAim.x = e.clientX; pointerAim.y = e.clientY; pointerAim.valid = true; });
  document.getElementById('c').addEventListener('pointerdown', e => {
    if (e.button === 0 && running && !g.paused && !g.ended && !document.body.classList.contains('touch')) { pointerAttack = true; pointerTap = true; e.currentTarget.setPointerCapture(e.pointerId); }
  });
  addEventListener('pointerup', () => { pointerAttack = false; });
  addEventListener('pointercancel', () => { if (g) cancelAttackInput(); pointerTap = false; });

  function update(dt) {
    if (!running || g.paused || g.ended) return;
    if (g.hitstop > 0) { g.hitstop -= dt; return; }
    if (g.talking) { g.animT += dt; return; }                // conversa aberta: o mundo espera
    g.t += dt; g.phaseT += dt; g.animT += dt;
    if (g.shake > 0) g.shake = Math.max(0, g.shake - dt * (g.phase === 'intro' ? 14 : 55));
    if (g.flash > 0) g.flash = Math.max(0, g.flash - dt * 1.4);
    for (const p of g.popups) p.t += dt;
    g.popups = g.popups.filter(p => p.t < 1.2);
    // partículas
    for (const p of g.parts) {
      p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      if (p.k === 'dirt' || p.k === 'rock') { p.vy += 1500 * dt; if (p.y > GY + 15 && p.vy > 0) { p.y = GY + 15; p.vy *= -0.3; p.vx *= 0.7; if (Math.abs(p.vy) < 60) p.vy = 0; } }
      else if (p.k === 'dust') { p.vx *= 0.96; p.vy *= 0.96; p.s += dt * 30; }
      else if (p.k === 'star') p.vy += 900 * dt;
      else if (p.k === 'piece') p.vy += p.g * dt;
    }
    g.parts = g.parts.filter(p => p.t < p.life);
    if (g.heal) healUpdate(dt);
    if (g.parts.length > 400) g.parts.splice(0, g.parts.length - 400);

    if (g.phase === 'ready') {
      if (g.phaseT > 3) g.phase = 'run';
    }
    if (g.titleT >= 0) g.titleT += dt;
    if (g.phase === 'victory' && g.phaseT > 1.8) { win(); return; }
    if (g.phase === 'intro' && g.titleT > 1.6 && (keys.Space || keys.Enter || keys.KeyJ) && g.boss && g.boss.st === 'roar' && !g.introSkip && g.arenaRetry) { g.boss.t = 2.3; g.introSkip = true; }

    // câmera
    if (g.camLock) g.cam += (CAM_ARENA - g.cam) * Math.min(1, dt * 3);
    else g.cam += (Math.max(0, Math.min(CAM_ARENA, g.x - VIEW_W * 0.4)) - g.cam) * Math.min(1, dt * 6);

    playerUpdate(dt);
    hammerUpdate(dt);
    rainUpdate(dt);

    // gatilho do boss
    if (!g.boss && !g.dead && g.x >= ARENA_TRIGGER) startIntro();
    if (g.boss) {
      if (g.phase === 'intro' || g.phase === 'fight') bossUpdate(dt);
      g.bossBar += ((g.phase === 'fight' || g.phase === 'victory' || g.phase === 'win' ? 1 : 0) - g.bossBar) * Math.min(1, dt * 4);
    }
    // ondas de choque e pedras
    for (const w of g.waves) {
      w.t += dt; w.x += w.dir * w.v * dt;
      if (Math.random() < dt * 40) g.parts.push({ k: 'dirt', x: w.x, y: GY - rnd(0, 30), vx: rnd(-60, 60), vy: rnd(-380, -140), life: 0.6, t: 0, s: rnd(4, 9), rot: rnd(0, 6), vr: 4, c: Math.floor(rnd(0, 3)) });
      if (!g.dead && overlap(pBox(), { x0: w.x - 48, x1: w.x + 48, y0: GY - w.h, y1: GY + 8 })) hurtPlayer(1, w.x - w.dir * 40);
    }
    g.waves = g.waves.filter(w => w.t < w.life && w.x > g.wallL && w.x < g.wallR);
    for (const d of g.debris) {
      d.t += dt;
      if (d.st === 'warn' && d.t >= d.warn) { d.st = 'fall'; d.vy = 0; }
      else if (d.st === 'fall') {
        d.vy += 2600 * dt; d.y += d.vy * dt;
        if (!g.dead && overlap(pBox(), { x0: d.x - 36, x1: d.x + 36, y0: d.y - 40, y1: d.y + 40 })) { hurtPlayer(1, d.x); d.y = GY + 100; }
        if (d.y >= GY - 5) { d.st = 'done'; burst(d.x, GY, 8, 'rock', 0.5); dust(d.x, GY, 3); doShake(5); Sound.land(); }
      }
    }
    g.debris = g.debris.filter(d => d.st !== 'done');
    mobsUpdate(dt);
    // caixa de pregos (o especial)
    for (const h of g.helmets) {
      if (h.got || g.special || g.dead) continue;
      if (Math.hypot(g.x - h.x, (g.y - 55) - h.y) < 58) { h.got = true; g.special = true; g.hitstop = .06; Sound.power(); popup('PREGOS!  Aperte F no boss', h.x, h.y - 50, '#ffe28a'); stars(h.x, h.y, 12); g.flash = .15; }
    }
    // corações
    for (const h of g.hearts) {
      if (h.got || g.hp >= MAXHP || g.dead) continue;
      if (Math.hypot(g.x - h.x, (g.y - 55) - h.y) < 55) { h.got = true; g.hp++; Sound.power(); popup('+1 vida', h.x, h.y - 40, '#ffb0b8'); stars(h.x, h.y, 6); }
    }
  }

  // ---- desenho ----
  let cx = 0, cy = 0;
  const sx = wx => (wx - g.cam) * S + cx, sy = wy => wy * S + cy;
  const tintCanvas = document.createElement('canvas');
  function drawSprite(ctx, im, x, y, w, h, tint) {
    ctx.drawImage(im, x, y, w, h);
    if (!tint) return;
    tintCanvas.width = im.width; tintCanvas.height = im.height;
    const mask = tintCanvas.getContext('2d');
    mask.drawImage(im, 0, 0); mask.globalCompositeOperation = 'source-in';
    mask.fillStyle = tint; mask.fillRect(0, 0, im.width, im.height);
    ctx.drawImage(tintCanvas, x, y, w, h);
  }
  function spr(im, meta, wx, wy, scale, flip, alpha, tint) {
    const k = scale * S, x = sx(wx), y = sy(wy), w = im.width * k, h = im.height * k;
    const ax = meta.ax * k, ay = meta.ay * k;
    const ctx = spr.ctx; ctx.save();
    if (alpha != null) ctx.globalAlpha = alpha;
    ctx.translate(x, y); if (flip) ctx.scale(-1, 1);
    drawSprite(ctx, im, -ax, -ay, w, h, tint);
    ctx.restore();
  }
  function playerFrame() {
    if (g.phase === 'victory' || g.phase === 'win') return ['hm', 19];
    if (g.rain) return ['hm', g.rain.t < .35 ? 5 : (Math.floor(g.rain.t * 7) % 2 ? 9 : 14)];   // martelo erguido, comemorando a chuva
    if (g.dead) return ['hh', g.deadT < 0.25 ? 5 : g.deadT < 0.7 ? 7 : 9];
    if (g.stumble > 0) return ['hh', g.stumble > 0.4 ? 3 : 4];
    if (g.hurtT > 0) return ['hh', g.hurtT > 0.3 ? 0 : g.hurtT > 0.15 ? 1 : 2];
    if (g.dodge) return g.hammer ? ['run', 0] : ['motion', 4 + Math.min(3, Math.floor(g.dodge.t / DODGE_TIME * 4))];
    if (g.throwT > 0) return ['run', 1];
    if (g.charge !== null && g.charge >= CHARGE_DELAY) return ['hm', 5];
    if (g.atk) {
      const a = ATK[g.atk.type], t = g.atk.t;
      return ['hm', t < a.wind ? a.fr[0] : t < a.wind + a.act ? a.fr[1] : a.fr[2]];
    }
    if (!g.plat) return g.hammer ? ['run', 0] : ['motion', g.jumpT > 0 ? 8 : g.vy < -250 ? 9 : 10];
    if (g.landT > 0 && !g.hammer) return ['motion', 11];
    if (Math.abs(g.vx) > 20 || g.runBlend > .08) return g.hammer ? ['run', Math.floor(g.stride * 4) % 4] : ['motion', Math.floor(g.stride * 4) % 4];
    return g.hammer ? ['run', 2] : ['hm', 0];
  }
  function bossFlip(fr, face) { const nat = fr === 7 ? -1 : 1; return face !== nat; }

  function draw(ctx) {
    if (!running) return;
    spr.ctx = ctx;
    const sh = g.shake; cx = sh ? rnd(-sh, sh) : 0; cy = sh ? rnd(-sh, sh) * 0.7 : 0;
    ctx.fillStyle = '#6fb6e6'; ctx.fillRect(0, 0, VW, VH);
    // cenários (cada imagem = uma tela inteira)
    for (let k = 0; k < NIMG; k++) {
      const x0 = sx(k * PITCH);
      if (x0 > VW + 4 || x0 + IMGW * S < -4) continue;
      ctx.drawImage(imgs.bg[k], Math.round(x0) - 1, cy, Math.ceil(IMGW * S) + 2, VH + 1);
    }
    if (debug) { ctx.strokeStyle = 'magenta'; ctx.lineWidth = 2; for (const p of PLATS) { ctx.beginPath(); ctx.moveTo(sx(p.x0), sy(p.y)); ctx.lineTo(sx(p.x1), sy(p.y)); ctx.stroke(); } }
    // Bloqueios de pedra tornam os limites da arena visíveis.
    if (g.arenaReached && g.phase !== 'victory' && g.phase !== 'win') {
      for (const wx of [g.wallL, g.wallR]) {
        for (let i = 0; i < 5; i++) {
          const x = sx(wx), y = sy(GY - i * 45);
          ctx.fillStyle = i % 2 ? '#6c6756' : '#85816a'; ctx.strokeStyle = '#353b2b'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(x - 24, y); ctx.lineTo(x - 30, y - 29); ctx.lineTo(x - 12, y - 45); ctx.lineTo(x + 20, y - 40); ctx.lineTo(x + 28, y - 11); ctx.lineTo(x + 18, y + 4); ctx.closePath(); ctx.fill(); ctx.stroke();
        }
      }
    }

    // avisos de pedras caindo
    for (const d of g.debris) if (d.st === 'warn') {
      const a = 0.25 + 0.45 * Math.min(1, d.t / d.warn);
      ctx.fillStyle = `rgba(30,20,10,${a})`; ctx.beginPath(); ctx.ellipse(sx(d.x), sy(GY + 8), 46 * S * 1.2, 11, 0, 0, 6.3); ctx.fill();
      ctx.strokeStyle = `rgba(255,120,80,${a + .2})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(sx(d.x), sy(GY + 8), 46 * S * 1.2, 11, 0, 0, 6.3); ctx.stroke();
    }
    // corações
    for (const h of g.hearts) {
      if (h.got) continue;
      const y = sy(h.y + Math.sin(g.t * 4 + h.x) * 6), x = sx(h.x);
      const gl = ctx.createRadialGradient(x, y, 3, x, y, 38); gl.addColorStop(0, 'rgba(255,90,110,.55)'); gl.addColorStop(1, 'rgba(255,90,110,0)');
      ctx.fillStyle = gl; ctx.fillRect(x - 40, y - 40, 80, 80);
      ctx.drawImage(imgs.heart, x - 20, y - 19, 40, 40 * imgs.heart.height / imgs.heart.width);
    }
    // caixas de pregos no chão
    for (const h of g.helmets) {
      if (h.got) continue;
      const x = sx(h.x), y = sy(h.y + Math.sin(g.t * 4 + h.x) * 7);
      const gl = ctx.createRadialGradient(x, y, 4, x, y, 52); gl.addColorStop(0, 'rgba(255,230,90,.7)'); gl.addColorStop(1, 'rgba(255,230,90,0)');
      ctx.fillStyle = gl; ctx.fillRect(x - 54, y - 54, 108, 108);
      const w = 70 * S, hh = w * imgs.nailBox.height / imgs.nailBox.width; ctx.drawImage(imgs.nailBox, x - w / 2, y - hh / 2, w, hh);     // caixa de pregos (o especial)
      ctx.fillStyle = '#fffbe0'; for (let i = 0; i < 3; i++) { const an = g.t * 3 + i * 2.1; ctx.fillRect(x + Math.cos(an) * 34 - 2, y + Math.sin(an) * 28 - 2, 4, 4); }
    }
    // sombras
    const shadow = (wx, wy, rx) => { ctx.fillStyle = 'rgba(0,30,10,.3)'; ctx.beginPath(); ctx.ellipse(sx(wx), sy(wy) - 2, rx * S, rx * S * 0.2, 0, 0, 6.3); ctx.fill(); };
    if (g.boss && g.boss.st !== 'fall' && g.boss.st !== 'pre') shadow(g.boss.x, GY, 150 * (g.boss.st === 'stompJ' ? 0.6 : 1));
    shadow(g.x, g.plat ? g.y : (() => { let by = GY; for (const p of PLATS) if (inRange(p, g.x) && p.y >= g.y - 2 && p.y < by) by = p.y; return by; })(), 40);

    // mobs (peças articuladas: asas, garras, braços e pernas se mexem de verdade)
    for (const m of g.mobs) {
      if (m.dead) continue;
      const x = sx(m.x); if (x < -220 || x > VW + 220) continue;
      const k = 0.5 * S, flashTint = m.flash > 0 ? 'rgba(255,255,255,.75)' : null, P = imgs.part;
      const piece = (name, px, py, ang, tint) => {                 // desenha uma peça girando em torno do pivô
        const im = P[name]; ctx.save(); ctx.translate(px * k, py * k); ctx.rotate(ang); ctx.translate(-px * k, -py * k);
        drawSprite(ctx, im, 0, 0, im.width * k, im.height * k, tint); ctx.restore();
      };
      if (m.type === 'rock') {
        const wind = m.mode === 'wind', lunge = m.mode === 'lunge', rest = m.mode === 'rest', hurt = m.mode === 'hurt';
        const moving = (m.mode === 'patrol') ? 1 : 0, ph = m.stride * 5.2;
        let sqx = 1, sqy = 1, lean = 0, shakeX = 0, lift = 0, armA = 0, armB = 0;
        if (moving) { sqy = 1 + Math.sin(ph * 2) * .035; sqx = 2 - sqy; lift = Math.abs(Math.sin(ph)) * 4; lean = Math.sin(ph) * .04; armA = Math.sin(ph) * .45; armB = -armA; }
        else if (wind) { const t = Math.min(1, 1 - m.windT / .5); sqy = 1 - .2 * t; sqx = 1 + .16 * t; shakeX = Math.sin(m.t * 70) * 2.2; armA = -.9 * t; armB = -.9 * t; lean = -.1 * t; }
        else if (lunge) { sqx = 1.2; sqy = .86; lean = .22; armA = -1.5; armB = -1.5; lift = 6; }
        else if (rest) { sqy = 1 + Math.sin(m.t * 18) * .045; sqx = 2 - sqy; armA = .25; armB = .25; lean = -.04; }
        else if (hurt) { sqx = .88; sqy = 1.16; lean = -.18; shakeX = Math.sin(m.t * 50) * 3; armA = .9; armB = .9; }
        const legL = moving ? Math.sin(ph) * .5 : lunge ? -.5 : 0, legR = moving ? -Math.sin(ph) * .5 : lunge ? .6 : 0;
        ctx.save(); ctx.translate(x + shakeX, sy(m.y) - lift * S);
        ctx.scale(m.dir < 0 ? -1 : 1, 1);
        ctx.scale(sqx, sqy); ctx.rotate(lean);                    // a base fica no chão; o resto estica/achata em volta dos pés
        const ox = -100 * k, oy = -191 * k;
        ctx.translate(ox, oy);
        piece('rock_legL', 52, 148, legL, flashTint); piece('rock_legR', 146, 148, legR, flashTint);
        piece('rock_armL', 56, 104, armA * 1, flashTint); piece('rock_armR', 160, 104, -armB * 1, flashTint);
        piece('rock_body', 100, 150, 0, flashTint);
        ctx.restore();
        if (wind) {                                                // olhos brilhando de raiva
          ctx.save(); ctx.globalAlpha = .5 + .5 * Math.sin(m.t * 40); ctx.fillStyle = '#ff5a3a'; ctx.beginPath(); ctx.arc(x + (m.dir > 0 ? 10 : -10) * k, sy(m.y) - 93 * k, 38 * k, 0, 6.3); ctx.fill(); ctx.restore();
          ctx.fillStyle = '#ff5a3a'; ctx.strokeStyle = '#220'; ctx.lineWidth = 4; ctx.font = "700 34px 'Fredoka',sans-serif"; ctx.textAlign = 'center';
          ctx.strokeText('!', x, sy(m.y) - 205 * k); ctx.fillText('!', x, sy(m.y) - 205 * k);
        }
      } else {
        const wind = m.st === 'wind', dive = m.st === 'dive';
        const flapRate = dive ? 46 : wind ? 60 : 22, flap = Math.sin(m.t * flapRate);
        const wingA = (dive ? .15 : .55) * flap + (dive ? -.55 : 0), clawA = dive ? -.5 : Math.sin(m.t * 5) * .12 + (wind ? .5 : 0);
        const bobY = Math.sin(m.t * 3.2) * 2.5, tilt = (dive ? .45 * Math.sign(m.vx || 1) : 0) + m.bank * .35 + (wind ? Math.sin(m.t * 80) * .06 : 0);
        ctx.save(); ctx.translate(x + (wind ? Math.sin(m.t * 90) * 2 : 0), sy(m.y) + bobY * S); ctx.rotate(tilt);
        const sc = (wind ? 1.08 : 1); ctx.scale(sc, sc);
        ctx.translate(-100 * k, -78 * k);
        piece('fly_wingL', 50, 50, -wingA, flashTint); piece('fly_wingR', 150, 50, wingA, flashTint);
        piece('fly_clawL', 72, 114, clawA, flashTint); piece('fly_clawR', 132, 118, -clawA, flashTint);
        piece('fly_body', 100, 78, 0, flashTint);
        ctx.restore();
        if (wind || dive) {                                        // olhos vermelhos + rastro de velocidade
          if (wind) { ctx.fillStyle = '#ff5a3a'; ctx.strokeStyle = '#220'; ctx.lineWidth = 4; ctx.font = "700 34px 'Fredoka',sans-serif"; ctx.textAlign = 'center'; ctx.strokeText('!', x, sy(m.y) - 62 * k); ctx.fillText('!', x, sy(m.y) - 62 * k); }
          if (dive) { ctx.save(); ctx.globalAlpha = .35; ctx.strokeStyle = '#ffe28a'; ctx.lineWidth = 4; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(x - m.vx * .03 + i * 12, sy(m.y) - m.vy * .03 - 10); ctx.lineTo(x - m.vx * .08 + i * 12, sy(m.y) - m.vy * .08 - 10); ctx.stroke(); } ctx.restore(); }
        }
        // sombra no chão acompanhando o voador
        ctx.fillStyle = 'rgba(0,30,10,.18)'; ctx.beginPath(); ctx.ellipse(x, sy(GY) - 2, 34 * S * (1 - Math.min(.5, (GY - m.y) / 700)), 5, 0, 0, 6.3); ctx.fill();
      }
    }
    // boss
    if (g.boss) {
      const b = g.boss, im = imgs.gb[b.fr], flip = bossFlip(b.fr, b.face);
      const windup = b.st === 'punchW' || b.st === 'swingW' || b.st === 'stompW';
      const wt = windup ? Math.min(1, b.t / windDur(b.st, b.p2)) : 0;
      let tint = null;
      if (b.flash > 0) tint = 'rgba(255,255,255,.7)'; else if (windup) tint = `rgba(255,${60 + 90 * (1 - wt) | 0},30,${.12 + .28 * wt * (.6 + .4 * Math.sin(b.t * 28))})`;
      const dead = b.st === 'dead', p2 = b.p2 && !dead;
      // respiração, passos e antecipação: o golem tem peso (achata no pouso, estica no pulo, agacha antes de bater)
      let sqx = 1, sqy = 1, rot = 0, offx = 0, offy = 0;
      const breathe = Math.sin(b.t * (p2 ? 5.2 : 3.2)) * (b.st === 'idle' || b.st === 'rec' ? .014 : 0);
      sqy += breathe; sqx -= breathe * .6;
      if (b.sq) { sqy -= .2 * b.sq; sqx += .17 * b.sq; }
      if (b.st === 'idle' && Math.abs(g.x - b.x) > 150) { const w = b.t * 8 * Math.PI / 2; sqy += Math.abs(Math.sin(w)) * .02 - .01; rot += Math.sin(w) * .018 * b.face; offy = -Math.abs(Math.sin(w)) * 3; }
      if (windup) { const crouch = b.st === 'stompW' ? .13 : .06; sqy -= crouch * wt; sqx += crouch * .7 * wt; rot -= b.face * (b.st === 'swingW' || b.st === 'punchW' ? .07 : .03) * wt; offx -= b.face * 9 * wt; }
      if (b.st === 'punch' || b.st === 'swing') { const e = Math.max(0, 1 - b.t / .22); sqx += .1 * e; sqy -= .05 * e; rot += b.face * .05 * e; offx += b.face * 18 * e; }
      if (b.st === 'stompJ') { const up = Math.min(1, Math.abs(b.vy) / 1450); sqy += .12 * up; sqx -= .1 * up; }
      if (b.st === 'fall') { sqy += .14; sqx -= .1; }
      if (b.hurtV) { offx += b.hurtV * 22 * Math.min(1, Math.abs(b.hurtV)); rot += b.hurtV * .03; }
      if (b.st === 'roar' || b.st === 'p2roar') { const t = b.t; offx += Math.sin(t * 70) * 3; sqy += Math.sin(t * 9) * .03 + .03; sqx -= Math.sin(t * 9) * .02; }
      if (dead) { const dt2 = Math.max(0, b.t - 1.7); sqy -= .04 * Math.min(1, dt2 * 2); offx += Math.sin(b.t * 60) * (b.t < 1.7 ? 3 * (1 - b.t / 1.7) : 0); }
      // aura de calor quando enfurecido / ao se preparar
      if ((p2 && !dead) || windup) {
        const gl = ctx.createRadialGradient(sx(b.x), sy(b.y - 150), 30, sx(b.x), sy(b.y - 150), 340 * S);
        const ga = windup ? .22 * wt : .16 + .05 * Math.sin(g.t * 8);
        gl.addColorStop(0, `rgba(255,${p2 ? 70 : 150},40,${ga})`); gl.addColorStop(1, 'rgba(255,90,30,0)');
        ctx.fillStyle = gl; ctx.fillRect(sx(b.x) - 360 * S, sy(b.y - 150) - 360 * S, 720 * S, 720 * S);
      }
      // rastro de movimento nos golpes
      for (const q of b.ghosts) spr(imgs.gb[q.fr], M.gb, q.x, q.y, BS, bossFlip(q.fr, q.face), .26 * (1 - (g.t - q.t) / .16), 'rgba(255,200,90,.5)');
      ctx.save();
      const px0 = sx(b.x + offx), py0 = sy(b.y + offy);
      ctx.translate(px0, py0); ctx.rotate(rot); ctx.scale(sqx, sqy); ctx.translate(-px0, -py0);
      spr(im, M.gb, b.x + offx, b.y + offy, BS, flip, 1, tint);
      ctx.restore();
      // fumaça de calor sobe do golem enfurecido
      if (p2 && !dead && Math.random() < .35) g.parts.push({ k: 'dust', x: b.x + rnd(-120, 120), y: b.y - rnd(120, 300), vx: rnd(-20, 20), vy: rnd(-90, -40), life: .8, t: 0, s: rnd(10, 20), rot: 0, vr: 0, c: 0 });
      if (windup) {   // aviso "!" pulsando acima do boss
        const pulse = 1 + .18 * Math.sin(b.t * 24);
        ctx.save(); ctx.translate(sx(b.x), sy(GY - 385)); ctx.scale(pulse, pulse); ctx.fillStyle = '#ff5a3a'; ctx.strokeStyle = '#220'; ctx.lineWidth = 5; ctx.font = "700 56px 'Fredoka',sans-serif"; ctx.textAlign = 'center';
        ctx.strokeText('!', 0, 0); ctx.fillText('!', 0, 0); ctx.restore();
      }
      // faixa de perigo no chão indicando o alcance do golpe
      if (b.st === 'swingW' || b.st === 'punchW') {
        const reach = b.st === 'swingW' ? 680 : 340, f = b.face, a = .12 + .16 * wt;
        ctx.fillStyle = `rgba(255,70,40,${a})`; const x0 = sx(b.x + Math.min(30 * f, reach * f)), x1 = sx(b.x + Math.max(30 * f, reach * f));
        ctx.fillRect(Math.min(x0, x1), sy(GY) - 4, Math.abs(x1 - x0), 8);
      }
      if (b.st === 'stompW') {                                      // marca no chão onde o golem vai cair
        const tx = Math.max(g.wallL + 190, Math.min(g.wallR - 190, g.x)), a = .15 + .35 * wt;
        ctx.strokeStyle = `rgba(255,90,50,${a + .2})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(sx(tx), sy(GY) - 2, 190 * S * (1.3 - .3 * wt), 14, 0, 0, 6.3); ctx.stroke();
        ctx.fillStyle = `rgba(255,70,40,${a * .5})`; ctx.fill();
      }
    }
    // ondas de choque
    for (const w of g.waves) {
      const x = sx(w.x), y = sy(GY + 4), a = Math.max(0, 1 - w.t / w.life * 0.6);
      ctx.save(); ctx.globalAlpha = a;
      ctx.fillStyle = '#7b5632'; ctx.beginPath(); ctx.ellipse(x, y - 6, 52 * S, w.h * S * 0.75, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#a07842'; ctx.beginPath(); ctx.ellipse(x - w.dir * 14, y - 4, 34 * S, w.h * S * 0.5, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#f5d98a'; for (let i = 0; i < 4; i++) { const px = x + (i - 1.5) * 20 * S; ctx.beginPath(); ctx.moveTo(px - 6, y); ctx.lineTo(px, y - w.h * S * (0.5 + 0.35 * ((i + Math.floor(w.t * 20)) % 2))); ctx.lineTo(px + 6, y); ctx.fill(); }
      ctx.restore();
    }
    // pedras caindo
    for (const d of g.debris) if (d.st === 'fall') {
      ctx.save(); ctx.translate(sx(d.x), sy(d.y)); ctx.rotate(d.t * 6); ctx.fillStyle = '#7d7d86'; ctx.strokeStyle = '#2a2a30'; ctx.lineWidth = 3;
      ctx.beginPath(); for (let i = 0; i < 7; i++) { const a = i / 7 * 6.283, r = (i % 2 ? 30 : 38) * S * 1.1; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    }
    // Genésio
    for (const p of g.trails) {
      spr(imgs[p.set][p.frame], M[p.set], p.x, p.y, GS, p.face < 0, .28 * (1 - (g.t - p.t) / .18), '#9ff3ff');
    }
    if (g.dodge || g.dodgeGrace > 0) {
      const px = sx(g.x), py = sy(g.y - 62), a = g.dodge ? .5 : .5 * g.dodgeGrace / DODGE_GRACE;
      const sg = ctx.createRadialGradient(px, py, 20 * S, px, py, 95 * S); sg.addColorStop(0, `rgba(150,240,255,${a * .35})`); sg.addColorStop(.75, `rgba(120,230,255,${a})`); sg.addColorStop(1, 'rgba(120,230,255,0)');
      ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(px, py, 95 * S, 0, 6.3); ctx.fill();
    }
    const blink = g.invul > 0 && !g.rain && !g.dead && g.hurtT <= 0 && Math.floor(g.invul * 14) % 2 === 0;
    if (!blink) {
      const [set, i] = playerFrame();
      ctx.save();
      if (g.dodge && set === 'run') { ctx.translate(sx(g.x), sy(g.y)); ctx.scale(1.12, .78); ctx.translate(-sx(g.x), -sy(g.y)); }
      else if ((set === 'motion' && i < 4 || set === 'run' && !g.dodge) && g.plat && !reducedMotion.matches) {
        const phase = g.stride * Math.PI * 2, amount = g.runBlend;
        const lift = Math.pow(Math.sin(phase), 2) * 4 * amount;
        const squash = Math.cos(phase * 2) * .025 * amount;
        ctx.translate(sx(g.x), sy(g.y) - lift * S);
        ctx.rotate(g.face * Math.sin(phase) * .018 * amount + g.lean);
        ctx.scale(1 - squash * .5, 1 + squash); ctx.translate(-sx(g.x), -sy(g.y));
      }
      spr(imgs[set][i], M[set], g.x, g.y, GS, g.face < 0, 1, g.dodge || g.dodgeGrace > 0 ? 'rgba(120,235,255,.35)' : null);
      ctx.restore();
    }
    if (g.hammer) {
      const h = g.hammer;
      ctx.save(); ctx.translate(sx(h.x), sy(h.y));
      if (!reducedMotion.matches) ctx.rotate(h.t * 23 * h.dir);
      ctx.shadowColor = '#ffe28a'; ctx.shadowBlur = 12;
      ctx.drawImage(imgs.hammer, -32 * S, -38 * S, 64 * S, 76 * S); ctx.restore();
    }
    if (g.charge !== null && (isTouch() ? touchAimed() : g.charge >= CHARGE_DELAY)) {
      const aim = aimDirection(), power = isTouch() ? window.touchAim.mag : Math.min(1, (g.charge - CHARGE_DELAY) / (CHARGE_FULL - CHARGE_DELAY));
      const ox = sx(g.x), oy = sy(g.y - 85), length = (160 + 110 * power) * S;
      const tx = ox + aim.x * length, ty = oy + aim.y * length;
      ctx.save(); ctx.strokeStyle = '#ffe28a'; ctx.lineWidth = 3; ctx.setLineDash([8, 7]);
      ctx.beginPath(); ctx.moveTo(ox + aim.x * 55 * S, oy + aim.y * 55 * S); ctx.lineTo(tx, ty); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(tx, ty, 10, 0, Math.PI * 2); ctx.moveTo(tx - 15, ty); ctx.lineTo(tx + 15, ty); ctx.moveTo(tx, ty - 15); ctx.lineTo(tx, ty + 15); ctx.stroke();
      const by = sy(g.y - 210); ctx.fillStyle = '#102b20'; ctx.fillRect(ox - 40, by, 80, 10);
      ctx.fillStyle = power >= 1 ? '#baffad' : '#ffe28a'; ctx.fillRect(ox - 37, by + 3, 74 * power, 4);
      ctx.font = "700 16px 'Fredoka',sans-serif"; ctx.textAlign = 'center'; outline(ctx, isTouch() ? 'SOLTE PARA LANÇAR' : 'MIRE E SOLTE C', ox, by - 13, '#fff3b0', 4); ctx.restore();
    }
    // arco do martelo
    if (g.atk) {
      const a = ATK[g.atk.type], t = g.atk.t - a.wind;
      if (t >= 0 && t < a.act + 0.12) {
        const p = Math.min(1, t / (a.act + 0.12)), f = g.face, x = sx(g.x + f * 40), y = sy(g.y - 80);
        ctx.save(); ctx.globalAlpha = 0.75 * (1 - p); ctx.strokeStyle = '#fff'; ctx.lineCap = 'round'; ctx.lineWidth = 12 * (1 - p) + 3;
        const R = (g.atk.type === 'B' ? 125 : 105) * S, a0 = g.atk.type === 'B' ? -Math.PI * 0.95 : -Math.PI * 0.75, a1 = g.atk.type === 'B' ? Math.PI * 0.1 : Math.PI * 0.3;
        ctx.beginPath(); ctx.arc(x, y, R, f > 0 ? a0 + (a1 - a0) * p * 0.3 : Math.PI - a1, f > 0 ? a0 + (a1 - a0) * p : Math.PI - (a0 + (a1 - a0) * p * 0.3), f < 0); ctx.stroke(); ctx.restore();
      }
    }
    if (debug) {
      const ab = atkBox(); ctx.lineWidth = 2;
      if (ab) { ctx.strokeStyle = 'red'; ctx.strokeRect(sx(ab.x0), sy(ab.y0), (ab.x1 - ab.x0) * S, (ab.y1 - ab.y0) * S); }
      const pb = pBox(); ctx.strokeStyle = 'cyan'; ctx.strokeRect(sx(pb.x0), sy(pb.y0), (pb.x1 - pb.x0) * S, (pb.y1 - pb.y0) * S);
      if (g.boss) { const hb = bossHurtbox(); ctx.strokeStyle = 'yellow'; ctx.strokeRect(sx(hb.x0), sy(hb.y0), (hb.x1 - hb.x0) * S, (hb.y1 - hb.y0) * S); }
    }
    // aura de cura do Genésio
    if (g.heal) {
      const h = g.heal, a = Math.min(1, h.t / .3) * Math.min(1, Math.max(0, (h.dur + .05 - h.t) / .45));
      const px = sx(g.x), py = sy(g.y - 62), pu = .8 + .2 * Math.sin(g.t * 12);
      const hg = ctx.createRadialGradient(px, py, 12 * S, px, py, 120 * S); hg.addColorStop(0, `rgba(190,255,215,${.5 * a * pu})`); hg.addColorStop(.6, `rgba(120,255,170,${.28 * a})`); hg.addColorStop(1, 'rgba(120,255,170,0)');
      ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(px, py, 120 * S, 0, 6.3); ctx.fill();
      for (let i = 0; i < 2; i++) { const q = ((h.t * 1.6 + i * .5) % 1); ctx.strokeStyle = `rgba(190,255,215,${.6 * a * (1 - q)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(px, sy(g.y - 6), (20 + q * 90) * S, (6 + q * 22) * S, 0, 0, 6.3); ctx.stroke(); }
      ctx.fillStyle = `rgba(150,255,190,${.07 * a})`; ctx.fillRect(0, 0, VW, VH);
    }
    // chuva de pregos
    if (g.rain) {
      const r = g.rain, b = g.boss, fade = Math.min(1, r.t / .25) * Math.min(1, Math.max(0, (RAIN_DUR + .3 - r.t) / .3));
      ctx.fillStyle = `rgba(6,12,28,${.26 * fade})`; ctx.fillRect(0, 0, VW, VH);
      const gl = ctx.createRadialGradient(sx(b.x), sy(GY - 170), 20, sx(b.x), sy(GY - 170), 360 * S);
      gl.addColorStop(0, `rgba(190,220,255,${.32 * fade})`); gl.addColorStop(1, 'rgba(190,220,255,0)'); ctx.fillStyle = gl; ctx.fillRect(0, 0, VW, VH);
      const nw = 38 * S * 1.25, nh = nw * imgs.nail.height / imgs.nail.width;
      for (const h of r.hammers) {
        const x = sx(h.x), y = sy(h.y);
        if (h.st === 'fall') {
          ctx.save(); ctx.globalAlpha = .4; ctx.strokeStyle = '#dff0ff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x, y - nh - 90 * S); ctx.lineTo(x, y - nh); ctx.stroke(); ctx.restore();
          ctx.save(); ctx.translate(x, y); ctx.rotate(h.rot); ctx.shadowColor = '#cfe6ff'; ctx.shadowBlur = 14;
          ctx.drawImage(imgs.nail, -nw / 2, -nh, nw, nh); ctx.restore();
        } else if (h.st === 'done' && h.sT < .55) {                 // fica cravado no golem e some
          ctx.save(); ctx.globalAlpha = Math.max(0, 1 - h.sT / .55); ctx.translate(x, y); ctx.rotate(h.rot);
          const sw = imgs.nail.width, sh = imgs.nail.height * .55;       // só a parte de cima aparece: a ponta entrou
          ctx.drawImage(imgs.nail, 0, 0, sw, sh, -nw / 2, -nh * .62, nw, nh * .55); ctx.restore();
        }
      }
      // escudo dourado em volta do Genésio: ele está imune
      const px = sx(g.x), py = sy(g.y - 62), pu = .75 + .25 * Math.sin(g.t * 14);
      const sg = ctx.createRadialGradient(px, py, 30 * S, px, py, 105 * S); sg.addColorStop(0, `rgba(255,236,150,${.1 * pu})`); sg.addColorStop(.8, `rgba(255,220,90,${.45 * pu})`); sg.addColorStop(1, 'rgba(255,220,90,0)');
      ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(px, py, 105 * S, 0, 6.3); ctx.fill();
      ctx.strokeStyle = `rgba(255,240,170,${.7 * pu})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(px, py, 78 * S, 0, 6.3); ctx.stroke();
    }
    // partículas
    for (const p of g.parts) {
      const a = Math.max(0, 1 - p.t / p.life), x = sx(p.x), y = sy(p.y);
      ctx.save(); ctx.globalAlpha = p.k === 'dust' ? a * 0.55 : Math.min(1, a * 2); ctx.translate(x, y);
      if (p.k === 'piece') { const im = imgs.part[p.img], k = .5 * S; ctx.rotate(p.rot); if (p.flip) ctx.scale(-1, 1); ctx.drawImage(im, -im.width * k / 2, -im.height * k / 2, im.width * k, im.height * k); }
      else if (p.k === 'dust') { ctx.fillStyle = '#e8d8b0'; ctx.beginPath(); ctx.arc(0, 0, p.s * S, 0, 6.3); ctx.fill(); }
      else if (p.k === 'dirt') { ctx.rotate(p.rot); ctx.fillStyle = ['#6b4a2b', '#8a5e34', '#4d3320'][p.c]; ctx.fillRect(-p.s * S / 2, -p.s * S / 2, p.s * S, p.s * S * 0.8); }
      else if (p.k === 'rock') { ctx.rotate(p.rot); ctx.fillStyle = ['#8a8a92', '#6c6c74', '#a4a4ac'][p.c]; ctx.strokeStyle = '#2a2a30'; ctx.lineWidth = 2; ctx.beginPath(); for (let i = 0; i < 5; i++) { const an = i / 5 * 6.283, r = p.s * S * (i % 2 ? .6 : 1); ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r); } ctx.closePath(); ctx.fill(); ctx.stroke(); }
      else if (p.k === 'heal') { const q = p.s * 6 * S; ctx.fillStyle = '#b8ffcf'; ctx.strokeStyle = '#1d6b3c'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.rect(-q * .3, -q, q * .6, q * 2); ctx.rect(-q, -q * .3, q * 2, q * .6); ctx.fill(); ctx.stroke(); }
      else if (p.k === 'healHeart') { const q = 26 * p.s * S; ctx.drawImage(imgs.heart, -q / 2, -q / 2, q, q * imgs.heart.height / imgs.heart.width); }
      else if (p.k === 'star') { ctx.rotate(p.rot); ctx.fillStyle = '#ffe66b'; ctx.strokeStyle = '#8a5a0c'; ctx.lineWidth = 1.5; ctx.beginPath(); for (let i = 0; i < 8; i++) { const an = i / 8 * 6.283, r = p.s * S * (i % 2 ? .4 : 1); ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r); } ctx.closePath(); ctx.fill(); ctx.stroke(); }
      ctx.restore();
    }
    // textos flutuantes
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = "700 24px 'Fredoka',sans-serif";
    for (const p of g.popups) {
      ctx.globalAlpha = Math.max(0, 1 - p.t / 1.2); ctx.lineWidth = 5; ctx.strokeStyle = '#08150f'; ctx.fillStyle = p.color;
      const x = Math.min(VW - 60, Math.max(60, sx(p.x))), y = sy(p.y) - p.t * 40;
      ctx.strokeText(p.text, x, y); ctx.fillText(p.text, x, y);
    }
    ctx.globalAlpha = 1;
    // clarão de tela (impactos / rugido)
    if (g.flash > 0) { ctx.fillStyle = `rgba(255,248,220,${Math.min(reducedMotion.matches ? 0.12 : 0.45, g.flash)})`; ctx.fillRect(0, 0, VW, VH); }
    // vinheta de perigo no rugido
    if (g.boss && (g.boss.st === 'roar' || g.boss.st === 'p2roar')) { const gr = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.35, VW / 2, VH / 2, VH * 0.95); gr.addColorStop(0, 'rgba(120,20,0,0)'); gr.addColorStop(1, 'rgba(120,20,0,.4)'); ctx.fillStyle = gr; ctx.fillRect(0, 0, VW, VH); }

    drawHud(ctx);
  }

  function outline(ctx, t, x, y, fill, w) { ctx.lineWidth = w || 6; ctx.strokeStyle = '#08150f'; ctx.fillStyle = fill || '#fff'; ctx.strokeText(t, x, y); ctx.fillText(t, x, y); }
  function drawHud(ctx) {
    for (let i = 0; i < MAXHP; i++) {
      const im = i < g.hp ? imgs.heart : imgs.heartEmpty, pt = g.pulse && g.pulse[i] !== undefined ? Math.max(0, 1 - (g.t - g.pulse[i]) / .4) : 0, k = 1 + .55 * pt, w = 34 * k, h = 34 * im.height / im.width * k;
      if (pt > 0) { ctx.save(); ctx.shadowColor = '#b8ffcf'; ctx.shadowBlur = 16 * pt; }
      ctx.drawImage(im, 84 + i * 38 + 17 - w / 2, 20 + 17 * im.height / im.width - h / 2, w, h);
      if (pt > 0) ctx.restore();
    }
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = "700 15px 'Fredoka',sans-serif";
    outline(ctx, g.dodge || g.dodgeGrace > 0 ? 'IMUNE' : g.dodgeCd > 0 ? `Esquiva: ${g.dodgeCd.toFixed(1)}s` : (isTouch() ? 'Esquiva pronta' : 'Shift · esquiva pronta'), 84, 72, g.dodge || g.dodgeGrace > 0 ? '#9ff3ff' : '#fff', 4);
    outline(ctx, g.hammer ? 'Martelo voltando' : (isTouch() ? 'Lançar: toque · arraste para mirar' : 'C · lançar   Segure C + mouse · mirar'), 84, 94, '#fff3b0', 4);
    {                                                                // capacete / especial
      const ready = g.special, live = canRain(), pulse = live ? .7 + .3 * Math.sin(g.t * 7) : 1;
      ctx.save(); ctx.globalAlpha = ready ? 1 : .32;
      if (!ready) ctx.filter = 'grayscale(1)';
      ctx.drawImage(imgs.nailBox, 84, 102, 40, 40 * imgs.nailBox.height / imgs.nailBox.width); ctx.filter = 'none'; ctx.restore();
      ctx.textAlign = 'left'; ctx.font = "700 15px 'Fredoka',sans-serif";
      outline(ctx, ready ? (live ? (isTouch() ? 'CHUVA DE PREGOS!' : 'F · CHUVA DE PREGOS!') : (isTouch() ? 'Chuva de pregos (no boss)' : 'F · chuva de pregos (no boss)')) : 'Pegue a caixa de pregos', 130, 124, ready ? (live ? `rgba(255,226,120,${pulse})` : '#fff3b0') : '#ccc', 4);
    }
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    const fr = imgs.fly[Math.floor(g.animT * 12) % 8], k0 = 0.24;
    ctx.drawImage(fr, VW - 150 - fr.width * k0, 16, fr.width * k0, fr.height * k0);
    ctx.font = "700 30px 'Fredoka',sans-serif"; outline(ctx, `× ${g.kills}`, VW - 24, 38, '#9ff3ff');
    ctx.font = "700 16px 'Fredoka',sans-serif"; outline(ctx, `🪙 ${getCoins()}`, VW - 24, 68, '#fff3b0', 4);
    // barra de vida do boss
    if (g.boss && g.bossBar > 0.02) {
      const b = g.boss, w = 680, h = 30, x = (VW - w) / 2, y = 38 - (1 - g.bossBar) * 90, r = Math.max(0, b.hp / BOSS_HP);
      ctx.save(); ctx.globalAlpha = Math.min(1, g.bossBar * 1.4);
      ctx.fillStyle = '#17120a'; ctx.beginPath(); ctx.roundRect(x - 6, y - 6, w + 12, h + 12, 12); ctx.fill();
      ctx.strokeStyle = '#f2b632'; ctx.lineWidth = 3; ctx.stroke();
      ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.clip();
      ctx.fillStyle = '#3a1410'; ctx.fillRect(x, y, w, h);
      const gr = ctx.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, b.p2 ? '#ff7a3a' : '#f0503c'); gr.addColorStop(1, b.p2 ? '#b8300a' : '#a3201a');
      ctx.fillStyle = gr; ctx.fillRect(x, y, w * r, h);
      ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(x, y, w * r, h * 0.35);
      if (b.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(x, y, w * r, h); }
      ctx.restore();
      ctx.textAlign = 'center'; ctx.font = "700 18px 'Fredoka',sans-serif"; outline(ctx, 'GOLEM DEMOLIDOR', VW / 2, y + h + 22, '#ffd36b', 4);
      ctx.restore();
    }
    // título da luta
    if (g.titleT >= 0 && g.titleT < 3.2 && !g.talking) {
      const t = g.titleT, a = t < 0.3 ? t / 0.3 : t > 2.6 ? Math.max(0, (3.2 - t) / 0.6) : 1, sc = reducedMotion.matches ? 1 : 1 + Math.max(0, 0.3 - t) * 2;
      ctx.save(); ctx.globalAlpha = a; ctx.translate(VW / 2, 250); ctx.scale(sc, sc); ctx.textAlign = 'center';
      ctx.font = "700 92px 'Fredoka',sans-serif"; outline(ctx, 'GOLEM DEMOLIDOR', 0, 0, '#ffcf3a', 14);
      ctx.font = "700 28px 'Fredoka',sans-serif"; outline(ctx, 'Derrote-o para concluir a fase!', 0, 52, '#fff', 6);
      ctx.restore();
    }
    // abertura da fase
    if (g.phase === 'victory') {
      ctx.save(); ctx.textAlign = 'center'; ctx.font = "700 64px 'Fredoka',sans-serif";
      outline(ctx, 'BOSQUE LIBERADO!', VW / 2, 210, '#d9ffb0', 10);
      ctx.font = "700 26px 'Fredoka',sans-serif"; outline(ctx, 'Genésio venceu o Golem Demolidor!', VW / 2, 266, '#fff', 5); ctx.restore();
    }
    if (g.phase === 'ready') {
      const t = g.phaseT, a = t < 0.4 ? t / 0.4 : t > 2.4 ? Math.max(0, (3 - t) / 0.6) : 1;
      ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.font = "700 76px 'Fredoka',sans-serif"; outline(ctx, 'SOLAR DO BOSQUE', VW / 2, 170, '#d9ffb0', 12);
      ctx.font = "700 24px 'Fredoka',sans-serif"; outline(ctx, isTouch() ? 'Joystick mover · botões: pular, bater, esquivar' : 'A / D mover · Shift esquivar · Espaço pular', VW / 2, 224, '#fff', 5);
      ctx.font = "700 22px 'Fredoka',sans-serif"; outline(ctx, isTouch() ? 'Pegue a caixa de pregos e use o botão Pregos no boss' : 'J / clique: bater · C: lançar o martelo · pegue a caixa de pregos: F no boss', VW / 2, 259, '#fff3b0', 5); ctx.restore();
    }
  }

  return {
    load, start, stop, update, draw, togglePause, primary, restartAll,
    isRunning: () => running, canRain, leave, canExit: () => !!g && g.ended && g.phase === 'win', setDebug: v => { debug = v; }, _debug: () => g, WORLD_W, PITCH, ARENA_TRIGGER, GY, PLATS, cleared,
  };
})();

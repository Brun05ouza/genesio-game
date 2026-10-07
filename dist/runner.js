// Fase "Oásis Residencial": corrida infinita estilo jogo do dinossauro do Chrome.
// O Genésio corre sozinho; pula (Espaço / W / ↑ / clique) para desviar de cactos e martelos.
// Moedas (G alado) dão pontos; o capacete é um buff que ignora 2 batidas.
const Runner = (() => {
  const DIFFS = {
    facil:   { label: 'Fácil',   lives: 5, v0: 320, vmax: 520, accel: 7,  step: 30, vtop: 820,  gap: [1.1, 2.0],  maxCluster: 2, bigChance: 0.4,  hammerChance: 0.2,  hammerHigh: false, helmetEvery: [4500, 7000], heartEvery: [6500, 9500] },
    normal:  { label: 'Normal',  lives: 3, v0: 420, vmax: 700, accel: 11, step: 40, vtop: 1050, gap: [0.95, 1.7], maxCluster: 2, bigChance: 0.5,  hammerChance: 0.28, hammerHigh: true,  helmetEvery: [6000, 9000], heartEvery: [6500, 9500] },
    dificil: { label: 'Difícil', lives: 2, v0: 520, vmax: 900, accel: 15, step: 50, vtop: 1300, gap: [0.8, 1.4],  maxCluster: 3, bigChance: 0.55, hammerChance: 0.35, hammerHigh: true,  helmetEvery: [7500, 11000], heartEvery: [5000, 8000] },
  };
  const VW = 1280, VH = 720;
  const S = VH / 941;                 // escala da imagem do cenário (1672x941) para a tela
  const FEET = 738 * S;               // linha do chão: face de cima da faixa de terra da imagem
  const BG_H = 724 * S;               // altura da camada de fundo; abaixo dela começa o chão
  const PX = 260;                     // posição horizontal do Genésio
  const GRAV = 3200, JUMP = 1150;
  const COIN_PTS = 50;
  const FRAMES = { idle: 1, run: 13, hurt: 4, die: 4, jump: 5, fly: 8, hrun: 13, hjump: 5, pickup: 5, lose: 5, heart: 5, hheart: 5 };
  const SCALE = { idle: 0.75, run: 1.05, hurt: 1.4, die: 1.4, jump: 1.45, hrun: 1.05, hjump: 1.45, pickup: 1, lose: 1, heart: 1, hheart: 1 };
  const DIR = 'fase-nova-igua%C3%A7u/oasis/';
  const el = id => document.getElementById(id);

  let imgs = null, loading = null;
  let g = null;           // estado da partida
  let running = false;    // há uma partida na tela

  function load() {
    if (imgs) return Promise.resolve();
    if (loading) return loading;
    const get = Loader.img;
    imgs = { frames: {} };
    const jobs = [
      get(DIR + 'bg.webp').then(i => imgs.bg = i),
      get(DIR + 'ground.webp').then(i => imgs.ground = i),
      get(DIR + 'cactus_big.webp').then(i => imgs.cactus = i),
      get(DIR + 'hammer.webp').then(i => imgs.hammer = i),
      get(DIR + 'helmet.webp').then(i => imgs.helmet = i),
      get(DIR + 'heart.webp').then(i => imgs.heart = i),
      get(DIR + 'heart_empty.webp').then(i => imgs.heartEmpty = i),
    ];
    for (const [name, n] of Object.entries(FRAMES)) {
      imgs.frames[name] = [];
      for (let i = 0; i < n; i++) jobs.push(get(`frames/${name}${i}.webp`).then(im => imgs.frames[name][i] = im));
    }
    return loading = Promise.all(jobs).catch(e => { imgs = null; loading = null; throw e; });
  }

  const bestKey = d => 'genesio-best-' + d;
  const getBest = d => { try { return +localStorage.getItem(bestKey(d)) || 0; } catch (e) { return 0; } };
  const setBest = (d, v) => { try { localStorage.setItem(bestKey(d), v); } catch (e) {} };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const points = () => Math.floor(g.dist / 10) + g.bonus;
  // velocidade cresce com os pontos: no começo acelera até vmax e, a cada LEVEL_PTS pontos, sobe mais `step` (até vtop)
  const LEVEL_PTS = 500;
  const speedLevel = () => Math.floor(points() / LEVEL_PTS);
  const targetSpeed = () => Math.min(g.d.vtop, g.d.vmax + g.d.step * speedLevel());

  function newGame(diffKey) {
    const d = DIFFS[diffKey];
    g = {
      key: diffKey, d, speed: d.v0, scroll: 0, dist: 0,
      lives: d.lives, z: 0, vz: 0, obst: [], nextGap: 700,
      phase: 'ready', readyT: 0, goT: 0, hurtT: 0, invul: 0, deadT: 0, animT: 0,
      helmet: 0, fx: null, bonus: 0, coins: 0, popups: [], coinGap: 1200, helmetAt: rnd(2500, 3500), heartAt: rnd(d.heartEvery[0], d.heartEvery[1]),
      paused: false, best: getBest(diffKey), newRecord: false,
    };
    hideOverlay();
  }

  async function start(diffKey) {
    await load();
    newGame(diffKey);
    running = true;
  }

  // ---- overlay (pausa / fim de jogo) ----
  function showOverlay(kind) {
    el('rTitle').textContent = kind === 'over' ? 'Fim de jogo' : 'Pausado';
    el('rInfo').innerHTML = kind === 'over'
      ? `Pontos: <b>${points()}</b> · Moedas: <b>${g.coins}</b><br>Recorde (${g.d.label}): <b>${g.best}</b>${g.newRecord ? ' 🏆 novo!' : ''}`
      : `Dificuldade: <b>${g.d.label}</b>`;
    el('rPrimary').textContent = kind === 'over' ? 'Jogar de novo' : 'Continuar';
    el('rPrimary').dataset.kind = kind;
    el('rOverlay').classList.add('active');
  }
  function hideOverlay() { el('rOverlay').classList.remove('active'); }

  function togglePause() {
    if (!running || g.phase === 'over') return;
    g.paused = !g.paused;
    g.paused ? showOverlay('pause') : hideOverlay();
  }
  function primary() {
    if (el('rPrimary').dataset.kind === 'over') { newGame(g.key); } else { g.paused = false; hideOverlay(); }
  }
  function stop() { running = false; hideOverlay(); unload(); }
  // libera as imagens da fase ao sair (no celular várias fases abertas em sequência estouravam a memória)
  function unload() { imgs = null; loading = null; }

  // ---- nascimento de objetos ----
  const isHazard = o => !o.coin && !o.item;
  // há algo (do tipo dado) perto da borda direita, onde os objetos nascem?
  const spawnBusy = (pred, from = VW - 260) => g.obst.some(o => pred(o) && o.x + o.w > from);

  function spawn() {
    const d = g.d;
    if (spawnBusy(o => !isHazard(o), VW - 40)) { g.nextGap = 90; return; }   // não nasce em cima de moeda/item
    // martelo arremessado (só depois dos primeiros ~150 pontos): vem da direita, descendo em arco
    if (g.dist > 1500 && Math.random() < d.hammerChance) {
      const high = d.hammerHigh && Math.random() < 0.5;
      g.obst.push({ hammer: true, high, x: VW + 80, x0: VW + 80, w: 60, h: 60, yStart: FEET - 330, yEnd: FEET - (high ? 180 : 52), rot: 0 });
      g.nextGap = 180 + g.speed * rnd(d.gap[0], d.gap[1]);
      return;
    }
    let parts;
    if (Math.random() < d.bigChance) { parts = [{ s: 0.75 }]; }
    else {
      const n = 1 + Math.floor(Math.random() * d.maxCluster);
      parts = Array.from({ length: n }, (_, i) => ({ s: 0.5 + (i % 2) * 0.04 }));
    }
    let x = 0;
    for (const p of parts) { p.w = imgs.cactus.width * p.s; p.h = imgs.cactus.height * p.s; p.x = x; x += p.w + 6; }
    const w = x - 6, h = Math.max(...parts.map(p => p.h));
    g.obst.push({ x: VW + 80, w, h, parts });
    g.nextGap = w + g.speed * rnd(d.gap[0], d.gap[1]);
  }

  // grupo de moedas (G alado): as baixas pegam-se correndo, as altas exigem pular
  function spawnCoins() {
    if (spawnBusy(isHazard, VW - 300) || spawnBusy(o => o.item, VW - 200)) { g.coinGap = 80; return; }
    const n = 1 + Math.floor(Math.random() * 3), high = Math.random() < 0.5;
    for (let i = 0; i < n; i++)
      g.obst.push({ coin: true, x: VW + 90 + i * 74, w: 62, h: 50, cy: FEET - (high ? 175 : 62), phase: Math.random() * 6 });
    g.coinGap = rnd(1000, 1900);
  }

  function spawnHelmet() {
    if (spawnBusy(o => !o.item, VW - 320)) return;       // espera uma brecha livre (sem obstáculo nem moeda)
    g.obst.push({ item: true, kind: 'helmet', x: VW + 90, w: 70, h: 60, cy: FEET - 78, phase: Math.random() * 6 });
    g.helmetAt = Infinity;
  }

  // coração: devolve uma vida (só aparece quando falta vida)
  function spawnHeart() {
    if (g.lives >= g.d.lives) { g.heartAt = g.dist + 1500; return; }
    if (spawnBusy(o => true, VW - 320)) return;
    g.obst.push({ item: true, kind: 'heart', x: VW + 90, w: 56, h: 52, cy: FEET - 78, phase: Math.random() * 6 });
    g.heartAt = Infinity;
  }

  // ---- animações especiais (pegar / perder / bloquear com o capacete) ----
  function startFx(kind) {
    g.fx = { kind, t: 0, dur: { pickup: 1.35, lose: 1.5, block: 0.45, heart: 1.1 }[kind] };
    if (kind !== 'block') { g.z = 0; g.vz = 0; }
  }
  function endFx() {
    const k = g.fx.kind;
    if (k === 'pickup') { g.helmet = 2; g.invul = Math.max(g.invul, 1.0); }
    if (k === 'heart') {
      g.lives = Math.min(g.d.lives, g.lives + 1); g.invul = Math.max(g.invul, 0.8);
      g.heartAt = g.dist + rnd(g.d.heartEvery[0], g.d.heartEvery[1]);
    }
    if (k === 'lose') { g.invul = Math.max(g.invul, 1.4); g.helmetAt = g.dist + rnd(g.d.helmetEvery[0], g.d.helmetEvery[1]); }
    g.fx = null;
  }
  const popup = (text, x, y, color = '#fff3b0') => g.popups.push({ text, x, y, t: 0, color });

  function hit(o) {
    g.obst.splice(g.obst.indexOf(o), 1);
    if (g.helmet > 0) {                      // o capacete ignora o dano
      g.helmet--;
      Sound.block();
      popup(g.helmet > 0 ? 'BLOQUEOU!' : 'CAPACETE PERDIDO!', PX, FEET - g.z - 190, g.helmet > 0 ? '#fff3b0' : '#ffb0a0');
      g.invul = Math.max(g.invul, 1.0);
      startFx(g.helmet > 0 ? 'block' : 'lose');
      return;
    }
    g.lives--;
    if (g.lives <= 0) { g.phase = 'dying'; g.deadT = 0; Sound.die(); }
    else { g.hurtT = 0.6; g.invul = 1.6; Sound.hit(); }
  }

  function finish() {
    g.phase = 'over';
    const score = points();
    if (score > g.best) { g.best = score; g.newRecord = true; setBest(g.key, score); }
    showOverlay('over');
  }

  // posição do martelo na tela: desce em arco da direita até a altura do Genésio
  function hammerPos(o) {
    const s = Math.max(0, (o.x0 - o.x) / (o.x0 - PX));
    const sc = Math.min(s, 1);
    const y = o.yStart + (o.yEnd - o.yStart) * (s < 1 ? sc : 1 + (s - 1) * 0.35) - Math.sin(Math.PI * sc) * 90;
    return { x: o.x + o.w / 2, y };
  }

  // ---- lógica ----
  function update(dt) {
    if (!running || g.paused || g.phase === 'over') return;
    g.animT += dt;
    if (g.phase === 'ready') {
      g.readyT += dt;
      if (g.readyT >= 2.4) { g.phase = 'run'; g.goT = 0.7; }
      return;
    }
    if (g.goT > 0) g.goT -= dt;
    if (g.hurtT > 0) g.hurtT -= dt;
    if (g.invul > 0) g.invul -= dt;
    for (const p of g.popups) p.t += dt;
    g.popups = g.popups.filter(p => p.t < 1.1);

    const fxKind = g.fx && g.fx.kind;
    if (g.fx) { g.fx.t += dt; if (g.fx.t >= g.fx.dur) endFx(); }

    // velocidade efetiva (desacelera ao tomar dano / morrer; o mundo congela ao pegar o capacete)
    let f = 1;
    if (g.hurtT > 0) f = 0.4;
    const frozen = fxKind === 'pickup' || fxKind === 'heart';
    if (frozen) f = 0;
    else if (fxKind === 'lose') f = 0.25;
    if (g.phase === 'dying') { g.deadT += dt; f = Math.max(0, 1 - g.deadT / 0.5); }
    else if (f > 0) {
      const lv = speedLevel();
      if (lv > (g.level || 0)) {                                   // subiu de nível: avisa (até chegar no máximo)
        g.level = lv;
        if (g.speed < g.d.vtop - 1) { popup('MAIS RÁPIDO!', PX + 120, FEET - 230, '#ffd166'); Sound.coin(); }
      }
      g.speed = Math.min(targetSpeed(), g.speed + g.d.accel * (g.speed < g.d.vmax ? 1 : 2.5) * dt);
    }
    const dx = g.speed * f * dt;
    g.scroll += dx; g.dist += dx;

    // pulo
    const locked = g.hurtT > 0 || frozen || fxKind === 'lose';
    const wantJump = keys.Space || keys.KeyW || keys.ArrowUp || jumpTap;
    if (wantJump && g.z === 0 && g.phase === 'run' && !locked) { g.vz = JUMP; g.z = 0.01; Sound.jump(); }
    if (g.z > 0 && !locked) {
      g.vz -= GRAV * dt; g.z += g.vz * dt;
      if (g.z <= 0) { g.z = 0; g.vz = 0; Sound.land(); }
    }
    jumpTap = false;

    // movimento dos objetos
    for (const o of g.obst) {
      o.x -= dx;
      if (o.hammer) {   // arremessado: além da rolagem do mundo, vem com velocidade própria e gira
        o.x -= 230 * f * dt;
        o.rot -= 11 * dt * (f > 0 ? 1 : 0);
      }
    }
    g.obst = g.obst.filter(o => {
      const gone = o.x + o.w < -80;
      if (gone && o.item) {                                        // item que passou: tenta de novo mais tarde
        if (o.kind === 'heart') g.heartAt = g.dist + rnd(1500, 3000); else g.helmetAt = g.dist + rnd(1200, 2500);
      }
      return !gone;
    });

    if (g.phase !== 'run') { if (g.phase === 'dying' && g.deadT > 1.5) finish(); return; }

    // nascimentos
    g.nextGap -= dx; g.coinGap -= dx;
    if (g.nextGap <= 0) spawn();
    if (g.coinGap <= 0) spawnCoins();
    if (!g.helmet && !g.fx && g.dist >= g.helmetAt) spawnHelmet();
    if (!g.fx && g.dist >= g.heartAt) spawnHeart();

    // colisões
    const pl = PX - 26, pr = PX + 26, pb = FEET - g.z, pt = pb - 105;
    for (const o of [...g.obst]) {
      if (o.coin || o.item) {                         // coletáveis
        if (frozen) continue;
        const cy = o.cy + Math.sin(g.animT * 5 + o.phase) * 6;
        if (pr > o.x + 6 && pl < o.x + o.w - 6 && pb > cy - o.h / 2 && pt < cy + o.h / 2) {
          g.obst.splice(g.obst.indexOf(o), 1);
          if (o.coin) { g.bonus += COIN_PTS; g.coins++; Sound.coin(); popup('+' + COIN_PTS, o.x + o.w / 2, cy - 20); }
          else if (o.kind === 'heart') { Sound.power(); popup('+1 VIDA', PX, FEET - g.z - 190, '#ffb0b8'); startFx('heart'); }
          else { Sound.power(); popup('CAPACETE!', PX, FEET - g.z - 190); startFx('pickup'); }
        }
        continue;
      }
      if (g.invul > 0 || frozen) continue;
      if (o.hammer) {                                  // martelo: círculo em volta do centro
        const c = hammerPos(o), rad = 26;
        const nx = Math.max(pl, Math.min(c.x, pr)), ny = Math.max(pt, Math.min(c.y, pb));
        if (Math.hypot(c.x - nx, c.y - ny) < rad) { hit(o); break; }
        continue;
      }
      const ol = o.x + o.w * 0.15, or = o.x + o.w * 0.85, ot = FEET - o.h * 0.88;
      if (pr > ol && pl < or && pb > ot && pt < FEET) { hit(o); break; }
    }
  }

  // ---- desenho ----
  function tileLayer(ctx, img, scroll, y, h) {
    const w = img.width * (h / img.height);          // mantém proporção
    const off = ((scroll % (2 * w)) + 2 * w) % (2 * w);
    for (let k = 0; k * w - off < VW; k++) {
      const x = Math.floor(k * w - off);
      if (k % 2 === 0) ctx.drawImage(img, x, y, Math.ceil(w) + 1, h);
      else { // cópia espelhada: as emendas ficam contínuas
        ctx.save(); ctx.translate(x + Math.ceil(w) + 1, 0); ctx.scale(-1, 1);
        ctx.drawImage(img, 0, y, Math.ceil(w) + 1, h); ctx.restore();
      }
    }
  }

  function playerFrame() {
    if (g.phase === 'dying') return ['die', Math.min(3, Math.floor(g.deadT / 0.3))];
    if (g.fx && g.fx.kind !== 'block') {
      const n = 5, i = Math.min(n - 1, Math.floor(g.fx.t / g.fx.dur * n));
      return [g.fx.kind === 'heart' ? (g.helmet > 0 ? 'hheart' : 'heart') : g.fx.kind, i];
    }
    if (g.hurtT > 0) return ['hurt', Math.min(3, Math.floor((0.6 - g.hurtT) / 0.15))];     // cai e se levanta
    if (g.phase === 'ready') return ['idle', 0];
    const h = g.helmet > 0;
    // bloqueou uma batida: capacete balança, cara de susto (quadro 2 da sequência de perder o capacete)
    if (g.fx && g.fx.kind === 'block' && g.z === 0) return ['lose', 1];
    // com capacete: mesmos movimentos do Genésio normal (correr / pular), só que com o capacete na cabeça
    const pre = h ? 'h' : '';
    if (g.z > 0) {
      const p = g.vz > 250 ? 1 : g.vz > -250 ? 2 : 3;
      return [pre + 'jump', g.z < 14 ? (g.vz > 0 ? 0 : 4) : p];
    }
    return [pre + 'run', Math.floor(g.animT * (7 + g.speed / 70) * 13 / 4 * 0.5) % 13];
  }

  function drawObjects(ctx) {
    for (const o of g.obst) {
      if (o.coin) {                                   // moeda: G alado batendo as asas
        const cy = o.cy + Math.sin(g.animT * 5 + o.phase) * 6, cx = o.x + o.w / 2;
        const fr = imgs.frames.fly[Math.floor(g.animT * 12 + o.phase * 3) % 8];
        const k = 0.55;
        const gl = ctx.createRadialGradient(cx, cy, 4, cx, cy, 46);
        gl.addColorStop(0, 'rgba(120,255,255,.45)'); gl.addColorStop(1, 'rgba(120,255,255,0)');
        ctx.fillStyle = gl; ctx.fillRect(cx - 50, cy - 50, 100, 100);
        ctx.drawImage(fr, cx - fr.width * k / 2, cy - fr.height * k / 2, fr.width * k, fr.height * k);
        continue;
      }
      if (o.item) {                                   // item flutuando: capacete ou coração
        const cy = o.cy + Math.sin(g.animT * 5 + o.phase) * 7, cx = o.x + o.w / 2;
        const heart = o.kind === 'heart', img = heart ? imgs.heart : imgs.helmet;
        const gl = ctx.createRadialGradient(cx, cy, 6, cx, cy, 58);
        gl.addColorStop(0, heart ? 'rgba(255,90,110,.6)' : 'rgba(255,230,90,.65)');
        gl.addColorStop(1, heart ? 'rgba(255,90,110,0)' : 'rgba(255,230,90,0)');
        ctx.fillStyle = gl; ctx.fillRect(cx - 60, cy - 60, 120, 120);
        ctx.fillStyle = 'rgba(60,25,5,.22)';
        ctx.beginPath(); ctx.ellipse(cx, FEET - 2, 24, 5, 0, 0, Math.PI * 2); ctx.fill();
        const hh = o.w * img.height / img.width;
        ctx.drawImage(img, cx - o.w / 2, cy - hh / 2, o.w, hh);
        ctx.fillStyle = '#fffbe0';                    // brilhinhos girando
        for (let i = 0; i < 3; i++) { const an = g.animT * 3 + i * 2.1; ctx.fillRect(cx + Math.cos(an) * 40 - 2, cy + Math.sin(an) * 32 - 2, 4, 4); }
        continue;
      }
      if (o.hammer) {                                 // martelo girando em arco
        const c = hammerPos(o), sz = 78;
        const up = Math.max(0.3, 1 - (FEET - c.y) / 320);
        ctx.fillStyle = 'rgba(60,25,5,.22)';
        ctx.beginPath(); ctx.ellipse(c.x, FEET - 2, 26 * up, 5 * up, 0, 0, Math.PI * 2); ctx.fill();
        ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(o.rot);
        ctx.drawImage(imgs.hammer, -sz / 2, -sz / 2, sz, sz * imgs.hammer.height / imgs.hammer.width);
        ctx.restore();
        continue;
      }
      ctx.fillStyle = 'rgba(60,25,5,.25)';            // cactos: base exatamente na linha do chão
      ctx.beginPath(); ctx.ellipse(o.x + o.w / 2, FEET - 2, o.w * 0.55, 6, 0, 0, Math.PI * 2); ctx.fill();
      for (const p of o.parts) ctx.drawImage(imgs.cactus, o.x + p.x, FEET - p.h, p.w, p.h);
    }
  }

  function draw(ctx) {
    if (!running) return;
    ctx.fillStyle = '#7ec8ff'; ctx.fillRect(0, 0, VW, VH);
    tileLayer(ctx, imgs.bg, g.scroll * 0.12, 0, BG_H);
    // sol fixo no céu
    const sx = 1010, sy = 150;
    const grd = ctx.createRadialGradient(sx, sy, 10, sx, sy, 130);
    grd.addColorStop(0, 'rgba(255,246,200,.9)'); grd.addColorStop(0.45, 'rgba(255,240,180,.35)'); grd.addColorStop(1, 'rgba(255,240,180,0)');
    ctx.fillStyle = grd; ctx.fillRect(sx - 140, sy - 140, 280, 280);
    ctx.fillStyle = '#fff1b8'; ctx.beginPath(); ctx.arc(sx, sy, 54, 0, Math.PI * 2); ctx.fill();
    tileLayer(ctx, imgs.ground, g.scroll, BG_H, VH - BG_H);

    // sombra
    const sh = 1 - Math.min(g.z / 400, 0.5);
    ctx.fillStyle = 'rgba(60,25,5,.28)';
    ctx.beginPath(); ctx.ellipse(PX, FEET - 2, 38 * sh, 8 * sh, 0, 0, Math.PI * 2); ctx.fill();

    drawObjects(ctx);

    // Genésio
    const blink = g.invul > 0 && g.hurtT <= 0 && !g.fx && g.phase === 'run' && Math.floor(g.invul * 12) % 2 === 0;
    if (!blink) {
      const [anim, i] = playerFrame();
      const im = imgs.frames[anim][i], sc = SCALE[anim];
      const w = im.width * sc, h = im.height * sc;
      if (g.fx && (g.fx.kind === 'pickup' || g.fx.kind === 'heart')) {   // brilho durante a "evolução" / cura
        const gl = ctx.createRadialGradient(PX, FEET - 80, 10, PX, FEET - 80, 150);
        const a = 0.35 + 0.25 * Math.sin(g.fx.t * 14);
        const col = g.fx.kind === 'heart' ? '255,110,130' : '255,225,90';
        gl.addColorStop(0, `rgba(${col},${a})`); gl.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = gl; ctx.fillRect(PX - 160, FEET - 240, 320, 320);
      }
      ctx.drawImage(im, PX - w / 2, FEET - g.z - h, w, h);
    }

    // HUD
    for (let i = 0; i < g.d.lives; i++) {
      const im = i < g.lives ? imgs.heart : imgs.heartEmpty;
      ctx.drawImage(im, 84 + i * 38, 20, 34, 34 * im.height / im.width);
    }
    if (g.helmet > 0) {                                // capacete: um ícone por batida restante
      for (let i = 0; i < 2; i++) {
        ctx.globalAlpha = i < g.helmet ? 1 : 0.28;
        ctx.drawImage(imgs.helmet, 86 + i * 44, 64, 38, 38 * imgs.helmet.height / imgs.helmet.width);
      }
      ctx.globalAlpha = 1;
    }
    ctx.textBaseline = 'middle'; ctx.textAlign = 'right';
    ctx.font = "700 30px 'Fredoka', sans-serif";
    const score = String(points()).padStart(5, '0');
    ctx.lineWidth = 5; ctx.strokeStyle = '#08150f'; ctx.fillStyle = '#fff';
    ctx.strokeText('Pontos ' + score, VW - 24, 36); ctx.fillText('Pontos ' + score, VW - 24, 36);
    ctx.font = "700 18px 'Fredoka', sans-serif";
    const rec = `${g.d.label} · Recorde ${Math.max(g.best, points())} · Moedas ${g.coins}`;
    ctx.lineWidth = 4; ctx.strokeText(rec, VW - 24, 68); ctx.fillText(rec, VW - 24, 68);

    // textos flutuantes
    ctx.textAlign = 'center'; ctx.font = "700 26px 'Fredoka', sans-serif";
    for (const p of g.popups) {
      ctx.globalAlpha = Math.max(0, 1 - p.t / 1.1);
      ctx.lineWidth = 6; ctx.strokeStyle = '#08150f'; ctx.fillStyle = p.color;
      const py = p.y - p.t * 50;
      ctx.strokeText(p.text, p.x, py); ctx.fillText(p.text, p.x, py);
    }
    ctx.globalAlpha = 1;

    // contagem inicial
    let msg = null;
    if (g.phase === 'ready') msg = g.readyT < 0.6 ? 'Prepare-se!' : g.readyT < 1.2 ? '3' : g.readyT < 1.8 ? '2' : '1';
    else if (g.goT > 0) msg = 'VAI!';
    if (msg) {
      ctx.textAlign = 'center'; ctx.font = "700 84px 'Fredoka', sans-serif";
      ctx.lineWidth = 10; ctx.strokeStyle = '#08150f'; ctx.fillStyle = '#fff3b0';
      ctx.strokeText(msg, VW / 2, 190); ctx.fillText(msg, VW / 2, 190);
    }
    if (g.phase === 'ready' && g.readyT < 1.2) {
      ctx.font = "700 22px 'Fredoka', sans-serif"; ctx.lineWidth = 5; ctx.fillStyle = '#fff';
      const t = 'Espaço / W / ↑ para pular · pegue as moedas e o capacete';
      ctx.strokeText(t, VW / 2, 250); ctx.fillText(t, VW / 2, 250);
    }
  }

  // toque / clique na tela também pula
  let jumpTap = false;
  document.getElementById('c').addEventListener('pointerdown', () => { if (running) jumpTap = true; });

  return {
    DIFFS, load, start, stop, update, draw, togglePause, primary,
    isRunning: () => running,
    restart: () => { newGame(g.key); },
    bests: () => Object.fromEntries(Object.keys(DIFFS).map(k => [k, getBest(k)])),
    _debug: () => g,
  };
})();

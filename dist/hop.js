// Nature · Desafio 3: Subida infinita (estilo Pou / Doodle Jump).
// O Genésio pula sozinho. Horizontal: teclado/joystick; vertical: inclinação com botões de apoio.
// A mesma paisagem acompanha toda a subida, desde a primeira plataforma.
const Hop = (() => {
  let VW = 1280, VH = 720, W = 1672, S = VW / W, VIEW_H = VH / S, mode = 'horizontal';
  const GRAV = 1800, BOUNCE_H = 260, V0 = Math.sqrt(2 * GRAV * BOUNCE_H), SPEED = 360;
  const PX_PER_PT = 25, COINS_PER_PTS = 10;
  const RISE_BASE = 28, RISE_MAX = 92, GRACE = 3;
  const FRAMES = { jump: 5, die: 4 };
  const SC = 0.78;                                                         // escala do sprite (mesma proporção dos outros desafios)
  const el = id => document.getElementById(id);

  let imgs = null, loading = null, g = null, running = false;

  function load() {
    if (imgs) return Promise.resolve();
    if (loading) return loading;
    const get = Loader.img;
    imgs = { frames: {} };
    const jobs = [get('fase-teresopolis/nature/hop-background.webp').then(im => imgs.background = im), get('fase-teresopolis/nature/hop-platform.webp').then(im => imgs.platform = im)];
    for (const [name, n] of Object.entries(FRAMES)) {
      imgs.frames[name] = [];
      for (let i = 0; i < n; i++) jobs.push(get(`frames/${name}${i}.webp`).then(im => imgs.frames[name][i] = im));
    }
    return loading = Promise.all(jobs).catch(e => { imgs = null; loading = null; throw e; });
  }

  // Permissão solicitada pelo botão de escolha, dentro do gesto do usuário (Safari/iOS).
  let tiltStatus = 'off', neutral = null, tiltDir = 0, lastTilt = 0;
  function calibrate() { neutral = null; tiltDir = 0; lastTilt = 0; }
  function waitingOrientation() {
    return document.body.classList.contains('touch') && (mode === 'vertical' ? innerWidth > innerHeight : innerHeight > innerWidth);
  }
  function orientation(e) {
    if (!running || mode !== 'vertical' || g.paused || document.hidden || state !== 'hplay' || waitingOrientation() || !Number.isFinite(e.gamma)) return;
    const angle = screen.orientation?.angle ?? window.orientation ?? 0;
    const gamma = angle === 180 ? -e.gamma : e.gamma;
    if (neutral === null) neutral = gamma;
    const delta = gamma - neutral;
    tiltDir = Math.abs(delta) <= 3 ? 0 : Math.sign(delta) * Math.min(1, (Math.abs(delta) - 3) / 19);
    lastTilt = performance.now(); tiltStatus = 'ready';
  }
  async function enableTilt() {
    calibrate(); window.removeEventListener('deviceorientation', orientation);
    if (!window.isSecureContext || typeof DeviceOrientationEvent === 'undefined') { tiltStatus = 'unavailable'; return; }
    tiltStatus = 'waiting';
    try {
      if (typeof DeviceOrientationEvent.requestPermission === 'function' && await DeviceOrientationEvent.requestPermission() !== 'granted') {
        tiltStatus = 'denied'; return;
      }
      window.addEventListener('deviceorientation', orientation);
    } catch (e) { tiltStatus = 'denied'; }
  }
  function setMode(next) {
    mode = next === 'vertical' ? 'vertical' : 'horizontal';
    VW = mode === 'vertical' ? 720 : 1280; VH = mode === 'vertical' ? 1280 : 720;
    W = mode === 'vertical' ? 940 : 1672; S = VW / W; VIEW_H = VH / S;
    fitViewport();
    calibrate();
  }
  function fitViewport() {
    if (mode !== 'vertical') return;
    const old = VIEW_H;
    // Preenche celulares longos (19.5:9, 20:9...) mantendo o tamanho dos sprites e das plataformas.
    VH = document.body.classList.contains('touch') ? Math.round(720 * Math.max(innerWidth, innerHeight) / Math.min(innerWidth, innerHeight)) : 1280;
    VIEW_H = VH / S;
    if (running && g) g.cam += (old - VIEW_H) * 0.42;
  }
  const tiltHint = () => tiltStatus === 'ready' ? 'Incline para mover · setas também funcionam'
    : tiltStatus === 'denied' ? 'Movimento não autorizado. Use os botões.'
    : tiltStatus === 'unavailable' ? 'Inclinação indisponível. Use os botões.'
    : 'Segure confortável e incline · ou use os botões';
  addEventListener('orientationchange', calibrate);
  screen.orientation?.addEventListener('change', calibrate);
  addEventListener('blur', calibrate);
  document.addEventListener('visibilitychange', calibrate);

  // ---- dados salvos ----
  const COINS_KEY = 'genesio-coins', BEST_KEY = 'genesio-hop-best';
  const getCoins = () => { try { return +localStorage.getItem(COINS_KEY) || 0; } catch (e) { return 0; } };
  const addCoins = n => { try { localStorage.setItem(COINS_KEY, getCoins() + n); } catch (e) {} };
  const getBest = () => { try { return +localStorage.getItem(BEST_KEY) || 0; } catch (e) { return 0; } };
  const setBest = v => { try { localStorage.setItem(BEST_KEY, v); } catch (e) {} };

  // ---- alcance do salto (usado para garantir que sempre existe caminho entre um segmento e o próximo) ----
  const gapX = (a, b) => {
    const gp = Math.max(0, Math.max(a.x0, b.x0) - Math.min(a.x1, b.x1));
    const wp = Math.max(0, W - Math.max(a.x1, b.x1) + Math.min(a.x0, b.x0));
    return Math.min(gp, wp);
  };
  function canHop(a, b) {
    const up = a.y - b.y;
    if (up <= 0 || up > BOUNCE_H - 25) return false;
    const t = (V0 + Math.sqrt(Math.max(0, V0 * V0 - 2 * GRAV * up))) / GRAV;
    // A interseção de todas as posições possíveis garante alcance mesmo no extremo do movimento.
    const safe = p => ({ x0: (p.home0 ?? p.x0) + (p.amplitude || 0), x1: (p.home1 ?? p.x1) - (p.amplitude || 0) });
    return gapX(safe(a), safe(b)) <= SPEED * t - 55;
  }

  // ---- mundo ----
  let segs = [], plats = [], anchor = null, serial = 0;
  function addSegment() {
    if (!segs.length) {
      anchor = { x0: W / 2 - 150, x1: W / 2 + 150, y: 0, step: true, route: true, serial: 0 };
      plats = [anchor];
      segs.push({ name: 'upper', base: 0, h: 100 });
      return;
    }
    const bottom = anchor.y;
    // Uma cadeia contínua substitui os pilares de emenda e as ilhas sem conexão.
    // No alto há menos apoios laterais e degraus mais espaçados, sempre dentro do salto.
    while (bottom - anchor.y < 800) {
      const height = Math.max(0, -anchor.y), difficulty = Math.min(1, height / 8000);
      const width = 225 - 65 * difficulty, gap = 140 + 55 * difficulty + Math.random() * 15;
      const cx = (anchor.x0 + anchor.x1) / 2;
      const direction = Math.random() < 0.5 ? -1 : 1;
      const nextX = Math.max(140, Math.min(W - 140, cx + direction * (170 + Math.random() * 110)));
      const p = { x0: nextX - width / 2, x1: nextX + width / 2, y: anchor.y - gap, step: true, route: true, serial: ++serial };
      if (height > 1100 && serial % 4 === 0) {
        p.home0 = p.x0; p.home1 = p.x1; p.amplitude = 25 + 15 * difficulty;
        p.phase = Math.random() * Math.PI * 2; p.omega = 0.85 + 0.3 * difficulty;
      }
      if (!canHop(anchor, p)) { p.x0 = cx - width / 2; p.x1 = cx + width / 2; if (p.amplitude) { p.home0 = p.x0; p.home1 = p.x1; } }
      plats.push(p); anchor = p;
      const extraEvery = height < 2500 ? 2 : height < 5000 ? 4 : 7;
      if (serial % extraEvery === 0) {
        const bx = Math.max(90, Math.min(W - 90, nextX - direction * 330));
        plats.push({ x0: bx - 85, x1: bx + 85, y: p.y + 65, step: true });
      }
    }
    segs.push({ name: 'upper', base: anchor.y - 100, h: bottom - anchor.y + 100 });
  }
  const ensureWorld = upTo => { while (segs.length === 0 || segs[segs.length - 1].base > upTo) addSegment(); };
  function prune() {
    const lim = g.cam + VIEW_H + 400;
    plats = plats.filter(p => p.y < lim);
    segs = segs.filter((s, i) => s.base < lim || i === segs.length - 1);
  }

  // ---- partida ----
  function newGame() {
    segs = []; plats = []; anchor = null; serial = 0;
    ensureWorld(-VIEW_H * 3);
    const ground = plats[0]; calibrate();
    g = {
      x: W / 2, y: ground.y, vx: 0, vy: -V0, facing: 1, animT: 0, sinceBounce: 0, cam: -VIEW_H * 0.8, t: 0, startY: ground.y,
      minY: ground.y, phase: 'play', dead: false, deadT: 0, paused: false, popups: [], newRecord: false, coinsEarned: 0, lastMilestone: 0,
    };
    hideOverlay();
  }
  async function start() {
    document.body.classList.toggle('hop-vertical', mode === 'vertical');
    try { await load(); newGame(); running = true; }
    catch (e) { unload(); throw e; } // mantém orientação e permissão para ler o erro e tentar novamente
  }
  function stop() {
    running = false; hideOverlay(); unload(); calibrate(); tiltStatus = 'off';
    window.removeEventListener('deviceorientation', orientation);
    document.body.classList.remove('hop-vertical');
  }
  // libera as imagens da fase ao sair (no celular várias fases abertas em sequência estouravam a memória)
  function unload() { imgs = null; loading = null; }
  const points = () => Math.max(0, Math.floor((g.startY - g.minY) / PX_PER_PT));
  const riseSpeed = () => Math.min(RISE_MAX, RISE_BASE + points() * 0.18);

  // ---- telas ----
  function hideOverlay() { el('hOverlay').classList.remove('active'); }
  function showOverlay(kind) {
    el('hSettings').hidden = kind !== 'pause';
    el('hCalibrate').hidden = kind !== 'pause' || mode !== 'vertical';
    el('hTiltInfo').hidden = mode !== 'vertical';
    el('hTiltInfo').textContent = mode === 'vertical' ? tiltHint() : '';
    const p = points();
    el('hTitle').textContent = kind === 'pause' ? 'Pausado' : 'Você caiu!';
    el('hPrimary').textContent = kind === 'pause' ? 'Continuar' : 'Subir de novo';
    el('hPrimary').dataset.kind = kind;
    el('hInfo').innerHTML = kind === 'pause'
      ? `Pontos: <b>${p}</b> · Recorde: <b>${Math.max(getBest(), p)}</b>`
      : `Pontos: <b>${p}</b> · Recorde: <b>${getBest()}</b>${g.newRecord ? ' 🏆 novo!' : ''}<br>🪙 <b>+${g.coinsEarned} GenesisCoins</b> <small>(1 a cada ${COINS_PER_PTS} pontos)</small>`;
    el('hOverlay').classList.add('active');
  }
  function togglePause() {
    if (!running || g.phase === 'end') return;
    g.paused = !g.paused;
    calibrate();
    g.paused ? showOverlay('pause') : hideOverlay();
  }
  function primary() { if (el('hPrimary').dataset.kind === 'pause') { g.paused = false; calibrate(); hideOverlay(); } else newGame(); }
  function finish() {
    g.phase = 'end';
    const p = points();
    g.newRecord = p > getBest();
    if (g.newRecord) setBest(p);
    g.coinsEarned = Math.floor(p / COINS_PER_PTS);
    addCoins(g.coinsEarned);
    showOverlay('over');
  }

  // ---- física ----
  const popup = (text, x, y, color) => g.popups.push({ text, x, y, t: 0, color: color || '#fff3b0' });
  function update(dt) {
    // Integração curta evita atravessar plataformas e mantém o salto igual em 30/60/144 Hz.
    let remaining = Math.min(dt, 0.1);
    while (remaining > 0) { const step = Math.min(remaining, 1 / 120); tick(step); remaining -= step; }
  }
  function tick(dt) {
    if (!running || g.paused || waitingOrientation() || document.hidden) return;
    g.animT += dt;
    for (const p of g.popups) p.t += dt;
    g.popups = g.popups.filter(p => p.t < 1.2);
    if (g.phase === 'end') return;
    if (g.dead) { g.deadT += dt; g.vy += GRAV * dt; g.y += g.vy * dt; if (g.deadT > 1.1) finish(); return; }
    g.t += dt; g.sinceBounce += dt;
    for (const p of plats) if (p.amplitude) {
      const offset = Math.sin(g.t * p.omega + p.phase) * p.amplitude;
      p.x0 = p.home0 + offset; p.x1 = p.home1 + offset;
    }

    // controle lateral (só A/D ou setas), com atravessar a borda da tela
    const manual = ((keys.KeyD || keys.ArrowRight) ? 1 : 0) - ((keys.KeyA || keys.ArrowLeft) ? 1 : 0);
    const dir = manual || (mode === 'vertical' && performance.now() - lastTilt < 700 ? tiltDir : 0);
    const target = dir * SPEED;
    g.vx += (target - g.vx) * (1 - Math.exp(-dt * 12));
    if (dir) g.facing = Math.sign(dir);
    g.x = ((g.x + g.vx * dt) % W + W) % W;

    // vertical + pouso (só pousa caindo)
    const prevY = g.y;
    g.y += g.vy * dt + GRAV * dt * dt / 2; g.vy += GRAV * dt;
    if (g.vy > 0) {
      let best = null;
      for (const p of plats) if (prevY <= p.y + 2 && g.y >= p.y && g.x >= p.x0 - 6 && g.x <= p.x1 + 6 && (!best || p.y < best.y)) best = p;
      if (best) { g.y = best.y; g.vy = -V0; g.sinceBounce = 0; Sound.jump(); }
    }
    if (g.y < g.minY) g.minY = g.y;

    // câmera: sobe sozinha e acelera; também acompanha quando o Genésio vai mais alto
    if (g.t >= GRACE) g.cam -= riseSpeed() * dt;
    const follow = g.y - VIEW_H * 0.42;
    if (follow < g.cam) g.cam += (follow - g.cam) * (1 - Math.exp(-dt * 8));
    ensureWorld(g.cam - 1500); prune();

    const m = Math.floor(points() / 50);
    if (m > g.lastMilestone) { g.lastMilestone = m; popup(m * 50 + ' pontos!', g.x, g.y - 140); Sound.coin(); }

    if (g.y > g.cam + VIEW_H + 30) { g.dead = true; g.deadT = 0; g.vy = -300; Sound.die(); }   // caiu para fora da tela
  }

  // ---- desenho ----
  const sy = y => (y - g.cam) * S;
  function outlined(ctx, text, x, y, fill, w) {
    ctx.lineWidth = w || 6; ctx.strokeStyle = '#08150f'; ctx.fillStyle = fill || '#fff';
    ctx.strokeText(text, x, y); ctx.fillText(text, x, y);
  }
  function stepIsland(ctx, p) {                         // ilha de apoio desenhada no mesmo estilo (grama + terra + folhas)
    const x0 = p.x0 * S, w = (p.x1 - p.x0) * S, y = sy(p.y), im = imgs.platform;
    const iw = w / 0.83, ih = iw * im.height / im.width;
    // Margens transparentes da ilustração: superfície de grama em 37% da altura.
    ctx.drawImage(im, x0 - iw * 0.085, y - ih * 0.37, iw, ih);
    if (p.amplitude) {
      ctx.strokeStyle = '#e4ffad'; ctx.lineWidth = 2; ctx.beginPath();
      for (const dir of [-1, 1]) { const cx = x0 + w / 2 + dir * 16; ctx.moveTo(cx - dir * 5, y + 17); ctx.lineTo(cx, y + 13); ctx.lineTo(cx - dir * 5, y + 9); }
      ctx.stroke();
    }
  }
  function frame() {
    if (g.dead) return ['die', Math.min(3, Math.floor(g.deadT / 0.25))];
    if (g.sinceBounce < 0.09) return ['jump', 0];
    return ['jump', g.vy < -330 ? 1 : g.vy < 260 ? 2 : 3];
  }

  function draw(ctx) {
    if (!running) return;
    // Uma paisagem contínua, sem distorção na vertical nem emendas de mapas.
    const bg = imgs.background, scale = Math.max(VW / bg.width, (VH + 40) / bg.height);
    const bw = bg.width * scale, bh = bg.height * scale;
    ctx.drawImage(bg, (VW - bw) / 2, (VH - bh) / 2 + Math.sin(g.cam / 1500) * 12, bw, bh);
    for (const p of plats) if (p.step) stepIsland(ctx, p);

    // Genésio (com cópia do outro lado quando atravessa a borda)
    const [anim, i] = frame(), im = imgs.frames[anim][i], w = im.width * SC, h = im.height * SC;
    const squash = g.sinceBounce < 0.09 ? 0.9 : 1;
    const draw1 = fx => {
      ctx.save();
      if (g.facing < 0) { ctx.translate(fx, 0); ctx.scale(-1, 1); ctx.translate(-fx, 0); }
      ctx.drawImage(im, fx - w / 2, sy(g.y) - h * squash, w, h * squash);
      ctx.restore();
    };
    const fx = g.x * S;
    draw1(fx);
    if (fx < w) draw1(fx + VW); else if (fx > VW - w) draw1(fx - VW);

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = "700 24px 'Fredoka', sans-serif";
    for (const p of g.popups) {
      ctx.globalAlpha = Math.max(0, 1 - p.t / 1.2);
      outlined(ctx, p.text, Math.min(VW - 90, Math.max(90, p.x * S)), sy(p.y) - p.t * 40, p.color, 5);
    }
    ctx.globalAlpha = 1;

    // HUD
    ctx.font = "700 40px 'Fredoka', sans-serif";
    outlined(ctx, `⬆ ${points()}`, VW / 2, 40, '#fff', 7);
    ctx.font = `700 ${mode === 'vertical' ? 24 : 17}px 'Fredoka', sans-serif`;
    outlined(ctx, `Recorde ${Math.max(getBest(), points())}`, VW / 2, 71, '#d9ffb0', 4);
    ctx.textAlign = 'right'; ctx.font = `700 ${mode === 'vertical' ? 26 : 18}px 'Fredoka', sans-serif`;
    outlined(ctx, `🪙 ${getCoins()}`, VW - 24, 36, '#fff3b0', 4);
    const sp = riseSpeed() / RISE_MAX;                     // medidor de quão rápido o cenário está subindo
    ctx.fillStyle = 'rgba(8,21,15,.6)'; ctx.fillRect(VW - 150, 52, 126, 10);
    ctx.fillStyle = sp > 0.8 ? '#ff6b57' : sp > 0.45 ? '#ffd36b' : '#7be08d'; ctx.fillRect(VW - 150, 52, 126 * sp, 10);
    ctx.font = `700 ${mode === 'vertical' ? 18 : 13}px 'Fredoka', sans-serif`; outlined(ctx, 'velocidade', VW - 24, 76, '#fff', 3);
    if (mode === 'vertical') {
      ctx.textAlign = 'center'; ctx.font = "700 23px 'Fredoka', sans-serif";
      outlined(ctx, tiltHint(), VW / 2, VH - 220, '#fff3b0', 5);
    }

    if (g.t < 3.2 && !g.dead) {
      ctx.textAlign = 'center'; ctx.font = "700 40px 'Fredoka', sans-serif";
      ctx.globalAlpha = Math.min(1, (3.2 - g.t));
      outlined(ctx, 'Suba pelas plataformas!', VW / 2, 190, '#fff3b0', 8);
      ctx.font = "700 22px 'Fredoka', sans-serif";
      outlined(ctx, mode === 'vertical' ? 'Incline para os lados ou toque nas setas' : 'A / D ou ← / → para mover · se cair da tela, acabou', VW / 2, 236, '#fff', 5);
      if (mode === 'vertical') outlined(ctx, 'Se cair da tela, acabou!', VW / 2, 271, '#fff', 5);
      ctx.globalAlpha = 1;
    }
  }

  return {
    load, start, stop, update, draw, togglePause, primary, best: getBest, coins: getCoins,
    isRunning: () => running, restart: newGame, _debug: () => g, _plats: () => plats, _segs: () => segs, canHop, V0, GRAV, SPEED,
    setMode, enableTilt, calibrate, waitingOrientation, fitViewport, get mode() { return mode; }, get W() { return W; },
    get width() { return VW; }, get height() { return VH; },
    get tiltStatus() { return tiltStatus; },
  };
})();

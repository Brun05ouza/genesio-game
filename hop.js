// Nature · Desafio 3: Subida infinita (estilo Pou / Doodle Jump).
// O Genésio pula sozinho; você só controla para os lados (A/D ou ←/→). O cenário sobe cada vez mais rápido:
// se ele cair para fora da tela, acabou. O chão só existe no começo; acima dele as plataformas nunca acabam.
const Hop = (() => {
  const VW = 1280, VH = 720, S = VH / 941, VIEW_H = 941, W = 1672;
  const GRAV = 1800, BOUNCE_H = 260, V0 = Math.sqrt(2 * GRAV * BOUNCE_H), SPEED = 360;
  const PX_PER_PT = 25, FADE = 50, COINS_PER_PTS = 10;
  const RISE_BASE = 32, RISE_GROW = 0.9, RISE_MAX = 105, GRACE = 3;      // velocidade com que o cenário sobe (px/s) e tempo de folga
  const SEGS = HOPDATA.segs, NAMES = ['h1', 'h2', 'h3', 'h4', 'h5'];
  const FRAMES = { jump: 5, die: 4 };
  const SC = 0.78;                                                         // escala do sprite (mesma proporção dos outros desafios)
  const el = id => document.getElementById(id);

  let imgs = null, loading = null, g = null, running = false;

  function load() {
    if (imgs) return Promise.resolve();
    if (loading) return loading;
    const get = Loader.img;
    imgs = { frames: {}, seg: {} };
    const jobs = [];
    for (const n of Object.keys(SEGS)) jobs.push(get(`fase-teresopolis/nature/hop_${n}.jpg`).then(im => {
      const s = SEGS[n], h = s.bot - s.top;
      const make = mirror => {                          // recorte; a borda de baixo se dissolve sobre o segmento de baixo (exceto o inicial)
        const c = document.createElement('canvas'); c.width = W; c.height = h;
        const x = c.getContext('2d');
        if (mirror) { x.translate(W, 0); x.scale(-1, 1); }
        x.drawImage(im, 0, 0);
        x.setTransform(1, 0, 0, 1, 0, 0);
        if (n !== 'h0') {
          x.globalCompositeOperation = 'destination-out';
          const gr = x.createLinearGradient(0, h - FADE, 0, h);
          gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,1)');
          x.fillStyle = gr; x.fillRect(0, h - FADE, W, FADE);
        }
        return c;
      };
      imgs.seg[n] = [make(false), make(true)];
    }));
    for (const [name, n] of Object.entries(FRAMES)) {
      imgs.frames[name] = [];
      for (let i = 0; i < n; i++) jobs.push(get(`frames/${name}${i}.png`).then(im => imgs.frames[name][i] = im));
    }
    return loading = Promise.all(jobs).catch(e => { imgs = null; loading = null; throw e; });
  }

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
    if (up > BOUNCE_H - 25) return false;
    const t = (V0 + Math.sqrt(Math.max(0, V0 * V0 - 2 * GRAV * up))) / GRAV;
    return gapX(a, b) <= SPEED * t - 25;
  }
  const wrapDelta = (xa, xb) => { let d = xb - xa; if (d > W / 2) d -= W; if (d < -W / 2) d += W; return d; };

  // ---- mundo ----
  let segs = [], plats = [], lastName = null;
  function addSegment() {
    const first = segs.length === 0;
    let name, base;
    if (first) { name = 'h0'; base = -(SEGS.h0.bot - SEGS.h0.top); }
    else {
      const opts = NAMES.filter(n => n !== lastName);
      name = opts[Math.floor(Math.random() * opts.length)];
      base = segs[segs.length - 1].base + FADE - (SEGS[name].bot - SEGS[name].top);
    }
    const s = SEGS[name], mk = m => s.plats.map(p => ({ x0: m ? W - p[1] : p[0], x1: m ? W - p[0] : p[1], y: base + p[2] }));
    let mirror = false, list = mk(false);
    if (!first) {
      const prevTop = plats.slice().sort((a, b) => a.y - b.y).slice(0, 4);
      const works = L => { const low = L.slice().sort((a, b) => b.y - a.y).slice(0, 3); return prevTop.some(a => low.some(b => canHop(a, b))); };
      const order = Math.random() < 0.5 ? [false, true] : [true, false];
      let ok = false;
      for (const m of order) { const L = mk(m); if (works(L)) { mirror = m; list = L; ok = true; break; } }
      if (!ok) {                                         // nenhuma opção liga: cria ilhas de apoio entre a mais alta de baixo e a mais baixa de cima
        mirror = order[0]; list = mk(mirror);
        const A = prevTop[0], B = list.slice().sort((a, b) => b.y - a.y)[0];
        const ca = (A.x0 + A.x1) / 2, cb = (B.x0 + B.x1) / 2, d = wrapDelta(ca, cb), n = Math.max(2, Math.ceil(Math.abs(d) / 230));
        for (let i = 1; i < n; i++) {
          const cx = ((ca + d * i / n) % W + W) % W, y = A.y + (B.y - A.y) * i / n;
          plats.push({ x0: Math.max(0, cx - 70), x1: Math.min(W, cx + 70), y, step: true });
        }
      }
    }
    for (const p of list) plats.push(p);
    segs.push({ name, base, h: s.bot - s.top, mirror });
    lastName = name;
  }
  const ensureWorld = upTo => { while (segs.length === 0 || segs[segs.length - 1].base > upTo) addSegment(); };
  function prune() {
    const lim = g.cam + VIEW_H + 400;
    plats = plats.filter(p => p.y < lim);
    segs = segs.filter((s, i) => s.base < lim || i === segs.length - 1);
  }

  // ---- partida ----
  function newGame() {
    segs = []; plats = []; lastName = null;
    ensureWorld(-VIEW_H * 3);
    const ground = plats.find(p => p.x0 === 0 && p.x1 === W);
    g = {
      x: 836, y: ground.y, vx: 0, vy: -V0, facing: 1, animT: 0, sinceBounce: 0, cam: -VIEW_H, t: 0, startY: ground.y,
      minY: ground.y, phase: 'play', dead: false, deadT: 0, paused: false, popups: [], newRecord: false, coinsEarned: 0, lastMilestone: 0,
    };
    hideOverlay();
  }
  async function start() { await load(); newGame(); running = true; }
  function stop() { running = false; hideOverlay(); unload(); }
  // libera as imagens da fase ao sair (no celular várias fases abertas em sequência estouravam a memória)
  function unload() { imgs = null; loading = null; }
  const points = () => Math.max(0, Math.floor((g.startY - g.minY) / PX_PER_PT));
  const riseSpeed = () => Math.min(RISE_MAX, RISE_BASE + RISE_GROW * Math.max(0, g.t - GRACE));

  // ---- telas ----
  function hideOverlay() { el('hOverlay').classList.remove('active'); }
  function showOverlay(kind) {
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
    g.paused ? showOverlay('pause') : hideOverlay();
  }
  function primary() { if (el('hPrimary').dataset.kind === 'pause') { g.paused = false; hideOverlay(); } else newGame(); }
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
    if (!running || g.paused) return;
    g.animT += dt;
    for (const p of g.popups) p.t += dt;
    g.popups = g.popups.filter(p => p.t < 1.2);
    if (g.phase === 'end') return;
    if (g.dead) { g.deadT += dt; g.vy += GRAV * dt; g.y += g.vy * dt; if (g.deadT > 1.1) finish(); return; }
    g.t += dt; g.sinceBounce += dt;

    // controle lateral (só A/D ou setas), com atravessar a borda da tela
    const dir = ((keys.KeyD || keys.ArrowRight) ? 1 : 0) - ((keys.KeyA || keys.ArrowLeft) ? 1 : 0);
    const target = dir * SPEED;
    g.vx += (target - g.vx) * Math.min(1, dt * 12);
    if (dir) g.facing = dir;
    g.x = ((g.x + g.vx * dt) % W + W) % W;

    // vertical + pouso (só pousa caindo)
    const prevY = g.y;
    g.vy += GRAV * dt; g.y += g.vy * dt;
    if (g.vy > 0) {
      let best = null;
      for (const p of plats) if (prevY <= p.y + 2 && g.y >= p.y && g.x >= p.x0 - 6 && g.x <= p.x1 + 6 && (!best || p.y < best.y)) best = p;
      if (best) { g.y = best.y; g.vy = -V0; g.sinceBounce = 0; Sound.jump(); }
    }
    if (g.y < g.minY) g.minY = g.y;

    // câmera: sobe sozinha e acelera; também acompanha quando o Genésio vai mais alto
    g.cam -= riseSpeed() * dt * (g.t < GRACE ? 0.3 : 1);
    const follow = g.y - VIEW_H * 0.42;
    if (follow < g.cam) g.cam = follow;
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
    const x0 = p.x0 * S, w = (p.x1 - p.x0) * S, y = sy(p.y), h = 34 * S * 1.6;
    ctx.fillStyle = '#7a4a23'; ctx.strokeStyle = '#2a1608'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(x0 + 3, y + 5); ctx.quadraticCurveTo(x0 + w / 2, y + h * 1.7, x0 + w - 3, y + 5); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#7ad22a'; ctx.beginPath(); ctx.roundRect(x0, y - 4, w, 12, 5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#4d9a19'; for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.ellipse(x0 + w * i / 5, y - 7, 5, 8, 0.3 * (i - 2), 0, Math.PI * 2); ctx.fill(); }
  }
  function frame() {
    if (g.dead) return ['die', Math.min(3, Math.floor(g.deadT / 0.25))];
    if (g.sinceBounce < 0.09) return ['jump', 0];
    return ['jump', g.vy < -330 ? 1 : g.vy < 260 ? 2 : 3];
  }

  function draw(ctx) {
    if (!running) return;
    ctx.fillStyle = '#4fa8e8'; ctx.fillRect(0, 0, VW, VH);
    for (const s of segs) {                               // cenários empilhados
      const c = imgs.seg[s.name][s.mirror ? 1 : 0], y0 = sy(s.base), h = c.height * S;
      if (y0 > VH || y0 + h < 0) continue;
      ctx.drawImage(c, 0, y0, VW, h + 1);
    }
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
    ctx.font = "700 17px 'Fredoka', sans-serif";
    outlined(ctx, `Recorde ${Math.max(getBest(), points())}`, VW / 2, 71, '#d9ffb0', 4);
    ctx.textAlign = 'right'; ctx.font = "700 18px 'Fredoka', sans-serif";
    outlined(ctx, `🪙 ${getCoins()}`, VW - 24, 36, '#fff3b0', 4);
    const sp = riseSpeed() / RISE_MAX;                     // medidor de quão rápido o cenário está subindo
    ctx.fillStyle = 'rgba(8,21,15,.6)'; ctx.fillRect(VW - 150, 52, 126, 10);
    ctx.fillStyle = sp > 0.8 ? '#ff6b57' : sp > 0.45 ? '#ffd36b' : '#7be08d'; ctx.fillRect(VW - 150, 52, 126 * sp, 10);
    ctx.font = "700 13px 'Fredoka', sans-serif"; outlined(ctx, 'velocidade', VW - 24, 76, '#fff', 3);

    if (g.t < 3.2 && !g.dead) {
      ctx.textAlign = 'center'; ctx.font = "700 40px 'Fredoka', sans-serif";
      ctx.globalAlpha = Math.min(1, (3.2 - g.t));
      outlined(ctx, 'Suba pelas plataformas!', VW / 2, 190, '#fff3b0', 8);
      ctx.font = "700 22px 'Fredoka', sans-serif";
      outlined(ctx, 'A / D ou ← / → para mover · se cair da tela, acabou', VW / 2, 236, '#fff', 5);
      ctx.globalAlpha = 1;
    }
  }

  return {
    load, start, stop, update, draw, togglePause, primary, best: getBest, coins: getCoins,
    isRunning: () => running, restart: newGame, _debug: () => g, _plats: () => plats, _segs: () => segs, canHop, V0, GRAV, SPEED, W,
  };
})();

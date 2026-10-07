// Fase "Flow Residencial": estilo Flappy Bird. A nave do Genésio voa sozinha para a direita; Espaço / W / ↑ / clique dá um impulso.
// O mapa é infinito: os 5 cenários (pilares) se encadeiam em ordem aleatória. Cada pilar ultrapassado vale 1 ponto.
const Flow = (() => {
  const VW = 1280, VH = 720, S = VH / 941, MW = 1672, MH = 941, VIEW_W = VW / S;
  const GRAV = 2350, FLAP = 745, MAXFALL = 980;
  const BX = 430;                                        // posição horizontal da nave na tela (em unidades do mapa)
  const SHIP_W = 118, SEG_GAP = 300;                    // nave ~20% menor
  const HIT = { w: 72, h: 41, dy: 5 };                   // caixa de colisão (menor que o desenho, para ser justo)
  const PTS_PER_COIN = 5;
  const DIR = 'fase-flow/out/';
  const el = id => document.getElementById(id);

  let imgs = null, loading = null, g = null, running = false, debug = false;

  function load() {
    if (imgs) return Promise.resolve();
    if (loading) return loading;
    const get = Loader.img;
    imgs = { bg: [], pil: {} };
    const jobs = [get(DIR + 'ufo_body.png').then(i => imgs.ufo = i)];
    FLOW_DATA.segments.forEach((s, k) => {
      jobs.push(get(DIR + s.bg).then(i => imgs.bg[k] = i));
      for (const p of s.pillars) jobs.push(get(DIR + p.file).then(i => imgs.pil[p.file] = i));
    });
    return loading = Promise.all(jobs).catch(e => { imgs = null; loading = null; throw e; });
  }

  // ---- dados salvos ----
  const COINS_KEY = 'genesio-coins', BEST_KEY = 'genesio-flow-best';
  const getCoins = () => { try { return +localStorage.getItem(COINS_KEY) || 0; } catch (e) { return 0; } };
  const addCoins = n => { try { localStorage.setItem(COINS_KEY, getCoins() + n); } catch (e) {} };
  const getBest = () => { try { return +localStorage.getItem(BEST_KEY) || 0; } catch (e) { return 0; } };
  const setBest = v => { try { localStorage.setItem(BEST_KEY, v); } catch (e) {} };

  // ---- mundo infinito ----
  const rnd = (a, b) => a + Math.random() * (b - a);
  let segs = [], pillars = [], worldEnd = 0, lastIdx = -1, lastFlip = false;

  // intervalo livre (entre o pilar de cima e o de baixo) perto de uma das bordas do cenário, já considerando o espelhamento
  function edgeCenter(k, flip, side) {
    const s = FLOW_DATA.segments[k], right = flip ? side === 'start' : side === 'end';          // lado do arquivo original
    const ps = s.pillars.filter(p => right ? p.x1 > MW - 420 : p.x0 < 420);
    let lo = 0, hi = MH;
    for (const p of ps) { if (p.top) lo = Math.max(lo, p.y1); else hi = Math.min(hi, p.y0); }
    return (lo + hi) / 2;
  }
  function addSegment(first) {
    const n = FLOW_DATA.segments.length;
    let k, flip;
    if (first) { k = 0; flip = false; }
    else {
      // sorteia alguns candidatos e fica com o que liga melhor com o final do anterior (evita saltos verticais impossíveis)
      const prev = lastEdge; let best = null;
      for (let i = 0; i < 5; i++) {
        const kk = (lastIdx + 1 + Math.floor(Math.random() * (n - 1))) % n, ff = Math.random() < .5;
        const diff = Math.abs(edgeCenter(kk, ff, 'start') - prev);
        if (!best || diff < best.diff) best = { k: kk, flip: ff, diff };
      }
      k = best.k; flip = best.flip;
    }
    const s = FLOW_DATA.segments[k], x = worldEnd + (first ? 1050 : SEG_GAP + rnd(0, 120));
    const seg = { k, flip, x };
    for (const p of s.pillars) {
      const x0 = flip ? MW - p.x1 : p.x0, x1 = flip ? MW - p.x0 : p.x1;
      const sw = imgs.pil[p.file].width, dx0 = flip ? MW - (p.sx + sw) : p.sx;
      pillars.push({ x0: x + x0, x1: x + x1, y0: p.y0, y1: p.y1, top: p.top, file: p.file, dx: x + dx0, dy: p.sy, flip, passed: false, flash: 0 });
    }
    segs.push(seg); worldEnd = x + MW; lastIdx = k; lastFlip = flip;
    lastEdge = edgeCenter(k, flip, 'end');
  }
  let lastEdge = MH / 2;
  const ensureWorld = upTo => { while (worldEnd < upTo) addSegment(segs.length === 0); };

  // ---- partida ----
  function newGame() {
    segs = []; pillars = []; worldEnd = 0; lastIdx = -1; lastEdge = MH / 2;
    g = {
      cam: 0, x: BX, y: MH / 2, vy: 0, t: 0, phase: 'ready', score: 0, speed: 330, paused: false, dead: false, deadT: 0, ended: false,
      rot: 0, flapT: 9, parts: [], popups: [], shake: 0, flash: 0, hint: 0, newRecord: false, coinsEarned: 0, spin: 0,
    };
    ensureWorld(VIEW_W * 3);
    hideOverlay();
  }
  async function start() { await load(); newGame(); running = true; }
  function stop() { running = false; hideOverlay(); unload(); }
  // libera as imagens da fase ao sair (no celular várias fases abertas em sequência estouravam a memória)
  function unload() { imgs = null; loading = null; }
  const speedFor = s => Math.min(540, 330 + 5.5 * s);

  // ---- telas ----
  function hideOverlay() { el('fOverlay').classList.remove('active'); }
  // atalhos do menu: Espaço = principal (voar de novo / continuar), Esc = sair (na tela "Você bateu"), ↑/↓ escolhem o botão e Enter confirma
  let sel = 0, overlayAt = 0;
  const btns = () => [el('fPrimary'), el('fExit')];
  function select(i) { sel = i; btns().forEach((b, k) => b.classList.toggle('sel', k === i)); }
  const overlayOpen = () => running && g && (g.paused || g.ended) && el('fOverlay').classList.contains('active');
  addEventListener('keydown', e => {
    if (!overlayOpen()) return;
    const k = e.code, over = g.ended, ready = performance.now() - overlayAt > 450;       // evita reiniciar sem querer enquanto ainda aperta Espaço para voar
    if (k === 'Escape') { if (over) { e.stopImmediatePropagation(); e.preventDefault(); if (ready) el('fExit').click(); } return; }   // na pausa o Esc segue para o jogo (continuar)
    if (!['Space', 'Enter', 'NumpadEnter', 'ArrowUp', 'ArrowDown', 'KeyW', 'KeyS'].includes(k)) return;
    e.stopImmediatePropagation(); e.preventDefault();
    if (e.repeat) return;
    if (k === 'ArrowUp' || k === 'KeyW') select(0);
    else if (k === 'ArrowDown' || k === 'KeyS') select(1);
    else if (ready) { for (const key in keys) keys[key] = false; (k === 'Space' ? el('fPrimary') : btns()[sel]).click(); }
  });
  function showOverlay(kind) {
    el('fTitle').textContent = kind === 'pause' ? 'Pausado' : 'Você bateu!';
    el('fPrimaryTxt').textContent = kind === 'pause' ? 'Continuar' : 'Voar de novo';
    el('fPrimaryKey').textContent = kind === 'pause' ? 'Espaço' : 'Espaço';
    el('fExitKey').textContent = 'Esc';
    el('fExitKey').hidden = kind === 'pause';              // na pausa o Esc continua o jogo
    el('fPrimary').dataset.kind = kind;
    select(0); overlayAt = performance.now();
    el('fInfo').innerHTML = kind === 'pause'
      ? `Pilares: <b>${g.score}</b> · Recorde: <b>${Math.max(getBest(), g.score)}</b>`
      : `Pilares ultrapassados: <b>${g.score}</b> · Recorde: <b>${getBest()}</b>${g.newRecord ? ' 🏆 novo!' : ''}<br>🪙 <b>+${g.coinsEarned} GenesisCoins</b> <small>(1 a cada ${PTS_PER_COIN} pilares)</small>`;
    el('fOverlay').classList.add('active');
  }
  function togglePause() {
    if (!running || g.ended || g.dead) return;
    g.paused = !g.paused;
    g.paused ? showOverlay('pause') : hideOverlay();
  }
  function primary() { if (el('fPrimary').dataset.kind === 'pause') { g.paused = false; hideOverlay(); } else newGame(); }
  function finish() {
    g.ended = true;
    g.newRecord = g.score > getBest(); if (g.newRecord) setBest(g.score);
    g.coinsEarned = Math.floor(g.score / PTS_PER_COIN); addCoins(g.coinsEarned);
    showOverlay('over');
  }

  // ---- controle ----
  let flapHeld = false, tapQ = false;
  document.getElementById('c').addEventListener('pointerdown', e => { if (running && e.button === 0) tapQ = true; });
  function flap() {
    if (g.dead || g.paused || g.ended) return;
    if (g.phase === 'ready') { g.phase = 'play'; g.hint = 0; }
    g.vy = -FLAP; g.flapT = 0; Sound.flap(); burst(g.x - 16, g.y + 44, 7);
  }
  // fagulhas do propulsor
  function burst(x, y, n) { for (let i = 0; i < n; i++) g.parts.push({ x, y, vx: rnd(-160, 40) - g.speed * .3, vy: rnd(120, 420), life: rnd(.25, .6), t: 0, s: rnd(2, 4.5), c: Math.random() < .5 ? 0 : 1 }); }
  function boom(x, y) { for (let i = 0; i < 40; i++) { const a = rnd(0, 6.28), v = rnd(100, 700); g.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rnd(.5, 1.2), t: 0, s: rnd(3, 8), c: Math.random() < .3 ? 2 : Math.random() < .5 ? 0 : 1 }); } }

  // ---- lógica ----
  function update(dt) {
    if (!running || g.paused) return;
    g.t += dt; g.flapT += dt;
    if (g.shake > 0) g.shake = Math.max(0, g.shake - dt * 40);
    if (g.flash > 0) g.flash = Math.max(0, g.flash - dt * 2.5);
    for (const p of g.popups) p.t += dt; g.popups = g.popups.filter(p => p.t < 1);
    for (const p of g.parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; if (g.dead) p.vy += 700 * dt; } g.parts = g.parts.filter(p => p.t < p.life);
    if (g.parts.length > 300) g.parts.splice(0, g.parts.length - 300);
    for (const p of pillars) if (p.flash > 0) p.flash -= dt * 3;

    const flapKey = !!(keys.Space || keys.KeyW || keys.ArrowUp);
    if ((flapKey && !flapHeld) || tapQ) flap();
    flapHeld = flapKey; tapQ = false;

    if (g.dead) {
      g.deadT += dt; g.vy = Math.min(MAXFALL * 1.3, g.vy + GRAV * dt); g.y += g.vy * dt; g.spin += dt * 9;
      if (g.deadT > 1.25 && !g.ended) finish();
      return;
    }
    if (g.phase === 'ready') {                                  // paira esperando o primeiro toque
      g.y = MH / 2 + Math.sin(g.t * 3) * 14; g.rot = Math.sin(g.t * 3) * .04; g.hint += dt;
      if (Math.random() < dt * 30) burst(g.x - 16, g.y + 44, 1);
      return;
    }
    g.speed = speedFor(g.score);
    g.cam += g.speed * dt;
    g.vy = Math.min(MAXFALL, g.vy + GRAV * dt); g.y += g.vy * dt;
    if (g.y < 50) { g.y = 50; g.vy = Math.max(g.vy, 0); }       // teto: só encosta
    g.rot += ((Math.max(-.38, Math.min(.5, g.vy / 1500))) - g.rot) * Math.min(1, dt * 12);
    if (Math.random() < dt * 55) burst(g.x - 18, g.y + 42, 1);
    ensureWorld(g.cam + VIEW_W * 3);

    // colisão e pontuação
    const wx = g.cam + g.x, hb = { x0: wx - HIT.w / 2, x1: wx + HIT.w / 2, y0: g.y - HIT.h / 2 + HIT.dy, y1: g.y + HIT.h / 2 + HIT.dy };
    for (const p of pillars) {
      if (p.x1 < g.cam - 200) continue;
      if (hb.x1 > p.x0 + 4 && hb.x0 < p.x1 - 4 && hb.y1 > p.y0 + 4 && hb.y0 < p.y1 - 4) { die(); return; }
      if (!p.passed && p.x1 < hb.x0) {
        p.passed = true; p.flash = 1; g.score++; Sound.coin();
        g.popups.push({ text: '+1', x: g.x + 60, y: g.y - 70, t: 0 });
      }
    }
    if (g.y > MH + 20) { die(); return; }                       // caiu da tela
    // limpeza do que ficou para trás
    if (pillars.length > 40) pillars = pillars.filter(p => p.x1 > g.cam - 400);
    if (segs.length > 4) segs = segs.filter(s => s.x + MW > g.cam - 400);
  }
  function die() {
    g.dead = true; g.deadT = 0; g.vy = -420; g.shake = 18; g.flash = .6; Sound.hit(); Sound.die();
    boom(g.x, g.y);
  }

  // ---- desenho ----
  const sxs = x => x * S;
  function outline(ctx, t, x, y, fill, w) { ctx.lineWidth = w || 6; ctx.strokeStyle = '#080614'; ctx.fillStyle = fill || '#fff'; ctx.strokeText(t, x, y); ctx.fillText(t, x, y); }

  // foguinho: desenhado em baixa resolução e ampliado sem suavizar (combina com o pixel art da nave)
  const flameCv = document.createElement('canvas'); flameCv.width = 64; flameCv.height = 64;
  function drawFlame(ctx, x, y, scale, boost, t, rot) {
    const c = flameCv.getContext('2d'); c.clearRect(0, 0, 64, 64);
    const flick = Math.sin(t * 38) * .12 + Math.sin(t * 61 + 1.7) * .09 + Math.sin(t * 17) * .06;
    const len = (20 + 10 * boost + flick * 17) | 0, wid = (10 + 3.5 * boost + Math.sin(t * 45) * 1.4) | 0, cx = 32;
    // camadas: azul -> ciano -> branco, cada uma é uma gota de pixels
    const layers = [['#2a4cff', 1, 1], ['#2fb4ff', .78, .72], ['#aef4ff', .52, .46], ['#ffffff', .28, .24]];
    for (const [col, lm, wm] of layers) {
      c.fillStyle = col; const L = len * lm, Wd = wid * wm;
      for (let yy = 0; yy < L; yy++) {
        const u = yy / L, w = Wd * Math.sqrt(Math.max(0, 1 - Math.pow(u, 1.5))) * (u < .12 ? .5 + u * 4 : 1);
        const wob = (Math.sin(t * 30 + yy * .9) * .7) * u;
        c.fillRect((cx - w + wob) | 0, 2 + yy, Math.max(1, (2 * w) | 0), 1);
      }
    }
    // faíscas soltas
    c.fillStyle = '#9fe8ff';
    for (let i = 0; i < 5; i++) { const ph = (t * 3 + i * .37) % 1, px = cx + Math.sin(i * 7.1 + t * 5) * wid * .8, py = 4 + len * (.55 + ph * .9); if (py < 62) c.fillRect(px | 0, py | 0, 1, 1 + (ph < .5 ? 1 : 0)); }
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    const gl = ctx.createRadialGradient(0, scale * 14, 2, 0, scale * 14, scale * 38 * (1 + .3 * boost));
    gl.addColorStop(0, `rgba(90,200,255,${.45 + .2 * boost})`); gl.addColorStop(1, 'rgba(60,120,255,0)');
    ctx.fillStyle = gl; ctx.globalCompositeOperation = 'lighter'; ctx.fillRect(-scale * 40, -scale * 20, scale * 80, scale * 90);
    ctx.globalCompositeOperation = 'source-over'; ctx.imageSmoothingEnabled = false;
    ctx.drawImage(flameCv, -32 * scale, -2 * scale, 64 * scale, 64 * scale); ctx.restore();
  }

  function draw(ctx) {
    if (!running) return;
    const sh = g.shake, ox = sh ? rnd(-sh, sh) : 0, oy = sh ? rnd(-sh, sh) * .7 : 0;
    ctx.save(); ctx.translate(ox, oy);
    ctx.fillStyle = '#0a0818'; ctx.fillRect(-20, -20, VW + 40, VH + 40);
    // fundo com paralaxe: cenários limpos, lado a lado e espelhados de dois em dois (sem emenda aparente)
    const par = g.cam * .28, tile = MW * S;
    let t0 = Math.floor(par / MW);
    for (let t = t0; t * MW - par < VIEW_W + 4; t++) {
      const k = ((t % 5) + 5) % 5, x = (t * MW - par) * S, mir = (((t % 2) + 2) % 2) === 1;
      ctx.save();
      if (mir) { ctx.translate(x + tile, 0); ctx.scale(-1, 1); ctx.drawImage(imgs.bg[(Math.floor(t / 2) % 5 + 5) % 5], 0, 0, tile + 1, VH); }
      else ctx.drawImage(imgs.bg[(Math.floor(t / 2) % 5 + 5) % 5], x, 0, tile + 1, VH);
      ctx.restore();
    }
    // pilares
    for (const p of pillars) {
      const x = (p.dx - g.cam) * S; const im = imgs.pil[p.file], w = im.width * S;
      if (x > VW + 10 || x + w < -10) continue;
      ctx.save();
      if (p.flip) { ctx.translate(x + w, 0); ctx.scale(-1, 1); ctx.drawImage(im, 0, p.dy * S, w, im.height * S); }
      else ctx.drawImage(im, x, p.dy * S, w, im.height * S);
      if (p.flash > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = p.flash * .55; if (p.flip) ctx.drawImage(im, 0, p.dy * S, w, im.height * S); else ctx.drawImage(im, x, p.dy * S, w, im.height * S); }
      ctx.restore();
      if (debug) { ctx.strokeStyle = '#0f0'; ctx.strokeRect((p.x0 - g.cam) * S, p.y0 * S, (p.x1 - p.x0) * S, (p.y1 - p.y0) * S); }
    }
    // partículas do propulsor
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const p of g.parts) {
      const a = 1 - p.t / p.life; ctx.fillStyle = p.c === 0 ? `rgba(110,225,255,${a})` : p.c === 1 ? `rgba(255,255,255,${a})` : `rgba(190,120,255,${a})`;
      ctx.fillRect(p.x * S - p.s / 2, p.y * S - p.s / 2, p.s, p.s);
    }
    ctx.restore();
    // nave + foguinho
    if (!(g.dead && g.deadT > .15)) {
      const k = SHIP_W / imgs.ufo.width * S, w = imgs.ufo.width * k, h = imgs.ufo.height * k;
      const px = g.x * S, py = g.y * S, rot = g.dead ? g.spin : g.rot;
      const boost = Math.max(0, 1 - g.flapT / .22), falling = g.vy > 250 ? .0 : 1;
      if (!g.dead) drawFlame(ctx, px + Math.sin(rot) * -h * .24, py + Math.cos(rot) * h * .22, S * 1.6, boost, g.t, rot);
      ctx.save(); ctx.translate(px, py); ctx.rotate(rot);
      const sq = 1 + boost * .05; ctx.scale(1 / sq, sq);
      ctx.drawImage(imgs.ufo, -w / 2, -h * .62, w, h); ctx.restore();
      if (debug) { ctx.strokeStyle = '#f0f'; ctx.strokeRect((g.x - HIT.w / 2) * S, (g.y - HIT.h / 2 + HIT.dy) * S, HIT.w * S, HIT.h * S); }
    }
    // textos flutuantes
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = "700 26px 'Fredoka',sans-serif";
    for (const p of g.popups) { ctx.globalAlpha = 1 - p.t; outline(ctx, p.text, p.x * S, (p.y - p.t * 40) * S, '#9ff3ff', 5); }
    ctx.globalAlpha = 1;
    ctx.restore();
    if (g.flash > 0) { ctx.fillStyle = `rgba(255,240,255,${Math.min(.5, g.flash)})`; ctx.fillRect(0, 0, VW, VH); }

    // HUD
    ctx.textAlign = 'center'; ctx.font = "700 74px 'Fredoka',sans-serif"; outline(ctx, String(g.score), VW / 2, 74, '#fff', 10);
    ctx.font = "700 18px 'Fredoka',sans-serif"; outline(ctx, `Recorde ${Math.max(getBest(), g.score)}`, VW / 2, 124, '#d8b8ff', 4);
    ctx.textAlign = 'right'; ctx.font = "700 18px 'Fredoka',sans-serif"; outline(ctx, `🪙 ${getCoins()}`, VW - 24, 36, '#fff3b0', 4);
    if (g.phase === 'ready') {
      const a = .75 + .25 * Math.sin(g.t * 5);
      ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center';
      ctx.font = "700 54px 'Fredoka',sans-serif"; outline(ctx, 'FLOW RESIDENCIAL', VW / 2, 250, '#e6ccff', 10);
      ctx.font = "700 26px 'Fredoka',sans-serif"; outline(ctx, 'Espaço / W / ↑ / clique para voar · passe pelos pilares', VW / 2, 300, '#fff', 5); ctx.restore();
    }
  }

  return {
    load, start, stop, update, draw, togglePause, primary,
    isRunning: () => running, setDebug: v => { debug = v; }, _debug: () => g, _pillars: () => pillars, _segs: () => segs, BX, MH, MW, HIT, GRAV, FLAP, MAXFALL, speedFor, best: getBest, coins: getCoins, flap,
  };
})();

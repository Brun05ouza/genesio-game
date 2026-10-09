// Fase "Nature": desafios de plataforma na mata. Desafio 1: pegar todos os EPIs antes que o tempo acabe.
// A, D / ← →: andar · Shift: correr · Espaço: pular · W, S: subir/descer a escada · S numa plataforma fina: descer por ela
const Nature = (() => {
  const VW = 1280, VH = 720, S = VH / 941;           // coordenadas do mapa = pixels da imagem do cenário (1672x941)
  const DIR = 'fase-teresopolis/nature/';
  const WALK = 250, RUN = 410, GRAV = 1800, JUMP = 810, CLIMB = 150;
  const REWARD = 100;
  const SPEEDUP = 0.30;   // a cada EPI pego, o relógio corre 30% mais rápido (restam menos EPIs = mais pressa)
  const clockRate = () => 1 + SPEEDUP * g.got.size;

  const CHALLENGES = [
    { id: 'epi', title: 'Pegue os EPIs', time: 60, card: 'card1.jpg' },
  ];

  // plataformas (face de cima do chão, em pixels do mapa). solid = não dá para descer por elas
  const PLATFORMS = [
    { x0: 0,    x1: 290,  y: 768, solid: true },   // chão esquerdo
    { x0: 290,  x1: 1470, y: 797, solid: true },   // chão principal
    { x0: 160,  x1: 410,  y: 650 },                // barranco baixo
    { x0: 0,    x1: 480,  y: 485 },                // barranco do meio + ponte de madeira
    { x0: 0,    x1: 150,  y: 278 },                // barranco de cima
    { x0: 270,  x1: 400,  y: 255 },                // ilha pequena
    { x0: 432,  x1: 550,  y: 378 },                // topo do pilar de pedra
    { x0: 505,  x1: 775,  y: 440 },                // ilha com cipós + viga
    { x0: 545,  x1: 700,  y: 178 },                // ilha do alto
    { x0: 850,  x1: 950,  y: 410 },                // ilha pequena
    { x0: 938,  x1: 1018, y: 585 },                // ilha pequena
    { x0: 815,  x1: 950,  y: 650 },                // ilha sobre a lagoa
    { x0: 960,  x1: 1230, y: 328 },                // ilha grande
    { x0: 1230, x1: 1530, y: 330, pts: [[1230, 329], [1400, 331], [1440, 326], [1480, 312], [1520, 296], [1530, 294]] },   // ponte de corda (sobe até o penhasco)
    { x0: 1165, x1: 1672, y: 500 },                // plataforma da direita
    { x0: 1525, x1: 1672, y: 268 },                // penhasco de cima
    { x0: 1180, x1: 1345, y: 638 },                // mesa de madeira
    { x0: 1470, x1: 1672, y: 685, solid: true },     // degrau baixo da direita
  ];
  let WALLS = [];                                    // paredões (gerados de PLATFORMS em newGame)
  const LADDER = { x: 1527, top: 500, bottom: 685 };

  const EPIS = [
    { id: 'capacete',  name: 'Capacete',            x: 622,  y: 178 },
    { id: 'oculos',    name: 'Óculos de proteção',  x: 70,   y: 278 },
    { id: 'protetor',  name: 'Protetor auricular',  x: 1600, y: 268 },
    { id: 'mascara',   name: 'Máscara respiratória', x: 490, y: 378 },
    { id: 'luvas',     name: 'Luvas',               x: 978,  y: 585 },
    { id: 'bota',      name: 'Botina',              x: 300,  y: 650 },
    { id: 'colete',    name: 'Colete refletivo',    x: 1600, y: 685 },
    { id: 'cinto',     name: 'Cinto de segurança',  x: 1380, y: 500 },
  ];

  const FRAMES = { idle: 1, walk: 13, run: 13, jump: 5, ladder: 6, cheer: 2 };
  const SCALE = { idle: 0.78 * 0.577, walk: 0.577, run: 1.05 * 0.577, jump: 1.35 * 0.577, ladder: 0.5, cheer: 0.577 };
  const el = id => document.getElementById(id);

  let imgs = null, loading = null, g = null, running = false, debug = false;

  function load() {
    if (imgs) return Promise.resolve();
    if (loading) return loading;
    const get = Loader.img;
    imgs = { frames: {}, epi: {} };
    const jobs = [get(DIR + 'bg.jpg').then(i => imgs.bg = i)];
    for (const e of EPIS) jobs.push(get(`${DIR}epi_${e.id}.png`.replace('epi_capacete', 'epi_capacete')).then(i => imgs.epi[e.id] = i));
    for (const [name, n] of Object.entries(FRAMES)) {
      imgs.frames[name] = [];
      for (let i = 0; i < n; i++) jobs.push(get(`frames/${name}${i}.png`).then(im => imgs.frames[name][i] = im));
    }
    return loading = Promise.all(jobs).catch(e => { imgs = null; loading = null; throw e; });
  }

  // ---- progresso salvo ----
  const COINS_KEY = 'genesio-coins';
  const getCoins = () => { try { return +localStorage.getItem(COINS_KEY) || 0; } catch (e) { return 0; } };
  const addCoins = n => { try { localStorage.setItem(COINS_KEY, getCoins() + n); } catch (e) {} };
  const bestKey = id => 'genesio-nature-best-' + id;
  const getBest = id => { try { return +localStorage.getItem(bestKey(id)) || 0; } catch (e) { return 0; } };
  const setBest = (id, v) => { try { localStorage.setItem(bestKey(id), v); } catch (e) {} };
  const TIME_KEY = 'genesio-nature-time-epi'; // milissegundos reais; o menor tempo de uma missão completa vence
  const bestTime = () => { try { return +localStorage.getItem(TIME_KEY) || 0; } catch (e) { return 0; } };
  const formatTime = ms => (ms / 1000).toFixed(2).replace('.', ',') + ' s';

  // ---- partida ----
  function newGame(id) {
    const ch = CHALLENGES.find(c => c.id === id) || CHALLENGES[0];
    g = {
      ch, x: 120, y: 768, vx: 0, vy: 0, plat: PLATFORMS[0], facing: 1, climb: false, climbT: 0, animT: 0, jumpHeld: true,
      drop: null, dropT: 0, phase: 'ready', readyT: 0, timeLeft: ch.time, got: new Set(), popups: [], paused: false, won: false,
      endT: 0, coinsEarned: 0, elapsed: 0, resultTime: 0, newTimeRecord: false,
    };
    WALLS = buildWalls(PLATFORMS);
    hideOverlay();
  }
  async function start(id) { await load(); newGame(id); running = true; }
  function stop() { running = false; hideOverlay(); unload(); }
  // libera as imagens da fase ao sair (no celular várias fases abertas em sequência estouravam a memória)
  function unload() { imgs = null; loading = null; }

  // ---- telas de pausa / fim ----
  function showOverlay(kind) {
    el('nSettings').hidden = kind !== 'pause';
    const total = EPIS.length, n = g.got.size;
    let title, info;
    if (kind === 'pause') { title = 'Pausado'; info = `${n} de ${total} EPIs · faltam ${Math.ceil(g.timeLeft)} s no relógio`; }
    else if (kind === 'win') {
      title = 'Missão cumprida! 🎉';
      info = `Você pegou todos os <b>${total} EPIs</b> em <b>${formatTime(g.resultTime)}</b>.${g.newTimeRecord ? ' 🏆 Novo recorde!' : ''}<br>Melhor tempo: <b>${formatTime(bestTime())}</b><br>🪙 <b>+${REWARD} GenesisCoins</b>`;
    } else {
      title = 'Foi quase!';
      info = `Você pegou <b>${n} de ${total}</b> EPIs.<br>Mas EPI é importante.<br><b>Tente novamente!</b>`;
    }
    el('nTitle').textContent = title;
    el('nInfo').innerHTML = info;
    el('nPrimary').textContent = kind === 'pause' ? 'Continuar' : 'Jogar de novo';
    el('nPrimary').dataset.kind = kind;
    el('nOverlay').classList.add('active');
  }
  function hideOverlay() { el('nOverlay').classList.remove('active'); }
  function togglePause() {
    if (!running || g.phase === 'end') return;
    g.paused = !g.paused;
    g.paused ? showOverlay('pause') : hideOverlay();
  }
  function primary() {
    if (el('nPrimary').dataset.kind === 'pause') { g.paused = false; hideOverlay(); } else newGame(g.ch.id);
  }

  function finish(won) {
    g.phase = 'end'; g.won = won;
    if (won) { addCoins(REWARD); g.coinsEarned = REWARD; Sound.power(); } else Sound.hit();
    if (g.got.size > getBest(g.ch.id)) setBest(g.ch.id, g.got.size);
    if (won) {
      g.resultTime = Math.max(1, Math.round(g.elapsed * 1000));
      g.newTimeRecord = !bestTime() || g.resultTime < bestTime();
      if (g.newTimeRecord) { try { localStorage.setItem(TIME_KEY, g.resultTime); } catch (e) {} }
    }
    showOverlay(won ? 'win' : 'lose');
  }

  // ---- física ----
  // plataformas inclinadas (pontes de corda): pts = [[x, y], ...] com o chão de verdade da ponte
  const platY = (p, x) => {
    const q = p.pts; if (!q) return p.y;
    if (x <= q[0][0]) return q[0][1];
    for (let i = 1; i < q.length; i++) if (x <= q[i][0]) return q[i - 1][1] + (q[i][1] - q[i - 1][1]) * (x - q[i - 1][0]) / (q[i][0] - q[i - 1][0]);
    return q[q.length - 1][1];
  };
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
    for (const p of PLATFORMS) {
      if (p === g.drop) continue;
      const py = platY(p, x);
      if (inRange(p, x) && prevY <= py + 2 && y >= py && (!best || py < by)) { best = p; by = py; }
    }
    return best;
  }

  function update(dt) {
    if (!running || g.paused) return;
    g.animT += dt;
    for (const p of g.popups) p.t += dt;
    g.popups = g.popups.filter(p => p.t < 1.2);
    if (g.phase === 'end') return;
    if (g.phase === 'ready') {
      g.readyT += dt;
      if (g.readyT >= 2.4) { g.phase = 'play'; }
      return;
    }
    g.elapsed += dt;
    g.timeLeft -= dt * clockRate();
    if (g.timeLeft <= 0) { g.timeLeft = 0; finish(false); return; }

    const left = keys.KeyA || keys.ArrowLeft, right = keys.KeyD || keys.ArrowRight;
    const up = keys.KeyW || keys.ArrowUp, down = keys.KeyS || keys.ArrowDown;
    const ax = (right ? 1 : 0) - (left ? 1 : 0);
    const jump = !!keys.Space;
    const speed = (keys.ShiftLeft || keys.ShiftRight) ? RUN : WALK;
    if (ax) g.facing = ax;
    if (g.dropT > 0) { g.dropT -= dt; if (g.dropT <= 0) g.drop = null; }
    if (g.cheerT > 0) g.cheerT -= dt;

    if (g.climb) {                                       // subindo / descendo a escada
      if (jump && !g.jumpHeld) { g.climb = false; g.vy = -520; g.vx = ax * 160; g.plat = null; g.jumpHeld = true; Sound.jump(); }
      else if (ax && !up && !down) { g.climb = false; g.vy = 0; g.plat = null; }
      else {
        const dy = (down ? 1 : 0) - (up ? 1 : 0);
        g.y += dy * CLIMB * dt;
        if (dy) g.climbT += dt;
        if (g.y <= LADDER.top) { g.y = LADDER.top; g.climb = false; g.plat = PLATFORMS.find(p => p.y === LADDER.top && inRange(p, g.x)); }
        else if (g.y >= LADDER.bottom) { g.y = LADDER.bottom; g.climb = false; g.plat = PLATFORMS.find(p => p.y === LADDER.bottom && inRange(p, g.x)); }
      }
    } else {
      // entrar na escada
      const nearLadder = Math.abs(g.x - LADDER.x) < 26;
      if (nearLadder && ((up && g.y > LADDER.top + 2 && g.y <= LADDER.bottom + 4) || (down && g.y >= LADDER.top - 4 && g.y < LADDER.bottom - 2))) {
        g.climb = true; g.x = LADDER.x; g.plat = null; g.vy = 0; g.vx = 0;
      } else {
        // horizontal
        g.vx = ax * speed;
        const px = g.x;
        g.x = Math.min(1650, Math.max(22, g.x + g.vx * dt));
        wallPush(px);
        // pular / descer por plataforma fina
        if (jump && !g.jumpHeld && g.plat && !down) { g.vy = -JUMP; g.plat = null; Sound.jump(); }
        else if (down && g.plat && !g.plat.solid) { g.drop = g.plat; g.dropT = 0.3; g.plat = null; g.y += 3; }
        if (!jump) g.jumpHeld = false;
        // em pé numa plataforma
        if (g.plat) {
          if (!inRange(g.plat, g.x)) g.plat = null;
          else {                                         // pequenos degraus sobem sozinhos
            for (const p of PLATFORMS) { const py = platY(p, g.x); if (p !== g.plat && inRange(p, g.x) && py < g.y && py >= g.y - 34) { g.plat = p; g.y = py; break; } }
          }
        }
        if (g.plat) { g.vy = 0; g.y = platY(g.plat, g.x); }
        else {
          const prevY = g.y;
          g.vy += GRAV * dt;
          g.y += g.vy * dt;
          if (g.vy >= 0) {
            const p = landing(g.x, prevY, g.y);
            if (p) { g.plat = p; g.y = platY(p, g.x); if (g.vy > 300) Sound.land(); g.vy = 0; }
          }
          if (g.y > 941) { g.y = 941; g.vy = 0; }
        }
      }
    }
    if (jump && !g.climb && !g.plat) g.jumpHeld = true;
    if (jump && g.climb) g.jumpHeld = true;

    // coletar EPIs
    for (const e of EPIS) {
      if (g.got.has(e.id)) continue;
      if (Math.hypot(g.x - e.x, (g.y - 46) - (e.y - 52)) < 46) {
        g.got.add(e.id); Sound.coin(); g.cheerT = 0.9;
        g.popups.push({ text: e.name, x: e.x, y: e.y - 100, t: 0 });
        if (g.got.size === EPIS.length) { finish(true); return; }
      }
    }
  }

  // ---- desenho ----
  function frame() {
    if (g.climb) return ['ladder', Math.floor(g.climbT * 9) % 6];
    if (!g.plat) {
      const p = g.vy < -350 ? 1 : g.vy < 150 ? 2 : 3;
      return ['jump', p];
    }
    if (Math.abs(g.vx) > 1) {
      const run = keys.ShiftLeft || keys.ShiftRight;
      return run ? ['run', Math.floor(g.animT * 17) % 13] : ['walk', Math.floor(g.animT * 11) % 13];
    }
    if (g.cheerT > 0) return ['cheer', Math.floor(g.animT * 6) % 2];     // comemora o EPI que acabou de pegar
    return ['idle', 0];
  }

  function outlined(ctx, text, x, y, fill = '#fff', stroke = '#08150f', w = 6) {
    ctx.lineWidth = w; ctx.strokeStyle = stroke; ctx.fillStyle = fill;
    ctx.strokeText(text, x, y); ctx.fillText(text, x, y);
  }

  function draw(ctx) {
    if (!running) return;
    ctx.drawImage(imgs.bg, 0, 0, VW, VH);

    if (debug) {
      ctx.strokeStyle = 'rgba(255,0,255,.9)'; ctx.lineWidth = 2;
      for (const p of PLATFORMS) { ctx.beginPath(); ctx.moveTo(p.x0 * S, platY(p, p.x0) * S); if (p.pts) for (const q of p.pts) ctx.lineTo(q[0] * S, q[1] * S); ctx.lineTo(p.x1 * S, platY(p, p.x1) * S); ctx.stroke(); }
      ctx.strokeStyle = 'cyan'; ctx.strokeRect((LADDER.x - 26) * S, LADDER.top * S, 52 * S, (LADDER.bottom - LADDER.top) * S);
    }

    // EPIs (flutuando, com brilho)
    for (const e of EPIS) {
      if (g.got.has(e.id)) continue;
      const im = imgs.epi[e.id], bob = Math.sin(g.animT * 3 + e.x) * 4;
      const cx = e.x * S, cy = (e.y - 52 + bob) * S, sz = 54;
      const gl = ctx.createRadialGradient(cx, cy, 4, cx, cy, 44);
      gl.addColorStop(0, 'rgba(255,255,255,.55)'); gl.addColorStop(0.6, 'rgba(255,240,170,.22)'); gl.addColorStop(1, 'rgba(255,240,170,0)');
      ctx.fillStyle = gl; ctx.fillRect(cx - 46, cy - 46, 92, 92);
      const k = sz / Math.max(im.width, im.height);
      ctx.drawImage(im, cx - im.width * k / 2, cy - im.height * k / 2, im.width * k, im.height * k);
    }

    // Genésio
    const [anim, i] = frame();
    const im = imgs.frames[anim][i], sc = SCALE[anim] * (anim === 'ladder' ? 1 : 1);
    const w = im.width * sc, h = im.height * sc, fx = g.x * S, fy = g.y * S;
    if (!g.climb) {
      ctx.fillStyle = 'rgba(0,0,0,.3)';
      ctx.beginPath(); ctx.ellipse(fx, g.plat ? fy - 1 : (landing(g.x, g.y, 941) ? platY(landing(g.x, g.y, 941), g.x) * S : fy) - 1, 24, 6, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.save();
    if (anim !== 'ladder' && anim !== 'cheer' && g.facing < 0) { ctx.translate(fx, 0); ctx.scale(-1, 1); ctx.translate(-fx, 0); }
    ctx.drawImage(im, fx - w / 2, fy - h, w, h);
    ctx.restore();

    // textos flutuantes ao pegar EPI
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = "700 22px 'Fredoka', sans-serif";
    for (const p of g.popups) {
      ctx.globalAlpha = Math.max(0, 1 - p.t / 1.2);
      outlined(ctx, '+ ' + p.text, Math.min(VW - 120, Math.max(120, p.x * S)), p.y * S - p.t * 40, '#fff3b0');
    }
    ctx.globalAlpha = 1;

    // HUD: EPIs coletados
    const n = EPIS.length, x0 = VW / 2 - (n * 50) / 2;
    ctx.fillStyle = 'rgba(8,21,15,.62)'; ctx.beginPath(); ctx.roundRect(x0 - 12, 8, n * 50 + 24, 60, 14); ctx.fill();
    EPIS.forEach((e, k) => {
      const im2 = imgs.epi[e.id], has = g.got.has(e.id), sz2 = 38, kk = sz2 / Math.max(im2.width, im2.height);
      ctx.globalAlpha = has ? 1 : 0.28;
      if (!has) ctx.filter = 'grayscale(1) brightness(.6)';
      ctx.drawImage(im2, x0 + k * 50 + 25 - im2.width * kk / 2, 38 - im2.height * kk / 2, im2.width * kk, im2.height * kk);
      ctx.filter = 'none'; ctx.globalAlpha = 1;
    });
    // HUD: tempo
    const low = g.timeLeft <= 15;
    ctx.textAlign = 'right'; ctx.font = "700 40px 'Fredoka', sans-serif";
    const t = Math.ceil(g.timeLeft);
    outlined(ctx, '⏱ ' + String(Math.floor(t / 60)).padStart(1, '0') + ':' + String(t % 60).padStart(2, '0'), VW - 24, 40, low && Math.floor(g.animT * 4) % 2 ? '#ff8a7a' : '#fff');
    const rate = clockRate();
    if (rate > 1.01) {                                     // aviso de que o tempo está acelerando
      ctx.font = "700 18px 'Fredoka', sans-serif";
      outlined(ctx, `⚡ tempo x${rate.toFixed(1)}`, VW - 24, 112, rate >= 2.5 ? '#ff8a7a' : '#ffd36b', '#08150f', 4);
    }
    ctx.fillStyle = 'rgba(8,21,15,.62)'; ctx.fillRect(VW - 240, 62, 216, 12);
    ctx.fillStyle = low ? '#ff6b57' : '#7be08d'; ctx.fillRect(VW - 240, 62, 216 * g.timeLeft / g.ch.time, 12);
    ctx.font = "700 20px 'Fredoka', sans-serif";
    outlined(ctx, `🪙 ${getCoins()}`, VW - 24, 92, '#fff3b0', '#08150f', 5);

    // contagem inicial
    if (g.phase === 'ready') {
      const msg = g.readyT < 0.6 ? 'Prepare-se!' : g.readyT < 1.2 ? '3' : g.readyT < 1.8 ? '2' : '1';
      ctx.textAlign = 'center'; ctx.font = "700 84px 'Fredoka', sans-serif";
      outlined(ctx, msg, VW / 2, 190, '#fff3b0', '#08150f', 10);
      ctx.font = "700 24px 'Fredoka', sans-serif";
      outlined(ctx, `Pegue os ${EPIS.length} EPIs antes que o tempo acabe!`, VW / 2, 250, '#fff', '#08150f', 5);
    }
  }

  return {
    CHALLENGES, EPIS, load, start, stop, update, draw, togglePause, primary,
    isRunning: () => running,
    restart: () => newGame(g.ch.id),
    coins: getCoins, best: getBest, bestTime, formatTime,
    setDebug: v => { debug = v; }, _walls: () => WALLS, _platforms: () => PLATFORMS, platY,
    _debug: () => g,
  };
})();

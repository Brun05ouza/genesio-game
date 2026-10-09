const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const VW = canvas.width, VH = canvas.height;

// ---- carregar imagens ----
const ANIMS = { idle: 1, walk: 13, run: 13, jump: 5 };     // quadros do Genésio (tools/make_mascot_frames.py)
const SCALE = { idle: 0.78, walk: 1, run: 1.05, jump: 1.35 }; // iguala o tamanho visual dos frames
const MAP_FILE = 'map/new-map.webp';
let MAP_ZOOM = 1.5;        // zoom do mapa na tela (cada fase define o seu, para o Genésio ficar na proporção certa)
const CHAR_SCALE = 0.8;    // Genésio ~80px de altura no mundo (um banco de praça tem ~70px de largura)
const frames = {};
let mapImg = new Image();
// fases: cada uma tem seu mapa; encostar na borda de baixo leva à próxima
const LEVELS = {
  praca:  { file: MAP_FILE, start: [627, 780], next: 'iguacu', name: 'Lobby', enter: 'Voltando para o Lobby', mask: 'map/lobby-mask.webp' },   // colisão: fonte, canteiros, bancos, postes, muros e árvores
  iguacu: { file: 'fase-nova-igua%C3%A7u/map-nova-igua%C3%A7u.webp', start: [630, 1215], next: 'praca', name: 'Nova Iguaçu', enter: 'Entrando na área de Nova Iguaçu', theme: 'iguacu' },
  // mapa isométrico grande (1448x1086): zoom baixo para ver bastante do mapa, e Genésio menor para manter a proporção com bancos, carros e postes
  teresopolis: {
    file: 'fase-teresopolis/teresopolis-mapa.webp',
    zoom: 1.8, charScale: 0.85,
    mask: 'fase-teresopolis/teresopolis-colisao.webp',          // só ruas, calçadas e a rotatória são andáveis; veja make_serra_mask.py
    start: [690, 760],                               // chega pela rua central, logo depois do arco
    exitSouth: { y: 945, x0: 600, x1: 800, to: 'praca' },
    front: { file: 'fase-teresopolis/teresopolis-arco.webp', x: 556, y: 800 },   // arco desenhado por cima do Genésio (ele passa por trás/por baixo); veja tools/make_serra_arch.py   // passou do arco (já fora do condomínio): volta para o lobby
    name: 'Teresópolis', enter: 'Entrando na área de Teresópolis', theme: 'serra',
    tips: ['Subindo a serra...', 'Ligando a nave do Flow...', 'Acordando o Golem do Solar do Bosque...', 'Separando os EPIs do Nature...', 'Quase lá...'],
  },
};
// onde o Genésio reaparece ao voltar de uma fase para outra
const RETURN_POS = { 'praca<-iguacu': [630, 1200], 'praca<-teresopolis': [627, 262] };
let waterMask = null;      // água da borda do mapa (sair da fase)
let walkMask = null;       // máscara de chão pisável da fase atual (se houver)
function canWalk(x, y) {
  if (!walkMask) return true;
  const ix = Math.floor(x), iy = Math.floor(y);
  if (ix < 0 || iy < 0 || ix >= walkMask.w || iy >= walkMask.h) return false;
  return walkMask.data[iy * walkMask.w + ix] > 0;
}
function waterAt(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  if (ix < 0 || iy < 0 || ix >= waterMask.w || iy >= waterMask.h) return true;
  return waterMask.data[iy * waterMask.w + ix] > 0;
}
async function loadMask(file) {
  const im = await loadImage(file);
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  const x = c.getContext('2d'); x.drawImage(im, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height).data;
  const data = new Uint8Array(c.width * c.height);
  for (let i = 0; i < data.length; i++) data[i] = d[i * 4] > 127 ? 1 : 0;
  return { w: c.width, h: c.height, data };
}
let levelId = 'praca';
const levelImgs = {};
let pending = 1, total = 1, ready = false;
const $ = id => document.getElementById(id);
const done = () => {
  pending--;
  const pct = Math.round((1 - pending / total) * 100);
  $('barFill').style.width = pct + '%';
  $('loadText').textContent = `Carregando lobby... ${pct}%`;
  if (pending === 0) setTimeout(() => { ready = true; if (typeof Account !== 'undefined') Account.gate(); else show('menu'); }, 400);
};
mapImg.onload = done; mapImg.src = MAP_FILE; levelImgs.praca = mapImg;
// colisão do lobby (se falhar, o jogo segue sem colisão)
pending++; total++;
loadMask(LEVELS.praca.mask).then(m => { LEVELS.praca.maskData = m; if (levelId === 'praca') walkMask = m; }).catch(() => {}).finally(done);
for (const [name, n] of Object.entries(ANIMS)) {
  frames[name] = [];
  for (let i = 0; i < n; i++) {
    pending++; total++;
    const im = new Image();
    im.onload = done;
    im.src = `frames/${name}${i}.webp`;
    frames[name].push(im);
  }
}

// ---- estado ----
const keys = {};
const ARROW = { ArrowLeft: 'KeyA', ArrowRight: 'KeyD', ArrowUp: 'KeyW', ArrowDown: 'KeyS' };
addEventListener('keydown', e => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;   // digitando (login): não vira comando do jogo
  if (e.code === 'Escape') {
    if (state === 'talk') Talk.skip();
    else if (state === 'playing') openMenu();
    else if (state === 'settings') show('menu');
    else if (state === 'menu' && started) startGame();
    else if (state === 'runner') Runner.togglePause();
    else if (state === 'nplay') Nature.togglePause();
    else if (state === 'kplay') Climb.togglePause();
    else if (state === 'hplay') Hop.togglePause();
    else if (state === 'splay') Solar.togglePause();
    else if (state === 'fplay') Flow.togglePause();
    else if (state === 'nature') backToMap();
    else if (state === 'prompt') closePrompt();
    else if (state === 'oasis') backToMap();
    else if (state === 'difficulty') show('oasis');
    return;
  }
  keys[e.code] = true;
  if (ARROW[e.code]) { keys[ARROW[e.code]] = true; e.preventDefault(); }   // setas = WASD em todo o jogo
  if (e.code === 'Space') e.preventDefault();
});
addEventListener('keyup', e => { keys[e.code] = false; if (ARROW[e.code]) keys[ARROW[e.code]] = false; });

const player = {
  wx: 627, wy: 780,   // posição no mundo (mapa fixo, sem repetir)
  z: 0,               // altura do pulo
  vz: 0,
  facing: 1,          // 1 direita, -1 esquerda
  moving: false,
  running: false,
  t: 0,               // relógio da animação
};
const RUN_MULT = 1.75;   // segurando Shift o Genésio corre
const SPEED = 170, GRAVITY = 1700, JUMP_V = 520; // SPEED em px do mapa por segundo
let SCREEN_X = VW / 2, SCREEN_Y = VH / 2; // posição dos pés do personagem na tela (calculada pela câmera)
const cam = { x: 0, y: 0 };

// mapa fixo (não repete): câmera segue o personagem e para nas bordas
function updateCamera(fx, fy) {
  const halfW = VW / 2 / MAP_ZOOM, halfH = VH / 2 / MAP_ZOOM;
  cam.x = Math.min(Math.max(fx, halfW), mapImg.width - halfW);
  cam.y = Math.min(Math.max(fy, halfH), mapImg.height - halfH);
}

function update(dt) {
  let dx = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  let dy = (keys.KeyS ? 1 : 0) - (keys.KeyW ? 1 : 0);
  player.moving = dx !== 0 || dy !== 0;
  player.running = player.moving && (keys.ShiftLeft || keys.ShiftRight);
  const spd = SPEED * (1.5 / MAP_ZOOM) * (LEVELS[levelId].charScale || 1) * (player.running ? RUN_MULT : 1);   // mesma velocidade na tela em qualquer zoom
  if (dx) player.facing = dx;
  if (dx && dy) { dx *= Math.SQRT1_2; dy *= Math.SQRT1_2; }
  const ox = player.wx, oy = player.wy;
  const free = walkMask || LEVELS[levelId].free;
  const mx = free ? 4 : 40, myTop = free ? 4 : 85, myBot = free ? 4 : 8;
  let nx = Math.min(Math.max(ox + dx * spd * dt, mx), mapImg.width - mx);
  let ny = Math.min(Math.max(oy + dy * spd * dt, myTop), mapImg.height - myBot);
  if (walkMask && !canWalk(nx, ny)) {       // só pisa em rua/calçada: desliza pelas bordas
    if (canWalk(nx, oy)) ny = oy;
    else if (canWalk(ox, ny)) nx = ox;
    else { nx = ox; ny = oy; }
  }
  if (gateBlocked(nx, ny)) {              // desliza pela pedra do portal em vez de atravessar
    if (!gateBlocked(nx, oy)) ny = oy;
    else if (!gateBlocked(ox, ny)) nx = ox;
    else { nx = ox; ny = oy; }
  }
  player.wx = nx; player.wy = ny;
  const lvNow = LEVELS[levelId], next = lvNow.next;
  if (next && player.wy >= mapImg.height - 12) goToLevel(next);
  if (lvNow.exitSouth && player.wy > lvNow.exitSouth.y && player.wx > lvNow.exitSouth.x0 && player.wx < lvNow.exitSouth.x1) goToLevel(lvNow.exitSouth.to);
  // arcos: atravessar pelos vãos laterais leva à outra área (lobby -> Teresópolis pelo norte; Teresópolis -> lobby pelo sul)
  for (const gt of GATES) {
    if (gt.level !== levelId || Math.abs(player.wx - gt.x) >= gt.w / 2) continue;
    if (gt.side === 'north' ? player.wy < gt.y + 30 : player.wy > gt.y + 22) { goToLevel(gt.to); break; }     // lobby: encostou no portal, já entra
  }

  if (keys.Space && player.z === 0) { player.vz = JUMP_V; Sound.jump(); }
  if (player.z > 0 || player.vz > 0) {
    player.vz -= GRAVITY * dt;
    player.z += player.vz * dt;
    if (player.z <= 0) { player.z = 0; player.vz = 0; Sound.land(); }
  }
  player.t += dt;
}

// camada da frente (ex.: o arco de Teresópolis): aparece por cima do Genésio, como se ele estivesse atrás dela
const frontImgs = {};
function drawFront() {
  const f = LEVELS[levelId].front; if (!f) return;
  let im = frontImgs[f.file];
  if (!im) { im = frontImgs[f.file] = new Image(); im.src = f.file; }
  if (!im.complete || !im.naturalWidth) return;
  ctx.drawImage(im, VW / 2 + (f.x - cam.x) * MAP_ZOOM, VH / 2 + (f.y - cam.y) * MAP_ZOOM, im.width * MAP_ZOOM, im.height * MAP_ZOOM);
}
// ---- conversa de boas-vindas: lugar mostrado na tela ----
let talkFocus = null;
const talkCam = { x: 627, y: 780 };
document.addEventListener('talkline', e => { talkFocus = (e.detail && e.detail.focus) || null; });
document.addEventListener('talkend', () => { talkFocus = null; });
function drawFocusArrow(f) {
  const t = performance.now() / 1000, bob = Math.sin(t * 5) * 10;
  const px = VW / 2 + (f.x - cam.x) * MAP_ZOOM, py = VH / 2 + (f.y - cam.y) * MAP_ZOOM;
  const x = Math.max(80, Math.min(VW - 80, px)), y = Math.max(150, Math.min(VH - 230, py));
  ctx.save();
  // brilho no chão
  const gl = ctx.createRadialGradient(x, y, 6, x, y, 90); gl.addColorStop(0, 'rgba(255,230,120,.55)'); gl.addColorStop(1, 'rgba(255,230,120,0)');
  ctx.fillStyle = gl; ctx.beginPath(); ctx.ellipse(x, y, 90, 34, 0, 0, Math.PI * 2); ctx.fill();
  // seta descendo até o lugar
  ctx.translate(x, y - 46 + bob);
  ctx.fillStyle = '#ffd34d'; ctx.strokeStyle = '#3a2a05'; ctx.lineWidth = 5; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(-16, -58); ctx.lineTo(16, -58); ctx.lineTo(16, -22); ctx.lineTo(34, -22); ctx.lineTo(0, 12); ctx.lineTo(-34, -22); ctx.lineTo(-16, -22); ctx.closePath();
  ctx.stroke(); ctx.fill();
  // nome do lugar
  ctx.font = "700 30px 'Fredoka', sans-serif"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 8; ctx.strokeStyle = '#0b2418'; ctx.strokeText(f.label, 0, -86); ctx.fillStyle = '#fff3b0'; ctx.fillText(f.label, 0, -86);
  ctx.restore();
}
function drawMap() {
  ctx.fillStyle = '#0b2418'; ctx.fillRect(0, 0, VW, VH);      // fora do mapa (onde a água é transparente) fica o verde bem escuro
  ctx.drawImage(mapImg, VW / 2 - cam.x * MAP_ZOOM, VH / 2 - cam.y * MAP_ZOOM,
    mapImg.width * MAP_ZOOM, mapImg.height * MAP_ZOOM);
}

// placas no chão (x/y = pé do poste). dir: sentido da seta
const SIGNS = [
  { level: 'praca',  x: 548, y: 1085, text: 'NOVA IGUAÇU',       dir: 'down', w: 118 },
  { level: 'iguacu', x: 630, y: 535,  text: 'OÁSIS RESIDENCIAL', dir: 'up',   w: 150, oasis: true },
  // Teresópolis: Nature e Solar do Bosque à frente do Genésio; Flow Residencial na rua de trás
  { level: 'teresopolis', x: 570, y: 460, text: 'NATURE',            dir: 'up',   w: 76,  ss: 0.68, nature: true },   // rotatória, subindo a rua central
  { level: 'teresopolis', x: 960, y: 860, text: 'SOLAR DO BOSQUE',   dir: 'up',   w: 142, ss: 0.68, solar: true },   // rua principal, à direita do cruzamento
  { level: 'teresopolis', x: 470, y: 850, text: 'FLOW RESIDENCIAL',  dir: 'up',   w: 152, ss: 0.68, flow: true },   // rua da esquerda, perto do arco
];
// portal de pedra "Teresópolis" na rua de cima do lobby (x/y = centro da base). solid = trechos (fração da largura) onde há pedra no chão
const GATES = [
  { level: 'praca', file: 'fase-teresopolis/gateway.webp', x: 627, y: 190, w: 306, pix: 150, name: [676, 130, 64, 590],
    solid: [[0.017, 0.19], [0.382, 0.626], [0.81, 0.995]], to: 'teresopolis', side: 'north', pad: 12 },
];
for (const gt of GATES) {
  gt.img = new Image();
  gt.img.onload = () => {
    const pw = gt.pix, ph = Math.round(pw * gt.img.height / gt.img.width);
    const c = document.createElement('canvas'); c.width = pw; c.height = ph;
    const x = c.getContext('2d');
    x.drawImage(gt.img, 0, 0, pw, ph);                       // reduz: vira pixels grossos como os do mapa
    const d = x.getImageData(0, 0, pw, ph), a = d.data;
    for (let i = 0; i < a.length; i += 4) {
      a[i + 3] = a[i + 3] > 110 ? 255 : 0;                    // bordas sem meio-tom
      for (let k = 0; k < 3; k++) a[i + k] = Math.round(a[i + k] / 24) * 24 - (a[i + k] > 232 ? 8 : 0);   // paleta mais limitada
    }
    x.putImageData(d, 0, 0);
    x.globalCompositeOperation = 'destination-out';           // base dos pilares meio "enterrada" no chão
    const gr = x.createLinearGradient(0, ph - 5, 0, ph);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.55)');
    x.fillStyle = gr; x.fillRect(0, ph - 5, pw, 5);
    gt.pixCanvas = c; gt.ok = true;
  };
  gt.img.src = gt.file;
}
function gateBlocked(wx, wy) {            // pés dentro da base de pedra do portal?
  for (const gt of GATES) {
    if (gt.level !== levelId) continue;
    if (wy < gt.y - 14 || wy > gt.y + 6) continue;
    const left = gt.x - gt.w / 2;
    const pad = gt.pad === undefined ? 12 : gt.pad;
    for (const [a, b] of gt.solid) if (wx > left + a * gt.w - pad && wx < left + b * gt.w + pad) return true;
  }
  return false;
}
function drawGate(gt) {
  if (!gt.ok) return;
  const Z = MAP_ZOOM, w = gt.w * Z, h = w * gt.img.height / gt.img.width;
  const px = VW / 2 + (gt.x - cam.x) * Z, py = VH / 2 + (gt.y - cam.y) * Z;
  if (px + w / 2 < 0 || px - w / 2 > VW || py - h > VH || py < 0) return;
  const sh = ctx.createRadialGradient(0, 0, 4, 0, 0, w * 0.55);   // sombra suave que mistura o portal com o chão
  sh.addColorStop(0, 'rgba(20,25,10,.34)'); sh.addColorStop(1, 'rgba(20,25,10,0)');
  ctx.save(); ctx.translate(px, py - 2); ctx.scale(1, 0.12);
  ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(0, 0, w * 0.55, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  const smooth = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(gt.pixCanvas, Math.round(px - w / 2), Math.round(py - h), Math.round(w), Math.round(h));
  ctx.imageSmoothingEnabled = smooth;
  // placa com o nome: desenhada em alta resolução por cima, para as letras continuarem legíveis
  const k = w / gt.img.width, [nx, ny, nw, nh] = gt.name;
  ctx.drawImage(gt.img, nx, ny, nw, nh, Math.round(px - w / 2 + nx * k), Math.round(py - h + ny * k), Math.ceil(nw * k), Math.ceil(nh * k));
}

function drawSign(sg) {
  const px = VW / 2 + (sg.x - cam.x) * MAP_ZOOM, py = VH / 2 + (sg.y - cam.y) * MAP_ZOOM;
  if (px < -200 || px > VW + 200 || py < -200 || py > VH + 200) return;
  const Z = MAP_ZOOM * (sg.ss || 1);       // ss: escala da placa nessa fase (o mapa de Teresópolis é menos ampliado)
  const bw = sg.w * Z, bh = 48 * Z, poleH = 70 * Z;
  ctx.save();
  ctx.translate(px, py);
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.beginPath(); ctx.ellipse(0, 0, 14 * Z, 4 * Z, 0, 0, Math.PI * 2); ctx.fill();
  // poste
  ctx.fillStyle = '#6b4a2b'; ctx.strokeStyle = '#2a1a0c'; ctx.lineWidth = 2;
  ctx.fillRect(-3 * Z, -poleH, 6 * Z, poleH); ctx.strokeRect(-3 * Z, -poleH, 6 * Z, poleH);
  // placa
  const bx = -bw / 2, by = -poleH - bh * 0.55;
  ctx.fillStyle = '#1f7a4d'; ctx.strokeStyle = '#08150f'; ctx.lineWidth = 3;
  if (sg === hoverSign) { ctx.shadowColor = '#fff3b0'; ctx.shadowBlur = 16 * Z; ctx.fillStyle = '#27a063'; }
  ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 6 * Z); ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(bx + 3 * Z, by + 3 * Z, bw - 6 * Z, bh - 6 * Z, 4 * Z); ctx.stroke();
  // texto e seta (seta na frente do texto quando aponta para cima, atrás quando aponta para baixo)
  const up = sg.dir === 'up';
  const textY = by + bh * (up ? 0.68 : 0.36);
  const ay0 = by + bh * (up ? 0.42 : 0.58), ay1 = by + bh * (up ? 0.14 : 0.86);
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `700 ${10.5 * Z}px 'Fredoka', sans-serif`;
  ctx.fillText(sg.text, 0, textY);
  ctx.beginPath();
  ctx.moveTo(-9 * Z, ay0); ctx.lineTo(9 * Z, ay0); ctx.lineTo(0, ay1);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawPlayer() {
  SCREEN_X = VW / 2 + (player.wx - cam.x) * MAP_ZOOM;
  SCREEN_Y = VH / 2 + (player.wy - cam.y) * MAP_ZOOM;
  let anim, idx = 0;
  if (player.z > 0 || player.vz > 0) {
    anim = 'jump';
    // subida: frames 0-2, pico 2, descida 3-4
    const p = player.vz > 170 ? 1 : player.vz > -170 ? 2 : 3;
    idx = player.z < 12 && player.vz > 0 ? 0 : player.z < 12 ? 4 : p;
  } else if (player.moving) {
    if (player.running) { anim = 'run'; idx = Math.floor(player.t * 17) % 13; }
    else { anim = 'walk'; idx = Math.floor(player.t * 11) % 13; }
  } else {
    anim = 'idle';
  }
  const img = frames[anim][idx];
  const cs = LEVELS[levelId].charScale || 1;     // tamanho do Genésio em relação à fase
  const sc = SCALE[anim] * CHAR_SCALE * cs;
  const w = img.width * sc, h = img.height * sc;
  const x = SCREEN_X - w / 2, y = SCREEN_Y - player.z - h;
  // sombra
  const shrink = 1 - Math.min(player.z / 150, 0.5);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(SCREEN_X, SCREEN_Y - 4, 30 * cs * shrink, 8 * cs * shrink, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  // só há frames virados para a direita: espelha ao ir para a esquerda
  if (anim !== 'idle' && player.facing < 0) {
    ctx.translate(SCREEN_X, 0); ctx.scale(-1, 1); ctx.translate(-SCREEN_X, 0);
  }
  ctx.drawImage(img, x, y, w, h);
  ctx.restore();
}

function resize() {
  const s = Math.min(innerWidth / VW, innerHeight / VH);
  canvas.style.width = VW * s + 'px';
  canvas.style.height = VH * s + 'px';
  // ampliação em escala fracionária fica mais nítida suavizada; só em escala inteira mantém os pixels "duros"
  canvas.style.imageRendering = Math.abs(s - Math.round(s)) < .01 ? 'pixelated' : 'auto';
  // menus, diálogos e botões crescem junto com o monitor (1.0 até 2.2x), para não ficarem miúdos em telas grandes
  document.documentElement.style.setProperty('--k', Math.max(1, Math.min(2.2, s)).toFixed(3));
}
addEventListener('resize', resize); resize();

let last = performance.now(), demoT = 0;
function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.05); last = now;
  ctx.clearRect(0, 0, VW, VH);
  if (ready) {
    if (state === 'runner') {
      Runner.update(dt);
      Runner.draw(ctx);
    } else if (state === 'nplay') {
      Nature.update(dt);
      Nature.draw(ctx);
    } else if (state === 'kplay') {
      Climb.update(dt);
      Climb.draw(ctx);
    } else if (state === 'hplay') {
      Hop.update(dt);
      Hop.draw(ctx);
    } else if (state === 'splay') {
      Solar.update(dt);
      Solar.draw(ctx);
    } else if (state === 'fplay') {
      Flow.update(dt);
      Flow.draw(ctx);
    } else if (state === 'playing' || state === 'prompt' || state === 'talk') {
      if (state === 'playing') { update(dt); checkOasisSign(); }
      if (talkFocus && state === 'talk') {                       // conversa mostrando um lugar: a câmera desliza até ele
        talkCam.x += (talkFocus.x - talkCam.x) * Math.min(1, dt * 3.2); talkCam.y += (talkFocus.y - talkCam.y) * Math.min(1, dt * 3.2);
      } else { talkCam.x += (player.wx - talkCam.x) * Math.min(1, dt * 6); talkCam.y += (player.wy - talkCam.y) * Math.min(1, dt * 6); if (state !== 'talk') { talkCam.x = player.wx; talkCam.y = player.wy; } }
      updateCamera(talkCam.x, talkCam.y);
      drawMap();
      // as placas ficam "no chão": quem está mais ao norte é desenhado atrás delas
      const signs = [
        ...SIGNS.filter(sg => sg.level === levelId).map(sg => ({ y: sg.y, draw: () => drawSign(sg) })),
        ...GATES.filter(gt => gt.level === levelId).map(gt => ({ y: gt.y, draw: () => drawGate(gt) })),
      ];
      for (const sg of signs) if (sg.y <= player.wy) sg.draw();
      drawPlayer();
      drawFront();
      for (const sg of signs) if (sg.y > player.wy) sg.draw();
      if (talkFocus && state === 'talk') drawFocusArrow(talkFocus);     // por cima das placas
    } else {
      // fundo do menu: câmera passeando pelo mapa
      demoT += dt;
      updateCamera(mapImg.width / 2 + Math.sin(demoT * 0.3) * 400, mapImg.height / 2 + Math.cos(demoT * 0.23) * 300);
      drawMap();
    }
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ---- telas / menu ----
let state = 'loading', started = false;
function show(name) {
  if (name !== 'talk' && typeof Talk !== 'undefined' && Talk.isActive()) Talk.skip();      // saiu da conversa por outro caminho (menu, etc.)
  state = name;
  document.body.classList.toggle('on-login', name === 'login');
  if (typeof refreshProfileCard === 'function') refreshProfileCard();
  for (const id of ['loading', 'menu', 'settings', 'desert', 'prompt', 'oasis', 'difficulty', 'nature', 'serra', 'iguacu', 'lvload', 'login']) $(id).classList.toggle('active', id === name);
  if (name !== 'runner') $('rOverlay').classList.remove('active');
  if (name !== 'nplay') $('nOverlay').classList.remove('active');
  if (name !== 'kplay') $('kOverlay').classList.remove('active');
  if (name !== 'hplay') $('hOverlay').classList.remove('active');
  if (name !== 'splay') $('sOverlay').classList.remove('active');
  if (name !== 'fplay') $('fOverlay').classList.remove('active');
  document.body.classList.toggle('playing', name === 'playing' || name === 'runner' || name === 'nplay' || name === 'kplay' || name === 'hplay' || name === 'splay' || name === 'fplay');
  if (name === 'menu') { $('btnStart').textContent = started ? 'Continuar' : 'Começar'; $('menu').classList.toggle('started', started); }
}
// conversa de boas-vindas (só quando começa um jogo novo; "Continuar" volta direto)
// cartão do jogador: aparece no menu e andando pelos mapas (nas fases cada uma tem o seu placar)
function refreshProfileCard() {
  const card = $('profileCard'); if (!card) return;
  const on = state === 'menu' || state === 'playing' || state === 'prompt';
  card.hidden = !on;
  if (!on) return;
  const nome = typeof Account !== 'undefined' && Account.user();
  $('pcName').textContent = nome || 'Visitante';
  let coins = 0; try { coins = +localStorage.getItem('genesio-coins') || 0; } catch (e) {}
  $('pcCoins').textContent = coins.toLocaleString('pt-BR');
  $('acLogout').hidden = !(nome && state === 'menu');
}
setInterval(refreshProfileCard, 500);
function welcomeScript() {
  const touch = document.body.classList.contains('touch');
  const nome = typeof Account !== 'undefined' && Account.user();
  return [
    { pose: 'a', text: nome ? `Olá, ${nome}! Que bom que você está aqui!` : 'Olá! Que bom que você está aqui!' },
    { pose: 'b', text: 'Eu sou o Genésio e vou ser o seu guia nesta aventura pela cidade. Deixa eu te mostrar o caminho!' },
    // focus: a câmera vai até o lugar e uma seta aponta para ele
    { pose: 'c', text: 'Descendo por esta rua você chega em Nova Iguaçu. Lá fica o Oásis Residencial, uma corrida pelo deserto!', focus: { x: 690, y: 1160, label: 'Nova Iguaçu' } },
    { pose: 'e', text: 'E passando por este portal você sobe a serra até Teresópolis: lá estão o Nature, o Solar do Bosque e o Flow Residencial.', focus: { x: 627, y: 170, label: 'Teresópolis' } },
    { pose: 'd', text: touch ? 'No celular é só seguir as setinhas e os botões que aparecem na tela. Simples assim!'
      : 'Use as setas ou WASD para andar, Shift para correr e Espaço para pular. É fácil, você vai pegar rapidinho!' },
    { pose: 'e', text: 'Fique de olho nas placas pelo caminho: elas levam para as fases. Chegou perto ou tocou nelas, é só aceitar o desafio!' },
    { pose: 'a', text: 'Junte GenesisCoins em todas as fases: elas ficam guardadas na sua conta. Pronto? Então vamos nessa. Boa aventura!' },
  ];
}
function startGame() {
  Sound.startMusic();
  const first = !started;
  started = true;
  for (const k in keys) keys[k] = false;
  show('playing');
  if (first && typeof Talk !== 'undefined') {
    show('talk');
    Talk.start(welcomeScript(), () => { for (const k in keys) keys[k] = false; if (state === 'talk') show('playing'); });
  }
}
function openMenu() { show('menu'); }

function syncAudioUI() {
  const S = Sound.S;
  for (const id of ['btnMusic', 'muteMusic']) $(id).classList.toggle('off', S.muteMusic);
  for (const id of ['btnSfx', 'muteSfx']) $(id).classList.toggle('off', S.muteSfx);
  $('volMusic').value = S.music * 100;
  $('volSfx').value = S.sfx * 100;
}
syncAudioUI();
const click = (id, fn) => $(id).addEventListener('click', () => { Sound.init(); Sound.click(); document.activeElement.blur(); fn(); });
click('btnStart', startGame);
click('btnSettings', () => show('settings'));
click('btnBack', () => show('menu'));
click('btnPause', () => state === 'runner' ? Runner.togglePause() : state === 'nplay' ? Nature.togglePause() : state === 'kplay' ? Climb.togglePause() : state === 'hplay' ? Hop.togglePause() : state === 'splay' ? Solar.togglePause() : state === 'fplay' ? Flow.togglePause() : openMenu());
for (const id of ['btnMusic', 'muteMusic']) click(id, () => { Sound.startMusic(); Sound.toggleMusic(); syncAudioUI(); });
for (const id of ['btnSfx', 'muteSfx']) click(id, () => { Sound.toggleSfx(); syncAudioUI(); });
click('btnFull', () => { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(); });
$('volMusic').addEventListener('input', e => { Sound.startMusic(); Sound.setMusic(e.target.value / 100); });
$('volSfx').addEventListener('input', e => { Sound.init(); Sound.setSfx(e.target.value / 100); });
$('btnPause').addEventListener('keydown', e => e.preventDefault()); // espaço não aciona o botão

// ---- troca de fase ----
function toast(msg, ms = 2200) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.h);
  toast.h = setTimeout(() => t.classList.remove('show'), ms);
}
const wait = ms => new Promise(r => setTimeout(r, ms));
function loadImage(src) {
  return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
}
async function goToLevel(id) {
  if (state === 'transition') return;
  state = 'transition';
  for (const k in keys) keys[k] = false;
  player.moving = false;
  const lv = LEVELS[id], fromLevel = levelId;
  toast(lv.enter, 2600);
  $('desertTitle').textContent = lv.name;
  const scr = lv.theme === 'serra' ? 'serra' : lv.theme === 'iguacu' ? 'iguacu' : id === 'praca' ? 'loading' : 'desert';      // lobby: a mesma arte do carregamento inicial
  await wait(1600);
  show(scr); state = 'transition';
  const bar = $({ serra: 'serraFill', iguacu: 'iguacuFill', loading: 'barFill' }[scr] || 'desertFill'), txt = $({ serra: 'serraText', iguacu: 'iguacuText', loading: 'loadText' }[scr] || 'desertText');
  const tips = lv.tips || ['Aquecendo o asfalto...', 'Procurando o caminho...', 'Espantando os urubus...', 'Quase lá...'];
  const t0 = performance.now(), MIN = 3500;
  bar.style.width = '0%';
  const imgP = levelImgs[id] ? Promise.resolve(levelImgs[id]) : loadImage(lv.file);
  let img = null, mask = null; imgP.then(i => img = i);
  const maskP = lv.mask ? (lv.maskData ? Promise.resolve(lv.maskData) : loadMask(lv.mask)) : Promise.resolve(null);
  maskP.then(m => { mask = m; lv.maskData = m; });
  let water = null; const waterP = lv.waterExit ? (lv.waterData ? Promise.resolve(lv.waterData) : loadMask(lv.waterExit.file)) : Promise.resolve(null);
  waterP.then(m => { water = m || false; lv.waterData = m; });
  while (!img || (lv.mask && !mask) || (lv.waterExit && !water) || performance.now() - t0 < MIN) {
    const p = Math.min((performance.now() - t0) / MIN, 1) * (img ? 100 : 90);
    bar.style.width = p + '%';
    txt.textContent = scr === 'loading' ? `Voltando para o lobby... ${Math.round(p)}%` : tips[Math.min(tips.length - 1, Math.floor(p / 100 * tips.length))];
    await wait(60);
  }
  bar.style.width = '100%';
  levelImgs[id] = mapImg = img; levelId = id;
  // ao voltar, reaparece perto da saída de onde veio (borda de baixo)
  walkMask = mask; waterMask = water || null; MAP_ZOOM = lv.zoom || 1.5;
  [player.wx, player.wy] = RETURN_POS[id + '<-' + fromLevel] || lv.start;
  player.z = player.vz = 0;
  await wait(400);
  show('playing');
  toast(lv.name, 2200);
}

// ---- fase Oásis Residencial (corrida) ----
let promptBlocked = false;   // depois de "Não" (ou de sair da fase) só pergunta de novo se o jogador se afastar da placa
let promptKind = 'oasis';
let promptSign = null;       // última placa que abriu a pergunta: só ela fica bloqueada até o Genésio se afastar (as outras funcionam normalmente)
function checkOasisSign() {
  for (const sg of SIGNS) {
    if ((!sg.oasis && !sg.nature && !sg.solar && !sg.flow) || sg.level !== levelId) continue;
    const d = Math.hypot(player.wx - sg.x, player.wy - sg.y);
    if (promptBlocked && sg === promptSign) {
      if (d > 108) promptBlocked = false;           // se afastou da placa: libera de novo
      continue;
    }
    if (d < (sg.nature || sg.solar || sg.flow ? 40 : 55)) { promptSign = sg; promptBlocked = true; openPrompt(sg.flow ? 'flow' : sg.solar ? 'solar' : sg.nature ? 'nature' : 'oasis'); return; }
  }
}
// ---- clicar/tocar numa placa também abre o convite para iniciar a fase ----
let hoverSign = null;
const signKind = sg => sg.flow ? 'flow' : sg.solar ? 'solar' : sg.nature ? 'nature' : sg.oasis ? 'oasis' : null;
function signAtClient(cx, cy) {
  if (state !== 'playing') return null;
  const c = $('c'), r = c.getBoundingClientRect();
  const sx = (cx - r.left) * VW / r.width, sy = (cy - r.top) * VH / r.height;
  for (const sg of SIGNS) {
    if (sg.level !== levelId || !signKind(sg)) continue;
    const px = VW / 2 + (sg.x - cam.x) * MAP_ZOOM, py = VH / 2 + (sg.y - cam.y) * MAP_ZOOM, Z = MAP_ZOOM * (sg.ss || 1);
    const bw = Math.max(sg.w * Z, 40), top = py - 70 * Z - 48 * Z * 0.55;
    const pad = 10 * (r.width / VW > 0 ? VW / r.width : 1);              // folga de ~10 px na tela, para o dedo
    if (sx >= px - bw / 2 - pad && sx <= px + bw / 2 + pad && sy >= top - pad && sy <= py + 12 + pad) return sg;
  }
  return null;
}
function clickSign(sg) {
  promptSign = sg; promptBlocked = true;
  Sound.init(); Sound.click();
  openPrompt(signKind(sg));
}
$('c').addEventListener('click', e => { const sg = signAtClient(e.clientX, e.clientY); if (sg) clickSign(sg); });
$('c').addEventListener('pointermove', e => {
  if (e.pointerType === 'touch') return;
  hoverSign = signAtClient(e.clientX, e.clientY);
  $('c').style.cursor = hoverSign ? 'pointer' : '';
});
$('c').addEventListener('pointerleave', () => { hoverSign = null; $('c').style.cursor = ''; });
window.worldTap = (cx, cy) => { const sg = signAtClient(cx, cy); if (sg) clickSign(sg); };     // toque curto vindo da área do joystick (touch.js)

function openPrompt(kind) {
  promptKind = kind;
  $('promptText').innerHTML = kind === 'flow' ? 'Iniciar Fase<br>Flow Residencial?<br><small>Voe com a nave pelos pilares.</small>' : kind === 'solar' ? 'Iniciar Fase<br>Solar do Bosque?<br><small>Martelo, plataformas e um golem no final.</small>' : kind === 'nature' ? 'Iniciar Fase<br>Nature?' : 'Iniciar Fase<br>Oásis Residencial?';
  for (const k in keys) keys[k] = false;
  player.moving = false;
  show('prompt');
}
function closePrompt() { promptBlocked = true; show('playing'); }
function backToMap() { promptBlocked = true; show('playing'); }

function refreshBests() {
  const b = Runner.bests();
  for (const k in b) $('best-' + k).textContent = b[k] ? `Recorde: ${b[k]}` : 'Sem recorde ainda';
}
// carrega uma fase mostrando progresso; se a rede falhar oferece tentar de novo. Só aparece se demorar (evita piscar quando já está em cache)
let lvToken = 0;
// art (opcional): { screen, fill, text, label } = usa uma tela com arte própria (ex.: Oásis com a arte de Nova Iguaçu)
async function loadWithScreen(title, starter, onOk, onBack, art) {
  const token = ++lvToken;
  for (const k in keys) keys[k] = false;
  Loader.reset(); state = 'lvload';
  const fill = $(art ? art.fill : 'lvFill'), text = $(art ? art.text : 'lvText'), label = art ? art.label : 'Baixando...';
  const showTimer = setTimeout(() => { if (token !== lvToken) return; $('lvTitle').textContent = title; fill.style.width = '0%'; text.textContent = label + ' 0%'; $('lvErr').hidden = true; $('lvload').classList.remove('err'); show(art ? art.screen : 'lvload'); state = 'lvload'; }, 120);
  Loader.onProgress = (d, t) => { const p = t ? Math.round(d / t * 100) : 0; fill.style.width = p + '%'; text.textContent = `${label} ${p}%`; };
  try { await starter(); }
  catch (e) {
    clearTimeout(showTimer); Loader.onProgress = null; console.error(e);
    if (token !== lvToken) return;
    show('lvload'); state = 'lvload'; $('lvTitle').textContent = title; $('lvload').classList.add('err');
    $('lvText').textContent = navigator.onLine === false ? 'Sem internet. Conecte-se e tente de novo.' : 'Não foi possível carregar a fase. Verifique a conexão.';
    $('lvErr').hidden = false;
    $('lvRetry').onclick = () => loadWithScreen(title, starter, onOk, onBack, art);
    $('lvBack').onclick = () => { lvToken++; onBack(); };
    return;
  }
  clearTimeout(showTimer); Loader.onProgress = null;
  if (token !== lvToken) return;
  onOk();
}
async function beginRun(diff) {
  await loadWithScreen('Oásis Residencial', () => Runner.start(diff), () => show('runner'), () => show('oasis'), { screen: 'iguacu', fill: 'iguacuFill', text: 'iguacuText', label: 'Preparando o Oásis Residencial...' });
}
function exitRunner() { Runner.stop(); promptBlocked = true; show('playing'); }

click('btnYes', () => { if (promptKind === 'flow') beginFlow(); else if (promptKind === 'solar') beginSolar(); else if (promptKind === 'nature') openNature(); else show('oasis'); });
click('btnNo', closePrompt);
click('btnOasisStart', () => { refreshBests(); show('difficulty'); });
click('btnOasisBack', backToMap);
click('btnDiffBack', () => show('oasis'));
document.querySelectorAll('.diff').forEach(b => b.addEventListener('click', () => { Sound.init(); Sound.click(); b.blur(); beginRun(b.dataset.diff); }));
click('rPrimary', () => Runner.primary());
click('rDiff', () => { Runner.stop(); refreshBests(); show('difficulty'); });
click('rExit', exitRunner);

// ---- fase Nature (desafios de plataforma) ----
function openNature() {
  $('natCoins').textContent = Nature.coins();
  $('natBest-hop').textContent = Hop.best() ? `Recorde: ${Hop.best()} pts` : 'Sem recorde';
  $('natBest-climb').textContent = Climb.best() ? `Recorde: ${Climb.best()} m` : 'Sem recorde';
  for (const c of Nature.CHALLENGES) { const b = $('natBest-' + c.id); if (b) b.textContent = Nature.best(c.id) ? `Melhor: ${Nature.best(c.id)}/${Nature.EPIS.length}` : 'Sem recorde'; }
  show('nature');
}
async function beginChallenge(id) {
  const mod = id === 'climb' ? Climb : id === 'hop' ? Hop : Nature;
  await loadWithScreen('Nature', () => mod.start(id), () => show(id === 'climb' ? 'kplay' : id === 'hop' ? 'hplay' : 'nplay'), () => show('nature'));
}
document.querySelectorAll('[data-challenge]').forEach(b => b.addEventListener('click', () => { Sound.init(); Sound.click(); b.blur(); beginChallenge(b.dataset.challenge); }));
click('btnNatureBack', backToMap);
click('nPrimary', () => Nature.primary());
click('nChallenges', () => { Nature.stop(); openNature(); });
click('nExit', () => { Nature.stop(); promptBlocked = true; show('playing'); });
click('kPrimary', () => Climb.primary());
click('kEnd', () => Climb.endNow());
click('kChallenges', () => { Climb.stop(); openNature(); });
click('kExit', () => { Climb.stop(); promptBlocked = true; show('playing'); });
click('hPrimary', () => Hop.primary());
click('hChallenges', () => { Hop.stop(); openNature(); });
click('hExit', () => { Hop.stop(); promptBlocked = true; show('playing'); });

// Solar do Bosque: a saída só libera depois da animação de morte do golem.
async function beginSolar() {
  if (state === 'lvload') return;
  await loadWithScreen('Solar do Bosque', () => Solar.start(), () => show('splay'), () => backToMap());
}
click('sPrimary', () => { for (const k in keys) keys[k] = false; Solar.primary(); });
click('sRestart', () => { for (const k in keys) keys[k] = false; Solar.restartAll(); });
click('sExit', () => { Solar.leave(); backToMap(); });
// Flow Residencial (voo estilo Flappy Bird)
async function beginFlow() {
  if (state === 'lvload') return;
  await loadWithScreen('Flow Residencial', () => Flow.start(), () => show('fplay'), () => backToMap());
}
click('fPrimary', () => { for (const k in keys) keys[k] = false; Flow.primary(); });
click('fExit', () => { Flow.stop(); backToMap(); });
addEventListener('blur', () => {
  for (const k in keys) keys[k] = false;
  if (state === 'fplay' && !Flow._debug().paused && !Flow._debug().dead && !Flow._debug().ended) Flow.togglePause();
  if (state === 'splay' && !Solar._debug().paused && !Solar._debug().ended) Solar.togglePause();
});

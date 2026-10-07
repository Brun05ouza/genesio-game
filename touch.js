// Controles de celular: joystick virtual + botões, só nas fases que precisam (lobby, Nature e Solar do Bosque).
// Tudo vira as mesmas teclas que o jogo já usa (A/D/W/S, Espaço, Shift, J, C, F), então nenhuma fase precisou mudar a lógica.
(() => {
  const root = document.getElementById('touch');
  if (!root) return;
  const body = document.body;

  // ---- celular x desktop: decide pelo aparelho e depois pela ENTRADA que a pessoa está usando ----
  // Começa em modo toque só em aparelhos que são mesmo celular/tablet. Depois: um toque na tela liga os controles
  // de toque, e usar o mouse ou o teclado desliga (assim notebook com tela de toque funciona nos dois jeitos).
  const ua = navigator.userAgent || '';
  const isPhoneOrTablet = /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle/i.test(ua)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)                       // iPad pedindo "site para computador"
    || (matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches);   // só tem dedo como ponteiro
  const setTouch = on => { if (body.classList.contains('touch') !== on) body.classList.toggle('touch', on); };
  setTouch(isPhoneOrTablet);
  addEventListener('pointerdown', e => { if (e.pointerType === 'touch' || e.pointerType === 'pen') setTouch(true); }, true);
  addEventListener('pointermove', e => { if (e.pointerType === 'mouse') setTouch(false); }, true);
  addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') setTouch(false); }, true);
  addEventListener('keydown', e => { if (!e.repeat && !['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) setTouch(false); }, true);
  addEventListener('contextmenu', e => { if (body.classList.contains('touch')) e.preventDefault(); });

  // ---- inverter botões (Configurações): joystick à direita e botões à esquerda; fica salvo no aparelho ----
  const swapBtn = document.getElementById('btnSwap');
  const getSwap = () => { try { return localStorage.getItem('genesio-swap-controls') === '1'; } catch (e) { return false; } };
  function applySwap(on) {
    body.classList.toggle('swap', on);
    if (swapBtn) { swapBtn.textContent = on ? 'Sim' : 'Não'; swapBtn.setAttribute('aria-pressed', on); }
  }
  applySwap(getSwap());
  if (swapBtn) swapBtn.addEventListener('click', () => {
    const on = !body.classList.contains('swap');
    try { localStorage.setItem('genesio-swap-controls', on ? '1' : '0'); } catch (e) {}
    applySwap(on);
    if (typeof Sound !== 'undefined') { Sound.init(); Sound.click(); }
  });

  // ---- teclas virtuais (soltar com atraso mínimo para o jogo não perder toques muito rápidos) ----
  // Soltar só depois de 70 ms E de 2 quadros do jogo: assim um toque rápido nunca se perde, mesmo se o aparelho engasgar num quadro.
  let frame = 0;
  const since = {}, sinceF = {}, pending = new Set(), virt = new Set();      // virt: teclas que foram os controles de toque que apertaram
  function press(code) { pending.delete(code); virt.add(code); if (!keys[code]) { since[code] = performance.now(); sinceF[code] = frame; } keys[code] = true; }
  function release(code) {
    if (!keys[code]) return;
    if (performance.now() - (since[code] || 0) >= 70 && frame - (sinceF[code] || 0) >= 2) { pending.delete(code); virt.delete(code); keys[code] = false; }
    else pending.add(code);
  }
  function flushReleases() { for (const c of [...pending]) if (performance.now() - (since[c] || 0) >= 70 && frame - (sinceF[c] || 0) >= 2) { pending.delete(c); virt.delete(c); keys[c] = false; } }
  const ALL = ['KeyA', 'KeyD', 'KeyW', 'KeyS', 'Space', 'ShiftLeft', 'KeyJ', 'KeyC', 'KeyF'];
  const releaseAll = () => { pending.clear(); for (const c of ALL) if (virt.has(c)) { keys[c] = false; virt.delete(c); } };   // só solta o que o toque apertou (não a tecla de verdade)

  // ---- modos por estado do jogo ----
  const B = {
    jump: { code: 'Space', label: 'Pular', cls: 'b-jump' },
    run: { code: 'ShiftLeft', label: 'Correr', cls: 'b-run' },
    dodge: { code: 'ShiftLeft', label: 'Esquiva', cls: 'b-dodge' },
    atk: { code: 'KeyJ', label: 'Bater', cls: 'b-atk' },
    throw: { code: 'KeyC', label: 'Lançar', cls: 'b-throw', aim: true },
    special: { code: 'KeyF', label: 'Pregos', cls: 'b-special' },
  };
  const MODES = {
    walk: { joy: 'xy', buttons: [B.jump, B.run] },                         // lobby, Nature (EPIs e torre)
    hop: { joy: 'x', buttons: [] },                                        // subida infinita: só esquerda/direita
    solar: { joy: 'xy', up: .6, buttons: [B.jump, B.atk, B.dodge, B.throw, B.special] },
  };
  const STATE_MODE = { playing: 'walk', nplay: 'walk', kplay: 'walk', hplay: 'hop', splay: 'solar' };

  // ---- joystick flutuante: aparece onde o dedo toca, na metade esquerda da tela ----
  const zone = root.querySelector('.joy-zone'), base = root.querySelector('.joy-base'), knob = root.querySelector('.joy-knob'), idle = root.querySelector('.joy-idle');
  let joyId = null, cx = 0, cy = 0, cfg = MODES.walk;
  const dirs = { KeyA: false, KeyD: false, KeyW: false, KeyS: false };
  function setDir(code, on) { if (dirs[code] === on) return; dirs[code] = on; on ? press(code) : release(code); }
  function joyMove(x, y) {
    const R = base.offsetWidth / 2 || 60;
    let dx = x - cx, dy = y - cy; const len = Math.hypot(dx, dy) || 1, k = Math.min(1, len / R);
    const kx = dx / len * k * R, ky = dy / len * k * R;
    knob.style.transform = `translate(${kx}px,${ky}px)`;
    const t = .32, tu = cfg.up || t;
    setDir('KeyD', dx / R > t); setDir('KeyA', dx / R < -t);
    if (cfg.joy === 'xy') { setDir('KeyW', dy / R < -tu); setDir('KeyS', dy / R > t + .1); } else { setDir('KeyW', false); setDir('KeyS', false); }
  }
  function joyEnd() { joyId = null; base.classList.remove('on'); idle.style.opacity = ''; for (const c in dirs) setDir(c, false); knob.style.transform = ''; }
  let tapT = 0, tapX = 0, tapY = 0;                                       // toque curto na área do joystick = clique no mundo (placas)
  zone.addEventListener('pointerdown', e => {
    if (joyId !== null) return;
    tapT = performance.now(); tapX = e.clientX; tapY = e.clientY;
    e.preventDefault(); joyId = e.pointerId; zone.setPointerCapture(e.pointerId);
    const r = zone.getBoundingClientRect(), R = base.offsetWidth / 2 || 60;
    cx = Math.max(r.left + R, Math.min(r.right - R, e.clientX)); cy = Math.max(r.top + R, Math.min(r.bottom - R, e.clientY));
    base.style.left = cx - r.left + 'px'; base.style.top = cy - r.top + 'px'; base.classList.add('on'); idle.style.opacity = '0';
    joyMove(e.clientX, e.clientY);
  });
  zone.addEventListener('pointermove', e => { if (e.pointerId === joyId) { e.preventDefault(); joyMove(e.clientX, e.clientY); } });
  zone.addEventListener('pointerup', e => {
    if (e.pointerId === joyId && performance.now() - tapT < 280 && Math.hypot(e.clientX - tapX, e.clientY - tapY) < 14 && window.worldTap) window.worldTap(e.clientX, e.clientY);
  });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) zone.addEventListener(ev, e => { if (e.pointerId === joyId) joyEnd(); });

  // ---- botões ----
  // O botão "Lançar" é também um joystick de mira: toque rápido lança para a frente; segure e arraste para mirar
  // (a distância arrastada vira a força) e solte para lançar. A fase lê a mira em window.touchAim.
  const touchAim = window.touchAim = { set: false, x: 1, y: 0, mag: 0 };
  const btnBox = root.querySelector('.btns');
  function aimStick(el) {
    const ring = document.createElement('div'), pad = document.createElement('div');
    ring.className = 'aim-ring'; pad.className = 'aim-knob'; ring.appendChild(pad); root.appendChild(ring);
    let cx0 = 0, cy0 = 0, R = 60;
    const upd = (x, y) => {
      const dx = x - cx0, dy = y - cy0, len = Math.hypot(dx, dy), k = Math.min(1, len / R);
      pad.style.transform = `translate(${dx / (len || 1) * k * R}px,${dy / (len || 1) * k * R}px)`;
      if (k > .28) { touchAim.set = true; touchAim.x = dx / len; touchAim.y = dy / len; touchAim.mag = k; }
      else touchAim.set = false;
    };
    return {
      start(e) {
        const r = el.getBoundingClientRect(); cx0 = r.left + r.width / 2; cy0 = r.top + r.height / 2; R = r.width * 1.05;
        ring.style.cssText = `left:${cx0}px;top:${cy0}px;width:${R * 2}px;height:${R * 2}px`; ring.classList.add('on');
        touchAim.set = false; touchAim.mag = 0; upd(e.clientX, e.clientY);
      },
      move: e => upd(e.clientX, e.clientY),
      end() { ring.classList.remove('on'); pad.style.transform = ''; },
    };
  }
  function buildButtons(list) {
    btnBox.innerHTML = ''; root.querySelectorAll('.aim-ring').forEach(r => r.remove());
    for (const b of list) {
      const el = document.createElement('button');
      el.className = 'tbtn ' + b.cls; el.type = 'button'; el.textContent = b.label; el.setAttribute('aria-label', b.label);
      const aim = b.aim ? aimStick(el) : null;
      let pid = null;
      el.addEventListener('pointerdown', e => { e.preventDefault(); pid = e.pointerId; el.setPointerCapture(e.pointerId); el.classList.add('on'); if (aim) aim.start(e); press(b.code); });
      if (aim) el.addEventListener('pointermove', e => { if (e.pointerId === pid) { e.preventDefault(); aim.move(e); } });
      const up = e => { if (e.pointerId !== pid) return; pid = null; el.classList.remove('on'); if (aim) aim.end(); release(b.code); };
      for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(ev, up);
      btnBox.appendChild(el);
    }
  }

  // ---- mostrar/ocultar conforme o estado do jogo ----
  let curMode = null;
  function sync() {
    frame++; flushReleases();
    const menuOpen = !!document.querySelector('.screen.active');              // pausa, resultado, pergunta...
    const mode = body.classList.contains('touch') && !menuOpen && typeof state !== 'undefined' ? STATE_MODE[state] : null;
    if (mode !== curMode) {
      if (curMode) { joyEnd(); releaseAll(); touchAim.set = false; root.querySelectorAll('.aim-ring').forEach(r => r.classList.remove('on')); }
      curMode = mode;
      root.classList.toggle('show', !!mode);
      if (mode) { cfg = MODES[mode]; buildButtons(cfg.buttons); root.dataset.mode = mode; }
    }
    requestAnimationFrame(sync);
  }
  requestAnimationFrame(sync);
  addEventListener('blur', () => { joyEnd(); releaseAll(); });

  // tamanho certo quando o aparelho gira ou a barra do navegador aparece/some
  const fit = () => { if (typeof resize === 'function') resize(); };
  addEventListener('orientationchange', () => { fit(); setTimeout(fit, 150); setTimeout(fit, 500); });
  window.visualViewport?.addEventListener('resize', fit);
})();

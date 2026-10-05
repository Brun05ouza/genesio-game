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

  // ---- teclas virtuais (soltar com atraso mínimo para o jogo não perder toques muito rápidos) ----
  const since = {}, rel = {};
  function press(code) { clearTimeout(rel[code]); if (!keys[code]) since[code] = performance.now(); keys[code] = true; }
  function release(code) {
    if (!keys[code]) return;
    const wait = 70 - (performance.now() - (since[code] || 0));
    clearTimeout(rel[code]);
    if (wait > 0) rel[code] = setTimeout(() => { keys[code] = false; }, wait); else keys[code] = false;
  }
  const ALL = ['KeyA', 'KeyD', 'KeyW', 'KeyS', 'Space', 'ShiftLeft', 'KeyJ', 'KeyC', 'KeyF'];
  const releaseAll = () => { for (const c of ALL) { clearTimeout(rel[c]); keys[c] = false; } };

  // ---- modos por estado do jogo ----
  const B = {
    jump: { code: 'Space', label: 'Pular', cls: 'b-jump' },
    run: { code: 'ShiftLeft', label: 'Correr', cls: 'b-run' },
    dodge: { code: 'ShiftLeft', label: 'Esquiva', cls: 'b-dodge' },
    atk: { code: 'KeyJ', label: 'Bater', cls: 'b-atk' },
    throw: { code: 'KeyC', label: 'Lançar', cls: 'b-throw' },
    special: { code: 'KeyF', label: 'Chuva', cls: 'b-special' },
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
  zone.addEventListener('pointerdown', e => {
    if (joyId !== null) return;
    e.preventDefault(); joyId = e.pointerId; zone.setPointerCapture(e.pointerId);
    const r = zone.getBoundingClientRect(), R = base.offsetWidth / 2 || 60;
    cx = Math.max(r.left + R, Math.min(r.right - R, e.clientX)); cy = Math.max(r.top + R, Math.min(r.bottom - R, e.clientY));
    base.style.left = cx - r.left + 'px'; base.style.top = cy - r.top + 'px'; base.classList.add('on'); idle.style.opacity = '0';
    joyMove(e.clientX, e.clientY);
  });
  zone.addEventListener('pointermove', e => { if (e.pointerId === joyId) { e.preventDefault(); joyMove(e.clientX, e.clientY); } });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) zone.addEventListener(ev, e => { if (e.pointerId === joyId) joyEnd(); });

  // ---- botões ----
  const btnBox = root.querySelector('.btns');
  function buildButtons(list) {
    btnBox.innerHTML = '';
    for (const b of list) {
      const el = document.createElement('button');
      el.className = 'tbtn ' + b.cls; el.type = 'button'; el.textContent = b.label; el.setAttribute('aria-label', b.label);
      let pid = null;
      el.addEventListener('pointerdown', e => { e.preventDefault(); pid = e.pointerId; el.setPointerCapture(e.pointerId); el.classList.add('on'); press(b.code); });
      const up = e => { if (e.pointerId !== pid) return; pid = null; el.classList.remove('on'); release(b.code); };
      for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(ev, up);
      btnBox.appendChild(el);
    }
  }

  // ---- mostrar/ocultar conforme o estado do jogo ----
  let curMode = null;
  function sync() {
    const menuOpen = !!document.querySelector('.screen.active');              // pausa, resultado, pergunta...
    const mode = body.classList.contains('touch') && !menuOpen && typeof state !== 'undefined' ? STATE_MODE[state] : null;
    if (mode !== curMode) {
      if (curMode) { joyEnd(); releaseAll(); }
      curMode = mode;
      root.classList.toggle('show', !!mode);
      if (mode) { cfg = MODES[mode]; buildButtons(cfg.buttons); root.dataset.mode = mode; }
    }
    requestAnimationFrame(sync);
  }
  requestAnimationFrame(sync);
  addEventListener('blur', () => { joyEnd(); releaseAll(); });

  // ---- tela cheia + travar na horizontal ao tocar em "Começar" (onde o navegador permitir) ----
  document.getElementById('btnStart')?.addEventListener('click', () => {
    if (!body.classList.contains('touch') || document.fullscreenElement) return;
    const el = document.documentElement;
    (el.requestFullscreen ? el.requestFullscreen() : Promise.reject()).then(() => screen.orientation?.lock?.('landscape')).catch(() => {});
  });
  // tamanho certo quando o aparelho gira ou a barra do navegador aparece/some
  const fit = () => { if (typeof resize === 'function') resize(); };
  addEventListener('orientationchange', () => { fit(); setTimeout(fit, 150); setTimeout(fit, 500); });
  window.visualViewport?.addEventListener('resize', fit);
})();

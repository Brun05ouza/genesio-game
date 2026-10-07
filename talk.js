// Conversa estilo Pokémon FireRed: o Genésio aparece, o texto vai surgindo letra por letra e a pessoa toca/clica (ou Enter/Espaço) para avançar.
const Talk = (() => {
  const root = document.getElementById('talk');
  const who = document.getElementById('talkWho'), txt = document.getElementById('talkText'), pic = document.getElementById('talkPic'), more = document.getElementById('talkMore');
  const skipBtn = document.getElementById('talkSkip');
  const SPEED = 30;                                   // ms por letra
  let lines = [], i = 0, shown = 0, timer = null, active = false, onEnd = null, typing = false, lockUntil = 0;

  const poseSrc = p => `assets/menu-g-${p}.png`;
  function say(n) {
    const l = lines[n]; i = n; shown = 0; typing = true;
    who.textContent = l.who || 'Genésio';
    root.classList.toggle('right', l.side === 'right'); root.classList.toggle('boss', !!l.boss); root.classList.toggle('dim', !!l.dim);
    if (l.pic) pic.src = l.pic; else if (l.pose) pic.src = poseSrc(l.pose);
    pic.classList.remove('hop'); void pic.offsetWidth; pic.classList.add('hop');
    root.classList.add('typing'); more.hidden = true; txt.textContent = '';
    clearInterval(timer);
    timer = setInterval(() => {
      shown++; txt.textContent = l.text.slice(0, shown);
      if (shown % 2 === 0 && l.text[shown - 1] !== ' ' && typeof Sound !== 'undefined') Sound.blip(!!lines[i].boss);
      if (shown >= l.text.length) finishLine();
    }, SPEED);
  }
  function finishLine() {
    clearInterval(timer); typing = false; shown = lines[i].text.length; txt.textContent = lines[i].text;
    root.classList.remove('typing'); more.hidden = false;
  }
  function advance() {
    if (!active || performance.now() < lockUntil) return;
    if (typing) { finishLine(); return; }
    if (typeof Sound !== 'undefined') { Sound.init(); Sound.click(); }
    if (i + 1 < lines.length) say(i + 1); else end();
  }
  function end() {
    if (!active) return;
    active = false; clearInterval(timer);
    root.classList.add('leaving');
    setTimeout(() => { if (!active) { root.hidden = true; root.classList.remove('leaving', 'typing', 'right', 'boss', 'dim'); } }, 220);
    const cb = onEnd; onEnd = null; if (cb) cb();
  }
  function start(script, done) {
    lines = script; onEnd = done; active = true; i = 0;
    root.hidden = false; root.classList.remove('leaving');
    lockUntil = performance.now() + 450;               // evita que o toque que abriu a conversa já avance a primeira fala
    say(0);
  }

  root.addEventListener('pointerdown', e => {
    if (e.target.closest('#talkSkip')) return;
    e.preventDefault(); advance();
  });
  skipBtn.addEventListener('click', e => { e.stopPropagation(); if (typeof Sound !== 'undefined') { Sound.init(); Sound.click(); } end(); });
  addEventListener('keydown', e => {
    if (!active) return;
    if (['Enter', 'NumpadEnter', 'Space', 'KeyZ', 'KeyX', 'KeyE'].includes(e.code)) { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) advance(); }
    else if (e.code === 'Escape') { e.stopImmediatePropagation(); end(); }
  }, true);

  return { start, skip: end, isActive: () => active, advance, _debug: () => ({ i, typing, shown, n: lines.length }) };
})();

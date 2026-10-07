// Áudio sintetizado (sem arquivos): música em loop + efeitos
const Sound = (() => {
  let ac, master, musicGain, sfxGain, timer, step = 0, nextT = 0;
  const S = { music: 0.6, sfx: 0.8, muteMusic: false, muteSfx: false };
  try { Object.assign(S, JSON.parse(localStorage.getItem('genesio-audio') || '{}')); } catch (e) {}

  const save = () => { try { localStorage.setItem('genesio-audio', JSON.stringify(S)); } catch (e) {} };
  const apply = () => {
    if (!ac) return;
    musicGain.gain.value = S.muteMusic ? 0 : S.music * 0.35;
    sfxGain.gain.value = S.muteSfx ? 0 : S.sfx * 0.5;
  };
  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain(); master.connect(ac.destination);
    musicGain = ac.createGain(); musicGain.connect(master);
    sfxGain = ac.createGain(); sfxGain.connect(master);
    apply();
  }
  function tone(freq, t, dur, type, out, vol, slideTo) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.02);
  }
  const N = n => 261.63 * Math.pow(2, n / 12); // n = semitons acima de C4
  const LEAD = [0,4,7,12, 9,7,4,7, 5,9,12,9, 7,4,2,4, 0,4,7,12, 14,12,9,7, 5,7,9,5, 7,4,0,-1];
  const BASS = [-12,-12,-5,-5, -7,-7,-12,-12];
  function schedule() {
    while (nextT < ac.currentTime + 0.3) {
      const i = step % LEAD.length;
      tone(N(LEAD[i]), nextT, 0.16, 'square', musicGain, 0.25);
      if (i % 4 === 0) tone(N(BASS[(i / 4) % BASS.length]), nextT, 0.5, 'triangle', musicGain, 0.6);
      nextT += 0.19; step++;
    }
  }
  return {
    S,
    init,
    startMusic() { init(); if (timer) return; nextT = ac.currentTime + 0.05; timer = setInterval(schedule, 80); },
    setMusic(v) { S.music = v; apply(); save(); },
    setSfx(v) { S.sfx = v; apply(); save(); },
    toggleMusic() { S.muteMusic = !S.muteMusic; apply(); save(); return S.muteMusic; },
    toggleSfx() { S.muteSfx = !S.muteSfx; apply(); save(); return S.muteSfx; },
    blip(low) { if (ac) { if (low) tone(150 + Math.random() * 45, ac.currentTime, 0.07, 'sawtooth', sfxGain, 0.3); else tone(760 + Math.random() * 110, ac.currentTime, 0.045, 'square', sfxGain, 0.22); } },
    click() { if (ac) tone(660, ac.currentTime, 0.08, 'square', sfxGain, 0.5); },
    jump() { if (ac) tone(300, ac.currentTime, 0.22, 'square', sfxGain, 0.5, 700); },
    hit() { if (ac) { tone(220, ac.currentTime, 0.25, 'sawtooth', sfxGain, 0.6, 70); } },
    die() { if (ac) { const t = ac.currentTime; [330, 262, 196, 131].forEach((f, i) => tone(f, t + i * 0.18, 0.3, 'square', sfxGain, 0.5)); } },
    coin() { if (ac) { const t = ac.currentTime; tone(988, t, 0.09, 'square', sfxGain, 0.4); tone(1319, t + 0.07, 0.18, 'square', sfxGain, 0.4); } },
    block() { if (ac) { const t = ac.currentTime; tone(900, t, 0.12, 'triangle', sfxGain, 0.7, 450); tone(220, t, 0.1, 'square', sfxGain, 0.3); } },
    power() { if (ac) { const t = ac.currentTime; [392, 494, 587, 784, 988].forEach((f, i) => tone(f, t + i * 0.09, 0.2, 'square', sfxGain, 0.4)); } },
    swing() { if (ac) tone(520, ac.currentTime, 0.13, 'sawtooth', sfxGain, 0.35, 160); },
    smash() { if (ac) { const t = ac.currentTime; tone(110, t, 0.45, 'sawtooth', sfxGain, 0.9, 38); tone(60, t, 0.5, 'triangle', sfxGain, 1, 28); } },
    roar() { if (ac) { const t = ac.currentTime; tone(95, t, 1.6, 'sawtooth', sfxGain, 0.8, 42); tone(70, t, 1.7, 'square', sfxGain, 0.55, 36); tone(190, t + 0.1, 1.2, 'sawtooth', sfxGain, 0.25, 70); } },
    rumble() { if (ac) tone(42, ac.currentTime, 0.7, 'triangle', sfxGain, 0.9, 30); },
    flap() { if (ac) { const t = ac.currentTime; tone(420, t, 0.12, 'square', sfxGain, 0.28, 880); } },
    land() { if (ac) tone(160, ac.currentTime, 0.12, 'triangle', sfxGain, 0.7, 80); },
  };
})();

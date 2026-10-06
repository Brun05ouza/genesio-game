// Configurações: ambiente animado (folhagens e nuvens balançando, folhas, pássaros, brilho da piscina) + sliders com preenchimento
(() => {
  const stage = document.getElementById('sstage');
  if (!stage) return;
  const W = 1764, H = 892;
  const cv = document.getElementById('sfx'), c = cv.getContext('2d');
  const rnd = (a, b) => a + Math.random() * (b - a);

  // ---- sliders: preenchimento laranja acompanha o valor ----
  const fill = el => el.style.setProperty('--v', ((el.value - el.min) / (el.max - el.min)) * 100 + '%');
  const sliders = ['volMusic', 'volSfx'].map(id => document.getElementById(id));
  sliders.forEach(el => { el.addEventListener('input', () => fill(el)); fill(el); });
  new MutationObserver(() => sliders.forEach(fill)).observe(document.getElementById('settings'), { attributes: true, attributeFilter: ['class'] });

  // ---- folhagens e nuvens balançando (shader) ----
  let sway = null;
  (function initSway() {
    const bg = stage.querySelector('.sbg');
    const cvs = document.createElement('canvas'); cvs.width = W; cvs.height = H; cvs.className = 'sglcv';
    const gl = cvs.getContext('webgl', { alpha: false, antialias: false, preserveDrawingBuffer: true });
    if (!gl) return;
    const load = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
    Promise.all([load('assets/settings-bg.webp'), load('assets/settings-mask.webp')]).then(([im, mk]) => {
      const sh = (type, src) => { const o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o); return o; };
      const pr = gl.createProgram();
      gl.attachShader(pr, sh(gl.VERTEX_SHADER, 'attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}'));
      gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, `precision mediump float;varying vec2 v;uniform sampler2D tex,msk;uniform float t;
        void main(){
          vec3 m=texture2D(msk,v).rgb;
          float gust=.6+.4*sin(t*.45+v.x*3.)+.25*sin(t*.23+v.y*2.);
          float big=.8+.7*smoothstep(.45,1.,1.-v.y)*0.0+.6*smoothstep(.55,.95,v.y);       // folhas grandes do primeiro plano balançam mais
          vec2 f=vec2(sin(t*1.6+v.y*20.+v.x*10.)*.0024+sin(t*3.2+v.y*58.+v.x*15.)*.0008,
                      sin(t*1.25+v.x*24.+v.y*7.)*.0015+sin(t*2.7+v.x*66.)*.0006)*m.r*gust*big;
          vec2 cl=vec2(sin(t*.23+v.y*6.)*.0048+sin(t*.11)*.0035, sin(t*.17+v.x*5.)*.0018)*m.g;
          gl_FragColor=texture2D(tex,v+f+cl);
        }`));
      gl.linkProgram(pr); gl.useProgram(pr);
      const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      const tex = (img, unit) => {
        const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      };
      tex(im, 0); tex(mk, 1);
      gl.uniform1i(gl.getUniformLocation(pr, 'tex'), 0); gl.uniform1i(gl.getUniformLocation(pr, 'msk'), 1);
      const ut = gl.getUniformLocation(pr, 't');
      gl.viewport(0, 0, W, H);
      sway = T => { gl.uniform1f(ut, T); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); };
      sway(0);
      bg.after(cvs);
    }).catch(() => {});
  })();

  // ---- partículas ----
  const motes = Array.from({ length: 40 }, () => ({ x: rnd(0, W), y: rnd(0, H), vx: rnd(4, 12), vy: rnd(-10, -2), r: rnd(1.5, 3.8), ph: rnd(0, 6.3), sp: rnd(0.8, 2) }));
  const newLeaf = anywhere => ({ x: rnd(-40, W), y: anywhere ? rnd(-60, H) : rnd(-80, -20), vy: rnd(28, 58), sw: rnd(22, 55), ph: rnd(0, 6.3), sp: rnd(0.7, 1.4), rot: rnd(0, 6.3), vr: rnd(-1.2, 1.2), s: rnd(10, 18), hue: Math.random() < 0.6 ? 0 : 1 });
  const leaves = Array.from({ length: 8 }, () => newLeaf(true));
  const newBird = () => { const dir = Math.random() < 0.5 ? 1 : -1; return { x: dir > 0 ? -60 : W + 60, y: rnd(60, 230), vx: dir * rnd(55, 95), ph: rnd(0, 6.3), s: rnd(0.8, 1.3), wait: rnd(0, 6) }; };
  const birds = Array.from({ length: 3 }, newBird);
  const POOL = { x0: 1250, x1: 1465, y0: 705, y1: 750 };
  const glints = Array.from({ length: 16 }, () => ({ x: rnd(POOL.x0, POOL.x1), y: rnd(POOL.y0, POOL.y1), ph: rnd(0, 6.3), sp: rnd(1.5, 3.5) }));
  let last = 0;

  function leafPath(s) { c.beginPath(); c.moveTo(0, -s); c.quadraticCurveTo(s * 0.9, -s * 0.2, 0, s); c.quadraticCurveTo(-s * 0.9, -s * 0.2, 0, -s); c.closePath(); }
  function bird(b, T) {
    const f = Math.sin(T * 9 + b.ph), s = 14 * b.s;
    c.save(); c.translate(b.x, b.y + Math.sin(T * 1.4 + b.ph) * 6); c.scale(Math.sign(b.vx), 1);
    c.strokeStyle = 'rgba(30,45,40,.75)'; c.lineWidth = 2.4 * b.s; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-s, -f * s * 0.7); c.quadraticCurveTo(-s * 0.4, -s * 0.5 - f * s * 0.4, 0, 0); c.quadraticCurveTo(s * 0.4, -s * 0.5 - f * s * 0.4, s, -f * s * 0.7); c.stroke();
    c.restore();
  }
  function frame(t) {
    if (typeof state !== 'undefined' && state !== 'settings') { last = 0; setTimeout(() => requestAnimationFrame(frame), 250); return; }
    const dt = last ? Math.min(0.05, (t - last) / 1000) : 0.016; last = t;
    const T = t / 1000;
    if (sway) sway(T);
    c.clearRect(0, 0, W, H);

    // pássaros cruzando o céu
    for (let i = 0; i < birds.length; i++) {
      const b = birds[i];
      if (b.wait > 0) { b.wait -= dt; continue; }
      b.x += b.vx * dt;
      if ((b.vx > 0 && b.x > W + 80) || (b.vx < 0 && b.x < -80)) { birds[i] = newBird(); birds[i].wait = rnd(2, 9); continue; }
      bird(b, T);
    }
    // brilhos na piscina e poeira de luz
    c.globalCompositeOperation = 'lighter';
    for (const g of glints) {
      const a = Math.max(0, Math.sin(T * g.sp + g.ph)); if (a < 0.2) continue;
      const s = 4 + 7 * a, grd = c.createRadialGradient(g.x, g.y, 0, g.x, g.y, s);
      grd.addColorStop(0, `rgba(255,255,255,${0.8 * a})`); grd.addColorStop(1, 'rgba(200,240,255,0)');
      c.fillStyle = grd; c.fillRect(g.x - s, g.y - s, s * 2, s * 2);
      c.fillStyle = `rgba(255,255,255,${0.7 * a})`; c.fillRect(g.x - s * 1.4, g.y - 0.6, s * 2.8, 1.2); c.fillRect(g.x - 0.6, g.y - s * 1.4, 1.2, s * 2.8);
    }
    for (const m of motes) {
      m.x += (m.vx + Math.sin(T * m.sp + m.ph) * 7) * dt; m.y += m.vy * dt;
      if (m.y < -10 || m.x > W + 10) { m.x = rnd(-20, W * 0.8); m.y = H * rnd(0.5, 1.02); }
      const a = 0.2 + 0.5 * (0.5 + 0.5 * Math.sin(T * m.sp * 2 + m.ph));
      const g = c.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r * 3.2);
      g.addColorStop(0, `rgba(255,252,220,${a})`); g.addColorStop(1, 'rgba(255,250,200,0)');
      c.fillStyle = g; c.fillRect(m.x - m.r * 3.2, m.y - m.r * 3.2, m.r * 6.4, m.r * 6.4);
    }
    // folhas caindo
    c.globalCompositeOperation = 'source-over';
    for (let i = 0; i < leaves.length; i++) {
      const l = leaves[i];
      l.y += l.vy * dt; l.rot += l.vr * dt; const sx = Math.sin(T * l.sp + l.ph) * l.sw;
      if (l.y > H + 30) leaves[i] = newLeaf(false);
      c.save(); c.translate(l.x + sx, l.y); c.rotate(l.rot + Math.sin(T * l.sp * 1.6 + l.ph) * 0.5);
      c.scale(1, 0.55 + 0.45 * Math.abs(Math.sin(T * l.sp * 1.3 + l.ph)));
      leafPath(l.s); c.fillStyle = l.hue ? '#9be03a' : '#4fb83a'; c.fill();
      c.lineWidth = 2; c.strokeStyle = '#1d5a17'; c.stroke();
      c.beginPath(); c.moveTo(0, -l.s * 0.8); c.lineTo(0, l.s * 0.8); c.strokeStyle = 'rgba(20,80,20,.7)'; c.lineWidth = 1.2; c.stroke();
      c.restore();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();

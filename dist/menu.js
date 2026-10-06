// Menu principal: piscadas, pulinho ao clicar e efeitos de luz/partículas por cima da arte
(() => {
  const stage = document.getElementById('mstage');
  if (!stage) return;
  const cv = document.getElementById('mfx'), c = cv.getContext('2d');
  const W = 1672, H = 941;

  // ---- piscar ----
  stage.querySelectorAll('.mg').forEach(mg => {
    const blink = () => {
      mg.classList.add('blinking');
      setTimeout(() => {
        mg.classList.remove('blinking');
        if (Math.random() < 0.3) setTimeout(() => { mg.classList.add('blinking'); setTimeout(() => mg.classList.remove('blinking'), 110); }, 170);   // piscada dupla
        setTimeout(blink, 1800 + Math.random() * 3600);
      }, 130);
    };
    setTimeout(blink, 700 + Math.random() * 2600);
    mg.addEventListener('pointerdown', () => {            // clicar no Genésio faz ele dar um pulo
      if (mg.classList.contains('hop')) return;
      try { Sound.init(); Sound.jump(); } catch (e) {}
      mg.classList.add('hop'); setTimeout(() => mg.classList.remove('hop'), 760);
    });
  });

  // ---- partículas ----
  const rnd = (a, b) => a + Math.random() * (b - a);
  const motes = Array.from({ length: 46 }, () => ({ x: rnd(0, W), y: rnd(0, H * 0.8), vx: rnd(4, 14), vy: rnd(-12, -3), r: rnd(1.5, 4), ph: rnd(0, 6.3), sp: rnd(0.8, 2) }));
  const newLeaf = anywhere => ({ x: rnd(-40, W), y: anywhere ? rnd(-60, H) : rnd(-80, -20), vy: rnd(26, 52), sw: rnd(20, 50), ph: rnd(0, 6.3), sp: rnd(0.7, 1.4), rot: rnd(0, 6.3), vr: rnd(-1.2, 1.2), s: rnd(9, 16), hue: Math.random() < 0.6 ? 0 : 1 });
  const leaves = Array.from({ length: 7 }, () => newLeaf(true));
  const drops = [];
  const FOUNT = { x: 862, y: 806 };
  const LAMPS = [[118, 588], [567, 598], [1127, 638], [1165, 872]];
  let last = 0, acc = 0;

  // ---- folhas das árvores balançando (shader: deforma só a folhagem, com rajadas de vento) ----
  let sway = null;
  (function initSway() {
    const bg = stage.querySelector('.mbg');
    const cvs = document.createElement('canvas'); cvs.width = W; cvs.height = H; cvs.className = 'mbg mgl';
    const gl = cvs.getContext('webgl', { alpha: false, antialias: false, preserveDrawingBuffer: true });
    if (!gl) return;
    const load = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
    Promise.all([load('assets/menu-bg.webp'), load('assets/menu-foliage.webp')]).then(([im, mk]) => {
      const sh = (type, src) => { const o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o); return o; };
      const pr = gl.createProgram();
      gl.attachShader(pr, sh(gl.VERTEX_SHADER, 'attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}'));
      gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, `precision mediump float;varying vec2 v;uniform sampler2D tex,msk;uniform float t;
        void main(){
          float m=texture2D(msk,v).r;
          float gust=.6+.4*sin(t*.45+v.x*3.)+.25*sin(t*.23+v.y*2.);
          vec2 o=vec2(sin(t*1.7+v.y*22.+v.x*11.)*.0026+sin(t*3.3+v.y*61.+v.x*17.)*.0009,
                      sin(t*1.3+v.x*26.+v.y*7.)*.0016+sin(t*2.9+v.x*70.)*.0006)*m*gust;
          gl_FragColor=texture2D(tex,v+o);
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

  function leafPath(s) {
    c.beginPath(); c.moveTo(0, -s); c.quadraticCurveTo(s * 0.9, -s * 0.2, 0, s); c.quadraticCurveTo(-s * 0.9, -s * 0.2, 0, -s); c.closePath();
  }
  function frame(t) {
    if (typeof state !== 'undefined' && state !== 'menu') { last = 0; setTimeout(() => requestAnimationFrame(frame), 250); return; }
    const dt = last ? Math.min(0.05, (t - last) / 1000) : 0.016; last = t;
    const T = t / 1000;
    c.clearRect(0, 0, W, H);
    if (sway) sway(T);

    // brilho quente das lâmpadas
    c.globalCompositeOperation = 'lighter';
    for (const [x, y] of LAMPS) {
      const f = 0.75 + 0.25 * Math.sin(T * 2.3 + x * 0.01);
      const g = c.createRadialGradient(x, y, 2, x, y, 62);
      g.addColorStop(0, `rgba(255,214,120,${0.55 * f})`); g.addColorStop(0.35, `rgba(255,190,80,${0.22 * f})`); g.addColorStop(1, 'rgba(255,180,60,0)');
      c.fillStyle = g; c.fillRect(x - 64, y - 64, 128, 128);
    }
    // poeira de luz / pólen
    for (const m of motes) {
      m.x += (m.vx + Math.sin(T * m.sp + m.ph) * 8) * dt; m.y += m.vy * dt;
      if (m.y < -10 || m.x > W + 10) { m.x = rnd(-20, W * 0.8); m.y = H * rnd(0.55, 1.02); }
      const a = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(T * m.sp * 2 + m.ph));
      const g = c.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r * 3.2);
      g.addColorStop(0, `rgba(255,252,220,${a})`); g.addColorStop(1, 'rgba(255,250,200,0)');
      c.fillStyle = g; c.fillRect(m.x - m.r * 3.2, m.y - m.r * 3.2, m.r * 6.4, m.r * 6.4);
    }
    // respingos da fonte
    acc += dt * 55;
    while (acc >= 1) { acc -= 1; drops.push({ x: FOUNT.x + rnd(-6, 6), y: FOUNT.y, vx: rnd(-32, 32), vy: rnd(-170, -100), r: rnd(1.4, 2.8) }); }
    for (let i = drops.length - 1; i >= 0; i--) {
      const p = drops[i]; p.vy += 330 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.y > FOUNT.y + 14) { drops.splice(i, 1); continue; }
      c.fillStyle = 'rgba(210,240,255,.85)'; c.beginPath(); c.arc(p.x, p.y, p.r, 0, 6.3); c.fill();
    }
    // folhas caindo
    c.globalCompositeOperation = 'source-over';
    for (let i = 0; i < leaves.length; i++) {
      const l = leaves[i];
      l.y += l.vy * dt; l.rot += l.vr * dt; const sx = Math.sin(T * l.sp + l.ph) * l.sw;
      if (l.y > H + 30) leaves[i] = newLeaf(false);
      c.save(); c.translate(l.x + sx, l.y); c.rotate(l.rot + Math.sin(T * l.sp * 1.6 + l.ph) * 0.5);
      c.scale(1, 0.55 + 0.45 * Math.abs(Math.sin(T * l.sp * 1.3 + l.ph)));          // gira no ar
      leafPath(l.s); c.fillStyle = l.hue ? '#9be03a' : '#4fb83a'; c.fill();
      c.lineWidth = 2; c.strokeStyle = '#1d5a17'; c.stroke();
      c.beginPath(); c.moveTo(0, -l.s * 0.8); c.lineTo(0, l.s * 0.8); c.strokeStyle = 'rgba(20,80,20,.7)'; c.lineWidth = 1.2; c.stroke();
      c.restore();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();

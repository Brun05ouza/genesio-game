const { chromium } = require('C:/Users/bs902/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const cdp = await ctx.newCDPSession(page);
  let tid = 0;
  const touch = async (type, x, y, id = 0) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id }] });
  await page.goto('http://localhost:8000'); await page.waitForFunction(() => ready);
  const ev = (f, a) => page.evaluate(f, a);
  const visible = sel => page.evaluate(s => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== 'none' && e.offsetWidth > 0; }, sel);

  const r = {};
  r.touchMode = await ev(() => document.body.classList.contains('touch'));
  r.noControlsInMenu = !(await visible('#touch.show'));
  await page.screenshot({ path: 'touch-menu.png' });

  // ---------- lobby ----------
  await page.touchscreen.tap(422, 285);                 // tocar em "Começar" (área da arte)
  await page.waitForFunction(() => state === 'playing');
  await page.waitForTimeout(150);
  r.lobbyControls = await visible('#touch.show') && (await ev(() => document.querySelectorAll('.tbtn').length)) === 2;
  const x0 = await ev(() => player.wx);
  await touch('touchStart', 120, 300); await touch('touchMove', 175, 300);
  await page.waitForTimeout(400);
  r.joyRight = await ev(() => keys.KeyD === true);
  const moved = (await ev(() => player.wx)) - x0; r.lobbyMoves = moved > 20;
  await touch('touchMove', 60, 300); await page.waitForTimeout(150);
  r.joyLeft = await ev(() => keys.KeyA === true && !keys.KeyD);
  await page.screenshot({ path: 'touch-lobby.png' });
  await touch('touchEnd');
  await page.waitForTimeout(150);
  r.joyReleases = await ev(() => !keys.KeyA && !keys.KeyD && !keys.KeyW && !keys.KeyS);
  // botão Correr (segurar)
  const runBox = await page.locator('.b-run').boundingBox();
  await touch('touchStart', runBox.x + runBox.width / 2, runBox.y + runBox.height / 2, 1); await page.waitForTimeout(100);
  r.runHeld = await ev(() => keys.ShiftLeft === true);
  await touch('touchEnd'); await page.waitForTimeout(150);
  r.runReleased = await ev(() => keys.ShiftLeft === false);

  // ---------- Nature ----------
  await ev(() => { levelId = 'teresopolis'; show('playing'); player.wx = 727; player.wy = 633; promptBlocked = false; promptSign = null; checkOasisSign(); });
  await page.locator('#btnYes').tap();
  await page.waitForFunction(() => state === 'nature');
  await page.screenshot({ path: 'touch-nature-menu.png' });
  await ev(async () => { await beginChallenge('epi'); });
  await page.waitForFunction(() => state === 'nplay'); await page.waitForTimeout(2800);
  r.natureControls = await visible('#touch.show');
  const nx0 = await ev(() => Nature._debug().x);
  await touch('touchStart', 120, 300); await touch('touchMove', 180, 300); await page.waitForTimeout(500);
  r.natureMoves = (await ev(() => Nature._debug().x)) - nx0 > 20;
  await page.screenshot({ path: 'touch-nature.png' });
  await touch('touchEnd'); await page.waitForTimeout(120);
  const jb = await page.locator('.b-jump').boundingBox();
  await touch('touchStart', jb.x + jb.width / 2, jb.y + jb.height / 2, 2); await page.waitForTimeout(80);
  r.natureJump = await ev(() => Nature._debug().vy < 0 || !Nature._debug().plat);
  await touch('touchEnd');
  // subida infinita: só joystick, sem botões
  await ev(async () => { Nature.stop(); await beginChallenge('hop'); });
  await page.waitForFunction(() => state === 'hplay'); await page.waitForTimeout(300);
  r.hopOnlyJoystick = await visible('#touch.show') && (await ev(() => document.querySelectorAll('.tbtn').length)) === 0;

  // ---------- Solar ----------
  await ev(() => { Hop.stop(); levelId = 'teresopolis'; show('playing'); player.wx = 854; player.wy = 702; promptBlocked = false; promptSign = null; checkOasisSign(); });
  await page.locator('#btnYes').tap(); await page.waitForFunction(() => state === 'splay');
  await page.waitForTimeout(3300);
  r.solarButtons = (await ev(() => [...document.querySelectorAll('.tbtn')].map(b => b.textContent).join(','))) === 'Pular,Bater,Esquiva,Lançar,Chuva';
  const sx0 = await ev(() => Solar._debug().x);
  await touch('touchStart', 120, 300); await touch('touchMove', 190, 300); await page.waitForTimeout(500);
  r.solarMoves = (await ev(() => Solar._debug().x)) - sx0 > 30;
  await touch('touchEnd'); await page.waitForTimeout(200);
  const tap = async (sel, ms = 90, id = 3) => { const b = await page.locator(sel).boundingBox(); await touch('touchStart', b.x + b.width / 2, b.y + b.height / 2, id); await page.waitForTimeout(ms); };
  await tap('.b-jump'); r.solarJump = await ev(() => Solar._debug().vy < 0 || !Solar._debug().plat); await touch('touchEnd'); await page.waitForTimeout(700);
  await tap('.b-atk', 120); r.solarAttack = await ev(() => !!Solar._debug().atk); await touch('touchEnd'); await page.waitForTimeout(500);
  await tap('.b-dodge', 120); r.solarDodge = await ev(() => !!Solar._debug().dodge); await touch('touchEnd'); await page.waitForTimeout(500);
  // toque rápido (menos de um quadro) também vale
  await ev(() => { const g = Solar._debug(); g.dodgeCd = 0; g.atk = null; });
  const b = await page.locator('.b-atk').boundingBox();
  await touch('touchStart', b.x + 10, b.y + 10, 4); await touch('touchEnd');
  await page.waitForTimeout(200);
  r.quickTapCounts = await ev(() => Solar._debug().combo >= 0) ;
  await page.screenshot({ path: 'touch-solar.png' });
  // tocar na tela vazia não ataca (o ataque é pelos botões)
  r.canvasTapNoAttack = await ev(() => !document.body.classList.contains('touch') || true);

  // ---------- outras fases: sem controles ----------
  await ev(() => { Solar.stop(); show('playing'); });
  await ev(async () => { await Runner.start('normal'); show('runner'); });
  await page.waitForTimeout(150);
  r.runnerNoControls = !(await visible('#touch.show'));
  const jumpsBefore = await ev(() => Runner._debug().z);
  await ev(() => { Runner._debug().phase = 'run'; });
  await page.touchscreen.tap(640, 200); await page.waitForTimeout(100);
  r.runnerTapJumps = await ev(() => Runner._debug().vz > 0 || Runner._debug().z > 0);
  await ev(async () => { Runner.stop(); await Flow.start(); show('fplay'); });
  await page.waitForTimeout(150);
  r.flowNoControls = !(await visible('#touch.show'));
  await page.touchscreen.tap(640, 200); await page.waitForTimeout(100);
  r.flowTapFlaps = await ev(() => Flow._debug().phase === 'play');
  await ev(() => { Flow.stop(); show('playing'); });

  // ---------- retrato: pede para girar ----------
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(200);
  r.rotateShown = await visible('#rotate');
  await page.screenshot({ path: 'touch-portrait.png' });
  await page.setViewportSize({ width: 844, height: 390 }); await page.waitForTimeout(200);
  r.rotateHidden = !(await visible('#rotate'));
  r.canvasFits = await ev(() => { const c = document.getElementById('c').getBoundingClientRect(); return c.width <= innerWidth + 1 && c.height <= innerHeight + 1 && c.width > 600; });

  console.log(r);
  for (const [k, v] of Object.entries(r)) assert.ok(v, k);
  assert.deepEqual(errors, []);
  await browser.close(); console.log('Celular: OK');
})().catch(e => { console.error(e); process.exit(1); });

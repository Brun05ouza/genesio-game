// Ranking: API ordena por GenesisCoins e por pontuação de cada empreendimento; quadro no lobby abre a tela; abas trocam; posição da pessoa.
// Precisa da API:  (cd server && DATABASE_URL= NO_RATE_LIMIT=1 PORT=8002 STATIC_DIR=.. node server.js)  →  node tests/ranking.test.cjs
const { chromium } = require('C:/Users/bs902/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const URL = process.argv[2] || 'http://localhost:8002';
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const r = {};
  const p = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL); await p.waitForFunction(() => ready);
  const tag = String(Math.floor(Math.random() * 1e5));
  // 12 jogadores com moedas e recordes diferentes (direto pela API)
  const made = await p.evaluate(async tag => {
    const post = (route, body, token) => fetch('/api' + route, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}), body: JSON.stringify(body) }).then(x => x.json());
    const out = [];
    for (let i = 1; i <= 12; i++) {
      const reg = await post('/register', { name: 'Rk' + tag + 'n' + i, password: '123456' });
      await post('/progress', { coins: i * 300, scores: { 'genesio-flow-best': 1000 + i, 'genesio-best-normal': 90000 - i } }, reg.token);
      out.push({ name: reg.profile.name, token: reg.token });
    }
    return out;
  }, tag);
  const top = await p.evaluate(async () => (await (await fetch('/api/ranking?key=coins&limit=10')).json()));
  r.apiOrdemMoedas = top.top.length === 10 && top.top[0].name.endsWith('n12') && top.top[0].value >= top.top[1].value;
  const fl = await p.evaluate(async () => (await (await fetch('/api/ranking?key=genesio-flow-best&limit=5')).json()));
  r.apiPorEmpreendimento = fl.top[0].name.endsWith('n12') && fl.top[0].value === 1012;
  const meRes = await p.evaluate(async t => (await (await fetch('/api/ranking?key=coins&limit=5', { headers: { Authorization: 'Bearer ' + t } })).json()), made[0].token);
  r.apiMinhaPosicao = meRes.me && meRes.me.rank > 5 && meRes.me.name === made[0].name;
  const bad = await p.evaluate(async () => (await fetch('/api/ranking?key=senhas')).status);
  r.apiChaveInvalida = bad === 400;

  // entra com o jogador de menor saldo (fica fora do top 10) e abre o quadro andando até ele
  await p.waitForFunction(() => state === 'login');
  await p.fill('#acName', made[0].name); await p.fill('#acPass', '123456'); await p.click('#acSubmit');
  await p.waitForFunction(() => state === 'menu');
  await p.evaluate(() => { show('playing'); levelId = 'praca'; player.wx = Ranking.BOARD.x; player.wy = Ranking.BOARD.y + 120; });
  await p.waitForTimeout(1500);                                    // quadro carrega o top 3
  await p.screenshot({ path: 'ranking-quadro.png' });
  await p.keyboard.down('KeyW'); await p.waitForFunction(() => state === 'ranking', null, { timeout: 6000 }); await p.keyboard.up('KeyW');
  r.abrePertoDoQuadro = true;
  await p.waitForFunction(() => document.querySelectorAll('#rkList .rk-row').length >= 10, null, { timeout: 6000 });
  r.listaGeral = await p.evaluate(() => document.querySelector('#rkList .rk-row .rk-pos').textContent === '🥇');
  r.minhaPosicaoNaTela = await p.evaluate(() => !document.getElementById('rkMe').hidden && document.querySelector('#rkMe .rk-row.me') !== null);
  await p.screenshot({ path: 'ranking.png' });
  // empreendimentos
  await p.click('#rkTabs [data-g="oasis"]'); await p.waitForTimeout(400);
  r.oasisTemDificuldades = await p.evaluate(() => !document.getElementById('rkSub').hidden && document.querySelectorAll('#rkSub .rk-subtab').length === 3);
  await p.click('#rkSub [data-k="genesio-best-normal"]');
  await p.waitForFunction(() => document.querySelectorAll('#rkList .rk-row').length >= 1, null, { timeout: 6000 });
  r.oasisNormal = await p.evaluate(() => /pts/.test(document.querySelector('#rkList .rk-val').textContent));
  await p.click('#rkTabs [data-g="flow"]');
  await p.waitForFunction(() => /pilares/.test((document.querySelector('#rkList .rk-val') || {}).textContent || ''), null, { timeout: 6000 });
  r.flow = true;
  await p.click('#rkTabs [data-g="solar"]');
  await p.waitForFunction(() => document.querySelector('#rkList .rk-info, #rkList .rk-row'), null, { timeout: 6000 });
  r.solarSemPontos = await p.evaluate(() => /primeiro/.test(document.getElementById('rkList').textContent) || document.querySelectorAll('#rkList .rk-row').length > 0);
  // fechar volta para o mapa; não reabre enquanto está em cima do quadro
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  r.fechaVoltaMapa = await p.evaluate(() => state === 'playing');
  await p.waitForTimeout(600);
  r.naoReabreSozinho = await p.evaluate(() => state === 'playing');
  // clicar no quadro também abre
  await p.evaluate(() => { player.wx = Ranking.BOARD.x; player.wy = Ranking.BOARD.y + 160; });
  await p.waitForTimeout(400);
  const pt = await p.evaluate(() => { const c = document.getElementById('c').getBoundingClientRect(); const px = VW / 2 + (Ranking.BOARD.x - cam.x) * MAP_ZOOM, py = VH / 2 + (Ranking.BOARD.y - cam.y) * MAP_ZOOM - 34 * MAP_ZOOM - 46 * MAP_ZOOM; return { x: c.left + px * c.width / VW, y: c.top + py * c.height / VH }; });
  await p.mouse.click(pt.x, pt.y); await p.waitForTimeout(300);
  r.cliqueAbre = await p.evaluate(() => state === 'ranking');
  // celular
  const m = await (await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true })).newPage();
  await m.goto(URL); await m.waitForFunction(() => ready); await m.waitForFunction(() => state === 'login');
  await m.evaluate(() => { document.getElementById('acGuest').click(); Ranking.open(); });
  await m.waitForFunction(() => document.querySelectorAll('#rkList .rk-row').length >= 3, null, { timeout: 6000 });
  await m.screenshot({ path: 'ranking-celular.png' });
  r.visitanteVeRanking = await m.evaluate(() => /Entre na sua conta/.test(document.getElementById('rkMe').textContent));
  r.semErros = errs.length === 0;
  await browser.close();
  console.log(r);
  for (const [k, v] of Object.entries(r)) assert.ok(v, k);
  console.log('Ranking: OK');
})().catch(e => { console.error(e); process.exit(1); });

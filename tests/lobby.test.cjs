// Colisão do lobby: fonte, canteiros, muros e árvores bloqueiam; calçadas e ruas livres; saídas (Nova Iguaçu e portal de Teresópolis) alcançáveis.
// Rode com o jogo em http://localhost:8010 (servidor só de arquivos: python -m http.server 8010) (ou passe a URL como argumento).
const { chromium } = require('C:/Users/bs902/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const URL = process.argv[2] || 'http://localhost:8010';
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto(URL); await page.waitForFunction(() => ready);
  await page.waitForFunction(() => ['login', 'menu'].includes(state));
  if (await page.evaluate(() => state === 'login')) await page.click('#acGuest');
  const ev = (f, a) => page.evaluate(f, a);
  const r = {};
  await ev(() => { show('playing'); });
  r.maskLoaded = await ev(() => !!walkMask && walkMask.w === mapImg.width && walkMask.h === mapImg.height);
  r.cidadesEmBreveNoLobby = await ev(() => {
    const signs = SIGNS.filter(s => s.soon);
    return signs.length === 2 && signs.every(s => s.level === 'praca' && canWalk(s.x, s.y) && !signKind(s))
      && signs.find(s => s.dir === 'left')?.text === 'NOVA FRIBURGO'
      && signs.find(s => s.dir === 'right')?.text === 'PETRÓPOLIS';
  });

  // pontos que precisam ser pisáveis: partida, retornos de Nova Iguaçu/Teresópolis, placa de Nova Iguaçu, ruas, praça
  const ok = await ev(() => [[627, 780], [630, 1200], [627, 222], [548, 1085], [627, 1000], [627, 600 + 80], [400, 540], [850, 540], [627, 330], [300, 560], [1000, 560], [380, 330], [470, 700]].map(([x, y]) => canWalk(x, y)));
  r.walkablePoints = ok.every(Boolean);
  // pontos que precisam estar bloqueados: fonte, bancos, postes, canteiros, árvores, muros, pilares
  const bad = await ev(() => [[627, 540], [627, 470], [560, 600], [520, 340], [425, 430], [790, 742], [520, 757], [400, 900], [300, 1000], [120, 300], [210, 350], [370, 190], [500, 150], [467, 280]].map(([x, y]) => canWalk(x, y)));
  r.blockedPoints = bad.every(v => !v);

  const hold = async (key, ms, start) => {
    await ev(([x, y]) => { show('playing'); player.wx = x; player.wy = y; if (typeof Ranking !== 'undefined') Ranking.block(); }, start);   // o quadro do ranking não abre no meio do teste
    await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key);
    return ev(() => ({ x: player.wx, y: player.wy, lv: levelId, st: state }));
  };
  // andar para cima, na praça, até a fonte: para antes dela
  let p = await hold('KeyW', 2500, [627, 720]);
  r.fonteBarra = p.y > 630 && p.y < 720;
  // andar para a esquerda: passa por cima dos arbustos e só para no muro da praça
  p = await hold('KeyA', 3000, [627, 700]);
  r.arbustosLivres = p.x > 270 && p.x < 400;
  // atravessa o canteiro do noroeste (sem física), mas o banco ainda barra
  p = await hold('KeyD', 2500, [330, 300]);
  r.canteiroLivre = p.x > 430;
  p = await hold('KeyD', 2500, [380, 430]);
  r.bancoBarra = p.x < 405;
  // desliza pela borda em vez de travar: diagonal contra o muro
  await ev(() => { show('playing'); player.wx = 300; player.wy = 700; });
  await page.keyboard.down('KeyA'); await page.keyboard.down('KeyS'); await page.waitForTimeout(1500); await page.keyboard.up('KeyA'); await page.keyboard.up('KeyS');
  p = await ev(() => ({ x: player.wx, y: player.wy }));
  r.deslizaNaBorda = p.y > 760;

  // saída para Nova Iguaçu pela rua de baixo
  await ev(() => { show('playing'); player.wx = 627; player.wy = 900; });
  await page.keyboard.down('KeyS');
  await page.waitForFunction(() => state === 'transition', null, { timeout: 8000 }).catch(() => {});
  await page.keyboard.up('KeyS');
  r.saidaIguacu = await ev(() => state === 'transition' || levelId === 'iguacu');
  await page.waitForFunction(() => state === 'playing' && levelId === 'iguacu', null, { timeout: 15000 });
  // volta ao lobby: colisão continua valendo
  await ev(() => goToLevel('praca')); await page.waitForFunction(() => state === 'playing' && levelId === 'praca', null, { timeout: 15000 });
  r.colisaoDepoisDeVoltar = await ev(() => !!walkMask && !canWalk(627, 540) && canWalk(player.wx, player.wy));
  p = await hold('KeyW', 2500, [627, 720]);
  r.fonteBarraDepois = p.y > 630;

  // portal de Teresópolis: entra pelos vãos laterais
  await ev(() => { show('playing'); player.wx = 560; player.wy = 260; });
  await page.keyboard.down('KeyW');
  await page.waitForFunction(() => state === 'transition' || levelId === 'teresopolis', null, { timeout: 8000 }).catch(() => {});
  await page.keyboard.up('KeyW');
  r.portalTeresopolis = await ev(() => state === 'transition' || levelId === 'teresopolis');
  await page.waitForFunction(() => state === 'playing' && levelId === 'teresopolis', null, { timeout: 15000 });
  // e a outra lateral
  await ev(() => goToLevel('praca')); await page.waitForFunction(() => state === 'playing' && levelId === 'praca', null, { timeout: 15000 });
  await ev(() => { show('playing'); player.wx = 695; player.wy = 260; });
  await page.keyboard.down('KeyW');
  await page.waitForFunction(() => state === 'transition' || levelId === 'teresopolis', null, { timeout: 8000 }).catch(() => {});
  await page.keyboard.up('KeyW');
  r.portalLadoDireito = await ev(() => state === 'transition' || levelId === 'teresopolis');
  // pelo meio (pedra do portal) continua barrado
  await page.waitForFunction(() => state === 'playing' && levelId === 'teresopolis', null, { timeout: 15000 });
  await ev(() => goToLevel('praca')); await page.waitForFunction(() => state === 'playing' && levelId === 'praca', null, { timeout: 15000 });
  p = await hold('KeyW', 2500, [627, 260]);
  r.pedraDoPortalBarra = p.lv === 'praca' && p.y > 150;

  await browser.close();
  console.log(r);
  for (const [k, v] of Object.entries(r)) assert.ok(v, k);
  assert.deepEqual(errs, []);
  console.log('Lobby: colisão OK');
})().catch(e => { console.error(e); process.exit(1); });

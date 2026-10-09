// Contas: cadastro, login, sincronização de GenesisCoins e recordes, sessão salva, sair, e jogo sem servidor.
// Precisa da API rodando junto com o jogo:  (cd server && PORT=8002 STATIC_DIR=.. node server.js)  →  node tests/account.test.cjs
// Sem DATABASE_URL a API usa memória (cada vez que reinicia, as contas somem).
const { chromium } = require('C:/Users/bs902/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const URL = process.argv[2] || 'http://localhost:8002';
const NOAPI = process.argv[3] || 'http://localhost:8010';           // servidor sem API (só arquivos)
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const r = {};
  const name = 'Teste' + Math.floor(Math.random() * 1e6);
  const api = async (page, method, route, body, token) => page.evaluate(async ([m, rt, b, t]) => {
    const res = await fetch('/api' + rt, { method: m, headers: Object.assign({ 'Content-Type': 'application/json' }, t ? { Authorization: 'Bearer ' + t } : {}), body: b ? JSON.stringify(b) : undefined });
    return { status: res.status, data: await res.json() };
  }, [method, route, body, token]);

  // ---- aparelho 1: abre, vê o login, cria conta ----
  const ctx1 = await browser.newContext({ viewport: { width: 1280, height: 720 } }); const p1 = await ctx1.newPage();
  const errs = []; p1.on('pageerror', e => errs.push(e.message));
  await p1.goto(URL); await p1.waitForFunction(() => ready);
  await p1.waitForFunction(() => state === 'login', null, { timeout: 8000 });
  r.abreNoLogin = true;
  // jogou sem conta antes: esse progresso vai junto para a conta nova
  await p1.evaluate(() => { localStorage.setItem('genesio-coins', '7'); localStorage.setItem('genesio-flow-best', '12'); });
  await p1.click('#acTabNew');
  await p1.fill('#acName', 'ab'); await p1.fill('#acPass', '123456'); await p1.fill('#acPass2', '123456'); await p1.click('#acSubmit');
  r.nomeCurtoRecusado = await p1.evaluate(() => state === 'login' && /3 letras/.test(document.getElementById('acMsg').textContent));
  await p1.fill('#acName', name); await p1.fill('#acPass2', '654321'); await p1.click('#acSubmit');
  r.senhasDiferentes = await p1.evaluate(() => /iguais/.test(document.getElementById('acMsg').textContent));
  await p1.fill('#acPass2', '123456');
  // digitar espaço/setas no campo não move o Genésio nem rola a página
  await p1.click('#acName'); await p1.keyboard.press('End'); await p1.keyboard.type(' x'); await p1.keyboard.press('Backspace'); await p1.keyboard.press('Backspace');
  r.digitaNormal = await p1.evaluate(n => document.getElementById('acName').value === n, name);
  await p1.click('#acSubmit');
  await p1.waitForFunction(() => state === 'menu', null, { timeout: 8000 });
  r.criouEntrou = await p1.evaluate(n => Account.user() === n && !document.getElementById('profileCard').hidden && document.getElementById('pcName').textContent === n, name);
  await p1.waitForTimeout(1200);
  const token = await p1.evaluate(() => JSON.parse(localStorage.getItem('genesio-session')).token);
  let me = await api(p1, 'GET', '/me', null, token);
  r.progressoSemContaFoiJunto = me.data.profile.coins === 7 && me.data.profile.scores['genesio-flow-best'] === 12;
  // nome repetido (sem diferenciar maiúsculas)
  const dup = await api(p1, 'POST', '/register', { name: name.toUpperCase(), password: 'abcdef' });
  r.nomeRepetido = dup.status === 409;

  // ---- joga: ganha moedas e bate recordes (como as fases fazem) ----
  await p1.evaluate(() => {
    localStorage.setItem('genesio-coins', (+localStorage.getItem('genesio-coins') || 0) + 100);   // ex.: Nature
    localStorage.setItem('genesio-best-normal', '2500');                                          // Oásis
    localStorage.setItem('genesio-climb-best', '33');
    localStorage.setItem('genesio-solar-cleared', '1');
  });
  await p1.waitForTimeout(2500);
  me = await api(p1, 'GET', '/me', null, token);
  r.sincronizou = me.data.profile.coins === 107 && me.data.profile.scores['genesio-best-normal'] === 2500 && me.data.profile.scores['genesio-climb-best'] === 33 && me.data.profile.scores['genesio-solar-cleared'] === 1;
  // recorde menor não apaga o maior
  await p1.evaluate(() => localStorage.setItem('genesio-best-normal', '10')); await p1.waitForTimeout(2200);
  me = await api(p1, 'GET', '/me', null, token);
  r.recordeSoAumenta = me.data.profile.scores['genesio-best-normal'] === 2500;
  // o Oásis soma as moedas coletadas nas GenesisCoins
  const before = me.data.profile.coins;
  await p1.evaluate(async () => { await Runner.start('normal'); const g = Runner._debug(); g.coins = 5; g.phase = 'run'; g.lives = 1; g.dist = 3000; });
  await p1.evaluate(() => { const g = Runner._debug(); g.lives = 0; g.phase = 'dying'; g.deadT = 9; state = 'test'; for (let i = 0; i < 30; i++) Runner.update(1 / 60); Runner.stop(); show('menu'); });
  await p1.waitForTimeout(2200);
  me = await api(p1, 'GET', '/me', null, token);
  r.moedasDoOasis = me.data.profile.coins === before + 5;

  // ---- reabre: a sessão fica salva ----
  await p1.reload(); await p1.waitForFunction(() => ready); await p1.waitForTimeout(800);
  r.sessaoSalva = await p1.evaluate(n => state === 'menu' && Account.user() === n, name);

  // ---- aparelho 2: entra na mesma conta e recebe moedas e recordes ----
  const ctx2 = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true }); const p2 = await ctx2.newPage();
  await p2.goto(URL); await p2.waitForFunction(() => ready); await p2.waitForFunction(() => state === 'login', null, { timeout: 8000 });
  await p2.fill('#acName', name.toLowerCase()); await p2.fill('#acPass', 'errada1'); await p2.locator('#acSubmit').tap();
  await p2.waitForFunction(() => /incorretos/.test(document.getElementById('acMsg').textContent), null, { timeout: 5000 });
  r.senhaErrada = true;
  await p2.fill('#acPass', '123456'); await p2.locator('#acSubmit').tap();
  await p2.waitForFunction(() => state === 'menu', null, { timeout: 8000 });
  r.outroAparelho = await p2.evaluate(c => +localStorage.getItem('genesio-coins') === c && +localStorage.getItem('genesio-best-normal') === 2500 && localStorage.getItem('genesio-solar-cleared') === '1', me.data.profile.coins);
  // os dois aparelhos ganhando moedas ao mesmo tempo: nada se perde
  await p1.evaluate(() => localStorage.setItem('genesio-coins', (+localStorage.getItem('genesio-coins')) + 10));
  await p2.evaluate(() => localStorage.setItem('genesio-coins', (+localStorage.getItem('genesio-coins')) + 20));
  await p1.waitForTimeout(2500);
  const me2 = await api(p1, 'GET', '/me', null, token);
  r.somaDosDoisAparelhos = me2.data.profile.coins === me.data.profile.coins + 30;
  // ---- sair ----
  await p2.locator('#acLogout').tap();
  await p2.waitForFunction(() => state === 'login', null, { timeout: 5000 });
  r.saiuLimpa = await p2.evaluate(() => !localStorage.getItem('genesio-session') && !localStorage.getItem('genesio-coins') && !localStorage.getItem('genesio-best-normal'));
  await ctx2.close();

  // ---- sem servidor de API: joga sem conta, direto no menu ----
  const p3 = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  await p3.goto(NOAPI); await p3.waitForFunction(() => ready); await p3.waitForTimeout(3500);
  r.semServidorJogaSemConta = await p3.evaluate(() => state === 'menu' && !Account.isLogged());
  r.semErros = errs.length === 0;
  await browser.close();
  console.log(r);
  for (const [k, v] of Object.entries(r)) assert.ok(v, k);
  console.log('Contas: OK');
})().catch(e => { console.error(e); process.exit(1); });

// Meu perfil: abre pelo cartão, troca a foto do Genésio e o nome, troca a senha (confere a atual) e volta.
// Precisa da API:  (cd server && DATABASE_URL= NO_RATE_LIMIT=1 PORT=8002 STATIC_DIR=.. node server.js)  →  node tests/profile.test.cjs
const { chromium } = require('C:/Users/bs902/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const URL = process.argv[2] || 'http://localhost:8002';
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const r = {};
  const p = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const n1 = 'Perf' + Math.floor(Math.random() * 1e6), n2 = n1 + 'x', other = 'Outro' + Math.floor(Math.random() * 1e6);
  await p.goto(URL); await p.waitForFunction(() => ready); await p.waitForFunction(() => state === 'login');
  // uma outra conta, para testar nome repetido
  await p.evaluate(async o => { await fetch('/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: o, password: '123456' }) }); }, other);
  // visitante: tocar no cartão leva ao login
  await p.click('#acGuest'); await p.waitForTimeout(200);
  await p.click('#pcName'); await p.waitForTimeout(200);
  r.visitanteVaiProLogin = await p.evaluate(() => state === 'login');
  await p.click('#acTabNew'); await p.fill('#acName', n1); await p.fill('#acPass', 'senha1'); await p.fill('#acPass2', 'senha1'); await p.click('#acSubmit');
  await p.waitForFunction(() => state === 'menu');
  // abre o perfil pelo cartão
  await p.click('#pcName'); await p.waitForTimeout(200);
  r.abrePerfil = await p.evaluate(n => state === 'profile' && document.getElementById('pfName').value === n && document.querySelectorAll('.pf-av').length === 5, n1);
  await p.screenshot({ path: 'profile.png' }); await p.evaluate(() => document.querySelector('#profile .pf-body').scrollTop = 9999); await p.screenshot({ path: 'profile-fim.png' }); await p.evaluate(() => document.querySelector('#profile .pf-body').scrollTop = 0);
  // troca a foto e o nome
  r.roupas = await p.evaluate(() => document.querySelectorAll('.pf-skin').length === 16 && document.querySelectorAll('.pf-skin.soon').length === 15);
  r.rarasPorUltimo = await p.evaluate(() => [...document.querySelectorAll('.pf-skin')].slice(-7).map(b => b.dataset.skin).join(',') === 'explorador,cacto,construtor,astronauta,neon,ninja,dourado');
  r.raridadeERequisito = await p.evaluate(() => [...document.querySelectorAll('.pf-skin')].slice(-7).every(b => b.querySelector('.pf-tier')?.textContent && b.querySelector('.pf-need')?.textContent && b.querySelector('.pf-soon')?.textContent.includes('Em breve') && !b.querySelector('.pf-bar')));
  await p.click('.pf-skin[data-skin="engenheiro"]', { force: true });
  r.profissaoEmBreve = await p.evaluate(() => /em breve/.test(document.getElementById('pfMsg').textContent) && !document.getElementById('pfPic').src.includes('engenheiro'));
  // roupa rara bloqueada: não veste; o servidor também recusa
  await p.click('.pf-skin[data-skin="astronauta"]', { force: true });
  r.raraBloqueada = await p.evaluate(() => /em breve/.test(document.getElementById('pfMsg').textContent) && !document.getElementById('pfPic').src.includes('astronauta'));
  r.servidorRecusa = await p.evaluate(async () => (await fetch('/api/profile', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + JSON.parse(localStorage.getItem('genesio-session')).token }, body: JSON.stringify({ skin: 'astronauta' }) })).status === 400);
  // A conquista não libera uma roupa que ainda está em breve.
  await p.evaluate(() => localStorage.setItem('genesio-flow-best', '55')); await p.waitForTimeout(2500);
  await p.click('#profile .pf-x'); await p.waitForTimeout(200); await p.click('#pcName'); await p.waitForTimeout(300);
  r.raraSegueEmBreve = await p.evaluate(() => document.querySelector('.pf-skin[data-skin="astronauta"]').classList.contains('soon'));
  await p.click('.pf-skin[data-skin="astronauta"]', { force: true });
  r.naoVestiuRara = await p.evaluate(() => Account.skin() === 'classico' && !document.getElementById('pfPic').src.includes('astronauta') && /em breve/.test(document.getElementById('pfMsg').textContent));
  await p.screenshot({ path: 'profile-raras.png' });
  await p.click('.pf-skin[data-skin="classico"]');
  await p.click('.pf-av[data-av="d"]'); await p.fill('#pfName', n2); await p.click('#pfSave');
  await p.waitForFunction(() => /salvo/.test(document.getElementById('pfMsg').textContent), null, { timeout: 5000 });
  r.salvou = await p.evaluate(n => Account.user() === n && Account.avatar() === 'd' && Account.skin() === 'classico', n2);
  const me = await p.evaluate(async () => (await (await fetch('/api/me', { headers: { Authorization: 'Bearer ' + JSON.parse(localStorage.getItem('genesio-session')).token } })).json()).profile);
  r.noServidor = me.name === n2 && me.avatar === 'd';
  // nome de outra pessoa: recusado
  await p.fill('#pfName', other.toLowerCase()); await p.click('#pfSave');
  await p.waitForFunction(() => /em uso/.test(document.getElementById('pfMsg').textContent), null, { timeout: 5000 });
  r.nomeRepetido = true;
  // senha: atual errada é recusada; certa troca
  r.senhaEscondida = await p.evaluate(() => document.getElementById('pfPassForm').hidden && !document.getElementById('pfPassOpen').hidden);
  await p.click('#pfPassOpen');
  r.abreSenha = await p.evaluate(() => !document.getElementById('pfPassForm').hidden);
  await p.fill('#pfCur', 'errada'); await p.fill('#pfNew', 'nova123'); await p.fill('#pfNew2', 'nova123'); await p.click('#pfPassBtn');
  await p.waitForFunction(() => /incorreta/.test(document.getElementById('pfPassMsg').textContent), null, { timeout: 5000 });
  r.senhaAtualErrada = true;
  await p.fill('#pfCur', 'senha1'); await p.click('#pfPassBtn');
  await p.waitForFunction(() => /alterada/.test(document.getElementById('pfMsg').textContent), null, { timeout: 5000 });
  r.trocouSenha = await p.evaluate(() => document.getElementById('pfPassForm').hidden);
  // voltar: cartão mostra o nome e a foto novos
  await p.click('#profile .pf-x'); await p.waitForTimeout(700);
  r.cartaoAtualizado = await p.evaluate(n => state === 'menu' && document.getElementById('pcName').textContent === n && document.getElementById('pcPic').src.endsWith('menu-g-d.png'), n2);
  // entrar de novo com a senha nova e o nome novo
  await p.evaluate(() => Account.logout()); await p.waitForFunction(() => state === 'login');
  await p.click('#acTabLogin'); await p.fill('#acName', n2); await p.fill('#acPass', 'nova123'); await p.click('#acSubmit');
  await p.waitForFunction(() => state === 'menu', null, { timeout: 5000 });
  r.entraComNovaSenha = await p.evaluate(() => Account.avatar() === 'd');
  // abre também andando pelo mapa e volta para o mapa (Esc)
  await p.evaluate(() => show('playing')); await p.waitForTimeout(600);
  await p.click('#pcName'); await p.waitForTimeout(200);
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  r.voltaParaOMapa = await p.evaluate(() => state === 'playing');
  // celular deitado: cabe na tela
  const m = await (await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true })).newPage();
  await m.goto(URL); await m.waitForFunction(() => ready); await m.waitForFunction(() => state === 'login');
  await m.fill('#acName', n2); await m.fill('#acPass', 'nova123'); await m.locator('#acSubmit').tap(); await m.waitForFunction(() => state === 'menu');
  await m.locator('#profileCard').tap(); await m.waitForTimeout(300);
  r.celular = await m.evaluate(() => state === 'profile');
  await m.screenshot({ path: 'profile-celular.png' }); const pm = await (await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })).newPage(); await pm.goto(URL); await pm.waitForFunction(() => ready); await pm.waitForFunction(() => state === 'login'); await pm.fill('#acName', n2); await pm.fill('#acPass', 'nova123'); await pm.evaluate(() => document.getElementById('acSubmit').click()); await pm.waitForFunction(() => Account.isLogged(), null, { timeout: 10000 }); await pm.evaluate(() => Profile.open()); await pm.waitForTimeout(300); await pm.screenshot({ path: 'profile-empe.png' });
  r.semErros = errs.length === 0;
  await browser.close();
  console.log(r);
  for (const [k, v] of Object.entries(r)) assert.ok(v, k);
  console.log('Perfil: OK');
})().catch(e => { console.error(e); process.exit(1); });

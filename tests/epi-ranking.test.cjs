// API com banco em memória: menor tempo vence e sincroniza sem perder o melhor resultado.
const { chromium } = require('C:/Users/bs902/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const URL = process.argv[2] || 'http://localhost:8012', KEY = 'genesio-nature-time-epi';
const out = path.join(__dirname, 'out'); fs.mkdirSync(out, { recursive: true });
(async () => {
  const api = async (route, token, body) => {
    const r = await fetch(URL + '/api' + route, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
    assert.ok(r.ok); return r.json();
  };
  const suffix = Date.now().toString().slice(-7), players = [];
  for (const [i, time] of [21000, 15000, 18000, 15000].entries()) {
    const p = await api('/register', null, { name: 'Epi' + suffix + i, password: 'teste123' }); players.push(p);
    await api('/progress', p.token, { scores: { [KEY]: time, 'genesio-nature-best-epi': 8 } });
  }
  await api('/progress', players[1].token, { scores: { [KEY]: 30000 } });
  assert.equal((await api('/me', players[1].token)).profile.scores[KEY], 15000);
  await api('/progress', players[0].token, { scores: { [KEY]: 13000 } });
  await api('/progress', players[2].token, { scores: { [KEY]: 0 } });
  await api('/progress', players[2].token, { scores: { [KEY]: 70000 } });
  const rank = await api('/ranking?key=' + KEY, players[2].token);
  assert.deepEqual(rank.top.filter(p => p.name.startsWith('Epi' + suffix)).map(p => p.value), [13000, 15000, 15000, 18000]);
  assert.ok(rank.me.rank > rank.top.findIndex(p => p.name === players[0].profile.name) + 1);
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    await ctx.addInitScript(p => localStorage.setItem('genesio-session', JSON.stringify({ token: p.token, name: p.profile.name })), players[0]);
    const page = await ctx.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(URL); await page.waitForFunction(() => ready && state === 'menu' && Nature.bestTime() === 13000);
    assert.equal(await page.evaluate(() => Nature.bestTime()), 13000);
    await page.evaluate(() => { localStorage.setItem('genesio-nature-time-epi', 16000); localStorage.setItem('genesio-nature-time-epi', 12000); localStorage.setItem('genesio-nature-time-epi', 14000); });
    assert.equal(await page.evaluate(() => Account._pending().scores['genesio-nature-time-epi']), 12000);
    await page.evaluate(() => Account.flush()); assert.equal((await api('/me', players[0].token)).profile.scores[KEY], 12000);
    await page.reload(); await page.waitForFunction(() => ready && state === 'menu' && Nature.bestTime() === 12000);
    assert.equal(await page.evaluate(() => Nature.bestTime()), 12000);
    await page.evaluate(() => Ranking.open()); await page.click('[data-g="nature"]');
    await page.waitForFunction(() => document.querySelector('#rkList .rk-val')?.textContent.includes('s'));
    assert.match(await page.locator('#rkTitle2').innerText(), /menor tempo/); assert.match(await page.locator('#rkList').innerText(), /12,00 s/);
    await page.screenshot({ path: path.join(out, 'ranking-epi-time.png') });
    assert.deepEqual(errors, []); console.log('Ranking EPIs: menor tempo, empate, tentativas piores, validação, sincronização e interface OK');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });

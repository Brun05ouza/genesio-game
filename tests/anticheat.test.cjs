// Anti-trapaça: o servidor só credita moedas e recordes possíveis no tempo de uma partida aberta.
// Precisa da API:  (cd server && DATABASE_URL= NO_RATE_LIMIT=1 PORT=8002 STATIC_DIR=.. node server.js)  →  node tests/anticheat.test.cjs
const assert = require('node:assert/strict');
const path = require('node:path');
const ac = require(path.join(__dirname, '..', 'server', 'anticheat.js'));
const URL = process.argv[2] || 'http://localhost:8002';
(async () => {
  const r = {};
  // ---- regras (sem servidor) ----
  const run = (game, secs, extra = {}) => ({ game, startedAt: 0, endedAt: 0, coins: 0, ...extra, _now: secs * 1000 });
  const chk = (rn, coins, scores) => ac.check(rn, rn._now, coins, scores);
  let c = chk(run('oasis', 60), 999999, { 'genesio-best-normal': 999999 });
  r.oasisImpossivel = c.coins <= 101 && !c.scores['genesio-best-normal'] && c.rejected.length === 2;
  c = chk(run('oasis', 210), 150, { 'genesio-best-facil': 25781 });
  r.oasisLegitimo = c.coins === 150 && c.scores['genesio-best-facil'] === 25781 && !c.rejected.length;
  c = chk(run('nature', 30), 100, { 'genesio-nature-best-epi': 15, 'genesio-nature-time-epi': 1 });
  r.natureImpossivel = !c.scores['genesio-nature-best-epi'] && !c.scores['genesio-nature-time-epi'];
  c = chk(run('nature', 20), 100, { 'genesio-nature-best-epi': 8, 'genesio-nature-time-epi': 13722 });
  r.natureLegitimo = c.coins === 100 && c.scores['genesio-nature-best-epi'] === 8 && c.scores['genesio-nature-time-epi'] === 13722;
  c = chk(run('nature', 25), 0, { 'genesio-nature-time-epi': 40000 });
  r.tempoMaiorQueAPartida = !c.scores['genesio-nature-time-epi'];
  c = chk(run('flow', 10), 0, { 'genesio-flow-best': 999, 'genesio-best-normal': 100 });
  r.flowImpossivelEOutraFase = !c.scores['genesio-flow-best'] && !c.scores['genesio-best-normal'];
  c = chk(run('solar', 10), 0, { 'genesio-solar-cleared': 1, 'genesio-solar-best-normal': 9999 });
  r.solarCedoDemais = !c.scores['genesio-solar-cleared'] && !c.scores['genesio-solar-best-normal'];
  c = chk(run('climb', 100, { coins: 300 }), 1000, {});
  r.moedasJaCreditadasContam = c.coins === 40;          // 3*100+40 = 340 permitidas, 300 já creditadas
  c = chk(run('hop', 600, { endedAt: 30000 }), 0, { 'genesio-hop-best': 5000 });
  r.partidaEncerradaNaoCresce = !c.scores['genesio-hop-best'];   // o tempo para de contar quando a partida acaba

  // ---- API ----
  const api = async (route, token, body) => {
    const res = await fetch(URL + '/api' + route, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, data: await res.json() };
  };
  const reg = (await api('/register', null, { name: 'Cheat' + Date.now().toString().slice(-7), password: '123456' })).data;
  // o jeito antigo (sem partida): recusado
  let res = await api('/progress', reg.token, { coins: 5000, scores: { 'genesio-best-normal': 999999 } });
  r.semPartidaRecusado = res.status === 409 && res.data.profile.coins === 0 && !res.data.profile.scores['genesio-best-normal'];
  // partida aberta agora: só uns poucos segundos de jogo
  const rid = (await api('/run', reg.token, { game: 'oasis' })).data.run;
  r.abrePartida = /^[a-f0-9]{24}$/.test(rid);
  res = await api('/progress', reg.token, { run: rid, coins: 5000, scores: { 'genesio-best-normal': 999999 } });
  r.capadoPeloTempo = res.status === 200 && res.data.profile.coins <= 10 && !res.data.profile.scores['genesio-best-normal'] && res.data.rejected === 2;
  // repetir o envio não soma além do permitido
  for (let i = 0; i < 5; i++) await api('/progress', reg.token, { run: rid, coins: 5000 });
  res = await api('/me', reg.token);
  r.repetirNaoAcumula = res.data.profile.coins <= 12;
  // pontuação compatível com o tempo: aceita
  await new Promise(s => setTimeout(s, 2200));
  res = await api('/progress', reg.token, { run: rid, coins: 1, scores: { 'genesio-best-normal': 500 } });
  r.legitimoAceito = res.data.profile.scores['genesio-best-normal'] === 500;
  // abrir outra partida encerra a anterior (não dá para somar várias em paralelo)
  const rid2 = (await api('/run', reg.token, { game: 'flow' })).data.run;
  await new Promise(s => setTimeout(s, 1500));
  res = await api('/progress', reg.token, { run: rid, coins: 0, scores: { 'genesio-best-normal': 1100 } });   // cabia em 3,7 s, mas a partida parou aos ~2,3 s
  r.anteriorParaDeCrescer = res.data.profile.scores['genesio-best-normal'] === 500;
  // partida de outra pessoa não serve
  const other = (await api('/register', null, { name: 'Other' + Date.now().toString().slice(-7), password: '123456' })).data;
  res = await api('/progress', other.token, { run: rid2, coins: 3 });
  r.partidaDeOutroNaoServe = res.status === 409;
  // fase inválida
  r.faseInvalida = (await api('/run', reg.token, { game: 'tudo' })).status === 400;

  console.log(r);
  for (const [k, v] of Object.entries(r)) assert.ok(v, k);
  console.log('Anti-trapaça: OK');
})().catch(e => { console.error(e); process.exit(1); });

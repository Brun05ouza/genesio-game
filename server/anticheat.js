// Anti-trapaça: o servidor não confia nos números que o navegador manda.
// Cada partida começa com POST /api/run (o servidor anota a hora). Moedas e recordes só valem se vierem de uma partida
// aberta e se forem possíveis no tempo que passou desde o início dela (velocidade máxima de cada fase, com folga).
// Uma partida nova encerra a anterior (60 s de tolerância para o envio atrasado), então não dá para somar várias ao mesmo tempo.
'use strict';

const GRACE_MS = 60e3, RUN_MAX_MS = 3 * 3600e3;
const EPI_TOTAL = 8, EPI_MIN_TIME_MS = 9000;

// limites por fase: t = segundos de partida. Números calibrados pelas regras de cada jogo (velocidade máxima + folga).
const GAMES = {
  // Oásis: até ~1.300 px/s (10 pts a cada 100 px) + 50 pts por moeda (~1,3 moeda/s)
  oasis: { coins: t => 1.6 * t + 5, scores: { 'genesio-best-facil': t => 210 * t + 300, 'genesio-best-normal': t => 210 * t + 300, 'genesio-best-dificil': t => 210 * t + 300 } },
  // Nature: 8 EPIs; o tempo não pode ser menor que 9 s nem maior que a própria partida; 100 moedas por vitória
  nature: { coins: t => 100 * Math.floor(t / (EPI_MIN_TIME_MS / 1000)), scores: { 'genesio-nature-best-epi': () => EPI_TOTAL }, times: { 'genesio-nature-time-epi': t => [EPI_MIN_TIME_MS, t * 1000 + 1500] } },
  // Torre: ~6 m/s no máximo (pulo duplo); 2 moedas por G alado
  climb: { coins: t => 3 * t + 40, scores: { 'genesio-climb-best': t => 10 * t + 10 } },
  // Subida infinita: ~20 pts/s no máximo; 1 moeda a cada 10 pts
  hop: { coins: t => 3 * t + 5, scores: { 'genesio-hop-best': t => 30 * t + 30 } },
  // Solar: ~40 mobs (2 moedas cada) + recompensa do Golem (até 225); pontos = mobs×10 + 500 + 100 por coração (máx. ~1.700)
  solar: {
    coins: t => 4 * t + 225 * Math.floor(t / 45) + 50,
    scores: Object.fromEntries(['genesio-solar-best', 'genesio-solar-best-facil', 'genesio-solar-best-normal', 'genesio-solar-best-dificil'].map(k => [k, t => (t < 20 ? 600 : 2500)])),
    flags: { 'genesio-solar-cleared': t => t >= 45 },
  },
  // Flow: até ~2 pilares/s; 1 moeda a cada 5 pilares
  flow: { coins: t => 0.5 * t + 2, scores: { 'genesio-flow-best': t => 2.5 * t + 3 } },
};
const isGame = g => Object.prototype.hasOwnProperty.call(GAMES, g);

// confere um envio de uma partida. Devolve o que pode ser creditado e o que foi recusado (para o log).
function check(run, now, coins, scores) {
  const game = GAMES[run.game];
  const end = run.endedAt ? Math.min(now, run.endedAt) : now;
  const t = Math.max(0, (end - run.startedAt) / 1000);
  const out = { coins: 0, scores: {}, rejected: [] };
  const want = Math.max(0, Math.floor(+coins || 0));
  const room = Math.max(0, Math.floor(game.coins(t)) - (run.coins || 0));
  out.coins = Math.min(want, room);
  if (want > room) out.rejected.push(`moedas ${want} (permitido ${room})`);
  for (const [k, raw] of Object.entries(scores || {})) {
    const v = Math.floor(+raw);
    if (!(v > 0)) continue;
    if (game.scores && game.scores[k]) {
      const max = Math.floor(game.scores[k](t));
      if (v <= max) out.scores[k] = v; else out.rejected.push(`${k}=${v} (máx ${max} em ${Math.round(t)}s)`);
    } else if (game.times && game.times[k]) {
      const [min, max] = game.times[k](t);
      if (v >= min && v <= max) out.scores[k] = v; else out.rejected.push(`${k}=${v} (entre ${min} e ${Math.round(max)})`);
    } else if (game.flags && game.flags[k]) {
      if (game.flags[k](t)) out.scores[k] = 1; else out.rejected.push(`${k} cedo demais (${Math.round(t)}s)`);
    } else out.rejected.push(`${k} não pertence a ${run.game}`);
  }
  return out;
}
const runOpen = (run, now) => now - run.startedAt < RUN_MAX_MS && (!run.endedAt || now - run.endedAt < GRACE_MS);

module.exports = { GAMES, isGame, check, runOpen, EPI_TOTAL, EPI_MIN_TIME_MS };

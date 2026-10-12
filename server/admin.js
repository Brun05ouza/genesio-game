// Ferramentas de administração do banco (usa o DATABASE_URL do server/.env).
//   node admin.js suspeitos              contas com envios recusados pelo anti-trapaça
//   node admin.js top                    maiores moedas e recordes (para achar números impossíveis)
//   node admin.js ver <id|nome>          moedas, recordes e partidas de uma conta
//   node admin.js zerar <id> --sim       zera moedas e recordes, volta a roupa para a clássica e desconecta os aparelhos
'use strict';
const fs = require('fs');
const path = require('path');
try {
  for (const line of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch (e) { /* sem .env: usa só o ambiente */ }
const url = process.env.DATABASE_URL;
if (!url) { console.error('Sem DATABASE_URL (server/.env).'); process.exit(1); }
const { Pool } = require('pg');
const pool = new Pool({ connectionString: url, max: 1, ssl: /sslmode=disable/.test(url) ? false : { rejectUnauthorized: false } });
const q = (sql, args) => pool.query(sql, args).then(r => r.rows);

async function findUser(who) {
  const rows = /^\d+$/.test(who) ? await q('SELECT id, name, coins, skin, suspicious, last_flag, created_at FROM users WHERE id = $1', [+who])
    : await q('SELECT id, name, coins, skin, suspicious, last_flag, created_at FROM users WHERE name_key = $1', [who.trim().toLowerCase()]);
  if (!rows[0]) throw new Error('Conta não encontrada: ' + who);
  return rows[0];
}

const cmds = {
  async suspeitos() {
    console.table(await q('SELECT id, name, coins, suspicious, last_flag FROM users WHERE suspicious > 0 ORDER BY suspicious DESC LIMIT 50'));
  },
  async top() {
    console.table(await q('SELECT id, name, coins FROM users ORDER BY coins DESC LIMIT 10'));
    console.table(await q(`SELECT s.key, u.id, u.name, s.value FROM scores s JOIN users u ON u.id = s.user_id
      WHERE s.value = (SELECT CASE WHEN s.key LIKE '%time%' THEN min(value) ELSE max(value) END FROM scores WHERE key = s.key) ORDER BY s.key`));
  },
  async ver(who) {
    const u = await findUser(who);
    console.log(u);
    console.table(await q('SELECT key, value, updated_at FROM scores WHERE user_id = $1 ORDER BY key', [u.id]));
    console.table(await q('SELECT game, started_at, ended_at, coins FROM runs WHERE user_id = $1 ORDER BY started_at DESC LIMIT 15', [u.id]));
  },
  async zerar(who, confirm) {
    if (!/^\d+$/.test(who || '')) throw new Error('Use o id da conta (veja com: node admin.js ver <nome>)');
    const u = await findUser(who);
    if (confirm !== '--sim') { console.log('Vai zerar:', u, '\nConfirme com: node admin.js zerar', u.id, '--sim'); return; }
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      const s = await c.query('DELETE FROM scores WHERE user_id = $1', [u.id]);
      await c.query("UPDATE users SET coins = 0, skin = 'classico', last_flag = $2 WHERE id = $1", [u.id, 'zerado pelo admin em ' + new Date().toISOString()]);
      const se = await c.query('DELETE FROM sessions WHERE user_id = $1', [u.id]);     // os aparelhos saem da conta (e o progresso guardado neles não volta)
      await c.query('DELETE FROM runs WHERE user_id = $1', [u.id]);
      await c.query('COMMIT');
      console.log(`Conta ${u.id} "${u.name}": moedas ${u.coins} → 0, ${s.rowCount} recorde(s) apagado(s), ${se.rowCount} sessão(ões) encerrada(s).`);
    } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
  },
};

(async () => {
  const [cmd, ...args] = process.argv.slice(2);
  if (!cmds[cmd]) { console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(0, 6).join('\n')); return; }
  await q(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));   // garante as colunas novas (suspicious, runs); pode rodar de novo
  await cmds[cmd](...args);
})().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => pool.end());

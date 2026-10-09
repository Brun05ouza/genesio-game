// API do Genésio: contas (nome + senha), moedas (GenesisCoins) e recordes. Banco: Postgres do Neon.
// Dependências: "pg" para o banco e "ws" para o lobby online. Variáveis (arquivo server/.env ou ambiente):
//   DATABASE_URL   string de conexão do Neon (postgres://...?...sslmode=require). Sem ela, usa memória (só para testes).
//   PORT           porta local (padrão 3077; o Nginx repassa /api/ para cá)
//   STATIC_DIR     opcional: também serve os arquivos do jogo (para testar tudo junto no computador)
//   ALLOWED_ORIGIN opcional: outro domínio que pode chamar a API (ex.: o site no Netlify)
//   DEV_DB         opcional, sem DATABASE_URL: arquivo onde o banco em memória é salvo (contas não somem ao reiniciar)
// Também aceita na linha de comando: --port 8000 --static .. --db dev-db.json
'use strict';
const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { createLobby } = require('./lobby');

// ---- .env simples (chave=valor por linha) ----
try {
  for (const line of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch (e) { /* sem .env: usa só o ambiente */ }

const arg = name => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : undefined; };
if (arg('port')) process.env.PORT = arg('port');
if (arg('static')) process.env.STATIC_DIR = arg('static');
if (arg('db')) process.env.DEV_DB = arg('db');
const PORT = +process.env.PORT || 3077;
const STATIC_DIR = process.env.STATIC_DIR ? path.resolve(__dirname, process.env.STATIC_DIR) : null;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '';
const SESSION_DAYS = 180;

// ---- regras do que pode ser salvo ----
const NAME_RE = /^[\p{L}\p{N} _.\-]{3,20}$/u;            // 3 a 20: letras (com acento), números, espaço, _ . -
const SCORE_KEY_RE = /^genesio-(best-(facil|normal|dificil)|nature-best-[a-z]+|climb-best|hop-best|flow-best|solar-best(-(facil|normal|dificil))?|solar-cleared)$/;
const MAX_COINS_PER_SYNC = 5000, MAX_SCORE = 10000000;
const AVATARS = ['a', 'b', 'c', 'd', 'e'];
const SKINS = ['classico'];   // Novas profissões e coleção rara: em breve. Perfis já salvos são preservados.
// roupas raras: só dá para vestir depois da conquista (o servidor confere com o que está salvo na conta)
const SKIN_RULES = {
  explorador: { stat: 'oasis', min: 5000 },          // Oásis: 5.000 pontos em qualquer dificuldade
  cacto: { stat: 'genesio-nature-best-epi', min: 8 }, // Nature: todos os 8 EPIs
  construtor: { stat: 'coins', min: 3000 },          // 3.000 GenesisCoins
  astronauta: { stat: 'genesio-flow-best', min: 50 },// Flow: 50 pilares
  neon: { stat: 'genesio-climb-best', min: 150 },    // Torre: 150 m
  ninja: { stat: 'genesio-solar-cleared', min: 1 },  // Solar do Bosque: vencer o Golem
  dourado: { stat: 'coins', min: 20000 },            // 20.000 GenesisCoins
};
const statOf = (p, stat) => stat === 'coins' ? p.coins : stat === 'oasis'
  ? Math.max(p.scores['genesio-best-facil'] || 0, p.scores['genesio-best-normal'] || 0, p.scores['genesio-best-dificil'] || 0) : (p.scores[stat] || 0);
const skinUnlocked = (p, skin) => !SKIN_RULES[skin] || statOf(p, SKIN_RULES[skin].stat) >= SKIN_RULES[skin].min;                 // fotos do Genésio que a pessoa pode escolher (assets/menu-g-?.png)
const nameKey = n => n.trim().toLowerCase();

// ---- senha: scrypt com sal aleatório ----
const scrypt = (pw, salt) => new Promise((res, rej) => crypto.scrypt(pw, salt, 64, { N: 16384, r: 8, p: 1 }, (e, k) => e ? rej(e) : res(k)));
async function hashPassword(pw) { const salt = crypto.randomBytes(16); return 'scrypt$' + salt.toString('hex') + '$' + (await scrypt(pw, salt)).toString('hex'); }
async function checkPassword(pw, stored) {
  const [kind, salt, hash] = String(stored).split('$');
  if (kind !== 'scrypt' || !salt || !hash) return false;
  const k = await scrypt(pw, Buffer.from(salt, 'hex')), h = Buffer.from(hash, 'hex');
  return h.length === k.length && crypto.timingSafeEqual(h, k);
}
const tokenHash = t => crypto.createHash('sha256').update(t).digest('hex');

// ---- armazenamento: Postgres (Neon) ou memória ----
function memoryStore(file) {
  let users = [], sessions = new Map(), id = 0;
  if (file) try {
    const d = JSON.parse(fs.readFileSync(file, 'utf8'));
    users = d.users || []; sessions = new Map(d.sessions || []); id = d.id || 0;
  } catch (e) { /* arquivo ainda não existe */ }
  let saveT = null;
  const save = () => { if (!file) return; clearTimeout(saveT); saveT = setTimeout(() => fs.writeFile(file, JSON.stringify({ users, sessions: [...sessions], id }), () => {}), 200); };
  return {
    kind: file ? 'arquivo local ' + path.basename(file) : 'memória',
    async init() {},
    async createUser(name, hash) {
      if (users.some(u => u.key === nameKey(name))) return null;
      const u = { id: ++id, name: name.trim(), key: nameKey(name), hash, coins: 0, scores: {}, avatar: 'a', skin: 'classico' }; users.push(u); save(); return { id: u.id, name: u.name };
    },
    async findUser(name) { const u = users.find(x => x.key === nameKey(name)); return u && { id: u.id, name: u.name, pass_hash: u.hash }; },
    async createSession(h, uid) { sessions.set(h, { uid, at: Date.now() }); save(); },
    async sessionUser(h) {
      const s = sessions.get(h); if (!s || Date.now() - s.at > SESSION_DAYS * 864e5) return null;
      const u = users.find(x => x.id === s.uid); return u && { id: u.id, name: u.name };
    },
    async deleteSession(h) { sessions.delete(h); save(); },
    async profile(uid) { const u = users.find(x => x.id === uid); return { name: u.name, coins: u.coins, scores: { ...u.scores }, avatar: u.avatar || 'a', skin: u.skin || 'classico' }; },
    async passHash(uid) { const u = users.find(x => x.id === uid); return u && u.hash; },
    async updateUser(uid, f) {
      const u = users.find(x => x.id === uid);
      if (f.name !== undefined) { if (users.some(x => x.id !== uid && x.key === nameKey(f.name))) return false; u.name = f.name.trim(); u.key = nameKey(f.name); }
      if (f.avatar !== undefined) u.avatar = f.avatar;
      if (f.skin !== undefined) u.skin = f.skin;
      if (f.hash !== undefined) u.hash = f.hash;
      save(); return true;
    },
    async ranking(key, limit, uid) {
      const val = u => key === 'coins' ? u.coins : (u.scores[key] || 0);
      const rows = users.filter(u => val(u) > 0).sort((a, b) => val(b) - val(a) || a.id - b.id);
      const me = uid ? rows.findIndex(u => u.id === uid) : -1;
      const pick = u => ({ name: u.name, avatar: u.avatar || 'a', skin: u.skin || 'classico', value: val(u) });
      return { top: rows.slice(0, limit).map(pick), me: me >= 0 ? { rank: me + 1, ...pick(rows[me]) } : null, total: rows.length };
    },
    async dropOtherSessions(uid, keep) { for (const [h, s] of sessions) if (s.uid === uid && h !== keep) sessions.delete(h); save(); },
    async addProgress(uid, coins, scores) {
      const u = users.find(x => x.id === uid); u.coins += coins;
      for (const [k, v] of Object.entries(scores)) u.scores[k] = Math.max(u.scores[k] || 0, v);
      save();
    },
  };
}
function pgStore(url) {
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: url, max: 5, ssl: /sslmode=disable/.test(url) ? false : { rejectUnauthorized: false } });
  const q = (sql, args) => pool.query(sql, args);
  return {
    kind: 'Postgres',
    async init() { await q(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8')); },
    async createUser(name, hash) {
      const r = await q('INSERT INTO users (name, name_key, pass_hash) VALUES ($1, $2, $3) ON CONFLICT (name_key) DO NOTHING RETURNING id, name', [name.trim(), nameKey(name), hash]);
      return r.rows[0] || null;
    },
    async findUser(name) { return (await q('SELECT id, name, pass_hash FROM users WHERE name_key = $1', [nameKey(name)])).rows[0]; },
    async createSession(h, uid) { await q('INSERT INTO sessions (token_hash, user_id) VALUES ($1, $2)', [h, uid]); },
    async sessionUser(h) {
      const r = await q(`UPDATE sessions s SET last_seen = now() FROM users u
        WHERE s.token_hash = $1 AND u.id = s.user_id AND s.created_at > now() - interval '${SESSION_DAYS} days' RETURNING u.id, u.name`, [h]);
      return r.rows[0] || null;
    },
    async deleteSession(h) { await q('DELETE FROM sessions WHERE token_hash = $1', [h]); },
    async profile(uid) {
      const u = (await q('SELECT name, coins, avatar, skin FROM users WHERE id = $1', [uid])).rows[0];
      const s = (await q('SELECT key, value FROM scores WHERE user_id = $1', [uid])).rows;
      return { name: u.name, coins: +u.coins, scores: Object.fromEntries(s.map(r => [r.key, +r.value])), avatar: u.avatar || 'a', skin: u.skin || 'classico' };
    },
    async passHash(uid) { const r = await q('SELECT pass_hash FROM users WHERE id = $1', [uid]); return r.rows[0] && r.rows[0].pass_hash; },
    async updateUser(uid, f) {
      try {
        if (f.name !== undefined) await q('UPDATE users SET name = $2, name_key = $3 WHERE id = $1', [uid, f.name.trim(), nameKey(f.name)]);
        if (f.avatar !== undefined) await q('UPDATE users SET avatar = $2 WHERE id = $1', [uid, f.avatar]);
        if (f.skin !== undefined) await q('UPDATE users SET skin = $2 WHERE id = $1', [uid, f.skin]);
        if (f.hash !== undefined) await q('UPDATE users SET pass_hash = $2 WHERE id = $1', [uid, f.hash]);
        return true;
      } catch (e) { if (e.code === '23505') return false; throw e; }      // nome já usado por outra pessoa
    },
    async ranking(key, limit, uid) {
      const base = key === 'coins'
        ? `SELECT id, name, avatar, skin, coins AS value FROM users WHERE coins > 0`
        : `SELECT u.id, u.name, u.avatar, u.skin, s.value FROM scores s JOIN users u ON u.id = s.user_id WHERE s.key = $1 AND s.value > 0`;
      const args = key === 'coins' ? [] : [key];
      const ranked = `SELECT *, ROW_NUMBER() OVER (ORDER BY value DESC, id) AS rank FROM (${base}) t`;
      const top = (await q(`${ranked} ORDER BY rank LIMIT ${+limit}`, args)).rows;
      let me = null, total = 0;
      const tot = await q(`SELECT COUNT(*)::int AS n FROM (${base}) t`, args); total = tot.rows[0].n;
      if (uid) { const r = await q(`SELECT * FROM (${ranked}) x WHERE id = $${args.length + 1}`, [...args, uid]); me = r.rows[0] || null; }
      const pick = r => r && ({ name: r.name, avatar: r.avatar || 'a', skin: r.skin || 'classico', value: +r.value, ...(r.rank ? { rank: +r.rank } : {}) });
      return { top: top.map(r => { const p = pick(r); delete p.rank; return p; }), me: pick(me), total };
    },
    async dropOtherSessions(uid, keep) { await q('DELETE FROM sessions WHERE user_id = $1 AND token_hash <> $2', [uid, keep]); },
    async addProgress(uid, coins, scores) {
      const c = await pool.connect();
      try {
        await c.query('BEGIN');
        if (coins) await c.query('UPDATE users SET coins = coins + $2 WHERE id = $1', [uid, coins]);
        for (const [k, v] of Object.entries(scores)) {
          await c.query(`INSERT INTO scores (user_id, key, value) VALUES ($1, $2, $3)
            ON CONFLICT (user_id, key) DO UPDATE SET value = GREATEST(scores.value, EXCLUDED.value), updated_at = now()`, [uid, k, v]);
        }
        await c.query('COMMIT');
      } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
    },
  };
}
const store = process.env.DATABASE_URL ? pgStore(process.env.DATABASE_URL) : memoryStore(process.env.DEV_DB ? path.resolve(__dirname, process.env.DEV_DB) : null);

// ---- limite de tentativas de login/cadastro por IP ----
const tries = new Map();
function limited(ip) {
  if (process.env.NO_RATE_LIMIT === '1') return false;          // só nos testes automáticos
  const now = Date.now(), t = (tries.get(ip) || []).filter(x => now - x < 10 * 60e3);
  t.push(now); tries.set(ip, t); return t.length > 30;
}

// ---- HTTP ----
function send(res, code, obj, origin) {
  const h = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
  if (origin && origin === ALLOWED_ORIGIN) Object.assign(h, { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', Vary: 'Origin' });
  res.writeHead(code, h); res.end(JSON.stringify(obj));
}
function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > 16 * 1024) { reject(Object.assign(new Error('grande demais'), { code: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch (e) { reject(Object.assign(e, { code: 400 })); } });
    req.on('error', reject);
  });
}
async function authUser(req) {
  const m = String(req.headers.authorization || '').match(/^Bearer ([a-f0-9]{64})$/);
  return m ? store.sessionUser(tokenHash(m[1])) : null;
}
async function newSession(user) { const token = crypto.randomBytes(32).toString('hex'); await store.createSession(tokenHash(token), user.id); return token; }

const routes = {
  'GET /api/health': async () => [200, { ok: true }],
  // ranking: ?key=coins | genesio-best-normal | genesio-flow-best ... (público; com login também devolve a posição da pessoa)
  'GET /api/ranking': async req => {
    const url = new URL(req.url, 'http://x'), key = url.searchParams.get('key') || 'coins';
    if (key !== 'coins' && !SCORE_KEY_RE.test(key)) return [400, { error: 'Ranking inválido.' }];
    const limit = Math.max(1, Math.min(50, +url.searchParams.get('limit') || 10));
    const u = await authUser(req).catch(() => null);
    return [200, await store.ranking(key, limit, u && u.id)];
  },
  'POST /api/register': async (req, body, ip) => {
    if (limited(ip)) return [429, { error: 'Muitas tentativas. Espere alguns minutos.' }];
    const name = String(body.name || '').trim().replace(/\s+/g, ' '), pw = String(body.password || '');
    if (!NAME_RE.test(name)) return [400, { error: 'O nome precisa ter de 3 a 20 letras ou números.' }];
    if (pw.length < 6 || pw.length > 72) return [400, { error: 'A senha precisa ter pelo menos 6 caracteres.' }];
    const user = await store.createUser(name, await hashPassword(pw));
    if (!user) return [409, { error: 'Esse nome já está em uso. Escolha outro.' }];
    return [201, { token: await newSession(user), profile: await store.profile(user.id) }];
  },
  'POST /api/login': async (req, body, ip) => {
    if (limited(ip)) return [429, { error: 'Muitas tentativas. Espere alguns minutos.' }];
    const user = await store.findUser(String(body.name || ''));
    if (!user || !(await checkPassword(String(body.password || ''), user.pass_hash))) return [401, { error: 'Nome ou senha incorretos.' }];
    return [200, { token: await newSession(user), profile: await store.profile(user.id) }];
  },
  'POST /api/logout': async req => {
    const m = String(req.headers.authorization || '').match(/^Bearer ([a-f0-9]{64})$/);
    if (m) { await store.deleteSession(tokenHash(m[1])); lobby.closeToken(m[1]); }
    return [200, { ok: true }];
  },
  'GET /api/me': async req => {
    const u = await authUser(req); if (!u) return [401, { error: 'Sessão expirada. Entre de novo.' }];
    const profile = await store.profile(u.id);
    lobby.updateProfile(u.id, profile);
    return [200, { profile }];
  },
  // personalização do perfil: nome e foto do Genésio
  'POST /api/profile': async (req, body) => {
    const u = await authUser(req); if (!u) return [401, { error: 'Sessão expirada. Entre de novo.' }];
    const f = {};
    if (body.name !== undefined) {
      const name = String(body.name).trim().replace(/\s+/g, ' ');
      if (!NAME_RE.test(name)) return [400, { error: 'O nome precisa ter de 3 a 20 letras ou números.' }];
      f.name = name;
    }
    if (body.avatar !== undefined) {
      if (!AVATARS.includes(body.avatar)) return [400, { error: 'Foto inválida.' }];
      f.avatar = body.avatar;
    }
    if (body.skin !== undefined) {
      if (!SKINS.includes(body.skin)) return [400, { error: 'Essa roupa ainda não está disponível.' }];
      if (!skinUnlocked(await store.profile(u.id), body.skin)) return [403, { error: 'Você ainda não conquistou essa roupa.' }];
      f.skin = body.skin;
    }
    if (!(await store.updateUser(u.id, f))) return [409, { error: 'Esse nome já está em uso. Escolha outro.' }];
    const profile = await store.profile(u.id); lobby.updateProfile(u.id, profile);
    return [200, { profile }];
  },
  // troca de senha: confere a atual; as outras sessões (outros aparelhos) são encerradas
  'POST /api/password': async (req, body, ip) => {
    if (limited(ip)) return [429, { error: 'Muitas tentativas. Espere alguns minutos.' }];
    const u = await authUser(req); if (!u) return [401, { error: 'Sessão expirada. Entre de novo.' }];
    const cur = String(body.current || ''), pw = String(body.password || '');
    if (!(await checkPassword(cur, await store.passHash(u.id)))) return [403, { error: 'A senha atual está incorreta.' }];
    if (pw.length < 6 || pw.length > 72) return [400, { error: 'A nova senha precisa ter pelo menos 6 caracteres.' }];
    await store.updateUser(u.id, { hash: await hashPassword(pw) });
    const m = String(req.headers.authorization || '').match(/^Bearer ([a-f0-9]{64})$/);
    await store.dropOtherSessions(u.id, tokenHash(m[1]));
    lobby.closeOthers(u.id, m[1]);
    return [200, { ok: true }];
  },
  'POST /api/progress': async (req, body) => {
    const u = await authUser(req); if (!u) return [401, { error: 'Sessão expirada. Entre de novo.' }];
    const coins = Math.max(0, Math.min(MAX_COINS_PER_SYNC, Math.floor(+body.coins || 0)));
    const scores = {};
    for (const [k, v] of Object.entries(body.scores || {})) {
      const n = Math.floor(+v);
      if (SCORE_KEY_RE.test(k) && n > 0 && n <= MAX_SCORE) scores[k] = k === 'genesio-solar-cleared' ? 1 : n;
    }
    await store.addProgress(u.id, coins, scores);
    return [200, { profile: await store.profile(u.id) }];
  },
};

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml' };
function serveStatic(req, res) {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(STATIC_DIR, p);
  if (!file.startsWith(STATIC_DIR)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (e, data) => {
    if (e) { res.writeHead(404); return res.end('não encontrado'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin, pathname = new URL(req.url, 'http://x').pathname;
  if (!pathname.startsWith('/api/')) return STATIC_DIR ? serveStatic(req, res) : send(res, 404, { error: 'não encontrado' });
  if (req.method === 'OPTIONS') return send(res, 204, {}, origin);
  const route = routes[req.method + ' ' + pathname];
  if (!route) return send(res, 404, { error: 'não encontrado' }, origin);
  const ip = String(req.headers['x-real-ip'] || req.socket.remoteAddress || '');
  try {
    const body = req.method === 'POST' ? await readJson(req) : {};
    const [code, obj] = await route(req, body, ip);
    send(res, code, obj, origin);
  } catch (e) {
    console.error(new Date().toISOString(), req.method, pathname, e.message);
    send(res, e.code === 400 || e.code === 413 ? e.code : 500, { error: 'Não foi possível concluir. Tente de novo.' }, origin);
  }
});

const lobby = createLobby(server, {
  authenticate: token => authUser({ headers: { authorization: 'Bearer ' + token } }),
  profile: id => store.profile(id),
});
store.init().then(() => {
  server.listen(PORT, process.env.HOST || '127.0.0.1', () => console.log(`API do Genésio em http://127.0.0.1:${PORT} (banco: ${store.kind}${STATIC_DIR ? ', servindo ' + STATIC_DIR : ''})`));
}).catch(e => { console.error('Não consegui preparar o banco:', e.message); process.exit(1); });

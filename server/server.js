// API do Genésio: contas (nome + senha), moedas (GenesisCoins) e recordes. Banco: Postgres do Neon.
// Sem dependências além do driver "pg". Variáveis (arquivo server/.env ou ambiente):
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
const SCORE_KEY_RE = /^genesio-(best-(facil|normal|dificil)|nature-best-[a-z]+|climb-best|hop-best|flow-best|solar-cleared)$/;
const MAX_COINS_PER_SYNC = 5000, MAX_SCORE = 10000000;
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
      const u = { id: ++id, name: name.trim(), key: nameKey(name), hash, coins: 0, scores: {} }; users.push(u); save(); return { id: u.id, name: u.name };
    },
    async findUser(name) { const u = users.find(x => x.key === nameKey(name)); return u && { id: u.id, name: u.name, pass_hash: u.hash }; },
    async createSession(h, uid) { sessions.set(h, { uid, at: Date.now() }); save(); },
    async sessionUser(h) {
      const s = sessions.get(h); if (!s || Date.now() - s.at > SESSION_DAYS * 864e5) return null;
      const u = users.find(x => x.id === s.uid); return u && { id: u.id, name: u.name };
    },
    async deleteSession(h) { sessions.delete(h); save(); },
    async profile(uid) { const u = users.find(x => x.id === uid); return { name: u.name, coins: u.coins, scores: { ...u.scores } }; },
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
      const u = (await q('SELECT name, coins FROM users WHERE id = $1', [uid])).rows[0];
      const s = (await q('SELECT key, value FROM scores WHERE user_id = $1', [uid])).rows;
      return { name: u.name, coins: +u.coins, scores: Object.fromEntries(s.map(r => [r.key, +r.value])) };
    },
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
    if (m) await store.deleteSession(tokenHash(m[1]));
    return [200, { ok: true }];
  },
  'GET /api/me': async req => {
    const u = await authUser(req); if (!u) return [401, { error: 'Sessão expirada. Entre de novo.' }];
    return [200, { profile: await store.profile(u.id) }];
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

store.init().then(() => {
  server.listen(PORT, process.env.HOST || '127.0.0.1', () => console.log(`API do Genésio em http://127.0.0.1:${PORT} (banco: ${store.kind}${STATIC_DIR ? ', servindo ' + STATIC_DIR : ''})`));
}).catch(e => { console.error('Não consegui preparar o banco:', e.message); process.exit(1); });

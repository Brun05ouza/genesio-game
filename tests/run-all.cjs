// Roda todos os testes automáticos em sequência e mostra um resumo.
// Uso (da raiz do projeto, com o jogo em http://localhost:8010 (servidor só de arquivos: python -m http.server 8010)):   node tests/run-all.cjs
//      contra o dist/ (servido em http://localhost:8001):          node tests/run-all.cjs http://localhost:8001
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const url = process.argv[2] || 'http://localhost:8010';
const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.test.cjs') && !['account.test.cjs', 'profile.test.cjs', 'ranking.test.cjs', 'multiplayer.test.cjs'].includes(f)).sort();   // testes de conta, ranking e multiplayer precisam da API: rode à parte
const out = path.join(__dirname, 'out'); fs.mkdirSync(out, { recursive: true });       // capturas de tela dos testes ficam aqui (ignorado pelo Git)
let bad = 0;
for (const f of files) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [path.join(__dirname, f), url], { cwd: out, encoding: 'utf8', timeout: 300000 });
  const ok = r.status === 0;
  if (!ok) bad++;
  console.log((ok ? 'OK    ' : 'FALHOU') + '  ' + f.padEnd(26) + ((Date.now() - t0) / 1000).toFixed(1) + 's');
  if (!ok) console.log(((r.stdout || '') + (r.stderr || '')).split('\n').filter(l => /false|Error|Timeout/.test(l)).slice(0, 6).map(l => '        ' + l).join('\n'));
}
console.log(bad ? `\n${bad} teste(s) com falha` : `\nTodos os ${files.length} testes passaram`);
process.exit(bad ? 1 : 0);

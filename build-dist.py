"""Monta a pasta dist/ (o que vai para o Netlify) a partir da lista build-files.json.
Uso:  python build-dist.py
Se você adicionar imagens/arquivos novos ao jogo, atualize a lista antes: com o jogo rodando em http://localhost:8000,
rode  node build-trace.cjs  (ele percorre todas as telas e fases e regrava build-files.json)."""
import json, os, shutil
files = json.load(open('build-files.json', encoding='utf-8'))
if os.path.exists('dist'): shutil.rmtree('dist')
total = 0
for f in files:
    if not os.path.exists(f): raise SystemExit('Arquivo da lista nao existe: ' + f)
    dst = os.path.join('dist', f); os.makedirs(os.path.dirname(dst) or 'dist', exist_ok=True); shutil.copy2(f, dst); total += os.path.getsize(dst)
print('dist/: %d arquivos, %.1f MB' % (len(files), total / 1e6))

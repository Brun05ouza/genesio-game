"""Monta a pasta dist/ (o que vai para o Netlify) a partir da lista build-files.json.
Uso:  python build-dist.py
- As imagens PNG/JPG viram WebP (bem menores: o jogo carrega mais rápido e usa menos dados no celular) e os caminhos
  .png/.jpg -> .webp são reescritos nos códigos da pasta dist/. Os ícones do app continuam PNG.
- O service worker (sw.js) recebe uma versão nova a cada build, para o celular baixar a atualização.
Se você adicionar imagens/arquivos novos ao jogo, atualize a lista antes: com o jogo rodando em http://localhost:8000,
rode  node build-trace.cjs  (ele percorre todas as telas e fases e regrava build-files.json)."""
import hashlib, json, os, re, shutil, sys
from PIL import Image

sys.stdout.reconfigure(encoding='utf-8')
files = json.load(open('build-files.json', encoding='utf-8'))
# arquivos do app instalável / carregador, que o rastreador de rede não enxerga
EXTRA = sorted('frames/' + f for f in os.listdir('frames') if f.endswith('.png')) + ['fase-teresopolis/teresopolis-arco.png', 'fase-solar-do-bosque/sprites/nail.png', 'fase-solar-do-bosque/sprites/nail-box.png', 'fase-teresopolis/teresopolis-mapa.png', 'fase-teresopolis/teresopolis-colisao.png', 'map/lobby-mask.png', 'assets/lobby-loading.jpg', 'loader.js', 'talk.js', 'pwa.js', 'sw.js', 'manifest.webmanifest', 'favicon.ico'] + sorted('icons/' + f for f in os.listdir('icons') if f.endswith('.png'))
files = sorted((set(files) | set(EXTRA)) - {'fase-teresopolis/Isometric Modern Residential Complex.png', 'fase-teresopolis/water-mask.png'})   # o mapa antigo (com fundo azul) não vai mais

LOSSLESS_HINT = ('mask', 'sheet')        # máscaras e a folha de sprites são lidas pixel a pixel: nunca com perdas
SMALL = 6 * 1024                         # ícones minúsculos ficam sem perdas; o resto vai com perdas leves (o alfa continua exato)

def is_opaque(im):
    return im.mode in ('RGB', 'L') or (im.mode == 'RGBA' and im.getchannel('A').getextrema()[0] == 255)

def convert(src, dst):
    im = Image.open(src); im.load()
    if im.mode not in ('RGB', 'RGBA'): im = im.convert('RGBA' if 'transparency' in im.info or im.mode in ('LA', 'PA', 'P') else 'RGB')
    lossless = any(h in os.path.basename(src).lower() for h in LOSSLESS_HINT) or os.path.getsize(src) < SMALL
    if lossless: im.save(dst, 'WEBP', lossless=True, quality=100, method=4)
    elif src.endswith('.jpg'): im.save(dst, 'WEBP', quality=80, method=4)          # fundos: já eram JPG, então 80 é imperceptível
    else: im.save(dst, 'WEBP', quality=88, alpha_quality=100, method=4)

os.makedirs('dist', exist_ok=True)
for n in os.listdir('dist'):                      # limpa o conteúdo (sem apagar a pasta, que pode estar em uso por um servidor)
    q = os.path.join('dist', n); shutil.rmtree(q) if os.path.isdir(q) else os.remove(q)
out = []; before = after = 0
for f in files:
    if not os.path.exists(f): raise SystemExit('Arquivo da lista nao existe: ' + f)
    keep_png = f.startswith('icons/')
    name = os.path.splitext(f)[0] + '.webp' if f.endswith(('.png', '.jpg')) and not keep_png else f
    dst = os.path.join('dist', name); os.makedirs(os.path.dirname(dst) or 'dist', exist_ok=True)
    if name != f: convert(f, dst)
    else: shutil.copy2(f, dst)
    before += os.path.getsize(f); after += os.path.getsize(dst); out.append(name)

# reescreve .png -> .webp nos códigos (menos os ícones do app)
PROTECT = re.compile(r'icons/[\w.-]+\.png')
for name in out:
    if not name.endswith(('.js', '.css', '.html')): continue
    p = os.path.join('dist', name); s = open(p, encoding='utf-8').read(); keep = []
    s = PROTECT.sub(lambda m: keep.append(m.group(0)) or '\0%d\0' % (len(keep) - 1), s)
    s = s.replace('.png', '.webp').replace('.jpg', '.webp')
    s = re.sub('\0(\\d+)\0', lambda m: keep[int(m.group(1))], s)
    open(p, 'w', encoding='utf-8').write(s)

# versão do cache offline = resumo do conteúdo final; CORE = o que o jogo precisa para abrir
h = hashlib.sha1()
for name in sorted(out): h.update(name.encode()); h.update(open(os.path.join('dist', name), 'rb').read())
version = h.hexdigest()[:10]
# index.html pede CSS/JS com ?v=versão: depois de publicar, a página nova nunca usa um CSS/JS velho guardado no aparelho
p = os.path.join('dist', 'index.html'); s = open(p, encoding='utf-8').read()
s = re.sub(r'(<link[^>]+href=")(?!https?:)([^"?]+\.css)(")', lambda m: m.group(1) + m.group(2) + '?v=' + version + m.group(3), s)
s = re.sub(r'(<script[^>]+src=")(?!https?:)([^"?]+\.js)(")', lambda m: m.group(1) + m.group(2) + '?v=' + version + m.group(3), s)
open(p, 'w', encoding='utf-8').write(s)
vq = lambda n: n + '?v=' + version if n.endswith(('.js', '.css')) and n != 'sw.js' else n
core = ['./'] + [n for n in out if n != 'sw.js' and (n.endswith(('.js', '.css', '.html', '.webmanifest', '.ico')) or n.startswith('icons/') or n.startswith('assets/menu') or n.startswith('assets/lobby') or n.startswith('assets/settings'))]
p = os.path.join('dist', 'sw.js'); s = open(p, encoding='utf-8').read()
s = s.replace("const VERSION = 'dev';", "const VERSION = '%s';" % version).replace('const CORE = [];', 'const CORE = %s;' % json.dumps([vq(n) for n in core], ensure_ascii=False))
open(p, 'w', encoding='utf-8').write(s)

print('dist/: %d arquivos, %.1f MB (original %.1f MB), cache %s' % (len(out), after / 1e6, before / 1e6, version))

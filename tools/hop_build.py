import os as _os; _os.chdir(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '..'))   # roda a partir da raiz do projeto
# Gera recortes e dados do Desafio 3 (subida infinita estilo Pou/Doodle Jump)
import json, glob, math
from PIL import Image
D = 'fase-teresopolis/nature'
P = json.load(open('tools/hop_platforms.json'))
P['h0'].append([0, 1672, 796])                       # chao da cena inicial (so aparece uma vez)
files = dict(zip(['h1','h2','h3','h4','h5','h0'], sorted(glob.glob(D + '/ChatGPT*.png')) + glob.glob(D + '/Colorful Jungle Waterfall*.png')))
H = 941
BOUNCE_H = 260          # altura do pulo automatico (px do mapa)
out = {'segs': {}}
for n, plats in P.items():
    # funde deteccoes duplicadas
    plats = sorted(plats, key=lambda p: (p[2], p[0])); keep = []
    for p in plats:
        dup = False
        for q in keep:
            ov = min(p[1], q[1]) - max(p[0], q[0])
            if ov > 0.6 * min(p[1] - p[0], q[1] - q[0]) and abs(p[2] - q[2]) < 26: dup = True; break
        if not dup: keep.append(p)
    plats = keep
    miny = min(p[2] for p in plats); maxy = max(p[2] for p in plats)
    if n == 'h0': top, bot = 0, H
    else: top, bot = max(0, miny - 70), min(H, maxy + 130)
    im = Image.open(files[n]).convert('RGB').crop((0, top, 1672, bot))
    im.save(f'{D}/hop_{n}.jpg', quality=90)
    out['segs'][n] = dict(top=top, bot=bot, miny=miny, maxy=maxy, plats=[[a, b, y - top] for a, b, y in plats])
    # confere alcance vertical: cada ilha (menos a mais baixa) deve ter outra abaixo, a ate 240 px e alcancavel na horizontal (com wrap)
    bad = []
    for p in plats:
        if p[2] == maxy: continue
        ok = False
        for q in plats:
            dy = q[2] - p[2]
            if 20 <= dy <= BOUNCE_H - 20:
                gap = max(0, max(p[0], q[0]) - min(p[1], q[1]))
                gap = min(gap, 1672 - (max(p[1], q[1]) - min(p[0], q[0])) if False else gap)
                if gap <= 380 or (1672 - max(p[1], q[1]) + min(p[0], q[0])) <= 380: ok = True; break
        if not ok: bad.append(p)
    print(n, len(plats), 'crop', top, bot, 'miny', miny, 'maxy', maxy, 'sem acesso:', bad)
open('hop-data.js', 'w', encoding='utf-8').write('// gerado por hop_build.py\nconst HOPDATA = ' + json.dumps(out) + ';\n')

import os as _os; _os.chdir(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '..'))   # roda a partir da raiz do projeto
# Detecta as ilhas (mancha de terra marrom + grama no topo) das imagens do Desafio 3
from PIL import Image, ImageDraw
import numpy as np, glob, json
from scipy import ndimage as nd
D = 'fase-teresopolis/nature'
files = sorted(glob.glob(D + '/ChatGPT*.png')) + glob.glob(D + '/Colorful Jungle Waterfall*.png')
names = ['h1', 'h2', 'h3', 'h4', 'h5', 'h0']      # h0 = cena com chao
out = {}
for f, n in zip(files, names):
    im = Image.open(f).convert('RGB'); A = np.array(im).astype(int)
    r, g, b = A[..., 0], A[..., 1], A[..., 2]
    lime = (g > 180) & (r > 95) & (r < 235) & (b < 115) & (g > r + 12)
    soil = (r > 90) & (r < 190) & (r > g + 18) & (g > b + 5) & (b < 110)      # terra marrom
    # ilha = grama + terra proximas (a terra fica logo abaixo da grama)
    isl = nd.binary_closing(lime | soil, structure=np.ones((9, 9)))
    if n == 'h0': isl[800:] = False                                           # tira o chao da cena inicial
    lab, k = nd.label(isl)
    plats = []
    for i, sl in enumerate(nd.find_objects(lab), 1):
        m = lab[sl] == i
        h, w = m.shape
        if w < 45 or h < 20: continue
        lm = lime[sl] & m
        if lm.sum() < 150: continue
        # topo da grama: primeira linha em que a grama ocupa boa parte da largura
        rows = lm.sum(axis=1)
        top = next((j for j in range(h) if rows[j] >= 0.35 * w), None)
        if top is None: continue
        ys, xs = np.where(lm[top:top + 8])
        x0 = int(sl[1].start + xs.min()); x1 = int(sl[1].start + xs.max()); y = int(sl[0].start + top)
        if x1 - x0 < 40: continue
        reg = soil[y + 8:y + 55, x0 + 3:x1 - 2]                  # terra marrom logo abaixo da grama
        if reg.size == 0 or reg.mean() < 0.22: continue
        plats.append([x0, x1, y])
    plats.sort(key=lambda p: (p[2], p[0]))
    out[n] = plats
    ov = im.copy(); d = ImageDraw.Draw(ov)
    for i, p in enumerate(plats):
        d.line([(p[0], p[2]), (p[1], p[2])], fill=(255, 0, 255), width=4); d.text((p[0] + 2, p[2] - 14), str(i), fill=(255, 255, 0))
    ov.save(f'hopov_{n}_tmp.png')
    print(n, len(plats))
json.dump(out, open('tools/hop_platforms.json', 'w'))

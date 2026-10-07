import os as _os; _os.chdir(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '..'))   # roda a partir da raiz do projeto
# Cria a variante "piscando" de cada Genesio (olhos viram uma linha) e salva as posicoes dos sprites
from PIL import Image, ImageDraw
import numpy as np, json
from scipy import ndimage as nd
res = {}
for k in 'abcde':
    im = Image.open(f'assets/menu-g-{k}.png').convert('RGBA'); A = np.array(im).astype(int)
    al = A[..., 3] > 128
    white = (A[..., :3].min(axis=2) > 190) & al
    red = (A[..., 0] > 150) & (A[..., 1] < 100) & al
    wc = nd.binary_closing(white, iterations=2)
    # rosto = maior regiao branca (com os "buracos" dos olhos/boca preenchidos)
    lab, n = nd.label(wc); sz = nd.sum(wc, lab, range(1, n + 1)); face = lab == 1 + int(np.argmax(sz))
    ff = nd.binary_fill_holes(face)
    dark = (A[..., :3].max(axis=2) < 120) & ff & ~face
    lab, n = nd.label(dark)
    ys, xs = np.where(ff); fy0, fy1 = ys.min(), ys.max()
    mouth_y = np.where(red & ff)[0].min() if (red & ff).any() else fy1
    eyes = []
    for i in range(1, n + 1):
        yy, xx = np.where(lab == i)
        if not (12 <= len(yy) <= 700): continue
        if yy.mean() > mouth_y - 2: continue                     # so o que esta acima da boca
        eyes.append((xx.min(), yy.min(), xx.max(), yy.max()))
    out = im.copy(); d = ImageDraw.Draw(out)
    wpix = A[face][:, :3]; wcol = tuple(int(v) for v in np.median(wpix, axis=0)) + (255,)
    for (x0, y0, x1, y1) in eyes:
        d.rectangle([x0 - 2, y0 - 2, x1 + 2, y1 + 2], fill=wcol)
        cy = (y0 + y1) // 2
        d.line([(x0 - 1, cy + 1), ((x0 + x1) // 2, cy + 3), (x1 + 1, cy + 1)], fill=(28, 28, 28, 255), width=3)
    out.save(f'assets/menu-g-{k}-blink.png')
    res[k] = dict(eyes=len(eyes))
    print(k, 'olhos', len(eyes))
# posicoes (em % da imagem 1672x941) a partir do recorte salvo no menu_prep
boxes = {'a': (118, 177, 329, 359), 'b': (722, 184, 984, 398), 'c': (1475, 225, 1646, 369), 'd': (291, 660, 538, 885), 'e': (1302, 675, 1462, 864)}

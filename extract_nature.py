# Prepara os recursos da fase Nature: icones dos EPIs, frames de subir escada e miniaturas
from PIL import Image
import numpy as np, glob
from scipy import ndimage as nd
D = 'fase-teresopolis'

# ---- EPIs (Analysis output 1..8): as imagens ja tem transparencia; sombras/halos sao semitransparentes ----
names = ['capacete', 'oculos', 'protetor', 'mascara', 'luvas', 'bota', 'colete', 'cinto']
for i, n in enumerate(names, 1):
    im = Image.open(f'{D}/Analysis output {i}.png').convert('RGBA')
    a = np.array(im)
    op = a[..., 3] > 215                                   # so o que e opaco de verdade (o icone)
    op = nd.binary_opening(op, iterations=1)
    lab, k = nd.label(op); sz = nd.sum(op, lab, range(1, k + 1))
    keep = lab == 1 + int(np.argmax(sz))                   # maior peca = o icone (sobras de icones vizinhos saem)
    keep = nd.binary_fill_holes(nd.binary_closing(keep, iterations=2))
    keep = nd.binary_erosion(keep, iterations=1)           # tira o fio claro da borda
    out = a.copy(); out[..., 3] = (keep * 255).astype(np.uint8)
    ys, xs = np.where(keep)
    img = Image.fromarray(out).crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    img.thumbnail((96, 96), Image.LANCZOS)
    img.save(f'{D}/nature/epi_{n}.png')
    print(n, img.size)

# ---- subir escada: 6 quadros (3x2) ----
sh = Image.open('assets/Mint Mascot Ladder-Climbing Sprite Sheet.png').convert('RGBA')
A = np.array(sh)
W, H = sh.size
frames = []
for r in range(2):
    for c in range(3):
        cell = A[r * (H // 2):(r + 1) * (H // 2), c * (W // 3):(c + 1) * (W // 3)].copy()
        m = cell[..., 3] > 235
        m = nd.binary_opening(m, iterations=2)
        lab, k = nd.label(m); sz = nd.sum(m, lab, range(1, k + 1))
        m = lab == 1 + int(np.argmax(sz))
        m = nd.binary_fill_holes(m)
        cell[..., 3] = (m * 255).astype(np.uint8)
        ys, xs = np.where(m)
        frames.append(Image.fromarray(cell).crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)))
fh = 190 / max(f.height for f in frames)
fr = [f.resize((round(f.width * fh), round(f.height * fh)), Image.LANCZOS) for f in frames]
cw = max(f.width for f in fr); ch = max(f.height for f in fr)
for i, f in enumerate(fr):
    c = Image.new('RGBA', (cw, ch), (0, 0, 0, 0)); c.paste(f, ((cw - f.width) // 2, ch - f.height), f)
    c.save(f'frames/ladder{i}.png')
print('ladder', cw, ch)

# ---- cenario + miniaturas ----
Image.open(f'{D}/Colorful Jungle Platformer Adventure.png').convert('RGB').save(f'{D}/nature/bg.jpg', quality=92)
thumbs = sorted(glob.glob(f'{D}/ChatGPT*.png'))
for i, p in enumerate([f'{D}/Colorful Jungle Platformer Adventure.png'] + thumbs[:3]):
    im = Image.open(p).convert('RGB'); im.thumbnail((420, 420)); im.save(f'{D}/nature/card{i + 1}.jpg', quality=82)

sheet = Image.new('RGBA', (96 * 8 + 190 * 0, 96), (170, 190, 170, 255))
for i, n in enumerate(names):
    e = Image.open(f'{D}/nature/epi_{n}.png'); sheet.alpha_composite(e, (i * 96, 0))
sheet2 = Image.new('RGBA', (cw * 6, ch), (170, 190, 170, 255))
for i in range(6):
    f = Image.open(f'frames/ladder{i}.png'); sheet2.alpha_composite(f, (i * cw, 0))
big = Image.new('RGBA', (max(sheet.width, sheet2.width), 96 + ch), (170, 190, 170, 255))
big.alpha_composite(sheet, (0, 0)); big.alpha_composite(sheet2, (0, 96)); big.save('contact_tmp.png')

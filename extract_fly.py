# Recorta os 8 frames do obstaculo voador (folha 4x2 em fundo azul-marinho) e remove o fundo
from PIL import Image
import numpy as np, glob
from scipy import ndimage as nd
D = glob.glob('fase-nova-igua*')[0]
im = Image.open(glob.glob(D + '/*Sprite Sheet.png')[0]).convert('RGB')
A = np.array(im).astype(int)
bgc = np.median(np.concatenate([A[:20, :20].reshape(-1, 3), A[-20:, -20:].reshape(-1, 3)]), axis=0)
print('fundo', bgc)
dist = np.abs(A - bgc).sum(axis=2)
fg = dist > 45
fg = nd.binary_closing(fg, iterations=2)
fg = nd.binary_fill_holes(fg)           # miolo escuro do G tambem fica opaco
colcuts = [0, 313, 622, 945, 1254]
rowcuts = [(200, 620), (620, 1000)]
out = []
for (y0, y1) in rowcuts:
    for i in range(4):
        x0, x1 = colcuts[i], colcuts[i + 1]
        m = fg[y0:y1, x0:x1]
        lab, n = nd.label(m)
        sz = nd.sum(m, lab, range(1, n + 1))
        keep = np.isin(lab, [k + 1 for k, v in enumerate(sz) if v > 150])
        c = np.dstack([np.array(im)[y0:y1, x0:x1], (keep * 255).astype(np.uint8)])
        ys, xs = np.where(keep)
        out.append(Image.fromarray(c[ys.min():ys.max() + 1, xs.min():xs.max() + 1]))
W = max(o.width for o in out); H = max(o.height for o in out)
sc = 0.5
cw, ch = round(W * sc), round(H * sc)
for k, o in enumerate(out):
    t = o.resize((round(o.width * sc), round(o.height * sc)), Image.LANCZOS)
    cell = Image.new('RGBA', (cw, ch), (0, 0, 0, 0))
    cell.paste(t, ((cw - t.width) // 2, (ch - t.height) // 2), t)   # centrado: o corpo fica no meio
    cell.save(f'frames/fly{k}.png')
print(cw, ch, [o.size for o in out])
sheet = Image.new('RGBA', (cw * 8, ch), (255, 200, 120, 255))
for k in range(8):
    f = Image.open(f'frames/fly{k}.png'); sheet.paste(f, (k * cw, 0), f)
sheet.save('contact_tmp.png')

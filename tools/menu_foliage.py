import os as _os; _os.chdir(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '..'))   # roda a partir da raiz do projeto
# Posicoes dos sprites (a partir das mascaras) + mascara de folhagem para o balanco das arvores
from PIL import Image
import numpy as np, cv2, re
from scipy import ndimage as nd
masks = np.load('tools/menu_masks.npy'); H, W = masks.shape[1:]
pos = {}
for k, m in zip('abcde', masks):
    ys, xs = np.where(m); pad = 4
    x0, x1, y0, y1 = max(0, xs.min() - pad), min(W, xs.max() + 1 + pad), max(0, ys.min() - pad), min(H, ys.max() + 1 + pad)
    im = Image.open(f'assets/menu-g-{k}.png'); assert im.size == (x1 - x0, y1 - y0), (k, im.size, (x1 - x0, y1 - y0))
    pos[k] = (x0, y0, x1 - x0)
print(pos)
h = open('index.html', encoding='utf-8').read()
for k, (x, y, w) in pos.items():
    h = re.sub(r'(<div class="mg mg-%s" data-k="%s" style=")left:[\d.]+%%;top:[\d.]+%%;width:[\d.]+%%;' % (k, k),
               lambda m: '%sleft:%.3f%%;top:%.3f%%;width:%.3f%%;' % (m.group(1), x / W * 100, y / H * 100, w / W * 100), h)
open('index.html', 'w', encoding='utf-8').write(h)

# folhagem: verde/amarelo-esverdeado (b <= r), fora do titulo e dos botoes
A = np.array(Image.open('assets/menu-bg.jpg').convert('RGB')).astype(int)
r, g, b = A[..., 0], A[..., 1], A[..., 2]
fol = (g > r + 6) & (b < r + 8) & (g > 85) & (g - b > 35)
fol = nd.binary_opening(fol, iterations=1)
fol = nd.binary_closing(fol, iterations=2)
keep = np.ones_like(fol); keep[395:795, 468:1235] = False          # titulo + botoes ficam parados
fol &= keep
m = cv2.GaussianBlur((fol * 255).astype(np.uint8), (0, 0), 5)
Image.fromarray(m).save('assets/menu-foliage.png')
print('folhagem', fol.mean().round(3))
ov = np.array(Image.open('assets/menu-bg.jpg').convert('RGB'))
ov[m > 128] = (ov[m > 128] * 0.5 + np.array([255, 0, 255]) * 0.5).astype(np.uint8)
Image.fromarray(ov).resize((836, 470)).save('fol_prev_tmp.png')

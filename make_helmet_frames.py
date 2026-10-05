# Gera o Genesio de capacete a partir dos MESMOS frames de correr/pular sem capacete (animacao identica),
# colando o capacete (recortado da folha "Construction Mascot") no topo da cabeca de cada frame.
from PIL import Image
import numpy as np, glob
from scipy import ndimage as nd
D = glob.glob('fase-nova-igua*')[0]
sheet = np.array(Image.open(glob.glob(D + '/Construction*')[0]).convert('RGB'))
cell = sheet[:512, :384].astype(int)              # 1o quadro (4x2 de 384x512)
r, g, b = cell[..., 0], cell[..., 1], cell[..., 2]
yellow = (r > 190) & (g > 120) & (b < 110) & (r > g)
yellow = nd.binary_closing(yellow, iterations=3)
lab, n = nd.label(yellow); sz = nd.sum(yellow, lab, range(1, n + 1))
hat = lab == 1 + int(np.argmax(sz))
hat = nd.binary_fill_holes(hat)
solid = nd.binary_fill_holes(nd.binary_dilation(hat, iterations=3))   # + contorno escuro
ys, xs = np.where(solid)
x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
hat_img = Image.fromarray(np.dstack([cell[y0:y1, x0:x1].astype(np.uint8), (solid[y0:y1, x0:x1] * 255).astype(np.uint8)]))
hat_img.save('hat_tmp.png')
print('capacete', hat_img.size)

def put_hat(frame, hat_w_ratio=0.80, drop=0.42, angle=0, dx=0.0):
    a = np.array(frame)[..., 3] > 40
    ys, xs = np.where(a)
    top = ys.min()
    band = (ys <= top + 5)
    cx = xs[band].mean() + dx
    body_w = xs.max() - xs.min()
    hw = int(body_w * hat_w_ratio)
    hh = int(hat_img.height * hw / hat_img.width)
    h = hat_img.resize((hw, hh), Image.LANCZOS).rotate(angle, expand=True, resample=Image.BICUBIC)
    out = Image.new('RGBA', (frame.width + 60, frame.height + 80), (0, 0, 0, 0))
    ox, oy = 30, 80
    out.alpha_composite(frame, (ox, oy))
    px = int(ox + cx - h.width / 2)
    py = int(oy + top - h.height + h.height * drop)
    out.alpha_composite(h, (max(0, px), max(0, py)))
    bb = out.getbbox()
    return out.crop(bb)

def build(src_name, dst_name, n, params):
    ims = []
    for i in range(n):
        f = Image.open(f'frames/{src_name}{i}.png').convert('RGBA')
        f = f.crop(f.getbbox())
        ims.append(put_hat(f, **params.get(i, params.get('all', {}))))
    W = max(i.width for i in ims); H = max(i.height for i in ims)
    for i, im in enumerate(ims):
        c = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        c.paste(im, ((W - im.width) // 2, H - im.height), im)    # pés continuam na base
        c.save(f'frames/{dst_name}{i}.png')
    print(dst_name, (W, H))

build('run', 'hrun', 4, {'all': dict(hat_w_ratio=0.80, drop=0.82, angle=-12, dx=-4)})
build('jump', 'hjump', 5, {'all': dict(hat_w_ratio=0.80, drop=0.82, angle=-12, dx=-4)})
sh = Image.new('RGBA', (163 * 9, 260), (236, 196, 120, 255))
x = 0
for n, k in [('run', 4), ('hrun', 4), ('hjump', 5)]:
    for i in range(k):
        f = Image.open(f'frames/{n}{i}.png'); sh.paste(f, (x, 260 - f.height), f); x += 163
sh.save('contact_tmp.png')

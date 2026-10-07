import os as _os; _os.chdir(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '..'))   # roda a partir da raiz do projeto
# Extrai os sprites da fase Solar do Bosque: Genesio (martelo / dano), Golem (boss) e os dois mobs
from PIL import Image
import numpy as np, glob, cv2
from scipy import ndimage as nd
D = 'fase-solar-do-bosque'
OUT = D + '/sprites'

def cut_white(rgb, keep_near=0, face_fix=True):
    """rgb HxWx3 (fundo branco). Remove fundo/sombra ligados a borda; devolve (rgba, mask)"""
    A = rgb.astype(int)
    light = (A.min(axis=2) > 168) & ((A.max(axis=2) - A.min(axis=2)) < 38)
    lab, n = nd.label(light)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(edge))
    fg = ~bg
    fg = nd.binary_opening(fg, iterations=1)
    lab, n = nd.label(fg)
    if n == 0: return None
    sz = nd.sum(fg, lab, range(1, n + 1))
    big = 1 + int(np.argmax(sz))
    keep = lab == big
    if keep_near:
        ys, xs = np.where(keep)
        x0, x1, y0, y1 = xs.min() - keep_near, xs.max() + keep_near, ys.min() - keep_near, ys.max() + keep_near
        for i, s in enumerate(sz):
            if i + 1 == big or s < 60: continue
            yy, xx = np.where(lab == i + 1)
            if x0 <= xx.mean() <= x1 and y0 <= yy.mean() <= y1: keep |= lab == i + 1
    keep = nd.binary_fill_holes(keep)
    if face_fix:                                   # rosto branco do G: restaura dentro do casco do tronco verde
        r_, g_, b_ = A[..., 0], A[..., 1], A[..., 2]
        gr = keep & (g_ > r_ + 35) & (g_ > b_ + 15)
        torso = nd.binary_opening(gr, iterations=9)
        lab_t, nt = nd.label(torso)
        if nt:
            st = nd.sum(torso, lab_t, range(1, nt + 1)); torso = lab_t == 1 + int(np.argmax(st))
            pts = np.column_stack(np.where(torso)[::-1]).astype(np.int32)
            hull = np.zeros(torso.shape, np.uint8); cv2.fillConvexPoly(hull, cv2.convexHull(pts), 1)
            keep |= (hull > 0) & (A.min(axis=2) > 150)
            keep = nd.binary_closing(keep, iterations=2)
    keep = nd.binary_erosion(keep, iterations=1)
    a = np.dstack([rgb, (keep * 255).astype(np.uint8)])
    return a, keep

def anchored(frames, anchors, target_h, name):
    """frames: lista de RGBA(np), anchors: (ax, ay) em cada; salva todos na mesma tela com a ancora fixa"""
    sc = target_h
    L = max(a[0] for a in anchors); R = max(f.shape[1] - a[0] for f, a in zip(frames, anchors))
    T = max(a[1] for a in anchors); B = max(f.shape[0] - a[1] for f, a in zip(frames, anchors))
    W, H = int(L + R + 2), int(T + B + 2)
    for i, (f, (ax, ay)) in enumerate(zip(frames, anchors)):
        c = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        c.paste(Image.fromarray(f), (int(L - ax), int(T - ay)), Image.fromarray(f))
        c = c.resize((max(1, round(W * sc)), max(1, round(H * sc))), Image.LANCZOS)
        c.save(f'{OUT}/{name}{i}.png')
    w, h = round(W * sc), round(H * sc)
    print(name, len(frames), (w, h), 'ancora', (round(L * sc), round(T * sc)))
    return (w, h, round(L * sc), round(T * sc))

def green_anchor(rgba):
    """ancora = centro dos pes (parte baixa do verde do Genesio) e base do verde"""
    a = rgba[..., 3] > 128; r, g, b = [rgba[..., i].astype(int) for i in range(3)]
    gr = a & (g > r + 35) & (g > b + 15)
    ys, xs = np.where(gr)
    low = ys > ys.max() - max(14, int(0.12 * (ys.max() - ys.min())))
    return (xs[low].mean(), ys.max())

meta = {}
# ---- Genesio com martelo: 5 x 4 ----
im = np.array(Image.open(f'{D}/Genésio Hammer Action Sprite Sheet.png').convert('RGB'))
H, W = im.shape[:2]; cw, ch = W / 5, H / 4
frames, anchors = [], []
for i in range(20):
    r, c = divmod(i, 5)
    crop = im[int(r * ch) + 8:int((r + 1) * ch) - 6, int(c * cw) + 8:int((c + 1) * cw) - 8]
    res = cut_white(crop)
    f, k = res
    ys, xs = np.where(k); f = f[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    frames.append(f); anchors.append(green_anchor(f))
meta['hm'] = anchored(frames, anchors, 0.62, 'hm')
# ---- Genesio machucado: 5 x 4 ----
im = np.array(Image.open(f'{D}/Green Mascot Hurt Pose Sprite Sheet.png').convert('RGB'))
H, W = im.shape[:2]; cw, ch = W / 5, H / 4
frames, anchors = [], []
for i in range(20):
    r, c = divmod(i, 5)
    crop = im[int(r * ch) + 8:int((r + 1) * ch) - 6, int(c * cw) + 8:int((c + 1) * cw) - 8]
    f, k = cut_white(crop)
    ys, xs = np.where(k); f = f[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    frames.append(f); anchors.append(green_anchor(f))
meta['hh'] = anchored(frames, anchors, 0.62 * 290 / 307, 'hh')   # mesma escala visual
# ---- mobs ----
for src, name in [('ChatGPT Image Oct 5, 2026, 12_15_04 PM-1.png', 'fly'), ('ChatGPT Image Oct 5, 2026, 12_15_06 PM-2.png', 'rock')]:
    m = Image.open(f'{D}/{src}').convert('RGBA'); a = np.array(m); al = a[..., 3] > 40
    ys, xs = np.where(al); m = m.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    m.thumbnail((200, 200), Image.LANCZOS); m.save(f'{OUT}/{name}.png'); print(name, m.size)
print('ok')

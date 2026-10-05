# Extrai: martelo, capacete (icones), animacoes de pegar/perder o capacete e os frames do Genesio de capacete
from PIL import Image
import numpy as np, glob, os
from scipy import ndimage as nd
D = glob.glob('fase-nova-igua*')[0]
os.makedirs(D + '/oasis', exist_ok=True)
def load(pat): return Image.open(glob.glob(D + '/' + pat)[0]).convert('RGB')

def cutout(rgb, T, rim=2, minarea=150, keep_near=True, drop_gray=False):
    """rgb: array HxWx3. Fundo = pixels escuros ligados a borda. Devolve RGBA (mesmo tamanho)."""
    A = rgb.astype(int)
    dark = A.max(axis=2) < T
    lab, n = nd.label(dark)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(edge))
    fg = ~bg
    fg = nd.binary_opening(fg, iterations=1) | (fg & nd.binary_dilation(nd.binary_opening(fg, iterations=1), iterations=2))
    lab, n = nd.label(fg)
    if n == 0: return None
    sz = nd.sum(fg, lab, range(1, n + 1))
    big = 1 + int(np.argmax(sz))
    ys, xs = np.where(lab == big)
    bx0, bx1, by0, by1 = xs.min() - 12, xs.max() + 12, ys.min() - 12, ys.max() + 12
    keep = np.zeros_like(fg)
    for i, s in enumerate(sz):
        if s < minarea: continue
        if drop_gray:   # sombras/poeira acinzentadas do chao nao fazem parte do sprite
            m = lab == i + 1
            if (A.max(axis=2) - A.min(axis=2))[m].mean() < 30: continue
        yy, xx = np.where(lab == i + 1)
        cx, cy = xx.mean(), yy.mean()
        if i + 1 == big or not keep_near or (bx0 <= cx <= bx1 and by0 <= cy <= by1): keep |= lab == i + 1
    solid = nd.binary_dilation(keep, iterations=rim)          # contorno escuro de 'rim' px em volta
    solid = nd.binary_fill_holes(solid)
    out = np.dstack([rgb, (solid * 255).astype(np.uint8)])
    return Image.fromarray(out)

def trim(im):
    a = np.array(im)[..., 3] > 0
    ys, xs = np.where(a)
    return im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))

def save_set(name, ims, factor, cell=None):
    ims = [i.resize((max(1, round(i.width * factor)), max(1, round(i.height * factor))), Image.LANCZOS) for i in ims]
    W = max(i.width for i in ims); H = max(i.height for i in ims)
    for k, i in enumerate(ims):
        c = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        c.paste(i, ((W - i.width) // 2, H - i.height), i)
        c.save(f'frames/{name}{k}.png')
    print(name, len(ims), (W, H))
    return W, H

# ---------- icones ----------
ham = trim(cutout(np.array(load('Pixel Art Claw*')), 45, minarea=800))
ham.thumbnail((160, 160), Image.LANCZOS); ham.save(D + '/oasis/hammer.png')
hat = trim(cutout(np.array(load('Golden*')), 40, minarea=800))
hat.thumbnail((160, 160), Image.LANCZOS); hat.save(D + '/oasis/helmet.png')
print('icones', ham.size, hat.size)

# ---------- sequencias (pegar / perder capacete) ----------
def sequence(pat, name, target_last_h):
    rgb = np.array(load(pat))
    full = cutout(rgb, 60, rim=2, minarea=60, keep_near=False)
    a = np.array(full)[..., 3] > 0
    cols = a.any(axis=0)
    # separa pelos vaos de colunas vazias
    segs, start = [], None
    for x, v in enumerate(cols):
        if v and start is None: start = x
        if not v and start is not None:
            if segs and x - 0 and start - segs[-1][1] < 14: segs[-1] = (segs[-1][0], x)
            else: segs.append((start, x))
            start = None
    if start is not None: segs.append((start, len(cols)))
    segs = [s for s in segs if s[1] - s[0] > 40]
    print(name, 'segmentos', segs)
    ims = [trim(full.crop((s[0], 0, s[1], full.height))) for s in segs]
    f = target_last_h / ims[-1].height
    return save_set(name, ims, f)
# mesma escala para as duas sequencias (mesmo tamanho de imagem): ultimo quadro de "pegar" = Genesio de capacete andando
def seq_frames(pat):
    rgb = np.array(load(pat))
    full = cutout(rgb, 60, rim=2, minarea=60, keep_near=False)
    cols = (np.array(full)[..., 3] > 0).any(axis=0)
    segs, start = [], None
    for x, v in enumerate(cols):
        if v and start is None: start = x
        if not v and start is not None:
            if segs and start - segs[-1][1] < 14: segs[-1] = (segs[-1][0], x)
            else: segs.append((start, x))
            start = None
    if start is not None: segs.append((start, len(cols)))
    segs = [t for t in segs if t[1] - t[0] > 40]
    print(pat, 'segmentos', segs)
    return [trim(full.crop((t[0], 0, t[1], full.height))) for t in segs]
pick = seq_frames('ChatGPT Image Oct 1, 2026, 12_11_07*')
def lose_frames(pat):
    # os quadros 3-5 se tocam na horizontal (maos, capacete voando): separa por componente com regras de posicao
    rgb = np.array(load(pat))
    full = np.array(cutout(rgb, 60, rim=2, minarea=60, keep_near=False))
    lab, n = nd.label(nd.binary_dilation(full[..., 3] > 0, iterations=3))
    def which(cx, cy):
        if cx < 345: return 0
        if cx < 672: return 1
        if cx < 1005: return 2
        if cx > 1395 and cy > 365: return 4
        return 3
    groups = [np.zeros(full.shape[:2], bool) for _ in range(5)]
    for i in range(1, n + 1):
        m = lab == i
        if m.sum() < 80: continue
        yy, xx = np.where(m)
        groups[which(xx.mean(), yy.mean())] |= m
    out = []
    for gm in groups:
        a = full.copy(); a[..., 3] = np.where(gm & (full[..., 3] > 0), 255, 0)
        out.append(trim(Image.fromarray(a)))
    return out
lose = lose_frames('ChatGPT Image Oct 1, 2026, 12_11_11*')
fs = 176 / pick[-1].height
save_set('pickup', pick, fs)
save_set('lose', lose, fs)

# (o Genesio de capacete correndo/pulando e gerado por make_helmet_frames.py a partir dos frames normais)

# ---------- coracao: icone + animacoes de pegar (sem e com capacete) ----------
heart = trim(cutout(np.array(load('Glossy*')), 40, minarea=800))
heart.thumbnail((96, 96), Image.LANCZOS); heart.save(D + '/oasis/heart.png')
ha = np.array(heart).astype(float)                       # versao "vazia": cinza escuro translucido
lum = ha[..., :3].mean(axis=2, keepdims=True) * 0.45
empty = np.dstack([np.repeat(lum, 3, axis=2), ha[..., 3:4] * 0.55]).astype(np.uint8)
Image.fromarray(empty).save(D + '/oasis/heart_empty.png')
h1 = seq_frames('ChatGPT Image Oct 1, 2026, 12_27_58*')
h2 = seq_frames('ChatGPT Image Oct 1, 2026, 12_28_03*')
fh = 150 / h1[-1].height
save_set('heart', h1, fh)
save_set('hheart', h2, fh)

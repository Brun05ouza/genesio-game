import os as _os; _os.chdir(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '..'))   # roda a partir da raiz do projeto
"""Extrai as 20 poses do Golem (folha com etiquetas "1. IDLE A" ...) para fase-solar-do-bosque/sprites/gb0..19.png,
todas no mesmo tamanho e ancoradas pelos pés (a âncora é impressa no fim: copie para M.gb em solar.js se mudar).

Como recorta (sem buracos e sem pedaços dos vizinhos):
 1. Fundo = pixels claros e sem cor LIGADOS À BORDA da folha (preenchimento). O contorno escuro do pixel art impede que
    o preenchimento entre no golem, então brilhos das pedras, olhos e detalhes claros por dentro ficam intactos.
    A sombra cinza-clara do chão também sai (está ligada ao fundo).
 2. Buracos internos de branco puro e grandes (vão entre braço e corpo, dentro da corrente) também viram fundo.
 3. As etiquetas escuras são apagadas e cada pedaço restante (golem, bola, estrelas, pedrinhas, rastros) vai para o
    quadro cuja etiqueta está logo abaixo dele e mais perto na horizontal.
 4. Tira o halo claro de 1-2 px que sobra na borda."""
from PIL import Image
import numpy as np, cv2
from scipy import ndimage as nd

D = 'fase-solar-do-bosque'; OUT = D + '/sprites'
A = np.array(Image.open(f'{D}/Pixel Golem Boss Sprite Sheet.png').convert('RGB')); H, W = A.shape[:2]
Ai = A.astype(int); mn, mx = Ai.min(axis=2), Ai.max(axis=2); sat = mx - mn

# ---- etiquetas (retângulos escuros com texto claro) ----
chip = nd.binary_closing(mx < 75, structure=np.ones((5, 15)))
lab, n = nd.label(chip)
chips = []
for i, sl in enumerate(nd.find_objects(lab), 1):
    h = sl[0].stop - sl[0].start; w = sl[1].stop - sl[1].start
    if 90 < w < 260 and 18 < h < 40 and (lab[sl] == i).mean() > 0.7:
        chips.append((sl[1].start, sl[0].start, sl[1].stop, sl[0].stop))
chips.sort(key=lambda c: (round(c[1] / 120), c[0]))
assert len(chips) == 20, f'esperava 20 etiquetas, achei {len(chips)}'
chipm = np.zeros((H, W), bool)
for x0, y0, x1, y1 in chips: chipm[y0 - 4:y1 + 4, x0 - 4:x1 + 4] = True

# ---- fundo: claro e sem cor, ligado à borda ----
bgish = ((mn > 168) & (sat < 34)) | chipm
lb, _ = nd.label(bgish)
edge = np.unique(np.concatenate([lb[0], lb[-1], lb[:, 0], lb[:, -1]])); edge = edge[edge > 0]
bg = np.isin(lb, edge) | chipm
# buracos internos grandes de branco puro (vãos), não os brilhos pequenos
white = (mn > 236) & (sat < 16) & ~bg
lw, nw = nd.label(white)
if nw:
    sz = nd.sum(white, lw, range(1, nw + 1))
    bg |= np.isin(lw, 1 + np.where(sz > 160)[0])
# halo claro na borda: pixel claro/sem cor encostado no fundo vira fundo (2 passadas)
for _ in range(2):
    ring = nd.binary_dilation(bg) & ~bg
    bg |= ring & (mn > 150) & (sat < 40)
fg = ~bg
fg = nd.binary_opening(fg, structure=np.ones((2, 2)))

# ---- cada pedaço vai para o quadro certo ----
lf, nf = nd.label(fg, structure=np.ones((3, 3)))
cent = nd.center_of_mass(fg, lf, range(1, nf + 1))
area = nd.sum(fg, lf, range(1, nf + 1))
rows = sorted({round(c[1] / 120) for c in chips})
row_top = {}                                   # topo de cada faixa = fim das etiquetas da faixa de cima
prev = 0
for r in rows:
    ks = [k for k, c in enumerate(chips) if round(c[1] / 120) == r]
    row_top[r] = (prev, min(chips[k][1] for k in ks), ks)
    prev = max(chips[k][3] for k in ks)
owner = np.zeros(nf + 1, int) - 1
for j, ((cy, cx), a) in enumerate(zip(cent, area), 1):
    if a < 25: continue                        # poeira de 1-2 pixels
    for r, (t, b, ks) in row_top.items():
        if t <= cy < b + 6:
            owner[j] = min(ks, key=lambda k: abs((chips[k][0] + chips[k][2]) / 2 - cx)); break

cells = []
for k in range(20):
    keep = np.isin(lf, np.where(owner == k)[0])
    ys, xs = np.where(keep)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    kk = keep[y0:y1, x0:x1]
    rgba = np.dstack([A[y0:y1, x0:x1], (kk * 255).astype(np.uint8)])
    # âncora: centro dos pés do maior pedaço (o golem), na base dele
    big = lf[y0:y1, x0:x1] == (1 + int(np.argmax(np.where(owner[1:] == k, area, 0))))
    yy, xx = np.where(big); low = yy > yy.max() - 22
    cells.append((rgba, (xx[low].mean(), yy.max())))

L = max(a[0] for _, a in cells); R = max(f.shape[1] - a[0] for f, a in cells)
T = max(a[1] for _, a in cells); B = max(f.shape[0] - a[1] for f, a in cells)
Wc, Hc = int(np.ceil(L + R)) + 2, int(np.ceil(T + B)) + 2
for i, (f, (ax, ay)) in enumerate(cells):
    c = Image.new('RGBA', (Wc, Hc), (0, 0, 0, 0)); im = Image.fromarray(f)
    c.paste(im, (int(round(L - ax)), int(round(T - ay))), im); c.save(f'{OUT}/gb{i}.png', optimize=True)
print('gb 20', (Wc, Hc), 'ancora (M.gb ax, ay):', (int(round(L)), int(round(T))))
_os.makedirs('tools/out', exist_ok=True)
sh = Image.new('RGBA', (Wc * 5, Hc * 4), (255, 0, 255, 255))
for i in range(20): sh.alpha_composite(Image.open(f'{OUT}/gb{i}.png'), ((i % 5) * Wc, (i // 5) * Hc))
sh.save('tools/out/golem-contact.png')

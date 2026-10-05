# Extrai as 20 poses do Golem (folha com etiquetas) e salva ancoradas pelos pes
from PIL import Image
import numpy as np, cv2
from scipy import ndimage as nd
D = 'fase-solar-do-bosque'; OUT = D + '/sprites'
im = Image.open(f'{D}/Pixel Golem Boss Sprite Sheet.png').convert('RGB'); A = np.array(im); H, W = A.shape[:2]
Ai = A.astype(int)
# etiquetas: retangulos escuros (navy) com texto claro
chip = (Ai.max(axis=2) < 75)
chip = nd.binary_closing(chip, structure=np.ones((5, 15)))
lab, n = nd.label(chip)
chips = []
for i, sl in enumerate(nd.find_objects(lab), 1):
    h = sl[0].stop - sl[0].start; w = sl[1].stop - sl[1].start
    if 90 < w < 260 and 18 < h < 40 and (lab[sl] == i).mean() > 0.7:
        chips.append((sl[1].start, sl[0].start, sl[1].stop, sl[0].stop))
chips.sort(key=lambda c: (round(c[1] / 120), c[0]))
print('etiquetas', len(chips))
chipm = np.zeros((H, W), bool)
for x0, y0, x1, y1 in chips: chipm[y0 - 3:y1 + 3, x0 - 3:x1 + 3] = True
non = ((Ai.min(axis=2) < 200) | ((Ai.max(axis=2) - Ai.min(axis=2)) > 45)) & ~chipm
non = nd.binary_opening(non, iterations=1)
# linhas de etiquetas -> faixas verticais; dentro de cada faixa separa os quadros pelas colunas vazias
rows = {}
for k, c in enumerate(chips): rows.setdefault(round(c[1] / 120), []).append(k)
frames = [None] * len(chips)
prev_bottom = 0
for rk in sorted(rows):
    ks = rows[rk]; ytop = prev_bottom; ybot = min(chips[k][1] for k in ks)
    prev_bottom = max(chips[k][3] for k in ks) + 2
    band = non[ytop:ybot]
    col = band.sum(axis=0) > 0
    col = nd.binary_closing(col, structure=np.ones(9))
    lab1, n1 = nd.label(col)
    segs = [(sl[0].start, sl[0].stop) for sl in nd.find_objects(lab1) if sl[0].stop - sl[0].start > 80]
    print('faixa', rk, 'etiquetas', len(ks), 'quadros por vazio', len(segs))
    if len(segs) != len(ks):                       # fallback: fronteiras no meio das etiquetas
        xs_c = [(chips[k][0] + chips[k][2]) / 2 for k in ks]
        bounds = [0] + [(xs_c[i] + xs_c[i + 1]) / 2 for i in range(len(xs_c) - 1)] + [W]
        segs = [(int(bounds[i]), int(bounds[i + 1])) for i in range(len(ks))]
    for k, (x0, x1) in zip(ks, segs):
        m = np.zeros((H, W), bool); m[ytop:ybot, x0:x1] = non[ytop:ybot, x0:x1]
        ys, xs = np.where(m)
        if len(ys) == 0: continue
        sl = (slice(ys.min(), ys.max() + 1), slice(xs.min(), xs.max() + 1))
        frames[k] = (sl, m)
cells = []
for k, f in enumerate(frames):
    sl, m = f
    y0, y1, x0, x1 = max(0, sl[0].start - 6), min(H, sl[0].stop + 6), max(0, sl[1].start - 6), min(W, sl[1].stop + 6)
    roi = np.zeros((H, W), bool); roi[y0:y1, x0:x1] = nd.binary_dilation(m, iterations=6)[y0:y1, x0:x1]
    crop = A[y0:y1, x0:x1]
    # fundo branco ligado a borda sai; so mantem o que esta dentro do ROI do grupo (nao pega vizinhos)
    cl = Ai[y0:y1, x0:x1]
    light = (cl.min(axis=2) > 205) & ((cl.max(axis=2) - cl.min(axis=2)) < 30)
    lb, nb = nd.label(light)
    edge = set(np.unique(np.concatenate([lb[0], lb[-1], lb[:, 0], lb[:, -1]]))) - {0}
    bg = np.isin(lb, list(edge))
    keep = ~bg & roi[y0:y1, x0:x1]
    keep &= ~light                                  # branco puro nunca faz parte do golem (buracos entre as pernas)
    sh = (cl.min(axis=2) > 170) & ((cl.max(axis=2) - cl.min(axis=2)) < 22)
    keep &= ~(sh & ~nd.binary_erosion(keep, iterations=4))
    keep = nd.binary_opening(keep, iterations=1)
    lb2, n2 = nd.label(keep); s2 = nd.sum(keep, lb2, range(1, n2 + 1))
    mi = 1 + int(np.argmax(s2)); yy, xx = np.where(lb2 == mi)
    bx0, bx1, by0, by1 = xx.min() - 55, xx.max() + 55, yy.min() - 55, yy.max() + 55
    ok = [mi]
    for j, v in enumerate(s2):
        if j + 1 == mi or v < 40: continue
        y_, x_ = np.where(lb2 == j + 1)
        if bx0 <= x_.mean() <= bx1 and by0 <= y_.mean() <= by1: ok.append(j + 1)
    keep = np.isin(lb2, ok)
    rgba = np.dstack([crop, (keep * 255).astype(np.uint8)])
    ys, xs = np.where(keep); rgba = rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1]; kk = keep[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    # ancora: centro dos pes (parte baixa) e base
    yy, xx = np.where(kk); low = yy > yy.max() - 22
    ax, ay = xx[low].mean(), yy.max()
    cells.append((rgba, (ax, ay)))
L = max(a[0] for _, a in cells); R = max(f.shape[1] - a[0] for f, a in cells)
T = max(a[1] for _, a in cells); B = max(f.shape[0] - a[1] for f, a in cells)
Wc, Hc = int(L + R + 2), int(T + B + 2)
SC = 1.0
for i, (f, (ax, ay)) in enumerate(cells):
    c = Image.new('RGBA', (Wc, Hc), (0, 0, 0, 0)); c.paste(Image.fromarray(f), (int(L - ax), int(T - ay)), Image.fromarray(f))
    c = c.resize((round(Wc * SC), round(Hc * SC)), Image.NEAREST); c.save(f'{OUT}/gb{i}.png')
print('gb', len(cells), (round(Wc * SC), round(Hc * SC)), 'ancora', (round(L * SC), round(T * SC)))
w, h = round(Wc * SC), round(Hc * SC)
sh = Image.new('RGBA', (w * 5, h * 4), (150, 190, 150, 255))
for i in range(len(cells)):
    sh.alpha_composite(Image.open(f'{OUT}/gb{i}.png'), ((i % 5) * w, (i // 5) * h))
sh.thumbnail((1500, 1100)); sh.save('sheet_gb_tmp.png')

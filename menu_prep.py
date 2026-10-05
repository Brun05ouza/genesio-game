# Separa os 5 Genesios da arte do menu (sprites com transparencia) e gera o fundo limpo (sem eles)
from PIL import Image
import numpy as np, cv2
from scipy import ndimage as nd
A0 = np.array(Image.open('assets/menu-original.png').convert('RGB'))
A = A0.astype(int); r, g, b = A[..., 0], A[..., 1], A[..., 2]
H, W = r.shape
boxes = {'a': (105, 145, 345, 355), 'b': (715, 155, 1005, 400), 'c': (1475, 205, 1665, 385), 'd': (290, 630, 560, 895), 'e': (1295, 655, 1545, 885)}
mint_base = (g > 130) & (b > r + 20) & (g > b + 12) & (g - r > 55)
mint_loose = mint_base | ((g > 195) & (b > 115) & (g - r > 55) & (r < 200))                    # + brilho claro do topo do G
mint_tight = mint_base | ((g > 195) & (b > 115) & (g - b > 40) & (g - r > 55) & (r < 200))   # sem confundir com ceu claro (so no 1o)
dark = (A.max(axis=2) < 105) & ((g - r) < 28) & ((g - b) < 28)      # preto/marrom escuro do contorno (folhagem escura tem verde forte)
white = A.min(axis=2) > 205
cv2.setRNGSeed(7)
masks = {}
for k, (x0, y0, x1, y1) in boxes.items():
    mint = mint_tight if k == 'a' else mint_loose
    m = np.zeros((H, W), bool); m[y0:y1, x0:x1] = mint[y0:y1, x0:x1]
    m = nd.binary_closing(m, iterations=3)
    lab, n = nd.label(m); sz = nd.sum(m, lab, range(1, n + 1))
    m = np.isin(lab, [i + 1 for i, v in enumerate(sz) if v > 0.04 * sz.max()])
    big = nd.binary_closing(m | (dark & nd.binary_dilation(m, iterations=8)), structure=np.ones((3, 3)), iterations=12)
    body = nd.binary_opening(m, iterations=9)                                      # so o tronco (sem bracos e pernas)
    lab_b, nb = nd.label(body); szb = nd.sum(body, lab_b, range(1, nb + 1)); body = lab_b == 1 + int(np.argmax(szb))
    pts = np.column_stack(np.where(body)[::-1]).astype(np.int32)
    hull = np.zeros((H, W), np.uint8); cv2.fillConvexPoly(hull, cv2.convexHull(pts), 1)
    face = ((hull > 0) | nd.binary_fill_holes(big)) & white & ~dark
    sure_fg = nd.binary_erosion(m, iterations=2) | nd.binary_erosion(face, iterations=2)
    zone = nd.binary_dilation(m | face, iterations=10)
    gc = np.full((H, W), cv2.GC_BGD, np.uint8)
    gc[zone] = cv2.GC_PR_BGD
    gc[nd.binary_dilation(m | face, iterations=4)] = cv2.GC_PR_FGD
    gc[sure_fg] = cv2.GC_FGD
    pad = 14; X0, Y0, X1, Y1 = max(0, x0 - pad), max(0, y0 - pad), min(W, x1 + pad), min(H, y1 + pad)
    sub = np.ascontiguousarray(A0[Y0:Y1, X0:X1][..., ::-1]); gsub = gc[Y0:Y1, X0:X1].copy()
    bg_m = np.zeros((1, 65)); fg_m = np.zeros((1, 65))
    cv2.grabCut(sub, gsub, None, bg_m, fg_m, 6, cv2.GC_INIT_WITH_MASK)
    fgm = np.zeros((H, W), bool); fgm[Y0:Y1, X0:X1] = (gsub == cv2.GC_FGD) | (gsub == cv2.GC_PR_FGD)
    fgm |= (nd.binary_erosion(m, iterations=1) | face)       # todo o verde-menta e o rosto ficam, mesmo se o GrabCut hesitar
    fgm |= nd.binary_dilation(m | face, iterations=1) & (dark | white | m)         # contorno preto junto: rosto e bracos ficam ligados ao corpo
    fgm = nd.binary_closing(fgm, iterations=4)
    fgm = nd.binary_opening(fgm, iterations=1)
    lab, n = nd.label(fgm); sz = nd.sum(fgm, lab, range(1, n + 1))
    core = nd.binary_fill_holes(lab == 1 + int(np.argmax(sz)))
    okc = nd.binary_dilation(mint, iterations=2) | dark | white | nd.binary_dilation(dark, iterations=1)
    core = core & okc                                      # tira manchas de ceu/folhagem que nao sao do personagem
    core = nd.binary_opening(core, iterations=1)
    lab, n = nd.label(core); sz = nd.sum(core, lab, range(1, n + 1)); core = nd.binary_fill_holes(lab == 1 + int(np.argmax(sz)))
    if k == 'a':          # o pe encosta na quina do telhado: so aceita verde-menta, preto ou branco na parte de baixo
        ok = nd.binary_dilation(mint, iterations=2) | dark | white
        low = np.zeros_like(core); low[285:, :] = True
        core = core & ~(low & ~ok)
        core = nd.binary_opening(core, iterations=2)
        lab, n = nd.label(core); sz = nd.sum(core, lab, range(1, n + 1)); core = lab == 1 + int(np.argmax(sz))
    # ---- refinamento: o contorno preto fecha o personagem; tudo que fica dentro dele e e verde/branco faz parte ----
    pad = 16; X0, Y0, X1, Y1 = max(0, x0 - pad), max(0, y0 - pad), min(W, x1 + pad), min(H, y1 + pad)
    dk = (A.max(axis=2) < 110) & ((g - r) < 34) & ((g - b) < 34)
    sub_d = dk[Y0:Y1, X0:X1]
    D = nd.binary_dilation(sub_d, iterations=2)
    lab, n = nd.label(~D)
    edge_ids = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    good = (mint | white | ((g > 195) & (b > 115)))[Y0:Y1, X0:X1]
    keep = np.zeros_like(sub_d)
    for i in range(1, n + 1):
        if i in edge_ids: continue
        comp = lab == i
        if comp.sum() < 120: continue
        if good[comp].mean() >= 0.45: keep |= comp
    ch = nd.binary_dilation(keep, iterations=3) & (D | keep)           # interior + o proprio contorno preto
    ch = nd.binary_closing(ch | (sub_d & nd.binary_dilation(keep, iterations=6)), iterations=2)
    ch = nd.binary_fill_holes(ch)
    lab2, n2 = nd.label(ch)
    if n2:
        sz2 = nd.sum(ch, lab2, range(1, n2 + 1)); ch = lab2 == 1 + int(np.argmax(sz2))
        full = np.zeros((H, W), bool); full[Y0:Y1, X0:X1] = ch
        if 0.8 * core.sum() <= full.sum() <= 1.7 * core.sum():
            core = full | (core & nd.binary_dilation(full, iterations=2))
            print(k, 'recorte pelo contorno')
    masks[k] = core
    print(k, core.sum())
np.save('menu_masks.npy', np.stack([masks[k] for k in 'abcde']))
# fundo limpo: remove os 5 (com folga) e preenche
allm = np.zeros((H, W), bool)
for m in masks.values(): allm |= m
allm = nd.binary_dilation(allm, iterations=7)
plate = cv2.inpaint(A0, (allm * 255).astype(np.uint8), 7, cv2.INPAINT_TELEA)
Image.fromarray(plate).save('assets/menu-bg.jpg', quality=92)
# sprites
for k, m in masks.items():
    ys, xs = np.where(m); pad = 4
    x0, x1, y0, y1 = max(0, xs.min() - pad), min(W, xs.max() + 1 + pad), max(0, ys.min() - pad), min(H, ys.max() + 1 + pad)
    alpha = nd.binary_dilation(m, iterations=1)[y0:y1, x0:x1]
    alpha = cv2.GaussianBlur((alpha * 255).astype(np.uint8), (3, 3), 0)
    rgba = np.dstack([A0[y0:y1, x0:x1], alpha])
    Image.fromarray(rgba).save(f'assets/menu-g-{k}.png')
    print(k, 'bbox', x0, y0, x1, y1)
# conferencia
prev = Image.new('RGB', (1500, 300), (255, 0, 255)); x = 0
for k in 'abcde':
    s = Image.open(f'assets/menu-g-{k}.png'); prev.paste(s, (x, 0), s); x += s.width + 8
prev.save('menu_prev_tmp.png')
Image.fromarray(plate).crop((0, 100, 700, 900)).save('menu_plate_tmp.png')

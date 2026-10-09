import os as _os; _os.chdir(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '..'))   # roda a partir da raiz do projeto
"""Recorta as roupas do Genésio de assets/Construction Mascot Career Lineup.png (grade 4x2 com o nome embaixo de cada uma)
e grava assets/skins/<id>.png com fundo transparente (o fundo branco ligado à borda sai; o contorno escuro protege o desenho).
Uso:  python tools/make_skins.py        (prévia em tools/out/skins-preview.png)"""
import os
import numpy as np, cv2
from PIL import Image
from scipy import ndimage as nd

SHEETS = [   # (arquivo, nomes por linha, faixas verticais de cada linha acima das etiquetas)
    ('assets/Construction Mascot Career Lineup.png', [['pedreiro', 'engenheiro', 'mestre', 'eletricista'], ['encanador', 'pintor', 'seguranca', 'operador']], [(0, 446), (528, 974)]),
    ('assets/Oito Mascotes, Oito Skins.png', [[None, 'explorador', 'construtor', 'ninja'], ['astronauta', 'dourado', 'cacto', 'neon']], [(0, 462), (530, 990)]),
]
os.makedirs('assets/skins', exist_ok=True)
out = []
for SRC, IDS, ROWS in SHEETS:
  A = np.array(Image.open(SRC).convert('RGB')); H, W = A.shape[:2]
  cw = W // 4
  for r, ids in enumerate(IDS):
    y0, y1 = ROWS[r]
    for c, sid in enumerate(ids):
        if sid is None: continue                                  # 'Padrão' = o Clássico, que já existe
        x0, x1 = c * cw, (c + 1) * cw
        reg = A[y0:y1, x0:x1]; ri = reg.astype(int); rmn, rmx = ri.min(axis=2), ri.max(axis=2)
        bgish = (rmn > 200) & (rmx - rmn < 30)                     # branco/creme do fundo
        lb, _ = nd.label(bgish)
        edge = np.unique(np.concatenate([lb[0], lb[-1], lb[:, 0], lb[:, -1]])); edge = edge[edge > 0]
        bg = np.isin(lb, edge)
        for _ in range(2):                                         # tira o halo claro da borda
            ring = nd.binary_dilation(bg) & ~bg
            bg |= ring & (rmn > 170) & (rmx - rmn < 40)
        fg = ~bg
        lf, nf = nd.label(fg, np.ones((3, 3)))
        sz = nd.sum(fg, lf, range(1, nf + 1))
        big = 1 + int(np.argmax(sz)); objs = nd.find_objects(lf)
        bs = objs[big - 1]; bx0, bx1 = bs[1].start - 40, bs[1].stop + 40
        ok = [j + 1 for j, o in enumerate(objs) if sz[j] > 120 and o[1].start > 2 and o[1].stop < reg.shape[1] - 2 and o[1].start >= bx0 and o[1].stop <= bx1]
        keep = np.isin(lf, ok + [big])                           # o personagem e o que está junto dele (sem pedaços da célula vizinha)
        ys, xs = np.where(keep)
        crop = np.dstack([reg, (keep * 255).astype(np.uint8)])[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        im = Image.fromarray(crop, 'RGBA')
        k = 260 / max(im.size); im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
        im.save(f'assets/skins/{sid}.png', optimize=True); out.append(im)
        print(sid, im.size)

os.makedirs('tools/out', exist_ok=True)
prev = Image.new('RGBA', (270 * len(out), 270), (40, 110, 70, 255))
for i, im in enumerate(out): prev.alpha_composite(im, (i * 270 + (270 - im.width) // 2, 270 - im.height))
prev.save('tools/out/skins-preview.png')

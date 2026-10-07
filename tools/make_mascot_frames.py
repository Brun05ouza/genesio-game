import os as _os; _os.chdir(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '..'))   # roda a partir da raiz do projeto
"""Recorta assets/Green Mascot Animation Sprite Sheet.png e gera os quadros do Genésio em frames/:
  idle0 (parado), walk0-12 (andando), run0-12 (correndo), jump0-4 (pulando: agacha, sobe, sobe, topo, aterrissa),
  hurt0-3 (caindo e levantando, usado quando ele leva dano) e cheer0-1 (comemorando).
Cada quadro fica com os pés na base da imagem e o corpo centralizado, na mesma escala visual dos quadros antigos
(o jogo usa SCALE por animação; aqui cada animação recebe o tamanho que mantém o Genésio do mesmo tamanho na tela).
Uso:  python tools/make_mascot_frames.py      (grava também tools/out/mascot-contact.png para conferência)"""
import os
import numpy as np, cv2
from PIL import Image

SRC = 'assets/Green Mascot Animation Sprite Sheet.png'
sheet = Image.open(SRC).convert('RGBA')
A = np.array(sheet)
alpha = A[..., 3]

# faixas de cada linha do sheet (acima dos números "01, 02..." e incluindo os pés)
ROWS = {'idle': (8, 194), 'walk': (214, 390), 'run': (414, 580), 'extra': (592, 760)}
X0 = 160                                            # à esquerda ficam os rótulos (PARADO, ANDANDO...)

def frames_in_row(y0, y1):
    """caixas (x0, y0, x1, y1) dos personagens de uma linha, da esquerda para a direita"""
    solid = (alpha[y0:y1, X0:] >= 235).astype(np.uint8)          # corpo opaco (a sombra no chão é semitransparente)
    solid = cv2.morphologyEx(solid, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(solid, connectivity=8)
    boxes = [(st[i, 0] + X0, st[i, 1] + y0, st[i, 0] + st[i, 2] + X0, st[i, 1] + st[i, 3] + y0) for i in range(1, n) if st[i, 4] > 2500]
    # junta pedaços do mesmo personagem (mão/pé solto do corpo) e separa dois personagens colados pela sombra
    boxes.sort()
    merged = []
    for b in boxes:
        if merged and b[0] < merged[-1][2] - 25:
            m = merged[-1]; merged[-1] = (min(m[0], b[0]), min(m[1], b[1]), max(m[2], b[2]), max(m[3], b[3]))
        else: merged.append(b)
    return merged

def cut(box):
    x0, y0, x1, y1 = box
    pad = 3
    crop = A[y0 - pad:y1 + pad, x0 - pad:x1 + pad].copy()
    a = crop[..., 3]
    keep = cv2.dilate((a >= 235).astype(np.uint8), np.ones((5, 5), np.uint8)) > 0   # contorno antisserrilhado fica, sombra do chão sai
    crop[..., 3] = np.where(keep, a, 0)
    im = Image.fromarray(crop)
    bb = im.getbbox()
    im = im.crop(bb)
    a = np.array(im)[..., 3] > 200
    ys, xs = np.where(a)
    top = ys.min(); h = ys.max() - top + 1
    body = a[: top + int(h * 0.6)]                   # o losango (cabeça/corpo) define o centro: as pernas balançam
    cx = np.where(body)[1].mean()
    return im, cx, h

rows = {k: [cut(b) for b in frames_in_row(*v)] for k, v in ROWS.items()}
for k, v in rows.items(): print(k, len(v), 'quadros', [f[0].size for f in v][:3], '...')
extra = rows['extra']
assert len(rows['idle']) >= 8 and len(rows['walk']) >= 12 and len(rows['run']) >= 12 and len(extra) >= 12, 'sheet com menos quadros que o esperado'

stand_h = float(np.median([f[2] for f in rows['idle']]))   # altura do Genésio em pé, em pixels do sheet
# tamanho relativo de cada animação no jogo (SCALE do código, relativo ao andar) e a altura em pé dos quadros antigos de andar
REL = {'idle': 0.78, 'walk': 1.0, 'run': 1.05, 'jump': 1.35, 'hurt': 1.4, 'cheer': 1.0}
OLD_WALK_STAND = 150.0

def save(name, frames):
    k = OLD_WALK_STAND / (stand_h * REL[name])
    ims = []
    for im, cx, h in frames:
        w2, h2 = max(1, round(im.width * k)), max(1, round(im.height * k))
        ims.append((im.resize((w2, h2), Image.LANCZOS), cx * k))
    left = max(cx for _, cx in ims); right = max(im.width - cx for im, cx in ims)
    W = int(np.ceil(left + right)) + 4; H = max(im.height for im, _ in ims) + 2
    W += W % 2
    for i, (im, cx) in enumerate(ims):
        c = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        c.paste(im, (int(round(W / 2 - cx)), H - im.height), im)        # corpo no meio, pés na base
        c.save(f'frames/{name}{i}.png', optimize=True)
    print(name, len(ims), (W, H))
    return [c for c in ims]

save('idle', rows['idle'][:1])                       # parado: um quadro só (sem animação)
save('walk', rows['walk'])
save('run', rows['run'])
J = extra[0:4]                                       # pulando 01-04
save('jump', [J[0], J[1], J[2], J[3], J[0]])         # agacha, impulso, sobe, topo, aterrissa (mesma ordem dos quadros antigos)
F, L = extra[4:7], extra[7:10]                       # caindo 01-03, levantando 01-03
save('hurt', [F[0], F[2], L[1], L[2]])               # leva dano: cai e se levanta
save('cheer', extra[10:12])                          # comemorando

# folha de conferência
os.makedirs('tools/out', exist_ok=True)
names = [('idle', 1), ('walk', len(rows['walk'])), ('run', len(rows['run'])), ('jump', 5), ('hurt', 4), ('cheer', 2)]
rowsimg = []
for n, c in names:
    fr = [Image.open(f'frames/{n}{i}.png') for i in range(c)]
    W = sum(f.width for f in fr) + 6 * c; H = max(f.height for f in fr)
    r = Image.new('RGBA', (W, H + 6), (120, 160, 120, 255))
    x = 0
    for f in fr: r.alpha_composite(f, (x, H - f.height)); x += f.width + 6
    rowsimg.append(r)
sheet_out = Image.new('RGBA', (max(r.width for r in rowsimg), sum(r.height for r in rowsimg)), (120, 160, 120, 255))
y = 0
for r in rowsimg: sheet_out.alpha_composite(r, (0, y)); y += r.height
sheet_out.save('tools/out/mascot-contact.png')

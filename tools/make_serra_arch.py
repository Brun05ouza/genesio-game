import os as _os; _os.chdir(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '..'))   # roda a partir da raiz do projeto
"""Recorta o arco de Teresópolis (telhado, pilares e poste central) do mapa e grava fase-teresopolis/teresopolis-arco.png.
O jogo desenha essa camada POR CIMA do Genésio: quando ele passa pela rua de trás ou pelas pistas de baixo do arco,
some atrás do telhado/pilares (fica claro que ele está atrás do arco, não em cima dele).
Uso:  python tools/make_serra_arch.py          (prévia em tools/out/arco-preview.png)"""
import os
import numpy as np, cv2
from PIL import Image

BOX = (556, 800, 846, 972)                   # região do arco no mapa (x0, y0, x1, y1)
img = np.array(Image.open('fase-teresopolis/teresopolis-mapa.png').convert('RGB'))
x0, y0, x1, y1 = BOX
reg = img[y0:y1, x0:x1]
hsv = cv2.cvtColor(reg, cv2.COLOR_RGB2HSV)
hue, sat, val = hsv[..., 0].astype(int), hsv[..., 1].astype(int), hsv[..., 2].astype(int)
H, W = reg.shape[:2]
yy, xx = np.mgrid[0:H, 0:W] + np.array([y0, x0])[:, None, None]

roof = np.zeros((H, W), np.uint8)                                                    # telhado + viga (trapézio)
cv2.fillPoly(roof, [np.array([(566, 893), (566, 878), (607, 834), (793, 834), (831, 878), (831, 893)]) - np.array([x0, y0])], 1)
roof = roof.astype(bool)
# pilares de pedra (com o poste de madeira ao lado) e o poste central com a placa "TERESÓPOLIS"
rects = [(570, 880, 618, 962), (782, 880, 821, 962), (666, 818, 725, 962)]
pil = np.zeros((H, W), bool)
for a, b, c, d in rects: pil |= (xx >= a) & (xx < c) & (yy >= b) & (yy < d)
mask = (roof | pil).astype(np.uint8)
# só o maior pedaço ligado (sem respingos de asfalto/escuro soltos) e sem buracos
n, lab, st, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
keep = np.zeros_like(mask)
for i in range(1, n):
    if st[i, cv2.CC_STAT_AREA] > 400: keep[lab == i] = 1
cnts, _ = cv2.findContours(keep, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
cv2.drawContours(keep, cnts, -1, 1, -1)
alpha = cv2.GaussianBlur((keep * 255).astype(np.uint8), (3, 3), 0)
out = np.dstack([reg, alpha])
Image.fromarray(out, 'RGBA').save('fase-teresopolis/teresopolis-arco.png', optimize=True)
os.makedirs('tools/out', exist_ok=True)
prev = Image.new('RGBA', (W, H), (255, 0, 255, 255)); prev.alpha_composite(Image.fromarray(out, 'RGBA'))
prev.resize((W * 3, H * 3), Image.NEAREST).save('tools/out/arco-preview.png')
print('arco', (W, H), 'em', (x0, y0))

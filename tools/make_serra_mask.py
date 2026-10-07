"""Gera fase-teresopolis/teresopolis-colisao.png: onde o Genésio pode pisar no mapa de Teresópolis (branco = livre, preto = bloqueado).
Uso:  python make_serra_mask.py      (também grava uma prévia em fase-teresopolis/teresopolis-colisao-preview.png)

 1. Piso = pixels pouco saturados (asfalto, calçada, praça, estacionamento). Árvores, grama, canteiros, telhado laranja do arco... ficam bloqueados.
 2. Prédios, piscina e pilares do arco são cinza/bege (parecem piso): são bloqueados à mão (BLOCKS).
 3. Encolhe ~4 px e fica só a área ligada ao ponto de partida (as pontas de estrada que saem do mapa ficam fora)."""
import os
import numpy as np, cv2
from PIL import Image
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))

rgb = np.array(Image.open('fase-teresopolis/teresopolis-mapa.png').convert('RGB'))
H, W = rgb.shape[:2]
hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
hue, sat = hsv[..., 0].astype(int), hsv[..., 1].astype(int)
floor = ((sat < 118) & ~((hue > 26) & (hue < 100) & (sat > 45))).astype(np.uint8) * 255      # calçadas bege (saturação ~30%) também valem
floor = cv2.morphologyEx(floor, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
floor = cv2.morphologyEx(floor, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
nh, lh, sh, _ = cv2.connectedComponentsWithStats((floor == 0).astype(np.uint8), connectivity=4)      # fecha buraquinhos (faixas e setas pintadas no asfalto)
for i in range(1, nh):
    if sh[i, cv2.CC_STAT_AREA] < 900: floor[lh == i] = 255

BLOCKS = [                                    # (x0, y0, x1, y1)
    (415, 15, 1040, 298),                     # par de prédios de cima
    (860, 288, 1348, 612),                    # prédios da direita
    (1000, 590, 1440, 812),                   # casa de apoio, deck e piscina
    (575, 884, 626, 965), (662, 884, 724, 965), (786, 884, 836, 965),    # bases dos pilares do arco (a rua horizontal passa por trás do telhado)
    (0, 0, 44, H), (1300, 0, W, H),           # bordas do mapa (estradas que saem dele)
]
POLYS = [                                     # prédio da esquerda (isométrico) e o estacionamento embaixo dele
    [(95, 405), (140, 355), (300, 350), (535, 478), (535, 692), (425, 730), (95, 552)],
]
blocked = np.zeros((H, W), np.uint8)
for x0, y0, x1, y1 in BLOCKS: blocked[y0:y1, x0:x1] = 255
for poly in POLYS: cv2.fillPoly(blocked, [np.array(poly, np.int32)], 255)
floor[blocked > 0] = 0
floor = cv2.erode(floor, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
for x0, y0, x1, y1 in [(540, 806, 860, 884), (836, 806, 975, 872), (630, 880, 658, 965), (728, 880, 782, 965)]: floor[y0:y1, x0:x1] = 255      # rua por trás do telhado do arco e as duas pistas por baixo dele (o telhado é laranja e sairia bloqueado)

START = (690, 760)
n, lab = cv2.connectedComponents((floor > 0).astype(np.uint8), connectivity=4)
assert floor[START[1], START[0]] > 0, 'ponto de partida bloqueado'
floor = ((lab == lab[START[1], START[0]]).astype(np.uint8)) * 255
Image.fromarray(floor).save('fase-teresopolis/teresopolis-colisao.png', optimize=True)
prev = rgb.copy(); prev[floor == 0] = (prev[floor == 0] * 0.45 + np.array([255, 0, 0]) * 0.55).astype(np.uint8)
Image.fromarray(prev).save('fase-teresopolis/teresopolis-colisao-preview.png')
print('livre: %.1f%%' % (floor.mean() / 2.55))

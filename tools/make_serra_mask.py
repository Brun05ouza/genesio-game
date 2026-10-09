"""Gera fase-teresopolis/teresopolis-colisao.png: onde o Genésio pode pisar no mapa de Teresópolis (branco = livre, preto = bloqueado).
Uso:  python make_serra_mask.py      (também grava uma prévia em fase-teresopolis/teresopolis-colisao-preview.png)

 1. Piso = pixels pouco saturados (asfalto, calçada, praça, estacionamento). Árvores, grama, canteiros, telhado laranja do arco... ficam bloqueados.
 2. Prédios, piscina e pilares do arco são cinza/bege (parecem piso): são bloqueados à mão (BLOCKS).
 3. Regulariza ruas/calçadas conhecidas: sombras e copas não viram paredes sobre o asfalto.
 4. Encolhe ~4 px e fica só a área ligada ao ponto de partida (as pontas de estrada que saem do mapa ficam fora)."""
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

# Piso contínuo nas rotas das três placas. O recorte por cor sozinho criava dentes,
# becos e obstáculos por causa de sombras, bancos e faixas pintadas no asfalto.
ROADS = [
    [(632, 492), (746, 492), (746, 789), (790, 833), (604, 833), (632, 789)],
    [(49, 585), (140, 640), (280, 713), (430, 780), (548, 808), (632, 811), (652, 835), (605, 864), (457, 864), (305, 813), (165, 745), (49, 663)],
    [(737, 809), (876, 809), (930, 780), (979, 809), (1080, 860), (1265, 818), (1296, 825), (1284, 885), (985, 945), (913, 914), (844, 882), (737, 882)],
]
for poly in ROADS: cv2.fillPoly(floor, [np.array(poly, np.int32)], 255)
cv2.ellipse(floor, (690, 441), (151, 96), 0, 0, 360, 255, -1)

BLOCKS = [                                    # (x0, y0, x1, y1)
    (415, 15, 1040, 298),                     # par de prédios de cima
    (860, 288, 1348, 612),                    # prédios da direita
    (1000, 590, 1440, 812),                   # casa de apoio, deck e piscina
    (575, 884, 626, 965), (662, 884, 724, 965), (786, 884, 836, 965),    # bases dos pilares do arco (a rua horizontal passa por trás do telhado)
    (0, 0, 44, H), (1300, 0, W, H),           # bordas do mapa (estradas que saem dele)
]
POLYS = [                                     # prédio da esquerda (isométrico) e o estacionamento embaixo dele
    [(95, 405), (140, 355), (300, 350), (535, 478), (535, 692), (425, 730), (95, 552)],
    [(625, 402), (668, 384), (739, 392), (758, 433), (739, 469), (659, 478), (623, 454)], # jardim central da rotatória
]
blocked = np.zeros((H, W), np.uint8)
for x0, y0, x1, y1 in BLOCKS: blocked[y0:y1, x0:x1] = 255
for poly in POLYS: cv2.fillPoly(blocked, [np.array(poly, np.int32)], 255)
# Bases de árvores e mobiliário continuam sólidas, com contornos arredondados.
for x, y, rx, ry in [(609, 416, 13, 17), (792, 421, 14, 18), (613, 548, 17, 20), (757, 559, 17, 20), (610, 734, 19, 23), (772, 756, 19, 23), (889, 895, 27, 23)]:
    cv2.ellipse(blocked, (x, y), (rx, ry), 0, 0, 360, 255, -1)
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

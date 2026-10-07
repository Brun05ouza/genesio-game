"""Gera map/lobby-mask.png: a máscara de colisão do lobby (branco = pode pisar, preto = obstáculo).
Uso:  python make_lobby_mask.py          (gera a máscara e uma prévia map/lobby-mask-preview.png)

Como é feita:
 1. Piso = pixels do mapa com pouca saturação (pedra bege/cinza e asfalto). Grama, árvores, flores, bancos, postes e água ficam bloqueados.
 2. Paredes, pilares e a fonte também são bege (parecem piso), então são bloqueados à mão (BLOCKS / fonte abaixo).
 3. Encolhe 5 px (os pés do Genésio não encostam nas bordas) e abre os corredores do portal de Teresópolis (CARVE).
 4. Mantém só a área ligada ao ponto de partida (sem "ilhas" soltas)."""
import os
import numpy as np, cv2
from PIL import Image
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))

rgb = np.array(Image.open('map/new-map.png').convert('RGB'))
H, W = rgb.shape[:2]
hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
hue, sat = hsv[..., 0].astype(int), hsv[..., 1].astype(int)
floor = ((sat < 70) & ~((hue > 35) & (hue < 90) & (sat > 40))).astype(np.uint8) * 255
floor = cv2.morphologyEx(floor, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
floor = cv2.morphologyEx(floor, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))

# retângulos (x0, y0, x1, y1) de paredes e pilares de pedra
BLOCKS = [
    # noroeste
    (248, 156, 281, 202), (262, 200, 283, 272), (330, 172, 483, 200), (482, 112, 514, 222), (202, 265, 237, 403), (163, 468, 197, 503), (290, 245, 333, 286),
    # nordeste
    (740, 112, 775, 222), (773, 172, 978, 200), (972, 155, 1009, 273), (922, 232, 963, 283), (1018, 265, 1055, 403), (1057, 468, 1093, 503),
    # sudoeste
    (0, 618, 196, 683), (162, 607, 194, 682), (202, 693, 237, 963), (228, 918, 490, 1022), (482, 930, 517, 997), (503, 995, 539, 1046),
    # sudeste
    (1058, 618, 1254, 683), (1019, 693, 1055, 926), (990, 920, 1025, 969), (740, 918, 1025, 1022), (741, 930, 773, 997), (717, 995, 753, 1046),
]
blocked = np.zeros((H, W), np.uint8)
for x0, y0, x1, y1 in BLOCKS: blocked[y0:y1, x0:x1] = 255

# postes de luz: acha o poste azul-marinho (cor bem saturada e escura) e bloqueia só a base dele (a lâmpada fica no alto, sem fechar a calçada)
val = hsv[..., 2].astype(int)
pole = ((sat > 90) & (val < 120) & (hue > 100) & (hue < 135)).astype(np.uint8)
pole = cv2.morphologyEx(pole, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
n_p, lab_p, stats_p, _ = cv2.connectedComponentsWithStats(pole, connectivity=8)
lamps = 0
for i in range(1, n_p):
    x, y, w, h, area = stats_p[i]
    if h >= 40 and w <= 30 and area > 150:                      # poste comprido e fino
        blocked[y + h - 26:y + h + 4, max(0, x - 6):x + w + 6] = 255
        lamps += 1
print('postes encontrados:', lamps)
cv2.ellipse(blocked, (627, 535), (122, 100), 0, 0, 360, 255, -1)        # fonte
# arbustos e canteiros da praça (dentro dos muros) não têm física: dá para andar por cima deles.
# Continuam sólidos: fonte, bancos, postes, as duas árvores grandes de baixo e os muros/pilares.
PLAZA = (280, 205, 975, 945)
BENCHES = [(483, 315, 566, 368), (690, 315, 773, 368), (402, 397, 444, 468), (811, 397, 854, 468),
           (402, 619, 444, 693), (811, 619, 854, 693), (480, 735, 563, 780), (690, 735, 773, 780)]
TRUNKS = [(385, 875, 422, 930), (830, 875, 867, 930)]
for x0, y0, x1, y1 in BENCHES + TRUNKS: blocked[y0:y1, x0:x1] = 255
px0, py0, px1, py1 = PLAZA
floor[py0:py1, px0:px1] = 255
floor[blocked > 0] = 0

floor = cv2.erode(floor, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11)))   # margem de 5 px

# portal de Teresópolis: os vãos laterais do portal (por onde se entra na fase) ficam livres
CARVE = [(543, 80, 581, 236), (676, 80, 712, 236)]
for x0, y0, x1, y1 in CARVE: floor[y0:y1, x0:x1] = 255

# só o que se alcança a partir do ponto de partida
START = (627, 780)
n, lab = cv2.connectedComponents((floor > 0).astype(np.uint8), connectivity=4)
assert floor[START[1], START[0]] > 0, 'ponto de partida bloqueado'
floor = ((lab == lab[START[1], START[0]]).astype(np.uint8)) * 255
Image.fromarray(floor).save('map/lobby-mask.png', optimize=True)

prev = rgb.copy()
prev[floor == 0] = (prev[floor == 0] * 0.45 + np.array([255, 0, 0]) * 0.55).astype(np.uint8)
Image.fromarray(prev).save('map/lobby-mask-preview.png')
print('walkable: %.1f%%' % (floor.mean() / 2.55))

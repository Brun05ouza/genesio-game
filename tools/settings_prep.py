import os as _os; _os.chdir(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '..'))   # roda a partir da raiz do projeto
# Prepara o fundo das Configuracoes: mascara de folhagem (R) e nuvens (G) para animar o ambiente
from PIL import Image
import numpy as np, cv2
from scipy import ndimage as nd
im = Image.open('assets/settings-original.png').convert('RGB'); A = np.array(im).astype(int)
H, W = A.shape[:2]
r, g, b = A[..., 0], A[..., 1], A[..., 2]
mx, mn = A.max(axis=2), A.min(axis=2)
fol = (g > r + 4) & (g > b + 22) & (g > 70)
fol = nd.binary_closing(nd.binary_opening(fol, iterations=1), iterations=2)
yy = np.arange(H)[:, None] * np.ones((1, W))
cloud = (mn > 140) & ((mx - mn) < 70) & (b >= r - 6) & ((b - r) < 70) & (yy < 330)      # corpo inteiro da nuvem (claro + sombras azuladas)
cloud = nd.binary_closing(nd.binary_opening(cloud, iterations=1), iterations=5)
cloud = nd.binary_fill_holes(cloud)
core = cloud & (mn > 218)
lab, n = nd.label(cloud)
cnt = nd.sum(core, lab, range(1, n + 1))
cloud = np.isin(lab, [i + 1 for i, v in enumerate(cnt) if v > 400])      # so nuvens de verdade (nao a neblina das montanhas)
cloud = nd.binary_erosion(cloud, iterations=2)
ui = np.zeros((H, W), bool)
for x0, y0, x1, y1 in [(640, 225, 1125, 315), (585, 315, 1182, 575), (785, 580, 985, 672)]:
    ui[y0:y1, x0:x1] = True            # titulo, painel e botao: parados
fol[:310, 380:] = False                    # montanhas nao balancam
fol &= ~ui; cloud &= ~ui
mk = np.zeros((H, W, 3), np.uint8)
mk[..., 0] = cv2.GaussianBlur((fol * 255).astype(np.uint8), (0, 0), 4)
mk[..., 1] = cv2.GaussianBlur((cloud * 255).astype(np.uint8), (0, 0), 6)
Image.fromarray(mk).save('assets/settings-mask.png')
im.save('assets/settings-bg.jpg', quality=92)
ov = np.array(im).copy()
ov[mk[..., 0] > 128] = (ov[mk[..., 0] > 128] * 0.5 + np.array([255, 0, 255]) * 0.5).astype(np.uint8)
ov[mk[..., 1] > 128] = (ov[mk[..., 1] > 128] * 0.5 + np.array([255, 120, 0]) * 0.5).astype(np.uint8)
Image.fromarray(ov).resize((882, 446)).save('set_prev_tmp.png')
print(W, H, fol.mean().round(3), cloud.mean().round(3))

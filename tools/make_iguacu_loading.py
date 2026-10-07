import os as _os; _os.chdir(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '..'))   # roda a partir da raiz do projeto
"""Prepara assets/iguacu-loading.jpg (carregamento de Nova Iguaçu e do Oásis Residencial) a partir da arte original:
esvazia a barra pintada e apaga o texto "Procurando o caminho...", para o jogo desenhar a barra e as dicas de verdade por cima.
Uso:  python tools/make_iguacu_loading.py <imagem original>      (prévia em tools/out/iguacu-loading-preview.png)"""
import sys, os
import numpy as np, cv2
from PIL import Image

src = sys.argv[1] if len(sys.argv) > 1 else 'assets/iguacu-loading-original.png'
im = np.array(Image.open(src).convert('RGB'))
H, W = im.shape[:2]
assert (W, H) == (1672, 941), 'esperava a arte em 1672x941'
# 1) trilha da barra: o trecho amarelo (listras) recebe a cor da parte vazia (marrom escuro), coluna a coluna
TY0, TY1 = 613, 650                                      # faixa interna da barra
hsv = cv2.cvtColor(im, cv2.COLOR_RGB2HSV)
row = im[TY0:TY1]
empty_cols = [x for x in range(900, 1130) if hsv[TY0 + 18, x, 2] < 90]
col = np.median(row[:, empty_cols], axis=1).astype(np.uint8)
yellow = (row[..., 1].astype(int) > 118) & (row[..., 0].astype(int) > 200)        # listras amarelas (a borda marrom tem G baixo)
xs = np.where(yellow.any(axis=0))[0]
xs = xs[(xs > 520) & (xs < 1150)]
x0, x1 = xs.min(), xs.max() + 1
for x in range(x0, x1):
    m = yellow[:, x] | ((row[:, x, 1].astype(int) > 70) & (row[:, x, 0].astype(int) > 150))
    im[TY0:TY1, x][m] = col[m]
# 2) apaga o texto claro abaixo da barra
mask = np.zeros((H, W), np.uint8)
reg = hsv[668:712, 600:1080]
txt = (reg[..., 2] > 200) & (reg[..., 1] < 90)
mask[668:712, 600:1080] = cv2.dilate(txt.astype(np.uint8) * 255, np.ones((7, 7), np.uint8))
im = cv2.inpaint(im, mask, 6, cv2.INPAINT_TELEA)
Image.fromarray(im).save('assets/iguacu-loading.jpg', quality=90, optimize=True)
os.makedirs('tools/out', exist_ok=True)
Image.fromarray(im).crop((480, 560, 1200, 730)).save('tools/out/iguacu-loading-preview.png')
print('ok, barra pintada de', x0, 'a', x1)

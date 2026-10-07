"""Gera fase-solar-do-bosque/sprites/nail.png: o prego do especial do Solar do Bosque (chuva de pregos).
Desenhado por código (metal cinza com contorno escuro, no mesmo estilo dos outros itens). Para usar outra arte, é só trocar o PNG (fundo transparente, ponta para baixo)."""
import os
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
SS = 4                                      # desenha 4x maior e reduz (bordas suaves)
W, H = 120 * SS, 340 * SS
im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
d = ImageDraw.Draw(im)
OUT = (21, 26, 34, 255)
cx = W // 2

def hgrad(x0, x1, y0, y1, stops):
    """retângulo com gradiente horizontal (stops = [(pos 0..1, (r,g,b))])"""
    w = x1 - x0
    row = np.zeros((1, w, 3), np.float32)
    for i in range(w):
        t = i / max(1, w - 1)
        for k in range(len(stops) - 1):
            if stops[k][0] <= t <= stops[k + 1][0]:
                u = (t - stops[k][0]) / (stops[k + 1][0] - stops[k][0]); a, b = stops[k][1], stops[k + 1][1]
                row[0, i] = [a[j] + (b[j] - a[j]) * u for j in range(3)]; break
    return Image.fromarray(np.repeat(row, y1 - y0, axis=0).astype(np.uint8), 'RGB')

METAL = [(0, (92, 99, 108)), (0.25, (176, 183, 192)), (0.5, (214, 219, 225)), (0.8, (150, 157, 166)), (1, (96, 103, 112))]
# haste
sx0, sx1 = cx - 17 * SS, cx + 17 * SS
shaft_top, shaft_bot = 62 * SS, 262 * SS
im.paste(hgrad(sx0, sx1, shaft_top, shaft_bot, METAL), (sx0, shaft_top))
# ponta (triângulo) com gradiente e contorno
tip = Image.new('RGBA', (W, H), (0, 0, 0, 0))
mask = Image.new('L', (W, H), 0); md = ImageDraw.Draw(mask)
md.polygon([(sx0, shaft_bot - 2), (sx1, shaft_bot - 2), (cx, 334 * SS)], fill=255)
tg = hgrad(sx0, sx1, shaft_bot - 2, 334 * SS, [(0, (88, 95, 104)), (0.5, (196, 202, 210)), (1, (92, 99, 108))])
tip.paste(tg, (sx0, shaft_bot - 2)); im.paste(tip, (0, 0), mask)
d.line([(cx, shaft_bot + 8 * SS), (cx, 330 * SS)], fill=(235, 238, 242, 200), width=2 * SS)           # brilho no meio da ponta
# contorno da haste + ponta
d.line([(sx0, shaft_top), (sx0, shaft_bot), (cx, 334 * SS), (sx1, shaft_bot), (sx1, shaft_top)], fill=OUT, width=int(3.2 * SS), joint='curve')
# riscos de uso
for (a, b, c, e) in [(0.2, 120, 0.7, 150), (0.55, 195, 0.12, 218)]:
    d.line([(sx0 + (sx1 - sx0) * a, shaft_top + b * SS - 60 * SS), (sx0 + (sx1 - sx0) * c, shaft_top + e * SS - 60 * SS)], fill=(236, 239, 243, 150), width=SS)
# pescoço
d.polygon([(cx - 21 * SS, 44 * SS), (cx + 21 * SS, 44 * SS), (sx1 + 1 * SS, shaft_top), (sx0 - 1 * SS, shaft_top)], fill=(150, 157, 166, 255), outline=OUT)
# cabeça (elipse achatada)
hx0, hx1, hy0, hy1 = cx - 56 * SS, cx + 56 * SS, 10 * SS, 54 * SS
d.ellipse([hx0, hy0 + 8 * SS, hx1, hy1], fill=(120, 127, 137, 255), outline=OUT, width=int(3.2 * SS))          # lateral de baixo
d.ellipse([hx0, hy0, hx1, hy1 - 12 * SS], fill=(190, 196, 204, 255), outline=OUT, width=int(3.2 * SS))          # topo
d.ellipse([hx0 + 12 * SS, hy0 + 5 * SS, hx1 - 12 * SS, hy1 - 20 * SS], fill=(222, 227, 233, 255))                 # brilho
d.line([(cx - 28 * SS, hy0 + 14 * SS), (cx + 6 * SS, hy0 + 9 * SS)], fill=(120, 127, 137, 190), width=SS)            # risco na cabeça
im = im.resize((W // SS, H // SS), Image.LANCZOS)
os.makedirs('fase-solar-do-bosque/sprites', exist_ok=True)
im.save('fase-solar-do-bosque/sprites/nail.png', optimize=True)
bg = Image.new('RGBA', im.size, (90, 130, 90, 255)); bg.alpha_composite(im); bg.save('fase-solar-do-bosque/sprites/nail-preview.png')
print(im.size)

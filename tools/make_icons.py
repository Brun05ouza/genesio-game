import os as _os; _os.chdir(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '..'))   # roda a partir da raiz do projeto
# Gera os ícones do app (instalação na tela inicial) a partir do mascote
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
mascot = Image.open('assets/menu-g-b.png').convert('RGBA')
bb = mascot.getbbox(); mascot = mascot.crop(bb)

def icon(size, pad, rounded):
    # fundo: degradê verde-escuro -> verde, com brilho de sol no canto
    y = np.linspace(0, 1, size)[:, None]; x = np.linspace(0, 1, size)[None, :]
    base = np.zeros((size, size, 3), float)
    top, bot = np.array([42, 160, 110]), np.array([8, 52, 34])
    base[:] = (top * (1 - y)[..., None] + bot * y[..., None])
    glow = np.clip(1 - np.hypot(x - .85, y - .12) * 2.2, 0, 1)[..., None] ** 2
    base = np.clip(base + glow * np.array([255, 235, 150]) * .5, 0, 255)
    bg = Image.fromarray(base.astype(np.uint8)).convert('RGBA')
    m = mascot.copy(); box = size * (1 - 2 * pad)
    k = min(box / m.width, box / m.height); m = m.resize((max(1, int(m.width * k)), max(1, int(m.height * k))), Image.LANCZOS)
    sh = Image.new('RGBA', bg.size, (0, 0, 0, 0)); sh.paste((0, 0, 0, 120), ((size - m.width) // 2 + size // 60, (size - m.height) // 2 + size // 40), m.split()[3])
    bg.alpha_composite(sh.filter(ImageFilter.GaussianBlur(size / 60)))
    bg.alpha_composite(m, ((size - m.width) // 2, (size - m.height) // 2))
    if rounded:
        mask = Image.new('L', bg.size, 0); ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * .22), fill=255)
        out = Image.new('RGBA', bg.size, (0, 0, 0, 0)); out.paste(bg, mask=mask); return out
    return bg
icon(192, .12, True).save('icons/icon-192.png')
icon(512, .12, True).save('icons/icon-512.png')
icon(512, .22, False).save('icons/maskable-512.png')          # o sistema recorta em círculo/quadrado: mascote fica na zona segura
icon(180, .12, False).save('icons/apple-touch-icon.png')        # iOS aplica os cantos arredondados sozinho
icon(64, .08, True).save('icons/favicon-64.png')
icon(48, .08, True).save('icons/favicon-48.png')
icon(256, .1, True).save('favicon.ico', sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
print('ok')

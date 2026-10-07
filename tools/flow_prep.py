import os as _os; _os.chdir(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '..'))   # roda a partir da raiz do projeto
# Fase Flow: separa os pilares (obstaculos) do fundo e prepara a nave sem o foguinho
from PIL import Image, ImageDraw
import numpy as np, glob, json, cv2
from scipy import ndimage as nd
D = 'fase-flow'; O = D + '/out'
import os; os.makedirs(O, exist_ok=True)
files = sorted(glob.glob(D + '/ChatGPT*.png'))
data = {}
for k, f in enumerate(files):
    im = Image.open(f).convert('RGB'); A = np.array(im).astype(int); H, W = A.shape[:2]
    r, g, b = A[..., 0], A[..., 1], A[..., 2]
    lum = (r + g + b) / 3
    mask = ((r > 38) & (r >= b * .78) & (lum > 42)) | ((r > 150) & (g > 110))      # corpo cinza-bronze e luz alaranjada dos pilares
    mask = nd.binary_closing(mask, structure=np.ones((5, 5)))
    mask = nd.binary_opening(mask, iterations=2)
    lab, n = nd.label(mask)
    pillars = []
    for i, sl in enumerate(nd.find_objects(lab), 1):
        h = sl[0].stop - sl[0].start; w = sl[1].stop - sl[1].start
        area = (lab[sl] == i).sum()
        if w < 40 or h < 60 or area < 3000: continue
        x0, x1, y0, y1 = sl[1].start, sl[1].stop, sl[0].start, sl[0].stop
        top = y0 <= 2; bot = y1 >= H - 2
        if not (top or bot): continue
        pillars.append(dict(x0=int(x0), x1=int(x1), y0=int(y0), y1=int(y1), top=bool(top), edge=bool(x0 <= 2 or x1 >= W - 2), id=i))
    data[k] = dict(W=W, H=H, pillars=pillars)
    ov = im.copy(); d = ImageDraw.Draw(ov)
    for p in pillars:
        d.rectangle([p['x0'], p['y0'], p['x1'], p['y1']], outline=(0, 255, 0) if not p['edge'] else (255, 0, 0), width=4)
    ov.save(f'{O}/ov{k}.png')
    print(k, [(p['x0'], p['x1'], p['y0'], p['y1'], 'T' if p['top'] else 'B', 'EDGE' if p['edge'] else '') for p in pillars])
json.dump(data, open(O + '/pillars.json', 'w'))
sh = Image.new('RGB', (836 * 2, 470 * 3))
for k in range(5): sh.paste(Image.open(f'{O}/ov{k}.png').resize((836, 470)), ((k % 2) * 836, (k // 2) * 470))
sh.save('flow_ov_tmp.png')

# ---------- fundo limpo + sprites dos pilares ----------
meta = {'segments': []}
for k, f in enumerate(files):
    im = Image.open(f).convert('RGB'); A = np.array(im); Ai = A.astype(int); H, W = A.shape[:2]
    r, g, b = Ai[..., 0], Ai[..., 1], Ai[..., 2]; lum = (r + g + b) / 3
    mask = ((r > 38) & (r >= b * .78) & (lum > 42)) | ((r > 150) & (g > 110))
    mask = nd.binary_closing(mask, structure=np.ones((5, 5))); mask = nd.binary_opening(mask, iterations=2)
    lab, n = nd.label(mask)
    allm = np.zeros((H, W), bool); segp = []
    for p in data[k]['pillars']:
        allm[max(0, p['y0'] - 2):min(H, p['y1'] + 2), max(0, p['x0'] - 2):min(W, p['x1'] + 2)] = True       # o pilar inteiro e um retangulo
        if p['edge']: continue
        pad = 8; x0, x1, y0, y1 = max(0, p['x0'] - pad), min(W, p['x1'] + pad), max(0, p['y0'] - pad), min(H, p['y1'] + pad)
        rect = np.zeros((H, W), np.uint8); rect[p['y0']:p['y1'], p['x0']:p['x1']] = 255
        al = cv2.GaussianBlur(rect, (5, 5), 0)
        rgba = np.dstack([A, al])[y0:y1, x0:x1]
        name = f'p{k}_{len(segp)}.png'; Image.fromarray(rgba).save(f'{O}/{name}')
        segp.append(dict(file=name, x0=p['x0'], x1=p['x1'], y0=p['y0'], y1=p['y1'], top=p['top'], sx=x0, sy=y0))
    big = nd.binary_dilation(allm, iterations=16)
    clean = cv2.inpaint(A, (big * 255).astype(np.uint8), 6, cv2.INPAINT_TELEA)
    soft = cv2.GaussianBlur((nd.binary_dilation(big, iterations=10) * 255).astype(np.uint8), (0, 0), 14).astype(float)[..., None] / 255
    blur = cv2.GaussianBlur(clean, (0, 0), 38).astype(float)
    clean = (clean * (1 - soft) + blur * soft * .92).astype(np.uint8)
    Image.fromarray(clean).save(f'{O}/bg{k}.jpg', quality=90)
    meta['segments'].append(dict(bg=f'bg{k}.jpg', W=W, H=H, pillars=segp))
json.dump(meta, open(O + '/flow_meta.json', 'w'))
open('flow-data.js', 'w', encoding='utf-8').write('// gerado por flow_prep.py\nconst FLOW_DATA = ' + json.dumps(meta) + ';\n')
sh = Image.new('RGB', (836 * 2, 470 * 2))
for k in range(4): sh.paste(Image.open(f'{O}/bg{k}.jpg').resize((836, 470)), ((k % 2) * 836, (k // 2) * 470))
sh.save('flow_bg_tmp.png'); print('ok', [len(s['pillars']) for s in meta['segments']])

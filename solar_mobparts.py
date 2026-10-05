# Separa os mobs da fase Solar do Bosque em partes animaveis (cada parte e uma imagem do tamanho do sprite inteiro)
from PIL import Image
import numpy as np, json
from scipy import ndimage as nd
D = 'fase-solar-do-bosque/sprites'
meta = {}

def save(arr, mask, name):
    out = arr.copy(); out[..., 3] = np.where(mask, arr[..., 3], 0).astype(np.uint8)
    Image.fromarray(out).save(f'{D}/{name}.png')

# ---------- voador ----------
A = np.array(Image.open(f'{D}/fly.png').convert('RGBA')); H, W = A.shape[:2]
al = A[..., 3] > 20; r, g, b = [A[..., i].astype(int) for i in range(3)]
white = al & (A[..., :3].min(axis=2) > 165) & ((A[..., :3].max(axis=2) - A[..., :3].min(axis=2)) < 45)
yy, xx = np.mgrid[0:H, 0:W]
def wing(side):
    box = (xx < 70) & (yy < 62) if side == 'L' else (xx > 130) & (yy < 62)
    core = nd.binary_dilation(white & box, iterations=1)
    core = nd.binary_closing(core, iterations=2)
    lab, n = nd.label(core | (white & box)); 
    # outline escuro colado na asa
    ring = nd.binary_dilation(core, iterations=2) & al & box & ~white
    # tira o cubo cinza/amarelo do "ombro" (hub): escuro no canto inferior interno da caixa
    hub_c = (52, 58) if side == 'L' else (148, 58)
    hub = (xx - hub_c[0]) ** 2 + (yy - hub_c[1]) ** 2 < 17 ** 2
    m = (core | ring) & ~hub
    lab, n = nd.label(m); sz = nd.sum(m, lab, range(1, n + 1))
    keep = np.isin(lab, [i + 1 for i, s in enumerate(sz) if s > 8])
    return keep
wl, wr = wing('L'), wing('R')
claw_l = al & (yy > 114) & (xx < 100); claw_r = al & (yy > 114) & (xx >= 100)
body = al & ~wl & ~wr & ~claw_l & ~claw_r
for nm, m in [('fly_body', body), ('fly_wingL', wl), ('fly_wingR', wr), ('fly_clawL', claw_l), ('fly_clawR', claw_r)]: save(A, m, nm)
meta['fly'] = dict(w=W, h=H, pivots=dict(wingL=[50, 50], wingR=[150, 50], clawL=[72, 114], clawR=[132, 118]))

# ---------- golem de tijolo ----------
A = np.array(Image.open(f'{D}/rock.png').convert('RGBA')); H, W = A.shape[:2]
al = A[..., 3] > 20; yy, xx = np.mgrid[0:H, 0:W]
# pecas se sobrepoem ao tronco (desenhadas ATRAS dele), o tronco guarda a silhueta inteira
leg_l = al & (yy >= 138) & (xx < 100); leg_r = al & (yy >= 138) & (xx >= 100)
arm_l = al & (yy >= 84) & (yy < 148) & (xx < 60); arm_r = al & (yy >= 84) & (yy < 148) & (xx > 156)
body = al & ~((yy >= 150)) & ~((yy >= 84) & (yy < 150) & ((xx < 43) | (xx > 177)))
for nm, m in [('rock_body', body), ('rock_armL', arm_l), ('rock_armR', arm_r), ('rock_legL', leg_l), ('rock_legR', leg_r)]: save(A, m, nm)
meta['rock'] = dict(w=W, h=H, pivots=dict(armL=[56, 104], armR=[160, 104], legL=[52, 148], legR=[146, 148]))
json.dump(meta, open('solar-mobparts.json', 'w'))
print(meta)

# ---------- conferencia: montagem em varias poses ----------
def comp(parts, W, H, pose):
    out = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    for name, (ang, dx, dy) in pose:   # ordem de desenho
        im = Image.open(f'{D}/{name}.png')
        piv = None
        for k, v in meta[parts]['pivots'].items():
            if name.endswith(k): piv = v
        if piv and ang:
            im = im.rotate(-ang, center=tuple(piv), resample=Image.BICUBIC)
        out.alpha_composite(im, (int(dx), int(dy)))
    return out
sh = Image.new('RGBA', (200 * 5, 160 + 191), (110, 170, 110, 255))
poses_fly = [[('fly_wingL', (-30, 0, 0)), ('fly_wingR', (30, 0, 0)), ('fly_body', (0, 0, 0)), ('fly_clawL', (0, 0, 0)), ('fly_clawR', (0, 0, 0))],
             [('fly_wingL', (0, 0, 0)), ('fly_wingR', (0, 0, 0)), ('fly_body', (0, 0, 0)), ('fly_clawL', (0, 0, 0)), ('fly_clawR', (0, 0, 0))],
             [('fly_wingL', (35, 0, 0)), ('fly_wingR', (-35, 0, 0)), ('fly_body', (0, 0, 0)), ('fly_clawL', (-25, 0, 0)), ('fly_clawR', (25, 0, 0))]]
for i, p in enumerate(poses_fly): sh.alpha_composite(comp('fly', 200, 156, p), (i * 200, 0))
poses_rock = [[('rock_legL', (-10, 0, -8)), ('rock_legR', (10, 0, 0)), ('rock_armL', (12, 0, 0)), ('rock_armR', (-12, 0, 0)), ('rock_body', (0, 0, 0))],
              [('rock_legL', (0, 0, 0)), ('rock_legR', (0, 0, 0)), ('rock_armL', (0, 0, 0)), ('rock_armR', (0, 0, 0)), ('rock_body', (0, 0, 0))]]
for i, p in enumerate(poses_rock): sh.alpha_composite(comp('rock', 200, 191, p), (i * 200, 160))
sh = sh.resize((sh.width * 2 // 1, sh.height * 2 // 1), Image.NEAREST); sh.save('parts_prev_tmp.png')

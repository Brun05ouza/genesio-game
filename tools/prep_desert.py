import os as _os; _os.chdir(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '..'))   # roda a partir da raiz do projeto
# Separa o cenÃ¡rio do deserto em duas camadas (fundo limpo + chÃ£o) e recorta os cactos como obstÃ¡culos
import glob
D=glob.glob('fase-nova-igua*')[0]
from PIL import Image
import numpy as np, cv2
from scipy import ndimage as nd
src=Image.open(D+'/Sunlit Desert Platformer Landscape.png').convert('RGB')
A=np.array(src); H,W=A.shape[:2]
GY=716  # topo do chÃ£o
# --- obstÃ¡culos (cactos verdes recortados) ---
r,g,b=[A[...,i].astype(int) for i in range(3)]
green=(g>=r+3)&(g>b+30)
boxes={'cactus_big':(40,550,160,722)}
for name,(x0,y0,x1,y1) in boxes.items():
    m=green[y0:y1,x0:x1]
    m=nd.binary_dilation(m,iterations=3)
    lab,n=nd.label(m); sz=nd.sum(m,lab,range(1,n+1)); m=np.isin(lab,[i+1 for i,v in enumerate(sz) if v>60])
    m=nd.binary_fill_holes(m)
    c=np.dstack([A[y0:y1,x0:x1],(m*255).astype(np.uint8)])
    ys,xs=np.where(m); Image.fromarray(c[ys.min():ys.max()+1,xs.min():xs.max()+1]).save(f'{D}/oasis/{name}.png')
# --- fundo sem props ---
GY=724
bg=A[:GY].copy()
# faixa baixa das dunas: cada linha recebe a mediana de colunas limpas; o início da faixa varia por coluna (suavizado)
ref=np.median(A[:GY, 790:990].astype(float),axis=1)
Y0=np.full(A.shape[1],648.0)
Y0[:262]=598; Y0[20:180]=545; Y0[620:800]=630; Y0[262:470]=636; Y0[1000:1300]=668; Y0[1360:]=632
Y0=np.convolve(np.pad(Y0,40,mode='edge'),np.ones(81)/81,mode='valid')
for x in range(1500):
    y0=int(Y0[x])
    for y in range(y0,GY):
        t=min(1,(y-y0)/16)
        bg[y,x]=(bg[y,x]*(1-t)+ref[y]*t).astype(np.uint8)
# tira o sol da imagem (ele é desenhado à parte, fixo no céu, para não aparecer duplicado ao espelhar)
cx,cy,R=1298,181,125
yy,xx=np.mgrid[0:GY,0:A.shape[1]]
d=np.hypot(xx-cx,yy-cy)
skyref=np.median(A[:GY,1090:1140].astype(float),axis=1)   # cor do céu por linha
w=np.clip((R+25-d)/25,0,1)[...,None]*(d<R+25)[...,None]
bg=(bg*(1-w)+skyref[:,None,:]*w).astype(np.uint8)
bg=bg[:, :1500]
Image.fromarray(bg).save(D+'/oasis/bg.png')
Image.fromarray(A[GY:, :1500]).save(D+'/oasis/ground.png')
print(bg.shape)

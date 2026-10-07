import os as _os; _os.chdir(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '..'))   # roda a partir da raiz do projeto
import math, heapq
from tower_data import *
from PIL import Image, ImageDraw
import glob as G
files=['fase-teresopolis/Colorful Jungle Platformer Adventure.png']+sorted(G.glob('fase-teresopolis/ChatGPT*.png'))
for k,f in enumerate(files):
    im=Image.open(f).convert('RGB'); d=ImageDraw.Draw(im)
    for i,p in enumerate(MAPS[k]):
        d.line([(p[0],p[2]),(p[1],p[2])],fill=(255,0,255),width=4); d.text((p[0]+3,p[2]-14),str(i),fill=(255,255,0))
    im.save(f'ov{k}_tmp.png')
print('world', WORLD_H, TOPS)
# alcance: salto com apice ~175 e corrida 370 px/s
G_=1800; V=810; SPD=370
def reach(a,b):          # de a ate b (b mais alto => dy>0)
    dy=a[2]-b[2]
    if dy>172: return False
    disc=V*V-2*G_*dy
    if disc<0: return False
    t=(V+math.sqrt(disc))/G_
    rng=SPD*t
    gap=max(0,max(a[0],b[0])-min(a[1],b[1]))*1.0   # distancia horizontal entre os intervalos (0 se sobrepoem)
    if a[0]<=b[1] and b[0]<=a[1]: gap=0
    else: gap=(b[0]-a[1]) if b[0]>a[1] else (a[0]-b[1])
    if dy<0:   # descendo: cai e anda
        t=(-V*0+math.sqrt(2*abs(dy)/G_))  # queda livre sem pulo
        t=max(t,(V+math.sqrt(V*V+2*G_*abs(dy)))/G_) if gap>SPD*math.sqrt(2*abs(dy)/G_) else t
        rng=SPD*max(t,(V+math.sqrt(V*V+2*G_*abs(dy)))/G_)
    return gap<=rng-10
n=len(ALL); adj=[[j for j in range(n) if j!=i and reach(ALL[i],ALL[j])] for i in range(n)]
start=max(range(n),key=lambda i:ALL[i][2]*(ALL[i][1]-ALL[i][0]) )   # chao mais baixo e largo
start=[i for i in range(n) if ALL[i][2]==max(p[2] for p in ALL)][0]
seen={start}; q=[start]
while q:
    a=q.pop()
    for b in adj[a]:
        if b not in seen: seen.add(b); q.append(b)
top=min(range(n),key=lambda i:ALL[i][2])
print('inicio',ALL[start],'topo',ALL[top],'topo alcancavel',top in seen)
un=[(i,ALL[i]) for i in range(n) if i not in seen]
print('inalcancaveis',len(un)); 
for i,p in un: 
    k=[kk for kk in range(5) if sum(len(MAPS[x]) for x in range(kk))<=i][-1]
    print(' M%d idx %d'%(k,i-sum(len(MAPS[x]) for x in range(k))),p)
# plataforma mais alta alcancavel
hi=min(seen,key=lambda i:ALL[i][2]); print('mais alta alcancavel',ALL[hi])

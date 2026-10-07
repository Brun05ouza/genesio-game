import os as _os; _os.chdir(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '..'))   # roda a partir da raiz do projeto
from PIL import Image
import numpy as np
from scipy import ndimage as nd
im=Image.open('assets/frame-walk.png').convert('RGBA'); A=np.array(im)
r,g,b=[A[...,i].astype(int) for i in range(3)]
lum=(r+g+b)//3
fill=((g>150)&(g>r+30))|(lum>200)
fill=nd.binary_closing(fill,iterations=2)
W,H=im.size; cw,ch=W//4,H//2
res=[]
for row in range(2):
    for col in range(4):
        x0,y0=col*cw,row*ch
        gg=g[y0:y0+ch,x0:x0+cw]; rr=r[y0:y0+ch,x0:x0+cw]
        bgc=(gg>=20)&(gg<135)&(rr<gg)
        lab,n=nd.label(bgc)
        edge=set(np.unique(np.concatenate([lab[0],lab[-1],lab[:,0],lab[:,-1]])))-{0}
        outside=np.isin(lab,list(edge))
        keep=~outside
        keep=nd.binary_opening(keep,iterations=1)
        lab2,n2=nd.label(keep); s2=nd.sum(keep,lab2,range(1,n2+1))
        keep=lab2==1+int(np.argmax(s2))
        c=A[y0:y0+ch,x0:x0+cw].copy(); c[...,3]=(keep*255).astype(np.uint8)
        ys,xs=np.where(keep)
        res.append(Image.fromarray(c[ys.min():ys.max()+1,xs.min():xs.max()+1]))
sc=155/max(i.size[1] for i in res)
sizes=[(round(i.size[0]*sc),round(i.size[1]*sc)) for i in res]
CW=max(s[0] for s in sizes); CH=max(s[1] for s in sizes)
sheet=Image.new('RGBA',(CW*8,CH),(255,0,255,255))
for k,(i,s) in enumerate(zip(res,sizes)):
    t=i.resize(s,Image.LANCZOS)
    cell=Image.new('RGBA',(CW,CH),(0,0,0,0)); cell.paste(t,((CW-s[0])//2,CH-s[1]),t)
    cell.save(f'frames/walk{k}.png'); sheet.paste(cell,(k*CW,0),cell)
print(CW,CH); sheet.save('contact_tmp.png')

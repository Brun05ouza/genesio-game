import os as _os; _os.chdir(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '..'))   # roda a partir da raiz do projeto
from PIL import Image
import numpy as np, os
src=Image.open('assets/dimensions.png').convert('RGBA')
A=np.array(src)
def trim(box,solo=False):
    x0,y0,x1,y1=box
    c=A[y0:y1,x0:x1].copy()
    r,g,b,a=[c[...,i].astype(int) for i in range(4)]
    green=(a>60)&(g>r+25)&(g>b+10)
    dark=(a>60)&(r<60)&(g<70)&(b<70)
    # keep only green area plus nearby outline
    from scipy import ndimage as nd
    keep=nd.binary_dilation(green,iterations=3)&(a>20)
    lab,n=nd.label(nd.binary_dilation(green,iterations=5))
    if n==0: return None
    sizes=nd.sum(green,lab,range(1,n+1))
    main=lab==(1+int(np.argmax(sizes)))
    # include other big pieces (arms etc) within 10px
    for i,s in enumerate(sizes):
        if s>150 and not solo: main|=lab==(i+1)
    keep&=nd.binary_dilation(main,iterations=4)
    keep=nd.binary_fill_holes(nd.binary_closing(keep,iterations=3))&(a>20)|nd.binary_fill_holes(keep)&(a>0)
    keep=nd.binary_fill_holes(keep)
    c[~keep]=0
    ys,xs=np.where(keep)
    return Image.fromarray(c[ys.min():ys.max()+1,xs.min():xs.max()+1])
def slots(x0,x1,cuts,y0,y1):
    e=[x0]+cuts+[x1]
    return [(e[i],y0,e[i+1],y1) for i in range(len(e)-1)]
anims={
 'idle':[(20,25,190,250)],
 'walkR':slots(15,585,[148,285,425],295,470),
 'walkL':slots(590,1180,[735,875,1020],295,470),
 'run':slots(1180,1765,[1352,1500,1635],304,470),
 'hurt':slots(15,600,[155,282,410],730,885),
 'die':slots(605,1265,[765,898,1056],735,885),
 'jump':[(524,525,610,690),(603,545,690,660),(676,525,800,640),(778,556,868,668),(842,604,922,686)],
}
out={}
for k,bs in anims.items():
    for i,b in enumerate(bs):
        im=trim(b,k in ('jump','hurt','die')); out[(k,i)]=im
        print(k,i,im.size)
# normalize: common cell, feet at bottom, centered
H=max(im.size[1] for im in out.values()); W=max(im.size[0] for im in out.values())
print(W,H)
for (k,i),im in out.items():
    # scale so idle height fits: keep native scale
    cell=Image.new('RGBA',(W,H),(0,0,0,0))
    cell.paste(im,((W-im.size[0])//2,H-im.size[1]),im)
    cell.save(f'frames/{k}{i}.png')
# contact sheet
names=sorted(out); sh=Image.new('RGBA',(W*len(names),H),(200,200,200,255))
for j,n in enumerate(names):
    f=Image.open(f'frames/{n[0]}{n[1]}.png'); sh.paste(f,(j*W,0),f)
sh.save(os.environ.get('TEMP','.')+'/contact.png'); sh.save('contact_tmp.png')

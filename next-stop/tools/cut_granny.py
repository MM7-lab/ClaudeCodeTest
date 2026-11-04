# Crop the granny's step-3 detail panels (1d) and expression portraits (1e) from Tommy's sheets.
# usage: python3 cut_granny.py <1d detail sheet .jpg> <1e expressions sheet .jpg> <out dir>
# Both sheets are 2752×1536; boxes are in 2000-px display coordinates and scaled up.
import sys,os
from PIL import Image
det=Image.open(sys.argv[1]).convert('RGB');exp=Image.open(sys.argv[2]).convert('RGB');out=sys.argv[3];os.makedirs(out,exist_ok=True)
s=det.size[0]/2000
def crop(im,box):return im.crop(tuple(int(v*s) for v in box))
PANELS={'bags':(40,140,720,1030),'knees':(715,0,1330,1030),'trolley':(1355,150,1955,960)}
for k,b in PANELS.items():
  c=crop(det,b);c=c.resize((520,round(c.size[1]*520/c.size[0])),Image.LANCZOS);c.save(f'{out}/panel_{k}.webp',quality=82,method=6);print('panel',k,c.size)
FACES={'tired':(150,60,590,560),'worried':(995,60,1435,560),'surprised':(555,475,995,975),'smile':(1405,475,1845,975)}
for k,b in FACES.items():
  c=crop(exp,b).resize((200,round(200*(b[3]-b[1])/(b[2]-b[0]))),Image.LANCZOS);c.save(f'{out}/face_{k}.webp',quality=85,method=6);print('face',k,c.size)

# ---- full-body cards: walk (1b) and sit (1c), optional args 4 and 5 ----
# The sit sheet is split into the granny herself and her trolley + bags, so the drawn trolley doesn't cut through the next seat.
if len(sys.argv)>5:
  import numpy as np
  from scipy import ndimage
  def cut(path,drop,minpocket=300):
    a=np.asarray(Image.open(path).convert('RGB')).astype(np.int16)
    mx=a.max(2);mn=a.min(2);bg=((mx-mn)<16)&(mx>=205)&(mx<=236)
    lab,n=ndimage.label(bg)
    border=set(np.unique(np.concatenate([lab[0],lab[-1],lab[:,0],lab[:,-1]])))-{0}
    remove=np.isin(lab,list(border))
    for i in drop: remove|=lab==i
    alpha=~remove
    l2,n2=ndimage.label(alpha);sz=ndimage.sum(alpha,l2,range(1,n2+1));alpha=l2==(1+int(np.argmax(sz)))
    alpha=ndimage.binary_erosion(alpha,iterations=2)
    return np.asarray(Image.open(path).convert('RGB')).copy(),alpha
  def save(rgb,alpha,name,keep=None):
    al=alpha.copy()
    if keep is not None: al&=keep
    rgb=rgb.copy();rgb[~al]=(28,24,30)
    img=Image.fromarray(np.dstack([rgb,(al*255).astype(np.uint8)]),'RGBA');bb=img.getbbox();img=img.crop(bb)
    sc=min(1,1000/img.size[1]);img=img.resize((round(img.size[0]*sc),round(img.size[1]*sc)),Image.LANCZOS)
    img.save(f'{out}/{name}.webp',quality=86,method=6);print(name,img.size,'bbox',bb);return bb
  # pocket ids are the label numbers printed by the pocket listing (gaps in the trolley handle, bag handles, wheels)
  rgb,al=cut(sys.argv[4],[193,194,195,206,309,313]);save(rgb,al,'walk')
  rgb,al=cut(sys.argv[5],[148,214,215,216,358,399])
  H,W=al.shape;yy,xx=np.mgrid[0:H,0:W];props=((xx<1176)&(yy>880))|((yy>1075)&(xx<1425))
  save(rgb,al,'sit',~props);save(rgb,al,'sitprops',props)

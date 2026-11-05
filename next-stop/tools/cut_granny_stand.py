# Cut the granny's standing / bag-free drawings (896×1200, plain grey background) into transparent WebP cards.
# usage: python3 cut_granny_stand.py <walk without bags .jpg> <standing with bags .jpg> <standing, bags on trolley .jpg> <out dir>
# DROP lists the enclosed background pockets to clear (arm-to-body gaps, trolley handle and frame, bag-handle gaps);
# the ids come from a connected-component listing of each image, as in cut_cards.py. Bag interiors are kept.
import sys,os
import numpy as np
from PIL import Image
from scipy import ndimage
out=sys.argv[4];os.makedirs(out,exist_ok=True)
JOBS=[('walkfree',sys.argv[1],[29,31,33,36]),('stand',sys.argv[2],[30,32,33,48,117,120]),('standafter',sys.argv[3],[48,49,50,119,157,161])]
for name,path,drop in JOBS:
  rgb=np.asarray(Image.open(path).convert('RGB')).copy();a=rgb.astype(np.int16)
  mx=a.max(2);mn=a.min(2);bg=((mx-mn)<16)&(mx>=205)&(mx<=240)
  lab,n=ndimage.label(bg)
  border=set(np.unique(np.concatenate([lab[0],lab[-1],lab[:,0],lab[:,-1]])))-{0}
  remove=np.isin(lab,list(border|set(drop)))
  alpha=~remove
  l2,n2=ndimage.label(alpha);sz=ndimage.sum(alpha,l2,range(1,n2+1));alpha=l2==(1+int(np.argmax(sz)))
  alpha=ndimage.binary_erosion(alpha,iterations=2)
  rgb[~alpha]=(28,24,30)
  img=Image.fromarray(np.dstack([rgb,(alpha*255).astype(np.uint8)]),'RGBA');bb=img.getbbox();img=img.crop(bb)
  img.save(f'{out}/{name}.webp',quality=86,method=6);print(name,img.size,'bbox',bb)

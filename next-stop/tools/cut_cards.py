# Cut the six coloured figures (A–F) out of Tommy's character sheets into transparent WebP cards.
# usage: python3 cut_cards.py <sheet A–C .jpg> <sheet D–F .jpg> <out dir>
# Needs numpy, pillow, scipy. Crop boxes match the two sheets as sent (1376×768 and 2752×1536).
# The paste-in step (base64 into CARDS in next-stop.html) is done by hand.
import sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage
AC=Image.open(sys.argv[1]).convert('RGB'); DF=Image.open(sys.argv[2]).convert('RGB')
s=2752/2000
# (sheet, box in display coords for D–F (scaled) / native for A–C)
JOBS={
 'xA':(AC,(36,128,306,742),1),
 'xB':(AC,(548,80,766,750),1),
 'xC':(AC,(938,84,1172,740),1),
 'xD':(DF,(86,100,462,1080),s),
 'xE':(DF,(806,236,1190,1066),s),
 'xF':(DF,(1376,140,1706,1070),s),
}
out=sys.argv[3]
import os; os.makedirs(out,exist_ok=True)
# enclosed paper-grey pockets to remove (gaps inside bag handles etc.); everything else light is kept (shirts, stripes, screens)
KEEP=set();DROP={('xA',110),('xB',95),('xD',187),('xD',199),('xF',123)}
for k,(im,box,sc) in JOBS.items():
  b=tuple(int(v*sc) for v in box);c=im.crop(b);a=np.asarray(c).astype(np.int16)
  mx=a.max(2);mn=a.min(2);sat=mx-mn
  bg=(sat<20)&(mx>=196)&(mx<=240)            # paper grey + grid lines
  # background reachable from the border
  lab,n=ndimage.label(bg)
  border=set(np.unique(np.concatenate([lab[0],lab[-1],lab[:,0],lab[:,-1]])))-{0}
  remove=np.isin(lab,list(border))
  # enclosed paper-grey pockets (gaps between arm and body) bigger than ~200 px
  sizes=ndimage.sum(np.ones_like(lab),lab,range(n+1))
  big=[i for i in range(1,n+1) if sizes[i]>200*(sc*sc) and i not in border]
  # only drop an enclosed pocket if it is nearly flat paper grey (not a white shirt): check its mean value
  for i in big:
    m=lab==i;v=a[m].mean(0);sd=a[m].std();ys,xs=np.nonzero(m)
    if KEEP and (k,i) in KEEP: continue
    if DROP and (k,i) in DROP: remove|=m
  alpha=~remove
  # keep only the largest opaque component (drops labels, swatches, sketch fragments)
  l2,n2=ndimage.label(alpha);
  if n2>1:
    sz=ndimage.sum(alpha,l2,range(1,n2+1));keep=1+int(np.argmax(sz));alpha=l2==keep
  # erode 1–2 px into the outline to kill JPEG halos
  er=2 if sc>1 else 1
  alpha=ndimage.binary_erosion(alpha,iterations=er)
  rgb=np.asarray(c).copy()
  rgb[~alpha]=(28,24,30)                      # dark fill so mip filtering pulls outline colour, not grey
  img=Image.fromarray(np.dstack([rgb,(alpha*255).astype(np.uint8)]),'RGBA')
  bb=img.getbbox();img=img.crop(bb)
  if img.size[1]>1000: img=img.resize((round(img.size[0]*1000/img.size[1]),1000),Image.LANCZOS)
  img.save(f'{out}/{k}.png');img.save(f'{out}/{k}.webp',quality=88,method=6)
  print(k,img.size)

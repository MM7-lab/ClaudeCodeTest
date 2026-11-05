# Cut one character drawing (plain grey background) into a transparent WebP card.
# usage: python3 cut_single.py <drawing .jpg> <out .webp> [pocket ids to clear, comma-separated | auto]
# 'auto' clears every enclosed pocket whose colour matches the background within 7 levels (keeps white shirts, bags, screens).
# Pocket ids are enclosed background patches (e.g. gaps between arm and body) from a connected-component listing.
import sys
import numpy as np
from PIL import Image
from scipy import ndimage
arg=sys.argv[3] if len(sys.argv)>3 else ''
drop=set(int(x) for x in arg.split(',')) if arg and arg!='auto' else set()
rgb=np.asarray(Image.open(sys.argv[1]).convert('RGB')).copy();a=rgb.astype(np.int16)
mx=a.max(2);mn=a.min(2);bg=((mx-mn)<16)&(mx>=205)&(mx<=240)
lab,n=ndimage.label(bg)
border=set(np.unique(np.concatenate([lab[0],lab[-1],lab[:,0],lab[:,-1]])))-{0}
if arg=='auto':
  bgc=a[np.isin(lab,list(border))].mean(0);sizes=ndimage.sum(np.ones_like(lab),lab,range(n+1))
  for i in range(1,n+1):
    if i in border or sizes[i]<120: continue
    m=lab==i
    if np.abs(a[m].mean(0)-bgc).max()<7: drop.add(i)
  print('auto-dropped',len(drop),'pockets')
alpha=~np.isin(lab,list(border|drop))
l2,n2=ndimage.label(alpha);sz=ndimage.sum(alpha,l2,range(1,n2+1));alpha=l2==(1+int(np.argmax(sz)))
alpha=ndimage.binary_erosion(alpha,iterations=2)
rgb[~alpha]=(28,24,30)
img=Image.fromarray(np.dstack([rgb,(alpha*255).astype(np.uint8)]),'RGBA');img=img.crop(img.getbbox())
img.save(sys.argv[2],quality=86,method=6);print(sys.argv[2],img.size)

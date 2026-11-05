# Cut one character drawing (plain grey background) into a transparent WebP card.
# usage: python3 cut_single.py <drawing .jpg> <out .webp> [pocket ids to clear, comma-separated]
# Pocket ids are enclosed background patches (e.g. gaps between arm and body) from a connected-component listing.
import sys
import numpy as np
from PIL import Image
from scipy import ndimage
drop=set(int(x) for x in sys.argv[3].split(',')) if len(sys.argv)>3 and sys.argv[3] else set()
rgb=np.asarray(Image.open(sys.argv[1]).convert('RGB')).copy();a=rgb.astype(np.int16)
mx=a.max(2);mn=a.min(2);bg=((mx-mn)<16)&(mx>=205)&(mx<=240)
lab,n=ndimage.label(bg)
border=set(np.unique(np.concatenate([lab[0],lab[-1],lab[:,0],lab[:,-1]])))-{0}
alpha=~np.isin(lab,list(border|drop))
l2,n2=ndimage.label(alpha);sz=ndimage.sum(alpha,l2,range(1,n2+1));alpha=l2==(1+int(np.argmax(sz)))
alpha=ndimage.binary_erosion(alpha,iterations=2)
rgb[~alpha]=(28,24,30)
img=Image.fromarray(np.dstack([rgb,(alpha*255).astype(np.uint8)]),'RGBA');img=img.crop(img.getbbox())
img.save(sys.argv[2],quality=86,method=6);print(sys.argv[2],img.size)

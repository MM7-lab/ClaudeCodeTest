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

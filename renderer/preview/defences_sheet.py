import os as _os
_ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))
ART = _os.environ.get('TERRAFALL_ART', _os.path.join(_ROOT, 'art'))   # shipped art in the game's layout: art/<group>/, art/tod/<time>/<group>/, art/tiles/ground.png
PREV = _os.path.join(_ROOT, 'out', 'preview', ''); _os.makedirs(PREV, exist_ok=True)
def tod_dir(tod, group): return f'{ART}/{group}/' if tod == 'day' else f'{ART}/tod/{tod}/{group}/'
# usage: python3 prev.py out.png name [name...]  -> sprites on sand, with 50px versions and the outpost for scale
import sys
from PIL import Image
D = sys.argv[2]   # usage: defences_sheet.py <out.jpg> <rawdir> <name> ...
out=sys.argv[1]; names=sys.argv[3:]
ims=[Image.open(ART + '/buildings/outpost@0.png').convert('RGBA').resize((512,512))]+[Image.open(f'{D}/{n}.png').convert('RGBA') for n in names]
W=len(ims)*532+20
bg=Image.new('RGBA',(W,512+90),(166,117,74,255))
for i,im in enumerate(ims):
    bg.alpha_composite(im,(20+i*532,0))
    s=im.resize((50,50),Image.LANCZOS); bg.alpha_composite(s,(20+i*532+231,530))
bg.save(out)

"""Writes the Airship (b/airship.js, v=c: the armoured blimp) and the Mooring Mast (b/mast.js, v=c: the armoured
pylon) into the game's art folder as WebP, from the composed renders tools/render_airship.sh makes. Run from renderer/:
    python3 tools/install_airship.py [<game>/art]

  bots/airship@T.webp           the ship, straight down, facing right (512, 30 world units across: drawn 3 tiles wide)
  buildings/mast@T.webp         the Mast, the buildings' 57-degree view (512, B3D scale 1.4, its mooring cup at [0.5, 0.08])
  tod/<time>/...                 the same, re-lit for morning, evening and night
  bots/airship-shadow.webp      its ground shadow: the day render's silhouette, softened (black, the shape in the alpha)
"""
import os
import sys
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, '..', 'art')
OUT = os.path.join(ROOT, 'out', 'airship')
written = []


def save(im, rel, q=84):
    p = os.path.join(ART, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    im.save(p, 'WEBP', quality=q, method=6)
    written.append((rel, os.path.getsize(p)))


for tod in ('day', 'morning', 'evening', 'night'):
    pre = '' if tod == 'day' else f'tod/{tod}/'
    for t in (0, 1):
        save(Image.open(f'{OUT}/{tod}/airship@{t}.png').convert('RGBA'), f'{pre}bots/airship@{t}.webp')
        save(Image.open(f'{OUT}/{tod}/mast@{t}.png').convert('RGBA'), f'{pre}buildings/mast@{t}.webp')

# The shadow: the silhouette of the day render (its alpha, glow left out), softened, at half size (the game scales it
# to the ship's frame, so a soft edge loses nothing).
a = Image.open(f'{OUT}/day/airship@0.beauty.png').getchannel('A').resize((256, 256), Image.LANCZOS).filter(ImageFilter.GaussianBlur(2.2))
sh = Image.merge('RGBA', [Image.new('L', a.size, 4), Image.new('L', a.size, 10), Image.new('L', a.size, 16), a])
save(sh, 'bots/airship-shadow.webp', 80)

for rel, n in written:
    print(f'{n:7d}  {rel}')

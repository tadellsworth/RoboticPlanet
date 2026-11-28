"""Writes the capital ships' art (space expansion, phase 3: The Void Fleet) into the game's art folder as WebP, from the
finished renders tools/render_capital.sh makes. Run from renderer/:
    python3 tools/install_capital.py [<game>/art]

  bots/flagship@T, flagship-launch@T     the Flagship (b/capital.js c=tender, the canvas's "Tender"), straight down, nose east:
                                         68 world units across (drawn FLEET_LOOK.frame.flagship tiles wide: js/fleet.js);
                                         -launch, its rails lit with a Gunship going up off one
  bots/line@T, line-fireL@T, -fireR@T    the Line Ship (c=line, the canvas's "Line"), 50 units across; -fireL/-fireR its turrets
                                         trained to port or starboard and firing (a broadside)
  tod/<time>/...                         the same, re-lit for morning, evening and night
All of it loads only on a space map, in the lazy space-art bundle (js/space.js: SPACE_ART; tools/build-single.js).
"""
import os
import sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, '..', 'art')
OUT = os.path.join(ROOT, 'out', 'capital')
written = []

SIZE = {'flagship': 768, 'line': 576}


def save(name, rel, size, q=82):
    for tod in ('day', 'morning', 'evening', 'night'):
        src = f'{OUT}/{tod}/{name}.png'
        im = Image.open(src).convert('RGBA')
        if im.size[0] != size:
            im = im.resize((size, size), Image.LANCZOS)
        p = os.path.join(ART, ('' if tod == 'day' else f'tod/{tod}/') + rel)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        im.save(p, 'WEBP', quality=q, method=6)
        written.append((('' if tod == 'day' else f'tod/{tod}/') + rel, os.path.getsize(p)))


for t in (0, 1):
    for k in ('flagship', 'flagship-launch', 'line', 'line-fireL', 'line-fireR'):
        save(f'{k}@{t}', f'bots/{k}@{t}.webp', SIZE[k.split('-')[0]])

total = 0
for rel, n in written:
    total += n
print(f'{len(written)} files, {total // 1024} KB')

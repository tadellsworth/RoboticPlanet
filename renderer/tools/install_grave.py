"""Writes The Graveyard's art (space expansion, phase 2) into the game's art folder as WebP, from the finished renders
tools/render_grave.sh makes. Run from renderer/:
    python3 tools/install_grave.py [<game>/art]

  space/grave-plate-0, -1, -2 a hulk's deck plating (b/grave.js c=plate v=0, 1, 2), 4 by 4 tiles straight down, 256 px:
                              js/grave.js tiles it over the hulks' ground when the map is baked (v=2 on the Arbiter's hulk)
  space/grave-salvage-0, -1   the towable wreckage (c=salvage), straight down, 12 world units across, 256 px
  space/grave-salvage-K-tow    the same in its tow harness, a 14-unit frame (drawn turned to its Shuttle)
  space/grave-junk            a debris lane's shard cloud (c=junk), 24 units, 256 px
  space/grave-arb, -arb@T     the Arbiter's relay (c=arb), 46 units: derelict (no team), and captured in each team's colour
  tod/<time>/space/...        the sprites again, re-lit for morning, evening and night (the eclipse)
"""
import os
import sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, '..', 'art')
OUT = os.path.join(ROOT, 'out', 'grave')
written = []


def save(name, rel, size, tods=('day', 'morning', 'evening', 'night'), q=82):
    for tod in tods:
        im = Image.open(f'{OUT}/{tod}/{name}.png').convert('RGBA')
        if im.size[0] != size:
            im = im.resize((size, size), Image.LANCZOS)
        p = os.path.join(ART, ('' if tod == 'day' else f'tod/{tod}/') + rel)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        im.save(p, 'WEBP', quality=q, method=6)
        written.append((('' if tod == 'day' else f'tod/{tod}/') + rel, os.path.getsize(p)))


for v in (0, 1, 2):
    save(f'plate-{v}', f'space/grave-plate-{v}.webp', 256, ('day',), q=80)
for v in (0, 1):
    save(f'salvage-{v}', f'space/grave-salvage-{v}.webp', 256)
    save(f'salvage-{v}-tow', f'space/grave-salvage-{v}-tow.webp', 256)
save('junk', 'space/grave-junk.webp', 256)
save('arb', 'space/grave-arb.webp', 448)
for t in (0, 1):
    save(f'arb@{t}', f'space/grave-arb@{t}.webp', 448)

total = sum(n for _, n in written)
print(f'{len(written)} files, {total // 1024} KB')

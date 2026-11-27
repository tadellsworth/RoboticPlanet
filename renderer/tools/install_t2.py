"""Writes Terraforming stage 2's art (ART_GUIDE Batch 36) into the game's art folder as WebP, from the composed renders
tools/render_t2.sh makes. Run from renderer/:
    bash tools/render_t2.sh && python3 tools/install_t2.py [<game>/art]

  buildings/<b>@<team>.webp            the Composter, Tree Nursery and Water Pump (b = composter, nursery, wpump), 512 px
  buildings/nursery-base@<team>.webp   the Nursery without its boom (under the working loop)
  buildings/<b>-work-<0..7>.webp       the working loop: the moving parts only, every team (the drum, the boom, the screw)
  tod/<morning|evening|night>/buildings/...   all of the above, re-lit for each time of day
  resources/grove-<stage>-<variant>.webp      a 1-tile grove, stages 1 saplings, 2 young, 3 mature, variants 1..4, 256 px
  resources/sprinkler.webp                    a sprinkler head, 128 px
The third and fourth teams' buildings are the rival's recoloured in the game (recolorArt), as every building's.
"""
import os
import sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, '..', 'art')
OUT = os.path.join(ROOT, 'out', 't2')
written = []


def save(src, rel, size, q=82):
    im = Image.open(src).convert('RGBA')
    if im.size != (size, size):
        im = im.resize((size, size), Image.LANCZOS)
    p = os.path.join(ART, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    im.save(p, 'WEBP', quality=q, method=6)
    written.append((rel, os.path.getsize(p)))


for tod in ('day', 'morning', 'evening', 'night'):
    pre = '' if tod == 'day' else f'tod/{tod}/'
    for b in ('composter', 'nursery', 'wpump'):
        for t in (0, 1):
            save(f'{OUT}/{tod}/{b}@{t}.png', f'{pre}buildings/{b}@{t}.webp', 512)
            if b == 'nursery':
                save(f'{OUT}/{tod}/{b}-base@{t}.png', f'{pre}buildings/{b}-base@{t}.webp', 512)
        for f in range(8):
            save(f'{OUT}/{tod}/{b}-work-{f}.png', f'{pre}buildings/{b}-work-{f}.webp', 512)
for g in (1, 2, 3):
    for v in (1, 2, 3, 4):
        save(f'{OUT}/plants/grove-{g}-{v}.png', f'resources/grove-{g}-{v}.webp', 256)
save(f'{OUT}/plants/sprinkler.png', 'resources/sprinkler.webp', 128)
total = sum(n for _, n in written)
print(f'{len(written)} files, {total // 1024} KB')

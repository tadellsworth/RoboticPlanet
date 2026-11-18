"""Writes the Maglev line's art (b/maglev.js, v=a: Accord Phase 2, with B's hazard chevrons on the pylon caps) into the
game's art folder as WebP, from the composed renders tools/render_maglev_game.sh makes. Run from renderer/:
    python3 tools/install_maglev.py [<game>/art]

  buildings/magterm@T.webp        the Terminal, the buildings' view (512, B3D scale 1.6 like the Rail Station; its dock,
                                  where the guideway meets it, at the 'head' mark: MAGLEV.head tiles up the screen)
  buildings/magpylon@T.webp       a pylon (512, B3D scale 1.4, no pad; its head MAGLEV.deck tiles over its foot)
  buildings/magpylon-cut@T.webp   the pylon shot down: a stump, the fallen column, broken deck
  bots/magpod@T.webp              a loaded pod, straight down, facing right (256, 10 world units across: one tile)
  bots/magpod-empty@T.webp        the same empty, its roof hatch shut
  tiles/magdeck@T.webp            one tile of guideway, straight down, running east (the game repeats it along a line)
  tod/<time>/...                   the same, re-lit for morning, evening and night
"""
import json
import os
import sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, '..', 'art')
OUT = os.path.join(ROOT, 'out', 'maglev-game')
written = []


def save(im, rel, q=84):
    p = os.path.join(ART, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    im.save(p, 'WEBP', quality=q, method=6)
    written.append((rel, os.path.getsize(p)))


for tod in ('day', 'morning', 'evening', 'night'):
    pre = '' if tod == 'day' else f'tod/{tod}/'
    for t in (0, 1):
        for k in ('magterm', 'magpylon', 'magpylon-cut'):
            save(Image.open(f'{OUT}/{tod}/{k}@{t}.png').convert('RGBA'), f'{pre}buildings/{k}@{t}.webp')
        for k in ('magpod', 'magpod-empty'):
            save(Image.open(f'{OUT}/{tod}/{k}@{t}.png').convert('RGBA'), f'{pre}bots/{k}@{t}.webp')
        save(Image.open(f'{OUT}/{tod}/magdeck@{t}.png').convert('RGBA'), f'{pre}tiles/magdeck@{t}.webp')

# The marks the game draws by (MAGLEV.head, MAGLEV.deck in js/defs.js): printed to check against.
for k, sc in (('magterm@0', 1.6), ('magpylon@0', 1.4)):
    g = json.load(open(f'{OUT}/day/{k}.geom.json'))
    print(f"{k}: anchor {g['anchor']} head {g['marks']['head']} -> {(g['anchor'][1] - g['marks']['head'][1]) * sc:.3f} tiles up")
for rel, n in written:
    print(f'{n:7d}  {rel}')

"""Writes the Orbital Lift's art (b/lift.js, the owner's look A, "Beacon Cable") into the game's art folder as WebP, from
the renders tools/render_lift.sh makes. Run from renderer/:
    python3 tools/install_lift.py [<game>/art]

  buildings/lift@T.webp          the anchor pad, 3 x 3, 512, framed wide like the Lance: the collar, the clamps, the
                                 cable's foot, the winches, the control house and the floodlight masts
  buildings/lift-down@T.webp     the same below 30% of its armor: scorched, holed, a mast down, a clamp housing torn open
  tod/<time>/...                 the same, re-lit for morning, evening and night (floodlights and windows on)

It prints LIFT_FRAME (art/art-manifest.js: the frame's scale in tiles and its anchor, the middle of the square) and
LIFT_MARKS (js/render.js: the cable's foot and the dock, in tiles from the square's middle on screen).
"""
import json
import os
import sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, '..', 'art')
OUT = os.path.join(ROOT, 'out', 'lift-game')
written = []


def save(im, rel, q=82):
    p = os.path.join(ART, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    im.save(p, 'WEBP', quality=q, method=6)
    written.append((rel, os.path.getsize(p)))


for tod in ('day', 'morning', 'evening', 'night'):
    pre = '' if tod == 'day' else f'tod/{tod}/'
    for t in (0, 1):
        for k in ('lift', 'lift-down'):
            save(Image.open(f'{OUT}/{tod}/{k}@{t}.png').convert('RGBA'), f'{pre}buildings/{k}@{t}.webp')

g = json.load(open(f'{OUT}/day/lift@0.geom.json'))
sc = round(1 / (g['padTop'][2][0] - g['padTop'][3][0]), 4)
print('LIFT_FRAME', json.dumps({'scale': sc, 'anchor': [round(v, 4) for v in g['anchor']]}))
print('LIFT_MARKS', json.dumps({k: [round((v[0] - g['anchor'][0]) * sc, 3), round((v[1] - g['anchor'][1]) * sc, 3)] for k, v in g['marks'].items()}))
total = sum(n for _, n in written)
print(f'{len(written)} files, {total // 1024} KB')

"""Writes the Deep Core's art (b/deepcore.js, the owner's look A, "Headframe") into the game's art folder as WebP, from
the renders tools/render_deepcore.sh makes. Run from renderer/:
    python3 tools/install_deepcore.py [<game>/art]

  buildings/deepcore@T.webp        the Deep Core, 3 x 3, 512, framed wide like the Lift: the winding tower without its
                                   wheels, the shaft collar, the winding house, the conveyor, the hoppers, the gauge
  tod/<time>/...                   the same, re-lit for morning, evening and night (floodlights, windows, the beacon)
  buildings/deepcore-work-K.webp   the two winding wheels alone, frame K of 8 through 60 degrees (one set for every team)

It prints DEEP_FRAME (art/art-manifest.js: the frame's scale in tiles and its anchor, the middle of the square) and
DEEP_MARKS (js/render.js: the shaft, the wheels, the gauge's lamps and the beacon, in tiles from the square's middle).
"""
import json
import os
import sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, '..', 'art')
OUT = os.path.join(ROOT, 'out', 'deepcore-game')
written = []


def save(im, rel, q=82):
    p = os.path.join(ART, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    im.save(p, 'WEBP', quality=q, method=6)
    written.append((rel, os.path.getsize(p)))


for tod in ('day', 'morning', 'evening', 'night'):
    pre = '' if tod == 'day' else f'tod/{tod}/'
    for t in (0, 1):
        save(Image.open(f'{OUT}/{tod}/deepcore@{t}.png').convert('RGBA'), f'{pre}buildings/deepcore@{t}.webp')
for f in range(8):
    save(Image.open(f'{OUT}/work/deepcore-work-{f}.png').convert('RGBA'), f'buildings/deepcore-work-{f}.webp', q=86)

g = json.load(open(f'{OUT}/day/deepcore@0.geom.json'))
sc = round(1 / (g['padTop'][2][0] - g['padTop'][3][0]), 4)
print('DEEP_FRAME', json.dumps({'scale': sc, 'anchor': [round(v, 4) for v in g['anchor']]}))
print('DEEP_MARKS', json.dumps({k: [round((v[0] - g['anchor'][0]) * sc, 3), round((v[1] - g['anchor'][1]) * sc, 3)] for k, v in g['marks'].items()}))
total = sum(n for _, n in written)
print(f'{len(written)} files, {total // 1024} KB')

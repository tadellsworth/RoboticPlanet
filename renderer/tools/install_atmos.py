"""Writes the Atmosphere Engine's art (b/atmos.js, the owner's look A, "Rain Tower") into the game's art folder as WebP,
from the renders tools/render_atmos.sh makes. Run from renderer/:
    python3 tools/install_atmos.py [<game>/art]

  buildings/atmos@T.webp        the Engine, 4 x 4, 512, framed wide like Arrival City: the cooling-tower shell on its
                                columns, the waist band, the throat, the intake fans, the control house
  tod/<time>/...                the same, re-lit for morning, evening and night (the band lit, the rim lamps, windows)

It prints ATMOS_FRAME (art/art-manifest.js: the frame's scale in tiles and its anchor, the middle of the square) and
ATMOS_MARKS (js/render.js: the throat, the band and the rim lamps, in tiles from the square's middle).
"""
import json
import os
import sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, '..', 'art')
OUT = os.path.join(ROOT, 'out', 'atmos-game')
written = []


def save(im, rel, q=82):
    p = os.path.join(ART, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    im.save(p, 'WEBP', quality=q, method=6)
    written.append((rel, os.path.getsize(p)))


for tod in ('day', 'morning', 'evening', 'night'):
    pre = '' if tod == 'day' else f'tod/{tod}/'
    for t in (0, 1):
        save(Image.open(f'{OUT}/{tod}/atmos@{t}.png').convert('RGBA'), f'{pre}buildings/atmos@{t}.webp')

g = json.load(open(f'{OUT}/day/atmos@0.geom.json'))
sc = round(1 / (g['padTop'][2][0] - g['padTop'][3][0]), 4)
print('ATMOS_FRAME', json.dumps({'scale': sc, 'anchor': [round(v, 4) for v in g['anchor']]}))
print('ATMOS_MARKS', json.dumps({k: [round((v[0] - g['anchor'][0]) * sc, 3), round((v[1] - g['anchor'][1]) * sc, 3)] for k, v in g['marks'].items()}))
total = sum(n for _, n in written)
print(f'{len(written)} files, {total // 1024} KB')

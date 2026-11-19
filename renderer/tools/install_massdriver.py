"""Writes the Mass Driver's and the Catcher's art (b/massdriver.js, the owner's look A "Coil Ramp") into the game's art
folder as WebP, from the composed renders tools/render_massdriver.sh makes. Run from renderer/:
    python3 tools/install_massdriver.py [<game>/art]

  buildings/mdriver-<dir>@T.webp   the Mass Driver, two tiles long, its rail pointing <dir> (e w: lying east-west; n s:
                                   north-south; the game shows the end nearer its Catcher), 512, framed wide: the scale
                                   and anchor it prints go in art/art-manifest.js (MD_FRAME)
  buildings/catcher@T.webp         the Catcher, its four magnetic arms swung up and out, 512, B3D scale 1.4
  buildings/catcher-closed@T.webp  the same, its arms swung in over the funnel as a canister lands
  tod/<time>/...                   the same, re-lit for morning, evening and night

It prints MD_ART (js/render.js): each way's breech, muzzle and coil marks, and the Catcher's cradle, in tiles from the
tile's centre on screen, for the coils lighting in sequence and the canister's flight.
"""
import json
import os
import sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, '..', 'art')
OUT = os.path.join(ROOT, 'out', 'massdriver-game')
DIRS = ['e', 'w', 'n', 's']
written = []


def save(im, rel, q=84):
    p = os.path.join(ART, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    im.save(p, 'WEBP', quality=q, method=6)
    written.append((rel, os.path.getsize(p)))


for tod in ('day', 'morning', 'evening', 'night'):
    pre = '' if tod == 'day' else f'tod/{tod}/'
    for t in (0, 1):
        for k in [f'mdriver-{d}' for d in DIRS] + ['catcher', 'catcher-closed']:
            save(Image.open(f'{OUT}/{tod}/{k}@{t}.png').convert('RGBA'), f'{pre}buildings/{k}@{t}.webp')

# The marks the game draws by (MD_ART in js/render.js).
def rel(g, p, sc): return [round((p[0] - g['anchor'][0]) * sc, 3), round((p[1] - g['anchor'][1]) * sc, 3)]
g = json.load(open(f'{OUT}/day/mdriver-e@0.geom.json'))
SC = round(1 / (g['padTop'][2][0] - g['padTop'][3][0]), 4)   # the frame in tiles: one over a tile's front edge
print('MD_FRAME', json.dumps({'scale': SC, 'anchor': [round(v, 4) for v in g['anchor']]}))
for d in DIRS:
    g = json.load(open(f'{OUT}/day/mdriver-{d}@0.geom.json')); m = g['marks']
    print(d, json.dumps({'b': rel(g, m['breech'], SC), 'm': rel(g, m['muzzle'], SC), 'c': [rel(g, m[f'c{k}'], SC) for k in range(11)]}))
g = json.load(open(f'{OUT}/day/catcher@0.geom.json'))
print('cradle', rel(g, g['marks']['cradle'], 1.4))
total = sum(n for _, n in written)
print(f'{len(written)} files, {total // 1024} KB')

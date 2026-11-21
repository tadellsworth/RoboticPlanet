"""Writes the Sundering Ray's art (b/sunder.js, the owner's look B, "Piston Battery") into the game's art folder as WebP,
from the renders tools/render_sunder.sh makes. Run from renderer/:
    python3 tools/install_sunder.py [<game>/art]

  buildings/sunder@T.webp            the pad and the block with its bore tower, its two ram bores empty, 512, framed wide
                                     like the Lance of Corvane
  buildings/sunder-site1@T.webp      going up: the footing, the shot hole drilled, the rig over it
  buildings/sunder-site2@T.webp      going up: the block cast, the tower half up in scaffolding, a crane
  buildings/sunder-ram-W-E.webp      a great ram alone (W: w or e), its head down (E 0), half up (1) or full up (2); no team
  buildings/sunder-plate-K-E.webp    ram plate K (0 the westmost) alone, seated (E 0) or raised (1); no team
  tod/<time>/...                     the same, re-lit for morning, evening and night

It prints SUNDER_FRAME (art/art-manifest.js: the frame's scale in tiles and its anchor, the middle of the square) and
SUNDER_MARKS (js/render.js: the shot hole, the tower's crown, the stacks, the ram bores and the plates, in tiles from the
square's middle on screen).
"""
import json
import os
import sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, '..', 'art')
OUT = os.path.join(ROOT, 'out', 'sunder-game')
written = []


def save(im, rel, q=82):
    p = os.path.join(ART, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    im.save(p, 'WEBP', quality=q, method=6)
    written.append((rel, os.path.getsize(p)))


names = []
for t in (0, 1):
    names += [f'sunder@{t}', f'sunder-site1@{t}', f'sunder-site2@{t}']
names += [f'sunder-ram-{w}-{e}' for w in 'we' for e in range(3)]
names += [f'sunder-plate-{k}-{e}' for k in range(6) for e in range(2)]
for tod in ('day', 'morning', 'evening', 'night'):
    pre = '' if tod == 'day' else f'tod/{tod}/'
    for n in names:
        save(Image.open(f'{OUT}/{tod}/{n}.png').convert('RGBA'), f'{pre}buildings/{n}.webp')

g = json.load(open(f'{OUT}/day/sunder@0.geom.json'))
sc = round(1 / (g['padTop'][2][0] - g['padTop'][3][0]), 4)
print('SUNDER_FRAME', json.dumps({'scale': sc, 'anchor': [round(v, 4) for v in g['anchor']]}))
print('SUNDER_MARKS', json.dumps({k: [round((v[0] - g['anchor'][0]) * sc, 3), round((v[1] - g['anchor'][1]) * sc, 3)] for k, v in g['marks'].items()}))
total = sum(n for _, n in written)
print(f'{len(written)} files, {total // 1024} KB')

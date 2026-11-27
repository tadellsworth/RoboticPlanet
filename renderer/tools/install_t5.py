"""Writes Terraforming stage 5's art (ART_GUIDE Batch 42) into the game's art folder as WebP, from the renders
tools/render_t5.sh makes. Run from renderer/:
    bash tools/render_t5.sh && python3 tools/install_t5.py [<game>/art]

  buildings/reservoir@T.webp          the Reservoir (b/reservoir.js, Dew Towers), 3 x 3, 512, framed wide like the
                                      Deep Core: the towers, cistern, spillway and control house without their moving parts
  buildings/leveller@T.webp           the Leveller (b/leveller.js, Bucket Wheel), the same: without its wheel, belts' load
  tod/<time>/buildings/...            both re-lit for morning, evening and night (floodlights, windows, the beacon)
  buildings/<k>-work-F.webp           the moving parts alone, frame F of 4 (one set for every team, graded in code)
  buildings/<k>-site1@T.webp          the footings and the crawler crane (shown to 45% built)
  buildings/<k>-site2@T.webp          rising in scaffolding (45 to 85%)

It prints each one's frame (art/art-manifest.js T5_FRAME: the frame's scale in tiles and its anchor, the middle of the
square) and its marks (in tiles from the square's middle, and as fractions of the image) for MEGA_LAMPS (js/render.js).
"""
import json
import os
import sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, '..', 'art')
OUT = os.path.join(ROOT, 'out', 't5')
written = []


def save(src, rel, q=82, size=512):
    im = Image.open(src).convert('RGBA')
    if im.size != (size, size):
        im = im.resize((size, size), Image.LANCZOS)
    p = os.path.join(ART, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    im.save(p, 'WEBP', quality=q, method=6)
    written.append((rel, os.path.getsize(p)))


for k in ('reservoir', 'leveller'):
    for tod in ('day', 'morning', 'evening', 'night'):
        pre = '' if tod == 'day' else f'tod/{tod}/'
        for t in (0, 1):
            save(f'{OUT}/{tod}/{k}@{t}.png', f'{pre}buildings/{k}@{t}.webp')
    for f in range(4):
        save(f'{OUT}/work/{k}-work-{f}.png', f'buildings/{k}-work-{f}.webp', q=86)
    for t in (0, 1):
        for s in (1, 2):
            save(f'{OUT}/work/{k}-site{s}@{t}.png', f'buildings/{k}-site{s}@{t}.webp')
    g = json.load(open(f'{OUT}/day/{k}@0.geom.json'))
    sc = round(1 / (g['padTop'][2][0] - g['padTop'][3][0]), 4)
    print(k, 'FRAME', json.dumps({'scale': sc, 'anchor': [round(v, 4) for v in g['anchor']]}))
    print(k, 'MARKS (tiles from the middle)', json.dumps({m: [round((v[0] - g['anchor'][0]) * sc, 3), round((v[1] - g['anchor'][1]) * sc, 3)] for m, v in g['marks'].items()}))
    print(k, 'MARKS (image fractions)', json.dumps({m: [round(v[0], 3), round(v[1], 3)] for m, v in g['marks'].items()}), 'padTop', json.dumps(g['padTop']))
total = sum(n for _, n in written)
print(f'{len(written)} files, {total // 1024} KB')

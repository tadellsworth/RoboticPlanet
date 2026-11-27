"""Writes the Leveller's slewed booms (ART_GUIDE Batch 42) into the game's art folder as WebP, from the renders
tools/render_t5_slew.sh makes. Run from renderer/:
    bash tools/render_t5_slew.sh && python3 tools/install_t5_slew.py [<renders> [<game>/art]]

  buildings/leveller-hH@T.webp        the Leveller with its boom slewed to heading H (1 north-north-east, 2 south-east,
                                      3 south-south-west), without its moving parts, both teams
  tod/<time>/buildings/...            re-lit for morning, evening and night
  buildings/leveller-hH-work-F.webp   the moving parts alone, frame F of 4 (one set for every team, graded in code)

It prints each heading's beacon (image fractions) for MEGA_LAMPS (js/render.js: leveller-hH).
"""
import json
import os
import sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'out', 't5slew')
ART = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, '..', 'art')
written = []


def save(src, rel, q=82, size=512):
    im = Image.open(src).convert('RGBA')
    if im.size != (size, size):
        im = im.resize((size, size), Image.LANCZOS)
    p = os.path.join(ART, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    im.save(p, 'WEBP', quality=q, method=6)
    written.append((rel, os.path.getsize(p)))


for h in (1, 2, 3):
    k = f'leveller-h{h}'
    for tod in ('day', 'morning', 'evening', 'night'):
        pre = '' if tod == 'day' else f'tod/{tod}/'
        for t in (0, 1):
            save(f'{OUT}/{tod}/{k}@{t}.png', f'{pre}buildings/{k}@{t}.webp')
    for f in range(4):
        save(f'{OUT}/work/{k}-work-{f}.png', f'buildings/{k}-work-{f}.webp', q=86)
    g = json.load(open(f'{OUT}/day/{k}@0.geom.json'))
    print(k, 'beacon', json.dumps([round(v, 3) for v in g['marks']['beacon']]), 'wheel', json.dumps([round(v, 3) for v in g['marks']['wheel']]))
total = sum(n for _, n in written)
print(f'{len(written)} files, {total // 1024} KB')

"""Writes the megastructures' art (b/lance.js and b/dome.js, the owner's look A for both) into the game's art folder as
WebP, from the composed renders tools/render_lance.sh makes. Run from renderer/:
    python3 tools/install_lance.py [<game>/art]

  buildings/lance@T.webp         the Lance of Corvane's 3 x 3 gun pit with an empty turntable, 512, framed wide
  buildings/lance-head-K.webp    its gun on the turntable turned way K of 16 (0 east, then clockwise), the same frame,
                                 no team colour (one set for every team)
  buildings/dome@T.webp          the Shield Dome's 2 x 2 emitter, 512, framed wide
  tod/<time>/...                 the same, re-lit for morning, evening and night

It prints LANCE_FRAME and DOME_FRAME (art/art-manifest.js: each frame's scale in tiles and its anchor, the middle of
the footprint) and LANCE_ART (js/render.js: for each of the 16 ways, the eight charge rings and the muzzle, in tiles
from the footprint's middle on screen), and the Dome's emitter.
"""
import json
import os
import sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, '..', 'art')
OUT = os.path.join(ROOT, 'out', 'lance-game')
written = []


def save(im, rel, q=82):
    p = os.path.join(ART, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    im.save(p, 'WEBP', quality=q, method=6)
    written.append((rel, os.path.getsize(p)))


for tod in ('day', 'morning', 'evening', 'night'):
    pre = '' if tod == 'day' else f'tod/{tod}/'
    for t in (0, 1):
        for k in ('lance', 'dome'):
            save(Image.open(f'{OUT}/{tod}/{k}@{t}.png').convert('RGBA'), f'{pre}buildings/{k}@{t}.webp')
    for k in range(16):
        save(Image.open(f'{OUT}/{tod}/lance-head-{k}.png').convert('RGBA'), f'{pre}buildings/lance-head-{k}.webp')


def frame(name):
    g = json.load(open(f'{OUT}/day/{name}.geom.json'))
    sc = round(1 / (g['padTop'][2][0] - g['padTop'][3][0]), 4)
    return g, sc


g, SC = frame('lance@0')
print('LANCE_FRAME', json.dumps({'scale': SC, 'anchor': [round(v, 4) for v in g['anchor']]}))
def rel(g, p, sc): return [round((p[0] - g['anchor'][0]) * sc, 3), round((p[1] - g['anchor'][1]) * sc, 3)]
heads = []
for k in range(16):
    h = json.load(open(f'{OUT}/day/lance-head-{k}.geom.json')); m = h['marks']
    heads.append({'r': [rel(h, m[f'r{i}'], SC) for i in range(8)], 'm': rel(h, m['muzzle'], SC), 'b': rel(h, m['breech'], SC)})
print('LANCE_ART', json.dumps(heads, separators=(',', ':')))
g, SC2 = frame('dome@0')
print('DOME_FRAME', json.dumps({'scale': SC2, 'anchor': [round(v, 4) for v in g['anchor']]}))
print('DOME_EMITTER', rel(g, g['marks']['emitter'], SC2))
total = sum(n for _, n in written)
print(f'{len(written)} files, {total // 1024} KB')

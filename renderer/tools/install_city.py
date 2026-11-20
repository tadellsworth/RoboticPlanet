"""Writes Arrival City's art (b/city.js, the owner's look A, "Terraced Arcology") into the game's art folder as WebP, from
the renders tools/render_city.sh makes. Run from renderer/:
    python3 tools/install_city.py [<game>/art]

  buildings/city@T.webp          the City, 4 x 4, 512, framed wide, its lights off (windows dark glass, lamps unlit)
  buildings/city-down@T.webp     knocked down to 0: scorched, a corner blown out, glass broken, the clock dark
  tod/<time>/...                 the same, re-lit for morning, evening and night
  buildings/city-lit-K.webp      the lights of tier K (0 the street lamps, station, tram and welcome sign; 1 the first
                                 terrace's windows and the school; 2 the second's; 3 the third's, the atrium and the
                                 Arrival clock), the glow pass bloomed, as light to add ('lighter'): its colour divided
                                 by its alpha, so colour x alpha is the light. One set for every team and time of day.

It prints CITY_FRAME (art/art-manifest.js: the frame's scale in tiles and its anchor, the middle of the square).
"""
import json
import os
import sys
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, '..', 'art')
OUT = os.path.join(ROOT, 'out', 'city-game')
written = []


def save(im, rel, q=82):
    p = os.path.join(ART, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    im.save(p, 'WEBP', quality=q, method=6)
    written.append((rel, os.path.getsize(p)))


for tod in ('day', 'morning', 'evening', 'night'):
    pre = '' if tod == 'day' else f'tod/{tod}/'
    for t in (0, 1):
        for k in ('city', 'city-down'):
            save(Image.open(f'{OUT}/{tod}/{k}@{t}.png').convert('RGBA'), f'{pre}buildings/{k}@{t}.webp')


def lights(name):
    """A tier's glow pass, bloomed (tight and wide) and halved to 512, as premultiplied light: rgb / a, a = its peak."""
    g = Image.open(f'{OUT}/lit/{name}.glow.png').convert('RGB')
    a = np.asarray(g).astype(np.float32) / 255
    b1 = np.asarray(g.filter(ImageFilter.GaussianBlur(5))).astype(np.float32) / 255
    b2 = np.asarray(g.filter(ImageFilter.GaussianBlur(16))).astype(np.float32) / 255
    L = np.clip(a * 0.9 + b1 * 0.7 + b2 * 0.55, 0, 1)
    L = L.reshape(512, 2, 512, 2, 3).mean(axis=(1, 3))
    al = L.max(axis=2, keepdims=True)
    rgb = np.where(al > 1e-4, L / np.maximum(al, 1e-4), 0)
    out = np.concatenate([rgb, al], axis=2)
    return Image.fromarray(np.clip(out * 255 + 0.5, 0, 255).astype(np.uint8), 'RGBA')


for k in range(4):
    save(lights(f'city-lit-{k}'), f'buildings/city-lit-{k}.webp', q=86)

g = json.load(open(f'{OUT}/day/city@0.geom.json'))
sc = round(1 / (g['padTop'][2][0] - g['padTop'][3][0]), 4)
print('CITY_FRAME', json.dumps({'scale': sc, 'anchor': [round(v, 4) for v in g['anchor']]}))
print('CITY_MARKS', json.dumps({k: [round((v[0] - g['anchor'][0]) * sc, 3), round((v[1] - g['anchor'][1]) * sc, 3)] for k, v in g['marks'].items()}))
total = sum(n for _, n in written)
print(f'{len(written)} files, {total // 1024} KB')

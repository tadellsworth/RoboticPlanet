"""Writes the atlas landmarks' art (b/landmark.js) into the game's art folder as WebP, from the renders
tools/render_landmarks.sh makes. Run from renderer/:
    python3 tools/install_landmarks.py [<game>/art]            install (and print LANDMARK_ART for the manifest)
    python3 tools/install_landmarks.py --sheet <out.png>        a review sheet of the day and night renders

  landmarks/<key>.webp            the day art (every key starts lm-: it loads only in a battle with a landmark)
  tod/<time>/landmarks/<key>.webp the standing pieces re-lit for morning, evening and night
  landmarks/lm-spire-glow.webp, lm-sign-glow.webp   the night glow alone (the game adds it, breathing or flickering)

Each render is bloomed from its glow pass and taken down 2x (as compose.py does, at any size).
"""
import json
import os
import sys
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'out', 'landmarks')
# key: (render name, standing: re-lit for each time of day)
PIECES = {
    'lm-hull': ('hull', True), 'lm-spire': ('spire', True), 'lm-pillar-1': ('pillar-1', True), 'lm-pillar-2': ('pillar-2', True),
    'lm-pillar-3': ('pillar-3', True), 'lm-falls': ('falls', True), 'lm-geyser': ('geyser', True), 'lm-house-1': ('house-1', True),
    'lm-house-2': ('house-2', True), 'lm-house-3': ('house-3', True), 'lm-sign': ('sign', True), 'lm-shaft': ('shaft', True),
    'lm-wreck-kestrel': ('wreck-kestrel', True), 'lm-wreck-survey': ('wreck-survey', True), 'lm-wreck-halvard': ('wreck-halvard', True),
    'lm-town': ('town', False), 'lm-town-s': ('town-s', False), 'lm-lake': ('lake', False), 'lm-crater': ('crater', False),
}
GLOWS = {'lm-spire-glow': 'spire', 'lm-sign-glow': 'sign'}


def load(p): return np.asarray(Image.open(p).convert('RGBA')).astype(np.float32) / 255


def compose(d, n, glow_only=False):
    b = load(f'{d}/{n}.beauty.png'); g = load(f'{d}/{n}.glow.png')
    a = b[..., 3:4]; prem = b[..., :3] * a
    gl = g[..., :3] * g[..., 3:4]
    gimg = Image.fromarray((gl * 255).astype(np.uint8))
    s = b.shape[0] / 1024
    b1 = np.asarray(gimg.filter(ImageFilter.GaussianBlur(7 * s))).astype(np.float32) / 255
    b2 = np.asarray(gimg.filter(ImageFilter.GaussianBlur(22 * s))).astype(np.float32) / 255
    add = 0.9 * b1 + 1.1 * b2
    if glow_only: prem, a = add, add.max(axis=2, keepdims=True)
    else:
        prem = np.clip(prem + add, 0, 1)
        a = np.clip(a + add.max(axis=2, keepdims=True) * 0.95, 0, 1)
    out = np.concatenate([np.clip(prem, 0, 1), np.clip(a, 0, 1)], axis=2)
    h, w = out.shape[0] // 2, out.shape[1] // 2
    out = out.reshape(h, 2, w, 2, 4).mean(axis=(1, 3))
    rgb = np.where(out[..., 3:4] > 1e-4, out[..., :3] / np.maximum(out[..., 3:4], 1e-4), 0)
    return Image.fromarray((np.concatenate([np.clip(rgb, 0, 1), out[..., 3:4]], axis=2) * 255 + 0.5).astype(np.uint8), 'RGBA')


def frame(n):
    g = json.load(open(f'{OUT}/day/{n}.geom.json'))
    sc = 1 / (g['padTop'][2][0] - g['padTop'][3][0])
    return {'scale': round(sc, 4), 'anchor': [round(v, 4) for v in g['anchor']]}


if len(sys.argv) > 2 and sys.argv[1] == '--sheet':
    tiles = []
    for key, (n, standing) in PIECES.items():
        for tod in (('day', 'night') if standing else ('day',)):
            if not os.path.exists(f'{OUT}/{tod}/{n}.beauty.png'): continue
            im = compose(f'{OUT}/{tod}', n); im.thumbnail((320, 320))
            bg = Image.new('RGBA', (330, 330), (150, 118, 84, 255) if tod == 'day' else (34, 38, 52, 255)); bg.alpha_composite(im, ((330 - im.width) // 2, (330 - im.height) // 2))
            tiles.append(bg)
    cols = 6; rows = (len(tiles) + cols - 1) // cols
    sheet = Image.new('RGBA', (330 * cols, 330 * rows), (20, 20, 20, 255))
    for i, t in enumerate(tiles): sheet.paste(t, ((i % cols) * 330, (i // cols) * 330))
    sheet.save(sys.argv[2]); sys.exit()

ART = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, '..', 'art')
written, frames = [], {}


def save(im, rel, q=84):
    p = os.path.join(ART, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    im.save(p, 'WEBP', quality=q, method=6)
    written.append((rel, os.path.getsize(p)))


for key, (n, standing) in PIECES.items():
    save(compose(f'{OUT}/day', n), f'landmarks/{key}.webp')
    frames[key] = frame(n)
    if standing:
        for tod in ('morning', 'evening', 'night'): save(compose(f'{OUT}/{tod}', n), f'tod/{tod}/landmarks/{key}.webp')
for key, n in GLOWS.items():
    save(compose(f'{OUT}/night', n, glow_only=True), f'landmarks/{key}.webp', q=80)
    frames[key] = frame(n)
print('LANDMARK_ART', json.dumps(frames))
total = sum(s for _, s in written)
print(f'{len(written)} files, {total // 1024} KB')

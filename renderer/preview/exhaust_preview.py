"""Exhaust preview: freight truck, fuel tanker and road train idle, pull away (heavy smoke) and cruise (light smoke),
by day and then at night."""
import os as _os
_ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))
ART = _os.environ.get('TERRAFALL_ART', _os.path.join(_ROOT, 'art'))   # shipped art in the game's layout: art/<group>/, art/tod/<time>/<group>/, art/tiles/ground.png
PREV = _os.path.join(_ROOT, 'out', 'preview', ''); _os.makedirs(PREV, exist_ok=True)
def tod_dir(tod, group): return f'{ART}/{group}/' if tod == 'day' else f'{ART}/tod/{tod}/{group}/'
import json, math, os, subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

W, H, FPS = 1280, 720, 12
TILE = 260
VS = 0.65 * TILE                                   # every vehicle canvas = 10 world units = 0.65 tiles
E = PREV + 'exhaust/'; _os.makedirs(E, exist_ok=True); TODJ = json.load(open(ART + '/tod/shared/time-of-day.json'))['times']
PTS = json.load(open(ART + '/units/exhaust-points.json'))

def L(p): return Image.open(p).convert('RGBA')
def frames(p, fw, fh, cols, n):
    s = L(p); return [s.crop(((i % cols) * fw, (i // cols) * fh, (i % cols) * fw + fw, (i // cols) * fh + fh)) for i in range(n)]
LIGHT = frames(ART + '/effects/fx-exhaust.png', 64, 64, 4, 12); HEAVY = frames(ART + '/effects/fx-exhaust-heavy.png', 64, 64, 4, 12)

def grade(im, tod):
    if tod == 'day': return im
    a = np.asarray(im).astype(np.float32) / 255; t = TODJ[tod]
    a[..., :3] = np.clip(a[..., :3] * np.array(t['grade_multiply']) + np.array(t['grade_add']), 0, 1)
    return Image.fromarray((a * 255).astype(np.uint8), 'RGBA')

LANES = [180, 360, 540]
def ground(tod):
    g = L(ART + '/tiles/ground.png').resize((4 * TILE, 4 * TILE), Image.LANCZOS)
    bg = Image.new('RGBA', (W, H))
    for y in range(0, H, 4 * TILE):
        for x in range(0, W, 4 * TILE): bg.paste(g, (x, y))
    d = ImageDraw.Draw(bg); hb, hk = 6 / 32 * TILE, 8 / 32 * TILE
    for i, y in enumerate(LANES):
        surf, kerb = ((185, 190, 197), (93, 99, 107)) if i != 1 else ((51, 54, 61), (21, 23, 27))
        d.rectangle((0, y - hk, W, y + hk), fill=kerb + (255,)); d.rectangle((0, y - hb, W, y + hb), fill=surf + (255,))
    return grade(bg, tod)

def additive(dst, src, x, y, k):
    d = np.asarray(dst).astype(np.float32); s = np.asarray(src).astype(np.float32) / 255
    h, w = s.shape[:2]; x0, y0 = max(0, x), max(0, y); x1, y1 = min(W, x + w), min(H, y + h)
    if x1 <= x0 or y1 <= y0: return dst
    ss = s[y0 - y:y1 - y, x0 - x:x1 - x]
    d[y0:y1, x0:x1, :3] = np.clip(d[y0:y1, x0:x1, :3] + ss[..., :3] * ss[..., 3:4] * 255 * k, 0, 255)
    return Image.fromarray(d.astype(np.uint8), 'RGBA')

def vehicles(tod):
    td = lambda n: tod_dir(tod, 'units') + f'{n}.png'
    rt = td
    return [
        {'name': 'truck', 'frames': [L(td(f'truck@0-f{k}')) for k in range(4)], 'size': 384, 'trailers': [], 'lane': 0, 'start': 1.0, 'x0': 150,
         'head': ART + '/tod/shared/truck-headlights.png'},
        {'name': 'tanker', 'frames': [L(td(f'tanker@0-f{k}')) for k in range(4)], 'size': 384, 'trailers': [], 'lane': 1, 'start': 1.6, 'x0': 150,
         'head': ART + '/tod/shared/truck-headlights.png'},
        {'name': 'roadtrain', 'frames': [L(rt(f'roadtrain@1-f{k}')) for k in range(4)], 'size': 256, 'trailers': [L(rt('roadtrain-trailer@1'))] * 2, 'lane': 2,
         'start': 2.2, 'x0': 420, 'head': ART + '/tod/shared/roadtrain-headlights.png'},
    ]

def segment(tod, n, rng):
    gnd = ground(tod); V = vehicles(tod); puffs = []
    LIT = [grade(f, tod) for f in LIGHT]; HV = [grade(f, tod) for f in HEAVY]
    out = []
    for i in range(n):
        t = i / FPS; im = gnd.copy()
        for v in V:
            ta = t - v['start']; vmax = 210.0; acc = 120.0
            if ta <= 0: x, spd = v['x0'], 0.0
            elif ta < vmax / acc: x, spd = v['x0'] + 0.5 * acc * ta * ta, acc * ta
            else: x, spd = v['x0'] + 0.5 * vmax * vmax / acc + vmax * (ta - vmax / acc), vmax
            x = (x + 300) % (W + 600) - 300
            v['x'], v['spd'] = x, spd
            y = LANES[v['lane']]; s = VS / v['size']
            # spawn puffs at the stack tips (in screen space, then left where they are)
            accel = 0 < ta < vmax / acc
            every = 1 if accel else (5 if spd == 0 else 3)
            if i % every == 0:
                for p in PTS[v['name']]['tips']:
                    px, py = x + (p[0] - v['size'] / 2) * s, y + (p[1] - v['size'] / 2) * s
                    puffs.append([i, px + rng.uniform(-1.5, 1.5), py + rng.uniform(-1.5, 1.5), 'H' if accel else 'L', rng.uniform(0.85, 1.15)])
        for v in V:
            y = LANES[v['lane']]; x = v['x']; s = VS / v['size']; sz = int(VS)
            fr = v['frames'][int(v['x'] / 7) % 4 if v['spd'] > 0 else 0]
            us = TODJ[tod]['unit_shadow']
            # trailers behind the tractor (road train): kingpin-to-fifth-wheel spacing 5.3 world units
            for k, tr in enumerate(v['trailers']):
                tx = x - (k + 1) * 5.3 / 10 * VS
                im.alpha_composite(tr.resize((sz, sz), Image.LANCZOS), (int(tx - sz / 2), int(y - sz / 2)))
            if tod != 'day':
                hs = 3 * sz; im = additive(im, L(v['head']).resize((hs, hs), Image.LANCZOS), int(x - hs / 2), int(y - hs / 2), TODJ[tod]['headlights'])
            im.alpha_composite(fr.resize((sz, sz), Image.LANCZOS), (int(x - sz / 2), int(y - sz / 2)))
        # puffs drift a touch downwind and play 12 frames at 12 fps
        keep = []
        for p in puffs:
            k = i - p[0]
            if k >= 12: continue
            keep.append(p)
            seq = HV if p[3] == 'H' else LIT
            d = int(0.3 * VS * p[4] * (1.0 if p[3] == 'L' else 1.15))
            fr = seq[k].resize((d, d), Image.LANCZOS)
            im.alpha_composite(fr, (int(p[1] - d / 2 - k * 1.2), int(p[2] - d / 2 - k * 0.8)))
        puffs = keep
        out.append(im.convert('RGB'))
    return out

if __name__ == '__main__':
    rng = np.random.default_rng(1)
    os.makedirs(E + 'prev', exist_ok=True)
    seq = segment('day', 96, rng) + segment('night', 72, rng)
    for i, f in enumerate(seq): f.save(E + f'prev/f{i:03d}.png')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(FPS), '-i', E + 'prev/f%03d.png', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18',
                    '-pix_fmt', 'yuv420p', PREV + 'truck-exhaust-preview.mp4'], check=True)
    print(len(seq))

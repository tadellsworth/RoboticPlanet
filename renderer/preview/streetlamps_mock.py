"""Mock-up of a base with concrete and asphalt roads and the new streetlamps, by day and at night.
Roads are drawn the way the game draws them (band half a tile wide, kerbs, rounded joins), lamps every third road tile."""
import os as _os
_ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))
ART = _os.environ.get('TERRAFALL_ART', _os.path.join(_ROOT, 'art'))   # shipped art in the game's layout: art/<group>/, art/tod/<time>/<group>/, art/tiles/ground.png
PREV = _os.path.join(_ROOT, 'out', 'preview', ''); _os.makedirs(PREV, exist_ok=True)
def tod_dir(tod, group): return f'{ART}/{group}/' if tod == 'day' else f'{ART}/tod/{tod}/{group}/'
import json, math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

TL = 72                      # px per tile in the mock (the game shows 35-80)
COLS, ROWS = 16, 9
W, H = COLS * TL, ROWS * TL
A = ART + '/roads/'
TOD = json.load(open(ART + '/tod/shared/time-of-day.json'))['times']
rng = np.random.default_rng(3)

# road map: 'c' concrete, 'a' asphalt
road = {}
for r in range(ROWS): road[(3, r)] = 'c'
for c in range(3, 12): road[(c, 6)] = 'c'
for r in range(ROWS): road[(12, r)] = 'a'
for c in range(COLS): road[(c, 2)] = 'a'
for c in range(12, COLS): road[(c, 6)] = 'a'

SURF = {'c': ((185, 190, 197), (93, 99, 107)), 'a': ((51, 54, 61), (21, 23, 27))}

def draw_roads():
    S = 4; img = Image.new('RGBA', (W * S, H * S), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    for layer in (0, 1):                                  # 0 = kerb (wider), 1 = surface
        for (c, r), k in road.items():
            col = SURF[k][1 - layer]
            half = (8 if layer == 0 else 6) / 32 * TL * S
            cx, cy = (c + 0.5) * TL * S, (r + 0.5) * TL * S
            d.ellipse((cx - half, cy - half, cx + half, cy + half), fill=col)
            for dc, dr in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                if (c + dc, r + dr) in road:
                    ex, ey = cx + dc * TL * S / 2, cy + dr * TL * S / 2
                    d.rectangle((min(cx, ex) - (half if dr else 0), min(cy, ey) - (half if dc else 0),
                                 max(cx, ex) + (half if dr else 0), max(cy, ey) + (half if dc else 0)), fill=col)
    img = img.resize((W, H), Image.LANCZOS)
    a = np.asarray(img).astype(np.float32)
    # texture: concrete expansion joints, asphalt speckle
    for (c, r), k in road.items():
        x0, y0 = c * TL, r * TL
        if k == 'a':
            blk = a[y0:y0 + TL, x0:x0 + TL]; m = blk[..., 3] > 200
            n = rng.normal(0, 9, m.shape); n[rng.random(m.shape) > 0.06] = 0
            blk[..., :3] += (n[..., None] * m[..., None]); continue
        horiz = (c - 1, r) in road or (c + 1, r) in road
        for t in (0.25, 0.75):
            if horiz: xs = int(x0 + t * TL); sl = a[y0 + int(0.3 * TL):y0 + int(0.7 * TL), xs]
            else: ys = int(y0 + t * TL); sl = a[ys, x0 + int(0.3 * TL):x0 + int(0.7 * TL)]
            m = sl[..., 3] > 200; sl[m, :3] *= 0.86
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA')

def ground():
    g = Image.open(ART + '/tiles/ground.png').convert('RGBA').resize((4 * TL, 4 * TL), Image.LANCZOS)
    bg = Image.new('RGBA', (W, H))
    for y in range(0, H, 4 * TL):
        for x in range(0, W, 4 * TL): bg.paste(g, (x, y))
    return bg

def grade(im, tod):
    if tod == 'day': return im
    a = np.asarray(im).astype(np.float32) / 255; t = TOD[tod]
    a[..., :3] = np.clip(a[..., :3] * np.array(t['grade_multiply']) + np.array(t['grade_add']), 0, 1)
    return Image.fromarray((a * 255).astype(np.uint8), 'RGBA')

def additive(dst, src, x, y, k):
    d = np.asarray(dst).astype(np.float32); s = np.asarray(src).astype(np.float32) / 255
    h, w = s.shape[:2]; x0, y0 = max(0, x), max(0, y); x1, y1 = min(W, x + w), min(H, y + h)
    if x1 <= x0 or y1 <= y0: return dst
    ss = s[y0 - y:y1 - y, x0 - x:x1 - x]
    d[y0:y1, x0:x1, :3] = np.clip(d[y0:y1, x0:x1, :3] + ss[..., :3] * ss[..., 3:4] * 255 * k, 0, 255)
    return Image.fromarray(d.astype(np.uint8), 'RGBA')

def lamps():
    """every third road tile gets a lamp. N-S roads: foot in the west margin, arm east over the road.
    E-W roads: foot in the south margin, so on screen the head stands over the road."""
    out = []
    for (c, r), k in sorted(road.items()):
        horiz = ((c - 1, r) in road or (c + 1, r) in road) and not ((c, r - 1) in road or (c, r + 1) in road)
        vert = ((c, r - 1) in road or (c, r + 1) in road) and not ((c - 1, r) in road or (c + 1, r) in road)
        if vert and r % 3 == 1: out.append((k, (c + 0.125) * TL, (r + 0.6) * TL, False, (c + 0.5, r + 0.5)))
        if horiz and c % 3 == 1: out.append((k, (c + 0.3) * TL, (r + 0.875) * TL, False, (c + 0.5, r + 0.5)))
    return out

BUILD = [('smelter', 6.6, 4.4, 2.6), ('cement-works', 9.4, 4.4, 2.6), ('asphalt-plant', 14.3, 4.6, 2.6), ('depot', 7.0, 8.6, 2.4),
         ('turret@0', 1.4, 5.0, 2.0)]

def scene(tod):
    im = grade(ground(), tod); im.alpha_composite(grade(draw_roads(), tod))
    L = lamps()
    if tod != 'day':
        k = TOD[tod]['light_pools'] / 0.55 * 0.7
        for kind, fx, fy, mir, (tc, tr) in L:
            name = 'road' if kind == 'c' else 'asphalt'
            span = (1.3 if kind == 'c' else 1.6) * TL
            p = Image.open(A + f'streetlamp-{name}-pool.png').resize((int(span), int(span)), Image.LANCZOS)
            im = additive(im, p, int(tc * TL - span / 2), int(tr * TL - span / 2), k)
    objs = []
    for kind, fx, fy, mir, _ in L: objs.append((fy, 'lamp', kind, fx, fy))
    for n, bx, by, s in BUILD: objs.append((by * TL, 'bld', n, bx, by, s))
    for o in sorted(objs, key=lambda o: o[0]):
        if o[1] == 'lamp':
            _, _, kind, fx, fy = o; name = 'road' if kind == 'c' else 'asphalt'
            sz = TL                                            # the 256 canvas is drawn 1 tile across
            b = grade(Image.open(A + f'streetlamp-{name}.png'), tod).resize((sz, sz), Image.LANCZOS)
            x, y = int(fx - sz * 0.5), int(fy - sz * 234 / 256)
            im.alpha_composite(b, (x, y))
            if tod != 'day':
                lit = Image.open(A + f'streetlamp-{name}-lit.png').resize((sz, sz), Image.LANCZOS)
                if tod == 'evening': lit.putalpha(lit.getchannel('A').point(lambda v: int(v * 0.55)))
                im.alpha_composite(lit, (x, y))
        else:
            _, _, n, bx, by, s = o
            src = tod_dir(tod, 'buildings')
            b = Image.open(src + n + '.png').convert('RGBA')
            if n == 'turret@0': b = b.copy(); b.alpha_composite(Image.open(src + ('turret-head-6@0.png')).convert('RGBA'))
            sz = int(s * TL); b = b.resize((sz, sz), Image.LANCZOS)
            im.alpha_composite(b, (int(bx * TL - sz * 0.5), int(by * TL - sz * 0.615)))
    return im

if __name__ == '__main__':
    for t in ('day', 'evening', 'night'):
        scene(t).convert('RGB').save(PREV + f'streetlamps-mock-{t}.jpg', quality=92)
    print('ok')

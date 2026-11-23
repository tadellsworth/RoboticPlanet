# Passenger Town 3D concept (b/town.js; not installed): a block of the town laid out by hand the way townSetup
# (js/world.js) lays it (blocks 4-6 x 3-5 tiles, 2-tile streets, lots split into walk-ups, shops, blocks and towers,
# the civic hall and tower in the middle, a school, a plaza, parking lots with car hulks, arcades over two streets),
# on the ground js/city.js draws (townGroundCanvas), at the game's zoom.
#   python3 preview/town_concept.py jobs             prints the render jobs (node run.js <dir> $(...))
#   python3 preview/town_concept.py compose <dir> <out.png> day|night [--ppt 96]
# The sprites are 128 px a tile (b/town.js default ppu); they are scaled to --ppt. Each one's lot front-left corner
# (its lotFL mark) is put on the lot's front-left corner on the straight-down ground: the building's foot on its lot's
# front kerb, the rest of it standing up the screen. Shadows go down first (with the ground), then the buildings and
# robots sorted by their foot.
import sys, json, math, os, numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.join(HERE, '..', '..', 'art')
X0, Y0, TW, TH = -0.4, -1.2, 30, 18.75          # the view, in tiles (2880 x 1800 at 96 px a tile)
XS = [(-2, 3), (5, 10), (12, 16), (18, 23), (25, 29), (31, 35)]
YS = [(-3, 1), (3, 7), (9, 12), (14, 18), (20, 24)]
B = [  # (kind, x, y, w, h)
    ('tower', -2, -3, 3, 4), ('house', 1, -3, 2, 2), ('house', 1, -1, 2, 2),
    ('flats', 5, -3, 3, 4), ('shop', 8, -3, 2, 4),
    ('tower', 18, -3, 3, 4), ('house', 21, -3, 2, 2), ('house', 21, -1, 2, 2),
    ('shop', 25, -3, 2, 4), ('house', 27, -3, 2, 4),
    ('house', -2, 3, 2, 2), ('house', -2, 5, 2, 2), ('flats', 0, 3, 3, 4),
    ('school', 5, 3, 5, 4),
    ('house', 12, 3, 2, 2), ('house', 14, 3, 2, 2), ('shop', 12, 5, 4, 2),
    ('flats', 18, 3, 3, 4), ('house', 21, 3, 2, 2), ('shop', 21, 5, 2, 2),
    ('house', 25, 3, 2, 2), ('house', 25, 5, 2, 2), ('tower', 27, 3, 2, 4),
    ('house', -2, 9, 2, 3), ('flats', 0, 9, 3, 3),
    ('hall', 5, 9, 5, 3),
    ('spire', 12, 9, 2, 2), ('house', 14, 9, 2, 2), ('house', 12, 11, 4, 1),
    ('house', 25, 9, 2, 3), ('shop', 27, 9, 2, 3),
    ('flats', -2, 14, 3, 4), ('house', 1, 14, 2, 2), ('house', 1, 16, 2, 2),
    ('shop', 5, 14, 2, 4), ('tower', 7, 14, 3, 4),
    ('house', 12, 14, 2, 2), ('house', 12, 16, 2, 2), ('shop', 14, 14, 2, 4),
    ('flats', 18, 14, 3, 3), ('house', 21, 14, 2, 2), ('house', 21, 16, 2, 2), ('house', 18, 17, 3, 1),
    ('tower', -2, 20, 3, 4), ('flats', 1, 20, 2, 4), ('flats', 5, 20, 5, 3), ('tower', 12, 20, 3, 4), ('house', 15, 20, 1, 2),
    ('flats', 18, 20, 3, 4), ('house', 21, 20, 2, 2), ('tower', 25, 20, 3, 4),
    ('arcade', 10, 3, 2, 4), ('arcade', 18, 12, 5, 2),
    ('car', 13, -3, 1, 1), ('car', 15, -2, 1, 1), ('car', 12, 0, 1, 1),
    ('car', 26, 14, 1, 1), ('car', 28, 15, 1, 1), ('car', 25, 17, 1, 1),
]
LOTS = [(12, -3, 4, 4), (25, 14, 4, 4)]       # parking lots (bays)
PLAZAS = [(18, 9, 5, 3)]
BOTS = [('worker', 4.0, 8.2, 0.2), ('worker', 4.4, 8.9, -1.4), ('hauler', 11.0, 13.1, 0), ('worker', 17.0, 2.1, 1.6),
        ('warbot', 24.0, 10.4, 1.57), ('warbot', 24.3, 11.5, 1.57), ('worker', 3.6, 12.6, 3.1), ('hauler', 30.0, 7.6, 3.14)]

def name(i, k): return f'b{i:02d}-{k}'

if sys.argv[1] == 'jobs':
    for i, (k, x, y, w, h) in enumerate(B):
        for tod in ('day', 'night'):
            q = f'k={k}&w={w}&h={h}&v={i + 3}' + ('&tod=night' if tod == 'night' else '')
            print(f"town:::{name(i, k)}-{tod}:{q}")
    sys.exit()

d, out, tod = sys.argv[2], sys.argv[3], sys.argv[4]
PPT = int(sys.argv[sys.argv.index('--ppt') + 1]) if '--ppt' in sys.argv else 96
NIGHT = tod == 'night'
W, H = int(TW * PPT), int(TH * PPT)
rng = np.random.default_rng(7)
def P(x, y): return ((x - X0) * PPT, (y - Y0) * PPT)

# ---------------------------------------------------------------- the ground (after townGroundCanvas)
g = Image.new('RGBA', (W, H), (62, 64, 68, 255)); dr = ImageDraw.Draw(g, 'RGBA')
for _ in range(W * H // 220):
    x, y = rng.integers(0, W), rng.integers(0, H); c = (0, 0, 0, 50) if rng.random() < 0.6 else (255, 255, 255, 14)
    dr.rectangle([x, y, x + 1, y], fill=c)
for (ya, yb) in YS:
    for (xa, xb) in XS:
        a, b = P(xa, ya), P(xb, yb)
        lot = any(l[0] == xa and l[1] == ya for l in LOTS)
        dr.rectangle([a[0] - 2, a[1] - 2, b[0] + 2, b[1] + 2], fill=(38, 40, 43, 255))
        dr.rectangle([a[0], a[1], b[0], b[1]], fill=(70, 72, 76, 255) if lot else (138, 134, 125, 255))
        dr.rectangle([a[0] + 2, a[1] + 2, b[0] - 2, b[1] - 2], outline=(210, 205, 190, 140), width=3)
for (xa, ya, w, h) in LOTS:
    for x in np.arange(xa + 0.5, xa + w, 0.5):
        for y in range(ya, ya + h):
            p = P(x, y); dr.line([p[0], p[1] + 3, p[0], p[1] + PPT * 0.42], fill=(225, 222, 210, 120), width=2)
for (xa, ya, w, h) in PLAZAS:
    for x in np.arange(xa, xa + w + 0.01, 0.5): dr.line([P(x, ya), P(x, ya + h)], fill=(60, 55, 50, 70), width=1)
    for y in np.arange(ya, ya + h + 0.01, 0.5): dr.line([P(xa, y), P(xa + w, y)], fill=(60, 55, 50, 70), width=1)
    cx, cy = P(xa + w / 2, ya + h / 2)
    for r, c in ((0.95, (93, 98, 100)), (0.75, (127, 138, 140)), (0.18, (107, 110, 102))): dr.ellipse([cx - r * PPT, cy - r * PPT, cx + r * PPT, cy + r * PPT], fill=c + (255,))
    for (a, b) in ((xa + 0.15, ya + 0.15), (xa + w - 0.65, ya + 0.15), (xa + 0.15, ya + h - 0.65), (xa + w - 0.65, ya + h - 0.65)):
        p = P(a, b); dr.rectangle([p[0], p[1], p[0] + PPT * 0.5, p[1] + PPT * 0.5], fill=(75, 90, 60, 255)); dr.rectangle([p[0] + 3, p[1] + 3, p[0] + PPT * 0.5 - 3, p[1] + PPT * 0.5 - 3], fill=(111, 138, 74, 255))
# lane dashes and zebra crossings
colSt = [(XS[k][1], XS[k + 1][0]) for k in range(len(XS) - 1)]; rowSt = [(YS[k][1], YS[k + 1][0]) for k in range(len(YS) - 1)]
dash = (232, 226, 205, 150)
for (a, b) in colSt:
    x = (a + b) / 2
    for y in np.arange(Y0 - 1, Y0 + TH + 1, 0.7):
        if any(r0 - 0.1 < y < r1 + 0.1 for r0, r1 in rowSt): continue
        dr.line([P(x, y), P(x, y + 0.38)], fill=dash, width=max(2, PPT // 14))
for (a, b) in rowSt:
    y = (a + b) / 2
    for x in np.arange(X0 - 1, X0 + TW + 1, 0.7):
        if any(c0 - 0.1 < x < c1 + 0.1 for c0, c1 in colSt): continue
        dr.line([P(x, y), P(x + 0.38, y)], fill=dash, width=max(2, PPT // 14))
for (a, b) in colSt:
    for (ra, rb) in rowSt:
        for yy in (ra - 0.32, rb + 0.06):
            for k in range(4): p = P(a + 0.12 + k * 0.47, yy); dr.rectangle([p[0], p[1], p[0] + PPT * 0.24, p[1] + PPT * 0.26], fill=(225, 220, 200, 55))
ground = g
if NIGHT:  # the ground graded for night (as the game's ground at night: dark, blue)
    a = np.asarray(ground).astype(np.float32); a[..., :3] *= np.array([0.30, 0.34, 0.46]); ground = Image.fromarray(a.clip(0, 255).astype(np.uint8), 'RGBA')

# ---------------------------------------------------------------- sprites
k = PPT / 128
def put(dst, im, ox, oy):  # alpha_composite im at (ox, oy), clipped to dst
    x0, y0, x1, y1 = max(0, ox), max(0, oy), min(dst.width, ox + im.width), min(dst.height, oy + im.height)
    if x1 > x0 and y1 > y0: dst.alpha_composite(im.crop((x0 - ox, y0 - oy, x1 - ox, y1 - oy)), (x0, y0))
def sprite(n):
    im = Image.open(f'{d}/{n}.png'); sh = Image.open(f'{d}/{n}-shadow.png'); geo = json.load(open(f'{d}/{n}.json'))
    sz = (round(im.width * k), round(im.height * k))
    return im.resize(sz, Image.LANCZOS), sh.resize(sz, Image.LANCZOS), [v * k for v in geo['lotFL']]
items = []
shadow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
for i, (kd, x, y, w, h) in enumerate(B):
    im, sh, fl = sprite(f'{name(i, kd)}-{tod}')
    px, py = P(x, y + h); ox, oy = round(px - fl[0]), round(py - fl[1])
    put(shadow, sh, ox, oy)
    items.append((y + h, x, im, ox, oy))
# the shadows: one layer, so where two overlap they don't double
sa = np.asarray(shadow)[..., 3].astype(np.float32) / 255 * (0.45 if not NIGHT else 0.3)
gr = np.asarray(ground).astype(np.float32); gr[..., :3] *= (1 - sa[..., None] * np.array([1.0, 0.97, 0.9])); ground = Image.fromarray(gr.clip(0, 255).astype(np.uint8), 'RGBA')
canvas = ground.copy()
# street lamps at the crossings (north-west corner of each, as city.js) and, at night, their pools and the shopfronts' spill
lamps = [(colSt[a][0] + 0.08, rowSt[b][0] + 0.12) for a in range(len(colSt)) for b in range(len(rowSt))]
if NIGHT:
    glow = Image.new('RGBA', (W, H), (0, 0, 0, 0)); gd = ImageDraw.Draw(glow)
    for (lx, ly) in lamps:
        cx, cy = P(lx + 0.35, ly + 0.15); r = PPT * 0.75; gd.ellipse([cx - r, cy - r * 0.8, cx + r, cy + r * 0.8], fill=(255, 196, 120, 110))
    for (kd, x, y, w, h) in B:
        if kd in ('car',): continue
        cx, cy = P(x + w / 2, y + h + 0.25); r = PPT * min(1.4, w * 0.45)
        gd.ellipse([cx - r, cy - r * 0.6, cx + r, cy + r * 0.6], fill=(127, 232, 240, 70) if (x * 7 + y) % 5 == 0 else (255, 200, 130, 80))
    glow = glow.filter(ImageFilter.GaussianBlur(PPT * 0.3))
    ga = np.asarray(glow).astype(np.float32) / 255; cv_ = np.asarray(canvas).astype(np.float32)
    cv_[..., :3] += ga[..., :3] * ga[..., 3:4] * 255 * 1.1; canvas = Image.fromarray(cv_.clip(0, 255).astype(np.uint8), 'RGBA')
for (bt, bx, by, ang) in BOTS:
    src = f'{ART}/tod/night/bots/{bt}@0-f0.webp' if NIGHT and os.path.exists(f'{ART}/tod/night/bots/{bt}@0-f0.webp') else f'{ART}/bots/{bt}@0.png'
    im = Image.open(src).convert('RGBA'); s = (0.6 if bt == 'warbot' else 0.5) * PPT
    im = im.resize((round(s), round(s)), Image.LANCZOS).rotate(-math.degrees(ang), resample=Image.BICUBIC, expand=False)
    cx, cy = P(bx, by); items.append((by + 0.25, bx, im, round(cx - s / 2), round(cy - s / 2)))
for (lx, ly) in lamps:  # a lamp post: drawn standing (like city.js), sorted with the rest
    lm = Image.new('RGBA', (int(PPT * 0.4), int(PPT * 0.85)), (0, 0, 0, 0)); ld = ImageDraw.Draw(lm)
    col = (58, 62, 68, 255) if not NIGHT else (30, 32, 38, 255)
    ld.rectangle([2, 4, 2 + PPT * 0.05, PPT * 0.82], fill=col); ld.rectangle([2, 4, PPT * 0.3, 4 + PPT * 0.04], fill=col)
    if NIGHT: ld.rectangle([PPT * 0.18, 6, PPT * 0.31, 6 + PPT * 0.05], fill=(255, 226, 168, 255))
    cx, cy = P(lx, ly); items.append((ly, lx, lm, round(cx - 2), round(cy - PPT * 0.82)))
items.sort(key=lambda t: (t[0], t[1]))
for (_, _, im, ox, oy) in items:
    put(canvas, im, ox, oy)

# ---------------------------------------------------------------- haze (townHaze: a band over the town, banks drifting)
a = 0.05 if not NIGHT else 0.2
col = np.array([170, 180, 196]) if not NIGHT else np.array([84, 98, 132])
hz = np.full((H, W), a, np.float32)
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
for _ in range(9):
    cx, cy, r = rng.uniform(0, W), rng.uniform(0, H), rng.uniform(3, 7) * PPT
    hz += a * 1.1 * np.exp(-((xx - cx) ** 2 + (yy - cy) ** 2) / (2 * (r / 2) ** 2))
hz += a * 0.8 * (np.exp(-(xx / (W * 0.12)) ** 2) + np.exp(-((W - xx) / (W * 0.12)) ** 2))  # (deeper toward the edges)
hz = np.clip(hz, 0, 0.6)[..., None]
cv_ = np.asarray(canvas).astype(np.float32)[..., :3]
cv_ = cv_ * (1 - hz) + col * hz
if NIGHT:  # the lights glow a little through the haze: a soft bloom of everything bright
    bright = np.clip(cv_ - 150, 0, 255); bl = np.asarray(Image.fromarray(bright.astype(np.uint8)).filter(ImageFilter.GaussianBlur(PPT * 0.35))).astype(np.float32)
    cv_ += bl * 0.7
Image.fromarray(cv_.clip(0, 255).astype(np.uint8), 'RGB').save(out)
print('wrote', out, W, H)

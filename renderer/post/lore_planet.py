# usage: python3 post/lore_planet.py <dir>/ithaca.beauty.png <out.webp> [--w 1280] [--q 80]
# Finishes the Lore guide's Ithaca I (b/lore_planet.js): ringfall streaks falling toward the planet, bloom on what
# is bright (Corvane, the lit Ring, the night side's lights), a soft painted look (a Kuwahara filter: flat strokes
# that keep the edges), a little grain and a vignette, then down to the web size as WebP.
import sys, json, os, numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy.ndimage import uniform_filter

args = sys.argv[1:]
src, dst = args[0], args[1]
OW = int(args[args.index('--w') + 1]) if '--w' in args else 1280
Q = int(args[args.index('--q') + 1]) if '--q' in args else 80
geom = json.load(open(src.replace('.beauty.png', '.geom.json')))

im = Image.open(src).convert('RGB')
W, H = im.size
a = np.asarray(im).astype(np.float32) / 255

# ringfall: a few pieces of the Ring burning in toward the planet (from its upper left, the way the light falls)
px, py = geom['marks']['planet'][0] * W, geom['marks']['planet'][1] * H
streaks = Image.new('RGB', (W, H), 0)
d = ImageDraw.Draw(streaks)
rng = np.random.default_rng(31)
for k in range(7):
    ang = np.radians(rng.uniform(205, 240))                       # coming in from the upper left
    dist = H * rng.uniform(0.36, 0.5)
    x1, y1 = px + np.cos(ang) * dist, py + np.sin(ang) * dist     # the head, just off the planet's limb
    L = H * rng.uniform(0.03, 0.07)
    x0, y0 = x1 + np.cos(ang) * L, y1 + np.sin(ang) * L
    for i in range(12):                                           # a tail that fades out behind the head
        t0, t1 = i / 12, (i + 1) / 12
        c = int(255 * (1 - t0) ** 1.4)
        d.line([(x1 + (x0 - x1) * t0, y1 + (y0 - y1) * t0), (x1 + (x0 - x1) * t1, y1 + (y0 - y1) * t1)], fill=(c, int(c * 0.82), int(c * 0.66)), width=max(1, int(W / 900 * (1 - t0) + 1)))
streaks = np.asarray(streaks.filter(ImageFilter.GaussianBlur(W / 1400))).astype(np.float32) / 255
a = np.clip(a + streaks * 0.9, 0, 1)

# bloom from the bright parts
lum = a.max(axis=2, keepdims=True)
hi = np.clip(lum - 0.62, 0, 1) / 0.38 * a
him = Image.fromarray((hi * 255).astype(np.uint8))
b1 = np.asarray(him.filter(ImageFilter.GaussianBlur(W / 320))).astype(np.float32) / 255
b2 = np.asarray(him.filter(ImageFilter.GaussianBlur(W / 80))).astype(np.float32) / 255
a = 1 - (1 - a) * (1 - np.clip(0.45 * b1 + 0.5 * b2, 0, 1))      # screen blend

# painted: Kuwahara (the mean of the calmest of the four quadrants around each pixel)
r = max(2, W // 640)
k = r + 1
P = 2 * r
a0 = a; a = np.pad(a, ((P, P), (P, P), (0, 0)), mode='edge')   # (padded, so the edges don't wrap round)
mean = np.stack([uniform_filter(a[..., c], size=k) for c in range(3)], -1)
sq = np.stack([uniform_filter(a[..., c] ** 2, size=k) for c in range(3)], -1)
var = (sq - mean ** 2).sum(-1)
best_v = np.full(var.shape, np.inf, np.float32); out = np.zeros_like(a)
h = r // 2 + 1
for dy in (-h, h):
    for dx in (-h, h):
        mv = np.roll(var, (dy, dx), (0, 1)); mm = np.roll(mean, (dy, dx), (0, 1))
        sel = mv < best_v
        best_v = np.where(sel, mv, best_v); out[sel] = mm[sel]
a = (0.55 * out + 0.45 * a)[P:-P, P:-P]

# vignette and grain
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
v = 1 - 0.32 * np.clip(((xx - W * 0.55) / (W * 0.62)) ** 2 + ((yy - H * 0.5) / (H * 0.7)) ** 2, 0, 1) ** 1.4
a = a * v[..., None]
a = np.clip(a + rng.normal(0, 0.012, a.shape).astype(np.float32), 0, 1)

img = Image.fromarray((a * 255 + 0.5).astype(np.uint8)).resize((OW, round(OW * H / W)), Image.LANCZOS)
os.makedirs(os.path.dirname(os.path.abspath(dst)), exist_ok=True)
img.save(dst, 'WEBP', quality=Q, method=6)
print(f'wrote {dst} {img.size} {os.path.getsize(dst) // 1024} KB')

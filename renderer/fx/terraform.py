"""2D effect sheets for terraforming (the Grader at work, ART_GUIDE Batch 35). Seen straight down like the robots,
transparent, lit from the top-left (fxlib.Canvas):
  fx-grader-clods   8 x 128 (4x2)  LOOP, facing right: clods of earth and dust thrown off a dozer blade biting in; the
                                   blade's edge at (40, 64) of each frame, earth rolling forward and spilling off the ends
  fx-grader-splash  8 x 128 (4x2)  earth dropped into water: a crown of muddy spray and droplets, a foam ring spreading
  fx-mud-plume      3 x 256 (3x1)  variants: a cloud of silt spreading in the water (laid flat on the water)
    python3 fx/terraform.py <outdir> [--png]      -> <name>.webp in outdir
"""
import os, sys, math
import numpy as np
from PIL import Image
_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _HERE)
from fxlib import Canvas, sheet, smooth

OUT = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('-') else 'out/fx'
os.makedirs(OUT, exist_ok=True)
EARTH = [(0.55, 0.37, 0.25), (0.64, 0.45, 0.31), (0.47, 0.31, 0.21), (0.70, 0.52, 0.36)]
DUST = (0.70, 0.54, 0.38)


def save(img, name):
    img.save(os.path.join(OUT, name + '.webp'), 'WEBP', quality=84, method=6)
    if '--png' in sys.argv: img.save(os.path.join(OUT, name + '.png'))
    print(name, img.size, os.path.getsize(os.path.join(OUT, name + '.webp')) // 1024, 'KB')


def clod(C, x, y, s, col, ang, alpha):
    """a lumpy clod seen from above: a shadow, a dark base, a lit top-left face"""
    dx, dy = math.cos(ang) * s * 0.35, math.sin(ang) * s * 0.3
    C.streak(x - dx, y - dy, x + dx, y + dy, s * 0.95, tuple(c * 0.62 for c in col), alpha=alpha, taper=False)
    C.streak(x - dx * 0.6 - s * 0.22, y - dy * 0.6 - s * 0.28, x + dx * 0.4 - s * 0.22, y + dy * 0.4 - s * 0.28, s * 0.55, tuple(min(1, c * 1.22) for c in col), alpha=alpha * 0.95, taper=False)


# ------------------------------------------------------------------ fx-grader-clods (a loop)
rng = np.random.default_rng(23)
cl = [dict(ph=rng.uniform(0, 1), side=rng.uniform(-1, 1), v=rng.uniform(30, 64), s=rng.uniform(2.0, 4.2), col=EARTH[i % 4],
           spin=rng.uniform(3, 9), lift=rng.uniform(12, 30)) for i in range(20)]
du = [dict(ph=i / 8 + rng.uniform(0, 0.06), side=rng.uniform(-1, 1), r=rng.uniform(10, 17), seed=int(rng.integers(0, 50))) for i in range(8)]
frames = []
for f in range(8):
    C = Canvas(128, 128)
    bx, by = 40, 64
    for d in du:                                   # dust rolling up off the cut and drifting back and out
        t = (f / 8 + d['ph']) % 1
        x = bx + 6 + 30 * t; y = by + d['side'] * (10 + 30 * t)
        C.puff(x, y, d['r'] * (0.6 + 0.9 * t), dens=0.85 * (1 - t) ** 1.3 * smooth(0, 0.12, t), albedo=DUST, seed=d['seed'], rot=t, soft=1.9, rough=0.28)
    for c in cl:                                   # clods: up off the blade, forward and out to the ends, back down
        t = (f / 8 + c['ph']) % 1
        x = bx + 4 + c['v'] * t
        y = by + c['side'] * (14 + 34 * t)
        z = c['lift'] * 4 * t * (1 - t)            # height: drawn up-left of its shadow
        a = 1 - smooth(0.8, 1.0, t)
        C.blob(x + 1.5, y + 1.5, c['s'] * 1.0, (0, 0, 0), alpha=0.32 * a, power=1.2)
        clod(C, x - z * 0.35, y - z * 0.55, c['s'] * (1 + z / 60), c['col'], c['spin'] * t, a)
    frames.append(C.finish(bloom=(2, 4), bloomk=(0, 0)))
save(sheet(frames, 4), 'fx-grader-clods')

# ------------------------------------------------------------------ fx-grader-splash (played through, then again)
rng = np.random.default_rng(7)
drops = [dict(az=rng.uniform(0, 2 * math.pi), v=rng.uniform(20, 46), s=rng.uniform(1.0, 2.4), mud=rng.uniform() < 0.4, lift=rng.uniform(14, 30)) for _ in range(34)]
frames = []
for f in range(8):
    t = f / 7
    C = Canvas(128, 128); cx, cy = 64, 64
    # the foam ring spreading on the water
    r = 8 + 40 * t ** 0.7
    for k in range(90):
        a = k / 90 * 2 * math.pi; w = 1 + 0.07 * math.sin(a * 5 + 1) + 0.04 * math.sin(a * 11)
        x, y = cx + math.cos(a) * r * w, cy + math.sin(a) * r * w
        C.blob(x, y, 3.5 + 3 * t, (0.93, 0.96, 0.97), alpha=0.32 * (1 - t) ** 0.8, power=1.6)
    # the muddy boil in the middle, white water over it
    C.blob(cx, cy, 14 + 18 * t, (0.62, 0.46, 0.32), alpha=0.85 * (1 - t) ** 1.1, power=0.8)
    C.puff(cx - 2, cy - 2, 7 + 10 * t, dens=0.7 * (1 - t) ** 1.6, albedo=(0.92, 0.94, 0.94), seed=9, rot=-t, soft=2.0, rough=0.4)
    # droplets and spray flying out and dropping back in
    for d in drops:
        q = min(1.0, t * 1.15)
        x = cx + math.cos(d['az']) * d['v'] * q; y = cy + math.sin(d['az']) * d['v'] * q
        z = d['lift'] * 4 * q * (1 - q)
        a = 1 - smooth(0.85, 1.0, q)
        col = (0.50, 0.36, 0.25) if d['mud'] else (0.90, 0.94, 0.96)
        C.blob(x - z * 0.35, y - z * 0.55, d['s'] * (1 + z / 40), col, alpha=0.9 * a, power=1.1)
    frames.append(C.finish(bloom=(2, 4), bloomk=(0, 0)))
save(sheet(frames, 4), 'fx-grader-splash')

# ------------------------------------------------------------------ fx-mud-plume (variants, flat on the water)
frames = []
for v in range(3):
    rng = np.random.default_rng(40 + v)
    C = Canvas(256, 256)
    for i in range(70):                            # billows thinning out from the near (left) side
        a = rng.uniform(-math.pi * 0.75, math.pi * 0.75); d = rng.uniform(0, 1) ** 0.7 * 100
        x = 70 + math.cos(a) * d * 1.05; y = 128 + math.sin(a) * d
        r = rng.uniform(14, 34) * (1.1 - 0.4 * d / 100)
        C.blob(x, y, r, (0.61, 0.40, 0.25), alpha=0.5 * (1 - 0.6 * d / 100), power=1.3)
    img = C.finish(bloom=(2, 4), bloomk=(0, 0))
    # a soft edge so it never shows the frame
    yy, xx = np.mgrid[0:256, 0:256]
    e = np.clip(1 - (np.hypot(xx - 128, yy - 128) - 96) / 30, 0, 1)
    img[..., 3] = (img[..., 3] * e * 0.95).astype(np.uint8)
    frames.append(img)
save(sheet(frames, 3), 'fx-mud-plume')

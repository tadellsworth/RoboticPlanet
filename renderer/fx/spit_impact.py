"""The Spitter's shards striking (design sheet, nothing installed): a volley of crystal shards hits a wall or a turret
coming from the left (+x travel). Eight frames, top-down, on a transparent background:
  0     the hit: a violet-white flash where the shards burst, a ring of grit thrown out
  1-3   splinters flying back and sideways, charge arcing over the struck face, dust lifting
  4-7   grit embers falling and dimming, a last arc or two crawling, the dust thinning
Also writes a stain: the grit left stuck where it struck, glowing faintly (the game would fade it out over a few
seconds, or keep it while the target is being worn down).

    python3 fx/spit_impact.py <outdir> [size]      -> spit-impact-f0..7.png, spit-impact-sheet.png, spit-impact-stain.png
"""
import math
import os
import sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fxlib import Canvas, sheet

OUT = sys.argv[1] if len(sys.argv) > 1 else 'out/fx'
N = int(sys.argv[2]) if len(sys.argv) > 2 else 128
os.makedirs(OUT, exist_ok=True)
FR = 8
CORE = (0.96, 0.92, 1.0); XT = (0.80, 0.68, 1.0); VI = (0.6, 0.36, 1.0); DUST = (0.52, 0.49, 0.53)
rng = np.random.default_rng(31)
C = (N * 0.56, N * 0.5)          # the struck point, a little right of centre (the shards came from the left)
# the splinters: each with a heading (mostly back toward the shooter and to the sides), speed, length
SPL = []
for i in range(26):
    a = math.pi + rng.normal(0, 0.95)                      # back the way they came, spread wide
    if rng.uniform() < 0.25: a = rng.choice([-1, 1]) * (math.pi / 2 + rng.normal(0, 0.35))   # along the struck face
    SPL.append((a, rng.uniform(0.2, 0.46) * N, rng.uniform(0.04, 0.085) * N, rng.uniform(0.6, 1.0)))
EMB = [(rng.uniform(0, 2 * math.pi), rng.uniform(0.05, 0.3) * N, rng.uniform(0.6, 1.0)) for _ in range(40)]


def arc(cv, x0, y0, x1, y1, k, seed, w=0.9):
    """a jagged arc of charge between two points"""
    r = np.random.default_rng(seed); n = 7
    pts = [(x0 + (x1 - x0) * t + r.normal(0, N * 0.025) * (0 < t < 1), y0 + (y1 - y0) * t + r.normal(0, N * 0.025) * (0 < t < 1)) for t in np.linspace(0, 1, n)]
    for (ax, ay), (bx, by) in zip(pts[:-1], pts[1:]):
        cv.streak(ax, ay, bx, by, w * N / 128, CORE, alpha=k, glowk=1.3 * k, taper=False)


def frame(i):
    cv = Canvas(N, N, 2)
    t = i / (FR - 1)
    cx, cy = C
    # dust: low grey puffs lifting where it struck, spreading and thinning
    if i >= 1:
        for j in range(5):
            a = math.pi + (j - 2) * 0.55; d = N * (0.04 + 0.16 * t ** 0.7)
            cv.puff(cx + math.cos(a) * d, cy + math.sin(a) * d, N * (0.06 + 0.11 * t ** 0.6), dens=0.3 * (1 - t) ** 1.6, albedo=DUST, seed=j + 3, rough=0.5, soft=1.6)
    # the flash
    if i == 0:
        cv.blob(cx, cy, N * 0.26, VI, alpha=0.55, glowk=1.6)
        cv.blob(cx, cy, N * 0.12, CORE, alpha=0.95, glowk=2.4, power=1.2)
        for j in range(10):                                    # the shards bursting: short, bright, all directions
            a = j / 10 * 2 * math.pi + rng.normal(0, 0.15); L = N * rng.uniform(0.07, 0.14)
            cv.streak(cx + math.cos(a) * N * 0.03, cy + math.sin(a) * N * 0.03, cx + math.cos(a) * L, cy + math.sin(a) * L, N * 0.022, XT, glowk=1.6)
    elif i == 1:
        cv.blob(cx, cy, N * 0.18, VI, alpha=0.35, glowk=1.0)
        cv.blob(cx, cy, N * 0.06, CORE, alpha=0.7, glowk=1.4)
    # the splinters, flying out and falling (shorter as they tumble), dimming
    if 1 <= i <= 5:
        for a, sp, ln, b in SPL:
            d = sp * (1 - (1 - min(1, (i - 0.4) / 4.5)) ** 2)
            x, y = cx + math.cos(a) * d, cy + math.sin(a) * d
            k = b * (1 - (i - 1) / 5.5)
            l = ln * (1 - 0.12 * i)
            cv.streak(x - math.cos(a) * l, y - math.sin(a) * l, x, y, N * 0.022 * (1.2 - 0.12 * i), XT, alpha=min(1, 1.4 * k), glowk=1.4 * k)
    # embers: grit that fell, flickering out
    if i >= 3:
        for j, (a, d, b) in enumerate(EMB):
            if (j + i) % 3 == 0 and i > 5: continue
            k = b * (1 - (i - 3) / 5) ** 1.3
            x, y = cx + math.cos(a) * d * 1.1, cy + math.sin(a) * d * 0.9
            cv.blob(x, y, N * 0.012, XT, alpha=min(1, k), glowk=1.4 * k, power=1.0)
    # the charge in the shards running over the struck face (a wall's face runs up and down the frame here)
    arcs = {0: 4, 1: 4, 2: 3, 3: 2, 4: 2, 5: 1, 6: 1}.get(i, 0)
    for j in range(arcs):
        y0 = cy + (j - arcs / 2) * N * 0.1 + rng.normal(0, N * 0.03)
        k = 1 - i / 8
        arc(cv, cx + N * 0.02, cy + rng.normal(0, N * 0.03), cx + N * rng.uniform(0.0, 0.08), y0 + rng.choice([-1, 1]) * N * rng.uniform(0.12, 0.26), k, seed=i * 10 + j)
    return cv.finish(bloom=(2.5, 8.0), bloomk=(0.6, 0.4))


def stain():
    cv = Canvas(N, N, 2)
    cx, cy = C
    r = np.random.default_rng(5)
    for j in range(70):
        a = r.uniform(0, 2 * math.pi); d = abs(r.normal(0, N * 0.06))
        x, y = cx + math.cos(a) * d * 0.8, cy + math.sin(a) * d * 1.3
        L = N * r.uniform(0.008, 0.022); b = r.uniform(0.4, 1.0)
        cv.streak(x, y, x + math.cos(a * 3) * L, y + math.sin(a * 3) * L, N * 0.01, XT, alpha=0.9 * b, glowk=0.5 * b)
    return cv.finish(bloom=(2.0, 6.0), bloomk=(0.5, 0.3))


frames = [frame(i) for i in range(FR)]
for i, f in enumerate(frames):
    Image.fromarray(f, 'RGBA').save(os.path.join(OUT, f'spit-impact-f{i}.png'))
sheet(frames, FR).save(os.path.join(OUT, 'spit-impact-sheet.png'))
Image.fromarray(stain(), 'RGBA').save(os.path.join(OUT, 'spit-impact-stain.png'))
print('wrote', OUT)

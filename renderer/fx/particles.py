"""2B particle sheets. Transparent, lit from the top-left, origin of every puff at the bottom centre of its frame.
  fx-chimney-smoke  16 x 128 (4x4)   grey-brown industrial smoke, billows up and out, drifts right, fades
  fx-steam          12 x 128 (4x3)   white steam, quicker and lighter, vanishes
  fx-black-smoke    16 x 128 (4x4)   thick sooty smoke, darker and heavier
  fx-flare           8 x 128x256 (8x1) LOOP: gas flare flame, base at the bottom centre
"""
import os as _os, sys as _sys
_HERE = _os.path.dirname(_os.path.abspath(__file__)); _ROOT = _os.path.dirname(_HERE)
import sys, math, os
import numpy as np
from PIL import Image
sys.path.insert(0, _HERE)
from fxlib import Canvas, sheet, smooth

O = _os.path.join(sys.argv[1] if len(sys.argv) > 1 else 'out/fx', ''); os.makedirs(O, exist_ok=True)

def puff_sheet(n, cols, albedo, dens0, rise, grow, drift, fade_pow, seed, soft=1.8, rough=0.26, sub=6, r0=8.0, wobble=0.12):
    rng = np.random.default_rng(seed)
    offs = [(rng.uniform(-1, 1), rng.uniform(-1, 0.6), rng.uniform(0.5, 0.8), int(rng.integers(0, 40))) for _ in range(sub)]
    frames = []
    for f in range(n):
        t = f / (n - 1)
        cv = Canvas(128, 128, 2)
        cx = 64 + drift * t ** 1.3
        cy = 128 - 5 - rise * t ** 0.85
        r = r0 + grow * t ** 0.7
        dens = dens0 * (1 - t) ** fade_pow * smooth(0, 0.08, t + 0.04)
        if f == n - 1: dens *= 0.25
        # back puffs first (higher, so the lower ones overlap them), then the core
        for (ox, oy, rs, sd) in sorted(offs, key=lambda o: o[1]):
            spread = 0.3 + 0.75 * t
            cv.puff(cx + ox * r * spread, cy + oy * r * spread * 0.8, r * rs * (0.8 + 0.4 * t), dens=dens * 0.8, albedo=albedo,
                    seed=sd, rot=t * 0.8, soft=soft, rough=rough + wobble * t)
        cv.puff(cx, cy, r * 0.82, dens=dens, albedo=albedo, seed=seed + 7, rot=t * 0.6, soft=soft, rough=rough)
        frames.append(cv.finish(bloom=(2, 4), bloomk=(0, 0)))
    return frames

def flare_sheet():
    W, H = 128, 256
    frames = []
    rng = np.random.default_rng(4)
    tongues = [(rng.uniform(0, 1), rng.uniform(-1, 1), rng.uniform(0.6, 1.0)) for _ in range(5)]
    for f in range(8):
        ph = 2 * math.pi * f / 8
        cv = Canvas(W, H, 2)
        bx, by = 64, H - 2
        Hf = 125 + 14 * math.sin(ph) + 8 * math.sin(2 * ph + 1.3)            # flame height, loops every 8 frames
        lean = 6 * math.sin(ph + 0.7) + 3 * math.sin(3 * ph)
        spine = lambda s: (bx + lean * s ** 1.6 + 5 * math.sin(2 * math.pi * s * 1.3 - ph * 2) * s, by - Hf * s)
        width = lambda s: 36 * (0.4 + 0.6 * math.sin(math.pi * min(1, s * 1.3 + 0.1))) * (1 - s) ** 0.6 * (1 + 0.12 * math.sin(9 * s - ph * 2)) + 2
        # outer orange body, then hotter layers inside
        for layer, (col, wk, ak, smax, gk) in enumerate([((1.0, 0.42, 0.09), 1.25, 0.75, 1.0, 0.8), ((1.0, 0.62, 0.18), 0.95, 0.9, 0.86, 0.9),
                                                         ((1.0, 0.84, 0.42), 0.62, 1.0, 0.68, 1.1), ((1.0, 0.97, 0.82), 0.33, 1.0, 0.45, 1.3)]):
            N = 34
            for i in range(N):
                s = i / (N - 1) * smax
                x, y = spine(s); w = width(s) * wk
                a = ak * (1 - smooth(smax * 0.6, smax, s) * 0.85)
                cv.blob(x, y, max(1.2, w), col, alpha=a * 0.55, glowk=gk * 0.6, power=1.6)
        # detached tongues licking up off the tip, cycling with the loop
        for (p0, side, k) in tongues:
            p = (p0 + f / 8) % 1.0
            s = 0.78 + 0.32 * p
            x, y = spine(min(s, 1.0)); x += side * 6 * p; y -= 18 * p
            cv.blob(x, y, (7 - 4 * p) * k, (1.0, 0.55 + 0.25 * (1 - p), 0.15), alpha=(1 - p) ** 1.5 * 0.8, glowk=0.6, power=1.6)
        # small bright root right on the stack tip
        cv.blob(bx, by - 4, 9, (1.0, 0.98, 0.9), alpha=1.0, glowk=1.2, power=1.2)
        frames.append(cv.finish(bloom=(4, 12), bloomk=(0.7, 0.45)))
    return frames

if __name__ == '__main__':
    sm = puff_sheet(16, 4, (0.5, 0.45, 0.4), 1.1, 62, 34, 14, 1.2, 21)
    sheet(sm, 4).save(O + 'fx-chimney-smoke.png')
    st = puff_sheet(12, 4, (0.95, 0.95, 0.93), 0.62, 66, 32, 8, 1.6, 33, soft=2.4, rough=0.2, sub=5)
    sheet(st, 4).save(O + 'fx-steam.png')
    bk = puff_sheet(16, 4, (0.09, 0.085, 0.08), 1.6, 56, 38, 12, 1.0, 45, rough=0.3, sub=7, r0=9)
    sheet(bk, 4).save(O + 'fx-black-smoke.png')
    fl = flare_sheet()
    sheet(fl, 8).save(O + 'fx-flare.png')
    print('ok')

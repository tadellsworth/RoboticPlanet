"""Top-down exhaust puffs for the trucks (seen straight down, lit from the top-left like the vehicles), transparent.
  fx-exhaust.png        12 x 64 (4x3)  light grey-brown puff while running / cruising
  fx-exhaust-heavy.png  12 x 64 (4x3)  thick sooty puff when accelerating or pulling away
Each puff starts at the centre of its frame (put that on the stack tip) and grows and fades there; the game leaves
the puffs where they were spawned, so the moving truck draws a trail behind itself."""
import os as _os, sys as _sys
_HERE = _os.path.dirname(_os.path.abspath(__file__)); _ROOT = _os.path.dirname(_HERE)
import sys, os
import numpy as np
sys.path.insert(0, _HERE)
from fxlib import Canvas, sheet, smooth

O = _os.path.join(sys.argv[1] if len(sys.argv) > 1 else 'out/fx', ''); os.makedirs(O, exist_ok=True)

def puffs(n, albedo, dens0, r0, r1, fade, seed, sub=5, soft=1.8, rough=0.25, drift=(3, 2)):
    rng = np.random.default_rng(seed)
    offs = [(rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(0.55, 0.8), int(rng.integers(0, 40))) for _ in range(sub)]
    out = []
    for f in range(n):
        t = f / (n - 1)
        cv = Canvas(64, 64, 2)
        r = r0 + (r1 - r0) * (1 - (1 - t) ** 1.6)
        cx, cy = 32 + drift[0] * t, 32 + drift[1] * t
        dens = dens0 * (1 - t) ** fade
        if f == n - 1: dens *= 0.3
        for ox, oy, rs, sd in offs:
            sp = 0.25 + 0.6 * t
            cv.puff(cx + ox * r * sp, cy + oy * r * sp, r * rs, dens=dens * 0.75, albedo=albedo, seed=sd, rot=t, soft=soft, rough=rough)
        cv.puff(cx, cy, r * 0.8, dens=dens, albedo=albedo, seed=seed % 40, rot=t * 0.7, soft=soft, rough=rough)
        out.append(cv.finish(bloom=(2, 4), bloomk=(0, 0)))
    return out

if __name__ == '__main__':
    sheet(puffs(12, (0.45, 0.43, 0.4), 0.7, 4.0, 24, 1.6, 7, soft=2.4, rough=0.2), 4).save(O + 'fx-exhaust.png')
    sheet(puffs(12, (0.16, 0.15, 0.14), 1.1, 5.0, 28, 1.25, 19, sub=6, rough=0.28, soft=2.2), 4).save(O + 'fx-exhaust-heavy.png')
    print('ok')

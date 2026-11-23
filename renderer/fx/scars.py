"""War scars' holes (ART_GUIDE, War scars; the Nov 2026 redraw): shell holes and big craters as lit heightfields, so they
read as real dug-out earth (a lit lip on the upper left, the far wall in shade, clods of thrown earth) instead of flat
ellipses. Earth browns whatever the biome (mud is mud on snow or sand), seen at the game's 70-degree camera (round holes
squashed to ovals), light from the top-left like all the art. Transparent outside the thrown earth.

  scar-crater   4 x 256 (4x1)  big craters: a raised rim, a deep bowl, a spray of earth and clods round it.
                               The hole's rim (its radius r) is 0.3 of the frame across from the middle: drawn r / 0.3 wide.
  scar-hole     8 x 64  (8x1)  shell holes: a small bowl and its lip; the rim at 0.32 of the frame.

    python3 fx/scars.py <outdir> [--png]
"""
import os, sys, math
import numpy as np
from PIL import Image
_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(_HERE, '..', 'terrain'))
from tex import fbm

OUT = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('-') else 'out/fx'
os.makedirs(OUT, exist_ok=True)
L = np.array([-0.55, -0.6, 0.58]); L /= np.linalg.norm(L)
SQ = 0.84            # the camera's squash of a round hole
EARTH = np.array([0.36, 0.27, 0.18])      # torn earth
DEEP = np.array([0.25, 0.18, 0.125])     # the damp bowl
DRY = np.array([0.55, 0.44, 0.31])       # sun-dried thrown earth on the lip


def ss(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)


def hole(n, R, seed, depth, rim, spray, ss_=2):
    N = n * ss_
    yy, xx = np.mgrid[0:N, 0:N].astype(np.float64)
    u = (xx + 0.5) / N * 2 - 1
    v = ((yy + 0.5) / N * 2 - 1) / SQ
    d = np.sqrt(u * u + v * v)
    ang = np.arctan2(v, u)
    nz = fbm(N, seed, 2, 10, 1.5)                    # the hole's ragged shape
    nd = fbm(N, seed + 7, 8, N // 6, 1.0)            # clods and grit
    rs = np.random.default_rng(seed)
    lobes = sum(rs.uniform(0.02, 0.06) * np.cos(k * ang + rs.uniform(0, 6.28)) for k in (2, 3))
    r = d / (R * (1 + lobes + 0.04 * nz))
    # the height: a bowl inside the rim, the raised rim, the thrown earth falling away outside it, clods on it
    bowl = -depth * (1 - np.clip(r, 0, 1) ** 2) ** 1.5
    rimh = rim * np.exp(-((r - 1.0) / 0.22) ** 2)
    out = rim * 0.55 * np.exp(-np.clip(r - 1, 0, None) / 0.35) * (r > 1)
    clod = np.clip(nd - 0.9, 0, None) * 0.35 * rim * ss(0.85, 1.1, r) * (1 - ss(1.2, spray, r + 0.15 * nz))
    h = bowl + rimh + out + clod
    # the normal (screen-space gradient, h in units of R*N/2 px) and its light
    gy, gx = np.gradient(h * N / 2 * R)
    nrm = np.stack([-gx, -gy * SQ, np.ones_like(h)], -1)
    nrm /= np.linalg.norm(nrm, axis=-1, keepdims=True)
    lit = np.clip(nrm @ L, 0, 1)
    shade = 0.3 + 1.05 * lit
    # the bowl's floor in its own shadow (the far wall's lip hides the low sun), occluded toward the bottom
    ao = 1 - 0.4 * (1 - np.clip(r, 0, 1)) ** 2 * (r < 1)
    sh = np.where(r < 1, 1 - 0.35 * ss(-0.2, 0.6, -(u * L[0] + v * L[1]) / (np.abs(d) + 1e-3) * (1 - r)), 1)
    col = np.where((r < 0.95)[..., None], DEEP + (EARTH - DEEP) * ss(0.5, 0.95, r)[..., None], EARTH + (DRY - EARTH) * ss(0.95, 1.15, r)[..., None] * (1 - ss(1.2, 1.6, r))[..., None])
    col = col * (1 + 0.12 * nd[..., None])
    rgb = col * (shade * ao)[..., None]
    # standing water's dark sheen at the very bottom of a big one
    a = 1 - ss(1.05, spray, r + 0.22 * nz + 0.1 * np.clip(nd, -1, 1))
    a = np.clip(a * 0.95 + (clod > 0.02) * 0.9 * (r < spray + 0.2), 0, 1)
    a = np.maximum(a, (r < 1.05) * 1.0)
    out = np.concatenate([np.clip(rgb, 0, 1), a[..., None]], -1)
    out = out.reshape(n, ss_, n, ss_, 4).mean((1, 3))
    return (out * 255 + 0.5).astype(np.uint8)


def save(cells, name):
    img = Image.fromarray(np.concatenate(cells, 1), 'RGBA')
    img.save(os.path.join(OUT, name + '.webp'), 'WEBP', quality=84, method=6)
    if '--png' in sys.argv: img.save(os.path.join(OUT, name + '.png'))
    print(name, img.size, os.path.getsize(os.path.join(OUT, name + '.webp')) // 1024, 'KB')


save([hole(256, 0.3, 500 + k, 0.55, 0.16, 1.75) for k in range(4)], 'scar-crater')
save([hole(64, 0.32, 600 + k, 0.45, 0.14, 1.55) for k in range(8)], 'scar-hole')

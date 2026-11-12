"""Lunar ground, cryo-ice "water", rock (512 seamless) and cliff (128x48, tiles left-right).

Ground: grey regolith with a fine dust texture and many soft craters of all sizes, rims lit from the
top-left and shaded to the bottom-right like the rest of the game. Mid grey, slightly cool.
Water: there's no water on the Moon, so lakes are frozen cryo-ice pools: pale blue-grey glassy ice
with pressure cracks and frost, a little darker than the ground so they read as distinct.
Rock: dark grey basalt and anorthosite crags with hard, airless shading.
Cliff: layered grey rock under a lip of regolith.

Run from renderer/:  PYTHONPATH=terrain python3 terrain/terrain_lunar.py [ground water rock cliff]
"""
import os
import sys
import numpy as np
from tex import *
from terrain_biomes import N, over, leaf_patch, cast_shadow

OUT = 'out/art/biomes/lunar'


def crater_patch(R, depth, rim, rim_w=0.22, blanket=0.35, floor=0.0):
    """Height of one crater (bowl, raised rim, ejecta blanket) on a square patch, shape (n, n, 1)."""
    n = int(np.ceil(R * 3.2)) * 2 + 1
    ys, xs = (np.mgrid[0:n, 0:n] - n // 2)
    r = np.hypot(xs, ys) / R
    bowl = -depth * np.clip(1 - r ** 2, 0, 1) ** (1 + floor)
    rimh = rim * np.exp(-((r - 1) / rim_w) ** 2)
    out = rim * blanket * np.exp(-np.clip(r - 1, 0, None) * 2.2) * smoothstep(0.85, 1.15, r)
    h = bowl + rimh + out
    h *= 1 - smoothstep(2.6, 3.15, r)
    return h[..., None]


def crater_field(rng, sizes, H, alb=None, fresh_p=0.15):
    """Stamp craters into height H (N,N,1). sizes: list of (count, R_lo, R_hi)."""
    for count, lo, hi in sizes:
        for i in range(count):
            R = np.exp(rng.uniform(np.log(lo), np.log(hi)))
            age = rng.uniform(0.25, 1.0)          # 1 = fresh and crisp, low = worn down
            d = R * rng.uniform(0.32, 0.45) * age
            rim = R * 0.12 * age
            p = crater_patch(R, d, rim, rim_w=0.22 + 0.25 * (1 - age), floor=rng.uniform(0, 0.6))
            x, y = rng.uniform(0, N, 2)
            stamp(H, p, x, y, mode='add')
            if alb is not None and age > 0.75 and rng.uniform() < fresh_p * 4:
                # fresh craters: brighter rim and a pale ejecta halo
                n = p.shape[0]
                yy, xx = (np.mgrid[0:n, 0:n] - n // 2)
                r = np.hypot(xx, yy) / R
                ang = np.arctan2(yy, xx)
                rays = 0.5 + 0.5 * np.cos(ang * rng.integers(5, 9) + rng.uniform(0, 6)) ** 4
                a = np.exp(-np.clip(r - 1, 0, None) * 1.8) * smoothstep(0.75, 1.0, r) * (0.55 + 0.45 * rays)
                a *= 1 - smoothstep(2.4, 3.1, r)
                stamp(alb, (a * 0.5)[..., None], x, y, mode='max')


# ============================================================================ GROUND

def lunar_ground():
    rng = np.random.default_rng(401)
    # albedo: grey regolith with soft darker (mare) and lighter (highland) mottling
    z1 = fbm(N, 4001, 2, 32, beta=2.0)
    z2 = fbm(N, 4002, 4, 64, beta=1.8)
    col = mix(hexrgb('#6a6c71'), hexrgb('#85878c'), smoothstep(-1.6, 1.6, z1 + 0.4 * z2))
    col = col * (1 + 0.05 * fbm(N, 4003, 90, 256, beta=0.3) + 0.04 * fbm(N, 4004, 30, 120, beta=0.8))[..., None]
    # height: gentle swells, then many craters, then fine dust and pebbles
    H = (2.5 * fbm(N, 4005, 2, 24, beta=2.2))[..., None]
    alb = np.zeros((N, N, 1))
    crater_field(rng, [(3, 30, 48), (18, 10, 24), (90, 3.5, 9), (320, 1.4, 3.4)], H, alb)
    H = H[..., 0]
    H += 0.22 * fbm(N, 4006, 50, 256, beta=0.8)
    peb = fbm(N, 4007, 90, 256, beta=0.2)
    H += 0.6 * smoothstep(1.8, 2.6, peb)
    Nn = normals_from_height(H * 1.0)
    lit = relief(Nn, 225, 48)
    sh = cast_shadow(H, 24, 34)
    shade = 0.62 + 0.4 * lit * (0.55 + 0.45 * sh)
    col = col * shade[..., None]
    # fresh ejecta: bright, slightly bluish-white
    col = over(col, hexrgb('#c4c7cc'), alb[..., 0] * 0.55)
    # crater floors collect a little darker fines
    low = 1 - smoothstep(-1.4, -0.3, zscore(H - blur_wrap(H, 10)))
    col = col * (1 - 0.06 * low)[..., None]
    # small bright rock fragments and dark glass beads
    col = over(col, hexrgb('#b0b2b6'), smoothstep(2.2, 2.8, peb) * 0.6)
    col = over(col, hexrgb('#3a3c40'), smoothstep(2.0, 2.6, fbm(N, 4008, 90, 256, beta=0.2)) * 0.45)
    img = np.concatenate([col, np.ones((N, N, 1))], -1)
    # a few small angular stones with crisp shadows
    for k in range(34):
        x, y = rng.uniform(0, N, 2)
        L = rng.uniform(2.5, 5.5)
        c = hexrgb(['#9a9ca0', '#6e7074', '#86888c'][k % 3]) * rng.uniform(0.9, 1.1)
        p = leaf_patch(L, L * rng.uniform(0.55, 0.85), rng.uniform(0, 3), c, c * 0.7, ss=4, shadow=(1.2, 1.3), sh_op=0.5)
        stamp(img, p, x, y)
    return img[..., :3]


# ============================================================================ CRYO-ICE

def lunar_ice():
    rng = np.random.default_rng(411)
    # depth: clear dark-blue ice where it's deep, milky where shallow
    z1 = fbm(N, 4101, 2, 24, beta=2.1)
    z2 = fbm(N, 4102, 6, 80, beta=1.5)
    col = mix(hexrgb('#34424f'), hexrgb('#5c6c7c'), smoothstep(-1.5, 1.5, z1 + 0.35 * z2))
    # inner structure: faint pale veils and trapped bubbles
    veil = smoothstep(0.2, 1.6, fbm(N, 4103, 4, 60, beta=1.4, aniso=(1.0, 2.5), angle=0.6))
    col = over(col, hexrgb('#8a9aaa'), veil * 0.3)
    bub = smoothstep(2.3, 2.9, fbm(N, 4104, 100, 256, beta=0.1)) * smoothstep(0.0, 1.0, fbm(N, 4105, 3, 20, beta=2.0))
    col = over(col, hexrgb('#d8e4ee'), bub * 0.6)
    # pressure cracks: big plates with pale ridged seams, and a fine network of hairline cracks
    pts = rng.uniform(0, 1, (26, 2))
    F1, F2, ID = worley(N, pts)
    e1 = (F2 - F1) * N + 2.5 * fbm(N, 4106, 8, 60, beta=1.3)
    tone = rng.uniform(0.92, 1.08, len(pts))[ID]
    col = col * tone[..., None]
    ridge = 1 - smoothstep(0.5, 3.0, e1)
    pts2 = rng.uniform(0, 1, (260, 2))
    G1, G2, _ = worley(N, pts2)
    e2 = (G2 - G1) * N + 1.2 * fbm(N, 4107, 30, 140, beta=1.0)
    fine = (1 - smoothstep(0.1, 0.8, e2)) * smoothstep(-0.4, 0.8, fbm(N, 4108, 3, 24, beta=1.8))
    # glassy surface: smooth plates, raised along the seams
    H = 0.8 * fbm(N, 4109, 2, 20, beta=2.2) + 2.2 * ridge
    Nn = normals_from_height(H)
    col = col * (0.82 + 0.22 * relief(Nn, 225, 50))[..., None]
    col = over(col, hexrgb('#2c3846'), fine * 0.45)
    col = over(col, hexrgb('#a8b8c6'), ridge * 0.5)
    col = over(col, hexrgb('#dfe8f0'), (1 - smoothstep(0.2, 1.0, e1)) * 0.45)
    # frost: granular white patches drifting over the ice, thickest along the seams
    fr = fbm(N, 4110, 3, 40, beta=1.8) + 0.8 * blur_wrap(ridge, 4)
    grain = fbm(N, 4111, 80, 256, beta=0.3)
    F = smoothstep(0.9, 2.2, fr) * (0.75 + 0.25 * smoothstep(-1, 1, grain))
    col = over(col, hexrgb('#9aa8b6') * (1 + 0.08 * grain)[..., None], F * 0.6)
    # glassy highlights
    Ns = normals_from_height(0.6 * fbm(N, 4112, 2, 12, beta=2.2) + 0.4 * ridge)
    col = over(col, hexrgb('#f2f8ff'), spec(Ns, 40, 225, 42) * (1 - F) * 0.45)
    col = over(col, hexrgb('#f8fbff'), smoothstep(2.5, 3.0, grain) * F * 0.6)
    return col


# ============================================================================ ROCK

def facet_height(seed, n_cells=34, amp=26, slope=1.3):
    """Angular crags: each Voronoi cell is a tilted plane, so the faces meet in sharp creases."""
    rng = np.random.default_rng(seed)
    pts = rng.uniform(0, 1, (n_cells, 2))
    F1, F2, ID = worley(N, pts)
    ys, xs = np.mgrid[0:N, 0:N]
    u, v = (xs + 0.5) / N, (ys + 0.5) / N
    dx = ((u - pts[ID, 0] + 0.5) % 1.0 - 0.5) * N
    dy = ((v - pts[ID, 1] + 0.5) % 1.0 - 0.5) * N
    h0 = rng.uniform(0, 1, n_cells)
    ga = rng.uniform(0, 2 * np.pi, n_cells)
    gm = rng.uniform(0.2, slope, n_cells)
    H = amp * h0[ID] + gm[ID] * (np.cos(ga[ID]) * dx + np.sin(ga[ID]) * dy) * 0.5
    # second, finer set of facets breaks the big faces up
    pts2 = rng.uniform(0, 1, (140, 2))
    G1, G2, ID2 = worley(N, pts2)
    dx2 = ((u - pts2[ID2, 0] + 0.5) % 1.0 - 0.5) * N
    dy2 = ((v - pts2[ID2, 1] + 0.5) % 1.0 - 0.5) * N
    a2 = rng.uniform(0, 2 * np.pi, 140)
    H += rng.uniform(0.1, 0.5, 140)[ID2] * (np.cos(a2[ID2]) * dx2 + np.sin(a2[ID2]) * dy2) * 0.5
    H += 4 * fbm(N, seed + 1, 2, 16, beta=2.0) + 0.35 * fbm(N, seed + 2, 60, 256, beta=0.8)
    edge = (F2 - F1) * N
    return H, edge


def lunar_rock():
    H, edge = facet_height(430)
    Nn = normals_from_height(H)
    shc = cast_shadow(H, 28, 38)
    shade = 0.12 + 1.25 * lambert(Nn, 225, 45) * (0.2 + 0.8 * shc)
    base = mix(hexrgb('#3c3e43'), hexrgb('#585a5f'), smoothstep(-1.2, 1.2, fbm(N, 432, 3, 60, beta=2.0)))
    base = base * (1 + 0.08 * fbm(N, 433, 60, 256, beta=0.6))[..., None]
    # anorthosite: pale feldspar flecks and lighter bands; basalt: dark vesicles
    band = smoothstep(0.6, 1.4, fbm(N, 434, 3, 40, beta=1.6, aniso=(1.0, 4.0), angle=0.5))
    base = over(base, hexrgb('#7a7c80'), band * 0.45)
    base = over(base, hexrgb('#c4c6c4'), smoothstep(1.8, 2.4, fbm(N, 435, 110, 256, beta=0.2)) * 0.55)
    base = over(base, hexrgb('#24262a'), smoothstep(1.6, 2.2, fbm(N, 436, 110, 256, beta=0.2)) * 0.6)
    col = base * shade[..., None]
    col = over(col, hexrgb('#0c0d10'), (1 - smoothstep(0.3, 1.5, edge)) * 0.5)
    # regolith dust settled in the low parts and on flat tops (soft, matching the ground)
    low = 1 - smoothstep(-1.5, -0.6, zscore(blur_wrap(H, 8)))
    flat = smoothstep(0.985, 0.998, Nn[..., 2]) * smoothstep(0.3, 1.2, fbm(N, 437, 4, 30, beta=2.0))
    dn = fbm(N, 438, 30, 200, beta=1.0)
    Nd = normals_from_height(blur_wrap(H, 2.0) * 0.4 + 0.6 * dn)
    dust = hexrgb('#8a8c90') * (0.4 + 0.7 * lambert(Nd, 225, 45) * (0.3 + 0.7 * shc))[..., None]
    col = over(col, dust, smoothstep(0.4, 0.9, np.maximum(low, flat * 0.8)) * 0.6)
    return col


# ============================================================================ CLIFF (128 x 48, tiles left-right)

def lunar_cliff():
    ss = 4
    Wc, Hc = 128 * ss, 48 * ss
    rng = np.random.default_rng(441)
    ys, xs = np.mgrid[0:Hc, 0:Wc] / ss
    yn = ys / 48.0

    def pfbm(seed, f_lo, f_hi, beta=2.0, aniso=(1, 1)):
        return fbm(Wc, seed, f_lo, f_hi, beta=beta, aniso=aniso)[:Hc]
    # layered strata, slightly wavy, alternating pale anorthosite and dark basalt
    strata = pfbm(4401, 1, 12, 2.0, aniso=(1, 6))
    band = np.sin(ys * 0.62 + 1.4 * strata) * 0.5 + 0.5
    band2 = np.sin(ys * 0.21 + 0.8 * strata + 1.0) * 0.5 + 0.5
    base = mix(hexrgb('#4e5055'), hexrgb('#7c7e83'), smoothstep(0.15, 0.85, band))
    base = over(base, hexrgb('#3a3c40'), smoothstep(0.6, 0.9, band2) * 0.5)
    base = base * (1 + 0.1 * pfbm(4402, 50, 240, 0.4))[..., None]
    base = over(base, hexrgb('#202226'), smoothstep(1.4, 2.0, pfbm(4403, 100, 256, 0.1)) * 0.8)
    base = over(base, hexrgb('#b6b8ba'), smoothstep(1.5, 2.1, pfbm(4404, 100, 256, 0.1)) * 0.5)
    # blocky faces: vertical joints, each block lit on its left
    jx = np.cumsum(rng.uniform(16, 34, 6))
    jx = np.concatenate([[0], jx / jx[-1] * 128])
    k = np.clip(np.searchsorted(jx, xs % 128, side='right') - 1, 0, len(jx) - 2)
    t = (xs % 128 - jx[k]) / (jx[k + 1] - jx[k])
    face = 0.62 + 0.38 * np.cos((t - 0.28) * np.pi * 0.85)
    col = base * face[..., None] * rng.uniform(0.9, 1.1, len(jx))[k][..., None]
    joint = 1 - smoothstep(0.0, 0.05, np.minimum(t, 1 - t))
    col = over(col, hexrgb('#0e0f12'), joint * 0.85)
    # ledges on the harder strata: a lit top edge with a hard shadow beneath
    for y0 in (17.0, 31.0):
        yy = y0 + 1.2 * pfbm(4405 + int(y0), 2, 16)
        top = smoothstep(yy - 0.8, yy, ys) * (1 - smoothstep(yy + 0.6, yy + 1.4, ys))
        under = smoothstep(yy + 0.8, yy + 1.4, ys) * (1 - smoothstep(yy + 2.0, yy + 4.5, ys))
        col = over(col, hexrgb('#a4a6aa'), top * 0.6)
        col = over(col, hexrgb('#101114'), under * 0.6)
    # darker toward the bottom (airless: deep shade)
    col = col * (1 - 0.6 * smoothstep(0.35, 1.0, yn))[..., None]
    # regolith lip along the top, soft and pale, spilling down in a few chutes
    mt = 5 + 2.0 * pfbm(4407, 3, 24) + 4 * smoothstep(0.7, 1.7, pfbm(4408, 6, 30, 1.5))
    rc = mix(hexrgb('#9a9ca1'), hexrgb('#6e7075'), smoothstep(0, 1, ys / np.maximum(mt, 1)))
    rc = rc * (1 + 0.05 * pfbm(4409, 60, 240, 0.4))[..., None]
    rm = 1 - smoothstep(mt - 1, mt + 0.6, ys)
    chute = smoothstep(1.1, 2.0, pfbm(4410, 4, 40, 1.6, aniso=(1, 0.15))) * (1 - smoothstep(0.2, 0.8, yn))
    under = (1 - smoothstep(mt + 0.3, mt + 3.0, ys)) * smoothstep(mt - 0.6, mt + 0.3, ys)
    col = over(col, hexrgb('#0c0d10'), under * 0.5)
    col = over(col, hexrgb('#7c7e82'), chute * 0.4)
    col = over(col, rc, rm)
    return downsample(col, ss)


JOBS = {'ground': lunar_ground, 'water': lunar_ice, 'rock': lunar_rock, 'cliff': lunar_cliff}

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for k in (sys.argv[1:] or JOBS):
        img = JOBS[k]()
        save_rgb(img, f'{OUT}/{k}.png')
        print(k, img.shape, 'mean RGB', (np.clip(img, 0, 1).reshape(-1, 3).mean(0) * 255).round(1))

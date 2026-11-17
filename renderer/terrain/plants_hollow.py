"""The Hollow's decorative plants: plant-1..6 plus plant-N-glow (the parts that give light, added at night).

Bloom growths, cave fungi and crystal forms, scenery only (like every biome's plants), so they keep clear of the
resources: no violet hexagonal Crystal, no teal fungal stalks (Fiber), no grey boulders, and nothing like the Bloom-vein
node (the Hollow's Fiber: thick, bright, knotted veins round a pulsing bulb). Lit like the other biomes' plants (a work
lamp from the top-left); the game's night grade takes them down and the glow maps light them back up.

  1 bracket fungus   pale bone-lilac shelf caps stacked on a black stump, their gills faintly lit underneath
  2 geode puffballs  near-black velvet puffballs, two split open on a lining of lilac crystal grit that glows
  3 tendril star     a low rosette of fleshy tendrils, dark at the root, the curled tips lit violet (the Murmur's star,
                     grown as a plant: the Bloom is made of the same stuff)
  4 cave flowers     a flat grey stone sprouting curled petals of pale gypsum crystal, like a cave's
  5 dripstone        a squat wet stalagmite, ringed, with a collar of Bloom moss and spore beads at its foot
  6 spore cushion    a low cushion of spongy Bloom moss with pinhead spore stalks, their heads glowing

usage: python3 terrain/plants_hollow.py [1..6 | k=scale ...]   (run from renderer/; writes out/art/biomes/hollow)
"""
import sys
import numpy as np
from PIL import Image
from plants_common import *
from plants_alien import GScene, render_glow
import r3d

OUT = 'out/art/biomes/hollow'

# the cave's work-lamp light: a cool white key, a dim violet sky (the Bloom overhead), a dark plum bounce
ENVS['hollow'] = dict(sun=np.array([0.95, 0.94, 1.0]) * 0.9, sky=np.array([0.40, 0.36, 0.52]) * 0.55,
                      bounce=np.array([0.26, 0.20, 0.32]) * 0.4, shadow='#0a0610', shadow_op=0.6, snow='#ffffff')

VIOL, LILAC, PALE, DEEP = '#a04cff', '#c8a8ff', '#e4d8f4', '#6a2cc8'


def render_plant(S, i, scale, offset=(0.0, 0.0), day_glow=0.25):
    res, st = render(S, 'hollow', seed=i + 40, scale=scale, offset=offset, out=None, info=False)
    core, glow = render_glow(S, scale=scale, offset=offset)
    day = np.asarray(res).astype(float) / 255
    k = np.clip(core * day_glow, 0, 1) * (day[..., 3:4] > 0.5)
    day[..., :3] = 1 - (1 - day[..., :3]) * (1 - k)
    Image.fromarray((day * 255 + 0.5).astype(np.uint8), 'RGBA').save(f'{OUT}/plant-{i}.png')
    Image.fromarray((glow * 255 + 0.5).astype(np.uint8), 'RGBA').save(f'{OUT}/plant-{i}-glow.png')
    print(f"plant-{i}: body {st['w']:.2f} x {st['h']:.2f} of canvas, margin {st['margin']} px, {st['tris']} tris")


def ground_mat(S, rng, R, h=3.0, col='#3c3448', col2='#56486a', mat=4, seed=0):
    rf = lobed(R, rng, k=5, amp=(0.06, 0.14), fmax=6)

    def hf(x, y):
        r = np.hypot(x, y) / (R * 1.2)
        P = np.stack([x, y, np.zeros_like(x)], -1).reshape(-1, 3)
        return h * np.clip(1 - r ** 2, 0, 1) + 0.8 * sinnoise(P, 30 + seed, freq=0.5, n=12).reshape(x.shape) + 0.6
    V, F, u, v = patch((0, 0), rf, hf, step=1.2, edge=4)
    S.add(V, F, attrs(len(V), col, col2=col2, u=u, v=v, mat=mat, spec=0.04, gloss=8))


# ============================================================================ plants

def h1_bracket(seed=1):
    rng = np.random.default_rng(seed)
    S = GScene()
    # a black stump of old root, half sunk in the silt
    oriented_blob(S, (0, 0, 6), (17, 13, 15), yaw=0.4, col='#221c28', mat=3, spec=0.05, zmin=0, nu=14, nv=24,
                  disp=lambda d: 0.08 * np.sin(d[:, 0] * 7 + d[:, 2] * 5))
    caps = [(-4, -8, 22, 19, -1.9), (10, 2, 17, 15, -0.4), (-14, 6, 13, 12, 2.6), (4, 14, 10, 11, 1.4), (-10, -18, 8, 9, -2.2),
            (16, -12, 7, 8, -1.0), (-2, 4, 26, 13, -1.2), (12, 14, 6, 7, 0.9)]
    for k, (x, y, z, r, yaw) in enumerate(caps):
        d = np.array([np.cos(yaw), np.sin(yaw)])
        cx, cy = x + d[0] * r * 0.45, y + d[1] * r * 0.45
        capc = lambda u, v, V, cx=cx, cy=cy, r=r: lerpc('#7e7290', '#d4c8de', smoothstep(0.2, 1.0, np.hypot(V[:, 0] - cx, V[:, 1] - cy) / r)) * \
            (0.88 + 0.12 * np.cos(np.hypot(V[:, 0] - cx, V[:, 1] - cy) * 1.8))[:, None]
        oriented_blob(S, (cx, cy, z), (r, r * 0.68, 3.0 + r * 0.08), yaw=yaw, col=capc, mat=0, spec=0.18, gloss=20, zmin=z - 1.0, nu=12, nv=36,
                      disp=lambda dd: 0.05 * np.sin(np.arctan2(dd[:, 1], dd[:, 0]) * 9))
        # foxfire: the cap's growing edge gives a faint lilac light
        ang = np.linspace(-0.5 * np.pi, 0.5 * np.pi, 20)
        ca, sa = np.cos(yaw), np.sin(yaw)
        ex, ey = r * 0.97 * np.cos(ang), r * 0.66 * np.sin(ang)
        ring = np.stack([cx + ex * ca - ey * sa, cy + ex * sa + ey * ca, np.full_like(ang, z + 0.6)], -1)
        with S.glowing('#a884e8', k=0.32):
            add_tube(S, ring, 0.7, 0.7, nseg=5, col='#d8cce8', mat=0, spec=0.3)
    return S


def h2_puffballs(seed=2):
    rng = np.random.default_rng(seed)
    S = GScene()
    ground_mat(S, rng, 34, h=2.0, col='#2e2838', col2='#443a54', seed=2)
    balls = [(0, 0, 17, True), (-23, 10, 11, False), (19, 15, 13, True), (-10, -23, 9, False), (22, -14, 8, True), (-28, -10, 6, False)]
    for k, (x, y, r, split) in enumerate(balls):
        dark = lambda u, v, V: lerpc('#2a2234', '#5a4c6c', smoothstep(0.0, 1.0, u)) * 1.0
        oriented_blob(S, (x, y, r * 0.8), (r, r * 0.95, r * 0.86), yaw=rng.uniform(0, 3), col=dark, mat=4, spec=0.12, gloss=14, zmin=0,
                      nu=14, nv=24, disp=lambda d: 0.03 * np.sin(d[:, 0] * 11 + d[:, 1] * 9))
        if split:
            top = r * 0.8 + r * 0.86 * 0.82
            # the torn rim of velvet skin, and inside it a lining of lilac crystal grit, lit from within
            ang = np.linspace(0, 2 * np.pi, 33)
            rad = r * 0.7 * (1 + 0.12 * np.sin(ang * 5 + k))
            ring = np.stack([x + rad * np.cos(ang), y + rad * np.sin(ang), top + 0.6 * np.sin(ang * 7)], -1)
            add_tube(S, ring, 1.6, 1.6, nseg=6, col='#2a2232', mat=4, spec=0.1)
            with S.glowing(VIOL, mode=2, k=1.3):
                oriented_blob(S, (x, y, top - 1.2), (r * 0.68, r * 0.68, 1.6), col='#b8a0e0', mat=0, spec=0.6, gloss=40, zmin=None, nu=8, nv=24)
            with S.glowing(LILAC, k=1.0):
                for q in range(9):
                    a, dd = rng.uniform(0, 2 * np.pi), rng.uniform(0, r * 0.45)
                    p = np.array([x + dd * np.cos(a), y + dd * np.sin(a), top - 0.6])
                    sp = np.stack([p, p + np.array([np.cos(a) * 0.8, np.sin(a) * 0.8, 2.6])])
                    sp = np.stack([sp[0] + (sp[1] - sp[0]) * t for t in np.linspace(0, 1, 4)])
                    add_tube(S, sp, 1.5, 0.2, nseg=5, col=PALE, mat=0, spec=0.7, gloss=50)
    return S


def h3_tendrils(seed=3):
    rng = np.random.default_rng(seed)
    S = GScene()
    oriented_blob(S, (0, 0, 2), (9, 9, 5), col='#3a2632', mat=0, spec=0.1, zmin=0, nu=10, nv=20)
    n = 13
    for k in range(n):
        yaw = 2 * np.pi * k / n + rng.uniform(-0.12, 0.12)
        L = rng.uniform(26, 36)
        sp, _ = arc_spine((np.cos(yaw) * 5, np.sin(yaw) * 5, 4), yaw, L, np.radians(rng.uniform(18, 30)), np.radians(-35), 18)
        # the tip curls back over
        tip = sp[-1]
        dd = nrm(sp[-1] - sp[-3])
        curl = [tip + (dd * 3.2 * np.sin(t * 2.4) + np.array([0, 0, 3.2 * (1 - np.cos(t * 2.4))])) for t in np.linspace(0.2, 1, 5)]
        spine = np.concatenate([sp, np.array(curl)], 0)
        m = len(spine)
        rad = 3.2 * (1 - 0.72 * np.linspace(0, 1, m) ** 1.1)
        V, F, u, v = tube(spine, rad, 9)
        c = lerpc('#3e2834', '#b08aa0', smoothstep(0.35, 1.0, u))
        with S.glowing(lambda uu, vv, VV: lerpc('#000000', VIOL, smoothstep(0.62, 0.98, uu)), k=1.4):
            S.add(V, F, attrs(len(V), c, col2='#8a6476', u=u, v=v, mat=0, spec=0.25, gloss=26))
    return S


def h4_caveflowers(seed=4):
    rng = np.random.default_rng(seed)
    S = GScene()
    oriented_blob(S, (0, 0, 2), (30, 24, 6), yaw=0.3, col='#4a4652', mat=7, spec=0.08, zmin=0, nu=12, nv=24,
                  disp=lambda d: 0.1 * np.sin(d[:, 0] * 5 + d[:, 1] * 4))
    for c in range(7):
        a0 = rng.uniform(0, 2 * np.pi)
        dd = rng.uniform(4, 18)
        bx, by = dd * np.cos(a0), dd * np.sin(a0) * 0.8
        for p in range(rng.integers(4, 7)):
            yaw = rng.uniform(0, 2 * np.pi)
            L = rng.uniform(9, 16)
            # a gypsum petal: a narrow ribbon curling outward and over, like a ram's horn
            sp, yws = arc_spine((bx, by, 6.5), yaw, L, np.radians(70), np.radians(-60), 12)
            V, F, u, v = ribbon(sp, leaf_width(np.linspace(0, 1, 12), 2.2, 'blade') + 0.4, yaws=yws, ncross=3, fold=0.4)
            with S.glowing('#b090f0', k=0.16):
                S.add(V, F, attrs(len(V), lerpc('#c8c2d4', '#f4f0fa', smoothstep(0.0, 1.0, u)), col2='#d8d0e4', u=u, v=v, mat=5,
                                  spec=0.5, gloss=40, trans=0.3))
    return S


def h5_dripstone(seed=5):
    rng = np.random.default_rng(seed)
    S = GScene()
    ground_mat(S, rng, 30, h=3.0, col='#33284a', col2='#5a4686', seed=5)
    H = 46.0
    n = 24
    t = np.linspace(0, 1, n)
    spine = np.stack([1.5 * t ** 2, 1.0 * t ** 2, H * t], -1)
    rad = 15 * (1 - t) ** 0.85 + 1.2
    rad = rad * (1 + 0.06 * np.sin(t * 40))                              # the rings it grew in
    V, F, u, v = tube(spine, rad, 18)
    col = lerpc('#5a5466', '#cfc8da', smoothstep(0.1, 1.0, u)) * (0.92 + 0.08 * np.sin(u * 40 * np.pi))[:, None]
    S.add(V, F, attrs(len(V), col, col2='#a8a0b6', u=u, v=v, mat=0, spec=0.55, gloss=42))
    oriented_blob(S, (1.5, 1, H), (1.6, 1.6, 1.6), col='#eae4f2', mat=0, spec=0.9, gloss=60, zmin=None)
    # a collar of Bloom moss round its foot, beaded with spores
    ang = np.linspace(0, 2 * np.pi, 40)
    for q in range(26):
        a = rng.uniform(0, 2 * np.pi)
        d = rng.uniform(15, 24)
        with S.glowing(VIOL, k=0.9):
            oriented_blob(S, (d * np.cos(a), d * np.sin(a), 4.2), (1.4, 1.4, 1.6), col='#c4a6ec', mat=0, spec=0.4, zmin=None, nu=6, nv=8)
    return S


def h6_cushion(seed=6):
    rng = np.random.default_rng(seed)
    S = GScene()
    rf = lobed(38, rng, k=6, amp=(0.08, 0.18), fmax=6)

    def hf(x, y):
        r = np.hypot(x, y) / 44
        P = np.stack([x, y, np.zeros_like(x)], -1).reshape(-1, 3)
        return 9.0 * np.clip(1 - r ** 2, 0, 1) ** 0.7 + 1.6 * sinnoise(P, 61, freq=0.35, n=12).reshape(x.shape) + 1.0
    V, F, u, v = patch((0, 0), rf, hf, step=1.0, edge=6)
    S.add(V, F, attrs(len(V), '#3a2e5a', col2='#6a54a0', u=u, v=v, mat=4, spec=0.05, gloss=8))
    for q in range(34):
        a = rng.uniform(0, 2 * np.pi)
        d = 36 * np.sqrt(rng.uniform(0.0, 0.85))
        x, y = d * np.cos(a), d * np.sin(a)
        z0 = float(hf(np.array([x]), np.array([y]))[0]) * 0.9
        h = rng.uniform(3, 7)
        lean = rng.normal(size=2) * 0.8
        sp = np.array([[x, y, z0], [x + lean[0] * 0.5, y + lean[1] * 0.5, z0 + h * 0.6], [x + lean[0], y + lean[1], z0 + h]])
        add_tube(S, sp, 0.55, 0.4, nseg=5, col='#7a6a8e', mat=0)
        with S.glowing(VIOL if q % 3 else LILAC, k=1.2):
            oriented_blob(S, (x + lean[0], y + lean[1], z0 + h + 0.8), (1.5, 1.5, 1.5), col='#d8c0f4', mat=0, spec=0.5, zmin=None, nu=6, nv=10)
    return S


SCALE = [2.3, 2.2, 2.0, 2.3, 2.0, 2.0]
OFFSET = [(0, 4), (0, 4), (0, 6), (0, 4), (0, 14), (0, 4)]
DAYGLOW = [0.12, 0.3, 0.2, 0.1, 0.18, 0.25]
PLANTS = [h1_bracket, h2_puffballs, h3_tendrils, h4_caveflowers, h5_dripstone, h6_cushion]

if __name__ == '__main__':
    import os
    os.makedirs(OUT, exist_ok=True)
    scales, which = {}, []
    for a in sys.argv[1:]:
        if '=' in a:
            k, v = a.split('=')
            scales[int(k)] = float(v)
            which.append(int(k))
        else:
            which.append(int(a))
    for i in (which or range(1, 7)):
        render_plant(PLANTS[i - 1](), i, scales.get(i, SCALE[i - 1]), OFFSET[i - 1], DAYGLOW[i - 1])

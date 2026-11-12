"""Volcanic Ashlands decorative plants: plant-1..6 (+ plant-N-glow.png for the ones that glow).

1 a charred dead tree with a few glowing ember tips, 2 a cluster of charred stumps in ash (one
still smouldering), 3 a fumarole vent (a sulphur-crusted mound with a dark, faintly glowing mouth
and a wisp of steam), 4 an "ash lily" (a hardy red-orange succulent rosette), 5 black obsidian
shards, 6 a scrubby grey-green lichen / ash shrub. Pure scenery: kept clear of the look of the
game's resources (no orange-glowing rock lumps, no crystal clusters, no round grey boulders).

Run from renderer/:  PYTHONPATH=terrain python3 terrain/plants_volcanic.py [1 2 ...]
"""
import sys
import numpy as np
from scipy import ndimage
from plants_common import *
from plants_jungle import leaves_on_ellipsoid
from plants_ext import *

OUT = 'out/art/biomes/volcanic'

# Light through a high ash haze: a slightly warm, softened sun, a dim grey sky, and a warm bounce
# off the dark ground. 'snow' is used as the ash that dusts up-facing surfaces.
ENVS['volcanic'] = dict(sun=np.array([1.0, 0.9, 0.8]) * 0.98, sky=np.array([0.38, 0.37, 0.38]) * 0.62,
                        bounce=np.array([0.42, 0.31, 0.25]) * 0.42, shadow='#0e0706', shadow_op=0.55,
                        snow='#a49f99')

CHAR = '#2e2826'      # charred wood
CHAR2 = '#121010'     # deep char cracks
ASH = '#7c7772'
ASH2 = '#5e5955'
EMBER = '#ffb040'
EMBER2 = '#ff6a1a'


def ash_mound(S, rng, center, R, h=3.0, col=ASH, col2=ASH2, k=5):
    rf = lobed(R, rng, k=k)
    V, F, u, v = patch(center, rf, lambda x, y: h * np.clip(1 - (np.hypot(x, y) / (R * 1.05)) ** 2, 0, 1) + 0.4
                       + 0.5 * sinnoise(np.stack([x, y, 0 * x], -1).reshape(-1, 3), 77, 0.15, 10).reshape(x.shape),
                       step=1.2, edge=5)
    S.add(V, F, attrs(len(V), col, col2=col2, u=u, v=v, mat=2, spec=0.04, gloss=8))


def v1_dead_tree(seed=21):
    """A charred dead tree: black twisted trunk and bare branches, a few ember tips still glowing."""
    rng = np.random.default_rng(seed)
    S = GScene()
    H = 66
    key = np.array([[0, 0, 0], [1.5, -1, 16], [3.5, 0.5, 32], [2.5, 2.5, 48], [5, 3, H]], float)
    t = np.linspace(0, 1, 14)
    trunk = np.stack([np.interp(t, np.linspace(0, 1, len(key)), key[:, k]) for k in range(3)], -1)
    add_tube(S, trunk, 7.0, 2.8, nseg=10, col=CHAR, col2=CHAR2, mat=2, spec=0.12, gloss=14)
    # root flare
    for k in range(6):
        yaw = 2 * np.pi * k / 6 + rng.uniform(-0.3, 0.3)
        sp, _ = arc_spine((0, 0, 5), yaw, rng.uniform(12, 18), np.radians(-20), np.radians(-35), 6)
        sp[:, 2] = np.maximum(sp[:, 2], 0.5)
        add_tube(S, sp, 3.6, 1.0, nseg=6, col=CHAR, col2=CHAR2, mat=2, spec=0.1)
    tips = []

    def branch(p0, d, L, r, depth):
        n = 7
        sp = wiggle_spine(p0, d, L, n, rng, amp=0.3, upbias=0.04)
        sp[:, 2] = np.maximum(sp[:, 2], 4)
        add_tube(S, sp, r, r * 0.55, nseg=6, col=lerpc(CHAR, '#3a3330', depth / 3), col2=CHAR2, mat=2, spec=0.1,
                 gloss=12)
        if depth >= 2:
            tips.append((sp[-1], nrm(sp[-1] - sp[-2]), r * 0.55))
            return
        for j in range(rng.integers(2, 4)):
            i = int(rng.uniform(0.45, 0.95) * (n - 1))
            out = nrm(np.array([sp[i, 0], sp[i, 1], 0]) + 1e-3)
            nd = nrm(nrm(sp[i] - sp[i - 1]) + rng.normal(size=3) * 0.55 + out * 0.4 + np.array([0, 0, 0.1]))
            branch(sp[i], nd, L * rng.uniform(0.55, 0.7), r * 0.6, depth + 1)
        tips.append((sp[-1], nrm(sp[-1] - sp[-2]), r * 0.55))

    nb = 6
    for k in range(nb):
        f = 0.5 + 0.5 * k / (nb - 1)
        i = int(f * (len(trunk) - 1))
        yaw = 2 * np.pi * k * 0.38 + rng.uniform(-0.2, 0.2)
        pitch = np.radians(rng.uniform(12, 40))
        d = np.array([np.cos(pitch) * np.cos(yaw), np.cos(pitch) * np.sin(yaw), np.sin(pitch)])
        branch(trunk[i], d, rng.uniform(40, 52) * (1.1 - 0.3 * f), 3.4, 0)
    branch(trunk[-1], nrm(np.array([0.2, 0.1, 1.0])), 22, 2.4, 1)
    # a few branch ends still hold glowing embers
    order = rng.permutation(len(tips))
    with glowing(S, 1.0, 0.9):
        for q in order[:8]:
            p, d, r = tips[q]
            oriented_blob(S, p + d * 0.6, (2.6, 1.9, 1.9), yaw=np.arctan2(d[1], d[0]), pitch=np.arcsin(np.clip(d[2], -1, 1)),
                          col=EMBER, mat=0, spec=0.0, zmin=None, nu=6, nv=8)
    with glowing(S, 0.8, 0.55):
        for q in order[8:12]:
            p, d, r = tips[q]
            oriented_blob(S, p, (1.6, 1.3, 1.3), col=EMBER2, mat=0, spec=0.0, zmin=None, nu=5, nv=6)
        # a smouldering split low on the trunk, facing the camera
        oriented_blob(S, (1.2, -6.6, 11), (1.3, 0.9, 6.0), roll=0.1, col=EMBER2, mat=0, spec=0.0, zmin=None, nu=8, nv=10)
    ash_mound(S, rng, (2, -2), 30, h=3.0)
    for k in range(4):
        x, y = rng.uniform(-28, 28, 2)
        yaw = rng.uniform(0, np.pi)
        sp = np.stack([np.array([x, y, 2.5]) + t * 9 * np.array([np.cos(yaw), np.sin(yaw), 0]) for t in np.linspace(-1, 1, 5)])
        add_tube(S, sp, 1.4, 1.0, nseg=5, col=CHAR, col2=CHAR2, mat=2)
    return S


def stump(S, rng, base, r, h, smoulder=False):
    bx, by = base
    lean = rng.normal(size=2) * 1.2
    sp = np.array([[bx, by, 0], [bx + lean[0] * 0.5, by + lean[1] * 0.5, h * 0.5], [bx + lean[0], by + lean[1], h]])
    sp = np.stack([sp[0] + (sp[2] - sp[0]) * t + np.array([0, 0, 0]) for t in np.linspace(0, 1, 6)])
    add_tube(S, sp, r * 1.12, r * 0.95, nseg=14, col=CHAR, col2=CHAR2, mat=2, spec=0.12, gloss=14)
    top = sp[-1]
    # the broken top: a charred, cracked cap ringed with splinters
    oriented_blob(S, top + np.array([0, 0, -0.6]), (r * 0.96, r * 0.96, 1.3), col='#3c322c', col2='#18120f', mat=2,
                  spec=0.08, zmin=None, nu=8, nv=16)
    for k in range(10):
        a = 2 * np.pi * k / 10 + rng.uniform(-0.2, 0.2)
        p0 = top + np.array([np.cos(a), np.sin(a), 0]) * r * 0.8 + np.array([0, 0, -1.5])
        hh = rng.uniform(1.5, 8) * (1.2 if k % 3 == 0 else 0.7)
        tip = p0 + np.array([np.cos(a) * 0.6, np.sin(a) * 0.6, hh])
        add_tube(S, np.stack([p0 + (tip - p0) * t for t in np.linspace(0, 1, 4)]), 1.9, 0.25, nseg=5, col=CHAR,
                 col2=CHAR2, mat=2, spec=0.1)
    for k in range(4):
        yaw = 2 * np.pi * k / 4 + rng.uniform(-0.4, 0.4)
        sp2, _ = arc_spine((bx, by, r * 0.5), yaw, r * 1.4 + 4, np.radians(-25), np.radians(-40), 5)
        sp2[:, 2] = np.maximum(sp2[:, 2], 0.6)
        add_tube(S, sp2, r * 0.45, 0.8, nseg=6, col=CHAR, col2=CHAR2, mat=2)
    if smoulder:
        with glowing(S, 0.95, 0.75):
            oriented_blob(S, top + np.array([0.6, -0.4, 0.5]), (r * 0.42, r * 0.36, 0.9), col=EMBER2, mat=0, spec=0.0,
                          zmin=None, nu=8, nv=12)
            oriented_blob(S, top + np.array([0.6, -0.4, 0.9]), (r * 0.2, r * 0.17, 0.7), col=EMBER, mat=0, spec=0.0,
                          zmin=None, nu=6, nv=10)


def v2_stumps(seed=22):
    """Charred stumps standing in a drift of ash, with a burnt log; one stump still smoulders."""
    rng = np.random.default_rng(seed)
    S = GScene()
    ash_mound(S, rng, (0, 0), 62, h=4.0, k=6)
    stump(S, rng, (-26, 18), 10, 26, smoulder=True)
    stump(S, rng, (22, 26), 7.5, 16)
    stump(S, rng, (28, -18), 11, 11)
    stump(S, rng, (-16, -30), 6.0, 8)
    # a fallen, burnt log
    a, b = np.array([-52.0, -6.0, 5.0]), np.array([-6.0, -6.0, 4.5])
    sp = np.stack([a + (b - a) * t for t in np.linspace(0, 1, 8)])
    add_tube(S, sp, 5.0, 4.4, nseg=10, col=CHAR, col2=CHAR2, mat=2, spec=0.12)
    for p, r in [(a, 5.0), (b, 4.4)]:
        oriented_blob(S, p, (0.8, r * 0.95, r * 0.95), col='#4a3a30', col2='#1a1412', mat=2, zmin=None, nu=6, nv=12)
    return S


def v3_fumarole(seed=23):
    """A fumarole: a low mound crusted sulphur-yellow round a dark mouth that glows faintly deep down."""
    rng = np.random.default_rng(seed)
    S = GScene()
    R = 64
    rf = lobed(R, rng, k=6, amp=(0.05, 0.14))

    def hf(x, y):
        r = np.hypot(x, y)
        P = np.stack([x, y, 0 * x], -1).reshape(-1, 3)
        cone = 21 * np.clip(1 - r / R, 0, 1) ** 1.3
        mouth = -17 * np.exp(-(r / 9.5) ** 2.4)
        lumps = 1.6 * sinnoise(P, 31, 0.12, 12).reshape(x.shape) * smoothstep(6, 18, r)
        return cone + mouth + lumps + 0.5
    V, F, u, v = patch((0, 0), rf, hf, step=1.0, edge=6)
    r = np.hypot(V[:, 0], V[:, 1])
    nz = sinnoise(V * np.array([1, 1, 0]), 33, 0.09, 14)
    t = r / R + 0.08 * nz
    stops = [(0.0, '#151110'), (0.12, '#2e2420'), (0.17, '#e8e0b0'), (0.24, '#e0c848'), (0.38, '#c8a838'),
             (0.55, '#94803e'), (0.72, '#76705e'), (1.0, '#6e6964')]
    xs_ = [s[0] for s in stops]
    cs = np.array([C(s[1]) for s in stops])
    col = np.stack([np.interp(t, xs_, cs[:, k]) for k in range(3)], -1)
    col2 = col * 0.82 + 0.18 * C('#fff4c0') * (t < 0.5)[:, None] + 0.18 * col * (t >= 0.5)[:, None]
    S.add(V, F, attrs(len(V), col, col2=col2, u=u, v=v, mat=2, spec=0.1, gloss=14))
    z0 = float(hf(np.array([0.0]), np.array([0.0]))[0])
    with glowing(S, 0.9, 0.3):
        oriented_blob(S, (0, 1.0, z0 + 0.6), (5.0, 4.4, 0.8), col='#ff6018', mat=0, spec=0.0, zmin=None, nu=8, nv=12)
    with glowing(S, 0.6, 0.15):
        oriented_blob(S, (0, 0.5, z0 + 3.0), (7.0, 6.4, 0.6), col='#c83010', mat=0, spec=0.0, zmin=None, nu=8, nv=12)
    # sulphur crystal crumbs round the rim
    for k in range(40):
        a = rng.uniform(0, 2 * np.pi)
        rr = rng.uniform(10, 24)
        x, y = rr * np.cos(a), rr * np.sin(a)
        z = float(hf(np.array([x]), np.array([y]))[0])
        s = rng.uniform(1.0, 2.2)
        oriented_blob(S, (x, y, z + s * 0.4), (s, s * 0.8, s * 0.7), yaw=rng.uniform(0, 3), col='#f2dc58', col2='#fff2a0',
                      mat=7, spec=0.35, gloss=30, zmin=None, nu=5, nv=7)
    # a few grey lava stones on the flanks
    for k in range(5):
        a = rng.uniform(0, 2 * np.pi)
        rr = rng.uniform(40, 58)
        x, y = rr * np.cos(a), rr * np.sin(a)
        z = float(hf(np.array([x]), np.array([y]))[0])
        facet_rock(S, (x, y, z), (rng.uniform(4, 6.5), rng.uniform(3, 5), rng.uniform(2.5, 4)), rng, npts=10,
                   yaw=rng.uniform(0, 3), col='#3e3a38', col2='#565250', zmin=None)
    return S


def steam(size, mouth_xy, rng, height=70, drift=26, amt=0.36):
    """A soft steam wisp rising from mouth_xy (canvas px), drifting right as it thins."""
    ys, xs = np.mgrid[0:size, 0:size].astype(float)
    a = np.zeros((size, size))
    mx, my = mouth_xy
    for k in range(9):
        f = k / 8
        cx = mx + drift * f ** 1.4 + rng.normal() * 2
        cy = my - height * f
        r = 6 + 16 * f
        a += np.exp(-(((xs - cx) / r) ** 2 + ((ys - cy) / (r * 0.8)) ** 2)) * (1 - 0.75 * f) * 0.5
    n = ndimage.gaussian_filter(rng.normal(size=(size, size)), 3.0)
    n = (n - n.mean()) / n.std()
    a = np.clip(a * (0.75 + 0.35 * n), 0, 1) * amt
    a *= 1 - smoothstep(size * 0.36, size * 0.47, np.hypot(xs - size / 2, ys - size / 2))
    return layer('#eeeae6', a)


def v4_ashlily(seed=24):
    """Ash lily: a squat succulent rosette of thick red leaves with orange tips, dusted with ash, and a
    small cluster of yellow-orange blooms in the heart."""
    rng = np.random.default_rng(seed)
    S = GScene()
    rings = [(10, 58, 13.5, 24, -12, '#5e1812', '#d0582a', 0.0),
             (8, 44, 11.5, 40, 6, '#781e14', '#e46a2c', 0.4),
             (7, 30, 9.0, 58, 26, '#902616', '#ee7e34', 0.15),
             (5, 17, 6.5, 74, 48, '#a83018', '#f49040', 0.7)]
    for nl, L, W, p0, p1, c0, c1, off in rings:
        for k in range(nl):
            yaw = 2 * np.pi * (k + off) / nl + rng.uniform(-0.08, 0.08)
            thick_leaf(S, (0, 0, 3), yaw, L * rng.uniform(0.92, 1.06), W, np.radians(p0), np.radians(p1), thick=0.42,
                       shape='point', concave=0.3, col=c0, col_tip=c1, tip_from=0.35, mat=3, spec=0.22, gloss=20,
                       snow=0.22)
    # the bloom: a few small six-petalled flowers on short stems in the heart
    for k in range(4):
        a = 2 * np.pi * k / 4 + 0.4
        base = np.array([3.5 * np.cos(a), 3.5 * np.sin(a), 6])
        top = base + np.array([2.5 * np.cos(a), 2.5 * np.sin(a), 9 + 2 * (k % 2)])
        add_tube(S, np.stack([base + (top - base) * t for t in np.linspace(0, 1, 4)]), 1.1, 0.8, nseg=5,
                 col='#5a3a1c', mat=3)
        for q in range(6):
            yw = 2 * np.pi * q / 6 + k
            add_leaf(S, top, yw, 7.0, 2.6, np.radians(40), np.radians(8), shape='lance', n=5, ncross=3, fold=0.3,
                     col='#ffb43c', col_tip='#ff8a26', col2='#ffd070', mat=0, spec=0.2, trans=0.3)
        oriented_blob(S, top + np.array([0, 0, 0.6]), (1.4, 1.4, 1.0), col='#6a2a10', mat=0, zmin=None, nu=5, nv=7)
    ash_mound(S, rng, (2, -2), 40, h=1.6, k=5)
    return S


def shard(S, rng, base, yaw, length, width, tilt, col='#141217', col2='#262430'):
    """A jagged obsidian shard: a thin, irregular blade jutting out of the ground at an angle."""
    d = np.array([np.cos(tilt) * np.cos(yaw), np.cos(tilt) * np.sin(yaw), np.sin(tilt)])
    side = np.array([-np.sin(yaw), np.cos(yaw), 0])
    up = np.cross(d, side)
    th = width * rng.uniform(0.22, 0.32)
    pts = []
    for s_ in np.linspace(0, 1, 5):
        w = width * (1 - s_) ** 0.8 * rng.uniform(0.7, 1.15) + 0.6
        for sg in (-1, 1):
            off = side * sg * w * 0.5 + up * rng.uniform(-1, 1) * th * (1 - s_ * 0.7)
            pts.append(base + d * length * s_ * rng.uniform(0.92, 1.0) + off)
    pts.append(base + d * length * 1.04 + side * rng.uniform(-1, 1) * width * 0.15)
    for sg in (-1, 1):
        pts.append(base + up * th * sg + d * length * 0.3)
    P = np.array(pts)
    from scipy.spatial import ConvexHull
    hull = ConvexHull(P)
    tri = hull.simplices.copy()
    c = P.mean(0)
    for k, (a, b, e) in enumerate(tri):
        if np.dot(np.cross(P[b] - P[a], P[e] - P[a]), P[a] - c) < 0:
            tri[k] = (a, e, b)
    P[:, 2] = np.maximum(P[:, 2], 0.0)
    V = P[tri].reshape(-1, 3)
    F = np.arange(len(V)).reshape(-1, 3)
    ft = np.repeat(1 + 0.25 * rng.uniform(-1, 1, len(tri)), 3)[:, None]
    S.add(V, F, attrs(len(V), C(col) * ft, col2=C(col2) * ft, mat=5, spec=1.0, gloss=70, trans=0.0))


def v5_obsidian(seed=25):
    """Obsidian: black volcanic glass broken into sharp blades, jutting from a bed of ash and grit."""
    rng = np.random.default_rng(seed)
    S = Scene()
    ash_mound(S, rng, (0, 0), 50, h=2.0, col='#6a6560', col2='#4c4844', k=6)
    spec_ = [(-8, 6, 0.5, 58, 17, 52), (10, -4, -0.6, 50, 15, 44), (-2, -12, -2.0, 46, 13, 38), (6, 14, 1.6, 42, 13, 48),
             (-16, -4, 2.8, 34, 11, 30), (18, 8, 0.1, 30, 10, 26), (0, 2, 4.2, 26, 10, 64), (-6, 22, 2.2, 22, 8, 34)]
    for (x, y, yaw, L, W, tilt) in spec_:
        shard(S, rng, np.array([x, y, -L * 0.12]), yaw, L, W, np.radians(tilt))
    # chips and flakes scattered round about
    for k in range(16):
        a = rng.uniform(0, 2 * np.pi)
        rr = rng.uniform(26, 50)
        facet_rock(S, (rr * np.cos(a), rr * np.sin(a), 0.6), (rng.uniform(2.5, 5), rng.uniform(1.8, 3.5), rng.uniform(0.8, 1.6)),
                   rng, npts=8, yaw=rng.uniform(0, 3), col='#16141a', col2='#2a2830', mat=5, spec=1.0, gloss=70, zmin=None)
    return S


def v6_ashshrub(seed=26):
    """A scrubby, low shrub of small grey-green leaves on wiry stems, half-buried in ash, with lichen."""
    rng = np.random.default_rng(seed)
    S = Scene()
    ash_mound(S, rng, (0, 0), 52, h=2.6, k=6)
    cols = ['#6a7a58', '#7a8866', '#5c6c4e', '#8a967a', '#727e64']
    for (x, y, R, Hh, n) in [(0, 2, 34, 22, 200), (-38, -22, 17, 12, 70), (36, -24, 15, 10, 60)]:
        # wiry stems
        for k in range(int(R * 0.45)):
            yaw = rng.uniform(0, 2 * np.pi)
            d = nrm(np.array([np.cos(yaw), np.sin(yaw), rng.uniform(0.5, 1.3)]))
            sp = wiggle_spine((x + rng.normal() * 2, y + rng.normal() * 2, 0.5), d, R * rng.uniform(0.8, 1.05), 6, rng,
                              amp=0.3, upbias=0.02)
            sp[:, 2] = np.minimum(sp[:, 2], Hh * 1.05)
            add_tube(S, sp, 1.3, 0.4, nseg=5, col='#3c3a34', mat=3, snow=0.2)
        oriented_blob(S, (x, y, Hh * 0.45), (R * 0.8, R * 0.8, Hh * 0.55), col='#2a3024', mat=0, spec=0.02, zmin=0.5,
                      nu=10, nv=14)
        leaves_on_ellipsoid(S, rng, (x, y, Hh * 0.45), (R, R, Hh * 0.7), n, 6.5, 2.6, cols, '#46523c', zmin_frac=-0.15,
                            tilt=0.5, shape='lance', mat=1, spec=0.12, trans=0.2)
    # a lichen-crusted lava stone in front
    facet_rock(S, (8, -40, 1), (12, 9, 6), rng, npts=12, yaw=0.4, col='#4a4642', col2='#9aa47a', mat=2, spec=0.05)
    return S


SCALE = [1.32, 1.28, 1.36, 1.34, 1.5, 1.38]
OFFSET = [(6, 6), (2, 2), (0, 4), (0, 0), (2, 2), (0, 0)]
PLANTS = [v1_dead_tree, v2_stumps, v3_fumarole, v4_ashlily, v5_obsidian, v6_ashshrub]
GLOWS = {1, 2, 3}

if __name__ == '__main__':
    import os
    os.makedirs(OUT, exist_ok=True)
    args = sys.argv[1:]
    scales, which = {}, []
    for a in args:
        if '=' in a:
            k, v = a.split('=')
            scales[int(k)] = float(v)
            which.append(int(k))
        else:
            which.append(int(a))
    for i in (which or range(1, 7)):
        S = PLANTS[i - 1]()
        sc = scales.get(i, SCALE[i - 1])
        above = None
        if i == 3:
            # steam from the vent's mouth (the mouth sits at the world origin, raised by the mound)
            above = steam(256, (128 + OFFSET[i - 1][0] + 2, 128 + OFFSET[i - 1][1] - 6 * sc), np.random.default_rng(9))
            render_plant(S, 'volcanic', f'{OUT}/plant-{i}.png', seed=i, scale=sc, offset=OFFSET[i - 1], centre=True,
                         above=above, glow_out=f'{OUT}/plant-{i}-glow.png', glow_col='#ff5a14')
            continue
        render_plant(S, 'volcanic', f'{OUT}/plant-{i}.png', seed=i, scale=sc, offset=OFFSET[i - 1],
                     glow_out=f'{OUT}/plant-{i}-glow.png' if i in GLOWS else None)

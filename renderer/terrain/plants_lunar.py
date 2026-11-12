"""Lunar decorative "plants" (rocks and features): plant-1..6.

1 a small fresh impact crater (bowl, raised rim, bright ejecta rays, a few ejected blocks),
2 a pair of small, older craters, 3 a jagged dark rock outcrop (angular, not a round boulder),
4 a frost-rimed rock slab with ice lying in its shadow, 5 a scatter of small angular rocks with long
shadows, 6 a bit of old probe debris (a tipped-over little lander, weathered white and gold foil).

The craters are drawn as light and shade over whatever ground they sit on (transparent elsewhere),
so they blend into the regolith. The sun is lower than on the other worlds (long, hard shadows) but
comes from the same top-left direction.

Run from renderer/:  PYTHONPATH=terrain python3 terrain/plants_lunar.py [1 2 ...]
"""
import sys
import numpy as np
from scipy import ndimage
from plants_common import *
from plants_ext import *

OUT = 'out/art/biomes/lunar'
SS = 2  # decal supersampling

# Airless light: a hard white sun, a near-black sky (little fill), a grey bounce off the regolith.
# 'lunar' frosts up-facing surfaces white-blue; 'lunar_dust' dusts them with grey regolith instead.
ENVS['lunar'] = dict(sun=np.array([1.0, 1.0, 0.99]) * 1.06, sky=np.array([0.30, 0.32, 0.37]) * 0.5,
                     bounce=np.array([0.44, 0.44, 0.46]) * 0.42, shadow='#04050a', shadow_op=0.66, snow='#e4ecf4')
ENVS['lunar_dust'] = dict(ENVS['lunar'], snow='#9c9ea2')
LIGHT_LUNAR = np.array([-1.0, 0.85, 1.05])  # same direction as the game's sun, lower in the sky

ROCK = '#4a4c51'
ROCK2 = '#64666b'
DARK = '#34363b'
DARK2 = '#4a4c52'


def light_ctx():
    """Make the decals use the lunar sun (r3d.LIGHT is what shade_decal reads)."""
    class _L:
        def __enter__(self):
            self.old = r3d.LIGHT
            r3d.LIGHT = nrm(LIGHT_LUNAR)

        def __exit__(self, *a):
            r3d.LIGHT = self.old
    return _L()


def rays_alpha(X, Y, cx, cy, R, rng, n=11, reach=(1.8, 2.9), halo=0.55):
    """Bright ejecta: a halo just outside the rim plus narrow rays streaking outward."""
    dx, dy = X - cx, Y - cy
    r = np.hypot(dx, dy) / R
    th = np.arctan2(dy, dx)
    a = halo * np.exp(-np.clip(r - 1, 0, None) * 3.2) * smoothstep(0.85, 1.05, r)
    for k in range(n):
        ang = rng.uniform(-np.pi, np.pi)
        w = rng.uniform(0.035, 0.09)
        L = rng.uniform(*reach)
        d = np.angle(np.exp(1j * (th - ang)))
        ray = np.exp(-(d / (w / np.maximum(r, 0.6))) ** 2) * smoothstep(0.9, 1.15, r) * (1 - smoothstep(L * 0.6, L, r))
        a = np.maximum(a, ray * rng.uniform(0.55, 0.9))
    # broken up, grainy
    g = ndimage.gaussian_filter(rng.normal(size=X.shape), 1.2 * SS)
    g = (g - g.mean()) / g.std()
    return np.clip(a * (0.8 + 0.25 * g), 0, 1)


def crater_decal(craters, scale, rng, shift=(0.0, 0.0), fade=(104, 124)):
    """RGBA (256) of craters drawn as shade / highlight / bright ejecta over the ground.
    craters: list of dicts(x, y, R, depth, rim, rim_w, blanket, floor, rays (0..1), n_rays)."""
    X, Y = ground_grid(256, SS, scale, shift)
    H = np.zeros_like(X)
    ej = np.zeros_like(X)
    for c in craters:
        H += crater_height(X, Y, c['x'], c['y'], c['R'], depth=c.get('depth', 0.38), rim=c.get('rim', 0.13),
                           rim_w=c.get('rim_w', 0.22), blanket=c.get('blanket', 0.4), floor=c.get('floor', 0.3))
        if c.get('rays', 0) > 0:
            ej = np.maximum(ej, c['rays'] * rays_alpha(X, Y, c['x'], c['y'], c['R'], rng, n=c.get('n_rays', 11),
                                                       reach=c.get('reach', (1.8, 2.9))))
    # fine regolith texture on the disturbed ground
    H += 0.12 * ndimage.gaussian_filter(rng.normal(size=H.shape), 1.5 * SS)
    with light_ctx():
        dark, light = shade_decal(H, X, Y, SS, scale, kd=0.8, kl=0.8, dmax=0.66, lmax=0.42, shadow_steps=90)
    f = radial_fade(256, SS, fade[0], fade[1], shift)
    ejl = layer('#dcdee2', ej * 0.75 * f)
    dark[..., 3] *= f
    light[..., 3] *= f
    img = over_rgba(dark, over_rgba(light, ejl))
    return down_rgba(img, SS)


def scatter_blocks(S, rng, n, rmin, rmax, size, center=(0, 0), col=ROCK, col2=ROCK2, snow=0.25, avoid=None):
    for k in range(n):
        a = rng.uniform(0, 2 * np.pi)
        rr = rng.uniform(rmin, rmax)
        s = rng.uniform(*size)
        x, y = center[0] + rr * np.cos(a), center[1] + rr * np.sin(a)
        facet_rock(S, (x, y, s * 0.25), (s, s * rng.uniform(0.6, 0.9), s * rng.uniform(0.45, 0.7)), rng,
                   npts=rng.integers(8, 12), yaw=rng.uniform(0, 3), pitch=rng.uniform(-0.3, 0.3), col=col, col2=col2,
                   snow=snow, zmin=0.0)


def l1_crater(seed=31, scale=1.0, shift=(0, 0)):
    """A small fresh impact crater: a crisp bowl, a raised rim, bright rays, a few ejected blocks."""
    rng = np.random.default_rng(seed)
    S = GScene()
    R = 46
    scatter_blocks(S, rng, 7, R * 0.98, R * 1.25, (2.5, 5.0), col='#5c5e63', col2='#7c7e83')
    scatter_blocks(S, rng, 6, R * 1.3, R * 1.9, (1.6, 3.2), col='#5c5e63', col2='#7c7e83')
    under = crater_decal([dict(x=0, y=0, R=R, depth=0.34, rim=0.15, rim_w=0.22, blanket=0.45, floor=0.25, rays=1.0,
                               n_rays=16, reach=(1.7, 2.4))], scale, rng, shift)
    return S, under


def l2_craters(seed=32, scale=1.0, shift=(0, 0)):
    """Two small craters side by side, softened with age, one a little fresher with a pale halo."""
    rng = np.random.default_rng(seed)
    S = GScene()
    c1 = dict(x=-24, y=12, R=36, depth=0.24, rim=0.1, rim_w=0.32, blanket=0.35, floor=0.6, rays=0.0)
    c2 = dict(x=30, y=-20, R=22, depth=0.32, rim=0.13, rim_w=0.24, blanket=0.4, floor=0.3, rays=0.6, n_rays=7,
              reach=(1.5, 2.1))
    scatter_blocks(S, rng, 4, 22, 28, (1.8, 3.4), center=(30, -20), col='#5c5e63', col2='#7c7e83')
    scatter_blocks(S, rng, 3, 36, 44, (2.0, 3.6), center=(-24, 12))
    under = crater_decal([c1, c2], scale, rng, shift)
    return S, under


def l3_outcrop(seed=33, scale=1.0, shift=(0, 0)):
    """A jagged outcrop of dark basalt: tilted, broken blocks along a ridge, with rubble at its foot."""
    rng = np.random.default_rng(seed)
    S = GScene()
    ridge = np.radians(-28)
    d = np.array([np.cos(ridge), np.sin(ridge)])
    blocks = [(-40, 18, 11, 8, 14, 0.5), (-22, 10, 15, 10, 24, 0.3), (-4, 2, 18, 12, 34, -0.15), (14, -6, 15, 11, 27, -0.4),
              (32, -10, 12, 9, 18, -0.6), (46, -16, 9, 7, 11, -0.8), (4, 16, 10, 8, 15, 0.2), (-10, -14, 9, 7, 12, -0.3)]
    for (x, y, a, b, h, tilt) in blocks:
        facet_rock(S, (x, y, h * 0.42), (a, b, h), rng, npts=rng.integers(9, 13), yaw=ridge + rng.uniform(-0.4, 0.4),
                   pitch=tilt + rng.uniform(-0.15, 0.15), roll=rng.uniform(-0.25, 0.25), col=DARK, col2=DARK2,
                   snow=0.28, zmin=0.0, jitter=0.35, tone=0.18)
    scatter_blocks(S, rng, 16, 30, 62, (2.0, 5.0), center=(0, 0), col=DARK, col2=DARK2, snow=0.25)
    return S, None


def l4_frostslab(seed=34, scale=1.0, shift=(0, 0)):
    """A broad, tilted slab of rock, frost-rimed on top, with a sheet of ice kept in its shadow."""
    rng = np.random.default_rng(seed)
    S = GScene()
    # ice first: a glassy sheet on the ground down-right of the slab (in its shadow)
    rf = lobed(24, rng, k=5, amp=(0.1, 0.25))
    V, F, u, v = patch((30, -28), rf, lambda x, y: 0.9 + 0.0 * x, step=1.2, edge=3)
    S.add(V, F, attrs(len(V), '#8ea0ae', col2='#c4d4e0', u=u, v=v, mat=5, spec=0.8, gloss=50), fade=np.clip(u, 1e-3, 1) ** 3)
    # the slab: an angular, broken plate of rock, its far (down-right) edge lifted so it leans back
    k = 9
    ang = np.sort(rng.uniform(0, 2 * np.pi, k))
    rad = rng.uniform(0.78, 1.0, k)
    ring = np.stack([44 * rad * np.cos(ang), 34 * rad * np.sin(ang)], -1)
    pts = []
    for (x, y) in ring:
        pts.append((x, y, 4.0 + rng.uniform(-0.8, 0.8)))
        pts.append((x * 0.97, y * 0.97, -4.0))
    pts += [(rng.uniform(-12, 12), rng.uniform(-8, 8), 5.2) for _ in range(4)]
    from scipy.spatial import ConvexHull
    P = np.array(pts, float)
    hull = ConvexHull(P)
    tri = hull.simplices.copy()
    c = P.mean(0)
    for q, (a, b, e) in enumerate(tri):
        if np.dot(np.cross(P[b] - P[a], P[e] - P[a]), P[a] - c) < 0:
            tri[q] = (a, e, b)
    P = rot_y(P, np.radians(-22))
    P = rot_z(P, np.radians(-38))
    P = P + np.array([-8.0, 8.0, 11.0])
    P[:, 2] = np.maximum(P[:, 2], 0.0)
    V = P[tri].reshape(-1, 3)
    F = np.arange(len(V)).reshape(-1, 3)
    ft = np.repeat(1 + 0.08 * rng.uniform(-1, 1, len(tri)), 3)[:, None]
    S.add(V, F, attrs(len(V), C('#6a6c72') * ft, col2=C('#7c7e84') * ft, mat=3, spec=0.15, gloss=18, snow=0.38))
    # a frost rime along its upper edges: small ice crystals
    top = P[0:2 * k:2]
    cen = P[0:2 * k:2].mean(0)
    for q in range(110):
        i = rng.integers(k)
        p = top[i] + (top[(i + 1) % k] - top[i]) * rng.uniform(0, 1)
        p = p + (cen - p) * rng.uniform(0.0, 0.16) + rng.normal(size=3) * np.array([0.5, 0.5, 0.1])
        sz = rng.uniform(0.6, 1.3)
        oriented_blob(S, p + np.array([0, 0, 0.4]), (sz * 1.6, sz, sz * 0.5), yaw=rng.uniform(0, 3), col='#d4e2ee',
                      col2='#ffffff', mat=5, spec=0.6, gloss=40, zmin=None, nu=4, nv=6)
    # a couple of smaller broken pieces
    facet_rock(S, (36, 18, 3), (9, 7, 5), rng, npts=10, yaw=0.6, col='#505257', col2='#6c6e73', snow=0.5)
    facet_rock(S, (-44, -16, 2), (7, 5, 4), rng, npts=9, yaw=1.6, col='#505257', col2='#6c6e73', snow=0.5)
    return S, None


def l5_scatter(seed=35, scale=1.0, shift=(0, 0)):
    """A scatter of small angular rocks of different sizes, each throwing a long shadow."""
    rng = np.random.default_rng(seed)
    S = GScene()
    spots = [(-38, 30, 11), (-6, 36, 6), (22, 26, 8), (44, 8, 5), (-48, -4, 6), (-18, 4, 13), (12, -4, 7),
             (36, -26, 10), (-30, -34, 7), (2, -32, 5), (-52, 18, 3.5), (26, 44, 3.5), (52, -14, 3.5), (-6, -50, 4),
             (6, 16, 3.2), (-30, 14, 3.0), (30, -6, 3.0)]
    for (x, y, s) in spots:
        x, y = x + rng.normal() * 2, y + rng.normal() * 2
        facet_rock(S, (x, y, s * 0.45), (s, s * rng.uniform(0.6, 0.85), s * rng.uniform(1.0, 1.4)), rng,
                   npts=rng.integers(8, 12), yaw=rng.uniform(0, 3), pitch=rng.uniform(-0.3, 0.3), col=ROCK, col2=ROCK2,
                   snow=0.28, zmin=0.0, jitter=0.3)
    return S, None


def box(S, center, size, yaw=0.0, pitch=0.0, roll=0.0, col='#cccccc', col2=None, mat=0, spec=0.2, gloss=20, snow=0.0):
    """A flat-shaded box (12 triangles, each face its own vertices)."""
    sx, sy, sz = np.asarray(size, float) / 2
    c = np.array([[x, y, z] for x in (-sx, sx) for y in (-sy, sy) for z in (-sz, sz)])
    quads = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    tri = []
    for a, b, d, e in quads:
        tri += [(a, b, d), (a, d, e)]
    tri = np.array(tri)
    P = rot_x(c, roll)
    P = rot_y(P, -pitch)
    P = rot_z(P, yaw)
    P = P + np.asarray(center, float)
    P[:, 2] = np.maximum(P[:, 2], 0.0)
    V = P[tri].reshape(-1, 3)
    F = np.arange(len(V)).reshape(-1, 3)
    S.add(V, F, attrs(len(V), col, col2=col2 if col2 is not None else col, mat=mat, spec=spec, gloss=gloss, snow=snow))
    return P


def l6_probe(seed=36, scale=1.0, shift=(0, 0)):
    """Old probe debris: a small lander tipped on its side, gold foil dulled with dust, a solar panel
    torn off and lying nearby, one bent leg, half-buried in regolith."""
    rng = np.random.default_rng(seed)
    S = GScene()
    yaw, roll = np.radians(24), np.radians(72)
    # the body: an octagon-ish drum read as a box wrapped in crinkled gold foil, lying on its side
    box(S, (-6, 4, 9), (26, 22, 18), yaw=yaw, roll=roll, col='#8a7444', col2='#b49a5c', mat=2, spec=0.45, gloss=28,
        snow=0.4)
    # white radiator / deck plates on the body
    box(S, (-6, -6, 17.5), (24, 1.6, 12), yaw=yaw, roll=0.15, col='#c8c8c2', col2='#e2e2dc', mat=7, spec=0.3, snow=0.3)
    # legs: thin white struts sticking out sideways, one bent, round foot pads
    for (p0, p1, foot) in [((-14, 12, 12), (-34, 30, 6), True), ((4, 14, 13), (18, 38, 16), True),
                           ((-16, -2, 6), (-36, -10, 2), False)]:
        p0, p1 = np.array(p0, float), np.array(p1, float)
        mid = (p0 + p1) / 2 + np.array([0, 0, 3])
        sp = np.stack([p0, (p0 + mid) / 2, mid, (mid + p1) / 2, p1])
        add_tube(S, sp, 1.3, 1.0, nseg=6, col='#cfcfca', mat=0, spec=0.35, gloss=30, snow=0.2)
        if foot:
            oriented_blob(S, p1, (3.2, 3.2, 0.8), roll=rng.uniform(0.9, 1.3), col='#c4c4be', mat=0, spec=0.3, zmin=0.0,
                          nu=8, nv=12)
    # antenna dish on a short mast
    add_tube(S, np.array([[2, 0, 16], [8, 2, 22], [12, 3, 25]], float), 0.9, 0.7, nseg=5, col='#bdbdb8', mat=0)
    oriented_blob(S, (13, 3.5, 26), (5.5, 5.5, 1.4), pitch=np.radians(-35), yaw=0.4, col='#e0e0da', mat=0, spec=0.4,
                  gloss=30, zmin=None, nu=8, nv=14)
    # the solar panel, torn off and lying in the dust at an angle, partly buried
    box(S, (30, -24, 1.8), (40, 18, 1.4), yaw=np.radians(-14), pitch=np.radians(4), roll=np.radians(-6), col='#26303e',
        col2='#3a4a60', mat=7, spec=0.7, gloss=40, snow=0.15)
    pa = np.radians(-14)
    for lx in (-13.3, 0.0, 13.3):  # frame bars between the cell blocks
        box(S, (30 + lx * np.cos(pa), -24 + lx * np.sin(pa), 2.7), (1.2, 18, 0.6), yaw=pa, col='#a8aaa8', mat=0, spec=0.3)
    # bits of foil and a strut scattered about
    for k in range(5):
        x, y = rng.uniform(-50, 50), rng.uniform(-40, 40)
        if np.hypot(x + 6, y - 4) < 26:
            continue
        box(S, (x, y, 0.6), (rng.uniform(3, 6), rng.uniform(2, 4), 0.6), yaw=rng.uniform(0, 3), col='#8e7a4c',
            col2='#b8a064', mat=2, spec=0.45, snow=0.35)
    scatter_blocks(S, rng, 6, 44, 60, (1.8, 3.4))
    # a scuffed furrow where it skidded to a stop
    X, Y = ground_grid(256, SS, scale, shift)
    t = (X + 6) * np.cos(np.radians(-150)) + (Y - 4) * np.sin(np.radians(-150))
    n_ = -(X + 6) * np.sin(np.radians(-150)) + (Y - 4) * np.cos(np.radians(-150))
    fur = smoothstep(4, 14, t) * (1 - smoothstep(30, 62, t)) * np.exp(-(n_ / 6.5) ** 2)
    Hf = -1.6 * fur + 1.0 * smoothstep(4, 14, t) * (1 - smoothstep(30, 62, t)) * np.exp(-((np.abs(n_) - 8) / 2.5) ** 2)
    with light_ctx():
        dark, light = shade_decal(Hf, X, Y, SS, scale, kd=1.2, kl=1.2, dmax=0.5, lmax=0.4, shadow_steps=20)
    under = down_rgba(over_rgba(dark, light), SS)
    return S, under


SCALE = [1.32, 1.42, 1.72, 1.62, 1.6, 1.7]
OFFSET = [(0, 0), (0, 0), (-16, -12), (-12, -10), (-10, -10), (-10, -6)]  # world origin at canvas centre + this
PLANTS = [l1_crater, l2_craters, l3_outcrop, l4_frostslab, l5_scatter, l6_probe]
ENV = ['lunar_dust', 'lunar_dust', 'lunar_dust', 'lunar', 'lunar_dust', 'lunar_dust']

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
        sc = scales.get(i, SCALE[i - 1])
        S, under = PLANTS[i - 1](scale=sc, shift=OFFSET[i - 1])
        render_plant(S, ENV[i - 1], f'{OUT}/plant-{i}.png', seed=i, scale=sc, offset=OFFSET[i - 1], centre=True,
                     under=under, light=LIGHT_LUNAR)

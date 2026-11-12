"""Alien Bloom decorative plants: plant-1..6 plus plant-N-glow (the bioluminescent parts, added at night).

1 a giant mushroom tree, 2 a cluster of pink tube-corals, 3 a spiral tendril plant with glowing bulbs,
4 a cluster of translucent lantern pods, 5 a tentacle frond plant, 6 a fan of magenta-and-gold petal leaves.

The glow pass re-rasterises the same scene with the same camera framing and keeps only the surfaces
that were given an emission colour (see GScene.glowing), so occluded glowing parts stay hidden. The
glow image is RGBA: RGB the light's colour, alpha its strength (transparent where nothing glows), so it
works both drawn normally and added with 'lighter'. A little of the glow is also baked into the day image.
"""
import sys
from contextlib import contextmanager
import numpy as np
from PIL import Image
from plants_common import *
import r3d

OUT = 'out/art/biomes/alien'

# A lilac sun, violet sky and bounce light, deep purple shadows.
ENVS['alien'] = dict(sun=np.array([1.0, 0.93, 0.97]) * 0.92, sky=np.array([0.50, 0.42, 0.64]) * 0.62,
                     bounce=np.array([0.36, 0.26, 0.46]) * 0.42, shadow='#140a24', shadow_op=0.56, snow='#ffffff')

PINK, VIOLET, GOLD, AQUA, ORANGE = '#ff5cbc', '#b46cff', '#ffc85a', '#6af0ff', '#ff9a48'


class GScene(Scene):
    """A Scene that also carries an emission colour per vertex (and a mode: 0 flat, 1 leaf veins only,
    2 brightest where the surface faces the camera, like light inside a translucent pod)."""

    def __init__(self):
        super().__init__()
        self.E = []
        self.cur = None

    def add(self, V, F, A, normals=None):
        super().add(V, F, A, normals)
        n = len(V)
        e = np.zeros((n, 4))
        if self.cur is not None:
            col, mode, k = self.cur
            c = col(A[:, I_U], A[:, I_V], np.asarray(V)) if callable(col) else np.broadcast_to(C(col), (n, 3))
            e[:, :3] = np.asarray(c) * k
            e[:, 3] = mode
        self.E.append(e)

    @contextmanager
    def glowing(self, col, mode=0, k=1.0):
        prev = self.cur
        self.cur = (col, mode, k)
        try:
            yield
        finally:
            self.cur = prev


def render_glow(S, size=256, ss=3, scale=1.0, offset=(0.0, 0.0), halo=((2.2, 0.7), (6.0, 0.4), (12.0, 0.3))):
    """Emission-only pass with exactly render()'s framing. Returns (core rgb, glow rgba float).
    The plant's own silhouette is kept as opaque black under the glow, so when the game bakes the
    glow art over the ground's glow, the plant hides the glowing veins beneath it (black adds no light)."""
    V, F, Nv, A = S.arrays()
    E = np.concatenate(S.E)
    V = V * scale
    W = size * ss
    sx0 = V[:, 0]
    sy0 = -(V[:, 1] * r3d.SE + V[:, 2] * r3d.CE)
    cxb = (sx0.min() + sx0.max()) / 2 + offset[0]
    cyb = (sy0.min() + sy0.max()) / 2 + offset[1]
    px = (sx0 - cxb) * ss + W / 2
    py = (sy0 - cyb) * ss + W / 2
    pz = V[:, 1] * r3d.CE - V[:, 2] * r3d.SE
    fidx, b0, b1, depth = r3d.rasterize(px, py, pz, F, W, W)
    m = fidx >= 0
    Ei = r3d.interp(E, F, fidx, b0, b1, m)
    g = Ei[:, :3]
    mode = np.rint(Ei[:, 3]).astype(int)
    if (mode == 1).any():
        UV = r3d.interp(A[:, [I_U, I_V]], F, fidx, b0, b1, m)
        uu, vv = UV[:, 0], UV[:, 1]
        mid = np.exp(-(vv / 0.09) ** 2) * (uu < 0.97)
        ph = uu * 7.0 - np.abs(vv) * 1.3
        d = np.abs((ph % 1.0) - 0.5)
        lat = np.exp(-(d / 0.075) ** 2) * smoothstep(0.08, 0.3, np.abs(vv)) * (1 - np.abs(vv) ** 3) * smoothstep(0.02, 0.15, uu)
        vein = np.clip(np.maximum(mid, lat * 0.75), 0, 1)
        g[mode == 1] *= vein[mode == 1, None]
    if (mode == 2).any():
        Nn = nrm(r3d.interp(Nv, F, fidx, b0, b1, m))
        f = np.abs(Nn @ r3d.TO_CAM)
        g[mode == 2] *= (0.3 + 0.7 * f[mode == 2] ** 1.5)[:, None]
    img = np.zeros((W * W, 3))
    img[m] = g
    core = img.reshape(size, ss, size, ss, 3).mean((1, 3))
    cov = m.reshape(size, ss, size, ss).mean((1, 3))
    out = core.copy()
    for (s, k) in halo:
        out += k * np.stack([ndimage.gaussian_filter(core[..., c], s) for c in range(3)], -1)
    e = np.minimum(np.arange(size), np.arange(size)[::-1]).astype(float)
    out *= (smoothstep(1.0, 10.0, e)[:, None] * smoothstep(1.0, 10.0, e)[None, :])[..., None]  # halo never reaches the edge
    ga = np.clip(out.max(-1), 0, 1)
    glow_rgb = np.clip(out / np.maximum(ga, 1e-4)[..., None], 0, 1)
    A = ga + cov * (1 - ga)
    rgb = np.clip(glow_rgb * (ga / np.maximum(A, 1e-4))[..., None], 0, 1)
    return core, np.concatenate([rgb, A[..., None]], -1)


def render_plant(S, i, scale, offset=(0.0, 0.0), day_glow=0.3):
    res, st = render(S, 'alien', seed=i, scale=scale, offset=offset, out=None, info=False)
    core, glow = render_glow(S, scale=scale, offset=offset)
    day = np.asarray(res).astype(float) / 255
    k = np.clip(core * day_glow, 0, 1) * (day[..., 3:4] > 0.5)
    day[..., :3] = 1 - (1 - day[..., :3]) * (1 - k)
    Image.fromarray((day * 255 + 0.5).astype(np.uint8), 'RGBA').save(f'{OUT}/plant-{i}.png')
    Image.fromarray((glow * 255 + 0.5).astype(np.uint8), 'RGBA').save(f'{OUT}/plant-{i}-glow.png')
    a = (day[..., 3] * 255 + 0.5).astype(int)
    ga = (glow[..., 3] * 255 + 0.5).astype(int)
    edge = max(a[0].max(), a[-1].max(), a[:, 0].max(), a[:, -1].max())
    gedge = max(ga[0].max(), ga[-1].max(), ga[:, 0].max(), ga[:, -1].max())
    print(f"plant-{i}: body {st['w']:.2f} x {st['h']:.2f} of canvas, margin {st['margin']} px, edge alpha {edge}/{gedge}, "
          f"height {st['hmax']:.0f}, {st['tris']} tris")


# ============================================================================ plants

def m1_mushroom(seed=1):
    """A giant mushroom tree: a broad, spotted magenta cap with glowing gills peeking out round its rim."""
    rng = np.random.default_rng(seed)
    S = GScene()
    H, R = 58.0, 62.0
    stalk = np.array([[0, 0, 0], [1.5, 0.5, H * 0.35], [2.5, 1.5, H * 0.7], [3, 2, H]], float)
    add_tube(S, stalk, 10, 6.5, nseg=12, col='#b8a2cc', col_tip='#d8c8e4', mat=3, spec=0.1)
    for k in range(6):  # root flare
        a = 2 * np.pi * k / 6 + rng.uniform(-0.2, 0.2)
        sp, _ = arc_spine((np.cos(a) * 6, np.sin(a) * 6, 8), a, 16, np.radians(-30), np.radians(-10), 6)
        add_tube(S, sp, 3.5, 1.5, nseg=7, col='#a890be', mat=3)
    cz = H + 1.0
    # gills: a thin ribbed disc just under the cap, a little wider than it, glowing gold and pink
    ribs = lambda u, v, V: lerpc('#8a4a7a', '#a0507e', smoothstep(0.3, 1.0, u)) * (0.75 + 0.25 * np.cos(v * 2 * np.pi * 60))[:, None]
    with S.glowing(lambda u, v, V: lerpc(GOLD, PINK, smoothstep(0.55, 0.95, np.hypot(V[:, 0] - 3, V[:, 1] - 2) / R))
                   * (0.55 + 0.45 * np.cos(v * 2 * np.pi * 60))[:, None], k=1.7):
        oriented_blob(S, (3, 2, cz - 3.0), (R * 1.035, R * 1.035, 2.4), col=ribs, mat=0, spec=0.1, zmin=None, nu=10, nv=240)
    # cap: a low dome, darker in the middle, lighter magenta toward the rim
    capc = lambda u, v, V: lerpc('#7a2468', '#c04c92', smoothstep(0.05, 0.98, np.hypot(V[:, 0] - 3, V[:, 1] - 2) / R)) * \
        (1 + 0.06 * np.sin(np.arctan2(V[:, 1] - 2, V[:, 0] - 3) * 23))[:, None]
    disp = lambda d: 0.012 * np.sin(d[:, 0] * 9 + d[:, 1] * 7) + 0.012 * np.sin(np.arctan2(d[:, 1], d[:, 0]) * 11)
    CH = 27.0
    with S.glowing(lambda u, v, V: lerpc('#c050d0', PINK, smoothstep(0.3, 1.0, np.hypot(V[:, 0] - 3, V[:, 1] - 2) / R)),
                   mode=2, k=0.22):
        oriented_blob(S, (3, 2, cz), (R, R * 0.97, CH), col=capc, mat=0, spec=0.3, gloss=30, disp=disp,
                      zmin=cz - 1.5, nu=26, nv=56)
    # pale warts / spots, some of them glowing faintly
    for q in range(18):
        while True:
            x, y = rng.uniform(-1, 1, 2) * R * 0.88
            if np.hypot(x, y) < R * 0.86:
                break
        rr = np.hypot(x, y) / R
        z = cz + CH * np.sqrt(max(0, 1 - rr ** 2)) * (1 - 0.012) - 0.2
        r = rng.uniform(4.0, 8.5) * (1 - 0.35 * rr)
        gl = rng.uniform() < 0.75
        with S.glowing(rng.choice([VIOLET, PINK]), k=1.4 if gl else 0.0):
            nz = np.array([x / R ** 2, y / R ** 2, np.sqrt(max(0, 1 - rr ** 2)) / CH])
            tilt = np.arccos(np.clip(nrm(nz)[2], -1, 1))
            oriented_blob(S, (x + 3, y + 2, z), (r * 0.22, r * rng.uniform(0.75, 1.0), r), yaw=np.arctan2(y, x), pitch=np.pi / 2 - tilt,
                          col=lerpc('#f4d8f0', '#e4bce8', rng.uniform()), mat=0, spec=0.15, zmin=None, nu=8, nv=16)
    # a couple of small mushrooms at its foot, the near one in front of the cap
    for (x, y, h, r, cc) in [(-50, -48, 14, 9, '#9a3a9a'), (-34, -60, 10, 6.5, '#a8429a')]:
        add_tube(S, np.array([[x, y, 0], [x, y, h * 0.5], [x + 0.5, y, h]], float), 2.0, 1.5, nseg=7, col='#d0c0dc', mat=3)
        with S.glowing(GOLD, k=0.9):
            oriented_blob(S, (x + 0.5, y, h - 1.2), (r * 1.04, r * 1.04, 1.2), col='#f0c878', mat=0, zmin=None, nu=6, nv=40)
        oriented_blob(S, (x + 0.5, y, h), (r, r, r * 0.5), col=cc, mat=0, spec=0.3, gloss=28, zmin=h - 0.6, nu=10, nv=16)
        with S.glowing(PINK, k=0.6):
            for q in range(4):
                a = rng.uniform(0, 2 * np.pi)
                d = rng.uniform(0.2, 0.6) * r
                oriented_blob(S, (x + 0.5 + d * np.cos(a), y + d * np.sin(a), h + r * 0.5 * np.sqrt(1 - (d / r) ** 2) - 0.2),
                              (1.1, 1.1, 0.5), col='#f8d0f0', mat=0, zmin=None, nu=5, nv=8)
    return S


def coral_tube(S, rng, base, h, r, lean, cols):
    n = 12
    t = np.linspace(0, 1, n)
    bx, by = base
    lx, ly = lean
    sp = np.stack([bx + lx * t ** 1.5 * h, by + ly * t ** 1.5 * h, h * t], -1)
    rad = r * (0.72 + 0.12 * np.sin(np.pi * t) + 0.36 * smoothstep(0.65, 1.0, t))
    V, F, u, v = tube(sp, rad, 16)
    c = lerpc(cols[0], cols[1], smoothstep(0.0, 1.0, u))
    c = c * (0.86 + 0.14 * np.cos(v * 2 * np.pi * 8))[:, None]
    S.add(V, F, attrs(len(V), c, col2=cols[2], u=u, v=v, mat=2, spec=0.22, gloss=24))
    T = nrm(sp[-1] - sp[-2])
    e1 = nrm(np.cross(T, [0, 0, 1.0]) if abs(T[2]) < 0.99 else np.array([1.0, 0, 0]))
    e2 = np.cross(T, e1)
    ang = np.linspace(0, 2 * np.pi, 25)
    ring = sp[-1] + rad[-1] * (np.cos(ang)[:, None] * e1 + np.sin(ang)[:, None] * e2)
    with S.glowing(PINK, k=1.0):
        add_tube(S, ring, 1.6, 1.6, nseg=6, col='#ffb8e0', mat=0, spec=0.3, gloss=30)
    Vm, Fm, um, vm = blob((0, 0, 0), (rad[-1] * 0.95, rad[-1] * 0.95, 0.6), 8, 16)
    Rm = np.stack([e1, e2, T], 1)
    Vm = Vm @ Rm.T + sp[-1] - T * 2.5
    with S.glowing(VIOLET, mode=2, k=0.4):
        S.add(Vm, Fm, attrs(len(Vm), '#3a0e3e', mat=0, spec=0.0))


def m2_corals(seed=2):
    """A clump of pink tube-corals of different heights, rimmed in light, on a spongy violet mat."""
    rng = np.random.default_rng(seed)
    S = GScene()
    rf = lobed(40, rng, k=5, amp=(0.05, 0.12), fmax=5)

    def hf(x, y):
        r = np.hypot(x, y) / 54
        P = np.stack([x, y, np.zeros_like(x)], -1).reshape(-1, 3)
        return 5.0 * np.clip(1 - r ** 2, 0, 1) + 1.2 * sinnoise(P, 21, freq=0.5, n=12).reshape(x.shape) + 1.2
    V, F, u, v = patch((0, 0), rf, hf, step=1.2, edge=5)
    S.add(V, F, attrs(len(V), '#6a4896', col2='#9476c0', u=u, v=v, mat=4, spec=0.04, gloss=8))
    tubes = [(0, 4, 50, 11), (-20, 14, 40, 9.5), (18, 18, 36, 9), (-8, -18, 30, 9), (22, -12, 26, 8), (-30, -8, 22, 7.5),
             (34, 8, 18, 6.5), (-34, 26, 16, 6.5), (6, 34, 24, 7.5), (2, -36, 15, 6), (-18, -34, 12, 5.5), (36, -28, 12, 5.5)]
    pal = [('#6a2a6a', '#e0609e', '#c24a8a'), ('#702a64', '#ea70aa', '#c4508e'), ('#5e2a70', '#d45aa8', '#b24896')]
    for k, (x, y, h, r) in enumerate(tubes):
        d = np.array([x, y], float)
        lean = d / (np.linalg.norm(d) + 1e-6) * rng.uniform(0.12, 0.28) if np.hypot(x, y) > 1 else np.array([0.04, -0.06])
        coral_tube(S, rng, (x, y), h, r, lean, pal[k % 3])
    # a few tiny pink polyps on the mat
    for q in range(16):
        a = rng.uniform(0, 2 * np.pi)
        d = rng.uniform(20, 48)
        with S.glowing(PINK, k=0.5):
            oriented_blob(S, (d * np.cos(a), d * np.sin(a), 2.5), (1.8, 1.8, 2.2), col='#f2a0cc', mat=0, spec=0.3, zmin=None,
                          nu=6, nv=8)
    return S


def spiral_tendril(S, rng, yaw, r0, z0, coil, turns, thick, cols, bulb):
    d = np.array([np.cos(yaw), np.sin(yaw), 0.0])
    tdir = np.array([-np.sin(yaw), np.cos(yaw), 0.0]) * rng.choice([-1, 1])
    z = np.array([0, 0, 1.0])
    # the stalk: up and out from the centre
    s = np.linspace(0, 1, 14)
    P1 = d * r0 + z * z0
    stalk = np.stack([d * r0 * si ** 1.2 + z * (4 + (z0 - 4) * np.sin(np.pi / 2 * si) ** 0.9) for si in s])
    stalk[-1] = P1
    # the coil: an inward spiral in a gently tilted plane, rising a little toward the tip
    Cc = P1 + d * coil
    e1 = nrm(P1 - Cc)
    e2 = tdir
    n = 40
    t = np.linspace(0, 1, n)
    th = turns * 2 * np.pi * t
    rho = coil * (1 - 0.82 * t ** 0.9)
    up = np.array([0, 0, 1.0]) * (0.45 * coil * t + 0.25 * coil * np.sin(np.pi * t))[:, None]
    tilt = nrm(np.cross(e1, e2))
    if tilt[2] < 0:
        tilt = -tilt
    sp = Cc + rho[:, None] * (np.cos(th)[:, None] * e1 + np.sin(th)[:, None] * e2) + up + tilt * 0
    spine = np.concatenate([stalk, sp[1:]], 0)
    m = len(spine)
    radius = thick * (1 - 0.6 * np.linspace(0, 1, m) ** 1.2)
    V, F, u, v = tube(spine, radius, 9)
    c = lerpc(cols[0], cols[1], smoothstep(0.35, 1.0, u))
    c = c * (1 - 0.15 * (np.cos(u * m * 1.3) > 0.6))[:, None]
    with S.glowing(lambda u, v, V: lerpc('#000000', PINK, smoothstep(0.7, 1.0, u)), k=0.8):
        S.add(V, F, attrs(len(V), c, u=u, v=v, mat=0, spec=0.3, gloss=28))
    with S.glowing(bulb[1], mode=2, k=2.2):
        oriented_blob(S, spine[-1] + np.array([0, 0, 1.5]), (bulb[2], bulb[2], bulb[2] * 1.05), col=bulb[0], mat=0, spec=0.5,
                      gloss=40, trans=0.5, zmin=None, nu=10, nv=14)


def m3_spirals(seed=3):
    """Coiled violet tendrils rising from a low leaf rosette, each curled tip holding a glowing bulb."""
    rng = np.random.default_rng(seed)
    S = GScene()
    for k in range(8):
        yaw = 2 * np.pi * k / 8 + rng.uniform(-0.15, 0.15)
        add_leaf(S, (0, 0, 3), yaw, rng.uniform(30, 38), rng.uniform(10, 13), np.radians(22), np.radians(-14), shape='broad',
                 n=12, ncross=7, fold=0.25, col='#5a2e6e', col_tip='#7a3e86', col2='#b064b0', mat=1, spec=0.2, trans=0.2,
                 gloss=26, yaw1=yaw + rng.uniform(-0.25, 0.25))
    cols = ('#7a3c9e', '#e08ac8')
    bulbs = [('#ffe6a8', GOLD, 6.6), ('#ffe0a0', GOLD, 6.0), ('#ffd8f0', PINK, 5.8), ('#d8fbff', AQUA, 4.4),
             ('#ffe6a8', GOLD, 6.2), ('#ffd8f0', PINK, 5.6), ('#ffe0a0', GOLD, 5.4)]
    nt = 7
    for k in range(nt):
        yaw = 2 * np.pi * k / nt + rng.uniform(-0.2, 0.2) + 0.3
        spiral_tendril(S, rng, yaw, rng.uniform(22, 32), rng.uniform(24, 40), rng.uniform(15, 19), rng.uniform(1.4, 1.75),
                       rng.uniform(2.0, 2.4), cols, bulbs[k % len(bulbs)])
    # a central fiddlehead
    spiral_tendril(S, rng, 1.0, 4, 34, 9, 1.6, 2.2, cols, ('#ffe6a8', GOLD, 4.2))
    return S


def m4_lanterns(seed=4):
    """Translucent, ribbed lantern pods on curving stems over a rosette of dark leaves; lit from within."""
    rng = np.random.default_rng(seed)
    S = GScene()
    for k in range(7):
        yaw = 2 * np.pi * k / 7 + rng.uniform(-0.15, 0.15)
        add_leaf(S, (0, 0, 2), yaw, rng.uniform(36, 46), rng.uniform(9, 12), np.radians(20), np.radians(-16), shape='lance',
                 n=12, ncross=7, fold=0.3, col='#2e1c4c', col_tip='#4a2c6e', col2='#6a3a8a', mat=1, spec=0.2, trans=0.2,
                 gloss=24, yaw1=yaw + rng.uniform(-0.3, 0.3))
    # a central stalk; arching stems carry the pods, which hang ribbed and translucent like paper lanterns
    Hc = 64.0
    add_tube(S, np.array([[0, 0, 0], [0.5, 0.3, Hc * 0.5], [1, 0.6, Hc]], float), 2.6, 1.6, nseg=7, col='#4a2c66', mat=3)
    pods = [(-30, 8, 30, 11.5, 0.22), (26, 16, 34, 11, 0.2), (-14, -26, 26, 11, 0.25), (22, -22, 24, 10.5, 0.25),
            (-38, -18, 18, 8.5, 0.3), (40, -4, 20, 8.5, 0.3), (2, 32, 36, 10, 0.18), (2, 2, 44, 12.5, 0.05)]
    pal = [('#f8bcd4', '#e070a8'), ('#f8c8b8', '#e47c9c'), ('#f2b4e0', '#cc62ae')]
    for k, (x, y, h, r, tilt) in enumerate(pods):
        yaw = np.arctan2(y, x) if np.hypot(x, y) > 3 else -1.2
        c0, c1 = pal[k % 3]
        ax = np.array([np.cos(yaw) * np.sin(tilt), np.sin(yaw) * np.sin(tilt), np.cos(tilt)])
        top = np.array([x, y, h]) + ax * r * 1.22
        q = np.linspace(0, 1, 14)[:, None]
        p0, p2 = np.array([1, 0.6, Hc - 3]), top + np.array([0, 0, 0.8])
        p1 = np.array([p2[0] * 0.65, p2[1] * 0.65, Hc + 8 + 0.15 * np.hypot(x, y)])
        st = (1 - q) ** 2 * p0 + 2 * (1 - q) * q * p1 + q ** 2 * p2
        add_tube(S, st, 1.4, 0.9, nseg=6, col='#5a3474', col_tip='#8a5aa4', mat=3)
        ribs = lambda u, v, V, c0=c0, c1=c1: lerpc(c0, c1, smoothstep(0.0, 1.0, u)) * \
            (0.7 + 0.3 * np.abs(np.cos(v * np.pi * 8)) ** 0.6)[:, None]
        glowc = lambda u, v, V: lerpc(GOLD, ORANGE, 0.3) * (0.65 + 0.35 * np.abs(np.cos(v * np.pi * 8)) ** 0.5)[:, None] * \
            np.sin(np.pi * np.clip(u, 0.05, 0.95))[:, None] ** 0.6
        with S.glowing(glowc, mode=2, k=1.1):
            oriented_blob(S, (x, y, h), (r, r, r * 1.22), pitch=-tilt, yaw=yaw, col=ribs, mat=0, spec=0.45, gloss=34,
                          trans=0.7, zmin=None, nu=16, nv=32)
        # the calyx cap on top
        oriented_blob(S, top - ax * 0.6, (r * 0.36, r * 0.36, 1.8), pitch=-tilt, yaw=yaw, col='#7a3e92', mat=0, spec=0.2,
                      zmin=None, nu=8, nv=12)
    return S


def curl_frond(S, rng, origin, yaw, L, W, pitch0, pitch1, curl, cols, n=26):
    s = np.linspace(0, 1, n)
    pitch = pitch0 + (pitch1 - pitch0) * s ** 0.8
    yw = yaw + curl * s ** 2.2
    dd = np.stack([np.cos(pitch) * np.cos(yw), np.cos(pitch) * np.sin(yw), np.sin(pitch)], -1)
    pts = np.zeros((n, 3))
    pts[0] = origin
    pts[1:] = np.asarray(origin, float) + np.cumsum((dd[:-1] + dd[1:]) * 0.5 * L / (n - 1), 0)
    pts[:, 2] = np.maximum(pts[:, 2], 1.5)
    w = W * (1 - s) ** 0.7 * (0.65 + 0.35 * np.sin(np.pi * np.clip(s * 1.4, 0, 1))) + 0.4
    roll = np.sin(s * np.pi * 1.5) * 0.5 * np.sign(curl)
    V, F, u, v = ribbon(pts, w, yaws=yw, ncross=7, fold=0.35, roll=roll, droop_edges=0.1)
    c = lerpc(cols[0], cols[1], smoothstep(0.35, 1.0, u))
    c = c + (C(cols[2]) - c) * (smoothstep(0.75, 1.0, np.abs(v)) * 0.5)[:, None]
    with S.glowing(lambda u, v, V: lerpc('#000000', ORANGE, smoothstep(0.8, 1.0, u)), k=0.45):
        S.add(V, F, attrs(len(V), c, col2=cols[1], u=u, v=v, mat=0, spec=0.3, gloss=28, trans=0.3))
    # suckers along the top
    with S.glowing(PINK, k=1.1):
        for i in range(3, n - 3, 2):
            p = pts[i] + np.array([0, 0, 1.0 + 0.4 * w[i] * 0.35])
            r = 0.9 + 0.9 * (1 - s[i])
            oriented_blob(S, p, (r, r, r * 0.6), col='#f8c8e8', mat=0, spec=0.3, zmin=None, nu=5, nv=8)


def m5_tentacles(seed=5):
    """Curling ribbon fronds, violet at the root shading to orange at the tips, with glowing suckers."""
    rng = np.random.default_rng(seed)
    S = GScene()
    oriented_blob(S, (0, 0, 4), (10, 10, 7), col='#3a2058', mat=2, col2='#5a3478', spec=0.1, zmin=0.5)
    nf = 10
    for k in range(nf):
        yaw = 2 * np.pi * k / nf + rng.uniform(-0.12, 0.12)
        curl = rng.choice([-1, 1]) * rng.uniform(1.6, 2.6)
        cols = ('#4a2478', '#e88a3a', '#7a3a9a') if k % 2 else ('#5a2a86', '#f09a44', '#8a42a6')
        curl_frond(S, rng, (np.cos(yaw) * 5, np.sin(yaw) * 5, 6), yaw, rng.uniform(52, 64), rng.uniform(9.5, 11.5),
                   np.radians(rng.uniform(45, 62)), np.radians(rng.uniform(-35, -15)), curl, cols)
    for k in range(3):  # young fronds, still curled, in the middle
        yaw = 2 * np.pi * k / 3 + 0.4
        sp, _ = arc_spine((np.cos(yaw) * 2, np.sin(yaw) * 2, 8), yaw, 14, np.radians(80), np.radians(-200), 14)
        with S.glowing(ORANGE, k=0.35):
            add_tube(S, sp, 3.0, 1.6, nseg=9, col='#7a3aa0', col_tip='#f0a050', mat=0, spec=0.3, gloss=28)
    return S


def petal(S, origin, yaw, L, W, pitch0, pitch1, body, rim, vein, yaw1=None, roll=0.0, n=16, ncross=15):
    sp, yws = arc_spine(origin, yaw, L, pitch0, pitch1, n, yaw1=yaw1)
    s_ = np.linspace(0, 1, n)
    w = leaf_width(s_, W, 'broad')
    V, F, u, v = ribbon(sp, w, yaws=yws, ncross=ncross, fold=0.3, roll=roll, droop_edges=0.08)
    edge = np.maximum(smoothstep(0.62, 0.98, np.abs(v)), smoothstep(0.78, 1.0, u))
    c = lerpc(body, lerpc(body, '#ffffff', 0.12), smoothstep(0.2, 0.8, u))
    c = c + (C(rim) - c) * edge[:, None]
    S.add(V, F, attrs(len(V), c, col2=vein, u=u, v=v, mat=1, spec=0.28, trans=0.35, gloss=30))


def m6_fans(seed=6):
    """Two fans of broad, veined petal-leaves, magenta edged and tipped with gold, around a curled bud."""
    rng = np.random.default_rng(seed)
    S = GScene()
    fans = [(np.radians(-105), np.radians(175), 9, 70, 23, (-4, 6)), (np.radians(75), np.radians(140), 7, 56, 20, (4, -2))]
    bodies = ['#a42470', '#b42e7a', '#962266', '#bc3a82']
    for (dirn, spread, nl, L, Wd, (ox, oy)) in fans:
        for k in range(nl):
            f = k / (nl - 1) - 0.5
            yaw = dirn + f * spread + rng.uniform(-0.05, 0.05)
            Lk = L * (1 - 0.2 * abs(f) * 2) * rng.uniform(0.94, 1.04)
            with S.glowing(lerpc(GOLD, PINK, 0.3), mode=1, k=1.5):
                petal(S, (ox, oy, 6), yaw, Lk, Wd * rng.uniform(0.9, 1.05), np.radians(rng.uniform(40, 52)),
                      np.radians(rng.uniform(-24, -10)), bodies[k % 4], '#e8b040', '#f0c860',
                      yaw1=yaw + rng.uniform(-0.15, 0.15), roll=rng.uniform(-0.12, 0.12))
    # inner, younger petals standing more upright
    for k in range(5):
        yaw = 2 * np.pi * k / 5 + 0.3
        with S.glowing(lerpc(GOLD, PINK, 0.3), mode=1, k=1.5):
            petal(S, (0, 2, 7), yaw, 28, 11, np.radians(70), np.radians(30), '#c8408a', '#f0b84a', '#f6cc5c', n=10, ncross=11)
    # the curled gold bud in the middle
    sp, _ = arc_spine((0, 2, 8), 0.8, 18, np.radians(85), np.radians(-140), 14)
    with S.glowing(GOLD, k=0.7):
        add_tube(S, sp, 3.2, 1.8, nseg=9, col='#e0a840', col_tip='#f4d070', mat=0, spec=0.35, gloss=30)
    return S


SCALE = [1.42, 2.1, 1.6, 1.95, 1.95, 1.8]
OFFSET = [(10, 12), (4, 6), (6, 20), (4, 6), (2, 4), (2, 8)]
DAYGLOW = [0.18, 0.3, 0.21, 0.42, 0.22, 0.16]
PLANTS = [m1_mushroom, m2_corals, m3_spirals, m4_lanterns, m5_tentacles, m6_fans]

if __name__ == '__main__':
    import os
    os.makedirs(OUT, exist_ok=True)
    scales = {}
    which = []
    for a in sys.argv[1:]:
        if '=' in a:
            k, v = a.split('=')
            scales[int(k)] = float(v)
            which.append(int(k))
        else:
            which.append(int(a))
    for i in (which or range(1, 7)):
        S = PLANTS[i - 1]()
        render_plant(S, i, scales.get(i, SCALE[i - 1]), OFFSET[i - 1], DAYGLOW[i - 1])

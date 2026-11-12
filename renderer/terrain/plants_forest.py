"""Forest decorative plants (the 'jungle' biome slot, shown as Forest): plant-1..6.

1 spruce, 2 a pair of young firs, 3 a broadleaf (oak-like) tree, 4 a birch trio,
5 a fallen mossy log with mushrooms, 6 a fern clump. Seen from the game's high camera, so the
crowns read as canopy from above, each kept inside its own tile with the shadow baked in.
"""
import sys
import numpy as np
from plants_common import *
from plants_jungle import leaves_on_ellipsoid

OUT = 'out/art/biomes/forest'

# A temperate forest's light: a touch brighter and cooler than the jungle's, green bounce light.
ENVS['forest'] = dict(sun=np.array([1.0, 0.96, 0.88]) * 0.95, sky=np.array([0.40, 0.47, 0.52]) * 0.62,
                      bounce=np.array([0.26, 0.32, 0.17]) * 0.42, shadow='#0d1608', shadow_op=0.55, snow='#ffffff')

BARK = '#4a3624'


def conifer(S, rng, base, H, R0, tiers=8, cols=('#1d3c27', '#22462c', '#285034'), tip='#4f8048', lean=(0, 0)):
    """A spruce: tiers of drooping, feathery branches (a dark spray with paired needle tufts), each
    tier a little smaller and lighter, narrowing to a spike: a layered star from above."""
    bx, by = base
    lx, ly = lean
    trunk = np.array([[bx, by, 0], [bx + lx * 0.3, by + ly * 0.3, H * 0.4], [bx + lx * 0.7, by + ly * 0.7, H * 0.8],
                      [bx + lx, by + ly, H]], float)
    add_tube(S, trunk, max(2.2, R0 * 0.07), 0.8, nseg=7, col=BARK, mat=3)
    for t in range(tiers):
        f = t / tiers
        z = H * (0.1 + 0.82 * f)
        cx, cy = bx + lx * z / H, by + ly * z / H
        r = R0 * (1 - f) ** 0.95 + 5
        nb = int(round(8 + 6 * (1 - f)))
        off = rng.uniform(0, 2 * np.pi)
        shade = 0.35 * (1 - f)  # lower tiers sit in the upper tiers' shade
        for k in range(nb):
            yaw = off + 2 * np.pi * k / nb + rng.uniform(-0.12, 0.12)
            L = r * rng.uniform(0.86, 1.06)
            n = 12
            sp, yws = arc_spine((cx, cy, z), yaw, L, np.radians(rng.uniform(-4, 4)), np.radians(rng.uniform(-30, -20)), n)
            c = lerpc(cols[rng.integers(len(cols))], '#0a1a10', shade)
            ctip = lerpc(c, tip, 0.5 + 0.35 * (1 - f))
            add_tube(S, sp, 1.0, 0.4, nseg=5, col='#3b2a1a', mat=3)
            # a slim dark spray under the tufts so light doesn't show through
            add_leaf(S, sp[0] + np.array([0, 0, -0.4]), yaw, L * 0.98, L * 0.2 + 1.5, np.radians(-2), np.radians(-28),
                     shape='lance', n=8, ncross=3, fold=0.0, col=lerpc(c, '#08140c', 0.35), mat=0, spec=0.04, gloss=8,
                     yaw1=yws[-1])
            T = tangents(sp)
            for i in range(1, n):
                s_ = i / (n - 1)
                ph = np.arcsin(np.clip(T[i, 2], -1, 1))
                Lp = (L * 0.3 + 2.0) * (1 - 0.65 * s_) + 1.2
                cc = lerpc(c, ctip, s_ ** 1.3)
                for sg in (-1, 1):
                    add_leaf(S, sp[i] + np.array([0, 0, 0.3]), yws[i] + sg * np.radians(rng.uniform(42, 58)), Lp,
                             1.5 + 0.6 * (1 - s_), ph + 0.12, ph - 0.3, shape='lance', n=4, ncross=3, fold=0.3,
                             col=cc, col_tip=lerpc(cc, tip, 0.4), mat=0, spec=0.07, trans=0.18, gloss=12)
            # the branch tip: a fresh, lighter tuft
            add_leaf(S, sp[-2], yws[-1], 5 + L * 0.06, 2.0, ph, ph - 0.2, shape='lance', n=4, ncross=3,
                     col=ctip, col_tip=lerpc(ctip, '#9ac070', 0.3), mat=0, spec=0.08, trans=0.2)
    # the leader: a short spike of fresh growth on top
    for k in range(6):
        yaw = 2 * np.pi * k / 6 + rng.uniform(-0.3, 0.3)
        add_leaf(S, (bx + lx, by + ly, H - 4), yaw, 9, 2.4, np.radians(50), np.radians(30), shape='lance', n=5,
                 ncross=3, col=cols[1], col_tip=tip, mat=0, spec=0.08, trans=0.15)
    add_leaf(S, (bx + lx, by + ly, H - 6), 0.0, 14, 2.4, np.radians(88), np.radians(88), shape='lance', n=5, ncross=3,
             col=cols[1], col_tip=tip, mat=0, spec=0.08)


def f1_spruce(seed=11):
    rng = np.random.default_rng(seed)
    S = Scene()
    conifer(S, rng, (0, 0), 118, 62, tiers=9)
    return S


def f2_firs(seed=12):
    """Two young firs side by side, a bluer green, one taller than the other."""
    rng = np.random.default_rng(seed)
    S = Scene()
    blue = ('#1f3d33', '#244538', '#294d3e')
    conifer(S, rng, (-24, 14), 92, 38, tiers=7, cols=blue, tip='#5a8a64', lean=(-2, 1))
    conifer(S, rng, (26, -16), 74, 32, tiers=6, cols=('#203f2c', '#26492f', '#2b5236'), tip='#5c8a4c', lean=(2, -1))
    return S


def broadleaf(S, rng, base, H, R, cols, n_clumps=10, trunk=BARK, trunk_r=5.5, leaf_L=10, leaf_W=4.2, density=6.0):
    bx, by = base
    tr = np.array([[bx, by, 0], [bx + 1, by + 0.5, H * 0.35], [bx + 2, by + 1, H * 0.7], [bx + 2.5, by + 1.5, H]], float)
    add_tube(S, tr, trunk_r, trunk_r * 0.55, nseg=8, col=trunk, mat=3)
    for k in range(5):
        yaw = 2 * np.pi * k / 5 + rng.uniform(-0.3, 0.3)
        b = np.array([[bx + 2.5, by + 1.5, H * 0.9], [bx + 2.5 + R * 0.6 * np.cos(yaw), by + 1.5 + R * 0.6 * np.sin(yaw), H * 1.1]])
        b = np.stack([b[0] + (b[1] - b[0]) * t for t in np.linspace(0, 1, 4)])
        add_tube(S, b, trunk_r * 0.5, trunk_r * 0.25, nseg=6, col=trunk, mat=3)
    clumps = [((bx, by, H * 1.32), R * 0.62)]
    for k in range(n_clumps):
        a = 2 * np.pi * k / n_clumps + rng.uniform(-0.25, 0.25)
        rr = R * rng.uniform(0.55, 0.72)
        clumps.append(((bx + rr * np.cos(a), by + rr * np.sin(a), H * rng.uniform(1.0, 1.25)), R * rng.uniform(0.38, 0.48)))
    for (c, Rc) in clumps:
        oriented_blob(S, c, (Rc * 0.86, Rc * 0.86, Rc * 0.64), col=lerpc(cols[0], '#0c1a0a', 0.55), mat=0, spec=0.02,
                      zmin=None, nu=10, nv=14)
        leaves_on_ellipsoid(S, rng, c, (Rc, Rc, Rc * 0.78), int(Rc * density), leaf_L, leaf_W, cols,
                            lerpc(cols[0], '#0c1a0a', 0.3), zmin_frac=-0.3, tilt=0.7, shape='ovate', trans=0.3)


def f3_oak(seed=13):
    """A broad, rounded crown of mid-green leaves: the forest's leafy hardwood."""
    rng = np.random.default_rng(seed)
    S = Scene()
    broadleaf(S, rng, (0, 0), 44, 66, ['#355f27', '#3f6c2c', '#4a7a32', '#2f5624', '#578a3a', '#43722e'], n_clumps=11)
    return S


def f4_birches(seed=14):
    """Three slim birches: white trunks, light yellow-green crowns."""
    rng = np.random.default_rng(seed)
    S = Scene()
    cols = ['#6f9a3c', '#7da846', '#8cb34e', '#648f36', '#99bd58']
    for (bx, by, H, R) in [(-30, 18, 52, 30), (24, 26, 46, 26), (2, -26, 58, 32)]:
        broadleaf(S, rng, (bx, by), H, R, cols, n_clumps=6, trunk='#ddd8cc', trunk_r=2.6, leaf_L=7.5, leaf_W=3.4,
                  density=7.0)
        # dark bark marks on the white trunk
        for z in rng.uniform(4, H * 0.8, 5):
            oriented_blob(S, (bx + 0.4 * z / H, by + 0.2 * z / H, z), (2.9, 2.9, 0.8), col='#2a2620', mat=3, spec=0.05,
                          zmin=None, nu=6, nv=10)
    return S


def f5_log(seed=15):
    """A fallen, mossy log with bracket fungi, a few red toadstools and a fern at one end."""
    rng = np.random.default_rng(seed)
    S = Scene()
    a, b = np.array([-62.0, 10.0, 9.0]), np.array([56.0, -18.0, 8.0])
    sp = np.stack([a + (b - a) * t + np.array([0, 0, 1.5 * np.sin(np.pi * t)]) for t in np.linspace(0, 1, 14)])
    add_tube(S, sp, 10.5, 9.0, nseg=14, col='#4c3826', col_tip='#56402a', mat=3, spec=0.06)
    ax = (b - a) / np.linalg.norm(b - a)
    yaw = np.arctan2(ax[1], ax[0])
    # cut ends: pale wood with a dark rim
    for (p, r, s) in [(a, 10.5, -1), (b, 9.0, 1)]:
        oriented_blob(S, p + ax * s * 0.2, (0.8, r * 0.98, r * 0.98), yaw=yaw, col='#a8875a', mat=3, spec=0.05, zmin=None,
                      nu=8, nv=16)
        oriented_blob(S, p + ax * s * 0.6, (0.5, r * 0.55, r * 0.55), yaw=yaw, col='#8a6a44', mat=3, spec=0.05, zmin=None,
                      nu=6, nv=12)
    # moss along the top
    for k in range(9):
        t = rng.uniform(0.08, 0.9)
        p = a + (b - a) * t + np.array([0, 0, 8.5])
        oriented_blob(S, p, (rng.uniform(8, 14), rng.uniform(5, 8), 3.2), yaw=yaw + rng.uniform(-0.3, 0.3),
                      col=['#4a7a2c', '#55862f', '#3f6c28'][k % 3], mat=4, spec=0.03, gloss=8, zmin=None, nu=8, nv=12)
    # bracket fungi on the near side
    side = np.array([-ax[1], ax[0], 0.0])
    if side[1] > 0:
        side = -side
    for t in (0.3, 0.38, 0.62):
        p = a + (b - a) * t + side * 10 + np.array([0, 0, rng.uniform(2, 6)])
        oriented_blob(S, p, (6.5, 4.5, 1.6), yaw=np.arctan2(side[1], side[0]), col='#c9a46a', mat=0, spec=0.15,
                      zmin=None, nu=8, nv=12)
    # red toadstools with white spots in front of it
    for (x, y, h, r) in [(-14, -22, 9, 6.0), (-2, -28, 7, 4.6), (-24, -30, 6, 4.0)]:
        add_tube(S, np.array([[x, y, 0], [x, y, h * 0.5], [x, y, h]], float), 1.6, 1.3, nseg=6, col='#e8e0cc', mat=0)
        oriented_blob(S, (x, y, h + 1.0), (r, r, r * 0.55), col='#b8302a', mat=0, spec=0.35, gloss=30, zmin=h - 0.5,
                      nu=10, nv=14)
        for q in range(5):
            an = rng.uniform(0, 2 * np.pi)
            rr = rng.uniform(0.2, 0.7) * r
            oriented_blob(S, (x + rr * np.cos(an), y + rr * np.sin(an), h + 1.0 + r * 0.55 * np.sqrt(max(0, 1 - (rr / r) ** 2)) - 0.2),
                          (0.9, 0.9, 0.4), col='#f2ece0', mat=0, spec=0.1, zmin=None, nu=5, nv=8)
    # a small fern at the far end
    for k in range(6):
        yw = 2 * np.pi * k / 6 + rng.uniform(-0.2, 0.2)
        frond(S, rng, (60, 12, 2), yw, rng.uniform(22, 28), ('#2f6a2c', '#3a7a34'))
    return S


def frond(S, rng, base, yaw, L, cols, tip='#6aa452'):
    sp, yws = arc_spine(base, yaw, L, np.radians(rng.uniform(48, 60)), np.radians(rng.uniform(-28, -14)), 14,
                        yaw1=yaw + rng.uniform(-0.25, 0.25))
    add_tube(S, sp, 1.2, 0.35, nseg=5, col='#2a4a1e', col_tip='#3e6a2c', mat=3, spec=0.1)
    s = np.linspace(0, 1, len(sp))
    T = tangents(sp)
    base_c = cols[rng.integers(len(cols))]
    for i in range(2, len(sp) - 1):
        t = s[i]
        Lp = L * 0.24 * np.sin(np.pi * (t * 0.85 + 0.1)) ** 0.7 * (1 - 0.35 * t) + 1.5
        ph = np.arcsin(np.clip(T[i, 2], -1, 1))
        for sg in (-1, 1):
            add_leaf(S, sp[i], yws[i] + sg * np.radians(62), Lp, 2.9 * (1 - 0.3 * t) * L / 70 + 1.2, ph + 0.15, ph - 0.45,
                     shape='lance', n=5, ncross=3, fold=0.35, col=base_c, col_tip=tip, col2='#1f4424', mat=0, spec=0.14,
                     trans=0.35, gloss=22)


def f6_ferns(seed=16):
    """A bright clump of ferns with a couple of low huckleberry bushes."""
    rng = np.random.default_rng(seed)
    S = Scene()
    nf = 10
    for k in range(nf):
        yaw = 2 * np.pi * k / nf + rng.uniform(-0.15, 0.15)
        frond(S, rng, (0, 0, 3), yaw, rng.uniform(60, 74), ('#2f6a2a', '#377530', '#3f7f36'))
    for (x, y, r) in [(-46, -30, 15), (44, 34, 13)]:
        oriented_blob(S, (x, y, r * 0.55), (r * 0.9, r * 0.9, r * 0.55), col='#1c3a1c', mat=0, spec=0.02, zmin=0.5)
        leaves_on_ellipsoid(S, rng, (x, y, r * 0.55), (r, r, r * 0.7), int(r * 6), 5.5, 2.6,
                            ['#2f5a2a', '#386a30', '#2a5226'], '#1a3a1c', zmin_frac=-0.05)
        for q in range(7):
            d = nrm(rng.normal(size=3))
            d[2] = abs(d[2]) + 0.3
            d = nrm(d)
            oriented_blob(S, np.array([x, y, r * 0.55]) + np.array([r, r, r * 0.7]) * d, (1.4, 1.4, 1.4), col='#2c3a6a',
                          mat=0, spec=0.4, gloss=30, zmin=None, nu=6, nv=8)
    return S


SCALE = [1.45, 1.6, 1.22, 1.42, 1.45, 1.6]
# tall crowns cast long shadows to the lower right: shift those trees up-left so the shadow fits
OFFSET = [(4, 4), (4, 4), (14, 16), (12, 26), (0, 0), (0, 0)]
PLANTS = [f1_spruce, f2_firs, f3_oak, f4_birches, f5_log, f6_ferns]

if __name__ == '__main__':
    import os
    os.makedirs(OUT, exist_ok=True)
    args = sys.argv[1:]
    scales = {}
    which = []
    for a in args:
        if '=' in a:
            k, v = a.split('=')
            scales[int(k)] = float(v)
            which.append(int(k))
        else:
            which.append(int(a))
    for i in (which or range(1, 7)):
        S = PLANTS[i - 1]()
        render(S, 'forest', out=f'{OUT}/plant-{i}.png', seed=i, scale=scales.get(i, SCALE[i - 1]), offset=OFFSET[i - 1])

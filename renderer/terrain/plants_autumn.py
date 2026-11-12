"""Autumn Forest decorative plants: plant-1..6.

1 a maple with a red-orange crown, 2 a pair of golden birches, 3 an amber/russet oak, 4 a dark green
spruce (the evergreen contrast), 5 a fallen log under fallen leaves with mushrooms, 6 a low red shrub.
Built like the Forest set (plants_forest.py), lit by a warmer, lower autumn sun.
"""
import sys
import numpy as np
from plants_common import *
from plants_jungle import leaves_on_ellipsoid
from plants_forest import conifer, BARK

OUT = 'out/art/biomes/autumn'

# Autumn light: a warm, slightly low sun, cool sky fill and a warm bounce off the leaf litter.
ENVS['autumn'] = dict(sun=np.array([1.0, 0.93, 0.82]) * 0.97, sky=np.array([0.42, 0.46, 0.53]) * 0.6,
                      bounce=np.array([0.42, 0.29, 0.15]) * 0.42, shadow='#1a0e05', shadow_op=0.55, snow='#ffffff')

LITTER = ['#c8682a', '#d07a30', '#b05226', '#a04a24', '#c88a30', '#d4a038', '#8a6038', '#b03c28']


def crown_tree(S, rng, base, H, R, cols, dark, n_clumps=10, trunk=BARK, trunk_r=5.5, leaf_L=10, leaf_W=4.2,
               density=6.0, shape='ovate', clump_cols=None, n_limbs=5):
    """plants_forest.broadleaf with its own shade colour (the dark core under the leaves) and, optionally,
    a colour set per clump so a crown can be patchy (redder here, more orange there)."""
    bx, by = base
    tr = np.array([[bx, by, 0], [bx + 1, by + 0.5, H * 0.35], [bx + 2, by + 1, H * 0.7], [bx + 2.5, by + 1.5, H]], float)
    add_tube(S, tr, trunk_r, trunk_r * 0.55, nseg=8, col=trunk, mat=3)
    for k in range(n_limbs):
        yaw = 2 * np.pi * k / n_limbs + rng.uniform(-0.3, 0.3)
        b = np.array([[bx + 2.5, by + 1.5, H * 0.9], [bx + 2.5 + R * 0.6 * np.cos(yaw), by + 1.5 + R * 0.6 * np.sin(yaw), H * 1.1]])
        b = np.stack([b[0] + (b[1] - b[0]) * t for t in np.linspace(0, 1, 4)])
        add_tube(S, b, trunk_r * 0.5, trunk_r * 0.25, nseg=6, col=trunk, mat=3)
    clumps = [((bx, by, H * 1.32), R * 0.62)]
    for k in range(n_clumps):
        a = 2 * np.pi * k / n_clumps + rng.uniform(-0.25, 0.25)
        rr = R * rng.uniform(0.55, 0.72)
        clumps.append(((bx + rr * np.cos(a), by + rr * np.sin(a), H * rng.uniform(1.0, 1.25)), R * rng.uniform(0.38, 0.48)))
    for ci, (c, Rc) in enumerate(clumps):
        cc = cols if clump_cols is None else clump_cols[ci % len(clump_cols)]
        oriented_blob(S, c, (Rc * 0.86, Rc * 0.86, Rc * 0.64), col=lerpc(cc[0], dark, 0.6), mat=0, spec=0.02,
                      zmin=None, nu=10, nv=14)
        leaves_on_ellipsoid(S, rng, c, (Rc, Rc, Rc * 0.78), int(Rc * density), leaf_L, leaf_W, cc,
                            lerpc(cc[0], dark, 0.35), zmin_frac=-0.3, tilt=0.7, shape=shape, trans=0.32)


def a1_maple(seed=21):
    """A sugar maple ablaze: a round crown, scarlet in places and orange in others, gold where the sun hits."""
    rng = np.random.default_rng(seed)
    S = Scene()
    red = ['#c0261a', '#cc301c', '#b02018', '#d63c1e', '#c4321a']
    orange = ['#d04a1e', '#da5c24', '#c83e1c', '#e06e2a', '#cc4420']
    flame = ['#dc6424', '#e47c2e', '#d05020', '#e88c34', '#c8401c']
    crown_tree(S, rng, (0, 0), 44, 64, red, '#2a0606', n_clumps=11, leaf_L=10, leaf_W=4.6, shape='broad',
               clump_cols=[orange, red, red, flame, red, orange, red, flame, red, orange, red, flame],
               trunk='#4a3a2e')
    return S


def a2_birches(seed=22):
    """Two slim birches in golden yellow, white trunks with dark bark marks."""
    rng = np.random.default_rng(seed)
    S = Scene()
    gold = ['#d8a42c', '#e2b638', '#c8922a', '#ecc84e', '#d4a030', '#e8bc40']
    gold2 = ['#d09a28', '#dcae34', '#e6c048', '#c48a24', '#d8a830']
    for (bx, by, H, R, cc) in [(-26, 16, 58, 36, gold), (26, -18, 50, 32, gold2)]:
        crown_tree(S, rng, (bx, by), H, R, cc, '#3a2606', n_clumps=7, trunk='#ddd8cc', trunk_r=2.8, leaf_L=7.5,
                   leaf_W=3.4, density=7.0)
        for z in rng.uniform(4, H * 0.8, 5):
            oriented_blob(S, (bx + 0.4 * z / H, by + 0.2 * z / H, z), (3.1, 3.1, 0.8), col='#2a2620', mat=3, spec=0.05,
                          zmin=None, nu=6, nv=10)
    return S


def a3_oak(seed=23):
    """A broad old oak in amber and russet, with a little green still left low in the crown."""
    rng = np.random.default_rng(seed)
    S = Scene()
    russet = ['#94502a', '#a25c2e', '#844626', '#9a5a2a', '#ac6830']
    amber = ['#b47c36', '#c08a3a', '#a46e30', '#c89a42', '#9c6a2e']
    olive = ['#7e7234', '#6e6630', '#8a7a38', '#94763a']
    crown_tree(S, rng, (0, 0), 46, 70, russet, '#22120a', n_clumps=12, leaf_L=11, leaf_W=4.6, trunk='#4e3c2c',
               trunk_r=6.5, clump_cols=[amber, russet, amber, olive, russet, amber, russet, amber, olive, russet,
                                         amber, russet, amber], n_limbs=6)
    return S


def a4_spruce(seed=24):
    """A dark green spruce: the evergreen among the fall colours."""
    rng = np.random.default_rng(seed)
    S = Scene()
    conifer(S, rng, (0, 0), 118, 62, tiers=9, cols=('#1a3624', '#1f402a', '#244a30'), tip='#4a7844')
    return S


def flat_leaf(S, rng, p, col, L=None, z=None):
    """A fallen leaf lying (nearly) flat at p."""
    L = L or rng.uniform(6, 9)
    c = lerpc(col, '#000000', rng.uniform(0, 0.15))
    z = p[2] if z is None else z
    add_leaf(S, (p[0], p[1], z), rng.uniform(0, 2 * np.pi), L, L * rng.uniform(0.3, 0.42), np.radians(rng.uniform(-4, 8)),
             np.radians(rng.uniform(-8, 4)), shape='ovate', n=5, ncross=5, fold=0.2, roll=rng.normal() * 0.2,
             col=c, col2=lerpc(c, '#3a1a08', 0.4), mat=1, spec=0.12, trans=0.1, gloss=16)


def a5_log(seed=25):
    """A fallen log half-buried in leaves, moss on its back, honey fungus and a few toadstools beside it."""
    rng = np.random.default_rng(seed)
    S = Scene()
    a, b = np.array([-62.0, 10.0, 9.0]), np.array([56.0, -18.0, 8.0])
    sp = np.stack([a + (b - a) * t + np.array([0, 0, 1.5 * np.sin(np.pi * t)]) for t in np.linspace(0, 1, 14)])
    add_tube(S, sp, 11.5, 10.0, nseg=14, col='#7a6a58', col_tip='#857460', mat=3, spec=0.06)
    # strips of dark bark still clinging to the weathered wood
    for k in range(7):
        t0 = rng.uniform(0.05, 0.8)
        t1 = t0 + rng.uniform(0.08, 0.2)
        ang = rng.uniform(-2.4, 2.4)
        pts = []
        for t in np.linspace(t0, t1, 5):
            r = 11.5 + (10.0 - 11.5) * t + 0.3
            c = a + (b - a) * t + np.array([0, 0, 1.5 * np.sin(np.pi * t)])
            sd = np.array([-np.sin(np.arctan2(*(b - a)[1::-1])), np.cos(np.arctan2(*(b - a)[1::-1])), 0.0])
            pts.append(c + sd * np.sin(ang) * r + np.array([0, 0, np.cos(ang) * r]))
        add_tube(S, np.array(pts), 2.6, 2.2, nseg=6, col='#3e2e22', mat=3, spec=0.04)
    ax = (b - a) / np.linalg.norm(b - a)
    yaw = np.arctan2(ax[1], ax[0])
    for (p, r, s) in [(a, 11.5, -1), (b, 10.0, 1)]:
        oriented_blob(S, p + ax * s * 0.2, (0.8, r * 0.98, r * 0.98), yaw=yaw, col='#b8976a', mat=3, spec=0.05, zmin=None,
                      nu=8, nv=16)
        oriented_blob(S, p + ax * s * 0.6, (0.5, r * 0.55, r * 0.55), yaw=yaw, col='#8a6a44', mat=3, spec=0.05, zmin=None,
                      nu=6, nv=12)
    # a few moss pads along the top
    for k in range(5):
        t = rng.uniform(0.1, 0.9)
        p = a + (b - a) * t + np.array([0, 0, 9.5])
        oriented_blob(S, p, (rng.uniform(7, 11), rng.uniform(4.5, 6.5), 3.0), yaw=yaw + rng.uniform(-0.3, 0.3),
                      col=['#4a6a2a', '#56762e', '#3e5e26'][k % 3], mat=4, spec=0.03, gloss=8, zmin=None, nu=8, nv=12)
    # leaves fallen on the log's back
    side = np.array([-ax[1], ax[0], 0.0])
    for k in range(26):
        t = rng.uniform(0.05, 0.95)
        r = 11.5 + (10.0 - 11.5) * t
        ang = rng.uniform(-0.9, 0.9)
        p = a + (b - a) * t + np.array([0, 0, 1.5 * np.sin(np.pi * t)]) + side * np.sin(ang) * r + np.array([0, 0, np.cos(ang) * r + 0.6])
        flat_leaf(S, rng, p, LITTER[rng.integers(len(LITTER))], L=rng.uniform(6, 8.5))
    # a drift of leaves on the ground around it
    for k in range(70):
        t = rng.uniform(-0.1, 1.1)
        off = rng.normal() * 16
        p = a + (b - a) * t + side * (off + np.sign(off) * 11)
        flat_leaf(S, rng, p, LITTER[rng.integers(len(LITTER))], z=0.4 + rng.uniform(0, 0.8))
    # honey fungus: a clustered tuft of tan caps on the near side
    if side[1] > 0:
        side = -side
    for (t, n) in [(0.32, 7), (0.72, 5)]:
        c0 = a + (b - a) * t + side * 15
        for q in range(n):
            x, y = c0[0] + rng.normal() * 4.0, c0[1] + rng.normal() * 3.0
            h = rng.uniform(5, 8)
            r = rng.uniform(3.6, 5.0)
            add_tube(S, np.array([[x, y, 0], [x, y, h * 0.5], [x, y, h]], float), 0.9, 0.8, nseg=5, col='#d8c8a0', mat=0)
            oriented_blob(S, (x, y, h + 0.6), (r, r, r * 0.5), col='#c89650', mat=0, spec=0.2, gloss=24, zmin=h - 0.4,
                          nu=8, nv=12)
            oriented_blob(S, (x, y, h + 0.6 + r * 0.42), (r * 0.35, r * 0.35, 0.4), col='#6a4a28', mat=0, spec=0.1,
                          zmin=None, nu=5, nv=8)
    # two red toadstools with white spots
    for (x, y, h, r) in [(-30, -26, 8, 5.4), (-20, -32, 6, 4.0)]:
        add_tube(S, np.array([[x, y, 0], [x, y, h * 0.5], [x, y, h]], float), 1.5, 1.2, nseg=6, col='#e8e0cc', mat=0)
        oriented_blob(S, (x, y, h + 1.0), (r, r, r * 0.55), col='#b8302a', mat=0, spec=0.35, gloss=30, zmin=h - 0.5,
                      nu=10, nv=14)
        for q in range(5):
            an = rng.uniform(0, 2 * np.pi)
            rr = rng.uniform(0.2, 0.7) * r
            oriented_blob(S, (x + rr * np.cos(an), y + rr * np.sin(an), h + 1.0 + r * 0.55 * np.sqrt(max(0, 1 - (rr / r) ** 2)) - 0.2),
                          (0.9, 0.9, 0.4), col='#f2ece0', mat=0, spec=0.1, zmin=None, nu=5, nv=8)
    return S


def a6_redshrub(seed=26):
    """A low, spreading shrub in deep crimson and scarlet (blueberry / sumac red), a few dark berries."""
    rng = np.random.default_rng(seed)
    S = Scene()
    reds = ['#a01c24', '#b82628', '#8a1820', '#c83a2a', '#b02a22', '#d44a2e']
    for (x, y, r, h) in [(-14, 6, 34, 20), (26, -14, 26, 16), (-6, -26, 22, 13), (30, 22, 18, 11)]:
        oriented_blob(S, (x, y, h * 0.55), (r * 0.9, r * 0.9, h * 0.6), col='#2a0808', mat=0, spec=0.02, zmin=0.5)
        leaves_on_ellipsoid(S, rng, (x, y, h * 0.55), (r, r, h * 0.8), int(r * 7.5), 7.5, 3.4, reds, '#3a0a0c',
                            zmin_frac=-0.05, tilt=0.6, shape='ovate', trans=0.35)
        for q in range(int(r / 4)):
            d = nrm(rng.normal(size=3))
            d[2] = abs(d[2]) + 0.4
            d = nrm(d)
            oriented_blob(S, np.array([x, y, h * 0.55]) + np.array([r, r, h * 0.8]) * d, (1.4, 1.4, 1.4), col='#2a2a5a',
                          mat=0, spec=0.45, gloss=30, zmin=None, nu=6, nv=8)
    return S


SCALE = [1.22, 1.42, 1.14, 1.45, 1.4, 1.66]
# tall crowns cast long shadows to the lower right: shift those trees up-left so the shadow fits
OFFSET = [(14, 16), (12, 24), (14, 16), (4, 4), (0, 0), (2, 2)]
PLANTS = [a1_maple, a2_birches, a3_oak, a4_spruce, a5_log, a6_redshrub]

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
        render(S, 'autumn', out=f'{OUT}/plant-{i}.png', seed=i, scale=scales.get(i, SCALE[i - 1]), offset=OFFSET[i - 1])

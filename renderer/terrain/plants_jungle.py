"""Jungle decorative plants (plant-jungle-1..6)."""
import sys
import numpy as np
from plants_common import *

OUT = 'out/art/biomes/jungle'


def leaves_on_ellipsoid(S, rng, center, radii, count, L, Wd, cols, col2, zmin_frac=-0.1, tilt=0.55,
                        shape='ovate', mat=1, spec=0.22, trans=0.35):
    """Scatter leaves over an ellipsoid surface, each pointing outward, for bushy canopies."""
    center = np.asarray(center, float)
    for i in range(count):
        while True:
            d = nrm(rng.normal(size=3))
            if d[2] > zmin_frac:
                break
        p = center + np.asarray(radii) * d * rng.uniform(0.82, 1.0)
        yaw = np.arctan2(d[1], d[0]) + rng.normal() * 0.6
        el = np.arcsin(np.clip(d[2], -1, 1))
        p0 = el * tilt + rng.normal() * 0.3
        c = cols[rng.integers(len(cols))]
        Ll = L * rng.uniform(0.8, 1.2)
        add_leaf(S, p, yaw, Ll, Wd * rng.uniform(0.85, 1.15), p0 + 0.2, p0 - 0.35, shape=shape, n=6, ncross=5,
                 fold=0.3, roll=rng.normal() * 0.3, col=c, col_tip=lerpc(c, '#ffffff', 0.12), col2=col2, mat=mat,
                 spec=spec, trans=trans, gloss=24)


def p1_fern(seed=1):
    """A clump of broad fern fronds radiating from the centre."""
    rng = np.random.default_rng(seed)
    S = Scene()
    nf = 9
    for k in range(nf):
        yaw = 2 * np.pi * k / nf + rng.uniform(-0.15, 0.15)
        L = rng.uniform(64, 78)
        sp, yws = arc_spine((0, 0, 3), yaw, L, np.radians(rng.uniform(48, 60)), np.radians(rng.uniform(-28, -14)), 18,
                            yaw1=yaw + rng.uniform(-0.25, 0.25))
        add_tube(S, sp, 1.6, 0.4, nseg=5, col='#24401e', col_tip='#3a5e2a', mat=3, spec=0.1)
        s = np.linspace(0, 1, len(sp))
        T = tangents(sp)
        tone = rng.uniform(0, 1)
        for i in range(2, len(sp) - 1):
            t = s[i]
            Lp = 17 * np.sin(np.pi * (t * 0.85 + 0.1)) ** 0.7 * (1 - 0.35 * t) + 2
            pitch_here = np.arcsin(np.clip(T[i, 2], -1, 1))
            for sg in (-1, 1):
                py = yws[i] + sg * np.radians(62)
                base = lerpc('#1f4826', '#27522c', tone)
                add_leaf(S, sp[i], py, Lp, 3.4 * (1 - 0.3 * t), pitch_here + 0.15, pitch_here - 0.45, shape='lance',
                         n=6, ncross=3, fold=0.35, col=base, col_tip='#3c6e38', col2='#1f4424', mat=0,
                         spec=0.14, trans=0.3, gloss=22)
    # fiddleheads / young fronds in the middle
    for k in range(3):
        yaw = rng.uniform(0, 2 * np.pi)
        sp, _ = arc_spine((0, 0, 3), yaw, 16, np.radians(80), np.radians(-60), 10)
        add_tube(S, sp, 1.6, 1.2, nseg=6, col='#3a6a30', col_tip='#5a8a40', mat=3, spec=0.15)
    return S


def p2_leafrosette(seed=2):
    """A giant leaf rosette: big olive leaves with burgundy veins."""
    rng = np.random.default_rng(seed)
    S = Scene()
    nl = 6
    for k in range(nl):
        yaw = 2 * np.pi * k / nl + rng.uniform(-0.12, 0.12)
        add_leaf(S, (0, 0, 4), yaw, rng.uniform(70, 82), rng.uniform(21, 25), np.radians(36), np.radians(-14),
                 shape='broad', n=18, ncross=11, fold=0.18, droop_edges=0.12, roll=rng.uniform(-0.12, 0.12),
                 col='#454f20', col_tip='#535e26', col2='#5e1a2a', mat=1, spec=0.16, trans=0.2, gloss=30,
                 yaw1=yaw + rng.uniform(-0.2, 0.2))
    for k in range(3):
        yaw = 2 * np.pi * k / 3 + 0.5
        add_leaf(S, (0, 0, 6), yaw, 40, 13, np.radians(64), np.radians(30), shape='broad', n=12, ncross=9,
                 fold=0.3, col='#4c5824', col_tip='#5c6a2c', col2='#62202e', mat=1, spec=0.16, trans=0.2, gloss=30)
    return S


def p3_shrub(seed=3):
    """A flowering shrub with a few magenta and orange blossoms."""
    rng = np.random.default_rng(seed)
    S = Scene()
    oriented_blob(S, (0, 0, 14), (46, 44, 30), col='#1a3020', mat=0, spec=0.02, zmin=0.5)
    cols = ['#24502e', '#2c5a32', '#33623a', '#2a4e2c', '#3a6a3a']
    leaves_on_ellipsoid(S, rng, (0, 0, 14), (52, 50, 36), 230, 17, 5.2, cols, '#1a3a22', zmin_frac=-0.05)
    # blossoms on the upper half
    fl = [('#a3386e', '#d8b44a'), ('#c06a2c', '#e0c060'), ('#9c3468', '#d8b44a'), ('#b8622a', '#e0c060'),
          ('#a83c72', '#d8b44a'), ('#c47030', '#e0c060'), ('#9a3466', '#d8b44a')]
    for i, (pc, cc) in enumerate(fl):
        while True:
            d = nrm(rng.normal(size=3))
            if d[2] > 0.35:
                break
        c = np.array([0, 0, 14.0]) + np.array([52, 50, 36]) * d * 1.02
        nrmv = nrm(d * np.array([1 / 52, 1 / 50, 1 / 36]))
        el = np.arcsin(np.clip(nrmv[2], -1, 1))
        face_yaw = np.arctan2(nrmv[1], nrmv[0])
        for j in range(5):
            yaw = 2 * np.pi * j / 5 + rng.uniform(0, 1)
            # petals radiate in the plane facing the surface normal (approx: tilt toward the normal's yaw)
            pitch = (np.pi / 2 - el) * np.cos(yaw - face_yaw) * 0.8 + 0.25
            add_leaf(S, c, yaw, 10.5, 5.0, pitch, pitch - 0.25, shape='ovate', n=5, ncross=5, fold=0.4, col=pc,
                     col_tip=lerpc(pc, '#ffffff', 0.18), mat=0, spec=0.2, trans=0.4)
        oriented_blob(S, c + nrmv * 1.0, (2.8, 2.8, 2.0), col=cc, mat=0, spec=0.15, nu=8, nv=10, zmin=None)
    return S


def p4_tree(seed=4):
    """A small tree seen from above: a round, leafy canopy with darker shade underneath."""
    rng = np.random.default_rng(seed)
    S = Scene()
    trunk = np.array([[0, 0, 0], [1, 0.5, 12], [2, 1, 24], [2.5, 1.5, 34]], float)
    add_tube(S, trunk, 6, 3.5, nseg=8, col='#4a3a28', mat=3)
    for k in range(5):
        yaw = 2 * np.pi * k / 5
        b = np.array([[2.5, 1.5, 32], [2.5 + 26 * np.cos(yaw), 1.5 + 26 * np.sin(yaw), 38]])
        b = np.stack([b[0] + (b[1] - b[0]) * t for t in np.linspace(0, 1, 4)])
        add_tube(S, b, 3, 1.5, nseg=6, col='#4a3a28', mat=3)
    clumps = [((0, 0, 44), 30)]
    for k in range(8):
        a = 2 * np.pi * k / 8 + rng.uniform(-0.2, 0.2)
        r = rng.uniform(40, 48)
        clumps.append(((r * np.cos(a), r * np.sin(a), rng.uniform(30, 37)), rng.uniform(21, 26)))
    cols = ['#33602c', '#3c6a30', '#477634', '#2e5828', '#527e38']
    for (c, R) in clumps:
        oriented_blob(S, c, (R * 0.85, R * 0.85, R * 0.62), col='#173018', mat=0, spec=0.02, zmin=None, nu=10, nv=14)
        leaves_on_ellipsoid(S, rng, c, (R, R, R * 0.75), int(R * 6.5), 9, 3.4, cols, '#1d3a1e', zmin_frac=-0.35,
                            tilt=0.7, shape='lance', trans=0.25)
    return S


def p5_moss(seed=5):
    """A soft moss mat with tiny yellow-green spore heads."""
    rng = np.random.default_rng(seed)
    S = Scene()
    rf = lobed(46, rng, k=7, amp=(0.08, 0.2), fmax=8)

    def hf(x, y):
        r = np.hypot(x, y) / 50
        P = np.stack([x, y, np.zeros_like(x)], -1).reshape(-1, 3)
        n1 = sinnoise(P, 51, freq=0.12, n=12).reshape(x.shape)
        n2 = sinnoise(P, 52, freq=0.6, n=14).reshape(x.shape)
        return 6.5 * np.clip(1 - r ** 2, 0, 1) + 2.0 * n1 + 0.9 * n2 + 1.5
    V, F, u, v = patch((0, 0), rf, hf, step=1.0, edge=5)
    S.add(V, F, attrs(len(V), lerpc('#37501f', '#425c24', u), col2='#6a8434', u=u, v=v, mat=4, spec=0.04, gloss=8))
    # a smaller satellite cushion
    rf2 = lobed(15, rng, k=5)
    V, F, u, v = patch((44, -26), rf2, lambda x, y: 3.5 * np.clip(1 - (np.hypot(x, y) / 16) ** 2, 0, 1) + 1.2,
                       step=1.0, edge=4)
    S.add(V, F, attrs(len(V), '#3a5420', col2='#6a8434', u=u, v=v, mat=4, spec=0.04, gloss=8))
    # sporophytes: thin reddish stalks with yellow-green capsules
    for i in range(80):
        a = rng.uniform(0, 2 * np.pi)
        r = np.sqrt(rng.uniform(0, 1)) * 42
        x, y = r * np.cos(a), r * np.sin(a)
        z0 = float(hf(np.array([x]), np.array([y]))[0]) * 0.9
        h = rng.uniform(7, 12)
        lean = nrm(np.array([rng.normal() * 0.35, rng.normal() * 0.35, 1.0]))
        sp = np.stack([np.array([x, y, z0]) + lean * h * t for t in np.linspace(0, 1, 4)])
        add_tube(S, sp, 0.45, 0.35, nseg=4, col='#7a4a2c', col_tip='#8a5a30', mat=0, spec=0.1)
        oriented_blob(S, sp[-1] + lean * 1.5, (2.6, 1.8, 1.8), yaw=np.arctan2(lean[1], lean[0]),
                      pitch=np.arcsin(lean[2]), col='#b2ba50', mat=0, spec=0.3, gloss=30, nu=7, nv=9, zmin=None)
    return S


def p6_vines(seed=6):
    """A tangle of creeping vines with a couple of plump pitcher pods."""
    rng = np.random.default_rng(seed)
    S = Scene()
    for k in range(8):
        yaw = rng.uniform(0, 2 * np.pi)
        start = np.array([np.cos(yaw), np.sin(yaw), 0]) * rng.uniform(5, 25)
        L = rng.uniform(70, 100)
        n = 28
        s_ = np.linspace(0, 1, n)
        hd = yaw + np.pi + rng.uniform(-0.9, 0.9) + np.cumsum(rng.normal(size=n) * 0.16)
        d = np.stack([np.cos(hd), np.sin(hd), np.zeros(n)], -1)
        sp = start + np.cumsum(d * L / (n - 1), 0) - d[0] * L / (n - 1)
        sp[:, 2] = 1.3 + 2.2 * np.abs(np.sin(s_ * np.pi * rng.uniform(2, 4) + k)) * (1 - 0.5 * s_)
        add_tube(S, sp, 1.7, 0.9, nseg=6, col='#33421e', col_tip='#46582a', mat=3, spec=0.1)
        j = 1
        while j < n - 1:
            side = rng.choice([-1, 1])
            c = ['#224626', '#2c4e28', '#3a5424', '#284824'][rng.integers(4)]
            add_leaf(S, sp[j] + np.array([0, 0, 0.5]), hd[j] + side * rng.uniform(0.6, 1.3), rng.uniform(11, 16),
                     rng.uniform(5.5, 7.0), np.radians(rng.uniform(15, 35)), np.radians(rng.uniform(-12, 5)),
                     shape='heart', n=8, ncross=7, fold=0.25, col=c, col_tip=lerpc(c, '#ffffff', 0.1), col2='#1e3e20',
                     mat=1, spec=0.18, trans=0.25, gloss=26)
            j += int(rng.integers(2, 4))
    # pitcher pods
    for (px, py, yaw, sc) in [(-18, 8, np.radians(-125), 1.3), (22, -6, np.radians(-55), 1.1)]:
        lean = np.radians(42)
        ax = np.array([np.cos(yaw) * np.sin(lean), np.sin(yaw) * np.sin(lean), np.cos(lean)])
        H = 28 * sc
        n = 16
        t = np.linspace(0, 1, n)
        base = np.array([px, py, 7.0 * sc])
        sp = base + ax[None] * (H * t)[:, None]
        rad = sc * (7.5 * np.sin(np.pi * np.clip(t * 1.15 + 0.12, 0, 1)) ** 0.8 * (1 - 0.45 * t) + 3.2 + 2.0 * smoothstep(0.82, 1.0, t))
        V, F, u, v = tube(sp, rad, 14)
        colp = lerpc('#5e6e2e', '#7a2c2c', smoothstep(0.25, 0.8, u))
        S.add(V, F, attrs(len(V), colp, col2='#8e3c34', u=u, v=v, mat=2, spec=0.3, gloss=28))
        # peristome rim
        ang = np.linspace(0, 2 * np.pi, 20)
        e1 = nrm(np.cross(ax, [0, 0, 1.0]))
        e2 = np.cross(ax, e1)
        top = sp[-1]
        ring = top + rad[-1] * (np.cos(ang)[:, None] * e1 + np.sin(ang)[:, None] * e2)
        add_tube(S, ring, 1.3 * sc, 1.3 * sc, nseg=6, col='#5a1a1c', mat=0, spec=0.35, gloss=30)
        # dark mouth
        Vm, Fm, um, vm = blob((0, 0, 0), (rad[-1] * 0.95, rad[-1] * 0.95, 0.6), 8, 16)
        Rm = np.stack([e1, e2, ax], 1)
        Vm = Vm @ Rm.T + top - ax * 0.5
        S.add(Vm, Fm, attrs(len(Vm), '#170806', mat=0, spec=0.0))
        # lid
        add_leaf(S, top - e1 * rad[-1] * 0.2 + ax * 0.5, yaw + np.pi, 11 * sc, 5.5 * sc, np.radians(55), np.radians(20),
                 shape='heart', n=6, ncross=5, fold=0.3, col='#6a3a2c', col_tip='#7a3030', col2='#4a1a1a', mat=1,
                 spec=0.2, trans=0.2)
        # tendril linking to the vines
        tl = np.stack([base + np.array([0, 0, -3.5 * sc]), base + np.array([np.cos(yaw + np.pi) * 10, np.sin(yaw + np.pi) * 10, -2.5])])
        tl = np.stack([tl[0] + (tl[1] - tl[0]) * q for q in np.linspace(0, 1, 5)])
        add_tube(S, tl, 1.4, 1.0, nseg=5, col='#3a4a22', mat=3)
    return S


SCALE = [1.42, 1.36, 1.45, 1.17, 1.15, 1.45]
PLANTS = [p1_fern, p2_leafrosette, p3_shrub, p4_tree, p5_moss, p6_vines]

if __name__ == '__main__':
    which = [int(a) for a in sys.argv[1:]] or range(1, 7)
    for i in which:
        S = PLANTS[i - 1]()
        render(S, 'jungle', out=f'{OUT}/plant-{i}.png', seed=i, scale=SCALE[i - 1])

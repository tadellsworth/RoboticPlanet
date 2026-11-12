"""Swamp (misty bayou) decorative plants: plant-1..6.

1 a bald cypress (feathery dark crown, grey Spanish moss hanging at its edges), 2 cypress knees poking
out of mud and a duckweed puddle, 3 a clump of cattails and reeds, 4 a mangrove-like shrub on arching
prop roots, 5 a rotting stump with orange shelf fungi, 6 pitcher plants with a pink swamp hibiscus.
"""
import sys
import numpy as np
from plants_common import *
from plants_jungle import leaves_on_ellipsoid

OUT = 'out/art/biomes/swamp'

# A hazy bayou light: a soft, slightly warm sun, a lot of grey-green sky light, olive bounce.
ENVS['swamp'] = dict(sun=np.array([1.0, 0.96, 0.86]) * 0.84, sky=np.array([0.44, 0.50, 0.46]) * 0.66,
                     bounce=np.array([0.26, 0.30, 0.18]) * 0.44, shadow='#0c1006', shadow_op=0.55, snow='#ffffff')

BARK = '#5e5244'
MOSS = ('#9aa290', '#b6baa8', '#8a9282')


def mud_patch(S, rng, center, R, col='#3e3824', col2='#56502e', h=1.6, k=6, seed=0):
    rf = lobed(R, rng, k=k, amp=(0.08, 0.2), fmax=7)

    def hf(x, y):
        r = np.hypot(x, y) / R
        P = np.stack([x, y, np.zeros_like(x)], -1).reshape(-1, 3)
        return h * np.clip(1 - r ** 2, 0, 1) + 0.5 * sinnoise(P, 40 + seed, freq=0.5, n=10).reshape(x.shape) + 0.6
    V, F, u, v = patch(center, rf, hf, step=1.2, edge=4)
    S.add(V, F, attrs(len(V), col, col2=col2, u=u, v=v, mat=2, spec=0.35, gloss=30))
    return rf


def puddle(S, rng, center, R, z=1.4, col='#262c1c', dw=0.0, seed=0, rim=3.5):
    """Still, dark water (a flat glossy patch) with a few duckweed specks."""
    rf = lobed(R, rng, k=4, amp=(0.04, 0.1), fmax=4)
    if rim > 0:  # a narrow margin of wet, dark mud round the water
        V, F, u, v = patch(center, lambda th: rf(th) + rim, lambda x, y: np.full_like(x, z - 0.6), step=1.2, edge=0.5)
        S.add(V, F, attrs(len(V), '#33301e', col2='#46442a', u=u, v=v, mat=2, spec=0.4, gloss=30))
    V, F, u, v = patch(center, rf, lambda x, y: np.full_like(x, z), step=1.2, edge=0.5)
    S.add(V, F, attrs(len(V), lerpc(col, '#3a4430', smoothstep(0.2, 1.0, u)), u=u, v=v, mat=0, spec=0.45, gloss=50))
    for q in range(int(dw)):
        a, d = rng.uniform(0, 2 * np.pi), np.sqrt(rng.uniform(0, 1)) * 0.85
        rr = rf(np.array([a]))[0] * d
        r = rng.uniform(0.9, 1.6)
        oriented_blob(S, (center[0] + rr * np.cos(a), center[1] + rr * np.sin(a), z + 0.2), (r, r, 0.35),
                      col=['#7a9a30', '#90ac3c', '#6a8a2c'][q % 3], mat=0, spec=0.2, zmin=None, nu=4, nv=7)


def spanish_moss(S, rng, top, L, strands=4, spread=2.5):
    for k in range(strands):
        p0 = np.asarray(top, float) + np.array([rng.normal() * spread, rng.normal() * spread, rng.uniform(-1, 1)])
        n = 9
        drift = rng.normal(size=2) * 0.25
        sp = [p0]
        Lk = L * rng.uniform(0.6, 1.1)
        for i in range(1, n):
            q = sp[-1] + np.array([drift[0] + rng.normal() * 0.6, drift[1] + rng.normal() * 0.6, -Lk / (n - 1)])
            q[2] = max(q[2], 1.0)
            sp.append(q)
        sp = np.array(sp)
        add_tube(S, sp, rng.uniform(1.2, 1.7), 0.5, nseg=5, col=MOSS[k % 3], col_tip=MOSS[1], mat=4, col2='#c4c8b6',
                 spec=0.05)


def spray(S, rng, origin, yaw, L, col, tip):
    """A flat, feathery spray: a drooping twig with paired soft needles, like a bald cypress's."""
    sp, yws = arc_spine(origin, yaw, L, np.radians(rng.uniform(5, 20)), np.radians(rng.uniform(-35, -20)), 8,
                        yaw1=yaw + rng.uniform(-0.3, 0.3))
    T = tangents(sp)
    for i in range(1, 8):
        s_ = i / 7
        ph = np.arcsin(np.clip(T[i, 2], -1, 1))
        Lp = (L * 0.32 + 1.5) * (1 - 0.55 * s_) + 1.0
        cc = lerpc(col, tip, s_ ** 1.5 * 0.7)
        for sg in (-1, 1):
            add_leaf(S, sp[i], yws[i] + sg * np.radians(rng.uniform(55, 75)), Lp, 1.25, ph + 0.05, ph - 0.25, shape='lance',
                     n=4, ncross=3, fold=0.2, col=cc, mat=0, spec=0.06, trans=0.25, gloss=12)
    add_leaf(S, sp[-1], yws[-1], 4.5, 1.6, -0.2, -0.4, shape='lance', n=4, ncross=3, col=tip, mat=0, spec=0.06, trans=0.25)


def b1_cypress(seed=1):
    """A bald cypress: a broad, flat-topped crown of feathery dark sprays, grey Spanish moss trailing
    from its rim, a fluted trunk flaring at the foot."""
    rng = np.random.default_rng(seed)
    S = Scene()
    H, R = 54.0, 58.0
    z = np.linspace(0, H, 10)
    tr = np.stack([0.8 * z / H, 0.6 * z / H, z], -1)
    add_tube(S, tr, 0, 0, nseg=10, col=BARK, mat=3, radius=4.8 + 7.5 * np.exp(-z / 5.0))
    for k in range(6):
        a = 2 * np.pi * k / 6 + rng.uniform(-0.3, 0.3)
        b = np.array([[0.8, 0.6, H * 0.75], [R * 0.55 * np.cos(a), R * 0.55 * np.sin(a), H * 0.98]])
        b = np.stack([b[0] + (b[1] - b[0]) * t for t in np.linspace(0, 1, 4)])
        add_tube(S, b, 2.4, 1.0, nseg=6, col=BARK, mat=3)
    cols = ['#2a4424', '#304c28', '#36562c', '#283f20', '#3c5c30']
    clumps = [((0, 0, H * 1.12), R * 0.42, 0.5)]
    nc = 9
    for k in range(nc):
        a = 2 * np.pi * k / nc + rng.uniform(-0.2, 0.2)
        rr = R * rng.uniform(0.5, 0.66)
        clumps.append(((rr * np.cos(a), rr * np.sin(a), H * rng.uniform(0.98, 1.08)), R * rng.uniform(0.3, 0.38), 0.5))
    for (c, Rc, fz) in clumps:
        c = np.asarray(c, float)
        oriented_blob(S, c, (Rc * 0.9, Rc * 0.9, Rc * fz * 0.9), col='#142412', mat=0, spec=0.02, zmin=None, nu=10, nv=14)
        leaves_on_ellipsoid(S, rng, c, (Rc, Rc, Rc * fz), int(Rc * 6), 6.5, 1.8, cols, '#1a2c16', zmin_frac=-0.2,
                            tilt=0.5, shape='lance', trans=0.25, spec=0.1)
        for q in range(int(Rc * 1.1)):
            while True:
                d = nrm(rng.normal(size=3))
                if d[2] > -0.1:
                    break
            p = c + np.array([Rc, Rc, Rc * fz]) * d * 0.9
            yaw = np.arctan2(d[1], d[0]) + rng.normal() * 0.4
            col = cols[rng.integers(len(cols))]
            spray(S, rng, p, yaw, rng.uniform(13, 19), col, '#6a8a46')
    # Spanish moss: grey drapes trailing from the crown's rim
    for k in range(34):
        a = 2 * np.pi * k / 34 + rng.uniform(-0.08, 0.08)
        rr = R * rng.uniform(0.95, 1.1)
        spanish_moss(S, rng, (rr * np.cos(a), rr * np.sin(a), H * rng.uniform(0.9, 1.02)), rng.uniform(30, 46),
                     strands=rng.integers(4, 7), spread=2.4)
    return S


def knee(S, rng, x, y, h, r):
    n = 10
    t = np.linspace(0, 1, n)
    lean = rng.normal(size=2) * 0.08
    sp = np.stack([x + lean[0] * h * t, y + lean[1] * h * t, h * t], -1)
    rad = r * (1 - 0.62 * t ** 0.8) + 0.3 * np.sin(t * 9 + x)
    V, F, u, v = tube(sp, rad, 12)
    c = lerpc('#66584a', '#a09078', smoothstep(0.15, 1.0, u)) * (0.84 + 0.16 * np.cos(v * 2 * np.pi * 6 + u * 3))[:, None]
    S.add(V, F, attrs(len(V), c, u=u, v=v, mat=3, spec=0.1, gloss=16))
    oriented_blob(S, sp[-1], (rad[-1] * 1.05, rad[-1] * 1.05, rad[-1] * 0.9), col='#a49480', mat=3, spec=0.1, zmin=None,
                  nu=8, nv=12)
    if rng.uniform() < 0.6:  # a moss collar where it meets the water
        oriented_blob(S, (x, y, 1.5), (r * 1.15, r * 1.15, 2.0), col='#4e6a28', mat=4, col2='#6a8634', spec=0.03, zmin=None,
                      nu=8, nv=14)


def b2_knees(seed=2):
    """Cypress knees: knobbly woody cones poking out of a muddy margin and a duckweed-flecked puddle."""
    rng = np.random.default_rng(seed)
    S = Scene()
    puddle(S, rng, (-4, -4), 44, z=1.2, dw=70, seed=2, rim=5)
    knees = [(-14, 12, 34, 9.0), (8, 18, 26, 8.0), (-30, -8, 22, 7.5), (20, -2, 30, 8.5), (-4, -22, 18, 7.0),
             (34, 22, 20, 6.5), (-38, 24, 15, 6.0), (26, -30, 16, 6.0), (-24, -36, 12, 5.0), (44, -8, 12, 5.0), (6, 40, 13, 5.5),
             (-46, -20, 10, 4.5)]
    for (x, y, h, r) in knees:
        knee(S, rng, x, y, h, r)
    # sedge tufts on the mud
    for (x, y) in [(50, 30), (-52, 6), (14, -50), (-30, 46)]:
        for b in range(9):
            a = rng.uniform(0, 2 * np.pi)
            add_leaf(S, (x, y, 1.5), a, rng.uniform(12, 18), 1.4, np.radians(rng.uniform(40, 60)), np.radians(-10),
                     shape='blade', n=6, ncross=3, fold=0.3, col='#5a7a2e', col_tip='#9a9a54', mat=0, spec=0.1, trans=0.3)
    return S


def b3_cattails(seed=3):
    """A clump of cattails and reeds: arching blades, a few dry ones, brown cattail heads on stiff stalks."""
    rng = np.random.default_rng(seed)
    S = Scene()
    puddle(S, rng, (4, -6), 34, z=0.8, dw=30, seed=3)
    for k in range(40):
        yaw = rng.uniform(0, 2 * np.pi)
        dry = rng.uniform() < 0.22
        col = '#8a8048' if dry else ['#4e6e2a', '#567a30', '#46642a', '#5e8034'][k % 4]
        tip = '#b4a466' if dry else '#9aa65a'
        add_leaf(S, (rng.normal() * 5, rng.normal() * 5, 1.5), yaw, rng.uniform(54, 80), rng.uniform(2.6, 3.6),
                 np.radians(rng.uniform(55, 75)), np.radians(rng.uniform(-35, 0)), shape='blade', n=12, ncross=3, fold=0.35,
                 col=col, col_tip=tip, mat=0, spec=0.14, trans=0.3, gloss=22, pitch_curve=1.6,
                 roll=rng.uniform(-0.3, 0.3))
    for k in range(10):
        yaw = 2 * np.pi * k / 10 + rng.uniform(-0.3, 0.3)
        lean = rng.uniform(0.3, 0.55)
        h = rng.uniform(44, 60)
        base = np.array([rng.normal() * 4, rng.normal() * 4, 1.5])
        d = np.array([np.cos(yaw) * np.sin(lean), np.sin(yaw) * np.sin(lean), np.cos(lean)])
        st = np.stack([base + d * h * t for t in np.linspace(0, 1, 8)])
        add_tube(S, st, 1.1, 0.9, nseg=6, col='#5a6e30', col_tip='#6a7a3a', mat=3)
        hc = base + d * h * 0.86
        oriented_blob(S, hc, (8.0, 3.4, 3.4), yaw=yaw, pitch=np.pi / 2 - lean, col='#5e3a20', mat=3, spec=0.12, zmin=None,
                      nu=10, nv=12)
        tip = np.stack([base + d * h * t for t in np.linspace(0.95, 1.12, 4)])
        add_tube(S, tip, 0.6, 0.3, nseg=5, col='#8a7a50', mat=3)
    return S


def b4_mangrove(seed=4):
    """A mangrove-like shrub perched on a cage of arching prop roots over still water."""
    rng = np.random.default_rng(seed)
    S = Scene()
    puddle(S, rng, (0, -2), 40, z=0.9, dw=30, seed=4)
    H = 26.0
    tr = np.array([[0, 0, H * 0.55], [0.5, 0.4, H * 0.8], [1, 0.8, H * 1.05], [1.5, 1.2, H * 1.25]], float)
    add_tube(S, tr, 4.2, 3.0, nseg=8, col='#6a5e4c', mat=3)
    nr = 14
    for k in range(nr):
        a = 2 * np.pi * k / nr + rng.uniform(-0.15, 0.15)
        reach = rng.uniform(48, 62)
        h0 = rng.uniform(H * 0.55, H * 0.85)
        p0 = np.array([np.cos(a) * 2, np.sin(a) * 2, h0])
        p2 = np.array([np.cos(a) * reach, np.sin(a) * reach, 0.5])
        p1 = np.array([np.cos(a) * reach * 0.5, np.sin(a) * reach * 0.5, h0 + rng.uniform(10, 16)])
        t = np.linspace(0, 1, 14)[:, None]
        sp = (1 - t) ** 2 * p0 + 2 * (1 - t) * t * p1 + t ** 2 * p2
        add_tube(S, sp, rng.uniform(2.0, 2.6), 1.3, nseg=7, col='#a09478', col_tip='#7a705a', mat=3, spec=0.1)
        if rng.uniform() < 0.5:  # a secondary root forking off
            a2 = a + rng.choice([-1, 1]) * rng.uniform(0.25, 0.45)
            q0 = sp[6]
            q2 = np.array([np.cos(a2) * reach * 0.85, np.sin(a2) * reach * 0.85, 0.5])
            q1 = (q0 + q2) / 2 + np.array([0, 0, 6])
            sp2 = (1 - t) ** 2 * q0 + 2 * (1 - t) * t * q1 + t ** 2 * q2
            add_tube(S, sp2, 1.4, 1.0, nseg=6, col='#a09478', col_tip='#7a705a', mat=3, spec=0.1)
    cols = ['#3e6a2e', '#467634', '#4f8038', '#386228', '#5a8a3e']
    clumps = [((1.5, 1.2, H * 1.75), 20, 0.7)]
    for k in range(5):
        a = 2 * np.pi * k / 5 + rng.uniform(-0.2, 0.2)
        rr = rng.uniform(13, 17)
        clumps.append(((rr * np.cos(a), rr * np.sin(a), H * rng.uniform(1.45, 1.6)), rng.uniform(13, 16), 0.65))
    for (c, Rc, fz) in clumps:
        oriented_blob(S, c, (Rc * 0.85, Rc * 0.85, Rc * fz * 0.85), col='#16301a', mat=0, spec=0.02, zmin=None, nu=10, nv=14)
        leaves_on_ellipsoid(S, rng, c, (Rc, Rc, Rc * fz), int(Rc * 7), 9.5, 4.4, cols, '#24461e', zmin_frac=-0.3, tilt=0.6,
                            shape='ovate', trans=0.25, spec=0.3)
    return S


def b5_stump(seed=5):
    """A rotting cypress stump: hollow, moss-capped, with tiers of orange shelf fungi."""
    rng = np.random.default_rng(seed)
    S = Scene()
    H, R = 40.0, 18.0
    z = np.linspace(0, H, 10)
    tr = np.stack([np.zeros_like(z), np.zeros_like(z), z], -1)
    rad = R * (1 + 0.35 * np.exp(-z / 4.0)) * (1 - 0.06 * z / H)
    V, F, u, v = tube(tr, rad, 28)
    c = lerpc('#54493a', '#6e604c', u) * (0.8 + 0.2 * np.cos(v * 2 * np.pi * 9 + u * 2))[:, None]
    S.add(V, F, attrs(len(V), c, u=u, v=v, mat=3, spec=0.08))
    # roots flaring into the mud
    for k in range(7):
        a = 2 * np.pi * k / 7 + rng.uniform(-0.2, 0.2)
        sp, _ = arc_spine((np.cos(a) * R * 0.9, np.sin(a) * R * 0.9, 6), a, rng.uniform(16, 24), np.radians(-24), np.radians(-4), 8)
        add_tube(S, sp, 4.5, 1.5, nseg=7, col='#4e4434', mat=3)
    # the broken top: rotted pale wood with growth rings round a dark hollow, jagged rim
    Rt = rad[-1]

    def topc(u, v, V):
        r = np.hypot(V[:, 0], V[:, 1]) / Rt
        c = lerpc('#7e6a4e', '#9a8462', 0.5 + 0.5 * np.sin(r * 26))
        c = lerpc(c, '#2a1e14', smoothstep(0.45, 0.3, r))
        return lerpc(c, '#4c4234', smoothstep(0.86, 0.98, r))
    oriented_blob(S, (0, 0, H - 0.5), (Rt, Rt, 2.0), col=topc, mat=3, spec=0.08, zmin=None, nu=12, nv=32)
    for k in range(9):  # jagged splinters round the rim
        a = 2 * np.pi * k / 9 + rng.uniform(-0.2, 0.2)
        h = rng.uniform(3, 9)
        p = np.array([np.cos(a) * Rt * 0.9, np.sin(a) * Rt * 0.9, H])
        sp = np.stack([p + np.array([0, 0, h * t]) + np.array([np.cos(a), np.sin(a), 0]) * 0.8 * t for t in np.linspace(0, 1, 5)])
        add_tube(S, sp, 2.6, 0.5, nseg=5, col='#5e5242', col_tip='#8a7a5e', mat=3)
    # moss on the top and a cushion at the foot
    for k in range(5):
        a = rng.uniform(0, 2 * np.pi)
        oriented_blob(S, (np.cos(a) * Rt * 0.7, np.sin(a) * Rt * 0.7, H + 0.8), (rng.uniform(5, 8), rng.uniform(3.5, 5), 2.2),
                      yaw=a + np.pi / 2, col='#4e6e28', mat=4, col2='#6c8a34', spec=0.03, zmin=None, nu=8, nv=12)
    # shelf fungi: half-discs in tiers on the sides, orange with cream rims and bands
    for (a, zz, r) in [(-1.9, 10, 7.5), (-0.95, 21, 6.5), (-2.75, 25, 5.5), (-0.1, 8, 6.0)]:
        rr = np.interp(zz, z, rad)
        cx, cy = np.cos(a) * (rr - 0.5), np.sin(a) * (rr - 0.5)

        def fc(u, v, V, cx=cx, cy=cy, r=r):
            d = np.hypot(V[:, 0] - cx, V[:, 1] - cy) / r
            c = lerpc('#c0701e', '#f2b444', smoothstep(0.1, 0.8, d))
            c = c * (0.9 + 0.1 * np.sin(d * 22))[:, None]
            return lerpc(c, '#f4d090', smoothstep(0.88, 0.98, d))
        oriented_blob(S, (cx, cy, zz), (r * 0.9, r * 1.5, 2.2), yaw=a, col=fc, mat=0, spec=0.2, gloss=24, zmin=None, nu=8, nv=18)
    # a fern sprig at the foot
    from plants_forest import frond
    for (fx, fy, nf) in [(36, -30, 6), (-40, 10, 5)]:
        for k in range(nf):
            frond(S, rng, (fx, fy, 1.5), 2 * np.pi * k / nf + rng.uniform(-0.2, 0.2), rng.uniform(20, 28), ('#3a6a2e', '#467a34'))
    for k in range(10):  # moss creeping up the bark
        a = rng.uniform(-np.pi, np.pi)
        zz = rng.uniform(2, H * 0.7)
        rr = np.interp(zz, z, rad)
        oriented_blob(S, (np.cos(a) * rr, np.sin(a) * rr, zz), (2.5, rng.uniform(4, 7), rng.uniform(4, 8)), yaw=a,
                      col='#4a6a26', col2='#6a8a34', mat=4, spec=0.03, zmin=None, nu=8, nv=12)
    for (x, y, r) in [(-28, -24, 10), (-22, 28, 8), (26, 24, 7), (10, -36, 7)]:  # moss cushions round the foot
        oriented_blob(S, (x, y, 1.5), (r, r * 0.8, 3.0), yaw=rng.uniform(0, 3), col='#4a6a26', col2='#6a8a34', mat=4, spec=0.03,
                      zmin=0.3, nu=8, nv=14)
    return S


def sarracenia(S, rng, base, yaw, h, lean, r):
    n = 14
    t = np.linspace(0, 1, n)
    ax = np.array([np.cos(yaw) * np.sin(lean), np.sin(yaw) * np.sin(lean), np.cos(lean)])
    sp = np.asarray(base, float) + ax[None] * (h * t)[:, None] + np.array([np.cos(yaw), np.sin(yaw), 0]) * (2.0 * t ** 2)[:, None] * h * 0.06
    rad = r * (0.25 + 0.75 * t ** 1.3) + 0.6
    V, F, u, v = tube(sp, rad, 12)
    c = lerpc('#5e7a30', '#b23a3a', smoothstep(0.35, 0.9, u))
    S.add(V, F, attrs(len(V), c, col2='#d8c0a0', u=u, v=v, mat=1, spec=0.3, gloss=28, trans=0.3))
    T = nrm(sp[-1] - sp[-2])
    e1 = nrm(np.cross(T, [0, 0, 1.0]))
    e2 = np.cross(T, e1)
    ang = np.linspace(0, 2 * np.pi, 21)
    ring = sp[-1] + rad[-1] * (np.cos(ang)[:, None] * e1 + np.sin(ang)[:, None] * e2)
    add_tube(S, ring, 0.9, 0.9, nseg=5, col='#8a2a2a', mat=0, spec=0.3)
    Vm, Fm, _, _ = blob((0, 0, 0), (rad[-1] * 0.92, rad[-1] * 0.92, 0.5), 8, 14)
    Vm = Vm @ np.stack([e1, e2, T], 1).T + sp[-1] - T * 0.8
    S.add(Vm, Fm, attrs(len(Vm), '#2a0c0a', mat=0, spec=0.0))
    # the hood, leaning over the mouth from the back
    add_leaf(S, sp[-1] - np.array([np.cos(yaw), np.sin(yaw), 0]) * rad[-1] * 0.8, yaw, r * 2.4, r * 1.3, np.radians(40),
             np.radians(-30), shape='heart', n=7, ncross=7, fold=0.35, col='#b8403a', col_tip='#8a2a2a', col2='#e0c0a0', mat=1,
             spec=0.25, trans=0.3)


def hibiscus(S, rng, c, size, col='#e04a6c', tip='#f48aa4'):
    for j in range(5):
        a = 2 * np.pi * j / 5 + rng.uniform(-0.1, 0.1)
        add_leaf(S, c, a, size, size * 0.62, np.radians(34), np.radians(-6), shape='ovate', n=7, ncross=7, fold=0.25,
                 droop_edges=0.05, col=col, col_tip=tip, col2='#a01e3a', mat=1, spec=0.2, trans=0.4)
    oriented_blob(S, np.asarray(c) + np.array([0, 0, 1.2]), (2.2, 2.2, 1.6), col='#7a1028', mat=0, zmin=None, nu=6, nv=10)
    sp = np.stack([np.asarray(c, float) + np.array([0.3 * t, 0.2 * t, 1.5 + size * 0.5 * t]) for t in np.linspace(0, 1, 5)])
    add_tube(S, sp, 0.7, 0.6, nseg=5, col='#f0e0c0', mat=0)
    oriented_blob(S, sp[-1], (1.4, 1.4, 1.2), col='#f0c040', mat=0, spec=0.2, zmin=None, nu=6, nv=8)


def b6_pitchers(seed=6):
    """A stand of trumpet pitcher plants, green below and red-veined above with hooded mouths, round a
    swamp-hibiscus bush with a few pink-red blooms."""
    rng = np.random.default_rng(seed)
    S = Scene()
    # the hibiscus bush (back)
    bc = (10, 20, 16)
    oriented_blob(S, bc, (26, 22, 14), col='#16301a', mat=0, spec=0.02, zmin=0.5)
    leaves_on_ellipsoid(S, rng, bc, (30, 26, 18), 130, 13, 6.5, ['#36642c', '#3e6e30', '#467836', '#305a28'], '#22441e',
                        zmin_frac=-0.05, shape='heart', trans=0.3)
    for (d, sz) in [((-6, 4, 0.9), 15), ((12, -4, 0.9), 14), ((18, 14, 0.75), 13), ((-14, 18, 0.6), 12)]:
        dd = nrm(np.array(d))
        hibiscus(S, rng, np.array(bc) + np.array([30, 26, 18]) * dd * 1.0, sz)
    # pitchers in front
    pits = [(-20, -18, 0.0), (-4, -24, 0.4), (12, -22, -0.3), (26, -12, 0.2), (-32, -4, 0.1), (-26, -34, -0.2),
            (2, -40, 0.3), (20, -36, -0.1), (-12, -6, 0.0), (36, -28, 0.3)]
    for (x, y, j) in pits:
        yaw = np.arctan2(y + 6, x) + j
        sarracenia(S, rng, (x, y, 0.5), yaw, rng.uniform(26, 40), np.radians(rng.uniform(12, 26)), rng.uniform(4.0, 5.2))
    # their low leaves
    for k in range(10):
        a = rng.uniform(np.pi, 2 * np.pi)
        add_leaf(S, (rng.normal() * 10 - 4, -22 + rng.normal() * 6, 1), a, rng.uniform(14, 20), 4.5, np.radians(20),
                 np.radians(-10), shape='lance', n=7, ncross=5, col='#4e6e2a', col_tip='#7a7a34', mat=1, col2='#3a5a22',
                 spec=0.15, trans=0.3)
    return S


SCALE = [1.34, 1.5, 1.6, 1.5, 1.6, 1.6]
OFFSET = [(14, 22), (0, 0), (6, 18), (4, 6), (0, 6), (2, 4)]
PLANTS = [b1_cypress, b2_knees, b3_cattails, b4_mangrove, b5_stump, b6_pitchers]

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
        render(S, 'swamp', out=f'{OUT}/plant-{i}.png', seed=i, scale=scales.get(i, SCALE[i - 1]), offset=OFFSET[i - 1])

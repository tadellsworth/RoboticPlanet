"""Savanna decorative plants: plant-1..6.

1 an umbrella acacia (wide, flat-topped crown on a thin forked trunk: the signature tree), 2 a baobab
(huge bottle trunk, sparse stubby crown), 3 a termite mound (tall knobbly clay spires), 4 a tussock of
tall golden grass with reddish seed heads, 5 a thorny grey-green bush, 6 a young acacia.
Seen from the game's high camera under a hard, bright sun; each kept inside its tile with its shadow.
"""
import sys
import numpy as np
from plants_common import *
from plants_jungle import leaves_on_ellipsoid

OUT = 'out/art/biomes/savanna'

# A hard, high, bright sun, a pale blue sky fill and warm golden bounce light off the dry grass.
ENVS['savanna'] = dict(sun=np.array([1.0, 0.94, 0.82]) * 1.02, sky=np.array([0.40, 0.46, 0.56]) * 0.6,
                       bounce=np.array([0.56, 0.45, 0.26]) * 0.45, shadow='#2a1a08', shadow_op=0.52, snow='#ffffff')

# The termite mound's tall spires show the camera their shaded side (the sun is up-screen), so it gets a
# stronger warm fill (light bounced off the bright grass) under the same sun and shadow.
ENVS['savanna-mound'] = dict(ENVS['savanna'], sky=np.array([0.44, 0.47, 0.54]) * 0.78,
                             bounce=np.array([0.70, 0.54, 0.32]) * 0.62)

ACACIA = ['#6e7e32', '#7a8a3a', '#63732e', '#86943f', '#727f36', '#8e9a48']
ACACIA_BARK = '#5c4e42'
GOLD = ['#d4b468', '#c8a658', '#dcc07a', '#bf9c50', '#e2c886', '#b89448']


def bez(p0, p1, p2, n=8):
    t = np.linspace(0, 1, n)[:, None]
    return (1 - t) ** 2 * p0 + 2 * (1 - t) * t * p1 + t ** 2 * p2


def pad(S, rng, c, Rp, cols, dark, density=0.55, leaf_L=5.5, leaf_W=2.3, flat=0.22):
    """One flat foliage plate of an umbrella crown: a thin dark core under a carpet of small feathery
    (bipinnate) sprays lying almost flat, drooping a little at the rim, so the top reads as a level,
    evenly lit layer with a soft scalloped edge."""
    c = np.asarray(c, float)
    oriented_blob(S, c - np.array([0, 0, 1.2]), (Rp * 0.86, Rp * 0.86, 2.6), col=lerpc(cols[0], dark, 0.5), mat=0,
                  spec=0.02, zmin=None, nu=6, nv=14)
    n = int(density * Rp * Rp * 0.42)
    for i in range(n):
        a = rng.uniform(0, 2 * np.pi)
        rr = Rp * np.sqrt(rng.uniform(0.0, 1.0))
        t = rr / Rp
        h = 2.2 * (1 - t ** 2) + rng.uniform(-0.6, 0.6)
        p0 = c + np.array([rr * np.cos(a), rr * np.sin(a), h])
        yaw = a + rng.normal() * 0.7
        Lf = leaf_L * rng.uniform(1.7, 2.3)
        droop = -np.radians(25) * smoothstep(0.6, 1.0, t)
        sp, yws = arc_spine(p0, yaw, Lf, np.radians(rng.uniform(-2, 8)) + droop * 0.5, np.radians(rng.uniform(-14, 0)) + droop, 6)
        cc = C(cols[rng.integers(len(cols))]) * rng.uniform(0.93, 1.07)
        for j in range(1, 6):
            s_ = j / 5
            Lp = leaf_L * 0.55 * (1 - 0.45 * s_) + 0.8
            for sg in (-1, 1):
                add_leaf(S, sp[j], yws[j] + sg * np.radians(rng.uniform(50, 70)), Lp, leaf_W * 0.55,
                         np.radians(4), np.radians(-8), shape='lance', n=3, ncross=3, fold=0.15, col=cc,
                         col_tip=lerpc(cc, '#e8eec0', 0.12), mat=0, spec=0.1, trans=0.3, gloss=16)
        add_leaf(S, sp[-1], yws[-1], leaf_L * 0.6, leaf_W * 0.55, np.radians(0), np.radians(-10), shape='lance', n=3,
                 ncross=3, col=cc, mat=0, spec=0.1, trans=0.3)


def acacia(S, rng, base, H, R, cols=ACACIA, dark='#1a200c', n_ring=9, n_limbs=4, trunk_r=3.4, density=0.55,
           leaf_L=5.5, leaf_W=2.3, tiers=1, ell=(1.22, 0.86), lean=(4, 14), fill=1.0):
    """An umbrella thorn: a thin, leaning trunk forking into a V of limbs that spread to carry a wide,
    flat-topped, oval crown of foliage plates in layers: a high middle, a lower lobed rim, small gaps."""
    bx, by = base
    ex, ey = ell
    zf = H * 0.4
    top = np.array([bx + lean[0], by + lean[1]])
    fork = np.array([bx + lean[0] * 0.55, by + lean[1] * 0.55, zf])
    tr = bez(np.array([bx, by, 0.0]), np.array([bx + lean[0] * 0.1, by + lean[1] * 0.1, zf * 0.55]), fork, 7)
    add_tube(S, tr, trunk_r, trunk_r * 0.78, nseg=8, col=ACACIA_BARK, mat=3)
    off = rng.uniform(0, 2 * np.pi)
    for k in range(n_limbs):
        yaw = off + 2 * np.pi * k / n_limbs + rng.uniform(-0.3, 0.3)
        rr = R * rng.uniform(0.38, 0.5)
        end = np.array([top[0] + rr * ex * np.cos(yaw), top[1] + rr * ey * np.sin(yaw), H - 5 + rng.uniform(-2, 1)])
        ctl = fork + (end - fork) * 0.2 + np.array([0, 0, (H - zf) * 0.45])
        sp = bez(fork, ctl, end, 8)
        add_tube(S, sp, trunk_r * 0.7, trunk_r * 0.34, nseg=7, col=ACACIA_BARK, mat=3)
        # the limb splits under the crown into a few spreading, near-horizontal branches
        for j in range(3):
            yj = yaw + rng.uniform(-0.9, 0.9)
            L = R * rng.uniform(0.25, 0.4)
            e2 = end + np.array([L * ex * np.cos(yj), L * ey * np.sin(yj), rng.uniform(0, 3)])
            sp2 = bez(end, (end + e2) / 2 + np.array([0, 0, 2]), e2, 5)
            add_tube(S, sp2, trunk_r * 0.32, trunk_r * 0.15, nseg=5, col=ACACIA_BARK, mat=3)

    def at(r, a):
        return top[0] + r * ex * np.cos(a), top[1] + r * ey * np.sin(a)
    # crown plates: a high middle, a middle ring, and a lower outer rim of lobes, with gaps between them
    # (pad radii scaled by `fill`) so the dark limbs and the ground's shadow show through
    pads = []
    for k in range(3):
        a = off + 2 * np.pi * k / 3
        pads.append(((*at(R * 0.15, a), H + 6 + rng.uniform(-0.5, 1.0)), R * rng.uniform(0.23, 0.27) * fill))
    for k in range(6):
        a = off + 0.4 + 2 * np.pi * k / 6 + rng.uniform(-0.2, 0.2)
        pads.append(((*at(R * rng.uniform(0.44, 0.52), a), H + rng.uniform(0.0, 2.0)), R * rng.uniform(0.21, 0.26) * fill))
    for k in range(n_ring):
        a = off + 2 * np.pi * (k + 0.5) / n_ring + rng.uniform(-0.12, 0.12)
        r = R * rng.uniform(0.72, 0.82)
        pads.append(((*at(r, a), H - 6 + rng.uniform(-1.5, 1.5)), R * rng.uniform(0.17, 0.22) * fill))
    for t in range(1, tiers):
        # young trees grow in layers: a smaller, separate tier above the first on its own leader
        lift = 14 * t
        for k in range(4):
            a = off + 0.8 + 2 * np.pi * k / 4 + rng.uniform(-0.3, 0.3)
            pads.append(((*at(R * rng.uniform(0.12, 0.26) / t, a), H + lift), R * rng.uniform(0.2, 0.24) / t ** 0.5))
        sp = bez(np.array([fork[0], fork[1], zf]), np.array([top[0], top[1], H]), np.array([top[0], top[1], H + lift - 2]), 6)
        add_tube(S, sp, trunk_r * 0.5, trunk_r * 0.3, nseg=6, col=ACACIA_BARK, mat=3)
    for (c, Rp) in pads:
        pad(S, rng, c, Rp, cols, dark, density=density, leaf_L=leaf_L, leaf_W=leaf_W)
    return pads


def s1_acacia(seed=31):
    rng = np.random.default_rng(seed)
    S = Scene()
    acacia(S, rng, (0, 0), 66, 80, n_ring=11, n_limbs=5, lean=(10, 40), ell=(1.25, 0.74), fill=0.9)
    return S


def bottle_trunk(S, base, H, rfun, rng, nz=18, nseg=30, col='#8e7462', col_top='#9c8270'):
    """A fat, fluted bottle-shaped trunk with a rounded top."""
    bx, by = base
    zs = np.linspace(0, H, nz)
    th = np.linspace(0, 2 * np.pi, nseg, endpoint=False)
    ph = rng.uniform(0, 2 * np.pi, 3)
    Z, TH = np.meshgrid(zs, th, indexing='ij')
    s = Z / H
    r = rfun(s) * (1 + 0.055 * np.sin(9 * TH + ph[0] + 0.03 * Z) + 0.03 * np.sin(4 * TH + ph[1]) + 0.04 * (1 - s) ** 3 * np.sin(5 * TH + ph[2]))
    V = np.stack([bx + r * np.cos(TH), by + r * np.sin(TH), Z], -1).reshape(-1, 3)
    F = gf(nz, nseg, True)
    u = s.ravel()
    v = (TH / (2 * np.pi)).ravel()
    S.add(V, F, attrs(len(V), lerpc(col, col_top, u), u=u, v=v, mat=3, spec=0.06, gloss=12))
    rt = rfun(1.0)
    oriented_blob(S, (bx, by, H), (rt * 1.02, rt * 1.02, rt * 0.35), col=col_top, mat=3, spec=0.05, zmin=None,
                  nu=8, nv=24)


def s2_baobab(seed=32):
    """A baobab: a huge pinkish-grey bottle trunk and a sparse crown of thick, stubby, crooked branches
    that fork into twigs carrying a few small rosettes of hand-shaped leaves."""
    rng = np.random.default_rng(seed)
    S = Scene()
    H = 60

    def rfun(s):
        return 26 + 7 * np.sin(np.pi * np.clip(s, 0, 1) * 0.8) - 12 * np.clip(s - 0.55, 0, 1) ** 1.2 * 2.2
    bottle_trunk(S, (0, 0), H, rfun, rng, col='#9a8070', col_top='#ae9482')
    rt = rfun(1.0)
    leaf_cols = ['#5a6e2a', '#667a30', '#526426', '#728436']
    bark, bark_tip = '#a08676', '#ae9484'

    def rosette(p):
        nl = rng.integers(5, 8)
        y0 = rng.uniform(0, 2 * np.pi)
        for j in range(nl):
            add_leaf(S, p, y0 + 2 * np.pi * j / nl + rng.uniform(-0.2, 0.2), rng.uniform(5.5, 7.5), 2.5,
                     np.radians(rng.uniform(10, 30)), np.radians(rng.uniform(-15, 5)), shape='ovate', n=5, ncross=3,
                     fold=0.25, col=leaf_cols[rng.integers(len(leaf_cols))], col2='#3a5a1c', mat=1, spec=0.14, trans=0.3)

    def limb(p0, d, L, r0, depth):
        sp = wiggle_spine(p0, d, L, 6, rng, amp=0.16 + 0.08 * depth, upbias=0.02)
        add_tube(S, sp, r0, r0 * 0.62, nseg=8 if depth == 0 else 6, col=bark, col_tip=bark_tip, mat=3, spec=0.05)
        if depth < 2:
            for j in range(rng.integers(2, 4)):
                d2 = nrm(nrm(sp[-1] - sp[-3]) + rng.normal(size=3) * 0.55 + np.array([0, 0, 0.15]))
                limb(sp[-1], d2, L * rng.uniform(0.5, 0.68), r0 * 0.58, depth + 1)
        else:
            if rng.uniform() < 0.9:
                rosette(sp[-1] + np.array([0, 0, 0.5]))
                if rng.uniform() < 0.5:
                    rosette(sp[-3] + np.array([0, 0, 0.5]))
    nb = 8
    off = rng.uniform(0, 2 * np.pi)
    for k in range(nb):
        yaw = off + 2 * np.pi * k / nb + rng.uniform(-0.25, 0.25)
        p0 = np.array([np.cos(yaw) * rt * 0.55, np.sin(yaw) * rt * 0.55, H + 2])
        pitch = np.radians(rng.uniform(10, 28))
        d = np.array([np.cos(pitch) * np.cos(yaw), np.cos(pitch) * np.sin(yaw), np.sin(pitch)])
        limb(p0, d, rng.uniform(32, 40), 5.4, 0)
    for k in range(2):
        yaw = rng.uniform(0, 2 * np.pi)
        p0 = np.array([np.cos(yaw) * 4, np.sin(yaw) * 4, H + 3])
        limb(p0, nrm(np.array([np.cos(yaw) * 0.4, np.sin(yaw) * 0.4, 1])), 14, 4.0, 1)
    return S


def spire(S, rng, base, H, r0, lean=(0, 0), seed=0, knob=0.6, flutes=7, rexp=0.62):
    """A clay spire: a tapering tube along a gently bent spine, with rounded vertical flutes and a few
    soft lumps, paler and sun-bleached toward the top."""
    bx, by = base
    n, nseg = 18, 24
    s = np.linspace(0, 1, n)
    sp = np.stack([bx + lean[0] * s ** 1.5, by + lean[1] * s ** 1.5, H * s], -1)
    rad = r0 * (1 - s) ** rexp + 1.4
    V, F, u, v = tube(sp, rad, nseg)
    Vr = V.reshape(n, nseg, 3)
    radial = Vr - sp[:, None, :]
    radial[..., 2] = 0
    radial = nrm(radial)
    th = np.linspace(0, 2 * np.pi, nseg, endpoint=False)[None, :]
    flute = np.abs(np.sin(flutes * 0.5 * th + 0.6 * s[:, None] * 3 + seed)) * 1.4 - 0.7
    d = sinnoise(V, seed, freq=0.25, n=14).reshape(n, nseg) * knob + flute * (0.6 + 0.8 * (1 - s[:, None]))
    Vr = Vr + radial * d[..., None]
    V = Vr.reshape(-1, 3)
    col = lerpc('#c08a68', '#ecd2b2', smoothstep(0.05, 1.0, u) * 0.85 + 0.1 * np.clip(d.ravel(), 0, 1))
    S.add(V, F, attrs(len(V), col, u=u, v=v, mat=3, spec=0.05, gloss=10))
    oriented_blob(S, sp[-1], (2.2, 2.2, 2.4), col='#fae6c8', mat=3, spec=0.05, zmin=None, nu=6, nv=8)


def s3_termites(seed=33):
    """A cathedral termite mound: a tall fluted main spire with shorter ones fused to it on a broad,
    lumpy base of pale clay, dry grass growing around its foot."""
    rng = np.random.default_rng(seed)
    S = Scene()

    def disp(d):
        P = d * 30
        return 0.12 * sinnoise(P, 7, freq=0.18, n=12)
    oriented_blob(S, (0, 0, 0), (32, 28, 15), disp=disp, col=lambda u, v, V: lerpc('#b88462', '#d4a684', smoothstep(0, 15, V[:, 2])),
                  mat=3, spec=0.04, zmin=0.3, nu=14, nv=28)
    spire(S, rng, (2, 8), 150, 13, lean=(-2, 6), seed=331, rexp=0.85)
    spire(S, rng, (-16, -2), 100, 10.5, lean=(-7, 0), seed=332, rexp=0.85)
    spire(S, rng, (15, -6), 78, 10, lean=(6, -2), seed=333, rexp=0.85)
    spire(S, rng, (-4, -15), 48, 8, lean=(0, -3), seed=334, knob=0.5, flutes=5, rexp=0.85)
    spire(S, rng, (20, 14), 36, 7, lean=(3, 2), seed=335, knob=0.5, flutes=5, rexp=0.85)
    # dry grass around the foot
    for (cx, cy, nbl) in [(-44, 16, 18), (38, 24, 16), (44, -16, 14), (-36, -26, 16), (8, -38, 12), (-6, 40, 12),
                          (-50, -6, 10), (26, 40, 10)]:
        for i in range(nbl):
            yaw = rng.uniform(0, 2 * np.pi)
            L = rng.uniform(16, 26)
            tone = rng.uniform()
            add_leaf(S, (cx + rng.normal() * 2, cy + rng.normal() * 2, 0.5), yaw, L, 1.6, np.radians(rng.uniform(45, 70)),
                     np.radians(rng.uniform(0, 30)), shape='blade', n=8, ncross=3, fold=0.3, col=lerpc('#8a6a38', '#9a7840', tone),
                     col_tip=lerpc('#d0b068', '#e0c47e', tone), mat=0, spec=0.1, trans=0.25)
    return S


def s4_tussock(seed=34):
    """A big tussock of tall golden grass, arching out in a fountain, with reddish seed heads on thin stems."""
    rng = np.random.default_rng(seed)
    S = Scene()
    nbl = 150
    for i in range(nbl):
        yaw = rng.uniform(0, 2 * np.pi)
        inner = rng.uniform() < 0.3
        L = rng.uniform(46, 70) * (0.75 if inner else 1.0)
        p0 = np.radians(rng.uniform(62, 82))
        p1 = np.radians(rng.uniform(-20, 10)) if not inner else np.radians(rng.uniform(10, 40))
        o = (rng.normal() * 3, rng.normal() * 3, 0.5)
        tone = rng.uniform()
        base = lerpc('#7a5c30', '#8e6c3a', tone)
        tip = lerpc(GOLD[rng.integers(len(GOLD))], '#f0dca0', 0.2 * tone)
        add_leaf(S, o, yaw, L, rng.uniform(1.8, 2.5), p0, p1, shape='blade', n=12, ncross=3, fold=0.3, col=base,
                 col_tip=tip, mat=0, spec=0.12, trans=0.3, pitch_curve=1.3, yaw1=yaw + rng.uniform(-0.3, 0.3))
    # seed stems with feathery reddish heads
    for k in range(16):
        yaw = rng.uniform(0, 2 * np.pi)
        L = rng.uniform(52, 70)
        sp, yws = arc_spine((rng.normal() * 2, rng.normal() * 2, 1), yaw, L, np.radians(rng.uniform(70, 84)),
                            np.radians(rng.uniform(20, 45)), 10)
        add_tube(S, sp, 0.7, 0.45, nseg=4, col='#9a8048', col_tip='#c0a260', mat=0)
        T = nrm(sp[-1] - sp[-2])
        for q in range(4):
            h = sp[-1] - T * q * 3.2 + rng.normal(size=3) * 0.8
            add_leaf(S, h, yws[-1] + rng.uniform(-0.6, 0.6), 7, 1.8, np.arcsin(T[2]) - 0.2, np.arcsin(T[2]) - 0.6,
                     shape='lance', n=4, ncross=3, fold=0.2, col='#a8643a', col_tip='#c88a54', mat=0, spec=0.08, trans=0.35)
    return S


def s5_thornbush(seed=35):
    """A thorny bush: a dome of wiry dark branches, clusters of small grey-green leaves and pale thorns,
    open enough to see into."""
    rng = np.random.default_rng(seed)
    S = Scene()
    R_dome, H_dome = 70, 38
    leafc = ['#9c9c70', '#acaa7e', '#8e8e64', '#b8b48a', '#a0a274']

    def cluster(p, k=6):
        for j in range(k):
            yaw = rng.uniform(0, 2 * np.pi)
            add_leaf(S, p + rng.normal(size=3) * 1.2, yaw, rng.uniform(4.0, 5.5), rng.uniform(1.6, 2.1),
                     np.radians(rng.uniform(5, 35)), np.radians(rng.uniform(-10, 15)), shape='ovate', n=4, ncross=3,
                     fold=0.2, col=leafc[rng.integers(len(leafc))], mat=0, spec=0.1, trans=0.2)

    def thorn(p, d):
        e = p + d * rng.uniform(3, 4.5)
        add_tube(S, np.stack([p + (e - p) * t for t in np.linspace(0, 1, 3)]), 0.5, 0.05, nseg=4, col='#e8e0cc', mat=0,
                 spec=0.2)

    def branch(p0, d, L, r, depth):
        n = 6
        sp = wiggle_spine(p0, d, L, n, rng, amp=0.3, upbias=0.03)
        rr = np.hypot(sp[:, 0], sp[:, 1]) / R_dome
        sp[:, 2] = np.minimum(sp[:, 2], H_dome * np.sqrt(np.clip(1 - rr ** 2, 0.02, 1)) + 2)
        sp[:, 2] = np.maximum(sp[:, 2], 0.8)
        add_tube(S, sp, r, r * 0.6, nseg=6 if r > 1 else 4, col='#4a4038', col_tip='#5a4e44', mat=3, spec=0.06)
        for i in range(2, n):
            if rng.uniform() < 0.8:
                side = nrm(np.cross(nrm(sp[i] - sp[i - 1]), [0, 0, 1]) * rng.choice([-1, 1]) + np.array([0, 0, 0.3]))
                thorn(sp[i], side)
        if depth >= 3:
            for i in range(1, n):
                if rng.uniform() < 0.6:
                    cluster(sp[i], k=rng.integers(3, 7))
            return
        for j in range(rng.integers(2, 4)):
            t0 = rng.uniform(0.3, 0.95)
            i = int(t0 * (n - 1))
            out = nrm(np.array([sp[i, 0], sp[i, 1], 0]) + 1e-3)
            nd = nrm(nrm(sp[min(i + 1, n - 1)] - sp[max(i - 1, 0)]) + rng.normal(size=3) * 0.7 + out * 0.4
                     + np.array([0, 0, 0.2]))
            branch(sp[i], nd, L * rng.uniform(0.55, 0.75), r * 0.64, depth + 1)

    for k in range(11):
        yaw = 2 * np.pi * k / 11 + rng.uniform(-0.2, 0.2)
        pitch = rng.uniform(np.radians(20), np.radians(55))
        d = np.array([np.cos(pitch) * np.cos(yaw), np.cos(pitch) * np.sin(yaw), np.sin(pitch)])
        branch(np.array([rng.uniform(-3, 3), rng.uniform(-3, 3), 0.5]), d, rng.uniform(34, 44), 2.4, 0)
    return S


def s6_sapling(seed=36):
    """A young acacia: a slim stem and a small crown in two flat tiers."""
    rng = np.random.default_rng(seed)
    S = Scene()
    acacia(S, rng, (0, 0), 30, 46, n_ring=7, n_limbs=3, trunk_r=2.2, density=0.6, leaf_L=4.6, leaf_W=2.0, tiers=3,
           lean=(4, 18), ell=(1.15, 0.85), fill=0.85)
    return S


SCALE = [1.03, 1.17, 1.36, 1.72, 1.6, 1.62]
# tall plants cast long shadows to the lower right: shift them up-left so the shadow fits
OFFSET = [(16, 20), (24, 34), (30, 36), (14, 18), (4, 4), (12, 16)]
# per-plant render settings: the mound's tall spires would otherwise be darkened by the height-based occlusion
RKW = [{}, {}, dict(ao_low=0.15), {}, {}, {}]
ENV = ['savanna', 'savanna', 'savanna-mound', 'savanna', 'savanna', 'savanna']
PLANTS = [s1_acacia, s2_baobab, s3_termites, s4_tussock, s5_thornbush, s6_sapling]

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
        render(S, ENV[i - 1], out=f'{OUT}/plant-{i}.png', seed=i, scale=scales.get(i, SCALE[i - 1]), offset=OFFSET[i - 1],
               **RKW[i - 1])

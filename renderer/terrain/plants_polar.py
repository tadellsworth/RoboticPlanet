"""Polar decorative plants (plant-polar-1..6)."""
import sys
import numpy as np
from plants_common import *

OUT = 'out/art/biomes/polar'
WIND = np.radians(18)


def p1_frostshrub(seed=1):
    """A frost-rimed shrub, blue-grey branches tipped with ice."""
    rng = np.random.default_rng(seed)
    S = Scene()
    R_dome, H_dome = 76, 46
    tips = []

    def branch(p0, d, L, r, depth):
        n = 6
        sp = wiggle_spine(p0, d, L, n, rng, amp=0.2, upbias=0.04)
        rr = np.hypot(sp[:, 0], sp[:, 1]) / R_dome
        sp[:, 2] = np.minimum(sp[:, 2], H_dome * np.sqrt(np.clip(1 - rr ** 2, 0.02, 1)) + 2)
        sp[:, 2] = np.maximum(sp[:, 2], 0.8)
        t = min(1, depth / 3)
        add_tube(S, sp, r, r * 0.62, nseg=6, col=lerpc('#3c4650', '#66727e', t), col_tip=lerpc('#4c5864', '#8494a2', t),
                 mat=3, spec=0.1, snow=0.18)
        if depth >= 3:
            tips.append((sp[-1], nrm(sp[-1] - sp[-2])))
            for j in range(2):
                q = sp[rng.integers(3, n)]
                dd = nrm(rng.normal(size=3) + np.array([0, 0, 0.5]))
                tw = np.stack([q + dd * 7 * x for x in np.linspace(0, 1, 3)])
                add_tube(S, tw, r * 0.6, 0.15, nseg=4, col='#7e8e9c', mat=3, snow=0.1)
                tips.append((tw[-1], dd))
            return
        for j in range(rng.integers(2, 4)):
            i = int(rng.uniform(0.35, 0.95) * (n - 1))
            out = nrm(np.array([sp[i, 0], sp[i, 1], 0]) + 1e-3)
            nd = nrm(nrm(sp[min(i + 1, n - 1)] - sp[max(i - 1, 0)]) + rng.normal(size=3) * 0.6 + out * 0.4
                     + np.array([0, 0, 0.25]))
            branch(sp[i], nd, L * rng.uniform(0.58, 0.75), r * 0.64, depth + 1)

    for k in range(12):
        yaw = 2 * np.pi * k / 12 + rng.uniform(-0.2, 0.2)
        pitch = rng.uniform(np.radians(28), np.radians(64))
        d = np.array([np.cos(pitch) * np.cos(yaw), np.cos(pitch) * np.sin(yaw), np.sin(pitch)])
        branch(np.array([rng.uniform(-3, 3), rng.uniform(-3, 3), 0.5]), d, rng.uniform(40, 50), 3.2, 0)
    # rime: ice crystal clusters on the tips
    for p, d in tips:
        if rng.uniform() < 0.35:
            continue
        for q in range(1):
            c = p + d * rng.uniform(0, 1.0)
            r = rng.uniform(1.0, 1.7)
            oriented_blob(S, c, (r * 1.4, r, r), yaw=np.arctan2(d[1], d[0]), pitch=np.arcsin(np.clip(d[2], -1, 1)),
                          col='#d4ecf8', col2='#f2fbff', mat=5, spec=0.6, gloss=40, nu=6, nv=8, zmin=None,
                          disp=lambda dd: 0.25 * np.sin(dd[:, 0] * 9) * np.sin(dd[:, 1] * 7))
    # snow around the foot
    rf = lobed(30, rng, k=5)
    V, F, u, v = patch((4, -4), rf, lambda x, y: 3.5 * np.clip(1 - (np.hypot(x, y) / 32) ** 2, 0, 1) + 0.5, step=1.2)
    S.add(V, F, attrs(len(V), '#eef3f8', mat=6, spec=0.08, gloss=20))
    return S


def p2_drift(seed=2):
    """A small snow drift with dry grass blades poking through."""
    rng = np.random.default_rng(seed)
    S = Scene()
    rf0 = lobed(1.0, rng, k=4, amp=(0.02, 0.06), fmax=4)

    def rf(th):
        th = np.asarray(th)
        a = th - WIND
        return 44 * rf0(th) / np.sqrt((np.cos(a) / 1.25) ** 2 + (np.sin(a) / 0.7) ** 2) * 0.82

    def hf(x, y):
        c, s = np.cos(WIND), np.sin(WIND)
        a = (c * x + s * y) / 52
        b = (-s * x + c * y) / 30
        prof = np.where(a < -0.2, np.clip(1 - ((a + 0.2) / 0.8) ** 2, 0, 1), np.clip(1 - ((a + 0.2) / 1.2) ** 2, 0, 1) ** 0.8)
        P = np.stack([x, y, np.zeros_like(x)], -1).reshape(-1, 3)
        return 11 * prof * np.clip(1 - b ** 2, 0, 1) + 0.8 * sinnoise(P, 21, 0.25, 10).reshape(x.shape) + 0.6
    V, F, u, v = patch((0, 0), rf, hf, step=1.0, edge=6)
    S.add(V, F, attrs(len(V), '#eef3f8', mat=6, spec=0.08, gloss=20))
    # grass clumps poking through
    for (cx, cy, nb) in [(-8, 4, 26), (14, -6, 20), (-26, -8, 12), (28, 10, 12), (2, 14, 10)]:
        z0 = float(hf(np.array([cx]), np.array([cy]))[0])
        for i in range(nb):
            yaw = rng.uniform(0, 2 * np.pi)
            tone = rng.uniform()
            col = lerpc('#7e6c48', '#8c826e', tone)
            add_leaf(S, (cx + rng.normal() * 2.5, cy + rng.normal() * 2.5, z0 * 0.7), yaw, rng.uniform(24, 40), 1.9,
                     np.radians(rng.uniform(48, 78)), np.radians(rng.uniform(5, 40)), shape='blade', n=8, ncross=3,
                     fold=0.3, col=col, col_tip=lerpc('#b8a274', '#c8bc9c', tone), mat=0, spec=0.1, trans=0.25,
                     pitch_curve=1.2)
    return S


def p3_conifer(seed=3):
    """A small conifer seen from above, a dark green star of branches dusted with snow."""
    rng = np.random.default_rng(seed)
    S = Scene()
    levels = [(6, 54, 7), (18, 46, 7), (30, 37, 6), (41, 28, 6), (51, 19, 5), (60, 11, 5)]
    off = 0
    for z, L, nb in levels:
        for k in range(nb):
            yaw = 2 * np.pi * k / nb + off + rng.uniform(-0.15, 0.15)
            Lb = L * rng.uniform(0.88, 1.08)
            sp, yws = arc_spine((0, 0, z), yaw, Lb, np.radians(8), np.radians(-14), 12)
            s = np.linspace(0, 1, 12)
            w = (10.5 * (1 - s) ** 0.7 + 1.5) * (0.82 + 0.18 * np.sin(s * 38 + k)) * (0.6 + 0.4 * min(1, L / 40))
            V, F, u, v = ribbon(sp, w, yaws=yws, ncross=7, fold=-0.25, droop_edges=0.3)
            col = lerpc('#1a3226', '#284836', smoothstep(0.1, 1, u))
            S.add(V, F, attrs(len(V), col, col2='#2f5440', u=u, v=v, mat=4, spec=0.05, snow=0.5, gloss=12))
            # side sprigs
            for t in (0.35, 0.6):
                i = int(t * 11)
                for sg in (-1, 1):
                    add_leaf(S, sp[i], yws[i] + sg * 0.9, Lb * 0.36 * (1 - t * 0.5), 4.2, np.radians(4), np.radians(-16),
                             shape='lance', n=6, ncross=5, fold=-0.2, col='#1c3628', col_tip='#2a4a38', col2='#2f5440',
                             mat=4, spec=0.04, snow=0.45, trans=0.0)
        off += np.pi / nb
    add_tube(S, np.array([[0, 0, 0], [0, 0, 30], [0, 0, 62], [0, 0, 70]], float), 3.5, 0.6, nseg=6, col='#2a3a2c', mat=3, snow=0.4)
    return S


def p4_lichenstone(seed=4):
    """A low stone patched with pale lilac and rust-orange lichen."""
    rng = np.random.default_rng(seed)
    S = Scene()

    def disp(d):
        return 0.08 * sinnoise(d * 3, 41, 1.2, 10) + 0.04 * sinnoise(d * 3, 42, 3.5, 10)
    V, F, u, v = blob((0, 0, -3), (50, 38, 16), 40, 64, disp)
    V = rot_z(V, np.radians(15))
    V[:, 2] = np.maximum(V[:, 2], 0.3)
    n_l = sinnoise(V, 43, 0.09, 14)
    n_r = sinnoise(V, 44, 0.11, 14)
    stone = lerpc('#605852', '#76706a', smoothstep(-1, 1, sinnoise(V, 45, 0.05, 10)))
    lil = smoothstep(0.5, 0.85, n_l)
    rust = smoothstep(0.3, 0.7, n_r) * (1 - lil)
    col = stone + (C('#aea3b3') - stone) * lil[:, None]
    col = col + (C('#a35a34') - col) * rust[:, None]
    col2 = col * 0.82 + 0.18 * C('#d0c4cc')
    S.add(V, F, attrs(len(V), col, col2=col2, u=u, v=v, mat=2, spec=0.06, snow=0.0, gloss=10))
    # snow tucked against the stone (leeward, down-right) and a cap on the top
    rf = lobed(1.0, rng, k=5)
    V2, F2, u2, v2 = patch((30, -22), lambda th: 24 * rf(th), lambda x, y: 2.8 * np.clip(1 - (np.hypot(x, y) / 26) ** 2, 0, 1) + 0.4,
                           step=1.0, edge=5)
    S.add(V2, F2, attrs(len(V2), '#eef3f8', mat=6, spec=0.08))
    return S


def p5_reeds(seed=5):
    """A clump of frozen reeds crusted with ice."""
    rng = np.random.default_rng(seed)
    S = Scene()
    # frozen puddle at the base
    rf = lobed(34, rng, k=6)
    V, F, u, v = patch((0, 0), rf, lambda x, y: 1.0 + 0.0 * x, step=1.5, edge=2)
    S.add(V, F, attrs(len(V), '#a9c8dc', col2='#cfe3ef', mat=5, spec=0.7, gloss=60))
    for i in range(30):
        yaw = rng.uniform(0, 2 * np.pi)
        lean = np.radians(rng.uniform(22, 52))
        L = rng.uniform(40, 62)
        o = np.array([rng.normal() * 5, rng.normal() * 5, 0.5])
        d = np.array([np.cos(yaw) * np.sin(lean), np.sin(yaw) * np.sin(lean), np.cos(lean)])
        broken = rng.uniform() < 0.3
        n = 10
        if broken:
            k = rng.uniform(0.4, 0.65)
            d2 = nrm(np.array([np.cos(yaw), np.sin(yaw), 0]) * 1.0 - np.array([0, 0, 0.6]))
            p1 = o + d * L * k
            sp = np.concatenate([np.stack([o + d * L * k * t for t in np.linspace(0, 1, 6)]),
                                 np.stack([p1 + d2 * L * (1 - k) * 0.7 * t for t in np.linspace(0, 1, 5)[1:]])])
        else:
            bend = rng.uniform(0.0, 0.25)
            sp = np.stack([o + d * L * t + np.array([np.cos(yaw), np.sin(yaw), 0]) * bend * L * t ** 2 for t in np.linspace(0, 1, n)])
        tone = rng.uniform()
        add_tube(S, sp, 2.3, 0.9, nseg=6, col=lerpc('#5e5a40', '#76705a', tone), col_tip=lerpc('#8a8268', '#a09880', tone),
                 mat=3, spec=0.1, snow=0.3)
        # ice crust beads along the lower part and at the tip
        for t in rng.uniform(0.05, 0.55, rng.integers(1, 4)):
            j = int(t * (len(sp) - 1))
            r = rng.uniform(2.2, 3.8)
            dd = nrm(sp[min(j + 1, len(sp) - 1)] - sp[j])
            oriented_blob(S, sp[j], (r * 1.8, r, r), yaw=np.arctan2(dd[1], dd[0]), pitch=np.arcsin(np.clip(dd[2], -1, 1)),
                          col='#bcdcec', col2='#e6f4fb', mat=5, spec=0.6, gloss=40, nu=7, nv=10, zmin=None,
                          disp=lambda q: 0.2 * np.sin(q[:, 0] * 8) * np.cos(q[:, 2] * 6))
        if rng.uniform() < 0.6:
            oriented_blob(S, sp[-1], (2.0, 2.0, 2.4), col='#d8eef8', col2='#f4fbff', mat=5, spec=0.6, gloss=40,
                          nu=6, nv=8, zmin=None)
    return S


def p6_frostflower(seed=6):
    """A frost flower: a delicate pale blue-white crystalline bloom, low to the ground."""
    rng = np.random.default_rng(seed)
    S = Scene()

    def frond(origin, yaw, L, p0, p1, nb, width):
        sp, yws = arc_spine(origin, yaw, L, p0, p1, 12)
        add_tube(S, sp, 1.5, 0.4, nseg=5, col='#4f84ae', col_tip='#b4dcf2', mat=5, spec=0.5, gloss=50)
        s = np.linspace(0, 1, 12)
        T = tangents(sp)
        for i in range(1, 11):
            t = s[i]
            Lb = width * np.sin(np.pi * (0.15 + 0.8 * t)) * (1 - 0.4 * t) + 1.5
            ph = np.arcsin(np.clip(T[i, 2], -1, 1))
            for sg in (-1, 1):
                add_leaf(S, sp[i], yws[i] + sg * np.radians(48), Lb, 1.25, ph + 0.15, ph - 0.1, shape='blade', n=4,
                         ncross=3, fold=0.0, col=lerpc('#6a9ec6', '#a6d0ea', t), col_tip='#e4f5fe', col2='#ffffff',
                         mat=5, spec=0.55, trans=0.5, gloss=60)

    nf = 13
    for k in range(nf):
        yaw = 2 * np.pi * k / nf + rng.uniform(-0.1, 0.1)
        frond((0, 0, 3), yaw, rng.uniform(32, 40), np.radians(22), np.radians(-6), 10, 9)
    for k in range(7):
        yaw = 2 * np.pi * k / 7 + 0.3
        frond((0, 0, 4), yaw, rng.uniform(18, 22), np.radians(48), np.radians(20), 8, 6)
    oriented_blob(S, (0, 0, 3), (7, 7, 4.5), col='#44789e', col2='#8cbcda', mat=5, spec=0.5, gloss=40,
                  disp=lambda d: 0.2 * np.sin(d[:, 0] * 11) * np.sin(d[:, 1] * 11))
    return S


SCALE = [1.2, 1.45, 1.55, 1.25, 1.45, 1.7]
PLANTS = [p1_frostshrub, p2_drift, p3_conifer, p4_lichenstone, p5_reeds, p6_frostflower]

if __name__ == '__main__':
    which = [int(a) for a in sys.argv[1:]] or range(1, 7)
    for i in which:
        S = PLANTS[i - 1]()
        render(S, 'polar', out=f'{OUT}/plant-{i}.png', seed=i, scale=SCALE[i - 1])

"""Red desert decorative plants (plant-desert-1..6)."""
import sys
import numpy as np
from plants_common import *

OUT = 'out/art/biomes/desert'


def p1_lichen(seed=3):
    """Flat crust of rust-red and dull-orange lichen spreading over the sand."""
    rng = np.random.default_rng(seed)
    S = Scene()
    spots = [((0, 0), 44), ((36, -30), 15), ((-42, 18), 13), ((22, 36), 10), ((-26, -32), 9)]
    for i, ((cx, cy), R) in enumerate(spots):
        rf = lobed(R, rng, k=7, amp=(0.08, 0.22), fmax=10)
        sd = int(rng.integers(0, 1000))

        def hf(x, y, sd=sd, R=R):
            P = np.stack([x, y, np.zeros_like(x)], -1)
            n = sinnoise(P.reshape(-1, 3), sd, freq=0.42, n=16).reshape(x.shape)
            r = np.hypot(x, y) / R
            rim = 0.9 * smoothstep(0.6, 0.95, r)
            return 1.6 + 0.9 * np.clip(n, -1.2, 2.0) + rim
        V, F, u, v = patch((cx, cy), rf, hf, step=1.0, edge=3.5)
        # concentric growth rings: older greyer centre, rust band, dull-orange growing edge
        ring = 0.5 + 0.5 * np.sin(u * np.pi * 3.2 + i)
        base = lerpc('#6b4636', '#7c3424', smoothstep(0.15, 0.55, u))
        base = base + (C('#93582c') - base) * (smoothstep(0.62, 0.95, u) * 0.85)[:, None]
        base = base * (0.92 + 0.12 * ring)[:, None]
        S.add(V, F, attrs(len(V), base, col2='#a2683a', u=u, v=v, mat=2, spec=0.05, gloss=8))
    return S


def p2_succulent(seed=5):
    """Small spiny succulent rosette, dark maroon and dusty olive, thick pointed leaves."""
    rng = np.random.default_rng(seed)
    S = Scene()
    rings = [  # count, length, width, pitch0, pitch1, colours
        (9, 58, 11.5, np.radians(24), np.radians(-6), '#5c6140', '#552430'),
        (7, 44, 10.5, np.radians(46), np.radians(14), '#626a44', '#5e2733'),
        (5, 28, 8.5, np.radians(66), np.radians(44), '#6b7149', '#6a2c37'),
    ]
    off = 0
    for ri, (cnt, Lg, W, p0, p1, cb, ct) in enumerate(rings):
        for k in range(cnt):
            yaw = 2 * np.pi * k / cnt + off + rng.uniform(-0.12, 0.12)
            L = Lg * rng.uniform(0.9, 1.08)
            sp = thick_leaf(S, (0, 0, 2.0 + ri * 3), yaw, L, W, p0, p1, thick=0.5, shape='point', concave=0.35,
                            col=cb, col_tip=ct, tip_from=0.35, mat=3, spec=0.22, gloss=14)
            # terminal spine
            T = nrm(sp[-1] - sp[-3])
            tip = np.stack([sp[-2], sp[-1] + T * 5.5], 0)
            tip = np.stack([tip[0] + (tip[1] - tip[0]) * t for t in np.linspace(0, 1, 4)])
            add_tube(S, tip, 1.1, 0.05, nseg=5, col='#2a1416', mat=0, spec=0.1)
            # a few edge spines on the outer rings
            if ri < 2:
                side = np.array([-np.sin(yaw), np.cos(yaw), 0])
                for t in (0.35, 0.6):
                    j = int(t * (len(sp) - 1))
                    w = leaf_width(t, W, 'point')
                    for sg in (-1, 1):
                        b = sp[j] + side * sg * w * 0.95
                        e = b + side * sg * 3.6 + np.array([0, 0, 1.2])
                        add_tube(S, np.stack([b + (e - b) * q for q in np.linspace(0, 1, 3)]), 0.55, 0.03,
                                 nseg=4, col='#3a2224', mat=0)
        off += np.pi / cnt
    return S


def p3_scrub(seed=8):
    """Dry, wiry scrub bush, bleached pale grey-tan, thin tangled branches."""
    rng = np.random.default_rng(seed)
    S = Scene()
    R_dome, H_dome = 84, 50

    def branch(p0, d, L, r, depth):
        n = 6
        sp = wiggle_spine(p0, d, L, n, rng, amp=0.25, upbias=0.03)
        rr = np.hypot(sp[:, 0], sp[:, 1]) / R_dome
        sp[:, 2] = np.minimum(sp[:, 2], H_dome * np.sqrt(np.clip(1 - rr ** 2, 0.02, 1)) + 2)
        sp[:, 2] = np.maximum(sp[:, 2], 0.8)
        t = min(1, depth / 3)
        add_tube(S, sp, r, r * 0.6, nseg=6 if r > 1 else 5,
                 col=lerpc('#5f5040', '#a8946f', t), col_tip=lerpc('#7d6c55', '#c3b08c', t), mat=3, spec=0.06)
        if depth >= 3:
            # twiggy ends
            for j in range(rng.integers(2, 4)):
                q = sp[rng.integers(2, n)]
                dd = nrm(rng.normal(size=3) + np.array([0, 0, 0.4]))
                tw = np.stack([q, q + dd * rng.uniform(5, 9)])
                tw = np.stack([tw[0] + (tw[1] - tw[0]) * x for x in np.linspace(0, 1, 3)])
                add_tube(S, tw, r * 0.55, 0.12, nseg=4, col='#b9a582', mat=3)
            return
        nk = rng.integers(2, 5)
        for j in range(nk):
            t0 = rng.uniform(0.3, 0.95)
            i = int(t0 * (n - 1))
            out = nrm(np.array([sp[i, 0], sp[i, 1], 0]) + 1e-3)
            nd = nrm(nrm(sp[min(i + 1, n - 1)] - sp[max(i - 1, 0)]) + rng.normal(size=3) * 0.7 + out * 0.4
                     + np.array([0, 0, 0.2]))
            branch(sp[i], nd, L * rng.uniform(0.55, 0.75), r * 0.64, depth + 1)

    nmain = 13
    for k in range(nmain):
        yaw = 2 * np.pi * k / nmain + rng.uniform(-0.2, 0.2)
        pitch = rng.uniform(np.radians(22), np.radians(62))
        d = np.array([np.cos(pitch) * np.cos(yaw), np.cos(pitch) * np.sin(yaw), np.sin(pitch)])
        branch(np.array([rng.uniform(-4, 4), rng.uniform(-4, 4), 0.5]), d, rng.uniform(40, 52), 2.8, 0)
    for k in range(6):
        yaw = rng.uniform(0, 2 * np.pi)
        p = np.array([np.cos(yaw), np.sin(yaw), 0]) * rng.uniform(25, 70)
        d = np.array([np.cos(yaw + 1.3), np.sin(yaw + 1.3), 0.02])
        sp = wiggle_spine(p + np.array([0, 0, 0.7]), d, rng.uniform(10, 18), 4, rng, amp=0.15)
        sp[:, 2] = 0.7
        add_tube(S, sp, 1.0, 0.5, nseg=5, col='#9a8668', mat=3)
    return S


def p4_creeper(seed=21):
    """Low creeper with a few dark, leathery seed pods."""
    rng = np.random.default_rng(seed)
    S = Scene()
    nrun = 7
    runners = []
    for k in range(nrun):
        yaw = 2 * np.pi * k / nrun + rng.uniform(-0.35, 0.35)
        L = rng.uniform(72, 96)
        n = 26
        s_ = np.linspace(0, 1, n)
        turn = np.cumsum(rng.normal(size=n) * 0.09) + rng.uniform(-0.7, 0.7) * s_ ** 1.5
        yw = yaw + turn
        d = np.stack([np.cos(yw), np.sin(yw), np.zeros(n)], -1)
        sp = np.cumsum(d * L / (n - 1), 0) - d[0] * L / (n - 1)
        sp[:, 2] = 1.3 + 2.0 * np.sin(s_ * np.pi) * (1 - s_) + 0.4 * np.sin(s_ * 17 + k)
        add_tube(S, sp, 2.0, 1.0, nseg=6, col='#58462e', col_tip='#6e5c3c', mat=3, spec=0.08)
        runners.append((sp, yw))
        j = 2
        while j < n - 1:
            t = s_[j]
            side = rng.choice([-1, 1])
            lyaw = yw[j] + side * rng.uniform(0.5, 1.4)
            Ll = rng.uniform(10, 16) * (1 - 0.4 * t)
            add_leaf(S, sp[j] + np.array([0, 0, 0.4]), lyaw, Ll, rng.uniform(4.2, 5.8) * (1 - 0.3 * t),
                     np.radians(rng.uniform(10, 35)), np.radians(rng.uniform(-15, 5)),
                     shape='ovate', n=8, ncross=5, fold=0.35, roll=rng.uniform(-0.4, 0.4),
                     col=lerpc('#4d4a2c', '#5e5634', rng.uniform()), col_tip='#7a7048', col2='#3e3a22',
                     mat=1, spec=0.16, trans=0.15)
            j += int(rng.integers(2, 4))
    picks = [(0, 0.35), (2, 0.5), (4, 0.3), (5, 0.6)]
    for ri, t in picks:
        sp, yw = runners[ri]
        i = int(t * (len(sp) - 1))
        yaw = yw[i] + np.pi / 2 * rng.choice([-1, 1]) + rng.uniform(-0.4, 0.4)
        c = sp[i] + np.array([np.cos(yaw), np.sin(yaw), 0]) * 6
        c[2] = 5.6

        def disp(d):
            return 0.07 * np.cos(np.arctan2(d[:, 2], d[:, 1]) * 4) * (1 - d[:, 0] ** 2)
        oriented_blob(S, c, (14, 7.0, 6.0), yaw=yaw, pitch=np.radians(6), disp=disp,
                      col=lambda u, v, V: lerpc('#3a2420', '#5a3a2e', smoothstep(0.2, 0.9, np.abs(np.sin(v * np.pi * 2)))),
                      col2='#2a1a18', mat=3, spec=0.34, gloss=26, zmin=0.6)
        ax = np.array([np.cos(yaw), np.sin(yaw), 0])
        a = c + ax * 13.5
        add_tube(S, np.stack([a, a + ax * 3.5 + np.array([0, 0, 1])]), 1.3, 0.3, nseg=5, col='#2e201c', mat=0)
        b = c - ax * 13.5
        add_tube(S, np.stack([b, sp[i] + np.array([0, 0, 1.5])]), 1.4, 1.1, nseg=5, col='#4a3a28', mat=3)
    return S


def p5_coral(seed=4):
    """Fan-shaped dry plant like dead coral, faded brick red."""
    rng = np.random.default_rng(seed)
    S = Scene()

    def fan(origin, yaw, tilt, H, spread):
        out = np.array([np.cos(yaw), np.sin(yaw), 0])
        side = np.array([-np.sin(yaw), np.cos(yaw), 0])
        upv = np.array([0, 0, 1.0]) * np.cos(tilt) + out * np.sin(tilt)

        def to3(a, b):
            return origin + side * a + upv * b

        def grow(a, b, ang, L, r, depth):
            n = 5
            pts = []
            for i in range(n):
                t = i / (n - 1)
                angt = ang + rng.normal() * 0.05
                pts.append((a + np.sin(angt) * L * t, b + np.cos(angt) * L * t))
            pts = np.array(pts)
            sp = np.array([to3(x, y) for x, y in pts])
            sp[:, 2] = np.maximum(sp[:, 2], 0.6)
            tcol = depth / 5
            add_tube(S, sp, r, r * 0.8, nseg=6, col=lerpc('#6e3428', '#8a4a3a', tcol),
                     col_tip=lerpc('#7e3e30', '#a66a58', tcol), mat=3, spec=0.07)
            ea, eb = pts[-1]
            if depth >= 5:
                oriented_blob(S, sp[-1], (r * 1.3, r * 1.3, r * 1.3), col='#b0786a', mat=3, spec=0.06, nu=8, nv=10)
                return
            sp_ang = spread * rng.uniform(0.75, 1.2)
            for sgn in (-1, 1):
                grow(ea, eb, ang + sgn * sp_ang + rng.normal() * 0.08, L * rng.uniform(0.7, 0.82), r * 0.78, depth + 1)

        grow(0, 0, 0, H * 0.26, 4.2, 0)

    fans = [(np.radians(-95), np.radians(40), 76), (np.radians(10), np.radians(55), 66),
            (np.radians(170), np.radians(55), 64), (np.radians(95), np.radians(35), 52)]
    for yaw, tilt, H in fans:
        o = np.array([np.cos(yaw), np.sin(yaw), 0]) * 4
        fan(o, yaw, tilt, H, np.radians(27))
    # stony holdfast at the base
    oriented_blob(S, (0, 0, 1), (9, 8, 4), col='#6a3a30', mat=3, spec=0.05,
                  disp=lambda d: 0.12 * np.sin(d[:, 0] * 7) * np.cos(d[:, 1] * 6))
    return S


def p6_grass(seed=12):
    """A few tufts of stiff, pale ochre grass."""
    rng = np.random.default_rng(seed)
    S = Scene()
    tufts = [((-26, 12), 30, 1.0), ((24, 22), 26, 0.9), ((10, -24), 28, 0.95), ((-20, -30), 14, 0.65), ((42, -10), 12, 0.6)]
    for (cx, cy), nb, sc in tufts:
        for i in range(nb):
            yaw = rng.uniform(0, 2 * np.pi)
            L = rng.uniform(34, 52) * sc
            p0 = np.radians(rng.uniform(50, 78))
            p1 = np.radians(rng.uniform(5, 38))
            o = (cx + rng.normal() * 2.5, cy + rng.normal() * 2.5, 0.5)
            tone = rng.uniform(0, 1)
            tip = lerpc('#c0a66c', '#d8c088', tone)
            base = lerpc('#6a5634', '#7e6840', tone)
            if rng.uniform() < 0.15:
                tip = C('#9a8458')
            add_leaf(S, o, yaw, L, 2.1, p0, p1, shape='blade', n=9, ncross=3, fold=0.3, col=base, col_tip=tip,
                     mat=0, spec=0.12, trans=0.25, pitch_curve=1.2)
        oriented_blob(S, (cx, cy, 0.8), (7 * sc, 7 * sc, 3), col='#6a5636', mat=3, spec=0.03)
    return S


SCALE = [1.0, 1.15, 1.25, 1.1, 1.35, 1.1]
PLANTS = [p1_lichen, p2_succulent, p3_scrub, p4_creeper, p5_coral, p6_grass]

if __name__ == '__main__':
    which = [int(a) for a in sys.argv[1:]] or range(1, 7)
    for i in which:
        S = PLANTS[i - 1]()
        render(S, 'desert', out=f'{OUT}/plant-{i}.png', seed=i, scale=SCALE[i - 1])

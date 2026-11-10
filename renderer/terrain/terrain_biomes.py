"""Jungle and Polar ground / water / rock (512 seamless) and cliffs (128x48, tile left-right)."""
import sys
import numpy as np
from tex import *

N = 512


def over(col, rgb, a):
    a = np.clip(a, 0, 1)[..., None]
    return col * (1 - a) + np.asarray(rgb) * a


def ds_rgba(p, ss):
    a = p[..., 3:4]
    pm = np.concatenate([p[..., :3] * a, a], -1)
    pm = downsample(pm, ss)
    a = pm[..., 3:4]
    return np.concatenate([np.where(a > 1e-6, pm[..., :3] / np.maximum(a, 1e-6), 0), a], -1)


def leaf_patch(L, Wd, ang, col, vein, ss=4, shadow=(1.6, 1.8), sh_op=0.4, curl=0.0, rng=None):
    pad = int(L / 2 + 6)
    S = 2 * pad * ss
    ys, xs = (np.mgrid[0:S, 0:S] + 0.5) / ss - pad
    c, s = np.cos(ang), np.sin(ang)
    out = np.zeros((S, S, 4))

    def shape(x, y):
        a = (c * x + s * y) / (L / 2)
        b = (-s * x + c * y)
        b = b - curl * (a ** 2 - 0.3) * Wd
        half = Wd * 0.5 * np.sqrt(np.clip(1 - a ** 2, 0, 1)) * (1 - 0.25 * a)
        return a, b, half
    a, b, half = shape(xs - shadow[0], ys - shadow[1])
    sm = np.clip((half - np.abs(b)) * 1.2 + 0.4, 0, 1) * (np.abs(a) < 1)
    out[..., :3] = np.array([0.05, 0.04, 0.02])
    out[..., 3] = ndimage.gaussian_filter(sm, ss * 0.8) * sh_op
    a, b, half = shape(xs, ys)
    m = np.clip((half - np.abs(b)) * ss * 0.5, 0, 1) * (np.abs(a) < 1)
    colv = np.asarray(col)[None, None] * (0.85 + 0.25 * (b / (half + 1e-6)) * -np.sign(s + 1e-3) * 0.4 + 0.1 * (1 - np.abs(a)))[..., None]
    mid = np.exp(-(b / 0.35) ** 2) * (np.abs(a) < 0.95)
    colv = colv * (1 - 0.5 * mid[..., None]) + np.asarray(vein) * 0.5 * mid[..., None]
    out[..., :3] = out[..., :3] * (1 - m[..., None]) + colv * m[..., None]
    out[..., 3] = out[..., 3] * (1 - m) + m
    return ds_rgba(out, ss)


def ridged(seed, f_lo, f_hi, beta=2.0):
    return (1 - np.abs(fbm(N, seed, f_lo, f_hi, beta=beta))) ** 2


def cast_shadow(H, steps=28, el=40):
    """Heightfield self-shadowing for light from the top-left (periodic)."""
    t = np.tan(np.radians(el))
    occ = np.zeros_like(H)
    for k in range(1, steps + 1):
        d = k / np.sqrt(2)
        sh = np.roll(np.roll(H, int(round(d)), 0), int(round(d)), 1)  # sample toward the light (up-left)
        occ = np.maximum(occ, sh - H - k * t)
    return 1 - smoothstep(0.0, 2.5, occ)


def crag_height(seed, n_blocks=26, amp=22):
    rng = np.random.default_rng(seed)
    pts = rng.uniform(0, 1, (n_blocks, 2))
    F1, F2, ID = worley(N, pts)
    hc = rng.uniform(0, 1, n_blocks)
    blocks = hc[ID] * 0.6 + (F2 - F1) * N / 40.0
    blocks = np.minimum(blocks, hc[ID] * 0.6 + 0.9)
    r = ridged(seed + 1, 3, 60) * 0.7 + ridged(seed + 2, 8, 120) * 0.3
    H = amp * (0.4 * blocks + 0.6 * r) + 0.9 * fbm(N, seed + 3, 40, 256, beta=1.4)
    edge = (F2 - F1) * N
    H -= 6 * (1 - smoothstep(0, 4, edge + 2 * fbm(N, seed + 4, 20, 100, beta=1.2)))
    return H, edge, r


# ============================================================================ JUNGLE

def jungle_ground():
    rng = np.random.default_rng(71)
    z1 = fbm(N, 701, 4, 64, beta=2.0)
    col = mix(hexrgb('#30231a'), hexrgb('#4a3626'), smoothstep(-1.2, 1.2, z1))
    damp = smoothstep(0.3, 1.2, fbm(N, 702, 4, 32, beta=2.0))
    col = over(col, hexrgb('#21180f'), damp * 0.55)
    grain = fbm(N, 703, 60, 256, beta=1.0)
    col = col * (1 + 0.08 * grain)[..., None]
    hs = fbm(N, 704, 8, 160, beta=1.7)
    col = col * (0.72 + 0.28 * relief(normals_from_height(hs * 6), 225, 50))[..., None]
    # moss patches
    mm = fbm(N, 705, 3, 24, beta=2.0) + 0.35 * fbm(N, 706, 16, 80, beta=1.5)
    M = smoothstep(0.35, 1.05, mm)
    mh = fbm(N, 707, 50, 256, beta=0.8)
    mcol = mix(hexrgb('#2a3b1b'), hexrgb('#3f5524'), smoothstep(-1.0, 1.4, mh + 0.6 * fbm(N, 708, 6, 40, beta=2.0)))
    mcol = over(mcol, hexrgb('#56702c'), smoothstep(1.2, 2.2, mh) * 0.6)
    Hm = M * 3.0 + M * 1.2 * mh
    mlit = relief(normals_from_height(Hm * 1.8), 225, 50)
    mcol = mcol * (0.6 + 0.42 * mlit)[..., None]
    col = over(col, mcol, smoothstep(0.0, 0.6, M) * 0.95)
    img = np.concatenate([col, np.ones((N, N, 1))], -1)
    # twigs
    for i in range(14):
        x, y = rng.uniform(0, N, 2)
        L = rng.uniform(12, 26)
        ang = rng.uniform(0, np.pi)
        p = leaf_patch(L, 1.6, ang, hexrgb(['#3a2a1a', '#4a3622', '#2e2216'][i % 3]), hexrgb('#2a1c12'), sh_op=0.35)
        stamp(img, p, x, y)
    # leaf litter (fewer on moss)
    cols = ['#5e4228', '#6a4c2c', '#4e3420', '#76603a', '#464426', '#57402a', '#3a3620', '#634428', '#6e5232']
    placed = 0
    while placed < 280:
        x, y = rng.uniform(0, N, 2)
        if rng.uniform() < 0.75 * M[int(y) % N, int(x) % N]:
            continue
        L = rng.uniform(9, 19)
        cc = hexrgb(cols[rng.integers(len(cols))]) * rng.uniform(0.9, 1.15)
        p = leaf_patch(L, L * rng.uniform(0.28, 0.5), rng.uniform(0, np.pi * 2), cc, cc * 0.6,
                       curl=rng.uniform(-0.25, 0.25))
        stamp(img, p, x, y)
        placed += 1
    return img[..., :3]


def jungle_water():
    """Same construction as the desert brine (so the biomes feel related), murky olive-brown palette."""
    z1 = fbm(N, 721, 4, 64, beta=2.0)
    z2 = fbm(N, 722, 4, 64, beta=2.0)
    col = np.ones((N, N, 3)) * hexrgb('#3d3f25')
    col = over(col, hexrgb('#2a2c1a'), 0.05 + 0.15 * z1)
    col = over(col, hexrgb('#55502e'), -0.1 - 0.15 * z2)
    col = over(col, hexrgb('#4a3a24'), smoothstep(0.4, 1.6, fbm(N, 728, 3, 20, beta=2.2)) * 0.35)
    h = fbm(N, 723, 3, 48, beta=2.0, aniso=(1.0, 3.0), angle=0.1) + 0.035 * fbm(N, 724, 30, 160, beta=1.5, aniso=(1.0, 3.0))
    H = 0.5 + 0.12 * zscore(h)
    col = col * (0.65 + 0.35 * 1.2 * lambert(normals_from_height(H * 13.0), 225, 55))[..., None]
    sheen_n = fbm(N, 726, 5, 40, beta=2.2, aniso=(1.0, 2.2), angle=0.1)
    sheen_a = blur_wrap(np.clip((sheen_n - 0.5) * 0.7, 0, 1), 2.0) * 0.35
    sheen_a *= np.clip(0.55 + 0.35 * zscore(H), 0, 1.2)
    col = over(col, hexrgb('#8a8c5e'), sheen_a)
    col = over(col, hexrgb('#e2e4c4'), 0.9 * spec(normals_from_height(H * 10.4), 26, 225, 38) * 0.45)
    img = np.concatenate([col, np.ones((N, N, 1))], -1)
    rng = np.random.default_rng(72)
    for cl in range(7):
        cx, cy = rng.uniform(0, N, 2)
        for k in range(rng.integers(3, 8)):
            x, y = cx + rng.normal() * 8, cy + rng.normal() * 5
            r = rng.uniform(1.0, 2.0)
            p = leaf_patch(r * 2.2, r * 1.9, rng.uniform(0, 3), hexrgb('#5f6e2e') * rng.uniform(0.9, 1.15),
                           hexrgb('#4a5a24'), shadow=(0.6, 0.7), sh_op=0.25)
            stamp(img, p, x, y)
    return img[..., :3]


def jitter_points(nx, ny, rng, j=0.42):
    pts = []
    for i in range(nx):
        for k in range(ny):
            pts.append(((i + 0.5 + rng.uniform(-j, j) + (0.5 if k % 2 else 0)) / nx % 1.0,
                        (k + 0.5 + rng.uniform(-j, j)) / ny % 1.0))
    return np.array(pts)


def jungle_rock():
    H, edge, r = crag_height(730, n_blocks=24, amp=24)
    Nn = normals_from_height(H)
    shc = cast_shadow(H, 26, 42)
    shade = 0.28 + 0.95 * lambert(Nn, 225, 45) * (0.35 + 0.65 * shc)
    base = mix(hexrgb('#24272a'), hexrgb('#3b3f43'), smoothstep(-1.2, 1.4, fbm(N, 732, 3, 80, beta=1.8)))
    base = base * (1 + 0.08 * fbm(N, 733, 60, 256, beta=0.8))[..., None]
    col = base * shade[..., None]
    wet = spec(Nn, 22, 225, 45) * shc * 0.35 * smoothstep(-0.5, 0.8, fbm(N, 734, 4, 30, beta=2.0))
    col = over(col, hexrgb('#b8c4c8'), wet)
    col = over(col, hexrgb('#0c0d0e'), (1 - smoothstep(0.5, 2.5, edge)) * 0.8)
    low = 1 - smoothstep(-1.0, 0.0, zscore(blur_wrap(H, 3)))
    mn = fbm(N, 735, 8, 120, beta=1.3)
    moss = np.clip(np.maximum((1 - smoothstep(1.5, 8, edge)) * smoothstep(-1.0, 0.2, mn), low * smoothstep(-0.2, 0.8, mn)), 0, 1)
    mcol = mix(hexrgb('#2b431c'), hexrgb('#4f6c29'), smoothstep(-1, 1.5, fbm(N, 737, 60, 256, beta=0.7)))
    mcol = mcol * (0.55 + 0.5 * lambert(normals_from_height(H * 0.5 + 2 * fbm(N, 738, 80, 256, beta=0.7)), 225, 50)
                   * (0.5 + 0.5 * shc))[..., None]
    col = over(col, mcol, smoothstep(0.2, 0.6, moss))
    return col


# ============================================================================ POLAR

WIND = np.radians(18)


def polar_ground():
    rng = np.random.default_rng(81)
    h = fbm(N, 801, 3, 96, beta=2.0, aniso=(1.0, 4.0), angle=WIND) + 0.04 * fbm(N, 802, 40, 256, beta=1.2)
    Nn = normals_from_height(zscore(h) * 3.0)
    sh = relief(Nn, 225, 48)
    lit = mix(hexrgb('#c3d4e6'), hexrgb('#f1f5f9'), smoothstep(0.6, 1.12, sh))
    lit = lit * (1 + 0.02 * fbm(N, 803, 4, 30, beta=2.0))[..., None]
    # wind-scoured ice: smoother, bluer, glossy
    icem = smoothstep(0.55, 0.95, fbm(N, 804, 2, 20, beta=2.2, aniso=(1.0, 3.5), angle=WIND) + 0.12 * fbm(N, 805, 12, 60, beta=1.5)) * 0.85
    hi = fbm(N, 806, 4, 64, beta=2.0)
    Ni = normals_from_height(hi * 1.2)
    icec = mix(hexrgb('#a9c4da'), hexrgb('#cbdeec'), smoothstep(0.7, 1.1, relief(Ni, 225, 48)))
    icec = icec * (1 + 0.03 * fbm(N, 807, 8, 80, beta=1.5))[..., None]
    F1, F2, _ = worley(N, rng.uniform(0, 1, (60, 2)))
    cr = (1 - smoothstep(0.3, 1.4, (F2 - F1) * N)) * smoothstep(0.2, 0.8, fbm(N, 808, 4, 20, beta=2.0))
    icec = over(icec, hexrgb('#eef6fb'), cr * 0.55)
    icec = over(icec, hexrgb('#ffffff'), spec(Ni, 40, 225, 45) * 0.35)
    col = over(lit, icec, icem)
    # grit streaks along the wind
    img = np.concatenate([col, np.ones((N, N, 1))], -1)
    for i in range(16):
        x, y = rng.uniform(0, N, 2)
        L = rng.uniform(18, 56)
        Wd = rng.uniform(1.2, 3.0)
        g = hexrgb('#6c7076') * rng.uniform(0.85, 1.1)
        p = leaf_patch(L, Wd, WIND + rng.normal() * 0.06, g, g, shadow=(0, 0), sh_op=0.0)
        n = fbm(p.shape[0], 900 + i, 3, 24, beta=1.0) if p.shape[0] % 2 == 0 else 0
        p[..., 3] *= rng.uniform(0.6, 0.85) * np.clip(0.6 + 0.5 * n, 0, 1)
        stamp(img, p, x, y)
    # sparse sparkle
    sp = (fbm(N, 809, 120, 256, beta=0.0) > 3.4).astype(float)
    img[..., :3] = over(img[..., :3], np.ones(3), blur_wrap(sp, 0.5) * 0.8)
    return img[..., :3]


def polar_water():
    rng = np.random.default_rng(82)
    z1 = fbm(N, 821, 3, 48, beta=2.0)
    col = mix(hexrgb('#0a121b'), hexrgb('#152739'), smoothstep(-1.4, 1.4, z1))
    h = fbm(N, 822, 4, 90, beta=2.0, aniso=(1.0, 2.5), angle=WIND) + 0.06 * fbm(N, 823, 40, 200, beta=1.3)
    Nn = normals_from_height(zscore(h) * 1.6)
    col = col * (0.75 + 0.3 * relief(Nn, 225, 55))[..., None]
    col = over(col, hexrgb('#9cbcd6'), spec(normals_from_height(zscore(h) * 2.4), 30, 225, 40) * 0.35)
    # ice plates: a sparse set of Voronoi cells, shrunk away from their borders
    pts = rng.uniform(0, 1, (120, 2))
    F1, F2, ID = worley(N, pts)
    keep = rng.uniform(0, 1, len(pts)) < 0.2
    gap = rng.uniform(4, 10, len(pts))
    edge = (F2 - F1) * N + 3.0 * fbm(N, 824, 10, 60, beta=1.2)
    plate = keep[ID] * smoothstep(gap[ID], gap[ID] + 1.6, edge)
    # small brash fragments
    pts2 = rng.uniform(0, 1, (260, 2))
    G1, G2, ID2 = worley(N, pts2)
    keep2 = rng.uniform(0, 1, len(pts2)) < 0.09
    e2 = (G2 - G1) * N + 1.5 * fbm(N, 825, 20, 90, beta=1.0)
    brash = keep2[ID2] * smoothstep(2.5, 3.6, e2) * (1 - plate)
    ice = np.clip(plate + brash, 0, 1)
    tone = rng.uniform(0.92, 1.06, len(pts))[ID]
    icec = mix(hexrgb('#9fbacf'), hexrgb('#d2e2ee'), smoothstep(-1, 1.3, fbm(N, 826, 6, 80, beta=1.6)))
    icec = icec * tone[..., None]
    rim = ice * (1 - smoothstep(1.0, 3.5, np.where(plate > 0, edge - gap[ID], e2 - 2.5)))
    icec = over(icec, hexrgb('#f2f8fc'), rim * 0.7)
    # a thin translucent margin: plate edges show some water through
    a = np.clip(ice, 0, 1) ** 1.3 * 0.9
    shadow = blur_wrap(np.roll(np.roll(ice, 2, 0), 2, 1), 1.2) * (1 - ice)
    col = over(col, hexrgb('#05090e'), shadow * 0.45)
    col = over(col, icec, a)
    return col


def polar_rock():
    H, edge, r = crag_height(830, n_blocks=22, amp=22)
    Nn = normals_from_height(H)
    shc = cast_shadow(H, 26, 42)
    shade = 0.3 + 0.95 * lambert(Nn, 225, 45) * (0.35 + 0.65 * shc)
    base = mix(hexrgb('#5f6267'), hexrgb('#83858a'), smoothstep(-1.2, 1.2, fbm(N, 832, 3, 60, beta=2.0)))
    fine = fbm(N, 833, 110, 256, beta=0.2)
    base = over(base, hexrgb('#2a2a2e'), smoothstep(1.5, 2.1, fine) * 0.6)
    base = over(base, hexrgb('#9c8a84'), smoothstep(1.0, 1.7, fbm(N, 834, 50, 200, beta=0.6)) * 0.35)
    base = over(base, hexrgb('#cfd0cf'), smoothstep(1.7, 2.3, fbm(N, 835, 110, 256, beta=0.2)) * 0.5)
    col = base * shade[..., None]
    col = over(col, hexrgb('#16181c'), (1 - smoothstep(0.5, 2.5, edge)) * 0.8)
    low = 1 - smoothstep(-1.7, -1.0, zscore(blur_wrap(H, 10)))
    sn = np.maximum((1 - smoothstep(1.5, 4.5, edge)) * smoothstep(-0.1, 0.6, fbm(N, 836, 3, 40, beta=1.8)), low)
    sn = np.maximum(sn, smoothstep(0.992, 0.999, Nn[..., 2]) * smoothstep(0.3, 1.2, fbm(N, 839, 4, 30, beta=2.0)) * 0.8)
    hs = H * 0.1 + 1.2 * fbm(N, 837, 20, 160, beta=1.4)
    snc = mix(hexrgb('#aabfd6'), hexrgb('#eef3f8'), smoothstep(0.6, 1.1, relief(normals_from_height(hs), 225, 48)) * (0.4 + 0.6 * shc))
    col = over(col, snc, smoothstep(0.3, 0.65, sn))
    return col


# ============================================================================ CLIFFS (128 x 48, tile left-right)

def cliff(kind):
    ss = 4
    Wc, Hc = 128 * ss, 48 * ss
    rng = np.random.default_rng(91 if kind == 'jungle' else 92)
    ys, xs = np.mgrid[0:Hc, 0:Wc] / ss  # in output px
    yn = ys / 48.0

    def pfbm(seed, f_lo, f_hi, beta=2.0, aniso=(1, 1)):
        # periodic in x (and y over 4x height so it's effectively free)
        f = fbm(Wc, seed, f_lo, f_hi, beta=beta, aniso=aniso)
        return f[:Hc]
    if kind == 'jungle':
        # basalt columns: vertical joints at fixed x (periodic)
        jx = np.cumsum(rng.uniform(18, 30, 6))
        jx = jx / jx[-1] * 128
        jx = np.concatenate([[0], jx])
        k = np.searchsorted(jx, xs % 128, side='right') - 1
        k = np.clip(k, 0, len(jx) - 2)
        x0, x1 = jx[k], jx[k + 1]
        t = (xs % 128 - x0) / (x1 - x0)
        wob = 0.6 * pfbm(901, 2, 20)
        face = 0.55 + 0.45 * np.cos((t - 0.35) * np.pi * 0.9)  # convex column face, lit from the left
        joint = 1 - smoothstep(0.0, 0.07, np.minimum(t, 1 - t) + wob * 0.01)
        base = mix(hexrgb('#2a2d30'), hexrgb('#3c4044'), smoothstep(-1, 1, pfbm(902, 2, 60, 1.8)))
        base = base * rng.uniform(0.88, 1.1, len(jx))[k][..., None]
        col = base * face[..., None]
        # horizontal fractures in each column
        fr = np.zeros_like(xs)
        for c in range(len(jx) - 1):
            for yy in rng.uniform(12, 40, 2):
                m = (k == c) & (np.abs(ys - yy - 1.2 * np.sin(xs * 0.3 + c)) < 0.6)
                fr[m] = 1
        col = over(col, hexrgb('#141516'), np.maximum(joint, fr) * 0.85)
        col = col * (1 + 0.08 * pfbm(903, 40, 200, 0.8))[..., None]
        # wet sheen streaks running down
        streak = smoothstep(0.8, 1.8, pfbm(904, 4, 40, 1.6, aniso=(1, 0.15)))
        col = over(col, hexrgb('#6a7478'), streak * 0.25)
        # darker toward the bottom
        col = col * (1 - 0.6 * smoothstep(0.35, 1.0, yn))[..., None]
        # moss cap along the top with an irregular dripping edge, and moss in some joints
        mt = 7 + 3 * pfbm(905, 3, 24) + 6 * smoothstep(0.6, 1.6, pfbm(906, 6, 30, 1.5))
        mossc = mix(hexrgb('#2f4a1e'), hexrgb('#5a7a2e'), smoothstep(-1, 1.4, pfbm(907, 40, 200, 0.8)))
        mossc = mossc * (1 - 0.45 * smoothstep(0, 1, ys / np.maximum(mt, 1)))[..., None]
        mossm = 1 - smoothstep(mt - 1, mt + 0.6, ys)
        mossm = np.maximum(mossm, joint * smoothstep(0.3, 1.0, pfbm(908, 2, 10)) * (1 - smoothstep(10, 30, ys)))
        col = over(col, mossc, mossm)
        # hanging vines
        img = np.concatenate([col, np.ones((Hc, Wc, 1))], -1)
        for v in range(5):
            vx = rng.uniform(0, 128)
            L = rng.uniform(18, 46)
            amp = rng.uniform(1, 3)
            ph = rng.uniform(0, 6)
            yy = np.linspace(2, L, 200)
            xx = vx + amp * np.sin(yy * 0.25 + ph)
            for (px_, py_) in zip(xx, yy):
                for ox in (-128, 0, 128):
                    cx, cy = (px_ + ox) * ss, py_ * ss
                    if -6 <= cx < Wc + 6:
                        x0_, x1_ = int(max(cx - 4, 0)), int(min(cx + 4, Wc))
                        y0_, y1_ = int(max(cy - 4, 0)), int(min(cy + 4, Hc))
                        if x0_ < x1_ and y0_ < y1_:
                            d = np.hypot(np.arange(x0_, x1_)[None] - cx, np.arange(y0_, y1_)[:, None] - cy)
                            a = np.clip(3.2 - d, 0, 1)
                            g = hexrgb('#3d5a22') * (1 - 0.35 * py_ / 48)
                            img[y0_:y1_, x0_:x1_, :3] = img[y0_:y1_, x0_:x1_, :3] * (1 - a[..., None]) + g * a[..., None]
            for q in range(int(L / 6)):
                ly = rng.uniform(4, L)
                lx = vx + amp * np.sin(ly * 0.25 + ph)
                p = leaf_patch(rng.uniform(4, 6.5) * ss, rng.uniform(2.6, 3.6) * ss, rng.uniform(0.6, 2.5),
                               hexrgb('#4b6e2a') * rng.uniform(0.8, 1.15) * (1 - 0.3 * ly / 48), hexrgb('#2f4a1e'),
                               ss=1, shadow=(1.2 * ss, 1.2 * ss), sh_op=0.5)
                for ox in (-128, 0, 128):
                    cx = (lx + ox) * ss
                    _paste(img, p, cx, ly * ss)
        out = downsample(img[..., :3], ss)
    else:
        # layered granite with snow ledges and icicles
        strata = pfbm(911, 1, 12, 2.0, aniso=(1, 6))
        band = np.sin(ys * 0.55 + 1.6 * strata) * 0.5 + 0.5
        base = mix(hexrgb('#5e6166'), hexrgb('#8a8c90'), smoothstep(0.15, 0.85, band))
        base = base * (1 + 0.1 * pfbm(912, 50, 240, 0.4))[..., None]
        sp = pfbm(913, 100, 256, 0.1)
        base = over(base, hexrgb('#26272a'), smoothstep(1.4, 2.0, sp) * 0.8)
        base = over(base, hexrgb('#a8988f'), smoothstep(1.0, 1.6, pfbm(914, 60, 200, 0.5)) * 0.35)
        # blocky faces: vertical joints lit on the left
        jx = np.cumsum(rng.uniform(20, 40, 5))
        jx = np.concatenate([[0], jx / jx[-1] * 128])
        k = np.clip(np.searchsorted(jx, xs % 128, side='right') - 1, 0, len(jx) - 2)
        t = (xs % 128 - jx[k]) / (jx[k + 1] - jx[k])
        face = 0.7 + 0.3 * np.cos((t - 0.3) * np.pi * 0.8)
        col = base * face[..., None]
        joint = 1 - smoothstep(0.0, 0.05, np.minimum(t, 1 - t))
        col = over(col, hexrgb('#1c1e22'), joint * 0.8)
        col = col * (1 - 0.55 * smoothstep(0.4, 1.0, yn))[..., None]
        # ledges: top cap and one mid ledge
        img = np.concatenate([col, np.ones((Hc, Wc, 1))], -1)
        for (y0, thick, irr) in [(0.0, 7.0, 2.2), (22.0, 3.2, 1.4)]:
            top = y0 + (0 if y0 == 0 else 0.8 * pfbm(915, 2, 12))
            bot = y0 + thick + irr * pfbm(916 + int(y0), 3, 30) + (2.5 * smoothstep(0.8, 1.8, pfbm(918, 4, 20)) if y0 == 0 else 0)
            m = smoothstep(top - 0.4, top + 0.4, ys) * (1 - smoothstep(bot - 0.6, bot + 0.4, ys))
            sh = smoothstep(top, bot, ys)
            snc = mix(hexrgb('#f3f7fb'), hexrgb('#b8cadd'), sh ** 1.5)
            # shadow line under the snow
            under = (1 - smoothstep(bot, bot + 2.5, ys)) * smoothstep(bot - 0.5, bot + 0.3, ys)
            img[..., :3] = over(img[..., :3], hexrgb('#22262c'), under * 0.6)
            img[..., :3] = over(img[..., :3], snc, m)
            # icicles under the ledge
            for q in range(int(rng.integers(9, 15) * (1 if y0 == 0 else 0.6))):
                ix = rng.uniform(0, 128)
                il = rng.uniform(3, 11 if y0 == 0 else 7)
                iw = rng.uniform(0.9, 1.8)
                by = y0 + thick + irr * 0.3
                for ox in (-128, 0, 128):
                    cx = ix + ox
                    tt = (ys - by) / il
                    xm = np.abs(xs - cx) / (iw * np.clip(1 - tt, 0, 1) + 1e-3)
                    a = (tt >= -0.2) & (tt <= 1) & (xm < 1)
                    a = a.astype(float) * np.clip((1 - xm) * 3, 0, 1)
                    icol = mix(hexrgb('#e8f4fb'), hexrgb('#9fc3dc'), np.clip(xs - cx + iw, 0, 2 * iw) / (2 * iw))
                    img[..., :3] = over(img[..., :3], icol, a * 0.95)
        out = downsample(img[..., :3], ss)
    return out


def _paste(img, p, cx, cy):
    h, w = p.shape[:2]
    x0, y0 = int(round(cx - w / 2)), int(round(cy - h / 2))
    H, W = img.shape[:2]
    xa, ya, xb, yb = max(0, x0), max(0, y0), min(W, x0 + w), min(H, y0 + h)
    if xa >= xb or ya >= yb:
        return
    sub = p[ya - y0:yb - y0, xa - x0:xb - x0]
    a = sub[..., 3:4]
    img[ya:yb, xa:xb, :3] = img[ya:yb, xa:xb, :3] * (1 - a) + sub[..., :3] * a


JOBS = {
    'ground-jungle': (jungle_ground, 'jungle/ground.png'), 'water-jungle': (jungle_water, 'jungle/water.png'),
    'rock-jungle': (jungle_rock, 'jungle/rock.png'), 'ground-polar': (polar_ground, 'polar/ground.png'),
    'water-polar': (polar_water, 'polar/water.png'), 'rock-polar': (polar_rock, 'polar/rock.png'),
    'cliff-jungle': (lambda: cliff('jungle'), 'jungle/cliff.png'), 'cliff-polar': (lambda: cliff('polar'), 'polar/cliff.png'),
}

if __name__ == '__main__':
    for k in (sys.argv[1:] or JOBS):
        fn, path = JOBS[k]
        img = fn()
        save_rgb(img, 'out/art/biomes/' + path)
        print(k, img.shape, (np.clip(img, 0, 1).reshape(-1, 3).mean(0) * 255).round(1))

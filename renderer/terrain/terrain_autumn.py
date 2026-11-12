"""Autumn Forest ground, lake water, granite rock (512 seamless) and granite cliff (128x48, tiles left-right).

Ground: the Forest's floor in its fall colours: a carpet of fallen leaves (orange, rust, amber, gold,
brown, a few reds) with patches of olive grass and moss showing through. Water: the clear dark blue-teal
forest lake with a few floating orange and red leaves. Rock: grey granite with moss in the joints and a
few leaves caught on it. Cliff: a grey granite face under a cap of leaf-strewn turf.
"""
import os
import sys
import numpy as np
from tex import *
from terrain_biomes import N, over, leaf_patch, ds_rgba, crag_height, cast_shadow, _paste

OUT = 'out/art/biomes/autumn'

# fallen-leaf palette (sRGB): orange, rust, amber, gold, brown, red
LEAF_COLS = ['#cc7434', '#d68838', '#c0662e', '#a8542c', '#94482a', '#cc9238', '#d8aa44', '#c4a448',
             '#8a643c', '#9a7044', '#7c5838', '#b03c28', '#be4c2c']
LEAF_W = [1.2, 1.0, 1.0, 1.0, 0.8, 1.0, 0.9, 0.8, 1.0, 1.0, 0.8, 0.5, 0.5]


def pick_leaf(rng):
    w = np.array(LEAF_W)
    return hexrgb(LEAF_COLS[rng.choice(len(LEAF_COLS), p=w / w.sum())])


def maple_patch(R, ang, col, vein, ss=4, shadow=(1.2, 1.4), sh_op=0.35):
    """A small five-lobed maple leaf (RGBA float patch), tip pointing along `ang`, with stem and veins."""
    pad = int(R + 6)
    S = 2 * pad * ss
    ys, xs = (np.mgrid[0:S, 0:S] + 0.5) / ss - pad
    c, s = np.cos(ang), np.sin(ang)
    lobes = np.radians([0, 62, -62, 128, -128])
    amps = [1.0, 0.92, 0.92, 0.66, 0.66]

    def field(x, y):
        a = c * x + s * y
        b = -s * x + c * y
        th = np.arctan2(b, a)
        r = np.hypot(a, b)
        lob = np.zeros_like(th)
        for l0, am in zip(lobes, amps):
            d = np.angle(np.exp(1j * (th - l0)))
            lob = np.maximum(lob, am * np.clip(1 - np.abs(d) / 0.62, 0, 1) ** 1.6)
        rr = R * (0.42 + 0.58 * lob)
        return r, rr, th, a, b
    r, rr, th, a, b = field(xs - shadow[0], ys - shadow[1])
    sm = np.clip((rr - r) * 1.2 + 0.4, 0, 1)
    out = np.zeros((S, S, 4))
    out[..., :3] = np.array([0.05, 0.04, 0.02])
    out[..., 3] = ndimage.gaussian_filter(sm, ss * 0.8) * sh_op
    r, rr, th, a, b = field(xs, ys)
    m = np.clip((rr - r) * ss * 0.5, 0, 1)
    # stem: short line from the centre back opposite the tip
    stem = np.clip(1 - np.abs(b) / 0.45, 0, 1) * (a < 0) * (a > -R * 0.75)
    colv = np.asarray(col)[None, None] * (0.86 + 0.14 * np.cos(th - 0.8))[..., None]
    vein_m = np.zeros_like(r)
    for l0 in lobes:
        d = np.angle(np.exp(1j * (th - l0)))
        vein_m = np.maximum(vein_m, np.exp(-(d * r / 0.4) ** 2) * (r < rr * 0.9))
    colv = colv * (1 - 0.35 * vein_m[..., None]) + np.asarray(vein) * 0.35 * vein_m[..., None]
    out[..., :3] = out[..., :3] * (1 - m[..., None]) + colv * m[..., None]
    out[..., 3] = out[..., 3] * (1 - m) + m
    out[..., :3] = out[..., :3] * (1 - stem[..., None]) + np.asarray(vein) * stem[..., None]
    out[..., 3] = np.maximum(out[..., 3], stem)
    return ds_rgba(out, ss)


def stamp_leaf(img, rng, x, y, col, size=1.0, shade=1.0, sh_op=0.4):
    """One fallen leaf: mostly ovate (oak/beech/birch shapes), sometimes a maple star."""
    col = col * rng.uniform(0.9, 1.08) * shade
    vein = col * 0.7
    if rng.uniform() < 0.28:
        p = maple_patch(rng.uniform(4.0, 6.0) * size, rng.uniform(0, 2 * np.pi), col, vein, sh_op=sh_op)
    else:
        L = rng.uniform(7, 13) * size
        p = leaf_patch(L, L * rng.uniform(0.38, 0.62), rng.uniform(0, 2 * np.pi), col, vein,
                       curl=rng.uniform(-0.25, 0.25), shadow=(1.0, 1.2), sh_op=sh_op)
    stamp(img, p, x, y)


def autumn_ground():
    rng = np.random.default_rng(271)
    # forest floor under the leaves: olive grass in the clearings, dark humus between
    z1 = fbm(N, 2701, 3, 48, beta=2.0)
    grass = mix(hexrgb('#5c6c30'), hexrgb('#7a8640'), smoothstep(-1.3, 1.3, z1))
    g = 0.5 * fbm(N, 2703, 60, 256, beta=0.6, aniso=(1.0, 5.0), angle=0.35) + \
        0.5 * fbm(N, 2704, 60, 256, beta=0.6, aniso=(1.0, 5.0), angle=-0.5)
    grass = grass * (1 + 0.16 * zscore(g))[..., None]
    grass = over(grass, hexrgb('#9a9a4a'), smoothstep(1.3, 2.4, zscore(g)) * 0.5)
    hs = fbm(N, 2705, 8, 160, beta=1.7)
    grass = grass * (0.8 + 0.22 * relief(normals_from_height(hs * 5), 225, 50))[..., None]
    # moss cushions in the clearings
    mm = fbm(N, 2706, 4, 30, beta=2.0)
    M = smoothstep(0.7, 1.3, mm)
    mh = fbm(N, 2707, 50, 256, beta=0.8)
    mcol = mix(hexrgb('#46622a'), hexrgb('#5e7c32'), smoothstep(-1.0, 1.4, mh))
    mcol = mcol * (0.72 + 0.35 * relief(normals_from_height((M * 3 + M * mh) * 1.6), 225, 50))[..., None]
    grass = over(grass, mcol, M * 0.75)
    # the leaf carpet: where it lies thick the floor is hidden; it thins out into the grassy clearings
    cv = fbm(N, 2708, 2, 20, beta=2.2) + 0.25 * fbm(N, 2709, 12, 60, beta=1.4)
    COV = smoothstep(-1.0, 0.35, cv)          # 1 = deep litter, 0 = clearing
    humus = mix(hexrgb('#5a4228'), hexrgb('#6e5230'), smoothstep(-1, 1.2, fbm(N, 2710, 30, 200, beta=0.9)))
    floor = over(grass, humus, COV)
    # a soft mottled colour wash under the stamped leaves so no floor shows through thick litter
    wash_t = fbm(N, 2711, 10, 90, beta=1.2)
    wash = mix(hexrgb('#9e6038'), hexrgb('#b88e46'), smoothstep(-1.4, 1.4, wash_t))
    wash = over(wash, hexrgb('#7a5434'), smoothstep(0.6, 1.6, fbm(N, 2712, 8, 60, beta=1.4)) * 0.5)
    wash = wash * (0.74 + 0.2 * smoothstep(-2, 2, fbm(N, 2713, 40, 256, beta=0.6)))[..., None]
    floor = over(floor, wash, smoothstep(0.3, 1.0, COV) * 0.85)
    img = np.concatenate([floor, np.ones((N, N, 1))], -1)
    # twigs under the leaves
    for i in range(14):
        x, y = rng.uniform(0, N, 2)
        p = leaf_patch(rng.uniform(12, 26), 1.5, rng.uniform(0, np.pi), hexrgb(['#4a3622', '#5a4028', '#3e2c1c'][i % 3]),
                       hexrgb('#2a1c12'), sh_op=0.35)
        stamp(img, p, x, y)
    # leaves, three layers: deep (shaded) to top (bright); density follows the cover
    for layer, (count, shade, sh_op) in enumerate([(1600, 0.78, 0.3), (1400, 0.9, 0.36), (900, 1.0, 0.42)]):
        placed = 0
        while placed < count:
            x, y = rng.uniform(0, N, 2)
            c = COV[int(y) % N, int(x) % N]
            if rng.uniform() > 0.05 + 0.95 * c ** (1.6 - 0.5 * layer):
                continue
            stamp_leaf(img, rng, x, y, pick_leaf(rng), shade=shade, sh_op=sh_op)
            placed += 1
    # a few stray leaves out on the grass
    for k in range(70):
        x, y = rng.uniform(0, N, 2)
        if COV[int(y) % N, int(x) % N] > 0.3:
            continue
        stamp_leaf(img, rng, x, y, pick_leaf(rng), shade=1.0, sh_op=0.45)
    # acorns and beech-nut husks here and there on the litter
    for k in range(22):
        x, y = rng.uniform(0, N, 2)
        if COV[int(y) % N, int(x) % N] < 0.5:
            continue
        p = leaf_patch(4.2, 3.0, rng.uniform(0, np.pi), hexrgb('#6a4a24'), hexrgb('#4a3018'), ss=4, shadow=(0.7, 0.8),
                       sh_op=0.4)
        stamp(img, p, x, y)
        p = leaf_patch(2.4, 2.6, 0.0, hexrgb('#5a4630'), hexrgb('#3a2c1c'), ss=4, shadow=(0.4, 0.4), sh_op=0.2)
        stamp(img, p, x - 1.2, y - 1.0)
    return img[..., :3]


def autumn_water():
    """The clear forest lake, a little darker and bluer, with a few floating fallen leaves."""
    z1 = fbm(N, 2721, 4, 64, beta=2.0)
    z2 = fbm(N, 2722, 4, 64, beta=2.0)
    col = np.ones((N, N, 3)) * hexrgb('#1c3f4c')
    col = over(col, hexrgb('#13303c'), 0.1 + 0.2 * z1)
    col = over(col, hexrgb('#285660'), -0.1 - 0.2 * z2)
    h = fbm(N, 2723, 3, 48, beta=2.0, aniso=(1.0, 3.0), angle=0.1) + 0.035 * fbm(N, 2724, 30, 160, beta=1.5, aniso=(1.0, 3.0))
    H = 0.5 + 0.12 * zscore(h)
    col = col * (0.68 + 0.34 * 1.2 * lambert(normals_from_height(H * 13.0), 225, 55))[..., None]
    sheen_n = fbm(N, 2726, 5, 40, beta=2.2, aniso=(1.0, 2.2), angle=0.1)
    sheen_a = blur_wrap(np.clip((sheen_n - 0.5) * 0.7, 0, 1), 2.0) * 0.4
    sheen_a *= np.clip(0.55 + 0.35 * zscore(H), 0, 1.2)
    col = over(col, hexrgb('#6a9aa4'), sheen_a)
    col = over(col, hexrgb('#e4f0f0'), 0.9 * spec(normals_from_height(H * 10.4), 26, 225, 38) * 0.45)
    img = np.concatenate([col, np.ones((N, N, 1))], -1)
    rng = np.random.default_rng(272)
    cols = ['#c8602a', '#d47830', '#b03a22', '#d4a038', '#c04a26', '#a8642a']

    def leaf(x, y):
        c = hexrgb(cols[rng.integers(len(cols))]) * rng.uniform(0.9, 1.08)
        # a faint ripple ring around it
        if rng.uniform() < 0.5:
            rr = rng.uniform(10, 13)
            ring = np.zeros((int(rr * 2 + 8), int(rr * 2 + 8), 4))
            yy, xx = np.mgrid[0:ring.shape[0], 0:ring.shape[1]] - ring.shape[0] / 2
            d = np.hypot(xx * 1.15, yy)
            ring[..., :3] = hexrgb('#7aa8b0')
            ring[..., 3] = np.exp(-((d - rr) / 1.4) ** 2) * 0.08
            stamp(img, ring, x, y)
        if rng.uniform() < 0.45:
            p = maple_patch(rng.uniform(6.5, 8.5), rng.uniform(0, 2 * np.pi), c, c * 0.7, shadow=(1.6, 2.0), sh_op=0.45)
        else:
            L = rng.uniform(13, 18)
            p = leaf_patch(L, L * rng.uniform(0.4, 0.6), rng.uniform(0, 2 * np.pi), c, c * 0.7,
                           curl=rng.uniform(-0.2, 0.2), shadow=(1.4, 1.7), sh_op=0.4)
        stamp(img, p, x, y)
    for cl in range(5):           # small drifts
        cx, cy = rng.uniform(0, N, 2)
        for k in range(rng.integers(2, 5)):
            leaf(cx + rng.normal() * 13, cy + rng.normal() * 9)
    for k in range(8):            # singles
        leaf(*rng.uniform(0, N, 2))
    return img[..., :3]


def autumn_rock():
    """Grey granite outcrop: speckled grey blocks, moss in the joints and hollows, a few caught leaves."""
    H, edge, r = crag_height(2730, n_blocks=22, amp=22)
    Nn = normals_from_height(H)
    shc = cast_shadow(H, 26, 42)
    shade = 0.32 + 0.92 * lambert(Nn, 225, 45) * (0.35 + 0.65 * shc)
    base = mix(hexrgb('#5c5e60'), hexrgb('#7e7f80'), smoothstep(-1.2, 1.2, fbm(N, 2732, 3, 60, beta=2.0)))
    fine = fbm(N, 2733, 110, 256, beta=0.2)
    base = over(base, hexrgb('#2a2a2c'), smoothstep(1.5, 2.1, fine) * 0.6)       # biotite specks
    base = over(base, hexrgb('#9a8a80'), smoothstep(1.0, 1.7, fbm(N, 2734, 50, 200, beta=0.6)) * 0.3)   # feldspar
    base = over(base, hexrgb('#cfcfcc'), smoothstep(1.7, 2.3, fbm(N, 2735, 110, 256, beta=0.2)) * 0.45)  # quartz
    # pale lichen rosettes
    base = over(base, hexrgb('#a4a890'), smoothstep(1.3, 1.9, fbm(N, 2736, 16, 90, beta=1.2)) * 0.35)
    col = base * shade[..., None]
    col = over(col, hexrgb('#141516'), (1 - smoothstep(0.5, 2.5, edge)) * 0.8)
    low = 1 - smoothstep(-1.0, 0.0, zscore(blur_wrap(H, 3)))
    mn = fbm(N, 2737, 8, 120, beta=1.3)
    mn2 = fbm(N, 2740, 3, 24, beta=2.0)
    moss = np.clip(np.maximum((1 - smoothstep(1.5, 9, edge)) * smoothstep(0.2, 1.0, mn + 0.8 * mn2),
                              low * smoothstep(-0.4, 0.6, mn + 0.5 * mn2)), 0, 1)
    moss = np.maximum(moss, smoothstep(1.2, 1.8, mn2 + 0.3 * mn) * smoothstep(0.990, 0.999, Nn[..., 2]))
    mcol = mix(hexrgb('#3a5222'), hexrgb('#5e7a2e'), smoothstep(-1, 1.5, fbm(N, 2738, 60, 256, beta=0.7)))
    mcol = mcol * (0.6 + 0.48 * lambert(normals_from_height(H * 0.5 + 2 * fbm(N, 2739, 80, 256, beta=0.7)), 225, 50)
                   * (0.5 + 0.5 * shc))[..., None]
    col = over(col, mcol, smoothstep(0.25, 0.65, moss))
    img = np.concatenate([col, np.ones((N, N, 1))], -1)
    # leaves caught in the joints and hollows
    rng = np.random.default_rng(273)
    trap = np.maximum(1 - smoothstep(1, 6, edge), low)
    placed = 0
    while placed < 150:
        x, y = rng.uniform(0, N, 2)
        if rng.uniform() > trap[int(y) % N, int(x) % N] * 0.9:
            continue
        stamp_leaf(img, rng, x, y, pick_leaf(rng), size=1.15, shade=0.95, sh_op=0.45)
        placed += 1
    return img[..., :3]


def autumn_cliff():
    """128x48 grey granite face, tiling left-right: blocky jointed granite, a turf cap strewn with
    fallen leaves along the top, a mossy mid ledge and a little red creeper hanging down."""
    ss = 4
    Wc, Hc = 128 * ss, 48 * ss
    rng = np.random.default_rng(293)
    ys, xs = np.mgrid[0:Hc, 0:Wc] / ss
    yn = ys / 48.0

    def pfbm(seed, f_lo, f_hi, beta=2.0, aniso=(1, 1)):
        return fbm(Wc, seed, f_lo, f_hi, beta=beta, aniso=aniso)[:Hc]
    strata = pfbm(2911, 1, 12, 2.0, aniso=(1, 6))
    band = np.sin(ys * 0.45 + 1.6 * strata) * 0.5 + 0.5
    base = mix(hexrgb('#5a5c5f'), hexrgb('#828488'), smoothstep(0.15, 0.85, band))
    base = base * (1 + 0.1 * pfbm(2912, 50, 240, 0.4))[..., None]
    base = over(base, hexrgb('#26272a'), smoothstep(1.4, 2.0, pfbm(2913, 100, 256, 0.1)) * 0.75)
    base = over(base, hexrgb('#a39488'), smoothstep(1.0, 1.6, pfbm(2914, 60, 200, 0.5)) * 0.3)
    base = over(base, hexrgb('#d0d0cc'), smoothstep(1.6, 2.2, pfbm(2919, 100, 256, 0.1)) * 0.4)
    # blocky faces: vertical joints, each block lit on its left
    jx = np.cumsum(rng.uniform(18, 36, 5))
    jx = np.concatenate([[0], jx / jx[-1] * 128])
    k = np.clip(np.searchsorted(jx, xs % 128, side='right') - 1, 0, len(jx) - 2)
    t = (xs % 128 - jx[k]) / (jx[k + 1] - jx[k])
    face = 0.7 + 0.3 * np.cos((t - 0.3) * np.pi * 0.8)
    col = base * rng.uniform(0.9, 1.08, len(jx))[k][..., None] * face[..., None]
    joint = 1 - smoothstep(0.0, 0.05, np.minimum(t, 1 - t))
    # a horizontal fracture or two in each block
    fr = np.zeros_like(xs)
    for c in range(len(jx) - 1):
        for yy in rng.uniform(14, 42, 2):
            m = (k == c) & (np.abs(ys - yy - 1.0 * np.sin(xs * 0.2 + c)) < 0.55)
            fr[m] = 1
    col = over(col, hexrgb('#1c1e22'), np.maximum(joint, fr) * 0.8)
    # damp streaks running down, mossy in places
    streak = smoothstep(0.8, 1.8, pfbm(2904, 4, 40, 1.6, aniso=(1, 0.15)))
    col = over(col, hexrgb('#4a5a3a'), streak * 0.35)
    col = col * (1 - 0.55 * smoothstep(0.4, 1.0, yn))[..., None]
    img = np.concatenate([col, np.ones((Hc, Wc, 1))], -1)
    # a mossy mid ledge
    y0 = 24.0
    top = y0 + 0.8 * pfbm(2915, 2, 12)
    bot = y0 + 2.6 + 1.2 * pfbm(2916, 3, 30)
    m = smoothstep(top - 0.4, top + 0.4, ys) * (1 - smoothstep(bot - 0.6, bot + 0.4, ys)) * smoothstep(-0.6, 0.2, pfbm(2917, 3, 20))
    under = (1 - smoothstep(bot, bot + 2.5, ys)) * smoothstep(bot - 0.5, bot + 0.3, ys)
    img[..., :3] = over(img[..., :3], hexrgb('#1c2018'), under * 0.5 * m.max(0, keepdims=True))
    mossc = mix(hexrgb('#3e5826'), hexrgb('#62802e'), smoothstep(-1, 1.4, pfbm(2918, 40, 200, 0.8)))
    img[..., :3] = over(img[..., :3], mossc, m)
    # turf cap along the top with an irregular, overhanging edge
    mt = 6.5 + 2.5 * pfbm(2905, 3, 24) + 3 * smoothstep(0.6, 1.6, pfbm(2906, 6, 30, 1.5))
    capm = 1 - smoothstep(mt - 0.8, mt + 0.6, ys)
    shadow = (1 - smoothstep(mt, mt + 3.0, ys)) * smoothstep(mt - 0.5, mt + 0.3, ys)
    img[..., :3] = over(img[..., :3], hexrgb('#1a1610'), shadow * 0.6)
    turf = mix(hexrgb('#5a4426'), hexrgb('#6a6a2c'), smoothstep(-0.5, 1.2, pfbm(2907, 8, 60, 1.2)))
    turf = turf * (1 - 0.4 * smoothstep(0, 1, ys / np.maximum(mt, 1)))[..., None]
    img[..., :3] = over(img[..., :3], turf, capm)
    # fallen leaves on the cap and the ledge (drawn at 4x)
    for q in range(70):
        lx = rng.uniform(0, 128)
        on_ledge = q >= 58
        ly = (rng.uniform(1, 6.5) if not on_ledge else rng.uniform(y0 - 0.5, y0 + 2.0))
        c = pick_leaf(rng) * rng.uniform(0.85, 1.05) * (1 - 0.25 * ly / 48)
        L = rng.uniform(3.4, 5.0) * ss
        ang = rng.uniform(0, np.pi) if not on_ledge else rng.uniform(-0.35, 0.35)
        p = leaf_patch(L, L * rng.uniform(0.4, 0.6) * (1 if not on_ledge else 0.7), ang, c, c * 0.7, ss=1,
                       shadow=(0.8 * ss, 0.9 * ss), sh_op=0.45)
        for ox in (-128, 0, 128):
            _paste(img, p, (lx + ox) * ss, ly * ss)
    # a little red Virginia creeper hanging from the cap
    for v in range(4):
        vx = rng.uniform(0, 128)
        L = rng.uniform(16, 32)
        amp = rng.uniform(1, 2.5)
        ph = rng.uniform(0, 6)
        yy = np.linspace(4, L, 120)
        xx = vx + amp * np.sin(yy * 0.3 + ph)
        for (px_, py_) in zip(xx, yy):
            for ox in (-128, 0, 128):
                cx, cy = (px_ + ox) * ss, py_ * ss
                if -6 <= cx < Wc + 6:
                    x0_, x1_ = int(max(cx - 3, 0)), int(min(cx + 3, Wc))
                    y0_, y1_ = int(max(cy - 3, 0)), int(min(cy + 3, Hc))
                    if x0_ < x1_ and y0_ < y1_:
                        d = np.hypot(np.arange(x0_, x1_)[None] - cx, np.arange(y0_, y1_)[:, None] - cy)
                        a = np.clip(2.0 - d, 0, 1)
                        g = hexrgb('#5a3020') * (1 - 0.3 * py_ / 48)
                        img[y0_:y1_, x0_:x1_, :3] = img[y0_:y1_, x0_:x1_, :3] * (1 - a[..., None]) + g * a[..., None]
        for q in range(int(L / 2.2)):
            ly = rng.uniform(5, L)
            lx = vx + amp * np.sin(ly * 0.3 + ph) + rng.choice([-1, 1]) * rng.uniform(0.8, 2.0)
            c = hexrgb(['#a82a1e', '#c03a22', '#b8481e', '#8c2020'][q % 4]) * rng.uniform(0.85, 1.1) * (1 - 0.25 * ly / 48)
            p = leaf_patch(rng.uniform(2.6, 3.6) * ss, rng.uniform(2.0, 2.8) * ss, rng.uniform(0, np.pi), c, c * 0.7,
                           ss=1, shadow=(1.0 * ss, 1.0 * ss), sh_op=0.5)
            for ox in (-128, 0, 128):
                _paste(img, p, (lx + ox) * ss, ly * ss)
    return downsample(img[..., :3], ss)


JOBS = {'ground': autumn_ground, 'water': autumn_water, 'rock': autumn_rock, 'cliff': autumn_cliff}

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for k in (sys.argv[1:] or JOBS):
        img = JOBS[k]()
        save_rgb(img, f'{OUT}/{k}.png')
        print(k, img.shape, (np.clip(img, 0, 1).reshape(-1, 3).mean(0) * 255).round(1))

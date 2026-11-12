"""Savanna ground, watering-hole water, kopje granite rock (512 seamless) and red rock cliff (128x48).

Ground: golden-tan dry grass with a fine blade texture, patches of reddish bare earth and a scatter of
darker dry tufts, in a hard, bright sun. Water: a murky green-brown watering hole with silty, muddy
shallows. Rock: warm red-brown granite weathered into rounded pillows and domes (a kopje), cracked,
lichen-spotted, with dry grass in the gaps. Cliff: a red-brown rock face under a cap of dry grass.
"""
import os
import sys
import numpy as np
from tex import *
from terrain_biomes import N, over, leaf_patch, cast_shadow, _paste

OUT = 'out/art/biomes/savanna'

GRASS_COLS = ['#d4b46c', '#c8a660', '#dcc07a', '#bf9c58', '#e0c886', '#b89452']


def tuft(img, rng, x, y, scale=1.0, cols=None, dark=0.0, sh_op=0.3):
    """A dry grass tuft from above: a fountain of blades from a shaded base, lighter outer blades."""
    cols = cols or GRASS_COLS
    nb = rng.integers(16, 26)
    base = hexrgb('#8c6c3e')
    p = leaf_patch(7 * scale, 7 * scale, 0, base, base, shadow=(1.6, 1.8), sh_op=0.28)
    stamp(img, p, x + 0.5, y + 0.5)
    for k in range(nb):
        a = rng.uniform(0, 2 * np.pi)
        L = rng.uniform(6, 15) * scale
        c = hexrgb(cols[rng.integers(len(cols))]) * rng.uniform(0.85, 1.05) * (1 - dark)
        p = leaf_patch(L, rng.uniform(1.3, 1.9), a, c, c * 0.8, curl=rng.uniform(-0.3, 0.3), shadow=(1.0, 1.2),
                       sh_op=sh_op)
        stamp(img, p, x + np.cos(a) * L * 0.42, y + np.sin(a) * L * 0.42)


def savanna_ground():
    rng = np.random.default_rng(371)
    # broad sunlit gold, a little paler on the rises and more ochre in the dips
    z1 = fbm(N, 3701, 3, 40, beta=2.0)
    col = mix(hexrgb('#a88a52'), hexrgb('#c6a86a'), smoothstep(-1.4, 1.4, z1))
    col = over(col, hexrgb('#a89a5e'), smoothstep(0.6, 1.6, fbm(N, 3702, 3, 24, beta=2.0)) * 0.35)   # a sage tint
    # fine dry grass: long thin streaks at a few angles, bright tips, dark stems
    g = (0.4 * fbm(N, 3703, 60, 256, beta=0.5, aniso=(1.0, 6.0), angle=0.3) +
         0.35 * fbm(N, 3704, 60, 256, beta=0.5, aniso=(1.0, 6.0), angle=-0.55) +
         0.25 * fbm(N, 3705, 60, 256, beta=0.5, aniso=(1.0, 6.0), angle=1.2))
    g = zscore(g)
    col = col * (1 + 0.13 * g)[..., None]
    col = over(col, hexrgb('#ecd89a'), smoothstep(1.3, 2.4, g) * 0.55)
    col = over(col, hexrgb('#7a5e34'), smoothstep(1.5, 2.6, -g) * 0.4)
    hs = fbm(N, 3706, 8, 160, beta=1.7)
    col = col * (0.84 + 0.18 * relief(normals_from_height(hs * 5), 225, 50))[..., None]
    # bare red earth: patches where the grass is grazed down or trampled
    be = fbm(N, 3707, 3, 24, beta=2.0) + 0.3 * fbm(N, 3708, 12, 60, beta=1.4)
    B = smoothstep(0.8, 1.6, be)
    eh = fbm(N, 3709, 20, 200, beta=1.0)
    ecol = mix(hexrgb('#9a5c38'), hexrgb('#b47648'), smoothstep(-1.2, 1.2, fbm(N, 3710, 6, 60, beta=1.5)))
    ecol = ecol * (0.86 + 0.16 * relief(normals_from_height(eh * 2.5), 225, 50))[..., None]
    # sun-baked cracks in the earth
    F1, F2, _ = worley(N, rng.uniform(0, 1, (90, 2)))
    cr = 1 - smoothstep(0.4, 1.6, (F2 - F1) * N)
    ecol = over(ecol, hexrgb('#6a3c24'), cr * 0.4)
    # grass thinning out over the earth: the streak texture breaks up near the patch edge
    Bt = np.clip(B - 0.6 * smoothstep(0.4, 1.8, g) * (1 - smoothstep(0.55, 1.0, B)), 0, 1)
    col = over(col, ecol, Bt)
    img = np.concatenate([col, np.ones((N, N, 1))], -1)
    # pebbles on the bare earth
    for k in range(70):
        x, y = rng.uniform(0, N, 2)
        if B[int(y) % N, int(x) % N] < 0.5:
            continue
        r = rng.uniform(1.6, 3.2)
        c = hexrgb(['#8a6a54', '#a08470', '#6e5444', '#b09078'][k % 4])
        p = leaf_patch(r * 2, r * rng.uniform(1.4, 1.9), rng.uniform(0, np.pi), c, c * 0.9, ss=4, shadow=(0.7, 0.8),
                       sh_op=0.45)
        stamp(img, p, x, y)
    # darker dry tufts dotted over the grass (and a few bleached ones)
    placed = 0
    while placed < 90:
        x, y = rng.uniform(0, N, 2)
        if B[int(y) % N, int(x) % N] > 0.4 and rng.uniform() < 0.8:
            continue
        if rng.uniform() < 0.3:
            tuft(img, rng, x, y, scale=rng.uniform(0.7, 1.0), cols=['#e2cc8a', '#d8c07c', '#ead69c', '#cdb070'], sh_op=0.3)
        else:
            tuft(img, rng, x, y, scale=rng.uniform(0.75, 1.1), cols=['#ac8a4a', '#9e7c42', '#b8964e', '#c4a058'],
                 sh_op=0.25)
        placed += 1
    # loose blades lying about
    for k in range(260):
        x, y = rng.uniform(0, N, 2)
        c = hexrgb(GRASS_COLS[rng.integers(len(GRASS_COLS))]) * rng.uniform(0.9, 1.1)
        p = leaf_patch(rng.uniform(7, 13), 1.2, rng.uniform(0, np.pi), c, c * 0.8, shadow=(0.6, 0.7), sh_op=0.25)
        stamp(img, p, x, y)
    return img[..., :3]


def savanna_water():
    """A murky watering hole: green-brown water, clouds of stirred-up silt over the muddy shallows."""
    z1 = fbm(N, 3721, 4, 64, beta=2.0)
    z2 = fbm(N, 3722, 4, 64, beta=2.0)
    col = np.ones((N, N, 3)) * hexrgb('#42462a')
    col = over(col, hexrgb('#32381f'), 0.1 + 0.2 * z1)
    col = over(col, hexrgb('#545434'), -0.1 - 0.2 * z2)
    silt = smoothstep(-0.4, 1.8, fbm(N, 3728, 2, 12, beta=2.4) + 0.15 * fbm(N, 3729, 8, 40, beta=1.4))
    col = over(col, hexrgb('#6e5a3a'), silt * 0.55)
    col = over(col, hexrgb('#8a6e48'), smoothstep(1.2, 2.2, fbm(N, 3730, 4, 30, beta=2.0)) * 0.3)
    h = fbm(N, 3723, 3, 48, beta=2.0, aniso=(1.0, 3.0), angle=0.1) + 0.035 * fbm(N, 3724, 30, 160, beta=1.5, aniso=(1.0, 3.0))
    H = 0.5 + 0.12 * zscore(h)
    col = col * (0.68 + 0.33 * 1.2 * lambert(normals_from_height(H * 13.0), 225, 55))[..., None]
    sheen_n = fbm(N, 3726, 5, 40, beta=2.2, aniso=(1.0, 2.2), angle=0.1)
    sheen_a = blur_wrap(np.clip((sheen_n - 0.5) * 0.7, 0, 1), 2.0) * 0.35
    sheen_a *= np.clip(0.55 + 0.35 * zscore(H), 0, 1.2)
    col = over(col, hexrgb('#9a9a70'), sheen_a)
    col = over(col, hexrgb('#eeead0'), 0.9 * spec(normals_from_height(H * 10.4), 26, 225, 38) * 0.45)
    img = np.concatenate([col, np.ones((N, N, 1))], -1)
    # a little floating scum and drifting grass stems
    rng = np.random.default_rng(372)
    for cl in range(6):
        cx, cy = rng.uniform(0, N, 2)
        for k in range(rng.integers(3, 8)):
            x, y = cx + rng.normal() * 8, cy + rng.normal() * 5
            r = rng.uniform(1.0, 2.0)
            p = leaf_patch(r * 2.2, r * 1.9, rng.uniform(0, 3), hexrgb('#6a6a3a') * rng.uniform(0.9, 1.15),
                           hexrgb('#55552e'), shadow=(0.6, 0.7), sh_op=0.25)
            stamp(img, p, x, y)
    for k in range(14):
        x, y = rng.uniform(0, N, 2)
        c = hexrgb('#b89a5a') * rng.uniform(0.85, 1.05)
        p = leaf_patch(rng.uniform(9, 15), 1.3, rng.uniform(0, np.pi), c, c * 0.8, shadow=(0.8, 1.0), sh_op=0.3)
        stamp(img, p, x, y)
    return img[..., :3]


def savanna_rock():
    """Kopje granite: rounded, exfoliating domes and boulders of warm red-brown rock piled together,
    cracked and lichen-spotted, with dry grass in the gaps between them."""
    rng = np.random.default_rng(373)
    ys, xs = (np.mgrid[0:N, 0:N] + 0.5) / N
    # boulders: a few big domes, medium boulders and small ones filling in (periodic distances)
    circles = []
    for (cnt, r0, r1, h0, h1) in [(4, 0.17, 0.23, 34, 44), (14, 0.08, 0.12, 18, 26), (30, 0.04, 0.065, 9, 14),
                                  (30, 0.025, 0.04, 5, 8)]:
        tries = 0
        while cnt and tries < 4000:
            tries += 1
            cx, cy, r = rng.uniform(0, 1), rng.uniform(0, 1), rng.uniform(r0, r1)
            ok = True
            for (qx, qy, qr, _) in circles:
                dx = (cx - qx + 0.5) % 1 - 0.5
                dy = (cy - qy + 0.5) % 1 - 0.5
                if np.hypot(dx, dy) < (r + qr) * 0.62:
                    ok = False
                    break
            if ok:
                circles.append((cx, cy, r, rng.uniform(h0, h1)))
                cnt -= 1
    H = np.zeros((N, N))
    ID = np.full((N, N), -1)
    D = np.ones((N, N))
    warp = 0.012 * fbm(N, 3731, 3, 20, beta=1.8)
    for i, (cx, cy, r, h) in enumerate(circles):
        dx = (xs - cx + 0.5) % 1 - 0.5
        dy = (ys - cy + 0.5) % 1 - 0.5
        d = (np.hypot(dx * 1.0, dy * 1.08) + warp) / r
        hh = h * np.clip(1 - d ** 2, 0, 1) ** 0.55
        top = hh > H
        H = np.where(top, hh, H)
        ID = np.where(top & (hh > 0), i, ID)
        D = np.where(top, d, D)
    n = len(circles)
    rock = ID >= 0
    IDc = np.maximum(ID, 0)
    H += (1.4 * fbm(N, 3732, 6, 60, beta=1.6) + 0.5 * fbm(N, 3733, 50, 256, beta=1.0)) * smoothstep(0, 3, H)
    # exfoliation: onion-skin steps following each dome's contours
    sheet = np.sin(D * 11 + 2 * fbm(N, 3734, 4, 30, beta=1.8))
    H -= 0.8 * smoothstep(0.8, 0.97, sheet) * (D < 0.95)
    dome = np.clip(1 - D, 0, 1)
    hc = np.ones(n)
    edge = np.where(rock, (1 - D) * 40, 0)
    Nn = normals_from_height(H)
    shc = cast_shadow(H, 28, 40)
    shade = 0.36 + 0.88 * lambert(Nn, 225, 45) * (0.35 + 0.65 * shc)
    base = mix(hexrgb('#82503c'), hexrgb('#a46c52'), smoothstep(-1.2, 1.2, fbm(N, 3735, 3, 40, beta=2.0)))
    base = base * rng.uniform(0.92, 1.08, n)[IDc][..., None]
    fine = fbm(N, 3736, 110, 256, beta=0.2)
    base = over(base, hexrgb('#4a2e24'), smoothstep(1.5, 2.1, fine) * 0.55)       # dark grains
    base = over(base, hexrgb('#d8b49a'), smoothstep(1.6, 2.2, fbm(N, 3737, 110, 256, beta=0.2)) * 0.45)  # feldspar
    # lichen: pale ochre and grey-green rosettes
    base = over(base, hexrgb('#c8a464'), smoothstep(1.4, 1.9, fbm(N, 3738, 16, 90, beta=1.2)) * 0.5)
    base = over(base, hexrgb('#8e927a'), smoothstep(1.5, 2.0, fbm(N, 3739, 16, 90, beta=1.2)) * 0.4)
    # dark water streaks down the faces
    streak = smoothstep(1.0, 2.0, fbm(N, 3740, 6, 80, beta=1.2, aniso=(1, 0.2))) * (1 - dome * 0.5)
    base = over(base, hexrgb('#5a3a2e'), streak * 0.3)
    col = base * shade[..., None]
    # cracks: a few straight fractures through the boulders, and the gaps between them
    G1, G2, _ = worley(N, rng.uniform(0, 1, (9, 2)))
    crack = (1 - smoothstep(0.3, 1.3, (G2 - G1) * N)) * smoothstep(-0.3, 0.6, fbm(N, 3741, 3, 20, beta=2.0)) * (H > 4)
    col = over(col, hexrgb('#2a1a14'), crack * 0.75)
    # crevices where boulders meet: ambient occlusion from the blurred heightfield
    cav = np.clip(blur_wrap(H, 4) - H, 0, None)
    col = col * (1 - 0.6 * smoothstep(0.3, 3.0, cav))[..., None]
    gap = 1 - smoothstep(0.5, 3.0, H)
    # dry grass and red grit in the gaps
    gg = zscore(0.5 * fbm(N, 3742, 60, 256, beta=0.5, aniso=(1.0, 5.0), angle=0.4) +
                0.5 * fbm(N, 3743, 60, 256, beta=0.5, aniso=(1.0, 5.0), angle=-0.6))
    grass = mix(hexrgb('#8a6c40'), hexrgb('#ac8e58'), smoothstep(-1.5, 1.5, gg))
    grass = over(grass, hexrgb('#8a5a40'), smoothstep(0.2, 1.4, fbm(N, 3744, 6, 40, beta=1.6)) * 0.5)
    grass = grass * (0.6 + 0.45 * shc)[..., None]
    col = over(col, grass, gap)
    img = np.concatenate([col, np.ones((N, N, 1))], -1)
    for k in range(40):
        x, y = rng.uniform(0, N, 2)
        if gap[int(y) % N, int(x) % N] < 0.6:
            continue
        p = leaf_patch(rng.uniform(8, 12), 1.3, rng.uniform(0, np.pi), hexrgb('#c8a868'), hexrgb('#a08048'),
                       shadow=(0.6, 0.7), sh_op=0.3)
        stamp(img, p, x, y)
    return img[..., :3]


def savanna_cliff():
    """128x48 red-brown rock face, tiling left-right: rounded, weathered blocks and sandy strata,
    capped by dry golden grass hanging over the edge."""
    ss = 4
    Wc, Hc = 128 * ss, 48 * ss
    rng = np.random.default_rng(393)
    ys, xs = np.mgrid[0:Hc, 0:Wc] / ss
    yn = ys / 48.0

    def pfbm(seed, f_lo, f_hi, beta=2.0, aniso=(1, 1)):
        return fbm(Wc, seed, f_lo, f_hi, beta=beta, aniso=aniso)[:Hc]
    strata = pfbm(3911, 1, 12, 2.0, aniso=(1, 6))
    band = np.sin(ys * 0.5 + 1.8 * strata) * 0.5 + 0.5
    base = mix(hexrgb('#80503c'), hexrgb('#ac7656'), smoothstep(0.15, 0.85, band))
    base = base * (1 + 0.1 * pfbm(3912, 50, 240, 0.4))[..., None]
    base = over(base, hexrgb('#3e261c'), smoothstep(1.4, 2.0, pfbm(3913, 100, 256, 0.1)) * 0.6)
    base = over(base, hexrgb('#d0a888'), smoothstep(1.5, 2.1, pfbm(3914, 100, 256, 0.1)) * 0.4)
    base = over(base, hexrgb('#c4a060'), smoothstep(1.3, 1.9, pfbm(3915, 20, 90, 1.2)) * 0.35)   # lichen
    # rounded blocks: joints at fixed x, each block a convex bulge lit from the upper left
    jx = np.cumsum(rng.uniform(20, 38, 5))
    jx = np.concatenate([[0], jx / jx[-1] * 128])
    k = np.clip(np.searchsorted(jx, xs % 128, side='right') - 1, 0, len(jx) - 2)
    t = (xs % 128 - jx[k]) / (jx[k + 1] - jx[k])
    face = 0.62 + 0.38 * np.clip(np.cos((t - 0.32) * np.pi * 0.95), 0, 1) ** 0.7
    col = base * rng.uniform(0.9, 1.08, len(jx))[k][..., None] * face[..., None]
    joint = 1 - smoothstep(0.0, 0.06, np.minimum(t, 1 - t) + 0.01 * pfbm(3916, 2, 20))
    # horizontal partings, rounded off (lit lip above, shadow under)
    part = np.zeros_like(xs)
    lip = np.zeros_like(xs)
    for c in range(len(jx) - 1):
        for yy in rng.uniform(16, 40, 2):
            yc = yy + 1.5 * np.sin(xs * 0.12 + c * 2)
            m = (k == c)
            part = np.maximum(part, m * np.exp(-((ys - yc) / 0.6) ** 2))
            lip = np.maximum(lip, m * np.exp(-((ys - yc + 1.3) / 0.8) ** 2))
    col = over(col, hexrgb('#e0b494'), lip * 0.25)
    col = over(col, hexrgb('#2a1810'), np.maximum(joint, part) * 0.8)
    streak = smoothstep(0.8, 1.8, pfbm(3904, 4, 40, 1.6, aniso=(1, 0.15)))
    col = over(col, hexrgb('#4a2e24'), streak * 0.3)
    col = col * (1 - 0.55 * smoothstep(0.4, 1.0, yn))[..., None]
    img = np.concatenate([col, np.ones((Hc, Wc, 1))], -1)
    # sandy cap with dry grass
    mt = 5.5 + 2.0 * pfbm(3905, 3, 24) + 2.5 * smoothstep(0.6, 1.6, pfbm(3906, 6, 30, 1.5))
    capm = 1 - smoothstep(mt - 0.8, mt + 0.6, ys)
    shadow = (1 - smoothstep(mt, mt + 3.0, ys)) * smoothstep(mt - 0.5, mt + 0.3, ys)
    img[..., :3] = over(img[..., :3], hexrgb('#2a1a10'), shadow * 0.55)
    turf = mix(hexrgb('#a8844a'), hexrgb('#c8a464'), smoothstep(-0.5, 1.2, pfbm(3907, 8, 60, 1.2)))
    turf = turf * (1 - 0.35 * smoothstep(0, 1, ys / np.maximum(mt, 1)))[..., None]
    img[..., :3] = over(img[..., :3], turf, capm)
    # blades of grass: most on the cap, some hanging over the edge
    for q in range(150):
        lx = rng.uniform(0, 128)
        ly = rng.uniform(0.5, 6.5)
        c = hexrgb(GRASS_COLS[rng.integers(len(GRASS_COLS))]) * rng.uniform(0.8, 1.05)
        hang = q > 105
        L = rng.uniform(4, 8) * ss if not hang else rng.uniform(6, 11) * ss
        ang = rng.uniform(-0.6, 0.6) + (np.pi / 2 if hang else rng.choice([0.4, -0.4, 2.0, -2.0]))
        if hang:
            ly = mt[int(min(ly * ss, Hc - 1)), int(lx * ss) % Wc] / 1.0 + L / ss * 0.35 - 1.5
        p = leaf_patch(L, rng.uniform(1.0, 1.5) * ss, ang, c, c * 0.8, ss=1, shadow=(0.8 * ss, 1.0 * ss), sh_op=0.45)
        for ox in (-128, 0, 128):
            _paste(img, p, (lx + ox) * ss, ly * ss)
    return downsample(img[..., :3], ss)


JOBS = {'ground': savanna_ground, 'water': savanna_water, 'rock': savanna_rock, 'cliff': savanna_cliff}

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for k in (sys.argv[1:] or JOBS):
        img = JOBS[k]()
        save_rgb(img, f'{OUT}/{k}.png')
        print(k, img.shape, (np.clip(img, 0, 1).reshape(-1, 3).mean(0) * 255).round(1))

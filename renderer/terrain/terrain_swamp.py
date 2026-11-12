"""Swamp (misty bayou) ground / water / rock (512 seamless) and cliff (128x48, tiles left-right).

Ground: dark olive mud with a wet sheen and the odd puddle, patches of bright duckweed and moss,
tufts of sedge and a few fallen twigs. Water: murky green-brown with floating duckweed and lily pads.
Rock: dark mossy stone with slime streaks. Cliff: a muddy earthen bank with roots and a grassy lip.
"""
import os
import sys
import numpy as np
from tex import *
from terrain_biomes import N, over, leaf_patch, crag_height, cast_shadow, _paste, ds_rgba
from terrain_alien import jworley, disc_patch, layered_face, contour_lines

OUT = 'out/art/biomes/swamp'


def pad_patch(r, col, notch, ss=4, shadow=(1.0, 1.2), sh_op=0.35, rim='#7a9a44'):
    """A lily pad seen from above: a disc with a wedge cut to the centre, radial veins, a lighter rim."""
    pad = int(r + 5)
    S = 2 * pad * ss
    ys, xs = (np.mgrid[0:S, 0:S] + 0.5) / ss - pad

    def mask(x, y, soft):
        d = np.hypot(x, y)
        th = np.arctan2(y, x)
        da = np.abs((th - notch + np.pi) % (2 * np.pi) - np.pi)
        wedge = smoothstep(0.2, 0.1, da) * (d > 0.08 * r)
        return np.clip((r - d) * soft + 0.5, 0, 1) * (1 - wedge), d, th
    msh, _, _ = mask(xs - shadow[0], ys - shadow[1], 1.5)
    m, d, th = mask(xs, ys, ss * 0.5)
    out = np.zeros((S, S, 4))
    out[..., 3] = ndimage.gaussian_filter(msh, ss * 0.7) * sh_op
    c = np.asarray(col, float)[None, None] * (0.86 + 0.22 * (-(xs + ys) / (2 * r)))[..., None]
    k = (th / (2 * np.pi) * 11) % 1.0
    vein = np.exp(-((k - 0.5) / 0.08) ** 2) * smoothstep(0.15 * r, 0.4 * r, d)
    c = c * (1 - 0.14 * vein)[..., None]
    c = c + (hexrgb(rim) - c) * (smoothstep(0.8 * r, r, d) * 0.5)[..., None]
    c = c * (1 - 0.25 * smoothstep(0.9 * r, r, d) * smoothstep(-0.3, 0.6, (xs + ys) / (2 * r)))[..., None]
    out[..., :3] = out[..., :3] * (1 - m[..., None]) + c * m[..., None]
    out[..., 3] = out[..., 3] * (1 - m) + m
    return ds_rgba(out, ss)


def sedge_tuft(img, rng, x, y, cols, n=(5, 9), L=(7, 14)):
    for b in range(rng.integers(*n)):
        a = rng.uniform(0, 2 * np.pi)
        Lb = rng.uniform(*L)
        c = hexrgb(cols[rng.integers(len(cols))]) * rng.uniform(0.9, 1.1)
        p = leaf_patch(Lb, rng.uniform(1.7, 2.3), a, c, c * 0.7, ss=4, shadow=(1.0, 1.2), sh_op=0.45,
                       curl=rng.uniform(-0.15, 0.15))
        stamp(img, p, x + np.cos(a) * Lb * 0.45, y + np.sin(a) * Lb * 0.45)


def duckweed(n, g, seed, cover, cols, size=0.36):
    """Tiny floating fronds: one dot per cell of a fine jittered grid, kept where cover is high.
    Returns (rgb, alpha, shadow alpha)."""
    F1, F2, ID = jworley(n, g, seed, jit=0.7)
    rng = np.random.default_rng(seed + 1)
    keep = rng.uniform(0, 1, g * g)[ID] < cover
    rad = rng.uniform(0.7, 1.15, g * g)[ID] * size
    a = smoothstep(rad + 0.06, rad - 0.06, F1) * keep
    sh = np.roll(np.roll(a, 1, 0), 1, 1)
    tone = rng.uniform(0, 1, g * g)[ID]
    c = mix(hexrgb(cols[0]), hexrgb(cols[1]), tone)
    c = c * (1 + 0.25 * (1 - smoothstep(0, rad + 1e-6, F1)))[..., None]
    return c, a, sh * (1 - a)


# ============================================================================ GROUND

def swamp_ground():
    rng = np.random.default_rng(401)
    broad = fbm(N, 4001, 3, 40, beta=2.0)
    col = mix(hexrgb('#444a2e'), hexrgb('#68704a'), smoothstep(-1.3, 1.3, broad))
    damp = smoothstep(0.2, 1.3, fbm(N, 4002, 3, 28, beta=2.0))
    col = over(col, hexrgb('#2a2c1c'), damp * 0.5)
    hm = fbm(N, 4003, 8, 160, beta=1.6) + 0.5 * fbm(N, 4013, 40, 256, beta=1.0)
    lit = relief(normals_from_height(hm * 4), 225, 50)
    col = col * (0.76 + 0.28 * lit)[..., None]
    col = col * (1 + 0.06 * fbm(N, 4014, 60, 256, beta=0.8))[..., None]
    # wet sheen on the mud
    wet = np.clip(0.3 + damp, 0, 1)
    col = over(col, hexrgb('#b4b896'), spec(normals_from_height(hm * 3), 24, 225, 40) * wet * 0.6)
    # puddles in the lowest spots: dark water with a sky glint and a muddy rim
    pl = fbm(N, 4005, 4, 40, beta=2.0) + 0.6 * damp
    P = smoothstep(1.75, 1.95, pl)
    rimP = smoothstep(1.45, 1.75, pl) * (1 - P)
    col = over(col, hexrgb('#2c2a1a'), rimP * 0.45)
    pw = mix(hexrgb('#2c3222'), hexrgb('#4c5640'), smoothstep(-1, 1.5, fbm(N, 4015, 3, 20, beta=2.0)))
    col = over(col, pw, P * 0.92)
    # moss cushions and bright duckweed patches
    mm = fbm(N, 4006, 3, 26, beta=2.0) + 0.35 * fbm(N, 4007, 14, 80, beta=1.5)
    M = smoothstep(0.42, 0.98, mm) * (1 - P)
    mh = fbm(N, 4008, 50, 256, beta=0.8)
    mcol = mix(hexrgb('#46602a'), hexrgb('#6c883a'), smoothstep(-1.0, 1.4, mh + 0.6 * fbm(N, 4009, 6, 40, beta=2.0)))
    mcol = mcol * (0.66 + 0.4 * relief(normals_from_height((M * 3 + M * mh) * 1.6), 225, 50))[..., None]
    col = over(col, mcol, M * 0.92)
    # duckweed: on the puddles and spilling round the moss
    scum = smoothstep(0.0, 1.0, fbm(N, 4016, 3, 20, beta=2.0))
    dw_cover = np.clip(smoothstep(1.35, 1.8, pl) * scum * 0.85 + smoothstep(1.1, 1.5, mm) * 0.3, 0, 0.85)
    dc, da, dsh = duckweed(N, 200, 4010, dw_cover, ('#6a8a30', '#90ac40'), size=0.33)
    col = over(col, hexrgb('#1c2010'), dsh * 0.45)
    col = over(col, dc, da)
    img = np.concatenate([col, np.ones((N, N, 1))], -1)
    # twigs
    for i in range(12):
        x, y = rng.uniform(0, N, 2)
        p = leaf_patch(rng.uniform(12, 26), 1.6, rng.uniform(0, np.pi), hexrgb(['#3a2e1c', '#4a3a24', '#2e2416'][i % 3]),
                       hexrgb('#22180e'), sh_op=0.4)
        stamp(img, p, x, y)
    # a few soggy fallen leaves
    placed = 0
    while placed < 40:
        x, y = rng.uniform(0, N, 2)
        if P[int(y) % N, int(x) % N] > 0.3 or rng.uniform() < 0.7 * M[int(y) % N, int(x) % N]:
            continue
        L = rng.uniform(7, 12)
        cc = hexrgb(['#5a4a2a', '#6a5430', '#4e4026', '#6e6234'][rng.integers(4)]) * rng.uniform(0.9, 1.1)
        stamp(img, leaf_patch(L, L * rng.uniform(0.35, 0.5), rng.uniform(0, 2 * np.pi), cc, cc * 0.7,
                              curl=rng.uniform(-0.2, 0.2), sh_op=0.3), x, y)
        placed += 1
    # sedge tufts
    placed = 0
    while placed < 95:
        x, y = rng.uniform(0, N, 2)
        if P[int(y) % N, int(x) % N] > 0.2:
            continue
        sedge_tuft(img, rng, x, y, ['#7a9a3a', '#8aaa42', '#6a8a30', '#aaa858', '#9a9a4c'], n=(6, 11), L=(9, 17))
        placed += 1
    return {'ground': img[..., :3]}


# ============================================================================ WATER

def swamp_water():
    z1 = fbm(N, 4121, 4, 64, beta=2.0)
    z2 = fbm(N, 4122, 4, 64, beta=2.0)
    col = np.ones((N, N, 3)) * hexrgb('#313722')
    col = over(col, hexrgb('#22281a'), 0.1 + 0.18 * z1)
    col = over(col, hexrgb('#46462a'), -0.1 - 0.18 * z2)
    col = over(col, hexrgb('#4a3e26'), smoothstep(0.4, 1.6, fbm(N, 4128, 3, 20, beta=2.2)) * 0.3)
    h = fbm(N, 4123, 3, 48, beta=2.0, aniso=(1.0, 3.0), angle=0.1) + 0.035 * fbm(N, 4124, 30, 160, beta=1.5, aniso=(1.0, 3.0))
    H = 0.5 + 0.12 * zscore(h)
    col = col * (0.68 + 0.34 * 1.2 * lambert(normals_from_height(H * 13.0), 225, 55))[..., None]
    sheen_a = blur_wrap(np.clip((fbm(N, 4126, 5, 40, beta=2.2, aniso=(1.0, 2.2), angle=0.1) - 0.5) * 0.7, 0, 1), 2.0) * 0.35
    sheen_a *= np.clip(0.55 + 0.35 * zscore(H), 0, 1.2)
    col = over(col, hexrgb('#7a8466'), sheen_a)
    col = over(col, hexrgb('#dfe2c8'), 0.9 * spec(normals_from_height(H * 10.4), 26, 225, 38) * 0.4)
    # floating duckweed: drifting patches, densest in their middles, with stragglers around
    dm = fbm(N, 4106, 2, 14, beta=2.0) + 0.3 * fbm(N, 4107, 10, 60, beta=1.5)
    cover = smoothstep(0.55, 1.25, dm) * 0.95 + smoothstep(0.1, 0.6, dm) * 0.12
    dc, da, dsh = duckweed(N, 200, 4108, cover, ('#62822a', '#8aa63a'), size=0.33)
    col = over(col, hexrgb('#121608'), dsh * 0.5)
    col = over(col, dc, da)
    img = np.concatenate([col, np.ones((N, N, 1))], -1)
    rng = np.random.default_rng(412)
    for cl in range(7):
        cx, cy = rng.uniform(0, N, 2)
        for k in range(rng.integers(2, 6)):
            x, y = cx + rng.normal() * 16, cy + rng.normal() * 12
            r = rng.uniform(6.5, 11.0)
            c = hexrgb(['#4a7228', '#557c2c', '#46682a'][k % 3]) * rng.uniform(0.92, 1.08)
            stamp(img, pad_patch(r, c, rng.uniform(0, 2 * np.pi)), x, y)
            if rng.uniform() < 0.2:  # a water-lily, white or pale pink
                fc = hexrgb(['#f2eee4', '#f0c8d4'][rng.integers(2)])
                for a in np.linspace(0, 2 * np.pi, 7, endpoint=False):
                    q = leaf_patch(4.6, 2.4, a, fc, fc * 0.85, ss=4, shadow=(0.5, 0.6), sh_op=0.25)
                    stamp(img, q, x + 2.0 * np.cos(a), y + 2.0 * np.sin(a))
                stamp(img, disc_patch(1.4, hexrgb('#e8c040'), shadow=(0, 0), sh_op=0), x, y)
    return {'water': img[..., :3]}


# ============================================================================ ROCK

def swamp_rock():
    H, edge, r = crag_height(430, n_blocks=22, amp=22)
    Nn = normals_from_height(H)
    shc = cast_shadow(H, 26, 42)
    shade = 0.28 + 0.95 * lambert(Nn, 225, 45) * (0.35 + 0.65 * shc)
    base = mix(hexrgb('#2a2c24'), hexrgb('#43463a'), smoothstep(-1.2, 1.4, fbm(N, 4132, 3, 80, beta=1.8)))
    base = base * (1 + 0.08 * fbm(N, 4133, 60, 256, beta=0.8))[..., None]
    col = base * shade[..., None]
    # slime streaks: glossy dark-olive runs down the faces, yellowish where they catch the light
    sraw = fbm(N, 4134, 3, 90, beta=1.3, aniso=(1.0, 0.07), angle=0.6)
    sl = smoothstep(1.0, 1.8, sraw) * smoothstep(-0.2, 0.7, fbm(N, 4135, 2, 12, beta=2.0))
    slc = mix(hexrgb('#3e4420'), hexrgb('#6a6e2c'), smoothstep(0.6, 1.1, lambert(Nn, 225, 45)))
    col = over(col, slc * (0.6 + 0.6 * shc)[..., None], sl * 0.75)
    wet = spec(Nn, 24, 225, 45) * shc * (0.25 + 0.5 * sl)
    col = over(col, hexrgb('#c8ccb0'), wet)
    col = over(col, hexrgb('#0c0d0a'), (1 - smoothstep(0.5, 2.5, edge)) * 0.8)
    # thick moss in the cracks and hollows and over some tops
    low = 1 - smoothstep(-0.9, 0.2, zscore(blur_wrap(H, 3)))
    mn = fbm(N, 4137, 8, 120, beta=1.3)
    moss = np.clip(np.maximum((1 - smoothstep(1.5, 9, edge)) * smoothstep(-1.0, 0.1, mn), low * smoothstep(-0.4, 0.6, mn)), 0, 1)
    moss = np.maximum(moss, smoothstep(0.9, 1.6, fbm(N, 4138, 3, 30, beta=2.0)) * 0.9)
    mtex = fbm(N, 4139, 60, 256, beta=0.7)
    mcol = mix(hexrgb('#24361a'), hexrgb('#4a6226'), smoothstep(-1, 1.5, mtex + 0.5 * fbm(N, 4141, 8, 40, beta=1.5)))
    mcol = mcol * (0.5 + 0.55 * lambert(normals_from_height(H * 0.5 + 3 * fbm(N, 4140, 60, 256, beta=0.6)), 225, 50)
                   * (0.5 + 0.5 * shc))[..., None]
    col = over(col, mcol, smoothstep(0.2, 0.6, moss))
    return {'rock': col}


# ============================================================================ CLIFF (128 x 48)

def swamp_cliff():
    ss = 4
    Wc, Hc = 128 * ss, 48 * ss
    rng = np.random.default_rng(493)
    ys, xs = np.mgrid[0:Hc, 0:Wc] / ss
    yn = ys / 48.0

    def pfbm(seed, f_lo, f_hi, beta=2.0, aniso=(1, 1)):
        return fbm(Wc, seed, f_lo, f_hi, beta=beta, aniso=aniso)[:Hc]
    col, w, bi, t, hard = layered_face(Wc, Hc, ss, rng, 4911,
                                       ['#4a3a26', '#57462c', '#3e3220', '#5e4c30', '#4c3e28', '#635236', '#43361f'],
                                       joint_col='#1e160c', warp_amp=2.4)
    # earthy, crumbly texture with pebbles; wetter (darker, glossier) toward the bottom
    col = col * (1 + 0.12 * pfbm(4912, 30, 200, 0.9))[..., None]
    F1, F2, ID = jworley(Wc, 64, 4913)
    F1 = F1[:Hc]
    keep = np.random.default_rng(4914).uniform(0, 1, 64 * 64)[ID[:Hc]] < 0.12
    peb = smoothstep(0.32, 0.22, F1) * keep
    col = over(col, hexrgb('#6a6050') * (1 + 0.4 * smoothstep(0.3, 0.0, F1))[..., None], peb * 0.8)
    col = col * (1 - 0.55 * smoothstep(0.35, 1.0, yn))[..., None]
    wl = 39 + 1.2 * pfbm(4915, 2, 16)
    col = over(col, hexrgb('#1c1a10'), smoothstep(wl - 3, wl, ys) * 0.55)
    col = over(col, hexrgb('#8a8a66'), np.exp(-((ys - wl + 0.5) / 0.5) ** 2) * 0.35)
    # grassy lip with blades hanging over the edge
    gt = 6 + 2.0 * pfbm(4916, 3, 24) + 3 * smoothstep(0.5, 1.6, pfbm(4917, 6, 30, 1.5))
    gc = mix(hexrgb('#3e5422'), hexrgb('#6a822e'), smoothstep(-1, 1.4, pfbm(4918, 30, 200, 0.8)))
    gc = gc * (1 - 0.45 * smoothstep(0.2, 1, ys / np.maximum(gt, 1)))[..., None]
    gm = 1 - smoothstep(gt - 1, gt + 0.6, ys)
    under = (1 - smoothstep(gt, gt + 3, ys)) * smoothstep(gt - 0.5, gt + 0.3, ys)
    col = over(col, hexrgb('#120e08'), under * 0.6)
    col = over(col, gc, gm)
    img = np.concatenate([col, np.ones((Hc, Wc, 1))], -1)

    def stroke(pts, r0, r1, c0, c1, shadow=True):
        """A tapered line through pts (in output px), lit from the left, periodic in x."""
        n = len(pts)
        for i, (px_, py_) in enumerate(pts):
            tt = i / max(n - 1, 1)
            rr = (r0 + (r1 - r0) * tt) * ss
            cc = mix(hexrgb(c0), hexrgb(c1), tt)
            for ox in (-128, 0, 128):
                cx, cy = (px_ + ox) * ss, py_ * ss
                if -rr - 8 <= cx < Wc + rr + 8:
                    x0_, x1_ = int(max(cx - rr - 6, 0)), int(min(cx + rr + 6, Wc))
                    y0_, y1_ = int(max(cy - rr - 6, 0)), int(min(cy + rr + 6, Hc))
                    if x0_ < x1_ and y0_ < y1_:
                        X = np.arange(x0_, x1_)[None]
                        Y = np.arange(y0_, y1_)[:, None]
                        if shadow:
                            ds_ = np.hypot(X - cx - 0.8 * ss, Y - cy - 1.0 * ss)
                            sa = np.clip(rr + 1 - ds_, 0, 1) * 0.35
                            img[y0_:y1_, x0_:x1_, :3] *= (1 - sa[..., None])
                        d = np.hypot(X - cx, Y - cy)
                        a = np.clip(rr - d + 0.5, 0, 1)
                        g = cc * (1 + 0.35 * np.clip((cx - X) / (rr + 1e-6), -1, 1))[..., None]
                        img[y0_:y1_, x0_:x1_, :3] = img[y0_:y1_, x0_:x1_, :3] * (1 - a[..., None]) + g * a[..., None]
    # roots: a few thick ones snaking across the bank, thin ones dangling from the lip
    for k in range(4):
        x0 = rng.uniform(0, 128)
        L = rng.uniform(40, 70)
        dirx = rng.choice([-1, 1]) * rng.uniform(0.6, 1.0)
        pts = []
        y = rng.uniform(6, 9)
        x = x0
        for i in range(140):
            tt = i / 139
            x += dirx * L / 140
            y += (rng.uniform(0.05, 0.35) + 0.2 * np.sin(tt * 6 + k)) * 0.6
            pts.append((x, min(y, 44)))
        stroke(pts, rng.uniform(1.3, 1.8), 0.5, '#4a3622', '#3a2a1a')
    for k in range(9):
        x0 = rng.uniform(0, 128)
        L = rng.uniform(6, 20)
        ph = rng.uniform(0, 6)
        pts = [(x0 + 1.2 * np.sin(yy * 0.35 + ph) * (yy / L), 5 + yy) for yy in np.linspace(0, L, 60)]
        stroke(pts, rng.uniform(0.6, 0.9), 0.25, '#5a4630', '#6e5a40')
    # grass blades over the lip
    for k in range(70):
        x0 = rng.uniform(0, 128)
        y0 = 3 + rng.uniform(0, 4)
        L = rng.uniform(4, 9)
        lean = rng.uniform(-0.6, 0.6)
        c0 = ['#4e6a26', '#5e7a2c', '#6e8a34', '#7a7e3a'][rng.integers(4)]
        pts = [(x0 + lean * yy, y0 + yy) for yy in np.linspace(0, L, 24)]
        stroke(pts, 0.55, 0.2, c0, c0, shadow=False)
    return {'cliff': downsample(img[..., :3], ss)}


JOBS = {'ground': swamp_ground, 'water': swamp_water, 'rock': swamp_rock, 'cliff': swamp_cliff}

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for k in (sys.argv[1:] or JOBS):
        for name, img in JOBS[k]().items():
            save_rgb(img, f'{OUT}/{name}.png')
            print(name, img.shape, (np.clip(img, 0, 1).reshape(-1, 3).mean(0) * 255).round(1))

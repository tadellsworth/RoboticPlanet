"""Alien Bloom ground / water / rock (512 seamless), cliff (128x48, tiles left-right) and night glow maps.

Ground: violet-indigo spongy moss with a fine cellular texture, thin soft-pink veins and spore dots.
Water: a glossy pink-magenta liquid with slow swirls, a few bubbles and foam rings.
Rock: dark slate-blue stone with faint violet mineral veins. Cliff: violet-grey layered stone.
ground-glow / water-glow: black except the bioluminescent veins, spores and swirls (added at night).

Also holds a few helpers the swamp script reuses: jworley (fast periodic cells), disc_patch, advect.
"""
import os
import sys
import numpy as np
from tex import *
from terrain_biomes import N, over, leaf_patch, crag_height, cast_shadow, _paste

OUT = 'out/art/biomes/alien'


# ============================================================================ helpers

def jworley(n, g, seed, jit=0.85, warp=None):
    """Periodic Worley on a g x g jittered grid (one point per cell): fast for many small cells.
    warp=(wx, wy): periodic pixel offsets that bend the cells. Returns F1, F2 in cell units and cell ids."""
    rng = np.random.default_rng(seed)
    off = 0.5 + rng.uniform(-jit / 2, jit / 2, (g, g, 2))
    ys, xs = np.mgrid[0:n, 0:n].astype(float)
    if warp is not None:
        xs, ys = xs + warp[0], ys + warp[1]
    u = (xs + 0.5) / n * g
    v = (ys + 0.5) / n * g
    ci, cj = np.floor(u).astype(int), np.floor(v).astype(int)
    F1 = np.full((n, n), 9.0)
    F2 = np.full((n, n), 9.0)
    ID = np.zeros((n, n), int)
    for di in (-1, 0, 1):
        for dj in (-1, 0, 1):
            a, b = ci + di, cj + dj
            am, bm = a % g, b % g
            px = a + off[bm, am, 0]
            py = b + off[bm, am, 1]
            d = np.hypot(u - px, v - py)
            closer = d < F1
            F2 = np.where(closer, F1, np.minimum(F2, d))
            ID = np.where(closer, bm * g + am, ID)
            F1 = np.where(closer, d, F1)
    return F1, F2, ID


def disc_patch(r, col, ss=4, ring=0.0, shadow=(0.5, 0.6), sh_op=0.25, hl=0.0, rim_dark=0.0):
    """A small round dot (or a ring when ring>0: its width in px), RGBA float, with a soft drop shadow."""
    pad = int(r + 4)
    S = 2 * pad * ss
    ys, xs = (np.mgrid[0:S, 0:S] + 0.5) / ss - pad
    out = np.zeros((S, S, 4))
    d_sh = np.hypot(xs - shadow[0], ys - shadow[1])
    d = np.hypot(xs, ys)
    if ring > 0:
        msh = np.clip((ring / 2 - np.abs(d_sh - r)) * 2 + 0.5, 0, 1)
        m = np.clip((ring / 2 - np.abs(d - r)) * ss * 0.5 + 0.5, 0, 1)
    else:
        msh = np.clip((r - d_sh) * 1.5 + 0.5, 0, 1)
        m = np.clip((r - d) * ss * 0.5 + 0.5, 0, 1)
    out[..., 3] = ndimage.gaussian_filter(msh, ss * 0.6) * sh_op
    c = np.asarray(col, float)[None, None] * np.ones((S, S, 1))
    if hl > 0:  # a lit dome: light top-left, darker lower right
        t = np.clip(1 - np.hypot(xs + r * 0.35, ys + r * 0.35) / (r * 1.1 + 1e-6), 0, 1)
        c = c * (0.8 + 0.25 * (-(xs + ys) / (2 * r + 1e-6)))[..., None]
        c = c + (1 - c) * (hl * t ** 2)[..., None]
    if rim_dark > 0:
        c = c * (1 - rim_dark * smoothstep(0.55, 1.0, d / (r + 1e-6)))[..., None]
    out[..., :3] = out[..., :3] * (1 - m[..., None]) + c * m[..., None]
    out[..., 3] = out[..., 3] * (1 - m) + m
    from terrain_biomes import ds_rgba
    return ds_rgba(out, ss)


def sample_wrap(f, X, Y, order=1):
    n = f.shape[0]
    return ndimage.map_coordinates(f, [Y % n, X % n], order=order, mode='grid-wrap')


def advect(field, psi, steps=24, dist=60.0):
    """Drag `field` along the swirling flow whose stream function is `psi` (both periodic): marbling."""
    n = field.shape[0]
    gy, gx = np.gradient(np.concatenate([psi[-1:], psi, psi[:1]], 0), axis=0)[1:-1], \
        np.gradient(np.concatenate([psi[:, -1:], psi, psi[:, :1]], 1), axis=1)[:, 1:-1]
    vx, vy = gy, -gx
    sp = np.sqrt(vx ** 2 + vy ** 2)
    k = dist / steps / (np.percentile(sp, 95) + 1e-9)
    ys, xs = np.mgrid[0:n, 0:n].astype(float)
    X, Y = xs.copy(), ys.copy()
    for _ in range(steps):
        X, Y = X - k * sample_wrap(vx, X, Y), Y - k * sample_wrap(vy, X, Y)
    return sample_wrap(field, X, Y)


def contour_lines(f, width):
    """Lines along the zero crossings of a smooth field f, about `width` px wide (periodic)."""
    gx = (np.roll(f, -1, 1) - np.roll(f, 1, 1)) * 0.5
    gy = (np.roll(f, -1, 0) - np.roll(f, 1, 0)) * 0.5
    d = np.abs(f) / (np.hypot(gx, gy) + 1e-6)
    return smoothstep(width * 0.5 + 0.6, width * 0.5 - 0.4, d)


def glow_add(dst, mask, col, k=1.0):
    dst += np.asarray(col, float)[None, None] * (mask * k)[..., None]


# ============================================================================ GROUND

PINK = hexrgb('#ff5cb8')
VIOL = hexrgb('#b467ff')
GOLD = hexrgb('#ffc95a')
AQUA = hexrgb('#6af0ff')


def alien_ground():
    rng = np.random.default_rng(301)
    broad = fbm(N, 3001, 3, 40, beta=2.0)
    col = mix(hexrgb('#4e3c6c'), hexrgb('#7e62a0'), smoothstep(-1.4, 1.4, broad))
    hollow = smoothstep(0.3, 1.4, fbm(N, 3002, 3, 28, beta=2.0))
    col = over(col, hexrgb('#363066'), hollow * 0.45)
    blush = smoothstep(0.6, 1.6, fbm(N, 3003, 3, 24, beta=2.0))
    col = over(col, hexrgb('#8a5094'), blush * 0.35)
    # moss cushions: soft bumps (no hard outlines) made of fine spongy cells with pores
    warp = (9 * fbm(N, 3014, 2, 16, beta=1.6), 9 * fbm(N, 3015, 2, 16, beta=1.6))
    F1m, F2m, IDm = jworley(N, 16, 3004, jit=0.8, warp=warp)
    dome_m = 1 - smoothstep(0.15, 0.85, F1m)
    crease = 1 - smoothstep(0.0, 0.3, F2m - F1m)
    F1f, F2f, IDf = jworley(N, 100, 3006, jit=0.9)
    dome_f = 1 - smoothstep(0.0, 0.72, F1f)
    groove_f = 1 - smoothstep(0.0, 0.2, F2f - F1f)
    rf = np.random.default_rng(3007).uniform(0, 1, 100 * 100)
    pore = (rf[IDf] < 0.22) * (1 - smoothstep(0.1, 0.26, F1f))
    H = 1.3 * dome_m - 0.7 * crease + 0.5 * dome_f - 0.5 * groove_f - 0.8 * pore + 0.6 * broad
    lit = relief(normals_from_height(H * 1.7), 225, 50)
    tint = np.random.default_rng(3008).uniform(-1, 1, 16 * 16)[IDm]
    col = over(col, hexrgb('#5e3e8a'), np.clip(tint, 0, 1) * 0.3)
    col = over(col, hexrgb('#5a5296'), np.clip(-tint, 0, 1) * 0.3)
    ftone = np.random.default_rng(3009).uniform(-1, 1, 100 * 100)[IDf]
    col = col * (1 + 0.06 * ftone)[..., None]
    col = over(col, hexrgb('#a08ccc'), smoothstep(0.5, 1.0, dome_f) * smoothstep(0.3, 1.0, dome_m) * 0.2)
    col = over(col, hexrgb('#2c2254'), np.maximum(crease * 0.3, groove_f * 0.28))
    col = col * (0.72 + 0.32 * lit)[..., None]
    col = over(col, hexrgb('#1e1638'), pore * 0.7)
    glow = np.zeros((N, N, 3))
    # veins: a bent, broken network (like mycelium) with fine capillaries branching off it
    wv = (14 * fbm(N, 3016, 2, 20, beta=1.5), 14 * fbm(N, 3017, 2, 20, beta=1.5))
    G1, G2, _ = jworley(N, 6, 3011, jit=0.9, warp=wv)
    d1 = (G2 - G1) * (N / 6) * 0.5
    w1 = 0.55 + 0.45 * smoothstep(-1, 1, fbm(N, 3018, 3, 20, beta=1.5))
    v1 = smoothstep(w1 + 0.5, w1 - 0.4, d1) * smoothstep(-0.55, 0.15, fbm(N, 3010, 3, 16, beta=1.6))
    wv2 = (6 * fbm(N, 3019, 4, 40, beta=1.5), 6 * fbm(N, 3020, 4, 40, beta=1.5))
    G1, G2, _ = jworley(N, 17, 3012, jit=0.9, warp=wv2)
    d2 = (G2 - G1) * (N / 17) * 0.5
    near = smoothstep(0.01, 0.08, blur_wrap(v1, 10))
    v2 = smoothstep(0.85, 0.15, d2) * near * smoothstep(-0.3, 0.5, fbm(N, 3013, 6, 40, beta=1.4))
    vein = np.clip(v1 + 0.6 * v2, 0, 1)
    halo = blur_wrap(vein, 2.5)
    col = over(col, hexrgb('#b05aa8'), np.clip(halo * 1.0, 0, 0.28))
    col = over(col, hexrgb('#3a1c46'), np.clip(blur_wrap(vein, 1.0) * 1.2 - vein, 0, 1) * 0.3)
    col = over(col, mix(hexrgb('#cc6cb4'), hexrgb('#f2a6dc'), v1), vein * 0.82)
    glow_add(glow, v1, PINK, 0.8)
    glow_add(glow, v2 * 0.6, hexrgb('#d860ff'), 0.7)
    glow_add(glow, blur_wrap(vein, 3.0), PINK, 0.8)
    img = np.concatenate([col, np.ones((N, N, 1))], -1)
    # spores: little pale bumps, often in clusters near the veins
    gimg = np.concatenate([glow, np.ones((N, N, 1))], -1)
    cols = [('#e8c4f4', VIOL), ('#f4b0d8', PINK), ('#f0d080', GOLD), ('#c8f0f4', AQUA), ('#d8b4f0', VIOL)]
    placed = 0
    while placed < 420:
        x, y = rng.uniform(0, N, 2)
        w8 = 0.15 + 0.85 * near[int(y) % N, int(x) % N]
        if rng.uniform() > w8:
            continue
        k = rng.choice(len(cols), p=[0.36, 0.3, 0.16, 0.06, 0.12])
        c, gc = cols[k]
        r = rng.uniform(0.7, 1.5)
        stamp(img, disc_patch(r, hexrgb(c) * rng.uniform(0.85, 1.05), hl=0.5, sh_op=0.35), x, y)
        g = disc_patch(r * 1.1, gc * rng.uniform(0.5, 0.9), shadow=(0, 0), sh_op=0.0)
        g[..., :3] *= g[..., 3:4]
        stamp(gimg, np.concatenate([g[..., :3], np.zeros(g.shape[:2] + (1,))], -1), x, y, mode='add')
        placed += 1
    # a few spore puffballs: clusters of bigger round caps
    for k in range(9):
        cx, cy = rng.uniform(0, N, 2)
        for q in range(rng.integers(3, 7)):
            x, y = cx + rng.normal() * 4, cy + rng.normal() * 4
            r = rng.uniform(1.6, 2.8)
            c = hexrgb(['#c08ad8', '#d49ae0', '#b47ad0'][q % 3])
            stamp(img, disc_patch(r, c, hl=0.45, sh_op=0.4, shadow=(0.8, 0.9), rim_dark=0.25), x, y)
            g = disc_patch(r * 0.6, VIOL * 0.55, shadow=(0, 0), sh_op=0.0)
            g[..., :3] *= g[..., 3:4]
            stamp(gimg, np.concatenate([g[..., :3], np.zeros(g.shape[:2] + (1,))], -1), x, y, mode='add')
    glow = gimg[..., :3]
    glow = glow + 0.6 * np.stack([blur_wrap(glow[..., c], 2.0) for c in range(3)], -1)
    return {'ground': img[..., :3], 'ground-glow': np.clip(glow * 0.36, 0, 1)}


# ============================================================================ WATER

def alien_water():
    rng = np.random.default_rng(302)
    psi = fbm(N, 3021, 1.5, 5, beta=2.4)
    base = fbm(N, 3022, 2, 14, beta=1.7, aniso=(1.0, 2.0), angle=0.4)
    marb = zscore(advect(base, psi, steps=40, dist=120))
    marb2 = zscore(advect(fbm(N, 3023, 2, 14, beta=1.8), psi, steps=24, dist=50))
    col = mix(hexrgb('#5e1652'), hexrgb('#9a2c7c'), smoothstep(-1.6, 1.6, marb2 + 0.35 * marb))
    col = over(col, hexrgb('#46103e'), smoothstep(0.6, 2.0, -marb) * 0.45)
    band = smoothstep(0.5, 1.8, marb)
    col = over(col, hexrgb('#b84a96'), band * 0.4)
    # thin swirl filaments following the flow
    fil = np.clip(contour_lines(marb - 1.0, 1.2) + 0.6 * contour_lines(marb + 0.8, 0.9), 0, 1)
    fil *= smoothstep(-0.3, 0.6, fbm(N, 3028, 2, 10, beta=1.6))
    col = over(col, hexrgb('#ee98cc'), fil * 0.45)
    # gloss: gentle swell, a broad sky sheen and sharp highlights
    h = fbm(N, 3025, 3, 32, beta=2.2) + 0.03 * fbm(N, 3026, 30, 160, beta=1.5)
    H = 0.5 + 0.12 * zscore(h) + 0.006 * marb
    col = col * (0.74 + 0.3 * lambert(normals_from_height(H * 13.0), 225, 55))[..., None]
    sheen = blur_wrap(np.clip((fbm(N, 3027, 3, 24, beta=2.3, aniso=(1.0, 2.0), angle=0.6) - 0.5) * 0.7, 0, 1), 2.0) * 0.3
    col = over(col, hexrgb('#e6a4d4'), sheen)
    col = over(col, hexrgb('#fff0fa'), spec(normals_from_height(H * 10.4), 28, 225, 38) * 0.5)
    glow = np.zeros((N, N, 3))
    glow_add(glow, fil, hexrgb('#ff4cb0'), 0.55)
    glow_add(glow, band * 0.25, hexrgb('#c040a0'), 0.5)
    img = np.concatenate([col, np.ones((N, N, 1))], -1)
    gimg = np.concatenate([glow, np.ones((N, N, 1))], -1)
    # bubbles and foam rings
    for cl in range(7):
        cx, cy = rng.uniform(0, N, 2)
        R = rng.uniform(6, 13)
        stamp(img, disc_patch(R, hexrgb('#f0a8d8'), ring=1.1, shadow=(0, 0), sh_op=0) * np.array([1, 1, 1, 0.35]), cx, cy)
        if rng.uniform() < 0.6:
            stamp(img, disc_patch(R * 1.6, hexrgb('#e894cc'), ring=0.9, shadow=(0, 0), sh_op=0) * np.array([1, 1, 1, 0.18]),
                  cx, cy)
        for k in range(rng.integers(3, 8)):
            a, d = rng.uniform(0, 2 * np.pi), rng.uniform(0, R * 0.8)
            x, y = cx + d * np.cos(a), cy + d * np.sin(a)
            r = rng.uniform(0.9, 2.4)
            p = disc_patch(r, hexrgb('#b84a96'), shadow=(0.6, 0.7), sh_op=0.3, hl=0.0)
            stamp(img, p * np.array([1, 1, 1, 0.6]), x, y)
            stamp(img, disc_patch(r, hexrgb('#ffd8f0'), ring=0.7, shadow=(0, 0), sh_op=0) * np.array([1, 1, 1, 0.85]), x, y)
            stamp(img, disc_patch(max(0.45, r * 0.3), hexrgb('#ffffff'), shadow=(0, 0), sh_op=0), x - r * 0.4, y - r * 0.4)
            g = disc_patch(r, hexrgb('#ff7ad0') * 0.45, ring=1.0, shadow=(0, 0), sh_op=0)
            g[..., :3] *= g[..., 3:4]
            stamp(gimg, np.concatenate([g[..., :3], np.zeros(g.shape[:2] + (1,))], -1), x, y, mode='add')
    glow = gimg[..., :3]
    glow = glow + 0.5 * np.stack([blur_wrap(glow[..., c], 3.0) for c in range(3)], -1)
    return {'water': img[..., :3], 'water-glow': np.clip(glow * 0.85, 0, 1)}


# ============================================================================ ROCK

def alien_rock():
    H, edge, r = crag_height(330, n_blocks=24, amp=24)
    Nn = normals_from_height(H)
    shc = cast_shadow(H, 26, 42)
    shade = 0.3 + 0.95 * lambert(Nn, 225, 45) * (0.35 + 0.65 * shc)
    base = mix(hexrgb('#22243a'), hexrgb('#3a3c56'), smoothstep(-1.2, 1.4, fbm(N, 3032, 3, 80, beta=1.8)))
    base = base * (1 + 0.08 * fbm(N, 3033, 60, 256, beta=0.8))[..., None]
    # faint violet mineral veins and flecks
    vm = smoothstep(-0.3, 0.7, fbm(N, 3034, 2, 14, beta=1.6))
    v1 = contour_lines(fbm(N, 3035, 3, 30, beta=1.6), 1.2) * vm
    v2 = contour_lines(fbm(N, 3036, 8, 70, beta=1.4), 0.7) * smoothstep(0.0, 0.8, fbm(N, 3037, 3, 20, beta=1.6))
    base = over(base, hexrgb('#9a78d0'), np.clip(v1 * 0.85 + v2 * 0.5, 0, 1))
    base = over(base, hexrgb('#5a4488'), np.clip(blur_wrap(v1, 1.5) * 0.8, 0, 0.35))
    fl = smoothstep(2.0, 2.6, fbm(N, 3038, 100, 256, beta=0.1))
    base = over(base, hexrgb('#a88ad8'), fl * 0.5)
    col = base * shade[..., None]
    wet = spec(Nn, 26, 225, 45) * shc * 0.3
    col = over(col, hexrgb('#b4a8d8'), wet)
    col = over(col, hexrgb('#0a0812'), (1 - smoothstep(0.5, 2.5, edge)) * 0.8)
    # violet spongy moss tucked into the cracks and hollows
    low = 1 - smoothstep(-1.2, 0.0, zscore(blur_wrap(H, 3)))
    mn = fbm(N, 3039, 8, 120, beta=1.3)
    moss = np.clip(np.maximum((1 - smoothstep(1.5, 5, edge)) * smoothstep(0.3, 1.0, mn), low * smoothstep(0.5, 1.2, mn)), 0, 1)
    F1, F2, _ = jworley(N, 90, 3040)
    sponge = 1 - smoothstep(0, 0.7, F1)
    mcol = mix(hexrgb('#3c2c62'), hexrgb('#62489a'), sponge)
    mcol = mcol * (0.6 + 0.45 * lambert(normals_from_height(H * 0.4 + 2 * sponge), 225, 50) * (0.5 + 0.5 * shc))[..., None]
    col = over(col, mcol, smoothstep(0.35, 0.75, moss) * 0.75)
    return {'rock': col}


# ============================================================================ CLIFF (128 x 48)

def layered_face(Wc, Hc, ss, rng, seed, bands, top=0.0, joint_col='#18121f', warp_amp=1.6):
    """Sedimentary stone for a 128-px cliff strip (periodic in x): bands of random thickness and
    hardness, each cut into staggered blocks; hard bands stand out with a lit top and a shadow below."""
    ys, xs = np.mgrid[0:Hc, 0:Wc] / ss

    def pfbm(sd, f_lo, f_hi, beta=2.0, aniso=(1, 1)):
        return fbm(Wc, sd, f_lo, f_hi, beta=beta, aniso=aniso)[:Hc]
    w = ys + warp_amp * pfbm(seed, 1, 6, 2.0, aniso=(1, 8)) + 0.4 * pfbm(seed + 1, 6, 40, 1.2)
    edges = [top - 6.0]
    while edges[-1] < 60:
        edges.append(edges[-1] + rng.uniform(3.0, 8.0))
    edges = np.array(edges)
    nb = len(edges) - 1
    bi = np.clip(np.searchsorted(edges, w) - 1, 0, nb - 1)
    t = (w - edges[bi]) / (edges[bi + 1] - edges[bi])
    cols = np.array([hexrgb(bands[rng.integers(len(bands))]) for _ in range(nb)])
    hard = rng.uniform(0, 1, nb)
    col = cols[bi] * (1 + 0.1 * pfbm(seed + 2, 50, 240, 0.4))[..., None]
    # rounded band profile: lit near the top, shaded toward the bottom (more so on hard bands)
    prof = 1.0 + (0.18 + 0.2 * hard[bi]) * (0.5 - t) * 2
    col = col * prof[..., None]
    # block joints, staggered per band
    jm = np.zeros((Hc, Wc))
    for i in range(nb):
        nj = rng.integers(0, 4)
        jx = np.sort(rng.uniform(0, 128, nj))
        on = bi == i
        lean = rng.uniform(-1.5, 1.5)
        for x0 in jx:
            d = np.abs(((xs - x0 - lean * t - 0.5 * np.sin(t * 7 + x0)) + 64) % 128 - 64)
            jm = np.maximum(jm, on * np.exp(-(d / 0.45) ** 2))
            col = col * (1 + on * 0.12 * np.exp(-((((xs - x0) + 64) % 128 - 64 - 1.6) / 1.2) ** 2))[..., None]
    gap = np.exp(-(np.minimum(t, 1 - t) * (edges[bi + 1] - edges[bi]) / 0.45) ** 2)
    col = over(col, hexrgb(joint_col), np.clip(np.maximum(jm, gap) * 0.85, 0, 1))
    under = np.exp(-((t - 0.12) / 0.12) ** 2) * hard[np.clip(bi - 1, 0, nb - 1)] * (bi > 0)
    col = col * (1 - 0.35 * under)[..., None]
    col = over(col, hexrgb('#0c0a10'), smoothstep(1.5, 2.1, pfbm(seed + 3, 100, 256, 0.1)) * 0.6)
    return col, w, bi, t, hard


def alien_cliff():
    ss = 4
    Wc, Hc = 128 * ss, 48 * ss
    rng = np.random.default_rng(393)
    ys, xs = np.mgrid[0:Hc, 0:Wc] / ss
    yn = ys / 48.0

    def pfbm(seed, f_lo, f_hi, beta=2.0, aniso=(1, 1)):
        return fbm(Wc, seed, f_lo, f_hi, beta=beta, aniso=aniso)[:Hc]
    col, w, bi, t, hard = layered_face(Wc, Hc, ss, rng, 3911,
                                       ['#4c4462', '#5e5476', '#6c6286', '#544a6c', '#7a7092', '#463e5a', '#62587c'])
    # thin pink mineral seams along a few band boundaries
    seam = np.exp(-(t / 0.08) ** 2) * (rng.uniform(0, 1, 40)[bi] < 0.35) * smoothstep(-0.2, 0.8, pfbm(3914, 3, 20, 1.5))
    col = over(col, hexrgb('#c87ab8'), seam * 0.6)
    col = col * (1 - 0.6 * smoothstep(0.3, 1.0, yn))[..., None]
    # spongy violet moss cap with a dripping edge and a pink vein or two
    mt = 9 + 2.5 * pfbm(3916, 3, 24) + 6 * smoothstep(0.6, 1.6, pfbm(3917, 6, 30, 1.5))
    F1, F2, _ = jworley(Wc, 96, 3918)
    F1, F2 = F1[:Hc], F2[:Hc]
    sponge = 1 - smoothstep(0, 0.7, F1)
    mossc = mix(hexrgb('#4a3672'), hexrgb('#8264b4'), sponge * 0.75 + 0.25 * smoothstep(-1, 1.4, pfbm(3919, 30, 200, 0.8)))
    mossc = over(mossc, hexrgb('#2e2250'), (1 - smoothstep(0, 0.12, F2 - F1)) * 0.5)
    mossc = mossc * (1 - 0.5 * smoothstep(0.3, 1, ys / np.maximum(mt, 1)))[..., None]
    mossm = 1 - smoothstep(mt - 1, mt + 0.6, ys)
    under = (1 - smoothstep(mt, mt + 3, ys)) * smoothstep(mt - 0.5, mt + 0.3, ys)
    col = over(col, hexrgb('#120c1a'), under * 0.6)
    col = over(col, mossc, mossm)
    veins = contour_lines(pfbm(3920, 3, 16, 1.6), 1.3 * ss) * mossm * smoothstep(1.5, 3.5, ys)
    col = over(col, hexrgb('#ec90cc'), veins * 0.7)
    img = np.concatenate([col, np.ones((Hc, Wc, 1))], -1)
    # a few hanging tendrils with pale bulb tips
    for v in range(4):
        vx = rng.uniform(0, 128)
        L = rng.uniform(14, 30)
        amp = rng.uniform(0.8, 2.0)
        ph = rng.uniform(0, 6)
        for py_ in np.linspace(5, L, 200):
            px_ = vx + amp * np.sin(py_ * 0.3 + ph)
            tt = (py_ - 5) / (L - 5)
            for ox in (-128, 0, 128):
                cx, cy = (px_ + ox) * ss, py_ * ss
                if -6 <= cx < Wc + 6:
                    x0_, x1_ = int(max(cx - 6, 0)), int(min(cx + 6, Wc))
                    y0_, y1_ = int(max(cy - 6, 0)), int(min(cy + 6, Hc))
                    if x0_ < x1_ and y0_ < y1_:
                        d = np.hypot(np.arange(x0_, x1_)[None] - cx, np.arange(y0_, y1_)[:, None] - cy)
                        a = np.clip((4.4 - 1.6 * tt) - d, 0, 1)
                        g = mix(hexrgb('#5a3474'), hexrgb('#b0609e'), smoothstep(0.5, 1.0, tt)) * (1 - 0.25 * py_ / 48)
                        g = g * (1 + 0.25 * np.clip((cx - np.arange(x0_, x1_)[None]) / 4, -1, 1))[..., None]
                        img[y0_:y1_, x0_:x1_, :3] = img[y0_:y1_, x0_:x1_, :3] * (1 - a[..., None]) + g * a[..., None]
        bx = vx + amp * np.sin(L * 0.3 + ph)
        p = disc_patch(2.0 * ss, hexrgb('#f4a8dc'), ss=1, hl=0.6, shadow=(1.0 * ss, 1.2 * ss), sh_op=0.45)
        for ox in (-128, 0, 128):
            _paste(img, p, (bx + ox) * ss, L * ss)
    return {'cliff': downsample(img[..., :3], ss)}


JOBS = {'ground': alien_ground, 'water': alien_water, 'rock': alien_rock, 'cliff': alien_cliff}

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for k in (sys.argv[1:] or JOBS):
        for name, img in JOBS[k]().items():
            save_rgb(img, f'{OUT}/{name}.png')
            print(name, img.shape, (np.clip(img, 0, 1).reshape(-1, 3).mean(0) * 255).round(1))

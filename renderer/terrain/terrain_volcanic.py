"""Volcanic Ashlands ground, lava "water" (+ night glow mask), rock (512 seamless) and cliff (128x48).

Ground: charcoal basalt plates under drifts of pale grey ash, cinder grit, hairline cracks (a few
with a faint dull-red glow), small sulphur crusts and the odd obsidian glint. Mid-dark grey, warm.
Water: molten lava, bright orange-yellow channels flowing between darker cooling crust plates;
water-glow.png is its night glow mask (bright where hottest).
Rock: black basalt and obsidian crags with glassy highlights and columnar jointing on the tops.
Cliff: dark basalt columns under an ash cap, a faint warm glow at the foot.

Run from renderer/:  PYTHONPATH=terrain python3 terrain/terrain_volcanic.py [ground water rock cliff]
"""
import os
import sys
import numpy as np
from scipy import ndimage
from tex import *
from terrain_biomes import N, over, leaf_patch, crag_height, cast_shadow, jitter_points, _paste

OUT = 'out/art/biomes/volcanic'
WIND = np.radians(-24)   # ash drifts lie along the prevailing wind
FLOW = np.radians(28)    # lava flows down-right


def warp(f, dx, dy):
    """Sample periodic field f at (x+dx, y+dy) with wrap-around (stays seamless)."""
    n = f.shape[0]
    ys, xs = np.mgrid[0:n, 0:n].astype(float)
    return ndimage.map_coordinates(f, [ys + dy, xs + dx], order=1, mode='grid-wrap')


# ============================================================================ GROUND

def volcanic_ground():
    rng = np.random.default_rng(301)
    # basalt: charcoal plates, each a slightly different tone, broken by hairline cracks
    pts = np.concatenate([jitter_points(6, 6, rng, j=0.45), rng.uniform(0, 1, (40, 2))])
    F1, F2, ID = worley(N, pts)
    edge = (F2 - F1) * N + 2.2 * fbm(N, 3002, 12, 90, beta=1.2)
    tone = rng.uniform(-1, 1, len(pts))[ID]
    z1 = fbm(N, 3001, 3, 48, beta=2.0)
    col = mix(hexrgb('#3e3a37'), hexrgb('#57514c'), smoothstep(-1.5, 1.5, z1 + 0.5 * tone))
    # cinder grit: fine reddish-brown and black scoria crumbs everywhere
    g1 = fbm(N, 3003, 70, 256, beta=0.4)
    g2 = fbm(N, 3004, 70, 256, beta=0.4)
    col = col * (1 + 0.12 * fbm(N, 3005, 90, 256, beta=0.6))[..., None]
    col = over(col, hexrgb('#6a4434'), smoothstep(1.3, 2.1, g1) * 0.55)
    col = over(col, hexrgb('#1e1b1a'), smoothstep(1.4, 2.2, g2) * 0.7)
    # height: plates tilt a little, cracks sink, grit bumps
    tilt_x = rng.uniform(-1, 1, len(pts))[ID]
    tilt_y = rng.uniform(-1, 1, len(pts))[ID]
    ys, xs = np.mgrid[0:N, 0:N]
    H = 0.8 * tone + 2.5 * fbm(N, 3006, 4, 64, beta=2.0) + 0.5 * fbm(N, 3007, 30, 200, beta=1.0)
    H += 0.5 * (smoothstep(1.0, 2.0, g1) + smoothstep(1.0, 2.0, g2))
    crack = 1 - smoothstep(0.25, 1.4, edge)
    H -= 1.6 * crack
    # ash: pale grey drifts lying along the wind, smooth and higher than the basalt
    an = fbm(N, 3010, 2, 24, beta=2.1, aniso=(1.0, 1.5), angle=WIND) + 0.4 * fbm(N, 3011, 8, 64, beta=1.4, aniso=(1.0, 2.5), angle=WIND)
    A = smoothstep(0.25, 1.35, an)
    ripple = fbm(N, 3012, 24, 120, beta=1.0, aniso=(5.0, 1.0), angle=WIND)
    Ha = 4.0 * smoothstep(0.0, 1.6, an) + 0.3 * ripple
    H = H * (1 - A) + Ha * A
    ashc = mix(hexrgb('#6a6560'), hexrgb('#8c8680'), smoothstep(-1.4, 1.4, fbm(N, 3013, 6, 80, beta=1.6)))
    ashc = ashc * (1 + 0.05 * fbm(N, 3014, 100, 256, beta=0.3))[..., None]
    # thin ash dusting over the basalt too (softens the plates)
    dust = smoothstep(-0.8, 0.5, an) * (1 - A)
    col = over(col, hexrgb('#625d58'), dust * 0.4)
    col = over(col, ashc, A)
    # a few cinders lying on the ash
    col = over(col, hexrgb('#2c2826'), smoothstep(2.0, 2.6, g2) * A * 0.7)
    lit = relief(normals_from_height(H * 1.4), 225, 50)
    col = col * (0.66 + 0.36 * lit)[..., None]
    # hairline cracks in the exposed basalt
    hair = (1 - smoothstep(0.15, 0.85, edge)) * (1 - smoothstep(0.3, 0.8, A))
    hair *= smoothstep(-0.9, 0.3, fbm(N, 3020, 3, 24, beta=1.8))
    col = over(col, hexrgb('#161312'), hair * 0.85)
    # a faint dull-red glow deep in some of the cracks
    gsel = smoothstep(0.7, 1.5, fbm(N, 3015, 2, 10, beta=2.0)) * (1 - smoothstep(0.1, 0.5, A))
    gl = (1 - smoothstep(0.0, 0.5, (F2 - F1) * N + 0.6 * fbm(N, 3021, 30, 120, beta=1.0))) * gsel
    halo = blur_wrap(gl, 2.5) * 2.0
    col = over(col, hexrgb('#55302a'), np.clip(halo, 0, 1) * 0.3)
    col = over(col, hexrgb('#a2381a'), gl * 0.6)
    # sulphur crusts: small yellow patches, mostly beside cracks, a few white salts
    sn = fbm(N, 3016, 8, 64, beta=1.6) + 0.5 * fbm(N, 3017, 40, 160, beta=0.8)
    near = blur_wrap(crack, 4.0)
    S = smoothstep(1.7, 2.5, blur_wrap(sn, 1.5) + 1.2 * near) * (1 - A) * smoothstep(0.4, 1.2, fbm(N, 3018, 3, 12, beta=2.0))
    sulc = mix(hexrgb('#9a8a40'), hexrgb('#c4b260'), smoothstep(-1, 1.5, fbm(N, 3019, 60, 256, beta=0.5)))
    sulc = sulc * (0.8 + 0.22 * lit)[..., None]
    col = over(col, sulc, S * 0.85)
    col = over(col, hexrgb('#d8d2b8'), smoothstep(0.6, 1.0, S) * smoothstep(1.2, 2.0, g1) * 0.6)
    img = np.concatenate([col, np.ones((N, N, 1))], -1)
    # obsidian chips: little black glassy flakes with a bright glint
    placed = 0
    while placed < 46:
        x, y = rng.uniform(0, N, 2)
        if A[int(y) % N, int(x) % N] > 0.6 and rng.uniform() < 0.7:
            continue
        L = rng.uniform(3.0, 5.5)
        ang = rng.uniform(0, np.pi * 2)
        p = leaf_patch(L, L * rng.uniform(0.45, 0.7), ang, hexrgb('#1a181c'), hexrgb('#3a3840'), ss=4,
                       shadow=(0.8, 0.9), sh_op=0.35)
        stamp(img, p, x, y)
        q = leaf_patch(L * 0.55, 1.1, ang, hexrgb('#dfe4ea'), hexrgb('#ffffff'), ss=4, shadow=(0, 0), sh_op=0.0)
        q[..., 3] *= rng.uniform(0.75, 1.0)
        stamp(img, q, x - L * 0.12, y - L * 0.16)
        placed += 1
    # pumice and scoria pebbles: a few lighter and rusty lumps with a soft shadow
    for k in range(60):
        x, y = rng.uniform(0, N, 2)
        L = rng.uniform(3, 6)
        c = hexrgb(['#8a8580', '#5c3c30', '#3a3634', '#706a64'][k % 4]) * rng.uniform(0.9, 1.1)
        p = leaf_patch(L, L * rng.uniform(0.6, 0.9), rng.uniform(0, 3), c, c * 0.75, ss=4, shadow=(0.9, 1.0), sh_op=0.4)
        stamp(img, p, x, y)
    return img[..., :3]


# ============================================================================ LAVA

LAVA_STOPS = [(0.00, '#151110'), (0.10, '#2a1d19'), (0.22, '#4a1e12'), (0.34, '#7e2410'), (0.46, '#b83a0e'),
              (0.58, '#e2621a'), (0.70, '#f88c26'), (0.82, '#ffb83c'), (0.92, '#ffdc6a'), (1.00, '#fff3b0')]


def lava_ramp(T):
    T = np.clip(T, 0, 1)
    xs = [s[0] for s in LAVA_STOPS]
    cs = np.array([hexrgb(s[1]) for s in LAVA_STOPS])
    return np.stack([np.interp(T, xs, cs[:, k]) for k in range(3)], -1)


def lava_fields():
    rng = np.random.default_rng(311)
    # flow: streaks drawn out along the flow, warped into eddies
    wx = fbm(N, 3101, 2, 10, beta=2.0)
    wy = fbm(N, 3102, 2, 10, beta=2.0)
    s1 = fbm(N, 3103, 3, 80, beta=1.5, aniso=(1.0, 4.0), angle=FLOW)
    s2 = fbm(N, 3104, 8, 140, beta=1.2, aniso=(1.0, 5.0), angle=FLOW)
    st = warp(0.8 * s1 + 0.2 * s2, 16 * wx, 16 * wy)
    st = zscore(st)
    broad = warp(fbm(N, 3105, 2, 14, beta=2.0, aniso=(1.0, 2.0), angle=FLOW), 10 * wx, 10 * wy)
    molten = 0.62 + 0.11 * st + 0.11 * zscore(broad)
    # crust plates: Voronoi cells (stretched along the flow), shrunk away from their borders,
    # so bright channels run between them
    pts = rng.uniform(0, 1, (46, 2))
    F1, F2, ID = worley(N, pts)
    ewarp = 3.0 * fbm(N, 3106, 8, 60, beta=1.2)
    edge = (F2 - F1) * N + ewarp
    keep = rng.uniform(0, 1, len(pts)) < 0.72
    gap = rng.uniform(5, 13, len(pts))
    plate = keep[ID] * smoothstep(gap[ID], gap[ID] + 4.0, edge)
    # small floating crust rafts in the channels
    pts2 = rng.uniform(0, 1, (160, 2))
    G1, G2, ID2 = worley(N, pts2)
    e2 = (G2 - G1) * N + 1.5 * fbm(N, 3107, 20, 90, beta=1.0)
    keep2 = rng.uniform(0, 1, len(pts2)) < 0.22
    raft = keep2[ID2] * smoothstep(3.0, 5.0, e2) * (1 - plate)
    crust = np.clip(plate + raft * 0.85, 0, 1)
    # cracks across the crust (a finer cell network) glow through
    pts3 = rng.uniform(0, 1, (420, 2))
    H1, H2, _ = worley(N, pts3)
    e3 = (H2 - H1) * N + 1.2 * fbm(N, 3108, 30, 160, beta=1.0)
    cr = 1 - smoothstep(0.2, 1.5, e3)
    cr *= smoothstep(-0.6, 0.6, fbm(N, 3109, 4, 30, beta=1.8))
    # crust temperature: cooler in the middle of a plate, warm near its rim
    inner = smoothstep(gap[ID], gap[ID] + 22, edge)
    Tc = 0.05 + 0.2 * (1 - inner) + 0.04 * fbm(N, 3110, 20, 120, beta=1.0)
    Tc = np.maximum(Tc, cr * (0.55 - 0.2 * inner))
    T = molten * (1 - crust) + Tc * crust
    # the channels are hottest along their middle
    # thin, cooler skin streaks drift on the molten surface (darker red through the ramp)
    skin = smoothstep(0.9, 2.0, warp(fbm(N, 3120, 6, 80, beta=1.5, aniso=(1.0, 4.0), angle=FLOW), 16 * wx, 16 * wy))
    T = T - 0.2 * skin * (1 - crust)
    # narrow gaps between plates (where the crust is splitting) glow hottest
    gapw = blur_wrap(1 - crust, 6.0)
    T = T + 0.2 * (1 - crust) * (1 - smoothstep(0.25, 0.85, gapw))
    # crust surface relief: ropy wrinkles across the flow plus lumps
    rope = fbm(N, 3111, 10, 70, beta=1.4, aniso=(3.0, 1.0), angle=FLOW)
    Hc = crust * (3.0 + 0.5 * rope + 1.8 * fbm(N, 3112, 6, 60, beta=1.6) + 0.25 * fbm(N, 3113, 60, 256, beta=0.6)) \
        - 1.5 * cr * crust
    Hm = (1 - crust) * 0.35 * st
    return np.clip(T, 0, 1), Hc + Hm, crust


def volcanic_lava():
    T, H, crust = lava_fields()
    col = lava_ramp(T)
    # lit relief on the crust only (molten lava is self-lit)
    lit = relief(normals_from_height(H * 1.6), 225, 50)
    crust_col = col * (0.6 + 0.5 * lit)[..., None]
    col = col * (1 - crust[..., None]) + crust_col * crust[..., None]
    # dim grey sheen of cooled glass on the crust tops
    col = over(col, hexrgb('#8a8088'), spec(normals_from_height(H * 1.6), 24, 225, 40) * smoothstep(0.7, 1.0, crust) * 0.25)
    return col


def volcanic_lava_glow():
    T, H, crust = lava_fields()
    g = smoothstep(0.28, 0.95, T) ** 1.2
    g = 0.7 * g + 0.3 * np.clip(blur_wrap(g, 5.0) * 1.3, 0, 1)
    return np.repeat(np.clip(g, 0, 1)[..., None], 3, -1)


# ============================================================================ ROCK

def volcanic_rock():
    H, edge, r = crag_height(330, n_blocks=26, amp=26)
    Nn = normals_from_height(H)
    shc = cast_shadow(H, 26, 42)
    shade = 0.22 + 1.25 * lambert(Nn, 225, 45) * (0.3 + 0.7 * shc)
    base = mix(hexrgb('#2c292a'), hexrgb('#46413f'), smoothstep(-1.2, 1.4, fbm(N, 332, 3, 80, beta=1.8)))
    base = base * (1 + 0.1 * fbm(N, 333, 60, 256, beta=0.8))[..., None]
    # vesicular basalt: fine dark pits
    base = over(base, hexrgb('#141214'), smoothstep(1.5, 2.2, fbm(N, 334, 110, 256, beta=0.2)) * 0.6)
    col = base * shade[..., None]
    # columnar jointing on the flatter tops: a small hexagonal joint net
    rng = np.random.default_rng(335)
    hp = jitter_points(22, 22, rng, j=0.18)
    J1, J2, JID = worley(N, hp)
    joint = 1 - smoothstep(0.4, 1.4, (J2 - J1) * N)
    flat = smoothstep(0.86, 0.96, Nn[..., 2]) * smoothstep(-0.2, 0.6, zscore(blur_wrap(H, 4)))
    ctone = rng.uniform(0.85, 1.15, len(hp))[JID]
    col = col * (1 + (ctone - 1) * flat)[..., None]
    col = over(col, hexrgb('#0c0b0c'), joint * flat * 0.8)
    # obsidian: glassy patches with sharp highlights
    glass = smoothstep(0.4, 1.2, fbm(N, 336, 4, 40, beta=1.8))
    Ns = normals_from_height(blur_wrap(H, 1.6))
    sp = spec(Ns, 50, 225, 45) * shc
    col = over(col, hexrgb('#0e0d10'), glass * 0.45)
    col = over(col, hexrgb('#e4eaf0'), sp * (0.35 + 0.65 * glass))
    col = over(col, hexrgb('#9aa0a8'), spec(Nn, 10, 225, 45) * shc * 0.18)
    col = over(col, hexrgb('#080708'), (1 - smoothstep(0.5, 2.5, edge)) * 0.85)
    # ash settled in the hollows and on ledges
    low = 1 - smoothstep(-1.3, -0.4, zscore(blur_wrap(H, 6)))
    an = fbm(N, 337, 6, 80, beta=1.4)
    ash = np.clip(low * smoothstep(-0.4, 0.6, an) + smoothstep(0.985, 0.998, Nn[..., 2]) * smoothstep(0.6, 1.4, an) * 0.7, 0, 1)
    Na = normals_from_height(blur_wrap(H, 2.0) * 0.6 + 0.6 * fbm(N, 338, 30, 200, beta=1.0))
    ashc = hexrgb('#7c7670') * (0.45 + 0.6 * lambert(Na, 225, 45) * (0.4 + 0.6 * shc))[..., None]
    col = over(col, ashc, smoothstep(0.25, 0.8, ash) * 0.75)
    return col


# ============================================================================ CLIFF (128 x 48, tiles left-right)

def volcanic_cliff():
    ss = 4
    Wc, Hc = 128 * ss, 48 * ss
    rng = np.random.default_rng(341)
    ys, xs = np.mgrid[0:Hc, 0:Wc] / ss
    yn = ys / 48.0

    def pfbm(seed, f_lo, f_hi, beta=2.0, aniso=(1, 1)):
        return fbm(Wc, seed, f_lo, f_hi, beta=beta, aniso=aniso)[:Hc]
    # basalt columns: vertical joints at fixed x (periodic), convex faces lit from the left
    jx = np.cumsum(rng.uniform(12, 22, 8))
    jx = np.concatenate([[0], jx / jx[-1] * 128])
    k = np.clip(np.searchsorted(jx, xs % 128, side='right') - 1, 0, len(jx) - 2)
    t = (xs % 128 - jx[k]) / (jx[k + 1] - jx[k])
    face = 0.5 + 0.5 * np.cos((t - 0.32) * np.pi * 0.95)
    joint = 1 - smoothstep(0.0, 0.08, np.minimum(t, 1 - t) + pfbm(3401, 2, 20) * 0.01)
    base = mix(hexrgb('#2a2729'), hexrgb('#423e40'), smoothstep(-1, 1, pfbm(3402, 2, 60, 1.8)))
    base = base * rng.uniform(0.85, 1.12, len(jx))[k][..., None]
    col = base * face[..., None]
    # column tops step down unevenly: horizontal fractures in each column
    fr = np.zeros_like(xs)
    for c in range(len(jx) - 1):
        for yy in rng.uniform(14, 44, 2):
            m = (k == c) & (np.abs(ys - yy - 0.8 * np.sin(xs * 0.4 + c)) < 0.55)
            fr[m] = 1
    col = over(col, hexrgb('#0e0d0e'), np.maximum(joint, fr) * 0.88)
    col = col * (1 + 0.09 * pfbm(3403, 40, 200, 0.8))[..., None]
    # glassy glints down the column edges
    gl = smoothstep(0.1, 0.0, np.abs(t - 0.12)) * smoothstep(0.6, 1.6, pfbm(3404, 4, 40, 1.4, aniso=(1, 0.2)))
    col = over(col, hexrgb('#a8b0b8'), gl * 0.35)
    # darker toward the bottom
    col = col * (1 - 0.55 * smoothstep(0.35, 1.0, yn))[..., None]
    # ash cap along the top with a ragged, slumping edge, and ash caught in the joints
    mt = 6 + 2.5 * pfbm(3405, 3, 24) + 5 * smoothstep(0.6, 1.6, pfbm(3406, 6, 30, 1.5))
    ashc = mix(hexrgb('#9a948e'), hexrgb('#6e6964'), smoothstep(0, 1, ys / np.maximum(mt, 1)))
    ashc = ashc * (1 + 0.06 * pfbm(3407, 60, 240, 0.4))[..., None]
    am = 1 - smoothstep(mt - 1, mt + 0.6, ys)
    am = np.maximum(am, joint * smoothstep(0.2, 1.0, pfbm(3408, 2, 10)) * (1 - smoothstep(8, 26, ys)) * 0.8)
    under = (1 - smoothstep(mt + 0.3, mt + 3.0, ys)) * smoothstep(mt - 0.6, mt + 0.3, ys)
    col = over(col, hexrgb('#0c0b0b'), under * 0.5)
    col = over(col, ashc, am)
    # ash streaks washed down the face
    streak = smoothstep(1.0, 2.0, pfbm(3409, 4, 40, 1.6, aniso=(1, 0.15))) * (1 - smoothstep(0.3, 0.9, yn))
    col = over(col, hexrgb('#5a5652'), streak * 0.35)
    # a faint warm glow at the foot, as from lava below
    glow = smoothstep(0.72, 1.0, yn) * (0.75 + 0.25 * pfbm(3410, 2, 16))
    col = col + hexrgb('#4a1c0c') * (glow * 0.45)[..., None]
    col = over(col, hexrgb('#9a3a12'), smoothstep(0.94, 1.0, yn) * joint * 0.3)
    return downsample(col, ss)


JOBS = {'ground': volcanic_ground, 'water': volcanic_lava, 'water-glow': volcanic_lava_glow,
        'rock': volcanic_rock, 'cliff': volcanic_cliff}

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for k in (sys.argv[1:] or JOBS):
        img = JOBS[k]()
        save_rgb(img, f'{OUT}/{k}.png')
        print(k, img.shape, 'mean RGB', (np.clip(img, 0, 1).reshape(-1, 3).mean(0) * 255).round(1))

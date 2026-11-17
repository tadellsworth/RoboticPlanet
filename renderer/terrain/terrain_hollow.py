"""The Hollow (biome key `hollow`): the Murmur's cavern lair under the Bloom (LORE.md, The Hollow). Always night.

Written like the other biomes' terrain (512 seamless, one image per 4 x 4 map tiles), and lit the same way: these are
the tiles as a work lamp would show them, and the game's night grade (time-of-day.json) darkens them to the Hollow's
violet dark. What carries light of its own goes in the -glow maps, added at night over the graded ground.

  ground       cave floor: packed grey-violet silt and worn stone flags, Crystal grit, patches of the Bloom's spongy
               moss with its root-veins threading between them. (The tunnel ridges are not baked in: a 4 x 4 tile
               repeat would show. They are drawn over the ground along the tunnel network, see tunnels/ridges.js.)
  ground-glow  the root-veins and the grit, as they glow at night
  water        a black lake: near-black water with slow, oily swell
  water-glow   the Bloom on the cavern roof, reflected: faint lilac points and smears on the black water
  rock         the cave wall mass, rising into the dark: smooth black stone, Bloom moss in its cracks
  cliff        128 x 48: the stone face below a higher floor (a ledge), moss and roots over its lip
  wall         128 x 64: the cave wall where the rock meets the floor (drawn along a rock mass's south edge): wet
               stone fading up into black, the ceiling lost in the dark; root curtains hanging down it

usage: python3 terrain/terrain_hollow.py [ground water rock cliff wall]   (run from renderer/; writes out/art/biomes/hollow)
"""
import os
import sys
import numpy as np
from tex import *
from terrain_biomes import N, over, crag_height, cast_shadow
from terrain_alien import jworley, disc_patch, contour_lines, glow_add, advect

OUT = 'out/art/biomes/hollow'

VIOL = hexrgb('#a04cff')       # the Bloom's root-veins at night (the Burrow's veins are #8a3cff..#9a4cff)
LILAC = hexrgb('#c8a8ff')      # Ring Crystal grit, pale lilac
PULSE = hexrgb('#d8b8ff')


def vein_net(seed, cells=5, w=0.7, amp=14):
    """A bent, branching network of root-veins (Worley cell edges, warped), with capillaries off it.
    Returns (main veins 0..1, capillaries 0..1)."""
    wv = (amp * fbm(N, seed, 2, 20, beta=1.5), amp * fbm(N, seed + 1, 2, 20, beta=1.5))
    G1, G2, _ = jworley(N, cells, seed + 2, jit=0.9, warp=wv)
    d1 = (G2 - G1) * (N / cells) * 0.5
    ww = w * (0.6 + 0.4 * smoothstep(-1, 1, fbm(N, seed + 3, 3, 20, beta=1.5)))
    v1 = smoothstep(ww + 0.5, ww - 0.4, d1) * smoothstep(-0.7, 0.1, fbm(N, seed + 4, 3, 16, beta=1.6))
    wv2 = (6 * fbm(N, seed + 5, 4, 40, beta=1.5), 6 * fbm(N, seed + 6, 4, 40, beta=1.5))
    H1, H2, _ = jworley(N, cells * 3, seed + 7, jit=0.9, warp=wv2)
    d2 = (H2 - H1) * (N / (cells * 3)) * 0.5
    near = smoothstep(0.01, 0.1, blur_wrap(v1, 9))
    v2 = smoothstep(0.7, 0.1, d2) * near * smoothstep(-0.2, 0.6, fbm(N, seed + 8, 6, 40, beta=1.4))
    return v1, v2


# ============================================================================ GROUND

def hollow_ground():
    rng = np.random.default_rng(901)
    broad = fbm(N, 9001, 3, 40, beta=2.0)
    # packed silt, grey with a cold violet cast (lit like the other biomes; the night grade takes it down)
    col = mix(hexrgb('#3e3946'), hexrgb('#5e5866'), smoothstep(-1.5, 1.5, broad))
    col = over(col, hexrgb('#4a3e58'), smoothstep(0.2, 1.4, fbm(N, 9002, 3, 24, beta=2.0)) * 0.4)
    # worn stone flags: big flat plates the silt has drifted round, their edges rounded off
    F1, F2, ID = jworley(N, 9, 9003, jit=0.75, warp=(7 * fbm(N, 9004, 2, 14, beta=1.6), 7 * fbm(N, 9005, 2, 14, beta=1.6)))
    plate = smoothstep(0.035, 0.11, F2 - F1) * (np.random.default_rng(9006).uniform(0, 1, 81)[ID] < 0.55)
    plate *= smoothstep(-0.6, 0.3, fbm(N, 9007, 3, 20, beta=1.8))
    ptone = np.random.default_rng(9008).uniform(-1, 1, 81)[ID]
    pcol = mix(hexrgb('#4c4852'), hexrgb('#6a6470'), 0.5 + 0.5 * ptone)
    pcol = pcol * (1 + 0.07 * fbm(N, 9009, 40, 200, beta=1.0))[..., None]
    col = over(col, pcol, plate * 0.85)
    # silt ripples in the low ground, laid by water long gone
    rip = np.sin((np.mgrid[0:N, 0:N][1] * 0.35 + np.mgrid[0:N, 0:N][0] * 0.12) * (2 * np.pi / 16) * 4 + 6 * fbm(N, 9010, 2, 10, beta=2.0))
    rip = (rip * 0.5 + 0.5) * (1 - plate) * smoothstep(0.0, 1.0, fbm(N, 9011, 2, 12, beta=2.0))
    H = 1.2 * plate + 0.35 * rip + 0.5 * broad + 0.25 * fbm(N, 9012, 30, 200, beta=1.2)
    H -= 0.9 * (1 - smoothstep(0.0, 0.05, F2 - F1)) * (plate > 0.05)
    lit = relief(normals_from_height(H * 2.2), 225, 50)
    col = col * (0.74 + 0.3 * lit)[..., None]
    # cracks between the flags
    crack = (1 - smoothstep(0.0, 0.028, F2 - F1)) * smoothstep(-0.4, 0.4, fbm(N, 9013, 3, 30, beta=1.5))
    col = over(col, hexrgb('#1a1620'), crack * 0.7)

    # the Bloom: spongy violet moss in patches, thickest along the veins and in the cracks
    v1, v2 = vein_net(9020, cells=5, w=0.75)
    near = blur_wrap(v1, 14)
    mm = fbm(N, 9030, 3, 24, beta=2.0) + 2.2 * zscore(near) * 0.35 + 0.4 * crack
    M = smoothstep(0.45, 1.6, mm) * (0.55 + 0.45 * smoothstep(-0.5, 0.8, fbm(N, 9033, 10, 60, beta=1.2)))
    Fm1, Fm2, IDm = jworley(N, 110, 9031, jit=0.9)
    sponge = 1 - smoothstep(0.0, 0.72, Fm1)
    groove = 1 - smoothstep(0.0, 0.2, Fm2 - Fm1)
    mcol = mix(hexrgb('#3a3250'), hexrgb('#5c4c80'), sponge * 0.8 + 0.2 * smoothstep(-1, 1.5, fbm(N, 9032, 20, 120, beta=1.0)))
    mcol = over(mcol, hexrgb('#24183a'), groove * 0.35)
    Hm = M * 2.0 + M * (0.6 * sponge - 0.4 * groove)
    mcol = mcol * (0.6 + 0.45 * relief(normals_from_height(Hm * 2.0), 225, 50))[..., None]
    col = over(col, hexrgb('#221a2c'), blur_wrap(M, 2.0) * 0.35)                    # damp shadow round the moss
    col = over(col, mcol, smoothstep(0.05, 0.8, M) * 0.85)

    # root-veins: dark, fleshy by lamp light (only their glow shows at night)
    vein = np.clip(v1 + 0.55 * v2, 0, 1)
    col = over(col, hexrgb('#120c18'), np.clip(blur_wrap(vein, 1.3) * 1.3 - vein, 0, 1) * 0.5)
    col = over(col, mix(hexrgb('#4a2a62'), hexrgb('#8a5ab8'), v1), vein * 0.85)
    glow = np.zeros((N, N, 3))
    glow_add(glow, v1, VIOL, 0.75)
    glow_add(glow, v2, hexrgb('#8c3cff'), 0.45)
    glow_add(glow, blur_wrap(vein, 3.0), VIOL, 0.6)

    img = np.concatenate([col, np.ones((N, N, 1))], -1)
    gimg = np.concatenate([glow, np.ones((N, N, 1))], -1)
    # Crystal grit and pebbles (the grit glints lilac at night, a faint star field on the floor)
    for k in range(700):
        x, y = rng.uniform(0, N, 2)
        if rng.uniform() < 0.72:
            r = rng.uniform(0.6, 1.6)
            stamp(img, disc_patch(r, hexrgb(['#6c6672', '#7a7480', '#57525e'][k % 3]) * rng.uniform(0.85, 1.1), hl=0.35, sh_op=0.35), x, y)
        else:
            r = rng.uniform(0.45, 0.9)
            stamp(img, disc_patch(r, LILAC * rng.uniform(0.8, 1.0), hl=0.7, sh_op=0.2, shadow=(0.3, 0.4)), x, y)
            g = disc_patch(r * 1.3, LILAC * rng.uniform(0.25, 0.5), shadow=(0, 0), sh_op=0.0)
            g[..., :3] *= g[..., 3:4]
            stamp(gimg, np.concatenate([g[..., :3], np.zeros(g.shape[:2] + (1,))], -1), x, y, mode='add')
    # a few spore beads on the moss, pale and faintly lit
    for k in range(160):
        x, y = rng.uniform(0, N, 2)
        if M[int(y) % N, int(x) % N] < 0.4:
            continue
        r = rng.uniform(0.7, 1.3)
        stamp(img, disc_patch(r, hexrgb('#b89ce0'), hl=0.5, sh_op=0.3), x, y)
        g = disc_patch(r * 1.2, hexrgb('#b070ff') * 0.5, shadow=(0, 0), sh_op=0.0)
        g[..., :3] *= g[..., 3:4]
        stamp(gimg, np.concatenate([g[..., :3], np.zeros(g.shape[:2] + (1,))], -1), x, y, mode='add')
    glow = gimg[..., :3]
    glow = glow + 0.5 * np.stack([blur_wrap(glow[..., c], 2.0) for c in range(3)], -1)
    return {'ground': img[..., :3], 'ground-glow': np.clip(glow * 0.3, 0, 1)}


# ============================================================================ WATER

def hollow_water():
    rng = np.random.default_rng(902)
    psi = fbm(N, 9101, 1.5, 5, beta=2.4)
    base = fbm(N, 9102, 2, 14, beta=1.8, aniso=(1.0, 2.2), angle=0.3)
    marb = zscore(advect(base, psi, steps=30, dist=90))
    # black water: blue-black with a violet cast, the slow swell barely catching the light
    col = mix(hexrgb('#06070c'), hexrgb('#141626'), smoothstep(-1.8, 1.8, marb))
    h = fbm(N, 9103, 2, 20, beta=2.4) + 0.02 * fbm(N, 9104, 30, 160, beta=1.5)
    Hh = 0.5 + 0.1 * zscore(h)
    col = col * (0.8 + 0.25 * lambert(normals_from_height(Hh * 12.0), 225, 55))[..., None]
    sheen = blur_wrap(np.clip((fbm(N, 9105, 2, 16, beta=2.4, aniso=(1.0, 2.5), angle=0.5) - 0.6) * 0.5, 0, 1), 3.0)
    col = over(col, hexrgb('#3a3c5a'), sheen * 0.35)
    col = over(col, hexrgb('#9a98c0'), spec(normals_from_height(Hh * 9.0), 40, 225, 38) * 0.22)
    # the reflection of the Bloom on the roof far above: soft lilac points and smears, wobbling with the swell
    glow = np.zeros((N, N, 3))
    img = np.concatenate([col, np.ones((N, N, 1))], -1)
    gimg = np.concatenate([glow, np.ones((N, N, 1))], -1)
    wob = 2.0 * fbm(N, 9106, 4, 30, beta=1.6)
    for k in range(55):
        x, y = rng.uniform(0, N, 2)
        r = rng.uniform(1.0, 2.0) * (1.8 if rng.uniform() < 0.15 else 1)
        c = [VIOL, LILAC, hexrgb('#7a54ff')][k % 3] * rng.uniform(0.3, 0.75)
        for s in range(3):                                           # a reflection breaks into a short vertical smear
            g = disc_patch(r * (1 - 0.2 * s), c * (1 - 0.3 * s), shadow=(0, 0), sh_op=0.0)
            g[..., :3] *= g[..., 3:4]
            stamp(gimg, np.concatenate([g[..., :3], np.zeros(g.shape[:2] + (1,))], -1), x + wob[int(y) % N, int(x) % N], y + s * r * 1.8, mode='add')
            stamp(img, np.concatenate([np.ones(g.shape[:2] + (3,)) * hexrgb('#5a4e8a'), g[..., 3:4] * 0.25], -1), x, y + s * r * 1.8)
    # a few faint vein reflections, stretched along the swell
    fil = contour_lines(marb - 1.2, 1.0) * smoothstep(0.2, 1.0, fbm(N, 9107, 2, 10, beta=1.8))
    glow_add(gimg[..., :3], fil, hexrgb('#6a3cc8'), 0.4)
    col = over(img[..., :3], hexrgb('#2a2448'), fil * 0.4)
    glow = gimg[..., :3]
    glow = glow + 0.6 * np.stack([blur_wrap(glow[..., c], 2.5) for c in range(3)], -1)
    return {'water': col, 'water-glow': np.clip(glow * 0.9, 0, 1)}


# ============================================================================ ROCK

def hollow_rock():
    H, edge, r = crag_height(931, n_blocks=20, amp=20)
    H = blur_wrap(H, 1.6)                                    # worn smooth: the Hollow's stone is rounded, not sharp
    Nn = normals_from_height(H * 0.9)
    shc = cast_shadow(H, 26, 42)
    shade = 0.32 + 0.9 * lambert(Nn, 225, 45) * (0.4 + 0.6 * shc)
    base = mix(hexrgb('#1c1a22'), hexrgb('#2e2b36'), smoothstep(-1.2, 1.4, fbm(N, 9302, 3, 80, beta=1.8)))
    base = base * (1 + 0.06 * fbm(N, 9303, 60, 256, beta=0.8))[..., None]
    v1 = contour_lines(fbm(N, 9305, 3, 30, beta=1.6), 1.0) * smoothstep(-0.2, 0.8, fbm(N, 9304, 2, 14, beta=1.6))
    base = over(base, hexrgb('#5a4a78'), v1 * 0.55)                        # pale seams of Crystal in the stone
    col = base * shade[..., None]
    col = over(col, hexrgb('#9a92b4'), spec(Nn, 30, 225, 45) * shc * 0.25)   # damp sheen on the worn tops
    col = over(col, hexrgb('#06050a'), (1 - smoothstep(0.5, 3.0, edge)) * 0.85)
    low = 1 - smoothstep(-1.2, 0.0, zscore(blur_wrap(H, 3)))
    mn = fbm(N, 9306, 8, 120, beta=1.3)
    moss = np.clip(np.maximum((1 - smoothstep(1.5, 5, edge)) * smoothstep(0.2, 1.0, mn), low * smoothstep(0.4, 1.2, mn)), 0, 1)
    F1, F2, _ = jworley(N, 90, 9307)
    sponge = 1 - smoothstep(0, 0.7, F1)
    mcol = mix(hexrgb('#2e2246'), hexrgb('#523a7e'), sponge)
    mcol = mcol * (0.55 + 0.45 * lambert(normals_from_height(H * 0.4 + 2 * sponge), 225, 50) * (0.5 + 0.5 * shc))[..., None]
    col = over(col, mcol, smoothstep(0.35, 0.75, moss) * 0.8)
    return {'rock': col}


# ============================================================================ CLIFF (128 x 48) and WALL (128 x 64)

def _strip(Hc, ss, seed):
    Wc = 128 * ss
    ys, xs = np.mgrid[0:Hc, 0:Wc] / ss

    def pfbm(sd, f_lo, f_hi, beta=2.0, aniso=(1, 1)):
        return fbm(Wc, sd, f_lo, f_hi, beta=beta, aniso=aniso)[:Hc]
    return Wc, ys, xs, pfbm


def _hang(img, ss, rng, n, top, length, col0, col1, width=3.4, bulb=None):
    """Roots hanging down a face: n strands from y=top, swaying, tapering; optional glowing bulb tips."""
    Hc, Wc = img.shape[:2]
    for v in range(n):
        vx = rng.uniform(0, 128)
        L = rng.uniform(*length)
        amp, ph = rng.uniform(0.6, 1.8), rng.uniform(0, 6)
        for py_ in np.linspace(top, top + L, 160):
            px_ = vx + amp * np.sin(py_ * 0.28 + ph)
            tt = (py_ - top) / L
            for ox in (-128, 0, 128):
                cx, cy = (px_ + ox) * ss, py_ * ss
                if not (-8 <= cx < Wc + 8 and 0 <= cy < Hc):
                    continue
                x0, x1 = int(max(cx - 8, 0)), int(min(cx + 8, Wc))
                y0, y1 = int(max(cy - 8, 0)), int(min(cy + 8, Hc))
                d = np.hypot(np.arange(x0, x1)[None] - cx, np.arange(y0, y1)[:, None] - cy)
                a = np.clip((width - 1.8 * tt) * ss / 4 - d, 0, 1)
                g = mix(hexrgb(col0), hexrgb(col1), smoothstep(0.3, 1.0, tt))
                g = g * (1 + 0.3 * np.clip((cx - np.arange(x0, x1)[None]) / 4, -1, 1))[..., None]
                img[y0:y1, x0:x1, :3] = img[y0:y1, x0:x1, :3] * (1 - a[..., None]) + g * a[..., None]
        if bulb is not None:
            bx = vx + amp * np.sin((top + L) * 0.28 + ph)
            p = disc_patch(1.3 * ss, hexrgb(bulb), ss=1, hl=0.6, shadow=(0.8 * ss, 1.0 * ss), sh_op=0.4)
            for ox in (-128, 0, 128):
                cx, cy = int(round((bx + ox) * ss)), int(round((top + L) * ss))
                h, w = p.shape[:2]
                xa, ya = max(0, cx - w // 2), max(0, cy - h // 2)
                xb, yb = min(Wc, cx - w // 2 + w), min(Hc, cy - h // 2 + h)
                if xa < xb and ya < yb:
                    sub = p[ya - (cy - h // 2):yb - (cy - h // 2), xa - (cx - w // 2):xb - (cx - w // 2)]
                    img[ya:yb, xa:xb, :3] = img[ya:yb, xa:xb, :3] * (1 - sub[..., 3:4]) + sub[..., :3] * sub[..., 3:4]


def hollow_cliff():
    from terrain_alien import layered_face
    ss = 4
    Hc = 48 * ss
    Wc, ys, xs, pfbm = _strip(Hc, ss, 9500)
    rng = np.random.default_rng(950)
    col, w, bi, t, hard = layered_face(Wc, Hc, ss, rng, 9511, ['#34303c', '#3e3946', '#2a2730', '#46404e', '#302c36', '#3a3542', '#4c4656'],
                                       joint_col='#0c0a10')
    seam = np.exp(-(t / 0.07) ** 2) * (rng.uniform(0, 1, 40)[bi] < 0.3) * smoothstep(-0.2, 0.8, pfbm(9514, 3, 20, 1.5))
    col = over(col, hexrgb('#8a62c8'), seam * 0.5)                   # Crystal seams between the beds
    col = col * (1 - 0.6 * smoothstep(0.25, 1.0, ys / 48))[..., None]
    # the Bloom over the lip: a cap of spongy moss with a ragged edge
    mt = 7 + 2.0 * pfbm(9516, 3, 24) + 5 * smoothstep(0.6, 1.6, pfbm(9517, 6, 30, 1.5))
    from terrain_alien import jworley as jw
    F1, F2, _ = jw(Wc, 96, 9518)
    F1, F2 = F1[:Hc], F2[:Hc]
    sponge = 1 - smoothstep(0, 0.7, F1)
    mossc = mix(hexrgb('#34265a'), hexrgb('#5e4494'), sponge * 0.75)
    mossc = mossc * (1 - 0.5 * smoothstep(0.3, 1, ys / np.maximum(mt, 1)))[..., None]
    mossm = 1 - smoothstep(mt - 1, mt + 0.6, ys)
    col = over(col, hexrgb('#0c0812'), (1 - smoothstep(mt, mt + 3, ys)) * smoothstep(mt - 0.5, mt + 0.3, ys) * 0.6)
    col = over(col, mossc, mossm)
    img = np.concatenate([col, np.ones((Hc, Wc, 1))], -1)
    _hang(img, ss, rng, 6, 6, (10, 30), '#3a2448', '#7a4aa0', bulb='#c49af0')
    return {'cliff': downsample(img[..., :3], ss)}


def hollow_wall():
    """The cave wall over a rock mass's south edge: its foot meets the floor at the bottom of the strip; going up it
    darkens into the black of the rock mass (and the ceiling beyond it)."""
    from terrain_alien import layered_face
    ss = 4
    Hc = 64 * ss
    Wc, ys, xs, pfbm = _strip(Hc, ss, 9600)
    rng = np.random.default_rng(960)
    col, w, bi, t, hard = layered_face(Wc, Hc, ss, rng, 9611, ['#2e2a36', '#38333f', '#26232c', '#403a48', '#2c2832', '#36313e'],
                                       joint_col='#08070c', warp_amp=2.4)
    # worn smooth and running wet: vertical flow streaks, a sheen on the bulges
    streak = smoothstep(0.6, 1.8, fbm(Wc, 9612, 1, 40, beta=1.2, aniso=(1, 12))[:Hc])
    col = over(col, hexrgb('#4e4a62'), streak * 0.3)
    yn = ys / 64
    # up into the dark: the top of the face is black, the foot catches the light from the floor
    col = col * (0.12 + 0.95 * smoothstep(0.05, 0.85, yn))[..., None]
    seam = np.exp(-(t / 0.07) ** 2) * (rng.uniform(0, 1, 60)[bi] < 0.25) * smoothstep(0.0, 0.9, pfbm(9614, 3, 20, 1.5))
    col = over(col, hexrgb('#7a52b8'), seam * 0.45 * smoothstep(0.2, 0.8, yn))
    # a talus of fallen grit and moss at the foot
    foot = 54 + 3 * pfbm(9615, 3, 30)
    fm = smoothstep(foot - 1.5, foot + 1.5, ys)
    F1, F2, _ = jworley(Wc, 128, 9616)
    F1 = F1[:Hc]
    talus = mix(hexrgb('#2e2a34'), hexrgb('#433c50'), 1 - smoothstep(0, 0.7, F1))
    col = over(col, talus, fm)
    col = over(col, hexrgb('#0a080e'), np.exp(-((ys - foot + 1.5) / 1.2) ** 2) * 0.5)
    img = np.concatenate([col, np.ones((Hc, Wc, 1))], -1)
    _hang(img, ss, rng, 5, 0, (26, 50), '#140c1c', '#4a2e66', width=4.2)    # root curtains out of the dark
    return {'wall': downsample(img[..., :3], ss)}


JOBS = {'ground': hollow_ground, 'water': hollow_water, 'rock': hollow_rock, 'cliff': hollow_cliff, 'wall': hollow_wall}

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for k in (sys.argv[1:] or JOBS):
        for name, img in JOBS[k]().items():
            save_rgb(img, f'{OUT}/{name}.png')
            print(name, img.shape, (np.clip(img, 0, 1).reshape(-1, 3).mean(0) * 255).round(1))

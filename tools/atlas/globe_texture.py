# Ithaca I's surface for the Contingency globe (and the menu planet): the equirectangular albedo with its relief baked in,
# a land mask (for the sea's glint) and a cloud layer, from the atlas's own fields (globe_planet.py).
# Usage: python3 tools/atlas/globe_texture.py [W]   (W 4096 by default; ~15 min on 4 cores)
# Writes art/globe/ithaca-4096.webp and ithaca-2048.webp (colour; alpha the land mask: 255 land, 224 sea),
# art/globe/ithaca-clouds.webp (1024 x 512, the clouds' cover as grey) and recolours art/lore/ithaca-map.webp (the menu
# planet's face, 512 x 256) from the same picture, keeping its alpha (the colonies' night lights: tools/atlas/atlas.py
# makes it first). ART_GUIDE.md: The Contingency globe.
import sys, os, numpy as np, multiprocessing as mp
from scipy import ndimage as nd
import globe_planet as P
from globe_planet import fbm, ridged, vnoise

HERE = os.path.dirname(os.path.abspath(__file__))
W = int(sys.argv[1]) if len(sys.argv) > 1 else 4096
H = W // 2
CR = P.craters()
CRV = np.array([P.vec(lo, la) for lo, la, r in CR]); CRR = np.array([r for *_, r in CR])

def sstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)

def C(*c): return np.array(c, np.float32) / 255.0

# region palettes: (low, high, accent)  -- satellite colours, LORE.md's character
PAL = {
 'rust':   (C(150, 76, 52), C(196, 124, 86), C(116, 60, 44)),
 'green':  (C(30, 58, 28), C(70, 98, 44), C(46, 76, 34)),
 'ember':  (C(112, 56, 28), C(170, 104, 42), C(60, 60, 30)),
 'grass':  (C(120, 116, 70), C(180, 160, 104), C(84, 96, 52)),
 'black':  (C(34, 46, 30), C(64, 72, 44), C(22, 40, 38)),
 'polar':  (C(220, 228, 236), C(240, 244, 248), C(200, 214, 228)),
 'cinder': (C(30, 28, 28), C(70, 66, 63), C(84, 44, 32)),
 'steam':  (C(134, 118, 88), C(184, 166, 122), C(160, 104, 56)),
 'shoals': (C(52, 96, 44), C(210, 196, 150), C(90, 130, 60)),
 'bloom':  (C(60, 44, 76), C(104, 76, 128), C(140, 70, 140)),
}
RIX = {r: i for i, r in enumerate(P.REGIONS)}

def chunk(args):
    j0, j1 = args
    lon = np.linspace(-180, 180, W, endpoint=False) + 180 / W
    lat = np.linspace(90, -90, H, endpoint=False)[j0:j1] - 90 / H
    LO, LA = np.meshgrid(lon, lat)
    X, Y, Z = P.xyz(LO, LA)
    F = P.fields(X, Y, Z, LA)
    S, g, tid = F['S'], F['g'], F['tid']
    # --- region weights, softly blended with ragged interfingering
    ws = []
    best = F['s1']
    for r in P.REGIONS:
        if r == 'polar': ws.append(np.full_like(best, -9.0)); continue
        ids = [i for i, t in enumerate(P.T) if t[1] == r]
        sr = S[ids].max(0) + 1.8 * (fbm(X, Y, Z, 5, 300 + 10 * RIX[r], 4) - 0.5) + 0.8 * (fbm(X, Y, Z, 24, 305 + 10 * RIX[r], 5, 0.6) - 0.5)
        ws.append(np.where(S[ids].max(0) < best - 0.22, -9.0, sr))
    ws = np.stack(ws); ws = np.exp((ws - ws.max(0)) / 0.02); ws /= ws.sum(0)
    n1 = fbm(X, Y, Z, 6, 500, 6); n2 = fbm(X, Y, Z, 24, 520, 5); n3 = fbm(X, Y, Z, 90, 540, 3)
    col = np.zeros(X.shape + (3,), np.float32)
    for r in P.REGIONS:
        w = ws[RIX[r]]
        if r == 'polar' or w.max() < 1e-4: continue
        lo, hi, ac = PAL[r]
        t = np.clip(0.5 + 1.6 * (n1 - 0.5) + 0.9 * (n2 - 0.5) + 0.5 * (n3 - 0.5), 0, 1)
        c = lo + (hi - lo) * t[..., None]
        a = sstep(0.5, 0.7, fbm(X, Y, Z, 11, 560 + RIX[r], 5))
        if r == 'rust':
            # dune seas: long parallel ridges, bent by the wind
            d = X * 0.3 + Y * 0.8 + Z * 0.52
            dune = 0.5 + 0.5 * np.sin(d * 700 + 40 * fbm(X, Y, Z, 9, 600, 4))
            sea = sstep(0.45, 0.6, fbm(X, Y, Z, 4, 610, 4))
            c = c * (1 + 0.10 * sea[..., None] * (dune[..., None] - 0.5)) + sea[..., None] * (C(220, 140, 92) - c) * 0.25
            c = c + (ac - c) * (0.5 * a)[..., None]
            big = fbm(X, Y, Z, 3.5, 615, 5)
            c = c + (C(206, 160, 116) - c) * (0.45 * sstep(0.55, 0.72, big))[..., None]   # pale sand seas
            c = c + (C(84, 46, 36) - c) * (0.45 * sstep(0.5, 0.3, big) * sstep(0.45, 0.65, n2))[..., None]  # dark rock
            pan = sstep(0.66, 0.70, fbm(X, Y, Z, 16, 625, 4))
            c = c + (C(214, 196, 172) - c) * (0.6 * pan)[..., None]   # salt pans
        elif r == 'ember':
            m = fbm(X, Y, Z, 40, 620, 4)
            c = c + (C(160, 40, 24) - c) * (0.45 * sstep(0.55, 0.7, m))[..., None]
            c = c + (ac - c) * (0.55 * a)[..., None]
        elif r == 'black':
            wet = sstep(0.6, 0.64, fbm(X, Y, Z, 70, 630, 4)) * sstep(0.4, 0.6, n1)
            c = c + (C(22, 46, 50) - c) * (0.75 * wet)[..., None]
        elif r == 'cinder':
            flows = ridged(X, Y, Z, 14, 640, 5)
            c = c + (C(18, 16, 16) - c) * (0.6 * sstep(0.45, 0.8, flows))[..., None]
            c = c + (ac - c) * (0.35 * a)[..., None]
        elif r == 'steam':
            dots = sstep(0.68, 0.74, fbm(X, Y, Z, 120, 650, 3))
            c = c + (C(206, 200, 184) - c) * (0.35 * a)[..., None]
            c = c + (C(60, 170, 170) - c) * (0.7 * dots * (n2 > 0.5))[..., None]
            c = c + (C(200, 120, 50) - c) * (0.6 * dots * (n2 <= 0.5))[..., None]
        elif r == 'bloom':
            veins = ridged(X, Y, Z, 18, 660, 5)
            c = c + (ac - c) * (0.6 * sstep(0.55, 0.85, veins))[..., None]
            c = c + (C(40, 24, 60) - c) * (0.4 * a)[..., None]
        elif r == 'shoals':
            c = lo + (C(80, 120, 52) - lo) * t[..., None]
        elif r == 'grass':
            c = c + (ac - c) * (0.75 * a)[..., None]
            c = c + (C(196, 176, 120) - c) * (0.4 * sstep(0.5, 0.7, n2))[..., None]
        else:
            c = c + (ac - c) * (0.5 * a)[..., None]
        col += c * w[..., None]
    # --- height
    reg_amp = np.array([0.55, 0.7, 0.95, 0.25, 0.08, 0.0, 0.75, 0.6, 0.15, 0.45], np.float32)
    amp = np.tensordot(reg_amp, ws, 1)
    inland = sstep(0.0, 0.6, g)
    mmask = sstep(0.42, 0.62, fbm(X, Y, Z, 3, 400, 4))
    mount = ridged(X, Y, Z, 7, 410, 8)
    h = 0.25 * inland + amp * mmask * mount * (0.4 + 0.6 * inland) + 0.06 * fbm(X, Y, Z, 30, 420, 6)
    h = h + (0.04 + 0.5 * amp) * 0.35 * ridged(X, Y, Z, 22, 440, 6) * inland + 0.025 * fbm(X, Y, Z, 120, 450, 3)
    # the Rust: mesas and terraces
    wr = ws[RIX['rust']]
    q = h * 7; fq = q - np.floor(q); hr = (np.floor(q) + sstep(0.4, 0.6, fq)) / 7
    q2 = (np.floor(q) + sstep(0.25, 0.75, fq)) / 7
    h = h + (q2 - h) * wr * 0.45
    # Cinder Rift: a long graben through the territory
    pole = np.cross(P.vec(68, -54), P.vec(20, -38)); pole = pole / np.linalg.norm(pole)
    dd = np.degrees(np.arcsin(np.clip(X * pole[0] + Y * pole[1] + Z * pole[2], -1, 1)))
    cen = P.vec(68, -54); along = np.degrees(np.arccos(np.clip(X * cen[0] + Y * cen[1] + Z * cen[2], -1, 1)))
    dd = dd + 1.2 * (fbm(X, Y, Z, 10, 430, 4) - 0.5)
    rift = sstep(2.4, 1.2, np.abs(dd)) * sstep(20, 9, along)
    h = h - 0.5 * rift
    col = col + (C(22, 18, 18) - col) * (0.6 * rift)[..., None]
    wall = np.exp(-((np.abs(dd) - 1.8) / 0.5) ** 2) * sstep(20, 9, along)
    h = h + 0.12 * wall
    fiss = np.exp(-(dd / 0.22) ** 2) * sstep(18, 6, along) * sstep(0.45, 0.6, n2)
    col = col + (C(200, 84, 28) - col) * (0.75 * fiss)[..., None]
    # craters (the atlas's, more under the belt, and Ringfall Basin)
    P3 = np.stack([X, Y, Z], -1)
    latmin, latmax = LA.min(), LA.max()
    hard = ws[RIX['rust']] + ws[RIX['cinder']] + 0.6 * ws[RIX['steam']] + 0.5 * ws[RIX['bloom']] + 0.25 * ws[RIX['grass']]
    for (lo, la, r), v in zip(CR, CRV):
        if la + r * 2.5 < latmin or la - r * 2.5 > latmax: continue
        # quick angular prefilter
        dot = P3 @ v
        m = dot > np.cos(np.radians(r * 2.6))
        if not m.any(): continue
        a = np.degrees(np.arccos(np.clip(dot[m], -1, 1))) / r
        prof = np.where(a < 1, (a ** 2.5 - 1) * 0.5, 0) + 0.3 * np.exp(-((a - 1) / 0.2) ** 2) + 0.05 * np.exp(-((a - 1) / 0.9) ** 2)
        prof = prof * r ** 0.5 * 0.6
        k = min(1.0, 0.25 + r * 0.25) * (0.3 + 0.7 * hard[m])
        h[m] += prof * k * 0.5
        cc = col[m]
        rim = np.exp(-((a - 1) / 0.25) ** 2)[:, None]
        cc = cc * (1 - 0.12 * hard[m][:, None] * sstep(1.0, 0.6, a)[:, None]) + rim * 0.02 * hard[m][:, None]
        if r > 5:  # Ringfall Basin: a dark glassy floor, terraced walls, the Spire's peak in the middle
            cc = cc + (C(26, 24, 30) - cc) * (0.55 * sstep(0.95, 0.4, a))[:, None]
            cc = cc + (C(120, 104, 96) - cc) * (0.35 * np.exp(-((a - 1) / 0.08) ** 2))[:, None]
            h[m] += 0.25 * np.exp(-(a / 0.07) ** 2) + 0.05 * np.sin(a * 40) * sstep(0.6, 0.95, a) * (a < 1)
        col[m] = cc
    # --- rivers (cheap): thin meanders in the wet regions
    rv = np.abs(fbm(X + 0.3 * (n1 - .5), Y, Z, 9, 700, 6) - 0.5)
    wet = ws[RIX['green']] + ws[RIX['ember']] + 0.7 * ws[RIX['grass']] + ws[RIX['black']]
    gy, gx = np.gradient(rv); gr = np.sqrt(gx * gx + gy * gy) + 1e-9
    river = np.clip(1.0 - (rv / gr) / 0.7, 0, 1) * wet * sstep(0.03, 0.15, g) * sstep(0.35, 0.6, fbm(X, Y, Z, 5, 710, 3))
    col = col + (C(24, 52, 56) - col) * (0.8 * river)[..., None]
    h = h - 0.03 * river
    sn = fbm(X, Y, Z, 8, 800, 5); deepv = fbm(X, Y, Z, 3, 810, 5)
    wsh = ws[RIX['shoals']]
    gy, gx = np.gradient(g); grd = np.sqrt(gx * gx + gy * gy) + 1e-9
    aland = np.clip(0.5 + g / grd, 0, 1)
    # beaches: a pale fringe on the warm coasts
    beach = np.clip(1 - g / (grd * 2.5), 0, 1) * aland * (1 - ws[RIX['cinder']]) * (1 - ws[RIX['black']])
    col = col + (C(208, 186, 140) - col) * (0.45 * beach)[..., None]
    # --- the ice
    capf = np.maximum(F['cn'], F['cs'])
    ice = capf + 1.6 * (fbm(X, Y, Z, 28, 900, 6) - 0.5) + 0.8 * (ridged(X, Y, Z, 60, 910, 3) - 0.3)
    gy, gx = np.gradient(ice); gi = np.sqrt(gx * gx + gy * gy) + 1e-9
    aice = np.clip(0.5 + ice / gi, 0, 1)
    floes = sstep(0.55, 0.62, fbm(X, Y, Z, 60, 920, 4) + 0.06 * (ice + 4) / 4) * sstep(-5, -0.5, ice) * (1 - aice)
    icecol = C(226, 234, 242) + (C(176, 198, 222) - C(226, 234, 242)) * sstep(0.4, 0.8, n2)[..., None]
    crev = ridged(X, Y, Z, 30, 930, 4)
    icecol = icecol * (1 - 0.08 * sstep(0.6, 0.9, crev))[..., None]
    snow = sstep(0.75, 0.95, h) * sstep(52, 66, LA) * aland
    col = col + (C(232, 236, 240) - col) * (0.85 * snow)[..., None]
    land = np.maximum(aland, aice)
    h = h * aland + 0.25 * aice * sstep(-1, 6, ice)
    f16 = lambda a: a.astype(np.float16)
    return j0, dict(col=f16(col), icecol=f16(icecol), aland=f16(aland), aice=f16(aice), floes=f16(floes), land=f16(land),
                    sn=f16(sn), deepv=f16(deepv), wsh=f16(wsh), isl=f16(F['isl'])), h.astype(np.float32)

def clouds(Wc):
    Hc = Wc // 2
    lon = np.linspace(-180, 180, Wc, endpoint=False) + 180 / Wc; lat = np.linspace(90, -90, Hc, endpoint=False) - 90 / Hc
    LO, LA = np.meshgrid(lon, lat); X, Y, Z = P.xyz(LO, LA)
    wx = X + 0.35 * (fbm(X, Y, Z, 3, 1000, 4) - .5); wy = Y + 0.35 * (fbm(X, Y, Z, 3, 1010, 4) - .5); wz = Z + 0.35 * (fbm(X, Y, Z, 3, 1020, 4) - .5)
    # latitude-stretched (zonal winds)
    c = fbm(wx * 0.7, wy * 0.7, wz * 1.8, 5, 1030, 8)
    band = 0.55 + 0.45 * np.exp(-((np.abs(LA) - 52) / 14) ** 2) + 0.3 * np.exp(-(LA / 8) ** 2)
    a = sstep(0.60, 0.82, c * (0.8 + 0.3 * band))
    wisp = fbm(wx * 0.8, wy * 0.8, wz * 2.0, 26, 1040, 5)
    a = np.clip(a * (0.35 + 0.9 * sstep(0.35, 0.75, wisp)), 0, 1) * 0.85
    return (a * 255).astype(np.uint8)

if __name__ == '__main__':
    P.calibrate(); print('OFF', P.OFF)
    step = 32
    jobs = [(j, min(H, j + step)) for j in range(0, H, step)]
    A = {}; hh = np.zeros((H, W), np.float32)
    with mp.Pool(4) as pool:
        for j0, o, h in pool.imap_unordered(chunk, jobs):
            j1 = j0 + h.shape[0]; hh[j0:j1] = h
            for k_, v in o.items():
                if k_ not in A: A[k_] = np.zeros((H, W) + v.shape[2:], np.float16)
                A[k_][j0:j1] = v
            print('.', end='', flush=True)
    print()
    # the sea: depth from the distance to the nearest shore (continental shelves round every coast and islet)
    land = A['land']
    pad = W // 8
    lm = np.concatenate([land[:, -pad:], land, land[:, :pad]], 1) < 0.5
    dist = nd.distance_transform_edt(lm)[:, pad:-pad].astype(np.float32) * (360.0 / W)  # (degrees, roughly)
    del lm
    sn = A['sn'].astype(np.float32); wsh = A['wsh'].astype(np.float32)
    shelf = np.exp(-dist / (0.7 + 2.2 * sn ** 2))
    wsb = nd.gaussian_filter(wsh, 3.0 * W / 360, mode=('nearest', 'wrap'))
    bank = wsb * np.exp(-dist / 1.6)
    shelf = np.maximum(shelf, 0.65 * bank)
    deep = C(5, 18, 42) + (C(10, 32, 64) - C(5, 18, 42)) * sstep(0.3, 0.7, A['deepv'].astype(np.float32))[..., None]
    deep = deep * (1 + 0.25 * np.exp(-dist / 6))[..., None]
    sea = deep + (C(28, 104, 128) - deep) * (shelf ** 1.2)[..., None]
    sea = sea + (C(66, 160, 158) - sea) * (shelf ** 4 * 0.65 * sstep(0.3, 0.6, sn))[..., None]
    isl = A['isl'].astype(np.float32)
    lag = wsb * sstep(0.53, 0.55, isl) * np.exp(-dist / 0.3) * 0.5
    sea = sea + (C(70, 178, 172) - sea) * lag[..., None]
    reef = wsb * np.exp(-((isl - 0.5) / 0.006) ** 2) * sstep(0.45, 0.65, sn)
    sea = sea + (C(150, 204, 190) - sea) * (0.45 * reef)[..., None]
    del dist, shelf, bank, deep, isl, lag, reef, wsb
    aland = A['aland'].astype(np.float32)[..., None]
    col = sea + (A['col'].astype(np.float32) - sea) * aland
    del sea
    col = col + (C(210, 224, 236) - col) * (0.8 * A['floes'].astype(np.float32))[..., None]
    col = col + (A['icecol'].astype(np.float32) - col) * A['aice'].astype(np.float32)[..., None]
    del A
    # relief: hillshade from the height, light from the north-west (upper left on a north-up view)
    sc = W / 2048.0
    lat = np.linspace(90, -90, H, endpoint=False) - 90 / H
    coslat = np.maximum(np.cos(np.radians(lat)), 0.05)[:, None]
    hp = np.pad(hh, ((1, 1), (0, 0)), mode='edge')
    dx = (np.roll(hh, -1, 1) - np.roll(hh, 1, 1)) / 2 / coslat
    dy = (hp[2:] - hp[:-2]) / 2
    gm = np.sqrt(dx * dx + dy * dy)[land > 0.5]
    k = 0.55 / max(np.percentile(gm, 90), 1e-6)  # relief strength: the steep tenth of the land gets a clear slope
    print('relief k', k)
    nx, ny = -dx * k, dy * k  # (ny: towards north)
    Lx, Ly, Lz = -0.55, 0.55, 0.63
    shade = (nx * Lx + ny * Ly + Lz) / np.sqrt(nx * nx + ny * ny + 1) / Lz
    ao = hh - nd.gaussian_filter(hh, 6 * sc, mode=('nearest', 'wrap'))
    rel = np.clip(0.35 + 0.65 * shade + 1.5 * ao, 0.35, 1.5)
    lf = land.astype(np.float32)
    rel = 1 + (rel - 1) * lf
    col = np.clip(col.astype(np.float32) * rel[..., None], 0, 1)
    cl = clouds(min(W, 2048))
    from PIL import Image
    ART = os.path.normpath(os.path.join(HERE, '..', '..', 'art'))
    os.makedirs(os.path.join(ART, 'globe'), exist_ok=True)
    rgb = Image.fromarray((col * 255 + 0.5).astype(np.uint8))
    alpha = Image.fromarray((224 + 31 * np.clip(lf, 0, 1) + 0.5).astype(np.uint8))
    for w_, q_ in ((4096, 80), (2048, 82)):
        if w_ > W: continue
        im = rgb if w_ == W else rgb.resize((w_, w_ // 2), Image.LANCZOS)
        al = alpha if w_ == W else alpha.resize((w_, w_ // 2), Image.LANCZOS)
        im = im.convert('RGBA'); im.putalpha(al)
        dst = os.path.join(ART, 'globe', 'ithaca-%d.webp' % w_)
        im.save(dst, quality=q_, method=6, alpha_quality=60, exact=True)
        print(dst, os.path.getsize(dst) // 1024, 'KB')
    ci = Image.fromarray(cl).resize((1024, 512), Image.LANCZOS)
    dst = os.path.join(ART, 'globe', 'ithaca-clouds.webp'); ci.save(dst, quality=70, method=6)
    print(dst, os.path.getsize(dst) // 1024, 'KB')
    # the menu planet's face: this picture, small, with the colonies' lights (its alpha) kept where there is land
    mm = os.path.join(ART, 'lore', 'ithaca-map.webp')
    if os.path.exists(mm):
        old = Image.open(mm).convert('RGBA'); mw, mh = old.size
        a = np.asarray(old)[..., 3].copy()
        lsm = np.asarray(Image.fromarray((lf * 255).astype(np.uint8)).resize((mw, mh), Image.BILINEAR)) > 127
        a[~lsm] = 255
        small = np.asarray(rgb.resize((mw, mh), Image.LANCZOS))
        Image.fromarray(np.dstack([small, a]), 'RGBA').save(mm, quality=82, method=6, alpha_quality=100, exact=True)
        print(mm, os.path.getsize(mm) // 1024, 'KB')
    print('done')

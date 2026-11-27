# The Ring's space backdrop (js/ring.js): the deep sky, Ithaca I with its Ring, Argos, Corvane's glare and a few drifting
# rocks, painted once as image layers. Reproducible: fixed seeds, no randomness outside them.
# Usage: python3 tools/ringsky/ringsky.py [look] [outDir]
#   look    'shadow' (the installed one: Shadow pass, the planet's light following the day), or the two other concepts
#           from the design canvas, 'crescent' and 'ringplane'
#   outDir  art/ring by default: writes the pictures (.webp) and ring-art.js (the list, sizes and where each goes)
# Needs numpy, scipy and Pillow. About a minute on 4 cores. ART_GUIDE.md: Batch 40, The Ring's backdrop.
import sys, os, json, math, numpy as np
from scipy import ndimage as nd
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
LOOK = sys.argv[1] if len(sys.argv) > 1 else 'shadow'
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, 'art', 'ring')
os.makedirs(OUT, exist_ok=True)

def clamp(x, a=0.0, b=1.0): return np.clip(x, a, b)
def sstep(a, b, x): t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t)
def norm(v): v = np.asarray(v, np.float64); return v / np.linalg.norm(v)

def noise2(h, w, scale, seed, octaves=5, gain=0.5):
    """Smooth fractal noise (0..1-ish) on an h x w grid, the coarsest cells `scale` px across."""
    rng = np.random.default_rng(seed)
    out = np.zeros((h, w), np.float32); amp, tot, s = 1.0, 0.0, float(scale)
    for _ in range(octaves):
        gh, gw = max(2, int(h / s) + 3), max(2, int(w / s) + 3)
        g = rng.random((gh, gw)).astype(np.float32)
        z = nd.zoom(g, (s, s), order=3, mode='grid-wrap')[:h, :w]
        out += amp * z; tot += amp; amp *= gain; s /= 2
        if s < 1.5: break
    return np.clip(out / tot, 0, 1)

def save(name, rgba, q=86):
    a = np.clip(rgba * 255 + 0.5, 0, 255).astype(np.uint8)
    im = Image.fromarray(a, 'RGBA' if a.shape[2] == 4 else 'RGB')
    p = os.path.join(OUT, name + '.webp')
    im.save(p, 'WEBP', quality=q, method=6, alpha_quality=90)
    print('wrote', os.path.relpath(p, ROOT), im.size, os.path.getsize(p) // 1024, 'KB')
    return im.size

def down(a, k=2):
    h, w = a.shape[0] // k * k, a.shape[1] // k * k
    a = a[:h, :w]
    return a.reshape(h // k, k, w // k, k, *a.shape[2:]).mean(axis=(1, 3))

def premul_to_straight(c, a):
    return np.where(a[..., None] > 1e-4, c / np.maximum(a[..., None], 1e-4), 0)

# ------------------------------------------------------------------------------------------------------------- textures
def tex(p, mode=None):
    im = Image.open(os.path.join(ROOT, p))
    if mode: im = im.convert(mode)
    return np.asarray(im).astype(np.float32) / 255.0

GLOBE = tex('art/globe/ithaca-2048.webp', 'RGBA')            # colour; alpha: 1 land, 0.88 sea
CLOUD = tex('art/globe/ithaca-clouds.webp', 'L')
ATLAS = np.asarray(Image.open(os.path.join(ROOT, 'art/lore/ithaca-map.webp')).convert('RGBA')).astype(np.float32)
LIGHTS = np.where((ATLAS[..., 3] < 255) & (ATLAS[..., 3] >= 200), np.minimum(255, 140 + (254 - ATLAS[..., 3]) * 4), 0) / 255.0
LIGHTS = nd.zoom(LIGHTS, 4, order=1)                          # 2048 x 1024, a little soft as towns are from orbit
LIGHTS = nd.gaussian_filter(np.maximum(LIGHTS, 0), 1.6) * 1.5  # (towns as soft clusters of light, not dots)

def sample(img, u, v):
    """Bilinear lookup in an equirectangular map, u 0..1 round (wrapping), v 0..1 north to south."""
    H, W = img.shape[:2]
    x = (u % 1.0) * W - 0.5; y = clamp(v, 0, 1) * H - 0.5
    x0 = np.floor(x).astype(int); y0 = np.floor(y).astype(int); fx = x - x0; fy = y - y0
    x0 %= W; x1 = (x0 + 1) % W; y0 = np.clip(y0, 0, H - 1); y1 = np.clip(y0 + 1, 0, H - 1)
    if img.ndim == 3: fx = fx[..., None]; fy = fy[..., None]
    a = img[y0, x0] * (1 - fx) + img[y0, x1] * fx
    b = img[y1, x0] * (1 - fx) + img[y1, x1] * fx
    return a * (1 - fy) + b * fy

# ------------------------------------------------------------------------------------------------------- Ithaca I + Ring
RING_BANDS = [  # (radius in planet radii, half-width, optical depth): the menu planet's five bands, filled out
    (1.40, 0.035, 0.18), (1.47, 0.05, 0.32), (1.56, 0.035, 0.22), (1.635, 0.05, 0.55), (1.70, 0.04, 0.42),
    (1.81, 0.035, 0.75), (1.865, 0.02, 0.5), (1.93, 0.05, 0.26), (2.02, 0.03, 0.09),
]

def ring_tau(rho, az):
    t = np.zeros_like(rho)
    for r0, w, d in RING_BANDS: t += d * np.exp(-((rho - r0) / w) ** 2)
    rng = np.random.default_rng(77)
    fine = np.zeros_like(rho)
    for k in range(14):  # ringlets
        f = 40 + rng.random() * 260; ph = rng.random() * 6.28
        fine += np.sin(rho * f + ph) * (0.5 / (1 + k * 0.4))
    t *= 1 + 0.35 * fine / 2.2
    t *= 1 + 0.08 * np.sin(az * 3 + rho * 9)  # (a faint lopsidedness: the clumps of a broken moon)
    t *= 0.7
    t *= sstep(1.33, 1.40, rho) * (1 - sstep(2.04, 2.12, rho))
    t[(rho > 1.735) & (rho < 1.765)] *= 0.12  # the gap
    return np.maximum(t, 0)

def ring_colour(rho):
    # grey regolith dust inside, the broken moon's coral-cream outside; each ringlet a slightly different shade
    k = clamp((rho - 1.35) / 0.75)[..., None]
    inner = np.array([0.60, 0.58, 0.60]); outer = np.array([0.96, 0.80, 0.66])
    rng = np.random.default_rng(78); sh = np.zeros_like(rho)
    for j in range(9): sh += np.sin(rho * (25 + rng.random() * 120) + rng.random() * 6.28) * 0.5 / (1 + j * 0.5)
    shade = (0.82 + 0.18 * np.tanh(sh))[..., None]
    return (inner * (1 - k) + outer * k) * shade

def planet_layer(R, L, axis=0.32, turn=0.0, tilt=-0.32, open_=0.22, night_lights=1.0, halo=1.0, ring_glow=1.0, ss=2, pad=2.2):
    """Ithaca I (radius R px) and its Ring, lit by unit vector L (screen x right, y down, z toward you). Returns RGBA
    (straight alpha) and the planet's middle in the image."""
    L = norm(L)
    ext_x = 2.14 * R; ext_y = max(1.3 * R, 2.14 * R * (abs(math.sin(tilt)) + open_ * abs(math.cos(tilt))) + 0.06 * R)
    W = int(2 * ext_x + 8) // 2 * 2; H = int(2 * ext_y + 8) // 2 * 2
    if pad: H = max(H, int(R * pad) // 2 * 2)
    cx, cy = W / 2, H / 2
    Ws, Hs = W * ss, H * ss
    ys, xs = np.mgrid[0:Hs, 0:Ws].astype(np.float64)
    x = ((xs + 0.5) / ss - cx) / R; y = ((ys + 0.5) / ss - cy) / R
    rr = x * x + y * y
    inside = rr < 1
    z = np.sqrt(np.maximum(0, 1 - rr))
    # the ring's plane: tipped toward you by open_ (the ellipse's thinness), slanted by tilt
    e = math.asin(open_)
    n0 = np.array([0.0, math.cos(e), -math.sin(e)])
    c, s = math.cos(tilt), math.sin(tilt)
    n = np.array([n0[0] * c - n0[1] * s, n0[0] * s + n0[1] * c, n0[2]])
    # ---- the planet
    nx, ny, nz = x, y, z
    ca, sa = math.cos(axis), math.sin(axis)
    px_ = nx * ca + ny * sa; py_ = -nx * sa + ny * ca
    lat = np.arcsin(clamp(-py_, -1, 1)); lon = np.arctan2(px_, nz)
    u = lon / (2 * math.pi) + 0.5 + turn; v = 0.5 - lat / math.pi
    col = sample(GLOBE, u, v); land = col[..., 3] > 0.94; col = col[..., :3]
    cl = sample(CLOUD, u + 0.45, v) * 1.05; cls = sample(CLOUD, u + 0.45 - 0.004, v) * 1.05
    lights = sample(LIGHTS, u, v)
    sdot = nx * L[0] + ny * L[1] + nz * L[2]
    sm = clamp((sdot + 0.18) / 0.73); day = sm * sm * (3 - 2 * sm)
    # the Ring's shadow on the planet
    ln = L @ n
    tsh = -(nx * n[0] + ny * n[1] + nz * n[2]) / (ln if abs(ln) > 1e-6 else 1e-6)
    qx, qy, qz = nx + tsh * L[0], ny + tsh * L[1], nz + tsh * L[2]
    rq = np.sqrt(qx * qx + qy * qy + qz * qz)
    rshadow = np.where((tsh > 0) & inside, 1 - 0.85 * (1 - np.exp(-ring_tau(rq, np.arctan2(qy, qx)) * 1.6)), 1.0)
    lit = (0.035 + day * (0.55 + 0.45 * np.maximum(sdot, 0)) * 1.02) * rshadow
    warm = clamp(1 - np.abs(sdot - 0.04) * 5)
    shade = (1 - 0.28 * cls * (1 - cl) * day) * (1 - 0.2 * cl)
    rgb = col * shade[..., None]
    rgb = rgb + (np.array([0.97, 0.97, 0.98]) - rgb) * (cl * 0.92)[..., None]
    w2 = warm * (0.6 + 0.4 * (1 - cl))
    rgb = rgb * np.stack([lit + 0.3 * w2 * rshadow, lit + 0.1 * w2 * rshadow, lit - 0.02 * w2], -1)
    Hv = norm(L + np.array([0, 0, 1.0])); ndh = np.maximum(0, nx * Hv[0] + ny * Hv[1] + nz * Hv[2]); p12 = ndh ** 12
    spec = (p12 ** 5.8 * 0.38 + p12 * 0.1) * day * (1 - cl) * (~land) * rshadow
    rgb += spec[..., None] * np.array([1, 0.95, 0.85])
    fres = (1 - nz) ** 2.2
    air = 0.55 * fres * clamp(sdot + 0.35)
    rgb = rgb * (1 - 0.35 * fres)[..., None] + air[..., None] * np.array([0.30, 0.55, 1.0])
    night = clamp(-sdot * 3 + 0.1)
    la = lights * night * (1 - 0.7 * cl) * night_lights
    rgb += la[..., None] * np.array([1.0, 0.75, 0.43])
    # the air's edge seen against the light (backlit: a thin bright ring, warm at its foot where the light crosses the most air)
    back = max(0.0, -L[2])
    d = np.sqrt(rr)
    limb_side = np.where(d > 0, (x * L[0] + y * L[1]) / np.maximum(d, 1e-6), 0)
    lside = clamp(limb_side * 0.5 + 0.5)
    lsl = math.hypot(L[0], L[1])
    # how far round the limb the light reaches: all round when Corvane is right behind
    reach = clamp(lside * 1.4 + back ** 2 * 1.4 - 0.45)
    hal = np.where(d >= 1, np.exp(-(d - 1) / 0.022) * 0.9 + np.exp(-(d - 1) / 0.08) * 0.25, 0)
    hal = hal * reach * (0.35 + 0.65 * min(1, back * 2 + 0.25)) * halo
    hal_in = np.where(inside, np.exp(-(1 - d) / 0.012) * reach * back * 1.4 * halo, 0)
    hcol = np.stack([0.40 + 0.6 * back * np.exp(-(np.abs(d - 1)) / 0.01), 0.62 + 0.0 * d, np.ones_like(d)], -1)
    # sunset band: the light reddened through the deepest air
    sunset = np.where(np.abs(d - 1) < 0.03, np.exp(-((d - 1.004) / 0.008) ** 2) * reach * back * 1.2, 0) * halo
    # ---- the Ring
    tz = -(n[0] * x + n[1] * y) / n[2]
    rx, ry, rz = x, y, tz
    rho = np.sqrt(rx * rx + ry * ry + rz * rz)
    # azimuth in the plane
    tau = ring_tau(rho, np.arctan2(ry, rx))
    hidden = inside & (tz < z) & (tz > -z - 1e-9) & (tz < 0)
    hidden = inside & (tz < 0)  # behind the planet's disc
    # the planet's shadow on the Ring
    b = rx * L[0] + ry * L[1] + rz * L[2]; cc = rho * rho - 1; disc = b * b - cc
    pshadow = (disc > 0) & (b < 0) & (rho > 1)
    pshadow = np.where(pshadow, 1.0, 0.0)
    pshadow = nd.gaussian_filter(pshadow, 1.2 * ss)
    mu = abs(n[2]); mu0 = abs(ln)
    same = np.sign(ln) == np.sign(n[2])  # lit face toward you
    slant = tau / max(mu, 0.04)
    alpha_r = 1 - np.exp(-slant)
    if same:
        bright = (0.2 + 0.62 * mu0 ** 0.5) * alpha_r
    else:  # seen from the dark side: light comes through the thin parts, forward-scattered toward you
        fwd = 0.25 + 2.2 * back ** 3
        bright = alpha_r * np.exp(-tau * 1.1) * fwd * 0.34
    bright = bright * (1 - 0.92 * pshadow)
    # planetshine on the night side of the Ring: a faint coral
    rcol = ring_colour(rho) * bright[..., None] * ring_glow + np.array([0.10, 0.05, 0.04]) * alpha_r[..., None] * 0.35
    ra = alpha_r * np.where(hidden, 0, 1)
    # ---- compose: back ring, planet, front ring, halo (all premultiplied)
    pa = np.where(inside, 1.0, 0.0)
    edge = clamp((1 - d) * R * ss + 0.5)  # (antialias by supersampling anyway)
    pa = np.where(d < 1, 1.0, 0.0)
    front = tz > 0
    out = np.zeros((Hs, Ws, 3)); A = np.zeros((Hs, Ws))
    # back ring (behind the planet: hidden inside the disc)
    bm = (~front)
    out += np.where(bm[..., None], rcol * np.where(hidden, 0, 1)[..., None], 0); A += np.where(bm, ra, 0)
    # the halo outside the disc (additive glow: alpha its brightness)
    glow = hal[..., None] * hcol + sunset[..., None] * np.array([1.0, 0.45, 0.2])
    gl = np.max(glow, -1)
    out = out + glow; A = A + gl * (1 - A)
    # planet over
    pl = rgb + hal_in[..., None] * np.array([0.55, 0.7, 1.0]) + sunset[..., None] * np.array([1.0, 0.45, 0.2]) * pa[..., None]
    out = out * (1 - pa[..., None]) + pl * pa[..., None]; A = A * (1 - pa) + pa
    # front ring over
    fa = np.where(front, ra, 0)
    out = out * (1 - fa[..., None]) + np.where(front[..., None], rcol, 0); A = A * (1 - fa) + fa
    out = down(out, ss); A = down(A, ss)
    A = clamp(A)
    rgbS = premul_to_straight(out, A)
    return np.concatenate([clamp(rgbS), A[..., None]], -1), (cx, cy)

# ----------------------------------------------------------------------------------------------------------- Argos
def moon_map(W=1024, seed=7717):
    H = W // 2
    jj, ii = np.mgrid[0:H, 0:W].astype(np.float64)
    lat = (0.5 - (jj + 0.5) / H) * math.pi; lo = (ii + 0.5) / W * 2 * math.pi
    X = np.cos(lat) * np.sin(lo); Y = np.sin(lat); Z = np.cos(lat) * np.cos(lo)
    rng = np.random.default_rng(seed)
    def pt(u, la): return np.array([math.cos(la) * math.sin(u * 2 * math.pi), math.sin(la), math.cos(la) * math.cos(u * 2 * math.pi)])
    n1 = noise2(H, W, 96, seed + 2, 5); n2 = noise2(H, W, 6, seed + 3, 2); wob = 0.26 * (noise2(H, W, 140, seed + 1, 4) - 0.5)
    m = np.zeros((H, W))
    for u, la, r in [[0.08, 0.38, 0.4], [0.94, 0.14, 0.34], [0.03, -0.2, 0.28], [0.88, -0.38, 0.22], [0.16, 0.02, 0.18], [0.52, 0.24, 0.24], [0.62, -0.34, 0.16]]:
        p = pt(u, la); dd = np.arccos(clamp(X * p[0] + Y * p[1] + Z * p[2], -1, 1))
        m = np.maximum(m, clamp((r + wob - dd) / 0.09))
    a = (0.8 + 0.24 * (n1 - 0.5) + 0.08 * (n2 - 0.5)) * (1 - m) + (0.4 + 0.12 * (n1 - 0.5) + 0.03 * (n2 - 0.5)) * m
    h = 0.003 * (n2 - 0.5) * (1 - 0.7 * m)
    for k in range(420):
        p = pt(rng.random(), math.asin(rng.random() * 2 - 1)); r = 0.01 + 0.16 * rng.random() ** 4
        young = rng.random() < 0.12; dep = 0.6 + 0.4 * rng.random(); rayph = rng.random() * 100
        cr = math.cos(min(math.pi, r * (4.6 if young else 1.6)))
        dot = X * p[0] + Y * p[1] + Z * p[2]; sel = dot >= cr
        if not sel.any(): continue
        q = np.arccos(clamp(dot[sel], -1, 1)) / r; fill = 1 - 0.6 * m[sel]
        hh = np.where(q < 1, -r * 0.14 * dep * fill * (1 - q * q), 0) + r * 0.045 * fill * np.exp(-(((q - 1) / 0.16) ** 2))
        aa = np.where(q < 0.85, -0.025, 0.04 * np.exp(-(((q - 1) / 0.14) ** 2))) * fill
        if young:
            e1 = np.array([p[2], 0, -p[0]]); e1 /= (np.linalg.norm(e1) or 1); e2 = np.cross(p, e1)
            ang = np.arctan2(X[sel] * e2[0] + Y[sel] * e2[1] + Z[sel] * e2[2], X[sel] * e1[0] + Y[sel] * e1[1] + Z[sel] * e1[2])
            ray = np.maximum(0, np.sin(ang * 5 + rayph) * np.sin(ang * 9 + rayph * 2)) ** 3
            aa = aa + 0.16 * np.exp(-(((q - 1) / 0.25) ** 2)) + np.where(q < 1, 0.06, 0) + np.where(q > 1, 0.13 * ray * np.maximum(0, 1 - (q - 1) / 1.8), 0)
        h[sel] += hh; a[sel] += aa
    a = clamp(a, 0.2, 1.15)
    du = 2 * math.pi / W; dv = math.pi / H; clat = np.maximum(0.15, np.cos(lat))
    gu = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) / (2 * du * clat)
    gv = (np.vstack([h[:1], h[:-1]]) - np.vstack([h[1:], h[-1:]])) / (2 * dv)
    return a, m, gu, gv

def moon_layer(R, L, turn=0.0, tilt=-0.32, ss=3, planetshine=1.0):
    L = norm(L)
    A, M, GU, GV = MOON
    n = int(2 * R + 4) // 2 * 2; N = n * ss
    ys, xs = np.mgrid[0:N, 0:N].astype(np.float64)
    x = ((xs + 0.5) / ss - n / 2) / R; y = ((ys + 0.5) / ss - n / 2) / R
    rr = x * x + y * y; inside = rr < 1; z = np.sqrt(np.maximum(0, 1 - rr))
    c, s = math.cos(tilt), math.sin(tilt)
    lx = x * c + y * s; ly = -x * s + y * c
    lat = np.arcsin(clamp(-ly, -1, 1)); lo = np.arctan2(lx, z)
    u = lo / (2 * math.pi) + turn; v = 0.5 - lat / math.pi
    a = sample(A, u, v); m = sample(M, u, v); su = sample(GU, u, v) * 1.7; sv = sample(GV, u, v) * 1.7
    sl = np.sin(lat)
    E = np.stack([np.cos(lo), np.zeros_like(lo), -np.sin(lo)], -1)
    No = np.stack([-sl * np.sin(lo), -np.cos(lat), -sl * np.cos(lo)], -1)
    def rot(V): return np.stack([V[..., 0] * c - V[..., 1] * s, V[..., 0] * s + V[..., 1] * c, V[..., 2]], -1)
    E = rot(E); No = rot(No)
    N0 = np.stack([x, y, z], -1)
    Nn = N0 - su[..., None] * E - sv[..., None] * No; Nn /= np.linalg.norm(Nn, axis=-1, keepdims=True)
    mu0 = Nn @ L; g0 = N0 @ L
    mu = np.maximum(0.08, z)
    lit = np.where(mu0 > 0, ((1.3 * mu0) / (mu0 + mu)) * 0.68 + mu0 * 0.36, 0) * clamp(mu0 / 0.03)
    l2 = math.hypot(L[0], L[1]) or 1
    side = (x * L[0] + y * L[1]) / l2 / np.maximum(0.2, np.sqrt(rr))
    rim = (1 - z) ** 4 * clamp(side) * clamp(g0 * 4 + 0.4) * 0.9
    shine = 0.06 * clamp(-g0 * 3 + 0.25) * planetshine
    cr = a * (1 - m * 0.03); cg = a * (1 - m * 0.06); cb = a * (1 - m * 0.1)
    rgb = np.stack([cr * (lit * 1.01 + shine * 1.2) + rim, cg * (lit * 0.97 + shine * 0.62) + rim * 0.95, cb * (lit * 0.925 + shine * 0.5) + rim * 0.89], -1)
    al = inside.astype(np.float64)
    rgb = down(rgb * al[..., None], ss); al = down(al, ss)
    return np.concatenate([clamp(premul_to_straight(rgb, al)), al[..., None]], -1)

# ----------------------------------------------------------------------------------------------------------- the sky
def sky_layer(W, H, band_angle, band_off, warm_at, seed=31):
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    u = xx / W; v = yy / H
    base = np.stack([0.043 + 0.0 * u, 0.066 - 0.025 * v, 0.141 - 0.09 * (0.4 * u + v) / 1.4], -1)
    base = np.clip(base, 0, 1)
    # the galaxy's band: a soft diagonal, mottled, crossed by dark dust lanes
    ca, sa = math.cos(band_angle), math.sin(band_angle)
    dx, dy = xx - W / 2, yy - H / 2
    dist = (-dx * sa + dy * ca) / H - band_off
    along = (dx * ca + dy * sa) / W
    n_big = noise2(H, W, 380, seed, 6); n_mid = noise2(H, W, 90, seed + 1, 5); n_fine = noise2(H, W, 14, seed + 2, 3)
    width = 0.16 + 0.05 * (n_big - 0.5)
    band = np.exp(-(dist / width) ** 2) * (0.55 + 0.45 * np.cos(along * 2.4))
    cloud = band * (0.35 + 0.9 * n_mid ** 1.6) * (0.75 + 0.5 * n_fine)
    lanes = sstep(0.5, 0.62, noise2(H, W, 60, seed + 3, 5)) * sstep(0.45, 0.6, noise2(H, W, 260, seed + 4, 3)) * np.exp(-(dist / 0.06) ** 2)
    core = np.exp(-(dist / 0.05) ** 2) * (0.55 + 0.45 * np.cos(along * 2.4)) ** 2
    lum = cloud * 0.16 * (1 - 0.8 * lanes) + core * 0.05 * (1 - lanes)
    bandcol = np.stack([0.80 + 0.2 * core, 0.82 + 0 * core, 0.95 - 0.1 * core], -1)
    sky = base + lum[..., None] * bandcol
    # nebulae: violet, teal and a coral wash on Corvane's side
    for (fx, fy, s, col, a, sd) in [(0.22, 0.32, 0.55, (0.43, 0.27, 0.67), 0.11, 7), (0.8, 0.66, 0.6, (0.20, 0.40, 0.67), 0.10, 8),
                                     (0.52, 0.95, 0.45, (0.24, 0.55, 0.59), 0.06, 9), (warm_at[0], warm_at[1], 0.7, (0.75, 0.35, 0.22), 0.09, 10)]:
        r = np.sqrt(((u - fx) * W / H) ** 2 + (v - fy) ** 2) / s
        wisp = noise2(H, W, 220, seed + sd, 6)
        neb = np.exp(-r * r * 2.2) * sstep(0.32, 0.85, wisp + 0.2 * (1 - r))
        sky += neb[..., None] * np.array(col) * a * 1.6
    # unresolved stars: a fine grain, thicker in the band
    rng = np.random.default_rng(seed + 5)
    N = int(W * H / 160)
    sx = rng.random(N) * W; sy = rng.random(N) * H
    bi = band[np.clip(sy.astype(int), 0, H - 1), np.clip(sx.astype(int), 0, W - 1)]
    keep = rng.random(N) < 0.35 + 0.65 * bi
    sx, sy = sx[keep], sy[keep]
    b = rng.random(len(sx)) ** 3 * 0.55 + 0.04
    stars = np.zeros((H, W), np.float32)
    np.add.at(stars, (sy.astype(int), sx.astype(int)), b)
    stars = nd.gaussian_filter(stars, 0.55) * 2.2
    tint = rng.random(len(sx))
    sky += stars[..., None] * np.array([0.92, 0.95, 1.0])
    return clamp(sky)

# -------------------------------------------------------------------------------------------------------- Corvane
def corvane_layer(n=512):
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
    x = (xx + 0.5 - n / 2) / (n / 2); y = (yy + 0.5 - n / 2) / (n / 2)
    r = np.sqrt(x * x + y * y) + 1e-6; th = np.arctan2(y, x)
    core = np.exp(-(r / 0.035) ** 2)
    corona = np.exp(-r / 0.09) * 0.75 + np.exp(-r / 0.3) * 0.25
    spikes = np.zeros_like(r)
    for k, a in enumerate([0.35, 0.35 + math.pi / 3, 0.35 + 2 * math.pi / 3]):
        d = np.abs(np.sin(th - a)) * r
        spikes += np.exp(-(d / 0.006) ** 2) * np.exp(-r / 0.38) * 0.6
    streak = np.exp(-(y / 0.012) ** 2) * np.exp(-np.abs(x) / 0.5) * 0.35
    ringh = np.exp(-((r - 0.62) / 0.03) ** 2) * 0.05
    hue = np.stack([0.9 + 0.1 * (1 - r), 0.55 + 0.3 * np.exp(-r / 0.2), 0.25 + 0.45 * np.exp(-r / 0.08)], -1)
    I = core[..., None] * np.array([1, 1, 0.96]) + corona[..., None] * hue + spikes[..., None] * np.array([1, 0.86, 0.7]) \
        + streak[..., None] * np.array([1, 0.8, 0.6]) + ringh[..., None] * np.array([0.5, 0.8, 1.0])
    I *= clamp((1 - r) / 0.15)[..., None]
    I = clamp(I)
    # additive: the picture is drawn with 'lighter', so its colour is the light and its alpha only the coverage
    return np.concatenate([I, np.max(I, -1, keepdims=True)], -1)

# ------------------------------------------------------------------------------------------------------- drifting rocks
def rocks_layer(L, cell=128, count=8, seed=91):
    L = norm(L)
    out = np.zeros((cell, cell * count, 4))
    rng = np.random.default_rng(seed)
    ss = 3; N = cell * ss
    ys, xs = np.mgrid[0:N, 0:N].astype(np.float64)
    x = (xs + 0.5) / N * 2 - 1; y = (ys + 0.5) / N * 2 - 1
    th = np.arctan2(y, x); rad = np.sqrt(x * x + y * y)
    for k in range(count):
        harm = sum((rng.random() - 0.5) * 0.22 / (1 + h * 0.6) * np.cos(th * (h + 2) + rng.random() * 6.28) for h in range(6))
        el = 0.7 + 0.25 * rng.random()
        rx = x * (1.0) ; ry = y / el
        rr = np.sqrt(rx * rx + ry * ry)
        R0 = 0.78 * (1 + harm)
        inside = rr < R0
        zz = np.sqrt(np.maximum(0, 1 - (rr / R0) ** 2))
        bump = noise2(N, N, 40, seed + k * 3, 4) - 0.5
        gx, gy = np.gradient(bump)
        nx = x / R0 - gx * 14; ny = y / R0 - gy * 14; nz = zz + 0.05
        nl = np.sqrt(nx * nx + ny * ny + nz * nz); nx /= nl; ny /= nl; nz /= nl
        lam = np.maximum(0, nx * L[0] + ny * L[1] + nz * L[2])
        alb = 0.42 + 0.25 * (noise2(N, N, 24, seed + k * 3 + 1, 3) - 0.5)
        tint = np.array([0.78, 0.66, 0.6]) if k % 3 == 0 else np.array([0.7, 0.68, 0.68])
        rgb = (alb * (0.06 + 1.05 * lam ** 0.9))[..., None] * tint + 0.025
        rim = ((1 - zz) ** 3 * clamp((x * L[0] + y * L[1]) / np.maximum(rad, 1e-3)))[..., None] * np.array([1, 0.85, 0.7]) * 0.5
        rgb = rgb + rim
        a = inside.astype(np.float64)
        rgbd = down(rgb * a[..., None], ss); ad = down(a, ss)
        out[:, k * cell:(k + 1) * cell] = np.concatenate([clamp(premul_to_straight(rgbd, ad)), ad[..., None]], -1)
    return out

# -------------------------------------------------------------------------------------------------------- the looks
MOON = moon_map(1024)
art = {'look': LOOK}

def put(name, rgba, q=86, **meta):
    w, h = save(name, rgba, q)
    art[name] = dict(w=w, h=h, **meta)

RP = 420  # the planet's radius in its pictures (px)
if LOOK == 'shadow':
    # Shadow pass: the Ring's rocks go round through Ithaca I's shadow once a day. By day Corvane stands clear and the
    # planet is lit gibbous; at dusk the star sinks to its limb and the planet thins to a crescent; at night Corvane is
    # behind it: a black disc ringed with lit air, the colonies' lights on its face, the Ring glowing with the light it
    # lets through; at dawn the star comes out on the other limb.
    put('sky', np.concatenate([sky_layer(2048, 1280, -0.52, 0.04, (0.12, 0.12)), np.ones((1280, 2048, 1))], -1), q=84)
    for tod, L, nl in [('day', (-0.62, -0.36, 0.70), 0.0), ('evening', (-0.86, -0.32, -0.40), 0.7), ('night', (-0.05, -0.04, -1.0), 1.0), ('morning', (0.84, 0.30, -0.45), 0.7)]:
        img, (cx, cy) = planet_layer(RP, L, turn=0.62, night_lights=nl)
        put('planet-' + tod, img, q=84, cx=cx, cy=cy, r=RP)
    for tod, L, ps in [('day', (-0.62, -0.36, 0.70), 0.3), ('night', (0.3, 0.2, -0.93), 1.0)]:
        put('argos-' + tod, moon_layer(110, L, ps and 0.12, planetshine=ps), cx=112, cy=112, r=110)
    put('corvane', corvane_layer(384))
    put('rocks', rocks_layer((-0.62, -0.36, 0.70)), cell=128, n=8)
    art['layout'] = {
        # where the planet sits and how big (its radius as a share of the view's shorter side), wide and upright
        'wide': {'planet': [0.79, 0.66, 0.36], 'argos': [0.2, 0.3, 0.075]},
        'tall': {'planet': [0.66, 0.74, 0.5], 'argos': [0.22, 0.22, 0.09]},
        # Corvane per time of day, in the planet's radii from its middle (night: behind it)
        'sun': {'day': [-2.9, -1.55], 'evening': [-1.02, -0.38], 'night': [0.0, 0.0], 'morning': [1.0, 0.36]},
        'sunSize': 1.1, 'band': True,
    }
elif LOOK == 'crescent':
    # Crescent: one still view. Ithaca I low in the corner as a fat crescent with Corvane just off its limb, the Ring
    # thrown wide across the sky; no change through the day.
    put('sky', np.concatenate([sky_layer(2048, 1280, 0.42, -0.08, (0.62, 0.5)), np.ones((1280, 2048, 1))], -1), q=84)
    L = (-0.8, -0.5, -0.15)
    img, (cx, cy) = planet_layer(RP, L, turn=0.7, night_lights=0.8, open_=0.3, tilt=-0.42)
    put('planet-day', img, q=84, cx=cx, cy=cy, r=RP)
    put('argos-day', moon_layer(110, L, 0.1, planetshine=0.6), cx=112, cy=112, r=110)
    put('corvane', corvane_layer(384))
    put('rocks', rocks_layer(L), cell=128, n=8)
    art['layout'] = {
        'wide': {'planet': [0.86, 0.9, 0.52], 'argos': [0.58, 0.2, 0.06]},
        'tall': {'planet': [0.8, 0.88, 0.62], 'argos': [0.25, 0.2, 0.08]},
        'sun': {'day': [-1.18, -0.62], 'evening': [-1.18, -0.62], 'night': [-1.18, -0.62], 'morning': [-1.18, -0.62]},
        'sunSize': 1.4, 'band': True,
    }
elif LOOK == 'ringplane':
    # Ringplane: the view from inside the Ring. Its plane nearly edge-on, a long bright blade of dust across the whole
    # sky in front of a half-lit Ithaca I, and the near rocks drifting by in layers.
    put('sky', np.concatenate([sky_layer(2048, 1280, 0.95, 0.0, (0.85, 0.75)), np.ones((1280, 2048, 1))], -1), q=84)
    L = (0.9, -0.3, 0.3)
    img, (cx, cy) = planet_layer(RP, L, turn=0.45, open_=0.045, tilt=0.18, night_lights=0.6, pad=2.3)
    put('planet-day', img, q=84, cx=cx, cy=cy, r=RP)
    put('argos-day', moon_layer(110, L, 0.3, planetshine=0.4), cx=112, cy=112, r=110)
    put('corvane', corvane_layer(384))
    put('rocks', rocks_layer(L), cell=128, n=8)
    art['layout'] = {
        'wide': {'planet': [0.27, 0.36, 0.3], 'argos': [0.84, 0.74, 0.06]},
        'tall': {'planet': [0.4, 0.3, 0.36], 'argos': [0.8, 0.8, 0.08]},
        'sun': {'day': [4.6, 1.7], 'evening': [4.6, 1.7], 'night': [4.6, 1.7], 'morning': [4.6, 1.7]},
        'sunSize': 0.8, 'band': True, 'rocks': 16,
    }

with open(os.path.join(OUT, 'ring-art.js'), 'w') as f:
    f.write('// The Ring\'s backdrop pictures (tools/ringsky/ringsky.py writes this file; ART_GUIDE.md: Batch 40): sizes and layout.\n')
    f.write('window.RING_ART = ' + json.dumps(art, separators=(',', ':')) + ';\n')
print('wrote', os.path.relpath(os.path.join(OUT, 'ring-art.js'), ROOT))

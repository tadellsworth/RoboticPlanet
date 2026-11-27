"""Orbital platforms' backdrop: Ithaca I seen from the Accord station decks (js/orbital.js, ART_GUIDE.md, Batch 39).

Paints the layers the game draws behind the decks, ray-traced in numpy over the planet's own surface map (the
Contingency globe's art/globe/ithaca-4096.webp, so the continents are the atlas's: the Rust, Greenreach, the Bloom,
Violet Reach and the rest), with detail made up where the map runs out of pixels: relief, crinkled coasts, two
decks of cloud and their shadows, the sea's glint, the thin blue air (as the menu planet's and the globe's halo),
the Ring in the sky and its shadow bands on the ground, and the colonies' lights on the night side.

  python3 renderer/post/orbital_sky.py <out dir> [concept A|B|C] [width]

writes, for each time of day, orb-day.webp, orb-dusk.webp and orb-night.webp (the whole view, opaque), the drifting
cloud tile orb-cloud.webp (tileable, RGBA), and orbital.json (the limb circle in the picture, as fractions of its
width, for the game to clip the stars and the near clouds to; null when no limb is in view).

Concepts (the design canvas "Orbital platforms backdrop concepts"):
  A  Limb: looking out over the planet toward its curved limb, Corvane's light from the upper left (the game's key
     light), the Ring an arc in the sky above the limb. By day lit; at dusk the terminator crosses the view and
     Corvane sits on the limb; at night the colonies' lights and the Ring still sunlit overhead. (installed)
  B  Nadir: straight down through the haze onto the continents, the Ring's shadow bands across them.
  C  Terminator: facing Corvane low behind the limb, the dusk line across the view, colony lights below.
Deterministic (fixed seeds): the same command makes the same pictures.
"""
import json
import os
import sys

import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))


def load(path, mode='RGBA'):
    return np.asarray(Image.open(os.path.join(ROOT, path)).convert(mode), dtype=np.float32) / 255.0


def sample(tex, u, v):
    """Bilinear lookup, u wrapping (longitude), v clamped (latitude). u, v in 0..1."""
    h, w = tex.shape[:2]
    x = (u % 1.0) * w - 0.5
    y = np.clip(v * h - 0.5, 0, h - 1.001)
    x0 = np.floor(x).astype(np.int64)
    y0 = np.floor(y).astype(np.int64)
    fx = (x - x0)[..., None] if tex.ndim == 3 else x - x0
    fy = (y - y0)[..., None] if tex.ndim == 3 else y - y0
    x0 %= w
    x1 = (x0 + 1) % w
    y1 = np.minimum(y0 + 1, h - 1)
    a, b, c, d = tex[y0, x0], tex[y0, x1], tex[y1, x0], tex[y1, x1]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy


def hash3(ix, iy, iz, seed):
    n = (ix * 374761393 + iy * 668265263 + iz * 1274126177 + seed * 974634917) & 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    n = n ^ (n >> 16)
    return (n & 0xFFFFFF).astype(np.float32) / float(0xFFFFFF)


def vnoise3(x, y, z, seed):
    xi, yi, zi = np.floor(x), np.floor(y), np.floor(z)
    fx, fy, fz = x - xi, y - yi, z - zi
    xi, yi, zi = xi.astype(np.int64), yi.astype(np.int64), zi.astype(np.int64)
    s = lambda t: t * t * (3 - 2 * t)
    u, v, w = s(fx), s(fy), s(fz)
    def h(a, b, c):
        return hash3(xi + a, yi + b, zi + c, seed)
    l0 = (h(0, 0, 0) * (1 - u) + h(1, 0, 0) * u) * (1 - v) + (h(0, 1, 0) * (1 - u) + h(1, 1, 0) * u) * v
    l1 = (h(0, 0, 1) * (1 - u) + h(1, 0, 1) * u) * (1 - v) + (h(0, 1, 1) * (1 - u) + h(1, 1, 1) * u) * v
    return l0 * (1 - w) + l1 * w


def fbm3(p, freq, octaves, seed, gain=0.5):
    x, y, z = p[..., 0] * freq, p[..., 1] * freq, p[..., 2] * freq
    tot, amp, norm = 0.0, 1.0, 0.0
    for o in range(octaves):
        tot = tot + amp * vnoise3(x, y, z, seed + o * 31)
        norm += amp
        amp *= gain
        x, y, z = x * 2.03 + 17.1, y * 2.03 + 3.7, z * 2.03 + 11.3
    return tot / norm


def ss(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def norm(v):
    return v / np.linalg.norm(v, axis=-1, keepdims=True)


def dot(a, b):
    return np.sum(a * b, axis=-1)


def basis(lat, lon):
    """Up, north and east at a point on the unit sphere (degrees)."""
    la, lo = np.radians(lat), np.radians(lon)
    up = np.array([np.cos(la) * np.cos(lo), np.cos(la) * np.sin(lo), np.sin(la)])
    east = np.array([-np.sin(lo), np.cos(lo), 0.0])
    north = np.cross(up, east)
    return up, north, east


# The Ring (as js/ring.js draws it: rspRing's bands, radius in planet radii, width, opacity), round Ithaca I's
# equator, its plane tilted a little from the planet's turning (the ringfall belt swings: LORE.md).
RING_BANDS = [(1.92, 0.09, 0.16), (1.81, 0.04, 0.46), (1.69, 0.07, 0.3), (1.56, 0.03, 0.18), (1.46, 0.05, 0.24)]
RING_AXIS = norm(np.array([0.0, np.sin(0.32), np.cos(0.32)]))


def ring_density(r):
    d = np.zeros_like(r)
    for rk, wk, a in RING_BANDS:
        d = d + min(1.0, a * 1.8) * np.exp(-((r - rk) / (wk * 0.6)) ** 2)
    grooves = 0.75 + 0.25 * np.sin(r * 310.0) * np.sin(r * 87.0)
    return np.clip(d * grooves, 0, 1) * (r > 1.4) * (r < 2.0)


# The views. Camera: over (lat, lon) at height h (planet radii), heading (degrees east of north) and pitch (degrees
# below the horizontal); the field of view across. Sun per time of day as (azimuth from the camera's heading, degrees
# clockwise, and elevation above the local horizontal at the camera's foot).
CONCEPTS = {
    'A': dict(lat=-32.0, lon=-108.0, heading=42.0, h=0.32, pitch=55.0, fov=64.0,
              sun={'day': (-62.0, 48.0), 'dusk': (-38.0, -26.0), 'night': (-30.0, -74.0)}),
    'B': dict(lat=-10.0, lon=-90.0, heading=0.0, h=0.42, pitch=90.0, fov=58.0,
              sun={'day': (-30.0, 35.0), 'dusk': (-60.0, 4.0), 'night': (-60.0, -45.0)}),
    'C': dict(lat=18.0, lon=60.0, heading=95.0, h=0.30, pitch=52.0, fov=66.0,
              sun={'day': (8.0, -14.0), 'dusk': (6.0, -33.0), 'night': (4.0, -58.0)}),
}

AIR = np.array([0.36, 0.62, 1.0], dtype=np.float32)        # the blue of the air (the Contingency globe's halo)
DUSK = np.array([1.0, 0.52, 0.24], dtype=np.float32)       # the low sun through the air
LIGHTS = np.array([1.0, 0.74, 0.40], dtype=np.float32)     # colony lights (sodium, as light-sodium)
RINGC = np.array([0.96, 0.90, 0.81], dtype=np.float32)     # the Ring's ivory (rspRing)
SPACE_TOP = np.array([0.008, 0.012, 0.04], dtype=np.float32)
SPACE_LOW = np.array([0.014, 0.03, 0.08], dtype=np.float32)


def render(concept, tod, W, H, tex):
    C = CONCEPTS[concept]
    up0, n0, e0 = basis(C['lat'], C['lon'])
    hd = np.radians(C['heading'])
    fwd_h = np.cos(hd) * n0 + np.sin(hd) * e0              # the camera's heading along the ground
    right = np.cross(fwd_h, up0)
    pt = np.radians(C['pitch'])
    f = np.cos(pt) * fwd_h - np.sin(pt) * up0
    upc = np.cross(right, f)
    o = up0 * (1 + C['h'])
    tx = np.tan(np.radians(C['fov']) / 2)
    ty = tx * H / W
    sx = (np.arange(W) + 0.5) / W * 2 - 1
    sy = 1 - (np.arange(H) + 0.5) / H * 2
    SX, SY = np.meshgrid(sx, sy)
    d = norm(f[None, None, :] + SX[..., None] * tx * right + SY[..., None] * ty * upc)
    az, el = np.radians(C['sun'][tod][0]), np.radians(C['sun'][tod][1])
    L = norm(np.cos(el) * (np.cos(az) * fwd_h + np.sin(az) * right) + np.sin(el) * up0)

    b = dot(d, o)
    c = dot(o, o) - 1
    disc = b * b - c
    hit = (disc > 0) & (b < 0)
    th = np.where(hit, -b - np.sqrt(np.maximum(disc, 0)), 0)
    p = o + d * th[..., None]
    pn = norm(np.where(hit[..., None], p, d))

    # (texture coordinates of the ground, crinkled a little at middle scale so coasts aren't the map's soft edge)
    lat = np.arcsin(np.clip(pn[..., 2], -1, 1))
    lon = np.arctan2(pn[..., 1], pn[..., 0])
    wu = (fbm3(pn, 60, 4, 101) - 0.5) * 0.006
    wv = (fbm3(pn, 60, 4, 202) - 0.5) * 0.006
    u = lon / (2 * np.pi) + 0.5 + wu
    v = 0.5 - lat / np.pi + wv
    g = sample(tex['globe'], u, v)
    alb = g[..., :3] ** 2.2
    land = np.clip((g[..., 3] - 224 / 255) / (31 / 255), 0, 1)
    sea = 1 - land

    mu = dot(pn, L)
    day = ss(-0.06, 0.16, mu)
    lam = np.clip(mu, 0, 1) ** 0.9

    # Relief: a made-up height field, lit from the sun (shade = slope toward the light).
    Lt = norm(L - pn * mu[..., None] + 1e-6)
    hgt = fbm3(pn, 260, 5, 303)
    hgt2 = fbm3(pn + Lt * 0.0016, 260, 5, 303)
    relief = 1 + (hgt - hgt2) * 3.5 * land
    grain = 0.9 + 0.2 * fbm3(pn, 900, 3, 404)
    alb = alb * (1 + (grain[..., None] - 1) * land[..., None]) * relief[..., None].clip(0.5, 1.6)

    # Clouds: the globe's cloud map for where the weather is, detail for its shape; shadows cast toward the sun's away side.
    cmap = sample(tex['clouds'], u, v)[..., 0]
    def cover(q):
        n = fbm3(q, 22, 6, 505)
        return ss(0.46, 0.68, n * 0.74 + cmap * 0.5 + 0.03)
    cl = cover(pn)
    csh = cover(norm(pn + Lt * 0.006))
    # Ring shadow on the ground.
    den = np.abs(dot(L, RING_AXIS)) + 1e-4
    tr = -dot(pn, RING_AXIS) / np.where(np.abs(dot(L, RING_AXIS)) < 1e-4, 1e-4, dot(L, RING_AXIS))
    qr = pn + L * tr[..., None]
    rshadow = np.clip(ring_density(np.linalg.norm(qr, axis=-1)) * 1.3, 0, 0.9) * (tr > 0)
    _ = den
    light = lam * (1 - rshadow) * (1 - 0.55 * csh)
    twi = np.exp(-((mu - 0.02) / 0.09) ** 2)               # the band along the terminator, lit through the most air
    sunc = 1.0 * (1 - twi[..., None]) + DUSK * twi[..., None]
    ground = alb * (light[..., None] * sunc * 1.25 + 0.003)
    # the sea's glint
    hv = norm(L - d)
    spec = np.clip(dot(pn, hv), 0, 1) ** 500 * 1.4 * sea * day * (1 - cl)
    ground = ground + spec[..., None] * sunc
    # cloud on top
    ccol = (np.clip(mu, 0, 1)[..., None] ** 0.7 * 1.05 * sunc + 0.002) * (1 - rshadow[..., None] * 0.8)
    ground = ground * (1 - cl[..., None] * 0.92) + ccol * cl[..., None] * 0.92

    # Night: the colonies' lights (the atlas's lights for where; small towns and roads for the grain).
    hub = sample(tex['lights'], u, v)
    fine = fbm3(pn, 2200, 3, 606)
    town = ss(0.86 - 0.22 * hub, 0.95 - 0.18 * hub, fine) * (0.5 + 0.5 * hub)   # (dense streets in a town's heart, thinning out)
    far = ss(0.86, 0.93, fbm3(pn, 260, 3, 808)) * ss(0.7, 0.85, fine) * 0.5   # (a lone outpost now and then)
    lights = (town * ss(0.03, 0.25, hub) + far) * land * (1 - ss(-0.12, 0.02, mu)) * (1 - cl * 0.7)
    # (each town a soft glow round its streets, as it shows from orbit)
    from PIL import ImageFilter
    lim = Image.fromarray((np.clip(lights, 0, 1) * 255).astype(np.uint8), 'L')
    glow = np.asarray(lim.filter(ImageFilter.GaussianBlur(max(2, W / 400))), dtype=np.float32) / 255
    ground = ground + LIGHTS[None, None, :] * (lights * 0.8 + glow * 2.2)[..., None]
    # (the Ring's light on the night side: a faint cool ambient)
    ground = ground + (alb * 0.5 + cl[..., None] * 0.3) * np.array([0.006, 0.009, 0.016]) * (1 - day)[..., None]

    # The air: thicker toward the limb; blue where lit, warm at the terminator.
    ra = 1.035
    c2 = dot(o, o) - ra * ra
    disc2 = b * b - c2
    tin = -b - np.sqrt(np.maximum(disc2, 0))
    path = np.where(hit, th - np.maximum(tin, 0), 0)
    tau = path / 0.035
    haze = 1 - np.exp(-tau * 0.17)
    airlit = ss(-0.18, 0.25, mu)
    aircol = AIR * 0.55 * (1 - twi[..., None]) + DUSK * 0.6 * twi[..., None]
    out = ground * (1 - haze[..., None] * 0.85) + aircol * (haze * airlit)[..., None]

    # Space where the ray misses: the deep sky, the limb's glow, the Ring, Corvane.
    perp = np.sqrt(np.maximum(dot(o, o) - b * b, 0))
    alt = np.clip(perp - 1, 0, None)
    ahead = b < 0
    tang = norm(o + d * (-b)[..., None])
    mut = dot(tang, L)
    glow_l = ss(-0.35, 0.3, mut)
    fwd = np.clip(dot(d, L), 0, 1) ** 6                   # (toward the sun the air lights up brightest: dusk)
    gl = (np.exp(-alt / 0.004) * 0.9 + np.exp(-alt / 0.016) * 0.35 + np.exp(-alt / 0.05) * 0.08) * ahead
    gcol = AIR[None, None, :] * (glow_l * (1 - fwd * 0.6))[..., None] + DUSK[None, None, :] * (fwd * 1.6 * ss(-0.4, 0.05, mut))[..., None]
    t01 = (SY * 0.5 + 0.5)[..., None]
    space = SPACE_TOP * t01 + SPACE_LOW * (1 - t01)
    space = space + gcol * gl[..., None]
    # Ring: where the ray meets the ring plane in front, not behind the planet; lit unless in the planet's shadow.
    dr = dot(d, RING_AXIS)
    tp = -dot(o, RING_AXIS) / np.where(np.abs(dr) < 1e-6, 1e-6, dr)
    q = o + d * tp[..., None]
    rr = np.linalg.norm(q, axis=-1)
    rd = ring_density(rr) * (tp > 0) * (~hit | (tp < th))
    bq = dot(q, L)
    shad = (bq < 0) & (dot(q, q) - bq * bq < 1)
    ringlit = np.where(shad, 0.03, 1.0) * 0.85
    rgrain = 0.85 + 0.3 * vnoise3(rr * 900, rr * 3.1, rr * 0.7, 909)
    ringcol = RINGC * (ringlit * rgrain)[..., None]
    ra_ = (rd * 0.78)[..., None]
    out_hit = out
    out = np.where(hit[..., None], out_hit, space)
    out = out * (1 - ra_) + ringcol * ra_
    # Corvane: a small hot disc and its glare, where it's in view and not behind the planet.
    cosang = dot(d, L)
    ang = np.arccos(np.clip(cosang, -1, 1))
    tl = dot(o, L)
    sunhid = (dot(o, o) - tl * tl < 1) and (tl < 0)
    sunv = 0.0 if sunhid else 1.0
    glare = (np.exp(-ang / 0.006) * 6 + np.exp(-ang / 0.04) * 0.6 + np.exp(-ang / 0.18) * 0.12) * sunv
    out = out + np.array([1.0, 0.78, 0.55]) * glare[..., None]

    # Tone: a soft shoulder, then back to sRGB.
    out = 1 - np.exp(-out * 1.6)
    out = np.clip(out, 0, 1) ** (1 / 2.2)
    img = (out * 255 + 0.5).astype(np.uint8)
    return img, hit


def limb_circle(hit):
    """The limb as a circle through its top at three columns (fractions of the width), or None."""
    H, W = hit.shape
    pts = []
    for fx in (0.04, 0.5, 0.96):
        col = hit[:, int(fx * (W - 1))]
        if not col.any() or col.all():
            return None
        y = int(np.argmax(col))
        pts.append((fx * W, float(y)))
    (x1, y1), (x2, y2), (x3, y3) = pts
    a = np.array([[x2 - x1, y2 - y1], [x3 - x1, y3 - y1]], dtype=np.float64) * 2
    bb = np.array([x2 ** 2 - x1 ** 2 + y2 ** 2 - y1 ** 2, x3 ** 2 - x1 ** 2 + y3 ** 2 - y1 ** 2])
    try:
        cx, cy = np.linalg.solve(a, bb)
    except np.linalg.LinAlgError:
        return None
    r = float(np.hypot(x1 - cx, y1 - cy))
    return {'cx': round(cx / W, 5), 'cy': round(cy / W, 5), 'r': round(r / W, 5), 'top': round(y2 / H, 5)}


def atlas_lights():
    """The atlas's night lights (art/lore/ithaca-map.webp's alpha: 255 none, 254 down to 225 ever brighter, as
    mplAtlas reads it), spread a little so a town is a glow the speckle of streets can sit in."""
    from PIL import ImageFilter
    a = np.asarray(Image.open(os.path.join(ROOT, 'art/lore/ithaca-map.webp')).convert('RGBA'))[..., 3].astype(np.float32)
    lit = np.where((a < 255) & (a >= 200), np.clip((140 + (254 - a) * 4) / 255, 0, 1), 0)
    im = Image.fromarray((lit * 255).astype(np.uint8), 'L').resize((1024, 512), Image.BILINEAR).filter(ImageFilter.GaussianBlur(3))
    m = np.asarray(im, dtype=np.float32) / 255
    return np.clip(m / max(1e-3, m.max()) * 1.6, 0, 1)


def cloud_tile(size, seed=4711):
    """The near deck of cloud that drifts under the decks: tileable, white, its underside shaded, on transparent."""
    def per_noise(per, s):
        lat = np.array([[hash3(np.int64(i % per), np.int64(j % per), np.int64(0), s) for i in range(per + 1)] for j in range(per + 1)], dtype=np.float32)
        x = np.arange(size) / size * per
        xi = np.floor(x).astype(int)
        fx = x - xi
        fx = fx * fx * (3 - 2 * fx)
        X0, Y0 = np.meshgrid(xi, xi)
        FX, FY = np.meshgrid(fx, fx)
        a, b2, c2, d2 = lat[Y0, X0], lat[Y0, X0 + 1], lat[Y0 + 1, X0], lat[Y0 + 1, X0 + 1]
        return (a * (1 - FX) + b2 * FX) * (1 - FY) + (c2 * (1 - FX) + d2 * FX) * FY
    v = np.zeros((size, size), np.float32)
    amp, tot = 1.0, 0.0
    per = 5
    for o in range(6):
        v += amp * per_noise(per, seed + o * 13)
        tot += amp
        amp *= 0.5
        per *= 2
    v /= tot
    a = ss(0.5, 0.68, v)
    # lit from the upper left: lighter where the field rises toward the light
    sh = np.roll(np.roll(v, 3, axis=0), 3, axis=1)
    lightk = np.clip(0.82 + (v - sh) * 6, 0.62, 1.05)
    rgb = np.stack([lightk * 0.97, lightk * 0.98, lightk * 1.0], -1)
    img = np.concatenate([np.clip(rgb, 0, 1), a[..., None] * 0.92], -1)
    return (img * 255 + 0.5).astype(np.uint8)


def main():
    out = sys.argv[1]
    concept = (sys.argv[2] if len(sys.argv) > 2 else 'A').upper()
    W = int(sys.argv[3]) if len(sys.argv) > 3 else 2048
    H = W * 5 // 8
    os.makedirs(out, exist_ok=True)
    tex = {
        'globe': load('art/globe/ithaca-4096.webp'),
        'clouds': load('art/globe/ithaca-clouds.webp', 'RGB'),
        'lights': atlas_lights(),
    }
    meta = None
    for tod in ('day', 'dusk', 'night'):
        img, hit = render(concept, tod, W, H, tex)
        Image.fromarray(img, 'RGB').save(os.path.join(out, f'orb-{tod}.webp'), quality=84, method=6)
        if tod == 'day':
            meta = limb_circle(hit)
        print(out, concept, tod, 'done', flush=True)
    Image.fromarray(cloud_tile(1024 if W >= 1024 else 256), 'RGBA').save(os.path.join(out, 'orb-cloud.webp'), quality=80, method=6)
    info = {'concept': concept, 'w': W, 'h': H, 'limb': meta, 'cloud': 1024 if W >= 1024 else 256}
    with open(os.path.join(out, 'orbital.json'), 'w') as fh:
        json.dump(info, fh)
    # the list the game loads (js/orbital.js, ensureOrbArt; in the one-file build, dist/orbital-art.js with the pictures in it)
    with open(os.path.join(out, 'orbital-art.js'), 'w') as fh:
        fh.write('// Orbital platforms\' backdrop (renderer/post/orbital_sky.py writes this file; ART_GUIDE.md, Batch 39): the layers and the limb.\n')
        fh.write('window.ORBITAL_ART = ' + json.dumps({**info, 'names': ['orb-day', 'orb-dusk', 'orb-night', 'orb-cloud']}) + ';\n')


if __name__ == '__main__':
    main()

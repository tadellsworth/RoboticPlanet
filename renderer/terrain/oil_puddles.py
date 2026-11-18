"""Proposed oil seep puddles (IDEAS.md: "A new look for the oil seeps"): a puddle of crude drawn as one shape across a
seep's tiles, after the owner's reference picture: glossy, jet black, a soft wavy outline of lobes and pinched waists
(no straight edges), a few separate round droplets and smaller puddles beside it, light-grey sheen patches inside, and
a thin bright white highlight along the lower (front) rim, as if lit from above and behind. Nothing here is game code.

The puddle is built from the seep's tiles the way drawSeep (js/render.js) builds its shape: a disc on each oil tile,
smaller as the tile is pumped dry, bridged to its oil neighbours; the union is then wobbled by low-frequency noise into
lobes and waists, and droplets are scattered just outside it. The shading comes from the shape itself (the distance to
its edge and the direction the edge faces), so any layout of tiles gets the right rim light and sheen, and a seep
drying up keeps its look while its wet area shrinks and a dark stain of where it was remains.

Three directions, all the same kind of puddle, differing in character:
    a  Fresh spill:    one big smooth puddle, few wide lobes, two or three droplets, strong white rim, mirror-like sheen
    b  Spattered seep: more lobes and tighter waists, a trail of droplets and small puddles off one side, spotty sheen;
                       half pumped it breaks into separate pools
    c  Still pool:     fat and round, soft sheen like a reflected sky, one or two big drops, a wide damp ring round it
                       that stays as a stain as it is pumped dry

    render_puddle(tiles, T, v, seed) -> Puddle   tiles: {(i, j): fill 0..1}; T px a tile; v 'a' | 'b' | 'c'
A Puddle has, in a box round the seep (x0, y0 are the box's pixel offset on the map):
    stain  RGBA  the damp dark ground under and round the puddle (drawn first, over the ground)
    body   RGBA  the puddle itself, droplets included, shaded for the day
    gleam  RGBA  its light at night: the rim highlight and the sheen as a faint cool gleam, added after the night grade
"""
import numpy as np
from scipy import ndimage

S = 4   # supersample

DIRS = {
    #       disc  bridge warp  wfreq lobe  drops          dropR         trail hl    hlw  sheen  sheenK  ring  ringA  grad
    'a': dict(disc=1.10, bridge=0.95, warp=0.09, wfreq=0.55, lobe=0.10, drops=(2, 3), dropr=(0.05, 0.10), trail=0.0,
              hl=1.00, hlw=1.15, sheen=(0.30, 0.62), sheenk=1.0, ring=0.04, ringa=0.25, grad=0.08),
    'b': dict(disc=0.98, bridge=0.66, warp=0.15, wfreq=0.95, lobe=0.16, drops=(6, 8), dropr=(0.03, 0.13), trail=1.0,
              hl=0.85, hlw=0.95, sheen=(0.45, 0.52), sheenk=0.85, ring=0.03, ringa=0.22, grad=0.03),
    'c': dict(disc=1.16, bridge=1.05, warp=0.07, wfreq=0.40, lobe=0.07, drops=(1, 2), dropr=(0.08, 0.13), trail=0.0,
              hl=0.75, hlw=1.35, sheen=(0.22, 0.75), sheenk=0.75, ring=0.20, ringa=0.42, grad=0.12),
}
BODY = np.array([0x0e, 0x0e, 0x11], np.float32) / 255           # jet black, a touch cool
BODY_DRY = np.array([0x17, 0x13, 0x0f], np.float32) / 255       # drying crude goes a little brown
SHEEN = np.array([0x50, 0x50, 0x55], np.float32) / 255
GLEAM = np.array([0xb8, 0xc8, 0xff], np.float32) / 255


class Puddle:
    def __init__(self, x0, y0, stain, body, gleam, wet):
        self.x0, self.y0, self.stain, self.body, self.gleam, self.wet = x0, y0, stain, body, gleam, wet


def _noise(rng, H, W, sig, octaves=3, gain=0.5):
    """smooth noise, roughly unit variance, feature size about `sig` px (made small and scaled up, so big features are cheap)"""
    k = max(1, int(sig / 3))                                           # work at a scale where sig is about 3 px
    h, w = H // k + 2, W // k + 2
    out = np.zeros((h, w), np.float32); amp = 1.0; tot = 0.0; sg = sig / k
    for _ in range(octaves):
        n = ndimage.gaussian_filter(rng.standard_normal((h, w)).astype(np.float32), sg, truncate=3.0)
        out += amp * n / (n.std() + 1e-6); tot += amp; amp *= gain; sg = max(0.7, sg / 2)
    out /= tot
    if k == 1:
        return out[:H, :W]
    return ndimage.zoom(out, k, order=1)[:H, :W]


def _down(a):
    """average S x S"""
    H, W = a.shape[0] // S, a.shape[1] // S
    return a[:H * S, :W * S].reshape(H, S, W, S, *a.shape[2:]).mean(axis=(1, 3))


def _sstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def _shape(tiles, T, d, rng, H, W, ox, oy):
    """the seep's full shape at S x: a disc on each tile (its size and place jittered), a lobe or two off each, bridges
    to its neighbours, all wobbled by low-frequency noise into a soft outline of lobes and pinched waists"""
    from PIL import Image, ImageDraw
    TS = T * S
    m = Image.new('L', (W, H), 0); dr = ImageDraw.Draw(m)
    have = {k: min(1.0, v) for k, v in tiles.items()}
    cen = {}
    for (i, j), f in have.items():
        cen[(i, j)] = ((i + 0.5 - ox + rng.uniform(-0.1, 0.1)) * TS, (j + 0.5 - oy + rng.uniform(-0.1, 0.1)) * TS)
    for (i, j), f in have.items():
        r = (0.30 + 0.17 * f) * d['disc'] * TS * rng.uniform(0.88, 1.12)
        cx, cy = cen[(i, j)]
        dr.ellipse((cx - r, cy - r * 0.86, cx + r, cy + r * 0.86), fill=255)
        for _ in range(2):                                            # lobes: smaller discs pushed out from the side
            a = rng.uniform(0, 2 * np.pi); rl = r * rng.uniform(0.38, 0.55); off = r * rng.uniform(0.7, 0.95)
            lx, ly = cx + np.cos(a) * off, cy + np.sin(a) * off * 0.86
            dr.ellipse((lx - rl, ly - rl * 0.86, lx + rl, ly + rl * 0.86), fill=255)
        for di, dj in ((1, 0), (0, 1), (1, 1), (1, -1)):
            if (i + di, j + dj) in have:
                f2 = have[(i + di, j + dj)]
                w = r * d['bridge'] * (0.95 if di * dj == 0 else 0.6) * (0.5 + 0.5 * min(f, f2))
                nx, ny = cen[(i + di, j + dj)]
                dr.line((cx, cy, nx, ny), fill=255, width=max(1, int(w * 2)))
    a = np.asarray(m).astype(np.float32) / 255
    a = ndimage.gaussian_filter(a, TS * 0.07)
    # domain warp: push the soft edge about by smooth noise, then add lobes with another, and threshold
    amp = d['warp'] * TS * 1.5; sig = TS / (2.2 * d['wfreq'])
    nx, ny = _noise(rng, H, W, sig), _noise(rng, H, W, sig)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    a = ndimage.map_coordinates(a, [yy + ny * amp, xx + nx * amp], order=1, mode='nearest')
    a = a + d['lobe'] * _noise(rng, H, W, sig * 0.7)
    return _sstep(0.46, 0.54, a)


def _droplets(mask, T, d, rng, H, W, tiles, ox, oy, f):
    """round droplets and small puddles scattered just outside the shape; the trail (b) runs off one side"""
    from PIL import Image, ImageDraw
    TS = T * S
    n = int(rng.integers(d['drops'][0], d['drops'][1] + 1))
    n = max(1, int(round(n * (0.5 + 0.5 * f))))
    dout = ndimage.distance_transform_edt(mask < 0.5)
    ys, xs = np.nonzero(mask > 0.5)
    if len(xs) == 0:
        return mask
    cx, cy = xs.mean(), ys.mean()
    im = Image.fromarray((mask * 255).astype(np.uint8)); dr = ImageDraw.Draw(im)
    trail_ang = rng.uniform(0, 2 * np.pi)
    placed = 0; tries = 0
    while placed < n and tries < 400:
        tries += 1
        r = rng.uniform(*d['dropr']) * TS * (0.7 + 0.3 * f)
        if d['trail'] and rng.uniform() < 0.7:
            ang = trail_ang + rng.normal(0, 0.35)
            if placed == 0: r = max(r, 0.11 * TS)                    # the trail starts with a small puddle
        else:
            ang = rng.uniform(0, 2 * np.pi)
        gap = rng.uniform(0.06, 0.3) * TS + r
        # walk out from the centroid along ang until clear of the shape, then the gap
        px, py = cx, cy
        step = TS * 0.05
        while 0 <= px < W and 0 <= py < H and mask[int(py), int(px)] > 0.5:
            px += np.cos(ang) * step; py += np.sin(ang) * step
        px += np.cos(ang) * gap; py += np.sin(ang) * gap
        if not (r + 2 <= px < W - r - 2 and r + 2 <= py < H - r - 2):
            continue
        if dout[int(py), int(px)] < r + 0.05 * TS:
            continue
        sq = rng.uniform(0.72, 0.9)
        dr.ellipse((px - r, py - r * sq, px + r, py + r * sq), fill=255)
        if r > 0.09 * TS:                                             # a small puddle: give it a lobe or two
            for _ in range(2):
                a2 = rng.uniform(0, 2 * np.pi); r2 = r * rng.uniform(0.45, 0.7)
                qx, qy = px + np.cos(a2) * r * 0.6, py + np.sin(a2) * r * 0.5
                dr.ellipse((qx - r2, qy - r2 * sq, qx + r2, qy + r2 * sq), fill=255)
        dout = ndimage.distance_transform_edt(np.asarray(im) < 128)
        placed += 1
    a = np.asarray(im).astype(np.float32) / 255
    a = ndimage.gaussian_filter(a, 1.2)
    return _sstep(0.4, 0.6, a)


def render_puddle(tiles, T, v, seed=1, fscale=1.0, margin=1.1):
    """see the module docstring. fscale multiplies every tile's fill (1 full, 0.5 half pumped, 0.12 nearly dry)."""
    d = DIRS[v]
    rng = np.random.default_rng(seed * 7919 + ord(v))
    ii = [i for i, _ in tiles]; jj = [j for _, j in tiles]
    ox, oy = min(ii) - margin, min(jj) - margin
    Wt, Ht = max(ii) + 1 + margin - ox, max(jj) + 1 + margin - oy
    TS = T * S
    H, W = int(Ht * TS), int(Wt * TS)
    f = float(np.clip(fscale, 0, 1))
    # the shape when full (for the stain of where it was) and the wet shape now
    full = _shape(tiles, T, d, rng, H, W, ox, oy)
    dfull = ndimage.distance_transform_edt(full > 0.5).astype(np.float32)
    if f < 0.999:                                                     # pumped: the wet area draws in from the edge, unevenly, keeping round lobes
        e = (1 - np.sqrt(f)) * dfull.max() * (1 + 0.35 * _noise(rng, H, W, TS * 0.3, octaves=2))
        wet = ndimage.gaussian_filter((dfull > e).astype(np.float32), TS * 0.05)
        wet = _sstep(0.45, 0.55, wet + 0.08 * _noise(rng, H, W, TS * 0.2, octaves=2)) * full
    else:
        wet = full
    wet = _droplets(wet, T, d, rng, H, W, tiles, ox, oy, f)
    # ---- shading
    din = ndimage.distance_transform_edt(wet > 0.5).astype(np.float32)
    soft = ndimage.gaussian_filter(wet, 1.5)
    gy = ndimage.sobel(soft, axis=0); gx = ndimage.sobel(soft, axis=1)
    gn = np.sqrt(gx * gx + gy * gy) + 1e-6
    face_down = np.clip(-gy / gn, 0, 1)                               # the edge faces the viewer (outward normal points down)
    face_up = np.clip(gy / gn, 0, 1)
    # the white rim light on the lower edge: a thin band just inside the edge; thinner and dimmer as it dries
    px = max(1.0, T / 48)
    d0, dw = 1.0 * S * px * d['hlw'], 0.85 * S * px * d['hlw']
    band = np.exp(-((din - d0) / dw) ** 2) * (din > 0.3)
    hl = band * np.clip(face_down * 1.35 - 0.1, 0, 1) * d['hl'] * (0.5 + 0.5 * f) * 1.25
    hl = ndimage.gaussian_filter(hl, 0.8)
    # a fainter grey line on the top edge, and an inner dark edge under the top rim (depth)
    top = np.exp(-((din - 0.7 * S * px) / (0.7 * S * px)) ** 2) * face_up ** 2 * 0.22 * (din > 0.3)
    # sheen patches: light grey, soft, lying toward the top of the puddle, well inside the edge
    yy = np.mgrid[0:H, 0:W][0].astype(np.float32) / H
    ys, xs = np.nonzero(wet > 0.5)
    if len(ys):
        y0, y1 = ys.min(), ys.max()
        rel = np.clip((np.arange(H)[:, None] - y0) / max(1, y1 - y0), 0, 1).astype(np.float32) * np.ones((1, W), np.float32)
    else:
        rel = yy
    sig = TS * (0.30 if v == 'c' else 0.22 if v == 'a' else 0.13)
    sn = _noise(rng, H // 2 + 1, W, sig, octaves=2)
    sn = ndimage.zoom(sn, (2, 1), order=1)[:H, :W] + d['sheen'][1] * (0.5 - rel) * 2.2
    inner = _sstep(1.5 * S * px, 4.5 * S * px, din)
    th = 0.9 - d['sheen'][0] * 1.2
    sheen = _sstep(th, th + 0.35, sn) * inner
    sheen = ndimage.gaussian_filter(sheen, 1.5 * S * px * (1.8 if v == 'c' else 1.0)) * d['sheenk'] * (0.5 + 0.5 * f)
    # a few sharp little specks in the sheen (a)
    specks = np.zeros_like(wet)
    if v == 'a' and len(ys):
        for _ in range(3):
            k = int(rng.integers(0, len(ys)))
            if inner[ys[k], xs[k]] > 0.8 and sheen[ys[k], xs[k]] > 0.1:
                specks[ys[k], xs[k]] = 1
        specks = ndimage.gaussian_filter(specks, 1.2 * S * px) * 10
    # body colour: a mirror gradient (lighter where it reflects the sky, up), browner as it dries
    body_c = BODY * f + BODY_DRY * (1 - f)
    col = np.empty((H, W, 3), np.float32); col[:] = body_c
    col += (0.5 - rel)[..., None] * d['grad'] * (0.6 + 0.4 * f)
    col = col + (SHEEN - col) * sheen[..., None]
    col = col + (np.array([0.42, 0.42, 0.45]) - col) * top[..., None]
    col = col + (1 - col) * np.clip(hl + specks, 0, 1)[..., None]
    col = np.clip(col, 0, 1)
    # the stain: the damp ground round the puddle, and the dark mark of where the full puddle lay
    dring = ndimage.distance_transform_edt(wet < 0.5).astype(np.float32)
    blot = 0.8 + 0.35 * _noise(rng, H, W, TS * 0.25, octaves=2)
    ring = np.exp(-(dring / (d['ring'] * TS + 3)) ** 1.2) * (1 - wet) * d['ringa'] * np.clip(blot, 0.4, 1.2)
    was = ndimage.gaussian_filter(full, 0.06 * TS) * (1 - wet)       # the mark of where the full puddle lay
    stain_a = np.clip(ring + was * (0.14 + 0.12 * (1 - f)) * np.clip(blot, 0.5, 1.2), 0, 0.5)
    stain = np.dstack([np.full_like(wet, 0x14 / 255), np.full_like(wet, 0x0e / 255), np.full_like(wet, 0x0a / 255), stain_a])
    body = np.dstack([col, wet])
    gleam_a = np.clip(hl * 0.32 + sheen * 0.06 + specks * 0.2, 0, 1) * wet
    gleam = np.dstack([np.broadcast_to(GLEAM, (H, W, 3)).astype(np.float32), gleam_a])
    return Puddle(int(ox * T), int(oy * T), _down(stain), _down(body), _down(gleam), _down(wet))


if __name__ == '__main__':
    import os
    from PIL import Image
    out = 'out/res'; os.makedirs(out, exist_ok=True)
    tiles = {(0, 0): 1, (1, 0): 1, (-1, 0): 1, (0, 1): 1, (0, -1): 1}
    for v in 'abc':
        for f in (1.0, 0.5, 0.12):
            p = render_puddle(tiles, 96, v, 3, f)
            bg = np.ones(p.body.shape[:2] + (3,), np.float32) * np.array([0.78, 0.55, 0.33])
            for lay in (p.stain, p.body):
                bg = bg * (1 - lay[..., 3:]) + lay[..., :3] * lay[..., 3:]
            Image.fromarray((bg * 255 + 0.5).astype(np.uint8)).save(f'{out}/puddle-{v}-{f}.png')
    print('puddles ok')

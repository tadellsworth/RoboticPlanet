"""Extra plant helpers for the Volcanic and Lunar sets (on top of r3d / plants_common).

- GScene + glowing(): tag parts that glow (ember tips, a vent's mouth). render_plant() bakes them
  bright into the day art and writes plant-N-glow.png (transparent except the glowing bits).
- facet_rock(): angular, flat-shaded rocks from a convex hull (not round boulders).
- ground decals: craters and dust drawn as light/shade over whatever ground they sit on.
- render_plant(): renders, composites decals under / effects over, checks the canvas edges.
"""
import os
from contextlib import contextmanager
import numpy as np
from scipy import ndimage
from scipy.spatial import ConvexHull
from PIL import Image
import r3d
from plants_common import *


class GScene(Scene):
    """A Scene that remembers which faces glow (S.glow = (night, day) intensity for parts added next)
    and which vertices fade out (add(..., fade=per-vertex 0..1): ground patches feathered at the rim)."""

    def __init__(self):
        super().__init__()
        self.glow = (0.0, 0.0, None)
        self.gn, self.gd, self.fv, self.ec = [], [], [], []

    def add(self, V, F, A, normals=None, fade=None):
        super().add(V, F, A, normals)
        self.gn.append(np.full(len(F), float(self.glow[0])))
        self.gd.append(np.full(len(F), float(self.glow[1])))
        self.fv.append(np.zeros(len(V)) if fade is None else np.asarray(fade, float))
        # emissive colour per vertex: the glowing() colour, else the part's own colour
        self.ec.append(np.broadcast_to(C(self.glow[2]), (len(V), 3)).copy() if self.glow[2] is not None
                       else np.asarray(A[:, 0:3], float).copy())

    def glow_arrays(self):
        return np.concatenate(self.gn), np.concatenate(self.gd)

    def fade_array(self):
        return np.concatenate(self.fv)

    def emissive_array(self):
        return np.concatenate(self.ec)


@contextmanager
def glowing(S, night=1.0, day=0.85, col=None):
    """Parts added inside glow: `night` strength in plant-N-glow.png, `day` = how much the emissive
    colour (`col`, or the part's own colour) replaces the lit colour in the day art."""
    old = S.glow
    S.glow = (night, day, col)
    try:
        yield
    finally:
        S.glow = old


def facet_rock(S, center, size, rng, npts=12, yaw=0.0, pitch=0.0, roll=0.0, col='#3a3c40', col2='#55575c',
               mat=7, spec=0.18, gloss=18, snow=0.0, zmin=0.0, jitter=0.3, tone=0.12, trans=0.0):
    """An angular rock: the convex hull of a few random points, flat shaded, each facet a touch different."""
    P = rng.normal(size=(npts, 3))
    P /= np.linalg.norm(P, axis=1, keepdims=True)
    P *= 1 + jitter * rng.uniform(-1, 1, (npts, 1))
    P *= np.asarray(size, float)
    hull = ConvexHull(P)
    tri = hull.simplices.copy()
    c = P.mean(0)
    for k, (a, b, d) in enumerate(tri):
        n = np.cross(P[b] - P[a], P[d] - P[a])
        if np.dot(n, P[a] - c) < 0:
            tri[k] = (a, d, b)
    P = rot_x(P, roll)
    P = rot_y(P, -pitch)
    P = rot_z(P, yaw)
    P = P + np.asarray(center, float)
    if zmin is not None:
        P[:, 2] = np.maximum(P[:, 2], zmin)
    V = P[tri].reshape(-1, 3)
    F = np.arange(len(V)).reshape(-1, 3)
    ft = 1 + tone * rng.uniform(-1, 1, len(tri))
    cc = np.repeat(C(col)[None] * ft[:, None], 3, 0)
    c2 = np.repeat(C(col2)[None] * ft[:, None], 3, 0)
    u = np.repeat(rng.uniform(0, 1, len(tri)), 3)
    S.add(V, F, attrs(len(V), cc, col2=c2, u=u, v=u, mat=mat, spec=spec, gloss=gloss, snow=snow, trans=trans))
    return P


# ----------------------------------------------------------------------------- projection (as r3d.render)

def _project(S, scale, offset, size, ss):
    V, F, Nv, A = S.arrays()
    V = V * scale
    sx0 = V[:, 0]
    sy0 = -(V[:, 1] * r3d.SE + V[:, 2] * r3d.CE)
    cxb = (sx0.min() + sx0.max()) / 2 + offset[0]
    cyb = (sy0.min() + sy0.max()) / 2 + offset[1]
    W = size * ss
    px = (sx0 - cxb) * ss + W / 2
    py = (sy0 - cyb) * ss + W / 2
    pz = V[:, 1] * r3d.CE - V[:, 2] * r3d.SE
    return V, F, A, px, py, pz, W


def origin_offset(S, scale, shift=(0.0, 0.0)):
    """The render offset that puts the world origin (0,0,0) at the canvas centre (+shift px)."""
    V = S.arrays()[0] * scale
    sx0 = V[:, 0]
    sy0 = -(V[:, 1] * r3d.SE + V[:, 2] * r3d.CE)
    return (-shift[0] - (sx0.min() + sx0.max()) / 2, -shift[1] - (sy0.min() + sy0.max()) / 2)


def aux_pass(S, scale, offset, size=256, ss=3, fade0=0.55):
    """Per-pixel glow (night, day) coverage with the glowing parts' colour, and the alpha factor for
    feathered patches, at output size. None when the scene has neither."""
    gn, gd = S.glow_arrays()
    fv = S.fade_array()
    if gn.max() <= 0 and gd.max() <= 0 and fv.max() <= 0:
        return None
    V, F, A, px, py, pz, W = _project(S, scale, offset, size, ss)
    fidx, b0, b1, depth = rasterize(px, py, pz, F, W, W)
    m = fidx >= 0
    n = np.zeros(W * W)
    d = np.zeros(W * W)
    col = np.zeros((W * W, 3))
    n[m] = gn[fidx[m]]
    d[m] = gd[fidx[m]]
    col[m] = interp(S.emissive_array(), F, fidx, b0, b1, m)
    fm = np.ones(W * W)
    fpx = interp(fv[:, None], F, fidx, b0, b1, m)[:, 0]
    fm[m] = 1 - smoothstep(fade0, 1.0, fpx)
    solid = np.zeros(W * W)
    solid[m] = fpx <= 1e-4
    n, d, fm, solid = n.reshape(W, W), d.reshape(W, W), fm.reshape(W, W), solid.reshape(W, W)
    col = col.reshape(W, W, 3)
    ds = lambda a: a.reshape(size, ss, size, ss, *a.shape[2:]).mean((1, 3))
    wsum = ds(n)
    gcol = np.where(wsum[..., None] > 1e-6, ds(col * n[..., None]) / np.maximum(wsum, 1e-6)[..., None], 0)
    dsum = ds(d)
    dcol = np.where(dsum[..., None] > 1e-6, ds(col * d[..., None]) / np.maximum(dsum, 1e-6)[..., None], 0)
    return dict(gn=wsum, gcol=gcol, gd=dsum, dcol=dcol, fade=ds(fm), glows=gn.max() > 0, body=ds(solid))


# ----------------------------------------------------------------------------- RGBA helpers (float, straight alpha)

def over_rgba(top, bot):
    ta, ba = top[..., 3:4], bot[..., 3:4]
    a = ta + ba * (1 - ta)
    rgb = np.where(a > 1e-6, (top[..., :3] * ta + bot[..., :3] * ba * (1 - ta)) / np.maximum(a, 1e-6), 0)
    return np.concatenate([rgb, a], -1)


def layer(col, alpha):
    """An RGBA layer of one colour with a given alpha map."""
    a = np.clip(alpha, 0, 1)
    return np.concatenate([np.broadcast_to(C(col), a.shape + (3,)), a[..., None]], -1)


def down_rgba(img, ss):
    h, w = img.shape[:2]
    pm = np.concatenate([img[..., :3] * img[..., 3:4], img[..., 3:4]], -1)
    pm = pm.reshape(h // ss, ss, w // ss, ss, 4).mean((1, 3))
    a = pm[..., 3:4]
    return np.concatenate([np.where(a > 1e-6, pm[..., :3] / np.maximum(a, 1e-6), 0), a], -1)


# ----------------------------------------------------------------------------- ground decals (craters, dust)

def ground_grid(size=256, ss=2, scale=1.0, shift=(0.0, 0.0)):
    """World ground coords (x right, y away/up the screen) of each supersampled canvas pixel, with the
    world origin at the canvas centre + shift (the same framing as render_plant(..., centre=True))."""
    ys, xs = (np.mgrid[0:size * ss, 0:size * ss] + 0.5) / ss - size / 2
    X = (xs - shift[0]) / scale
    Y = -(ys - shift[1]) / (r3d.SE * scale)
    return X, Y


def crater_height(X, Y, cx, cy, R, depth=0.38, rim=0.13, rim_w=0.22, blanket=0.4, floor=0.3, squash=1.0):
    r = np.hypot(X - cx, (Y - cy) * squash) / R
    bowl = -depth * R * np.clip(1 - r ** 2, 0, 1) ** (1 + floor)
    rimh = rim * R * np.exp(-((r - 1) / rim_w) ** 2)
    out = rim * R * blanket * np.exp(-np.clip(r - 1, 0, None) * 2.0) * (r > 1)
    return bowl + rimh + out


def shade_decal(H, X, Y, ss, scale, kd=0.9, kl=0.9, dmax=0.82, lmax=0.55, dark='#07080b', light='#e6e8ec',
                shadow_steps=60):
    """Light a ground height field like the plants (r3d.LIGHT) and turn it into a dark + a light layer,
    so it reads as relief over any ground colour. Returns (dark_layer, light_layer) RGBA."""
    L = r3d.LIGHT
    dx = X[0, 1] - X[0, 0]
    dy = Y[1, 0] - Y[0, 0]
    gy, gx = np.gradient(H, dy, dx)
    Nn = np.stack([-gx, -gy, np.ones_like(H)], -1)
    Nn /= np.linalg.norm(Nn, axis=-1, keepdims=True)
    lit = np.clip((Nn * L).sum(-1), 0, None) / L[2]
    # cast shadow: march towards the light over the height field
    lh = np.array([L[0], L[1]]) / np.hypot(L[0], L[1])
    tan_el = L[2] / np.hypot(L[0], L[1])
    hgt, wid = H.shape
    yy, xx = np.mgrid[0:hgt, 0:wid].astype(float)
    sh = np.ones_like(H)
    step = abs(dx) * 1.0
    for k in range(1, shadow_steps + 1):
        t = k * step
        sxp = xx + lh[0] * t / dx
        syp = yy + lh[1] * t / dy
        hs = ndimage.map_coordinates(H, [syp, sxp], order=1, mode='nearest')
        sh = np.minimum(sh, 1 - smoothstep(0.0, 0.6, hs - H - t * tan_el))
    s = lit * (0.25 + 0.75 * sh)
    a_d = np.clip((1 - s) * kd, 0, dmax)
    a_l = np.clip((s - 1) * kl, 0, lmax)
    return layer(dark, a_d), layer(light, a_l)


def radial_fade(size, ss, r0, r1, shift=(0.0, 0.0)):
    ys, xs = (np.mgrid[0:size * ss, 0:size * ss] + 0.5) / ss - size / 2
    r = np.hypot(xs - shift[0], ys - shift[1])
    return 1 - smoothstep(r0, r1, r)


# ----------------------------------------------------------------------------- render + checks

def body_box(a, thr=0.5):
    ys, xs = np.nonzero(a > thr)
    if len(xs) == 0:
        return 0, 0
    n = a.shape[0]
    return (xs.max() - xs.min() + 1) / n, (ys.max() - ys.min() + 1) / n


def edge_alpha(a):
    return max(a[0].max(), a[-1].max(), a[:, 0].max(), a[:, -1].max())


def margin(a, thr=3 / 255):
    ys, xs = np.nonzero(a > thr)
    n = a.shape[0]
    return int(min(xs.min(), ys.min(), n - 1 - xs.max(), n - 1 - ys.max()))


def render_plant(S, env, out, seed=0, scale=1.0, offset=(0.0, 0.0), centre=False, under=None, above=None,
                 glow_out=None, glow_col='#ff7a1e', halo=2.6, halo_amt=0.55, light=None, size=256, ss=3, **kw):
    """Render S, put `under` (RGBA float, size x size) beneath it and `above` over it, bake glowing parts
    in, and write the plant (and plant-N-glow.png when anything glows). Returns the final RGBA float."""
    old = r3d.LIGHT
    if light is not None:
        r3d.LIGHT = nrm(light)
    try:
        if centre:
            offset = origin_offset(S, scale, offset)
        res, st = render(S, env, out=None, info=False, seed=seed, scale=scale, offset=offset, size=size, ss=ss, **kw)
        img = np.asarray(res).astype(float) / 255.0
        g = aux_pass(S, scale, offset, size, ss) if isinstance(S, GScene) else None
    finally:
        r3d.LIGHT = old
    if g is not None:
        img[..., :3] = img[..., :3] * (1 - g['gd'][..., None]) + np.clip(g['dcol'], 0, 1) * g['gd'][..., None]
        body = g['body']
        img[..., 3] *= g['fade']
    else:
        body = (img[..., 3] > 0.995).astype(float)
    if under is not None:
        img = over_rgba(img, under)
    if above is not None:
        img = over_rgba(above, img)
    bw, bh = body_box(body)
    os.makedirs(os.path.dirname(out) or '.', exist_ok=True)
    Image.fromarray((np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8), 'RGBA').save(out)
    msg = f"{out}: body {bw:.2f} x {bh:.2f}, all-alpha {body_box(img[..., 3], 0.12)[0]:.2f} x " \
          f"{body_box(img[..., 3], 0.12)[1]:.2f}, margin {margin(img[..., 3])} px, edge alpha {edge_alpha(img[..., 3]):.3f}"
    if g is not None and g['glows'] and glow_out:
        gn, gcol = g['gn'], g['gcol']
        hl = ndimage.gaussian_filter(gn, halo) * 2.2
        a = np.clip(gn + halo_amt * hl, 0, 1)
        core = np.clip(gn * 1.6, 0, 1)[..., None]
        rgb = C(glow_col) * (1 - core) + np.clip(gcol * 1.15, 0, 1) * core
        gim = np.concatenate([rgb, a[..., None]], -1)
        gim[a < 1 / 255] = 0
        Image.fromarray((np.clip(gim, 0, 1) * 255 + 0.5).astype(np.uint8), 'RGBA').save(glow_out)
        msg += f"; glow -> {glow_out} (edge {edge_alpha(a):.3f})"
    print(msg)
    return img

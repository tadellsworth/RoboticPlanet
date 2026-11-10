"""Tiny numpy 3D renderer for Terrafall decorative plants.

World: X right, Y away from camera (up the screen), Z up. 1 world unit = 1 output pixel.
Camera: orthographic, looking down at 70 degrees. Sun: from the screen's top-left, about 58 degrees up.
Output: 256x256 RGBA, plant opaque, soft shadow falling down-right as semi-transparent dark pixels.
"""
import numpy as np
from scipy import ndimage
from PIL import Image

ELEV = np.radians(70)
SE, CE = np.sin(ELEV), np.cos(ELEV)
D_VIEW = np.array([0.0, CE, -SE])
TO_CAM = -D_VIEW


def nrm(v):
    v = np.asarray(v, float)
    return v / (np.linalg.norm(v, axis=-1, keepdims=True) + 1e-12)


LIGHT = nrm([-1.0, 0.85, 2.1])

# per-vertex attribute layout
NA = 13
I_COL, I_COL2, I_U, I_V, I_MAT, I_SPEC, I_TRANS, I_SNOW, I_GLOSS = 0, 3, 6, 7, 8, 9, 10, 11, 12


def hexrgb(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], float) / 255.0


def C(c):
    return hexrgb(c) if isinstance(c, str) else np.asarray(c, float)


def lerpc(a, b, t):
    a, b = C(a), C(b)
    t = np.asarray(t, float)[..., None]
    return a + (b - a) * t


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0 + 1e-12), 0, 1)
    return t * t * (3 - 2 * t)


def attrs(n, col, col2=None, u=None, v=None, mat=0, spec=0.12, trans=0.0, snow=0.0, gloss=18):
    A = np.zeros((n, NA))
    col = C(col)
    A[:, 0:3] = col
    A[:, 3:6] = C(col2) if col2 is not None else col
    if u is not None:
        A[:, I_U] = u
    if v is not None:
        A[:, I_V] = v
    A[:, I_MAT] = mat
    A[:, I_SPEC] = spec
    A[:, I_TRANS] = trans
    A[:, I_SNOW] = snow
    A[:, I_GLOSS] = gloss
    return A


def vertex_normals(V, F):
    v0, v1, v2 = V[F[:, 0]], V[F[:, 1]], V[F[:, 2]]
    fn = np.cross(v1 - v0, v2 - v0)
    N = np.zeros_like(V)
    for k in range(3):
        np.add.at(N, F[:, k], fn)
    ln = np.linalg.norm(N, axis=1, keepdims=True)
    N = np.where(ln > 1e-12, N / np.maximum(ln, 1e-12), np.array([0, 0, 1.0]))
    return N


def grid_faces(nu, nv, wrap_v=False):
    """Vertices laid out [i*nv + j], i along u (rows), j along v (cols)."""
    F = []
    jmax = nv if wrap_v else nv - 1
    for i in range(nu - 1):
        for j in range(jmax):
            a = i * nv + j
            b = i * nv + (j + 1) % nv
            c = (i + 1) * nv + j
            d = (i + 1) * nv + (j + 1) % nv
            F.append((a, c, b))
            F.append((b, c, d))
    return np.array(F, int).reshape(-1, 3)


_GF = {}


def gf(nu, nv, wrap_v=False):
    k = (nu, nv, wrap_v)
    if k not in _GF:
        _GF[k] = grid_faces(nu, nv, wrap_v)
    return _GF[k]


class Scene:
    def __init__(self):
        self.V, self.F, self.N, self.A = [], [], [], []
        self.n = 0

    def add(self, V, F, A, normals=None):
        V = np.asarray(V, float)
        if normals is None:
            normals = vertex_normals(V, F)
        self.V.append(V)
        self.F.append(np.asarray(F) + self.n)
        self.N.append(normals)
        self.A.append(A)
        self.n += len(V)

    def arrays(self):
        return (np.concatenate(self.V), np.concatenate(self.F), np.concatenate(self.N), np.concatenate(self.A))


# ----------------------------------------------------------------------------- geometry builders

def arc_spine(origin, yaw, length, pitch0, pitch1, n=12, yaw1=None, pitch_curve=1.0):
    """A curve that starts at `origin` heading at compass `yaw` (rad, 0 = screen right, pi/2 = screen up)
    with elevation pitch0 and bends to pitch1 at the tip. Returns (pts (n,3), yaws (n,))."""
    s = np.linspace(0, 1, n)
    yaw1 = yaw if yaw1 is None else yaw1
    pitch = pitch0 + (pitch1 - pitch0) * s ** pitch_curve
    yw = yaw + (yaw1 - yaw) * s
    d = np.stack([np.cos(pitch) * np.cos(yw), np.cos(pitch) * np.sin(yw), np.sin(pitch)], -1)
    ds = length / (n - 1)
    pts = np.zeros((n, 3))
    pts[0] = origin
    pts[1:] = origin + np.cumsum((d[:-1] + d[1:]) * 0.5 * ds, axis=0)
    return pts, yw


def tangents(P):
    T = np.gradient(P, axis=0)
    return nrm(T)


def ribbon(spine, width, side=None, yaws=None, ncross=5, fold=0.25, roll=0.0, droop_edges=0.0):
    """Leaf-like strip. width (n,) half-widths. fold>0 lifts the edges (V/cup shape).
    Returns V, F, u, v."""
    n = len(spine)
    T = tangents(spine)
    if side is None:
        if yaws is None:
            yaws = np.arctan2(T[:, 1], T[:, 0])
        side = np.stack([-np.sin(yaws), np.cos(yaws), np.zeros(n)], -1)
    side = nrm(side - (side * T).sum(-1, keepdims=True) * T)
    up = nrm(np.cross(T, side))
    flip = up[:, 2:3] < 0
    up = np.where(flip, -up, up)
    if np.any(roll):
        r = np.broadcast_to(np.asarray(roll, float), (n,))[:, None]
        side, up = side * np.cos(r) + up * np.sin(r), up * np.cos(r) - side * np.sin(r)
    t = np.linspace(-1, 1, ncross)
    w = np.asarray(width, float)[:, None]
    P = (spine[:, None, :] + side[:, None, :] * (w * t[None, :])[..., None]
         + up[:, None, :] * (fold * w * t[None, :] ** 2)[..., None]
         - up[:, None, :] * (droop_edges * w * np.abs(t[None, :]) ** 3)[..., None])
    V = P.reshape(-1, 3)
    u = np.repeat(np.linspace(0, 1, n), ncross)
    v = np.tile(t, n)
    return V, gf(n, ncross), u, v


def tube(spine, radius, nseg=8, ref=None):
    n = len(spine)
    T = tangents(spine)
    ref = np.array([0, 0, 1.0]) if ref is None else ref
    N1 = np.zeros((n, 3))
    a = np.cross(T[0], ref)
    if np.linalg.norm(a) < 1e-3:
        a = np.cross(T[0], [1.0, 0, 0])
    N1[0] = nrm(a)
    for i in range(1, n):
        v = N1[i - 1] - np.dot(N1[i - 1], T[i]) * T[i]
        N1[i] = nrm(v) if np.linalg.norm(v) > 1e-6 else N1[i - 1]
    N2 = np.cross(T, N1)
    ang = np.linspace(0, 2 * np.pi, nseg, endpoint=False)
    r = np.asarray(radius, float)[:, None, None]
    P = spine[:, None, :] + r * (np.cos(ang)[None, :, None] * N1[:, None, :] + np.sin(ang)[None, :, None] * N2[:, None, :])
    V = P.reshape(-1, 3)
    u = np.repeat(np.linspace(0, 1, n), nseg)
    v = np.tile(ang / (2 * np.pi), n)
    return V, gf(n, nseg, True), u, v


def blob(center, radii, nu=18, nv=28, disp=None, zmin=None):
    th = np.linspace(0, np.pi, nu)
    ph = np.linspace(0, 2 * np.pi, nv, endpoint=False)
    TH, PH = np.meshgrid(th, ph, indexing='ij')
    d = np.stack([np.sin(TH) * np.cos(PH), np.sin(TH) * np.sin(PH), np.cos(TH)], -1).reshape(-1, 3)
    s = 1.0 + (disp(d) if disp is not None else 0)
    V = np.asarray(center, float) + np.asarray(radii, float) * d * np.asarray(s)[..., None]
    if zmin is not None:
        V[:, 2] = np.maximum(V[:, 2], zmin)
    u = (TH / np.pi).ravel()
    v = (PH / (2 * np.pi)).ravel()
    return V, gf(nu, nv, True), u, v


def patch(center, rfun, hfun, step=1.0, edge=3.0):
    """Ground-hugging patch with irregular outline rfun(theta) and height hfun(x, y) (local coords)."""
    R = 0
    th = np.linspace(0, 2 * np.pi, 360)
    R = rfun(th).max() + 2 * step
    xs = np.arange(-R, R + step, step)
    nx = len(xs)
    X, Y = np.meshgrid(xs, xs, indexing='ij')
    r = np.hypot(X, Y)
    t = np.arctan2(Y, X) % (2 * np.pi)
    rb = rfun(t)
    inside = r <= rb
    k = np.where(inside, 1.0, rb / np.maximum(r, 1e-9))
    Xb, Yb = X * k, Y * k
    taper = smoothstep(0, edge, rb - np.minimum(r, rb))
    Z = hfun(Xb, Yb) * taper
    Z = np.maximum(Z, 0.15)
    V = np.stack([Xb + center[0], Yb + center[1], Z], -1).reshape(-1, 3)
    F = gf(nx, nx)
    ins = inside.ravel()
    keep = ins[F].any(1)
    u = (r / np.maximum(rb, 1e-9)).ravel().clip(0, 1)
    v = (t / (2 * np.pi)).ravel()
    return V, F[keep], u, v


def sinnoise(P, seed, freq=0.1, n=14, falloff=1.0):
    """Smooth pseudo-noise on 3D points (sum of random plane waves), ~unit variance."""
    rng = np.random.default_rng(seed)
    out = np.zeros(len(P))
    tot = 0
    for k in range(n):
        m = freq * 2 ** rng.uniform(0, 2.2)
        w = nrm(rng.normal(size=3)) * m
        a = (freq / m) ** falloff
        out += a * np.sin(P @ w + rng.uniform(0, 2 * np.pi))
        tot += a * a
    return out / np.sqrt(tot / 2)


# ----------------------------------------------------------------------------- rasteriser

def rasterize(px, py, pz, F, W, H, chunk=3_000_000):
    """Z-buffer rasterise triangles (pixel centres at i+.5). Smaller pz wins.
    Returns face index (H*W,) (-1 empty), barycentrics b0, b1 (H*W,), depth (H*W,)."""
    x0, x1, x2 = px[F[:, 0]], px[F[:, 1]], px[F[:, 2]]
    y0, y1, y2 = py[F[:, 0]], py[F[:, 1]], py[F[:, 2]]
    area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0)
    ok = np.abs(area) > 1e-9
    minx = np.floor(np.minimum(np.minimum(x0, x1), x2)).astype(int)
    maxx = np.ceil(np.maximum(np.maximum(x0, x1), x2)).astype(int)
    miny = np.floor(np.minimum(np.minimum(y0, y1), y2)).astype(int)
    maxy = np.ceil(np.maximum(np.maximum(y0, y1), y2)).astype(int)
    ext = np.maximum(maxx - minx, maxy - miny) + 1
    ok &= (maxx >= 0) & (maxy >= 0) & (minx < W) & (miny < H)
    pix_l, z_l, f_l, b0_l, b1_l = [], [], [], [], []
    B = 2
    remaining = ok.copy()
    while remaining.any():
        sel = np.nonzero(remaining & (ext <= B))[0]
        remaining[sel] = False
        if len(sel):
            per = B * B
            step = max(1, chunk // per)
            for s0 in range(0, len(sel), step):
                idx = sel[s0:s0 + step]
                gx = minx[idx, None, None] + np.arange(B)[None, None, :]
                gy = miny[idx, None, None] + np.arange(B)[None, :, None]
                cx = gx + 0.5
                cy = gy + 0.5
                X0, X1, X2 = x0[idx, None, None], x1[idx, None, None], x2[idx, None, None]
                Y0, Y1, Y2 = y0[idx, None, None], y1[idx, None, None], y2[idx, None, None]
                ar = area[idx, None, None]
                w0 = ((X1 - cx) * (Y2 - cy) - (X2 - cx) * (Y1 - cy)) / ar
                w1 = ((X2 - cx) * (Y0 - cy) - (X0 - cx) * (Y2 - cy)) / ar
                w2 = 1 - w0 - w1
                ins = (w0 >= -1e-7) & (w1 >= -1e-7) & (w2 >= -1e-7) & (gx >= 0) & (gx < W) & (gy >= 0) & (gy < H)
                if not ins.any():
                    continue
                ff = np.broadcast_to(idx[:, None, None], ins.shape)[ins]
                ww0, ww1 = w0[ins], w1[ins]
                zz = ww0 * pz[F[ff, 0]] + ww1 * pz[F[ff, 1]] + (1 - ww0 - ww1) * pz[F[ff, 2]]
                pix_l.append((np.broadcast_to(gy, ins.shape)[ins] * W + np.broadcast_to(gx, ins.shape)[ins]).astype(np.int64))
                z_l.append(zz)
                f_l.append(ff)
                b0_l.append(ww0)
                b1_l.append(ww1)
        B *= 2
    fidx = np.full(W * H, -1, np.int64)
    b0 = np.zeros(W * H)
    b1 = np.zeros(W * H)
    depth = np.full(W * H, np.inf)
    if not pix_l:
        return fidx, b0, b1, depth
    pix = np.concatenate(pix_l)
    z = np.concatenate(z_l)
    f = np.concatenate(f_l)
    a0 = np.concatenate(b0_l)
    a1 = np.concatenate(b1_l)
    order = np.lexsort((z, pix))
    pix, z, f, a0, a1 = pix[order], z[order], f[order], a0[order], a1[order]
    first = np.ones(len(pix), bool)
    first[1:] = pix[1:] != pix[:-1]
    p = pix[first]
    fidx[p] = f[first]
    b0[p] = a0[first]
    b1[p] = a1[first]
    depth[p] = z[first]
    return fidx, b0, b1, depth


def interp(arr, F, fidx, b0, b1, mask):
    f = fidx[mask]
    w0 = b0[mask][:, None]
    w1 = b1[mask][:, None]
    return arr[F[f, 0]] * w0 + arr[F[f, 1]] * w1 + arr[F[f, 2]] * (1 - w0 - w1)


# ----------------------------------------------------------------------------- environments

ENVS = {
    'desert': dict(sun=np.array([1.0, 0.92, 0.80]) * 1.0, sky=np.array([0.36, 0.40, 0.50]) * 0.62,
                   bounce=np.array([0.55, 0.36, 0.22]) * 0.42, shadow='#2a170a', shadow_op=0.52, snow='#ffffff'),
    'jungle': dict(sun=np.array([1.0, 0.95, 0.84]) * 0.86, sky=np.array([0.38, 0.45, 0.48]) * 0.62,
                   bounce=np.array([0.26, 0.30, 0.16]) * 0.42, shadow='#0b1206', shadow_op=0.58, snow='#ffffff'),
    'polar': dict(sun=np.array([1.0, 0.97, 0.93]) * 0.96, sky=np.array([0.52, 0.62, 0.80]) * 0.7,
                  bounce=np.array([0.62, 0.68, 0.78]) * 0.5, shadow='#1d3050', shadow_op=0.42, snow='#f4f8fc'),
}


def _noise(shape, sigma, rng):
    a = ndimage.gaussian_filter(rng.normal(size=shape), sigma, mode='wrap')
    return (a - a.mean()) / (a.std() + 1e-12)


def render(scene, env='desert', size=256, ss=3, seed=0, ao_low=0.35, rim=0.12, out=None, info=True,
           tex_scale=1.0, sun_mult=1.0, offset=(0.0, 0.0), scale=1.0):
    E = ENVS[env]
    V, F, Nv, A = scene.arrays()
    V = V * scale
    W = size * ss
    sx0 = V[:, 0]
    sy0 = -(V[:, 1] * SE + V[:, 2] * CE)
    cxb = (sx0.min() + sx0.max()) / 2 + offset[0]
    cyb = (sy0.min() + sy0.max()) / 2 + offset[1]
    px = (sx0 - cxb) * ss + W / 2
    py = (sy0 - cyb) * ss + W / 2
    pz = V[:, 1] * CE - V[:, 2] * SE
    fidx, b0, b1, depth = rasterize(px, py, pz, F, W, W)
    m = fidx >= 0
    # ---- G-buffer
    P = interp(V, F, fidx, b0, b1, m)
    Nn = interp(Nv, F, fidx, b0, b1, m)
    Nn = nrm(Nn)
    flip = (Nn @ TO_CAM) < 0
    Nn[flip] *= -1
    At = interp(A, F, fidx, b0, b1, m)
    mat = np.rint(At[:, I_MAT]).astype(int)
    # ---- shadow map
    L = LIGHT
    ea = nrm(np.cross(L, [0, 0, 1.0]))
    eb = np.cross(L, ea)
    la, lb, lc = V @ ea, V @ eb, V @ L
    k = 3.0
    amin, bmin = la.min() - 4, lb.min() - 4
    SW = int((la.max() - amin + 8) * k) + 2
    SH = int((lb.max() - bmin + 8) * k) + 2
    sf, sb0, sb1, sd = rasterize((la - amin) * k, (lb - bmin) * k, -lc, F, SW, SH)
    SM = np.where(sf >= 0, -sd, -np.inf).reshape(SH, SW)

    rng_k = np.random.default_rng(7)
    ang = rng_k.uniform(0, 2 * np.pi, 20)
    rad = np.sqrt(rng_k.uniform(0, 1, 20))
    disk = np.stack([np.cos(ang) * rad, np.sin(ang) * rad], -1)

    def lit_fraction(Pw, radius, bias):
        a = (Pw @ ea - amin) * k
        b = (Pw @ eb - bmin) * k
        c = Pw @ L
        acc = np.zeros(len(Pw))
        for dx, dy in disk:
            ia = np.clip(np.rint(a + dx * radius * k).astype(int), 0, SW - 1)
            ib = np.clip(np.rint(b + dy * radius * k).astype(int), 0, SH - 1)
            acc += (c + bias >= SM[ib, ia])
        return acc / len(disk)

    sh = lit_fraction(P + Nn * 0.9, 1.0, 0.9)
    # ---- screen-space noise for textures
    rng = np.random.default_rng(seed)
    nf = _noise((W, W), 0.9 * ss * tex_scale, rng).ravel()[m]
    nm = _noise((W, W), 2.6 * ss * tex_scale, rng).ravel()[m]
    nb = _noise((W, W), 7.0 * ss * tex_scale, rng).ravel()[m]
    nfine2d = _noise((W, W), 0.7 * ss * tex_scale, rng)
    gy_, gx_ = np.gradient(nfine2d)
    gx_, gy_ = gx_.ravel()[m] * ss, gy_.ravel()[m] * ss
    # ---- albedo + textures
    col = At[:, 0:3].copy()
    col2 = At[:, 3:6]
    u, v = At[:, I_U], At[:, I_V]
    bump = np.zeros(len(col))
    # mat 1: veined leaf
    s1 = mat == 1
    if s1.any():
        vv, uu = v[s1], u[s1]
        mid = np.exp(-(vv / 0.09) ** 2) * (uu < 0.97)
        ph = uu * 7.0 - np.abs(vv) * 1.3
        d = np.abs((ph % 1.0) - 0.5)
        lat = np.exp(-(d / 0.075) ** 2) * smoothstep(0.08, 0.3, np.abs(vv)) * (1 - np.abs(vv) ** 3) * smoothstep(0.02, 0.15, uu)
        vein = np.clip(np.maximum(mid, lat * 0.75), 0, 1)
        col[s1] = col[s1] + (col2[s1] - col[s1]) * vein[:, None]
        col[s1] *= (1 + 0.06 * nf[s1])[:, None]
        bump[s1] = 0.15
    # mat 2: blotchy lichen / crust
    s2 = mat == 2
    if s2.any():
        bl = smoothstep(-0.25, 0.45, nm[s2] + 0.55 * nf[s2])
        col[s2] = col[s2] + (col2[s2] - col[s2]) * bl[:, None]
        dots = smoothstep(1.6, 2.2, nf[s2])
        col[s2] *= (1 - 0.45 * dots)[:, None]
        col[s2] *= (1 + 0.1 * nf[s2])[:, None]
        bump[s2] = 0.55
    # mat 3: fibrous / bark
    s3 = mat == 3
    if s3.any():
        col[s3] *= (1 + 0.13 * nf[s3] + 0.08 * nm[s3])[:, None]
        bump[s3] = 0.25
    # mat 4: moss
    s4 = mat == 4
    if s4.any():
        t4 = smoothstep(0.2, 1.4, nf[s4] + 0.3 * nm[s4])
        col[s4] = col[s4] + (col2[s4] - col[s4]) * t4[:, None]
        col[s4] *= (1 + 0.12 * nm[s4])[:, None]
        bump[s4] = 0.9
    # mat 5: ice / frost
    s5 = mat == 5
    if s5.any():
        t5 = smoothstep(-0.6, 0.9, nm[s5])
        col[s5] = col[s5] + (col2[s5] - col[s5]) * t5[:, None]
        bump[s5] = 0.2
    # mat 6: snow
    s6 = mat == 6
    if s6.any():
        col[s6] *= (1 + 0.025 * nf[s6])[:, None]
        bump[s6] = 0.35
    # mat 7: stone with speckles
    s7 = mat == 7
    if s7.any():
        t7 = smoothstep(-0.3, 0.8, nm[s7] + 0.4 * nb[s7])
        col[s7] = col[s7] + (col2[s7] - col[s7]) * t7[:, None]
        col[s7] *= (1 + 0.12 * nf[s7])[:, None]
        bump[s7] = 0.5
    # normal bump
    Nn[:, 0] += -bump * gx_ * 0.6
    Nn[:, 1] += bump * gy_ * 0.6
    Nn = nrm(Nn)
    # snow / frost overlay on up-facing surfaces
    snow = At[:, I_SNOW]
    sn = snow * smoothstep(0.35, 0.75, Nn[:, 2] + 0.22 * nm + 0.1 * nf)
    col = col + (C(E['snow']) - col) * sn[:, None]
    alb = np.clip(col, 0, 1) ** 2.2
    # ---- lighting
    ndl = Nn @ L
    diff = np.clip(ndl, 0, 1) * sh
    trans = At[:, I_TRANS] * np.clip(-ndl, 0, 1) * sh * 0.7
    hemi = (0.5 + 0.5 * Nn[:, 2])[:, None]
    amb = E['bounce'] + (E['sky'] - E['bounce']) * hemi
    # ambient occlusion: screen-space (taller neighbours) and height-based cavity
    Zmap = np.zeros(W * W)
    Zmap[m] = P[:, 2]
    Hmax = max(P[:, 2].max(), 1e-3)
    occ = ndimage.gaussian_filter(Zmap.reshape(W, W), 5 * ss).ravel()[m] - P[:, 2]
    ao = np.clip(1 - occ / 14.0, 0.45, 1.0)
    ao *= (1 - ao_low) + ao_low * smoothstep(0, 0.6 * Hmax, P[:, 2])
    Hh = nrm(L + TO_CAM)
    spec = 0.45 * At[:, I_SPEC] * np.clip(Nn @ Hh, 0, 1) ** np.maximum(At[:, I_GLOSS] * 1.6, 20) * sh
    fres = (1 - np.clip(Nn @ TO_CAM, 0, 1)) ** 3
    ice = (mat == 5).astype(float)
    sun = E['sun'] * sun_mult
    lin = alb * (amb * ao[:, None] + sun * diff[:, None] + sun * trans[:, None] * 0.9) \
        + (spec * 1.0)[:, None] * sun + (ice * fres * 0.35 * ao)[:, None] * np.array([0.8, 0.9, 1.0])
    rgb = np.clip(lin, 0, 1) ** (1 / 2.2)
    # ---- compose hi-res RGBA
    img = np.zeros((W * W, 4))
    cov = m.reshape(W, W).astype(float)
    # silhouette rim darkening helps the outline read at phone size
    if rim > 0:
        er = ndimage.binary_erosion(cov > 0, iterations=max(1, int(round(0.8 * ss))))
        edge = ((cov > 0) & ~er).ravel()[m]
        rgb = rgb * (1 - rim * edge)[:, None]
    img[m, :3] = rgb
    img[m, 3] = 1.0
    # ground shadow + contact occlusion
    gi = ~m
    ys, xs = np.divmod(np.arange(W * W), W)
    Xg = (xs[gi] + 0.5 - W / 2) / ss + cxb
    Yg = -(((ys[gi] + 0.5 - W / 2) / ss + cyb)) / SE
    Pg = np.stack([Xg, Yg, np.zeros_like(Xg)], -1)
    lit_g = np.ones(W * W)
    lit_g[gi] = lit_fraction(Pg, 2.2, 0.25)
    sha = ndimage.gaussian_filter((1 - lit_g).reshape(W, W), 1.6 * ss)
    foot = np.zeros(W * W)
    lowZ = np.zeros(W * W)
    lowZ[m] = (P[:, 2] < 0.35 * Hmax + 2).astype(float)
    foot = ndimage.gaussian_filter(lowZ.reshape(W, W), 3.5 * ss)
    ga = 1 - (1 - sha * E['shadow_op']) * (1 - np.clip(foot * 0.55, 0, 0.4))
    ga = ga.ravel()
    img[gi, :3] = C(E['shadow'])
    img[gi, 3] = ga[gi]
    img = img.reshape(W, W, 4)
    # downsample with premultiplied alpha
    pm = np.concatenate([img[..., :3] * img[..., 3:4], img[..., 3:4]], -1)
    pm = pm.reshape(size, ss, size, ss, 4).mean((1, 3))
    a = pm[..., 3:4]
    rgbo = np.where(a > 1e-5, pm[..., :3] / np.maximum(a, 1e-5), 0)
    outimg = np.concatenate([rgbo, a], -1)
    res = Image.fromarray((np.clip(outimg, 0, 1) * 255 + 0.5).astype(np.uint8), 'RGBA')
    # stats
    body = cov.reshape(size, ss, size, ss).mean((1, 3)) > 0.5
    ysb, xsb = np.nonzero(body)
    al = np.asarray(res)[..., 3] > 3
    yA, xA = np.nonzero(al)
    stats = dict(w=(xsb.max() - xsb.min() + 1) / size, h=(ysb.max() - ysb.min() + 1) / size,
                 margin=int(min(xA.min(), yA.min(), size - 1 - xA.max(), size - 1 - yA.max())),
                 cx=(xsb.max() + xsb.min()) / 2 / size, cy=(ysb.max() + ysb.min()) / 2 / size,
                 tris=len(F), hmax=Hmax)
    if out:
        __import__('os').makedirs(__import__('os').path.dirname(out) or '.', exist_ok=True)
        res.save(out)
    if info:
        print(f"{out}: body {stats['w']:.2f} x {stats['h']:.2f} of canvas, margin {stats['margin']} px, "
              f"centre ({stats['cx']:.2f},{stats['cy']:.2f}), height {Hmax:.0f}, {len(F)} tris")
    return res, stats

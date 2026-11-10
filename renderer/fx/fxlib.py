"""Volumetric-puff effects renderer for Terrafall: soft lit smoke/dust puffs, glowing fire, sparks and streaks,
rendered at 2x and downsampled, on a TRANSPARENT background (premultiplied compositing, un-premultiplied on save)."""
import sys, math
import numpy as np
from PIL import Image
from scipy import ndimage
sys.path.insert(0, __import__('os').path.join(__import__('os').path.dirname(__import__('os').path.abspath(__file__)), '..', 'terrain'))
from tex import fbm

L = np.array([-0.55, -0.62, 0.56]); L = L / np.linalg.norm(L)        # light from the top-left, toward the viewer

_NT = {}
def noise_tex(seed, n=256, lo=2, hi=40, beta=1.1):
    k = (seed, n, lo, hi, beta)
    if k not in _NT:
        a = fbm(n, seed, lo, hi, beta)
        _NT[k] = (a - a.mean()) / (a.std() + 1e-6)
    return _NT[k]

def sample(tex, u, v):
    n = tex.shape[0]
    x = (u * n) % n; y = (v * n) % n
    x0 = np.floor(x).astype(int); y0 = np.floor(y).astype(int); fx = x - x0; fy = y - y0; x0 %= n; y0 %= n
    x1 = (x0 + 1) % n; y1 = (y0 + 1) % n
    return (tex[y0, x0] * (1 - fx) * (1 - fy) + tex[y0, x1] * fx * (1 - fy) + tex[y1, x0] * (1 - fx) * fy + tex[y1, x1] * fx * fy)

def fire_ramp(t):
    """temperature 0..1 -> emission colour (linear-ish, values may exceed 1 for the core)"""
    stops = [(0.0, (0.0, 0.0, 0.0)), (0.22, (0.45, 0.06, 0.02)), (0.42, (0.95, 0.25, 0.04)), (0.62, (1.0, 0.55, 0.1)),
             (0.82, (1.0, 0.85, 0.35)), (1.0, (1.15, 1.1, 0.95))]
    t = np.clip(t, 0, 1); out = np.zeros(t.shape + (3,), np.float32)
    for (a, ca), (b, cb) in zip(stops[:-1], stops[1:]):
        m = (t >= a) & (t <= b); w = ((t - a) / (b - a))[m][:, None]
        out[m] = np.array(ca) * (1 - w) + np.array(cb) * w
    return out

class Canvas:
    def __init__(self, w, h, ss=2):
        self.ss = ss; self.W, self.H = w * ss, h * ss
        self.rgb = np.zeros((self.H, self.W, 3), np.float32)      # premultiplied
        self.a = np.zeros((self.H, self.W), np.float32)
        self.glow = np.zeros((self.H, self.W, 3), np.float32)      # emissive light for bloom

    def over(self, x0, y0, c, a):
        """composite a premultiplied patch (c: h,w,3 already multiplied by a) at x0,y0 (clipped)"""
        h, w = a.shape
        X0, Y0 = max(0, x0), max(0, y0); X1, Y1 = min(self.W, x0 + w), min(self.H, y0 + h)
        if X1 <= X0 or Y1 <= Y0: return
        sa = a[Y0 - y0:Y1 - y0, X0 - x0:X1 - x0]; sc = c[Y0 - y0:Y1 - y0, X0 - x0:X1 - x0]
        self.rgb[Y0:Y1, X0:X1] = sc + self.rgb[Y0:Y1, X0:X1] * (1 - sa[..., None])
        self.a[Y0:Y1, X0:X1] = sa + self.a[Y0:Y1, X0:X1] * (1 - sa)

    def puff(self, x, y, r, dens=1.0, temp=0.0, albedo=(0.14, 0.13, 0.12), seed=0, rot=0.0, soft=1.0, glowk=1.0,
             rough=0.35, heat_core=1.0, underglow=0.0, flat=1.0):
        """a lit, noisy, roughly spherical puff. x,y,r in output px (scaled by ss internally)."""
        s = self.ss; x, y, r = x * s, y * s, max(1.0, r * s)
        R = int(r * 1.25) + 2
        x0, y0 = int(x) - R, int(y) - R
        yy, xx = np.mgrid[0:2 * R, 0:2 * R].astype(np.float32)
        u = (xx + x0 - x) / r; v = (yy + y0 - y) / (r * flat)
        d2 = u * u + v * v
        if d2.min() >= 1.6: return
        tex = noise_tex(seed % 7, 256, 2, 14, 1.3)
        ca, sa = math.cos(rot), math.sin(rot)
        uu, vv = (u * ca - v * sa), (u * sa + v * ca)
        n = sample(tex, uu * 0.11 + seed * 0.137, vv * 0.11 + seed * 0.291)
        n2 = sample(noise_tex((seed + 3) % 7, 256, 4, 26, 1.0), uu * 0.17 + seed * 0.05, vv * 0.17)
        base = np.clip(1 - d2, 0, 1) ** (0.55 * soft)
        field = np.clip(base + rough * (0.78 * n + 0.22 * n2) * np.sqrt(np.clip(1.25 - d2, 0, 1)) - 0.08, 0, 1)
        a = (1 - np.exp(-4.5 * field * dens)).astype(np.float32)
        a *= np.clip((1.45 - d2) / 0.3, 0, 1)
        if a.max() < 0.003: return
        nz = np.sqrt(np.clip(1 - d2, 0, 1))
        gy, gx = np.gradient(n)
        nx, ny = u + 0.22 * gx * r, v + 0.22 * gy * r
        nl = np.sqrt(nx * nx + ny * ny + nz * nz) + 1e-6
        shade = np.clip((nx * L[0] + ny * L[1] + nz * L[2]) / nl, 0, 1)
        lit = 0.32 + 0.85 * shade
        col = np.array(albedo, np.float32)[None, None] * lit[..., None]
        if underglow > 0:                                           # fire light on the underside of the smoke
            ug = np.clip(0.5 + 0.5 * v, 0, 1) * underglow
            col = col + np.array([1.0, 0.42, 0.1], np.float32) * (ug * 0.6)[..., None]
        if temp > 0:
            tp = temp * np.clip(heat_core * (0.98 - 0.95 * d2) + 0.34 * n + 0.12 * n2, 0, 1.0)
            heat = np.clip((tp - 0.18) / 0.35, 0, 1) ** 1.2
            em = fire_ramp(tp)
            col = col * (1 - heat[..., None]) + em * heat[..., None]
            a = np.maximum(a, (heat * np.clip(field * 1.6, 0, 1)).astype(np.float32))
            gl = em * (heat * a)[..., None] * glowk
            X0, Y0 = max(0, x0), max(0, y0); X1, Y1 = min(self.W, x0 + 2 * R), min(self.H, y0 + 2 * R)
            if X1 > X0 and Y1 > Y0:
                self.glow[Y0:Y1, X0:X1] += gl[Y0 - y0:Y1 - y0, X0 - x0:X1 - x0]
        self.over(x0, y0, col * a[..., None], a)

    def streak(self, xa, ya, xb, yb, w, col, alpha=1.0, glowk=0.0, taper=True):
        """a glowing line segment (spark / debris fleck / tracer), w in output px"""
        s = self.ss; xa, ya, xb, yb, w = xa * s, ya * s, xb * s, yb * s, max(0.6, w * s)
        R = int(w * 2.5) + 2
        x0, y0 = int(min(xa, xb)) - R, int(min(ya, yb)) - R
        x1, y1 = int(max(xa, xb)) + R, int(max(ya, yb)) + R
        yy, xx = np.mgrid[y0:y1, x0:x1].astype(np.float32)
        dx, dy = xb - xa, yb - ya; L2 = dx * dx + dy * dy + 1e-6
        t = np.clip(((xx - xa) * dx + (yy - ya) * dy) / L2, 0, 1)
        px, py = xa + t * dx - xx, ya + t * dy - yy
        d = np.sqrt(px * px + py * py)
        ww = w * (0.35 + 0.65 * t) if taper else w
        a = np.clip(1 - d / ww, 0, 1) ** 1.3 * alpha
        if a.max() <= 0: return
        c = np.array(col, np.float32)
        self.over(x0, y0, (c[None, None] * a[..., None]).astype(np.float32), a.astype(np.float32))
        if glowk > 0:
            X0, Y0 = max(0, x0), max(0, y0); X1, Y1 = min(self.W, x1), min(self.H, y1)
            if X1 > X0 and Y1 > Y0:
                self.glow[Y0:Y1, X0:X1] += (c * glowk)[None, None] * a[Y0 - y0:Y1 - y0, X0 - x0:X1 - x0][..., None]

    def blob(self, x, y, r, col, alpha=1.0, glowk=0.0, power=1.5):
        """a soft radial light blob (flash core / halo)"""
        s = self.ss; x, y, r = x * s, y * s, r * s
        R = int(r) + 2; x0, y0 = int(x) - R, int(y) - R
        yy, xx = np.mgrid[0:2 * R, 0:2 * R].astype(np.float32)
        d = np.sqrt((xx + x0 - x) ** 2 + (yy + y0 - y) ** 2) / r
        a = (np.clip(1 - d, 0, 1) ** power * alpha).astype(np.float32)
        c = np.array(col, np.float32)
        self.over(x0, y0, c[None, None] * a[..., None], a)
        if glowk > 0:
            X0, Y0 = max(0, x0), max(0, y0); X1, Y1 = min(self.W, x0 + 2 * R), min(self.H, y0 + 2 * R)
            if X1 > X0 and Y1 > Y0:
                self.glow[Y0:Y1, X0:X1] += (c * glowk)[None, None] * a[Y0 - y0:Y1 - y0, X0 - x0:X1 - x0][..., None]

    def finish(self, bloom=(4.0, 14.0), bloomk=(0.55, 0.35), margin_fade=0):
        """bloom the emissive buffer (adds light and a little alpha), un-premultiply, downsample -> RGBA uint8"""
        rgb, a = self.rgb.copy(), self.a.copy()
        if self.glow.max() > 0:
            g = sum(ndimage.gaussian_filter(self.glow, (b * self.ss, b * self.ss, 0)) * k for b, k in zip(bloom, bloomk))
            ga = np.clip(g.max(-1), 0, 1) * 0.85
            rgb = rgb + g * (1 - a)[..., None] * 0.9 + g * a[..., None] * 0.35
            a = a + ga * (1 - a)
        s = self.ss
        H, W = self.H // s, self.W // s
        rgb = rgb.reshape(H, s, W, s, 3).mean((1, 3)); a = a.reshape(H, s, W, s).mean((1, 3))
        c = np.where(a[..., None] > 1e-4, rgb / np.maximum(a, 1e-4)[..., None], 0)
        c = np.clip(c, 0, 1); a = np.clip(a, 0, 1)
        # filmic-ish shoulder so hot cores stay white-yellow rather than clipping flat
        return (np.concatenate([c, a[..., None]], -1) * 255 + 0.5).astype(np.uint8)

def sheet(frames, cols):
    h, w = frames[0].shape[:2]; rows = (len(frames) + cols - 1) // cols
    out = np.zeros((rows * h, cols * w, 4), np.uint8)
    for i, f in enumerate(frames):
        out[(i // cols) * h:(i // cols + 1) * h, (i % cols) * w:(i % cols + 1) * w] = f
    return Image.fromarray(out, 'RGBA')

def smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)

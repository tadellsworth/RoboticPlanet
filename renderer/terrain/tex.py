"""Tileable texture toolkit for Terrafall terrain (numpy only).

Everything here is periodic on an N x N torus so textures tile seamlessly.
Coordinates: x right, y down. Light from the top-left (SVG azimuth 225).
"""
import numpy as np
from PIL import Image
from scipy import ndimage

TAU = 2 * np.pi


def hexrgb(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], float) / 255.0


def to_lin(c):
    return np.asarray(c, float) ** 2.2


def to_srgb(c):
    return np.clip(c, 0, 1) ** (1 / 2.2)


def norm01(a):
    a = a - a.min()
    return a / (a.max() + 1e-12)


def zscore(a):
    return (a - a.mean()) / (a.std() + 1e-12)


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0 + 1e-12), 0, 1)
    return t * t * (3 - 2 * t)


def fbm(n, seed, f_lo=2, f_hi=64, beta=1.0, aniso=(1.0, 1.0), angle=0.0, ny=None):
    """Spectral fBm, periodic. Frequencies in cycles per tile. Returns z-scored field.
    aniso=(ax, ay): stretch frequencies; angle rotates the anisotropy (radians)."""
    ny = ny or n
    rng = np.random.default_rng(seed)
    kx = np.fft.fftfreq(n) * n
    ky = np.fft.fftfreq(ny) * ny * (n / ny)
    KX, KY = np.meshgrid(kx, ky)
    c, s = np.cos(angle), np.sin(angle)
    RX = (c * KX + s * KY) / aniso[0]
    RY = (-s * KX + c * KY) / aniso[1]
    r = np.sqrt(RX ** 2 + RY ** 2)
    band = smoothstep(f_lo * 0.7, f_lo, r) * (1 - smoothstep(f_hi, f_hi * 1.4, r))
    amp = np.where(r > 0, (r + 1e-9) ** (-beta), 0) * band
    ph = rng.normal(size=(ny, n)) + 1j * rng.normal(size=(ny, n))
    f = np.real(np.fft.ifft2(amp * ph))
    return zscore(f)


def worley(n, pts, ny=None, k=2, metric_scale=(1.0, 1.0)):
    """Periodic Worley. pts: (m,2) in [0,1). Returns (F1, F2, id1) distances in tile units."""
    ny = ny or n
    ys, xs = np.mgrid[0:ny, 0:n]
    u = (xs + 0.5) / n
    v = (ys + 0.5) / ny
    F1 = np.full((ny, n), 9.0)
    F2 = np.full((ny, n), 9.0)
    ID = np.zeros((ny, n), int)
    sx, sy = metric_scale
    for i, (px, py) in enumerate(pts):
        dx = (u - px + 0.5) % 1.0 - 0.5
        dy = (v - py + 0.5) % 1.0 - 0.5
        d = np.sqrt((dx * sx) ** 2 + (dy * sy * ny / n) ** 2)
        closer = d < F1
        F2 = np.where(closer, F1, np.minimum(F2, d))
        ID = np.where(closer, i, ID)
        F1 = np.where(closer, d, F1)
    return F1, F2, ID


def normals_from_height(H, scale=1.0):
    gx = (np.roll(H, -1, 1) - np.roll(H, 1, 1)) * 0.5 * scale
    gy = (np.roll(H, -1, 0) - np.roll(H, 1, 0)) * 0.5 * scale
    N = np.stack([-gx, -gy, np.ones_like(H)], -1)
    return N / np.linalg.norm(N, axis=-1, keepdims=True)


def light_dir(az_deg=225, el_deg=55):
    az, el = np.radians(az_deg), np.radians(el_deg)
    return np.array([np.cos(el) * np.cos(az), np.cos(el) * np.sin(az), np.sin(el)])


def lambert(N, az=225, el=55):
    L = light_dir(az, el)
    return np.clip((N * L).sum(-1), 0, 1)


def relief(N, az=225, el=55):
    """Diffuse lighting normalised so a flat surface == 1 (keeps average brightness even)."""
    L = light_dir(az, el)
    return np.clip((N * L).sum(-1), 0, 1) / L[2]


def spec(N, power=30, az=225, el=40):
    L = light_dir(az, el)
    V = np.array([0, 0, 1.0])
    Hh = (L + V) / np.linalg.norm(L + V)
    return np.clip((N * Hh).sum(-1), 0, 1) ** power


def mix(a, b, t):
    t = np.asarray(t)[..., None] if np.ndim(t) else t
    return a + (b - a) * t


def blur_wrap(a, s):
    return ndimage.gaussian_filter(a, s, mode='wrap')


def downsample(img, f):
    h, w = img.shape[:2]
    return img.reshape(h // f, f, w // f, f, *img.shape[2:]).mean((1, 3))


def save_rgb(lin_or_srgb, path, is_linear=False):
    a = to_srgb(lin_or_srgb) if is_linear else np.clip(lin_or_srgb, 0, 1)
    __import__('os').makedirs(__import__('os').path.dirname(path) or '.', exist_ok=True)
    Image.fromarray((a * 255 + 0.5).astype(np.uint8), 'RGB').save(path)


def wrap_offsets(x, y, n, margin):
    """Copies of a point needed so an object of radius `margin` wraps around the torus."""
    out = []
    for ox in (-n, 0, n):
        for oy in (-n, 0, n):
            if -margin <= x + ox <= n + margin and -margin <= y + oy <= n + margin:
                out.append((x + ox, y + oy))
    return out


def stamp(dst, src, x, y, mode='over'):
    """Paste RGBA-ish float patch src (h,w,C) centred at (x,y) onto dst with wrapping (tiles)."""
    n = dst.shape[0]
    h, w = src.shape[:2]
    for (cx, cy) in wrap_offsets(x, y, n, max(h, w)):
        x0 = int(round(cx - w / 2))
        y0 = int(round(cy - h / 2))
        xa, ya = max(0, x0), max(0, y0)
        xb, yb = min(n, x0 + w), min(n, y0 + h)
        if xa >= xb or ya >= yb:
            continue
        sub = src[ya - y0:yb - y0, xa - x0:xb - x0]
        if mode == 'over':
            a = sub[..., 3:4]
            dst[ya:yb, xa:xb, :3] = dst[ya:yb, xa:xb, :3] * (1 - a) + sub[..., :3] * a
        elif mode == 'max':
            dst[ya:yb, xa:xb] = np.maximum(dst[ya:yb, xa:xb], sub)
        elif mode == 'add':
            dst[ya:yb, xa:xb] += sub

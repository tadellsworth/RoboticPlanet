# Adds the ground spill to the brake overlay and the dust puff to the boost overlay (both 384 px, truck framing:
# world x,z -> pixel ((x/10 + .5) * 384, (z/10 + .5) * 384)).
import sys, numpy as np
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
N = 384
P = lambda v: (v / 10 + 0.5) * N
yy, xx = np.mgrid[0:N, 0:N].astype(np.float32)

def over(base, rgb, a):
    """composite a colour layer (rgb 0..1, alpha a) UNDER the rendered lights (so the lenses stay crisp on top)."""
    b = np.asarray(base).astype(np.float32) / 255
    ba = b[..., 3:4]; la = a[..., None]
    oa = ba + la * (1 - ba)
    oc = (b[..., :3] * ba + np.array(rgb, np.float32) * la * (1 - ba)) / np.maximum(oa, 1e-4)
    return Image.fromarray((np.concatenate([oc, oa], 2).clip(0, 1) * 255 + 0.5).astype(np.uint8), 'RGBA')

def noise(seed, size):
    r = np.random.default_rng(seed).standard_normal((N, N)); f = np.fft.fft2(r)
    fy = np.fft.fftfreq(N)[:, None]; fx = np.fft.fftfreq(N)[None, :]
    n = np.real(np.fft.ifft2(f * np.exp(-(fx ** 2 + fy ** 2) * size ** 2 * 6))); return (n - n.mean()) / n.std()

# ---- brake: soft red light spilling on the ground just behind each rear corner
brake = Image.open(f'{src}/truck-brake.png')
xr = P(-4.25)
a = np.zeros((N, N), np.float32)
for z in (-1.28, 1.28):
    cy = P(z); cx = xr - 4
    d = ((xx - cx) / 20) ** 2 + ((yy - cy) / 16) ** 2
    a = np.maximum(a, 0.55 * np.exp(-d * 1.6) * (xx < xr + 6))
a *= np.clip(xx / 6, 0, 1)                                   # fade before the frame edge
over(brake, (1.0, 0.16, 0.1), a).save(f'{out}/truck-brake.png')

# ---- boost: dust kicked up behind the rear tyres, trailing off to the left; faint blue-white vent glow on the cab
boost = Image.open(f'{src}/truck-boost.png')
D = np.zeros((N, N), np.float32)
rng = np.random.default_rng(4)
tyre_back = P(-3.05 - 0.62)                                   # trailing edge of the rearmost tyres
for side in (-1, 1):
    zc = P(side * 1.62)
    for i in range(18):
        t = i / 17
        cx = tyre_back + 6 - t * (tyre_back + 2) + rng.uniform(-2, 2)
        cy = zc + side * (t * 12 + rng.uniform(-3, 3))
        r = 10 + 12 * t + rng.uniform(-1.5, 1.5)
        D += (0.8 - 0.5 * t) * np.exp(-(((xx - cx) ** 2 + (yy - cy) ** 2) / (r * r)))
gy, gx = np.gradient(D)                                      # shading from the smooth puff field only
n = noise(7, 6.0) * 0.85 + noise(8, 3.0) * 0.15
alpha = (1 - np.exp(-D * 1.9 * (0.85 + 0.2 * n))) * 0.8
alpha *= np.clip((xx - 1) / 12, 0, 1)                         # fade out before the left edge
alpha *= 1 - 0.5 * np.clip((xx - (tyre_back - 4)) / 16, 0, 1) # thinner over the tyres themselves
shade = np.clip(1 + 6.0 * (-(gx + gy)), 0.82, 1.18)[..., None]   # lit from the top left
dust = np.clip(np.array([0.84, 0.69, 0.52], np.float32) * shade, 0, 1)
# vent glow: dim the rendered slots and add a soft blue-white halo over each vent
b = np.asarray(boost).astype(np.float32) / 255
b[..., 3] *= 0.6
vx = P(1.92)
halo = np.zeros((N, N), np.float32)
for z in (-0.72, 0.72):
    vy = P(z); halo = np.maximum(halo, 0.45 * np.exp(-(((xx - vx) / 11) ** 2 + ((yy - vy) / 20) ** 2) * 1.4))
ha = halo[..., None]; ba = b[..., 3:4]
oa = ba + ha * (1 - ba); oc = (b[..., :3] * ba + np.array([0.78, 0.9, 1.0]) * ha * (1 - ba)) / np.maximum(oa, 1e-4)
la = alpha[..., None]
fa = oa + la * (1 - oa); fc = (oc * oa + dust * la * (1 - oa)) / np.maximum(fa, 1e-4)
Image.fromarray((np.concatenate([fc, fa], 2).clip(0, 1) * 255 + 0.5).astype(np.uint8), 'RGBA').save(f'{out}/truck-boost.png')
print('ok')

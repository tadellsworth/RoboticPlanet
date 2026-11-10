"""Night/evening headlight overlays: warm beams fanning ahead of each vehicle, on a canvas TWICE the vehicle sprite's
size... now THREE times (same centre, same 'facing right' orientation) so the beams have room. Lamp positions come from the models.
usage: headlights.py <unitsdir> <outdir>"""
import sys, os
import numpy as np
from PIL import Image
from scipy import ndimage
U, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)

def front_from_alpha(path):
    a = np.asarray(Image.open(path))[..., 3]
    ys, xs = np.where(a > 40)
    return xs.max() / a.shape[1], (ys.max() - ys.min()) / a.shape[0]

# name: (sprite size px, lamp x as fraction of sprite canvas, lamp half-spacing as fraction, beam length in sprite widths, beam half-angle)
V = {
    'truck':          (384, (4.12 / 10 + 0.5), 1.18 / 10, 0.95, 0.30),
    'roadtrain':      (256, (4.27 / 10 + 0.5), 1.25 / 10, 0.95, 0.30),
    'freight-loco':   (256, (3.77 / 10 + 0.5), 0.85 / 10, 1.10, 0.22),
    'crawler':        (512, (8.87 / 20 + 0.5), 2.1 / 20, 0.60, 0.34),
}
for r in ('worker', 'hauler', 'agribot', 'paver', 'warbot'):
    p = f'{U}/{r}@0-f0.png'
    fx, h = front_from_alpha(p)
    V[r] = (256, fx - 0.015, min(0.13, h * 0.32), 0.62, 0.34)

for name, (S, fx, lz, L, half) in V.items():
    N = 3 * S
    yy, xx = np.mgrid[0:N, 0:N].astype(np.float32)
    lx = S + fx * S
    a = np.zeros((N, N), np.float32)
    lens = np.zeros((N, N), np.float32)
    for sgn in (-1, 1):
        ly = N / 2 + sgn * lz * S
        dx, dy = xx - lx, yy - ly
        ang = np.arctan2(dy, np.maximum(dx, 1e-3)) - sgn * 0.07
        cone = np.exp(-(ang / half) ** 2) * (dx > 0)
        reach = L * S
        along = np.clip(dx / (0.04 * S), 0, 1) * np.exp(-np.maximum(dx, 0) / (reach * 0.55))
        a = np.maximum(a, 0.62 * cone * along)
        lens = np.maximum(lens, np.exp(-((dx ** 2 + dy ** 2) / (0.018 * S) ** 2)))
    # fade to nothing before the overlay's edge
    edge = np.clip((N - 2 - xx) / (0.45 * S), 0, 1) ** 1.5 * np.clip(xx / (0.1 * S), 0, 1) * np.clip(yy / (0.1 * S), 0, 1) * np.clip((N - 2 - yy) / (0.1 * S), 0, 1)
    a = ndimage.gaussian_filter(a, 0.006 * S) * edge
    A = np.clip(np.maximum(a, lens * 0.9), 0, 1)
    col = np.zeros((N, N, 3), np.float32) + np.array([1.0, 0.93, 0.76], np.float32)
    col = col * (1 - lens[..., None] * 0.5) + np.array([1, 1, 1], np.float32) * lens[..., None] * 0.5
    Image.fromarray((np.concatenate([col, A[..., None]], -1) * 255 + 0.5).astype(np.uint8), 'RGBA').save(f'{OUT}/{name}-headlights.png')
    print(name, N, 'lamp x', round(lx), 'spacing', round(lz * S * 2))

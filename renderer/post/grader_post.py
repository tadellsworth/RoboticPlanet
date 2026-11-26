"""The Grader's headlights (tod/shared/grader-headlights): warm light to add at dusk and night, on a canvas three times
the 256 px sprite (same centre, facing right), as the other vehicles' (post/headlights.py). Two hood lamps throw long
beams ahead of the blade; two work lights on the cab roof's front corners flood the ground wide and short in front and
to the sides, so a Grader at work stands in a pool of light. Lamp positions come from b/rob_grader.js (px coordinates,
the vehicle drawn 4 px left of centre).
usage: grader_post.py <outdir>   (writes <outdir>/grader-headlights.png)"""
import sys, os
import numpy as np
from PIL import Image
from scipy import ndimage

OUT = sys.argv[1] if len(sys.argv) > 1 else 'out/grader'
os.makedirs(OUT, exist_ok=True)
S = 256; N = 3 * S
yy, xx = np.mgrid[0:N, 0:N].astype(np.float32)
X = lambda px: S + 128 + px - 4          # model px -> overlay px
Y = lambda py: S + 128 + py
a = np.zeros((N, N), np.float32); lens = np.zeros((N, N), np.float32)

def beam(lx, ly, toe, half, reach, k, start=0.0):
    dx, dy = xx - lx, yy - ly
    ang = np.arctan2(dy, np.maximum(dx, 1e-3)) - toe
    cone = np.exp(-(ang / half) ** 2) * (dx > start)
    along = np.clip((dx - start) / (0.05 * S), 0, 1) * np.exp(-np.maximum(dx, 0) / (reach * 0.55))
    return k * cone * along

for s in (-1, 1):
    # hood lamps: long, fairly narrow, toed out a touch; they start past the blade
    a = np.maximum(a, beam(X(69), Y(s * 24), s * 0.06, 0.30, 0.70 * S, 0.62, start=0.12 * S))
    # roof work lights: wide flood, short, angled out to the sides
    a = np.maximum(a, beam(X(7), Y(s * 32), s * 0.35, 0.62, 0.42 * S, 0.42, start=0.2 * S))
    for lx, ly in ((X(69), Y(s * 24)), (X(7), Y(s * 32))):
        lens = np.maximum(lens, np.exp(-(((xx - lx) ** 2 + (yy - ly) ** 2) / (0.016 * S) ** 2)))
edge = np.clip((N - 2 - xx) / (0.45 * S), 0, 1) ** 1.5 * np.clip(xx / (0.1 * S), 0, 1) * np.clip(yy / (0.1 * S), 0, 1) * np.clip((N - 2 - yy) / (0.1 * S), 0, 1)
a = ndimage.gaussian_filter(a, 0.008 * S) * edge
A = np.clip(np.maximum(a, lens * 0.9), 0, 1)
col = np.zeros((N, N, 3), np.float32) + np.array([1.0, 0.93, 0.76], np.float32)
col = col * (1 - lens[..., None] * 0.5) + lens[..., None] * 0.5
Image.fromarray((np.concatenate([col, A[..., None]], -1) * 255 + 0.5).astype(np.uint8), 'RGBA').save(f'{OUT}/grader-headlights.png')
print('grader-headlights', N)

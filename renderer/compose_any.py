# usage: python3 compose.py <dir> name [name ...] [--glow 1.0]
# Adds bloom from the glow pass, downsamples 1024 -> 512 in premultiplied space, writes <name>.png,
# and a review sheet (full size on sand + 50 px phone size).
import sys, numpy as np
from PIL import Image, ImageFilter

args = sys.argv[1:]
d = args[0]; names = [a for a in args[1:] if not a.startswith('--')]
BL1 = float(args[args.index('--b1') + 1]) if '--b1' in args else 7.0
BL2 = float(args[args.index('--b2') + 1]) if '--b2' in args else 22.0
k = float(args[args.index('--glow') + 1]) if '--glow' in args else 1.0
names = [n for n in names if not n.replace('.', '').isdigit()]

def load(p): return np.asarray(Image.open(p).convert('RGBA')).astype(np.float32) / 255

for n in names:
    b = load(f'{d}/{n}.beauty.png'); g = load(f'{d}/{n}.glow.png')
    a = b[..., 3:4]; prem = b[..., :3] * a
    gl = (g[..., :3] * g[..., 3:4])
    gimg = Image.fromarray((gl * 255).astype(np.uint8))
    b1 = np.asarray(gimg.filter(ImageFilter.GaussianBlur(BL1))).astype(np.float32) / 255
    b2 = np.asarray(gimg.filter(ImageFilter.GaussianBlur(BL2))).astype(np.float32) / 255
    add = (0.9 * b1 + 1.1 * b2) * k
    prem = np.clip(prem + add, 0, 1)
    a2 = np.clip(a + add.max(axis=2, keepdims=True) * 0.95, 0, 1)
    out = np.concatenate([prem, a2], axis=2)
    H2 = out.shape[0] // 2; out = out.reshape(H2, 2, H2, 2, 4).mean(axis=(1, 3))
    rgb = np.where(out[..., 3:4] > 1e-4, out[..., :3] / np.maximum(out[..., 3:4], 1e-4), 0)
    final = np.concatenate([np.clip(rgb, 0, 1), out[..., 3:4]], axis=2)
    Image.fromarray((final * 255 + 0.5).astype(np.uint8), 'RGBA').save(f'{d}/{n}.png')

print('composed', names)

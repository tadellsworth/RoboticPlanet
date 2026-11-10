# usage: python3 compose.py <dir> name [name ...] [--glow 1.0]
# Adds bloom from the glow pass, downsamples 1024 -> 512 in premultiplied space, writes <name>.png,
# and a review sheet (full size on sand + 50 px phone size).
import sys, numpy as np
from PIL import Image, ImageFilter

args = sys.argv[1:]
d = args[0]; names = [a for a in args[1:] if not a.startswith('--')]
k = float(args[args.index('--glow') + 1]) if '--glow' in args else 1.0
names = [n for n in names if not n.replace('.', '').isdigit()]

def load(p): return np.asarray(Image.open(p).convert('RGBA')).astype(np.float32) / 255

for n in names:
    b = load(f'{d}/{n}.beauty.png'); g = load(f'{d}/{n}.glow.png')
    a = b[..., 3:4]; prem = b[..., :3] * a
    gl = (g[..., :3] * g[..., 3:4])
    gimg = Image.fromarray((gl * 255).astype(np.uint8))
    b1 = np.asarray(gimg.filter(ImageFilter.GaussianBlur(7))).astype(np.float32) / 255
    b2 = np.asarray(gimg.filter(ImageFilter.GaussianBlur(22))).astype(np.float32) / 255
    add = (0.9 * b1 + 1.1 * b2) * k
    prem = np.clip(prem + add, 0, 1)
    a2 = np.clip(a + add.max(axis=2, keepdims=True) * 0.95, 0, 1)
    out = np.concatenate([prem, a2], axis=2)
    out = out.reshape(512, 2, 512, 2, 4).mean(axis=(1, 3))          # 2x2 supersample -> 512
    rgb = np.where(out[..., 3:4] > 1e-4, out[..., :3] / np.maximum(out[..., 3:4], 1e-4), 0)
    final = np.concatenate([np.clip(rgb, 0, 1), out[..., 3:4]], axis=2)
    Image.fromarray((final * 255 + 0.5).astype(np.uint8), 'RGBA').save(f'{d}/{n}.png')

sand = (166, 117, 74, 255)
rows = []
for n in names:
    im = Image.open(f'{d}/{n}.png')
    row = Image.new('RGBA', (512 + 24 + 140, 512), (34, 34, 34, 255))
    bg = Image.new('RGBA', (512, 512), sand); bg.alpha_composite(im); row.paste(bg, (0, 0))
    sm = Image.new('RGBA', (120, 120), sand); s50 = im.resize((50, 50), Image.LANCZOS); sm.alpha_composite(s50, (35, 35)); row.paste(sm, (536, 196))
    rows.append(row)
sheet = Image.new('RGBA', (rows[0].width, 512 * len(rows) + 8 * (len(rows) - 1)), (34, 34, 34, 255))
for i, r in enumerate(rows): sheet.paste(r, (0, i * 520))
sheet.save(f'{d}/sheet-{"-".join(names)[:60]}.png')
print('composed', names)

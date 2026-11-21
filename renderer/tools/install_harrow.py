# usage: python3 tools/install_harrow.py <render folder> <the game's art folder> [--q 78] [--dry]
# Installs the Harrow's art (ART_GUIDE.md, Batch 31) as the game loads it (js/render.js: MURMUR_LOOK.harrow,
# MURMUR_POSES; the manifest's Murmur block), from tools/render_harrow.sh's folder (murmur_behemoth.js c=harrow&game=1,
# rendered at 1280 and composed with compose_any.py --b1 8 --b2 25 --glow 1.4, all hungry: charge=0.3):
#   <key>.png (day), <key>--morning.png, <key>--evening.png, <key>--night.png      (640 x 640 finals)
#   <key>--night.glow.png                                                        (the night render's raw glow pass)
# for every key: harrow-f0..3 (walking), harrow-slam-f0 (rearing) and -f1 (the slam), harrow-hurt-f0, harrow-fall-f0
# (dying), harrow-up-f0..2 (coming up out of its cave-in crater), harrow-crater (the crater it leaves) and
# harrow-cracks (the slam's broken ground). Writes bots/<key>.webp, tod/<time>/bots/<key>.webp and bots/<key>-glow.webp
# (the crystal's light alone: the night glow pass bloomed, one gain for every frame, 640 x 640).
import os
import sys
import numpy as np
from PIL import Image, ImageFilter

a = sys.argv[1:]
src, dst = a[0], a[1]
q = int(a[a.index('--q') + 1]) if '--q' in a else 78
dry = '--dry' in a
KEYS = [f'harrow-f{f}' for f in range(4)] + ['harrow-slam-f0', 'harrow-slam-f1', 'harrow-hurt-f0', 'harrow-fall-f0'] + [f'harrow-up-f{f}' for f in range(3)] + ['harrow-crater', 'harrow-cracks']
TODS = ['', '--morning', '--evening', '--night']
total = {'sprites': 0, 'glow': 0}


def save(im, rel, kind, quality=None):
    D = os.path.join(dst, rel)
    if not dry:
        os.makedirs(os.path.dirname(D), exist_ok=True)
        im.save(D, 'WEBP', quality=quality or q, method=6)
        total[kind] += os.path.getsize(D)
    print(f'{rel:44s} {os.path.getsize(D) if not dry else 0:8d}')


def glow_layer(path):
    """the glow pass, premultiplied, bloomed (a sharp core and two halos), at 1280"""
    g = np.asarray(Image.open(path).convert('RGBA')).astype(np.float32) / 255
    col = g[..., :3] * g[..., 3:4]
    im = Image.fromarray((np.clip(col, 0, 1) * 255).astype(np.uint8))
    b1 = np.asarray(im.filter(ImageFilter.GaussianBlur(6))).astype(np.float32) / 255
    b2 = np.asarray(im.filter(ImageFilter.GaussianBlur(20))).astype(np.float32) / 255
    return 0.7 * col + 1.0 * b1 + 0.9 * b2


def to_rgba(ov):
    h = ov.shape[0] // 2
    ov = ov.reshape(h, 2, h, 2, 3).mean(axis=(1, 3))
    al = np.clip(ov.max(-1, keepdims=True), 0, 1)
    rgb = np.where(al > 1e-3, ov / np.maximum(al, 1e-3), 0)
    return Image.fromarray((np.concatenate([np.clip(rgb, 0, 1), al], -1) * 255 + 0.5).astype(np.uint8), 'RGBA')


for k in KEYS:
    for t in TODS:
        S = os.path.join(src, k + t + '.png')
        if not os.path.exists(S): sys.exit(f'missing {S}')
        im = Image.open(S).convert('RGBA')
        if im.size != (640, 640): sys.exit(f'{S} is {im.size}')
        save(im, f"{'tod/' + t[2:] + '/' if t else ''}bots/{k}.webp", 'sprites')
layers = {k: glow_layer(os.path.join(src, k + '--night.glow.png')) for k in KEYS}
walk = np.concatenate([layers[k].max(-1).ravel() for k in KEYS[:4]])
peak = np.percentile(walk[walk > 0.004], 99.7) if (walk > 0.004).any() else 1
gain = min(14.0, 1.0 / max(peak, 1e-3))
print(f'harrow: glow gain {gain:.2f}')
for k in KEYS:
    save(to_rgba(np.clip(layers[k] * gain, 0, 1)), f'bots/{k}-glow.webp', 'glow', quality=70)
print(' '.join(f'{k} {v // 1024} KB' for k, v in total.items()))

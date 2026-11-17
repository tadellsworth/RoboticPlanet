# usage: python3 tools/install_murmur_forms.py <render folder> <fx folder> <the game's art folder> [--q 80] [--tods day,night] [--dry]
# Installs the Murmur's creature art as the game loads it (js/render.js: MURMUR_LOOK, MURMUR_POSES; the manifest's
# Murmur block), from one folder of murmur_moles.js renders composed with compose_any.py (--b1 3.5 --b2 10 --glow 1.4):
#   <key>.png (day), <key>--morning.png, <key>--evening.png, <key>--night.png      (256 x 256 finals)
#   <key>--night.glow.png                                                        (the night render's raw glow pass)
# where <key> is every frame: scuttler-f0..3, brute-f0..3, leech-f0..3, leech-feed-f0..3, spitter-f0..3,
# spitter-spit-f0..3, sapper-f0..3, sapper-dig-f0..3, sapper-under-f0..3, sapper-up-f0..4 (all rendered at charge=0.3,
# hungry: the game adds the rest of the light with the glow images, as bright as each is charged), and fx-spit
# (c=spit-shards, day and night). Writes:
#   bots/<key>.webp and tod/<time>/bots/<key>.webp       the sprites (lossy WebP with alpha, quality --q)
#   bots/<key>-glow.webp                                 the crystal's light alone: the night glow pass bloomed, scaled
#                                                        by one gain for every frame of a creature (so the frames of a
#                                                        loop don't flicker), un-premultiplied, 256 x 256
#   effects/fx-spit.webp, effects/fx-spit-glow.webp      the volley in flight (and its light)
#   effects/fx-spit-hit.webp                             the hit: fx/spit_impact.py's 8 frames of 128, in a row
import os
import sys
import numpy as np
from PIL import Image, ImageFilter

a = sys.argv[1:]
src, fxd, dst = a[0], a[1], a[2]
q = int(a[a.index('--q') + 1]) if '--q' in a else 80
dry = '--dry' in a
TODS = a[a.index('--tods') + 1].split(',') if '--tods' in a else ['day', 'morning', 'evening', 'night']   # (only these times)
F = {'scuttler': {'': 4}, 'brute': {'': 4}, 'leech': {'': 4, 'feed': 4}, 'spitter': {'': 4, 'spit': 4}, 'sapper': {'': 4, 'dig': 4, 'under': 4, 'up': 5}}
KEYS = {c: [f"{c}-{p + '-' if p else ''}f{f}" for p, n in d.items() for f in range(n)] for c, d in F.items()}
total = {'sprites': 0, 'glow': 0, 'fx': 0}


def save(im, rel, kind, quality=None, lossless=False):
    D = os.path.join(dst, rel)
    if not dry:
        os.makedirs(os.path.dirname(D), exist_ok=True)
        im.save(D, 'WEBP', quality=quality or q, method=6, lossless=lossless)
        total[kind] += os.path.getsize(D)
    print(f'{rel:44s} {os.path.getsize(D) if not dry else 0:8d}')


def glow_layer(path):
    """the glow pass, premultiplied, bloomed (a sharp core and two halos), at 512"""
    g = np.asarray(Image.open(path).convert('RGBA')).astype(np.float32) / 255
    col = g[..., :3] * g[..., 3:4]
    im = Image.fromarray((np.clip(col, 0, 1) * 255).astype(np.uint8))
    b1 = np.asarray(im.filter(ImageFilter.GaussianBlur(2.5))).astype(np.float32) / 255
    b2 = np.asarray(im.filter(ImageFilter.GaussianBlur(8))).astype(np.float32) / 255
    return 0.7 * col + 1.0 * b1 + 0.9 * b2


def to_rgba(ov):
    """light (premultiplied RGB on black) as an image to add: half size, alpha its brightness, colour un-premultiplied"""
    h = ov.shape[0] // 2
    ov = ov.reshape(h, 2, h, 2, 3).mean(axis=(1, 3))
    al = np.clip(ov.max(-1, keepdims=True), 0, 1)
    rgb = np.where(al > 1e-3, ov / np.maximum(al, 1e-3), 0)
    return Image.fromarray((np.concatenate([np.clip(rgb, 0, 1), al], -1) * 255 + 0.5).astype(np.uint8), 'RGBA')


for c, keys in KEYS.items():
    for k in keys:
        for t in ['' if x == 'day' else '--' + x for x in TODS]:
            S = os.path.join(src, k + t + '.png')
            if not os.path.exists(S): sys.exit(f'missing {S}')
            im = Image.open(S).convert('RGBA')
            if im.size != (256, 256): sys.exit(f'{S} is {im.size}')
            save(im, f"{'tod/' + t[2:] + '/' if t else ''}bots/{k}.webp", 'sprites')
    # one gain for the creature: its walking frames' brightest light (the top of it) brought to full
    layers = {k: glow_layer(os.path.join(src, k + '--night.glow.png')) for k in keys}
    walk = np.concatenate([layers[k].max(-1).ravel() for k in keys[:4]])
    peak = np.percentile(walk[walk > 0.004], 99.7) if (walk > 0.004).any() else 1
    gain = min(14.0, 1.0 / max(peak, 1e-3))
    print(f'{c}: glow gain {gain:.2f}')
    for k in keys:
        save(to_rgba(np.clip(layers[k] * gain, 0, 1)), f'bots/{k}-glow.webp', 'glow', quality=70)

# the volley, and its light
im = Image.open(os.path.join(src, 'fx-spit.png')).convert('RGBA')
save(im, 'effects/fx-spit.webp', 'fx')
L = glow_layer(os.path.join(src, 'fx-spit--night.glow.png'))
m = L.max(-1)
save(to_rgba(np.clip(L / max(np.percentile(m[m > 0.004], 99.7) if (m > 0.004).any() else 1, 1e-3), 0, 1)), 'effects/fx-spit-glow.webp', 'fx', quality=70)
# the hit: eight frames in a row
fr = [Image.open(os.path.join(fxd, f'spit-impact-f{i}.png')).convert('RGBA') for i in range(8)]
sheet = Image.new('RGBA', (128 * 8, 128))
for i, f in enumerate(fr): sheet.paste(f.resize((128, 128), Image.LANCZOS), (i * 128, 0))
save(sheet, 'effects/fx-spit-hit.webp', 'fx')
print(' '.join(f'{k} {v // 1024} KB' for k, v in total.items()))

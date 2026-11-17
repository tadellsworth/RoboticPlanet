# usage: python3 post/murmur_lore.py <composite.png> <out.webp> --class scuttler|brute|leech|spitter|sapper [--q 80]
# The Lore guide's Murmur pictures (art/lore/murmur-<class>.webp, 480 x 360): a 3/4 hero render of murmur_moles.js
# (hero=1&hi=2&tod=night, the Leech pose=feed), bloomed with compose_any.py, cropped 4:3 round the animal and shrunk.
# BOX is where each animal sits in its hero frame (0-1 image coordinates), measured from the same camera with the
# ground left out (ground=0); re-measure it if a hero camera or a model's size changes.
import sys
from PIL import Image

BOX = {
    'scuttler': (0.182, 0.326, 0.926, 0.664),
    'brute': (0.213, 0.277, 0.873, 0.656),
    'leech': (0.152, 0.24, 0.984, 0.795),       # with the power line it drinks from
    'spitter': (0.209, 0.33, 0.842, 0.637),
    'sapper': (0.16, 0.375, 0.881, 0.654),
}


def crop_box(b, pad=0.04, aspect=0.75):
    """a 4:3 window round the box: a little air either side, the animal a touch above the middle (its shadow below)"""
    x0, y0, x1, y1 = b
    w = (x1 - x0) * (1 + 2 * pad)
    h = max(w * aspect, (y1 - y0) * 1.12)
    w = h / aspect
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    left, top = cx - w / 2, cy - h * 0.46
    left = min(max(0, left), 1 - w); top = min(max(0, top), 1 - h)
    return left, top, left + w, top + h


def main():
    a = sys.argv[1:]
    src, out = a[0], a[1]
    cls = a[a.index('--class') + 1]
    q = int(a[a.index('--q') + 1]) if '--q' in a else 80
    im = Image.open(src).convert('RGBA')
    W, H = im.size
    l, t, r, b = crop_box(BOX[cls])
    im = im.crop((round(l * W), round(t * H), round(r * W), round(b * H))).resize((480, 360), Image.LANCZOS)
    im.save(out, 'WEBP', quality=q, method=6)
    print(out, im.size)


if __name__ == '__main__':
    main()

import sys
import numpy as np
from PIL import Image
# usage: check_tiles.py out.png tile.png ... -> for each: 2x2 tiling shrunk to 512 (seams) + 256 crop at 100%
paths = sys.argv[2:]
cols = []
for p in paths:
    im = Image.open(p).convert('RGB')
    n = im.size[0]
    T = Image.new('RGB', (2 * n, 2 * n))
    for x in range(2):
        for y in range(2):
            T.paste(im, (x * n, y * n))
    T = T.resize((512, 512), Image.LANCZOS) if 2 * n != 512 else T
    crop = im.crop((0, 0, 256, 256)) if n >= 256 else im.resize((256, 256), Image.NEAREST)
    a = np.asarray(im).astype(float)
    print(p, 'seam L/R %.2f T/B %.2f inner %.2f' % (np.abs(a[:, 0] - a[:, -1]).mean(), np.abs(a[0] - a[-1]).mean(), np.abs(a[:, 100] - a[:, 101]).mean()))
    cols.append((T, crop))
W = Image.new('RGB', (len(cols) * 520 + 8, 512 + 256 + 24), (30, 30, 30))
for i, (T, c) in enumerate(cols):
    W.paste(T, (8 + i * 520, 8))
    W.paste(c, (8 + i * 520, 528))
W.save(sys.argv[1])

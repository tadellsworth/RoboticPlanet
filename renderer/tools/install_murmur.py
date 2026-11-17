# usage: python3 tools/install_murmur.py <rebuilt art folder> <the game's art folder> [--q 80] [--dry]
# Installs the Murmur's sprites as the game loads them, from a folder laid out like tools/rerender.py's output
# (out/rerender/art: units/<c>-f<k>.png, buildings/nest-<s>.png and tod/<time>/... for each time of day, lore/murmur-*.webp):
#   units/scuttler-f0..3.png, units/brute-f0..3.png  ->  bots/<same>.webp            (256 x 256)
#   buildings/nest-1..3.png                           ->  buildings/<same>.webp       (512 x 512)
#   the same under tod/morning, tod/evening and tod/night
#   lore/murmur-<class>.webp                          ->  lore/<same>                 (480 x 360, already WebP)
# Sprites are saved as lossy WebP with alpha at quality --q (the default keeps the set no bigger than the art it
# replaced). It prints each file's size and the totals before and after; --dry only prints.
import os, sys
from PIL import Image

a = sys.argv[1:]
src, dst = a[0], a[1]
q = int(a[a.index('--q') + 1]) if '--q' in a else 80
dry = '--dry' in a
pairs = []
for t in ['', 'tod/morning/', 'tod/evening/', 'tod/night/']:
    for c in ('scuttler', 'brute'):
        for f in range(4): pairs.append((f'{t}units/{c}-f{f}.png', f'{t}bots/{c}-f{f}.webp', 256))
    for s in (1, 2, 3): pairs.append((f'{t}buildings/nest-{s}.png', f'{t}buildings/nest-{s}.webp', 512))
for c in ('scuttler', 'brute', 'leech', 'spitter', 'delver'): pairs.append((f'lore/murmur-{c}.webp', f'lore/murmur-{c}.webp', None))

before = after = 0
for s, d, size in pairs:
    S, D = os.path.join(src, s), os.path.join(dst, d)
    if not os.path.exists(S): sys.exit(f'missing {S}')
    old = os.path.getsize(D) if os.path.exists(D) else 0
    im = Image.open(S)
    if size and im.size != (size, size): sys.exit(f'{S} is {im.size}, not {size} x {size}')
    if not dry:
        os.makedirs(os.path.dirname(D), exist_ok=True)
        if size: im.convert('RGBA').save(D, 'WEBP', quality=q, method=6)
        else: open(D, 'wb').write(open(S, 'rb').read())
    new = os.path.getsize(D) if not dry else 0
    before += old; after += new
    print(f'{d:44s} {old:8d} -> {new:8d}')
print(f'{len(pairs)} files: {before} bytes before, {after} after ({after - before:+d})')

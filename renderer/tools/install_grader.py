"""Writes the Grader's art (the owner's concept A, "Dozer") into the game's art folder as WebP, from the composed renders
tools/render_grader.sh makes, and the terraforming effect sheets from fx/terraform.py. Run from renderer/:
    python3 fx/terraform.py out/grader/fx && python3 tools/install_grader.py [<game>/art]

  bots/grader@<team>-f<0..3>.webp        driving, the blade raised: 256 px, facing east (as the other robots)
  bots/grader-work@<team>-f<0..3>.webp   at work, the blade down
  bots/grader-load-<1..3>.webp           the heap of earth ahead of the blade at three sizes (team-neutral; drawn under it)
  bots/grader-brake.webp, -boost.webp    the brake lights and the dust kicked up, the same framing
  tod/<morning|evening|night>/bots/...   all of the above but the overlays, re-lit for each time of day
  tod/shared/grader-headlights.webp      hood lamps and roof work lights (3 x the sprite, halved as the others)
  effects/fx-grader-clods.webp           8 frames (4 x 2), a loop: clods and dust off the blade, facing east
  effects/fx-grader-splash.webp          8 frames (4 x 2): earth dropped into water
  effects/fx-mud-plume.webp              3 variants (3 x 1): silt spreading in the water
"""
import os
import shutil
import sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, '..', 'art')
OUT = os.path.join(ROOT, 'out', 'grader')
written = []


def save(src, rel, size=256, q=82):
    im = Image.open(src).convert('RGBA')
    if im.size != (size, size):
        im = im.resize((size, size), Image.LANCZOS)
    p = os.path.join(ART, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    im.save(p, 'WEBP', quality=q, method=6)
    written.append((rel, os.path.getsize(p)))


for tod in ('day', 'morning', 'evening', 'night'):
    pre = '' if tod == 'day' else f'tod/{tod}/'
    for t in (0, 1):
        for f in range(4):
            save(f'{OUT}/{tod}/grader@{t}-f{f}.png', f'{pre}bots/grader@{t}-f{f}.webp')
            save(f'{OUT}/{tod}/grader-work@{t}-f{f}.png', f'{pre}bots/grader-work@{t}-f{f}.webp')
    for n in (1, 2, 3):
        save(f'{OUT}/{tod}/grader-load-{n}.png', f'{pre}bots/grader-load-{n}.webp')
for o in ('brake', 'boost'):
    save(f'{OUT}/brake/grader-{o}.png', f'bots/grader-{o}.webp')
save(f'{OUT}/grader-headlights.png', 'tod/shared/grader-headlights.webp', size=384)
for n in ('fx-grader-clods', 'fx-grader-splash', 'fx-mud-plume'):
    p = os.path.join(ART, 'effects', n + '.webp')
    shutil.copyfile(f'{OUT}/fx/{n}.webp', p)
    written.append((f'effects/{n}.webp', os.path.getsize(p)))
total = sum(n for _, n in written)
print(f'{len(written)} files, {total // 1024} KB')

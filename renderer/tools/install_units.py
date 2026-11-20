"""Writes the Skirmisher, Arc Caster and Railgunner art into the game's art folder as WebP, from the composed renders
tools/render_units.sh makes. Run from renderer/:  python3 tools/install_units.py [<game>/art]

  bots/<robot>@<team>-f<0..3>.webp          four driving frames a team, 256 px, facing east (as the other robots)
  bots/<robot>-brake.webp, -boost.webp      the brake lights and the dust kicked up, the same framing
  tod/<morning|evening|night>/bots/...      the driving frames re-lit for each time of day
"""
import os
import sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, '..', 'art')
OUT = os.path.join(ROOT, 'out', 'units')
written = []


def save(src, rel, q=82):
    im = Image.open(src).convert('RGBA')
    if im.size != (256, 256):
        im = im.resize((256, 256), Image.LANCZOS)
    p = os.path.join(ART, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    im.save(p, 'WEBP', quality=q, method=6)
    written.append((rel, os.path.getsize(p)))


for r in ('skirmisher', 'arccaster', 'railgunner'):
    for tod in ('day', 'morning', 'evening', 'night'):
        pre = '' if tod == 'day' else f'tod/{tod}/'
        for t in (0, 1):
            for f in range(4):
                save(f'{OUT}/{tod}/{r}@{t}-f{f}.png', f'{pre}bots/{r}@{t}-f{f}.webp')
    for o in ('brake', 'boost'):
        save(f'{OUT}/brake/{r}-{o}.png', f'bots/{r}-{o}.webp')
total = sum(n for _, n in written)
print(f'{len(written)} files, {total // 1024} KB')

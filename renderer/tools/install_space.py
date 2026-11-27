"""Writes the space art (space expansion, phase 1) into the game's art folder as WebP, from the finished renders
tools/render_space.sh makes. Run from renderer/:
    python3 tools/install_space.py [<game>/art]

  bots/shuttle@T, shuttle-park@T       the Shuttle (b/ships.js c=shuttle_a, Frame Tug), straight down, nose east, flying and
                                        parked: 18 world units across (drawn SPACE_LOOK.frame.shuttle tiles wide: js/space.js)
  bots/dropship@T, dropship-park@T,    the Dropship (drop_a, Clamshell), and its stern ramp half and all the way down
       dropship-ramp1@T, -ramp2@T
  bots/gunship@T, gunship-park@T       the Gunship (gun_a, Lancet), 15 units across
  buildings/launchpad@T                the Launch Pad (b/launchpad.js v=a, Cradle Ring), the buildings' 57-degree view, drawn
                                        over its 2 by 2 tiles (B3D scale 1.4 at two tiles)
  buildings/pdturret-K@T               the Point-Defence Turret (b/pdturret.js v=a, Twin Rotary), guns at heading K (K x 45
                                        degrees clockwise from east), B3D scale 1.3
  space/rock-plain, -ore, -crystal     drifting asteroids (b/drift.js), straight down; -ore-tow, -crystal-tow in their harness
  space/mod-solar, -dock, -hulk        the derelict modules (b/module.js), straight down, derelict; -<kind>@T captured
  tod/<time>/...                       the same, re-lit for morning, evening and night
"""
import os
import sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, '..', 'art')
OUT = os.path.join(ROOT, 'out', 'space')
written = []

SIZE = {'shuttle': 320, 'dropship': 320, 'gunship': 256, 'launchpad': 512, 'pdturret': 256, 'rock': 256, 'mod': 384}


def save(name, rel, size, q=82):
    for tod in ('day', 'morning', 'evening', 'night'):
        src = f'{OUT}/{tod}/{name}.png'
        im = Image.open(src).convert('RGBA')
        if im.size[0] != size:
            im = im.resize((size, size), Image.LANCZOS)
        p = os.path.join(ART, ('' if tod == 'day' else f'tod/{tod}/') + rel)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        im.save(p, 'WEBP', quality=q, method=6)
        written.append((('' if tod == 'day' else f'tod/{tod}/') + rel, os.path.getsize(p)))


for t in (0, 1):
    for k in ('shuttle', 'shuttle-park', 'dropship', 'dropship-park', 'dropship-ramp1', 'dropship-ramp2', 'gunship', 'gunship-park'):
        save(f'{k}@{t}', f'bots/{k}@{t}.webp', SIZE[k.split('-')[0]])
    save(f'launchpad@{t}', f'buildings/launchpad@{t}.webp', SIZE['launchpad'])
    for k in range(8):
        save(f'pdturret-{k}@{t}', f'buildings/pdturret-{k}@{t}.webp', SIZE['pdturret'])
    for c in ('solar', 'dock', 'hulk'):
        save(f'mod-{c}@{t}', f'space/mod-{c}@{t}.webp', SIZE['mod'])
for c in ('solar', 'dock', 'hulk'):
    save(f'mod-{c}', f'space/mod-{c}.webp', SIZE['mod'])
for c in ('plain', 'ore', 'crystal', 'ore-tow', 'crystal-tow'):
    save(f'rock-{c}', f'space/rock-{c}.webp', SIZE['rock'])

total = 0
for rel, n in written:
    total += n
print(f'{len(written)} files, {total // 1024} KB')

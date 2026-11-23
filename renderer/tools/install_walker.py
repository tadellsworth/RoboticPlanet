"""Writes the Walking Factory's art (b/walker.js, the owner's look A "Foundry Crawler") into the game's art folder as
WebP, from the composed renders tools/render_walker.sh makes. Run from renderer/:
    python3 tools/install_walker.py [<game>/art]

  walker/walker-f0.webp … f5.webp     walking, the six frames of its tripod gait (one leg cycle per 1.3 tiles walked),
                                      straight down, facing right, 10 tiles across at 128 px a tile (1280 px), centred
                                      on the deck; the holder's parts dark
  walker/walker-rest.webp             dormant in its cradle: every foot down, the hull lowered, its lights out
  walker/tod/<time>/...               the same, re-lit for morning, evening and night
  walker/walker-team.webp             the holder's parts alone (the flank bands, the bay's door lights, the corner
                                      lamps) in white with their glow, at 640 px; the game tints it, at every time of day
  walker/walker-art.js                window.WALKER_ART: the list and the marks (in tiles from the sprite's middle: u
                                      ahead, v to its right): the exit (the chute's foot), the stacks, the crucible, the
                                      deck, and the feet's reach

All of it loads only for a Walking Factory map (ensureWalkerArt in js/walker.js); the one-file build bundles it beside
the page (dist/walker-art.js, by tools/build-single.js).
"""
import json
import os
import sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART = os.path.join(sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, '..', 'art'), 'walker')
OUT = os.path.join(ROOT, 'out', 'walker-game')
TILES = 10          # the frame's width in tiles (W=20 world units)
FRAMES = [f'walker-f{k}' for k in range(6)] + ['walker-rest']
written = []


def save(im, rel, q=82):
    p = os.path.join(ART, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    im.save(p, 'WEBP', quality=q, method=6)
    written.append((rel, os.path.getsize(p)))


for tod in ('day', 'morning', 'evening', 'night'):
    pre = '' if tod == 'day' else f'tod/{tod}/'
    for k in FRAMES:
        save(Image.open(f'{OUT}/{tod}/{k}.png').convert('RGBA'), f'{pre}{k}.webp')
# The holder's parts sit on the hull, which neither bobs nor turns between the frames (only the legs move, and they
# never cover them from straight above): one layer, half size (it's only light), serves every frame.
team = Image.open(f'{OUT}/day/walker-team.png').convert('RGBA')
save(team.resize((team.width // 2, team.height // 2), Image.LANCZOS), 'walker-team.webp', q=85)

# The marks (geom.json: fractions of the frame) in tiles from its middle: u ahead (right), v to its right (down).
g = json.load(open(f'{OUT}/day/walker-f0.geom.json'))['marks']
tl = lambda m: [round((m[0] - 0.5) * TILES, 3), round((m[1] - 0.5) * TILES, 3)]
marks = {k: tl(v) for k, v in g.items()}
size = Image.open(f'{OUT}/day/walker-f0.png').width
A = {
    'tiles': TILES, 'size': size, 'frames': 6, 'stride': 1.3, 'reach': 3.35,
    'tods': ['morning', 'evening', 'night'],
    'marks': {'exit': marks['exit'], 'deck': marks['deck'], 'crucible': marks['crucible'], 'stacks': [marks['stack0'], marks['stack1']]},
}
js = ('// The Walking Factory\'s art (renderer/tools/install_walker.py writes this file; ART_GUIDE.md): its list and marks.\n'
      'window.WALKER_ART = ' + json.dumps(A) + ';\n')
open(os.path.join(ART, 'walker-art.js'), 'w').write(js)
total = sum(s for _, s in written) + len(js)
for rel, s in written:
    print(f'{rel:36s} {s // 1024:5d} KB')
print(f'{len(written)} pictures, {total // 1024} KB in all; marks {A["marks"]}')

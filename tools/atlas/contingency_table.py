# Contingency's atlas table (CONTINGENCY.md, LORE.md: The atlas): writes js/contingency-atlas.js from what atlas.py
# leaves in tools/atlas/out/ (run atlas.py first): the 28 territories with their region and place on the globe
# (longitude, latitude in degrees, as atlas.py's T), their land borders (atlas.py's adj.json: cells of the atlas that
# touch), the sea crossings and orbit links (CONTINGENCY.md's tables), and a small map of which territory each spot of
# the globe belongs to (CONT_CELLS: 256 x 128, longitude -180 at the left, north up; one string per row, run-length
# coded: a letter a..z, A..B is a territory's index in CONT_TERR, '.' is sea; each followed by its run length).
# Usage: python3 tools/atlas/atlas.py && python3 tools/atlas/contingency_table.py
import json, os, numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out')
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
# id, the atlas's name (atlas.py's T), region key, lon, lat (atlas.py's centres; the caps at their label spots)
TERR = [
  ('pathfinder', "Pathfinder's Landing", 'rust', -118, 24), ('redwash', 'Redwash Flats', 'rust', -152, 30),
  ('dustgate', 'Dustgate', 'rust', -108, -4), ('ironbluff', 'Ironbluff', 'rust', -145, -6),
  ('passenger', 'Passenger Town', 'green', -86, 30), ('tallpine', 'Tallpine', 'green', -74, 56),
  ('stillwater', 'Stillwater', 'green', -100, 50),
  ('goldleaf', 'Goldleaf', 'ember', -160, 58), ('foxford', 'Foxford', 'ember', -128, 62),
  ('herdway', 'Herdway', 'grass', -22, 20), ('ledger', 'Ledger Post', 'grass', 2, 34), ('windsweep', 'Windsweep', 'grass', -12, 0),
  ('delta', 'the Delta', 'black', -22, -26), ('heron', 'Heron Reach', 'black', 4, -30),
  ('northcap', 'Northcap', 'polar', -80, 80), ('southcap', 'Southcap', 'polar', 80, -80),
  ('ringfall', 'Ringfall Basin', 'cinder', 80, -30), ('ashfield', 'Ashfield', 'cinder', 112, -42),
  ('cinderrift', 'Cinder Rift', 'cinder', 68, -54),
  ('terraces', 'the Terraces', 'steam', 108, 14), ('geyser', 'Geyser Field', 'steam', 80, 10),
  ('palmkeys', 'Palm Keys', 'shoals', -60, -4), ('lantern', 'Lantern Reef', 'shoals', -56, -22),
  ('violet', 'Violet Reach', 'bloom', 146, -20), ('bloomedge', 'Bloom Edge', 'bloom', 150, 12),
  ('hollow', 'the Hollow', 'hollow', 146, -20), ('lunar', 'Lunar Relay', 'argos', 0, 0), ('silent', 'Silent Crater', 'argos', 0, 0),
]
ATLAS_ORDER = ["Pathfinder's Landing", 'Redwash Flats', 'Dustgate', 'Ironbluff', 'Passenger Town', 'Tallpine', 'Stillwater',
  'Goldleaf', 'Foxford', 'Herdway', 'Ledger Post', 'Windsweep', 'the Delta', 'Heron Reach', 'Northcap', 'Southcap',
  'Ringfall Basin', 'Ashfield', 'Cinder Rift', 'the Terraces', 'Geyser Field', 'Palm Keys', 'Lantern Reef', 'Violet Reach', 'Bloom Edge']
SEA = [  # (from, to, the sea): CONTINGENCY.md, The atlas
  ('dustgate', 'palmkeys', 'the Warm Sea'), ('passenger', 'palmkeys', 'the Warm Sea'),
  ('windsweep', 'geyser', 'the Narrows'), ('windsweep', 'ringfall', 'the Narrows'), ('ledger', 'geyser', 'the Narrows'), ('ledger', 'ringfall', 'the Narrows'),
  ('heron', 'cinderrift', 'the Grey Sound'),
  ('bloomedge', 'goldleaf', 'the Long Sea'), ('bloomedge', 'redwash', 'the Long Sea'), ('bloomedge', 'ironbluff', 'the Long Sea'),
  ('violet', 'goldleaf', 'the Long Sea'), ('violet', 'redwash', 'the Long Sea'), ('violet', 'ironbluff', 'the Long Sea'),
  ('palmkeys', 'lantern', 'the Shoals\' channel'),  # (not in the table: the two keys share their reef; see IDEAS.md, Contingency)
]
BELOW = [('violet', 'hollow')]          # the Breach Fields: the way down (an assault only)
ORBIT = [('pathfinder', 'lunar'), ('pathfinder', 'silent')]  # (any Orbital Lift adds its own at run time)
MOON = [('lunar', 'silent')]            # Argos's own border
name2id = {n: i for i, n, *_ in TERR}
adj = json.load(open(os.path.join(OUT, 'adj.json')))['adj']
land = sorted({tuple(sorted((name2id[a], name2id[b]))) for a, b in adj})
land += [tuple(m) for m in MOON]
tid = np.load(os.path.join(OUT, 'tid.npy'))
W, H = 256, 128
small = np.asarray(Image.fromarray((tid + 1).astype(np.uint8)).resize((W, H), Image.NEAREST)).astype(int) - 1
# atlas index -> our index
ours = {k: [t[1] for t in TERR].index(n) for k, n in enumerate(ATLAS_ORDER)}
ALPHA = 'abcdefghijklmnopqrstuvwxyzAB'
rows = []
for j in range(H):
    s, i = '', 0
    while i < W:
        v = small[j, i]; k = i
        while k < W and small[j, k] == v: k += 1
        s += ('.' if v < 0 else ALPHA[ours[v]]) + str(k - i); i = k
    rows.append(s)
REG = {'rust': ('The Rust', 'desert'), 'green': ('Greenreach', 'jungle'), 'ember': ('Emberwood', 'autumn'),
  'grass': ('The Long Grass', 'savanna'), 'black': ('Blackwater', 'swamp'), 'polar': ('The Polar Caps', 'polar'),
  'cinder': ('Cinderlands', 'volcanic'), 'steam': ('Steamwells', 'springs'), 'shoals': ('The Shoals', 'tropical'),
  'bloom': ('The Bloom', 'alien'), 'hollow': ('The Hollow', 'hollow'), 'argos': ('Argos', 'lunar')}
js = ['\'use strict\';', '/*',
  ' * Terrafall: Contingency\'s atlas (CONTINGENCY.md; LORE.md, The atlas). Made by tools/atlas/contingency_table.py from',
  ' * tools/atlas/atlas.py: do not edit by hand. CONT_TERR: the 28 territories [id, name, region, lon, lat]; CONT_LAND: land',
  ' * borders (atlas cells that touch, and Argos\'s own); CONT_SEA: sea crossings [from, to, sea]; CONT_BELOW: the way down to',
  ' * the Hollow; CONT_ORBIT: orbit links; CONT_REGIONS: region key -> [name, biome]; CONT_CELLS: which territory each spot of',
  ' * the globe is (256 x 128, run-length coded rows: a letter is a territory index, \'.\' is sea).', ' */',
  'const CONT_TERR = ' + json.dumps([list(t) for t in TERR]) + ';',
  'const CONT_LAND = ' + json.dumps([list(e) for e in land]) + ';',
  'const CONT_SEA = ' + json.dumps([list(e) for e in SEA]) + ';',
  'const CONT_BELOW = ' + json.dumps([list(e) for e in BELOW]) + ';',
  'const CONT_ORBIT = ' + json.dumps([list(e) for e in ORBIT]) + ';',
  'const CONT_REGIONS = ' + json.dumps(REG) + ';',
  'const CONT_CELLS = { w: %d, h: %d, rows: %s };' % (W, H, json.dumps(rows)), '']
open(os.path.join(ROOT, 'js', 'contingency-atlas.js'), 'w').write('\n'.join(js))
print('wrote js/contingency-atlas.js:', len(land), 'land borders,', len(SEA), 'sea crossings')

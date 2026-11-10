"""2A: emitter points for animated buildings. World points per building (read off each scene), projected by the renderer
(L.mark via ?mk=) into the 512 canvas. Writes building-emitters.json keyed by the game's building ids."""
import os as _os, sys as _sys
_HERE = _os.path.dirname(_os.path.abspath(__file__)); _ROOT = _os.path.dirname(_HERE)
import json, subprocess, urllib.parse, os
# usage: emitters.py [<rawdir>] [<out json>]
R2 = _ROOT; OUT = _os.path.abspath(_sys.argv[1] if len(_sys.argv) > 1 else 'out/emit'); os.makedirs(OUT, exist_ok=True)
JSON_OUT = _sys.argv[2] if len(_sys.argv) > 2 else _os.path.join(OUT, 'building-emitters.json')

# game id: (scene, accent, team, [ (kind, size, (x, y, z)), ... ])
E = {
    'smelter':   ('smelter', '#ff8a1e', '', [('smoke', 1.2, (2.9, 7.25, -3.1)), ('sparks', 1.0, (-1.1, 1.0, 1.75))]),
    'fab':       ('fab', '#b4ff3c', '', [('steam', 0.6, (-2.8, 3.75, -2.9)), ('steam', 0.6, (1.6, 3.75, -2.9)), ('steam', 0.6, (2.0, 3.82, 0.7))]),
    'foundry':   ('foundry', '#8fdcff', '', [('sparks', 0.8, (-0.65, 0.78, 1.4)), ('sparks', 0.8, (0.25, 0.78, 1.4)), ('steam', 0.6, (1.2, 4.4, -0.4))]),
    'refinery':  ('refinery', '#5b8cff', '', [('flame', 1.0, (4.2, 5.2, -4.1)), ('steam', 0.8, (-2.5, 7.67, -2.4))]),
    'kiln':      ('cement', '#ff5a1a', '', [('smoke', 1.2, (-3.95, 4.08, 0.7)), ('dust', 0.8, (3.5, 1.9, 1.0))]),
    'tarworks':  ('asphalt', '#ffd84a', '', [('black', 1.0, (-1.0, 4.62, -3.1)), ('steam', 0.7, (2.6, 1.6, 2.6))]),
    'munitions': ('ammoplant', '', '#38d4ff', [('steam', 0.6, (-3.1, 3.35, -2.6)), ('steam', 0.6, (-1.7, 3.35, -2.6)), ('steam', 0.6, (-0.3, 3.35, -2.6))]),
    'armory':    ('missilefactory', '', '#38d4ff', [('steam', 0.6, (1.8, 4.24, -3.0)), ('steam', 0.6, (2.7, 4.24, -3.0))]),
    'reactor':   ('nreactor', '#9dff3a', '', [('steam', 2.5, (-2.45, 5.42, -2.25))]),
    'charger':   ('charger', '#44ff88', '', []),
    'quarry':    ('quarry', '#ffb02e', '', [('dust', 1.0, (-1.9, 4.15, -1.6))]),
    'mine':      ('mine', '#ff7a1a', '', [('dust', 0.9, (-1.0, 0.95, -0.9))]),
    'roadworks': ('roadworks', '#ffb22e', '', [('steam', 0.6, (-0.55, 0.65, 2.3))]),
    'lander':    ('hq', '', '#38d4ff', [('steam', 0.5, (-2.1, 1.9, -0.85)), ('steam', 0.5, (2.1, 1.9, -0.85))]),
    # a point given as a name uses a mark the scene sets itself (the Generator's exhaust stack tips)
    'generator': ('generator', '#ffe23d', '', [('smoke', 0.9, 'ex0'), ('smoke', 0.9, 'ex1')]),
}

jobs = []
for gid, (scene, acc, team, pts) in E.items():
    mk = json.dumps([[f'e{i}', *p] for i, (_, _, p) in enumerate(pts) if not isinstance(p, str)] or [['none', 0, 0, 0]], separators=(',', '%'))
    mk = mk.replace('%', ',')
    jobs.append(f"{scene}:{acc}:{team}:em-{gid}:mk={urllib.parse.quote(mk, safe='')}")
subprocess.run(['node', 'run.js', OUT] + jobs, cwd=R2, check=True, stdout=open(OUT + '/render.log', 'w'), stderr=subprocess.STDOUT)
res = {'_note': 'Pixel positions in each building\'s 512 x 512 canvas (anchor [0.5, 0.615], scale 1.4). '
                'kind: smoke | black | steam | flame | sparks | dust. size: 1 = a normal chimney puff. '
                'The fx sheets start at the bottom centre of each frame: put that on px.'}
for gid, (scene, acc, team, pts) in E.items():
    g = json.load(open(f'{OUT}/em-{gid}.geom.json'))['marks']
    res[gid] = [{'kind': k, 'px': [round(g[p if isinstance(p, str) else f'e{i}'][0] * 512, 1), round(g[p if isinstance(p, str) else f'e{i}'][1] * 512, 1)], 'size': s} for i, (k, s, p) in enumerate(pts)]
gen = res.pop('generator'); res['lander@0'] = res.pop('lander'); res['lander@1'] = res['lander@0']; res['generator'] = gen
json.dump(res, open(JSON_OUT, 'w'), indent=1)
print(json.dumps(res)[:1500])

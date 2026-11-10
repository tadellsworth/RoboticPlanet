"""Rebuild the point files the game reads, from the .geom.json marks the scenes report.
usage: points.py <rawdir> <outdir>

<rawdir> must hold these renders' .geom.json (any time of day; marks don't change with the light):
  truck@0-f0, tanker@0-f0, roadtrain@0-f0, generator, bunker@0, disruptor@0, streetlamp-road, streetlamp-asphalt
Writes exhaust-points.json, generator-points.json, defences-points.json and streetlamps.json."""
import sys, os, json

raw, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)


def marks(name):
    return json.load(open(os.path.join(raw, f'{name}.geom.json')))['marks']


def px(m, size):
    return [round(m[0] * size, 1), round(m[1] * size, 1)]


def write(name, obj):
    json.dump(obj, open(os.path.join(out, name), 'w'), indent=1)
    print('wrote', name)


ex = {'note': 'Exhaust stack tips in pixels of each vehicle sprite (facing right, unrotated). Rotate them with the vehicle. '
              'Every vehicle canvas spans 10 world units, so draw one 64-px puff frame at 0.17 x the drawn sprite width.'}
for key, name, size in (('truck', 'truck@0-f0', 384), ('tanker', 'tanker@0-f0', 384), ('roadtrain', 'roadtrain@0-f0', 256)):
    m = marks(name)
    ex[key] = {'canvas': size, 'tips': [px(m['ex0'], size), px(m['ex1'], size)]}
write('exhaust-points.json', ex)

g = marks('generator')
write('generator-points.json', {'note': 'Pixels in the generator 512 canvas. fill = where the tanker hose connects (park the tanker with its rear here).',
                                'fill_px': px(g['fill'], 512), 'exhaust_px': [px(g['ex0'], 512), px(g['ex1'], 512)]})

b, d = marks('bunker@0'), marks('disruptor@0')
write('defences-points.json', {'bunker_gun_muzzles_px': {'gun0': px(b['gun0'], 512), 'gun1': px(b['gun1'], 512)},
                               'disruptor_orb_px': px(d['orb'], 512)})

lamps = {}
for kind in ('road', 'asphalt'):
    m = marks(f'streetlamp-{kind}')
    lamps[f'streetlamp-{kind}'] = {'foot_px': px(m['foot'], 256), 'lamp_head_px': px(m['lens'], 256), 'top_px': round(m['top'][1] * 256, 1)}
lamps['note'] = 'Pixels in the 256 x 256 canvas. Draw the canvas 1 map tile across; the lamp is then about 0.9 tiles tall.'
write('streetlamps.json', lamps)

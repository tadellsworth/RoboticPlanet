"""The job catalogue: every delivered image (and data file), with the exact render job and the steps that finish it.
Run it to rewrite jobs.txt:   python3 tools/catalogue.py > jobs.txt
tools/rerender.py reads jobs.txt, not this file.

Each entry is  (file, renderer, jobs, finish):
  file      where the file sits in the game's art folder (day art in art/<group>/, other times in art/tod/<time>/<group>/)
  renderer  main  = node run.js            (the three.js renderer for everything but walls)
            walls = node walls/run.js      (the wall and gate renderer)
            -     = no render: a Python script makes it
  jobs      one or more run.js jobs, space-separated (- for none). The job's output name is the 4th field.
  finish    the steps after rendering, separated by ' | ':
              compose.py ... / compose_any.py ... / compose2.py ... / walls/compose_walls.py ...   bloom + 2x downsample
              none                                                                                  use the raw pass
              any other command, run once from the package folder, with
                {raw} = the folder the renders and composites go to,  {fin} = the folder for finished files,
                {art} = the art folder being rebuilt (game layout),     {tod} = the time of day
"""
P0, P1 = '#38d4ff', '#ff5a6e'
TEAMS = [('@0', P0), ('@1', P1)]
TODS = ['morning', 'evening', 'night']
ALL = ['day'] + TODS
E = []           # (section, file, renderer, jobs, finish)
SECTION = ['']


def section(title): SECTION[0] = title


def add(file, renderer, jobs, finish):
    if isinstance(jobs, (list, tuple)): jobs = ' '.join(jobs)
    E.append((SECTION[0], file, renderer, jobs or '-', finish))


def job(scene, accent, team, name, extra=''):
    return f'{scene}:{accent}:{team}:{name}' + (f':{extra}' if extra else '')


def at(extra, tod):
    if tod == 'day': return extra
    return (extra + '&' if extra else '') + f'tod={tod}'


def path(tod, group, name):
    return f'art/{group}/{name}' if tod == 'day' else f'art/tod/{tod}/{group}/{name}'


# ------------------------------------------------------------------ buildings
BUILD = [('harvester', '#3ff0d0', 'harvester'), ('quarry', '#ffb02e', 'quarry'), ('mine', '#ff7a1a', 'mine'), ('tap', '#8f7bff', 'tap'),
         ('smelter', '#ff8a1e', 'smelter'), ('fab', '#b4ff3c', 'fab'), ('foundry', '#8fdcff', 'foundry'), ('depot', '#ffd36b', 'depot'),
         ('grower', '#4ff0c8', 'grower'), ('site', '#ffb02e', 'site'), ('charger', '#44ff88', 'charging-station'),
         ('biofarm', '#ff4fd0', 'bio-farm'), ('oilpump', '#ffa030', 'oil-pump'), ('refinery', '#5b8cff', 'refinery'),
         ('cement', '#ff5a1a', 'cement-works'), ('asphalt', '#ffd84a', 'asphalt-plant'), ('roadworks', '#ffb22e', 'roadworks'),
         ('ramp', '#ffd36b', 'ramp'), ('repairbay', '#ff9a3c', 'repair-bay'), ('nreactor', '#9dff3a', 'nuclear-reactor'),
         ('lab', '#b98cff', 'lab'), ('generator', '#ffe23d', 'generator')]
TEAMB = [('outpost', 'outpost', ''), ('hq', 'lander', ''), ('pulseturret', 'turret', ''), ('silo', 'missile-silo', ''),
         ('missilefactory', 'missile-factory', ''), ('ammoplant', 'ammo-plant', ''), ('nsilo', 'nuclear-silo', ''),
         ('silo', 'silo-empty', 'empty=1'), ('nsilo', 'nuclear-silo-empty', 'empty=1'), ('station', 'station', ''),
         ('ropeway', 'ropeway', ''), ('bunker', 'bunker', ''), ('mortar', 'mortar', 'part=base')]

for tod in ALL:
    section(f'Buildings ({tod}): 512 px, shared pad, anchor 0.5 0.615')
    for scene, acc, name in BUILD:
        add(path(tod, 'buildings', f'{name}.png'), 'main', job(scene, acc, '', name, at('', tod)), 'compose.py')
    for t, c in TEAMS:
        for scene, name, extra in TEAMB:
            add(path(tod, 'buildings', f'{name}{t}.png'), 'main', job(scene, '', c, f'{name}{t}', at(extra, tod)), 'compose.py')
        add(path(tod, 'buildings', f'disruptor{t}.png'), 'main', job('disruptor', '', c, f'disruptor{t}', at('', tod)), 'compose.py --glow 0.4')
    for s in (1, 2, 3):
        add(path(tod, 'buildings', f'nest-{s}.png'), 'main', job('nest', '', '', f'nest-{s}', at(f's={s}', tod)), 'compose.py')

    section(f'Gun heads ({tod}): K turns clockwise on screen from right')
    for t, c in TEAMS:
        for k in range(16):
            j = job('pulseturret', '', c, f'turret16-{k}{t}', at(f'part=head&rot={k}&n=16', tod))
            if tod == 'day': add(path(tod, 'buildings', f'turret-head-{k}{t}.png'), 'main', j, 'compose.py')
            else: add(path(tod, 'buildings', f'turret-16dir/turret-head-{k}{t}.png'), 'main', j, 'compose.py')
        if tod != 'day':   # the 8-direction heads: head K of 8 is head 2K of 16 (same render)
            for k in range(8):
                add(path(tod, 'buildings', f'turret-head-{k}{t}.png'), 'main',
                    job('pulseturret', '', c, f'turret16-{2 * k}{t}', at(f'part=head&rot={2 * k}&n=16', tod)), 'compose.py')
    for k in range(8):
        add(path(tod, 'buildings', f'mortar-head-{k}.png'), 'main', job('mortar', '', '', f'mortar-head-{k}', at(f'part=head&rot={k}&n=8', tod)), 'compose.py')
    for k in range(16):
        add(path(tod, 'buildings', f'mortar-16dir/mortar-head-{k}.png'), 'main', job('mortar', '', '', f'mortar16-{k}', at(f'part=head&rot={k}&n=16', tod)), 'compose.py')

section('Building overlays and working loops (day only: they are light, or play over the building)')
add('art/buildings/bunker-fire@0.png', 'main', job('bunker', '', P0, 'bunker@0'), 'post/defence_overlays.py fire {raw}/bunker@0.geom.json {fin}/bunker-fire@0.png')
add('art/buildings/bunker-fire@1.png', 'main', job('bunker', '', P0, 'bunker@0'), 'post/defence_overlays.py fire {raw}/bunker@0.geom.json {fin}/bunker-fire@1.png')
add('art/buildings/disruptor-pulse.png', 'main', job('disruptor', '', '', 'disruptor-pulse.raw', 'part=pulse'),
    'none | post/defence_overlays.py pulse {raw}/disruptor-pulse.raw.beauty.png {raw}/disruptor-pulse.raw.geom.json {fin}/disruptor-pulse.png')
for k in range(8):
    add(f'art/buildings/smelter-work-{k}.png', 'main', job('smelter', '#ff8a1e', '', f'smelter-work-{k}', f'part=work&f={k}'), 'compose.py | post/post_loops.py embers {raw}')
for k in range(8):
    add(f'art/buildings/refinery-work-{k}.png', 'main', job('refinery', '#5b8cff', '', f'refinery-work-{k}', f'part=work&f={k}'), 'compose.py')
add('art/buildings/pump-base.png', 'main', job('oilpump', '#ffa030', '', 'pump-base', 'part=base'), 'compose.py')
for k in range(8):
    add(f'art/buildings/pump-work-{k}.png', 'main', job('oilpump', '#ffa030', '', f'pump-work-{k}', f'part=work&f={k}'), 'compose.py')
for k in range(8):
    add(f'art/buildings/generator-work-{k}.png', 'main', job('generator', '#ffe23d', '', f'generator-work-{k}', f'part=work&f={k}'), 'compose.py')

section('Pulse Cannon charge and laser (day only: light)')
CHARGE = [job('pulseturret', '', P0, f'charge-{k}', f'part=charge&rot={k}&n=16') for k in range(16)]
for k in range(16):
    add(f'art/effects/turret-charge/turret-charge-{k}.png', 'main', CHARGE, 'none | post/pulsefx.py {raw} {fin}')
for f in ('fx-pulse-laser.png', 'fx-pulse-hit.png', 'pulse-muzzles.json'):
    add(f'art/effects/{f}', 'main', CHARGE, 'none | post/pulsefx.py {raw} {fin}')

# ------------------------------------------------------------------ tiles
for tod in ALL:
    section(f'Rail track tiles ({tod})')
    for p, n in [('straight', 'rail-straight'), ('curve', 'rail-curve'), ('tee', 'rail-tee'), ('cross', 'rail-cross'), ('end', 'rail-end'),
                 ('level', 'rail-level-crossing'), ('barrier-up', 'rail-barrier-up'), ('barrier-down', 'rail-barrier-down')]:
        add(path(tod, 'rail', f'{n}.png'), 'main', job('rail', '', '', n, at(f'piece={p}', tod)), 'compose_any.py --b1 4 --b2 10')
    if tod == 'day':
        add('art/rail/rail-lights-on.png', 'main', job('rail', '', '', 'rail-lights-on', 'piece=lights-on'), 'compose_any.py --b1 4 --b2 10')
    section(f'Bridges ({tod})')
    for style, pre in (('water', 'bridge'), ('sky', 'skybridge'), ('rail', 'railbridge')):
        pcs = ['ew', 'ns', 'end-w', 'end-e', 'end-n', 'end-s', 'ramp-w', 'ramp-e', 'ramp-n', 'ramp-s', 'pier'] + (['tower', 'cable'] if style == 'sky' else [])
        for p in pcs:
            haze = p == 'pier' and style != 'water'
            add(path(tod, 'bridges', f'{pre}-{p}.png'), 'main', job('bridge', '', '', f'{pre}-{p}', at(f'style={style}&piece={p}', tod)),
                'compose2.py --b1 4 --b2 12' + (' --haze' if haze else ''))
    if tod == 'day':
        add('art/bridges/skybridge-tower-lamp.png', 'main', job('bridge', '', '', 'skybridge-tower-lamp', 'style=sky&piece=lamp'), 'compose2.py --b1 4 --b2 12')

# ------------------------------------------------------------------ units
TRUCK = 'compose_any.py --b1 5 --b2 15'
ROB = 'compose_any.py --b1 3.5 --b2 10 --glow 1.4'
VEH = 'compose_any.py --b1 3.5 --b2 10'
CRAWL = 'compose_any.py --b1 6 --b2 16'
for tod in ALL:
    section(f'Vehicles, robots and creatures ({tod}): top-down, facing right')
    for t, c in TEAMS:
        for f in range(4):
            add(path(tod, 'units', f'truck{t}-f{f}.png'), 'main', job('truck', '', c, f'truck{t}-f{f}', at(f'f={f}', tod)), TRUCK)
        for f in range(4):
            add(path(tod, 'units', f'tanker{t}-f{f}.png'), 'main', job('tanker', '', c, f'tanker{t}-f{f}', at(f'f={f}', tod)), TRUCK)
        for r in ('worker', 'hauler', 'agribot', 'paver', 'warbot'):
            for f in range(4):
                add(path(tod, 'units', f'{r}{t}-f{f}.png'), 'main', job(f'rob_{r}', '', c, f'{r}{t}-f{f}', at(f'f={f}', tod)), ROB)
        for f in range(4):
            add(path(tod, 'units', f'roadtrain{t}-f{f}.png'), 'main', job('roadtrain', '', c, f'roadtrain{t}-f{f}', at(f'f={f}', tod)), VEH)
        add(path(tod, 'units', f'roadtrain-trailer{t}.png'), 'main', job('roadtrain', '', c, f'roadtrain-trailer{t}', at('part=trailer', tod)), VEH)
        for f in range(4):
            add(path(tod, 'units', f'freight-loco{t}-f{f}.png'), 'main', job('freight', '', c, f'freight-loco{t}-f{f}', at(f'f={f}', tod)), VEH)
        for w in ('flat', 'hopper'):
            add(path(tod, 'units', f'freight-wagon-{w}{t}.png'), 'main', job('freight', '', c, f'freight-wagon-{w}{t}', at(f'part={w}', tod)), VEH)
        for f in range(8):
            add(path(tod, 'units', f'crawler{t}-f{f}.png'), 'main', job('crawler', '', c, f'crawler{t}-f{f}', at(f'f={f}', tod)), CRAWL)
        # deploy: d0 is the drive frame f0, d9 is also crawlerbase; d3 gets dust puffs at the foot pads
        add(path(tod, 'units', f'crawler-deploy{t}-d0.png'), 'main', job('crawler', '', c, f'crawler{t}-f0', at('f=0', tod)), CRAWL)
        for k in range(1, 10):
            fin = CRAWL
            if k == 3: fin += ' | post/crawler_overlays.py {raw} {fin}' if tod == 'day' else ' | post/tod_post.py {tod} {art}/tod/{tod}'
            add(path(tod, 'units', f'crawler-deploy{t}-d{k}.png'), 'main', job('crawler', '', c, f'crawler-deploy{t}-d{k}', at(f'd={k}', tod)), fin)
        add(path(tod, 'units', f'crawlerbase{t}.png'), 'main', job('crawler', '', c, f'crawler-deploy{t}-d9', at('d=9', tod)), CRAWL)
        add(path(tod, 'units', f'gondola{t}.png'), 'main', job('gondola', '', c, f'gondola{t}', at('', tod)), VEH)
    add(path(tod, 'units', 'crawler-dish.png'), 'main', job('crawler', '', P0, 'crawler-dish', at('part=dish', tod)), CRAWL)
    add(path(tod, 'units', 'trader-ship.png'), 'main', job('trader', '', '', 'trader-ship', at('', tod)), VEH)
    for cr in ('scuttler', 'brute'):
        for f in range(4):
            add(path(tod, 'units', f'{cr}-f{f}.png'), 'main', job('creature', '', '', f'{cr}-f{f}', at(f'c={cr}&f={f}', tod)), ROB)

section('Vehicle light overlays (day only: light, drawn over the sprite at every time of day)')
add('art/units/truck-brake.png', 'main', job('truck', '', P0, 'truck-brake', 'part=brake'), TRUCK + ' | post/truck_overlays.py {raw} {fin}')
add('art/units/truck-boost.png', 'main', job('truck', '', P0, 'truck-boost', 'part=boost'), TRUCK + ' | post/truck_overlays.py {raw} {fin}')
add('art/units/tanker-brake.png', 'main', job('tanker', '', '', 'tanker-brake', 'part=brake'), TRUCK)
add('art/units/tanker-boost.png', 'main', job('tanker', '', '', 'tanker-boost', 'part=boost'), TRUCK)
for r in ('worker', 'hauler', 'agribot', 'paver', 'warbot'):
    for o in ('brake', 'boost'):   # robot_overlays.py makes both from the brake lens render
        add(f'art/units/{r}-{o}.png', 'main', [job(f'rob_{x}', '', P0, f'{x}-brake', 'part=brake') for x in ('worker', 'hauler', 'agribot', 'paver', 'warbot')],
            ROB + ' | post/robot_overlays.py {raw} {fin}')
add('art/units/roadtrain-brake.png', 'main', job('roadtrain', '', '', 'roadtrain-brake', 'part=brake'), VEH + ' | post/roadtrain_overlays.py {raw} {fin}')
FR = [job('freight', '', P0, 'freight-loco-heads', 'part=heads'), job('freight', '', P0, 'freight-loco-brake', 'part=brake')]
for o in ('lights', 'brake', 'exhaust'):
    add(f'art/units/freight-loco-{o}.png', 'main', FR, VEH + ' | post/freight_overlays.py {raw} {fin}')
for o in ('lights', 'dust'):
    add(f'art/units/crawler-{o}.png', 'main', [job('crawler', '', c, f'crawler-deploy{t}-d3', 'd=3') for t, c in TEAMS],
        CRAWL + ' | post/crawler_overlays.py {raw} {fin}')

section('Headlights (art/tod/shared): drawn 3x the vehicle size at evening and night; made from the day sprites')
for v in ('truck', 'roadtrain', 'freight-loco', 'crawler', 'worker', 'hauler', 'agribot', 'paver', 'warbot'):
    add(f'art/tod/shared/{v}-headlights.png', '-', '-', 'post/headlights.py {art}/units {fin}')
add('art/tod/shared/tanker-headlights.png', '-', '-', 'post/headlights.py {art}/units {fin} | cp {fin}/truck-headlights.png {fin}/tanker-headlights.png')

# ------------------------------------------------------------------ walls
for tod in ALL:
    section(f'Walls and gates ({tod}): walls renderer, orthographic, no pad')
    for t, c in TEAMS:
        enc = '%23' + c[1:]
        x = f'&tod={tod}'
        for p in ('post', 'n', 'e', 's', 'w', 'hub-ew', 'hub-ns'):
            n = f'wall-{p}{t}'
            fin = f'walls/compose_walls.py --post wall-post{t} --frames 6 --team {c}'
            add(path(tod, 'buildings', f'walls/{n}.png'), 'walls', f'wall:{n}:piece={p}&team={enc}&frames=6{x}', fin)
            if tod == 'day':
                for f in range(6):
                    add(f'art/buildings/walls/{n}-spark-f{f}.png', 'walls', f'wall:{n}:piece={p}&team={enc}&frames=6{x}', fin)
        for p in ('ew-closed', 'ew-open', 'ns-closed', 'ns-open'):
            n = f'gate-{p}{t}'
            fin = f'walls/compose_walls.py --frames 6 --team {c}'
            add(path(tod, 'buildings', f'walls/{n}.png'), 'walls', f'gate:{n}:piece={p}&team={enc}&frames=6{x}', fin)
            if tod == 'day':
                for f in range(6):
                    add(f'art/buildings/walls/{n}-spark-f{f}.png', 'walls', f'gate:{n}:piece={p}&team={enc}&frames=6{x}', fin)

# ------------------------------------------------------------------ streetlamps
section('Streetlamps (day; the lit heads and pools are light and serve every time of day)')
LAMPS = []
LAMPC = 'compose_any.py --b1 4 --b2 10 --glow 1.3'
for kind in ('road', 'asphalt'):
    LAMPS += [job('streetlamp', '', '', f'streetlamp-{kind}', f'kind={kind}'), job('streetlamp', '', '', f'streetlamp-{kind}-lit', f'kind={kind}&lit=1')]
for kind in ('road', 'asphalt'):
    add(f'art/roads/streetlamp-{kind}.png', 'main', job('streetlamp', '', '', f'streetlamp-{kind}', f'kind={kind}'), LAMPC)
    add(f'art/roads/streetlamp-{kind}-lit.png', 'main', LAMPS, LAMPC + ' | post/lamps_post.py {raw} {fin}')
    add(f'art/roads/streetlamp-{kind}-pool.png', 'main', LAMPS, LAMPC + ' | post/lamps_post.py {raw} {fin}')

# ------------------------------------------------------------------ 2D effects
section('2D effect sheets (Python, transparent)')
add('art/effects/fx-explosion.png', '-', '-', 'fx/explosion.py {fin}')
for f in ('fx-chimney-smoke', 'fx-steam', 'fx-black-smoke', 'fx-flare'):
    add(f'art/effects/{f}.png', '-', '-', 'fx/particles.py {fin}')
for f in ('fx-exhaust', 'fx-exhaust-heavy'):
    add(f'art/effects/{f}.png', '-', '-', 'fx/exhaust.py {fin}')

# ------------------------------------------------------------------ data
section('Point files (pixel positions read off the renders)')
add('art/buildings/building-emitters.json', '-', '-', 'post/emitters.py {raw}/emit {fin}/building-emitters.json')
PTS = [job('truck', '', P0, 'truck@0-f0', 'f=0'), job('tanker', '', P0, 'tanker@0-f0', 'f=0'), job('roadtrain', '', P0, 'roadtrain@0-f0', 'f=0'),
       job('generator', '#ffe23d', '', 'generator'), job('bunker', '', P0, 'bunker@0'), job('disruptor', '', P0, 'disruptor@0'),
       job('streetlamp', '', '', 'streetlamp-road', 'kind=road'), job('streetlamp', '', '', 'streetlamp-asphalt', 'kind=asphalt')]
for f in ('units/exhaust-points.json', 'buildings/generator-points.json', 'buildings/defences-points.json', 'roads/streetlamps.json'):
    add(f'art/{f}', 'main', PTS, 'none | tools/points.py {raw} {fin}')

# ------------------------------------------------------------------ one-offs
section('Nuclear detonation (24 frames, composed, then faded and sheeted)')
NUKE = [job('nukeblast', '', '', f'blast-{k:02d}', f'f={k}&n=24') for k in range(24)]
for k in range(24):
    add(f'nuke-blast/frames/nuke-blast-{k:02d}.png', 'main', NUKE, 'compose.py | post/nukeblast_post.py {raw} {fin}/nuke-blast')
for f in ('nuke-blast-sheet.png', 'nuke-blast.json'):
    add(f'nuke-blast/{f}', 'main', NUKE, 'compose.py | post/nukeblast_post.py {raw} {fin}/nuke-blast')
section('App icon (2048 px hero render; the store sizes were cut from it by hand)')
add('icon/icon.png', 'main', job('icon', '', '', 'icon'), 'compose.py')

# ------------------------------------------------------------------ terrain (pure Python, writes to out/art/...)
section('Terrain tiles and plants (Python renderer in terrain/, run from the package folder; writes out/art/)')
for k in ('ground', 'water', 'rock'):
    add(f'art/tiles/{k}.png', '-', '-', f'terrain/terrain_desert.py {k}')
for b in ('jungle', 'polar'):
    for k in ('ground', 'water', 'rock', 'cliff'):
        add(f'art/biomes/{b}/{k}.png', '-', '-', f'terrain/terrain_biomes.py {k}-{b}')
for b in ('desert', 'jungle', 'polar'):
    for i in range(1, 7):
        add(f'art/biomes/{b}/plant-{i}.png', '-', '-', f'terrain/plants_{b}.py {i}')
for n in ('chasm', 'chasm-wall', 'chasm-wall-2', 'chasm-lip-w', 'chasm-lip-e', 'chasm-lip-n'):
    for suf in ('', '-jungle', '-polar'):
        add(f'art/canyon/{n}{suf}.png', '-', '-', 'terrain/canyon.py out/canyon')


if __name__ == '__main__':
    print('# Terrafall renderer: every delivered file, with the exact job that renders it and the steps that finish it.')
    print('# Columns (tab-separated): file  renderer  jobs  finish.  Generated by tools/catalogue.py; RENDERER.md explains each column.')
    print('# Day files are art/<group>/<name>; morning, evening and night are art/tod/<time>/<group>/<name> (same name).')
    print('# jobs: one or more run.js jobs, space-separated, "scene:accent:team:outName:extra". "-" = none.')
    print('# finish: steps separated by " | ". {raw} render folder, {fin} finished-file folder, {art} art folder, {tod} time of day.')
    last = None
    for sec, file, ren, jobs, fin in E:
        if sec != last:
            print(f'\n## {sec}'); last = sec
        print('\t'.join((file, ren, jobs, fin)))

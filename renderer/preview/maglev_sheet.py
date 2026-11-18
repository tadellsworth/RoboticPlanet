"""The Maglev design sheet: one HTML page with the pictures beside it, for the owner to choose a direction.

    python3 preview/maglev_sheet.py <renderdir> <mockdir> <sheetdir>      (run from renderer/)

<renderdir> holds the composed renders of tools/render_maglev.sh, <mockdir> the pictures of preview/maglev_mock.py.
Writes <sheetdir>/index.html (no doctype, charset or viewport: it is published as an artifact), the pictures as WebP
beside it, and contact.png (the quick look) copied over.
"""
import json
import os
import shutil
import sys
from PIL import Image

RD, MD, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(OUT, exist_ok=True)


def webp(src, name, q=84, size=None):
    im = Image.open(src)
    im = im.convert('RGBA') if im.mode in ('RGBA', 'LA', 'P') else im.convert('RGB')
    if size:
        im = im.resize(size, Image.LANCZOS)
    if im.mode == 'RGBA' and im.getchannel('A').getextrema()[0] == 255:
        im = im.convert('RGB')
    im.save(os.path.join(OUT, name + '.webp'), quality=q, method=6)
    return name + '.webp', im.size


def fig(src, name, alt, cap, q=84, w=None, big=None, cls=''):
    f, (iw, ih) = webp(src, name, q)
    dw, dh = (w, round(ih * w / iw)) if w else (iw, ih)
    img = f'<img src="{f}" width="{dw}" height="{dh}" alt="{alt}" loading="lazy">'
    if big:
        img = f'<a href="{big}">{img}</a>'
    return f'<figure class="{cls}"><div class="plate">{img}</div><figcaption>{cap}</figcaption></figure>'


M = lambda n: os.path.join(MD, n + '.png')
R = lambda n: os.path.join(RD, n + '.png')
geom = lambda n: json.load(open(os.path.join(RD, n + '.geom.json')))
deck_h = lambda v: (geom(f'p{v}0')['anchor'][1] - geom(f'p{v}0')['marks']['head'][1]) * 1.4     # tiles up the screen

DIRS = {
    'a': dict(
        name='Accord Phase 2', short='A',
        lede='The civic transit plan built at last, by the robots, for freight. Pale weathered concrete and gunmetal: slender tapering '
             'pylons with a hammerhead cap and a team-colour strip up the front, a slim box-girder guideway with a team-colour power rail '
             'along each edge, and a round glass-sided Terminal hall with a lit platform ring on its roof, lamp masts, a railing, and at '
             'its door a canopy, a passenger shelter with an empty bench and a timetable board glowing blank. The pods are sleek '
             'rounded capsules in the same pale white, a band of lit windows along each flank (seats inside, nobody in them) and a roof '
             'hatch that stands open over the crates when a pod is loaded.',
        pros=['The one that matches the idea as written: a transit line the colonists would recognise, lit up at night, carrying Ore.',
              'The pale concrete sets it apart from every gunmetal building and track, so a late-game line reads as new money from across the map.',
              'The slimmest guideway of the three: the least in the way on a busy colony, and the pod on it still reads at phone size.',
              'Its night picture is the strongest: the glowing edges of the guideway, the platform ring, the lit windows of a pod with no one in it.'],
        cons=['Pale by day, like the Airship\'s rigid freighter was: here it is toned to the Ropeway\'s off-white and the water bridge\'s concrete, so it does not glare, but it is still the brightest structure on the map.',
              'The load is behind a hatch: from above you see crates only when the hatch is open. (The hatch is the proposal.)',
              'A round Terminal among square industrial buildings: it reads as civic on purpose, but it is a different shape language from the Rail Station beside it.']),
    'b': dict(
        name='Industrial freight', short='B',
        lede='The robots\' own answer, kin to the Rail Station and the Mooring Mast. Four-legged steel lattice pylons on hazard-banded concrete '
             'footings with a heavy cap girder, a boxy steel trough guideway with the power rails glowing on its inner walls and a '
             'walkway along one side, and a Terminal that is a loading gantry: a grating platform on lattice legs with a yellow crane '
             'over the dock, a lit control cab, a cargo lift and containers stacked at its foot. The pods are open container racks in '
             'gunmetal with painted top chords, chevron end plates and amber marker lamps, four bays of crates and ore in plain view.',
        pros=['The load is in plain sight: a pod reads full or empty from above, and the game could draw the bays filling as it loads, like a Hauler\'s crates.',
              'One family with the Rail Station, the Ropeway tower and the yellow gantry cranes already on the map: nothing new to learn.',
              'The most "heavy freight" of the three: the wide trough and the lattice say it carries a lot.'],
        cons=['The least like a maglev: at a glance the lattice pylons and the trough read as a conveyor or an elevated railway, and the Terminal as another Rail Station.',
              'The widest guideway, and the busiest on a crowded colony; at phone size the trough is a dark band and the glowing rails inside it are lost.',
              'Nothing in it carries the lore: no platforms, no seats, no sign of the colonists it was planned for.']),
    'c': dict(
        name='Monorail on the ground', short='C',
        lede='Half the height. A single pale concrete beam on squat round piers, each with a team light ring under its cap, a low-slung '
             'depot Terminal (a round platform on a drum beside a ribbed bus-depot shed with roller doors, a lit sign band and an '
             'asphalt apron), and double-ended bullet pods in gunmetal with a glowing underside, a team-colour spine and a visor at '
             'each end; loaded, their roof hatch stands open over the crates.',
        pros=['The cheapest-looking and the least intrusive: a low beam with short piers sits in a colony without towering over it.',
              'Its piers are small and many, so a line crossing water looks like a causeway, which suits a flat map.',
              'The depot shed and apron are a quiet lore touch: a bus depot with no buses.'],
        cons=['Low means it reads as a road or a pipe at 28 pixels a tile: the pods are what tell you it is a line at all.',
              'Half-height pylons make "shot down" a smaller event, and the line looks as if trucks should drive under it when they cannot.',
              'It is the least spectacular at night: a thin lit groove rather than a glowing elevated line.']),
}

CSS = '''<style>/* The Maglev design sheet: one reading column, the art on its own plates; light and dark themes */
:root {
  --bg: #f1f0ee; --surface: #ffffff; --plate: #14161a; --fg: #1c1d20; --muted: #5f636b; --line: #d9d8d4;
  --accent: #0b5f8a; --display: "Space Grotesk", "Segoe UI", system-ui, sans-serif; --body: Inter, "Segoe UI", system-ui, sans-serif;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #101215; --surface: #181b20; --plate: #08090b; --fg: #e9ebee; --muted: #a0a6ae; --line: #2a2e35; --accent: #5fc8f0; color-scheme: dark; } }
:root[data-theme="dark"] {
  --bg: #101215; --surface: #181b20; --plate: #08090b; --fg: #e9ebee; --muted: #a0a6ae; --line: #2a2e35; --accent: #5fc8f0; color-scheme: dark; }
* { box-sizing: border-box; }
body { background: var(--bg); color: var(--fg); font: 15px/1.6 var(--body); margin: 0;
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 32px 64px; }
main { max-width: 1260px; margin: 0 auto; display: grid; gap: 64px; }
h1, h2, h3 { font-family: var(--display); text-wrap: balance; margin: 0; letter-spacing: -0.01em; }
h1 { font-size: clamp(30px, 5vw, 46px); line-height: 1.08; }
h2 { font-size: 28px; } h3 { font-size: 19px; margin-top: 10px; }
p { margin: 0; max-width: 74ch; }
a { color: var(--accent); }
.eyebrow { font: 600 12px var(--body); text-transform: uppercase; letter-spacing: 0.12em; color: var(--accent); }
.lede { font-size: 17px; color: var(--muted); }
header.top, section { display: grid; gap: 16px; min-width: 0; }
.plate { background: var(--plate); border-radius: 6px; overflow: hidden; line-height: 0; width: fit-content; max-width: 100%; }
.plate img { display: block; max-width: 100%; height: auto; }
figure { margin: 0; display: grid; gap: 6px; min-width: 0; align-content: start; }
figcaption { font-size: 13px; color: var(--muted); max-width: 62ch; }
.dn { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 380px), 1fr)); gap: 14px; align-items: start; }
.row { display: flex; flex-wrap: wrap; gap: 14px; align-items: start; }
.sprites .plate { background: #3a3530; background-image: linear-gradient(45deg, #332f2b 25%, transparent 25%, transparent 75%, #332f2b 75%), linear-gradient(45deg, #332f2b 25%, transparent 25%, transparent 75%, #332f2b 75%); background-size: 16px 16px; background-position: 0 0, 8px 8px; }
.toc { display: flex; flex-wrap: wrap; gap: 10px 22px; font-weight: 600; }
.wide { display: grid; gap: 14px; justify-items: start; }
.gridwrap { overflow-x: auto; }
table { border-collapse: collapse; font-size: 14px; }
.grid th, .grid td { text-align: left; padding: 7px 18px 7px 0; border-bottom: 1px solid var(--line); vertical-align: top; }
.grid thead th { font: 600 12px var(--body); text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }
.grid th.rowh { font: 600 14px var(--display); white-space: nowrap; }
.tag { font: 600 11px var(--body); color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; margin-left: 6px; }
.pc { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr)); gap: 14px 28px; }
.pc h4 { margin: 0 0 6px; font: 600 13px var(--body); text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); }
.pc ul { margin: 0; padding-left: 20px; display: grid; gap: 6px; }
.callout { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 18px 20px; display: grid; gap: 10px; }
.questions ol { margin: 0; padding-left: 22px; display: grid; gap: 12px; max-width: 82ch; }
.questions li p { margin-top: 4px; }
.rec { color: var(--muted); }
.rec b { color: var(--fg); }
.notes p { color: var(--muted); font-size: 14px; }
code { font-size: 13px; }
</style>'''

H = []
H.append('<title>Maglev Design Sheet</title>\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&display=swap">')
H.append(CSS)
H.append('''<main>
<header class="top">
  <p class="eyebrow">Terrafall · Maglev art for the owner to choose · November 2026</p>
  <h1>The Maglev line: Terminals, pylons, guideway and pods</h1>
  <p class="lede">Late-game, high-capacity freight: an elevated guideway on pylons, run straight across terrain, water and cliffs between two Maglev Terminals, with pods carrying goods at three to four times a Freight Train's speed. It draws power from Generators, so a solar flare or a blackout slows it to a crawl, and a pylon shot down cuts the line until it is repaired. Here are three directions, each a Terminal, a pylon, a stretch of guideway and a pod. Pick one, or mix parts of them. Nothing is installed.</p>
  <p>All three were built and lit in the game's own 3D renderer, in the same light, materials and team colours as the Rail Station, the Ropeway and the Mooring Mast: weathered steel and concrete, hazard stripes, team colour in light strips and power rails, lit windows and beacons to carry the night. The Terminals are one-tile buildings at the buildings' angle, drawn as big as the Rail Station; the pylons are building-angle sprites with no pad; the pods and the guideway are seen from straight above like the train cars, so the game can turn them to any line. Every picture of a colony is composed the way the game draws a map, with today's art for everything else.</p>
  <nav class="toc"><a href="#scale">Side by side</a><a href="#dir-a">A · Accord Phase 2</a><a href="#dir-b">B · Industrial freight</a><a href="#dir-c">C · Monorail on the ground</a><a href="#cut">Shot down</a><a href="#pick">Recommendation</a><a href="#questions">Questions</a><a href="#notes">How it was made</a></nav>
</header>
''')

# ---- scale
H.append('<section id="scale">\n  <p class="eyebrow">Scale</p>\n  <h2>Side by side</h2>\n  <div class="wide">')
H.append(fig(M('scale-day'), 'scale-day', 'a Freight Truck, a Freight Train, a Rail Station, a Ropeway station and gondola, a Mooring Mast, then the three Terminals with a pod and a pylon each', 'By day. Left to right: a Freight Truck, a Freight Train (its locomotive and two wagons), a Rail Station, a Ropeway station with a gondola, a Mooring Mast, then directions A, B and C: a Terminal, a loaded pod on the guideway leaving it, a pylon. 64 pixels a tile; the grid is one tile.', q=86))
H.append(fig(M('scale-night'), 'scale-night', 'the same line-up at night', 'At night: the power rails along the guideway, the platform rings and strips, the pods\' windows and lamps. The soft team light on the ground under each building is the game\'s.', q=86))
H.append('  </div>')
H.append(f'''  <p>A Terminal is one tile, drawn as big as the Rail Station (its art spans 1.2 tiles). The deck top sits {deck_h('a'):.2f} of a tile up the screen over a pylon's foot in A, {deck_h('b'):.2f} in B and {deck_h('c'):.2f} in C: lower than the Ropeway's cable (0.76) and the Mast's cup (0.75), so a Ropeway can still cross a Maglev. A pod is drawn in a one-tile frame like a train car and runs about three quarters of a tile long.</p>
  <div class="gridwrap"><table class="grid"><thead><tr><th></th><th>Footprint</th><th>Art spans (tiles)</th><th>Deck height on screen (tiles)</th><th>Pod length (tiles)</th><th>At 48 px a tile</th><th>At 28 px</th></tr></thead><tbody>
  <tr><th class="rowh">Rail Station and Freight Train <span class="tag">today</span></th><td>1 tile</td><td>1.6</td><td>(on the ground)</td><td>0.62 a car, five cars</td><td>a car 30 px</td><td>17 px</td></tr>
  <tr><th class="rowh">Ropeway station and gondola <span class="tag">today</span></th><td>1 tile</td><td>1.47</td><td>cable 0.76</td><td>0.8 frame</td><td>cable 36 px up</td><td>21 px</td></tr>
  <tr><th class="rowh">A · Accord Phase 2</th><td>1 tile</td><td>1.6</td><td>{deck_h('a'):.2f}</td><td>0.76</td><td>deck {deck_h('a') * 48:.0f} px up, pod 36 px</td><td>{deck_h('a') * 28:.0f} px up, pod 21 px</td></tr>
  <tr><th class="rowh">B · Industrial freight</th><td>1 tile</td><td>1.6</td><td>{deck_h('b'):.2f}</td><td>0.80</td><td>deck {deck_h('b') * 48:.0f} px up, pod 38 px</td><td>{deck_h('b') * 28:.0f} px up, pod 22 px</td></tr>
  <tr><th class="rowh">C · Monorail on the ground</th><td>1 tile</td><td>1.6</td><td>{deck_h('c'):.2f}</td><td>0.72</td><td>deck {deck_h('c') * 48:.0f} px up, pod 35 px</td><td>{deck_h('c') * 28:.0f} px up, pod 20 px</td></tr>
  </tbody></table></div>
  <h3>Quick look</h3>
  <p>The same stretch of line in each direction, crossing a river and climbing onto a plateau: by day on top, at night below. 96 pixels a tile. The full pictures are in each direction's section.</p>
  <div class="wide">''')
H.append(fig(M('contact'), 'contact', 'the three directions crossing water and a cliff, by day and at night', 'A, B and C, by day and at night.', q=84))
H.append('  </div>\n</section>\n')

for v, d in DIRS.items():
    H.append(f'<section id="dir-{v}">\n  <p class="eyebrow">Direction {d["short"]}</p>\n  <h2>{d["name"]}</h2>\n  <p>{d["lede"]}</p>')
    H.append('  <h3>The Terminal</h3>\n  <p>One tile, like every building, so it goes anywhere a Rail Station goes and needs no new footprint rule. The guideway arrives at the platform\'s middle at deck height from whichever direction the line comes, and the pod docks there: a round or square platform works from any angle, the way a Mooring Mast\'s cup does.</p>\n  <div class="dn">')
    H.append(fig(M(f'terminal-{v}-day'), f'{v}-terminal-day', f'{d["name"]} Terminal in both team colours by day', 'By day, yours (cyan) and the rival\'s (red), a pod docked on each, the guideway arriving from the side. 160 pixels a tile.'))
    H.append(fig(M(f'terminal-{v}-night'), f'{v}-terminal-night', f'{d["name"]} Terminal at night', 'At night: the platform\'s lights, the windows, the power rails.'))
    H.append('  </div>\n  <h3>The pylon and the guideway</h3>\n  <div class="dn">')
    H.append(fig(M(f'pylon-{v}-day'), f'{v}-pylon-day', 'the pylon in both team colours under a span, a pod crossing', 'By day, both teams\' pylons under one span, a loaded pod crossing between them; the span\'s shadow falls down-sun on the ground. 160 pixels a tile.'))
    H.append(fig(M(f'pylon-{v}-night'), f'{v}-pylon-night', 'the same at night', 'At night.'))
    H.append('  </div>\n  <div class="wide">')
    H.append(fig(M(f'cross-{v}-day'), f'{v}-cross-day', 'a stretch of line crossing a river and climbing onto a plateau', 'A stretch of line crossing a river and climbing onto a plateau, 96 pixels a tile: a pylon every three tiles, one standing in the water, one on the high ground (shorter, as the Viaduct\'s piers are), a loaded pod going out and an empty one coming back.', q=86))
    H.append(fig(M(f'cross-{v}-night'), f'{v}-cross-night', 'the same at night', 'The same at night: the power rails light the span from end to end, the pods\' lamps and windows, the pylons\' strips.', q=86))
    H.append('  </div>\n  <h3>The pods</h3>\n  <div class="wide">')
    H.append(fig(M(f'pod-{v}-day'), f'{v}-pod-day', 'a loaded pod, an empty pod, and the rival\'s', 'Left to right: a loaded pod, an empty one, and the rival\'s loaded. 128 pixels a tile; the pod rides the guideway and its shadow falls on the ground below.'))
    H.append(fig(M(f'pod-{v}-night'), f'{v}-pod-night', 'the same at night', 'At night.'))
    H.append('  </div>\n  <h3>In a colony</h3>\n  <p>At game scale, 48 pixels a tile as on a desktop (select a picture for twice the size): a line from a Terminal beside the factory district, powered by the Generator next to it, across the river and up onto the plateau to a Terminal in the fields, with its own Generator. A loaded pod is on its way out and an empty one on its way back; a third is docked at the far end. For comparison: a Rail Station with a Freight Train on its track, a Ropeway with a gondola on its cable, a Mooring Mast, Freight Trucks on the roads.</p>\n  <div class="wide">')
    H.append(fig(M(f'colony-{v}-day'), f'{v}-colony-day', 'a colony with the Maglev line by day', 'By day.', q=86, big=f'{v}-colony-day-big.webp'))
    H.append(fig(M(f'colony-{v}-night'), f'{v}-colony-night', 'the same colony at night', 'At night.', q=86, big=f'{v}-colony-night-big.webp'))
    webp(M(f'colony-{v}-day-big'), f'{v}-colony-day-big', 82); webp(M(f'colony-{v}-night-big'), f'{v}-colony-night-big', 82)
    H.append('  </div>\n  <h3>On a phone</h3>\n  <p>The same colony at a phone\'s 28 pixels a tile, at its real size and doubled.</p>\n  <div class="row">')
    for tod in ('day', 'night'):
        H.append(fig(M(f'phone-{v}-{tod}'), f'{v}-phone-{tod}', f'the colony at phone size, {tod}', f'Real size, {tod}.'))
    for tod in ('day', 'night'):
        f, (iw, ih) = webp(M(f'phone-{v}-{tod}'), f'{v}-phone-{tod}')
        H.append(f'<figure><div class="plate"><img src="{f}" width="{iw * 2}" height="{ih * 2}" alt="the colony at phone size, doubled, {tod}" loading="lazy"></div><figcaption>Doubled, {tod}.</figcaption></figure>')
    H.append('  </div>\n  <h3>Presentation view</h3>\n  <p>Not a game picture: the Terminal, the guideway leaving it, two pylons and a pod in 3D at the buildings\' angle, to show what the map view hides. The pylons stand closer together here than in the game (1.3 tiles instead of 3), to fit the frame.</p>\n  <div class="dn">')
    H.append(fig(R(f'scene-{v}'), f'{v}-scene-day', 'presentation view by day', 'By day.'))
    H.append(fig(R(f'scene-{v}-n'), f'{v}-scene-night', 'presentation view at night', 'At night.'))
    H.append('  </div>\n  <p>The sprite files themselves, as the game would load them: the Terminal and the pylon (512 pixels, see-through, the buildings\' angle), a pod loaded and empty and one tile of guideway (256 pixels, straight down, running east), yours by day and at night; the rival\'s differ only in colour.</p>\n  <div class="row sprites">')
    for n, cap, w in ((f't{v}0', 'Terminal, day', 200), (f't{v}0-n', 'Terminal, night', 200), (f'p{v}0', 'Pylon, day', 200), (f'p{v}0-n', 'Pylon, night', 200)):
        H.append(fig(R(n), f'{v}-sprite-{n}', cap, cap, w=w))
    for n, cap, w in ((f'pod{v}0', 'Pod, loaded', 140), (f'pod{v}0e', 'Pod, empty', 140), (f'pod{v}0-n', 'Pod at night', 140), (f'd{v}0', 'Guideway tile', 140), (f'd{v}0-n', 'Guideway at night', 140)):
        H.append(fig(R(n), f'{v}-sprite-{n}', cap, cap, w=w))
    H.append('  </div>\n  <div class="pc">')
    H.append('<div><h4>For</h4><ul>' + ''.join(f'<li>{x}</li>' for x in d['pros']) + '</ul></div>')
    H.append('<div><h4>Against</h4><ul>' + ''.join(f'<li>{x}</li>' for x in d['cons']) + '</ul></div>')
    H.append('  </div>\n</section>\n')

# ---- the cut
H.append('<section id="cut">\n  <p class="eyebrow">Shot down</p>\n  <h2>A pylon down, the line cut</h2>\n  <p>Direction A, 72 pixels a tile: the middle pylon has been shot down. Its column lies where it fell with its cap still on it, the stump stands sheared and charred with its rebar out, the two spans that rested on it are gone (a stub of each hangs from the neighbouring pylons), a broken slab lies on the ground with its power rail still live, and the ground is scorched and smoking. The pods have stopped short of the break on each side, as the sheet proposes (question 8), and will go back to their Terminals. A Worker sent from the near Terminal rebuilds the pylon and the two spans.</p>\n  <div class="wide">')
H.append(fig(M('cut-day'), 'cut-day', 'the line with a pylon shot down, by day', 'By day.', q=86))
H.append(fig(M('cut-night'), 'cut-night', 'the same at night', 'At night: the two live stubs still glow; the gap between them is dark.', q=86))
H.append('  </div>\n  <div class="row sprites">')
H.append(fig(R('pa0-cut'), 'sprite-cut', 'the cut pylon sprite', 'The cut pylon as a sprite, day', w=220))
H.append(fig(R('pa0-cut-n'), 'sprite-cut-n', 'the cut pylon sprite at night', 'At night', w=220))
H.append('  </div>\n</section>\n')

H.append('''<section id="pick">
  <p class="eyebrow">Recommendation</p>
  <h2>A, Accord Phase 2, with B's habit of showing the load</h2>
  <div class="callout">
    <p>A is the line the idea describes: the Accord's Phase 2 transit plan, built thirty years late by the robots, for freight. It is the only one of the three that carries the lore in its shape: platforms to passenger standard with no passengers, lit windows with empty seats behind them, a shelter and a timetable at the door. It is also the best picture on the map. Its pale concrete reads as something new and civic beside the gunmetal factories, its slim guideway is the least in the way on a crowded colony, and at night the glowing edges of the span, the platform ring and the pods' windows make the elevated line the brightest thing on the map, which is what a late-game showpiece should be. It survives a phone: the pale band and the pod on it read at 28 pixels a tile where B's trough goes dark and C's beam becomes a road.</p>
    <p>Take one thing from B: the load must show. A's pods have it as a roof hatch that stands open over the crates when loaded and lies shut when empty; the game can draw the hatch open and the crates inside as the pod fills, the way it draws a Hauler's crates. If you would rather see the whole load, A's pods could run as open racks like B's, in white: it costs the windows, which are the lore. B is the safe choice (nothing new to learn, kin to the Rail Station) but it looks like an elevated railway, not a maglev, and it has nothing of the Phase 2 story. C is the quietest and the cheapest-looking, which is a virtue on a busy map and a loss everywhere else: a line this dear in Alloy and Chips should look like it.</p>
    <p>Two small mixes worth making whichever you choose: the pylon's cap and the Terminal's dock in gunmetal (as drawn) so the white sits with the rest of the colony, and B's hazard chevrons on the pylon caps of A, for the Flak gunner to aim at.</p>
  </div>
</section>

<section class="questions" id="questions">
  <p class="eyebrow">For you to decide</p>
  <h2>Open questions</h2>
  <ol>
    <li><b>Terminal size.</b> One tile, or two? <p class="rec"><b>One tile</b>, drawn at the Rail Station's size (its art spans 1.2 tiles). Every building in the game is one tile and nothing in the placement, the conveyor joins or the rival's planner knows a two-tile footprint; the Rail Station already reads as a big building this way. The guideway arrives at the platform's middle at deck height from any direction, and the pod docks there. If a two-tile hall is wanted for A, it can be the art alone: a hall that spills over the next tile like the Station's shed, with the footprint still one tile.</p></li>
    <li><b>Line length and pylon spacing.</b> <p class="rec"><b>6 to 40 tiles, a pylon every 3 tiles</b>, counted from the near Terminal (so a 30-tile line has 9). The Ropeway's 14 is its ceiling and the Airship has none; the Maglev should outreach both or it has no job. A span over a Rift or a chasm has no pylon in it, so a line may cross one of up to 6 tiles (two spans) and no wider; a pylon may stand on ground, on a cliff top, or in shallow water (a pier, as in the pictures), never on a building, a road or track. The straight line is checked when the far end is picked, as the Ropeway's is.</p></li>
    <li><b>What pods carry.</b> Goods only, as the idea has it, or riders too? <p class="rec"><b>Goods only.</b> The Ropeway and the Airship already carry robots, and a freight-only line is the point of the lore: platforms built to passenger standard, used for Ore. Each pod carries 16 goods, several kinds at once like a train's wagons; a line runs up to 4 pods, ordered at a Terminal's panel like trains at a Station's yard (4 Alloy and 2 Chips each). If riders come later, make it a Worker only, as a maintenance crew, and keep warbots off it.</p></li>
    <li><b>Speed.</b> <p class="rec"><b>Three times a Freight Train's top speed (about 12 tiles a second), with four times its acceleration</b>, so a pod leaves a Terminal visibly and crosses a 20-tile line in about three seconds, then dwells to load. Four times a train is a blur at 48 pixels a tile. Pods run both ways on one guideway and pass at the Terminals, so a line's throughput is its pods: four pods on a 20-tile line move more than a Freight Train on the same distance, with no track laid through the base and nothing to wait for at a crossing.</p></li>
    <li><b>Power.</b> A Generator within reach of each Terminal, or a Fuel-burning power unit in the Terminal itself? <p class="rec"><b>A Generator within 4 tiles of each Terminal</b>, the radius Generators already have, burning Fuel while pods run (the line counts as something in reach working). Both ends must be powered. With no Generator, no Fuel in it, or during a solar flare, the pods crawl at a Worker's pace and the guideway's lights dim; the Murmur's Leeches can drain a Generator and slow the line at night, which is a story the game already tells. A power unit inside the Terminal would duplicate the Generator and lose all of that. There is no grid to build: if power lines come later (IDEAS.md), the Maglev runs on them instead.</p></li>
    <li><b>Where it is built.</b> From the Paths menu like the Ropeway, or from a Terminal's panel like the Mast's Link? <p class="rec"><b>The Terminal is a building (the Move tab, beside the Rail Station); the line is a Paths tool, Maglev, with two taps</b>: the near Terminal, then the far one (or a clear spot, where the far Terminal goes up as the Ropeway's far station does). Two taps show the span before you commit, with the pylons' spots marked and the first bad one in red, which a panel button cannot. A Worker from the near end builds it out pylon by pylon, as the Viaduct's does, so the far end goes up last.</p></li>
    <li><b>Cost.</b> <p class="rec"><b>1 Alloy, ½ Chip and 1 Cement a tile</b>, paid from storage as it goes up (prepaid, like a Viaduct's 3 Cement and ½ Alloy); a Terminal 8 Cement, 6 Alloy and 3 Chips; a pod 4 Alloy and 2 Chips. A 24-tile line with its two Terminals and three pods is then about 48 Alloy, 24 Chips and 40 Cement: dear in exactly the goods a late colony makes and a young one cannot spare, which is what keeps it late-game without a rule.</p></li>
    <li><b>Shot down.</b> When a pylon falls, do pods stop at the break, or fall? <p class="rec"><b>Pods stop short of the break and go back to their Terminal</b> with what they carry; a pod that is on a span when its pylon falls is lost with its load (a crash, no wreck to clear). That makes a pylon a target worth a Flak battery's or a Howitzer's attention (a pylon has a Wall's toughness, say 24, so it takes a deliberate effort and a lucky Bomber cannot cut a line in passing), and gives the defender a reason to keep warbots along a line. The guideway itself cannot be shot: only pylons and Terminals.</p></li>
    <li><b>Repair.</b> <p class="rec"><b>A Worker from the nearer Terminal rides a pod to the break and rebuilds the pylon and its two spans</b> at the per-tile price, about 20 seconds. Workers cannot walk to a pylon in a river or on a far cliff, and a pod carrying its own crew is in character. Until then the Terminals show the line as cut (red, as a blocked Ropeway is) and the pods wait.</p></li>
    <li><b>The rival.</b> <p class="rec"><b>Not yet.</b> The rival does not build Airships or Ropeways either; a Maglev joins the list when its late game gets a transit tier, and then only the Architect and the Steward, with a line from their base to a far Depot cluster, and only once they have Chips to spare.</p></li>
    <li><b>In the Hollow.</b> <p class="rec"><b>Yes.</b> The deck is a storey up, well under any cavern roof, where aircraft cannot go; pylons stand on the floor and in the black lakes, and a line crosses a chasm of up to two spans like any Rift. In the Hollow's permanent night a lit guideway threading between the Bloom's violet is the best picture this feature will ever make. The Murmur hear it: a running line draws them as a Generator does.</p></li>
    <li><b>A lore line.</b> <p class="rec">For the Lore guide, in LORE.md's voice: <i>"The road standards ran to a second volume that nobody opened: Phase 2, transit for the colonists, to be built when the roads were done. The roads have been done for thirty years. Somewhere a colony has started on Phase 2, to the standard, with platforms and timetables. The pods run full of Ore."</i> Flavour lines, if wanted: the Terminal, <i>"Phase 2 transit. Platforms to passenger standard. Departures on time; the seats stay folded."</i> The pod: <i>"Twelve seats, folded. Forty crates."</i></p></li>
    <li><b>Mixing.</b> Parts move between the directions freely: A's line with B's open racks, B's gantry Terminal on A's pylons, C's pods on A's guideway. Say which.</li>
  </ol>
</section>

<section class="notes" id="notes">
  <p class="eyebrow">How it was made</p>
  <p>The Terminals, pylons, guideway tiles and pods were modelled and lit in the game's own 3D renderer, the one that made every building, robot and aircraft (<code>renderer/b/maglev.js</code>, run by <code>renderer/tools/render_maglev.sh</code>): the Terminals on the usual concrete pad at the buildings' angle, the pylons at the same angle with no pad, the pods and one tile of guideway seen from straight above like the train cars, each by day and at night and in both team colours, with the powered-realism kit's strips, windows and beacons. The pictures of a colony (<code>renderer/preview/maglev_mock.py</code>) are composed the way the game draws a map: its ground, water and rock, roads and street lamps, the night grade, and today's art for the buildings, the train, the Ropeway and the trucks. The guideway is drawn there the way the sheet proposes the game should draw it: a straight band of the guideway tile from one Terminal's head to the other's, lifted the pylon's height up the screen, its shadow on the ground down-sun, pylon sprites every three tiles with their heads on it (shorter on high ground, as the Viaduct's piers are), and the pods drawn on it turned to the line; a cut line is two bands with a gap. The renderer's scenes for all three directions are kept, so the one you choose can be finished from them.</p>
</section>
</main>
''')

with open(os.path.join(OUT, 'index.html'), 'w') as fh:
    fh.write('\n'.join(H))
shutil.copy(M('contact'), os.path.join(OUT, 'contact.png'))
print('wrote', OUT)

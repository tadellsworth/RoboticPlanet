"""The Airship design sheet: one HTML page with the pictures beside it, for the owner to choose a direction.

    python3 preview/airship_sheet.py <renderdir> <mockdir> <sheetdir>      (run from renderer/)

The renders (node run.js <renderdir> ...; compose the airships with compose_any.py --b1 5 --b2 15, the masts with
compose.py, the moored views (1600 x 1000) with compose_any.py):
    airship::<team>:<v><t>:v=<v>            airship::<team>:<v><t>-n:v=<v>&tod=night         v = a | b | c, t = 0 | 1
    mast::<team>:m<v><t>:v=<v>              mast::<team>:m<v><t>-n:v=<v>&tod=night
    mast::#38d4ff:dock-<v>:v=<v>&dock=1     mast::#38d4ff:dock-<v>-n:v=<v>&dock=1&tod=night
then preview/airship_mock.py <renderdir> <mockdir> for the game-style pictures.
"""
import os
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


def fig(src, name, alt, cap, q=84, w=None, big=None):
    f, (iw, ih) = webp(src, name, q)
    dw, dh = (w, round(ih * w / iw)) if w else (iw, ih)
    img = f'<img src="{f}" width="{dw}" height="{dh}" alt="{alt}" loading="lazy">'
    if big:
        img = f'<a href="{big}">{img}</a>'
    return f'<figure><div class="plate">{img}</div><figcaption>{cap}</figcaption></figure>'


M = lambda n: os.path.join(MD, n + '.png')
R = lambda n: os.path.join(RD, n + '.png')

DIRS = {
    'a': dict(
        name='Rigid freighter', short='A',
        lede='The classic airship. A long rigid hull of pale, weathered doped skin over a girder frame, a cross-shaped tail with hazard-striped elevators, and four engine cars on outriggers, each pushing with a big propeller. Three containers a side ride in pannier racks on its flanks, where they show from above. A small armoured cab sits on its spine with lit roof lights; the crew car hangs under the nose, seen only from the side. Team colour is in two bands round the hull and a strip down its spine.',
        mast='A three-legged steel lattice round a lift shaft, with a cargo cage on the shaft, a gallery with red aviation lights at the top, and the winch room under the mooring cup. At its foot, a winch house with the hoist drum and a loading dock with crates.',
        pros=['Reads as an airship at once, even at phone size: the long hull, the fins and the engine cars.',
              'The pale hull sets it apart from every other unit, which are all gunmetal.',
              'Its load shows on the flanks without spoiling the classic outline.'],
        cons=['By day the pale hull is the brightest thing on the map, and its look is the furthest from the armoured Cargo Plane.',
              'The lattice mast is close to the Ropeway tower at a glance; the cup and the round gallery are what tell them apart.']),
    'b': dict(
        name='Twin-hull lifter', short='B',
        lede='Two slim gunmetal hulls side by side, joined by a truss deck that carries eight containers in plain view. A bridge cab sits at the front of the deck, a docking frame runs forward from both noses to a single mooring cone, a stabiliser spans both tails, and a ducted pusher rings each tail. Team colour runs in a strip down each hull and in bands round the noses; the cab\'s windscreen and roof lights glow at night.',
        mast='A container-crane portal in faded yellow: legs on crane rails, a crossbeam carrying the mooring cup, and a hoist trolley lowering a container on its spreader. A control cab rides on one leg; a gate booth and a stack of containers stand at its foot.',
        pros=['The load is in plain sight. The game could draw the deck full, part full or empty, and Workers or Warbots riding on it, the way it draws a Hauler\'s crates.',
              'Its outline is like nothing else in the game, and the crane mast reads as a freight terminal that can\'t be mistaken for the Ropeway.',
              'The most "bulk line" of the three: it looks like it carries a lot, slowly.'],
        cons=['The least like a classic airship: from straight above it can read as a barge slung between two balloons.',
              'The widest of the three, 1.7 tiles at the tail.']),
    'c': dict(
        name='Armoured blimp', short='C',
        lede='A stubby, flattened envelope built in the same armour as the Cargo Plane and the Bomber: gunmetal plates with thin seams, glowing team strips along its creases, an armoured hood with the sensor visor and a slim band of bridge windows. Four big ducted lift fans sit on armoured pylons at its corners and a V-tail at the stern. Its cargo pod is clamped under the belly, out of sight from above.',
        mast='A faceted concrete pylon banded in armour, with a fuel line running up its side in glowing Fuel-orange collars (the ship burns Fuel) and an armoured clamp head under the mooring cup. At its foot, a bunkered loading bay with a lit blast door, a cargo lift and blast walls.',
        pros=['One family with the Cargo Plane and the Bomber: the same plates, seams, visor and glowing creases.',
              'The four fan rings read from far off, and would look good turning.'],
        cons=['It looks more like a gunship than a freighter, and its cargo can\'t be seen.',
              'With its lift fans it reads as a hovercraft more than a lighter-than-air ship.',
              'The pylon mast reads as a tower or a chimney until its head is seen.']),
}

END = """
<section id="pick">
  <p class="eyebrow">Recommendation</p>
  <h2>B, the twin-hull lifter, with its crane mast</h2>
  <div class="callout">
    <p>This is a game about moving goods, and B is the one where you can see the goods. Its eight containers sit in plain view between the hulls, so the game could show a line working at a glance: the deck full on the way out, part full or empty on the way back, robots riding when it carries them. Its outline, two hulls with a coloured deck between, is like nothing else in the game and still reads at phone size and at night, where the two team strips run side by side. Its crane mast reads as a freight terminal and can't be taken for the Ropeway tower.</p>
    <p>A close second is A, the rigid freighter: the quickest to read as an airship, and the most handsome, but its lattice mast is close to the Ropeway tower, and its pale hull is the brightest thing on the map by day. If you like A's outline, its hull could take B's darker gunmetal and its mast B's crane, which would keep the classic shape and lose both problems. C fits the Cargo Plane and the Bomber best, but it looks like a gunship and hides its cargo.</p>
  </div>
</section>

<section class="questions" id="questions">
  <p class="eyebrow">For you to decide</p>
  <h2>Open questions</h2>
  <ol>
    <li><b>How big on screen.</b> Each airship is drawn in a frame three tiles across, so its hull runs about two and a half tiles: a little longer than a Cargo Plane in flight and much bulkier. Keep that, or go bigger so it plainly outsizes the plane? And should it grow a little as it climbs away from a mast, as the plane does when it takes off, or stay one size?</li>
    <li><b>Showing the cargo.</b> Should what it carries show on it: B's deck full, part full or empty (eight containers at three goods each would make its 24), A's side racks the same way, and Workers or Warbots riding on the deck when it carries robots? Or always drawn loaded? C's pod hides its load whichever way.</li>
    <li><b>Turning propellers and fans.</b> They are shown still. Should they turn? That takes a few frames per ship, or a blur drawn over each one in code. C's four big fans want it most.</li>
    <li><b>Light under it at night.</b> The soft pool of team light on the ground under each ship is new: the game draws none under planes. Keep it?</li>
    <li><b>Moored.</b> Shown here, a moored ship points its nose at the mast with its body streaming out downwind. Should every moored ship on a map lie the same way (one wind), or lie along its line toward the other mast? And does it come down lower at the mast, so its shadow sits closer?</li>
    <li><b>The mast and the Ropeway.</b> The lattice mast (A) shares the Ropeway tower's look. If you choose A, should its tower become a solid tube or B's crane to keep the two apart?</li>
    <li><b>Where it is built.</b> If airships are built at a Mast, the mast may want a bigger yard to show it (two tiles, with a cradle); if at the Airfield, the mast can stay one tile.</li>
    <li><b>Shot down.</b> A Cargo Plane tumbles and burns as it falls. Should the airship have a wreck of its own: the hull sagging and burning as it comes down, and a crash site left on the ground? That needs its own art.</li>
    <li><b>What keeps it up.</b> Nothing in the art says yet: gas, or something of the planet's own. The lore says Ring Crystal is slightly weightless; a Crystal-lifted hull could show a faint Crystal glow at its vents. That is canon, so it is your call.</li>
    <li><b>Mixing.</b> Parts move between the directions freely: a ship from one, a mast from another, colours or armour from a third. Say which.</li>
  </ol>
</section>

<section class="notes">
  <p class="eyebrow">How it was made</p>
  <p>The airships and masts were modelled and lit in the game's own 3D renderer, the one that made every building, robot and aircraft, at the size and angle the game uses: the airships seen from straight above like the Cargo Plane, the masts at the buildings' angle on the usual concrete pad, each by day and at night and in both team colours. The pictures of a colony are composed the way the game draws a map: its ground, water and rock, roads and street lamps, the night grade, and today's art for the buildings, the Cargo Plane and the Freight Truck. The renderer's scenes for all three directions are kept, so the one you choose can be finished from them.</p>
</section>
"""

# ------------------------------------------------------------------------------------------------ the page
H = []
H.append('''<!doctype html>
<meta charset="utf-8">
<title>Airship Design Sheet</title>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&display=swap">
<style>/* The Airship design sheet: one reading column, the art on its own plates; light and dark themes */
:root {
  --bg: #f1f0ee; --surface: #ffffff; --plate: #14161a; --fg: #1c1d20; --muted: #5f636b; --line: #d9d8d4;
  --accent: #0b6f7a; --display: "Space Grotesk", "Segoe UI", system-ui, sans-serif; --body: Inter, "Segoe UI", system-ui, sans-serif;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #101215; --surface: #181b20; --plate: #08090b; --fg: #e9ebee; --muted: #a0a6ae; --line: #2a2e35; --accent: #5fd0da; color-scheme: dark; } }
:root[data-theme="dark"] {
  --bg: #101215; --surface: #181b20; --plate: #08090b; --fg: #e9ebee; --muted: #a0a6ae; --line: #2a2e35; --accent: #5fd0da; color-scheme: dark; }
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
.grid th, .grid td { text-align: left; padding: 7px 18px 7px 0; border-bottom: 1px solid var(--line); white-space: nowrap; font-variant-numeric: tabular-nums; }
.grid thead th { font: 600 12px var(--body); text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }
.grid th.rowh { font: 600 14px var(--display); }
.tag { font: 600 11px var(--body); color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; margin-left: 6px; }
.pc { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr)); gap: 14px 28px; }
.pc h4 { margin: 0 0 6px; font: 600 13px var(--body); text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); }
.pc ul { margin: 0; padding-left: 20px; display: grid; gap: 6px; }
.callout { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 18px 20px; display: grid; gap: 10px; }
.questions ol { margin: 0; padding-left: 22px; display: grid; gap: 10px; max-width: 82ch; }
.notes p { color: var(--muted); font-size: 14px; }
</style>
<main>
<header class="top">
  <p class="eyebrow">Terrafall · Airship art for the owner to choose · November 2026</p>
  <h1>The Airship and its Mooring Mast</h1>
  <p class="lede">A slow freight airship that runs back and forth between two Mooring Masts, carrying goods both ways and a few robots. Here are three directions, each an airship and the mast it moors to. Pick one, or mix parts of them. Nothing is installed.</p>
  <p>All three were built and lit in the game's own 3D renderer, in the same light, materials and team colours as the Cargo Plane, the Ropeway and the Airfield: weathered steel and grime, team colour in light strips and bands, navigation lights (red to port, green to starboard, white at the tail) and lit windows to carry the night. The airship is drawn the way the game draws its aircraft, seen from straight above and turned to its heading, with its shadow falling down-sun. The masts are one-tile buildings, as tall as the Ropeway tower, drawn at the buildings' angle.</p>
  <nav class="toc"><a href="#scale">Side by side</a><a href="#dir-a">A · Rigid freighter</a><a href="#dir-b">B · Twin-hull lifter</a><a href="#dir-c">C · Armoured blimp</a><a href="#pick">Recommendation</a><a href="#questions">Questions</a></nav>
</header>
''')

# ---- scale
H.append('<section id="scale">\n  <p class="eyebrow">Scale</p>\n  <h2>Side by side</h2>\n  <div class="wide">')
H.append(fig(M('scale-day'), 'scale-day', 'a Freight Truck, a Depot, a Cargo Plane in flight and the three airships', 'By day. Left to right: a Freight Truck, a one-tile Depot, a Cargo Plane in flight, then airships A, B and C in flight. 64 pixels a tile; the grid is one tile.'))
H.append(fig(M('scale-night'), 'scale-night', 'the same line-up at night', 'At night. The soft team light on the ground under each airship is a proposal: the game draws none under planes today.'))
H.append('''  </div>
  <p>Each airship is drawn in a frame three tiles across, so its hull runs about two and a half tiles: a little longer than a Cargo Plane in flight, and far bulkier, since a plane is mostly thin wing. In flight its shadow falls about a tile down-sun, a little less than a plane's; moored at a mast it falls less far.</p>
  <div class="gridwrap"><table class="grid"><thead><tr><th></th><th>Long (tiles)</th><th>Across (tiles)</th><th>Desktop, 48 px a tile</th><th>Phone, 28 px a tile</th></tr></thead><tbody>
  <tr><th class="rowh">Cargo Plane in flight <span class="tag">today</span></th><td>2.3</td><td>2.3 (wingspan)</td><td>112 px</td><td>65 px</td></tr>
  <tr><th class="rowh">A · Rigid freighter</th><td>2.6</td><td>1.2</td><td>123 px</td><td>72 px</td></tr>
  <tr><th class="rowh">B · Twin-hull lifter</th><td>2.6</td><td>1.7</td><td>127 px</td><td>74 px</td></tr>
  <tr><th class="rowh">C · Armoured blimp</th><td>2.3</td><td>1.9 (fans)</td><td>112 px</td><td>65 px</td></tr>
  <tr><th class="rowh">Freight Truck <span class="tag">today</span></th><td>0.8</td><td>0.4</td><td>38 px</td><td>22 px</td></tr>
  </tbody></table></div>
  <h3>On a phone</h3>
  <p>A new game on a phone opens at about 28 pixels a tile. Here is the same line-up at that size (drawn at twice the pixels, for a phone's sharp screen).</p>
  <div class="row">''')
H.append(fig(M('phone-day'), 'phone-day', 'line-up at phone size by day', 'By day', w=482))
H.append(fig(M('phone-night'), 'phone-night', 'line-up at phone size at night', 'At night', w=482))
H.append('''  </div>
  <p>All three still read as big and slow at this size. A is the long pale hull with boxes along its sides; B is two grey hulls with a coloured deck between; C is the dark body with four rings. At night the team strips and the windows carry them.</p>
</section>
''')

for v, d in DIRS.items():
    H.append(f'<section id="dir-{v}">\n  <p class="eyebrow">Direction {d["short"]}</p>\n  <h2>{d["name"]}</h2>\n  <p>{d["lede"]}</p>')
    H.append('  <h3>The airship</h3>\n  <div class="dn">')
    H.append(fig(M(f'ship-{v}-day'), f'{v}-ship-day', f'{d["name"]} in both team colours by day', 'By day, yours (cyan) and the rival\'s (red), its shadow on the ground. 96 pixels a tile.'))
    H.append(fig(M(f'ship-{v}-night'), f'{v}-ship-night', f'{d["name"]} at night', 'At night: lit windows, navigation lights, the team strips, and a soft pool of team light under it.'))
    H.append('  </div>\n  <div class="row">')
    H.append(fig(M(f'shadow-{v}'), f'{v}-shadow', 'the ground shadow', 'The ground shadow on its own: the ship\'s outline, softened, drawn down-sun of it.', w=288))
    H.append('  </div>\n  <p>The sprite files themselves, as the game would load them (512 pixels, see-through, nose to the east): yours and the rival\'s by day, the same at night, and the shadow.</p>\n  <div class="row sprites">')
    for t, n, cap in ((0, '', 'Yours, day'), (1, '', 'Rival, day'), (0, '-n', 'Yours, night'), (1, '-n', 'Rival, night')):
        H.append(fig(R(f'{v}{t}{n}'), f'{v}-sprite-{t}{n or "-d"}', f'{d["name"]} sprite', cap, w=168))
    H.append(fig(M(f'shadow-{v}-alpha'), f'{v}-sprite-shadow', 'shadow sprite', 'Shadow', w=168))
    H.append('  </div>\n  <h3>The Mooring Mast</h3>\n  <p>' + d['mast'] + '</p>\n  <div class="dn">')
    H.append(fig(M(f'mast-{v}-day'), f'{v}-mast-day', 'the mast in both team colours by day', 'By day, both team colours. 192 pixels a tile.'))
    H.append(fig(M(f'mast-{v}-night'), f'{v}-mast-night', 'the mast at night', 'At night'))
    H.append('  </div>\n  <h3>Moored</h3>\n  <p>As the game would draw it: the mast like any building, the airship like any aircraft, its mooring cone on the mast\'s cup and its body streaming out downwind.</p>\n  <div class="dn">')
    H.append(fig(M(f'docked-{v}-day'), f'{v}-docked-day', 'the airship moored at its mast', 'By day, 96 pixels a tile'))
    H.append(fig(M(f'docked-{v}-night'), f'{v}-docked-night', 'moored at night', 'At night'))
    H.append('  </div>\n  <div class="dn">')
    H.append(fig(R(f'dock-{v}'), f'{v}-moored-3d-day', 'presentation view of the airship moored at its mast', 'Presentation view (not in the game): the same ship and mast in 3D at the buildings\' angle, showing what can\'t be seen from above.'))
    H.append(fig(R(f'dock-{v}-n'), f'{v}-moored-3d-night', 'presentation view at night', 'The same at night'))
    H.append('  </div>\n  <h3>In a colony</h3>\n  <div class="wide">')
    H.append(fig(M(f'mock-{v}-day'), f'{v}-colony-day', 'a stretch of colony with the airship line', 'At game scale, 48 pixels a tile as on a desktop (select it for twice the size). One airship is moored at the west mast; the other crosses the river on its way to the east mast. A Cargo Plane flies over the south; Freight Trucks drive the road.', q=86, big=f'{v}-colony-day-big.webp'))
    H.append(fig(M(f'mock-{v}-night'), f'{v}-colony-night', 'the same at night', 'The same at night', q=86, big=f'{v}-colony-night-big.webp'))
    webp(M(f'mock-{v}-day-big'), f'{v}-colony-day-big', 82); webp(M(f'mock-{v}-night-big'), f'{v}-colony-night-big', 82)
    H.append('  </div>\n  <div class="pc">')
    H.append('<div><h4>For</h4><ul>' + ''.join(f'<li>{x}</li>' for x in d['pros']) + '</ul></div>')
    H.append('<div><h4>Against</h4><ul>' + ''.join(f'<li>{x}</li>' for x in d['cons']) + '</ul></div>')
    H.append('  </div>\n</section>\n')

H.append(END)
H.append('</main>\n')
open(os.path.join(OUT, 'index.html'), 'w').write('\n'.join(H))
print('wrote', os.path.join(OUT, 'index.html'))

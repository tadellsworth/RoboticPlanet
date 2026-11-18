"""The Express highway design sheet: one HTML page with the pictures beside it, for the owner to choose a direction.

    python3 preview/highway_sheet.py <mockdir> <sheetdir>      (run from renderer/)

<mockdir> holds the pictures of preview/highway_mock.py. Writes <sheetdir>/index.html (no doctype, charset or
viewport: it is published as an artifact), the pictures as WebP beside it, and contact.png (the quick look) copied over.
"""
import os
import shutil
import sys
from PIL import Image

MD, OUT = sys.argv[1], sys.argv[2]
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

DIRS = {
    'a': dict(
        name='Expressway', short='A',
        lede='A motorway, as the road standards would have drawn it. Two one-way carriageways a tile each, with a concrete barrier '
             'and the street lamps down the median between them, a hard shoulder with a red cat\'s-eye line on the outside, an '
             'amber line on the median side, a broken white line and white cat\'s-eyes between two lanes. A smooth surface a shade '
             'darker and bluer than Asphalt. On-ramps come in from the shoulder side with a give-way mark and a chevron gore; the '
             'two carriageways end on two ordinary roads with a hazard nose on the barrier. Ordinary roads go over it on the '
             'game\'s own overpass. Sign gantries span it, their green boards blank. At night the cat\'s-eyes pick out every lane.',
        pros=['Reads as a motorway at a glance, by day from the median and lamps, at night from the strings of cat\'s-eyes: the player sees the tier without a tooltip.',
              'The pair is the natural shape of the idea: out one way, back the other, no return trip on an ordinary road.',
              'Nothing in it is new to the game: the median lamps are the Asphalt street lamps, the crossing is the overpass, the ramps are the one-way join. The art is the game\'s own road drawing with more lines.',
              'The best night picture: a dark river of lane lights across the colony where the roads are white and cyan.'],
        cons=['Two tiles wide: the dearest in land and the hardest to thread through a built-up district; a crossing road needs an overpass two tiles long.',
              'Its two painted lanes per carriageway are cosmetic. The game queues one lane a tile; a truck never overtakes. (The sheet keeps them: a one-lane motorway reads as a road.)',
              'On a phone the median and the lane lines go to a dark band with a pale stripe down it: it still reads as "wide dark road", but the lanes are gone.']),
    'b': dict(
        name='Freight corridor', short='B',
        lede='The robots\' own version: one broad one-way slab a tile wide, kin to the Rail Station\'s apron and the Roadworks\' yard. '
             'Heavy concrete kerbs with a team-colour strip along each, slab joints across it, two darker wheel tracks, a line of '
             'guidance lights set into the middle that glow at night, a big painted one-way arrow. Ramps come in through a '
             'hazard-striped apron where the kerb is cut; a truck-stop lay-by widens the slab on one side; an ordinary road may '
             'cross it at grade on hazard stripes between stop lines, with the game\'s traffic light; it ends on an ordinary road '
             'between two striped buffers with red lamps. A return lane is a second corridor laid beside the first.',
        pros=['One tile wide and one-way: it is a road tile with a new tier, so it costs the least land and the least code, and it threads a district where the pair cannot.',
              'Industrial and team-coloured: it belongs with the Rail Station, the Mooring Mast and the Roadworks, and the strips show whose it is from across the map.',
              'The pale slab reads on a phone where A\'s dark surface does not: a bright band with cyan edges.',
              'At-grade crossings with a light keep it cheap to lay through an existing road net.'],
        cons=['It does not read as a highway: pale and broad, it looks like a runway or a conveyor, and the speed has to be learned.',
              'A single lane means the return trip is a second lane or the ordinary roads: the pair that A gives for free is two strokes here.',
              'Team-colour strips on every tile make a long corridor the loudest thing on the map by day; the game keeps team colour to the lights.',
              'Its night picture is the weakest of the three: a dotted line of guidance lights, no lamps.']),
    'c': dict(
        name='Elevated flyover', short='C',
        lede='The overpass stretched into a road: a one-way deck a tile wide on squat round piers, a quarter of a tile up the screen, '
             'with pale parapets, a team-colour strip along each, a broken white line and cat\'s-eyes, lamps on the parapet every '
             'second tile, and its shadow on the ground down-sun. It rises from an ordinary road on a two-tile ramp between '
             'splayed retaining walls with hazard-striped ends and comes down the same way; ordinary roads and traffic pass '
             'under it anywhere, with no crossing piece at all. Kin to the Viaduct (its deck and parapets) and the overpass.',
        pros=['The most spectacular: a road in the air over the colony, trucks running above the Haulers, the deck lit at night.',
              'No crossings to plan: it goes over every ordinary road for free, and the ground under it stays a road.',
              'One family with the Viaduct and the overpass, and it borrows their rules: a lifted deck drawn over the traffic, piers drawn with the buildings.',
              'The deck a quarter tile up keeps clear of the Maglev (0.9 up) and the Ropeway\'s cable (0.76), so the three can cross.'],
        cons=['The dearest, in Cement and Alloy as well as Asphalt, and the slowest to build: Workers build it like a Viaduct, not the Paver.',
              'Ramps only at its ends: a mid-line on-ramp is a two-tile branch down to the ground, which is a lot of piece for a slip road; and nothing can turn onto it from a crossing.',
              'Drawn lifted, it hides a quarter tile of whatever is north of it, and a long flyover across a district covers buildings\' fronts.',
              'On a phone the lift is seven pixels: it reads as a pale road with a shadow, not a bridge.']),
}

CSS = '''<style>/* The Express highway design sheet: one reading column, the art on its own plates; light and dark themes */
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
H.append('<title>Express Highway Sheet</title>\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&display=swap">')
H.append(CSS)
H.append('''<main>
<header class="top">
  <p class="eyebrow">Terrafall · Express highway art for the owner to choose · November 2026</p>
  <h1>Express highways: a road tier above Asphalt</h1>
  <p class="lede">Wide, banked, one-way lanes with on-ramps, where Freight Trucks and Road Trains run about twice as fast as on Asphalt and Haulers are not allowed. Dear in Asphalt, kept up by a Roadworks, built on the one-way roads, junctions and overpasses the game already has. Here are three directions, each a full tile set (a straight, an on-ramp, a crossing with an ordinary road, an end, a bend, the tile as the Paver leaves it and as traffic wears it), each laid through the same colony by day and at night. Pick one, or mix parts of them. Nothing is installed.</p>
  <p>The game draws its roads itself (a band 12/32 of a tile wide with a kerb, concrete or asphalt, joined to its neighbours, with arrows on the one-way ones, lamps every third tile and worn asphalt cracking into potholes), so all three were drawn the same way: flat top-down tiles the game would autotile from a tile's neighbours and turn to the lane's direction, each with a layer of what glows after dark, as the street lamps have. Every picture of a colony is composed the way the game draws a map, with today's art for the trucks, the Road Train, the Haulers, the Paver and the buildings.</p>
  <nav class="toc"><a href="#scale">Side by side</a><a href="#dir-a">A · Expressway</a><a href="#dir-b">B · Freight corridor</a><a href="#dir-c">C · Elevated flyover</a><a href="#pick">Recommendation</a><a href="#questions">Questions</a><a href="#notes">How it was made</a></nav>
</header>
''')

# ---- scale
H.append('<section id="scale">\n  <p class="eyebrow">Scale</p>\n  <h2>Side by side</h2>\n  <div class="wide">')
H.append(fig(M('scale-day'), 'scale-day', 'a concrete road with Haulers, an asphalt road with a truck, then three tiles of A, B and C with a truck and a Road Train each', 'By day. Left to right: the game\'s concrete road with two Haulers, its Asphalt road with a Freight Truck, then directions A, B and C, three tiles of each with a Freight Truck and a Road Train on it (A: a truck coming back the other way). 64 pixels a tile; the grid is one tile.', q=86))
H.append(fig(M('scale-night'), 'scale-night', 'the same line-up at night', 'At night: the game\'s roads with their lamps and the owner\'s edge glow, then A\'s cat\'s-eyes and median lamps, B\'s strips and guidance lights, C\'s lit parapets.', q=86))
H.append('  </div>')
H.append('''  <p>An ordinary road is 12/32 of a tile wide with a kerb to 16/32. A fills its tile (the carriageway 0.66 of a tile, the median half and the shoulder the rest) and needs two tiles for the pair; B fills 0.84 of its tile between the kerbs; C's deck is the Viaduct's 0.56, drawn a quarter tile up the screen. The speeds below are the proposal (question 3): today a Freight Truck does 1.62 tiles a second times the road's factor, 2 on concrete (trucks 80 % of it), 2.75 on Asphalt.</p>
  <div class="gridwrap"><table class="grid"><thead><tr><th></th><th>Width</th><th>Lanes</th><th>Truck on it</th><th>Road Train</th><th>Crossing an ordinary road</th><th>Laid by</th><th>At 48 px a tile</th><th>At 28 px</th></tr></thead><tbody>
  <tr><th class="rowh">Road <span class="tag">today</span></th><td>1 tile</td><td>two-way</td><td>2.6 tiles/s</td><td>1.1 (35 %)</td><td>junction, light or overpass</td><td>Workers</td><td>18 px pale band</td><td>11 px</td></tr>
  <tr><th class="rowh">Asphalt <span class="tag">today</span></th><td>1 tile</td><td>two-way</td><td>4.5</td><td>4.5</td><td>junction, light or overpass</td><td>the Paver</td><td>18 px dark band</td><td>11 px</td></tr>
  <tr><th class="rowh">A · Expressway</th><td>2 tiles (a pair)</td><td>one-way each</td><td>7.3</td><td>8.9</td><td>overpass only (two tiles of it)</td><td>the Paver</td><td>96 px, median and lamps</td><td>56 px, a dark band with a pale stripe</td></tr>
  <tr><th class="rowh">B · Freight corridor</th><td>1 tile</td><td>one-way</td><td>7.3</td><td>8.9</td><td>at grade with a light, or overpass</td><td>the Paver</td><td>40 px pale slab, cyan edges</td><td>24 px</td></tr>
  <tr><th class="rowh">C · Elevated flyover</th><td>1 tile</td><td>one-way</td><td>7.3</td><td>8.9</td><td>none needed: it goes over</td><td>Workers (like a Viaduct)</td><td>27 px deck, 12 px up</td><td>16 px, 7 up</td></tr>
  </tbody></table></div>
  <h3>Quick look</h3>
  <p>The same colony with each direction's highway through it, by day on top, at night below: a factory district on the left, the highway out to a far Depot, an on-ramp from the district's road, a crossing with the ordinary road running north and south, Haulers on the Asphalt road beside it. 48 pixels a tile. The full pictures are in each direction's section.</p>
  <div class="wide">''')
H.append(fig(M('contact'), 'contact', 'the three directions through the same colony, by day and at night', 'A, B and C, by day and at night.', q=82))
H.append('  </div>\n</section>\n')

for v, d in DIRS.items():
    H.append(f'<section id="dir-{v}">\n  <p class="eyebrow">Direction {d["short"]}</p>\n  <h2>{d["name"]}</h2>\n  <p>{d["lede"]}</p>')
    H.append('  <h3>The tile set</h3>')
    pieces_cap = {
        'a': 'Left to right, each a pair with the eastbound lane below: a straight (a median lamp), the end (each carriageway narrows onto its own ordinary road: the two meet at a junction beyond), the on-ramp and the merge tile after it (the ordinary road joining from the south, a truck coming up it), the 90-degree bend (2 x 2 tiles, banked, a chevron board on the outside), just laid (black, unmarked, cones out), the prepared base before the Paver comes, worn (faded, cracked, potholed, a lane line scrubbed off, a cat\'s-eye dark), and a straight under a sign gantry. 128 pixels a tile.',
        'b': 'Left to right: a straight (the arrow, the guidance lights, the wheel tracks), the on-ramp through its hazard apron (the kerb cut, a give-way line), the lay-by with a truck pulled in, the crossing at grade with the game\'s traffic light and stop lines, the end between its buffers, the bend, just laid, the prepared base, worn (cracked, a kerb spalled and its strip dead, two guidance lights out). 128 pixels a tile.',
        'c': 'Left to right: a straight on its piers with a parapet lamp, the ramp up from an ordinary road, a tile of deck and the ramp down (half lifted, between splayed walls), an ordinary road passing under the deck (a Hauler going under a truck), the bend, the deck poured but unfinished, worn (rust down the face, a length of parapet gone, the strip dark), a straight. 128 pixels a tile.',
    }[v]
    H.append('  <div class="wide">')
    H.append(fig(M(f'pieces-{v}-day'), f'{v}-pieces-day', f'{d["name"]} tile set by day', pieces_cap, q=86))
    H.append(fig(M(f'pieces-{v}-night'), f'{v}-pieces-night', 'the same at night', 'The same at night: what each piece lights.', q=86))
    H.append('  </div>\n  <h3>In a colony</h3>\n  <p>At game scale, 48 pixels a tile as on a desktop (select a picture for twice the size): the highway runs from the factory district on the left (a Depot, a Smelter, an Asphalt Plant and the Roadworks on its loop road) out to a far Depot and Generator, with Freight Trucks and a Road Train on it; a Freight Truck comes up the feeder to the on-ramp; the ordinary concrete road running north and south crosses it; Haulers do their short runs on the Asphalt road beside it and round the district.</p>\n  <div class="wide">')
    H.append(fig(M(f'colony-{v}-day'), f'{v}-colony-day', 'a colony with the highway by day', 'By day.', q=86, big=f'{v}-colony-day-big.webp'))
    H.append(fig(M(f'colony-{v}-night'), f'{v}-colony-night', 'the same colony at night', 'At night.', q=86, big=f'{v}-colony-night-big.webp'))
    webp(M(f'colony-{v}-day-big'), f'{v}-colony-day-big', 82); webp(M(f'colony-{v}-night-big'), f'{v}-colony-night-big', 82)
    H.append('  </div>\n  <h3>Close up</h3>\n  <p>The middle of that colony at 96 pixels a tile: the on-ramp, the crossing, the trucks and the Road Train, the Haulers on the road beside.</p>\n  <div class="dn">')
    H.append(fig(M(f'close-{v}-day'), f'{v}-close-day', 'the on-ramp and crossing close up by day', 'By day.', q=86))
    H.append(fig(M(f'close-{v}-night'), f'{v}-close-night', 'the same at night', 'At night.', q=86))
    H.append('  </div>\n  <h3>On a phone</h3>\n  <p>The same colony at a phone\'s 28 pixels a tile, at its real size and doubled.</p>\n  <div class="row">')
    for tod in ('day', 'night'):
        H.append(fig(M(f'phone-{v}-{tod}'), f'{v}-phone-{tod}', f'the colony at phone size, {tod}', f'Real size, {tod}.'))
    for tod in ('day', 'night'):
        f, (iw, ih) = webp(M(f'phone-{v}-{tod}'), f'{v}-phone-{tod}')
        H.append(f'<figure><div class="plate"><img src="{f}" width="{iw * 2}" height="{ih * 2}" alt="the colony at phone size, doubled, {tod}" loading="lazy"></div><figcaption>Doubled, {tod}.</figcaption></figure>')
    build_cap = {
        'a': 'The Paver lays each carriageway a tile at a time, as it lays Asphalt: behind it the finished road, under it the tile just laid (black, unmarked, cones out until the lines go on), ahead of it the prepared base, and beyond that the tiles still only marked, in the game\'s amber paving mark. A Freight Truck waits where the road ends.',
        'b': 'The Paver lays the slab a tile at a time: behind it the corridor in use, under it the tile just laid, ahead the base, then the amber marks. A Hauler and a truck wait on the finished part.',
        'c': 'Workers build it as they build a Viaduct, pier by pier: the finished deck, a tile of deck poured and unfinished, the next pier standing with no deck on it yet, and the amber marks beyond; two Workers at the pier, one on the deck.',
    }[v]
    H.append('  </div>\n  <h3>Under construction, and worn</h3>\n  <div class="wide">')
    H.append(fig(M(f'build-{v}'), f'{v}-build', 'the highway under construction', build_cap, q=86))
    H.append(fig(M(f'worn-{v}-day'), f'{v}-worn-day', 'a worn stretch by day', 'Worn through the middle, as a busy trunk road is after ten minutes: the surface fades, cracks and breaks into potholes as Asphalt does today, the red resurfacing mark on the worst tile; the Roadworks\' Paver comes out and resurfaces it. 96 pixels a tile.', q=86))
    H.append(fig(M(f'worn-{v}-night'), f'{v}-worn-night', 'the same at night', 'At night the worn stretch goes dark: its cat\'s-eyes, strips or lights are out, which is how you see it from across the map.', q=86))
    H.append('  </div>\n  <div class="pc">')
    H.append('<div><h4>For</h4><ul>' + ''.join(f'<li>{x}</li>' for x in d['pros']) + '</ul></div>')
    H.append('<div><h4>Against</h4><ul>' + ''.join(f'<li>{x}</li>' for x in d['cons']) + '</ul></div>')
    H.append('  </div>\n</section>\n')

H.append('''<section id="pick">
  <p class="eyebrow">Recommendation</p>
  <h2>A, the Expressway, laid a lane at a time the way B is</h2>
  <div class="callout">
    <p>A is the one that reads. A player who has never seen the help knows what a dual carriageway with a median, lamps and cat's-eyes is for, and knows it at 48 pixels a tile by day and from across the map at night, which neither the pale slab nor the low flyover manages. It is also the one that costs the least that is new: its median lamps are the Asphalt street lamps, its crossing is the overpass the Junctions tool already builds, its ramps are the one-way join the roads already make, and its surface is the game's own road drawing with more lines on it. Its night picture, strings of white, amber and red lights across a colony where every other road is white and cyan, is the strongest of the three and the one the lore asks for: roads lit for traffic, and here, for once, the traffic.</p>
    <p>Take the mechanics from B. Under the art, an Express lane should be one tile, one-way, a new tier of road (<code>S.pave</code> 3) with its arrow, so the game's one-way rules, queues, Roadworks and wear all apply unchanged; the pair is two such lanes with opposite arrows, and the art draws the median where a lane sees a lane the other way beside it (question 1). That gives A's picture with B's simplicity, lets a player lay a single lane as a one-way loop where a pair will not fit, and keeps the door open to B's at-grade crossing with a light if the overpass rule proves too strict. C is the best picture of the three in the air and the worst on the ground: everything that makes it spectacular (the lift, the piers, the ramps at each end) is what makes it dear, slow to build and hard to join, and the overpass and the Viaduct already give the game a road in the air where one is needed.</p>
    <p>Two mixes worth making whichever you choose: B's hazard-striped apron on A's on-ramps (the chevron gore alone is quiet at 48 pixels), and C's team-colour strip along A's median barrier at night, so the pair shows whose it is as the roads' edge glow does.</p>
  </div>
</section>

<section class="questions" id="questions">
  <p class="eyebrow">For you to decide</p>
  <h2>Open questions</h2>
  <ol>
    <li><b>Width, and the one-way rule.</b> One tile or two; is a lane always one-way? <p class="rec"><b>One tile a lane, always one-way; a drag lays a pair.</b> A lane is a road tile of the new tier with an arrow, so everything that works on one-way roads (the Arrows tool, queues, wrong-way crawling at half speed, the traffic map) works on it. The Express tool lays two lanes side by side in one stroke, the arrows set out and back (the lane on the right of the drag goes the drag's way, as bots drive on the right), and the art joins them with the median; Shift and drag lays a single lane for a loop. A lane turned the wrong way is a lane: the arrows can be turned later, as on any road.</p></li>
    <li><b>Who may use it.</b> <p class="rec"><b>Freight Trucks, Road Trains and Tankers drive it; Haulers, Workers, Agribots and the Paver never drive along it, only across it at a ramp or a crossing; warbots may march on it at Asphalt speed, no faster.</b> Haulers are barred by the idea; the rest of the small bots follow, or the lane fills with Workers walking to a site. Warbots must be allowed on, or a pair across the map is a wall no army can cross except at a ramp; at Asphalt speed it gives the defender no racetrack. Route planning treats it as closed for the barred types (<code>roadLikeFor</code> already sees roads per owner; this adds per type).</p></li>
    <li><b>Speed.</b> Twice Asphalt, and do Road Trains get more? <p class="rec"><b>Road Trains 2x Asphalt (a factor of 5.5: 8.9 tiles a second); Freight Trucks and Tankers 1.64x (4.5: 7.3 tiles a second).</b> At 2x a Freight Truck does 8.9 tiles a second, twice a Freight Train's top speed and three quarters of a Maglev pod's, and rail loses its reason; at 1.64x a truck beats a train by a quarter, which is right for a dear road, and the Road Train is the one the lane is built for (the idea's "only pays off on asphalt" carried a step further). Both keep their acceleration, so a short lane gains little: that is what makes it a long-haul road without a rule.</p></li>
    <li><b>How it is laid.</b> A Paths tool like Roads; Pave over existing Asphalt; or ramps as separate pieces? <p class="rec"><b>A Paths tool, Express (Shift+E, beside Pave), dragged like Roads; ramps and ends are autotiles, not pieces.</b> Dragging plans the lanes as road tiles marked for the new tier, 0.2 Cement a tile paid as for a road; Workers lay the base, and the Roadworks' Paver comes out and lays the surface over it with Asphalt, nearest first, exactly as it paves (a Roadworks on the net is required, as today). Dragging over your own Asphalt or road upgrades it in place (the road stays open while the Paver works). Wherever an ordinary road touches a lane the art draws a ramp, and where a lane ends on an ordinary road, an end: no pieces to pick. A ramp is a junction tile for the rules: bots give way there as at any junction.</p></li>
    <li><b>Cost.</b> <p class="rec"><b>1 Asphalt a tile (four times an Asphalt road's quarter), plus a quarter Alloy a tile for the barrier, lamps and cat's-eyes, paid from storage as the Paver reaches each tile; nothing for ramps and ends.</b> A 20-tile pair is then 40 Asphalt and 10 Alloy on top of its roads' Cement: a late-game sum from an Asphalt Plant running flat out, which is what keeps it late-game. (C would need 2 Cement and half an Alloy a tile more for its piers and parapets, a Viaduct's price, on top.)</p></li>
    <li><b>Maintenance and wear.</b> Faster or slower than Asphalt; what happens worn through? <p class="rec"><b>It wears like Asphalt (the same counters, <code>WEAR_TRUCK</code> and <code>WEAR_TRAIN</code>), slows the same past half worn, is resurfaced by the Paver at the same mark, and worn through it drops to Asphalt, not to road.</b> It carries only heavy traffic, so a busy pair wears about as fast as a trunk road does today (every eight to ten minutes), and keeping a Roadworks fed with Asphalt is the running cost. Dropping to Asphalt rather than road means a neglected Expressway is still a good road; it just stops being fast, and the lamps and cat's-eyes go dark, which is how you notice.</p></li>
    <li><b>Junctions and crossings.</b> At grade with a light, or only an overpass or ramp? <p class="rec"><b>Only by overpass: an ordinary road crosses a lane on the overpass the Junctions tool builds (4 Cement, 3 Alloy a tile: two tiles for a pair), and two lanes never cross each other.</b> An at-grade crossing with a light would stop the fast traffic every few seconds, which is what the tier exists to avoid; a planned road that would cross a lane shows the overpass in its sketch and its price. Since a lane's ramps are its only joins, a lane is a corridor with doors, which is the point. (If B is chosen, allow the at-grade crossing with a light as drawn, and let the light give the corridor the long green.)</p></li>
    <li><b>Bends.</b> 90 degrees only, like roads, or long diagonals? <p class="rec"><b>90 degrees only, on the bend tile</b>, banked in the art. Roads, track, pipes and walls all run on the grid and every pathfinder in the game walks it; a diagonal lane would be a new kind of tile for the sake of a picture. The bend tile is drawn wide (a pair's is 2 x 2) so it still reads as fast; a bend costs the lane nothing in speed, as corners cost trucks today only their braking.</p></li>
    <li><b>Minimum length.</b> <p class="rec"><b>None in the rules; eight tiles in the advice.</b> Nothing stops a two-tile Express, it simply never pays: a truck's acceleration means a lane shorter than about eight tiles gains it under a second. The Express tool says so in its sketch ("too short to pay") under eight tiles, as the Ropeway tool reports a span out of range, and lets you lay it anyway.</p></li>
    <li><b>The rival.</b> <p class="rec"><b>Not yet.</b> The rival builds no Roadworks today and paves no Asphalt, so an Express is two steps beyond it; when its late game gets a Roadworks, the Architect lays a pair from its base to its biggest Depot cluster and the Steward follows. Raiders should tear up a rival's Express lane as they tear up its roads: it is the best target they will ever have.</p></li>
    <li><b>The Hollow.</b> <p class="rec"><b>Yes.</b> A ground road under a cavern roof needs nothing new; in the Hollow's permanent night a lit Expressway between the Bloom's violet is the lore's picture exactly (its roads become the main light), and the Murmur cut its lamps as they cut the roads'. C's deck, a quarter tile up, clears the roof too.</p></li>
    <li><b>A lore line.</b> <p class="rec">For LORE.md and the Lore guide, in its voice: <i>"The road standards had a chapter on arterials: dual carriageways between the towns, banked for speed and lit all night, for the day the towns had traffic to send each other. COBALT wrote it, for coastal cities that were already losing their coasts; every vanguard carried a copy. The first arterial on Ithaca I runs from a Smelter to a Depot. The trucks keep to the limit."</i> Flavour lines, if wanted: the lane, <i>"Arterial, built to the standard. Speed limit posted. Nobody reads it."</i>; the gantry, <i>"Destinations left blank. The towns were to be named on arrival."</i>; the Roadworks, when it lays one, <i>"Arterial online. Passenger standard, freight only."</i></p></li>
    <li><b>Mixing.</b> Parts move between the directions freely: A's median and lamps on a single B lane, B's apron on A's ramps, C's ramp as A's way over a second lane. Say which.</li>
  </ol>
</section>

<section class="notes" id="notes">
  <p class="eyebrow">How it was made</p>
  <p>The game draws its roads in code rather than from art (<code>drawRoad</code>, <code>drawRoadArrow</code>, <code>drawWear</code> and <code>drawOverpassDeck</code> in <code>js/render.js</code>), so the tile sets were drawn the same way, in Python (<code>renderer/preview/highway_tiles.py</code>): every piece painted in tile units at four times its size and averaged down to 256 pixels, as a flat top-down tile for a lane running east, with a second layer of what glows after dark, the way the street lamps have a lit head. The game's own colours were kept where they apply (its asphalt and concrete, its overpass deck and railings, its amber overpass dashes, its team cyan), and the geometry follows its roads: an ordinary road 12/32 of a tile wide with its kerb to 16/32, the overpass deck 0.46 of a tile, the Viaduct's deck 0.56. The pictures of a colony (<code>renderer/preview/highway_mock.py</code>) are composed the way the game draws a map, with the Maglev sheet's kit: its ground and water, roads and street lamps, the night grade and the roads' edge glow, light pools and haze, and today's art for the buildings, the Freight Trucks, the Road Train and its trailers, the Tanker, the Haulers, the Paver and the Workers, each with its headlights at night. A and B are drawn with the roads, turned and mirrored from the one eastbound set as the game would autotile them, their lit layer added as light at night; C is drawn as the overpass is, its shadow with the roads and its deck lifted a quarter tile up the screen over the traffic, its piers sorted in with the buildings. No 3D render was needed, so the renderer's Chrome was left alone. The scripts are kept, so the direction you choose can be finished from them, as tiles for <code>art/roads</code> or as code in <code>drawRoad</code>.</p>
</section>
</main>
''')

with open(os.path.join(OUT, 'index.html'), 'w') as fh:
    fh.write('\n'.join(H))
shutil.copy(M('contact'), os.path.join(OUT, 'contact.png'))
print('wrote', OUT)

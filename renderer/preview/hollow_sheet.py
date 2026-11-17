"""The design sheet for the Hollow set and the Murmur's tunnels: one HTML page with every image embedded, for the owner to
approve, and the individual renders saved beside it (renders/).

    python3 preview/hollow_sheet.py <sheetdir>        (run from renderer/, after preview/hollow_mock.py)
"""
import base64
import io
import json
import os
import shutil
import sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GAME = os.path.normpath(os.path.join(ROOT, '..'))
HB = os.path.join(ROOT, 'out', 'art', 'biomes', 'hollow')
H3 = os.path.join(ROOT, 'out', 'hollow')
PV = os.path.join(ROOT, 'out', 'preview', 'hollow')
OUT = sys.argv[1]
REN = os.path.join(OUT, 'renders')
os.makedirs(REN, exist_ok=True)


def webp_bytes(im, q, lossless=False):
    b = io.BytesIO()
    im.save(b, 'WEBP', quality=q, method=6, lossless=lossless)
    return b.getvalue()


def img(path, q=86, crop=None, w=None, alt=''):
    im = Image.open(path)
    im = im.convert('RGBA') if im.mode in ('RGBA', 'LA', 'P') else im.convert('RGB')
    if crop:
        im = im.crop(crop)
    data = base64.b64encode(webp_bytes(im, q)).decode()
    W, H = im.size
    style = f' style="width:{w}px"' if w else ''
    return f'<img src="data:image/webp;base64,{data}" width="{W}" height="{H}" alt="{alt}"{style} loading="eager">'


# ---------------------------------------------------------------------------------------------- the size budget
def wsize(p, q):
    im = Image.open(p)
    im = im.convert('RGBA') if im.mode in ('RGBA', 'LA', 'P') else im.convert('RGB')
    return len(webp_bytes(im, q))


B_ROWS = []
groups = [
    ('Terrain', [('ground-hollow', f'{HB}/ground.png', 80), ('ground-glow-hollow', f'{HB}/ground-glow.png', 80), ('water-hollow', f'{HB}/water.png', 80),
                 ('water-glow-hollow', f'{HB}/water-glow.png', 80), ('rock-hollow', f'{HB}/rock.png', 80), ('cliff-hollow', f'{HB}/cliff.png', 85),
                 ('wall-hollow', f'{HB}/wall.png', 85)]),
    ('Chasm (6 tiles)', [(f'{k}-hollow', f'{HB}/{k}-hollow.png', 82) for k in ['chasm', 'chasm-wall', 'chasm-wall-2', 'chasm-lip-n', 'chasm-lip-w', 'chasm-lip-e']]),
    ('Plants (6 + glow)', [(f'plant-hollow-{k}{g}', f'{HB}/plant-{k}{g}.png', 85) for k in range(1, 7) for g in ('', '-glow')]),
    ('Breach shaft', [('breach-light-hollow', f'{H3}/breach-light.png', 80), ('breach-beam-hollow', f'{H3}/breach-beam.png', 80), ('breach-motes-hollow', f'{H3}/breach-motes.png', 80)]),
    ('Floating Crystal', [('floater-hollow', f'{H3}/floater.png', 82)]),
    ('Bloom veins', [('veins-hollow', f'{H3}/veins.png', 85)]),
    ('Stone pillars (2)', [('pillar-1-hollow', f'{H3}/pillar-1.png', 82), ('pillar-2-hollow', f'{H3}/pillar-2.png', 82)]),
    ('Side chamber', [('chamber-hollow', f'{H3}/chamber.png', 82)]),
    ("The Deep's mound", [('deep-mound-hollow', f'{H3}/deep-mound.png', 82)]),
]
hollow_total = 0
for name, files in groups:
    n = sum(wsize(p, q) for _, p, q in files)
    hollow_total += n
    B_ROWS.append((name, len(files), n))
exit_day = wsize(f'{H3}/exit-open.png', 85) + wsize(f'{H3}/exit-collapsed.png', 85)
exit_night = wsize(f'{H3}/exit-open-night.png', 85) + wsize(f'{H3}/exit-collapsed-night.png', 85)
exit_tod = 2 * exit_day + exit_night            # morning and evening re-lights estimated at the day art's size
page = os.path.getsize('/home/user/RoboticPlanet/dist/terrafall.html') if os.path.exists('/home/user/RoboticPlanet/dist/terrafall.html') else 16401869
LIMIT = 16 * 1024 * 1024
kb = lambda n: f'{n / 1024:,.0f} KB'
b64 = lambda n: n * 4 / 3

# ---------------------------------------------------------------------------------------------- copy the renders beside the page
copies = {
    'terrain': [(f'{HB}/{k}.png', f'{k}-hollow.png') for k in ['ground', 'ground-glow', 'water', 'water-glow', 'rock', 'cliff', 'wall']]
               + [(f'{HB}/{k}-hollow.png', f'{k}-hollow.png') for k in ['chasm', 'chasm-wall', 'chasm-wall-2', 'chasm-lip-n', 'chasm-lip-w', 'chasm-lip-e']],
    'plants': [(f'{HB}/plant-{k}{g}.png', f'plant-hollow-{k}{g}.png') for k in range(1, 7) for g in ('', '-glow')],
    'sprites': [(f'{H3}/{k}.png', f'{k}.png') for k in ['floater', 'veins', 'pillar-1', 'pillar-2', 'chamber', 'deep-mound', 'breach-light', 'breach-beam', 'breach-motes',
                                                       'exit-open', 'exit-open-night', 'exit-collapsed', 'exit-collapsed-night', 'scuttler-rust-night', 'scuttler-white-night']],
    'scenes': [(f'{PV}/{f}', f) for f in sorted(os.listdir(PV)) if f.endswith('.png')],
}
for d, lst in copies.items():
    os.makedirs(os.path.join(REN, d), exist_ok=True)
    for src, dst in lst:
        shutil.copyfile(src, os.path.join(REN, d, dst))
shutil.copyfile(os.path.join(ROOT, 'preview', 'hollow_specs.json'), os.path.join(REN, 'hollow_specs.json'))

# ---------------------------------------------------------------------------------------------- the page
def card(title, key, size, text, game, big=None, wide=False):
    return f'''<article class="card{' wide' if wide else ''}">
  <header><h3>{title}</h3><p class="meta"><code>{key}</code> · {size}</p></header>
  <p>{text}</p>
  <div class="pair">
    <figure class="game"><div class="plate">{game}</div><figcaption>Game scale, 48 px a tile</figcaption></figure>
    {f'<figure class="big"><div class="plate scroll">{big}</div><figcaption>Enlarged</figcaption></figure>' if big else ''}
  </div>
</article>'''


T = 96  # the close-ups' tile size
mockbig = f'{PV}/hollow-mock-big.png'
cards_hollow = [
    card('Floor, black water, rock and chasm', 'ground · water · rock · chasm-*', '512 px tiles, 4 × 4 map tiles each',
         'The cave floor is packed grey-violet silt and worn stone flags, with Crystal grit and patches of the Bloom’s moss. The Bloom’s root-veins run between the patches and glow at night. '
         'The lakes are near black, with the Bloom on the roof reflected in them as faint points. Rock is the cave wall: black, worn smooth, and darker the further in you go, so the walls rise into the dark. '
         'The chasm is the canyon set redone for the Hollow, its void deeper than any surface canyon’s. Tunnel ridges aren’t painted into the floor, because a pattern repeating every 4 tiles would show. They’re drawn along the tunnel network instead (see below).',
         img(f'{PV}/asset-terrain-game.png'), img(f'{PV}/asset-terrain-big.png', 84), wide=True),
    card('Cave walls', 'wall-hollow (new) · cliff-hollow', '128 × 64 and 128 × 48 strips',
         'Where rock meets floor, a wall face runs along the rock’s south edge: wet stone fading up into black, with root curtains hanging out of the dark. It’s a new piece, drawn on the floor tile below a rock tile. '
         'The ledge face (<code>cliff-hollow</code>) is the usual cliff, for floors at different levels.',
         img(f'{PV}/asset-walls-game.png'), img(f'{PV}/asset-walls-big.png', 84)),
    card('Breach shaft', 'breach-light · breach-beam · breach-motes', 'pool 7.5 tiles, column 7 × 14 tiles',
         'The only daylight in the Hollow: a column of pale gold coming down a hole in the roof. Seen from above, it rises from its pool of light up the screen and fades toward the roof, with dust in the beam. '
         'Under the pool the game shows the ground and the buildings as it does by day, warmed. The column is added over everything. Both are soft images, so they stay small.',
         img(f'{PV}/asset-breach-game.png'), img(f'{PV}/asset-breach-big.png', 84)),
    card('Floating Crystal', 'floater-hollow', 'about 6.4 tiles across; its top about 4 × 3 tiles',
         'A raft of stone so rich in Ring Crystal that it floats over a chasm. The top is a crust of pale lilac points, flat enough to put a Ropeway station or a Tap on. '
         'A beard of big crystal hangs underneath, glowing violet, with roots trailing into the chasm and three still tethered up into the dark of the roof.',
         img(f'{PV}/asset-floater-game.png'), img(f'{PV}/asset-floater-big.png', 84)),
    card('Bloom veins', 'veins-hollow', 'about 1 tile',
         'The Hollow’s Fiber, harvested where Stalks can’t grow. It’s a knot of the Bloom’s root-veins heaving out of the floor round three swollen bulbs, where the charge they carry collects. '
         'It’s bright, so you can find it across the dark. It’s also violet and fleshy, so nobody takes it for Crystal, which has hexagonal points.',
         img(f'{PV}/asset-veins-game.png'), img(f'{PV}/asset-veins-big.png', 84)),
    card('Stone pillars', 'pillar-1-hollow · pillar-2-hollow', 'about 1.4 tiles at the foot',
         'Columns rising into the roof’s dark, worn smooth, with a spiral cut round them at a pitch too even to be natural. The Bloom grows in the grooves, so at night the spiral shows as a coil of violet light. '
         'There are two: a thick one with three grooves and a slimmer one with five. The sprite fades out toward the top, so the column has no visible end.',
         img(f'{PV}/asset-pillars-game.png'), img(f'{PV}/asset-pillars-big.png', 84)),
    card('Side chamber', 'chamber-hollow', 'about 3 × 2 tiles, laid on the floor of a pocket in the rock',
         'Robot parts laid out in rows: battery cells, tallest first, then Chips, then sensor heads all turned to face the way in, then wheels and arms. The trim comes from every colony’s colours. '
         'One battery is missing from its row and has left a ring in the dust. One Chip still holds a little charge. Drag marks lead in. Nothing explains it.',
         img(f'{PV}/asset-chamber-game.png'), img(f'{PV}/asset-chamber-big.png', 84)),
    card('The Deep’s mound', 'deep-mound-hollow', 'about 2.5 times a nest-3 across (shown beside one)',
         'The heart of the Hollow, in the cathedral chamber at its centre. It’s a Burrow built bigger than any nest: nine spires and an outer ring, eight tunnels, molehills where they surface, '
         'and the Deep’s tendril star risen high out of the throat. Only the star shows. The Deep itself is never seen whole.',
         img(f'{PV}/asset-deep-mound-game.png'), img(f'{PV}/asset-deep-mound-big.png', 84)),
    card('Plants', 'plant-hollow-1 … 6, with glows', '256 px each, scenery like every biome’s plants',
         'Six kinds, scattered over open floor. From left: a bracket fungus with faintly glowing edges; velvet puffballs, two split open on lilac crystal grit; a tendril star; '
         'cave flowers of curled gypsum crystal; a dripstone in a collar of moss; a cushion of spore moss. None looks like a resource: no violet hexagonal points, and no teal stalks.',
         img(f'{PV}/asset-plants-game.png'), img(f'{PV}/asset-plants-big.png', 84), wide=True),
]

exit_card = card('Tunnel exit', 'tunnel-exit · tunnel-exit-collapsed', 'about half a tile; smaller than nest-1',
                 'A burrow mouth: heaved soil round a dark throat, with the Bloom’s veins running down into it and glowing at night. There’s one version for every map, because the soil is thrown up from below, as it is round the nests. '
                 'When warbots cave one in, the throat fills with rubble and loose soil, and the veins are torn and go dark.',
                 img(f'{PV}/asset-exit-open-game.png') + img(f'{PV}/asset-exit-collapsed-game.png'),
                 img(f'{PV}/asset-exit-open-big.png', 84) + img(f'{PV}/asset-exit-collapsed-big.png', 84))

biome_rows = ''
for b, name, note in [('desert', 'The Rust', 'At night the armoured Rust variant comes up out of the exits.'),
                      ('jungle', 'Greenreach', 'At night the base form comes up.'),
                      ('polar', 'Hoarfell', 'At night the pale, shaggy Hoarfell variant comes up.')]:
    biome_rows += f'''<section class="biome">
  <h3>{name}</h3>
  <div class="dn">
    <figure><div class="plate">{img(f"{PV}/tunnels-{b}-day.png")}</div><figcaption>By day</figcaption></figure>
    <figure><div class="plate">{img(f"{PV}/tunnels-{b}-night.png")}</div><figcaption>At night</figcaption></figure>
  </div>
  <div class="dn close">
    <figure><div class="plate">{img(f"{PV}/tunnels-{b}-day-big.png", 84)}</div><figcaption>Enlarged, by day</figcaption></figure>
    <figure><div class="plate">{img(f"{PV}/tunnels-{b}-night-big.png", 84)}</div><figcaption>Enlarged, at night. {note}</figcaption></figure>
  </div>
</section>'''

budget_rows = ''.join(f'<tr><td>{n}</td><td class="num">{c}</td><td class="num">{kb(s)}</td></tr>' for n, c, s in B_ROWS)

html = f'''<meta charset="utf-8">
<title>The Hollow Art Set</title>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap">
<style>
/* Layout: one reading column for the words, plates of night art in wide figures; dark first, because the art is night */
:root {{
  --bg: #0f0d16; --surface: #18151f; --plate: #07060b; --fg: #e8e4ef; --muted: #a49cb2; --line: #2c2738;
  --violet: #b48cff; --gold: #e8c98a; --cyan: #38d4ff;
  --display: "Space Grotesk", "Segoe UI", system-ui, sans-serif; --body: Inter, "Segoe UI", system-ui, sans-serif; --mono: "JetBrains Mono", ui-monospace, Menlo, monospace;
  color-scheme: dark;
}}
@media (prefers-color-scheme: light) {{ :root:not([data-theme="dark"]) {{
  --bg: #f4f2f7; --surface: #ffffff; --plate: #07060b; --fg: #1d1a24; --muted: #5f586c; --line: #dcd7e4;
  --violet: #6a3fc0; --gold: #8a6420; --cyan: #0a7ea4; color-scheme: light; }} }}
:root[data-theme="light"] {{
  --bg: #f4f2f7; --surface: #ffffff; --plate: #07060b; --fg: #1d1a24; --muted: #5f586c; --line: #dcd7e4;
  --violet: #6a3fc0; --gold: #8a6420; --cyan: #0a7ea4; color-scheme: light; }}
:root[data-theme="dark"] {{
  --bg: #0f0d16; --surface: #18151f; --plate: #07060b; --fg: #e8e4ef; --muted: #a49cb2; --line: #2c2738;
  --violet: #b48cff; --gold: #e8c98a; --cyan: #38d4ff; color-scheme: dark; }}
* {{ box-sizing: border-box; }}
body {{ background: var(--bg); color: var(--fg); font: 15px/1.6 var(--body); margin: 0;
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 32px 64px; }}
main {{ max-width: 1240px; margin: 0 auto; display: grid; gap: 56px; }}
h1, h2, h3 {{ font-family: var(--display); text-wrap: balance; margin: 0; letter-spacing: -0.01em; }}
h1 {{ font-size: clamp(30px, 5vw, 46px); line-height: 1.08; }}
h2 {{ font-size: 26px; }}
h3 {{ font-size: 19px; }}
p {{ margin: 0; max-width: 68ch; }}
code {{ font: 0.86em var(--mono); color: var(--violet); }}
.eyebrow {{ font: 500 12px var(--mono); text-transform: uppercase; letter-spacing: 0.12em; color: var(--gold); }}
.lede {{ font-size: 17px; color: var(--muted); }}
header.top {{ display: grid; gap: 14px; }}
section {{ display: grid; gap: 18px; min-width: 0; }}
.plate {{ background: var(--plate); border-radius: 6px; overflow: hidden; line-height: 0; width: fit-content; max-width: 100%; }}
.plate img {{ display: block; max-width: 100%; height: auto; }}
.plate.scroll {{ overflow-x: auto; }}
.plate.scroll img {{ max-width: none; }}
.plate.oneone {{ overflow-x: auto; }}
.plate.oneone img {{ max-width: none; }}
figure {{ margin: 0; display: grid; gap: 6px; min-width: 0; }}
figcaption {{ font-size: 13px; color: var(--muted); }}
.scale {{ font: 12px var(--mono); color: var(--muted); }}
.cards {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 560px), 1fr)); gap: 20px; }}
.card {{ background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 18px; display: grid; gap: 12px; align-content: start; min-width: 0; }}
.card.wide {{ grid-column: 1 / -1; }}
.card header {{ display: grid; gap: 2px; }}
.meta {{ font-size: 13px; color: var(--muted); }}
.pair {{ display: flex; flex-wrap: wrap; gap: 14px; align-items: flex-start; }}
.pair figure.game {{ flex: 0 1 auto; }}
.pair figure.big {{ flex: 1 1 320px; }}
.pair .plate img + img {{ margin-top: 4px; }}
.closeups {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 380px), 1fr)); gap: 14px; }}
.dn {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr)); gap: 12px; }}
.biome {{ gap: 12px; }}
.legend {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); gap: 6px 24px; padding: 0; margin: 0; list-style: none; font-size: 14px; }}
.legend li {{ padding-left: 14px; position: relative; }}
.legend li::before {{ content: ""; position: absolute; left: 0; top: 0.62em; width: 6px; height: 6px; border-radius: 50%; background: var(--violet); }}
.rec {{ background: var(--surface); border: 1px solid var(--line); border-left: 3px solid var(--violet); border-radius: 8px; padding: 18px 20px; display: grid; gap: 10px; }}
.rec ol, .notes ul {{ margin: 0; padding-left: 20px; display: grid; gap: 6px; max-width: 76ch; }}
table {{ border-collapse: collapse; font-size: 14px; min-width: 520px; }}
.tablewrap {{ overflow-x: auto; }}
th, td {{ text-align: left; padding: 7px 12px 7px 0; border-bottom: 1px solid var(--line); vertical-align: top; }}
th {{ font: 500 12px var(--mono); text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); }}
td.num, th.num {{ text-align: right; font-variant-numeric: tabular-nums; padding-right: 0; padding-left: 16px; white-space: nowrap; }}
tr.total td {{ font-weight: 600; border-bottom: 0; }}
.twocol {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 460px), 1fr)); gap: 24px; align-items: start; }}
.notes {{ display: grid; gap: 10px; }}
</style>

<main>
<header class="top">
  <p class="eyebrow">Terrafall · art for approval · November 2026</p>
  <h1>The Hollow and the Murmur’s tunnels</h1>
  <p class="lede">The Hollow is its own map, always at night, in the caverns under the Bloom. The tunnels and their exits are for every map where the Murmur are on. Everything is shown the way the game draws it at night, at 48 pixels a tile, with close-ups of the same art enlarged. Nothing is installed yet.</p>
</header>

<section>
  <p class="eyebrow">The look</p>
  <h2>A stretch of the Hollow</h2>
  <p>A colony has landed under a breach. Its pool of daylight is the only daylight on the map, and inside it the ground and buildings show as by day. Everywhere else it is night, and the colony’s roads are the main light: edge strips in the colony’s colour, amber lamps on concrete, white on asphalt.</p>
  <div class="plate oneone">{img(f"{PV}/hollow-mock.png", 88, alt="The Hollow at game scale")}</div>
  <p class="scale">Shown at 1:1, 32 × 20 tiles. On a narrow screen it scrolls sideways.</p>
  <ul class="legend">
    <li>Centre left: the Command Base under the breach, the column of light rising from it.</li>
    <li>East: an asphalt road to a Ropeway station on the chasm’s edge; the cable crosses to a second station on a floating Crystal mass.</li>
    <li>North: a Murmur nest, its tunnel ridges reaching for the Generator and the Ropeway.</li>
    <li>North of the ring road: a tunnel exit, three Scuttlers standing still at the edge of the light.</li>
    <li>South-west: a black lake, faintly lit at the shore. Far west: a caved-in exit.</li>
    <li>South: two Bloom-vein nodes by the Harvester, and two stone pillars.</li>
    <li>Top left, in a pocket of the rock: a side chamber, parts in rows.</li>
  </ul>
  <div class="closeups">
    <figure><div class="plate">{img(mockbig, 84, crop=(int(4 * T), int(3 * T), int(14 * T), int(13 * T)))}</div><figcaption>Enlarged: the colony under the breach</figcaption></figure>
    <figure><div class="plate">{img(mockbig, 84, crop=(int(18 * T), int(4 * T), int(30 * T), int(14 * T)))}</div><figcaption>Enlarged: the Ropeway to the floating Crystal</figcaption></figure>
    <figure><div class="plate">{img(mockbig, 84, crop=(int(11 * T), int(0.5 * T), int(21 * T), int(8 * T)))}</div><figcaption>Enlarged: the nest, its ridges and an exit</figcaption></figure>
  </div>
</section>

<section>
  <p class="eyebrow">Biome key: hollow</p>
  <h2>The Hollow set</h2>
  <p>Built like the other biomes: tiles lit as if by a work lamp, which the game’s night grade takes down to the Hollow’s violet dark, plus glow maps for what gives its own light. The set pieces are night renders only, since it is never day down there.</p>
  <div class="cards">{''.join(cards_hollow)}</div>
</section>

<section>
  <p class="eyebrow">Every map with the Murmur on</p>
  <h2>Tunnels and exits</h2>
  <p>Each nest’s network spreads at night toward power. Raised ridges of heaved earth mark the tunnels, with violet root-veins breaking through along them. By day they’re low and easy to miss. At night the veins glow and pulses of light run back along them to the nest, a dark mirror of the colony’s roads. Exits open along the network.</p>
  <div class="cards">{exit_card}</div>
  {biome_rows}
  <section class="biome">
    <h3>The Hollow</h3>
    <div class="dn"><figure><div class="plate">{img(f"{PV}/tunnels-hollow-night.png")}</div><figcaption>Always night. The same ridges over the Hollow floor’s own veins.</figcaption></figure></div>
  </section>
</section>

<section>
  <p class="eyebrow">Recommendation</p>
  <h2>Draw the ridges in code, not from tiles</h2>
  <div class="twocol">
    <div class="rec">
      <p>I recommend the game draws the ridges itself, as smooth curves through the tunnel’s tiles. Everything on this sheet was drawn that way, by a small Canvas prototype (<code>renderer/tunnels/ridges.js</code>) written in the game’s own drawing API.</p>
      <ol>
        <li>The network grows every night and dies back when a nest is wrecked. A drawn ridge can creep forward and taper at the digging end. A tile set can only add a whole tile at a time.</li>
        <li>The pulses have to run along the veins toward the nest. The code knows which way each ridge runs. Tile art doesn’t, and would need animation frames for every piece.</li>
        <li>Mole ridges wander. A tile set forces them through tile centres at right angles, and they read as pipework or roads (compare below).</li>
        <li>It costs no image bytes. The earth takes the colour of the ground under it, which the game already works out for the minimap, so it suits every biome without extra art. A tile set needs about 15 pieces, each with a glow: about 120 KB per biome.</li>
        <li>It stays cheap to draw. Bake the earth into the ground layer when the network changes (once a night), put the vein light in the night glow layer, and draw only the pulses live.</li>
      </ol>
    </div>
    <div class="notes">
      <figure><div class="plate">{img(f"{PV}/ridges-tiles-day.png")}</div><figcaption>The same network from a tile set: straights, bends, tees and a cross. It reads as pipework.</figcaption></figure>
      <figure><div class="plate scroll">{img(f"{PV}/ridges-pieces.png", 88)}</div><figcaption>The pieces a tile set would need (drawn by the same code): straight, bend, tee, cross, end.</figcaption></figure>
    </div>
  </div>
</section>

<section>
  <p class="eyebrow">Install budget</p>
  <h2>What it adds to the game</h2>
  <p>The one-file build is {kb(page)} against a {kb(LIMIT)} limit, so {kb(LIMIT - page)} of headroom. The Hollow set goes in a bundle of its own beside the page, as the newer biomes’ art does, and loads only when the Hollow is played. Only the tunnel exits go on the page itself. Sizes are WebP, as the game ships its art.</p>
  <div class="twocol">
    <div class="tablewrap"><table>
      <thead><tr><th>The Hollow (own bundle)</th><th class="num">Files</th><th class="num">WebP</th></tr></thead>
      <tbody>{budget_rows}
      <tr class="total"><td>Total, as WebP</td><td class="num">{sum(c for _, c, _ in B_ROWS)}</td><td class="num">{kb(hollow_total)}</td></tr>
      <tr class="total"><td>In <code>dist/biome-hollow.js</code> (base64)</td><td></td><td class="num">{kb(b64(hollow_total))}</td></tr>
      </tbody></table></div>
    <div class="tablewrap"><table>
      <thead><tr><th>Every map</th><th class="num">Size</th></tr></thead>
      <tbody>
      <tr><td>Tunnel exits, open and caved in, day art: on the page (base64)</td><td class="num">{kb(b64(exit_day))}</td></tr>
      <tr><td>Their morning, evening and night re-lights: in the time-of-day bundles beside the page (base64, morning and evening estimated)</td><td class="num">{kb(b64(exit_tod))}</td></tr>
      <tr><td>Tunnel ridges: drawn in code, no images</td><td class="num">0 KB</td></tr>
      <tr class="total"><td>Added to the page</td><td class="num">{kb(b64(exit_day))}</td></tr>
      </tbody></table></div>
  </div>
  <p>For comparison, the Bloom’s bundle is 582 KB. To trim the Hollow further, the floating Crystal and the Deep’s mound can ship at 512 px instead of 768 px, saving about 40 KB with a little softness when zoomed right in.</p>
</section>

<section class="notes">
  <p class="eyebrow">Lore</p>
  <h2>Where I had to interpret</h2>
  <ul>
    <li><b>Breach shafts.</b> The lore gives columns of pale gold. I made the pool of light under one show the day art, so a colony under a breach looks like it stands in daylight while the rest of the map is night.</li>
    <li><b>Floating Crystal.</b> Lore and Ideas say the masses hang in midair and are reached by Ropeway or bridge. I made each one a raft with a flat crystal crust on top, so stations can stand on it, and gave three of them roots still tethered to the roof.</li>
    <li><b>The ceiling.</b> It is never drawn. Instead the rock masses darken toward their middles, the walls fade up into black, and the pillars fade out toward the top.</li>
    <li><b>Bloom veins as Fiber.</b> The lore says Fiber comes from harvesting the veins. I drew the node as swollen bulbs where the drained charge collects on its way down, which is also why harvesting draws the Murmur.</li>
    <li><b>The side chamber.</b> The lore says only “laid out in rows”. I chose the kinds of part, sorted them by size, turned every sensor head to face the way in, took trim from all four colonies, and left one battery missing and one Chip still lit. Nothing on it says why, so it doesn’t answer whether the Murmur are only animals.</li>
    <li><b>The Deep’s mound.</b> The brief gives only the star “wider than a Hauler”, rising from the mound. The extra spires, the eight tunnels and the molehills round it are mine.</li>
    <li><b>Crystal-form plants.</b> The biome rules forbid violet crystals in scenery, because Crystal is a resource. So the crystal forms are pale gypsum flowers and lilac grit inside split puffballs.</li>
    <li><b>The tendril-star plant</b> is shaped like the Murmur’s star, as if the Bloom were grown from the same flesh. It may hint at too much, so it’s the easiest plant to swap out.</li>
    <li><b>Water lit at the edges.</b> I read this as a faint lilac line along the shore, which the game would draw, plus the Bloom on the roof reflected in the black water.</li>
    <li><b>“White and amber ribbons.”</b> The game already lights concrete roads amber and asphalt white, and edges them in the colony’s colour. I kept that, so the Hollow’s roads look like roads anywhere else at night.</li>
    <li><b>Regional variants.</b> The night scenes use the Murmur models’ existing variants: armoured in the Rust and pale and shaggy in Hoarfell. The game draws one Scuttler everywhere today.</li>
    <li><b>Tunnel exits</b> are one version for every biome. The soil is thrown up from below, as it is round the nests, so it doesn’t take the surface colour.</li>
  </ul>
</section>

<section class="notes">
  <p class="eyebrow">Source</p>
  <h2>Where it comes from</h2>
  <p>Every image is rendered from the scenes on the <code>hollow-art</code> branch: <code>renderer/terrain/terrain_hollow.py</code>, <code>canyon_hollow.py</code> and <code>plants_hollow.py</code> (terrain and plants), <code>renderer/b/hollow.js</code> (the exits, veins, Crystal raft, pillars and chamber), <code>murmur_moles.js c=burrow&amp;s=4</code> (the Deep’s mound), <code>renderer/post/hollow_post.py</code> (the breach light), <code>renderer/tunnels/ridges.js</code> (the ridges) and <code>renderer/preview/hollow_mock.py</code> (these scenes). The proposed keys, sizes and anchors are in <code>renderer/preview/hollow_specs.json</code>. The individual renders are saved next to this page, in <code>renders/</code>.</p>
</section>
</main>
'''
with open(os.path.join(OUT, 'index.html'), 'w') as f:
    f.write(html)
print('sheet', os.path.join(OUT, 'index.html'), round(os.path.getsize(os.path.join(OUT, 'index.html')) / 1024 / 1024, 2), 'MB')
print('budget hollow', hollow_total, 'exits day', exit_day, 'tod', exit_tod, 'page', page)

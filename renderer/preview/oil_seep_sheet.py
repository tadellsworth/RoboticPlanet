"""The oil seep design sheet: one HTML page with the pictures beside it, for the owner to choose a direction.

    python3 preview/oil_seep_sheet.py <mockdir> <sheetdir>      (run from renderer/, after preview/oil_seep_mock.py)

Writes <sheetdir>/index.html, the pictures as WebP next to it, and contact.png (the quick look) copied over.
"""
import os
import shutil
import sys
from PIL import Image

MD, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)


def webp(src, name, q=86):
    im = Image.open(src)
    im = im.convert('RGBA') if im.mode in ('RGBA', 'LA', 'P') else im.convert('RGB')
    if im.mode == 'RGBA' and im.getchannel('A').getextrema()[0] == 255:
        im = im.convert('RGB')
    im.save(os.path.join(OUT, name + '.webp'), quality=q, method=6)
    return name + '.webp', im.size


def fig(name, alt, cap, w=None, cls=''):
    f, (iw, ih) = webp(os.path.join(MD, name + '.png'), name)
    dw, dh = (w, round(ih * w / iw)) if w else (iw, ih)
    return (f'<figure class="{cls}"><div class="plate"><img src="{f}" width="{dw}" height="{dh}" alt="{alt}" loading="lazy"></div>'
            f'<figcaption>{cap}</figcaption></figure>')


DIRS = {
    'a': dict(
        name='Fresh spill', short='A',
        lede='One big smooth puddle: a few wide lobes and shallow waists, two or three round droplets a little way off, '
             'a strong white line of light along its lower rim and two or three large pale-grey sheen patches toward '
             'its top, like a mirror laid on the sand. The closest of the three to the reference picture. Half pumped, '
             'the wet area draws in from the edge and the sheen fades; nearly dry, a small pool sits in a faint dark '
             'mark of where the puddle was.',
        pros=['Reads as a puddle of crude at once, at every size: one black shape with a bright lower edge.',
              'The calmest on a busy map; the sheen patches are what make it glossy, and they are big enough to survive a phone.',
              'The simplest to draw in the game: a shape, a rim and a few patches.'],
        cons=['The droplets are few, so a seep is mostly one blob; on a five-tile plus it still shows the plus a little.',
              'Its mirror look is the same on every seep; variety comes only from the shape.']),
    'b': dict(
        name='Spattered seep', short='B',
        lede='The same puddle with more character in its outline: more lobes, tighter pinched waists, and a trail of '
             'small puddles and droplets running off one side, as if it had been splashed. The sheen is in smaller '
             'spots and the rim light a touch thinner. Half pumped, its narrow waists pinch off and it breaks into '
             'two or three separate pools.',
        pros=['The most lively outline and the most like the sixth puddle of the reference, the spattered one.',
              'Breaking into separate pools as it is pumped tells the player it is running low without any number.',
              'Its trail of drops points away from the pump, so every seep looks a little different.'],
        cons=['The small drops are the first thing lost on a phone, where they become dark specks or noise on the sand.',
              'Busier next to buildings and robots; with the survey stakes on it, it is the most cluttered of the three.']),
    'c': dict(
        name='Still pool', short='C',
        lede='A fatter, rounder puddle with a wide soft sheen across its top like a reflected sky, one or two big drops, '
             'a softer and wider rim light, and a damp dark ring in the sand around it where the ground has soaked. '
             'As it is pumped the ring and the dark mark stay where the oil lay, so a nearly dry seep still reads as '
             'an oily place.',
        pros=['The most "seep" of the three: the soaked ring says the oil comes up out of the ground here, not that it was spilt.',
              'The dark mark of where it was makes a pumped-out seep easy to find again.',
              'Its big soft sheen keeps the gloss at phone size.'],
        cons=['The ring reads as a shadow or a hole at a glance, and on a phone it blurs the outline the owner liked.',
              'Fewer droplets and softer edges: the least crisp, the furthest from the flat, clean look of the reference.',
              'The ring would need a look of its own on snow (Hoarfell) and on the Hollow\'s floor.']),
}

PAGE = []
PAGE.append('''<title>Oil Seep Design Sheet</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&display=swap">
<style>/* The oil seep design sheet: one reading column, the art on its own plates; light and dark themes */
:root {
  --bg: #f1f0ee; --surface: #ffffff; --plate: #14161a; --fg: #1c1d20; --muted: #5f636b; --line: #d9d8d4;
  --accent: #8a4b12; --display: "Space Grotesk", "Segoe UI", system-ui, sans-serif; --body: Inter, "Segoe UI", system-ui, sans-serif;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #101215; --surface: #181b20; --plate: #08090b; --fg: #e9ebee; --muted: #a0a6ae; --line: #2a2e35; --accent: #e3a662; color-scheme: dark; } }
:root[data-theme="dark"] {
  --bg: #101215; --surface: #181b20; --plate: #08090b; --fg: #e9ebee; --muted: #a0a6ae; --line: #2a2e35; --accent: #e3a662; color-scheme: dark; }
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
figure.px .plate img { image-rendering: auto; }
figcaption { font-size: 13px; color: var(--muted); max-width: 62ch; }
.dn { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 380px), 1fr)); gap: 14px; align-items: start; }
.row { display: flex; flex-wrap: wrap; gap: 14px; align-items: start; }
.toc { display: flex; flex-wrap: wrap; gap: 10px 22px; font-weight: 600; }
.wide { display: grid; gap: 14px; justify-items: start; }
.pc { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr)); gap: 14px 28px; }
.pc h4 { margin: 0 0 6px; font: 600 13px var(--body); text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); }
.pc ul { margin: 0; padding-left: 20px; display: grid; gap: 6px; }
.callout { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 18px 20px; display: grid; gap: 10px; }
.questions ol { margin: 0; padding-left: 22px; display: grid; gap: 10px; max-width: 82ch; }
.notes p { color: var(--muted); font-size: 14px; }
table { border-collapse: collapse; font-size: 14px; }
.grid th, .grid td { text-align: left; padding: 7px 18px 7px 0; border-bottom: 1px solid var(--line); vertical-align: top; }
.grid thead th { font: 600 12px var(--body); text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }
.grid th.rowh { font: 600 14px var(--display); white-space: nowrap; }
.gridwrap { overflow-x: auto; }
</style>
<main>
<header class="top">
  <p class="eyebrow">Terrafall · Oil seep art for the owner to choose · November 2026</p>
  <h1>A new look for the oil seeps</h1>
  <p class="lede">The seep as a puddle of crude, after your reference picture: glossy, jet black, a soft wavy outline of lobes and pinched waists with no straight edges, a few round droplets and small puddles beside it, light-grey sheen patches inside, and a thin bright white light along its lower rim, as if lit from above and behind. Three directions, all that same kind of puddle, differing only in character. Pick one, or mix. Nothing is installed.</p>
  <p>Every picture is composed the way the game draws a map: the Rust's ground and plants, roads, the night grade, and today's art for the Oil Pump, the Refinery, the Depots, the vehicles and the survey stakes. The puddle is built from the seep's tiles the way today's seep is (a disc on each oil tile, bridged to its oil neighbours, so a seep is one shape across its tiles), then wobbled into lobes and shaded from its own shape: the white light runs wherever the edge faces the player, so any layout of tiles comes out right. A seep is usually a plus of five tiles on the maps (sometimes three or four), so that is what is shown.</p>
  <nav class="toc"><a href="#side">Side by side</a><a href="#dir-a">A · Fresh spill</a><a href="#dir-b">B · Spattered seep</a><a href="#dir-c">C · Still pool</a><a href="#pick">Recommendation</a><a href="#questions">Questions</a></nav>
</header>
''')

PAGE.append('<section id="side">\n  <p class="eyebrow">Side by side</p>\n  <h2>Today and the three directions</h2>\n  <div class="wide">')
PAGE.append(fig('side-day', 'today\'s seep and directions A, B and C by day', 'By day: today\'s seep (the oil-seep texture over a disc per tile, the survey stakes on it), then A, B and C on the same five-tile seep, full. 64 pixels a tile.'))
PAGE.append(fig('side-night', 'the same at night', 'At night: the rim light and the sheen left as a faint cool gleam, so a seep still reads as wet in the dark; no bright glow. The stakes\' lamps are today\'s.'))
PAGE.append('''  </div>
  <p>All three keep the reference's flat, clean look: a single black shape, the white line along the rim nearest the player, pale sheen patches inside, drops beside it. What differs is the outline's temper (A smooth, B spattered, C round), how many drops, how the sheen lies, and what is left behind as the seep is pumped dry.</p>
</section>
''')

for v, d in DIRS.items():
    PAGE.append(f'<section id="dir-{v}">\n  <p class="eyebrow">Direction {d["short"]}</p>\n  <h2>{d["name"]}</h2>\n  <p>{d["lede"]}</p>')
    PAGE.append('  <h3>Close up</h3>\n  <div class="dn">')
    PAGE.append(fig(f'card-{v}-day', f'{d["name"]} close up by day', 'By day, 96 pixels a tile (zoomed in): a full five-tile seep with the survey stakes on it, as the Rust shows it.'))
    PAGE.append(fig(f'card-{v}-night', f'{d["name"]} close up at night', 'At night: a faint gleam along the rim and in the sheen; the stake lamps.'))
    PAGE.append('  </div>\n  <h3>Full, half pumped, nearly dry</h3>\n  <p>The same seep with an Oil Pump on its middle tile: full, half pumped (the wet area smaller and darker, less sheen), and nearly dry. 64 pixels a tile.</p>\n  <div class="wide">')
    PAGE.append(fig(f'fill-{v}-day', f'{d["name"]} full, half pumped and nearly dry', 'By day.'))
    PAGE.append(fig(f'fill-{v}-night', f'{d["name"]} fill levels at night', 'At night, with the pump\'s light pool.'))
    PAGE.append('  </div>\n  <h3>In a colony</h3>\n  <p>At game scale on a desktop, 48 pixels a tile: a pumped seep (its pump on the middle tile, the seep four fifths full) beside a Refinery, a wild three-tile seep to the east, a road with its lamps, two Depots, a Tanker and a Freight Truck.</p>\n  <div class="dn">')
    PAGE.append(fig(f'colony-{v}-day', f'{d["name"]} in a colony by day', 'By day.'))
    PAGE.append(fig(f'colony-{v}-night', f'{d["name"]} in a colony at night', 'At night.'))
    PAGE.append('  </div>\n  <h3>On a phone</h3>\n  <p>The same colony at a phone\'s 28 pixels a tile, at its real size and doubled.</p>\n  <div class="row">')
    for tod in ('day', 'night'):
        PAGE.append(fig(f'phone-{v}-{tod}', f'{d["name"]} at phone size, {tod}', f'Real size, {tod}.', cls='px'))
    for tod in ('day', 'night'):
        f, (iw, ih) = webp(os.path.join(MD, f'phone-{v}-{tod}.png'), f'phone-{v}-{tod}')
        PAGE.append(f'<figure class="px"><div class="plate"><img src="{f}" width="{iw * 2}" height="{ih * 2}" alt="{d["name"]} at phone size, doubled, {tod}" loading="lazy"></div><figcaption>Doubled, {tod}.</figcaption></figure>')
    PAGE.append('  </div>\n  <div class="pc"><div><h4>For</h4><ul>' + ''.join(f'<li>{p}</li>' for p in d['pros']) + '</ul></div><div><h4>Against</h4><ul>' + ''.join(f'<li>{c}</li>' for c in d['cons']) + '</ul></div></div>\n</section>\n')

PAGE.append('''<section id="pick">
  <p class="eyebrow">Recommendation</p>
  <h2>A, the fresh spill, with a little of B's spatter on big seeps</h2>
  <div class="callout">
    <p>A is the one that matches the picture you sent: one clean black shape, a bright line on the rim nearest you, big pale sheen patches, a couple of drops. It reads the same at 96, 48 and 28 pixels a tile, by day and at night, and it is the quietest next to a pump and a refinery, which is where every seep ends up. It is also the simplest to draw: the game needs the shape, its rim and a few patches, nothing more.</p>
    <p>B's outline is the most alive, and its breaking into separate pools as it is pumped is a good tell; but its small drops are the first thing a phone loses, and with five survey stakes on it, it is the busiest. If you like it, the cheap mix is A's puddle with two or three more drops trailing off, only on seeps of four tiles or more. C's soaked ring says "seep" best, but it reads as a shadow at a glance and blurs the clean edge you asked for; its one idea worth keeping is the faint dark mark where a dry seep lay, which A has too, lighter.</p>
    <p>Whichever you pick, one choice makes most of the difference at phone size: take the survey stakes off the puddle's inner tiles and keep one on the seep (or none, with the Pathfinder's stake only until a pump is built). See question 3 and the picture below.</p>
  </div>
  <div class="wide">''')
PAGE.append(fig('nostakes-a-day', 'direction A without survey stakes', 'A with no survey stakes on it, 64 pixels a tile: the puddle alone, as the Hollow\'s seeps would show it (no stakes down there) and as the Rust\'s could with one stake instead of five.'))
PAGE.append('''  </div>
</section>

<section class="questions" id="questions">
  <p class="eyebrow">For you to decide</p>
  <h2>Open questions</h2>
  <ol>
    <li><b>Which direction</b>, or which mix: A's puddle with B's drops, C's dark mark, and so on. Say which.</li>
    <li><b>Any motion?</b> These are still. The brief mentioned bubbles; a puddle of crude could instead have a slow shimmer in its sheen, or a bubble that swells and pops now and then (a frame or two, drawn in code over the shape). Still is fine too; nothing else on the ground moves except Stalks' plumes.</li>
    <li><b>The survey stakes.</b> Today every oil tile carries the Pathfinder's survey stake (its lamp lit at night), so a five-tile seep has five stakes standing in the puddle. Keep them all, keep one per seep (the pump spot), or none? The stake's own little black puddle disappears into the big one either way.</li>
    <li><b>The Hollow's seeps.</b> Down there the seeps use the same art, with no stakes, on the dark cavern floor under violet Bloom light. A black puddle on a near-black floor lives by its rim light and sheen; they can be made a touch stronger there, and the night gleam could pick up the Bloom's violet rather than the sky's blue. Shall the Hollow get that variant?</li>
    <li><b>Droplets: part of the shape or separate decals?</b> Here they are placed from the seep's outline, just outside it. In the game they could be small images (two or three sizes) scattered round the seep in code, which lets a drop sit on a neighbouring tile that is not an oil tile. Fine, or should every drop stay inside the seep's own tiles?</li>
    <li><b>Pumping dry.</b> Today each tile's disc shrinks with its own amount; here the whole seep's wet area draws in from the edge together (B pinches into pools). A pump takes from its own tile first, so a seep with one pump should dry from the pump outward: wet area receding from the pump's tile, or from the edge as shown?</li>
    <li><b>Under a road or track.</b> Today an oil tile under a road shows as a dark ellipse stain. With a puddle, the road would cut through it; the puddle could simply stop at the road's kerb, with the stain on the road kept as it is. Fine?</li>
    <li><b>Other biomes.</b> The pictures are on the Rust's sand. The same puddle on Greenreach's grass, Hoarfell's snow, the Cinderlands' ash and Blackwater's mud will read differently (black on dark ash and mud is the hard one; C's ring on snow would look like a melt hole). Shall the next step show all five, or is the Rust enough to choose on?</li>
    <li><b>How the game would draw it.</b> The puddle is made from the seep's own tiles, so the game can bake one small image per seep when a map is made (seeps never move) and draw it like today's seep, in both the day picture and the night glow map, redrawing it only when its amount changes a step. That keeps the shape one piece across tiles and costs nothing per frame. Or the art could be a set of ready puddles chosen by tile layout; the baked one is the recommendation.</li>
  </ol>
</section>

<section class="notes">
  <p class="eyebrow">How it was made</p>
  <p>The puddles come from a small generator in the renderer (<code>renderer/terrain/oil_puddles.py</code>): for each seep it lays a disc on every oil tile (sized by the tile's fill, a little jittered), a lobe or two off each, and bridges between neighbours, wobbles the union with low-frequency noise into lobes and waists, scatters droplets just outside, and then shades the shape from itself: the distance to the edge and the way the edge faces give the white rim light on the lower edge, a faint grey line on the upper, pale sheen patches lying toward the top, and a dark damp stain under and around it. Pumping erodes the wet area inward. The scenes (<code>renderer/preview/oil_seep_mock.py</code>) compose the game's ground, plants, roads, buildings, vehicles and night grade round it, and today's seep is drawn there the way <code>drawSeep</code> draws it. Nothing in the game changed.</p>
</section>
</main>
''')

with open(os.path.join(OUT, 'index.html'), 'w') as fh:
    fh.write('\n'.join(PAGE))
shutil.copy(os.path.join(MD, 'contact.png'), os.path.join(OUT, 'contact.png'))
print('wrote', OUT)

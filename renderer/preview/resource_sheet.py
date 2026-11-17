"""The design sheet for the proposed Fiber and Oil resources: one HTML page with every image embedded, for the owner to
choose from, and the individual renders saved beside it (renders/).

    python3 preview/resource_sheet.py <sheetdir>      (run from renderer/, after preview/resource_mock.py)
"""
import base64
import io
import os
import shutil
import sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART = os.environ.get('TERRAFALL_ART', os.path.join(ROOT, '..', 'art'))
RES = os.path.join(ROOT, 'out', 'res')
PV = os.path.join(ROOT, 'out', 'preview', 'res')
OUT = sys.argv[1]
os.makedirs(os.path.join(OUT, 'renders'), exist_ok=True)


def wb(im, q):
    b = io.BytesIO(); im.save(b, 'WEBP', quality=q, method=6); return b.getvalue()


def img(path, q=86, alt=''):
    im = Image.open(path)
    im = im.convert('RGBA') if im.mode in ('RGBA', 'LA', 'P') else im.convert('RGB')
    return f'<img src="data:image/webp;base64,{base64.b64encode(wb(im, q)).decode()}" width="{im.width}" height="{im.height}" alt="{alt}">'


def size(p, q=85):
    im = Image.open(p); im = im.convert('RGBA') if im.mode in ('RGBA', 'LA', 'P') else im.convert('RGB')
    return len(wb(im, q))


kb = lambda n: f'{n / 1024:,.1f} KB'
BIOMES = [('desert', 'The Rust'), ('jungle', 'Greenreach'), ('polar', 'Hoarfell'), ('volcanic', 'Cinderlands'), ('swamp', 'Blackwater')]
FIBER = {
    0: ('Today: Stalks', 'The cluster of teal fungal stalks with glowing mint caps (<code>stalk</code>). Drawn smaller and a little faded while it regrows. At night it is graded dark like every resource, so its glow is lost.'),
    1: ('A · Reedcane', 'A tight clump of jointed canes, sage-teal with a dark band at every joint, narrow leaves, and mint plumes of seed floss on the tallest. The plumes glow faintly at night. It is a stalk you can see, upright where every scenery plant is low.'),
    2: ('B · Flaxfan', 'A rosette of long, stiff strap leaves in bright teal, each tip fraying into fine mint fibres, with two flower spikes when it is full. The fibre tips glow at night. It shows the fibre in the plant.'),
    3: ('C · Flosspod', 'A low woody shrub hung with husks that split open on balls of mint-white floss, like cotton. While it regrows the husks are shut and green; ripe, they open. The floss glows softly at night.'),
}
OIL = {
    0: ('Today: Oil seep', 'A dark glossy ellipse with a rainbow sheen on each oil tile, drawn in code (there is no art). Each tile is a separate puddle, so a seep doesn’t read as one place.'),
    1: ('A · Tar blister', 'The seep is one sheet of black tar with a wrinkled skin, warm brown where it is thin. On each oil tile the crude pushes up into a glossy blister, burst at the top, with a ripple round it: one blister, one Pump.'),
    2: ('B · Pitch well', 'The seep has dried to a crust of pitch broken into plates, glossy black oil in the cracks. On each oil tile the crust has broken into a ring of slabs round a black mouth where fresh oil wells up: a socket for the Pump’s footing.'),
    3: ('C · Survey stake', 'The ground is soaked dark, with glossy puddles, so each biome’s own ground shows through. On each oil tile stands the Pathfinder’s old survey stake, banded orange and white, its little amber lamp still blinking at night. The stake says where the Pump goes.'),
}

# ---------------------------------------------------------------------------------------------- the size budget
def fiber_cost(k):
    full = size(f'{RES}/fiber-{k}.png') + size(f'{RES}/fiber-{k}-glow.png')
    st = sum(size(f'{RES}/fiber-{k}-g{g}.png') + (size(f'{RES}/fiber-{k}-g{g}-glow.png') if os.path.exists(f'{RES}/fiber-{k}-g{g}-glow.png') else 0) for g in (0.25, 0.5, 0.75))
    return full, st


def oil_cost(k):
    n = size(f'{RES}/seep-{k}.png', 82) + size(f'{RES}/seep-{k}-glow.png', 80) + size(f'{RES}/vent-{k}.png')
    if os.path.exists(f'{RES}/vent-{k}-glow.png'): n += size(f'{RES}/vent-{k}-glow.png')
    return n


stalk_now = os.path.getsize(os.path.join(ART, 'resources', 'stalk.webp'))
page = os.path.getsize('/home/user/RoboticPlanet/dist/terrafall.html') if os.path.exists('/home/user/RoboticPlanet/dist/terrafall.html') else 16401869
LIMIT = 16 * 1024 * 1024
rows = f'<tr><td>Today’s Stalks</td><td>1 sprite</td><td class="num">{kb(stalk_now)}</td><td class="num">–</td><td class="num">{kb(stalk_now * 4 / 3)}</td></tr>'
for k in (1, 2, 3):
    f, s = fiber_cost(k)
    rows += f'<tr><td>Fiber {FIBER[k][0]}</td><td>sprite + glow; 3 growth stages</td><td class="num">{kb(f)}</td><td class="num">{kb(s)}</td><td class="num">{kb((f + s) * 4 / 3)}</td></tr>'
rows += '<tr><td>Today’s Oil seep</td><td>drawn in code</td><td class="num">0 KB</td><td class="num">–</td><td class="num">0 KB</td></tr>'
for k in (1, 2, 3):
    o = oil_cost(k)
    rows += f'<tr><td>Oil {OIL[k][0]}</td><td>seep texture + sheen, pump-spot sprite{" + lamp glow" if k == 3 else ""}</td><td class="num">{kb(o)}</td><td class="num">–</td><td class="num">{kb(o * 4 / 3)}</td></tr>'

# ---------------------------------------------------------------------------------------------- copy the renders beside the page
for d, files in {'sprites': [f for f in sorted(os.listdir(RES)) if f.endswith('.png') and '.beauty' not in f and '.glow.' not in f],
                 'scenes': [f for f in sorted(os.listdir(PV)) if f.endswith('.png')]}.items():
    os.makedirs(os.path.join(OUT, 'renders', d), exist_ok=True)
    src = RES if d == 'sprites' else PV
    for f in files:
        shutil.copyfile(os.path.join(src, f), os.path.join(OUT, 'renders', d, f))


def grid(res, names, tod):
    head = ''.join(f'<th>{n}</th>' for _, n in BIOMES)
    body = ''
    for k in (0, 1, 2, 3):
        cells = ''.join(f'<td><div class="plate">{img(f"{PV}/{res}-{k}-{b}-{tod}.png")}</div></td>' for b, _ in BIOMES)
        body += f'<tr><th class="rowh">{names[k][0]}</th>{cells}</tr>'
    return f'<div class="gridwrap"><table class="grid"><thead><tr><th></th>{head}</tr></thead><tbody>{body}</tbody></table></div>'


def fiber_cards():
    out = ''
    for k in (0, 1, 2, 3):
        t, d = FIBER[k]
        out += f'''<article class="card{' now' if k == 0 else ''}">
  <header><h3>{t}</h3></header><p>{d}</p>
  <figure><div class="plate">{img(f"{PV}/fiber-{k}-stages.png")}</div><figcaption>Regrowing, from a quarter grown to full, then full at night. Enlarged.</figcaption></figure>
  <div class="dn">
    <figure><div class="plate">{img(f"{PV}/fiber-{k}-big-day.png", 84)}</div><figcaption>A grove on the Rust, enlarged</figcaption></figure>
    <figure><div class="plate">{img(f"{PV}/fiber-{k}-big-night.png", 84)}</div><figcaption>The same at night</figcaption></figure>
  </div>
</article>'''
    return out


def oil_cards():
    out = ''
    for k in (0, 1, 2, 3):
        t, d = OIL[k]
        sp = '' if k == 0 else f'<figure class="sprite"><div class="plate light">{img(f"{RES}/vent-{k}.png")}</div><figcaption>The pump spot, one tile</figcaption></figure>'
        tx = '' if k == 0 else f'<figure class="sprite"><div class="plate">{img(f"{RES}/seep-{k}.png")}</div><figcaption>The seep’s texture, 2 × 2 tiles</figcaption></figure>'
        out += f'''<article class="card{' now' if k == 0 else ''}">
  <header><h3>{t}</h3></header><p>{d}</p>
  <div class="dn">
    <figure><div class="plate">{img(f"{PV}/oil-{k}-big-day.png", 84)}</div><figcaption>A seep on the Rust with a Pump built on it, enlarged</figcaption></figure>
    <figure><div class="plate">{img(f"{PV}/oil-{k}-big-night.png", 84)}</div><figcaption>The same at night</figcaption></figure>
  </div>
  {f'<div class="pair">{sp}{tx}</div>' if k else ''}
</article>'''
    return out


LINEUP = 'Ore, Crystal, Stone, today’s Stalks, Fiber A, B and C, the Oil A, B and C pump spots on their seep, then the biome’s six scenery plants'

html = f'''<meta charset="utf-8">
<title>Fiber and Oil Redesign</title>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap">
<style>
/* Layout: one reading column, wide plates of map art; light and dark themes, the art on its own dark plates */
:root {{
  --bg: #f3f1ec; --surface: #ffffff; --plate: #14120f; --fg: #201d18; --muted: #6a645a; --line: #ddd8ce;
  --teal: #11806a; --oil: #8a5a1c; --accent: #11806a;
  --display: "Space Grotesk", "Segoe UI", system-ui, sans-serif; --body: Inter, "Segoe UI", system-ui, sans-serif; --mono: "JetBrains Mono", ui-monospace, Menlo, monospace;
}}
@media (prefers-color-scheme: dark) {{ :root:not([data-theme="light"]) {{
  --bg: #12110f; --surface: #1b1a17; --plate: #0a0908; --fg: #ece8e0; --muted: #a39d92; --line: #2e2c27;
  --teal: #4fd6b0; --oil: #e0a860; --accent: #4fd6b0; color-scheme: dark; }} }}
:root[data-theme="dark"] {{
  --bg: #12110f; --surface: #1b1a17; --plate: #0a0908; --fg: #ece8e0; --muted: #a39d92; --line: #2e2c27;
  --teal: #4fd6b0; --oil: #e0a860; --accent: #4fd6b0; color-scheme: dark; }}
* {{ box-sizing: border-box; }}
body {{ background: var(--bg); color: var(--fg); font: 15px/1.6 var(--body); margin: 0;
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 32px 64px; }}
main {{ max-width: 1260px; margin: 0 auto; display: grid; gap: 56px; }}
h1, h2, h3 {{ font-family: var(--display); text-wrap: balance; margin: 0; letter-spacing: -0.01em; }}
h1 {{ font-size: clamp(30px, 5vw, 46px); line-height: 1.08; }}
h2 {{ font-size: 26px; }} h3 {{ font-size: 19px; }}
p {{ margin: 0; max-width: 70ch; }}
code {{ font: 0.86em var(--mono); color: var(--accent); }}
.eyebrow {{ font: 500 12px var(--mono); text-transform: uppercase; letter-spacing: 0.12em; color: var(--oil); }}
.eyebrow.fiber {{ color: var(--teal); }}
.lede {{ font-size: 17px; color: var(--muted); }}
header.top, section {{ display: grid; gap: 16px; min-width: 0; }}
.plate {{ background: var(--plate); border-radius: 6px; overflow: hidden; line-height: 0; width: fit-content; max-width: 100%; }}
.plate.light {{ background: #9a7350; }}
.plate img {{ display: block; max-width: 100%; height: auto; }}
figure {{ margin: 0; display: grid; gap: 6px; min-width: 0; align-content: start; }}
figcaption {{ font-size: 13px; color: var(--muted); }}
.cards {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 580px), 1fr)); gap: 20px; }}
.card {{ background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 18px; display: grid; gap: 12px; align-content: start; min-width: 0; }}
.card.now {{ border-style: dashed; }}
.dn {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 250px), 1fr)); gap: 10px; }}
.pair {{ display: flex; flex-wrap: wrap; gap: 14px; }}
.gridwrap {{ overflow-x: auto; }}
table {{ border-collapse: collapse; font-size: 14px; }}
.grid th {{ font: 500 12px var(--mono); text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); text-align: left; padding: 4px 8px 6px 0; white-space: nowrap; }}
.grid th.rowh {{ font: 600 14px var(--display); text-transform: none; letter-spacing: 0; color: var(--fg); padding-right: 12px; vertical-align: middle; }}
.grid td {{ padding: 0 6px 6px 0; }}
.budget th, .budget td {{ text-align: left; padding: 7px 14px 7px 0; border-bottom: 1px solid var(--line); vertical-align: top; }}
.budget th {{ font: 500 12px var(--mono); text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); }}
.budget td.num, .budget th.num {{ text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }}
.rec {{ background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 18px 20px; display: grid; gap: 10px; }}
ul.notes {{ margin: 0; padding-left: 20px; display: grid; gap: 7px; max-width: 80ch; }}
.twocol {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 480px), 1fr)); gap: 20px; align-items: start; }}
</style>

<main>
<header class="top">
  <p class="eyebrow">Terrafall · resource art for the owner to choose · November 2026</p>
  <h1>New looks for Fiber and Oil</h1>
  <p class="lede">Three directions for Fiber’s Stalk groves and three for the Oil seep, with today’s art beside them. Each is shown at game scale (48 pixels a tile) on five regions by day and at night, and enlarged. Nothing is installed.</p>
  <p>How the game draws them today: every resource is one tile across, centred on its tile. A Stalk is drawn smaller (and a little faded) while it regrows. At night resources are colour-graded with the ground, so nothing on them glows. An oil seep covers a few tiles and an Oil Pump is built right on one of them. Both resources appear in every region, Argos included, with the same art everywhere: no region reskins them. The Hollow’s Fiber is its Bloom veins, designed separately.</p>
</header>

<section>
  <p class="eyebrow fiber">Fiber</p>
  <h2>Stalk groves</h2>
  <p>Each new direction keeps Fiber’s teal, the colour the minimap and the Grower already use, so it still reads as Fiber, and gives the plant a shape no scenery plant has. Each one comes with a picture of every growth stage, so a regrowing grove looks young rather than shrunk. If you’d rather not add those files, the full image can be scaled down as it is today.</p>
  <div class="cards">{fiber_cards()}</div>
  <h3>On five regions, by day</h3>
  {grid('fiber', FIBER, 'day')}
  <h3>At night</h3>
  {grid('fiber', FIBER, 'night')}
  <p>At game scale, 6 × 4 tiles: a grove of eleven Stalks, some regrowing, among each region’s own scenery plants. At night the new ones glow where they’re drawn to (a glow image added over the graded sprite, as the Bloom’s and Cinderlands’ plants already do); today’s Stalks go dark.</p>
</section>

<section>
  <p class="eyebrow">Oil</p>
  <h2>Oil seeps</h2>
  <p>Each new direction splits the seep in two. The seep itself is one shape drawn across all its tiles (a disc on each oil tile, joined to its oil neighbours, filled with the seep’s texture), so the field reads as one place. Each oil tile then has a pump spot that shows where a Pump goes. When a Pump is built, its pad covers the spot. As a tile is pumped dry its disc and spot shrink, as today’s puddle does.</p>
  <div class="cards">{oil_cards()}</div>
  <h3>On five regions, by day</h3>
  {grid('oil', OIL, 'day')}
  <h3>At night</h3>
  {grid('oil', OIL, 'night')}
  <p>At game scale, 6 × 4 tiles: a seep of six tiles, three of them part-pumped, with a Pump on one. At night a faint cool sheen keeps the seep looking wet, and the survey stakes’ lamps blink.</p>
</section>

<section>
  <p class="eyebrow">Readability</p>
  <h2>Beside everything else on the map</h2>
  <p>At game scale, left to right: {LINEUP}. The top row is by day, the bottom at night.</p>
  <figure><div class="plate">{img(f"{PV}/lineup-jungle.png", 90)}</div><figcaption>Greenreach: the hardest case, with the most scenery plants (a third of open tiles)</figcaption></figure>
  <figure><div class="plate">{img(f"{PV}/lineup-desert.png", 90)}</div><figcaption>The Rust</figcaption></figure>
  <figure><div class="plate">{img(f"{PV}/lineup-polar.png", 90)}</div><figcaption>Hoarfell</figcaption></figure>
</section>

<section>
  <p class="eyebrow">Recommendation</p>
  <h2>What I’d pick</h2>
  <div class="twocol">
    <div class="rec">
      <h3>Fiber: A · Reedcane</h3>
      <p>Its upright canes are a silhouette nothing else on the map has: the scenery plants are rosettes, shrubs and trees, seen from above. It reads on every region, the growth stages read clearly (shoots, then canes, then plumes), and it is a stalk, so the name fits. Flosspod is the runner-up: its floss says “fibre” best, but white floss is weak on Hoarfell’s snow. Flaxfan comes closest to the ferns and rosettes on Greenreach and Blackwater.</p>
    </div>
    <div class="rec">
      <h3>Oil: C · Survey stake</h3>
      <p>The stake says “a Pump goes here” more plainly than any texture can. Its lamps make a seep readable at night, when every other seep goes black. And it tells a quiet story: the Pathfinder marked the seeps for colonists who never came. The tar blister (A) is the strongest oil look. Its sheet of black tar under C’s stakes is a good mix if you want the seep glossier; C’s soaked ground lets each region show through. The pitch well (B) is moody, but its spots get lost in the crust at game scale.</p>
    </div>
  </div>
</section>

<section>
  <p class="eyebrow">Install budget</p>
  <h2>What each direction adds</h2>
  <p>Resources appear in every region, so their art goes on the page itself, not in a region’s bundle. The one-file build is {page / 1024:,.0f} KB against a {LIMIT / 1024:,.0f} KB limit, which leaves {(LIMIT - page) / 1024:,.0f} KB of headroom. Resources are colour-graded for the time of day in code, so no morning, evening or night versions are needed. The glow images are what shows at night. Sizes are WebP, as the game ships its art; the page holds them as base64, a third larger.</p>
  <div class="gridwrap"><table class="budget">
    <thead><tr><th>Direction</th><th>Files</th><th class="num">Core</th><th class="num">Growth stages</th><th class="num">On the page</th></tr></thead>
    <tbody>{rows}</tbody>
  </table></div>
  <p>Each new direction needs a little code: glow images over resources at night (as the plants already have), and for Oil, the seep drawn as one shape across its tiles. Without the growth stages, a Fiber direction drops to its core size.</p>
</section>

<section>
  <p class="eyebrow">Lore</p>
  <h2>Fit, and where I had to interpret</h2>
  <ul class="notes">
    <li><b>Stalks.</b> The lore names Greenreach “prime Stalk country” and says no more about what they are. I kept them plants, apart from the Bloom (the Murmur’s violet), and kept Fiber’s teal so they never read as the Murmur’s growth. Reedcane takes the name literally.</li>
    <li><b>The glow.</b> Today’s Stalks were meant to glow, but resources are graded dark at night, so the glow never shows. The new ones glow only at the plumes, fibre tips or floss, a quiet light in keeping with “night carries the mood”, and dimmer than the colony’s roads.</li>
    <li><b>Survey stakes.</b> The lore has the Pathfinder lay neutral infrastructure before the vanguards came; marking the seeps is my extension of that. It follows the “objects over speeches” rule: a lamp still blinking for a survey nobody reads. The tag plate is blank, since the art carries no text.</li>
    <li><b>No rainbow.</b> The rainbow sheen is gone from every direction. The seeps are black, brown and glossy, so oil reads as crude, not as a colourful pickup, and stays apart from Crystal’s violet and Ore’s orange.</li>
    <li><b>One look for every region.</b> The code gives each resource one image everywhere, and I kept that. Only the survey stake’s soaked ground takes each region’s colour, because the ground shows through it.</li>
  </ul>
</section>

<section>
  <p class="eyebrow">Source</p>
  <h2>Where it comes from</h2>
  <p>Rendered from the scenes on the <code>resource-art</code> branch: <code>renderer/b/resources.js</code> (the six directions and their growth stages), <code>renderer/post/resource_post.py</code> (the day sprites and glow images), <code>renderer/terrain/oil_seeps.py</code> (the seep textures) and <code>renderer/preview/resource_mock.py</code> (these scenes). The individual renders are saved next to this page, in <code>renders/</code>.</p>
</section>
</main>
'''
with open(os.path.join(OUT, 'index.html'), 'w') as f:
    f.write(html)
print('sheet', round(os.path.getsize(os.path.join(OUT, 'index.html')) / 1024 / 1024, 2), 'MB')
for k in (1, 2, 3):
    print('fiber', k, fiber_cost(k), 'oil', k, oil_cost(k))
print('stalk now', stalk_now, 'page', page)

"""The design sheet for the Murmur's three new forms (the Leech, the Spitter, the Sapper): one HTML page, every image
embedded, for the owner to approve. Nothing is installed.

    python3 preview/forms_sheet.py <spritedir> <mockdir> <fxdir> <outdir>      (after murmur_moles renders, forms_mock.py)

Writes <outdir>/index.html, and copies the images it shows into <outdir>/renders.
"""
import base64
import io
import os
import shutil
import sys
from PIL import Image

SPR, MOCK, FXD, OUT = sys.argv[1:5]
REN = os.path.join(OUT, 'renders')
os.makedirs(REN, exist_ok=True)
SAND, NIGHT = (154, 115, 80), (17, 19, 30)


def uri(path, bg=None, size=None, q=90, lossless=False, anim=None):
    """an image as a data URI (WebP). bg: flatten on that colour; size: resize to (w, h); anim: list of frame paths"""
    if anim:
        frames = []
        for p in anim:
            im = Image.open(p).convert('RGBA')
            if bg:
                b = Image.new('RGBA', im.size, bg + (255,)); b.alpha_composite(im); im = b
            frames.append(im)
        buf = io.BytesIO(); frames[0].save(buf, 'WEBP', save_all=True, append_images=frames[1:], duration=110, loop=0, quality=q)
        name = os.path.basename(anim[0]).replace('-f0', '').replace('.png', '-walk.webp')
        open(os.path.join(REN, name), 'wb').write(buf.getvalue())
        return 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode(), frames[0].size
    im = Image.open(path).convert('RGBA')
    if size:
        im = im.resize(size, Image.LANCZOS)
    if bg:
        b = Image.new('RGBA', im.size, bg + (255,)); b.alpha_composite(im); im = b.convert('RGB')
    shutil.copy(path, os.path.join(REN, os.path.basename(path)))
    buf = io.BytesIO(); im.save(buf, 'WEBP', quality=q, lossless=lossless, method=6)
    return 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode(), im.size


def img(path, alt, bg=None, size=None, display=None, cls='plate', **kw):
    u, (w, h) = uri(path, bg, size, **kw)
    dw, dh = display or (w, h)
    return f'<div class="{cls}"><img src="{u}" width="{dw}" height="{dh}" alt="{alt}" loading="lazy"></div>'


def fig(inner, cap):
    return f'<figure>{inner}<figcaption>{cap}</figcaption></figure>'


S = lambda n: os.path.join(SPR, n + '.png')
M = lambda n: os.path.join(MOCK, n + '.png')


def sprite_row(names, tod, caps):
    bg = NIGHT if tod == 'night' else SAND
    cells = []
    for n, c in zip(names, caps):
        p = S(n + ('-n' if tod == 'night' else ''))
        cells.append(fig(img(p, c, bg=bg, display=(192, 192)), c))
    return '<div class="sprites">' + ''.join(cells) + '</div>'


def dn(day, night, cap_day, cap_night, alt):
    return ('<div class="dn">' + fig(img(M(day), alt), cap_day) + fig(img(M(night), alt), cap_night) + '</div>')


def walk(form, cname):
    frames = [S(f'{form}-walk')] + [S(f'{cname}-f{i}') for i in (1, 2, 3)]
    u, (w, h) = uri(None, SAND, anim=frames)
    return fig(f'<div class="plate"><img src="{u}" width="192" height="192" alt="walk cycle" loading="lazy"></div>', 'Walking: the four frames, looped (day)')


def hero(name, cap):
    return fig(img(S(name), cap, bg=(40, 38, 44) if name.endswith('-n') else (120, 112, 104), display=(384, 384)), cap)


CSS = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'forms_sheet.css')).read()

sizes = [('Scuttler', 5.8, 0.62, 'today'), ('Spitter', 6.8, None, 'new'), ('Leech', 7.6, None, 'new'), ('Sapper', 8.4, None, 'new'), ('Brute', 11.4, 0.82, 'today')]
rows = []
for n, w, t, k in sizes:
    t = t or 0.62 + (w - 5.8) * 0.2 / 5.6
    true = w / 5.8 * 0.62
    rows.append(f'<tr><th class="rowh">{n}{" <span class=tag>today</span>" if k == "today" else ""}</th><td>{w}</td><td>{t:.2f}</td><td>{t * 48:.0f} px</td><td>{t * 28:.0f} px</td><td>{true:.2f}</td></tr>')
size_table = ('<div class="gridwrap"><table class="grid"><thead><tr><th></th><th>Frame (world units)</th><th>Drawn (tiles)</th>'
              '<th>Desktop, 48 px a tile</th><th>Phone, 28 px a tile</th><th>True to the Scuttler</th></tr></thead><tbody>' + ''.join(rows) + '</tbody></table></div>')

html = f'''<!doctype html>
<meta charset="utf-8">
<title>Murmur Forms Sheet</title>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap">
<style>{CSS}</style>
<main>
<header class="top">
  <p class="eyebrow">Terrafall · Murmur art for the owner to approve · November 2026</p>
  <h1>Three new Murmur forms</h1>
  <p class="lede">The Leech, the Spitter and the Sapper, built to the art brief in the same mole style as the Scuttler and the Brute. Each is shown from above the way the game draws it, at play size beside those two, by day and at night, with its action. Then all five raid a walled colony at night. Nothing is installed.</p>
  <p>All three follow the brief: star-nosed mole and naked mole-rat bodies, near-black velvet fur dusted with Crystal grit, Crystal splitting through at the shoulders and spine and glowing when they're full of charge, spade hands that look a little too much like hands, no eyes, and the tendril star for a face. No shells, mandibles, extra legs, wings or slime. Each sprite faces east and turns with the creature, like today's two.</p>
</header>

<section>
  <p class="eyebrow">Scale</p>
  <h2>All five at play size</h2>
  <div class="dn">
    {fig(img(M('lineup-all-day'), 'the five forms by day'), 'By day. Left to right: Scuttler, Spitter, Leech, Sapper, Brute. 96 pixels a tile (twice the desktop game); the grid is one tile.')}
    {fig(img(M('lineup-all-night'), 'the five forms at night'), 'At night: the night sprites, with their Crystal lit')}
  </div>
  <p>The game draws the Scuttler 0.62 of a tile across and the Brute 0.82, though the Brute's model is twice the size: it shrinks the big ones so they fit the map. The new forms are placed on that line by the width of their frames, so they come out just bigger than a Scuttler. The last column shows what they'd be if drawn true to the Scuttler instead.</p>
  {size_table}
</section>

<section>
  <p class="eyebrow">Drains charge</p>
  <h2>The Leech</h2>
  <p>A fat, slow star-nosed mole, smaller than a Brute: a short barrel of a body with a swollen sac over its back where the charge it drinks is stored, geodes split through at the shoulders and along the spine, and the star on its face. To feed, it presses the star flat against the power and holds still. Hungry, the sac and geodes are dull lilac. As it drinks they brighten to a violet that burns at night, and the star flares open.</p>
  <div class="dn">
    {fig(img(M('lineup-leech-day'), 'Leech between Scuttler and Brute'), 'Between the Scuttler and the Brute, by day')}
    {fig(img(M('lineup-leech-night'), 'Leech at night'), 'At night')}
  </div>
  <h3>Feeding: hungry to full</h3>
  {sprite_row(['leech-hungry', 'leech-half', 'leech-full'], 'day', ['Just latched on: hungry', 'Half full', 'Full'])}
  {sprite_row(['leech-hungry', 'leech-half', 'leech-full'], 'night', ['Hungry, at night', 'Half full', 'Full: the sac burns'])}
  <div class="pair">{walk('leech', 'drainer')}{hero('hero-leech-feed-n', 'Presentation view (not in the game): feeding at night, the star pressed to a line')}</div>
  <h3>At a colony</h3>
  {dn('leech-day', 'leech-night', 'By day', 'At night', 'Leeches feeding at a Generator, a streetlamp and a Fuel Station')}
  <p>Left, just latched onto a Generator. Middle, at a streetlamp: at night the lamp goes out and the road's edge lights fade round it, the lore's "road lights going dark one by one". Right, full, at a Fuel Station. The soft violet light under each charged Murmur is a proposal: the game draws no light from the Murmur on the ground today.</p>
</section>

<section>
  <p class="eyebrow">Ranged</p>
  <h2>The Spitter</h2>
  <p>Mid-sized, between the Scuttler and the Leech. Its cheeks swell into two pouches where it grinds Crystal grit into shards. They're its magazine, and they glow as they load. It stops at range, rears its head and spits a volley of five crystal shards at a turret or a wall. The volley flies in a tight knot trailing grit, and at night charge jumps between the shards. Where it strikes, it bursts in a violet-white flash. Splinters fly back and to the sides, charge crawls over the struck face for a moment, and grit stays stuck there, glowing faintly.</p>
  <div class="dn">
    {fig(img(M('lineup-spitter-day'), 'Spitter between Scuttler and Brute'), 'Between the Scuttler and the Brute, by day')}
    {fig(img(M('lineup-spitter-night'), 'Spitter at night'), 'At night')}
  </div>
  <h3>The spit and the volley</h3>
  {sprite_row(['spitter-walk', 'spitter-spit', 'shards'], 'day', ['Walking, pouches loaded', 'Spitting', 'The volley in flight (its own sprite)'])}
  {sprite_row(['spitter-walk', 'spitter-spit', 'shards'], 'night', ['At night', 'Spitting', 'The volley: charge arcing between the shards'])}
  <div class="pair">{walk('spitter', 'spitter')}{hero('hero-spitter-spit', 'Presentation view (not in the game): the spit, by day')}{hero('hero-spitter-spit-n', 'And at night')}</div>
  <h3>The impact</h3>
  {fig(img(M('impact-day'), 'eight impact frames on a wall by day'), 'Eight frames on a wall\'s face, by day (the shards came from the left)')}
  {fig(img(M('impact-night'), 'eight impact frames at night'), 'At night')}
  {dn('spitter-day', 'spitter-night', 'At a wall, by day: spitting, the volley in flight, the hit, and grit left stuck higher up the wall from an earlier one', 'At night', 'a Spitter spitting at a wall')}
</section>

<section>
  <p class="eyebrow">Digs under walls</p>
  <h2>The Sapper</h2>
  <p>Long and low, with the biggest hands of the five: spades turned out like oars, the fingers caked with soil, and a row of geodes down its back. It doesn't fight a wall; it goes under it. It digs in nose first, throwing soil back over itself. Underground, only the ground shows where it is: a dome of soil heaving and splitting at the head of a fresh ridge, crystal chips turned up in the cracks, moving toward the wall. That's the tell the player can see coming. It comes up on the other side in a ring of broken earth.</p>
  <div class="dn">
    {fig(img(M('lineup-sapper-day'), 'Sapper between Scuttler and Brute'), 'Between the Scuttler and the Brute, by day')}
    {fig(img(M('lineup-sapper-night'), 'Sapper at night'), 'At night')}
  </div>
  <h3>Digging in, under, and up</h3>
  {sprite_row(['sapper-dig', 'sapper-heave', 'sapper-surface'], 'day', ['Digging in', 'Underground: the heave', 'Coming up'])}
  {sprite_row(['sapper-dig', 'sapper-heave', 'sapper-surface'], 'night', ['At night', 'The heave: chips of crystal in the cracks', 'Coming up'])}
  <div class="pair">{walk('sapper', 'sapper')}{hero('hero-sapper-dig', 'Presentation view (not in the game): digging in')}{hero('hero-sapper-heave-n', 'The heave at night')}{hero('hero-sapper-surface', 'Coming up')}</div>
  <h3>Under a wall</h3>
  {dn('sapper-day', 'sapper-night', 'By day. Left to right: digging in; its fresh ridge running for the wall, the heave at its head; up inside.', 'At night: the fresh ridge\'s veins pulse back toward the nest', 'a Sapper digging under a wall')}
  <p>The ridge behind it is the Murmur's tunnel ridge, drawn by the same code the game uses for the tunnels. It tapers to nothing where the digging is, and the heave sits on its end.</p>
</section>

<section>
  <p class="eyebrow">All five</p>
  <h2>A night raid</h2>
  {fig(img(M('raid-night-big'), 'a night raid on a walled colony', display=(1260, 770)), 'At night, 96 pixels a tile (twice the desktop game; open the image for full size).')}
  <p>From the west, out of two tunnel exits: Scuttlers rush the gate. A Leech drinks the lamp by the road, and the road's lights go dark round it. A Brute batters the wall. Two Spitters shoot from range: one volley flies over the wall at the north turret, and another bursts on the wall's face. A Sapper's ridge runs for the west wall, the heave at its head. Inside, another Sapper has come up through its ridge under the south wall with a Leech behind it, and a full Leech is drinking from the Generator.</p>
  <div class="dn">
    {fig(img(M('raid-night'), 'the raid at game scale'), 'At game scale: 48 pixels a tile, as on a desktop')}
    {fig(img(M('raid-day'), 'the same by day'), 'The same by day')}
  </div>
  {fig(img(M('raid-day-big'), 'the raid by day, enlarged', display=(1260, 770)), 'By day, 96 pixels a tile')}
</section>

<section>
  <p class="eyebrow">Phones</p>
  <h2>Readable on a phone?</h2>
  <p>A new game on a phone opens at about 28 pixels a tile, and the view never zooms out past 20 under a finger. Here the raid and the five forms are shown at true phone size (28 CSS pixels a tile, drawn at 2x so they're sharp on a phone's screen).</p>
  <div class="phone">
    {fig(img(M('phone-raid-night'), 'the raid at phone size', display=(504, 308)), 'The raid at phone size, at night')}
    {fig(img(M('phone-raid-day'), 'by day at phone size', display=(504, 308)), 'By day')}
  </div>
  <div class="phone">
    {fig(img(M('phone-five-night'), 'five forms at phone size', display=(174, 39)), 'Scuttler, Spitter, Leech, Sapper, Brute at night')}
    {fig(img(M('phone-five-day'), 'five forms at phone size by day', display=(174, 39)), 'By day')}
  </div>
  <p>At this size each sprite is 17 to 23 pixels across, and the bodies are smaller still. At night the Leech reads by its glowing sac and the Brute by its size. By day the four small ones are dark specks of nearly the same size, the Sapper only a little longer and thinner. The Spitter and the Scuttler are the closest: only the Spitter's pale pouches tell them apart. What does read on a phone is what they do: the volley and its flash, the heave at the end of a ridge, a lamp going dark.</p>
</section>

<section class="questions">
  <p class="eyebrow">For you to decide</p>
  <h2>Open questions</h2>
  <ol>
    <li><b>Sizes.</b> Placed on the line between the Scuttler and the Brute, the three come out only 0.04 to 0.09 of a tile bigger than a Scuttler (one to three pixels on a phone). Drawn true to the Scuttler they'd be 0.73 (Spitter), 0.81 (Leech) and 0.90 (Sapper), which is as big as the Brute is drawn or bigger. Keep the line, go true size, or something between?</li>
    <li><b>Phone readability.</b> The Spitter and the Scuttler are close at phone size. Options: draw the Spitter bigger, make its pouches brighter, or rely on its spit to show it.</li>
    <li><b>What the Leech drinks.</b> The brief says power lines, but the game has none. Shown here are Generators, Fuel Stations and streetlamps, the lamp and road lights going dark round it. Should it also latch onto bots while they charge?</li>
    <li><b>What the shards do.</b> Damage only, or do they short a turret for a moment (the arcs over the struck face suggest it)? Should the stuck grit fade in a few seconds, or stay while a wall is being worn down?</li>
    <li><b>Seeing the Sapper coming.</b> Should the heave and its ridge show everywhere, or only within sight of the colony (turrets, lamps)? Once it's through, does its ridge stay as a tunnel the others can use?</li>
    <li><b>Light from the Murmur.</b> The soft violet pools under charged Murmur at night are a proposal. The game doesn't draw them today.</li>
    <li><b>Animation.</b> Each has four walking frames like today's two. The feed, spit, dig, heave and surface poses are single held frames. Enough, or should some of them move (the star pulsing, the heave rising, soil flying)?</li>
  </ol>
</section>

<section class="notes">
  <p class="eyebrow">How it was made</p>
  <p>The creatures are the <code>murmur_moles.js</code> models (renderer, branch <code>murmur-forms</code>), rendered top-down at 512 and composed to 256, by day and with <code>tod=night</code>. New poses: <code>c=drainer&amp;pose=feed&amp;charge=0..1</code>, <code>c=spitter&amp;pose=spit&amp;shot=shards</code>, <code>c=spit-shards</code>, <code>c=sapper&amp;pose=dig</code> and <code>pose=heave</code>. The impact is <code>fx/spit_impact.py</code>. The scenes are drawn by <code>preview/forms_mock.py</code> the way the game draws a map: ground, ridges (<code>tunnels/ridges.js</code>), roads and lamps, the night grade, and today's walls, buildings, Scuttler and Brute art. Every render is in the <code>renders</code> folder beside this page.</p>
</section>
</main>
'''
open(os.path.join(OUT, 'index.html'), 'w').write(html)
print('wrote', os.path.join(OUT, 'index.html'), f'{len(html) / 1e6:.1f} MB')

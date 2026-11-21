"""The behemoth design sheet: one page for each of the three directions (the Harrow, the Maw, the Bearer) and an
overview, as HTML pages that render to PNG (tools: preview/shoot.js). Nothing is installed.

    python3 preview/behemoth_sheet.py <spritedir> <mockdir> <outdir>      (after murmur_behemoth.js renders and behemoth_mock.py)

Writes <outdir>/<page>.html for page in overview, harrow, maw, bearer (images referenced by absolute path).
"""
import os
import sys
from PIL import Image

SPR, MOCK, OUT = [os.path.abspath(a) for a in sys.argv[1:4]]
os.makedirs(OUT, exist_ok=True)
SAND, NIGHT = (154, 115, 80), (17, 19, 30)


def flat(path, bg, tag):
    """the sprite flattened on a background (sand by day, the night ground's dark at night), saved beside the page"""
    im = Image.open(path).convert('RGBA')
    b = Image.new('RGBA', im.size, bg + (255,)); b.alpha_composite(im)
    p = os.path.join(OUT, 'img', tag + '.png'); os.makedirs(os.path.dirname(p), exist_ok=True)
    b.convert('RGB').save(p)
    return p


def spr(name, tod):
    p = os.path.join(SPR, name + ('-n' if tod == 'night' else '') + '.png')
    return flat(p, NIGHT if tod == 'night' else SAND, name + '-' + tod)


def mock(name):
    return os.path.join(MOCK, name + '.png')


def fig(src, cap, cls=''):
    return f'<figure class="{cls}"><img src="file://{src}"><figcaption>{cap}</figcaption></figure>'


CSS = '''
* { box-sizing: border-box; }
body { margin: 0; background: #121016; color: #ebe7f0; font: 17px/1.5 Inter, "DejaVu Sans", sans-serif; }
main { width: 1500px; padding: 44px 48px 56px; display: grid; gap: 30px; }
h1, h2, h3 { font-family: "DejaVu Sans", sans-serif; margin: 0; letter-spacing: -0.01em; }
h1 { font-size: 46px; line-height: 1.05; } h2 { font-size: 26px; color: #d6c4ff; } h3 { font-size: 19px; color: #b99bff; margin-bottom: 6px; }
p { margin: 0; }
.eyebrow { font: 600 13px "DejaVu Sans Mono", monospace; letter-spacing: .12em; text-transform: uppercase; color: #b99bff; }
.lede { font-size: 21px; color: #cfc8da; max-width: 70ch; }
figure { margin: 0; display: grid; gap: 6px; align-content: start; }
figure img { width: 100%; display: block; border-radius: 6px; background: #09080c; }
figcaption { font-size: 14px; color: #a39cad; }
.row { display: grid; gap: 16px; }
.c2 { grid-template-columns: 1fr 1fr; } .c3 { grid-template-columns: repeat(3, 1fr); } .c4 { grid-template-columns: repeat(4, 1fr); }
.c21 { grid-template-columns: 2fr 1fr; } .c12 { grid-template-columns: 1fr 1.25fr; }
.card { background: #1b1820; border: 1px solid #2e2a35; border-radius: 10px; padding: 18px 22px; }
.card ul { margin: 6px 0 0; padding-left: 20px; } .card li { margin: 3px 0; }
table { border-collapse: collapse; width: 100%; font-size: 15.5px; }
td, th { text-align: left; padding: 6px 12px 6px 0; border-bottom: 1px solid #2e2a35; vertical-align: top; }
th { color: #a39cad; font-weight: 600; white-space: nowrap; }
.log { font: 15.5px/1.5 "DejaVu Sans Mono", monospace; color: #cfe8ff; background: #0b0d14; border-left: 3px solid #38d4ff; padding: 10px 14px; border-radius: 4px; }
.log + .log { margin-top: 8px; }
.tag { display: inline-block; font: 600 12px "DejaVu Sans Mono", monospace; padding: 2px 8px; border-radius: 4px; background: #2a2236; color: #d6c4ff; margin-right: 6px; }
.ok { background: #16302a; color: #9df0c8; } .open { background: #33281a; color: #f3cf8a; }
.rec { border-color: #7a5cd6; background: #1e1830; }
'''


def page(name, body):
    html = f'<!doctype html><meta charset="utf-8"><title>Behemoth sheet: {name}</title><style>{CSS}</style><main>{body}</main>'
    open(os.path.join(OUT, name + '.html'), 'w').write(html)


TRIGGERS = '''
<div class="card"><h3>When it appears</h3>
<table>
<tr><td><span class="tag ok">confirmed</span></td><td><b>The Hollow: the Deep's mound breaks.</b> When the mound is almost destroyed (proposed: under 25% of its armor, once per game), two burst out of it, one heading north and one south, one at each player's colony; on 3 to 4 player maps, one for each colony. The mound's raids stop while they're out.</td></tr>
<tr><td><span class="tag ok">confirmed</span></td><td><b>Late in both campaigns.</b> Main Campaign Act III (missions 11 to 15; the natural home is 14, <i>The Deep</i>, where the mound falls, and 15 as the last threat). Contingency: late in a run, or when the Murmur meter is high (CONTINGENCY.md: in level-3 territories, and on the Hollow assault).</td></tr>
<tr><td><span class="tag ok">confirmed</span></td><td><b>Long games on Active: a 50% chance, once per game.</b> Proposed point: at the dusk warning of <b>night 6</b> (the 6th Murmur night, about 70 minutes in: a day is 12 minutes), one roll from the game's seed (deterministic, the same on every device); on a hit it comes up on a seeded night from 6 to 8, through the exit of the nest that has grown most, at the colony with the most charge (<code>chargeWorth</code>), with an escort pack (the Murmur is never alone). At most one per game. Never on Quiet; never on Lunar or where no nest stands.</td></tr>
</table></div>'''


D = {
    'harrow': dict(
        letter='A', name='The Harrow', plural='Harrows', tagline='The walking siege mound',
        fantasy='A badger-mole the size of a hill, so old the Crystal it has eaten has grown over its back into armour. It walks straight at the colony and the ground breaks under it.',
        counters='the colony itself: its roads, track and pipes, and the defence lines built across them. Everything the Accord built is laid on the ground, and the Harrow breaks the ground.',
        look=['Brute build at hill size: a vast barrel chest and shoulder hump, low wedge head, near-black coarse velvet.',
              'A mantle of banded geode plate over the whole back, split down the spine where a ridge of crystal spires stands out; the core glows violet-white through seams in the plate; heavy rind plates on the neck, shoulders and flanks.',
              'Spade hands the size of a Hauler. Under the star, the jaws hang open on a throat lit violet-white.',
              'At night: the spine, the seams and the throat burn; a violet light pool about 8 tiles across goes with it. Its furrow is a heaved ridge with lit veins, drawn like the tunnels.'],
        poses=[('harrow-walk', 'Walking (the key pose)'), ('harrow-walk-f2', 'Walking, frame 3'), ('harrow-rear', 'Rearing: the wind-up'), ('harrow-slam', 'The slam: the ground breaking'), ('harrow-fall', 'Dying: rolled over, the light gone'), ('harrow-emerge', 'Coming up out of the ground (the mound)')],
        stats=[('Size', 'Frame 6 tiles; body about 4.5 × 3 tiles (a Command Base is 2)'),
               ('Hit points', '1,400 (a warbot 12, a Brute 24, a Bulwark 30)'),
               ('Hide', 'Small arms (warbots, Bulwarks, Skirmishers, Pulse Turrets, Minigun Nests, Bunkers) do a quarter. Heavy hits do full: Railgunner slugs, Howitzer and Mortar shells, Rocket salvos, Torch fire, bombs, Missiles'),
               ('Speed', 'Worker speed × 0.45 (slower than anything the colony has)'),
               ('Melee', 'A hand: 12 to a robot, 10 armor off a building, every 1.5 s. Walls and Gates in its way go in two blows'),
               ('<b>Slam</b> (signature)', 'Every 9 s, when 4 or more targets are within 3 tiles: rears (1.2 s, the tell), slams. Within 3 tiles: robots take 8 and are thrown and stunned for 3 s; buildings lose 25 armor (a Pulse Turret is gone, a Wall in two); roads, track, pipes and Walls are torn out'),
               ('<b>Furrow</b> (passive)', 'The tiles it walks over (3 wide) lose their road, track or pipe; its path is a heaved ridge (a Murmur tunnel, so exits can open on it)'),
               ('Regrowth', 'Regains 2 HP a second for each Generator, Fuel Station or charger it has wrecked in the last minute (it feeds as it goes)')],
        counter=['<b>A real army, in the open, in front of it.</b> About 20 warbots with 4 Bulwarks to soak the slams, 4 to 6 Railgunners and 2 to 3 Howitzers firing from beyond 3 tiles, Torches on its flanks: about 40 seconds of fire. Spread out: the slam punishes a tight blob.',
                 '<b>Hit it before it reaches the walls.</b> Howitzers and Rocket trucks have the range to start the fight early. Walls don\'t stop it; they only buy a few seconds, so build them deep, not tall.',
                 '<b>The big answers:</b> a Missile (60), a Vulcan Bomber sortie (40 a bomb), the Lance of Corvane (400), a nuke (it dies). The Sundering Ray\'s Quake stuns it for 6 s.',
                 'Never: a few turrets, or a squad of warbots; they don\'t scratch it.'],
        ai='The rival sees it coming (its furrow is visible): it masses every warbot it has on a rally flag ahead of the Harrow\'s path, outside 3 tiles, with Bulwarks in front (<code>aiBehemoth</code>, new), pulls its Haulers off the roads in its path, and rebuilds the torn road after it. A Warden adds Howitzers; a Salvager lets it pass and raids what it broke.',
        lore=['Seismic contact, surface. Mass exceeds the Command Base. Heading: here.',
              'Road segments 14 to 31: not reporting. Rebuilding to passenger standard.',
              'Tooltip: <i>"The roads were built for buses. It does not use them."</i>'],
        hero=[('hero-harrow-walk', 'Presentation view, by day (not in the game)'), ('hero-harrow-slam-n', 'The slam, at night')],
        siege='siege-harrow', siegecap='Through the west wall of a colony at night: its furrow across the land and the road behind it (desktop scale, 48 px a tile). Six warbots and three Bulwarks are not enough.'),
    'maw': dict(
        letter='B', name='The Maw', plural='Maws', tagline='The burrowing leviathan',
        fantasy='Never all above the ground. Only the heave of the soil gives it away, and then the ground in the middle of the colony falls in and something comes up through it.',
        counters='the colony\'s foundations: everything robots build stands where it was put. Walls, turret lines and distance mean nothing; the Maw comes up inside them, under the place with the most charge.',
        look=['A Sapper grown for a century: long, and only the front half ever above the ground.',
              'A skull under a wedge of banded geode rind with a crest of crystal along it; shoulders plated in rind; a ridge of spires down the spine behind the head.',
              'Two hands wider than a road gripping the rim of its crater; the jaws thrown wide under an enormous star on a throat lined with glowing crystal.',
              'Moving, it is a long dome of soil splitting at the head of a fresh ridge as wide as a road, the cracks lit violet from below. At night the crater and its cracks glow from the light down in the hole.'],
        poses=[('maw-up', 'Surfaced (the key pose)'), ('maw-heave', 'Moving, under the ground'), ('maw-erupt', 'Bursting up (signature; also out of the mound)'), ('maw-sink', 'Dying: its head down on the rim')],
        stats=[('Size', 'Frame 6 tiles; crater about 5 tiles across, head and hands 4'),
               ('Hit points', '1,100 (and nothing reaches it under the ground)'),
               ('Hide', 'As the Harrow: small arms a quarter, heavy hits full'),
               ('Speed', 'Under the ground, Worker speed × 0.7; surfaced it does not move'),
               ('<b>Cave-in</b> (signature)', 'It comes up under the place with the most charge within its reach. 15 s before: lamps flicker, a ring of cracks, "Seismic contact" for that colony. Within 3 tiles: buildings lose 60% of their full armor (a Command Base or Keep 30%), robots take 10 and are stunned 4 s, roads, track and Walls are gone'),
               ('Surfaced', '40 s at the crater: a hand sweep every 2 s (10 to every robot within 2.5 tiles), a bite for 15 armor on the nearest building; then it goes down and comes up somewhere else (at most 3 times a night)'),
               ('Its crater', 'Stays as a tunnel exit (armor 60 to collapse) until warbots fill it in')],
        counter=['<b>Be ready where the charge is.</b> It always goes for the richest spot: keep an army parked by your Generators and storage at night; Howitzers and Mortar Pits pre-aimed there.',
                 '<b>Kill it in its 40 seconds.</b> 20 warbots, 4 Railgunners and Torches round the crater; it can\'t chase, but the sweep punishes standing close.',
                 '<b>Spread the colony.</b> A cave-in on a dense block is a disaster; on a spread one it\'s a hole.',
                 '<b>The Sundering Ray</b> forces it up early, in the open, stunned 10 s (Strike the Deep). The Deep Core and Atmosphere Engine draw it (they are the richest spots).'],
        ai='The rival can\'t see it coming until the heave is within sight: it keeps an army at its richest building by night once a Maw is up (<code>aiBehemoth</code>), and when the cracks appear it pulls robots out of the 3-tile ring and then piles in for the 40 seconds. It rebuilds afterwards, spread a little wider.',
        lore=['Ground radar: one return, very large, rising. Recommend: be elsewhere.',
              'Settlement under the Smelter: 2.1 metres. The building was rated for ringfall.',
              'Tooltip: <i>"Everything we build stands where we put it. It has noticed."</i>'],
        hero=[('hero-maw-up', 'Presentation view, by day (not in the game)'), ('hero-maw-erupt-n', 'Bursting up, at night')],
        siege='siege-maw', siegecap='It came up inside the walls, between the Generator and the Smelter, where the charge was (48 px a tile).'),
    'bearer': dict(
        letter='C', name='The Bearer', plural='Bearers', tagline='The carrier',
        fantasy='The naked mole-rat\'s colony carried on one back: Scuttlers ride in glowing cells and are born as it goes, and wherever it stands the colony\'s lights go out as it draws the charge in.',
        counters='charge, at scale. The Leech cuts one building; the Bearer drains a whole district: chargers, Generators, turrets and the robots\' own batteries, and turns it into more Murmur.',
        look=['A vast swollen mole-rat, low and wide, short thick legs, a small heavy head and an enormous star.',
              'Its back and rump grown into a comb of geode cells cracked open, each lined with glowing crystal; Scuttlers curled in them.',
              'Charge sacs of stretched skin along both flanks, veined violet, brighter the more it has drawn.',
              'Drawing: threads of charge pulled in to it from every side; the lamps and building lights round it go dark; its light pool is the biggest of the three.'],
        poses=[('bearer-walk', 'Walking (the key pose)'), ('bearer-draw', 'The draw (signature)'), ('bearer-birth', 'Birth: Scuttlers climbing out'), ('bearer-fall', 'Dying: the sacs slack, the cells dark'), ('bearer-emerge', 'Coming up out of the ground (the mound)')],
        stats=[('Size', 'Frame 6 tiles; body about 4.5 × 3.5 tiles'),
               ('Hit points', '1,500'),
               ('Hide', 'Small arms a quarter. Arc Caster lightning <b>heals</b> it (it drinks it). Torch fire does half again (fur and brood)'),
               ('Speed', 'Worker speed × 0.4'),
               ('<b>Draw</b> (signature)', 'Within 7 tiles: every colony building is cut as a Leech cuts (no charging, no power, lamps out); Pulse Turrets, Bunkers and Disruptor Towers fire at half rate; robots in it lose charge 4 × as fast; the Bearer regains 3 HP a second while anything in it has charge'),
               ('<b>Brood</b>', 'While drawing, a Scuttler every 10 s from its cells (a Leech every third), at most 12 of its brood alive; 6 ride with it from the start'),
               ('Melee', 'A hand: 8 to a robot, 8 armor off a building, every 2 s (it fights by draining, not by hitting)')],
        counter=['<b>Fight it outside your power.</b> Meet it before its 7 tiles reach your Generators; in its field your turrets and robots starve.',
                 '<b>Kinetic, long range:</b> Railgunners (5 tiles) and Howitzers outrange the field; Torches burn the brood and do half again to it. Not Arc Casters.',
                 '<b>An army big enough for two fights:</b> 20+ warbots for the brood and the Bearer together; Bulwarks screen the Railgunners from Scuttlers.',
                 '<b>The big answers:</b> a Missile, a Bomber run, the Lance of Corvane, a nuke. Turning buildings off on their panel does nothing: it drinks what is stored.'],
        ai='The rival pulls its robots out of the 7 tiles while the brood is up (<code>aiBehemoth</code>), meets it with Railgunners and Howitzers from beyond the field, and builds no Arc Casters while one is out. An Architect turns its far Generators off and leans on Fuel stored at the core.',
        lore=['Charge draw across sector 4. Source: one. Lights out in a ring, centred on nothing we can see.',
              'Contacts multiplying inside the dark. Count unreliable.',
              'Tooltip: <i>"It carries them. The Lab would like to know who carried it."</i>'],
        hero=[('hero-bearer-walk', 'Presentation view, by day (not in the game)'), ('hero-bearer-draw-n', 'The draw, at night')],
        siege='siege-bearer', siegecap='Drawing at the edge of a colony at night: the lamps and buildings in its 7 tiles gone dark, its brood running at the wall (48 px a tile).'),
}


def direction(c):
    d = D[c]
    poses_day = ''.join(fig(spr(n, 'day'), cap) for n, cap in d['poses'])
    poses_night = ''.join(fig(spr(n, 'night'), cap + ', night') for n, cap in d['poses'])
    nc = len(d['poses'])
    stats = ''.join(f'<tr><th>{k}</th><td>{v}</td></tr>' for k, v in d['stats'])
    heroes = ''.join(fig(os.path.join(SPR, n + '.png'), cap) for n, cap in d['hero'] if os.path.exists(os.path.join(SPR, n + '.png')))
    body = f'''
<header class="row"><p class="eyebrow">Terrafall · the behemoth · design sheet · direction {d["letter"]} of 3 · nothing installed</p>
<h1>{d["name"]} <span style="color:#a39cad;font-weight:400">· {d["tagline"]}</span></h1>
<p class="lede">{d["fantasy"]}</p>
<p><span class="tag">counters</span>{d["counters"]}</p></header>
<section class="row"><h2>Scale: a squad of warbots, a Brute, a Command Base, {d["name"]}</h2>
<div class="row c2">{fig(mock(f"scale-{c}-day"), "By day, 48 px a tile (the desktop game); the grid is one tile")}{fig(mock(f"scale-{c}-night"), "At night: its light pool is about 8 tiles across")}</div></section>
<section class="row"><h2>Poses, straight down as the game draws it</h2>
<div class="row" style="grid-template-columns:repeat({nc},1fr)">{poses_day}</div>
<div class="row" style="grid-template-columns:repeat({nc},1fr)">{poses_night}</div></section>
<section class="row c2">{heroes}</section>
<section class="row c2">{fig(mock(d["siege"] + "-night"), d["siegecap"])}{fig(mock(d["siege"] + "-day"), "The same by day")}</section>
<section class="row" style="grid-template-columns:0.62fr 1fr 1fr">
<div class="row">{fig(mock(f"hollow-{c}"), "The Hollow (confirmed trigger): the Deep's mound almost down, two burst out of it and head for the colonies, north and south (36 px a tile)")}
<div class="card"><h3>In the colony's voice</h3>{"".join(f'<div class="log">{x}</div>' for x in d["lore"])}</div></div>
<div class="row">
<div class="card"><h3>The look</h3><ul>{"".join(f"<li>{x}</li>" for x in d["look"])}</ul></div>
<div class="card"><h3>What it takes to kill it</h3><ul>{"".join(f"<li>{x}</li>" for x in d["counter"])}</ul></div>
<div class="card"><h3>Rival AIs</h3><p>{d["ai"]}</p></div>
</div>
<div class="row">
<div class="card"><h3>Abilities (first guesses)</h3><table>{stats}</table></div>
{TRIGGERS}
</div></section>'''
    page(c, body)


def overview():
    cols = ''
    for c in ('harrow', 'maw', 'bearer'):
        d = D[c]
        key = d['poses'][0][0]
        sig = {'harrow': 'harrow-slam', 'maw': 'maw-erupt', 'bearer': 'bearer-draw'}[c]
        cols += f'''<div class="card {'rec' if c == 'harrow' else ''}"><p class="eyebrow">Direction {d["letter"]}{' · recommended' if c == 'harrow' else ''}</p>
<h2 style="font-size:30px;margin:4px 0 8px">{d["name"]}</h2><p style="color:#cfc8da;margin-bottom:10px">{d["tagline"]}. {d["fantasy"]}</p>
<div class="row c2">{fig(spr(key, "night"), "Key pose, night")}{fig(spr(sig, "night"), "Signature, night")}</div>
<div class="row c2" style="margin-top:10px">{fig(spr(key, "day"), "By day")}{fig(spr(sig, "day"), "By day")}</div>
<p style="margin-top:10px"><span class="tag">counters</span>{d["counters"]}</p></div>'''
    body = f'''
<header class="row"><p class="eyebrow">Terrafall · the behemoth · design sheet · for the owner to choose · nothing installed</p>
<h1>The behemoth: three directions</h1>
<p class="lede">The biggest Murmur form by far and the most powerful thing on the map: bigger than a Command Base, about 1,100 to 1,500 hit points with a hide that shrugs off small arms, so it takes a real army (20+ warbots with Bulwarks, Railgunners, Howitzers and Torches) or a Missile, a megastructure or a nuke. Never evil and never a villain: the deepest, oldest thing the war has woken, and like every Murmur, never alone.</p></header>
<section class="row c3">{cols}</section>
<section class="row">{fig(mock("scale-harrow-night"), "Scale (direction A shown): a squad of six warbots, a Brute, a Command Base, the Harrow. 48 px a tile, at night")}</section>
<section class="row c2">
{TRIGGERS}
<div class="card rec"><h3>Recommendation: A, the Harrow, with two borrowings</h3>
<ul><li><b>It is the clearest endgame fight.</b> You see it coming (its furrow, its light), it comes at you, and you need an army in front of it: exactly the owner's "takes a real army". It reads at a glance from the camera and on a phone (the biggest silhouette and the brightest spine).</li>
<li><b>It suits the confirmed triggers best.</b> Out of the Deep's mound it walks north and south to each colony, a march both players can see and prepare for; in Act III and Contingency it is a set piece; in a long Active game it gives the warning a 50% surprise needs.</li>
<li><b>Its counter is new:</b> no form attacks the roads and track the robots depend on; the furrow and the slam do.</li>
<li><b>Borrow from C:</b> Scuttlers riding in its spine crack, dropping off when it slams (it is never alone; no extra unit to manage).</li>
<li><b>Borrow from B:</b> its coming-up: the cave-in and crater when it leaves the mound or a nest.</li>
<li>The Maw is the most frightening but can feel unfair twice a game (unseen until it lands in your core); the Bearer is the richest mechanically but overlaps the Leech and is a slow, long fight.</li></ul></div></section>'''
    page('overview', body)


for c in D:
    direction(c)
overview()
print('wrote', OUT)

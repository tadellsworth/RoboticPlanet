"""Writes the installed Hollow set, tunnel exits, Fiber (Reedcane) and Oil (survey stake) art into the game's art folder
as WebP, from the renders tools/render_install.sh makes. Run from renderer/:  python3 tools/install_art.py [<game>/art]

The Hollow's pieces drawn with the ground (Bloom veins, the floating Crystal, the side chamber) are lit like the ground
(the day render) and graded with it at night; their light comes from the night render's glow pass, in a -glow image the
game adds at night. The standing pieces (pillars, the Deep's mound) are night renders, drawn as they are. Main-map art
(Fiber, Oil, tunnel exits) is kept small: the page that carries it is near its size limit.
"""
import os
import sys
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, '..', 'art')
OH, OR, OB = (os.path.join(ROOT, 'out', d) for d in ('hollow', 'res', os.path.join('art', 'biomes', 'hollow')))
written = []


def save(im, rel, q=82, size=None):
    p = os.path.join(ART, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    if size and im.size != size:
        im = im.resize(size, Image.LANCZOS)
    im.save(p, 'WEBP', quality=q, method=6)
    written.append((rel, os.path.getsize(p)))


def load(p):
    return np.asarray(Image.open(p).convert('RGBA')).astype(np.float32) / 255


def down(a, f):
    h, w = a.shape[0] // f, a.shape[1] // f
    return a[:h * f, :w * f].reshape(h, f, w, f, a.shape[2]).mean((1, 3))


def bloom(g, b1, b2):
    gl = g[..., :3] * g[..., 3:4]
    gi = Image.fromarray((np.clip(gl, 0, 1) * 255).astype(np.uint8))
    return np.clip(gl + 0.9 * np.asarray(gi.filter(ImageFilter.GaussianBlur(b1))).astype(np.float32) / 255
                   + 1.1 * np.asarray(gi.filter(ImageFilter.GaussianBlur(b2))).astype(np.float32) / 255, 0, 1)


def to_img(a):
    rgb = np.where(a[..., 3:4] > 1e-4, a[..., :3] / np.maximum(a[..., 3:4], 1e-4), 0)
    return Image.fromarray((np.concatenate([np.clip(rgb, 0, 1), np.clip(a[..., 3:4], 0, 1)], -1) * 255 + 0.5).astype(np.uint8), 'RGBA')


def lit_and_glow(name, rel, grel, b1, b2, gsize, glint=0.15, gk=1.0):
    """The day render as the sprite (a touch of its own glow for the glints) and the night render's glow as its light."""
    b, g = load(f'{OH}/{name}-day.beauty.png'), load(f'{OH}/{name}-day.glow.png')
    a = b[..., 3:4]
    prem = np.clip(b[..., :3] * a + bloom(g, b1, b2) * glint * a, 0, 1)
    save(to_img(down(np.concatenate([prem, a], -1), 2)), rel, 85)
    h = bloom(load(f'{OH}/{name}-night.glow.png'), b1, b2) * gk
    ga = np.clip(h.max(-1, keepdims=True), 0, 1)
    col = np.where(ga > 1e-4, h / np.maximum(ga, 1e-4), 0)
    save(to_img(np.concatenate([np.clip(col, 0, 1) * ga, ga], -1)), grel, 80, (gsize, gsize))


# ---- the Hollow: terrain, chasm, plants (lazy bundle)
for k in ('ground', 'ground-glow', 'water', 'water-glow', 'rock'):
    save(Image.open(f'{OB}/{k}.png').convert('RGB'), f'biomes/hollow/{k}.webp', 82)
for k in ('cliff', 'wall'):
    save(Image.open(f'{OB}/{k}.png').convert('RGB'), f'biomes/hollow/{k}.webp', 88)
for k in ('chasm', 'chasm-wall', 'chasm-wall-2', 'chasm-lip-n', 'chasm-lip-w', 'chasm-lip-e'):
    im = Image.open(f'{OB}/{k}-hollow.png')
    save(im.convert('RGBA') if 'lip' in k else im.convert('RGB'), f'canyon/{k}-hollow.webp', 85)
for k in range(1, 7):
    save(Image.open(f'{OB}/plant-{k}.png').convert('RGBA'), f'biomes/hollow/plant-{k}.webp', 85)
    save(Image.open(f'{OB}/plant-{k}-glow.png').convert('RGBA'), f'biomes/hollow/plant-{k}-glow.webp', 80)
# ---- the Hollow's pieces
lit_and_glow('veins', 'biomes/hollow/vein.webp', 'biomes/hollow/vein-glow.webp', 3.5, 11, 128)
lit_and_glow('floater', 'biomes/hollow/floater.webp', 'biomes/hollow/floater-glow.webp', 10.5, 33, 256, gk=0.55)
lit_and_glow('chamber', 'biomes/hollow/chamber.webp', 'biomes/hollow/chamber-glow.webp', 7, 22, 256)
for k in ('pillar-1', 'pillar-2', 'deep-mound'):
    save(Image.open(f'{OH}/{k}.png').convert('RGBA'), f'biomes/hollow/{k}.webp', 84)
save(Image.open(f'{OH}/breach-light.png').convert('RGBA'), 'biomes/hollow/breach-light.webp', 80)
save(Image.open(f'{OH}/breach-beam.png').convert('RGBA'), 'biomes/hollow/breach-beam.webp', 80)
# ---- tunnel exits (every map): the open one at every time of day, the caved-in one drawn with the ground
save(Image.open(f'{OH}/exit-open.png'), 'buildings/tunnel-exit.webp', 82)
for t in ('morning', 'evening', 'night'):
    save(Image.open(f'{OH}/exit-open-{t}.png'), f'tod/{t}/buildings/tunnel-exit.webp', 82)
save(Image.open(f'{OH}/exit-collapsed.png'), 'buildings/tunnel-exit-collapsed.webp', 82)
# ---- Fiber (Reedcane) and Oil (the survey stake and its seep), every map: small. (Both retired since: Fiber's Stalks
# are Lantern Cane drawn in code, js/reedcane.js, and an oil seep a puddle made in code, js/seep.js.)
save(Image.open(f'{OR}/fiber-1.png'), 'resources/stalk.webp', 80, (192, 192))
for n, g in ((1, '0.25'), (2, '0.5'), (3, '0.75')):
    save(Image.open(f'{OR}/fiber-1-g{g}.png'), f'resources/stalk-{n}.webp', 80, (192, 192))
save(Image.open(f'{OR}/fiber-1-glow.png'), 'resources/stalk-glow.webp', 75, (128, 128))
save(Image.open(f'{OR}/fiber-1-g0.75-glow.png'), 'resources/stalk-3-glow.webp', 75, (128, 128))
save(Image.open(f'{OR}/vent-3.png'), 'resources/oil.webp', 80, (192, 192))
save(Image.open(f'{OR}/vent-3-glow.png'), 'resources/oil-glow.webp', 75, (128, 128))
# (the soaked ground's see-through is smooth: sixteen steps of it, softened, halve the file)
sp = np.asarray(Image.open(f'{OR}/seep-3.png').convert('RGBA')).astype(np.float32)
al = np.asarray(Image.fromarray(sp[..., 3].astype(np.uint8)).filter(ImageFilter.GaussianBlur(1))).astype(np.float32)
sp[..., 3] = np.round(al / 255 * 15) / 15 * 255
save(Image.fromarray(sp.astype(np.uint8), 'RGBA'), 'resources/oil-seep.webp', 72)

tot = 0
for rel, n in written:
    tot += n
    print(f'{n / 1024:7.1f} KB  {rel}')
print(f'{tot / 1024:.1f} KB in {len(written)} files')

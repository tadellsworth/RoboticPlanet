# Fade out the tail of the detonation, write the frames, a 6x4 sprite sheet, a JSON descriptor and preview GIFs.
# usage: nukeblast_post.py <rawdir with blast-00..23.png> <outdir> [<128 px ground tile for the previews>]
import sys, os, json, numpy as np
from PIL import Image
src, out = os.path.abspath(sys.argv[1]), sys.argv[2]
GROUND = os.path.abspath(sys.argv[3]) if len(sys.argv) > 3 else None
os.makedirs(os.path.join(out, 'frames'), exist_ok=True); os.chdir(out)
N = 24
def sm(a, b, x): u = min(1, max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u)
frames = []
for k in range(N):
    t = (k / (N - 1)) ** 1.35
    a = np.asarray(Image.open(f'{src}/blast-{k:02d}.png')).astype(np.float32)
    fade = 1 - sm(0.68, 1.04, t)
    a[..., 3] *= fade
    im = Image.fromarray(np.clip(a + 0.5, 0, 255).astype(np.uint8), 'RGBA')
    if k < 4:   # the blinding flash: a wide soft halo over the first frames
        yy, xx = np.mgrid[0:512, 0:512]; d2 = ((xx - 256) ** 2 + (yy - 345) ** 2) / [150, 210, 260, 300][k] ** 2
        h = np.zeros((512, 512, 4), np.float32); h[..., :3] = (255, 247, 226); h[..., 3] = 255 * [0.92, 0.7, 0.42, 0.18][k] * np.exp(-d2 * 2.2)
        halo = Image.fromarray(h.astype(np.uint8), 'RGBA'); im = Image.alpha_composite(im, halo)
    im.save(f'frames/nuke-blast-{k:02d}.png'); frames.append(im)
sheet = Image.new('RGBA', (6 * 512, 4 * 512), (0, 0, 0, 0))
for k, im in enumerate(frames): sheet.paste(im, ((k % 6) * 512, (k // 6) * 512))
sheet.save('nuke-blast-sheet.png', optimize=True)
json.dump({'image': 'nuke-blast-sheet.png', 'frameWidth': 512, 'frameHeight': 512, 'columns': 6, 'rows': 4, 'frames': N, 'fps': 12,
           'loop': False, 'anchor': [0.5, 0.7], 'anchorNote': 'ground zero (the point that was hit) sits at this fraction of each frame',
           'shockwaveMaxRadius': 0.28, 'shockwaveNote': 'peak shockwave ring radius as a fraction of frame width (about 143 px at 512)',
           'peakFrame': 16}, open('nuke-blast.json', 'w'), indent=1)
# previews: on the sand ground, at 256 px; and a frame strip
if GROUND is None: print('ok', sheet.size, '(no ground tile given: previews skipped)'); sys.exit(0)
g = Image.open(GROUND).convert('RGBA')
bg = Image.new('RGBA', (512, 512))
for y in range(0, 512, 128):
    for x in range(0, 512, 128): bg.paste(g, (x, y))
gif = []
for im in frames + [frames[-1]] * 4:
    f = bg.copy(); f.alpha_composite(im); gif.append(f.resize((320, 320), Image.LANCZOS).convert('P', palette=Image.ADAPTIVE, colors=255))
gif[0].save('nuke-blast-preview.gif', save_all=True, append_images=gif[1:], duration=83, loop=0, disposal=2)
strip = Image.new('RGBA', (12 * 170 + 10, 2 * 170 + 10), (34, 34, 34, 255))
for k, im in enumerate(frames):
    f = bg.copy(); f.alpha_composite(im); strip.paste(f.resize((160, 160), Image.LANCZOS), (10 + (k % 12) * 170, 10 + (k // 12) * 170))
strip.save('nuke-blast-strip.png')
print('ok', sheet.size)

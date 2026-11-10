"""Generator + fuel tanker preview: by day the generator runs (fans, power bus, exhaust smoke) while a tanker drives in
along a concrete road and stops at the fill point; then the same at night with headlights and the lit generator."""
import os as _os
_ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))
ART = _os.environ.get('TERRAFALL_ART', _os.path.join(_ROOT, 'art'))   # shipped art in the game's layout: art/<group>/, art/tod/<time>/<group>/, art/tiles/ground.png
PREV = _os.path.join(_ROOT, 'out', 'preview', ''); _os.makedirs(PREV, exist_ok=True)
def tod_dir(tod, group): return f'{ART}/{group}/' if tod == 'day' else f'{ART}/tod/{tod}/{group}/'
import json, math, os, subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

W, H, FPS = 1280, 720, 12
TILE = 340
BS = 1.4 * TILE / 512                      # building: 512 canvas = 1.4 tiles
TS = 0.65 * TILE / 384                     # truck: 384 canvas drawn 0.65 tiles across (truck about 0.55 tiles long)
G = PREV + 'generator/'; _os.makedirs(G, exist_ok=True); AF = ART + '/effects/'
TOD = json.load(open(ART + '/tod/shared/time-of-day.json'))['times']
_gp = json.load(open(ART + '/buildings/generator-points.json'))   # the marks, in 512 px
geom = {'fill': [v / 512 for v in _gp['fill_px']], 'ex0': [v / 512 for v in _gp['exhaust_px'][0]], 'ex1': [v / 512 for v in _gp['exhaust_px'][1]]}
AX, AY = 470, 360                          # generator anchor on screen
GTL = (AX - 256 * BS, AY - 0.615 * 512 * BS)
P = lambda m: (GTL[0] + m[0] * 512 * BS, GTL[1] + m[1] * 512 * BS)
ROAD_Y = P(geom['fill'])[1] + 0.32 * TILE  # road centre line just in front of the fill point

def L(p): return Image.open(p).convert('RGBA')
def frames(p, fw, fh, cols, n):
    s = L(p); return [s.crop(((i % cols) * fw, (i // cols) * fh, (i % cols) * fw + fw, (i // cols) * fh + fh)) for i in range(n)]
SMOKE = frames(AF + 'fx-chimney-smoke.png', 128, 128, 4, 16)

def grade(im, tod):
    if tod == 'day': return im
    a = np.asarray(im).astype(np.float32) / 255; t = TOD[tod]
    a[..., :3] = np.clip(a[..., :3] * np.array(t['grade_multiply']) + np.array(t['grade_add']), 0, 1)
    return Image.fromarray((a * 255).astype(np.uint8), 'RGBA')

def ground(tod):
    g = L(ART + '/tiles/ground.png').resize((4 * TILE, 4 * TILE), Image.LANCZOS)
    bg = Image.new('RGBA', (W, H))
    for y in range(0, H, 4 * TILE):
        for x in range(0, W, 4 * TILE): bg.paste(g, (x, y))
    d = ImageDraw.Draw(bg)                  # concrete road band (game style: 12/32 of a tile + 2/32 kerbs)
    hb, hk = 6 / 32 * TILE, 8 / 32 * TILE
    d.rectangle((0, ROAD_Y - hk, W, ROAD_Y + hk), fill=(93, 99, 107, 255)); d.rectangle((0, ROAD_Y - hb, W, ROAD_Y + hb), fill=(185, 190, 197, 255))
    for x in range(0, W, TILE // 4): d.line((x, ROAD_Y - hb, x, ROAD_Y + hb), fill=(165, 170, 177, 255), width=2)
    return grade(bg, tod)

def additive(dst, src, x, y, k):
    d = np.asarray(dst).astype(np.float32); s = np.asarray(src).astype(np.float32) / 255
    h, w = s.shape[:2]; x0, y0 = max(0, x), max(0, y); x1, y1 = min(W, x + w), min(H, y + h)
    if x1 <= x0 or y1 <= y0: return dst
    ss = s[y0 - y:y1 - y, x0 - x:x1 - x]
    d[y0:y1, x0:x1, :3] = np.clip(d[y0:y1, x0:x1, :3] + ss[..., :3] * ss[..., 3:4] * 255 * k, 0, 255)
    return Image.fromarray(d.astype(np.uint8), 'RGBA')

def place(dst, im, x, y, s):
    im = im.resize((round(im.size[0] * s), round(im.size[1] * s)), Image.LANCZOS); dst.alpha_composite(im, (round(x), round(y)))

def segment(tod, n):
    gnd = ground(tod)
    bld = L(tod_dir(tod, 'buildings') + 'generator.png')
    work = [L(ART + f'/buildings/generator-work-{k}.png') for k in range(8)]
    tdir = tod_dir(tod, 'units')
    truck = [L(tdir + f'tanker@0-f{k}.png').rotate(180) for k in range(4)]
    brake = L(ART + '/units/tanker-brake.png').rotate(180)
    head = L(ART + '/tod/shared/truck-headlights.png').rotate(180)
    # tanker path: from off the right edge to a stop with its rear by the fill point, decelerating
    fillx = P(geom['fill'])[0]
    x_stop = fillx + 0.28 * TILE; x_start = W + 0.7 * TILE
    T_drive = int(n * 0.62)
    rng = np.random.default_rng(5); puffs = []
    out = []
    for i in range(n):
        im = gnd.copy()
        t = min(1.0, i / T_drive); e = 1 - (1 - t) ** 2.2
        tx = x_start + (x_stop - x_start) * e; moving = t < 1.0
        speed = (1 - t) ** 1.2
        # tanker (drawn before the building only if it is behind; here it is in front, so after)
        place(im, bld, GTL[0], GTL[1], BS)
        if tod == 'day':
            place(im, work[(i * 8 // FPS) % 8], GTL[0], GTL[1], BS)
        # exhaust smoke puffs
        if i % 5 == 0:
            for k in ('ex0', 'ex1'): puffs.append((i, k, rng.uniform(-2, 2), rng.uniform(0.9, 1.1)))
        for (s0, k, jx, sc) in puffs:
            fi = int((i - s0) * 8 / FPS * 1.0)
            if 0 <= fi < 16:
                x, y = P(geom[k]); sz = int(0.25 * 512 * BS * 0.9 * sc)
                fr = grade(SMOKE[fi], tod).resize((sz, sz), Image.LANCZOS); im.alpha_composite(fr, (int(x - sz / 2 + jx), int(y - sz)))
        fr = truck[int(i * 1.6 * speed) % 4 if moving else 0]
        sz = int(384 * TS); tl = (int(tx - sz / 2), int(ROAD_Y - sz / 2))
        # soft unit shadow
        us = TOD[tod]['unit_shadow']; sh = Image.new('L', (W, H), 0)
        ImageDraw.Draw(sh).rounded_rectangle((tx - 0.28 * TILE + us['dx_tiles'] * TILE, ROAD_Y - 0.12 * TILE + us['dy_tiles'] * TILE, tx + 0.28 * TILE + us['dx_tiles'] * TILE, ROAD_Y + 0.12 * TILE + us['dy_tiles'] * TILE), 8, fill=int(255 * us['alpha']))
        shl = Image.new('RGBA', (W, H), (0, 0, 0, 0)); shl.putalpha(sh.filter(ImageFilter.GaussianBlur(8 * us['blur_scale']))); im.alpha_composite(shl)
        if tod != 'day':
            hs = int(3 * 384 * TS); h2 = head.resize((hs, hs), Image.LANCZOS)
            im = additive(im, h2, int(tx - hs / 2), int(ROAD_Y - hs / 2), TOD[tod]['headlights'])
        im.alpha_composite(fr.resize((sz, sz), Image.LANCZOS), tl)
        if t > 0.8:                                                     # braking into the stop, lights stay on a moment after
            im.alpha_composite(brake.resize((sz, sz), Image.LANCZOS), tl)
        out.append(im.convert('RGB'))
    return out

if __name__ == '__main__':
    os.makedirs(G + 'prev', exist_ok=True)
    seq = segment('day', 72) + segment('night', 72)
    for i, f in enumerate(seq): f.save(G + f'prev/f{i:03d}.png')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(FPS), '-i', G + 'prev/f%03d.png', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18',
                    '-pix_fmt', 'yuv420p', PREV + 'generator-tanker-preview.mp4'], check=True)
    print(len(seq))

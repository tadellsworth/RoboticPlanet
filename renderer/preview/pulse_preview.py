"""Pulse Cannon preview: aim, charge, purple laser, hit. Day shots then a night shot. Writes MP4 + GIF."""
import os as _os
_ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))
ART = _os.environ.get('TERRAFALL_ART', _os.path.join(_ROOT, 'art'))   # shipped art in the game's layout: art/<group>/, art/tod/<time>/<group>/, art/tiles/ground.png
PREV = _os.path.join(_ROOT, 'out', 'preview', ''); _os.makedirs(PREV, exist_ok=True)
def tod_dir(tod, group): return f'{ART}/{group}/' if tod == 'day' else f'{ART}/tod/{tod}/{group}/'
import json, math, subprocess, os
import numpy as np
from PIL import Image, ImageFilter

FX = ART + '/effects/'; OUT = PREV + 'pulse/'; os.makedirs(OUT, exist_ok=True)
W, H = 1280, 720
TILE = 300                                    # preview px per map tile
BS = 1.4 * TILE / 512                         # building sprite scale (512 canvas = 1.4 tiles)
AX, AY = 330, 300                             # where the turret's anchor sits on screen
TL = (AX - 0.5 * 512 * BS, AY - 0.615 * 512 * BS)
MUZ = json.load(open(FX + 'pulse-muzzles.json'))['directions']
TOD = json.load(open(ART + '/tod/shared/time-of-day.json'))['times']

def L(p): return Image.open(p).convert('RGBA')
def frames(sheet, fw, fh, cols, n):
    return [sheet.crop(((i % cols) * fw, (i // cols) * fh, (i % cols) * fw + fw, (i // cols) * fh + fh)) for i in range(n)]

LASER = frames(L(FX + 'fx-pulse-laser.png'), 512, 64, 1, 6)
HIT = frames(L(FX + 'fx-pulse-hit.png'), 128, 128, 6, 6)
CHARGE = {k: frames(L(FX + f'turret-charge/turret-charge-{k}.png'), 512, 512, 4, 8) for k in range(16)}

def ground(tod):
    g = L(ART + '/tiles/ground.png').resize((4 * TILE, 4 * TILE), Image.LANCZOS)
    bg = Image.new('RGBA', (W, H))
    for y in range(0, H, 4 * TILE):
        for x in range(0, W, 4 * TILE): bg.paste(g, (x, y))
    if tod != 'day':
        a = np.asarray(bg).astype(np.float32) / 255; t = TOD[tod]
        a[..., :3] = np.clip(a[..., :3] * np.array(t['grade_multiply']) + np.array(t['grade_add']), 0, 1)
        bg = Image.fromarray((a * 255).astype(np.uint8), 'RGBA')
    return bg

def place(dst, im, x, y, s):
    im = im.resize((round(im.size[0] * s), round(im.size[1] * s)), Image.LANCZOS); dst.alpha_composite(im, (round(x), round(y)))

def affine(dst, src, ox, oy, px, py, ang, sx, sy):
    """draw src so that its pixel (ox,oy) lands on (px,py), rotated by ang (radians, screen), scaled sx, sy"""
    c, s = math.cos(ang), math.sin(ang)
    # output -> input: undo translate, rotate, scale
    a = c / sx; b = s / sx; d = -s / sy; e = c / sy
    cx = ox - (a * px + b * py); cy = oy - (d * px + e * py)
    layer = src.transform((W, H), Image.AFFINE, (a, b, cx, d, e, cy), resample=Image.BICUBIC)
    dst.alpha_composite(layer)

def robot(dst, img, x, y, face, flash=0.0, tod='day'):
    sh = Image.new('RGBA', (W, H)); sa = Image.new('L', (W, H), 0)
    from PIL import ImageDraw
    us = TOD[tod]['unit_shadow']; ImageDraw.Draw(sa).ellipse((x - 62 + us['dx_tiles'] * TILE, y - 46 + us['dy_tiles'] * TILE, x + 62 + us['dx_tiles'] * TILE, y + 46 + us['dy_tiles'] * TILE), fill=int(255 * us['alpha']))
    sh.putalpha(sa.filter(ImageFilter.GaussianBlur(10 * us['blur_scale']))); dst.alpha_composite(sh)
    im = img
    if flash > 0:
        a = np.asarray(im).astype(np.float32); a[..., :3] = a[..., :3] * (1 - flash) + np.array([220, 170, 255]) * flash; im = Image.fromarray(a.astype(np.uint8), 'RGBA')
    affine(dst, im, 128, 128, x, y, face, 0.62, 0.62)

def shot_frames(tod, k_from, k, dist, idle=6):
    art = tod_dir(tod, 'buildings')
    base = L(art + 'turret@0.png')
    headp = (lambda j: art + f'turret-head-{j}@0.png') if tod == 'day' else (lambda j: art + f'turret-16dir/turret-head-{j}@0.png')
    bot = L(tod_dir(tod, 'units') + 'warbot@1-f0.png')
    gnd = ground(tod)
    m = MUZ[str(k)]; ang = math.radians(m['barrel_angle_deg'])
    mid = np.array(TL) + np.array(m['mid']) * BS
    tgt = mid + np.array([math.cos(ang), math.sin(ang)]) * dist
    tips = [np.array(TL) + np.array(m[t]) * BS for t in ('tip0', 'tip1')]
    face = math.atan2(AY - tgt[1], AX - tgt[0])
    seq = []
    # turn from k_from to k, one 16th per 2 ticks
    steps = []
    j = k_from
    while j != k:
        d = (k - j) % 16; j = (j + (1 if d <= 8 else -1)) % 16; steps += [j, j]
    timeline = [(k_from, None, None, None, 0)] * idle + [(j, None, None, None, 0) for j in steps]
    for f in range(7): timeline += [(k, f, None, None, 0)] * 3
    laser_d = [1, 2, 2, 1, 1, 1]; li = 0
    for lf, dur in enumerate(laser_d):
        for _ in range(dur):
            timeline.append((k, 7 if li < 3 else None, lf, min(li, 5), max(0, 0.6 - 0.15 * li))); li += 1
    timeline += [(k, None, None, None, 0)] * 8
    for (hk, cf, lf, hf, flash) in timeline:
        fr = gnd.copy()
        robot(fr, bot, tgt[0], tgt[1], face, flash, tod)
        place(fr, base, TL[0], TL[1], BS)
        place(fr, L(headp(hk)), TL[0], TL[1], BS)
        if cf is not None: place(fr, CHARGE[hk][cf], TL[0], TL[1], BS)
        if lf is not None:
            for tp in tips:
                v = tgt - tp; ln = np.linalg.norm(v)
                affine(fr, LASER[lf], 0, 32, tp[0], tp[1], math.atan2(v[1], v[0]), ln / 512, 0.6)
        if hf is not None: place(fr, HIT[hf], tgt[0] - 96, tgt[1] - 96, 1.5)
        seq.append(fr.convert('RGB'))
    return seq

if __name__ == '__main__':
    seq = []
    seq += shot_frames('day', 2, 2, 380)
    seq += shot_frames('day', 2, 0, 640, idle=2)
    seq += shot_frames('night', 0, 1, 560, idle=8)
    for i, f in enumerate(seq): f.save(f'{OUT}f{i:04d}.png')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', '20', '-i', f'{OUT}f%04d.png', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18',
                    '-pix_fmt', 'yuv420p', PREV + 'pulse-cannon-preview.mp4'], check=True)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', '20', '-i', f'{OUT}f%04d.png', '-vf',
                    'scale=720:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=200[p];[b][p]paletteuse=dither=sierra2_4a', PREV + 'pulse-cannon-preview.gif'], check=True)
    print(len(seq), 'frames')

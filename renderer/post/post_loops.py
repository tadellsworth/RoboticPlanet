"""Embers for smelter-work, then a preview of the working buildings with their emitters, the way the game will run them."""
import os as _os, sys as _sys
_HERE = _os.path.dirname(_os.path.abspath(__file__)); _ROOT = _os.path.dirname(_HERE)
import sys, json, math, os
import numpy as np
from PIL import Image
sys.path.insert(0, _os.path.join(_ROOT, 'fx'))
from fxlib import Canvas

# usage: post_loops.py embers <rawdir>          adds the embers to smelter-work-0..7.png in <rawdir>
#        post_loops.py preview <rawdir> <artdir>  preview video; <artdir> = shipped art (effects/, buildings/building-emitters.json)
D = _os.path.join(sys.argv[2], '')
_ART = sys.argv[3] if len(sys.argv) > 3 else _os.path.join(_ROOT, 'art')
FX = _os.path.join(_ART, 'effects', ''); E = json.load(open(_os.path.join(_ART, 'buildings', 'building-emitters.json'))) if 'preview' in sys.argv else {}
_PREV = _os.path.join(_ROOT, 'out', 'preview', '')

def embers():
    rng = np.random.default_rng(12)
    em = [(rng.uniform(0, 1), rng.uniform(-1, 1), rng.uniform(0.7, 1.2)) for _ in range(12)]
    for f in range(8):
        g = json.load(open(f'{D}smelter-work-{f}.geom.json'))['marks']
        m = np.array(g['mouth']) * 512; out = np.array(g['mouthOut']) * 512 - m
        cv = Canvas(512, 512, 2)
        for ph, side, k in em:
            for tr in (0.0, 0.07):                                   # head and a short trail
                t = (ph + f / 8) % 1.0 - tr
                if t < 0.02: continue
                p = m + out * 0.9 * t + np.array([side * 26 * t, -(46 * t - 22 * t * t) * k])
                if tr == 0.0: head = p
                else: cv.streak(p[0], p[1], head[0], head[1], 1.1, (1.0, 0.62 + 0.3 * (1 - t), 0.2), alpha=(1 - t) ** 1.3, glowk=0.9)
        img = Image.fromarray(cv.finish(bloom=(2, 6), bloomk=(0.6, 0.3)), 'RGBA')
        base = Image.open(f'{D}smelter-work-{f}.png'); base.alpha_composite(img); base.save(f'{D}smelter-work-{f}.png')

def frames_of(path, fw, fh, cols, n):
    s = Image.open(path).convert('RGBA'); return [s.crop(((i % cols) * fw, (i // cols) * fh, (i % cols) * fw + fw, (i // cols) * fh + fh)) for i in range(n)]

def preview():
    SM = frames_of(FX + 'fx-chimney-smoke.png', 128, 128, 4, 16); ST = frames_of(FX + 'fx-steam.png', 128, 128, 4, 12)
    BK = frames_of(FX + 'fx-black-smoke.png', 128, 128, 4, 16); FL = frames_of(FX + 'fx-flare.png', 128, 256, 8, 8)
    SHEETS = {'smoke': (SM, 4), 'steam': (ST, 3), 'black': (BK, 4)}
    cells = [('smelter', _ART + '/buildings/smelter.png', 'smelter-work'), ('refinery', _ART + '/buildings/refinery.png', 'refinery-work'), ('pump', D + 'pump-base.png', 'pump-work'),
             ('reactor', _ART + '/buildings/nuclear-reactor.png', None), ('tarworks', _ART + '/buildings/asphalt-plant.png', None),
             ('fab', _ART + '/buildings/fab.png', None)]
    CW, CH, OY = 400, 470, 90                                       # cell, with room above for the smoke
    S = CW / 512
    N = 48; rng = np.random.default_rng(3)
    spawns = {}                                                      # (cell, emitter idx) -> list of (start frame, jitter, scale)
    out = []
    for f in range(N):
        canvas = Image.new('RGBA', (3 * CW, 2 * CH), (166, 117, 74, 255))
        for ci, (name, bp, loop) in enumerate(cells):
            cell = Image.new('RGBA', (CW, CH), (0, 0, 0, 0))
            b = Image.open(bp).convert('RGBA').resize((CW, CW), Image.LANCZOS); cell.alpha_composite(b, (0, OY))
            if loop: cell.alpha_composite(Image.open(f'{D}{loop}-{f % 8}.png').resize((CW, CW), Image.LANCZOS), (0, OY))
            key = {'pump': None}.get(name, name)
            for ei, e in enumerate(E.get(key, []) if key else []):
                x, y = e['px'][0] * S, e['px'][1] * S + OY
                if e['kind'] == 'flame':
                    fr = FL[f % 8]; w = int(0.085 * CW * e['size']); h = 2 * w
                    cell.alpha_composite(fr.resize((w, h), Image.LANCZOS), (int(x - w / 2), int(y - h)))
                if e['kind'] not in SHEETS: continue
                seq, every = SHEETS[e['kind']]
                lst = spawns.setdefault((ci, ei), [])
                if f % every == 0: lst.append((f, rng.uniform(-3, 3), rng.uniform(0.85, 1.15)))
                for (s0, jx, sc) in lst:
                    k = f - s0
                    if 0 <= k < len(seq):
                        sz = int(128 * 0.25 * e['size'] * sc * CW / 128 * 1.0)
                        fr = seq[k].resize((sz, sz), Image.LANCZOS)
                        cell.alpha_composite(fr, (int(x - sz / 2 + jx), int(y - sz)))
            canvas.alpha_composite(cell, ((ci % 3) * CW, (ci // 3) * CH))
        out.append(canvas.convert('RGB'))
    # pre-roll so the first frame already has smoke: start the loop at frame 16
    out = out[16:] + out[16:32]
    os.makedirs(_PREV + 'loops', exist_ok=True)
    for i, im in enumerate(out): im.save(f'{_PREV}loops/f{i:03d}.png')
    import subprocess
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', '8', '-i', _PREV + 'loops/f%03d.png', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p',
                    '-vf', 'loop=2:size=48', _PREV + 'buildings-working-preview.mp4'], check=True)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', '8', '-i', _PREV + 'loops/f%03d.png', '-vf',
                    'scale=900:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=220[p];[b][p]paletteuse=dither=sierra2_4a', _PREV + 'buildings-working-preview.gif'], check=True)

if __name__ == '__main__':
    if 'embers' in sys.argv: embers()
    if 'preview' in sys.argv: preview()
    print('ok')

"""Tropical coral sand, reef water and vegetation under the usual upper-left light.

Run: python renderer/terrain/terrain_tropical.py art/biomes/tropical
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

from plants_common import ENVS, Scene, add_leaf, add_tube, arc_spine, oriented_blob, render
from plants_jungle import p1_fern, p2_leafrosette
from terrain_biomes import crag_height, over
from tex import TAU, fbm, hexrgb, mix, normals_from_height, relief, smoothstep

N = 512
ENVS['tropical'] = dict(
    sun=np.array([1.02, 0.98, 0.89]), sky=np.array([0.29, 0.40, 0.49]),
    bounce=np.array([0.26, 0.27, 0.16]), shadow='#26382c', shadow_op=0.46, snow='#ffffff')


def ground():
    dune = fbm(N, 381, 2, 22, 1.9)
    fine = fbm(N, 382, 42, 245, 0.84)
    ripple = fbm(N, 383, 13, 70, 1.4, aniso=(0.45, 2.7), angle=0.32)
    color = mix(hexrgb('#b6a477'), hexrgb('#e2d5b3'), smoothstep(-1.9, 1.5, dune + fine * 0.17))
    scrub = smoothstep(0.55, 1.75, fbm(N, 384, 4, 39, 2.2) + fine * 0.28)
    color = over(color, hexrgb('#8e9861'), scrub * 0.62)
    color = over(color, hexrgb('#faf0d5'), smoothstep(1.2, 2.6, fine) * 0.31)
    normal = normals_from_height(dune + 0.75 * ripple + fine * 0.46)
    return color * (0.78 + 0.25 * relief(normal, 225, 48))[..., None]


def water():
    floor = fbm(N, 391, 2, 14, 2.2)
    fine = fbm(N, 392, 5, 72, 1.25)
    reef = smoothstep(0.22, 1.55, floor + fine * 0.37)
    color = mix(hexrgb('#155979'), hexrgb('#1da6a9'), smoothstep(-1.65, 1.45, floor))
    color = over(color, hexrgb('#83b68e'), reef * 0.55)
    color = over(color, hexrgb('#416f69'), smoothstep(0.2, 1.45, fine) * reef * 0.45)
    flow = fbm(N, 393, 6, 50, 1.4, aniso=(0.65, 1.85), angle=0.36)
    veins = 1 - smoothstep(0.05, 0.27, np.abs(flow + fine * 0.26))
    return over(color, hexrgb('#a7efe2'), veins * (0.075 + reef * 0.21))


def rock():
    h, _, _ = crag_height(401, n_blocks=40, amp=16)
    grain = fbm(N, 402, 7, 95, 1.48)
    color = mix(hexrgb('#827967'), hexrgb('#bbb295'), smoothstep(-1.4, 1.9, grain))
    color = over(color, hexrgb('#70825a'), smoothstep(0.2, 1.5, fbm(N, 403, 2, 25, 1.8)) * 0.38)
    return color * (0.58 + 0.52 * relief(normals_from_height(h), 225, 48))[..., None]


def cliff():
    y, x = np.mgrid[0:48, 0:128]
    layers = np.sin((y + 1.6 * np.sin(x * TAU / 64) + 0.7 * np.sin(x * TAU / 16)) * 1.32)
    grain = fbm(128, 411, 4, 80, 1.35, ny=48)
    c = mix(hexrgb('#847661'), hexrgb('#bfae8b'), smoothstep(-1.5, 1.55, grain + 0.47 * layers))
    return c * (1.02 - y * 0.011)[..., None]


def palm(scene, rng, x, y, height, length, lean):
    t = np.linspace(0, 1, 11)
    trunk = np.stack((x + lean[0] * t ** 1.8, y + lean[1] * t ** 1.8, height * t), axis=-1)
    add_tube(scene, trunk, 3.0, 2.1, nseg=9, col='#837458', col_tip='#b9a57f', mat=3)
    crown = trunk[-1]
    for k in range(3):
        a = k * TAU / 3
        oriented_blob(scene, crown + np.array([3.1 * np.cos(a), 3.1 * np.sin(a), -2.4]), (2.7, 2.6, 3.3),
                      nu=5, nv=8, col='#746a3b', mat=3)
    heading = rng.uniform(0, TAU)
    for k in range(11):
        angle = heading + k * TAU / 11 + rng.uniform(-0.14, 0.14)
        long = length * rng.uniform(0.83, 1.15)
        spine, angles = arc_spine(crown, angle, long, 0.55, -0.73, n=11, yaw1=angle + rng.uniform(-0.34, 0.34))
        leaf = ['#567c36', '#678e3e', '#3d6632', '#7c9d4a'][k % 4]
        add_tube(scene, spine, 0.62, 0.15, nseg=4, col='#9aa051', mat=1)
        for j, (origin, facing) in enumerate(zip(spine[1:], angles[1:]), 1):
            size = long * (0.25 * np.sin(np.pi * j / 12) + 0.055)
            for side in [-1, 1]:
                add_leaf(scene, origin, facing + side * 0.91, size, size * 0.127, -0.02, -0.51, shape='lance',
                         n=4, ncross=3, fold=0.15, col=leaf, col_tip='#a3aa60', mat=1, trans=0.38)


def coral_rubble(rng):
    scene = Scene()
    for k in range(12):
        a, r = rng.uniform(0, TAU), rng.uniform(3, 26)
        l = rng.uniform(2.5, 8)
        oriented_blob(scene, (r * np.cos(a), r * np.sin(a), l * 0.27), (l, l * 0.65, l * 0.67), yaw=a,
                      nu=7, nv=9, col=['#ccb98b', '#b19f79', '#ded6ad'][k % 3], mat=3)
    return scene


def flowers(rng):
    scene = Scene()
    for k in range(27):
        a = rng.uniform(0, TAU)
        add_leaf(scene, (0, 0, 3), a, rng.uniform(14, 32), rng.uniform(2.5, 4.5),
                 rng.uniform(0.3, 1.1), -0.46, shape='lance', n=6, col='#527743', col_tip='#85a553')
    for x, y, z in [(-8, -7, 16), (3, 4, 21), (11, 0, 17), (-2, 9, 15)]:
        add_tube(scene, np.array([[0, 0, 1], [x * 0.5, y * 0.5, z * 0.58], [x, y, z]]), 0.62, 0.3,
                 col='#586f40', mat=1)
        for k in range(5):
            a = k * TAU / 5
            add_leaf(scene, (x, y, z), a, 5.6, 2.4, 0.21, 0.0, n=4, ncross=3, col='#db7654', col_tip='#ffad76')
        oriented_blob(scene, (x, y, z + 1.3), (1.5, 1.5, 1.6), col='#e3c977', mat=1, nu=5, nv=6)
    return scene


def save_plants(out):
    rng = np.random.default_rng(421)
    tall, grove = Scene(), Scene()
    palm(tall, rng, -7, 7, 58, 34, (11, 9))
    palm(grove, rng, -19, 0, 57, 31, (4, 7))
    palm(grove, rng, 19, 1, 37, 25, (4, 8))
    scenery = [tall, grove, p2_leafrosette(), flowers(rng), coral_rubble(rng), p1_fern()]
    for i, scene in enumerate(scenery, 1):
        im, _ = render(scene, 'tropical', size=256, ss=2, seed=i, scale=[2.15, 1.83, 1.75, 2.22, 2.15, 1.38][i - 1],
               offset=(10, 21) if i <= 2 else (7, 9), info=False)
        im.save(out / f'plant-{i}.webp', quality=86, method=6)


if __name__ == '__main__':
    out = Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    for texture in (ground, water, rock, cliff):
        pixels = np.uint8(np.clip(texture(), 0, 1) * 255 + 0.5)
        Image.fromarray(pixels).save(out / f'{texture.__name__}.webp', quality=86, method=6)
    save_plants(out)

"""Preview sheets: plants on their biome ground at full size and at phone size (40 px)."""
import sys
import numpy as np
from PIL import Image

GROUND = {'desert': 'out/art/tiles/ground.png', 'jungle': 'out/art/biomes/jungle/ground.png',
          'polar': 'out/art/biomes/polar/ground.png'}


def ground_at(biome, tile_px, w, h, ox=0, oy=0):
    g = Image.open(GROUND[biome]).convert('RGB')
    s = tile_px * 4
    g = g.resize((s, s), Image.LANCZOS)
    out = Image.new('RGB', (w, h))
    for x in range(-1, w // s + 2):
        for y in range(-1, h // s + 2):
            out.paste(g, (x * s - ox, y * s - oy))
    return out


def sheet(biome, path, n=6, game=40):
    plants = [Image.open(f'out/art/biomes/{biome}/plant-{i}.png') for i in range(1, n + 1)]
    pad = 10
    W = n * (256 + pad) + pad
    # row 1: full size on ground (tile = 256 px)
    big = ground_at(biome, 256, W, 256 + 2 * pad)
    for i, p in enumerate(plants):
        big.paste(p, (pad + i * (256 + pad), pad), p)
    # row 2: phone size, each on a 3x1 strip of tiles, then enlarged x3 (nearest) so it can be inspected
    small = ground_at(biome, game, n * game * 2, game, 7, 3)
    for i, p in enumerate(plants):
        q = p.resize((game, game), Image.LANCZOS)
        small.paste(q, (i * game * 2 + game // 2, 0), q)
    small3 = small.resize((small.width * 3, small.height * 3), Image.NEAREST)
    H = big.height + small3.height + 30
    out = Image.new('RGB', (max(W, small3.width + 20), H), (28, 28, 28))
    out.paste(big, (0, 0))
    out.paste(small3, (10, big.height + 20))
    # actual size strip
    out.paste(small, (small3.width + 30 if small3.width + 30 + small.width < out.width else 10, big.height + 4))
    out.save(path)


if __name__ == '__main__':
    sheet(sys.argv[1], sys.argv[2])

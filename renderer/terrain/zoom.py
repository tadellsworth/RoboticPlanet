import sys
from PIL import Image
from sheet import ground_at
biome, path = sys.argv[1], sys.argv[2]
ids = [int(a) for a in sys.argv[3:]] or [1, 2, 3, 4, 5, 6]
cols = 3 if len(ids) > 2 else len(ids)
rows = (len(ids) + cols - 1) // cols
out = ground_at(biome, 256, cols * 256, rows * 256)
for k, i in enumerate(ids):
    p = Image.open(f'out/art/biomes/{biome}/plant-{i}.png')
    out.paste(p, ((k % cols) * 256, (k // cols) * 256), p)
out.save(path)

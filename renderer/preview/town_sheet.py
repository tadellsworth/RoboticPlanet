# Passenger Town 3D concept: the contact sheet of the set (b/town.js), each building by day over the same at night,
# on a street-grey ground with its shadow, at 96 px a tile, with a 45 px a tile copy (the readability check) beside it.
#   python3 preview/town_sheet.py jobs              prints the render jobs
#   python3 preview/town_sheet.py compose <dir> <out.png>
import sys, os
from PIL import Image, ImageDraw, ImageFont

SET = [  # (label, query)
    ('Walk-up flats 2x2', 'k=house&w=2&h=2&v=2'), ('Walk-up flats 3x2', 'k=house&w=3&h=2&v=5'), ('Shopfront 2x3', 'k=shop&w=2&h=3&v=1'),
    ('Shopfront 3x2', 'k=shop&w=3&h=2&v=4'), ('Apartment block 3x3', 'k=flats&w=3&h=3&v=1'), ('Residential tower 3x4', 'k=tower&w=3&h=4&v=1'),
    ('Civic tower 2x2', 'k=spire&w=2&h=2&v=1'), ('School 5x4', 'k=school&w=5&h=4&v=1'), ('Civic hall 5x3', 'k=hall&w=5&h=3&v=1'),
    ('Covered arcade 2x4', 'k=arcade&w=2&h=4&v=1'), ('Car hulks 1x1', 'k=car&w=1&h=1&v=1'),
    ('Being stripped (1)', 'k=flats&w=3&h=3&v=1&strip=1'), ('Stripped (2)', 'k=tower&w=3&h=4&v=1&strip=2'),
]
def nm(i, tod): return f's{i:02d}-{tod}'
if sys.argv[1] == 'jobs':
    for i, (_, q) in enumerate(SET):
        for tod in ('day', 'night'): print(f"town:::{nm(i, tod)}:{q}{'&tod=night' if tod == 'night' else ''}")
    for v in (2, 3): print(f'town:::car{v}-day:k=car&w=1&h=1&v={v}'); print(f'town:::car{v}-night:k=car&w=1&h=1&v={v}&tod=night')
    sys.exit()
d, out = sys.argv[2], sys.argv[3]
k = 96 / 128
try: font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 22)
except OSError: font = ImageFont.load_default()
def tile(n, night):
    im = Image.open(f'{d}/{n}.png'); sh = Image.open(f'{d}/{n}-shadow.png')
    bg = Image.new('RGBA', im.size, (40, 44, 56, 255) if night else (92, 94, 98, 255))
    s = sh.copy(); s.putalpha(s.getchannel('A').point(lambda v: int(v * (0.3 if night else 0.45)))); bg.alpha_composite(s); bg.alpha_composite(im)
    return bg.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
cells = []
for i, (label, q) in enumerate(SET):
    if 'car' in q:
        ims = {t: [tile(f'{nm(i, t)}', t == 'night')] + [tile(f'car{v}-{t}', t == 'night') for v in (2, 3)] for t in ('day', 'night')}
        cat = {}
        for t, v in ims.items():
            c = Image.new('RGBA', (sum(x.width for x in v) + 8 * (len(v) - 1), max(x.height for x in v)), (30, 30, 30, 255)); x0 = 0
            for x in v: c.paste(x, (x0, c.height - x.height)); x0 += x.width + 8
            cat[t] = c
        cells.append((label, cat['day'], cat['night']))
    else: cells.append((label, tile(nm(i, 'day'), False), tile(nm(i, 'night'), True)))
# lay out in rows no wider than 2880, the tallest together
cells.sort(key=lambda c: -(c[1].height + c[2].height))
rows, row, w = [], [], 0
for c in cells:
    cw = max(c[1].width, c[1].width * 45 // 96 + 0) + 20
    if w + cw > 2880 and row: rows.append(row); row, w = [], 0
    row.append(c); w += cw
rows.append(row)
H = sum(max(c[1].height + c[2].height for c in r) + 40 + 30 for r in rows) + 20
sheet = Image.new('RGB', (2880, H), (24, 24, 26)); dr = ImageDraw.Draw(sheet); y = 10
for r in rows:
    x = 10; rh = max(c[1].height + c[2].height for c in r) + 40
    for (label, day, night) in r:
        dr.text((x, y), label, fill=(230, 226, 214), font=font)
        sheet.paste(day, (x, y + 30 + (rh - 40 - day.height - night.height))); sheet.paste(night, (x, y + 34 + rh - 40 - night.height))
        x += day.width + 20
    y += rh + 30
sheet.save(out, optimize=True)
print('wrote', out, sheet.size)

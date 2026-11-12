"""Sky-islands canyon tiles for the Alien Bloom and Swamp biomes, using canyon.py's builders with new palettes.

Writes chasm-<key>.png, chasm-wall-<key>.png, chasm-wall-2-<key>.png and chasm-lip-{w,e,n}-<key>.png
(128 x 128, like the shipped canyon art) into out/art/biomes/<key>/. Both use canyon.py's 'jungle'
dressing (moss on the rim and ledges, strands hanging over the lip), recoloured:
  alien  violet-grey strata under spongy violet moss, magenta tendrils, pink motes in the violet haze
  swamp  muddy earth strata under green moss with grey Spanish moss trailing, a misty green void, fireflies
"""
import os
import sys

_argv = sys.argv
sys.argv = [_argv[0], 'out/art/biomes/alien']  # canyon.py makes its OUT dir at import; point it at ours
import canyon  # noqa: E402
sys.argv = _argv

PAL = {
    'alien': dict(
        void='#07040c', haze='#22123a', mote='#ff7ad0',
        rim='#4e4462', rimhi='#7a6e92', crack='#120c1a', dust='#6a5888',
        bands=['#4c4462', '#5e5476', '#3a3450', '#6a6084', '#463e5c', '#58506e', '#3e3854', '#726a8c'],
        face=0.8, moss='#4a3672', moss2='#7a5cae', vine='#8a3a8e', leaf='#d070b4'),
    'swamp': dict(
        void='#050704', haze='#26301f', mote='#f2d878',
        rim='#4a4430', rimhi='#6e6a48', crack='#0e0c08', dust='#5a6a30',
        bands=['#4a3c28', '#5a4a30', '#3a3020', '#62523a', '#44382a', '#54462e', '#3e3426', '#5c5038'],
        face=0.78, moss='#3e5a22', moss2='#62802e', vine='#8a9280', leaf='#a2a894'),
}


def down2(img):
    return canyon.down(canyon.down(img))


def build(key, seed):
    p = PAL[key]
    out = f'out/art/biomes/{key}'
    os.makedirs(out, exist_ok=True)
    bg = canyon.chasm(p, seed)
    canyon.save(down2(bg), f'{out}/chasm-{key}.png')
    wl = canyon.wall(p, seed + 100, 'jungle', bg)
    d = down2(wl)
    canyon.save(d[:128], f'{out}/chasm-wall-{key}.png')
    canyon.save(d[128:], f'{out}/chasm-wall-2-{key}.png')
    for k, side in enumerate('wen'):
        c, a = canyon.lip(p, seed + 300 + 17 * k, side, 'jungle')
        pm = down2(c * a[..., None])
        ad = down2(a)
        c2 = canyon.np.where(ad[..., None] > 1e-4, pm / canyon.np.maximum(ad, 1e-4)[..., None], 0)
        canyon.save(c2, f'{out}/chasm-lip-{side}-{key}.png', ad)


if __name__ == '__main__':
    for key, seed in (('alien', 51), ('swamp', 67)):
        if len(sys.argv) > 1 and key not in sys.argv[1:]:
            continue
        build(key, seed)
        print('done', key)

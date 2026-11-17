"""The Hollow's chasms (LORE.md: "Chasms that drop into deeper dark, crossed by robot bridges"), with canyon.py's builders.

Writes chasm-hollow.png, chasm-wall-hollow.png, chasm-wall-2-hollow.png and chasm-lip-{w,e,n}-hollow.png (128 x 128, like
the shipped canyon art) into out/art/biomes/hollow/. The 'jungle' dressing (moss on the rim and ledges, strands hanging
over the lip), recoloured: near-black stone strata under the Bloom's dark violet moss, root-veins hanging into the drop,
a void deeper than any surface canyon's, and in it a faint violet haze with a few drifting spores catching the light.

usage: python3 terrain/canyon_hollow.py   (run from renderer/)
"""
import os
import sys

_argv = sys.argv
sys.argv = [_argv[0], 'out/art/biomes/hollow']  # canyon.py makes its OUT dir at import; point it at ours
import canyon  # noqa: E402
sys.argv = _argv

PAL = dict(
    void='#020104', haze='#120a20', mote='#b48cff',
    rim='#36323e', rimhi='#56506a', crack='#0a080e', dust='#4a4260',
    bands=['#302c38', '#3a3544', '#24212a', '#423c4c', '#2c2834', '#363140', '#28242e', '#4a4456'],
    face=0.72, moss='#33265a', moss2='#5a4490', vine='#5a2e7a', leaf='#9a5ad0')


def build(seed=83):
    out = 'out/art/biomes/hollow'
    os.makedirs(out, exist_ok=True)
    bg = canyon.chasm(PAL, seed)
    canyon.save(canyon.down(canyon.down(bg)), f'{out}/chasm-hollow.png')
    wl = canyon.wall(PAL, seed + 100, 'jungle', bg)
    d = canyon.down(canyon.down(wl))
    canyon.save(d[:128], f'{out}/chasm-wall-hollow.png')
    canyon.save(d[128:], f'{out}/chasm-wall-2-hollow.png')
    np = canyon.np
    for k, side in enumerate('wen'):
        c, a = canyon.lip(PAL, seed + 300 + 17 * k, side, 'jungle')
        pm = canyon.down(canyon.down(c * a[..., None]))
        ad = canyon.down(canyon.down(a))
        c2 = np.where(ad[..., None] > 1e-4, pm / np.maximum(ad, 1e-4)[..., None], 0)
        canyon.save(c2, f'{out}/chasm-lip-{side}-hollow.png', ad)


if __name__ == '__main__':
    build()
    print('done hollow canyon')

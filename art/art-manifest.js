'use strict';
/*
 * Botfall — custom art manifest.
 *
 * Every building, bot and resource has placeholder art drawn in code. To replace one with
 * your own image, put the file in this folder and add a line below. Anything not listed keeps
 * using the built-in placeholder, so art can be swapped in one piece at a time.
 *
 *   key: 'path/inside/art/folder.png'
 *   key: { src: 'path.png', scale: 1.4 }      // scale = size in tiles (default 1, Lander 1.6)
 *
 * Team-specific versions: add '@0' (you, cyan) or '@1' (rival, red) to the key, e.g.
 *   'outpost@0': 'buildings/outpost-blue.png',
 *   'outpost@1': 'buildings/outpost-red.png',
 * Otherwise one image is used for both teams and a small team-coloured marker is drawn under it.
 *
 * Keys
 *   Buildings: lander harvester quarry mine tap grower smelter fab foundry outpost turret depot
 *              site (a construction site)
 *   Bots:      worker warbot           (drawn facing right; the game rotates them)
 *   Resources: stalk boulder ore crystal
 *   Ground:    ground water rock       (square tiles, drawn at 1 tile)
 *
 * Images should be square PNGs with transparent backgrounds, viewed from above.
 * 256x256 is plenty.
 */
const ART_MANIFEST = {
  // lander: { src: 'buildings/lander.png', scale: 1.6 },
  // worker: 'units/worker.png',
};

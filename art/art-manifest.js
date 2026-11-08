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
 *              charger munitions silo
 *              site (a construction site)
 *   Bots:      worker warbot           (drawn facing right; the game rotates them)
 *   Resources: stalk boulder ore crystal
 *   Ground:    ground water rock       (square seamless tiles; one image spans 4×4 map tiles)
 *   Terrain:   slope  (a ramp tile, drawn with uphill at the top; the game rotates it)
 *              cliff  (the rock face below a higher level: a wide strip, about 128×48)
 *   Building:  ramp   (the Ramp's construction icon and site)
 *   Goods:     icon-fiber icon-stone icon-ore icon-crystal icon-alloy icon-chip icon-warhead
 *              (small icons in the top bar and menus, 64x64)
 *   Markers:   missile (in flight, facing right; 128x128)  rally (your rally flag; 128x128)
 *
 * Images should be square PNGs with transparent backgrounds, viewed from above.
 * 256x256 is plenty.
 */
const ART_MANIFEST = {
  // Priority 1: what you see constantly
  'lander@0': { src: 'buildings/lander@0.png', scale: 1.6 },
  'lander@1': { src: 'buildings/lander@1.png', scale: 1.6 },
  'worker@0': 'bots/worker@0.png',
  'worker@1': 'bots/worker@1.png',
  'warbot@0': 'bots/warbot@0.png',
  'warbot@1': 'bots/warbot@1.png',
  ground: 'tiles/ground.png',
  stalk: 'resources/stalk.png',
  boulder: 'resources/boulder.png',
  ore: 'resources/ore.png',
  crystal: 'resources/crystal.png',

  // Priority 2: production buildings
  harvester: 'buildings/harvester.png',
  quarry: 'buildings/quarry.png',
  mine: 'buildings/mine.png',
  tap: 'buildings/tap.png',
  smelter: 'buildings/smelter.png',
  fab: 'buildings/fab.png',
  foundry: 'buildings/foundry.png',

  // Priority 3: the rest
  'outpost@0': 'buildings/outpost@0.png',
  'outpost@1': 'buildings/outpost@1.png',
  'turret@0': 'buildings/turret@0.png',
  'turret@1': 'buildings/turret@1.png',
  depot: 'buildings/depot.png',
  grower: 'buildings/grower.png',
  site: 'buildings/site.png',
  water: 'tiles/water.png',
  rock: 'tiles/rock.png',

  // Still to make (placeholders are drawn until these exist):
  //   ramp, slope, cliff, icon-fiber, icon-stone, icon-ore, icon-crystal, icon-alloy, icon-chip,
  //   charger, munitions, silo@0, silo@1, missile, rally, icon-warhead
};

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
 *   key: { src: 'path.png', scale: 1.4, anchor: 'bottom' }
 *        // for buildings drawn in a 3/4 view that rise above their tile: the image's bottom edge
 *        // sits on the bottom of the tile, and the building grows upward
 *   key: { src: 'path.png', scale: 1.4, anchor: [0.5, 0.615] }
 *        // or the exact point in the image (fractions of its width and height) that sits on the
 *        // tile's centre: for the 3D set, the centre of the pad's top surface
 *
 * Team-specific versions: add '@0' (you, cyan) or '@1' (rival, red) to the key, e.g.
 *   'outpost@0': 'buildings/outpost-blue.png',
 *   'outpost@1': 'buildings/outpost-red.png',
 * Otherwise one image is used for both teams and a small team-coloured marker is drawn under it.
 *
 * Keys
 *   Buildings: lander harvester quarry mine tap grower smelter fab foundry outpost turret depot
 *              charger munitions silo farm pump refinery kiln tarworks roadworks armory
 *              site (a construction site)
 *   Bots:      worker warbot hauler agribot paver  (drawn facing right; the game rotates them;
 *              without their own art, specialists use the worker's art with a small badge)
 *   Resources: stalk boulder ore crystal crop oil   (crop is drawn smaller while it ripens)
 *   Ground:    ground water rock fertile  (square seamless tiles; one image spans 4×4 map tiles)
 *   Terrain:   slope  (a ramp tile, drawn with uphill at the top; the game rotates it)
 *              cliff  (the rock face below a higher level: a wide strip, about 128×48)
 *   Building:  ramp   (the Ramp's construction icon and site)
 *   Goods:     icon-fiber icon-stone icon-ore icon-crystal icon-alloy icon-chip icon-crude icon-fuel
 *              icon-cement icon-asphalt icon-ammo icon-warhead
 *              (small icons in the top bar and menus, 64x64)
 *   Turrets:   turret@0/@1 can be flat art (drawn gun-right; the game rotates it) or, with
 *              anchor 'bottom', a 3/4-view base only, plus head images turret-head-0@0 … turret-head-7@0
 *              (and @1): the gun head alone on the same canvas, facing right (0), then each 45° step
 *              clockwise on screen (1 down-right … 6 up/away, 7 up-right). 16 heads (0-15) also work.
 *   Markers:   missile (in flight, facing right; 128x128)  rally (your rally flag; 128x128)
 *              oneway (arrow painted on a one-way path, pointing right; 64x64)
 *
 * Images should be square PNGs with transparent backgrounds, viewed from above.
 * 256x256 is plenty.
 */
/**
 * The 3D building set (512x512, 57° three-quarter view): each building stands on its own pad, and
 * the centre of the pad's top surface sits on the tile centre. Tune the size for all of them here.
 */
function B3D(src) { return { src, scale: 1.4, anchor: [0.5, 0.615] }; }

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
  harvester: B3D('buildings/harvester.png'),
  quarry: B3D('buildings/quarry.png'),
  mine: B3D('buildings/mine.png'),
  tap: B3D('buildings/tap.png'),
  smelter: B3D('buildings/smelter.png'),
  fab: B3D('buildings/fab.png'),
  foundry: B3D('buildings/foundry.png'),

  // Priority 3: the rest
  'outpost@0': B3D('buildings/outpost@0.png'),
  'outpost@1': B3D('buildings/outpost@1.png'),
  'turret@0': 'buildings/turret@0.png',
  'turret@1': 'buildings/turret@1.png',
  depot: B3D('buildings/depot.png'),
  grower: B3D('buildings/grower.png'),
  site: B3D('buildings/site.png'),
  water: 'tiles/water.png',
  rock: 'tiles/rock.png',

  // Still to make (placeholders are drawn until these exist):
  //   ramp, slope, cliff, icon-fiber, icon-stone, icon-ore, icon-crystal, icon-alloy, icon-chip,
  //   charger, munitions, silo@0, silo@1, missile, rally, icon-warhead
};

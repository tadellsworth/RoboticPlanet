'use strict';
/*
 * Terrafall — custom art manifest.
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
 *              charger munitions silo farm pump refinery kiln tarworks roadworks armory repair
 *              reactor nukesilo  site (a construction site)
 *   Bots:      worker warbot hauler agribot paver truck  (drawn facing right; the game rotates them;
 *              any bot can have driving frames '<type>@<team>-f0' … '-f3' and overlays '<type>-brake' and
 *              '<type>-boost'; give a bot without a baked-in shadow `shadow: true`;
 *              without their own art, specialists use the worker's art with a small badge)
 *   Resources: stalk boulder ore crystal crop oil uranium   (crop is drawn smaller while it ripens)
 *   Ground:    ground water rock fertile  (square seamless tiles; one image spans 4×4 map tiles;
 *              512x512 keeps them sharp when zoomed in)
 *   Biomes:    ground-jungle water-jungle rock-jungle cliff-jungle, and the same with -polar
 *              (the Red desert uses ground, water, rock and cliff; without these the desert ones are recoloured)
 *   Plants:    plant-desert-1 … plant-desert-6, plant-jungle-1 …, plant-polar-1 …  (decorative scenery,
 *              256x256, transparent; any number from 1 works)
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
 *   Markers:   missile (in flight, facing right; 128x128)  nuclear-missile  rally (your rally flag; 128x128)
 *              oneway (arrow painted on a one-way path, pointing right; 64x64)
 *   Effects:   nuke-blast (a 6×4 sprite sheet, 24 frames)  nuke-scorch (the scorched crater)
 *
 * Images should be square PNGs with transparent backgrounds, viewed from above.
 * 256x256 is plenty.
 */
/**
 * The 3D building set (512x512, 57° three-quarter view): each building stands on its own pad, and
 * the centre of the pad's top surface sits on the tile centre. Tune the size for all of them here.
 */
function B3D(src) { return { src, scale: 1.4, anchor: [0.5, 0.615] }; }

/** A biome's six decorative plants (shadows baked in, centred) and, except the desert, its ground, water, rock and cliff. */
function biomeSet(b) {
  const out = {};
  for (let k = 1; k <= 6; k++) out[`plant-${b}-${k}`] = `biomes/${b}/plant-${k}.webp`;
  if (b !== 'desert') for (const kind of ['ground', 'water', 'rock', 'cliff']) out[`${kind}-${b}`] = `biomes/${b}/${kind}.webp`;
  return out;
}

/** A robot's driving frames for both teams plus its brake and boost overlays (WebP). */
function driveSet(type) {
  const out = {};
  for (const team of [0, 1]) for (let f = 0; f < 4; f++) out[`${type}@${team}-f${f}`] = { src: `bots/${type}@${team}-f${f}.webp`, shadow: true };
  out[`${type}-brake`] = `bots/${type}-brake.webp`;
  out[`${type}-boost`] = `bots/${type}-boost.webp`;
  return out;
}

const ART_MANIFEST = {
  // Priority 1: what you see constantly
  // The Command Base (internal key "lander"): a 3D fortified base on the shared pad, drawn bigger than the rest.
  'lander@0': { src: 'buildings/lander@0.png', scale: 2.4, anchor: [0.5, 0.615] },
  'lander@1': { src: 'buildings/lander@1.png', scale: 2.4, anchor: [0.5, 0.615] },
  // Robots: four driving frames per team (bots/<robot>@<team>-f0 … f3, played by distance driven)
  // and brake / boost overlays; no shadow in the images, so `shadow` has the game draw it.
  // (The older single images, bots/<robot>@<team>.png, are no longer used.)
  ...driveSet('worker'), ...driveSet('warbot'), ...driveSet('hauler'), ...driveSet('agribot'), ...driveSet('paver'),
  ground: 'tiles/ground.webp',
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
  water: 'tiles/water.webp',
  rock: 'tiles/rock.webp',

  // The second 3D set: the rest of the economy buildings, plus the Ramp (build menu and preview).
  charger: B3D('buildings/charger.png'),
  farm: B3D('buildings/farm.png'),
  pump: B3D('buildings/pump.png'),
  refinery: B3D('buildings/refinery.png'),
  kiln: B3D('buildings/kiln.png'),
  tarworks: B3D('buildings/tarworks.png'),
  roadworks: B3D('buildings/roadworks.png'),
  ramp: B3D('buildings/ramp.png'),
  repair: B3D('buildings/repair-bay.png'),

  // Nuclear race: the Reactor and Nuclear Silo (team versions), the nuclear missile in flight (nose
  // right), the detonation (a 6×4 sheet of 24 frames, played once at 12 fps, ground zero at [0.5, 0.7])
  // and the scorched crater it leaves.
  reactor: B3D('buildings/nuclear-reactor.png'),
  'nukesilo@0': B3D('buildings/nuclear-silo@0.png'),
  'nukesilo@1': B3D('buildings/nuclear-silo@1.png'),
  // The same Silos with no missile in them: drawn until one is armed and ready to fire.
  'nukesilo-empty@0': B3D('buildings/nuclear-silo-empty@0.webp'),
  'nukesilo-empty@1': B3D('buildings/nuclear-silo-empty@1.webp'),
  'nuclear-missile': 'markers/nuclear-missile.png',
  'nuke-blast': 'effects/nuke-blast-sheet.webp',
  'nuke-scorch': 'effects/nuke-scorch.png',

  // Freight Truck: the same pattern, drawn bigger.
  ...driveSet('truck'),

  // Military buildings (Versus), with team versions: @0 yours (cyan lights), @1 the rival's (red).
  'armory@0': B3D('buildings/armory@0.png'),
  'armory@1': B3D('buildings/armory@1.png'),
  'munitions@0': B3D('buildings/munitions@0.png'),
  'munitions@1': B3D('buildings/munitions@1.png'),
  'silo@0': B3D('buildings/silo@0.png'),
  'silo@1': B3D('buildings/silo@1.png'),
  'silo-empty@0': B3D('buildings/silo-empty@0.webp'),
  'silo-empty@1': B3D('buildings/silo-empty@1.webp'),

  // Biomes: plants for the Red desert, Jungle and Polar worlds, and the Jungle and Polar terrain
  // (512x512 seamless textures, one image per 4x4 tiles; cliffs 128x48). The desert tiles above are 512 too.
  ...biomeSet('desert'), ...biomeSet('jungle'), ...biomeSet('polar'),

  // Still to make (placeholders are drawn until these exist):
  //   buildings: a 3D turret (base + head frames)
  //   resources: crop, oil, uranium     ground: fertile, slope, cliff     markers: missile, rally, oneway
  //   goods:     icon-fiber … icon-warhead (12 HUD icons)
};

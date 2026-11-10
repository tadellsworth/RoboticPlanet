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
 *              Weapon effects (ART_GUIDE Batch 15), sprite sheets given with frames and cols, e.g.
 *              'fx-explosion': { src: 'effects/fx-explosion.webp', frames: 16, cols: 4 }:
 *              fx-muzzle fx-tracer fx-impact fx-spark fx-smoke fx-explosion fx-debris fx-arc fx-dustcloud,
 *              and ground marks (each frame a variant) decal-pock decal-burn decal-scorch decal-rubble
 *
 * Images should be square PNGs with transparent backgrounds, viewed from above.
 * 256x256 is plenty.
 */
/**
 * The 3D building set (512x512, 57° three-quarter view): each building stands on its own pad, and
 * the centre of the pad's top surface sits on the tile centre. Tune the size for all of them here.
 */
function B3D(src, scale) { return { src, scale: scale || 1.4, anchor: [0.5, 0.615] }; }

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

/** Team frames '<type>@<team>-f0' … for an animated vehicle (WebP, in bots/). */
function frames(type, n) {
  const out = {};
  for (const team of [0, 1]) for (let f = 0; f < n; f++) out[`${type}@${team}-f${f}`] = `bots/${type}@${team}-f${f}.webp`;
  return out;
}

/** Several images in one folder, keyed by their names. */
function files(dir, keys) {
  const out = {};
  for (const k of keys) out[k] = `${dir}/${k}.webp`;
  return out;
}

const ART_MANIFEST = {
  // Priority 1: what you see constantly
  // The Command Base (internal key "lander"): a 3D fortified base on the shared pad, drawn bigger than the rest.
  'lander@0': { src: 'buildings/lander@0.webp', scale: 2.4, anchor: [0.5, 0.615] },
  'lander@1': { src: 'buildings/lander@1.webp', scale: 2.4, anchor: [0.5, 0.615] },
  // Robots: four driving frames per team (bots/<robot>@<team>-f0 … f3, played by distance driven)
  // and brake / boost overlays; no shadow in the images, so `shadow` has the game draw it.
  // (The older single images, bots/<robot>@<team>.png, are no longer used.)
  ...driveSet('worker'), ...driveSet('warbot'), ...driveSet('hauler'), ...driveSet('agribot'), ...driveSet('paver'),
  ground: 'tiles/ground.webp',
  stalk: 'resources/stalk.webp',
  boulder: 'resources/boulder.webp',
  ore: 'resources/ore.webp',
  crystal: 'resources/crystal.webp',

  // Priority 2: production buildings
  harvester: B3D('buildings/harvester.webp'),
  quarry: B3D('buildings/quarry.webp'),
  mine: B3D('buildings/mine.webp'),
  tap: B3D('buildings/tap.webp'),
  smelter: B3D('buildings/smelter.webp'),
  fab: B3D('buildings/fab.webp'),
  foundry: B3D('buildings/foundry.webp'),

  // Priority 3: the rest
  'outpost@0': B3D('buildings/outpost@0.webp'),
  'outpost@1': B3D('buildings/outpost@1.webp'),
  'turret@0': 'buildings/turret@0.webp',
  'turret@1': 'buildings/turret@1.webp',
  depot: B3D('buildings/depot.webp'),
  grower: B3D('buildings/grower.webp'),
  site: B3D('buildings/site.webp'),
  water: 'tiles/water.webp',
  rock: 'tiles/rock.webp',

  // The second 3D set: the rest of the economy buildings, plus the Ramp (build menu and preview).
  charger: B3D('buildings/charger.webp'),
  farm: B3D('buildings/farm.webp'),
  pump: B3D('buildings/pump.webp'),
  refinery: B3D('buildings/refinery.webp'),
  kiln: B3D('buildings/kiln.webp'),
  tarworks: B3D('buildings/tarworks.webp'),
  roadworks: B3D('buildings/roadworks.webp'),
  ramp: B3D('buildings/ramp.webp'),
  repair: B3D('buildings/repair-bay.webp'),

  // Nuclear race: the Reactor and Nuclear Silo (team versions), the nuclear missile in flight (nose
  // right), the detonation (a 6×4 sheet of 24 frames, played once at 12 fps, ground zero at [0.5, 0.7])
  // and the scorched crater it leaves.
  reactor: B3D('buildings/nuclear-reactor.webp'),
  'nukesilo@0': B3D('buildings/nuclear-silo@0.webp'),
  'nukesilo@1': B3D('buildings/nuclear-silo@1.webp'),
  // The same Silos with no missile in them: drawn until one is armed and ready to fire.
  'nukesilo-empty@0': B3D('buildings/nuclear-silo-empty@0.webp'),
  'nukesilo-empty@1': B3D('buildings/nuclear-silo-empty@1.webp'),
  'nuclear-missile': 'markers/nuclear-missile.webp',
  'nuke-blast': 'effects/nuke-blast-sheet.webp',
  'nuke-scorch': 'effects/nuke-scorch.webp',

  // Freight Truck: the same pattern, drawn bigger. The Tanker is its twin with a fuel tank on the chassis.
  ...driveSet('truck'),
  ...driveSet('tanker'),
  // Generator (one version for both teams, like the factories), and its working loop: fans and power bus.
  generator: B3D('buildings/generator.webp'),
  ...Object.fromEntries([0, 1, 2, 3, 4, 5, 6, 7].map((k) => [`generator-work-${k}`, B3D(`buildings/generator-work-${k}.webp`)])),
  // Diesel smoke: 12 frames of 64 x 64 (4 x 3), one puff each, seen from above. Not fx- names: they're
  // graded with the light at dusk and night like other smoke.
  'smoke-exhaust': { src: 'effects/fx-exhaust.webp', frames: 12, cols: 4 },
  // A fuel blast (a Tanker or Refinery going up): 16 frames of 256 x 256 (4 x 4), ground zero 2/3 down. Made with
  // renderer/fx/fuelblast.py.
  'fx-fuel-blast': { src: 'effects/fx-fuel-blast.webp', frames: 16, cols: 4 },
  // Pipeline tiles (renderer/b/pipe.js), 256 px straight down, turned to fit like the rail pieces.
  ...files('pipes', ['pipe-straight', 'pipe-corner', 'pipe-tee', 'pipe-cross', 'pipe-end', 'pipe-raised']),
  'smoke-exhaust-heavy': { src: 'effects/fx-exhaust-heavy.webp', frames: 12, cols: 4 },

  // Military buildings (Versus), with team versions: @0 yours (cyan lights), @1 the rival's (red).
  'armory@0': B3D('buildings/armory@0.webp'),
  'armory@1': B3D('buildings/armory@1.webp'),
  'munitions@0': B3D('buildings/munitions@0.webp'),
  'munitions@1': B3D('buildings/munitions@1.webp'),
  'silo@0': B3D('buildings/silo@0.webp'),
  'silo@1': B3D('buildings/silo@1.webp'),
  'silo-empty@0': B3D('buildings/silo-empty@0.webp'),
  'silo-empty@1': B3D('buildings/silo-empty@1.webp'),

  // Biomes: plants for the Red desert, Jungle and Polar worlds, and the Jungle and Polar terrain
  // (512x512 seamless textures, one image per 4x4 tiles; cliffs 128x48). The desert tiles above are 512 too.
  ...biomeSet('desert'), ...biomeSet('jungle'), ...biomeSet('polar'),

  // Batches 11–13 (Claude Design): the Lab, creature nests, Ropeway and Rail Station, on the shared pad.
  lab: B3D('buildings/lab.webp'),
  'nest-1': B3D('buildings/nest-1.webp'), 'nest-2': B3D('buildings/nest-2.webp'), 'nest-3': B3D('buildings/nest-3.webp'),
  // The Ropeway's pad is ~1.1 tiles (scale 1.47); its bull wheel, where the cable leaves, is at (0.5, 0.10).
  'ropeway@0': { src: 'buildings/ropeway@0.webp', scale: 1.47, anchor: [0.5, 0.615] },
  'ropeway@1': { src: 'buildings/ropeway@1.webp', scale: 1.47, anchor: [0.5, 0.615] },
  // The Rail Station's pad is ~1.2 tiles (scale 1.6).
  'station@0': { src: 'buildings/station@0.webp', scale: 1.6, anchor: [0.5, 0.615] },
  'station@1': { src: 'buildings/station@1.webp', scale: 1.6, anchor: [0.5, 0.615] },
  // A gondola hangs from the cable by its grip at (0.5, 0.08); the trader ship hovers (the game draws its shadow).
  'gondola@0': 'bots/gondola@0.webp', 'gondola@1': 'bots/gondola@1.webp',
  'trader-ship': 'bots/trader-ship.webp',
  // Vehicles, straight down and facing right (no shadows in the art): see the draw* functions for how
  // each is put together. Road Train: tractor frames + trailers (kingpin hitching, bed x 53–184, y 92–164).
  ...frames('roadtrain', 4), 'roadtrain-brake': 'bots/roadtrain-brake.webp',
  'roadtrain-trailer@0': 'bots/roadtrain-trailer@0.webp', 'roadtrain-trailer@1': 'bots/roadtrain-trailer@1.webp',
  // Freight Train: locomotive frames and overlays, flat cars and hoppers (couplers at x 26 and 230 of 256).
  ...frames('freight-loco', 4),
  'freight-loco-lights': 'bots/freight-loco-lights.webp', 'freight-loco-brake': 'bots/freight-loco-brake.webp', 'freight-loco-exhaust': 'bots/freight-loco-exhaust.webp',
  'freight-wagon-flat@0': 'bots/freight-wagon-flat@0.webp', 'freight-wagon-flat@1': 'bots/freight-wagon-flat@1.webp',
  'freight-wagon-hopper@0': 'bots/freight-wagon-hopper@0.webp', 'freight-wagon-hopper@1': 'bots/freight-wagon-hopper@1.webp',
  // Crawler: 8 tread frames, the 10-frame deploy sequence, the deployed base, and its overlays (dish pivot (180, 256) of 512).
  ...frames('crawler', 8),
  ...(() => { const o = {}; for (const t of [0, 1]) { for (let d = 0; d < 10; d++) o[`crawler-deploy@${t}-d${d}`] = `bots/crawler-deploy@${t}-d${d}.webp`; o[`crawlerbase@${t}`] = `bots/crawlerbase@${t}.webp`; } return o; })(),
  'crawler-dish': 'bots/crawler-dish.webp', 'crawler-lights': 'bots/crawler-lights.webp', 'crawler-dust': 'bots/crawler-dust.webp',
  // Creatures: four walking frames each (one version: wildlife has no team).
  ...(() => { const o = {}; for (const c of ['scuttler', 'brute']) for (let f = 0; f < 4; f++) o[`${c}-f${f}`] = `bots/${c}-f${f}.webp`; return o; })(),
  // Tiles (128x128, straight down): railway track pieces, the bridge kit (water, sky, rail; piers and
  // towers 128x256, the suspension cable 512x128) and the Sky islands canyon set.
  ...files('rail', ['rail-straight', 'rail-curve', 'rail-tee', 'rail-cross', 'rail-end', 'rail-level-crossing', 'rail-barrier-up', 'rail-barrier-down', 'rail-lights-on']),
  ...files('bridges', ['bridge', 'skybridge', 'railbridge'].flatMap((k) => ['ew', 'ns', 'end-w', 'end-e', 'end-n', 'end-s', 'ramp-w', 'ramp-e', 'ramp-n', 'ramp-s', 'pier'].map((p) => `${k}-${p}`)).concat(['skybridge-tower', 'skybridge-tower-lamp', 'skybridge-cable'])),
  ...files('canyon', ['', '-jungle', '-polar'].flatMap((b) => ['chasm', 'chasm-wall', 'chasm-wall-2', 'chasm-lip-n', 'chasm-lip-w', 'chasm-lip-e'].map((k) => k + b))),

  // Bunker, Disruptor Tower and Mortar Pit (ART_GUIDE Batch 14), drawn at their size classes (1.2,
  // 1.3 and 1.3 tiles). The overlays (flashed as they fire) and the Mortar's tube in 16 directions
  // share their building's canvas and anchor.
  'bunker@0': B3D('buildings/bunker@0.webp', 1.2), 'bunker@1': B3D('buildings/bunker@1.webp', 1.2),
  'bunker-fire@0': B3D('buildings/bunker-fire@0.webp', 1.2), 'bunker-fire@1': B3D('buildings/bunker-fire@1.webp', 1.2),
  'disruptor@0': B3D('buildings/disruptor@0.webp', 1.3), 'disruptor@1': B3D('buildings/disruptor@1.webp', 1.3),
  'disruptor-pulse': B3D('buildings/disruptor-pulse.webp', 1.3),
  'mortar@0': B3D('buildings/mortar@0.webp', 1.3), 'mortar@1': B3D('buildings/mortar@1.webp', 1.3),
  ...(() => { const o = {}; for (let k = 0; k < 16; k++) o[`mortar-head-${k}`] = B3D(`buildings/mortar-head-${k}.webp`, 1.3); return o; })(),
  // Streetlamps (256x256, foot at [0.5, 0.914], drawn 1 tile across; arm to the right): a sodium lamp
  // on concrete roads, a white highway lamp on asphalt; '-lit' is the glowing head alone, and '-pool'
  // the light it throws on the road.
  ...(() => { const o = {}; for (const k of ['streetlamp-road', 'streetlamp-road-lit', 'streetlamp-asphalt', 'streetlamp-asphalt-lit']) o[k] = { src: `roads/${k}.webp`, scale: 1, anchor: [0.5, 0.914] }; return o; })(),
  ...files('roads', ['streetlamp-road-pool', 'streetlamp-asphalt-pool']),
  // The Pulse Turret's twin violet laser (6 frames of 512x64, stacked; points right, stretched to the
  // target) and the burst where it hits (6 frames of 128x128 in a row).
  'fx-pulse-laser': { src: 'effects/fx-pulse-laser.webp', frames: 6, cols: 1 },
  'fx-pulse-hit': { src: 'effects/fx-pulse-hit.webp', frames: 6, cols: 6 },

  // Still to make (placeholders are drawn until these exist):
  //   buildings: a 3D turret by day (base + head frames: the morning, evening and night sets exist,
  //              and the Pulse Turret's charge-up sheets, turret-charge-0…15, are made to sit on it)
  //   resources: crop, oil, uranium     ground: fertile, slope, cliff     markers: missile, rally, oneway
  //   goods:     icon-fiber … icon-warhead (12 HUD icons)
};

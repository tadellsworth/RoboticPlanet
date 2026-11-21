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
 *              reactor nukesilo mast  site (a construction site)
 *   Bots:      worker warbot hauler agribot paver truck  (drawn facing right; the game rotates them;
 *              any bot can have driving frames '<type>@<team>-f0' … '-f3' and overlays '<type>-brake' and
 *              '<type>-boost'; give a bot without a baked-in shadow `shadow: true`;
 *              without their own art, specialists use the worker's art with a small badge)
 *   Resources: stalk boulder ore crystal crop uranium   (crop is drawn smaller while it ripens; stalk has an image
 *              for each growth stage, stalk-1 … stalk-3; stalk-glow and stalk-3-glow are its light at night. An oil
 *              seep has no art: it is a puddle of crude made in code from its tiles, js/seep.js)
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
 *   Turrets:   turret@0/@1 can be flat art (drawn gun-right; the game rotates it) or, with an
 *              anchor ('bottom' or [x, y]), a 3/4-view base only, plus head images turret-head-0@0 … turret-head-7@0
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
const MD_FRAME = { scale: 2.4789, anchor: [0.5, 0.57] }; // (the Mass Driver's wide frame: see tools/install_massdriver.py)
const LANCE_FRAME = { scale: 5.071, anchor: [0.5, 0.56] }, DOME_FRAME = { scale: 2.9904, anchor: [0.5, 0.6] }; // (the megastructures' wide frames: see tools/install_lance.py)
const CITY_FRAME = { scale: 6.5789, anchor: [0.5, 0.6] }; // (Arrival City's wide frame: see tools/install_city.py)
const LIFT_FRAME = { scale: 5.071, anchor: [0.5, 0.56] }; // (the Orbital Lift's wide frame, as the Lance's: see tools/install_lift.py)
const GUP_FRAME = { scale: 5.071, anchor: [0.5, 0.6] }; // (the Great Uplink's wide frame, as the Lift's: see tools/install_gup.py)
function B3D(src, scale) { return { src, scale: scale || 1.4, anchor: [0.5, 0.615] }; }

// Biomes whose ground, water or plants glow at night: which pieces have glow art (see bakeGlow).
const BIOME_GLOWS = { volcanic: { plants: [1, 2, 3], ground: true, water: true }, alien: { plants: [1, 2, 3, 4, 5, 6], ground: true, water: true },
  hollow: { plants: [1, 2, 3, 4, 5, 6], ground: true, water: true } };

/** A biome's six decorative plants (shadows baked in, centred) and, except the desert, its ground, water, rock and cliff, plus any glow art. */
function biomeSet(b) {
  const out = {}, g = BIOME_GLOWS[b];
  for (let k = 1; k <= 6; k++) out[`plant-${b}-${k}`] = `biomes/${b}/plant-${k}.webp`;
  if (b !== 'desert') for (const kind of ['ground', 'water', 'rock', 'cliff']) out[`${kind}-${b}`] = `biomes/${b}/${kind}.webp`;
  if (g) {
    for (const k of g.plants) out[`plant-${b}-${k}-glow`] = `biomes/${b}/plant-${k}-glow.webp`;
    if (g.ground) out[`ground-glow-${b}`] = `biomes/${b}/ground-glow.webp`;
    if (g.water) out[`water-glow-${b}`] = `biomes/${b}/water-glow.webp`;
  }
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
/** The Walls and Gates set: every piece for both teams, and its six spark frames. */
const WALL_PIECES = ['wall-post', 'wall-n', 'wall-e', 'wall-s', 'wall-w', 'wall-hub-ew', 'wall-hub-ns', 'gate-ew-closed', 'gate-ew-open', 'gate-ns-closed', 'gate-ns-open'];
const WALL_ART = (() => {
  const o = {};
  for (const p of WALL_PIECES) for (const t of [0, 1]) {
    o[`${p}@${t}`] = B3D(`buildings/walls/${p}@${t}.webp`);
    for (let f = 0; f < 6; f++) o[`${p}@${t}-spark-f${f}`] = B3D(`buildings/walls/${p}@${t}-spark-f${f}.webp`);
  }
  return o;
})();

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
  ...driveSet('bulwark'), ...driveSet('torch'), ...driveSet('skirmisher'), ...driveSet('arccaster'), ...driveSet('railgunner'),
  ground: 'tiles/ground.webp',
  // Fiber's Stalks (Reedcane, renderer/b/resources.js): full grown, then a quarter, half and three-quarters grown as
  // it comes back; the plumes' light at night. (Oil has no art: a seep is a puddle of crude made in code from its tiles,
  // js/seep.js.)
  stalk: 'resources/stalk.webp', 'stalk-1': 'resources/stalk-1.webp', 'stalk-2': 'resources/stalk-2.webp', 'stalk-3': 'resources/stalk-3.webp',
  'stalk-glow': 'resources/stalk-glow.webp', 'stalk-3-glow': 'resources/stalk-3-glow.webp',
  boulder: 'resources/boulder.webp',
  ore: 'resources/ore.webp',
  crystal: 'resources/crystal.webp',

  // Priority 2: production buildings
  'harvester@0': B3D('buildings/harvester@0.webp'), 'harvester@1': B3D('buildings/harvester@1.webp'),
  'quarry@0': B3D('buildings/quarry@0.webp'), 'quarry@1': B3D('buildings/quarry@1.webp'),
  'mine@0': B3D('buildings/mine@0.webp'), 'mine@1': B3D('buildings/mine@1.webp'),
  'tap@0': B3D('buildings/tap@0.webp'), 'tap@1': B3D('buildings/tap@1.webp'),
  'smelter@0': B3D('buildings/smelter@0.webp'), 'smelter@1': B3D('buildings/smelter@1.webp'),
  'fab@0': B3D('buildings/fab@0.webp'), 'fab@1': B3D('buildings/fab@1.webp'),
  'foundry@0': B3D('buildings/foundry@0.webp'), 'foundry@1': B3D('buildings/foundry@1.webp'),

  // Priority 3: the rest
  'outpost@0': B3D('buildings/outpost@0.webp'),
  'outpost@1': B3D('buildings/outpost@1.webp'),
  // The Pulse Turret in 3D: a fixed base and the gun head in 16 directions (0 = right, then clockwise on
  // screen), each team's own, on the base's canvas.
  'turret@0': B3D('buildings/turret@0.webp'), 'turret@1': B3D('buildings/turret@1.webp'),
  ...(() => { const o = {}; for (const t of [0, 1]) for (let k = 0; k < 16; k++) o[`turret-head-${k}@${t}`] = B3D(`buildings/turret-head-${k}@${t}.webp`); return o; })(),
  'depot@0': B3D('buildings/depot@0.webp'), 'depot@1': B3D('buildings/depot@1.webp'),
  'grower@0': B3D('buildings/grower@0.webp'), 'grower@1': B3D('buildings/grower@1.webp'),
  'site@0': B3D('buildings/site@0.webp'), 'site@1': B3D('buildings/site@1.webp'),
  water: 'tiles/water.webp',
  rock: 'tiles/rock.webp',

  // The second 3D set: the rest of the economy buildings, plus the Ramp (build menu and preview).
  'charger@0': B3D('buildings/charger@0.webp'), 'charger@1': B3D('buildings/charger@1.webp'),
  'farm@0': B3D('buildings/farm@0.webp'), 'farm@1': B3D('buildings/farm@1.webp'),
  'pump@0': B3D('buildings/pump@0.webp'), 'pump@1': B3D('buildings/pump@1.webp'),
  'refinery@0': B3D('buildings/refinery@0.webp'), 'refinery@1': B3D('buildings/refinery@1.webp'),
  'fueltank@0': B3D('buildings/fueltank@0.webp'), 'fueltank@1': B3D('buildings/fueltank@1.webp'),
  'kiln@0': B3D('buildings/kiln@0.webp'), 'kiln@1': B3D('buildings/kiln@1.webp'),
  'tarworks@0': B3D('buildings/tarworks@0.webp'), 'tarworks@1': B3D('buildings/tarworks@1.webp'),
  'roadworks@0': B3D('buildings/roadworks@0.webp'), 'roadworks@1': B3D('buildings/roadworks@1.webp'),
  'ramp@0': B3D('buildings/ramp@0.webp'), 'ramp@1': B3D('buildings/ramp@1.webp'),
  'repair@0': B3D('buildings/repair-bay@0.webp'), 'repair@1': B3D('buildings/repair-bay@1.webp'),

  // Nuclear race: the Reactor and Nuclear Silo (team versions), the nuclear missile in flight (nose
  // right), the detonation (a 6×4 sheet of 24 frames, played once at 12 fps, ground zero at [0.5, 0.7])
  // and the scorched crater it leaves.
  'reactor@0': B3D('buildings/nuclear-reactor@0.webp'), 'reactor@1': B3D('buildings/nuclear-reactor@1.webp'),
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
  // Naval maps: the Port (team versions, like the Rail Station) and the ships, top-down facing right
  // (Container Ship, Tanker Ship, Ferry; 20 world units across the image, drawn about two tiles wide).
  'port@0': B3D('buildings/port@0.webp', 1.6),
  'port@1': B3D('buildings/port@1.webp', 1.6),
  ...Object.fromEntries(['cargoship', 'tankship', 'ferry'].flatMap((k) => [0, 1].map((t) => [`${k}@${t}`, `bots/${k}@${t}.webp`]))),
  // Air: the Airfield's hangar end (its runway is drawn in code), the Drop Outpost, the Cargo Plane (top-down, facing +x).
  'airfield@0': B3D('buildings/airfield@0.webp', 1.6),
  'airfield@1': B3D('buildings/airfield@1.webp', 1.6),
  'dropost@0': B3D('buildings/dropost@0.webp', 2.3),
  'dropost@1': B3D('buildings/dropost@1.webp', 2.3),
  'flak@0': B3D('buildings/flak@0.webp', 1.3), 'flak@1': B3D('buildings/flak@1.webp', 1.3),
  'minigun@0': B3D('buildings/minigun@0.webp', 1.3), 'minigun@1': B3D('buildings/minigun@1.webp', 1.3),
  // The Rocket Truck (renderer/b/rockettruck.js): top-down, driving, and with its rack raised to fire.
  'rocket@0-f0': { src: 'bots/rocket@0-f0.webp', shadow: true }, 'rocket@1-f0': { src: 'bots/rocket@1-f0.webp', shadow: true },
  'rocket-up@0': { src: 'bots/rocket-up@0.webp', shadow: true }, 'rocket-up@1': { src: 'bots/rocket-up@1.webp', shadow: true },
  // The Keep: the concrete base (per team), its roof cannon in 16 directions and six frames of live wire (renderer/b/keep.js).
  'keep@0': B3D('buildings/keep@0.webp', 1.65), 'keep@1': B3D('buildings/keep@1.webp', 1.65),
  tradepost: B3D('buildings/tradepost.webp', 2.0), // the neutral Trade Post (no team)
  uplink: B3D('buildings/uplink.webp', 1.9), // a neutral Uplink (the Uplinks victory; no team: the game lights its ring and beacon)
  'terminal@0': B3D('buildings/terminal@0.webp', 1.6), 'terminal@1': B3D('buildings/terminal@1.webp', 1.6),
  ...(() => { const o = {}; for (let k = 0; k < 16; k++) o[`keep-head-${k}`] = B3D(`buildings/keep-head-${k}.webp`, 1.65); for (let f = 0; f < 6; f++) o[`keep-spark-${f}`] = B3D(`buildings/keep-spark-${f}.webp`, 1.65); return o; })(),
  ...(() => { const o = {}; for (let k = 0; k < 16; k++) o[`flak-head-${k}`] = B3D(`buildings/flak-head-${k}.webp`, 1.3); return o; })(),
  ...(() => { const o = {}; for (let k = 0; k < 16; k++) o[`minigun-head-${k}`] = B3D(`buildings/minigun-head-${k}.webp`, 1.3); return o; })(),
  // Air drops (renderer/b/airdrop.js): a crate under its parachute, a canopy, a landed crate, a spent parachute.
  ...Object.fromEntries(['chute-fall', 'chute', 'crate-drop', 'chute-flat'].flatMap((k) => [0, 1].map((t) => [`${k}@${t}`, `bots/${k}@${t}.webp`]))),
  'cargoplane@0': 'bots/cargoplane@0.webp',
  'cargoplane@1': 'bots/cargoplane@1.webp',
  // The Airship (renderer/b/airship.js v=c, the armoured blimp: top-down, facing +x, 30 world units across, drawn about 3
  // tiles wide; drawAirship spins its lift fans in code) and its ground shadow (its silhouette, softened); the Mooring
  // Mast (renderer/b/mast.js v=c, the armoured pylon: one tile, its mooring cup at [0.5, 0.08]).
  'airship@0': 'bots/airship@0.webp', 'airship@1': 'bots/airship@1.webp', 'airship-shadow': 'bots/airship-shadow.webp',
  'mast@0': B3D('buildings/mast@0.webp'), 'mast@1': B3D('buildings/mast@1.webp'),
  // The Maglev line (renderer/b/maglev.js v=a, Accord Phase 2, installed by tools/install_maglev.py): the Terminal (as big
  // as the Rail Station, its dock MAGLEV.head tiles up the screen), the pylon (no pad, its head MAGLEV.deck tiles up) and
  // the pylon shot down, the pod loaded and empty (top-down, facing +x, one tile) and one tile of guideway running east,
  // which drawMaglevs repeats along a line.
  'magterm@0': B3D('buildings/magterm@0.webp', 1.6), 'magterm@1': B3D('buildings/magterm@1.webp', 1.6),
  'magpylon@0': B3D('buildings/magpylon@0.webp'), 'magpylon@1': B3D('buildings/magpylon@1.webp'),
  'magpylon-cut@0': B3D('buildings/magpylon-cut@0.webp'), 'magpylon-cut@1': B3D('buildings/magpylon-cut@1.webp'),
  'magpod@0': 'bots/magpod@0.webp', 'magpod@1': 'bots/magpod@1.webp', 'magpod-empty@0': 'bots/magpod-empty@0.webp', 'magpod-empty@1': 'bots/magpod-empty@1.webp',
  'magdeck@0': 'tiles/magdeck@0.webp', 'magdeck@1': 'tiles/magdeck@1.webp',
  // The Mass Driver (renderer/b/massdriver.js, look A "Coil Ramp", two tiles long, installed by
  // tools/install_massdriver.py): its ramp pointing each of four ways (e or w lying east-west, n or s north-south:
  // drawBuilding shows the end facing its Catcher; 'mdriver' alone, for the menu, points east), framed wide (MD_FRAME:
  // its scale in tiles and the anchor, the middle of its two tiles, as the install prints them), and the Catcher with its
  // arms open and swung in (as a canister lands).
  ...Object.fromEntries([0, 1].flatMap((t) => [[`mdriver@${t}`, { src: `buildings/mdriver-e@${t}.webp`, ...MD_FRAME }],
    ...['e', 'w', 'n', 's'].map((d) => [`mdriver-${d}@${t}`, { src: `buildings/mdriver-${d}@${t}.webp`, ...MD_FRAME }]),
    [`catcher@${t}`, B3D(`buildings/catcher@${t}.webp`)], [`catcher-closed@${t}`, B3D(`buildings/catcher-closed@${t}.webp`)]])),
  // The megastructures (renderer/b/lance.js and b/dome.js, the owner's look A for both, installed by tools/install_lance.py):
  // the Lance of Corvane's 3 x 3 gun pit, its gun on the turntable turned each of 16 ways (no team colour: one set for
  // every team; drawBuilding lays it over the pit by the Lance's aim), and the Shield Dome's 2 x 2 emitter, framed wide
  // (LANCE_FRAME, DOME_FRAME: the scale in tiles and the anchor, the middle of the square). The dome itself, the beam,
  // the charge rings' glow and the cut are drawn in code (js/render.js, the megastructures).
  ...Object.fromEntries([0, 1].flatMap((t) => [[`lance@${t}`, { src: `buildings/lance@${t}.webp`, ...LANCE_FRAME }], [`dome@${t}`, { src: `buildings/dome@${t}.webp`, ...DOME_FRAME }]])),
  ...Object.fromEntries(Array.from({ length: 16 }, (_, k) => [`lance-head-${k}`, { src: `buildings/lance-head-${k}.webp`, ...LANCE_FRAME }])),
  // Arrival City (renderer/b/city.js, the owner's look A, Four Blocks round a Square, installed by tools/install_city.py):
  // the 4 x 4 City and the City knocked down (battle-damaged, dark), framed wide (CITY_FRAME); its four tiers of lights
  // (light to add, one set for every team and time of day: drawCity lights them tier by tier at dusk, on a timer), the
  // LED strips round its roofs in white (tinted in the owner's colour in code), and what still burns on the wreck.
  ...Object.fromEntries([0, 1].flatMap((t) => [[`city@${t}`, { src: `buildings/city@${t}.webp`, ...CITY_FRAME }], [`city-down@${t}`, { src: `buildings/city-down@${t}.webp`, ...CITY_FRAME }]])),
  ...Object.fromEntries(['0', '1', '2', '3', 'down'].map((k) => [`city-lit-${k}`, { src: `buildings/city-lit-${k}.webp`, ...CITY_FRAME }])),
  'city-led': { src: 'buildings/city-led.webp', ...CITY_FRAME },
  // The Orbital Lift (renderer/b/lift.js, the owner's look A, the Beacon Cable, installed by tools/install_lift.py): the
  // 3 x 3 anchor pad, and the pad below 30% of its armor (battle-damaged), framed wide (LIFT_FRAME). The cable above its
  // foot, its climbers and lights, its shadow and its fall are drawn in code (js/render.js, the Orbital Lift).
  ...Object.fromEntries([0, 1].flatMap((t) => [[`lift@${t}`, { src: `buildings/lift@${t}.webp`, ...LIFT_FRAME }], [`lift-down@${t}`, { src: `buildings/lift-down@${t}.webp`, ...LIFT_FRAME }]])),
  // The Great Uplink (renderer/b/gup.js, the owner's look A, the Dish Array, installed by tools/install_gup.py): the
  // dish array, whole and below 30% of its armor; its transmission is drawn in code (drawGupSignals).
  ...Object.fromEntries([0, 1].flatMap((t) => [[`gup@${t}`, { src: `buildings/gup@${t}.webp`, ...GUP_FRAME }], [`gup-down@${t}`, { src: `buildings/gup-down@${t}.webp`, ...GUP_FRAME }]])),
  'bomber@0': 'bots/bomber@0.webp',
  'bomber@1': 'bots/bomber@1.webp',
  // Generator (one version for both teams, like the factories), and its working loop: fans and power bus.
  'generator@0': B3D('buildings/generator@0.webp'), 'generator@1': B3D('buildings/generator@1.webp'),
  ...Object.fromEntries([0, 1, 2, 3, 4, 5, 6, 7].map((k) => [`generator-work-${k}`, B3D(`buildings/generator-work-${k}.webp`)])),
  // Working loops (8 frames, played while the building works): the Smelter's furnace glow and embers and
  // the Refinery's blinking column lights (both light), and the Oil Pump's walking beam nodding through
  // a stroke, drawn over the pump without its beam ('pump-base') while it pumps.
  ...Object.fromEntries(['smelter', 'refinery', 'pump'].flatMap((b) => [0, 1, 2, 3, 4, 5, 6, 7].map((k) => [`${b}-work-${k}`, B3D(`buildings/${b}-work-${k}.webp`)]))),
  'pump-base@0': B3D('buildings/pump-base@0.webp'), 'pump-base@1': B3D('buildings/pump-base@1.webp'),
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
  ...Object.fromEntries(['chasm', 'chasm-wall', 'chasm-wall-2', 'chasm-lip-n', 'chasm-lip-w', 'chasm-lip-e']
    .map((k) => [k + '-springs', `biomes/springs/${k}-springs.webp`])),
  ...biomeSet('desert'), ...biomeSet('jungle'), ...biomeSet('polar'),
  ...biomeSet('autumn'), ...biomeSet('savanna'), ...biomeSet('swamp'), ...biomeSet('volcanic'), ...biomeSet('lunar'), ...biomeSet('alien'), ...biomeSet('springs'), ...biomeSet('tropical'),
  // The Hollow (renderer/b/hollow.js, murmur_moles.js and terrain/*_hollow.py): its own terrain and plants above, and
  // its pieces. Every key ends -hollow, so it all loads only when the Hollow is played (LAZY_BIOMES). The standing
  // pieces (pillars, the Deep's mound) are night renders, drawn as they are; the rest are lit like the ground and
  // graded with it, their light in -glow images.
  ...biomeSet('hollow'),
  'wall-hollow': 'biomes/hollow/wall.webp', // the cave wall's face over a floor tile under rock (128 x 64, four tiles across)
  'vein-hollow': { src: 'biomes/hollow/vein.webp', scale: 1.4, anchor: [0.5, 0.6145] }, // a Bloom vein (the Hollow's Fiber)
  'vein-glow-hollow': { src: 'biomes/hollow/vein-glow.webp', scale: 1.4, anchor: [0.5, 0.6145] },
  'floater-hollow': { src: 'biomes/hollow/floater.webp', scale: 8.3, anchor: [0.5, 0.4] }, // a floating Crystal mass: over its platform and the chasm
  'floater-glow-hollow': { src: 'biomes/hollow/floater-glow.webp', scale: 8.3, anchor: [0.5, 0.4] },
  'chamber-hollow': { src: 'biomes/hollow/chamber.webp', scale: 3.35, anchor: [0.5, 0.52] }, // a side chamber's floor: robot parts in rows
  'chamber-glow-hollow': { src: 'biomes/hollow/chamber-glow.webp', scale: 3.35, anchor: [0.5, 0.52] },
  'pillar-1-hollow': { src: 'biomes/hollow/pillar-1.webp', scale: 3.3, anchor: [0.5, 0.8] }, // stone pillars rising into the dark
  'pillar-2-hollow': { src: 'biomes/hollow/pillar-2.webp', scale: 3.3, anchor: [0.5, 0.8] },
  'deep-mound-hollow': { src: 'biomes/hollow/deep-mound.webp', scale: 5.6, anchor: [0.5, 0.6145] }, // the Burrow's level 4
  'breach-light-hollow': 'biomes/hollow/breach-light.webp', // the pool of daylight under a breach (a mask)
  'breach-beam-hollow': 'biomes/hollow/breach-beam.webp', // the shaft of daylight itself, added over everything
  lava: 'biomes/volcanic/water.webp', // lava (Volcano maps, whatever the biome)

  // Batches 11–13 (Claude Design): the Lab, creature nests, Ropeway and Rail Station, on the shared pad.
  'lab@0': B3D('buildings/lab@0.webp'), 'lab@1': B3D('buildings/lab@1.webp'),
  'nest-1': B3D('buildings/nest-1.webp'), 'nest-2': B3D('buildings/nest-2.webp'), 'nest-3': B3D('buildings/nest-3.webp'),
  // A Murmur tunnel exit, open (with morning, evening and night versions) and caved in (drawn with the ground).
  'tunnel-exit': { src: 'buildings/tunnel-exit.webp', scale: 1.05, anchor: [0.5, 0.6145] },
  'tunnel-exit-collapsed': { src: 'buildings/tunnel-exit-collapsed.webp', scale: 1.05, anchor: [0.5, 0.6145] },
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
  // The Murmur (renderer/b/murmur_moles.js; one version: wildlife has no team). Loaded only in a game with them, from
  // their own bundle in a single-file copy (ensureMurmurArt in js/render.js). Each: four walking frames, and its action
  // loops (MURMUR_POSES in js/render.js): the Leech feeding, the Spitter spitting, the Sapper digging in, under the
  // ground (the heave) and coming up. Every frame has a glow image (<key>-glow: its crystal's light alone, added over it
  // as bright as it's charged). 256x256, straight down, facing right; re-lit sets in tod/<time>/bots (MURMUR_TOD_KEYS).
  ...(() => {
    const o = {}, F = { scuttler: { '': 4 }, brute: { '': 4 }, leech: { '': 4, feed: 4 }, spitter: { '': 4, spit: 4 }, sapper: { '': 4, dig: 4, under: 4, up: 5 } };
    for (const c in F) for (const p in F[c]) for (let f = 0; f < F[c][p]; f++) { const k = `${c}-${p ? p + '-' : ''}f${f}`; o[k] = `bots/${k}.webp`; o[k + '-glow'] = `bots/${k}-glow.webp`; }
    return o;
  })(),
  // The Spitter's volley in flight (pointing right, drawn 0.6 of a tile across; its glow added at night) and its hit
  // (8 frames of 128x128 in a row: the shards came from the left).
  'fx-spit': 'effects/fx-spit.webp', 'fx-spit-glow': 'effects/fx-spit-glow.webp',
  'fx-spit-hit': { src: 'effects/fx-spit-hit.webp', frames: 8, cols: 8 },
  // Tiles (128x128, straight down): railway track pieces, the bridge kit (water, sky, rail; piers and
  // towers 128x256, the suspension cable 512x128) and the Sky islands canyon set.
  ...files('rail', ['rail-straight', 'rail-curve', 'rail-tee', 'rail-cross', 'rail-end', 'rail-level-crossing', 'rail-barrier-up', 'rail-barrier-down', 'rail-lights-on']),
  ...files('bridges', ['bridge', 'skybridge', 'railbridge'].flatMap((k) => ['ew', 'ns', 'end-w', 'end-e', 'end-n', 'end-s', 'ramp-w', 'ramp-e', 'ramp-n', 'ramp-s', 'pier'].map((p) => `${k}-${p}`)).concat(['skybridge-tower', 'skybridge-tower-lamp', 'skybridge-cable'])),
  // A Viaduct's abutment tile (renderer/b/bridge.js piece abut-*): viaduct-abut-e when its span leaves eastward.
  ...files('bridges', ['viaduct-abut-w', 'viaduct-abut-e', 'viaduct-abut-n', 'viaduct-abut-s']),
  ...files('canyon', ['', '-jungle', '-polar', '-autumn', '-savanna', '-swamp', '-volcanic', '-lunar', '-alien', '-hollow'].flatMap((b) => ['chasm', 'chasm-wall', 'chasm-wall-2', 'chasm-lip-n', 'chasm-lip-w', 'chasm-lip-e'].map((k) => k + b))),

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
  ...(() => { const o = {}; for (const k of ['streetlamp-road', 'streetlamp-road-lit', 'streetlamp-asphalt', 'streetlamp-asphalt-lit']) for (const t of [0, 1]) o[`${k}@${t}`] = { src: `roads/${k}@${t}.webp`, scale: 1, anchor: [0.5, 0.914] }; return o; })(), // each colony's lamps in its colour (green's made from red's)
  ...files('roads', ['streetlamp-road-pool', 'streetlamp-asphalt-pool']),
  // The Pulse Turret's twin violet laser (6 frames of 512x64, stacked; points right, stretched to the
  // target) and the burst where it hits (6 frames of 128x128 in a row).
  'fx-pulse-laser': { src: 'effects/fx-pulse-laser.webp', frames: 6, cols: 1 },
  'fx-pulse-hit': { src: 'effects/fx-pulse-hit.webp', frames: 6, cols: 6 },
  // Its charge-up: for each of the 16 head directions, 8 frames (4 x 2) of the coils and barrel tips
  // lighting violet, on the head's canvas and anchor (barrel tips in PULSE_MUZZLES, art/emitters.js).
  ...Object.fromEntries([...Array(16).keys()].map((k) => [`turret-charge-${k}`, { ...B3D(`effects/turret-charge/turret-charge-${k}.webp`), frames: 8, cols: 4 }])),

  // Walls and Gates (renderer/walls): an electrified wall, each tile built up from layers on one canvas
  // (1.4 tiles, anchor [0.5, 0.615], no pad): the arms toward each joined neighbour (n, w, e, then s,
  // drawn round) a post, or on every other tile of a straight run a hub; a Gate is one image, across an
  // east-west wall (gate-ew, the road running north-south) or a north-south one, its barrier down or up.
  // Each piece has six spark frames (light, flickered over it now and then).
  ...WALL_ART,

  // Crash sites (renderer/b/wreck.js): the broken, burnt airframe an aircraft shot down leaves on the ground, one for
  // every team, seen straight down, nose right (the game turns it the way it came in). `scale`: the frame's width in
  // tiles, at the aircraft's own size (drawn by ambWreckArt, js/ambient.js).
  'wreck-cargoplane': { src: 'bots/wreck-cargoplane.webp', scale: 2.08 },
  'wreck-bomber': { src: 'bots/wreck-bomber.webp', scale: 1.38 },
  'wreck-airship': { src: 'bots/wreck-airship.webp', scale: 3.4 },

  // Still to make (placeholders are drawn until these exist):
  //   resources: crop, uranium          ground: fertile, slope, cliff     markers: missile, rally, oneway
  //   goods:     icon-fiber … icon-warhead (12 HUD icons)
};

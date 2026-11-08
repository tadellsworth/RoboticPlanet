'use strict';
/*
 * Botfall — game data. Balance tweaks (costs, timings, ranges) live here.
 */

const COLONY_MILESTONES = [0.1, 0.25, 0.4, 0.6, 0.8];  // share of land claimed
const SIM_STEP = 1 / 30;          // fixed simulation step, seconds
const MAX_BOTS = 90;              // per player (versus)
const MAX_BOTS_COLONY = 150;      // colony mode allows a bigger population
const MAX_SITES = 6;              // simultaneous construction sites per player
const ATTACK_RANGE = 14;          // tiles from a garrison to a target it can attack
const WORKER_SPEED = 2.0;         // tiles per second
const WARBOT_SPEED = 1.6; 
const ROAD_SPEED = 2.0;           // speed multiplier on paths
const ROAD_PREFERENCE = 0.85;     // route planning treats paths as this much cheaper again, so bots go out of their way to use them
const ROAD_COST = { stone: 1 };   // per path tile, taken from storage; refunded when a path is removed
const SLOPE_SPEED = 0.65;         // speed multiplier on an unpaved ramp
const STALK_GROW_TIME = 70;       // seconds for a planted stalk grove to mature

/*
 * Batteries (0–100). Bots drain while they move and work, and recharge inside a building with a
 * charger (the Lander or a Charging Station); warbots also recharge inside their garrison.
 * Below `low` a worker goes to recharge when it finishes its job; below `critical` a bot is in
 * emergency mode: it moves and works at `slow` speed and warbots hit half as hard.
 */
const BATTERY = {
  workerMove: 0.85, workerWork: 1.2, workerInside: 0.25,
  warbotMove: 0.5, warbotFight: 0.9, garrisonCharge: 4,
  low: 30, critical: 12, slow: 0.5,
};

// Terrain
const T_GROUND = 0, T_WATER = 1, T_ROCK = 2;

/* New-game map settings (each is a slider on the menu). */
const SIZE_PRESETS = [
  { name: 'Small', w: 30, h: 42 },
  { name: 'Medium', w: 40, h: 56 },
  { name: 'Large', w: 50, h: 70 },
  { name: 'Huge', w: 60, h: 84 },
];
/*   levels  elevation levels (1 = flat)       scale  size of hills (smaller = more cliffs)
 *   extra   chance of extra ramps per cliff  gap    min tiles between extra ramps
 *   rock    noise height where rocky crags start (lower = more crags) */
const TERRAIN_PRESETS = [
  { name: 'Flat', levels: 1, scale: 12, extra: 0, gap: 0, rock: 0.73 },
  { name: 'Gentle', levels: 2, scale: 14, extra: 0.5, gap: 6, rock: 0.71 },
  { name: 'Rolling', levels: 3, scale: 12, extra: 0.35, gap: 8, rock: 0.69 },
  { name: 'Rugged', levels: 4, scale: 13, extra: 0.22, gap: 10, rock: 0.67 },
  { name: 'Mountainous', levels: 5, scale: 14, extra: 0.1, gap: 13, rock: 0.65 },
];
/*   density  how many resource nodes   amount  how much each node holds */
const RESOURCE_PRESETS = [
  { name: 'Scarce', density: 0.55, amount: 0.6 },
  { name: 'Sparse', density: 0.78, amount: 0.8 },
  { name: 'Normal', density: 1, amount: 1 },
  { name: 'Rich', density: 1.3, amount: 1.3 },
  { name: 'Abundant', density: 1.65, amount: 1.7 },
];
const DEFAULT_SIZE = { versus: 1, colony: 3 };
const DEFAULT_ROUGH = 2;
const DEFAULT_RICH = 2;

// Resource nodes that sit on ground tiles
const R_NONE = 0, R_STALK = 1, R_BOULDER = 2, R_ORE = 3, R_CRYSTAL = 4;
const RES = {
  [R_STALK]:   { key: 'stalk',   name: 'Stalk grove',     good: 'fiber',   amount: 3, harvest: 2.5 },
  [R_BOULDER]: { key: 'boulder', name: 'Boulder',         good: 'stone',   amount: 6, harvest: 3 },
  [R_ORE]:     { key: 'ore',     name: 'Ore vein',        good: 'ore',     amount: 16, harvest: 3.5 },
  [R_CRYSTAL]: { key: 'crystal', name: 'Crystal cluster', good: 'crystal', amount: 12, harvest: 3.5 },
};

const GOODS = ['fiber', 'stone', 'ore', 'crystal', 'alloy', 'chip', 'warhead'];
const GOOD = {
  fiber:   { name: 'Fiber',   color: '#3fd8a6', desc: 'Cut from stalk groves. Used for building and as smelter fuel.' },
  stone:   { name: 'Stone',   color: '#c9c1b4', desc: 'Broken from boulders. The main building material.' },
  ore:     { name: 'Ore',     color: '#ff8a3d', desc: 'Dug from ore veins. Smelted into Alloy.' },
  crystal: { name: 'Crystal', color: '#b98cff', desc: 'Tapped from crystal clusters. Makes Chips and turret ammo.' },
  alloy:   { name: 'Alloy',   color: '#8ec3e6', desc: 'Smelted metal for advanced buildings, chips and bots.' },
  chip:    { name: 'Chip',    color: '#c8f05a', desc: 'Bot brains. Needed for every new bot.' },
  warhead: { name: 'Warhead', color: '#ffcf4a', desc: 'Made at a Munitions Works. Missile Silos fire them at enemy buildings.' },
};
/** Goods that only matter when there is a rival (hidden in Colony mode). */
const WAR_GOODS = ['warhead'];

const PLAYER_COLORS = ['#38d4ff', '#ff5a6e'];
const PLAYER_NAMES = ['You', 'Rival'];

/*
 * Building definitions.
 *   cost      materials delivered to the construction site
 *   staff     needs one worker inside to operate
 *   gather    resource type a staffed worker collects within `radius`
 *   plant     resource type a staffed worker plants within `radius`
 *   inp/make  production recipe: consumes inp, makes `make`, every `work` seconds
 *   out       output storage capacity per good
 *   store     acts as a warehouse (accepts and supplies every good)
 *   mil       military: claims territory of radius `terr` and garrisons warbots
 *   charger   bots inside recharge: `slots` bots at full `rate` (battery per second), more share it
 *   ammo      good delivered as ammunition (up to ammoCap)
 *   missile   launches missiles: range (tiles), reload (s), damage to buildings, splash radius,
 *             damage to bots in the splash
 *   war       only offered in Versus mode
 */
const BDEFS = {
  lander: {
    name: 'Lander', short: 'Lander',
    desc: 'Your landing craft and main base. Stores goods and houses idle bots. If it is captured, you lose.',
    store: true, mil: true, terr: 8, garrison: 40, armor: 30, charger: { slots: 3, rate: 15 },
  },
  harvester: {
    name: 'Harvester', desc: 'A worker cuts nearby stalk groves into Fiber.',
    cost: { fiber: 2, stone: 1 }, staff: true, gather: R_STALK, radius: 5, out: { fiber: 4 }, armor: 8, buildTime: 8,
  },
  quarry: {
    name: 'Quarry', desc: 'A worker breaks nearby boulders into Stone.',
    cost: { fiber: 2 }, staff: true, gather: R_BOULDER, radius: 5, out: { stone: 4 }, armor: 8, buildTime: 8,
  },
  mine: {
    name: 'Ore Mine', desc: 'A worker digs Ore from nearby veins.',
    cost: { fiber: 2, stone: 2 }, staff: true, gather: R_ORE, radius: 4, out: { ore: 4 }, armor: 8, buildTime: 10,
  },
  tap: {
    name: 'Crystal Tap', desc: 'A worker extracts Crystal from nearby clusters.',
    cost: { fiber: 2, stone: 2 }, staff: true, gather: R_CRYSTAL, radius: 4, out: { crystal: 4 }, armor: 8, buildTime: 10,
  },
  grower: {
    name: 'Grove Planter', desc: 'A worker plants new stalk groves nearby so Fiber never runs out.',
    cost: { fiber: 1, stone: 2 }, staff: true, plant: R_STALK, radius: 4, armor: 8, buildTime: 8,
  },
  smelter: {
    name: 'Smelter', desc: 'Burns Fiber to smelt Ore into Alloy.',
    cost: { stone: 3, fiber: 2 }, staff: true, inp: { ore: 1, fiber: 1 }, make: { alloy: 1 }, out: { alloy: 4 },
    work: 5, armor: 8, buildTime: 10,
  },
  fab: {
    name: 'Chip Fab', desc: 'Etches Crystal onto Alloy to make Chips.',
    cost: { stone: 2, alloy: 2 }, staff: true, inp: { crystal: 1, alloy: 1 }, make: { chip: 1 }, out: { chip: 4 },
    work: 5, armor: 8, buildTime: 10,
  },
  foundry: {
    name: 'Bot Foundry', desc: 'Assembles new Workers and Warbots from Alloy and Chips.',
    cost: { stone: 4, alloy: 3, chip: 1 }, staff: true, inp: { alloy: 1, chip: 1 }, bots: true,
    work: 8, armor: 10, buildTime: 14,
  },
  outpost: {
    name: 'Outpost', desc: 'Expands your territory and garrisons warbots for attack and defence.',
    cost: { stone: 4, fiber: 2 }, mil: true, terr: 6, garrison: 10, armor: 16, buildTime: 12,
  },
  turret: {
    name: 'Pulse Turret', desc: 'Shoots enemy bots in range. Uses Crystal as ammo (4 shots each).',
    cost: { stone: 2, alloy: 2 }, ammo: 'crystal', range: 5, armor: 12, buildTime: 10, war: true,
  },
  munitions: {
    name: 'Munitions Works', desc: 'Packs Alloy and Crystal into Warheads for Missile Silos.',
    cost: { stone: 3, alloy: 2, chip: 1 }, staff: true, inp: { alloy: 1, crystal: 1 }, make: { warhead: 1 },
    out: { warhead: 3 }, work: 9, armor: 10, buildTime: 12, war: true,
  },
  silo: {
    name: 'Missile Silo',
    desc: 'Fires missiles at enemy buildings far away. Missiles wreck smaller buildings and weaken Outposts and Landers so warbots can capture them. Uses Warheads.',
    cost: { stone: 4, alloy: 3, chip: 1 }, ammo: 'warhead', ammoCap: 2,
    missile: { range: 18, reload: 20, damage: 14, splash: 1.6, botDamage: 6 }, armor: 14, buildTime: 16, war: true,
  },
  charger: {
    name: 'Charging Station', desc: 'Bots recharge their batteries here, four at a time. Build them near busy areas far from your Lander.',
    cost: { stone: 3, alloy: 1 }, charger: { slots: 4, rate: 25 }, armor: 10, buildTime: 10,
  },
  ramp: {
    name: 'Ramp', desc: 'Workers cut a slope into a low cliff so bots can climb between levels. Place it at the foot or top of a cliff.',
    cost: { stone: 3, fiber: 1 }, ramp: true, armor: 4, buildTime: 10,
  },
  depot: {
    name: 'Depot', desc: 'Extra storage. Workers drop goods at the nearest storage, so depots shorten trips.',
    cost: { fiber: 3, stone: 2 }, store: true, armor: 10, buildTime: 8,
  },
};

/** Order of the build menu. */
const BUILD_MENU = ['harvester', 'quarry', 'mine', 'tap', 'smelter', 'fab', 'foundry', 'charger', 'outpost', 'turret',
  'munitions', 'silo', 'depot', 'ramp', 'grower'];

const INPUT_CAP = 3;   // how many of each input a production building stockpiles
const AMMO_CAP = 3;    // crystals a turret stockpiles
const SHOTS_PER_AMMO = 4;

const DIFFICULTY = {
  easy:   { label: 'Easy',   mult: 0.7,  grace: 330, threshold: 7, maxSites: 1, think: 3.0, bonus: 0 },
  normal: { label: 'Normal', mult: 1.0,  grace: 220, threshold: 5, maxSites: 2, think: 2.0, bonus: 0 },
  hard:   { label: 'Hard',   mult: 1.3,  grace: 150, threshold: 4, maxSites: 3, think: 1.5, bonus: 6 },
};

/** Starting goods in each Lander. */
const START_STOCK = { fiber: 16, stone: 16, alloy: 8, chip: 4, crystal: 4 };
const START_WORKERS = 14;
const START_WARBOTS = 4;
const MIN_FREE_WORKERS = 3;   // workers always kept free for hauling and building

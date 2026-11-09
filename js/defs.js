'use strict';
/*
 * Botfall — game data. Balance tweaks (costs, timings, ranges) live here.
 */

const COLONY_MILESTONES = [0.1, 0.25, 0.4, 0.6, 0.8];  // share of land claimed
const SIM_STEP = 1 / 30;          // fixed simulation step, seconds
const HIST_STEP = 15;             // seconds between statistics samples
const MAX_BOTS = 90;              // per player (versus)
const MAX_BOTS_COLONY = 150;      // colony mode allows a bigger population
const MAX_SITES = 6;              // simultaneous construction sites per player
const ATTACK_RANGE = 14;          // tiles from a garrison to a target it can attack
const WORKER_SPEED = 1.2;         // tiles per second off roads: bots are unhurried, so roads matter
const WARBOT_SPEED = 1.0;
const ROAD_PREFERENCE = 0.85;     // route planning treats paths as this much cheaper again, so bots go out of their way to use them
/*
 * Road surfaces (S.pave): roads are laid with Cement by painting them (refunded when removed);
 * a Roadworks' Paver upgrades them to asphalt using Asphalt. `speed` multiplies a bot's speed on
 * that tile; `cost` is per tile.
 */
const PAVE = [null,
  { key: 'road', name: 'Road', speed: 2.0, cost: { cement: 0.2 } },
  { key: 'asphalt', name: 'Asphalt road', speed: 2.75 },
];
const ASPHALT_TILES = 4;          // road tiles one Asphalt covers
const SLOPE_SPEED = 0.65;         // speed multiplier on an unpaved ramp
/*
 * One-way roads and traffic. A road tile in S.road is 1 (two-way) or 2–5 (one-way, pointing
 * east, south, west or north). Going the wrong way up a one-way road is allowed but crawls at
 * ONEWAY_WRONG speed, so bots plan around it.
 * On roads, bots queue: a bot never closes to within QUEUE_GAP tiles of the bot ahead of it going
 * the same way, so a slow or stopped bot backs up the ones behind it. On two-way roads each
 * direction keeps to its own side, and passing oncoming traffic slows both bots a little
 * (speed ÷ (1 + TRAFFIC_ONCOMING × oncoming)), so busy two-way roads back up while one-way loops
 * keep flowing. A bot stuck in a queue for QUEUE_PATIENCE seconds squeezes past, so traffic can
 * never lock up for good.
 */
const ROAD_DIRS = [null, null, [1, 0], [0, 1], [-1, 0], [0, -1]];
const ONEWAY_WRONG = 0.5;
const TRAFFIC_ONCOMING = 0.8;
const QUEUE_GAP = 0.6;
const QUEUE_PATIENCE = 6;
const LANE_OFFSET = 0.17;         // how far to the right of the centre line bots drive on two-way roads (drawing only)
const STALK_GROW_TIME = 70;       // seconds for a planted stalk grove to mature
const CROP_GROW_TIME = 45;        // seconds for a planted energy crop to ripen
const FUEL_ENERGY = 150;          // battery points one Fuel gives at a Charging Station (1.5 full charges)

/*
 * Batteries (0–100). Bots drain while they move and work, and recharge inside a building with a
 * charger (the Lander or a Charging Station); warbots also recharge inside their garrison.
 * Below `low` a worker goes to recharge when it finishes its job; below `critical` a bot is in
 * emergency mode: it moves and works at `slow` speed and warbots hit half as hard.
 */
const BATTERY = {
  workerMove: 0.52, workerWork: 1.2, workerInside: 0.25,
  warbotMove: 0.31, warbotFight: 0.9, garrisonCharge: 4,
  low: 30, critical: 12, slow: 0.5,
};

/*
 * Robot types. Workers build, haul and run ordinary buildings. Specialists:
 *   haul   can carry goods (carry = how many at once)   build  can build construction sites
 *   staff  can run ordinary buildings                    crew   the only bots that can run
 *                                                               buildings asking for this crew
 */
const BOTS = {
  worker:  { name: 'Worker', plural: 'Workers', speed: WORKER_SPEED, hp: 5, build: true, staff: true, carry: 1, offroad: true,
    desc: 'Runs buildings, gathers resources and builds construction sites. Slow off roads, except while out gathering.' },
  hauler:  { name: 'Hauler', plural: 'Haulers', speed: WORKER_SPEED * 1.25, hp: 5, haul: true, carry: 2, roadOnly: true,
    desc: 'Carries goods between buildings, two at a time. It only travels on roads, so every building needs a road to it.' },
  agribot: { name: 'Agribot', plural: 'Agribots', speed: WORKER_SPEED, hp: 5, crew: 'agribot', offroad: true,
    desc: 'A farm robot. Bio Farms and Grove Planters need one to run. Slow off roads, except while farming.' },
  paver:   { name: 'Paver', plural: 'Pavers', speed: WORKER_SPEED, hp: 6, crew: 'paver', offroad: true,
    desc: 'A road crew bot. A Roadworks needs one to lay asphalt on your roads.' },
  warbot:  { name: 'Warbot', plural: 'Warbots', speed: WARBOT_SPEED, hp: 12, war: true,
    desc: 'Fights enemy bots and captures enemy buildings. Shoots Ammo; with none it can only scuffle.' },
};
const BOT_ORDER = ['worker', 'hauler', 'agribot', 'paver', 'warbot'];

/*
 * Roads are the backbone. Haulers (the only bots that carry goods) can't leave the road; a hauler
 * caught off it crawls back at HAULER_STRANDED speed. Workers and other civilian bots move at
 * OFFROAD_SLOW of their speed off roads, except while out gathering, farming or paving.
 * Road junctions (a road tile with roads on three or four sides) slow bots to JUNCTION_SLOW and
 * make them give way to crossing traffic, unless a traffic light runs the junction: then one axis
 * at a time drives through at full speed. A light stays green at least LIGHT_MIN_GREEN seconds,
 * switches when traffic waits on the other axis (at the latest after LIGHT_MAX_GREEN), with
 * LIGHT_CLEAR seconds of all-red in between.
 */
const OFFROAD_SLOW = 0.4;
/** A road laid through boulders, groves, ore or crystal clears them and costs this many times more Cement. */
const ROAD_CLEAR = 3;
/**
 * Roads are planned (and paid for) at once, then free workers pave them: PAVE_TIME seconds per
 * tile, PAVE_CLEAR_TIME through resources. Crews start where the road network already reaches.
 */
const PAVE_TIME = 1.5;
const PAVE_CLEAR_TIME = 3;
/**
 * Safety net: a colony with less than SALVAGE_BELOW of Stone or Fiber and nothing able to make it
 * gets 1 every SALVAGE_EVERY seconds, salvaged from the Lander, so it can always rebuild.
 */
const SALVAGE_BELOW = 6;
const SALVAGE_EVERY = 20;
const HAULER_STRANDED = 0.25;
const JUNCTION_SLOW = 0.55;
const LIGHT_COST = { alloy: 1 };
const LIGHT_MIN_GREEN = 2;
const LIGHT_MAX_GREEN = 9;
const LIGHT_CLEAR = 0.45;

/* Warbot ammunition: each warbot holds WARBOT_AMMO shots and reloads in a garrison stocked with Ammo. */
const WARBOT_AMMO = 20;
const AMMO_SHOTS = 10;            // shots in one Ammo
const NO_AMMO_POWER = 0.35;       // how hard a warbot with no ammo hits
const WARBOT_RANGE = 1.2;         // tiles: how far a warbot shoots
const WARBOT_RANGE_BLOCKED = 2.2; // ...and across a building or cliff that stops it closing in

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
/*   density  how many resource fields   amount  how much each node holds */
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

// Resource nodes that sit on ground tiles. Energy crops are planted by a Bio Farm on fertile soil;
// oil seeps are pumped by an Oil Pump built on top of one.
const R_NONE = 0, R_STALK = 1, R_BOULDER = 2, R_ORE = 3, R_CRYSTAL = 4, R_CROP = 5, R_OIL = 6;
const RES = {
  [R_STALK]:   { key: 'stalk',   name: 'Stalk grove',     good: 'fiber',   amount: 3, harvest: 2.5 },
  [R_BOULDER]: { key: 'boulder', name: 'Boulder',         good: 'stone',   amount: 8, harvest: 3 },
  [R_ORE]:     { key: 'ore',     name: 'Ore vein',        good: 'ore',     amount: 16, harvest: 3.5 },
  [R_CRYSTAL]: { key: 'crystal', name: 'Crystal cluster', good: 'crystal', amount: 12, harvest: 3.5 },
  [R_CROP]:    { key: 'crop',    name: 'Energy crop',     good: 'fuel',    amount: 1, harvest: 2.5 },
  [R_OIL]:     { key: 'oil',     name: 'Oil seep',        good: 'crude',   amount: 24, harvest: 0 },
};

const GOODS = ['fiber', 'stone', 'ore', 'crystal', 'alloy', 'chip', 'crude', 'fuel', 'cement', 'asphalt', 'ammo', 'warhead'];
const GOOD = {
  fiber:   { name: 'Fiber',   color: '#3fd8a6', desc: 'Cut from stalk groves. Used for building and as smelter fuel.' },
  stone:   { name: 'Stone',   color: '#c9c1b4', desc: 'Broken from boulders. A Cement Works turns it into Cement; Asphalt and Ammo use it too.' },
  ore:     { name: 'Ore',     color: '#ff8a3d', desc: 'Dug from ore veins. Smelted into Alloy.' },
  crystal: { name: 'Crystal', color: '#b98cff', desc: 'Tapped from crystal clusters. Makes Chips and turret ammo.' },
  alloy:   { name: 'Alloy',   color: '#8ec3e6', desc: 'Smelted metal for advanced buildings, chips and bots.' },
  chip:    { name: 'Chip',    color: '#c8f05a', desc: 'Bot brains. Needed for every new bot.' },
  crude:   { name: 'Crude',   color: '#b08a6e', desc: 'Crude oil from an Oil Pump. A Refinery turns it into Fuel.' },
  fuel:    { name: 'Fuel',    color: '#ff5c8a', desc: 'Energy for Charging Stations. Grown at a Bio Farm or refined from Crude.' },
  cement:  { name: 'Cement',  color: '#a9b4c2', desc: 'The main building material, made from Stone at a Cement Works (2 per Stone). Builds nearly everything and paves roads: 1 Cement for 5 tiles.' },
  asphalt: { name: 'Asphalt', color: '#6b7280', desc: 'Made from Crude and Stone. A Roadworks upgrades roads with it to asphalt, the fastest surface.' },
  ammo:    { name: 'Ammo',    color: '#e8c39e', desc: 'Made at an Ammo Plant. Warbots reload it in your Lander and Outposts.' },
  warhead: { name: 'Missile', color: '#ffcf4a', desc: 'Built at a Missile Factory from Alloy, Chips and Fuel. Workers load them into Missile Silos, which fire them at rival buildings.' },
};
/** Goods that only matter when there is a rival (hidden in Colony mode). */
const WAR_GOODS = ['ammo', 'warhead'];

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
 *   charger   bots inside recharge: `slots` bots at full `rate` (battery per second), more share it;
 *             with `fuel` it burns Fuel (FUEL_ENERGY battery points each, stockpiles up to fuelCap)
 *   farm      plants energy crops on fertile soil within `radius` and harvests them into Fuel
 *   pump      built on an oil seep; its worker pumps Crude from seep tiles within 1 tile
 *   crew      only bots of this crew (see BOTS) can run it
 *   roadworks its Paver lays asphalt on paths within `radius`
 *   ammoStock (Lander, Outposts) Ammo kept for warbots to reload
 *   ammo      good delivered as ammunition (up to ammoCap)
 *   missile   launches missiles: range (tiles), reload (s), damage to the target, splash radius,
 *             damage to other buildings and to bots in the splash
 *   war       only offered in Versus mode
 *   limit     default stock limit: it stops making its product once you have this many (players
 *             can change it per building)
 */
const BDEFS = {
  lander: {
    name: 'Lander', short: 'Lander',
    desc: 'Your landing craft and main base. Stores goods and houses idle bots. If it is captured, you lose.',
    store: true, mil: true, terr: 8, garrison: 40, armor: 30, charger: { slots: 3, rate: 15 }, ammoStock: 10,
  },
  harvester: {
    name: 'Harvester', desc: 'A worker cuts nearby stalk groves into Fiber.',
    cost: { fiber: 2, cement: 1 }, staff: true, gather: R_STALK, radius: 5, out: { fiber: 4 }, armor: 8, buildTime: 8,
  },
  quarry: {
    name: 'Quarry', desc: 'A worker breaks nearby boulders into Stone.',
    cost: { fiber: 2 }, staff: true, gather: R_BOULDER, radius: 5, out: { stone: 4 }, armor: 8, buildTime: 8,
  },
  mine: {
    name: 'Ore Mine', desc: 'A worker digs Ore from nearby veins.',
    cost: { fiber: 2, cement: 2 }, staff: true, gather: R_ORE, radius: 4, out: { ore: 4 }, armor: 8, buildTime: 10,
  },
  tap: {
    name: 'Crystal Tap', desc: 'A worker extracts Crystal from nearby clusters.',
    cost: { fiber: 2, cement: 2 }, staff: true, gather: R_CRYSTAL, radius: 4, out: { crystal: 4 }, armor: 8, buildTime: 10,
  },
  grower: {
    name: 'Grove Planter', desc: 'A worker plants new stalk groves nearby so Fiber never runs out.',
    cost: { fiber: 1, cement: 2 }, staff: true, crew: 'agribot', plant: R_STALK, radius: 4, armor: 8, buildTime: 8,
  },
  smelter: {
    name: 'Smelter', desc: 'Burns Fiber to smelt Ore into Alloy.',
    cost: { cement: 3, fiber: 2 }, staff: true, inp: { ore: 1, fiber: 1 }, make: { alloy: 1 }, out: { alloy: 4 },
    work: 5, armor: 8, buildTime: 10,
  },
  fab: {
    name: 'Chip Fab', desc: 'Etches Crystal onto Alloy to make Chips.',
    cost: { cement: 2, alloy: 2 }, staff: true, inp: { crystal: 1, alloy: 1 }, make: { chip: 1 }, out: { chip: 4 },
    work: 5, armor: 8, buildTime: 10,
  },
  foundry: {
    name: 'Bot Foundry', desc: 'Assembles new Workers and Warbots from Alloy and Chips.',
    cost: { cement: 4, alloy: 3, chip: 1 }, staff: true, inp: { alloy: 1, chip: 1 }, bots: true,
    work: 8, armor: 10, buildTime: 14,
  },
  outpost: {
    name: 'Outpost', desc: 'Expands your territory and garrisons warbots for attack and defence.',
    cost: { cement: 4, fiber: 2 }, mil: true, terr: 7, garrison: 10, armor: 16, buildTime: 12, ammoStock: 6,
  },
  turret: {
    name: 'Pulse Turret', desc: 'Shoots enemy bots in range. Uses Crystal as ammo (4 shots each).',
    cost: { cement: 2, alloy: 2 }, ammo: 'crystal', range: 5, armor: 12, buildTime: 10, war: true,
  },
  kiln: {
    name: 'Cement Works', desc: 'Bakes Stone into Cement, the material nearly every building and road is made of: 2 Cement from each Stone. Costs raw Stone itself, so you can always build one.',
    cost: { stone: 4, fiber: 2 }, staff: true, inp: { stone: 1 }, make: { cement: 2 }, out: { cement: 6 },
    work: 5, armor: 10, buildTime: 10, limit: 40,
  },
  tarworks: {
    name: 'Asphalt Plant', desc: 'Cooks Crude and Stone into Asphalt for the fastest roads.',
    cost: { cement: 3, alloy: 2 }, staff: true, inp: { crude: 1, stone: 1 }, make: { asphalt: 2 }, out: { asphalt: 4 },
    work: 7, armor: 10, buildTime: 12, limit: 20,
  },
  roadworks: {
    name: 'Roadworks', desc: 'Its Paver upgrades your roads nearby to asphalt, the fastest surface. One Asphalt covers four tiles.',
    cost: { cement: 3, alloy: 1, fiber: 2 }, staff: true, crew: 'paver', roadworks: true, radius: 7, armor: 8, buildTime: 10,
  },
  armory: {
    name: 'Ammo Plant', desc: 'Packs Alloy and Stone into Ammo. Haulers take it to your Lander and Outposts, where warbots reload.',
    cost: { cement: 3, alloy: 2 }, staff: true, inp: { alloy: 1, stone: 1 }, make: { ammo: 3 }, out: { ammo: 6 },
    work: 6, armor: 10, buildTime: 10, war: true,
  },
  munitions: {
    name: 'Missile Factory', desc: 'Builds Missiles from 2 Alloy, 1 Chip and 1 Fuel each. They are slow and costly to make; haulers carry them to your Missile Silos.',
    cost: { cement: 4, alloy: 4, chip: 2 }, staff: true, inp: { alloy: 2, chip: 1, fuel: 1 }, make: { warhead: 1 },
    out: { warhead: 2 }, work: 20, armor: 10, buildTime: 14, war: true,
  },
  silo: {
    name: 'Missile Silo',
    desc: 'Fires Missiles from a Missile Factory at rival buildings far away. A hit wrecks most buildings outright, damages the buildings and bots around it, and knocks Outposts and Landers down so warbots can capture them. Holds two Missiles.',
    cost: { cement: 5, alloy: 4, chip: 2 }, ammo: 'warhead', ammoCap: 2,
    missile: { range: 18, reload: 25, damage: 24, splash: 2.2, splashDamage: 5, botDamage: 9 }, armor: 14, buildTime: 16, war: true,
  },
  charger: {
    name: 'Charging Station',
    desc: 'Bots recharge their batteries here, four at a time. It burns Fuel: one Fuel recharges about one and a half batteries. Build them near busy areas far from your Lander.',
    cost: { cement: 3, alloy: 1 }, charger: { slots: 4, rate: 25, fuel: true }, fuelCap: 4, armor: 10, buildTime: 10,
  },
  farm: {
    name: 'Bio Farm', desc: 'A worker plants energy crops on fertile soil nearby and harvests them into Fuel. Crops take a while to ripen.',
    cost: { fiber: 2, cement: 2 }, staff: true, crew: 'agribot', farm: true, radius: 3, out: { fuel: 4 }, armor: 8, buildTime: 9,
  },
  pump: {
    name: 'Oil Pump', desc: 'Built on top of an oil seep. Its worker pumps Crude until the seep runs dry.',
    cost: { cement: 2, alloy: 2 }, staff: true, pump: true, inp: {}, make: { crude: 1 }, out: { crude: 4 },
    work: 5, armor: 8, buildTime: 10,
  },
  refinery: {
    name: 'Refinery', desc: 'Refines Crude into Fuel: two Fuel from every Crude.',
    cost: { cement: 4, alloy: 3 }, staff: true, inp: { crude: 1 }, make: { fuel: 2 }, out: { fuel: 4 },
    work: 6, armor: 10, buildTime: 12,
  },
  ramp: {
    name: 'Ramp', desc: 'Workers cut a slope into a low cliff so bots can climb between levels. Place it at the foot or top of a cliff.',
    cost: { cement: 3, fiber: 1 }, ramp: true, armor: 4, buildTime: 10,
  },
  depot: {
    name: 'Depot', desc: 'Extra storage. Haulers drop goods at the nearest storage they can reach by road, so depots along your highways shorten trips.',
    cost: { fiber: 3, cement: 2 }, store: true, armor: 10, buildTime: 8,
  },
};

/** Order of the build menu. */
const BUILD_MENU = ['harvester', 'quarry', 'mine', 'tap', 'smelter', 'fab', 'foundry', 'charger', 'farm', 'pump', 'refinery',
  'kiln', 'tarworks', 'roadworks', 'outpost', 'turret', 'armory', 'munitions', 'silo', 'depot', 'ramp', 'grower'];

const INPUT_CAP = 3;   // how many of each input a production building stockpiles
const AMMO_CAP = 3;    // crystals a turret stockpiles
const TURRET_TURN = 2.4;   // radians per second a turret's head turns (about 140°)
const TURRET_SWEEP = 0.35; // radians per second it sweeps while watching for targets
const SHOTS_PER_AMMO = 4;

const DIFFICULTY = {
  easy:   { label: 'Easy',   mult: 0.7,  grace: 330, threshold: 7, maxSites: 1, think: 3.0, bonus: 0 },
  normal: { label: 'Normal', mult: 1.0,  grace: 220, threshold: 5, maxSites: 2, think: 2.0, bonus: 0 },
  hard:   { label: 'Hard',   mult: 1.3,  grace: 150, threshold: 4, maxSites: 3, think: 1.5, bonus: 6 },
};

/** Starting goods in each Lander. */
const START_STOCK = { fiber: 16, stone: 8, alloy: 8, chip: 4, crystal: 4, fuel: 4, cement: 24 };
const START_BOTS = { worker: 10, hauler: 5, agribot: 1 };
const START_WARBOTS = 4;
const MIN_FREE_WORKERS = 2;   // workers always kept free for building

'use strict';
/*
 * Botfall — game data. Balance tweaks (costs, timings, ranges) live here.
 */

const MAP_W = 40;                // versus map size, in tiles
const MAP_H = 56;
const COLONY_W = 60;             // colony mode map size
const COLONY_H = 84;
const COLONY_MILESTONES = [0.1, 0.25, 0.4, 0.6, 0.8];  // share of land claimed
const SIM_STEP = 1 / 30;          // fixed simulation step, seconds
const MAX_BOTS = 90;              // per player (versus)
const MAX_BOTS_COLONY = 150;      // colony mode allows a bigger population
const MAX_SITES = 6;              // simultaneous construction sites per player
const ATTACK_RANGE = 14;          // tiles from a garrison to a target it can attack
const WORKER_SPEED = 2.0;         // tiles per second
const WARBOT_SPEED = 1.6; 
const ROAD_SPEED = 1.8;           // speed multiplier on paths
const STALK_GROW_TIME = 70;       // seconds for a planted stalk grove to mature

// Terrain
const T_GROUND = 0, T_WATER = 1, T_ROCK = 2;

// Resource nodes that sit on ground tiles
const R_NONE = 0, R_STALK = 1, R_BOULDER = 2, R_ORE = 3, R_CRYSTAL = 4;
const RES = {
  [R_STALK]:   { key: 'stalk',   name: 'Stalk grove',     good: 'fiber',   amount: 3, harvest: 2.5 },
  [R_BOULDER]: { key: 'boulder', name: 'Boulder',         good: 'stone',   amount: 6, harvest: 3 },
  [R_ORE]:     { key: 'ore',     name: 'Ore vein',        good: 'ore',     amount: 16, harvest: 3.5 },
  [R_CRYSTAL]: { key: 'crystal', name: 'Crystal cluster', good: 'crystal', amount: 12, harvest: 3.5 },
};

const GOODS = ['fiber', 'stone', 'ore', 'crystal', 'alloy', 'chip'];
const GOOD = {
  fiber:   { name: 'Fiber',   color: '#3fd8a6', desc: 'Cut from stalk groves. Used for building and as smelter fuel.' },
  stone:   { name: 'Stone',   color: '#c9c1b4', desc: 'Broken from boulders. The main building material.' },
  ore:     { name: 'Ore',     color: '#ff8a3d', desc: 'Dug from ore veins. Smelted into Alloy.' },
  crystal: { name: 'Crystal', color: '#b98cff', desc: 'Tapped from crystal clusters. Makes Chips and turret ammo.' },
  alloy:   { name: 'Alloy',   color: '#8ec3e6', desc: 'Smelted metal for advanced buildings, chips and bots.' },
  chip:    { name: 'Chip',    color: '#c8f05a', desc: 'Bot brains. Needed for every new bot.' },
};

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
 */
const BDEFS = {
  lander: {
    name: 'Lander', short: 'Lander',
    desc: 'Your landing craft and main base. Stores goods and houses idle bots. If it is captured, you lose.',
    store: true, mil: true, terr: 8, garrison: 40, armor: 30,
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
    cost: { stone: 2, alloy: 2 }, ammo: 'crystal', range: 5, armor: 12, buildTime: 10,
  },
  depot: {
    name: 'Depot', desc: 'Extra storage. Workers drop goods at the nearest storage, so depots shorten trips.',
    cost: { fiber: 3, stone: 2 }, store: true, armor: 10, buildTime: 8,
  },
};

/** Order of the build menu. */
const BUILD_MENU = ['harvester', 'quarry', 'mine', 'tap', 'smelter', 'fab', 'foundry', 'outpost', 'turret', 'depot', 'grower'];

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

'use strict';
/*
 * Terrafall — game data. Balance tweaks (costs, timings, ranges) live here.
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
/**
 * Biomes: the look of the planet, chosen on the new-game screen. Purely cosmetic: ground, water,
 * rock and decorative plants (`plants` is the share of open tiles with one). Plants never block
 * anything; a road, planned road or building clears the plants on its tile.
 */
const BIOMES = {
  desert: { name: 'Red desert', plants: 0.07 },
  jungle: { name: 'Jungle', plants: 0.34 },
  polar: { name: 'Polar', plants: 0.1 },
};
const BIOME_ORDER = ['desert', 'jungle', 'polar'];
const PLANT_KINDS = 6; // decorative plant varieties per biome

const ASPHALT_TILES = 4;          // road tiles one Asphalt covers
// Asphalt wears with traffic: every bot driving onto a tile adds wear (per mille), heavy Freight
// Trucks three times as much. Past half worn it slows bots a little, at REPAVE_AT a Roadworks
// resurfaces it, and worn right through it drops back to plain road.
const WEAR_BOT = 1, WEAR_TRUCK = 3;
const WEAR_SLOW = 500;            // wear where asphalt starts to slow bots
const WEAR_WORN_SPEED = 2.3;      // asphalt speed when it's about to wear through (fresh: 2.75)
const REPAVE_AT = 500;            // wear at which a Paver resurfaces a tile
const WEAR_MAX = 1000;            // worn through: back to plain road
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
/** Traffic map: bot-seconds a minute on a road tile that show as packed (red), and seconds a minute of standing still that mark a jam. */
const TRAFFIC_BUSY = 25;
const TRAFFIC_JAM = 6;
const LANE_OFFSET = 0.17;         // how far to the right of the centre line bots drive on two-way roads (drawing only)
const STALK_GROW_TIME = 70;       // seconds for a planted stalk grove to mature
const CROP_GROW_TIME = 45;        // seconds for a planted energy crop to ripen
/**
 * The whole game runs at this fraction of real time: everything (bots, building, production,
 * combat, the rival) moves 15% slower than its raw numbers, for a calmer pace than an RTS.
 */
const GAME_PACE = 0.85;
/**
 * Repairs (Versus). Robots get fixed at a Repair Station: one Alloy restores REPAIR_HP_PER_ALLOY
 * health. Buildings don't mend on their own: Repair sends a worker with Cement, one Cement per
 * ARMOR_PER_CEMENT armor, restoring FIX_RATE armor a second. Robots look for repairs below these
 * shares of their health (warbots only while their garrison is quiet).
 */
const REPAIR_HP_PER_ALLOY = 12;
const ARMOR_PER_CEMENT = 6;
const FIX_RATE = 2;
const REPAIR_BELOW = { warbot: 0.7, other: 0.6 };
const FUEL_ENERGY = 250;          // battery points one Fuel gives at a Charging Station (2½ full charges)

/*
 * Batteries (0–100). Bots drain while they move and work, and recharge inside a building with a
 * charger (the Command Base or a Charging Station); warbots also recharge inside their garrison.
 * Below `low` a worker goes to recharge when it finishes its job; below `critical` a bot is in
 * emergency mode: it moves and works at `slow` speed and warbots hit half as hard.
 */
const BATTERY = {
  workerMove: 0.52, workerWork: 1.2, workerInside: 0.25,
  warbotMove: 0.31, warbotFight: 0.9, garrisonCharge: 4,
  // A warbot standing about in enemy land (not moving or fighting) for more than waitGrace seconds
  // runs its battery down at warbotWait a second, so it has to go home to recharge before long.
  warbotWait: 0.8, waitGrace: 15,
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
  truck:   { name: 'Freight Truck', plural: 'Freight Trucks', speed: WORKER_SPEED * 1.35, hp: 8, haul: true, truck: true, carry: 8, roadOnly: true, parts: 2, accel: 1.5, brake: 3.5,
    desc: 'A heavy road truck that carries eight goods at once on the long runs: between your Command Base and Depots, and to anything far away. Slower than a Hauler on concrete, fastest of all on asphalt.' },
  warbot:  { name: 'Warbot', plural: 'Warbots', speed: WARBOT_SPEED, hp: 12, war: true,
    desc: 'Fights enemy bots and captures enemy buildings. Shoots Ammo; with none it can only scuffle.' },
};
const BOT_ORDER = ['worker', 'hauler', 'truck', 'agribot', 'paver', 'warbot'];
/*
 * Freight trucks take the long runs: storage to storage (filling a Depot's supply orders, or
 * emptying a store), and deliveries of TRUCK_MIN_LOAD or more goods from storage to anything
 * TRUCK_MIN_DIST tiles or more away. Haulers do everything else, and the long runs when every truck
 * is busy. Trucks are heavy: on concrete they go at TRUCK_ROAD of their speed; asphalt is full speed.
 * A Depot's supply orders (b.keep) ask for goods to be kept there, up to KEEP_MAX of each.
 */
const TRUCK_MIN_DIST = 12;
const TRUCK_MIN_LOAD = 3;
const TRUCK_ROAD = 0.8;
/**
 * Driving: bots speed up at BOT_ACCEL tiles/s² and brake at up to BOT_BRAKE, slowing to BOT_CORNER of
 * their speed for a corner. Trucks are heavier: they set their own accel and brake and slow to
 * TRUCK_CORNER for corners.
 */
const BOT_ACCEL = 4.5;
const BOT_BRAKE = 8;
const BOT_CORNER = 0.6;
const TRUCK_CORNER = 0.42;
const KEEP_MAX = 60;

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
 * gets 1 every SALVAGE_EVERY seconds, salvaged from the Command Base, so it can always rebuild.
 */
const SALVAGE_BELOW = 6;
const SALVAGE_EVERY = 20;
const HAULER_STRANDED = 0.25;
const JUNCTION_SLOW = 0.55;
const LIGHT_COST = { alloy: 1 };
/** An overpass lifts one road over the other at a junction: nobody slows down or gives way there. */
const OVERPASS_COST = { cement: 4, alloy: 3 };
const LIGHT_MIN_GREEN = 2;
const LIGHT_MAX_GREEN = 9;
const LIGHT_CLEAR = 0.45;

/* Warbot ammunition: each warbot holds WARBOT_AMMO shots and reloads in a garrison stocked with Ammo. */
const WARBOT_AMMO = 10;      // a full load: two Ammo's worth, so warbots go back to reload often
const AMMO_SHOTS = 5;             // shots in one Ammo
// A warbot with no ammo can't fight at all: it leaves the fight and goes back to reload.
/**
 * Raiding: armed warbots holding a rally flag in enemy land, with nothing there to fight, tear up the
 * enemy's roads within SABOTAGE_RANGE tiles of the flag: one tile per SABOTAGE_WORK warbot-seconds.
 * A missile also wrecks the roads within MISSILE_ROAD tiles of where it lands.
 */
const SABOTAGE_RANGE = 2.5;
const SABOTAGE_WORK = 12;
const MISSILE_ROAD = 1.5;
const WARBOT_RANGE = 1.2;         // tiles: how far a warbot shoots
const WARBOT_RANGE_BLOCKED = 2.2; // ...and across a building or cliff that stops it closing in

// Terrain
const T_GROUND = 0, T_WATER = 1, T_ROCK = 2;
/**
 * Bridges and tunnels: a road over water is a bridge, a road through rocky crags a tunnel. Each tile
 * costs `cost` instead of road Cement, and workers take `time` seconds to build it, working out from
 * the shore (or the rock face). They join tiles on any level, and route planning only uses them when
 * the way round is longer than about `weight` road tiles.
 */
const CROSS = {
  [T_WATER]: { key: 'bridge', name: 'Bridge', cost: { cement: 2, alloy: 1 }, time: 6, weight: 14 },
  [T_ROCK]: { key: 'tunnel', name: 'Tunnel', cost: { cement: 3, alloy: 1 }, time: 8, weight: 18 },
};

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
/* Map shape: a Long haul map is narrower and much longer, with the bases far apart. */
const SHAPE_PRESETS = [
  { name: 'Standard', w: 1, h: 1, ffa: true },
  { name: 'Long haul', w: 0.75, h: 1.7 },
  { name: 'Chokepoint', w: 1, h: 1, choke: true, tip: 'Chokepoint: a single pass through the crags joins the two halves of the planet. Hold it: an Outpost nearby, then walls and turrets (Paths, Walls).' },
  { name: 'Islands', w: 1.15, h: 1.45, islands: true, ffa: true, tip: 'Islands: the only way across is bridges. Push an Outpost out to your shore, then build a bridge in Paths (Bridges): it can reach out past your border.' },
  { name: 'Crater', w: 1, h: 1, crater: true, minLevels: 3, ffa: true, tip: 'Crater: the richest fields lie on the crater floor in the middle. One ramp leads down on your side; cut more in Paths (Ramps).' },
  { name: 'Plateaus', w: 1, h: 1, plateau: true, minLevels: 3, ffa: true, tip: 'Plateaus: your base stands on high ground with only two slopes down. Easy to hold: wall the slopes and push out.' },
];
const CHOKE_BAND = 3;   // Chokepoint maps: rows of crags each side of the middle line
const CHOKE_APPROACH = 3; // ...and rows of open ground kept clear each side of the pass
const ISLE_GAP = 2.5;     // Islands maps: at least this much sea between islands
const LOOT_MAX = 60;      // most crates a wrecked building spills
const LOOT_TIME = 300;    // seconds a loot pile lies before it rots away
// Walls and Gates: an enemy warbot plans a route through one as if it were this many extra tiles
// long, plus one per point of armor left, so it walks round a short way and breaks through a long one.
const BREACH_COST = 8;
const BREACH_PER_ARMOR = 1;
const DEFAULT_SIZE = { versus: 1, colony: 3 };
const DEFAULT_ROUGH = 2;
const DEFAULT_RICH = 2;

// Resource nodes that sit on ground tiles. Energy crops are planted by a Bio Farm on fertile soil;
// oil seeps are pumped by an Oil Pump built on top of one.
const R_NONE = 0, R_STALK = 1, R_BOULDER = 2, R_ORE = 3, R_CRYSTAL = 4, R_CROP = 5, R_OIL = 6, R_URANIUM = 7;
const RES = {
  [R_STALK]:   { key: 'stalk',   name: 'Stalk grove',     good: 'fiber',   amount: 3, harvest: 2.5 },
  [R_BOULDER]: { key: 'boulder', name: 'Boulder',         good: 'stone',   amount: 8, harvest: 3 },
  [R_ORE]:     { key: 'ore',     name: 'Ore vein',        good: 'ore',     amount: 24, harvest: 3.5 },
  [R_CRYSTAL]: { key: 'crystal', name: 'Crystal cluster', good: 'crystal', amount: 12, harvest: 3.5 },
  [R_CROP]:    { key: 'crop',    name: 'Energy crop',     good: 'fuel',    amount: 1, harvest: 2.5 },
  [R_OIL]:     { key: 'oil',     name: 'Oil seep',        good: 'crude',   amount: 16, harvest: 0 },
  [R_URANIUM]: { key: 'uranium', name: 'Uranium deposit', good: 'uranium', amount: 4, harvest: 5 },
};

/**
 * Deposits get richer away from the bases: boulders, ore, crystal and oil hold up to 1 + FRONTIER_RICH
 * times as much out in the middle of the map, starting RICH_FROM tiles from a base. A node holding
 * RICH_MARK times its usual amount shows as a rich deposit.
 */
const FRONTIER_RICH = 1.2;
const RICH_FROM = 10;
const RICH_MARK = 1.4;
const RICH_TYPES = [R_BOULDER, R_ORE, R_CRYSTAL, R_OIL];

const GOODS = ['fiber', 'stone', 'ore', 'crystal', 'alloy', 'chip', 'crude', 'fuel', 'cement', 'asphalt', 'ammo', 'warhead', 'uranium', 'fissile'];
const GOOD = {
  fiber:   { name: 'Fiber',   color: '#3fd8a6', desc: 'Cut from stalk groves. Used for building and as smelter fuel.' },
  stone:   { name: 'Stone',   color: '#c9c1b4', desc: 'Broken from boulders. A Cement Works turns it into Cement (2 per Stone): that is its only use.' },
  ore:     { name: 'Ore',     color: '#ff8a3d', desc: 'Dug from ore veins. Smelted into Alloy.' },
  crystal: { name: 'Crystal', color: '#b98cff', desc: 'Tapped from crystal clusters. Makes Chips and turret ammo.' },
  alloy:   { name: 'Alloy',   color: '#8ec3e6', desc: 'Smelted metal for advanced buildings, chips and bots.' },
  chip:    { name: 'Chip',    color: '#c8f05a', desc: 'Bot brains. Needed for every new bot.' },
  crude:   { name: 'Crude',   color: '#b08a6e', desc: 'Crude oil from an Oil Pump. A Refinery turns it into Fuel.' },
  fuel:    { name: 'Fuel',    color: '#ff5c8a', desc: 'Energy for Charging Stations. Grown at a Bio Farm or refined from Crude.' },
  cement:  { name: 'Cement',  color: '#a9b4c2', desc: 'The main building material, made from Stone at a Cement Works (2 per Stone). Builds nearly everything and paves roads: 1 Cement for 5 tiles.' },
  asphalt: { name: 'Asphalt', color: '#6b7280', desc: 'Made from Crude and Stone. A Roadworks upgrades roads with it to asphalt, the fastest surface.' },
  ammo:    { name: 'Ammo',    color: '#e8c39e', desc: 'Made at an Ammo Plant. Warbots reload it in your Command Base and Outposts.' },
  warhead: { name: 'Missile', color: '#ffcf4a', desc: 'Built at a Missile Factory from Alloy, Chips and Fuel. Workers load them into Missile Silos, which fire them at rival buildings.' },
  uranium: { name: 'Uranium', color: '#9dff3a', desc: 'Scarce radioactive ore (Nuclear race only). Ore Mines dig it from the few deposits on the planet; a Nuclear Reactor enriches it.' },
  fissile: { name: 'Enriched Uranium', color: '#e6ff4a', desc: 'Made from 2 Uranium at a Nuclear Reactor. A Nuclear Silo needs 6 to build a nuclear missile.' },
};
/** Goods that only matter when there is a rival (hidden in Colony mode), and in a Nuclear race. */
const WAR_GOODS = ['ammo', 'warhead'];
const NUKE_GOODS = ['uranium', 'fissile'];
/**
 * The Nuclear race (an optional Versus setting): a little uranium is sprinkled over the planet,
 * URANIUM_DEPOSITS deposits on each side, out towards the middle. A Nuclear Reactor enriches it and a
 * Nuclear Silo builds a nuclear missile from NUKE.parts (6 Enriched Uranium = 12 Uranium), which flies
 * for NUKE.flight seconds (the target gets that long as a warning) and wipes out everything within
 * NUKE.radius tiles. The ground there stays scorched (no building or roads) for NUKE.scorch seconds.
 * A Command Base in the blast is left with almost no armor and no garrison, ready to be captured.
 */
const URANIUM_DEPOSITS = 6;
const NUKE = { parts: { fissile: 6, alloy: 4, chip: 2 }, assemble: 60, range: 40, flight: 30, radius: 6, scorch: 240 };

const PLAYER_COLORS = ['#38d4ff', '#ff5a6e', '#5be06c'];
const PLAYER_NAMES = ['You', 'Rival'];
/**
 * What to call player p. Label: 'You', 'Rival' (two players), 'Red rival' or 'Green rival' (three).
 * In a sentence (the = true): 'you', 'the rival', 'the Red rival', 'the Green rival'.
 */
function playerName(p, the) {
  if (p === 0) return the ? 'you' : 'You';
  const three = typeof S !== 'undefined' && S && S.players && S.players.length > 2;
  const n = three ? ['', 'Red', 'Green'][p] + ' rival' : the ? 'rival' : 'Rival';
  return the ? 'the ' + n : n;
}

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
 *   roadworks its Paver lays asphalt on any road joined to it, nearest first
 *   ammoStock (Command Base, Outposts) Ammo kept for warbots to reload
 *   ammo      good delivered as ammunition (up to ammoCap)
 *   missile   launches missiles: range (tiles), reload (s), damage to the target, splash radius,
 *             damage to other buildings and to bots in the splash
 *   war       only offered in Versus mode
 *   barrier   a Wall or Gate: blocks enemy bots, which break through it (see BREACH_COST); `gate`
 *             lets its owner's bots through and carries a road
 *   prepaid   its materials are taken from storage when it is planned (no Hauler needed) and it
 *             doesn't count toward MAX_SITES
 *   limit     default stock limit: it stops making its product once you have this many (players
 *             can change it per building)
 */
const BDEFS = {
  lander: {
    name: 'Command Base', short: 'Base',
    desc: 'Your fortified headquarters: the craft that brought the colony down, dug in and walled up. Stores goods and houses idle bots, but it does not charge them: that takes Charging Stations. If it is captured, you lose.',
    store: true, mil: true, terr: 8, garrison: 40, armor: 30, ammoStock: 10,
  },
  harvester: {
    name: 'Harvester', desc: 'A worker cuts nearby stalk groves into Fiber.',
    cost: { fiber: 2, cement: 1 }, staff: true, gather: R_STALK, radius: 5, out: { fiber: 6 }, armor: 8, buildTime: 8,
  },
  quarry: {
    name: 'Quarry', desc: 'A worker breaks nearby boulders into Stone.',
    cost: { fiber: 2 }, staff: true, gather: R_BOULDER, radius: 5, out: { stone: 6 }, armor: 8, buildTime: 8,
  },
  mine: {
    name: 'Ore Mine', desc: 'A worker digs Ore from nearby veins.',
    cost: { fiber: 2, cement: 2 }, staff: true, gather: R_ORE, radius: 4, out: { ore: 6, uranium: 3 }, armor: 8, buildTime: 10,
  },
  tap: {
    name: 'Crystal Tap', desc: 'A worker extracts Crystal from nearby clusters.',
    cost: { fiber: 2, cement: 2 }, staff: true, gather: R_CRYSTAL, radius: 4, out: { crystal: 6 }, armor: 8, buildTime: 10,
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
    name: 'Asphalt Plant', desc: 'Cooks Crude and Cement into Asphalt for the fastest roads.',
    cost: { cement: 3, alloy: 2 }, staff: true, inp: { crude: 1, cement: 1 }, make: { asphalt: 2 }, out: { asphalt: 4 },
    work: 7, armor: 10, buildTime: 12, limit: 20,
  },
  roadworks: {
    name: 'Roadworks', desc: 'Its Paver upgrades your roads to asphalt, the fastest surface, working outwards along every road joined to the Roadworks, however far. One Asphalt covers four tiles.',
    cost: { cement: 3, alloy: 1, fiber: 2 }, staff: true, crew: 'paver', roadworks: true, radius: 7, armor: 8, buildTime: 10,
  },
  armory: {
    name: 'Ammo Plant', desc: 'Packs Alloy and Cement into Ammo. Haulers take it to your Command Base and Outposts, where warbots reload.',
    cost: { cement: 3, alloy: 2 }, staff: true, inp: { alloy: 1, cement: 1 }, make: { ammo: 3 }, out: { ammo: 6 },
    work: 6, armor: 10, buildTime: 10, war: true,
  },
  munitions: {
    name: 'Missile Factory', desc: 'Builds Missiles from 2 Alloy, 1 Chip and 1 Fuel each. They are slow and costly to make; haulers carry them to your Missile Silos.',
    cost: { cement: 4, alloy: 4, chip: 2 }, staff: true, inp: { alloy: 2, chip: 1, fuel: 1 }, make: { warhead: 1 },
    out: { warhead: 2 }, work: 20, armor: 10, buildTime: 14, war: true,
  },
  silo: {
    name: 'Missile Silo',
    desc: 'Fires Missiles from a Missile Factory at rival buildings far away. A hit wrecks most buildings outright, damages the buildings and bots around it, and knocks Outposts and Command Bases down so warbots can capture them. Holds two Missiles.',
    cost: { cement: 5, alloy: 4, chip: 2 }, ammo: 'warhead', ammoCap: 2,
    missile: { range: 18, reload: 25, damage: 24, splash: 2.2, splashDamage: 5, botDamage: 9 }, armor: 14, buildTime: 16, war: true,
  },
  reactor: {
    name: 'Nuclear Reactor', desc: 'Enriches Uranium: 2 Uranium make 1 Enriched Uranium. Nuclear race only.',
    cost: { cement: 6, alloy: 6, chip: 3 }, staff: true, inp: { uranium: 2 }, make: { fissile: 1 }, out: { fissile: 2 },
    work: 20, armor: 14, buildTime: 20, war: true, nuke: true,
  },
  nukesilo: {
    name: 'Nuclear Silo',
    desc: 'Builds one nuclear missile at a time from 6 Enriched Uranium, 4 Alloy and 2 Chips, then fires it up to 40 tiles. It wipes out everything within 6 tiles. Nuclear race only.',
    cost: { cement: 8, alloy: 6, chip: 4 }, nukeSilo: true, armor: 18, buildTime: 24, war: true, nuke: true,
  },
  charger: {
    name: 'Charging Station',
    desc: 'Bots recharge their batteries here, four at a time. It burns Fuel: one Fuel recharges about three quarters of a battery. Build them near busy areas far from your Command Base.',
    cost: { cement: 3, alloy: 1 }, charger: { slots: 4, rate: 25, fuel: true }, fuelCap: 4, armor: 10, buildTime: 10,
  },
  farm: {
    name: 'Bio Farm', desc: 'A worker plants energy crops on fertile soil nearby and harvests them into Fuel. Crops take a while to ripen.',
    cost: { fiber: 2, cement: 2 }, staff: true, crew: 'agribot', farm: true, radius: 3, out: { fuel: 6 }, armor: 8, buildTime: 9,
  },
  pump: {
    name: 'Oil Pump', desc: 'Built on top of an oil seep. Its worker pumps Crude until the seep runs dry, or until you have 30 (its stock limit).',
    cost: { cement: 2, alloy: 2 }, staff: true, pump: true, inp: {}, make: { crude: 1 }, out: { crude: 4 },
    work: 6, armor: 8, buildTime: 10, limit: 30,
  },
  refinery: {
    name: 'Refinery', desc: 'Refines Crude into Fuel, one for one. Stops at 30 Fuel unless you change its stock limit.',
    cost: { cement: 4, alloy: 3 }, staff: true, inp: { crude: 1 }, make: { fuel: 1 }, out: { fuel: 4 },
    work: 6, armor: 10, buildTime: 12, limit: 30,
  },
  ramp: {
    name: 'Ramp', desc: 'Workers cut a sloped road into a low cliff so bots can climb between levels. Plan it in Paths, on the top or at the foot of a cliff: whichever side your bots can reach.',
    cost: { cement: 3, fiber: 1 }, ramp: true, armor: 4, buildTime: 10,
  },
  repair: {
    name: 'Repair Station',
    desc: 'Damaged robots come here to be fixed, three at a time. It uses Alloy, which haulers bring: one Alloy repairs 12 health (a whole Warbot). Warbots come when their garrison is quiet.',
    cost: { cement: 3, alloy: 2 }, repair: { slots: 3, rate: 1.5 }, alloyCap: 3, armor: 10, buildTime: 10, war: true,
  },
  wall: {
    name: 'Wall', desc: 'A thick block of Cement that nothing gets past. Enemy warbots have to go round or shoot their way through, and a Wall takes far more punishment than any other building (a Missile only dents it). Your own bots can\'t cross it either: leave a Gate. Planned in Paths (Walls); paid for when you plan it, so no Hauler or road is needed.',
    cost: { cement: 5 }, barrier: true, prepaid: true, armor: 40, buildTime: 6, war: true,
  },
  gate: {
    name: 'Gate', desc: 'A Wall with a door: your bots drive through, the enemy\'s have to break it down. A Gate on a road carries the road, so haulers keep running. Planned in Paths (Walls): where a wall line crosses a road, a Gate goes there.',
    cost: { cement: 6, alloy: 2 }, barrier: true, gate: true, prepaid: true, armor: 32, buildTime: 8, war: true,
  },
  depot: {
    name: 'Depot', desc: 'Extra storage. Haulers drop goods at the nearest storage they can reach by road, so depots along your highways shorten trips. Give it supply orders to stock it from home: a forward base for building at the front.',
    cost: { fiber: 3, cement: 2 }, store: true, armor: 10, buildTime: 8,
  },
};

/** Order of the build menu. */
const BUILD_MENU = ['harvester', 'quarry', 'mine', 'tap', 'smelter', 'fab', 'foundry', 'charger', 'farm', 'pump', 'refinery',
  'kiln', 'tarworks', 'roadworks', 'outpost', 'turret', 'repair', 'armory', 'munitions', 'silo', 'reactor', 'nukesilo', 'depot', 'grower'];
/** Ramps are planned in Paths (with roads), not from the build menu. */

const INPUT_CAP = 3;   // how many of each input a production building stockpiles
const AMMO_CAP = 3;    // crystals a turret stockpiles
const TURRET_TURN = 2.4;   // radians per second a turret's head turns (about 140°)
const TURRET_SWEEP = 0.35; // radians per second it sweeps while watching for targets
const SHOTS_PER_AMMO = 4;

const DIFFICULTY = {
  easy:   { label: 'Easy',   mult: 0.7,  grace: 330, threshold: 7, maxSites: 1, think: 3.0, bonus: 0 },
  medium: { label: 'Medium', mult: 0.85, grace: 275, threshold: 6, maxSites: 2, think: 2.5, bonus: 0 },
  normal: { label: 'Normal', mult: 1.0,  grace: 220, threshold: 5, maxSites: 2, think: 2.0, bonus: 0 },
  hard:   { label: 'Hard',   mult: 1.3,  grace: 150, threshold: 4, maxSites: 3, think: 1.5, bonus: 6 },
};

/**
 * Rival personalities: how a rival AI plays, on top of its difficulty. grace, threshold, army
 * (warbots a minute), armyFrom (when the army starts growing), raids (how often), raidFirst and
 * raidSize multiply or replace the difficulty's settings; turrets, walls and missiles switch on
 * extra habits. Balanced plays the plain difficulty.
 */
/*
 * Rival personalities. Each scales the rival's difficulty settings: grace (when it starts attacking),
 * threshold (warbots it gathers before an attack), army (how fast its army grows; armyFrom, when it
 * starts), raids (how often it raids; raidFirst, the first raid; raidSize and raidKeep, how many go
 * and stay home), econ (how fast its bots work). turrets, walls and missiles switch on its habits.
 */
const PERSONALITIES = {
  balanced: { noun: 'an all-rounder', name: 'Balanced', desc: 'builds up, defends and attacks in good measure' },
  turtle: { noun: 'a Turtle', name: 'Turtle', desc: 'walls its base in and covers its land with turrets, then comes late with a big army', grace: 1.5, threshold: 1.5, army: 0.9, raids: 0.3, turrets: true, walls: true },
  raider: { noun: 'a Raider', name: 'Raider', desc: 'sends small bands of warbots to cut your supply lines, again and again', raids: 3, raidFirst: 0.4, raidSize: 3, raidKeep: 0, army: 1.15, armyFrom: 0.7 },
  rusher: { noun: 'a Rusher', name: 'Rusher', desc: 'comes for you early with warbots, before its economy is big', grace: 0.6, threshold: 0.8, army: 1.35, armyFrom: 0.4, raids: 0.6 },
  tycoon: { noun: 'a Tycoon', name: 'Tycoon', desc: 'builds a big economy first, then rains Missiles on you (or a nuke, in a Nuclear race)', grace: 1.15, army: 0.9, missiles: true, econ: 1.15 },
};
const PERSONALITY_ORDER = ['balanced', 'turtle', 'raider', 'rusher', 'tycoon'];

/*
 * Planet events (a menu option, on by default; never in missions): every five to eight minutes the
 * planet throws something at every colony alike, with a warning EVENT_WARN seconds ahead.
 *   dust    Dust storm: bots move at DUST_SPEED and no Missile can be fired until it blows over.
 *   meteor  Meteor shower: METEOR_HITS strikes on each colony's share of the planet (the same spots
 *           mirrored or turned for every colony), each cratering the roads it lands on, denting
 *           buildings and bots near it, and leaving a rich deposit of Ore or Crystal (sometimes
 *           Uranium, in a Nuclear race). Cratered roads are planned again straight away.
 *   flare   Solar flare: bot batteries drain FLARE_DRAIN times as fast.
 *   trader  Trader ship: for 75 seconds a trader in orbit offers each colony a swap at a good rate:
 *           some of a good it has plenty of for the raw good (Ore, Crystal, Stone or Crude) its
 *           land is closest to running out of.
 */
const EVENTS = {
  dust:   { name: 'Dust storm',    color: '#d9a86a', dur: [60, 90], warn: true,  desc: 'Bots move at two-thirds speed and Missiles are grounded until it blows over.' },
  meteor: { name: 'Meteor shower', color: '#ff8a3d', dur: [30, 30], warn: true,  desc: 'Meteors crater roads and dent what they hit, but leave rich Ore and Crystal behind.' },
  flare:  { name: 'Solar flare',   color: '#ffe36b', dur: [45, 60], warn: true,  desc: 'Bot batteries drain twice as fast: keep your Charging Stations fuelled.' },
  trader: { name: 'Trader ship',   color: '#7fe3ff', dur: [75, 75], warn: false, desc: 'A trader in orbit swaps spare goods for the Ore, Crystal, Stone or Crude your land is running out of.' },
};
const EVENT_ORDER = ['dust', 'meteor', 'flare', 'trader'];
const EVENT_FIRST = 480, EVENT_GAP = [300, 480], EVENT_WARN = 20;
const DUST_SPEED = 0.65, FLARE_DRAIN = 2;
const METEOR_HITS = 6, METEOR_DAMAGE = 4, METEOR_BOT_DAMAGE = 1.5, METEOR_RICH = 2;
/**
 * The trader brings the raw goods dug from deposits that run out (TRADE_GET: the one a colony has
 * least of, in stock and left in the ground on its land, against TRADE_LEFT), and takes a good it
 * has well over TRADE_KEEP of (TRADE_GIVE: never Chips, Ammo or Missiles). It pays TRADE_BONUS times
 * the worth (TRADE_VALUE) of what it takes.
 */
const TRADE_GET = { ore: R_ORE, crystal: R_CRYSTAL, stone: R_BOULDER, crude: R_OIL };
const TRADE_LEFT = { ore: 80, crystal: 50, stone: 80, crude: 60 };
const TRADE_GIVE = ['fiber', 'fuel', 'cement', 'alloy', 'stone', 'ore', 'crystal', 'crude'];
const TRADE_VALUE = { fiber: 1, stone: 1, ore: 1.2, crystal: 1.5, crude: 1.2, cement: 0.6, fuel: 1.5, alloy: 3 };
const TRADE_KEEP = { fiber: 12, stone: 12, ore: 12, crystal: 10, crude: 10, cement: 20, fuel: 12, alloy: 10 };
const TRADE_BONUS = 1.3;

/** Starting goods in each Command Base. */
const START_STOCK = { fiber: 16, stone: 8, alloy: 8, chip: 4, crystal: 4, fuel: 10, cement: 24 };
const START_BOTS = { worker: 10, hauler: 5, agribot: 1 };
const START_WARBOTS = 4;
const MIN_FREE_WORKERS = 2;   // workers always kept free for building

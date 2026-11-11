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
const RAIL_GRADE = 0.55;          // a Freight Train's top speed on a Ramp (climbing or braking down a level)
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
const REPAIR_RETREAT = 0.35;      // a warbot this badly hurt pulls out of a fight for repairs (if a Repair Station can fix it)
const FUEL_ENERGY = 250;          // battery points one Fuel gives at a Fuel Station (2½ full charges)
/*
 * Trucks burn Fuel. Freight Trucks, Road Trains and Tankers have a fuel tank instead of a battery
 * (u.bat, 0–100): it drains TRUCK_BURN a second while they drive (a Road Train TRAIN_BURN), and
 * when it's low they fill up at the nearest storage or Fuel Station holding Fuel they can drive
 * to: one Fuel fills the tank, in a moment. With no Fuel anywhere they limp along at half speed.
 */
const TRUCK_BURN = 0.4, TRAIN_BURN = 0.6;

/*
 * Batteries (0–100). Bots drain while they move and work, and recharge inside a building with a
 * charger (the Command Base or a Fuel Station); warbots also recharge inside their garrison.
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
  roadtrain: { name: 'Road Train', plural: 'Road Trains', speed: WORKER_SPEED * 1.35, hp: 14, haul: true, truck: true, train: true, carry: 30, roadOnly: true, parts: 4, accel: 1.0, brake: 2.5,
    desc: 'A truck pulling two trailers: 30 goods at once, for bulk runs between your Command Base and far Depots (filling supply orders, and bringing a far Depot\'s spare goods home). It only pays off on asphalt: on plain road it crawls. Slow to start and stop, it wears roads hard and holds up the traffic behind it.' },
  freight: { name: 'Freight Train', plural: 'Freight Trains', speed: WORKER_SPEED * 3.4, hp: 30, haul: true, rail: true, carry: 56, parts: 5, accel: 0.85, brake: 1.6,
    desc: 'A locomotive and four wagons: 56 goods at once between Rail Stations on the same track, fast and with no traffic to wait for. It never needs charging. Order it at a Rail Station: its rail yard builds it from Alloy and Chips and it rolls out onto that station\'s track.' },
  // Ships (naval maps only): they sail open water between Ports (passing under bridges), burning Fuel (SHIP_BURN).
  cargoship: { name: 'Container Ship', plural: 'Container Ships', speed: WORKER_SPEED * 2.4, hp: 30, haul: true, sea: true, carry: 40, parts: 5, accel: 0.5, brake: 1.0, naval: true,
    desc: 'Carries 40 goods at once between your Ports on the same water: supply orders at a Port are filled from the other Ports, and a far Port sends its spare goods home to the Port nearest your Command Base. It burns Fuel under way and fills up at a Port (each Port keeps a little Fuel for its ships). It puts to sea at the nearest Port when the Foundry finishes it.' },
  tankship: { name: 'Tanker Ship', plural: 'Tanker Ships', speed: WORKER_SPEED * 2.4, hp: 26, haul: true, sea: true, tankShip: true, carry: 40, parts: 5, accel: 0.5, brake: 1.0, naval: true,
    desc: 'Carries 40 Crude or Fuel at once between your Ports on the same water (and nothing else). Sunk with a load on board, it explodes, hurting everything round it.' },
  ferry: { name: 'Ferry', plural: 'Ferries', speed: WORKER_SPEED * 2.8, hp: 26, sea: true, ferry: true, seats: 6, parts: 4, accel: 0.7, brake: 1.4, naval: true,
    desc: 'Carries robots and trucks across the water. Give a Port a ferry line to another Port and your bots take the ferry whenever it is the shorter way (six seats: a truck takes two, a Road Train three). From a Port it can also land up to six warbots on any shore, enemy shores too: a beach landing.' },
  // Aircraft: they fly straight over anything (water, cliffs, rock, the enemy), burning Fuel (PLANE_BURN), from an Airfield.
  bomber: { name: 'Strike Bomber', plural: 'Strike Bombers', speed: WORKER_SPEED * 5.2, hp: 16, air: true, war: true, bomber: true, parts: 5, accel: 1.3, brake: 1.6, turn: 1.5, // a jet: it turns tighter, about the Cargo Plane's circle at its speed
    desc: 'A fast twin-engined strike jet, based at an Airfield (two to a hangar; built there). Pick a target, an enemy building, or a truck, Tanker, ship or robot out in the open, and it flies out, drops one heavy bomb and flies home: it knocks 14 off a building (forts no lower than a third of their armor) and hurts what\'s round it, and a Tanker it hits explodes. Each sortie takes 6 Ammo and Fuel from its Airfield, and it needs a while on the ground to rearm. Flak Guns are the answer to it.' },
  cargoplane: { name: 'Cargo Plane', plural: 'Cargo Planes', speed: WORKER_SPEED * 3.75, hp: 24, air: true, carry: 8, seats: 2, parts: 6, accel: 0.9, brake: 1.3,
    desc: 'A big four-engined transport, based at an Airfield. It flies straight over anything and drops what it carries by parachute, one load a flight: a Drop Outpost anywhere on open ground nobody else holds, two robots (Warbots or Workers) wherever you like, the enemy\'s land too, or up to 8 goods for a place you supply by air. It burns Fuel in the air and fills up at its Airfield. It flies to the nearest Airfield when the Foundry finishes it.' },
  crawler: { name: 'Crawler', plural: 'Crawlers', speed: WORKER_SPEED * 0.45, hp: 80, crawler: true, parts: 6,
    desc: 'A colossal tracked base on the move. Drive it anywhere it can roll (no road needed) and it deploys where it stops: a Depot, a Fuel Station and an Outpost in one, claiming the land around it. Pack it up to move on: it takes everything stored in it along.' },
  truck:   { name: 'Freight Truck', plural: 'Freight Trucks', speed: WORKER_SPEED * 1.35, hp: 8, haul: true, truck: true, carry: 8, roadOnly: true, parts: 2, accel: 1.5, brake: 3.5,
    desc: 'A heavy road truck that carries eight goods at once on the long runs: between your Command Base and Depots, and to anything far away. Slower than a Hauler on concrete, fastest of all on asphalt.' },
  tanker:  { name: 'Tanker', plural: 'Tankers', speed: WORKER_SPEED * 1.35, hp: 8, haul: true, truck: true, tanker: true, carry: 10, roadOnly: true, parts: 2, accel: 1.4, brake: 3.2,
    desc: 'A tank truck, the only vehicle that carries Crude and Fuel: ten at a time, wherever they need to go (Haulers carry them only when no Tanker can get there, one at a time). Fastest on asphalt. Destroyed with a load on board, it explodes, hurting everything round it, and can set off other Tankers nearby.' },
  rocket:  { name: 'Rocket Truck', plural: 'Rocket Trucks', speed: WARBOT_SPEED * 1.05, hp: 14, war: true, siege: true, parts: 3, accel: 1.1, brake: 2.4,
    desc: 'The army\'s siege gun: a truck with a rack of four rockets. Send it at an enemy building (or let it pick one in reach while it waits): it drives to within 11 tiles, parks, raises its rack and fires all four rockets, each knocking 5 off the target and hurting buildings and robots round it. Then it drives back to reload 4 Ammo at your nearest garrison or storage. It can\'t hit anything closer than 4 tiles, can\'t take a fort below a third of its armor (warbots still have to capture it) and is fragile: keep warbots out in front of it.' },
  warbot:  { name: 'Warbot', plural: 'Warbots', speed: WARBOT_SPEED, hp: 12, war: true,
    desc: 'Fights enemy bots and captures enemy buildings. Shoots Ammo; with none it can only scuffle.' },
  // Wildlife (Colony, see WILD): creatures from nests. Not built, never ordered.
  scuttler: { name: 'Scuttler', plural: 'Scuttlers', speed: WORKER_SPEED * 1.1, hp: 6, wild: true, bite: 1,
    desc: 'A quick, small creature. Scuttlers run in packs and go for any bot they catch out in the open.' },
  brute:    { name: 'Brute', plural: 'Brutes', speed: WORKER_SPEED * 0.8, hp: 24, wild: true, bite: 3, smash: true,
    desc: 'A big, slow, armoured creature. Brutes tear up roads and batter buildings, and bite hard.' },
};
const BOT_ORDER = ['worker', 'hauler', 'truck', 'tanker', 'roadtrain', 'freight', 'cargoship', 'tankship', 'ferry', 'cargoplane', 'bomber', 'crawler', 'agribot', 'paver', 'warbot', 'rocket'];
/*
 * Who carries what (see dispatch):
 * - Haulers (2 goods) do the short runs: between buildings less than TRUCK_MIN_DIST tiles apart.
 * - Freight Trucks (8 goods) do the long runs, from any building: a far mine's output to storage,
 *   storage to a far factory (which gets a bigger buffer, up to LONG_BUFFER of each input), and
 *   storage to storage (a Depot's supply orders, emptying a store). With trucks around, Haulers take a
 *   long run only when the building at the far end is about to run dry; a far producer waits for a
 *   truck until its output is nearly full.
 * - Trunk runs: a store TRUCK_MIN_DIST or more from the Command Base sends home the goods nothing near
 *   it uses, keeping EXPORT_RESERVE of each, by Road Train or Freight Truck only (never by Hauler).
 * - Road Trains (30 goods) only do storage-to-storage runs at least TRUCK_MIN_DIST long (supply
 *   orders and trunk runs), and only with a load of TRAIN_MIN_LOAD or more (any load when there are
 *   no Freight Trucks): a half-empty Road Train wastes its slow trip and wears the road. Freight Trucks
 *   leave those loads to a Road Train that can get there: trunk loads build up to TRAIN_MIN_LOAD, and a
 *   supply order of twice that or more waits for a train load until the Depot is down to a third.
 * - Backhauls: a truck or Road Train that delivers to far storage takes home what's waiting there.
 * Trucks are heavy: on concrete they go at TRUCK_ROAD of their speed, Road Trains at TRAIN_ROAD;
 * asphalt is full speed. A Depot's supply orders (b.keep) ask for goods to be kept there, up to
 * KEEP_MAX of each.
 */
/*
 * Liquids: Crude and Fuel only travel by Tanker (and Crude by pipeline, see PIPE_COST). Haulers, Freight
 * Trucks, Road Trains and Freight Trains can't carry them. When no Tanker can get to the goods (none
 * left, or none on that road network), Haulers carry them one at a time, so nothing ever locks up.
 * Tankers do every liquid run, near or far; a production building's Crude or Fuel waits for a load of
 * TRUCK_MIN_LOAD (or until its output is nearly full).
 */
const LIQUID = { crude: true, fuel: true };
function isLiquid(g) { return !!LIQUID[g]; }
/*
 * Fuel is dangerous. A Tanker destroyed with a load on board, or a Refinery destroyed (by fire, a
 * missile or a nuke, not demolished), explodes: radius r0 + r1 × how full it was, hurting every robot
 * (bot) and building (bld) in it, whoever's they are, at full strength in the middle and half at the
 * edge. Loaded Tankers and Refineries caught in a blast go up too, chain[0] to chain[1] seconds later.
 * A wrecked Refinery's Crude and Fuel burn in the blast instead of spilling.
 */
const BLAST = {
  tanker: { r0: 0.7, r1: 0.6, bot: 4.5, bld: 3 },
  refinery: { r0: 1.5, r1: 0.9, bot: 6, bld: 5 },
  chain: [0.25, 0.7],
};
/*
 * Feed links: a production building feeds a neighbour (any of the 8 tiles round it) that uses what it makes
 * straight across, by a short conveyor (a pipe for Crude and Fuel), with no Hauler: one good every FEED_TIME
 * seconds a link. A building being fed works FEED_BOOST faster. Each producer feeds at most FEED_MAX
 * neighbours (side by side before corners). A Refinery also passes Crude on from its intake (to an Asphalt
 * Plant beside it, say). Storage never takes part: a link moves goods between factories, it makes none.
 */
const FEED_TIME = 2, FEED_BOOST = 0.1, FEED_MAX = 2;
const FEED_NB = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
const TRUCK_MIN_DIST = 12;
const TRUCK_MIN_LOAD = 3;
const TRUCK_KEEP_LOAD = 4;     // a truck fills a supply order with at least this many (half a load; or half the order), unless the store has run dry
const TRUCK_ROAD = 0.8;
const LONG_BUFFER = 8;
const EXPORT_RESERVE = 4;
const TRAIN_MIN_LOAD = 18;     // (on plain road a Road Train only beats a truck with 18 or more)
const TRAIN_ROAD = 0.35;   // a Road Train on plain road: it needs asphalt
const TRAIN_CORNER = 0.36; // ...and takes corners slowly
const TRAIN_LEN = 1.5;     // tiles of road it fills (cab and two trailers): traffic queues behind that
const WEAR_TRAIN = 8;
/*
 * Ropeway: two stations ROPE_MIN to ROPE_MAX tiles apart, joined by a cable straight across anything.
 * Light bots ride it at ROPE_SPEED tiles a second; to the pathfinder a ride costs ROPE_COST times a
 * paved road of the same length. Trucks can't use it.
 */
const ROPE_MIN = 3, ROPE_MAX = 14, ROPE_SPEED = 1.8, ROPE_COST = 1.3;
/**
 * Viaduct: a level bridge straight across a valley, canyon or water between two clifftops VIA_MIN
 * to VIA_MAX tiles apart (no more than VIA_RISE levels apart: the deck runs at the higher one and
 * ramps down at the other), over ground lower than both ends. The ground below stays as it is:
 * bots, roads and buildings down there carry on underneath. It costs VIA_COST for every tile it
 * spans, paid from storage (as it comes in), and a worker at the near end puts it up in VIA_TIME seconds a tile. Every
 * bot can cross it, trucks and Road Trains included, and trains when track runs onto both ends.
 */
const VIA_MIN = 2, VIA_MAX = 12, VIA_RISE = 2, VIA_COST = { cement: 3, alloy: 0.5 }, VIA_TIME = 5; // cost a tile spanned (Alloy rounded up)
const VIA_CLAIM = 3; // a Viaduct's far end claims the no-one's ground this far round it
/*
 * Freight rail: track (S.rail) is laid in Paths (Rail), RAIL_COST a tile, paid when you build it and
 * laid at once, on open ground in your territory; it climbs a level at a time over a Ramp (RAIL_GRADE
 * speed there), like a road. It can cross a
 * road: a level crossing, where road traffic waits while a train is within RAIL_CROSS_HOLD tiles.
 * Rail Stations stand beside the track; Freight Trains (56 goods) run between stations on the same
 * track: supply orders at a station (from another station first) and a far station's trunk runs to
 * the station nearest the Command Base, with loads of RAIL_MIN_LOAD or more.
 */
const RAIL_COST = { cement: 1.5, alloy: 0.25 }; // mostly Cement (sleepers and ballast): Alloy is too scarce for a long line to cost a bar a tile
const RAIL_MIN_LOAD = 10;
/*
 * Pipelines carry Crude (nothing else). Pipe is laid in Paths (Pipes): drag from one building to
 * another and it finds its own way there. PIPE_COST a tile, paid from storage and laid at once (or as
 * the goods come in), on any ground in your territory: over roads and track, under buildings, up and
 * down cliffs. A pipe joins every building it runs under or beside. Every second each pipeline moves
 * up to PIPE_RATE Crude: from Oil Pumps to the Refineries and Asphalt Plants on it (a Refinery keeps
 * up to PIPE_FILL), then to storage on it; and from storage on it to its Refineries. A piped pump's
 * Crude never waits for a Tanker. Raids, missiles and fuel blasts break pipe: a broken tile is planned
 * again at once and relaid when it's paid for.
 */
const PIPE_COST = { cement: 0.3 }; // cheap, and no Alloy (always the scarce one)
// Pipe across open water or a canyon (on stilts) or through rock (bored) costs more a tile; the route
// finder weighs a crossing tile PIPE_CROSS_WEIGHT times a land tile (the price ratio), so it goes round
// water or rock when that's cheaper, and straight across when it isn't.
const PIPE_CROSS_COST = { cement: 1.2 };
const PIPE_CROSS_WEIGHT = 4;
/** What a tile of pipe on tile t costs. */
function pipeCost(t) { return S.terrain[t] === T_GROUND || S.road[t] || (S.rail && S.rail[t]) ? PIPE_COST : PIPE_CROSS_COST; }
const PIPE_RATE = 4;
const PIPE_FILL = 6;
const RAIL_CROSS_HOLD = 2.4;
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
const WARBOT_RANGE_GAP = 3.6;     // ...and from a clifftop across a narrow canyon (Sky islands)

// Terrain
const T_GROUND = 0, T_WATER = 1, T_ROCK = 2, T_CHASM = 3; // a chasm: a deep, sheer canyon between islands (Sky islands)
/**
 * Bridges and tunnels: a road over water is a bridge, a road through rocky crags a tunnel. Each tile
 * costs `cost` instead of road Cement, and workers take `time` seconds to build it, working out from
 * the shore (or the rock face). They join tiles on any level, and route planning only uses them when
 * the way round is longer than about `weight` road tiles.
 */
const CROSS = {
  [T_WATER]: { key: 'bridge', name: 'Bridge', cost: { cement: 2, alloy: 0.5 }, time: 6, weight: 14 }, // cheaper than a Viaduct span: Islands live on bridges
  [T_ROCK]: { key: 'tunnel', name: 'Tunnel', cost: { cement: 3, alloy: 1 }, time: 8, weight: 18 },
  [T_CHASM]: { key: 'skybridge', name: 'Sky bridge', cost: { cement: 3, alloy: 0.5 }, time: 9, weight: 16 },
};
/** Can a bridge (road or rail) go out over tile t? Water and chasms, not rock. */
function bridgeable(t) { return S.terrain[t] === T_WATER || S.terrain[t] === T_CHASM; }
/** Track over water or a chasm is a rail bridge, dearer than track on the ground. */
const RAIL_BRIDGE_COST = { cement: 3, alloy: 0.5 }; // the same as a Viaduct's span
// Naval maps (Islands, Lakes): a bridge or rail-bridge tile over water costs more the further it is from
// the nearest shore: the usual price up to BRIDGE_NEAR tiles out, then BRIDGE_STEP times more for each tile
// further. Short hops stay cheap; a long crossing costs several times as much, so ships are worth having.
const BRIDGE_NEAR = 2, BRIDGE_STEP = 1.5;
const LAKES_WET = 0.37;
// Ships: a Port's dock must open onto at least SEA_MIN tiles of water. A Ferry's six seats (FERRY_SEATS: a
// truck takes 2, a Road Train 3); once someone is aboard it waits FERRY_WAIT s for more before it sails;
// a bot waiting at a Port gives up after FERRY_GIVEUP s. In routes a ferry crossing costs FERRY_COST times
// the straight distance, plus FERRY_BOARD tiles' worth for the wait.
const NAVAL_ON = true; // ships and Ports on naval maps (false switches them off everywhere)
const SEA_MIN = 20, FERRY_SEATS = 6, FERRY_WAIT = 5, FERRY_GIVEUP = 90, FERRY_COST = 1.4, FERRY_BOARD = 8;
/** A Ferry founding a Port on another shore (orderFoundPort): the kit it loads at its Port, the land the new Port claims, the Workers it takes. */
const PORT_FOUND = { cost: { cement: 12, alloy: 4 }, claim: 4, workers: 4 };
const LANDING_GATHER = 40; // a Ferry on a beach landing sails this long after the order even if some warbots haven't come aboard
const SHIP_BURN = 0.3, SHIP_REFUEL = 70, PORT_FUEL = 4; // a ship's tank (0–100) drains this a second under way; it fills up (one Fuel) when tied up below SHIP_REFUEL; a Port keeps PORT_FUEL for them
// Cargo Planes: a tank (0–100) drains PLANE_BURN a second in the air; one Fuel at the Airfield puts back PLANE_FILL of it
// (a long sortie takes two or three); an Airfield keeps AIRFIELD_FUEL for its planes. Loading takes PLANE_LOAD s; robots
// have PLANE_GATHER s to get aboard (then it goes with whoever is); a parachute takes AIR_DROP_FALL s to come down.
const PLANE_BURN = 2.2, PLANE_FILL = 40, AIRFIELD_FUEL = 6, PLANE_LOAD = 3, PLANE_GATHER = 45, AIR_DROP_FALL = 2.2;
const PLANE_MEND = 0.6;    // hit points a second a plane parked at its Airfield gets back
// Airfields: a runway RUNWAY_LEN tiles long runs straight out from the hangar. A plane rolls down it from the
// head, gathering speed (ROLL_ACCEL tiles/s²), and lifts off at the far end; in the air it turns at up to
// PLANE_TURN radians a second; it lands at the far end and brakes (ROLL_BRAKE) back to the head.
const AIRFIELD_HOLDS = { cargoplane: 1, bomber: 2 }; // planes of each type an Airfield has room for
/**
 * The Strike Bomber (BOTS.bomber): a sortie loads `ammo` Ammo at its Airfield (and Fuel for the trip), flies to
 * one target (an enemy building, or a vehicle or robot out in the open, which it chases), drops its bomb (`fall`
 * s to the ground) and flies home: `damage` to the building it's aimed at (forts no lower than MISSILE_FLOOR),
 * `splashBld` to other buildings and `botDamage` to robots within `splash` tiles. Back on the ground it needs
 * `rearm` s before the next sortie. Flak Guns shoot it down.
 */
const BOMBER = { ammo: 6, damage: 14, splash: 1.3, splashBld: 4, botDamage: 8, fall: 0.8, rearm: 25 };
const RUNWAY_LEN = 5, ROLL_ACCEL = 0.42, ROLL_BRAKE = 0.75, PLANE_TURN = 1.1, PLANE_CLIMB = 3;
const SECLUDED_REACH = 16; // warbots at a cut-off post (a Drop Outpost) only go this far from it: for repairs, rally flags and attacks
const FOOT_CARRY = 12;     // off the road network (a foothold dropped by air), Workers carry goods by hand between buildings this close
const AIR_KEEP = 12;       // an Airfield keeps up to this many of each good the places it supplies by air are short of
const SHIP_MEND = 0.5; // hit points a second a ship tied up in Port gets back
const SHIP_MIN_LOAD = 8; // a far Port sends spare goods home by ship in loads of at least this many // Lakes maps: how much of the land outside the middle lake is lakes (a noise threshold)
/** Track through rocky crags is a rail tunnel, bored like a road tunnel and costing the same. */
const RAIL_TUNNEL_COST = { cement: 3, alloy: 1 };

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
  { name: 'Chokepoint', w: 1, h: 1, choke: true, tip: 'Chokepoint: a belt of crags splits the planet, with one to three narrow channels winding through it (different every game). Find where yours come out, and hold them: an Outpost nearby, then walls and turrets (Paths, Walls).' },
  { name: 'Islands', w: 1.15, h: 1.45, islands: true, naval: true, ffa: true, tip: 'Islands: a wide sea between the islands. Build a Port on your shore and order ships and a Ferry at its shipyard (a Ferry can land warbots on any shore), or push an Outpost out to your shore and build a bridge in Paths (Bridges): long ones cost a lot.' },
  { name: 'Crater', w: 1, h: 1, crater: true, minLevels: 3, ffa: true, tip: 'Crater: the richest fields lie on the crater floor in the middle. One ramp leads down on your side; cut more in Paths (Ramps).' },
  { name: 'Plateaus', w: 1, h: 1, plateau: true, minLevels: 3, ffa: true, tip: 'Plateaus: your base stands on high ground with only two slopes down. Easy to hold: wall the slopes and push out.' },
  { name: 'Sky islands', w: 1.15, h: 1.45, islands: true, sky: true, ffa: true, tip: 'Sky islands: a home mesa each and around a dozen smaller mesas between, a chain of them always linking the sides, over a canyon floor far below, with sheer drops and no slopes down; deposits on the mesas hold more. Cross between clifftops with Viaducts (Build menu); a Ropeway can reach the floor, but there is little down there.' },
  { name: 'Rift', w: 1, h: 1, rift: true, tip: 'Rift: a chasm splits the planet, crossed only by a few natural rock arches. Hold your arches with turrets and Mortar Pits; a bridge over the chasm is the slow way to open another crossing.' },
  { name: 'Ring valley', w: 1, h: 1.1, ring: true, tip: 'Ring valley: a massif too steep to climb fills the middle, and a valley runs round it on each side. Two long ways round: fortify one, raid along the other. (A long tunnel through the massif is the only shortcut.)' },
  { name: 'Oases', w: 1.05, h: 1.05, oases: true, tip: 'Oases: a barren, crag-strewn waste. Everything worth having is round your base and in a few rich oases joined by narrow passes: grab them first, and guard the long supply lines.' },
  { name: 'Crossroads', w: 1.2, h: 1, cross: true, tip: 'Crossroads: ridges split the planet into four quarters, meeting at a rich plaza in the middle. Your base is in one corner; the two quarters no one holds are rich, and gaps near the edges lead round the flanks.' },
  { name: 'Lakes', w: 1.1, h: 1.1, lakes: true, naval: true, tip: 'Lakes: a land of many small lakes, roads weaving between them. Bridges save long detours.' },
];
const CHOKE_BAND = 3;   // Chokepoint maps: rows of crags each side of the middle line
const CHOKE_APPROACH = 3; // ...and rows of open ground kept clear each side of the pass
const ISLE_GAP = 4;       // Islands maps: at least this much sea between islands (a wide sea: ships, or long, dear bridges)
const SKY_GAP = 1;        // Sky islands: canyons between mesas are narrower (short Viaducts)
const SKY_RES_MUL = 1.8;  // Sky islands: Ore, Crystal, Stalk and Stone hold this much more (half the fields fall in the canyons)
const HOME_STONE = 300;   // Islands and Sky islands: Stone each home island or mesa holds at the start (topped up near the base)
const LOOT_MAX = 500;     // most crates a wrecked or demolished building spills (everything that was inside it)
const LOOT_TIME = 300;    // seconds a pile of crates on no-one's land lies before it rots away (on claimed land it stays)
const CRATE_SAFE = 6;     // haulers collect crates on their own land only with no enemy robot (or gun) within this many tiles
// Walls and Gates: an enemy warbot plans a route through one as if it were this many extra tiles
// long, plus one per point of armor left, so it walks round a short way and breaks through a long one.
const BREACH_COST = 8;
const BREACH_PER_ARMOR = 1;
// Forts (Outposts, the Command Base): a missile can't take one below MISSILE_FLOOR of its armor, and
// once it's under SORTIE_ARMOR every armed warbot inside goes out to fight. Taking one ejects whoever
// is still inside instead of killing them.
const MISSILE_FLOOR = 0.35;
const SORTIE_ARMOR = 0.25;
const DEFAULT_SIZE = { versus: 1, colony: 3 };
const DEFAULT_ROUGH = 2;
const DEFAULT_RICH = 2;

// Resource nodes that sit on ground tiles. Energy crops are planted by a Bio Farm on fertile soil;
// oil seeps are pumped by an Oil Pump built on top of one.
const R_NONE = 0, R_STALK = 1, R_BOULDER = 2, R_ORE = 3, R_CRYSTAL = 4, R_CROP = 5, R_OIL = 6, R_URANIUM = 7;
const SKY_RICH = [R_ORE, R_CRYSTAL, R_STALK, R_BOULDER]; // the deposits SKY_RES_MUL makes richer on Sky islands' mesas
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
  stone:   { name: 'Stone',   color: '#c9c1b4', desc: 'Broken from boulders. A Cement Works turns it into Cement (2 per Stone), and new Cement Works are built from it.' },
  ore:     { name: 'Ore',     color: '#ff8a3d', desc: 'Dug from ore veins. Smelted into Alloy.' },
  crystal: { name: 'Crystal', color: '#b98cff', desc: 'Tapped from crystal clusters. Makes Chips and turret ammo.' },
  alloy:   { name: 'Alloy',   color: '#8ec3e6', desc: 'Smelted metal for advanced buildings, chips and bots.' },
  chip:    { name: 'Chip',    color: '#c8f05a', desc: 'Bot brains. Needed for every new bot.' },
  crude:   { name: 'Crude',   color: '#b08a6e', desc: 'Crude oil from an Oil Pump. A Refinery turns it into Fuel. A liquid: only Tankers and pipelines move it.' },
  fuel:    { name: 'Fuel',    color: '#ff5c8a', desc: 'Energy for Fuel Stations, Generators and every truck. Grown at a Bio Farm or refined from Crude. A liquid: only Tankers move it.' },
  cement:  { name: 'Cement',  color: '#a9b4c2', desc: 'The main building material, made from Stone at a Cement Works (2 per Stone). Builds nearly everything and paves roads: 1 Cement for 5 tiles.' },
  asphalt: { name: 'Asphalt', color: '#6b7280', desc: 'Made from Crude and Cement. A Roadworks upgrades roads with it to asphalt, the fastest surface.' },
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
const EVAC_MARGIN = 1.5; // an evacuation clears this much beyond the blast radius

const PLAYER_COLORS = ['#38d4ff', '#ff5a6e', '#5be06c'];
/**
 * The hidden rival boost (tap the clock three times, or press ` on a keyboard): for a game you're
 * winning too easily. Each button gives one rival this much, at its Command Base.
 */
const BOOST = {
  goods: { cement: 40, stone: 20, fiber: 30, ore: 20, crystal: 15, alloy: 15, chip: 6, fuel: 20, ammo: 15 },
  warbots: 4, workers: 3,
};

/**
 * What to call player p. Label: 'You', 'Rival' (two players), 'Red rival' or 'Green rival' (three).
 * In a sentence (the = true): 'you', 'the rival', 'the Red rival', 'the Green rival'.
 */
function playerName(p, the) {
  if (p === 0) return the ? 'you' : 'You';
  if (typeof S !== 'undefined' && S && S.mode === 'colony' && p === 1) return the ? 'the wildlife' : 'Wildlife';
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
 *   prepaid   paid straight from storage (no Hauler or road needed): what's there goes in when it's
 *             planned, the rest as it comes in (settlePlans); it doesn't count toward MAX_SITES
 *   limit     default stock limit: it stops making its product once you have this many (players
 *             can change it per building)
 */
const BDEFS = {
  lander: {
    name: 'Command Base', short: 'Base',
    desc: 'Your fortified headquarters: the craft that brought the colony down, dug in and walled up. Stores goods and houses idle bots, but it does not charge them: that takes Fuel Stations. If it is captured, you lose.',
    store: true, mil: true, terr: 8, garrison: 40, armor: 30, ammoStock: 10,
  },
  harvester: {
    name: 'Harvester', desc: 'A worker cuts nearby stalk groves into Fiber.',
    cost: { fiber: 2, cement: 1 }, staff: true, gather: R_STALK, radius: 5, out: { fiber: 6 }, armor: 8, buildTime: 8,
  },
  quarry: {
    name: 'Quarry', desc: 'A worker breaks nearby boulders into Stone. With none left in reach it keeps going: it cuts Stone from a cliff or crag in reach, or failing that digs it out of the ground, more slowly. That never runs out.',
    cost: { fiber: 2 }, staff: true, gather: R_BOULDER, radius: 5, out: { stone: 6 }, armor: 8, buildTime: 8,
    // Out of boulders: seconds of work for a Stone cut from a rock face in reach, or dug at the Quarry, and
    // the Stone in storage at which it rests (it never runs out, so it only cuts or digs when Stone is needed).
    bedrock: { face: 8, dig: 20, rest: 40 },
  },
  mine: {
    name: 'Ore Mine', desc: 'A worker digs Ore from nearby veins, two at a time.',
    cost: { fiber: 2, cement: 2 }, staff: true, gather: R_ORE, radius: 4, dig: 2, out: { ore: 6, uranium: 3 }, armor: 8, buildTime: 10,
  },
  tap: {
    name: 'Crystal Tap', desc: 'A worker extracts Crystal from nearby clusters.',
    cost: { fiber: 2, cement: 2 }, staff: true, gather: R_CRYSTAL, radius: 4, out: { crystal: 6 }, armor: 8, buildTime: 10,
  },
  grower: {
    name: 'Grove Planter', desc: 'An Agribot plants new stalk groves nearby so Fiber never runs out.',
    cost: { fiber: 1, cement: 2 }, staff: true, crew: 'agribot', plant: R_STALK, radius: 4, armor: 8, buildTime: 8,
  },
  smelter: {
    name: 'Smelter', desc: 'Burns Fiber to smelt Ore into Alloy: 3 Alloy from 2 Ore and 2 Fiber. It can turn out 12 Alloy a minute: feed it from two or three Ore Mines.',
    cost: { cement: 3, fiber: 2 }, staff: true, inp: { ore: 2, fiber: 2 }, make: { alloy: 3 }, out: { alloy: 6 },
    work: 15, hopper: 6, armor: 8, buildTime: 10,
  },
  fab: {
    name: 'Chip Fab', desc: 'Etches Crystal onto Alloy to make Chips.',
    cost: { cement: 2, alloy: 2 }, staff: true, inp: { crystal: 1, alloy: 1 }, make: { chip: 1 }, out: { chip: 4 },
    work: 5, armor: 8, buildTime: 10, limit: 10,
  },
  foundry: {
    name: 'Bot Foundry', desc: 'Assembles every kind of bot and vehicle from Alloy and Chips, one round of parts at a time.',
    cost: { cement: 4, alloy: 3, chip: 1 }, staff: true, inp: { alloy: 1, chip: 1 }, bots: true,
    work: 8, armor: 10, buildTime: 14,
  },
  outpost: {
    name: 'Outpost', desc: 'Expands your territory and garrisons warbots for attack and defence. A road can run through it, for your own bots only: enemies have to break in.',
    cost: { cement: 4, fiber: 2 }, mil: true, terr: 7, garrison: 10, armor: 16, buildTime: 12, ammoStock: 6,
  },
  turret: {
    name: 'Pulse Turret', desc: 'Shoots enemy bots in range. Uses Crystal as ammo (4 shots each).',
    cost: { cement: 3, alloy: 3 }, ammo: 'crystal', range: 5, armor: 12, buildTime: 10, war: true,
  },
  // Defences that work alongside the Pulse Turret (see BUNKER, and `disrupt` and `mortar` below).
  bunker: {
    name: 'Bunker', desc: 'A concrete pillbox for 2 warbots. From behind its walls they shoot enemy robots within 3½ tiles with their own Ammo (it keeps a little to reload them) and recharge, and nothing can shoot them back until the Bunker falls. It claims no land, so it can go anywhere in your territory: on a wall line, beside a Gate, at a bridgehead. Shot down, it\'s wrecked and its warbots walk out.',
    cost: { cement: 6, alloy: 2 }, mil: true, bunker: true, terr: 0, garrison: 2, armor: 32, buildTime: 14, ammoStock: 4, range: 3.5, war: true,
  },
  disruptor: {
    name: 'Disruptor Tower', desc: 'Every few seconds it sends out a pulse that jams the guns of enemy robots within 4½ tiles for 2 seconds and drains their batteries: drained warbots slow down, hit at half power and have to go home to recharge. It kills nothing itself, so pair it with a turret or a Bunker. It burns Fuel (one for every 4 pulses), only while enemies are in range.',
    cost: { cement: 4, alloy: 3, crystal: 3 }, ammo: 'fuel', ammoCap: 4, range: 4.5, armor: 12, buildTime: 12, war: true,
    disrupt: { every: 2.5, drain: 10, perFuel: 4, jam: 2 },
  },
  mortar: {
    name: 'Mortar Pit', desc: 'Lobs shells at enemy robots 3 to 10 tiles away, aiming where they bunch up: each shell hurts the robots within a tile and a half of where it lands (up to 6 of them). Slow to reload, and it can\'t hit anything closer than 3 tiles. Fires Ammo (3 shells each).',
    cost: { cement: 5, alloy: 3 }, ammo: 'ammo', ammoCap: 4, range: 10, minRange: 3, armor: 14, buildTime: 12, war: true,
    mortar: { reload: 5, shells: 3, damage: 6, splash: 1.5, splashDamage: 3, most: 6, flight: 1.6 },
  },
  flak: {
    name: 'Flak Gun', desc: 'A twin anti-aircraft gun. It fills the sky round enemy aircraft out to 7 tiles with bursting shells, leading them as they fly: each burst hurts any aircraft within about a tile of it. A plane can get through one quick pass, but not circling over a few of these. It can\'t hit anything on the ground. Fires Ammo (8 shells each).',
    cost: { cement: 4, alloy: 3 }, ammo: 'ammo', ammoCap: 4, range: 7, armor: 14, buildTime: 10, war: true,
    flak: { reload: 1.0, shells: 8, salvo: 2, damage: 4, splash: 1.0, speed: 14, scatter: 0.7 },
  },
  // The Keep: a big fort (see KEEP): its warbots fire from cover like a Bunker's, its roof cannon fires Crystal,
  // and its aura toughens Walls and Gates and sharpens the defences round it.
  keep: {
    name: 'Keep', desc: 'A massive fortified concrete base with a heavy twin pulse cannon on its roof. Up to 6 warbots fire from its gun slots at enemy robots within 4 tiles, with their own Ammo, and recharge inside; nothing can hit them until it falls, and it has to be captured, not knocked down. Its cannon fires Crystal out to 6 tiles. Within 7 tiles your Walls and Gates take a third less damage and slowly mend themselves, and your Pulse Turrets, Bunkers, Mortar Pits, Flak Guns and Disruptor Towers reach a tile further and fire a fifth faster. Keeps stand at least 16 tiles apart. It claims land like an Outpost, and like an Outpost your roads run straight through it (enemies have to break it to get past).',
    cost: { cement: 14, alloy: 6, chip: 2 }, mil: true, keep: true, terr: 6, garrison: 6, ammoStock: 6, armor: 60, buildTime: 24, war: true,
    ammo: 'crystal', ammoCap: 3, range: 6, gun: { damage: 5, reload: 1.3 },
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
    name: 'Roadworks', desc: 'Its Paver upgrades your roads to asphalt, the fastest surface, working outwards along the roads you mark in Paths (Pave), however far along joined roads (or every joined road, if you choose). One Asphalt covers four tiles.',
    cost: { cement: 3, alloy: 1, fiber: 2 }, staff: true, crew: 'paver', roadworks: true, armor: 8, buildTime: 10,
  },
  armory: {
    name: 'Ammo Plant', desc: 'Packs Alloy and Cement into Ammo. Haulers take it to your Command Base and Outposts, where warbots reload.',
    cost: { cement: 3, alloy: 2 }, staff: true, inp: { alloy: 1, cement: 1 }, make: { ammo: 3 }, out: { ammo: 6 },
    work: 6, armor: 10, buildTime: 10, war: true, limit: 24,
  },
  munitions: {
    name: 'Missile Factory', desc: 'Builds Missiles from 2 Alloy, 1 Chip and 1 Fuel each. They are slow and costly to make; haulers carry them to your Missile Silos.',
    cost: { cement: 4, alloy: 4, chip: 2 }, staff: true, inp: { alloy: 2, chip: 1, fuel: 1 }, make: { warhead: 1 },
    out: { warhead: 2 }, work: 20, armor: 10, buildTime: 14, war: true, limit: 4,
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
  generator: {
    name: 'Generator', desc: 'Burns Fuel to power the buildings round it: every factory, Refinery, Oil Pump and Bot Foundry within 4 tiles works a third faster while it runs. It burns one Fuel every 40 seconds, and only while something in reach is working. Tankers bring its Fuel.',
    cost: { cement: 3, alloy: 2 }, burner: { radius: 4, boost: 1 / 3, perFuel: 40 }, fuelCap: 4, armor: 8, buildTime: 10,
  },
  charger: {
    name: 'Fuel Station',
    desc: 'Bots recharge their batteries here, four at a time, and trucks fill their fuel tanks. It burns Fuel: one Fuel recharges about two and a half full batteries, or fills one truck. Build them near busy areas far from your Command Base.',
    cost: { cement: 3, alloy: 1 }, charger: { slots: 4, rate: 25, fuel: true }, fuelCap: 4, armor: 10, buildTime: 10,
  },
  farm: {
    name: 'Bio Farm', desc: 'An Agribot plants energy crops on fertile soil nearby and harvests them into Fuel. Crops take a while to ripen.',
    cost: { fiber: 2, cement: 2 }, staff: true, crew: 'agribot', farm: true, radius: 3, out: { fuel: 6 }, armor: 8, buildTime: 9,
  },
  pump: {
    name: 'Oil Pump', desc: 'Built on top of an oil seep. Its worker pumps Crude until the seep runs dry, or until you have 30 (its stock limit).',
    cost: { cement: 2, alloy: 2 }, staff: true, pump: true, inp: {}, make: { crude: 1 }, out: { crude: 6 },
    work: 6, armor: 8, buildTime: 10, limit: 30,
  },
  refinery: {
    name: 'Refinery', desc: 'Refines Crude into Fuel, one for one. Stops at 30 Fuel unless you change its stock limit. Keep it out of harm\'s way: destroyed, it explodes, the fuller the bigger, hurting everything round it.',
    cost: { cement: 4, alloy: 3 }, staff: true, inp: { crude: 1 }, make: { fuel: 1 }, out: { fuel: 8 }, explodes: true,
    work: 6, armor: 10, buildTime: 12, limit: 30,
  },
  ramp: {
    name: 'Ramp', desc: 'Workers cut a sloped road into a low cliff so bots can climb between levels. Plan it in Paths, on the top or at the foot of a cliff. A worker builds it from whichever side is the shorter trip, so a Ramp down off high ground is built from the top: nobody drives all the way round.',
    cost: { cement: 3, fiber: 1 }, ramp: true, armor: 4, buildTime: 10,
  },
  repair: {
    name: 'Repair Station',
    desc: 'Damaged robots come here to be fixed, three at a time. It uses Alloy, which haulers bring: one Alloy repairs 12 health (a whole Warbot). Warbots come when their garrison is quiet.',
    cost: { cement: 3, alloy: 2 }, repair: { slots: 3, rate: 1.5 }, alloyCap: 3, armor: 10, buildTime: 10, war: true,
  },
  wall: {
    name: 'Wall', desc: 'A thick block of Cement that nothing gets past. Enemy warbots have to go round or shoot their way through, and a Wall takes far more punishment than any other building (a Missile knocks off 24: two break it). Your own bots can\'t cross it either: leave a Gate. Planned in Paths (Walls); paid straight from storage (as the goods come in), so no Hauler or road is needed.',
    cost: { cement: 5 }, barrier: true, prepaid: true, armor: 40, buildTime: 6, war: true,
  },
  gate: {
    name: 'Gate', desc: 'A Wall with a door: your bots drive through, the enemy\'s have to break it down. A Gate on a road carries the road, so haulers keep running, and across railway track your trains run through it. Planned in Paths (Walls): where a wall line crosses a road or track, a Gate goes there.',
    cost: { cement: 6, alloy: 2 }, barrier: true, gate: true, prepaid: true, armor: 32, buildTime: 8, war: true,
  },
  ropeway: {
    name: 'Ropeway', desc: 'A cable line with gondolas, straight across anything: cliffs, water, rock. Tap one end, then the far end (up to 14 tiles away). Haulers bring the materials to the near end; once it is built the cable goes across and the far station goes up. Haulers, Workers and warbots ride it as part of your road network; Freight Trucks and Road Trains are too heavy and keep to the roads.',
    cost: { cement: 8, alloy: 6 }, ropeway: true, armor: 10, buildTime: 14,
  },
  viaduct: {
    name: 'Viaduct', desc: 'A level bridge straight across a valley or canyon, from one clifftop to another up to 12 tiles away, over ground lower than both ends: traffic down below carries on underneath. Tap one end, then the far end. It costs 3 Cement for every tile it spans and 1 Alloy for every two, paid from storage as the goods come in, and a worker builds it out from the near end. Every bot can cross, trucks and Road Trains included; lay track onto both ends and trains cross too.',
    cost: { cement: 3, alloy: 0.5 }, viaduct: true, prepaid: true, armor: 24, buildTime: 10,
  },
  lab: {
    name: 'Research Lab', desc: 'Researches upgrades for your whole colony, one at a time: pick one in its panel. The Chips, Crystal and Alloy are paid from storage when you start, and a worker inside does the research. Two Labs research twice as fast. Colony only.',
    cost: { cement: 6, alloy: 4, chip: 2 }, staff: true, lab: true, colony: true, armor: 10, buildTime: 14,
  },
  port: {
    name: 'Port', desc: 'Storage on the shore, where ships tie up (naval maps: Islands and Lakes). Container Ships and Tanker Ships carry goods between your Ports on the same water: give a far Port supply orders and ships keep it stocked, and it sends its spare goods home by ship. Give a Port a ferry line to another Port and a Ferry carries your robots and trucks across; a Ferry can also land warbots on any shore. Its shipyard builds the ships: order them on its panel, and haulers bring it the Alloy and Chips. Haulers serve it like a Depot.',
    cost: { cement: 8, alloy: 3 }, store: true, port: true, naval: true, armor: 14, buildTime: 14, yard: ['cargoship', 'tankship', 'ferry'],
  },
  airfield: {
    name: 'Airfield', desc: 'A runway and hangar for a Cargo Plane and two Strike Bombers (order them on its panel: the hangar builds them from Alloy and Chips). A plane drops a Drop Outpost anywhere on open ground nobody else holds, two Warbots or Workers wherever you like, or keeps a place you supply by air stocked, 8 goods a flight. Haulers bring the Airfield what those places are short of, and Fuel for the planes. It is storage too, like a Depot.',
    cost: { cement: 10, alloy: 4 }, store: true, airfield: true, armor: 16, buildTime: 16, yard: ['cargoplane', 'bomber'],
  },
  dropost: {
    name: 'Drop Outpost', short: 'Drop Outpost',
    desc: 'A small outpost a Cargo Plane drops by parachute, anywhere: a foothold over rough ground or far from home. It claims a little land, holds two warbots, stores goods and charges two bots from the Fuel stored in it. It is supplied by air from your Airfield (supply orders and Ammo for its warbots) until a road reaches it.',
    cost: { cement: 6, alloy: 3 }, store: true, mil: true, terr: 4, garrison: 2, ammoStock: 4, charger: { slots: 2, rate: 25, fuel: true }, armor: 14, airdrop: true,
  },
  station: {
    name: 'Rail Station', desc: 'Storage beside the railway: Freight Trains load and unload here. Build one at each end of a line (beside the track), give the far one supply orders, and trains keep it stocked from the stations on the same track; a far station also sends its spare goods home by train. Its rail yard builds Freight Trains: order them on its panel, and haulers bring it the Alloy and Chips. Haulers serve it like a Depot.',
    cost: { cement: 6, alloy: 2 }, store: true, station: true, armor: 12, buildTime: 12, yard: ['freight'],
  },
  terminal: {
    name: 'Trade Terminal', desc: 'An off-world freight exchange: it trades a full lot of one good for another, at rates below what making them yourself is worth, so a big surplus can buy what your land is running out of (the Ore, Crystal or Stone of a late game). Pick one of its contracts; Road Trains (or Freight Trains, with track beside it) bring the lot, and take the goods it pays home. Nothing smaller serves it. It has to stand well out from your Command Base, and the further out, the better it pays. One per colony.',
    cost: { cement: 12, alloy: 5 }, store: true, station: true, terminal: true, armor: 16, buildTime: 20,
  },
  crawlerbase: {
    name: 'Crawler', short: 'Crawler',
    desc: 'A deployed Crawler: storage, a Fuel Station for four bots (burning the Fuel stored in it) and an Outpost claiming the land around it, all in one. Give it supply orders like a Depot (Fuel keeps its chargers going). Pack it up to drive it somewhere else: it takes its goods along, and gives up its land.',
    cost: {}, store: true, mil: true, terr: 6, garrison: 4, ammoStock: 4, charger: { slots: 4, rate: 25, fuel: true }, armor: 24, mobile: true,
  },
  nest: {
    name: 'Creature Nest', desc: 'Creatures breed here and raid whatever a colony builds within reach. It grows as time goes on, sending bigger packs. Send warbots to clear it: the goods it has hoarded spill out for them to carry home, and the land around it is free to build on.',
    cost: {}, wild: true, armor: 45, buildTime: 1,
  },
  depot: {
    name: 'Depot', desc: 'Extra storage. Haulers drop goods at the nearest storage they can reach by road, so depots along your highways shorten trips. Give it supply orders to stock it from home: a forward base for building at the front.',
    cost: { fiber: 3, cement: 2 }, store: true, armor: 10, buildTime: 8,
  },
};

/** Order of the build menu. */
const BUILD_MENU = ['harvester', 'quarry', 'mine', 'tap', 'smelter', 'fab', 'foundry', 'charger', 'farm', 'pump', 'refinery', 'generator',
  'kiln', 'tarworks', 'roadworks', 'ropeway', 'viaduct', 'station', 'port', 'airfield', 'outpost', 'turret', 'bunker', 'keep', 'disruptor', 'mortar', 'flak', 'repair', 'armory', 'munitions', 'silo', 'reactor', 'nukesilo', 'depot', 'grower', 'lab', 'terminal'];
/** Build-menu tabs: what each building is for. */
const BUILD_GROUPS = [
  { key: 'gather', name: 'Gather', types: ['harvester', 'quarry', 'mine', 'tap', 'grower', 'farm', 'pump'] },
  { key: 'make', name: 'Make', types: ['kiln', 'smelter', 'fab', 'refinery', 'tarworks', 'foundry', 'armory', 'munitions', 'reactor', 'lab', 'generator'] },
  { key: 'move', name: 'Move', types: ['charger', 'depot', 'roadworks', 'ropeway', 'viaduct', 'station', 'port', 'airfield', 'terminal'], roads: true },
  { key: 'defend', name: 'Defend', types: ['outpost', 'turret', 'bunker', 'keep', 'disruptor', 'mortar', 'flak', 'repair', 'silo', 'nukesilo'], walls: true },
];
const BUNKER_FIRE = 0.9; // seconds between shots for each warbot in a Bunker (or a Keep)
/**
 * The Keep (BDEFS.keep): its warbots fire from cover out to `fire` tiles. Within `aura` tiles of a built Keep, its
 * owner's Walls and Gates take damage ÷ `wallMul` and, left alone for `quiet` s, mend `mend` armor a second; its
 * Pulse Turrets, Bunkers, Mortar Pits, Flak Guns and Disruptor Towers reach `range` tiles further and reload in
 * `rate` of the time. Keeps stand `spacing` tiles apart.
 */
/**
 * The Rocket Truck (BOTS.rocket): it fires a salvo of `salvo` rockets at a building `min` to `range` tiles away,
 * `gap` s apart, after `deploy` s raising its rack; each lands within `scatter` of the middle of the target's tile,
 * knocking `damage` off it (forts no lower than MISSILE_FLOOR), `splashBld` off other buildings and `botDamage` off
 * robots within `splash`. Rockets fly at `speed` tiles a second. It reloads `ammo` Ammo in `reload` s at a garrison
 * or storage of its owner's.
 */
const ROCKET = { range: 11, min: 4, salvo: 4, gap: 0.35, deploy: 2.5, damage: 5, splash: 1.2, splashBld: 2, botDamage: 4, scatter: 0.4, speed: 9, ammo: 4, reload: 6 };
/**
 * Yards: a Port's shipyard builds ships, a Rail Station's rail yard Freight Trains (BDEFS[type].yard lists
 * what each makes), a round of parts (1 Alloy, 1 Chip) every `work` s, BOTS[kind].parts rounds a vessel; it
 * keeps `hopper` of each part on hand while it has orders. The Bot Foundry doesn't build them.
 */
const YARD = { work: 8, hopper: 2 };
const KEEP = { fire: 4, aura: 7, wallMul: 1.5, mend: 0.33, quiet: 8, range: 1, rate: 0.8, spacing: 16 };
/** Ramps are planned in Paths (with roads), not from the build menu. */

const INPUT_CAP = 3;   // how many of each input a production building stockpiles (its def.hopper instead, if it has one)
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
  flare:  { name: 'Solar flare',   color: '#ffe36b', dur: [45, 60], warn: true,  desc: 'Bot batteries drain twice as fast: keep your Fuel Stations fuelled.' },
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
const TRADE_VALUE = { fiber: 1, stone: 1, ore: 1.2, crystal: 1.5, crude: 1.2, cement: 0.5, fuel: 1.5, alloy: 2.2 }; // Alloy = an Ore and a Fiber, Cement = half a Stone
const TRADE_KEEP = { fiber: 12, stone: 12, ore: 12, crystal: 10, crude: 10, cement: 20, fuel: 12, alloy: 10 };
const TRADE_BONUS = 1.3;
/**
 * The Trade Terminal (BDEFS.terminal). Each colony gets `offers` contracts at a time, new ones every `every`
 * seconds (one you've picked stays while it has lots left). A contract swaps a lot of `lot` of one good
 * (TERMINAL_GIVE) for another (TERMINAL_GET), each `lots` times at most, at `rate` of the goods' worth
 * (TRADE_VALUE): below what making them yourself is worth. A Terminal more than `minDist` tiles from the
 * Command Base pays `perTile` more for every tile further, up to `maxBonus`. Every lot sold of a good knocks
 * `sat` off what that good fetches, down to `satMin`; it recovers `recover` a minute. Only Road Trains and
 * Freight Trains serve a Terminal (and only in loads of `minLoad` or more, or what's left of the lot).
 */
const TERMINAL = { minDist: 16, lot: 30, rate: 0.65, perTile: 0.015, maxBonus: 0.25, offers: 3, every: 300, lots: 3, sat: 0.12, satMin: 0.5, recover: 0.05, minLoad: 10 };
const TERMINAL_GIVE = ['fiber', 'cement', 'alloy', 'stone', 'ore', 'crystal'];
const TERMINAL_GET = ['ore', 'crystal', 'stone', 'fiber'];

/*
 * Wildlife (a Colony option, on by default; never in missions). Creature nests sit out in the wilds,
 * owned by WILD_OWNER (the empty second player slot of a Colony game). Each keeps a few Scuttlers on
 * guard (guards + its level) and, from `first` seconds on, sends a pack every `gap` seconds at the
 * nearest thing the colony has built within `reach` tiles of it. The pack goes for bots in the open;
 * Brutes (from level 2) tear up roads and batter buildings (never below 1 armor; construction sites
 * are wrecked). After `raidTime` the pack heads home. A nest grows a level every `grow` seconds (up
 * to 3): bigger packs and more hoarded goods. Packs also grow with the colony (one more creature for
 * every `perBuildings` buildings). Nothing can be built within `clear` tiles of a nest.
 */
const WILD_OWNER = 1;
const WILD = {
  first: 420, gap: [260, 400], reach: 24, raidTime: 70, grow: 600, guards: 2, guardEvery: 45, perTiles: 800,
  perBuildings: 14, maxPack: 9, bite: 1.1, roadEvery: 4, clear: 2, loot: { crystal: 8, ore: 8, alloy: 4 },
};

/*
 * Research (Colony): a Research Lab researches one upgrade at a time for the whole colony. The cost
 * is paid from storage when research starts; `time` is seconds of work by a staffed Lab.
 */
const TECHS = {
  cargo:   { name: 'Cargo Racks', desc: 'Haulers carry 3 goods instead of 2, Freight Trucks 10 instead of 8, Road Trains 36 instead of 30 and Freight Trains 64 instead of 56.', cost: { chip: 4, crystal: 6, alloy: 6 }, time: 90 },
  cells:   { name: 'Long-life Cells', desc: 'Bot batteries drain 30% slower, and Fuel Stations charge them 50% faster.', cost: { chip: 4, crystal: 8 }, time: 90 },
  // No longer offered (folded into Long-life Cells: bots spend under 1% of their time charging); kept for old saves.
  charge:  { name: 'Fast Charging', desc: 'Fuel Stations charge bots 50% faster.', cost: { chip: 4, crystal: 6, alloy: 4 }, time: 75 },
  paving:  { name: 'Rapid Paving', desc: 'Roads, bridges and tunnels take 40% less time to lay.', cost: { chip: 3, crystal: 4, alloy: 4 }, time: 60 },
  sentry:  { name: 'Sentry Optics', desc: 'Pulse Turrets reach 1.5 tiles further and get 6 shots from each Crystal.', cost: { chip: 4, crystal: 10 }, time: 75 },
  motors:  { name: 'Turbo Motors', desc: 'Every bot moves 15% faster.', cost: { chip: 6, crystal: 8, alloy: 8 }, time: 120 },
  tools:   { name: 'Power Tools', desc: 'Workers build, gather and run buildings 15% faster.', cost: { chip: 6, crystal: 10, alloy: 6 }, time: 120 },
  nanites: { name: 'Nanite Repair', desc: 'Bots and buildings slowly mend themselves once nothing has hit them for a while.', cost: { chip: 4, crystal: 8, alloy: 4 }, time: 100 },
};
const TECH_ORDER = ['cargo', 'cells', 'paving', 'sentry', 'motors', 'tools', 'nanites'];

/** Starting goods in each Command Base. */
const START_STOCK = { fiber: 16, stone: 8, alloy: 8, chip: 4, crystal: 4, fuel: 10, cement: 24 };
const START_BOTS = { worker: 10, hauler: 5, tanker: 1, agribot: 1 };
const START_WARBOTS = 4;
const MIN_FREE_WORKERS = 2;   // workers always kept free for building

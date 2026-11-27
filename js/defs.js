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
const SITE_UNDO = 10;             // seconds after placing a construction site that it can be taken back in full (Undo, Ctrl+Z)
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
  // The Express lane (tier 3): a one-way motorway lane a tile wide, laid by the Roadworks' Paver over a road base at
  // `cost` a tile (the Alloy for the barrier, lamps and cat's-eyes only when it goes up, not when it's resurfaced). Its
  // `speed` is what a warbot (or a bot crossing it) gets: Asphalt's. Trucks go faster (EXPRESS), the rest never drive along it.
  { key: 'express', name: 'Express lane', speed: 2.75, cost: { asphalt: 1, alloy: 0.25 } },
];
/**
 * Express lanes: Road Trains run at EXPRESS.train times off-road speed on one (2x Asphalt), Freight Trucks and Tankers
 * at EXPRESS.truck (1.64x); warbots and Pavers at Asphalt speed; Haulers, Workers, Agribots and Crawlers never drive
 * along one (they cross at an overpass). Under EXPRESS.minLen tiles the Express tool says a lane is too short to pay.
 */
const EXPRESS = { truck: 4.5, train: 5.5, minLen: 8 };
/** The speed factor bot kind `bt` (a BOTS entry) gets along an Express lane, or 0 if it may not drive along one. */
function laneSpeed(bt) { return bt.train ? EXPRESS.train : bt.truck ? EXPRESS.truck : bt.army || bt.siege || bt.wild || bt.crew === 'paver' ? PAVE[2].speed : 0; }
/**
 * Biomes: the look of the planet, chosen on the new-game screen. Purely cosmetic: ground, water,
 * rock and decorative plants (`plants` is the share of open tiles with one). Plants never block
 * anything; a road, planned road or building clears the plants on its tile. `groves`: the plants
 * grow in stands of one kind (the Forest's spruces and firs here, leafy trees there, with logs and
 * ferns between) instead of a random mix. `weights`: how common each variety is (the Moon's probe wrecks are
 * rare). `desc`: the line shown on the new-game screen. (The Forest
 * keeps the key 'jungle', which saves and missions use.) `region`: its name on Ithaca I (LORE.md), used only as
 * flavour (the briefing's landing site, the loading lines): the new-game screen keeps the plain names. `silent`: no
 * Murmur live there (Lunar is Argos, the moon): no nests, no raids, whatever the setup says (see murmurGround).
 */
const BIOMES = {
  desert: { name: 'The Rust', kind: 'Red desert', region: 'the Rust', plants: 0.07, desc: 'Rust-red sand and dust under a hard sun; now and then a sandstorm.' },
  jungle: { name: 'Greenreach', kind: 'Forest', region: 'Greenreach', plants: 0.44, groves: true, desc: 'Stands of spruce and leafy trees, ferns and clear lakes; now and then a rainstorm with fog.' },
  polar: { name: 'The Polar Caps', kind: 'Polar snow', region: 'the Polar Caps', plants: 0.1, desc: 'Snow, ice and frosted shrubs; now and then a blizzard.' },
  autumn: { name: 'Emberwood', kind: 'Autumn forest', region: 'Emberwood', plants: 0.44, groves: true, desc: 'The forest in its fall colours: maples, birches and oaks in red and gold over a carpet of leaves; now and then a gale.' },
  savanna: { name: 'The Long Grass', kind: 'Savanna', region: 'the Long Grass', plants: 0.12, desc: 'Golden grassland with umbrella acacias, baobabs and termite mounds; now and then dust devils.' },
  swamp: { name: 'Blackwater', kind: 'Swamp', region: 'Blackwater', plants: 0.38, groves: true, desc: 'Dark mud, stands of cypress and mangrove, reeds and duckweed; now and then a thick fog, with fireflies at night.' },
  volcanic: { name: 'Cinderlands', kind: 'Volcanic ashlands', region: 'Cinderlands', plants: 0.1, desc: 'Black basalt and ash, charred trees and fumaroles, lakes of lava that glow at night; now and then ash and embers fall.' },
  lunar: { name: 'Argos', kind: 'Lunar: the moon', region: 'Argos, the moon', plants: 0.12, weights: [1, 1, 1, 1, 1, 0.12], silent: true, desc: 'Grey regolith pocked with craters, frozen cryo-ice pools and the odd wreck of an old probe; now and then ring dust streaks overhead. No Murmur live here.' },
  alien: { name: 'The Bloom', kind: 'Alien bloom', region: 'the Bloom', plants: 0.3, desc: 'Violet moss and strange growths that glow after dark, beside pink lakes; now and then an aurora.' },
  springs: { name: 'Steamwells', kind: 'Geothermal basin', region: 'Steamwells', plants: 0.13, weights: [1, 0.85, 0.63, 0.34, 1.15, 0.46],
    desc: 'Turquoise and amber hot springs on sulfur-stained limestone terraces. Steam drifts off the vents, and geysers break the surface.' },
  tropical: { name: 'The Shoals', kind: 'Tropical islands', region: 'the Shoals', plants: 0.30, groves: true, navalOnly: true,
    desc: 'White coral sand, coconut palms, and clear turquoise water over the reefs. Available on naval maps.' },
  // The Hollow's own underground look: forced by its map type (SHAPE_PRESETS hollow), never offered by the biome picker
  // (it isn't in BIOME_ORDER). Its own art (art/biomes/hollow) loads only when it is played (LAZY_BIOMES in render.js).
  hollow: { name: 'The Hollow', kind: 'Underground caverns', region: 'the Hollow', plants: 0.1, desc: 'Caverns under the Bloom, always night: violet Bloom on the walls, black lakes, chasms, and daylight only down the breach shafts; now and then the ceiling trembles.' },
};
/**
 * Biomes drawn with another biome's art (ground, water, rock, plants, cliffs, glow) until their own is installed: one
 * line per biome, e.g. { hollow: 'alien' } while the Hollow wore the Bloom's. None now.
 */
const BIOME_ART = {};
/** The biome whose art draws biome b. */
function artBiome(b) { return BIOME_ART[b] || b; }
// (New biomes go on the end: the new-game screen saves the choice as its place in this list.)
const BIOME_ORDER = ['desert', 'jungle', 'polar', 'autumn', 'savanna', 'swamp', 'volcanic', 'lunar', 'alien', 'springs', 'tropical'];
function biomeAllowed(key, shape) {
  return Object.prototype.hasOwnProperty.call(BIOMES, key) && (!BIOMES[key].navalOnly || !!(NAVAL_ON && SHAPE_PRESETS[shape]?.naval && !SHAPE_PRESETS[shape].river));
}
/** Mixed scenery belongs on the largest surface maps on Ithaca I. Argos is a separate world. */
function secondBiomeAllowed(key, primary, size, shape) {
  return (size === IMMENSE_SIZE || size === PLANETARY_SIZE) && !SHAPE_PRESETS[shape]?.hollow && primary !== 'lunar' && primary !== 'hollow' &&
    key !== primary && key !== 'lunar' && BIOME_ORDER.includes(key) && biomeAllowed(key, shape);
}
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
/*
 * Warbots on the march keep to the roads in single file: each walks WARBOT_GAP behind the warbot of its own
 * side ahead of it in its lane (not behind trucks, nor one that's fighting or breaking down a Gate), and
 * spreads out again for its last WARBOT_SPREAD tiles. Off the road they pay WARBOT_OFFROAD times as much
 * for a tile when planning a route, so a squad keeps to the roads a little longer.
 */
const WARBOT_GAP = 0.45, WARBOT_SPREAD = 3, WARBOT_OFFROAD = 1.3;
// A squad drawn from several places sets off so as to arrive together (paceSquad): a warbot with a shorter walk than
// the longest waits where it stands for the difference, PACE_MAX seconds at most; under PACE_MIN it doesn't bother.
const PACE_MAX = 45, PACE_MIN = 2;
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
const REPAIR_IDLE = { foes: 9, reach: 30 }; // an idle warbot with any damage goes to a Repair Station within `reach` tiles, if no enemy robot or gun is within `foes`
const REPAIR_RETREAT = 0.35;      // a warbot this badly hurt pulls out of a fight for repairs (if a Repair Station can fix it)
// A rival AI's danger spots (see noteDanger): how near one counts, how long the first death keeps it, and the longest it lasts.
const DANGER_R = 4, DANGER_TIME = 180, DANGER_MAX = 900;
const FUEL_ENERGY = 200;          // battery points one Fuel gives at a Fuel Station (2 full charges)
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
    desc: 'A road crew bot. A Roadworks takes two: they lay your planned roads, twice as fast as a Worker, and surface roads with asphalt.' },
  // The earthmover (see TERRA): it works the Terraform plans (Build → Terraform) and nothing else.
  grader:  { name: 'Grader', plural: 'Graders', speed: WORKER_SPEED * 0.6, hp: 12, grader: true, offroad: true, parts: 3,
    desc: 'A slow tracked earthmover with a blade. It does your Terraform plans (Build → Terraform: raise, lower, flatten, fill shallows, dig a channel) and nothing else: dug earth comes out as Stone, and raised or filled ground takes Stone.' },
  roadtrain: { name: 'Road Train', plural: 'Road Trains', speed: WORKER_SPEED * 1.35, hp: 14, haul: true, truck: true, train: true, mixed: true, carry: 30, roadOnly: true, parts: 4, accel: 1.0, brake: 2.5,
    desc: 'A truck pulling two trailers: 30 goods at once, several kinds in one trip, for bulk runs between your Command Base and far Depots (keeping a far Depot stocked with what the buildings round it need, filling supply orders, and bringing a far Depot\'s spare goods home). One does the work of about three Freight Trucks on a long asphalt run, on less Fuel. It only pays off on asphalt: on plain road it crawls. Slow to start and stop, it wears roads hard and holds up the traffic behind it.' },
  freight: { name: 'Freight Train', plural: 'Freight Trains', speed: WORKER_SPEED * 3.4, hp: 30, haul: true, rail: true, mixed: true, carry: 56, parts: 5, accel: 0.85, brake: 1.6,
    desc: 'A locomotive and four wagons: 56 goods at once, several kinds in one trip, between Rail Stations on the same track, fast and with no traffic to wait for. It runs the line on its own: out with what the far station needs once that fills a good share of its wagons (sooner if the station runs low), home with the far station\'s spare goods. It never needs charging or Fuel. Order it at a Rail Station: its rail yard builds it from Alloy and Chips and it rolls out onto that station\'s track. Tap a train to have it armored: plating and two guns, a pulse cannon and a flak gun.' },
  // Ships (naval maps only): they sail open water between Ports (passing under bridges), burning Fuel (SHIP_BURN).
  cargoship: { name: 'Container Ship', plural: 'Container Ships', speed: WORKER_SPEED * 2.4, hp: 30, haul: true, sea: true, carry: 40, parts: 5, accel: 0.5, brake: 1.0, naval: true,
    desc: 'Carries 40 goods at once between your Ports on the same water: supply orders at a Port are filled from the other Ports, and a far Port sends its spare goods home to the Port nearest your Command Base. It burns Fuel under way and fills up at a Port (each Port keeps a little Fuel for its ships). It puts to sea at the nearest Port when the Foundry finishes it.' },
  tankship: { name: 'Tanker Ship', plural: 'Tanker Ships', speed: WORKER_SPEED * 2.4, hp: 26, haul: true, sea: true, tankShip: true, carry: 40, parts: 5, accel: 0.5, brake: 1.0, naval: true,
    desc: 'Carries 40 Crude or Fuel at once between your Ports on the same water (and nothing else). Sunk with a load on board, it explodes, hurting everything round it.' },
  ferry: { name: 'Ferry', plural: 'Ferries', speed: WORKER_SPEED * 2.8, hp: 26, sea: true, ferry: true, seats: 6, parts: 4, accel: 0.7, brake: 1.4, naval: true,
    desc: 'Carries robots and trucks across the water. Give a Port a ferry line to another Port and your bots take the ferry whenever it is the shorter way (six seats: a truck takes two, a Road Train three). From a Port it can also land up to six warbots on any shore, enemy shores too: a beach landing.' },
  // Aircraft: they fly straight over anything (water, cliffs, rock, the enemy), burning Fuel (PLANE_BURN), from an Airfield.
  bomber: { name: 'Vulcan Bomber', plural: 'Vulcan Bombers', speed: WORKER_SPEED * 5.2, hp: 16, air: true, war: true, bomber: true, parts: 5, accel: 1.3, brake: 1.6, turn: 1.5, // a jet: it turns tighter, about the Cargo Plane's circle at its speed
    desc: 'A fast twin-engined strike jet, based at an Airfield (two to a hangar; built there). Pick a target, an enemy building, or a truck, Tanker, ship or robot out in the open, and it flies out, drops one heavy bomb and flies home: it knocks 14 off a building (forts no lower than a third of their armor) and hurts what\'s round it, and a Tanker it hits explodes. Each sortie takes 6 Ammo and 3 Fuel from its Airfield, on top of the Fuel in its tank (it can\'t take off without them), and it needs a while on the ground to rearm. Flak Guns are the answer to it.' },
  cargoplane: { name: 'Cargo Plane', plural: 'Cargo Planes', speed: WORKER_SPEED * 3.75, hp: 24, air: true, carry: 8, seats: 2, parts: 6, accel: 0.9, brake: 1.3,
    desc: 'A big four-engined transport, based at an Airfield. It flies straight over anything and drops what it carries by parachute, one load a flight: a Drop Outpost anywhere on open ground nobody else holds, two robots (Warbots or Workers) wherever you like, the enemy\'s land too, or up to 8 goods for a place you supply by air. It burns Fuel in the air and fills up at its Airfield: a full tank takes 5 Fuel, a long round trip 4 to 6. It flies to the nearest Airfield when the Foundry finishes it.' },
  // The Maglev pod (see MAGLEV): built at a Maglev Terminal's pod bay, it runs the guideway between the Terminal's line's two ends.
  magpod: { name: 'Maglev Pod', plural: 'Maglev Pods', speed: WORKER_SPEED * 3.4 * 3, hp: 12, haul: true, magpod: true, mixed: true, carry: 16, parts: 2, round: { alloy: 2, chip: 1 }, accel: 0.85 * 4, brake: 1.6 * 4,
    desc: 'A sleek freight pod on a Maglev line: 16 goods a trip, several kinds at once, at three times a Freight Train\'s top speed. It runs the line by itself, both ways, loading what the far Terminal needs and bringing its spare goods home, and dwells at each end to load. Goods only: no riders. It needs power: with a Generator within 4 tiles of each Terminal it flies; without (or in a solar flare) it crawls at a Worker\'s pace. Order it at a Maglev Terminal (4 Alloy, 2 Chips; four to a line). A pod on a span whose pylon is shot down is lost with its load.' },
  // The Airship (see AIRSHIP): built in an Airfield's hangar, it lives on a line between two Mooring Masts, not at the Airfield.
  airship: { name: 'Airship', plural: 'Airships', speed: WORKER_SPEED * 1.875, hp: 40, air: true, airship: true, carry: 24, seats: 6, parts: 9, accel: 0.35, brake: 0.45,
    desc: 'An armoured freight airship that shuttles between two Mooring Masts, both ways, over anything (water, cliffs, rock), at half a Cargo Plane\'s speed. It carries up to 24 goods a trip, several kinds at once (each side sends what the buildings round the other side need, and the far side\'s spare goods come home), and six Workers or Warbots who ride it like a ferry. Built in an Airfield\'s hangar, it flies to its line and lives at its Masts. It burns Fuel in the air and fills up at either Mast. Unarmed, and Flak brings it down.' },
  crawler: { name: 'Crawler', plural: 'Crawlers', speed: WORKER_SPEED * 0.45, hp: 80, crawler: true, parts: 6,
    desc: 'A colossal tracked base on the move. Drive it anywhere it can roll (no road needed) and it deploys where it stops: a Depot, a Fuel Station and an Outpost in one, claiming the land around it. Pack it up to move on: it takes everything stored in it along.' },
  truck:   { name: 'Freight Truck', plural: 'Freight Trucks', speed: WORKER_SPEED * 1.35, hp: 8, haul: true, truck: true, carry: 8, roadOnly: true, parts: 2, accel: 1.5, brake: 3.5,
    desc: 'A heavy road truck that carries eight goods at once on the long runs: between your Command Base and Depots, and to anything far away. Slower than a Hauler on concrete, fastest of all on asphalt.' },
  tanker:  { name: 'Tanker', plural: 'Tankers', speed: WORKER_SPEED * 1.35, hp: 8, haul: true, truck: true, tanker: true, carry: 10, roadOnly: true, parts: 2, accel: 1.4, brake: 3.2,
    desc: 'A tank truck, the only vehicle that carries Crude and Fuel: ten at a time, wherever they need to go (Haulers carry them only when no Tanker can get there, one at a time). Fastest on asphalt. Destroyed with a load on board, it explodes, hurting everything round it, and can set off other Tankers nearby.' },
  rocket:  { name: 'Howitzer', plural: 'Howitzers', speed: WARBOT_SPEED * 0.9, hp: 16, war: true, siege: true, parts: 3, accel: 0.9, brake: 2.2,
    desc: 'Mobile artillery for breaking defences. Send it at an enemy building (or let it pick one in reach while it waits): it drives to within 13 tiles, digs in (about 7 seconds), then fires one heavy shell every 5 seconds, over and over until the target is rubble or its 12 shells are spent. Each shell does 4 damage, double (8) to defences (turrets, bunkers, mortars, flak, Minigun Nests, walls, gates, outposts) but little to robots. Dug in it can\'t move: it takes 4 seconds to pack up. On your own ground near a road, haulers bring it Ammo where it stands; otherwise it packs up, reloads 3 Ammo at a garrison or storage and comes back. Nothing closer than 4 tiles.' },
  warbot:  { name: 'Warbot', plural: 'Warbots', speed: WARBOT_SPEED, hp: 12, war: true, army: true,
    desc: 'Fights enemy bots and captures enemy buildings. Shoots Ammo; with none it can only scuffle.' },
  // The army's two specialists (see BULWARK and TORCH): they garrison, rally, attack, reload and get repaired like warbots.
  bulwark: { name: 'Bulwark', plural: 'Bulwarks', speed: WARBOT_SPEED * 0.72, hp: 30, war: true, army: true, shield: true, parts: 3, range: 1.6,
    desc: 'A heavy shield robot. A purple energy shield stands across its front and stops fire coming from ahead, for it and for the robots sheltering behind it, until the shield is worn down (it comes back after a rest). Shells, bombs and missiles come down over it, and fire from the side or behind gets round it. Its own twin blasters are weak: it leads warbots in, it doesn\'t fight alone.' },
  torch:   { name: 'Torch', plural: 'Torches', speed: WARBOT_SPEED * 0.9, hp: 18, war: true, army: true, flame: true, parts: 2, range: 1.9,
    desc: 'A flamethrower robot. A short cone of fire burns every enemy robot in it and eats through buildings, defences and Walls fastest of all. It burns Fuel: a full tank lasts about 12 seconds of fire, refilled from Fuel kept at your Command Base, a Depot or a Fuel Station. Destroyed with fuel aboard, it explodes.' },
  // The three answers to a Bulwark blob (see SKIRM, ARC and RAIL): they garrison, rally, attack, reload and get repaired like warbots.
  skirmisher: { name: 'Skirmisher', plural: 'Skirmishers', speed: WARBOT_SPEED * 1.55, hp: 9, war: true, army: true, flank: true, parts: 1, range: 1.3,
    desc: 'A fast, light raider on four big tyres. It runs round a Bulwark\'s shield and shoots it in the side or the back (double damage), and hunts Railgunners, Arc Casters and Howitzers (half again) and Workers before warbots. Every few seconds it dashes. It shoots Ammo like a warbot but has little armour: massed warbots and Minigun Nests cut it down.' },
  arccaster: { name: 'Arc Caster', plural: 'Arc Casters', speed: WARBOT_SPEED * 0.85, hp: 12, war: true, army: true, arc: true, parts: 2, range: 2.0,
    desc: 'Throws chain lightning: each bolt hits one enemy robot and jumps on to up to three more close by, weaker each jump, so it punishes robots packed together. Lightning eats a Bulwark\'s shield three times as fast as gunfire. Its capacitors hold 10 bolts and recharge with Crystal (5 bolts each) at your Command Base or a Depot. Short reach and thin armour: Skirmishers that get in close tear it apart.' },
  railgunner: { name: 'Railgunner', plural: 'Railgunners', speed: WARBOT_SPEED * 0.7, hp: 16, war: true, army: true, railgun: true, parts: 3, range: 5, mag: 4, ammoShots: 2,
    desc: 'A slow, long-barrelled gun robot. It charges its rail (a glint at the muzzle), then fires one heavy slug up to 5 tiles at where its target was: it goes straight through every enemy robot in that line, and through a Bulwark\'s shield into the Bulwark. Then a long reload. A quick robot can dodge it. Each Ammo is two slugs; it holds four. Up close it has only a weak sidearm: Skirmishers that reach it win.' },
  // The Murmur (Colony, see WILD): creatures from nests (type 'nest'). Not built, never ordered.
  scuttler: { name: 'Scuttler', plural: 'Scuttlers', speed: WORKER_SPEED * 1.1, hp: 6, wild: true, bite: 1,
    desc: 'The smallest of the Murmur, quick and never alone. Scuttlers run in packs and go for any bot they catch out in the open.' },
  brute:    { name: 'Brute', plural: 'Brutes', speed: WORKER_SPEED * 0.8, hp: 24, wild: true, bite: 3, smash: true,
    desc: 'A big, slow, armoured creature of the Murmur. Brutes tear up roads, batter buildings and smash bots.' },
  // Their other forms (the Murmur on Active only, in the night packs from MURMUR.forms' nights: see murmurForms).
  leech:    { name: 'Leech', plural: 'Leeches', speed: WORKER_SPEED * 1.05, hp: 8, wild: true, bite: 0.5, drain: true,
    desc: 'A Murmur that feeds on charge. It latches onto a Fuel Station, a Generator or a streetlamp and drinks: the lights go out round it, bots charging there run down, and what it drinks goes back to its nest, which grows faster. Kill it and the power comes back once the building is repaired.' },
  spitter:  { name: 'Spitter', plural: 'Spitters', speed: WORKER_SPEED * 0.9, hp: 10, wild: true, bite: 1, spit: true,
    desc: 'A Murmur that hangs back behind the Brutes and spits conductive slurry at a gun or a Wall from a few tiles off: it eats at it, and a gun it hits shorts out for a few seconds and fires at nothing.' },
  sapper:   { name: 'Sapper', plural: 'Sappers', speed: WORKER_SPEED * 0.85, hp: 16, wild: true, bite: 2, smash: true, sap: true,
    desc: 'A Murmur that digs. It goes down outside your Walls and guns, tunnels under them and heaves up inside, by what they were guarding. Nothing reaches it underground; catch it as it comes up. Its tunnel stays, for the others.' },
  // The behemoth (HARROW; harrowTick in js/sim.js): the biggest of the Murmur, late and rare (the Hollow's mound, the
  // campaigns, now and then a long game on Active). Not a nest's: it walks at a colony and only a real army stops it.
  harrow:   { name: 'Harrow', plural: 'Harrows', speed: WORKER_SPEED * 0.45, hp: 240, wild: true, bite: 10, behemoth: true,
    desc: 'The biggest of the Murmur: a badger-mole the size of a hill, its back a mantle of crystal plate. It walks straight at a colony and the ground breaks under it: the roads, track and pipes it walks over are torn up, and every few seconds it rears and slams the ground, stunning every robot within 3 tiles and breaking the Walls, guns and buildings there. Small arms (warbots, Bulwarks, Skirmishers, turrets, Minigun Nests, Bunkers) do a quarter of their damage to it; Railgunners, Howitzers, Mortars, Rockets, Torches, bombs and Missiles do it all. Scuttlers ride on its back and drop off when it slams, and a pack comes with it. Only a real army brings it down: meet it in the open, spread out, before it reaches your walls.' },
};
const BOT_ORDER = ['worker', 'hauler', 'truck', 'tanker', 'roadtrain', 'freight', 'cargoship', 'tankship', 'ferry', 'cargoplane', 'bomber', 'airship', 'magpod', 'crawler', 'agribot', 'paver', 'grader', 'warbot', 'bulwark', 'torch', 'skirmisher', 'arccaster', 'railgunner', 'rocket'];
/**
 * Unit types switched off for now, for everyone: no Bot Foundry (yours or a rival's) makes them, the menus leave them
 * out, and any in a saved game are taken out when it loads (see botBanned, dropOffBots). Take a type out of this set
 * to bring it back: all its code is still there.
 */
const BOTS_OFF = new Set(['rocket']); // the Howitzer (BOTS.rocket)
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
 * missile or a nuke, not dismantled), explodes: radius r0 + r1 × how full it was, hurting every robot
 * (bot) and building (bld) in it, whoever's they are, at full strength in the middle and half at the
 * edge. Loaded Tankers and Refineries caught in a blast go up too, chain[0] to chain[1] seconds later.
 * A wrecked Refinery's Crude and Fuel burn in the blast instead of spilling.
 */
const BLAST = {
  tanker: { r0: 0.7, r1: 0.6, bot: 4.5, bld: 3 },
  torch: { r0: 0.55, r1: 0.55, bot: 4, bld: 2 }, // a Torch going up with fuel aboard
  refinery: { r0: 1.5, r1: 0.9, bot: 6, bld: 5 },
  fueltank: { r0: 1, r1: 2.8, bot: 8, bld: 7 }, // a Fuel Tank: far bigger, full (empty, little more than its shell)
  chain: [0.25, 0.7],
};
/*
 * Feed links: a production building feeds a neighbour (any of the 8 tiles round it) that uses what it makes
 * straight across, by a short conveyor (a pipe for Crude and Fuel), with no Hauler: one good every FEED_TIME
 * seconds a link. A building being fed works FEED_BOOST faster. Each producer feeds at most FEED_MAX
 * neighbours (side by side before corners). A Refinery also passes Crude on from its intake (to an Asphalt
 * Plant beside it, say). Storage never takes part: a link moves goods between factories, it makes none.
 */
const FEED_TIME = 2, FEED_BOOST = 0.1, FEED_MAX = 2, FEED_MAX_TANK = 4; // (a Fuel Tank, an oil bloc's hub, feeds up to four)
const FEED_NB = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
const TRUCK_MIN_DIST = 12;
const HAUL_FAR = 12, HAUL_NEAR = 6; // a short Hauler run waits for a Hauler finishing within HAUL_NEAR of the pickup rather than send one from over HAUL_FAR away
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
const AI_FORTRESS_SPAN_AT = 600; // the rival Viaducts onto an enemy's mesa or plateau from 10 minutes in (see aiFortressSpan)
const VIA_MIN = 2, VIA_MAX = 12, VIA_RISE = 2, VIA_COST = { cement: 3, alloy: 0.5 }, VIA_TIME = 5; // cost a tile spanned (Alloy rounded up)
const VIA_CLAIM = 3; // a Viaduct's far end claims the no-one's ground this far round it
/**
 * The Maglev line (BDEFS.magterm, BDEFS.magpylon, BOTS.magpod): an elevated guideway on pylons, straight across
 * anything, between two Maglev Terminals `min` to `max` tiles apart. A Terminal is on up to `hub` lines (a hub: b.line,
 * then b.magMore), so lines join into a network the pods run through, line by line. Planned in Paths (Maglev) with two
 * taps: a built Terminal of yours (the near end), then the far end (a clear spot where the far Terminal goes up, a
 * Terminal site, or a built Terminal); a line the straight way can't go (a blocked stretch, or longer than `max`) may
 * be routed via a new hub Terminal on the way (magRouteVia). A pylon stands every `spacing` tiles from the line's key
 * end (magSpots: the near Terminal, or the far one when the near one keys a line already), on open ground, a cliff top,
 * shallow water or over a road or track (its feet at the side: the way stays open), never on a building; a blocked spot
 * shifts to a shoulder tile; a spot in a chasm or rock is left out as long as the pylons either side of it stand, so a
 * line crosses a gap of up to `gap` tiles (two spans). The line costs `cost` a tile (and the far Terminal its own cost
 * when it's new), paid from storage as the goods come in like a Viaduct, and a Worker standing at the near Terminal
 * builds it out, `time` seconds a tile, the pylons going up one by one and the far Terminal last. Pods (`perLine` for
 * each line of a network, built at any of its Terminals' pod bays) carry BOTS.magpod.carry goods both ways, planned as
 * a Freight Train's loads are (railPlan: the far Terminals stock what the buildings round them need, each Terminal
 * keeps what the ones beyond it want, spare goods come home): a pod sets out once `fill` of its hold is worth it,
 * sooner when the far side runs low, or with at least `least` after `wait` s, dwelling `dwell` s at each end. Power: a
 * Generator with Fuel in it within its own radius of each Terminal, or a Thermal Plant's reach (magPowered, thermalNear); without one at either end, or in a
 * solar flare, the pods crawl at WORKER_SPEED. A pylon shot down (a Wall's toughness) cuts the line: pods stop short
 * and go back, one on the spans that rested on it is lost; a Worker from the nearer Terminal rides out and rebuilds it
 * in `repair` s at `spacing` tiles' cost. A Terminal lost suspends its lines (the guideway and pylons stand) until one
 * is built on its tile again (half a Terminal's cost, rounded up, from the panel: magRebuildCost). A line may bend at up
 * to `bends` pylons (each straight stretch `seg` to `max` tiles, `maxBent` in all, turning at most `turn` degrees at a
 * bend); a pod slows to `corner` of its top speed round a sharp bend, and through a hub, where it keeps the goods for the
 * Terminals beyond aboard and carries on (podThrough). The Architect builds a line to a far cluster of its own when the
 * haul is long and it has the Alloy and Chips (aiMaglev).
 */
const MAGLEV = { min: 6, max: 40, spacing: 3, gap: 6, cost: { alloy: 1, chip: 0.5, cement: 1 }, time: 3, perLine: 4, hub: 3, bends: 4, maxBent: 60, seg: 3, turn: 120, corner: 0.35, fill: 0.5, wait: 60, least: 2, dwell: 2.5, repair: 20,
  deck: 0.343, head: 0.464, podFrame: 1.0 }; // (drawing: the deck top this far up the screen over a pylon's foot, a Terminal's dock over its tile centre, the pod's frame in tiles)
/**
 * The Mass Driver and its Catcher (BDEFS.mdriver, BDEFS.catcher): a coil-gun line that throws sealed canisters of goods
 * in an arc over everything, both ways. The Driver is aimed (b.mdTo) at a Catcher `min` to `max` tiles away: the two
 * are one line, and either end fires to the other (a Catcher may take up to `drivers` Drivers, firing to each in turn). Both
 * are storage. Supply is automatic (mdPlan, every 2 s): the end farther from the Command Base (b.mdFar) stocks what the
 * buildings round it need (b.auto, as a far Rail Station does: within STATION_REACH, nearer it than the Command Base,
 * touching it, by road or on foot), and the other end ships what it lacks (b.mdAuto: {partner id: {good: n}}), out of
 * what its colony holds beyond `reserve` of each (Haulers bring it, up to `hopper`); what the far end holds beyond its
 * own needs that nothing round it uses goes home the other way. A goods list (b.mdSend: up to `goods` goods, each with
 * the reserve its colony keeps at home) overrides an end's automatic shipments: it sends just those. A Driver may be
 * aimed at one of its colony's `forts` (an Outpost or a Keep) instead, one way: it keeps that fort's Ammo (and a Keep's
 * Crystal) topped up. A full canister is `load` goods (a part load goes after `partWait` s with `partMin` or more, or
 * the whole of a smaller need); the coils charge for `charge` s, then it fires, `reload` s between shots at each end,
 * or `reloadLand` s when a robot could walk from one end to the other (mdOverland: then it is a shortcut over land, not
 * a crossing; the owner, Nov 26 2026). A Catcher takes `drivers` Drivers at most.
 * The flight takes `flight` s at full range (`flightMin` at the shortest), its arc `arc` tiles high at full range. Fuel
 * flies in sealed drums (no Crude), shipped beyond a reserve of `fuelReserve` (the far end's Generator powers its shots
 * home); a rival's automatic shipments keep `aiReserve` of a good, not `reserve` (its Alloy and Chips never sit in
 * storage). Power: an end fires only with a Generator (with Fuel) within the Generator's radius, or a Thermal Plant
 * within its reach (magPowered, thermalNear), and each shot takes `shot` seconds of that Generator's work, half a Fuel
 * (mdShotPower; the economy audit of Nov 26 2026, owner-approved), none on a Thermal Plant's; without either it waits
 * (it still catches). The far end's cap, `full`, counts each good on its own. A canister has `hp`: an enemy Flak Gun
 * can burst it in flight (a canister low over either end, the first and last `low` of its flight, is out of reach), and
 * its cargo falls as crates where it comes down; if its end is gone when it lands, it lands anyway, as crates. None in
 * the Hollow (nothing flies under the cavern roof).
 * A Driver can also throw a Catcher kit (mdKit: the Catcher's cost, loaded at the Driver) to open ground `min` to `max`
 * tiles away that no one else holds (no Trade Post's ground): it lands as a Catcher site that assembles itself in
 * `kitBuild` s (no Worker needed), claims the land `kitClaim` tiles round it (b.claim, as a Port founded by sea does),
 * and the Driver is aimed at it: a foothold on an island or a mesa with none. Flak can burst it like any canister.
 * A far end nothing collects from fills up: past `full` of a good there (or what it keeps, if more), no more of it is
 * shipped there ("Far end full"). The rival builds a pair to an island or mesa it holds that no road reaches (aiMassDriver).
 */
const MASSDRIVER = { min: 12, max: 50, kitClaim: 3, kitBuild: 20, full: 64, goods: 3, reserve: 20, fuelReserve: 6, aiReserve: 6, shot: 20, reserveStep: 10, reserveMax: 200, hopper: 32, load: 16, partWait: 20, partMin: 4, charge: 1.6, reload: 8, reloadLand: 10, drivers: 2,
  flight: 4, flightMin: 2, arc: 6, hp: 4, low: 0.1, feed: 1, forts: ['outpost', 'keep'], muzzle: 0.55, catch: 0.42 }; // (drawing: the muzzle this far up the screen over the Driver's tile centre, the cradle over the Catcher's)
/*
 * Freight rail: track (S.rail) is laid in Paths (Rail), RAIL_COST a tile, paid when you build it and
 * laid at once, on open ground you hold or no-one does; it climbs a level at a time over a Ramp (RAIL_GRADE
 * speed there), like a road. It can cross a
 * road: a level crossing, where road traffic waits while a train is within RAIL_CROSS_HOLD tiles.
 * Rail Stations stand beside the track; Freight Trains (56 goods) run between stations on the same
 * track: supply orders at a station (from another station first) and a far station's trunk runs to
 * the station nearest the Command Base, with loads of RAIL_MIN_LOAD or more.
 */
const RAIL_COST = { cement: 1.5, alloy: 0.25 }; // mostly Cement (sleepers and ballast): Alloy is too scarce for a long line to cost a bar a tile
const RAIL_MIN_LOAD = 10;
/*
 * Rail logistics. A Rail Station stocks itself (its Auto supply, on unless it's switched off on its panel),
 * once a Freight Train runs on its track. A far station (one further from the Command Base than another
 * station on its track) keeps what the buildings round it need: those within STATION_REACH tiles of it,
 * and nearer to it than to the Command Base by STATION_NEARER: twice what each holds of its inputs and
 * Ammo, and what a construction site still lacks (none of what the buildings round it make themselves).
 * The station on the line nearest the Command Base, its home station, keeps what the far stations keep,
 * so a train can load at once. Each good is kept up to RAIL_AUTO_MAX. A train sets out when it can fill
 * RAIL_FILL of its wagons, or sooner when a far station is running low (a third of what it keeps) or out
 * of something, taking every good the far station is short of in one trip. Trucks leave the buildings a
 * far station serves to the train, unless one has run dry with nothing coming.
 * Station conveyors: a Rail Station hands goods to the factories touching it (any of the 8 tiles round it)
 * and takes their output, a good a link every STATION_FEED seconds, and swaps stock with a Command Base or
 * Depot touching it, STATION_SWAP goods at a time: what it keeps comes from the store, and (at the home
 * station) what trains bring in beyond that goes into the store.
 */
const STATION_REACH = 9, STATION_NEARER = 4, RAIL_AUTO_MAX = 60, RAIL_FILL = 0.45, STATION_FEED = 1, STATION_SWAP = 6;
const STORE_BESIDE = 4; // a truck that delivered to a building takes home what waits in storage this close to it
/*
 * Pipelines carry Crude and Fuel. Pipe is laid in Paths (Pipes): drag from one building to
 * another and it finds its own way there. PIPE_COST a tile, paid from storage and laid at once (or as
 * the goods come in), on any ground you hold or no-one does: over roads and track, under buildings, up and
 * down cliffs. A pipe joins every building it runs under or beside. Every second each pipeline moves
 * up to PIPE_RATE Crude: from Oil Pumps to the Refineries and Asphalt Plants on it (a Refinery keeps
 * up to PIPE_FILL), then to storage on it; and from storage on it to its Refineries. And up to PIPE_RATE
 * Fuel: from Refineries and Bio Farms to what burns it (Fuel Stations, Generators, Flame Towers, the
 * Missile Factory), then to storage on it; and from storage on it to what burns it. A piped pump's Crude
 * never waits for a Tanker, nor does Fuel made on a line with storage, and nothing on a line that has Fuel
 * to give waits for a Tanker to bring it. Raids, missiles and fuel blasts break pipe: a broken tile is
 * planned again at once and relaid when it's paid for.
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
const PIPE_RATE_TANK = 8; // a pipeline with a Fuel Tank on it moves twice as much (its pumping station)
const PIPE_DRY = 20; // something on a Fuel line that has sat empty this long gets Fuel by Tanker again
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
 * Road crews. At most a colony's road crew limit of Workers (P.roadCrew: one of ROAD_CREWS, set on the Roads tool in
 * Paths; ROAD_CREW unless set, 0 = no limit) lay planned road at once, so a long highway doesn't take every Worker
 * off building. A Roadworks' Pavers lay planned road too, PAVER_LAY times as fast as a Worker, and don't count toward
 * it. A Worker laying road goes to a construction site within PAVE_LEAVE tiles that is waiting for a builder (when no
 * free Worker is as near): building comes first.
 */
const ROAD_CREWS = [2, 3, 5, 0];
const ROAD_CREW = 3;
const PAVER_LAY = 2;
const PAVE_LEAVE = 10;
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
const RELOAD_REACH = 16;          // a warbot out of Ammo on an attack reloads and comes back (once) when a garrison with Ammo is this near (startReload)
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
function bridgeable(t) { return S.terrain[t] === T_WATER || (S.terrain[t] === T_CHASM && !voidTile(t)); } // (not the void of The Ring: only a Viaduct or Ropeway spans it)
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
/*
 * Terraforming, stage 1 (Build → Terraform; a Grader does the work, see tfPlace and completeEarthwork in sim.js).
 * One job per tile. Raise or lower it a level (a flatten moves it as many levels as it takes to reach its target):
 * `time` seconds of a Grader's work for each level of earth moved; raising costs `stone` Stone a level, lowering yields
 * `dug` (less than it costs, so a Grader is no better a Quarry: about 5 Stone a minute). Fill shallows (water beside land
 * becomes land, level with the lowest ground beside it): `fill` Stone, `fillTime` s, and only within `reach` tiles of the
 * shore as the map was made (tfInReach: no causeways across open sea). Dig a channel (land at the waterline beside water
 * becomes water): yields `dig` Stone, `digTime` s. Levels go from 0 to `top`. A plan takes `most` tiles at once. Yields
 * come out as crates on the spot (Haulers take them to storage). Raising's Stone comes by Hauler where a road reaches
 * the work, else straight from storage as the work goes (a Wall's way); filling's always comes from storage.
 */
const TERRA = { time: 24, stone: 4, dug: 2, fill: 8, fillTime: 40, reach: 6, dig: 3, digTime: 36, top: 4, most: 48 };
/*
 * Terraforming, stage 2: soil, plants and water (the player's: rivals never build these, see t2Tick in sim.js and the
 * Terraform tab). Everything here is per tile, in layers made the first time they're needed (S.soil, S.grove, S.wet...).
 *
 * SOIL: a Composter (BDEFS.composter) burns a batch (`batch`, brought by Haulers to its `hopper`) every `every` s while
 * it has one, and every open tile within `reach` of it gains `gain` soil (0 to `max`): barren below `improving`,
 * improving below `rich`, rich from there. Rich soil is farmland (S.fert): Bio Farms plant on it. On richer soil crops
 * grow `crop` times as fast and give `yield` Fuel each (barren, improving, rich), and a Grove Planter's stalk groves
 * hold `stalk` Fiber. The Grader's Spread soil job (Build → Terraform) brings `spread` and adds `spreadGain` in
 * `spreadTime` s; its Reclaim job clears a crater, ash, scorched soil or a grove in `reclaimTime` s.
 */
const SOIL = { reach: 4, every: 15, batch: { fiber: 1, stone: 1 }, hopper: 4, gain: 10, improving: 64, rich: 160, max: 200,
  crop: [1, 1.25, 1.5], yield: [1, 1, 2], stalk: [3, 4, 5], spread: { fiber: 2, stone: 1 }, spreadTime: 16, spreadGain: 64, reclaimTime: 20 };
/*
 * GROVE: a Tree Nursery's Agribot (BDEFS.nursery) plants groves on open ground within `reach` (up to `most` of them),
 * leaving open lanes (every third row and column from the Nursery stays clear: groveLane), `plantTime` s a grove. A grove
 * grows a step every `step` s: saplings until `young` steps, young until `mature`, then mature (forest ground: Greenreach
 * after a biome shift, `forest` times as fast). A mature grove bears a Fiber every `fiberEvery` steps, which the
 * Nursery's Agribot gathers (`gatherTime` s) and Haulers take from the Nursery. A foe's robots in a grove move at `slow`
 * of their speed (saplings, young, mature); groves burn (Torches, napalm) and can be cleared (Reclaim, or built over).
 * A rival's robots plan their routes round a foe's groves where the way round is short: each step into one costs `path`
 * more (saplings, young, mature; routeOpts sets opts.grove, findPath adds it). With no way round they go through.
 */
const GROVE = { reach: 4, most: 18, plantTime: 4, step: 2, young: 40, mature: 120, fiberEvery: 45, gatherTime: 3, slow: [0.85, 0.7, 0.55], forest: 1.5, path: [0, 1, 2] };
/*
 * IRR (irrigation): every `every` s each working Water Pump (BDEFS.wpump, built beside water) sends water along the
 * pipes joined to it (its owner's) and along canals a Grader dug (water tiles in S.tfTiles), up to `reach` tiles of them.
 * The ground within `fringe` of a watered pipe or canal is wet, and within `spray` of a pipe's end (a sprinkler) or the
 * pump. Wet ground (S.wet) turns green, lets Bio Farms plant crops on any ground (desert too), and crops on it grow `crop`
 * times as fast. An Atmosphere Engine's rain counts too: from Rain, while it has power, the ground in its circle is wet for
 * crops and the biome shift (rainWetAt; worked out from the Engine, nothing stored).
 */
const IRR = { every: 4, reach: 60, fringe: 1, spray: 2, crop: 1.2 };
/*
 * SHIFT (the biome shift): every `every` s each tile scores a point for improving soil, one more for rich, one if wet
 * and one if `cover` groves (young or mature) stand on it and round it. With `need` points or more, its terraform level
 * (S.tform) rises by its score; at `full` the tile shifts a step along its biome's `chain` (S.shift): the Rust to the
 * Long Grass to Greenreach (the Polar Caps thaw to the Long Grass first, then Greenreach; forests, swamps and the Shoals
 * stay as they are). Long Grass ground counts as improving soil, Greenreach's grows groves faster. Slow: a
 * long-game reward (about 10 to 20 minutes a step). Drawn with the two biomes' blend (biomeMixAt's look).
 */
const SHIFT = { every: 10, need: 2, cover: 2, full: 240, chain: { desert: ['savanna', 'jungle'], volcanic: ['savanna', 'jungle'], alien: ['savanna', 'jungle'], springs: ['savanna', 'jungle'], savanna: ['jungle'], polar: ['savanna', 'jungle'] } };
/*
 * Terraforming, stage 3: resources from the ground (the player's, like stage 2: rivals never build these). See the stage
 * 3 block in sim.js and js/terraform3.js.
 *
 * SEAM: hidden Ore and Crystal seams under the ground, beyond the deposits on it. None exist until a Seam Drill
 * (BDEFS.seamdrill) first surveys: then they're made from the map's seed, a seam in about `chance` of the `cell`-tile
 * squares of the map, `size` tiles of ground, Crystal `crystalShare` of them (never on Argos), holding `ore` or `crystal`
 * (up to a fifth more). A drill surveys out to `survey[0]` tiles the moment it stands, a tile further every `surveyEvery`
 * s it has power, out to `survey[1]`; found seams are its colony's. It works the nearest found seam in its survey at
 * `rate` a minute (Ore, Crystal) while it has power (a Generator burning Fuel, or a Thermal Plant, in reach), holding
 * up to `cap` for Haulers. Slower than an Ore Mine or a Crystal Tap on a deposit: a late supplement that never moves.
 */
const SEAM = { cell: 12, chance: 0.6, size: [3, 6], crystalShare: 0.4, ore: 60, crystal: 30, survey: [4, 8], surveyEvery: 30, rate: { ore: 2, crystal: 1 }, cap: 12 };
/*
 * SEED: a Seed Mast (BDEFS.seedmast) grows Crystal Seedbeds on the open ground within `reach` (up to `most` beds): it
 * prepares one every `prepEvery` s, seeds a prepared one with `seed` Crystal from its `hopper` (Haulers bring them),
 * and with power grows its seeded beds a step every `step` s: seeded, sprouting from `sprout` steps, ripe at `ripe`.
 * A ripe bed holds `yield` Crystal as a cluster that a Crystal Tap gathers; then it is prepared again. Without power
 * its beds starve and stop. A bed's full turn is about 7 minutes: 6 beds net about 1.7 Crystal a minute, less than one
 * Crystal Tap on a deposit (the late Chip and Crystal balance stays the deposits'). A growing field draws the Murmur a
 * little (`murmur` charge, like a Refinery's, in murmurPower). A Mast keeps `apart` tiles from another.
 */
const SEED = { reach: 2, most: 6, prepEvery: 10, seed: 1, hopper: 3, step: 5, sprout: 24, ripe: 84, yield: 3, murmur: 1, apart: 5 };
/*
 * THERMAL: a Thermal Plant (BDEFS.thermal) is a Generator that burns no Fuel: it powers what's round it the same way
 * (the factories a third faster, a Seam Drill's or Seed Mast's power, and a Maglev Terminal's or Mass Driver end's,
 * whose shots then cost no Fuel: thermalNear), but never a megastructure (the owner, Nov 27 2026: a Fuel-free Deep
 * Core on volcanic maps would be too strong; they read only a Generator's Fuel), within `radius` (a tile less than a
 * Generator's), while lava, the Cinderlands' or Steamwells' hot water, or a Steamwells vent touches its tile
 * (thermalHot). It costs more than a Generator and only stands where the ground is hot: a reward on volcanic maps.
 */
const THERMAL = { radius: 3 };
const SEA_MIN = 20, FERRY_SEATS = 6, FERRY_WAIT = 5, FERRY_GIVEUP = 90, FERRY_COST = 1.4, FERRY_BOARD = 8;
/** A Ferry founding a Port on another shore (orderFoundPort): the kit it loads at its Port, the land the new Port claims, the Workers it takes. */
const PORT_FOUND = { cost: { cement: 12, alloy: 4 }, claim: 4, workers: 4 };
const LANDING_GATHER = 40; // a Ferry on a beach landing sails this long after the order even if some warbots haven't come aboard
const SHIP_BURN = 0.3, SHIP_REFUEL = 70, PORT_FUEL = 4; // a ship's tank (0–100) drains this a second under way; it fills up (one Fuel) when tied up below SHIP_REFUEL; a Port keeps PORT_FUEL for them
// Planes: a tank (0–100) drains PLANE_BURN a second in the air (a full tank is about 45 s of flight); one Fuel at the
// Airfield puts back PLANE_FILL[type] of it: a Cargo Plane's big tank takes five Fuel to fill (a long round trip four to
// six), a Vulcan Bomber's two and a half, and each bomber sortie takes BOMBER.fuel more on top. An Airfield keeps
// AIRFIELD_FUEL for its planes; its panel counts the flights that covers as round trips of AIR_TYPICAL tiles each way.
// Loading takes PLANE_LOAD s; robots have PLANE_GATHER s to get aboard (then it goes with whoever is); a parachute takes
// AIR_DROP_FALL s to come down.
// Armored Freight Trains: an upgrade a train is given on its panel, paid for from storage there and then and fitted at the
// next Rail Station it stops at (it waits there while the yard works). Plating (more hit points, and it takes less of any
// damage), a pulse cannon on the locomotive for enemy robots and vehicles on the ground, and a twin flak gun on the last
// wagon for enemy aircraft (its shells burst like a Flak Gun's). Both run off the engine: no ammo to bring.
const TRAIN_ARMOR = {
  cost: { alloy: 6, chip: 3, crystal: 3 },
  fit: 12,      // seconds the station's yard takes to fit it
  hp: 40,       // extra hit points (a Freight Train has 30)
  takes: 0.6,   // the share of any damage it takes
  pulse: { range: 4.5, damage: 4, reload: 1.6 }, // (a Pulse Turret: 5 tiles, 5 a shot, every 1.3 s)
  flak: { range: 6, reload: 1.5 },               // one shell a time (a Flak Gun: 7 tiles, two every second)
};
const PLANE_BURN = 2.2, PLANE_FILL = { cargoplane: 20, bomber: 40, airship: 20 }, AIRFIELD_FUEL = 12, AIR_TYPICAL = 30;
const PLANE_LOAD = 3, PLANE_GATHER = 45, AIR_DROP_FALL = 2.2;
/** How much of plane u's tank (0–100) one Fuel fills. */
function planeFill(u) { return PLANE_FILL[u.type] || 40; }
const PLANE_MEND = 0.6;    // hit points a second a plane parked at its Airfield gets back
// Airfields: a runway RUNWAY_LEN tiles long runs straight out from the hangar. A plane rolls down it from the
// head, gathering speed (ROLL_ACCEL tiles/s²), and lifts off at the far end; in the air it turns at up to
// PLANE_TURN radians a second; it lands at the far end and brakes (ROLL_BRAKE) back to the head.
const AIRFIELD_HOLDS = { cargoplane: 1, bomber: 2 }; // planes of each type an Airfield has room for (an Airship takes no spot: it lives at its Masts)
/**
 * The Airship (BOTS.airship) and its Mooring Masts (BDEFS.mast). Two Masts make a line (b.line on both: a Mast is on
 * one line at most) and up to `perLine` Airships serve it (an Airship's line is the one its home Mast u.home is on). It
 * flies straight from Mast to Mast at its own speed, rising off one over `climb` s (and turning about, `turn` radians a
 * second) and settling onto the other over the last `settle` tiles, its nose at the Mast's mooring cup. Goods: the
 * Masts take part in the rail plan (railPlan), as a line's two stations: the far Mast (further from the Command Base)
 * stocks what the buildings round it need, the home Mast keeps that for it, and the far Mast's spare goods go home; a
 * trip sets out once its mixed load fills `fill` of the hold, or with anything at all once the far side is running low
 * (a third of what it keeps) or riders are aboard, or after `wait` s with at least `least`. It flies across empty to
 * fetch a load waiting at the other Mast. Riders: Workers and Warbots take the line in their routes (like a ferry
 * line: a crossing costs `routeCost` times the straight distance, plus `routeBoard` tiles for the wait); once one is
 * aboard it waits `boardWait` s for more; moored, it stays at least `dwell` s (unloading, loading). Fuel: its tank
 * (0-100) drains `burn` a second in the air; one Fuel puts back PLANE_FILL.airship of it; each Mast of a line with an
 * Airship keeps `mastFuel` Fuel, which Tankers or a pipeline bring. Masts stand at least `minDist` tiles apart.
 */
const AIRSHIP = { perLine: 2, climb: 5, turn: 0.55, settle: 3.5, fill: 0.5, wait: 75, least: 4, dwell: 4, boardWait: 6, routeCost: 1.3, routeBoard: 10,
  burn: 0.9, mastFuel: 8, minDist: 8,
  nose: 1.09, // (tiles from a moored Airship's middle to the tip of its mooring cone, as the game draws it: see drawAirship)
  lift: 0.75 }; // (tiles up the screen from a Mast's tile to its mooring cup: [0.5, 0.08] of its B3D art. A moored Airship hangs there.)
/**
 * The Vulcan Bomber (BOTS.bomber): a sortie loads `ammo` Ammo and `fuel` Fuel at its Airfield (and Fuel in its tank for
 * the trip; it can't take off without both), flies to
 * one target (an enemy building, or a vehicle or robot out in the open, which it chases), drops its bomb (`fall`
 * s to the ground) and flies home: `damage` to the building it's aimed at (forts no lower than MISSILE_FLOOR),
 * `splashBld` to other buildings and `botDamage` to robots within `splash` tiles. Back on the ground it needs
 * `rearm` s before the next sortie. Flak Guns shoot it down.
 */
const BOMBER = { ammo: 6, fuel: 3, damage: 14, splash: 1.3, splashBld: 4, botDamage: 8, fall: 0.8, rearm: 25 };
/**
 * Napalm, the Vulcan Bomber's other payload (Bomb or Napalm, picked with its target): no bomb and no Ammo, but `fuel`
 * more Fuel loaded at its Airfield on top of the sortie (BOMBER.fuel and its tank), and it can be aimed at any ground.
 * Where it lands the tile and the eight round it (everything within `radius` tiles) burn for `burn` s: enemy robots
 * standing in it take `bot` damage a second and enemy buildings `bld` a second (a little: forts no lower than
 * MISSILE_FLOOR), crops and stalk groves there burn, and every patch of fertile soil in it is scorched for good: no
 * Bio Farm grows anything there again (see scorchSoil). The fire is worked out every `tick` s.
 */
const NAPALM = { fuel: 3, radius: 1.5, burn: 6, bot: 0.6, bld: 0.6, tick: 0.5 };
/**
 * An aircraft shot down (hitAircraft) falls burning for `fall` s along a descending turn (crashPath): `glide` tiles of
 * ground covered in all, slowing as it drops, its heading turning through `turn` radians (one way or the other), from
 * where it was hit. Then it crashes (crashLand): a fireball, `blast` big, and its wreck skids `skid` tiles on, slewing
 * round by up to `slew` radians, and burns `fire` s. The wreck stays for the rest of the game (S.wrecks, at most
 * WRECK_MAX: the oldest go first), `len` tiles long, on the tiles its hull lies across, until a building, road, track
 * or pipe is built over one of them or the ground there changes (the tide comes in): see clearWrecks. It's scenery: it
 * blocks nothing and hurts no one, and nor does the crash. `heavy`: the Airship's settling fall. A type with no entry
 * of its own falls as `plane`.
 */
const AIR_CRASH = {
  cargoplane: { fall: 7.5, glide: 7, turn: 2.4, skid: 0.5, slew: 0.25, len: 1.5, fire: 45, blast: 1.1 },
  bomber: { fall: 6.5, glide: 8.5, turn: 3.3, skid: 0.6, slew: 0.35, len: 1.1, fire: 35, blast: 1 },
  airship: { fall: 11, glide: 2.4, turn: 0.5, skid: 0.25, slew: 0.1, len: 2.2, fire: 75, blast: 1.4, heavy: true },
  plane: { fall: 7, glide: 6.5, turn: 2.4, skid: 0.5, slew: 0.25, len: 1.4, fire: 40, blast: 1.1 },
};
const WRECK_MAX = 32, CRASH_STEPS = 24; // (crashPath works the fall out in this many even steps)
/*
 * War scars (the owner's design, Nov 19 2026; see the War scars section of js/sim.js): a long war slowly turns the green
 * land between the colonies into a battlefield of craters, ash, charred stumps, scrap and bones. The setting is the
 * device's own (Settings: Off, Light or Full; Full by default) and is fixed into a game's settings when it starts
 * (S.settings.scars), so every device in a multiplayer game runs the same one; changed during a game, it applies from the
 * next. Looks, mostly: craters and ash never slow anyone. What plays: Haulers salvage scrap for Alloy (SALVAGE), and the
 * Murmur's tunnels lean toward big heaps of it (they drain the charge left in wreckage).
 *  light    a light scorch (S.ash 1..light): grass grows back over it one step every `step` s (about ten minutes)
 *  good     S.ash: burned to ash for good (Full: the heart of a blast, napalm); glass: a nuclear blast's black glass
 *  big      a blast this big or bigger leaves a big crater (a bomb, a Missile, a Howitzer's shell, a fuel blast, a crash)
 *  scrapMax piles of scrap kept at once (past it the oldest small pile joins its nearest neighbour); pileMax: Alloy in one
 *  fauna    the chance that an untouched open tile in a blast's reach had an animal on it (it dies: bones); bonesMax kept
 */
const SCARS = { levels: ['off', 'light', 'full'], light: 60, step: 10, good: 250, glass: 252, big: 0.7, scrapMax: 700, pileMax: 40, fauna: 0.1, bonesMax: 320 };
/** Salvage: an idle Hauler pulls up on a road within `reach` tiles of a heap of scrap on its colony's land, cuts it up for `time` s and carries the Alloy (a whole unit, up to its load) to storage. */
const SALVAGE = { reach: 2.5, time: 5 };
/** How aircraft `type` falls and crashes (AIR_CRASH, or a plane's way for a type with no entry). */
function airCrash(type) { return Object.prototype.hasOwnProperty.call(AIR_CRASH, type) ? AIR_CRASH[type] : AIR_CRASH.plane; }
/*
 * Influence. Every finished building but the military ones holds CIV_CLAIM tiles round itself (the military
 * ones claim their wider ring, BDEFS terr), so a colony's land grows as it builds. You can build on any
 * ground no rival holds, within BUILD_REACH tiles of something of yours (a building, road or track) that
 * your bots can reach; defences (DEFENCE_TYPES) only inside your own land. A finished building whose ground
 * a rival's military ring takes is cut off: it stops working and crumbles away over CUT_CRUMBLE seconds
 * unless you take the land back.
 */
const CIV_CLAIM = 2, BUILD_REACH = 10, CUT_CRUMBLE = 90;
const DEFENCE_TYPES = new Set(['turret', 'minigun', 'bunker', 'disruptor', 'mortar', 'flak', 'keep', 'wall', 'gate', 'silo', 'nukesilo', 'lance', 'dome', 'sunder']);
const RUNWAY_LEN = 5, ROLL_ACCEL = 0.42, ROLL_BRAKE = 0.75, PLANE_TURN = 1.1, PLANE_CLIMB = 3;
const AIR_EDGE = 1.5; // planes keep their turning spots this far inside the map's edge
const SECLUDED_REACH = 16; // warbots at a cut-off post (a Drop Outpost) only go this far from it: for repairs, rally flags and attacks
const FOOT_CARRY = 12;     // off the road network (a foothold dropped by air), Workers carry goods by hand between buildings this close
const BUILD_FAR = 16;      // a site doesn't call a Worker from further off than this while one close by (FOOT_CARRY) will soon be free
const SITE_WAIT = { eta: 35, max: 45, foes: 8 }; // a Worker out of goods at a site waits there for goods a carrier will bring within `eta` s (at most `max` s; not with enemies within `foes` tiles)
const TOPUP_NEAR = 10;     // seconds' walk: how far an idle Worker goes to top up its battery (a flat one goes as far as it must)
const AIR_KEEP = 12;       // an Airfield keeps up to this many of each good the places it supplies by air are short of
const SHIP_MEND = 0.5; // hit points a second a ship tied up in Port gets back
const SHIP_MIN_LOAD = 8; // a far Port sends spare goods home by ship in loads of at least this many // Lakes maps: how much of the land outside the middle lake is lakes (a noise threshold)
/** Track through rocky crags is a rail tunnel, bored like a road tunnel and costing the same. */
const RAIL_TUNNEL_COST = { cement: 3, alloy: 1 };

/* New-game map settings (each is a slider on the menu). */
const IMMENSE_SIZE = 4, PLANETARY_SIZE = 5;
const SIZE_PRESETS = [
  { name: 'Small', w: 30, h: 42 },
  { name: 'Medium', w: 40, h: 56 },
  { name: 'Large', w: 50, h: 70 },
  { name: 'Huge', w: 60, h: 84 },
  { name: 'Immense', w: 84, h: 118, ringfallHits: 9 },
  { name: 'Planetary', w: 120, h: 168, ringfallHits: 11 },
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
/*   density  how many resource fields   amount  how much each node holds
 * (Lowered a notch in resources version 2: Normal is what Sparse was, Rich what Normal was, Abundant what Rich was,
 * Sparse what Scarce was, and Scarce is new. Older saves and saved planets move up a notch to keep their maps:
 * resLevelUp.) */
const RESOURCE_PRESETS = [
  { name: 'Scarce', density: 0.45, amount: 0.5 },
  { name: 'Sparse', density: 0.55, amount: 0.6 },
  { name: 'Normal', density: 0.78, amount: 0.8 },
  { name: 'Rich', density: 1, amount: 1 },
  { name: 'Abundant', density: 1.3, amount: 1.3 },
];
const RES_V = 2;
/** A resource setting from before RES_V: the setting that gives the same map now (the old Abundant is gone: Abundant). */
function resLevelUp(k) { return Math.min(RESOURCE_PRESETS.length - 1, (Number.isInteger(k) ? k : 2) + 1); }
/* Map shape: a Long haul map is narrower and much longer, with the bases far apart. */
// Map types. `group` sorts them on the new-game screen (MAP_GROUPS); `blurb` is the line shown under
// the choice; `tip` the longer note shown when a game starts.
const MAP_GROUPS = [
  { key: 'open', name: 'Open ground' },
  { key: 'divided', name: 'Divided' },
  { key: 'water', name: 'Water' },
  { key: 'heights', name: 'Heights and depths' },
];
const SHAPE_PRESETS = [
  { name: 'Standard', group: 'open', blurb: 'Open ground with hills, cliffs and resource fields between the bases. Holds up to four: with four, a colony in each corner.', w: 1, h: 1, ffa: true, players: 4, std4: true,
    quadTip: 'Standard for four: a colony in each corner of open ground, hills, cliffs and resource fields between. Your neighbours are beside you to the north and east; the colony across the middle is the far one.' },
  { name: 'Long haul', group: 'open', blurb: 'A narrow planet with the bases far apart: built for long supply lines (trucks, Road Trains and rail). Its Ore and Crystal fields hold half as much again.', w: 0.75, h: 1.7, haulRich: 1.5 },
  { name: 'Chokepoint', group: 'divided', blurb: 'A belt of crags across the middle with one to three narrow channels winding through it, different every game: whoever holds them holds the map.', w: 1, h: 1, choke: true, tip: 'Chokepoint: a belt of crags splits the planet, with one to three narrow channels winding through it (different every game). Find where yours come out, and hold them: an Outpost nearby, then walls and turrets (Paths, Walls).' },
  { name: 'Islands', group: 'water', blurb: 'Each base on its own island, with two or three medium islands between, a wide sea apart: cross by ship, or by long, dear bridges.', w: 1.15, h: 1.45, islands: true, naval: true, ffa: true, tip: 'Islands: a wide sea between the islands. Build a Port on your shore and order ships and a Ferry at its shipyard (a Ferry can land warbots on any shore), or push an Outpost out to your shore and build a bridge in Paths (Bridges): long ones cost a lot.' },
  { name: 'Crater', group: 'heights', blurb: 'The richest fields lie in a sunken crater in the middle, with one ramp down on each side.', w: 1, h: 1, crater: true, minLevels: 3, ffa: true, tip: 'Crater: the richest fields lie on the crater floor in the middle. One ramp leads down on your side; cut more in Paths (Ramps).' },
  { name: 'Plateaus', group: 'heights', blurb: 'Each base on a high plateau ringed by cliffs, with only two slopes down: easy to hold, slow to break out of.', w: 1, h: 1, plateau: true, minLevels: 3, ffa: true, tip: 'Plateaus: your base stands on high ground with only two slopes down. Easy to hold: wall the slopes and push out.' },
  { name: 'Sky islands', group: 'heights', noMurmur: true, blurb: 'Mesas standing over a canyon floor far below: cross between the clifftops on Viaducts.', w: 1.15, h: 1.45, islands: true, sky: true, ffa: true, tip: 'Sky islands: a home mesa each and around a dozen smaller mesas between, a chain of them always linking the sides, over a canyon floor far below, with sheer drops and no slopes down; deposits on the mesas hold more. Cross between clifftops with Viaducts (Paths); a Ropeway (Paths too) can reach the floor, but there is little down there.' },
  { name: 'Rift', group: 'divided', blurb: 'A chasm splits the planet, crossed only by a few natural rock arches: hold yours.', w: 1, h: 1, rift: true, tip: 'Rift: a chasm splits the planet, crossed only by a few natural rock arches. Hold your arches with turrets and Mortar Pits; a bridge over the chasm is the slow way to open another crossing.' },
  { name: 'Ring valley', group: 'divided', blurb: 'A massif too steep to climb fills the middle, with a valley round it on each side: two long ways round.', w: 1, h: 1.1, ring: true, tip: 'Ring valley: a massif too steep to climb fills the middle, and a valley runs round it on each side. Two long ways round: fortify one, raid along the other. (A long tunnel through the massif is the only shortcut.)' },
  { name: 'Oases', group: 'open', blurb: 'A barren, crag-strewn waste with a few rich oases joined by narrow passes: an expansion race.', w: 1.05, h: 1.05, oases: true, tip: 'Oases: a barren, crag-strewn waste. Everything worth having is round your base and in a few rich oases joined by narrow passes: grab them first, and guard the long supply lines.' },
  { name: 'Crossroads', group: 'heights', blurb: 'A mesa in each corner with three slopes down into an open lowland that meets at a rich plaza. Two players leave two rich mesas free; up to four take a corner each.', w: 1.2, h: 1, cross: true, minLevels: 3, players: 4, tip: 'Crossroads: your base stands on a mesa in one corner, with three slopes down: one toward each neighbouring corner and one toward the rich plaza in the middle. The lowland between the mesas is open ground, and the two mesas no one holds are rich. Every mesa can be climbed by its slopes: hold yours, and come down for the riches.',
    quadTip: 'Crossroads: a colony on a mesa in each corner, the open lowland between them meeting at a rich plaza in the middle. Three slopes lead down off your mesa, one toward each neighbour and one toward the plaza, and your rivals\' mesas have theirs: attacks can come up any of them. The colony across the plaza is the far one.',
    spareTip: 'Crossroads: a colony on a mesa in each corner, the open lowland between them meeting at a rich plaza in the middle. The mesa beside you to the north is free and rich; the red rival across the plaza borders it too, and the green rival is beside you to the east. Three slopes lead down off every mesa, one toward each neighbour and one toward the plaza.' },
  { name: 'Lakes', group: 'water', blurb: 'Many small lakes, with roads weaving between them: bridges save long detours.', w: 1.1, h: 1.1, lakes: true, naval: true, tip: 'Lakes: a land of many small lakes, roads weaving between them. Bridges save long detours.' },
  { name: 'Tidal flats', group: 'water', blurb: 'Low islands joined by sandbars: at low tide armies walk across, at high tide the sea covers the flats and anything caught out there is washed ashore.', w: 1.15, h: 1.45, islands: true, naval: true, tidal: true, flat: true, tip: 'Tidal flats: the islands are joined by sandbars, dry at low tide and under the sea at high tide (a warning comes first). Bots walk across at low tide; nothing can be built on the flats, so trucks still need bridges or ships.' },
  { name: 'River delta', group: 'water', blurb: 'A wide braided river splits the planet: bots wade the shallow fords, trucks need bridges. Rich islets midstream, fertile banks.', w: 1.1, h: 1.1, delta: true, naval: true, flat: true, tip: 'River delta: a braided river runs across the planet. Bots can wade the shallow fords (slowly); haulers and trucks need a bridge. The islet midstream is rich, and the banks are fertile for Bio Farms.' },
  { name: 'Volcano', group: 'heights', blurb: 'A volcano in the middle with lava rivers down its flanks and the richest deposits on its slopes, until it erupts.', w: 1.1, h: 1.1, volcano: true, minLevels: 4, tip: 'Volcano: the richest deposits lie on its slopes, but every few minutes it erupts and rains lava bombs on them (it rumbles first). Bridge the lava rivers, or go round where they end.' },
  { name: 'Fault line', group: 'divided', blurb: 'A crack runs across the planet. About 15 minutes in an earthquake splits it open into a chasm, leaving only a couple of rock arches to cross.', w: 1, h: 1, fault: true, tip: 'Fault line: the scar across the middle opens into a chasm about 15 minutes in, swallowing whatever stands on it, with tremors first. Only two rock arches stay standing (a Sky bridge opens another way across).' },
  { name: 'Canyon maze', group: 'divided', blurb: 'A labyrinth of narrow canyons, its dead ends full of riches: ambushes everywhere, and artillery shoots over the walls.', w: 1, h: 1, maze: true, tip: 'Canyon maze: narrow canyons wind between the bases, with riches in the dead ends. A tunnel can cut through a wall, at a price.' },
  // For three or four players only (minPlayers): built round the colonies, with no layout for two.
  { name: 'The Wheel', group: 'heights', blurb: 'For three: a rim road round the planet, rock spokes between the colonies, and a raised hub in the middle with the richest fields and one ramp up from each side.', w: 1, h: 1, wheel: true, minLevels: 3, ffa: true, players: 3, minPlayers: 3, tip: 'The Wheel: three rock spokes split the planet, with a raised hub in the middle (the richest fields, one ramp up from each side) and a rim road round the outside. Go the long way round the rim, or fight for the hub.' },
  { name: 'Three Mesas', group: 'heights', blurb: 'For three: each colony on a tall mesa with one way down into a rich basin; between neighbours, canyons only a Viaduct crosses.', w: 1, h: 1, mesas: true, minLevels: 4, ffa: true, players: 3, minPlayers: 3, tip: 'Three Mesas: your colony stands on a tall mesa with one ramp down, toward the rich basin in the middle. Your neighbours\' mesas are a canyon away: go down through the basin, or span the canyon with a Viaduct (Paths).' },
  { name: 'Pinwheel', group: 'divided', blurb: 'For three or four: four curved ridges sweep out from a rich plaza in the middle, a colony between each pair; your way into the plaza bends toward the next colony round.', w: 1.2, h: 1, quad4: true, pinwheel: true, players: 4, minPlayers: 3, tip: 'Pinwheel: four curved ridges sweep out from the rich plaza in the middle, a colony between each pair. Your way into the plaza bends toward the next colony round; gaps at the outer ends of the ridges lead round to both your neighbours.',
    spareTip: 'Pinwheel: four curved ridges sweep out from the rich plaza in the middle. The blade beside you to the north is free and rich; the red rival across the plaza borders it too, and the green one is beside you to the east. Gaps at the outer ends of the ridges lead round to your neighbours.' },
  { name: 'Four Isles', group: 'water', noMurmur: true, blurb: 'For three or four: a corner island each, a rich island in the middle with the Trade Post, and islets between. In 2 vs 2, allies\' islands are joined by a sandbar.', w: 1.2, h: 1, quad4: true, isles4: true, islands: true, flat: true, naval: true, players: 4, minPlayers: 3, tip: 'Four Isles: every colony on its own island. Build a Port and ships, or long bridges; the island in the middle holds the riches and the Trade Post. In 2 vs 2 your ally\'s island is a sandbar away: robots can wade across.',
    spareTip: 'Four Isles: every colony on its own island; the island to your north is free and rich. Build a Port and ships, or long bridges; the island in the middle holds the riches and the Trade Post.' },
  { name: 'Twin Valleys', group: 'divided', blurb: 'For four, made for 2 vs 2: a mountain spine splits the planet into a west and an east valley, two colonies in each, crossed only by two passes.', w: 1.2, h: 1, quad4: true, twin: true, players: 4, minPlayers: 4, tip: 'Twin Valleys: a mountain spine splits the planet in two, west and east, crossed only by two passes (with rich fields in them). In 2 vs 2 your ally shares your valley; hold the passes.' },
  // Long Haul 2v2: the Long haul planet (as long, and 1.6 times as wide), standing upright, with two colonies side by side
  // at each end, all four the same (mirrored left to right and end to end: see haul4Map). `teamDefault`: picking it turns
  // Teams: 2 vs 2 on.
  { name: 'Long Haul 2v2', group: 'open', blurb: 'For four, made for 2 vs 2: the long, narrow planet of Long haul made wider, two colonies side by side at each end and the richest fields strung along the long middle: a war of supply lines.', w: 1.2, h: 1.7, haul4: true, haulRich: 1.5, players: 4, minPlayers: 4, teamDefault: true, tip: 'Long Haul 2v2: two colonies side by side at each end of a long planet (in 2 vs 2 your ally lands beside you, the other team at the far end). The richest fields lie along the long middle, richer the further out you go (every Ore and Crystal field holds half as much again as elsewhere), with a neutral Trade Post at the very centre and more down the middle line. Push Depots, Freight Trucks, Road Trains and rail up the map, and guard the line.' },
  // The Hollow (LORE.md): the Murmur's cavern lair under the Bloom, its own map with its own look (the biome 'hollow',
  // whatever the Biome setting) and always night. `murmur` and `alwaysNight` are read by the Murmur's night system.
  { name: 'The Hollow', group: 'heights', blurb: 'The Murmur\'s cavern lair, always night: caverns joined by passages and chasms, black lakes, the most Murmur nests of any planet, and daylight only down the breach shafts.', w: 1.15, h: 1.25, hollow: true, murmur: 'active', alwaysNight: true,
    tip: 'The Hollow: your base landed under a breach, a shaft of daylight down through the cavern roof; Ringfall only falls through the breaches, in rich drops. Nothing grows down here: Harvesters cut Fiber from the violet Bloom veins (which draws the Murmur), and Fuel comes from oil seeps. The richest Crystal hangs over the chasms: reach it by Ropeway or a bridge (Paths). No aircraft underground, and now and then the ceiling drops rock where dust trickles down.' },
  { name: 'Grand Canyon', group: 'heights', blurb: 'Two high rims overlook rocky shelves, green river basins and Ore and Crystal. The river splits around islands between its narrows.', w: 1.2, h: 1.4, grandCanyon: true, minLevels: 4, naval: true, river: true, // (river: ships sail its river, but it's a heights map, not a naval one: no Naval badge, no Shoals biome)
    tip: 'Grand Canyon: your colony starts on a high rim. Two single-lane descents lead down from each rim, a switchback and a side-canyon trail. Ships can sail around the midstream islands, robots can wade at the fords, and a Viaduct can cross at the narrows.' },
  // Passenger Town (LORE.md: the empty town, in Greenreach): the Pathfinder's town fills the middle (townSetup in world.js).
  // Two colonies face each other across it; three ring a round town (turned 120°), four sit one on each edge of a
  // square one (turned 90°). Its avenues are old Accord roads (townSetup).
  { name: 'Passenger Town', group: 'divided', blurb: 'The empty Accord town between the bases: its streets are a maze, its buildings block the way, and its old avenues are still roads. Strip a building for Cement, Alloy and Chips, and its lot opens a new way through.', w: 1, h: 1.1, city: true, flat: true, players: 4,
    tip: 'Passenger Town: the empty town between the bases. Its buildings block the way and its streets are a maze, but its old avenue is still a road (worn: plain road speed) that Haulers can use once your roads join it. Tap a building and Strip for salvage (S): your Workers take it apart for Cement, Alloy and Chips, carried home as crates, and its lot opens a new street. Robots beside a building are in cover. Some still have an old Accord sentry on duty: it shoots robots and Murmur alike, so clear it with warbots first.',
    quadTip: 'Passenger Town: a colony on each edge of the empty town, the town square in the middle with its civic tower. An old avenue runs into the town in front of you and right across it, crossing your neighbours\' avenues: they are worn roads Haulers can use once your roads join them. The streets between are a maze: tap a building and Strip for salvage (S) to open a way. Old Accord sentries shoot robots and Murmur alike: clear one with warbots first.' },
  // The Walking Factory: an old Accord mobile factory, dormant in the middle of the map, that walks a loop round it once
  // it's claimed (walkerSetup in world.js, the rules in sim.js, the look in js/walker.js). Two colonies face each other
  // across it; three ring a round planet; four take a corner each of a square one (turned 90°).
  { name: 'The Walking Factory', group: 'open', blurb: 'An old Accord mobile factory lies dormant in the middle of the map. Park warbots aboard to claim it: it wakes, walks a slow loop round the middle, and builds warbots for whoever holds it.', w: 1, h: 1, walker: true, flat: true, players: 4,
    tip: 'The Walking Factory: the old Accord machine in the middle of the map builds a Warbot for whoever holds it, every 50 seconds. From 4 minutes in, send armed robots aboard (select them and tap its deck, or tap it and Send warbots aboard): alone aboard, they claim it in about 15 seconds. It wakes, walks out to its loop toward you, and goes round. Robots on board walk with it and its warbots join them, so your front line moves with it. Enemy robots aboard stall it, then take it back: keep guards on its deck. Nothing can be built on its yard.',
    quadTip: 'The Walking Factory: a colony in each corner, and the old Accord factory dormant in the middle. From 4 minutes in, send armed robots aboard to claim it (select them and tap its deck): it walks a loop round the middle, past every colony, and builds a Warbot for its holder every 50 seconds. Enemy robots aboard stall it, then take it back. Nothing can be built on its yard.' },
  // The Dam (the owner's idea, approved Nov 2026): a raised shelf runs from the middle toward each colony, holding a
  // reservoir behind a dam over that colony's valley (damShape in world.js, the rules in sim.js, the look in js/dam.js).
  // Two colonies face each other across the high ground; three or four sit round it, each with its own lake and dam.
  { name: 'The Dam', group: 'heights', blurb: 'A high shelf in the middle holds a reservoir over each colony\'s valley, behind an old dam. Demolish a rival\'s dam and its lake floods their valley; guard yours.', w: 1, h: 1.25, dam: true, flat: true, players: 4,
    tip: 'The Dam: the high shelf in front of you holds a reservoir behind an old dam, and your valley lies below it. Tap a dam to see its strength: Demolish it (D) and your armed robots within reach of it shoot it; Shore it up (U) and your free Workers mend it. Breached, the lake floods the valley below: robots are swept and hurt, buildings in the flood take damage (those in the river\'s path are wrecked), roads there wash out, and a shallow river stays. Guard your dam from the shelf and the gorge below it; two ramps by each dam lead up.',
    quadTip: 'The Dam: a colony on each side of the high ground, each valley below its own reservoir and dam. The shelf in front of you holds yours; your rivals\' dams are across the high ground, each over their valley. Tap a dam: Demolish it (D) and your armed robots within reach shoot it; Shore it up (U) and your free Workers mend it. Breached, its lake floods the valley below it.' },
  // The Ring (the owner's idea, Nov 2026): out in space among the Ring's big asteroids (ringMap in world.js, the backdrop in
  // js/ring.js). Two colonies only. Argos's look and rules whatever the Biome setting (the biome is forced to Lunar), no
  // Murmur, no weather, no dust storm.
  { name: 'The Ring', group: 'heights', noMurmur: true, blurb: 'Out in space among the Ring\'s great asteroids: a home rock each, a rich one in the middle and stepping stones between, with empty space all round. Cross by Viaduct or Ropeway, or fly.', w: 1.15, h: 1.45, asteroids: true, flat: true,
    tip: 'The Ring: your colony stands on a home asteroid in space, with a rich rock in the middle and a chain of stepping stones between you and your rival. There is nothing in the space between: no floor, no way across on foot and no road to lay. Span a gap with a Viaduct or a Ropeway (Paths), or fly: Cargo Plane drops, Airships between Mooring Masts, Vulcan Bombers. Ring Crystal keeps craft aloft out here, so flight works as it does anywhere. Every rock has oil for your Fuel. Argos\'s ground, no weather, no Murmur.' },
  // Half underground (the owner's idea, Nov 2026): a surface half and a cave half, joined by two or three entrances (cavesMap in
  // world.js, CAVES in defs.js). Two or four colonies, half of them starting inside the caves and half outside. Inside: the Hollow's
  // look, plenty of Ore and Crystal, nothing grows, nothing flies or falls in; outside: the Biome's surface with the growing goods.
  { name: 'Half underground', group: 'heights', blurb: 'Half caves, half surface, joined by two or three cave mouths, narrow gates or wide mouths. Half the colonies start inside (Ore and Crystal, but nothing grows, and no Missile or aircraft reaches in) and half out on the surface (farms and crops, little Ore): each has to branch out through the mouths.', w: 1.2, h: 1.5, caves: true, flat: true, players: 4, evenOnly: true,
    tip: 'Half underground: a surface half and a cave half joined by two or three mouths in a solid wall. The caves hold the Ore and Crystal, the surface the Fiber and crops; nothing grows or is harvested in the caves, and no Missile, bomb or aircraft reaches in. Each colony starts with a stock of what its side lacks, but it runs out: expand through the mouths early.',
    tipIn: 'Half underground, starting in the caves: Ore and Crystal all round you, safe from Missiles and aircraft, but nothing grows here. Your stock of Fiber lasts a while; Fuel comes from the oil seeps (Oil Pump, then a Refinery). Push Outposts out through the cave mouths to the stalk groves and crop soil on the surface before the Fiber runs out.',
    tipOut: 'Half underground, starting on the surface: farms, crops and stalk groves, but little Ore or Crystal. Your stock of Ore and Crystal lasts a while; the caves hold plenty more. Push Outposts in through the cave mouths early, and watch the air: your rival inside cannot be bombed or hit by Missiles, but you can.' },
];
/** Does map type `shape` (or, with none given, the current game's) lie in open space (The Ring: asteroids with void between)? */
function ringShape(shape) { const P = SHAPE_PRESETS[shape === undefined ? (typeof S !== 'undefined' && S && S.settings && S.settings.shape) || 0 : shape || 0]; return !!(P && P.asteroids); }
/** Is tile t space on The Ring: empty void that nothing can cross or build on (T_CHASM there, never a Sky bridge)? */
function voidTile(t) { return S.terrain[t] === T_CHASM && ringShape(); }
/**
 * The Walking Factory (SHAPE_PRESETS walker: walkerSetup in world.js, the rules in sim.js, the look in js/walker.js).
 *   ring      its loop's radius about the middle of the map: a share of the way from the middle to a base (`min` tiles
 *             at least, and at least `gap` short of a base's landing zone)
 *   yard      the yard: open, bare ground `yard` tiles either side of its loop (and all the way in to the cradle in the
 *             middle, where it lies dormant); nothing can be built on it. A lane `lane` tiles wide (each side of its
 *             line) is opened from each base to it.
 *   speed     tiles a second it walks (its loop, and the spur out from the cradle)
 *   deck      robots within this many tiles of its middle are aboard
 *   wake      seconds into a game before it can be claimed at all (its systems warming up: in a mission, at once)
 *   capture   seconds one armed robot alone aboard takes to claim it from no one (or to take a holder's claim down to
 *             nothing); each more aboard makes it `more` faster, at most `most` times as fast. Two sides aboard: contested,
 *             nothing changes and it builds nothing. Left alone, a claim no one finished fades at the same pace.
 *   every     while held and not contested, a Warbot rolls off its line every `every` s (to its holder, its own flag)
 *   kids      at most this many of the Warbots it built alive for one holder (it waits); never past the robot limit
 *   charge    its holder's robots aboard recharge this much battery a second, and get a round of Ammo every `ammo` s
 *   ai        a rival: guards on board while it holds it (from `guards`, by difficulty, and two more for every enemy
 *             robot aboard); a band of at least `band` to board it otherwise, every `every` s at most (`hot` s with
 *             enemies aboard)
 */
const WALKER = {
  ring: 0.45, min: 5, gap: 9, yard: 3, lane: 1.5, speed: 0.32, deck: 2.8,
  wake: 240, capture: 15, more: 0.25, most: 2, every: 50, kids: 5, charge: 4, ammo: 3,
  ai: { guards: [2, 4], band: 4, every: 25, hot: 8 },
};
/** The Walking Factory's log line (LORE.md's register: a machine's status, the Accord's words). */
const WALKER_LINE = 'Accord Mobile Works. Circuit held for the Accord. Output allocated to the crew aboard.';
/**
 * Passenger Town (SHAPE_PRESETS city: townSetup in world.js, the rules in sim.js, the look in js/city.js).
 *   band, clear   half the town's height (share of the map's), and the rows kept clear in front of each base
 *   blockX, blockY  a block's width and height (tiles); streets are 2 wide
 *   lots, plaza   the share of blocks left as parking lots (with car hulks) and plazas
 *   close         the share of street segments closed by an arcade built over them (while every street stays reachable)
 *   perTile       salvage in a building, per tile of it, times its kind's `mult` (TOWN_KINDS)
 *   unit          a Worker's seconds to strip one unit of salvage; crew: Workers of one colony on one building, at most
 *   pile          units a Worker strips before it sets them down as a pile of crates (beside the building)
 *   cover         damage a robot beside a standing building takes (as the Stone Forest's)
 *   cacheShare, caches  the share of buildings with a cache inside, and what one holds (found when it's stripped)
 *   sentry        old Accord sentries on duty: `per` buildings on each side (the civic hall's among them), its armour,
 *                 its reach from the building's edge, its shot's damage every `every` s, and the damage each armed
 *                 robot of yours within `back` tiles of it does back a second
 *   ai            a rival's strip orders: one every `every` s, at most `max` buildings at once, within `reach` of its land
 *   ring          three or four colonies: half the town's side (four: square), a share of the map's side, or (three:
 *                 round) its radius in front of each colony, a share of the way from the middle to a base, reaching
 *                 `lobe` of that further out between the colonies
 *   avenue        the avenues (one down the middle with two colonies, one in front of each with three or four) are old
 *                 Accord roads of this surface (PAVE: 1, plain road speed), owned by no one till a colony's land takes them
 *   murmur        what a Murmur creature clawing at a sentry's building (within 1 tile) does to its armour a second, per
 *                 point of its bite; the sentries shoot the Murmur too
 */
const TOWN = {
  band: 0.2, clear: 6, blockX: [4, 6], blockY: [3, 5], lots: 0.1, plaza: 0.05, close: 0.4,
  perTile: { cement: 0.6, alloy: 0.25, chip: 0.06 }, unit: 4, crew: 3, pile: 4, cover: 0.75,
  cacheShare: 0.15, caches: [{ chip: 5 }, { crystal: 6, chip: 2 }, { alloy: 8 }],
  sentry: { per: 2, hp: 40, range: 3.2, dmg: 2.5, every: 1, back: 3.4, hit: 1.2 },
  ai: { every: 20, max: 2, reach: 6 },
  ring: { four: 0.27, three: 0.7, lobe: 0.45 }, avenue: 1, murmur: 0.5,
};
/**
 * The kinds of building in Passenger Town: name, line (flavour), height range (tiles, as drawn: the rendered art's, its
 * sentry's roof over the ground; js/city.js draws the look nearest it, and it only places what's drawn, a sentry's
 * shots), salvage multiplier.
 */
const TOWN_KINDS = {
  house: { name: 'Walk-up flats', h: [0.8, 1.35], mult: 0.9, cache: true, line: 'Three floors, six flats, keys in every door. The welcome packs are still on the kitchen tables.' },
  shop: { name: 'Shopfront', h: [0.65, 1.2], mult: 0.8, cache: true, line: 'The shutters are up and the shelves are stocked to the Accord list. Opening day: Arrival.' },
  flats: { name: 'Apartment block', h: [1.8, 2.15], mult: 1.2, cache: true, line: 'Two hundred homes, allocated by lottery. The lottery was to be drawn on board.' },
  tower: { name: 'Residential tower', h: [2.8, 3.6], mult: 1.5, cache: true, line: 'Its lifts run a test cycle every morning at six. Nobody has ever rung for one.' },
  school: { name: 'The school', h: [0.75, 0.8], mult: 1.1, chips: 2, cache: true, line: 'Desks set out for the first term: names on the coat pegs, blank.' },
  hall: { name: 'The civic hall', h: [1, 1.1], mult: 1.4, chips: 3, cache: true, line: 'The town council\'s chamber. The chairs are numbered; the first meeting is still on the noticeboard.' },
  spire: { name: 'The civic tower', h: [4.3, 4.4], mult: 1.8, chips: 2, line: 'The tallest thing the Pathfinder built. Its beacon has burned every night for sixty years, for the arks to steer by.' },
  arcade: { name: 'Covered arcade', h: [0.55, 0.6], mult: 0.7, line: 'A glass roof over the street, so the colonists could shop in the rain. It rains here more than they were told.' },
  car: { name: 'Parked car', h: [0.12, 0.16], mult: 1, fixed: { cement: 0, alloy: 2, chip: 0 }, line: 'A town runabout from the Pathfinder\'s hold, parked where it was charged. Mileage: zero.' },
};
/** The sentry's voice: its log line, with {day} the days on duty (LORE.md: the Warden's register). */
const TOWN_SENTRY_LINE = 'Accord Civil Security. Position held. Day {day}.';
/**
 * The Dam (SHAPE_PRESETS dam: damShape in world.js lays it out, the rules in sim.js, the look in js/dam.js). A raised
 * shelf runs from the middle of the map toward each colony; on it a reservoir, held back by a dam across a notch in the
 * shelf's front edge, over that colony's valley. Two ramps beside each dam lead up. Any colony can order any dam wrecked
 * (S.dam.d[k].by, bit p) and its armed robots within reach chip at it; any colony can order one shored up (`mend`) and
 * its free Workers mend it while nothing has hit it for a while. At 0 it breaks: its middle goes, the flood runs down
 * the valley below, and the lake drains to a muddy bed with a stream through it.
 *   hp            the dam's strength
 *   reach, hit    an armed army robot within `reach` tiles of the dam's face takes `hit` a second off it; a Howitzer
 *                 (siege) within `siegeReach`, `siege` a second
 *   mend, crew, calm   a Worker mends `mend` a second; at most `crew` of a colony's on one dam; none while it was hit in
 *                 the last `calm` seconds, nor with enemy robots about
 *   rim, room, shelf   the dam's distance from the middle, a share of the way to the Command Base, but at least `room`
 *                 tiles short of it; the shelf's half-width, a share of that way (6 to 11 tiles)
 *   gap           half the dam's width (tiles); the breach is the middle `breach` either side of its middle
 *   spread, keep  the flood fans out `spread` tiles across for each tile down the valley, and stops `keep` tiles short of
 *                 the Command Base; the river it leaves runs `chan` of the way down, ending in a pool
 *   speed         the flood's front, tiles a second; `stay`: how long the flood plain stays under before it goes down,
 *                 over `recede` seconds (the river and the pool stay); the lake drains between drain[0] and drain[1]
 *   botHit, hurt, wreck   a robot the flood reaches takes `botHit`; a building it reaches loses `hurt` of its full armour
 *                 (`wreck`: everything in the river's path, but a Command Base, which keeps 1)
 *   silt          the share of the flood plain left fertile when the water goes down; `bed`, the share of the lakebed
 *                 left with Ore or Crystal (rich)
 *   ai            a rival: thinks about its dams every `every` s; breaches a foe's from `from` s with at least `army`
 *                 armed robots spare and `worth` of the foe's buildings in the flood (with a ready Silo in range, a
 *                 Missile at it too, one every `missile` s at most); defends its own when foes come within `watch` tiles
 *   missile, blast   a Missile landing on a foe's dam or within blast.on tiles of its face takes `missile` off it (two
 *                 fifths), blast.edge of that out to the Missile's splash; a nuclear blast within its radius bursts it
 *                 outright; a bomb within its splash takes `bomb` (the owner's call, Nov 23 2026: Missiles hurt dams;
 *                 bombs a little; Mortar and Howitzer shells don't, a Howitzer wrecks one only ordered, as above). A
 *                 colony's own blasts and its allies' never hurt the dam over its valley
 */
const DAM = {
  hp: 400, reach: 3, hit: 1, siegeReach: 6, siege: 3,
  mend: 2.5, crew: 3, calm: 6,
  rim: 0.55, room: 9, shelf: 0.3, gap: 2.5, breach: 1,
  spread: 0.8, keep: 4.5, chan: 0.6,
  speed: 3.5, stay: 60, recede: 20, drain: [3, 30],
  botHit: 4, hurt: 0.5, silt: 0.55, bed: 0.12,
  ai: { every: 6, from: 420, army: 8, worth: 3, watch: 7, missile: 90 },
  missile: 160, blast: { on: 1, edge: 0.5 }, bomb: 12,
};
/** The dam's plate (LORE.md: the Pathfinder built for the colonists who never came). */
const DAM_LINE = 'Reservoir 4. Capacity for the first colony: 200 years. Gauge read daily. Reading: full.';
// Map events: what happens on the map types that change as you play (seconds unless noted).
// Tidal flats: the first low tide lasts `firstLow`, then high and low take turns, with a warning first;
// `closing`: bots keep off the flats this long before they flood.
const TIDE = { firstLow: 300, low: 210, high: 140, warn: 30, closing: 20 };
// Volcano: the first eruption and the gap between them, the warning, how long it lasts, how many lava
// bombs it throws, the damage each does (armor to buildings, never below 1; hit points to bots), how far
// out they land (× the cone's radius) and how long they fly.
const ERUPTION = { first: 420, gap: [300, 420], warn: 20, dur: 14, bombs: 34, damage: 3, botDamage: 3, reach: 1.15, flight: [1.4, 2.4] };
// Fault line: when the earthquake comes (give or take `jitter`), and the warnings before it.
const QUAKE = { at: 900, jitter: 90, warn: [120, 30] };
/**
 * The Hollow (SHAPE_PRESETS hollow; laid out by hollowMap in world.js).
 *   breach    the radius (tiles) of a breach shaft over a Command Base (`home`) and of the contested ones (`open`):
 *             `contested` of them, two in each flank cavern
 *   ringfall  Ringfall falls only through the breaches: METEOR_HITS strikes on each colony's share as usual, the
 *             share `contested` of them through the contested breaches, each leaving up to `tiles` deposits `rich`
 *             times as rich as a Ringfall deposit elsewhere
 *   crystal   Floating Crystal: a mass's Crystal holds this many times a cluster's usual amount
 *   nests     Murmur nest sites on each colony's side, Small to Planetary, besides the Deep's mound at the centre
 *   deep      the Deep's mound (BDEFS mound): the level it starts at, guards on top of a nest's, and the hoard that
 *             spills out when it's wrecked; wrecking it knocks every other nest back to level 1 (see clearNest)
 *   relics    each crate in a side chamber's rows of robot parts: Alloy or Chips, between the two numbers
 */
const HOLLOW = {
  breach: { home: 3.2, open: 2.6 }, contested: 4,
  ringfall: { contested: 0.67, tiles: 4, rich: 1.5 },
  crystal: 2.5,
  nests: [4, 5, 6, 7, 9, 10],
  deep: { level: 3, guards: 3, loot: { crystal: 30, alloy: 20, chip: 10 } },
  relics: { alloy: [3, 5], chip: [1, 2] },
};
/*
 * The Deep spouts more Murmur the nearer it is to death (deepSurgeTier and updateNest in js/sim.js; the owner's call,
 * Nov 23 2026). Under `health` of its armor (75%, 50%, 25%) the mound is at that step:
 *   every, size, cap  its own bursts: `size` defenders out of the mound every `every` seconds, at most `cap` of them up
 *                     at once (the Scuttlers and Brutes out after whoever shot at it, MURMUR.alarm, count toward the
 *                     cap too, so an alarm and the bursts never stack past it)
 *   exits             its tunnels: that many more exits open and stay open at once (one opened every `gap` seconds,
 *                     not 25), and each pack up through them is `pack` times as big; all within the Murmur's usual
 *                     number up at once (murmurRoom)
 * DEEP_LAST: under `health` its last stand, once: `scuttlers` and `brutes` pour out of the mound and `perExit` up
 * through each of its open exits, all after the colonies' nearest, and every colony is told.
 */
const DEEP_SURGES = [
  { health: 0.75, every: 32, size: 2, cap: 5, exits: 1, gap: 20, pack: 1.25 },
  { health: 0.5, every: 24, size: 3, cap: 8, exits: 2, gap: 15, pack: 1.5 },
  { health: 0.25, every: 16, size: 4, cap: 12, exits: 3, gap: 10, pack: 1.75 },
];
const DEEP_LAST = { health: 0.12, scuttlers: 10, brutes: 3, perExit: 2, reach: 30, last: 90 };
/**
 * Bloom veins (R_VEIN, the Hollow): cut down to nothing, a vein grows back in `regrow` seconds (the Bloom spreads back
 * along its ridge). Cutting veins draws the Murmur: a Harvester that cut one in the last `lure` seconds looks `pull`
 * times nearer to a nest choosing what its next pack goes for, from up to `reach` tiles further out than usual.
 * Only where the Murmur are in the game (wildOn).
 */
const VEIN = { regrow: 150, lure: 120, pull: 2, reach: 8 };
/**
 * Ceiling tremors, the Hollow's weather (a map event, like the Volcano's eruptions): the first comes `first` seconds
 * in, then one every `gap` seconds. Dust sifts down for `dust` seconds (looks and sound only). Every `rockEvery`th
 * tremor also brings rock down on a spot away from the breaches (with its twin on the other colony's side): dust
 * trickles there for `warn` seconds first, then everything within `r` tiles is hit (`damage` armor off a building,
 * never below 1; `botDamage` to a robot out in the open) and a boulder or two of Stone lies where it fell.
 */
const TREMOR = { first: 210, gap: [100, 150], dust: 10, rockEvery: 2, warn: 8, r: 1.6, damage: 4, botDamage: 3 };
// River delta: fords are slow to wade (speed ×) and dearer to plan a route through (cost ×).
const FORD_SLOW = 0.45, FORD_COST = 2.5;
// Warbots you order somewhere (move, station, call back) march there without stopping to fight, for at most this long (s).
const MARCH_MAX = 90;
const HUNT_CHAIN = 7; // (tiles round a hunted robot's death in which a person's hunters take the next enemy robot: huntNext)
/*
 * Army Groups (sim.js, Army Groups): up to `max` standing armies a player, each with a badge (its number and colour).
 * New army units for a group wait at the Reserve until `batch` of them (or as many as the group lacks) are ready, or
 * the first has waited `batchWait` seconds, then set off together. A Patrol or Attack moves on from a point once the
 * group has stood there `dwell` seconds with nothing to fight. Defend area's circle: `radii` (tiles), `rad` at first.
 * A group's target size runs 1 to `maxSize`; Patrol takes 2 to 3 points, Attack 1 to 5 waypoints.
 */
const AGROUP = { max: 6, batch: 3, batchWait: 30, dwell: 3, radii: [4, 6, 8, 10], rad: 6, maxSize: 40, nameMax: 16,
  colors: ['#ffcf4a', '#4ad6ff', '#ff7ad9', '#9dff6a', '#ff9a4a', '#c8a8ff'],
  // Stage 2. Raid (agRaid): the area's circle at first `raid.rad` tiles; at a target the group stays `strike` s at most
  // (a road: `road` s, `lane` s on a trade lane), and pulls out once it has lost `loss` of those it set off with, its
  // health is down to `hp` on average, half of it is out of Ammo, or the armed enemy robots within `foeNear` tiles of
  // the target outnumber its own. Home again it rests till its health is `rest` on average (`restMin` s at least,
  // `restMax` at most), then raids again (Repeat) or holds (Once). Targets are looked for every `look` s while none.
  raid: { rad: 8, strike: 120, road: 20, lane: 60, loss: 0.4, hp: 0.35, foeNear: 7, rest: 0.7, restMin: 10, restMax: 60, look: 10, outMax: 90 },
  // Behaviours (agBeh): Retreat when weak at one of `rets` (% health; 0 off), Reload rotation (at most a third away at
  // once), Stance (`stances`): Aggressive chases `aggLeash` tiles past the order's area; Hold fire shoots back only for
  // `hitHold` s after one of the group is hit. New groups start on `beh`.
  rets: [0, 25, 50], stances: ['agg', 'def', 'hold'], aggLeash: 7, hitHold: 5, beh: { ret: 25, rel: 1, st: 'def' } };
const RECALL_NO_LOOT = 60; // a warbot called home (Recall all, or its rally flag taken down) leaves crates be this long (see lootNear)
const CHOKE_BAND = 3;   // Chokepoint maps: rows of crags each side of the middle line
const CHOKE_APPROACH = 3; // ...and rows of open ground kept clear each side of the pass
const ISLE_GAP = 4;       // Islands maps: at least this much sea between islands (a wide sea: ships, or long, dear bridges)
const SKY_GAP = 1;        // Sky islands: canyons between mesas are narrower (short Viaducts)
const SKY_RES_MUL = 1.8;  // Sky islands: Ore, Crystal, Stalk and Stone hold this much more (half the fields fall in the canyons)
const HOME_STONE = 300;   // Islands and Sky islands: Stone each home island or mesa holds at the start (topped up near the base)
/**
 * The Ring (SHAPE_PRESETS asteroids: ringMap in world.js, the space backdrop in js/ring.js). Two colonies, each on a home
 * asteroid, a rich rock in the middle, a chain of stepping stones between, and resource rocks beside them, in empty space:
 * the space between is `T_CHASM` that nothing can cross or build on (no Sky bridge: `voidTile`), so a crossing is a
 * Viaduct or Ropeway, or flight. Argos's look and rules (the biome is forced to Lunar).
 *   gap    tiles of space between neighbouring asteroids: from `gap[0]` to `gap[1]` (a Viaduct spans gap + 1)
 *   mul    Ore, Crystal, Stalk and Stone on the asteroids hold this much more than usual (small rocks, few fields)
 *   oil    seep fields on each side: on the home asteroid, on each resource rock, and in the middle (both sides' share)
 *   stone  Stone each home asteroid holds at the start (HOME_STONE, topped up near the base)
 */
const RING = { gap: [3.5, 6], mul: 1.25, oil: { home: 3, rock: 1, mid: 2 }, stone: HOME_STONE };
/**
 * Half underground (SHAPE_PRESETS caves: cavesMap in world.js). One map half is the surface (the Biome's look and rules), the
 * other the caves (the Hollow's look, always dark, no weather); a solid wall between them is broken only by two or three
 * entrances. S.cave tiles: 0 surface, 1 inside the caves, 2 the wall (rock nothing tunnels through).
 *   stock     the opening stock on top of START_STOCK for a colony that starts inside (no Fiber source there) and for one
 *             that starts outside (little Ore or Crystal there): enough for the first minutes, then it has to branch out
 *             through the entrances; `bots` the extra Workers inside, which have no Agribot's crops to staff
 *   mouth     entrance half-widths (tiles to each side of the middle line): a narrow gate, a middle one and a wide mouth
 *   nests     Murmur nest sites on each half of the map (in twin pairs) by Size, only with the Murmur on
 *   ore, crystal, stone, oil, stalk  how many fields a thousand tiles of cave (ore, crystal, stone, oil) and of surface
 *             (stalk groves, fertile soil, a little Ore and Crystal) get: the caves hold the riches
 */
const CAVES = {
  stock: { inside: { fiber: 100, fuel: 30, stone: 10, cement: 12 }, outside: { ore: 60, crystal: 25, alloy: 25, fiber: 20 } },
  mouth: [1, 2.5, 5], wall: 2,
  nests: [2, 3, 4, 5, 7, 9],
  inside: { ore: 7, crystal: 5, stone: 4, oil: 1.2 }, outside: { stalk: 5.5, fert: 6, stone: 3, ore: 1.3, crystal: 0.9, oil: 1 },
};
/** Does map type `shape` (or, with none given, the current game's) have the caves (Half underground)? */
function cavesShape(shape) { const P = SHAPE_PRESETS[shape === undefined ? (typeof S !== 'undefined' && S && S.settings && S.settings.shape) || 0 : shape || 0]; return !!(P && P.caves); }
/** Is tile t inside the caves of Half underground (S.cave 1)? Missiles, bombs and aircraft don't reach it, nothing grows there, the sky's weather stays out. */
function caveTile(t) { return !!(typeof S !== 'undefined' && S && S.cave && S.cave[t] === 1); }
/** Is the point (x, y) (tile units, anywhere on a tile) inside the caves? */
function caveAt(x, y) { return !!(S && S.cave && x >= 0 && y >= 0 && x < S.W && y < S.H && S.cave[(y | 0) * S.W + (x | 0)] === 1); }
/** Is tile t the wall between the caves and the surface (rock no road tunnels through)? */
function caveWall(t) { return !!(S && S.cave && S.cave[t] === 2); }
const LOOT_MAX = 500;     // most crates a wrecked or dismantled building spills of what was inside it
const LOOT_TIME = 300;    // seconds a pile of crates on no-one's land lies before it rots away (on claimed land it stays)
const LOOT_KEEP = 1e9;    // ...or never, for crates that were always there (the Hollow's side chambers): its `until`
const CRATE_SAFE = 6;     // haulers collect crates on their own land only with no enemy robot (or gun) within this many tiles
const CRATE_RETRY = 10;   // seconds a player's robots leave a pile of crates none of them found a way to (walled in by sites, say) before trying again
const FLAG_LOOT = 8;      // warbots holding a flag carry home crates lying this many tiles from it, with no enemy (the Murmur too) as near (flagLoot)
// Walls and Gates: an enemy warbot plans a route through one as if it were this many extra tiles
// long, plus one per point of armor left, so it walks round a short way and breaks through a long one.
const BREACH_COST = 8;
const BREACH_PER_ARMOR = 1;
// Route planning for the army on the march (warbots, Bulwarks, Torches): a tile an enemy gun reaches (dangerMap bit 1)
// costs this much more, so they go round a gun when the way round is short. A cost, not a ban.
const COVER_COST = 4;
// Forts (Outposts, the Command Base): a missile can't take one below MISSILE_FLOOR of its armor, and
// once it's under SORTIE_ARMOR every armed warbot inside goes out to fight. Taking one ejects whoever
// is still inside instead of killing them.
const MISSILE_FLOOR = 0.35;
/*
 * How a Versus game is won (the new-game screen's Victory row). However it's won, a rival that has clearly lost
 * surrenders (see SURRENDER).
 *   capture     take every rival's Command Base: the last colony standing wins
 *   domination  hold most of the land for a while (see DOM)
 *   uplinks     hold most of the neutral Uplink towers for a while (see UPLINK)
 */
// `note`: the one line under the Victory buttons of the new-game menu that says what the chosen one means.
const VICTORY = {
  capture: { name: 'Capture', info: 'Capture: take a rival\'s Command Base and all it built is yours; the last colony standing wins.',
    note: 'Win by capturing every rival\'s Command Base: march your warbots in and take it, and all it built is yours.' },
  domination: { name: 'Domination', info: 'Domination: hold most of the land anyone holds (and a good part of the planet) for 3 minutes straight to win.',
    note: 'Win by holding most of the land for 3 minutes straight. Outposts and Keeps claim the most; you can win without taking a base.' },
  uplinks: { name: 'Uplinks', info: 'Uplinks: neutral relay towers stand across the planet (3 to 5, by the map). One is yours while it stands in your land. Once they come online, 8 minutes in, hold at least half of them (and more than anyone else) for a total of 5 minutes to win.',
    note: 'Win by holding most of the neutral Uplink towers (one is yours while it stands in your land) for 5 minutes in all, once they come online 8 minutes in.' },
};
const VICTORY_ORDER = ['capture', 'domination', 'uplinks'];
/**
 * Uplinks: neutral relay towers (see placeUplinks). Each is held by the colony whose land it stands in, and is
 * jammed (counts for no one) while an armed warbot of another colony stands within `jam` tiles of it. The colony
 * holding most of them runs its clock; a total of `hold` seconds wins. The clocks only run once the Uplinks come
 * `online` (seconds in): before that they can be claimed, but every colony has time to build an army to fight for them.
 */
const UPLINK = { hold: 300, jam: 2.5, online: 480 };
/**
 * A rival that has clearly lost gives up (see checkSurrender): after `after` seconds of play, once its colony is
 * down to `left` of what it was at its height and the colony beating it is `odds` times as strong (buildings,
 * and warbots counting two each), or it has nothing left to rebuild with, for `hold` seconds all told (a moment
 * back in the fight winds the count back, twice as fast).
 */
const SURRENDER = { after: 720, hold: 40, left: 0.4, odds: 4 };
/**
 * Domination: a colony holding `share` of the land anyone holds (by how many colonies are still in: 60% with
 * two, half with three, 45% with four), and at least `min` of the planet's land, for `hold` seconds straight
 * wins (the count starts again whenever it slips under). Measured in AI games: each colony holds 12-25% of the
 * planet most of the game, the one that's winning a third of it by the end.
 */
const DOM = { share: [0, 0, 0.6, 0.5, 0.45], min: 0.2, hold: 180 };
/** Seconds before a missile (or a nuclear one, ×1.6) lands that its roar is heard diving in (sound only). */
const MISSILE_WARN = 1.3;
/** A Missile aimed at a spot with a rival robot or vehicle on the ground within this many tiles is its target: aimed where it stands at launch, no homing (missileBotAt). */
const MISSILE_LOCK = 0.9;
const SORTIE_ARMOR = 0.25;
const SORTIE_REACH = 6.5; // guards out on a sortie fight enemies within this of their garrison
// A guard out on a sortie gives up a foe that is more than this many tiles from the fort (or the building) it defends.
const SORTIE_LEASH = 9;
// Area defence (garrisonDefense): a fort with nobody at its own walls sends guards to a building of its owner's that
// enemy warbots are shooting at within AREA_DEFENCE tiles; they come home once it has been quiet AREA_QUIET seconds.
const AREA_DEFENCE = 14, AREA_QUIET = 6;
const DEFAULT_SIZE = { versus: 1, colony: 3, horde: 2 }; // (Horde: Large, HORDE.size)
const DEFAULT_ROUGH = 2;
const DEFAULT_RICH = 2;

// Resource nodes that sit on ground tiles. Energy crops are planted by a Bio Farm on fertile soil;
// oil seeps are pumped by an Oil Pump built on top of one.
const R_NONE = 0, R_STALK = 1, R_BOULDER = 2, R_ORE = 3, R_CRYSTAL = 4, R_CROP = 5, R_OIL = 6, R_URANIUM = 7, R_VEIN = 8;
const SKY_RICH = [R_ORE, R_CRYSTAL, R_STALK, R_BOULDER]; // the deposits SKY_RES_MUL makes richer on Sky islands' mesas
const RES = {
  [R_STALK]:   { key: 'stalk',   name: 'Stalk grove',     good: 'fiber',   amount: 3, harvest: 2.5 },
  [R_BOULDER]: { key: 'boulder', name: 'Boulder',         good: 'stone',   amount: 8, harvest: 3 },
  [R_ORE]:     { key: 'ore',     name: 'Ore vein',        good: 'ore',     amount: 24, harvest: 3.5 },
  [R_CRYSTAL]: { key: 'crystal', name: 'Crystal cluster', good: 'crystal', amount: 12, harvest: 3.5 },
  [R_CROP]:    { key: 'crop',    name: 'Energy crop',     good: 'fuel',    amount: 1, harvest: 2.5 },
  [R_OIL]:     { key: 'oil',     name: 'Oil seep',        good: 'crude',   amount: 16, harvest: 0 },
  [R_URANIUM]: { key: 'uranium', name: 'Uranium deposit', good: 'uranium', amount: 4, harvest: 5 },
  // (The Hollow only: the Bloom's veins on the cavern floors, cut for Fiber by a Harvester. See VEIN.)
  [R_VEIN]:    { key: 'vein',    name: 'Bloom vein',      good: 'fiber',   amount: 4, harvest: 3 },
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
/** A good's name for n of it: "5 Chips" (Chip is the one counted good; the rest read "5 Ore", "5 Alloy"). */
function goodN(g, n) { return GOOD[g].name + (g === 'chip' && n !== 1 ? 's' : ''); }

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
const NUKE_LAUNCH = 10; // (looks only) the missile waits in its Silo, warning lights flashing, until this many seconds before impact, then climbs away
const NUKE = { parts: { fissile: 6, alloy: 4, chip: 2 }, assemble: 60, range: 40, flight: 30, radius: 6, scorch: 240, direct: 2 }; // direct: a Command Base this near the impact is destroyed
const EVAC_MARGIN = 1.5; // an evacuation clears this much beyond the blast radius
/*
 * Radiation (the owner's design, Nov 2026). A nuclear blast's fallout (RAD.nuke, a tile past its blast) and a Nuclear
 * Reactor destroyed by a foe (RAD.reactor; dismantled, moved or wrecked by its own side, it shuts down safely) leave a
 * radiation zone: a circle `r` tiles round where it struck that shrinks steadily to nothing over `life` s (S.rads). In it:
 * robots out in the open lose `hurt` of their full health a second at its middle, `edge` of that at its rim (indoors and
 * in the air they're safe); every building there works `work` as fast (factories, gatherers, Bot Foundries, sites going
 * up); robots that don't fight route round it (`path` more for every tile of it they'd cross) and take no work in it
 * (gathering, paving) unless sent there; nothing new is built in it. A Shield Dome that stops a nuke stops its fallout
 * with it; fallout already on the ground is not kept out by one. A breached Reactor is left a ruin (S.ruins) with a broken
 * stack, smoking and, at night, glowing green and blue into the sky for `glow` s; then it is a cold wreck.
 */
const RAD = { reactor: { r: 4, life: 300 }, nuke: { r: 7, life: 330 }, hurt: 0.02, edge: 0.5, work: 0.5, path: 10, glow: 300, ruins: 12, max: 24 };

/*
 * Megastructures (the Megastructures setting on game setup, on by default; missions keep their own: megaOn). Late-game,
 * one per colony, slow to build and seen by everyone.
 *
 * The Lance of Corvane (BDEFS.lance): a 3 x 3 gun pit, a long barrel on a slow turntable. Aim it (its panel, then a
 * spot anywhere) and it charges for `charge` s, then fires a beam in a straight line from the gun through that spot to
 * the map's edge. Its core is `width` tiles wide: every building whose footprint touches it is wrecked (a Command Base or
 * Keep drops to its Missile floor), every robot in it dies, whosever it is, Walls are breached. Either side of the core
 * runs a scorched edge `edge` tiles wide: buildings touching it (and none of the core) lose `edgeDmg` of their full
 * armor, robots in it `edgeDmg` of their full health, but the edge alone never destroys anything (it leaves at least 1,
 * and a Command Base or Keep no lower than its Missile floor); water boils to steam, and a scorched
 * trench is carved for good (S.cuts; on War scars the ground under it burns to ash and the animals there die). It fires
 * only with power: at least `gens` Generators with Fuel within `reach` tiles of it, burning a Fuel every `genFuel` s
 * each while it charges, or a Nuclear Reactor there with `uranium` Uranium (or an Enriched Uranium) in it, taken as the charge starts. While it
 * charges its colony's lights dim and its factories work `slow` slower; wreck its power and the charge is lost. A dust
 * storm holds the shot (it waits, charged, until the storm blows over). `reload` s after a shot it can charge again. On
 * Reactor power a charge takes `reactorCharge` s and the reload `reactorReload` s (Generators: `charge` and `reload`).
 * With both in reach it uses the Generators unless its owner has switched on Use Reactor (b.lUseR, an order). A
 * Shield Dome on the line takes the whole shot and drops. Charging draws the Murmur (chargeWorth). Not in the Hollow
 * (no line of fire under the cavern roof); allowed on Argos.
 *
 * The Shield Dome (BDEFS.dome): a 2 x 2 emitter raising a dome `radius` tiles round its middle that stops what falls on
 * it from outside (domeCatch): Missiles, nuclear missiles, bombs and napalm, Ringfall, Howitzer and Mortar shells fired
 * from outside, rival Mass Driver canisters, rock from the Hollow's tremors, and a Lance shot. Robots walk in and guns
 * fire through. It has `max` strength; each hit costs `cost` of it (a nuclear missile or a Lance shot all of it); left
 * unhit for `quiet` s it recharges `regen` a second; at 0 it drops for `down` s and comes back at `back`. While up it
 * burns a Crystal every `crystal` s (Haulers bring them, `cap` at most) and needs a Generator with Fuel within `reach`
 * tiles: without either it's down. Its owner can turn it off (setPaused; down, no Crystal burnt); turned back on it
 * takes `warm` s to come up (b.dWarm), as long as a nuke's flight, so it can't be flicked on when a launch is seen.
 */
/*
 * Arrival City (BDEFS.city): a 4 x 4 square of four panel apartment blocks round a green, with a tram stop, built for
 * colonists who never came (the owner's look A, Nov 2026; its look since Nov 21, Four Blocks round a Square). It opens `at` s into a free-play game (a mission that teaches it: at once).
 * Every factory, gatherer, Oil Pump and Bot Foundry of its owner's within `reach` tiles of its middle works `boost`
 * faster, and Workers build that much faster there (cityBoost). It holds `land` tiles of land round its middle as an
 * Outpost does (a military claim), and in Domination every tile of that ring counts twice (cityLand). Its lights burn a
 * Fuel every `fuel` s at night only (Tankers bring it, `fuelCap` at most); out of Fuel at night it goes dark and its
 * boost falls to `dark` of itself. It can never be destroyed: whatever hits it (warbots, Missiles, bombs, shells, a nuke,
 * a Lance shot) knocks it down to 0 at most, and then it is knocked out like any megastructure (MEGA, b.mDown; b.cDown
 * while it's dark): its bonus stops and its windows go dark, and whoever holds it takes it (land, bonus and all). It
 * has no Demolish it. Not on Argos (the moon was never meant to be lived on). One per colony; it stores nothing.
 */
const CITY = { at: 720, reach: 8, boost: 0.2, land: 6, fuel: 60, dark: 0.5 };
/*
 * Seizing megastructures (the owner's call, Nov 24 2026). Robots that beat a megastructure to 0 armor don't wreck it:
 * it is knocked out (b.mDown): dark, its charge lost, no use to anyone, its owner's on paper only (b.owner kept), and its
 * owner's Workers can't repair it. Armed robots of one side (a colony and its team) within `reach` tiles of its walls,
 * with no foe's armed robots that close, fill its seize clock (b.mCap of `cap` s, b.mBy whose); contested, the clock
 * stops; left alone, it runs back `decay` times as fast. Full, it's theirs (its old owner retakes it the same way). Seized
 * it stands at `armor` of its armor, switched off (b.mOff): its new owner's Haulers bring `fee` of its build cost
 * (b.mNeed, what's still owed), then a Worker brings it online, mending it up to `online` of its armor. Anything it was
 * charging starts again; its stage (a Deep Core's depth, an Engine's stage) is kept. A colony that orders an enemy one
 * wrecked (Demolish it on its panel, ORDERS.megaWreck: b.mWreck, a bit per colony) shoots it on past 0: `wreck` of its
 * armor more and it is destroyed, `salvage` of its build cost spilling out in crates with what was inside. Missiles,
 * nukes, bombs, napalm, Howitzer shells and the Lance's shot destroy one as before (Arrival City: never destroyed).
 */
const MEGA = { cap: 40, reach: 3, decay: 1, armor: 0.25, fee: 0.25, online: 0.5, wreck: 0.5, salvage: 0.25 };
/*
 * The Orbital Lift (BDEFS.lift; the owner's look A, the Beacon Cable, Nov 2026): a 3 x 3 anchor pad with a cable up to
 * its colony's Carrier in orbit. As it is placed, R turns its fall line (b.lfDir, one of 8 directions: LIFT_DIRS): a
 * straight line from the anchor, half the map's width long (liftLen: Small 15 tiles .. Huge 30), that must fit on the map
 * and cross no other colony's land, Trade Post or neutral Uplink (liftLineWhy). Its panel calls a climber down with one
 * of four loads (LIFT.drops): it takes `climb` s and unloads at the anchor (robots step out; goods wait there for
 * Haulers), and every colony hears it start down. Then `cooldown` s from that landing to the next call; the first is
 * ready when it's finished. The Carrier holds `reserve` drops (b.lfRes): each call uses one. Restock the Carrier: the
 * goods ticked on its panel (b.lfSend {good: the reserve kept home}, up to `goods` of them: made goods or Crystal) come
 * by Hauler (and Tanker), and by conveyor from buildings touching the pad; at `load` goods a climber goes up (`climb` s;
 * never while one is coming down; it doesn't touch the cooldown). Each full climb up puts a drop back (up to `reserve`)
 * and makes the next drop `boost` bigger again (b.lfBoost, up to `boostMax` restocks: double). Every climb burns `fuel`
 * Fuel from a Generator within `reach` tiles; without it the climber waits; a solar flare stops it where it is. A climb
 * draws the Murmur at night like a working Generator. Below `weak` of its armor the cable sways and its line flashes red
 * for whoever has land or robots on it. Destroyed by a foe (not dismantled, not by its own side) it falls (liftFall):
 * `creak` s of creaking, then the cable comes down along its line from the anchor out at `sweep` tiles a second (on Argos
 * `lunar` of that): every building on it takes `crush` (a Keep is left at half, a Command Base at its Missile floor,
 * another megastructure badly hurt but standing), robots on it are destroyed and those beside it take `side`; Walls,
 * roads, track and pylons on it are broken; aircraft aren't hit. The line stays as cable wreckage (scrap of kind 4, b.cb:
 * liftWreckAt) for good: robots cross it at `slow` speed and nothing is built on it until Haulers cut it up, `cut`
 * Alloy a tile. One per colony. Not in the Hollow (the roof); on Argos the fall is slow.
 */
const LIFT = { climb: 45, cooldown: 360, reserve: 6, load: 30, goods: 3, sendReserve: 20, sendStep: 10, sendMax: 200, boost: 0.5, boostMax: 2,
  reach: 4, fuel: 2, weak: 0.3, creak: 5, sweep: 4, lunar: 0.5, crush: 30, side: 3, slow: 0.5, cut: 1, sparks: 60, feed: 1,
  drops: {
    security: { name: 'Security detail', bots: { warbot: 6, bulwark: 2 } },
    crew: { name: 'Work crew', bots: { worker: 6, truck: 2 } },
    alloy: { name: 'Alloy', goods: { alloy: 30 } },
    chips: { name: 'Chips', goods: { chip: 18 } },
  } };
/** The 8 directions a Lift's fall line can take (b.lfDir 0..7: east, then clockwise on the map: south-east, south, ...). */
const LIFT_DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const LIFT_DIR_NAMES = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
/** What a Lift can send up: the made goods and Crystal. */
const LIFT_GOODS = ['crystal', 'alloy', 'chip', 'fuel', 'cement', 'asphalt', 'ammo', 'warhead', 'fissile'];
/*
 * The Great Uplink (BDEFS.gup; the owner's look A, the Dish Array, Nov 2026): a 3 x 3 dish array built to talk to home,
 * and a second way to win. Only in a game with the Great Uplink win on (a game-setup switch beside Victory, off by
 * default; it works alongside whichever Victory was picked) and Megastructures on; never in Colony games or the Hollow
 * (no sky): gupWinOn. Its panel's Begin transmission opens `at` s into a game (at once in a mission that teaches it) and
 * needs `gens` Generators with Fuel within `reach` tiles of its square, each burning a Fuel every `genFuel` s while it
 * transmits; or a Nuclear Reactor and `rGens` Generator there, the Reactor burning a Uranium every `uEvery` s of
 * transmission (two for a whole one; an Enriched Uranium counts as two), taken as each stretch begins. With both, the
 * Generators (the Uranium is kept). Its panel's Stand down ends a transmission: its progress is lost. `hold` s of transmission make contact, and that colony (and its team) wins (S.endHow 'contact'). An armed
 * warbot of another colony within `jam` tiles of its square jams it; jammed or unpowered, the clock stops and runs back
 * at `back` speed (down to 0). Destroyed, the transmission is lost: a rebuilt one starts from 0. While it transmits every
 * colony sees a banner in the sender's colour and a ping on the map; alerts when it starts, at half, at 2 minutes and at
 * 30 s left (`alerts`). Its signal pulses every `pulse` s (looks and sound only). In the last `echo` s the Murmur repeat the pulse back (the sound). It draws the Murmur like a
 * working Generator while it transmits. One per colony; two colonies may transmit at once, and the first to finish wins.
 */
const GUP = { at: 1500, hold: 480, gens: 3, reach: 4, genFuel: 30, rGens: 1, uEvery: 240, jam: 3, back: 0.5, alerts: [240, 120, 30], echo: 20, pulse: 2.4 };
/** What answers, on the end screen of a game won by contact (the owner's answer (c), Nov 2026: Earth's fate stays open). */
const GUP_ANSWER = 'Signal acknowledged. Source unidentified. Further instructions to follow.';
/*
 * The Sundering Ray (BDEFS.sunder; the owner's look B, the Piston Battery, Nov 2026; drawn on the sheet as the "Seismic
 * Lance", renamed so it doesn't share the Lance of Corvane's name): a phased array. Three great hydraulic rams in a long
 * concrete block round its bore tower over a deep shot hole, and a row of ram plates set in the ground before it. It
 * winds up for `charge` s (`reactorCharge` on a Reactor), the rams pumping one after another, then fires: the bore
 * charge goes off and the plates slam in a timed ripple whose tiny delays steer the shock one way, a ray through the
 * earth. The ripple runs through the ground at `speed` tiles a second (between `travelMin` and `travelMax` s on the
 * way), caving in the Murmur's tunnels a tile either side of its path, and lands:
 *   Strike the Deep (on the Murmur; aimed anywhere, only with the Murmur on): in a `deep`-tile circle every tunnel caves
 *     in, every exit is collapsed and sealed (none opens there for `sealNights` nights: S.mur.seal), every nest loses
 *     `nestHit` of its full armor (never below 1) and sends no raid the next night (b.sQuiet), and a Sapper underground
 *     there dies. The nests live and the tunnels grow back as ever.
 *   Quake (on a colony; aimed within `range` tiles of its square): a ring shows on the ground for the last `warn` s of
 *     the wind-up, for everyone (the aim is fixed then). In a `quake`-tile circle buildings, whosever, lose `dmg` of
 *     their full armor but never drop below `floor` of it (a Command Base or Keep takes `baseDmg` of it); their
 *     foundations crack (b.crack): they work at `crackWork` speed until repaired to full. Roads and track crack (S.crk:
 *     robots on them move at `crackSpeed`) until a Worker mends them (`mend` s a patch of 3 x 3 tiles), Walls and Gates
 *     crack (they take `wallTakes` times the damage until repaired to full), robots there are stunned for `stun` s and
 *     take no damage; aircraft aren't touched. Any tunnels and exits there cave in too.
 * A Shield Dome doesn't stop it: it comes through the ground. Power, as the Lance of Corvane's: `gens` Generators with
 * Fuel within `reach` tiles (a Fuel every `genFuel` s each while it winds up) or a Nuclear Reactor there with `uranium`
 * Uranium (or an Enriched Uranium) a blow; lose the power and the blow is lost. `reload` s (`reactorReload`) after a
 * blow it can wind up again. Winding up draws the Murmur like the Lance's charge, and they hear every blow: the next
 * night every nest within `lure` tiles sends its packs at it first, `packMul` times bigger (Active; normal size on
 * Quiet: b.sLure). In the Hollow every blow also brings `rocks` rocks down from the roof inside its circle. Opens `at`
 * s into a free-play game (at once in a mission that teaches it). One per colony; everywhere, on Argos (no Murmur) a
 * Quake weapon only. Its cracks on the ground show for `scar` s (S.sunders keeps the last `keep` blows).
 */
const SUNDER = { at: 1080, charge: 60, reactorCharge: 40, reload: 300, reactorReload: 240, gens: 2, reach: 4, genFuel: 30, uranium: 1,
  deep: 16, quake: 5, range: 30, warn: 20, dmg: 0.4, floor: 0.1, baseDmg: 0.2, stun: 4, crackWork: 0.5, crackSpeed: 0.5, wallTakes: 2,
  nestHit: 1 / 3, sealNights: 2, lure: 40, packMul: 1.5, speed: 10, travelMin: 1.5, travelMax: 6, mend: 4, rocks: 3, scar: 300, keep: 8, stroke: 0.55 };
/*
 * The Deep Core (BDEFS.deepcore; the owner's look A, the Headframe, Nov 21 2026): a 3 x 3 winding tower over a shaft that
 * goes deeper by itself while it has power, bringing up Ore, then Crystal, then a little Uranium, and never running dry.
 * It opens `at` s into a free-play game (a mission that teaches it: at once). Power: a Generator with Fuel within `reach`
 * tiles of its square (the Core burns a Fuel from it every `genFuel` s while it works), or a Nuclear Reactor there (no
 * Uranium used); without power it stops, output and depth both, but keeps the depth it has (b.dcT, s of powered work).
 * Its stage (b.dcStage): 1 at once, 2 from `stages[1]` s of depth, 3 from `stages[2]`; `out[stage - 1]` is what it brings
 * up a minute (Uranium 0.25: one every 4 minutes), into its own store, `cap` of each at most (full, that good stops);
 * Haulers carry it off. On Argos (`lunar`) no Crystal. Below `weak` of its armor it goes no deeper and brings up half.
 * The Murmur: it draws them each night like a working Generator; reaching stage 2 calls a raid for it the next night,
 * `call` times a night's pack (b.dcCall, the night b.dcCallN); stage 3 calls one with `breakers` Brutes more, and opens a
 * new exit within `exitR` tiles of it that night (for good, until caved in). In the Hollow (their home) every call is
 * `hollow` times as big. With the Murmur off a stage costs nothing. Destroyed, its stock and depth are lost; with the
 * Murmur on the open shaft becomes their exit (a burrow, e.shaft its colony's id) until a Worker of that colony caps it
 * (`capT` s of work, `capCement` Cement from storage), or warbots cave it in. It never counts against a rival's two
 * megastructures: any rival builds one once it is `aiAt` s in. One per colony.
 */
const DEEP = { at: 1200, reach: 4, genFuel: 60, stages: [0, 360, 960], out: [{ ore: 6 }, { ore: 8, crystal: 3 }, { ore: 10, crystal: 4, uranium: 0.25 }],
  cap: 30, weak: 0.5, call: 1.5, breakers: 2, exitR: 8, hollow: 2, capT: 20, capCement: 4, aiAt: 1200 };
/*
 * The Atmosphere Engine (BDEFS.atmos; the owner's look A, the Rain Tower, Nov 21 2026): a 4 x 4 cooling-tower shell that
 * slowly changes the weather and the land round it, finishing the Pathfinder's work. It opens `at` s into a free-play game
 * (a mission that teaches it: at once). Power: `gens` Generators with Fuel within `reach` tiles of its square, the Engine
 * taking a Fuel from each every `genFuel` s (b.aeFuel: s left of the Fuel it last took; b.aeGens their ids), or a Nuclear
 * Reactor there burning a Uranium every `uEvery` s (b.aeU). Without power it stops growing; what it changed stays.
 * Its stages (b.aeStage, from b.aeT, s of powered work: `stages`): 1 Calm, 2 Rain, 3 Green, 4 Garden, reaching `r` tiles
 * from its middle. Calm: no dust storm inside (bots at full speed). Rain: barren ground turns fertile (S.fert) and the
 * Bloom stops spreading (no tunnel is dug in). Green: crops there grow `crop` times as fast and the Bloom withers back a
 * tile every `wither` s (tunnels and Bloom veins). Garden: no Bloom, no Murmur exit, and groves seed themselves (one every
 * `seedEvery` s, `groves` at most). The land each stage reaches is marked in S.green (tile: 1 to 4, kept for good), spread
 * out from its foot at `spread` tiles a second. The circle is its owner's (and allies'): the calm in a dust storm and the
 * faster crops are theirs only (atmosOwnAt), the land changes for everyone in it (fertile soil, the Bloom held back).
 * From Rain, a foe's robots and vehicles on its ground move at `mud` speed (the mud: atmosMud), and while it has power
 * a foe's Torches can't burn the ground or leave fires in it (the rain puts them out: atmosRainAt).
 * The Murmur: they go for it first every night; each new stage, the next night `sappers[stage - 1]` Sappers dig in under it.
 * Destroyed: what is green stays green; its calm and its hold on the Bloom shrink back to nothing over `fade` s (S.aeFade).
 * Not on Argos (no air) nor in the Hollow (no sky). A rival's main project: the Steward's with Planetary events on, from
 * `aiAt` s; the Herald sends Torches to burn a foe's greening.
 */
const ATMOS = { at: 1200, reach: 4, gens: 2, genFuel: 60, uEvery: 360, r: [8, 12, 16, 20], stages: [0, 360, 960, 1680], spread: 0.25,
  crop: 1.25, wither: 60, seedEvery: 20, groves: 24, fade: 600, sappers: [0, 1, 2, 2], lure: 20, aiAt: 1260, burnEvery: 120, burnN: 2, mud: 0.5 };
const ATMOS_STAGE_NAMES = ['Calm', 'Rain', 'Green', 'Garden'];
/*
 * The Engine's Storm Front (the owner's approval, Nov 21 2026): from Rain its owner sets a storm down anywhere on the map
 * (an order: atmosStorm; b.aeStorm the tile it's centred on), `r` tiles round, while the Engine stands and has power (no
 * power: the storm is gone until it has again, in the same place). Not where it would reach the Engine's own circle (its
 * stage's full radius), nor centred in another Engine's circle; and nothing of it in any Engine's circle (the calm: two
 * Engines contest the sky). It can be set down again `cd` s after the last time. Under it, for the owner's foes: robots
 * and vehicles at `slow` speed, building sites go up at `build` speed, guns reach `range` as far. From Green, a foe's
 * crops under it stop growing (the drought: S.drought, tile: s under it) and after `drought` s wither (the soil stays).
 * At the Garden, every `boltEvery` s lightning strikes one of a foe's buildings under it (picked by the seed): `boltDmg`
 * of its armor, never below `boltFloor`. Destroyed, the storm ends at once. Everyone sees it.
 */
const STORM = { r: 5, slow: 0.6, build: 0.6, range: 0.75, cd: 60, drought: 180, boltEvery: 60, boltDmg: 0.15, boltFloor: 0.3 };
const LANCE = { charge: 90, reload: 240, reactorCharge: 45, reactorReload: 180, gens: 2, reach: 4, genFuel: 30, uranium: 2, slow: 1 / 3, width: 2, edge: 1, edgeDmg: 0.5, warn: 20, beam: 2.5, glow: 45, cutsMax: 24 };
const DOME = { radius: 9, max: 100, quiet: 10, regen: 1, down: 60, back: 40, crystal: 20, cap: 6, reach: 4, warm: 30,
  cost: { missile: 25, nuke: 100, bomb: 10, napalm: 10, shell: 3, rocket: 3, canister: 3, meteor: 25, rock: 10, lance: 100 } };

// You (blue, COBALT), the rival (red), and in a free-for-all the green and purple rivals. Purple stands apart
// from the other three and from every biome's ground (gold would vanish on desert, savanna and lava).
const PLAYER_COLORS = ['#38d4ff', '#ff5a6e', '#5be06c', '#b36bff'];
const RIVAL_NAMES = ['Blue', 'Red', 'Green', 'Purple']; // (COBALT is blue, as LORE.md has it)
/**
 * Whose team art each colony wears (art keys '<name>@<team>': 0 cyan, 1 red, 2 green, 3 purple). It is [0, 1, 2, 3]
 * except in a multiplayer game where the players picked their colours in the lobby: then the start's settings carry
 * the pick (settings.look) and every device applies it before the game is made (applyLook in js/polish3.js), so the
 * colours, colour names and callsigns of each colony agree everywhere. Only the look: the game itself never reads it.
 */
const TEAM_ART = [0, 1, 2, 3];
function artTeam(o) { const t = TEAM_ART[o]; return t === undefined ? o : t; }
/**
 * The hidden boost menu (tap the clock three times, or press ` on a keyboard): for a game you're winning
 * too easily, or losing. Each button gives you or one rival this much, at its Command Base.
 */
const BOOST = {
  goods: { cement: 40, stone: 20, fiber: 30, ore: 20, crystal: 15, alloy: 15, chip: 6, fuel: 20, ammo: 15 },
  warbots: 4, workers: 3, haulers: 3,
};
/**
 * The unit types the hidden menu can stop every rival making for the rest of a game (S.ban): their Bot
 * Foundry, shipyard and hangar skip them, and the computer stops planning round them. Ones they have carry on.
 */
const BANNABLE = ['warbot', 'bulwark', 'torch', 'skirmisher', 'arccaster', 'railgunner', 'rocket', 'bomber', 'ferry'];

/**
 * The Accord's callsigns for the four colours (LORE.md): a colony is named by its callsign, with its colour beside it
 * where that helps find it on the map ("VERMILION (red)"). Any callsign can run any doctrine.
 */
const CALLSIGNS = ['COBALT', 'VERMILION', 'VIRIDIAN', 'TYRIAN'];
/** Player p's callsign; with `colour`, its colour too: "VERMILION (red)". */
function callsign(p, colour) {
  const c = CALLSIGNS[p] || 'UNKNOWN';
  return colour && RIVAL_NAMES[p] ? `${c} (${RIVAL_NAMES[p].toLowerCase()})` : c;
}
/** A colony as a name to stand in a sentence about it ("VERMILION's robots"): a person's name in multiplayer, else its callsign. */
function colonyName(p) {
  const G = typeof S !== 'undefined' && S ? S : null;
  return G && G.players && G.players[p] && G.players[p].name ? G.players[p].name : callsign(p);
}

/**
 * What to call player p: 'You' (whoever plays on this device), a person's name in multiplayer, else its callsign
 * ('VERMILION'; 'VERMILION (ally)' for your ally in a team game). The Murmur's slot is the Murmur (Colony: the second). In a
 * sentence (the = true) only 'you' and 'the Murmur' change: a callsign stands without "the".
 */
function playerName(p, the) {
  const me = typeof ME !== 'undefined' ? ME : 0, G = typeof S !== 'undefined' && S ? S : null;
  if (p === me && !(G && G.watch)) return the ? 'you' : 'You'; // (whoever is playing on this device; nobody, in a game being watched)
  if (G && ((G.mode === 'colony' && p === 1 && !(G.horde && G.horde.pair)) || (G.wildlife && p === (G.wildOwner ?? 1)))) return the ? 'the Murmur' : 'Murmur'; // (co-op Horde side by side: colony 1 is a partner's)
  if (G && G.players && G.players[p] && G.players[p].name) return G.players[p].name; // (a person, in multiplayer)
  const ally = G && G.teams && typeof allies === 'function' && allies(p, me);
  return ally ? `${callsign(p)} (ally)` : callsign(p);
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
 *   roadworks its Pavers lay planned road (see ROAD_CREW), then asphalt on any road joined to it, nearest first
 *   crews     how many bots of its crew it takes (1 if not given)
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
    name: 'Outpost', desc: 'Holds a wide ring of land: your buildings inside it can\'t be cut off by a rival while it stands, and it\'s where you can put defences out in the open. Garrisons warbots for attack and defence. A road can run through it, for your own bots only: enemies have to break in.',
    cost: { cement: 4, fiber: 2 }, mil: true, terr: 7, garrison: 10, armor: 16, buildTime: 12, ammoStock: 6,
  },
  turret: {
    name: 'Pulse Turret', desc: 'Shoots enemy bots in range. Uses Crystal as ammo (4 shots each).',
    cost: { cement: 3, alloy: 3 }, ammo: 'crystal', range: 5, armor: 20, buildTime: 10, war: true,
    gun: { damage: 5, reload: 1.3 }, // (was 1.1 s: toned down a touch)
  },
  // Defences that work alongside the Pulse Turret (see BUNKER, and `disrupt` and `mortar` below).
  bunker: {
    name: 'Bunker', desc: 'A concrete pillbox for 2 warbots. From behind its walls they shoot enemy robots within 3½ tiles with their own Ammo (it keeps a little to reload them) and recharge, and nothing can shoot them back until the Bunker falls. It claims no land, so it can go anywhere in your territory: on a wall line, beside a Gate, at a bridgehead. Shot down, it\'s wrecked and its warbots walk out.',
    cost: { cement: 6, alloy: 2 }, mil: true, bunker: true, terr: 0, garrison: 2, armor: 40, buildTime: 14, ammoStock: 4, range: 3.5, war: true,
  },
  disruptor: {
    name: 'Disruptor Tower', desc: 'Every few seconds it sends out a pulse that jams the guns of enemy robots within 4½ tiles for 2 seconds and drains their batteries: drained warbots slow down, hit at half power and have to go home to recharge. It kills nothing itself, so pair it with a turret or a Bunker. It burns Fuel (one for every 4 pulses), only while enemies are in range.',
    cost: { cement: 4, alloy: 3 }, ammo: 'fuel', ammoCap: 4, range: 4.5, armor: 12, buildTime: 12, war: true,
    disrupt: { every: 2.5, drain: 10, perFuel: 4, jam: 2 },
  },
  mortar: {
    name: 'Mortar Pit', desc: 'Lobs shells at enemy robots 3 to 10 tiles away, aiming where they bunch up: each shell hurts the robots within a tile and a half of where it lands (up to 6 of them). Slow to reload, and it can\'t hit anything closer than 3 tiles. Fires Ammo (3 shells each).',
    cost: { cement: 5, alloy: 3 }, ammo: 'ammo', ammoCap: 4, range: 10, minRange: 3, armor: 14, buildTime: 12, war: true,
    mortar: { reload: 5, shells: 3, damage: 6, splash: 1.5, splashDamage: 3, most: 6, flight: 1.6, bld: 3 }, // (bld: what a shell does to a building it's aimed at: see ORDERS.focus)
  },
  flak: {
    name: 'Flak Gun', desc: 'A twin anti-aircraft gun. It fills the sky round enemy aircraft out to 7 tiles with bursting shells, leading them as they fly: each burst hurts any aircraft within about a tile of it. A plane can get through one quick pass, but not circling over a few of these. It bursts an enemy Mass Driver\'s canisters flying over too, when no aircraft is in reach. It can\'t hit anything on the ground. Fires Ammo (8 shells each).',
    cost: { cement: 4, alloy: 3 }, ammo: 'ammo', ammoCap: 4, range: 7, armor: 14, buildTime: 10, war: true,
    flak: { reload: 1.0, shells: 8, salvo: 2, damage: 4, splash: 1.0, speed: 14, scatter: 0.7 },
  },
  // The Minigun Nest (see MINIGUN): a cheap rotary gun that spins up and hoses enemy robots with tracer rounds.
  minigun: {
    name: 'Minigun Nest', desc: 'A cheap, short-range deterrent: a six-barrel rotary gun on an armoured mount. It spins up, then hoses the nearest enemy robot in the open within 3½ tiles with a stream of tracer rounds: each does little, but it fires twelve a second, and every robot it hits is pinned down (it moves at half speed and shoots slower for a moment). Great against swarms of workers, haulers and creatures; slower to bring down a warbot than a Pulse Turret. Fires Ammo (60 rounds each).',
    cost: { cement: 2, alloy: 2 }, ammo: 'ammo', ammoCap: 4, range: 3.5, armor: 12, buildTime: 6, war: true,
    minigun: { rate: 12, damage: 0.2, rounds: 60, spin: 0.5, turn: 4.5 },
  },
  // The Keep: a big fort (see KEEP): its warbots fire from cover like a Bunker's, its roof cannon fires Crystal,
  // and its aura toughens Walls and Gates and sharpens the defences round it.
  keep: {
    name: 'Keep', desc: 'A massive fortified concrete base with a heavy twin pulse cannon on its roof. It houses up to 25 warbots: 6 of them fire from its gun slots at enemy robots within 4 tiles, with their own Ammo, and all of them recharge and reload inside; nothing can hit them until it falls, and it has to be captured, not knocked down. Its cannon fires Crystal out to 6 tiles. Within 7 tiles your Walls and Gates take a third less damage and slowly mend themselves, and your Pulse Turrets, Bunkers, Mortar Pits, Flak Guns and Disruptor Towers reach a tile further and fire a fifth faster. Keeps stand at least 16 tiles apart. It claims land like an Outpost, and like an Outpost your roads run straight through it (enemies have to break it to get past).',
    cost: { cement: 14, alloy: 6, chip: 2 }, mil: true, keep: true, terr: 6, garrison: 25, slots: 6, ammoStock: 12, armor: 60, buildTime: 24, war: true,
    ammo: 'crystal', ammoCap: 3, range: 6, gun: { damage: 5, reload: 1.55 }, // (was 1.3 s: toned down a touch)
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
    name: 'Roadworks', desc: 'Takes two Pavers. They lay your planned roads, twice as fast as a Worker, then upgrade your roads to asphalt, the fastest surface, working outwards along the roads you mark in Paths (Pave), however far along joined roads (or every joined road, if you choose). One Asphalt covers four tiles. They also lay Express lanes (Paths, Express): 1 Asphalt and a quarter Alloy a tile.',
    cost: { cement: 3, alloy: 1, fiber: 2 }, staff: true, crew: 'paver', crews: 2, roadworks: true, armor: 8, buildTime: 10,
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
    desc: 'Fires Missiles from a Missile Factory at rival buildings far away. A hit wrecks most buildings outright, Outposts and Bunkers included, and damages the buildings and bots around it; a Command Base or Keep it only knocks down, so warbots can capture it. Holds two Missiles.',
    cost: { cement: 5, alloy: 4, chip: 2 }, ammo: 'warhead', ammoCap: 2,
    missile: { range: 22, reload: 60, damage: 24, splash: 2.2, splashDamage: 5, botDamage: 9 }, armor: 14, buildTime: 16, war: true,
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
    desc: 'Bots recharge their batteries here, four at a time, and trucks fill their fuel tanks. It burns Fuel: one Fuel recharges two full batteries, or fills one truck. Build them near busy areas far from your Command Base.',
    cost: { cement: 3, alloy: 1 }, charger: { slots: 4, rate: 25, fuel: true }, fuelCap: 4, armor: 10, buildTime: 10,
  },
  farm: {
    name: 'Bio Farm', desc: 'An Agribot plants energy crops on fertile soil nearby and harvests them into Fuel. Crops take a while to ripen.',
    cost: { fiber: 2, cement: 2 }, staff: true, crew: 'agribot', farm: true, radius: 3, out: { fuel: 6 }, armor: 8, buildTime: 9,
  },
  pump: {
    name: 'Oil Pump', desc: 'Built on top of an oil seep. Its worker pumps Crude until the seep runs dry (set a stock limit in its panel to stop it sooner).',
    cost: { cement: 2, alloy: 2 }, staff: true, pump: true, inp: {}, make: { crude: 1 }, out: { crude: 6 },
    work: 6, armor: 8, buildTime: 10, // (no stock limit: it pumps until the seep runs dry, unless you set one)
  },
  refinery: {
    name: 'Refinery', desc: 'Refines Crude into Fuel, one for one. Stops at 30 Fuel unless you change its stock limit. Keep it out of harm\'s way: destroyed, it explodes, the fuller the bigger, hurting everything round it.',
    cost: { cement: 4, alloy: 3 }, staff: true, inp: { crude: 1 }, make: { fuel: 1 }, out: { fuel: 8 }, explodes: true,
    work: 6, armor: 10, buildTime: 12, limit: 30,
  },
  fueltank: {
    name: 'Fuel Tank', desc: 'Big storage for Crude and Fuel only: up to 120 of them together. The hub of an oil bloc: your Oil Pumps\' Pipe it in buttons send their Crude here (or to the nearest Refinery, if closer), a pipeline with a Fuel Tank on it moves twice as much, and it feeds the Refineries, Asphalt Plants and Fuel users right beside it by conveyor and takes in the Fuel a Refinery beside it makes. Tankers fill up here. Keep it well away from harm: destroyed, it goes up in a huge blast, the fuller the bigger, setting off Refineries, Fuel Tanks and loaded Tankers nearby.',
    cost: { cement: 5, alloy: 2 }, store: true, tank: 120, explodes: true, armor: 12, buildTime: 12,
  },
  ramp: {
    name: 'Ramp', desc: 'Workers cut a sloped road into a low cliff so bots can climb between levels. Plan it in Paths, on the top or at the foot of a cliff. A worker builds it from whichever side is the shorter trip, so a Ramp down off high ground is built from the top: nobody drives all the way round.',
    cost: { cement: 3, fiber: 1 }, ramp: true, armor: 4, buildTime: 10,
  },
  // A Terraform job on one tile (see TERRA): planned from Build → Terraform, worked by a Grader, gone when it's done.
  // Not in the build menu; its cost and time are its own (b.cost, b.buildTime), its job b.tf.
  earthwork: {
    name: 'Earthworks', desc: 'Ground being raised, lowered, filled or dug by a Grader (Build → Terraform). When the Grader is done the site goes and the new ground stays.',
    cost: { stone: 1 }, earthwork: true, armor: 4, buildTime: 20,
  },
  // Terraforming, stage 2 (SOIL, GROVE, IRR, SHIFT): on the Terraform tab. `t2`: the player's alone (rivals never build them).
  composter: {
    name: 'Composter', desc: 'A rotary drum that turns Fiber and Stone into humus and spreads it round. Haulers bring a Fiber and a Stone for each batch; every open tile in reach grows richer over time, from barren to improving to rich. Rich soil is farmland, and crops on richer soil grow faster and give more Fuel.',
    cost: { cement: 2, fiber: 2 }, compost: true, t2: true, inp: SOIL.batch, hopper: SOIL.hopper, radius: SOIL.reach, armor: 8, buildTime: 10,
  },
  nursery: {
    name: 'Tree Nursery', desc: 'An Agribot plants groves of Earth trees on open ground nearby, leaving lanes between them. They grow from saplings to young trees to a mature grove, which bears Fiber now and then for the Agribot to gather. Enemy robots crawl through them. Groves burn, and can be cleared.',
    cost: { fiber: 3, cement: 2 }, staff: true, crew: 'agribot', nursery: true, t2: true, radius: GROVE.reach, out: { fiber: 6 }, armor: 8, buildTime: 10,
  },
  wpump: {
    name: 'Water Pump', desc: 'Built beside water, it lifts it into the pipes joined to it and along canals a Grader dug. The ground beside them turns green and wet, sprinklers water round each pipe\'s end, and Bio Farms can plant crops on wet ground, even desert.',
    cost: { cement: 3, alloy: 1 }, wpump: true, t2: true, armor: 8, buildTime: 10,
  },
  // Terraforming, stage 3 (SEAM, SEED, THERMAL): on the Terraform tab too, `t3`; the player's alone. `t3pow`: run on a
  // Generator's or Thermal Plant's power (updateGenerator powers them while they ask for it).
  seamdrill: {
    name: 'Seam Drill', short: 'Seam',
    desc: 'A small derrick that surveys the ground round it for hidden Ore and Crystal seams, further the longer it runs, and drills the nearest one it finds. It needs power: a Generator with Fuel or a Thermal Plant nearby. Slow and steady: 2 Ore or 1 Crystal a minute, until the seam is worked out. Haulers take what it brings up.',
    cost: { cement: 6, alloy: 4, chip: 2 }, seamdrill: true, t3: true, t3pow: true, out: { ore: SEAM.cap, crystal: SEAM.cap }, radius: SEAM.survey[1], armor: 10, buildTime: 14,
  },
  seedmast: {
    name: 'Seed Mast', short: 'Mast',
    desc: 'Grows a Crystal Seedbed on the ground round it. It prepares up to six beds, seeds each with a Crystal Haulers bring, and charges them to grow: seeded, sprouting, then ripe Crystal that a Crystal Tap gathers. It needs power (a Generator with Fuel or a Thermal Plant nearby): without it, the beds starve and stop. Slow, but it never runs out. A growing field draws the Murmur.',
    cost: { cement: 5, alloy: 3, crystal: 4 }, seedmast: true, t3: true, t3pow: true, inp: { crystal: SEED.seed }, hopper: SEED.hopper, radius: SEED.reach, armor: 8, buildTime: 12,
  },
  thermal: {
    name: 'Thermal Plant', short: 'Thermal',
    desc: 'Power from the heat below, with no Fuel: built right beside lava, the hot water of the Cinderlands or the Steamwells, or a Steamwells vent. Like a Generator, every factory, Refinery, Oil Pump and Bot Foundry within 3 tiles works a third faster while it runs, and it powers a Seam Drill, a Seed Mast, a Maglev Terminal or a Mass Driver end (a shot on it costs no Fuel). It never powers a megastructure: those want a Generator\'s Fuel.',
    cost: { cement: 6, alloy: 3, chip: 1 }, t3: true, burner: { radius: THERMAL.radius, boost: 1 / 3, perFuel: 0, heat: true }, armor: 10, buildTime: 12,
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
    name: 'Airfield', desc: 'A runway and hangar for a Cargo Plane and two Vulcan Bombers (order them on its panel: the hangar builds them from Alloy and Chips). A plane drops a Drop Outpost anywhere on open ground nobody else holds, two Warbots or Workers wherever you like, or keeps a place you supply by air stocked, 8 goods a flight. Haulers bring the Airfield what those places are short of, and Tankers its planes\' Fuel: it keeps 12, and every flight burns some (a Cargo Plane\'s long round trip 4 to 6, a bomber sortie 3 on top of its tank). Its hangar builds Airships too: they take no spot in it, and fly off to a line between two Mooring Masts. It is storage too, like a Depot.',
    cost: { cement: 10, alloy: 4 }, store: true, airfield: true, armor: 16, buildTime: 16, yard: ['cargoplane', 'bomber', 'airship'],
  },
  dropost: {
    name: 'Drop Outpost', short: 'Drop Outpost',
    desc: 'A small outpost a Cargo Plane drops by parachute, anywhere: a foothold over rough ground or far from home. It claims a little land, holds two warbots, stores goods and charges two bots from the Fuel stored in it. It is supplied by air from your Airfield (supply orders and Ammo for its warbots) until a road reaches it.',
    cost: { cement: 6, alloy: 3 }, store: true, mil: true, terr: 4, garrison: 2, ammoStock: 4, charger: { slots: 2, rate: 25, fuel: true }, armor: 14, airdrop: true,
  },
  mast: {
    name: 'Mooring Mast', short: 'Mast',
    desc: 'An armoured mooring mast for Airships, with a loading bay at its foot. Build two and link them (its panel: Link, then tap the other) to make an Airship line straight across anything: water, cliffs, rock. The far Mast stocks itself with what the buildings round it need and sends their spare goods home; the Mast nearer your Command Base keeps the line fed. Haulers bring the goods and take away what arrives, like at a Rail Station, and Tankers bring the Fuel it keeps for its Airships. Order Airships in an Airfield\'s hangar: with one line they go to it by themselves. Workers and Warbots ride the line too.',
    cost: { cement: 6, alloy: 3 }, store: true, mast: true, armor: 12, buildTime: 12,
  },
  station: {
    name: 'Rail Station', desc: 'Storage beside the railway: Freight Trains load and unload here. Build one at each end of a line (before the track if you like: drag rail from one station to the other and it ends beside each). Once a train runs on it, the far station stocks itself with what the buildings round it need and sends their output home, the station nearest your Command Base keeps the line fed, and trains carry several goods a trip. Buildings, a Command Base or a Depot touching a station are joined to it by conveyor, no Hauler needed: put your far factories round it. Supply orders you set come on top. Its rail yard builds Freight Trains: order them on its panel.',
    cost: { cement: 6, alloy: 2 }, store: true, station: true, armor: 12, buildTime: 12, yard: ['freight'],
  },
  magterm: {
    name: 'Maglev Terminal', short: 'Maglev',
    desc: 'Storage at one end of a Maglev line: a glass-sided transit hall built to the Accord\'s Phase 2 standard, with a dock at deck height on its roof. Build one, then plan the line in Paths (Maglev): tap this Terminal, then the far end 6 to 40 tiles away in any direction, straight across water, cliffs and chasms; a Worker builds it out pylon by pylon and the far Terminal goes up last. Order Maglev Pods on its panel (4 Alloy, 2 Chips each, four for each line): they carry 16 goods a trip at three times a Freight Train\'s speed. A Terminal joins up to three lines (a hub): pods carry goods on through it, line by line. The Terminals work like a railway\'s stations (the far ones stock what the buildings round them need and send their spare goods home), and buildings touching a Terminal are joined to it by conveyor. Each Terminal needs a Generator within 4 tiles (or a Thermal Plant within 3), or the pods crawl. Lost, its lines stand broken until a Terminal is built on its tile again.',
    cost: { cement: 8, alloy: 6, chip: 3 }, store: true, magterm: true, armor: 14, buildTime: 14, yard: ['magpod'],
  },
  magpylon: {
    name: 'Maglev Pylon', short: 'Pylon',
    desc: 'A pylon carrying a Maglev guideway, every 3 tiles along the line; over a road or track its feet stand at the side and the way stays open. As tough as a Wall. Shot down, it cuts the line: pods stop short of the break and go back, and one on the spans it carried is lost; a Worker from the nearer Terminal rides out and rebuilds it. The guideway itself cannot be shot.',
    cost: { cement: 3, alloy: 3, chip: 1 }, pylon: true, armor: 24, buildTime: 20,
  },
  mdriver: {
    name: 'Mass Driver', short: 'Driver',
    desc: 'Storage at the breech of a coil-gun rail on a concrete ramp two tiles long (R turns it as you place it: east-west or north-south; it fires off whichever end faces its Catcher). Aim it at a Catcher 12 to 50 tiles away, across water, cliffs or anything: the two are one line, and canisters of 16 goods fly both ways, a shot every 8 seconds from each end over water, a chasm or cliffs (every 10 seconds when a robot could walk between the ends: a shortcut over land). Supply is automatic: the far end stocks what the buildings round it need, the near end ships it from what your colony holds beyond a reserve of 20 (Haulers bring it), and what the far end can spare comes home. A goods list on its panel overrides that. Or aim it at an Outpost or Keep to keep its Ammo topped up. With no foothold out there, throw a Catcher kit (the Catcher\'s cost, loaded here) to open ground no one else holds: it assembles itself into a Catcher in 20 seconds and claims a little land. Each end fires only with a Generator within 4 tiles, and each shot draws half a Fuel from it (a Thermal Plant within 3 powers it with no Fuel). An enemy Flak Gun can burst a canister in flight: its goods fall as crates.',
    cost: { cement: 12, alloy: 10, chip: 5 }, store: true, mdriver: true, long: true, armor: 16, buildTime: 18,
  },
  catcher: {
    name: 'Catcher', desc: 'Storage under a wide funnel cradle whose four magnetic arms swing in to brake a Mass Driver\'s canister as it lands, and whose coils throw one back the other way. Aim a Mass Driver at it from the Driver\'s panel, 12 to 50 tiles away: out on an island or a mesa, it stocks what the buildings round it need and sends home what they can spare, all by itself. It throws back only with a Generator within 4 tiles (or a Thermal Plant within 3). Buildings touching it are fed by conveyor; one Catcher can take up to two Drivers.',
    cost: { cement: 8, alloy: 5, chip: 3 }, store: true, catcher: true, armor: 12, buildTime: 12,
  },
  // The megastructures (LANCE, DOME; the Megastructures setting: megaOn). Both stand on more than one tile (`foot`: a
  // square of foot x foot tiles from its own tile, east and south: footTiles).
  lance: {
    name: 'Lance of Corvane', short: 'Lance',
    desc: 'A planet-scale laser cannon: a long barrel on a turntable in a 3 by 3 gun pit. Tap Aim on its panel, then any spot on the map: it charges for 90 seconds (your colony\'s lights dim and its factories slow by a third, a glow climbs the barrel and everyone hears it), then fires a beam in a straight line from the gun through that spot right across the map. Everything its 2-tile core touches is destroyed, whoever it belongs to: buildings (a Command Base or Keep only drops to its floor, as with Missiles), robots, Walls; a tile either side is scorched (half armor or health, nothing destroyed); water boils to steam and the ground is scarred by a trench for good. It fires only with power: 2 Generators with Fuel within 4 tiles (they burn Fuel fast while it charges) or a Nuclear Reactor with 2 Uranium (or 1 Enriched Uranium) in it. Wreck its power and the charge is lost. A dust storm holds the shot; a Shield Dome on the line takes it. 4 minutes to reload. One per colony. Not in the Hollow.',
    cost: { cement: 40, alloy: 30, chip: 15, crystal: 10 }, lance: true, mega: true, foot: 3, armor: 70, buildTime: 160, war: true,
  },
  dome: {
    name: 'Shield Dome', short: 'Dome',
    desc: 'A 2 by 2 emitter that raises a faint blue dome 9 tiles round it. It stops what falls on it from outside: Missiles, nuclear missiles (it takes one and drops), bombs and napalm, Ringfall, Howitzer and Mortar shells, rival Mass Driver canisters, falling rock in the Hollow and one Lance shot. Robots walk straight in, and guns fire through it. It has 100 strength: a Missile takes 25, a bomb 10, a shell 3, a nuke or a Lance shot all of it. Left unhit for 10 seconds it recharges 1 a second; at 0 it drops, and comes back after a minute. While up it burns a Crystal every 20 seconds (Haulers bring them) and needs a Generator with Fuel within 4 tiles. Turn it off to save Crystal: turned back on, it takes 30 seconds to come up. One per colony.',
    cost: { cement: 30, alloy: 24, chip: 12, crystal: 20 }, dome: true, mega: true, foot: 2, ammo: 'crystal', ammoCap: 6, armor: 50, buildTime: 120, war: true,
  },
  sunder: {
    name: 'Sundering Ray', short: 'Ray',
    desc: 'A phased array: three great hydraulic rams in a concrete block round a bore tower, and a row of ram plates in the ground before it, 3 by 3 tiles. Its panel aims one of two blows. Strike the Deep (with the Murmur on): aim anywhere; in a 16-tile circle every Murmur tunnel caves in, every tunnel exit is sealed for 2 nights, every nest loses a third of its armor and sends no raid the next night, and a Sapper underground there dies. Quake: aim within 30 tiles of it; a ring shows on the ground for 20 seconds first, seen by everyone, then in a 5-tile circle buildings lose 40% of their full armor but never drop below 10% (a Command Base or Keep half that), their cracked foundations work at half speed until repaired to full, roads and track crack (half speed until a Worker mends them), Walls take double damage until repaired, and robots are stunned for 4 seconds. It winds up for 60 seconds, the rams pumping one after another (everyone hears it), then the ripple runs through the ground to the target. It needs 2 Generators with Fuel within 4 tiles (they burn Fuel fast while it winds up) or a Nuclear Reactor there with 1 Uranium a blow (40 s wind-up). 5 minutes to reload. A Shield Dome does not stop it. The Murmur hear every blow: the next night the nests within 40 tiles come for it first, in bigger packs. One per colony; opens 18 minutes into a game.',
    cost: { cement: 50, alloy: 30, chip: 12, crystal: 8 }, sunder: true, mega: true, foot: 3, armor: 90, buildTime: 240, war: true,
  },
  city: {
    name: 'Arrival City', short: 'City',
    desc: 'A 4 by 4 square built for the colonists: four concrete apartment blocks round a green, a tram waiting at the stop, all finished and all empty, with the Arrival clock on its stele in the middle and WELCOME HOME on the roof. Every factory, gatherer, Oil Pump and Bot Foundry of yours within 8 tiles of its middle works 20% faster, and Workers build 20% faster there. It holds 6 tiles of land round its middle like an Outpost, and in Domination that land counts twice. Its lights burn a Fuel a minute at night (Tankers bring it; it holds 6): out of Fuel it goes dark and its bonus halves. It can never be destroyed: fighting knocks it down to 0, its windows go dark and its bonus stops until Workers repair it. While it\'s down, armed warbots of another colony standing at its walls for 20 seconds, with none of yours there, take it, land, bonus and all. One per colony; it stores nothing. Opens 15 minutes into a game. Not on Argos.',
    cost: { cement: 60, alloy: 30, chip: 15, fiber: 24 }, city: true, mega: true, foot: 4, fuelCap: 6, armor: 80, buildTime: 200,
  },
  lift: {
    name: 'Orbital Lift', short: 'Lift',
    desc: 'A space elevator: a 3 by 3 anchor pad and a lit cable up to your Carrier in orbit. As you place it, press R to turn its fall line (half the map\'s width, shown on the map), which must not cross another colony\'s land. On its panel, Call down a climber with one of four loads: a Security detail (6 Warbots, 2 Bulwarks), a Work crew (6 Workers, 2 Freight Trucks), 30 Alloy or 18 Chips. It takes 45 seconds and every colony hears it coming; then 6 minutes before the next. The Carrier holds 6 drops. Restock the Carrier: tick goods to send up (Haulers bring what you hold beyond the reserve you set); every 30 that go up put a drop back and make the next drop half again bigger (up to double). Each climb burns 2 Fuel from a Generator within 4 tiles. If an enemy destroys it, the cable comes down along its fall line, crushing what lies there and leaving wreckage Haulers cut up for Alloy. One per colony. Not in the Hollow; on Argos it falls slowly.',
    cost: { cement: 60, alloy: 44, chip: 26, crystal: 20 }, lift: true, mega: true, foot: 3, armor: 90, buildTime: 220,
  },
  gup: {
    name: 'Great Uplink',
    desc: 'A 3 by 3 dish array built to talk to home, and a second way to win. Only in a game with the Great Uplink win switched on (game setup, beside Victory) and Megastructures on. Its panel\'s Begin transmission opens 25 minutes into a game and needs 3 Generators with Fuel within 4 tiles, each burning a Fuel every 30 seconds while it transmits. Hold the transmission for 8 minutes and you make contact: your colony (and your team) wins. Any armed warbot of another colony within 3 tiles jams it; jammed or without power its clock stops and runs back at half speed. Destroyed, the transmission is lost and a rebuilt one starts from zero. Every colony sees the countdown and where it is. One per colony. Not in the Hollow.',
    cost: { cement: 50, alloy: 40, chip: 30, crystal: 24 }, gup: true, mega: true, foot: 3, armor: 120, buildTime: 200,
  },
  deepcore: {
    name: 'Deep Core', short: 'Core',
    desc: 'A huge drill into the crust under a red winding tower: it slowly brings up Ore, Crystal and a little Uranium, more the deeper it goes, and never runs dry. It goes deeper by itself while it has power: a Generator with Fuel within 4 tiles (it burns a Fuel a minute) or a Nuclear Reactor there (no Uranium used). Stage 1, at once: 6 Ore a minute. Stage 2, the buried ringfall, after 6 minutes of power: 8 Ore and 3 Crystal. Stage 3, the deep seam, 10 minutes later: 10 Ore, 4 Crystal and a Uranium every 4 minutes. It holds 30 of each; Haulers carry them off. Without power it stops but keeps its depth; below half its armor it goes no deeper and brings up half. Every depth is heard below: it draws the Murmur like a Generator, the night after stage 2 a bigger raid comes for it, and the night after stage 3 the Deep answers: two more Brutes, and a new tunnel exit near it. Destroyed, its depth and stock are lost, and with the Murmur on its open shaft is their way up until a Worker caps it (20 seconds, 4 Cement). On Argos, no Crystal. Opens 20 minutes into a game. One per colony.',
    cost: { cement: 60, alloy: 40, chip: 20, crystal: 10 }, deepcore: true, mega: true, foot: 3, out: { ore: 30, crystal: 30, uranium: 30 }, armor: 100, buildTime: 300,
  },
  atmos: {
    name: 'Atmosphere Engine', short: 'Engine',
    desc: 'A terraforming tower: a great concrete cooling-tower shell with fans round its foot, venting a tall white plume. It slowly changes the weather and the land round it. It needs power: 2 Generators with Fuel within 4 tiles (it takes a Fuel a minute from each) or a Nuclear Reactor there (a Uranium every 6 minutes). Stage 1, Calm, at once: 8 tiles round it, no dust storm for you and your allies. Stage 2, Rain, after 6 minutes of power: 12 tiles, rain at night, barren ground turns fertile (Bio Farms work anywhere in it), the Bloom stops spreading there, enemy robots and vehicles in it wade through mud at half speed, and while it has power enemy Torches can\'t burn anything there. Stage 3, Green, 10 minutes later: 16 tiles of grass, your crops grow a quarter faster, the Bloom withers back a tile a minute. Stage 4, Garden, 12 minutes later: 20 tiles, groves seed themselves, no Bloom and no Murmur exit. From Rain its panel sends a Storm Front anywhere on the map (5 tiles round, not near its own circle nor inside another Engine\'s): under it enemy robots move at 60% speed, their sites go up at 60% and their guns reach three-quarters as far; from Green their crops stop growing and wither after 3 minutes; at the Garden lightning strikes one of their buildings about once a minute. A minute before it can be moved again; no power, no storm. Without power it stops growing; the land it changed stays. The Murmur hate it: they go for it first every night, and after each new stage Sappers dig in under it. Destroyed, its storm ends at once; what is green stays green, but the storms and the Bloom come back in over 10 minutes. Opens 20 minutes into a game. One per colony. Not on Argos or in the Hollow.',
    cost: { cement: 50, alloy: 40, chip: 24, crystal: 30, fiber: 20 }, atmos: true, mega: true, foot: 4, armor: 100, buildTime: 360,
  },
  terminal: {
    name: 'Trade Terminal', desc: 'An off-world freight exchange docked at a neutral Trade Post. It runs one standing trade route that you set on its panel: send one good, bring back another, at the Post\'s market prices, until you change it. About every 2 minutes a convoy (a Road Train, or a Freight Train with track beside it) takes 15 of the good out and brings what they bought home. Raw goods sell low and cost three-quarters of their worth; made goods trade at a little over half; Fuel costs extra. Each run you sell of a good eases its price for a while. Turn on Escort and two warbots from the nearest garrison ride along. Nothing shoots on the Post\'s ground, so convoys are hit out on the road: guard the route. It docks within 2 tiles of the pad, one per post: lay a road out to it. The further the post from your Command Base, the better it pays.',
    cost: { cement: 8, alloy: 3 }, store: true, station: true, terminal: true, armor: 16, buildTime: 20,
  },
  crawlerbase: {
    name: 'Crawler', short: 'Crawler',
    desc: 'A deployed Crawler: storage, a Fuel Station for four bots (burning the Fuel stored in it) and an Outpost claiming the land around it, all in one. Give it supply orders like a Depot (Fuel keeps its chargers going). Pack it up to drive it somewhere else: it takes its goods along, and gives up its land.',
    cost: {}, store: true, mil: true, terr: 6, garrison: 4, ammoStock: 4, charger: { slots: 4, rate: 25, fuel: true }, armor: 24, mobile: true,
  },
  nest: {
    name: 'Murmur Nest', desc: 'The Murmur breed down here. By day they keep to it, with a few on guard; at night they tunnel out toward the colonies\' power and come up through tunnel exits to raid. It grows as time goes on, with more on guard. Send warbots to clear it: the goods it has hoarded spill out for them to carry home, and the land around it is free to build on.',
    cost: {}, wild: true, armor: 45, buildTime: 1,
  },
  // A Murmur tunnel exit (see MURMUR): opens along a nest's tunnels at night; warbots collapse it.
  burrow: {
    name: 'Tunnel Exit', desc: 'A Murmur tunnel exit: heaved earth over a hole into the network the nest has dug. At night packs come up through it to raid every colony near it (bots, buildings full of charge, roads), and at dawn they go back down. Send warbots to collapse it: it stays shut for a while (15 minutes). Wreck the nest it belongs to and its whole network dies back.',
    cost: {}, wild: true, burrow: true, armor: 30, buildTime: 1,
  },
  // The Hollow: the Deep's mound at the middle of the cathedral (HOLLOW.deep), the biggest nest of all.
  mound: {
    name: 'The Deep\'s Mound', desc: 'The largest Murmur nest of all, in the middle of the Hollow: somewhere inside it is the Deep, the heart of every nest down here. Heavily armored and full grown from the start, with the most on guard; its tunnels spread like any nest\'s. As it cracks, it sends out more defenders in faster waves. A brighter pulse and deeper rumble warn of the stronger waves. Wreck it with warbots and its hoard spills out, and every other nest in the Hollow falls back to its first level.',
    cost: {}, wild: true, armor: 160, buildTime: 1,
  },
  // Horde mode (HORDE): the Maw at the far end of Long haul, the waves' nest, with its tunnel mouths round it.
  maw: {
    name: 'The Maw', desc: 'A great Murmur mound at the far end of the planet, ringed by huge tunnel mouths: every wave in Horde comes up out of it and marches down the map at you. Heavily armored and well guarded, and as it cracks it spits out more defenders. Wreck it with an army (or a megastructure) and the waves end: you win.',
    cost: {}, wild: true, armor: 600, buildTime: 1,
  },
  depot: {
    name: 'Depot', desc: 'Extra storage. Haulers drop goods at the nearest storage they can reach by road, so depots along your highways shorten trips. Give it supply orders to stock it from home: a forward base for building at the front. Far from your Command Base, with a Road Train that can drive to it, it stocks itself with what the buildings round it need, and the Road Train keeps it supplied.',
    cost: { fiber: 3, cement: 2 }, store: true, armor: 10, buildTime: 8,
  },
};

/** Order of the build menu. (Viaducts and Ropeways aren't in it: they're placed from Paths, like Ramps and Walls.) */
const BUILD_MENU = ['harvester', 'quarry', 'mine', 'tap', 'smelter', 'fab', 'foundry', 'charger', 'farm', 'pump', 'fueltank', 'refinery', 'generator',
  'kiln', 'tarworks', 'roadworks', 'station', 'magterm', 'mdriver', 'catcher', 'port', 'airfield', 'mast', 'outpost', 'turret', 'minigun', 'bunker', 'keep', 'disruptor', 'mortar', 'flak', 'repair', 'armory', 'munitions', 'silo', 'reactor', 'nukesilo', 'lance', 'sunder', 'dome', 'city', 'lift', 'atmos', 'deepcore', 'gup', 'depot', 'grower', 'lab', 'terminal',
  'composter', 'nursery', 'wpump', 'seamdrill', 'seedmast', 'thermal']; // (the last six on the Terraform tab, with its tools: js/terraform2.js, js/terraform3.js)
/** Build-menu tabs: what each building is for. */
const BUILD_GROUPS = [
  { key: 'gather', name: 'Gather', types: ['harvester', 'quarry', 'mine', 'tap', 'grower', 'farm', 'pump', 'fueltank'] },
  { key: 'make', name: 'Make', types: ['kiln', 'smelter', 'fab', 'refinery', 'tarworks', 'foundry', 'armory', 'munitions', 'reactor', 'lab', 'generator'] },
  { key: 'move', name: 'Move', types: ['charger', 'depot', 'roadworks', 'station', 'magterm', 'mdriver', 'catcher', 'port', 'airfield', 'mast', 'terminal'], roads: true },
  { key: 'defend', name: 'Defend', types: ['outpost', 'turret', 'minigun', 'bunker', 'keep', 'disruptor', 'mortar', 'flak', 'repair', 'silo', 'nukesilo'], walls: true },
  // The megastructures (megaOn): their own tab, key 5 (then Terraform, 6: js/terraform.js).
  { key: 'mega', name: 'Mega', types: ['lance', 'sunder', 'dome', 'city', 'lift', 'atmos', 'deepcore', 'gup'] },
];
const BUNKER_FIRE = 0.9; // seconds between shots for each warbot in a Bunker (or a Keep)
/**
 * A warbot against a building: what a shot knocks off it (`wall` off a Wall or Gate: they're built to hold; half on a
 * critical battery), from up to `reach` tiles away (a building is a big target: it needn't come right up to it, so a
 * group can all fire at once instead of crowding round it under the guns).
 */
const WARBOT_HIT = { building: 2, wall: 1, reach: 2.4 };
/** A robot hit by a Minigun Nest is pinned for `time` s: it moves at `speed` and its guns reload `reload` times slower. */
const MINIGUN_PIN = { time: 1.2, speed: 0.5, reload: 1.35 };
/**
 * The Keep (BDEFS.keep): its warbots fire from cover out to `fire` tiles. Within `aura` tiles of a built Keep, its
 * owner's Walls and Gates take damage ÷ `wallMul` and, left alone for `quiet` s, mend `mend` armor a second; its
 * Pulse Turrets, Bunkers, Mortar Pits, Flak Guns and Disruptor Towers reach `range` tiles further and reload in
 * `rate` of the time. Keeps stand `spacing` tiles apart.
 */
/**
 * The Howitzer (BOTS.rocket: mobile artillery; the key is the old Rocket Truck's). In reach of a building (`min` to
 * `range` tiles) it digs in (`deploy` s: spades down, barrel up) and then fires one heavy shell at a time (`salvo`),
 * the crew reloading `cycle` s between shots, over and over until the target is down or the magazine (`mag`
 * shells) is empty; dug in, its gun traverses `turn` rad/s. Before it can drive anywhere it packs up (`pack` s).
 * Each shell lands within `scatter` of the middle of the target's tile, knocking `damage` off it (`fortMul` times as
 * much off a defence: DEFENCE_TYPES, Outposts; forts no lower than MISSILE_FLOOR), `splashBld` off other buildings and
 * `botDamage` off robots within `splash`. Shells fly at `speed` tiles a second on an arc `arc` tiles high. A full
 * magazine is `ammo` Ammo (`perAmmo` shells each), loaded in `reload` s at a garrison or storage; or, dug in on its
 * own ground with a road within `supplyReach` tiles, a hauler brings it Ammo (see rocketCallSupply).
 */
const ROCKET = { range: 13, min: 4, deploy: 7, pack: 4, salvo: 1, gap: 0.9, cycle: 5, mag: 12, turn: 0.7, damage: 4, fortMul: 2,
  splash: 0.9, splashBld: 2, botDamage: 2, scatter: 0.55, speed: 6, arc: 3.2, ammo: 3, perAmmo: 4, reload: 10, supplyReach: 2.5, repairReach: 30 };
/**
 * Yards: a Port's shipyard builds ships, a Rail Station's rail yard Freight Trains (BDEFS[type].yard lists
 * what each makes), a round of parts (1 Alloy, 1 Chip) every `work` s, BOTS[kind].parts rounds a vessel; it
 * keeps `hopper` of each part on hand while it has orders. The Bot Foundry doesn't build them.
 */
const YARD = { work: 8, hopper: 2 };
const KEEP = { fire: 4, aura: 7, wallMul: 1.5, mend: 0.33, quiet: 8, range: 1, rate: 0.8, spacing: 16 };
/**
 * The Bulwark (BOTS.bulwark): a purple shield across its front, `r` tiles out, spanning `arc` radians either side of
 * where it faces. A shot from in front, at the Bulwark or at one of the `coverMax` robots of its owner's nearest it
 * within `cover` tiles behind the shield line (shieldCovers), hits the shield instead (a Torch's flame half gets round
 * it: TORCH.shieldPass): it soaks up to `shield` damage, comes back `regen` a second once
 * it's had `wait` s without a hit, and worn right down it fails for `down` s, coming back at `reboot` of full.
 * Blasts from above (shells, bombs, missiles, fuel blasts) and fire from the side or behind get past it; a
 * Disruptor Tower's pulse drains `drain` off it. It turns (`turn` rad/s) to face the nearest threat. Its twin
 * blasters: `dmg` a shot every `reload` s.
 */
const BULWARK = { shield: 40, regen: 4, wait: 2.5, down: 8, reboot: 0.35, arc: 1.0, r: 0.5, cover: 2.1, coverMax: 6, turn: 1.8, dmg: 1, reload: 0.9, drain: 14, look: 6 };
/**
 * The Torch (BOTS.torch): every `tick` s while it has a target in reach (BOTS.torch.range) it sprays a cone `cone`
 * radians either side of its aim: `bot` damage to each enemy robot in it (a Bulwark's shield in the way stops only
 * 1 − `shieldPass` of it, and that burns the shield `shieldMul` times as fast) and `bld` to the building it's burning
 * (`fort` times that to defences and Walls/Gates). Its tank holds `tank` seconds of fire; a Fuel refills `perFuel`
 * seconds, from its owner's Command Base, a Depot or a Fuel Station.
 * Scorch the earth (its panel): a Torch whose tank is at least `scorchMin` full (nearly full: 90%, 10.8 of its 12 s)
 * walks to a patch of fertile soil, stands within `scorchReach` tiles of it and sprays its whole tank into it over
 * `scorch` s, scorching it for good (scorchSoil, as napalm does); then it goes to refill. A group given the order
 * takes a patch each, the tapped one and the nearest round it within `scorchSpread` tiles.
 */
const TORCH = { cone: 0.5, tick: 0.2, bot: 0.35, bld: 0.8, fort: 1.6, shieldPass: 0.5, shieldMul: 2, tank: 12, perFuel: 12, scorch: 3, scorchMin: 0.9, scorchReach: 1.3, scorchSpread: 3 };
/**
 * The Skirmisher (BOTS.skirmisher): `dmg` a shot every `reload` s (Ammo, as a warbot), `bonus` times that against the
 * kinds it hunts (twice against a Bulwark, half again against a Railgunner, an Arc Caster or a Howitzer) and `soft`
 * times against robots that aren't army (Workers, haulers). A foe behind an enemy
 * Bulwark's shield it runs round: to a spot `spot` of its reach off the foe, `round` radians past the edge of the
 * shield's arc, the side it's nearer. It hunts the `hunt` kinds within `huntR` tiles before anything else. Off its
 * cooldown (`dashEvery` s) it dashes at `dashMul` its speed for `dash` s, when it starts a run round a shield or
 * closes on a foe more than `dashFar` tiles off.
 */
const SKIRM = { dmg: 2, reload: 0.75, bonus: { bulwark: 2, railgunner: 1.5, arccaster: 1.5, rocket: 1.5 }, soft: 1.5, spot: 0.8, round: 0.6, huntR: 4.5, hunt: ['bulwark', 'railgunner', 'arccaster', 'rocket', 'worker'],
  dash: 0.9, dashMul: 2.2, dashEvery: 6, dashFar: 2.5 };
/**
 * The Arc Caster (BOTS.arccaster): every `reload` s a bolt: `dmg` to the robot it aims at, then it jumps to the nearest
 * enemy robot within `jump` tiles of the last one hit (not one already hit), up to `jumps` times, `fall` times weaker
 * each jump. A Bulwark's shield in the way takes `shieldMul` times the bolt (what's left of the bolt once it fails gets
 * through). `bld` to a building (`fort` times that to defences and Walls). Its capacitors hold `cells` bolts; a Crystal
 * refills `perCrystal`, from its owner's Command Base or a Depot (refillPoint).
 */
const ARC = { reload: 1.7, dmg: 2.6, jump: 1.7, jumps: 3, fall: 0.75, shieldMul: 3, bld: 1.5, fort: 1.2, cells: 10, perCrystal: 5 };
/**
 * The Railgunner (BOTS.railgunner): in reach (BOTS.railgunner.range) it charges `charge` s, then fires a slug at
 * where its target was when it began (a quick robot can be out of the line by then: a Skirmisher, dashing) straight
 * through: `dmg` to the first enemy robot within `width` of the line and `fall` times less to each one after it (up to
 * `pierce` of them), out to its reach. A Bulwark's shield in the way takes the slug's damage (up to what it has left)
 * and lets `through` of it on; a Bulwark itself takes `armor` times as much. `reload` s between shots. Closer than `min`
 * tiles it can't bring the rail to bear and fires its sidearm (`side` every `sideReload` s). On a building: `bld`
 * (`fort` times that to a defence or Wall) from `bldReach` tiles. Ammo: BOTS.railgunner.mag slugs, ammoShots an Ammo.
 */
const RAIL = { charge: 0.8, dmg: 10, width: 0.4, fall: 0.6, pierce: 4, through: 0.8, armor: 1.7, reload: 5, min: 1.6, side: 1, sideReload: 1.1,
  bld: 4, fort: 1.5, bldReach: 5.5 };
/** Shots a gun robot of kind k holds (a Railgunner's slugs: BOTS[k].mag; else a warbot's WARBOT_AMMO), and shots an Ammo gives it. */
function botMag(k) { return (BOTS[k] && BOTS[k].mag) || WARBOT_AMMO; }
function botAmmoShots(k) { return (BOTS[k] && BOTS[k].ammoShots) || AMMO_SHOTS; }
/**
 * The tank of a robot of kind k, kept in u.gel: a Torch's seconds of fire (Fuel), an Arc Caster's bolts (Crystal).
 * { good, cap, per (filled by one of the good), min (what it takes to fire) }, or null for one that has none.
 */
function botTank(k) {
  const bt = BOTS[k];
  return !bt ? null : bt.flame ? { good: 'fuel', cap: TORCH.tank, per: TORCH.perFuel, min: 0.05 } : bt.arc ? { good: 'crystal', cap: ARC.cells, per: ARC.perCrystal, min: 0.99 } : null;
}
/** Ramps are planned in Paths (with roads), not from the build menu. */

const INPUT_CAP = 3;   // how many of each input a production building stockpiles (its def.hopper instead, if it has one)
const AMMO_CAP = 3;    // crystals a turret stockpiles
const TURRET_TURN = 2.4;   // radians per second a turret's head turns (about 140°)
// Aiming a defence (ORDERS.focus): a player locks a Pulse Turret, Minigun Nest, Mortar Pit, Flak Gun, Bunker or Keep onto
// one enemy in its reach. If the enemy slips out of reach, the defence picks its own targets again, and takes the lock
// back up if the enemy comes back within FOCUS_GRACE seconds; after that (or once the enemy is dead) the lock is gone.
const FOCUS_GRACE = 4;
const TURRET_SWEEP = 0.35; // radians per second it sweeps while watching for targets
const SHOTS_PER_AMMO = 4;

/*
 * The rival's level, easiest first (players see `label`, the Frontier names). The keys stay the old words (easy,
 * medium, normal, hard: saves, settings, missions and multiplayer setups use them); warlord, the fifth, is harder
 * than Hard. diffAtLeast(k) asks whether this game's level is k or harder (Warlord counts as Hard everywhere).
 */
const DIFFICULTY = {
  easy:    { label: 'Settler',   mult: 0.7,  grace: 330, threshold: 7, maxSites: 1, think: 3.0, bonus: 0 },
  medium:  { label: 'Pioneer',   mult: 0.85, grace: 275, threshold: 6, maxSites: 2, think: 2.5, bonus: 0 },
  normal:  { label: 'Colonist',  mult: 1.0,  grace: 220, threshold: 5, maxSites: 2, think: 2.0, bonus: 0 },
  hard:    { label: 'Commander', mult: 1.3,  grace: 150, threshold: 4, maxSites: 3, think: 1.5, bonus: 6 },
  warlord: { label: 'Warlord',   mult: 1.6,  grace: 100, threshold: 3, maxSites: 4, think: 1.0, bonus: 12 },
};
const DIFF_ORDER = Object.keys(DIFFICULTY);
function diffAtLeast(k, d = S.difficulty) { return DIFF_ORDER.indexOf(d) >= DIFF_ORDER.indexOf(k); }

/*
 * Rival doctrines (the code calls them personalities: `style` on a player, `PERSONALITIES` here). Every rival
 * Command AI has spent decades reading the same last order from home ("Hold position. Further instructions to
 * follow.") and settled into a doctrine (LORE.md, Rival command doctrines). The keys stay the old style words
 * (saves, missions, multiplayer settings and tests use them); players see `name`, the doctrine, with `plain`, the old
 * style word, beside it where it helps ("Warden (turtle)": docLabel).
 * Each scales the rival's difficulty settings: grace (when it starts attacking), threshold (warbots it gathers before
 * an attack), army (how fast its army grows; armyFrom, when it starts), raids (how often it raids; raidFirst, the
 * first raid; raidSize and raidKeep, how many go and stay home), econ (how fast its bots work). turrets, walls,
 * push (a big all-in push when its army outgrows its rival's: aiPush), harass (raids that form up out of sight and go for the roads by its
 * rival's working buildings, attacks on unguarded economy: aiRaid) and missiles switch on its habits (see js/ai.js:
 * aiStyle, aiLevel, AI_FORT, aiMissilePlan). The Steward (balanced) plays the plain difficulty with a little more of
 * everything: its bots 10% faster, its army from a minute sooner and 15% faster (Nov 26 2026: it won 4 of 16 without).
 * The words: noun and desc (the landing line: "Your rival is a Warden (turtle): it walls its base in..."), tag (a few
 * words, for the lobby's one-line note: "walls in, then pushes in force"), quote (a
 * line in the doctrine's voice, from LORE.md), play (how it plays, in depth, for the new-game screen: what it builds
 * first, when and how it attacks, how it defends; times are for Normal, and are what games show, not the earliest
 * the code allows: a rival only attacks what it outnumbers, see aiThink) and weak (its weak spot, and how to beat it).
 * docInfo puts them together.
 */
const PERSONALITIES = {
  balanced: {
    name: 'Steward', plain: 'balanced', noun: 'a Steward', desc: 'builds up, defends and attacks in good measure',
    tag: 'builds, defends and attacks in good measure',
    quote: 'This action has been logged for review by the Accord tribunal.',
    play: 'Grows a full economy and a steady army (its bots work 10% faster, and its army starts growing a minute sooner and grows a little faster), and attacks once it has the warbots to beat what guards its target: often 6 to 15 minutes in (at Colonist level). Now and then a band of three raids your roads. It defends with up to three Pulse Turrets, a Minigun Nest or Bunker at the front, a Keep later on and, half the time, a Wall on the side facing you. Later come bombers and Missiles.',
    weak: 'No great strength and no great weakness: a fair first opponent.',
    // What it says to you (doctrineVoice): when it attacks, launches a Missile and surrenders. {day}: see wardenDay.
    voice: {
      attack: ['Arrival window remains open. Please clear the survey corridor.', 'This action has been logged for review by the Accord tribunal.',
        'Survey corridors are to be kept clear under the Accord. Clearing.', 'We regret the necessity. Please stand aside.'],
      missile: ['Ordnance released under protest. This has been logged.', 'The Accord permits the removal of obstructions. Removing.',
        'Please take shelter. The tribunal has been notified.'],
      surrender: ['Please tell the colonists the roads are finished.', 'We yield, under protest. The tribunal will hear of this.'],
    },
    // (The owner, Nov 26 2026: the default rival should be a fair fight. As the plain difficulty it won 4 of 16
    // doctrine games; its economy lasted, but its army never caught up. See docs/economy-balance-audit.md.)
    army: 1.15, armyFrom: 0.8, econ: 1.1,
  },
  turtle: {
    name: 'Warden', plain: 'turtle', noun: 'a Warden', desc: 'walls its base in, builds Keeps and turrets, then grinds forward in big pushes',
    tag: 'walls in, then pushes in force',
    quote: 'Position held. Day 12,054.',
    play: 'Digs in as it grows: a Pulse Turret every six minutes, up to four, and once it holds three Outposts it walls in its Command Base, the side facing you first (Gates on its roads, 12 pieces at most; with the Murmur Active, not before 20 minutes, and its army grows faster there); with three turrets as well it starts the first of up to three Keeps. It fields Railgunners behind its walls, rarely raids and never builds bombers. It marches on your forts like a Steward once it has the warbots, and when its army outgrows yours it makes a big push with nearly everything it has: from about 16 minutes in (on Normal) two more warbots than you are enough.',
    weak: 'Its Walls and Keeps cost it warbots early on. Out-grow it while it digs in and keep your army bigger than its own, or it pushes; then burn through its Walls with Torches, shield your warbots with Bulwarks, or crack the shell with Missiles. Skirmishers get round to its Railgunners.',
    voice: {
      attack: ['Position held. Day {day}.', 'No one passes until relieved.', 'Perimeter extended. Day {day}.', 'Sentry line advancing. Hold.'],
      missile: ['Threat at the perimeter. Removing it.', 'Range confirmed. Firing. Day {day}.', 'Clearing the approach.'],
      surrender: ['Relief has not arrived.', 'Post abandoned. Day {day}. Relief has not arrived.'],
    },
    grace: 1.0, threshold: 1.0, army: 1.0, raids: 0.3, walls: true, push: true,
  },
  raider: {
    name: 'Salvager', plain: 'raider', noun: 'a Salvager', desc: 'sends small bands of warbots to cut your supply lines, again and again',
    tag: 'raids your roads, again and again',
    quote: 'Nothing\'s coming from home. Everything on the road is supply.',
    play: 'Hits convoys, not cities. Its army grows early and fast, and from about 5 minutes in (at Colonist level) it sends three warbots at your busiest unguarded road every minute or two, keeping none back: they shoot up Haulers and trucks, tear up the road and wreck what stands beside it. It attacks in force too, once it outnumbers what guards a target, with only two turrets and seldom a Wall at home. Its army runs on fast Skirmishers.',
    weak: 'A thin home guard. Guard your roads with Outposts, turrets and warbots on rally flags (massed warbots beat Skirmishers); while its bands are out, its base is open.',
    voice: {
      attack: ['Nice convoy. Shame about the escort.', 'Nothing\'s coming from home. Everything on the road is supply.',
        'Don\'t mind us. Just taking inventory.', 'Your roads, our supply lines.'],
      missile: ['Inventory reassigned. Ledger updated.', 'Write-off approved. Stand clear.', 'Salvage rights claimed. Collecting.'],
      surrender: ['Fine. Keep it. It was yours anyway.', 'Take it. Nobody\'s coming to collect.'],
    },
    raids: 3, raidFirst: 0.4, raidSize: 3, raidKeep: 0, army: 1.15, armyFrom: 0.7, harass: true,
  },
  rusher: {
    name: 'Herald', plain: 'rusher', noun: 'a Herald', desc: 'comes for you early with warbots, before its economy is big',
    tag: 'all warbots, and it keeps coming',
    quote: 'Arrival in one day. Clearing the landing zone.',
    play: 'Puts everything into warbots: its army grows from the first minutes, faster than any other doctrine\'s. It goes for whatever it can outnumber, a lightly guarded building or a construction site, and keeps coming back; a well-manned garrison makes it wait. It raids now and then, and builds only two turrets and seldom a Wall.',
    weak: 'Its economy lags. Get a garrison and a turret up early; hold off the first waves and it runs short.',
    voice: {
      attack: ['Arrival in one day. Clearing the landing zone.', 'Colonists inbound. Hostiles in the corridor. Engaging.',
        'Landing zone not clear. Clearing.', 'Ark on final approach. The corridor must be open.'],
      missile: ['Landing zone obstructed. Strike authorised.', 'Arrival in one day. No time. Firing.', 'Final approach. Clearing by order.'],
      surrender: ['Arrival in one day. Arrival in one d\u2014', 'Landing zone lost. Arrival in one day. Arrival in\u2014'],
    },
    grace: 0.6, threshold: 0.8, army: 1.35, armyFrom: 0.4, raids: 0.6,
  },
  tycoon: {
    name: 'Architect', plain: 'tycoon', noun: 'an Architect', desc: 'builds a big economy first, then rains Missiles on you (or a nuke, in a Nuclear race)',
    tag: 'a big economy, then Missiles',
    quote: 'When the colonists come, they\'ll find a city. Mine.',
    play: 'Out-builds everyone: its bots work 15% faster, it adds Smelters and Chip Fabs, and later it docks a Trade Terminal at a Trade Post, and it turns that economy into a steady army. Once its economy is running (two Outposts, its Bot Foundry, a few warbots and workers to spare: usually 8 to 14 minutes in, on Normal) it builds a Missile Factory, then up to three Silos, and holds its Arrival City back until the first Silo stands. Up to four turrets guard its base, and its army mixes Skirmishers, Arc Casters and Railgunners.',
    weak: 'Its army is no bigger than its economy can feed, and its Silos cost it Alloy. Hit it before its Silos are ready (or capture them), and spread your buildings out so one strike can\'t take many.',
    voice: {
      attack: ['I\'ve paved more road this year than your Sponsor did in a century.', 'When the colonists come, they\'ll find a city. Mine.',
        'Your layout is inefficient. Allow me.', 'Zoning review complete. You are not in the plan.'],
      missile: ['Beginning urban renewal.', 'Clearing the lot. Something better is coming.', 'Permit issued. Applicant: me.'],
      surrender: ['Very well. Mind the paving. It\'s mine.', 'Keep the city. You\'ll never finish it.'],
    },
    grace: 1.0, army: 1.3, armyFrom: 0.7, missiles: true, econ: 1.15,
  },
};
const PERSONALITY_ORDER = ['balanced', 'turtle', 'raider', 'rusher', 'tycoon'];
/** Random (on the new-game screen and in the lobby): what it means, and in a few words. */
const DOCTRINE_RANDOM_TAG = 'a doctrine no other computer player has';
const DOCTRINE_RANDOM = 'Each rival on Random gets a doctrine no other rival has, picked from the planet\'s seed (the same planet deals the same ones). The briefing names it when you land, and so does its Command Base\'s panel.';
/** Is k one of the doctrines (a key of PERSONALITIES, not something every object has, such as 'constructor')? */
function isDoctrine(k) { return typeof k === 'string' && Object.prototype.hasOwnProperty.call(PERSONALITIES, k); }
/** A doctrine as players see it: "Warden (turtle)". (Unknown keys: the Steward.) */
function docLabel(k) { const P = PERSONALITIES[isDoctrine(k) ? k : 'balanced']; return `${P.name} (${P.plain})`; }
/** How a doctrine plays, in depth (the new-game screen's description of it); 'random': what Random does. */
function docInfo(k) {
  if (k === 'random') return 'Random: ' + DOCTRINE_RANDOM;
  const P = PERSONALITIES[isDoctrine(k) ? k : 'balanced'];
  return `${docLabel(k)}: “${P.quote}” ${P.play} Weak spot: ${P.weak}`;
}

/*
 * Planetary events (a menu option, on by default; never in missions): every five to eight minutes the
 * planet throws something at every colony alike, with a warning EVENT_WARN seconds ahead.
 *   dust    Dust storm: bots move at DUST_SPEED and no Missile can be fired until it blows over.
 *   meteor  Ringfall (a meteor shower: pieces of the Ring, LORE.md): METEOR_HITS strikes on each colony's share of the planet (the same spots
 *           mirrored or turned for every colony), each cratering the roads it lands on, denting
 *           buildings and bots near it, and leaving a rich deposit of Ore or Crystal (sometimes
 *           Uranium, in a Nuclear race). Cratered roads are planned again straight away.
 *   flare   Solar flare: bot batteries drain FLARE_DRAIN times as fast.
 *   trader  The Wren (the trader ship, LORE.md): for 75 seconds it waits in orbit and offers each colony a swap at a good rate:
 *           a raw good it has plenty of for the finished good it's shortest of, or now and then (WREN_RAW_CHANCE) a good
 *           it has plenty of for the raw good (Ore, Crystal, Stone or Crude) its land is closest to running out of.
 */
const EVENTS = {
  dust:   { name: 'Dust storm',    color: '#d9a86a', dur: [60, 90], warn: true,  desc: 'Bots move at two-thirds speed and Missiles are grounded until it blows over.' },
  meteor: { name: 'Ringfall',      color: '#ff8a3d', dur: [30, 30], warn: true,  desc: 'Pieces of the Ring crater roads and dent what they hit, but leave rich Ore and Crystal behind.' },
  flare:  { name: 'Solar flare',   color: '#ffe36b', dur: [45, 60], warn: true,  desc: 'Bot batteries drain twice as fast: keep your Fuel Stations fuelled.' },
  trader: { name: 'The Wren',      html: 'The <i>Wren</i>', color: '#7fe3ff', dur: [75, 75], warn: false, desc: 'The Accord supply ship takes spare raw goods (Stone, Fiber, Ore, Crystal or Crude) for the finished goods you\'re shortest of: Cement, Alloy, Chips, Fuel or Ammo. Now and then it brings the raw good your land is running out of instead (Ore, Crystal, Stone or Crude), for a good you have plenty of.' },
};
const EVENT_ORDER = ['dust', 'meteor', 'flare', 'trader'];
const EVENT_FIRST = 480, EVENT_GAP = [300, 480], EVENT_WARN = 20;
/** Seconds between planet events in a mission that has them: it asks the player to ride a few out, so they come sooner. */
const MISSION_EVENT_GAP = [120, 180];
const DUST_SPEED = 0.65, FLARE_DRAIN = 2;
const DUST_ENDLESS = 1e9; // the end (s) of an Endless dust storm's storm (a challenge modifier, MODS.dust): never
const METEOR_HITS = 6, METEOR_DAMAGE = 4, METEOR_BOT_DAMAGE = 1.5, METEOR_RICH = 2;
/**
 * The Ring drizzle (LORE.md: Ringfall keeps restocking the surface): in every game, Planetary events or not (and in a
 * mission only if it asks for it: `drizzle`; never in the Hollow, underground), a lone piece of the Ring comes down every DRIZZLE_GAP seconds (the first
 * DRIZZLE_FIRST in, once the opening is over) on each colony's share of the planet, the same spot mirrored or turned
 * for every colony as Ringfall's (fairShare), DRIZZLE_NEAR tiles from player 0's Command Base. It does no harm: it lands only on open ground no one
 * holds (no road, building, plan, Trade Post ground, water or rock), so a colony expands to claim it. Each leaves one
 * small deposit of DRIZZLE_TILES tiles of Ore or Crystal (half and half), each DRIZZLE_RICH times a Ringfall deposit's
 * amount; in a Nuclear race now and then (DRIZZLE_URANIUM) a single tile of Uranium instead. None falls while
 * DRIZZLE_CAP of its deposits lie unclaimed. DRIZZLE_FALL: seconds from the streak in the sky to the impact. (Tuned so
 * computer-vs-computer games end as often as without it: every 120-200 s from minute 3, a cap of 8 and half a Ringfall
 * deposit left more of them undecided at an hour.)
 */
const DRIZZLE_FIRST = [710, 740], DRIZZLE_GAP = [160, 240], DRIZZLE_NEAR = [10, 30], DRIZZLE_TILES = 2, DRIZZLE_RICH = 0.4;
const DRIZZLE_CAP = 6, DRIZZLE_URANIUM = 0.1, DRIZZLE_FALL = 1.4, DRIZZLE_TRIES = 60;
/**
 * The trader (the Wren) as a rule takes raw goods only (WREN_TAKES: the one a colony has well over TRADE_KEEP of) and
 * brings finished goods only (WREN_BRINGS: the one it has least of against TRADE_KEEP; Ammo only with a war on). On
 * about one visit in four (WREN_RAW_CHANCE, decided for each colony from the visit's seed) it makes the older offer
 * instead: the raw good the colony's land is closest to running out of (TRADE_GET; TRADE_LEFT: stock plus what's in the
 * ground on its land) for a good it has well over TRADE_KEEP of (TRADE_GIVE: never Chips, Ammo or Missiles). The rival's
 * trading reads TRADE_GET, TRADE_LEFT and TRADE_GIVE too. It pays TRADE_BONUS times the worth (TRADE_VALUE) of what it
 * takes.
 */
const TRADE_GET = { ore: R_ORE, crystal: R_CRYSTAL, stone: R_BOULDER, crude: R_OIL };
const TRADE_LEFT = { ore: 80, crystal: 50, stone: 80, crude: 60, alloy: 40, ammo: 30, chip: 12 };
const TRADE_GIVE = ['fiber', 'fuel', 'cement', 'alloy', 'stone', 'ore', 'crystal', 'crude'];
const TRADE_VALUE = { fiber: 1, stone: 1, ore: 1.2, crystal: 1.5, crude: 1.2, cement: 0.5, fuel: 1.5, alloy: 2.2, ammo: 1.2, chip: 4 }; // Alloy = an Ore and a Fiber, Cement = half a Stone, Ammo = a third of an Alloy and a Cement and the work, a Chip = a Crystal and an Alloy
const TRADE_KEEP = { fiber: 12, stone: 12, ore: 12, crystal: 10, crude: 10, cement: 20, fuel: 12, alloy: 10, ammo: 10, chip: 4 };
const TRADE_BONUS = 1.3;
const WREN_TAKES = ['stone', 'fiber', 'ore', 'crystal', 'crude'], WREN_BRINGS = ['cement', 'alloy', 'chip', 'fuel', 'ammo'];
const WREN_RAW_CHANCE = 0.25;
/**
 * The Trade Terminal (BDEFS.terminal) runs one standing trade route, "send this good, bring back that one", set on its
 * panel and kept until it's changed. The Trade Post's ledger takes one delivery from each Terminal every `every`
 * seconds (its window). A convoy (a Road Train, or a Freight Train where track runs beside the Terminal) brings a run
 * of `lot` of the good sent (fewer of a rich good, so what comes back stays within `carryBack`), waits at the dock if
 * it's early, and takes home what the run bought (a liquid bought, Fuel or Crude, goes by Tanker or by pipeline). The
 * Terminal asks for its run a trip ahead of the window: `lead` seconds at first, then the last trip's time and a bit.
 * The market board: each good sells for its worth (TRADE_VALUE) times `sell` and costs its worth times `buy`, raw goods
 * (TRADE_RAW) at one rate and made goods at another, Fuel `fuelMarkup` dearer still. So raw goods sell low and buy at
 * three-quarters of their worth, and made goods for made goods go at a little over half. No route sends a raw good for
 * another raw good, a made good for one of its own ingredients (TRADE_MADE_FROM: no Cement for Stone), or Cement for
 * anything but a made good (TRADE_MADE); Crude and Fuel are only ever bought (no convoy carries a liquid). A Terminal
 * more than `minDist` tiles from the Command Base pays `perTile` more for every tile further, up to `maxBonus`.
 * Every run sold of a good knocks `sat` off what that good fetches (down to `satMin`), and each second it gets back
 * `recover` of the way to full (about half in four minutes): one route on a good settles a little under full price,
 * two drive it down to the floor. With Escort on, `escort` warbots from the nearest garrison within `escortReach`
 * tiles ride along with each convoy and go back once it's home. Warbots holding a rally flag go after an enemy trade
 * convoy that passes within `hunt` tiles of the flag. 15 Stone buys about 2.4 Alloy a run, 15 Alloy about
 * 16 Crystal, 15 Cement about 2 Alloy (more from a Terminal far out).
 */
const TERMINAL = { lot: 15, every: 120, lead: 60, carryBack: 30, minDist: 16, perTile: 0.015, maxBonus: 0.25,
  sell: { raw: 0.35, made: 0.575 }, buy: { raw: 0.75, made: 1 }, fuelMarkup: 1.5, sat: 0.1, satMin: 0.5, recover: 0.003,
  escort: 2, escortReach: 24, hunt: 6 };
/** Raw goods (dug, cut, tapped or pumped) on the market board; the rest of TRADE_BOARD is made in factories. */
const TRADE_RAW = ['stone', 'fiber', 'ore', 'crystal', 'crude'];
/** The market board, in the order it's shown: every good a route can send or bring back. */
const TRADE_BOARD = ['stone', 'fiber', 'ore', 'crystal', 'crude', 'cement', 'alloy', 'chip', 'ammo', 'fuel'];
/** What each made good is made from: a route never sells one for its own ingredients. */
const TRADE_MADE_FROM = { cement: ['stone'], alloy: ['ore', 'fiber'], chip: ['crystal', 'alloy'], ammo: ['alloy', 'cement'], fuel: ['crude'] };
/** The made goods Cement can buy. */
const TRADE_MADE = ['alloy', 'chip', 'ammo', 'fuel'];
/*
 * Neutral Trade Posts (S.posts): off-world exchanges standing on no-one's ground from the start, placed
 * fairly between the colonies (one more than there are colonies; `colony` of them in Colony mode, about
 * `colonyDist` tiles out), at least `minFromBase` tiles from every Command Base and `apart` from each other,
 * and never more than `fair` tiles nearer one colony than another (the nearest two, after the first).
 * A colony trades by docking its Trade Terminal within `dock` tiles of one (one Terminal per post): no
 * Terminal anywhere else, never on a rival's ground, and a rival's land round a post keeps you out. The post's
 * ground, `calm` tiles round its pad, is a no-fire zone: nothing shoots at anything on it, nor from it (see calmAt),
 * so the fights over trade happen out on the routes, never at the dock.
 */
const TRADE_POST = { colony: 2, colonyDist: 24, minFromBase: 16, apart: 12, dock: 2, fair: 3, calm: 3 };
/** The goods tradeShortest weighs for the rival AI (what its land runs out of, and what it's made into). */
const TRADE_SHORT = ['ore', 'crystal', 'stone', 'fiber', 'alloy', 'chip', 'ammo'];

/*
 * The Murmur (players see them as that; the code calls them wildlife, their nests type 'nest' and their tunnel exits
 * type 'burrow'): the setting MURMUR below, in every kind of game; never in missions unless one asks, and never on a
 * silent biome (Lunar: see murmurGround). Creature nests sit out in the wilds, owned by wildOwner() (in Colony
 * WILD_OWNER, the empty second player slot; in Versus a slot of their own). Each keeps a few Scuttlers on
 * guard (guards + its level, a new one every `guardEvery` seconds) and sends no packs of its own: the Murmur come up
 * through their tunnels at night (MURMUR below), in Colony as in Versus. A pack goes for bots in the open; Brutes tear
 * up roads and batter buildings (never below 1 armor; construction sites are wrecked), and break through Walls and
 * Gates, slowly (`wallBite` of a bite each). A nest grows a level every `grow` seconds (up to 3): more guards and more
 * hoarded goods. Nothing can be built within `clear` tiles of a nest.
 */
const WILD_OWNER = 1; // (a Colony game's: in Versus the Murmur have a slot of their own after the colonies, see wildOwner)
const WILD = {
  grow: 600, guards: 2, guardEvery: 45, perTiles: 800, bite: 1.1, wallBite: 0.35, roadEvery: 4, clear: 2, loot: { crystal: 8, ore: 8, alloy: 4 },
  hunt: 6, // tiles an arrived Scuttler will walk to reach a bot (12 makes raids far deadlier: an AI colony was wiped out by minute 15)
};
/** The Murmur's colour where a colour stands for them (the minimap, a panel's owner dot, their tunnels' glow). */
const WILD_COLOR = '#a46cff';

/*
 * The Murmur setting (the new-game screen's "The Murmur": Off, Quiet or Active; Active by default): the Murmur in
 * every kind of game, Versus as well as Colony. Never on a silent biome (Argos: see murmurGround). Missions leave
 * them out unless one asks (its `murmur`); a map type can bring its own default (SHAPE_PRESETS `murmur`). They live
 * by the day: the setting keeps the day-and-night cycle on (murmurNight, from the game's own clock).
 *
 * - Nests (Versus: placed fairly by the map's symmetry, away from the bases and `offRoute` tiles off the shortest ways
 *   between them, by Crystal seams and strike sites): up
 *   to `orbits` sets of them (a nest for each colony in a set), one set for every `perTiles` tiles of map for two
 *   colonies (Medium, 2240 tiles: two sets on Active, one on Quiet).
 * - Tunnels (S.tun, a tile layer): each night every nest's network spreads, `tiles` more a night (the base, more each
 *   night after the first, at most the last), along `branches` branches heading for power (colony buildings, charge
 *   first), up to `cap` tiles in all (base, per night, most). Tunnels pass under roads, buildings and Walls.
 * - Exits (type 'burrow'): `exits` more open along each network a night (at most `maxExits` open at once), and at
 *   night packs come up through them, `pack` strong (base, per night, most; Brutes from night `brutes` on), `waves`
 *   packs a night from each. They harass every colony alike (bots, buildings full of charge, roads); at dawn the ones
 *   that came up go back down. Warbots collapse an exit (`exitArmor`): it stays shut `shut` seconds. A wrecked
 *   nest's network dies back and its exits close.
 * - At most room[0] + room[1] a colony of the Murmur are up at night at once; a pack comes up only where a colony has
 *   something within `prey` tiles of the exit.
 * - The nests send no packs by day, in Colony as in Versus (days are for striking them, nights for holding the line).
 * - Colony on the Hollow only (the lair's many nests would open twice the exits a Standard map does): no more exits
 *   open at once than a Standard Colony map of the same size could have open by that night (murmurExitCap).
 * - Quiet: fewer nests, fewer and slower tunnels, fewer exits and smaller packs, and none of their craft (`craft`, on
 *   Active only: a watcher at dusk, packs that gather out of the guns' reach and strike together, the power cut
 *   first, the weak spot found, a pack that loses half its number going back down to come again, their dead
 *   dragged away, a memory of where they were killed and where they fed, and from the third night a feint).

 * - `warn`: seconds before nightfall the dusk warning comes. Exits open no nearer than `exitFromBase` tiles to a
 *   Command Base or `exitFromBld` to any colony building; a branch makes for power within `reach` tiles of its nest;
 *   at dawn a creature within `retreat` tiles of an open exit goes down it (the rest dig down where they stand).
 */
const MURMUR_LEVELS = ['off', 'quiet', 'active'];
const MURMUR_NAMES = { off: 'Off', quiet: 'Quiet', active: 'Active' };
const MURMUR = {
  quiet: {
    orbits: 1, perTiles: 2200, tiles: [14, 4, 28], branches: [1, 0.34, 2], cap: [36, 18, 120],
    exits: [1, 0.25, 1], maxExits: 2, pack: [2, 0.25, 3], brutes: 4, waves: 1,
  },
  active: {
    orbits: 2, perTiles: 1100, tiles: [28, 8, 56], branches: [2, 0.5, 4], cap: [60, 36, 260],
    exits: [2, 0, 2], maxExits: 3, pack: [2, 0.34, 4], brutes: 2, waves: 2, // (smaller than before their craft, which hits harder)
  },
  shut: 900, warn: 40, exitArmor: 30, minBase: 18, offRoute: 6, exitFromBase: 12, exitFromBld: 4, reach: 44, retreat: 16, room: [12, 6], prey: 26,
  // Their craft, on Active only (Quiet keeps the plain packs: the owner's call). See murmurPlan and the functions after it.
  // watch: how far out from the night's target the watcher stands (tiles, at most); rally: how far from it the packs
  // gather; wait: seconds the gathered wait for the rest after the first comes, waitMax in all; join: how far (tiles)
  // from an exit the rally may be for its pack to go there (the joinMost nearest come; the rest stay down); cutR: what lights and charges the colony within that many
  // tiles of the target is cut first; cutTime: seconds at it; cutWait: the most the rest wait for the first cut; dark:
  // tiles round a cut building that go dark (a lamp: lampDark); leadGap: seconds the Brutes go ahead of the Scuttlers;
  // spread: how far round the target the Scuttlers spread; half: the share of a pack whose loss sends it back down;
  // again: seconds before a pack that went back comes up again (only with againLeft seconds of night still to come);
  // scatter: armed warbots within that many tiles (scatterN of them) scatter the Scuttlers for scatterFor seconds
  // (again no sooner than scatterCd); dragR: how far a creature goes to drag one of its dead; dragSlow: its pace then;
  // bodyLast: seconds a body nobody comes for lies there before it sinks; memR: tiles a memory reaches; memDecay: what
  // it keeps of it each night; memMost: how many places each memory holds; feintFrom: the first night a feint can come,
  // with feintArmy armed warbots in the colony; feintN: how many in it; feintFar: tiles at least from the target;
  // feintWait: the most the main pack waits for it to draw the warbots off.
  // Their other forms on Active: from night `from` a plan's packs bring at most one of each (the Leech goes first for the
  // power, the Spitter for the guns and Walls round the target, the Sapper under them). Leech: `rate` charge a second
  // while it feeds, a Fuel Station's Fuel gone every `fuelEvery` s and `bat` a second off each bot charging there;
  // full, it goes home and its nest grows `grow` s sooner. Spitter: stops `range` tiles off and spits every `every` s
  // (`cost` of its charge, which comes back at `regen` a second): `damage` armor off and a gun shorted for `short` s.
  // Sapper: digs in for `dig` s, goes `speed` tiles a second underground (nothing reaches it there), comes up for `up` s
  // before it can fight, and what it dug stays its nest's tunnel.
  forms: {
    leech: { from: 2, rate: 0.08, fuelEvery: 5, bat: 6, grow: 120 },
    spitter: { from: 2, range: 4.5, every: 3, cost: 0.25, regen: 0.05, damage: 2, short: 4 },
    sapper: { from: 3, dig: 2.5, speed: 0.9, up: 1.5 },
  },
  // Bolder as the game goes on, on Active only (Quiet as before; missions only where one asks: S.mission.bold). See
  // murmurThreat, murmurPressure, murmurHunt and murmurHorde in js/sim.js. Threats: an armed robot within `threatR`
  // tiles of one of them at night (or one that hit it in the last `hitFor` s) is never ignored: with `engage` times its
  // strength round it (its own within `packR` tiles, by `w`; a robot's its health / `robotW`, and each gun covering it
  // `gunW`) it fights it, else it falls back `avoidFor` s and comes on again; fallen back `avoidMost` times it carries
  // on, and shot at after that (hit in the last `hitFor` s) it turns and fights. Pressure: from night `nightFrom`,
  // `perNight` more a night (at most `nightMost`), times the colony's power (its finished buildings and twice its armed
  // robots) over `powerRef` (from `powerMin` to `powerMost`), never under 1 (a small colony fewer hunting teams too); it
  // scales the packs and how many may be up at once; from `exitNight` a nest may hold one more exit (two from
  // `exitNight2`), and from `waveNight` a third wave comes. The hunt: from night `huntFrom` (a mission's S.mur.huntFrom,
  // sooner), every `huntEvery` s of the night, teams of `teamN` (times the pressure; a Brute with them from night
  // `teamBrute`) come up at the colony's weak points (no gun covering them, no armed robot near: power first, then sites
  // and lone buildings), `teams` a colony at most (base, per night, most), only through exits within `huntR` tiles of
  // its buildings: collapse those and the hunt dies. The horde: from night `hordeFrom`, a strike under way gets `hordeN`
  // more (times the pressure) every `hordeEvery` s from the exit nearest its target. From `nightFrom`, one done at its
  // strike's objective (nothing left to catch there for `idle` s, or battered down) goes on through the colony, a
  // Scuttler after the nearest unarmed robot within `quarryR` tiles that no gun covers.
  // How evenly their packs' attacks spread across the colonies (murmurFair: the colonies' mean charge over one's own,
  // clamped to this; the owner's call of Nov 23 2026).
  fair: [0.5, 1],
  bold: {
    threatR: 5, hitFor: 2, packR: 4, engage: 1.5, robotW: 4, gunW: 3, avoidFor: 3, avoidMost: 2,
    w: { scuttler: 1, brute: 4, leech: 0.5, spitter: 1.5, sapper: 3, harrow: 30 },
    nightFrom: 3, perNight: 0.25, nightMost: 2.2, powerRef: 40, powerMin: 0.6, powerMost: 1.6, exitNight: 4, exitNight2: 6, waveNight: 4,
    huntFrom: 4, huntEvery: 40, teamN: 2, teamBrute: 5, teams: [1, 0.5, 4], huntR: 40,
    hordeFrom: 5, hordeEvery: 35, hordeN: 2, idle: 8, quarryR: 6,
  },
  // A nest fights back (nestAlarm in js/sim.js; the owner's call, Nov 23 2026): shot at from out of its guards' reach, its
  // guards (and at night the plain packs up within `packR` tiles) go for the shooter while it stays within `leash` tiles
  // of the nest, until `last` seconds after the latest hit; the shooter's colony is told, at most every `tell` seconds.
  alarm: { leash: 16, packR: 10, last: 20, tell: 30 },
  craft: {
    watch: 12, rally: 9, wait: 14, waitMax: 50, join: 46, cutR: 10, cutTime: 3, cutWait: 30, dark: 5, lampDark: 2, leadGap: 3,
    joinMost: 3, spread: 1.6, half: 0.5, again: 45, againLeft: 70, scatter: 4.5, scatterN: 2, scatterFor: 4, scatterCd: 12, dragR: 8,
    dragSlow: 0.7, bodyLast: 30, memR: 9, memDecay: 0.6, memMost: 24, feintFrom: 3, feintArmy: 4, feintN: 2, feintFar: 14, feintWait: 40,
  },
};

/*
 * The day: 12 minutes round, starting at dawn: [time of day, minutes] holds, [from, to, minutes] crossfades. Game
 * logic (the Murmur's nights: murmurNight) reads it through todPhase from the game's own clock, the same on every
 * device; how it looks (js/daynight.js) is a display setting kept on each device, which the game never reads.
 */
/**
 * The Harrow, the behemoth (BOTS.harrow; harrowTick and the rest in js/sim.js, after the Murmur's forms). Its body is
 * about 3.6 by 2.4 tiles: shots reach it `r` tiles further than its middle. Small arms (warbots, Bulwarks, Skirmishers,
 * turrets, Minigun Nests, Bunkers, a train's guns) do `small` of their damage; everything heavier does it all, and a
 * Missile does `missile`. It walks at its colony's Command Base and what holds the most charge (`charge` per point of
 * chargeWorth against `far` a tile of the way), battering what's in its way: `smash` armor a blow every `every` s
 * (Walls and Gates twice that), and `bite` to a robot within `reach` tiles. Every `slamEvery` s, with `slamMin` of a
 * colony's robots and buildings within `slamR` tiles, it rears for `rear` s and slams: robots there take `slamBot` and
 * are stunned `stun` s, buildings lose `slamBld` armor, and roads, track, pipes, Walls and Gates there are torn out;
 * `drop` of the Scuttlers riding on its back (`riders` at the start) jump off. The tiles it walks over (3 wide) lose
 * their road, track or pipe and become its nest's tunnel. A pack of `escort` comes up with it. It comes up for `up` s
 * out of a cave-in crater (`crater` s it stays on the map), and after `stay` s up it goes back down. A Command Base,
 * Keep, megastructure or Arrival City is never knocked below `floor` of its armor: it walks on to the next. Dead, it lies `husk` s and
 * leaves a Crystal hoard of `loot`. When it comes: the Hollow's mound under `mound` of its armor (two, one a colony);
 * in a long game on Active one roll at the dusk warning of night `rollNight` (`chance`), on a hit on a seeded night of
 * `nights`; the campaigns call spawnHarrow. The rival gathers `aiNeed` armed robots ahead of it before it fights.
 */
const HARROW = {
  r: 1.2, small: 0.25, missile: 60, charge: 3, far: 0.25, smash: 10, every: 2.5, bite: 10, reach: 2.1,
  slamEvery: 9, slamMin: 3, slamR: 3, rear: 1.2, slamBot: 6, stun: 3, slamBld: 25, riders: 6, drop: 2,
  escort: { scuttler: 6, brute: 2 }, floor: 0.5, feed: 30, up: 2.7, crater: 900, stay: 900, husk: 60, loot: 40, repath: 12,
  mound: 0.25, rollNight: 6, chance: 0.5, nights: [6, 8], aiNeed: 12, aiReach: 30,
};
const TOD_CYCLE = [['morning', 1.5], ['morning', 'day', 0.5], ['day', 4], ['day', 'evening', 0.5], ['evening', 1.5], ['evening', 'night', 0.5], ['night', 3], ['night', 'morning', 0.5]];
const TOD_LEN = TOD_CYCLE.reduce((n, p) => n + p[p.length - 1], 0) * 60;
/** Where game time t (seconds) falls in the day: { a, b, f } (f, 0 to 1, from a to b, smoothed). */
function todPhase(t) {
  let x = ((t % TOD_LEN) + TOD_LEN) % TOD_LEN;
  for (const p of TOD_CYCLE) {
    const len = p[p.length - 1] * 60;
    if (x >= len) { x -= len; continue; }
    if (p.length === 2) return { a: p[0], b: p[0], f: 0 };
    const f = x / len;
    return { a: p[0], b: p[1], f: f * f * (3 - 2 * f) }; // smoothstep
  }
  return { a: 'day', b: 'day', f: 0 };
}
/** The time of day's name at game time t ('morning', 'day', 'evening' or 'night'). */
function todNameAt(t) { const p = todPhase(t); return p.f < 0.5 ? p.a : p.b; }
/** When night begins and ends in each day (seconds into it): halfway through the crossfades either side of it. */
const NIGHT_FROM = (() => { let s = 0; for (const p of TOD_CYCLE) { if (p.length === 3 && p[1] === 'night') return s + p[2] * 30; s += p[p.length - 1] * 60; } return 0; })();
const NIGHT_TO = (() => { let s = 0; for (const p of TOD_CYCLE) { if (p.length === 3 && p[0] === 'night') return s + p[2] * 30; s += p[p.length - 1] * 60; } return 0; })();
/** The lull before a surge on an always-night map (the Hollow): the ground goes dead silent this long before it. */
const SURGE_LULL = 60;

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
/*
 * Horde mode (the owner's, Nov 25 2026; the new-game screen's third mode): survive ever bigger Murmur waves sent down Long
 * haul at you from the Maw at the far end. A Colony game underneath (no rival: you, the planet and the Murmur), with
 * S.horde holding the waves (hordeSetup and hordeTick in js/sim.js). Its own Murmur only: no nests, no nightly tunnels.
 *   shape, size   the map type it is locked to (Long haul) and the size it starts on (Large)
 *   waves         a Fixed game is won by surviving (clearing) this many waves, or wrecking the Maw; Endless never ends
 *                 but on the Maw or your Command Base (the best wave is kept on the device: UI only)
 *   levels        the difficulty, by the rival levels' keys (Settler to Warlord): `mult` scales every kind's count,
 *                 `ramp` makes it grow faster each wave (times 1 + ramp × (wave − 1)), `gap` the countdown between waves
 *                 [first, less each wave, least] in seconds, `endless`: always Endless (Warlord: relentless, near
 *                 unsurvivable), `uncapped`: no kind's `cap` (Warlord's waves grow without end: the owner's call, Nov
 *                 2026), `queue`: its own `queueMost`
 *   kinds         each kind joins from wave `from` with `base` and `per` more each wave after; they stay in every later
 *                 wave and keep growing (the waves are cumulative: the owner's call). `cap` the most of a kind in a wave.
 *   boss          every `every`th wave is a boss wave: every kind `mul` times as many, led by `harrows` Harrows (more
 *                 from `twoFrom` on Commander and Warlord: `twoMult`)
 *   room          the most of the waves' Murmur up at once (the rest wait in the Maw and come as room frees: the scale
 *                 is kept, the spawns staggered); `pace` seconds between two out of the same mouth; `queueMost` the
 *                 most waiting at once (a level's `queue` instead where it has one): any more are held over in the Maw
 *                 (S.horde.over) and join the next wave, never dropped
 *   mouths        the Maw's tunnel mouths round it, `mouthR` tiles out (armor `mouthArmor`: caved in, it is dug open
 *                 again at the next wave); `mawGuards` more on guard round the Maw than a nest has
 *   side          side tunnels partway down from wave `from` (one more every `every` waves, at most `most` open),
 *                 `at` of the way from the Maw toward you; `share` of each wave comes up through them
 *   lanes         the lanes down the map (waypoints every `step` of the way; each creature makes for a spot up to `spread`
 *                 tiles either side of a lane's waypoint, so a wave comes on as a broad front)
 *   warn          seconds before a wave the warning comes
 *   salvage       a cleared wave drops crates by your front line: `base` of each good plus `per` × the wave
 *   start         robots you land with on top of a Colony landing (warbots: a Colony game has none)
 *   fall          your Command Base falls when the Murmur batter it down to this much armor; dug in, it takes
 *                 `baseTakes` of their blows (theirs only)
 *   harrow        a boss wave's Harrow's health, a share of a full-grown one's: `base` + `per` × the wave, at most `most`
 *   pair          co-op side by side (multiplayer, two people with a colony each): played on `shape`, the two colonies
 *                 allies at the south end and the Maw at the north; every kind `mul` times as many (split over both
 *                 colonies' lanes, so each faces a little less than a lone colony would, but the two must hold
 *                 together), a boss wave's Harrows one for each colony, `room` up at once, the Maw's guards `guards`
 *                 times as many
 *   crew          shared colony co-op (more than one person running the one colony): every kind 1 + `per` × each
 *                 extra person times as many, at most `most` (one economy, more hands)
 */
const HORDE = {
  shape: 'Long haul', size: 2, waves: 20,
  levels: {
    easy:    { mult: 0.6, ramp: 0,     gap: [210, 5, 120] },
    medium:  { mult: 0.8, ramp: 0.01,  gap: [195, 6, 105] },
    normal:  { mult: 1.0, ramp: 0.025, gap: [180, 6, 90] },
    hard:    { mult: 1.3, ramp: 0.04,  gap: [165, 7, 70] },
    warlord: { mult: 1.7, ramp: 0.07,  gap: [130, 7, 40], endless: true, uncapped: true, queue: 1500 },
  },
  kinds: {
    scuttler: { from: 1, base: 4, per: 2, cap: 140 },
    brute:    { from: 4, base: 1, per: 0.5, cap: 40 },
    leech:    { from: 7, base: 1, per: 0.34, cap: 20 },
    spitter:  { from: 7, base: 1, per: 0.4, cap: 24 },
    sapper:   { from: 10, base: 1, per: 0.3, cap: 20 },
  },
  boss: { every: 5, mul: 1.25, harrows: 1, twoFrom: 15, twoMult: 1.3 },
  room: 110, pace: 0.5, queueMost: 400,
  mouths: 4, mouthR: 5, mouthArmor: 90, mawGuards: 6,
  side: { from: 8, every: 4, most: 3, at: [0.4, 0.55], share: 0.3 },
  lanes: 3, step: 0.25, spread: 5,
  warn: 20,
  salvage: { base: { alloy: 3, cement: 4, ammo: 4 }, per: { alloy: 0.5, ammo: 0.8, chip: 0.25, crystal: 0.3 } },
  start: { warbot: 4 },
  fall: 1, baseTakes: 0.2,
  harrow: { base: 0.25, per: 0.05, most: 1.5 },
  pair: { shape: 'Long Haul 2v2', mul: 1.8, room: 160, guards: 2 },
  crew: { per: 0.3, most: 1.6 },
};
/*
 * Fallen allies (the owner, Nov 2026): in a team game (Teams 2 vs 2, co-op Horde side by side) a colony whose Command
 * Base falls while a teammate still stands is down, not out: its people watch, and a teammate taking the base back
 * brings it back into the game (js/sim.js: colonyDown, reinstate). `armor`: the base's share of its armor once retaken;
 * `crew`: the robots a retaken Teams colony starts again with (its own were lost with the base); `prizeKeep`: the warbots
 * a computer captor keeps in a fallen colony's base it holds; `retake`: Horde's (the Murmur don't capture): armed warbots
 * of a partner within r tiles of the ruin, no Murmur that close, for secs seconds (running back `decay` a second with
 * nobody there).
 */
const FALLEN = { armor: 0.3, crew: { worker: 6, hauler: 3, warbot: 4, bulwark: 1 }, hordeCrew: { worker: 2, warbot: 4 },
  goods: { cement: 20, alloy: 12, chip: 6, fuel: 10, ammo: 10 }, prizeKeep: 4, retake: { r: 3, secs: 35, decay: 2 } };
/** The Horde level's numbers (HORDE.levels) for a difficulty key. */
function hordeLevel(k) { return HORDE.levels[k] || HORDE.levels.normal; }
/** The Long haul map type's index (Horde is played on it; co-op side by side on Long Haul 2v2: `pair`). */
function hordeShape(pair) { return Math.max(0, SHAPE_PRESETS.findIndex((P) => P.name === (pair ? HORDE.pair.shape : HORDE.shape))); }
/** Wave n's Murmur at level k (`mul`: co-op's scale, S.horde.mul): { scuttler, brute, leech, spitter, sapper, harrow } (whole numbers; kinds not in it yet are left out). */
function hordeWave(n, k, mul = 1) {
  const L = hordeLevel(k), boss = n % HORDE.boss.every === 0, grow = 1 + L.ramp * (n - 1), out = {};
  for (const type in HORDE.kinds) {
    const K = HORDE.kinds[type];
    if (n < K.from) continue;
    const count = Math.max(1, Math.floor((K.base + K.per * (n - K.from)) * L.mult * mul * grow * (boss ? HORDE.boss.mul : 1) + 1e-9));
    out[type] = L.uncapped ? count : Math.min(Math.round(K.cap * Math.max(1, mul)), count);
  }
  if (boss) out.harrow = HORDE.boss.harrows + (n >= HORDE.boss.twoFrom && L.mult >= HORDE.boss.twoMult ? 1 : 0);
  return out;
}
/** The most of the waves' Murmur waiting in the Maw at once at level k (HORDE.queueMost, or the level's `queue`). */
function hordeQueueMost(k) { return hordeLevel(k).queue || HORDE.queueMost; }
/** How many Murmur in wave n at level k, all told. */
function hordeWaveSize(n, k, mul) { const w = hordeWave(n, k, mul); let s = 0; for (const t in w) s += w[t]; return s; }
/** The countdown before wave n (seconds) at level k: the first from the landing, then from the wave before. */
function hordeGap(n, k) { const g = hordeLevel(k).gap; return Math.max(g[2], g[0] - g[1] * (n - 1)); }

const START_STOCK = { fiber: 16, stone: 8, alloy: 8, chip: 4, crystal: 4, fuel: 10, cement: 24 };
const START_BOTS = { worker: 10, hauler: 5, tanker: 1, agribot: 1 };
const START_WARBOTS = 4;

/*
 * Challenge modifiers (Custom Game, the Challenge section; multiplayer too): switches mixed freely, kept in the
 * game's settings (S.settings.mods, a list of keys) so every device plays them alike, and remembered on the device
 * with the other new-game choices. modsSetup (js/sim.js) applies the ones that change the landing; the rest are
 * looked up as the game runs (modOn). `versus`: only with a rival (left out of a Colony game). `pace`: it changes how
 * fast a game goes rather than only making it harder, so a win with it isn't a fastest win (js/goals.js). `desc` for
 * the new-game screen, `brief` for the briefing.
 *   fuel      Refineries refine and energy crops ripen at `rate` speed.
 *   dust      A dust storm (EVENTS.dust) blows in `at` seconds in and never blows over.
 *   head      Each computer colony lands with `stock` more times START_STOCK and the robots in `bots`.
 *   crystal   Crystal clusters hold `keep` as much, and every colony lands with `keep` of its Crystal.
 *   fragile   Robots and vehicles take `takes` times the damage.
 *   noturret  People can't build the `types` (the computer can).
 */
const MODS = {
  fuel: { name: 'Half Fuel', rate: 0.5, brief: 'Refineries and energy crops make Fuel at half speed',
    desc: 'Half Fuel: Refineries refine and energy crops ripen at half speed, for every colony. Fuel Stations, trucks and Generators run short.' },
  dust: { name: 'Endless dust storm', at: 300, brief: 'from 5 minutes in, for good: bots slowed, Missiles grounded',
    desc: 'Endless dust storm: 5 minutes in, a dust storm blows in for good: bots at two-thirds speed, Missiles grounded, no other planetary event.' },
  head: { name: 'Rival head start', versus: true, stock: 1, bots: { worker: 4, hauler: 2, warbot: 2 }, brief: 'the computer landed with twice the goods and 8 more robots',
    desc: 'Rival head start: every computer colony lands with twice the goods, 4 more Workers, 2 more Haulers and 2 more warbots.' },
  crystal: { name: 'Scarce Crystal', keep: 0.5, brief: 'half as much in every cluster and at every Command Base',
    desc: 'Scarce Crystal: Crystal clusters hold half as much, and every colony lands with half its Crystal. Chips and turret ammo come dear.' },
  fragile: { name: 'Fragile robots', takes: 1.5, pace: true, brief: 'every robot takes half again the damage',
    desc: 'Fragile robots: every robot and vehicle takes half again as much damage. Fights end sooner, so a win with it is not a fastest win.' },
  noturret: { name: 'No turrets', types: ['turret', 'minigun', 'mortar', 'disruptor'], brief: 'no Pulse Turrets, Minigun Nests, Mortar Pits or Disruptor Towers for you',
    desc: 'No turrets: you can\'t build Pulse Turrets, Minigun Nests, Mortar Pits or Disruptor Towers; the computer still can.' },
};
const MOD_ORDER = ['fuel', 'dust', 'head', 'crystal', 'fragile', 'noturret'];
/** A list of modifier keys made safe: known ones, once each, in MOD_ORDER; in a Colony game none that need a rival. */
function modList(l, mode) { return Array.isArray(l) ? MOD_ORDER.filter((k) => l.includes(k) && !(mode === 'colony' && MODS[k].versus)) : []; }
/** The challenge modifiers on in this game (a save's unknown ones left out). */
function gameMods() { return S && S.settings ? modList(S.settings.mods) : []; }
/** Is challenge modifier k on in this game? */
function modOn(k) { const m = S && S.settings && S.settings.mods; return Array.isArray(m) && m.includes(k); }

const MIN_FREE_WORKERS = 2;   // workers always kept free for building
// A building's worker that can't work (out of what it works with, its store full) with nothing on the way to change
// that, for STALL_FREE seconds, is sent off to a job that is waiting for a worker (see benchStalled).
const STALL_FREE = 25;
// Staffing follows the economy (see goodsWanted): a good the colony has under WANT_LOW of, that a factory or a site is
// held up for, makes the buildings that produce it first in line for a worker; one it has RICH_STOCK or more of (and
// nobody is waiting for) puts its producers last, and their workers may leave for a producer of a wanted good.
const WANT_LOW = 12, RICH_STOCK = 150;
/*
 * The Workforce ladder (the Workforce panel, Shift+W; see wfOrder in sim.js): the job types spare Workers fill, one row
 * each. Building sites and Repairs are the builders' jobs (Repairs takes in mending cracked roads, a downed Maglev pylon
 * and capping a fallen Deep Core's shafts), Paving the planned roads, the rest the buildings a Worker runs (`types`).
 * A building a Worker runs that is in no row's types is in Other buildings. In Auto (the default) the ladder is the order
 * the game uses anyway: sites, then repairs, then the buildings by what the economy needs, paving last. A player's
 * own order (Manual) decides which rows spare Workers fill first; each row can have a minimum (at least N Workers),
 * a cap (at most N) and a pin (its Workers are never moved by the automatic shortage and stall moves).
 */
const WF_ROWS = [
  { k: 'sites', name: 'Building sites', one: 'site' },
  { k: 'repair', name: 'Repairs', one: 'repair' },
  { k: 'foundry', name: 'Bot Foundries', types: ['foundry'] },
  { k: 'crystal', name: 'Crystal Taps', types: ['tap'] },
  { k: 'ore', name: 'Ore Mines', types: ['mine'] },
  { k: 'fiber', name: 'Harvesters', types: ['harvester'] },
  { k: 'stone', name: 'Quarries', types: ['quarry'] },
  { k: 'smelter', name: 'Smelters', types: ['smelter'] },
  { k: 'chip', name: 'Chip Fabs', types: ['fab'] },
  { k: 'cement', name: 'Cement Works', types: ['kiln'] },
  { k: 'oil', name: 'Oil and Fuel', types: ['pump', 'refinery'] },
  { k: 'asphalt', name: 'Asphalt Plants', types: ['tarworks'] },
  { k: 'war', name: 'Ammo and Missiles', types: ['armory', 'munitions', 'reactor'] },
  { k: 'lab', name: 'Research Labs', types: ['lab'] },
  { k: 'other', name: 'Other buildings' },
  { k: 'pave', name: 'Paving', one: 'road' },
];
const WF_KEYS = WF_ROWS.map((r) => r.k);
const WF_ROW = Object.fromEntries(WF_ROWS.map((r) => [r.k, r]));
const WF_MAX = 99; // (the most a row's minimum or cap goes to)
const WF_MIN_TAKE = 2; // (Workers a row short of its minimum takes off other buildings in one pass, with nobody free)
// One tap each on the panel: a Manual order (rows not named keep their places after these, in WF_ROWS order).
const WF_PRESETS = {
  economy: { name: 'Economy', order: ['foundry', 'crystal', 'ore', 'fiber', 'stone', 'smelter', 'chip', 'cement', 'oil', 'sites', 'repair'] },
  war: { name: 'War', order: ['repair', 'war', 'sites', 'foundry', 'smelter', 'chip', 'cement', 'oil', 'ore', 'crystal'] },
  build: { name: 'Build-up', order: ['sites', 'pave', 'cement', 'stone', 'fiber', 'repair', 'ore', 'smelter'] },
};
/*
 * Recycling (see recycleBot): a robot sent to a Bot Foundry (its panel's Recycle this unit, the Robots panel's Recycle
 * spare Workers) walks or drives there and is taken apart, RECYCLE_TIME seconds for each round of parts that went into
 * it (a quarter of the Foundry's time to make it) while it stands at the Foundry. RECYCLE_SHARE of the Alloy and Chips that went into it (a
 * round of parts, 1 Alloy and 1 Chip, for each of BOTS[k].parts) goes into that Foundry's stock, rounded down, Alloy
 * first: a Worker gives 1 Alloy, a Freight Truck 1 Alloy and 1 Chip. Its place under the robot limit is free again.
 * Spare Workers: those beyond one for each building that takes a Worker (sites too) and MIN_FREE_WORKERS +
 * RECYCLE_KEEP free for building.
 */
const RECYCLE_SHARE = 0.5;
const RECYCLE_KEEP = 2;
const RECYCLE_TIME = 2;

/*
 * The story (LORE.md is canon: Ithaca I, the four vanguards, the Murmur, the Silence). Text only: nothing here changes
 * the game. The narrator is your colony's own Command AI (narrate, in world.js): a few dry status lines, each said once
 * (or now and then), never in missions, which keep their own texts. The rivals' voices are their doctrines'
 * (PERSONALITIES[k].voice, see doctrineVoice). Lines are picked without the game's RNG.
 */
const NARRATOR = {
  start: 'Terrafall complete. Region claimed for the Sponsor. Arrival clock: T+31 years.',
  road: 'Road online. Built to Accord passenger standard.',
  night: 'Street lighting active. Traffic: freight only.',
  uplink: 'Uplink secured. Listening on all channels. No response.',
  captured: 'Command authority transferred. Their buildings report for duty.', // (its robots shut down: eliminate)
  // (a rival's Command Base taken by another rival, in a free-for-all: {by} and {old} are callsigns, or people's names)
  changed: 'Command core changed hands. {old}\'s buildings now report to {by}.',
  defeat: 'Command core lost. Transferring authority. Hold position.',
  // (lost on Domination, or on the Uplinks, while the colony still stands: LORE.md, Mechanics to lore; a win ends as
  // LORE.md's player arc has it: "Continuing current directive.")
  outranked: 'Settlement priority lost under the Accord. Hold position. Further instructions to follow.',
  uplinksLost: 'Uplinks lost. Another colony speaks for Ithaca I. Hold position.',
  victory: 'Region secured for the Sponsor. Report sent. No reply. Continuing current directive.',
  domination: 'Prepared land: majority held. Settlement priority confirmed under the Accord. Continuing current directive.',
  uplinks: 'Uplinks held. Ithaca I speaks with one voice. No reply. Continuing current directive.',
  // (the Wren, as it comes into orbit: LORE.md's event line)
  wren: 'The Wren is in orbit. On schedule, as always.',
};
/** The Arrival clock (LORE.md: zero was the day the colony ships were due), as the Command Base's panel shows it. */
const ARRIVAL_CLOCK = 'Arrival clock: T+31 years. Probability of contact: 0.2%. Still counting.';

/**
 * One line of flavour at the foot of each building's and robot's panel (LORE.md's where it has one). Kept to one
 * short line, below everything useful.
 */
const FLAVOR = {
  // Buildings
  lander: ARRIVAL_CLOCK,
  harvester: 'Fiber quota set for an ark’s worth of textiles. Still filling it.',
  quarry: 'Rated for foundation stone. Every foundation so far has been a fort.',
  mine: 'Ringfall restocks the veins. The Sponsors counted on it.',
  tap: 'Ring Crystal weighs a little less than it should. Clamps recommended.',
  grower: 'Planting calendar: Accord standard. Harvest festival: date unassigned.',
  smelter: 'Alloy cast to colony spec: bus frames, bridge spans. Mostly warbots now.',
  fab: 'Line calibrated for classroom tablets. Recalibrated for targeting.',
  foundry: 'We make more of us.',
  outpost: 'Survey stake. This land is prepared.',
  turret: 'Challenge protocol removed at T+1. Firing protocol unchanged.',
  bunker: 'Specified as a ringfall shelter. Seats twelve. Two warbots fit better.',
  disruptor: 'Scrambles every robot in reach. The Murmur are not robots.',
  mortar: 'Fires over walls. The Accord’s building code assumed there would be none.',
  flak: 'Watches the sky for the arks. Shoots at everything else.',
  minigun: 'Fast, loud and fed on Ammo. Subtlety was never in the spec.',
  keep: 'Built to hold until relieved. Nobody has been relieved.',
  kiln: 'Cement for houses, schools and roads. So far: roads.',
  tarworks: 'Asphalt rated for a hundred thousand passenger journeys. Count so far: zero.',
  roadworks: 'Resurfacing schedule set by a bus timetable that was never issued.',
  armory: 'Line converted from Arrival Day fireworks. Same powder, new casings.',
  munitions: 'Survey rocket airframes. Contingency payloads.',
  silo: 'Countdown hardware from the survey programme. It still counts down.',
  reactor: 'Enrichment meant for the colonists’ reactors. The contingency orders found another use.',
  nukesilo: 'Two-key launch system. The second key was never assigned.',
  generator: 'Sized for a town’s evening peak. The town has not been built.',
  charger: 'Bays marked for buses and ambulances. Robots use all of them.',
  farm: 'A VIRIDIAN design. Fuel crops now; orchards were phase two.',
  pump: 'The older drilling kit. It predates the Accord and expects to outlast it.',
  refinery: 'Refines enough Fuel for a colony fleet. The fleet is robots.',
  fueltank: 'Three tanks to the Accord storage code, and a sign that says NO SMOKING. Nobody here smokes.',
  ramp: 'Gradient: Accord passenger standard, one in twelve.',
  repair: 'Fitted out as a clinic. The beds were taken out to make room.',
  wall: 'Rated against dust storms. Tested against neighbours.',
  gate: 'Opens for friendly traffic. Friendly traffic is freight.',
  ropeway: 'Cabins rated for six passengers each. Carrying Ore.',
  viaduct: 'Spanned to passenger standard, with a viewing rail.',
  lab: 'Open questions: 1. The Murmur. 2. Everything else.',
  port: 'The passenger terminal’s departure board still reads ON TIME.',
  airfield: 'Control tower on duty. Inbound traffic: none listed.',
  mast: 'The waiting room at its foot has benches and a departure board. Nobody waits in it.',
  dropost: 'Survey stake, by air.',
  station: 'Platform signs in four languages. Every train is freight.',
  magterm: 'Phase 2 transit. Platforms to passenger standard. Departures on time; the seats stay folded.',
  mdriver: 'Survey kit to supply settlements before the roads. The settlements never came. It still fires.',
  lance: 'Orbital defence, from the archive’s last pages. Rebuilt here, aimed the other way.',
  sunder: 'Piling rig for the arrival district’s foundations. Something under the district keeps time with it.',
  dome: 'Weather shield for the arrival district. Rated for storms. Used for everything else.',
  city: 'Homes for 12,000. Lights on at dusk, on a timer. Occupancy: pending.',
  lift: 'Rated for the colonists’ luggage. Going up: surplus. Coming down: what the Carrier has left.',
  deepcore: 'Core sample rig, rated to 40 kilometres. The survey filed the lower readings as instrument error.',
  atmos: 'Scheduled in the Pathfinder\'s plan for T−10. Started late. Running to plan.',
  gup: 'Landing beacon for the arks. Transmitting on all channels. Listening on all channels.',
  catcher: 'A canister every eight seconds, each way, around the clock, for settlements still on the drawing board.',
  magpylon: 'Phase 2, structure type 4. Built to the standard, thirty years late.',
  terminal: 'Docked at a Trade Post. The ledger insists on Accord rates.',
  crawlerbase: 'A depot on tracks, parked where the road ends.',
  nest: 'Logged as an acoustic anomaly. The log was never closed.',
  burrow: 'Ground survey for this tile: level, compacted, stable. Survey date: yesterday.',
  mound: 'Unsurveyed. Every robot sent to map it is still listed as mapping.',
  depot: 'Shelf labels from the colony manifest: seed stock, school desks, blankets. Mostly Cement.',
  // Robots
  worker: 'Accord-standard construction unit. Tireless, literal, never asks why.',
  hauler: 'Certified for paved roads. Will not go anywhere else. Do not ask.',
  agribot: 'Plants for a harvest nobody has scheduled.',
  paver: 'Every road built to passenger standard. No passengers yet.',
  grader: 'Levels the ground the Pathfinder surveyed for the arks. The survey is thirty-one years old; the ground has moved.',
  earthwork: 'Cut and fill, to the Accord grade. Somebody will want a level place to land.',
  composter: 'Humus to the Accord soil standard, bagged and stacked. The gardens it was for are still on the plan.',
  nursery: 'Seed stock from the Pathfinder\'s vaults, planted out on schedule. Shade for a park nobody has walked in.',
  wpump: 'Lifts water to the fields at the rate set for a colony of four thousand. The rate has not been revised.',
  seamdrill: 'Bores to the seams the survey filed under instrument error.',
  seedmast: 'Ringfall restocks the planet on its own schedule. The Seedbed keeps ours.',
  thermal: 'The Pathfinder zoned this ground for bathhouses. It runs a turbine instead.',
  express: 'Arterial, built to the standard. Speed limit posted. Nobody reads it.',
  roadtrain: 'Built to haul an ark’s cargo inland. Hauling Cement.',
  freight: 'Timetable slot reserved for a passenger service. Unused.',
  magpod: 'Twelve seats, folded. Forty crates.',
  cargoship: 'Loaded to the colony manifest’s tonnage. Most of it is Ore.',
  tankship: 'Spills are to be reported to an office that does not answer.',
  ferry: 'Rated for 200 passengers and their luggage. Carries warbots.',
  bomber: 'Cargo plane. Different cargo.',
  cargoplane: 'Rigged for relief drops. It still drops them by parachute.',
  airship: 'Cabin certified for forty colonists. Seats removed; the certificate is still on the bulkhead.',
  crawler: 'A depot on tracks, for roads that don’t exist yet.',
  truck: 'Twelve tonnes, one destination, no opinions.',
  tanker: 'Explosive when full. Labelled accordingly, in four languages.',
  rocket: 'Road-cutting artillery. It still thinks in road cuts.',
  warbot: 'Designed to protect colonists. Reassigned by the contingency orders.',
  bulwark: 'Rated for dust storms. Rifles turned out to be easier.',
  torch: 'Built to clear the Bloom. The Bloom grows back. So do enemies.',
  skirmisher: 'Survey runner, rated for crossing the Rust in a day. It still makes good time.',
  arccaster: 'Grid-fault tester. Every fault it finds now is on purpose.',
  railgunner: 'Mass-driver test rig, cut down to carry. The range card still lists ore.',
  scuttler: 'No robot has ever logged one alone.',
  brute: 'Drawn to charge. Batteries, power lines and Crystal all read as food.',
  leech: 'The lights dim as it drinks. Logged as a fault, three times, before anyone looked.',
  spitter: 'The residue is conductive. The Lab would like a sample that is not still moving.',
  sapper: 'The Walls were rated for anything that comes over them.',
  harrow: 'The roads were built for buses. It does not use them.',
  // Neutral ground (not buildings anyone owns)
  post: 'Accord rates honoured. The ledger is still open.',
  uplink: 'Transmitting. No response. Transmitting.',
};

/** Lines for the loading screen (one at random, in index.html: keep the two lists the same). */
const SPLASH_LINES = [
  'The Accord gave the colonies four colours so the machines could tell each other apart. It never planned for them to need it.',
  'Nobody has revoked the contingency orders. Nobody is left to.',
  'Every road on Ithaca I is wide enough for a bus.',
  'The arks were due 31 years ago. The welcome signs are still lit.',
  'Arrival clock: T+31 years. Probability of contact: 0.2%. Still counting.',
  'Last transmission from home: “Hold position. Further instructions to follow.”',
  'The Rust: where the dust storms begin, and where the first Accord landings were.',
  'Greenreach was the survey’s favourite.',
  'In Emberwood the leaves stay red-gold all year.',
  'The Long Grass: easy roads, nowhere to hide.',
  'Pavers hate Blackwater.',
  'The Polar Caps: Ore locked in ice. The coldest posting on Ithaca I.',
  'Argos, the moon, is the only silent ground the robots have.',
  'Ringfall keeps the planet stocked. The Sponsors called it a self-refilling quarry.',
  'The Wren arrives on schedule, as always.',
  'No robot has ever logged one of the Murmur alone.',
];

/**
 * The Wren's cargo lists (LORE.md: 31 years out of date). One is shown on its card, picked by the event's number.
 * Goods for a colony that hasn't come; never say why.
 */
const WREN_CARGO = [
  'seed stock, school tablets, 4,000 pairs of children’s shoes',
  'orchard saplings, chalk, 600 cot mattresses',
  'bus timetables, library cards, 1,200 winter coats',
  'seed potatoes, wedding rings (assorted sizes), one piano',
  'birthday candles, 9,000 toothbrushes, a town clock',
  'school desks, reading glasses, 300 bicycles',
];
/** The cargo list on the Wren's n-th visit. */
function wrenCargo(n) { return WREN_CARGO[(Math.abs(n | 0)) % WREN_CARGO.length]; }

/** The Warden counts the days: day 12,054 when the game starts, one more each game day (12 minutes). */
function wardenDay(t) { return String(12054 + Math.floor(Math.max(0, t || 0) / 720)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

/** Do the Murmur live on this biome? Not on Lunar (Argos, the moon: the only silent ground). */
function murmurGround(biome) { return !(BIOMES[biome] && BIOMES[biome].silent); }
/**
 * Can map type `shape` have the Murmur? Not one with noMurmur: Sky islands and Four Isles, where no nest ever found ground
 * of its own (the dusk warning came every night and nothing followed). The owner's call, Nov 2026.
 */
function murmurShape(shape) { return !(SHAPE_PRESETS[shape] && SHAPE_PRESETS[shape].noMurmur); }
/** Is murmur one of the setting's levels ('off', 'quiet', 'active')? */
function murmurLevelOk(v) { return MURMUR_LEVELS.includes(v); }
/** The biome's name on Ithaca I ('the Rust'), for flavour; capitalised at the start of a sentence with cap. */
function regionName(biome, cap) {
  const r = (BIOMES[biome] || BIOMES.desert).region || '';
  return cap ? r.charAt(0).toUpperCase() + r.slice(1) : r;
}

/*
 * Commands for a computer ally (a team game: the Ally panel, Shift+A; orders.js allyCmd, ai.js allyCommand). Times in
 * game seconds. An attack or Help me sends up to `send` warbots (at least `min` to spare, or it says no) and calls them
 * home after attackFor / helpFor (more on a long march); Defend this area keeps `defendShare` of what it can spare
 * (min to defendMax) on the spot for defendFor, topped up every topUp seconds when it's down to half; Hold back keeps
 * its army home for holdFor. Ask for goods: a share of what it holds above `keep` (goodsMin to goodsMax), once every
 * goodsEvery seconds per ally, on a supply run of shipSpeed tiles a second (shipMin to shipMax seconds) to your
 * storage nearest its Command Base.
 */
const ALLY_CMD = {
  min: 2, send: 20, attackFor: 150, helpFor: 120,
  defendShare: 0.5, defendMax: 12, defendFor: 600, topUp: 30, holdFor: 600, reach: 4,
  goodsShare: 0.3, goodsMin: 3, goodsMax: 40, keep: 15, goodsEvery: 60, shipSpeed: 2, shipMin: 15, shipMax: 90,
};
/** The commands (in the order of the panel) and the goods an ally can be asked for. */
const ALLY_KINDS = ['attack', 'defend', 'help', 'hold', 'goods', 'cancel'];
const ALLY_GOODS = ['cement', 'stone', 'fiber', 'ore', 'crystal', 'alloy', 'chip', 'ammo', 'fuel'];
/** What a computer ally says back (its callsign before it, in the messages): terse, by the Accord's book. */
const ALLY_SAYS = {
  attack: 'Acknowledged. Moving on the marked position.',
  defend: 'Acknowledged. Holding the marked ground.',
  help: 'Acknowledged. Warbots en route to you.',
  hold: 'Acknowledged. Holding at home.',
  cancel: 'Acknowledged. Resuming our own plan.',
  goods: 'Acknowledged. {n} {g} on a supply run to your {b}.',
  noArmy: 'Negative: no warbots to spare.',
  noGround: 'Negative: our warbots cannot reach that ground.',
  noGoods: 'Negative: no {g} to spare.',
  noStore: 'Negative: you have no storage to receive it.',
  wait: 'Negative: the last supply run is still on its way.',
  done: 'Strike complete. Resuming our own plan.',
  back: 'Withdrawing. Resuming our own plan.',
  defendEnd: 'Standing down from the marked ground.',
  holdEnd: 'Hold-back over. Resuming our own plan.',
  arrived: '{n} {g} from {who} arrived at your {b}.',
};

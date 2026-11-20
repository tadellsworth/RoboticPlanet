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
  return Object.prototype.hasOwnProperty.call(BIOMES, key) && (!BIOMES[key].navalOnly || !!(NAVAL_ON && SHAPE_PRESETS[shape]?.naval));
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
    desc: 'A road crew bot. A Roadworks needs one to lay asphalt on your roads.' },
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
};
const BOT_ORDER = ['worker', 'hauler', 'truck', 'tanker', 'roadtrain', 'freight', 'cargoship', 'tankship', 'ferry', 'cargoplane', 'bomber', 'airship', 'magpod', 'crawler', 'agribot', 'paver', 'warbot', 'bulwark', 'torch', 'rocket'];
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
 * anything, between two Maglev Terminals `min` to `max` tiles apart (b.line on both, as a Mooring Mast's; a Terminal is
 * on one line at most). Planned in Paths (Maglev) with two taps: a built Terminal of yours (the near end), then the far
 * end (a clear spot where the far Terminal goes up, a Terminal site, or a built Terminal). A pylon stands every
 * `spacing` tiles from the near Terminal (magSpots), on open ground, a cliff top or shallow water, never on a building,
 * a road or track; a spot in a chasm or deep water or rock is left out as long as the pylons either side of it stand,
 * so a line crosses a gap of up to `gap` tiles (two spans). The line costs `cost` a tile (and the far Terminal its
 * own cost when it's new), paid from storage as the goods come in like a Viaduct, and a Worker standing at the near
 * Terminal builds it out, `time` seconds a tile, the pylons going up one by one and the far Terminal last. Pods
 * (`perLine` to a line, built at either Terminal's pod bay) carry BOTS.magpod.carry goods both ways, planned as a
 * Freight Train's loads are (railPlan: the far Terminal stocks what the buildings round it need, the home one keeps that
 * for the line, spare goods come home): a pod sets out once `fill` of its hold is worth it, sooner when the far side
 * runs low, or with at least `least` after `wait` s, dwelling `dwell` s at each end. Power: a Generator with Fuel in it
 * within its own radius of each Terminal (magPowered); without one at either end, or in a solar flare, the pods crawl at
 * WORKER_SPEED. A pylon shot down (a Wall's toughness) cuts the line: pods stop short and go back, one on the spans that
 * rested on it is lost; a Worker from the nearer Terminal rides out and rebuilds it in `repair` s at `spacing` tiles'
 * cost. The rival builds none (IDEAS.md).
 */
const MAGLEV = { min: 6, max: 40, spacing: 3, gap: 6, cost: { alloy: 1, chip: 0.5, cement: 1 }, time: 3, perLine: 4, fill: 0.5, wait: 60, least: 2, dwell: 2.5, repair: 20,
  deck: 0.343, head: 0.464, podFrame: 1.0 }; // (drawing: the deck top this far up the screen over a pylon's foot, a Terminal's dock over its tile centre, the pod's frame in tiles)
/**
 * The Mass Driver and its Catcher (BDEFS.mdriver, BDEFS.catcher): a coil-gun rail that throws sealed canisters of goods
 * in an arc over everything to a Catcher `min` to `max` tiles away (b.mdTo on the Driver: one Catcher per Driver, a
 * Catcher may take several). Both are storage. The Driver's goods list (b.mdSend: up to `goods` goods, each with the
 * reserve its colony keeps at home, `reserve` by default) is a standing supply order: Haulers bring it what the colony
 * holds beyond that reserve, up to `hopper` of each, and buildings touching it hand over their output by conveyor. A
 * full canister is `load` goods (a part load goes after `partWait` s with `partMin` or more); the coils charge for
 * `charge` s, then it fires, `reload` s between shots. The flight takes `flight` s at full range (`flightMin` at the
 * shortest), its arc `arc` tiles high at full range. Power: no Fuel of its own, but it fires only with a Generator
 * (with Fuel) within the Generator's radius (genPowered); without one it waits. A canister has `hp`: an enemy Flak Gun
 * can burst it in flight (a canister low over either end, the first and last `low` of its flight, is out of reach), and
 * its cargo falls as crates where it comes down; if the Catcher is gone when it lands, it lands anyway, as crates. None
 * in the Hollow (nothing flies under the cavern roof); the rival builds none (IDEAS.md).
 */
const MASSDRIVER = { min: 12, max: 30, goods: 3, reserve: 20, reserveStep: 10, reserveMax: 200, hopper: 24, load: 12, partWait: 30, partMin: 4, charge: 1.6, reload: 10,
  flight: 3, flightMin: 2, arc: 5, hp: 4, low: 0.1, feed: 1, muzzle: 0.55, catch: 0.42 }; // (drawing: the muzzle this far up the screen over the Driver's tile centre, the cradle over the Catcher's)
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
  pulse: { range: 4.5, damage: 4, reload: 1.6 }, // (a Pulse Turret: 5 tiles, 4 a shot, every 1.3 s)
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
const DEFENCE_TYPES = new Set(['turret', 'minigun', 'bunker', 'disruptor', 'mortar', 'flak', 'keep', 'wall', 'gate', 'silo', 'nukesilo', 'lance', 'dome']);
const RUNWAY_LEN = 5, ROLL_ACCEL = 0.42, ROLL_BRAKE = 0.75, PLANE_TURN = 1.1, PLANE_CLIMB = 3;
const AIR_EDGE = 1.5; // planes keep their turning spots this far inside the map's edge
const SECLUDED_REACH = 16; // warbots at a cut-off post (a Drop Outpost) only go this far from it: for repairs, rally flags and attacks
const FOOT_CARRY = 12;     // off the road network (a foothold dropped by air), Workers carry goods by hand between buildings this close
const BUILD_FAR = 16;      // a site doesn't call a Worker from further off than this while one close by (FOOT_CARRY) will soon be free
const TOPUP_NEAR = 10;     // seconds' walk: how far an idle Worker goes to top up its battery (a flat one goes as far as it must)
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
  { name: 'Standard', group: 'open', blurb: 'Open ground with hills, cliffs and resource fields between the bases.', w: 1, h: 1, ffa: true },
  { name: 'Long haul', group: 'open', blurb: 'A narrow planet with the bases far apart: built for long supply lines (trucks, Road Trains and rail).', w: 0.75, h: 1.7 },
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
  { name: 'Long Haul 2v2', group: 'open', blurb: 'For four, made for 2 vs 2: the long, narrow planet of Long haul made wider, two colonies side by side at each end and the richest fields strung along the long middle: a war of supply lines.', w: 1.2, h: 1.7, haul4: true, players: 4, minPlayers: 4, teamDefault: true, tip: 'Long Haul 2v2: two colonies side by side at each end of a long planet (in 2 vs 2 your ally lands beside you, the other team at the far end). The richest fields lie along the long middle, richer the further out you go, with a neutral Trade Post at the very centre and more down the middle line. Push Depots, Freight Trucks, Road Trains and rail up the map, and guard the line.' },
  // The Hollow (LORE.md): the Murmur's cavern lair under the Bloom, its own map with its own look (the biome 'hollow',
  // whatever the Biome setting) and always night. `murmur` and `alwaysNight` are read by the Murmur's night system.
  { name: 'The Hollow', group: 'heights', blurb: 'The Murmur\'s cavern lair, always night: caverns joined by passages and chasms, black lakes, the most Murmur nests of any planet, and daylight only down the breach shafts.', w: 1.15, h: 1.25, hollow: true, murmur: 'active', alwaysNight: true,
    tip: 'The Hollow: your base landed under a breach, a shaft of daylight down through the cavern roof; Ringfall only falls through the breaches, in rich drops. Nothing grows down here: Harvesters cut Fiber from the violet Bloom veins (which draws the Murmur), and Fuel comes from oil seeps. The richest Crystal hangs over the chasms: reach it by Ropeway or a bridge (Paths). No aircraft underground, and now and then the ceiling drops rock where dust trickles down.' },
  { name: 'Grand Canyon', group: 'heights', blurb: 'Two high rims overlook a winding river and a floor rich in Ore and Crystal. Switchbacks and side canyons offer different ways down.', w: 1.2, h: 1.4, grandCanyon: true, minLevels: 4, naval: true,
    tip: 'Grand Canyon: your colony starts on a high rim. Take the switchbacks or the trail through the side canyon down to the richest fields. Robots can wade at the fords, ships can sail along the river, and a Viaduct can cross the gorge at its narrows.' },
];
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
 *   nests     Murmur nest sites on each colony's side, Small to Huge, besides the Deep's mound at the centre
 *   deep      the Deep's mound (BDEFS mound): the level it starts at, guards on top of a nest's, and the hoard that
 *             spills out when it's wrecked; wrecking it knocks every other nest back to level 1 (see clearNest)
 *   relics    each crate in a side chamber's rows of robot parts: Alloy or Chips, between the two numbers
 */
const HOLLOW = {
  breach: { home: 3.2, open: 2.6 }, contested: 4,
  ringfall: { contested: 0.67, tiles: 4, rich: 1.5 },
  crystal: 2.5,
  nests: [4, 5, 6, 7],
  deep: { level: 3, guards: 3, loot: { crystal: 30, alloy: 20, chip: 10 } },
  relics: { alloy: [3, 5], chip: [1, 2] },
};
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
const RECALL_NO_LOOT = 60; // a warbot called home (Recall all, or its rally flag taken down) leaves crates be this long (see lootNear)
const CHOKE_BAND = 3;   // Chokepoint maps: rows of crags each side of the middle line
const CHOKE_APPROACH = 3; // ...and rows of open ground kept clear each side of the pass
const ISLE_GAP = 4;       // Islands maps: at least this much sea between islands (a wide sea: ships, or long, dear bridges)
const SKY_GAP = 1;        // Sky islands: canyons between mesas are narrower (short Viaducts)
const SKY_RES_MUL = 1.8;  // Sky islands: Ore, Crystal, Stalk and Stone hold this much more (half the fields fall in the canyons)
const HOME_STONE = 300;   // Islands and Sky islands: Stone each home island or mesa holds at the start (topped up near the base)
const LOOT_MAX = 500;     // most crates a wrecked or dismantled building spills of what was inside it
const LOOT_TIME = 300;    // seconds a pile of crates on no-one's land lies before it rots away (on claimed land it stays)
const LOOT_KEEP = 1e9;    // ...or never, for crates that were always there (the Hollow's side chambers): its `until`
const CRATE_SAFE = 6;     // haulers collect crates on their own land only with no enemy robot (or gun) within this many tiles
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
const SORTIE_ARMOR = 0.25;
const SORTIE_REACH = 6.5; // guards out on a sortie fight enemies within this of their garrison
// A guard out on a sortie gives up a foe that is more than this many tiles from the fort (or the building) it defends.
const SORTIE_LEASH = 9;
// Area defence (garrisonDefense): a fort with nobody at its own walls sends guards to a building of its owner's that
// enemy warbots are shooting at within AREA_DEFENCE tiles; they come home once it has been quiet AREA_QUIET seconds.
const AREA_DEFENCE = 14, AREA_QUIET = 6;
const DEFAULT_SIZE = { versus: 1, colony: 3 };
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
const NUKE = { parts: { fissile: 6, alloy: 4, chip: 2 }, assemble: 60, range: 40, flight: 30, radius: 6, scorch: 240, direct: 2 }; // direct: a Command Base this near the impact is destroyed
const EVAC_MARGIN = 1.5; // an evacuation clears this much beyond the blast radius

/*
 * Megastructures (the Megastructures setting on game setup, on by default; missions keep their own: megaOn). Late-game,
 * one per colony, slow to build and seen by everyone.
 *
 * The Lance of Corvane (BDEFS.lance): a 3 x 3 gun pit, a long barrel on a slow turntable. Aim it (its panel, then a
 * spot anywhere) and it charges for `charge` s, then fires a beam in a straight line from the gun through that spot to
 * the map's edge, `width` tiles wide: every building on the line is wrecked (a Command Base or Keep drops to its
 * Missile floor), every robot on it dies, whosever it is, Walls are breached, water boils to steam, and a scorched
 * trench is carved for good (S.cuts; on War scars the ground under it burns to ash and the animals there die). It fires
 * only with power: at least `gens` Generators with Fuel within `reach` tiles of it, burning a Fuel every `genFuel` s
 * each while it charges, or a Nuclear Reactor there with `uranium` Uranium (or an Enriched Uranium) in it, taken as the charge starts. While it
 * charges its colony's lights dim and its factories work `slow` slower; wreck its power and the charge is lost. A dust
 * storm holds the shot (it waits, charged, until the storm blows over). `reload` s after a shot it can charge again. A
 * Shield Dome on the line takes the whole shot and drops. Charging draws the Murmur (chargeWorth). Not in the Hollow
 * (no line of fire under the cavern roof); allowed on Argos.
 *
 * The Shield Dome (BDEFS.dome): a 2 x 2 emitter raising a dome `radius` tiles round its middle that stops what falls on
 * it from outside (domeCatch): Missiles, nuclear missiles, bombs and napalm, Ringfall, Howitzer and Mortar shells fired
 * from outside, rival Mass Driver canisters, rock from the Hollow's tremors, and a Lance shot. Robots walk in and guns
 * fire through. It has `max` strength; each hit costs `cost` of it (a nuclear missile or a Lance shot all of it); left
 * unhit for `quiet` s it recharges `regen` a second; at 0 it drops for `down` s and comes back at `back`. While up it
 * burns a Crystal every `crystal` s (Haulers bring them, `cap` at most) and needs a Generator with Fuel within `reach`
 * tiles: without either it's down.
 */
const LANCE = { charge: 90, reload: 240, gens: 2, reach: 4, genFuel: 30, uranium: 2, slow: 1 / 3, width: 0.8, warn: 20, beam: 2.5, glow: 45, cutsMax: 24 };
const DOME = { radius: 9, max: 100, quiet: 10, regen: 1, down: 60, back: 40, crystal: 20, cap: 6, reach: 4,
  cost: { missile: 25, nuke: 100, bomb: 10, napalm: 10, shell: 3, rocket: 3, canister: 3, meteor: 25, rock: 10, lance: 100 } };

// You (blue, COBALT), the rival (red), and in a free-for-all the green and purple rivals. Purple stands apart
// from the other three and from every biome's ground (gold would vanish on desert, savanna and lava).
const PLAYER_COLORS = ['#38d4ff', '#ff5a6e', '#5be06c', '#b36bff'];
const RIVAL_NAMES = ['Blue', 'Red', 'Green', 'Purple']; // (COBALT is blue, as LORE.md has it)
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
const BANNABLE = ['warbot', 'bulwark', 'torch', 'rocket', 'bomber', 'ferry'];

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
  if (G && ((G.mode === 'colony' && p === 1) || (G.wildlife && p === (G.wildOwner ?? 1)))) return the ? 'the Murmur' : 'Murmur';
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
    name: 'Outpost', desc: 'Holds a wide ring of land: your buildings inside it can\'t be cut off by a rival while it stands, and it\'s where you can put defences out in the open. Garrisons warbots for attack and defence. A road can run through it, for your own bots only: enemies have to break in.',
    cost: { cement: 4, fiber: 2 }, mil: true, terr: 7, garrison: 10, armor: 16, buildTime: 12, ammoStock: 6,
  },
  turret: {
    name: 'Pulse Turret', desc: 'Shoots enemy bots in range. Uses Crystal as ammo (4 shots each).',
    cost: { cement: 3, alloy: 3 }, ammo: 'crystal', range: 5, armor: 12, buildTime: 10, war: true,
    gun: { damage: 4, reload: 1.3 }, // (was 1.1 s: toned down a touch)
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
    name: 'Flak Gun', desc: 'A twin anti-aircraft gun. It fills the sky round enemy aircraft out to 7 tiles with bursting shells, leading them as they fly: each burst hurts any aircraft within about a tile of it. A plane can get through one quick pass, but not circling over a few of these. It bursts an enemy Mass Driver\'s canisters flying over too, when no aircraft is in reach. It can\'t hit anything on the ground. Fires Ammo (8 shells each).',
    cost: { cement: 4, alloy: 3 }, ammo: 'ammo', ammoCap: 4, range: 7, armor: 14, buildTime: 10, war: true,
    flak: { reload: 1.0, shells: 8, salvo: 2, damage: 4, splash: 1.0, speed: 14, scatter: 0.7 },
  },
  // The Minigun Nest (see MINIGUN): a cheap rotary gun that spins up and hoses enemy robots with tracer rounds.
  minigun: {
    name: 'Minigun Nest', desc: 'A cheap, short-range deterrent: a six-barrel rotary gun on an armoured mount. It spins up, then hoses the nearest enemy robot in the open within 3½ tiles with a stream of tracer rounds: each does little, but it fires twelve a second, and every robot it hits is pinned down (it moves at half speed and shoots slower for a moment). Great against swarms of workers, haulers and creatures; slower to bring down a warbot than a Pulse Turret. Fires Ammo (60 rounds each).',
    cost: { cement: 2, alloy: 1 }, ammo: 'ammo', ammoCap: 4, range: 3.5, armor: 12, buildTime: 6, war: true,
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
    name: 'Roadworks', desc: 'Its Paver upgrades your roads to asphalt, the fastest surface, working outwards along the roads you mark in Paths (Pave), however far along joined roads (or every joined road, if you choose). One Asphalt covers four tiles. It also lays Express lanes (Paths, Express): 1 Asphalt and a quarter Alloy a tile.',
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
    desc: 'Storage at one end of a Maglev line: a glass-sided transit hall built to the Accord\'s Phase 2 standard, with a dock at deck height on its roof. Build one, then plan the line in Paths (Maglev): tap this Terminal, then the far end 6 to 40 tiles away in any direction, straight across water, cliffs and chasms; a Worker builds it out pylon by pylon and the far Terminal goes up last. Order Maglev Pods on its panel (4 Alloy, 2 Chips each, four to a line): they carry 16 goods a trip at three times a Freight Train\'s speed. The two Terminals work like a railway\'s stations (the far one stocks what the buildings round it need and sends their spare goods home), and buildings touching a Terminal are joined to it by conveyor. Each Terminal needs a Generator within 4 tiles, or the pods crawl.',
    cost: { cement: 8, alloy: 6, chip: 3 }, store: true, magterm: true, armor: 14, buildTime: 14, yard: ['magpod'],
  },
  magpylon: {
    name: 'Maglev Pylon', short: 'Pylon',
    desc: 'A pylon carrying a Maglev guideway, every 3 tiles along the line. As tough as a Wall. Shot down, it cuts the line: pods stop short of the break and go back, and one on the spans it carried is lost; a Worker from the nearer Terminal rides out and rebuilds it. The guideway itself cannot be shot.',
    cost: { cement: 3, alloy: 3, chip: 1 }, pylon: true, armor: 24, buildTime: 20,
  },
  mdriver: {
    name: 'Mass Driver', short: 'Driver',
    desc: 'Storage at the breech of a coil-gun rail on a concrete ramp two tiles long (R turns it as you place it: east-west or north-south; it fires off whichever end faces its Catcher): it throws sealed canisters of 12 goods in an arc over everything, one every 10 seconds, to a Catcher 12 to 30 tiles away. On its panel, Aim at a Catcher, then tap one; then pick up to 3 goods to send. Haulers bring it what your colony holds of them beyond the reserve you set (20 to start), and buildings touching it hand it their output by conveyor. It burns no Fuel, but it fires only with a Generator within 4 tiles. An enemy Flak Gun can burst a canister in flight, and a canister with no Catcher to land in still lands: either way its goods fall as crates.',
    cost: { cement: 10, alloy: 8, chip: 4 }, store: true, mdriver: true, long: true, armor: 16, buildTime: 18,
  },
  catcher: {
    name: 'Catcher', desc: 'Storage under a wide funnel cradle whose four magnetic arms swing in to brake a Mass Driver\'s canister as it lands. What lands here is shared out like any Depot\'s stock: Haulers take it where it is needed, and buildings touching it are fed by conveyor. Aim a Mass Driver at it from the Driver\'s panel, 12 to 30 tiles away; one Catcher can take several Drivers.',
    cost: { cement: 6, alloy: 4, chip: 2 }, store: true, catcher: true, armor: 12, buildTime: 12,
  },
  // The megastructures (LANCE, DOME; the Megastructures setting: megaOn). Both stand on more than one tile (`foot`: a
  // square of foot x foot tiles from its own tile, east and south: footTiles).
  lance: {
    name: 'Lance of Corvane', short: 'Lance',
    desc: 'A planet-scale laser cannon: a long barrel on a turntable in a 3 by 3 gun pit. Tap Aim on its panel, then any spot on the map: it charges for 90 seconds (your colony\'s lights dim and its factories slow by a third, a glow climbs the barrel and everyone hears it), then fires a beam in a straight line from the gun through that spot right across the map. Everything on the line is destroyed, whoever it belongs to: buildings (a Command Base or Keep only drops to its floor, as with Missiles), robots, Walls; water boils to steam and the ground is scarred by a trench for good. It fires only with power: 2 Generators with Fuel within 4 tiles (they burn Fuel fast while it charges) or a Nuclear Reactor with 2 Uranium (or 1 Enriched Uranium) in it. Wreck its power and the charge is lost. A dust storm holds the shot; a Shield Dome on the line takes it. 4 minutes to reload. One per colony. Not in the Hollow.',
    cost: { cement: 40, alloy: 30, chip: 15, crystal: 10 }, lance: true, mega: true, foot: 3, armor: 70, buildTime: 240, war: true,
  },
  dome: {
    name: 'Shield Dome', short: 'Dome',
    desc: 'A 2 by 2 emitter that raises a faint blue dome 9 tiles round it. It stops what falls on it from outside: Missiles, nuclear missiles (it takes one and drops), bombs and napalm, Ringfall, Howitzer and Mortar shells, rival Mass Driver canisters, falling rock in the Hollow and one Lance shot. Robots walk straight in, and guns fire through it. It has 100 strength: a Missile takes 25, a bomb 10, a shell 3, a nuke or a Lance shot all of it. Left unhit for 10 seconds it recharges 1 a second; at 0 it drops, and comes back after a minute. While up it burns a Crystal every 20 seconds (Haulers bring them) and needs a Generator with Fuel within 4 tiles. One per colony.',
    cost: { cement: 30, alloy: 24, chip: 12, crystal: 20 }, dome: true, mega: true, foot: 2, ammo: 'crystal', ammoCap: 6, armor: 50, buildTime: 180, war: true,
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
    name: 'The Deep\'s Mound', desc: 'The largest Murmur nest of all, in the middle of the Hollow: somewhere inside it is the Deep, the heart of every nest down here. Heavily armored and full grown from the start, with the most on guard; its tunnels spread like any nest\'s. Wreck it with warbots and its hoard spills out, and every other nest in the Hollow falls back to its first level.',
    cost: {}, wild: true, armor: 160, buildTime: 1,
  },
  depot: {
    name: 'Depot', desc: 'Extra storage. Haulers drop goods at the nearest storage they can reach by road, so depots along your highways shorten trips. Give it supply orders to stock it from home: a forward base for building at the front. Far from your Command Base, with a Road Train that can drive to it, it stocks itself with what the buildings round it need, and the Road Train keeps it supplied.',
    cost: { fiber: 3, cement: 2 }, store: true, armor: 10, buildTime: 8,
  },
};

/** Order of the build menu. (Viaducts and Ropeways aren't in it: they're placed from Paths, like Ramps and Walls.) */
const BUILD_MENU = ['harvester', 'quarry', 'mine', 'tap', 'smelter', 'fab', 'foundry', 'charger', 'farm', 'pump', 'fueltank', 'refinery', 'generator',
  'kiln', 'tarworks', 'roadworks', 'station', 'magterm', 'mdriver', 'catcher', 'port', 'airfield', 'mast', 'outpost', 'turret', 'minigun', 'bunker', 'keep', 'disruptor', 'mortar', 'flak', 'repair', 'armory', 'munitions', 'silo', 'reactor', 'nukesilo', 'lance', 'dome', 'depot', 'grower', 'lab', 'terminal'];
/** Build-menu tabs: what each building is for. */
const BUILD_GROUPS = [
  { key: 'gather', name: 'Gather', types: ['harvester', 'quarry', 'mine', 'tap', 'grower', 'farm', 'pump', 'fueltank'] },
  { key: 'make', name: 'Make', types: ['kiln', 'smelter', 'fab', 'refinery', 'tarworks', 'foundry', 'armory', 'munitions', 'reactor', 'lab', 'generator'] },
  { key: 'move', name: 'Move', types: ['charger', 'depot', 'roadworks', 'station', 'magterm', 'mdriver', 'catcher', 'port', 'airfield', 'mast', 'terminal'], roads: true },
  { key: 'defend', name: 'Defend', types: ['outpost', 'turret', 'minigun', 'bunker', 'keep', 'disruptor', 'mortar', 'flak', 'repair', 'silo', 'nukesilo', 'lance', 'dome'], walls: true },
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
 * where it faces. A shot (or flame) from in front, at the Bulwark or at a robot of its owner's within `cover` tiles
 * behind the shield line, hits the shield instead: it soaks up to `shield` damage, comes back `regen` a second once
 * it's had `wait` s without a hit, and worn right down it fails for `down` s, coming back at `reboot` of full.
 * Blasts from above (shells, bombs, missiles, fuel blasts) and fire from the side or behind get past it; a
 * Disruptor Tower's pulse drains `drain` off it. It turns (`turn` rad/s) to face the nearest threat. Its twin
 * blasters: `dmg` a shot every `reload` s.
 */
const BULWARK = { shield: 50, regen: 4, wait: 2.5, down: 6, reboot: 0.35, arc: 1.0, r: 0.5, cover: 2.1, turn: 2.6, dmg: 1, reload: 0.9, drain: 14, look: 6 };
/**
 * The Torch (BOTS.torch): every `tick` s while it has a target in reach (BOTS.torch.range) it sprays a cone `cone`
 * radians either side of its aim: `bot` damage to each enemy robot in it and `bld` to the building it's burning
 * (`fort` times that to defences and Walls/Gates). Its tank holds `tank` seconds of fire; a Fuel refills `perFuel`
 * seconds, from its owner's Command Base, a Depot or a Fuel Station.
 * Scorch the earth (its panel): a Torch whose tank is at least `scorchMin` full (nearly full: 90%, 10.8 of its 12 s)
 * walks to a patch of fertile soil, stands within `scorchReach` tiles of it and sprays its whole tank into it over
 * `scorch` s, scorching it for good (scorchSoil, as napalm does); then it goes to refill. A group given the order
 * takes a patch each, the tapped one and the nearest round it within `scorchSpread` tiles.
 */
const TORCH = { cone: 0.5, tick: 0.2, bot: 0.35, bld: 0.8, fort: 1.6, tank: 12, perFuel: 12, scorch: 3, scorchMin: 0.9, scorchReach: 1.3, scorchSpread: 3 };
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

/*
 * Rival doctrines (the code calls them personalities: `style` on a player, `PERSONALITIES` here). Every rival
 * Command AI has spent decades reading the same last order from home ("Hold position. Further instructions to
 * follow.") and settled into a doctrine (LORE.md, Rival command doctrines). The keys stay the old style words
 * (saves, missions, multiplayer settings and tests use them); players see `name`, the doctrine, with `plain`, the old
 * style word, beside it where it helps ("Warden (turtle)": docLabel).
 * Each scales the rival's difficulty settings: grace (when it starts attacking), threshold (warbots it gathers before
 * an attack), army (how fast its army grows; armyFrom, when it starts), raids (how often it raids; raidFirst, the
 * first raid; raidSize and raidKeep, how many go and stay home), econ (how fast its bots work). turrets, walls,
 * push (it marches only in one big push: aiPush), harass (raids that form up out of sight and go for the roads by its
 * rival's working buildings, attacks on unguarded economy: aiRaid) and missiles switch on its habits (see js/ai.js:
 * aiStyle, aiLevel, AI_FORT, aiMissilePlan). The Steward (balanced) plays the plain difficulty.
 * The words: noun and desc (the landing line: "Your rival is a Warden (turtle): it walls its base in..."), tag (a few
 * words, for the lobby's one-line note: "walls in, then comes late in force"), quote (a
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
    play: 'Grows a full economy and a steady army, and attacks once it has the warbots to beat what guards its target: often 6 to 15 minutes in (on Normal). Now and then a band of three raids your roads. It defends with up to three Pulse Turrets, a Minigun Nest or Bunker at the front, a Keep later on and, half the time, a Wall on the side facing you. Later come bombers and Missiles.',
    weak: 'No great strength and no great weakness: a fair first opponent.',
    // What it says to you (doctrineVoice): when it attacks, launches a Missile and surrenders. {day}: see wardenDay.
    voice: {
      attack: ['Arrival window remains open. Please clear the survey corridor.', 'This action has been logged for review by the Accord tribunal.',
        'Survey corridors are to be kept clear under the Accord. Clearing.', 'We regret the necessity. Please stand aside.'],
      missile: ['Ordnance released under protest. This has been logged.', 'The Accord permits the removal of obstructions. Removing.',
        'Please take shelter. The tribunal has been notified.'],
      surrender: ['Please tell the colonists the roads are finished.', 'We yield, under protest. The tribunal will hear of this.'],
    },
  },
  turtle: {
    name: 'Warden', plain: 'turtle', noun: 'a Warden', desc: 'walls its base in and covers its land with turrets, then comes late with a big army',
    tag: 'walls in, then comes late in force',
    quote: 'Position held. Day 12,054.',
    play: 'Fortifies first: an early Pulse Turret, then more, up to six. From about 6 to 10 minutes in (on Normal) it rings its Command Base with Walls (Gates on its roads) and starts the first of up to three Keeps. It rarely raids and never builds bombers. Its main attack waits for eight warbots or more and comes late, though a smaller band may go for an unguarded building or construction site sooner.',
    weak: 'Slow to grow and slow to strike. Out-grow it while it digs in, then burn through its Walls with Torches, shield your warbots with Bulwarks, or crack the shell with Missiles.',
    voice: {
      attack: ['Position held. Day {day}.', 'No one passes until relieved.', 'Perimeter extended. Day {day}.', 'Sentry line advancing. Hold.'],
      missile: ['Threat at the perimeter. Removing it.', 'Range confirmed. Firing. Day {day}.', 'Clearing the approach.'],
      surrender: ['Relief has not arrived.', 'Post abandoned. Day {day}. Relief has not arrived.'],
    },
    grace: 1.5, threshold: 1.5, army: 0.9, raids: 0.3, turrets: true, walls: true, push: true,
  },
  raider: {
    name: 'Salvager', plain: 'raider', noun: 'a Salvager', desc: 'sends small bands of warbots to cut your supply lines, again and again',
    tag: 'raids your roads, again and again',
    quote: 'Nothing\'s coming from home. Everything on the road is supply.',
    play: 'Hits convoys, not cities. Its army grows early and fast, and from about 5 minutes in (on Normal) it sends three warbots at your busiest unguarded road every minute or two, keeping none back: they shoot up Haulers and trucks, tear up the road and wreck what stands beside it. It attacks in force too, once it outnumbers what guards a target, with only two turrets and seldom a Wall at home.',
    weak: 'A thin home guard. Guard your roads with Outposts, turrets and warbots on rally flags; while its bands are out, its base is open.',
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
    play: 'Out-builds everyone: its bots work 15% faster, it adds Smelters and Chip Fabs, and later it docks a Trade Terminal at a Trade Post. Its army is smaller. Once its economy is running (two Outposts, its Bot Foundry, a few warbots and workers to spare: usually 8 to 16 minutes in, on Normal) it builds a Missile Factory, then up to three Silos. Up to four turrets guard its base.',
    weak: 'Its army is thin early on. Hit it before its Silos are ready (or capture them), and spread your buildings out so one strike can\'t take many.',
    voice: {
      attack: ['I\'ve paved more road this year than your Sponsor did in a century.', 'When the colonists come, they\'ll find a city. Mine.',
        'Your layout is inefficient. Allow me.', 'Zoning review complete. You are not in the plan.'],
      missile: ['Beginning urban renewal.', 'Clearing the lot. Something better is coming.', 'Permit issued. Applicant: me.'],
      surrender: ['Very well. Mind the paving. It\'s mine.', 'Keep the city. You\'ll never finish it.'],
    },
    grace: 1.15, army: 0.9, missiles: true, econ: 1.15,
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
  captured: 'Command authority transferred. Their robots report for duty.',
  // (a rival's Command Base taken by another rival, in a free-for-all: {by} and {old} are callsigns, or people's names)
  changed: 'Command core changed hands. {old}\'s robots now report to {by}.',
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
  dome: 'Weather shield for the arrival district. Rated for storms. Used for everything else.',
  catcher: 'A canister every ten seconds, around the clock, for settlements still on the drawing board.',
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
  scuttler: 'No robot has ever logged one alone.',
  brute: 'Drawn to charge. Batteries, power lines and Crystal all read as food.',
  leech: 'The lights dim as it drinks. Logged as a fault, three times, before anyone looked.',
  spitter: 'The residue is conductive. The Lab would like a sample that is not still moving.',
  sapper: 'The Walls were rated for anything that comes over them.',
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

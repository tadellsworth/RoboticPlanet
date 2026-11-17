'use strict';
/*
 * Terrafall — the mission campaign, which is also the tutorial: it starts with the very basics and, chapter by
 * chapter, teaches every part of the game. Missions are on hand-picked planets, each with its own goals, starting
 * conditions and hand-placed features, and three difficulty levels (Easy / Normal / Hard: bigger goals, tighter
 * clocks, tougher rivals). Every mission is open from the start; finishing one ticks it off at that difficulty, and
 * the Missions list marks the first one not yet finished as Next up.
 *
 * The campaign is in seven chapters, played in this order: First Steps (one idea at a time: a building and its road,
 * Stone and Cement, batteries, the first Alloy), Growing the Colony (bots, farmed Fuel, regrowing groves, Outposts),
 * Roads and Traffic, Industry and Trade, Sea and Sky (all in Colony games, so the economy is learned in peace), then
 * First Contact (the Murmur's nests, a rival to practise on, a border war, a chokepoint to hold) and War. From the second
 * mission on, setup puts down the colony the earlier missions taught (`kit`), so each one is spent on its new idea.
 *
 * A mission: { id (progress is saved by it: keep it when a mission is reworked), name, chapter (the list's heading:
 * a chapter's missions sit together, in order), brief (two sentences at most), intro: [up to 5 lines for the briefing
 * card], mode, seed, size, rough, rich, biome, shape, players, style (the rival's doctrine, a PERSONALITIES key), rival: [easy, normal,
 * hard] (its level), rivalBonus (extra of every good in its Command Base), passive: [easy, normal, hard] (a rival that
 * never attacks), limit (minutes per difficulty, 0 none), nuke/war/lab/events/wildlife (switch on what missions
 * otherwise leave out: a Nuclear race, warbots and defences in Colony, the Research Lab, planet events, creature
 * nests), layout(m, W) (edits the generated map), setup(S, diff) (after the landing; S.mission already exists), goals
 * (1 to 4, met in any order, shown one at a time as the next goal) }.
 * A goal: { kind, n (one number or [easy, normal, hard]), hint (how to do it, shown while it's the next goal: the
 * real button names in <b> and keys in <kbd>), ui (CSS selector of the button(s) to light up meanwhile; when none is
 * on screen the button that opens them lights up, and for a panel button a ring pulses on the building to tap: `at`,
 * a building type, or the one the hint names), text (its own objective text, "{n}" for the number, or [one, many] to
 * pick by the number), hold (it must still hold at the end: a goal once met otherwise stays met), wait (for a `built`
 * goal: the hint while its site goes up, else a stock one says to wait, or to Lay road to a site with none) }.
 * Goal kinds the game counts by itself:
 *   built     have `n` finished buildings of `type`
 *   made      produce `n` of `good` over the mission (not starting stock or goods a setup adds)
 *   bots      build `n` new bots (any type, or `type`) at the Foundry or a yard (not the ones you start with)
 *   own       have `n` bots of `type` at once
 *   paths     have `n` road tiles of surface `tier` or better (1 road, 2 asphalt)
 *   oneway    have `n` one-way road tiles
 *   lights    have `n` traffic lights up
 *   land      claim `n` percent of the land
 *   outposts  capture `n` rival Outposts (or other garrisons)
 *   capture   capture the rival Command Base (the capture lock below keeps it for last)
 * Any other kind is a name for a goal that counts itself with `count(P, S)` (P is player 0) and has its own `text`:
 * placed, linked, moved, bridges, ramps, research, line, trades, nests, looted, survive, nukes and so on.
 *
 * Helpers: for layout, mapTiles, placeField, placeFertile and mirrored (both sides alike in Versus); for setup,
 * preBuild (one finished building, road-joined if asked) and kit(S, types, workers) (the colony so far: KIT6 is
 * gathering, Cement, a Fuel Station, Alloy, Chips and the Bot Foundry, KIT7 adds a Bio Farm); for counts, ownTiles.
 * The capture lock (captureLocked): while any other goal is open, the last rival's Command Base can't be taken, so a
 * mission is never lost by winning too soon.
 */

const CAMPAIGN_KEY = 'botfall.campaign';
const MISSION_DIFFS = ['easy', 'normal', 'hard'];
const MISSION_DIFF_NAMES = ['Easy', 'Normal', 'Hard'];

/* --- hand-placed features: helpers that edit a freshly generated map (generateMap's output) --- */

function mapTiles(m, W, cx, cy, r, fn) {
  const H = m.terrain.length / W;
  for (let j = Math.floor(cy - r); j <= Math.ceil(cy + r); j++) {
    for (let i = Math.floor(cx - r); i <= Math.ceil(cx + r); i++) {
      if (i < 1 || j < 1 || i >= W - 1 || j >= H - 1 || dist2(i, j, cx, cy) > r * r) continue;
      const t = j * W + i;
      // Keep landing zones clear.
      if (m.bases.some((b) => dist2(i, j, b.x, b.y) < 12)) continue;
      fn(t, i, j);
    }
  }
}

/** Scatter a resource field on open ground (fill = share of tiles that get a node). */
function placeField(m, W, cx, cy, r, type, fill, seed) {
  mapTiles(m, W, cx, cy, r, (t, i, j) => {
    if (m.terrain[t] !== T_GROUND || m.ramp[t] || hash2(i, j, seed || 77) > fill) return;
    m.res[t] = type; m.amt[t] = RES[type].amount; m.grow[t] = 1; m.fert[t] = 0;
  });
}

function placeFertile(m, W, cx, cy, r) {
  mapTiles(m, W, cx, cy, r, (t) => { if (m.terrain[t] === T_GROUND && !m.ramp[t] && !m.res[t]) m.fert[t] = 1; });
}

/**
 * For a mission's setup: a finished `type` for `owner` on the nearest open spot to (x, y) it may stand on (within
 * `reach` tiles), joined to the owner's roads by finished road when `road` is set. Returns the building, or null.
 */
function preBuild(owner, type, x, y, opts) {
  const o = opts || {}, reach = o.reach || 12;
  for (let r = 0; r <= reach; r++) {
    for (let j = y - r; j <= y + r; j++) for (let i = x - r; i <= x + r; i++) {
      if (Math.max(Math.abs(i - x), Math.abs(j - y)) !== r || !inMap(i, j) || !canPlace(owner, type, i, j).ok) continue;
      const b = addBuilding(owner, type, i, j, true);
      if (o.stock) for (const g in o.stock) b.stock[g] = (b.stock[g] || 0) + o.stock[g];
      if (o.road) { const route = roadRouteTo(owner, b) || []; for (const t of route) setRoad(t % S.W, (t / S.W) | 0, true, owner); }
      return b;
    }
  }
  return null;
}

/** The same feature at (x, y) and at its mirror image, so both sides stay fair in Versus. */
function mirrored(W, H, x, y, fn) { fn(x, y); fn(W - 1 - x, H - 1 - y); }

/** The colony the first chapters have taught (kit's usual lists): gathering, Cement, a Fuel Station, Alloy, Chips, bots; KIT7 adds a Bio Farm. */
const KIT6 = ['harvester', 'quarry', 'kiln', 'charger', 'mine', 'tap', 'smelter', 'fab', 'foundry'];
const KIT7 = [...KIT6, 'farm'];

/**
 * For a mission's setup: the colony the player has built so far. Each building of `types`, finished, where the rival
 * AI would put it (aiFindSpot), joined to the roads (a Fuel Station with 4 Fuel in it); a type with no spot is
 * skipped. Then `workers` more Workers in the Command Base (they count as the colony's start, not as bots made).
 * Returns the buildings it put down, by type.
 */
function kit(S, types, workers) {
  const P = S.players[0], L = getE(P.lander), out = {};
  for (const type of types) {
    const s = aiFindSpot(0, type, L);
    if (!s) continue;
    const b = preBuild(0, type, s.x, s.y, { road: true, reach: 3, stock: type === 'charger' ? { fuel: 4 } : null });
    if (b) out[type] = b;
    computeTerritory();
  }
  for (let k = 0; k < (workers || 0); k++) enterBuilding(addBot(0, 'worker', L.x, L.y), L);
  P.stats.startBots = P.stats.bots;
  return out;
}

/**
 * For goals: how many tiles pass test(t) and are player 0's. A tile with road or track on it counts when that way is
 * player 0's (wayOwner); one with neither (pipe, say) counts on the test alone, so a pipe test says whose it is
 * itself (S.pipe[t] === 1 is player 0's pipe).
 */
function ownTiles(test) {
  let n = 0;
  for (let t = 0, N = S.W * S.H; t < N; t++) if (test(t) && (S.road[t] || S.rail[t] ? wayOwner(t) === 0 : true)) n++;
  return n;
}

/* --- the campaign --- */

// (Every mission is on Rich resources: the amount it was made and balanced with, before resources were lowered a notch.)
const MISSIONS = [
  // Chapter 1, First Steps. One idea at a time: your first building and road, Stone and Cement, batteries, and the first Alloy.
  {
    id: 'touchdown', name: 'Touchdown', chapter: 'First Steps',
    brief: 'Your first landing. Place a Harvester by the stalk groves, join it to your roads and watch the Fiber come in.',
    intro: [
      'Drag to look around (with a mouse: right-drag or W A S D); pinch or scroll to zoom.',
      'A new building starts as a site: Haulers bring its materials from the Command Base, then a Worker builds it.',
      'Haulers only drive on roads, so every building needs a road to storage.',
      'Your goals sit at the top; the glowing button is the one to press next. Space pauses, H finds your base.',
      'The Fuel Station by your base keeps the robots charged. More on that soon.',
    ],
    mode: 'colony', seed: 1101, size: 0, rough: 0, rich: 3, biome: 'jungle', shape: 0, limit: [0, 0, 8],
    layout(m, W) {
      const b = m.bases[0];
      mapTiles(m, W, b.x, b.y, 10, (t) => { if (m.res[t] === R_STALK) { m.res[t] = 0; m.amt[t] = 0; } });
      placeField(m, W, b.x - 9, b.y - 4, 2.2, R_STALK, 0.8, 7);
    },
    setup(S) { kit(S, ['charger']); },
    goals: [
      { kind: 'placed', type: 'harvester', n: 1, text: 'Place a Harvester by the groves',
        count: (P, S) => S.buildings.filter((b) => !b.dead && b.owner === 0 && b.type === 'harvester').length,
        hint: '<b>Build</b> (<kbd>B</kbd>) → <b>Gather</b> (<kbd>1</kbd>) → <b>Harvester</b> (<kbd>H</kbd>). Tap a highlighted spot by the teal groves (left of base): <b>Build here</b>.',
        ui: "#btn-build, #build-tabs [data-g='gather'], .bcard[data-t='harvester'], #banner-ok" },
      { kind: 'linked', type: 'harvester', n: 1, text: 'Join the Harvester to your roads',
        count: (P, S) => S.buildings.filter((b) => !b.dead && b.owner === 0 && b.type === 'harvester' && b.unlinked === false).length,
        hint: 'Haulers only drive on roads. Tap the Harvester → <b>Lay road</b> (<kbd>R</kbd>): Workers pave it for you.',
        ui: '#sh-layroad', at: 'harvester' },
      { kind: 'made', good: 'fiber', n: [6, 8, 10],
        hint: 'A Hauler brings the materials, a Worker builds it, then Fiber comes in: tap the <b>Fiber</b> counter at the top.',
        ui: "#goods .res-chip[data-g='fiber']" },
    ],
  },
  {
    id: 'groundwork', name: 'Groundwork', chapter: 'First Steps',
    brief: 'Draw your first road in Paths, out to the grey boulders past your border. Then quarry their Stone and bake it into Cement.',
    intro: [
      'Nearly every building and every road is made of Cement, baked from Stone.',
      'The boulders lie past your border: this time draw the road out first, in Paths (R), then build at its end.',
      'Plans are paid as goods come in. In Paths, tap a road to take it up again, or drag along a planned one to call it off.',
      'When the boulders run out, a Quarry cuts Stone from crags and cliffs or digs it: it never runs dry.',
      'The 1× chip at the top (or ]) speeds time up; [ slows it. The game saves itself: Continue picks up where you left off.',
    ],
    mode: 'colony', seed: 1202, size: 0, rough: 0, rich: 3, biome: 'savanna', shape: 0, limit: [0, 0, 10],
    layout(m, W) {
      const b = m.bases[0];
      mapTiles(m, W, b.x, b.y, 12, (t) => { if (m.res[t] === R_BOULDER) { m.res[t] = 0; m.amt[t] = 0; } });
      placeField(m, W, b.x + 11, b.y - 8, 2.2, R_BOULDER, 0.75, 11);
    },
    setup(S) { kit(S, ['harvester', 'charger']); },
    goals: [
      // (Road first: with no building out there yet, there's no Lay road to do it for you. A planned tile counts.)
      { kind: 'roadto', text: 'Draw a road to the boulders',
        count: (P, S) => {
          for (let t = 0, N = S.W * S.H; t < N; t++) {
            if (!(S.road[t] ? wayOwner(t) === 0 : S.plan[t] === 1)) continue;
            const i = t % S.W, j = (t / S.W) | 0;
            for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) if (inMap(i + di, j + dj) && S.res[tIdx(i + di, j + dj)] === R_BOULDER) return 1;
          }
          return 0;
        },
        hint: '<b>Paths</b> (<kbd>R</kbd>): zoom out to see the grey boulders up and right, drag a road out to them, tap <b>Build</b>.',
        ui: "#btn-road, #banner-seg [data-v='road'], #banner-ok" },
      { kind: 'placed', type: 'quarry', n: 1, text: 'Place a Quarry by the boulders',
        count: (P, S) => S.buildings.filter((b) => !b.dead && b.owner === 0 && b.type === 'quarry').length,
        hint: '<b>Build</b> (<kbd>B</kbd>) → <b>Gather</b> (<kbd>1</kbd>) → <b>Quarry</b> (<kbd>Q</kbd>), by the boulders, touching your new road.',
        ui: "#btn-build, #build-tabs [data-g='gather'], .bcard[data-t='quarry'], #banner-ok" },
      { kind: 'built', type: 'kiln', n: 1,
        hint: '<b>Build</b> (<kbd>B</kbd>) → <b>Make</b> (<kbd>2</kbd>) → <b>Cement Works</b> (<kbd>K</kbd>), touching the Quarry and a road: a conveyor feeds it.',
        ui: "#btn-build, #build-tabs [data-g='make'], .bcard[data-t='kiln']" },
      { kind: 'made', good: 'cement', n: [8, 10, 14],
        hint: 'Each Stone bakes into 2 Cement; a road costs 1 Cement for 5 tiles. The <b>1×</b> chip (<kbd>]</kbd>) speeds time up.',
        ui: "#goods .res-chip[data-g='cement'], #btn-speed" },
    ],
  },
  {
    id: 'recharge', name: 'Recharge', chapter: 'First Steps',
    brief: 'Robots run on batteries. Build a Fuel Station to charge them, then dig Ore and tap Crystal.',
    intro: [
      'Robots run on batteries, and the Command Base can\'t charge them.',
      'Low robots look for a Fuel Station; drained ones work at half speed.',
      'Fuel is a liquid: your Tanker carries it to the Fuel Station, not the Haulers.',
      'Then find Ore (dark veins) and Crystal (violet clusters) for the machines to come.',
      'The robot counter (U) shows what every robot is doing; Show workers marks them on the map.',
    ],
    mode: 'colony', seed: 1303, size: 0, rough: 1, rich: 3, biome: 'polar', shape: 0, limit: [0, 0, 12],
    setup(S) { kit(S, ['harvester', 'quarry', 'kiln']); getE(S.players[0].lander).stock.fuel += 20; },
    goals: [
      { kind: 'built', type: 'charger', n: 1,
        hint: '<b>Build</b> (<kbd>B</kbd>) → <b>Move</b> (<kbd>3</kbd>) → <b>Fuel Station</b> (<kbd>F</kbd>), touching a road near the work.',
        ui: "#btn-build, #build-tabs [data-g='move'], .bcard[data-t='charger']" },
      { kind: 'built', type: 'mine', n: 1,
        hint: '<b>Build</b> (<kbd>B</kbd>) → <b>Gather</b> (<kbd>1</kbd>) → <b>Ore Mine</b> (<kbd>M</kbd>) by the dark ore veins above your base, joined to your roads.',
        ui: "#btn-build, #build-tabs [data-g='gather'], .bcard[data-t='mine']" },
      { kind: 'built', type: 'tap', n: 1,
        hint: '<b>Build</b> (<kbd>B</kbd>) → <b>Gather</b> (<kbd>1</kbd>) → <b>Crystal Tap</b> (<kbd>C</kbd>) by the violet crystals above your base, with a road.',
        ui: "#btn-build, #build-tabs [data-g='gather'], .bcard[data-t='tap']" },
      { kind: 'made', good: 'ore', n: [8, 10, 14],
        hint: 'Tap the <b>Ore</b> counter for the <b>Goods</b> panel (<kbd>Y</kbd>): on hand, made, used. Mine idle? Tap it → <b>Call a worker</b>.',
        ui: "#goods .res-chip[data-g='ore'], #sh-callw" },
    ],
  },
  {
    id: 'hotmetal', name: 'Hot Metal', chapter: 'First Steps',
    brief: 'Move a Cement Works that landed in the wrong place, then smelt your first Alloy beside an Ore Mine.',
    intro: [
      'Alloy is the metal for machines: a Smelter melts Ore with Fiber.',
      'Buildings side by side pass goods by conveyor, with no Hauler, and work a tenth faster while fed.',
      'While you place a building, green arrows show the conveyor links it would make.',
      'Most finished buildings can be moved for free: the old one keeps working until the new one stands.',
      'Statistics (I) shows what you make and how busy your buildings are; Pause (P) on a building\'s panel stops it.',
    ],
    mode: 'colony', seed: 1404, size: 0, rough: 1, rich: 3, biome: 'volcanic', shape: 0, limit: [0, 0, 12],
    // (An ore field on the base's level, so the Ore Mine and a Smelter beside it work at a fair pace.)
    layout(m, W) { const b = m.bases[0]; placeField(m, W, b.x - 5, b.y - 6, 1.7, R_ORE, 0.85, 3); },
    setup(S) {
      const k = kit(S, ['harvester', 'quarry', 'charger', 'mine', 'tap']), L = getE(S.players[0].lander), q = k.quarry;
      // The Cement Works that landed in the wrong place: across the Command Base from the Quarry.
      if (q) preBuild(0, 'kiln', 2 * L.x - q.x, 2 * L.y - q.y, { road: true, reach: 4 });
      L.stock.fuel += 20;
    },
    goals: [
      { kind: 'moved', n: 1, text: 'Move the Cement Works beside the Quarry', at: 'kiln',
        count: (P, S) => ((P.stats.moved || 0) > 0 && S.buildings.some((b) => !b.dead && b.owner === 0 && b.built && b.type === 'kiln' && touching(b).some((c) => c.type === 'quarry')) ? 1 : 0),
        hint: 'Tap the Cement Works → <b>Move</b> (<kbd>M</kbd>), then a free spot touching the Quarry → <b>Build here</b>. It\'s free.',
        ui: '#sh-move' },
      { kind: 'beside', n: 1, text: 'Build a Smelter beside the Ore Mine',
        count: (P, S) => {
          const fed = new Set();
          for (const m of S.buildings) if (!m.dead && m.owner === 0 && m.type === 'mine') for (const l of feedTargets(m)) if (l.c.type === 'smelter') fed.add(l.c.id);
          return fed.size;
        },
        hint: '<b>Build</b> (<kbd>B</kbd>) → <b>Make</b> (<kbd>2</kbd>) → <b>Smelter</b> (<kbd>M</kbd>), touching the Ore Mine and a road.',
        ui: "#btn-build, #build-tabs [data-g='make'], .bcard[data-t='smelter']" },
      { kind: 'made', good: 'alloy', n: [8, 12, 16],
        hint: '2 Ore and 2 Fiber make 3 Alloy. Tap the Smelter: its panel says <b>Fed by conveyor</b>, from the Ore Mine.',
        ui: "#goods .res-chip[data-g='alloy']" },
    ],
  },

  // Chapter 2, Growing the Colony. Bots that build bots, Fuel from farms, groves that regrow, and Outposts that push the border out.
  {
    id: 'assembly', name: 'Assembly Line', chapter: 'Growing the Colony',
    brief: 'Bots make bots. Etch Chips, build a Bot Foundry and order your first new robots.',
    intro: [
      'The <b>Bot Foundry</b> builds robots from Alloy and Chips, one round of parts at a time.',
      'A <b>Chip Fab</b> etches Crystal onto Alloy to make the Chips.',
      'The Foundry builds only what you order. Two Workers are always kept free for building.',
      'On a computer, <kbd>Shift</kbd>+<kbd>F</kbd> opens its <b>Order bots</b> list from anywhere.',
      'At most 6 building sites at once; a colony holds up to 150 robots.',
    ],
    mode: 'colony', seed: 2203, size: 0, rough: 2, rich: 3, biome: 'desert', limit: [0, 0, 15],
    setup(S) {
      kit(S, ['harvester', 'quarry', 'kiln', 'charger', 'mine', 'tap', 'smelter'], 3);
      getE(S.players[0].lander).stock.fuel += 20;
    },
    goals: [
      { kind: 'built', type: 'fab', n: 1,
        hint: '<b>Build</b> (<kbd>B</kbd>) → <b>Make</b> (<kbd>2</kbd>) → <b>Chip Fab</b> (<kbd>F</kbd>), touching the Smelter and a road: a conveyor feeds it Alloy.',
        ui: "#btn-build, #build-tabs [data-g='make'], .bcard[data-t='fab']" },
      { kind: 'built', type: 'foundry', n: 1,
        hint: '<b>Build</b> (<kbd>B</kbd>) → <b>Make</b> (<kbd>2</kbd>) → <b>Bot Foundry</b> (<kbd>U</kbd>). In a hurry? Tap its site → Priority: <b>High</b>.',
        wait: 'Your Bot Foundry is going up. In a hurry? Tap its site → Priority: <b>High</b>: it gets its materials and builder first.',
        ui: "#btn-build, #build-tabs [data-g='make'], .bcard[data-t='foundry'], #sh-prio [data-v='high']" },
      { kind: 'bots', n: [3, 4, 6],
        hint: 'Tap the Bot Foundry → <b>Order bots</b>: Workers <b>+1</b>, Haulers <b>+1</b>. The arrows set what it builds first.',
        ui: "#sh-orders .order-row[data-k='worker'] [data-d='1'], #sh-orders .order-row[data-k='hauler'] [data-d='1']" },
      { kind: 'stocked', n: [15, 15, 20], text: 'Have {n} Chips in store', count: () => goodTotal(0, 'chip'), at: 'fab',
        hint: 'The Fab rests at 10 Chips: its <b>stock limit</b>. Tap the Chip Fab → Stock limit <b>+</b> to raise it.',
        ui: '#sh-lim-plus' },
    ],
  },
  {
    id: 'greenfuel', name: 'Green Fuel', chapter: 'Growing the Colony',
    brief: 'The landing burned your Fuel and the Fuel Station is running dry. Grow Fuel with Agribots, and plant groves that regrow.',
    intro: [
      'Fuel Stations burn <b>Fuel</b>, and this landing left you almost none.',
      'An <b>Agribot</b> runs a Bio Farm: it grows Fuel crops on dark fertile soil.',
      'A <b>Grove Planter</b>\'s Agribot plants stalk groves that regrow, so Fiber never runs out.',
      'A Bio Farm or a Grove Planter runs only with its own Agribot, and you landed with one.',
    ],
    mode: 'colony', seed: 3307, size: 1, rough: 1, rich: 3, biome: 'jungle', limit: [0, 0, 20],
    layout(m, W) { const b = m.bases[0]; placeFertile(m, W, b.x + 7, b.y - 3, 2.2); placeFertile(m, W, b.x - 8, b.y - 5, 1.8); },
    setup(S, diff) {
      const k = kit(S, KIT6, 4);
      getE(S.players[0].lander).stock.fuel = [6, 3, 0][diff];
      if (k.charger) k.charger.stock.fuel = 0;
    },
    goals: [
      { kind: 'built', type: 'farm', n: 1,
        hint: '<b>Build</b> (<kbd>B</kbd>) → <b>Gather</b> (<kbd>1</kbd>) → <b>Bio Farm</b> (<kbd>F</kbd>), by dark fertile soil. Your Agribot runs it.',
        ui: "#btn-build, #build-tabs [data-g='gather'], .bcard[data-t='farm']" },
      { kind: 'bots', type: 'agribot', n: 1,
        hint: 'Tap the Bot Foundry → <b>Order bots</b>: Agribots <b>+1</b>. The Grove Planter needs an Agribot of its own.',
        ui: "#sh-orders .order-row[data-k='agribot'] [data-d='1']" },
      { kind: 'built', type: 'grower', n: 1,
        hint: '<b>Build</b> (<kbd>B</kbd>) → <b>Gather</b> (<kbd>1</kbd>) → <b>Grove Planter</b> (<kbd>G</kbd>), beside your Harvester: its Agribot plants groves that regrow.',
        ui: "#btn-build, #build-tabs [data-g='gather'], .bcard[data-t='grower']" },
      { kind: 'made', good: 'fuel', n: [15, 20, 30],
        hint: 'Crops ripen in 45 s. More Fuel? A second <b>Bio Farm</b>, with its own Agribot. Only <b>Tankers</b> carry Fuel.',
        ui: "#goods .res-chip[data-g='fuel'], #build-tabs [data-g='gather'], .bcard[data-t='farm']" },
    ],
  },
  {
    id: 'frontier', name: 'Frontier', chapter: 'Growing the Colony',
    brief: 'The ore by your base is worked out. Clear the spent mine, push your border out with Outposts and mine the rich frontier.',
    intro: [
      'Your land is the tinted ground. You can also build up to 10 tiles past your roads and buildings.',
      'An <b>Outpost</b> claims a ring of land 7 tiles round it; other buildings claim a little.',
      'Deposits out past the border are richer. Tap one to see what it holds.',
      'A spent building says so on its panel. <b>Dismantle</b> gives back all its materials in crates.',
      'In Colony free play, claiming more of the land earns milestones. <b>M</b> shows or hides the minimap.',
    ],
    mode: 'colony', seed: 7101, size: 0, rough: 1, rich: 3, biome: 'savanna', limit: [0, 0, 20],
    // The ore round the landing is gone (and the two last veins behind the base): only the richer veins out past the
    // border are left.
    layout(m, W) {
      const b = m.bases[0];
      mapTiles(m, W, b.x, b.y, 13, (t, i, j) => { if (m.res[t] === R_ORE && (dist2(i, j, b.x, b.y) <= 121 || j > b.y)) { m.res[t] = 0; m.amt[t] = 0; } });
    },
    setup(S) {
      kit(S, ['harvester', 'quarry', 'kiln', 'charger', 'farm']);
      // The spent Ore Mine, where the starter ore was (addBuilding skips canPlace's ore-in-reach rule).
      const L = getE(S.players[0].lander);
      for (let r = 0, done = false; r <= 2 && !done; r++) {
        for (let j = L.y - 5 - r; j <= L.y - 5 + r && !done; j++) for (let i = L.x - 4 - r; i <= L.x - 4 + r && !done; i++) {
          if (Math.max(Math.abs(i - (L.x - 4)), Math.abs(j - (L.y - 5))) !== r || !inMap(i, j)) continue;
          const t = tIdx(i, j);
          if (S.terrain[t] !== T_GROUND || S.res[t] || S.bAt[t] || S.road[t] || S.ramp[t] || S.fert[t]) continue;
          const mine = addBuilding(0, 'mine', i, j, true);
          for (const u of roadRouteTo(0, mine) || []) setRoad(u % S.W, (u / S.W) | 0, true, 0);
          S.mission.spent = mine.id;
          done = true;
        }
      }
      computeTerritory();
    },
    goals: [
      { kind: 'dismantled', n: 1, text: 'Dismantle the spent Ore Mine', at: 'mine',
        // (Gone by Dismantle; or moved out to fresh ore, which clears it too and must not leave the goal stuck.)
        count: (P, S) => { const m = getE(S.mission.spent); return (!m || m.dead) && (P.stats.dismantled || P.stats.moved) ? 1 : 0; },
        hint: 'Tap the idle Ore Mine (nothing left in reach) → <b>Dismantle</b>, twice. Haulers bring the crates home.',
        ui: '#sh-demolish' },
      { kind: 'built', type: 'outpost', n: [1, 2, 3],
        hint: '<b>Build</b> (<kbd>B</kbd>) → <b>Defend</b> (<kbd>4</kbd>) → <b>Outpost</b> (<kbd>O</kbd>), out past your border toward the far ore. <b>Lay road</b> to it.',
        ui: "#btn-build, #build-tabs [data-g='defend'], .bcard[data-t='outpost']" },
      { kind: 'land', n: [20, 32, 38],
        hint: 'Put Outposts out past your border, well apart, for the most land. The <b>% land</b> chip at the top counts it.',
        ui: '#clock' },
      { kind: 'made', good: 'ore', n: [20, 30, 40],
        hint: '<b>Build</b> (<kbd>B</kbd>) → <b>Gather</b> (<kbd>1</kbd>) → <b>Ore Mine</b> (<kbd>M</kbd>), by the rich veins past the old border. <b>Lay road</b>.',
        ui: "#btn-build, #build-tabs [data-g='gather'], .bcard[data-t='mine'], #goods .res-chip[data-g='ore']" },
    ],
  },

  // Chapter 3, Roads and Traffic. Keep the Haulers moving: Depots, Route to, one-way lanes, lights, bridges, tunnels, Ramps and asphalt.
  {
    id: 'rushhour', name: 'Rush Hour', chapter: 'Roads and Traffic',
    brief: 'A Depot full of Stone landed far out and the roads are jamming. Join it up, add Haulers, then sort the traffic.',
    intro: [
      'A <b>Depot</b> is extra storage: Haulers drop goods at the nearest store they can reach.',
      'In Paths, <b>Route to</b> (Z) plans the cheapest road to wherever you tap.',
      'Haulers keep their distance, slow for oncoming traffic and give way at junctions.',
      'The <b>Traffic map</b> (T) colours the roads by how busy they are.',
      'One-way lanes, traffic lights and overpasses keep it all moving. Nobody turns on an overpass: its two roads just cross.',
    ],
    mode: 'colony', seed: 4409, size: 1, rough: 0, rich: 3, biome: 'autumn', shape: 0, limit: [0, 0, 20],
    setup(S) {
      // (The colony so far, with Green Fuel's Bio Farm and Grove Planter: without them a slow player runs out of Fuel
      // (bots at half speed) and Fiber (the kit's Harvester has ~36 in reach) before the mission is done.)
      kit(S, [...KIT6, 'grower'], 4);
      const L = getE(S.players[0].lander), P = S.players[0];
      // A Bio Farm on the fertile flats to the south-west (kit() would put it north, on the way to the far Depot).
      preBuild(0, 'farm', L.x - 14, L.y + 3, { road: true, reach: 4 });
      computeTerritory();
      enterBuilding(addBot(0, 'agribot', L.x, L.y), L); // (the Grove Planter's crew: the Bio Farm has the first)
      P.stats.startBots = P.stats.bots;
      L.stock.cement += 6;
      // The far Depot, with no road: as far out as a Depot may stand (11 tiles), north, east or west.
      for (let r = 11, done = false; r >= 8 && !done; r--) for (const [dx, dy] of [[0, -r], [r, 0], [-r, 0]]) {
        if (!canPlace(0, 'depot', L.x + dx, L.y + dy).ok) continue;
        const d = addBuilding(0, 'depot', L.x + dx, L.y + dy, true);
        d.stock.stone = 30;
        S.mission.depot = d.id;
        done = true;
        break;
      }
      computeTerritory();
    },
    goals: [
      { kind: 'linked', n: 1, text: 'Join the far Depot to your roads',
        count: (P, S) => { const d = getE(S.mission.depot); return d && !d.dead && d.owner === 0 && d.unlinked === false ? 1 : 0; },
        hint: '<b>Paths</b> (<kbd>R</kbd>) → <b>Route to</b> (<kbd>Z</kbd>), tap the Depot: the cheapest road is planned. Tap <b>Build</b>.',
        ui: '#btn-road, #banner-route, #banner-ok' },
      { kind: 'bots', type: 'hauler', n: [2, 3, 4], at: 'foundry',
        hint: 'Tap the Bot Foundry → <b>Order bots</b>: Haulers <b>+1</b>. More Haulers, busier roads.',
        ui: "#sh-orders .order-row[data-k='hauler'] [data-d='1']" },
      { kind: 'oneway', n: [8, 12, 16],
        hint: '<b>Paths</b> → <b>Arrows</b> (<kbd>O</kbd>): drag along a road to point it one way. Lay a second road back. <b>Traffic map</b> (<kbd>T</kbd>) shows jams.',
        ui: "#btn-road, #banner-seg [data-v='arrows'], #banner-traffic" },
      { kind: 'junctions', n: [2, 2, 3], text: 'Put lights on {n} junctions',
        count: (P, S) => Object.values(S.lights).filter((l) => l.owner === 0).length + Object.values(S.over).filter((o) => o.owner === 0).length,
        hint: '<b>Paths</b> → <b>Junctions</b> (<kbd>L</kbd>): tap a junction for a light (1 Alloy). Again on a crossing: an overpass (no turning).',
        ui: "#btn-road, #banner-seg [data-v='lights']" },
    ],
  },
  {
    id: 'crossings', name: 'Crossings', chapter: 'Roads and Traffic',
    brief: 'A pond, a crag and a ledge stand between you and fresh fields. Bridge, tunnel and Ramp your way to them.',
    intro: [
      'Lighter ground is higher. Robots can\'t climb a cliff; where it is one level high, a <b>Ramp</b> cuts a slope.',
      'Drag a road over water (or a chasm) and it is a <b>bridge</b>; into rock, a <b>tunnel</b>. Both cost more.',
      'Route to (Z) plans the cheapest way, Ramps and bridges included, but only to ground your bots can reach.',
      'Other planets: tides on Tidal flats, fords on River delta, a quake on Fault line, lava on Volcano.',
    ],
    mode: 'colony', seed: 5303, size: 1, rough: 2, rich: 3, biome: 'alien', shape: 0, limit: [0, 0, 20],
    layout(m, W) {
      const b = m.bases[0], lv = m.elev[b.y * W + b.x];
      // A pond to the north, its south shore along your border (so a drag north from any of your roads bridges it).
      for (let j = b.y - 11; j <= b.y - 8; j++) for (let i = b.x - 2; i <= b.x + 2; i++) {
        const t = j * W + i;
        m.terrain[t] = T_WATER; m.res[t] = 0; m.amt[t] = 0; m.fert[t] = 0; m.ramp[t] = 0; m.elev[t] = lv;
      }
      placeField(m, W, b.x, b.y - 15, 1.8, R_CRYSTAL, 0.8, 21);
      // A crag to the west, inside the border.
      for (let j = b.y - 4; j <= b.y + 1; j++) for (const i of [b.x - 7, b.x - 6]) {
        const t = j * W + i;
        m.terrain[t] = T_ROCK; m.res[t] = 0; m.amt[t] = 0; m.fert[t] = 0; m.ramp[t] = 0; m.elev[t] = lv;
      }
      // A ledge to the east, one level up, with no way up.
      mapTiles(m, W, b.x + 10, b.y - 4, 4, (t, i, j) => {
        m.terrain[t] = T_GROUND; m.ramp[t] = 0; m.res[t] = 0; m.amt[t] = 0; m.fert[t] = 0;
        m.elev[t] = dist2(i, j, b.x + 10, b.y - 4) <= 6.25 ? lv + 1 : lv;
      });
      placeField(m, W, b.x + 10, b.y - 4, 1.6, R_BOULDER, 0.9, 23);
    },
    setup(S) {
      // (The colony so far, with Green Fuel's Bio Farm and Grove Planter: without them a slow player runs out of Fuel
      // (bots at half speed) and Fiber (the kit's Harvester has ~36 in reach) before the mission is done.)
      kit(S, [...KIT7, 'grower'], 4);
      const L = getE(S.players[0].lander), P = S.players[0];
      enterBuilding(addBot(0, 'agribot', L.x, L.y), L); // (the Grove Planter's crew: the Bio Farm has the first)
      P.stats.startBots = P.stats.bots;
      L.stock.cement += 10; L.stock.alloy += 6;
      S.mission.ledge = { x: L.x + 10, y: L.y - 4 }; // (the layout's ledge: its top is 2.5 tiles across)
    },
    goals: [
      // (The pond is 4 rows deep, so 4 bridge tiles is the whole crossing, at every difficulty. Planned tiles count, as
      // in Groundwork: workers take a minute to build it, and meanwhile the hint mustn't ask for another.)
      { kind: 'bridges', n: 4, text: 'Bridge the pond',
        count: (P, S) => ownTiles((t) => (S.road[t] || S.plan[t] === 1) && (S.terrain[t] === T_WATER || S.terrain[t] === T_CHASM)),
        hint: '<b>Paths</b> → <b>Bridges</b> (<kbd>G</kbd>): drag a road from your base north, right across the pond.',
        ui: "#btn-road, #banner-seg [data-v='bridge']" },
      { kind: 'tunnels', n: 2, text: 'Bore 2 tunnel tiles',
        count: (P, S) => ownTiles((t) => (S.road[t] || S.plan[t] === 1) && S.terrain[t] === T_ROCK),
        hint: '<b>Bridges</b> (<kbd>G</kbd>) tunnels too: drag a road west straight through the dark crag in your land.',
        ui: "#btn-road, #banner-seg [data-v='bridge']" },
      // (A Ramp on or beside the ledge's top: one elsewhere on the map doesn't lead up to the Quarry spot.)
      { kind: 'ramps', n: 1, text: 'Build a Ramp up the ledge',
        count: (P, S) => {
          const L = getE(P.lander), lv = S.elev[tIdx(L.x, L.y)], c = S.mission.ledge;
          const top = (i, j) => inMap(i, j) && S.elev[tIdx(i, j)] === lv + 1 && dist2(i, j, c.x, c.y) <= 6.25;
          return ownTiles((t) => { const i = t % S.W, j = (t / S.W) | 0; return !!S.ramp[t] && (top(i, j) || top(i + 1, j) || top(i - 1, j) || top(i, j + 1) || top(i, j - 1)); });
        },
        hint: '<b>Paths</b> → <b>Ramps</b> (<kbd>V</kbd>): tap a lit spot at the foot or top of the low ledge to the east.',
        ui: "#btn-road, #banner-seg [data-v='ramp']" },
      { kind: 'highQuarry', n: 1, text: 'Build a Quarry up on the ledge',
        count: (P, S) => {
          const L = getE(P.lander), lv = S.elev[tIdx(L.x, L.y)], c = S.mission.ledge;
          return S.buildings.filter((b) => !b.dead && b.owner === 0 && b.built && b.type === 'quarry' && S.elev[tIdx(b.x, b.y)] > lv && dist2(b.x, b.y, c.x, c.y) <= 9).length;
        },
        hint: 'Up the Ramp: <b>Build</b> (<kbd>B</kbd>) → <b>Gather</b> (<kbd>1</kbd>) → <b>Quarry</b> (<kbd>Q</kbd>) by the boulders on top, and <b>Lay road</b>.',
        ui: "#btn-build, #build-tabs [data-g='gather'], .bcard[data-t='quarry']" },
    ],
  },
  {
    id: 'blacktop', name: 'Blacktop', chapter: 'Roads and Traffic',
    brief: 'Pump oil, cook Asphalt and send a Paver out: the fastest roads on the planet.',
    intro: [
      'Road doubles a robot\'s speed; <b>asphalt</b> is faster still, and trucks love it.',
      'An Oil Pump on a seep pumps Crude, a liquid: Tankers carry it. A road over a seep leaves the oil below.',
      'An Asphalt Plant cooks Crude with Cement; a Roadworks\' <b>Paver</b> lays it, 4 tiles per Asphalt.',
      'Busy asphalt wears out: the Paver resurfaces the roads it looks after.',
    ],
    mode: 'colony', seed: 5501, size: 1, rough: 2, rich: 3, biome: 'desert', shape: 0, limit: [0, 0, 20],
    layout(m, W) { const b = m.bases[0]; placeField(m, W, b.x + 5, b.y - 5, 1.2, R_OIL, 0.95, 9); },
    setup(S) {
      // (The colony so far, with Green Fuel's Bio Farm and Grove Planter: without them a slow player runs out of Fuel
      // (bots at half speed) and Fiber (the kit's Harvester has ~36 in reach) before the mission is done.)
      kit(S, [...KIT7, 'grower'], 4);
      const L = getE(S.players[0].lander), P = S.players[0];
      enterBuilding(addBot(0, 'agribot', L.x, L.y), L); // (the Grove Planter's crew: the Bio Farm has the first)
      P.stats.startBots = P.stats.bots;
      L.stock.cement += 10;
    },
    goals: [
      { kind: 'built', type: 'pump', n: 1,
        hint: '<b>Build</b> (<kbd>B</kbd>) → <b>Gather</b> (<kbd>1</kbd>) → <b>Oil Pump</b> (<kbd>P</kbd>), right on the dark oil seep by your base, and <b>Lay road</b>.',
        ui: "#btn-build, #build-tabs [data-g='gather'], .bcard[data-t='pump']" },
      { kind: 'built', type: 'tarworks', n: 1,
        hint: '<b>Build</b> (<kbd>B</kbd>) → <b>Make</b> (<kbd>2</kbd>) → <b>Asphalt Plant</b> (<kbd>T</kbd>), touching the Oil Pump (Crude flows straight in) and a road.',
        ui: "#btn-build, #build-tabs [data-g='make'], .bcard[data-t='tarworks']" },
      // (No #btn-build in ui, so with nothing open the coach lights Build and the Move tab and rings the Bot Foundry: both halves.)
      { kind: 'roadworks', n: 1, text: 'Build a Roadworks and a Paver', at: 'foundry',
        count: (P, S) => Math.min(S.buildings.filter((b) => !b.dead && b.owner === 0 && b.built && b.type === 'roadworks').length, S.bots.filter((u) => !u.dead && u.owner === 0 && u.type === 'paver').length),
        hint: '<b>Build</b> → <b>Move</b> (<kbd>3</kbd>) → <b>Roadworks</b> (<kbd>O</kbd>) by a road. Then tap the Bot Foundry → <b>Pavers +1</b>: you land with none.',
        ui: "#build-tabs [data-g='move'], .bcard[data-t='roadworks'], #sh-orders .order-row[data-k='paver'] [data-d='1']" },
      { kind: 'paths', tier: 2, n: [8, 14, 20],
        hint: '<b>Paths</b> → <b>Pave</b> (<kbd>E</kbd>): drag along busy roads to mark them. Or Roadworks → <b>Every joined road</b>.',
        ui: "#btn-road, #banner-seg [data-v='pave'], #sh-pmode [data-v='all']" },
    ],
  },

  // Chapter 4, Industry and Trade. Pipelines and power, research, far Depots and trucks, railways, Road Trains, trade and planet events.
  {
    id: 'pipeline', name: 'Pipe Dreams', chapter: 'Industry and Trade',
    brief: 'Refine Crude into Fuel, pipe it where it is needed and speed your factories up with a Generator.',
    intro: [
      'A <b>Refinery</b> turns Crude into Fuel, one for one. A full one explodes if it is destroyed.',
      '<b>Pipes</b> carry Crude and Fuel with no Tanker at all, for 0.3 Cement a tile.',
      'A <b>Generator</b> burns Fuel so factories within 4 tiles work a third faster. <b>Turn off</b> (P) saves Fuel.',
      'A Refinery stops once you have 30 Fuel, its stock limit: raise it with + on its panel.',
    ],
    mode: 'colony', seed: 6101, size: 1, rough: 1, rich: 3, biome: 'swamp', shape: 0, limit: [0, 0, 20],
    layout(m, W) { const b = m.bases[0]; placeField(m, W, b.x - 7, b.y - 7, 1.4, R_OIL, 0.95, 31); },
    setup(S) {
      kit(S, KIT6, 4);
      const L = getE(S.players[0].lander);
      preBuild(0, 'pump', L.x - 7, L.y - 7, { road: true, reach: 3 });
      L.stock.cement += 10;
    },
    goals: [
      { kind: 'built', type: 'refinery', n: 1,
        hint: '<b>Build</b> (<kbd>B</kbd>) → <b>Make</b> (<kbd>2</kbd>) → <b>Refinery</b> (<kbd>V</kbd>), by your base but not right beside it.',
        ui: "#btn-build, #build-tabs [data-g='make'], .bcard[data-t='refinery']" },
      { kind: 'crudePipe', n: 1, text: 'Pipe Crude to the Refinery', at: 'pump',
        count: (P, S) => {
          // Oil Pumps on the same pipeline as a finished Refinery.
          const net = pipeNet(), refs = new Set();
          for (const r of S.buildings) if (!r.dead && r.owner === 0 && r.built && r.type === 'refinery') for (const c of buildingPipes(r, net)) refs.add(c);
          return S.buildings.filter((b) => !b.dead && b.owner === 0 && b.type === 'pump' && buildingPipes(b, net).some((c) => refs.has(c))).length;
        },
        hint: 'Tap the Oil Pump → <b>Pipe it to the Refinery</b> (<kbd>K</kbd>), or lay your own: <b>Paths</b> → <b>Pipes</b>.',
        ui: '#sh-pipe' },
      { kind: 'fuelPipe', n: 1, text: 'Pipe Fuel to a Generator', at: 'generator',
        count: (P, S) => S.buildings.filter((b) => !b.dead && b.owner === 0 && b.type === 'generator' && b.fuelByPipe).length,
        hint: '<b>Build</b> → <b>Make</b> → <b>Generator</b> (<kbd>G</kbd>) among your factories, then tap it → <b>Pipe Fuel to it</b>.',
        // (No #btn-build here: it is always on screen, so it would always be what lights up and the Generator would
        // never get its ring. The coach lights Build by itself while the Make tab and card aren't showing.)
        ui: "#build-tabs [data-g='make'], .bcard[data-t='generator'], #sh-pipefuel" },
      { kind: 'made', good: 'fuel', n: [25, 40, 50], at: 'refinery',
        hint: 'Refinery stopped at 30 Fuel? Tap it → Stock limit <b>+</b>. Fuel Stations and Generators burn it.',
        ui: '#sh-lim-plus' },
    ],
  },
  {
    id: 'research', name: 'Breakthrough', chapter: 'Industry and Trade',
    brief: 'Build a Research Lab and research upgrades that help the whole colony.',
    intro: [
      'A <b>Research Lab</b> works on one upgrade at a time for the whole colony (Colony games only).',
      'An upgrade\'s cost leaves storage when it starts; Cancel gives it all back.',
      'Upgrades: bigger loads, longer-lasting batteries, faster paving, sharper turrets, faster motors and more.',
    ],
    mode: 'colony', seed: 1515, size: 0, rough: 1, rich: 3, biome: 'alien', shape: 0, lab: true, limit: [0, 0, 20],
    setup(S) {
      kit(S, KIT7, 4);
      const L = getE(S.players[0].lander);
      L.stock.crystal += 10;
      L.stock.chip += 4;
    },
    goals: [
      { kind: 'built', type: 'lab', n: 1,
        hint: '<b>Build</b> (<kbd>B</kbd>) → <b>Make</b> (<kbd>2</kbd>) → <b>Research Lab</b> (<kbd>L</kbd>). A Worker inside does the research.',
        ui: "#btn-build, #build-tabs [data-g='make'], .bcard[data-t='lab']" },
      { kind: 'research', tech: 'cargo', n: 1, text: 'Research Cargo Racks', at: 'lab',
        count: (P) => (P.tech && P.tech.cargo ? 1 : 0),
        hint: 'Tap the Lab → <b>Research</b> beside Cargo Racks: Haulers carry 3, trucks and trains more.',
        ui: "#sh-research button[data-k^='cargo']" },
      { kind: 'research', tech: 'cells', n: 1, text: 'Research Long-life Cells', at: 'lab',
        count: (P) => (P.tech && P.tech.cells ? 1 : 0),
        hint: 'Then <b>Research</b> Long-life Cells: batteries last longer. Short of Chips? Keep the Chip Fab busy.',
        // (Only the Lab's button: the Chips counter is always on screen, so with it here the coach lit that and never
        // rang the Lab.)
        ui: "#sh-research button[data-k^='cells']" },
      { kind: 'upgrades', n: [3, 3, 4], text: 'Finish {n} upgrades', at: 'lab',
        count: (P) => Object.keys(P.tech || {}).length,
        hint: 'Pick any you like at the Lab → <b>Research</b>. Two Labs (<kbd>L</kbd>) research twice as fast.',
        // (The Lab's Research buttons only: with Build in the list the coach always lit Build and never rang the Lab.)
        ui: '#sh-research .tech-foot button' },
    ],
  },
  {
    id: 'longhaul', name: 'Long Haul', chapter: 'Industry and Trade',
    brief: 'Rich ore lies far up a long valley. Set up a forward Depot, keep it stocked and send Freight Trucks.',
    intro: [
      'A long, narrow planet: the rich ore is a long drive up the valley.',
      'Haulers take runs under 12 tiles; <b>Freight Trucks</b> carry 8 goods on the long ones.',
      'Trucks burn Fuel and fill up at any store. A far store sends its spare goods home.',
      '<b>Supply orders</b> keep a Depot stocked from home, for building far out.',
    ],
    mode: 'colony', seed: 9401, size: 1, rough: 1, rich: 3, biome: 'autumn', shape: 1, limit: [0, 0, 30],
    layout(m, W) {
      const b = m.bases[0];
      mapTiles(m, W, b.x, b.y, 18, (t) => { if (m.res[t] === R_ORE) { m.res[t] = 0; m.amt[t] = 0; } });
      placeField(m, W, b.x, b.y - 22, 2.4, R_ORE, 0.75, 41);
    },
    setup(S) {
      kit(S, KIT7.filter((t) => t !== 'mine'), 4); // (no Ore near home: the Mine goes up the valley)
      const L = getE(S.players[0].lander);
      L.stock.cement += 10;
      L.stock.fuel += 10;
    },
    goals: [
      { kind: 'farDepot', n: 1, text: 'Build a Depot 12+ tiles out',
        count: (P, S) => { const L = getE(P.lander); return S.buildings.filter((b) => !b.dead && b.owner === 0 && b.built && b.type === 'depot' && Math.abs(b.x - L.x) + Math.abs(b.y - L.y) >= TRUCK_MIN_DIST).length; },
        hint: '<b>Paths</b> (<kbd>R</kbd>) → <b>Route to</b> (<kbd>Z</kbd>) up the valley, then <b>Build</b> → <b>Move</b> (<kbd>3</kbd>) → <b>Depot</b> (<kbd>E</kbd>) by the ore.',
        ui: "#btn-road, #banner-route, #btn-build, #build-tabs [data-g='move'], .bcard[data-t='depot']" },
      { kind: 'supplyOrder', n: 1, text: 'Set a supply order at a Depot', at: 'depot',
        count: (P, S) => S.buildings.filter((b) => !b.dead && b.owner === 0 && b.keep && !BDEFS[b.type].terminal && Object.values(b.keep).some((v) => v > 0)).length,
        hint: 'Tap the Depot → Supply orders: <b>+5</b> on Cement. Trucks keep it stocked from home.',
        ui: "#sh-keep .keep-cell[data-g='cement'] [data-d='5']" },
      { kind: 'bots', type: 'truck', n: [2, 2, 3], at: 'foundry',
        hint: 'Tap the Bot Foundry → <b>Order bots</b>: Freight Trucks <b>+1</b>. They take the runs of 12+ tiles.',
        ui: "#sh-orders .order-row[data-k='truck'] [data-d='1']" },
      { kind: 'made', good: 'ore', n: [30, 40, 60], at: 'depot',
        hint: '<b>Build</b> → <b>Gather</b> → <b>Ore Mines</b> (<kbd>M</kbd>) by the Depot. Its <b>Storage</b> (Fill first, Empty out) picks where goods go.',
        // (Not the Ore counter: always on screen, it was all that ever lit up. Now: Build → Gather → Ore Mine, and a ring
        // on the Depot for its Storage setting.)
        ui: "#build-tabs [data-g='gather'], .bcard[data-t='mine'], #sh-smode" },
    ],
  },
  {
    id: 'railway', name: 'Iron Road', chapter: 'Industry and Trade',
    brief: 'Lay track north to a far Crystal field and run a Freight Train between two stations.',
    intro: [
      '<b>Freight Trains</b> carry 56 goods a trip on their own track: no traffic jams.',
      'Put a <b>Rail Station</b> at each end and lay track between them.',
      'Buildings touching a station load and unload by conveyor; a far station stocks itself.',
      'Track bridges water, tunnels rock and Ramps low cliffs. In war, a train can be armored.',
    ],
    mode: 'colony', seed: 9601, size: 2, rough: 1, rich: 3, biome: 'lunar', shape: 0, limit: [0, 0, 30],
    layout(m, W) {
      const b = m.bases[0];
      mapTiles(m, W, b.x, b.y, 23, (t) => { if (m.res[t] === R_CRYSTAL) { m.res[t] = 0; m.amt[t] = 0; } });
      placeField(m, W, b.x - 3, b.y - 24, 2.4, R_CRYSTAL, 0.8, 51);
    },
    setup(S) {
      // (No Crystal near home: it comes by train. A Grove Planter keeps the Fiber coming: the groves here are few.)
      kit(S, KIT7.filter((t) => t !== 'tap').concat('grower'), 4);
      const L = getE(S.players[0].lander), P = S.players[0];
      enterBuilding(addBot(0, 'agribot', L.x, L.y), L); // (the Grove Planter's crew)
      P.stats.startBots = P.stats.bots;
      L.stock.cement += 20;
      L.stock.alloy += 10;
    },
    goals: [
      { kind: 'built', type: 'station', n: 1,
        hint: '<b>Build</b> (<kbd>B</kbd>) → <b>Move</b> (<kbd>3</kbd>) → <b>Rail Station</b> (<kbd>N</kbd>), on the north side of your base: the Crystal lies north.',
        ui: "#btn-build, #build-tabs [data-g='move'], .bcard[data-t='station']" },
      { kind: 'rail', n: [16, 18, 20], text: 'Lay {n} tiles of track',
        count: (P, S) => ownTiles((t) => S.rail[t]),
        hint: '<b>Paths</b> (<kbd>R</kbd>) → <b>Rail</b> (<kbd>N</kbd>) → <b>Route to</b> (<kbd>Z</kbd>): tap by the far Crystal, then <b>Build</b>.',
        ui: "#btn-road, #banner-seg [data-v='rail'], #banner-route, #banner-ok" },
      { kind: 'line', n: 1, text: 'Run a train between 2 stations', at: 'station',
        count: (P, S) => {
          // A Freight Train built, and two finished Rail Stations on the same track at least a truck run (12 tiles across
          // and down) apart: two stations side by side at home with a scrap of track between them don't make a line.
          const sts = S.buildings.filter((b) => !b.dead && b.owner === 0 && b.built && b.type === 'station');
          const far = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) >= TRUCK_MIN_DIST;
          return (P.madeBots && P.madeBots.freight) && sts.some((a) => sts.some((b) => far(a, b) && railLinked(a, b))) ? 1 : 0;
        },
        hint: 'A <b>Rail Station</b> at the far end too (its site: <b>Lay road</b>), then a station\'s Rail yard: Freight Trains <b>+1</b>.',
        // (No #btn-build: always on screen, it would always be what lit up and no station would get its ring. The coach
        // lights Build by itself, and rings the first station, the home one, whose Rail yard builds the train.)
        ui: "#build-tabs [data-g='move'], .bcard[data-t='station'], #sh-layroad, #sh-yard .order-row[data-k='freight'] [data-d='1']" },
      { kind: 'made', good: 'crystal', n: [30, 40, 60],
        hint: 'A <b>Crystal Tap</b> (<kbd>C</kbd>) touching the far station loads the train by conveyor. More Taps, faster.',
        ui: "#btn-build, #build-tabs [data-g='gather'], .bcard[data-t='tap']" },
    ],
  },
  {
    id: 'trade', name: 'Trade Winds', chapter: 'Industry and Trade',
    brief: 'Dock a Trade Terminal at a neutral Trade Post and fill a contract by Road Train, through the planet\'s storms.',
    intro: [
      'The gold pads on the minimap are neutral <b>Trade Posts</b>. A Trade Terminal there swaps a big surplus.',
      'Only Road Trains (or Freight Trains) carry the lots. Posts further out pay better.',
      'A far Depot on a Road Train\'s road stocks itself with what the buildings round it need.',
      'One contract always brings <b>Fuel</b>, at a steep price: a <b>Tanker</b> takes it home.',
      '<b>Planet events</b> are on: dust storms, Ringfall, solar flares, and now and then the <i>Wren</i>, a trader ship.',
    ],
    // (Seed 1445: Ringfall (a meteor shower) at 2:30 and a solar flare over by 9:36. Events are seeded, and on the designed
    // 1415 the second one, the trader ship, only left at 12:25, so a player who had made the trades by 6 minutes waited 6 more.)
    mode: 'colony', seed: 1445, size: 1, rough: 1, rich: 3, biome: 'savanna', shape: 0, events: true, limit: [0, 0, 30],
    setup(S) {
      kit(S, KIT7, 4);
      const L = getE(S.players[0].lander);
      L.stock.stone += 40;
      L.stock.cement += 20;
      L.stock.alloy += 6;
      S.nextEvent = 150; // (the first planet event two and a half minutes in)
    },
    goals: [
      { kind: 'bots', type: 'roadtrain', n: 1, at: 'foundry',
        hint: 'Tap the Bot Foundry → <b>Order bots</b>: Road Trains <b>+1</b>. It carries 30 goods of mixed kinds.',
        ui: "#sh-orders .order-row[data-k='roadtrain'] [data-d='1']" },
      { kind: 'built', type: 'terminal', n: 1,
        hint: 'Tap a gold Trade Post → <b>Dock a Trade Terminal here</b>. Then tap its site → <b>Lay road</b> (<kbd>R</kbd>).',
        // (No #btn-build: always on screen, it would always be what lit up and the Terminal site would get no ring.)
        ui: "#sh-dock, #sh-layroad, #build-tabs [data-g='move'], .bcard[data-t='terminal']" },
      { kind: 'trades', n: [1, 2, 3], text: ['Make a trade at the Terminal', 'Make {n} trades at the Terminal'], at: 'terminal',
        count: (P) => (P.trade && P.trade.sold) || 0,
        hint: 'Tap the Terminal → <b>Take</b> a contract, like 30 Stone (a Road Train hauls it). The last always buys Fuel.',
        ui: '#sh-trade button' },
      { kind: 'events', n: 2, text: 'Ride out 2 planet events',
        count: (P, S) => (S.evN || 0) - (S.event ? 1 : 0),
        hint: 'Ringfall craters roads, flares drain batteries, dust slows robots. Waiting? Speed up: <b>1×</b> (<kbd>]</kbd>).',
        ui: '#event-card, #ev-trade, #btn-speed' },
    ],
  },

  // Chapter 5, Sea and Sky. Ports and ships between islands, Viaducts and Ropeways between mesas, a Crawler and an airlift.
  {
    id: 'harbour', name: 'Harbour', chapter: 'Sea and Sky',
    brief: 'Your island is small and the sea is wide. Build a Port and ships, and found a second Port across the water.',
    intro: [
      'A bridge over the open sea costs more the further it reaches from the shore.',
      'A <b>Port</b> on the shore is storage, and its shipyard builds ships. Ships burn Fuel.',
      'A <b>Ferry</b> carries robots and trucks between your Ports, and can found a Port on an empty shore.',
      '<b>Container Ships</b> keep far Ports stocked; Tanker Ships carry Crude and Fuel.',
      'In Versus, a Ferry also lands warbots on an enemy beach.',
    ],
    mode: 'colony', seed: 9101, size: 0, rough: 1, rich: 3, biome: 'jungle', shape: 3, limit: [0, 0, 25],
    setup(S) {
      kit(S, KIT7, 4);
      const L = getE(S.players[0].lander);
      L.stock.alloy += 8; L.stock.chip += 4; L.stock.cement += 10;
    },
    goals: [
      { kind: 'built', type: 'port', n: 1,
        hint: '<b>Build</b> (<kbd>B</kbd>) → <b>Move</b> (<kbd>3</kbd>) → <b>Port</b> (<kbd>P</kbd>) on your shore. Then tap its site → <b>Lay road</b> (<kbd>R</kbd>).',
        ui: "#btn-build, #build-tabs [data-g='move'], .bcard[data-t='port'], #sh-layroad" },
      { kind: 'bots', type: 'ferry', n: 1, at: 'port',
        hint: 'Tap the Port → <b>Shipyard</b>: Ferries <b>+1</b>. Haulers bring it the Alloy and Chips.',
        ui: "#sh-yard .order-row[data-k='ferry'] [data-d='1']" },
      { kind: 'foundedPort', n: 1, text: 'Found a Port on another island', at: 'port',
        count: (P, S) => {
          // (A Port a Ferry founded (it claims land) on another island: no dry land joins it to the Command Base.)
          const L = getE(P.lander), ports = S.buildings.filter((b) => !b.dead && b.owner === 0 && b.built && b.type === 'port' && b.claim > 0);
          if (!ports.length || !L) return 0;
          const N = S.W * S.H, land = new Uint8Array(N), q = [tIdx(L.x, L.y)];
          land[q[0]] = 1;
          while (q.length) {
            const a = q.pop(), i = a % S.W;
            for (const b of [i > 0 ? a - 1 : -1, i < S.W - 1 ? a + 1 : -1, a - S.W, a + S.W]) if (b >= 0 && b < N && !land[b] && S.terrain[b] !== T_WATER) { land[b] = 1; q.push(b); }
          }
          return ports.filter((b) => !land[tIdx(b.x, b.y)]).length;
        },
        hint: 'Tap the Port → <b>Found a Port on another shore</b> (<kbd>P</kbd>), then tap a beach across the sea.',
        ui: '#sh-found' },
      { kind: 'bots', type: 'cargoship', n: 1, at: 'port',
        hint: 'Tap the Port → <b>Shipyard</b>: Container Ships <b>+1</b>. Ships fill the new Port\'s <b>Supply orders</b> from home.',
        ui: "#sh-yard .order-row[data-k='cargoship'] [data-d='1']" },
    ],
  },
  {
    id: 'skyline', name: 'Sky Bridges', chapter: 'Sea and Sky',
    brief: 'Your mesa stands high over a canyon. Span it with a Viaduct and a Ropeway to reach the Crystal beyond.',
    intro: [
      'Your mesa has no Crystal: it lies on the mesas to the north and the west.',
      'These mesas stand far above the canyon floor: much too high for a Ramp.',
      'A <b>Viaduct</b> spans clifftop to clifftop, up to 12 tiles, paid as goods come in. Anything can cross it.',
      'A <b>Ropeway</b> crosses anything, up to 14 tiles, even down to the canyon floor. Trucks can\'t ride it.',
      'On a Rift, a road dragged over the chasm becomes a sky bridge.',
    ],
    mode: 'colony', seed: 9501, size: 1, rough: 2, rich: 3, biome: 'desert', shape: 6, limit: [0, 0, 20],
    layout(m, W) {
      // The Crystal has to come from another mesa: none on yours (any level of it).
      const b = m.bases[0];
      mapTiles(m, W, b.x, b.y, 14, (t) => { if (m.res[t] === R_CRYSTAL && m.elev[t] >= 3) { m.res[t] = 0; m.amt[t] = 0; } });
    },
    setup(S) {
      // (Two Harvesters: the desert mesa's Smelter burns more Fiber than one cuts, and the Crystal Taps need some.)
      kit(S, [...KIT7, 'harvester'], 4);
      const L = getE(S.players[0].lander);
      L.stock.cement += 30; L.stock.alloy += 10;
    },
    goals: [
      { kind: 'viaduct', n: 1, text: 'Span the canyon with a Viaduct',
        count: (P, S) => S.buildings.filter((b) => !b.dead && b.owner === 0 && b.built && b.type === 'viaduct' && b.far).length,
        hint: '<b>Paths</b> (<kbd>R</kbd>) → <b>Viaducts</b> (<kbd>Shift</kbd>+<kbd>V</kbd>): tap your mesa\'s north rim, then the clifftop across.',
        ui: "#btn-road, #banner-seg [data-v='viaduct']" },
      { kind: 'ropeway', n: 1, text: 'Run a Ropeway to another mesa',
        count: (P, S) => S.buildings.filter((b) => {
          // (Its far end is up, where bots couldn't walk to from the near end: another mesa, or the canyon floor. Not a
          // hop over a step of your own mesa, which a natural slope already joins.)
          const a = b.far && !b.dead && b.owner === 0 && b.type === 'ropeway' && getE(b.link);
          if (!a) return false;
          const N = S.W * S.H, end = tIdx(b.x, b.y), seen = new Uint8Array(N), q = [tIdx(a.x, a.y)];
          seen[q[0]] = 1;
          while (q.length) {
            const u = q.pop(), i = u % S.W;
            if (u === end) return false;
            for (const v of [i > 0 ? u - 1 : -1, i < S.W - 1 ? u + 1 : -1, u - S.W, u + S.W]) if (v >= 0 && v < N && !seen[v] && canStep(u, v)) { seen[v] = 1; q.push(v); }
          }
          return true;
        }).length,
        hint: '<b>Paths</b> (<kbd>R</kbd>) → <b>Ropeways</b> (<kbd>Shift</kbd>+<kbd>Y</kbd>): a station by your roads, then a far end on another mesa.',
        ui: "#btn-road, #banner-seg [data-v='ropeway'], #sh-layroad" },
      { kind: 'made', good: 'crystal', n: [20, 30, 40],
        hint: '<b>Build</b> (<kbd>B</kbd>) → <b>Gather</b> (<kbd>1</kbd>) → <b>Crystal Tap</b> (<kbd>C</kbd>) by the Crystal across the canyon. Then tap its site → <b>Lay road</b> (<kbd>R</kbd>).',
        ui: "#btn-build, #build-tabs [data-g='gather'], .bcard[data-t='tap'], #sh-layroad" },
    ],
  },
  {
    id: 'airlift', name: 'Airlift', chapter: 'Sea and Sky',
    brief: 'Your colony sits on a plateau ringed by cliffs. Drive a Crawler down off it, then take to the air from an Airfield.',
    intro: [
      'A <b>Crawler</b> is a base on tracks: where it stops it unfolds into a Depot, Fuel Station and Outpost.',
      'An <b>Airfield</b>\'s Cargo Plane flies over anything and drops its load by parachute.',
      'It drops a Drop Outpost on open ground nobody else holds, or two Workers on any open ground.',
      'Places switched to <b>Supply by air</b> get what they are short of, 8 goods a flight.',
      'In Versus, planes also drop warbots, and Vulcan Bombers fly from the Airfield.',
    ],
    mode: 'colony', seed: 1818, size: 1, rough: 2, rich: 3, biome: 'polar', shape: 5, limit: [0, 0, 20],
    setup(S) {
      kit(S, KIT7, 4);
      const L = getE(S.players[0].lander);
      L.stock.cement += 20; L.stock.alloy += 14; L.stock.chip += 12;
    },
    goals: [
      { kind: 'crawlerOut', n: 1, text: 'Deploy a Crawler off the plateau', at: 'foundry',
        count: (P, S) => {
          // (Deployed off the level top the Command Base stands on: down a slope, past the cliffs.)
          const L = getE(P.lander), cs = S.buildings.filter((b) => !b.dead && b.owner === 0 && b.type === 'crawlerbase');
          if (!cs.length || !L) return 0;
          const N = S.W * S.H, lv = S.elev[tIdx(L.x, L.y)], top = new Uint8Array(N), q = [tIdx(L.x, L.y)];
          top[q[0]] = 1;
          while (q.length) {
            const a = q.pop(), i = a % S.W;
            for (const b of [i > 0 ? a - 1 : -1, i < S.W - 1 ? a + 1 : -1, a - S.W, a + S.W]) if (b >= 0 && b < N && !top[b] && S.elev[b] === lv && !S.ramp[b]) { top[b] = 1; q.push(b); }
          }
          return cs.filter((b) => !top[tIdx(b.x, b.y)]).length;
        },
        hint: 'Tap the Bot Foundry → <b>Order bots</b>: Crawlers <b>+1</b>. Then tap the Crawler → <b>Drive somewhere</b> (<kbd>G</kbd>), off the plateau.',
        ui: "#sh-orders .order-row[data-k='crawler'] [data-d='1'], #sh-crawl" },
      { kind: 'built', type: 'airfield', n: 1,
        hint: '<b>Build</b> (<kbd>B</kbd>) → <b>Move</b> (<kbd>3</kbd>) → <b>Airfield</b> (<kbd>I</kbd>), with 5 flat tiles for its runway. Then tap its site → <b>Lay road</b> (<kbd>R</kbd>).',
        ui: "#btn-build, #build-tabs [data-g='move'], .bcard[data-t='airfield'], #sh-layroad" },
      { kind: 'built', type: 'dropost', n: 1, text: 'Drop an Outpost by parachute', at: 'airfield',
        hint: 'Tap the Airfield → <b>Hangar</b>: Cargo Planes <b>+1</b>. Then <b>Drop Outpost</b>, and tap open ground.',
        ui: "#sh-yard .order-row[data-k='cargoplane'] [data-d='1'], #sh-air [data-k='outpost']" },
      { kind: 'airSupplied', n: 1, text: 'Supply a building by air', at: 'crawlerbase',
        count: (P, S) => S.buildings.filter((b) => !b.dead && b.owner === 0 && b.type !== 'dropost' && b.airSupply && b.airAt !== undefined).length,
        hint: 'Tap the deployed Crawler → <b>Supply orders</b>: <b>+5</b> Cement. Then <b>Supply by air</b>: <b>On</b>.',
        ui: "#sh-keep .keep-cell[data-g='cement'] [data-d='5'], #sh-airsup" },
    ],
  },

  // Chapter 6, First Contact. The Murmur's nests (type 'nest'), a rival to practise on, a border war and a chokepoint to hold.
  {
    id: 'bughunt', name: 'The Murmur', chapter: 'First Contact', // (id kept: saved progress goes by it)
    brief: 'The Murmur breed in nests under the swamp and raid your colony. Arm up and clear the nests before the packs grow.',
    intro: [
      'The <b>Murmur</b> live here: their nests send packs at your colony from about 4 minutes in.',
      '<b>Scuttlers</b> bite robots; <b>Brutes</b> tear up roads and batter buildings. Nests grow over time.',
      'You have 4 <b>warbots</b> and 30 Ammo; an Ammo Plant (Make, <kbd>I</kbd>) makes more. Turrets fire Crystal.',
      'Defend also has Minigun Nests (<kbd>G</kbd>), which spray Ammo. Tap a dented building → <b>Repair</b> (<kbd>E</kbd>).',
      'Workers and Haulers keep clear of danger by themselves. <kbd>J</kbd> jumps to the latest alert.',
    ],
    mode: 'colony', seed: 6107, size: 1, rough: 1, rich: 3, biome: 'swamp', war: true, wildlife: true, limit: [0, 0, 20],
    setup(S) {
      kit(S, KIT7, 4);
      const P = S.players[0], L = getE(P.lander);
      // Colony games start with no warbots: four, waiting in the Command Base.
      for (let k = 0; k < 4; k++) enterBuilding(addBot(0, 'warbot', L.x, L.y), L);
      P.stats.startBots = P.stats.bots;
      L.stock.ammo = 30; L.stock.crystal += 6; L.stock.alloy += 6; L.stock.chip += 4;
      // The first packs come out at 4-5 minutes (free play: 7-9), so the Pulse Turret gets to show what it does.
      for (const b of S.buildings) if (b.type === 'nest') b.raidAt = 240 + (b.raidAt - WILD.first) / 2;
    },
    goals: [
      { kind: 'built', type: 'turret', n: [1, 1, 2],
        hint: '<b>Build</b> (<kbd>B</kbd>) → <b>Defend</b> (<kbd>4</kbd>) → <b>Pulse Turret</b> (<kbd>T</kbd>) by the colony. Then tap its site → <b>Lay road</b> (<kbd>R</kbd>).',
        ui: "#btn-build, #build-tabs [data-g='defend'], .bcard[data-t='turret'], #sh-layroad" },
      { kind: 'bots', type: 'warbot', n: [2, 3, 4], at: 'foundry',
        hint: 'Tap the Bot Foundry → <b>Order bots</b>: Warbots <b>+1</b>. They wait in the Command Base and reload there.',
        ui: "#sh-orders .order-row[data-k='warbot'] [data-d='1']" },
      { kind: 'nests', n: [1, 2, 2], text: ['Clear a Murmur nest', 'Clear {n} Murmur nests'], count: (P) => P.stats.captured || 0,
        hint: '<b>Army</b> (<kbd>Q</kbd>) → <b>Attack</b> (<kbd>Q</kbd>), then tap a nest. Its hoard spills out for your warbots.',
        ui: '#btn-attack, #ar-attack' },
    ],
  },
  {
    id: 'livefire', name: 'Live Fire', chapter: 'First Contact',
    brief: 'Your first rival: a quiet colony with two empty Outposts. Learn to command warbots, then take its Command Base.',
    intro: [
      '<b>Versus</b>: another colony shares this moon. Capture its Command Base and the planet is yours.',
      'This rival only defends itself. Red is theirs, blue is yours. Each Ammo reloads a warbot\'s 5 shots.',
      'Army (<kbd>Q</kbd>) → Attack, then tap an enemy building or robot. Or tap a building → Send warbots (Q).',
      'With a mouse: drag a box round warbots and right-click; Ctrl+1-9 saves a group. <kbd>C</kbd> calls them home.',
      'A colony holds 90 robots, and you landed with Workers to spare: <b>recycle</b> them at the Bot Foundry for Alloy.',
    ],
    mode: 'versus', seed: 20103, size: 0, rough: 1, rich: 3, biome: 'lunar', players: 2, style: 'balanced',
    rival: ['easy', 'easy', 'medium'], passive: [true, true, true], limit: [0, 0, 25],
    setup(S, diff) {
      const W = S.W, H = S.H, L = getE(S.players[0].lander), R = getE(S.players[1].lander);
      // More guards in the rival's Command Base (it starts with 4): taking it needs a real army.
      for (let k = 0; k < [2, 4, 6][diff]; k++) enterBuilding(addBot(1, 'warbot', R.x, R.y), R);
      S.players[1].stats.startBots = S.players[1].stats.bots;
      // Two empty rival Outposts toward the middle, to practise on.
      preBuild(1, 'outpost', Math.floor(W / 2) - 5, Math.floor(H / 2) - 4, { reach: 8 });
      preBuild(1, 'outpost', Math.floor(W / 2) + 5, Math.floor(H / 2) - 5, { reach: 8 });
      computeTerritory();
      // The colony so far, and an Ammo Plant; and more Workers than it has work for (spare ones to recycle).
      kit(S, KIT7, 10);
      preBuild(0, 'armory', L.x - 3, L.y - 3, { road: true });
      computeTerritory();
    },
    goals: [
      { kind: 'recycled', n: [3, 4, 5], text: 'Recycle {n} spare Workers',
        count: (P) => (P.recycledBots && P.recycledBots.worker) || 0,
        hint: 'Tap the robot count at the top (<kbd>U</kbd>) → <b>Recycle spare Workers</b>. They walk to the Bot Foundry.',
        ui: '#pop-recycle' },
      { kind: 'bots', type: 'warbot', n: [3, 4, 6], at: 'foundry',
        hint: 'Tap the Bot Foundry → <b>Order bots</b>: Warbots <b>+1</b>. The Ammo Plant keeps them loaded.',
        ui: "#sh-orders .order-row[data-k='warbot'] [data-d='1']" },
      { kind: 'outposts', n: [1, 1, 2],
        hint: '<b>Army</b> (<kbd>Q</kbd>) → group size <b>4</b> → <b>Attack</b> (<kbd>Q</kbd>) → tap a red Outpost. Shot down, it\'s yours.',
        ui: '#btn-attack, #ar-n4, #ar-attack' },
      { kind: 'capture',
        hint: 'Tap their Command Base to count its guards. Bring more: <b>Army</b> (<kbd>Q</kbd>) → <b>All</b> (<kbd>4</kbd>) → <b>Attack</b> (<kbd>Q</kbd>).',
        ui: '#btn-attack, #ar-nall, #ar-attack' },
    ],
  },
  {
    id: 'border', name: 'Border Dispute', chapter: 'First Contact',
    brief: 'A rival shares this plateau, and the rich fields lie between you. Take their Outposts, carry off loot and hold the land.',
    intro: [
      'This rival builds, spreads out and fights back.',
      'Warbots capture forts they shoot down (Outposts, Keeps) and wreck the rest, carrying the goods home.',
      'Buildings their border takes are <b>cut off</b> and slowly crumble unless you win the land back.',
      'Warbots recharge in your forts but run down on enemy land.',
      'In free play, holding most of the land for 3 minutes wins a Domination game.',
    ],
    mode: 'versus', seed: 6603, size: 0, rough: 1, rich: 3, biome: 'autumn', players: 2, style: 'balanced',
    rival: ['easy', 'easy', 'normal'], passive: [true, false, false], limit: [0, 0, 25],
    layout(m, W) {
      const H = m.terrain.length / W;
      mirrored(W, H, Math.floor(W / 2) - 5, Math.floor(H / 2) + 2, (x, y) => placeField(m, W, x, y, 1.8, R_ORE, 0.75, 3));
      mirrored(W, H, Math.floor(W / 2) + 6, Math.floor(H / 2) + 3, (x, y) => placeField(m, W, x, y, 1.6, R_CRYSTAL, 0.75, 4));
    },
    setup(S, diff) {
      kit(S, [...KIT7, 'armory'], 4); // (the colony so far, with Live Fire's Ammo Plant)
      const W = S.W, H = S.H, P1 = S.players[1];
      // Two rival Outposts on the rival's side of the contested fields, each with a few warbots on guard.
      for (const [x, y] of [[Math.floor(W / 2) - 5, Math.floor(H / 2) + 2], [Math.floor(W / 2) + 6, Math.floor(H / 2) + 3]]) {
        const o = preBuild(1, 'outpost', W - 1 - x, H - 1 - y, { reach: 4 });
        if (o) for (let k = 0; k < [2, 3, 4][diff]; k++) enterBuilding(addBot(1, 'warbot', o.x, o.y), o);
      }
      P1.stats.startBots = P1.stats.bots;
      computeTerritory();
    },
    goals: [
      { kind: 'outposts', n: [1, 2, 2],
        hint: 'Tap a red Outpost to count its guards. Then <b>Army</b> (<kbd>Q</kbd>) → <b>All</b> (<kbd>4</kbd>) → <b>Attack</b> (<kbd>Q</kbd>) → tap it.',
        ui: '#btn-attack, #ar-nall, #ar-attack' },
      { kind: 'looted', n: [3, 5, 6], text: 'Carry home {n} crates of loot', count: (P) => P.stats.looted || 0,
        hint: '<b>Army</b> → <b>Attack</b> a rival Mine or factory with goods inside: your warbots carry them home in crates.',
        ui: '#btn-attack, #ar-attack' },
      { kind: 'land', n: [34, 40, 42],
        hint: 'Build Outposts (<kbd>B</kbd> <kbd>4</kbd> <kbd>O</kbd>) on the rich middle fields. A captured Outpost brings its ring too.',
        ui: "#btn-build, #build-tabs [data-g='defend'], .bcard[data-t='outpost']" },
    ],
  },
  {
    id: 'holdline', name: 'Hold the Line', chapter: 'First Contact',
    brief: 'A Herald (a rusher) will attack early. Wall the channels through the crags, man the guns and hold out.',
    intro: [
      'This rival is a <b>Herald</b> (a rusher): its clock stopped a day before Arrival, so it attacks early. Others are Wardens, Salvagers, Architects and Stewards.',
      'A belt of crags with a few narrow channels: wall them and cover them with guns.',
      'Walls stop everyone, your robots too: where a wall line crosses a road, a Gate goes in.',
      'An Outpost can Hold inside or Go out and fight. Mortar Pits, Disruptors and the Keep are in Defend too.',
      'Its warbots come behind a <b>Bulwark</b>, a shield robot: fire from in front can\'t reach them, so cover the channels from the side.',
    ],
    mode: 'versus', seed: 2121, size: 1, rough: 2, rich: 3, biome: 'polar', shape: 2, players: 2, style: 'rusher',
    rival: ['medium', 'medium', 'normal'], limit: [0, 0, 0],
    setup(S, diff) {
      kit(S, [...KIT7, 'armory'], 4); // (the colony so far, with Live Fire's Ammo Plant)
      const L = getE(S.players[0].lander), P1 = S.players[1], R = getE(P1.lander);
      // An Outpost up by the crags, joined to the roads: its land reaches the east channel, so guns can cover it.
      preBuild(0, 'outpost', 23, 36, { road: true, reach: 2 });
      computeTerritory();
      L.stock.cement += 20; L.stock.alloy += 8; L.stock.crystal += 6;
      // Four more warbots at home (8 in all): enough to man a Bunker and still face the Herald.
      for (let k = 0; k < 4; k++) enterBuilding(addBot(0, 'warbot', L.x, L.y), L);
      S.players[0].stats.startBots = S.players[0].stats.bots;
      // The Herald starts with more warbots, and holds its first assault until you've had time to dig in (it comes at
      // about 7 / 5½ / 4 minutes).
      for (let k = 0; k < [2, 4, 6][diff]; k++) enterBuilding(addBot(1, 'warbot', R.x, R.y), R);
      P1.stats.startBots = P1.stats.bots;
      P1.nextAttack = [420, 330, 240][diff];
      // ...with a Bulwark at its head, and its assault comes whatever your guns (P.bold): this mission is about holding it.
      for (let k = 0; k < [1, 1, 2][diff]; k++) enterBuilding(addBot(1, 'bulwark', R.x, R.y), R);
      P1.bold = true;
    },
    goals: [
      { kind: 'built', type: 'turret', n: [1, 2, 2],
        hint: '<b>Build</b> (<kbd>B</kbd>) → <b>Defend</b> (<kbd>4</kbd>) → <b>Pulse Turret</b> (<kbd>T</kbd>) where a channel comes out. Then tap its site → <b>Lay road</b> (<kbd>R</kbd>).',
        ui: "#btn-build, #build-tabs [data-g='defend'], .bcard[data-t='turret'], #sh-layroad" },
      // (A Gate counts: it's what a wall line gets where it crosses a road.)
      { kind: 'walls', n: [4, 6, 8], text: 'Build {n} Walls',
        count: (P, S) => S.buildings.filter((b) => !b.dead && b.owner === 0 && b.built && (b.type === 'wall' || b.type === 'gate')).length,
        hint: '<b>Walls</b> (<kbd>X</kbd>): drag a line across each channel and a second row behind it, then <b>Build</b>. The outer row goes up first.',
        ui: "#btn-road, #banner-seg [data-v='wall'], #build-walls, #banner-ok" },
      { kind: 'mannedBunker', n: 1, text: 'Man a Bunker with 2 warbots', at: 'bunker',
        count: (P, S) => S.buildings.filter((b) => !b.dead && b.owner === 0 && b.built && b.type === 'bunker' && b.garrison.length >= 2).length,
        hint: '<b>Build</b> → <b>Defend</b> → <b>Bunker</b> (<kbd>U</kbd>) behind a wall; tap its site → <b>Lay road</b>. Once built, tap it → <b>Station here</b> (<kbd>V</kbd>).',
        ui: "#btn-build, #build-tabs [data-g='defend'], .bcard[data-t='bunker'], #sh-layroad, #sh-st-send" },
      { kind: 'survive', n: [10, 12, 15], text: 'Hold out for {n} minutes', count: (P, S) => (S.winner === 0 ? 99 : Math.floor(S.time / 60)),
        hint: 'Order more Warbots, add <b>Minigun Nests</b> (<kbd>G</kbd>), and tap a dented building → <b>Repair</b> (<kbd>E</kbd>).',
        ui: "#btn-build, #build-tabs [data-g='defend'], .bcard[data-t='minigun']" },
    ],
  },

  // Chapter 7, War. Ammo and repairs, siege robots and missiles, the nuclear race and a final assault.
  {
    id: 'supply', name: 'Supply Lines', chapter: 'War',
    brief: 'Warbots win nothing on empty magazines. Keep the Ammo flowing, mend the wounded and take the rival base.',
    intro: [
      'An <b>Ammo Plant</b> packs Alloy and Cement into Ammo (5 shots each). Haulers stock your Command Base and Outposts.',
      'A <b>Repair Station</b> mends hurt robots with Alloy, three at a time.',
      'An Outpost near the front can be the <b>rally point</b>, where new warbots gather.',
      '<b>Army</b> → <b>Hold ground</b> plants a flag: by their roads warbots tear them up, beside a building they storm it.',
      'Their base can only be captured once your other goals are met.',
    ],
    mode: 'versus', seed: 7707, size: 1, rough: 2, rich: 3, biome: 'jungle', shape: 0, style: 'balanced',
    rival: ['easy', 'medium', 'normal'], limit: [0, 0, 40],
    setup(S) {
      kit(S, KIT7, 4); // (the colony so far: with the Bio Farm for Fuel, as in First Contact)
      // An Outpost out towards the rival, joined by road (the rally point's first home).
      const L = getE(S.players[0].lander), s = aiFindSpot(0, 'outpost', L);
      if (s) preBuild(0, 'outpost', s.x, s.y, { road: true });
      computeTerritory();
      // The warbots landed with their magazines low.
      for (const u of S.bots) if (u.type === 'warbot' && u.owner === 0) u.ammo = 4;
    },
    goals: [
      { kind: 'made', good: 'ammo', n: [15, 25, 35],
        hint: '<b>Build</b> (<kbd>B</kbd>) → <b>Make</b> (<kbd>2</kbd>) → <b>Ammo Plant</b> (<kbd>I</kbd>). It rests at 24 Ammo: tap it → Stock limit <b>+</b>.',
        ui: "#btn-build, #build-tabs [data-g='make'], .bcard[data-t='armory'], #goods .res-chip[data-g='ammo']" },
      { kind: 'built', type: 'repair', n: 1,
        hint: '<b>Build</b> → <b>Defend</b> (<kbd>4</kbd>) → <b>Repair Station</b> (<kbd>E</kbd>): hurt robots come to it.',
        ui: "#btn-build, #build-tabs [data-g='defend'], .bcard[data-t='repair']" },
      { kind: 'rallyPoint', n: 1, text: 'Set a rally point for new warbots', at: 'outpost',
        count: (P) => (P.rallyPost && rallyPostOf(0) ? 1 : 0),
        hint: 'Tap your Outpost (or build one nearer them) → <b>Make this the rally point for new warbots</b>.',
        ui: '#sh-rallypost' },
      { kind: 'capture',
        hint: '<b>Army</b> (<kbd>Q</kbd>) → <b>Hold ground</b> (<kbd>G</kbd>) by their roads to raid. To take their base: <b>All</b> (<kbd>4</kbd>) → <b>Hold ground</b> right beside it.',
        ui: '#btn-attack, #ar-nall, #ar-hold' },
    ],
  },
  {
    id: 'siege', name: 'Siege Breakers', chapter: 'War',
    brief: 'A Warden (a turtle) hides behind Walls and turrets. Burn through, and burn its farmland, with Torches; shield the push with a Bulwark and send in missiles.',
    intro: [
      'This rival is a <b>Warden</b> (a turtle): it has held its position for decades. Walls, turrets and Keeps first, a big army late.',
      '<b>Torches</b> burn through Walls fast, and <b>Scorch the earth</b> burns farmland for good; a <b>Bulwark</b>\'s shield covers the robots behind it.',
      'A <b>Missile Silo</b> reaches 22 tiles: build it toward them. Missiles wreck most buildings, but a Keep must be captured.',
      'Tap a rival building in range → <b>Fire missile</b> (<kbd>F</kbd>) works too.',
      'Their base can wait: this is about breaking in.',
    ],
    mode: 'versus', seed: 2323, size: 1, rough: 1, rich: 3, biome: 'volcanic', shape: 0, style: 'turtle',
    rival: ['easy', 'medium', 'normal'], limit: [0, 0, 45],
    setup(S) {
      kit(S, [...KIT7, 'armory'], 4); // (the colony so far, with Supply Lines' Ammo Plant; the Bio Farm grows the Fuel that Torches and Missiles burn)
      const L = getE(S.players[0].lander);
      L.stock.alloy += 10; L.stock.chip += 4; L.stock.fuel += 10;
    },
    goals: [
      { kind: 'army', n: [2, 3, 3], text: 'Build Torches and a Bulwark', at: 'foundry',
        // (Torches: one on Easy, two on Normal and Hard; and a Bulwark.)
        count: (P, S) => Math.min((P.madeBots && P.madeBots.torch) || 0, [1, 2, 2][S.mission.diff]) + Math.min((P.madeBots && P.madeBots.bulwark) || 0, 1),
        hint: 'Tap the Bot Foundry → <b>Order bots</b>: Torches <b>+1</b>, Bulwarks <b>+1</b>. Torches burn Fuel: keep some.',
        ui: "#sh-orders .order-row[data-k='torch'] [data-d='1'], #sh-orders .order-row[data-k='bulwark'] [data-d='1']" },
      { kind: 'scorch', n: [2, 3, 4], text: 'Scorch {n} patches of their farmland',
        count: (P) => P.stats.scorchedFoe || 0, // (fertile soil a rival farms, or on its land, burned for good: see scorchSoil)
        hint: 'Tap a Torch (or <b>Army</b> → <b>Select all warbots</b>) → <b>Scorch the earth</b> (<kbd>X</kbd>): their farmland.',
        ui: '#sh-scorch, #sel-scorch, #btn-attack, #ar-select' },
      { kind: 'missiles', n: [2, 2, 3], text: 'Fire {n} missiles', at: 'silo',
        count: (P) => (P.used && P.used.warhead) || 0,
        hint: '<b>Make</b> (<kbd>2</kbd>) → <b>Missile Factory</b> (<kbd>N</kbd>), <b>Defend</b> (<kbd>4</kbd>) → <b>Missile Silo</b> (<kbd>I</kbd>) toward them. Silo → <b>Aim missile</b> (<kbd>F</kbd>).',
        ui: ".bcard[data-t='munitions'], .bcard[data-t='silo'], #sh-aim" },
      { kind: 'forts', n: [3, 4, 6], text: 'Take out {n} Walls or turrets',
        count: (P, S) => {
          // (Every rival Wall, Gate, gun and Keep seen standing is remembered: one gone since, or yours now, counts.)
          const M = S.mission || {}, seen = M.forts || (M.forts = {});
          for (const b of S.buildings) {
            if (!b.dead && b.built && b.owner > 0 && ['wall', 'gate', 'turret', 'minigun', 'bunker', 'mortar', 'disruptor', 'flak', 'keep'].includes(b.type)) seen[b.id] = 1;
          }
          let n = 0;
          for (const id in seen) { const b = getE(+id); if (!b || b.dead || b.owner === 0) n++; }
          return n;
        },
        hint: '<b>Army</b> (<kbd>Q</kbd>) → <b>Attack</b> (<kbd>Q</kbd>): tap a Wall or turret. Bulwark and Torches lead; missiles count too.',
        ui: '#btn-attack, #ar-attack' },
    ],
  },
  {
    id: 'chain', name: 'Chain Reaction', chapter: 'War',
    brief: 'Green Uranium glows near your base. Enrich it, build a Nuclear Silo and launch.',
    intro: [
      'A <b>Nuclear race</b>: an Ore Mine beside green Uranium digs it first.',
      'A <b>Nuclear Reactor</b> enriches 2 Uranium into 1; a Nuclear Silo needs 6 for a missile.',
      'A nuclear missile flattens everything round where it lands. A direct hit destroys a Command Base.',
      'If one ever comes for you, press <b>Evacuate</b> (<kbd>V</kbd>) on the warning card.',
      'This mission ends with your launch. In free play, Custom Game → Rules switches the race on or off.',
    ],
    mode: 'versus', seed: 9101, size: 0, rough: 1, rich: 3, biome: 'lunar', shape: 0, style: 'balanced', nuke: true,
    rival: ['easy', 'easy', 'normal'], passive: [true, true, false], limit: [0, 0, 20],
    layout(m, W) {
      const H = m.terrain.length / W, b = m.bases[0];
      mirrored(W, H, b.x + 6, b.y - 9, (x, y) => placeField(m, W, x, y, 1.6, R_URANIUM, 0.8, 11));
    },
    setup(S) {
      // (The colony's Ore Mine goes on Ore: the one by the Uranium is the player's to build.)
      S.mission.nuke = false;
      kit(S, KIT7, 4); // (with the Bio Farm: Fuel for the Fuel Station and a Generator)
      S.mission.nuke = true;
      const L = getE(S.players[0].lander);
      L.stock.alloy += 10; L.stock.chip += 6;
    },
    goals: [
      { kind: 'built', type: 'reactor', n: 1,
        hint: 'An <b>Ore Mine</b> (<kbd>B</kbd> <kbd>1</kbd> <kbd>M</kbd>) by the green Uranium, then <b>Make</b> (<kbd>2</kbd>) → <b>Nuclear Reactor</b> (<kbd>Y</kbd>).',
        ui: "#btn-build, .bcard[data-t='mine'], .bcard[data-t='reactor']" },
      { kind: 'made', good: 'fissile', n: 6,
        hint: 'The Reactor turns 2 Uranium into 1. A <b>Generator</b> (<b>Make</b> → <kbd>G</kbd>) beside it speeds it up.',
        ui: "#goods .res-chip[data-g='uranium'], #goods .res-chip[data-g='fissile']" },
      { kind: 'built', type: 'nukesilo', n: 1,
        hint: '<b>Build</b> → <b>Defend</b> (<kbd>4</kbd>) → <b>Nuclear Silo</b> (<kbd>N</kbd>). Then it builds the missile.',
        ui: "#btn-build, #build-tabs [data-g='defend'], .bcard[data-t='nukesilo']" },
      { kind: 'nukes', n: 1, text: 'Launch a nuclear missile', at: 'nukesilo',
        count: (P) => P.stats.nukes || 0,
        hint: 'Tap the Silo → <b>Aim nuclear missile</b> (<kbd>F</kbd>), tap a rival target, then <b>Launch</b>.',
        ui: '#sh-aim' },
    ],
  },
  {
    id: 'descent', name: 'Final Descent', chapter: 'War',
    brief: 'A maze of canyons and a seasoned rival. Use everything you have learned, and take to the air.',
    intro: [
      'The last landing: narrow canyons, long routes and a seasoned rival.',
      'A <b>Keep</b> houses 25 warbots (6 fire from it) and toughens Walls near it. <b>Vulcan Bombers</b> fly from an Airfield.',
      'If their bombers come, a siren sounds: <b>Flak Guns</b> fill the sky round what they guard.',
      'Then free play: Domination, Uplinks, free-for-alls of 3-4 colonies, 2 vs 2 teams and Multiplayer.',
      'Custom Game picks the map type, size, terrain, resources, biome and seed. Beaten rivals may surrender.',
    ],
    mode: 'versus', seed: 8803, size: 1, rough: 2, rich: 3, biome: 'polar', shape: 16, style: 'balanced',
    rival: ['easy', 'normal', 'normal'], rivalBonus: [0, 0, 4], limit: [0, 0, 60],
    setup(S) { kit(S, [...KIT7, 'armory'], 4); }, // (the colony so far, with Supply Lines' Ammo Plant: warbots and bombers run on Ammo)
    goals: [
      { kind: 'built', type: 'keep', n: 1,
        hint: '<b>Build</b> → <b>Defend</b> (<kbd>4</kbd>) → <b>Keep</b> (<kbd>K</kbd>): 6 warbots fire from it, and Walls near it get tougher.',
        ui: "#btn-build, #build-tabs [data-g='defend'], .bcard[data-t='keep']" },
      { kind: 'built', type: 'flak', n: [1, 2, 2],
        hint: '<b>Defend</b> → <b>Flak Gun</b> (<kbd>F</kbd>), by what their bombers would hit. It shoots only aircraft.',
        ui: "#btn-build, #build-tabs [data-g='defend'], .bcard[data-t='flak']" },
      { kind: 'bots', type: 'bomber', n: 1, at: 'airfield',
        hint: '<b>Move</b> (<kbd>3</kbd>) → <b>Airfield</b> (<kbd>I</kbd>). Tap it → <b>Hangar</b>: Vulcan Bombers <b>+1</b>.',
        ui: ".bcard[data-t='airfield'], #sh-yard .order-row[data-k='bomber'] [data-d='1']" },
      { kind: 'capture',
        hint: 'Tap their base → <b>Bomb it</b> (<kbd>Z</kbd>) to soften it. <b>Army</b> (<kbd>Q</kbd>) → <b>All</b> (<kbd>4</kbd>) → <b>Hold ground</b> (<kbd>G</kbd>) right beside it.',
        ui: '#sh-bomb, #btn-attack, #ar-nall, #ar-hold' },
    ],
  },
];

function goalNeed(g, diff) { return Array.isArray(g.n) ? g.n[diff] : g.n || 1; }

/** A building's name for `n` of them: "a Quarry", "2 Quarries", "2 Cement Works". */
function bldCount(type, n) {
  const name = BDEFS[type].name;
  if (n <= 1) return aOrAn(name);
  return `${n} ${/s$/.test(name) ? name : /[^aeiou]y$/.test(name) ? name.slice(0, -1) + 'ies' : name + 's'}`;
}

/**
 * A goal's objective text for `need` (shared by the mission screen and the game). A goal can give its own `text`
 * ("{n}" stands for the number), which every custom goal (one with a `count` function) does; [one, many] picks by
 * the number ("Clear a Murmur nest" / "Clear {n} Murmur nests").
 */
function goalLabel(g, need) {
  if (g.text) return String(Array.isArray(g.text) ? g.text[need > 1 ? 1 : 0] : g.text).replace(/\{n\}/g, need);
  switch (g.kind) {
    case 'built': return `Build ${bldCount(g.type, need)}`;
    case 'made': return `Make ${need} ${GOOD[g.good].name}${need !== 1 && (g.good === 'chip' || g.good === 'warhead') ? 's' : ''}`; // (Chips and Missiles count one by one)
    case 'bots': return g.type && need === 1 ? `Build ${aOrAn(BOTS[g.type].name)}` : `Build ${need} new ${g.type ? BOTS[g.type].plural : 'bots'}`;
    case 'own': return `Have ${need} ${BOTS[g.type].plural}`;
    case 'paths': return `${['', 'Lay', 'Surface'][g.tier]} ${need} ${['', 'road', 'asphalt road'][g.tier]} tiles`;
    case 'oneway': return `Make ${need} road tiles one-way`;
    case 'lights': return need > 1 ? `Put up ${need} traffic lights` : 'Put up a traffic light';
    case 'land': return `Claim ${need}% of the land`;
    case 'outposts': return need > 1 ? `Capture ${need} rival Outposts` : 'Capture a rival Outpost';
    case 'capture': return 'Capture the rival Command Base';
  }
  return '';
}

/** How far player 0 has got with goal g (see goalState); a custom goal counts with its own `count(P, S)`. */
function goalHave(g) {
  const P = S.players[0];
  if (g.count) return g.count(P, S) || 0;
  let have = 0;
  switch (g.kind) {
    case 'built': for (const b of S.buildings) if (!b.dead && b.owner === 0 && b.built && b.type === g.type) have++; break;
    case 'made': have = (P.made && P.made[g.good]) || 0; break;
    case 'bots': for (const k in P.madeBots || {}) if (!g.type || k === g.type) have += P.madeBots[k]; break;
    case 'own': for (const u of S.bots) if (!u.dead && u.owner === 0 && u.type === g.type) have++; break;
    case 'paths': for (let t = 0; t < S.W * S.H; t++) if (S.road[t] && wayOwner(t) === 0 && (S.pave[t] || 1) >= g.tier) have++; break;
    case 'oneway': for (let t = 0; t < S.W * S.H; t++) if (S.road[t] >= 2 && wayOwner(t) === 0) have++; break;
    case 'lights': for (const k in S.lights) if (S.lights[k].owner === 0) have++; break;
    case 'land': have = Math.floor(landShare(0) * 100); break;
    case 'outposts': have = P.stats.outposts || 0; break;
    case 'capture': have = S.winner === 0 ? 1 : 0; break;
  }
  return have;
}

/**
 * For the tutorial pointers: the sites of a `built` goal's type still going up when, once finished, they meet it (else
 * none). Meanwhile the goal waits for them, and the pointers say so instead of asking for another.
 */
function goalSites(g, diff) {
  // (Only for a building from the Build menu, its card in the goal's `ui`: not one that comes some other way, by air say.)
  if (g.kind !== 'built' || g.count || !new RegExp(`\\.bcard\\[data-t=['"]?${g.type}\\b`).test(g.ui || '')) return [];
  const sites = S.buildings.filter((b) => !b.dead && b.owner === 0 && !b.built && b.type === g.type);
  return sites.length && goalHave(g) + sites.length >= goalNeed(g, diff) ? sites : [];
}

/** A site with no road to storage and none being paved to it: its Lay road is still to do (see goalSites). */
function siteNeedsRoad(b) {
  if (b.unlinked !== true) return false;
  const r = roadRouteTo(0, b);
  return !(r && !r.length && r.pending);
}

/** Where a goal stands: { have, need, done, text }. (Counts of what stands now, like buildings, can drop again; the made and captured counts only grow.) */
function goalState(g, diff) {
  const need = goalNeed(g, diff), have = goalHave(g);
  return { have: Math.min(have, need), need, done: have >= need, text: goalLabel(g, need) };
}

/** The mission a game is playing (by its id, so a saved game finds it even if the campaign's order changes). */
function missionDef(M) { return (M && (MISSIONS.find((m) => m.id === M.id) || MISSIONS[M.k])) || null; }

/**
 * Every goal of the running mission, where it stands. A goal once met stays met (M.got), so one that can come
 * undone (a flag recalled, a building lost) still counts, unless the goal says `hold` (it must hold at the end).
 */
function missionStates(M) {
  const def = missionDef(M);
  if (!def) return [];
  M.got = M.got || [];
  return def.goals.map((g, i) => {
    const st = goalState(g, M.diff);
    if (st.done && !g.hold) M.got[i] = 1;
    else if (M.got[i] && !g.hold) { st.done = true; st.have = st.need; }
    return st;
  });
}

/**
 * The capture lock: taking the last rival's Command Base ends the game, which loses the mission if goals are still
 * open. So while any goal other than capturing it is unfinished, that base holds at 1 armor against player 0 (see
 * hitBuilding), and its panel says to finish the other goals first. Does rival base b, hit by player `by`, hold?
 */
function captureLocked(b, by) {
  const M = S.mission, def = missionDef(M);
  if (!def || M.result || by !== 0 || b.owner === 0 || b.type !== 'lander' || !S.players[b.owner] || S.players[b.owner].lander !== b.id) return false;
  // (With another rival still in, taking this one doesn't end the game: no lock.)
  if (S.players.some((P) => P.id !== 0 && P.id !== b.owner && !P.absent && !P.out && foes(P.id, 0))) return false;
  const states = missionStates(M);
  return def.goals.some((g, i) => g.kind !== 'capture' && !states[i].done);
}

/** Runs once a second while a mission is in play: success, or failure when the clock runs out. */
function checkMission() {
  const M = S.mission;
  if (!M || M.result) return;
  const states = missionStates(M);
  if (states.every((s) => s.done)) { M.result = 'won'; S.winner = 0; return; }
  if (M.limit && S.time >= M.limit) { M.result = 'lost'; M.why = 'time'; S.winner = 1; }
}

/** Settle the result when the game ends some other way (a Command Base captured). */
function finishMission() {
  const M = S.mission;
  if (!M || M.result) return;
  if (S.winner === 0 && missionStates(M).every((s) => s.done)) M.result = 'won';
  else { M.result = 'lost'; M.why = S.winner === 1 ? 'lander' : 'goals'; }
}

/** newGame options for mission k at difficulty diff (0 easy, 1 normal, 2 hard). */
function missionOptions(k, diff) {
  const def = MISSIONS[k];
  return {
    seed: def.seed, mode: def.mode, size: def.size, rough: def.rough, rich: def.rich, biome: def.biome,
    difficulty: def.rival ? def.rival[diff] : 'normal',
    // (A map shape, more players, the rival's doctrine and a Nuclear race, for the missions that teach them.)
    shape: def.shape || 0, players: def.players, style: def.style, nuke: !!def.nuke, events: !!def.events,
    layout: def.layout,
    setup(S) {
      // Easy starts with more in the Command Base, Hard with less.
      const L = getE(S.players[0].lander);
      const k2 = [1.5, 1, 0.75][diff];
      for (const g in L.stock) L.stock[g] = Math.round(L.stock[g] * k2);
      if (def.rivalBonus && !S.players[1].absent) {
        const R2 = getE(S.players[1].lander);
        for (const g in R2.stock) R2.stock[g] += def.rivalBonus[diff];
      }
      // What this mission switches on that missions otherwise leave out (see nukeOn, warOn, labOn, updateEvents).
      S.mission = { k, id: def.id, diff, limit: (def.limit[diff] || 0) * 60, nuke: !!def.nuke, war: !!def.war, lab: !!def.lab, events: !!def.events };
      if (def.wildlife && S.mode === 'colony' && murmurGround(S.settings.biome)) { S.wildlife = true; placeNests(S.seed); } // (none on the moon)
      // (A rival that never attacks, at the difficulties the mission says: passive [easy, normal, hard].)
      if (def.passive && def.passive[diff]) for (const P of S.players) if (P.id !== 0) P.passive = true;
      if (def.setup) def.setup(S, diff);
    },
  };
}

/* --- campaign progress --- */

/** The campaign: which missions are finished at which difficulty. Every mission is open. */
function loadCampaign() {
  try {
    const c = JSON.parse(localStorage.getItem(CAMPAIGN_KEY) || '{}');
    return { unlocked: MISSIONS.length - 1, done: c.done || {} };
  } catch (e) { return { unlocked: MISSIONS.length - 1, done: {} }; }
}

function saveCampaign(c) {
  try { localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(c)); } catch (e) { /* storage unavailable */ }
}

/** Record a finished mission; returns the campaign progress. */
function completeMission(k, diff) {
  const c = loadCampaign();
  const id = MISSIONS[k].id;
  c.done[id] = c.done[id] || [false, false, false];
  c.done[id][diff] = true;
  saveCampaign(c);
  return c;
}


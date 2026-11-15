'use strict';
/*
 * Terrafall — the mission campaign, which is also the tutorial: it starts with the very basics and, chapter by
 * chapter, teaches every part of the game. Missions are on hand-picked planets, each with its own goals, starting
 * conditions and hand-placed features, and three difficulty levels (Easy / Normal / Hard: bigger goals, tighter
 * clocks, tougher rivals). Every mission is open from the start; finishing one ticks it off at that difficulty.
 *
 * A mission: { id (progress is saved by it), name, chapter, brief, intro: [lines for the briefing card], mode,
 * seed, size, rough, rich, biome, shape, players, style, rival: [easy, normal, hard], rivalBonus, limit (minutes
 * per difficulty, 0 none), nuke/war/lab/events/wildlife (switch on what missions otherwise leave out), layout(m, W),
 * setup(S, diff), goals }.
 * A goal: { kind, n (one number or [easy, normal, hard]), hint (how to do it, shown while it's the next goal),
 * ui (CSS selector of the button(s) to light up meanwhile), text (its own objective text, "{n}" for the number) }.
 * Goal kinds:
 *   built     have `n` finished buildings of `type`
 *   made      produce `n` of `good` over the mission
 *   bots      build `n` new bots (any type, or `type`) at the Foundry or a yard
 *   own       have `n` bots of `type` at once
 *   paths     have `n` road tiles of surface `tier` or better (1 road, 2 asphalt)
 *   oneway    have `n` one-way road tiles
 *   lights    have `n` traffic lights up
 *   land      claim `n` percent of the land
 *   outposts  capture `n` rival Outposts (or other garrisons)
 *   capture   capture the rival Command Base
 *   (any)     with `count(P, S)`: whatever that returns, with the goal's own `text`
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

/** The same feature at (x, y) and at its mirror image, so both sides stay fair in Versus. */
function mirrored(W, H, x, y, fn) { fn(x, y); fn(W - 1 - x, H - 1 - y); }

/* --- the campaign --- */

// (Every mission is on Rich resources: the amount it was made and balanced with, before resources were lowered a notch.)
const MISSIONS = [
  {
    id: 'touchdown', name: 'Touchdown',
    brief: 'A sheltered valley with everything close at hand. Get the colony running: cut Fiber, break Stone and smelt your first Alloy. Haulers only drive on roads, so lay one to every building.',
    mode: 'colony', seed: 1101, size: 0, rough: 1, rich: 3, limit: [0, 0, 14],
    goals: [
      { kind: 'built', type: 'harvester', n: 1 }, { kind: 'built', type: 'quarry', n: 1 },
      { kind: 'built', type: 'smelter', n: 1 }, { kind: 'made', good: 'alloy', n: [8, 12, 16] },
    ],
    layout(m, W) { const b = m.bases[0]; placeField(m, W, b.x - 6, b.y - 8, 2.2, R_ORE, 0.7, 5); },
  },
  {
    id: 'assembly', name: 'Assembly Line',
    brief: 'Bots make bots. Chain Ore, Crystal and Fiber into Chips, then order new bots at the Bot Foundry.',
    mode: 'colony', seed: 2203, size: 0, rough: 2, rich: 3, limit: [0, 0, 18],
    goals: [{ kind: 'made', good: 'chip', n: [6, 10, 14] }, { kind: 'bots', n: [4, 6, 8] }],
  },
  {
    id: 'greenfuel', name: 'Green Fuel',
    brief: 'The landing burned the fuel reserve and the colony is spread thin. Grow Fuel on the fertile flats and keep two Fuel Stations running.',
    mode: 'colony', seed: 3307, size: 1, rough: 1, rich: 3, limit: [0, 0, 25], biome: 'jungle',
    goals: [
      { kind: 'built', type: 'farm', n: 1 }, { kind: 'made', good: 'fuel', n: [15, 25, 35] },
      { kind: 'built', type: 'charger', n: 2 },
    ],
    layout(m, W) { const b = m.bases[0]; placeFertile(m, W, b.x + 7, b.y - 3, 2.2); placeFertile(m, W, b.x - 8, b.y - 5, 1.8); },
    setup(S) { getE(S.players[0].lander).stock.fuel = 0; },
  },
  {
    id: 'rushhour', name: 'Rush Hour',
    brief: 'A supply depot landed far from your Command Base and the traffic is already backing up. Order more Haulers, run a road out to the depot, add one-way lanes and put traffic lights on the busy crossings.',
    mode: 'colony', seed: 4409, size: 1, rough: 0, rich: 3, limit: [0, 0, 20],
    goals: [{ kind: 'own', type: 'hauler', n: [7, 8, 10] }, { kind: 'paths', tier: 1, n: [32, 40, 48] }, { kind: 'oneway', n: [8, 12, 16] },
      { kind: 'lights', n: [1, 2, 3] }],
    setup(S) {
      const L = getE(S.players[0].lander);
      L.stock.cement = (L.stock.cement || 0) + 6;
      // A depot of Stone on the far side of the landing zone.
      for (let r = 7; r >= 4; r--) for (const [dx, dy] of [[0, -r], [r, 0], [-r, 0]]) {
        if (S.buildings.some((b) => b.type === 'depot')) break;
        if (canPlace(0, 'depot', L.x + dx, L.y + dy).ok) { const d = addBuilding(0, 'depot', L.x + dx, L.y + dy, true); d.stock.stone = 20; }
      }
    },
  },
  {
    id: 'blacktop', name: 'Blacktop',
    brief: 'The survey crews want proper roads. Bake Cement, lay roads, then mark them for asphalt in Paths (Pave) and send a Paver out with Asphalt made from the oil seep beside your base.',
    mode: 'colony', seed: 5501, size: 1, rough: 2, rich: 3, limit: [0, 0, 25],
    goals: [
      { kind: 'made', good: 'cement', n: [12, 20, 28] }, { kind: 'paths', tier: 1, n: [23, 33, 43] },
      { kind: 'paths', tier: 2, n: [8, 14, 20] },
    ],
    layout(m, W) { const b = m.bases[0]; placeField(m, W, b.x + 5, b.y - 5, 1.2, R_OIL, 0.95, 9); },
    setup(S) { const L = getE(S.players[0].lander); L.stock.stone += 10; L.stock.cement = 8; },
  },
  {
    id: 'border', name: 'Border Dispute',
    brief: 'A rival colony landed on the same plateau, and the richest fields lie between you. Take their Outposts and hold the land.',
    mode: 'versus', seed: 6603, size: 0, rough: 1, rich: 3, rival: ['easy', 'normal', 'hard'], limit: [0, 0, 30],
    goals: [{ kind: 'outposts', n: [1, 2, 2] }, { kind: 'land', n: [30, 35, 40] }],
    layout(m, W) {
      const H = m.terrain.length / W;
      mirrored(W, H, Math.floor(W / 2) - 5, Math.floor(H / 2) + 2, (x, y) => placeField(m, W, x, y, 1.8, R_ORE, 0.75, 3));
      mirrored(W, H, Math.floor(W / 2) + 6, Math.floor(H / 2) + 3, (x, y) => placeField(m, W, x, y, 1.6, R_CRYSTAL, 0.75, 4));
    },
  },
  {
    id: 'supply', name: 'Supply Lines',
    brief: 'Warbots win nothing on empty magazines. Build an Ammo Plant, keep your garrisons stocked, and capture the rival Command Base.',
    mode: 'versus', seed: 7707, size: 1, rough: 2, rich: 3, rival: ['easy', 'normal', 'hard'], limit: [0, 40, 35], biome: 'jungle',
    goals: [{ kind: 'made', good: 'ammo', n: [15, 25, 35] }, { kind: 'capture' }],
    setup(S) { for (const u of S.bots) if (u.type === 'warbot' && u.owner === 0) u.ammo = 4; },
  },
  {
    id: 'descent', name: 'Final Descent',
    brief: 'A deep canyon world and a veteran rival. Every route is long, so plan your roads, Fuel and Ammo well. Capture the rival Command Base.',
    mode: 'versus', seed: 8803, size: 2, rough: 3, rich: 3, rival: ['normal', 'hard', 'hard'], rivalBonus: [0, 0, 6], limit: [0, 0, 50], biome: 'polar',
    goals: [{ kind: 'capture' }],
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
 * ("{n}" stands for the number), which every custom goal (one with a `count` function) does.
 */
function goalLabel(g, need) {
  if (g.text) return g.text.replace(/\{n\}/g, need);
  switch (g.kind) {
    case 'built': return `Build ${bldCount(g.type, need)}`;
    case 'made': return `Make ${need} ${GOOD[g.good].name}`;
    case 'bots': return `Build ${need} new ${g.type ? BOTS[g.type].plural : 'bots'}`;
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

/** Where a goal stands: { have, need, done, text }. (Counts of what stands now, like buildings, can drop again; the made and captured counts only grow.) */
function goalState(g, diff) {
  const need = goalNeed(g, diff), have = goalHave(g);
  return { have: Math.min(have, need), need, done: have >= need, text: goalLabel(g, need) };
}

/** Runs once a second while a mission is in play: success, or failure when the clock runs out. */
function checkMission() {
  const M = S.mission;
  if (!M || M.result) return;
  const def = MISSIONS[M.k];
  const states = def.goals.map((g) => goalState(g, M.diff));
  if (states.every((s) => s.done)) { M.result = 'won'; S.winner = 0; return; }
  if (M.limit && S.time >= M.limit) { M.result = 'lost'; M.why = 'time'; S.winner = 1; }
}

/** Settle the result when the game ends some other way (a Command Base captured). */
function finishMission() {
  const M = S.mission;
  if (!M || M.result) return;
  const def = MISSIONS[M.k];
  if (S.winner === 0 && def.goals.every((g) => goalState(g, M.diff).done)) M.result = 'won';
  else { M.result = 'lost'; M.why = S.winner === 1 ? 'lander' : 'goals'; }
}

/** newGame options for mission k at difficulty diff (0 easy, 1 normal, 2 hard). */
function missionOptions(k, diff) {
  const def = MISSIONS[k];
  return {
    seed: def.seed, mode: def.mode, size: def.size, rough: def.rough, rich: def.rich, biome: def.biome,
    difficulty: def.rival ? def.rival[diff] : 'normal',
    // (A map shape, more players, the rival's personality and a Nuclear race, for the missions that teach them.)
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
      if (def.wildlife && S.mode === 'colony') { S.wildlife = true; placeNests(S.seed); }
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


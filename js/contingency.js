'use strict';
/*
 * Terrafall: Contingency, the campaign's engine (CONTINGENCY.md). No screens: js/contingency-ui.js draws it.
 *
 * A run conquers Ithaca I territory by territory, one turn a year on the Arrival clock, from T+1 to T+31. Everything is
 * in the run object (plain JSON: it is the save) and every roll comes from its own seeded generator (run.rng, mulberry32
 * as makeRng in js/util.js, its state kept in the run), so the same seed and the same choices give the same run, on any
 * device, and a later multiplayer globe can share it as orders.
 *
 * The atlas comes from js/contingency-atlas.js (made by tools/atlas/contingency_table.py). Sides 0 to 3 are the four
 * vanguards; side 0 is the person playing (human), the others rivals, each with a doctrine (PERSONALITIES in
 * js/defs.js). The Murmur fight as CONT_MURMUR in a battle's sides.
 *
 * A turn (contAdvance moves it on, stopping where the person has something to do):
 *   plan     Income has come in; the person buys (contBuy*), gives orders (contOrder), answers truce offers; End turn
 *            (contEndTurn) moves on.
 *   battles  The rivals spend and give their orders, all orders are revealed together and the moves made; every
 *            contested territory gets a battle. Battles without the person are auto-resolved at once; the person's wait
 *            for Play or Auto-resolve (contAutoResolve, or contBattleResult with a played battle's outcome).
 *   murmur   The Murmur spread, and a level-3 territory may surge into a held neighbour (a battle of its own: the
 *            person's surges wait as battles do).
 *   report   Events, megastructures, truces, the year's report, the win checks; then the next year's income.
 */

const CONT = {
  version: 1,
  saveKey: 'terrafall.contingency',
  lastTurn: 31,           // T+31: the window (the last turn), when the turn cap is on
  maxTurns: 120,          // (with the turn cap off: a run still ends somewhere)
  groupCost: 14, fortCost: 5, startGroups: 2, groupsPer: 6, maxGroups: 5, maxFort: 3, maxStars: 5,
  orbitCost: 3, orbitCostCharter: 1,
  income: { plain: 2, res: 3, uplink: 3, trade: 3, landmark: 4 },
  homeLoss: 1 / 3,        // of the Reserve, when a home territory falls
  truceTurns: 5, distrust: 5,
  uplinksToWin: 3, uplinkYears: 3,
  rivalIncome: { easy: 0.8, medium: 0.9, normal: 1.0, hard: 1.15, warlord: 1.3 },
  rivalBattle: { easy: 0.9, medium: 0.95, normal: 1.0, hard: 1.06, warlord: 1.12 },
  playedEdge: 0.92,       // your auto-resolve odds are figured on this much of your strength: a little below playing it
  oddsPow: 2.2,
  meterPerBattle: 2, meterDecay: 1, meterMax: 100,
  spread: { base: 0.1, perMeter: 0.005, rampant: 1.7, slowed: 0.5, grow: 0.4, surge: 0.5, answer: 0.2 },
  megaChance: 0.06, megaChanceArchitect: 0.22,
};
const CONT_MURMUR = 4; // (a battle's side for the Murmur)
/** The four callsigns and their colours, as LORE.md has them (fixed here: a battle recolours the game's own while it runs). */
const CONT_CS_NAMES = ['COBALT', 'VERMILION', 'VIRIDIAN', 'TYRIAN'];
const CONT_CS_COLORS = ['#38d4ff', '#ff5a6e', '#5be06c', '#b36bff'];
const CONT_DOCTRINES = ['balanced', 'turtle', 'raider', 'rusher', 'tycoon'];
/** Each callsign's perk (every battle) and its own card (CONTINGENCY.md, Factions). */
const CONT_CALLSIGNS = [
  { perk: 'Roads cost 25% less and are built 25% faster', card: 'road' },
  { perk: 'Ore Mines and Smelters work 15% faster', card: 'surge' },
  { perk: 'Bio Farms and Agribots work 20% faster', card: 'reseed' },
  { perk: 'Trade Posts give 20% better rates', card: 'credit' },
];
const CONT_REFITS = {
  heavy:    { name: 'Heavier Kit', cost: 16, desc: '+2 warbots in every battle' },
  outpost:  { name: 'Forward Outpost', cost: 12, desc: 'battles start with an Outpost built' },
  research: { name: 'Sealed Research', cost: 14, desc: 'one Research Lab upgrade, done in every battle' },
  foundry:  { name: 'Foundry Pattern', cost: 18, desc: 'start every battle with a Bot Foundry' },
  torch:    { name: 'Torch Doctrine', cost: 10, desc: 'Torches do more to the Murmur' },
  lift:     { name: 'Orbital Lift Charter', cost: 12, desc: 'moves to Argos cost 1 Reserve instead of 3' },
};
/** Cards: one use each. battle: played in a battle (in auto-resolve, a strength bonus); else used on the globe. own: a callsign's. */
const CONT_CARDS = {
  drop:     { name: 'Orbital Drop', cost: 7, battle: 1.15, desc: 'reinforcements land mid-battle, at a spot you choose' },
  ringfall: { name: 'Called Ringfall', cost: 6, battle: 1.08, globe: 'fort', desc: 'a ringfall strike mid-battle, or −1 fortification on a territory next to yours' },
  ledger:   { name: 'Accord Ledger Deal', cost: 4, globe: 'ledger', desc: 'a big trade at old Accord rates: +10 Reserve while you hold a Trade Post' },
  flare:    { name: 'Corvane Flare', cost: 5, battle: 1.1, desc: 'enemy batteries drain at the start of a battle' },
  silent:   { name: 'Silent Running', cost: 5, globe: 'silent', desc: 'one Command Group moves two borders this turn' },
  road:     { name: 'Road Standard', cost: 5, battle: 1.06, own: 0, desc: 'the battle starts with your base linked to its nearest Stone and Ore by road' },
  surge:    { name: 'Foundry Surge', cost: 6, battle: 1.1, own: 1, desc: 'for the first 5 minutes the Bot Foundry builds at double speed' },
  reseed:   { name: 'Reseed', cost: 6, globe: 'reseed', own: 2, desc: 'a territory you hold loses all its Murmur and grows +1 income for 3 turns' },
  credit:   { name: 'Ledger Credit', cost: 4, globe: 'credit', own: 3, desc: 'buy any card at half price this turn' },
};
const CONT_MEGA = {
  lance:    { name: 'Lance of Corvane', desc: 'every 3 turns, strikes a territory 2 borders away: −1 fortification, and its Command Group loses a star' },
  ray:      { name: 'Sundering Ray', desc: 'every 2 turns, quakes a neighbour: −1 Murmur, or −1 enemy fortification' },
  dome:     { name: 'Shield Dome', desc: 'enemy cards can\'t touch this territory; defending here, auto-resolve counts as +1 star' },
  city:     { name: 'Arrival City', desc: '+3 Reserve a turn; counts as fortification level 3' },
  lift:     { name: 'Orbital Lift', desc: 'orbital launch from here (reach Argos), and Orbital Drops cost half' },
  atmos:    { name: 'Atmosphere Engine', desc: 'this territory and its neighbours +1 Reserve; the Murmur can\'t spread into them; rivals\' neighbouring territories −1' },
  deepcore: { name: 'Deep Core', desc: '+3 Reserve, but +1 Murmur on its neighbours each turn' },
  uplink:   { name: 'Great Uplink', desc: 'counts as two Uplinks toward victory' },
};
const CONT_EVENTS = {
  ringfall: { name: 'Ringfall season', line: 'Forecast: ringfall season. Fresh Crystal in the strike zones; strike sites pay double.' },
  flare:    { name: 'Flare year', line: 'Corvane flare cycle. Battery reserves draining. Every battle starts drained.' },
  wren:     { name: 'A Wren year', line: 'The Wren is on approach. On schedule, as always. Trade Post deals at half price.' },
  dust:     { name: 'Dust year', line: 'Rust front inbound. Visibility zero across the Rust. Attacks there falter.' },
};
/** Each region's resources, dealt to its territories (one each) from the run's seed, and its battle map shapes. */
const CONT_REGION_RES = {
  rust: ['ore', 'ore'], green: ['fiber'], ember: ['fiber', 'stone'], grass: [], black: ['crude'], polar: ['ore'],
  cinder: ['crystal', 'crystal'], steam: ['fuel'], shoals: [], bloom: ['crystal', 'crystal'], hollow: [], argos: [],
};
const CONT_RES_NAMES = { ore: 'Ore', fiber: 'Fiber', stone: 'Stone', crude: 'Crude', fuel: 'Fuel', crystal: 'Crystal' };
/** The fixed places of the atlas (LORE.md, The atlas): the rest is dealt each run. */
const CONT_FIXED = {
  special: { pathfinder: 'pathfinder', passenger: 'passenger', ledger: 'trade', geyser: 'trade' },
  uplinks: ['northcap', 'stillwater', 'lantern', 'lunar'],
  fifthFrom: ['goldleaf', 'foxford', 'herdway', 'windsweep', 'delta', 'heron', 'ringfall', 'ashfield', 'cinderrift', 'terraces', 'southcap'],
  homesFrom: ['redwash', 'dustgate', 'ironbluff', 'tallpine', 'goldleaf', 'foxford', 'herdway', 'windsweep', 'delta', 'heron', 'ringfall', 'ashfield', 'cinderrift', 'terraces'],
  murmurStart: { violet: 2, bloomedge: 2 },
  argos: ['lunar', 'silent'],
};

/* ------------------------------------------------------------------ the atlas as a graph */

/** The atlas, indexed once: territories by index, their links (each { to, kind: 'land'|'sea'|'orbit'|'below' }). */
const CONT_MAP = (() => {
  const T = CONT_TERR.map(([id, name, region, lon, lat], i) => ({ i, id, name, region, lon, lat }));
  const ix = {}; T.forEach((t) => { ix[t.id] = t.i; });
  const links = T.map(() => []);
  const add = (a, b, kind, extra) => { links[ix[a]].push({ to: ix[b], kind, ...extra }); links[ix[b]].push({ to: ix[a], kind, ...extra }); };
  for (const [a, b] of CONT_LAND) add(a, b, 'land');
  for (const [a, b, sea] of CONT_SEA) add(a, b, 'sea', { sea });
  for (const [a, b] of CONT_BELOW) add(a, b, 'below');
  for (const [a, b] of CONT_ORBIT) add(a, b, 'orbit');
  const coastal = T.map(() => false);
  for (const [a, b] of CONT_SEA) { coastal[ix[a]] = true; coastal[ix[b]] = true; }
  for (const id of ['delta', 'heron', 'palmkeys', 'lantern']) coastal[ix[id]] = true;
  return { T, ix, links, coastal, n: T.length, hollow: ix.hollow, argos: CONT_FIXED.argos.map((id) => ix[id]) };
})();
function contName(t) { return CONT_MAP.T[t].name; }
function contIsArgos(t) { return CONT_MAP.argos.includes(t); }
/** A territory's name to start a sentence with ("The Delta"). */
function contNameCap(t) { const n = contName(t); return n[0].toUpperCase() + n.slice(1); }

/* ------------------------------------------------------------------ the run's seeded rolls */

/** The run's next roll in [0, 1): mulberry32, its state in run.rng (saved with the run). */
function contRand(run) {
  let a = (run.rng = (run.rng + 0x6D2B79F5) | 0);
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function contPick(run, arr) { return arr[Math.floor(contRand(run) * arr.length)]; }
function contShuffle(run, arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(contRand(run) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
/** A number from the seed and a few integers (for the battles' map seeds: fixed by the run). */
function contHash(...k) { let h = 2166136261; for (const v of k) { h ^= v >>> 0; h = Math.imul(h, 16777619); h ^= h >>> 13; } return h >>> 0; }

/* ------------------------------------------------------------------ a new run */

/**
 * A new run. opts: seed (a number; else 1), callsign (0..3: yours), difficulty (a DIFFICULTY key), doctrines (the
 * other three sides' doctrines in callsign order, each a PERSONALITIES key or 'random'; default all random, each
 * different), murmur ('off' | 'normal' | 'rampant'), events (true), turnCap (true), ironman (false), watch (true: the
 * computer plays your side as well, with doctrine opts.youDoctrine: tests and Observer).
 */
function contNewRun(opts = {}) {
  const seed = (opts.seed >>> 0) || 1;
  const run = {
    v: CONT.version, seed, rng: (seed ^ 0x5eed1e55) | 0, turn: 1, phase: 'plan', over: null,
    opts: { difficulty: DIFFICULTY[opts.difficulty] ? opts.difficulty : 'normal', murmur: ['off', 'normal', 'rampant'].includes(opts.murmur) ? opts.murmur : 'normal',
      events: opts.events !== false, turnCap: opts.turnCap !== false, ironman: !!opts.ironman, watch: !!opts.watch },
    sides: [], t: [], groups: [], nextGroup: 1, orders: {}, battles: [], battleN: 0,
    meter: 0, meterMax: 0, hollowDone: 0, event: null, nextEvent: null,
    truces: [], alliance: null, offers: [], window: false,
    log: [], reports: [], stats: { battles: 0, played: 0, peak: [0, 0, 0, 0] },
  };
  const you = clamp(opts.callsign | 0, 0, 3);
  // the sides: you first, then the other callsigns in order, each with a doctrine (random: each different)
  const others = [0, 1, 2, 3].filter((c) => c !== you);
  const want = Array.isArray(opts.doctrines) ? opts.doctrines : [];
  const used = new Set(want.filter(isDoctrine));
  const docs = others.map((c, k) => {
    if (isDoctrine(want[k])) return want[k];
    const free = CONT_DOCTRINES.filter((d) => !used.has(d));
    const d = contPick(run, free.length ? free : CONT_DOCTRINES); used.add(d); return d;
  });
  const youDoc = isDoctrine(opts.youDoctrine) ? opts.youDoctrine : 'balanced';
  [you, ...others].forEach((cs, s) => run.sides.push({
    cs, doctrine: s === 0 ? (run.opts.watch ? youDoc : null) : docs[s - 1], human: s === 0 && !run.opts.watch,
    reserve: 10, refits: [], cards: [], credit: false, home: -1, alive: true, streak: 0, trustUntil: 0, broke: 0, out: 0,
  }));
  // the territories: fixed places, then the dealt ones
  const M = CONT_MAP;
  for (const T of M.T) {
    run.t.push({ owner: -1, fort: 0, murmur: 0, res: null, special: CONT_FIXED.special[T.id] || null, uplink: false, home: -1, mega: null, megaAt: 0, reseed: 0 });
  }
  for (const id of CONT_FIXED.uplinks) run.t[M.ix[id]].uplink = true;
  for (const [region, res] of Object.entries(CONT_REGION_RES)) {
    const ts = contShuffle(run, M.T.filter((T) => T.region === region && !run.t[T.i].special).map((T) => T.i));
    res.forEach((r, k) => { if (ts[k] !== undefined) run.t[ts[k]].res = r; });
  }
  // the homes: four, at least three borders apart, dealt to the sides
  const homes = contDealHomes(run);
  contShuffle(run, homes).forEach((h, s) => {
    const T = run.t[h]; T.owner = s; T.home = s; T.fort = 2; run.sides[s].home = h;
  });
  // the fifth Uplink, somewhere no one starts
  const fifth = CONT_FIXED.fifthFrom.map((id) => M.ix[id]).filter((i) => run.t[i].home < 0);
  run.t[contPick(run, fifth)].uplink = true;
  // the Murmur
  if (run.opts.murmur !== 'off') {
    for (const [id, l] of Object.entries(CONT_FIXED.murmurStart)) run.t[M.ix[id]].murmur = l;
    // the ground answers the Uplinks' signal (LORE.md): every Uplink on the planet starts with the Murmur under it
    run.t.forEach((T, i) => { if (T.uplink && !contIsArgos(i)) T.murmur = Math.max(T.murmur, 1); });
  }
  run.t[M.hollow].murmur = 3;
  // the Command Groups: two each, at home
  for (let s = 0; s < 4; s++) for (let k = 0; k < CONT.startGroups; k++) contAddGroup(run, s, run.sides[s].home, 1);
  contBeginTurn(run);
  return run;
}

/** Four home territories, each at least three borders from the others (by any link a group can cross). */
function contDealHomes(run) {
  const from = CONT_FIXED.homesFrom.map((id) => CONT_MAP.ix[id]);
  const D = from.map((a) => contDistances([a]));
  for (let tries = 0; tries < 400; tries++) {
    const pick = [];
    for (const k of contShuffle(run, from.map((_, k) => k))) {
      if (pick.every((j) => D[j][from[k]] >= 3)) pick.push(k);
      if (pick.length === 4) return pick.map((k) => from[k]);
    }
  }
  return from.slice(0, 4); // (never: the atlas has room for four)
}

/** Borders from a set of territories to every other, by land, sea, orbit (not into the Hollow). */
function contDistances(starts) {
  const d = new Array(CONT_MAP.n).fill(99), q = [];
  for (const s of starts) { d[s] = 0; q.push(s); }
  while (q.length) {
    const a = q.shift();
    for (const L of CONT_MAP.links[a]) if (L.kind !== 'below' && d[L.to] > d[a] + 1) { d[L.to] = d[a] + 1; q.push(L.to); }
  }
  return d;
}

function contAddGroup(run, side, at, stars) {
  const g = { id: run.nextGroup++, side, at, stars: stars || 1, xp: 0 };
  run.groups.push(g);
  return g;
}

/* ------------------------------------------------------------------ what a side has */

function contHeld(run, s) { const out = []; run.t.forEach((T, i) => { if (T.owner === s) out.push(i); }); return out; }
function contGroups(run, s) { return run.groups.filter((g) => g.side === s); }
function contGroupAt(run, t, s) { return run.groups.filter((g) => g.at === t && (s === undefined || g.side === s)); }
function contGroup(run, id) { return run.groups.find((g) => g.id === id) || null; }
/** How many Command Groups side s may have: 2, +1 for every 6 territories, at most 5. */
function contGroupCap(run, s) { return Math.min(CONT.maxGroups, CONT.startGroups + Math.floor(contHeld(run, s).length / CONT.groupsPer)); }
/** Can side s buy a Command Group now? (A rival with no home left can't.) */
function contCanBuyGroup(run, s) {
  const S = run.sides[s];
  if (!S.alive || contGroups(run, s).length >= contGroupCap(run, s) || !contHeld(run, s).length) return false;
  if (!S.human && !(S.home >= 0 && run.t[S.home].owner === s)) return false;
  return S.reserve >= CONT.groupCost;
}
/** The fortification a territory counts as (Arrival City counts as 3). */
function contFortOf(run, t) { const T = run.t[t]; return T.mega === 'city' ? Math.max(3, T.fort) : T.fort; }
/** Uplinks side s holds (a Great Uplink counts twice). */
function contUplinks(run, s) { let n = 0; run.t.forEach((T) => { if (T.owner === s && T.uplink) n += T.mega === 'uplink' ? 2 : 1; }); return n; }
/** Uplinks toward side s's win: its own and, while allied, its ally's. */
function contUplinksToward(run, s) { const a = contAlly(run, s); return contUplinks(run, s) + (a >= 0 ? contUplinks(run, a) : 0); }
/** Resource types side s holds: each adds that good to every battle's starting stock (supply lines). */
function contSupply(run, s) { const set = new Set(); run.t.forEach((T) => { if (T.owner === s && T.res) set.add(T.res); }); return [...set].sort(); }
/** Can side s launch to orbit from territory t (the Pathfinder's site, or its own Orbital Lift)? */
function contLaunch(run, t) { return CONT_MAP.T[t].id === 'pathfinder' || run.t[t].mega === 'lift'; }

/** A territory's Reserve a turn for its owner (CONTINGENCY.md: the income table; the Murmur, megastructures, the year). */
function contIncomeOf(run, t) {
  const T = run.t[t], I = CONT.income, M = CONT_MAP;
  if (T.owner < 0) return 0;
  let v = T.special === 'pathfinder' || T.special === 'passenger' ? I.landmark : T.special === 'trade' ? I.trade : T.uplink ? I.uplink : T.res ? I.res : I.plain;
  if (T.special === 'trade' && run.sides[T.owner].cs === 3) v += 1; // (TYRIAN: better rates)
  if (run.event === 'ringfall' && M.T[t].region === 'cinder' && T.res === 'crystal') v *= 2;
  v -= T.murmur;
  if (T.mega === 'city' || T.mega === 'deepcore') v += 3;
  if (T.reseed > 0) v += 1;
  for (const L of M.links[t]) {
    const N = run.t[L.to];
    if (N.mega === 'atmos' && L.kind !== 'orbit') v += N.owner === T.owner ? 1 : N.owner >= 0 && !contFriends(run, N.owner, T.owner) ? -1 : 0;
  }
  if (T.mega === 'atmos') v += 1;
  return v;
}
function contIncome(run, s) {
  let v = 0;
  run.t.forEach((T, i) => { if (T.owner === s) v += contIncomeOf(run, i); });
  if (!run.sides[s].human && s !== 0) v *= CONT.rivalIncome[run.opts.difficulty];
  return Math.max(0, Math.round(v));
}

/* ------------------------------------------------------------------ truces and alliances */

function contTruce(run, a, b) { return run.truces.find((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a)) || null; }
function contAlly(run, s) { const A = run.alliance; return A ? (A.a === s ? A.b : A.b === s ? A.a : -1) : -1; }
/** Sides that won't move into each other's territory: a truce, or an alliance. */
function contFriends(run, a, b) { return a === b || !!contTruce(run, a, b) || contAlly(run, a) === b; }

/** What a rival makes of a truce from side s, now: { yes, price, line }. Steward, Warden, Architect, Salvager, Herald. */
function contTruceAnswer(run, rival, s, price) {
  const R = run.sides[rival], d = R.doctrine, P = PERSONALITIES[d];
  if (run.sides[s].trustUntil > run.turn) return { yes: false, line: 'Truce breach on record. Request denied.' };
  if (contTruce(run, rival, s) || contAlly(run, rival) === s) return { yes: false, line: 'A truce is already in force.' };
  if (d === 'rusher') return { yes: false, line: 'Arrival in one day. No delay authorised.' };
  if (d === 'balanced') {
    const yes = contStrength(run, s) >= contStrength(run, rival) * 1.25 || run.meter >= 50;
    return { yes, line: yes ? 'Accord clause 4: parties shall settle disputes by arbitration. A truce is logged.' : 'The tribunal finds no grounds for a truce at this time.' };
  }
  if (d === 'turtle') {
    const home = R.home, yes = !(home >= 0 && CONT_MAP.links[home].some((L) => run.t[L.to].owner === s));
    return { yes, line: yes ? `Line held. Truce accepted. Day ${contWardenDay(run)}.` : 'You stand at our gate. No truce.' };
  }
  if (d === 'tycoon') { const ask = 6; return { yes: price >= ask, price: ask, line: price >= ask ? 'A sound investment. Terms accepted.' : `Peace has a price. ${ask} Reserve.` }; }
  if (d === 'raider') { const ask = 4; return { yes: price >= ask, price: ask, fickle: true, line: price >= ask ? 'Payment received. We\'ll stay off your roads. For now.' : `Truces cost ${ask}. Everything costs something.` }; }
  return { yes: false, line: '' };
}
function contWardenDay(run) { return String(12054 + run.turn * 365).replace(/\B(?=(\d{3})+$)/g, ','); }

/** Side s offers rival a truce, paying price Reserve if asked. Returns the answer; a yes starts it at once. */
function contOfferTruce(run, s, rival, price = 0) {
  if (run.phase !== 'plan' || rival === s || !run.sides[rival].alive) return { yes: false, line: '' };
  const A = contTruceAnswer(run, rival, s, price);
  if (A.yes) {
    const pay = A.price || 0;
    if (run.sides[s].reserve < pay) return { yes: false, line: 'Not enough Reserve.' };
    run.sides[s].reserve -= pay; run.sides[rival].reserve += pay;
    run.truces.push({ a: s, b: rival, left: CONT.truceTurns, fickle: !!A.fickle, since: run.turn });
    contLog(run, `Truce with ${contSideName(run, rival)} for ${CONT.truceTurns} years${pay ? ` (${pay} Reserve paid)` : ''}.`);
  }
  return A;
}
/** Answer an offer in run.offers (a rival's truce or alliance). */
function contAnswer(run, k, yes) {
  const O = run.offers[k];
  if (!O || run.phase !== 'plan') return false;
  run.offers.splice(k, 1);
  if (!yes) return true;
  if (O.kind === 'truce') { run.truces.push({ a: O.to, b: O.from, left: CONT.truceTurns, fickle: false, since: run.turn }); contLog(run, `Truce with ${contSideName(run, O.from)} for ${CONT.truceTurns} years.`); }
  if (O.kind === 'alliance' && !run.alliance) {
    run.truces = run.truces.filter((x) => !((x.a === O.to && x.b === O.from) || (x.a === O.from && x.b === O.to)));
    run.alliance = { a: O.to, b: O.from, since: run.turn, ending: 0 };
    contLog(run, `Alliance with ${contSideName(run, O.from)}, for the run. Allied Uplinks count together.`);
  }
  return true;
}
/** Side s breaks its truce with rival: its groups lose a star in morale, and no rival offers it a truce for 5 years. */
function contBreakTruce(run, s, rival) {
  const T = contTruce(run, s, rival);
  if (!T) return false;
  run.truces.splice(run.truces.indexOf(T), 1);
  for (const g of contGroups(run, s)) g.stars = Math.max(1, g.stars - 1);
  run.sides[s].trustUntil = run.turn + CONT.distrust; run.sides[s].broke++;
  contLog(run, s === 0 ? `Truce with ${contSideName(run, rival)} ended by us. Truce breach logged for review by the Accord tribunal.` : `${contSideName(run, s)} broke its truce with ${contSideName(run, rival)}. Truce breach logged for review by the Accord tribunal.`);
  return true;
}

/* ------------------------------------------------------------------ the turn */

/** Income, truce offers: the start of a year (phase plan). */
function contBeginTurn(run) {
  run.phase = 'plan'; run.orders = {}; run.battles = []; run.offers = []; run.year = [];
  if (run.carryOffer) { run.offers.push(run.carryOffer); run.carryOffer = null; }
  run.event = run.nextEvent; run.nextEvent = null;
  for (let s = 0; s < 4; s++) {
    const S = run.sides[s];
    S.credit = false; S.silent = null;
    if (!S.alive) continue;
    const inc = contIncome(run, s);
    S.reserve += inc; S.lastIncome = inc;
  }
  // a rival may offer you a truce (the Steward, when you're clearly stronger or the Murmur meter is high)
  const me = run.sides[0];
  if (me.alive && me.trustUntil <= run.turn) for (let r = 1; r < 4; r++) {
    const R = run.sides[r];
    if (!R.alive || R.doctrine !== 'balanced' || contTruce(run, 0, r) || contAlly(run, 0) === r) continue;
    if (contStrength(run, 0) >= contStrength(run, r) * 1.4 || run.meter >= 60) run.offers.push({ kind: 'truce', from: r, to: 0, line: 'Accord clause 4: parties shall settle disputes by arbitration. We propose a truce of five years.' });
  }
  // the AI answers its own offers when the computer plays your side
  if (!me.human) contAutoAnswer(run, 0);
}

/** End turn (side 0's orders are in): the rivals spend and order, everything moves at once, the battles are set. */
function contEndTurn(run) {
  if (run.phase !== 'plan') return false;
  run.offers = []; // (unanswered offers lapse)
  for (let s = 0; s < 4; s++) if (run.sides[s].alive && !run.sides[s].human) contAiPlan(run, s);
  contMoves(run);
  run.phase = 'battles';
  contAdvance(run);
  return true;
}

/** Moves the turn on until the person has something to do (a battle of theirs, or the next year's plan), or it's over. */
function contAdvance(run) {
  for (let guard = 0; guard < 20; guard++) {
    if (run.phase === 'battles' || run.phase === 'surges') {
      for (const b of run.battles) if (!b.result && !b.human) contResolve(run, b, null);
      if (run.battles.some((b) => !b.result)) return 'battle';
      if (run.phase === 'battles') { contAfterBattles(run); run.phase = 'murmur'; continue; }
      run.phase = 'report'; continue;
    }
    if (run.phase === 'murmur') { contMurmurSpread(run); run.phase = 'surges'; continue; }
    if (run.phase === 'report') {
      contYearEnd(run);
      if (run.over) { run.phase = 'over'; return 'over'; }
      run.turn++;
      contBeginTurn(run);
      return 'plan';
    }
    return run.phase;
  }
  return run.phase;
}

/* ------------------------------------------------------------------ spending */

function contSpend(run, s, n) { const S = run.sides[s]; if (S.reserve < n) return false; S.reserve -= n; return true; }
/** Buy a Command Group: lands at 1 star in territory t, which side s holds. */
function contBuyGroup(run, s, t) {
  if (run.phase !== 'plan' || run.t[t].owner !== s) return false;
  if (!contCanBuyGroup(run, s)) return false;
  contSpend(run, s, CONT.groupCost);
  const g = contAddGroup(run, s, t, 1);
  if (s === 0) contLog(run, `Reserve Command Base readied at ${contName(t)}.`);
  return g;
}
/** Fortify territory t one level (up to 3). */
function contFortify(run, s, t) {
  const T = run.t[t];
  if (run.phase !== 'plan' || T.owner !== s || T.fort >= CONT.maxFort || !contSpend(run, s, CONT.fortCost)) return false;
  T.fort++;
  return true;
}
function contBuyRefit(run, s, k) {
  const S = run.sides[s], R = CONT_REFITS[k];
  if (run.phase !== 'plan' || !R || S.refits.includes(k) || !contSpend(run, s, R.cost)) return false;
  S.refits.push(k); S.refits.sort();
  return true;
}
/** What a card costs side s now (Ledger Credit: half; a Wren year: the Ledger Deal at half; an Orbital Lift: Drops at half). */
function contCardCost(run, s, k) {
  const C = CONT_CARDS[k];
  let c = C.cost;
  if (run.sides[s].credit) c = Math.ceil(c / 2);
  if (k === 'ledger' && run.event === 'wren') c = Math.ceil(c / 2);
  if (k === 'drop' && run.t.some((T) => T.owner === s && T.mega === 'lift')) c = Math.ceil(c / 2);
  return c;
}
/** Cards side s can buy: the five shared ones and its callsign's own. */
function contCardsFor(run, s) { return Object.keys(CONT_CARDS).filter((k) => CONT_CARDS[k].own === undefined || CONT_CARDS[k].own === run.sides[s].cs); }
function contBuyCard(run, s, k) {
  if (run.phase !== 'plan' || !contCardsFor(run, s).includes(k) || run.sides[s].cards.length >= 6) return false;
  if (!contSpend(run, s, contCardCost(run, s, k))) return false;
  run.sides[s].cards.push(k);
  return true;
}
/**
 * Use a globe card (ringfall on a territory, ledger, silent on a group, reseed on a territory, credit). Battle cards are
 * given to a battle instead (contBattleCard).
 */
function contUseCard(run, s, k, target) {
  const S = run.sides[s], C = CONT_CARDS[k], at = S.cards.indexOf(k);
  if (run.phase !== 'plan' || at < 0 || !C || !C.globe) return false;
  if (C.globe === 'fort') {
    const T = run.t[target];
    if (!T || T.owner === s || T.owner < 0 || T.mega === 'dome' || T.fort <= 0 || contFriends(run, s, T.owner)) return false;
    if (!CONT_MAP.links[target].some((L) => run.t[L.to].owner === s && L.kind !== 'below')) return false;
    T.fort--;
    contLog(run, `Called ringfall on ${contName(target)}. Fortification reduced.`, s);
  } else if (C.globe === 'ledger') {
    if (!run.t.some((T) => T.owner === s && T.special === 'trade')) return false;
    S.reserve += 10;
    contLog(run, 'Accord Ledger deal closed at the old rates. Reserve +10.', s);
  } else if (C.globe === 'silent') {
    const g = contGroup(run, target);
    if (!g || g.side !== s) return false;
    S.silent = g.id;
  } else if (C.globe === 'reseed') {
    const T = run.t[target];
    if (!T || T.owner !== s) return false;
    T.murmur = 0; T.reseed = 3;
    contLog(run, `${contNameCap(target)} reseeded. The Bloom burned back; the ground takes.`, s);
  } else if (C.globe === 'credit') {
    S.credit = true;
  }
  S.cards.splice(at, 1);
  return true;
}

/* ------------------------------------------------------------------ orders */

/** The links group g can cross from territory a now: each { to, kind, cost }. */
function contMovesFrom(run, s, a) {
  const out = [];
  for (const L of CONT_MAP.links[a]) {
    if (L.kind === 'orbit') continue;
    if (L.kind === 'below' && (run.hollowDone || CONT_MAP.T[a].id !== 'violet')) continue;
    out.push({ to: L.to, kind: L.kind, cost: 0 });
  }
  // orbit: from a launch site to Argos, and from Argos back to any launch site side s holds
  const cost = run.sides[s].refits.includes('lift') ? CONT.orbitCostCharter : CONT.orbitCost;
  if (contLaunch(run, a)) for (const m of CONT_MAP.argos) out.push({ to: m, kind: 'orbit', cost });
  if (contIsArgos(a)) run.t.forEach((T, i) => { if (T.owner === s && contLaunch(run, i)) out.push({ to: i, kind: 'orbit', cost }); });
  return out;
}
/** May side s's group move into territory t (not a friend's)? */
function contMayEnter(run, s, t) {
  const o = run.t[t].owner;
  return !(o >= 0 && o !== s && contFriends(run, s, o));
}
/**
 * Order group id along path (one territory, or two with Silent Running: the first must be yours). An empty path
 * cancels its order. Returns true if the order stands.
 */
function contOrder(run, id, path) {
  const g = contGroup(run, id);
  if (!g || run.phase !== 'plan') return false;
  delete run.orders[id];
  if (!path || !path.length) return true;
  const s = g.side, S = run.sides[s];
  if (path.length > (S.silent === id ? 2 : 1)) return false;
  let at = g.at, cost = 0;
  for (let k = 0; k < path.length; k++) {
    const m = contMovesFrom(run, s, at).find((x) => x.to === path[k]);
    if (!m || !contMayEnter(run, s, path[k])) return false;
    if (k < path.length - 1 && run.t[path[k]].owner !== s) return false;
    cost += m.cost; at = path[k];
  }
  if (cost > S.reserve - contOrderCost(run, s)) return false;
  run.orders[id] = path.slice();
  return true;
}
/** Reserve side s's orders will cost (orbit). */
function contOrderCost(run, s) {
  let c = 0;
  for (const [id, path] of Object.entries(run.orders)) {
    const g = contGroup(run, +id);
    if (!g || g.side !== s) continue;
    let at = g.at;
    for (const t of path) { const m = contMovesFrom(run, s, at).find((x) => x.to === t); c += m ? m.cost : 0; at = t; }
  }
  return c;
}

/** All orders revealed at once: every group moves, then each contested territory gets a battle. */
function contMoves(run) {
  const from = {};
  // pay for orbit, drop orders that no longer stand (a truce made since), then move
  for (let s = 0; s < 4; s++) {
    const c = contOrderCost(run, s);
    if (c) run.sides[s].reserve = Math.max(0, run.sides[s].reserve - c);
  }
  const moved = new Set();
  for (const g of run.groups) {
    const path = run.orders[g.id];
    if (!path || !contMayEnter(run, g.side, path[path.length - 1])) continue;
    from[g.id] = g.at; g.at = path[path.length - 1]; moved.add(g.id);
  }
  run.moved = [...moved];
  run.battles = [];
  for (let t = 0; t < CONT_MAP.n; t++) {
    const T = run.t[t], here = contGroupAt(run, t);
    if (!here.length) continue;
    const sides = [...new Set(here.map((g) => g.side))].sort((a, b) => a - b);
    const intruders = sides.filter((s) => s !== T.owner);
    if (!intruders.length) continue;
    const groups = {}; for (const s of sides) groups[s] = here.filter((g) => g.side === s).map((g) => g.id);
    if (t === CONT_MAP.hollow) { for (const s of sides) contNewBattle(run, t, 'hollow', [s, CONT_MURMUR], -1, { [s]: groups[s] }, from); continue; }
    if (T.owner >= 0) {
      const garrison = groups[T.owner] || contFortOf(run, t) > 0;
      if (!garrison && intruders.length === 1) { contTake(run, t, intruders[0], 'walk'); continue; }
      contNewBattle(run, t, garrison ? 'assault' : 'claim', garrison ? [T.owner, ...intruders] : intruders, garrison ? T.owner : -1, groups, from);
      continue;
    }
    if (sides.length === 1) {
      if (T.murmur > 0 && run.opts.murmur !== 'off') contNewBattle(run, t, 'murmur', [sides[0], CONT_MURMUR], CONT_MURMUR, groups, from);
      else contTake(run, t, sides[0], 'walk');
      continue;
    }
    contNewBattle(run, t, 'claim', sides, -1, groups, from);
  }
}

/** A new battle at territory t: its kind ('assault', 'claim', 'murmur', 'surge', 'hollow'), sides (CONT_MURMUR for them), defender. */
function contNewBattle(run, t, kind, sides, defender, groups, from) {
  const b = {
    id: ++run.battleN, turn: run.turn, at: t, kind, sides: sides.slice(), defender, groups: {}, from: {},
    seed: contHash(run.seed, run.turn, t, run.battleN), human: false, result: null, cards: {},
  };
  for (const s of sides) if (s !== CONT_MURMUR) { b.groups[s] = (groups[s] || []).slice(); for (const id of b.groups[s]) if (from[id] !== undefined) b.from[id] = from[id]; }
  b.human = sides.some((s) => s !== CONT_MURMUR && run.sides[s].human);
  b.odds = contOdds(run, b);
  // the computer plays a battle card where the odds are against it
  b.sides.forEach((s) => {
    if (s === CONT_MURMUR || run.sides[s].human) return;
    const k = run.sides[s].cards.find((c) => CONT_CARDS[c].battle);
    if (k && b.odds[b.sides.indexOf(s)] < 0.7) contBattleCard(run, b, s, k);
  });
  run.battles.push(b);
  return b;
}

/* ------------------------------------------------------------------ strength and the odds */

/** A Command Group's kit: warbots by rank (4 at 1 star, 14 at 5), +2 with Heavier Kit. */
function contWarbots(run, g) { return 4 + Math.round(2.5 * (g.stars - 1)) + (run.sides[g.side].refits.includes('heavy') ? 2 : 0); }
/** A side's strength over the whole globe (for truces and the AI): its groups' kits and its fortifications. */
function contStrength(run, s) {
  let v = 0;
  for (const g of contGroups(run, s)) v += contWarbots(run, g);
  run.t.forEach((T) => { if (T.owner === s) v += 1 + T.fort; });
  return v + run.sides[s].reserve / 4;
}
/** Side s's strength in battle b (CONTINGENCY.md: rank × callsign and refit factors × fortification and terrain). */
function contPower(run, b, s) {
  const t = b.at, T = run.t[t];
  if (s === CONT_MURMUR) {
    const m = run.meter, lvl = Math.max(1, T.murmur);
    if (b.kind === 'hollow') return 22 + m * 0.1;
    let p = b.kind === 'surge' ? 5 + 3 * 3 + m * 0.06 : 2 + 3 * lvl + m * 0.04;
    if (lvl >= 3 && (m >= 60 || run.turn >= 20)) p += 4; // (the Harrow comes up)
    return p;
  }
  const S = run.sides[s], gs = (b.groups[s] || []).map((id) => contGroup(run, id)).filter(Boolean);
  let p = 0;
  for (const g of gs) p += contWarbots(run, g);
  const def = b.defender === s;
  if (def) {
    const f = contFortOf(run, t);
    if (!gs.length) p = 1.5 + 2.5 * f;
    else p *= 1 + 0.15 * f;
    if (T.mega === 'dome') p += 2.5;
    if (T.home === s) p *= 1.1;
    if (['polar', 'shoals', 'argos'].includes(CONT_MAP.T[t].region)) p *= 1.08;
  }
  // an ally's Command Group next door joins as a teammate
  const ally = contAlly(run, s);
  if (ally >= 0 && !b.sides.includes(ally)) {
    const near = run.groups.filter((g) => g.side === ally && CONT_MAP.links[t].some((L) => L.to === g.at && L.kind !== 'orbit'));
    if (near.length) p += 0.6 * Math.max(...near.map((g) => contWarbots(run, g)));
  }
  let k = 1.04; // (every callsign's perk helps a little)
  for (const r of S.refits) k *= { outpost: 1.04, research: 1.05, foundry: 1.07 }[r] || 1;
  if (S.refits.includes('torch') && b.sides.includes(CONT_MURMUR)) k *= 1.25;
  k *= 1 + 0.02 * contSupply(run, s).length;
  const card = b.cards[s];
  if (card && CONT_CARDS[card] && CONT_CARDS[card].battle) k *= CONT_CARDS[card].battle;
  if (run.event === 'dust' && CONT_MAP.T[t].region === 'rust' && !def) k *= 0.9;
  if (!S.human && s !== 0) k *= CONT.rivalBattle[run.opts.difficulty];
  if (S.human) k *= CONT.playedEdge;
  return Math.max(0.5, p * k);
}
/** Each side's chance to win battle b, in b.sides' order (they sum to 1). */
function contOdds(run, b) {
  const w = b.sides.map((s) => Math.pow(contPower(run, b, s), CONT.oddsPow)), sum = w.reduce((a, c) => a + c, 0);
  return w.map((x) => x / sum);
}
/** Give a battle card from side s's hand to battle b (before it's resolved): one card a side a battle. */
function contBattleCard(run, b, s, k) {
  const S = run.sides[s], at = S.cards.indexOf(k);
  if (b.result || at < 0 || !CONT_CARDS[k].battle || b.cards[s] || !b.sides.includes(s)) return false;
  S.cards.splice(at, 1); b.cards[s] = k; b.odds = contOdds(run, b);
  return true;
}

/* ------------------------------------------------------------------ battles: results */

/** Auto-resolve battle b (a seeded roll on its odds). */
function contAutoResolve(run, b) { if (!b || b.result || (run.opts.ironman && run.playing === b.id)) return false; // (Ironman: a battle begun is played out)
  contResolve(run, b, null); contAdvance(run); return true; }
/**
 * A played battle's outcome: { winner: a side (or CONT_MURMUR), survivors: { side: warbots left }, mega: a CONT_MEGA key
 * finished by the winner, forts: fortification level standing, withdrew: true when you withdrew }.
 */
function contBattleResult(run, b, out) { if (!b || b.result) return false; contResolve(run, b, out || {}); contAdvance(run); return true; }

function contResolve(run, b, played) {
  b.odds = contOdds(run, b);
  let wi;
  if (played && played.winner !== undefined && b.sides.includes(played.winner)) wi = b.sides.indexOf(played.winner);
  else {
    const r = contRand(run);
    let acc = 0; wi = b.sides.length - 1;
    for (let k = 0; k < b.sides.length; k++) { acc += b.odds[k]; if (r < acc) { wi = k; break; } }
  }
  const W = b.sides[wi], close = b.odds[wi] < 0.45, t = b.at, T = run.t[t];
  b.result = { winner: W, played: !!played, close, withdrew: !!(played && played.withdrew) };
  (run.year = run.year || []).push({ at: t, sides: b.sides.slice(), winner: W, kind: b.kind });
  run.stats.battles++; if (played) run.stats.played++;
  if (b.sides.length > 1 && !b.sides.includes(CONT_MURMUR)) run.meter = Math.min(CONT.meterMax, run.meter + CONT.meterPerBattle);
  else run.meter = Math.min(CONT.meterMax, run.meter + 1);
  run.meterMax = Math.max(run.meterMax, run.meter);
  // the losers retreat, a star down (a 1-star group has nothing left to lose: it's lost), or are lost with nowhere to go
  for (const s of b.sides) {
    if (s === W || s === CONT_MURMUR) continue;
    for (const id of b.groups[s] || []) contRetreat(run, b, contGroup(run, id));
  }
  // the winner: a star for a played win, half a star for an auto-resolved one; maybe a star off on a close one
  if (W !== CONT_MURMUR) {
    for (const id of b.groups[W] || []) {
      const g = contGroup(run, id);
      if (!g) continue;
      if (played) g.stars = Math.min(CONT.maxStars, g.stars + 1);
      else if (++g.xp >= 2) { g.xp = 0; g.stars = Math.min(CONT.maxStars, g.stars + 1); }
      if (!played && close && contRand(run) < 0.5 && g.stars > 1) { g.stars--; b.result.scarred = true; }
    }
    if (played && played.survivors && played.survivors[W] !== undefined) b.result.survivors = played.survivors[W];
  }
  // the ground
  if (b.kind === 'hollow') {
    for (const id of b.groups[b.sides[0]] || []) { const g = contGroup(run, id); if (g && g.at === t) g.at = b.from[id] !== undefined ? b.from[id] : CONT_MAP.ix.violet; }
    if (W !== CONT_MURMUR) contHollowFalls(run, W);
    else contLog(run, `${contSideLabel(run, b.sides[0])} assault on the Hollow failed.`, b.sides[0], true);
    return;
  }
  if (W === CONT_MURMUR) {
    if (b.kind === 'surge' && T.owner >= 0) {
      const o = T.owner;
      if (T.home === o) contHomeLost(run, o);
      T.owner = -1; T.fort = 0; T.murmur = Math.max(T.murmur, 2); T.mega = null;
      contLog(run, `${contNameCap(t)} overrun by a Murmur surge. Contact lost.`, o, true);
    } else contLog(run, `${contNameCap(t)}: the landing failed. The Murmur hold the ground.`, b.sides[0], true);
    return;
  }
  if (played && played.forts !== undefined) T.fort = clamp(played.forts | 0, 0, CONT.maxFort);
  const was = T.owner;
  if (was !== W) {
    if (!played && T.fort > 0) T.fort--;
    contTake(run, t, W, b.kind);
  } else contLog(run, `${contNameCap(t)} held${b.sides.length > 2 ? ' against ' + b.sides.filter((s) => s !== W).map((s) => contSideName(run, s)).join(' and ') : b.sides.length === 2 ? ' against ' + contSideName(run, b.sides.find((s) => s !== W)) : ''}.${b.result.scarred ? ' Losses heavy.' : ''}`, W, true, b.sides);
  if (T.murmur > 0) T.murmur--;
  // a megastructure finished in the battle (played), or now and then in an auto-resolved one
  const megaChance = run.sides[W].doctrine === 'tycoon' ? CONT.megaChanceArchitect : CONT.megaChance;
  if (played && played.mega && CONT_MEGA[played.mega]) contSetMega(run, t, played.mega);
  else if (!played && !T.mega && contRand(run) < megaChance) contSetMega(run, t, contMegaFor(run, t, W));
}

/** Group g lost battle b: retreat to where it came from if still held, else a neighbour its side holds; a star down. */
function contRetreat(run, b, g) {
  if (!g) return;
  const s = g.side, t = b.at, o = b.from[g.id];
  let to = o !== undefined && run.t[o].owner === s ? o : -1;
  if (to < 0) for (const L of CONT_MAP.links[t]) if (L.kind !== 'orbit' && L.kind !== 'below' && run.t[L.to].owner === s && L.to !== t) { to = L.to; break; }
  if (to < 0 || g.stars <= 1) {
    run.groups.splice(run.groups.indexOf(g), 1);
    contLog(run, `Command Group ${g.id} lost at ${contName(t)}${to < 0 ? '. No line of retreat' : ''}.`, s, true, b.sides);
    return;
  }
  g.stars--; g.xp = 0; g.at = to;
  contLog(run, `${contNameCap(t)}: Command Group ${g.id} withdrew to ${contName(to)}. Rank reduced.`, s, true, b.sides);
}

/** Side s takes territory t (by a battle won, or walking in). */
function contTake(run, t, s, how) {
  const T = run.t[t], was = T.owner;
  if (was === s) return;
  if (was >= 0 && T.home === was) contHomeLost(run, was);
  T.owner = s; T.reseed = 0;
  if (T.mega && was >= 0) { contLog(run, `${CONT_MEGA[T.mega].name} at ${contName(t)} wrecked in the fighting.`, s, true, [was]); T.mega = null; }
  if (was >= 0) contLog(run, `${contNameCap(t)} taken from ${contSideName(run, was)}. Command authority transferred.`, s, true, [was]);
  else contLog(run, `${contNameCap(t)} claimed for the Sponsor${how === 'walk' ? '. Uncontested' : ''}.${T.uplink ? ' Uplink secured. Listening on all channels. No response.' : ''}`, s, how !== 'walk');
}
function contHomeLost(run, s) {
  const S = run.sides[s], lose = Math.floor(S.reserve * CONT.homeLoss);
  S.reserve -= lose;
  contLog(run, s === 0 ? `Home territory lost. Reserve stock abandoned: ${lose}.` : `${contSideName(run, s)} lost its home territory.`, s, true);
}
function contHollowFalls(run, s) {
  run.hollowDone = run.turn;
  for (const T of run.t) T.murmur = 0;
  run.meter = Math.floor(run.meter / 2);
  contLog(run, `${s === 0 ? 'The Deep\'s mound destroyed' : contSideName(run, s) + ' destroyed the Deep\'s mound'}. The murmur has stopped. … Faint signal, region unknown.`, s, true);
}

/** The megastructure a winner would finish at t: Arrival City at Passenger Town, an Uplink's Great Uplink, else by seed. */
function contMegaFor(run, t, s) {
  const T = run.t[t];
  if (T.special === 'passenger') return 'city';
  if (T.uplink && contRand(run) < 0.5) return 'uplink';
  if (contIsArgos(t)) return 'dome';
  return contPick(run, ['lance', 'ray', 'dome', 'city', 'lift', 'atmos', 'deepcore']);
}
function contSetMega(run, t, k) {
  const T = run.t[t];
  if (k === 'uplink' && !T.uplink) k = 'dome';
  T.mega = k; T.megaAt = run.turn;
  contLog(run, `${CONT_MEGA[k].name} completed at ${contName(t)}.`, T.owner, true);
}

/** After the battles: groups that stayed put (and fought no one) clear a level of the Murmur where they stand. */
function contAfterBattles(run) {
  const fought = new Set(run.battles.flatMap((b) => Object.values(b.groups).flat()));
  const moved = new Set(run.moved || []);
  for (const g of run.groups) {
    const T = run.t[g.at];
    if (!moved.has(g.id) && !fought.has(g.id) && T.murmur > 0 && T.owner === g.side) T.murmur--;
  }
  // a territory left empty and unfortified on Argos stays its owner's; elsewhere too (holding needs no garrison)
}

/* ------------------------------------------------------------------ the Murmur */

function contGuarded(run, t) { const T = run.t[t]; return T.fort > 0 || run.groups.some((g) => g.at === t) || T.mega === 'atmos' || CONT_MAP.links[t].some((L) => run.t[L.to].mega === 'atmos' && L.kind === 'land'); }
function contSpreadChance(run) {
  if (run.opts.murmur === 'off') return 0;
  const P = CONT.spread;
  let p = P.base + P.perMeter * run.meter;
  if (run.opts.murmur === 'rampant') p *= P.rampant;
  if (run.hollowDone) p *= P.slowed;
  return p;
}
/** The Murmur spread (+1 into a neighbour no one guards), grow where no one holds, and surge from level 3. */
function contMurmurSpread(run) {
  run.battles = [];
  run.meter = Math.max(0, run.meter - CONT.meterDecay);
  const p = contSpreadChance(run);
  if (!p) return;
  const M = CONT_MAP, spreadTo = [];
  for (let t = 0; t < M.n; t++) {
    const T = run.t[t];
    if (T.murmur <= 0 || contIsArgos(t)) continue;
    const next = M.links[t].filter((L) => L.kind !== 'orbit' && !contIsArgos(L.to) && L.to !== M.hollow && run.t[L.to].murmur < 3 && !contGuarded(run, L.to)).map((L) => L.to);
    if (next.length && contRand(run) < p * T.murmur / 2) spreadTo.push(contPick(run, next));
    if (t !== M.hollow && T.owner < 0 && T.murmur < 3 && !contGuarded(run, t) && contRand(run) < p * CONT.spread.grow) spreadTo.push(t);
  }
  // the Deep Core draws them
  run.t.forEach((T, t) => { if (T.mega === 'deepcore') for (const L of M.links[t]) if (L.kind !== 'orbit' && !contIsArgos(L.to) && L.to !== M.hollow) spreadTo.push(L.to); });
  const seen = new Set();
  for (const t of spreadTo) {
    if (seen.has(t)) continue; seen.add(t);
    const T = run.t[t];
    if (T.murmur >= 3) continue;
    T.murmur++;
    if (T.owner >= 0) contLog(run, `Ground sensors: the murmur under ${contName(t)} growing. Level ${T.murmur}.`, T.owner);
  }
  // they never go away for good: after the Deep's mound falls, the Hollow fills again, slowly
  if (run.hollowDone && run.t[M.hollow].murmur < 3 && contRand(run) < 0.25) run.t[M.hollow].murmur++;
  const quiet = run.t.filter((T) => T.murmur > 0).length;
  if (quiet) contLog(run, `Acoustic anomaly logged under ${quiet} territor${quiet === 1 ? 'y' : 'ies'}.`, 0);
  // a side transmitting on its Uplinks draws them: the ground answers the signal, and may surge under an Uplink
  for (let t = 0; t < M.n; t++) {
    const T = run.t[t];
    if (!T.uplink || T.owner < 0 || contIsArgos(t) || run.sides[T.owner].streak < 1 || run.battles.some((b) => b.at === t)) continue;
    if (contRand(run) >= CONT.spread.answer * (run.opts.murmur === 'rampant' ? 1.4 : 1)) continue;
    const o = T.owner;
    contNewBattle(run, t, 'surge', [o, CONT_MURMUR], o, { [o]: contGroupAt(run, t, o).map((g) => g.id) }, {});
    contLog(run, `The ground under ${contName(t)} answers the Uplink's signal. Murmur surge. Hold until dawn.`, o, true);
  }
  // surges: a level-3 territory may send one into a neighbour someone holds
  for (let t = 0; t < M.n; t++) {
    if (run.t[t].murmur < 3 || t === M.hollow) continue;
    const held = M.links[t].filter((L) => L.kind === 'land' && run.t[L.to].owner >= 0 && !contIsArgos(L.to)).map((L) => L.to);
    if (!held.length || contRand(run) >= p * CONT.spread.surge) continue;
    const at = contPick(run, held);
    if (run.battles.some((b) => b.at === at)) continue;
    const o = run.t[at].owner;
    contNewBattle(run, at, 'surge', [o, CONT_MURMUR], o, { [o]: contGroupAt(run, at, o).map((g) => g.id) }, {});
    contLog(run, `Murmur surge out of ${contName(t)} into ${contName(at)}. Hold until dawn.`, o, true);
  }
}

/* ------------------------------------------------------------------ the year's end */

function contYearEnd(run) {
  const M = CONT_MAP;
  // megastructures act on the globe
  run.t.forEach((T, t) => {
    if (!T.mega || T.owner < 0) return;
    const s = T.owner, age = run.turn - T.megaAt;
    if (T.mega === 'lance' && age > 0 && age % 3 === 0) {
      const d = contDistances([t]);
      const targets = run.t.map((X, i) => i).filter((i) => d[i] === 2 && run.t[i].owner >= 0 && !contFriends(run, s, run.t[i].owner) && run.t[i].mega !== 'dome');
      if (targets.length) {
        const i = targets.sort((a, b) => run.t[b].fort - run.t[a].fort || a - b)[0];
        if (run.t[i].fort > 0) run.t[i].fort--;
        for (const g of contGroupAt(run, i)) g.stars = Math.max(1, g.stars - 1);
        contLog(run, `Lance of Corvane fired on ${contName(i)}.`, s, true, [run.t[i].owner]);
      }
    }
    if (T.mega === 'ray' && age > 0 && age % 2 === 0) {
      const n = M.links[t].map((L) => L.to).filter((i) => !contIsArgos(i) && i !== M.hollow);
      const bug = n.find((i) => run.t[i].murmur > 0), foe = n.find((i) => run.t[i].owner >= 0 && !contFriends(run, s, run.t[i].owner) && run.t[i].fort > 0 && run.t[i].mega !== 'dome');
      if (bug !== undefined) { run.t[bug].murmur--; contLog(run, `Sundering Ray quake under ${contName(bug)}. Murmur activity down.`, s); }
      else if (foe !== undefined) { run.t[foe].fort--; contLog(run, `Sundering Ray quake under ${contName(foe)}. Their walls cracked.`, s, true, [run.t[foe].owner]); }
    }
  });
  for (const T of run.t) if (T.reseed > 0) T.reseed--;
  // truces run down; a kept one may become an alliance; a Salvager may break one
  for (const x of run.truces.slice()) {
    const r = x.a === 0 ? x.b : x.a;
    if (x.fickle && run.sides[r].doctrine === 'raider' && contRand(run) < 0.15) { contBreakTruce(run, r, r === x.a ? x.b : x.a); continue; }
    if (--x.left <= 0) {
      run.truces.splice(run.truces.indexOf(x), 1);
      const other = r === x.a ? x.b : x.a;
      if (!run.alliance && run.sides[r].doctrine !== 'raider') run.pendingAlliance = { kind: 'alliance', from: r, to: other, line: 'Truce kept five years. We propose an alliance for the duration.' };
      else contLog(run, `Truce with ${contSideName(run, r)} lapsed.`, other);
    }
  }
  if (run.alliance && run.alliance.ending && run.alliance.ending <= run.turn) {
    contLog(run, `Alliance with ${contSideName(run, run.alliance.a === 0 ? run.alliance.b : run.alliance.a)} ended, as notified.`, 0, true);
    run.alliance = null;
  }
  // the events: one may roll for the coming year
  if (run.opts.events) {
    const r = contRand(run), keys = Object.keys(CONT_EVENTS);
    run.nextEvent = r < 0.4 ? keys[Math.floor(r / 0.1)] : null;
    if (run.nextEvent) contLog(run, CONT_EVENTS[run.nextEvent].line, 0);
  }
  // who's still in it
  for (let s = 0; s < 4; s++) {
    const S = run.sides[s];
    if (!S.alive) continue;
    const held = contHeld(run, s).length, gs = contGroups(run, s).length;
    run.stats.peak[s] = Math.max(run.stats.peak[s], held);
    if (!held && !gs) { S.alive = false; S.out = run.turn; contLog(run, `${contSideName(run, s)}: carrier signal lost. “${contPick(run, PERSONALITIES[S.doctrine || 'balanced'].voice.surrender)}”`, 0, true); }
  }
  if (run.sides[0].alive && !contGroups(run, 0).length && (run.sides[0].reserve < CONT.groupCost || !contHeld(run, 0).length)) {
    run.sides[0].alive = false; run.sides[0].out = run.turn;
  }
  // the Uplink count and the win checks
  for (let s = 0; s < 4; s++) { const S = run.sides[s]; S.streak = S.alive && contUplinksToward(run, s) >= CONT.uplinksToWin ? S.streak + 1 : 0; }
  if (run.alliance && !run.alliance.ending && [run.alliance.a, run.alliance.b].some((s) => run.sides[s].streak >= 1)) {
    run.alliance.ending = run.turn + 1;
    contLog(run, 'Alliance notice served: an Uplink win is near. The alliance ends next year.', 0, true);
  }
  contCheckWin(run);
  if (!run.over && run.pendingAlliance) { run.carryOffer = run.pendingAlliance; }
  run.pendingAlliance = null;
  contReport(run);
}

/** The win checks: the Uplinks held three years running, conquest of every home, the last one standing, the window. */
function contCheckWin(run) {
  const alive = [0, 1, 2, 3].filter((s) => run.sides[s].alive);
  const homes = [0, 1, 2, 3].map((s) => run.sides[s].home);
  const up = alive.filter((s) => run.sides[s].streak >= CONT.uplinkYears).sort((a, b) => contUplinks(run, b) - contUplinks(run, a) || contHeld(run, b).length - contHeld(run, a).length || a - b);
  if (up.length) return contWin(run, up[0], 'uplinks');
  const conq = alive.find((s) => homes.every((h) => run.t[h].owner === s));
  if (conq !== undefined) return contWin(run, conq, 'conquest');
  if (!run.sides[0].alive && !run.opts.watch) return contWin(run, -1, 'lost');
  if (alive.length === 1) return contWin(run, alive[0], 'conquest');
  if (run.opts.turnCap && run.turn >= CONT.lastTurn) {
    const best = alive.sort((a, b) => contUplinks(run, b) - contUplinks(run, a) || contHeld(run, b).length - contHeld(run, a).length || contStars(run, b) - contStars(run, a) || a - b)[0];
    return contWin(run, best, 'window');
  }
  if (run.opts.turnCap && run.turn === CONT.lastTurn - 1) {
    run.window = true;
    contLog(run, 'Arrival clock: T+30. The window opens: every Uplink territory will be fought over. Whoever holds the most at T+31 speaks for Ithaca I.', 0, true);
  }
  if (run.turn >= CONT.maxTurns) {
    const best = alive.sort((a, b) => contHeld(run, b).length - contHeld(run, a).length || a - b)[0];
    return contWin(run, best, 'window');
  }
  return null;
}
function contStars(run, s) { return contGroups(run, s).reduce((a, g) => a + g.stars, 0); }
function contWin(run, s, how) {
  run.over = { winner: s, how, turn: run.turn };
  return run.over;
}

/* ------------------------------------------------------------------ the year report (the colony's log voice) */

function contSideName(run, s) { return s === CONT_MURMUR ? 'the Murmur' : CONT_CS_NAMES[run.sides[s].cs]; }
function contSideLabel(run, s) { return s === 0 && run.sides[0].human ? 'Our' : contSideName(run, s) + '\'s'; }
/** Probability of contact: a little lower each year, never shown as zero (0.2% at T+31, as every match says). */
function contContact(turn) { return Math.max(0.1, 0.2 * Math.pow(2, (CONT.lastTurn - turn) / 6)); }
/**
 * Log a line of the year. s: whose it is (0: ours, as the colony writes it; a rival's: heard by long-range listening);
 * big: it goes in the report's headline part; also: other sides it concerns.
 */
function contLog(run, line, s, big, also) {
  run.log.push({ line, s: s === undefined ? 0 : s, big: !!big, also: also || [] });
}
/** The year's report, from the year's log: ours first, then what long-range listening heard, then the rivals' lines. */
function contReport(run) {
  const me = 0, S = run.sides[me], lines = [];
  const ours = run.log.filter((L) => L.s === me || L.also.includes(me) || L.s === CONT_MURMUR);
  const heard = run.log.filter((L) => !ours.includes(L) && L.big);
  lines.push(`Arrival clock: T+${run.turn}. Year report.`);
  const who = (L) => (L.s !== me && L.s >= 0 && L.s < 4 ? contSideName(run, L.s) + ': ' : '');
  for (const L of ours) lines.push(who(L) + L.line);
  for (const L of heard) lines.push('Long-range listening. ' + who(L) + L.line);
  // the rivals' lines: who attacked us this year speaks
  const said = new Set();
  for (const b of run.year || []) if (b.sides.includes(me)) for (const s of b.sides) if (s !== me && s !== CONT_MURMUR && !said.has(s) && run.sides[s].doctrine) {
    said.add(s);
    lines.push(`${contSideName(run, s)}: “${contVoice(run, s)}”`);
  }
  if (S.alive) {
    lines.push(`Reserve: ${S.reserve}. Territories held: ${contHeld(run, me).length}. Command Groups: ${contGroups(run, me).length}.`);
    const u = contUplinksToward(run, me);
    lines.push(`Uplinks held: ${u} of 5.${S.streak ? ` Transmission year ${S.streak} of ${CONT.uplinkYears}.` : ''}`);
  }
  const lead = [1, 2, 3].filter((s) => run.sides[s].alive && run.sides[s].streak > 0 && contAlly(run, 0) !== s);
  for (const s of lead) lines.push(`Warning: ${contSideName(run, s)} transmitting on ${contUplinksToward(run, s)} Uplinks. Year ${run.sides[s].streak} of ${CONT.uplinkYears}.`);
  lines.push(`Murmur meter: ${Math.round(run.meter)}.`);
  if (run.over) lines.push(...contEnding(run));
  else lines.push(`Probability of contact: ${contContact(run.turn).toFixed(1)}%. Still counting.`);
  run.reports.push({ turn: run.turn, lines });
  if (run.reports.length > CONT.lastTurn + 2) run.reports.shift();
  run.log = [];
  return lines;
}
/** A rival's line, in its doctrine's voice ({day}: the Warden's count). */
function contVoice(run, s, kind = 'attack') {
  const V = PERSONALITIES[run.sides[s].doctrine || 'balanced'].voice;
  return contPick(run, V[kind] || V.attack).replace('{day}', contWardenDay(run));
}
/** The ending's lines (the win screen). */
function contEnding(run) {
  const O = run.over, out = [];
  if (!O) return out;
  if (O.winner === 0) {
    out.push(`Ithaca I secured for the Sponsor. Awaiting colonists. Arrival clock: T+${run.opts.turnCap ? CONT.lastTurn : run.turn}. Probability of contact: 0.2%. Still counting.`);
    for (let s = 1; s < 4; s++) out.push(`${contSideName(run, s)}: “${contVoice(run, s, 'surrender')}”`);
  } else if (O.winner < 0 || !run.sides[0].alive) {
    out.push('Reserve exhausted. Carrier dark.');
  } else {
    const how = { uplinks: `transmitting on ${contUplinks(run, O.winner)} Uplinks for ${CONT.uplinkYears} years`, conquest: 'holding every landing', window: 'holding the most Uplinks when the window closed' }[O.how];
    out.push(`${contSideName(run, O.winner)} speaks for Ithaca I, ${how}. Command authority transferred. Hold position.`);
  }
  out.push(`Battles: ${run.stats.battles}. Years: ${run.turn}. Territories at most: ${run.stats.peak[0]}. Murmur meter at its highest: ${Math.round(run.meterMax)}.`);
  return out;
}

/* ------------------------------------------------------------------ the rivals on the globe (by doctrine) */

const CONT_AI = {
  balanced: { attack: 0.55, uplink: 1.8, murmur: 1.3, fortTo: 2, keepHome: true, refits: ['torch', 'heavy', 'research'], cards: 0 },
  turtle:   { attack: 0.7, uplink: 1.6, murmur: 1.0, fortTo: 3, keepHome: true, refits: ['heavy', 'research'], cards: 0 },
  raider:   { attack: 0.5, uplink: 1.1, murmur: 0.8, fortTo: 2, keepHome: false, refits: ['outpost', 'heavy'], cards: 2, res: 1.6 },
  rusher:   { attack: 0.38, uplink: 0.9, murmur: 0, fortTo: 1, keepHome: false, refits: ['heavy'], cards: 0, hunt: true },
  tycoon:   { attack: 0.55, uplink: 1.2, murmur: 1.0, fortTo: 2, keepHome: true, refits: ['foundry', 'research', 'heavy'], cards: 1, city: true },
};

/** How much territory t is worth to side s (its income, and what it stands for). */
function contValue(run, s, t, A) {
  const T = run.t[t];
  let v = 2 + (T.res ? 1 : 0) + (T.special ? 2 : 0) - T.murmur * 0.5;
  if (T.uplink) v += 3 * A.uplink * (run.window || run.turn > 20 ? 1.6 : 1);
  if (T.home >= 0 && T.home !== s) v += 3;
  if (T.res && A.res) v *= A.res;
  if (T.special === 'passenger' && A.city) v += 4;
  if (T.mega) v += 2;
  // stop a leader: its Uplinks are worth more to everyone else
  if (T.owner >= 0 && T.owner !== s && run.sides[T.owner].streak >= 1 && T.uplink) v += 6 * run.sides[T.owner].streak;
  return v;
}

/** What side s (the computer) does this year: spend, then order its groups (CONTINGENCY.md, Rival AI on the globe). */
function contAiPlan(run, s) {
  const S = run.sides[s], A = CONT_AI[S.doctrine] || CONT_AI.balanced, held = contHeld(run, s);
  if (!held.length && !contGroups(run, s).length) return;
  const threat = (t) => CONT_MAP.links[t].some((L) => L.kind !== 'below' && run.groups.some((g) => g.at === L.to && !contFriends(run, s, g.side)));
  // spend: groups first (the Warden fortifies first), then fortifications, refits and cards
  const fortify = () => {
    const want = held.filter((t) => run.t[t].fort < (t === S.home || run.t[t].uplink ? A.fortTo : Math.min(A.fortTo, threat(t) ? A.fortTo - 1 : 0)))
      .sort((a, b) => (b === S.home) - (a === S.home) || run.t[b].uplink - run.t[a].uplink || a - b);
    for (const t of want) { if (S.reserve < CONT.fortCost + (S.doctrine === 'turtle' ? 0 : 4)) break; contFortify(run, s, t); }
  };
  if (S.doctrine === 'turtle') fortify();
  while (contCanBuyGroup(run, s)) {
    const at = held.filter((t) => !contIsArgos(t)).sort((a, b) => threat(b) - threat(a) || (b === S.home) - (a === S.home) || a - b)[0];
    if (at === undefined || !contBuyGroup(run, s, at)) break;
  }
  if (S.doctrine !== 'turtle') fortify();
  for (const k of A.refits) if (!S.refits.includes(k) && S.reserve >= CONT_REFITS[k].cost + 6) contBuyRefit(run, s, k);
  // a full Reserve with nothing left to buy goes on battle cards
  if (S.reserve >= 30 && S.cards.length < 3) for (const k of ['drop', 'flare', CONT_CALLSIGNS[S.cs].card].filter((c) => CONT_CARDS[c].battle)) if (S.reserve >= 24 && S.cards.length < 3) contBuyCard(run, s, k);
  if (A.cards && S.reserve >= 12) {
    const want = S.doctrine === 'raider' ? ['silent', 'flare'] : run.turn >= 18 ? ['ringfall'] : ['drop'];
    for (const k of want) if (S.cards.length < A.cards + 1 && S.reserve >= contCardCost(run, s, k) + 6) contBuyCard(run, s, k);
    const own = CONT_CALLSIGNS[S.cs].card;
    if (S.reserve >= 16 && !S.cards.includes(own)) contBuyCard(run, s, own);
  }
  // globe cards: the Ledger Deal, Reseed on infested land, Called Ringfall on a fortified neighbour
  for (const k of S.cards.slice()) {
    if (k === 'ledger') contUseCard(run, s, k);
    if (k === 'reseed') { const t = held.find((i) => run.t[i].murmur >= 2); if (t !== undefined) contUseCard(run, s, k, t); }
    if (k === 'ringfall') { const t = run.t.map((T, i) => i).find((i) => run.t[i].fort >= 2 && run.t[i].owner >= 0 && run.t[i].owner !== s && !contFriends(run, s, run.t[i].owner) && CONT_MAP.links[i].some((L) => run.t[L.to].owner === s)); if (t !== undefined) contUseCard(run, s, k, t); }
  }
  // the computer playing your side offers a truce now and then, to a neighbour that might take one
  if (s === 0 && run.turn % 6 === 3) for (let r = 1; r < 4; r++) {
    if (run.sides[r].alive && ['turtle', 'tycoon', 'raider'].includes(run.sides[r].doctrine) && S.reserve >= 14 && held.some((t) => CONT_MAP.links[t].some((L) => run.t[L.to].owner === r))) {
      if (contOfferTruce(run, 0, r, 6).yes) break;
    }
  }
  // orders
  const gs = contGroups(run, s).sort((a, b) => b.stars - a.stars || a.id - b.id);
  const taken = new Map(); // target -> groups sent
  // a side transmitting on 3 Uplinks: everyone else goes for its Uplinks
  const leader = [0, 1, 2, 3].filter((r) => r !== s && run.sides[r].alive && run.sides[r].streak >= 1 && contAlly(run, s) !== r).sort((a, b) => run.sides[b].streak - run.sides[a].streak)[0];
  const toLeader = leader !== undefined ? contDistances(contHeld(run, leader).filter((t) => run.t[t].uplink)) : null;
  const hunt = A.hunt ? contDistances(contHeld(run, 0).length ? contHeld(run, 0) : [run.sides[0].home]) : null;
  const keeper = A.keepHome && threat(S.home) && run.t[S.home].fort < 3 ? gs.find((g) => g.at === S.home) : null;
  const used = new Set(keeper ? [keeper.id] : []);
  // joint attacks first: where two or more groups can reach the same enemy ground, they go in together
  const reach = new Map();
  for (const g of gs) {
    if (used.has(g.id)) continue;
    for (const m of contMovesFrom(run, s, g.at)) {
      const o = run.t[m.to].owner;
      if (m.cost || m.to === CONT_MAP.hollow || o < 0 || o === s || !contMayEnter(run, s, m.to)) continue;
      reach.set(m.to, [...(reach.get(m.to) || []), g]);
    }
  }
  const joint = [...reach.entries()].filter(([, l]) => l.length > 1)
    .map(([t, l]) => ({ t, l, odds: contOddsAgainst(run, s, l[0], t, l.slice(1).map((g) => g.id)) }))
    .sort((a, b) => contValue(run, s, b.t, A) * b.odds - contValue(run, s, a.t, A) * a.odds || a.t - b.t);
  for (const J of joint) {
    const l = J.l.filter((g) => !used.has(g.id));
    if (l.length < 2) continue;
    const odds = contOddsAgainst(run, s, l[0], J.t, l.slice(1).map((g) => g.id));
    const stop = run.t[J.t].owner === leader && run.t[J.t].uplink;
    if (odds < (stop ? 0.3 : A.attack) || Math.max(...l.map((g) => contOddsAgainst(run, s, g, J.t))) >= A.attack) continue;
    for (const g of l) if (contOrder(run, g.id, [J.t])) { used.add(g.id); taken.set(J.t, [...(taken.get(J.t) || []), g.id]); }
  }
  for (const g of gs) {
    if (used.has(g.id)) continue;
    const opts = contMovesFrom(run, s, g.at).filter((m) => contMayEnter(run, s, m.to) && m.cost <= S.reserve);
    let best = null, bestV = 0;
    // staying: worth it where a threat is near, or to clear the Murmur under you
    const here = run.t[g.at];
    let stay = (threat(g.at) ? contValue(run, s, g.at, A) * (g.at === S.home ? 1.4 : 0.8) : 0) + (here.murmur > 0 && here.owner === s ? 1.5 : 0);
    for (const m of opts) {
      const t = m.to, T = run.t[t];
      if (t === CONT_MAP.hollow) {
        if (g.stars >= 3 && (S.doctrine === 'balanced' ? run.meter >= 25 : run.meter >= 55)) { const v = 12 * contOddsAgainst(run, s, g, t); if (v > bestV) { best = [t]; bestV = v; } }
        continue;
      }
      if (T.owner === s) {
        // move up to the front (an interior group goes where the fighting is)
        if (threat(g.at) && g.at === S.home) continue;
        const front = threat(t) || CONT_MAP.links[t].some((L) => run.t[L.to].owner !== s && L.kind !== 'below');
        let v = front && !threat(g.at) && !CONT_MAP.links[g.at].some((L) => run.t[L.to].owner !== s && L.kind !== 'below') ? 1 : 0;
        if (toLeader && toLeader[t] < toLeader[g.at]) v = Math.max(v, 2.5);
        if (v > bestV) { best = [t]; bestV = v; }
        continue;
      }
      const odds = contOddsAgainst(run, s, g, t, taken.get(t));
      if (T.owner < 0 && T.murmur > 0 && A.murmur === 0) { /* the Herald ignores the Murmur */ }
      let v = contValue(run, s, t, A) * odds;
      if (T.owner < 0 && T.murmur > 0) v *= A.murmur || 0.8;
      const stop = T.owner === leader && T.uplink;
      if (odds < A.attack && T.owner >= 0 && !stop) v *= 0.25;
      if (toLeader && toLeader[t] < toLeader[g.at]) v += 2;
      if (odds < 0.45) v *= 0.3;
      if (hunt && T.owner === 0) v *= 1.6;
      if (hunt) v += Math.max(0, 6 - hunt[t]) * 0.3;
      if (run.window && T.uplink) v *= 2;
      if (m.cost) v -= m.cost * 0.6;
      if (taken.has(t) && T.owner < 0 && T.murmur === 0) v *= 0.2; // (one walks in alone)
      if (v > bestV) { best = [t]; bestV = v; }
    }
    if (bestV <= stay || !best) continue;
    // Silent Running: a second border, through our own ground
    if (S.silent === null && S.cards.includes('silent') && run.t[best[0]].owner === s) {
      const two = contMovesFrom(run, s, best[0]).find((m) => run.t[m.to].owner >= 0 && run.t[m.to].owner !== s && contMayEnter(run, s, m.to) && contOddsAgainst(run, s, g, m.to) > 0.6);
      if (two) { contUseCard(run, s, 'silent', g.id); best = [best[0], two.to]; }
    }
    if (contOrder(run, g.id, best)) taken.set(best[best.length - 1], [...(taken.get(best[best.length - 1]) || []), g.id]);
  }
  // battle cards go into its fights automatically (contAiCards, as the battles are set)
}
/** The chance side s's group g (and any already sent there) would take territory t. */
function contOddsAgainst(run, s, g, t, with_) {
  const T = run.t[t], o = T.owner;
  const b = { at: t, kind: 'assault', sides: [s], defender: -1, groups: { [s]: [g.id, ...(with_ || [])] }, cards: {} };
  if (t === CONT_MAP.hollow) { b.kind = 'hollow'; b.sides.push(CONT_MURMUR); b.defender = CONT_MURMUR; }
  else if (o >= 0) { b.sides.push(o); b.defender = o; b.groups[o] = contGroupAt(run, t, o).map((x) => x.id); if (!b.groups[o].length && !contFortOf(run, t)) return 1; }
  else if (T.murmur > 0) { b.kind = 'murmur'; b.sides.push(CONT_MURMUR); b.defender = CONT_MURMUR; }
  else return 1;
  return contOdds(run, b)[0];
}
/** The computer answers side s's offers (it plays your side in tests and Observer runs): yes to every truce and alliance. */
function contAutoAnswer(run, s) {
  for (let k = run.offers.length - 1; k >= 0; k--) if (run.offers[k].to === s) contAnswer(run, k, true);
}

/* ------------------------------------------------------------------ the person's turn, played by the computer (tests) */

/** One whole turn with every battle auto-resolved (side 0 played by the computer when it isn't human). */
function contAutoTurn(run) {
  if (run.phase === 'plan') contEndTurn(run);
  for (let guard = 0; guard < 50 && run.phase !== 'plan' && run.phase !== 'over'; guard++) {
    const b = run.battles.find((x) => !x.result);
    if (b) contAutoResolve(run, b); else contAdvance(run);
  }
  return run.phase;
}

/* ------------------------------------------------------------------ saving: one Contingency slot */

/** A checksum of a string (FNV-1a, 32 bits). */
function contSum(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
/** The run as a save (a string: the run's JSON with a checksum). */
function contSave(run) { const body = JSON.stringify(run); return JSON.stringify({ k: 'terrafall-contingency', v: CONT.version, sum: contSum(body), run: body }); }
/** A save back to a run, or null if it isn't a sound Contingency save (wrong kind, version, checksum or shape). */
function contLoad(str) {
  try {
    const o = JSON.parse(str);
    if (!o || o.k !== 'terrafall-contingency' || o.v !== CONT.version || typeof o.run !== 'string' || contSum(o.run) !== o.sum) return null;
    const run = JSON.parse(o.run);
    return contValid(run) ? run : null;
  } catch (e) { return null; }
}
/** Is this a run the engine can carry on (the right shape everywhere it matters)? */
function contValid(run) {
  const int = (x, lo, hi) => Number.isInteger(x) && x >= lo && x <= hi;
  if (!run || run.v !== CONT.version || !Number.isInteger(run.rng) || !int(run.turn, 1, CONT.maxTurns + 1)) return false;
  if (!Array.isArray(run.sides) || run.sides.length !== 4 || !Array.isArray(run.t) || run.t.length !== CONT_MAP.n || !Array.isArray(run.groups)) return false;
  if (!['plan', 'battles', 'murmur', 'surges', 'report', 'over'].includes(run.phase)) return false;
  for (const S of run.sides) if (!S || !int(S.cs, 0, 3) || !Number.isFinite(S.reserve) || S.reserve < 0 || !Array.isArray(S.cards) || !Array.isArray(S.refits)) return false;
  for (const T of run.t) if (!T || !int(T.owner, -1, 3) || !int(T.fort, 0, 3) || !int(T.murmur, 0, 3) || (T.mega !== null && !CONT_MEGA[T.mega])) return false;
  for (const g of run.groups) if (!g || !int(g.side, 0, 3) || !int(g.at, 0, CONT_MAP.n - 1) || !int(g.stars, 1, 5)) return false;
  return Array.isArray(run.battles) && run.opts && typeof run.opts === 'object';
}
/** The Contingency slot in this device's storage (apart from the normal save slots). */
function contStore(run) { try { localStorage.setItem(CONT.saveKey, contSave(run)); return true; } catch (e) { return false; } }
function contRestore() { try { const s = localStorage.getItem(CONT.saveKey); return s ? contLoad(s) : null; } catch (e) { return null; } }
function contForget() { try { localStorage.removeItem(CONT.saveKey); } catch (e) { /* storage unavailable */ } }

/* ------------------------------------------------------------------ a battle as a match (the bridge: js/contingency-battle.js plays it) */

/** Each region's map types for its battles (SHAPE_PRESETS indices): CONTINGENCY.md, Battles. */
const CONT_REGION_SHAPES = {
  rust: [0, 4, 16], green: [0, 11, 2], ember: [0, 5, 7], grass: [0, 1, 10], black: [13, 11], polar: [0, 8, 2],
  cinder: [14, 15], steam: [9, 5], shoals: [3], bloom: [0, 6, 7], hollow: [23], argos: [4, 0],
};
/** Battle b as a new game's setup: the ground, the size, the cap, the victory, who sits where and with what. */
function contBattleSetup(run, b) {
  const t = b.at, T = run.t[t], region = CONT_MAP.T[t].region, seats = b.sides.filter((s) => s !== CONT_MURMUR);
  const murmurOnly = seats.length === 1, three = seats.length > 2, home = T.home >= 0;
  const pick = (arr, k) => arr[contHash(b.seed, k) % arr.length];
  let shapes = CONT_REGION_SHAPES[region] || [0];
  if (three) shapes = shapes.filter((k) => SHAPE_PRESETS[k].ffa).concat(shapes.some((k) => SHAPE_PRESETS[k].ffa) ? [] : [0]);
  const shape = b.kind === 'hollow' ? 23 : pick(shapes, 1);
  const size = home ? 2 : three ? 1 : pick([0, 1], 2);
  const minutes = home ? 35 : 25;
  const level = contIsArgos(t) || run.opts.murmur === 'off' ? 0 : b.kind === 'hollow' ? 3 : T.murmur;
  // you first, then the others in the battle's order: each with its groups' warbots, rank and refits
  const order = seats.includes(0) ? [0, ...seats.filter((s) => s !== 0)] : seats;
  const seat = order.map((s) => {
    const gs = (b.groups[s] || []).map((id) => contGroup(run, id)).filter(Boolean);
    const stars = gs.length ? Math.max(...gs.map((g) => g.stars)) : 1;
    return { side: s, cs: run.sides[s].cs, doctrine: run.sides[s].doctrine || 'balanced', warbots: gs.reduce((a, g) => a + contWarbots(run, g), 0) || (b.defender === s ? 2 : 4),
      stars, refits: run.sides[s].refits.slice(), supply: contSupply(run, s), card: b.cards[s] || null, defender: b.defender === s };
  });
  return {
    biome: CONT_REGIONS[region][1], shape, shapeName: SHAPE_PRESETS[shape].name, size, sizeName: SIZE_PRESETS[size].name, minutes,
    mode: murmurOnly ? 'colony' : 'versus', victory: !murmurOnly && T.uplink && b.kind !== 'hollow' ? 'uplinks' : 'capture',
    murmur: level >= 2 ? 'active' : level === 1 ? 'quiet' : 'off', level, harrow: level >= 3 && (run.meter >= 60 || run.turn >= 20),
    hold: b.kind === 'surge' ? 10 : murmurOnly && b.kind !== 'hollow' ? 12 : 0, kind: b.kind,
    fort: b.defender >= 0 && b.defender !== CONT_MURMUR ? contFortOf(run, t) : 0, mega: T.mega, seat, difficulty: run.opts.difficulty,
    seed: b.seed, flare: run.event === 'flare',
  };
}

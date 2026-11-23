/*
 * Colony goals, records and achievements: display only. Nothing here changes S (or sends an order): it reads the game
 * once a second (metaTick, from uiTick in js/ui.js) and keeps what it learns on this device, in localStorage, wrapped
 * in try/catch so a browser with storage blocked still plays.
 *
 * - Colony goals (COLONY_GOALS): an optional ladder of steps into the deeper systems, in four tiers, for Colony free
 *   play. Each goal counts itself from S (`count(P)`, P = your player); a goal met stays met: its "done" flag goes in
 *   this game's entry on the device (META_GAMES_KEY), keyed by the planet's seed and the time the game started here
 *   (metaStart), so it survives a save and a load without touching the save or the lockstep. The goals button beside
 *   the Goal card (#btn-goals) opens the list (sheet kind 'goals'); finishing one says so in a message.
 * - Records (RECORDS_KEY): fastest win for each map type and rival level, the biggest colony (robots, buildings), the
 *   longest game and the most land held. Single-player free games only (no missions, no multiplayer, nothing with
 *   Boosts, rival bans or Unlimited resources). The Records screen (main menu, More) shows them; the end screen says when one
 *   falls.
 * - Achievements (ACHIEVEMENTS, ACHIEVE_KEY): earned from a game's result and stats (metaGameOver) or from what you do
 *   during one (metaDeeds); a few open a page of the Lore guide from the Records screen.
 * - Challenge modifiers (MODS): a game with some on still counts, and a record or achievement it sets notes them
 *   (`mods`; achievements in ACHIEVE_KEY's `_mods`). A win with one on earns its badge (R0.mods: how many wins, the
 *   hardest rival), shown on the Records screen and on the new-game screen's planet card. A modifier that changes the
 *   pace (MODS[k].pace) keeps the win out of the fastest wins.
 */

const META_GAMES_KEY = 'terrafall.games';
const RECORDS_KEY = 'terrafall.records';
const ACHIEVE_KEY = 'terrafall.achievements';
const META_GAMES_MAX = 12;   // games remembered (for their goal flags), newest first
const META_FLUSH = 15;       // seconds between writes of what only creeps up (the game's clock, a record growing)
const STORM_MIN = 20;        // warbots near a rival Command Base as it falls, for Full escort
const STORM_R = 9;           // ... within this many tiles of it

const META = {
  t: 0, for: null, game: null, gamesDirty: false, flushT: 0,
  rec: null, recDirty: false, ach: null,
  goals: null, primed: false, near: {}, out: {}, cliffs: null, sheetKey: '',
};

/* ------------------------------------------------------------------ storage */

function metaRead(key, def) {
  try { const v = JSON.parse(localStorage.getItem(key) || 'null'); return v && typeof v === 'object' ? v : def; } catch (e) { return def; }
}
function metaWrite(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* storage blocked or full: kept for this session only */ } }

function metaGames() {
  if (!META.games) { const l = metaRead(META_GAMES_KEY, []); META.games = Array.isArray(l) ? l.filter((g) => g && typeof g === 'object' && g.k) : []; }
  return META.games;
}
function metaRecords() {
  if (!META.rec) {
    const r = metaRead(RECORDS_KEY, {});
    META.rec = { fast: {}, beaten: {}, shapes: {}, mods: {}, ...r };
  }
  return META.rec;
}
function metaAchieved() { if (!META.ach) META.ach = metaRead(ACHIEVE_KEY, {}); return META.ach; }
/** This game's challenge modifiers, for a record or an achievement: a list of MODS keys, or undefined with none. */
function metaMods() { const l = S ? gameMods() : []; return l.length ? l : undefined; }
/** The challenge badges won on this device: MODS key → { n: wins with it on, at, best: the hardest rival beaten }. */
function metaModBadges() { const B = metaRecords().mods; return B && typeof B === 'object' ? B : {}; }
/** Modifier keys as names: "Half Fuel, Scarce Crystal". */
function metaModNames(l) { const n = modList(l).map((k) => MODS[k].name); return n.length > 1 ? n.slice(0, -1).join(', ') + ' and ' + n[n.length - 1] : n[0] || ''; }

/** Write what has changed: now (`force`), or at most every META_FLUSH seconds for the things that only creep up. */
function metaFlush(force) {
  if (!force && META.flushT > 0) return;
  META.flushT = META_FLUSH;
  if (META.gamesDirty) { META.gamesDirty = false; metaWrite(META_GAMES_KEY, metaGames().slice(0, META_GAMES_MAX)); }
  if (META.recDirty) { META.recDirty = false; metaWrite(RECORDS_KEY, metaRecords()); }
}

/* ------------------------------------------------------------------ this game */

/** What kind of game this is, for matching a loaded save to its entry: the mode, or the mission. */
function metaMode() { return S.mission ? 'mission:' + (S.mission.id || S.mission.k) : S.mode; }

/**
 * The game in S, as this device knows it: a new game gets a fresh entry (its seed and the time it started here); a
 * game loaded from a save (or rejoined) finds the newest entry for its planet and mode that it could have come from,
 * one not further on than the save is. A save from somewhere else gets an entry of its own.
 */
function metaStart() {
  META.for = S; META.goals = null; META.primed = false; META.near = {}; META.out = {}; META.cliffs = null; META.sheetKey = '';
  const list = metaGames(), mode = metaMode();
  let g = null;
  if (S.time > 5) g = list.filter((e) => e.seed === S.seed && e.mode === mode && (e.t || 0) <= S.time + 120).sort((a, b) => b.born - a.born)[0] || null;
  if (!g) {
    const born = Date.now();
    g = { k: `${S.seed}:${born}`, seed: S.seed, born, mode, t: S.time, done: {}, f: {} };
    list.unshift(g);
    if (list.length > META_GAMES_MAX) list.length = META_GAMES_MAX;
  } else { list.splice(list.indexOf(g), 1); list.unshift(g); }
  g.done = g.done || {}; g.f = g.f || {};
  META.game = g; META.gamesDirty = true;
  for (const Q of S.players) META.out[Q.id] = !!Q.out;
  metaFlush(true);
}

/** Is someone playing this colony (not the computer: the menu's demo, a test's autopilot)? */
function metaWatched() { return !!S && UI.inGame && !!S.players[ME] && !S.players[ME].ai; }
/** Boosts, rival bans or Unlimited resources at any point of this game. */
function metaAssisted() {
  const P = S.players[ME];
  return !!(S.unlimited || (P && P.boosts) || (S.ban && Object.keys(S.ban).length) || (META.game && META.game.f.assist));
}
/** Does this game count for the records and the victory achievements? Single player, free play, no help. */
function metaCounts() { return metaWatched() && !MP.on && !S.mission && !metaAssisted(); }

/* ------------------------------------------------------------------ Colony goals */

const GOAL_TIERS = ['Groundwork', 'Long hauls', 'Across the planet', 'Accord scale'];

/** Your buildings of a type (finished ones only unless `sites`). */
function metaOwn(type, sites) { return S.buildings.filter((b) => !b.dead && b.owner === ME && b.type === type && (sites || b.built)); }
function metaBots(type) { let n = 0; for (const u of S.bots) if (!u.dead && u.owner === ME && u.type === type) n++; return n; }
function metaMade(P, type) { return (P.madeBots && P.madeBots[type]) || 0; }
function metaTechs(P) { return TECH_ORDER.filter((k) => P.tech && P.tech[k]).length; }

/**
 * The ladder. `count(P)` is how far you've got (P is your player; read only), `n` what it takes. `when` leaves a goal
 * out where it can't be done (no sea, no cliffs, no Murmur, no Trade Posts). The panel's button for a goal: `at`
 * jumps to one of your buildings of those types (its panel holds the next step), else `paths` opens that Paths tool,
 * else `build` opens the Build list on that building's tab.
 */
const COLONY_GOALS = [
  { id: 'light', tier: 0, name: 'Right of way', text: 'Put up a traffic light or an overpass.', n: 1,
    hint: 'Paths → Junctions, then tap a crossing where three or four roads meet.', paths: 'lights',
    count: () => (Object.values(S.lights || {}).some((l) => l.owner === ME) || Object.values(S.over || {}).some((o) => o.owner === ME) ? 1 : 0) },
  { id: 'pipe', tier: 0, name: 'Line pressure', text: 'Pipe Crude or Fuel between two buildings.', n: 1,
    hint: 'Tap an Oil Pump → Pipe it in, or a Generator → Pipe Fuel to it. Or Paths → Pipes.', at: ['pump', 'generator', 'charger'], paths: 'pipe',
    count: () => {
      const net = pipeNet(), on = new Map();
      for (const b of S.buildings) {
        if (b.dead || b.owner !== ME || !b.built) continue;
        for (const c of buildingPipes(b, net)) { on.set(c, (on.get(c) || 0) + 1); if (on.get(c) >= 2) return 1; }
      }
      return 0;
    } },
  { id: 'generator', tier: 0, name: 'Power on', text: 'Run a Generator among your factories.', n: 1,
    hint: 'Build → Make → Generator: it burns a Fuel every 40 s, and factories within 4 tiles work a third faster.', build: 'generator',
    count: () => metaOwn('generator').length },
  { id: 'depot', tier: 0, name: 'Forward stores', text: 'Give a Depot supply orders.', n: 1,
    hint: 'Build → Move → Depot out along your roads, then tap it → Supply orders.', at: ['depot'], build: 'depot',
    count: () => metaOwn('depot').filter((b) => b.keep && Object.values(b.keep).some((v) => v > 0)).length },
  { id: 'research', tier: 0, name: 'Open questions', text: 'Finish an upgrade at a Research Lab.', n: 1,
    hint: 'Build → Make → Research Lab, then tap it → Research. A Worker inside does the work.', at: ['lab'], build: 'lab',
    count: (P) => metaTechs(P) },

  { id: 'asphalt', tier: 1, name: 'Passenger standard', text: 'Pave 30 tiles of road with asphalt.', n: 30,
    hint: 'An Asphalt Plant and a Roadworks; then Paths → Pave along your busiest roads. Asphalt roads are the fastest.', at: ['roadworks'], build: 'roadworks',
    count: () => { let n = 0; for (let t = 0; t < S.W * S.H; t++) if (S.pave[t] === 2 && S.road[t] && wayOwner(t) === ME) n++; return n; } },
  { id: 'roadtrain', tier: 1, name: 'Heavy freight', text: 'Build a Road Train.', n: 1,
    hint: 'Tap a Bot Foundry → Order bots: Road Trains +1. It runs between stores 12 or more tiles apart.', at: ['foundry'], build: 'foundry',
    count: (P) => Math.max(metaMade(P, 'roadtrain'), metaBots('roadtrain')) },
  { id: 'train', tier: 1, name: 'Timetable', text: 'Run a Freight Train.', n: 1,
    hint: 'Two Rail Stations joined by track (Paths → Rail), then a station\'s Rail yard: Freight Trains +1.', at: ['station'], build: 'station',
    count: (P) => Math.max(metaMade(P, 'freight'), metaBots('freight')) },
  { id: 'trade', tier: 1, name: 'Accord rates', text: 'Make a run on a trade route at a Trade Terminal.', n: 1, when: () => !!(S.posts && S.posts.length),
    hint: 'Tap a gold Trade Post → Dock a Trade Terminal, then pick Send and Bring back and Start route. A Road Train runs it.', at: ['terminal'], post: true,
    count: (P) => (P.trade && P.trade.sold) || 0 },
  { id: 'nest', tier: 1, name: 'Quiet ground', text: 'Clear a Murmur nest.', n: 1, when: () => !!S.wildlife,
    hint: 'An Outpost near a nest, filled with armed Warbots; then tap the nest and attack it.', nest: true,
    count: (P) => P.stats.captured || 0 },

  { id: 'ropeway', tier: 2, name: 'Cable crossing', text: 'Run a Ropeway.', n: 1,
    hint: 'Paths → Ropeways: a station by your roads, then a far end up to 14 tiles off, across cliffs, water or rock.', paths: 'ropeway',
    count: () => S.buildings.filter((b) => !b.dead && b.owner === ME && b.type === 'ropeway' && b.far).length },
  { id: 'viaduct', tier: 2, name: 'Level span', text: 'Span a valley with a Viaduct.', n: 1, when: () => metaCliffs(),
    hint: 'Paths → Viaducts: tap one clifftop, then another up to 12 tiles across.', paths: 'viaduct',
    count: () => S.buildings.filter((b) => !b.dead && b.owner === ME && b.type === 'viaduct' && b.far).length },
  { id: 'port', tier: 2, name: 'Sea lanes', text: 'Build a Port and a Container Ship.', n: 2, when: () => navalMap(),
    hint: 'Build → Move → Port on a shore, then tap it → Shipyard: Container Ships +1.', at: ['port'], build: 'port',
    count: (P) => (metaOwn('port').length ? 1 : 0) + (Math.max(metaMade(P, 'cargoship'), metaBots('cargoship')) ? 1 : 0) },
  { id: 'airdrop', tier: 2, name: 'Airlift', text: 'Make a Cargo Plane delivery.', n: 1, when: () => !worldBan('airfield'), // (none in the Hollow)
    hint: 'Build → Move → Airfield; its Hangar: Cargo Planes +1. Then Drop Outpost, or switch a building to Supply by air.', at: ['airfield'], build: 'airfield',
    count: () => {
      if (metaOwn('dropost').length) return 1;
      if ((S.drops || []).some((d) => d.owner === ME && d.kind !== 'wreck')) return 1;
      // (A supply run sets airAt when the plane loads: it's delivered once no plane is still on its way there.)
      const flying = new Set(S.bots.filter((u) => !u.dead && u.owner === ME && u.mission && u.mission.kind === 'supply').map((u) => u.mission.to));
      return S.buildings.some((b) => !b.dead && b.owner === ME && b.airAt !== undefined && !flying.has(b.id)) ? 1 : 0;
    } },
  { id: 'airship', tier: 2, name: 'Mooring lines', text: 'Fly goods along an Airship line.', n: 1, when: () => !worldBan('mast'), // (none in the Hollow)
    hint: 'Build → Move → Mooring Mast, twice; tap one → Link, then the other; an Airfield\'s Hangar: Airships +1.', at: ['mast'], build: 'mast',
    count: () => (S.buildings.some((b) => !b.dead && b.owner === ME && b.type === 'mast' && b.shipGot > 0) ? 1 : 0) },

  { id: 'maglev', tier: 3, name: 'Phase 2', text: 'Move goods by Maglev pod.', n: 1,
    hint: 'Build → Move → Maglev Terminal; Paths → Maglev: tap it, then the far end; order pods on a Terminal\'s panel; a Generator by each end.', at: ['magterm'], build: 'magterm',
    count: () => (S.buildings.some((b) => !b.dead && b.owner === ME && b.type === 'magterm' && b.magGot > 0) ? 1 : 0) },
  { id: 'trains3', tier: 3, name: 'Rolling stock', text: 'Have 3 Freight Trains running at once.', n: 3,
    hint: 'More stations along your lines; each Rail yard builds Freight Trains (5 rounds of parts each).', at: ['station'], build: 'station',
    count: () => metaBots('freight') },
  { id: 'alloy', tier: 3, name: 'Foundry output', text: 'Make 100 Alloy a minute.', n: 100, unit: '/min',
    hint: 'A Smelter makes 12 a minute flat out: two or three Ore Mines keep each one busy. Generators and feed links help.', at: ['smelter'], build: 'smelter',
    count: () => Math.floor(goodRates(ME).alloy.made) },
  { id: 'robots', tier: 3, name: 'We make more of us', text: 'Have 100 robots.', n: 100,
    hint: 'Order more at the Bot Foundry. Colony games have room for 150.', at: ['foundry'], build: 'foundry',
    count: () => botCount(ME) },
  { id: 'labdone', tier: 3, name: 'Everything else', text: 'Finish every upgrade at the Research Lab.', n: TECH_ORDER.length,
    hint: 'A second Lab researches twice as fast. Each upgrade costs Chips, Crystal and Alloy.', at: ['lab'], build: 'lab',
    count: (P) => metaTechs(P) },
];

/** Are there cliffs to span (a map with more than one level)? Worked out once a game. */
function metaCliffs() {
  if (META.cliffs === null) { META.cliffs = false; if (S.elev) for (let t = 0; t < S.elev.length; t++) if (S.elev[t] > 0) { META.cliffs = true; break; } }
  return META.cliffs;
}

/** Colony goals are for Colony free play. */
function goalsOn() { return !!S && UI.inGame && S.mode === 'colony' && !S.mission && !!S.players[ME]; }
function goalList() { return COLONY_GOALS.filter((g) => !g.when || g.when()); }

/** Where each goal stands: { have, done } by id. A goal once met stays done (this game's entry on the device). */
function goalsEval() {
  const P = S.players[ME], out = {}, done = META.game.done;
  for (const g of goalList()) {
    if (done[g.id]) { out[g.id] = { have: g.n, done: true }; continue; }
    let have = 0;
    try { have = Math.max(0, Math.floor(g.count(P) || 0)); } catch (e) { have = 0; }
    out[g.id] = { have: Math.min(have, g.n), done: have >= g.n };
  }
  return out;
}

/** Once a second: count the goals, mark the ones newly met (a message for each; none for those met before a load). */
function goalsTick() {
  const st = goalsEval(), list = goalList();
  const fresh = [];
  for (const g of list) {
    if (!st[g.id].done || META.game.done[g.id]) continue;
    META.game.done[g.id] = Math.round(S.time); META.gamesDirty = true;
    if (META.primed) fresh.push(g);
  }
  META.goals = st;
  if (fresh.length) {
    const n = list.filter((g) => st[g.id].done).length;
    for (const g of fresh) toast(`Colony goal: ${g.name}. ${g.text.replace(/\.$/, '')} (${n} of ${list.length} done${n < list.length ? '; the goals button beside the Goal card lists the rest' : ''}).`, 'good');
    sfx('complete');
    const btn = $('btn-goals');
    if (btn) { btn.classList.remove('flash'); void btn.offsetWidth; btn.classList.add('flash'); }
    metaFlush(true);
  }
  META.primed = true;
}

/** The goals button beside the Goal card (from updateHUD): in Colony free play, with how many are done. */
function goalsHUD() {
  const btn = $('btn-goals');
  if (!btn) return;
  const on = goalsOn() && !!META.goals && META.for === S;
  btn.hidden = !on;
  if (!on) return;
  const list = goalList(), n = list.filter((g) => META.goals[g.id] && META.goals[g.id].done).length;
  const txt = `${n}/${list.length}`;
  if (btn.dataset.n !== txt) {
    btn.dataset.n = txt;
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M7 3v18M17 3v18M7 7h10M7 12h10M7 17h10" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>' +
      `<span>${txt}</span>`;
    btn.setAttribute('aria-label', `Colony goals: ${n} of ${list.length} done`);
    btn.title = `Colony goals: ${n} of ${list.length} done`;
  }
}

/** The nearest building of yours of one of these types to the middle of the view, or null. */
function metaNearest(types) {
  let best = null, bd = Infinity;
  for (const b of S.buildings) {
    if (b.dead || b.owner !== ME || !types.includes(b.type)) continue;
    const d = (b.x - R.cam.x) ** 2 + (b.y - R.cam.y) ** 2;
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}

/** What a goal's button does now: [label, run] (or null for none). */
function goalAction(g) {
  const b = g.at && metaNearest(g.at);
  const show = (e) => () => { closeSheet(); setMode('normal'); centerOn(e.x + 0.5, e.y + 0.5); openBuildingSheet(e); };
  if (b) return ['Show', show(b)];
  if (g.nest || g.post) {
    const L = getE(S.players[ME].lander);
    const pool = g.nest ? S.buildings.filter((e) => !e.dead && isNestB(e)) : (S.posts || []);
    const near = L && pool.length ? pool.reduce((a, e) => (dist2(e.x, e.y, L.x, L.y) < dist2(a.x, a.y, L.x, L.y) ? e : a)) : null;
    if (near && g.nest) return ['Show', show(near)];
    if (near) return ['Show', () => { closeSheet(); setMode('normal'); centerOn(near.x + 0.5, near.y + 0.5); openPostSheet(near); }];
  }
  if (g.paths) return [{ lights: 'Junctions', pipe: 'Pipes', ropeway: 'Ropeways', viaduct: 'Viaducts', rail: 'Rail', pave: 'Pave' }[g.paths] || 'Paths', () => { closeSheet(); openPaths(g.paths); }];
  if (g.build && BDEFS[g.build]) {
    return ['Build', () => {
      closeSheet(); setMode('normal');
      const grp = BUILD_GROUPS.find((x) => x.types.includes(g.build));
      UI.buildTab = grp ? grp.key : 'all';
      openBuildMenu();
      const card = $('sheet-body').querySelector(`.build-grid .bcard[data-t="${g.build}"]:not([hidden])`);
      if (card) { card.classList.add('goal-pick'); card.scrollIntoView({ block: 'nearest' }); }
    }];
  }
  return null;
}

/** The goals panel (the goals button): land milestones, then the ladder, tier by tier. */
function openGoalsSheet() {
  if (!goalsOn()) return;
  if (META.for !== S) metaStart();
  if (!META.goals) META.goals = goalsEval();
  META.sheetKey = '';
  openSheet('goals', 0, '<div id="gl-wrap"></div>');
  refreshGoalsSheet();
}

/**
 * Built again only when what's on it changes shape (a goal done, a button that now does something else), so a tap
 * on a button isn't lost to the counts ticking over: the counts are written into the rows in place.
 */
function refreshGoalsSheet() {
  const wrap = $('gl-wrap');
  if (!wrap || !goalsOn() || !META.goals) return;
  const list = goalList(), st = META.goals, next = list.find((g) => !st[g.id].done);
  const acts = {};
  for (const g of list) if (!st[g.id].done) acts[g.id] = goalAction(g);
  const key = list.map((g) => `${g.id}${st[g.id].done ? '+' : '-'}${acts[g.id] ? acts[g.id][0] : ''}`).join(',');
  const done = list.filter((g) => st[g.id].done).length;
  if (key !== META.sheetKey) {
    META.sheetKey = key;
    const rows = GOAL_TIERS.map((name, k) => {
      const gs = list.filter((g) => g.tier === k);
      if (!gs.length) return '';
      const nd = gs.filter((g) => st[g.id].done).length;
      return `<div class="gl-tier"><h4><span class="gl-num">${['I', 'II', 'III', 'IV'][k]}</span>${name}<span class="gl-tc">${nd}/${gs.length}</span></h4>` +
        gs.map((g) => {
          const s = st[g.id], a = acts[g.id];
          return `<div class="gl-row${s.done ? ' done' : ''}${g === next ? ' next' : ''}" data-id="${g.id}">` +
            `<span class="gl-mark" aria-hidden="true">${s.done ? '✓' : ''}</span>` +
            `<div class="gl-main"><div class="gl-head"><b>${g.name}</b>${g === next ? '<span class="gl-tag">Next</span>' : ''}<span class="gl-prog"></span></div>` +
            `<div class="gl-text">${g.text}</div>${s.done ? '' : `<div class="gl-hint">${g.hint}</div>`}</div>` +
            (a ? `<button class="btn small gl-go" data-go="${g.id}">${a[0]}</button>` : '') + '</div>';
        }).join('') + '</div>';
    }).join('');
    wrap.innerHTML = `<div class="sheet-title"><div><h3>Colony goals</h3></div></div>
      <p class="desc">Optional steps into the colony's deeper systems, in four tiers: <b id="gl-sum"></b>. A goal once met stays met.</p>
      <div class="gl-land" id="gl-land"></div>${rows}`;
    for (const btn of wrap.querySelectorAll('[data-go]')) {
      btn.onclick = () => { const g = COLONY_GOALS.find((x) => x.id === btn.dataset.go), a = g && goalAction(g); sfx('click'); if (a) a[1](); };
    }
  }
  $('gl-sum').textContent = `${done} of ${list.length} done`;
  for (const g of list) {
    const el = wrap.querySelector(`.gl-row[data-id="${g.id}"] .gl-prog`), s = st[g.id];
    const txt = s.done ? 'Done' : g.n > 1 ? `${s.have}/${g.n}${g.unit || ''}` : '';
    if (el && el.textContent !== txt) el.textContent = txt;
  }
  // The land milestones (COLONY_MILESTONES), as the Goal card has them.
  const pct = Math.floor(landShare(ME) * 100), ms = COLONY_MILESTONES, nextM = ms[S.milestone];
  const land = `<span>Land held <b>${pct}%</b></span><span class="gl-pips">${ms.map((m, k) => `<i class="${k < S.milestone ? 'on' : ''}" title="${Math.round(m * 100)}%"></i>`).join('')}</span>` +
    `<span>${nextM !== undefined ? `next milestone ${Math.round(nextM * 100)}%` : 'every milestone reached'}</span>`;
  if ($('gl-land').innerHTML !== land) $('gl-land').innerHTML = land;
}

/* ------------------------------------------------------------------ records */

/** A record went up: kept (and written soon), and noted on this game's entry if it beat an earlier one. */
function metaRecord(kind, val, extra) {
  const R0 = metaRecords(), old = R0[kind];
  if (old && old.v >= val) return;
  R0[kind] = { v: val, at: Date.now(), k: META.game.k, mode: S.mode, shape: metaShape(), mods: metaMods(), ...(extra || {}) };
  META.recDirty = true;
  if (old && old.k !== META.game.k) { (META.game.f.fell = META.game.f.fell || {})[kind] = old.v; META.gamesDirty = true; }
}
function metaShape() { const sh = SHAPE_PRESETS[(S.settings && S.settings.shape) || 0]; return sh ? sh.name : 'Standard'; }

/** Once a second in a game that counts: the colony's size, the clock and the land. */
function metaRecordsTick() {
  let blds = 0;
  for (const b of S.buildings) if (!b.dead && b.owner === ME && b.built && b.type !== 'wall' && b.type !== 'gate' && b.type !== 'ramp') blds++;
  metaRecord('robots', botCount(ME));
  metaRecord('blds', blds);
  metaRecord('longest', Math.floor(S.time));
  metaRecord('land', Math.round(landShare(ME) * 1000) / 10);
}

/* ------------------------------------------------------------------ achievements */

/*
 * `lore`: a page of the Lore guide the Records screen links to. `of` / `have`: a count to show on the way there.
 * Victory ones need a game against the computer that counts (metaCounts); the rest (deeds) any game played without
 * help, multiplayer and missions included.
 */
const ACHIEVEMENTS = [
  { id: 'win', name: 'Command authority transferred', text: 'Win a game against the computer.' },
  { id: 'win-hard', name: 'Probability revised', text: 'Win against a Commander rival (or a Warlord).' },
  { id: 'win-warlord', name: 'No further instructions', text: 'Win against a Warlord rival.' },
  { id: 'no-turret', name: 'Open roads', text: 'Win against a Colonist rival or harder without building a Pulse Turret.' },
  { id: 'storm', name: 'Full escort', text: `Capture a rival Command Base with ${STORM_MIN} or more of your warbots round it (not against a Settler).` },
  { id: 'ffa', name: 'Last colony standing', text: 'Win a free-for-all against two or three rivals.' },
  { id: 'domination', name: 'Settlement priority', text: 'Win by Domination.', lore: 'ls-standards' },
  { id: 'uplinks', name: 'One voice', text: 'Win on the Uplinks.', lore: 'ls-neutral' },
  { id: 'shapes', name: 'Survey complete', text: 'Win on every map type.', of: () => SHAPE_PRESETS.length, have: (R0) => SHAPE_PRESETS.filter((s) => R0.shapes[s.name]).length },
  { id: 'beat-balanced', name: 'The roads are finished', text: 'Beat a Steward, Pioneer or harder.', lore: 'ls-doctrines' },
  { id: 'beat-turtle', name: 'Relief has not arrived', text: 'Beat a Warden, Pioneer or harder.', lore: 'ls-doctrines' },
  { id: 'beat-raider', name: 'It was yours anyway', text: 'Beat a Salvager, Pioneer or harder.', lore: 'ls-doctrines' },
  { id: 'beat-rusher', name: 'Arrival in one d—', text: 'Beat a Herald, Pioneer or harder.', lore: 'ls-doctrines' },
  { id: 'beat-tycoon', name: 'Mind the paving', text: 'Beat an Architect, Pioneer or harder.', lore: 'ls-doctrines' },
  { id: 'beat-all', name: 'Every doctrine answered', text: 'Beat all five rival doctrines.', lore: 'ls-doctrines', of: () => PERSONALITY_ORDER.length, have: (R0) => PERSONALITY_ORDER.filter((k) => R0.beaten[k]).length },
  { id: 'ropeway', name: 'Cable crossing', text: 'Run your first Ropeway.' },
  { id: 'train', name: 'Timetable', text: 'Run your first Freight Train.' },
  { id: 'nest', name: 'Anomaly cleared', text: 'Clear a Murmur nest.', lore: 'ls-murmur' },
  { id: 'labdone', name: 'Everything else', text: 'Finish every upgrade at the Research Lab in one game.' },
  { id: 'colony', name: 'Prepared land', text: 'Reach the last Colony milestone: 80% of the land.', lore: 'ls-standards' },
  { id: 'goals', name: 'Build phase complete', text: 'Finish every Colony goal in one game.' },
  { id: 'mission', name: 'Basic training', text: 'Finish a mission.' },
  { id: 'campaign', name: 'Every chapter', text: 'Finish every mission, at any level.' },
];

/** Earn one (once, ever, on this device): a message in a game still going, the end screen's list otherwise. */
function metaEarn(id) {
  const A = metaAchieved(), a = ACHIEVEMENTS.find((x) => x.id === id);
  if (!a || A[id]) return false;
  A[id] = Date.now();
  // (earned in a game with challenge modifiers on: which, for the Records screen)
  const mods = UI.inGame && META.for === S ? metaMods() : undefined;
  if (mods) (A._mods = A._mods && typeof A._mods === 'object' ? A._mods : {})[id] = mods;
  metaWrite(ACHIEVE_KEY, A);
  if (META.game && META.for === S) { (META.game.f.ach = META.game.f.ach || []).push(id); META.gamesDirty = true; }
  if (UI.inGame && S && S.winner < 0 && $('screen-over').hidden) { toast(`Achievement: ${a.name}. ${a.text}`, 'good'); sfx('complete'); }
  return true;
}

/** Things done in a game (any game played without help), looked at once a second. */
function metaDeeds() {
  const A = metaAchieved(), P = S.players[ME];
  if (!A.ropeway && S.buildings.some((b) => !b.dead && b.owner === ME && b.type === 'ropeway' && b.far)) metaEarn('ropeway');
  if (!A.train && metaMade(P, 'freight') > 0) metaEarn('train');
  if (!A.nest && S.mode === 'colony' && S.wildlife && (P.stats.captured || 0) > 0) metaEarn('nest');
  if (!A.labdone && metaTechs(P) >= TECH_ORDER.length) metaEarn('labdone');
  if (!A.colony && S.mode === 'colony' && !S.mission && S.milestone >= COLONY_MILESTONES.length) metaEarn('colony');
  if (!A.goals && goalsOn() && META.goals) { const l = goalList(); if (l.length && l.every((g) => META.goals[g.id] && META.goals[g.id].done)) metaEarn('goals'); }
}

/**
 * A rival Command Base storming: how many of your armed robots are near each rival's base, kept over the last few
 * seconds; when that rival falls with its base in your hands, that count decides Full escort. (Its own robots are
 * scrapped as it falls, so only yours are near it then.)
 */
function metaStormTick() {
  if (S.mode !== 'versus') return;
  for (const Q of S.players) {
    if (Q.absent || Q.id === ME || !foes(Q.id, ME)) continue;
    const L = getE(Q.lander);
    if (!Q.out) {
      let n = 0;
      if (L && !L.dead) for (const u of S.bots) if (!u.dead && u.owner === ME && isArmy(u) && dist2(u.x, u.y, L.x + 0.5, L.y + 0.5) <= STORM_R * STORM_R) n++;
      const h = META.near[Q.id] = META.near[Q.id] || [];
      h.push(n); if (h.length > 4) h.shift();
    }
    if (Q.out && !META.out[Q.id]) {
      META.out[Q.id] = true;
      const most = Math.max(0, ...(META.near[Q.id] || []));
      if (L && !L.dead && L.owner === ME && most >= STORM_MIN && (S.diffLow || S.difficulty) !== 'easy' && metaCounts()) metaEarn('storm');
    }
  }
}

/** The missions finished on this device (js/missions.js keeps them): Basic training, Every chapter. */
function metaCampaign() {
  if (typeof loadCampaign !== 'function' || typeof MISSIONS === 'undefined') return;
  const done = loadCampaign().done || {}, fin = (m) => Array.isArray(done[m.id]) && done[m.id].some(Boolean);
  if (MISSIONS.some(fin)) metaEarn('mission');
  if (MISSIONS.length && MISSIONS.every(fin)) metaEarn('campaign');
}

/* ------------------------------------------------------------------ the clock */

/** From uiTick: once a second of real time, while a game is on screen. */
function metaTick(dt) {
  META.flushT -= dt;
  META.t -= dt;
  if (META.t > 0) return;
  META.t = 1;
  if (!S || !UI.inGame || !S.players[ME]) return;
  try {
    if (META.for !== S) metaStart();
    if (Math.abs((META.game.t || 0) - S.time) >= 5) { META.game.t = Math.round(S.time); META.gamesDirty = true; }
    if (!metaWatched()) return;
    const P = S.players[ME];
    // (Help at any point keeps the whole game out of the records; a Pulse Turret site of yours is one you built.)
    if (!META.game.f.assist && (S.unlimited || P.boosts || (S.ban && Object.keys(S.ban).length))) { META.game.f.assist = 1; META.gamesDirty = true; }
    if (!META.game.f.turret && S.winner < 0 && S.buildings.some((b) => !b.dead && b.owner === ME && b.type === 'turret' && !b.built)) { META.game.f.turret = 1; META.gamesDirty = true; }
    if (goalsOn()) goalsTick();
    if (metaCounts()) metaRecordsTick();
    if (!metaAssisted()) { metaDeeds(); metaStormTick(); }
    if (UI.sheetKind === 'goals') refreshGoalsSheet();
    metaFlush(false);
  } catch (e) { console.error('Terrafall: goals and records skipped a beat.', e); }
}

/* ------------------------------------------------------------------ the end of a game */

/**
 * From the end screen (showGameOver, showMissionOver): the result's records and achievements, listed under the stats
 * (#o-meta). A game's win counts once, even if the screen comes up again (playing on past a victory, then losing).
 */
function metaGameOver() {
  const box = $('o-meta');
  if (box) { box.hidden = true; box.innerHTML = ''; }
  if (!S || !S.players[ME]) return;
  try {
    if (META.for !== S) metaStart();
    const g = META.game, lines = [];
    if (metaWatched() && !metaAssisted()) { metaStormTick(); metaDeeds(); }
    if (S.mission) metaCampaign();
    const won = S.winner === ME || allies(S.winner, ME);
    if (!g.f.ended && S.mode === 'versus' && metaCounts()) {
      g.f.ended = 1; META.gamesDirty = true;
      metaRecordsTick();
      const R0 = metaRecords();
      if (won) {
        const shape = metaShape(), diff = S.diffLow || S.difficulty, t = Math.floor(S.time), mods = metaMods();
        const row = R0.fast[shape] = R0.fast[shape] || {}, old = row[diff];
        // (a modifier that changes the pace, Fragile robots, keeps it out of the fastest wins)
        const pace = (mods || []).filter((k) => MODS[k].pace);
        if (pace.length) g.f.pace = pace;
        else if (!old || t < old.t) {
          row[diff] = { t, at: Date.now(), k: g.k, mods };
          g.f.fast = { shape, diff, t, was: old ? old.t : null, mods };
        }
        // A challenge badge for each modifier on: how many wins with it, and the hardest rival beaten with it on.
        if (mods) {
          const B = R0.mods = metaModBadges(), lv = Object.keys(DIFFICULTY), fresh = [];
          for (const k of mods) {
            const b0 = B[k];
            if (!b0) fresh.push(k);
            B[k] = { n: ((b0 && b0.n) || 0) + 1, at: Date.now(), best: b0 && lv.indexOf(b0.best) > lv.indexOf(diff) ? b0.best : diff };
          }
          g.f.won = { mods, fresh };
        }
        R0.shapes[shape] = 1;
        R0.wins = (R0.wins || 0) + 1;
        if (diff !== 'easy') for (const Q of S.players) if (!Q.absent && Q.ai && foes(Q.id, ME) && isDoctrine(Q.style)) R0.beaten[Q.style] = 1;
        META.recDirty = true;
        metaEarn('win');
        if (diffAtLeast('hard', diff)) metaEarn('win-hard');
        if (diff === 'warlord') metaEarn('win-warlord');
        if (diffAtLeast('normal', diff) && !g.f.turret) metaEarn('no-turret');
        if (nColonies() > 2 && !S.teams) metaEarn('ffa');
        if (S.endHow === 'domination') metaEarn('domination');
        if (S.endHow === 'uplinks') metaEarn('uplinks');
        if (SHAPE_PRESETS.every((s) => R0.shapes[s.name])) metaEarn('shapes');
        for (const k of PERSONALITY_ORDER) if (R0.beaten[k]) metaEarn('beat-' + k);
        if (PERSONALITY_ORDER.every((k) => R0.beaten[k])) metaEarn('beat-all');
      }
    }
    metaFlush(true);
    // What fell in this game: the fastest win, and the other records this game holds that beat an earlier one.
    const R0 = metaRecords(), f = g.f;
    if (f.fast) lines.push(['rec', `New record: fastest win on ${f.fast.shape}, ${DIFFICULTY[f.fast.diff].label}: ${fmtTime(f.fast.t)}` + (f.fast.was != null ? ` (was ${fmtTime(f.fast.was)})` : '') + (f.fast.mods ? `, with ${metaModNames(f.fast.mods)}.` : '.')]);
    if (f.won) {
      const nw = f.won.fresh || [];
      const all = nw.length === f.won.mods.length;
      lines.push(['badge', `Won with ${metaModNames(f.won.mods)}` + (!nw.length ? '.' : all ? `: ${nw.length > 1 ? 'a new challenge badge for each' : 'a new challenge badge'} (Records).`
        : `: new challenge badge${nw.length > 1 ? 's' : ''} for ${metaModNames(nw)} (Records).`)]);
    }
    if (f.pace) lines.push(['badge', `${metaModNames(f.pace)} changes the pace of a game, so this win isn't counted among the fastest wins.`]);
    const fell = RECORD_KINDS.filter(([kind]) => f.fell && f.fell[kind] !== undefined && R0[kind] && R0[kind].k === g.k);
    if (fell.length) lines.push(['rec', (f.fast ? 'And ' : 'New ') + (fell.length > 1 ? 'records: ' : 'record: ') + fell.map(([kind, , said, fmt]) => `${said} ${fmt(R0[kind].v)}`).join(', ') + '.']);
    for (const id of f.ach || []) { const a = ACHIEVEMENTS.find((x) => x.id === id); if (a) lines.push(['ach', `Achievement: ${a.name}. ${a.text}`]); }
    // (Each said once: played on past a victory and then lost, the second end screen has only what's new since.)
    const said = f.said || [], fresh = lines.filter(([, t]) => !said.includes(t));
    f.said = said.concat(fresh.map(([, t]) => t)); META.gamesDirty = true; metaFlush(true);
    if (box && fresh.length) {
      box.innerHTML = fresh.map(([k, t]) => `<div class="om-${k}"><i aria-hidden="true">${k === 'rec' ? '★' : '◆'}</i><span>${esc(t)}</span></div>`).join('');
      box.hidden = false;
    }
  } catch (e) { console.error('Terrafall: the end-of-game records failed.', e); }
}

/* ------------------------------------------------------------------ the Records screen (main menu) */

/** A long game's length: 1:05:12, or 42:10 under an hour. */
function metaClock(s) {
  s = Math.max(0, Math.floor(s));
  return s >= 3600 ? `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : fmtTime(s);
}
/** The records kept besides the fastest wins: key, name on the Records screen, words on the end screen, format. */
const RECORD_KINDS = [
  ['longest', 'Longest game', 'longest game', (v) => metaClock(v)],
  ['land', 'Most land held', 'most land held', (v) => `${v}%`],
  ['robots', 'Biggest colony: robots', 'most robots', (v) => `${v}`],
  ['blds', 'Biggest colony: buildings', 'most buildings', (v) => `${v}`],
];

function metaDate(ms) { try { return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return ''; } }

function renderRecords() {
  const R0 = metaRecords(), A = metaAchieved();
  const tiles = RECORD_KINDS.map(([kind, label, , fmt]) => {
    const r = R0[kind];
    const sub = r ? [r.mode === 'colony' ? 'Colony' : 'Versus', r.shape].filter(Boolean).join(' · ') : 'None yet';
    return `<div class="rc-tile"><span>${label}</span><b>${r ? fmt(r.v) : '–'}</b><small>${esc(sub)}</small>${r ? `<small>${metaDate(r.at)}</small>` : ''}` +
      (r && modList(r.mods).length ? `<small class="rc-mods" title="${esc('With ' + metaModNames(r.mods))}"><i class="rc-modmark" aria-hidden="true">◆</i> ${esc(metaModNames(r.mods))}</small>` : '') + '</div>';
  }).join('');
  const shapes = SHAPE_PRESETS.filter((s) => R0.fast[s.name]);
  const diffs = Object.keys(DIFFICULTY);
  const fast = shapes.length
    ? `<table class="rc-fast"><thead><tr><th>Map type</th>${diffs.map((d) => `<th>${DIFFICULTY[d].label}</th>`).join('')}</tr></thead><tbody>` +
      shapes.map((s) => `<tr><th>${esc(s.name)}</th>${diffs.map((d) => { const r = R0.fast[s.name][d], m = r && modList(r.mods).length ? metaModNames(r.mods) : ''; return `<td>${r ? fmtTime(r.t) : '–'}${m ? `<i class="rc-modmark" title="${esc('With ' + m)}" aria-label="${esc('with ' + m)}">◆</i>` : ''}</td>`; }).join('')}</tr>`).join('') + '</tbody></table>'
    : '<p class="hint">No wins yet. Win a Versus game against the computer and its time goes here, by map type and rival level.</p>';
  // Challenge badges: one for each modifier won with (Custom Game's Challenge section).
  const B = metaModBadges(), nb = MOD_ORDER.filter((k) => B[k]).length;
  const badges = MOD_ORDER.map((k) => {
    const b = B[k], on = !!(b && b.n);
    return `<div class="rc-badge${on ? ' on' : ''}" title="${esc(MODS[k].desc)}"><i aria-hidden="true">${on ? '◆' : '◇'}</i><div><b>${esc(MODS[k].name)}</b>` +
      `<small>${on ? `${b.n} win${b.n > 1 ? 's' : ''}${DIFFICULTY[b.best] ? ` · best: ${DIFFICULTY[b.best].label}` : ''}` : 'Not yet'}</small></div></div>`;
  }).join('');
  const AM = A._mods && typeof A._mods === 'object' ? A._mods : {};
  const got = ACHIEVEMENTS.filter((a) => A[a.id]).length;
  const achs = ACHIEVEMENTS.map((a) => {
    const on = !!A[a.id], prog = !on && a.of ? ` <span class="rc-of">${a.have(R0)}/${a.of()}</span>` : '';
    return `<div class="rc-ach${on ? ' on' : ''}"><i aria-hidden="true">${on ? '◆' : '◇'}</i><div><b>${esc(a.name)}</b>${prog}<p>${esc(a.text)}</p>` +
      `<small>${on ? 'Earned ' + metaDate(A[a.id]) + (modList(AM[a.id]).length ? ` · with ${esc(metaModNames(AM[a.id]))}` : '') : 'Not yet'}</small>` +
      (a.lore && on ? `<button type="button" class="btn small ghost rc-lore" data-lore-at="${a.lore}">Lore ›</button>` : '') + '</div></div>';
  }).join('');
  $('rc-body').innerHTML = `<p class="mode-desc">Kept on this device. Records and wins count single-player Versus and Colony games (not missions or multiplayer) played without Boosts, rival bans or Unlimited resources. Challenge modifiers count, and are noted (<i class="rc-modmark">◆</i>); a win with Fragile robots isn't a fastest win.</p>
    <div class="rc-tiles">${tiles}</div>
    <h3>Fastest wins</h3>${fast}
    <h3>Challenge badges <span class="rc-count">${nb} of ${MOD_ORDER.length}</span></h3>
    <p class="hint">Win a Versus game against the computer with a challenge modifier on (Custom Game, Challenge) and it earns that one's badge.</p>
    <div class="rc-badges">${badges}</div>
    <h3>Achievements <span class="rc-count">${got} of ${ACHIEVEMENTS.length}</span></h3><div class="rc-achs">${achs}</div>
    <div class="rc-foot"><button type="button" class="btn small ghost" id="rc-forget">Forget records and achievements</button></div>`;
  for (const b of $('rc-body').querySelectorAll('[data-lore-at]')) b.onclick = () => { sfx('click'); openLore(b.dataset.loreAt); };
  $('rc-forget').onclick = () => {
    const b = $('rc-forget');
    if (!b.classList.contains('arm')) { b.classList.add('arm'); b.textContent = 'Tap again to forget them all on this device'; return; }
    META.rec = { fast: {}, beaten: {}, shapes: {}, mods: {} }; META.ach = {};
    try { localStorage.removeItem(RECORDS_KEY); localStorage.removeItem(ACHIEVE_KEY); } catch (e) { /* storage blocked */ }
    sfx('click');
    renderRecords();
  };
}

function openRecords() {
  metaCampaign(); // (missions finished before achievements existed count too)
  renderRecords();
  $('screen-records').hidden = false;
  $('rc-body').scrollTop = 0;
  try { history.pushState({ records: 1 }, ''); } catch (e) { /* no history to add to (a sandboxed frame) */ }
}

function closeRecords(fromBack) {
  if ($('screen-records').hidden) return;
  $('screen-records').hidden = true;
  if (!fromBack) try { if (history.state && history.state.records) history.back(); } catch (e) { /* as above */ }
}

/** From initUI: the Records button and screen, the goals button, and a last write when the page goes. */
function initMeta() {
  if ($('m-records')) $('m-records').onclick = () => { sfx('click'); openRecords(); };
  if ($('rc-close')) $('rc-close').onclick = () => { sfx('click'); closeRecords(); };
  if ($('btn-goals')) $('btn-goals').onclick = () => { sfx('click'); if (UI.sheetKind === 'goals') closeSheet(); else openGoalsSheet(); };
  // Esc and the phone's Back close the screen (the Lore guide over it closes first: see initMenu and initLore).
  window.addEventListener('keydown', (e) => {
    if (UI.inGame || e.key !== 'Escape' || e.defaultPrevented || $('screen-records').hidden || !$('screen-lore').hidden) return;
    e.preventDefault(); closeRecords();
  });
  window.addEventListener('popstate', () => { if (!UI.inGame && !(history.state && history.state.records)) closeRecords(true); });
  window.addEventListener('pagehide', () => metaFlush(true));
}

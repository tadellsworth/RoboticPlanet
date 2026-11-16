/*
 * Colony goals: display only. Nothing here changes S (or sends an order): it reads the game once a second (metaTick,
 * from uiTick in js/ui.js) and keeps what it learns on this device, in localStorage, wrapped in try/catch so a browser
 * with storage blocked still plays.
 *
 * - Colony goals (COLONY_GOALS): an optional ladder of steps into the deeper systems, in four tiers, for Colony free
 *   play. Each goal counts itself from S (`count(P)`, P = your player); a goal met stays met: its "done" flag goes in
 *   this game's entry on the device (META_GAMES_KEY), keyed by the planet's seed and the time the game started here
 *   (metaStart), so it survives a save and a load without touching the save or the lockstep. The goals button beside
 *   the Goal card (#btn-goals) opens the list (sheet kind 'goals'); finishing one says so in a message.
 */

const META_GAMES_KEY = 'terrafall.games';
const META_GAMES_MAX = 12;   // games remembered (for their goal flags), newest first
const META_FLUSH = 15;       // seconds between writes of what only creeps up (the game's clock, a record growing)

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

/** Write what has changed: now (`force`), or at most every META_FLUSH seconds for the things that only creep up. */
function metaFlush(force) {
  if (!force && META.flushT > 0) return;
  META.flushT = META_FLUSH;
  if (META.gamesDirty) { META.gamesDirty = false; metaWrite(META_GAMES_KEY, metaGames().slice(0, META_GAMES_MAX)); }
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
    hint: 'Tap an Oil Pump → Pipe it to the Refinery, or a Generator → Pipe Fuel to it. Or Paths → Pipes.', at: ['pump', 'generator', 'charger'], paths: 'pipe',
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
  { id: 'trade', tier: 1, name: 'Accord rates', text: 'Fill a contract at a Trade Terminal.', n: 1, when: () => !!(S.posts && S.posts.length),
    hint: 'Tap a gold Trade Post → Dock a Trade Terminal, then Take a contract. A Road Train hauls the lot.', at: ['terminal'], post: true,
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
  { id: 'airdrop', tier: 2, name: 'Airlift', text: 'Make a Cargo Plane delivery.', n: 1,
    hint: 'Build → Move → Airfield; its Hangar: Cargo Planes +1. Then Drop Outpost, or switch a building to Supply by air.', at: ['airfield'], build: 'airfield',
    count: () => {
      if (metaOwn('dropost').length) return 1;
      if ((S.drops || []).some((d) => d.owner === ME && d.kind !== 'wreck')) return 1;
      // (A supply run sets airAt when the plane loads: it's delivered once no plane is still on its way there.)
      const flying = new Set(S.bots.filter((u) => !u.dead && u.owner === ME && u.mission && u.mission.kind === 'supply').map((u) => u.mission.to));
      return S.buildings.some((b) => !b.dead && b.owner === ME && b.airAt !== undefined && !flying.has(b.id)) ? 1 : 0;
    } },

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
    const pool = g.nest ? S.buildings.filter((e) => !e.dead && BDEFS[e.type].wild) : (S.posts || []);
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
    if (UI.sheetKind === 'goals') refreshGoalsSheet();
    metaFlush(false);
  } catch (e) { console.error('Terrafall: goals and records skipped a beat.', e); }
}

/** From initUI: the goals button, and a last write when the page goes. */
function initMeta() {
  if ($('btn-goals')) $('btn-goals').onclick = () => { sfx('click'); if (UI.sheetKind === 'goals') closeSheet(); else openGoalsSheet(); };
  window.addEventListener('pagehide', () => metaFlush(true));
}

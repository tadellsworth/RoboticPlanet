'use strict';
/*
 * Terrafall — orders. Every change a player makes to the game goes through one of these: a name and plain arguments
 * (numbers, strings, ids, lists of ids, small plain objects), never live objects. In a single-player game the screens'
 * act() (ui.js) runs it at once; in multiplayer it's sent to every device and run on each at the same tick (see
 * lockstep.js), so every device plays the same game. applyOrder(p, name, args) runs order `name` for player p: each
 * checks that what it's given is p's to command (a building, a robot, a road) before it acts, and gives back what the
 * game function behind it gives back (the screens tell the player how it went).
 */

/** Building `id` if it's player p's (and still there), else null. A megastructure knocked out or offline (MEGA) is no one's to command. */
function ownB(p, id) { const e = getE(id); return e && !e.dead && e.owner === p && BDEFS[e.type] && S.buildings.includes(e) && !(e.mDown || e.mOff) ? e : null; }
/** Robot (or vehicle) `id` if it's player p's (and still there, and of a kind with BOTS[type][flag], if flag), else null. */
function ownU(p, id, flag) { const e = getE(id); return e && !e.dead && e.owner === p && BOTS[e.type] && S.bots.includes(e) && (!flag || BOTS[e.type][flag]) ? e : null; }
/** The ids in `ids` that are player p's robots. */
function ownIds(p, ids) { return Array.isArray(ids) ? ids.filter((id) => !!ownU(p, id)) : []; }
/** Building `id` (anyone's), if it's still there. */
function liveB(id) { const e = getE(id); return e && !e.dead && BDEFS[e.type] && S.buildings.includes(e) ? e : null; }
/** Robot `id` (anyone's), if it's still there. */
function liveU(id) { const e = getE(id); return e && !e.dead && BOTS[e.type] && S.bots.includes(e) ? e : null; }
/** A building or a robot (anyone's), if it's still there. */
function liveE(id) { return liveB(id) || liveU(id); }
/** How many warbots an order sends: `want` of the `avail` that can go (-1: all of them). */
function armyN(want, avail) { return want < 0 ? avail : Math.min(avail, want | 0); }

/**
 * The computer colonies the pause menu's Rival difficulty changes (ORDERS.rivalDifficulty): every computer colony still
 * in, not a person's seat (in multiplayer one can reconnect). None where the level is fixed: a mission, a Contingency
 * battle (Ironman or not: its campaign set it), a watched game.
 */
function rivalDifficultyFixed() { return !!(S.mission || S.contingency || S.watch); }
function rivalDifficultyTargets() {
  if (rivalDifficultyFixed()) return [];
  const multiplayer = typeof MP !== 'undefined' && MP.on;
  const humanColonies = multiplayer ? new Set(MP.humans.map(mpCol)) : null;
  return S.players.filter((r) => r.ai && !r.out && !r.absent && !isWild(r.id) && !humanColonies?.has(r.id));
}

const ORDERS = {
  rivalDifficulty(p, diff) {
    if (rivalDifficultyFixed() || S.winner >= 0 || !human(p) || !ownKey(DIFFICULTY, diff)) return false;
    if (typeof MP !== 'undefined' && MP.on) {
      // Check the sender's person seat, including co-op. Current connection status can be ahead of this turn.
      const host = MP.humans.find((seat) => !mpAI(seat, MP.turn));
      if (ORDER_BY < 0 || ORDER_BY !== host || mpCol(ORDER_BY) !== p) return false;
    } else if (p !== 0) return false;
    const rivals = rivalDifficultyTargets();
    if (!rivals.length) return false;
    if (S.difficulty === diff) return true;
    const after = DIFFICULTY[diff];
    // (the easiest level they were at this game, S.diffLow: records and achievements go by it, so Hard for the last
    // minute of a win is no Hard win)
    if (DIFF_ORDER.indexOf(diff) < DIFF_ORDER.indexOf(S.diffLow || S.difficulty)) S.diffLow = diff;
    else if (!S.diffLow) S.diffLow = S.difficulty;
    S.difficulty = diff;
    for (const r of rivals) {
      // (keeping its personality's economy bonus, as newGame gives it, and the Tools tech's)
      const econ = (r.style && PERSONALITIES[r.style] && PERSONALITIES[r.style].econ) || 1;
      r.mult = after.mult * econ * (tech(r.id, 'tools') ? 1.15 : 1);
      r.aiT = Math.min(r.aiT || 0, after.think);
    }
    const who = typeof MP !== 'undefined' && MP.on ? `${playerName(p)} set the rival difficulty to ${after.label}` : `Rival difficulty is now ${after.label}`;
    for (const r of S.players) if (!r.ai && !r.absent && !isWild(r.id)) postMsg(r.id, `${who}: the computer colonies play at that level from now on.`, undefined, undefined, 'info');
    return true;
  },
  /**
   * Surrender (the pause menu, confirmed first): player p gives up to the rival beating it (surrenderTo), which takes
   * everything it had, as when a Command Base falls. Versus games only (not Colony, a mission or a watched game).
   */
  /** Contingency: play card i of p's hand in this battle (at tile x, y for those aimed): js/contingency-battle.js. */
  contCard(p, i, x, y) { return typeof contPlayCard === 'function' && !!S.contingency && contPlayCard(p, i, x, y); },
  /**
   * Let fallen teammate q help command p's colony (on), or take it back (off): while q is down (FALLEN), its people's
   * orders go to p's colony (mpOrderCol). Only p's own people can give it (not q helping). It ends by itself when q is
   * back, or p falls too.
   */
  lend(p, q, on) {
    if (!Number.isInteger(q) || q === p || !S.players[q] || !isDown(q) || !allies(p, q) || isWild(q)) return false;
    if (typeof MP !== 'undefined' && MP.on && (ORDER_BY < 0 || mpCol(ORDER_BY) !== p)) return false;
    const Q = S.players[q];
    if (on) {
      if (Q.help === p) return true;
      Q.help = p;
      postMsg(p, `${playerName(q, true)} is helping command your colony until their base is retaken. Take it back any time.`, undefined, undefined, 'info');
      postMsg(q, `${playerName(p)} lets you help command their colony: your orders go to it until your base is retaken.`, undefined, undefined, 'good');
    } else {
      if (Q.help !== p) return true;
      delete Q.help;
      postMsg(p, `You took command of your colony back from ${playerName(q, true)}.`, undefined, undefined, 'info');
      postMsg(q, `${playerName(p)} has taken command of their colony back: you're watching again.`, undefined, undefined, 'info');
    }
    return true;
  },
  surrender(p) {
    if (S.mission || S.watch || S.mode === 'colony' || S.winner >= 0 || !human(p) || S.players[p].out) return false;
    const by = surrenderTo(p);
    if (by < 0) return false;
    surrender(p, by);
    return true;
  },
  /* ---------------------------------------------------------------- building settings (its panel) */
  prio(p, id, v) {
    const b = ownB(p, id); if (!b) return;
    b.prio = v === 'normal' ? undefined : v;
    if (b.built) delete b.sitePrio; else b.sitePrio = !!b.prio; // a site's priority ends when it's built
  },
  smode(p, id, v) { const b = ownB(p, id); if (b) b.smode = v === 'normal' ? undefined : v; },
  accept(p, id, g) {
    const b = ownB(p, id); if (!b || !GOOD[g]) return;
    b.reject = b.reject || {};
    if (b.reject[g]) delete b.reject[g]; else b.reject[g] = true;
    if (!Object.keys(b.reject).length) delete b.reject;
  },
  pmode(p, id, v) { const b = ownB(p, id); if (b) b.pmode = v; },
  autoSupply(p, id, on) {
    const b = ownB(p, id); if (!b) return;
    b.autoOff = !on;
    if (b.autoOff) b.auto = null;
    S.players[p].railT = undefined; // plan the line again now
    railPlan(p);
  },
  /** Its supply order for good g, d more (or fewer). */
  keep(p, id, g, d) { const b = ownB(p, id); if (b && GOOD[g]) setKeep(b, g, ((b.keep && b.keep[g]) || 0) + (+d || 0)); },
  fmode(p, id, v) { const b = ownB(p, id); if (b) b.mode = v; },
  omode(p, id, v) { const b = ownB(p, id); if (b) b.omode = v === 'first' ? 'first' : undefined; },
  pause(p, id, on) { const b = ownB(p, id); if (b) setPaused(b, !!on); },
  cancelMove(p, id) { const b = ownB(p, id); if (b && b.moving) cancelMove(b); },
  pack(p, id) { const b = ownB(p, id); if (!b || !BDEFS[b.type].mobile) return 0; const u = packCrawler(b); return u ? u.id : 0; },
  gate(p, id) { const b = ownB(p, id); return b ? wallToGate(p, b) : 'That Wall is gone.'; },
  /** Aim Mass Driver `id` at Catcher `to`, or an Outpost or Keep to keep supplied (0: stand down). '' or why not. */
  mdAim(p, id, to) { const b = ownB(p, id); if (!b || !BDEFS[b.type].mdriver) return 'That Mass Driver is gone.'; const c = to ? ownB(p, to) : null; if (to && !c) return 'Tap one of your Catchers.'; return setMdAim(p, b, c); },
  /** Mass Driver `id` throws a Catcher kit to tile (i, j), paid from storage now (i < 0: the kit not yet thrown is called off). '' or why not. */
  mdKit(p, id, i, j) { const b = ownB(p, id); if (!b || !BDEFS[b.type].mdriver) return 'That Mass Driver is gone.'; i = Math.floor(+i); j = Math.floor(+j); if (!Number.isFinite(i) || !Number.isFinite(j)) return 'Outside the map.'; return setMdKit(p, b, i, j); },
  /** Send good g from Mass Driver or Catcher `id` (on), or stop sending it: its goods list, which overrides automatic supply. '' or why not. */
  mdSend(p, id, g, on) { const b = ownB(p, id); if (!b || !mdEnd(b)) return 'That Mass Driver is gone.'; return setMdSend(b, String(g), !!on); },
  /** Mass Driver or Catcher `id` back to automatic supply (its goods list goes). */
  mdAuto(p, id) { const b = ownB(p, id); if (!b || !mdEnd(b)) return 'That Mass Driver is gone.'; return setMdAuto(b); },
  /** The reserve of good g Mass Driver or Catcher `id` leaves at home, d more (or less). */
  mdReserve(p, id, g, d) { const b = ownB(p, id); if (b && mdEnd(b)) setMdReserve(b, String(g), +d || 0); },
  ferryLine(p, id, to) { const b = ownB(p, id); if (!b) return 'That Port is gone.'; return setFerryLine(b, to ? ownB(p, to) : null); },
  /**
   * Plan a Maglev line from Maglev Terminal `id` (built, with a line to spare) to tile (bi, bj): the far Terminal (or a
   * Terminal there); at the end of a suspended line, the lost Terminal rebuilt (half price). With (hx, hy): Route via a
   * hub, two lines through a new hub Terminal there. `bends`: the tiles it bends at, in order from the Terminal (a list
   * of [i, j], up to MAGLEV.bends). { ok, reason, id }.
   */
  magLine(p, id, bi, bj, hx, hy, bends) {
    const b = ownB(p, id);
    if (!b) return { ok: false, reason: 'That Maglev Terminal is gone.' };
    if (hx != null && hy != null) return placeMagRoute(p, b, bi | 0, bj | 0, hx | 0, hy | 0);
    if (bends != null && !(Array.isArray(bends) && bends.length <= MAGLEV.bends && bends.every((q) => Array.isArray(q) && q.length === 2))) return { ok: false, reason: 'Those bends can\'t be had.' };
    return placeMagLine(p, b, bi | 0, bj | 0, (bends || []).map((q) => [q[0] | 0, q[1] | 0]));
  },
  /**
   * Change the bends of the Maglev line from Terminal `id` to Terminal `to` (both p's, joined) to `bends` (tiles in
   * order from `id`, up to MAGLEV.bends; [] for a straight line): a construction job, paid for the length and pylons
   * added, what's taken down coming back as crates. { ok, reason, id } (the job's site, 0 if done at once).
   */
  magRebend(p, id, to, bends) {
    const b = ownB(p, id), o = ownB(p, to);
    if (!b || !o) return { ok: false, reason: 'That Maglev Terminal is gone.' };
    if (!(Array.isArray(bends) && bends.length <= MAGLEV.bends && bends.every((q) => Array.isArray(q) && q.length === 2))) return { ok: false, reason: 'Those bends can\'t be had.' };
    return placeMagRebend(p, b, o, bends.map((q) => [q[0] | 0, q[1] | 0]));
  },
  /** Link Mooring Mast `id` to Mast `to` (an Airship line), or (to 0) unlink it. '' or why not. */
  mastLine(p, id, to) { const b = ownB(p, id); if (!b) return 'That Mooring Mast is gone.'; const o = to ? ownB(p, to) : null; if (to && !o) return 'Tap another of your Mooring Masts.'; return setMastLine(p, b, o); },
  airSupply(p, id, on) { const b = ownB(p, id); if (b && !(on && onHomeNet(b))) b.airSupply = !!on; }, // (On does nothing where a road from home reaches: Haulers supply it, see dispatch)
  pipeToRefinery(p, id) {
    const b = ownB(p, id); if (!b || !BDEFS[b.type].pump) return { why: 'That Oil Pump is gone.' };
    const r = pipeToRefinery(p, b);
    if (r.why) return { why: r.why };
    const n = pipeUp(p, r.tiles);
    return { n, owed: r.tiles.filter((t) => S.pipePlan[t] === p + 1).length };
  },
  pipeToFuel(p, id) {
    const b = ownB(p, id); if (!b || !fuelUser(BDEFS[b.type])) return { why: 'That building is gone.' };
    const r = pipeToFuel(p, b);
    if (r.why) return { why: r.why };
    const n = pipeUp(p, r.tiles);
    return { n, owed: r.tiles.filter((t) => S.pipePlan[t] === p + 1).length };
  },
  gprio(p, id, v) { const b = ownB(p, id); if (b) b.gprio = v === 'normal' ? undefined : v; },
  keepW(p, id, v) { const b = ownB(p, id); if (!b) return; b.keepW = v === null || v === undefined ? undefined : clamp(v | 0, 0, 99); b.stockT = 0; },
  keepWAll(p, v) {
    S.players[p].keepW = clamp(v | 0, 0, 99);
    for (const b of S.buildings) if (!b.dead && b.owner === p && BDEFS[b.type].mil && b.type !== 'lander') delete b.keepW;
  },
  /**
   * Aim defences `ids` (p's Pulse Turrets, Minigun Nests, Mortar Pits, Flak Guns, Bunkers, Keeps) at enemy `tid`, or (tid 0)
   * back to picking their own targets: see focusWhy. Gives back { n: how many took it, why: the first refusal }.
   */
  focus(p, ids, tid) {
    const all = [...new Set(Array.isArray(ids) ? ids.slice(0, 64) : [ids])].map((id) => ownB(p, id)).filter((b) => b), bs = all.filter((b) => canFocus(BDEFS[b.type]));
    if (!bs.length) return { n: 0, why: all.length ? focusWhy(all[0], null) : 'That defence is gone.' };
    if (!tid) { for (const b of bs) clearFocus(b); return { n: bs.length, why: '' }; }
    const t = liveE(tid);
    let n = 0, why = '';
    for (const b of bs) { const w = focusWhy(b, t); if (w) why = why || w; else { setFocus(b, t); n++; } }
    return { n, why: n ? '' : why };
  },
  hold(p, id, on) { const b = ownB(p, id); if (b && BDEFS[b.type].mil) setHold(b, !!on); },
  sortie(p, id) { const b = ownB(p, id); return b && b.garrison ? sortieNow(b) : 0; },
  callWorker(p, id) {
    const b = ownB(p, id); if (!b) return { why: 'That building is gone.' };
    const r = callWorker(p, b);
    return { uid: r.u ? r.u.id : 0, already: !!r.already, why: r.why };
  },
  /** Keep staffed (a building's panel): its Worker is never moved off by the automatic shortage and stall moves. */
  keepStaff(p, id, on) {
    const b = ownB(p, id); if (!b || !BDEFS[b.type].staff || BDEFS[b.type].crew) return false;
    if (on) b.keepStaff = 1; else delete b.keepStaff;
    return !!on;
  },
  /* ---------------------------------------------------------------- the Workforce panel (WF_ROWS: see wfOrder) */
  /** The Workforce ladder's order: a list of rows (Manual), or null (Back to Auto). */
  wfOrder(p, list) {
    const P = S.players[p]; if (!P) return false;
    if (list == null) { if (P.wf) { delete P.wf.order; wfTidy(P); } return true; }
    if (!Array.isArray(list) || list.length > 64) return false;
    P.wf = P.wf || {};
    P.wf.order = wfNormOrder(list);
    return true;
  },
  /** One of a preset's orders (WF_PRESETS: economy, war, build): Manual. */
  wfPreset(p, name) {
    const P = S.players[p]; if (!P || !ownKey(WF_PRESETS, name)) return false;
    P.wf = P.wf || {};
    P.wf.order = wfNormOrder(WF_PRESETS[name].order);
    return true;
  },
  /** Row k's minimum ('min', at least v Workers: 0 for none), cap ('cap', at most v: -1 for none) or pin ('pin', v true or false). */
  wfRow(p, k, what, v) {
    const P = S.players[p]; if (!P || !ownKey(WF_ROW, k) || !['min', 'cap', 'pin'].includes(what)) return false;
    P.wf = P.wf || {};
    const rows = P.wf.rows = P.wf.rows || {}, r = rows[k] = rows[k] || {};
    if (what === 'pin') { if (v) r.pin = 1; else delete r.pin; }
    else {
      const n = Math.round(+v);
      if (what === 'min') { if (n > 0) r.min = Math.min(WF_MAX, n); else delete r.min; }
      else if (Number.isFinite(n) && n >= 0) r.cap = Math.min(WF_MAX, n); else delete r.cap;
      if (r.min != null && r.cap != null && r.cap < r.min) { if (what === 'min') r.cap = r.min; else r.min = r.cap || undefined; if (!r.min) delete r.min; }
    }
    wfTidy(P);
    return true;
  },
  /** Rebalance now: Workers off buildings that can't work or make what there's plenty of, for the top jobs waiting. How many. */
  wfRebalance(p) { return S.players[p] ? wfRebalance(p) : 0; },
  rallyPost(p, id) {
    const b = ownB(p, id), P = S.players[p]; if (!b) return false;
    const on = P.rallyPost === b.id;
    P.rallyPost = on ? 0 : b.id;
    return !on;
  },
  unstation(p, id) { const b = ownB(p, id); return b && BDEFS[b.type].mil && b.type !== 'lander' ? unstation(p, b) : 0; },
  /** `want` warbots (-1: every spare one) into garrison `id`. How many went. */
  station(p, id, want) { const b = ownB(p, id); return b && BDEFS[b.type].mil && b.garrison ? stationWarbots(p, b, armyN(want, stationAvailable(p, b))) : 0; },
  /** Its stock limit: d (+5 or -5) more, or (d 0) no limit / back to the usual one. */
  limit(p, id, d) {
    const b = ownB(p, id); if (!b) return;
    if (!d) { b.limit = stockLimit(b) === Infinity ? BDEFS[b.type].limit || 20 : -1; return; }
    const cur = stockLimit(b), base = cur === Infinity ? (BDEFS[b.type].limit || 20) - d : cur;
    b.limit = clamp(Math.round((base + d) / 5) * 5, 5, 500);
  },
  demolish(p, id) { const b = ownB(p, id); return b && b.type !== 'lander' ? demolish(b) : null; },
  repair(p, id) { const b = ownB(p, id); return b ? requestRepair(p, b) : 'That building is gone.'; },
  /** Lay the shortest road from storage to building `id` (its panel's Lay road). */
  layRoad(p, id) {
    const b = ownB(p, id); if (!b) return { laid: 0, why: 'That building is gone.' };
    let laid = 0, why = '';
    for (const t of roadRouteTo(p, b) || []) {
      why = buildRoad(p, t % S.W, (t / S.W) | 0);
      if (why) break;
      laid++;
    }
    return { laid, why };
  },
  yard(p, id, k, n) { const b = ownB(p, id); if (b && BDEFS[b.type].yard && BDEFS[b.type].yard.includes(k)) orderAtYard(b, k, n | 0); },
  /** The Bot Foundry's queue: d more of kind k (0 clears it). */
  foundryOrder(p, id, k, d) {
    const b = ownB(p, id); if (!b || b.type !== 'foundry' || !ownKey(BOTS, k) || BOTS[k].magpod) return;
    b.orders = b.orders || {};
    b.orders[k] = d === 0 ? 0 : clamp((b.orders[k] || 0) + (d | 0), 0, 99);
    if (!hasOrders(b)) delete b.orders;
  },
  /** Move bot kind k up (d = -1) or down in the Foundry's build order, past the kinds not in `shown`. */
  foundryMove(p, id, k, d, shown) {
    const b = ownB(p, id); if (!b || b.type !== 'foundry') return;
    const list = Array.isArray(shown) ? shown : null;
    moveFoundryOrder(b, k, d < 0 ? -1 : 1, list ? (kk) => list.includes(kk) : null);
  },
  trade(p) { return acceptTrade(p); },
  research(p, k) { return TECHS[k] ? startResearch(p, k) : 'Unknown research.'; },
  cancelResearch(p) { cancelResearch(p); },
  evac(p) { return startEvac(p); },

  /* ---------------------------------------------------------------- building and paths */
  place(p, type, i, j, axis) {
    if (!BDEFS[type]) return { ok: false, reason: 'Unknown building.' };
    if (modNoBuild(type)) return { ok: false, reason: modNoBuild(type) }; // (No turrets, a challenge modifier)
    // (axis: a Mass Driver's two tiles, east-west or north-south; an Orbital Lift's fall line, 0..7: LIFT_DIRS)
    const r = placeSite(p, type, i, j, undefined, undefined, BDEFS[type].lift ? liftDirOf(axis) : axis === 'ns' ? 'ns' : 'ew');
    if (r.ok) r.building.placedAt = S.time; // (when: it can be taken back for SITE_UNDO s, see undoSite)
    return { ok: r.ok, reason: r.reason, id: r.building ? r.building.id : 0 };
  },
  moveBuilding(p, id, i, j, axis) { const b = ownB(p, id); if (!b) return { ok: false, reason: 'That building is gone.' }; const r = startMove(p, b, i, j, axis === 'ns' || axis === 'ew' ? axis : undefined); return { ok: r.ok, reason: r.reason }; },
  link(p, kind, ai, aj, bi, bj) {
    const r = kind === 'viaduct' ? placeViaduct(p, ai, aj, bi, bj) : placeRopeway(p, ai, aj, bi, bj);
    if (r.ok) settlePlans(); // a Viaduct is paid from storage: what's there now goes in at once
    return { ok: r.ok, reason: r.reason };
  },
  /**
   * A plan made in Paths, all at once: take up roads, track and pipe; plan Ramps, Walls and Gates, roads, track and
   * pipe; then pay for what can be paid for now. Lists of tiles (walls: [tile, 'wall' | 'gate']). Counts come back.
   */
  paths(p, d) {
    d = d && typeof d === 'object' ? d : {};
    const L = (a) => (Array.isArray(a) ? a : []), out = { removed: 0, laid: 0, ramps: 0, walls: 0, gates: 0, rails: 0, railsUp: 0, pipes: 0, pipesUp: 0, why: '', wallWhy: '', rampWhy: '', railWhy: '' };
    for (const t of L(d.del)) if (S.road[t] || S.plan[t] === p + 1) { removeRoad(p, t % S.W, (t / S.W) | 0); out.removed++; }
    for (const t of L(d.railDel)) if (S.rail[t] || S.railPlan[t] === p + 1) { takeUpRail(p, t); out.railsUp++; }
    const ramps = new Set(L(d.ramps));
    for (const t of ramps) {
      const r = placeSite(p, 'ramp', t % S.W, (t / S.W) | 0, null, true);
      if (r.ok) out.ramps++; else if (!out.rampWhy) out.rampWhy = r.reason;
    }
    for (const w of L(d.walls)) {
      const [t, kind] = Array.isArray(w) ? w : [];
      if ((kind !== 'wall' && kind !== 'gate') || !(t >= 0 && t < S.W * S.H)) continue;
      const r = placeSite(p, kind, t % S.W, (t / S.W) | 0);
      if (r.ok) { if (kind === 'gate') out.gates++; else out.walls++; } else if (!out.wallWhy) out.wallWhy = r.reason;
    }
    for (const t of L(d.add)) {
      if (S.road[t] || S.plan[t] || ramps.has(t)) continue; // (a planned Ramp is the road there)
      out.why = buildRoad(p, t % S.W, (t / S.W) | 0, true);
      if (out.why) break;
      out.laid++;
    }
    // Express lanes ([tile, direction 2-5]): a road of yours is turned one-way that way and marked for the Paver to
    // surface as a lane (a crossing with an ordinary road gets its overpass planned); a tile planned above (or planned
    // already) is noted (S.xdir) so it becomes a lane when Workers lay its base. Lanes never cross each other.
    out.lanes = 0;
    for (const e of L(d.express)) {
      const [t, v] = Array.isArray(e) ? e : [];
      if (!(t >= 0 && t < S.W * S.H) || !(v >= 2 && v <= 5)) continue;
      const i = t % S.W, j = (t / S.W) | 0;
      if (S.road[t]) {
        if (!roadOwnedBy(p, t) || (S.paveMark[t] === 2 && S.road[t] >= 2 && (S.road[t] % 2) !== (v % 2))) continue;
        setRoadDir(i, j, v | 0);
        setPaveMark(p, i, j, true, 3);
        expressJoins(t);
        out.lanes++;
      } else if (S.plan[t] === p + 1 && !(S.xdir[t] && (S.xdir[t] % 2) !== (v % 2))) { S.xdir[t] = v | 0; out.lanes++; } // (nor across a lane only planned)
    }
    for (const t of L(d.rail)) { const w = queueRail(p, t); if (w) { out.railWhy = out.railWhy || w; } else out.rails++; }
    for (const t of L(d.pipeDel)) if (S.pipe[t] === p + 1 || S.pipePlan[t] === p + 1) { takeUpPipe(p, t); out.pipesUp++; }
    for (const t of L(d.pipe)) if (!queuePipe(p, t)) out.pipes++;
    settlePlans(); // pay for what we can now, oldest plans first; the rest waits for the goods
    return out;
  },
  /**
   * A Terraform plan (Build → Terraform): tool one of TF_TOOLS, the tiles in the order dragged (Flatten: to level
   * `target`). Each that can be done becomes an Earthworks site for a Grader. What happened comes back (tfPlace).
   */
  terraform(p, tool, list, target) { return tfPlace(p, String(tool), Array.isArray(list) ? list.slice(0, TERRA.most) : [], target | 0); },
  /** Terraforming stage 4: open (on) or shut Sluice `id` ('' or why not: sluiceOrder). */
  sluice(p, id, on) { const b = getE(id | 0); return { why: sluiceOrder(p, b, !!on) }; },
  /** Terraforming stage 4: Sap Head `id`'s sap along `list` (tiles out from beside it), dug again from the start ('' or why not: sapPlan). */
  sap(p, id, list) { const b = getE(id | 0); return { why: sapPlan(p, b, Array.isArray(list) ? list.slice(0, SAP.most + 1).map((t) => t | 0) : []) }; },
  /** The road crew limit: at most v Workers lay planned road at once (one of ROAD_CREWS; 0: no limit). */
  roadCrew(p, v) { if (ROAD_CREWS.includes(v)) S.players[p].roadCrew = v; },
  paveMark(p, i, j, on) { if (inMap(i, j)) setPaveMark(p, i, j, !!on); },
  /** Turn a road's arrow: v 1 two-way, 2-5 one-way (east, south, west, north). */
  roadDir(p, i, j, v) { if (inMap(i, j) && S.road[tIdx(i, j)] && roadOwnedBy(p, tIdx(i, j)) && v >= 1 && v <= 5) setRoadDir(i, j, v | 0); }, // (an Express lane stays one-way: setRoadDir)
  /**
   * The junction tool, one tap: a light becomes a (planned) overpass, an overpass comes down, a planned overpass is
   * called off, and a plain junction gets a (planned) light. A light where an overpass can't go (a T-junction: only
   * three roads) comes down instead, and why comes back. What happened comes back for the banner.
   */
  junction(p, i, j) {
    if (!inMap(i, j)) return { what: 'none' };
    const t = tIdx(i, j), P = junPlanAt(t);
    if ((S.over[t] && S.over[t].owner !== p) || (S.lights[t] && S.lights[t].owner !== p) || (!S.over[t] && !S.lights[t] && S.road[t] && wayOwner(t) !== p)) return { what: 'notYours' };
    if (S.over[t]) { removeOverpass(t); markDirty(i, j); return { what: 'overDown' }; }
    if (P && P.kind === 'over') {
      cancelJunPlan(t);
      const lit = !!S.lights[t];
      if (lit) removeLight(t);
      return { what: 'overOff', lit };
    }
    if (S.lights[t] || P) {
      const why = placeOverpass(p, i, j);
      if (why) { const lit = !!S.lights[t]; if (lit) removeLight(t); cancelJunPlan(t); return { what: 'lightDown', why, lit }; }
      return { what: S.over[t] ? 'overUp' : 'overPlanned', lit: !!S.lights[t] };
    }
    const why = placeLight(p, i, j);
    if (why) return { what: 'error', why };
    return { what: S.lights[t] ? 'lightUp' : 'lightPlanned' };
  },

  /* ---------------------------------------------------------------- the army */
  /**
   * A right-click with robots selected (ids), on: a Ferry (ferry), a Repair Station (repair), an enemy robot (foe),
   * a building (b), an earthwork to shoot (i, j with ew) or open ground (i, j). Howitzers in the selection shell or drive; the rest hunt, attack, station or
   * hold the ground. { kind, n, nr } comes back (or { why }).
   */
  command(p, ids, spec) {
    ids = ownIds(p, ids);
    const units = ids.map(getE), tasks = units.map((u) => u.task);
    const assigned = (result) => {
      // Only groups whose units received a new task wait for Back to order.
      agManual(p, units.filter((u, k) => u.task !== tasks[k]));
      return result;
    };
    let s = spec || {};
    const out = { kind: '', n: 0, nr: 0 };
    // (Terraforming stage 4: `ew`, an Attack order on the earthwork on tile (i, j): they shoot it till it breaks: orderEwShoot)
    if (s.ew && !s.b && !s.foe && !s.ferry && Number.isInteger(s.i) && Number.isInteger(s.j) && inMap(s.i, s.j) && S.ewK && ewAt(tIdx(s.i, s.j))) {
      out.kind = 'ewshoot';
      out.n = orderEwShoot(p, ids, tIdx(s.i, s.j), out);
      return assigned(out);
    }
    // (Passenger Town: a building tapped, they go and stand beside it: at its sentry, they shoot it down)
    const ruin = !s.b && !s.foe && !s.ferry && S.town && inMap(s.i, s.j) ? townRuinAt(tIdx(s.i, s.j)) : null;
    // (The Dam: a dam tapped, they go and stand by it, the nearest spot within their reach of its face)
    const dam = !ruin && !s.b && !s.foe && !s.ferry && S.dam && inMap(s.i, s.j) ? damAt(tIdx(s.i, s.j)) : null;
    if (dam) {
      const u0 = getE(ids[0]);
      let bt = -1, bd = Infinity;
      if (u0) for (let j = dam.y0 - 4; j <= dam.y1 + 4; j++) for (let i = dam.x0 - 4; i <= dam.x1 + 4; i++) {
        if (!inMap(i, j)) continue;
        const t = tIdx(i, j);
        if (!walkable(t) || S.bAt[t] || damAt(t) || S.zone[t] !== botZone(u0) || damDist(dam, i + 0.5, j + 0.5) > DAM.reach - 0.6) continue;
        const d = dist2(i + 0.5, j + 0.5, u0.x, u0.y);
        if (d < bd) { bd = d; bt = t; }
      }
      if (bt >= 0) s = { ...s, i: bt % S.W, j: (bt / S.W) | 0 };
    }
    if (ruin) {
      const u0 = getE(ids[0]), st = townStands(ruin);
      if (u0 && st.length) { const t = st.reduce((a, c) => (dist2((c % S.W) + 0.5, ((c / S.W) | 0) + 0.5, u0.x, u0.y) < dist2((a % S.W) + 0.5, ((a / S.W) | 0) + 0.5, u0.x, u0.y) ? c : a)); s = { ...s, i: t % S.W, j: (t / S.W) | 0 }; }
    }
    if (s.ferry) {
      const f = ownU(p, s.ferry, 'ferry'); if (!f) return { why: 'That Ferry is gone.' };
      const r = orderBoardFerry(p, ids, f);
      return typeof r === 'string' ? { why: r } : assigned({ kind: 'ferry', n: r });
    }
    const b = s.b ? liveB(s.b) : null;
    if (b && foes(b.owner, p)) out.nr = orderBombard(p, ids, b);
    else if (b && b.owner === p && BDEFS[b.type].mil && b.built) { const t = deploySpot(p, b.x, b.y); if (t >= 0) out.nr = orderPark(p, ids, t % S.W, (t / S.W) | 0); }
    else if (!b && inMap(s.i, s.j) && walkable(tIdx(s.i, s.j))) out.nr = orderPark(p, ids, s.i, s.j);
    if (b && b.owner === p && BDEFS[b.type].repair) {
      const r = orderRepair(p, ids, b);
      return typeof r === 'string' ? { why: r } : assigned({ kind: 'repair', n: r });
    }
    const foe = !b && s.foe ? liveU(s.foe) : null;
    if (foe && foes(foe.owner, p)) { out.kind = 'hunt'; out.n = orderHunt(p, ids, foe, out); }
    else if (b && foes(b.owner, p)) { out.kind = 'attack'; out.n = orderAttack(p, ids, b, out); }
    else if (b && b.owner === p && BDEFS[b.type].mil && b.built) { out.kind = 'station'; out.n = orderStation(p, ids, b, out); }
    else if (!b && inMap(s.i, s.j)) {
      if (!walkable(tIdx(s.i, s.j))) return { why: 'No route to that tile. Choose ground the selected units can reach.' };
      out.kind = 'move';
      out.n = orderMove(p, ids, s.i, s.j, out);
    }
    else out.kind = 'none';
    return assigned(out);
  },
  /**
   * Undo for a tap's order (the selection bar's Undo, under a finger): each robot goes back to what it was doing
   * before it, as noted then (orderSnapshot in ui.js): a list of [id, kind, a, b, post, auto], kind 'in' (garrison
   * a), 'attack' (building a), 'hold' (the ground at a, b), 'bombard' (building a; auto: a target it picked itself),
   * 'park' (at a, b) or 'free'; post is where it was posted. How many went back.
   */
  undoCommand(p, list) {
    let n = 0;
    agManual(p, (Array.isArray(list) ? list : []).map((e) => ownU(p, Array.isArray(e) ? e[0] : 0)));
    for (const e of Array.isArray(list) ? list : []) {
      const [id, k, a, b, post, auto] = Array.isArray(e) ? e : [], u = ownU(p, id), ids = [id];
      if (!u || !(isArmy(u) || BOTS[u.type].siege)) continue;
      if (k === 'in') { const g = ownB(p, a); if (g) orderStation(p, ids, g); }
      else if (k === 'attack') { const t = liveB(a); if (t) orderAttack(p, ids, t); }
      else if (k === 'hold') orderMove(p, ids, a | 0, b | 0);
      else if (k === 'bombard') { const t = liveB(a); if (t && orderBombard(p, ids, t) && auto && u.task) u.task.auto = true; }
      else if (k === 'park') orderPark(p, ids, a | 0, b | 0);
      else if (BOTS[u.type].siege) { u.task = null; u.salvo = null; u.path = null; }
      else if (!u.inside) { readyForOrder(u); u.task = null; } // it was standing free: free again (it finds itself a garrison)
      if (post && typeof post === 'object') u.post = { i: post.i | 0, j: post.j | 0 };
      else if (typeof post === 'number') u.post = post;
      else delete u.post;
      n++;
    }
    return n;
  },
  sail(p, fid, i, j) { const f = ownU(p, fid, 'ferry'); return f ? orderSail(p, f, i, j) : 'That Ferry is gone.'; },
  ferryBack(p, fid) { const f = ownU(p, fid, 'ferry'); if (f) ferryBack(f); },
  sailOut(p, fid) { const f = ownU(p, fid, 'ferry'); return f ? sailOut(p, f) : 'That Ferry is gone.'; },
  embark(p, fid) { const f = ownU(p, fid, 'ferry'); return f ? embarkWarbots(p, f, null) : 'That Ferry is gone.'; },
  disembark(p, fid) { const f = ownU(p, fid, 'ferry'); return f ? disembark(p, f) : 'That Ferry is gone.'; },
  foundPort(p, fid, i, j) { const f = ownU(p, fid, 'ferry'); return f ? orderFoundPort(p, f, i, j) : 'That Ferry is gone.'; },
  landing(p, fid, i, j, n) { const f = ownU(p, fid, 'ferry'); return f ? orderLanding(p, f, i, j, n | 0) : 'That Ferry is gone.'; },
  airdrop(p, uid, kind, i, j) { const u = ownU(p, uid, 'air'); return u && (kind === 'outpost' || BOTS[kind]) ? orderAirdrop(p, u, kind, i, j, BOTS[u.type].seats) : 'That plane is gone.'; },
  /** A Vulcan Bomber (uid) sent at a target: a building or a robot (tid); (ai, aj): a tile of the deck of the Viaduct tid is an end of. */
  strike(p, uid, tid, ai, aj) { const u = ownU(p, uid, 'bomber'), t = liveE(tid); return u && t ? orderStrike(p, u, t, ai, aj) : 'That target is gone.'; },
  /** A Vulcan Bomber (uid) sent to drop napalm on the ground at tile (i, j). '' or why not. */
  napalm(p, uid, i, j) { const u = ownU(p, uid, 'bomber'); return u ? orderNapalm(p, u, i, j) : 'That bomber is gone.'; },
  /** Scorch the earth: the Torches among `ids` each burn a patch of fertile soil at or round tile (i, j). { n, why } */
  scorch(p, ids, i, j) { agManual(p, ownIds(p, ids).map(getE)); return orderScorch(p, ownIds(p, ids), i, j); },
  bombard(p, ids, tid) { const t = liveB(tid); return t ? orderBombard(p, ownIds(p, ids), t) : 0; },
  park(p, ids, i, j) { return orderPark(p, ownIds(p, ids), i, j); },
  stance(p, uid, hold) {
    const u = ownU(p, uid, 'siege'); if (!u) return;
    u.stance = hold ? 'hold' : undefined;
    if (u.stance === 'hold' && u.task && u.task.auto) { u.task = null; u.salvo = null; }
  },
  crawl(p, uid, i, j) { const u = ownU(p, uid, 'crawler'); return u ? driveCrawler(u, i, j) : 'That Crawler is gone.'; },
  deploy(p, uid) { const u = ownU(p, uid, 'crawler'); return u ? deployCrawler(u) : 'That Crawler is gone.'; },
  trainArmor(p, uid) { const u = ownU(p, uid, 'rail'); return u ? orderTrainArmor(p, u) : 'That train is gone.'; },
  /**
   * A command for player p's computer ally `to` (-1: every one on its team): `kind` one of ALLY_KINDS, with a spot
   * (i, j) for Attack here and Defend this area (and for Attack, `tid`, an enemy building or robot tapped there), or
   * the good for Ask for goods. Each ally carries it out or says why not (allyCommand, ai.js): { n } took it, `why`
   * the first refusal, (i, j) where it went.
   */
  allyCmd(p, to, kind, i, j, tid) {
    if (!human(p) || !S.players[p] || S.players[p].out || S.watch || !ALLY_KINDS.includes(kind)) return { n: 0, why: '' };
    const qs = allyCmdTargets(p, Number.isInteger(to) ? to : -1);
    if (!qs.length) return { n: 0, why: 'No computer ally on your team.' };
    let g = '';
    if (kind === 'goods') { g = i; if (!ALLY_GOODS.includes(g)) return { n: 0, why: 'Pick a good.' }; i = j = -1; tid = 0; }
    else if (kind === 'attack' || kind === 'defend') {
      const e = kind === 'attack' && Number.isInteger(tid) && tid ? liveE(tid) : null;
      if (e && e.owner >= 0 && foes(e.owner, p)) { tid = e.id; i = Math.floor(e.x); j = Math.floor(e.y); }
      else { tid = 0; if (!Number.isInteger(i) || !Number.isInteger(j) || !inMap(i, j)) return { n: 0, why: 'Tap a spot on the map.' }; }
    } else { i = j = -1; tid = 0; }
    let n = 0, why = '';
    for (const q of qs) { const r = allyCommand(q, p, kind, i, j, tid, g); if (r) why = why || r; else n++; }
    return { n, why, i, j };
  },
  sendAttack(p, tid, n, all) { const t = liveB(tid); return t && foes(t.owner, p) ? sendAttack(p, t, n | 0, !!all) : 0; },
  fireMissile(p, tid) { const t = liveB(tid); return t && foes(t.owner, p) ? fireMissile(p, t) : false; },
  missileAt(p, sid, i, j) { const s = ownB(p, sid); return s && BDEFS[s.type].missile ? fireMissileAt(s, i, j) : false; },
  /** Aim Lance of Corvane `id` through tile (i, j): it starts charging (or, charging, turns to the new aim). '' or why not. */
  lanceAim(p, id, i, j) { const b = ownB(p, id); return b && BDEFS[b.type].lance ? setLanceAim(b, i | 0, j | 0) : 'That Lance is gone.'; },
  /** Call Orbital Lift `id`'s climber down with `load` (a key of LIFT.drops). '' or why not. */
  liftCall(p, id, load) { const b = ownB(p, id); return b && BDEFS[b.type].lift ? liftCall(b, String(load)) : 'That Orbital Lift is gone.'; },
  /** Send good g up from Orbital Lift `id` (on), or stop sending it. '' or why not. */
  liftSend(p, id, g, on) { const b = ownB(p, id); return b && BDEFS[b.type].lift ? setLiftSend(b, String(g), !!on) : 'That Orbital Lift is gone.'; },
  /** The reserve of good g Orbital Lift `id` leaves at home, d more (or less). */
  liftReserve(p, id, g, d) { const b = ownB(p, id); if (b && BDEFS[b.type].lift) setLiftReserve(b, String(g), +d || 0); },
  /** Turn Orbital Lift site `id`'s fall line to direction d (0..7), while it's still a site. '' or why not. */
  liftDir(p, id, d) { const b = ownB(p, id); return b && BDEFS[b.type].lift ? setLiftDir(b, liftDirOf(d)) : 'That Orbital Lift is gone.'; },
  /** Lance `id`'s Use Reactor switch: with a Reactor and Generators both in reach, charge on the Reactor (faster, Uranium a shot). */
  lanceReactor(p, id, on) { const b = ownB(p, id); if (b && BDEFS[b.type].lance) b.lUseR = !!on; },
  /** Begin Great Uplink `id`'s transmission (the Great Uplink win: 8 minutes held makes contact). '' or why not. */
  gupBegin(p, id) { const b = ownB(p, id); return b && BDEFS[b.type].gup ? gupBegin(b) : 'That Great Uplink is gone.'; },
  /** Stand down Great Uplink `id`'s transmission: its progress is lost. '' or why not. */
  gupStop(p, id) { const b = ownB(p, id); return b && BDEFS[b.type].gup ? gupStop(b) : 'That Great Uplink is gone.'; },
  /** Aim Sundering Ray `id`'s blow `mode` ('deep': Strike the Deep, 'quake') at tile (i, j): it winds up (or, winding up, turns to it). '' or why not. */
  sunderAim(p, id, i, j, mode) { const b = ownB(p, id); return b && BDEFS[b.type].sunder ? setSunderAim(b, i | 0, j | 0, mode === 'deep' ? 'deep' : 'quake') : 'That Sundering Ray is gone.'; },
  /** Sundering Ray `id`'s Use Reactor switch (as the Lance's). */
  sunderReactor(p, id, on) { const b = ownB(p, id); if (b && BDEFS[b.type].sunder) b.sUseR = !!on; },
  /** Call off Sundering Ray `id`'s wind-up (the blow is lost). */
  sunderStop(p, id) { const b = ownB(p, id); if (b && BDEFS[b.type].sunder && b.sOn) { sunderStop(b); b.sAim = null; } },
  /** Set Atmosphere Engine `id`'s Storm Front down centred on tile (i, j) (from Rain; not near its own circle nor in another Engine's). '' or why not. */
  atmosStorm(p, id, i, j) { const b = ownB(p, id); return b && BDEFS[b.type].atmos ? setAtmosStorm(b, i, j) : 'That Atmosphere Engine is gone.'; },
  /** Call Atmosphere Engine `id`'s Storm Front off. */
  atmosStormOff(p, id) { const b = ownB(p, id); if (b && BDEFS[b.type].atmos) atmosStormOff(b); },
  /** Terraforming stage 5: aim Leveller `id` at the hill under tile t (setLevelAim). '' or why not. */
  levelAim(p, id, t) { const b = ownB(p, id); return b && BDEFS[b.type].lvl ? setLevelAim(b, Number.isInteger(t) ? t : -1) : 'That Leveller is gone.'; },
  /** Call Leveller `id` off its hill. */
  levelStop(p, id) { const b = ownB(p, id); if (b && BDEFS[b.type].lvl) levelStop(b); },
  /** Call off Lance `id`'s charge (the charge is lost). */
  lanceStop(p, id) { const b = ownB(p, id); if (b && BDEFS[b.type].lance && b.lOn) { lanceStop(b); b.lAim = null; } },
  nukeAt(p, sid, i, j) { const s = ownB(p, sid); return s && BDEFS[s.type].nukeSilo ? fireNukeAt(s, i, j) : false; },
  /** `want` warbots (-1: every spare one) out of garrisons to hold the ground round (i, j): { sent, rally } (the flag's id). */
  rally(p, i, j, want) {
    if (!inMap(i, j)) return { sent: 0, rally: 0 };
    const n = armyN(want, rallyAvailable(p, i, j));
    const r = n > 0 ? sendToRally(p, i, j, n) : { sent: 0 };
    return { sent: r.sent || 0, rally: r.rally ? r.rally.id : 0 };
  },
  /** `want` warbots after enemy robot eid. */
  hunt(p, eid, want) {
    const e = liveU(eid); if (!e || !foes(e.owner, p)) return { sent: 0, rally: 0 };
    const n = armyN(want, rallyAvailable(p, Math.floor(e.x), Math.floor(e.y)));
    const r = n > 0 ? sendHunt(p, e, n) : { sent: 0 };
    return { sent: r.sent || 0, rally: r.rally ? r.rally.id : 0 };
  },
  /**
   * `want` warbots against enemy building tid, from garrisons in reach of it; if none are, to a rally flag beside it
   * (they attack what stands there). How many went.
   */
  assault(p, tid, want) {
    const b = liveB(tid); if (!b || !foes(b.owner, p) || b.owner < 0) return 0;
    let n = armyN(want, attackAvailable(p, b)), sent = n > 0 ? sendAttack(p, b, n) : 0;
    if (!sent) {
      for (const [di, dj] of [[1, 1], [-1, 1], [1, -1], [-1, -1], [2, 0], [-2, 0], [0, 2], [0, -2]]) {
        const ii = b.x + di, jj = b.y + dj;
        if (!inMap(ii, jj) || !walkable(tIdx(ii, jj)) || S.bAt[tIdx(ii, jj)]) continue;
        n = armyN(want, rallyAvailable(p, ii, jj));
        if (n > 0) { const res = sendToRally(p, ii, jj, n); sent = res.sent; if (sent) res.rally.target = b.id; } // (it comes down with the target: followRallies)
        break;
      }
    }
    return sent || 0;
  },
  recallRally(p, rid) { const r = rallyById(rid); return r && r.owner === p ? recallRally(rid) : 0; },
  recallAll(p) { return recallAll(p); },
  /** Robots (a list of ids, or one) sent to the nearest Bot Foundry to be recycled: how many went, or why none could. */
  recycle(p, ids) { const us = ownIds(p, Array.isArray(ids) ? ids : [ids]); for (const id of us) { const u = getE(id); delete u.grp; delete u.grpNew; delete u.grpGo; } return orderRecycle(p, us); },
  /** Robot `id` kept after all: its trip to be recycled is called off. True if it was on one. */
  unrecycle(p, id) { const u = ownU(p, id); if (!u || !recycling(u)) return false; stopRecycle(u); return true; },
  /** The Workers beyond what the colony needs (see workersWanted, spareBots) sent to be recycled: how many went. */
  recycleSpare(p) { return recycleSpare(p, 'worker', workersWanted(p)); },
  /** Call back the warbots of player p attacking building tid. */
  callBack(p, tid) {
    let n = 0;
    for (const u of S.bots) if (!u.dead && u.owner === p && isArmy(u) && u.task && u.task.type === 'attack' && u.task.target === tid) { u.task = null; u.path = null; n++; }
    return n;
  },
  /**
   * Take back construction site `id` (Undo after placing it, or Ctrl+Z): only a site of yours placed with `place` no
   * more than SITE_UNDO s ago and not finished yet. Everything paid or delivered for it comes back (see undoSite):
   * { back: {good: n}, type } (or { why }).
   */
  /** Passenger Town: order building `id` stripped for salvage (on), or call it off. '' or why not. */
  townStrip(p, id, on) { return S.town && !isWild(p) ? townStrip(p, id | 0, !!on) : 'No town here.'; },
  /** The Dam: order dam k (its index) wrecked or shored up (what: 'wreck' or 'mend'), or call it off. '' or why not. */
  damOrder(p, k, what, on) { return S.dam && !isWild(p) ? damOrder(p, k | 0, String(what), !!on) : 'No dam here.'; },
  /** Demolish it: player p's robots shoot enemy megastructure `id` on past 0 until it's destroyed (on), or hold it to seize it (off). '' or why not. */
  megaWreck(p, id, on) { const b = liveB(id); return b && !isWild(p) ? megaWreckOrder(p, b, !!on) : 'That megastructure is gone.'; },
  undoSite(p, id) {
    const b = ownB(p, id);
    if (!b) return { why: 'That site is gone.' };
    if (b.built) return { why: `The ${BDEFS[b.type].name} is finished already: Dismantle it from its panel instead.` };
    if (typeof b.placedAt !== 'number' || b.moveFrom || S.time - b.placedAt > SITE_UNDO) return { why: `Too late to take the ${BDEFS[b.type].name} back: Dismantle it from its panel instead.` };
    return { back: undoSite(b), type: b.type };
  },
  /* ---------------------------------------------------------------- trade routes (a Trade Terminal's panel) */
  /** Set Trade Terminal `id`'s standing route: send `give`, bring back `get` (give null: stop it). '' or why not. */
  tradeRoute(p, id, give, get) { const b = ownB(p, id); if (!b || !BDEFS[b.type].terminal) return 'That Trade Terminal is gone.'; return setTradeRoute(b, give ? String(give) : null, get ? String(get) : null); },
  /** Escort on or off at Trade Terminal `id`: two warbots ride along with each convoy. */
  tradeEscort(p, id, on) { const b = ownB(p, id); if (b && BDEFS[b.type].terminal) b.escort = !!on; },
  /* ---------------------------------------------------------------- Vulcan Bombers */
  /** Call off bomber `uid`'s strike while it's still on the ground (waiting for Ammo or Fuel, say). '' or why not. */
  strikeCancel(p, uid) { const u = ownU(p, uid, 'bomber'); return u ? cancelStrike(p, u) : 'That bomber is gone.'; },
  /** Put Airship `uid` on the line Mooring Mast `mid` is on (mid 0: on no line). '' or why not. */
  /* ---------------------------------------------------------------- Army Groups (sim.js: agNew and the rest) */
  /** A new Army Group of units `ids` (the selection's, or none): its id, or why not. */
  agNew(p, ids) { if (!human(p)) return 'Only a person\'s colony has Army Groups.'; return agNew(p, ownIds(p, Array.isArray(ids) ? ids : [])); },
  /** Units `ids` into group gid (out of any other); its target size grows to fit them. How many. */
  agAdd(p, gid, ids) {
    const g = agById(gid); if (!g || g.owner !== p) return 0;
    const us = orderable(p, ownIds(p, Array.isArray(ids) ? ids : []));
    const was = agMembers(g).length + us.filter((u) => u.grp !== g.id).length;
    if (was > g.size) g.size = Math.min(AGROUP.maxSize, was);
    agTake(g, us.filter((u) => u.grp !== g.id));
    return us.length;
  },
  /** Units `ids` out of their groups, back to the Reserve. How many. */
  agLeave(p, ids) {
    let n = 0;
    for (const u of orderable(p, ownIds(p, Array.isArray(ids) ? ids : []))) {
      if (!u.grp) continue;
      const g = agById(u.grp);
      delete u.grp; delete u.grpNew; delete u.grpGo; n++;
      if (g && u.task && u.task.type === 'hold' && u.task.rally === g.flag) callBack(u);
    }
    return n;
  },
  /** Rename group gid ('' back to its badge's name). Its name. */
  agName(p, gid, name) { const g = agById(gid); if (!g || g.owner !== p) return ''; g.name = agCleanName(name) || agOrdinal(g.n); return g.name; },
  /** Group gid's target size, set to v (1 to AGROUP.maxSize). */
  agSize(p, gid, v) { const g = agById(gid); if (g && g.owner === p) g.size = clamp(v | 0, 1, AGROUP.maxSize); },
  /** Group gid a place up (-1) or down (1) in the order reinforcements fill them. */
  agPrio(p, gid, d) { const g = agById(gid); return !!g && g.owner === p && agMove(g, +d); },
  /** Group gid's home: building bid (an Outpost, Keep or Command Base of p's) or, with none, the tile (i, j). '' or why not. */
  agHome(p, gid, bid, i, j) {
    const g = agById(gid); if (!g || g.owner !== p) return 'That group is gone.';
    if (bid) {
      const b = ownB(p, bid);
      if (!b || !b.built || !(b.type === 'outpost' || b.type === 'keep' || b.type === 'lander')) return 'Pick one of your finished Outposts or Keeps, your Command Base, or open ground.';
      g.home = { b: b.id };
    } else {
      if (!inMap(i | 0, j | 0) || !walkable(tIdx(i | 0, j | 0)) || S.bAt[tIdx(i | 0, j | 0)]) return 'Pick open ground your units can walk to.';
      g.home = { x: i | 0, y: j | 0 };
    }
    return '';
  },
  /** Group gid's standing order: k (hold, defend, patrol, attack, follow, raid), its points [[i, j]...], Defend area's or the Raid's radius r, the group fg to follow, a Raid's rep (1 again and again, 0 once). '' or why not. */
  agOrder(p, gid, k, pts, r, fg, rep) { const g = agById(gid); if (!g || g.owner !== p) return 'That group is gone.'; return agSetOrder(g, String(k), pts, r | 0, fg | 0, rep === 0 ? 0 : 1); },
  /** Group gid's behaviours: ret (Retreat when weak: 0, 25 or 50 % health), rel (Reload rotation: 0 or 1), st (Stance: 'agg', 'def' or 'hold'); null leaves one as it is. The behaviours. */
  agBeh(p, gid, ret, rel, st) { const g = agById(gid); if (!g || g.owner !== p) return null; return agSetBeh(g, ret == null ? null : ret | 0, rel == null ? null : rel | 0, st == null ? null : String(st)); },
  /** A Raid's Repeat (1) or Once (0), the raid going on as it is. */
  agRaidRep(p, gid, rep) { const g = agById(gid); if (!g || g.owner !== p || g.ord.k !== 'raid') return false; g.ord.rep = rep ? 1 : 0; if (rep) delete g.ord.done; return true; },
  /** Back to order: group gid's standing order goes on, its units back on it. */
  agResume(p, gid) { const g = agById(gid); if (g && g.owner === p) agResume(g); },
  /** Disband group gid: its units go back to the Reserve. */
  agDisband(p, gid) { const g = agById(gid); if (!g || g.owner !== p) return false; agDisband(g); return true; },
  shipLine(p, uid, mid) { const u = ownU(p, uid, 'airship'); if (!u) return 'That Airship is gone.'; const b = mid ? ownB(p, mid) : null; if (mid && !b) return 'That Mooring Mast is gone.'; return setShipLine(p, u, b); },
  /** Orbital platforms: raise (up 1) or lower (0) drawbridge k, ordered by a colony that holds one of its control boxes. '' or why not. */
  bridgeSet(p, k, up) { return orbSet(p, k, !!up); },
};

/**
 * Who gave the order being carried out: in a co-op game (S.crew), the person (their lockstep player, `by`), so a
 * construction site placed by it remembers who placed it (b.by: see addBuilding); -1 otherwise (and the computer's).
 */
let ORDER_BY = -1;

/** Run order `name` for player p (args: a list). What it gives back, or undefined if there's no such order. */
function applyOrder(p, name, args, by) {
  const f = Object.prototype.hasOwnProperty.call(ORDERS, name) ? ORDERS[name] : null;
  if (!f || !S || !S.players[p]) return undefined;
  // A colony out of the game, or down (its base fallen: FALLEN), gives no orders: its people watch. (One a standing
  // teammate lets help command gives orders to that teammate's colony instead: mpOrderCol in js/lockstep.js.)
  if (S.players[p].out && name !== 'rivalDifficulty') return undefined;
  ORDER_BY = Number.isInteger(by) && by >= 0 ? by : -1;
  try {
    return f(p, ...(Array.isArray(args) ? args : []));
  } catch (e) {
    // (a bad order is dropped, the same way on every device; the game goes on)
    if (typeof console !== 'undefined') console.warn(`Order ${name} failed:`, e && e.message);
    return undefined;
  } finally { ORDER_BY = -1; }
}

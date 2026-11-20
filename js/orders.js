'use strict';
/*
 * Terrafall — orders. Every change a player makes to the game goes through one of these: a name and plain arguments
 * (numbers, strings, ids, lists of ids, small plain objects), never live objects. In a single-player game the screens'
 * act() (ui.js) runs it at once; in multiplayer it's sent to every device and run on each at the same tick (see
 * lockstep.js), so every device plays the same game. applyOrder(p, name, args) runs order `name` for player p: each
 * checks that what it's given is p's to command (a building, a robot, a road) before it acts, and gives back what the
 * game function behind it gives back (the screens tell the player how it went).
 */

/** Building `id` if it's player p's (and still there), else null. */
function ownB(p, id) { const e = getE(id); return e && !e.dead && e.owner === p && BDEFS[e.type] && S.buildings.includes(e) ? e : null; }
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

const ORDERS = {
  rivalDifficulty(p, diff) {
    if (S.mission || !human(p) || !ownKey(DIFFICULTY, diff) || !S.players.some((r) => r.ai && !r.out)) return false;
    // The first active human is the host, using simulation state at the order's tick.
    if (p !== S.players.findIndex((r) => !r.ai && !r.out && !r.absent)) return false;
    if (S.difficulty === diff) return true;
    const after = DIFFICULTY[diff];
    S.difficulty = diff;
    for (const r of S.players) {
      if (!r.ai) continue;
      // (keeping its personality's economy bonus, as newGame gives it, and the Tools tech's)
      const econ = (r.style && PERSONALITIES[r.style] && PERSONALITIES[r.style].econ) || 1;
      r.mult = after.mult * econ * (tech(r.id, 'tools') ? 1.15 : 1);
      r.aiT = Math.min(r.aiT || 0, after.think);
    }
    for (const r of S.players) if (!r.ai && !r.absent) postMsg(r.id, `Rival AI difficulty is now ${after.label}.`, undefined, undefined, 'info');
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
  /** Aim Mass Driver `id` at Catcher `to` (0: stand down). '' or why not. */
  mdAim(p, id, to) { const b = ownB(p, id); if (!b || !BDEFS[b.type].mdriver) return 'That Mass Driver is gone.'; const c = to ? ownB(p, to) : null; if (to && !c) return 'Tap one of your Catchers.'; return setMdAim(p, b, c); },
  /** Send good g from Mass Driver `id` (on), or stop sending it. '' or why not. */
  mdSend(p, id, g, on) { const b = ownB(p, id); if (!b || !BDEFS[b.type].mdriver) return 'That Mass Driver is gone.'; return setMdSend(b, String(g), !!on); },
  /** The reserve of good g Mass Driver `id` leaves at home, d more (or less). */
  mdReserve(p, id, g, d) { const b = ownB(p, id); if (b && BDEFS[b.type].mdriver) setMdReserve(b, String(g), +d || 0); },
  ferryLine(p, id, to) { const b = ownB(p, id); if (!b) return 'That Port is gone.'; return setFerryLine(b, to ? ownB(p, to) : null); },
  /** Plan a Maglev line from Maglev Terminal `id` (built, on no line) to tile (bi, bj): the far Terminal (or a Terminal there). { ok, reason, id }. */
  magLine(p, id, bi, bj) { const b = ownB(p, id); if (!b) return { ok: false, reason: 'That Maglev Terminal is gone.' }; return placeMagLine(p, b, bi | 0, bj | 0); },
  /** Link Mooring Mast `id` to Mast `to` (an Airship line), or (to 0) unlink it. '' or why not. */
  mastLine(p, id, to) { const b = ownB(p, id); if (!b) return 'That Mooring Mast is gone.'; const o = to ? ownB(p, to) : null; if (to && !o) return 'Tap another of your Mooring Masts.'; return setMastLine(p, b, o); },
  airSupply(p, id, on) { const b = ownB(p, id); if (b && (!on || (airSuppliable(b) && !onHomeNet(b)))) b.airSupply = !!on; }, // (On does nothing where a road from home reaches: Haulers supply it, see dispatch)
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
  hold(p, id, on) { const b = ownB(p, id); if (b && BDEFS[b.type].mil) setHold(b, !!on); },
  sortie(p, id) { const b = ownB(p, id); return b && b.garrison ? sortieNow(b) : 0; },
  callWorker(p, id) {
    const b = ownB(p, id); if (!b) return { why: 'That building is gone.' };
    const r = callWorker(p, b);
    return { uid: r.u ? r.u.id : 0, already: !!r.already, why: r.why };
  },
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
    const r = placeSite(p, type, i, j, undefined, undefined, axis === 'ns' ? 'ns' : 'ew'); // (axis: a Mass Driver's two tiles, east-west or north-south)
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
      } else if (S.plan[t] === p + 1) { S.xdir[t] = v | 0; out.lanes++; }
    }
    for (const t of L(d.rail)) { const w = queueRail(p, t); if (w) { out.railWhy = out.railWhy || w; } else out.rails++; }
    for (const t of L(d.pipeDel)) if (S.pipe[t] === p + 1 || S.pipePlan[t] === p + 1) { takeUpPipe(p, t); out.pipesUp++; }
    for (const t of L(d.pipe)) if (!queuePipe(p, t)) out.pipes++;
    settlePlans(); // pay for what we can now, oldest plans first; the rest waits for the goods
    return out;
  },
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
   * a building (b) or open ground (i, j). Howitzers in the selection shell or drive; the rest hunt, attack, station or
   * hold the ground. { kind, n, nr } comes back (or { why }).
   */
  command(p, ids, spec) {
    ids = ownIds(p, ids);
    const s = spec || {}, out = { kind: '', n: 0, nr: 0 };
    if (s.ferry) {
      const f = ownU(p, s.ferry, 'ferry'); if (!f) return { why: 'That Ferry is gone.' };
      const r = orderBoardFerry(p, ids, f);
      return typeof r === 'string' ? { why: r } : { kind: 'ferry', n: r };
    }
    const b = s.b ? liveB(s.b) : null;
    if (b && foes(b.owner, p)) out.nr = orderBombard(p, ids, b);
    else if (b && b.owner === p && BDEFS[b.type].mil && b.built) { const t = deploySpot(p, b.x, b.y); if (t >= 0) out.nr = orderPark(p, ids, t % S.W, (t / S.W) | 0); }
    else if (!b && inMap(s.i, s.j) && walkable(tIdx(s.i, s.j))) out.nr = orderPark(p, ids, s.i, s.j);
    if (b && b.owner === p && BDEFS[b.type].repair) {
      const r = orderRepair(p, ids, b);
      return typeof r === 'string' ? { why: r } : { kind: 'repair', n: r };
    }
    const foe = !b && s.foe ? liveU(s.foe) : null;
    if (foe && foes(foe.owner, p)) { out.kind = 'hunt'; out.n = orderHunt(p, ids, foe); }
    else if (b && foes(b.owner, p)) { out.kind = 'attack'; out.n = orderAttack(p, ids, b); }
    else if (b && b.owner === p && BDEFS[b.type].mil && b.built) { out.kind = 'station'; out.n = orderStation(p, ids, b); }
    else if (!b && inMap(s.i, s.j)) {
      if (!walkable(tIdx(s.i, s.j))) return { why: 'No route to that tile. Choose ground the selected units can reach.' };
      out.kind = 'move';
      out.n = orderMove(p, ids, s.i, s.j, out);
    }
    else out.kind = 'none';
    return out;
  },
  /**
   * Undo for a tap's order (the selection bar's Undo, under a finger): each robot goes back to what it was doing
   * before it, as noted then (orderSnapshot in ui.js): a list of [id, kind, a, b, post, auto], kind 'in' (garrison
   * a), 'attack' (building a), 'hold' (the ground at a, b), 'bombard' (building a; auto: a target it picked itself),
   * 'park' (at a, b) or 'free'; post is where it was posted. How many went back.
   */
  undoCommand(p, list) {
    let n = 0;
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
  scorch(p, ids, i, j) { return orderScorch(p, ownIds(p, ids), i, j); },
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
  sendAttack(p, tid, n, all) { const t = liveB(tid); return t && foes(t.owner, p) ? sendAttack(p, t, n | 0, !!all) : 0; },
  fireMissile(p, tid) { const t = liveB(tid); return t && foes(t.owner, p) ? fireMissile(p, t) : false; },
  missileAt(p, sid, i, j) { const s = ownB(p, sid); return s && BDEFS[s.type].missile ? fireMissileAt(s, i, j) : false; },
  /** Aim Lance of Corvane `id` through tile (i, j): it starts charging (or, charging, turns to the new aim). '' or why not. */
  lanceAim(p, id, i, j) { const b = ownB(p, id); return b && BDEFS[b.type].lance ? setLanceAim(b, i | 0, j | 0) : 'That Lance is gone.'; },
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
  recycle(p, ids) { return orderRecycle(p, ownIds(p, Array.isArray(ids) ? ids : [ids])); },
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
  shipLine(p, uid, mid) { const u = ownU(p, uid, 'airship'); if (!u) return 'That Airship is gone.'; const b = mid ? ownB(p, mid) : null; if (mid && !b) return 'That Mooring Mast is gone.'; return setShipLine(p, u, b); },
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
  ORDER_BY = Number.isInteger(by) && by >= 0 ? by : -1;
  try {
    return f(p, ...(Array.isArray(args) ? args : []));
  } catch (e) {
    // (a bad order is dropped, the same way on every device; the game goes on)
    if (typeof console !== 'undefined') console.warn(`Order ${name} failed:`, e && e.message);
    return undefined;
  } finally { ORDER_BY = -1; }
}

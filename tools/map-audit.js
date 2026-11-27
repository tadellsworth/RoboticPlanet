// Map audit: generates every map type (SHAPE_PRESETS) for each player count it takes, a few seeds and two sizes, and
// checks what a colony needs from its start: generation time, the start's ground, the way to every other colony (on foot,
// or by the crossing the map is built round), the deposits in walking reach and how fair they are between colonies, and
// the map's own sites (Trade Posts, Uplinks, Murmur nests, drawbridges).
// With --ai MIN it also plays a computer-only game on each map type (default size, two colonies, four where the map is
// built for four) for MIN minutes and looks for crashes, rivals that stop building and robots that never move again.
//   node tools/map-audit.js                    every map, generation checks
//   node tools/map-audit.js --ai 12            ...and a 12-minute computer-only game on each
//   node tools/map-audit.js --only "The Ring"  one map type (a part of its name; "=Islands" for exactly that name)
//   node tools/map-audit.js --json out.json    the full results as JSON too
//   (--strict is accepted and changes nothing: every map is held to the starter-field floor now)
// Exits non-zero when a check fails (an exception, a start off the ground, a colony that cannot reach another by the
// map's crossing, a home with too few Ore or Crystal tiles in walking reach (HOME_FLOOR), no oil seep in walking reach within
// OIL_R, a Trade Post or Uplink only a bridge or tunnel reaches on a map meant to be walked, too few Trade Posts or Uplinks,
// a stalled rival or a crash). --skip noOil,sitePocket,siteShort leaves those three out of the failures.
'use strict';
const { readFileSync, writeFileSync } = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const aiMin = +opt('--ai', 0), only = opt('--only', ''), jsonOut = opt('--json', ''), seeds = opt('--seeds', '11,21,37').split(',').map(Number);
const sizes = opt('--sizes', '0,2').split(',').map(Number);
// --skip noOil,sitePocket,siteShort leaves those checks out of the failures (they are still measured and summed up).
const skip = new Set(opt('--skip', '').split(',').filter(Boolean));
// The starter fields: every colony's home has at least this many Ore and Crystal tiles (deposit tiles, not their amounts) in
// walking reach within HOME_R tiles of its Command Base: the starter field and the richer one just beyond the border (Standard's
// lies 13.5 tiles out). A map can ask for more: Orbital platforms guarantees its fields' size (ORBITAL.field), so a wiped field
// shows up there at once. Colonies whose map puts none at home are skipped (Half underground's surface colonies: their Ore and
// Crystal come through the cave mouths).
const HOME_R = 16, HOME_FLOOR = { ore: 4, crystal: 4 }; // (HOME_FIELD: the starter field alone holds that many)
// Fuel at home: every colony has an oil seep in walking reach within OIL_R tiles of its Command Base (oilFloor, js/world.js),
// on every map but those that keep oil away from home on purpose (OIL_EXEMPT: Sky islands' seeps lie on the mesas between;
// Half underground, the Hollow, The Ring and Orbital platforms lay their own).
const OIL_R = 14, OIL_EXEMPT = ['Sky islands', 'Half underground', 'The Hollow', 'The Ring', 'Orbital platforms'];
// Trade Posts and Uplinks on maps meant to be walked (all but SITE_CROSS, built round a crossing) stand on ground every
// colony walks to (Tidal flats: at low tide); and every map that has them has at least a Trade Post a colony (two in
// Teams) and three Uplinks (as many as colonies, for three or four).
const SITE_CROSS = ['Islands', 'Four Isles', 'Sky islands', 'The Ring', 'The Graveyard'];
const FLOOR_OF = { 'Orbital platforms': { ore: 8, crystal: 8 }, 'The Ring': { ore: 6, crystal: 6 }, 'The Graveyard': { ore: 8, crystal: 8 }, 'The Hollow': { ore: 3, crystal: 3 } }; // (the Hollow's own home fields hold 3: hollowMap)
// (Every map holds the floor now: each colony's starter Ore and Crystal fields have at least HOME_FIELD tiles, defs.js. Before
// that, a sweep of seeds 1 to 8, 11, 21, 37, 99, 123 on Small to Immense found twelve map types whose small random stamps a seed
// could leave at a tile or two; they were listed as THIN rather than failed until the floor went in, Nov 27 2026.)
const modules = ['util', 'defs', 'world', 'path', 'sim', 'ai', 'missions', 'orders', 'landmarks', 'city', 'walker', 'dam'];
const source = modules.map((name) => readFileSync(path.join(__dirname, '..', 'js', name + '.js'), 'utf8')).join('\n');

const api = new Function('sfx', 'PROGRESS', source + `
  const GOODS_OF = { ore: [R_ORE], crystal: [R_CRYSTAL], stone: [R_BOULDER], fiber: [R_STALK, R_VEIN], oil: [R_OIL] };
  // What a crossing needs between two areas on foot: 'walk' (the same area), 'tide' (over the tidal flats at low tide),
  // 'bridge' (a road over water or through rock: stepPlan), 'span' (a Viaduct or Ropeway over a chasm or space, VIA_MAX /
  // ROPE_MAX), else 'none'.
  function areas(kind) {
    const N = S.W * S.H, W = S.W, z = new Int32Array(N).fill(-1);
    const ok = (t) => kind === 'walk' ? walkable(t) : kind === 'tide' ? walkable(t) || (S.tidal && S.tidal[t]) : S.terrain[t] !== T_CHASM || S.road[t] > 0;
    const step = (a, b) => kind === 'walk' ? canStep(a, b) : kind === 'tide' ? ((S.tidal && (S.tidal[a] || S.tidal[b])) ? true : canStep(a, b)) : stepPlan(a, b);
    let next = 0;
    for (let t = 0; t < N; t++) {
      if (!ok(t) || z[t] >= 0) continue;
      const q = [t]; z[t] = next;
      for (let h = 0; h < q.length; h++) {
        const a = q[h], i = a % W;
        for (const b of [i > 0 ? a - 1 : -1, i < W - 1 ? a + 1 : -1, a - W, a + W]) {
          if (b < 0 || b >= N || z[b] >= 0 || !ok(b) || !step(a, b)) continue;
          z[b] = next; q.push(b);
        }
      }
      next++;
    }
    return z;
  }
  // Join the areas of z that a Viaduct or Ropeway could span (two edge tiles of different areas within ROPE_MAX).
  function spanJoin(z) {
    const W = S.W, H = S.H, N = W * H, parent = new Map();
    const find = (a) => { while (parent.has(a) && parent.get(a) !== a) a = parent.get(a); return a; };
    const edge = [];
    for (let t = 0; t < N; t++) {
      if (z[t] < 0) continue;
      const i = t % W, j = (t / W) | 0;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => inMap(i + a, j + b) && z[tIdx(i + a, j + b)] !== z[t])) edge.push(t);
    }
    const R = Math.max(VIA_MAX, ROPE_MAX);
    const grid = new Map();
    for (const t of edge) { const k = ((t % W) / R | 0) + ',' + (((t / W) | 0) / R | 0); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(t); }
    for (const t of edge) {
      const i = t % W, j = (t / W) | 0, gi = (i / R) | 0, gj = (j / R) | 0;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const u of grid.get((gi + a) + ',' + (gj + b)) || []) {
        if (z[u] === z[t]) continue;
        if (dist2(i, j, u % W, (u / W) | 0) > R * R) continue;
        const x = find(z[t]), y = find(z[u]);
        if (x !== y) parent.set(Math.max(x, y), Math.min(x, y));
      }
    }
    return z.map((v) => (v < 0 ? v : find(v)));
  }
  function audit(opts) {
    const t0 = Date.now();
    newGame(opts);
    const genMs = Date.now() - t0;
    const sh = SHAPE_PRESETS[S.settings.shape], W = S.W, H = S.H;
    const live = S.players.filter((p) => !p.absent), Ls = live.map((p) => getE(p.lander));
    const out = { genMs, W, H, players: live.length, problems: [], notes: [] };
    // Is S.zone (the game's own areas, built before the map's extras) the same as a fresh one?
    const z0 = S.zone; computeZones();
    let stale = 0; for (let t = 0; t < W * H; t++) if ((z0[t] < 0) !== (S.zone[t] < 0)) stale++;
    const zones = new Set(); Ls.forEach((L) => zones.add(z0[tIdx(L.x, L.y)])); const zones1 = new Set(); Ls.forEach((L) => zones1.add(S.zone[tIdx(L.x, L.y)]));
    if (zones.size !== zones1.size) out.problems.push('stale S.zone at start: ' + zones.size + ' areas between colonies, ' + zones1.size + ' after recomputing');
    // The start's ground.
    out.starts = Ls.map((L) => {
      const t = tIdx(L.x, L.y), e = S.elev[t], s = { x: L.x, y: L.y };
      let level = 0, bad = [];
      for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) {
        const i = L.x + di, j = L.y + dj; if (!inMap(i, j)) { bad.push('edge'); continue; }
        const u = tIdx(i, j);
        if (Math.abs(di) <= 1 && Math.abs(dj) <= 1) {
          if (S.terrain[u] === T_WATER && !(S.ford && S.ford[u])) bad.push('water');
          if (S.terrain[u] === T_CHASM) bad.push('void');
          if (S.lava && S.lava[u]) bad.push('lava');
          if (S.tidal && S.tidal[u]) bad.push('tidal');
          if (S.fault && S.fault[u]) bad.push('fault');
          if (S.terrain[u] === T_GROUND && S.elev[u] !== e && !S.ramp[u]) bad.push('cliff');
        }
        if (S.terrain[u] === T_GROUND && S.elev[u] === e) level++;
      }
      if (S.terrain[t] !== T_GROUND) bad.push('off ground');
      s.level = level; s.bad = [...new Set(bad)];
      // Places to build round it (a Depot, in its own land, within 6 tiles).
      let spots = 0;
      for (let dj = -6; dj <= 6; dj++) for (let di = -6; di <= 6; di++) if (inMap(L.x + di, L.y + dj) && canPlace(L.owner, 'depot', L.x + di, L.y + dj).ok) spots++;
      s.spots = spots;
      if (S.caves && S.caves.seats[L.owner]) s.inside = !!S.caves.seats[L.owner].inside;
      return s;
    });
    out.starts.forEach((s, k) => { if (s.bad.length) out.problems.push('colony ' + (k + 1) + ' start beside ' + s.bad.join(', ')); if (s.spots < 25) out.problems.push('colony ' + (k + 1) + ' has only ' + s.spots + ' Depot spots within 6 tiles'); });
    // The way between colonies.
    const walk = areas('walk'), tide = S.tidal ? areas('tide') : walk, bridge = areas('bridge'), span = spanJoin(walk), spanB = spanJoin(bridge);
    const how = (a, b) => {
      const ta = tIdx(a.x, a.y), tb = tIdx(b.x, b.y);
      if (walk[ta] === walk[tb]) return 'walk';
      if (tide[ta] === tide[tb]) return 'tide';
      if (bridge[ta] === bridge[tb]) return 'bridge';
      if (span[ta] === span[tb]) return 'span';
      if (spanB[ta] === spanB[tb]) return 'bridge+span';
      return 'none';
    };
    out.links = [];
    for (let a = 0; a < Ls.length; a++) for (let b = a + 1; b < Ls.length; b++) {
      const h = how(Ls[a], Ls[b]);
      let p = null;
      if (h === 'walk') { const r = findPath(Ls[a].x, Ls[a].y, Ls[b].x, Ls[b].y, undefined, { who: Ls[a].owner }); p = r ? r.length : -1; }
      out.links.push({ a: a + 1, b: b + 1, how: h, path: p });
    }
    // Deposits in walking reach (the start's own area) within 12 and 24 tiles, and the nearest of each.
    out.reach = Ls.map((L) => {
      const z = walk[tIdx(L.x, L.y)], r = { near: {}, r12: {}, r24: {}, all: {}, home: {} };
      for (const g in GOODS_OF) { r.near[g] = null; r.r12[g] = 0; r.r24[g] = 0; r.all[g] = 0; r.home[g] = 0; }
      for (let t = 0; t < W * H; t++) {
        if (!S.res[t]) continue;
        const g = Object.keys(GOODS_OF).find((k) => GOODS_OF[k].includes(S.res[t])); if (!g) continue;
        // (a deposit tile is reached from a walkable neighbour in the area)
        const i = t % W, j = (t / W) | 0;
        let inZ = walk[t] === z;
        if (!inZ) for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (inMap(i + a, j + b) && walk[tIdx(i + a, j + b)] === z) { inZ = true; break; }
        if (!inZ) continue;
        const d = dist(i, j, L.x, L.y), v = S.amt[t] || 1;
        r.all[g] += v; if (d <= 12) r.r12[g] += v; if (d <= 24) r.r24[g] += v;
        if (d <= opts.homeR) r.home[g]++; // (tiles, for the starter-field floor)
        if (r.near[g] === null || d < r.near[g]) r.near[g] = +d.toFixed(1);
      }
      return r;
    });
    // The starter fields' floor (HOME_FLOOR): too few Ore or Crystal tiles at home.
    out.thin = [];
    out.reach.forEach((r, k) => {
      if (out.starts[k].inside === false) return; // (Half underground's surface: no Ore or Crystal at home, by design)
      for (const g in opts.floor) if (r.home[g] < opts.floor[g]) out.thin.push('colony ' + (k + 1) + ' has ' + r.home[g] + ' ' + g + ' tiles within ' + opts.homeR + ' (floor ' + opts.floor[g] + ')');
    });
    // Fairness: the smallest over the largest of each good within 24 tiles, among colonies of a kind (Half underground: inside and outside apart).
    out.fair = {};
    const groups = {}; out.starts.forEach((s, k) => { const key = s.inside === undefined ? 'all' : s.inside ? 'in' : 'out'; (groups[key] = groups[key] || []).push(k); });
    for (const g in GOODS_OF) {
      let worst = 1;
      for (const key in groups) {
        const v = groups[key].map((k) => out.reach[k].r24[g]), hi = Math.max(...v), lo = Math.min(...v);
        if (hi > 0) worst = Math.min(worst, lo / hi);
      }
      out.fair[g] = +worst.toFixed(2);
    }
    // Sites.
    out.posts = (S.posts || []).length; out.uplinks = (S.uplinks || []).length;
    out.nests = S.buildings.filter((b) => !b.dead && typeof isNestB === 'function' && isNestB(b)).length;
    const siteReach = (list) => (list || []).map(({ x, y }) => Ls.map((L) => how(L, { x, y })));
    out.postReach = siteReach(S.posts); out.uplinkReach = siteReach(S.uplinks);
    for (const site of [...(S.posts || []), ...(S.uplinks || [])]) {
      const t = tIdx(site.x, site.y);
      if (S.terrain[t] !== T_GROUND) out.problems.push('site off the ground at ' + site.x + ',' + site.y);
    }
    // Fuel at home (OIL_R) and the sites' reach and count (see SITE_CROSS).
    out.oilNear = out.reach.map((r) => r.near.oil);
    if (!opts.oilExempt.includes(sh.name)) out.reach.forEach((r, k) => { if (r.near.oil === null || r.near.oil > opts.oilR) out.noOil = (out.noOil || []).concat('colony ' + (k + 1) + ' nearest oil in walking reach ' + (r.near.oil === null ? 'none' : r.near.oil) + ' (want within ' + opts.oilR + ')'); });
    out.sitePocket = [];
    const okHow = (h) => h === 'walk' || (S.tidal && h === 'tide');
    if (!opts.siteCross.includes(sh.name) && out.links.every((l) => okHow(l.how))) { // (where the colonies walk to one another)
      out.postReach.forEach((v, k) => { if (!v.every(okHow)) out.sitePocket.push('Trade Post ' + (k + 1) + ' at ' + S.posts[k].x + ',' + S.posts[k].y + ' reached by ' + v.join('/')); });
      out.uplinkReach.forEach((v, k) => { if (!v.every(okHow)) out.sitePocket.push('Uplink ' + (k + 1) + ' at ' + S.uplinks[k].x + ',' + S.uplinks[k].y + ' reached by ' + v.join('/')); });
    }
    out.siteShort = [];
    if (!S.hollow && !S.caves) {
      // (Trade Posts: one more than colonies, four in Teams (two pairs), is the full count (postsFull); fewer than one a
      // colony, or two in Teams, fails. Small maps and narrow ones (Long haul, Ring valley) can have room for no more.)
      const fullPosts = S.teams ? 4 : live.length + 1, floorPosts = S.teams ? 2 : live.length;
      out.postsFull = out.posts >= fullPosts;
      if (out.posts < floorPosts) out.siteShort.push(out.posts + ' Trade Posts (want at least ' + floorPosts + ')');
      if (S.victory === 'uplinks') { const wantUp = S.grave ? 1 : live.length === 2 ? 3 : live.length; if (out.uplinks < wantUp) out.siteShort.push(out.uplinks + ' Uplinks (want at least ' + wantUp + ')'); } // (The Graveyard: the Arbiter is the one Uplink)
    }
    if (S.orb) {
      out.orb = { decks: S.orb.plats.length, bridges: S.orb.br.length, boxes: S.orb.bx.length };
      for (const b of S.orb.bx) if (!walkable(tIdx(b.x, b.y)) && !S.bAt[tIdx(b.x, b.y)]) out.problems.push('control box off the deck at ' + b.x + ',' + b.y);
      const per = {}; for (const b of S.orb.bx) per[b.br] = (per[b.br] || 0) + 1;
      for (const k in per) if (per[k] !== 2) out.problems.push('bridge ' + k + ' has ' + per[k] + ' control boxes');
    }
    // The Graveyard: its hulks (each start on a home hulk), the Arbiter's relay bare and held by no one at the start, the salvage and debris lanes.
    if (S.grave) {
      const kinds = {}; for (const h of S.grave.hulks) kinds[h.kind] = (kinds[h.kind] || 0) + 1;
      out.grave = { hulks: kinds, salvage: S.space ? S.space.rocks.filter((r) => r.k === 'salvage').length : 0, junk: S.space ? S.space.rocks.filter((r) => r.k === 'junk').length : 0 };
      Ls.forEach((L, k) => { const h = graveHulkAt(L.x, L.y); if (!h || h.kind !== 'home') out.problems.push('colony ' + (k + 1) + ' not on a home hulk'); });
      const C = S.grave.core;
      for (let j = C.y0; j <= C.y1; j++) for (let i = C.x0; i <= C.x1; i++) { const t = tIdx(i, j); if (S.terrain[t] !== T_GROUND || S.res[t] || S.bAt[t]) out.problems.push('the Arbiter relay not bare at ' + i + ',' + j); }
      if (S.grave.owner >= 0) out.problems.push('the Arbiter held at the start');
      if (out.grave.salvage < 6) out.problems.push('only ' + out.grave.salvage + ' salvage wrecks');
    }
    if (S.caves) out.caves = { variant: S.caves.variant, entrances: S.caves.entrances.length, nestsIn: S.caves.nests.length, nestsOut: (S.caves.nestsOut || []).length };
    if (S.town) out.town = true;
    out.zoneStale = stale;
    return out;
  }
  // A computer-only game on map type 'shape': built buildings over time, robots that never move, stalls.
  function play(opts, minutes) {
    newGame({ ...opts, humans: [], mode: 'versus', difficulty: 'normal', style: 'balanced', murmur: opts.murmur, victory: 'capture' });
    S.watch = true;
    const n = S.players.length, built = [], stuck = new Map(), still = {};
    let next = 60, maxStill = 0, t0 = Date.now(), err = null;
    const pos = new Map();
    try {
      while (S.tick < Math.round(minutes * 60 / SIM_STEP) && S.winner < 0) { // (a game won is over: simStep stops)
        simStep(SIM_STEP);
        if (S.time >= next) {
          next += 60;
          if (PROGRESS) PROGRESS(S.time, Date.now() - t0);
          built.push(S.players.map((p) => p.stats.built));
          // Robots (not inside a building, not a creature) with a task or path that stood on the same tile for the last minute.
          for (const u of S.bots) {
            if (u.dead || u.inside || u.owner < 0 || u.owner >= n || BOTS[u.type].air) { pos.delete(u.id); continue; }
            const key = Math.floor(u.x) + ',' + Math.floor(u.y), moving = !!(u.path && u.path.length) || (u.task && u.task.type !== 'guard' && u.task.type !== 'idle');
            const was = pos.get(u.id);
            if (was && was.key === key && moving) { was.n++; } else pos.set(u.id, { key, n: 0, type: u.type, task: u.task && u.task.type });
          }
        }
      }
    } catch (e) { err = e.stack.split('\\n').slice(0, 4).join(' | '); }
    for (const [, v] of pos) if (v.n >= 5) { const k = v.type + ':' + v.task; still[k] = (still[k] || 0) + 1; maxStill = Math.max(maxStill, v.n); }
    // Stalls: a colony that built nothing for 4 minutes on end while it still stands.
    const stalls = [];
    for (let p = 0; p < n; p++) {
      let run = 0, worst = 0;
      for (let k = 1; k < built.length; k++) { if (built[k][p] === built[k - 1][p]) run++; else run = 0; worst = Math.max(worst, run); }
      const L = getE(S.players[p].lander), alive = L && !L.dead && L.owner === p;
      if (worst >= 4 && alive) stalls.push({ colony: p + 1, minutes: worst, built: built.length ? built[built.length - 1][p] : 0 });
    }
    const end = S.players.map((p) => { const L = getE(p.lander); return { built: p.stats.built, bots: S.bots.filter((u) => !u.dead && u.owner === p.id).length, alive: !!(L && !L.dead && L.owner === p.id) }; });
    return { err, time: +(S.time / 60).toFixed(1), winner: S.winner, realMs: Date.now() - t0, end, stalls, stuck: still, maxStill, built };
  }
  return { audit, play, SHAPE_PRESETS, SIZE_PRESETS, minPlayers, maxPlayers, playersFit, mapSizeForPlayers, DEFAULT_SIZE };
`)(() => {}, args.includes('--progress') ? (s, ms) => console.error('    ' + Math.round(s / 60) + ' min at ' + Math.round(ms / 1000) + ' s') : null);

const results = [];
let failures = 0;
const pick = api.SHAPE_PRESETS.map((p, k) => [p, k]).filter(([p]) => !only || (only[0] === '=' ? p.name === only.slice(1) : p.name.toLowerCase().includes(only.toLowerCase())));
for (const [preset, shape] of pick) {
  const row = { map: preset.name, cases: [], ai: [] };
  for (let players = api.minPlayers(shape); players <= api.maxPlayers(shape); players++) {
    if (!api.playersFit(shape, players)) continue;
    for (const size of sizes) {
      if (api.mapSizeForPlayers(size, players) !== size) continue;
      for (const teams of players === 4 ? [false, true] : [false]) {
        for (const seed of seeds) {
          const opts = { seed, shape, players, size, teams, mode: 'versus', victory: 'uplinks', murmur: 'active', biome: 'desert', homeR: HOME_R, oilR: OIL_R, oilExempt: OIL_EXEMPT, siteCross: SITE_CROSS, floor: FLOOR_OF[preset.name] || HOME_FLOOR };
          const label = [preset.name, api.SIZE_PRESETS[size].name, players + 'p', teams ? 'teams' : 'ffa', 'seed ' + seed].join(' / ');
          let r;
          try { r = api.audit(opts); } catch (e) { r = { problems: ['exception: ' + e.stack.split('\n').slice(0, 3).join(' | ')] }; }
          r.label = label; r.size = size; r.seed = seed; r.teams = teams; r.np = players;
          row.cases.push(r);
          if (r.thin && r.thin.length) r.problems.push(...r.thin);
          for (const k of ['noOil', 'sitePocket', 'siteShort']) if (r[k] && r[k].length && !skip.has(k)) r.problems.push(...r[k]);
          if (r.problems.length) { failures++; console.log('PROBLEM ' + label + ': ' + r.problems.join('; ')); }
        }
      }
    }
  }
  // A summary line per map.
  const ok = row.cases.filter((c) => c.genMs !== undefined), ms = ok.map((c) => c.genMs);
  const links = {}; ok.forEach((c) => c.links.forEach((l) => { links[l.how] = (links[l.how] || 0) + 1; }));
  const fair = {}; ok.forEach((c) => { for (const g in c.fair) fair[g] = Math.min(fair[g] ?? 1, c.fair[g]); });
  const near = {}; ok.forEach((c) => c.reach.forEach((r) => { for (const g in r.near) near[g] = Math.max(near[g] ?? 0, r.near[g] === null ? 999 : r.near[g]); }));
  const sites = ok.map((c) => c.posts + '/' + c.uplinks).filter((v, i, a) => a.indexOf(v) === i).join(' ');
  const oilFar = ok.filter((c) => c.noOil && c.noOil.length).length, pocket = ok.filter((c) => c.sitePocket.length).length, short = ok.filter((c) => c.siteShort.length).length;
  const postsPart = ok.filter((c) => c.postsFull === false).length;
  row.summary = { cases: row.cases.length, genMax: Math.max(...ms), genAvg: Math.round(ms.reduce((a, b) => a + b, 0) / (ms.length || 1)), links, fair, nearWorst: near, sites };
  console.log(preset.name.padEnd(22) + ' ' + row.cases.length + ' cases, gen avg ' + row.summary.genAvg + ' ms max ' + row.summary.genMax + ' ms; links ' + JSON.stringify(links) +
    '; worst fairness ' + JSON.stringify(fair) + '; worst nearest ' + JSON.stringify(near) + '; posts/uplinks ' + sites +
    '; no oil within ' + OIL_R + ' ' + oilFar + ', sites in pockets ' + pocket + ', sites short ' + short + ', posts short of one more than colonies ' + postsPart);
  if (aiMin > 0) {
    const counts = [2]; if (api.minPlayers(shape) > 2) counts[0] = api.minPlayers(shape); if (api.maxPlayers(shape) === 4 && api.playersFit(shape, 4) && !counts.includes(4)) counts.push(4);
    for (const players of counts) {
      let r;
      try { r = api.play({ seed: 21, shape, players, size: api.DEFAULT_SIZE.versus }, aiMin); } catch (e) { r = { err: 'setup: ' + e.message }; }
      r.players = players; row.ai.push(r);
      const bad = r.err || (r.stalls && r.stalls.length);
      if (bad) failures++;
      console.log('  AI ' + players + 'p ' + (r.err ? 'CRASH ' + r.err : r.time + ' min' + (r.winner >= 0 ? ' (colony ' + (r.winner + 1) + ' won)' : '') + ', real ' + r.realMs + ' ms, built ' + r.end.map((e) => e.built + (e.alive ? '' : '†')).join('/') +
        (r.stalls.length ? ', STALL ' + JSON.stringify(r.stalls) : '') + (Object.keys(r.stuck).length ? ', unmoving ' + JSON.stringify(r.stuck) : '')));
    }
  }
  results.push(row);
}
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(results, null, 1));
console.log(failures ? failures + ' problem cases' : 'no problems');
process.exitCode = failures ? 1 : 0;

'use strict';
/*
 * Terrafall: the atlas's named landmarks, set pieces on a Contingency battle's map (LORE.md, The atlas; CAMPAIGN.md, The
 * world and its set pieces). A battle fought in a territory with a landmark gets it (lmSetup, from the battle's setup in
 * js/contingency-battle.js): placed near the middle of the map, on the line between the sides, at least 7 tiles from any base, where it blocks no base
 * and no only way through (lmPlace checks every tile each base could reach is still reachable), deterministic from the
 * map and the battle's seed, kept in S.landmarks (saved, checked by lmCheckSave and hashed with the rest).
 *
 * S.landmarks: [{ id (LANDMARKS key), x, y (its middle tile), v (its variant, +4 the compact one), solid (tiles of rock: impassable, drawn as
 * the ground under its art), area (tiles nothing is built on, the solid ones too), water (tiles turned to water), rock
 * (tiles turned to rock and drawn as rock: the Long Falls' cliff), and its state: a geyser's on (1 while erupting); a
 * wreck's hatch (the tile to hold), hold (seconds held) and got (0 not yet, 1 recovered in this battle, 2 earlier in the
 * run) }].
 *
 * Each is scenery with its name (hovered or tapped: lmSheet; in faded atlas lettering zoomed out: lmLabels) and a light
 * touch where it fits the lore (the owner's to approve: IDEAS.md, Landmarks): the hull, the Spire, the Stone Forest's
 * pillars, Passenger Town's houses and the Breach Fields' shafts block the way; the Spire stands on rich Crystal; the
 * Stone Forest gives cover; Glass Lake is ice robots cross but nothing is built on; the Clock Geyser erupts on its clock
 * and blocks its vent; a wreck's log is recovered by holding a robot at its hatch (once a run, kept in the run).
 * The art is a lazily loaded set (ensureLandmarkArt: keys lm-*), drawn by lmDraw*; without it each is drawn in code.
 */

/** The landmark of each territory (CONT_TERR ids). */
const LM_AT = {
  pathfinder: 'hull', passenger: 'town', ringfall: 'spire', tallpine: 'falls', redwash: 'stone', northcap: 'lake',
  terraces: 'geyser', violet: 'breach', ledger: 'ledger', geyser: 'market', heron: 'kestrel', ashfield: 'survey',
  foxford: 'halvard', silent: 'crater',
};
/** The landmarks: name, a line of flavour (the colony's voice), and what it does in a battle. */
const LANDMARKS = {
  hull: { name: 'The Pathfinder\'s hull', line: 'The joint lander that came five years before the vanguards, laid the Trade Posts and the Uplinks, sowed the garden and went dormant. Its Accord stripe has faded to grey. Every vanguard\'s map still marks it neutral.',
    does: 'Its hull blocks the way: go round it. Nothing is built on it.' },
  town: { name: 'Passenger Town', line: 'Built by the Pathfinder for the first colonists: lawns, a bus shelter, a school with its desks set out. The welcome signs still come on at dusk. Cargo list on file: seed packets, school desks, children\'s shoes.',
    does: 'Its houses block the way; its streets are open. Nothing is built in the town: its plots are held for the colonists. The garden\'s deer graze the lawns.' },
  spire: { name: 'The Ring Shard Spire', line: 'The biggest piece of the Ring ever to come down, standing where it struck. Crystal grows up its faces and spills round its foot.',
    does: 'It blocks the way. Rich Crystal clusters ring its foot, half as much again as the usual.' },
  falls: { name: 'The Long Falls', line: 'Where Tallpine\'s river drops off the escarpment. The survey filed it "scenic reserve: no development."',
    does: 'A cliff, its plunge pool and the stream out of it: go round, or bridge the stream.' },
  stone: { name: 'The Stone Forest', line: 'Pillars of red stone the wind left standing, too regular to look natural and too old to be anything else.',
    does: 'The pillars block the way. Robots among them are in cover: they take a quarter less damage.' },
  lake: { name: 'Glass Lake', line: 'Frozen to the bottom and clear as a window. Northcap\'s Uplink was built to look down on it.',
    does: 'Robots cross the ice; nothing is built on it.' },
  geyser: { name: 'The Clock Geyser', line: 'It goes off on its own clock, as it did long before anyone came to time it.',
    does: 'Every 90 seconds it erupts for 8: its vent is blocked and robots beside it are scalded. Nothing is built on its terraces.' },
  breach: { name: 'The Breach Fields', line: 'Shafts straight down into the Hollow, rimmed with violet. Air moves in and out of them like breath.',
    does: 'The shafts block the way. Nothing is built among them.' },
  ledger: { name: 'Ledger Post', post: true, line: 'The Pathfinder\'s Trade Post for the Long Grass. Its ledger still balances to the mark.',
    does: 'A neutral Trade Post: dock a Trade Terminal beside it.' },
  market: { name: 'Spring Market', post: true, line: 'The Steamwells\' Trade Post, between the warm pools. Steam drifts across the pad.',
    does: 'A neutral Trade Post: dock a Trade Terminal beside it.' },
  kestrel: { name: 'The wreck of the Kestrel', ship: 'Kestrel', wreck: 'kestrel', line: 'A cargo lander that came down in the Blackwater mud and never lifted again. Half of it is under the reeds.',
    does: 'Hold a robot of yours at its hatch for 20 seconds to recover its log (once a run).' },
  survey: { name: 'The wreck of the Ninth Survey', ship: 'Ninth Survey', wreck: 'survey', line: 'An Accord survey craft, down in the ash. Its antennas still point at the sky.',
    does: 'Hold a robot of yours at its hatch for 20 seconds to recover its log (once a run).' },
  halvard: { name: 'The wreck of the Halvard', ship: 'Halvard', wreck: 'halvard', line: 'A relay tender, nose-down among the red-gold trees. The leaves have filled its cargo bay.',
    does: 'Hold a robot of yours at its hatch for 20 seconds to recover its log (once a run).' },
  crater: { name: 'Silent Crater', line: 'A wide old crater on Argos. Nothing moves in it and nothing sounds; the robots log it as quiet ground.',
    does: 'Its floor is open ground robots cross; nothing is built on it, and its central peak blocks the way.' },
};
/** The three wrecks' logs, recovered in the colony's voice (IDEAS.md, Landmarks: the owner's to approve). */
const LM_LOGS = {
  kestrel: 'Log recovered: the Kestrel, cargo lander, down in Blackwater at T−19. Final entries: "Ark construction update received: hull sections 112 to 118 complete." "Ark construction update received: no change." "Awaiting ark construction update." The last line repeats once a day for 1,106 days, then the batteries.',
  survey: 'Log recovered: the Ninth Survey, Accord survey craft, down in the Cinderlands at T−8. It went on listening after the crash. Its last 4,000 entries are the same: "Home channel open. Carrier steady. No content." The carrier is still logged steady on the final entry.',
  halvard: 'Log recovered: the Halvard, relay tender, down in Emberwood at T+3. Its receiver kept the deep-space bands until its power failed: "Machine handshakes, Catalog worlds 2, 5 and 7. Accord protocols. Routine." Every period closes with the same note: "No voice traffic this period."',
};
/** Recovering a wreck's log: seconds a robot of yours holds its hatch. The Clock Geyser: its clock. The Stone Forest's cover. */
const LM_WRECK_HOLD = 20;
const LM_GEYSER = { every: 90, burst: 8, first: 45, scald: 4 };
const LM_COVER = 0.75;
const LM_CRYSTAL = 1.5;

/* ------------------------------------------------------------------ shapes */

/**
 * The tiles of landmark `id` round its middle (offsets [dx, dy]), variant v (0 to 3: mirrored and turned as fits).
 * solid: rock under the art; area: nothing built (the solid tiles are added to it); water, rock: the Long Falls.
 */
function lmShape(id, v, small) {
  const k = LANDMARKS[id] && LANDMARKS[id].wreck ? 'wreck' : id, out = { solid: [], area: [], water: [], rock: [], crystal: [] };
  const rect = (x0, x1, y0, y1, a) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) a.push([x, y]); };
  const flip = v & 1 ? -1 : 1;
  if (k === 'hull') { rect(-2, 2, -1, 0, out.solid); rect(-3, 3, -2, 1, out.area); }
  else if (k === 'spire') {
    rect(-1, 1, -1, 1, out.solid); rect(-1, 1, -1, 1, out.area);
    for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) { const d = Math.max(Math.abs(x), Math.abs(y)); if (d >= 2 && x * x + y * y <= 11 && hash2(x + 9, y + 9, 811 + v) < 0.62) out.crystal.push([x, y]); }
  } else if (k === 'falls') {
    rect(small ? -1 : -2, small ? 1 : 2, -2, -1, out.rock); rect(-1, 1, 0, small ? 0 : 1, out.water);
    let x = 0;
    for (let y = small ? 1 : 2; y <= (small > 1 ? 0 : small ? 3 : 5); y++) { if (y > 2 && hash2(y, v, 813) < 0.45) x += flip; out.water.push([x, y]); }
  } else if (k === 'stone') {
    for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) {
      if (x * x + y * y > (small > 1 ? 2 : small ? 5 : 11)) continue;
      out.area.push([x, y]);
      if ((((x * flip + 2 * y) % 5) + 5) % 5 === 0) out.solid.push([x, y]); // (never two side by side: always a way between)
    }
  } else if (k === 'lake') { for (let y = -3; y <= 3; y++) for (let x = -5; x <= 5; x++) if ((x / 4.6) ** 2 + (y / 3.1) ** 2 <= 1) out.area.push([x, y]); }
  else if (k === 'geyser') rect(-1, 1, -1, 1, out.area);
  else if (k === 'town') {
    if (small) { rect(-4, 4, -2, 0, out.area); for (const x of [-3, -1, 1, 3]) out.solid.push([x, -2]); } // (one row of houses on the street)
    else { rect(-4, 4, -3, 3, out.area); for (const y of [-2, 2]) for (const x of [-3, -1, 1, 3]) out.solid.push([x, y]); }
  } else if (k === 'breach') {
    for (let y = -2; y <= 2; y++) for (let x = -3; x <= 3; x++) {
      if ((x / 3.5) ** 2 + (y / 2.5) ** 2 > 1) continue;
      out.area.push([x, y]);
      if ((((x * flip + 2 * y + 1) % 5) + 5) % 5 === 0) out.solid.push([x, y]);
    }
  } else if (k === 'wreck') { rect(-1, 1, -1, 0, out.solid); out.area.push([0, 1]); }
  else if (k === 'crater') { for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) if (x * x + y * y <= 10) out.area.push([x, y]); out.solid.push([0, 0]); }
  for (const s of out.solid) if (!out.area.some((a) => a[0] === s[0] && a[1] === s[1])) out.area.push(s);
  return out;
}

/* ------------------------------------------------------------------ placing it */

/** The tiles each base can reach over land now (4-way steps, buildings passable): a count for each start tile. */
function lmReach(starts) {
  const N = S.W * S.H, W = S.W, seen = new Uint8Array(N), counts = [];
  for (const s of starts) {
    seen.fill(0);
    const q = [s]; seen[s] = 1; let n = 0;
    for (let h = 0; h < q.length; h++) {
      const a = q[h], i = a % W; n++;
      for (const b of [i > 0 ? a - 1 : -1, i < W - 1 ? a + 1 : -1, a - W, a + W]) {
        if (b < 0 || b >= N || seen[b] || !canStep(a, b)) continue;
        seen[b] = 1; q.push(b);
      }
    }
    counts.push({ n, seen: seen.slice() });
  }
  return counts;
}

/**
 * Put landmark `id` on this battle's map (from the battle's setup, before the kits land): the first spot, outward from
 * the middle of the line between the sides, where its tiles are open ground clear of everything placed (what blocks the
 * way on level ground with a ring of open ground round it), its edge at least 7 tiles from every Command Base, and every tile any base could reach before is still reachable after. `seed`: the
 * battle's. `got`: a wreck's log already recovered in this run. Returns the landmark, or null (no room: none this time).
 */
function lmSetup(id, seed, got) {
  if (!LANDMARKS[id]) return null;
  const D = LANDMARKS[id];
  S.landmarks = S.landmarks || [];
  if (D.post) { // (a Trade Post the atlas names: the one nearest the middle)
    const M = lmMiddle();
    if (!S.posts || !S.posts.length) return null;
    const p = S.posts.reduce((a, q) => (dist2(q.x, q.y, M.x, M.y) < dist2(a.x, a.y, M.x, M.y) ? q : a));
    const L = { id, x: p.x, y: p.y, v: 0, solid: [], area: [], water: [], rock: [] };
    S.landmarks.push(L);
    return L;
  }
  const v = Math.floor(hash2(seed | 0, 7, 8101) * 4);
  const M = lmMiddle(), bases = S.players.filter((P) => !P.absent).map((P) => getE(P.lander)).filter(Boolean);
  const starts = bases.map((b) => tIdx(b.x, b.y)), before = lmReach(starts);
  const flat = ['lake', 'crater', 'town', 'geyser', 'hull'].includes(id);
  const rough = (t) => S.terrain[t] !== T_GROUND || S.bAt[t] || S.road[t] || (S.rail && S.rail[t]) || (S.tidal && S.tidal[t]) || (S.lava && S.lava[t]) || (S.fault && S.fault[t]) || (S.ford && S.ford[t]) || (S.tun && S.tun[t]) || postAt(t) || uplinkAt(t) || calmAt((t % S.W) + 0.5, ((t / S.W) | 0) + 0.5);
  // the first pass the strictest: the flat ones all on one level, 7 tiles from a base; then nearer (5); then only what
  // blocks the way on one level; then the compact one (lmShape's small)
  for (const [near, strict, small] of [[7, true, 0], [5, true, 0], [5, false, 0], [5, true, 1], [5, false, 1], [5, false, 2]]) {
    if (small && !['town', 'stone', 'falls'].includes(id)) break;
    if (small > 1 && id === 'town') break;
    const sh = lmShape(id, v | (small ? 4 : 0), small), all = [...sh.area, ...sh.water, ...sh.rock], block = [...sh.solid, ...sh.water, ...sh.rock];
    const ext = all.reduce((a, [x, y]) => Math.max(a, Math.abs(x), Math.abs(y)), 0), level = strict && flat ? all : block, cands = [];
    for (let j = ext + 2; j < S.H - ext - 2; j++) for (let i = ext + 2; i < S.W - ext - 2; i++) {
      if (bases.some((b) => all.some(([dx, dy]) => Math.max(Math.abs(b.x - i - dx), Math.abs(b.y - j - dy)) < near))) continue;
      cands.push([dist2(i, j, M.x, M.y) + hash2(i, j, seed | 0) * 0.5, i, j]);
    }
    cands.sort((a, b) => a[0] - b[0]);
    let tries = 0;
    for (const [, i, j] of cands) {
      const e0 = S.elev[tIdx(i, j)];
      let ok = true;
      // its own tiles open ground with nothing on it; what blocks the way (and anything drawn flat) on level ground, with
      // a ring of open ground round what blocks, so it never narrows a pass to nothing; away from the Murmur's nests
      for (const [dx, dy] of all) { const t = tIdx(i + dx, j + dy); if (rough(t) || S.ramp[t]) { ok = false; break; } }
      for (const [dx, dy] of level) {
        if (!ok) break;
        if (S.elev[tIdx(i + dx, j + dy)] !== e0) { ok = false; break; }
      }
      for (const [dx, dy] of block) {
        for (let a = -1; a <= 1 && ok; a++) for (let b = -1; b <= 1 && ok; b++) {
          const t = tIdx(i + dx + a, j + dy + b);
          if (rough(t) || S.elev[t] !== e0) ok = false;
        }
        if (!ok) break;
      }
      if (ok && S.choke) for (const m of S.choke) for (const t of m) if (Math.abs((t % S.W) - i) <= ext + 1 && Math.abs(((t / S.W) | 0) - j) <= ext + 1) ok = false;
      if (ok) for (const b of S.buildings) if (!b.dead && BDEFS[b.type].wild && Math.max(Math.abs(b.x - i), Math.abs(b.y - j)) <= ext + 2) ok = false;
      if (!ok) continue;
      if (++tries > 300) break;
      const L = lmLay(id, i, j, v | (small ? 4 : 0), sh);
      // nothing cut off: every tile a base could reach is still reachable (bar the landmark's own)
      const after = lmReach(starts), lost = new Set([...L.solid, ...L.water, ...L.rock]);
      let fine = true;
      for (let k = 0; k < starts.length && fine; k++) {
        const A = before[k].seen, B = after[k].seen;
        for (let t = 0; t < A.length; t++) if (A[t] && !B[t] && !lost.has(t)) { fine = false; break; }
      }
      if (fine) {
        if (D.wreck) { L.hatch = tIdx(i, j + 1); L.hold = 0; L.got = got ? 2 : 0; }
        if (id === 'geyser') L.on = 0;
        S.landmarks.push(L);
        lmClearRes(L, sh, i, j);
        computeZones();
        return L;
      }
      lmUnlay(L);
    }
  }
  computeZones();
  return null;
}
/** The middle of the line between the sides (all of them: in a three-way battle, between the three); alone, the map's. */
function lmMiddle() {
  const bases = S.players.filter((P) => !P.absent).map((P) => getE(P.lander)).filter(Boolean);
  if (bases.length < 2) return { x: S.W >> 1, y: S.H >> 1 };
  return { x: Math.round(bases.reduce((a, b) => a + b.x, 0) / bases.length), y: Math.round(bases.reduce((a, b) => a + b.y, 0) / bases.length) };
}
/** Lay landmark `id` at (i, j): its rock, water and solid tiles in the terrain (undone by lmUnlay if it won't do). */
function lmLay(id, i, j, v, sh) {
  const tl = (a) => a.map(([dx, dy]) => tIdx(i + dx, j + dy));
  const L = { id, x: i, y: j, v, solid: tl(sh.solid), area: tl(sh.area), water: tl(sh.water), rock: tl(sh.rock) };
  for (const t of [...L.solid, ...L.rock]) S.terrain[t] = T_ROCK;
  for (const t of L.water) S.terrain[t] = T_WATER;
  return L;
}
function lmUnlay(L) { for (const t of [...L.solid, ...L.rock, ...L.water]) S.terrain[t] = T_GROUND; }
/** No deposits on a landmark's ground (and the Spire's rich Crystal round its foot). */
function lmClearRes(L, sh, i, j) {
  for (const t of [...L.area, ...L.water, ...L.rock]) { S.res[t] = 0; S.amt[t] = 0; if (S.fert) S.fert[t] = 0; }
  if (!sh.crystal.length) return;
  const pr = RESOURCE_PRESETS[(S.settings && S.settings.rich) ?? DEFAULT_RICH] || RESOURCE_PRESETS[DEFAULT_RICH];
  for (const [dx, dy] of sh.crystal) {
    const t = tIdx(i + dx, j + dy);
    if (!inMap(i + dx, j + dy) || S.terrain[t] !== T_GROUND || S.bAt[t] || S.road[t] || S.ramp[t]) continue;
    S.res[t] = R_CRYSTAL; S.amt[t] = clamp(Math.round(RES[R_CRYSTAL].amount * pr.amount * LM_CRYSTAL), 1, 255); S.grow[t] = 1;
  }
}
/** Once the map's plants are laid (newGame): none on a landmark's ground. */
function lmDecor() { if (S.decor) for (const L of S.landmarks || []) for (const t of [...L.area, ...L.water, ...L.rock]) S.decor[t] = 0; }

/* ------------------------------------------------------------------ in play */

const _lm = { of: null, area: null, nb: null, solid: null, cover: null, garden: null };
/** The landmarks' tiles, indexed (once for each S.landmarks: a loaded game indexes its own). */
function lmIndex() {
  if (_lm.of === S.landmarks && _lm.n === S.W * S.H) return _lm;
  _lm.of = S.landmarks; _lm.n = S.W * S.H;
  _lm.area = new Map(); _lm.nb = new Set(); _lm.solid = new Set(); _lm.cover = new Set(); _lm.garden = new Set();
  for (const L of S.landmarks || []) {
    for (const t of [...L.area, ...L.water, ...L.rock]) _lm.area.set(t, L);
    for (const t of [...L.area, ...L.rock]) _lm.nb.add(t); // (its water can be bridged: the Long Falls' stream)
    if (L.id === 'town') for (const t of L.area) if (!L.solid.includes(t)) _lm.garden.add(t);
    for (const t of L.solid) _lm.solid.add(t);
    if (L.id === 'geyser') { _lm.solid.add(tIdx(L.x, L.y)); }
    if (L.id === 'stone') for (const t of L.area) if (!L.solid.includes(t)) _lm.cover.add(t);
  }
  return _lm;
}
/** The landmark whose ground tile t is (or a Trade Post the atlas names, on its pad), else null. */
function lmAt(t) {
  if (!S || !S.landmarks || !S.landmarks.length) return null;
  const L = lmIndex().area.get(t);
  if (L) return L;
  return S.landmarks.find((M) => LANDMARKS[M.id].post && tIdx(M.x, M.y) === t) || null;
}
/** A Trade Post the atlas names (Ledger Post, Spring Market): its LANDMARKS entry, or null. */
function lmPostName(p) { const L = (S.landmarks || []).find((M) => LANDMARKS[M.id].post && M.x === p.x && M.y === p.y); return L ? LANDMARKS[L.id] : null; }
/** Nothing is built on a landmark's ground (canPlace, canRoad). */
function lmNoBuild(t) { return !!(S && S.landmarks && S.landmarks.length && lmIndex().nb.has(t)); }
/** Passenger Town's lawns: the Pathfinder's garden, where its deer graze (js/wildlife.js). */
function lmGarden(t) { return !!(S && S.landmarks && S.landmarks.length && lmIndex().garden.has(t)); }
/** Is tile t a landmark's solid ground (rock under its art: drawn as the ground round it, see pillarAt)? */
function lmSolidAt(t) { return !!(S && S.landmarks && S.landmarks.length && lmIndex().solid.has(t)); }
/** Why nothing goes on tile t (canPlace's reason), or ''. */
function lmWhy(t) { const L = lmNoBuild(t) && lmIndex().area.get(t); return L ? `${LANDMARKS[L.id].name}: a landmark of the atlas. Nothing is built on it.` : ''; }
/** The Stone Forest's cover: a robot among its pillars takes LM_COVER of the damage. */
function lmCover(u) {
  if (!S.landmarks || !S.landmarks.length) return 1;
  const C = lmIndex().cover;
  return C.size && C.has(tIdx(Math.floor(u.x), Math.floor(u.y))) ? LM_COVER : 1;
}
/** Is the Clock Geyser erupting at time `time` (on its fixed clock)? */
function lmGeyserOn(time) { return time >= LM_GEYSER.first && (time - LM_GEYSER.first) % LM_GEYSER.every < LM_GEYSER.burst; }
/** Seconds to the Clock Geyser's next eruption (0 while it erupts). */
function lmGeyserNext(time) { if (lmGeyserOn(time)) return 0; if (time < LM_GEYSER.first) return LM_GEYSER.first - time; return LM_GEYSER.every - ((time - LM_GEYSER.first) % LM_GEYSER.every); }

/** From the simulation, three times a second: the Clock Geyser's clock, and a wreck's hatch held. Deterministic. */
function lmTick(dt) {
  for (const L of S.landmarks) {
    if (L.id === 'geyser') {
      const on = lmGeyserOn(S.time) ? 1 : 0, t = tIdx(L.x, L.y);
      if (on !== L.on) {
        L.on = on;
        S.terrain[t] = on ? T_ROCK : T_GROUND; // (its vent blocked while it erupts)
        terrainChanged();
        if (on) addFx('ring', L.x + 0.5, L.y + 0.5, { color: '#e8f4ff', r: 1.6 });
      }
      if (on) for (const u of S.bots) {
        if (u.dead || u.inside || aloft(u) || BOTS[u.type].air || BOTS[u.type].sea || Math.max(Math.abs(u.x - L.x - 0.5), Math.abs(u.y - L.y - 0.5)) > 1.5) continue;
        damageBot(u, LM_GEYSER.scald * dt, undefined, undefined, true);
        if (Math.floor(u.x) === L.x && Math.floor(u.y) === L.y) { const to = nearestTile(t, (w) => walkable(w) && !S.bAt[w] && w !== t); if (to >= 0) moveOff(u, to); }
      }
    } else if (LANDMARKS[L.id].wreck && !L.got) {
      const hx = (L.hatch % S.W) + 0.5, hy = ((L.hatch / S.W) | 0) + 0.5;
      const here = S.bots.some((u) => !u.dead && !u.inside && u.owner === 0 && !BOTS[u.type].wild && !BOTS[u.type].air && !aloft(u) && Math.abs(u.x - hx) < 0.95 && Math.abs(u.y - hy) < 0.95);
      L.hold = here ? L.hold + dt : 0;
      if (L.hold >= LM_WRECK_HOLD) {
        L.got = 1; L.hold = 0;
        postMsg(0, `${LANDMARKS[L.id].ship}: log recovered. Tap the wreck to read it.`, L.x, L.y, 'narr');
      }
    }
  }
}

/* ------------------------------------------------------------------ the save */

/** Throw (bad) on a save's landmarks this version can't run. */
function lmCheckSave(o, bad) {
  const A = o.landmarks, N = o.W * o.H, tiles = (a) => Array.isArray(a) && a.length <= 128 && a.every((t) => Number.isInteger(t) && t >= 0 && t < N);
  if (!Array.isArray(A) || A.length > 4) bad();
  for (const L of A) {
    if (!L || typeof L !== 'object' || !Object.prototype.hasOwnProperty.call(LANDMARKS, L.id)) bad();
    if (!Number.isInteger(L.x) || !Number.isInteger(L.y) || L.x < 0 || L.y < 0 || L.x >= o.W || L.y >= o.H || !Number.isInteger(L.v) || L.v < 0 || L.v > 7) bad();
    if (!tiles(L.solid) || !tiles(L.area) || !tiles(L.water) || !tiles(L.rock)) bad();
    if (L.on != null && ![0, 1].includes(L.on)) bad();
    if (L.hatch != null && !(Number.isInteger(L.hatch) && L.hatch >= 0 && L.hatch < N)) bad();
    if (L.hold != null && !(Number.isFinite(L.hold) && L.hold >= 0)) bad();
    if (L.got != null && ![0, 1, 2].includes(L.got)) bad();
  }
}

/* ------------------------------------------------------------------ the art (lazily loaded) and drawing */

/** The landmarks' art loads only in a game with a landmark (in a single-file copy: the bundle landmarks.js beside it). */
const LANDMARK_ART = /^lm-/;
const _lmArt = { state: '' };
function lmArtKey(key) { return LANDMARK_ART.test(key); }
function ensureLandmarkArt() {
  if (_lmArt.state || typeof ART_MANIFEST !== 'object') return;
  _lmArt.state = 'loading';
  const keys = Object.keys(ART_MANIFEST).filter(lmArtKey);
  const entryOf = (k) => (typeof ART_MANIFEST[k] === 'string' ? { src: ART_MANIFEST[k] } : ART_MANIFEST[k]);
  const done = () => { _lmArt.state = 'in'; if (typeof todLandmarkIn === 'function') todLandmarkIn(); };
  if (typeof window !== 'undefined' && window.LANDMARK_BUNDLE) {
    const go = () => { const d = window.LANDMARK_DATA && window.LANDMARK_DATA.day; if (d) for (const k of keys) if (d[k]) loadArtKey(k, { ...entryOf(k), src: d[k] }); done(); };
    if (window.LANDMARK_DATA) { go(); return; }
    const sc = document.createElement('script');
    sc.src = 'landmarks.js';
    sc.onload = go;
    sc.onerror = () => { _lmArt.state = 'failed'; }; // (no bundle: drawn in code)
    document.head.appendChild(sc);
    return;
  }
  for (const k of keys) loadArtKey(k, entryOf(k));
  done();
}

/** The standing pieces among the buildings and robots (sorted with them by their foot): render.js's items. */
function lmItems(items, inView) {
  for (const L of S.landmarks) {
    if (LANDMARKS[L.id].post || !inView(L.x, L.y, 8)) continue;
    const k = LANDMARKS[L.id].wreck ? 'wreck' : L.id;
    if (k === 'town') {
      L.solid.forEach((t, n) => items.push({ ent: 'lm', L, part: 'house', n, x: t % S.W, y: ((t / S.W) | 0) + 0.85 }));
      items.push({ ent: 'lm', L, part: 'sign', x: L.x - 4, y: L.y - 0.2 });
    } else if (k === 'stone' || k === 'breach') L.solid.forEach((t, n) => items.push({ ent: 'lm', L, part: k, n, x: t % S.W, y: ((t / S.W) | 0) + 0.8 }));
    else if (k === 'lake' || k === 'crater') continue; // (flat: lmGround)
    else items.push({ ent: 'lm', L, part: k, x: L.x, y: L.y + (k === 'hull' || k === 'wreck' ? 0.9 : k === 'falls' ? -0.05 : 1.5) });
  }
}

/** Landmark art for key k (with the green and purple's fallbacks not needed: none is team-coloured). */
function lmArt(k) { return (typeof ART !== 'undefined' && ART[k]) || null; }

/** A standing piece (lmItems). */
function lmDraw(ctx, e, ox, oy, z) {
  const L = e.L, cx = ox + (e.part === 'house' || e.part === 'stone' || e.part === 'breach' ? e.x + 0.5 : L.x + 0.5) * z, cy = oy + (L.y + 0.5) * z;
  if (e.part === 'house') { const t = L.solid[e.n], x = ox + ((t % S.W) + 0.5) * z, y = oy + (((t / S.W) | 0) + 0.5) * z, art = lmArt('lm-house-' + (1 + ((e.n + L.v) % 3))); if (art) drawArt(ctx, art, x, y, z); else lmBox(ctx, x, y, z, 0.8, 0.55, '#d8d0c2', '#8a3e2e'); return; }
  if (e.part === 'sign') { const x = ox + (L.x - 3.5) * z, y = oy + (L.y - 0.5) * z, art = lmArt('lm-sign'); if (art) drawArt(ctx, art, x, y, z); else lmBox(ctx, x, y, z, 0.9, 0.35, '#e9e2cf', '#3a6e9a'); lmSignGlow(ctx, x, y, z); return; }
  if (e.part === 'stone' || e.part === 'breach') {
    const t = L.solid[e.n], x = ox + ((t % S.W) + 0.5) * z, y = oy + (((t / S.W) | 0) + 0.5) * z;
    const art = lmArt(e.part === 'stone' ? 'lm-pillar-' + (1 + (hash2(t, L.v, 821) * 3 | 0)) : 'lm-shaft');
    if (art) { drawArt(ctx, art, x, y, z); if (e.part === 'breach') lmShaftGlow(ctx, x, y, z, t); return; }
    if (e.part === 'stone') lmBox(ctx, x, y, z, 0.6, 1.6, '#b0583a', '#7a3622'); else { ctx.fillStyle = '#120a1a'; ctx.beginPath(); ctx.ellipse(x, y, z * 0.42, z * 0.32, 0, 0, Math.PI * 2); ctx.fill(); lmShaftGlow(ctx, x, y, z, t); }
    return;
  }
  const key = e.part === 'wreck' ? 'lm-wreck-' + LANDMARKS[L.id].wreck : 'lm-' + e.part, art = lmArt(key);
  if (e.part === 'falls') { lmFalls(ctx, L, ox, oy, z, art); return; }
  if (e.part === 'geyser') { if (art) drawArt(ctx, art, cx, cy, z); else lmBox(ctx, cx, cy, z, 1.4, 0.3, '#e9dcc0', '#c8a868'); lmGeyserPlume(ctx, L, cx, cy, z); return; }
  if (e.part === 'hull' && !art && typeof drawPathfinderHull === 'function') { lmBox(ctx, cx, cy - z * 0.5, z, 4.6, 1.0, '#e8e4da', '#9a948a'); return; }
  if (art) drawArt(ctx, art, cx, cy - (e.part === 'hull' || e.part === 'wreck' ? z * 0.5 : 0), z);
  else if (e.part === 'spire') { lmBox(ctx, cx, cy, z, 2.6, 0.6, '#6b5e66', '#3d343a'); ctx.fillStyle = '#c9a8ff'; ctx.beginPath(); ctx.moveTo(cx - z * 0.4, cy); ctx.lineTo(cx, cy - z * 3.6); ctx.lineTo(cx + z * 0.45, cy); ctx.fill(); }
  else if (e.part === 'wreck') lmBox(ctx, cx, cy - z * 0.5, z, 2.8, 0.9, '#8d8a84', '#4c4842');
  if (e.part === 'spire') lmSpireGlow(ctx, cx, cy, z);
  if (e.part === 'wreck' && !L.got && L.hold > 0) lmHoldRing(ctx, L, ox, oy, z);
}
/** A plain block (no art yet): a top and a front face. */
function lmBox(ctx, x, y, z, w, h, top, side) {
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(x + z * 0.1, y + z * 0.2, z * w * 0.55, z * 0.3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = typeof todColor === 'function' ? todColor(side) : side; ctx.fillRect(x - z * w / 2, y - z * h + z * 0.25, z * w, z * h);
  ctx.fillStyle = typeof todColor === 'function' ? todColor(top) : top; ctx.fillRect(x - z * w / 2, y - z * h - z * 0.05, z * w, z * 0.3);
}
/** How dark it is (0 day to 1 night), for the lights the art doesn't carry. */
function lmNight() { return typeof TOD !== 'undefined' && TOD.active && TOD.state ? clamp(TOD.state.lights || 0, 0, 1) : 0; }
function lmSignGlow(ctx, x, y, z) {
  const k = lmNight();
  if (k < 0.02 || typeof R === 'undefined' || R.inMap) return;
  const art = lmArt('lm-sign-glow');
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = k * (0.85 + 0.15 * Math.sin(R.time * 9.7) * (Math.sin(R.time * 0.71) > 0.8 ? 1 : 0)); // (a flicker now and then)
  if (art) drawArtRaw(ctx, art, x, y, z);
  else { ctx.fillStyle = '#ffd27a'; ctx.fillRect(x - z * 0.4, y - z * 0.55, z * 0.8, z * 0.14); }
  ctx.restore();
}
function lmSpireGlow(ctx, x, y, z) {
  const k = 0.06 + 0.94 * lmNight();
  if (typeof R === 'undefined' || R.inMap) return;
  const art = lmArt('lm-spire-glow');
  if (!art) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = k * (0.8 + 0.2 * Math.sin(R.time * 0.9)); drawArtRaw(ctx, art, x, y, z); ctx.restore();
}
function lmShaftGlow(ctx, x, y, z, t) {
  const k = 0.3 + 0.7 * lmNight();
  if (typeof R === 'undefined' || R.inMap) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0, x, y, z * 0.5);
  const a = k * (0.35 + 0.15 * Math.sin(R.time * 0.8 + t)); // (air moving in and out of it, like breath)
  g.addColorStop(0, `rgba(170,110,255,${a})`); g.addColorStop(1, 'rgba(170,110,255,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, z * 0.5, z * 0.38, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
/** The Long Falls: the cliff is the map's rock; the art is the water going over its edge into the pool. */
function lmFalls(ctx, L, ox, oy, z, art) {
  const x = ox + (L.x + 0.5) * z, y = oy + L.y * z; // (the cliff's foot: the pool's top edge)
  if (art) drawArt(ctx, art, x, y, z);
  if (typeof R === 'undefined' || R.inMap) return;
  // the water moving: streaks running down the fall, and its spray over the pool
  ctx.save();
  const w = z * 1.3, top = y - z * 1.05;
  ctx.beginPath(); ctx.rect(x - w / 2, top, w, z * 1.1); ctx.clip();
  ctx.strokeStyle = 'rgba(240,250,255,0.55)'; ctx.lineWidth = Math.max(1, z * 0.04);
  for (let k = 0; k < 9; k++) {
    const sx = x - w / 2 + ((k + 0.5) / 9) * w, ph = (R.time * 1.6 + hash2(k, L.x, 823)) % 1;
    ctx.beginPath(); ctx.moveTo(sx, top + ph * z * 1.1 - z * 0.25); ctx.lineTo(sx, top + ph * z * 1.1); ctx.stroke();
  }
  ctx.restore();
  ctx.save(); ctx.globalAlpha = 0.5;
  for (let k = 0; k < 5; k++) {
    const ph = (R.time * 0.4 + k / 5) % 1, sx = x + (hash2(k, L.y, 824) - 0.5) * z * 1.2;
    ctx.fillStyle = `rgba(235,245,255,${0.35 * (1 - ph)})`;
    ctx.beginPath(); ctx.arc(sx, y + z * 0.12 - ph * z * 0.4, z * (0.12 + ph * 0.25), 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
/** The Clock Geyser's eruption: a column of steam and water, the rumble before it (drawn from the simulation's clock). */
function lmGeyserPlume(ctx, L, x, y, z) {
  if (typeof R === 'undefined' || R.inMap) return;
  const tm = S.time, on = lmGeyserOn(tm), next = lmGeyserNext(tm);
  const ga = ctx.globalAlpha;
  if (!on && next < 3) { // (the vent seething before it goes)
    ctx.fillStyle = `rgba(240,248,255,${0.25 * (1 - next / 3)})`;
    for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(x + (hash2(k, Math.floor(R.time * 6), 825) - 0.5) * z * 0.4, y - z * 0.2 - k * z * 0.12, z * 0.14, 0, Math.PI * 2); ctx.fill(); }
    return;
  }
  if (!on) return;
  const into = (tm - LM_GEYSER.first) % LM_GEYSER.every, k = Math.min(1, into / 0.8) * Math.min(1, (LM_GEYSER.burst - into) / 1.5), H = z * 3.6 * k;
  const g = ctx.createLinearGradient(0, y - H, 0, y);
  g.addColorStop(0, 'rgba(250,252,255,0)'); g.addColorStop(0.35, 'rgba(245,250,255,0.75)'); g.addColorStop(1, 'rgba(230,240,250,0.95)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(x - z * 0.16, y - z * 0.1);
  ctx.quadraticCurveTo(x - z * 0.35, y - H * 0.6, x - z * 0.55 + Math.sin(R.time * 3) * z * 0.08, y - H);
  ctx.lineTo(x + z * 0.55 + Math.sin(R.time * 2.6) * z * 0.08, y - H);
  ctx.quadraticCurveTo(x + z * 0.35, y - H * 0.6, x + z * 0.16, y - z * 0.1); ctx.closePath(); ctx.fill();
  for (let n = 0; n < 7; n++) { // (billows at its head, drifting)
    const a = hash2(n, Math.floor(tm), 826), sx = x + (a - 0.5) * z * 1.2, sy = y - H + (hash2(n, 3, 827) - 0.5) * z * 0.5;
    ctx.fillStyle = 'rgba(245,250,255,0.5)'; ctx.beginPath(); ctx.arc(sx, sy, z * (0.25 + 0.2 * a) * k, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = ga;
}
/** A wreck's hatch being held: a ring filling as the seconds add up. */
function lmHoldRing(ctx, L, ox, oy, z) {
  const x = ox + ((L.hatch % S.W) + 0.5) * z, y = oy + (((L.hatch / S.W) | 0) + 0.5) * z, f = clamp(L.hold / LM_WRECK_HOLD, 0, 1);
  ctx.save(); ctx.lineWidth = Math.max(2, z * 0.08);
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.arc(x, y, z * 0.45, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#ffe29a'; ctx.beginPath(); ctx.arc(x, y, z * 0.45, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); ctx.stroke();
  ctx.restore();
}

/** The flat ones, drawn with the ground (before its light, which grades them with it): Glass Lake's ice, Silent Crater, the town's lawns and street, the geyser's terraces, a wreck's furrow. */
function lmGround(ctx, ox, oy, z, inView) {
  for (const L of S.landmarks) {
    if (LANDMARKS[L.id].post || !inView(L.x, L.y, 8)) continue;
    const cx = ox + (L.x + 0.5) * z, cy = oy + (L.y + 0.5) * z;
    const flat = L.id === 'lake' ? 'lm-lake' : L.id === 'crater' ? 'lm-crater' : L.id === 'town' ? (L.v & 4 ? 'lm-town-s' : 'lm-town') : null;
    const art = flat && lmArt(flat);
    if (art) { drawArtRaw(ctx, art, cx, cy, z); continue; } // (as it is: the ground's light grades it after)
    if (L.id === 'lake') {
      ctx.save(); ctx.globalAlpha = 0.85;
      const g = ctx.createRadialGradient(cx, cy, z, cx, cy, z * 4.6);
      g.addColorStop(0, '#cfe8f4'); g.addColorStop(0.8, '#a9cfe3'); g.addColorStop(1, '#e8f4fa');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, cy, z * 4.9, z * 3.3, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    } else if (L.id === 'crater') {
      ctx.save(); ctx.strokeStyle = 'rgba(30,30,34,0.45)'; ctx.lineWidth = z * 0.5; ctx.beginPath(); ctx.ellipse(cx, cy, z * 3.2, z * 3.0, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    } else if (L.id === 'town') {
      ctx.save(); ctx.fillStyle = 'rgba(120,170,90,0.55)'; ctx.fillRect(ox + (L.x - 4) * z, oy + (L.y - 3) * z, z * 9, z * 7);
      ctx.fillStyle = 'rgba(120,118,112,0.8)'; ctx.fillRect(ox + (L.x - 4) * z, oy + L.y * z + z * 0.2, z * 9, z * 0.6); ctx.restore();
    }
  }
}

/** Night: the lights the landmarks give (the town's windows and signs, the Spire's crystal, the shafts' violet), as light pools. */
function lmLights(pool, ox, oy, z, inView) {
  const k = lmNight();
  if (k < 0.02) return;
  for (const L of S.landmarks) {
    if (!inView(L.x, L.y, 8)) continue;
    if (L.id === 'town') { pool(ox + (L.x - 3.5) * z, oy + (L.y - 0.2) * z, z * 1.6, '#ffd27a'); for (const t of L.solid) if (hash2(t, 1, 828) < 0.35) pool(ox + ((t % S.W) + 0.5) * z, oy + (((t / S.W) | 0) + 0.9) * z, z * 0.9, '#ffcf8a'); }
    else if (L.id === 'spire') pool(ox + (L.x + 0.5) * z, oy + (L.y + 0.5) * z, z * 5, '#b88cff');
    else if (L.id === 'breach') for (const t of L.solid) pool(ox + ((t % S.W) + 0.5) * z, oy + (((t / S.W) | 0) + 0.5) * z, z * 1.8, '#a46cff');
  }
}

/**
 * The names: the one under the mouse (or the one whose panel is open), in a label over it; zoomed out, each in faded
 * atlas lettering over its ground, as the atlas writes them.
 */
function lmLabels(ctx, ox, oy, z, inView) {
  if (typeof R === 'undefined' || R.clean >= 2) return;
  const hover = typeof UI !== 'undefined' && UI.hoverTile >= 0 ? lmAt(UI.hoverTile) : null;
  const open = typeof UI !== 'undefined' && UI.sheetKind === 'lm' ? S.landmarks.find((L) => tIdx(L.x, L.y) === UI.sheetFor) : null;
  for (const L of S.landmarks) {
    if (!inView(L.x, L.y, 10)) continue;
    const D = LANDMARKS[L.id], x = ox + (L.x + 0.5) * z;
    if (z < 22) { // (the atlas lettering: small caps, spaced, faded)
      const a = clamp((22 - z) / 8, 0, 1) * 0.7, fs = Math.max(10, Math.min(18, z * 0.9));
      ctx.save(); ctx.globalAlpha = a; ctx.font = `600 ${fs}px Georgia, 'Times New Roman', serif`; ctx.textAlign = 'center';
      if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(fs * 0.18)}px`;
      const txt = D.name.replace(/^The /, 'the ').toUpperCase(), y = oy + (L.y + (D.post ? 1.9 : 3.2)) * z;
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(20,16,12,0.55)'; ctx.strokeText(txt, x, y);
      ctx.fillStyle = '#f1e4c8'; ctx.fillText(txt, x, y);
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      ctx.restore();
    }
    if (L !== hover && L !== open) continue;
    const fs = Math.max(12, Math.min(16, z * 0.42)), y = oy + (L.y - (L.id === 'spire' ? 3.8 : L.id === 'falls' ? 2.6 : 1.6)) * z;
    ctx.save(); ctx.font = `700 ${fs}px system-ui, sans-serif`; ctx.textAlign = 'center';
    const w = ctx.measureText(D.name).width + fs;
    ctx.fillStyle = 'rgba(14,18,26,0.82)'; ctx.fillRect(x - w / 2, y - fs * 1.2, w, fs * 1.6);
    ctx.fillStyle = '#ffe9b8'; ctx.fillText(D.name, x, y);
    ctx.restore();
  }
}

/* ------------------------------------------------------------------ its panel */

/** Tapped: the landmark's panel (its name, its line, what it does; a wreck's log once recovered). */
function lmSheet(L) {
  const D = LANDMARKS[L.id], t = tIdx(L.x, L.y);
  if (typeof R !== 'undefined') { R.selected = 0; R.selTile = -1; }
  if (typeof UI !== 'undefined') UI.selBot = 0;
  let state = '';
  if (L.id === 'geyser') { const n = lmGeyserNext(S.time); state = n ? `Next eruption in ${Math.ceil(n)} s.` : 'Erupting now.'; }
  if (D.wreck) state = L.got ? '' : L.hold > 0 ? `Recovering its log: ${Math.floor(L.hold)} of ${LM_WRECK_HOLD} s.` : 'Its log is still aboard.';
  const log = D.wreck && L.got ? `<p class="lore-log lm-log">${esc(LM_LOGS[D.wreck])}</p>` : '';
  const html = `<div class="sheet-title"><div><h3>${esc(D.name)}</h3><div class="sub">A landmark of the atlas${S.contingency ? `: ${esc(contName(S.contingency.at))}` : ''}</div></div></div>
    <p class="flavor">${esc(D.line)}</p>${log}
    <p class="desc">${esc(D.wreck && L.got === 1 ? 'Its log is recovered: kept in this run (the year\'s report) and in the Lore guide\'s atlas page.' : D.does)}${state ? ` <b>${esc(state)}</b>` : ''}${L.got === 2 ? ' <b>Its log was recovered earlier in this run.</b>' : ''}</p>`;
  openSheet('lm', t, html);
  if (D.post && typeof openPostSheet === 'function') { const p = postAt(t); if (p) { $('sheet-body').insertAdjacentHTML('beforeend', '<div class="btn-row"><button class="btn primary" id="sh-lm-post">The Trade Post</button></div>'); $('sh-lm-post').onclick = () => { sfx('click'); openPostSheet(p); }; } }
}
/** A few times a second (the interface): a wreck's log just recovered opens its panel; the device keeps it for the Lore guide. */
function lmUiTick() {
  if (!S || !S.landmarks || typeof UI === 'undefined' || !UI.inGame) return;
  for (const L of S.landmarks) {
    const D = LANDMARKS[L.id];
    if (!D.wreck || L.got !== 1 || L.shown) continue;
    L.shown = 1; // (the interface's own note: not part of the game's state)
    lmKeepLog(D.wreck);
    if (typeof sfx === 'function') sfx('alert');
    lmSheet(L);
  }
}
/** The logs found on this device (the Lore guide shows them: openLore). */
const LM_LOGS_KEY = 'terrafall.logs';
function lmKeptLogs() { try { const a = JSON.parse(localStorage.getItem(LM_LOGS_KEY) || '[]'); return Array.isArray(a) ? a.filter((k) => LM_LOGS[k]) : []; } catch (e) { return []; } }
function lmKeepLog(k) { try { const a = lmKeptLogs(); if (!a.includes(k)) { a.push(k); localStorage.setItem(LM_LOGS_KEY, JSON.stringify(a)); } } catch (e) { /* storage unavailable */ } }
/** The Lore guide's atlas page: the wrecks' logs found on this device, under the named places. */
function lmLoreLogs() {
  const el = typeof document !== 'undefined' && document.getElementById('lore-logs');
  if (!el) return;
  const got = lmKeptLogs();
  el.hidden = !got.length;
  el.innerHTML = got.length ? `<h4>Recovered logs</h4>${got.map((k) => `<p class="lore-log">${esc(LM_LOGS[k])}</p>`).join('')}` : '';
}

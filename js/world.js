'use strict';
/*
 * Terrafall — world state: map generation, entities, territory, placement rules, save/load.
 *
 * All game state lives in the global `S` and is plain JSON-friendly data (entities refer to
 * each other by numeric id, never by object reference), so saving is just serialising S.
 */

let S = null;

function tIdx(i, j) { return j * S.W + i; }
function inMap(i, j) { return i >= 0 && j >= 0 && i < S.W && j < S.H; }
function getE(id) { return id ? S.byId.get(id) || null : null; }

/* ------------------------------------------------------------------ map generation */

/**
 * Generates a point-symmetric map (rotated 180°) so both sides are equally fair.
 * Player 0 starts near the bottom, player 1 near the top.
 *
 * Terrain has several elevation levels. Cliffs between levels block bots; slopes (ramps)
 * at a few narrow passes connect them, so every reachable area is linked but routes can be long.
 * cfg.rough (0 flat … 4 mountainous) and cfg.rich (0 scarce … 4 abundant) come from the
 * new-game settings.
 */
function generateMap(seed, W, H, cfg) {
  cfg = cfg || {};
  const TPR = TERRAIN_PRESETS[cfg.rough ?? DEFAULT_ROUGH];
  const RPR = RESOURCE_PRESETS[cfg.rich ?? DEFAULT_RICH];
  const N = W * H;
  const terrain = new Uint8Array(N), res = new Uint8Array(N), amt = new Uint8Array(N);
  const elev = new Uint8Array(N), ramp = new Uint8Array(N), fert = new Uint8Array(N);
  const minE = new Int8Array(N).fill(-1); // shaped features (plateaus): the lowest a tile may be smoothed to
  const id = (i, j) => j * W + i;
  const orth = (t, fn) => {
    const i = t % W, j = (t / W) | 0;
    if (i > 0) fn(t - 1);
    if (i < W - 1) fn(t + 1);
    if (j > 0) fn(t - W);
    if (j < H - 1) fn(t + W);
  };
  const mir = (t) => N - 1 - t; // the tile rotated 180° about the map centre
  const sH = seed * 7 + 11, sM = seed * 13 + 5, sB = seed * 31 + 9, sC = seed * 17 + 3, sR = seed * 3 + 1;
  const sE = seed * 19 + 23, sO = seed * 29 + 41;
  const half = Math.floor(H / 2);
  const SH = SHAPE_PRESETS[cfg.shape || 0] || SHAPE_PRESETS[0];
  // Three players: a round planet (crags, or sea on Islands, beyond the circle) with the bases 120°
  // apart. Player 0's third (the sector pointing down) is generated and turned round onto the
  // other two, so every start is the same. Two players: the bottom half, rotated onto the top.
  const np = cfg.players === 3 ? 3 : 2;
  const ccx = (W - 1) / 2, ccy = (H - 1) / 2, discR = Math.min(W, H) / 2 - 0.5, SEC = (2 * Math.PI) / 3;
  const sector = (x, y) => { let a = Math.atan2(y - ccy, x - ccx) - Math.PI / 6; a = ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI); return Math.floor(a / SEC) % 3; };
  const rot = (x, y, k) => { const a = k * SEC, c = Math.cos(a), sn = Math.sin(a), dx = x - ccx, dy = y - ccy; return [ccx + dx * c - dy * sn, ccy + dx * sn + dy * c]; };
  const inDisc = (i, j) => dist2(i, j, ccx, ccy) <= discR * discR;
  const canon = np === 2 ? (i, j) => j >= half : (i, j) => sector(i, j) === 0 && inDisc(i, j);
  // A random point in the generated part of the map (three players).
  const canonPoint = (rng, margin) => {
    for (;;) {
      const a = Math.PI / 6 + 0.06 + rng() * (SEC - 0.12), r = Math.sqrt(rng()) * (discR - margin);
      const x = ccx + Math.cos(a) * r, y = ccy + Math.sin(a) * r;
      if (x >= 1 && y >= 1 && x < W - 2 && y < H - 2) return [x, y];
    }
  };
  // Crater and Plateau maps need cliffs: at least three levels, the rest kept flat on Flat terrain.
  const L = Math.max(TPR.levels, SH.minLevels || 1), flatRest = TPR.levels === 1 && L > 1;
  const thresholds = [];
  const step = L >= 5 ? 0.07 : L >= 4 ? 0.085 : 0.1;
  for (let k = 0; k < L - 1; k++) thresholds.push(0.5 + (k - (L - 2) / 2) * step);
  const baseLevel = Math.floor((L - 1) / 2);
  const dens = RPR.density;

  // 1) Terrain and elevation for the bottom half.
  for (let j = half; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const h = fbm(i / 8.5, j / 8.5, sH, 4);
      const t = id(i, j);
      terrain[t] = h > TPR.rock ? T_ROCK : h < 0.29 ? T_WATER : T_GROUND;
      const e = fbm(i / TPR.scale, j / TPR.scale, sE, 3);
      let lv = 0;
      for (const th of thresholds) if (e >= th) lv++;
      elev[t] = flatRest ? baseLevel : lv;
    }
  }
  // Islands: the sea covers everything but a home island round each base, a big island in the
  // middle and a few islets, so the only ways across are bridges. Land is kept at least
  // ISLE_GAP tiles from any other island's shore. Applied to the bottom half after the fields are
  // laid (anything left in the sea is cleared), then mirrored with the rest.
  let isleCut = null;
  if (SH.islands) {
    const bx0 = Math.floor(W / 2), by0 = H - 7, halfH = H - half;
    let isles;
    if (np === 2) {
      const homeTop = H - 21.5 - Math.max(0, (halfH - 41) * 0.5);
      const cRy = clamp(homeTop - half - 4.5, 3, 16);
      const gap = homeTop - half - cRy;
      isles = [
        { x: bx0, y: (by0 + 6 + homeTop) / 2, rx: W * 0.4, ry: (by0 + 6 - homeTop) / 2 },
        { x: ccx, y: ccy, rx: W * 0.3, ry: cRy + 0.5 },
        { x: W * 0.08, y: half + cRy, rx: 2.4, ry: 2.4 },
      ];
      // A long crossing gets stepping-stone islets in it.
      if (gap > 9) { const r = (gap - 5) / 2; isles.push({ x: W * 0.3, y: half + cRy + gap / 2, rx: r, ry: r }, { x: W * 0.72, y: half + cRy + gap / 2, rx: r, ry: r }); }
    } else {
      // Three home islands round a central one, and an islet out on each side of every home island.
      const dB = dist(bx0, by0, ccx, ccy), hr = clamp(dB * 0.42, 9, 13), cr = Math.max(3, dB - 4 - hr - 4.5);
      const base = [{ x: bx0, y: by0 - 4, rx: hr, ry: hr }];
      for (const a of [Math.PI / 4, (3 * Math.PI) / 4]) base.push({ x: ccx + Math.cos(a) * discR * 0.66, y: ccy + Math.sin(a) * discR * 0.66, rx: 2.6, ry: 2.6 });
      isles = [{ x: ccx, y: ccy, rx: cr, ry: cr }];
      for (const o of base) for (let k = 0; k < 3; k++) { const [x, y] = rot(o.x, o.y, k); isles.push({ x, y, rx: o.rx, ry: o.ry }); }
    }
    const out = (o, i, j) => (Math.sqrt(((i - o.x) / o.rx) ** 2 + ((j - o.y) / o.ry) ** 2) - 1) * Math.min(o.rx, o.ry);
    isleCut = () => {
      for (let j = half; j < H; j++) for (let i = 0; i < W; i++) {
        if (!canon(i, j)) continue;
        const t = id(i, j), wob = (fbm(i / 4, j / 4, sO, 2) - 0.5) * 3;
        let k = -1, best = Infinity;
        isles.forEach((o, n) => { const d = out(o, i, j) - wob; if (d < best) { best = d; k = n; } });
        const land = best <= 0 && isles.every((o, n) => n === k || out(o, i, j) >= ISLE_GAP + 1.5); // + the most a shore wobbles out
        if (!land) { terrain[t] = T_WATER; res[t] = R_NONE; fert[t] = 0; }
        else if (terrain[t] === T_WATER) terrain[t] = T_GROUND;
      }
      // Specks of land the wobble cut off from their island go under.
      const lab = new Int32Array(N).fill(-1);
      for (let t = half * W; t < N; t++) {
        if (terrain[t] === T_WATER || lab[t] >= 0 || !canon(t % W, (t / W) | 0)) continue;
        const q = [t];
        lab[t] = t;
        let edge = false;
        for (let h = 0; h < q.length; h++) orth(q[h], (u) => {
          if (!canon(u % W, (u / W) | 0)) { edge = true; return; }
          if (lab[u] < 0 && terrain[u] !== T_WATER) { lab[u] = t; q.push(u); }
        });
        if (!edge && q.length < 8) for (const u of q) { terrain[u] = T_WATER; res[u] = R_NONE; fert[u] = 0; }
      }
    };
    isleCut();
  }
  // 2) Resources come in separate fields (clusters) with open ground between them, so holding
  //    the land around a field matters. Fields are laid out on the bottom half, then mirrored.
  const rng = makeRng(seed ^ 0x5bd1e995);
  const bx = Math.floor(W / 2), by = H - 7;
  const bases = [{ x: bx, y: by }];
  if (np === 2) bases.push({ x: W - 1 - bx, y: H - 1 - by });
  else for (let k = 1; k < 3; k++) { const [x, y] = rot(bx, by, k); bases.push({ x: Math.round(x), y: Math.round(y) }); }
  const F_FERTILE = 100;
  const stampDens = clamp(dens, 0.7, 1.15);
  const fields = [];
  // force: the field and a ring of ground around it become open land, so it is never cut off by
  // water or crags (used for the guaranteed fields). Fields near the base sit on its terrace.
  const field = (cx, cy, rad, type, fill, force) => {
    fields.push({ x: cx, y: cy, r: rad });
    const near = dist2(cx, cy, bx, by) < 100;
    if (force && type !== -1) {
      const m = rad + 1.5;
      for (let j = Math.floor(cy - m); j <= Math.ceil(cy + m); j++) {
        for (let i = Math.floor(cx - m); i <= Math.ceil(cx + m); i++) {
          if (i < 1 || !canon(i, j) || i >= W - 1 || j >= H - 1 || dist2(i, j, cx, cy) > m * m) continue;
          terrain[id(i, j)] = T_GROUND;
          if (near) elev[id(i, j)] = baseLevel;
        }
      }
    }
    for (let j = Math.floor(cy - rad); j <= Math.ceil(cy + rad); j++) {
      for (let i = Math.floor(cx - rad); i <= Math.ceil(cx + rad); i++) {
        if (i < 1 || !canon(i, j) || i >= W - 1 || j >= H - 1) continue;
        const d2 = dist2(i, j, cx, cy);
        if (d2 > rad * rad) continue;
        const t = id(i, j);
        if (force) terrain[t] = T_GROUND;
        else if (terrain[t] !== T_GROUND) continue;
        if (type === -1) { res[t] = R_NONE; fert[t] = 0; elev[t] = baseLevel; continue; }
        // Denser in the middle of the field, thinning out at the edge.
        if (rng() >= fill * (1 - 0.45 * d2 / (rad * rad + 0.01))) continue;
        if (type === F_FERTILE) { fert[t] = 1; res[t] = R_NONE; } else { res[t] = type; fert[t] = 0; }
      }
    }
  };
  const jit = () => Math.floor(rng() * 3) - 1;
  // The landing zone is one flat terrace so the starter fields are always within easy reach.
  for (let j = by - 7; j <= Math.min(H - 1, by + 7); j++) {
    for (let i = bx - 7; i <= bx + 7; i++) if (dist2(i, j, bx, by) <= 49.5) elev[id(i, j)] = baseLevel;
  }
  // Starter fields inside the landing zone.
  field(bx - 6 + jit(), by - 2 + jit(), 2.5, R_STALK, 0.85 * stampDens, true);
  field(bx - 4, by + 4, 1.4, R_STALK, 0.8 * stampDens, true);
  field(bx + 6 + jit(), by + jit(), 1.8, R_BOULDER, 0.8 * stampDens, true);
  field(bx - 4 + jit(), by - 5, 1.3, R_ORE, 0.9 * stampDens, true);
  field(bx + 4 + jit(), by - 5, 1.3, R_CRYSTAL, 0.9 * stampDens, true);
  field(bx + 2, by + 4, 1.2, R_BOULDER, 0.7 * stampDens, true);
  field(bx, by - 7.5, 2.0, F_FERTILE, 0.85, true);
  // Richer fields just beyond the starting border reward expanding with Outposts.
  field(bx + 8 + jit(), by - 11 + jit(), 1.6, R_ORE, 0.8 * stampDens, true);
  field(bx - 9 + jit(), by - 10 + jit(), 1.5, R_CRYSTAL, 0.8 * stampDens, true);
  field(bx + 1 + jit(), by - 13, 1.1, R_OIL, 0.9, true);
  // Contested fields near the middle (mirrored, so there is one on each side) and an oil field
  // right in the centre that both sides want.
  if (np === 2) {
    field(Math.floor(W / 2) - 6, half + 3, 1.7, R_ORE, 0.85, true);
    field(Math.floor(W / 2) + 5, half + 2, 1.4, R_CRYSTAL, 0.85, true);
    field(Math.floor(W / 2) - 1, half + 1, 1.2, R_OIL, 0.9, true);
  } else {
    field(ccx - 3.5, ccy + 6, 1.7, R_ORE, 0.85, true);
    field(ccx + 3.5, ccy + 6, 1.4, R_CRYSTAL, 0.85, true);
    field(ccx, ccy + 3, 1.0, R_OIL, 0.9, true);
  }
  // More fields scattered over the rest of the half, kept apart from each other and the base.
  // Richer settings mean more fields and slightly bigger ones. Rare fields are placed first so a
  // crowded map never squeezes them out.
  const areaK = (W * H) / (40 * 56), rK = Math.pow(dens, 0.25);
  const want = (n) => { const x = n * areaK * Math.sqrt(dens); return Math.floor(x) + (rng() < x - Math.floor(x) ? 1 : 0); };
  const bag = [];
  const add = (n, type, r0, r1, fill) => { for (let k = want(n); k > 0; k--) bag.push({ type, r: (r0 + rng() * (r1 - r0)) * rK, fill }); };
  add(0.6, R_OIL, 0.9, 1.2, 0.9);
  add(1.5, F_FERTILE, 1.8, 2.5, 0.85);
  add(2, R_ORE, 1.3, 1.7, 0.8);
  add(2, R_CRYSTAL, 1.2, 1.6, 0.8);
  add(4, R_BOULDER, 1.4, 2.0, 0.75);
  add(5, R_STALK, 2.2, 3.0, 0.75);
  for (const f of bag) {
    for (let tries = 0, gap = 1.5; tries < 80; tries++) {
      if (tries === 30) gap = 0; // crowded map: let fields sit closer together
      if (tries === 55) gap = -1;
      const [x, y] = np === 2 ? [2 + rng() * (W - 5), half + 1 + rng() * (H - half - 3)] : canonPoint(rng, 3);
      if (terrain[id(Math.floor(x), Math.floor(y))] !== T_GROUND) continue;
      if (dist2(x, y, bx, by) < 64) continue;
      if (fields.some((o) => dist2(x, y, o.x, o.y) < (o.r + f.r + gap) ** 2)) continue;
      field(x, y, f.r, f.type, f.fill, false);
      break;
    }
  }

  // Nuclear race: a few single uranium deposits, mostly out towards the middle of the map.
  if (cfg.nuke) {
    let placed = 0;
    for (let tries = 0; tries < 600 && placed < URANIUM_DEPOSITS; tries++) {
      const [x, y] = np === 2 ? [1 + Math.floor(rng() * (W - 2)), half + 1 + Math.floor(rng() * (H - half - 2))] : canonPoint(rng, 2).map(Math.floor);
      const t = id(x, y), d = Math.sqrt(dist2(x, y, bx, by));
      if (terrain[t] !== T_GROUND || res[t] || fert[t] || d < 11) continue;
      if (rng() > clamp((d - 8) / 20, 0.25, 1)) continue; // deposits near the base are rarer
      res[t] = R_URANIUM;
      placed++;
    }
  }

  // 3) Player 0 base: a flat landing zone.
  field(bx, by, 3.4, -1, 0, true);
  fields.pop();
  if (isleCut) isleCut(); // fields that spilled into the sea are trimmed back to the shore

  // 4) Mirror the bottom half onto the top half.
  const mirror = () => {
    for (let t = 0; t < N; t++) {
      if (((t / W) | 0) >= half) continue;
      const m2 = mir(t);
      terrain[t] = terrain[m2]; res[t] = res[m2]; elev[t] = elev[m2]; fert[t] = fert[m2];
    }
  };
  // Three players: turn player 0's third round onto the other two (each tile takes the value of
  // its twin in the first third), and close the corners off.
  const turn = () => {
    const arrs = [terrain, res, elev, fert, minE], snap = arrs.map((a) => a.slice());
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const t = id(i, j);
      if (!inDisc(i, j)) { terrain[t] = SH.islands ? T_WATER : T_ROCK; res[t] = R_NONE; fert[t] = 0; continue; }
      const k = sector(i, j);
      if (k === 0) continue;
      const [sx, sy] = rot(i, j, -k);
      let src = -1;
      for (const [ox, oy] of [[0, 0], [0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5], [0.5, 0.5], [-0.5, -0.5]]) {
        const si = Math.round(sx + ox), sj = Math.round(sy + oy);
        if (si >= 0 && sj >= 0 && si < W && sj < H && sector(si, sj) === 0) { src = id(si, sj); break; }
      }
      if (src < 0) continue;
      for (let a = 0; a < arrs.length; a++) arrs[a][t] = snap[a][src];
    }
    // Resources and fertile soil are placed tile for tile at their turned spots instead, so each
    // third ends up with exactly as many.
    const res0 = snap[1], fert0 = snap[3];
    for (let t = 0; t < N; t++) if (sector(t % W, (t / W) | 0) !== 0) { res[t] = R_NONE; fert[t] = 0; }
    for (let t = 0; t < N; t++) {
      const i = t % W, j = (t / W) | 0;
      if ((!res0[t] && !fert0[t]) || sector(i, j) !== 0 || !inDisc(i, j)) continue;
      for (let k = 1; k < 3; k++) {
        const [x, y] = rot(i, j, k);
        let best = -1, bd = Infinity;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
          const u = Math.round(x) + di, v = Math.round(y) + dj;
          if (u < 0 || v < 0 || u >= W || v >= H || !inDisc(u, v) || sector(u, v) !== k) continue;
          const q = id(u, v);
          if (res[q] || fert[q] || terrain[q] !== terrain[t]) continue;
          const d = dist2(u, v, x, y);
          if (d < bd) { bd = d; best = q; }
        }
        if (best < 0) continue;
        if (res0[t]) res[best] = res0[t];
        if (fert0[t]) fert[best] = fert0[t];
      }
    }
  };
  const symmetrize = np === 2 ? mirror : turn;
  symmetrize();

  // Chokepoint maps: a band of rocky crags right across the middle of the planet, broken by a
  // single narrow pass in the centre, with open ground leading up to it from both sides. (Mirrored
  // by construction: the rows and the pass are centred on the map.)
  const choke = np === 2 && !!(SHAPE_PRESETS[cfg.shape || 0] && SHAPE_PRESETS[cfg.shape || 0].choke);
  const chokeBand = () => {
    const p0 = Math.floor((W - 1) / 2) - 1, p1 = Math.ceil((W - 1) / 2) + 1;
    const top = half - CHOKE_BAND, bot = half + CHOKE_BAND - 1;
    const passLevel = elev[id(Math.floor(W / 2), bot + CHOKE_APPROACH + 1)];
    for (let j = top - CHOKE_APPROACH; j <= bot + CHOKE_APPROACH; j++) for (let i = 0; i < W; i++) {
      const t = id(i, j), inBand = j >= top && j <= bot, inPass = i >= p0 && i <= p1;
      if (inBand && !inPass) { terrain[t] = T_ROCK; res[t] = R_NONE; fert[t] = 0; continue; }
      if (inPass) { terrain[t] = T_GROUND; res[t] = R_NONE; fert[t] = 0; elev[t] = passLevel; }
    }
  };
  if (choke) chokeBand();

  const ground = (t) => terrain[t] === T_GROUND;
  const reachable = (useElev) => {
    const seen = new Uint8Array(N), q = [id(bx, by)];
    seen[q[0]] = 1;
    while (q.length) {
      const t = q.pop();
      orth(t, (u) => {
        if (seen[u] || !ground(u)) return;
        if (useElev && elev[u] !== elev[t] && !(Math.abs(elev[u] - elev[t]) === 1 && (ramp[u] || ramp[t]))) return;
        seen[u] = 1; q.push(u);
      });
    }
    return seen;
  };
  const joinedAll = (useElev) => { const seen = reachable(useElev); return bases.every((b) => seen[id(b.x, b.y)]); };

  // 5) Make sure the two bases are connected by land; carve a winding corridor if not (except on
  //    Islands, where bridges are the only way across).
  if (!SH.islands && np === 3 && !joinedAll(false)) {
    // Three players: a corridor from player 0's base to the middle, turned round with the rest.
    let x = bx, y = by;
    for (let n = 0; n < 200 && dist(x, y, ccx, ccy) > 1; n++) {
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const i = Math.round(x) + di, j = Math.round(y) + dj;
        if (i >= 0 && j >= 0 && i < W && j < H && terrain[id(i, j)] !== T_GROUND) { terrain[id(i, j)] = T_GROUND; res[id(i, j)] = R_NONE; }
      }
      const d = dist(x, y, ccx, ccy);
      x += (ccx - x) / d + clamp((rng() - 0.5) * 1.2, -0.6, 0.6);
      y += (ccy - y) / d;
    }
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (dist2(i, j, ccx, ccy) <= 6.5) { terrain[id(i, j)] = T_GROUND; res[id(i, j)] = R_NONE; }
    symmetrize();
  }
  if (!SH.islands && np === 2 && !reachable(false)[id(W - 1 - bx, H - 1 - by)]) {
    let x = bx, y = by;
    while (y >= half) {
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const i = Math.round(x) + di, j = Math.round(y) + dj;
        if (i >= 0 && j >= half && i < W && j < H && terrain[id(i, j)] !== T_GROUND) {
          terrain[id(i, j)] = T_GROUND; res[id(i, j)] = R_NONE;
        }
      }
      y -= 1;
      x += clamp((W / 2 - x) * 0.25 + (rng() - 0.5) * 1.5, -1, 1);
    }
    mirror();
    if (choke) chokeBand(); // the corridor never cuts a second way through the crags
  }

  // Crater maps: a sunken crater in the middle of the map, one level below a ring of rim, with the
  // richest fields on its floor. The outline wobbles only with even harmonics, so it stays
  // symmetric under the half-turn.
  const crR = Math.max(5, Math.round(Math.min(W, H) * 0.18));
  const crEdge = (i, j) => {
    const a = Math.atan2(j - ccy, i - ccx), h = np === 2 ? 2 : 3; // harmonics that repeat with the bases
    return crR * (1 + 0.08 * Math.cos(h * a + seed) + 0.05 * Math.sin(2 * h * a + seed * 0.7)) - Math.sqrt(dist2(i, j, ccx, ccy));
  };
  const floorLv = 0; // the lowest level, so nothing round it can wear the rim away
  if (SH.crater) {
    for (let t = 0; t < N; t++) {
      const i = t % W, j = (t / W) | 0, e = crEdge(i, j);
      // The crater floor is the only ground on the lowest level: everything else stands higher.
      if (e < 0) { elev[t] = Math.max(elev[t], floorLv + 1); minE[t] = floorLv + 1; continue; }
      terrain[t] = T_GROUND; res[t] = R_NONE; fert[t] = 0; ramp[t] = 0;
      elev[t] = e >= 2 ? floorLv : floorLv + 1;
      if (e < 2) minE[t] = floorLv + 1;
    }
    // Fields on the floor, each placed with its mirror image.
    const stamp = (x, y, rad, type, fill) => {
      for (let j = Math.floor(y - rad); j <= Math.ceil(y + rad); j++) for (let i = Math.floor(x - rad); i <= Math.ceil(x + rad); i++) {
        if (i < 0 || j < 0 || i >= W || j >= H || dist2(i, j, x, y) > rad * rad || crEdge(i, j) < 2.5) continue;
        if (rng() >= fill) continue;
        res[id(i, j)] = type;
        if (np === 2) res[mir(id(i, j))] = type;
      }
    };
    stamp(ccx - crR * 0.35, ccy + crR * 0.3, 1.9, R_ORE, 0.8);
    stamp(ccx + crR * 0.35, ccy + crR * 0.25, 1.7, R_CRYSTAL, 0.8);
    stamp(ccx - crR * 0.05, ccy + crR * 0.5, 1.4, R_BOULDER, 0.7);
    stamp(ccx + 0.5, ccy + 0.5, 1.0, R_OIL, 0.9);
    if (cfg.nuke) stamp(ccx + crR * 0.15, ccy + crR * (np === 2 ? 0.1 : 0.3), 0.6, R_URANIUM, 1);
    if (np === 3) symmetrize();
  }
  // Plateau maps: each base stands on a high plateau ringed by cliffs, with a terrace one level
  // down all round it. (Shaped on the bottom half and mirrored.)
  const P = L - 1;
  const plR = 9.5, plEdge = (i, j) => {
    const a = Math.atan2(j - by, i - bx);
    return plR * (1 + 0.1 * Math.cos(3 * a + seed) + 0.05 * Math.sin(5 * a + seed * 1.3)) - Math.sqrt(dist2(i, j, bx, by));
  };
  if (SH.plateau) {
    const low = new Int8Array(N).fill(-1), q = [];
    for (let j = half; j < H; j++) for (let i = 0; i < W; i++) {
      if (!canon(i, j)) continue;
      const t = id(i, j), e = plEdge(i, j);
      if (e >= 0) { if (terrain[t] === T_WATER) terrain[t] = T_GROUND; elev[t] = P; low[t] = P; }
      else if (e >= -2) { terrain[t] = T_GROUND; elev[t] = P - 1; low[t] = P - 1; q.push(t); }
      else elev[t] = Math.min(elev[t], P - 1); // the plateaus are the only ground on the top level
    }
    // Below the terrace the ground steps down at most a level a tile, so smoothing the cliffs
    // later can't wear the terraces away however low the land around them is.
    for (let h = 0; h < q.length; h++) {
      const t = q[h];
      orth(t, (u) => {
        if (!canon(u % W, (u / W) | 0) || low[u] >= low[t] - 1) return;
        low[u] = low[t] - 1;
        if (elev[u] < low[u]) elev[u] = low[u];
        if (low[u] > 0) q.push(u);
      });
    }
    for (let t = half * W; t < N; t++) if (low[t] >= 0) { minE[t] = low[t]; if (np === 2) minE[mir(t)] = low[t]; }
    symmetrize();
  }

  // 6) Shape the levels into clean terraces, then connect them with ramps.
  if (L > 1) {
    const levelComponents = () => {
      const comp = new Int32Array(N).fill(-1), sizes = [];
      for (let t = 0; t < N; t++) {
        if (!ground(t) || comp[t] >= 0) continue;
        const c = sizes.length, q = [t];
        comp[t] = c;
        let n = 0;
        while (q.length) {
          const a = q.pop();
          n++;
          orth(a, (b) => { if (comp[b] < 0 && ground(b) && elev[b] === elev[a]) { comp[b] = c; q.push(b); } });
        }
        sizes.push(n);
      }
      return { comp, sizes };
    };
    // Absorb tiny specks of one level into their surroundings (decide for all, then apply,
    // so the result stays symmetric).
    for (let pass = 0; pass < 2; pass++) {
      const { comp, sizes } = levelComponents();
      const hist = new Map();
      for (let t = 0; t < N; t++) {
        if (!ground(t) || sizes[comp[t]] >= 10) continue;
        const hc = hist.get(comp[t]) || {};
        orth(t, (u) => { if (ground(u) && elev[u] !== elev[t]) hc[elev[u]] = (hc[elev[u]] || 0) + 1; });
        hist.set(comp[t], hc);
      }
      const target = new Map();
      for (const [c, hc] of hist) {
        let best = -1, bn = 0;
        for (const k in hc) if (hc[k] > bn || (hc[k] === bn && +k < best)) { bn = hc[k]; best = +k; }
        if (best >= 0) target.set(c, best);
      }
      for (let t = 0; t < N; t++) if (ground(t) && target.has(comp[t])) elev[t] = Math.max(target.get(comp[t]), minE[t]);
    }
    // Neighbouring tiles differ by at most one level, so every cliff is climbable with a ramp.
    for (let changed = true; changed;) {
      changed = false;
      for (let t = 0; t < N; t++) {
        if (!ground(t)) continue;
        let m = elev[t];
        orth(t, (u) => { if (ground(u) && elev[u] + 1 < m) m = elev[u] + 1; });
        if (m < elev[t]) { elev[t] = m; changed = true; }
      }
    }
    // Ramps: first the fewest needed to connect every level-area (narrow passes), then a few
    // extras along long cliffs. Each ramp is placed together with its mirror image.
    const { comp } = levelComponents();
    const parent = [];
    for (let c = 0; c < N; c++) parent.push(c);
    const find = (c) => { while (parent[c] !== c) { parent[c] = parent[parent[c]]; c = parent[c]; } return c; };
    const cands = [];
    for (let t = 0; t < N; t++) {
      if (!ground(t)) continue;
      orth(t, (u) => {
        if (!ground(u) || elev[u] !== elev[t] + 1) return;
        const ct = np === 2 ? Math.min(t, mir(t)) : t, cu = ct === t ? u : mir(u);
        cands.push({ t, u, key: hash2(ct, cu - ct + 3 * W, seed) });
      });
    }
    cands.sort((a, b) => a.key - b.key || a.t - b.t);
    const addRamp = (t, u) => {
      for (const [a, b] of np === 2 ? [[t, u], [mir(t), mir(u)]] : [[t, u]]) {
        ramp[a] = 1;
        res[a] = R_NONE;
        parent[find(comp[a])] = find(comp[b]);
      }
      // Sometimes make the pass two tiles wide.
      if (hash2(t, u, seed + 99) < 0.4) {
        const p = Math.abs(u - t) === 1 ? W : 1;
        for (const d of [p, -p]) {
          const t2 = t + d, u2 = u + d;
          if (t2 < 0 || u2 < 0 || t2 >= N || u2 >= N || Math.abs((t2 % W) - (t % W)) > 1) continue;
          if (ground(t2) && ground(u2) && !ramp[t2] && elev[t2] === elev[t] && elev[u2] === elev[t] + 1) {
            ramp[t2] = 1; res[t2] = R_NONE;
            if (np === 2) { ramp[mir(t2)] = 1; res[mir(t2)] = R_NONE; }
            break;
          }
        }
      }
    };
    for (const c of cands) if (find(comp[c.t]) !== find(comp[c.u])) addRamp(c.t, c.u);
    const nearRamp = (t, r) => {
      const i = t % W, j = (t / W) | 0;
      for (let y = Math.max(0, j - r); y <= Math.min(H - 1, j + r); y++) {
        for (let x = Math.max(0, i - r); x <= Math.min(W - 1, i + r); x++) if (ramp[id(x, y)]) return true;
      }
      return false;
    };
    for (const c of cands) {
      if (hash2(c.t, c.u, seed + 7) < TPR.extra && !nearRamp(c.t, TPR.gap) && !nearRamp(c.u, TPR.gap)) addRamp(c.t, c.u);
    }
    // Crater and Plateau maps: replace the ramps that happened to land on the crater's or the
    // plateaus' cliffs with set ones: one into the crater on each side (facing each base) and two
    // down off each plateau (one toward the middle, one to the side). Each is two tiles wide.
    if (SH.crater || SH.plateau) {
      const keep = ramp.slice();
      const set = (t) => { ramp[t] = 1; res[t] = R_NONE; if (np === 2) { ramp[mir(t)] = 1; res[mir(t)] = R_NONE; } };
      // The lower tile of a cliff step on ray (x0,y0) → angle a, from `inside` to outside.
      const rayRamp = (x0, y0, a, inside) => {
        let prev = -1;
        for (let k = 0; k < 30; k++) {
          const i = Math.round(x0 + Math.cos(a) * k), j = Math.round(y0 + Math.sin(a) * k);
          if (i < 1 || j < 1 || i >= W - 1 || j >= H - 1) return false;
          const t = id(i, j);
          if (prev >= 0 && !inside(i, j)) {
            const lo = elev[t] < elev[prev] ? t : prev, hi = lo === t ? prev : t;
            if (!ground(lo) || !ground(hi) || Math.abs(elev[t] - elev[prev]) !== 1) return false;
            set(lo);
            // A second lane beside it.
            const side = Math.abs(hi - lo) === 1 ? W : 1;
            for (const d of [side, -side]) if (ground(lo + d) && ground(hi + d) && elev[lo + d] === elev[lo] && elev[hi + d] === elev[hi]) { set(lo + d); break; }
            return true;
          }
          prev = t;
        }
        return false;
      };
      // A crag in the way: try a little to either side.
      const tryRamp = (x0, y0, a, inside) => { for (const d of [0, 0.15, -0.15, 0.3, -0.3, 0.5, -0.5]) if (rayRamp(x0, y0, a + d, inside)) return true; return false; };
      if (SH.crater) {
        // Clear every ramp onto the floor (on the floor, or on the rim right beside it).
        for (let t = 0; t < N; t++) {
          if (!ramp[t]) continue;
          let onto = crEdge(t % W, (t / W) | 0) >= 2;
          orth(t, (u) => { if (crEdge(u % W, (u / W) | 0) >= 2 && elev[u] + 1 === elev[t]) onto = true; });
          if (onto) ramp[t] = 0;
        }
        // From the floor's centre out toward player 0's base (and its mirror toward player 1's).
        if (np === 2) tryRamp(ccx, ccy, Math.atan2(by - ccy, bx - ccx), (i, j) => crEdge(i, j) >= 2);
        else for (const b of bases) tryRamp(ccx, ccy, Math.atan2(b.y - ccy, b.x - ccx), (i, j) => crEdge(i, j) >= 2);
      } else if (np === 3) {
        // Three plateaus: the same, round each base.
        const plAll = (i, j) => { let e = -99; for (let k = 0; k < 3; k++) { const [x, y] = rot(i, j, -k); e = Math.max(e, plEdge(x, y)); } return e; };
        for (let t = 0; t < N; t++) {
          if (!ramp[t]) continue;
          const e = plAll(t % W, (t / W) | 0);
          if (e >= 0 || e < -1.5) continue;
          let edge = false;
          orth(t, (u) => { if (plAll(u % W, (u / W) | 0) >= 0 && elev[u] === elev[t] + 1) edge = true; });
          if (edge) ramp[t] = 0;
        }
        const side = hash2(seed, 5, 77) < 0.5 ? -1 : 1;
        bases.forEach((b, k) => {
          tryRamp(b.x, b.y, -Math.PI / 2 + side * 0.35 + k * SEC, (i, j) => plAll(i, j) >= 0);
          tryRamp(b.x, b.y, -Math.PI / 2 - side * 1.25 + k * SEC, (i, j) => plAll(i, j) >= 0);
        });
      } else {
        // Clear the ramps on the plateau's cliff (their lower tile is on the terrace below it).
        for (let t = 0; t < N; t++) {
          const i = t % W, j = (t / W) | 0;
          if (!ramp[t] || j < half || plEdge(i, j) >= 0 || plEdge(i, j) < -1.5) continue;
          let edge = false;
          orth(t, (u) => { if (plEdge(u % W, (u / W) | 0) >= 0 && elev[u] === elev[t] + 1) edge = true; });
          if (edge) { ramp[t] = 0; ramp[mir(t)] = 0; }
        }
        const side = hash2(seed, 5, 77) < 0.5 ? -1 : 1;
        tryRamp(bx, by, -Math.PI / 2 + side * 0.35, (i, j) => plEdge(i, j) >= 0);
        tryRamp(bx, by, -Math.PI / 2 - side * 1.25, (i, j) => plEdge(i, j) >= 0);
      }
      if (!joinedAll(true)) ramp.set(keep);
    }
    // Safety net: if the bases still can't reach each other, flatten the map (Islands are joined
    // by bridges, not land).
    if (!SH.islands && !joinedAll(true)) { elev.fill(baseLevel); ramp.fill(0); }
  } else {
    elev.fill(0);
  }

  // Richer deposits out towards the middle of the map, so pushing out pays.
  const ox = W - 1 - bx, oy = H - 1 - by, reach = Math.max(1, (np === 2 ? dist(bx, by, ox, oy) / 2 : dist(bx, by, ccx, ccy)) - RICH_FROM);
  for (let t = 0; t < N; t++) {
    if (!res[t]) continue;
    const i = t % W, j = (t / W) | 0;
    let d = Infinity;
    for (const b of bases) d = Math.min(d, dist(i, j, b.x, b.y));
    const rich = RICH_TYPES.includes(res[t]) ? 1 + FRONTIER_RICH * clamp((d - RICH_FROM) / reach, 0, 1) : 1;
    amt[t] = clamp(Math.round(RES[res[t]].amount * RPR.amount * rich), 1, 255);
  }
  const grow = new Float32Array(N).fill(1);
  for (let t = 0; t < N; t++) if (terrain[t] !== T_GROUND) fert[t] = 0;
  return { terrain, res, amt, grow, elev, ramp, fert, bases };
}

/* ------------------------------------------------------------------ new game */

/** Map width and height for these settings (size and shape); the height stays even so the map mirrors cleanly. */
function mapDims(st) {
  const sz = SIZE_PRESETS[st.size], sh = SHAPE_PRESETS[st.shape || 0];
  // Three players: a square map (the planet is the circle inside it), 40% more ground.
  if (st.players === 3) { const side = 2 * Math.round(Math.sqrt(sz.w * sz.h * sh.w * sh.h * 1.4) / 2); return { W: side, H: side }; }
  return { W: Math.round(sz.w * sh.w), H: 2 * Math.round((sz.h * sh.h) / 2) };
}

/** Is this a Nuclear race (the optional Versus setting with uranium and nuclear missiles)? */
function nukeOn() { return !!(S && S.settings && S.settings.nuke) && !S.mission; }

/**
 * Are military buildings, warbots and missiles available? Always in Versus; in Colony free play too
 * (a sandbox to try everything); not in Colony missions, which are about building.
 */
function warOn() { return !!S && (S.mode !== 'colony' || !S.mission); }

/** The resources a building of `type` gathers: its own, plus uranium for Ore Mines in a Nuclear race (uranium first). */
function gatherTypes(type) {
  const g = BDEFS[type].gather;
  if (!g) return [];
  return type === 'mine' && nukeOn() ? [R_URANIUM, g] : [g];
}

/** How many nodes a `type` gatherer at (i, j) could reach. */
function gatherReach(i, j, type) {
  let n = 0;
  for (const r of gatherTypes(type)) n += reachableRes(i, j, BDEFS[type].radius, r);
  return n;
}

/** Is tile t still scorched by a nuclear blast (nothing can be built or paved there)? */
function scorched(t) { return !!(S.scorch && S.scorch[t] > S.time); }

/** Is the resource on tile t a rich deposit (much more than usual, out towards the frontier)? */
function richRes(t) {
  const r = S.res[t];
  if (!r || !RICH_TYPES.includes(r)) return false;
  const pr = RESOURCE_PRESETS[(S.settings && S.settings.rich) ?? DEFAULT_RICH] || RESOURCE_PRESETS[DEFAULT_RICH];
  return S.amt[t] >= RES[r].amount * pr.amount * RICH_MARK;
}

/**
 * opts.mode: 'versus' (race a rival AI to capture its Command Base) or 'colony' (no rival, a bigger
 * map to settle at your own pace). opts.difficulty applies to versus only.
 */
function newGame(opts) {
  const mode = opts.mode === 'colony' ? 'colony' : 'versus';
  const settings = {
    size: clamp(opts.size ?? DEFAULT_SIZE[mode], 0, SIZE_PRESETS.length - 1),
    rough: clamp(opts.rough ?? DEFAULT_ROUGH, 0, TERRAIN_PRESETS.length - 1),
    rich: clamp(opts.rich ?? DEFAULT_RICH, 0, RESOURCE_PRESETS.length - 1),
  };
  settings.shape = clamp(opts.shape ?? 0, 0, SHAPE_PRESETS.length - 1);
  // Free-for-all: three players (you and two rivals), on the map shapes that have room for three.
  settings.players = mode === 'versus' && opts.players === 3 && SHAPE_PRESETS[settings.shape].ffa ? 3 : 2;
  settings.nuke = !!opts.nuke;
  settings.biome = BIOMES[opts.biome] ? opts.biome : 'desert';
  const { W, H } = mapDims(settings);
  const seed = opts.seed >>> 0;
  const diff = DIFFICULTY[opts.difficulty] ? opts.difficulty : 'normal';
  const m = generateMap(seed, W, H, settings);
  if (opts.layout) opts.layout(m, W, H); // missions hand-place features on their planet
  S = {
    v: 1, mode, seed, W, H, settings, difficulty: diff, time: 0, nextId: 1, winner: -1, milestone: 0,
    terrain: m.terrain, res: m.res, amt: m.amt, grow: m.grow, elev: m.elev, ramp: m.ramp, fert: m.fert,
    road: new Uint8Array(W * H), pave: new Uint8Array(W * H), wear: new Uint16Array(W * H), paveMark: new Uint8Array(W * H), oneRoad: true, roadVer: 0, lights: {}, over: {}, scorch: {},
    plan: new Uint8Array(W * H), planVer: 0, paveRes: {},
    owner: new Int8Array(W * H).fill(-1),
    resRes: new Uint8Array(W * H),
    bAt: new Int32Array(W * H),
    players: Array.from({ length: settings.players }, (_, p) => ({
      id: p,
      absent: mode === 'colony' && p === 1,
      ai: (p >= 1 && mode !== 'colony') || (p === 0 && !!opts.autoplay),
      mult: p >= 1 ? DIFFICULTY[diff].mult : 1,
      lander: 0,
      stats: { built: 0, bots: 0, captured: 0, lost: 0, outposts: 0, startBots: 0 },
      made: {}, madeBots: {},
      aiT: 0, nextAttack: 0,
    })),
    buildings: [], bots: [], fx: [], msgs: [], rallies: [], missiles: [], loot: [],
    dirtyTiles: [], territoryVer: 0, tick: 0, hist: newHistory(settings.players),
  };
  if (opts.autoplay) S.players[0].mult = DIFFICULTY[diff].mult;
  S.byId = new Map();
  for (let p = 0; p < S.players.length; p++) {
    if (S.players[p].absent) continue;
    const base = m.bases[p];
    const L = addBuilding(p, 'lander', base.x, base.y, true);
    S.players[p].lander = L.id;
    for (const g in START_STOCK) L.stock[g] = START_STOCK[g] + (p >= 1 ? DIFFICULTY[diff].bonus : 0);
    for (const type in START_BOTS) for (let k = 0; k < START_BOTS[type]; k++) enterBuilding(addBot(p, type, base.x, base.y), L);
    for (let k = 0; k < (mode === 'colony' ? 0 : START_WARBOTS); k++) {
      const w = addBot(p, 'warbot', base.x, base.y);
      enterBuilding(w, L);
    }
    S.players[p].stats.startBots = S.players[p].stats.bots;
  }
  computeZones();
  computeTerritory();
  for (const P of S.players) { const L = getE(P.lander); if (L) starterRoads(L); }
  if (opts.setup) opts.setup(S);
  S.decor = makeDecor();
  // A word on how this kind of planet plays.
  const L0 = getE(S.players[0].lander), tip = !S.mission && mode === 'versus' && SHAPE_PRESETS[settings.shape].tip;
  if (tip && L0) postMsg(0, tip, L0.x, L0.y, 'info');
  return S;
}

/** The biome of the current game. */
function biome() { return (S && S.settings && S.settings.biome) || 'desert'; }

/**
 * Decorative plants (scenery only): a plant variety 1..PLANT_KINDS on some open ground tiles, in
 * loose patches. Made from the seed with a hash, so the map itself is the same in every biome.
 */
function makeDecor() {
  const W = S.W, H = S.H, d = new Uint8Array(W * H), dens = BIOMES[biome()].plants, sd = S.seed % 100000;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const t = j * W + i;
    if (S.terrain[t] !== T_GROUND || S.res[t] || S.fert[t] || S.ramp[t] || S.road[t] || S.plan[t] || S.bAt[t]) continue;
    if (j > 0 && S.terrain[t - W] === T_GROUND && S.elev[t - W] > S.elev[t]) continue; // the foot of a cliff
    const patch = fbm(i / 5, j / 5, sd + 77, 2);
    if (hash2(i, j, sd + 501) > dens * (0.25 + 1.5 * patch)) continue;
    d[t] = 1 + Math.floor(hash2(i * 3 + 1, j * 5 + 2, sd + 733) * PLANT_KINDS);
  }
  return d;
}

/** A road, planned road or building clears the plants on its tile for good. */
function clearDecor(t) {
  if (S.decor && S.decor[t]) { S.decor[t] = 0; S.dirtyTiles.push(t); }
}

/** Every Command Base starts with a ring of road around it, the start of the colony's road network. */
function starterRoads(L) {
  const lt = tIdx(L.x, L.y);
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
    if ((!di && !dj) || !inMap(L.x + di, L.y + dj)) continue;
    const t = tIdx(L.x + di, L.y + dj);
    if (S.terrain[t] !== T_GROUND || S.elev[t] !== S.elev[lt] || S.res[t] || S.bAt[t]) continue;
    S.road[t] = 1; S.pave[t] = 1;
  }
  S.roadVer = (S.roadVer || 0) + 1;
}

/* ------------------------------------------------------------------ elevation */

/**
 * Can a bot step between orthogonally adjacent tiles a and b? Same level: yes. One level apart:
 * only if either tile is a ramp. Cliffs of more than one level are never climbable.
 */
function canStep(a, b) {
  if (S.terrain[a] !== T_GROUND || S.terrain[b] !== T_GROUND) {
    // Bridges and tunnels (road over water or through rock) join any neighbour, whatever its level.
    return (S.terrain[a] === T_GROUND || S.road[a] > 0) && (S.terrain[b] === T_GROUND || S.road[b] > 0);
  }
  const d = S.elev[a] - S.elev[b];
  if (d === 0) return true;
  return (d === 1 || d === -1) && (S.ramp[a] === 1 || S.ramp[b] === 1);
}

/**
 * Outposts stand astride roads: their tile joins the road network (a road can run straight through
 * one) and any bot can drive through it. Gates do too, but only for their owner's bots: pass `who`
 * (a player) to ask whether that player's bots may cross; leave it out to ask about the road network.
 */
function passTile(t, who) {
  const id = S.bAt[t];
  if (!id) return false;
  const b = getE(id);
  if (!b) return false;
  if (b.type === 'outpost') return true;
  return b.type === 'gate' && (who === undefined || who === b.owner);
}

/** Chokepoint maps: where the pass runs through the crags (columns p0..p1, rows top..bot), or null. */
function chokePass() {
  const sh = SHAPE_PRESETS[(S.settings && S.settings.shape) || 0];
  if (!sh || !sh.choke) return null;
  const half = Math.floor(S.H / 2);
  return { p0: Math.floor((S.W - 1) / 2) - 1, p1: Math.ceil((S.W - 1) / 2) + 1, top: half - CHOKE_BAND, bot: half + CHOKE_BAND - 1 };
}

/** Is the building on tile t an enemy Wall or Gate that player `who`'s warbots could break through? */
function breachable(t, who) {
  const b = S.bAt[t] ? getE(S.bAt[t]) : null;
  return !!b && b.owner !== who && !!BDEFS[b.type].barrier;
}

/** An Outpost went up or came down: the road network changes, and the roads beside it redraw. */
function outpostRoads(x, y) {
  S.roadVer = (S.roadVer || 0) + 1;
  for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (inMap(x + di, y + dj) && S.dirtyTiles) S.dirtyTiles.push(tIdx(x + di, y + dj));
}

/** A road tile, or an Outpost the road runs through. */
function roadLike(t) { return S.road[t] > 0 || (S.bAt[t] > 0 && passTile(t)); }

/** Can bots walk on tile t? Open ground, or a bridge or tunnel. */
function walkable(t) { return S.terrain[t] === T_GROUND || S.road[t] > 0; }

/** Is tile t water or rock, where a road would be a bridge or tunnel? */
function crossTile(t) { return S.terrain[t] !== T_GROUND; }

/** Could bots step between a and b once roads are on them? (Planning: water and rock count as bridges and tunnels.) */
function stepPlan(a, b) {
  return S.terrain[a] !== T_GROUND || S.terrain[b] !== T_GROUND ? true : canStep(a, b);
}

/** Label every walkable tile with the id of the area bots can reach from it (ignoring buildings). */
function computeZones() {
  const N = S.W * S.H, W = S.W;
  const z = new Int32Array(N).fill(-1);
  let next = 0;
  for (let t = 0; t < N; t++) {
    if (!walkable(t) || z[t] >= 0) continue;
    const q = [t];
    z[t] = next;
    while (q.length) {
      const a = q.pop(), i = a % W;
      const nb = [i > 0 ? a - 1 : -1, i < W - 1 ? a + 1 : -1, a - W, a + W];
      for (const b of nb) {
        if (b < 0 || b >= N || z[b] >= 0 || !canStep(a, b)) continue;
        z[b] = next;
        q.push(b);
      }
    }
    next++;
  }
  S.zone = z;
}

/** The area a player's bots can reach (the one their Command Base stands in). */
function homeZone(p) {
  const L = getE(S.players[p].lander);
  return L && L.owner === p ? S.zone[tIdx(L.x, L.y)] : -2;
}

/** Count resource nodes in reach of (cx, cy) that bots there can actually walk to. */
function reachableRes(cx, cy, radius, type) {
  return countResIn(cx, cy, radius, type, false, S.zone[tIdx(cx, cy)]);
}

/* ------------------------------------------------------------------ entities */

function addBuilding(owner, type, x, y, built) {
  const def = BDEFS[type];
  const b = {
    id: S.nextId++, ent: 'b', type, owner, x, y,
    built: !!built, progress: built ? 1 : 0,
    stock: {}, inc: {}, res: {},
    staff: 0, staffInc: 0, builder: 0,
    garrison: [], garInc: 0,
    timer: 0, cd: 0, shots: 0, aim: -Math.PI / 2,
    armor: built ? def.armor : 4, lastHit: -99, lastAlert: -99,
    // The player's Foundry builds only bots they order; an AI-run Foundry picks its own mode.
    mode: !S.players[owner].ai ? 'off' : S.mode === 'colony' ? 'worker' : 'alt', altNext: 'worker', status: '', born: S.time,
  };
  S.buildings.push(b);
  S.byId.set(b.id, b);
  S.bAt[tIdx(x, y)] = b.id;
  clearDecor(tIdx(x, y));
  if (type === 'outpost' || type === 'gate') outpostRoads(x, y); // roads run through it
  return b;
}

function addBot(owner, type, x, y) {
  const maxHp = BOTS[type].hp;
  const bot = {
    id: S.nextId++, ent: 'u', type, owner,
    x: x + 0.5, y: y + 0.5, path: null, pi: 0,
    task: null, carry: null, carryN: 0, hp: maxHp, maxHp,
    inside: 0, cd: 0, fight: 0, scanT: 0, idleT: 0, face: 0, busy: 0, bat: 100,
  };
  if (type === 'warbot') bot.ammo = WARBOT_AMMO;
  S.bots.push(bot);
  S.byId.set(bot.id, bot);
  S.players[owner].stats.bots++;
  return bot;
}

function enterBuilding(bot, b) {
  bot.inside = b.id;
  bot.x = b.x + 0.5; bot.y = b.y + 0.5;
  bot.path = null;
  if (bot.type === 'warbot' && BDEFS[b.type].mil && !b.garrison.includes(bot.id)) b.garrison.push(bot.id);
}

function exitBuilding(bot) {
  if (!bot.inside) return;
  const b = getE(bot.inside);
  if (b) {
    const k = b.garrison.indexOf(bot.id);
    if (k >= 0) b.garrison.splice(k, 1);
  }
  bot.inside = 0;
}

function playerBuildings(p) { return S.buildings.filter((b) => b.owner === p && !b.dead); }
function playerBots(p) { return S.bots.filter((u) => u.owner === p && !u.dead); }

/* ------------------------------------------------------------------ territory */

/**
 * Each tile belongs to the nearest military building (Command Base/Outpost) whose radius covers it.
 * A tile holding a player's building stays theirs as long as one of their military buildings
 * still covers it — so buildings are only lost when the military building protecting them falls.
 * Non-military buildings left outside their owner's territory are destroyed.
 */
function computeTerritory() {
  const { W, H } = S;
  const N = W * H;
  const d = S.players.map(() => new Float32Array(N).fill(Infinity));
  for (const b of S.buildings) {
    if (b.dead || !b.built || !BDEFS[b.type].mil) continue;
    const r = BDEFS[b.type].terr, r2 = r * r + 0.3;
    for (let j = Math.max(0, b.y - r); j <= Math.min(H - 1, b.y + r); j++) {
      for (let i = Math.max(0, b.x - r); i <= Math.min(W - 1, b.x + r); i++) {
        const dd = dist2(i, j, b.x, b.y);
        const t = j * W + i;
        if (dd <= r2 && dd < d[b.owner][t]) d[b.owner][t] = dd;
      }
    }
  }
  for (let t = 0; t < N; t++) {
    const bid = S.bAt[t];
    if (bid) {
      const b = getE(bid);
      if (b && d[b.owner][t] < Infinity) { S.owner[t] = b.owner; continue; }
    }
    // The nearest garrison's owner holds the tile (on an exact tie, whoever held it keeps it).
    let best = Infinity, who = -1, tie = false;
    for (let p = 0; p < d.length; p++) {
      const c = d[p][t];
      if (c < best) { best = c; who = p; tie = false; } else if (c === best && c < Infinity) tie = true;
    }
    if (who < 0) S.owner[t] = -1;
    else if (!tie) S.owner[t] = who;
  }
  S.territoryVer++;
  for (const b of S.buildings.slice()) {
    if (b.dead || BDEFS[b.type].mil) continue;
    if (S.owner[tIdx(b.x, b.y)] !== b.owner) {
      postMsg(b.owner, `${BDEFS[b.type].name} was lost — it is no longer inside your territory.`, b.x, b.y, 'bad');
      destroyBuilding(b, true);
    }
  }
}

/** Share of the walkable land (ground tiles) a player has claimed, 0..1. */
function landShare(p) {
  let land = 0, mine = 0;
  const home = homeZone(p);
  for (let t = 0; t < S.W * S.H; t++) {
    if (S.terrain[t] !== T_GROUND || S.zone[t] !== home) continue;
    land++;
    if (S.owner[t] === p) mine++;
  }
  return land ? mine / land : 0;
}

/* ------------------------------------------------------------------ placement */

function countResIn(cx, cy, radius, type, matureOnly, zone) {
  let n = 0;
  const r2 = radius * radius + 0.3;
  for (let j = Math.max(0, cy - radius); j <= Math.min(S.H - 1, cy + radius); j++) {
    for (let i = Math.max(0, cx - radius); i <= Math.min(S.W - 1, cx + radius); i++) {
      const t = j * S.W + i;
      if (zone !== undefined && S.zone[t] !== zone) continue;
      if (S.res[t] === type && dist2(i, j, cx, cy) <= r2 && (!matureOnly || S.grow[t] >= 1)) n++;
    }
  }
  return n;
}

/** Fertile tiles around (cx, cy) a Bio Farm there could plant (not built on, same walkable area). */
function fertileIn(cx, cy, radius) {
  let n = 0;
  const r2 = radius * radius + 0.3, zone = S.zone[tIdx(cx, cy)];
  for (let j = Math.max(0, cy - radius); j <= Math.min(S.H - 1, cy + radius); j++) {
    for (let i = Math.max(0, cx - radius); i <= Math.min(S.W - 1, cx + radius); i++) {
      const t = j * S.W + i;
      if (!S.fert[t] || S.bAt[t] || S.ramp[t] || S.zone[t] !== zone || (i === cx && j === cy)) continue;
      if (dist2(i, j, cx, cy) <= r2) n++;
    }
  }
  return n;
}

function isWalkable(i, j) {
  if (!inMap(i, j)) return false;
  const t = tIdx(i, j);
  return walkable(t) && !S.bAt[t];
}

/**
 * Would a building on tile t cut the walkable tiles around it off from each other (for example by
 * plugging a narrow pass or the foot of a slope)? Checks a small window first, then the whole map.
 */
const _wb = { seen: null, gen: 0, q: null };

function wouldBlock(t) {
  const W = S.W, N = S.W * S.H;
  const ti = t % W, tj = (t / W) | 0;
  const nb = (a, k) => (k === 0 ? (a % W > 0 ? a - 1 : -1) : k === 1 ? (a % W < W - 1 ? a + 1 : -1) : k === 2 ? a - W : a + W);
  const ends = [];
  for (let k = 0; k < 4; k++) {
    const u = nb(t, k);
    if (u >= 0 && u < N && !S.bAt[u] && canStep(t, u)) ends.push(u);
  }
  if (ends.length <= 1) return false;
  if (!_wb.seen || _wb.seen.length !== N) { _wb.seen = new Uint32Array(N); _wb.q = new Int32Array(N); _wb.gen = 0; }
  const seen = _wb.seen, q = _wb.q;
  const reachesAll = (limit) => {
    const gen = ++_wb.gen;
    let head = 0, tail = 0, left = ends.length - 1;
    seen[ends[0]] = gen; q[tail++] = ends[0];
    while (head < tail) {
      const a = q[head++];
      for (let k = 0; k < 4; k++) {
        const b = nb(a, k);
        if (b < 0 || b >= N || b === t || seen[b] === gen || S.bAt[b] || !canStep(a, b)) continue;
        if (limit && (Math.abs((b % W) - ti) > limit || Math.abs(((b / W) | 0) - tj) > limit)) continue;
        seen[b] = gen;
        if (ends.indexOf(b) >= 0 && --left === 0) return true;
        q[tail++] = b;
      }
    }
    return false;
  };
  return !reachesAll(5) && !reachesAll(0);
}

/** Can `owner` start a `type` construction site at tile (i, j)? Returns {ok, reason}. */
function canPlace(owner, type, i, j, skipBlockCheck) {
  const def = BDEFS[type];
  if (!def || !def.cost) return { ok: false, reason: 'Cannot build that.' };
  if (!inMap(i, j)) return { ok: false, reason: 'Outside the map.' };
  const t = tIdx(i, j);
  if (S.owner[t] !== owner) return { ok: false, reason: 'You can only build inside your territory.' };
  if (S.terrain[t] !== T_GROUND) return { ok: false, reason: 'The ground here is not buildable.' };
  if (scorched(t)) return { ok: false, reason: 'This ground is still scorched from a nuclear blast.' };
  if (def.nuke && !nukeOn()) return { ok: false, reason: 'Only in a Nuclear race.' };
  if (def.pump) {
    if (S.res[t] !== R_OIL) return { ok: false, reason: 'Build an Oil Pump right on top of an oil seep.' };
  } else if (S.res[t]) return { ok: false, reason: 'Clear the resources here first.' };
  if (S.bAt[t]) return { ok: false, reason: 'There is already a building here.' };
  if (S.ramp[t]) return { ok: false, reason: 'Too steep: this is a slope.' };
  if (S.zone[t] !== homeZone(owner)) {
    return { ok: false, reason: def.ramp ? 'Your bots can\'t reach this side of the cliff yet: plan the Ramp on the other side, the top or the foot, where they can.'
      : 'Your bots cannot reach this spot. Find a slope, or build a Ramp from the side they can reach.' };
  }
  if (def.ramp) {
    let cliff = false;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (!inMap(i + di, j + dj)) continue;
      const u = tIdx(i + di, j + dj);
      if (S.terrain[u] === T_GROUND && Math.abs(S.elev[u] - S.elev[t]) === 1 && !canStep(t, u)) cliff = true;
    }
    if (!cliff) return { ok: false, reason: 'Place a Ramp right at the top or foot of a one-level cliff.' };
    if (!skipBlockCheck && wouldBlock(t)) return { ok: false, reason: 'That would block the only way through here.' };
    return { ok: true, reason: '' };
  }
  // An Outpost or a Gate can stand on a road: the road runs through it.
  if ((S.road[t] || S.plan[t]) && type !== 'outpost' && type !== 'gate') {
    return { ok: false, reason: def.barrier ? 'There is a road here: a wall line across a road gets a Gate there.' : S.road[t] ? 'There is a road here.' : 'A road is planned here.' };
  }
  if (def.barrier && (S.road[t] || S.plan[t]) && crossTile(t)) return { ok: false, reason: 'Not on a bridge or tunnel.' };
  // Buildings may stand side by side, as long as every building keeps at least one open side
  // that bots can walk in from (and the Command Base, which is bigger, keeps a clear ring around it).
  let open = 0, roadSide = 0;
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
    if (!di && !dj) continue;
    if (!inMap(i + di, j + dj)) continue;
    const u = tIdx(i + di, j + dj);
    const nb = S.bAt[u] ? getE(S.bAt[u]) : null;
    if (nb && nb.type === 'lander') return { ok: false, reason: 'Too close to the Command Base.' };
    if (di !== 0 && dj !== 0) continue;
    if (!nb && canStep(t, u)) open++;
    if (!nb && canStep(t, u) && (S.road[u] || canRoad(owner, i + di, j + dj))) roadSide++;
    if (nb && !keepsAccess(u, t)) return { ok: false, reason: `That would wall in the ${BDEFS[nb.type].name} next to it.` };
    if (nb && nb.owner === owner && !keepsRoadSide(u, t)) return { ok: false, reason: `That would cut the ${BDEFS[nb.type].name} next to it off from roads.` };
  }
  if (open < 1) return { ok: false, reason: 'Bots could not reach this spot.' };
  // Walls and Gates are meant to close a way through, and they need no road: workers build them
  // with Cement paid up front.
  if (def.barrier) {
    if (def.prepaid && !skipBlockCheck && !canPay(owner, def.cost)) return { ok: false, reason: `Not enough ${missingGoods(owner, def.cost)}.` };
    return { ok: true, reason: '' };
  }
  if (!roadSide) return { ok: false, reason: 'Haulers need a road to every building: leave a side open where a road can go (open ground inside your border).' };
  if (def.mil) {
    for (const b of S.buildings) {
      if (!b.dead && b.owner === owner && BDEFS[b.type].mil && dist2(b.x, b.y, i, j) < 16) {
        return { ok: false, reason: 'Too close to another military building.' };
      }
    }
  }
  if (def.gather && gatherReach(i, j, type) === 0) {
    return { ok: false, reason: `No ${RES[def.gather].name.toLowerCase()}s within reach.` };
  }
  if (def.farm && fertileIn(i, j, def.radius) === 0) return { ok: false, reason: 'No fertile soil within reach.' };
  // The most expensive check goes last.
  if (!skipBlockCheck && wouldBlock(t)) return { ok: false, reason: 'That would block the only way through here.' };
  return { ok: true, reason: '' };
}

/** Would building u still have an open side bots can walk in from if tile t were built on? */
function keepsAccess(u, t) {
  const ui = u % S.W, uj = (u / S.W) | 0;
  for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (!inMap(ui + di, uj + dj)) continue;
    const v = tIdx(ui + di, uj + dj);
    if (v !== t && !S.bAt[v] && canStep(u, v)) return true;
  }
  return false;
}

/**
 * Would building u keep a side where a road is or could go if tile t were built on? (Only asked
 * when it has one now.)
 */
function keepsRoadSide(u, t) {
  const ui = u % S.W, uj = (u / S.W) | 0, b = getE(S.bAt[u]);
  if (!b) return true;
  let had = false;
  for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (!inMap(ui + di, uj + dj)) continue;
    const v = tIdx(ui + di, uj + dj);
    if (S.bAt[v] || !canStep(u, v) || !(S.road[v] || canRoad(b.owner, ui + di, uj + dj))) continue;
    if (v !== t) return true;
    had = true;
  }
  return !had;
}

function siteCount(owner) {
  let n = 0;
  for (const b of S.buildings) if (!b.dead && b.owner === owner && !b.built && !BDEFS[b.type].prepaid) n++;
  return n;
}

/** What `owner` has on hand to spend of each good (storage and finished goods not already promised). */
function spendable(owner) {
  const have = {};
  for (const b of S.buildings) {
    if (b.dead || b.owner !== owner) continue;
    for (const g in b.stock) { const n = supplyOf(b, g); if (n > 0) have[g] = (have[g] || 0) + n; }
  }
  return have;
}

/** Could `owner` pay `cost` right now, from storage? */
function canPay(owner, cost) {
  const have = spendable(owner);
  for (const g in cost) if ((have[g] || 0) < cost[g]) return false;
  return true;
}

/** The names of the goods in `cost` that `owner` doesn't have enough of, e.g. 'Cement or Alloy'. */
function missingGoods(owner, cost) {
  const have = spendable(owner);
  return Object.keys(cost).filter((g) => (have[g] || 0) < cost[g]).map((g) => GOOD[g].name).join(' or ') || 'materials';
}

function placeSite(owner, type, i, j) {
  const chk = canPlace(owner, type, i, j);
  if (!chk.ok) return chk;
  const def = BDEFS[type];
  if (!def.prepaid && siteCount(owner) >= MAX_SITES) return { ok: false, reason: `Maximum of ${MAX_SITES} construction sites reached.` };
  // An Outpost or Gate on a road takes the road's place (its Cement comes back); the road runs through it.
  const t = tIdx(i, j);
  const onRoad = !!(S.road[t] || S.plan[t]);
  if (S.plan[t]) cancelPlan(t);
  if (S.road[t]) removeRoad(owner, i, j);
  const b = addBuilding(owner, type, i, j, false);
  if (type === 'gate' && onRoad) b.road = true;
  // Walls and Gates are paid for now, straight from storage: the site starts with its materials in.
  if (def.prepaid) for (const g in def.cost) { takeGood(owner, g, def.cost[g]); b.stock[g] = def.cost[g]; }
  markDirty(i, j);
  return { ok: true, building: b };
}

/**
 * Roads can go on open ground inside your territory, and through resources (clearing them, at
 * ROAD_CLEAR times the cost), oil seeps included so a pump is never walled in; not through a node
 * a bot is working. Over water or rock a road is a bridge or tunnel; a bridge can also be pushed
 * out over the water beyond your border, a tile at a time from your land or the end of a bridge
 * (so a channel the enemy's border covers can still be crossed).
 */
function canRoad(owner, i, j) {
  if (!inMap(i, j)) return false;
  const t = tIdx(i, j);
  if (S.bAt[t] || S.resRes[t] || scorched(t)) return false;
  if (S.owner[t] === owner) return true;
  return S.terrain[t] === T_WATER && bridgeHead(owner, i, j);
}

/** Does water tile (i, j) touch `owner`'s land, a bridge, or a bridge tile `owner` has planned (or `extra(t)`)? */
function bridgeHead(owner, i, j, extra) {
  for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (!inMap(i + di, j + dj)) continue;
    const u = tIdx(i + di, j + dj);
    if (S.owner[u] === owner || (S.terrain[u] === T_WATER && (S.road[u] || S.plan[u] === owner + 1)) || (extra && extra(u))) return true;
  }
  return false;
}

/**
 * What a new road on tile t costs in road tiles' worth of Cement: 1, ROAD_CLEAR through resources,
 * a bridge's or tunnel's Cement over water or rock (which also take Alloy), 0 if it's already road or planned.
 */
function roadTileMul(t) {
  if (S.road[t] || S.plan[t]) return 0;
  const c = CROSS[S.terrain[t]];
  if (c) return c.cost.cement / PAVE[1].cost.cement;
  return S.res[t] ? ROAD_CLEAR : 1;
}

/** Everything a new road tile on t costs: road Cement, or a bridge's or tunnel's Cement and Alloy. */
function roadTileCost(t) {
  const c = CROSS[S.terrain[t]];
  if (c) return c.cost;
  const mul = S.res[t] ? ROAD_CLEAR : 1, out = {};
  for (const g in PAVE[1].cost) out[g] = PAVE[1].cost[g] * mul;
  return out;
}

/* Planned roads: S.plan[t] is owner + 1 on tiles waiting for workers to pave them. */

function setPlan(t, owner) {
  const v = owner < 0 ? 0 : owner + 1;
  if (S.plan[t] === v) return;
  S.plan[t] = v;
  if (v) clearDecor(t);
  S.planVer = (S.planVer || 0) + 1;
}

const _plans = { ver: -1, of: null, lists: [[], []] };
/** The tiles `owner` has planned roads on (cached until a plan changes). */
function planList(owner) {
  if (_plans.of !== S || _plans.ver !== S.planVer) {
    _plans.lists = S.players.map(() => []);
    for (let t = 0; t < S.W * S.H; t++) if (S.plan[t]) _plans.lists[S.plan[t] - 1].push(t);
    _plans.of = S; _plans.ver = S.planVer;
  }
  return _plans.lists[owner];
}

function setRoad(i, j, on) {
  const t = tIdx(i, j);
  if (!!S.road[t] === !!on) return;
  S.road[t] = on ? 1 : 0;
  S.pave[t] = on ? 1 : 0;
  if (S.wear) S.wear[t] = 0;
  if (on) clearDecor(t);
  if (!on && S.paveMark) S.paveMark[t] = 0;
  S.roadVer = (S.roadVer || 0) + 1;
  markDirty(i, j);
  for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (inMap(i + di, j + dj)) markDirty(i + di, j + dj);
}

/** Set an existing road tile's surface: 1 road, 2 asphalt (fresh). */
function setPave(i, j, tier) {
  const t = tIdx(i, j);
  if (!S.road[t] || S.pave[t] === tier) return;
  S.pave[t] = tier;
  if (S.wear) S.wear[t] = 0;
  S.topPaveCache = 0;
  markDirty(i, j);
}

/** The best path surface anywhere on the map (route planning needs it for an exact estimate). */
function topPave() {
  if (S.topPaveCache) return S.topPaveCache;
  let top = 1;
  for (let t = 0; t < S.W * S.H && top < 2; t++) if (S.road[t] && S.pave[t] > top) top = S.pave[t];
  S.topPaveCache = top;
  return top;
}

/** Make an existing path tile two-way (1) or one-way (2 east, 3 south, 4 west, 5 north). */
function setRoadDir(i, j, v) {
  const t = tIdx(i, j);
  if (!S.road[t] || S.road[t] === v) return;
  S.road[t] = v;
  markDirty(i, j);
  for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (inMap(i + di, j + dj)) markDirty(i + di, j + dj);
}

function markDirty(i, j) { S.dirtyTiles.push(tIdx(i, j)); }

/** How a Roadworks chooses roads: 'marked' (the roads marked in Paths) or 'all' joined to it. */
function paveMode(b) { return b.pmode || (S.players[b.owner].ai ? 'all' : 'marked'); }

/** Does this tile want a Paver: a road not yet asphalt, or asphalt worn enough to resurface? */
function needsPaving(t) { return S.road[t] && (S.pave[t] < 2 || S.wear[t] >= REPAVE_AT); }

/** Speed multiplier for a bot on asphalt with this much wear. */
function asphaltSpeed(w) {
  return w <= WEAR_SLOW ? PAVE[2].speed : PAVE[2].speed - (PAVE[2].speed - WEAR_WORN_SPEED) * (w - WEAR_SLOW) / (WEAR_MAX - WEAR_SLOW);
}

/** Wear asphalt as a bot drives onto it. Worn right through, it drops back to plain road. */
function wearRoad(t, u) {
  if (S.pave[t] !== 2 || !S.wear) return;
  const before = S.wear[t], w = Math.min(WEAR_MAX, before + (BOTS[u.type].truck ? WEAR_TRUCK : WEAR_BOT));
  S.wear[t] = w;
  const i = t % S.W, j = (t / S.W) | 0;
  if (w >= WEAR_MAX) {
    setPave(i, j, 1);
    const P = S.players[S.owner[t]];
    if (P && !P.ai && S.owner[t] === 0 && !S.paveMark[t] && S.time - (P.wornMsgAt || -1e9) > 240) {
      P.wornMsgAt = S.time;
      postMsg(0, 'Busy asphalt has worn back to plain road. Mark roads in Paths (Pave) and a Roadworks will keep them surfaced.', i, j, 'warn');
    }
  } else if ((before / 250 | 0) !== (w / 250 | 0)) markDirty(i, j); // shows its cracks
}

/** How many of this player's road tiles are marked for asphalt. */
function roadsMarked(owner) {
  let n = 0;
  for (let t = 0; t < S.W * S.H; t++) if (S.paveMark[t] && S.road[t] && S.owner[t] === owner) n++;
  return n;
}

/** Mark (or unmark) a road for asphalt: a Roadworks paves and maintains marked roads. */
function setPaveMark(owner, i, j, on) {
  const t = tIdx(i, j);
  if (!S.road[t] || S.owner[t] !== owner || !!S.paveMark[t] === !!on) return false;
  S.paveMark[t] = on ? 1 : 0;
  markDirty(i, j);
  return true;
}

/* ------------------------------------------------------------------ road network */

/*
 * Road tiles joined along roads (respecting cliffs and ramps) form networks. Haulers can only
 * carry goods between buildings that touch the same network. A junction is a road tile with
 * roads on three or four sides. Labels are rebuilt lazily whenever S.roadVer changes.
 */
const _rn = { ver: -1, of: null, comp: null, junc: null, bnet: new Map() };

function roadNet() {
  const N = S.W * S.H;
  if (_rn.of === S && _rn.ver === (S.roadVer || 0) && _rn.comp && _rn.comp.length === N) return _rn;
  const comp = new Int32Array(N).fill(-1), junc = new Uint8Array(N);
  const W = S.W;
  let next = 0;
  const q = [];
  for (let t = 0; t < N; t++) {
    if (!roadLike(t)) continue;
    let k = 0;
    const i = t % W;
    for (const u of [i > 0 ? t - 1 : -1, i < W - 1 ? t + 1 : -1, t - W, t + W]) if (u >= 0 && u < N && roadLike(u) && canStep(t, u)) k++;
    if (k >= 3 && S.road[t]) junc[t] = 1;
    if (comp[t] >= 0) continue;
    comp[t] = next; q.length = 0; q.push(t);
    while (q.length) {
      const a = q.pop(), ai = a % W;
      for (const b of [ai > 0 ? a - 1 : -1, ai < W - 1 ? a + 1 : -1, a - W, a + W]) {
        if (b < 0 || b >= N || comp[b] >= 0 || !roadLike(b) || !canStep(a, b)) continue;
        comp[b] = next; q.push(b);
      }
    }
    next++;
  }
  Object.assign(_rn, { of: S, ver: S.roadVer || 0, comp, junc });
  _rn.bnet.clear();
  return _rn;
}

/** The road networks touching building b (the road tiles right next to it). */
function buildingNets(b) {
  const net = roadNet();
  let nets = net.bnet.get(b.id);
  if (nets) return nets;
  nets = [];
  const t = tIdx(b.x, b.y);
  if (net.comp[t] >= 0) nets.push(net.comp[t]); // an Outpost is part of the road through it
  for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (!inMap(b.x + di, b.y + dj)) continue;
    const u = tIdx(b.x + di, b.y + dj);
    if (roadLike(u) && canStep(t, u) && nets.indexOf(net.comp[u]) < 0) nets.push(net.comp[u]);
  }
  if (b.id) net.bnet.set(b.id, nets);
  return nets;
}

/** Do buildings a and b share a road network (can haulers carry goods between them)? */
function roadLinked(a, b) {
  if (a === b) return true;
  const na = buildingNets(a), nb = buildingNets(b);
  for (const c of na) if (nb.indexOf(c) >= 0) return true;
  return false;
}

function isJunction(t) { return !!roadNet().junc[t]; }

/**
 * The road networks joined to the owner's Command Base(s). Goods only flow along roads, so a building
 * (or a Depot) is linked to storage when it touches one of these.
 */
function homeNets(owner) {
  const nets = [];
  for (const L of S.buildings) {
    if (L.dead || L.owner !== owner || L.type !== 'lander') continue;
    for (const c of buildingNets(L)) if (nets.indexOf(c) < 0) nets.push(c);
  }
  return nets;
}

/** Is building b joined by road to its owner's Command Base network? */
function onHomeNet(b) {
  const h = homeNets(b.owner);
  for (const c of buildingNets(b)) if (h.indexOf(c) >= 0) return true;
  return false;
}

/** Tiles next to the owner's Command Base(s), and the road networks joined to them. */
function roadGoals(owner, except) {
  const stores = S.buildings.filter((s) => !s.dead && s.owner === owner && s.built && s.type === 'lander' && s !== except);
  const nets = new Set(), next = new Uint8Array(S.W * S.H);
  for (const s of stores) {
    for (const c of buildingNets(s)) nets.add(c);
    const st = tIdx(s.x, s.y);
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (inMap(s.x + di, s.y + dj)) { const u = tIdx(s.x + di, s.y + dj); if (canStep(st, u)) next[u] = 1; }
    }
  }
  return { stores, nets, next };
}

/*
 * Cheapest road through the owner's land, by Dijkstra: existing road is free, open ground costs 1
 * and resources (which a road clears) ROAD_AVOID, so routes go round fields unless the detour is
 * long. Starting from `seeds`, stopping at the first tile where done(t) holds (or exploring
 * everything if done is null). Returns { cost, prev, end }.
 */
const ROAD_AVOID = 10;
function roadWeight(t) {
  if (S.road[t] || S.plan[t] || (S.bAt[t] && passTile(t))) return 0;
  const c = CROSS[S.terrain[t]];
  return c ? c.weight : S.res[t] ? ROAD_AVOID : 1;
}

function roadSearch(owner, seeds, done) {
  const W = S.W, N = S.W * S.H;
  const cost = new Float32Array(N).fill(Infinity), prev = new Int32Array(N).fill(-2);
  const heap = new MinHeap();
  for (const t of seeds) { cost[t] = roadWeight(t); prev[t] = -1; heap.push(t, cost[t]); }
  const open = (t) => S.road[t] || canRoad(owner, t % W, (t / W) | 0) || (S.bAt[t] > 0 && passTile(t));
  while (heap.size) {
    const c = heap.pri[0], t = heap.pop();
    if (c > cost[t]) continue;
    if (done && done(t)) return { cost, prev, end: t };
    const i = t % W;
    for (const u of [i > 0 ? t - 1 : -1, i < W - 1 ? t + 1 : -1, t - W, t + W]) {
      if (u < 0 || u >= N || !open(u) || !(roadLike(t) && roadLike(u) ? canStep(t, u) : stepPlan(t, u))) continue;
      const nc = c + roadWeight(u);
      if (nc < cost[u]) { cost[u] = nc; prev[u] = t; heap.push(u, nc); }
    }
  }
  return { cost, prev, end: -1 };
}

/** The open sides of tile (x, y) where a road is or could go. */
function roadSides(owner, x, y) {
  const out = [], bt = tIdx(x, y);
  for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (!inMap(x + di, y + dj)) continue;
    const u = tIdx(x + di, y + dj);
    if ((roadLike(u) || canRoad(owner, x + di, y + dj)) && (roadLike(u) ? canStep(bt, u) : stepPlan(bt, u))) out.push(u);
  }
  return out;
}

/**
 * The cheapest run of new road tiles that would link building b to one of its owner's storage
 * buildings by road: a list of tiles to pave (empty if it is already linked), or null if there is
 * no way through the owner's land. `.cost` is its price in road tiles (resources cost more).
 */
function roadRouteTo(owner, b) {
  const g = roadGoals(owner, b);
  if (!g.stores.length) return null;
  if (onHomeNet(b)) { const r = []; r.cost = 0; r.pending = 0; return r; }
  const net = roadNet();
  const res = roadSearch(owner, roadSides(owner, b.x, b.y), (t) => (roadLike(t) && g.nets.has(net.comp[t])) || g.next[t]);
  if (res.end < 0) return null;
  const out = [];
  out.cost = 0; out.pending = 0; out.goods = {}; out.cross = 0;
  for (let k = res.end; k >= 0; k = res.prev[k]) {
    if (S.plan[k]) out.pending++; // already planned: waiting for workers to pave it
    else if (!roadLike(k)) {
      out.push(k); out.cost += roadTileMul(k);
      const c = roadTileCost(k);
      for (const g in c) out.goods[g] = (out.goods[g] || 0) + c[g];
      if (crossTile(k)) out.cross++;
    }
  }
  return out;
}

/**
 * For every tile, how many road tiles (in Cement terms) it would take to link it to storage:
 * a map for choosing building spots a road can reach cheaply.
 */
function roadReach(owner) {
  const g = roadGoals(owner, null), net = roadNet(), seeds = [];
  for (let t = 0; t < S.W * S.H; t++) if ((roadLike(t) && g.nets.has(net.comp[t])) || g.next[t]) seeds.push(t);
  return roadSearch(owner, seeds, null).cost;
}

/* ------------------------------------------------------------------ removal */

/** Release any reservations a bot's current task holds, then clear the task. */
function cancelTask(bot) {
  const t = bot.task;
  if (!t) return;
  switch (t.type) {
    case 'haul': {
      const src = getE(t.src), dst = getE(t.dst);
      if (t.phase === 'toSrc' && src) bump(src.res, t.good, -(t.n || 1));
      if (dst) bump(dst.inc, t.good, -(t.n || 1));
      break;
    }
    case 'build': {
      const s = getE(t.site);
      if (s && s.builder === bot.id) s.builder = 0;
      break;
    }
    case 'staff': {
      const b = getE(t.bld);
      if (b) {
        if (b.staff === bot.id) b.staff = 0;
        if (b.staffInc === bot.id) b.staffInc = 0;
      }
      if (t.node >= 0) S.resRes[t.node] = 0;
      break;
    }
    case 'pave':
      if (S.paveRes && S.paveRes[t.tile] === bot.id) delete S.paveRes[t.tile];
      break;
    case 'fix': {
      const b = getE(t.bld);
      if (b && b.fixer === bot.id) b.fixer = 0;
      break;
    }
    case 'garrison': {
      const b = getE(t.bld);
      if (b) b.garInc = Math.max(0, b.garInc - 1);
      break;
    }
    case 'loot': {
      // Called off: release its claim on the pile, and put down any crate it was carrying.
      const l = t.phase === 'pick' && S.loot && S.loot.find((x) => x.id === t.pile);
      if (l) l.claimed = Math.max(0, (l.claimed || 0) - 1);
      if (bot.loot && typeof addLoot === 'function') { addLoot(Math.floor(bot.x), Math.floor(bot.y), { [bot.loot]: 1 }); bot.loot = null; }
      break;
    }
  }
  bot.task = null;
  bot.path = null;
}

function taskRefs(task, id) {
  if (!task) return false;
  return task.src === id || task.dst === id || task.site === id || task.bld === id || task.target === id || task.home === id;
}

function killBot(bot, quiet) {
  if (bot.dead) return;
  // A warbot carrying loot drops its crate where it falls (anyone's warbots can pick it up).
  if (bot.loot && typeof addLoot === 'function' && inMap(Math.floor(bot.x), Math.floor(bot.y))) { addLoot(Math.floor(bot.x), Math.floor(bot.y), { [bot.loot]: 1 }); bot.loot = null; }
  cancelTask(bot);
  exitBuilding(bot);
  for (const b of S.buildings) {
    if (b.staff === bot.id) b.staff = 0;
    if (b.staffInc === bot.id) b.staffInc = 0;
    if (b.builder === bot.id) b.builder = 0;
  }
  bot.dead = true;
  S.byId.delete(bot.id);
  S.players[bot.owner].stats.lost++;
  addFx('boom', bot.x, bot.y, { r: bot.type === 'warbot' ? 0.7 : 0.45 });
  if (!quiet) sfx('boom');
}

/** Detach every bot that depends on building b (tasks, staff, garrison, idle inside). */
function releaseBotsFrom(b, killInside) {
  for (const u of S.bots) {
    if (u.dead) continue;
    if (taskRefs(u.task, b.id)) cancelTask(u);
    if (u.inside === b.id) {
      if (killInside && (u.type === 'warbot' || b.staff === u.id)) { killBot(u); continue; }
      exitBuilding(u);
    }
  }
  b.staff = 0; b.staffInc = 0; b.builder = 0; b.garInc = 0;
  b.garrison.length = 0;
  b.inc = {}; b.res = {};
}

/** Remove a building. `burn` = destroyed by force (bots inside die); otherwise bots walk out. */
function destroyBuilding(b, burn) {
  if (b.dead) return;
  releaseBotsFrom(b, !!burn);
  b.dead = true;
  S.byId.delete(b.id);
  S.bAt[tIdx(b.x, b.y)] = 0;
  if (b.type === 'outpost' || b.type === 'gate') outpostRoads(b.x, b.y);
  // A Gate that stood on a road leaves the road behind when it goes.
  if (b.type === 'gate' && b.road) setRoad(b.x, b.y, true);
  markDirty(b.x, b.y);
  addFx('boom', b.x + 0.5, b.y + 0.5, { r: 1.3 });
  if (burn) addFx('smoke', b.x + 0.5, b.y + 0.5, { r: 1 });
  sfx('boom');
  if (BDEFS[b.type].mil && b.built) computeTerritory();
}

/* ------------------------------------------------------------------ messages & effects */

function postMsg(player, text, x, y, kind) {
  if (player !== 0) return;
  S.msgs.push({ text, x, y, kind: kind || 'info', t: S.time });
}

function addFx(type, x, y, data) {
  const f = { type, x, y, t: 0, life: type === 'smoke' ? 2.5 : type === 'laser' ? 0.25 : type === 'float' ? 1.2 : 0.6 };
  if (data) Object.assign(f, data);
  S.fx.push(f);
}

/* ------------------------------------------------------------------ save / load */

const SAVE_KEY = 'botfall.save.v1'; // the game's first name: kept so saves carry over
const TYPED_FIELDS = {
  terrain: Uint8Array, res: Uint8Array, amt: Uint8Array, grow: Float32Array, road: Uint8Array, owner: Int8Array,
  resRes: Uint8Array, elev: Uint8Array, ramp: Uint8Array, fert: Uint8Array, pave: Uint8Array, plan: Uint8Array,
  wear: Uint16Array, paveMark: Uint8Array, decor: Uint8Array,
};

function serializeGame() {
  const o = {};
  for (const k in S) {
    if (k === 'byId' || k === 'fx' || k === 'msgs' || k === 'dirtyTiles' || k === 'bAt' || k === 'zone') continue;
    o[k] = TYPED_FIELDS[k] ? Array.from(S[k], (v) => (k === 'grow' ? Math.round(v * 100) / 100 : v)) : S[k];
  }
  o.buildings = S.buildings.filter((b) => !b.dead);
  o.bots = S.bots.filter((u) => !u.dead);
  return JSON.stringify(o);
}

function deserializeGame(json) {
  const o = JSON.parse(json);
  if (!o || o.v !== 1) throw new Error('Unsupported save');
  // Saves from before elevation existed load as flat maps.
  if (!o.elev) { o.elev = new Array(o.W * o.H).fill(0); o.ramp = new Array(o.W * o.H).fill(0); }
  // Saves from before fertile soil and oil existed get them from the map's generator, on tiles
  // that are still free.
  if (!o.fert) {
    let m = null;
    try { m = generateMap(o.seed, o.W, o.H, o.settings); } catch (e) { m = null; }
    o.fert = new Array(o.W * o.H).fill(0);
    if (m && m.fert.length === o.fert.length) {
      const taken = new Set(o.buildings.map((b) => b.y * o.W + b.x));
      for (let t = 0; t < o.fert.length; t++) {
        if (o.terrain[t] !== T_GROUND || o.ramp[t] || taken.has(t)) continue;
        if (m.fert[t] && !o.res[t]) o.fert[t] = 1;
        if (m.res[t] === R_OIL && !o.res[t] && !(o.road && o.road[t])) { o.res[t] = R_OIL; o.amt[t] = m.amt[t]; }
      }
    }
  }
  // Saves from before road surfaces: every path is a road. Saves with three surfaces (gravel,
  // concrete, asphalt): gravel and concrete both become roads.
  if (!o.pave) o.pave = o.road.map((v) => (v ? 1 : 0));
  else if (!o.oneRoad) o.pave = o.pave.map((v) => (v >= 3 ? 2 : v ? 1 : 0));
  o.oneRoad = true;
  // Saves from before road wear: fresh asphalt, nothing marked, and Roadworks keep paving every road.
  if (!o.wear) o.wear = new Array(o.W * o.H).fill(0);
  if (!o.decor) o.decor = new Array(o.W * o.H).fill(0); // saves from before biomes: no plants
  if (!o.paveMark) { o.paveMark = new Array(o.W * o.H).fill(0); for (const b of o.buildings) if (b.type === 'roadworks' && !b.pmode) b.pmode = 'all'; }
  o.lights = o.lights || {};
  o.over = o.over || {};
  o.scorch = o.scorch || {};
  o.roadVer = (o.roadVer || 0) + 1;
  // Saves from before roads were paved by workers have no planned roads.
  if (!o.plan) o.plan = new Array(o.W * o.H).fill(0);
  o.planVer = (o.planVer || 0) + 1;
  o.paveRes = {};
  for (const k in TYPED_FIELDS) o[k] = TYPED_FIELDS[k].from(o[k]);
  o.hist = o.hist || newHistory();
  for (const P of o.players) { P.made = P.made || {}; P.madeBots = P.madeBots || {}; P.stats.outposts = P.stats.outposts || 0; P.stats.startBots = P.stats.startBots ?? 18; }
  o.fx = []; o.msgs = []; o.dirtyTiles = [];
  o.rallies = o.rallies || [];
  o.loot = o.loot || [];
  o.missiles = o.missiles || [];
  o.bAt = new Int32Array(o.W * o.H);
  o.byId = new Map();
  S = o;
  for (const b of S.buildings) {
    S.byId.set(b.id, b);
    S.bAt[tIdx(b.x, b.y)] = b.id;
    if (b.type === 'foundry' && !S.players[b.owner].ai) b.mode = 'off'; // older saves: build on order only
  }
  for (const u of S.bots) {
    S.byId.set(u.id, u);
    if (u.type === 'warbot' && u.ammo === undefined) u.ammo = WARBOT_AMMO;
    u.carryN = u.carry ? u.carryN || 1 : 0;
  }
  computeZones();
  return S;
}

function saveGame() {
  if (!S || S.winner >= 0 || S.players[0].ai) return false;
  try { localStorage.setItem(SAVE_KEY, serializeGame()); return true; } catch (e) { return false; }
}

function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
}

function loadGame() {
  try {
    const json = localStorage.getItem(SAVE_KEY);
    if (!json) return null;
    return deserializeGame(json);
  } catch (e) { return null; }
}

function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* storage unavailable */ }
}

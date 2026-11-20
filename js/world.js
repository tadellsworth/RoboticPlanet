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
  if ((SHAPE_PRESETS[cfg.shape || 0] || {}).hollow) return hollowMap(seed, W, H, cfg); // (its own layout: see hollowMap)
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
  // Crossroads for three or four players (quad): a square map in four quarters, one base in each
  // corner (three players leave the quarter beside you to the north free). The bottom-left quarter is generated
  // and turned a quarter at a time onto the other three, tile for tile, so every quarter is the same.
  // Long Haul 2v2 (h4): a tall map, two bases side by side at each end. The bottom-left quarter is generated and
  // mirrored left to right and end to end (so its top-right twin is the half turn), tile for tile: every colony the same.
  const quad = quadMap(cfg), h4 = haul4Map(cfg);
  const np = quad || h4 ? 4 : cfg.players === 3 ? 3 : 2;
  const hw = W / 2; // (quad: W === H, even; h4: W even)
  const lr = (t) => { const i = t % W; return t - i + (W - 1 - i); }; // h4: mirrored left to right
  const tb = (t) => { const i = t % W, j = (t / W) | 0; return (H - 1 - j) * W + i; }; // ...and end to end
  const r4 = (t) => { const i = t % W, j = (t / W) | 0; return i * W + (W - 1 - j); }; // a quarter turn: BL → TL → TR → BR
  const r4back = (t) => { const i = t % W, j = (t / W) | 0; return (W - 1 - i) * W + j; };
  const quarter = (i, j) => (i < hw ? (j >= hw ? 0 : 1) : (j < hw ? 2 : 3)); // BL, TL, TR, BR
  // The tile with its twins (the same spot on every other side of the map).
  // (Twin Valleys: four corner quarters, but split west from east by a spine, so only the half turn holds.)
  // (Long Haul 2v2: in player order, SW, SE, NE, NW.)
  const orbit = (t) => h4 ? [t, lr(t), mir(t), tb(t)] : np === 2 || SH.twin ? [t, mir(t)] : quad ? [t, r4(t), r4(r4(t)), r4(r4(r4(t)))] : [t];
  const ccx = (W - 1) / 2, ccy = (H - 1) / 2, discR = Math.min(W, H) / 2 - 0.5, SEC = (2 * Math.PI) / 3;
  const sector = (x, y) => { let a = datan2(y - ccy, x - ccx) - Math.PI / 6; a = ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI); return Math.floor(a / SEC) % 3; };
  const rot = (x, y, k) => { const a = k * SEC, c = dcos(a), sn = dsin(a), dx = x - ccx, dy = y - ccy; return [ccx + dx * c - dy * sn, ccy + dx * sn + dy * c]; };
  const inDisc = (i, j) => dist2(i, j, ccx, ccy) <= discR * discR;
  const canon = np === 2 ? (i, j) => j >= half : quad ? (i, j) => i < hw && j >= hw : h4 ? (i, j) => i < hw && j >= half : (i, j) => sector(i, j) === 0 && inDisc(i, j);
  // A random point in the generated part of the map (three players, or a quarter).
  const canonPoint = (rng, margin) => {
    if (quad) return [margin + rng() * (hw - 2 * margin), hw + margin + rng() * (hw - 2 * margin)];
    if (h4) return [margin + rng() * (hw - margin - 0.5), half + margin + rng() * (H - half - 2 * margin)]; // (up to the middle line: its twin is beside it)
    for (;;) {
      const a = Math.PI / 6 + 0.06 + rng() * (SEC - 0.12), r = Math.sqrt(rng()) * (discR - margin);
      const x = ccx + dcos(a) * r, y = ccy + dsin(a) * r;
      if (x >= 1 && y >= 1 && x < W - 2 && y < H - 2) return [x, y];
    }
  };
  // Crater and Plateau maps need cliffs: at least three levels, the rest kept flat on Flat terrain.
  // Tidal flats and River delta are flat (low islands and a delta plain), whatever the Terrain setting.
  const L = SH.flat ? 1 : Math.max(TPR.levels, SH.minLevels || 1), flatRest = TPR.levels === 1 && L > 1;
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
  // Islands: the sea covers everything but a home island round each base, two or three medium
  // islands between and a few islets, so the ways across are ships or long bridges. Land is kept at least
  // ISLE_GAP tiles from any other island's shore. Applied to the bottom half after the fields are
  // laid (anything left in the sea is cleared), then mirrored with the rest.
  let isleCut = null;
  if (SH.islands) {
    const bx0 = Math.floor(W / 2), by0 = H - 7, halfH = H - half;
    let isles;
    const edgeD = (o, x, y) => (Math.sqrt(sq((x - o.x) / o.rx) + sq((y - o.y) / o.ry)) - 1) * Math.min(o.rx, o.ry);
    const irng = makeRng((seed ^ 0x1514) >>> 0);
    if (quad) {
      // Four Isles: a home island in each corner quarter, a rich island in the middle, and (where there's room for
      // the sea round it) an islet on the line between each pair of neighbours. Only the bottom-left quarter is
      // cut (it holds the islet below the middle and its twin to the left); the turn lays it on the others.
      const qb = Math.max(10, Math.round(hw * 0.42)), hx = qb, hy = H - 1 - qb;
      const immense = cfg.size === IMMENSE_SIZE;
      const hr = clamp(hw * 0.29, 8.5, immense ? 14 : 11), cR = clamp(hw * 0.2, 4.5, immense ? 9.5 : 7.5);
      const mR = clamp(hw * 0.1, 2.6, 4), gap = ISLE_GAP + 1.5;
      isles = [{ x: hx, y: hy, rx: hr, ry: hr }, { x: ccx, y: ccy, rx: cR, ry: cR }];
      for (let d = cR + mR + gap; d < hw - mR - 1; d += 0.5) {
        if (dist(hx, hy, ccx, ccy + d) - hr - mR < gap) continue;
        isles.push({ x: ccx, y: ccy + d, rx: mR, ry: mR }, { x: ccx - d, y: ccy, rx: mR, ry: mR });
        break;
      }
    } else if (np === 2) {
      // A home island each, and in the middle two or three medium islands (by the seed) with a couple of
      // little islets out in the open sea, everything a wide sea apart: ships, or long, dear bridges.
      const homeTop = H - 21.5 - Math.max(0, (halfH - 41) * 0.5);
      const gapH = homeTop - half;
      const sym2 = (o) => [o, { x: W - 1 - o.x, y: H - 1 - o.y, rx: o.rx, ry: o.ry }];
      isles = [{ x: bx0, y: (by0 + 6 + homeTop) / 2, rx: W * 0.4, ry: (by0 + 6 - homeTop) / 2 }];
      if (gapH < 12) {
        // A small planet: one medium island in the middle.
        isles.push({ x: ccx, y: ccy, rx: W * 0.24, ry: Math.max(2.5, gapH - ISLE_GAP - 1) });
      } else if (irng() < 0.5) {
        // Two: a pair facing each other across the middle, each a few tiles off a home island.
        const ry = clamp(gapH * 0.32, 3.5, 9);
        isles.push(...sym2({ x: W * (0.36 + irng() * 0.04), y: homeTop - ISLE_GAP - 2.5 - ry, rx: clamp(W * 0.2, 5, 13), ry }));
      } else {
        // Three: one in the middle, and a pair out to the sides nearer the home islands.
        isles.push({ x: ccx, y: ccy, rx: clamp(W * 0.17, 4.5, 11), ry: clamp(Math.min(W * 0.13, gapH * 0.32), 3.5, 8) });
        const ry = clamp(gapH * 0.27, 3, 7);
        isles.push(...sym2({ x: W * (0.2 + irng() * 0.04), y: homeTop - ISLE_GAP - 2.5 - ry, rx: clamp(W * 0.15, 4, 9), ry }));
      }
      for (let k = 0, tries = 0; k < 2 && tries < 400; tries++) {
        const r = 2.1 + irng() * 0.7, x = 3 + irng() * (W - 6), y = half + 1 + irng() * Math.max(1, gapH - 2);
        if (isles.some((o) => edgeD(o, x, y) < r + ISLE_GAP + 3.5)) continue;
        isles.push(...sym2({ x, y, rx: r, ry: r }));
        k++;
      }
    } else {
      // Three home islands, three medium islands between them (one between each pair) and an islet in the middle.
      // The medium islands sit out toward the rim, sized to leave about the same sea to each home island
      // as on a two-way map, with open sea round an islet in the middle.
      const dB = dist(bx0, by0, ccx, ccy), hr = clamp(dB * 0.42, 9, 15.5), r1 = dist(bx0, by0 - 4, ccx, ccy);
      const homeA = datan2(by0 - 4 - ccy, bx0 - ccx), mA = homeA + Math.PI / 3, cR = clamp(dB * 0.1, 2.6, 4);
      const toHome = (m) => Math.sqrt(r1 * r1 + m * m - r1 * m), size = (m) => clamp(toHome(m) - hr - ISLE_GAP - 2.5, 3.5, 11);
      const mD = Math.min(dB * 0.95, ccy - 2 - size(dB * 0.95)), mR = size(mD);   // (a copy of it points at the top edge)
      const base = [{ x: bx0, y: by0 - 4, rx: hr, ry: hr }, { x: ccx + dcos(mA) * mD, y: ccy + dsin(mA) * mD, rx: mR, ry: mR }];
      isles = [{ x: ccx, y: ccy, rx: cR, ry: cR }];
      for (const o of base) for (let k = 0; k < 3; k++) { const [x, y] = rot(o.x, o.y, k); isles.push({ x, y, rx: o.rx, ry: o.ry }); }
    }
    // Sky islands: a home island, a small mesa in the middle and a dozen or so smaller mesas
    // between (laid out the same for every side), so there's a lot to bridge.
    if (SH.sky) {
      const srng = makeRng((seed ^ 0x51c7) >>> 0);
      const sym = (o) => np === 2 ? [o, { x: W - 1 - o.x, y: H - 1 - o.y, rx: o.rx, ry: o.ry }]
        : [0, 1, 2].map((k) => { const [x, y] = rot(o.x, o.y, k); return { x, y, rx: o.rx, ry: o.ry }; });
      const home = np === 2 ? { x: bx0, y: by0 - 3, rx: Math.min(W * 0.27, 11), ry: 8 } : { x: bx0, y: by0 - 4, rx: 8.5, ry: 8.5 };
      isles = [...sym(home), { x: ccx, y: ccy, rx: 4, ry: 4 }];
      // A chain of stepping-stone mesas from the home island to the middle one, at most a few
      // tiles of canyon apart (and roughly in line, so straight Viaducts can span each gap): the
      // sides can always reach each other.
      {
        const fx = home.x, fy = home.y - home.ry * 0.9, tx = ccx, ty = ccy + 4;
        const d = dist(fx, fy, tx, ty), n = Math.max(0, Math.ceil(d / 7.5) - 1);
        for (let k = 1; k <= n; k++) {
          const f = k / (n + 1), r = 3 + srng() * 0.8;
          isles.push(...sym({ x: fx + (tx - fx) * f + (srng() - 0.5) * 1.5, y: fy + (ty - fy) * f, rx: r + 0.6, ry: r }));
        }
      }
      const cell = np === 2 ? 14 : 12;
      for (let gy = cell / 2; gy < H; gy += cell) for (let gx = cell / 2; gx < W; gx += cell) {
        const x = gx + (srng() - 0.5) * 5, y = gy + (srng() - 0.5) * 5, r = 4.2 + srng() * 2, sq = 0.8 + srng() * 0.4;
        const ci = Math.round(x), cj = Math.round(y);
        if (ci < 2 || cj < 2 || ci > W - 3 || cj > H - 3 || !canon(ci, cj)) continue;
        if (isles.some((o) => dist(x, y, o.x, o.y) < Math.max(o.rx, o.ry) + r + 1.5)) continue;
        isles.push(...sym({ x, y, rx: r, ry: r * sq }));
      }
    }
    // Sky islands keep their canyons narrow (short Viaducts); Islands keep a wider sea.
    const gapMin = (SH.sky ? SKY_GAP : ISLE_GAP) + 1.5;
    const out = (o, i, j) => (Math.sqrt(sq((i - o.x) / o.rx) + sq((j - o.y) / o.ry)) - 1) * Math.min(o.rx, o.ry);
    isleCut = () => {
      for (let j = half; j < H; j++) for (let i = 0; i < W; i++) {
        if (!canon(i, j)) continue;
        const t = id(i, j), wob = (fbm(i / 4, j / 4, sO, 2) - 0.5) * 3;
        let k = -1, best = Infinity;
        isles.forEach((o, n) => { const d = out(o, i, j) - wob; if (d < best) { best = d; k = n; } });
        const land = best <= 0 && isles.every((o, n) => n === k || out(o, i, j) >= gapMin); // + the most a shore wobbles out
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
  // Crossroads: in a corner quarter (with four, in the corner of the bottom-left quarter, as far in from both edges).
  // (Long Haul 2v2: at the south end, about 21 tiles from the ally's base beside it, close enough to share roads.)
  const qc = quad ? Math.max(10, Math.round(hw * 0.42)) : 0;
  const bx = quad ? qc : h4 ? clamp(Math.round(hw - 11), 9, hw - 9) : SH.cross ? Math.max(8, Math.round(W * 0.25)) : Math.floor(W / 2), by = quad ? H - 1 - qc : H - 7;
  const bases = [{ x: bx, y: by }];
  if (np === 2) bases.push({ x: W - 1 - bx, y: H - 1 - by });
  else if (h4) for (const t of orbit(id(bx, by)).slice(1)) bases.push({ x: t % W, y: (t / W) | 0 });
  else if (quad) for (let k = 1, t = id(bx, by); k < 4; k++) { t = r4(t); bases.push({ x: t % W, y: (t / W) | 0 }); }
  else for (let k = 1; k < 3; k++) { const [x, y] = rot(bx, by, k); bases.push({ x: Math.round(x), y: Math.round(y) }); }
  // Crossroads: a mesa in each corner of the planet, its top CR_TOP levels above the lowland between them, ringed by a
  // terrace a level down (about two tiles wide). The lowland between makes a cross, one arm along each middle line from
  // the edge of the planet to the plaza in the middle. Each mesa has three slopes down, three tiles wide: one off each
  // face toward the corner across that arm (with four, the slopes either side of an arm meet head on) and one off its
  // rounded inner corner toward the plaza. Laid out on player 0's part of the map: with three or four, one mesa (the bottom-left quarter, turned onto
  // the others); with two, the bottom half's two mesas, player 0's on the left and the free one on the right (the
  // planet is narrower, so the free one is smaller and the arm between them lies right of the middle), turned half
  // round onto the top half. A mesa: its inner corner (xc, yc), `ex` +1 if it lies west of its face at xc (-1: east);
  // every mesa here lies south of its face at yc. `rc` rounds the inner corner.
  let CM = null;
  if (SH.cross) {
    const ms = [], cs = seed * 53 + 29;
    let armX = hw - 0.5, floor; // (the middle of the arm between the bottom two mesas, and how wide its floor is)
    if (quad) {
      const R = clamp(Math.round((ccx - bx) * 0.55), 9, 15);
      ms.push({ xc: bx + R, ex: 1, yc: by - R, rc: Math.round(R * 0.75) });
      floor = W - 2 * (bx + R + 3);
    } else {
      const F = clamp(Math.round(W * 0.17), 6, 12), xE = bx + clamp(Math.round((ccx - bx) * 0.75), 8, 11), xW = xE + 5 + F;
      const yN = by - clamp(by - Math.ceil((H + F + 6) / 2), 8, 20), rc = Math.round(Math.min(xE - bx, by - yN) * 0.75);
      ms.push({ xc: xE, ex: 1, yc: yN, rc }, { xc: xW, ex: -1, yc: yN, rc: Math.min(rc, Math.floor((W - 1 - xW) * 0.45)) });
      armX = xE + 3 + (F - 1) / 2; floor = F;
    }
    for (const m of ms) {
      // The face slopes: across the middle of each face's straight part (the north one with four players turned from
      // the east one, so the mesa is the same either side of its diagonal), and the corner slope from the middle of the
      // rounding straight toward the plaza.
      m.row = Math.round((m.yc + m.rc + H - 1) / 2);
      m.col = quad ? W - 1 - m.row : m.ex > 0 ? Math.round((m.xc - m.rc) / 2) : clamp(Math.round((m.xc + m.rc + W - 1) / 2), m.xc + m.rc + 1, W - 3);
      m.ox = m.xc - m.ex * m.rc; m.oy = m.yc + m.rc;
      const d = dist(m.ox, m.oy, ccx, ccy);
      m.dx = (ccx - m.ox) / d; m.dy = (ccy - m.oy) / d; m.far = d;
    }
    // How far inside a mesa's top tile (i, j) is (negative: out past its edge), its outline wobbling a little.
    const inside = (m, i, j) => {
      const u = m.ex * (m.xc - i), v = j - m.yc, rc = m.rc;
      return u < rc && v < rc ? rc - Math.sqrt(sq(rc - u) + sq(rc - v)) : Math.min(u, v);
    };
    // (The outline wobbles less where the arms are narrow, so they stay open.)
    const amp = clamp((floor - 4) / 6, 0.4, 1);
    const e = (i, j) => {
      let b = -Infinity;
      for (const m of ms) b = Math.max(b, inside(m, i, j));
      return b + amp * ((fbm(i / 6, j / 6, cs, 2) - 0.5) * 3.4 + (fbm(i / 2.5, j / 2.5, cs + 7, 1) - 0.5) * 1.2);
    };
    CM = { ms, e, armX };
  }
  const CR_TOP = 2; // (the terrace is a level lower, the lowland two)
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
  // Richer fields just beyond the starting border reward expanding with Outposts. (In a corner
  // quarter, they lie out toward the middle of the map, turned 45° and a little closer on small maps.)
  // (Long Haul 2v2: squeezed into the colony's half of the width, and stretched up the map.)
  const beyond = quad ? (dx, dy) => { const f = clamp((hw - 4) / 31, 0.7, 1), c = Math.SQRT1_2; return [bx + (dx * c - dy * c) * f, by + (dx * c + dy * c) * f]; }
    : h4 ? (dx, dy) => [bx + dx * 0.7, by + dy * 1.25] : (dx, dy) => [bx + dx, by + dy];
  if (CM) {
    // Crossroads: down in the lowland in front of the mesa, to draw the colony down off it: Ore out past its east face
    // and Crystal past its north face (each between that face's slope and the corner one), and Oil beside the foot of
    // the corner slope.
    const m = CM.ms[0], ox = m.xc + 5 + jit() * 0.5, oy = Math.round((m.yc + m.rc + m.row) / 2) + jit();
    field(ox, oy, 1.6, R_ORE, 0.8 * stampDens, true);
    const [cx, cy] = quad ? [W - 1 - oy, W - 1 - ox] : [Math.round((m.col + m.xc - m.rc) / 2) + jit(), m.yc - 5 + jit() * 0.5];
    field(cx, cy, 1.5, R_CRYSTAL, 0.8 * stampDens, true);
    const f = m.rc + 4.5;
    field(m.ox + m.dx * f - m.dy * 3.2, m.oy + m.dy * f + m.dx * 3.2, 1.1, R_OIL, 0.9, true);
  } else {
    field(...beyond(8 + jit(), -11 + jit()), 1.6, R_ORE, 0.8 * stampDens, true);
    field(...beyond(-9 + jit(), -10 + jit()), 1.5, R_CRYSTAL, 0.8 * stampDens, true);
    field(...beyond(1 + jit(), -13), 1.1, R_OIL, 0.9, true);
  }
  // Contested fields near the middle (mirrored, so there is one on each side) and an oil field
  // right in the centre that both sides want.
  if (quad && CM) {
    // (Crossroads: by the plaza, either side of the way down to it off the mesa's corner.)
    field(ccx - 8, ccy + 2.5, 1.6, R_ORE, 0.85, true);
    field(ccx - 2.5, ccy + 8, 1.4, R_CRYSTAL, 0.85, true);
  } else if (quad) {
    // (By the plaza; Pinwheel and Four Isles lay their own fields over the middle.)
    field(ccx - 7, ccy + 3.5, 1.6, R_ORE, 0.85, true);
    field(ccx - 3.5, ccy + 7, 1.4, R_CRYSTAL, 0.85, true);
  } else if (h4) {
    // Long Haul 2v2: the richest fields are strung along the long middle (each with its three twins, one for every
    // colony at the same spot), and round the plaza at the very centre (laid in shapeExtras), where both teams meet.
    const span = by - ccy, out = (f, x, rad, type, fill) => field(clamp(x + rng() * 2 - 1, 2, hw - 1.5), ccy + span * f + rng() * 2 - 1, rad, type, fill, true);
    field(ccx - 6, ccy + 4.5, 1.6, R_ORE, 0.85, true);
    field(ccx - 2.5, ccy + 7.5, 1.4, R_CRYSTAL, 0.85, true);
    field(ccx - 9.5, ccy + 1.5, 1.1, R_OIL, 0.9, true);
    out(0.2, hw * 0.25, 1.5, R_CRYSTAL, 0.85);
    out(0.32, hw * 0.62, 1.7, R_ORE, 0.85);
    out(0.45, hw * 0.3, 1.6, R_BOULDER, 0.8);
    out(0.5, hw * 0.8, 1.1, R_OIL, 0.9);
    out(0.6, hw * 0.45, 1.6, R_ORE, 0.85);
  } else if (np === 2) {
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
  // (Long Haul 2v2: a little sparser, its quarters being narrow; the middle's own fields make up for it.)
  const areaK = ((W * H) / (40 * 56)) * (h4 ? 0.75 : 1), rK = Math.sqrt(Math.sqrt(dens)); // (the fourth root: Math.pow may differ by a bit between browsers)
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
      if (fields.some((o) => dist2(x, y, o.x, o.y) < sq(o.r + f.r + gap))) continue;
      field(x, y, f.r, f.type, f.fill, false);
      break;
    }
  }

  // Nuclear race: a few single uranium deposits, mostly out towards the middle of the map.
  if (cfg.nuke && !SH.grandCanyon) {
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
  // Four quarters: each tile of the other three takes the value of its twin in the bottom-left quarter.
  const turn4 = () => {
    for (let t = 0; t < N; t++) {
      const i = t % W, j = (t / W) | 0, k = quarter(i, j);
      if (!k) continue;
      let s = t;
      for (let n = 0; n < k; n++) s = r4back(s);
      terrain[t] = terrain[s]; res[t] = res[s]; elev[t] = elev[s]; fert[t] = fert[s]; minE[t] = minE[s];
    }
  };
  const mirror = () => {
    for (let t = 0; t < N; t++) {
      if (((t / W) | 0) >= half) continue;
      const m2 = mir(t);
      terrain[t] = terrain[m2]; res[t] = res[m2]; elev[t] = elev[m2]; fert[t] = fert[m2];
    }
  };
  // Long Haul 2v2: each tile of the other three quarters takes the value of its mirror image in the bottom-left one.
  const mirror4 = () => {
    for (let t = 0; t < N; t++) {
      const i = t % W, j = (t / W) | 0;
      if (i < hw && j >= half) continue;
      const s = id(i < hw ? i : W - 1 - i, j >= half ? j : H - 1 - j);
      terrain[t] = terrain[s]; res[t] = res[s]; elev[t] = elev[s]; fert[t] = fert[s]; minE[t] = minE[s];
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
  const symmetrize = np === 2 ? mirror : quad ? turn4 : h4 ? mirror4 : turn;
  symmetrize();

  // Chokepoint maps: a ragged belt of crags across the middle of the planet, a few tiles thick (more
  // here, less there), with scattered outcrops in front of it, and one to three narrow channels winding
  // through it, different every game. The channels come out into a gallery along the middle line, so
  // whichever mouth you go in by, you come out by one of the rival's. Built on player 0's (bottom) half
  // and copied onto the other, turned half round: both sides get the same crags. Its own random
  // numbers (from the seed), so carving it again after a corridor is cut gives the same belt.
  const choke = np === 2 && !!(SHAPE_PRESETS[cfg.shape || 0] && SHAPE_PRESETS[cfg.shape || 0].choke);
  const chokeInfo = [];
  const chokeBand = () => {
    const cr = makeRng(seed ^ 0x6c3a9e15), set = (t, kind, lv) => {
      for (const u of [t, mir(t)]) {
        terrain[u] = kind; res[u] = R_NONE; fert[u] = 0;
        if (kind === T_GROUND && lv !== undefined) elev[u] = lv;
      }
    };
    chokeInfo.length = 0;
    const a1 = cr() * 6.28, a2 = cr() * 6.28, f1 = 0.18 + cr() * 0.12, f2 = 0.45 + cr() * 0.2;
    const thick = (i) => clamp(Math.round(3 + 1.3 * (0.65 * dsin(i * f1 + a1) + 0.35 * dsin(i * f2 + a2))), 2, 5);
    // The level the passes run at: the commonest ground just in front of the belt.
    const count = {};
    for (let i = 0; i < W; i++) for (let j = half + thick(i); j < Math.min(H, half + thick(i) + 4); j++) { const t = id(i, j); if (terrain[t] === T_GROUND) count[elev[t]] = (count[elev[t]] || 0) + 1; }
    const lv = +(Object.keys(count).sort((a, b) => count[b] - count[a])[0] ?? elev[id(Math.floor(W / 2), Math.min(H - 1, half + 6))]);
    // The belt, and rough outcrops in front of it (thinning out with distance).
    for (let i = 0; i < W; i++) {
      const th = thick(i);
      for (let j = half; j < half + th && j < H; j++) set(id(i, j), T_ROCK);
      [0.42, 0.24, 0.1].forEach((pr, d) => { const j = half + th + d; if (j < H && cr() < pr) set(id(i, j), T_ROCK); });
    }
    // The channels: their mouths spread across the belt, each winding up to the middle line.
    const n = 1 + (cr() < 0.65 ? 1 : 0) + (W >= 46 && cr() < 0.3 ? 1 : 0);
    const mouths = [];
    for (let tries = 0; mouths.length < n && tries < 200; tries++) {
      const x = 3 + Math.floor(cr() * (W - 6));
      if (mouths.every((m) => Math.abs(m - x) >= Math.max(5, W / (n + 1.5)))) mouths.push(x);
    }
    const ca = Math.floor((W - 1) / 2), cb = Math.ceil((W - 1) / 2), carved = new Set(), channels = [];
    const cut = (t, mine) => { set(t, T_GROUND, lv); carved.add(t); mine.add(t); };
    for (const x0 of mouths) {
      let x = x0;
      const tiles = new Set();
      // Clear the way up to the mouth through the outcrops.
      for (let j = half + thick(x0); j < Math.min(H, half + thick(x0) + 3); j++) for (let di = -1; di <= 1; di++) {
        const i = x0 + di;
        if (i >= 0 && i < W && Math.abs(di) + (j - half - thick(x0)) <= 2) set(id(i, j), T_GROUND, lv);
      }
      for (let j = half + thick(x0) - 1; j >= half; j--) {
        cut(id(x, j), tiles);
        // Sometimes two tiles wide.
        if (cr() < 0.3) { const w = x + (cr() < 0.5 ? -1 : 1); if (w > 0 && w < W - 1) cut(id(w, j), tiles); }
        if (j > half) {
          const nx = clamp(x + (cr() < 0.25 ? -1 : cr() < 0.33 ? 1 : 0), 2, W - 3);
          if (nx !== x) { cut(id(nx, j), tiles); x = nx; }
        }
      }
      // Along the middle line to the centre, where it meets the rival's half of the gallery.
      for (let i = Math.min(x, ca); i <= Math.max(x, cb); i++) cut(id(i, half), tiles);
      channels.push(tiles);
    }
    // Each channel's mouth: its tiles that open onto ground outside the channels on this side (where
    // a wall closes it off; the AI walls them, see aiWalls).
    for (const tiles of channels) {
      const mouth = [];
      for (const t of tiles) {
        if (((t / W) | 0) <= half) continue;
        let open = false;
        orth(t, (u) => { if (((u / W) | 0) >= half && terrain[u] === T_GROUND && !carved.has(u)) open = true; });
        if (open) mouth.push(t);
      }
      if (mouth.length) chokeInfo.push(mouth.sort((a, b) => a - b));
    }
  };
  if (choke) chokeBand();

  // Rift, Ring valley, Oases, Crossroads and Lakes (two players): laid over the whole map, each tile with
  // its twin turned half round, and laid again after a corridor is cut (so it can't cut through them).
  // Each uses its own random numbers from the seed, so laying it again gives the same map. `links` are
  // the places (on the bottom half) the base must reach by land: every way across (each arch, valley or
  // gap), so that its twin reaches the other base too. `wall` marks the shape's own barrier (a chasm, the
  // massif, a ridge), which a link never cuts through.
  let links = [];
  const wall = new Uint8Array(N);
  // Tiles with something special about them (returned with the map): lava (water you can't sail),
  // fords (shallow water bots can wade), tidal flats (sea at high tide, sand at low tide) and the
  // fault (ground until the earthquake opens it). Each is set with its twin.
  const lavaA = new Uint8Array(N), fordA = new Uint8Array(N), tidalA = new Uint8Array(N), faultA = new Uint8Array(N);
  const flag = (arr, t, v = 1) => { for (const u of orbit(t)) arr[u] = v; };
  let volcanoAt = null, faultInfo = null;
  const nearBase = (i, j, r) => bases.some((b) => dist2(i, j, b.x, b.y) <= r * r);
  const put = (t, kind, lv, fixed) => {
    for (const u of orbit(t)) {
      terrain[u] = kind; res[u] = R_NONE; fert[u] = 0; wall[u] = fixed ? 1 : 0;
      if (kind === T_GROUND && lv !== undefined) elev[u] = lv;
    }
  };
  const putRes = (t, type) => {
    for (const u of orbit(t)) {
      if (terrain[u] !== T_GROUND) continue;
      if (type === F_FERTILE) { fert[u] = 1; res[u] = R_NONE; } else { res[u] = type; fert[u] = 0; }
    }
  };
  const stampRes = (cr, x, y, rad, type, fill) => {
    for (let j = Math.floor(y - rad); j <= Math.ceil(y + rad); j++) for (let i = Math.floor(x - rad); i <= Math.ceil(x + rad); i++) {
      if (i < 1 || j < 1 || i >= W - 1 || j >= H - 1 || dist2(i, j, x, y) > rad * rad) continue;
      if (cr() < fill) putRes(id(i, j), type);
    }
  };
  const ca = Math.floor((W - 1) / 2), cb = Math.ceil((W - 1) / 2);
  // Rift: a chasm right across the middle, two to four tiles deep each side of the line, crossed only by
  // natural rock arches: a pair (each with its twin), and sometimes one down the middle.
  const riftShape = () => {
    const cr = makeRng(seed ^ 0x2a1f77), p1 = cr() * 6.28, f1 = 0.2 + cr() * 0.15;
    const depth = (i) => clamp(Math.round(2.7 + 1.1 * dsin(i * f1 + p1)), 2, 4);
    for (let i = 0; i < W; i++) for (let j = half; j < half + depth(i); j++) put(id(i, j), T_CHASM, undefined, true);
    const c = 3 + Math.floor(cr() * Math.max(1, ca - 7));
    const cols = [c, c + 1, W - 2 - c, W - 1 - c];
    if (cr() < 0.45) cols.push(ca, cb);
    for (const i of cols) for (let j = half; j < half + 4; j++) if (terrain[id(i, j)] === T_CHASM) put(id(i, j), T_GROUND, baseLevel);
    links = [[c, half], [W - 1 - c, half]];
    if (cols.length > 4) links.push([ca, half]);
  };
  // Ring valley: a massif no one can cross fills the middle; a valley runs round it on each side, the
  // bases at either end, with a field or two along the way.
  const ringShape = () => {
    const cr = makeRng(seed ^ 0x3b2e11), p = cr() * 6.28;
    const rx = Math.max(5, W / 2 - 7), ry = Math.max(5, half - 15);
    const inside = (i, j) => {
      const a = datan2(j - ccy, i - ccx), w = 1 + 0.08 * dcos(2 * a + p) + 0.05 * dcos(4 * a + p * 1.7);
      return sq((i - ccx) / rx) + sq((j - ccy) / ry) <= w * w;
    };
    for (let j = half; j < H; j++) for (let i = 0; i < W; i++) {
      const t = id(i, j);
      // (Its foot wobbles out further on a big planet: it stops short of the landing zone and the fertile soil just past it.)
      if (inside(i, j)) { if (!nearBase(i, j, 9.5)) put(t, T_ROCK, undefined, true); }
      else if ((i <= 5 || i >= W - 6) && terrain[t] !== T_GROUND && !nearBase(i, j, 3)) put(t, T_GROUND, baseLevel); // the valleys stay open
    }
    stampRes(cr, 3.2, ccy + ry * 0.45, 1.5, R_ORE, 0.8);
    stampRes(cr, W - 4.2, ccy + ry * 0.2, 1.4, R_CRYSTAL, 0.8);
    links = [[2, half], [W - 3, half]];
  };
  // Oases: a barren waste strewn with crags, where only round your base and in a few rich oases (three
  // on each side, five at Immense or seven at Planetary, and one in the middle) is anything worth having; narrow passes wind between them.
  const oasesShape = () => {
    const cr = makeRng(seed ^ 0x4c5d23), sO2 = seed * 37 + 7, home = clamp(Math.round(W * 0.3), 9, 13); // less round the base on a small map
    const pts = [], want = cfg.size === PLANETARY_SIZE ? 7 : cfg.size === IMMENSE_SIZE ? 5 : 3;
    for (let tries = 0; pts.length < want && tries < 600; tries++) {
      const x = 4 + cr() * (W - 8), y = half + 4 + cr() * Math.max(1, H - half - 9);
      if (nearBase(x, y, home + 2) || dist2(x, y, ccx, ccy) < 100 || pts.some((q) => dist2(x, y, q.x, q.y) < 90)) continue;
      pts.push({ x, y });
    }
    const centre = { x: ccx, y: ccy };
    const inOasis = (i, j) => pts.some((q) => dist2(i, j, q.x, q.y) <= 13) || dist2(i, j, centre.x, centre.y) <= 17;
    for (let j = half; j < H; j++) for (let i = 0; i < W; i++) {
      if (nearBase(i, j, home) || inOasis(i, j)) continue;
      const t = id(i, j);
      if (fbm(i / 3.2, j / 3.2, sO2, 2) > 0.52) put(t, T_ROCK);
      else if (terrain[t] === T_GROUND) for (const u of [t, mir(t)]) { res[u] = R_NONE; fert[u] = 0; } // barren
    }
    const kinds = [[R_ORE, R_CRYSTAL], [R_CRYSTAL, R_OIL], [R_ORE, R_BOULDER]];
    pts.forEach((q, k) => {
      for (let j = Math.floor(q.y - 4); j <= Math.ceil(q.y + 4); j++) for (let i = Math.floor(q.x - 4); i <= Math.ceil(q.x + 4); i++) {
        if (i >= 1 && j >= half && i < W - 1 && j < H - 1 && dist2(i, j, q.x, q.y) <= 13) put(id(i, j), T_GROUND);
      }
      stampRes(cr, q.x, q.y, 3.4, F_FERTILE, 0.35);
      stampRes(cr, q.x - 1.2, q.y - 0.8, 1.5, kinds[k % 3][0], 0.85);
      stampRes(cr, q.x + 1.4, q.y + 0.9, 1.3, kinds[k % 3][1], 0.85);
    });
    for (let j = half; j < H; j++) for (let i = 0; i < W; i++) if (dist2(i, j, centre.x, centre.y) <= 17) put(id(i, j), T_GROUND);
    stampRes(cr, centre.x + 0.5, centre.y + 0.5, 1.1, R_OIL, 0.9);
    stampRes(cr, centre.x - 2, centre.y + 2, 1.4, R_ORE, 0.85);
    stampRes(cr, centre.x + 2.2, centre.y + 1.6, 1.3, R_CRYSTAL, 0.85);
    // Narrow passes, winding: home to the nearest oasis, oasis to oasis, and on to the middle.
    const carve = (a, b) => {
      let x = a.x, y = a.y;
      for (let k = 0; k < 300 && dist2(x, y, b.x, b.y) > 1; k++) {
        const d = Math.sqrt(dist2(x, y, b.x, b.y));
        x += (b.x - x) / d + (cr() - 0.5) * 0.9; y += (b.y - y) / d + (cr() - 0.5) * 0.9;
        for (const [di, dj] of [[0, 0], [1, 0]]) {
          const i = Math.round(x) + di, j = Math.round(y) + dj;
          if (i >= 1 && j >= 1 && i < W - 1 && j < H - 1 && terrain[id(i, j)] !== T_GROUND) put(id(i, j), T_GROUND);
        }
      }
    };
    const order = pts.slice().sort((a, b) => dist2(a.x, a.y, bx, by) - dist2(b.x, b.y, bx, by));
    let prev = { x: bx, y: by };
    for (const q of order) { carve(prev, q); prev = q; }
    carve(prev, centre);
    if (order.length) carve(order[0], centre);
    links = [[ca, half]];
  };
  // Crossroads (the mesas and the arms between them: see CM): no water anywhere, and no crags on a mesa's cliffs (its
  // terrace, the foot below it and a rim along the top's edge, so every slope off a mesa is joined to the others along
  // the rim) or on the ways: each slope and the way on from its foot (straight across the arm, or on to the plaza), and
  // down the middle of each arm. crLane marks the ways, which no hill is laid on. Each tile with its twins (put's
  // orbit), on player 0's part of the map.
  const crLane = new Uint8Array(N);
  const crossOpen = () => {
    const clear = (i, j, mark) => {
      if (i < 0 || j < 0 || i >= W || j >= H || !canon(i, j)) return;
      for (const u of orbit(id(i, j))) {
        if (terrain[u] !== T_GROUND) { terrain[u] = T_GROUND; res[u] = R_NONE; fert[u] = 0; }
        if (mark) crLane[u] = 1;
      }
    };
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      if (!canon(i, j)) continue;
      const e = CM.e(i, j);
      if (terrain[id(i, j)] === T_WATER || (e >= -3.5 && e < 3.5)) clear(i, j, false);
    }
    const midX = Math.round(CM.armX), midY = quad ? hw : half; // (the middle of the arm east of the mesa, and the first row of player 0's part)
    for (const m of CM.ms) {
      // Off the east (or west) face: from inside the top out across the arm, to its middle (two players: the arm's
      // far side, where the free mesa's slope comes down to meet it).
      for (let k = -2; k <= 2; k++) for (let i = m.xc - m.ex * 4; m.ex > 0 ? i <= midX : i >= midX; i += m.ex) clear(i, m.row + k, Math.abs(k) <= 1);
      // Off the north face, up to the middle line.
      for (let k = -2; k <= 2; k++) for (let j = m.yc + 4; j >= midY; j--) clear(m.col + k, j, Math.abs(k) <= 1);
      // Off the corner, on to the plaza.
      const r0 = m.rc - 4;
      for (let j = Math.floor(Math.min(m.oy, ccy)) - 3; j <= Math.ceil(Math.max(m.oy, ccy)) + 3; j++) {
        for (let i = Math.floor(Math.min(m.ox, ccx)) - 3; i <= Math.ceil(Math.max(m.ox, ccx)) + 3; i++) {
          const s = (i - m.ox) * m.dx + (j - m.oy) * m.dy, p = Math.abs((j - m.oy) * m.dx - (i - m.ox) * m.dy);
          if (s >= r0 && s <= m.far && p <= 2.2) clear(i, j, p <= 1.5);
        }
      }
    }
    // Down the middle of each arm: three tiles either side of the middle line (two players: the arm between the
    // bottom mesas, which lies right of the middle, and the middle row, across the planet).
    if (quad) {
      for (let j = hw; j < H; j++) for (let i = hw - 3; i < hw; i++) clear(i, j, true);
      for (let j = hw; j < hw + 3; j++) for (let i = 0; i < hw; i++) clear(i, j, true);
    } else {
      for (let j = half; j < H; j++) for (let i = midX - 2; i <= midX + 2; i++) clear(i, j, true);
      for (let j = half; j < half + 3; j++) for (let i = 0; i < W; i++) clear(i, j, true);
    }
  };
  // The plaza: open ground in the middle (where a neutral Trade Post lands, as near every colony), with Oil, Ore and
  // Crystal round its rim (with three or four, at each quarter's corner of it).
  const crossPlaza = (cr) => {
    if (quad) {
      for (let j = hw; j < H; j++) for (let i = 0; i < hw; i++) if (dist2(i, j, ccx, ccy) <= 31) put(id(i, j), T_GROUND);
      stampRes(cr, ccx - 3.4, ccy + 3.4, 0.95, R_OIL, 0.9);
      stampRes(cr, ccx - 4.6, ccy + 1.1, 1.05, R_ORE, 0.85);
      stampRes(cr, ccx - 1.1, ccy + 4.6, 1.05, R_CRYSTAL, 0.85);
    } else {
      for (let j = half; j < H; j++) for (let i = 0; i < W; i++) if (dist2(i, j, ccx, ccy) <= 21) put(id(i, j), T_GROUND);
      stampRes(cr, ccx + 0.5, ccy + 0.5, 1.1, R_OIL, 0.9);
      stampRes(cr, ccx - 2.6, ccy + 2.2, 1.3, R_ORE, 0.85);
      stampRes(cr, ccx + 2.6, ccy + 2.0, 1.3, R_CRYSTAL, 0.85);
    }
  };
  // Crossroads for two: the bases on two opposite mesas (bottom left and top right); the other two mesas are free and
  // rich, so worth a fight. (The same planet as for four, narrower: see CM.)
  const crossShape = () => {
    const cr = makeRng(seed ^ 0x5e6f31);
    crossOpen();
    crossPlaza(cr);
    // The free mesa (bottom right; its twin, top left): rich fields on its top.
    const sp = CM.ms[1];
    const rich = [[R_ORE, 1.8], [R_CRYSTAL, 1.6], [R_OIL, 1.1], [F_FERTILE, 2.2], [R_BOULDER, 1.6], [R_ORE, 1.5]];
    for (const [type, rad] of rich) {
      for (let tries = 0; tries < 60; tries++) {
        const x = sp.xc + 1 + cr() * (W - 3 - sp.xc), y = sp.yc + 1 + cr() * (H - 3 - sp.yc);
        if (terrain[id(Math.floor(x), Math.floor(y))] !== T_GROUND || CM.e(x, y) < rad + 0.5) continue;
        stampRes(cr, x, y, rad, type, type === F_FERTILE ? 0.8 : 0.85);
        break;
      }
    }
    links = [[ca, half], [Math.round(CM.armX), H - 2], [1, half], [W - 2, half]]; // the plaza, and the outer ends of the arms
  };
  // Crossroads for three or four: the mesa, the arms either side of it and its quarter of the plaza, laid on the
  // bottom-left quarter and turned onto the others.
  const crossShape4 = () => {
    const cr = makeRng(seed ^ 0x5e6f31);
    crossOpen();
    crossPlaza(cr);
    links = [[hw - 1, hw], [hw - 1, H - 2], [1, hw]]; // the plaza, and the outer ends of the arms either side
  };
  // Pinwheel (three or four): four curved ridges sweep out from a plaza in the middle, one between each pair
  // of neighbouring quarters. Each ends a few tiles short of the edge (the way round to the next colony) and,
  // near the plaza, curls round toward the next quarter, so the way from a colony to the plaza bends that
  // way. Drawn once (the ridge between this quarter and the one above) and laid on the others by put.
  const pinwheelShape = () => {
    const cr = makeRng(seed ^ 0x9177e3), sP = seed * 47 + 13, rP = Math.sqrt(31), rb = dist(bx, by, ccx, ccy);
    const sweep = -1.2, rFlat = Math.max(rP + 6, rb * 0.85), rEnd = hw - 0.5 - Math.max(4, Math.round(qc * 0.4));
    for (let r = rP + 0.8; r <= rEnd; r += 0.25) {
      const f = clamp((rFlat - r) / (rFlat - rP), 0, 1), a = Math.PI + sweep * f * f * (3 - 2 * f);
      const x = ccx + dcos(a) * r, y = ccy + dsin(a) * r, w = 1.35 + 0.9 * fbm(r / 2.5, 3.5, sP, 2);
      for (let j = Math.floor(y - w); j <= Math.ceil(y + w); j++) for (let i = Math.floor(x - w); i <= Math.ceil(x + w); i++) {
        if (i < 1 || j < 1 || i >= W - 1 || j >= H - 1 || dist2(i, j, x, y) > w * w || nearBase(i, j, 8.5)) continue;
        put(id(i, j), T_ROCK, undefined, true);
      }
    }
    // The plaza, with Oil, Ore and Crystal round its rim (as on Crossroads).
    for (let j = hw; j < H; j++) for (let i = 0; i < hw; i++) if (dist2(i, j, ccx, ccy) <= 31) put(id(i, j), T_GROUND, baseLevel);
    stampRes(cr, ccx - 3.4, ccy + 3.4, 0.95, R_OIL, 0.9);
    stampRes(cr, ccx - 4.6, ccy + 1.1, 1.05, R_ORE, 0.85);
    stampRes(cr, ccx - 1.1, ccy + 4.6, 1.05, R_CRYSTAL, 0.85);
    links = [[hw - 1, hw], [2, hw], [hw - 1, H - 3]]; // the plaza, and round the outer ends of both ridges
  };
  // Four Isles: the island in the middle holds the riches (the Trade Post lands there too).
  const isles4Shape = () => {
    const cr = makeRng(seed ^ 0x41e5c7);
    const k = clamp(hw * 0.12, 3, 4.4); // (round its rim: the middle is kept clear for the Trade Post)
    stampRes(cr, ccx - k * 0.72, ccy + k * 0.72, 0.9, R_OIL, 0.9);
    stampRes(cr, ccx - k, ccy + 0.6, 1.0, R_ORE, 0.85);
    stampRes(cr, ccx - 0.6, ccy + k, 1.0, R_CRYSTAL, 0.85);
    links = [];
  };
  // Lakes: a land of many small lakes, roads weaving between them.
  // Lakes: a big lake in the middle and a scatter of smaller ones, wide enough for ships (it's a naval map);
  // the way by land runs round either side of the middle lake.
  const lakesShape = () => {
    const sL = seed * 43 + 19, cr = makeRng(seed ^ 0x6a7b45);
    const rx = W * (0.2 + cr() * 0.06), ry = Math.max(4, half * (0.24 + cr() * 0.08)), p = cr() * 6.28;
    for (let j = half; j < H; j++) for (let i = 0; i < W; i++) {
      if (nearBase(i, j, 9)) continue;
      const a = datan2(j - ccy, i - ccx), w = 1 + 0.14 * dcos(2 * a + p) + 0.3 * (fbm(i / 3, j / 3, sL + 5, 2) - 0.5);
      if (sq((i - ccx) / rx) + sq((j - ccy) / ry) <= w * w || fbm(i / 6, j / 6, sL, 3) < LAKES_WET) put(id(i, j), T_WATER);
    }
    // Ponds too small for a ship go back to land.
    const lab = new Int32Array(N).fill(-1);
    for (let t = 0; t < N; t++) {
      if (terrain[t] !== T_WATER || lab[t] >= 0) continue;
      const q = [t];
      lab[t] = t;
      for (let h = 0; h < q.length; h++) orth(q[h], (u) => { if (lab[u] < 0 && terrain[u] === T_WATER) { lab[u] = t; q.push(u); } });
      if (q.length < 14) for (const u of q) { terrain[u] = T_GROUND; res[u] = R_NONE; fert[u] = 0; }
    }
    links = [[3, half], [W - 4, half]];
  };

  // River delta: a wide braided river along the middle of the planet, with sandbar islets in it (the
  // middle one rich), shallow fords bots can wade across (trucks need a bridge), fertile banks, and a
  // side channel branching off toward each flank. Flat ground (see SH.flat).
  const deltaShape = () => {
    const cr = makeRng(seed ^ 0x8d9e67), p1 = cr() * 6.28, p2 = cr() * 6.28;
    // How far the river reaches into the bottom half at column i (its top half is the twin of column W-1-i's).
    const hw = (i) => clamp(Math.round(3.2 + 1.1 * dsin(i * 0.23 + p1) + 0.7 * dsin(i * 0.61 + p2)), 2, 5);
    for (let i = 0; i < W; i++) for (let j = half; j < half + hw(i); j++) put(id(i, j), T_WATER, undefined, true);
    // A side channel off each flank: from the river out toward the bottom-left edge (its twin, top right).
    const sx0 = Math.round(W * 0.34), sy0 = half + hw(Math.round(W * 0.34)) - 1, ex = 0, ey = Math.round(half + (H - half) * 0.62);
    let x = sx0, y = sy0, a = datan2(ey - sy0, ex - sx0);
    const side = [];
    for (let k = 0; k < 400 && x > 0.5 && y < H - 3; k++) {
      a += (cr() - 0.5) * 0.35 + 0.15 * (datan2(ey - y, ex - x) - a);
      x += dcos(a) * 0.5; y += dsin(a) * 0.5;
      const i = Math.round(x), j = Math.round(y);
      if (i < 0 || j < half || j >= H || nearBase(i, j, 9)) continue;
      for (const [di, dj] of [[0, 0], [0, 1], [1, 0]]) {
        const u = i + di, v = j + dj;
        if (u >= 0 && u < W && v >= half && v < H && !nearBase(u, v, 8.5)) { put(id(u, v), T_WATER, undefined, true); side.push(id(u, v)); }
      }
    }
    // Islets midstream: one in the middle with oil and crystal, and a couple more off to the sides.
    const islet = (x0, x1, j0, j1) => { for (let j = j0; j <= j1; j++) for (let i = x0; i <= x1; i++) if (j >= half) put(id(i, j), T_GROUND, baseLevel, true); };
    islet(ca - 2, cb + 2, half, half);
    stampRes(cr, ccx + 0.5, half, 1.2, R_OIL, 0.9);
    stampRes(cr, ccx - 1.5, half, 0.8, R_CRYSTAL, 0.95);
    const ix = Math.round(W * (0.16 + cr() * 0.08));
    if (hw(ix) >= 4 && hw(ix + 3) >= 4) { islet(ix, ix + 3, half + 1, half + 1); stampRes(cr, ix + 1.5, half + 1, 1.2, R_ORE, 0.85); }
    // Fords: a pair of shallow crossings right across the river (each column with its twin), and one
    // across each side channel.
    const fc = Math.round(W * (0.42 + cr() * 0.03));
    for (const c of [fc, fc + 1, W - 2 - fc, W - 1 - fc]) for (let j = half; j < half + hw(c); j++) if (terrain[id(c, j)] === T_WATER) flag(fordA, id(c, j));
    if (side.length > 12) {
      const k0 = Math.floor(side.length * 0.55), c0 = side[k0], ci = c0 % W, cj = (c0 / W) | 0;
      for (const t of side) { const i = t % W, j = (t / W) | 0; if (Math.abs(i - ci) <= 1 && Math.abs(j - cj) <= 1) flag(fordA, t); }
    }
    // Fertile banks.
    for (let i = 0; i < W; i++) { const j = half + hw(i); if (j < H && terrain[id(i, j)] === T_GROUND && cr() < 0.55) putRes(id(i, j), F_FERTILE); }
    links = [[fc, half + hw(fc)], [W - 1 - fc, half + hw(W - 1 - fc)]];
  };
  // Grand Canyon: put the south bank and its half-turn in together, even where the river bends
  // past the middle row. Two terraces rise to each rim, with a side canyon opening at one end.
  const grandCanyonShape = () => {
    const cr = makeRng(seed ^ 0x4c671f), bend = cr() < 0.5 ? -1 : 1, wave = 2 + cr();
    const narrow = Math.round(W * (0.32 + 0.04 * cr())), ford = Math.round(W * 0.42);
    // Ease bends across columns so even the two-tile narrows have a connected channel.
    const centerline = new Float32Array(W);
    let offset = 0;
    for (let i = Math.ceil(ccx); i < W; i++) {
      const a = (i - ccx) / ccx;
      const next = Math.round(bend * (3 * dsin(a * wave) + 0.9 * dsin(a * 8)));
      if (i - ccx > 0.5) offset = clamp(next, offset - 1, offset + 1);
      centerline[i] = ccy + offset;
      centerline[W - 1 - i] = ccy - offset;
    }
    const river = (i) => centerline[i];
    const main = Math.floor(ccx) - 2, flank = Math.round(W * 0.14);
    const onMain = (i) => i >= main && i <= main + 4;
    const onFlank = (i) => i >= flank - 3 && i <= flank + 1;
    const fromNarrows = (i) => Math.min(Math.abs(i - narrow), Math.abs(i - (W - 1 - narrow)));
    const basin = (i, center, radius) => Math.max(0, 1 - sq((i - center) / radius));
    const islandX = Math.round(W * (0.16 + cr() * 0.025));
    const islandR = clamp(W * (0.055 + cr() * 0.011), 2.4, 8);
    const meadowX = Math.round(W * (0.41 + cr() * 0.035));
    const widthAt = (i) => {
      const left = Math.min(i, W - 1 - i);
      return 6 * basin(left, islandX, W * 0.12) + 4 * basin(left, meadowX, W * 0.075);
    };
    const floorEdge = (i) => {
      if (fromNarrows(i) <= 1) return 3.4;
      if (onMain(i)) return 7;
      if (onFlank(i)) return 11;
      const bank = 6 + widthAt(i) + (fbm(i / 8, 0, sE, 2) - 0.5) * (2 + TPR.levels * 0.4);
      const side = 6 * clamp(1 - i / (W * 0.24), 0, 1);
      return Math.max(3.5, bank - Math.max(0, 5 - fromNarrows(i))) + side;
    };
    const isFord = (i) => i === ford || i === ford + 1 || i === W - 1 - ford || i === W - 2 - ford;
    const waterWidth = (i) => {
      if (fromNarrows(i) <= 1) return 1.5;
      if (isFord(i)) return 2;
      const left = Math.min(i, W - 1 - i);
      return 2 + 4.4 * basin(left, islandX, islandR * 1.6) + 0.9 * basin(left, meadowX, W * 0.065);
    };
    const bankRow = (i) => Math.ceil(river(i) + waterWidth(i));
    for (let i = 0; i < W; i++) {
      const mid = river(i), n = fromNarrows(i), wet = waterWidth(i);
      // Keep neighboring stretches of the riverbank joined, even where a wide bend meets the narrows.
      const bank = Math.max(bankRow(Math.max(0, i - 1)), bankRow(Math.min(W - 1, i + 1)));
      const edge = Math.max(floorEdge(i), wet + (n <= 1 ? 1.9 : 3), bank - mid + 1);
      const island = n <= 1 || isFord(i) ? 0 : 2.55 * Math.sqrt(basin(Math.min(i, W - 1 - i), islandX, islandR));
      const step = onMain(i) || onFlank(i) ? 3 : 1 + clamp((n - 1) * 0.65, 0, 2);
      for (let j = Math.ceil(mid); j < H; j++) {
        const t = id(i, j), depth = j - mid;
        if (depth < wet) {
          if (depth < island) {
            put(t, T_GROUND, 0);
            if (depth + 0.8 < island && hash2(i, j, sO) < 0.83) putRes(t, F_FERTILE);
          } else {
            put(t, T_WATER, undefined, true);
            flag(elev, t, 0);
            if (isFord(i)) flag(fordA, t);
          }
          continue;
        }
        const level = depth < edge ? 0 : depth < edge + step ? 1 : depth < edge + 2 * step ? 2 : 3;
        // Keep terraces clear near the two descents. Away from them, crags break up the high shelves.
        const crag = level === 2 && Math.abs(i - main) > 7 && Math.abs(i - flank) > 7 && n > 3 &&
          fbm(i / 4, j / 4, sB, 2) > 0.65;
        const abutment = n <= 1 && depth < edge + 2 * step + 1;
        if (crag) { put(t, T_ROCK, undefined, true); flag(elev, t, level); }
        else if (level < 3 || abutment || terrain[t] !== T_GROUND) put(t, T_GROUND, level);
        else flag(elev, t, level);
        // Patches follow the broad bends. Leave the first shoreline tile bare for docks and crossings.
        if (level === 0 && n > 2 && !isFord(i) && depth > wet + 0.7 && depth < edge - 0.7 &&
            fbm(i / 4, j / 3, sC, 2) + 0.045 * widthAt(i) > 0.67) putRes(t, F_FERTILE);
      }
    }

    // One natural ramp at each terrace of two single-lane descents. Stagger the middle ramp for a switchback.
    for (const [x, dir] of [[main, 1], [flank, -1]]) {
      for (let level = 0; level < 3; level++) {
        const i = x + (level === 1 ? 3 * dir : 0);
        for (let j = Math.ceil(river(i)) + 2; j < H - 1; j++) {
          const t = id(i, j);
          if (terrain[t] !== T_GROUND || terrain[t + W] !== T_GROUND ||
              elev[t] !== level || elev[t + W] !== level + 1) continue;
          flag(ramp, t);
          break;
        }
      }
    }

    // Ore and Crystal on broad river flats, with stretches of bare shoreline for Ports.
    for (const [part, type, rad] of [[0.11, R_ORE, 1.8], [0.23, R_CRYSTAL, 1.5], [0.47, R_ORE, 1.8],
      [0.55, R_CRYSTAL, 1.5], [0.78, R_ORE, 1.9], [0.91, R_CRYSTAL, 1.6]]) {
      const i = Math.round((W - 1) * part), j = Math.ceil(river(i) + waterWidth(i) + 1.1);
      stampRes(cr, i, j, rad, type, 0.85 * stampDens);
      putRes(id(i, j), type);
    }
    if (cfg.nuke) {
      const spots = [];
      for (let i = 2; i < W - 2; i++) {
        for (let j = Math.ceil(river(i) + waterWidth(i)); j < river(i) + floorEdge(i); j++) {
          const t = id(i, j);
          if (!res[t] && !ramp[t]) spots.push(t);
        }
      }
      for (let n = 0; n < URANIUM_DEPOSITS && spots.length; n++) {
        const k = Math.floor(cr() * spots.length);
        putRes(spots[k], R_URANIUM);
        spots[k] = spots[spots.length - 1];
        spots.pop();
      }
    }
    for (let t = 0; t < N; t++) if (ramp[t]) { res[t] = R_NONE; fert[t] = 0; }
  };
  // Volcano: a cone in the middle of the planet, rising level by level to a crater of lava, with lava
  // rivers running down its flanks (bridge them, or go round where they end) and the richest deposits
  // on its slopes. It erupts every few minutes (see updateVolcano).
  const volcanoShape = () => {
    const cr = makeRng(seed ^ 0x9eaf13), sV = seed * 53 + 29;
    const rS = Math.min(W, H) * 0.3, rC = Math.max(2.2, rS * 0.17), top = L - 1, rings = Math.max(1, top - baseLevel);
    for (let j = half; j < H; j++) for (let i = 0; i < W; i++) {
      const t = id(i, j), d = dist(i, j, ccx, ccy) * (1 + 0.12 * (fbm(i / 4, j / 4, sV, 2) - 0.5));
      if (d <= rC) { put(t, T_WATER, undefined, true); flag(lavaA, t); continue; }
      if (d > rS) continue;
      const lv = baseLevel + clamp(Math.ceil(rings * (1 - (d - rC) / (rS - rC)) + 0.001), 0, rings);
      if (terrain[t] === T_ROCK && d > rS * 0.55 && fbm(i / 3, j / 3, sV + 3, 2) > 0.55) continue; // a few crags on the lower slopes
      put(t, T_GROUND, lv);
    }
    // Lava rivers: two down the bottom flanks (their twins down the top ones), each ending in a pool.
    for (const a0 of [Math.PI / 2 + 0.75 + cr() * 0.35, Math.PI / 2 - 0.75 - cr() * 0.35]) {
      let a = a0, r = rC - 0.5, x = ccx + dcos(a) * r, y = ccy + dsin(a) * r;
      const rEnd = rS * (1.45 + cr() * 0.25);
      for (let k = 0; k < 300 && r < rEnd; k++) {
        a += (cr() - 0.5) * 0.3 + 0.2 * (a0 - a);
        x += dcos(a) * 0.5; y += dsin(a) * 0.5; r = dist(x, y, ccx, ccy);
        const i = Math.round(x), j = Math.round(y);
        if (i < 4 || i > W - 5 || j > H - 6 || nearBase(i, j, 10)) break;
        for (const [di, dj] of [[0, 0], [1, 0]]) { const u = id(i + di, j + dj); put(u, T_WATER, undefined, true); flag(lavaA, u); }
      }
      for (let j = Math.round(y) - 2; j <= Math.round(y) + 2; j++) for (let i = Math.round(x) - 2; i <= Math.round(x) + 2; i++) {
        if (i >= 4 && i <= W - 5 && j >= half && j <= H - 6 && dist2(i, j, x, y) <= 2.6 && !nearBase(i, j, 10)) { put(id(i, j), T_WATER, undefined, true); flag(lavaA, id(i, j)); }
      }
    }
    // Rich fields on the slopes, between the rivers.
    const slope = [[R_ORE, 1.7], [R_CRYSTAL, 1.4], [R_ORE, 1.3], [R_BOULDER, 1.4]];
    if (cfg.nuke) slope.push([R_URANIUM, 0.6]);
    slope.forEach(([type, rad], k) => {
      for (let tries = 0; tries < 80; tries++) {
        const a = Math.PI * (0.08 + cr() * 0.84), r = rS * (0.45 + cr() * 0.4), x = ccx + dcos(a) * r, y = ccy + dsin(a) * r;
        const t = id(Math.round(x), Math.round(y));
        if (y < half || terrain[t] !== T_GROUND || lavaA[t] || res[t]) continue;
        stampRes(cr, x, y, rad, type, type === R_URANIUM ? 1 : 0.85);
        break;
      }
    });
    volcanoAt = { x: ccx + 0.5, y: ccy + 0.5, r: rS, crater: rC };
    links = [[2, half], [W - 3, half]];
  };
  // Fault line: a jagged crack across the middle of the planet. It's plain ground at first (a faint scar
  // marks it); an earthquake later opens it into a chasm (see updateQuake), all but a couple of rock
  // arches. The band along it is kept level so both sides stay joined to their arches afterwards.
  const faultShape = () => {
    const cr = makeRng(seed ^ 0xa1b2c3), c = (W - 1) / 2, P = W * (0.85 + cr() * 0.3), ph = cr() < 0.5 ? 1 : -1;
    const f = (i) => ph * (3.2 * dsin((2 * Math.PI * (i - c)) / P) + 0.9 * dsin((2 * Math.PI * (i - c)) / 5.3));
    const hw = (i) => 1.15 + 0.45 * Math.abs(dsin((i - c) * 0.37));
    const ax = Math.round(W * (0.2 + cr() * 0.08));
    const arch = (i) => i === ax || i === ax + 1 || i === W - 1 - ax || i === W - 2 - ax;
    for (let j = half; j < H; j++) for (let i = 0; i < W; i++) {
      const d = Math.abs(j + 0.5 - half - f(i)), t = id(i, j);
      if (d <= hw(i)) { put(t, T_GROUND, baseLevel, !arch(i)); if (!arch(i)) flag(faultA, t); }
      else if (d <= hw(i) + 3 && terrain[t] === T_GROUND) for (const u of [t, mir(t)]) elev[u] = baseLevel;
    }
    // ...and the same for the rows above the middle (the twin of each is set as it goes).
    for (let j = 0; j < half; j++) for (let i = 0; i < W; i++) {
      const d = Math.abs(j + 0.5 - half - f(i)), t = id(i, j);
      if (d <= hw(i)) { put(t, T_GROUND, baseLevel, !arch(i)); if (!arch(i)) flag(faultA, t); }
      else if (d <= hw(i) + 3 && terrain[t] === T_GROUND) for (const u of [t, mir(t)]) elev[u] = baseLevel;
    }
    const below = (i) => Math.min(H - 2, Math.round(half + f(i) + hw(i) + 1.5));
    links = [[ax, below(ax)], [W - 1 - ax, below(W - 1 - ax)]];
    faultInfo = { f, hw, arches: [ax, W - 2 - ax] };
  };
  // Canyon maze: the land between the bases is a labyrinth of narrow canyons cut through rock, with a
  // few loops and plenty of dead ends, each holding something worth the trip. Two ways (and their
  // twins) lead through the middle. Tunnels can cut through a wall, at a price.
  const mazeShape = () => {
    const cr = makeRng(seed ^ 0x7c8d55), cw = W >= 44 ? 3 : 2, cell = cw + 1;
    const cols = Math.floor((W - 1) / cell), x0 = Math.floor((W - (cols * cell - 1)) / 2);
    const rows = Math.floor((H - 1 - (half + 1)) / cell);
    const cx = (c) => x0 + c * cell, cy = (r) => half + 1 + r * cell, home = 8.5;
    for (let j = half; j < H; j++) for (let i = 0; i < W; i++) if (!nearBase(i, j, home)) put(id(i, j), T_ROCK, undefined, true);
    const open = (i, j) => { if (i >= 0 && j >= half && i < W && j < H) put(id(i, j), T_GROUND, baseLevel); };
    const room = (c, r) => { for (let j = 0; j < cw; j++) for (let i = 0; i < cw; i++) open(cx(c) + i, cy(r) + j); };
    const doors = new Uint8Array(cols * rows); // bit 1: east, 2: south (the wall between it and that neighbour is open)
    const seen = new Uint8Array(cols * rows), stack = [];
    const startC = clamp(Math.floor((bx - x0) / cell), 0, cols - 1), startR = rows - 1;
    stack.push(startR * cols + startC); seen[startR * cols + startC] = 1;
    while (stack.length) {
      const k = stack[stack.length - 1], c = k % cols, r = (k / cols) | 0;
      const nb = [[c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < cols && b < rows && !seen[b * cols + a]);
      if (!nb.length) { stack.pop(); continue; }
      const [a, b] = nb[Math.floor(cr() * nb.length)], n = b * cols + a;
      if (a > c) doors[k] |= 1; else if (a < c) doors[n] |= 1; else if (b > r) doors[k] |= 2; else doors[n] |= 2;
      seen[n] = 1; stack.push(n);
    }
    // A few extra openings so there's more than one way round.
    for (let k = 0; k < cols * rows; k++) { if (cr() < 0.1 && k % cols < cols - 1) doors[k] |= 1; if (cr() < 0.08 && ((k / cols) | 0) < rows - 1) doors[k] |= 2; }
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      room(c, r);
      const k = r * cols + c;
      if (doors[k] & 1) for (let j = 0; j < cw; j++) open(cx(c) + cw, cy(r) + j);
      if (doors[k] & 2) for (let i = 0; i < cw; i++) open(cx(c) + i, cy(r) + cw);
    }
    // The ways through the middle: two cells' columns (each with its twin) open across the middle line.
    const cA = clamp(Math.round(cols * (0.18 + cr() * 0.1)), 0, cols - 1);
    for (const c of [cA, cols - 1 - cA]) for (let i = 0; i < cw; i++) open(cx(c) + i, half);
    // Dead ends (one way in), away from the base, hold the riches.
    const kinds = [R_ORE, R_CRYSTAL, R_BOULDER, R_OIL, R_ORE, F_FERTILE, R_CRYSTAL, R_STALK];
    let n = 0;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const k = r * cols + c;
      let ways = 0;
      if (doors[k] & 1) ways++;
      if (doors[k] & 2) ways++;
      if (c > 0 && doors[k - 1] & 1) ways++;
      if (r > 0 && doors[k - cols] & 2) ways++;
      if (r === 0 && (c === cA || c === cols - 1 - cA)) ways++;
      const mx = cx(c) + (cw - 1) / 2, my = cy(r) + (cw - 1) / 2;
      if (ways !== 1 || nearBase(mx, my, home + 3)) continue;
      const type = cfg.nuke && n % 7 === 6 ? R_URANIUM : kinds[n % kinds.length];
      stampRes(cr, mx, my, type === R_URANIUM ? 0.5 : cw * 0.55, type, 0.9);
      n++;
    }
    // A starter set in each base's clearing, which otherwise holds next to nothing: a stalk grove (Fiber for the
    // Smelters), Ore, Crystal and boulders, a few tiles out.
    for (const [dx, dy, rad, type] of [[-5, -2, 1.6, R_STALK], [5, -2, 1.4, R_ORE], [-4.5, 3, 1.2, R_CRYSTAL], [4.5, 3, 1.4, R_BOULDER]]) stampRes(cr, bx + dx, by + dy, rad, type, 0.85);
    links = [[cx(cA), half], [cx(cols - 1 - cA), half]];
  };
  // The cheapest way by land from the base to (tx, ty) on the bottom half, round the shape's barrier,
  // opened up two tiles wide where it isn't ground (a ford, a cut through crags); a long way round on
  // open ground is preferred to cutting more than a tile or two.
  const linkBase = (tx, ty) => {
    const goal = id(Math.round(tx), Math.round(ty)), start = id(bx, by);
    const cost = new Float64Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), heap = new MinHeap();
    cost[start] = 0; heap.push(start, 0);
    while (heap.size) {
      const t = heap.pop();
      if (t === goal) break;
      orth(t, (u) => {
        if (!canon(u % W, (u / W) | 0) || wall[u]) return;
        const c = cost[t] + (terrain[u] === T_GROUND ? 1 : 25);
        if (c < cost[u]) { cost[u] = c; from[u] = t; heap.push(u, c); }
      });
    }
    if (from[goal] < 0) return;
    for (let t = goal; t !== start && t >= 0; t = from[t]) {
      const side = Math.abs(from[t] - t) === 1 ? W : 1;
      for (const u of [t, t + side]) {
        if (u >= N || !canon(u % W, (u / W) | 0) || wall[u] || terrain[u] === T_GROUND || (side === 1 && (u % W) === 0)) continue;
        terrain[u] = T_GROUND; res[u] = R_NONE; fert[u] = 0;
      }
    }
  };
  // Long Haul 2v2: a plaza of open, level ground at the very centre (where the first Trade Post lands, as near every
  // colony), the ground round it kept within a level of it, and a way to it from the base.
  const haul4Shape = () => {
    for (let j = half; j < H; j++) for (let i = 0; i < hw; i++) {
      const d2 = dist2(i, j, ccx, ccy), t = id(i, j);
      if (d2 <= 13) put(t, T_GROUND, baseLevel);
      else if (d2 <= 42 && terrain[t] === T_GROUND) for (const u of orbit(t)) elev[u] = clamp(elev[u], Math.max(0, baseLevel - 1), baseLevel + 1);
    }
    links = [[hw - 1, half]];
  };
  const shapeExtras = () => {
    if (h4) haul4Shape();
    else if (quad) {
      if (SH.twin) return; // (Twin Valleys: its spine is laid later, after the turns: see below)
      if (SH.pinwheel) pinwheelShape();
      else if (SH.isles4) isles4Shape();
      else crossShape4();
    }
    else if (np !== 2) return;
    else if (SH.grandCanyon) { grandCanyonShape(); return; }
    else if (SH.rift) riftShape();
    else if (SH.ring) ringShape();
    else if (SH.oases) oasesShape();
    else if (SH.cross) crossShape();
    else if (SH.lakes) lakesShape();
    else if (SH.delta) deltaShape();
    else if (SH.volcano) volcanoShape();
    else if (SH.fault) faultShape();
    else if (SH.maze) mazeShape();
    else return;
    for (const [x, y] of links) linkBase(x, y);
    symmetrize();
  };
  shapeExtras();

  const ground = (t) => terrain[t] === T_GROUND;
  const reachable = (useElev) => {
    const seen = new Uint8Array(N), q = [id(bx, by)];
    seen[q[0]] = 1;
    while (q.length) {
      const t = q.pop();
      orth(t, (u) => {
        if (seen[u] || !(ground(u) || fordA[u])) return;
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
  if ((quad || h4) && !SH.islands && !joinedAll(false)) {
    // Four quarters: a corridor from player 0's base to the plaza, inside its quarter, turned onto the
    // others; then the ridges are laid again (and linked up) so it can't cut a new way through them.
    // (Long Haul 2v2: to the plaza at the very centre, mirrored onto the others.)
    let x = bx, y = by;
    for (let n = 0; n < 200 && dist(x, y, ccx, ccy) > 1; n++) {
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const i = Math.round(x) + di, j = Math.round(y) + dj;
        if (canon(i, j) && terrain[id(i, j)] !== T_GROUND) { terrain[id(i, j)] = T_GROUND; res[id(i, j)] = R_NONE; }
      }
      const d = dist(x, y, ccx, ccy);
      x += (ccx - x) / d + clamp((rng() - 0.5) * 1.2, -0.6, 0.6);
      y += (ccy - y) / d;
    }
    symmetrize();
    shapeExtras();
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
      // Up to the middle of the map, or on Chokepoint maps to a channel's mouth (where the way through is).
      const tx = choke && chokeInfo.length && chokeInfo[0].length ? chokeInfo[0][0] % W : W / 2;
      x += clamp((tx - x) * 0.25 + (rng() - 0.5) * 1.5, -1, 1);
    }
    mirror();
    if (choke) chokeBand(); // the corridor never cuts a second way through the crags
    shapeExtras(); // ...nor through a rift, a massif or a ridge (which are then linked up again)
  }

  // Crater maps: a sunken crater in the middle of the map, one level below a ring of rim, with the
  // richest fields on its floor. The outline wobbles only with even harmonics, so it stays
  // symmetric under the half-turn.
  const crR = Math.max(5, Math.round(Math.min(W, H) * 0.18));
  const crEdge = (i, j) => {
    const a = datan2(j - ccy, i - ccx), h = np === 2 ? 2 : 3; // harmonics that repeat with the bases
    return crR * (1 + 0.08 * dcos(h * a + seed) + 0.05 * dsin(2 * h * a + seed * 0.7)) - Math.sqrt(dist2(i, j, ccx, ccy));
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
    const a = datan2(j - by, i - bx);
    return plR * (1 + 0.1 * dcos(3 * a + seed) + 0.05 * dsin(5 * a + seed * 1.3)) - Math.sqrt(dist2(i, j, bx, by));
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
  // Crossroads: the levels, whatever the Terrain setting (only the hills depend on it). Each mesa's top is CR_TOP, its
  // terrace a level down and the lowland between at 0, with a few low hills a level up out in the lowland (more on
  // rougher terrain, none on Flat), kept off the ways (crLane) and well clear of the mesas and the plaza. crBand: 2 on
  // a mesa's top, 1 on its terrace (the slopes are cut through it in step 6). Player 0's part, each tile with its twins.
  const crBand = new Uint8Array(N);
  if (CM) {
    const thr = [2, 0.7, 0.66, 0.62, 0.6][clamp(cfg.rough ?? DEFAULT_ROUGH, 0, 4)], sHill = seed * 67 + 5;
    const nearLane = (i, j) => { for (let y = j - 1; y <= j + 1; y++) for (let x = i - 1; x <= i + 1; x++) if (x >= 0 && y >= 0 && x < W && y < H && crLane[id(x, y)]) return true; return false; };
    const lay = (t, lv, band) => { for (const u of orbit(t)) { elev[u] = lv; minE[u] = band ? lv : -1; crBand[u] = band; } };
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      if (!canon(i, j)) continue;
      const e = CM.e(i, j), band = e >= 0 ? 2 : e >= -2 ? 1 : 0;
      const hill = !band && e < -5.5 && dist2(i, j, ccx, ccy) > 81 && !nearLane(i, j) && fbm(i / 4.5, j / 4.5, sHill, 2) > thr;
      lay(id(i, j), band ? CR_TOP - 2 + band : hill ? 1 : 0, band);
    }
    // Every drop off a top is a single level: lowland right beside one (where the outline wobbles in) joins the terrace.
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const t = id(i, j);
      if (!canon(i, j) || crBand[t]) continue;
      let top = false;
      orth(t, (u) => { if (crBand[u] === 2) top = true; });
      if (top) lay(t, CR_TOP - 1, 1);
    }
  }

  // Three players, the planet in thirds: how far tile (i, j) of player 0's third is from the nearer of its two
  // sides (the lines at 30° and 150° out from the middle).
  const S3 = 0.8660254037844386;
  const sideD = (i, j) => { const dx = i - ccx, dy = j - ccy; return Math.min(Math.abs(0.5 * dx - S3 * dy), Math.abs(0.5 * dx + S3 * dy)); };
  // (Any tile: turned into player 0's third first.)
  const inThird0 = (i, j) => { const k = sector(i, j); return k ? rot(i, j, -k) : [i, j]; };
  // A straight way, three tiles wide, from (x0, y0) toward (x1, y1) as far as `stop` tiles short of it: crags and
  // water on it become open ground (player 0's third only; the turn lays it on the others).
  const clearWay = (x0, y0, x1, y1, stop) => {
    const d = dist(x0, y0, x1, y1);
    for (let s = 0; s <= d - stop; s += 0.5) {
      const x = x0 + ((x1 - x0) * s) / d, y = y0 + ((y1 - y0) * s) / d;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const i = Math.round(x) + di, j = Math.round(y) + dj, t = id(i, j);
        if (i >= 1 && j >= 1 && i < W - 1 && j < H - 1 && canon(i, j) && terrain[t] !== T_GROUND) { terrain[t] = T_GROUND; res[t] = R_NONE; fert[t] = 0; }
      }
    }
  };
  // Nothing grows or lies within `w` tiles of the line from the base to the middle, between r0 and r1 tiles from the
  // middle (player 0's third): where the ramps up or down go, so laying them takes the same from every third.
  const clearRes = (r0, r1, w) => {
    const d = dist(bx, by, ccx, ccy), ux = (ccx - bx) / d, uy = (ccy - by) / d;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const r = dist(i, j, ccx, ccy);
      if (!canon(i, j) || r < r0 || r > r1 || Math.abs((i - bx) * uy - (j - by) * ux) > w) continue;
      res[id(i, j)] = R_NONE; fert[id(i, j)] = 0;
    }
  };
  // The Wheel (three players): a raised hub in the middle (the richest fields, the only ground on the top level),
  // a terrace a level down round it, rock spokes from the hub's cliff out along the lines between the thirds, and a
  // rim road of open ground round the outside where the spokes stop. Everything else is kept below the hub (stepping
  // down at most a level a tile from the terrace, so smoothing can't wear it away). One ramp up to the hub from each
  // third (set in step 6).
  const rHub = Math.max(4.5, discR * 0.24), rRing = rHub + 2.5, rimW = 5;
  if (SH.wheel && np === 3) {
    const top = L - 1, mid = L - 2, sW = seed * 61 + 17, low = new Int8Array(N).fill(-1), q = [];
    clearWay(bx, by, ccx, ccy, rRing - 0.5); // the way from the base to the terrace below the hub
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      if (!canon(i, j)) continue;
      const t = id(i, j), r = dist(i, j, ccx, ccy);
      if (r <= rHub) { terrain[t] = T_GROUND; elev[t] = top; minE[t] = top; continue; }
      if (r < discR - rimW && sideD(i, j) < 1.4 + 0.8 * fbm(i / 3, j / 3, sW, 2)) { terrain[t] = T_ROCK; res[t] = R_NONE; fert[t] = 0; continue; }
      if (r >= discR - rimW && terrain[t] !== T_GROUND) { terrain[t] = T_GROUND; res[t] = R_NONE; fert[t] = 0; }
      if (r <= rRing) { terrain[t] = T_GROUND; elev[t] = mid; minE[t] = mid; low[t] = mid; q.push(t); }
      else elev[t] = Math.min(elev[t], mid);
    }
    for (let h = 0; h < q.length; h++) {
      orth(q[h], (u) => {
        if (!canon(u % W, (u / W) | 0) || low[u] >= low[q[h]] - 1) return;
        low[u] = low[q[h]] - 1;
        if (elev[u] < low[u]) elev[u] = low[u];
        minE[u] = Math.max(minE[u], low[u]);
        if (low[u] > 0) q.push(u);
      });
    }
    // The hub's riches (its third of them: the turn lays the rest).
    const cr = makeRng(seed ^ 0x3e1f9b);
    stampRes(cr, ccx - 2.4, ccy + 2.6, 1.3, R_ORE, 0.85);
    stampRes(cr, ccx + 2.4, ccy + 2.6, 1.2, R_CRYSTAL, 0.85);
    if (cfg.nuke) putRes(id(Math.round(ccx + 1), Math.round(ccy + 4)), R_URANIUM);
    clearRes(rHub - 1.5, rRing + 1, 2);
    symmetrize();
  }
  // Three Mesas (three players): each colony on a tall mesa (level 3) that fills most of its third, with terraces a
  // level and two levels down round its edge and the canyon floor (level 0) below: a basin in the middle, holding the
  // riches, and a narrow canyon along each line between the thirds, where the mesas come within a Viaduct's span
  // of each other. One way down off each mesa, toward the basin (set in step 6).
  const MESA = 3, mesaGap = 4.5, rBasin = discR * 0.45;
  const mesaE = (i, j) => { const [x, y] = inThird0(i, j); return Math.min(sideD(x, y) - mesaGap, dist(x, y, ccx, ccy) - rBasin); };
  if (SH.mesas && np === 3) {
    clearWay(bx, by, ccx, ccy, rBasin - 5); // the way down to the basin
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      if (!canon(i, j)) continue;
      const t = id(i, j), e = mesaE(i, j), lv = e >= 0 ? MESA : e >= -2 ? MESA - 1 : e >= -3.5 ? MESA - 2 : 0;
      elev[t] = lv; minE[t] = lv;
    }
    const cr = makeRng(seed ^ 0x5a3e17), rIn = rBasin - 4.5;
    stampRes(cr, ccx - rIn * 0.42, ccy + rIn * 0.38, 1.7, R_ORE, 0.85);
    stampRes(cr, ccx + rIn * 0.42, ccy + rIn * 0.38, 1.5, R_CRYSTAL, 0.85);
    stampRes(cr, ccx + rIn * 0.62, ccy + rIn * 0.05, 1.4, R_BOULDER, 0.8);
    stampRes(cr, ccx - rIn * 0.62, ccy + rIn * 0.05, 1.8, F_FERTILE, 0.8);
    if (cfg.nuke) putRes(id(Math.round(ccx), Math.round(ccy + rIn * 0.5)), R_URANIUM);
    clearRes(rBasin - 5, rBasin + 1.5, 2.5);
    symmetrize();
  }
  // Twin Valleys (four players): a mountain spine down the middle of the planet splits it into a west valley (the
  // colonies in the bottom-left and top-left corners) and an east one, crossed only by two passes, a south one and its
  // twin in the north, with rich fields at both ends of each. Laid after the quarters are turned (it is only
  // symmetric under the half turn), with the ways from each base to the passes, and up its valley, kept open.
  if (SH.twin && quad) {
    const sT = seed * 59 + 31, pass = Math.round(hw * 0.45), spine = new Uint8Array(N);
    const th = (j) => 2 + (fbm(3.5, Math.min(j, H - 1 - j) / 3, sT, 2) > 0.55 ? 1 : 0); // half its width (the same at the twin row)
    const inPass = (j) => Math.abs(j - (hw + pass)) <= 1 || Math.abs(j - (hw - 1 - pass)) <= 1;
    for (let j = 0; j < H; j++) for (let i = hw - th(j); i <= hw - 1 + th(j); i++) {
      const t = id(i, j);
      if (inPass(j)) { terrain[t] = T_GROUND; res[t] = R_NONE; fert[t] = 0; continue; }
      terrain[t] = T_ROCK; res[t] = R_NONE; fert[t] = 0; spine[t] = 1;
    }
    // The cheapest way by land from tile s to tile g (never through the spine), opened up where it isn't ground,
    // with its twin.
    const carve = (s, g) => {
      const cost = new Float64Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), heap = new MinHeap();
      cost[s] = 0; heap.push(s, 0);
      while (heap.size) {
        const t = heap.pop();
        if (t === g) break;
        orth(t, (u) => { if (spine[u]) return; const c = cost[t] + (terrain[u] === T_GROUND ? 1 : 25); if (c < cost[u]) { cost[u] = c; from[u] = t; heap.push(u, c); } });
      }
      if (from[g] < 0) return;
      for (let t = g; t >= 0; t = from[t]) {
        for (const u of [t, mir(t)]) if (terrain[u] !== T_GROUND) { terrain[u] = T_GROUND; res[u] = R_NONE; fert[u] = 0; }
        if (t === s) break;
      }
    };
    // (To the passes' own west ends, so the twins reach their east ends.)
    const sw = id(hw - th(hw + pass), hw + pass), nw = id(hw - th(hw - 1 - pass), hw - 1 - pass), tl = bases[1];
    carve(id(bx, by), sw); carve(id(tl.x, tl.y), nw); carve(id(bx, by), id(tl.x, tl.y));
    // Rich fields at the west end of each pass (and, by the half turn, the east end of the other).
    const cr = makeRng(seed ^ 0x2b7d41);
    const stamp = (x, y, rad, type, fill) => {
      for (let j = Math.floor(y - rad); j <= Math.ceil(y + rad); j++) for (let i = Math.floor(x - rad); i <= Math.ceil(x + rad); i++) {
        const t = id(i, j);
        if (i < 1 || j < 1 || i >= W - 1 || j >= H - 1 || dist2(i, j, x, y) > rad * rad || cr() >= fill) continue;
        for (const u of [t, mir(t)]) if (terrain[u] === T_GROUND && !spine[u]) { res[u] = type; fert[u] = 0; }
      }
    };
    for (const pj of [hw + pass, hw - 1 - pass]) {
      const x = hw - th(pj) - 3.5, up = pj < hw ? -1 : 1;
      stamp(x - 1, pj + up * 3, 1.4, R_ORE, 0.85);
      stamp(x - 1, pj - up * 3, 1.3, R_CRYSTAL, 0.85);
      stamp(x - 4, pj, 1.0, R_OIL, 0.9);
    }
  }

  // 6) Shape the levels into clean terraces, then connect them with ramps.
  if (L > 1 && !SH.grandCanyon) {
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
    const smooth = () => {
      for (let changed = true; changed;) {
        changed = false;
        for (let t = 0; t < N; t++) {
          if (!ground(t)) continue;
          let m = elev[t];
          orth(t, (u) => { if (ground(u) && elev[u] + 1 < m) m = elev[u] + 1; });
          if (m < elev[t]) { elev[t] = m; changed = true; }
        }
      }
    };
    smooth();
    // Three players: the specks and slopes above came out a little differently in each third (a patch just under the
    // size limit in one, just over it in another), so player 0's third is turned onto the others again.
    if (np === 3) { symmetrize(); smooth(); }
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
        // (The key is the same for a tile pair and its twins, so they sort together.)
        const ot = orbit(t), k = ot.indexOf(Math.min(...ot)), ct = ot[k], cu = orbit(u)[k];
        cands.push({ t, u, key: hash2(ct, cu - ct + 3 * W, seed) });
      });
    }
    cands.sort((a, b) => a.key - b.key || a.t - b.t);
    const addRamp = (t, u) => {
      const ou = orbit(u);
      for (const [n, a] of orbit(t).entries()) {
        const b = ou[n];
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
            for (const v of orbit(t2)) { ramp[v] = 1; res[v] = R_NONE; }
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
    // (The Wheel, Three Mesas and Crossroads lay their own too.)
    if (SH.crater || SH.plateau || SH.wheel || SH.mesas || SH.cross) {
      const keep = ramp.slice();
      const set = (t) => { ramp[t] = 1; res[t] = R_NONE; if (np === 2) { ramp[mir(t)] = 1; res[mir(t)] = R_NONE; } };
      // The lower tile of a cliff step on ray (x0,y0) → angle a, from `inside` to outside.
      const rayRamp = (x0, y0, a, inside) => {
        let prev = -1;
        for (let k = 0; k < 30; k++) {
          const i = Math.round(x0 + dcos(a) * k), j = Math.round(y0 + dsin(a) * k);
          if (i < 1 || j < 1 || i >= W - 1 || j >= H - 1) return false;
          let t = id(i, j);
          if (prev >= 0 && !inside(i, j)) {
            // The ray can leave past a corner of the cliff (a diagonal step): a slope there would climb nothing, so the
            // step is taken in two, through whichever of the two tiles between has the cliff on one side.
            if (Math.abs(t - prev) !== 1 && Math.abs(t - prev) !== W) {
              let ok = false;
              for (const m of [id(i, (prev / W) | 0), id(prev % W, j)]) {
                const [p, q] = inside(m % W, (m / W) | 0) ? [m, t] : [prev, m];
                if (!ground(p) || !ground(q) || Math.abs(elev[p] - elev[q]) !== 1) continue;
                prev = p; t = q; ok = true;
                break;
              }
              if (!ok) return false;
            }
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
      if (SH.wheel) {
        // Clear the ramps on the hub's cliff, then lay one up to it from each third (from the hub out toward its base).
        const hub = (i, j) => dist2(i, j, ccx, ccy) <= rHub * rHub;
        for (let t = 0; t < N; t++) {
          if (!ramp[t]) continue;
          let edge = false;
          orth(t, (u) => { if (hub(u % W, (u / W) | 0) && elev[u] === elev[t] + 1) edge = true; });
          if (edge) ramp[t] = 0;
        }
        for (const b of bases) tryRamp(ccx, ccy, datan2(b.y - ccy, b.x - ccx), hub);
      } else if (SH.mesas) {
        // The canyon floor is all one level, so every cliff is a mesa's: clear them all and lay one way down off
        // each mesa, a ramp at each step from its base straight toward the basin (two tiles wide where it can).
        ramp.fill(0);
        for (const b of bases) {
          let a = id(b.x, b.y), x = b.x, y = b.y;
          const d = dist(b.x, b.y, ccx, ccy), ux = (ccx - b.x) / d, uy = (ccy - b.y) / d, sx = Math.sign(ux), sy = Math.sign(uy);
          const off = (px, py) => Math.abs((px - b.x) * uy - (py - b.y) * ux); // how far (px, py) is off the straight line
          for (let n = 0; n < 4 * d && elev[a] > 0; n++) {
            // A step along the way, across or down, whichever keeps nearer the straight line.
            if (sx && (!sy || off(x + sx, y) < off(x, y + sy))) x += sx; else y += sy;
            const t = id(x, y);
            if (!ground(t) || elev[t] > elev[a] || elev[t] < elev[a] - 1) break;
            if (elev[t] === elev[a] - 1) {
              ramp[t] = 1; res[t] = R_NONE;
              // A second lane: a tile beside it on the same level, under the same step (straight across first).
              const side = Math.abs(t - a) === 1 ? W : 1, up = (v) => { let ok = false; orth(v, (w) => { if (ground(w) && elev[w] === elev[t] + 1) ok = true; }); return ok; };
              for (const v of [t + side, t - side, t + (t - a), t - (t - a)]) if (v >= 0 && v < N && v !== a && ground(v) && !ramp[v] && elev[v] === elev[t] && Math.abs((v % W) - (t % W)) <= 1 && up(v)) { ramp[v] = 1; res[v] = R_NONE; break; }
            }
            a = t;
          }
        }
      } else if (SH.cross) {
        // Crossroads: clear every ramp on a mesa's cliffs (on its terrace, or at the terrace's foot), then cut its three
        // slopes (see CM), each three lanes wide with a ramp at both steps, on player 0's part with their twins.
        for (let t = 0; t < N; t++) {
          if (!ramp[t]) continue;
          let cliff = crBand[t] === 1;
          if (!crBand[t]) orth(t, (u) => { if (crBand[u] === 1) cliff = true; });
          if (cliff) ramp[t] = 0;
        }
        const setR = (t) => { for (const u of orbit(t)) { ramp[u] = 1; res[u] = R_NONE; } };
        // A lane straight down off a face, from (i, j) on the top: a ramp at the foot of each step, down to the lowland.
        const lane = (i, j, di, dj) => {
          for (let n = 0, a = id(i, j); n < 14; n++) {
            i += di; j += dj;
            if (i < 0 || j < 0 || i >= W || j >= H) return;
            const t = id(i, j);
            if (!ground(a) || !ground(t) || elev[t] > elev[a]) return;
            if (elev[t] === elev[a] - 1) setR(t);
            if (!crBand[t] && elev[t] === 0) return;
            a = t;
          }
        };
        // Is tile t at the foot of a step up onto a tile at level lv (of the mesa: its top, or its terrace)?
        const under = (t, lv) => { let up = false; orth(t, (u) => { if (ground(u) && elev[u] === lv && crBand[u]) up = true; }); return up; };
        for (const m of CM.ms) {
          for (let k = -1; k <= 1; k++) lane(m.xc - m.ex * 3, m.row + k, m.ex, 0);
          for (let k = -1; k <= 1; k++) lane(m.col + k, m.yc + 3, 0, -1);
          // Off the rounded corner, toward the plaza: at each step down the cliff, the tiles at its foot within a
          // lane-and-a-half of the line from the corner's centre out (the three nearest, where the cliff runs so that
          // fewer are).
          const r = m.rc + 6, steps = [[], []];
          for (let j = Math.floor(m.oy - r); j <= Math.ceil(m.oy + r); j++) for (let i = Math.floor(m.ox - r); i <= Math.ceil(m.ox + r); i++) {
            if (i < 0 || j < 0 || i >= W || j >= H || !canon(i, j)) continue;
            const t = id(i, j), s = (i - m.ox) * m.dx + (j - m.oy) * m.dy, p = Math.abs((j - m.oy) * m.dx - (i - m.ox) * m.dy);
            if (p > 2.6 || s < m.rc - 4 || !ground(t)) continue;
            if (crBand[t] === 1 && elev[t] === CR_TOP - 1 && under(t, CR_TOP)) steps[0].push({ t, p });
            else if (!crBand[t] && elev[t] === CR_TOP - 2 && under(t, CR_TOP - 1)) steps[1].push({ t, p });
          }
          for (const st of steps) st.sort((a, b) => a.p - b.p || a.t - b.t).forEach((c, k) => { if (c.p <= 1.3 || k < 3) setR(c.t); });
        }
      } else if (SH.crater) {
        // Clear every ramp onto the floor (on the floor, or on the rim right beside it).
        for (let t = 0; t < N; t++) {
          if (!ramp[t]) continue;
          let onto = crEdge(t % W, (t / W) | 0) >= 2;
          orth(t, (u) => { if (crEdge(u % W, (u / W) | 0) >= 2 && elev[u] + 1 === elev[t]) onto = true; });
          if (onto) ramp[t] = 0;
        }
        // From the floor's centre out toward player 0's base (and its mirror toward player 1's).
        if (np === 2) tryRamp(ccx, ccy, datan2(by - ccy, bx - ccx), (i, j) => crEdge(i, j) >= 2);
        else for (const b of bases) tryRamp(ccx, ccy, datan2(b.y - ccy, b.x - ccx), (i, j) => crEdge(i, j) >= 2);
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
    // Three players: the ramps the same in every third. Those in player 0's third are turned onto the other two
    // (each onto the nearest tile at the foot of the same step) and the others dropped; then any ground that loses its
    // way up or down gets one back, the same in every third. (Laid one by one above, each third came out with its own
    // ramps: one colony could have half as many ways up as another.)
    if (np === 3) {
      const before = reachable(true), keep3 = ramp.slice();
      const foot = (q, lv) => { let up = false; orth(q, (u) => { if (ground(u) && elev[u] === lv + 1) up = true; }); return up; };
      const turned = (t, k) => {
        const i = t % W, j = (t / W) | 0, [x, y] = rot(i, j, k);
        let best = -1, bd = 7; // (within two tiles or so: the turned ground can sit a tile off)
        for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) {
          const u = Math.round(x) + di, v = Math.round(y) + dj;
          if (u < 0 || v < 0 || u >= W || v >= H) continue;
          const q = id(u, v), d = dist2(u, v, x, y);
          if (ground(q) && elev[q] === elev[t] && foot(q, elev[t]) && d < bd) { bd = d; best = q; }
        }
        return best;
      };
      const in0 = (t) => sector(t % W, (t / W) | 0) === 0;
      const place3 = (t) => { for (const q of [t, turned(t, 1), turned(t, 2)]) if (q >= 0) { ramp[q] = 1; res[q] = R_NONE; } };
      for (let t = 0; t < N; t++) if (!in0(t)) ramp[t] = 0;
      for (let t = 0; t < N; t++) if (keep3[t] && in0(t)) place3(t);
      let after = reachable(true);
      for (let pass = 0; pass < 6; pass++) {
        let fixed = false;
        for (let t = 0; t < N && !fixed; t++) {
          if (!ground(t)) continue;
          orth(t, (u) => {
            if (fixed || !ground(u) || elev[u] !== elev[t] + 1 || after[t] === after[u] || !(before[t] && before[u])) return;
            // (t, at the foot of the step, turned into player 0's third: a ramp there and its two twins)
            const k = sector(t % W, (t / W) | 0), t0 = k ? turned(t, 3 - k) : t;
            if (t0 >= 0 && !ramp[t0]) { place3(t0); fixed = true; }
          });
        }
        if (!fixed) break;
        after = reachable(true);
      }
      // Still cut off somewhere (the thirds' ground differs by a tile here and there): the old ramp that joins it back,
      // one at a time; failing that, the ramps as they were.
      for (let pass = 0; pass < 12; pass++) {
        let fixed = false;
        for (let t = 0; t < N && !fixed; t++) {
          if (!keep3[t] || ramp[t]) continue;
          orth(t, (u) => { if (!fixed && ground(u) && Math.abs(elev[u] - elev[t]) === 1 && after[t] !== after[u] && before[t] && before[u]) { ramp[t] = 1; fixed = true; } });
        }
        if (!fixed) break;
        after = reachable(true);
      }
      for (let t = 0; t < N; t++) if (before[t] && !after[t]) { ramp.set(keep3); break; }
    }
    // Safety net: if the bases still can't reach each other, flatten the map (Islands are joined
    // by bridges, not land).
    if (!SH.islands && !joinedAll(true)) { elev.fill(baseLevel); ramp.fill(0); }
  } else if (!SH.grandCanyon) {
    elev.fill(0);
  }

  // Islands: specks of land too small to hold anything (left by the shoreline's wobble) go under.
  if (SH.islands && !SH.sky) {
    const lab = new Int32Array(N).fill(-1);
    for (let t = 0; t < N; t++) {
      if (terrain[t] === T_WATER || lab[t] >= 0) continue;
      const q = [t];
      lab[t] = t;
      for (let h = 0; h < q.length; h++) orth(q[h], (u) => { if (lab[u] < 0 && terrain[u] !== T_WATER) { lab[u] = t; q.push(u); } });
      if (q.length < 8 && !q.some((u) => bases.some((b) => id(b.x, b.y) === u))) for (const u of q) { terrain[u] = T_WATER; res[u] = R_NONE; fert[u] = 0; ramp[u] = 0; }
    }
  }
  // Four Isles in a team game: a sandbar joins allies' islands, two tiles wide, from the bottom-left island straight
  // up to the top-left one (its twin, by the half turn, joins the right-hand pair): shallow water robots can wade
  // across (trucks need a bridge).
  if (SH.isles4 && quad && cfg.teams) {
    const tl = bases[1];
    for (const i of [bx, bx + 1]) for (let j = tl.y; j <= by; j++) {
      const t = id(i, j);
      if (terrain[t] === T_WATER) for (const u of [t, mir(t)]) { fordA[u] = 1; elev[u] = elev[id(bx, by)]; }
      else if (terrain[t] !== T_GROUND) for (const u of [t, mir(t)]) { terrain[u] = T_GROUND; res[u] = R_NONE; elev[u] = elev[id(bx, by)]; } // (a crag in the way)
    }
  }
  // Crossroads for three: the quarter beside you to the north (top left) has no one in it, and is rich.
  // The red rival lands across the plaza (it borders the free quarter too) and the green one beside you
  // to the east, so neither rival starts out with only you to fight.
  const spare = quad && cfg.players === 3 ? bases[1] : null;
  if (spare) {
    const cr = makeRng((seed ^ 0x3a7c51) >>> 0);
    const rich = [[R_ORE, 1.8], [R_CRYSTAL, 1.6], [R_OIL, 1.1], [F_FERTILE, 2.2], [R_BOULDER, 1.6], [R_ORE, 1.5], [R_CRYSTAL, 1.3]];
    const x0 = 3, x1 = hw - 4, y0 = 3, y1 = hw - 4;
    for (const [type, rad] of rich) {
      for (let tries = 0; tries < 60; tries++) {
        const x = x0 + cr() * (x1 - x0), y = y0 + cr() * (y1 - y0);
        if (terrain[id(Math.floor(x), Math.floor(y))] !== T_GROUND || dist2(x, y, spare.x, spare.y) < 9) continue;
        if (CM && crBand[id(Math.floor(x), Math.floor(y))] !== 2) continue; // (Crossroads: on the free mesa's top)
        for (let j = Math.floor(y - rad); j <= Math.ceil(y + rad); j++) for (let i = Math.floor(x - rad); i <= Math.ceil(x + rad); i++) {
          const t = id(i, j);
          if (quarter(i, j) !== 1 || dist2(i, j, x, y) > rad * rad || terrain[t] !== T_GROUND || ramp[t] || (CM && crBand[t] !== 2) || cr() >= (type === F_FERTILE ? 0.8 : 0.85)) continue;
          if (type === F_FERTILE) { fert[t] = 1; res[t] = R_NONE; } else { res[t] = type; fert[t] = 0; }
        }
        break;
      }
    }
  }
  // Richer deposits out towards the middle of the map, so pushing out pays.
  const ox = W - 1 - bx, oy = H - 1 - by, reach = Math.max(1, (np === 2 ? dist(bx, by, ox, oy) / 2 : dist(bx, by, ccx, ccy)) - RICH_FROM);
  for (let t = 0; t < N; t++) {
    if (!res[t]) continue;
    const i = t % W, j = (t / W) | 0;
    let d = Infinity;
    for (const b of bases) d = Math.min(d, dist(i, j, b.x, b.y));
    const rich = RICH_TYPES.includes(res[t]) ? 1 + FRONTIER_RICH * clamp((d - RICH_FROM) / reach, 0, 1) : 1;
    const canyonRich = SH.grandCanyon && elev[t] === 0 && (res[t] === R_ORE || res[t] === R_CRYSTAL) ? 1.5 : 1;
    amt[t] = clamp(Math.round(RES[res[t]].amount * RPR.amount * rich * canyonRich), 1, 255);
  }
  const grow = new Float32Array(N).fill(1);
  // Sky islands: no water anywhere. The islands are towering mesas (the middle one and the islets a
  // level higher than the home islands) standing over a canyon floor far below: real ground, at
  // least three levels down, with sheer drops all round and no slopes, so no Ramp can reach it (a
  // Ropeway can, for the few boulders and ore down there). Viaducts cross between the clifftops.
  // Small inland pools fill in as land.
  let floorMask = null; // Sky islands: the canyon floor (see below)
  if (SH.sky) {
    const wl = new Int32Array(N).fill(-1);
    for (let t = 0; t < N; t++) {
      if (terrain[t] !== T_WATER || wl[t] >= 0) continue;
      const q = [t];
      wl[t] = t;
      for (let h = 0; h < q.length; h++) orth(q[h], (u) => { if (wl[u] < 0 && terrain[u] === T_WATER) { wl[u] = t; q.push(u); } });
      if (q.length >= 40) continue;
      let lv = 99;
      for (const a of q) orth(a, (u) => { if (terrain[u] === T_GROUND) lv = Math.min(lv, elev[u]); });
      for (const a of q) { terrain[a] = T_GROUND; elev[a] = lv === 99 ? 0 : lv; res[a] = R_NONE; fert[a] = 0; ramp[a] = 0; }
    }
    const lab = new Int32Array(N).fill(-1), span = Math.min(W, H);
    for (let t = 0; t < N; t++) {
      if (terrain[t] === T_WATER || lab[t] >= 0) continue;
      const q = [t];
      lab[t] = t;
      let sx = 0, sy = 0;
      for (let h = 0; h < q.length; h++) { const a = q[h]; sx += a % W; sy += (a / W) | 0; orth(a, (u) => { if (lab[u] < 0 && terrain[u] !== T_WATER) { lab[u] = t; q.push(u); } }); }
      const cx = sx / q.length, cy = sy / q.length;
      const lift = dist(cx, cy, ccx, ccy) < span * 0.2 || q.length < 70 ? 4 : 3;
      // A small mesa is flat-topped (its most common level), so no part of it is cut off by a cliff.
      if (q.length < 140) {
        const n = {};
        for (const a of q) n[elev[a]] = (n[elev[a]] || 0) + 1;
        const lv = +Object.keys(n).sort((p, r) => n[r] - n[p])[0];
        for (const a of q) { elev[a] = lv; ramp[a] = 0; }
      }
      for (const a of q) elev[a] = Math.min(elev[a] + lift, 6);
    }
    const sd = (seed ^ 0x5c1) >>> 0, isFloor = new Uint8Array(N);
    floorMask = isFloor;
    for (let t = 0; t < N; t++) {
      if (terrain[t] !== T_WATER) continue;
      terrain[t] = T_GROUND; elev[t] = 0; ramp[t] = 0; res[t] = R_NONE; fert[t] = 0; isFloor[t] = 1;
    }
    // Every clifftop's edge stays clear of resources and crags, so a Viaduct can start from (or
    // land on) any rim: a crag on the edge becomes ground at the level of the mesa beside it, and a
    // resource moves a tile inland (or goes, if there's no room).
    const rim = new Uint8Array(N);
    for (let t = 0; t < N; t++) if (isFloor[t]) orth(t, (u) => { if (!isFloor[u]) rim[u] = 1; });
    // (Each change here depends on the ones before it, so with two players it is worked out on player 0's half and
    // made to each tile's twin as well: the map stays the same turned half round.)
    const twin = np === 2 ? (t) => [t, mir(t)] : (t) => [t];
    for (let u = np === 2 ? half * W : 0; u < N; u++) {
      if (!rim[u]) continue;
      if (terrain[u] === T_ROCK) {
        let lv = 99;
        orth(u, (v) => { if (!isFloor[v] && terrain[v] === T_GROUND && elev[v] >= 3) lv = Math.min(lv, elev[v]); });
        if (lv === 99) continue;
        for (const a of twin(u)) { terrain[a] = T_GROUND; elev[a] = lv; ramp[a] = 0; }
      }
      if (terrain[u] !== T_GROUND || !res[u]) continue;
      const ui = u % W, uj = (u / W) | 0;
      let to = -1, td = 99;
      for (let j = uj - 3; j <= uj + 3; j++) for (let i = ui - 3; i <= ui + 3; i++) {
        if (i < 1 || j < 1 || i >= W - 1 || j >= H - 1) continue;
        const v = j * W + i, d = dist2(i, j, ui, uj);
        if (d < td && !isFloor[v] && !rim[v] && terrain[v] === T_GROUND && !res[v] && !ramp[v] && elev[v] === elev[u]) { td = d; to = v; }
      }
      const from = twin(u), dest = to >= 0 ? twin(to) : [];
      from.forEach((a, k) => { if (to >= 0) { res[dest[k]] = res[a]; amt[dest[k]] = amt[a]; } res[a] = R_NONE; });
    }
    // The canyon floor isn't a flat plain: low rises a level up and rock formations, both kept clear
    // of the walls (so every drop stays sheer), plants (see makeDecor) and, very rarely, a boulder or
    // some ore (the same for both sides of the map).
    const fd = new Int16Array(N).fill(-1), fq = [];
    for (let t = 0; t < N; t++) if (!isFloor[t] && terrain[t] === T_GROUND) { fd[t] = 0; fq.push(t); }
    for (let h = 0; h < fq.length; h++) { const a = fq[h]; orth(a, (u) => { if (fd[u] < 0 && isFloor[u]) { fd[u] = fd[a] + 1; fq.push(u); } }); }
    for (let t = 0; t < N; t++) {
      if (!isFloor[t]) continue;
      const i = t % W, j = (t / W) | 0, m = Math.min(t, N - 1 - t), mi = m % W, mj = (m / W) | 0;
      const away = fd[t] < 0 ? 99 : fd[t];
      if (away >= 2 && fbm(mi / 2.6, mj / 2.6, sd + 11, 2) > 0.72) { terrain[t] = T_ROCK; continue; }
      if (away >= 3 && fbm(mi / 6, mj / 6, sd + 23, 2) > 0.58) elev[t] = 1;
      const h = hash2(mi, mj, sd);
      if (h < 0.006) { res[t] = h < 0.002 ? R_ORE : R_BOULDER; amt[t] = clamp(Math.round(RES[res[t]].amount * RPR.amount), 1, 255); }
    }
    // The canyons cut away part of each base's fields: every home mesa is topped up to a working
    // minimum of Ore and Crystal, a compact field a few tiles out from the base (the same for every side).
    for (const bs of bases) {
      const b0 = id(Math.round(bs.x), Math.round(bs.y)), mesa = new Uint8Array(N), q = [b0];
      mesa[b0] = 1;
      for (let h = 0; h < q.length; h++) orth(q[h], (u) => { if (!mesa[u] && !isFloor[u] && terrain[u] !== T_WATER) { mesa[u] = 1; q.push(u); } });
      const free = (t) => mesa[t] && !rim[t] && terrain[t] === T_GROUND && !res[t] && !ramp[t] && elev[t] === elev[b0];
      const sym = (t) => { const m = Math.min(t, N - 1 - t); return hash2(m % W, (m / W) | 0, sd + 41); };
      for (const [r, want] of [[R_ORE, 10], [R_CRYSTAL, 8]]) {
        let have = 0;
        for (const t of q) if (res[t] === r) have++;
        if (have >= want) continue;
        const ring = q.filter((t) => { const d = dist(t % W, (t / W) | 0, bs.x, bs.y); return d >= 5 && d <= 7.5 && free(t); });
        if (!ring.length) continue;
        ring.sort((a, c) => sym(a) - sym(c));
        const c0 = ring[0], cx = c0 % W, cy = (c0 / W) | 0;
        const near = q.filter((t) => free(t) && dist(t % W, (t / W) | 0, bs.x, bs.y) >= 3.5)
          .sort((a, c) => (dist2(a % W, (a / W) | 0, cx, cy) - dist2(c % W, (c / W) | 0, cx, cy)) || (sym(a) - sym(c)));
        for (let k = 0; k < near.length && have < want; k++, have++) { res[near[k]] = r; amt[near[k]] = clamp(Math.round(RES[r].amount * RPR.amount), 1, 255); }
      }
    }
    // Half the resource fields fall into the canyons: what's left on the mesas holds more.
    for (let t = 0; t < N; t++) if (!isFloor[t] && SKY_RICH.includes(res[t])) amt[t] = clamp(Math.round(amt[t] * SKY_RES_MUL), 1, 255);
  }
  // Island maps: Cement is made from Stone alone, and every crossing to more land costs Cement, so
  // each home island (or mesa) is topped up to HOME_STONE near the base: a compact boulder field on
  // free, level ground a few tiles out, placed the same way for every side (by distance from the base
  // and angle from the way to the middle of the map).
  if (SH.islands) {
    const per = clamp(Math.round(RES[R_BOULDER].amount * RPR.amount * (SH.sky ? SKY_RES_MUL : 1)), 1, 255);
    const target = Math.round(HOME_STONE * RPR.amount);
    for (const bs of bases) {
      const b0 = id(Math.round(bs.x), Math.round(bs.y)), land = new Uint8Array(N), q = [b0];
      land[b0] = 1;
      for (let h = 0; h < q.length; h++) orth(q[h], (u) => { if (!land[u] && terrain[u] !== T_WATER && !(floorMask && floorMask[u])) { land[u] = 1; q.push(u); } });
      let have = 0;
      for (const t of q) if (res[t] === R_BOULDER) have += amt[t];
      if (have >= target) continue;
      const level = (t) => { let ok = true; orth(t, (u) => { if (!land[u] || terrain[u] !== T_GROUND || elev[u] !== elev[t]) ok = false; }); return ok; };
      const free = (t) => land[t] && terrain[t] === T_GROUND && !res[t] && !ramp[t] && !fert[t] && elev[t] === elev[b0] && level(t) &&
        dist(t % W, (t / W) | 0, bs.x, bs.y) >= 4;
      // Each tile's place relative to the base, turned so the way to the middle of the map is +x: the
      // same for every side, so ties are broken the same way everywhere and the map stays symmetric.
      const a0 = datan2(ccy - bs.y, ccx - bs.x), ca = dcos(-a0), sa = dsin(-a0);
      const rel = (t) => { const dx = (t % W) - bs.x, dy = ((t / W) | 0) - bs.y; return [Math.round((dx * ca - dy * sa) * 100), Math.round((dx * sa + dy * ca) * 100)]; };
      const before = (a, b) => { const ra = rel(a), rb = rel(b); return ra[0] - rb[0] || ra[1] - rb[1]; };
      const side = (t) => { const r = rel(t); return Math.abs(Math.abs(datan2(r[1], r[0])) - Math.PI / 2); };
      // The field's centre: the free tile 5 to 9 out with the most free ground round it, off to the side.
      let c = -1, cs = -Infinity;
      for (const t of q) {
        const d = dist(t % W, (t / W) | 0, bs.x, bs.y);
        if (d < 5 || d > 9 || !free(t)) continue;
        let room = 0;
        for (const u of q) if (free(u) && dist2(u % W, (u / W) | 0, t % W, (t / W) | 0) <= 5) room++;
        const sc = Math.round((room * 10 - side(t) * 3 - Math.abs(d - 6.5)) * 1000);
        if (sc > cs || (sc === cs && before(t, c) < 0)) { cs = sc; c = t; }
      }
      if (c < 0) continue;
      const cx = c % W, cy = (c / W) | 0;
      const spots = q.filter(free).sort((a, b) => (dist2(a % W, (a / W) | 0, cx, cy) - dist2(b % W, (b / W) | 0, cx, cy)) || before(a, b));
      for (let k = 0; k < spots.length && have < target; k++) { res[spots[k]] = R_BOULDER; amt[spots[k]] = per; have += per; }
    }
  }
  // Fault line: once the fault opens, each base must still reach both arches. A level way is laid from
  // the base to each arch's near end (round the fault, never over it), cutting through crags and cliffs
  // if it has to, with its twin from the other base to the arches' far ends.
  if (faultInfo && np === 2) {
    const ends = [];
    for (const c of faultInfo.arches) {
      let lo = -1, hi = H;
      for (let j = 0; j < H; j++) if (Math.abs(j + 0.5 - half - faultInfo.f(c)) <= faultInfo.hw(c)) { lo = Math.max(lo, j); hi = Math.min(hi, j); }
      if (lo >= 0) ends.push(id(c, Math.min(H - 1, lo + 1)));
    }
    for (const goal of ends) {
      const start = id(bx, by), cost = new Float64Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), heap = new MinHeap();
      cost[start] = 0; heap.push(start, 0);
      while (heap.size) {
        const t = heap.pop();
        if (t === goal) break;
        orth(t, (u) => {
          if (faultA[u]) return;
          const c = cost[t] + (terrain[u] === T_GROUND ? (elev[u] === baseLevel ? 1 : 4) : terrain[u] === T_ROCK ? 9 : 12);
          if (c < cost[u]) { cost[u] = c; from[u] = t; heap.push(u, c); }
        });
      }
      if (from[goal] < 0) continue;
      for (let t = goal; t >= 0; t = from[t]) {
        for (const u of [t, mir(t)]) { terrain[u] = T_GROUND; elev[u] = baseLevel; ramp[u] = 0; res[u] = R_NONE; amt[u] = 0; fert[u] = 0; }
        if (t === start) break;
      }
    }
    // The arches themselves: level ground.
    for (const c of faultInfo.arches) for (const i of [c, c + 1]) for (let j = 0; j < H; j++) {
      if (Math.abs(j + 0.5 - half - faultInfo.f(i)) > faultInfo.hw(i) + 1) continue;
      const t = id(i, j);
      if (!faultA[t]) for (const u of [t, mir(t)]) { terrain[u] = T_GROUND; elev[u] = baseLevel; ramp[u] = 0; res[u] = R_NONE; }
    }
  }
  // Tidal flats: sandbars join the islands, laid like the cheapest set of links that joins them all
  // (shortest first), each 2 tiles wide and laid with its twin. They're sea at high tide and sand at low
  // tide (see updateTide); nothing can be built on them.
  if (SH.tidal) {
    const comp = new Int32Array(N).fill(-1), coasts = [];
    // (Open ground only: a sandbar never runs ashore onto crags.)
    for (let t = 0; t < N; t++) {
      if (terrain[t] !== T_GROUND || comp[t] >= 0) continue;
      const c = coasts.length, q = [t], coast = [];
      comp[t] = c;
      for (let h = 0; h < q.length; h++) {
        let shore = false;
        orth(q[h], (u) => { if (terrain[u] === T_WATER) shore = true; else if (terrain[u] === T_GROUND && comp[u] < 0) { comp[u] = c; q.push(u); } });
        if (shore) coast.push(q[h]);
      }
      coasts.push(q.length >= 6 ? coast : []);
    }
    const edges = [];
    for (let a1 = 0; a1 < coasts.length; a1++) for (let b1 = a1 + 1; b1 < coasts.length; b1++) {
      let best = Infinity, ta = -1, tb = -1;
      for (const u of coasts[a1]) for (const v of coasts[b1]) {
        const d = dist2(u % W, (u / W) | 0, v % W, (v / W) | 0);
        if (d < best || (d === best && u + v < ta + tb)) { best = d; ta = u; tb = v; }
      }
      if (ta >= 0) edges.push({ a: a1, b: b1, d: best, ta, tb });
    }
    edges.sort((e1, e2) => e1.d - e2.d || e1.ta - e2.ta);
    const parent = coasts.map((_, k) => k), find = (k) => { while (parent[k] !== k) k = parent[k] = parent[parent[k]]; return k; };
    const trng = makeRng(seed ^ 0x7d1de);
    const bar = (ta, tb) => {
      let x = ta % W, y = (ta / W) | 0;
      const ex = tb % W, ey = (tb / W) | 0;
      for (let k = 0; k < 200 && (Math.round(x) !== ex || Math.round(y) !== ey); k++) {
        const d = dist(x, y, ex, ey);
        x += (ex - x) / d * 0.6 + (trng() - 0.5) * 0.35; y += (ey - y) / d * 0.6 + (trng() - 0.5) * 0.35;
        const i = Math.round(x), j = Math.round(y);
        for (const [di, dj] of [[0, 0], [1, 0], [0, 1]]) {
          const u = i + di, v = j + dj;
          if (u >= 0 && v >= 0 && u < W && v < H && terrain[id(u, v)] === T_WATER) flag(tidalA, id(u, v));
        }
      }
    };
    for (const e of edges) {
      const ra = find(e.a), rb = find(e.b);
      if (ra === rb) continue;
      parent[ra] = rb;
      bar(e.ta, e.tb);
      // Its twin joins the twin islands, so join those in the union too.
      const ma = comp[mir(e.ta)], mb = comp[mir(e.tb)];
      if (ma >= 0 && mb >= 0) { const r1 = find(ma), r2 = find(mb); if (r1 !== r2) parent[r1] = r2; }
    }
    for (let t = 0; t < N; t++) if (tidalA[t]) { res[t] = R_NONE; amt[t] = 0; elev[t] = 0; }
  }
  for (let t = 0; t < N; t++) {
    if (terrain[t] !== T_GROUND) fert[t] = 0;
    if (terrain[t] !== T_WATER) { lavaA[t] = 0; fordA[t] = 0; tidalA[t] = 0; }
    if (faultA[t] && terrain[t] === T_GROUND) { res[t] = R_NONE; amt[t] = 0; fert[t] = 0; }
  }
  // Lava rivers and fords sit level with their banks.
  for (let t = 0; t < N; t++) {
    if (!fordA[t]) continue;
    let lv = -1;
    orth(t, (u) => { if (terrain[u] === T_GROUND && (lv < 0 || elev[u] < lv)) lv = elev[u]; });
    if (lv >= 0) elev[t] = lv;
  }
  // The volcano's slopes hold the planet's richest deposits.
  if (volcanoAt) for (let t = 0; t < N; t++) {
    if (!res[t] || dist(t % W, (t / W) | 0, ccx, ccy) > volcanoAt.r) continue;
    if (RICH_TYPES.includes(res[t])) amt[t] = clamp(Math.round(amt[t] * 1.6), 1, 255);
  }
  const any = (arr) => { for (let t = 0; t < N; t++) if (arr[t]) return arr; return null; };
  return {
    terrain, res, amt, grow, elev, ramp, fert, bases: spare ? [bases[0], bases[2], bases[3]] : bases, spare, choke: choke ? chokeInfo.map((ts) => ts.slice()) : null,
    lava: any(lavaA), ford: any(fordA), tidal: any(tidalA), fault: any(faultA), volcano: volcanoAt,
  };
}

/* ------------------------------------------------------------------ the Hollow */

/**
 * The Hollow (SHAPE_PRESETS hollow; two colonies): the Murmur's cavern lair (LORE.md). Solid rock carved into caverns
 * joined by winding passages, laid out for player 0 (the bottom half) and turned half round onto player 1's: every
 * change is made to a tile and its twin together (put), so both sides are exactly the same.
 *   - A home cavern round each Command Base, under a breach (a shaft of daylight down through the cavern roof).
 *   - A chasm hall between home and the middle, split across by a chasm with one natural rock arch, and a mass of
 *     floating Crystal hanging in the chasm on a raised platform (reached by Ropeway, a sky bridge or a Viaduct).
 *   - A west and an east cavern off the home cavern: a black lake and a slow river in the west one; in the east one,
 *     from Medium up, another mass of floating Crystal. Each leads on to a flank cavern on the middle line, which holds
 *     two contested breaches (one nearer each colony).
 *   - The cathedral in the middle, where the Deep's mound stands in a ring of stone pillars, with Bloom veins and
 *     Crystal round it.
 *   - A side chamber off each side cavern, where robot parts (crates of Alloy and Chips) lie laid out in rows.
 *   - Smooth stone pillars (rock) standing in the caverns, Bloom veins on the floors and along the walls, oil seeps.
 * No stalk groves or fertile soil: nothing grows without light. Every cavern floor is one level; the Crystal masses
 * stand two levels up; the chasms drop away below. No Trade Posts or Uplinks: the Pathfinder never mapped the Hollow
 * (LORE.md). Returns what generateMap does, plus `hollow`: { breaches: [{x, y, r, home}], masses: [{x, y}], nests:
 * [{x, y}] (sites in twin pairs), deep: {x, y}, relics: [{x, y, goods}], pillars: [tile], chambers: [{x, y}] (the side
 * chambers' middles, for their art) }.
 */
function hollowMap(seed, W, H, cfg) {
  const RPR = RESOURCE_PRESETS[cfg.rich ?? DEFAULT_RICH];
  const N = W * H, half = Math.floor(H / 2), FLOOR = 1, MASS = 3;
  const terrain = new Uint8Array(N).fill(T_ROCK), res = new Uint8Array(N), amt = new Uint8Array(N), elev = new Uint8Array(N).fill(FLOOR);
  const ramp = new Uint8Array(N), fert = new Uint8Array(N), grow = new Float32Array(N).fill(1);
  // What each open tile belongs to (for placing things): 1 home, 2 the chasm hall, 3 a side cavern, 4 a flank cavern,
  // 5 the cathedral, 6 a passage, 7 a side chamber, 8 a floating Crystal mass.
  const kind = new Uint8Array(N), mass = new Uint8Array(N), pillar = new Uint8Array(N);
  const id = (i, j) => j * W + i, mir = (t) => N - 1 - t, inner = (i, j) => i >= 1 && j >= 1 && i < W - 1 && j < H - 1;
  const orth = (t, fn) => { const i = t % W; if (i > 0) fn(t - 1); if (i < W - 1) fn(t + 1); if (t >= W) fn(t - W); if (t + W < N) fn(t + W); };
  const cr = makeRng((seed ^ 0x4011a3) >>> 0), sW = seed * 67 + 5, sV = seed * 71 + 13;
  const ccx = (W - 1) / 2, ccy = (H - 1) / 2, bx = Math.floor(W / 2), by = H - 8, Dy = by - ccy;
  const sz = clamp(cfg.size ?? 1, 0, HOLLOW.nests.length - 1);
  const P = (u, v) => [u * (W - 1), ccy + v * Dy]; // a place on player 0's side: u across (0 west, 1 east), v from the middle line (0) to the base (1)
  // Every change to a tile is made to its twin too (the same spot turned half round, on player 1's side).
  const put = (t, terr, lv, k) => {
    for (const u of [t, mir(t)]) {
      terrain[u] = terr; res[u] = R_NONE; amt[u] = 0;
      if (lv !== undefined) elev[u] = lv;
      if (k !== undefined) kind[u] = k;
    }
  };
  const open = (i, j, k) => {
    if (!inner(i, j)) return;
    const t = id(i, j);
    if (terrain[t] === T_ROCK && !pillar[t]) put(t, T_GROUND, FLOOR, kind[t] || k);
  };
  const wob = (i, j) => fbm(i / 3.2, j / 3.2, sW, 2) - 0.5;
  // A cavern: an ellipse with a ragged edge (`w`: how ragged).
  const blob = (cx, cy, rx, ry, k, w = 0.45) => {
    for (let j = Math.floor(cy - ry - 2); j <= Math.ceil(cy + ry + 2); j++) for (let i = Math.floor(cx - rx - 2); i <= Math.ceil(cx + rx + 2); i++) {
      if (inner(i, j) && Math.sqrt(sq((i - cx) / rx) + sq((j - cy) / ry)) + wob(i, j) * w <= 1) open(i, j, k);
    }
  };
  // A passage: a winding tunnel `w` tiles wide from (x0, y0) to (x1, y1), through rock only.
  const passage = (x0, y0, x1, y1, w) => {
    let x = x0, y = y0;
    const r = w / 2 - 0.01;
    for (let n = 0; n < 400; n++) {
      for (let j = Math.floor(y - r); j <= Math.ceil(y + r); j++) for (let i = Math.floor(x - r); i <= Math.ceil(x + r); i++) if (dist2(i, j, x, y) <= r * r + 0.3) open(i, j, 6);
      const d = dist(x, y, x1, y1);
      if (d < 0.6) break;
      const a = datan2(y1 - y, x1 - x) + (cr() - 0.5) * 0.9 * Math.min(1, d / 4);
      x += dcos(a) * 0.6; y += dsin(a) * 0.6;
    }
  };

  // 1) The caverns.
  const homeR = { rx: clamp(W * 0.24, 7.5, 13), ry: clamp(Dy * 0.27, 6, 9) };
  blob(bx, by - 1.5, homeR.rx, homeR.ry, 1);
  for (let j = by - 5; j <= by + 5; j++) for (let i = bx - 5; i <= bx + 5; i++) if (dist2(i, j, bx, by) <= 4.6 * 4.6) open(i, j, 1); // the landing ground
  const rC = clamp(Math.min(W, H) * 0.16, 5.5, 10);
  blob(ccx, ccy, rC, rC, 5, 0.25);
  const hall = { x: P(0.52, 0)[0], y: P(0, 0.47)[1], rx: W * 0.17, ry: clamp(Dy * 0.15, 3.5, 6) };
  blob(hall.x, hall.y, hall.rx, hall.ry, 2, 0.3);
  const west = { x: P(0.17, 0)[0], y: P(0, 0.68)[1], rx: clamp(W * 0.12, 4.2, 8), ry: clamp(Dy * 0.15, 3.6, 6.5) };
  const east = { x: P(0.84, 0)[0], y: P(0, 0.6)[1], rx: clamp(W * 0.11, 4.2, 7.5), ry: clamp(Dy * 0.15, 3.6, 6) };
  blob(west.x, west.y, west.rx, west.ry, 3);
  blob(east.x, east.y, east.rx, east.ry, 3);
  const flank = { x: P(0.15, 0)[0], y: ccy, rx: clamp(W * 0.12, 4.5, 8), ry: Math.max(Dy * 0.26, 6.6) };
  blob(flank.x, flank.y, flank.rx, flank.ry, 4, 0.35); // (and its twin: the east flank)
  const chamberR = 2.3, chambers = [{ x: P(0.08, 0)[0] + 1, y: P(0, 1.02)[1] }, { x: P(0.93, 0)[0] - 1, y: P(0, 0.92)[1] }];
  for (const c of chambers) blob(c.x, c.y, chamberR, chamberR * 0.85, 7, 0.15);

  // 2) The passages between them.
  const pw = W >= 44 ? 3 : 2;
  passage(...P(0.5, 0.72), ...P(0.52, 0.58), pw); // home to the chasm hall
  passage(...P(0.52, 0.36), ...P(0.5, 0.18), pw); // the hall to the cathedral
  passage(...P(0.36, 0.95), west.x + west.rx * 0.5, west.y + west.ry * 0.4, pw); // home to the west cavern
  passage(...P(0.66, 0.9), east.x - east.rx * 0.5, east.y + east.ry * 0.5, pw); // home to the east cavern
  passage(west.x, west.y - west.ry * 0.7, flank.x + 0.5, flank.y + flank.ry * 0.75, 2); // the west cavern to the west flank
  passage(east.x, east.y - east.ry * 0.7, W - 1 - flank.x - 0.5, flank.y + flank.ry * 0.75, 2); // the east cavern to the east flank
  passage(flank.x + flank.rx * 0.6, ccy + 1.5, ccx - rC * 0.7, ccy + 1.5, 2); // the west flank to the cathedral (its twin: the east flank)
  passage(west.x - west.rx * 0.4, west.y + west.ry * 0.6, chambers[0].x, chambers[0].y - 1.5, 2); // to the side chambers
  passage(east.x + east.rx * 0.3, east.y + east.ry * 0.6, chambers[1].x, chambers[1].y - 1.5, 2);

  // 3) The chasm across the hall, with one natural rock arch, and a floating Crystal mass in a wider pocket of it.
  const yc = Math.round(hall.y) - 1, side = cr() < 0.5 ? -1 : 1;
  const archX = Math.round(hall.x + side * hall.rx * (0.35 + cr() * 0.15)), masses = [];
  for (let j = yc; j <= yc + 1; j++) for (let i = 1; i < W - 1; i++) {
    const t = id(i, j);
    if (terrain[t] !== T_GROUND || Math.abs(i - hall.x) > hall.rx + 1.5) continue;
    if (i === archX || i === archX + 1) put(t, T_GROUND, FLOOR, 6); // (the arch: kept clear, like a passage)
    else put(t, T_CHASM, 0, 0);
  }
  // A Crystal mass: a raised platform two levels up, ringed by chasm (a tile of it at least all round).
  const pocket = (mx, my, rx, ry, crx, cry) => {
    for (let j = Math.floor(my - ry - 1); j <= Math.ceil(my + ry + 1); j++) for (let i = Math.floor(mx - rx - 1); i <= Math.ceil(mx + rx + 1); i++) {
      if (!inner(i, j) || pillar[id(i, j)]) continue;
      const t = id(i, j), dp = Math.sqrt(sq((i - mx) / rx) + sq((j - my) / ry)) + wob(i, j) * 0.2;
      if (dp > 1) continue;
      if (sq((i - mx) / crx) + sq((j - my) / cry) <= 1) { put(t, T_GROUND, MASS, 8); mass[t] = mass[mir(t)] = 1; } else put(t, T_CHASM, 0, 0);
    }
    // Wear the platform back from anything it touches but chasm, so it stands clear.
    for (let pass = 0; pass < 2; pass++) for (let t = 0; t < N; t++) {
      if (!mass[t]) continue;
      let clear = true;
      orth(t, (u) => { if (!mass[u] && terrain[u] !== T_CHASM) clear = false; });
      if (!clear) { put(t, T_CHASM, 0, 0); mass[t] = mass[mir(t)] = 0; }
    }
    masses.push({ x: mx, y: my });
  };
  pocket(Math.round(hall.x - side * hall.rx * 0.45), yc + 0.5, 4.3, 3.3, 2.7, 2.0);
  if (sz >= 1) pocket(Math.round(east.x + east.rx * 0.25), Math.round(east.y - 0.5), 3.9, 3.1, 2.4, 1.8);

  // 4) A black lake in the west cavern, fed by a slow river from the wall.
  const lake = { x: west.x - west.rx * 0.35, y: west.y - 0.3, r: clamp(west.rx * 0.38, 1.8, 3) };
  const lakeTiles = [];
  for (let j = Math.floor(lake.y - lake.r - 1); j <= Math.ceil(lake.y + lake.r + 1); j++) for (let i = Math.floor(lake.x - lake.r - 1); i <= Math.ceil(lake.x + lake.r + 1); i++) {
    const t = id(i, j);
    if (inner(i, j) && terrain[t] === T_GROUND && kind[t] === 3 && dist(i, j, lake.x, lake.y) + wob(i, j) * 0.8 <= lake.r) lakeTiles.push(t);
  }
  lakeTiles.sort((a, b) => dist2(a % W, (a / W) | 0, lake.x, lake.y) - dist2(b % W, (b / W) | 0, lake.x, lake.y) || a - b);
  lakeTiles.splice(SEA_MIN - 10); // (the lake's middle, and room left for its river)
  {
    let x = lake.x, y = lake.y - lake.r, a = -Math.PI / 2 - 0.5 - cr() * 0.4;
    for (let n = 0; n < 40; n++) {
      a += (cr() - 0.5) * 0.5;
      x += dcos(a) * 0.5; y += dsin(a) * 0.5;
      const i = Math.round(x), j = Math.round(y), t = id(i, j);
      if (!inner(i, j) || terrain[t] !== T_GROUND || kind[t] === 6) break;
      if (!lakeTiles.includes(t)) lakeTiles.push(t);
    }
  }
  // (Far too small for ships: the lake and its river together stay well under SEA_MIN.)
  lakeTiles.splice(SEA_MIN - 6);
  for (const t of lakeTiles) put(t, T_WATER, FLOOR, 0);

  // 5) Make sure every floor is joined to every other (a passage can miss its cavern, a pocket or the lake can cut a
  //    sliver off): a sliver is filled in, and any bigger area the base can't walk to gets the cheapest way through
  //    from the ground it can (through rock or water, over a chasm only if nothing else will do, never a mass).
  const floorOk = (t) => terrain[t] === T_GROUND && !mass[t];
  const flood = () => {
    const seen = new Uint8Array(N), q = [id(bx, by)];
    seen[q[0]] = 1;
    for (let h = 0; h < q.length; h++) orth(q[h], (u) => { if (!seen[u] && floorOk(u)) { seen[u] = 1; q.push(u); } });
    return seen;
  };
  const joinAll = () => {
    for (let pass = 0; pass < 24; pass++) {
      const seen = flood();
      let lost = -1;
      for (let t = 0; t < N && lost < 0; t++) if (floorOk(t) && !seen[t]) lost = t;
      if (lost < 0) break;
      const area = [lost], inA = new Uint8Array(N);
      inA[lost] = 1;
      for (let h = 0; h < area.length; h++) orth(area[h], (u) => { if (!inA[u] && floorOk(u)) { inA[u] = 1; area.push(u); } });
      if (area.length < 10) { for (const t of area) put(t, T_ROCK, FLOOR, 0); continue; }
      const cost = new Float64Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), heap = new MinHeap();
      for (let t = 0; t < N; t++) if (seen[t]) { cost[t] = 0; heap.push(t, 0); }
      while (heap.size) {
        const t = heap.pop();
        if (inA[t]) { for (let u = t; u >= 0 && !seen[u]; u = from[u]) if (!floorOk(u)) put(u, T_GROUND, FLOOR, terrain[u] === T_WATER ? 3 : 6); break; }
        orth(t, (u) => {
          if (mass[u] || pillar[u] || !inner(u % W, (u / W) | 0)) return;
          const c = cost[t] + (floorOk(u) ? 0.1 : terrain[u] === T_CHASM ? 40 : terrain[u] === T_WATER ? 5 : 3);
          if (c < cost[u]) { cost[u] = c; from[u] = t; heap.push(u, c); }
        });
      }
    }
  };
  joinAll();

  // 6) The breaches: one over each Command Base, and two in each flank cavern (the lower one in each laid on player 0's
  //    side, with its twin, the upper one in the other flank).
  const breaches = [], off = Math.max(3.2, flank.ry * 0.45);
  breaches.push({ x: bx, y: by, r: HOLLOW.breach.home, home: true }, { x: W - 1 - bx, y: H - 1 - by, r: HOLLOW.breach.home, home: true });
  for (const fx of [flank.x, W - 1 - flank.x]) {
    const x = Math.round(fx + (fx < ccx ? 0.5 : -0.5)), y = Math.round(ccy + off);
    for (let j = y - 1; j <= y + 1; j++) for (let i = x - 1; i <= x + 1; i++) open(i, j, 4);
    breaches.push({ x, y, r: HOLLOW.breach.open }, { x: W - 1 - x, y: H - 1 - y, r: HOLLOW.breach.open });
  }
  const inBreach = (i, j, pad) => breaches.some((b) => dist2(i, j, b.x, b.y) <= sq(b.r + pad));
  const deep = { x: bx, y: half };
  joinAll(); // (what that opened is joined up too)

  // 7) Stone pillars, worn smooth: a ring of them round the Deep's mound, and some in the caverns (more on rougher
  //    Terrain). A pillar stands alone, with open floor all round it, so it never closes a way.
  const freeRound = (t) => {
    const i = t % W, j = (t / W) | 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const u = id(i + di, j + dj);
      if (!inner(i + di, j + dj) || terrain[u] !== T_GROUND || mass[u] || pillar[u] || kind[u] === 6) return false;
    }
    return true;
  };
  const addPillar = (i, j) => {
    const t = id(i, j);
    if (!inner(i, j) || !freeRound(t) || dist(i, j, ccx, ccy) < 2.5 || inBreach(i, j, 1.5)) return false;
    for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) if (inner(i + di, j + dj) && pillar[id(i + di, j + dj)]) return false;
    put(t, T_ROCK, FLOOR, 0);
    pillar[t] = pillar[mir(t)] = 1;
    return true;
  };
  for (let k = 0; k < 4; k++) { const a = (k + 0.5) * (Math.PI / 4); addPillar(Math.round(ccx + dcos(a) * rC * 0.62), Math.round(ccy + dsin(a) * rC * 0.62)); }
  const per = [0.4, 0.7, 1, 1.4, 1.8][cfg.rough ?? DEFAULT_ROUGH] * (W * H) / (46 * 70);
  for (let k = 0, made = 0, want = Math.round(9 * per); k < 600 && made < want; k++) {
    const i = 2 + Math.floor(cr() * (W - 4)), j = half + Math.floor(cr() * (H - half - 2)), t = id(i, j);
    if (kind[t] === 6 || kind[t] === 7 || dist(i, j, bx, by) < 6) continue;
    if (addPillar(i, j)) made++;
  }

  // 8) Resources: no stalk groves or fertile soil, nothing grows down here. Bloom veins (Fiber) on the cavern floors
  //    and along the walls; Ore, Crystal, boulders and oil seeps (the only Fuel) in fields; the richest Crystal on the
  //    floating masses.
  const free = (t) => terrain[t] === T_GROUND && !res[t] && !mass[t] && kind[t] !== 6;
  // A field of `type` round (x, y); with `min`, at least that many tiles of it (topped up on the free floor nearest it,
  // where the cavern's edge cut the field short).
  const stamp = (x, y, rad, type, fill, ok, min = 0) => {
    let n = 0;
    const can = (t) => (ok ? ok(t) : free(t)) && dist2(t % W, (t / W) | 0, bx, by) >= 6.5;
    for (let j = Math.floor(y - rad); j <= Math.ceil(y + rad); j++) for (let i = Math.floor(x - rad); i <= Math.ceil(x + rad); i++) {
      if (!inner(i, j) || dist2(i, j, x, y) > rad * rad) continue;
      const t = id(i, j);
      if (cr() >= fill || !can(t)) continue;
      for (const u of [t, mir(t)]) res[u] = type;
      n++;
    }
    if (n >= min) return;
    const near = [];
    for (let j = Math.floor(y - 6); j <= Math.ceil(y + 6); j++) for (let i = Math.floor(x - 6); i <= Math.ceil(x + 6); i++) if (inner(i, j) && j >= half && can(id(i, j))) near.push(id(i, j));
    near.sort((a, b) => dist2(a % W, (a / W) | 0, x, y) - dist2(b % W, (b / W) | 0, x, y) || a - b);
    for (const t of near) { if (n >= min) break; for (const u of [t, mir(t)]) res[u] = type; n++; }
  };
  // Home: two vein patches, Ore, Crystal, two boulder fields and an oil seep.
  stamp(bx - 6, by - 2, 1.8, R_VEIN, 0.85, null, 5);
  stamp(bx + 5.5, by + 2.5, 1.5, R_VEIN, 0.85, null, 3);
  stamp(bx - 4, by - 5.5, 1.35, R_ORE, 0.9, null, 3);
  stamp(bx + 4, by - 5.5, 1.3, R_CRYSTAL, 0.9, null, 3);
  stamp(bx + 6.5, by - 1.5, 1.6, R_BOULDER, 0.8, null, 3);
  stamp(bx - 2.5, by + 4.2, 1.1, R_BOULDER, 0.8);
  stamp(bx - 7, by + 2.5, 1.3, R_OIL, 0.95, null, 3); // (the only Fuel down here: a good seep by every base)
  // The chasm hall: boulders and veins on the near side, Ore and Crystal across the chasm.
  stamp(hall.x - side * hall.rx * 0.1, hall.y + hall.ry * 0.55, 1.5, R_BOULDER, 0.8);
  stamp(hall.x + side * hall.rx * 0.7, hall.y + hall.ry * 0.45, 1.3, R_VEIN, 0.85);
  stamp(hall.x + side * hall.rx * 0.65, hall.y - hall.ry * 0.6, 1.4, R_ORE, 0.85);
  stamp(hall.x - side * hall.rx * 0.2, hall.y - hall.ry * 0.65, 1.2, R_CRYSTAL, 0.85);
  // The side caverns.
  stamp(west.x + west.rx * 0.3, west.y + west.ry * 0.25, 1.9, R_VEIN, 0.85);
  stamp(west.x + west.rx * 0.35, west.y - west.ry * 0.45, 1.4, R_BOULDER, 0.8);
  stamp(west.x - west.rx * 0.2, west.y + west.ry * 0.6, 1.2, R_ORE, 0.85);
  stamp(east.x - east.rx * 0.45, east.y - east.ry * 0.2, 1.3, R_OIL, 0.9);
  stamp(east.x - east.rx * 0.2, east.y + east.ry * 0.55, 1.6, R_VEIN, 0.85);
  stamp(east.x + east.rx * 0.45, east.y + east.ry * 0.45, 1.2, R_ORE, 0.85);
  // The flank caverns (each lower half, and so by the turn each upper one): rich fields, contested.
  for (const s of [-1, 1]) {
    const fx = s < 0 ? flank.x : W - 1 - flank.x, inw = s < 0 ? 1 : -1;
    stamp(fx - inw * flank.rx * 0.45, ccy + flank.ry * 0.75, 1.3, s < 0 ? R_ORE : R_CRYSTAL, 0.85);
    stamp(fx + inw * flank.rx * 0.55, ccy + off + 0.5, 1.2, s < 0 ? R_OIL : R_VEIN, 0.9);
    stamp(fx + inw * flank.rx * 0.5, ccy + 0.6, 1.25, s < 0 ? R_VEIN : R_ORE, 0.85);
  }
  // The cathedral: the Deep's hoard of Crystal spires and Bloom round its mound.
  for (let k = 0; k < 3; k++) {
    const a = 0.35 + k * 1.2;
    stamp(ccx + dcos(a) * rC * 0.4, ccy + dsin(a) * rC * 0.4, 1.0, k === 1 ? R_VEIN : R_CRYSTAL, 0.8, (t) => free(t) && dist(t % W, (t / W) | 0, deep.x, deep.y) >= 2.2);
  }
  // Bloom on the walls: veins along the cavern edges, away from home.
  for (let t = half * W; t < N; t++) {
    const i = t % W, j = (t / W) | 0;
    if (!free(t) || kind[t] === 1 || kind[t] === 7 || inBreach(i, j, 0.5) || dist(i, j, bx, by) < 9) continue;
    let wall = false;
    orth(t, (u) => { if (terrain[u] === T_ROCK && !pillar[u]) wall = true; });
    if (wall && hash2(i, j, sV) < 0.16) for (const u of [t, mir(t)]) res[u] = R_VEIN;
  }
  // The floating masses: the richest Crystal, on the far half of each platform (the near half, toward the middle of
  // the map, is left clear for a Ropeway's far station and a Crystal Tap).
  for (const m of masses) {
    const tiles = [];
    for (let t = half * W; t < N; t++) if (mass[t] && Math.abs((t % W) - m.x) + Math.abs(((t / W) | 0) - m.y) <= 6) tiles.push(t);
    const far = (t) => { const i = t % W, j = (t / W) | 0; return (i - m.x) * (m.x - ccx) + (j - m.y) * (m.y - ccy) * 0.6 + hash2(i, j, sV + 3) * 0.5; };
    tiles.sort((a, b) => far(b) - far(a) || a - b);
    for (const t of tiles.slice(0, Math.min(tiles.length - 3, Math.max(5, Math.round(tiles.length * 0.6))))) for (const u of [t, mir(t)]) res[u] = R_CRYSTAL;
  }
  if (cfg.nuke) {
    let placed = 0;
    for (let k = 0; k < 400 && placed < Math.ceil(URANIUM_DEPOSITS / 2); k++) {
      const i = 2 + Math.floor(cr() * (W - 4)), j = half + 1 + Math.floor(cr() * (H - half - 3)), t = id(i, j);
      if (!free(t) || kind[t] === 1 || dist(i, j, bx, by) < 12 || inBreach(i, j, 0.5)) continue;
      for (const u of [t, mir(t)]) res[u] = R_URANIUM;
      placed++;
    }
  }
  // Small maps: a second seep on the other side of home. Their side caverns are too cramped for more oil within reach,
  // so with the one seep by home each colony was slow to get its Fuel going. (Last, so nothing above moves.)
  if (sz === 0) stamp(bx + 4, by - 4, 0.5, R_OIL, 1, null, 3); // (three tiles, as the first: one here and the two free tiles nearest)
  // How much each holds: richer out toward the middle (as on every map), the masses' Crystal HOLLOW.crystal times more.
  const reach = Math.max(1, dist(bx, by, W - 1 - bx, H - 1 - by) / 2 - RICH_FROM);
  for (let t = 0; t < N; t++) {
    if (!res[t]) continue;
    const i = t % W, j = (t / W) | 0, d = Math.min(dist(i, j, bx, by), dist(i, j, W - 1 - bx, H - 1 - by));
    const rich = RICH_TYPES.includes(res[t]) ? 1 + FRONTIER_RICH * clamp((d - RICH_FROM) / reach, 0, 1) : 1;
    // The larger caverns have more distance to supply, while their authored Ore and Oil clusters stay few.
    const reserves = sz >= IMMENSE_SIZE && (res[t] === R_ORE || res[t] === R_OIL) ? 1.5 : 1;
    amt[t] = clamp(Math.round(RES[res[t]].amount * (res[t] === R_URANIUM ? 1 : RPR.amount) * rich * reserves * (mass[t] ? HOLLOW.crystal : 1)), 1, 255);
  }

  // 9) The Murmur's nest sites (the nests themselves go down with the Murmur: see placeNests): the Deep's mound in the
  //    middle of the cathedral, and HOLLOW.nests on each side, out in the caverns, each with its twin.
  const nests = [];
  {
    const want = HOLLOW.nests[sz], cands = [];
    for (let t = half * W; t < N; t++) {
      const i = t % W, j = (t / W) | 0;
      if (!free(t) || ![2, 3, 4, 5, 7].includes(kind[t])) continue;
      if (dist(i, j, bx, by) < Math.min(16, Dy * 0.72) || dist(i, j, W - 1 - bx, H - 1 - by) < 12 || dist(i, j, deep.x, deep.y) < 5 || inBreach(i, j, 1.5)) continue;
      // (Not by a floating Crystal mass: its guards would keep every colony's gatherers off it for good.)
      if (masses.some((m) => dist(m.x, m.y, i, j) < 9 || dist(W - 1 - m.x, H - 1 - m.y, i, j) < 9)) continue;
      let room = 0;
      orth(t, (u) => { if (terrain[u] === T_GROUND && !res[u]) room++; });
      if (room < 3) continue;
      cands.push({ i, j, h: hash2(i, j, (seed ^ 0x6e35) >>> 0) });
    }
    cands.sort((a, b) => a.h - b.h);
    for (const apart of [8, 7, 6, 5]) {
      for (const c of cands) {
        if (nests.length >= want * 2) break;
        const tw = { x: W - 1 - c.i, y: H - 1 - c.j };
        if (dist(c.i, c.j, tw.x, tw.y) < apart || nests.some((n) => dist(n.x, n.y, c.i, c.j) < apart || dist(n.x, n.y, tw.x, tw.y) < apart)) continue;
        nests.push({ x: c.i, y: c.j }, tw);
      }
      if (nests.length >= want * 2) break;
    }
  }

  // 10) The side chambers' rows of robot parts: crates of Alloy (and some Chips) in two rows of three.
  const relics = [];
  for (const c of chambers) {
    const ci = Math.round(c.x), cj = Math.round(c.y);
    for (let r = 0; r < 2; r++) for (let k = -1; k <= 1; k++) {
      const i = ci + k, j = cj - 1 + r * 2, t = id(i, j);
      if (!inner(i, j) || terrain[t] !== T_GROUND || res[t]) continue;
      const chip = (k + r) % 3 === 0, R0 = chip ? HOLLOW.relics.chip : HOLLOW.relics.alloy;
      const n = R0[0] + Math.floor(hash2(i, j, seed + 17) * (R0[1] - R0[0] + 1)), g = chip ? 'chip' : 'alloy';
      relics.push({ x: i, y: j, goods: { [g]: n } }, { x: W - 1 - i, y: H - 1 - j, goods: { [g]: n } });
    }
  }
  const pillars = [];
  for (let t = 0; t < N; t++) if (pillar[t]) pillars.push(t);
  return {
    terrain, res, amt, grow, elev, ramp, fert, bases: [{ x: bx, y: by }, { x: W - 1 - bx, y: H - 1 - by }],
    spare: null, choke: null, lava: null, ford: null, tidal: null, fault: null, volcano: null,
    hollow: { breaches, masses: masses.flatMap((m) => [{ x: Math.round(m.x), y: Math.round(m.y) }, { x: W - 1 - Math.round(m.x), y: H - 1 - Math.round(m.y) }]), nests, deep, relics, pillars,
      chambers: chambers.flatMap((c) => [{ x: Math.round(c.x), y: Math.round(c.y) }, { x: W - 1 - Math.round(c.x), y: H - 1 - Math.round(c.y) }]) },
  };
}

/* ------------------------------------------------------------------ new game */

/** The most players map type `shape` has room for: 4 (Crossroads), 3 (the free-for-all maps) or 2. */
function maxPlayers(shape) { const sh = SHAPE_PRESETS[shape || 0] || {}; return sh.players || (sh.ffa ? 3 : 2); }
/** The fewest players map type `shape` is made for: 2, or 3 on the maps built round three or four colonies. */
function minPlayers(shape) { const sh = SHAPE_PRESETS[shape || 0] || {}; return sh.minPlayers || 2; }

/** How many players a game asking for `want` gets: as many as the map type has room for (Versus only). */
function playerCount(mode, shape, want) { return mode === 'versus' ? clamp(Math.round(want) || 2, minPlayers(shape), maxPlayers(shape)) : minPlayers(shape); }

/** Planetary is sized for a solo colony or a two-colony match. */
function mapSizeForPlayers(size, players) {
  return size === PLANETARY_SIZE && players > 2 ? IMMENSE_SIZE : size;
}

/**
 * Is this a four-quarter map: Crossroads for three or four players (one corner quarter each; three
 * leave the quarter beside you to the north free)?
 */
function quadMap(st) { const sh = SHAPE_PRESETS[(st && st.shape) || 0] || {}; return !!st && st.players >= 3 && !!(sh.cross || sh.quad4); }

/**
 * Is this Long Haul 2v2: a tall map with two colonies side by side at each end (south-west, south-east, north-east,
 * north-west in player order), its bottom-left quarter mirrored left to right and end to end onto the others?
 */
function haul4Map(st) { const sh = SHAPE_PRESETS[(st && st.shape) || 0] || {}; return !!st && st.players >= 3 && !!sh.haul4; }

/** Map width and height for these settings (size and shape); the height stays even so the map mirrors cleanly. */
function mapDims(st) {
  const size = mapSizeForPlayers(st.size, st.players);
  const sz = SIZE_PRESETS[size], sh = SHAPE_PRESETS[st.shape || 0];
  // Crossroads for three or four: a square map in four quarters, 80% more ground than for two.
  if (quadMap(st)) { const side = 2 * Math.round(Math.sqrt(sz.w * sz.h * sh.w * sh.h * 1.8) / 2); return { W: side, H: side }; }
  // Long Haul 2v2: its own proportions, the width even too (it is mirrored left to right).
  if (haul4Map(st)) return { W: 2 * Math.round((sz.w * sh.w) / 2), H: 2 * Math.round((sz.h * sh.h) / 2) };
  // Three players: a square map (the planet is the circle inside it), 40% more ground.
  if (st.players === 3) { const side = 2 * Math.round(Math.sqrt(sz.w * sz.h * sh.w * sh.h * 1.4) / 2); return { W: side, H: side }; }
  const W = Math.round(sz.w * sh.w), H = 2 * Math.round((sz.h * sh.h) / 2);
  // Long and naval layouts preserve their proportions inside the Standard Planetary tile budget.
  if (size === PLANETARY_SIZE && W * H > sz.w * sz.h) {
    const scale = Math.sqrt((sz.w * sz.h) / (W * H));
    return { W: Math.floor(W * scale), H: 2 * Math.floor(H * scale / 2) };
  }
  return { W, H };
}

/**
 * Are the megastructures in this game (the Lance of Corvane, the Shield Dome, Arrival City, the Orbital Lift)? The Megastructures setting (on unless the
 * game setup turned it off; a save from before it: off), and in a mission only one that teaches them (S.mission.mega).
 */
function megaOn() { return !!(S && S.settings && S.settings.mega) && (!S.mission || !!S.mission.mega); }

/** Why owner can't build megastructure `type` now ('' if it can): the setting, one per colony, Arrival City's hour (cityOpen). */
function megaBlocked(owner, type) {
  if (!megaOn()) return S && S.mission ? 'No megastructures in this mission.' : 'Megastructures are off in this game (game setup).';
  if (BDEFS[type].gup && !gupWinOn()) return S && S.mission ? 'No Great Uplink in this mission.' : S && S.settings && S.settings.upWin ? 'No Great Uplink here: no sky to transmit to.' : 'The Great Uplink win is off in this game (game setup, beside Victory).';
  if (BDEFS[type].city && !cityOpen()) return `Arrival City opens ${Math.round(CITY.at / 60)} minutes into a game: in ${fmtSecs(Math.ceil(CITY.at - S.time))}.`;
  if (S.buildings.some((b) => !b.dead && b.owner === owner && b.type === type)) return `One ${BDEFS[type].name} per colony: you have one${S.buildings.some((b) => !b.dead && b.owner === owner && b.type === type && b.built) ? '' : ' going up'} already.`;
  return '';
}

/**
 * Is the Great Uplink win in this game (GUP)? The game-setup switch (off unless it was turned on; a save from before it:
 * off), with Megastructures on, in a Versus game (never Colony), and never in the Hollow, which has no sky.
 */
function gupWinOn() { return !!(S && S.settings && S.settings.upWin) && megaOn() && S.mode !== 'colony' && !S.hollow; }

/** Can Arrival City be built yet (CITY.at s into a free-play game; at once in a mission that teaches it)? */
function cityOpen() { return !!S && (!!S.mission || S.time >= CITY.at); }

/** Is this a Nuclear race (the optional Versus setting with uranium and nuclear missiles)? Not in a mission, unless it teaches it. */
function nukeOn() { return !!(S && S.settings && S.settings.nuke) && (!S.mission || !!S.mission.nuke) && !S.hollow; } // (no missiles under the Hollow's roof)

/**
 * Are military buildings, warbots and missiles available? Always in Versus; in Colony free play too
 * (a sandbox to try everything); not in Colony missions, which are about building, unless one teaches defence.
 */
function warOn() { return !!S && (S.mode !== 'colony' || !S.mission || !!S.mission.war); }

/** Is the Research Lab available? In Colony free play, and in a Colony mission that teaches it. */
function labOn() { return !!S && S.mode === 'colony' && (!S.mission || !!S.mission.lab); }

/** The resources a building of `type` gathers: its own, plus uranium for Ore Mines in a Nuclear race (uranium first). */
function gatherTypes(type) {
  const g = gatherRes(type);
  if (!g) return [];
  return type === 'mine' && nukeOn() ? [R_URANIUM, g] : [g];
}

/** The resource a `type` gathers in this world (its BDEFS gather): in the Hollow a Harvester cuts Bloom veins, not stalks. */
function gatherRes(type) {
  const g = BDEFS[type] && BDEFS[type].gather;
  return g === R_STALK && hollowOn() ? R_VEIN : g;
}

/**
 * A rock face: open ground right against a crag or a cliff (a neighbour a level up or down with no
 * slope between), where a Quarry's worker can cut Stone that never runs out.
 */
function rockFace(t) {
  if (S.terrain[t] !== T_GROUND || S.bAt[t] || S.res[t]) return false;
  const W = S.W, i = t % W, j = (t / W) | 0;
  for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (!inMap(i + di, j + dj)) continue;
    const u = tIdx(i + di, j + dj);
    if (S.terrain[u] === T_ROCK) return true;
    if (S.terrain[u] === T_GROUND && S.elev[u] !== S.elev[t] && !canStep(t, u)) return true;
  }
  return false;
}

/** Rock faces within `radius` of (cx, cy) that bots from there can walk to. */
function rockFacesIn(cx, cy, radius) {
  const zone = S.zone[tIdx(cx, cy)], r2 = radius * radius + 0.3;
  let n = 0;
  for (let j = Math.max(0, cy - radius); j <= Math.min(S.H - 1, cy + radius); j++) {
    for (let i = Math.max(0, cx - radius); i <= Math.min(S.W - 1, cx + radius); i++) {
      const t = j * S.W + i;
      if (dist2(i, j, cx, cy) <= r2 && S.zone[t] === zone && rockFace(t)) n++;
    }
  }
  return n;
}

/** How many nodes a `type` gatherer at (i, j) could reach. */
function gatherReach(i, j, type) {
  let n = 0;
  for (const r of gatherTypes(type)) n += reachableRes(i, j, BDEFS[type].radius, r);
  return n;
}

/** Is tile t still scorched by a nuclear blast (nothing can be built or paved there)? */
function scorched(t) { return !!(S.scorch && S.scorch[t] > S.time); }
/** Was tile t fertile soil, burned for good by napalm or a Torch (S.burnt: see scorchSoil)? Nothing grows there again. */
function burntSoil(t) { return !!(S.burnt && S.burnt[t]); }

/** Is the resource on tile t a rich deposit (much more than usual, out towards the frontier)? */
function richRes(t) {
  const r = S.res[t];
  if (!r || !RICH_TYPES.includes(r)) return false;
  const pr = RESOURCE_PRESETS[(S.settings && S.settings.rich) ?? DEFAULT_RICH] || RESOURCE_PRESETS[DEFAULT_RICH];
  const sky = S.settings && SHAPE_PRESETS[S.settings.shape || 0].sky && SKY_RICH.includes(r) ? SKY_RES_MUL : 1;
  return S.amt[t] >= RES[r].amount * pr.amount * RICH_MARK * sky;
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
    resV: RES_V,
  };
  settings.shape = clamp(opts.shape ?? 0, 0, SHAPE_PRESETS.length - 1);
  // Free-for-all: three players (you and two rivals) on the map shapes that have room for three, or
  // four (you and three rivals) on Crossroads.
  settings.players = playerCount(mode, settings.shape, opts.players);
  settings.size = mapSizeForPlayers(settings.size, settings.players);
  settings.nuke = !!opts.nuke;
  settings.mega = opts.mega !== false; // Megastructures (on unless the setup turned them off: megaOn)
  // The Great Uplink win (off unless the setup turned it on: gupWinOn), alongside any Victory. Not in Colony or the Hollow.
  if (opts.upWin && mode === 'versus' && !SHAPE_PRESETS[settings.shape].hollow) settings.upWin = true;
  settings.biome = biomeAllowed(opts.biome, settings.shape) ? opts.biome : 'desert';
  if (secondBiomeAllowed(opts.biome2, settings.biome, settings.size, settings.shape)) settings.biome2 = opts.biome2;
  if (SHAPE_PRESETS[settings.shape].hollow) settings.biome = 'hollow'; // (the Hollow has its own look, whatever the Biome setting)
  if (modList(opts.mods, mode).length) settings.mods = modList(opts.mods, mode); // challenge modifiers (MODS; see modsSetup)
  settings.scars = scarsOk(opts.scars) ? opts.scars : 'full'; // War scars (SCARS: the Settings menu's, fixed for the game)
  const { W, H } = mapDims(settings);
  // The players people play: you (player 0), or in multiplayer everyone in opts.humans. The rest are the computer's,
  // with the difficulty's head start.
  const humans = Array.isArray(opts.humans) ? opts.humans : [0];
  const rival = (p) => !humans.includes(p);
  const seed = opts.seed >>> 0;
  const diff = DIFFICULTY[opts.difficulty] ? opts.difficulty : 'normal';
  // (Four Isles joins allies' islands with a sandbar in a team game.)
  const m = generateMap(seed, W, H, opts.teams && mode === 'versus' && settings.players === 4 ? { ...settings, teams: true } : settings);
  if (opts.layout) opts.layout(m, W, H); // missions hand-place features on their planet
  if (settings.biome2) settings.biomeBoundary = biomeBoundary(m.terrain, W, H, seed);
  S = {
    v: 1, mode, seed, W, H, settings, difficulty: diff, time: 0, nextId: 1, winner: -1, milestone: 0,
    terrain: m.terrain, res: m.res, amt: m.amt, grow: m.grow, elev: m.elev, ramp: m.ramp, fert: m.fert, choke: m.choke,
    lava: m.lava || null, ford: m.ford || null, tidal: m.tidal || null, fault: m.fault || null,
    road: new Uint8Array(W * H), rail: new Uint8Array(W * H), pave: new Uint8Array(W * H), wear: new Uint16Array(W * H), paveMark: new Uint8Array(W * H), xdir: new Uint8Array(W * H), oneRoad: true, roadVer: 0, lights: {}, over: {}, scorch: {}, burnt: {}, fires: [],
    plan: new Uint8Array(W * H), planVer: 0, paveRes: {}, owe: new Uint8Array(W * H), railPlan: new Uint8Array(W * H), planQ: [], junPlan: {},
    pipe: new Uint8Array(W * H), pipePlan: new Uint8Array(W * H), pipeVer: 0,
    owner: new Int8Array(W * H).fill(-1), wown: new Int8Array(W * H).fill(-1),
    resRes: new Uint8Array(W * H),
    bAt: new Int32Array(W * H),
    players: Array.from({ length: settings.players }, (_, p) => ({
      id: p,
      absent: mode === 'colony' && p !== 0,
      ai: (rival(p) && mode !== 'colony') || (p === 0 && !!opts.autoplay),
      mult: rival(p) ? DIFFICULTY[diff].mult : 1,
      lander: 0,
      stats: { built: 0, bots: 0, captured: 0, lost: 0, outposts: 0, startBots: 0, ramps: 0, moved: 0, dismantled: 0, nukes: 0 },
      made: {}, madeBots: {},
      aiT: 0, nextAttack: 0,
    })),
    buildings: [], bots: [], fx: [], decals: [], msgs: [], rallies: [], missiles: [], cans: [], liftFalls: [], loot: [],
    dirtyTiles: [], territoryVer: 0, tick: 0, hist: newHistory(settings.players),
  };
  if (opts.autoplay) S.players[0].mult = DIFFICULTY[diff].mult;
  // Teams: four colonies, two against two, side by side (Crossroads: the two on the left against the two on the right).
  // A team game is won by taking the other team's Command Bases (no Domination or Uplinks).
  if (opts.teams && mode === 'versus' && S.players.length === 4) { S.teams = [0, 0, 1, 1]; S.victory = 'capture'; }
  if (m.spare) S.spare = { x: m.spare.x, y: m.spare.y }; // Crossroads for three: the free quarter's corner
  // The Hollow: its breaches, floating Crystal masses, the Murmur's nest sites and the pillars (see hollowMap).
  if (m.hollow) S.hollow = { breaches: m.hollow.breaches, masses: m.hollow.masses, nests: m.hollow.nests, deep: m.hollow.deep, pillars: m.hollow.pillars, chambers: m.hollow.chambers };
  mapEventsStart(m);
  // Planetary events (see EVENTS): the first one comes after EVENT_FIRST seconds.
  if (opts.events) { S.events = true; S.event = null; S.nextEvent = EVENT_FIRST; }
  // Unlimited resources (a testing option on the new-game screen): see unlimitedTopUp.
  if (opts.unlimited && !opts.mission) S.unlimited = true;
  // How the game is won (Versus): see VICTORY. Capture unless another way was picked.
  if (mode === 'versus' && !opts.mission && !opts.layout && !S.teams && VICTORY[opts.victory] && opts.victory !== 'capture') S.victory = opts.victory;
  if (S.victory === 'uplinks' && m.hollow) delete S.victory; // (no Uplinks in the Hollow, which the Pathfinder never mapped: Capture)
  // The Murmur (see MURMUR and WILD): opts.murmur ('off', 'quiet' or 'active'); unset, the map type's own (SHAPE_PRESETS
  // murmur: the Hollow, their lair, has them Active) except on a hand-made map (a mission's: it switches them on in its
  // setup, see missionOptions), else off. An older Colony game's switch (opts.wildlife) is Active. Never on a silent
  // biome (Argos: see murmurGround). The nests go down once the landing sites are in (murmurStart; in the Hollow, on
  // the sites its map laid out: placeHollowNests).
  const hand = !!(opts.layout || opts.setup || opts.mission);
  let murmur = murmurLevelOk(opts.murmur) ? opts.murmur : opts.wildlife && mode === 'colony' && !hand ? 'active' : !hand && murmurLevelOk(SHAPE_PRESETS[settings.shape].murmur) ? SHAPE_PRESETS[settings.shape].murmur : 'off';
  if (!murmurGround(settings.biome) || !murmurShape(settings.shape)) murmur = 'off'; // (nor on a map type without room for nests)
  // Each computer player's doctrine (PERSONALITIES): opts.styles names one for each computer player in turn (the
  // computer's colonies in player order: in Custom Game players 1, 2, 3; in multiplayer the ones nobody took), else
  // opts.style names one for them all. 'random' deals one at random, picked from the planet's seed, that no other
  // computer player has (the ones asked for by name are taken out first). Missions and tests that don't ask get the
  // Steward (balanced). (Only from the game's setup, so every device in a multiplayer game deals the same ones.)
  {
    const rng = makeRng(seed ^ 0x2f6a1c3b);
    const seats = S.players.filter((P) => P.ai && !P.absent && rival(P.id));
    const want = (P) => { const k = Array.isArray(opts.styles) ? opts.styles[seats.indexOf(P)] : undefined; return isDoctrine(k) || k === 'random' ? k : opts.style; };
    const pool = PERSONALITY_ORDER.filter((k) => !seats.some((P) => want(P) === k));
    for (const P of S.players) {
      if (!P.ai || P.absent) continue;
      if (P.id === 0 || !rival(P.id)) { P.style = 'balanced'; continue; }
      const k = want(P);
      if (isDoctrine(k)) { P.style = k; continue; }
      if (k !== 'random') { P.style = 'balanced'; continue; }
      if (!pool.length) pool.push(...PERSONALITY_ORDER); // (more on Random than doctrines left over: they may repeat)
      P.style = pool.splice(Math.floor(rng() * pool.length), 1)[0];
    }
    for (const P of S.players) if (P.style && PERSONALITIES[P.style].econ) P.mult *= PERSONALITIES[P.style].econ;
  }
  S.byId = new Map();
  for (let p = 0; p < S.players.length; p++) {
    if (S.players[p].absent) continue;
    const base = m.bases[p];
    const L = addBuilding(p, 'lander', base.x, base.y, true);
    S.players[p].lander = L.id;
    for (const g in START_STOCK) L.stock[g] = START_STOCK[g] + (rival(p) ? DIFFICULTY[diff].bonus : 0);
    // (The Hollow: nothing grows, so a Worker comes down in the Agribot's place.)
    for (const type in START_BOTS) for (let k = 0; k < START_BOTS[type]; k++) enterBuilding(addBot(p, m.hollow && type === 'agribot' ? 'worker' : type, base.x, base.y), L);
    for (let k = 0; k < (mode === 'colony' ? 0 : START_WARBOTS); k++) {
      const w = addBot(p, 'warbot', base.x, base.y);
      enterBuilding(w, L);
    }
    S.players[p].stats.startBots = S.players[p].stats.bots;
  }
  modsSetup(humans);
  computeZones();
  computeTerritory();
  for (const P of S.players) { const L = getE(P.lander); if (L) starterRoads(L); }
  // Reserve the canyon's scarce landing pads before the Murmur claim the river flats.
  const grandCanyon = SHAPE_PRESETS[settings.shape].grandCanyon;
  if (grandCanyon) placePosts(seed);
  if (murmur !== 'off') murmurStart(murmur);
  // The Hollow's side chambers: robot parts laid out in rows, crates for warbots to carry home (they never rot).
  if (m.hollow) for (const r of m.hollow.relics) if (!S.bAt[tIdx(r.x, r.y)]) addLoot(r.x, r.y, r.goods, true);
  if (!grandCanyon) placePosts(seed);
  if (S.victory === 'uplinks') placeUplinks(seed);
  if (opts.setup) opts.setup(S);
  clearCalmGround(); // (no deposits on a Trade Post's ground: moved just off it)
  S.decor = makeDecor();
  for (const p of S.posts) S.decor[tIdx(p.x, p.y)] = 0; // (no plants on a landing pad)
  for (const u of S.uplinks || []) S.decor[tIdx(u.x, u.y)] = 0;
  scarSetup(); // (War scars: its layers and lists)
  // A word on how this kind of planet plays.
  const SH = SHAPE_PRESETS[settings.shape], quadTip = quadMap(settings) && (settings.players === 3 ? SH.spareTip : SH.quadTip);
  const L0 = getE(S.players[ME] ? S.players[ME].lander : 0), tip = !S.mission && (mode === 'versus' || SH.hollow) && (quadTip || SH.tip);
  if (tip && L0) postMsg(ME, tip, L0.x, L0.y, 'info');
  return S;
}

/** The biome of the current game. */
function biome() { return (S && S.settings && S.settings.biome) || 'desert'; }

/** Signed distance along the seed’s winding biome frontier. */
function biomeFrontierAt(x, y, w, h, seed) {
  const a = Math.floor(hash2(0, 0, seed ^ 0x4145) * 8) * Math.PI / 4;
  const nx = (x + 0.5) / w - 0.5, ny = (y + 0.5) / h - 0.5;
  const bend = (fbm(nx * 5, ny * 5, (seed % 100000) + 117, 2) - 0.5) * 0.35;
  return nx * dcos(a) + ny * dsin(a) + bend;
}

/** Place the middle of the transition so the primary biome covers 65% of the original land. */
function biomeBoundary(terrain, w, h, seed) {
  const land = [];
  for (let t = 0; t < terrain.length; t++) {
    if (terrain[t] === T_GROUND || terrain[t] === T_ROCK) land.push(biomeFrontierAt(t % w, (t / w) | 0, w, h, seed));
  }
  const primary = Math.round(land.length * 0.65);
  if (primary < 1 || primary === land.length) return 0;
  land.sort((a, b) => a - b);
  return (land[primary - 1] + land[primary]) * 0.5;
}

/** The seed supplies the direction and bends; the boundary is saved even if terrain changes. */
function biomeMixAt(x, y, w, h, seed, boundary = 0) {
  const v = clamp(0.5 + (biomeFrontierAt(x, y, w, h, seed) - boundary) / 0.2, 0, 1);
  return Math.fround(v * v * (3 - 2 * v));
}

/** Plant variants from both regions intermingle in the transition. */
function secondBiomePlant(x, y, seed, mix) {
  return mix > 0 && (mix >= 1 || hash2(x, y, seed ^ 0x5a95) < mix);
}

/** Is this game in the Hollow (the Murmur's cavern lair: see hollowMap)? */
function hollowOn() { return !!(S && S.hollow); }

/**
 * Why a `type` can't be built in this game's world at all ('' if it can): in the Hollow, no aircraft fly underground
 * (no Airfields, and no missiles: no Missile Factory, Silo or Nuclear race), nothing grows without light (no Grove Planters or Bio Farms), and there are no Trade Posts to dock
 * at (no Trade Terminals: the Pathfinder never mapped it). canPlace says so, and the build menu greys them out.
 */
function worldBan(type) {
  if (BDEFS[type] && BDEFS[type].city && biome() === 'lunar') return 'No Arrival City on Argos: the moon was never meant to be lived on.';
  if (!hollowOn()) return '';
  if (BDEFS[type] && BDEFS[type].gup) return 'No Great Uplink in the Hollow: there is no sky down here to transmit to.';
  if (BDEFS[type] && BDEFS[type].lift) return 'No Orbital Lift in the Hollow: the cavern roof stands between the anchor and the sky.';
  if (BDEFS[type] && BDEFS[type].terminal) return 'No Trade Posts in the Hollow: the Pathfinder never mapped it, so there is nowhere to dock a Trade Terminal.';
  if (BDEFS[type] && (BDEFS[type].airfield || BDEFS[type].mast)) return 'No aircraft fly in the Hollow: there is no sky down here, only the breach shafts.';
  if (BDEFS[type] && (BDEFS[type].mdriver || BDEFS[type].catcher)) return 'No Mass Driver in the Hollow: nothing flies under the cavern roof.';
  if (BDEFS[type] && BDEFS[type].lance) return 'No Lance of Corvane in the Hollow: there is no line of fire under the cavern roof.';
  // (Nor missiles: nothing flies under the cavern roof. No Missile Factory or Silo, and no Nuclear race: see nukeOn.)
  if (type === 'munitions' || (BDEFS[type] && (BDEFS[type].missile || BDEFS[type].nukeSilo))) return 'No missiles fly in the Hollow: there is no sky down here, only the cavern roof.';
  if (type === 'grower' || (BDEFS[type] && BDEFS[type].farm)) return 'Nothing grows in the Hollow: no light reaches the cavern floor. Harvesters cut Fiber from Bloom veins; Fuel comes from oil seeps.';
  return '';
}

/** The breach (a shaft of daylight down through the Hollow's roof: S.hollow.breaches) over (x, y), or null. */
function breachAt(x, y, pad) {
  if (!S || !S.hollow) return null;
  for (const b of S.hollow.breaches) if (dist2(x, y, b.x + 0.5, b.y + 0.5) <= sq(b.r + (pad || 0))) return b;
  return null;
}

/** The fertile meadows and their grassy edges on the Grand Canyon's floor. */
function canyonMeadow(t) {
  if (S.elev[t] !== 0 || !S.fert) return false;
  const i = t % S.W;
  return !!(S.fert[t] || (i > 0 && S.fert[t - 1]) || (i < S.W - 1 && S.fert[t + 1]) ||
    S.fert[t - S.W] || S.fert[t + S.W]);
}

/**
 * Decorative plants (scenery only): a plant variety 1..PLANT_KINDS on some open ground tiles, in
 * loose patches. Made from the seed with a hash, so the map itself is the same in every biome.
 */
function makeDecor() {
  const W = S.W, H = S.H, d = new Uint8Array(W * H), sd = S.seed % 100000;
  const primary = BIOMES[biome()], second = BIOMES[S.settings?.biome2];
  const canyon = SHAPE_PRESETS[S.settings?.shape || 0].grandCanyon;
  // Sky islands: the canyon floor, sheltered down there, is greener than the mesas.
  const sky = !!(S.settings && SHAPE_PRESETS[S.settings.shape || 0] && SHAPE_PRESETS[S.settings.shape || 0].sky);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const t = j * W + i;
    if (S.terrain[t] !== T_GROUND || S.res[t] || S.fert[t] || S.ramp[t] || S.road[t] || S.plan[t] || S.bAt[t] || (S.tidal && S.tidal[t])) continue;
    if (j > 0 && S.terrain[t - W] === T_GROUND && S.elev[t - W] > S.elev[t]) continue; // the foot of a cliff
    const local = second && secondBiomePlant(i, j, S.seed, biomeMixAt(i, j, W, H, S.seed, S.settings.biomeBoundary)) ? second : primary;
    const dens0 = canyon && canyonMeadow(t) ? Math.max(0.38, local.plants) : local.plants;
    const patch = fbm(i / 5, j / 5, sd + 77, 2), dens = sky && S.elev[t] <= 1 ? Math.max(0.16, dens0 * 2.5) : dens0;
    if (hash2(i, j, sd + 501) > dens * (0.25 + 1.5 * patch)) continue;
    const r = hash2(i * 3 + 1, j * 5 + 2, sd + 733);
    if (local.groves) {
      // Stands of conifers (1, 2) and of leafy trees (3, 4), mixed where they meet, with fallen
      // logs (5) and ferns (6) in the undergrowth.
      const g = fbm(i / 7, j / 7, sd + 91, 2), u = hash2(i * 5 + 3, j * 7 + 1, sd + 919);
      d[t] = u < 0.07 ? 5 : u < 0.17 ? 6 : g > 0.53 ? (r < 0.62 ? 1 : 2) : g < 0.47 ? (r < 0.6 ? 3 : 4) : 1 + Math.floor(r * 4);
      continue;
    }
    const wts = local.weights;
    if (wts) { // some varieties rarer than others
      let x = r * wts.reduce((a, w) => a + w, 0), k = 0;
      while (k < wts.length - 1 && x >= wts[k]) x -= wts[k++];
      d[t] = k + 1;
      continue;
    }
    d[t] = 1 + Math.floor(r * PLANT_KINDS);
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
    S.road[t] = 1; S.pave[t] = 1; S.wown[t] = L.owner;
  }
  S.roadVer = (S.roadVer || 0) + 1;
}

/* ------------------------------------------------------------------ elevation */

/**
 * Can a bot step between orthogonally adjacent tiles a and b? Same level: yes. One level apart:
 * only if either tile is a ramp. Cliffs of more than one level are never climbable.
 */
function canStep(a, b) {
  const ga = groundLike(a), gb = groundLike(b);
  if (!ga || !gb) {
    // Bridges and tunnels (road over water or through rock) join any neighbour, whatever its level,
    // except that a tunnel can't come out on ground more than two levels from the crag it runs
    // through: no digging down a sheer cliff (Sky islands' canyon walls).
    if (!((ga || S.road[a] > 0) && (gb || S.road[b] > 0))) return false;
    if (S.terrain[a] === T_ROCK && S.terrain[b] === T_GROUND && Math.abs(S.elev[b] - S.elev[a]) > 2) return false;
    if (S.terrain[b] === T_ROCK && S.terrain[a] === T_GROUND && Math.abs(S.elev[a] - S.elev[b]) > 2) return false;
    return true;
  }
  const d = S.elev[a] - S.elev[b];
  if (d === 0) return true;
  return (d === 1 || d === -1) && (S.ramp[a] === 1 || S.ramp[b] === 1);
}

/**
 * Outposts stand astride roads: their tile joins the road network (a road can run straight through
 * one), but like Gates only their owner's bots go through: an enemy has to break in (capture it).
 * Pass `who` (a player) to ask whether that player's bots may cross; leave it out to ask about the
 * road network. A Viaduct's abutment is open to everyone.
 */
function passTile(t, who) {
  const id = S.bAt[t];
  if (!id) return false;
  const b = getE(id);
  if (!b) return false;
  if (b.type === 'viaduct') return true;
  if (BDEFS[b.type].pylon) return !!S.road[t];
  return (b.type === 'outpost' || b.type === 'keep' || b.type === 'gate' || b.type === 'ropeway') && (who === undefined || who === b.owner);
}

/** The tile at the far end of the Viaduct whose abutment stands on tile t (both built), or -1. */
function viaLink(t) {
  const id = S.bAt[t];
  if (!id) return -1;
  const b = getE(id);
  if (!b || b.type !== 'viaduct' || !b.built || !b.link) return -1;
  const o = getE(b.link);
  return o && !o.dead && o.built ? o.y * S.W + o.x : -1;
}

/** What a construction site needs in all: its own cost (a Viaduct's depends on its length) or its type's. */
function siteCost(b) { return b.cost || BDEFS[b.type].cost; }

/** The tile at the far end of the ropeway whose station stands on tile t (both built), or -1. */
function ropeLink(t) {
  const id = S.bAt[t];
  if (!id) return -1;
  const b = getE(id);
  if (!b || b.type !== 'ropeway' || !b.built || !b.link) return -1;
  const o = getE(b.link);
  return o && !o.dead && o.built ? o.y * S.W + o.x : -1;
}

/** Chokepoint maps: where the pass runs through the crags (columns p0..p1, rows top..bot), or null. */
function chokePass() {
  const sh = SHAPE_PRESETS[(S.settings && S.settings.shape) || 0];
  if (!sh || !sh.choke) return null;
  const half = Math.floor(S.H / 2);
  // The channels' mouths on each side (the bottom half's from the map generator, the top's their twins).
  if (S.choke) {
    const N = S.W * S.H;
    return { mouths: S.choke.flatMap((ts) => [ts, ts.map((t) => N - 1 - t)]) };
  }
  // An older save: the single pass straight through the middle.
  const p0 = Math.floor((S.W - 1) / 2) - 1, p1 = Math.ceil((S.W - 1) / 2) + 1, top = half - CHOKE_BAND, bot = half + CHOKE_BAND - 1, mouths = [];
  for (const row of [top, bot]) { const ts = []; for (let i = p0; i <= p1; i++) ts.push(row * S.W + i); mouths.push(ts); }
  return { mouths };
}

/**
 * Is the building on tile t an enemy Wall, Gate or Outpost that player `who`'s warbots could break
 * through? (Shooting an Outpost down to nothing captures it, and then it lets them through.)
 */
function breachable(t, who) {
  const b = S.bAt[t] ? getE(S.bAt[t]) : null;
  return !!b && b.owner !== who && (!!BDEFS[b.type].barrier || ((b.type === 'outpost' || b.type === 'keep') && b.built));
}

/** An Outpost went up or came down: the road network changes, and the roads beside it redraw. */
function outpostRoads(x, y) {
  S.roadVer = (S.roadVer || 0) + 1;
  for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (inMap(x + di, y + dj) && S.dirtyTiles) S.dirtyTiles.push(tIdx(x + di, y + dj));
}

/** A road tile, or an Outpost the road runs through. */
function roadLike(t) { return S.road[t] > 0 || (S.bAt[t] > 0 && passTile(t)); }

/**
 * The surface of a building tile a road runs through (an Outpost or a Gate): as good as the best road
 * leading into it, and never worn, so it never slows the traffic going through. Asphalt on either
 * side makes it asphalt (Freight Trucks and Road Trains keep their speed).
 */
function throughPave(t) {
  const i = t % S.W, j = (t / S.W) | 0;
  let best = 1;
  for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (!inMap(i + di, j + dj)) continue;
    const u = tIdx(i + di, j + dj);
    if (S.road[u] && S.pave[u] > best) best = S.pave[u];
  }
  return best;
}

/** Can bots walk on tile t? Open ground, or a bridge or tunnel. */
function walkable(t) { return S.terrain[t] === T_GROUND || S.road[t] > 0 || (S.ford !== null && S.ford !== undefined && S.ford[t] === 1); }

/** Open ground, or a ford (shallow water bots can wade across: River delta). */
function groundLike(t) { return S.terrain[t] === T_GROUND || (S.ford !== null && S.ford !== undefined && S.ford[t] === 1); }

/** Is tile t water or rock, where a road would be a bridge or tunnel? */
function crossTile(t) { return S.terrain[t] !== T_GROUND; }

/** Could bots step between a and b once roads are on them? (Planning: water and rock count as bridges and tunnels.) */
function stepPlan(a, b) {
  if (S.terrain[a] === T_ROCK && S.terrain[b] === T_GROUND && Math.abs(S.elev[b] - S.elev[a]) > 2) return false;
  if (S.terrain[b] === T_ROCK && S.terrain[a] === T_GROUND && Math.abs(S.elev[a] - S.elev[b]) > 2) return false;
  return S.terrain[a] !== T_GROUND || S.terrain[b] !== T_GROUND ? true : canStep(a, b);
}

/**
 * Label every walkable tile with the id of the area bots can reach from it (ignoring buildings). Nobody turns on
 * an overpass (see findPath): the areas are joined straight across one, and its own tile goes with its east-west road.
 */
function computeZones() {
  const N = S.W * S.H, W = S.W, ov = anyOverpass();
  const z = new Int32Array(N).fill(-1);
  let next = 0;
  // Straight on from a onto b (b itself, or past the overpass(es) b starts), or -1.
  const across = (a, b) => {
    if (!canStep(a, b)) return -1;
    if (!ov || !S.over[b]) return b;
    const c = overHop(a, b);
    if (c < 0) return -1;
    for (let x = b, d = b - a; x !== c; x += d) if (!canStep(x, x + d)) return -1;
    return c;
  };
  for (let t = 0; t < N; t++) {
    if (!walkable(t) || z[t] >= 0 || (ov && S.over[t])) continue;
    const q = [t];
    z[t] = next;
    while (q.length) {
      const a = q.pop(), i = a % W;
      const nb = [i > 0 ? a - 1 : -1, i < W - 1 ? a + 1 : -1, a - W, a + W];
      for (const b0 of nb) {
        if (b0 < 0 || b0 >= N) continue;
        const b = across(a, b0);
        if (b < 0 || z[b] >= 0) continue;
        z[b] = next;
        q.push(b);
      }
      // A Ropeway, a Viaduct, a ferry line or an Airship line joins the areas at its two ends, whatever lies between.
      if (S.bAt[a]) for (const r of [ropeLink(a), viaLink(a), ferryLink(a), airLink(a)]) if (r >= 0 && z[r] < 0) { z[r] = next; q.push(r); }
    }
    next++;
  }
  if (ov) for (const k in S.over) {
    const t = +k, i = t % W;
    if (!walkable(t) || z[t] >= 0) continue;
    for (const u of [i > 0 ? t - 1 : -1, i < W - 1 ? t + 1 : -1, t - W, t + W]) if (u >= 0 && u < N && z[u] >= 0 && !S.over[u] && canStep(t, u)) { z[t] = z[u]; break; }
    if (z[t] < 0) z[t] = next++;
  }
  S.zone = z;
}

/** The area a player's bots can reach (the one their Command Base stands in). */
/** The tiles across the cliff from tile t: open ground one level up or down that bots can't step to from t. */
function rampSides(t) {
  const out = [], i = t % S.W, j = (t / S.W) | 0;
  if (S.terrain[t] !== T_GROUND) return out;
  for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (!inMap(i + di, j + dj)) continue;
    const u = tIdx(i + di, j + dj);
    if (S.terrain[u] === T_GROUND && Math.abs(S.elev[u] - S.elev[t]) === 1 && !canStep(t, u)) out.push(u);
  }
  return out;
}

function homeZone(p) {
  const L = getE(S.players[p].lander);
  return L && L.owner === p ? S.zone[tIdx(L.x, L.y)] : -2;
}

/**
 * The bodies of land player p can build on: its Command Base's, and every one where it holds a built store or
 * garrison (a Drop Outpost dropped on another island, a Port founded by sea, an Outpost taken in a landing...).
 * Cached for the tick.
 */
let _buildZones = { S: null, key: '', zone: null, sets: [] };
function buildZones(p) {
  const key = S.tick + ':' + S.buildings.length;
  // (computeZones numbers the areas afresh, into a new S.zone: sets worked out before it mean nothing after.)
  if (_buildZones.S !== S || _buildZones.key !== key || _buildZones.zone !== S.zone) _buildZones = { S, key, zone: S.zone, sets: [] };
  let set = _buildZones.sets[p];
  if (set) return set;
  set = new Set([homeZone(p)]);
  for (const b of S.buildings) if (!b.dead && b.owner === p && b.built && (BDEFS[b.type].store || BDEFS[b.type].mil)) set.add(S.zone[tIdx(b.x, b.y)]);
  _buildZones.sets[p] = set;
  return set;
}

/** The neutral Trade Post on tile t, or null. */
function postAt(t) {
  if (!S.posts) return null;
  for (const p of S.posts) if (p.y * S.W + p.x === t) return p;
  return null;
}

/** The Trade Post a Terminal at (i, j) would dock at: one within TRADE_POST.dock tiles, or null. */
function nearPost(i, j) {
  if (!S.posts) return null;
  for (const p of S.posts) if (Math.max(Math.abs(p.x - i), Math.abs(p.y - j)) <= TRADE_POST.dock && (p.x !== i || p.y !== j)) return p;
  return null;
}

/** Can `owner`'s bots get to tile t over land (its home island, or one joined by a bridge, or held by a Port, Airfield or Outpost of theirs)? */
function reachZone(owner, t) { return buildZones(owner).has(S.zone[t]); }

/**
 * How far (in 8-way steps) each tile is from something of `owner`'s that reaches out: a finished building
 * that holds land (or a Trade Terminal, which holds none), or road or track of theirs. Kept until land, roads or track change.
 */
let _reach = { S: null, key: '', maps: [] };
function reachMap(owner) {
  const key = S.territoryVer + ':' + (S.roadVer || 0) + ':' + (S.railVer || 0);
  if (_reach.S !== S || _reach.key !== key) _reach = { S, key, maps: [] };
  if (_reach.maps[owner]) return _reach.maps[owner];
  const W = S.W, H = S.H, N = W * H, dist = new Uint8Array(N).fill(255), q = [];
  const seed = (t) => { if (dist[t]) { dist[t] = 0; q.push(t); } };
  for (const b of S.buildings) if (!b.dead && b.owner === owner && b.built && (BDEFS[b.type].mil || civClaims(b) || BDEFS[b.type].terminal)) seed(tIdx(b.x, b.y)); // (a Trade Terminal reaches out though it holds no land)
  for (let t = 0; t < N; t++) if ((S.road[t] || (S.rail && S.rail[t])) && wayOwner(t) === owner) seed(t);
  for (let h = 0; h < q.length; h++) {
    const t = q[h], d = dist[t];
    if (d >= BUILD_REACH) continue;
    const i = t % W, j = (t / W) | 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const x = i + di, y = j + dj;
      if ((!di && !dj) || x < 0 || y < 0 || x >= W || y >= H) continue;
      const u = y * W + x;
      if (dist[u] > d + 1) { dist[u] = d + 1; q.push(u); }
    }
  }
  return (_reach.maps[owner] = dist);
}

/**
 * Would a new land-claiming building of `owner`'s at (i, j), with a ring of r tiles, take the ground under a
 * rival's ordinary building (cutting it off)? Not allowed: buildings are cut off when the fort that holds
 * them falls or is captured, not by planting a fort beside them.
 */
function ringOverRival(owner, i, j, r) {
  const r2 = r * r + 0.3;
  return S.buildings.some((b) => !b.dead && b.owner !== owner && b.owner >= 0 && !BDEFS[b.type].wild && !(BDEFS[b.type].mil && !BDEFS[b.type].bunker) && dist2(b.x, b.y, i, j) <= r2);
}

/** Is tile t within BUILD_REACH of something of `owner`'s (see reachMap)? */
function inReach(owner, t) { return reachMap(owner)[t] <= BUILD_REACH; }

/**
 * Where `owner` may put a building of `type` on tile t, as far as the land goes: anywhere they hold, or on
 * no-one's ground within BUILD_REACH of their buildings, roads or track; never on a rival's. Defences
 * (DEFENCE_TYPES) only on their own land. '' if fine, or why not.
 */
function landRule(owner, type, t) {
  const h = S.owner[t];
  if (h === owner) return '';
  if (h >= 0) return 'A rival holds this ground: build on your own land or no-one\'s.';
  // Walls and Gates go anywhere out on no-one's land your bots can walk to (to fence off a pass, a field, a far road).
  if (BDEFS[type] && BDEFS[type].barrier) return reachZone(owner, t) ? '' : 'Your bots can\'t walk there yet.';
  if (DEFENCE_TYPES.has(type)) return 'Defences only go inside your own border: an Outpost or Keep extends it.';
  if (type === 'terminal' && nearPost(t % S.W, (t / S.W) | 0)) return ''; // docking at a Trade Post: out wherever it stands (a road still has to reach it)
  if (!inReach(owner, t)) return `Too far out: build within ${BUILD_REACH} tiles of your buildings, roads or track.`;
  return '';
}

/** Count resource nodes in reach of (cx, cy) that bots there can actually walk to. */
function reachableRes(cx, cy, radius, type) {
  return countResIn(cx, cy, radius, type, false, S.zone[tIdx(cx, cy)]);
}

/** How many times a building's reach a walk to one of its nodes may be, for walkRes. */
const REACH_WALK = 3;
const _walk = { n: 0, seen: null, q: null, gen: 0 };

/**
 * Nodes in reach of (cx, cy) that are a short walk away too: no more than REACH_WALK times the radius in steps,
 * round cliffs and buildings (reachableRes counts the whole walkable area, so groves on a clifftop two tiles off
 * count as much as those beside the building, when the only way up is fifty tiles round). For the AI's choice of
 * a spot for a gatherer (aiSearchSpot). If supplied, visit receives each matching tile once.
 */
function walkRes(cx, cy, radius, type, visit) {
  const start = tIdx(cx, cy), n = reachableRes(cx, cy, radius, type);
  if (!n) return 0;
  const W = S.W, N = W * S.H, r2 = radius * radius + 0.3;
  if (_walk.n !== N) { _walk.n = N; _walk.seen = new Uint32Array(N); _walk.q = new Int32Array(N); _walk.gen = 0; }
  const seen = _walk.seen, q = _walk.q, gen = ++_walk.gen;
  // Breadth first from the building's tile, a ring of steps at a time (straight steps: cliffs block, Ramps join levels).
  let head = 0, tail = 1, found = 0;
  seen[start] = gen; q[0] = start;
  for (let steps = radius * REACH_WALK; steps >= 0 && head < tail && found < n; steps--) {
    for (const end = tail; head < end; head++) {
      const t = q[head], i = t % W;
      if (S.res[t] === type && dist2(i, (t / W) | 0, cx, cy) <= r2) {
        found++;
        if (visit) visit(t);
      }
      if (!steps) continue;
      for (let d = 0; d < 4; d++) {
        const u = d === 0 ? (i + 1 < W ? t + 1 : -1) : d === 1 ? (i > 0 ? t - 1 : -1) : d === 2 ? (t + W < N ? t + W : -1) : t - W;
        if (u < 0 || seen[u] === gen || !walkable(u) || !canStep(t, u) || (S.bAt[u] && !passTile(u))) continue;
        seen[u] = gen; q[tail++] = u;
      }
    }
  }
  return found;
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
  // Co-op (S.crew): the person whose order placed this site (ORDER_BY, orders.js), for its badge and the log.
  if (!built && S.crew && typeof ORDER_BY !== 'undefined' && ORDER_BY >= 0 && S.crew[ORDER_BY]) b.by = ORDER_BY;
  S.buildings.push(b);
  S.byId.set(b.id, b);
  S.bAt[tIdx(x, y)] = b.id;
  clearDecor(tIdx(x, y));
  if (def.long) { b.mdAxis = 'ew'; longClaim(b); } // (a Mass Driver: two tiles, see longTile)
  if (def.foot) footClaim(b); // (a megastructure: a square of tiles, see footTiles)
  if (type === 'outpost' || type === 'keep' || type === 'gate' || type === 'ropeway' || type === 'viaduct') outpostRoads(x, y); // roads run through it
  return b;
}

/**
 * A two-tile building (def.long: the Mass Driver) stands on its own tile (b.x, b.y) and the tile east of it (b.mdAxis
 * 'ew') or south of it ('ns'): longTile gives that second tile. S.bAt holds the building on both, so the second tile
 * blocks the way, can't be built on, and a tap on it picks the building; everything else (its door, its conveyors'
 * reach, its land) works from its own tile, with touching() looking round both.
 */
function longTile(x, y, axis) { return axis === 'ns' ? [x, y + 1] : [x + 1, y]; }
function longClaim(b) {
  const [i, j] = longTile(b.x, b.y, b.mdAxis);
  if (inMap(i, j) && !S.bAt[tIdx(i, j)]) { S.bAt[tIdx(i, j)] = b.id; clearDecor(tIdx(i, j)); }
}
function longRelease(b) {
  const [i, j] = longTile(b.x, b.y, b.mdAxis);
  if (inMap(i, j) && S.bAt[tIdx(i, j)] === b.id) S.bAt[tIdx(i, j)] = 0;
}
/** Lay two-tile building b along `axis` ('ew' or 'ns'). */
function setLongAxis(b, axis) { longRelease(b); b.mdAxis = axis === 'ns' ? 'ns' : 'ew'; longClaim(b); }
/** The middle of building b's footprint (a two-tile one's between its tiles, a megastructure's in the middle of its square). */
function bCentre(b) {
  const d = BDEFS[b.type], F = d && d.foot;
  if (F) return { x: b.x + F / 2, y: b.y + F / 2 };
  const L = d && d.long, ns = b.mdAxis === 'ns';
  return { x: b.x + 0.5 + (L && !ns ? 0.5 : 0), y: b.y + 0.5 + (L && ns ? 0.5 : 0) };
}

/*
 * A megastructure (def.foot: the Lance of Corvane 3, the Shield Dome 2) stands on a square of foot x foot tiles: its
 * own tile (b.x, b.y) at the north-west corner, and the rest east and south of it. S.bAt holds it on every one, so they
 * block the way, can't be built on, and a tap on any picks it. Its door (where its Workers and Haulers come to) is its
 * own tile, the corner, like a Mass Driver's; its middle (bCentre) is what its reach is measured from.
 */
function footTiles(type, x, y) {
  const F = (BDEFS[type] && BDEFS[type].foot) || 1, out = [];
  for (let dj = 0; dj < F; dj++) for (let di = 0; di < F; di++) out.push([x + di, y + dj]);
  return out;
}
function footClaim(b) {
  for (const [i, j] of footTiles(b.type, b.x, b.y)) if (inMap(i, j) && (!S.bAt[tIdx(i, j)] || S.bAt[tIdx(i, j)] === b.id)) { S.bAt[tIdx(i, j)] = b.id; clearDecor(tIdx(i, j)); }
}
function footRelease(b) {
  for (const [i, j] of footTiles(b.type, b.x, b.y)) if (inMap(i, j) && S.bAt[tIdx(i, j)] === b.id) { S.bAt[tIdx(i, j)] = 0; markDirty(i, j); }
}
/** The distance from (x, y) to the nearest point of building b's footprint (0 inside it). */
function footDist(b, x, y) {
  const d = BDEFS[b.type], F = (d && d.foot) || 1;
  const dx = Math.max(b.x - x, 0, x - (b.x + F)), dy = Math.max(b.y - y, 0, y - (b.y + F));
  return Math.sqrt(dx * dx + dy * dy);
}

function addBot(owner, type, x, y) {
  const maxHp = BOTS[type].hp;
  const bot = {
    id: S.nextId++, ent: 'u', type, owner,
    x: x + 0.5, y: y + 0.5, path: null, pi: 0,
    task: null, carry: null, carryN: 0, hp: maxHp, maxHp,
    inside: 0, cd: 0, fight: 0, scanT: 0, idleT: 0, face: 0, busy: 0, bat: 100,
  };
  if (type === 'warbot' || BOTS[type].flank || BOTS[type].railgun) bot.ammo = botMag(type);
  if (botTank(type)) bot.gel = botTank(type).cap;
  if (BOTS[type].shield) { bot.sh = BULWARK.shield; bot.shAim = 0; }
  S.bots.push(bot);
  S.byId.set(bot.id, bot);
  S.players[owner].stats.bots++;
  return bot;
}

function enterBuilding(bot, b) {
  bot.march = 0;
  bot.inside = b.id;
  bot.x = b.x + 0.5; bot.y = b.y + 0.5;
  bot.path = null;
  if (BOTS[bot.type].army && BDEFS[b.type].mil && !b.garrison.includes(bot.id)) b.garrison.push(bot.id);
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
 * still covers it. (Older notes: see computeTerritory for the rules now.)
 */
/**
 * Does finished building b hold a little ground round itself (CIV_CLAIM)? Every building does but the
 * military ones (they claim a wider ring, BDEFS terr), Walls and Gates, Ramps and creature nests.
 */
function civClaims(b) {
  const def = BDEFS[b.type];
  // (Nor a Trade Terminal: docked on a Trade Post's neutral ground, where nothing can be attacked, a ring of its own land
  // would shut everyone else's roads out of there for good. The owner's call, Nov 2026.)
  return b.built && !def.mil && !def.wild && !def.barrier && !def.gate && !def.ramp && !def.terminal && !def.pylon && b.type !== 'wall'; // (nor a Maglev pylon: a line claims no land)
}

/**
 * Who holds each tile (S.owner): a colony's influence, drawn on the ground. Military buildings (the Command
 * Base, Outposts, Keeps...) claim a wide ring (BDEFS terr, or b.claim for a Port founded from a Ferry);
 * every other finished building claims CIV_CLAIM tiles round itself, so a colony's land grows as it builds.
 * A military claim outranks the small ones: where a rival's military ring covers ground only your
 * buildings' small rings hold, the rival holds it (and those buildings are cut off: see below). Nearest
 * claim wins within each kind; on an exact tie whoever held the tile keeps it.
 */
function computeTerritory() {
  const { W, H } = S;
  const N = W * H;
  const d = S.players.map(() => new Float32Array(N).fill(Infinity)); // military claims
  const c = S.players.map(() => new Float32Array(N).fill(Infinity)); // the small claims of everything else
  const stamp = (arr, b, r) => {
    const r2 = r * r + 0.3;
    for (let j = Math.max(0, b.y - r); j <= Math.min(H - 1, b.y + r); j++) {
      for (let i = Math.max(0, b.x - r); i <= Math.min(W - 1, b.x + r); i++) {
        const dd = dist2(i, j, b.x, b.y);
        const t = j * W + i;
        if (dd <= r2 && dd < arr[b.owner][t]) arr[b.owner][t] = dd;
      }
    }
  };
  for (const b of S.buildings) {
    if (b.dead || !b.built) continue;
    // A Bunker claims no wide ring; a Port founded from a Ferry (b.claim) claims a little round it.
    if ((BDEFS[b.type].mil && !BDEFS[b.type].bunker) || b.claim > 0) stamp(d, b, b.claim || BDEFS[b.type].terr);
    else if (BDEFS[b.type].city) for (const t of cityRing(b)) { const dd = cityRingD(b, t); if (dd < d[b.owner][t]) d[b.owner][t] = dd; } // (Arrival City: a military claim round its middle)
    else if (civClaims(b)) stamp(c, b, CIV_CLAIM);
  }
  const nearest = (arr, t) => {
    let best = Infinity, who = -1, tie = false;
    for (let p = 0; p < arr.length; p++) {
      const v = arr[p][t];
      if (v < best) { best = v; who = p; tie = false; } else if (v === best && v < Infinity) tie = true;
    }
    return tie ? -2 : who;
  };
  for (let t = 0; t < N; t++) {
    const bid = S.bAt[t];
    if (bid) {
      const b = getE(bid);
      if (b && d[b.owner][t] < Infinity) { S.owner[t] = b.owner; continue; }
    }
    // The nearest military claim; where there's none, the nearest small one.
    let who = nearest(d, t);
    if (who === -1) who = nearest(c, t);
    if (who === -1) S.owner[t] = -1;
    else if (who >= 0) S.owner[t] = who;
  }
  // Where one of our bridges comes ashore on no-one's land, the ground within VIA_CLAIM of the landing
  // is ours too (land only, never anyone's), so an Outpost can go well onto the new island.
  // (A bridge pushed out past the border belongs to whoever's land or bridge it runs out from.)
  const span = (t) => S.road[t] && (S.terrain[t] === T_WATER || S.terrain[t] === T_CHASM);
  const nb4 = (t) => { const ti = t % W; return [ti > 0 ? t - 1 : -1, ti < W - 1 ? t + 1 : -1, t - W, t + W].filter((u) => u >= 0 && u < N); };
  const bOwner = new Int8Array(N).fill(-1), bq = [];
  const grow = (from) => { for (let h = from; h < bq.length; h++) for (const u of nb4(bq[h])) if (span(u) && bOwner[u] < 0) { bOwner[u] = bOwner[bq[h]]; bq.push(u); } };
  // Bridge tiles inside someone's border first, then any still unclaimed that start from someone's shore.
  for (let t = 0; t < N; t++) if (span(t) && S.owner[t] >= 0) { bOwner[t] = S.owner[t]; bq.push(t); }
  grow(0);
  const mark = bq.length;
  for (let t = 0; t < N; t++) {
    if (!span(t) || bOwner[t] >= 0) continue;
    for (const u of nb4(t)) if (S.terrain[u] === T_GROUND && S.owner[u] >= 0) { bOwner[t] = S.owner[u]; bq.push(t); break; }
  }
  grow(mark);
  for (const t of bq) {
    const p = bOwner[t];
    for (const u of nb4(t)) {
      if (S.terrain[u] !== T_GROUND || S.owner[u] >= 0) continue;
      const ui = u % W, uj = (u / W) | 0, r = VIA_CLAIM, r2 = r * r + 0.3;
      for (let j = Math.max(0, uj - r); j <= Math.min(H - 1, uj + r); j++) {
        for (let i = Math.max(0, ui - r); i <= Math.min(W - 1, ui + r); i++) {
          const v = j * W + i;
          if (S.owner[v] < 0 && S.terrain[v] === T_GROUND && dist2(i, j, ui, uj) <= r2) S.owner[v] = p;
        }
      }
    }
  }
  // A Viaduct's far end claims the no-one's ground within VIA_CLAIM of it (never anyone's land), so
  // a new mesa can be built on: an Outpost there claims the rest.
  for (const b of S.buildings) {
    if (b.dead || !b.built || b.type !== 'viaduct' || !b.far) continue;
    const r = VIA_CLAIM, r2 = r * r + 0.3;
    for (let j = Math.max(0, b.y - r); j <= Math.min(H - 1, b.y + r); j++) {
      for (let i = Math.max(0, b.x - r); i <= Math.min(W - 1, b.x + r); i++) {
        const t = j * W + i;
        if (S.owner[t] < 0 && dist2(i, j, b.x, b.y) <= r2) S.owner[t] = b.owner;
      }
    }
  }
  S.territoryVer++;
  // Roads, track and pipe a rival left inside our military ring (an Outpost, Keep or the Command Base
  // took the ground) are ours now: we can use them, change them or rip them up, and the rival can't.
  // (The small rings round other buildings don't take a rival's ways: they're only ours to tear up.)
  let took = false;
  for (let t = 0; t < N; t++) {
    const o = S.owner[t];
    if (o < 0 || isWild(o) || d[o][t] === Infinity) continue;
    if ((S.road[t] || S.rail[t]) && S.wown[t] >= 0 && S.wown[t] !== o) {
      S.wown[t] = o;
      if (S.paveMark) S.paveMark[t] = 0;
      if (S.lights && S.lights[t]) S.lights[t].owner = o;
      if (S.over && S.over[t]) S.over[t].owner = o;
      took = true;
    }
    if (S.pipe && S.pipe[t] && S.pipe[t] !== o + 1) { setPipe(t, o + 1); took = true; }
  }
  if (took) { S.roadVer = (S.roadVer || 0) + 1; S.railVer = (S.railVer || 0) + 1; }
  // Buildings on a rival's ground: a construction site there is lost; a finished building is cut off
  // (it stops working and crumbles, see cutOff) until its owner takes the land back. On no-one's ground,
  // or its owner's, it's fine.
  for (const b of S.buildings.slice()) {
    if (b.dead || (BDEFS[b.type].mil && !BDEFS[b.type].bunker) || BDEFS[b.type].wild || (BDEFS[b.type].city && b.built)) continue; // (Arrival City holds its own ground)
    const o = S.owner[tIdx(b.x, b.y)];
    let rival = o >= 0 && o !== b.owner;
    // A Viaduct can land in a rival's land (a bridgehead for an attack): it's only cut off once neither
    // end stands in its owner's land.
    if (rival && b.type === 'viaduct') {
      const e = b.link && getE(b.link);
      if ((e && !e.dead && S.owner[tIdx(e.x, e.y)] === b.owner) || S.owner[tIdx(b.x, b.y)] === b.owner) rival = false;
    }
    if (!rival) {
      if (b.cut) { b.cut = 0; markDirty(b.x, b.y); postMsg(b.owner, `${BDEFS[b.type].name} is back in your hands and working again.`, b.x, b.y, 'good'); }
      continue;
    }
    if (!b.built) {
      // A site on a rival's land: lost, and what was brought for it spills out.
      const n = dropLoot(b);
      postMsg(b.owner, `A ${BDEFS[b.type].name} site was lost: the ground is the rival's now.` + (n ? ' What was brought for it spilled out.' : ''), b.x, b.y, 'bad');
      destroyBuilding(b, false);
      continue;
    }
    if (!b.cut) cutOff(b);
  }
}

/**
 * The tiles Arrival City b holds (CITY.land round the middle of its square, as an Outpost holds its ring), in order;
 * cityRingD: how far one is from its middle (squared, in tiles, as computeTerritory compares claims).
 */
function cityRing(b) {
  const F = BDEFS[b.type].foot, cx = b.x + F / 2 - 0.5, cy = b.y + F / 2 - 0.5, r = CITY.land, r2 = r * r + 0.3, out = [];
  for (let j = Math.max(0, Math.floor(cy - r)); j <= Math.min(S.H - 1, Math.ceil(cy + r)); j++) {
    for (let i = Math.max(0, Math.floor(cx - r)); i <= Math.min(S.W - 1, Math.ceil(cx + r)); i++) if (dist2(i, j, cx, cy) <= r2) out.push(j * S.W + i);
  }
  return out;
}
function cityRingD(b, t) { const F = BDEFS[b.type].foot; return dist2(t % S.W, (t / S.W) | 0, b.x + F / 2 - 0.5, b.y + F / 2 - 0.5); }

/**
 * Finished building b now stands on a rival's ground: cut off. It stops working (its worker walks away,
 * nothing is hauled to it) and crumbles over CUT_CRUMBLE seconds unless its owner takes the land back
 * (an Outpost or Keep of theirs nearer than the rival's).
 */
function cutOff(b) {
  b.cut = S.time || 0.001;
  b.working = false;
  if (BDEFS[b.type].staff && typeof unstaff === 'function') unstaff(b);
  markDirty(b.x, b.y);
  postMsg(b.owner, `${BDEFS[b.type].name} is cut off: a rival's border has taken its ground. It has stopped working and will crumble unless you take the land back (an Outpost or Keep nearer than theirs).`, b.x, b.y, 'bad');
  if (isMe(b.owner) && typeof sfx === 'function') sfx('alert');
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
    if (u >= 0 && u < N && (!S.bAt[u] || passTile(u)) && canStep(t, u)) ends.push(u);
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
        if (b < 0 || b >= N || b === t || seen[b] === gen || (S.bAt[b] && !passTile(b)) || !canStep(a, b)) continue;
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
/* ------------------------------------------------------------------ Airfield runways */

/*
 * Every runway tile and the Airfield it belongs to (tile -> building id; null while there are no runways).
 * canRoad and canPlace ask about a tile at a time, thousands of times in one road search, so the runways are
 * mapped once and kept until the list of buildings changes, an Airfield is given its runway (runwayEnds)
 * or the tick moves on; a new or loaded game starts afresh (a different S).
 */
let _rwy = { S: null, list: null, n: -1, tick: -1, at: null };
function runwayMap() {
  if (_rwy.S === S && _rwy.list === S.buildings && _rwy.n === S.buildings.length && _rwy.tick === S.tick) return _rwy.at;
  let at = null;
  for (const b of S.buildings) {
    if (b.dead || !b.rwy || !BDEFS[b.type].airfield) continue;
    if (!at) at = new Map();
    for (let k = 1; k <= RUNWAY_LEN; k++) {
      const x = b.x + b.rwy.dx * k, y = b.y + b.rwy.dy * k;
      if (inMap(x, y) && !at.has(tIdx(x, y))) at.set(tIdx(x, y), b.id);
    }
  }
  _rwy = { S, list: S.buildings, n: S.buildings.length, tick: S.tick, at };
  return at;
}

/** The Airfield whose runway covers tile t (built or being built), or null. */
function runwayAt(t) {
  for (let again = 0; again < 2; again++) {
    const at = runwayMap(), id = at ? at.get(t) : 0;
    if (!id) return null;
    const b = getE(id);
    if (b && !b.dead) return b;
    _rwy.S = null; // that Airfield has gone since they were mapped: map them again
  }
  return null;
}

/** Could a runway run from a hangar at (i, j) in direction (dx, dy): RUNWAY_LEN tiles of open, level ground of the owner's? */
function runwayFits(owner, i, j, dx, dy, self) {
  if (!inMap(i, j)) return false;
  const lv = S.elev[tIdx(i, j)];
  for (let k = 1; k <= RUNWAY_LEN; k++) {
    const x = i + dx * k, y = j + dy * k;
    if (!inMap(x, y)) return false;
    const t = tIdx(x, y);
    if (S.terrain[t] !== T_GROUND || S.elev[t] !== lv || S.bAt[t] || S.road[t] || S.plan[t] || S.res[t] || S.ramp[t] || scorched(t) || (S.owner[t] >= 0 && S.owner[t] !== owner)) return false;
    if (S.rail && (S.rail[t] || (S.railPlan && S.railPlan[t]))) return false;
    const o = runwayAt(t);
    if (o && o !== self) return false;
  }
  return true;
}

/** Which way a runway can run from (i, j): east, west, south or north (the first that fits), or null. */
function runwayDir(owner, i, j, self) {
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (runwayFits(owner, i, j, dx, dy, self)) return { dx, dy };
  return null;
}

/** Airfield b's runway: its head (x0, y0), where planes park and start their roll, its far end (x1, y1), and direction. */
function runwayEnds(b) {
  if (!b.rwy && (b.rwy = runwayDir(b.owner, b.x, b.y, b))) _rwy.S = null; // (kept clear from now on: see runwayMap)
  const r = b.rwy || { dx: 1, dy: 0 };
  return { x0: b.x + 0.5 + r.dx * 1.45, y0: b.y + 0.5 + r.dy * 1.45, x1: b.x + 0.5 + r.dx * RUNWAY_LEN, y1: b.y + 0.5 + r.dy * RUNWAY_LEN, dx: r.dx, dy: r.dy };
}

function canPlace(owner, type, i, j, skipBlockCheck, axis) {
  const def = BDEFS[type];
  if (!def || !def.cost) return { ok: false, reason: 'Cannot build that.' };
  if (def.mega) { const why = megaBlocked(owner, type); if (why) return { ok: false, reason: why }; }
  // A megastructure: its own tile's checks, then every tile of its square has to be open, level ground of yours.
  if (def.foot && axis !== '_') return footPlace(owner, type, i, j, skipBlockCheck, axis);
  // A two-tile building (the Mass Driver): both its tiles must do, on one level. (axis '_': one tile's own checks.)
  if (def.long && axis !== '_') {
    const r = canPlace(owner, type, i, j, skipBlockCheck, '_');
    if (!r.ok) return r;
    const [i2, j2] = longTile(i, j, axis);
    const r2 = canPlace(owner, type, i2, j2, skipBlockCheck, '_');
    if (!r2.ok) return { ok: false, reason: `It is two tiles long, and its other end won't go there: ${r2.reason}` };
    if (S.elev[tIdx(i, j)] !== S.elev[tIdx(i2, j2)]) return { ok: false, reason: 'It is two tiles long and needs level ground under both.' };
    return r;
  }
  if (!inMap(i, j)) return { ok: false, reason: 'Outside the map.' };
  const t = tIdx(i, j);
  if (postAt(t)) return { ok: false, reason: 'A neutral Trade Post stands here: dock a Trade Terminal beside it.' };
  // (Nothing can be attacked on a Trade Post's ground, so only the Terminal that docks there may stand on it: an Outpost
  // or Wall there would be a door no enemy could ever break.)
  if (!def.terminal && !def.ramp && calmAt(i + 0.5, j + 0.5)) return { ok: false, reason: 'Only a Trade Terminal goes on a Trade Post\'s ground (the gold dashed square): nothing can be attacked there, so nothing else is built there.' };
  if (uplinkAt(t)) return { ok: false, reason: 'A neutral Uplink stands here: build an Outpost near it, and it\'s yours while it stands in your land.' };
  const land = landRule(owner, type, t);
  if (land) return { ok: false, reason: land };
  if (S.terrain[t] !== T_GROUND) return { ok: false, reason: 'The ground here is not buildable.' };
  if (S.tidal && S.tidal[t]) return { ok: false, reason: 'Tidal flats: the sea covers this at high tide.' };
  if (scorched(t)) return { ok: false, reason: 'This ground is still scorched from a nuclear blast.' };
  if (liftWreckAt(t)) return { ok: false, reason: LIFT_WRECK_WHY };
  // (A rival keeps its buildings off its own Orbital Lift's fall line: aiOnLiftLine.)
  if (!def.lift && S.players[owner] && S.players[owner].ai && typeof aiOnLiftLine === 'function' && aiOnLiftLine(owner, t)) return { ok: false, reason: 'That is on its Orbital Lift\'s fall line.' };
  if (def.nuke && !nukeOn()) return { ok: false, reason: 'Only in a Nuclear race.' };
  const ban = worldBan(type);
  if (ban) return { ok: false, reason: ban };
  if (def.pump) {
    if (S.res[t] !== R_OIL) return { ok: false, reason: 'Build an Oil Pump right on top of an oil seep.' };
  } else if (S.res[t] && !(S.res[t] === R_OIL && (S.road[t] || S.plan[t]))) return { ok: false, reason: 'Clear the resources here first.' }; // (oil under a road stays underground: the road rules below decide)
  if (S.bAt[t]) return { ok: false, reason: 'There is already a building here.' };
  if (runwayAt(t)) return { ok: false, reason: 'That\'s an Airfield\'s runway: keep it clear.' };
  if (def.colony && !labOn()) return { ok: false, reason: 'Only in Colony free play.' };
  // A Ramp can go under track (to carry it up a level), and a Gate across it (your trains run through, as on a road).
  if (S.rail && (S.rail[t] || (S.railPlan && S.railPlan[t])) && !def.ramp && !def.gate) return { ok: false, reason: S.rail[t] ? 'There is railway track here.' : 'Track is planned here.' };
  if (def.port && !navalMap()) return { ok: false, reason: hollowOn() ? 'No ships in the Hollow: its black lakes are far too small for a Port.' : 'Ports are for naval maps (Islands and Lakes).' };
  if (def.port && !portDocks(i, j).length) return { ok: false, reason: 'A Port goes on the shore, right beside open water wide enough for ships.' };
  if (S.wildlife) for (const e of S.buildings) {
    if (!e.dead && isNestB(e) && Math.max(Math.abs(e.x - i), Math.abs(e.y - j)) <= WILD.clear) return { ok: false, reason: 'Too close to a Murmur nest: clear it with warbots first.' };
  }
  if (S.ramp[t]) return { ok: false, reason: 'Too steep: this is a slope.' };
  // A Ramp is built from either side of its cliff (see rampStands), so it only needs one side your bots can reach.
  const zones = buildZones(owner);
  if (!zones.has(S.zone[t]) && !(def.ramp && rampSides(t).some((u) => zones.has(S.zone[u]) && !S.bAt[u]))) {
    return { ok: false, reason: def.ramp ? 'Your bots can\'t reach either side of this cliff yet.'
      : 'Your bots cannot reach this spot. Find a slope, or build a Ramp from the side they can reach (on another island, hold an Outpost, Drop Outpost or Port there first).' };
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
  if ((S.road[t] || S.plan[t]) && type !== 'outpost' && type !== 'keep' && type !== 'gate' && type !== 'ropeway' && type !== 'viaduct') {
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
    if (def.foot && di >= 0 && dj >= 0) continue; // (a megastructure's own square: see footPlace)
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
    // (The computer pays up front; your plans wait for the goods: see settlePlans.)
    if (def.prepaid && !skipBlockCheck && S.players[owner].ai && !canPay(owner, def.cost)) return { ok: false, reason: `Not enough ${missingGoods(owner, def.cost)}.` };
    return { ok: true, reason: '' };
  }
  if (!roadSide) return { ok: false, reason: 'Haulers need a road to every building: leave a side open where a road can go (open ground no rival holds).' };
  if (def.airfield) {
    const rwy = runwayDir(owner, i, j);
    if (!rwy) return { ok: false, reason: `An Airfield needs room for its runway: ${RUNWAY_LEN} tiles of open, level ground of yours in a straight line from it (east, west, north or south), with no road, deposit or building.` };
    return { ok: true, reason: '', rwy };
  }
  if (def.terminal) {
    const post = nearPost(i, j);
    if (!post) return { ok: false, reason: `A Trade Terminal docks at a neutral Trade Post (gold on the minimap): within ${TRADE_POST.dock} tiles of one. Lay a road out to it.` };
    if (S.buildings.some((b) => !b.dead && b.owner === owner && BDEFS[b.type].terminal && nearPost(b.x, b.y) === post)) return { ok: false, reason: 'You have a Trade Terminal at this Trade Post already: one per post.' };
  }
  if (def.mil && def.terr > 0 && ringOverRival(owner, i, j, def.terr)) return { ok: false, reason: `Too close to a rival's buildings: its ring (${def.terr} tiles) would cut them off. Capture or wreck the fort that holds them first.` };
  if (def.keep && S.buildings.some((b) => !b.dead && b.owner === owner && BDEFS[b.type].keep && dist2(b.x, b.y, i, j) < KEEP.spacing * KEEP.spacing)) {
    return { ok: false, reason: `Keeps stand at least ${KEEP.spacing} tiles apart: one of yours is too close.` };
  }
  if (def.mil && !def.bunker) { // Bunkers can go right beside Outposts (and each other)
    for (const b of S.buildings) {
      if (!b.dead && b.owner === owner && BDEFS[b.type].mil && !BDEFS[b.type].bunker && dist2(b.x, b.y, i, j) < 16) {
        return { ok: false, reason: 'Too close to another military building.' };
      }
    }
  }
  if (def.gather && gatherReach(i, j, type) === 0) {
    return { ok: false, reason: `No ${RES[gatherRes(type)].name.toLowerCase()}s within reach.` };
  }
  if (def.farm && fertileIn(i, j, def.radius) === 0) return { ok: false, reason: 'No fertile soil within reach.' };
  // The most expensive check goes last. (Bots walk through Outposts and Viaducts' ends, so those never block.)
  if (!skipBlockCheck && type !== 'outpost' && type !== 'keep' && type !== 'viaduct' && wouldBlock(t)) return { ok: false, reason: 'That would block the only way through here.' };
  return { ok: true, reason: '' };
}

/**
 * Can a megastructure (def.foot) go with its corner at (i, j)? Its own tile takes every usual check (and is its door);
 * the others must be open, level ground of yours with nothing on them; the buildings round it keep a side open; and it
 * mustn't close the only way through.
 */
function footPlace(owner, type, i, j, skipBlockCheck, dir) {
  const tiles = footTiles(type, i, j), F = BDEFS[type].foot, name = BDEFS[type].name;
  for (const [a, c] of tiles) if (!inMap(a, c)) return { ok: false, reason: 'Outside the map.' };
  const r = canPlace(owner, type, i, j, true, '_');
  if (!r.ok) return r;
  // (Arrival City can never be destroyed: not on a fault line that will open into a chasm under it.)
  if (BDEFS[type].city && S.fault && S.quake && !S.quake.done && tiles.some(([a, c]) => S.fault[tIdx(a, c)])) return { ok: false, reason: 'Arrival City can\'t stand on the fault line: the ground there will give way.' };
  const lv = S.elev[tIdx(i, j)], set = new Set(tiles.map(([a, c]) => tIdx(a, c)));
  for (const [a, c] of tiles) {
    const t = tIdx(a, c);
    if (a === i && c === j) continue;
    const why = S.terrain[t] !== T_GROUND ? 'the ground there is not buildable' : (S.tidal && S.tidal[t]) ? 'the sea covers part of it at high tide'
      : scorched(t) ? 'part of it is still scorched' : S.owner[t] !== owner ? 'all of it must stand on your own land' : S.bAt[t] ? 'there is a building in the way'
      : S.res[t] ? 'there are resources in the way' : (S.road[t] || S.plan[t]) ? 'there is a road in the way' : (S.rail && (S.rail[t] || (S.railPlan && S.railPlan[t]))) ? 'there is track in the way'
      : S.ramp[t] ? 'part of it is on a slope' : S.elev[t] !== lv ? 'it needs level ground' : runwayAt(t) ? 'an Airfield\'s runway is in the way'
      : calmAt(a + 0.5, c + 0.5) || postAt(t) || uplinkAt(t) ? 'neutral ground is in the way' : (S.pipe && S.pipe[t]) ? 'a pipeline is in the way' : liftWreckAt(t) ? 'fallen cable lies across it (Haulers cut it up first)' : '';
    if (why) return { ok: false, reason: `The ${name} is ${F} by ${F} tiles, and ${why}.` };
  }
  // Every building beside it keeps a side bots can walk in from.
  for (let c = j - 1; c <= j + F; c++) for (let a = i - 1; a <= i + F; a++) {
    if (!inMap(a, c) || set.has(tIdx(a, c)) || !S.bAt[tIdx(a, c)]) continue;
    const u = tIdx(a, c), nb = getE(S.bAt[u]);
    if (!nb || BDEFS[nb.type].foot) continue;
    if (nb.type === 'lander') return { ok: false, reason: 'Too close to the Command Base.' };
    let open = false;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (!inMap(a + di, c + dj)) continue;
      const v = tIdx(a + di, c + dj);
      if (!set.has(v) && !S.bAt[v] && canStep(u, v)) { open = true; break; }
    }
    if (!open) return { ok: false, reason: `That would wall in the ${BDEFS[nb.type].name} next to it.` };
  }
  if (!skipBlockCheck && footBlocks(set, i, j, F)) return { ok: false, reason: 'That would block the only way through here.' };
  // The Orbital Lift: its fall line (dir, turned with R) must fit on the map and cross no one else's land (liftLineWhy).
  if (BDEFS[type].lift) { const why = liftLineWhy(owner, i, j, liftDirOf(dir)); if (why) return { ok: false, reason: why }; }
  return { ok: true, reason: '' };
}

/*
 * The Orbital Lift's fall line (LIFT): from the middle of its 3 x 3 pad, liftLen tiles straight out in direction d (one
 * of LIFT_DIRS), starting from the tile beside the pad. liftLineTiles gives them in order out from the anchor (off the
 * map as -1), liftLineWhy why a line won't do ('' if it will).
 */
/** A fall direction from an order's argument: 0..7 (anything else: 0, east). */
function liftDirOf(d) { const k = Number.isInteger(+d) ? +d : 0; return k >= 0 && k < 8 ? k : 0; }
/** How long a Lift's fall line is here: half the map's width for its size (Small 15 tiles, Medium 20, Large 25, Huge 30). */
function liftLen() { const sz = SIZE_PRESETS[(S.settings && S.settings.size) ?? 1] || SIZE_PRESETS[1]; return Math.round(sz.w / 2); }
/** The tiles of the fall line of a Lift with its corner at (i, j), falling d: tile indices out from the pad (-1 off the map). */
function liftLineTiles(i, j, d) {
  const [dx, dy] = LIFT_DIRS[liftDirOf(d)], cx = i + 1, cy = j + 1, out = [], n = liftLen(), diag = dx && dy;
  // (straight: n tiles; on a diagonal as many as cover the same length)
  const m = diag ? Math.round(n / Math.SQRT2) : n;
  for (let k = 2; k < m + 2; k++) { const x = cx + dx * k, y = cy + dy * k; out.push(inMap(x, y) ? tIdx(x, y) : -1); }
  return out;
}
/** Why a Lift with its corner at (i, j) can't fall d: off the map, or across another colony's land, a Trade Post or an Uplink. */
function liftLineWhy(owner, i, j, d) {
  const L = liftLineTiles(i, j, d), name = LIFT_DIR_NAMES[liftDirOf(d)];
  if (L.some((t) => t < 0)) return `Its fall line (${L.length} tiles ${name}) runs off the map: press R to turn it.`;
  for (const t of L) {
    if (S.owner[t] >= 0 && S.owner[t] !== owner && !isWild(S.owner[t])) return `Its fall line (${name}) crosses ${playerName(S.owner[t], true)}'s land: press R to turn it.`;
    if (postAt(t) || calmAt((t % S.W) + 0.5, ((t / S.W) | 0) + 0.5)) return `Its fall line (${name}) crosses a Trade Post: press R to turn it.`;
    if (uplinkAt(t)) return `Its fall line (${name}) crosses a neutral Uplink: press R to turn it.`;
  }
  return '';
}

/*
 * Cable wreckage (a fallen Orbital Lift: liftFall): scrap piles of kind 4 (s.cb) on the tiles it came down on, kept for
 * good like War scars' craters until Haulers cut them up (salvageRun). Nothing is built or laid on such a tile, and
 * robots cross it at LIFT.slow. liftWreckAt reads a map of them made again whenever the scrap changes.
 */
const LIFT_WRECK_WHY = 'Fallen cable lies here: Haulers cut it up first (it needs a road within reach).';
let _lwS = null, _lwV = -1, _lwM = null;
function liftWreckMap() {
  if (!S || !S.scrap || !S.scrap.length) return null;
  if (_lwS !== S || _lwV !== (S.scrapVer || 0) || !_lwM || _lwM.length !== S.W * S.H) {
    _lwS = S; _lwV = S.scrapVer || 0;
    let any = false;
    for (const s of S.scrap) if (s.cb) { any = true; break; }
    if (!any) { _lwM = new Uint8Array(0); return null; }
    _lwM = new Uint8Array(S.W * S.H);
    for (const s of S.scrap) if (s.cb) { const i = Math.floor(s.x), j = Math.floor(s.y); if (inMap(i, j)) _lwM[tIdx(i, j)] = 1; }
  }
  return _lwM.length ? _lwM : null;
}
/** Does fallen cable lie on tile t? */
function liftWreckAt(t) { const m = liftWreckMap(); return !!(m && m[t]); }

/** Would building on the tiles in `set` (a square of F from (i, j)) cut the open ground round it in two, near by? */
function footBlocks(set, i, j, F) {
  const ring = [];
  for (let c = j - 1; c <= j + F; c++) for (let a = i - 1; a <= i + F; a++) {
    if (!inMap(a, c)) continue;
    const t = tIdx(a, c);
    if (!set.has(t) && walkable(t) && (!S.bAt[t] || passTile(t))) ring.push(t);
  }
  if (ring.length <= 1) return false;
  const seen = new Set([ring[0]]), q = [ring[0]], lim = 6;
  let left = ring.length - 1;
  const want = new Set(ring.slice(1));
  for (let h = 0; h < q.length; h++) {
    const t = q[h], a = t % S.W, c = (t / S.W) | 0;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = a + di, y = c + dj;
      if (!inMap(x, y) || x < i - lim || y < j - lim || x > i + F + lim || y > j + F + lim) continue;
      const u = tIdx(x, y);
      if (seen.has(u) || set.has(u) || !walkable(u) || (S.bAt[u] && !passTile(u)) || !canStep(t, u)) continue;
      seen.add(u); q.push(u);
      if (want.has(u) && --left === 0) return false;
    }
  }
  return true;
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
  for (const b of S.buildings) if (!b.dead && b.owner === owner && !b.built && !BDEFS[b.type].prepaid && !BDEFS[b.type].ramp) n++; // Ramps are part of a path, like roads
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

function placeSite(owner, type, i, j, cost, fromStore, axis) {
  const chk = canPlace(owner, type, i, j, false, axis);
  if (!chk.ok) return chk;
  const def = BDEFS[type];
  if (!def.prepaid && !def.ramp && siteCount(owner) >= MAX_SITES) return { ok: false, reason: `Maximum of ${MAX_SITES} construction sites reached.` };
  // An Outpost on a road takes the road's place (its Cement comes back); the road runs through it. A Gate
  // holds the road it stands on (b.road): the road is laid again when the Gate goes (destroyBuilding), so its
  // Cement stays in it. A road only planned there is called off: there was no road, so none comes back.
  const t = tIdx(i, j);
  const held = type === 'gate' && S.road[t] > 0 && roadOwnedBy(owner, t);
  if (S.plan[t]) cancelPlan(t);
  if (S.road[t]) removeRoad(owner, i, j, held);
  if (def.long) { const [i2, j2] = longTile(i, j, axis), t2 = tIdx(i2, j2); if (S.plan[t2]) cancelPlan(t2); if (S.road[t2]) removeRoad(owner, i2, j2, false); markDirty(i2, j2); }
  if (def.foot) for (const [a, c] of footTiles(type, i, j)) markDirty(a, c);
  const b = addBuilding(owner, type, i, j, false);
  if (def.long) setLongAxis(b, axis);
  if (def.lift) b.lfDir = liftDirOf(axis); // (the Orbital Lift: its fall line, set as it was placed)
  if (held) b.road = true;
  if (chk.rwy) { b.rwy = chk.rwy; _rwy.S = null; } // an Airfield's runway is kept clear from now on (see runwayMap)
  // Walls, Gates, Viaducts (and Ramps a rail line needs) are paid straight from storage: the
  // computer pays now; your plans queue and are paid for as the goods come in (settlePlans).
  if (cost) b.cost = cost;
  if (fromStore) b.fromStore = true;
  if (storeFunded(b)) {
    if (S.players[owner].ai) { if (!payInto(b)) queuePlan('b', b.id, owner); }
    else { queuePlan('b', b.id, owner); settlePlans(); } // what storage has goes in now (after older plans)
  }
  markDirty(i, j);
  return { ok: true, building: b };
}

/**
 * Roads can go on open ground you hold or no-one does (where your bots can reach), and through resources (clearing them, at
 * ROAD_CLEAR times the cost), oil seeps included so a pump is never walled in; not through a node
 * a bot is working. Over water or rock a road is a bridge or tunnel; a bridge can also be pushed
 * out over the water beyond your border, a tile at a time from your land or the end of a bridge
 * (so a channel the enemy's border covers can still be crossed).
 */
function pylonAt(t) { return !!(S.bAt[t] && getE(S.bAt[t])?.type === 'magpylon'); }

function canRoad(owner, i, j) {
  if (!inMap(i, j)) return false;
  const t = tIdx(i, j);
  if ((S.bAt[t] && !pylonAt(t)) || S.resRes[t] || scorched(t) || runwayAt(t) || postAt(t) || (S.tidal && S.tidal[t]) || liftWreckAt(t)) return false;
  if (S.owner[t] === owner) return true;
  // No-one's ground your bots can reach: roads can run anywhere out there (a rival's ground is theirs).
  if (S.owner[t] < 0 && !crossTile(t) && reachZone(owner, t)) return true;
  return bridgeable(t) && bridgeHead(owner, i, j);
}

/** Does water tile (i, j) touch `owner`'s land, a bridge, or a bridge tile `owner` has planned (or `extra(t)`)? */
function bridgeHead(owner, i, j, extra) {
  for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (!inMap(i + di, j + dj)) continue;
    const u = tIdx(i + di, j + dj);
    if (S.owner[u] === owner || S.plan[u] === owner + 1 || (S.road[u] && (bridgeable(u) || wayOwner(u) === owner)) || (extra && extra(u))) return true;
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
  if (c) return (c.cost.cement * bridgeMul(t)) / PAVE[1].cost.cement;
  return roadClears(t) ? ROAD_CLEAR : 1;
}

/** Does a road laid on tile t clear a resource off it? Not an oil seep: the oil is underground, and stays there under the road (or track). */
function roadClears(t) { return !!S.res[t] && S.res[t] !== R_OIL; }

/** Is this a naval map (Islands, Lakes): Ports and ships, and long bridges cost more? */
function navalMap() {
  if (!NAVAL_ON) return false;
  const sh = S && S.settings && SHAPE_PRESETS[S.settings.shape || 0];
  return !!(sh && sh.naval);
}

/** For each tile, how many tiles it is from dry land (0 on land; 8-way steps over water). Kept per game. */
let _shoreFor = null, _shoreArr = null;
function shoreDist() {
  if (_shoreFor === S && _shoreArr && _shoreArr.length === S.W * S.H) return _shoreArr;
  const W = S.W, H = S.H, N = W * H, d = new Uint8Array(N).fill(255), q = [];
  for (let t = 0; t < N; t++) if (S.terrain[t] !== T_WATER) { d[t] = 0; q.push(t); }
  for (let h = 0; h < q.length; h++) {
    const t = q[h], i = t % W, j = (t / W) | 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const x = i + di, y = j + dj;
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const u = y * W + x;
      if (d[u] > d[t] + 1) { d[u] = d[t] + 1; q.push(u); }
    }
  }
  _shoreFor = S; _shoreArr = d;
  return d;
}

/** How many times the usual price a bridge over tile t costs (see BRIDGE_NEAR): 1 except far out on a naval map. */
function bridgeMul(t) {
  if (S.terrain[t] !== T_WATER || !navalMap()) return 1;
  const d = shoreDist()[t];
  return d <= BRIDGE_NEAR ? 1 : 1 + BRIDGE_STEP * (d - BRIDGE_NEAR);
}

/* ------------------------------------------------------------------ the sea (naval maps) */

/** Bodies of open water: comp[t] (-1 off the water) and each one's size in tiles. Water never changes, so kept per game. */
let _seaFor = null, _sea = null;
function seaNet() {
  if (_seaFor === S && _sea && _sea.comp.length === S.W * S.H) return _sea;
  const W = S.W, N = W * S.H, comp = new Int32Array(N).fill(-1), size = [];
  for (let t = 0; t < N; t++) {
    if (S.terrain[t] !== T_WATER || comp[t] >= 0) continue;
    const c = size.length, q = [t];
    comp[t] = c;
    for (let h = 0; h < q.length; h++) {
      const a = q[h], i = a % W;
      for (const v of [i > 0 ? a - 1 : -1, i < W - 1 ? a + 1 : -1, a - W, a + W]) {
        if (v >= 0 && v < N && comp[v] < 0 && S.terrain[v] === T_WATER) { comp[v] = c; q.push(v); }
      }
    }
    size.push(q.length);
  }
  _seaFor = S; _sea = { comp, size };
  return _sea;
}

/** The open-water tiles right beside land tile (i, j) where a ship can tie up (water big enough to sail: SEA_MIN tiles). */
function portDocks(i, j) {
  const out = [], net = seaNet();
  for (const [di, dj] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
    if (!inMap(i + di, j + dj)) continue;
    const t = tIdx(i + di, j + dj), c = net.comp[t];
    if (c >= 0 && net.size[c] >= SEA_MIN) out.push(t);
  }
  return out;
}

/** The bodies of water a Port's ships can sail on. */
function portComps(b) { const c = seaNet().comp; return [...new Set(portDocks(b.x, b.y).map((t) => c[t]))]; }

/** Can ships sail between Ports a and b (on the same water)? */
function seaLinked(a, b) { const cb = portComps(b); return portComps(a).some((c) => cb.includes(c)); }

/**
 * Ferry lines: a Port with a ferry line (b.ferryTo, set on both ends) and a Ferry of its owner serving
 * it carries its owner's bots across to the other end, as a link in their routes (like a Ropeway).
 * Map of port id -> the far port's tile, worked out once a tick.
 */
let _ferryTick = -1, _ferryFor = null, _ferryMap = null;
const _noFerries = new Map(); // (a planet with no sea has no Ports and no ferry lines: nothing to work out)
function ferryLines() {
  if (!navalMap()) return _noFerries;
  if (_ferryFor === S && _ferryTick === S.tick && _ferryMap) return _ferryMap;
  const m = new Map(), served = new Set();
  // (A Ferry out on a landing, or sailing under your orders, isn't running its line meanwhile.)
  for (const u of S.bots) if (!u.dead && BOTS[u.type].ferry && !u.landing && !u.manual) served.add(u.home);
  for (const b of S.buildings) {
    if (b.dead || !b.built || !b.ferryTo || !BDEFS[b.type].port) continue;
    const o = getE(b.ferryTo);
    if (!o || o.dead || !o.built || o.owner !== b.owner || o.ferryTo !== b.id) continue;
    if (!served.has(b.id) && !served.has(o.id)) continue;
    m.set(b.id, o.y * S.W + o.x);
  }
  _ferryFor = S; _ferryTick = S.tick; _ferryMap = m;
  return m;
}

/** The tile of the far Port of the ferry line from the Port on tile t, or -1. */
function ferryLink(t) {
  const id = S.bAt[t];
  if (!id) return -1;
  const v = ferryLines().get(id);
  return v === undefined ? -1 : v;
}

/** The other Mooring Mast of Mast b's Airship line (b.line on both, both built, both its owner's), or null. */
function mastPartner(b) {
  if (!b || b.dead || !b.built || !b.line || !BDEFS[b.type].mast) return null;
  const o = getE(b.line);
  return o && !o.dead && o.built && o.owner === b.owner && o.line === b.id && BDEFS[o.type].mast ? o : null;
}

/**
 * Airship lines: two Mooring Masts linked (see mastPartner) with an Airship of their owner serving the line (its home
 * is either Mast) carry their owner's Workers and Warbots across, as a link in their routes (like a ferry line). Map of
 * mast id -> the far Mast's tile, worked out once a tick (airChanged: at once).
 */
let _airTick = -1, _airFor = null, _airMap = null;
function airLines() {
  if (_airFor === S && _airTick === S.tick && _airMap) return _airMap;
  const m = new Map();
  if (S.buildings && S.bots && S.buildings.some((b) => b.line && !b.dead)) {
    const served = new Set();
    for (const u of S.bots) if (!u.dead && u.home && BOTS[u.type].airship) served.add(u.home);
    for (const b of S.buildings) {
      const o = b.line ? mastPartner(b) : null;
      if (o && (served.has(b.id) || served.has(o.id))) m.set(b.id, o.y * S.W + o.x);
    }
  }
  _airFor = S; _airTick = S.tick; _airMap = m;
  return m;
}

/** The tile of the far Mast of the Airship line from the Mast on tile t, or -1. */
function airLink(t) {
  const id = S.bAt[t];
  if (!id) return -1;
  const v = airLines().get(id);
  return v === undefined ? -1 : v;
}

/** An Airship line or an Airship came or went: routes and reachable areas change. */
function airChanged() { _airTick = -1; computeZones(); }

/** What a bridge, tunnel or sky-bridge tile on t costs (null if t is open ground). */
function crossCost(t) {
  const c = CROSS[S.terrain[t]];
  if (!c) return null;
  const m = bridgeMul(t);
  if (m === 1) return c.cost;
  const out = {};
  for (const g in c.cost) out[g] = Math.round(c.cost[g] * m * 100) / 100;
  return out;
}

/** Everything a new road tile on t costs: road Cement, or a bridge's or tunnel's Cement and Alloy. */
function roadTileCost(t) {
  const c = CROSS[S.terrain[t]];
  if (c) return crossCost(t);
  const mul = roadClears(t) ? ROAD_CLEAR : 1, out = {};
  for (const g in PAVE[1].cost) out[g] = PAVE[1].cost[g] * mul;
  return out;
}

/* Planned roads: S.plan[t] is owner + 1 on tiles waiting for workers to pave them. */

function setPlan(t, owner) {
  const v = owner < 0 ? 0 : owner + 1;
  if (S.plan[t] === v) return;
  S.plan[t] = v;
  if (!v && S.owe) S.owe[t] = 0;
  if (v) clearDecor(t);
  S.planVer = (S.planVer || 0) + 1;
}

const _plans = { ver: -1, of: null, lists: [[], []], all: [[], []] };
function _planLists() {
  if (_plans.of !== S || _plans.ver !== S.planVer) {
    _plans.lists = S.players.map(() => []); _plans.all = S.players.map(() => []);
    for (let t = 0; t < S.W * S.H; t++) if (S.plan[t]) { _plans.all[S.plan[t] - 1].push(t); if (!(S.owe && S.owe[t])) _plans.lists[S.plan[t] - 1].push(t); }
    _plans.of = S; _plans.ver = S.planVer;
  }
}
/** The road tiles `owner` has planned and paid for, ready for workers to pave (cached until a plan changes). */
function planList(owner) { _planLists(); return _plans.lists[owner]; }
/** Every road tile `owner` has planned, paid for or still waiting for its goods. */
function planAll(owner) { _planLists(); return _plans.all[owner]; }

/**
 * Is the road (or track) on tile t `owner`'s to change: its own, anything on land it holds (a rival's
 * road left behind there is de facto ours), or a bridge it has pushed out past the border (unclaimed
 * water joined to its land or bridges)? A rival's roads on anyone else's ground aren't.
 */
function roadOwnedBy(owner, t) {
  if (S.road[t] || S.rail[t]) return wayOwner(t) === owner || S.owner[t] === owner;
  return S.owner[t] === owner || (S.owner[t] < 0 && crossTile(t) && bridgeHead(owner, t % S.W, (t / S.W) | 0));
}

/** Mark planned road tile t as waiting for its goods (1) or paid for (0). */
function setOwe(t, v) {
  if ((S.owe[t] || 0) === v) return;
  S.owe[t] = v;
  S.planVer = (S.planVer || 0) + 1;
}

/** Planned track waiting to go down on tile t: its owner + 1, or 0. */
function setRailPlan(t, v) { S.railPlan[t] = v; }

/** Pipe on tile t: its owner + 1, or 0 (none). */
function setPipe(t, v) {
  if ((S.pipe[t] || 0) === v) return;
  S.pipe[t] = v;
  S.pipeVer = (S.pipeVer || 0) + 1;
}

/** Why `owner` can't run pipe over tile t ('' if it can): its own ground, open or carrying a road or track. */
function pipeBlocked(owner, t) {
  if (t < 0 || t >= S.W * S.H) return 'That\'s off the map.';
  if (S.owner[t] >= 0 && S.owner[t] !== owner) return 'A rival holds that ground: pipe only runs on yours or no-one\'s.';
  if (S.owner[t] < 0 && (crossTile(t) || !reachZone(owner, t))) return crossTile(t) ? 'Pipe can\'t cross open water or a chasm outside your border.' : 'Your bots can\'t reach there yet.';
  if (scorched(t)) return 'The ground there is still scorched.';
  if (S.tidal && S.tidal[t]) return 'Tidal flats: the sea covers this at high tide.';
  if (postAt(t)) return 'A Trade Post stands here.';
  if (S.pipe[t] && S.pipe[t] !== owner + 1) return 'Someone else\'s pipe runs here.';
  return '';
}

/**
 * Who owns the road or track on tile t (S.wown: roads and track have an owner of their own, so they can run
 * out past a border), -1 for none.
 */
function wayOwner(t) {
  if (!(S.road[t] || (S.rail && S.rail[t]))) return -1;
  const o = S.wown ? S.wown[t] : -1;
  return o >= 0 ? o : S.owner[t]; // (one with no owner recorded is whoever's land it's on)
}

/** Lay (on) or take up the road on tile (i, j); a new road is `owner`'s (by default whoever holds the tile). */
function setRoad(i, j, on, owner) {
  const t = tIdx(i, j);
  if (!!S.road[t] === !!on) return;
  S.road[t] = on ? 1 : 0;
  if (on) S.wown[t] = owner ?? (S.wown[t] >= 0 && S.rail[t] ? S.wown[t] : S.owner[t]);
  else if (!S.rail[t]) S.wown[t] = -1;
  S.pave[t] = on ? 1 : 0;
  if (S.wear) S.wear[t] = 0;
  if (on) clearDecor(t);
  if (!on && S.paveMark) S.paveMark[t] = 0;
  if (!on && S.xdir) S.xdir[t] = 0;
  S.roadVer = (S.roadVer || 0) + 1;
  markDirty(i, j);
  for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (inMap(i + di, j + dj)) markDirty(i + di, j + dj);
  dirtySpan(t);
}

/** Set an existing road tile's surface: 1 road, 2 asphalt (fresh), 3 an Express lane (fresh). */
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
  for (let t = 0; t < S.W * S.H && top < 3; t++) if (S.road[t] && S.pave[t] > top) top = S.pave[t];
  S.topPaveCache = top;
  return top;
}

/** Make an existing path tile two-way (1) or one-way (2 east, 3 south, 4 west, 5 north). */
function setRoadDir(i, j, v) {
  const t = tIdx(i, j);
  if (!S.road[t] || S.road[t] === v) return;
  if (v < 2 && S.pave[t] === 3) return; // an Express lane is always one-way
  S.road[t] = v;
  markDirty(i, j);
  for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (inMap(i + di, j + dj)) markDirty(i + di, j + dj);
}

function markDirty(i, j) { S.dirtyTiles.push(tIdx(i, j)); }

/** A bridge is drawn as one level span (see deckLevel), so a change at either end repaints all of it. */
function dirtySpan(t) {
  const W = S.W, N = W * S.H, seen = new Set(), q = [];
  const add = (u) => { if (u >= 0 && u < N && !seen.has(u) && bridgeable(u) && (S.road[u] || (S.rail && S.rail[u]))) { seen.add(u); q.push(u); } };
  const around = (a) => { const i = a % W; add(a); if (i > 0) add(a - 1); if (i < W - 1) add(a + 1); add(a - W); add(a + W); };
  around(t);
  for (let h = 0; h < q.length && h < 400; h++) { const a = q[h]; markDirty(a % W, (a / W) | 0); around(a); }
}

/** How a Roadworks chooses roads: 'marked' (the roads marked in Paths) or 'all' joined to it. */
function paveMode(b) { return b.pmode || (S.players[b.owner].ai ? 'all' : 'marked'); }

/** The surface tile t is marked for: 3 an Express lane (paveMark 2), else 2 asphalt. */
function paveWant(t) { return S.paveMark[t] === 2 ? 3 : 2; }

/** Does this tile want a Paver: a road not yet at the surface it's marked for, or one worn enough to resurface? */
function needsPaving(t) { return S.road[t] && (S.pave[t] < paveWant(t) || S.wear[t] >= REPAVE_AT); }

/** Is road tile t an Express lane (surface tier 3)? */
function isExpress(t) { return S.road[t] > 0 && S.pave[t] === 3; }

/**
 * The side (0 N, 1 E, 2 S, 3 W) of Express lane t where its partner lane runs the other way beside it (the median
 * goes between them), or -1 for a lane on its own. Only the sides across the lane's own direction count.
 */
function laneMate(t) {
  const r = S.road[t], i = t % S.W, j = (t / S.W) | 0;
  if (!(r >= 2)) return -1;
  const ew = r === 2 || r === 4, back = r === 2 ? 4 : r === 4 ? 2 : r === 3 ? 5 : 3;
  for (const [k, di, dj] of ew ? [[0, 0, -1], [2, 0, 1]] : [[1, 1, 0], [3, -1, 0]]) {
    if (!inMap(i + di, j + dj)) continue;
    const u = tIdx(i + di, j + dj);
    if (isExpress(u) && S.road[u] === back) return k;
  }
  return -1;
}

/** Speed multiplier for bot kind `bt` on an Express lane with this much wear: its own lane speed (Asphalt's for a bot only crossing it), worn like asphalt. */
function expressSpeed(bt, w) { return (laneSpeed(bt) || PAVE[2].speed) * asphaltSpeed(w) / PAVE[2].speed; }

/** Speed multiplier for a bot on asphalt with this much wear. */
function asphaltSpeed(w) {
  return w <= WEAR_SLOW ? PAVE[2].speed : PAVE[2].speed - (PAVE[2].speed - WEAR_WORN_SPEED) * (w - WEAR_SLOW) / (WEAR_MAX - WEAR_SLOW);
}

/** Wear asphalt (or an Express lane) as a bot drives onto it. Worn right through, asphalt drops back to plain road, a lane to asphalt. */
function wearRoad(t, u) {
  if (S.pave[t] < 2 || !S.wear) return;
  const before = S.wear[t], w = Math.min(WEAR_MAX, before + (BOTS[u.type].train ? WEAR_TRAIN : BOTS[u.type].truck ? WEAR_TRUCK : WEAR_BOT));
  S.wear[t] = w;
  const i = t % S.W, j = (t / S.W) | 0;
  if (w >= WEAR_MAX) {
    const lane = S.pave[t] === 3;
    setPave(i, j, lane ? 2 : 1);
    const P = S.players[wayOwner(t)];
    if (P && !P.ai && isMe(wayOwner(t)) && !S.paveMark[t] && S.time - (P.wornMsgAt || -1e9) > 240) {
      P.wornMsgAt = S.time;
      postMsg(ME, lane ? 'A busy Express lane has worn down to asphalt: its lights are out and the trucks slow. Mark it in Paths (Express) and a Roadworks will keep it surfaced.'
        : 'Busy asphalt has worn back to plain road. Mark roads in Paths (Pave) and a Roadworks will keep them surfaced.', i, j, 'warn');
    }
  } else if ((before / 250 | 0) !== (w / 250 | 0)) markDirty(i, j); // shows its cracks
}

/** How many of this player's road tiles are marked for asphalt. */
function roadsMarked(owner) {
  let n = 0;
  for (let t = 0; t < S.W * S.H; t++) if (S.paveMark[t] && S.road[t] && wayOwner(t) === owner) n++;
  return n;
}

/**
 * Mark (or unmark) a road for asphalt (tier 2, the default) or an Express lane (tier 3): a Roadworks paves and
 * maintains marked roads. Marking for asphalt leaves an Express mark as it is.
 */
function setPaveMark(owner, i, j, on, tier) {
  const t = tIdx(i, j), v = !on ? 0 : tier === 3 ? 2 : 1;
  if (!S.road[t] || wayOwner(t) !== owner || S.paveMark[t] === v || (v === 1 && S.paveMark[t] === 2)) return false;
  S.paveMark[t] = v;
  markDirty(i, j);
  return true;
}

/** Does `owner` have any road marked (or planned) as an Express lane? Looked up once a second. */
const _xm = { of: null, at: -1, by: [] };
function expressMarked(owner) {
  if (_xm.of !== S || _xm.at !== (S.tick >> 5)) {
    _xm.of = S; _xm.at = S.tick >> 5; _xm.by = S.players.map(() => false);
    for (let t = 0; t < S.W * S.H; t++) {
      if (S.paveMark[t] === 2 && S.road[t]) { const o = wayOwner(t); if (o >= 0) _xm.by[o] = true; }
      else if (S.xdir && S.xdir[t] && S.plan[t]) _xm.by[S.plan[t] - 1] = true;
    }
  }
  return !!_xm.by[owner];
}

/* ------------------------------------------------------------------ road network */

/*
 * Road tiles joined along roads (respecting cliffs and ramps) form networks. Haulers can only
 * carry goods between buildings that touch the same network. A junction is a road tile with
 * roads on three or four sides (junc holds how many: 3, or 4 for a crossing). Labels are rebuilt
 * lazily whenever S.roadVer changes.
 *
 * roadNet(who) is player who's own view: an Outpost, Keep, Gate or Ropeway station joins roads only
 * for its owner (as findPath lets only its owner's bots through), so a road running through one the
 * enemy holds is cut for us, and nothing counts as linked that a hauler couldn't drive. Each player's
 * networks are numbered apart from the others' (from (who + 1) * RN_SPAN), so ferry lines joining
 * them (netGroups) never mix two players' networks up. roadNet() is everyone's at once: for drawing
 * roads and junctions.
 *
 * An overpass carries two roads that cross without meeting (nobody turns there: see findPath). Its
 * east-west road is the tile's own label (comp); its north-south road has a label of its own (compV,
 * by the overpass's place in ovk), so two roads that only meet at an overpass are two networks. Ask
 * tileNets for the networks a tile is on, laneComp for the one a bot drives onto from a neighbour.
 */
const _rn = { ver: -1, of: null, comp: null, compT: null, junc: null, bnet: new Map(), bnetT: new Map() };
const _rnBy = [];
const RN_SPAN = 1 << 20;

/**
 * Does tile t carry player who's bots along a road: a road with nothing built on it, or a building of theirs the road
 * runs through? (As findPath has it: a building they can't pass blocks the way, whatever lies under it.)
 */
function roadLikeFor(t, who) { return S.bAt[t] > 0 ? passTile(t, who) : S.road[t] > 0; }

/** Is there an overpass anywhere on the map? (Most games have none: the searches skip asking about each tile.) */
function anyOverpass() { if (S.over) for (const k in S.over) return true; return false; }

function roadNet(who) {
  const own = who !== undefined && who !== null && who >= 0;
  let rn = _rn;
  if (own) rn = _rnBy[who] || (_rnBy[who] = { ver: -1, of: null, comp: null, compT: null, junc: null, bnet: new Map(), bnetT: new Map() });
  const N = S.W * S.H;
  if (rn.of === S && rn.ver === (S.roadVer || 0) && rn.comp && rn.comp.length === N) return rn;
  const rl = own ? (t) => roadLikeFor(t, who) : roadLike;
  const W = S.W;
  // Overpasses: node t is the east-west road over tile t, node N + k the north-south road under the k-th overpass.
  const ovs = [], ovk = new Map();
  if (S.over) for (const k in S.over) { const t = +k; if (t >= 0 && t < N && rl(t)) { ovk.set(t, ovs.length); ovs.push(t); } }
  const lab = new Int32Array(N + ovs.length).fill(-1), junc = new Uint8Array(N);
  // The node a road from tile a runs onto at its neighbour b: on an overpass, the road that goes straight on from a's side.
  const enter = (a, b) => { const k = ovs.length ? ovk.get(b) : undefined; return k === undefined || b - a === 1 || a - b === 1 ? b : N + k; };
  let next = 0;
  const q = [];
  const flood = (s) => {
    lab[s] = next; q.length = 0; q.push(s);
    while (q.length) {
      const x = q.pop(), a = x < N ? x : ovs[x - N], ai = a % W;
      const k = x >= N ? 2 : ovs.length && ovk.has(a) ? 1 : 0; // (on an overpass: only straight on, along its own road)
      for (const b of [k === 2 || ai === 0 ? -1 : a - 1, k === 2 || ai === W - 1 ? -1 : a + 1, k === 1 ? -1 : a - W, k === 1 ? -1 : a + W]) {
        if (b < 0 || b >= N || !rl(b) || !canStep(a, b)) continue;
        const y = enter(a, b);
        if (lab[y] < 0) { lab[y] = next; q.push(y); }
      }
    }
    next++;
  };
  for (let t = 0; t < N; t++) {
    if (!rl(t)) continue;
    let k = 0;
    const i = t % W;
    for (const u of [i > 0 ? t - 1 : -1, i < W - 1 ? t + 1 : -1, t - W, t + W]) if (u >= 0 && u < N && rl(u) && canStep(t, u)) k++;
    if (k >= 3 && S.road[t]) junc[t] = k;
    if (lab[t] < 0) flood(t);
  }
  for (let k = 0; k < ovs.length; k++) if (lab[N + k] < 0) flood(N + k);
  const comp = lab.slice(0, N), compV = lab.slice(N);
  // Ropeways join networks for the light bots that ride them (comp); trucks keep to the roads
  // (compT). Viaducts join both: anything can drive across one.
  const compT = comp.slice(), compVT = compV.slice(), parent = Array.from({ length: next }, (_, k) => k), parentT = parent.slice();
  const find = (p, k) => { while (p[k] !== k) { p[k] = p[p[k]]; k = p[k]; } return k; };
  for (const b of S.buildings) {
    if (b.dead || !b.built || (b.type !== 'ropeway' && b.type !== 'viaduct')) continue;
    const t = b.y * W + b.x, o = b.type === 'ropeway' ? ropeLink(t) : viaLink(t);
    if (o < 0 || comp[t] < 0 || comp[o] < 0) continue;
    parent[find(parent, comp[t])] = find(parent, comp[o]);
    if (b.type === 'viaduct') parentT[find(parentT, compT[t])] = find(parentT, compT[o]);
  }
  const base = own ? (who + 1) * RN_SPAN : 0;
  for (let t = 0; t < N; t++) if (comp[t] >= 0) { comp[t] = find(parent, comp[t]) + base; compT[t] = find(parentT, compT[t]) + base; }
  for (let k = 0; k < ovs.length; k++) { compV[k] = find(parent, compV[k]) + base; compVT[k] = find(parentT, compVT[k]) + base; }
  Object.assign(rn, { of: S, ver: S.roadVer || 0, comp, compT, junc, ovk, compV, compVT });
  rn.bnet.clear();
  rn.bnetT.clear();
  return rn;
}

/**
 * The road networks tile t is on, in roadNet `net` (compT's with trucks): one (-1 off the roads), or on an
 * overpass its east-west road's and its north-south road's, when they aren't joined elsewhere.
 */
function tileNets(net, t, trucks) {
  const c = (trucks ? net.compT : net.comp)[t], k = net.ovk.size ? net.ovk.get(t) : undefined;
  if (k === undefined) return [c];
  const v = (trucks ? net.compVT : net.compV)[k];
  return v === c ? [c] : [c, v];
}

/** Is tile t on any of the road networks in `nets` (an array)? (On an overpass, either of its roads.) */
function onNets(net, t, nets, trucks) {
  for (const c of tileNets(net, t, trucks)) if (c >= 0 && nets.indexOf(c) >= 0) return true;
  return false;
}

/** The road network of tile u for a bot driving onto it from neighbour a: on an overpass, that of the road going straight on. */
function laneComp(net, a, u, trucks) {
  const k = net.ovk.size ? net.ovk.get(u) : undefined;
  if (k === undefined || u - a === 1 || a - u === 1) return (trucks ? net.compT : net.comp)[u];
  return (trucks ? net.compVT : net.compV)[k];
}

/** Is road tile t a crossing: roads on all four sides (where an overpass can go)? */
function isCrossing(t) { return roadNet().junc[t] === 4; }

/**
 * Straight on from tile a onto its neighbour b, an overpass, and over (or under) it and any more beyond: the first
 * tile past them, or -1 at the map's edge. Nobody turns on an overpass (see findPath).
 */
function overHop(a, b) {
  const d = b - a, W = S.W, N = W * S.H;
  let t = b;
  while (S.over[t]) {
    const i = t % W;
    if ((d === 1 && i === W - 1) || (d === -1 && i === 0) || t + d < 0 || t + d >= N) return -1;
    t += d;
  }
  return t;
}

/** Can a Freight Truck or Road Train drive between buildings a and b (by road, not by ropeway)? */
function truckLinked(a, b) {
  if (a === b) return true;
  const na = buildingGroups(a, true), nb = buildingGroups(b, true);
  for (const c of na) if (nb.indexOf(c) >= 0) return true;
  return false;
}

/*
 * Road networks joined by a working ferry line (see ferryLines) count as one for getting goods about: a Ferry
 * carries Haulers, Workers and trucks across. Each line is a node both its Ports touch (roads round them or
 * not), joined with the road networks round both Ports; a network's group is the lowest id among those
 * joined. Worked out once a tick, separately for trucks (their networks leave out Ropeways).
 */
const FERRY_NODE = 1 << 24; // above any road network's id
let _ngTick = -1, _ngFor = null, _ngVer = -1, _ng = null;
function netGroups() {
  if (_ngFor === S && _ngTick === S.tick && _ngVer === (S.roadVer || 0) && _ng) return _ng; // (roads renumber when they change)
  const out = { g: new Map(), gT: new Map(), port: new Map(), bg: new Map(), bgT: new Map(), find: null };
  const lines = typeof ferryLines === 'function' && S.bots ? ferryLines() : null;
  if (lines && lines.size) {
    const find = (m, c) => { let r = c; while (m.has(r) && m.get(r) !== r) r = m.get(r); return r; };
    const join = (m, a, b) => { const ra = find(m, a), rb = find(m, b); if (ra === rb) return; const lo = Math.min(ra, rb); m.set(Math.max(ra, rb), lo); if (!m.has(lo)) m.set(lo, lo); };
    for (const [id, tile] of lines) {
      const a = getE(id), b = getE(S.bAt[tile]);
      if (!a || !b) continue;
      const node = FERRY_NODE + Math.min(a.id, b.id);
      out.port.set(a.id, node);
      for (const [m, tr] of [[out.g, false], [out.gT, true]]) {
        if (!m.has(node)) m.set(node, node);
        for (const c of buildingNets(a, tr)) join(m, node, c);
      }
    }
    out.find = find;
  }
  _ngFor = S; _ngTick = S.tick; _ngVer = S.roadVer || 0; _ng = out;
  return out;
}

/** Road network c's group (networks joined by ferry lines share one, see netGroups). */
function netGroup(c, trucks) { const G = netGroups(); return G.find ? G.find(trucks ? G.gT : G.g, c) : c; }

/** The groups building b touches: its road networks' (see netGroups), and its ferry line's if it's a Port on one. */
function buildingGroups(b, trucks) {
  const G = netGroups();
  if (!G.find) return buildingNets(b, trucks);
  const cache = trucks ? G.bgT : G.bg;
  let out = b.id ? cache.get(b.id) : null;
  if (out) return out;
  const m = trucks ? G.gT : G.g;
  out = [];
  for (const c of buildingNets(b, trucks)) { const r = G.find(m, c); if (out.indexOf(r) < 0) out.push(r); }
  const node = G.port.get(b.id);
  if (node !== undefined) { const r = G.find(m, node); if (out.indexOf(r) < 0) out.push(r); }
  if (b.id) cache.set(b.id, out);
  return out;
}

/** The road networks touching building b (the road tiles right next to it), as its owner's bots can drive them (see roadNet). */
function buildingNets(b, trucks) {
  const net = roadNet(b.owner), comp = trucks ? net.compT : net.comp, cache = trucks ? net.bnetT : net.bnet;
  let nets = cache.get(b.id);
  if (nets) return nets;
  nets = [];
  const t = tIdx(b.x, b.y);
  if (comp[t] >= 0) nets.push(comp[t]); // an Outpost is part of the road through it
  for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (!inMap(b.x + di, b.y + dj)) continue;
    const u = tIdx(b.x + di, b.y + dj), c = laneComp(net, t, u, trucks); // (an Outpost beside an overpass: the road through both)
    if (c >= 0 && canStep(t, u) && nets.indexOf(c) < 0) nets.push(c);
  }
  if (b.id) cache.set(b.id, nets);
  return nets;
}

/** Do buildings a and b share a road network, or networks a ferry line joins (can haulers carry goods between them)? */
function roadLinked(a, b) {
  if (a === b) return true;
  const na = buildingGroups(a), nb = buildingGroups(b);
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

/** Is building b joined by road to its owner's Command Base network? (Road only: see onHomeGroup for ferry lines too.) */
function onHomeNet(b) {
  const h = homeNets(b.owner);
  for (const c of buildingNets(b)) if (h.indexOf(c) >= 0) return true;
  return false;
}

/** Is building b joined to its owner's Command Base by road, or by road and a working ferry line (see netGroups)? */
function onHomeGroup(b) {
  const h = [];
  for (const L of S.buildings) {
    if (L.dead || L.owner !== b.owner || L.type !== 'lander') continue;
    for (const c of buildingGroups(L)) if (h.indexOf(c) < 0) h.push(c);
  }
  for (const c of buildingGroups(b)) if (h.indexOf(c) >= 0) return true;
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
 * long (an oil seep a road would only cover, but it couldn't be pumped till the road went). Starting from `seeds`, stopping at the first tile where done(t) holds (or exploring
 * everything if done is null). Returns { cost, prev, end }. A route to a goal also pays ROAD_TURN for every turn,
 * so of the routes that cost the same the straightest is laid, never a longer one (twenty turns weigh one tile):
 * bots brake for every corner, trucks most of all. The map of costs with no goal (roadReach) stays in whole tiles.
 */
const ROAD_AVOID = 10, ROAD_TURN = 0.05;
function roadWeight(t) {
  if (S.road[t] || S.plan[t] || (S.bAt[t] && passTile(t))) return 0;
  const c = CROSS[S.terrain[t]];
  return c ? c.weight * bridgeMul(t) : S.res[t] ? ROAD_AVOID : 1;
}

function roadSearch(owner, seeds, done) {
  const W = S.W, N = S.W * S.H;
  const cost = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-2); // (doubles, like the heap's keys: see the stale test below)
  const heap = new MinHeap();
  for (const t of seeds) { cost[t] = roadWeight(t); prev[t] = -1; heap.push(t, cost[t]); }
  // (Through our own Outposts and Gates, never a rival's: its bots can't pass one, so a road through it links nothing.)
  const like = (t) => roadLikeFor(t, owner);
  const open = (t) => passTile(t, owner) || canRoad(owner, t % W, (t / W) | 0) || (!S.bAt[t] && S.road[t]);
  const turn = done ? ROAD_TURN : 0, ov = anyOverpass(), rope = hollowOn();
  const step = (a, b) => (like(a) && like(b) ? canStep(a, b) : stepPlan(a, b));
  // The way the route came into tile t: from prev[t], or straight over the overpass(es) just behind it.
  const way = (t) => {
    const d = t - prev[t];
    if (!ov || d === 1 || d === -1 || d === W || d === -W) return d;
    const e = d > 0 ? (d < W ? 1 : W) : (d > -W ? -1 : -W);
    return S.over[t - e] ? e : d;
  };
  while (heap.size) {
    const c = heap.pri[0], t = heap.pop();
    if (c > cost[t]) continue;
    if (done && done(t)) return { cost, prev, end: t };
    const i = t % W;
    for (const n of [i > 0 ? t - 1 : -1, i < W - 1 ? t + 1 : -1, t - W, t + W]) {
      if (n < 0 || n >= N || !open(n) || !step(t, n)) continue;
      let u = n, nc0 = c + roadWeight(n);
      if (ov && S.over[n]) {
        // An overpass: the road runs straight on over (or under) it, never round the corner there.
        u = overHop(t, n);
        for (let x = n; u >= 0 && x !== u; x += n - t) if (!open(x + n - t) || !step(x, x + n - t)) u = -1; else nc0 += roadWeight(x + n - t);
        if (u < 0) continue;
      }
      const nc = turn ? Math.fround(nc0 + (prev[t] >= 0 && n - t !== way(t) ? turn : 0)) : nc0; // (with turns: as cost[] holds it, a turn being no whole number)
      if (nc < cost[u]) { cost[u] = nc; prev[u] = t; heap.push(u, nc); }
    }
    // Across a Viaduct: its deck carries the road from one end to the other.
    const v = viaLink(t);
    if (v >= 0) { const nc = c + roadWeight(v); if (nc < cost[v]) { cost[v] = nc; prev[v] = t; heap.push(v, nc); } }
    // (The Hollow: across one of our Ropeways too, out to a floating Crystal mass, which only a Ropeway or a bridge reaches.)
    const r = rope ? ropeLink(t) : -1;
    if (r >= 0 && getE(S.bAt[t]).owner === owner) { const nc = c + roadWeight(r); if (nc < cost[r]) { cost[r] = nc; prev[r] = t; heap.push(r, nc); } }
  }
  return { cost, prev, end: -1 };
}

/** The open sides of tile (x, y) where a road is or could go. (Beside an overpass: the road straight on past it.) */
function roadSides(owner, x, y) {
  const out = [], bt = tIdx(x, y);
  for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (!inMap(x + di, y + dj)) continue;
    const u = tIdx(x + di, y + dj);
    if (!((roadLike(u) || canRoad(owner, x + di, y + dj)) && (roadLike(u) ? canStep(bt, u) : stepPlan(bt, u)))) continue;
    if (S.over[u]) { const v = overHop(bt, u); if (v >= 0 && roadLike(v) && canStep(v - (u - bt), v)) out.push(v); } else out.push(u);
  }
  return out;
}

/**
 * The cheapest run of new road tiles that would link building b to one of its owner's storage
 * buildings by road: a list of tiles to pave (empty if it is already linked), or null if there is
 * no way through the owner's land. `.cost` is its price in road tiles (resources cost more).
 */
function roadRouteTo(owner, b, join) {
  const g = roadGoals(owner, b);
  if (!g.stores.length) return null;
  // (With join, b is a Command Base of ours on roads of its own, a captured one: the way to the others' roads.)
  if (join ? g.stores.some((s) => roadLinked(s, b)) : onHomeNet(b)) { const r = []; r.cost = 0; r.pending = 0; return r; }
  const net = roadNet(owner);
  const res = roadSearch(owner, roadSides(owner, b.x, b.y), (t) => (net.comp[t] >= 0 && g.nets.has(net.comp[t])) || g.next[t]);
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

/*
 * Route to (Paths, for Roads and Track): the cheapest way to lay road (kind 'road') or track ('rail')
 * for `owner` from any of the `seeds` to tile `goal` (or beside it, if a building stands there). It runs
 * over ground the owner could pave or lay track on, along its own roads or track (almost free), round
 * resource fields unless the detour is long, up or down a one-level cliff where a Ramp could go (a Ramp
 * costs as much as several tiles), over water as a bridge and through rock as a tunnel where those are
 * allowed (dear, so only when it saves a long way round), and with few bends. `have(t)` marks tiles
 * already in the plan (they count as laid). Returns { tiles } (seed first, goal last; consecutive tiles
 * are neighbours, except across a Viaduct) or { why } when there's no way.
 */
const ROUTE_RAMP = 6, ROUTE_RES = 8, ROUTE_OWN = 0.15, ROUTE_BEND = { road: 0.25, rail: 0.6 };
function pathRoute(owner, kind, seeds, goal, have) {
  if (goal < 0 || goal >= S.W * S.H) return { why: 'Outside the map.' };
  const T = routeSearch(owner, kind, seeds, goal, have);
  return T.why ? T : routeFromTree(T, goal, seeds.length);
}

/** The whole search from `seeds` (no goal): read routes to any tile from it with routeFromTree. */
function routeTree(owner, kind, seeds, have) { return routeSearch(owner, kind, seeds, -1, have); }

function routeSearch(owner, kind, seeds, goal, have) {
  const W = S.W, N = W * S.H, rail = kind === 'rail';
  const mine = (t) => (have && have(t)) || (rail
    ? (S.rail[t] && wayOwner(t) === owner) || S.railPlan[t] === owner + 1
    : (roadLike(t) && (S.owner[t] < 0 || S.owner[t] === owner || wayOwner(t) === owner)) || S.plan[t] === owner + 1);
  // Could new road or track go on t, coming from `from` (a bridge carries on from the water tile before it)?
  const open = (t, from) => {
    if (rail) return !railBlocked(owner, t);
    const i = t % W, j = (t / W) | 0;
    if (canRoad(owner, i, j)) return true;
    return from >= 0 && bridgeable(t) && bridgeable(from) && !S.bAt[t] && !scorched(t) && S.owner[t] < 0;
  };
  const weight = (t) => {
    if (mine(t)) return ROUTE_OWN;
    const c = CROSS[S.terrain[t]];
    if (c) return c.weight * bridgeMul(t);
    return S.res[t] ? ROUTE_RES : 1;
  };
  const rampMemo = new Map();
  const rampOk = (t) => { if (!rampMemo.has(t)) rampMemo.set(t, canPlace(owner, 'ramp', t % W, (t / W) | 0).ok); return rampMemo.get(t); };
  // What stepping from a to b costs on top of b's own weight: 0, a Ramp's worth, or -1 (no way).
  const climb = (a, b) => {
    if ((mine(a) || roadLike(a)) && (mine(b) || roadLike(b)) && canStep(a, b)) return 0;
    if (stepPlan(a, b)) return 0;
    if (S.terrain[a] !== T_GROUND || S.terrain[b] !== T_GROUND || Math.abs(S.elev[a] - S.elev[b]) !== 1) return -1;
    return rampOk(a) || rampOk(b) ? ROUTE_RAMP : -1;
  };
  // A building in the way: a route can end beside it (a station, a factory), not go through it.
  const blocks = (t) => S.bAt[t] && !mine(t) && (rail ? !!railBlocked(owner, t) : !passTile(t));
  const goalsOf = (g) => {
    const out = new Set();
    if (!blocks(g)) { out.add(g); return out; }
    const gi = g % W, gj = (g / W) | 0;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (inMap(gi + di, gj + dj)) out.add(tIdx(gi + di, gj + dj));
    return out;
  };
  const goals = goal >= 0 ? goalsOf(goal) : null;
  const starts = [];
  for (const t of seeds) {
    if (!blocks(t)) { starts.push(t); continue; }
    const i = t % W, j = (t / W) | 0;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (inMap(i + di, j + dj)) starts.push(tIdx(i + di, j + dj));
  }
  const best = new Float64Array(N * 4).fill(Infinity), prev = new Int32Array(N * 4).fill(-1), heap = new MinHeap();
  for (const t of starts) {
    if (!(mine(t) || open(t, -1))) continue;
    const c = mine(t) ? 0 : weight(t);
    for (let d = 0; d < 4; d++) if (c < best[t * 4 + d]) { best[t * 4 + d] = c; prev[t * 4 + d] = -2; heap.push(t * 4 + d, c); }
  }
  if (!heap.size) return { why: rail ? 'Start from your own ground, track or a Rail Station.' : 'Start from your own ground or road.' };
  const DIRS = [1, W, -1, -W], bend = ROUTE_BEND[rail ? 'rail' : 'road'], ov = !rail && anyOverpass();
  let end = -1, steps = 0;
  while (heap.size) {
    const c = heap.pri[0], s = heap.pop();
    if (c > best[s]) continue;
    const t = s >> 2, d = s & 3;
    if (goals && goals.has(t)) { end = s; break; }
    if (++steps > 600000) break;
    if (goals === null && blocks(t)) continue; // (a whole-network search reaches buildings, but goes no further)
    const i = t % W;
    const go = (u, nd, extra) => {
      const ns = u * 4 + nd, nc = c + weight(u) + extra + (nd !== d ? bend : 0);
      if (nc < best[ns]) { best[ns] = nc; prev[ns] = s; heap.push(ns, nc); }
    };
    const over = ov && S.over[t] && prev[s] !== -2; // nobody turns on an overpass: the road goes straight on (see findPath)
    for (let nd = 0; nd < 4; nd++) {
      if (over && nd !== d) continue;
      const u = t + DIRS[nd];
      if (u < 0 || u >= N || (nd === 0 && i === W - 1) || (nd === 2 && i === 0)) continue;
      if (blocks(u) && !(goals ? goals.has(u) : false)) continue;
      if (!mine(u) && !open(u, t)) continue;
      const k = climb(t, u);
      if (k < 0) continue;
      go(u, nd, k);
    }
    // Across a Viaduct: its deck carries the road from one end to the other.
    if (!rail) { const v = viaLink(t); if (v >= 0) go(v, d, 0); }
  }
  return { owner, kind, best, prev, end, goalsOf, blocks };
}

/** The route to `goal` read from a search (routeSearch or routeTree): { tiles } or { why }. */
function routeFromTree(T, goal, nSeeds) {
  const rail = T.kind === 'rail', owner = T.owner;
  let end = T.end;
  if (end < 0 || (end >> 2) !== goal) {
    // A whole-network search: the cheapest way into any tile the route may end on.
    let bc = Infinity;
    for (const g of T.goalsOf(goal)) for (let d = 0; d < 4; d++) if (T.best[g * 4 + d] < bc) { bc = T.best[g * 4 + d]; end = g * 4 + d; }
    if (bc === Infinity) end = -1;
  }
  if (end < 0) {
    const g = goal;
    if (S.owner[g] >= 0 && S.owner[g] !== owner) return { why: `A rival holds that ground: ${rail ? 'track' : 'roads'} only run on yours or no-one's.` };
    if (!rail && S.owner[g] < 0 && !crossTile(g) && !reachZone(owner, g)) return { why: 'Your bots can\'t reach there yet: it\'s across water or a cliff from your land.' };
    if (rail && !T.blocks(g) && railBlocked(owner, g)) return { why: railBlocked(owner, g) };
    return { why: `No way to ${rail ? 'lay track' : 'build a road'} there from ${nSeeds > 1 ? 'your network' : 'here'}: a cliff two levels high, a rival's land or deep water in the way?` };
  }
  const tiles = [];
  for (let s = end; s >= 0; s = T.prev[s]) tiles.push(s >> 2);
  return { tiles: tiles.reverse() };
}

/**
 * For every tile, how many road tiles (in Cement terms) it would take to link it to storage:
 * a map for choosing building spots a road can reach cheaply.
 */
function roadReach(owner) {
  const g = roadGoals(owner, null), net = roadNet(owner), seeds = [];
  // (Not an overpass's own tile: roads leave it only straight on, from the roads either side, which are seeds if joined.)
  for (let t = 0; t < S.W * S.H; t++) if (((net.comp[t] >= 0 && g.nets.has(net.comp[t])) || g.next[t]) && !S.over[t]) seeds.push(t);
  return roadSearch(owner, seeds, null).cost;
}

/* ------------------------------------------------------------------ removal */

/** Release any reservations a bot's current task holds, then clear the task. */
function cancelTask(bot, keepLoad = false) {
  const t = bot.task;
  if (!t) return;
  switch (t.type) {
    case 'haul': {
      const src = getE(t.src), dst = getE(t.dst);
      if (t.phase === 'toSrc' && src) bump(src.res, t.good, -(t.n || 1));
      if (dst) bump(dst.inc, t.good, -(t.n || 1));
      if (t.mix) for (const k in t.mix) { if (t.phase === 'toSrc' && src) bump(src.res, k, -t.mix[k]); if (dst) bump(dst.inc, k, -t.mix[k]); }
      if (!keepLoad) dropCarried(bot); // interruption by danger still puts its load down in crates
      break;
    }
    case 'arty': { // a supply run for a Howitzer: release the Ammo it reserved, put down what it carries
      const src = getE(t.src);
      if (t.phase === 'toSrc' && src) bump(src.res, 'ammo', -(t.n || 1));
      dropCarried(bot);
      break;
    }
    case 'crate': {
      const l = t.phase === 'toPile' && S.loot && S.loot.find((x) => x.id === t.pile);
      if (l) unclaimCrate(l, t.good, t.n);
      const dst = t.phase === 'toDst' && getE(t.dst);
      if (dst) bump(dst.inc, t.good, -t.n);
      if (!keepLoad) dropCarried(bot);
      break;
    }
    case 'build': {
      const s = getE(t.site);
      if (s && s.builder === bot.id) s.builder = 0;
      break;
    }
    case 'magfix': { // (a Maglev line's repair: the job is free for another Worker; one out on the line gets off at the Terminal)
      const b = getE(t.bld);
      if (b && b.magFix && b.magFix.u === bot.id) { b.magFix.u = 0; b.magFix.since = 0; }
      if (bot.inside && t.phase === 'ride') { const E = getE(bot.inside); exitBuilding(bot); if (E) { bot.x = E.x + 0.5; bot.y = E.y + 0.5; } }
      break;
    }
    case 'staff': {
      const b = getE(t.bld);
      if (b) {
        if (b.staff === bot.id) {
          b.staff = 0;
          // (A Roadworks has two Pavers: the other one, at work, is its staff now.)
          if (BDEFS[b.type].crews > 1) for (const v of S.bots) if (v !== bot && !v.dead && v.task && v.task.type === 'staff' && v.task.bld === b.id && v.task.phase !== 'go') { b.staff = v.id; break; }
        }
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
  return (task.src === id && (task.type !== 'haul' || task.phase === 'toSrc')) || task.dst === id || task.site === id || task.bld === id || task.target === id || task.home === id;
}

function killBot(bot, quiet) {
  if (bot.dead) return;
  // A warbot carrying loot drops its crate where it falls (anyone's warbots can pick it up).
  if (bot.loot && typeof addLoot === 'function' && inMap(Math.floor(bot.x), Math.floor(bot.y))) { addLoot(Math.floor(bot.x), Math.floor(bot.y), { [bot.loot]: 1 }); bot.loot = null; }
  // A Crawler wrecked on the move spills the goods it was carrying. (A plane's load is lost with it.)
  if (bot.cargo && !BOTS[bot.type].air && typeof addLoot === 'function' && inMap(Math.floor(bot.x), Math.floor(bot.y))) { addLoot(Math.floor(bot.x), Math.floor(bot.y), bot.cargo); bot.cargo = null; }
  // A Tanker with a load on board explodes (see fuelBlast), and its load burns. Any other hauler, truck
  // or train with goods on board drops them.
  const boom = !quiet && (BOTS[bot.type].tanker || BOTS[bot.type].tankShip) && bot.carry && bot.carryN > 0 && typeof fuelBlast === 'function' ? Math.min(1, bot.carryN / BOTS[bot.type].carry) : -1;
  const load = boom >= 0 ? GOOD[bot.carry].name : '';
  if (boom >= 0 || BOTS[bot.type].sea) { bot.carry = null; bot.carryN = 0; } // a ship's load goes down with it
  // A Ferry sunk with bots aboard takes them down with it; anyone waiting for a ferry stops.
  if (BOTS[bot.type].air && typeof planeLost === 'function') planeLost(bot);
  if (bot.aboard) for (const id of bot.aboard) { const v = getE(id); if (v && !v.dead) { v.ferryWait = null; killBot(v, true); } }
  if (bot.ferryWait) bot.ferryWait = null;
  const wasFerry = BOTS[bot.type].ferry;
  if (bot.carry && typeof dropCarried === 'function') dropCarried(bot);
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
  if (wasFerry && typeof ferryChanged === 'function') ferryChanged(); // its line stops
  if (BOTS[bot.type].airship && typeof airChanged === 'function') airChanged(); // (its line may have no Airship left)
  // One of the Murmur on Active: no blast, no fire; the body lies where it fell until they drag it off (murmurBody).
  if (BOTS[bot.type].wild && !quiet && typeof murmurBody === 'function' && murmurBody(bot)) return;
  if (!quiet && typeof scarBotDown === 'function') scarBotDown(bot); // (its scrap stays where it fell: War scars)
  if (boom >= 0) {
    postMsg(bot.owner, `A ${BOTS[bot.type].name} carrying ${load} exploded!`, Math.floor(bot.x), Math.floor(bot.y), 'bad');
    fuelBlast(bot.x, bot.y, 'tanker', boom, bot.owner);
    return;
  }
  // A Torch destroyed with fuel aboard goes up in a fireball that hurts anyone close, friend or foe.
  if (!quiet && BOTS[bot.type].flame && (bot.gel ?? 0) > 1 && typeof fuelBlast === 'function') { fuelBlast(bot.x, bot.y, 'torch', bot.gel / TORCH.tank, bot.owner); return; }
  blastFx(bot.x, bot.y, BOTS[bot.type].army ? 0.6 : 0.4, { small: true });
  // what's left of it burns for a few seconds (a big vehicle longer)
  if (!quiet) addFx('fire', bot.x, bot.y, { r: BOTS[bot.type].truck || BOTS[bot.type].rail || BOTS[bot.type].crawler ? 0.3 : 0.18, life: BOTS[bot.type].truck || BOTS[bot.type].crawler ? 9 : 5, t: -0.3, seed: bot.id % 97 });
  if (!quiet) sfx('botboom', bot.x, bot.y);
}

/**
 * Another finished building of b's owner for the bots aboard a Ferry or a plane to count as inside once b
 * is gone (see releaseBotsFrom): a Port or Airfield first, a garrison only if there's nothing else. Null if none.
 */
function aboardHold(b) {
  let best = null, bs = 0;
  for (const o of S.buildings) {
    if (o === b || o.dead || !o.built || o.owner !== b.owner) continue;
    const d = BDEFS[o.type], s = d.port || d.airfield ? 3 : d.mil ? 1 : 2;
    if (s > bs) { bs = s; best = o; }
  }
  return best;
}

/** Detach every bot that depends on building b (tasks, staff, garrison, idle inside). */
function releaseBotsFrom(b, killInside) {
  let hold;
  for (const u of S.bots) {
    if (u.dead) continue;
    // Its owner's bots drop jobs there; attackers keep their orders (an attack moves on, a march goes on).
    if (u.owner === b.owner && taskRefs(u.task, b.id)) cancelTask(u, u.task?.dst === b.id);
    if (u.inside === b.id) {
      // Aboard a Ferry or a plane that took it on here ("inside" only keeps it out of sight and out of reach):
      // it isn't in the building, wherever its ride is by now. It stays aboard, and stays hidden.
      if (u.ferryWait && u.ferryWait.ferry) { if (hold === undefined) hold = aboardHold(b); u.inside = hold ? hold.id : 0; continue; }
      // A plane parked in a hangar goes with it; so do warbots in an ordinary building, but a fort's garrison
      // (an Outpost or Bunker a Missile or bomb knocks out) scrambles out alive. (A nuke kills them first.)
      if (killInside && ((BOTS[u.type].army && !BDEFS[b.type].mil) || b.staff === u.id || BOTS[u.type].air)) { killBot(u); continue; }
      exitBuilding(u);
    }
  }
  b.staff = 0; b.staffInc = 0; b.builder = 0; b.garInc = 0;
  b.garrison.length = 0;
  b.inc = {}; b.res = {};
}

/**
 * A Viaduct between abutments a and c is coming down: every bot out on its deck scrambles back to
 * the nearer end (never left standing in mid-air, or dropped on the canyon floor).
 */
function offDeck(a, c) {
  const ax = a.x + 0.5, ay = a.y + 0.5, cx = c.x + 0.5, cy = c.y + 0.5, ta = tIdx(a.x, a.y), tc = tIdx(c.x, c.y);
  for (const u of S.bots) {
    if (u.dead || u.inside) continue;
    const on = u.deck ? u.deck.includes(ta) || u.deck.includes(tc)
      : a.x === c.x ? Math.abs(u.x - ax) < 0.7 && u.y > Math.min(ay, cy) + 0.5 && u.y < Math.max(ay, cy) - 0.5
        : Math.abs(u.y - ay) < 0.7 && u.x > Math.min(ax, cx) + 0.5 && u.x < Math.max(ax, cx) - 0.5;
    if (!on) continue;
    const near = dist2(u.x, u.y, ax, ay) <= dist2(u.x, u.y, cx, cy) ? a : c;
    u.x = near.x + 0.5; u.y = near.y + 0.5; u.deck = null;
    if (u.path) {
      u.path = null; u.pi = 0;
      // A civilian bot releases its delivery reservation but keeps any load, like one whose next
      // step jumps a gap that's gone (see moveAlong): left with the order and no route, it counted as arrived,
      // and delivered across the canyon. Warbots, Howitzers, Crawlers and creatures plan their way again (travel).
      const bt = BOTS[u.type];
      if (u.task && !bt.army && !bt.siege && !bt.wild && !bt.crawler) cancelTask(u, true);
    }
    u.vel = 0;
  }
}

/** Remove a building. `burn` = destroyed by force (bots inside die); otherwise bots walk out. */
function destroyBuilding(b, burn, quiet) {
  if (b.dead) return;
  // Arrival City can never be destroyed: anything that would knock it down knocks it to 0 (see cityDown). Only a colony
  // leaving the game, or its own Workers' site being dropped, removes one.
  if (BDEFS[b.type].city && b.built && !b.gone && typeof cityDown === 'function') { b.armor = 0; cityDown(b, -1); return; }
  // An Orbital Lift destroyed by force: a foe's doing, its cable falls along its line (liftDown); a climber on it is lost.
  if (BDEFS[b.type].lift && b.built && typeof liftDown === 'function') liftDown(b, !!burn);
  // A building on the move: losing the old one calls the move off; a cancelled new site frees the old.
  if (b.moving && typeof cancelMove === 'function') cancelMove(b);
  if (b.moveFrom && !b.built) { const o = getE(b.moveFrom); if (o) o.moving = 0; b.moveFrom = 0; }
  // A Refinery destroyed by force explodes: its Crude and Fuel burn in the blast (see fuelBlast).
  const boom = burn && b.built && BDEFS[b.type].explodes && typeof burnLiquids === 'function' ? burnLiquids(b) : -1;
  // Whatever was inside spills out as crates on its tile, for haulers (or raiding warbots) to collect. A construction
  // site destroyed by force (wrecked, blown up) is simply lost, what had been delivered for it with it.
  if (typeof dropLoot === 'function' && (b.built || !burn)) dropLoot(b);
  if (BDEFS[b.type].magterm) magTermDown(b);
  releaseBotsFrom(b, !!burn);
  // A rival AI doesn't build again for five minutes within four tiles of where a building or site of its own was
  // destroyed by force (P.avoid, see aiSearchSpot): it used to put the next one up in the same crater.
  if (burn && b.owner >= 0 && S.players[b.owner] && S.players[b.owner].ai) (S.players[b.owner].avoid = S.players[b.owner].avoid || []).push({ x: b.x, y: b.y, until: S.time + 300, r2: 16 });
  b.dead = true;
  S.byId.delete(b.id);
  S.bAt[tIdx(b.x, b.y)] = 0;
  if (BDEFS[b.type].long) { longRelease(b); const [i2, j2] = longTile(b.x, b.y, b.mdAxis); if (inMap(i2, j2)) markDirty(i2, j2); }
  if (BDEFS[b.type].foot) footRelease(b);
  if (b.type === 'outpost' || b.type === 'keep' || b.type === 'gate' || b.type === 'ropeway' || b.type === 'viaduct') outpostRoads(b.x, b.y);
  // A Ropeway is two stations, a Viaduct two abutments: one going takes the other with it.
  if ((b.type === 'ropeway' || b.type === 'viaduct') && b.link) {
    const o = getE(b.link); b.link = 0;
    if (b.type === 'viaduct' && o) offDeck(b, o);
    if (o && !o.dead) { o.link = 0; destroyBuilding(o, burn); }
    S.roadVer = (S.roadVer || 0) + 1; S.railVer = (S.railVer || 0) + 1;
    computeZones();
  }
  // A Gate that stood on a road leaves the road behind when it goes.
  if (b.type === 'gate' && b.road) setRoad(b.x, b.y, true, b.owner);
  markDirty(b.x, b.y);
  // A Port at one end of a ferry line: the line goes with it, and the areas it joined are apart again.
  if (BDEFS[b.type].port && b.ferryTo) {
    const o = getE(b.ferryTo);
    if (o && o.ferryTo === b.id) o.ferryTo = 0;
    if (typeof ferryChanged === 'function') ferryChanged();
  }
  // A Maglev pylon down cuts its line.
  if (BDEFS[b.type].pylon && typeof magPylonDown === 'function') { if (b.built) magPylonDown(b); else if (b.magFrom) magLineCancel(b); }
  // So does a Mooring Mast at one end of an Airship line (its Airships wait at the other Mast for a new one).
  if (BDEFS[b.type].mast && b.line) {
    const o = getE(b.line);
    if (o && o.line === b.id) o.line = 0;
    b.line = 0;
    airChanged();
  }
  // (blown up: an explosion; taken down on purpose, dismantled or moved: no wreck, the rubble just comes down)
  if (!quiet) { collapseFx(b, burn); sfx(burn ? 'boom' : 'collapse', b.x + 0.5, b.y + 0.5); }
  if ((BDEFS[b.type].mil || civClaims(b)) && b.built && !(typeof LAND_HOLD !== 'undefined' && LAND_HOLD)) computeTerritory(); // (a nuclear blast works the land out once, when it's done: nukeImpact)
  if (burn && b.built && !quiet && typeof scarBuildingDown === 'function') scarBuildingDown(b); // (its rubble stays: War scars)
  if (boom >= 0) fuelBlast(b.x + 0.5, b.y + 0.5, b.type, boom, b.owner);
}

/* ------------------------------------------------------------------ messages & effects */

/*
 * Who's who. ME is the player on this device: 0 in a single-player game; in multiplayer the lobby sets it. It decides
 * only what's shown and heard here (messages, sounds, panels, the camera), never the rules: every device runs the same
 * game, so anything that changes it must come out the same whoever is watching. human(p) is the rules' question
 * (is colony p played by a person?), the same on every device.
 */
let ME = 0;
function isMe(p) { return p === ME; }
function human(p) { const P = S.players[p]; return !!P && !P.ai; }
/**
 * Teams (S.teams[p], a 2-vs-2 game): are players p and q enemies? Without teams, everyone but yourself is (so this is
 * just p !== q); neutral owners (-1) are everyone's. Allies don't shoot, shell, bomb, raid or capture each other.
 */
function foes(p, q) { return p !== q && !(S && S.teams && p >= 0 && q >= 0 && S.teams[p] !== undefined && S.teams[p] === S.teams[q]); }
/** The Murmur's player slot (owner of their nests, exits and creatures): Colony's empty second slot, else one after the colonies. */
function wildOwner() { return S && S.wildOwner !== undefined ? S.wildOwner : WILD_OWNER; }
/** Is p the Murmur (in a game that has them)? */
function isWild(p) { return !!(S && S.wildlife && p === wildOwner()); }
/** Player p's colour where a colour stands for them (the Murmur: their violet). */
function ownerColor(p) { return isWild(p) || (S && S.mode === 'colony' && p === WILD_OWNER && S.wildlife) ? WILD_COLOR : PLAYER_COLORS[p] || '#9aa2ab'; }
/** Is building b a Murmur nest (a nest, or the Hollow's Deep's mound, the biggest of them)? */
function isNestB(b) { return !!b && (b.type === 'nest' || b.type === 'mound'); }
/** How many colonies the game was set up for (the Murmur's own slot, in a Versus game with them, isn't one). */
function nColonies() { return S.players.length - (S.wildSlot ? 1 : 0); }
/** ...on the same team (and not the same player). */
function allies(p, q) { return p !== q && !foes(p, q); }
/** Player p's team (without teams: their own number). */
function teamOf(p) { return S && S.teams && S.teams[p] !== undefined ? S.teams[p] : p; }

/** A message for player `player`: shown on their device only (the others' messages aren't kept here). */
function postMsg(player, text, x, y, kind) {
  if (player !== ME) return;
  S.msgs.push({ text, x, y, kind: kind || 'info', t: S.time });
}

/*
 * The story's voices (see NARRATOR and PERSONALITIES[k].voice in defs.js). Text only: a line goes to its player's
 * messages, and S.lore remembers what has been said (when, by key and player) so a line isn't said again too soon.
 * No rule reads S.lore and the multiplayer fingerprint (hashState) leaves it out; it is kept with a save, so a loaded
 * game doesn't say its "first road" twice. Missions keep their own texts: no narrator and no voices there.
 */
function loreDue(key, every) {
  if (!S || S.mission) return false;
  const L = S.lore || (S.lore = {});
  if (L[key] !== undefined && (!every || S.time - L[key] < every)) return false;
  L[key] = S.time;
  return true;
}
/**
 * The narrator (your colony's Command AI) tells player p: NARRATOR[key] (or `text`), once a game, or with `every`
 * at most once every that many seconds. The simulation calls it for every player alike; the interface calls it for
 * this device's player only (the first nightfall, nightfallLine), so S.lore can differ between devices, which is why
 * nothing but these lines reads it.
 */
function narrate(p, key, x, y, every, text) {
  if (p < 0 || !loreDue(`n.${key}.${p}`, every)) return;
  postMsg(p, text || NARRATOR[key], x, y, 'narr');
}
/**
 * Computer player p, in its doctrine's voice, to player `to` (its enemy): what = 'attack', 'missile', 'nuke' (a
 * nuclear launch: the Missile lines, under a key of its own, so an earlier Missile's line doesn't silence it) or
 * 'surrender', at most once every `every` seconds for each of them (without `every`: once a game). The line is picked
 * by the time and the players, not the RNG.
 */
function doctrineVoice(p, to, what, x, y, every) {
  const P = S && S.players[p];
  if (!P || !P.ai || S.mode === 'colony' || to < 0 || !foes(p, to) || !isDoctrine(P.style)) return;
  const D = PERSONALITIES[P.style], lines = D.voice && D.voice[what === 'nuke' ? 'missile' : what];
  if (!lines || !lines.length || !loreDue(`v.${what}.${p}.${to}`, every)) return;
  const line = lines[Math.floor(hash2(p * 7 + to, Math.floor(S.time), what.length + (S.seed | 0)) * lines.length)].replace('{day}', wardenDay(S.time));
  postMsg(to, `${callsign(p)} (${D.name}): \u201c${line}\u201d`, x, y, 'voice');
}

function addFx(type, x, y, data) {
  const f = { type, x, y, t: 0, life: type === 'smoke' ? 2.5 : type === 'laser' ? 0.25 : type === 'float' ? 1.2 : 0.6, tick: S.tick };
  if (data) Object.assign(f, data);
  S.fx.push(f);
}

/*
 * Weapon effects (all cosmetic; see drawEffects and drawDecals, and FX_ART for the art that can
 * replace each one). The pseudo-random spread comes from hash2, so it doesn't touch the game's RNG.
 */
const FX_MAX = 700;    // past this many live effects, the small ones (dust, wisps) are skipped
const DECAL_MAX = 350; // ground marks kept at once (the oldest go first)

/** A mark left on the ground: 'pock' (bullet holes) or 'scorch' (a burn), fading out over `life` seconds. */
function addDecal(kind, x, y, r, life) {
  S.decals = S.decals || [];
  S.decals.push({ kind, x, y, r, t0: S.time, life, s: Math.floor(hash2(Math.floor(x * 7), Math.floor(y * 7), S.tick) * 997) });
  if (S.decals.length > DECAL_MAX) S.decals.splice(0, S.decals.length - DECAL_MAX);
}

/**
 * A shot from (x, y) at (tx, ty): a muzzle flash and a wisp of gun smoke at the barrel, a tracer, and
 * where it lands a few rounds peppering the ground round the target (dust kicked up, pockmarks left).
 * opts.color: the shooter's team; opts.pulse: an energy weapon (a glow, no smoke or tracer; scorch
 * pocks); opts.structure: hitting a building (sparks off its plating, no marks on the ground).
 */
function shotFx(x, y, tx, ty, opts) {
  const o = opts || {}, a = datan2(ty - y, tx - x), mx = x + dcos(a) * 0.32, my = y + dsin(a) * 0.32;
  const busy = S.fx.length > FX_MAX;
  addFx('muzzle', mx, my, { a, color: o.pulse ? o.color : '#fff1b8', life: 0.1, pulse: !!o.pulse });
  if (!o.pulse) {
    if (!busy) addFx('puff', mx, my - 0.05, { r: 0.16, life: 0.9 });
    // A short burst of tracer rounds, glowing in the shooter's colour, each flying out to the target (about 17
    // tiles a second); hitting armour, now and then one glances off and skips away.
    const fly = Math.max(0.1, dist(mx, my, tx, ty) / 17), n = busy ? 1 : 2;
    for (let k = 0; k < n; k++) {
      const h = hash2(Math.floor(tx * 17) + k, Math.floor(ty * 13), S.tick + 11);
      addFx('tracer', mx, my, { x2: tx + (h - 0.5) * 0.25, y2: ty + (hash2(k, S.tick, 3) - 0.5) * 0.25, life: fly, t: -k * 0.07, color: o.color || '#ffe08a' });
    }
    if (o.structure && !busy && hash2(Math.floor(tx * 7), S.tick, 19) < 0.4) {
      const ra = hash2(S.tick, Math.floor(ty * 9), 23) * Math.PI * 2, rl = 0.6 + 0.6 * hash2(S.tick, 5, 29);
      addFx('tracer', tx, ty, { x2: tx + dcos(ra) * rl, y2: ty + dsin(ra) * rl * 0.7, life: 0.14, t: -fly, rico: true, color: '#ffd27a' });
    }
  }
  const n = o.pulse ? 1 : 3;
  for (let k = 0; k < n; k++) {
    const h1 = hash2(Math.floor(tx * 13) + k, Math.floor(ty * 13), S.tick), h2 = hash2(Math.floor(ty * 11), Math.floor(tx * 17) + k, S.tick + 3);
    const spread = k === 0 ? 0.12 : 0.45, px = tx + (h1 - 0.5) * 2 * spread, py = ty + (h2 - 0.5) * 2 * spread;
    if (o.pulse && k === 0) addFx('heat', px, py, { color: '#aa5cff', life: 1.4 }); // the spot it struck glows, cooling (the beam's violet)
    if (o.structure) addFx('spark', px, py, { color: '#ffd27a', life: 0.35, hit: true });
    else {
      if (!busy) addFx('dust', px, py, { life: 0.55, seed: k + S.tick });
      if (k > 0 || o.pulse) addDecal(o.pulse ? 'burn' : 'pock', px, py, o.pulse ? 0.14 : 0.1, o.pulse ? 30 : 25);
    }
  }
}

/**
 * An explosion of radius r at (x, y): a white flash, the fireball, chunks of debris thrown out, a
 * column of smoke and a scorch mark left on the ground. opts.small: a robot or a mortar shell.
 */
function blastFx(x, y, r, opts) {
  const o = opts || {}, t = -(o.delay || 0); // a delayed blast waits (t < 0) before it shows
  addFx('flash', x, y, { r: r * 1.3, life: 0.15, t });
  addFx('boom', x, y, { r, t, life: o.small ? 0.75 : 1.0, small: !!o.small, seed: (x * 3.7 + y * 1.3) % 1 });
  addFx('debris', x, y, { r: Math.max(0.6, r), life: 0.9, n: o.small ? 5 : 9, seed: S.tick + Math.floor(x * 31 + y * 17), t });
  addFx('smoke', x, y, { r: Math.max(0.4, r * 0.6), life: o.small ? 1.6 : 3, t });
  addDecal('scorch', x, y, Math.max(0.35, r * 0.7), o.small ? 35 : 70);
}

/**
 * A building coming down. Destroyed (burn): a fireball and two more blasts as it goes, then it sinks
 * and crumbles into a cloud of dust. Dismantled or lost: the same collapse and dust, without the fire.
 * Either way it leaves rubble on the ground for a while (and a scorch mark if it burned).
 */
function collapseFx(b, burn) {
  const big = b.type === 'lander' ? 1.6 : 1, x = b.x + 0.5, y = b.y + 0.5;
  const h = (k) => hash2(b.x * 7 + k, b.y * 13, b.id);
  if (b.built && !BDEFS[b.type].viaduct && b.type !== 'ropeway') {
    addFx('collapse', x, y, { btype: b.type, owner: b.owner, life: 1.5, aim: b.aim, s: big, lean: h(1) < 0.5 ? -1 : 1, t: burn ? -0.15 : 0 });
  }
  addFx('dustcloud', x, y + 0.25 * big, { r: 0.9 * big, life: 2.2, t: burn ? -0.3 : 0, seed: b.id });
  if (burn) {
    addFx('fire', x, y + 0.1, { r: 0.42 * big, life: 16, t: -0.4, seed: b.id % 97 }); // the wreck burns for a while
    blastFx(x, y, 1.1 * big);
    blastFx(x + (h(2) - 0.5) * 0.8 * big, y + (h(3) - 0.6) * 0.6 * big, 0.6 * big, { small: true, delay: 0.35 });
    blastFx(x + (h(4) - 0.5) * 0.8 * big, y + (h(5) - 0.4) * 0.6 * big, 0.5 * big, { small: true, delay: 0.7 });
  }
  addDecal('rubble', x, y + 0.08, 0.55 * big, 90);
}

/** An electric arc from (x, y) to (x2, y2), crackling for a moment. */
function arcFx(x, y, x2, y2, color) { addFx('arc', x, y, { x2, y2, color: color || '#8fd8ff', life: 0.3, seed: S.tick }); }

/* ------------------------------------------------------------------ save / load */

const SAVE_KEY = 'botfall.save.v1'; // the game's first name: kept so saves carry over
const MAP_LAYERS = ['lava', 'ford', 'tidal', 'fault', 'tun']; // optional per-tile layers some games have (null otherwise; tun: the Murmur's tunnels)
/** Per-tile layers kept in a save as [tile, value, tile, value, ...] for the tiles that aren't 0 (most aren't): War scars' craters and ash. */
const SPARSE_LAYERS = ['crater', 'ash'];
function sparseOut(a) { const o = []; for (let t = 0; t < a.length; t++) if (a[t]) o.push(t, a[t]); return o; }
function sparseIn(o, N) { const a = new Uint8Array(N); for (let k = 0; k + 1 < o.length; k += 2) a[o[k]] = o[k + 1]; return a; }
const TYPED_FIELDS = {
  terrain: Uint8Array, res: Uint8Array, amt: Uint8Array, grow: Float32Array, road: Uint8Array, owner: Int8Array,
  resRes: Uint8Array, elev: Uint8Array, ramp: Uint8Array, fert: Uint8Array, pave: Uint8Array, plan: Uint8Array,
  wear: Uint16Array, paveMark: Uint8Array, xdir: Uint8Array, decor: Uint8Array, rail: Uint8Array, owe: Uint8Array, railPlan: Uint8Array,
  pipe: Uint8Array, pipePlan: Uint8Array, wown: Int8Array, lava: Uint8Array, ford: Uint8Array, tidal: Uint8Array, fault: Uint8Array,
  heat: Float32Array, // (the traffic map's flow: see HEAT)
  tun: Uint8Array, // (the Murmur's tunnels: see murmurTick)
};

function serializeGame() {
  const o = {};
  for (const k in S) {
    if (k === 'byId' || k === 'fx' || k === 'decals' || k === 'msgs' || k === 'dirtyTiles' || k === 'bAt' || k === 'zone') continue;
    o[k] = TYPED_FIELDS[k] && S[k] ? Array.from(S[k]) : SPARSE_LAYERS.includes(k) && S[k] ? sparseOut(S[k]) : S[k]; // (exactly: a multiplayer game reloads a save to catch up)
  }
  o.buildings = S.buildings.filter((b) => !b.dead);
  o.bots = S.bots.filter((u) => !u.dead);
  return JSON.stringify(o);
}

/** Is k one of table's own entries? (A save's type "constructor" is not a building.) */
function ownKey(table, k) { return typeof k === 'string' && Object.prototype.hasOwnProperty.call(table, k); }

/*
 * A save is untrusted: people pass save files around, and one may be damaged, hand-edited or from a newer
 * version (and a multiplayer catch-up comes from another device). checkSave throws on one this version
 * can't run, before anything is loaded: unknown building, robot, good, biome, map type, mission or event,
 * map layers of the wrong size, owners or places off the map. And no text in a save may hold < > or ":
 * the game never writes them (statuses are plain sentences, names are letters and digits), and the panels
 * show what a save holds as HTML, so a file carrying markup would run it the moment it loaded.
 */
function checkSave(o) {
  const bad = () => { throw new Error('Unsupported save'); };
  const obj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
  if (!obj(o) || o.v !== 1) bad();
  if (!Number.isInteger(o.W) || !Number.isInteger(o.H) || o.W < 1 || o.H < 1 || o.W * o.H > 1e6) bad();
  if (o.settings?.size != null && (!Number.isInteger(o.settings.size) || !SIZE_PRESETS[o.settings.size])) bad();
  if (o.mission?.workerDrop !== undefined && typeof o.mission.workerDrop !== 'boolean') bad();
  if (o.mode != null && o.mode !== 'versus' && o.mode !== 'colony') bad();
  if (o.difficulty != null && !ownKey(DIFFICULTY, o.difficulty)) bad();
  for (const k in TYPED_FIELDS) if (o[k] != null && (!Array.isArray(o[k]) || o[k].length !== o.W * o.H)) bad();
  // (as many colonies as there are colours, and the Murmur's own slot after them: see murmurStart)
  if (!Array.isArray(o.players) || !o.players.length || o.players.length > PLAYER_COLORS.length + (o.wildSlot ? 1 : 0) || !Array.isArray(o.buildings) || !Array.isArray(o.bots)) bad();
  if (o.wildOwner != null && !(Number.isInteger(o.wildOwner) && o.wildOwner >= 0 && o.wildOwner < o.players.length)) bad();
  if (o.mur != null) {
    const M = o.mur;
    if (!obj(M) || (M.nests != null && !(Array.isArray(M.nests) && M.nests.length < 255 && M.nests.every(Number.isInteger)))) bad();
    if (M.shut != null && !(Array.isArray(M.shut) && M.shut.every((e) => obj(e) && Number.isInteger(e.x) && Number.isInteger(e.y) && Number.isFinite(e.until)))) bad();
    // Their craft (Active: see murmurPlan): plans of numbers, memories of [x, y, weight], their dead, the dark they made.
    const nums = (e, ks) => obj(e) && ks.every((k) => e[k] == null || Number.isFinite(e[k]));
    if (M.plans != null && !(Array.isArray(M.plans) && M.plans.length < 64 && M.plans.every((pl) => obj(pl) &&
      nums(pl, Object.keys(pl).filter((k) => k !== 'cut' && k !== 'feintGuard')) &&
      (pl.feintGuard == null || (Array.isArray(pl.feintGuard) && pl.feintGuard.length <= 10000 && pl.feintGuard.every((id) => Number.isSafeInteger(id) && id > 0))) &&
      Array.isArray(pl.cut) && pl.cut.every((c) => Array.isArray(c) && c.length <= 5 && c.every(Number.isFinite))))) bad();
    if (M.mem != null && !(obj(M.mem) && Object.keys(M.mem).every((k) => (k === 'kill' || k === 'fed') && Array.isArray(M.mem[k]) && M.mem[k].length < 64 && M.mem[k].every((e) => Array.isArray(e) && e.length === 3 && e.every(Number.isFinite))))) bad();
    if (M.dead != null && !(Array.isArray(M.dead) && M.dead.length <= 64 && M.dead.every((d) => nums(d, ['id', 'x', 'y', 't', 'by']) && ownKey(BOTS, d.type)))) bad();
    if (M.dark != null && !(Array.isArray(M.dark) && M.dark.length < 256 && M.dark.every((d) => nums(d, ['x', 'y', 'r', 'until'])))) bad();
  }
  const owner = (p) => p === -1 || (Number.isInteger(p) && !!o.players[p]);
  for (const P of o.players) if (!obj(P) || !obj(P.stats) || (P.research && !(obj(P.research) && ownKey(TECHS, P.research.key)))) bad();
  const deal = (f) => { if (!obj(f) || !ownKey(GOOD, f.give) || !ownKey(GOOD, f.get)) bad(); };
  for (const P of o.players) if (P.trade != null) {
    if (!obj(P.trade) || (P.trade.sat != null && !obj(P.trade.sat)) || (P.trade.offers != null && !Array.isArray(P.trade.offers))) bad();
    (P.trade.offers || []).forEach(deal); // (a save from before trade routes: its contracts)
    for (const g in P.trade.sat || {}) if (!ownKey(GOOD, g)) bad();
  }
  // Co-op: the people running a shared colony (S.crew, by lockstep player: their name and colony), and the site
  // badges (b.by) that point at them.
  if (o.crew != null && !(Array.isArray(o.crew) && o.crew.length <= 8 && o.crew.every((c) => c === null || (obj(c) && typeof c.n === 'string' && c.n.length <= 16 && owner(c.c) && c.c >= 0)))) bad();
  const tileOk = (t) => Number.isInteger(t) && t >= 0 && t < o.W * o.H;
  for (const b of o.buildings) {
    if (b.by != null && !(Number.isInteger(b.by) && o.crew && o.crew[b.by])) bad();
    if (!obj(b) || !ownKey(BDEFS, b.type) || !owner(b.owner) || !Number.isInteger(b.x) || !Number.isInteger(b.y) || b.x < 0 || b.y < 0 || b.x >= o.W || b.y >= o.H) bad();
    for (const c of ['stock', 'inc']) if (b[c] != null) { if (!obj(b[c])) bad(); for (const g in b[c]) if (!ownKey(GOOD, g)) bad(); }
    if (b.route != null) deal(b.route); // a Trade Terminal's route
    if (b.lane != null && (!Array.isArray(b.lane) || !b.lane.every((t) => Number.isInteger(t) && t >= 0 && t < o.W * o.H))) bad();
    if (b.magMissing != null && (b.type !== 'magterm' || !obj(b.magMissing) || !Number.isInteger(b.magMissing.x) ||
      !Number.isInteger(b.magMissing.y) || b.magMissing.x < 0 || b.magMissing.x >= o.W ||
      b.magMissing.y < 0 || b.magMissing.y >= o.H || typeof b.magMissing.near !== 'boolean')) bad();
    if (b.magLayout != null && (!Array.isArray(b.magLayout) || b.magLayout.length > Math.floor(MAGLEV.max / MAGLEV.spacing) ||
      !b.magLayout.every((t) => t === -1 || tileOk(t)))) bad();
    // a Mass Driver's aim and goods list (see setMdAim, setMdSend): an id, and up to MASSDRIVER.goods goods with their reserves
    if (b.mdTo != null && !(Number.isSafeInteger(b.mdTo) && b.mdTo >= 0)) bad();
    if (b.mdAxis != null && b.mdAxis !== 'ew' && b.mdAxis !== 'ns') bad();
    if (b.mdSend != null && !(obj(b.mdSend) && Object.keys(b.mdSend).length <= MASSDRIVER.goods && Object.keys(b.mdSend).every((g) => ownKey(GOOD, g) && Number.isFinite(b.mdSend[g])))) bad();
    for (const k of ['mdFire', 'mdCd', 'mdLast', 'mdShot', 'mdSent', 'mdGot', 'mdCaught']) if (b[k] != null && !Number.isFinite(b[k])) bad();
    // a megastructure's state (the Lance: its aim, charge and power; the Shield Dome: its strength): plain numbers and words
    if (b.lAim != null && !(Array.isArray(b.lAim) && b.lAim.length === 2 && Number.isInteger(b.lAim[0]) && Number.isInteger(b.lAim[1]) && b.lAim[0] >= 0 && b.lAim[1] >= 0 && b.lAim[0] < o.W && b.lAim[1] < o.H)) bad();
    if (b.lSrc != null && !['', 'gen', 'reactor'].includes(b.lSrc)) bad();
    for (const k of ['lOn', 'lCharge', 'lReload', 'lReactor', 'lShot', 'lTime', 'dStr', 'dHit', 'dDown', 'dCry', 'dUp']) if (b[k] != null && !Number.isFinite(b[k])) bad();
    // the Orbital Lift (see updateLift): its fall line, the Carrier's reserve, the climber and the goods it sends up
    // the Great Uplink (see updateGup): transmitting, its clock, who began it, jammed by whom, the last alert, power
    if (b.gSrc != null && !['', 'gen', 'reactor'].includes(b.gSrc)) bad();
    for (const k of ['gOn', 'gT', 'gBy', 'gJam', 'gWarn', 'gPow', 'gBest', 'gU']) if (b[k] != null && !Number.isFinite(b[k])) bad();
    if (b.lfDir != null && !(Number.isInteger(b.lfDir) && b.lfDir >= 0 && b.lfDir < 8)) bad();
    if (b.lfMove != null && ![0, 1, 2].includes(b.lfMove)) bad();
    if (b.lfLoad != null && b.lfLoad !== '' && !ownKey(LIFT.drops, b.lfLoad)) bad();
    for (const k of ['lfRes', 'lfBoost', 'lfCd', 'lfT', 'lfMul', 'lfPaid', 'lfUps', 'lfDrops', 'lfWarn', 'lfFeed', 'lfWait']) if (b[k] != null && !Number.isFinite(b[k])) bad();
    if (b.lfSend != null && !(obj(b.lfSend) && Object.keys(b.lfSend).length <= LIFT.goods && Object.keys(b.lfSend).every((g) => LIFT_GOODS.includes(g) && Number.isFinite(b.lfSend[g])))) bad();
    // a Murmur nest's tunnel branches (see murmurGrow): each its head and goal tiles and the tiles it has left to dig
    if (b.br != null && !(Array.isArray(b.br) && b.br.every((e) => obj(e) && [e.h, e.g].every((t) => Number.isInteger(t) && t >= 0 && t < o.W * o.H) && Number.isFinite(e.k)))) bad();
  }
  for (const u of o.bots) if (!obj(u) || !ownKey(BOTS, u.type) || !owner(u.owner) || !Number.isFinite(u.x) || !Number.isFinite(u.y) || (u.carry != null && !ownKey(GOOD, u.carry)) || (u.drag && !ownKey(BOTS, u.drag)) ||
    (u.pose != null && !['walk', 'feed', 'spit', 'dig', 'under', 'up'].includes(u.pose)) || (u.charge != null && !Number.isFinite(u.charge))) bad();
  for (const u of o.bots) {
    if (u.task?.arterialTiles != null && (!Number.isSafeInteger(u.task.arterialTiles) || u.task.arterialTiles < 0)) bad();
    if (u.idleSince != null && (!Number.isFinite(u.idleSince) || u.idleSince < 0)) bad();
    if (u.recycleTo != null && !(Number.isSafeInteger(u.recycleTo) && u.recycleTo >= 0)) bad();
    if (u.task?.type === 'recycle' && (!(Number.isSafeInteger(u.task.bld) && u.task.bld > 0) ||
      (u.task.t != null && (!Number.isFinite(u.task.t) || u.task.t < 0)))) bad();
  }
  if (o.settings != null) {
    const st = o.settings;
    if (st.size === PLANETARY_SIZE) {
      const max = SIZE_PRESETS[PLANETARY_SIZE];
      if (st.players > 2 || o.W * o.H > max.w * max.h) bad();
    }
    if (st.biome2 != null && !secondBiomeAllowed(st.biome2, st.biome, st.size, st.shape)) bad();
    if (st.biomeBoundary != null && (!st.biome2 || !Number.isFinite(st.biomeBoundary) || Math.abs(st.biomeBoundary) > 1)) bad();
    if (!obj(st) || (st.biome != null && !ownKey(BIOMES, st.biome)) || (st.shape != null && !(Number.isInteger(st.shape) && st.shape >= 0 && st.shape < SHAPE_PRESETS.length))) bad();
    if (st.murmur != null && !murmurLevelOk(st.murmur)) bad();
    if (st.scars != null && !scarsOk(st.scars)) bad();
    if (st.mega != null && typeof st.mega !== 'boolean') bad();
    if (st.upWin != null && typeof st.upWin !== 'boolean') bad();
  }
  if (o.mission) {
    const M = o.mission;
    if (!obj(M) || ![0, 1, 2].includes(M.diff)) bad();
    if (M.id === 'arterial' && (![M.arterialDepot, M.arterialRuns].every((n) => Number.isSafeInteger(n) && n >= 0) || M.arterialDepot === 0)) bad();
    if (typeof MISSIONS !== 'undefined' && !(MISSIONS.some((m) => m.id === M.id) || (Number.isInteger(M.k) && MISSIONS[M.k]))) bad();
  }
  // The Hollow's places (S.hollow) and its tremors (S.tremor): plain numbers, every place on the map.
  if (o.hollow != null) {
    const H0 = o.hollow, at = (p) => obj(p) && Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.y >= 0 && p.x < o.W && p.y < o.H;
    if (!obj(H0) || !at(H0.deep)) bad();
    for (const k of ['breaches', 'masses', 'nests']) if (!Array.isArray(H0[k]) || !H0[k].every(at)) bad();
    if (!H0.breaches.every((b) => Number.isFinite(b.r))) bad();
    if (!Array.isArray(H0.pillars) || !H0.pillars.every((t) => Number.isInteger(t) && t >= 0 && t < o.W * o.H)) bad();
    if (H0.chambers != null && !(Array.isArray(H0.chambers) && H0.chambers.every(at))) bad(); // (older saves have none: drawn without them)
  }
  if (o.tremor != null && !(obj(o.tremor) && Number.isFinite(o.tremor.next) && (o.tremor.rock == null || Array.isArray(o.tremor.rock)))) bad();
  // Aircraft wrecks (S.wrecks, see crashLand): numbers, a plain word for the aircraft, the tiles under it on the map.
  if (o.wrecks != null && !(Array.isArray(o.wrecks) && o.wrecks.length <= 4 * WRECK_MAX && o.wrecks.every((w) => obj(w) && Number.isInteger(w.id) &&
    ['x', 'y', 'a', 't'].every((k) => Number.isFinite(w[k])) && typeof w.type === 'string' && /^[a-z][a-z0-9]{0,23}$/i.test(w.type) && owner(w.owner) &&
    Array.isArray(w.tiles) && w.tiles.length > 0 && w.tiles.length <= 16 && w.tiles.every(tileOk)))) bad();
  // War scars: craters and ash as tile and value pairs, scrap piles and bones (numbers on the map).
  for (const k of SPARSE_LAYERS) if (o[k] != null && !(Array.isArray(o[k]) && o[k].length % 2 === 0 && o[k].length <= 2 * o.W * o.H &&
    o[k].every((v, n) => (n % 2 ? Number.isInteger(v) && v > 0 && v < 256 : tileOk(v))))) bad();
  const onMap = (e) => obj(e) && Number.isFinite(e.x) && Number.isFinite(e.y) && e.x >= 0 && e.y >= 0 && e.x < o.W && e.y < o.H;
  if (o.scrap != null && !(Array.isArray(o.scrap) && o.scrap.length <= 2 * SCARS.scrapMax && o.scrap.every((s) => onMap(s) && Number.isSafeInteger(s.id) &&
    ['n', 'k', 'c', 'a'].every((k) => Number.isFinite(s[k])) && (s.o == null || owner(s.o)) && (s.w == null || Number.isSafeInteger(s.w))))) bad();
  if (o.bones != null && !(Array.isArray(o.bones) && o.bones.length <= 2 * SCARS.bonesMax && o.bones.every((b) => onMap(b) && Number.isFinite(b.k) && Number.isFinite(b.a)))) bad();
  // The Lance of Corvane's cuts across the map (S.cuts, see lanceFire): numbers on the map.
  if (o.cuts != null && !(Array.isArray(o.cuts) && o.cuts.length <= 4 * LANCE.cutsMax && o.cuts.every((c) => obj(c) && ['x0', 'y0', 'x1', 'y1', 't'].every((k) => Number.isFinite(c[k])) && owner(c.o) && (c.w == null || (Number.isFinite(c.w) && c.w > 0 && c.w <= 8)) &&
    [c.x0, c.x1].every((x) => x >= -1 && x <= o.W + 1) && [c.y0, c.y1].every((y) => y >= -1 && y <= o.H + 1)))) bad();
  // Orbital Lift cables coming down (S.liftFalls, see liftFall): numbers, a direction, owners, the anchor on the map.
  if (o.liftFalls != null && !(Array.isArray(o.liftFalls) && o.liftFalls.length <= 64 && o.liftFalls.every((f) => obj(f) && ['id', 't', 'k', 'sp', 'n', 'ax', 'ay'].every((k) => Number.isFinite(f[k])) &&
    Number.isInteger(f.d) && f.d >= 0 && f.d < 8 && owner(f.o) && Number.isFinite(f.by) && f.ax >= 0 && f.ay >= 0 && f.ax < o.W && f.ay < o.H && f.n >= 0 && f.n <= o.W + o.H))) bad();
  // Mass Driver canisters in flight (S.cans, see mdLaunch): numbers, owners, goods, places on the map.
  if (o.cans != null && !(Array.isArray(o.cans) && o.cans.length <= 4096 && o.cans.every((m) => obj(m) && owner(m.owner) && obj(m.goods) &&
    Object.keys(m.goods).every((g) => ownKey(GOOD, g) && Number.isFinite(m.goods[g])) && ['id', 'from', 'to', 't', 'dur', 'hp'].every((k) => Number.isFinite(m[k])) && m.dur > 0 &&
    [m.x0, m.x1].every((x) => Number.isFinite(x) && x >= 0 && x <= o.W) && [m.y0, m.y1].every((y) => Number.isFinite(y) && y >= 0 && y <= o.H)))) bad();
  // The Ring drizzle (S.drizzle, see updateDrizzle): its clock, its deposits and the pieces in the sky, numbers and tiles.
  if (o.drizzle != null) {
    const D = o.drizzle, rk = (r) => r === R_ORE || r === R_CRYSTAL || r === R_URANIUM, tile2 = (t) => t === -1 || tileOk(t);
    if (!obj(D) || !Number.isFinite(D.next) || !Number.isInteger(D.n) || !Array.isArray(D.spots) || D.spots.length > 64 ||
      !D.spots.every((z) => obj(z) && tileOk(z.t) && tile2(z.u) && rk(z.r) && Number.isFinite(z.at)) ||
      (D.fall != null && !(obj(D.fall) && Number.isFinite(D.fall.at) && rk(D.fall.r) && Number.isInteger(D.fall.amt) && D.fall.amt > 0 && D.fall.amt < 256 &&
        Array.isArray(D.fall.tiles) && D.fall.tiles.length <= 8 && D.fall.tiles.every((pr) => Array.isArray(pr) && pr.length === 2 && pr.every(tile2))))) bad();
  }
  if (o.event) {
    const E = o.event;
    if (!obj(E) || !ownKey(EVENTS, E.type) || (E.offers != null && !obj(E.offers))) bad();
    for (const p in E.offers || {}) deal(E.offers[p]);
  }
  // No markup anywhere (the map layers are numbers, whatever they hold). A name with markup in it is refused (the game's
  // own names never have any); in text (a message, a status, a player's name) <, > and " are swapped for look-alikes
  // that can't make markup, so a crafted file can't run script while a line of the game's own with a stray " in it
  // still loads, here and in a multiplayer catch-up.
  const MARK = /[<>"]/, unmark = (t) => t.replace(/</g, '‹').replace(/>/g, '›').replace(/"/g, '”');
  const text = (v) => {
    if (!v || typeof v !== 'object') return;
    for (const k in v) {
      if (MARK.test(k)) bad();
      if (typeof v[k] === 'string') { if (MARK.test(v[k])) v[k] = unmark(v[k]); } else text(v[k]);
    }
  };
  for (const k in o) {
    if (MARK.test(k)) bad();
    if (TYPED_FIELDS[k]) continue;
    if (typeof o[k] === 'string') { if (MARK.test(o[k])) o[k] = unmark(o[k]); } else text(o[k]);
  }
}

function deserializeGame(json) {
  const o = JSON.parse(json);
  checkSave(o);
  o.difficulty = o.difficulty || 'normal';
  // Saves from before resources were lowered a notch: the setting that matches the map they were made with.
  if (o.settings && !o.settings.resV) { o.settings.rich = resLevelUp(o.settings.rich); o.settings.resV = RES_V; }
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
  if (!o.rail) o.rail = new Array(o.W * o.H).fill(0); // saves from before railways
  // Saves from before plans could wait for goods: everything planned was paid for.
  if (!o.owe) o.owe = new Array(o.W * o.H).fill(0);
  if (!o.railPlan) o.railPlan = new Array(o.W * o.H).fill(0);
  if (!o.pipe) o.pipe = new Array(o.W * o.H).fill(0); // saves from before pipelines
  if (!o.pipePlan) o.pipePlan = new Array(o.W * o.H).fill(0);
  const oldWays = !o.wown; // saves from before roads had an owner of their own: see wayOwnersFromLand
  if (oldWays) o.wown = new Array(o.W * o.H).fill(-1);
  o.pipeVer = (o.pipeVer || 0) + 1;
  o.planQ = o.planQ || [];
  o.junPlan = o.junPlan || {};
  if (!o.paveMark) { o.paveMark = new Array(o.W * o.H).fill(0); for (const b of o.buildings) if (b.type === 'roadworks' && !b.pmode) b.pmode = 'all'; }
  if (!o.xdir) o.xdir = new Array(o.W * o.H).fill(0); // saves from before Express lanes: no lane planned
  o.lights = o.lights || {};
  o.over = o.over || {};
  o.scorch = o.scorch || {};
  o.burnt = o.burnt && typeof o.burnt === 'object' && !Array.isArray(o.burnt) ? o.burnt : {}; // farmland burned for good (saves from before napalm: none)
  o.fires = Array.isArray(o.fires) ? o.fires : [];
  o.wrecks = o.wrecks || []; // (saves from before aircraft wrecks stayed: none)
  for (const k of SPARSE_LAYERS) o[k] = Array.isArray(o[k]) ? sparseIn(o[k], o.W * o.H) : null; // (War scars: made below for a save from before)
  o.roadVer = (o.roadVer || 0) + 1;
  // Saves from before roads were paved by workers have no planned roads.
  if (!o.plan) o.plan = new Array(o.W * o.H).fill(0);
  o.planVer = (o.planVer || 0) + 1;
  o.paveRes = o.paveRes || {}; // (kept as saved: a loaded game must play on exactly as it was)
  if (!o.heat || o.heat.length !== o.W * o.H) o.heat = new Array(o.W * o.H).fill(0); // (saves from before the traffic map was kept)
  for (const k in TYPED_FIELDS) o[k] = MAP_LAYERS.includes(k) && !o[k] ? null : TYPED_FIELDS[k].from(o[k]); // (a map's optional layers are null when it has none)
  o.hist = o.hist || newHistory();
  for (const P of o.players) { P.made = P.made || {}; P.madeBots = P.madeBots || {}; P.stats.outposts = P.stats.outposts || 0; P.stats.startBots = P.stats.startBots ?? 18; }
  // Each computer player keeps its own doctrine (saved as `style`); one the game doesn't know (a damaged file) plays as a Steward.
  for (const P of o.players) if (P.style !== undefined && !isDoctrine(P.style)) P.style = 'balanced';
  for (const P of o.players) if (P.roadCrew !== undefined && !ROAD_CREWS.includes(P.roadCrew)) delete P.roadCrew; // (older saves: ROAD_CREW)
  // A save from before the narrator (no S.lore): what it would already have said, so a game loaded an hour in doesn't
  // announce its "first" road or Uplink, or the first nightfall, all over again. (Text only: see loreDue.)
  if (!o.lore || typeof o.lore !== 'object') {
    const L = (o.lore = {}), t = o.time || 0, said = new Set();
    for (let k = 0; k < o.W * o.H; k++) if (o.road[k] && o.wown && o.wown[k] >= 0) said.add(o.wown[k]);
    for (const p of said) L[`n.road.${p}`] = t;
    for (const u of o.uplinks || []) if (u.owner >= 0) L[`n.uplink.${u.owner}`] = t;
    if (t > 500) for (const P of o.players) L[`n.night.${P.id}`] = t; // (the first nightfall comes at about 8½ minutes)
  }
  o.fx = []; o.decals = []; o.msgs = []; o.dirtyTiles = [];
  o.rallies = o.rallies || [];
  o.loot = o.loot || [];
  o.missiles = o.missiles || [];
  o.cans = o.cans || []; // (saves from before the Mass Driver: no canisters in flight)
  o.cuts = o.cuts || []; // (saves from before the Lance of Corvane: no cuts; their settings have no Megastructures: off, see megaOn)
  o.liftFalls = o.liftFalls || []; // (saves from before the Orbital Lift: no cable coming down)
  o.bAt = new Int32Array(o.W * o.H);
  o.byId = new Map();
  // The rest works on S. A save that fails part-way leaves the game that was running as it was.
  const prev = S;
  S = o;
  try {
    for (const b of S.buildings) {
      S.byId.set(b.id, b);
      S.bAt[tIdx(b.x, b.y)] = b.id;
      if (BDEFS[b.type].foot) footClaim(b); // (a megastructure: every tile of its square)
      if (BDEFS[b.type].long) { b.mdAxis = b.mdAxis === 'ns' ? 'ns' : 'ew'; const [i2, j2] = longTile(b.x, b.y, b.mdAxis); if (inMap(i2, j2)) S.bAt[tIdx(i2, j2)] = b.id; } // (a save from before the Mass Driver's two tiles: laid east)
      if (b.type === 'foundry' && !S.players[b.owner].ai) b.mode = 'off'; // older saves: build on order only
    }
    for (const u of S.bots) {
      S.byId.set(u.id, u);
      if (u.type === 'warbot') u.ammo = u.ammo === undefined ? WARBOT_AMMO : Math.min(u.ammo, WARBOT_AMMO); // older saves carried more
      if (BOTS[u.type] && (BOTS[u.type].flank || BOTS[u.type].railgun) && u.ammo === undefined) u.ammo = botMag(u.type);
      u.carryN = u.carry ? u.carryN || 1 : 0;
    }
    computeZones();
    if (oldWays) wayOwnersFromLand();
    tradeFromContracts(); // (a save from before trade routes)
    if (!S.posts) { placePosts(S.seed); for (const p of S.posts) if (S.decor) S.decor[tIdx(p.x, p.y)] = 0; } // saves from before Trade Posts
    clearCalmGround(); // (a save from before the Trade Posts' ground was kept clear of deposits: moved just off it)
    computeTerritory(); // land as it's worked out now (every building holds a little round it)
    scarSetup(); // (a save from before War scars: Full from here on, its land unscarred)
  } catch (e) { S = prev; throw e; }
  // Unit types switched off for now (BOTS_OFF) leave the game.
  const off = dropOffBots();
  if (off) postMsg(ME, `${[...BOTS_OFF].map((k) => BOTS[k].plural).join(' and ')} are switched off for now: ${off} left this game.`, undefined, undefined, 'info');
  return S;
}

/**
 * A save from before trade routes: each colony's contract under way (if it would make a route) becomes the route of its
 * Trade Terminals, and the rest of the contracts go.
 */
function tradeFromContracts() {
  for (const P of S.players) {
    const T = P.trade;
    if (!T || !T.offers) continue;
    const o = T.pick >= 0 ? T.offers[T.pick] : null;
    for (const b of S.buildings) if (!b.dead && b.owner === P.id && BDEFS[b.type].terminal && !b.route && o && tradePairOk(o.give, o.get)) b.route = { give: o.give, get: o.get };
    P.trade = { sat: T.sat || {}, sold: T.sold || 0 };
  }
}

/** An older save's roads and track: each is owned by whoever holds its land, a bridge out past the border by the land it runs from. */
function wayOwnersFromLand() {
  const N = S.W * S.H, q = [];
  for (let t = 0; t < N; t++) if ((S.road[t] || S.rail[t]) && S.owner[t] >= 0) { S.wown[t] = S.owner[t]; q.push(t); }
  for (let h = 0; h < q.length; h++) {
    const t = q[h], i = t % S.W;
    for (const u of [i > 0 ? t - 1 : -1, i < S.W - 1 ? t + 1 : -1, t - S.W, t + S.W]) {
      if (u < 0 || u >= N || S.wown[u] >= 0 || !(S.road[u] || S.rail[u])) continue;
      S.wown[u] = S.wown[t]; q.push(u);
    }
  }
}

function saveGame(json) {
  if (!S || S.winner >= 0 || S.players[0].ai) return false;
  if (typeof MP !== 'undefined' && MP.on) return false; // (a multiplayer game lives on everyone's devices: it isn't saved for Continue)
  try { localStorage.setItem(SAVE_KEY, json || serializeGame()); return true; } catch (e) { return false; }
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

/* ------------------------------------------------------------------ railways */

/** The track tiles right beside tile (i, j): where a train stops for a Rail Station there. */
function railPlatforms(i, j) {
  const out = [];
  if (!S.rail) return out;
  for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (!inMap(i + di, j + dj)) continue;
    const t = tIdx(i + di, j + dj);
    if (S.rail[t]) out.push(t);
  }
  return out;
}

/**
 * Can two neighbouring track tiles join? On one level, or one level up or down over a Ramp (a
 * natural slope or one built in Paths), like a road; rail bridges join any level.
 */
function railStep(a, b) { return S.rail[a] && S.rail[b] && (S.terrain[a] !== T_GROUND || S.terrain[b] !== T_GROUND || canStep(a, b)); }

/** Track tiles a train can go to from track tile a: its neighbours, and the far end of a Viaduct with track on both ends. */
function railNbrs(a) {
  const W = S.W, N = W * S.H, ai = a % W, out = [];
  for (const b of [ai > 0 ? a - 1 : -1, ai < W - 1 ? a + 1 : -1, a - W, a + W]) if (b >= 0 && b < N && railStep(a, b)) out.push(b);
  if (S.bAt[a]) { const v = viaLink(a); if (v >= 0 && S.rail[v]) out.push(v); }
  return out;
}

const _rail = { of: null, ver: -1, comp: null };
/** Connected stretches of track (cached until track changes): comp[t] for every track tile, -1 elsewhere. */
function railNet() {
  const N = S.W * S.H, W = S.W;
  if (_rail.of === S && _rail.ver === (S.railVer || 0) && _rail.comp && _rail.comp.length === N) return _rail;
  const comp = new Int32Array(N).fill(-1);
  let next = 0;
  const q = [];
  for (let t = 0; t < N; t++) {
    if (!S.rail[t] || comp[t] >= 0) continue;
    comp[t] = next; q.length = 0; q.push(t);
    while (q.length) {
      const a = q.pop();
      for (const b of railNbrs(a)) if (comp[b] < 0) { comp[b] = next; q.push(b); }
    }
    next++;
  }
  Object.assign(_rail, { of: S, ver: S.railVer || 0, comp });
  return _rail;
}

/** The stretches of track a building's platforms (or a train inside it) touch. */
function railComps(b) {
  const c = railNet().comp, out = [];
  for (const t of railPlatforms(b.x, b.y)) if (out.indexOf(c[t]) < 0) out.push(c[t]);
  return out;
}

/** Are Rail Stations a and b on the same track? */
function railLinked(a, b) {
  if (!S.rail || !BDEFS[a.type].station || !BDEFS[b.type].station || a === b) return false;
  const ca = railComps(a), cb = railComps(b);
  for (const c of ca) if (cb.indexOf(c) >= 0) return true;
  return false;
}

/** Could `owner` lay track on tile t? '' if so, otherwise why not. */
function railBlocked(owner, t) {
  const i = t % S.W, j = (t / S.W) | 0;
  if (!inMap(i, j)) return 'Outside the map.';
  const via = S.bAt[t] ? getE(S.bAt[t]) : null;
  const viaOk = via && via.type === 'viaduct' && via.owner === owner;
  if (S.owner[t] >= 0 && S.owner[t] !== owner && !viaOk) return 'A rival holds that ground: track only runs on yours or no-one\'s.';
  if (S.owner[t] < 0 && !viaOk) {
    if (crossTile(t)) { if (!bridgeable(t) || !bridgeHead(owner, i, j, (u) => (S.rail[u] && wayOwner(u) === owner) || S.railPlan[u] === owner + 1)) return 'Track can only bridge out from your land or your own track.'; }
    else if (!reachZone(owner, t)) return 'Your bots can\'t reach there yet.';
  }
  if (S.bAt[t] && !pylonAt(t) && !(via && via.type === 'viaduct') && !(via && via.type === 'gate' && via.owner === owner)) return 'There is a building here.'; // track runs through your own Gates
  if (S.res[t] && S.res[t] !== R_OIL) return 'Clear the resources here first.'; // (an oil seep stays underground, under the track)
  if (S.tidal && S.tidal[t]) return 'Tidal flats: the sea covers this at high tide.';
  if (scorched(t)) return 'This ground is still scorched.';
  if (runwayAt(t)) return 'That\'s an Airfield\'s runway.';
  if (postAt(t)) return 'A Trade Post stands here.';
  return '';
}

/** Lay (on) or take up (off) the track on tile t. */
function setRail(t, on, owner) {
  if (!!S.rail[t] === !!on) return;
  S.rail[t] = on ? 1 : 0;
  if (on) S.wown[t] = owner ?? (S.wown[t] >= 0 && S.road[t] ? S.wown[t] : S.owner[t]);
  else if (!S.road[t]) S.wown[t] = -1;
  if (on) clearDecor(t);
  S.railVer = (S.railVer || 0) + 1;
  const i = t % S.W, j = (t / S.W) | 0;
  markDirty(i, j);
  for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (inMap(i + di, j + dj)) markDirty(i + di, j + dj);
  dirtySpan(t);
}

/**
 * A ship's route over open water (8-way, never cutting a corner of land; bridges pass overhead) from where
 * it is (afloat, or tied up at a Port: from its docks) to a dock of the building at (x, y), the water beside
 * shore tile (x, y), or water tile (x, y). Null if there is none. A ship tied up starts out at its dock.
 */
function seaRoute(u, x, y, arrivalComps) {
  const W = S.W, H = S.H, N = W * H, comp = seaNet().comp;
  let starts = [];
  if (u.inside) { const b = getE(u.inside); if (b) starts = portDocks(b.x, b.y); }
  else { const t = tIdx(Math.floor(u.x), Math.floor(u.y)); if (S.terrain[t] === T_WATER) starts = [t]; }
  if (!starts.length || !inMap(x, y)) return null;
  const g = tIdx(x, y);
  let goals;
  if (S.bAt[g]) goals = portDocks(x, y);
  else if (S.terrain[g] === T_WATER) goals = [g];
  else goals = portDocks(x, y);
  goals = goals.filter((t) => (!arrivalComps || arrivalComps.includes(comp[t])) && starts.some((s) => comp[s] === comp[t]));
  if (!goals.length) return null;
  const isGoal = new Set(goals), gx = x, gy = y;
  // (Costs in doubles: kept as floats, a cost that rounded up looked "beaten" by itself again and again,
  // and a long voyage's search never ended. A tile is settled the first time it comes off the heap.)
  const cost = new Float64Array(N).fill(Infinity), from = new Int32Array(N).fill(-2), settled = new Uint8Array(N), heap = new MinHeap();
  for (const s0 of starts) { cost[s0] = 0; from[s0] = -1; heap.push(s0, dhypot((s0 % W) - gx, ((s0 / W) | 0) - gy) * 0.9); }
  let hit = -1;
  while (heap.size) {
    const a = heap.pop();
    if (settled[a]) continue; // a stale entry: this tile was reached more cheaply since
    settled[a] = 1;
    if (isGoal.has(a)) { hit = a; break; }
    const ai = a % W, aj = (a / W) | 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const i = ai + di, j = aj + dj;
      if (i < 0 || j < 0 || i >= W || j >= H) continue;
      const b = j * W + i;
      if (S.terrain[b] !== T_WATER || settled[b]) continue;
      if (di && dj && (S.terrain[aj * W + i] !== T_WATER || S.terrain[j * W + ai] !== T_WATER)) continue;
      const c = cost[a] + (di && dj ? 1.414 : 1);
      if (c < cost[b]) { cost[b] = c; from[b] = a; heap.push(b, c + dhypot(i - gx, j - gy) * 0.9); }
    }
  }
  if (hit < 0) return null;
  const path = [];
  for (let t = hit; t >= 0; t = from[t]) path.push(t);
  path.reverse();
  if (!u.inside && path[0] === tIdx(Math.floor(u.x), Math.floor(u.y))) path.shift();
  return path;
}

/**
 * A train's route along the track from where it is (on the track, or inside a station: from its
 * platforms) to the platform of the building at (x, y) (or to track tile (x, y)). Null if there is none.
 */
function railRoute(u, x, y, arrivalComps) {
  const W = S.W, N = W * S.H, net = railNet().comp;
  let starts = [];
  if (u.inside) { const b = getE(u.inside); if (b) starts = railPlatforms(b.x, b.y); }
  else { const t = tIdx(Math.floor(u.x), Math.floor(u.y)); if (S.rail[t]) starts = [t]; }
  if (!starts.length) return null;
  const g = tIdx(x, y), goals = (S.bAt[g] ? railPlatforms(x, y) : S.rail[g] ? [g] : [])
    .filter((t) => !arrivalComps || arrivalComps.includes(net[t]));
  if (!goals.length) return null;
  const isGoal = new Set(goals), from = new Int32Array(N).fill(-2), q = [];
  for (const s of starts) { from[s] = -1; q.push(s); }
  let hit = -1;
  for (let k = 0; k < q.length && hit < 0; k++) {
    const a = q[k];
    if (isGoal.has(a)) { hit = a; break; }
    for (const b of railNbrs(a)) {
      if (from[b] !== -2 || net[b] !== net[a]) continue;
      from[b] = a; q.push(b);
    }
  }
  if (hit < 0) return null;
  const path = [];
  for (let t = hit; t >= 0; t = from[t]) path.push(t);
  path.reverse();
  // A train inside a station starts by rolling onto its platform; one already on the track skips its own tile.
  if (!u.inside && path[0] === tIdx(Math.floor(u.x), Math.floor(u.y))) path.shift();
  return path;
}

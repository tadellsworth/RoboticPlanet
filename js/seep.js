'use strict';
/*
 * Oil seeps drawn as puddles of crude (the owner's choice from the oil seep design sheet, Nov 2026: direction B, the
 * "Spattered seep"; ART_GUIDE Batch 24). Nothing here is art: the puddle is made in code from the seep's own tiles, so
 * any layout of tiles comes out right, and it is baked into the ground (the whole-map bake, the sharp chunks and the
 * night glow map) like the rest of the ground, so it costs nothing per frame. Only the slow shimmer in its sheen is
 * drawn each frame, and that is a few small sprites (drawSeepShimmer; none on the Saver graphics step).
 *
 * How a puddle is made (seepGeometry): a disc on each oil tile, sized by how much crude is left in it, a lobe or two
 * off each, bridges to its oil neighbours, and a few droplets and small puddles just outside (a trail of them off one
 * side); the union is softened and pushed about by low-frequency noise into a soft outline of lobes and pinched waists,
 * and the 0.5 contour of that field (marching squares) is the puddle's shape, one Path2D. It is shaded from its own
 * shape when drawn (drawSeepPuddle): jet black, a thin white light along the edges that face the player (the shape
 * filled white, then filled black shifted up a little), a faint grey line on the edges that face away (the same trick
 * the other way), pale sheen spots inside toward its top, and a damp dark stain under and round it where the full
 * puddle lay. At night the rim and the sheen are left as a faint cool gleam in the night glow map (drawSeepGlow); in
 * the Hollow the gleam is the Bloom's violet and the rim and sheen a touch stronger.
 *
 * Pumping dry: a pump takes from its own tile first, so the wet area recedes from the pump outward (seepFills pools
 * the crude of the tiles a pump reaches and hands it back farthest tile first, for the picture only); its waists pinch
 * off and the seep breaks into separate pools. With no pump each tile shows its own amount. The puddle is made again
 * only when the seep's amount crosses a step (SEEP_STEPS of them), and then just its tiles are repainted.
 *
 * The puddle may lie a little over the seep's neighbouring tiles (its lobes and droplets): plain ground on the same
 * level, never water, rock, a road or track, a building or another resource. Under a road it stops at the kerb (the
 * road keeps its stain: see paintTile). Everything here is render state (SEEP, never S), read from S but never written
 * to it, and no part of the simulation reads it.
 */

const SEEP = {
  list: [],            // the seeps on the map: see makeSeep
  byTile: new Map(),   // tile → the seeps whose box covers it
  frame: 0,
  shimmer: true,       // the sheen's slow shimmer (off on Saver, and with reduced motion)
  sprite: null,        // the shimmer's soft blob
  ver: 0,              // bumped whenever the index is built (tests)
  time: 0,             // ms spent making puddles since the index was built (tests)
};
const SEEP_G = 16;         // field cells a tile
const SEEP_STEPS = 10;     // a seep's picture is made again when its amount crosses one of these
const SEEP_MARGIN = 1;     // tiles round the seep's own that the puddle may reach

/* The look, per biome (the Rust's is the default): the rim light's strength, the top line's, the sheen's, the stain's
 * colour and strength, the body's colour wet and dry, the night gleam's colour and strength. Black on dark ash and mud
 * gets a stronger rim and sheen and a paler damp stain; the Hollow's seeps, always in the dark, gleam violet in the
 * Bloom's light, and more strongly, since the gleam is most of what shows of them. */
const SEEP_LOOK = {
  desert: { hl: 0.85, top: 0.26, sheen: 0.85, stain: [20, 14, 10], stainK: 1, body: [14, 14, 17], dry: [23, 19, 15], gleam: [184, 200, 255], gleamK: 1 },
  volcanic: { hl: 1.1, top: 0.4, sheen: 1.15, stain: [70, 58, 50], stainK: 0.9, body: [12, 12, 15], dry: [20, 17, 15], gleam: [200, 210, 255], gleamK: 1.2 },
  swamp: { hl: 1.08, top: 0.38, sheen: 1.1, stain: [60, 52, 36], stainK: 0.9, body: [12, 12, 15], dry: [20, 17, 14], gleam: [184, 200, 255], gleamK: 1.1 },
  lunar: { hl: 0.95, top: 0.3, sheen: 0.95, stain: [26, 24, 24], stainK: 1, body: [14, 14, 17], dry: [22, 20, 18], gleam: [184, 200, 255], gleamK: 1 },
  hollow: { hl: 1.15, top: 0.4, sheen: 1.25, stain: [12, 8, 20], stainK: 1, body: [12, 11, 16], dry: [20, 17, 18], gleam: [205, 140, 255], gleamK: 1.7 },
};
function seepLook() { return SEEP_LOOK[R.biome] || SEEP_LOOK.desert; }

/** Is tile t an oil tile a puddle is drawn on (not one under a road or track: the oil stays below)? */
function seepOilTile(t) { return S.res[t] === R_OIL && !S.road[t] && !(S.rail && S.rail[t]); }

/** Build the index of the map's seeps (every 8-connected group of oil tiles) and make each one's puddle. */
function seepIndexBuild() {
  SEEP.list = []; SEEP.byTile = new Map(); SEEP.ver++; SEEP.time = 0;
  if (!S) return;
  const N = S.W * S.H, seen = new Uint8Array(N), stack = [];
  for (let t0 = 0; t0 < N; t0++) {
    if (seen[t0] || S.res[t0] !== R_OIL) continue;
    const tiles = [];
    seen[t0] = 1; stack.push(t0);
    while (stack.length) {
      const t = stack.pop(); tiles.push(t);
      const i = t % S.W, j = (t / S.W) | 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const a = i + di, b = j + dj;
        if (!inMap(a, b)) continue;
        const u = tIdx(a, b);
        if (!seen[u] && S.res[u] === R_OIL) { seen[u] = 1; stack.push(u); }
      }
    }
    tiles.sort((a, b) => a - b);
    const sp = makeSeep(tiles, SEEP.list.length);
    SEEP.list.push(sp);
    for (let j = sp.oy; j < sp.oy + sp.H; j++) for (let i = sp.ox; i < sp.ox + sp.W; i++) {
      if (!inMap(i, j)) continue;
      const u = tIdx(i, j), l = SEEP.byTile.get(u);
      if (l) l.push(sp); else SEEP.byTile.set(u, [sp]);
    }
  }
}

/** A seep: its tiles, its box (the tiles plus a margin all round), its seed, and its puddle (made by seepGeometry). */
function makeSeep(tiles, id) {
  let i0 = 1e9, j0 = 1e9, i1 = -1, j1 = -1;
  for (const t of tiles) { const i = t % S.W, j = (t / S.W) | 0; if (i < i0) i0 = i; if (i > i1) i1 = i; if (j < j0) j0 = j; if (j > j1) j1 = j; }
  const t0 = tiles[0];
  const sp = {
    id, tiles, set: new Set(tiles), i0, j0, i1, j1,
    ox: i0 - SEEP_MARGIN, oy: j0 - SEEP_MARGIN, W: i1 - i0 + 1 + 2 * SEEP_MARGIN, H: j1 - j0 + 1 + 2 * SEEP_MARGIN,
    elev: S.elev[t0], seed: (hash2(t0 % S.W, (t0 / S.W) | 0, 4111) * 1e9) | 0,
    sig: -1, F: 1, fills: new Float32Array(tiles.length), drops: null, full: null, wet: null, sheen: [], cover: null,
  };
  seepGeometry(sp, true);
  return sp;
}

/**
 * How full each of a seep's tiles is drawn (0..1; S.amt is only read). A pump takes from the fullest tile it reaches, so
 * the tiles it reaches are pooled and the crude handed back farthest tile first: the pump's own tile dries first and
 * the wet area recedes from it outward. Tiles no pump reaches show their own amount. Returns a signature of what the
 * picture depends on (the amount's step and which pumps there are), so it is made again only when that changes.
 */
function seepFills(sp) {
  const n = sp.tiles.length, f = sp.fills, full = RES[R_OIL].amount;
  let sum = 0;
  for (let k = 0; k < n; k++) { const t = sp.tiles[k]; f[k] = S.res[t] === R_OIL ? clamp(S.amt[t] / full, 0, 1) : 0; sum += f[k]; }
  sp.F = n ? sum / n : 0;
  // the pumps on or beside the seep, by id (the order they are dealt with in)
  const pumps = new Map();
  for (const t of sp.tiles) {
    const i = t % S.W, j = (t / S.W) | 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!inMap(i + di, j + dj)) continue;
      const id = S.bAt[tIdx(i + di, j + dj)];
      if (!id || pumps.has(id)) continue;
      const b = getE(id);
      if (b && BDEFS[b.type] && BDEFS[b.type].pump) pumps.set(id, b);
    }
  }
  let pk = 0;
  if (pumps.size && sp.F < 0.999) {
    const taken = new Uint8Array(n), ids = [...pumps.keys()].sort((a, b) => a - b);
    for (const id of ids) {
      const b = pumps.get(id), reach = [];
      for (let k = 0; k < n; k++) {
        if (taken[k]) continue;
        const t = sp.tiles[k], di = (t % S.W) - b.x, dj = ((t / S.W) | 0) - b.y;
        if (Math.abs(di) <= 1 && Math.abs(dj) <= 1) { reach.push([di * di + dj * dj, k]); taken[k] = 1; }
      }
      reach.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
      let T = 0;
      for (const [, k] of reach) T += f[k];
      for (let m = reach.length - 1; m >= 0; m--) { const k = reach[m][1], v = Math.min(1, T); f[k] = v; T -= v; }
      pk = (pk * 31 + id) | 0;
    }
  }
  return Math.ceil(sp.F * SEEP_STEPS - 1e-6) * 1000003 + (pk & 0xfffff);
}

/* ---- the field: the puddle's shape as a soft function of position (tile units from the seep's box corner) ---- */

/** Polynomial smooth minimum: a union of shapes with soft fillets where they meet. */
function seepSmin(a, b, k) { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; }
function seepSstep(a, b, x) { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }

/**
 * The shapes a seep's puddle is the union of, from its tiles' fills: the body (discs, ellipses a little wider than tall,
 * with lobes off them, and bridges, capsules, to oil neighbours) and the droplets (sp.drops, placed once from the full
 * shape; fewer and smaller as the seep dries). Each is [kind, x, y, rx, ry | x2, y2, w]. fullSize: every tile as if
 * full (the shape the stain remembers), no droplets.
 */
function seepShapes(sp, fullSize) {
  const out = [], drops = [], W = S.W, n = sp.tiles.length, cen = new Map();
  for (let k = 0; k < n; k++) {
    const t = sp.tiles[k], i = t % W, j = (t / W) | 0;
    cen.set(t, [i + 0.5 - sp.ox + (hash2(i, j, 611) - 0.5) * 0.2, j + 0.5 - sp.oy + (hash2(j, i, 613) - 0.5) * 0.2]);
  }
  for (let k = 0; k < n; k++) {
    const t = sp.tiles[k], i = t % W, j = (t / W) | 0, f = fullSize ? 1 : sp.fills[k];
    if (f <= 0) continue;
    const [cx, cy] = cen.get(t);
    const r = 0.47 * Math.pow(f, 0.6) * 0.98 * (0.88 + 0.24 * hash2(i, j, 617));
    out.push([0, cx, cy, r, r * 0.86]);
    for (let m = 0; m < 2; m++) { // lobes: smaller discs pushed out from the side
      const a = hash2(i + m * 7, j, 619 + m) * Math.PI * 2, rl = r * (0.38 + 0.17 * hash2(i, j + m, 623)), off = r * (0.62 + 0.23 * hash2(j, i + m, 627));
      out.push([0, cx + Math.cos(a) * off, cy + Math.sin(a) * off * 0.86, rl, rl * 0.86]);
    }
    for (const [di, dj] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
      if (!inMap(i + di, j + dj)) continue;
      const u = tIdx(i + di, j + dj), k2 = sp.tiles.indexOf(u);
      if (k2 < 0) continue;
      const f2 = fullSize ? 1 : sp.fills[k2];
      if (f2 <= 0) continue;
      const [nx, ny] = cen.get(u), w = r * 0.66 * (di && dj ? 0.6 : 0.95) * (0.5 + 0.5 * Math.min(f, f2));
      out.push([1, cx, cy, nx, ny, w]);
    }
  }
  if (sp.drops && !fullSize) {
    const kf = 0.7 + 0.3 * sp.F, m = Math.min(sp.drops.length, Math.max(1, Math.round(sp.drops.length * (0.5 + 0.5 * sp.F))));
    for (let d = 0; d < m; d++) for (const e of sp.drops[d]) drops.push([0, e[0], e[1], e[2] * kf, e[3] * kf]);
  }
  return { body: out, drops };
}

/** The signed distance (tile units, negative inside) from (x, y) to the union of shapes, softly joined (k: how softly). */
function seepSdf(shapes, x, y, k) {
  let d = 1e9;
  for (const s of shapes) {
    let e;
    if (s[0] === 0) { const dx = (x - s[1]) / s[3], dy = (y - s[2]) / s[4]; e = (Math.sqrt(dx * dx + dy * dy) - 1) * Math.min(s[3], s[4]); }
    else {
      const px = x - s[1], py = y - s[2], vx = s[3] - s[1], vy = s[4] - s[2], l2 = vx * vx + vy * vy || 1e-9;
      const h = clamp((px * vx + py * vy) / l2, 0, 1), ex = px - vx * h, ey = py - vy * h;
      e = Math.sqrt(ex * ex + ey * ey) - s[5];
    }
    d = k ? seepSmin(d, e, k) : Math.min(d, e);
  }
  return d;
}

/** Smooth noise, about -1..1 (unit variance), its coarsest features about `sig` tiles across (2 octaves of value noise). */
function seepNoise(x, y, sig, seed) { return (fbm(x / sig + 37.1, y / sig + 11.7, seed, 2) - 0.5) * 6.7; }

/**
 * The field at (x, y): the softened union of the body's shapes, its edge pushed about by noise (a domain warp) with more
 * lobes added by another, as in renderer/terrain/oil_puddles.py (direction b), and the droplets (crisper, and never
 * melted into the body). 0.5 is the puddle's edge.
 */
function seepField(sp, shapes, x, y, nz) {
  const [nx, ny, nl] = nz(x, y), wx = x + nx * 0.22, wy = y + ny * 0.22;
  let a = seepSstep(-0.07, 0.07, -seepSdf(shapes.body, wx, wy, 0.25)) + 0.16 * nl;
  if (shapes.drops.length) a = Math.max(a, seepSstep(-0.04, 0.04, -seepSdf(shapes.drops, wx, wy, 0)));
  return a;
}

/** The three noises a seep's field needs, sampled on a coarse grid (4 a tile) and read back bilinearly. */
function seepNoiseGrid(sp) {
  const G = 4, nx = sp.W * G + 1, ny = sp.H * G + 1, a = new Float32Array(nx * ny * 3), sd = sp.seed & 0xffff;
  for (let gy = 0; gy < ny; gy++) for (let gx = 0; gx < nx; gx++) {
    const x = gx / G + sp.ox, y = gy / G + sp.oy, o = (gy * nx + gx) * 3;
    a[o] = seepNoise(x, y, 1.1, sd); a[o + 1] = seepNoise(x, y, 1.1, sd + 101); a[o + 2] = seepNoise(x, y, 0.75, sd + 202);
  }
  const out = [0, 0, 0];
  return (x, y) => {
    const fx = clamp(x * G, 0, nx - 1.001), fy = clamp(y * G, 0, ny - 1.001), ix = fx | 0, iy = fy | 0, u = fx - ix, v = fy - iy;
    const o00 = (iy * nx + ix) * 3, o10 = o00 + 3, o01 = o00 + nx * 3, o11 = o01 + 3;
    for (let c = 0; c < 3; c++) out[c] = (a[o00 + c] * (1 - u) + a[o10 + c] * u) * (1 - v) + (a[o01 + c] * (1 - u) + a[o11 + c] * u) * v;
    return out;
  };
}

/** Can a droplet lie on tile (i, j) beside the seep: open ground on the seep's level, nothing built or growing on it? */
function seepDropTile(sp, i, j) {
  if (!inMap(i, j)) return false;
  const u = tIdx(i, j);
  if (sp.set.has(u)) return true;
  return S.terrain[u] === T_GROUND && !S.road[u] && !(S.rail && S.rail[u]) && !S.bAt[u] && !S.res[u] && !S.ramp[u] && S.elev[u] === sp.elev &&
    !(S.tidal && S.tidal[u]) && !(typeof pillarAt === 'function' && pillarAt(u));
}

/**
 * Place the seep's droplets and small puddles once, just outside its full shape: most of them in a trail off one side
 * (away from a pump standing on the seep, if one does when the map is made, else a side of its own), the rest round it.
 * Each is a list of ellipses [x, y, rx, ry] (a small puddle gets a lobe or two). On open ground only (seepDropTile).
 */
function seepPlaceDrops(sp, shapes, nz) {
  const rng = makeRng(sp.seed ^ 0x5eef), drops = [];
  const n = 6 + Math.floor(rng() * 3), W = S.W;
  let cx = 0, cy = 0;
  for (const t of sp.tiles) { cx += (t % W) + 0.5 - sp.ox; cy += ((t / W) | 0) + 0.5 - sp.oy; }
  cx /= sp.tiles.length; cy /= sp.tiles.length;
  let trail = rng() * Math.PI * 2;
  for (const t of sp.tiles) { // a pump on the seep: the trail runs away from it
    const id = S.bAt[t], b = id && getE(id);
    if (b && BDEFS[b.type] && BDEFS[b.type].pump) { const dx = cx - (b.x + 0.5 - sp.ox), dy = cy - (b.y + 0.5 - sp.oy); if (dx || dy) trail = Math.atan2(dy, dx); break; }
  }
  const field = (x, y) => seepField(sp, shapes, x, y, nz), inside = (x, y) => field(x, y) > 0.5;
  // where a walk out starts: the centre of an oil tile (always inside the body), for the trail the one farthest that way
  const cents = sp.tiles.map((t) => [(t % W) + 0.5 - sp.ox, ((t / W) | 0) + 0.5 - sp.oy]);
  const far = cents.reduce((a, c) => (c[0] * Math.cos(trail) + c[1] * Math.sin(trail) > a[0] * Math.cos(trail) + a[1] * Math.sin(trail) ? c : a), cents[0]);
  for (let tries = 0; tries < 160 && drops.length < n; tries++) {
    let r = 0.055 + rng() * 0.08, ang, from;
    if (rng() < 0.7) { ang = trail + (rng() + rng() - 1) * 0.6; from = far; if (!drops.length) r = Math.max(r, 0.11); }
    else { ang = rng() * Math.PI * 2; from = cents[Math.floor(rng() * cents.length)]; }
    const gap = 0.08 + rng() * 0.24 + r;
    let px = from[0], py = from[1], steps = 0;
    while (steps++ < 80 && px > 0 && py > 0 && px < sp.W && py < sp.H && inside(px, py)) { px += Math.cos(ang) * 0.05; py += Math.sin(ang) * 0.05; }
    px += Math.cos(ang) * gap; py += Math.sin(ang) * gap;
    if (px < r + 0.05 || py < r + 0.05 || px > sp.W - r - 0.05 || py > sp.H - r - 0.05) continue;
    let ok = true;
    for (let q = 0; q < 8 && ok; q++) { const a = q * Math.PI / 4; if (field(px + Math.cos(a) * (r + 0.06), py + Math.sin(a) * (r + 0.06)) > 0.3) ok = false; } // a clear gap all round
    if (!ok) continue;
    for (const d of drops) { const e = d[0], dx = e[0] - px, dy = e[1] - py; if (dx * dx + dy * dy < (e[2] + r + 0.04) ** 2) { ok = false; break; } }
    if (!ok) continue;
    for (const [ex, ey] of [[-r, 0], [r, 0], [0, -r], [0, r]]) if (!seepDropTile(sp, Math.floor(px + ex + sp.ox), Math.floor(py + ey + sp.oy))) { ok = false; break; }
    if (!ok) continue;
    const sq = 0.72 + rng() * 0.18, d = [[px, py, r, r * sq]];
    if (r > 0.09) for (let m = 0; m < 2; m++) { const a2 = rng() * Math.PI * 2, r2 = r * (0.45 + rng() * 0.25); d.push([px + Math.cos(a2) * r * 0.6, py + Math.sin(a2) * r * 0.5, r2, r2 * sq]); }
    drops.push(d);
  }
  sp.drops = drops;
}

/**
 * Make (or remake) a seep's puddle: its fills, its shapes, the field on a grid, the 0.5 contour as a Path2D (map pixels),
 * the inner distance for the sheen spots, and, the first time, the full shape (for the stain) and the droplets.
 */
function seepGeometry(sp, first) {
  const t0 = performance.now();
  const sig = seepFills(sp);
  if (!first && sig === sp.sig) return false;
  sp.sig = sig;
  const nz = sp.nz || (sp.nz = seepNoiseGrid(sp));
  if (first) {
    const fullShapes = seepShapes(sp, true);
    seepPlaceDrops(sp, fullShapes, nz);
    sp.full = seepContour(sp, fullShapes, nz).path;
  }
  const c = seepContour(sp, seepShapes(sp, false), nz);
  sp.wet = c.path;
  sp.sheen = seepSheenSpots(sp, c);
  SEEP.time += performance.now() - t0;
  return true;
}

/** The field on the seep's grid and its 0.5 contour as one Path2D in map pixels (every loop smoothed). */
function seepContour(sp, shapes, nz) {
  const G = SEEP_G, nx = sp.W * G + 1, ny = sp.H * G + 1, v = new Float32Array(nx * ny);
  // (the field is only ever within 0.35 tiles of a shape plus the warp: skip cells far from every shape's box)
  let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9;
  for (const s of [...shapes.body, ...shapes.drops]) {
    const r = s[0] === 0 ? Math.max(s[3], s[4]) : s[5];
    bx0 = Math.min(bx0, (s[0] ? Math.min(s[1], s[3]) : s[1]) - r); bx1 = Math.max(bx1, (s[0] ? Math.max(s[1], s[3]) : s[1]) + r);
    by0 = Math.min(by0, (s[0] ? Math.min(s[2], s[4]) : s[2]) - r); by1 = Math.max(by1, (s[0] ? Math.max(s[2], s[4]) : s[2]) + r);
  }
  const pad = 0.45, gx0 = Math.max(0, Math.floor((bx0 - pad) * G)), gx1 = Math.min(nx - 1, Math.ceil((bx1 + pad) * G));
  const gy0 = Math.max(0, Math.floor((by0 - pad) * G)), gy1 = Math.min(ny - 1, Math.ceil((by1 + pad) * G));
  if (shapes.body.length || shapes.drops.length) for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) v[gy * nx + gx] = seepField(sp, shapes, gx / G, gy / G, nz);
  const path = new Path2D(), loops = seepMarch(v, nx, ny, 0.5);
  const X = (x) => (sp.ox + x / G) * TP, Y = (y) => (sp.oy + y / G) * TP;
  for (const L of loops) {
    const m = L.length;
    if (m < 3) continue;
    // a smooth closed curve through the midpoints, the vertices as the controls
    let px = (L[m - 1][0] + L[0][0]) / 2, py = (L[m - 1][1] + L[0][1]) / 2;
    path.moveTo(X(px), Y(py));
    for (let k = 0; k < m; k++) {
      const q = L[(k + 1) % m];
      px = (L[k][0] + q[0]) / 2; py = (L[k][1] + q[1]) / 2;
      path.quadraticCurveTo(X(L[k][0]), Y(L[k][1]), X(px), Y(py));
    }
    path.closePath();
  }
  return { path, v, nx, ny, loops };
}

/**
 * Marching squares: the closed loops where the field crosses `iso`, as lists of [x, y] grid points. Segment ends sit
 * on cell edges, keyed exactly, so loops join without matching floats.
 */
function seepMarch(v, nx, ny, iso) {
  const segs = [], at = new Map();
  const pt = (x0, y0, x1, y1, a, b) => { const t = (iso - a) / (b - a || 1e-9); return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]; };
  // edge keys: top of cell (x, y) = H(x, y); left = V(x, y)
  const H = (x, y) => (y * nx + x) * 2, V = (x, y) => (y * nx + x) * 2 + 1;
  for (let y = 0; y < ny - 1; y++) for (let x = 0; x < nx - 1; x++) {
    const a = v[y * nx + x], b = v[y * nx + x + 1], c = v[(y + 1) * nx + x + 1], d = v[(y + 1) * nx + x];
    const code = (a >= iso ? 8 : 0) | (b >= iso ? 4 : 0) | (c >= iso ? 2 : 0) | (d >= iso ? 1 : 0);
    if (!code || code === 15) continue;
    const top = [H(x, y), () => pt(x, y, x + 1, y, a, b)], right = [V(x + 1, y), () => pt(x + 1, y, x + 1, y + 1, b, c)];
    const bot = [H(x, y + 1), () => pt(x, y + 1, x + 1, y + 1, d, c)], left = [V(x, y), () => pt(x, y, x, y + 1, a, d)];
    const add = (p, q) => { const s = { a: p[0], b: q[0], pa: p[1](), pb: q[1](), used: false }; segs.push(s); (at.get(s.a) || at.set(s.a, []).get(s.a)).push(s); (at.get(s.b) || at.set(s.b, []).get(s.b)).push(s); };
    switch (code) {
      case 1: case 14: add(left, bot); break;
      case 2: case 13: add(bot, right); break;
      case 3: case 12: add(left, right); break;
      case 4: case 11: add(top, right); break;
      case 6: case 9: add(top, bot); break;
      case 7: case 8: add(top, left); break;
      case 5: if ((a + b + c + d) / 4 >= iso) { add(top, right); add(bot, left); } else { add(top, left); add(bot, right); } break;
      case 10: if ((a + b + c + d) / 4 >= iso) { add(top, left); add(bot, right); } else { add(top, right); add(bot, left); } break;
    }
  }
  const loops = [];
  for (const s0 of segs) {
    if (s0.used) continue;
    const L = [s0.pa, s0.pb]; s0.used = true;
    let key = s0.b, last = s0;
    for (let guard = 0; guard < segs.length; guard++) {
      const nxt = (at.get(key) || []).find((s) => !s.used);
      if (!nxt) break;
      nxt.used = true;
      if (nxt.a === key) { L.push(nxt.pb); key = nxt.b; } else { L.push(nxt.pa); key = nxt.a; }
      last = nxt;
      if (key === s0.a) break;
    }
    if (L.length > 2 && key === s0.a) L.pop();
    loops.push(L);
  }
  return loops;
}

/**
 * Where the sheen lies: a few soft pale spots well inside the puddle, toward its top (the sky's reflection), spaced
 * out; each [x, y, rx, ry, phase] in tile units from the box corner. The inner distance comes from a chamfer pass over
 * the field's grid. Only spots on the seep's own tiles (the sheen's shimmer is drawn over them each frame).
 */
function seepSheenSpots(sp, c) {
  const { v, nx, ny } = c, G = SEEP_G, d = new Float32Array(nx * ny), BIG = 1e4;
  let ymin = ny, ymax = 0;
  for (let k = 0; k < v.length; k++) { d[k] = v[k] >= 0.5 ? BIG : 0; if (v[k] >= 0.5) { const y = (k / nx) | 0; if (y < ymin) ymin = y; if (y > ymax) ymax = y; } }
  if (ymax < ymin) return [];
  for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) { // chamfer 3-4, forward
    const k = y * nx + x; if (!d[k]) continue;
    let m = d[k];
    if (x) m = Math.min(m, d[k - 1] + 3); if (y) m = Math.min(m, d[k - nx] + 3);
    if (x && y) m = Math.min(m, d[k - nx - 1] + 4); if (y && x < nx - 1) m = Math.min(m, d[k - nx + 1] + 4);
    d[k] = m;
  }
  for (let y = ny - 1; y >= 0; y--) for (let x = nx - 1; x >= 0; x--) { // backward
    const k = y * nx + x; if (!d[k]) continue;
    let m = d[k];
    if (x < nx - 1) m = Math.min(m, d[k + 1] + 3); if (y < ny - 1) m = Math.min(m, d[k + nx] + 3);
    if (x < nx - 1 && y < ny - 1) m = Math.min(m, d[k + nx + 1] + 4); if (y < ny - 1 && x) m = Math.min(m, d[k + nx - 1] + 4);
    d[k] = m;
  }
  const cands = [], sd = sp.seed & 0xffff;
  for (let y = ymin; y <= ymax; y += 2) for (let x = 0; x < nx; x += 2) {
    const din = d[y * nx + x] / 3 / G; // tiles
    if (din < 0.1) continue;
    const i = Math.floor(x / G + sp.ox), j = Math.floor(y / G + sp.oy);
    if (!inMap(i, j) || !sp.set.has(tIdx(i, j))) continue;
    const rel = (y - ymin) / Math.max(1, ymax - ymin);
    cands.push([Math.min(din, 0.3) * (1.1 - 0.6 * rel) * (0.7 + 0.6 * hash2(x, y, sd)), x / G, y / G, din]);
  }
  cands.sort((p, q) => q[0] - p[0]);
  const want = clamp(Math.round(sp.tiles.length * (0.5 + 0.5 * sp.F)), 1, 7), out = [];
  for (const [, x, y, din] of cands) {
    if (out.length >= want) break;
    let ok = true;
    for (const o of out) { const dx = o[0] - x, dy = o[1] - y; if (dx * dx + dy * dy < 0.3 * 0.3) { ok = false; break; } }
    if (!ok) continue;
    const r = Math.min(din - 0.03, 0.06 + 0.07 * hash2((x * 97) | 0, (y * 89) | 0, sd + 3));
    out.push([x, y, r * 1.5, r * 0.72, hash2((x * 53) | 0, (y * 59) | 0, sd + 5) * Math.PI * 2]);
  }
  return out;
}

/* ---- drawing ---- */

/** May seep sp's puddle be drawn on tile u (its own tiles, or open ground beside them on the same level)? */
function seepCanCover(sp, u) {
  if (S.road[u] || (S.rail && S.rail[u])) return false; // (the puddle stops at a road's kerb: the road keeps its stain)
  if (sp.set.has(u)) return true;
  return seepDropTile(sp, u % S.W, (u / S.W) | 0);
}

/** The puddles of every seep whose box covers tile (i, j), clipped to the tile: called by paintTile, and by glowTiles for the night. */
function drawSeepTile(ctx, i, j, x, y, t, glow) {
  let list = SEEP.byTile.get(t);
  if (S.res[t] === R_OIL && !(list && list.some((sp) => sp.set.has(t)))) { seepIndexBuild(); list = SEEP.byTile.get(t); } // (oil put down after the map was made: tests)
  if (!list) return;
  let clipped = false;
  for (const sp of list) {
    if (!seepCanCover(sp, t)) continue;
    if (!clipped) { ctx.save(); ctx.beginPath(); ctx.rect(x, y, TP, TP); ctx.clip(); clipped = true; }
    if (glow) drawSeepGlow(ctx, sp); else drawSeepPuddle(ctx, sp);
  }
  if (clipped) ctx.restore();
}

/** The puddle by day: the stain, the black body with its rim light and top line, the sheen (see the file's head). */
function drawSeepPuddle(ctx, sp) {
  const L = seepLook(), F = sp.F, scale = (ctx.hdScale || 1), dry = 1 - F;
  const rgb = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  // the damp ground: the mark of where the full puddle lay, and a soft dark edge round the wet part
  ctx.fillStyle = rgb(L.stain, (0.16 + 0.14 * dry) * L.stainK);
  ctx.fill(sp.full);
  if (F > 0) {
    ctx.lineJoin = 'round';
    ctx.strokeStyle = rgb(L.stain, 0.1 * L.stainK); ctx.lineWidth = TP * 0.16; ctx.stroke(sp.wet);
    ctx.strokeStyle = rgb(L.stain, 0.16 * L.stainK); ctx.lineWidth = TP * 0.07; ctx.stroke(sp.wet);
    // the body: filled with the rim light's white, then with black shifted up, so the light stays along every edge that
    // faces the player; thinner and dimmer as it dries
    const d = Math.max(0.016 * TP, 0.8 / scale) * (0.9 + 0.3 * F) * (L.hl / 0.85), d2 = d * 0.7;
    const body = [L.body[0] * F + L.dry[0] * dry, L.body[1] * F + L.dry[1] * dry, L.body[2] * F + L.dry[2] * dry].map(Math.round);
    ctx.fillStyle = `rgba(255,255,255,${Math.min(1, (0.55 + 0.45 * F) * L.hl / 0.85 * 0.98)})`;
    ctx.fill(sp.wet);
    ctx.save();
    ctx.clip(sp.wet);
    ctx.translate(0, -d);
    ctx.fillStyle = rgb(body, 1);
    ctx.fill(sp.wet);
    // the sky in it: a faint cool sheen across the top half of the pool, gone toward the bottom (a mirror tilted at us)
    const X0 = sp.ox * TP, Y0 = sp.oy * TP, X1 = (sp.ox + sp.W) * TP, Y1 = (sp.oy + sp.H) * TP;
    const sky = ctx.createLinearGradient(0, Y0 + TP * 0.6, 0, Y1 - TP * 0.6);
    sky.addColorStop(0, `rgba(150,160,178,${(0.2 * F).toFixed(3)})`); sky.addColorStop(0.55, 'rgba(120,128,140,0.03)'); sky.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sky; ctx.fill(sp.wet);
    // a thin film of colour just inside the edge, as crude has where it thins out (oil's rainbow, very faint)
    const film = ctx.createLinearGradient(X0, Y0, X1, Y1);
    film.addColorStop(0, 'rgba(190,90,215,0.2)'); film.addColorStop(0.35, 'rgba(225,175,70,0.17)'); film.addColorStop(0.65, 'rgba(90,175,140,0.13)'); film.addColorStop(1, 'rgba(90,120,230,0.2)');
    ctx.lineJoin = 'round'; ctx.strokeStyle = film; ctx.lineWidth = TP * 0.1 * (0.5 + 0.5 * F); ctx.stroke(sp.wet);
    ctx.translate(0, d);
    // the faint grey line on the edges that face away: the part of the body the shape shifted down doesn't cover
    const outside = new Path2D(); outside.rect(-1e5, -1e5, 2e5, 2e5); outside.addPath(sp.wet, new DOMMatrix().translate(0, d2));
    ctx.clip(outside, 'evenodd');
    ctx.fillStyle = `rgba(118,118,124,${L.top * (0.6 + 0.4 * F)})`;
    ctx.fill(sp.wet);
    ctx.restore();
    // the sheen: pale soft spots toward the top
    if (sp.sheen.length) {
      ctx.save(); ctx.clip(sp.wet);
      const a = Math.min(1, 0.9 * L.sheen * (0.5 + 0.5 * F));
      for (const s of sp.sheen) {
        const cx = (sp.ox + s[0]) * TP, cy = (sp.oy + s[1]) * TP, rx = s[2] * TP, ry = s[3] * TP;
        ctx.save(); ctx.translate(cx, cy); ctx.scale(1, ry / rx);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
        g.addColorStop(0, `rgba(96,96,102,${a})`); g.addColorStop(0.5, `rgba(86,86,92,${a * 0.8})`); g.addColorStop(1, 'rgba(70,70,76,0)');
        ctx.fillStyle = g; ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
        ctx.restore();
      }
      ctx.restore();
    }
  }
}

/** The puddle's light at night, in the night glow map: the rim light and the sheen as a faint cool gleam (violet in the Hollow). */
function drawSeepGlow(ctx, sp) {
  if (!(sp.F > 0)) return;
  const L = seepLook(), F = sp.F, g = L.gleam, d = 0.05 * TP * (0.8 + 0.2 * L.gleamK);
  ctx.fillStyle = `rgba(${g[0]},${g[1]},${g[2]},${Math.min(0.9, 0.42 * (0.5 + 0.5 * F) * L.gleamK)})`;
  ctx.fill(sp.wet);
  ctx.save();
  ctx.clip(sp.wet);
  ctx.translate(0, -d);
  ctx.fillStyle = '#000';
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fill(sp.wet);
  ctx.globalCompositeOperation = 'source-over';
  ctx.translate(0, d);
  for (const s of sp.sheen) {
    const cx = (sp.ox + s[0]) * TP, cy = (sp.oy + s[1]) * TP, rx = s[2] * TP * 1.2;
    const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx);
    gr.addColorStop(0, `rgba(${g[0]},${g[1]},${g[2]},${Math.min(0.5, 0.16 * L.sheen * L.gleamK)})`); gr.addColorStop(1, `rgba(${g[0]},${g[1]},${g[2]},0)`);
    ctx.fillStyle = gr; ctx.fillRect(cx - rx, cy - rx, rx * 2, rx * 2);
  }
  ctx.restore();
}

/**
 * Each frame: notice a seep whose amount has crossed a step (or whose pumps changed) and make its puddle again, then
 * repaint its tiles (the ground bakes, the glow map and the sharp chunks). Cheap: a few array reads per seep.
 */
function seepFrame(force) {
  if (!S || !SEEP.list.length) return;
  if (!force && (++SEEP.frame % 12)) return;
  for (const sp of SEEP.list) {
    if (seepGeometry(sp, false)) redrawRegion(sp.ox, sp.oy, sp.ox + sp.W - 1, sp.oy + sp.H - 1);
  }
}

/**
 * The sheen's slow shimmer: a soft pale blob over each sheen spot of every seep on screen, breathing on its own slow
 * clock. Drawn each frame over the graded ground (and the night gleam), dimmer at night. A handful of tiny sprite draws
 * a seep, so it costs next to nothing; none on the Saver step, with reduced motion, or zoomed right out.
 */
function drawSeepShimmer(ctx, ox, oy, z, v0, v1) {
  if (!SEEP.shimmer || !SEEP.list.length || z < 18 || gfxStep() === 'saver' || (LESS_MOTION && LESS_MOTION.matches)) return;
  const L = seepLook(), dim = (1 - 0.6 * fxNight()) * L.sheen, tm = R.time;
  if (!SEEP.sprite) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    SEEP.sprite = c;
  }
  ctx.save();
  for (const sp of SEEP.list) {
    if (!(sp.F > 0) || !sp.sheen.length || sp.ox + sp.W < v0.x || sp.ox > v1.x || sp.oy + sp.H < v0.y || sp.oy > v1.y) continue;
    const k = (0.5 + 0.5 * sp.F) * dim;
    for (const s of sp.sheen) {
      const a = 0.5 + 0.5 * Math.sin(tm * (0.55 + 0.1 * Math.sin(s[4])) + s[4]);
      if (a < 0.08) continue;
      const rx = s[2] * z * 1.15, ry = s[3] * z * 1.15;
      ctx.globalAlpha = 0.2 * a * k;
      ctx.drawImage(SEEP.sprite, ox + (sp.ox + s[0]) * z - rx, oy + (sp.oy + s[1]) * z - ry, rx * 2, ry * 2);
    }
  }
  ctx.restore();
}

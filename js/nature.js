'use strict';
/*
 * Terrafall — the land itself, alive: wind, water, sky and weather on the ground, and the planet view. Looks only.
 * Nothing here changes the game, S, saves or orders: S is only read (the map, the clock, the seed, the effects), and
 * what is kept (NAT) is display-only, made afresh for each game. Anything random comes from the planet's seed (hash2),
 * so every device sees the same land; what moves runs on the frame's clock (R.time) or the game's (S.time).
 *
 * - Wind (natureWind): one wind for the whole map, its way and strength from the same stretches of the weather's clock
 *   as the clouds' drift (ambWind in js/ambient.js), so clouds, grass and trees all go the same way. Gusts roll across
 *   it downwind (natGust): crests a few tiles apart, in patches.
 * - Swaying plants (natPlants): zoomed in (where the ground is drawn from the sharp chunks), the decorative plants are
 *   drawn live instead of baked (hdBake leaves them out: natureLivePlants), each leaning with the wind and the gust passing
 *   over it, and pushed outward for a moment by a blast nearby.
 * - Wind in the grass (natSheen): bright crests of bent grass rolling across the grassy land at any zoom, and a ring of
 *   them running out from a blast.
 * - Wet ground (natWet): after rain the land and roads stay dark and glossy for a few minutes, with puddles; at night the
 *   wet roads mirror the streetlamps and the colonies' lights.
 * - Frost (natFrost): on the cold maps (the Polar Caps, Argos) rime creeps over the ground at dawn and melts
 *   by midday.
 * - The night sky (natSky): the Ring's faint silver light on the land (its strength, angle and tint differ by planet),
 *   and on the Polar Caps, Argos and the Bloom a slow aurora's light rippling over the ground.
 * - Water (natWater): the sun's sparkle on rivers and sea by day; the Ring's band and Argos's reflection by night, with
 *   stars on clear nights; gentle waves lapping along the shores.
 * - The planet view (natureOffMap, natureView): past the map's edge the land carries on, faded, unplayable (the map's own
 *   ground mirrored at its edges), sinking into a haze of the biome's colour that thickens outward. Zoomed right out the
 *   camera tilts a little (natureTiltAt: the finished frame redrawn in strips, nearer rows wider, a true perspective with
 *   straight lines kept straight) under a gentle depth haze. screenToWorld and worldToScreen (js/render.js) map through
 *   the same tilt, so picking, clicks and the minimap are unchanged.
 *
 * Cost follows the Graphics step: Saver has no swaying plants, no wind in the grass, no frost, no aurora and no tilt (the
 * planet view keeps its edges and haze). Reduced motion stills the sway, the gusts, the twinkles and the waves.
 */

const NATFX = {
  // The wind. gap: tiles between gust crests; speed: tiles a second they roll downwind; lean: how far a plant's crown
  // leans (a share of a tile) at full strength; flutter: its quick shiver; patch: tiles across a patch of gusts.
  wind: { gap: 6, speed: 3.4, lean: 0.085, flutter: 0.014, patch: 15 },
  sway: 34, // the zoom (px a tile) from which the plants are drawn live and sway (fewer of them on screen than further out)
  // The wind in the grass: how bright the crests are (by day; graded with the ground), their tint.
  sheen: { a: 0.32, tint: '255,248,214', shade: '58,54,40' },
  // How grassy each biome's open ground is (0: nothing to bend); a decorative plant adds `plant`.
  grass: { savanna: 1, autumn: 0.7, jungle: 0.55, swamp: 0.55, tropical: 0.5, springs: 0.7, alien: 0.45, desert: 0.22, polar: 0.2, volcanic: 0, lunar: 0, hollow: 0, plant: 0.25 },
  // Blasts that push the vegetation outward: tiles of reach (a 'boom' or 'flash' grows with its own size).
  blast: { boom: 2.6, flash: 2.2, fuelblast: 4.5, nuke: 15, crater: 3.2, collapse: 3, domefall: 6 },
  wetFor: 220,     // seconds the ground takes to dry after rain (the wetness falls by e each wetFor)
  frost: { polar: 0.5, lunar: 0.35 }, // how heavy the dawn rime is
  // The planet view: the most the camera tilts (the top row's narrowing, as a share), from how far in it starts
  // (times the furthest zoom), and the haze in each biome's colour.
  tilt: { most: 0.09, from: 1.9 },
  haze: {
    desert: '206,150,104', jungle: '128,164,150', polar: '206,220,236', autumn: '200,150,108', savanna: '214,184,128',
    swamp: '126,142,124', volcanic: '82,74,72', lunar: '22,22,30', alien: '120,88,164', springs: '176,198,190',
    tropical: '126,196,210', hollow: '14,10,20',
  },
  ring: ['200,210,232', '214,214,226', '188,206,236', '222,212,230'], // the Ring's light, by planet
  aurora: { polar: ['90,255,170', '80,200,255', '170,120,255'], alien: ['200,110,255', '255,120,210', '120,90,255'], lunar: ['150,200,255', '190,170,255', '120,240,220'] },
};

/** Display-only state (reset for each game). */
const NAT = { of: null, seen: new WeakSet(), blasts: [], veg: null, vegKey: '', vegAt: -99, water: null, waterAt: -99, hasWater: false, buf: null, buf2: null, warp: null, warpIdle: 0, frost: null, wind: null, windAt: -1 };

function natState() {
  if (NAT.of !== S) {
    NAT.of = S; NAT.seen = new WeakSet(); NAT.blasts = []; NAT.vegKey = ''; NAT.vegAt = -99; NAT.waterAt = -99; NAT.ringOf = null; NAT.wind = null;
    if (NAT.warp) NAT.warp.width = NAT.warp.height = 0;
  }
  return NAT;
}

/** Reduced motion: the sway, gusts, twinkles and waves hold still. */
function natStill() { return typeof LESS_MOTION !== 'undefined' && !!LESS_MOTION && LESS_MOTION.matches; }
function natSaver() { return typeof gfxStep === 'function' && gfxStep() === 'saver'; }
/** The biome's look outdoors (the Hollow is underground: no sky). */
function natSky() { return !(S.hollow || biome() === 'hollow'); }

/* ------------------------------------------------------------------ the wind */

/**
 * The wind now: { dx, dy } its way (a unit vector), s its strength (about 0.2 calm to 1.2 in a gale), from the weather's
 * stretches (ambWind, as the clouds' drift; veering from one stretch's to the next as ambDrift does), stronger in a spell
 * of weather. Worked out once a frame.
 */
function natureWind() {
  if (NAT.wind && NAT.windAt === R.time && NAT.of === S) return NAT.wind;
  const t = S.time, L = WEATHER.slot, w = AMB.cloud.turn, n = Math.max(0, Math.floor(t / L)), dt = t - n * L;
  let v = ambWind(n);
  if (dt < w && n > 0) { const a = ambWind(n - 1), f = (dt + w) / (2 * w); v = { x: a.x + (v.x - a.x) * f, y: a.y + (v.y - a.y) * f }; }
  else if (L - dt < w) { const b = ambWind(n + 1), f = (dt - (L - w)) / (2 * w); v = { x: v.x + (b.x - v.x) * f, y: v.y + (b.y - v.y) * f }; }
  const sp = Math.hypot(v.x, v.y), seed = (S.seed || 1) | 0;
  const dx = sp > 1e-4 ? v.x / sp : 1, dy = sp > 1e-4 ? v.y / sp : 0;
  const s = clamp(0.2 + 0.7 * (sp / AMB.cloud.speedWx) + 0.12 * Math.sin(t * 0.023 + seed) + 0.35 * ambWeather(), 0.12, 1.25);
  NAT.wind = { dx, dy, s, sp }; NAT.windAt = R.time;
  return NAT.wind;
}

/** The gust at world point (x, y) at clock T (0..1): crests rolling downwind, in patches. */
function natGust(W, x, y, T) {
  const C = NATFX.wind, rx = x - S.W / 2, ry = y - S.H / 2;
  const u = rx * W.dx + ry * W.dy - T * C.speed, v = -rx * W.dy + ry * W.dx;
  const c = 0.5 + 0.5 * Math.sin((u / C.gap) * Math.PI * 2 + 0.8 * Math.sin(v * 0.19));
  const patch = valueNoise(u / C.patch, v / (C.patch * 0.7), (S.seed | 0) + 4021);
  return c * c * (0.25 + 0.95 * patch);
}

/** The frame clock the wind and water run on (held still under reduced motion). */
function natClock() { return natStill() ? 0 : R.time; }

/* ------------------------------------------------------------------ blasts */

/** New blasts in S.fx (read only): they push the plants and the grass outward for a moment. */
function natHear() {
  const N = NAT, B = NATFX.blast;
  for (const f of S.fx) {
    if (N.seen.has(f)) continue;
    N.seen.add(f);
    let r = B[f.type];
    if (!r) continue;
    if (f.type === 'boom' || f.type === 'flash') r *= 0.6 + Math.min(2, f.r || 0.6);
    N.blasts.push({ x: f.x, y: f.y, r, t: R.time });
  }
  if (N.blasts.length && R.time - N.blasts[0].t > 2) N.blasts = N.blasts.filter((b) => R.time - b.t <= 2);
  if (N.blasts.length > 40) N.blasts.splice(0, N.blasts.length - 40);
}

/** How hard blast b pushes something d tiles from it, `age` seconds on: out at once, then springing back. */
function natPush(b, d, age) {
  if (d >= b.r) return 0;
  const front = (d / b.r) * 0.25; // (the shock reaches the far plants a moment later)
  const a = age - front;
  if (a < 0) return 0;
  const env = a < 0.06 ? a / 0.06 : Math.exp(-(a - 0.06) * 3) * Math.cos((a - 0.06) * 8);
  return (1 - d / b.r) * env;
}

/* ------------------------------------------------------------------ ground (before the light of the time of day) */

/**
 * Called by render after the ground is drawn and before it is graded for the time of day: swaying plants, the wind in
 * the grass, wet ground and frost (all graded with the ground, as the baked ground is).
 */
function natureGround(ctx, ox, oy, z, v0, v1) {
  if (!S || !S.settings) return;
  natState();
  natHear();
  if (hdLevel(z) && R.hd) { natPlants(ctx, ox, oy, z, v0, v1); natRebake(z, v0, v1); }
  if (!natSaver() && !natStill()) natSheen(ctx, ox, oy, z);
  const wet = natureWet();
  if (wet > 0.01) natWetGround(ctx, ox, oy, z, v0, v1, wet);
  const fr = natureFrost();
  if (fr > 0.01 && !natSaver()) natFrost(ctx, ox, oy, z, fr);
}

/**
 * Are the decorative plants left out of the sharp chunks being baked now, to be drawn live and swaying (natPlants)? Zoomed
 * in past NATFX.sway (a little give either side, so it doesn't flicker), not on Saver, not with reduced motion. A chunk
 * keeps what it was baked with: natPlants draws the plants of every chunk baked without them, swaying or not.
 */
function natureLivePlants() {
  if (!S || !S.decor || natSaver() || natStill()) return (NAT.swayOn = false);
  const z = R.cam.z;
  NAT.swayOn = NAT.swayOn ? z >= NATFX.sway - 4 : z >= NATFX.sway;
  return NAT.swayOn;
}

/** The decorative plants in view, each leaning with the wind and the gust over it, and pushed by any blast near it. */
function natPlants(ctx, ox, oy, z, v0, v1) {
  const W = natureWind(), T = natClock(), C = NATFX.wind, d = R.dpr, k = z / TP, sway = natureLivePlants() ? 1 : 0;
  // (the chunk each tile is drawn from now, as drawMapLayer picks it: this zoom's sharpness, or else the other one)
  const lv = hdLevel(z), alt = lv === 64 ? 128 : 64, chunks = R.hd.chunks, key = (l, cx, cy) => (l * 4096 + cy) * 4096 + cx;
  const live = (i, j) => { const cx = (i / HD_CHUNK) | 0, cy = (j / HD_CHUNK) | 0, ch = chunks.get(key(lv, cx, cy)) || chunks.get(key(alt, cx, cy)); return !!ch && !!ch.ctx.noPlants; };
  const i0 = Math.max(0, Math.floor(v0.x) - 1), i1 = Math.min(S.W - 1, Math.ceil(v1.x) + 1);
  const j0 = Math.max(0, Math.floor(v0.y) - 1), j1 = Math.min(S.H - 1, Math.ceil(v1.y) + 1);
  const prevScale = R.drawScale;
  R.drawScale = k * d; R.inMap = true;
  const H = TP * 0.9, blasts = NAT.blasts, seed = S.seed | 0;
  ctx.save();
  try {
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const t = j * S.W + i, v = S.decor[t];
      if (!v || S.terrain[t] !== T_GROUND || S.road[t] || S.res[t] || S.plan[t] || S.bAt[t] || !live(i, j)) continue;
      ctx.setTransform(d * k, 0, 0, d * k, d * ox, d * oy);
      if (S.ash && scarStump(t)) { drawStump(ctx, v, i, j, i * TP, j * TP); continue; } // (a charred stump doesn't sway)
      const h = hash2(i, j, seed + 4031), g = natGust(W, i + 0.5, j + 0.5, T);
      const bend = W.s * (0.22 + 0.78 * g) * C.lean * TP * (0.75 + 0.5 * h);
      const fl = W.s * C.flutter * TP * Math.sin(T * (2.2 + h) + h * 9);
      let Dx = W.dx * (bend + fl) * sway, Dy = W.dy * (bend + fl) * 0.6 * sway;
      for (const b of blasts) {
        const bx = i + 0.5 - b.x, by = j + 0.5 - b.y, dd = Math.hypot(bx, by) || 0.01;
        const p = sway && natPush(b, dd, R.time - b.t);
        if (p) { Dx += (bx / dd) * p * 0.3 * TP; Dy += (by / dd) * p * 0.18 * TP; }
      }
      const baseY = (j + 0.5) * TP + TP * 0.28;
      ctx.transform(1, 0, -Dx / H, 1 - Dy / H, (Dx * baseY) / H, (Dy * baseY) / H);
      drawPlant(ctx, v, i, j, i * TP, j * TP, false);
    }
  } finally { R.inMap = false; R.drawScale = prevScale; ctx.restore(); }
}

/**
 * While the plants sway: a sharp chunk on screen still baked with its plants in is baked again without them (one a frame,
 * nearest the middle first, swapped in after this frame's drawing, so nothing is drawn twice or goes missing).
 */
function natRebake(z, v0, v1) {
  if (!NAT.swayOn) return;
  const lv = hdLevel(z), C = HD_CHUNK, chunks = R.hd.chunks;
  const cx0 = Math.max(0, Math.floor(v0.x / C)), cx1 = Math.floor(v1.x / C), cy0 = Math.max(0, Math.floor(v0.y / C)), cy1 = Math.floor(v1.y / C);
  const mx = R.cam.x / C - 0.5, my = R.cam.y / C - 0.5;
  let best = null, bd = Infinity;
  for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
    const k = (lv * 4096 + cy) * 4096 + cx, ch = chunks.get(k);
    if (!ch || ch.ctx.noPlants) continue;
    const d = Math.hypot(cx - mx, cy - my);
    if (d < bd) { bd = d; best = [k, ch, cx, cy]; }
  }
  if (!best) return;
  const [k, old, cx, cy] = best, ch = hdBake(lv, cx, cy);
  ch.used = old.used;
  old.c.width = 0;
  chunks.set(k, ch);
}

/** A canvas buffer of NAT (made once, resized as needed), cleared. */
function natBuffer(name, w, h) {
  let c = NAT[name];
  if (!c) c = NAT[name] = document.createElement('canvas');
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  const g = c.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  g.clearRect(0, 0, w, h);
  return g;
}

/** How grassy tile t is for the wind in the grass (0..1). */
function natGrassy(t) {
  if (S.terrain[t] !== T_GROUND || S.road[t] || S.bAt[t] || (S.rail && S.rail[t]) || (S.lava && S.lava[t])) return 0;
  const G = NATFX.grass, b = renderBiomeAt(t);
  let g = G[b] || 0;
  if (!g) return 0;
  if (S.decor && S.decor[t]) g += G.plant;
  if (S.res[t]) g *= 0.5;
  if (S.ash && S.ash[t]) g *= 0.3; // (burned ground: little left to bend)
  return Math.min(1, g);
}

/** The grassiness map: one pixel a tile, its alpha how grassy (made again every few seconds as the colony builds). */
function natVegMask() {
  const N = NAT, key = `${S.roadVer}|${S.buildings.length}|${S.W}x${S.H}`;
  if (N.veg && (N.vegKey === key || R.time - N.vegAt < 3)) return N.veg;
  N.vegKey = key; N.vegAt = R.time;
  const c = N.veg || (N.veg = document.createElement('canvas'));
  if (c.width !== S.W || c.height !== S.H) { c.width = S.W; c.height = S.H; }
  const g = c.getContext('2d'), im = g.createImageData(S.W, S.H), px = im.data;
  let any = 0;
  for (let t = 0; t < S.W * S.H; t++) { const a = natGrassy(t); px[t * 4] = px[t * 4 + 1] = px[t * 4 + 2] = 255; px[t * 4 + 3] = (a * 255) | 0; any += a; }
  g.putImageData(im, 0, 0);
  N.vegAny = any > 1;
  return c;
}

/** A soft round puff in colour rgb ('r,g,b'), made once (ambPuff, tinted). */
function natPuff(rgb) {
  const P = NAT.puffs || (NAT.puffs = {});
  if (P[rgb]) return P[rgb];
  const src = ambPuff(), c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  const g = c.getContext('2d');
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-in'; g.fillStyle = `rgb(${rgb})`; g.fillRect(0, 0, c.width, c.height);
  return (P[rgb] = c);
}

/**
 * The wind in the grass: crests of bent grass catching the light, each a few tiles long across the wind, with the darker
 * side of the grass just upwind of them, rolling downwind over every grassy tile; a blast sends a ring of them running
 * outward. Made in a small buffer, masked to the grassy land and laid over the view in one draw.
 */
function natSheen(ctx, ox, oy, z) {
  const mask = natVegMask();
  if (!NAT.vegAny) return;
  const W = natureWind(), T = natClock(), C = NATFX.wind;
  const k = gfxStep() === 'ultra' ? 1 / 3 : gfxStep() === 'high' ? 1 / 4 : 1 / 6, bw = Math.max(1, Math.ceil(R.w * k)), bh = Math.max(1, Math.ceil(R.h * k));
  const g = natBuffer('buf', bw, bh), lit = natPuff(NATFX.sheen.tint), shade = natPuff(NATFX.sheen.shade);
  // The view's corners in the wind's own frame (u downwind, v across it), about the middle of the map.
  const cx = S.W / 2, cy = S.H / 2;
  const toU = (x, y) => (x - cx) * W.dx + (y - cy) * W.dy, toV = (x, y) => -(x - cx) * W.dy + (y - cy) * W.dx;
  const wx0 = -ox / z, wy0 = -oy / z, wx1 = (R.w - ox) / z, wy1 = (R.h - oy) / z;
  let u0 = Infinity, u1 = -Infinity, vv0 = Infinity, vv1 = -Infinity;
  for (const [x, y] of [[wx0, wy0], [wx1, wy0], [wx0, wy1], [wx1, wy1]]) { const u = toU(x, y), v = toV(x, y); u0 = Math.min(u0, u); u1 = Math.max(u1, u); vv0 = Math.min(vv0, v); vv1 = Math.max(vv1, v); }
  const shift = T * C.speed, gap = C.gap, seg = 4.5, seed = S.seed | 0;
  const m0 = Math.floor((u0 - shift) / gap) - 1, m1 = Math.ceil((u1 - shift) / gap) + 1;
  const n0 = Math.floor(vv0 / seg) - 1, n1 = Math.ceil(vv1 / seg) + 1;
  const ang = Math.atan2(W.dy, W.dx), ca = Math.cos(ang), sa = Math.sin(ang), back = 0.75 * z * k;
  let drawn = 0, bx0 = bw, by0 = bh, bx1 = 0, by1 = 0;
  if ((m1 - m0) * (n1 - n0) < 4000) {
    for (let pass = 0; pass < 2; pass++) { // (the dark sides first, then the crests over them)
      for (let m = m0; m <= m1 && drawn < 1600; m++) {
        const u = m * gap + shift;
        for (let n = n0; n <= n1; n++) {
          const h = hash2(m, n, seed + 4041);
          if (h > 0.62) continue; // (gaps along a crest)
          const v = n * seg + (hash2(n, m, seed + 4042) - 0.5) * seg * 0.6;
          const patch = valueNoise((u - shift) / C.patch + m * 0.37, v / (C.patch * 0.7), seed + 4021);
          const a = (0.4 + 0.6 * Math.min(1, W.s)) * (0.1 + patch) * (0.6 + 0.4 * Math.sin(T * 0.7 + h * 12));
          if (a < 0.08) continue;
          const uu = u + Math.sin(v * 0.19 + m) * 0.8;
          const x = cx + uu * W.dx - v * W.dy, y = cy + uu * W.dy + v * W.dx;
          let sx = (ox + x * z) * k, sy = (oy + y * z) * k;
          const ru = (pass ? 0.42 : 0.6) * z * k, rv = seg * (0.6 + 0.5 * h) * z * k;
          if (!pass) { sx -= W.dx * back; sy -= W.dy * back; }
          if (sx < -rv || sy < -rv || sx > bw + rv || sy > bh + rv) continue;
          g.globalAlpha = Math.min(1, a * (pass ? 1.5 : 1.1));
          g.setTransform(ca, sa, -sa, ca, sx, sy);
          g.drawImage(pass ? lit : shade, -ru, -rv, ru * 2, rv * 2);
          bx0 = Math.min(bx0, sx - rv); by0 = Math.min(by0, sy - rv); bx1 = Math.max(bx1, sx + rv); by1 = Math.max(by1, sy + rv);
          drawn++;
        }
      }
    }
  }
  // A blast: a ring of flattened grass running out from it.
  g.setTransform(1, 0, 0, 1, 0, 0);
  for (const b of NAT.blasts) {
    const age = R.time - b.t;
    if (age > 0.9) continue;
    const r = Math.max(0.5, b.r * Math.min(1, age / 0.5) * z * k), x = (ox + b.x * z) * k, y = (oy + b.y * z) * k, lw = Math.max(1, z * k * 0.7);
    g.globalAlpha = (1 - age / 0.9) * 0.9;
    g.strokeStyle = `rgb(${NATFX.sheen.tint})`; g.lineWidth = lw;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
    bx0 = Math.min(bx0, x - r - lw); by0 = Math.min(by0, y - r - lw); bx1 = Math.max(bx1, x + r + lw); by1 = Math.max(by1, y + r + lw);
    drawn++;
  }
  if (!drawn) return;
  // Only the part with something in it, and only over the map.
  bx0 = Math.max(0, Math.floor(bx0), Math.floor(ox * k)); by0 = Math.max(0, Math.floor(by0), Math.floor(oy * k));
  bx1 = Math.min(bw, Math.ceil(bx1), Math.ceil((ox + S.W * z) * k)); by1 = Math.min(bh, Math.ceil(by1), Math.ceil((oy + S.H * z) * k));
  if (bx1 <= bx0 || by1 <= by0) return;
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'destination-in';
  g.imageSmoothingEnabled = true;
  g.drawImage(mask, ox * k, oy * k, S.W * z * k, S.H * z * k);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.globalAlpha = NATFX.sheen.a; // (plain blending: the cheapest way over most of the screen)
  ctx.drawImage(NAT.buf, bx0, by0, bx1 - bx0, by1 - by0, bx0 / k, by0 / k, (bx1 - bx0) / k, (by1 - by0) / k);
  ctx.restore();
}

/* ------------------------------------------------------------------ wet ground */

/**
 * How wet the ground is now (0..1): soaking in through a rainstorm, then drying over the next few minutes. From the
 * planet's seed and the game clock, as the weather itself (the same spells as weatherAt, the one before this one too).
 */
function natureWet() {
  if (!S || !S.settings || !weatherOn() || WEATHER.kinds[biome()] !== 'rain') return 0;
  const t = S.time, L = WEATHER.slot, n = Math.floor(t / L), seed = (S.seed || 1) | 0;
  let w = 0;
  for (const m of [n, n - 1]) {
    if (m < 1 || hash2(seed, m, 71) >= WEATHER.chance) continue;
    const t0 = m * L + 40 + hash2(seed, m, 72) * 160, len = 80 + hash2(seed, m, 73) * 90, x = t - t0;
    if (x < 0) continue;
    const peak = 0.75 + 0.25 * hash2(seed, m, 74);
    w = Math.max(w, x <= len ? clamp(x / 30, 0, 1) * peak : peak * Math.exp(-(x - len) / NATFX.wetFor));
  }
  return w < 0.02 ? 0 : w;
}

/** Puddle at tile (i, j)? Its shape: { x, y, rx, ry } (tiles), or null. */
function natPuddle(i, j, t, seed) {
  if (S.terrain[t] !== T_GROUND || S.bAt[t] || S.res[t] || (S.decor && S.decor[t])) return null;
  const h = hash2(i, j, seed + 4051);
  if (h > (S.road[t] ? 0.3 : 0.12)) return null;
  return { x: i + 0.25 + 0.5 * hash2(j, i, seed + 4052), y: j + 0.3 + 0.4 * hash2(i, j, seed + 4053), rx: 0.18 + 0.22 * hash2(i, j, seed + 4054), ry: 0.1 + 0.1 * hash2(j, i, seed + 4055) };
}

/** Wet ground: the land a little darker and cooler, the roads glossy, puddles standing in the low spots. */
function natWetGround(ctx, ox, oy, z, v0, v1, w) {
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = `rgba(112,124,140,${0.42 * w})`;
  ctx.fillRect(0, 0, R.w, R.h);
  ctx.globalCompositeOperation = 'source-over';
  if (z >= 8) {
    const i0 = Math.max(0, Math.floor(v0.x)), i1 = Math.min(S.W - 1, Math.ceil(v1.x)), j0 = Math.max(0, Math.floor(v0.y)), j1 = Math.min(S.H - 1, Math.ceil(v1.y));
    const seed = S.seed | 0, road = new Path2D(), pud = new Path2D(), hi = new Path2D();
    let roads = 0, puds = 0;
    const sc = Math.sqrt(w);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const t = j * S.W + i;
      if (S.road[t] && S.terrain[t] === T_GROUND && !S.bAt[t]) { road.rect(ox + i * z, oy + j * z, z, z); roads++; }
      const p = natPuddle(i, j, t, seed);
      if (!p) continue;
      const x = ox + p.x * z, y = oy + p.y * z, rx = p.rx * z * sc, ry = p.ry * z * sc;
      if (rx < 0.8) continue;
      pud.moveTo(x + rx, y); pud.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      hi.moveTo(x + rx * 0.5, y - ry * 0.35); hi.ellipse(x - rx * 0.1, y - ry * 0.35, rx * 0.55, ry * 0.32, 0, 0, Math.PI * 2);
      puds++;
    }
    if (roads) { ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = `rgba(150,170,196,${0.2 * w})`; ctx.fill(road); ctx.globalCompositeOperation = 'source-over'; }
    if (puds) {
      ctx.fillStyle = `rgba(52,64,80,${0.55 * w})`; ctx.fill(pud);
      ctx.fillStyle = `rgba(190,206,224,${0.45 * w})`; ctx.fill(hi);
    }
  }
  ctx.restore();
}

/** At night, wet ground mirrors the lights: streaks under the streetlamps and the lit buildings, the Ring in the puddles. */
function natWetNight(ctx, ox, oy, z, v0, v1, w) {
  const on = TOD.active ? TOD.state.lights : 0;
  if (on < 0.05 || z < 8) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const streak = (x, y, len, wid, rgb, a) => {
    const g = ctx.createLinearGradient(0, y, 0, y + len);
    g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(x, y + len / 2, wid, len / 2, 0, 0, Math.PI * 2); ctx.fill();
  };
  if (S.road) for (const e of streetLamps(v0, v1)) {
    if (murmurDarkAt(e.i, e.j)) continue;
    const L = STREETLIGHT[e.kind];
    streak(ox + e.x * z, oy + (e.y + 0.1) * z, z * 1.3, z * 0.14, L.rgb.join(','), 0.5 * w * on);
  }
  for (const b of S.buildings) {
    if (b.dead || !b.built || b.x < v0.x - 2 || b.x > v1.x + 2 || b.y < v0.y - 2 || b.y > v1.y + 2 || !buildingNightOn(b)) continue;
    const c = bCentre(b), col = PLAYER_COLORS[b.owner];
    if (!col) continue;
    const r = parseInt(col.slice(1, 3), 16), g = parseInt(col.slice(3, 5), 16), bl = parseInt(col.slice(5, 7), 16);
    streak(ox + c.x * z, oy + (c.y + 0.45) * z, z * 1.1, z * 0.28, `${r},${g},${bl}`, 0.22 * w * on);
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ frost */

/**
 * How much frost there is now (0..1), on the cold maps only: none by day; it creeps in through the last of the night,
 * is thickest at dawn and through the morning, and melts away by midday. Follows the time of day as shown (the Day and
 * night setting, photo mode's slider).
 */
function natureFrost() {
  const k = NATFX.frost[biome()];
  if (!k || !S || !weatherOn() || typeof TOD === 'undefined') return 0;
  const x = natDayPos();
  if (x === null) return 0;
  const N0 = NIGHT_TO - 90, M1 = 90, D1 = 240; // (from 90 s before night ends; melting through the morning into the day)
  let f = 0;
  if (x >= N0) f = (x - N0) / (TOD_LEN - N0);
  else if (x < M1) f = 1;
  else if (x < D1) f = 1 - (x - M1) / (D1 - M1);
  f = clamp(f, 0, 1);
  return k * f * f * (3 - 2 * f);
}

/** Seconds into the day's cycle as shown now (null when it's held at day or always night). */
function natDayPos() {
  if (TOD.over != null && todForced() !== 'night') return ((TOD.over % TOD_LEN) + TOD_LEN) % TOD_LEN;
  const m = todMode();
  if (m !== 'cycle' || todHeld() || !S) return null;
  return ((S.time % TOD_LEN) + TOD_LEN) % TOD_LEN;
}

/**
 * The rime: four layers of the same crystals and pale patches, each with more of them than the last (frost grows by
 * fading in the next), drawn at the screen's own pixels (NATFX.frost.px css px across) so the crystals stay crisp.
 */
function natFrostLayers() {
  const d = Math.max(1, Math.round(R.dpr * 2) / 2);
  if (NAT.frost && NAT.frostDpr === d) return NAT.frost;
  const n = Math.round(160 * d), out = [], seed = 4061, pts = [], blots = [];
  for (let k = 0; k < 420; k++) {
    const x = hash2(k, 1, seed) * n, y = hash2(k, 2, seed) * n;
    // (rank: crystals come first in the cold hollows of a noise field, then spread)
    const rank = 0.7 * valueNoise((x / n) * 4, (y / n) * 4, seed + 1) + 0.3 * hash2(k, 3, seed);
    pts.push({ x, y, rank, a: hash2(k, 4, seed) * Math.PI, l: (1.2 + hash2(k, 5, seed) * 2.2) * d, w: hash2(k, 6, seed) });
  }
  for (let k = 0; k < 26; k++) blots.push({ x: hash2(k, 7, seed) * n, y: hash2(k, 8, seed) * n, r: (10 + 22 * hash2(k, 9, seed)) * d, rank: hash2(k, 10, seed) });
  for (let L = 1; L <= 4; L++) {
    const c = document.createElement('canvas');
    c.width = c.height = n;
    const g = c.getContext('2d'), lim = (L / 4) * 0.98;
    const wrap = (x, y, r, fn) => { for (const [dx, dy] of [[0, 0], [n, 0], [-n, 0], [0, n], [0, -n], [n, n], [-n, -n], [n, -n], [-n, n]]) { const X = x + dx, Y = y + dy; if (X > -r && Y > -r && X < n + r && Y < n + r) fn(X, Y); } };
    for (const b of blots) {
      if (b.rank > lim) continue;
      wrap(b.x, b.y, b.r, (X, Y) => {
        const gr = g.createRadialGradient(X, Y, 0, X, Y, b.r);
        gr.addColorStop(0, 'rgba(232,242,255,0.22)'); gr.addColorStop(1, 'rgba(232,242,255,0)');
        g.fillStyle = gr; g.fillRect(X - b.r, Y - b.r, b.r * 2, b.r * 2);
      });
    }
    g.lineCap = 'round';
    for (const p of pts) {
      if (p.rank > lim) continue;
      wrap(p.x, p.y, p.l + 2, (X, Y) => {
        g.strokeStyle = `rgba(240,248,255,${0.45 + 0.45 * p.w})`; g.lineWidth = (0.5 + p.w * 0.5) * d;
        g.beginPath();
        for (let s = 0; s < 3; s++) { const a = p.a + (s * Math.PI) / 3; g.moveTo(X - Math.cos(a) * p.l, Y - Math.sin(a) * p.l); g.lineTo(X + Math.cos(a) * p.l, Y + Math.sin(a) * p.l); }
        g.stroke();
      });
    }
    out.push(c);
  }
  NAT.frostDpr = d;
  return (NAT.frost = out);
}

/** Frost over the land in view (and the plants and roads on it; not on open water), as heavy as `f` (0..1). */
function natFrost(ctx, ox, oy, z, f) {
  const L = natFrostLayers(), lv = f * 4, a = Math.min(3, Math.floor(lv)), b = Math.min(3, a + 1), mix = lv - a;
  // Only the land: a rectangle for each run of land tiles along each row in view.
  const v0 = viewToWorld(0, 0), v1 = viewToWorld(R.w, R.h);
  const i0 = Math.max(0, Math.floor(v0.x)), i1 = Math.min(S.W - 1, Math.ceil(v1.x)), j0 = Math.max(0, Math.floor(v0.y)), j1 = Math.min(S.H - 1, Math.ceil(v1.y));
  const land = new Path2D();
  for (let j = j0; j <= j1; j++) {
    let run = -1;
    for (let i = i0; i <= i1 + 1; i++) {
      const ok = i <= i1 && S.terrain[j * S.W + i] !== T_WATER;
      if (ok && run < 0) run = i;
      if (!ok && run >= 0) { land.rect(ox + run * z, oy + j * z, (i - run) * z, z); run = -1; }
    }
  }
  ctx.save();
  ctx.clip(land);
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = `rgba(190,210,236,${0.2 * f})`;
  ctx.fillRect(0, 0, R.w, R.h);
  ctx.globalCompositeOperation = 'source-over';
  const d = NAT.frostDpr;
  const draw = (img, al) => {
    if (al <= 0.01) return;
    const pat = ctx.createPattern(img, 'repeat');
    if (pat.setTransform) pat.setTransform(new DOMMatrix([1 / d, 0, 0, 1 / d, ox % (img.width / d), oy % (img.width / d)]));
    ctx.globalAlpha = al; ctx.fillStyle = pat;
    ctx.fillRect(0, 0, R.w, R.h);
  };
  draw(L[a], Math.min(1, lv)); // (each layer has all of the last one's crystals, and more)
  if (a !== b && lv >= 1) draw(L[b], mix);
  ctx.restore();
}

/* ------------------------------------------------------------------ the light on the ground (after the time of day) */

/**
 * Called by render after the ground is graded for the time of day: the Ring's light and the aurora by night, the light
 * on the water, wet roads mirroring the lights.
 */
function natureLight(ctx, ox, oy, z, v0, v1) {
  if (!S || !S.settings) return;
  natState();
  const night = fxNight();
  if (night > 0.02 && natSky()) {
    natNightSky(ctx, ox, oy, z, night);
  }
  natWater(ctx, ox, oy, z, v0, v1, night);
  const wet = natureWet();
  if (wet > 0.01 && night > 0.05) natWetNight(ctx, ox, oy, z, v0, v1, wet);
}

/** This planet's Ring: the way its light falls, how bright, its tint, where Argos and the Ring's band are reflected. */
function natRing() {
  if (NAT.ringOf === S && NAT.ring) return NAT.ring;
  const seed = (S.seed || 1) | 0;
  NAT.ringOf = S;
  return (NAT.ring = {
    ang: hash2(seed, 1, 4071) * Math.PI * 2,
    k: 0.75 + 0.5 * hash2(seed, 2, 4071),
    rgb: NATFX.ring[Math.floor(hash2(seed, 3, 4071) * NATFX.ring.length)],
    band: -0.35 + 0.7 * hash2(seed, 4, 4071), // (the band's slant over the view)
    bandY: 0.28 + 0.3 * hash2(seed, 5, 4071),
    moonX: 0.2 + 0.6 * hash2(seed, 6, 4071), moonY: 0.18 + 0.3 * hash2(seed, 7, 4071),
  });
}

/** How clear the sky is (1: no weather; the stars and the Ring's band need a clear night). */
function natClear() { return clamp(1 - 1.4 * ambWeather(), 0, 1); }

/**
 * The night sky's light on the land, in one small buffer laid over the view in one draw: the Ring's faint silver light,
 * brighter on one side of the map than the other (by planet), and on the Polar Caps, Argos and the Bloom a slow aurora,
 * soft curtains of colour drifting over the ground.
 */
function natNightSky(ctx, ox, oy, z, night) {
  const Rg = natRing(), clear = natClear(), T = natClock(), seed = S.seed | 0;
  const k = 1 / 8, bw = Math.max(1, Math.ceil(R.w * k)), bh = Math.max(1, Math.ceil(R.h * k));
  const g = natBuffer('buf', bw, bh);
  // the Ring's light (a little through cloud too)
  const a = 0.6 * Rg.k * (0.55 + 0.45 * clear);
  const cx = (ox + (S.W / 2) * z) * k, cy = (oy + (S.H / 2) * z) * k, len = Math.max(S.W, S.H) * z * k * 0.6;
  const gx = Math.cos(Rg.ang) * len, gy = Math.sin(Rg.ang) * len;
  const gr = g.createLinearGradient(cx - gx, cy - gy, cx + gx, cy + gy);
  gr.addColorStop(0, `rgba(${Rg.rgb},${a})`); gr.addColorStop(1, `rgba(${Rg.rgb},${a * 0.35})`);
  g.fillStyle = gr; g.fillRect(0, 0, bw, bh);
  const cols = NATFX.aurora[biome()];
  if (cols && !natSaver() && clear > 0.05) {
    g.lineCap = 'round';
    for (let n = 0; n < 3; n++) {
      const h = hash2(seed, n, 4081), base = (0.15 + 0.32 * n + 0.1 * h) * S.H, ph = h * 9 + T * (0.05 + 0.02 * n);
      g.strokeStyle = `rgb(${cols[n]})`;
      for (const [wd, al] of [[7, 0.35], [3.5, 0.6], [1.4, 0.9]]) {
        g.globalAlpha = 1.6 * clear * al * (0.6 + 0.4 * Math.sin(T * 0.11 + n * 2 + h * 5));
        g.lineWidth = wd * z * k;
        g.beginPath();
        for (let s = 0; s <= 24; s++) {
          const x = -6 + (s / 24) * (S.W + 12), y = base + 5 * Math.sin(x * 0.07 + ph) + 2.5 * Math.sin(x * 0.19 - ph * 1.7 + n);
          const sx = (ox + x * z) * k, sy = (oy + y * z) * k;
          if (s) g.lineTo(sx, sy); else g.moveTo(sx, sy);
        }
        g.stroke();
      }
    }
  }
  ctx.save();
  ctx.globalAlpha = 0.09 * night; // (plain blending, faint: the cheapest way over the whole screen)
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(NAT.buf, 0, 0, R.w, R.h);
  ctx.restore();
}

/** Is tile t open water that mirrors the sky (not lava, not on the ash or the moon)? */
function natWaterTile(t) { return S.terrain[t] === T_WATER && !(S.lava && S.lava[t]) && renderBiomeAt(t) !== 'volcanic' && renderBiomeAt(t) !== 'lunar'; }

/** The open water: four pixels a tile, opaque where there's water (made again now and then: tides, causeways). */
function natWaterMask() {
  const N = NAT;
  if (N.water && R.time - N.waterAt < 8 && N.water.width === S.W * 4) return N.water;
  N.waterAt = R.time;
  const c = N.water || (N.water = document.createElement('canvas'));
  c.width = S.W * 4; c.height = S.H * 4;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  let n = 0;
  for (let t = 0; t < S.W * S.H; t++) if (natWaterTile(t)) { g.fillRect((t % S.W) * 4, ((t / S.W) | 0) * 4, 4, 4); n++; }
  N.hasWater = n > 0;
  return c;
}

/**
 * The light on the water: by day the sun's sparkle (thickest toward the top of the view, where the sun's path lies); at
 * night the Ring's band and Argos mirrored in it, with stars on a clear night; at any time small waves lapping the shores.
 */
function natWater(ctx, ox, oy, z, v0, v1, night) {
  const mask = natWaterMask();
  if (!NAT.hasWater) return;
  const T = natClock(), still = natStill(), seed = S.seed | 0, sky = natSky();
  const i0 = Math.max(0, Math.floor(v0.x)), i1 = Math.min(S.W - 1, Math.ceil(v1.x)), j0 = Math.max(0, Math.floor(v0.y)), j1 = Math.min(S.H - 1, Math.ceil(v1.y));
  const sun = sky ? ambLight(AMB.sun) * (1 - 0.8 * ambWeather()) : 0, clear = natClear();
  const step = z < 14 ? 2 : 1;
  // The water in view (its bounds): none, nothing to do.
  let wi0 = S.W, wi1 = -1, wj0 = S.H, wj1 = -1;
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (natWaterTile(j * S.W + i)) { if (i < wi0) wi0 = i; if (i > wi1) wi1 = i; if (j < wj0) wj0 = j; if (j > wj1) wj1 = j; }
  if (wi1 < 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // The sun's sparkle: each glint flashes a moment and is gone.
  if (sun > 0.05 && z >= 6) {
    const warm = TOD.active && (TOD.state.a === 'evening' || TOD.state.b === 'evening' || TOD.state.a === 'morning') ? '255,214,150' : '255,252,236';
    const P = new Path2D(), Q = new Path2D(), r = Math.max(0.6, z * 0.028);
    for (let j = wj0 - (wj0 % step); j <= wj1; j += step) for (let i = wi0 - (wi0 % step); i <= wi1; i += step) {
      const t = j * S.W + i;
      if (!natWaterTile(t)) continue;
      for (let n = 0; n < 2; n++) {
        const h = hash2(i * 3 + n, j, seed + 4091), ph = still ? h : (T * (0.35 + 0.3 * h) + h * 7) % 1;
        const fl = still ? (h < 0.1 ? 0.6 : 0) : Math.max(0, 1 - Math.abs(ph - 0.5) * 9); // (a flash a ninth of its cycle long)
        if (fl <= 0) continue;
        const x = ox + (i + 0.15 + 0.7 * hash2(j, i * 3 + n, seed + 4092)) * z, y = oy + (j + 0.15 + 0.7 * hash2(i, j * 3 + n, seed + 4093)) * z;
        const zone = 0.45 + 0.55 * clamp(1.15 - (y / R.h) * 1.3 - (x / R.w) * 0.4, 0, 1); // (toward the sun, up the view)
        if (hash2(i, j * 7 + n, seed + 4094) > zone * 0.75) continue;
        const s = r * (1 + fl * 1.4), th = Math.max(0.6, s * 0.28);
        (fl > 0.7 ? Q : P).rect(x - s * 1.6, y - th / 2, s * 3.2, th); // (a fleck of light along a ripple)
        if (fl > 0.96 && z >= 20) Q.rect(x - th / 2, y - s * 0.9, th, s * 1.8);
      }
    }
    ctx.fillStyle = `rgba(${warm},${0.32 * sun})`; ctx.fill(P); // (toned down a touch: the owner, Nov 21)
    ctx.fillStyle = `rgba(${warm},${0.55 * sun})`; ctx.fill(Q);
  }
  // Night: the Ring's band and Argos mirrored on the water (fixed on the view, as a reflection is), shimmering.
  if (night > 0.05 && sky) {
    const Rg = natRing(), k = 1 / 4, bw = Math.max(1, Math.ceil(R.w * k)), bh = Math.max(1, Math.ceil(R.h * k));
    const g = natBuffer('buf', bw, bh);
    // the band: a long, broken streak of glitter across the view, as the Ring's arc lies on rippling water
    const by = Rg.bandY * bh, slope = Rg.band, fl = ambPuff(), fw = Math.max(2, bw / 46);
    g.fillStyle = `rgb(${Rg.rgb})`;
    for (let n = 0; n <= 60; n++) {
      const f = n / 60, x = f * bw, y = by + slope * (f - 0.5) * bw + bh * 0.06 * (1 - (2 * f - 1) ** 2) + (hash2(n, 2, seed + 4105) - 0.5) * bh * 0.03;
      const tw = still ? 0.6 : 0.5 + 0.5 * Math.sin(T * (1.1 + hash2(n, 3, seed)) + n * 1.7);
      g.globalAlpha = 0.55 * clear * tw;
      g.drawImage(fl, x - fw, y - fw * 0.18, fw * 2, fw * 0.36);
    }
    // Argos: a soft glow and a broken column of light below it, each fleck a soft streak along the ripples
    const mx = Rg.moonX * bw, my = Rg.moonY * bh, mr = Math.max(1.5, 0.016 * Math.min(bw, bh) * 2), puff = ambPuff();
    g.globalAlpha = 0.55 * clear;
    g.drawImage(puff, mx - mr * 2.2, my - mr * 1.4, mr * 4.4, mr * 2.8);
    for (let n = 0; n < 22; n++) {
      const yy = my + mr * 0.9 + n * mr * 0.5, wob = still ? 0 : Math.sin(T * 1.7 + n * 1.3) * mr * 0.45;
      const tw = still ? 0.7 : 0.55 + 0.45 * Math.sin(T * 2.3 + n * 2.1);
      g.globalAlpha = clamp(0.75 - n * 0.032, 0, 1) * clear * tw;
      const w = mr * (1.5 - n * 0.035) * (0.6 + 0.4 * hash2(n, 1, seed));
      g.drawImage(puff, mx - w + wob, yy - mr * 0.22, w * 2, mr * 0.44);
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'destination-in';
    g.imageSmoothingEnabled = true;
    g.drawImage(mask, ox * k, oy * k, S.W * z * k, S.H * z * k);
    ctx.globalAlpha = 0.42 * night;
    ctx.imageSmoothingEnabled = true;
    const qx0 = clamp(Math.floor((ox + wi0 * z) * k), 0, bw), qy0 = clamp(Math.floor((oy + wj0 * z) * k), 0, bh);
    const qx1 = clamp(Math.ceil((ox + (wi1 + 1) * z) * k), 0, bw), qy1 = clamp(Math.ceil((oy + (wj1 + 1) * z) * k), 0, bh);
    if (qx1 > qx0 && qy1 > qy0) ctx.drawImage(NAT.buf, qx0, qy0, qx1 - qx0, qy1 - qy0, qx0 / k, qy0 / k, (qx1 - qx0) / k, (qy1 - qy0) / k); // (only where there's water)
    ctx.globalAlpha = 1;
    // stars on a clear night, twinkling slowly
    if (clear > 0.3 && z >= 6 && night > 0.5) { // (once it's properly dark)
      const P = new Path2D(), sr = Math.max(0.7, z * 0.025);
      for (let j = wj0 - (wj0 % step); j <= wj1; j += step) for (let i = wi0 - (wi0 % step); i <= wi1; i += step) {
        const t = j * S.W + i;
        if (!natWaterTile(t) || hash2(i, j, seed + 4101) > 0.22) continue;
        const tw = still ? 0.7 : 0.5 + 0.5 * Math.sin(T * (0.8 + hash2(j, i, seed + 4102)) + i * 3.1 + j);
        if (tw < 0.35) continue;
        const x = ox + (i + hash2(j, i, seed + 4103)) * z, y = oy + (j + hash2(i, j, seed + 4104)) * z, s = sr * (0.6 + tw * 0.8);
        P.rect(x - s / 2, y - s / 2, s, s);
      }
      ctx.fillStyle = `rgba(230,236,255,${0.55 * night * clear})`; ctx.fill(P);
    }
  }
  ctx.restore();
  if (!still && z >= 12 && biome() !== 'polar') natShores(ctx, ox, oy, z, i0, i1, j0, j1, T, night);
}

/** Small waves lapping along the shores: a line of foam that runs up the beach and slides back, a little apart on each tile. */
function natShores(ctx, ox, oy, z, i0, i1, j0, j1, T, night) {
  const land = (i, j) => inMap(i, j) && S.terrain[j * S.W + i] !== T_WATER;
  const buckets = [new Path2D(), new Path2D(), new Path2D()];
  let n = 0;
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const t = j * S.W + i;
    if (!natWaterTile(t) || S.road[t]) continue;
    for (const [dx, dy] of ARM_DIRS) {
      if (!land(i + dx, j + dy)) continue;
      const ph = (T * 0.32 + (i * 0.37 + j * 0.53) + dx * 0.21 + dy * 0.13) % 1;
      const run = Math.sin(ph * Math.PI); // (up the beach and back)
      const off = 0.04 + 0.16 * (1 - run), b = run > 0.66 ? 0 : run > 0.33 ? 1 : 2;
      // the edge shared with the land, set back into the water by `off`
      // (along the edge; cut short where the shore turns a corner, which the ground rounds off)
      const ax = dy ? 1 : 0, ay = dx ? 1 : 0, l0 = land(i - ax, j - ay) ? 0.16 : 0.48, l1 = land(i + ax, j + ay) ? 0.16 : 0.48;
      const cx = i + 0.5 + dx * (0.5 - off), cy = j + 0.5 + dy * (0.5 - off);
      const P = buckets[b];
      P.moveTo(ox + (cx - ax * l0) * z, oy + (cy - ay * l0) * z);
      P.quadraticCurveTo(ox + (cx + ax * (l1 - l0) / 2 - dx * 0.06) * z, oy + (cy + ay * (l1 - l0) / 2 - dy * 0.06) * z, ox + (cx + ax * l1) * z, oy + (cy + ay * l1) * z);
      n++;
    }
  }
  if (!n) return;
  ctx.save();
  ctx.lineCap = 'round';
  const c = night > 0.5 ? '170,196,214' : '246,252,248', dim = 1 - 0.55 * night;
  [0.7, 0.42, 0.18].forEach((a, b) => {
    ctx.strokeStyle = `rgba(${c},${a * 0.35 * dim})`; ctx.lineWidth = Math.max(2, z * 0.16); ctx.stroke(buckets[b]); // (the foam's soft spread)
    ctx.strokeStyle = `rgba(${c},${a * dim})`; ctx.lineWidth = Math.max(1, z * 0.045); ctx.stroke(buckets[b]);
  });
  ctx.restore();
}

/* ------------------------------------------------------------------ the planet view */

/** The haze colour of the land here ('r,g,b'). */
function natHaze() { return NATFX.haze[biome()] || NATFX.haze.desert; }

/**
 * Beyond the map's edges (called by drawOffMap): the land carries on, unplayable and faded: the map's own ground mirrored
 * at each edge, sinking into the biome's haze, thicker the further out. Returns true once drawn.
 */
function natureOffMap(ctx, ox, oy, z) {
  if (!S || !R.map) return false;
  const mw = S.W * z, mh = S.H * z;
  const haze = natHaze();
  ctx.save();
  // (the haze itself where even the mirrored copies don't reach: a screen more than three maps wide)
  if (ox - mw > 0 || oy - mh > 0 || ox + 2 * mw < R.w || oy + 2 * mh < R.h) { ctx.fillStyle = `rgb(${haze})`; ctx.fillRect(0, 0, R.w, R.h); }
  ctx.imageSmoothingEnabled = true;
  // The eight mirrored copies round the map (those that show).
  for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) {
    if (!a && !b) continue;
    const x = ox + a * mw, y = oy + b * mh;
    if (x > R.w || y > R.h || x + mw < 0 || y + mh < 0) continue;
    ctx.setTransform(R.dpr * (a ? -1 : 1), 0, 0, R.dpr * (b ? -1 : 1), R.dpr * (a ? x + mw : x), R.dpr * (b ? y + mh : y));
    ctx.drawImage(R.map, 0, 0, mw, mh);
  }
  ctx.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
  // Faded into the haze, thickening outward from the edge (the side bands run the screen's height, the top and bottom
  // its width: where they cross, in the corners, furthest out, it's thickest).
  const D = Math.max(6 * z, Math.min(mw, mh) * 0.42);
  const band = (x0, y0, x1, y1, rx, ry, rw, rh) => {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, `rgba(${haze},0.3)`); g.addColorStop(0.55, `rgba(${haze},0.66)`); g.addColorStop(1, `rgba(${haze},0.95)`);
    ctx.fillStyle = g; ctx.fillRect(rx, ry, rw, rh);
  };
  if (ox > 0) band(ox, 0, ox - D, 0, 0, 0, ox, R.h);
  if (ox + mw < R.w) band(ox + mw, 0, ox + mw + D, 0, ox + mw, 0, R.w - ox - mw, R.h);
  if (oy > 0) band(0, oy, 0, oy - D, 0, 0, R.w, oy);
  if (oy + mh < R.h) band(0, oy + mh, 0, oy + mh + D, 0, oy + mh, R.w, R.h - oy - mh);
  // A soft shadow along the edge marks where the land you can use ends.
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = Math.max(2, z * 0.14);
  ctx.strokeRect(ox - ctx.lineWidth / 2, oy - ctx.lineWidth / 2, mw + ctx.lineWidth, mh + ctx.lineWidth);
  ctx.restore();
  return true;
}

/**
 * How far the camera is tilted at zoom z (0 up close; up to NATFX.tilt.most zoomed right out). A pure function of the
 * zoom, so screenToWorld and worldToScreen agree with the frame drawn. None on Saver, nor behind the menu.
 */
function natureTiltAt(z) {
  if (!S || !R.w || natSaver() || typeof UI === 'undefined' || !UI.inGame) return 0;
  const lo = minZoom(), hi = lo * NATFX.tilt.from;
  if (z >= hi) return 0;
  const f = clamp(Math.log(hi / z) / Math.log(hi / lo), 0, 1);
  return NATFX.tilt.most * f * f * (3 - 2 * f);
}

/** A point of the flat frame (css px) where it shows on the tilted screen. */
function natureWarpPt(x, y) {
  const a = natureTiltAt(R.cam.z);
  if (!a) return { x, y };
  const t = y / R.h, d = 1 - a * t;
  return { x: R.w / 2 + (x - R.w / 2) / d, y: (R.h * t * (1 - a)) / d };
}

/** A point on the tilted screen (css px) back in the flat frame. */
function natureUnwarp(x, y) {
  const a = natureTiltAt(R.cam.z);
  if (!a) return { x, y };
  const q = y / (R.h * (1 - a)), t = q / (1 + a * q), d = 1 - a * t;
  return { x: R.w / 2 + (x - R.w / 2) * d, y: t * R.h };
}

/**
 * Over the finished frame, zoomed far out: the camera's tilt (the frame redrawn in strips, each row as wide as its
 * distance makes it) and a gentle depth haze, thicker toward the far (top) side, with a few stars through it at night.
 */
function natureView(ctx, ox, oy, z) {
  if (!S || !S.settings) return;
  const a = natureTiltAt(z), N = natState();
  if (!a) {
    if (N.warp && N.warp.width && ++N.warpIdle > 120) N.warp.width = N.warp.height = 0; // (let the copy go a while after)
    return;
  }
  N.warpIdle = 0;
  const c = R.canvas, W = c.width, H = c.height;
  const w = N.warp || (N.warp = document.createElement('canvas'));
  if (w.width !== W || w.height !== H) { w.width = W; w.height = H; }
  const wg = w.getContext('2d');
  wg.globalCompositeOperation = 'copy';
  wg.drawImage(c, 0, 0);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.imageSmoothingEnabled = true;
  const n = clamp(Math.round(H / 10), 40, 160), cx = W / 2;
  const inv = (Y) => { const q = Y / (H * (1 - a)), t = q / (1 + a * q); return t * H; };
  let sy0 = inv(0);
  for (let s = 0; s < n; s++) {
    const Y0 = Math.floor((s * H) / n), Y1 = Math.floor(((s + 1) * H) / n), sy1 = inv(Y1);
    const tm = (sy0 + sy1) / 2 / H, sc = 1 / (1 - a * tm);
    ctx.drawImage(w, 0, sy0, W, Math.max(0.5, sy1 - sy0), cx - cx * sc, Y0, W * sc, Y1 - Y0 + 1);
    sy0 = sy1;
  }
  ctx.restore();
  // The depth haze: the far side a little lost in the air.
  const f = a / NATFX.tilt.most, night = fxNight(), haze = natHaze();
  const dark = (v) => Math.round(v * (1 - 0.82 * night));
  const rgb = haze.split(',').map((v) => dark(+v)).join(',');
  const g = ctx.createLinearGradient(0, 0, 0, R.h * 0.62);
  g.addColorStop(0, `rgba(${rgb},${0.34 * f})`); g.addColorStop(0.5, `rgba(${rgb},${0.1 * f})`); g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.save();
  ctx.fillStyle = g; ctx.fillRect(0, 0, R.w, R.h * 0.62);
  // a few stars through the thin air at the far edge, on a clear night
  if (night > 0.3 && natSky() && natClear() > 0.3) {
    const T = natClock(), seed = S.seed | 0, P = new Path2D();
    for (let k = 0; k < 70; k++) {
      const x = hash2(k, 1, seed + 4111) * R.w, y = Math.pow(hash2(k, 2, seed + 4111), 1.8) * R.h * 0.2;
      const tw = 0.5 + 0.5 * Math.sin(T * (0.6 + hash2(k, 3, seed)) + k);
      const s = 0.6 + 1.1 * hash2(k, 4, seed + 4111) * tw;
      P.rect(x - s / 2, y - s / 2, s, s);
    }
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(230,236,255,${0.5 * f * night * natClear()})`;
    ctx.fill(P);
  }
  ctx.restore();
}

/** The game time the clouds' drift is read at: held where it was under reduced motion (no drifting). */
function natureCloudTime() {
  if (!natStill()) { NAT.cloudT = null; return S.time; }
  if (NAT.cloudT == null || NAT.cloudOf !== S) { NAT.cloudT = S.time; NAT.cloudOf = S; }
  return NAT.cloudT;
}

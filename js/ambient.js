'use strict';
/*
 * Ithaca I going on without its people: three touches, for looks only. Nothing here changes the game, S, saves or
 * orders. What it keeps is display-only (R.amb), and it reads only the game's clock, seed, buildings and effects.
 *
 * - Cloud shadows (drawCloudShadows): by day, soft shadows of clouds drift over the land with the wind, thicker and
 *   darker while a spell of weather is on, fading out toward night. They come from the planet's seed and the game
 *   clock, as the weather does (weatherAt), so every device sees the same sky. None on Argos (no air) or in the Hollow
 *   (underground), none with Weather switched off, and none on Graphics Saver.
 * - Remains (drawRemains): what a fight leaves behind outlasts the game's own marks (a building's rubble and burn, a
 *   robot's wreck, a plane come down), and over the minutes that follow it is taken back, by biome: grass, moss and
 *   vines in the green biomes, drifting snow in Hoarfell, sand in the Rust, ash in the Cinderlands, violet Bloom growth
 *   in the Bloom and the Hollow, only dust on Argos. They are found in the game's effects as they happen (a building's
 *   collapse with its fire, a wreck's fire) and kept in R: they don't outlive a save and load. They never stand in the
 *   way of anything, and go the moment a building or site, a road or track takes their tile.
 * - Beacons (drawBeacons): from evening until dawn every standing, finished Command Base, whoever holds it, shines a
 *   pale beam of light straight up into the sky, a hint of its owner's colour in it, with a soft halo at its foot and a
 *   slow pulse. It follows the time of day as shown (never in Always day, always in Always night and in the Hollow,
 *   where it shines up the breach). Your own base hums softly as its beacon comes on, if it's in view.
 *
 * Cost scales with the Graphics step (gfxStep): Saver has no cloud shadows and plainer remains; Ultra makes the clouds
 * at a finer scale and the remains a little richer. Zoomed far out the remains are drawn simpler.
 */

const AMB = {
  // Cloud shadows. cell: tiles of sky per cloud; cover: the share of cells with a cloud (more by `coverWx` in a spell of
  // weather); alpha: how dark a shadow is (darker by `alphaWx`); speed: tiles a second the wind carries them (`speedWx`
  // in a stretch with a spell of weather); turn: seconds either side of a stretch's start over which the wind veers.
  cloud: { cell: 14, cover: 0.42, coverWx: 0.45, alpha: 0.2, alphaWx: 0.16, speed: 0.3, speedWx: 0.6, turn: 25, tint: '14,20,34' },
  // How much each kind of weather thickens the sky (dust devils and the aurora come under clear skies).
  thick: { rain: 1, snow: 1, fog: 0.9, ash: 0.9, sand: 0.75, leaves: 0.6, dust: 0.3, aurora: 0.3, meteors: 0 },
  // The light at each time of day: the clouds' shadows (none at night), the beacons (from evening until dawn).
  sun: { morning: 0.65, day: 1, evening: 0.35, night: 0 },
  beam: { morning: 0, day: 0, evening: 0.85, night: 1 },
  // Remains: seconds after it was left when the growth starts and when it's full, how long it then stays and when it
  // has gone back into the ground. b: a building, u: a robot or vehicle, p: a plane come down. (max: kept at once.)
  ruin: { max: 400, b: [60, 480, 1200, 1500], u: [30, 300, 720, 900], p: [40, 360, 900, 1100] },
  pulse: 5.5, // seconds a beacon takes to swell and ease back
};

/*
 * What grows over the remains in each biome (colours as by day: graded for the light, see todColor).
 */
const AMB_GROW = {
  jungle: { kind: 'green', moss: '#5f8a34', dark: '#33521f', grass: '#77a03e', vine: '#2a481b', n: 1.2 },
  swamp: { kind: 'green', moss: '#5c6a2e', dark: '#313c1a', grass: '#75823c', vine: '#28351a', n: 1.1 },
  autumn: { kind: 'green', moss: '#6c6c2c', dark: '#42421a', grass: '#9c8a3c', vine: '#4c3c1c', leaves: ['#c0602a', '#d29632', '#9c3e28'], n: 1 },
  savanna: { kind: 'green', moss: '#8a8442', dark: '#5f5a2e', grass: '#c4ab5c', vine: '#6c6834', n: 0.8, tall: 1.6 },
  polar: { kind: 'snow', fill: '#e8eef5', shade: '#a9b9cc', hi: '#fbfdff' },
  desert: { kind: 'sand', fill: '#d8a873', shade: '#a8714a', hi: '#efc895' },
  volcanic: { kind: 'ash', fill: '#8b8d8e', shade: '#363839', hi: '#a9abac' },
  alien: { kind: 'bloom', ground: '#5d4389', vein: '#a066ee', node: '#cfa3ff', crystal: '#efe2ff', glow: '#b070ff' },
  hollow: { kind: 'bloom', ground: '#463463', vein: '#8a52d6', node: '#c093ff', crystal: '#e2d4ff', glow: '#a464ff', dust: '#6e6678' },
  lunar: { kind: 'dust', fill: '#a2a4a9', shade: '#6c6e73', slow: 1.6 },
};

/** This game's display-only state for the three touches (made afresh for each game, and for each load). */
function ambState() {
  let A = R.amb;
  if (!A || A.of !== S) {
    if (A) for (const e of A.ruins) ambDrop(A, e); // (the last game's pictures)
    A = R.amb = { of: S, ruins: [], tick: S ? S.tick : 0, seen: new WeakSet(), prevBots: null, beacons: new Map(), humAt: -99, px: 0, buf: A && A.buf };
  }
  return A;
}

/** A weight for the light now: w[time of day], blended over the crossfades (TOD.state, worked out each frame). */
function ambLight(w) {
  const st = typeof TOD !== 'undefined' && TOD.state;
  if (!st) return w.day;
  return w[st.a] * (1 - st.f) + w[st.b] * st.f;
}

/** g (0..1) eased in from `start` over `len`. */
function ambStep(g, start, len) { const x = clamp((g - start) / len, 0, 1); return x * x * (3 - 2 * x); }

/* ------------------------------------------------------------------ cloud shadows */

/**
 * The wind in stretch n of the weather's clock (WEATHER.slot seconds): the way a spell in that stretch blows (as
 * weatherAt's dir, so the clouds go with the rain and fog), a little north or south, and stronger in a stretch with a spell.
 */
function ambWind(n) {
  const seed = (S.seed || 1) | 0, C = AMB.cloud;
  const spell = n >= 1 && !!WEATHER.kinds[biome()] && hash2(seed, n, 71) < WEATHER.chance;
  const v = spell ? C.speedWx : C.speed, dir = hash2(seed, n, 75) < 0.5 ? 1 : -1;
  return { x: dir * v, y: v * (hash2(seed, n, 611) - 0.5) * 0.7 };
}

/**
 * How far the wind has carried the sky by game time t (tiles): the sum of each stretch's wind, the wind veering
 * smoothly from one stretch's to the next over AMB.cloud.turn seconds either side of where they meet.
 */
function ambDrift(t) {
  const L = WEATHER.slot, w = AMB.cloud.turn, n = Math.max(0, Math.floor(t / L));
  let x = 0, y = 0;
  for (let k = 0; k < n; k++) { const v = ambWind(k); x += v.x * L; y += v.y * L; }
  const v = ambWind(n), dt = t - n * L;
  x += v.x * dt; y += v.y * dt;
  // Near a meeting B: the speed blended over B - w .. B + w, less the sudden change counted above.
  let a = null, b = null, s = 0;
  if (dt < w && n > 0) { a = ambWind(n - 1); b = v; s = dt + w; } else if (L - dt < w) { a = v; b = ambWind(n + 1); s = dt - (L - w); }
  if (a) {
    const fix = (pa, pb) => pa * s + ((pb - pa) * s * s) / (4 * w) - (pa * Math.min(s, w) + pb * Math.max(0, s - w));
    x += fix(a.x, b.x); y += fix(a.y, b.y);
  }
  return { x, y };
}

/** A soft round puff (white, its alpha falling off to the edge), for the clouds. */
function ambPuff() {
  if (R.ambPuff) return R.ambPuff;
  const n = 64, c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d'), gr = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.85)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, n, n);
  return (R.ambPuff = c);
}

/** How heavy the weather is now for the sky (0..1): a spell of weather, or a planet event's dust storm. */
function ambWeather() {
  const W = weatherAt(S.time);
  let k = W ? W.k * (AMB.thick[W.kind] ?? 0.6) : 0;
  const E = S.event;
  if (E && E.type === 'dust') k = Math.max(k, clamp(Math.min((S.time - E.t0) / 4, (E.t1 - S.time) / 4), 0, 1));
  return k;
}

/**
 * The clouds' shadows over everything on the ground. Made in a small buffer (an eighth of the screen's size, a quarter
 * on Ultra), each cloud a cluster of soft puffs, then laid over the view in one draw, darkening it a little.
 */
function drawCloudShadows(ctx, ox, oy, z) {
  if (!WX_ON || gfxStep() === 'saver' || S.hollow || biome() === 'lunar' || biome() === 'hollow') return;
  const sun = ambLight(AMB.sun);
  if (sun < 0.01) return;
  const C = AMB.cloud, wx = ambWeather(), cover = C.cover + C.coverWx * wx, seed = (S.seed || 1) | 0;
  const k = gfxStep() === 'ultra' ? 1 / 4 : 1 / 8, bw = Math.max(1, Math.ceil(R.w * k)), bh = Math.max(1, Math.ceil(R.h * k));
  const A = ambState();
  const buf = A.buf || (A.buf = document.createElement('canvas'));
  if (buf.width !== bw || buf.height !== bh) { buf.width = bw; buf.height = bh; }
  const g = buf.getContext('2d');
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, bw, bh);
  const off = ambDrift(S.time), cell = C.cell, puff = ambPuff(), more = gfxStep() === 'ultra' ? 2 : 1;
  // The cells in view, in the sky's own frame (the ground's, less how far the wind has carried it).
  const x0 = -ox / z - off.x, x1 = (R.w - ox) / z - off.x, y0 = -oy / z - off.y, y1 = (R.h - oy) / z - off.y;
  let any = false;
  for (let cj = Math.floor(y0 / cell) - 1; cj <= Math.floor(y1 / cell) + 1; cj++) {
    for (let ci = Math.floor(x0 / cell) - 1; ci <= Math.floor(x1 / cell) + 1; ci++) {
      // Each cell's rank against the cover: more weather, more of them in, each fading in rather than popping.
      const a = clamp((cover - hash2(ci, cj, seed + 601)) / 0.12, 0, 1);
      if (a <= 0) continue;
      any = true;
      g.globalAlpha = a;
      const cx = (ci + 0.25 + 0.5 * hash2(ci, cj, seed + 602)) * cell + off.x, cy = (cj + 0.25 + 0.5 * hash2(ci, cj, seed + 603)) * cell + off.y;
      const n = 3 + Math.floor(hash2(ci, cj, seed + 604) * 3) + more;
      for (let p = 0; p < n; p++) {
        const h1 = hash2(ci * 7 + p, cj, seed + 605), h2 = hash2(ci, cj * 7 + p, seed + 606), h3 = hash2(ci + p, cj - p, seed + 607);
        const r = cell * (0.16 + 0.17 * h3) * (1 + 0.08 * Math.sin(S.time * 0.05 + p + ci * 1.7 + cj)) * (1 + 0.2 * wx); // (slowly changing shape)
        const px = cx + (h1 - 0.5) * cell * 0.62, py = cy + (h2 - 0.5) * cell * 0.36;
        const sx = (ox + px * z) * k, sy = (oy + py * z) * k, rw = r * z * k * 1.35, rh = r * z * k;
        if (sx + rw < 0 || sx - rw > bw || sy + rh < 0 || sy - rh > bh) continue;
        g.drawImage(puff, sx - rw, sy - rh, rw * 2, rh * 2);
      }
    }
  }
  if (!any) return;
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = `rgb(${C.tint})`;
  g.fillRect(0, 0, bw, bh);
  ctx.save();
  ctx.globalAlpha = (C.alpha + C.alphaWx * wx) * sun;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(buf, 0, 0, bw / k, bh / k);
  ctx.restore();
}

/* ------------------------------------------------------------------ remains */

/**
 * Look through the effects added since the last frame for anything left behind: a building that collapsed burning
 * (its collapse, with its fire on the same step: taken down on purpose, it only drops its rubble, as ever), a robot's or
 * vehicle's wreck burning, a plane come down. (Effects are added in step order, so the look back stops at older ones.)
 */
function ambScan(A) {
  const fx = S.fx || [], from = A.tick - 1;
  for (let n = fx.length - 1; n >= 0; n--) {
    const f = fx[n];
    if (f.tick < from) break;
    if ((f.type !== 'collapse' && f.type !== 'fire') || A.seen.has(f)) continue;
    A.seen.add(f);
    if (f.type === 'collapse') ambFromBuilding(A, f, fx, n);
    else ambFromFire(A, f);
  }
  A.tick = S.tick;
  A.prevBots = S.bots; // (the step that tidies dead robots away makes a new list: this one still has them)
}

/** Can remains lie on tile t? Open ground with nothing on it (no road, track, building, lava or tide). */
function ambGround(t) {
  return S.terrain[t] === T_GROUND && !S.road[t] && !(S.rail && S.rail[t]) && !S.bAt[t] && !(S.lava && S.lava[t]) && !(S.tidal && S.tidal[t]);
}

function ambAdd(A, e) {
  const i = Math.floor(e.x), j = Math.floor(e.y);
  if (!inMap(i, j)) return;
  e.t = tIdx(i, j);
  if (!ambGround(e.t)) return;
  // One wreck to a tile: where robots fall on top of each other, the first pile stands for them all.
  if (e.k !== 'b') for (const o of A.ruins) if (o.t === e.t && o.k !== 'b') return;
  A.ruins.push(e);
  if (A.ruins.length > AMB.ruin.max) for (const o of A.ruins.splice(0, A.ruins.length - AMB.ruin.max)) ambDrop(A, o);
}

/** A building's collapse (collapseFx): if it burned, its rubble stays (the game's own rubble mark, carried on). */
function ambFromBuilding(A, f, fx, n) {
  const d = BDEFS[f.btype];
  if (!d || d.wild || d.viaduct) return; // (a Murmur nest is earth: nothing of it stays)
  let burn = false;
  for (let m = n + 1; m < Math.min(fx.length, n + 6) && !burn; m++) { const g = fx[m]; burn = g.type === 'fire' && g.tick === f.tick && g.x === f.x && Math.abs(g.y - f.y - 0.1) < 1e-6; }
  if (!burn) return;
  const x = f.x, y = f.y + 0.08, big = f.s || 1;
  // The rubble mark collapseFx left (addDecal): the same heap is drawn on once it fades (same seed, same size).
  let decal = null;
  const D = S.decals || [];
  for (let m = D.length - 1; m >= Math.max(0, D.length - 60); m--) { const e = D[m]; if (e.kind === 'rubble' && e.x === x && e.y === y) { decal = e; break; } }
  const s = decal ? decal.s : Math.floor(hash2(Math.floor(x * 7), Math.floor(y * 7), f.tick) * 997);
  const t0 = decal ? decal.t0 : S.time - (S.tick - f.tick) * SIM_STEP;
  ambAdd(A, { k: 'b', x, y, t0, r: 0.55 * big, s, size: big * (d.barrier ? 0.7 : 1), owner: f.owner, decal, life: 90, burn: 70 });
}

/** A wreck's fire: a robot's or vehicle's (killBot), or a plane come down (landDrop). */
function ambFromFire(A, f) {
  if (f.life === 14 && f.r === 0.4) { // a plane shot down, where it hit the ground
    ambAdd(A, { k: 'p', x: f.x, y: f.y, t0: S.time - (S.tick - f.tick) * SIM_STEP, r: 0.55, s: (f.seed * 131 + f.tick) % 997, size: 1.6, owner: -1, decal: null, life: 90, burn: 90 });
    return;
  }
  if (!((f.life === 5 || f.life === 9) && (f.r === 0.18 || f.r === 0.3))) return; // (the rest burn for other reasons)
  const u = ambDeadBot(A, f);
  if (!u) return;
  const bt = BOTS[u.type];
  if (!bt || bt.wild || bt.sea || bt.air) return; // (the Murmur take their dead with them; a ship sinks)
  const size = bt.truck || bt.crawler || bt.rail ? 1.35 : bt.army ? 1 : 0.8;
  ambAdd(A, { k: 'u', x: f.x, y: f.y, t0: S.time - (S.tick - f.tick) * SIM_STEP, r: 0.32 * size, s: (u.id * 7 + f.tick) % 997, size, owner: u.owner, decal: null, life: 35, burn: 35 });
}

/** The robot whose wreck fire f is (killBot lights it where it fell, seeded with its id), or null. */
function ambDeadBot(A, f) {
  for (const list of [S.bots, A.prevBots]) {
    if (!list) continue;
    for (let n = list.length - 1; n >= 0; n--) { const u = list[n]; if (u.dead && u.x === f.x && u.y === f.y && u.id % 97 === f.seed) return u; }
  }
  return null;
}

/*
 * The painter: everything of the remains in view is gathered into one path per layer and strength (eight steps of
 * opacity), and each is filled or stroked once, layer by layer, so a battlefield's worth costs a few dozen draws.
 */
function ambPainter(defs) {
  const P = { list: [], by: {} };
  for (const [name, style, w, add] of defs) { const L = { style, w, add, paths: [] }; P.by[name] = L; P.list.push(L); }
  return P;
}
function ambPath(L, a) { const q = a >= 0.97 ? 8 : Math.round(a * 8); return q > 0 && L ? L.paths[q] || (L.paths[q] = new Path2D()) : null; }
function ambEll(L, a, x, y, rx, ry) { const p = rx > 0.15 && ambPath(L, a); if (p) { p.moveTo(x + rx, y); p.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); } }
function ambPoly(L, a, pts) { const p = ambPath(L, a); if (!p) return; p.moveTo(pts[0], pts[1]); for (let k = 2; k < pts.length; k += 2) p.lineTo(pts[k], pts[k + 1]); p.closePath(); }
function ambLine(L, a, x0, y0, x1, y1) { const p = ambPath(L, a); if (p) { p.moveTo(x0, y0); p.lineTo(x1, y1); } }
function ambCurve(L, a, x0, y0, cx, cy, x1, y1) { const p = ambPath(L, a); if (p) { p.moveTo(x0, y0); p.quadraticCurveTo(cx, cy, x1, y1); } }
function ambPaint(ctx, P) {
  ctx.save();
  ctx.lineCap = 'round';
  for (const L of P.list) {
    if (!L.paths.length) continue;
    ctx.globalCompositeOperation = L.add ? 'lighter' : 'source-over';
    if (L.w) { ctx.strokeStyle = L.style; ctx.lineWidth = L.w; } else ctx.fillStyle = L.style;
    for (let q = 1; q <= 8; q++) {
      const p = L.paths[q];
      if (!p) continue;
      ctx.globalAlpha = q / 8;
      if (L.w) ctx.stroke(p); else ctx.fill(p);
    }
  }
  ctx.restore();
}

/** A chunk of rubble or wreckage: a four-sided piece `cs` across at (x, y), turned by `a` (as the game's rubble mark draws it). */
function ambChunk(L, al, x, y, cs, a) {
  const c = Math.cos(a), s = Math.sin(a), pt = (u, v) => [x + u * c - v * s, y + u * s + v * c];
  ambPoly(L, al, [...pt(-cs, -cs * 0.4), ...pt(cs * 0.6, -cs * 0.7), ...pt(cs, cs * 0.3), ...pt(-cs * 0.4, cs * 0.6)]);
}

/**
 * The remains on the ground, after the game's own marks (drawDecals). Each frame: anything new is picked up, anything
 * built over, paved over or gone back into the ground is let go, and what's in view is drawn: its burn (a shared soft
 * smudge), then the remains themselves from a small picture of each (ambSprite), made again only when its growth moves on
 * a step, the zoom needs another size, the wind turns, or the light passes to another time of day (two are blended
 * across the change, as the game's own art is: drawArt). A few are made each frame at most; until then the last one stands in.
 */
function drawRemains(ctx, ox, oy, z, inView) {
  if (!S || !S.fx || !S.terrain) return;
  const A = ambState();
  ambScan(A);
  if (!A.ruins.length) return;
  const now = S.time, G = AMB_GROW[biome()] || AMB_GROW.desert, slow = G.slow || 1;
  // Built, paved or laid over (a site, a road, track), or gone back into the ground: let go.
  let w = 0;
  for (const e of A.ruins) { if (now - e.t0 < AMB.ruin[e.k][3] * slow && ambGround(e.t)) A.ruins[w++] = e; else ambDrop(A, e); }
  A.ruins.length = w;
  const shown = [];
  for (const e of A.ruins) { if (inView(e.x, e.y, 2)) shown.push(e); else if (e.spr && R.time - e.seen > 20) ambDrop(A, e); }
  if (!shown.length) return;
  // The game's rubble marks still being drawn (the remains take over as each fades).
  let alive = null;
  if (shown.some((e) => e.decal && now - e.t0 < e.life)) alive = new Set(S.decals || []);
  const st = TOD.active ? TOD.state : null, ka = st ? st.a : 'day', kb = st && st.f > 0.002 && st.b !== st.a ? st.b : null;
  const late = !!st && st.f >= 0.5, over = st ? (late ? 1 - st.f : st.f) : 0;
  const wind = ambWind(Math.floor(now / WEATHER.slot)).x > 0 ? 1 : -1;
  // The pictures' size: the zoom's (a step up), smaller when the view is crowded with them or they take a lot of memory.
  const most = shown.length > 120 || A.px > 12e6 ? 24 : shown.length > 50 ? 48 : 128;
  const res0 = [12, 24, 36, 48, 64, 96, 128].find((v) => v >= z * R.dpr * 0.9) || 128;
  const t0 = performance.now(), budget = gfxStep() === 'saver' ? 2 : 4, smudge = ambSmudges();
  const dots = [], glows = [];
  ctx.save();
  for (const e of shown) {
    const age = now - e.t0, T = AMB.ruin[e.k];
    const fade = 1 - clamp((age - T[2] * slow) / ((T[3] - T[2]) * slow), 0, 1);
    const g = ambStep(clamp((age - T[0] * slow) / ((T[1] - T[0]) * slow), 0, 1), 0, 1);
    const x = ox + e.x * z, y = oy + e.y * z;
    // The burn, softened, coming in as the game's scorch fades and going as things grow over it (once the game's own
    // marks have all gone, it's part of the picture).
    const burnt = age >= Math.max(e.life, e.burn), burn = burnt ? 0 : clamp((age - (e.burn - 10)) / 10, 0, 1) * (1 - 0.8 * g) * fade;
    if (burn > 0.01) {
      const bw = e.r * z * (e.k === 'b' ? 3 : 3.4);
      ctx.globalAlpha = burn * 0.55;
      ctx.drawImage(smudge[e.s % smudge.length], x - bw / 2, y - bw * 0.36, bw, bw * 0.72);
    }
    // The game's own mark fades out over its last ten seconds; these come in as it goes (at once if it's gone early).
    const own = e.decal && alive && alive.has(e.decal) ? clamp((age - (e.life - 10)) / 10, 0, 1) : e.k === 'b' ? 1 : clamp(age / 0.6, 0, 1);
    const al = own * fade;
    if (al < 0.01) continue;
    if (e.r * z < 3.5) { dots.push(e, al, g); continue; } // (too small to show more than a speck)
    e.seen = R.time;
    const gq = Math.round(g * 12), res = Math.min(most, res0, e.k === 'u' ? 64 : 128), fresh = age < 2;
    const pick = (name) => {
      const sp = e.spr && e.spr[name];
      if (sp && sp.gq === gq && sp.res === res && sp.wind === wind && sp.burnt === burnt) return sp;
      if (sp && !fresh && performance.now() - t0 > budget) return sp; // (out of time this frame: the last one stands in)
      return ambSprite(A, e, name, res, gq, G, wind, burnt);
    };
    const a = pick(ka), b = kb ? pick(kb) : null;
    if (e.spr) for (const name in e.spr) if (name !== ka && name !== kb) ambFree(A, e.spr[name]), delete e.spr[name];
    const put = (sp, k) => { const q = z / sp.res; ctx.globalAlpha = k; ctx.drawImage(sp.c, x - sp.cx * q, y - sp.cy * q, sp.c.width * q, sp.c.height * q); };
    if (b) { put(late ? b : a, al); if (over > 0.002) put(late ? a : b, al * over); } else put(a, al);
    if (a.nodes) glows.push(x, y, z / a.res, al, a.nodes);
  }
  ctx.restore();
  if (!dots.length && !(glows.length && TOD.active && TOD.state.lights > 0.05)) return;
  // The specks (zoomed far out), and after dark the Bloom's nodules glowing.
  const tint = G.kind === 'green' ? G.dark : G.kind === 'bloom' ? G.ground : G.fill;
  const P = ambPainter([['f2', todColor('#26272a')], ['tint', todColor(tint)], ['glow', G.glow || '#b070ff', 0, true]]);
  for (let n = 0; n < dots.length; n += 3) {
    const e = dots[n], al = dots[n + 1], g = dots[n + 2], x = ox + e.x * z, y = oy + e.y * z, r = Math.max(1.2, e.r * z);
    ambEll(P.by.f2, al * (1 - 0.6 * g), x, y, r * 0.8, r * 0.5);
    if (g > 0.05) ambEll(P.by.tint, al * 0.8 * g, x, y, r * 1.1 * g, r * 0.7 * g);
  }
  const night = TOD.active ? TOD.state.lights : 0;
  if (night > 0.05) for (let n = 0; n < glows.length; n += 5) {
    const x = glows[n], y = glows[n + 1], q = glows[n + 2], al = glows[n + 3], nodes = glows[n + 4];
    for (let k = 0; k < nodes.length; k += 3) {
      const nr = nodes[k + 2] * q * 3;
      ambEll(P.by.glow, al * night * (0.55 + 0.25 * Math.sin(R.time * 1.3 + k)), x + nodes[k] * q, y + nodes[k + 1] * q, nr, nr * 0.8);
    }
  }
  ambPaint(ctx, P);
}

/** The burns: three soft, ragged dark smudges, shared by all the remains (made once). */
function ambSmudges() {
  if (R.ambSmudge) return R.ambSmudge;
  R.ambSmudge = [0, 1, 2].map((v) => {
    const n = 96, c = document.createElement('canvas');
    c.width = c.height = n;
    const g = c.getContext('2d');
    for (let k = 0; k < 5; k++) {
      const x = n / 2 + (hash2(v, k, 771) - 0.5) * n * 0.35, y = n / 2 + (hash2(k, v, 772) - 0.5) * n * 0.3, r = n * (0.22 + 0.14 * hash2(v, k, 773));
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(22,15,10,0.55)'); gr.addColorStop(0.6, 'rgba(26,18,12,0.3)'); gr.addColorStop(1, 'rgba(30,20,12,0)');
      g.fillStyle = gr; g.fillRect(0, 0, n, n);
    }
    return c;
  });
  return R.ambSmudge;
}

/** A colour as it looks at time of day `name` (TOD_TIMES' grade, as todColor does for the light now), as 'rgb(...)'. */
function ambGrade(hex, name) {
  const T = TOD_TIMES[name] || TOD_TIMES.day, k = hex + name, C = R.ambGrades || (R.ambGrades = new Map());
  let c = C.get(k);
  if (!c) {
    const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    c = `rgb(${v.map((x, i) => Math.round(clamp(x * T.mul[i] + T.add[i], 0, 1) * 255)).join(',')})`;
    C.set(k, c);
  }
  return c;
}

/**
 * The picture of remains `e` at time of day `name`, `res` device pixels a tile and growth step gq (of 12): the heap or
 * wreckage and what has grown over it, in that time's light, kept on the remains (e.spr[name]) until it's needed otherwise.
 */
function ambSprite(A, e, name, res, gq, G, wind, burnt) {
  const old = e.spr && e.spr[name];
  // (as big as what's drawn can reach: wide for a drift's tail, less tall, as everything on the ground is seen at a slant)
  const R0 = e.r * (e.k === 'b' ? 1 : 1.6), nw = Math.max(4, Math.ceil(2 * R0 * (e.k === 'u' ? 1.75 : 2.05) * res)), nh = Math.max(4, Math.ceil(2 * R0 * (e.k === 'u' ? 1.2 : 1.35) * res));
  const c = old ? old.c : document.createElement('canvas');
  if (old) A.px -= c.width * c.height;
  if (c.width !== nw || c.height !== nh) { c.width = nw; c.height = nh; } else c.getContext('2d').clearRect(0, 0, nw, nh);
  A.px += nw * nh;
  const col = (h) => ambGrade(h, name), u = R.dpr || 1, cx = nw / 2, cy = nh * 0.55, r = e.r * res;
  const lod = { n: { saver: 0.5, auto: 1, high: 1, ultra: 1.4 }[gfxStep()] || 1, fine: res / u >= 14 };
  const lw = (k, least) => Math.max(least * u, res * k);
  const defs = [
    ['heap', 'rgba(40,32,26,0.45)'], ['c0', col('#5d5e60')], ['c1', col('#8a847a')], ['c2', col('#6b5646')], ['beam', 'rgba(40,40,44,0.8)', lw(0.025, 1)],
    ['f0', col('#34363b')], ['f1', col('#4d5157')], ['f2', col('#26272a')],
  ];
  if (e.owner >= 0 && PLAYER_COLORS[e.owner]) defs.push(['chip' + e.owner, col(PLAYER_COLORS[e.owner])]);
  if (G.kind === 'green') {
    defs.push(['dark', col(G.dark)], ['moss', col(G.moss)], ['vine', col(G.vine), lw(0.024, 1)], ['grass', col(G.grass), lw(0.016, 0.8)], ['blade', col(G.dark), lw(0.016, 0.8)]);
    if (G.leaves) G.leaves.forEach((h, k) => defs.push(['leaf' + k, col(h)]));
  } else if (G.kind === 'bloom') {
    if (G.dust) defs.push(['dust', col(G.dust)]);
    defs.push(['ground', col(G.ground)], ['vein', col(G.vein), lw(0.03, 1)], ['node', col(G.node)], ['crystal', col(G.crystal)]);
  } else {
    defs.push(['shade', col(G.shade)], ['fill', col(G.fill)], ['fill1', col(G.fill)], ['fill2', col(G.fill)]);
    if (G.hi) defs.push(['hi', col(G.hi)]);
    if (G.kind === 'sand') defs.push(['ripple', col(G.shade), lw(0.02, 1)]);
  }
  const P = ambPainter(defs), g = gq / 12, x = c.getContext('2d');
  if (burnt && g < 1) { // (the burn under it all, as drawRemains draws it while the game's own marks are still there)
    const bw = r * (e.k === 'b' ? 3 : 3.4);
    x.globalAlpha = 0.55 * (1 - 0.8 * g);
    x.drawImage(ambSmudges()[e.s % 3], cx - bw / 2, cy - bw * 0.36, bw, bw * 0.72);
    x.globalAlpha = 1;
  }
  ambBase(P, e, cx, cy, r, lod);
  const nodes = g > 0 ? ambGrowth(P, G, e, cx, cy, r, g * (G.kind === 'dust' ? 0.7 : 1), lod, wind) : null;
  ambPaint(x, P);
  // (the Bloom's nodules, for their glow after dark: where they are from the middle, and how big, in sprite pixels)
  const sp = { c, cx, cy, res, gq, wind, burnt, nodes: nodes && nodes.length ? nodes.map((v, k) => (k % 3 === 2 ? v : v - (k % 3 ? cy : cx))) : null };
  (e.spr || (e.spr = {}))[name] = sp;
  return sp;
}

/** Let a picture go at once (a phone has only so much canvas memory). */
function ambFree(A, sp) { if (sp && sp.c) { A.px -= sp.c.width * sp.c.height; sp.c.width = sp.c.height = 0; } }
/** Let all of remains e's pictures go. */
function ambDrop(A, e) { if (e.spr) { for (const k in e.spr) ambFree(A, e.spr[k]); e.spr = null; } }

/** What was left: a building's heap of rubble (the game's rubble mark, drawn on), or a robot's scattered wreckage. */
function ambBase(P, e, x, y, r, lod) {
  const by = P.by, s = e.s, al = 1;
  if (e.k === 'b') {
    // (as drawDecals draws the game's rubble: the same pieces from the same seed)
    ambEll(by.heap, al, x, y, r * 1.05, r * 0.6);
    const n = lod.fine ? 9 : 5;
    for (let k = 0; k < n; k++) {
      const a = (s + k * 61) * 0.71, rr = r * (0.15 + ((s + k * 13) % 9) / 11), cs = r * (0.16 + ((s + k) % 4) * 0.05);
      ambChunk(by['c' + (k % 3)], al, x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.55, cs, a);
    }
    if (lod.fine) for (let k = 0; k < 3; k++) { const a = (s + k * 41) * 0.9; ambLine(by.beam, al, x + Math.cos(a) * r * 0.2, y - r * 0.1, x + Math.cos(a) * r * 0.7, y - r * (0.25 + k * 0.08)); }
    return;
  }
  // A robot's, a vehicle's or a plane's wreckage: dark pieces scattered where it fell, one with a fleck of its colony's paint.
  const n = e.k === 'p' ? 7 : e.size > 1.2 ? 5 : 4;
  for (let k = 0; k < n; k++) {
    const an = hash2(s, k, 711) * Math.PI * 2, d = r * (0.05 + 0.85 * hash2(s, k, 712)) * (k ? 1 : 0.3), cs = r * (0.22 + 0.22 * hash2(s, k, 713)) * (e.k === 'p' && k < 2 ? 1.6 : 1);
    const px = x + Math.cos(an) * d, py = y + Math.sin(an) * d * 0.6, rot = hash2(k, s, 714) * Math.PI * 2;
    ambChunk(by['f' + (k % 3)], al, px, py, cs, rot);
    if (k === 0 && by['chip' + e.owner]) ambChunk(by['chip' + e.owner], al * 0.85, px, py - cs * 0.1, cs * 0.45, rot + 0.6);
  }
}

/**
 * The growth over remains `e` (screen x, y and radius r) at g (0..1), by biome. Each piece comes in at its own point of
 * g and grows from nothing, so the whole creeps over rather than appearing.
 */
function ambGrowth(P, G, e, x, y, r, g, lod, wind) {
  const fade = 1, by = P.by, s = e.s, big = e.k === 'b' ? 1 : e.k === 'p' ? 0.8 : 0.5, h = (k, salt) => hash2(s, k, salt);
  const R0 = r * (e.k === 'b' ? 1 : 1.6); // (a robot's wreck is small: its growth spreads round it a little)
  if (G.kind === 'green') {
    // Moss first, in small clumps at the foot of the rubble and on the ground round it (a darker underside, a lighter
    // top), then grass in tufts at its edges and among it, then vines over it.
    const M = Math.round(14 * big * G.n * lod.n) + 2;
    for (let k = 0; k < M; k++) {
      const q = ambStep(g, (k / M) * 0.6, 0.35);
      if (q <= 0) continue;
      const an = h(k, 701) * Math.PI * 2, d = R0 * (0.12 + 0.95 * Math.sqrt(h(k, 702))), rr = R0 * (0.09 + 0.1 * h(k, 703)) * q;
      const cx = x + Math.cos(an) * d, cy = y + Math.sin(an) * d * 0.6;
      ambEll(by.dark, fade, cx, cy + rr * 0.15, rr * 1.15, rr * 0.75);
      if (rr > 1.2) ambEll(by.moss, fade, cx - rr * 0.22, cy - rr * 0.12, rr * 0.75, rr * 0.48);
    }
    if (!lod.fine) return;
    const T = Math.round(12 * big * G.n * lod.n) + 1, tall = G.tall || 1;
    for (let k = 0; k < T; k++) {
      const q = ambStep(g, 0.15 + (k / T) * 0.55, 0.3);
      if (q <= 0) continue;
      const an = h(k, 704) * Math.PI * 2, d = R0 * (0.3 + 0.9 * h(k, 705)), bx = x + Math.cos(an) * d, by0 = y + Math.sin(an) * d * 0.6;
      for (let b = -1; b <= 2; b++) {
        const hh = R0 * (0.08 + 0.14 * h(k * 4 + b, 706)) * q * tall, lean = (b * 0.3 - 0.15 + (h(k, 707) - 0.5) * 0.5) * hh;
        ambLine(b & 1 ? by.grass : by.blade, fade, bx + b * R0 * 0.025, by0, bx + b * R0 * 0.025 + lean, by0 - hh);
      }
    }
    if (G.leaves) for (let k = 0; k < Math.round(9 * big * lod.n) + 1; k++) {
      const q = ambStep(g, 0.05 + k * 0.06, 0.2);
      if (q <= 0) continue;
      const an = h(k, 708) * Math.PI * 2, d = R0 * 1.15 * Math.sqrt(h(k, 709)), lr = Math.max(0.7, R0 * 0.05) * q;
      ambEll(by['leaf' + (k % G.leaves.length)], fade, x + Math.cos(an) * d, y + Math.sin(an) * d * 0.6, lr * 1.4, lr);
    }
    if (e.k === 'u') return;
    for (let k = 0; k < Math.round(3 * lod.n) + 1; k++) {
      const q = ambStep(g, 0.35 + k * 0.14, 0.4);
      if (q <= 0) continue;
      const an = h(k, 710) * Math.PI * 2, sx = x + Math.cos(an) * R0 * 1.05, sy = y + Math.sin(an) * R0 * 0.62;
      const ex = x - Math.cos(an + 0.5) * R0 * 0.5, ey = y - Math.sin(an + 0.5) * R0 * 0.35 - R0 * 0.15;
      const mx = sx + (ex - sx) * q, my = sy + (ey - sy) * q, cx = (sx + mx) / 2 + R0 * 0.2 * (h(k, 711) - 0.5), cy = (sy + my) / 2 - R0 * 0.25;
      ambCurve(by.vine, fade, sx, sy, cx, cy, mx, my);
      // its leaves, along it
      for (let n = 1; n <= 3; n++) {
        const f = (n / 4) * q, lx = (1 - f) * (1 - f) * sx + 2 * f * (1 - f) * cx + f * f * mx, ly = (1 - f) * (1 - f) * sy + 2 * f * (1 - f) * cy + f * f * my;
        ambEll(by.moss, fade, lx + (n & 1 ? 1 : -1) * R0 * 0.05, ly, R0 * 0.05, R0 * 0.032);
      }
    }
    return;
  }
  if (G.kind === 'bloom') {
    // The Bloom's root-veins creeping in from one side and branching over, nodules along them (glowing after dark), a
    // violet moss under it, crystal glints at the end; in the Hollow the ceiling's dust settles on it too.
    if (by.dust) ambEll(by.dust, fade * 0.45 * ambStep(g, 0, 0.6), x, y, R0 * 1.1, R0 * 0.66);
    const M = Math.round(5 * big * lod.n) + 1;
    for (let k = 0; k < M; k++) {
      const q = ambStep(g, 0.1 + (k / M) * 0.5, 0.4);
      if (q <= 0) continue;
      const an = h(k, 721) * Math.PI * 2, d = R0 * (0.15 + 0.8 * h(k, 722)), rr = R0 * (0.2 + 0.2 * h(k, 723)) * q;
      ambEll(by.ground, fade * 0.85, x + Math.cos(an) * d, y + Math.sin(an) * d * 0.6, rr, rr * 0.6);
    }
    const V = e.k === 'u' ? 1 : 2 + (lod.fine ? 1 : 0), nodes = [];
    for (let v = 0; v < V; v++) {
      const q = ambStep(g, v * 0.15, 0.6);
      if (q <= 0) continue;
      const a0 = h(v, 724) * Math.PI * 2;
      let px = x + Math.cos(a0) * R0 * 1.25, py = y + Math.sin(a0) * R0 * 0.75;
      const steps = 4, dx = (x - Math.cos(a0 + 0.4) * R0 * 0.7 - px) / steps, dy = (y - Math.sin(a0 + 0.4) * R0 * 0.45 - py) / steps;
      for (let st = 0; st < steps; st++) {
        const f = clamp(q * steps - st, 0, 1);
        if (f <= 0) break;
        const wob = (h(v * 9 + st, 725) - 0.5) * R0 * 0.35, nx = px + (dx + -dy * wob / R0) * f, ny = py + (dy + dx * wob / R0) * f;
        ambLine(by.vein, fade, px, py, nx, ny);
        if (st === 1 && f >= 1 && lod.fine) { const ba = a0 + (h(v, 726) < 0.5 ? 1.6 : -1.6); ambLine(by.vein, fade, nx, ny, nx + Math.cos(ba) * R0 * 0.35 * q, ny + Math.sin(ba) * R0 * 0.22 * q); }
        px = nx; py = ny;
        if (f >= 1) nodes.push(px, py);
      }
    }
    const nr = Math.max(0.9, R0 * 0.07), out = [];
    for (let n = 0; n < nodes.length; n += 2) { ambEll(by.node, fade, nodes[n], nodes[n + 1], nr, nr * 0.8); out.push(nodes[n], nodes[n + 1], nr); }
    if (g > 0.6 && lod.fine) for (let k = 0; k < 2 + (e.k === 'b' ? 1 : 0); k++) {
      const q = ambStep(g, 0.6 + k * 0.1, 0.25), an = h(k, 727) * Math.PI * 2, d = R0 * 0.6 * h(k, 728), cx = x + Math.cos(an) * d, cy = y + Math.sin(an) * d * 0.6, cs = R0 * 0.09 * q;
      if (cs > 0.4) ambPoly(by.crystal, fade, [cx, cy - cs * 1.8, cx + cs, cy, cx, cy + cs * 0.6, cx - cs, cy]);
    }
    return out;
  }
  if (G.kind === 'ash' || G.kind === 'dust') {
    // Settling evenly: a soft layer that thickens and spreads over the heap (thickest in the middle), grit in it.
    const q = ambStep(g, 0, 0.8), a = G.kind === 'ash' ? 0.34 : 0.24;
    ambSoft(by, fade * a, x, y - R0 * 0.05, R0 * (0.75 + 0.5 * q), R0 * (0.45 + 0.3 * q), s, q);
    if (by.hi) ambBlob(by.hi, fade * 0.35 * ambStep(g, 0.5, 0.4), x - R0 * 0.2, y - R0 * 0.18, R0 * 0.35, R0 * 0.16, s + 7);
    if (lod.fine) for (let k = 0; k < Math.round(10 * big * lod.n) + 1; k++) {
      const qq = ambStep(g, 0.2 + k * 0.03, 0.3);
      if (qq <= 0) continue;
      const an = h(k, 731) * Math.PI * 2, d = R0 * 1.15 * Math.sqrt(h(k, 732)), sr = Math.max(0.7, R0 * 0.03);
      ambEll(by.shade, fade * qq * 0.7, x + Math.cos(an) * d, y + Math.sin(an) * d * 0.6, sr, sr * 0.8);
    }
    return;
  }
  // Snow first dusting the rubble's tops, then drifting over it, banked up on the side the wind blows to (its lee edge
  // in shadow) with a tail trailing off downwind; or sand banking against it from the side the wind comes from, rippled.
  const side = G.kind === 'snow' ? wind : -wind, big2 = e.k === 'u' ? 0.75 : 1;
  if (G.kind === 'snow' && lod.fine) for (let k = 0; k < Math.round(7 * big * lod.n) + 1; k++) {
    const q = ambStep(g, k * 0.025, 0.2), an = h(k, 745) * Math.PI * 2, d = R0 * 0.8 * Math.sqrt(h(k, 746)), fr = R0 * (0.06 + 0.05 * h(k, 747)) * q;
    ambEll(by.hi, fade * 0.9, x + Math.cos(an) * d, y + Math.sin(an) * d * 0.55 - fr * 0.4, fr * 1.3, fr * 0.6);
  }
  const q = ambStep(g, 0.1, 0.75), cx = x + side * R0 * 0.12, rx = R0 * (0.55 + 0.6 * q) * big2 * (G.kind === 'sand' ? 1.25 : 1), ry = R0 * (0.32 + 0.33 * q) * big2;
  if (q > 0) {
    ambBlob(by.shade, fade * 0.38 * q, cx + side * rx * 0.25, y + ry * 0.35, rx * 0.9, ry * 0.75, s + 3); // the lee edge
    ambSoft(by, fade * (G.kind === 'snow' ? 0.42 : 0.36), cx, y, rx, ry, s, q);
    if (by.hi) ambBlob(by.hi, fade * 0.45 * q, cx - side * rx * 0.25, y - ry * 0.3, rx * 0.45, ry * 0.3, s + 5);
  }
  const tail = ambStep(g, 0.45, 0.45);
  if (tail > 0) { // the drift's tail, trailing off downwind (sand: its bank, upwind)
    ambBlob(by.shade, fade * 0.25 * tail, x + side * R0 * 1.05, y + R0 * 0.24, R0 * 0.8 * tail * big2, R0 * 0.2 * tail, s + 9);
    ambBlob(by.fill, fade * 0.5 * tail, x + side * R0 * 1.0, y + R0 * 0.16, R0 * 0.78 * tail * big2, R0 * 0.18 * tail, s + 11);
  }
  if (G.kind === 'sand' && lod.fine) for (let k = 0; k < 3; k++) {
    const qq = ambStep(g, 0.3 + k * 0.15, 0.35);
    if (qq <= 0) continue;
    const px = x + side * R0 * (1.35 + k * 0.3), py = y + R0 * (h(k, 744) - 0.5) * 0.5;
    ambCurve(by.ripple, fade * qq * 0.55, px, py - R0 * 0.32, px + side * R0 * 0.14, py, px, py + R0 * 0.32);
  }
}

/**
 * A soft, irregular patch of the painter's fill colour: three blobs stacked in their own layers (fill, fill1, fill2),
 * each smaller than the last, so it's thickest in the middle and thin at its ragged edge. q (0..1): how far it has come.
 */
function ambSoft(by, a, x, y, rx, ry, seed, q) {
  if (q <= 0) return;
  ambBlob(by.fill, a * q, x, y, rx, ry, seed);
  ambBlob(by.fill1, a * ambStep(q, 0.2, 0.5), x, y, rx * 0.72, ry * 0.72, seed + 1);
  ambBlob(by.fill2, a * ambStep(q, 0.45, 0.55), x, y, rx * 0.46, ry * 0.46, seed + 2);
}

/** A rounded, irregular blob (eight points about (x, y), each at its own distance, the outline smoothed through them). */
function ambBlob(L, a, x, y, rx, ry, seed) {
  const p = rx > 0.3 && ambPath(L, a);
  if (!p) return;
  const N = 8, px = [], py = [];
  for (let k = 0; k < N; k++) { const an = (k / N) * Math.PI * 2, w = 0.78 + 0.32 * hash2(seed, k, 761); px.push(x + Math.cos(an) * rx * w); py.push(y + Math.sin(an) * ry * w); }
  p.moveTo((px[N - 1] + px[0]) / 2, (py[N - 1] + py[0]) / 2);
  for (let k = 0; k < N; k++) { const n = (k + 1) % N; p.quadraticCurveTo(px[k], py[k], (px[k] + px[n]) / 2, (py[k] + py[n]) / 2); }
  p.closePath();
}

/* ------------------------------------------------------------------ beacons */

/** '#rrggbb' as [r, g, b]. */
function ambRGB(hex) { return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)); }
/** A pale light with share `k` of colour `hex` in it, as 'r,g,b'. */
function ambTint(hex, k) {
  const c = ambRGB(hex || '#dfe9ff'), p = [222, 233, 255];
  return p.map((v, i) => Math.round(v + (c[i] - v) * k)).join(',');
}

/**
 * From evening until dawn, the Command Bases' beacons: each standing, finished one (whoever holds it) shines a pale beam
 * straight up from the top of its mast into the sky, its owner's colour faintly in it, with a soft halo at its foot,
 * light on its pad and a slow pulse that every beacon on the planet keeps in time. Your own base hums as its beacon
 * comes on, if it's in view. In the Hollow the beam goes up its breach (a base under rock would light only the roof).
 */
function drawBeacons(ctx, ox, oy, z) {
  if (!S || !S.buildings) return;
  const A = ambState(), k = ambLight(AMB.beam), on = k > 0.45;
  const pulse = 0.86 + 0.14 * Math.sin((R.time * Math.PI * 2) / AMB.pulse), wx = S.hollow ? 0 : ambWeather();
  let drew = false;
  for (const b of S.buildings) {
    if (b.type !== 'lander' || b.dead || !b.built) continue;
    const was = A.beacons.get(b.id);
    A.beacons.set(b.id, on);
    if (on && was === false && isMe(b.owner) && R.time - A.humAt > 8 && typeof mapVoice === 'function' && typeof sfxReady === 'function' && sfxReady()) {
      const D = mapVoice(b.x + 0.5, b.y + 0.5, 1);
      if (D) { A.humAt = R.time; sfx('beacon', D); }
    }
    if (k < 0.01) continue;
    // The top of the mast (the art's light, at 0.537, 0.098 of the image), else a little over the middle.
    const art = ART['lander@' + Math.min(1, b.owner)], sc = art && art.scale, an = art && art.anchor;
    const fx = ox + (b.x + 0.5) * z + (Array.isArray(an) && sc ? (0.537 - an[0]) * sc * z : 0);
    const fy = oy + (b.y + 0.5) * z + (Array.isArray(an) && sc ? (0.098 - an[1]) * sc * z : -0.9 * z);
    const under = !S.hollow || breachAt(b.x + 0.5, b.y + 0.5, 1.5);
    const L = under ? Math.max(z * 24, R.h * 0.5) * (1 - 0.35 * wx) : z * 2.4;
    if (fx < -z * 3 || fx > R.w + z * 3 || fy - L > R.h || fy > R.h + z * 4) continue;
    if (!drew) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; drew = true; }
    ambBeam(ctx, fx, fy, L, z, PLAYER_COLORS[b.owner] || '#dfe9ff', k * pulse, wx, !under, b.id);
  }
  if (drew) ctx.restore();
}

/** One beam (adding light): its foot at (x, y), `L` px tall, strength `a`; `wx` the weather (it scatters the light); `roof`: under rock. */
function ambBeam(ctx, x, y, L, z, hex, a, wx, roof, id) {
  const beam = ambTint(hex, 0.22), halo = ambTint(hex, 0.45), top = y - L;
  // The light on the pad round the base.
  const pr = Math.max(14, z * 1.9), pg = ctx.createRadialGradient(x, y + z, 0, x, y + z, pr);
  pg.addColorStop(0, `rgba(${halo},${0.18 * a})`); pg.addColorStop(1, `rgba(${halo},0)`);
  ctx.fillStyle = pg;
  ctx.beginPath(); ctx.ellipse(x, y + z, pr, pr * 0.7, 0, 0, Math.PI * 2); ctx.fill();
  // Three columns one inside another (soft edges, brightest down the middle), each widening a little as it climbs and
  // fading into the sky: a wide faint haze (wider and stronger in weather, which scatters the light), the glow, the core.
  const col = (w0, w1, a0, a1, mid, white) => {
    const g = ctx.createLinearGradient(0, y, 0, top);
    g.addColorStop(0, white ? `rgba(248,250,255,${a0})` : `rgba(${beam},${a0})`); g.addColorStop(mid, `rgba(${beam},${a1})`); g.addColorStop(1, `rgba(${beam},0)`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(x - w0 / 2, y); ctx.lineTo(x - w1 / 2, top); ctx.lineTo(x + w1 / 2, top); ctx.lineTo(x + w0 / 2, y); ctx.closePath(); ctx.fill();
  };
  const hw = Math.max(26, z * 1.5) * (1 + wx);
  col(hw, hw * 2.2, (0.07 + 0.08 * wx) * a, 0.025 * a, 0.45);
  const gw = Math.max(11, z * 0.55);
  col(gw, gw * 1.9, 0.22 * a, 0.09 * a, 0.35);
  const cw = Math.max(2, z * 0.09);
  col(cw, cw * 1.6, 0.9 * a, 0.4 * a, 0.2, true);
  // The halo at its foot.
  const hr = Math.max(11, z * 0.7) * (1 + 0.5 * wx), hg = ctx.createRadialGradient(x, y, 0, x, y, hr);
  hg.addColorStop(0, `rgba(255,255,255,${0.8 * a})`); hg.addColorStop(0.25, `rgba(${halo},${0.45 * a})`); hg.addColorStop(1, `rgba(${halo},0)`);
  ctx.fillStyle = hg;
  ctx.fillRect(x - hr, y - hr, hr * 2, hr * 2);
  if (roof) { // under the Hollow's rock: a pale splash where it meets the roof
    const rg = ctx.createRadialGradient(x, top, 0, x, top, z * 0.9);
    rg.addColorStop(0, `rgba(${beam},${0.3 * a})`); rg.addColorStop(1, `rgba(${beam},0)`);
    ctx.fillStyle = rg; ctx.fillRect(x - z * 0.9, top - z * 0.9, z * 1.8, z * 1.8);
    return;
  }
  // Up close, motes drifting slowly up through the light.
  if (z < 22) return;
  const m = Math.max(1, z * 0.04);
  for (let n = 0; n < 10; n++) {
    const h1 = hash2(id, n, 751), h2 = hash2(n, id, 752), f = (R.time * (0.02 + 0.03 * h2) + h1) % 1;
    ctx.fillStyle = `rgba(${beam},${0.5 * a * Math.sin(f * Math.PI)})`;
    ctx.fillRect(x + (h2 - 0.5) * gw * (0.6 + 0.4 * f), y - f * L * 0.6, m, m);
  }
}

/**
 * The beacon's hum as it comes on (sfx 'beacon', through `D`, the map voice where the base is): a soft, low swell of
 * two notes a fifth apart, with a little of their octave for small speakers, dying away over a few seconds.
 */
function ambHum(D) {
  const ac = AUDIO.ctx, t0 = ac.currentTime + 0.02;
  const lp = ac.createBiquadFilter(), env = ac.createGain();
  lp.type = 'lowpass'; lp.frequency.value = 520;
  env.gain.value = 0.0001;
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(0.06, t0 + 1.3);
  env.gain.setValueAtTime(0.06, t0 + 2.2);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + 5);
  lp.connect(env).connect(D || AUDIO.fxBus);
  for (const [f, v, type] of [[55, 0.9, 'sine'], [82.4, 0.35, 'sine'], [110, 0.3, 'triangle'], [220, 0.06, 'sine']]) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f * 0.97, t0); o.frequency.exponentialRampToValueAtTime(f, t0 + 1.2); // (spinning up)
    g.gain.value = v;
    o.connect(g).connect(lp);
    o.start(t0); o.stop(t0 + 5.1);
  }
}

/** Over everything on the ground and in the air: the clouds' shadows, then the beacons. */
function drawAmbientSky(ctx, ox, oy, z) {
  if (!S || !S.settings) return;
  drawCloudShadows(ctx, ox, oy, z);
  drawBeacons(ctx, ox, oy, z);
}

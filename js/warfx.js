'use strict';
/*
 * The war on the land, for looks only: Ithaca I is beautiful, and the war tears it apart. Nothing here changes the
 * game, S, saves or orders; what it keeps is display-only (R.wfx, made afresh for each game and each load), and it
 * reads only the game's clock, its effects (S.fx, as they are added: see wfxScan), the Lance's cuts and the War scars
 * layers. Every device draws its own; none of it has to agree.
 *
 * - Smoke columns (wfxColumn, drawWfxColumns): a building burned down, a burning wreck, a big blast sends up a tall
 *   column of smoke that leans with the wind (the clouds' wind: ambWind) and lingers for a few minutes after the fight
 *   has moved on, so a battlefield reads from far off. Columns close together join into one; only so many are kept
 *   (WARFX.col.max, by the Graphics step). Zoomed in they thin, and they are faint where they rise off the ground, so
 *   they never hide the robots fighting under them.
 * - Ground fires (wfxIgnite, drawWfxFires): the fire in a wreck creeps a short way over the grass the war has already
 *   scorched (S.ash), and catches the trees on it, then dies out. At dusk and night every fire throws a flickering
 *   light on the ground and the buildings round it (the light pool, drawLightPool).
 * - Ash and embers (wfxAsh, drawWfxAsh): where the fighting was, ash drifts on the wind and embers float up and wink
 *   out, thinning and settling over the next couple of minutes.
 * - Shockwaves (wfxShock, drawWfxRings, drawWfxFlash): a Missile, a nuclear blast, Ringfall, a fuel blast and the
 *   Lance's shot send a ring of dust and light rippling out along the ground, and a flash lights the whole area for a
 *   moment, by its size. With the device set to reduce motion: no flash, and a slower, fainter ring.
 * - Burning oil (wfxOil, drawWfxOilGround, drawWfxOil): an Oil Pump destroyed by force (not taken down by its owner)
 *   becomes a burning well, like the oil fires of old Earth's desert wars: a roaring jet of flame from the wellhead under
 *   a thick black column of smoke leaning with the wind, for three or four minutes, then guttering out to a smouldering,
 *   blackened ruin that stays a while longer. It lights the land round it at night, flickering, and roars (oilRoar in
 *   js/audio.js, one voice for all of them). A Refinery or Fuel Tank destroyed by force burns the same, lower and
 *   shorter. Building on the spot puts it out; nothing stops a rebuild.
 * - The land healing (wfxHeal, warHeal, paintScarHeal): where nobody has fought for a few minutes, the War scars green
 *   again, slowly: the scorch and ash fade back into the ground under them, and grass and small flowers come up on the
 *   old craters. The craters stay (the owner's choice), and so do scrap and graveyards until they're salvaged; the
 *   game's own layers never change (S.ash stays as it was: the herds still keep off it). It is baked into the ground
 *   with the scars (paintScars), a step at a time, so it costs nothing a frame. A loaded game starts healing afresh.
 *
 * Cost scales with the Graphics step (gfxStep and gfx().fx): fewer columns, fires and specks on Saver, more on Ultra.
 */

const WARFX = {
  // Smoke columns: how long one lasts (s, from a big burn; a robot's wreck lasts `small` of it), the most kept at each
  // Graphics step, how near two must be to join (tiles), how high one rises (tiles, a full one) and its puffs.
  col: { life: 210, small: 0.55, max: { saver: 6, auto: 14, high: 20, ultra: 28 }, join: 1.8, height: 9, puffs: 24 },
  // Ground fires: the most at once, how far from where it started a fire creeps (tiles), how many tiles one wreck's
  // fire may catch, how long each burns (s), and how long before the next catches.
  fire: { max: { saver: 10, auto: 26, high: 38, ultra: 52 }, reach: 2.4, spread: 6, life: [16, 34], tree: 1.6, step: [2.5, 7] },
  // Ash and embers over a fight: cells (tiles a side) collect the heat of what burns and blows up in them; a cell's
  // ash is full at `full` heat, fades over `life` s, and its embers over `embers` s. The most cells drawn, by step.
  ash: { cell: 6, full: 6, life: 140, embers: 70, max: { saver: 5, auto: 12, high: 18, ultra: 26 }, specks: 22 },
  // Shockwaves: a blast this big or bigger (tiles) sends one; the ring reaches `reach` times the blast.
  shock: { min: 1.5, reach: 3.2, flash: 0.45 },
  // Burning oil, by what burned: seconds it burns (the last `gutter` of them dying down) and then smoulders, its jet's
  // height and width (tiles), its smoke column's strength, the blackened ground's reach (tiles).
  oil: {
    pump: { burn: 210, gutter: 35, smoulder: 240, jet: 3.4, w: 0.55, smoke: 2.6, soot: 1.2 },
    refinery: { burn: 100, gutter: 25, smoulder: 140, jet: 1.9, w: 1.0, smoke: 2, soot: 1.4 },
    fueltank: { burn: 120, gutter: 25, smoulder: 160, jet: 1.7, w: 1.25, smoke: 2.2, soot: 1.6 },
  },
  // The land healing: cells (tiles a side) a fight anywhere in (or next to) holds back; `quiet` s with no fighting
  // before the scars start to green, then `grow` s to green as far as they go; `steps` bakes along the way.
  heal: { cell: 6, quiet: 150, grow: 480, steps: 6, every: 1, most: 260 },
};

/** The kinds of effect that mean fighting there (the land doesn't start healing while it goes on). */
const WFX_FIGHT = new Set(['tracer', 'muzzle', 'boom', 'flame', 'railshot', 'pulsebeam', 'chain', 'nuke', 'fuelblast', 'spit', 'fire']);

/** This game's display-only state (made afresh for each game and each load). */
function wfxState() {
  let W = R.wfx;
  if (!W || W.of !== S) {
    W = R.wfx = { of: S, tick: S.tick, seen: new WeakSet(), cols: [], fires: [], ash: new Map(), rings: [], flash: [], oil: [], cutT: S.time, heal: null, n: 0 };
    if (S.cuts && S.cuts.length) W.cutT = Math.max(W.cutT, ...S.cuts.map((c) => c.t));
  }
  return W;
}
/** (For tests and tools: the state as it stands, or null.) */
const WFX = { get of() { return R.wfx && R.wfx.of; }, get cols() { return R.wfx ? R.wfx.cols : []; }, get fires() { return R.wfx ? R.wfx.fires : []; }, get ash() { return R.wfx ? [...R.wfx.ash.values()] : []; } };

function wfxLess() { return !!(typeof LESS_MOTION !== 'undefined' && LESS_MOTION && LESS_MOTION.matches); }
function wfxMost(t) { return t[gfxStep()] || t.auto; }
function wfxAirless() { return biome() === 'lunar'; }

/** The wind now (tiles a second), as the clouds' (ambWind), and none on airless Argos. */
function wfxWind() {
  if (wfxAirless() || typeof ambWind !== 'function' || typeof WEATHER === 'undefined') return { x: 0, y: 0 };
  return ambWind(Math.max(0, Math.floor(S.time / WEATHER.slot)));
}

/* ------------------------------------------------------------------ what's happening */

/**
 * Look through the effects added since the last frame (as ambScan does) for fires, blasts and fighting; and through the
 * Lance's cuts for a new shot. Also keeps the healing up to date (wfxHeal).
 */
function wfxScan(W) {
  const fx = S.fx || [], from = W.tick - 1;
  for (let n = fx.length - 1; n >= 0; n--) {
    const f = fx[n];
    if (f.tick < from) break;
    if (W.seen.has(f)) continue;
    W.seen.add(f);
    wfxNote(W, f);
  }
  W.tick = S.tick;
  if (S.cuts && S.cuts.length) for (const c of S.cuts) if (c.t > W.cutT) { W.cutT = c.t; wfxLance(W, c); }
  wfxHeal(W);
}

/** One effect just added: what it leaves in the air and on the ground. */
function wfxNote(W, f) {
  if (WFX_FIGHT.has(f.type)) wfxFought(W, f.x, f.y);
  const r = f.r || 0;
  switch (f.type) {
    case 'fire': {
      if (f.life >= 12) { wfxColumn(W, f.x, f.y, Math.max(1, r / 0.42), 1); wfxIgnite(W, f.x, f.y, WARFX.fire.spread, f.seed); wfxAsh(W, f.x, f.y, 3); } // (a building burned down)
      else if (f.life >= 4.5) { wfxColumn(W, f.x, f.y, r >= 0.28 ? 0.62 : 0.45, WARFX.col.small); wfxIgnite(W, f.x, f.y, r >= 0.28 ? 3 : 2, f.seed); wfxAsh(W, f.x, f.y, 1); } // (a robot's wreck, napalm, a lava bomb)
      else { if (hash2(f.seed || 0, S.tick, 911) < 0.35) wfxIgnite(W, f.x, f.y, 1, f.seed); wfxAsh(W, f.x, f.y, 0.25); } // (a Torch's flame catching the grass, now and then)
      break;
    }
    case 'boom':
      wfxAsh(W, f.x, f.y, Math.min(3, r));
      if (r >= WARFX.shock.min) { wfxShock(W, f.x, f.y, r, f.t < 0 ? -f.t : 0); wfxColumn(W, f.x, f.y, Math.min(1.4, r * 0.5), 0.6); }
      break;
    case 'fuelblast':
      wfxShock(W, f.x, f.y, Math.max(WARFX.shock.min, r), 0);
      wfxColumn(W, f.x, f.y, Math.min(1.6, 0.7 + r * 0.3), 0.8, true);
      wfxIgnite(W, f.x, f.y, 4, Math.floor(f.x * 7 + f.y * 3));
      wfxAsh(W, f.x, f.y, 3);
      break;
    case 'collapse':
      if (f.burn && WARFX.oil[f.btype]) wfxOil(W, f.x, f.y, f.btype);
      break;
    case 'nuke':
      wfxShock(W, f.x, f.y, r * 1.4, 0, false, true); // (its own flash is the game's: drawNukeGlowFx)
      wfxColumn(W, f.x, f.y, 2.6, 1.5);
      wfxAsh(W, f.x, f.y, 12);
      break;
  }
}

/** The Lance fired (cut c): a ring where the beam struck, rippling out along the cut as it goes, a flash, and smoke where it burned. */
function wfxLance(W, c) {
  const len = Math.hypot(c.x1 - c.x0, c.y1 - c.y0), n = Math.min(8, Math.max(1, Math.floor(len / 7)));
  for (let k = 1; k <= n; k++) {
    const q = k / n, x = c.x0 + (c.x1 - c.x0) * q, y = c.y0 + (c.y1 - c.y0) * q;
    wfxShock(W, x, y, k === n ? 2.6 : 1.5, 0.12 * k, k !== n);
    wfxFought(W, x, y);
    if (k === n || k % 2 === 0) wfxColumn(W, x, y, 0.9, 0.7);
  }
}

/** Fighting at (x, y): the land round it doesn't heal while it goes on. */
function wfxFought(W, x, y) {
  const H = W.heal;
  if (!H) return;
  const ci = Math.floor(x / H.cell), cj = Math.floor(y / H.cell);
  for (let b = cj - 1; b <= cj + 1; b++) for (let a = ci - 1; a <= ci + 1; a++) if (a >= 0 && b >= 0 && a < H.cw && b < H.ch) H.last[b * H.cw + a] = S.time;
}

/** A column of smoke at (x, y) of strength s (1: a building burned down) lasting `life` of WARFX.col.life; dark: a fuel fire's black smoke. */
function wfxColumn(W, x, y, s, life, dark) {
  const C = WARFX.col, L = C.life * life;
  for (const c of W.cols) {
    if (c.oil) continue; // (a burning well's column stands alone)
    if (Math.abs(c.x - x) > C.join || Math.abs(c.y - y) > C.join) continue;
    // Joined into the one already there: thicker, and it lasts from now.
    const left = c.t0 + c.life - S.time;
    c.s = Math.max(c.s, s, Math.min(1.6, Math.max(c.s, s) + 0.25 * Math.min(c.s, s))); // (joining thickens it, up to a burning building's and a half)
    c.life = Math.max(left, L) + (S.time - c.t0);
    c.dark = c.dark || !!dark;
    return;
  }
  W.cols.push({ x, y, s, t0: S.time, life: L, sd: (W.n++ * 7 + Math.floor(x * 13 + y * 7)) % 997, dark: !!dark });
  const most = wfxMost(C.max);
  if (W.cols.length > most) {
    // Past the most: the one with least left of it goes.
    let k = 0, low = Infinity;
    W.cols.forEach((c, n) => { const v = c.oil ? Infinity : c.s * (c.t0 + c.life - S.time); if (v < low) { low = v; k = n; } });
    W.cols.splice(k, 1);
  }
}

/** Heat into the ash over (x, y)'s cell: what burned or blew up there. */
function wfxAsh(W, x, y, heat) {
  if (wfxAirless()) return;
  const A = WARFX.ash, ci = Math.floor(x / A.cell), cj = Math.floor(y / A.cell), key = cj * 4096 + ci;
  let a = W.ash.get(key);
  if (!a) { a = { x: (ci + 0.5) * A.cell, y: (cj + 0.5) * A.cell, heat: 0, t: S.time, sd: (ci * 31 + cj * 17) % 991, n: 0, sx: 0, sy: 0 }; W.ash.set(key, a); }
  // (its middle drifts toward where the heat came from)
  a.sx += x * heat; a.sy += y * heat; a.n += heat;
  a.x = a.sx / a.n; a.y = a.sy / a.n;
  a.heat = Math.min(A.full * 2, wfxAshLeft(a) * A.full + heat);
  a.t = S.time;
}
/** How much of ash cell a is left (0..1). */
function wfxAshLeft(a) { return clamp(a.heat / WARFX.ash.full, 0, 1) * clamp(1 - (S.time - a.t) / WARFX.ash.life, 0, 1); }

/** A blast of reach r at (x, y): its shockwave (`delay` s later); `quiet`: a lesser one along the Lance's line (no flash); `lit`: no flash over the screen (it has its own). */
function wfxShock(W, x, y, r, delay, quiet, lit) {
  const less = wfxLess(), dur = (0.85 + 0.12 * r) * (less ? 1.7 : 1);
  W.rings.push({ x, y, r, t0: S.time + (delay || 0), dur, less });
  if (W.rings.length > 24) W.rings.shift();
  if (!less && !quiet) W.flash.push({ x, y, r, t0: S.time + (delay || 0), dur: 0.22 + 0.05 * Math.min(6, r), lit: !!lit });
}

/**
 * The fire in a wreck at (x, y) creeps over the scorched grass round it: up to n tiles catch, one after another, each
 * within WARFX.fire.reach of where it started, on open ground the war has already scorched (S.ash; a tree on it burns
 * higher). Worked out now, from the tile's hash, so the same wreck burns the same way; none with War scars off.
 */
function wfxIgnite(W, x, y, n, seed) {
  if (!S.ash || wfxAirless() || !n) return;
  const F = WARFX.fire, i0 = Math.floor(x), j0 = Math.floor(y);
  if (!inMap(i0, j0)) return;
  const sd = ((seed || 0) * 131 + i0 * 7 + j0 * 13 + W.n++) | 0, taken = new Set(), at = [{ i: i0, j: j0, t: S.time }];
  taken.add(tIdx(i0, j0));
  // (the tile it started on, if it's grass, burns too: the wreck's own fire is the game's)
  for (let k = 0, g = 0; k < n && g < 40; g++) {
    const from = at[Math.floor(hash2(sd, g, 1) * at.length)], d = Math.floor(hash2(sd, g, 2) * 8);
    const i = from.i + ARM_DIRS8[d][0], j = from.j + ARM_DIRS8[d][1];
    if (!inMap(i, j)) continue;
    const t = tIdx(i, j);
    if (taken.has(t) || Math.hypot(i + 0.5 - x, j + 0.5 - y) > F.reach || !wfxBurns(t)) continue;
    taken.add(t);
    const t0 = from.t + F.step[0] + (F.step[1] - F.step[0]) * hash2(sd, g, 3), tree = !!(S.decor && S.decor[t]);
    const e = { x: i + 0.25 + 0.5 * hash2(sd, g, 4), y: j + 0.35 + 0.45 * hash2(sd, g, 5), i, j, t0, life: (F.life[0] + (F.life[1] - F.life[0]) * hash2(sd, g, 6)) * (tree ? F.tree : 1), tree, sd: (sd + g * 37) % 997, r: tree ? 0.4 : 0.26 + 0.1 * hash2(sd, g, 7) };
    at.push({ i, j, t: t0 });
    W.fires.push(e);
    k++;
  }
  const most = wfxMost(F.max);
  if (W.fires.length > most) W.fires.splice(0, W.fires.length - most);
}
const ARM_DIRS8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];

/** Can tile t burn: open grass the war has scorched (or burned to ash), no road, building or water on it? */
function wfxBurns(t) {
  if (S.terrain[t] !== T_GROUND || !S.ash[t] || S.ash[t] >= SCARS.glass || S.road[t] || S.bAt[t] || (S.rail && S.rail[t])) return false;
  const b = renderBiomeAt(t) || biome();
  return b !== 'polar' && b !== 'lunar' && b !== 'hollow';
}

/* ------------------------------------------------------------------ the land healing */

/**
 * Keep the healing up to date, once a second of game time: each cell counts the quiet time it has had (no fighting in
 * it or next to it for WARFX.heal.quiet s); a tile's scars started healing when they last grew (a new blast on it starts
 * it again, a fight nearby only holds it), and as it passes each step its ground is baked again (markDirty), a few
 * hundred tiles at a time.
 */
function wfxHeal(W) {
  if (!S.ash || !S.crater) return;
  const C = WARFX.heal, N = S.W * S.H;
  let H = W.heal;
  if (!H) {
    const cw = Math.ceil(S.W / C.cell), ch = Math.ceil(S.H / C.cell);
    H = W.heal = { cell: C.cell, cw, ch, last: new Float64Array(cw * ch).fill(-1e9), quiet: new Float64Array(cw * ch), from: new Float32Array(N), lvl: new Uint8Array(N), a: S.ash.slice(), c: S.crater.slice(), t: S.time };
    return;
  }
  const dt = S.time - H.t;
  if (dt < C.every && dt >= 0) return;
  H.t = S.time;
  if (dt < 0 || dt > 30) return; // (time went back or leapt: count none of it)
  for (let k = 0; k < H.quiet.length; k++) if (S.time - H.last[k] > C.quiet) H.quiet[k] += dt;
  const A = S.ash, Cr = S.crater, W0 = S.W;
  let baked = 0;
  for (let t = 0; t < N; t++) {
    const a = A[t], c = Cr[t];
    if (!a && !c) { if (H.lvl[t]) H.lvl[t] = 0; H.a[t] = 0; H.c[t] = 0; continue; }
    const i = t % W0, j = (t / W0) | 0, cell = ((j / C.cell) | 0) * H.cw + ((i / C.cell) | 0);
    if (a > H.a[t] || c > H.c[t]) { H.from[t] = H.quiet[cell]; if (H.lvl[t]) { H.lvl[t] = 0; markDirty(i, j); } }
    H.a[t] = a; H.c[t] = c;
    const lv = Math.floor(clamp((H.quiet[cell] - H.from[t]) / C.grow, 0, 1) * C.steps);
    if (lv !== H.lvl[t] && baked < C.most) { H.lvl[t] = lv; markDirty(i, j); baked++; }
  }
}

/** How far tile t's scars have healed, 0..1, as baked (paintScars). */
function warHeal(t) {
  const W = R.wfx, H = W && W.of === S && W.heal;
  return H && H.lvl[t] ? H.lvl[t] / WARFX.heal.steps : 0;
}

/** What comes up on healing ground, by biome: the grass, and the flowers' colours (none: no flowers there). */
const WFX_BLOOM = {
  jungle: { grass: ['#5f8a34', '#77a03e'], flowers: ['#f2e9d0', '#f4c542', '#e86a8a'] },
  swamp: { grass: ['#5c6a2e', '#75823c'], flowers: ['#e8e2c8', '#c9a7e8'] },
  autumn: { grass: ['#6c6c2c', '#9c8a3c'], flowers: ['#f0e4c0', '#e0a040', '#c8603a'] },
  savanna: { grass: ['#a8984e', '#c4ab5c'], flowers: ['#f4d36a', '#f0ead8'] },
  tropical: { grass: ['#729053', '#94a75a'], flowers: ['#ff8fa8', '#ffe27a', '#ffffff'] },
  springs: { grass: ['#8d9a5e', '#a9ac70'], flowers: ['#f2ecd6', '#d9b8e8'] },
  desert: { grass: ['#9a8a50', '#b49c5c'], flowers: ['#f4d06a'] },
  volcanic: { grass: ['#5a6040', '#6f7448'], flowers: [] },
  polar: { grass: ['#e4ebf2', '#cbd6e2'], flowers: [] },
  alien: { grass: ['#6a4c9a', '#8a62c8'], flowers: ['#cfa3ff', '#efe2ff'] },
  hollow: { grass: ['#4f3c70', '#7a52b8'], flowers: ['#c093ff'] },
  lunar: { grass: [], flowers: [] },
};

/**
 * Healing ground (h, 0..1, warHeal) on tile (i, j), baked over its scars: tufts of grass coming up, more as it heals,
 * and later small flowers, thickest on the rims of the old craters (the craters themselves stay).
 */
function paintScarHeal(ctx, i, j, x, y, t, h) {
  const B = WFX_BLOOM[renderBiomeAt(t) || biome()] || WFX_BLOOM.jungle;
  if (!B.grass.length || h <= 0) return;
  const crater = S.crater[t] > 0, n = Math.round((crater ? 10 : 7) * h);
  ctx.save();
  ctx.lineCap = 'round';
  for (let k = 0; k < n; k++) {
    const px = x + 3 + hash2(i, j, 700 + k) * (TP - 6), py = y + 4 + hash2(i, j, 720 + k) * (TP - 7), tall = 2.5 + 3.5 * hash2(i, j, 740 + k) * h;
    ctx.strokeStyle = B.grass[k % B.grass.length]; ctx.lineWidth = 1.1;
    ctx.globalAlpha = 0.55 + 0.4 * h;
    ctx.beginPath();
    for (const lean of [-0.8, 0, 0.9]) { ctx.moveTo(px, py); ctx.lineTo(px + lean * tall * 0.45, py - tall * (lean ? 0.8 : 1)); }
    ctx.stroke();
  }
  // flowers, once it's well on: a few on open ground, more round a crater's rim
  const nf = h < 0.5 || !B.flowers.length ? 0 : Math.round((crater ? 6 : 3) * (h - 0.4) / 0.6);
  for (let k = 0; k < nf; k++) {
    const px = x + 3 + hash2(i, j, 760 + k) * (TP - 6), py = y + 3 + hash2(i, j, 780 + k) * (TP - 6), s = 1.1 + 0.9 * hash2(i, j, 800 + k);
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = 'rgba(30,40,20,0.35)'; ctx.beginPath(); ctx.arc(px + 0.6, py + 0.8, s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = B.flowers[Math.floor(hash2(i, j, 820 + k) * B.flowers.length)];
    ctx.beginPath(); ctx.arc(px, py, s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f7d65a'; ctx.fillRect(px - 0.4, py - 0.4, 0.8, 0.8);
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ drawn */

/** A small flame (cached): a teardrop of fire, white-hot at its foot, for the ground fires. */
function wfxFlame() {
  if (R.wfxFlame) return R.wfxFlame;
  const w = 32, h = 64, c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, h, 0, 0);
  gr.addColorStop(0, 'rgba(255,246,205,0.95)'); gr.addColorStop(0.3, 'rgba(255,176,64,0.85)'); gr.addColorStop(0.7, 'rgba(240,80,20,0.45)'); gr.addColorStop(1, 'rgba(200,40,10,0)');
  g.fillStyle = gr;
  g.beginPath(); g.moveTo(w * 0.1, h); g.quadraticCurveTo(w * 0.05, h * 0.45, w * 0.5, 0); g.quadraticCurveTo(w * 0.95, h * 0.45, w * 0.9, h); g.closePath(); g.fill();
  return (R.wfxFlame = c);
}

/** How much to thin smoke and ash zoomed in (1 far out, less close up), so they never hide the robots. */
function wfxThin(z) { return clamp(1.3 - z / 48, 0.38, 1); }

/**
 * Under the robots and buildings (after the ground's marks): keep track of what's happening (wfxScan), then the
 * shockwaves rippling along the ground and the ground fires.
 */
function drawWarGround(ctx, ox, oy, z, v0, v1) {
  if (!S || !S.fx) return;
  const W = wfxState();
  wfxScan(W);
  const inView = (x, y, m) => x > v0.x - m && x < v1.x + m && y > v0.y - m && y < v1.y + m;
  if (W.rings.length) drawWfxRings(ctx, W, ox, oy, z, inView);
  if (W.oil.length) drawWfxOilGround(ctx, W, ox, oy, z, inView);
  if (W.fires.length) drawWfxFires(ctx, W, ox, oy, z, inView);
}

/** Over everything (after the effects): firelight at night, the smoke columns, ash and embers, and the flash of a big blast. */
function drawWarAir(ctx, ox, oy, z, v0, v1) {
  const W = R.wfx;
  if (!W || W.of !== S) return;
  const inView = (x, y, m) => x > v0.x - m && x < v1.x + m && y > v0.y - m && y < v1.y + m;
  if (W.fires.length) drawWfxFireLight(ctx, W, ox, oy, z, inView);
  if (W.oil.length) drawWfxOilLight(ctx, W, ox, oy, z, inView);
  if (W.cols.length) drawWfxColumns(ctx, W, ox, oy, z, inView);
  if (W.oil.length) drawWfxOil(ctx, W, ox, oy, z, inView);
  if (W.ash.size) drawWfxAsh(ctx, W, ox, oy, z, inView);
  if (W.flash.length) drawWfxFlash(ctx, W, ox, oy, z);
}

/** The shockwaves: a dusty band and a bright leading edge racing out over the ground (fainter and slower to reduce motion). */
function drawWfxRings(ctx, W, ox, oy, z, inView) {
  let keep = 0;
  ctx.save();
  for (const g of W.rings) {
    const q = (S.time - g.t0) / g.dur;
    if (q >= 1) continue;
    W.rings[keep++] = g;
    if (q < 0) continue;
    const reach = g.r * WARFX.shock.reach;
    if (!inView(g.x, g.y, reach + 1)) continue;
    const e = 1 - Math.pow(1 - q, 2.2), rr = Math.max(2, reach * e * z), x = ox + g.x * z, y = oy + g.y * z, fade = Math.pow(1 - q, 1.3) * (g.less ? 0.45 : 1);
    const band = Math.max(2, z * (0.22 + 0.06 * g.r) * (1 - 0.5 * q));
    // the dust thrown up behind the front (shaded at night: it doesn't glow)
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = fxDim('#9c8466'); ctx.globalAlpha = 0.42 * fade; ctx.lineWidth = band * 1.8;
    ctx.beginPath(); ctx.ellipse(x, y, Math.max(1, rr - band), Math.max(1, (rr - band) * 0.62), 0, 0, Math.PI * 2); ctx.stroke();
    // the front: the air itself pushed out, a bright edge catching the blast's light (warmer, and less of it, at night)
    const night = fxNight();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = night > 0.5 ? '#ffc58a' : '#ffe9c4'; ctx.globalAlpha = (g.less ? 0.35 : 0.7) * fade * (1 - 0.5 * night); ctx.lineWidth = Math.max(1.2, band * 0.45);
    ctx.beginPath(); ctx.ellipse(x, y, rr, rr * 0.62, 0, 0, Math.PI * 2); ctx.stroke();
    if (!g.less && q < 0.6) {
      // the ground heaving behind it: a second, dusty ripple
      const r2 = rr * 0.7;
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = fxDim('#b39b7a'); ctx.globalAlpha = 0.3 * fade; ctx.lineWidth = Math.max(1, band * 0.7);
      ctx.beginPath(); ctx.ellipse(x, y, r2, r2 * 0.62, 0, 0, Math.PI * 2); ctx.stroke();
    }
  }
  W.rings.length = keep;
  ctx.restore();
}

/** The ground fires: flames licking up out of the grass, swelling and dying as each burns out, a curl of smoke off each. */
function drawWfxFires(ctx, W, ox, oy, z, inView) {
  const img = wfxFlame(), now = S.time, puff = fxPuff(true), wind = wfxWind();
  let keep = 0;
  for (const e of W.fires) {
    const age = now - e.t0;
    if (age >= e.life) continue;
    W.fires[keep++] = e;
    if (age < 0 || !inView(e.x, e.y, 2)) continue;
    const k = clamp(Math.min(age / 2.5, (e.life - age) / (e.life * 0.4)), 0, 1), x = ox + e.x * z, y = oy + e.y * z, r = e.r * z;
    // smoke off it, thin
    for (let n = 0; n < 2; n++) {
      const ph = (now * 0.35 + n * 0.5 + e.sd * 0.013) % 1, s = r * (1.4 + 3 * ph);
      ctx.globalAlpha = 0.32 * k * Math.sin(ph * Math.PI) * (1 - 0.4 * fxNight());
      ctx.drawImage(puff, x + wind.x * ph * z * 1.6 - s / 2, y - r - ph * z * 1.4 - s / 2, s, s);
    }
    // the flames
    ctx.globalCompositeOperation = 'lighter';
    const tongues = e.tree ? 4 : 3;
    for (let n = 0; n < tongues; n++) {
      const fl = 0.7 + 0.3 * Math.sin(now * (8 + n * 2.7) + e.sd + n * 2.1), h = r * (e.tree ? 2.6 : 1.7) * k * fl * (0.75 + 0.25 * hash2(e.sd, n, 1));
      if (h < 1.5) continue;
      const w = h * 0.45, fx = x + (hash2(e.sd, n, 2) - 0.5) * r * 1.6 + wind.x * h * 0.15;
      ctx.globalAlpha = 0.85 * k;
      ctx.drawImage(img, fx - w / 2, y - h + r * 0.2, w, h);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  W.fires.length = keep;
  ctx.globalAlpha = 1;
}

/** At dusk and night, each fire's flickering light on the ground and the buildings round it (the light pool), and a glow by day. */
function drawWfxFireLight(ctx, W, ox, oy, z, inView) {
  const night = fxNight(), now = S.time;
  if (night < 0.02) return;
  for (const e of W.fires) {
    const age = now - e.t0;
    if (age < 0 || age >= e.life || !inView(e.x, e.y, 3)) continue;
    const k = clamp(Math.min(age / 2.5, (e.life - age) / (e.life * 0.4)), 0, 1), fl = 0.72 + 0.28 * Math.sin(now * 11 + e.sd) * Math.sin(now * 4.3 + e.sd * 0.7);
    ctx.globalAlpha = Math.min(1, 0.85 * k * fl);
    drawLightPool(ctx, ox + e.x * z, oy + e.y * z, z * (e.tree ? 1.5 : 1.1) * (0.92 + 0.08 * fl), '#ff8a2a');
  }
  // The burning wrecks' columns light their feet too, while their fires are in.
  for (const c of W.cols) {
    const age = now - c.t0;
    if (age > 30 || !inView(c.x, c.y, 3)) continue;
    const fl = 0.75 + 0.25 * Math.sin(now * 9 + c.sd) * Math.sin(now * 3.1 + c.sd);
    ctx.globalAlpha = Math.min(1, 0.6 * clamp(1 - age / 30, 0, 1) * fl * Math.min(1, c.s));
    drawLightPool(ctx, ox + c.x * z, oy + c.y * z, z * 1.5 * Math.min(1.25, c.s), '#ff7a24');
  }
  ctx.globalAlpha = 1;
}

/**
 * The smoke columns: puffs rising from the burning ground, spreading as they climb and leaning further downwind the
 * higher they get, dark and thick low down, paler and thinner up high. Faint just off the ground (so the robots under
 * them show), thinner zoomed in, and fading over the column's last minutes.
 */
function drawWfxColumns(ctx, W, ox, oy, z, inView) {
  const now = S.time, wind = wfxWind(), less = wfxLess(), night = fxNight(), thin = wfxThin(z), air = !wfxAirless(), C = WARFX.col;
  const np = Math.max(8, Math.round(C.puffs * Math.min(1.6, gfx().fx)));
  const lean = clamp(Math.abs(wind.x) / 0.3, 0, 2) * Math.sign(wind.x || 1), drift = wind.y / 0.3;
  const sootA = wfxSmoke(0, night), sootB = wfxSmoke(1, night), pale = wfxSmoke(2, night), ember = fxPool('#ff7a2a');
  let keep = 0;
  for (const c of W.cols) {
    const age = now - c.t0;
    if (age >= c.life) continue;
    W.cols[keep++] = c;
    const Hh = C.height * Math.sqrt(c.s) * (air ? 1 : 0.35);
    if (!inView(c.x + lean * Hh * 0.6, c.y - Hh * 0.5, Hh)) continue;
    // in over its first seconds; out over the last part of its life (it thins and stops reaching so high)
    let k = clamp(age / 3, 0, 1) * Math.pow(clamp((c.life - age) / (c.life * 0.6), 0, 1), 1.2);
    if (c.oil) k = clamp(age / 3, 0, 1) * (0.22 + 0.78 * wfxOilLevel(c.oil)) * clamp((c.life - age) / 40, 0, 1) * (c.oil.out ? clamp(1 - (now - c.oil.out) / 3, 0, 1) : 1); // (thick while the well burns, a thin smoulder after)
    const top = 0.45 + 0.55 * k;
    if (k < 0.01) continue;
    const lift = c.oil ? WARFX.oil[c.oil.kind].jet * 0.8 * wfxOilLevel(c.oil) : 0; // (a burning well's smoke pours off the top of its flame)
    const x0 = ox + (c.x + lift * lean * 0.12) * z, y0 = oy + (c.y - lift) * z, rate = (less ? 0.03 : 0.055) / Math.sqrt(c.s), w0 = Math.sqrt(c.s);
    const lit = age < 60 ? clamp(1 - age / 60, 0, 1) * (0.15 + 0.6 * night) : 0; // (lit orange from under by the fire while it burns)
    for (let n = 0; n < np; n++) {
      const ph = ((now * rate + n / np + c.sd * 0.0137) % 1) * top, h = hash2(c.sd, n, 3);
      const up = Math.pow(ph, 0.8) * Hh, spread = (h - 0.5) * (0.3 + 2.6 * ph) * w0;
      const px = x0 + (lean * Math.pow(ph, 1.6) * Hh * 0.8 + spread + Math.sin(now * 0.3 + n * 1.7 + c.sd) * 0.15 * ph) * z;
      const py = y0 - (up - drift * ph * ph * Hh * 0.25) * z;
      const s = z * (0.7 + 2.9 * Math.sqrt(ph)) * w0 * (0.8 + 0.4 * hash2(c.sd, n, 4));
      // faint just off the ground (the robots under it show through, more so zoomed in), thinning out high up
      const foot = clamp(ph / 0.14, 0.12, 1), low = ph < 0.35 ? thin + (1 - thin) * (ph / 0.35) : 1;
      const a = k * foot * low * Math.pow(1 - ph / top, 0.9) * (c.dark ? 0.95 : 0.8) * (less ? 0.85 : 1);
      if (a < 0.01) continue;
      ctx.globalAlpha = Math.min(1, a);
      if (lit > 0.02 && ph < 0.4) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, a * lit * (1 - ph / 0.4)); ctx.drawImage(ember, px - s * 0.4, py - s * 0.36, s * 0.8, s * 0.72); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = Math.min(1, a); }
      ctx.drawImage(ph < 0.2 || (c.dark && ph < 0.5) ? (n & 1 ? sootA : sootB) : ph < 0.42 ? (n & 1 ? sootB : pale) : pale, px - s / 2, py - s * 0.45, s, s * 0.9);
    }
    // the fire at its foot lights the smoke from under it while it burns (at night most)
    if (age < 40) {
      const fk = clamp(1 - age / 40, 0, 1) * (0.25 + 0.75 * night);
      fxGlow(ctx, x0, y0 - 0.5 * z, z * 1.0 * w0, '#ff7a2a', 0.45 * fk);
    }
  }
  W.cols.length = keep;
  ctx.globalAlpha = 1;
}

/**
 * A soft billow of smoke (cached per kind and darkness step): 0 and 1 sooty, 2 paler grey high up; lumpy, not a
 * perfect disc, and shaded darker at night (it doesn't glow).
 */
function wfxSmoke(kind, night) {
  const lit = typeof duskSmokeRgb === 'function' ? duskSmokeRgb() : null; // (lit by the sunset: js/sunset.js)
  const step = Math.round(night * 4), key = kind + ':' + step + ':' + (lit || '');
  if (!R.wfxSmoke || Object.keys(R.wfxSmoke).length > 80) R.wfxSmoke = {}; // (the sunset tints a few more: kept few)
  if (R.wfxSmoke[key]) return R.wfxSmoke[key];
  const n = 64, c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d');
  const base = kind === 2 ? [176, 171, 164] : kind === 1 ? [104, 98, 92] : [56, 52, 49], dk = step / 4 * 0.5;
  const col = base.map((v) => Math.round(v * (1 - dk) + 14 * dk)).join(',');
  for (let b = 0; b < 5; b++) {
    const bx = n / 2 + (hash2(kind, b, 1) - 0.5) * n * 0.32, by = n / 2 + (hash2(kind, b, 2) - 0.5) * n * 0.26, r = n * (0.24 + 0.1 * hash2(kind, b, 3));
    const gr = g.createRadialGradient(bx, by, 0, bx, by, r);
    gr.addColorStop(0, `rgba(${col},0.55)`); gr.addColorStop(0.6, `rgba(${col},0.3)`); gr.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, n, n);
  }
  // a lighter top where the sky catches it (by day)
  if (step < 3 || lit) {
    const top = lit || '210,205,198', a = lit ? 0.3 : 0.16 * (1 - step / 3);
    const gr = g.createRadialGradient(n * 0.45, n * 0.36, 0, n * 0.45, n * 0.36, n * 0.3);
    gr.addColorStop(0, `rgba(${top},${a})`); gr.addColorStop(1, `rgba(${top},0)`);
    g.globalCompositeOperation = 'source-atop'; g.fillStyle = gr; g.fillRect(0, 0, n, n);
  }
  return (R.wfxSmoke[key] = c);
}

/**
 * Ash and embers over the fighting: grey flakes drifting downwind and slowly settling, and embers floating up and
 * winking out (glowing at night), thinning as the cell cools. Fewer zoomed in, and slower to reduce motion.
 */
function drawWfxAsh(ctx, W, ox, oy, z, inView) {
  const A = WARFX.ash, now = S.time, wind = wfxWind(), less = wfxLess(), night = fxNight(), thin = wfxThin(z);
  const list = [];
  for (const [key, a] of W.ash) { const left = wfxAshLeft(a); if (left <= 0.01) { W.ash.delete(key); continue; } if (inView(a.x, a.y, A.cell)) list.push([a, left]); }
  if (!list.length) return;
  const most = wfxMost(A.max);
  if (list.length > most) list.sort((p, q) => q[1] - p[1]).length = most;
  const n0 = Math.max(4, Math.round(A.specks * gfx().fx * (less ? 0.5 : 1))), speed = less ? 0.5 : 1, s0 = Math.max(1, z * 0.045);
  ctx.save();
  for (const [a, left] of list) {
    const hot = clamp(1 - (now - a.t) / A.embers, 0, 1), n = Math.round(n0 * Math.sqrt(left));
    for (let i = 0; i < n; i++) {
      const L = 7 + 7 * hash2(a.sd, i, 1), ph = ((now * speed) / L + hash2(a.sd, i, 2)) % 1;
      const bx = a.x + (hash2(a.sd, i, 3) - 0.5) * A.cell * 0.9, by = a.y + (hash2(a.sd, i, 4) - 0.5) * A.cell * 0.7;
      const ember = i % 3 === 0;
      if (ember && hot <= 0.02) continue;
      // lift: embers rise; ash lifts a little and settles, lower as the cell cools
      const lift = ember ? ph * 2.2 : Math.sin(ph * Math.PI) * 1.3 * (0.35 + 0.65 * left);
      const wx = bx + wind.x * ph * L * 0.6 + Math.sin(ph * 6.3 + i) * 0.25, wy = by + wind.y * ph * L * 0.6 - lift + (ember ? 0 : ph * 0.5);
      const x = ox + wx * z, y = oy + wy * z;
      if (ember) {
        const fl = 0.6 + 0.4 * Math.sin(now * 13 + i * 3.1);
        const al = hot * Math.sin(ph * Math.PI) * fl * (0.55 + 0.45 * night);
        if (al < 0.02) continue;
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = Math.min(1, al);
        ctx.fillStyle = i % 2 ? '#ffb347' : '#ff7a2a';
        ctx.fillRect(x - s0 * 0.6, y - s0 * 0.6, s0 * 1.2, s0 * 1.2);
        if (night > 0.3 && gfxStep() !== 'saver') fxGlow(ctx, x, y, s0 * 4, '#ff8a2a', al * 0.5 * night);
      } else {
        const al = left * thin * 0.7 * Math.min(1, ph * 6, (1 - ph) * 3);
        if (al < 0.02) continue;
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = al;
        ctx.fillStyle = fxDim(i % 2 ? '#8e8a86' : '#5d5955');
        const tw = Math.abs(Math.sin(now * 2 + i)) * 0.7 + 0.3;
        ctx.fillRect(x - s0 * 0.8, y - s0 * 0.4 * tw, s0 * 1.6, s0 * 0.8 * tw);
      }
    }
  }
  ctx.restore();
}

/**
 * The flash of a big blast: a burst of light over the whole area round it, and over the whole screen for a moment,
 * by the blast's size and how near the middle of the screen it is (brighter at night). Never with reduced motion.
 */
function drawWfxFlash(ctx, W, ox, oy, z) {
  const night = fxNight();
  let keep = 0, screen = 0;
  for (const f of W.flash) {
    const q = (S.time - f.t0) / f.dur;
    if (q >= 1) continue;
    W.flash[keep++] = f;
    if (q < 0) continue;
    const x = ox + f.x * z, y = oy + f.y * z, a = Math.pow(1 - q, 2), size = clamp(f.r / 6, 0.2, 1);
    fxGround(ctx, x, y, z * f.r * 6, '#ffe2b0', 1.4 * a * size);
    const d = Math.hypot(x - R.w / 2, y - R.h / 2) / Math.max(R.w, R.h);
    if (!f.lit) screen = Math.max(screen, WARFX.shock.flash * a * size * (0.35 + 0.65 * night) * clamp(1.3 - d * 1.4, 0, 1));
  }
  W.flash.length = keep;
  if (screen > 0.005) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(0.6, screen);
    ctx.fillStyle = '#fff1d6';
    ctx.fillRect(0, 0, R.w, R.h);
    ctx.restore();
  }
}

/* ------------------------------------------------------------------ burning oil */

/**
 * An oil well (or a Refinery, a Fuel Tank) destroyed by force at (x, y): it burns. Its own column of black smoke (never
 * joined with another), fires creeping over the scorched ground round it, and ash.
 */
function wfxOil(W, x, y, kind) {
  const O = WARFX.oil[kind], i = Math.floor(x), j = Math.floor(y);
  if (!O || !inMap(i, j) || W.oil.some((e) => e.i === i && e.j === j && !e.out)) return;
  const e = { x, y: y + 0.05, i, j, kind, t0: S.time, sd: (W.n++ * 13 + i * 7 + j * 3) % 997, out: 0 };
  W.oil.push(e);
  W.cols.push({ x: e.x, y: e.y, s: O.smoke, t0: S.time, life: O.burn + O.smoulder * 0.45, sd: e.sd, dark: true, oil: e });
  wfxIgnite(W, x, y, 3, e.sd);
  wfxAsh(W, x, y, 3);
  if (W.oil.length > 12) W.oil.shift();
}

/** How fiercely burning oil e burns now, 0..1: up in a second, steady (with a roar's surges), guttering and sputtering out over its last seconds; 0 smouldering. */
function wfxOilLevel(e) {
  const O = WARFX.oil[e.kind], age = S.time - e.t0, out = e.out ? clamp(1 - (S.time - e.out) / 3, 0, 1) : 1;
  if (age < 0 || age >= O.burn) return 0;
  let k = Math.min(1, age / 1.2);
  const left = O.burn - age;
  if (left < O.gutter) { const q = Math.pow(left / O.gutter, 0.6); k *= q * (0.55 + 0.45 * Math.max(0, Math.sin(S.time * 3.1 + e.sd) * Math.sin(S.time * 7.7 + e.sd * 2))) + 0.08 * q; }
  return k * out;
}
/** Is burning oil e over (smouldered out, or put out by a building on its spot)? */
function wfxOilGone(e) {
  const O = WARFX.oil[e.kind];
  if (!e.out && S.bAt[tIdx(e.i, e.j)]) e.out = S.time; // (built over: put out)
  return (e.out && S.time - e.out > 3) || S.time - e.t0 > O.burn + O.smoulder;
}
/** How much of burning oil e's ruin is left to see, 0..1 (fading over its last 30 s, or as it's built over). */
function wfxOilRuin(e) {
  const O = WARFX.oil[e.kind], end = e.out ? e.out + 3 : e.t0 + O.burn + O.smoulder;
  return clamp((end - S.time) / (e.out ? 3 : 30), 0, 1);
}

/** A blot of oil-soaked, burnt-black ground (cached): ragged, darkest in the middle. */
function wfxSootBlot() {
  if (R.wfxSoot) return R.wfxSoot;
  const n = 96, c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d');
  for (let b = 0; b < 9; b++) {
    const a = b * 0.7, d = b ? n * (0.1 + 0.14 * hash2(b, 3, 5)) : 0, bx = n / 2 + Math.cos(a) * d, by = n / 2 + Math.sin(a) * d, r = n * (0.18 + 0.12 * hash2(b, 4, 5));
    const gr = g.createRadialGradient(bx, by, 0, bx, by, r);
    gr.addColorStop(0, 'rgba(14,11,10,0.85)'); gr.addColorStop(0.7, 'rgba(22,17,14,0.45)'); gr.addColorStop(1, 'rgba(22,17,14,0)');
    g.fillStyle = gr; g.fillRect(0, 0, n, n);
  }
  return (R.wfxSoot = c);
}

/**
 * Under the robots: the burnt-black ground round burning oil, and its ruin: a well's charred wellhead with its
 * pumpjack's beam fallen across it, or a tank's burst, blackened shell (glowing red while it's hot, at night).
 */
function drawWfxOilGround(ctx, W, ox, oy, z, inView) {
  const blot = wfxSootBlot(), night = fxNight();
  let keep = 0;
  for (const e of W.oil) {
    if (wfxOilGone(e)) continue;
    W.oil[keep++] = e;
    const O = WARFX.oil[e.kind], left = wfxOilRuin(e);
    if (!inView(e.x, e.y, 3) || left <= 0) continue;
    const x = ox + e.x * z, y = oy + e.y * z, r = O.soot * z, age = S.time - e.t0;
    ctx.globalAlpha = 0.9 * left * clamp(age / 2, 0, 1);
    ctx.drawImage(blot, x - r, y - r * 0.7, r * 2, r * 1.4);
    ctx.globalAlpha = left;
    const hot = clamp(1 - (age - O.burn) / 60, 0, 1); // (glowing for a minute after the flame dies)
    ctx.save(); ctx.translate(x, y);
    if (e.kind === 'pump') {
      // the beam of the pumpjack, fallen and charred, and the wellhead's stump with its flange
      ctx.rotate((hash2(e.sd, 1, 1) - 0.5) * 1.2);
      ctx.fillStyle = '#1b1715'; ctx.fillRect(-z * 0.55, z * 0.08, z * 0.95, z * 0.09);
      ctx.fillStyle = '#2a2420'; ctx.fillRect(-z * 0.5, z * 0.08, z * 0.85, z * 0.03);
      ctx.rotate(-(hash2(e.sd, 1, 1) - 0.5) * 1.2);
      ctx.fillStyle = '#171312'; ctx.beginPath(); ctx.ellipse(0, 0, z * 0.17, z * 0.1, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#0c0a09'; ctx.fillRect(-z * 0.07, -z * 0.16, z * 0.14, z * 0.17);
      ctx.fillStyle = '#3a312b'; ctx.beginPath(); ctx.ellipse(0, -z * 0.16, z * 0.08, z * 0.04, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      // a burst tank's shell: a blackened ring torn open, its roof fallen in
      const R0 = z * (e.kind === 'fueltank' ? 0.42 : 0.34);
      ctx.strokeStyle = '#191513'; ctx.lineWidth = Math.max(2, z * 0.07);
      ctx.beginPath(); ctx.ellipse(0, 0, R0, R0 * 0.62, 0, 0.5 + hash2(e.sd, 2, 1), Math.PI * 2 - 0.3); ctx.stroke();
      ctx.fillStyle = 'rgba(12,10,9,0.8)'; ctx.beginPath(); ctx.ellipse(0, z * 0.02, R0 * 0.8, R0 * 0.45, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#3a302a'; ctx.lineWidth = Math.max(1, z * 0.025);
      ctx.beginPath(); ctx.moveTo(-R0 * 0.6, -R0 * 0.1); ctx.lineTo(R0 * 0.1, R0 * 0.25); ctx.lineTo(R0 * 0.5, -R0 * 0.2); ctx.stroke();
    }
    ctx.restore();
    if (hot > 0 && age > O.burn - 5) {
      // embers in the ruin, red-hot, fading
      const k = hot * (0.35 + 0.65 * night) * left;
      for (let n = 0; n < 4; n++) {
        const fl = 0.6 + 0.4 * Math.sin(S.time * (2.3 + n) + e.sd + n);
        fxGlow(ctx, x + (hash2(e.sd, n, 7) - 0.5) * z * 0.6, y + (hash2(e.sd, n, 8) - 0.5) * z * 0.3, z * 0.12 * (0.8 + 0.4 * fl), '#ff5a1e', k * fl);
      }
    }
  }
  W.oil.length = keep;
  ctx.globalAlpha = 1;
}

/** Burning oil's light: strong, flickering firelight over the land and the buildings round it at dusk and night (the light pool), and a glow by day. */
function drawWfxOilLight(ctx, W, ox, oy, z, inView) {
  const night = fxNight(), t = S.time;
  for (const e of W.oil) {
    const k = wfxOilLevel(e), O = WARFX.oil[e.kind];
    if (k <= 0.01 || !inView(e.x, e.y, 8)) continue;
    const x = ox + e.x * z, y = oy + e.y * z, fl = 0.78 + 0.22 * Math.sin(t * 13 + e.sd) * Math.sin(t * 5.3 + e.sd * 0.7) + 0.06 * Math.sin(t * 31 + e.sd);
    fxGround(ctx, x, y, z * O.jet * 1.6 * (0.9 + 0.1 * fl), '#ff8a2a', 0.9 * k * fl * (1 - 0.65 * night));
    if (night > 0.02) {
      ctx.globalAlpha = Math.min(1, 0.7 * k * fl);
      drawLightPool(ctx, x, y - z * 0.3, z * O.jet * 1.25 * (0.94 + 0.06 * fl), '#ff8a2a');
      ctx.globalAlpha = Math.min(1, 0.4 * k * fl);
      drawLightPool(ctx, x, y, z * O.jet * 2.4, '#ff6a1c');
    }
  }
  ctx.globalAlpha = 1;
}

/**
 * The flame: a roaring jet of fire from the wellhead, white-hot at its foot, tongues of flame tearing up its length,
 * leaning with the wind toward the top and breaking into sooty orange where the black smoke takes it. A tank's is a
 * lower, wider wall of flame.
 */
function drawWfxOil(ctx, W, ox, oy, z, inView) {
  const img = wfxFlame(), wind = wfxWind(), lean = clamp(wind.x / 0.3, -2, 2), t = S.time, less = wfxLess();
  for (const e of W.oil) {
    const k = wfxOilLevel(e), O = WARFX.oil[e.kind];
    if (k <= 0.01 || !inView(e.x, e.y, O.jet + 2)) continue;
    const x = ox + e.x * z, y = oy + e.y * z, sp = less ? 0.45 : 1;
    const surge = 0.86 + 0.14 * Math.sin(t * 9 * sp + e.sd) * Math.sin(t * 3.7 * sp + e.sd), H = O.jet * z * k * surge, w0 = O.w * z * (0.7 + 0.3 * k);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // the body of the jet: one long tongue of fire the whole height, swaying at its top, under the tongues tearing up it
    ctx.globalAlpha = Math.min(1, 0.9 * k);
    ctx.save(); ctx.translate(x, y); ctx.transform(1, 0, -lean * 0.07 + Math.sin(t * 5 * sp + e.sd) * 0.04, 1, 0, 0);
    ctx.drawImage(img, -w0 * 0.75, -H * 1.05, w0 * 1.5, H * 1.1);
    ctx.drawImage(img, -w0 * 0.4, -H * 0.75, w0 * 0.8, H * 0.8);
    ctx.restore();
    const M = Math.max(7, Math.round(11 * Math.min(1.5, gfx().fx)));
    for (let m = 0; m < M; m++) {
      const q = ((m / M) + (t * 1.6 * sp + hash2(e.sd, m, 1)) % 1 / M), h = hash2(e.sd, m, 2);
      const cy = y - q * H, cx = x + lean * q * q * H * 0.14 + Math.sin(t * 11 * sp + m * 2.3 + e.sd) * w0 * 0.12 * q;
      const fw = w0 * (1.05 - 0.55 * q) * (0.8 + 0.4 * h), fh = H * (0.42 - 0.12 * q) * (0.8 + 0.4 * hash2(e.sd, m, 3));
      ctx.globalAlpha = Math.min(1, (0.9 - 0.45 * q) * Math.min(1, k * 1.4));
      ctx.drawImage(img, cx - fw / 2, cy - fh * 0.75, fw, fh);
    }
    // the white-hot heart of it at the wellhead, and its glow
    fxGlow(ctx, x, y - H * 0.18, w0 * 1.3, '#ffd27a', 0.6 * k);
    fxGlow(ctx, x, y - H * 0.5, H * 0.75, '#ff7a2a', 0.45 * k * surge * (1 - 0.4 * fxNight()));
    ctx.restore();
    // soot torn off the top of the flame into the column
    const puff = wfxSmoke(0, fxNight());
    for (let n = 0; n < 4; n++) {
      const ph = (t * 0.9 * sp + n / 4 + e.sd * 0.01) % 1, s = w0 * (1 + 1.6 * ph);
      ctx.globalAlpha = 0.75 * k * Math.sin(ph * Math.PI);
      ctx.drawImage(puff, x + lean * H * 0.14 + lean * ph * z * 0.5 - s / 2, y - H * (0.85 + 0.25 * ph) - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
  }
}

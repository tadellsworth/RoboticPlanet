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
 *   robot's wreck), and over the minutes that follow it is taken back, by biome: grass, moss and vines in the green
 *   biomes, drifting snow in the Polar Caps, sand in the Rust, ash in the Cinderlands, violet Bloom growth in the Bloom and the
 *   Hollow, only dust on Argos. They are found in the game's effects as they happen (a building's collapse with its fire,
 *   a wreck's fire) and kept in R: they don't outlive a save and load. They never stand in the way of anything, and go
 *   the moment a building or site, a road or track takes their tile. An aircraft's wreck is the game's own (S.wrecks, see
 *   crashLand: it stays for the rest of the game): its broken airframe is drawn here (ambWreckArt), smouldering a while,
 *   and it overgrows the same way, slowly, never going back into the ground.
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
  // has gone back into the ground. b: a building, u: a robot or vehicle, p: an aircraft's wreck (S.wrecks: it stays for
  // good, overgrowing slowly; `smoulder`: seconds it smokes once its fires are out, `embers`: seconds it glows after
  // dark). (max: kept at once, the wrecks apart.)
  ruin: { max: 400, b: [60, 480, 1200, 1500], u: [30, 300, 720, 900], p: [60, 1200, Infinity, Infinity], smoulder: 240, embers: 150 },
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
  tropical: { kind: 'green', moss: '#729053', dark: '#3b6341', grass: '#94a75a', vine: '#34653e', n: 0.9 },
  springs: { kind: 'sand', fill: '#c3b397', shade: '#9f875e', hi: '#e1d2ab' },
  lunar: { kind: 'dust', fill: '#a2a4a9', shade: '#6c6e73', slow: 1.6 },
};

/** This game's display-only state for the three touches (made afresh for each game, and for each load). */
function ambState() {
  let A = R.amb;
  if (!A || A.of !== S) {
    if (A) for (const e of A.ruins) ambDrop(A, e); // (the last game's pictures)
    A = R.amb = { of: S, ruins: [], wrecks: new Map(), tick: S ? S.tick : 0, seen: new WeakSet(), prevBots: null, beacons: new Map(), humAt: -99, px: 0, buf: A && A.buf };
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
  let bx0 = bw, by0 = bh, bx1 = 0, by1 = 0; // (what the puffs cover: only that part is laid over the view)
  for (let cj = Math.floor(y0 / cell) - 1; cj <= Math.floor(y1 / cell) + 1; cj++) {
    for (let ci = Math.floor(x0 / cell) - 1; ci <= Math.floor(x1 / cell) + 1; ci++) {
      // Each cell's rank against the cover: more weather, more of them in, each fading in rather than popping.
      const a = clamp((cover - hash2(ci, cj, seed + 601)) / 0.12, 0, 1);
      if (a <= 0) continue;
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
        bx0 = Math.min(bx0, sx - rw); by0 = Math.min(by0, sy - rh); bx1 = Math.max(bx1, sx + rw); by1 = Math.max(by1, sy + rh);
      }
    }
  }
  bx0 = Math.max(0, Math.floor(bx0) - 1); by0 = Math.max(0, Math.floor(by0) - 1); bx1 = Math.min(bw, Math.ceil(bx1) + 1); by1 = Math.min(bh, Math.ceil(by1) + 1);
  if (bx1 <= bx0 || by1 <= by0) return;
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = `rgb(${C.tint})`;
  g.fillRect(bx0, by0, bx1 - bx0, by1 - by0);
  ctx.save();
  ctx.globalAlpha = (C.alpha + C.alphaWx * wx) * sun;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(buf, bx0, by0, bx1 - bx0, by1 - by0, bx0 / k, by0 / k, (bx1 - bx0) / k, (by1 - by0) / k);
  ctx.restore();
}

/* ------------------------------------------------------------------ remains */

/**
 * Look through the effects added since the last frame for anything left behind: a building that collapsed burning
 * (its collapse, with its fire on the same step: taken down on purpose, it only drops its rubble, as ever), a robot's or
 * vehicle's wreck burning. (Effects are added in step order, so the look back stops at older ones.) And the aircraft
 * wrecks (S.wrecks): each new one is taken in, and one that's gone (built over, or its ground changed) is let go.
 */
function ambScan(A) {
  const fx = S.fx || [], from = A.tick - 1;
  for (let n = fx.length - 1; n >= 0; n--) {
    const f = fx[n];
    if (f.tick < from) break;
    if ((f.type !== 'collapse' && f.type !== 'fire') || A.seen.has(f)) continue;
    if (typeof scarLevel === 'function' && scarLevel()) { A.seen.add(f); continue; } // (War scars: the game's own scrap stays instead, baked into the ground)
    A.seen.add(f);
    if (f.type === 'collapse') ambFromBuilding(A, f, fx, n);
    else ambFromFire(A, f);
  }
  A.tick = S.tick;
  A.prevBots = S.bots; // (the step that tidies dead robots away makes a new list: this one still has them)
  ambWrecks(A);
}

/**
 * The aircraft wrecks (S.wrecks, kept by the game itself: see crashLand) as remains: one for each, from when it came down
 * (so a loaded game's wrecks have grown as far as they had), its growth spread in patches along the hull.
 */
function ambWrecks(A) {
  const W = S.wrecks || [];
  if (!W.length && !A.wrecks.size) return;
  const ids = new Set();
  for (const w of W) {
    ids.add(w.id);
    if (A.wrecks.has(w.id)) continue;
    const C = typeof airCrash === 'function' ? airCrash(w.type) : { len: 1.5 }, len = C.len || 1.5;
    const e = { k: 'p', w, x: w.x, y: w.y, t0: w.t, t: tIdx(Math.floor(w.x), Math.floor(w.y)), len, r: 0.22 + 0.1 * len, s: w.id % 997, size: len, owner: w.owner, decal: null, life: 150, burn: 150 };
    A.wrecks.set(w.id, e);
    A.ruins.push(e);
  }
  if (A.wrecks.size > ids.size) for (const [id, e] of A.wrecks) if (!ids.has(id)) { A.wrecks.delete(id); e.gone = true; }
}

/** The burnt ground under wreck remains e (screen x, y), long down the way it came in and back along its skid; it fades as the growth takes it. */
function ambWreckBurn(ctx, e, x, y, z, g, smudge) {
  const a = 0.62 * (1 - 0.75 * g);
  if (a < 0.02) return;
  const L = e.len * z * 1.45, W = (0.9 + 0.25 * e.len) * z;
  ctx.save();
  ctx.translate(x, y); ctx.rotate(e.w.a);
  ctx.globalAlpha = a;
  ctx.drawImage(smudge[e.s % smudge.length], -L / 2, -W / 2, L, W);
  ctx.globalAlpha = a * 0.7;
  ctx.drawImage(smudge[(e.s + 1) % smudge.length], -L * 0.95, -W * 0.3, L * 0.7, W * 0.6); // (the gouge it skidded along)
  ctx.restore();
}

/**
 * The broken airframe of wreck w, centred on (x, y) on screen, turned the way it came in: its art ('wreck-<type>',
 * renderer/b/wreck.js; re-lit for the time of day by drawArt), drawn its own size (the art's scale is its width in
 * tiles). An aircraft with no art of its own: its outline broken in two, charred black.
 */
function ambWreckArt(ctx, w, x, y, z) {
  const art = typeof artFor === 'function' ? artFor('wreck-' + w.type, w.owner) : null;
  if (art) { drawArt(ctx, art, x, y, z, w.a); return; }
  const Lp = (airCrash(w.type).len * z) / 0.97; // (planeOutline's length: the hull is 0.97 of it)
  ctx.save();
  ctx.translate(x, y); ctx.rotate(w.a);
  ctx.fillStyle = 'rgba(30,26,23,0.94)';
  for (const [x0, x1, dx, turn] of [[-0.05, 1, 0.06, 0.14], [-1, -0.05, -0.03, -0.09]]) {
    ctx.save();
    ctx.beginPath(); ctx.rect(x0 * Lp, -Lp, (x1 - x0) * Lp, 2 * Lp); ctx.clip();
    ctx.translate(dx * Lp, 0); ctx.rotate(turn);
    planeOutline(ctx, Lp); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

/**
 * A fresh wreck smouldering: once its fires are out, thin grey smoke still rises off a few places along the hull and
 * drifts with the wind (`wind`, as the growth's), thinning out over AMB.ruin.smoulder s; after dark its embers glow
 * for AMB.ruin.embers s, dimming.
 */
function ambSmoulder(ctx, e, x, y, z, age, wind) {
  const k = Math.min(1, age / 10) * (1 - age / AMB.ruin.smoulder), ca = Math.cos(e.w.a), sa = Math.sin(e.w.a), puff = fxPuff(false), n = gfxStep() === 'saver' ? 2 : 3;
  for (let j = 0; j < n; j++) {
    const o = (hash2(e.s, j, 801) - 0.5) * e.len * 0.7, bx = x + ca * o * z, by = y + sa * o * z;
    for (let i = 0; i < 4; i++) {
      const ph = (S.time * 0.2 + i / 4 + hash2(e.s, j, 802)) % 1, sz = z * (0.14 + 0.5 * ph);
      ctx.globalAlpha = 0.34 * k * Math.sin(ph * Math.PI);
      ctx.drawImage(puff, bx + ph * z * 0.45 * wind + Math.sin(ph * 5 + j) * z * 0.06 - sz / 2, by - ph * z * 1.7 - sz / 2, sz, sz);
    }
  }
  const night = TOD.active ? TOD.state.lights : 0, ek = 1 - age / AMB.ruin.embers;
  if (night > 0.05 && ek > 0) {
    for (let j = 0; j < 7; j++) {
      const o = (hash2(e.s, j, 803) - 0.5) * e.len * 0.85, side = (hash2(e.s, j, 804) - 0.5) * 0.35, fl = 0.6 + 0.4 * Math.sin(R.time * (2 + j) + j * 1.7);
      fxGlow(ctx, x + (ca * o - sa * side) * z, y + (sa * o + ca * side) * z, z * (0.1 + 0.07 * fl), '#ff7a2a', Math.min(1, night * ek * fl * 1.1));
    }
  }
  ctx.globalAlpha = 1;
}

/**
 * An aircraft's wreck after dark, lit faintly so it shows at night (the owner's call): a few small flames still licking
 * at the broken hull, the firelight on the ground round it, and one light at its end still blinking on its own power.
 * The flames come in as the fresh wreck's embers die (ambSmoulder) and dwindle to one as it overgrows; the light and
 * the glow stay for good. Seeded by the wreck (e.s), so a wreck keeps its look; nothing here touches the game.
 */
function ambWreckNight(ctx, e, x, y, z, age, g) {
  const night = TOD.active ? TOD.state.lights : 0;
  if (night < 0.05) return;
  const ca = Math.cos(e.w.a), sa = Math.sin(e.w.a), t = R.time;
  const come = clamp(age / AMB.ruin.embers, 0, 1), nf = g > 0.75 ? 1 : g > 0.4 ? 2 : 3, small = 1 - 0.35 * g;
  fxGround(ctx, x, y, z * (0.8 + 0.45 * e.len), '#ff8a2a', 0.3 * night * (0.5 + 0.5 * come));
  fxGlow(ctx, x, y, z * (0.45 + 0.4 * e.len), '#ff9a4a', 0.16 * night * (0.6 + 0.4 * come)); // (the firelight on the hull itself)
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let j = 0; j < nf; j++) {
    const o = (hash2(e.s, j, 811) - 0.5) * e.len * 0.6, side = (hash2(e.s, j, 812) - 0.5) * 0.3;
    const bx = x + (ca * o - sa * side) * z, by = y + (sa * o + ca * side) * z;
    const fl = 0.72 + 0.28 * Math.sin(t * (7 + j * 1.9) + j * 2.3) * Math.sin(t * (3.1 + j) + j), a = night * come * 0.9;
    const hgt = z * 0.27 * fl * small, w = z * 0.075 * small;
    const gr = ctx.createLinearGradient(bx, by, bx, by - hgt);
    gr.addColorStop(0, `rgba(255,236,180,${0.8 * a})`); gr.addColorStop(0.4, `rgba(255,150,50,${0.65 * a})`); gr.addColorStop(1, 'rgba(255,60,10,0)');
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.moveTo(bx - w, by); ctx.quadraticCurveTo(bx - w * 0.9, by - hgt * 0.55, bx + Math.sin(t * 6 + j) * w * 0.5, by - hgt);
    ctx.quadraticCurveTo(bx + w * 0.9, by - hgt * 0.55, bx + w, by); ctx.closePath(); ctx.fill();
    fxGlow(ctx, bx, by - hgt * 0.3, z * 0.3 * fl * small, '#ff7a2a', 0.65 * a);
  }
  ctx.restore();
  // the light still blinking at one end: a short red flash every 2.4 s, a faint glow between
  const end = e.len * 0.42 * (hash2(e.s, 9, 813) < 0.5 ? 1 : -1), lx = x + ca * end * z, ly = y + sa * end * z;
  const ph = ((t + hash2(e.s, 9, 814) * 2.4) % 2.4) / 2.4, on = ph < 0.14 ? Math.sin((ph / 0.14) * Math.PI) : 0;
  fxGlow(ctx, lx, ly, z * (0.1 + 0.12 * on), '#ff3b30', night * (0.45 + 0.55 * on));
  if (on > 0.3) fxGlow(ctx, lx, ly, z * 0.04, '#ffd0c8', night * on); // (its bright core as it flashes)
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
  // (too many: the oldest go, but never an aircraft's wreck: the game keeps those, and lets them go itself)
  if (A.ruins.length > AMB.ruin.max + A.wrecks.size) {
    let over = A.ruins.length - AMB.ruin.max - A.wrecks.size;
    A.ruins = A.ruins.filter((o) => { if (over > 0 && !o.w) { over--; ambDrop(A, o); return false; } return true; });
  }
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

/** A wreck's fire: a robot's or vehicle's (killBot). (An aircraft's is the game's own wreck: see ambWrecks.) */
function ambFromFire(A, f) {
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
 * The painter: the pieces of a picture of remains (and the specks and glows drawn over the view) are gathered into one
 * path per layer and strength (eight steps of opacity), and each is filled or stroked once, layer by layer.
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
  // Built, paved or laid over (a site, a road, track), or gone back into the ground: let go. (An aircraft's wreck goes
  // when the game lets it go, and isn't drawn from the moment something is built over it.)
  let w = 0;
  for (const e of A.ruins) {
    if (e.w ? !e.gone && wreckStands(e.w) : now - e.t0 < AMB.ruin[e.k][3] * slow && ambGround(e.t)) A.ruins[w++] = e;
    else { ambDrop(A, e); if (e.w && !e.gone) A.wrecks.delete(e.w.id); }
  }
  A.ruins.length = w;
  const shown = [];
  for (const e of A.ruins) { if (inView(e.x, e.y, e.w ? 1 + e.len : 2)) shown.push(e); else if (e.spr && R.time - e.seen > 20) ambDrop(A, e); }
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
    const fade = e.w ? 1 : 1 - clamp((age - T[2] * slow) / ((T[3] - T[2]) * slow), 0, 1);
    const g = ambStep(clamp((age - T[0] * slow) / ((T[1] - T[0]) * slow), 0, 1), 0, 1);
    const x = ox + e.x * z, y = oy + e.y * z;
    // An aircraft's wreck: the burnt ground under it, its broken airframe (the art, turned the way it came in), and
    // over it, as it overgrows, the growth (a sprite like any remains', in patches along the hull); smoke and embers while
    // it's fresh. Zoomed far out, a speck.
    if (e.w) {
      if (e.len * z < 7) { dots.push(e, 1, g); continue; }
      ambWreckBurn(ctx, e, x, y, z, g, smudge);
      ctx.globalAlpha = 1;
      ambWreckArt(ctx, e.w, x, y, z);
      if (Math.round(g * 12) > 0) {
        e.seen = R.time;
        const gq = Math.round(g * 12), res = Math.min(most, res0, 96);
        const pick = (name) => {
          const sp = e.spr && e.spr[name];
          if (sp && sp.gq === gq && sp.res === res && sp.wind === wind) return sp;
          if (sp && performance.now() - t0 > budget) return sp;
          return ambSprite(A, e, name, res, gq, G, wind, true);
        };
        const a = pick(ka), b = kb ? pick(kb) : null;
        if (e.spr) for (const name in e.spr) if (name !== ka && name !== kb) ambFree(A, e.spr[name]), delete e.spr[name];
        const put = (sp, k) => { const q = z / sp.res; ctx.globalAlpha = k; ctx.drawImage(sp.c, x - sp.cx * q, y - sp.cy * q, sp.c.width * q, sp.c.height * q); };
        const ga = G.kind === 'green' || G.kind === 'bloom' ? 1 : 0.8; // (drifts thinner over a wreck: it still shows)
        if (b) { put(late ? b : a, ga); if (over > 0.002) put(late ? a : b, ga * over); } else put(a, ga);
        if (a.nodes) glows.push(x, y, z / a.res, 1, a.nodes);
      }
      if (age < AMB.ruin.smoulder) ambSmoulder(ctx, e, x, y, z, age, wind);
      ambWreckNight(ctx, e, x, y, z, age, g);
      continue;
    }
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
  // (as big as what's drawn can reach: wide for a drift's tail, less tall, as everything on the ground is seen at a slant;
  // an aircraft's wreck, whichever way it lies: its length and the growth's reach round it, both ways)
  const R0 = e.r * (e.k === 'b' ? 1 : 1.6), ext = e.w ? Math.ceil(2 * (e.len * 0.42 + R0 * 1.3) * res) : 0;
  const nw = ext || Math.max(4, Math.ceil(2 * R0 * (e.k === 'u' ? 1.75 : 2.05) * res)), nh = ext || Math.max(4, Math.ceil(2 * R0 * (e.k === 'u' ? 1.2 : 1.35) * res));
  const c = old ? old.c : document.createElement('canvas');
  if (old) A.px -= c.width * c.height;
  if (c.width !== nw || c.height !== nh) { c.width = nw; c.height = nh; } else c.getContext('2d').clearRect(0, 0, nw, nh);
  A.px += nw * nh;
  const col = (h) => ambGrade(h, name), u = R.dpr || 1, cx = nw / 2, cy = e.w ? nh / 2 : nh * 0.55, r = e.r * res;
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
  if (e.w) { // an aircraft's wreck: only the growth, in patches along its hull (the wreck and its burn are drawn under it;
    // a drift of snow, sand, ash or dust in two, so the wreck still shows through)
    const drift = G.kind !== 'green' && G.kind !== 'bloom', big = e.len > 1.8;
    const ca = Math.cos(e.w.a), sa = Math.sin(e.w.a), nodes = [];
    const offs = drift ? (big ? [-0.3, 0, 0.3] : [-0.2, 0.2]) : big ? [0, -0.22, 0.22, -0.42, 0.42] : [0, -0.3, 0.3];
    offs.forEach((o, k) => { const n = ambGrowth(P, G, { k: 'p', s: e.s + k * 37 }, cx + ca * o * e.len * res, cy + sa * o * e.len * res, r, g * (G.kind === 'dust' ? 0.7 : 1), lod, wind); if (n) nodes.push(...n); });
    ambPaint(x, P);
    const sp = { c, cx, cy, res, gq, wind, burnt, nodes: nodes.length ? nodes.map((v, k) => (k % 3 === 2 ? v : v - (k % 3 ? cy : cx))) : null };
    (e.spr || (e.spr = {}))[name] = sp;
    return sp;
  }
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
  // A robot's or a vehicle's wreckage: dark pieces scattered where it fell, one with a fleck of its colony's paint. (An
  // aircraft's wreck is its own art: see ambWreckArt.)
  const n = e.size > 1.2 ? 5 : 4;
  for (let k = 0; k < n; k++) {
    const an = hash2(s, k, 711) * Math.PI * 2, d = r * (0.05 + 0.85 * hash2(s, k, 712)) * (k ? 1 : 0.3), cs = r * (0.22 + 0.22 * hash2(s, k, 713));
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
  env.gain.exponentialRampToValueAtTime(0.045, t0 + 1.3);
  env.gain.setValueAtTime(0.045, t0 + 2.2);
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

const SPRING_PHASE = new Map(), SPRING_HEARD = { at: -99 }; // (render-only: each vent's last phase, for the eruption sound)

/** Local steam and intermittent jets. Vent positions are the same as the baked mineral deposits. */
function drawSpringSteam(ctx, ox, oy, z, v0, v1) {
  if (z < 11 || (LESS_MOTION && LESS_MOTION.matches)) return;
  const night = TOD.active ? TOD.state.lights : 0, cloud = wxCloud(night > 0.65 ? '139,174,188' : '235,242,225');
  const wind = ambWind(Math.floor(S.time / WEATHER.slot)).x, now = R.time;
  const saver = gfxStep() === 'saver', count = saver ? 3 : 7;
  let budget = saver ? 10 : 25;
  ctx.save();
  for (let j = Math.max(0, Math.floor(v0.y) - 1); j < Math.min(S.H, v1.y + 3) && budget > 0; j++) {
    for (let i = Math.max(0, Math.floor(v0.x) - 1); i < Math.min(S.W, v1.x + 1) && budget > 0; i++) {
      const t = tIdx(i, j), kind = S.decor[t];
      if ((kind !== 4 && kind !== 6) || S.bAt[t] || S.road[t] || S.plan[t]) continue;
      if (R.secondRegion && (secondBiomePlant(i, j, S.seed, R.biomeMix[t]) ? R.secondRegion.biome : R.biome) !== 'springs') continue;
      const hx = hash2(i, j, 911), hy = hash2(j, i, 912);
      const x = ox + (i + 0.5 + (hx - 0.5) * 0.1) * z, y = oy + (j + 0.5 + (hy - 0.5) * 0.1) * z;
      const period = 10 + 8 * hx, phase = (now + hy * period) % period;
      // A geyser going off in view is heard (at most one every 1.5 s, louder zoomed in).
      if (kind === 4) {
        const last = SPRING_PHASE.get(t);
        SPRING_PHASE.set(t, phase);
        if (last !== undefined && phase < last && now - SPRING_HEARD.at > 1.5 && typeof geyserSound === 'function') { SPRING_HEARD.at = now; geyserSound(z / 40); }
      }
      const surge = kind === 4 ? ambStep(phase, 0, 0.4) * (1 - ambStep(phase, 1.2, 1.7)) : 0;
      if (surge > 0.02) drawGeyserJet(ctx, x, y, z, surge, now);
      for (let k = 0; k < count; k++) {
        const age = (now * 0.45 + hy + k / count) % 1;
        const width = z * (0.34 + age * (0.72 + surge * 0.41)), height = width * 0.74;
        const px = x + z * (Math.sin(age * 8 + hx * 5) * 0.12 + wind * age), py = y - z * age * (0.75 + surge * 1.2);
        ctx.globalAlpha = Math.sin(age * Math.PI) * (0.33 + surge * 0.30);
        ctx.drawImage(cloud, px - width / 2, py - height / 2, width, height);
      }
      budget--;
    }
  }
  ctx.restore();
}

function drawGeyserJet(ctx, x, y, z, force, time) {
  const rise = z * (0.24 + 1.05 * force), top = y - rise;
  const column = ctx.createLinearGradient(x, top, x, y);
  column.addColorStop(0, 'rgba(213,248,239,0)');
  column.addColorStop(0.36, 'rgba(229,250,242,0.69)');
  column.addColorStop(1, 'rgba(210,244,230,0.74)');
  ctx.globalAlpha = force; ctx.fillStyle = column;
  ctx.beginPath(); ctx.moveTo(x - z * 0.04, y);
  const sway = Math.sin(time * 5) * z * 0.061;
  ctx.bezierCurveTo(x - z * 0.18, y - rise * 0.44, x + sway, y - rise * 0.73, x + sway * 2, top);
  ctx.quadraticCurveTo(x + z * 0.20, y - rise * 0.55, x + z * 0.035, y); ctx.fill();
  ctx.fillStyle = '#e4f9ee';
  for (let k = 0; k < 8; k++) {
    const age = (time * 1.9 + k / 8) % 1, dir = k % 2 ? 1 : -1;
    ctx.globalAlpha = force * Math.sin(age * Math.PI) * 0.8;
    ctx.beginPath();
    ctx.arc(x + dir * age * z * (0.16 + k * 0.025), y - rise * (2.7 * age - 2 * age * age), Math.max(0.6, z * 0.018), 0, Math.PI * 2);
    ctx.fill();
  }
}

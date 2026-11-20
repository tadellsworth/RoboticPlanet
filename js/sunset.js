'use strict';
/*
 * Sunsets and sunrises, for looks only: nothing here changes the game, S, saves or orders, and nothing in it is random
 * (hash2 and the clocks only). It reads the time of day as shown (the cycle's clock, or photo mode's slider: duskClock)
 * and adds a layer over the day-and-night light of js/daynight.js:
 *
 * - The dusk grade. Over the last stretch of day and the first of evening a golden-hour grade comes in, warms through
 *   fire colours and deepens to magenta and violet before night takes over. Sunrise is the same, gentler and cooler:
 *   violet, rose, then a pale gold as the morning light comes on.
 * - Long light. Corvane sets in the west (the evening shadows fall east) and rises in the east, so the ground is lit
 *   from that side of the screen and falls into a cool shade on the far side; the robots' drop shadows stretch longer
 *   and turn violet (todShadow, duskShadowRgb). A soft glare off the sun's side, and on some biomes light shafts.
 * - Each biome its own (DUSK_BIOMES): its palette and its touches, listed there. The Hollow has none (it's underground),
 *   and Argos has no warm sunset at all, only a hard terminator sweeping across the land.
 * - The Ring catches the last light as a faint bright arc low over the top of the view (zoomed out), after the land
 *   has gone into shadow.
 * - Weather mutes it: a storm, a fog or a dust storm takes most of it away while it lasts.
 *
 * Two passes a frame: duskGround over the ground (after it's graded for the time of day, before the buildings, so the
 * buildings, robots and team colours keep their own light) and duskSky over everything standing (before the effects,
 * the selection marks and the HUD), lighter, and fainter zoomed far in. Graphics on Saver keeps just the colour grade;
 * the glare, shafts, motes, glitter, haze and silhouettes are for Auto and up (more motes on High and Ultra). With the
 * device set to reduce motion nothing drifts or twinkles.
 */

/** Where the light changes in the 12-minute day (seconds into it), from the cycle in defs.js: worked out once. */
const DUSK_TIMES = (() => {
  let s = 0;
  const at = {};
  for (const p of TOD_CYCLE) {
    const len = p[p.length - 1] * 60;
    if (p.length === 3) at[p[0] + '-' + p[1]] = [s, s + len];
    s += len;
  }
  const dayEve = at['day-evening'] || [360, 390], eveNight = at['evening-night'] || [480, 510];
  const nightMorn = at['night-morning'] || [690, 720], mornDay = at['morning-day'] || [90, 120];
  // dusk: from 75 s before the day starts turning to evening until night is in; dawn: from the night starting to lift
  // until the morning has turned to day. (Each as [start, full, fading, end].)
  return {
    len: s,
    dusk: [dayEve[0] - 75, dayEve[0] - 30, eveNight[0] + 10, eveNight[1] + 15],
    dawn: [nightMorn[0] - 5, nightMorn[1] - 5, mornDay[0] - 30, mornDay[1] + 10],
  };
})();

/*
 * The palettes, three stops each for dusk (golden hour, fire, violet) and dawn (violet, rose, pale gold): `sun` the
 * light on the sun's side (added as a glare), `tint` the grade over everything (soft light), `shade` the far side's
 * long shadow (multiplied). Touches: glitter (sun on water), motes ('dust', 'spores', 'embers', 'ice', 'pollen'),
 * shafts (light through trees or steam), sil (plants silhouetted), haze (warm haze banks over the ground, rgb),
 * wake (how far a biome's night glow wakes before night: the Bloom, the lava), shimmer (heat haze easing off), k (how
 * strong the grade is), ring (the Ring shows).
 */
const DUSK_DAWN = [
  { sun: [205, 160, 235], tint: [150, 140, 215], shade: [95, 105, 175] },
  { sun: [255, 190, 195], tint: [240, 180, 195], shade: [130, 140, 195] },
  { sun: [255, 232, 185], tint: [255, 226, 190], shade: [170, 182, 212] },
];
const DUSK_BIOMES = {
  // The Rust: deep amber and red, glowing dust, violet shadows; the heat haze eases off.
  desert: {
    dusk: [
      { sun: [255, 186, 100], tint: [255, 158, 78], shade: [168, 118, 152] },
      { sun: [255, 116, 52], tint: [238, 92, 50], shade: [122, 78, 156] },
      { sun: [236, 82, 104], tint: [168, 64, 128], shade: [78, 54, 152] },
    ], motes: 'dust', glitter: 0.5, shimmer: 1, k: 1, ring: true,
  },
  // The Long Grass: amber and red, the acacias black against it, gold dust over the grass.
  savanna: {
    dusk: [
      { sun: [255, 196, 92], tint: [252, 168, 66], shade: [160, 120, 140] },
      { sun: [255, 108, 36], tint: [232, 80, 38], shade: [124, 78, 142] },
      { sun: [226, 76, 84], tint: [154, 58, 116], shade: [84, 58, 140] },
    ], motes: 'dust', glitter: 0.5, sil: 0.45, shimmer: 0.8, k: 1, ring: true,
  },
  // The Shoals: blazing orange and pink, the sea glittering, palms silhouetted, a warm haze over the water.
  tropical: {
    dusk: [
      { sun: [255, 198, 112], tint: [255, 166, 98], shade: [150, 118, 172] },
      { sun: [255, 132, 70], tint: [255, 150, 150], shade: [104, 84, 176] },
      { sun: [255, 96, 140], tint: [214, 104, 178], shade: [72, 60, 168] },
    ], glitter: 1.6, sil: 0.42, k: 1.05, ring: true,
  },
  // The Bloom: no warm sunset. The light goes teal on the sun's side and violet away from it, the Bloom's own light
  // wakes in its veins and plants while the day fades, and spores drift up catching the last of it.
  alien: {
    dusk: [
      { sun: [190, 255, 214], tint: [96, 214, 196], shade: [126, 74, 184] },
      { sun: [96, 236, 238], tint: [52, 178, 196], shade: [104, 52, 182] },
      { sun: [176, 112, 255], tint: [112, 56, 206], shade: [52, 36, 148] },
    ],
    dawn: [
      { sun: [150, 120, 255], tint: [110, 90, 210], shade: [70, 60, 160] },
      { sun: [150, 230, 240], tint: [120, 200, 210], shade: [110, 90, 190] },
      { sun: [215, 255, 225], tint: [200, 240, 220], shade: [160, 160, 210] },
    ], motes: 'spores', glitter: 0.7, wake: 0.85, shafts: 0.5, k: 1.1, ring: true,
  },
  // Greenreach: soft gold through the trees.
  jungle: {
    dusk: [
      { sun: [255, 232, 118], tint: [250, 214, 110], shade: [118, 128, 152] },
      { sun: [255, 196, 90], tint: [240, 160, 96], shade: [100, 92, 150] },
      { sun: [222, 110, 132], tint: [142, 80, 132], shade: [68, 60, 132] },
    ], motes: 'pollen', glitter: 0.4, shafts: 1.6, k: 1, ring: true,
  },
  // Blackwater: a hazy pink fog.
  swamp: {
    dusk: [
      { sun: [255, 204, 172], tint: [240, 172, 168], shade: [138, 128, 150] },
      { sun: [255, 152, 172], tint: [232, 132, 162], shade: [118, 98, 150] },
      { sun: [222, 122, 192], tint: [162, 92, 162], shade: [80, 70, 142] },
    ], glitter: 0.3, haze: [255, 150, 196], hazeK: 2, shafts: 0.4, k: 1, ring: true,
  },
  // Emberwood: rich copper.
  autumn: {
    dusk: [
      { sun: [255, 180, 88], tint: [232, 140, 60], shade: [140, 100, 120] },
      { sun: [255, 118, 48], tint: [204, 88, 40], shade: [110, 70, 112] },
      { sun: [212, 88, 100], tint: [142, 58, 100], shade: [70, 50, 122] },
    ], motes: 'pollen', glitter: 0.4, shafts: 1.2, k: 1, ring: true,
  },
  // The Polar Caps: pastel pink and long blue shadows, the snow glinting.
  polar: {
    dusk: [
      { sun: [255, 222, 204], tint: [255, 200, 204], shade: [146, 168, 232] },
      { sun: [255, 182, 204], tint: [250, 168, 204], shade: [118, 140, 224] },
      { sun: [222, 162, 232], tint: [190, 150, 222], shade: [88, 108, 204] },
    ], motes: 'ice', glitter: 0.5, k: 1.1, ring: true,
  },
  // The Cinderlands: an ember-red sky, fused with the lava's glow (which wakes early), embers rising.
  volcanic: {
    dusk: [
      { sun: [255, 140, 62], tint: [232, 92, 42], shade: [112, 62, 72] },
      { sun: [255, 90, 40], tint: [202, 52, 32], shade: [92, 42, 62] },
      { sun: [222, 60, 60], tint: [142, 30, 52], shade: [62, 30, 62] },
    ], motes: 'embers', wake: 0.6, k: 1, ring: true,
  },
  // Steamwells: the steam plumes lit gold (see drawSpringSteam), light through the steam.
  springs: {
    dusk: [
      { sun: [255, 206, 122], tint: [246, 180, 110], shade: [140, 130, 162] },
      { sun: [255, 150, 100], tint: [236, 130, 112], shade: [110, 100, 162] },
      { sun: [226, 120, 160], tint: [162, 90, 152], shade: [80, 70, 152] },
    ], glitter: 0.5, shafts: 1, k: 0.95, ring: true,
  },
  // Argos: no air, no sunset. The light stays white and hard, and the terminator sweeps across the land.
  lunar: {
    dusk: [
      { sun: [255, 255, 255], tint: [190, 200, 220], shade: [80, 90, 120] },
      { sun: [255, 255, 255], tint: [170, 182, 210], shade: [70, 80, 115] },
      { sun: [255, 255, 255], tint: [150, 164, 200], shade: [60, 70, 110] },
    ], terminator: true, k: 1,
  },
};

const DUSK = { st: null, mix: 0, mixAt: 0, shafts: {}, sil: null, water: null };

/** Seconds into the day of the light as shown, or null where the light doesn't change (Always day or night, the Hollow). */
function duskClock() {
  if (typeof S === 'undefined' || !S || typeof TOD === 'undefined') return null;
  if (S.settings && S.settings.biome === 'hollow') return null;
  if (TOD.over != null && todForced() !== 'night') return ((TOD.over % DUSK_TIMES.len) + DUSK_TIMES.len) % DUSK_TIMES.len;
  if (todMode() !== 'cycle' || todHeld()) return null;
  return ((S.time % DUSK_TIMES.len) + DUSK_TIMES.len) % DUSK_TIMES.len;
}

const duskSmooth = (a, b, x) => { const f = clamp((x - a) / (b - a), 0, 1); return f * f * (3 - 2 * f); };
const duskMixRgb = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
/** A colour made deeper for soft light: its greyness taken out, so it warms (or cools) the land without washing it pale. */
const duskDeep = (c) => { const m = Math.min(c[0], c[1], c[2]) * 0.6; return [c[0] - m, c[1] - m, c[2] - m]; };
const duskRgb = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a === undefined ? 1 : +a.toFixed(3)})`;

/** A palette's colours at stage h (0..1 across its three stops). */
function duskStops(stops, h) {
  const x = clamp(h, 0, 1) * 2, k = Math.min(1, Math.floor(x)), f = x - k, A = stops[k], B = stops[Math.min(2, k + 1)];
  return { sun: duskMixRgb(A.sun, B.sun, f), tint: duskMixRgb(A.tint, B.tint, f), shade: duskMixRgb(A.shade, B.shade, f) };
}

/** Is the device set to reduce motion? (Then nothing in the sunset drifts or twinkles.) */
function duskStill() { return !!(typeof LESS_MOTION !== 'undefined' && LESS_MOTION && LESS_MOTION.matches); }

/**
 * Once a frame (from duskGround): the sunset now, or null. { env (0..1 how much of it shows), h (0..1 how far it's
 * gone: golden to violet at dusk, violet to gold at dawn), dawn, B (the biome's touches), pal (its colours now), dir
 * (+1 the sun in the west, -1 in the east), mute (the weather), zf (the overlay's strength at this zoom), saver }.
 */
function duskFrame(z) {
  DUSK.st = null;
  const x = duskClock();
  if (x == null) return null;
  const T = DUSK_TIMES;
  let env = 0, h = 0, dawn = false;
  const d = T.dusk;
  if (x >= d[0] && x <= d[3]) { env = duskSmooth(d[0], d[1], x) * (1 - duskSmooth(d[2], d[3], x)); h = clamp((x - d[0]) / (d[2] - 20 - d[0]), 0, 1); }
  else {
    const w = T.dawn, xx = x < w[0] ? x + T.len : x, e3 = w[3] + T.len, e2 = w[2] + T.len, e1 = w[1];
    if (xx >= w[0] && xx <= e3) { dawn = true; env = 0.62 * duskSmooth(w[0], e1, xx) * (1 - duskSmooth(e2, e3, xx)); h = clamp((xx - w[0]) / (e2 + 10 - w[0]), 0, 1); }
  }
  if (env < 0.005) return null;
  // The biome: the one under the middle of the view where a map has two, eased across as the camera crosses.
  const b1 = R.biome || 'desert', b2 = R.secondRegion ? R.secondRegion.biome : null;
  let want = 0;
  if (b2 && R.biomeMix) { const i = clamp(Math.floor(R.cam.x), 0, S.W - 1), j = clamp(Math.floor(R.cam.y), 0, S.H - 1); want = R.biomeMix[tIdx(i, j)] >= 0.5 ? 1 : 0; }
  const dt = Math.min(0.25, Math.max(0, R.time - DUSK.mixAt));
  DUSK.mixAt = R.time;
  DUSK.mix += clamp(want - DUSK.mix, -dt * 0.8, dt * 0.8);
  if (!b2) DUSK.mix = 0;
  const B1 = DUSK_BIOMES[b1], B2 = b2 ? DUSK_BIOMES[b2] : null;
  if (!B1 && !B2) return null; // (the Hollow)
  const P = (B) => (B ? duskStops(dawn ? B.dawn || DUSK_DAWN : B.dusk, h) : null);
  let pal = P(B1 || B2);
  if (B1 && B2 && DUSK.mix > 0.001) { const q = P(B2); pal = { sun: duskMixRgb(pal.sun, q.sun, DUSK.mix), tint: duskMixRgb(pal.tint, q.tint, DUSK.mix), shade: duskMixRgb(pal.shade, q.shade, DUSK.mix) }; }
  const B = (DUSK.mix >= 0.5 ? B2 : B1) || B1 || B2;
  // The weather: a storm, a fog or a dust storm takes most of the light away while it lasts.
  let mute = 1;
  if (S.event && S.event.type === 'dust') mute = 0.25;
  else if (typeof weatherOn === 'function' && weatherOn() && typeof weatherAt === 'function') {
    const W = weatherAt(S.time);
    if (W) mute = 1 - 0.8 * ((typeof AMB !== 'undefined' && AMB.thick[W.kind]) || 0) * W.k;
  }
  // Zoomed far in the grade over the buildings and robots eases off, so they read clearly.
  const zf = 1 - 0.55 * duskSmooth(36, 80, z);
  return (DUSK.st = { env, h, dawn, B, pal, dir: dawn ? -1 : 1, mute, zf, k: B.k || 1, saver: typeof gfxStep === 'function' && gfxStep() === 'saver' });
}

/** A linear gradient across the screen from the sun's side, kept while the screen's size and the sun's side stay. */
function duskSunLine(ctx, dir) {
  const w = R.w, h = R.h, L = 0.62 * Math.max(w, h), dx = dir * 0.97, dy = 0.25;
  return ctx.createLinearGradient(w / 2 - dx * L, h / 2 - dy * L, w / 2 + dx * L, h / 2 + dy * L);
}

/**
 * Fill the part of the screen where a duskSunLine gradient is between stops t0 and t1 (0 the sun's side, 1 the far
 * side), and no more: on a phone drawing without the graphics chip every full-screen pass counts.
 */
function duskFillSpan(ctx, dir, t0, t1) {
  const L = 0.62 * Math.max(R.w, R.h), m = R.h * 0.16, at = (t) => R.w / 2 + dir * 0.97 * L * (2 * t - 1);
  const x0 = clamp(Math.min(at(t0), at(t1)) - m, 0, R.w), x1 = clamp(Math.max(at(t0), at(t1)) + m, 0, R.w);
  if (x1 > x0) ctx.fillRect(x0, 0, x1 - x0, R.h);
}

/** Draw a map-sized image (a few pixels a tile) over the map, only the part of it in view. */
function duskMapImage(ctx, img, ox, oy, z) {
  const k = img.width / S.W, i0 = clamp(Math.floor(-ox / z) - 1, 0, S.W), j0 = clamp(Math.floor(-oy / z) - 1, 0, S.H);
  const i1 = clamp(Math.ceil((R.w - ox) / z) + 1, 0, S.W), j1 = clamp(Math.ceil((R.h - oy) / z) + 1, 0, S.H);
  if (i1 <= i0 || j1 <= j0) return;
  ctx.drawImage(img, i0 * k, j0 * k, (i1 - i0) * k, (j1 - j0) * k, ox + i0 * z, oy + j0 * z, (i1 - i0) * z, (j1 - j0) * z);
}

/**
 * Over the ground, graded for the time of day already (render, after todGradeGround): the long light (lit on the sun's
 * side, a cool long shade away from it), the sun's warm wash, plants silhouetted, glitter on the water, a warm haze over
 * it, the heat haze easing off, and on Argos the terminator.
 */
function duskGround(ctx, ox, oy, z, v0, v1) {
  const D = duskFrame(z);
  duskSilBake(D);
  if (!D) return;
  const a = D.env * D.mute * D.k, P = D.pal;
  ctx.save();
  if (D.B.terminator) { duskTerminator(ctx, ox, oy, z, D); ctx.restore(); return; }
  if (!D.saver && D.B.shimmer && !duskStill()) duskShimmer(ctx, D);
  if (D.saver) {
    // Saver: just the colour grade, one flat pass.
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = a * 0.6;
    ctx.fillStyle = duskRgb(duskMixRgb(P.sun, P.shade, 0.4));
    ctx.fillRect(0, 0, R.w, R.h);
    ctx.restore();
    return;
  }
  // The light: warm and bright on the sun's side, the grade's colour across the middle, a cool shade beyond, in soft
  // light (so the land keeps its contrast: the lights glow and the darks deepen, nothing is washed over).
  let g = duskSunLine(ctx, D.dir);
  g.addColorStop(0, duskRgb(duskDeep(P.sun)));
  g.addColorStop(0.45, duskRgb(duskMixRgb([128, 128, 128], duskDeep(P.tint), 0.55))); // (soft light's grey changes nothing: the middle keeps the land's own colours)
  g.addColorStop(1, duskRgb(P.shade));
  ctx.globalCompositeOperation = 'soft-light';
  ctx.globalAlpha = Math.min(1, a * (0.75 - 0.3 * duskSmooth(0.3, 0.6, D.h))); // (the evening's own light is warm already)
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, R.w, R.h);
  // The low sun's glow on its side: the lit faces of the land burn warm (colour dodge brightens the lights, not the darks).
  g = duskSunLine(ctx, D.dir);
  g.addColorStop(0, duskRgb(duskMixRgb([0, 0, 0], duskDeep(P.sun), 0.42)));
  g.addColorStop(0.5, duskRgb(duskMixRgb([0, 0, 0], duskDeep(P.sun), 0.12)));
  g.addColorStop(0.75, 'rgb(0,0,0)');
  ctx.globalCompositeOperation = 'color-dodge';
  ctx.globalAlpha = a * 0.7 * (1 - 0.6 * duskSmooth(0.65, 1, D.h));
  ctx.fillStyle = g;
  duskFillSpan(ctx, D.dir, 0, 0.75);
  // The long shade: the far side falls into it, deepening toward violet as the sun goes.
  g = duskSunLine(ctx, D.dir);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.35, 'rgba(255,255,255,0)');
  g.addColorStop(1, duskRgb(P.shade));
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = a * (0.35 + 0.2 * D.h);
  ctx.fillStyle = g;
  duskFillSpan(ctx, D.dir, 0.35, 1);
  // Plants silhouetted against the low sun (the Shoals' palms, the Long Grass's acacias).
  if (D.B.sil && DUSK.sil && DUSK.sil.ready) {
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = a * D.B.sil * duskSmooth(0.1, 0.55, D.h);
    ctx.imageSmoothingEnabled = true;
    duskMapImage(ctx, DUSK.sil.c, ox, oy, z);
  }
  if (D.B.glitter >= 1) duskSheen(ctx, ox, oy, z, D, a); // (the Shoals' sea; elsewhere the glints alone)
  if (D.B.glitter) duskGlitter(ctx, ox, oy, z, v0, v1, D, a);
  if (D.B.haze) duskHaze(ctx, z, D, a);
  ctx.restore();
}

/**
 * The water catching the sky: a sheen of the sunset's colours over every lake and sea (a map of the water, a pixel a
 * tile, drawn smoothed over the map), brighter toward the sun.
 */
function duskSheen(ctx, ox, oy, z, D, a) {
  const key = [S.roadVer, S.tide && S.tide.high, S.W, S.H].join(':');
  let M = DUSK.water;
  if (!M || M.of !== S || M.key !== key) {
    const c = M && M.c || document.createElement('canvas');
    c.width = S.W; c.height = S.H;
    const x = c.getContext('2d'), img = x.createImageData(S.W, S.H);
    let any = false;
    for (let t = 0; t < S.W * S.H; t++) {
      if (S.terrain[t] !== T_WATER || (S.lava && S.lava[t])) continue;
      img.data[t * 4] = img.data[t * 4 + 1] = img.data[t * 4 + 2] = 255; img.data[t * 4 + 3] = 255; any = true;
    }
    x.putImageData(img, 0, 0);
    M = DUSK.water = { of: S, key, c, any, col: '' };
  }
  if (!M.any) return;
  const col = duskMixRgb(D.pal.sun, D.pal.tint, 0.35 + 0.4 * D.h), ck = col.map((v) => v | 0).join();
  if (M.col !== ck) { // (recoloured as the light changes: the map is tiny)
    const x = M.c.getContext('2d');
    x.globalCompositeOperation = 'source-in'; x.fillStyle = duskRgb(col); x.fillRect(0, 0, S.W, S.H);
    M.col = ck;
  }
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = a * Math.min(0.2, 0.12 * D.B.glitter) * (1 - 0.5 * duskSmooth(0.75, 1, D.h));
  ctx.imageSmoothingEnabled = true;
  duskMapImage(ctx, M.c, ox, oy, z);
}

/** A warm haze lying over the ground (the Shoals' over the sea, Blackwater's pink fog): soft banks drifting with the land. */
function duskHaze(ctx, z, D, a) {
  const cloud = wxCloud(D.B.haze.join(',')), cw = R.w, ch = R.h, t = duskStill() ? 0 : R.time;
  const camX = R.cam.x * z, camY = R.cam.y * z;
  ctx.globalCompositeOperation = 'screen';
  for (let n = 0; n < 9; n++) {
    const h1 = hash2(n, 3, 501), h2 = hash2(n, 5, 503), s = Math.max(cw, ch) * (0.4 + 0.35 * hash2(n, 7, 505));
    const x = wxWrap(h1 * cw + t * (6 + 6 * h2) - camX * 0.7, cw, s / 2), y = wxWrap(h2 * ch - camY * 0.7, ch, s / 4);
    ctx.globalAlpha = a * 0.3 * (D.B.hazeK || 1);
    ctx.drawImage(cloud, x - s / 2, y - s * 0.18, s, s * 0.36);
  }
}

/**
 * The sun on the water: glints across every water tile in view, brightest toward the sun, twinkling (still with the
 * device set to reduce motion). At most about 1500 a frame: zoomed out they're spread over every few tiles.
 */
function duskGlitter(ctx, ox, oy, z, v0, v1, D, a) {
  if (z < 9 || D.B.glitter <= 0) return;
  const i0 = Math.max(0, Math.floor(v0.x)), i1 = Math.min(S.W - 1, Math.ceil(v1.x)), j0 = Math.max(0, Math.floor(v0.y)), j1 = Math.min(S.H - 1, Math.ceil(v1.y));
  const n = (i1 - i0 + 1) * (j1 - j0 + 1), step = Math.max(1, Math.ceil(Math.sqrt(n / 900)));
  const still = duskStill(), t = R.time, cw = duskMixRgb(D.pal.sun, [255, 255, 255], 0.55), col = duskRgb(cw), dot = duskDot(cw);
  const lava = S.lava, glow = a * Math.min(1, D.B.glitter) * (1 - 0.6 * duskSmooth(0.75, 1, D.h)), big = Math.max(1, D.B.glitter);
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = col;
  for (let j = j0 - (j0 % step); j <= j1; j += step) for (let i = i0 - (i0 % step); i <= i1; i += step) {
    const tt = j * S.W + i;
    if (S.terrain[tt] !== T_WATER || (lava && lava[tt]) || S.road[tt]) continue;
    for (let k = 0; k < 2; k++) {
      const h1 = hash2(i * 3 + k, j, 611), h2 = hash2(j * 5 + k, i, 613), h3 = hash2(i + k * 7, j * 3, 617);
      const x = ox + (i + h1 * step) * z, y = oy + (j + h2 * step) * z;
      const side = clamp(D.dir > 0 ? 1 - x / (R.w * 1.1) : x / (R.w * 1.1), 0, 1);
      const tw = still ? (h3 > 0.5 ? 0.6 : 0) : Math.pow(Math.max(0, Math.sin(t * (1.6 + 2.4 * h3) + h1 * 40)), 3);
      const al = glow * tw * (0.15 + 0.85 * side * side) * (big > 1 ? 1.5 : 1);
      if (al < 0.02) continue;
      const len = z * (0.08 + 0.16 * h2) * big * (0.6 + 0.6 * side), th = Math.max(1, z * 0.02), r = Math.max(2, z * 0.11 * big * (0.5 + side));
      ctx.globalAlpha = Math.min(1, al);
      ctx.drawImage(dot, x - r, y - r, r * 2, r * 2);
      ctx.fillRect(x - len / 2, y - th / 2, len, th);
    }
  }
}

/** The heat haze over the sand easing off as the sun goes down: the ground drawn so far nudged in fine wavering bands. */
function duskShimmer(ctx, D) {
  const k = D.B.shimmer * D.mute * duskSmooth(0, 0.08, D.h) * (1 - duskSmooth(0.12, 0.4, D.h));
  if (k < 0.05) return;
  const c = ctx.canvas, dpr = R.dpr, band = 6, t = R.time;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 0.6;
  for (let y = 0; y < c.height; y += band * dpr) {
    const dx = Math.sin(y * 0.045 / dpr + t * 2.3) * 0.9 * k * dpr;
    if (Math.abs(dx) < 0.15) continue;
    ctx.drawImage(c, 0, y, c.width, band * dpr, dx, y, c.width, band * dpr);
  }
  ctx.restore();
}

/**
 * Argos at dusk and dawn: no air to redden the light, so the evening's warm cast is taken out (a cool, colourless grade),
 * and the line between day and night sweeps across the land from east to west, hard-edged, in about a minute.
 */
function duskTerminator(ctx, ox, oy, z, D) {
  const x = duskClock(), a = D.env / (D.dawn ? 0.62 : 1);
  ctx.globalCompositeOperation = 'saturation';
  ctx.globalAlpha = 0.85 * a;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, R.w, R.h);
  // The line's place: across the map in a minute (dusk from 340 s, dawn from 700 s), east to west.
  const sweep = D.dawn ? (((x - DUSK_TIMES.dawn[0] - 5) % DUSK_TIMES.len) + DUSK_TIMES.len) % DUSK_TIMES.len : x - DUSK_TIMES.dusk[0] - 55;
  const p = clamp(sweep / 60, 0, 1), line = ox + S.W * z * (1.12 - 1.24 * p), soft = Math.max(2, z * 0.35);
  const dark = duskRgb(D.pal.shade);
  D.line = line; // (duskSky dims what stands on the night side too)
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = 0.82 * a;
  ctx.fillStyle = dark;
  if (D.dawn) { if (line > 0) ctx.fillRect(0, 0, Math.min(R.w, line - soft), R.h); } // (dawn: the night still lies west of it)
  else if (line < R.w) ctx.fillRect(Math.max(0, line + soft), 0, R.w, R.h); // (dusk: night has come east of it)
  if (line + soft > 0 && line - soft < R.w) {
    const g = ctx.createLinearGradient(line - soft, 0, line + soft, 0);
    g.addColorStop(D.dawn ? 1 : 0, 'rgba(255,255,255,1)'); g.addColorStop(D.dawn ? 0 : 1, dark);
    ctx.fillStyle = g;
    ctx.fillRect(line - soft, 0, soft * 2, R.h);
    // the last of the light along the line: a thin, cold rim
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.35 * a;
    ctx.fillStyle = 'rgb(200,214,255)';
    ctx.fillRect(D.dawn ? line + soft * 0.2 : line - soft * 0.6, 0, Math.max(1, soft * 0.4), R.h);
  }
}

/**
 * Over everything standing (render, after the sky's clouds and beacons; under the effects, selection marks and HUD):
 * the grade, lighter than on the ground, the glare off the sun's side, light shafts, the Ring, and the motes in the air.
 */
function duskSky(ctx, ox, oy, z) {
  const D = DUSK.st;
  if (!D) return;
  const a = D.env * D.mute * D.zf, P = D.pal;
  ctx.save();
  // The grade: soft light, so the buildings and robots keep their contrast and their colours.
  ctx.globalCompositeOperation = 'soft-light';
  ctx.globalAlpha = a * 0.22 * D.k;
  ctx.fillStyle = duskRgb(P.tint);
  ctx.fillRect(0, 0, R.w, R.h);
  if (D.B.terminator && D.line != null) {
    // Argos: what stands on the night side of the terminator goes into its shadow too (a little: it has its own lights).
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.45 * D.env / (D.dawn ? 0.62 : 1);
    ctx.fillStyle = duskRgb(P.shade);
    if (D.dawn) { if (D.line > 0) ctx.fillRect(0, 0, Math.min(R.w, D.line), R.h); } else if (D.line < R.w) ctx.fillRect(Math.max(0, D.line), 0, R.w, R.h);
  }
  if (D.saver || D.B.terminator) { ctx.restore(); return; }
  // The glare: the low sun just off the screen's edge.
  const sx = D.dir > 0 ? -0.18 * R.w : 1.18 * R.w, sy = 0.32 * R.h, rr = 0.95 * Math.max(R.w, R.h);
  const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, rr);
  g.addColorStop(0, duskRgb(P.sun, 0.7)); g.addColorStop(0.45, duskRgb(P.sun, 0.18)); g.addColorStop(1, duskRgb(P.sun, 0));
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = a * 0.26 * (1 - 0.5 * duskSmooth(0.7, 1, D.h));
  ctx.fillStyle = g;
  if (D.dir > 0) ctx.fillRect(0, 0, Math.min(R.w, sx + rr * 0.8), R.h); else ctx.fillRect(Math.max(0, sx - rr * 0.8), 0, R.w, R.h); // (beyond, it has faded)
  if (D.B.shafts) duskShafts(ctx, D, sx, sy, a);
  if (D.B.ring) duskRing(ctx, z, D);
  if (D.B.motes) duskMotes(ctx, z, D, a);
  ctx.restore();
}

/**
 * A small soft dot of light in colour c ([r, g, b] or '#rrggbb'), 16 px, made once per colour: the motes and glints are
 * drawn small, and shrinking a big glow image for each of them costs more than all the rest of the sunset.
 */
function duskDot(c) {
  const key = typeof c === 'string' ? c : c.map((v) => (v / 8) | 0).join(',');
  const cache = DUSK.dots || (DUSK.dots = {});
  if (cache[key]) return cache[key];
  const rgb = typeof c === 'string' ? [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) : c;
  const n = 16, cv = document.createElement('canvas');
  cv.width = cv.height = n;
  const x = cv.getContext('2d'), g = x.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  g.addColorStop(0, duskRgb(rgb, 1)); g.addColorStop(0.3, duskRgb(rgb, 0.6)); g.addColorStop(1, duskRgb(rgb, 0));
  x.fillStyle = g; x.fillRect(0, 0, n, n);
  if (Object.keys(cache).length > 64) DUSK.dots = {};
  return ((DUSK.dots || cache)[key] = cv);
}

/** A soft beam of light (white, fading along and across), made once and tinted per colour. */
function duskShaft(rgb) {
  const key = rgb.map((v) => (v / 16) | 0).join(',');
  if (DUSK.shafts[key]) return DUSK.shafts[key];
  const c = document.createElement('canvas'), w = 256, h = 32;
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  let g = x.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, duskRgb(rgb, 0)); g.addColorStop(0.15, duskRgb(rgb, 1)); g.addColorStop(0.55, duskRgb(rgb, 0.45)); g.addColorStop(1, duskRgb(rgb, 0));
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.globalCompositeOperation = 'destination-in';
  g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  if (Object.keys(DUSK.shafts).length > 40) DUSK.shafts = {};
  return (DUSK.shafts[key] = c);
}

/** Light shafts fanning from the low sun (through the trees, the steam, the Bloom's spore haze), swaying slowly. */
function duskShafts(ctx, D, sx, sy, a) {
  const img = duskShaft(D.pal.sun), L = 1.5 * Math.max(R.w, R.h), still = duskStill();
  const base = D.dir > 0 ? 0.24 : Math.PI - 0.24, n = gfxStep() === 'auto' ? 5 : 7;
  ctx.globalCompositeOperation = 'screen';
  for (let k = 0; k < n; k++) {
    const h1 = hash2(k, 1, 701), h2 = hash2(k, 2, 703);
    const ang = base + D.dir * (h1 - 0.5) * 0.7 + (still ? 0 : 0.025 * Math.sin(R.time * 0.11 + k * 1.7));
    const wid = R.h * (0.05 + 0.12 * h2);
    ctx.globalAlpha = a * D.B.shafts * (0.12 + 0.12 * h2) * (1 - duskSmooth(0.65, 0.95, D.h)) * (still ? 1 : 0.8 + 0.2 * Math.sin(R.time * 0.3 + k * 2.1));
    ctx.save();
    ctx.translate(sx, sy); ctx.rotate(ang);
    ctx.drawImage(img, 0, -wid / 2, L, wid);
    ctx.restore();
  }
}

/**
 * The Ring catching the sunset: a faint bright arc low over the top of the view, strongest just after the land has gone
 * into shadow (it's still in the sun up there), only zoomed out where the view takes in the sky's share of the land.
 */
function duskRing(ctx, z, D) {
  const show = D.mute * (D.dawn ? 0.5 * (1 - duskSmooth(0.4, 0.8, D.h)) : duskSmooth(0.35, 0.8, D.h)) * duskSmooth(0, 0.25, D.env) * (1 - duskSmooth(14, 26, z));
  if (show < 0.01) return;
  const w = R.w, h = R.h, cx = w * 0.56, cy = h * 2.25, rx = w * 1.35, ry = h * 2.1;
  const col = duskMixRgb(D.pal.sun, [255, 236, 220], 0.45);
  ctx.globalCompositeOperation = 'screen';
  ctx.strokeStyle = duskRgb(col);
  ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, -0.05, Math.PI * 1.08, Math.PI * 1.92); // (only the arc over the top of the view)
  ctx.globalAlpha = 0.07 * show; ctx.lineWidth = h * 0.05; ctx.stroke();
  ctx.globalAlpha = 0.14 * show; ctx.lineWidth = h * 0.012; ctx.stroke();
  ctx.globalAlpha = 0.3 * show; ctx.lineWidth = Math.max(1, h * 0.0025); ctx.stroke();
}

/** What the motes in the air look like: their colours (near the sun, away from it), how many, how big, how they drift. */
const DUSK_MOTES = {
  dust: { near: '#ffd08a', far: '#ff9a62', n: 70, r: 1.6, rise: -2, drift: 9 },
  pollen: { near: '#fff0b0', far: '#ffc878', n: 40, r: 1.3, rise: 1, drift: 4 },
  spores: { near: '#ffe9a8', far: '#8affea', far2: '#cfa0ff', n: 80, r: 1.8, rise: 7, drift: 3 },
  embers: { near: '#ffb04a', far: '#ff5a22', n: 60, r: 1.5, rise: 14, drift: 5 },
  ice: { near: '#fff2fa', far: '#d8e4ff', n: 70, r: 1.1, rise: -1, drift: 2 },
};
/** The motes catching the low light: dust, spores, embers, pollen or ice, drifting over the land. */
function duskMotes(ctx, z, D, a) {
  const M = DUSK_MOTES[D.B.motes];
  if (!M) return;
  const still = duskStill(), t = still ? 0 : R.time, cw = R.w, ch = R.h, camX = R.cam.x * z * 1.1, camY = R.cam.y * z * 1.1;
  const n = Math.round(M.n * 0.7 * gfx().fx), sz = M.r * Math.sqrt(z / 30) * 6, last = 1 - duskSmooth(0.8, 1, D.h) * (D.B.motes === 'spores' ? 0 : 0.6);
  ctx.globalCompositeOperation = 'lighter';
  for (let k = 0; k < n; k++) {
    const h1 = hash2(k, 11, 801), h2 = hash2(k, 13, 803), h3 = hash2(k, 17, 807);
    const x = wxWrap(h1 * cw + t * M.drift * (0.5 + h3) + Math.sin(t * 0.7 + k) * 6 - camX, cw, 20);
    const y = wxWrap(h2 * ch - t * M.rise * (0.5 + h2) + Math.cos(t * 0.5 + k * 1.3) * 5 - camY, ch, 20);
    const side = clamp(D.dir > 0 ? 1 - x / cw : x / cw, 0, 1), near = side > 0.62 - 0.2 * h3;
    const col = near ? M.near : M.far2 && h3 > 0.5 ? M.far2 : M.far;
    const tw = still ? 0.7 : 0.55 + 0.45 * Math.sin(t * (1 + 2 * h3) + k * 2.3);
    ctx.globalAlpha = a * last * tw * (near ? 0.85 : 0.5);
    const s = sz * (0.6 + 0.8 * h3) * (near ? 1.2 : 1);
    ctx.drawImage(duskDot(col), x - s / 2, y - s / 2, s, s);
  }
}

/**
 * How far a biome's night glow has woken (0..1) before night: the Bloom's veins and plants, the Cinderlands' lava. Their
 * glow takes the larger of this and the night's (drawBiomeGlow, drawLavaGlow).
 */
function duskWake() {
  const D = DUSK.st;
  if (!D || !D.B.wake || D.dawn) return 0;
  return D.B.wake * D.mute * duskSmooth(0.25, 0.85, D.h) * Math.min(1, D.env * 1.4);
}

/** The colour of a robot's drop shadow now ('r,g,b'): its usual near-black, turning violet in the sunset's long light. */
function duskShadowRgb() {
  const D = DUSK.st;
  if (!D) return '20,10,5';
  const c = duskMixRgb([20, 10, 5], duskMixRgb(D.pal.shade, [20, 10, 40], 0.55), Math.min(1, D.env * D.mute));
  return `${c[0] | 0},${c[1] | 0},${c[2] | 0}`;
}

/** How much longer the shadows fall now (1 at noon; up to about 1.9 with the sun low). */
function duskShadowLength() {
  const D = DUSK.st;
  return D && !D.B.terminator ? 1 + 0.9 * D.env * D.mute : 1;
}

/** The steam's colour (rgb, for wxCloud) lit by the sunset, or null: Steamwells' plumes catch the gold (drawSpringSteam). */
function duskSteamRgb() {
  const D = DUSK.st;
  if (!D || D.dawn) return null;
  const k = Math.round(D.env * D.mute * 4) / 4;
  if (k < 0.25) return null;
  const c = duskMixRgb([235, 242, 225], duskMixRgb(D.pal.sun, [255, 255, 255], 0.25), k * (1 - 0.4 * duskSmooth(0.75, 1, D.h)));
  return `${(c[0] / 8 | 0) * 8},${(c[1] / 8 | 0) * 8},${(c[2] / 8 | 0) * 8}`;
}

/*
 * The silhouettes: every plant on the map, dark, in a map of its own at a few pixels a tile, laid over the ground at
 * dusk where a biome has them (sil). Made a few rows a frame (from the start of the game, so it's ready by the first
 * sunset), and its tiles made again with the ground's (duskSilTiles from flushDirtyTiles and redrawRegion).
 */
function duskSilWanted() {
  if (typeof gfxStep === 'function' && gfxStep() === 'saver') return false;
  const b = [R.biome, R.secondRegion && R.secondRegion.biome];
  return b.some((x) => x && DUSK_BIOMES[x] && DUSK_BIOMES[x].sil);
}
/** Let the silhouettes go (a new map is baked: bakeMap). */
function duskSilReset() { if (DUSK.sil) { DUSK.sil.c.width = DUSK.sil.c.height = 0; DUSK.sil = null; } }
function duskSilBake(D) {
  if (!S || !R.map || !duskSilWanted()) return;
  let L = DUSK.sil;
  if (L && L.of !== S) { duskSilReset(); L = null; }
  if (!L) {
    const px = Math.max(2, Math.min(8, Math.floor(2048 / Math.max(S.W, S.H))));
    const c = document.createElement('canvas');
    c.width = S.W * px; c.height = S.H * px;
    const x = c.getContext('2d'), k = px / TP;
    x.setTransform(k, 0, 0, k, 0, 0);
    x.hdScale = k;
    L = DUSK.sil = { c, ctx: x, row: 0, ready: false, of: S };
  }
  if (L.ready) return;
  // A few rows a frame, more while the sun is going down.
  const t0 = performance.now(), budget = D ? 6 : 2.5;
  while (L.row < S.H && performance.now() - t0 < budget) { drawPlants(L.ctx, 0, L.row, S.W - 1, Math.min(S.H - 1, L.row + 3)); L.row += 4; }
  if (L.row >= S.H) { duskSilInk(L, 0, 0, S.W, S.H); L.ready = true; }
}
/** Turn the plants drawn in tiles (i, j, w, h) of the silhouette map into dark shapes. */
function duskSilInk(L, i, j, w, h) {
  const x = L.ctx;
  x.save();
  x.beginPath(); x.rect(i * TP, j * TP, w * TP, h * TP); x.clip();
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = 'rgb(40,16,36)';
  x.fillRect(i * TP, j * TP, w * TP, h * TP);
  x.restore();
}
/** Make tiles i0..i1 × j0..j1 of the silhouettes again (a plant cleared, a road or building on it). */
function duskSilTiles(i0, j0, i1, j1) {
  const L = DUSK.sil;
  if (!L || L.of !== S) return;
  i0 = Math.max(0, i0 - 1); j0 = Math.max(0, j0 - 1); i1 = Math.min(S.W - 1, i1 + 1); j1 = Math.min(S.H - 1, j1 + 1);
  const x = L.ctx, w = i1 - i0 + 1, h = j1 - j0 + 1;
  if (!L.ready && j0 >= L.row) return; // (not made yet: it will be)
  x.save();
  x.beginPath(); x.rect(i0 * TP, j0 * TP, w * TP, h * TP); x.clip();
  x.clearRect(i0 * TP, j0 * TP, w * TP, h * TP);
  drawPlants(x, i0 - 1, j0 - 1, i1 + 1, j1 + 1);
  x.restore();
  if (L.ready) duskSilInk(L, i0, j0, w, h);
}

'use strict';
/*
 * Day and night (art from the Claude Design day/night kit; settings in art/tod/shared/time-of-day.json).
 *
 * A clock runs on game time (so it pauses with the game and is saved with it): morning, day, evening
 * and night, with half-minute crossfades between them, 12 minutes round, starting at dawn.
 *
 * - Every 3D sprite (buildings, bots, vehicles, track, bridges) has a morning, evening and night
 *   version with the same canvas and framing, only re-lit (art/tod/<time>/<same path as the day art>,
 *   keys in TOD_KEYS). drawArt draws the current set's version, fading in the next set's over a
 *   transition. Only the sets in use (now and next) are kept loaded.
 * - Everything not re-rendered (the baked ground, roads, plants and resources, and any sprite whose
 *   set isn't loaded yet) is colour-graded: out = in × multiply + add, per channel.
 * - Evening and night: headlights on vehicles, a glow (light pool) in team colour under buildings,
 *   and the bots' drop shadows lean and soften with the light.
 *
 * Off (the pause menu's Day and night setting): it's always day, exactly as before.
 */
const TOD_TIMES = {
  morning: { mul: [1.0, 0.85, 0.79], add: [0.06, 0.05, 0.09], shadow: { dx: -0.16, dy: 0.06, alpha: 0.4, blur: 1.0 }, lights: 0, headlights: 0, pools: 0 },
  day: { mul: [1, 1, 1], add: [0, 0, 0], shadow: { dx: 0.05, dy: 0.07, alpha: 0.42, blur: 1.0 }, lights: 0, headlights: 0, pools: 0 },
  evening: { mul: [0.92, 0.64, 0.5], add: [0.01, 0, 0.02], shadow: { dx: 0.2, dy: 0.07, alpha: 0.4, blur: 1.0 }, lights: 0.55, headlights: 0.55, pools: 0.3 },
  night: { mul: [0.19, 0.23, 0.37], add: [0.008, 0.01, 0.025], shadow: { dx: 0.03, dy: 0.05, alpha: 0.25, blur: 1.6 }, lights: 1, headlights: 1, pools: 0.55 },
};
/** The cycle, in minutes of game time: [time] holds it, [from, to] crossfades. It starts at dawn. */
const TOD_CYCLE = [['morning', 1.5], ['morning', 'day', 0.5], ['day', 4], ['day', 'evening', 0.5], ['evening', 1.5], ['evening', 'night', 0.5], ['night', 3], ['night', 'morning', 0.5]];
const TOD_NAMES = { morning: 'Morning', day: 'Day', evening: 'Evening', night: 'Night' };
/** Sprites that are light (or UI) and are never re-lit or graded. */
const TOD_NEVER = /(-brake|-boost|-lights|-headlights|-spark|-lamp|^rail-lights-on|^light-pool|^icon-|^nuke-blast|^rally|^oneway)/;
const TOD_VEHICLES = ['truck', 'roadtrain', 'freight-loco', 'crawler', 'worker', 'hauler', 'agribot', 'paver', 'warbot'];

const TOD = { on: true, state: null, active: false, sets: {}, shared: {}, keys: null, poolTint: {} };

/** Is the day/night cycle on (a display setting kept on this device)? */
function todEnabled() { return TOD.on; }
function setTodEnabled(on) {
  TOD.on = !!on;
  try { localStorage.setItem('botfall.daynight', on ? '1' : '0'); } catch (e) { /* storage unavailable */ }
}
try { if (localStorage.getItem('botfall.daynight') === '0') TOD.on = false; } catch (e) { /* storage unavailable */ }

const todLerp = (a, b, f) => a + (b - a) * f;

/** The light at game time t (seconds): { a, b, f (0..1 from a to b), name, mul, add, shadow, lights, headlights, pools }. */
function todAt(t) {
  const total = TOD_CYCLE.reduce((n, p) => n + p[p.length - 1], 0) * 60;
  let x = ((t % total) + total) % total;
  for (const p of TOD_CYCLE) {
    const len = p[p.length - 1] * 60;
    if (x >= len) { x -= len; continue; }
    if (p.length === 2) return todMix(p[0], p[0], 0);
    const f = x / len;
    return todMix(p[0], p[1], f * f * (3 - 2 * f)); // smoothstep
  }
  return todMix('day', 'day', 0);
}

function todMix(a, b, f) {
  const A = TOD_TIMES[a], B = TOD_TIMES[b];
  const mix = (u, v) => u.map((x, k) => todLerp(x, v[k], f));
  return {
    a, b, f, name: f < 0.5 ? a : b,
    mul: mix(A.mul, B.mul), add: mix(A.add, B.add),
    shadow: { dx: todLerp(A.shadow.dx, B.shadow.dx, f), dy: todLerp(A.shadow.dy, B.shadow.dy, f), alpha: todLerp(A.shadow.alpha, B.shadow.alpha, f), blur: todLerp(A.shadow.blur, B.shadow.blur, f) },
    lights: todLerp(A.lights, B.lights, f), headlights: todLerp(A.headlights, B.headlights, f), pools: todLerp(A.pools, B.pools, f),
  };
}

/** The time of day now (the game's clock, or always day with the cycle off). */
function todNow() { return TOD.on && S ? todAt(S.time) : todMix('day', 'day', 0); }

/** Once a frame, before drawing: work out the light and make sure the sets in use are loading. */
function todFrame() {
  const st = todNow();
  TOD.state = st;
  TOD.active = st.a !== 'day' || st.b !== 'day';
  if (!TOD.on || !S) return;
  // The sets in use now and the next one coming (looked up a little ahead), and no others.
  const want = new Set([st.a, st.b, todAt(S.time + 45).a, todAt(S.time + 45).b]);
  want.delete('day');
  for (const name of want) todLoadSet(name);
  for (const name in TOD.sets) if (!want.has(name)) todDropSet(name);
  todLoadShared();
}

/** Where a sprite's time-of-day version is: art/tod/<time>/<the day file's path, as .webp>. */
function todSrc(name, key) {
  const e = typeof ART_MANIFEST === 'object' && ART_MANIFEST[key];
  const src = e && (typeof e === 'string' ? e : e.src);
  return src && !/^data:/.test(src) ? `art/tod/${name}/${src.replace(/\.(png|webp)$/, '.webp')}` : null;
}

function todKeySet() {
  if (!TOD.keys) TOD.keys = new Set(typeof TOD_KEYS !== 'undefined' ? TOD_KEYS : []);
  return TOD.keys;
}

/**
 * Start loading a time-of-day set: one image per sprite on the web, or the set's bundle
 * (tod-<time>.js, data URIs) next to a single-file copy of the game.
 */
function todLoadSet(name) {
  if (TOD.sets[name]) return;
  const set = TOD.sets[name] = { imgs: {}, n: 0 };
  const add = (key, src) => {
    const img = new Image();
    img.onload = () => { if (TOD.sets[name] === set) { set.imgs[key] = img; set.n++; } };
    img.src = src;
  };
  if (typeof window !== 'undefined' && window.TOD_BUNDLE) {
    const go = () => { const d = window.TOD_DATA && window.TOD_DATA[name]; if (d) for (const key in d) add(key, d[key]); };
    if (window.TOD_DATA && window.TOD_DATA[name]) { go(); return; }
    const s = document.createElement('script');
    s.src = `tod-${name}.js`;
    s.onload = go;
    s.onerror = () => { set.failed = true; }; // no bundle: graded day art stands in
    document.head.appendChild(s);
    return;
  }
  for (const key of todKeySet()) { const src = todSrc(name, key); if (src) add(key, src); }
}

/** Let a set go once it's no longer in use (its re-lit copies are dropped too). */
function todDropSet(name) {
  delete TOD.sets[name];
  if (typeof window !== 'undefined' && window.TOD_DATA) delete window.TOD_DATA[name];
  for (const k in ART) { const a = ART[k]; if (a && a.todv && a.todv[name]) delete a.todv[name]; }
}

/** Headlights and the light pool (small; loaded once the light first fades). */
function todLoadShared() {
  if (TOD.sharedLoading) return;
  TOD.sharedLoading = true;
  const inline = typeof window !== 'undefined' && window.TOD_SHARED;
  for (const k of [...TOD_VEHICLES.map((v) => v + '-headlights'), 'light-pool']) {
    const img = new Image();
    img.onload = () => { TOD.shared[k] = img; };
    img.src = inline && inline[k] ? inline[k] : `art/tod/shared/${k}.webp`;
  }
}

/**
 * The version of art entry `art` for time `name`: the day art itself, its re-lit version once that
 * set has loaded, or meanwhile (and for sprites with no re-lit version) a colour-graded copy.
 */
function todVariant(art, name) {
  if (name === 'day' || !art) return art;
  const key = art.key || '';
  if (TOD_NEVER.test(key)) return art;
  const cache = art.todv || (art.todv = {});
  if (cache[name]) return cache[name];
  const keys = todKeySet(), set = TOD.sets[name];
  if (set && key.includes('@2')) {
    // The green team: the re-lit red version recoloured, like the day art.
    const r = ART[key.replace('@2', '@1')], c = ART[key.replace('@2', '@0')];
    const rv = r && todVariant(r, name), cv = c && todVariant(c, name);
    if (rv && rv.relit && (!cv || cv.relit)) {
      const v = recolorArt(rv, cv && cv.relit ? cv : null);
      if (v && v !== rv) return (cache[name] = Object.assign(v, { relit: true, key }));
    }
  } else if (set && keys.has(key) && set.imgs[key]) {
    return (cache[name] = { img: set.imgs[key], scale: art.scale, anchor: art.anchor, shadow: art.shadow, key, relit: true });
  }
  return todGraded(art, name);
}

/** A copy of the art graded for time `name` (out = in × multiply + add), kept with the art. */
function todGraded(art, name) {
  const g = art.graded || (art.graded = {});
  if (g[name]) return g[name];
  const img = art.img, w = img.width, h = img.height, T = TOD_TIMES[name];
  if (!w || !h) return art;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  todGrade(x, 0, 0, w, h, T.mul, T.add, img);
  return (g[name] = { img: c, scale: art.scale, anchor: art.anchor, shadow: art.shadow, key: art.key });
}

/**
 * Grade a rectangle of ctx: out = in × mul + add. With `mask` (an image drawn at the rectangle), only
 * its opaque pixels are touched.
 */
function todGrade(ctx, x, y, w, h, mul, add, mask) {
  const rgb = (v) => `rgb(${Math.round(clamp(v[0], 0, 1) * 255)},${Math.round(clamp(v[1], 0, 1) * 255)},${Math.round(clamp(v[2], 0, 1) * 255)})`;
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = rgb(mul);
  ctx.fillRect(x, y, w, h);
  if (mask) { ctx.globalCompositeOperation = 'destination-in'; ctx.drawImage(mask, x, y, w, h); }
  if (add.some((v) => v > 0.001)) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = rgb(add);
    ctx.fillRect(x, y, w, h);
    if (mask) { ctx.globalCompositeOperation = 'destination-in'; ctx.drawImage(mask, x, y, w, h); }
  }
  ctx.restore();
}

/** Grade the ground drawn so far (the whole screen) for the light now. */
function todGradeGround(ctx) {
  if (!TOD.active) return;
  const st = TOD.state;
  todGrade(ctx, 0, 0, R.w, R.h, st.mul, st.add, null);
}

/**
 * A vehicle's headlights at dusk and night: its headlights image (3× the sprite, facing right),
 * centred on the vehicle and turned with it, added on top.
 */
function drawHeadlights(ctx, kind, x, y, spritePx, angle) {
  if (!TOD.active || !(TOD.state.headlights > 0.01)) return;
  const img = TOD.shared[kind + '-headlights'];
  if (!img) return;
  const s = spritePx * 3;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha *= TOD.state.headlights;
  ctx.translate(x, y);
  if (angle) ctx.rotate(angle);
  ctx.drawImage(img, -s / 2, -s / 2, s, s);
  ctx.restore();
}

/** At dusk and night, a glow in the building's team colour on the ground round its pad. */
function drawLightPool(ctx, x, y, z, color) {
  if (!TOD.active || !(TOD.state.pools > 0.01)) return;
  const pool = TOD.shared['light-pool'];
  if (!pool) return;
  let tinted = TOD.poolTint[color];
  if (!tinted) {
    tinted = document.createElement('canvas');
    tinted.width = pool.width; tinted.height = pool.height;
    const c = tinted.getContext('2d');
    c.drawImage(pool, 0, 0);
    c.globalCompositeOperation = 'source-in';
    c.fillStyle = color;
    c.fillRect(0, 0, pool.width, pool.height);
    TOD.poolTint[color] = tinted;
  }
  const s = z * 2.2;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha *= TOD.state.pools;
  ctx.drawImage(tinted, x - s / 2, y - s / 2, s, s);
  ctx.restore();
}

/** A bot's drop shadow now: offset (as a fraction of the shadow's length), opacity and spread. */
function todShadow() {
  const D = TOD_TIMES.day.shadow, sh = TOD.active ? TOD.state.shadow : D;
  return { kx: 0.12 * (sh.dx / D.dx), ky: 0.16 * (sh.dy / D.dy), alpha: 0.32 * (sh.alpha / D.alpha), grow: 1 + (sh.blur - 1) * 0.35 };
}

/** A colour drawn in code (Walls, Gates) in the light now: '#rrggbb' graded like the ground. */
function todColor(hex) {
  if (!TOD.active) return hex;
  const st = TOD.state, k = hex + st.mul.join() + st.add.join();
  const cache = TOD.colors || (TOD.colors = new Map());
  let c = cache.get(k);
  if (!c) {
    const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    c = `rgb(${v.map((x, i) => Math.round(clamp(x * st.mul[i] + st.add[i], 0, 1) * 255)).join(',')})`;
    if (cache.size > 400) cache.clear();
    cache.set(k, c);
  }
  return c;
}

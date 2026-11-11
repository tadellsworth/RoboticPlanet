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
  evening: { mul: [0.92, 0.64, 0.5], add: [0.01, 0, 0.02], shadow: { dx: 0.2, dy: 0.07, alpha: 0.4, blur: 1.0 }, lights: 0.55, headlights: 0.55, pools: 0.45 },
  // (night is a little deeper than it was, so the cities' lights stand out: see drawCityGlow and drawRoadGlow)
  night: { mul: [0.16, 0.2, 0.33], add: [0.006, 0.008, 0.022], shadow: { dx: 0.03, dy: 0.05, alpha: 0.25, blur: 1.6 }, lights: 1, headlights: 1, pools: 0.8 },
};
/** The cycle, in minutes of game time: [time] holds it, [from, to] crossfades. It starts at dawn. */
const TOD_CYCLE = [['morning', 1.5], ['morning', 'day', 0.5], ['day', 4], ['day', 'evening', 0.5], ['evening', 1.5], ['evening', 'night', 0.5], ['night', 3], ['night', 'morning', 0.5]];
const TOD_NAMES = { morning: 'Morning', day: 'Day', evening: 'Evening', night: 'Night' };
/** Sprites that are light (or UI) and are never re-lit or graded. */
const TOD_NEVER = /(-brake|-boost|-lights|-headlights|-spark|-lamp|^rail-lights-on|^light-pool|^icon-|^nuke-blast|^rally|^oneway|^bunker-fire|^disruptor-pulse|^mortar-flash|^streetlamp-.*-(lit|pool)|^fx-|^(smelter|refinery)-work-|^turret-charge-)/;
const TOD_VEHICLES = ['truck', 'tanker', 'roadtrain', 'freight-loco', 'crawler', 'worker', 'hauler', 'agribot', 'paver', 'warbot'];

const TOD = { on: true, state: null, active: false, sets: {}, shared: {}, keys: null, poolTint: {} };

/**
 * The time of day setting (a display setting kept on this device): 'cycle' (morning to night, 12 minutes
 * round), 'day' (always day, the cycle off) or 'night' (always night: the cities' lights all game).
 */
const TOD_MODES = ['cycle', 'day', 'night'];
const TOD_MODE_NAMES = { cycle: 'Cycle', day: 'Always day', night: 'Always night' };
function todMode() { return TOD.mode; }
function setTodMode(m) {
  TOD.mode = TOD_MODES.includes(m) ? m : 'cycle';
  TOD.on = TOD.mode !== 'day';
  try { localStorage.setItem('botfall.daynight', TOD.mode === 'day' ? '0' : TOD.mode === 'night' ? 'night' : '1'); } catch (e) { /* storage unavailable */ }
}
/** Is the light changing at all (the cycle, or always night)? */
function todEnabled() { return TOD.on; }
function setTodEnabled(on) { setTodMode(on ? 'cycle' : 'day'); }
TOD.mode = 'cycle';
try { const v = localStorage.getItem('botfall.daynight'); if (v === '0') { TOD.mode = 'day'; TOD.on = false; } else if (v === 'night') TOD.mode = 'night'; } catch (e) { /* storage unavailable */ }

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

/** The time of day now (the game's clock; always day with the cycle off, always night set to night). */
function todNow() { return TOD.mode === 'night' ? todMix('night', 'night', 0) : TOD.on && S ? todAt(S.time) : todMix('day', 'day', 0); }
/** The name of the time of day now ('morning', 'day', 'evening' or 'night'). */
function todName() { return todNow().name; }

/** Once a frame, before drawing: work out the light and make sure the sets in use are loading. */
function todFrame() {
  const st = todNow();
  TOD.state = st;
  TOD.active = st.a !== 'day' || st.b !== 'day';
  if (!TOD.on || !S) return;
  // The sets in use now and the next one coming (looked up a little ahead), and no others.
  const want = TOD.mode === 'night' ? new Set(['night']) : new Set([st.a, st.b, todAt(S.time + 45).a, todAt(S.time + 45).b]);
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

/*
 * Streetlights at dusk and night: a lamp over every third tile of road (always the same tiles, so
 * they don't flicker as you scroll), sodium orange over concrete roads and a brighter, whiter light
 * over asphalt. Tunnels keep their own lamps.
 */
const STREETLIGHT = {
  road: { rgb: [255, 146, 52], r: 1.3, a: 0.6, head: '#ffc27a' },
  asphalt: { rgb: [228, 238, 255], r: 1.6, a: 0.7, head: '#ffffff' },
};

function streetGlow(kind) {
  TOD.street = TOD.street || {};
  if (TOD.street[kind]) return TOD.street[kind];
  const [r, g, b] = STREETLIGHT[kind].rgb, n = 128, c = document.createElement('canvas');
  c.width = c.height = n;
  const x = c.getContext('2d'), gr = x.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  gr.addColorStop(0, `rgba(${r},${g},${b},1)`); gr.addColorStop(0.2, `rgba(${r},${g},${b},0.7)`);
  gr.addColorStop(0.55, `rgba(${r},${g},${b},0.22)`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
  x.fillStyle = gr; x.fillRect(0, 0, n, n);
  return (TOD.street[kind] = c);
}

/**
 * The streetlamps in view (every third tile of road on open ground, the same tiles always): the
 * tile, its kind ('road' concrete or 'asphalt'), and where the post's foot stands. A road running
 * east–west has its lamps in the south verge (the head then shows right over the road); any other
 * in the west verge, the arm reaching out over it.
 */
function streetLamps(v0, v1) {
  const out = [];
  if (!S.road) return out;
  const i0 = Math.max(0, Math.floor(v0.x) - 2), i1 = Math.min(S.W - 1, Math.ceil(v1.x) + 2);
  const j0 = Math.max(0, Math.floor(v0.y) - 2), j1 = Math.min(S.H - 1, Math.ceil(v1.y) + 2);
  const road = (i, j) => inMap(i, j) && roadLike(tIdx(i, j));
  for (let j = j0; j <= j1; j++) {
    const rem = (i0 + 2 * j) % 3; // lamps where (i + 2j) is a multiple of 3: every third tile, any way a road runs
    for (let i = rem ? i0 + 3 - rem : i0; i <= i1; i += 3) {
      const t = tIdx(i, j);
      if (!S.road[t] || S.terrain[t] !== T_GROUND || S.bAt[t]) continue;
      const ew = (road(i - 1, j) || road(i + 1, j)) && !road(i, j - 1) && !road(i, j + 1);
      out.push({ ent: 'lamp', i, j, kind: S.pave[t] === 2 ? 'asphalt' : 'road', owner: Math.max(0, wayOwner(t)), x: ew ? i + 0.5 : i + 0.125, y: ew ? j + 0.875 : j + 0.5 });
    }
  }
  return out;
}

/** A streetlamp's post (graded for the time of day like any sprite) and, at dusk and night, its lit head. */
function drawStreetLamp(ctx, e, ox, oy, z) {
  // (each colony's lamps carry its colour: a light strip up the post and a ring under the head)
  const post = artFor('streetlamp-' + e.kind, e.owner);
  if (!post) return;
  const x = ox + e.x * z, y = oy + e.y * z;
  drawArt(ctx, post, x, y, z);
  const on = TOD.active ? TOD.state.lights : 0, lit = artFor('streetlamp-' + e.kind + '-lit', e.owner);
  if (on > 0.01 && lit) { const ga = ctx.globalAlpha; ctx.globalAlpha = ga * on; drawArtRaw(ctx, lit, x, y, z); ctx.globalAlpha = ga; }
}

function drawStreetLights(ctx, ox, oy, z, v0, v1) {
  if (!TOD.active || !(TOD.state.lights > 0.01) || !S.road) return;
  const on = TOD.state.lights, head = Math.max(1.2, z * 0.05);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const e of streetLamps(v0, v1)) {
    const L = STREETLIGHT[e.kind], w = z * L.r * 2, pool = ART['streetlamp-' + e.kind + '-pool'];
    const x = ox + (e.i + 0.5) * z, y = oy + (e.j + 0.5) * z;
    ctx.globalAlpha = on * L.a;
    if (pool) ctx.drawImage(pool.img, x - w / 2, y - w * 0.4, w, w * 0.8);
    else ctx.drawImage(streetGlow(e.kind), x - w / 2, y - w * 0.4, w, w * 0.8); // seen at an angle: a little squashed
    if (artFor('streetlamp-' + e.kind, e.owner)) continue; // the post's own lit head shows the lamp
    ctx.globalAlpha = on;
    ctx.fillStyle = L.head;
    ctx.beginPath(); ctx.arc(x, y, head, 0, Math.PI * 2); ctx.fill();
  }
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

/** A soft round glow in colour `color` (cached per colour), for the city haze. */
function glowDisc(color) {
  TOD.glowDisc = TOD.glowDisc || {};
  if (TOD.glowDisc[color]) return TOD.glowDisc[color];
  const n = 128, c = document.createElement('canvas');
  c.width = c.height = n;
  const x = c.getContext('2d'), gr = x.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  gr.addColorStop(0, color); gr.addColorStop(0.35, color + 'aa'); gr.addColorStop(0.7, color + '33'); gr.addColorStop(1, color + '00');
  x.fillStyle = gr; x.fillRect(0, 0, n, n);
  return (TOD.glowDisc[color] = c);
}

/**
 * At dusk and night, a city glows: a wide, faint haze in its owner's colour round every finished building,
 * so where buildings crowd together the haze builds up into a glow over the whole town.
 */
function drawCityGlow(ctx, ox, oy, z, items) {
  if (!TOD.active || !(TOD.state.pools > 0.01)) return;
  // The haze is soft, so it's built at an eighth of the screen's size and laid over it in one draw (cheap).
  const k = 1 / 8, w = Math.max(1, Math.ceil(R.w * k)), h = Math.max(1, Math.ceil(R.h * k));
  let buf = TOD.cityBuf;
  if (!buf) buf = TOD.cityBuf = document.createElement('canvas');
  if (buf.width !== w || buf.height !== h) { buf.width = w; buf.height = h; }
  const c = buf.getContext('2d');
  c.clearRect(0, 0, w, h);
  c.globalCompositeOperation = 'lighter';
  c.globalAlpha = 0.085 * TOD.state.pools;
  let any = false;
  for (const e of items) {
    if (e.ent !== 'b' || !e.built || BDEFS[e.type].wild || BDEFS[e.type].barrier || BDEFS[e.type].viaduct) continue;
    const col = PLAYER_COLORS[e.owner];
    if (!col) continue;
    const r = z * (e.type === 'lander' ? 4.2 : 3.0) * k;
    c.drawImage(glowDisc(col), (ox + (e.x + 0.5) * z) * k - r, (oy + (e.y + 0.5) * z) * k - r, r * 2, r * 2);
    any = true;
  }
  if (!any) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(buf, 0, 0, w / k, h / k);
  ctx.restore();
}

/**
 * At dusk and night, roads light up: a thin glowing line in the owner's colour along each road's edges
 * (brighter on asphalt), so a colony's road network shows as lit lines across the dark.
 */
function drawRoadGlow(ctx, ox, oy, z, v0, v1) {
  if (!TOD.active || !(TOD.state.lights > 0.01) || !S.road) return;
  const W = S.W, H = S.H, on = TOD.state.lights, inset = 0.09;
  const i0 = Math.max(0, Math.floor(v0.x) - 1), i1 = Math.min(W - 1, Math.ceil(v1.x) + 1);
  const j0 = Math.max(0, Math.floor(v0.y) - 1), j1 = Math.min(H - 1, Math.ceil(v1.y) + 1);
  const road = (i, j) => i >= 0 && j >= 0 && i < W && j < H && S.road[j * W + i];
  const paths = {};
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const t = j * W + i;
    if (!S.road[t] || S.bAt[t]) continue;
    const o = wayOwner(t), key = (o >= 0 ? o : 'n') + (S.pave[t] === 2 ? 'a' : 'r');
    const P = paths[key] || (paths[key] = new Path2D());
    const x0 = ox + (i + inset) * z, x1 = ox + (i + 1 - inset) * z, y0 = oy + (j + inset) * z, y1 = oy + (j + 1 - inset) * z;
    // Along each side with no road beside it; joined straight on through to the next road tile.
    if (!road(i, j - 1)) { P.moveTo(road(i - 1, j) ? ox + i * z : x0, y0); P.lineTo(road(i + 1, j) ? ox + (i + 1) * z : x1, y0); }
    if (!road(i, j + 1)) { P.moveTo(road(i - 1, j) ? ox + i * z : x0, y1); P.lineTo(road(i + 1, j) ? ox + (i + 1) * z : x1, y1); }
    if (!road(i - 1, j)) { P.moveTo(x0, road(i, j - 1) ? oy + j * z : y0); P.lineTo(x0, road(i, j + 1) ? oy + (j + 1) * z : y1); }
    if (!road(i + 1, j)) { P.moveTo(x1, road(i, j - 1) ? oy + j * z : y0); P.lineTo(x1, road(i, j + 1) ? oy + (j + 1) * z : y1); }
  }
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (const key in paths) {
    const o = key.slice(0, -1), col = o === 'n' ? '#ffd9a0' : PLAYER_COLORS[+o] || '#ffd9a0', asph = key.endsWith('a');
    ctx.strokeStyle = col;
    ctx.globalAlpha = on * (asph ? 0.2 : 0.13); ctx.lineWidth = Math.max(2, z * 0.11); ctx.stroke(paths[key]); // the glow
    ctx.globalAlpha = on * (asph ? 0.85 : 0.6); ctx.lineWidth = Math.max(1, z * 0.028); ctx.stroke(paths[key]); // the strip
  }
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

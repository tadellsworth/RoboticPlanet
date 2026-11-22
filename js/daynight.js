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
 * Off (the pause menu's Day and night setting): it's always day, exactly as before; but not in a game with the Murmur,
 * who live by the night (todMode shows the cycle there), and an always-night map (the Hollow) is always night. The game's
 * own logic never reads any of this: the Murmur's nights come from the clock itself (TOD_CYCLE in defs.js, murmurNight).
 */
const TOD_TIMES = {
  morning: { mul: [1.0, 0.85, 0.79], add: [0.06, 0.05, 0.09], shadow: { dx: -0.16, dy: 0.06, alpha: 0.4, blur: 1.0 }, lights: 0, headlights: 0, pools: 0 },
  day: { mul: [1, 1, 1], add: [0, 0, 0], shadow: { dx: 0.05, dy: 0.07, alpha: 0.42, blur: 1.0 }, lights: 0, headlights: 0, pools: 0 },
  evening: { mul: [0.92, 0.64, 0.5], add: [0.01, 0, 0.02], shadow: { dx: 0.2, dy: 0.07, alpha: 0.4, blur: 1.0 }, lights: 0.55, headlights: 0.55, pools: 0.45 },
  // (night is a little deeper than it was, so the cities' lights stand out: see drawCityGlow and drawRoadGlow)
  night: { mul: [0.16, 0.2, 0.33], add: [0.006, 0.008, 0.022], shadow: { dx: 0.03, dy: 0.05, alpha: 0.25, blur: 1.6 }, lights: 1, headlights: 1, pools: 0.8 },
};
/** (The cycle, TOD_CYCLE, is in defs.js: the Murmur's nights are game logic and read it too, through todPhase.) */
const TOD_NAMES = { morning: 'Morning', day: 'Day', evening: 'Evening', night: 'Night' };
/** Sprites that are light (or UI) and are never re-lit or graded. */
const TOD_NEVER = /(-brake|-boost|-lights|-headlights|-spark|-lamp|^rail-lights-on|^light-pool|^icon-|^nuke-blast|^rally|^oneway|^bunker-fire|^disruptor-pulse|^mortar-flash|^streetlamp-.*-(lit|pool)|^fx-|^(smelter|refinery)-work-|^turret-charge-|-hollow$)/; // (the Hollow's standing pieces are night renders: it is always night there)
const TOD_VEHICLES = ['truck', 'tanker', 'roadtrain', 'freight-loco', 'crawler', 'worker', 'hauler', 'agribot', 'paver', 'warbot'];

const TOD = { on: true, state: null, active: false, sets: {}, shared: {}, keys: null, poolTint: {}, over: null };

/**
 * The time of day setting (a display setting kept on this device): 'cycle' (morning to night, 12 minutes
 * round), 'day' (always day, the cycle off) or 'night' (always night: the cities' lights all game).
 */
const TOD_MODES = ['cycle', 'day', 'night'];
const TOD_MODE_NAMES = { cycle: 'Cycle', day: 'Always day', night: 'Always night' };
/**
 * The setting as it applies now: what this device keeps (TOD.mode), unless the game overrules it (todForced): with
 * the Murmur in the game it can't be always day (they live by the night: the cycle shows instead), and an
 * always-night map (the Hollow) is always night. The game's own logic never reads any of this (see murmurNight).
 */
function todMode() { const f = todForced(); return f === 'night' ? 'night' : f === 'murmur' && TOD.mode === 'day' ? 'cycle' : TOD.mode; }
/** The setting as kept on this device, whatever the game overrules. */
function todStored() { return TOD.mode; }
/**
 * Does the game overrule the setting? 'night': a map where it's always night (the Hollow: no daylight underground but
 * down the breach shafts; SHAPE_PRESETS alwaysNight), whatever the setting and photo mode's slider; 'murmur': the
 * Murmur are in the game, so no always day (TOD.force, set by ui.js); else ''. Looks only: the game itself never asks
 * what the light is (the Murmur's nights and surges come from its clock: murmurNight).
 */
function todForced() {
  if (typeof S !== 'undefined' && S && S.settings && typeof SHAPE_PRESETS !== 'undefined' && (SHAPE_PRESETS[S.settings.shape || 0] || {}).alwaysNight && !todHeld()) return 'night';
  try { return typeof TOD.force === 'function' ? TOD.force() || '' : ''; } catch (e) { return ''; }
}
function setTodMode(m) {
  TOD.mode = TOD_MODES.includes(m) ? m : 'cycle';
  TOD.on = TOD.mode !== 'day';
  try { localStorage.setItem('botfall.daynight', TOD.mode === 'day' ? '0' : TOD.mode === 'night' ? 'night' : '1'); } catch (e) { /* storage unavailable */ }
}
/** Is the light changing at all (the cycle, or always night: by the setting, or on a planet where it's always night)? */
function todEnabled() { return todMode() !== 'day'; }
function setTodEnabled(on) { setTodMode(on ? 'cycle' : 'day'); }
TOD.mode = 'cycle';
try { const v = localStorage.getItem('botfall.daynight'); if (v === '0') { TOD.mode = 'day'; TOD.on = false; } else if (v === 'night') TOD.mode = 'night'; } catch (e) { /* storage unavailable */ }

const todLerp = (a, b, f) => a + (b - a) * f;

/** The light at game time t (seconds): { a, b, f (0..1 from a to b), name, mul, add, shadow, lights, headlights, pools }. */
function todAt(t) { const p = todPhase(t); return todMix(p.a, p.b, p.f); }

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

/**
 * The time of day now (the game's clock; always day with the cycle off, always night set to night). Photo mode's
 * slider shows the light at another time instead (TOD.over, seconds into the cycle; null otherwise): for looks only,
 * the game's clock goes on as it was (see js/photo.js).
 */
function todNow() {
  // (Photo mode's slider shows another time of day, but not where it's always night: the Hollow has no daylight.)
  if (TOD.over != null && todForced() !== 'night') return todAt(TOD.over);
  const m = todMode();
  return m === 'night' ? todMix('night', 'night', 0) : m !== 'day' && S && !todHeld() ? todAt(S.time) : todMix('day', 'day', 0);
}
/** Is the menu's demo held at daylight while it fast-forwards (TOD.dayHold, set in main.js; never in a game)? */
function todHeld() { return !!TOD.dayHold && !(typeof UI !== 'undefined' && UI.inGame); }
/** The name of the time of day now ('morning', 'day', 'evening' or 'night'). */
function todName() { return todNow().name; }

/** Once a frame, before drawing: work out the light and make sure the sets in use are loading. */
function todFrame() {
  const st = todNow();
  TOD.state = st;
  TOD.active = st.a !== 'day' || st.b !== 'day';
  const over = TOD.over != null && todForced() !== 'night'; // (photo mode's time of day: its sets load whatever the setting)
  const m = todMode();
  if (!S || (!over && (m === 'day' || (todHeld() && m !== 'night')))) { for (const name in TOD.sets) todDropSet(name); return; } // (switched off, or held at day: nothing is kept)
  // The sets in use now and the next one coming (looked up a little ahead), and no others.
  const at = over ? TOD.over : S.time;
  const want = m === 'night' && !over ? new Set(['night']) : new Set([st.a, st.b, todAt(at + 45).a, todAt(at + 45).b]);
  want.delete('day');
  for (const name of want) todLoadSet(name);
  for (const name in TOD.sets) if (!want.has(name)) todDropSet(name);
  todLoadShared();
  todWarm();
}

/** Where a sprite's time-of-day version is: art/tod/<time>/<the day file's path, as .webp>. */
function todSrc(name, key) {
  const e = typeof ART_MANIFEST === 'object' && ART_MANIFEST[key];
  const src = e && (typeof e === 'string' ? e : e.src);
  return src && !/^data:/.test(src) ? `art/tod/${name}/${src.replace(/\.(png|webp)$/, '.webp')}` : null;
}

function todKeySet() {
  if (!TOD.keys) TOD.keys = new Set([...(typeof TOD_KEYS !== 'undefined' ? TOD_KEYS : []), ...(typeof MURMUR_TOD_KEYS !== 'undefined' ? MURMUR_TOD_KEYS : []), ...(typeof LANDMARK_TOD_KEYS !== 'undefined' ? LANDMARK_TOD_KEYS : [])]);
  return TOD.keys;
}

/**
 * Start loading a time-of-day set: one image per sprite on the web, or the set's bundle
 * (tod-<time>.js, data URIs) next to a single-file copy of the game.
 */
function todLoadSet(name) {
  if (TOD.sets[name]) return;
  const set = TOD.sets[name] = { imgs: {}, n: 0 };
  todMurmurAdd(name, set); // (the Murmur's, in a game with them: from their own bundle)
  todLandmarkAdd(name, set); // (a Contingency battle's landmark's, likewise: js/landmarks.js)
  if (typeof window !== 'undefined' && window.TOD_BUNDLE) {
    const go = () => { const d = window.TOD_DATA && window.TOD_DATA[name]; if (d) for (const key in d) todAdd(name, set, key, d[key]); };
    if (window.TOD_DATA && window.TOD_DATA[name]) { go(); return; }
    const s = document.createElement('script');
    s.src = `tod-${name}.js`;
    s.onload = go;
    s.onerror = () => { set.failed = true; }; // no bundle: graded day art stands in
    document.head.appendChild(s);
    return;
  }
  for (const key of typeof TOD_KEYS !== 'undefined' ? TOD_KEYS : []) { const src = todSrc(name, key); if (src) todAdd(name, set, key, src); }
}

/** One sprite's re-lit version for set `name` (src: a file or data URI), into the set once it has loaded. */
function todAdd(name, set, key, src) {
  loadImg(src, (img) => {
    if (TOD.sets[name] !== set) return;
    set.imgs[key] = img; set.n++;
    // (the graded copy that stood in for it while it loaded has done its job)
    const a = ART[key];
    if (a && a.graded && a.graded[name]) { todFree(a.graded[name]); delete a.graded[name]; }
  });
}

/**
 * The Murmur's re-lit sprites (MURMUR_TOD_KEYS) join a set only once their art is wanted (ensureMurmurArt): from the
 * Murmur's bundle in a single-file copy, else from their files.
 */
function todMurmurAdd(name, set) {
  if (typeof _murmurArt === 'undefined' || _murmurArt.state !== 'in' || set.murmur || typeof MURMUR_TOD_KEYS === 'undefined') return;
  set.murmur = true;
  const d = typeof window !== 'undefined' && window.MURMUR_BUNDLE ? window.MURMUR_DATA && window.MURMUR_DATA[name] : null;
  for (const key of MURMUR_TOD_KEYS) { const src = d ? d[key] : todSrc(name, key); if (src) todAdd(name, set, key, src); }
}
/** The landmarks' re-lit sprites (LANDMARK_TOD_KEYS), likewise once their art is wanted (ensureLandmarkArt). */
function todLandmarkAdd(name, set) {
  if (typeof _lmArt === 'undefined' || _lmArt.state !== 'in' || set.landmark || typeof LANDMARK_TOD_KEYS === 'undefined') return;
  set.landmark = true;
  const d = typeof window !== 'undefined' && window.LANDMARK_BUNDLE ? window.LANDMARK_DATA && window.LANDMARK_DATA[name] : null;
  for (const key of LANDMARK_TOD_KEYS) { const src = d ? d[key] : todSrc(name, key); if (src) todAdd(name, set, key, src); }
}
function todLandmarkIn() { for (const name in TOD.sets) todLandmarkAdd(name, TOD.sets[name]); }
/** The Murmur's art has come in: the sets already loaded take their re-lit sprites too. */
function todMurmurIn() { for (const name in TOD.sets) todMurmurAdd(name, TOD.sets[name]); }

/**
 * Let a set go once it's no longer in use: every sprite's re-lit and graded copies for that time go with it,
 * the green and purple teams' too (their art isn't enumerable, and one not asked for yet is still a getter:
 * see loadArtKey).
 */
function todDropSet(name) {
  delete TOD.sets[name];
  if (typeof window !== 'undefined' && window.TOD_DATA) delete window.TOD_DATA[name];
  for (const k of Object.getOwnPropertyNames(ART)) {
    const a = Object.getOwnPropertyDescriptor(ART, k).value;
    if (!a) continue;
    if (a.todv && a.todv[name]) { todFree(a.todv[name]); delete a.todv[name]; }
    if (a.graded && a.graded[name]) { todFree(a.graded[name]); delete a.graded[name]; }
  }
}

/**
 * Let go of a re-lit or graded copy of a sprite. Its canvases (the small copies artMip made, and the copy itself
 * when it was graded or recoloured here) are emptied at once rather than left for the browser to collect: a
 * phone has only so much canvas memory.
 */
function todFree(v) {
  if (v.mips) for (const m of v.mips) m.width = m.height = 0;
  v.mips = null;
  if (v.img && v.img.getContext) v.img.width = v.img.height = 0;
}

/**
 * Getting the coming light's art ready ahead of the change. A sprite's first draw from a new set has to unpack
 * its image and make its small copies (and the green and purple teams' are recoloured from the other two):
 * everything on screen doing that in the one frame the light began to change stalled the game for a moment. So
 * the sprites drawn in the last half minute (R.artSeen, see drawArt) get theirs made a couple a frame, as each
 * set arrives.
 */
function todWarm() {
  const list = R.artSeen;
  let any = false;
  for (const name in TOD.sets) { any = true; break; }
  if (!any || !list || !list.length) return;
  const keys = todKeySet(), t0 = performance.now();
  let made = 0;
  for (let n = Math.min(list.length, 60); n > 0 && made < 2; n--) {
    const art = list[(TOD.warmAt = ((TOD.warmAt || 0) + 1) % list.length)], key = art.key || '';
    if (R.time - art.seen > 30 || TOD_NEVER.test(key)) continue;
    const tm = /@[23](?![0-9])/.exec(key);
    for (const name in TOD.sets) {
      const set = TOD.sets[name], has = (k) => keys.has(k) && !!set.imgs[k];
      let v = art.todv && art.todv[name];
      if (!v) {
        const red = tm ? key.replace(tm[0], '@1') : key, cyan = tm ? key.replace(tm[0], '@0') : key;
        if (keys.has(red)) { // one with a re-lit version: once its image is in (and both teams', for a recoloured one)
          if (!(tm ? has(red) && (!ART[cyan] || has(cyan)) : has(key))) continue;
          v = todVariant(art, name); made++;
        } else if (!(v = art.graded && art.graded[name])) { // one that's only ever graded
          if (!set.n) continue;
          v = todGraded(art, name); made++;
        }
      }
      if (v !== art && !v.mips && v.img.width >= 64) { artMip(v, 1); made++; }
      if (made >= 2 || performance.now() - t0 > 3) return;
    }
  }
}

/** Headlights and the light pool (small; loaded once the light first fades). */
function todLoadShared() {
  if (TOD.sharedLoading) return;
  TOD.sharedLoading = true;
  const inline = typeof window !== 'undefined' && window.TOD_SHARED;
  for (const k of [...TOD_VEHICLES.map((v) => v + '-headlights'), 'light-pool']) {
    loadImg(inline && inline[k] ? inline[k] : `art/tod/shared/${k}.webp`, (img) => { TOD.shared[k] = img; });
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
  const tm = set && /@[23](?![0-9])/.exec(key);
  let v = null;
  if (tm) {
    // The green and purple teams: the re-lit red version recoloured, like the day art.
    const r = ART[key.replace(tm[0], '@1')], c = ART[key.replace(tm[0], '@0')];
    const rv = r && todVariant(r, name), cv = c && todVariant(c, name);
    if (rv && rv.relit && (!cv || cv.relit)) {
      const g = recolorArt(rv, cv && cv.relit ? cv : null, +tm[0][1]);
      if (g && g !== rv) v = Object.assign(g, { relit: true, key });
    }
  } else if (set && keys.has(key) && set.imgs[key]) {
    v = { img: set.imgs[key], scale: art.scale, anchor: art.anchor, shadow: art.shadow, key, relit: true };
  }
  if (!v) return todGraded(art, name);
  // (the graded copy that stood in while the set loaded isn't needed any more)
  if (art.graded && art.graded[name]) { todFree(art.graded[name]); delete art.graded[name]; }
  return (cache[name] = v);
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
      if (S.pave[t] === 3) {
        // An Express lane: the lamp stands on the median barrier between a pair (carried by the lane whose partner lies
        // south or east of it), on a lone lane's shoulder.
        const m = laneMate(t), lew = S.road[t] === 2 || S.road[t] === 4;
        if (m === 0 || m === 3) continue;
        out.push({ ent: 'lamp', i, j, kind: 'asphalt', owner: Math.max(0, wayOwner(t)), x: m === 1 ? i + 1 : lew ? i + 0.5 : i + 0.08, y: m === 2 ? j + 1 : lew ? j + 0.94 : j + 0.5 });
        continue;
      }
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
  const on = (TOD.active && !murmurDarkAt(e.i, e.j) ? TOD.state.lights : 0) * drunkLight(e.i + 0.5, e.j + 0.5), lit = artFor('streetlamp-' + e.kind + '-lit', e.owner); // (out where the Murmur cut the lights; dimmed where a Leech drinks)
  if (on > 0.01 && lit) { const ga = ctx.globalAlpha; ctx.globalAlpha = ga * on; drawArtRaw(ctx, lit, x, y, z); ctx.globalAlpha = ga; }
}

function drawStreetLights(ctx, ox, oy, z, v0, v1) {
  if (!TOD.active || !(TOD.state.lights > 0.01) || !S.road) return;
  const on = TOD.state.lights, head = Math.max(1.2, z * 0.05);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const e of streetLamps(v0, v1)) {
    if (murmurDarkAt(e.i, e.j)) continue; // (the Murmur cut the lights here)
    const L = STREETLIGHT[e.kind], w = z * L.r * 2, pool = ART['streetlamp-' + e.kind + '-pool'];
    const x = ox + (e.i + 0.5) * z, y = oy + (e.j + 0.5) * z, dim = drunkLight(e.i + 0.5, e.j + 0.5);
    ctx.globalAlpha = on * L.a * dim;
    if (pool) ctx.drawImage(pool.img, x - w / 2, y - w * 0.4, w, w * 0.8);
    else ctx.drawImage(streetGlow(e.kind), x - w / 2, y - w * 0.4, w, w * 0.8); // seen at an angle: a little squashed
    if (artFor('streetlamp-' + e.kind, e.owner)) continue; // the post's own lit head shows the lamp
    ctx.globalAlpha = on;
    ctx.fillStyle = L.head;
    ctx.beginPath(); ctx.arc(x, y, head, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

/** The light-pool image tinted `color` (made once per colour); null until the image has loaded. */
function lightPool(color) {
  const pool = TOD.shared['light-pool'];
  if (!pool) return null;
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
  return tinted;
}

/**
 * At dusk and night, a glow in `color` on the ground (round a blast, a muzzle, a flak burst). The glows round
 * buildings' pads are the same image, drawn all together in render.
 */
function drawLightPool(ctx, x, y, z, color) {
  if (!TOD.active || !(TOD.state.pools > 0.01)) return;
  const tinted = lightPool(color);
  if (!tinted) return;
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
 * At dusk and night, roads light up: a thin glowing line in the owner's colour along each road's edges
 * (brighter on asphalt), so a colony's road network shows as lit lines across the dark. (Graphics on Saver: the lines
 * without the wider glow round them.)
 */
function drawRoadGlow(ctx, ox, oy, z, v0, v1) {
  if (!TOD.active || !(TOD.state.lights > 0.01) || !S.road) return;
  const W = S.W, H = S.H, on = TOD.state.lights, inset = 0.09;
  const i0 = Math.max(0, Math.floor(v0.x) - 1), i1 = Math.min(W - 1, Math.ceil(v1.x) + 1);
  const j0 = Math.max(0, Math.floor(v0.y) - 1), j1 = Math.min(H - 1, Math.ceil(v1.y) + 1);
  const road = (i, j) => i >= 0 && j >= 0 && i < W && j < H && S.road[j * W + i];
  const paths = {}, lanes = [];
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const t = j * W + i;
    if (!S.road[t] || S.bAt[t] || murmurDarkAt(i, j)) continue; // (where the Murmur put the lights out: dark)
    if (S.pave[t] === 3) { lanes.push(t); continue; } // (an Express lane lights its own cat's-eyes and median: below)
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
    if (gfx().night) { ctx.globalAlpha = on * (asph ? 0.2 : 0.13); ctx.lineWidth = Math.max(2, z * 0.11); ctx.stroke(paths[key]); } // the glow
    ctx.globalAlpha = on * (asph ? 0.85 : 0.6); ctx.lineWidth = Math.max(1, z * 0.028); ctx.stroke(paths[key]); // the strip
  }
  // Express lanes: strings of cat's-eyes (white down the lane line, amber by the median, red along the shoulder) at a
  // quarter and three quarters along each tile, and a strip in the owner's colour along the median barrier of a pair
  // (drawn by the lane whose partner lies south or east). A lane worn through is asphalt, and dark.
  if (lanes.length) {
    const e = Math.max(1.2, z * 0.06), LW = 28 / 32, e0 = (1 - LW) / 2, e1 = 1 - e0;
    ctx.globalAlpha = on * 0.9;
    for (const t of lanes) {
      const i = t % W, j = (t / W) | 0, r = S.road[t], ew = r === 2 || r === 4, m = laneMate(t), lo = m === 0 || m === 3, hi = m === 2 || m === 1;
      const in0 = e0 + (lo ? 4.5 : 3.5) / 32, in1 = e1 - (hi ? 4.5 : 3.5) / 32, mid = (in0 + in1) / 2;
      const dot = (along, across, col) => { ctx.fillStyle = col; const px = ox + (ew ? i + along : i + across) * z, py = oy + (ew ? j + across : j + along) * z; ctx.fillRect(px - e / 2, py - e / 2, e, e); };
      for (const a of [0.25, 0.75]) { dot(a, mid, '#fafaf0'); dot(a, in0 - 1.4 / 32, lo ? '#ffd166' : '#ff463c'); dot(a, in1 + 1.4 / 32, hi ? '#ffd166' : '#ff463c'); }
      if (hi) {
        const o = wayOwner(t), col = o >= 0 ? PLAYER_COLORS[o] || '#ffd9a0' : '#ffd9a0';
        ctx.fillStyle = col; ctx.globalAlpha = on * 0.7;
        if (ew) ctx.fillRect(ox + i * z, oy + (j + e1) * z - e * 0.4, z, e * 0.8); else ctx.fillRect(ox + (i + e1) * z - e * 0.4, oy + j * z, e * 0.8, z);
        ctx.globalAlpha = on * 0.9;
      }
    }
  }
  ctx.restore();
}

/**
 * Graphics set to Ultra (gfx().night 2): at dusk and night every robot and vehicle on the ground carries a small light in
 * its colony's colour, so an army on the move shows as moving lights. Drawn among the buildings' pools (ctx is already
 * adding light, at the pools' strength).
 */
function drawUnitLights(ctx, ox, oy, z, items) {
  const ga = ctx.globalAlpha, s = z * 1.15;
  ctx.globalAlpha = ga * 0.6;
  for (const e of items) {
    if (e.ent !== 'u' || BOTS[e.type].air || BOTS[e.type].wild) continue; // (the Murmur light the ground their own way: drawMurmurLights)
    const img = PLAYER_COLORS[e.owner] && lightPool(PLAYER_COLORS[e.owner]);
    if (img) ctx.drawImage(img, ox + e.x * z - s / 2, oy + e.y * z - s / 2, s, s);
  }
  ctx.globalAlpha = ga;
}

/**
 * At dusk and night, the Murmur's crystal throws violet light on the ground round each of them, as bright as they're
 * charged, breathing slowly (a Leech drinking, quickly); faint round a Sapper's heave, where the colony can see it.
 * Drawn among the buildings' pools (ctx is already adding light, at the pools' strength).
 */
function drawMurmurLights(ctx, ox, oy, z, items) {
  const img = lightPool(WILD_COLOR);
  if (!img) return;
  const ga = ctx.globalAlpha;
  for (const e of items) {
    if (e.ent !== 'u' || !BOTS[e.type] || !BOTS[e.type].wild) continue;
    if (e.pose === 'under' && !murmurInSight(e)) continue;
    const L = MURMUR_LOOK[e.type] || MURMUR_LOOK.scuttler, id = e.id || 0;
    const pulse = e.pose === 'feed' ? 0.9 + 0.3 * Math.max(0, Math.sin(R.time * 8 + id)) : 0.85 + 0.15 * Math.sin(R.time * 2.4 + id * 1.7);
    const k = (0.15 + 0.85 * murmurCharge(e)) * pulse * (e.pose === 'under' ? 0.45 : 1) * (L.light ? 1.4 : 1), sz = z * (L.light || L.size * 2.4);
    ctx.globalAlpha = ga * Math.min(1, 0.8 * k);
    ctx.drawImage(img, ox + e.x * z - sz / 2, oy + e.y * z - sz / 2, sz, sz);
  }
  ctx.globalAlpha = ga;
}

/**
 * How much of a light is left (0..1) at (x, y) while a Leech drinks beside it (u.pose 'feed'): the lamps and the glow
 * round a building it has its star pressed to go dim as it drinks (the lore: "the lights dim as they drink").
 */
function drunkLight(x, y) {
  if (!S || !S.wildlife) return 1;
  if (R.feedersAt !== R.time) { R.feedersAt = R.time; R.feeders = S.bots.filter((u) => !u.dead && u.pose === 'feed'); }
  let k = 1;
  for (const u of R.feeders) { const d = Math.hypot(u.x - x, u.y - y); if (d < 1.4) k = Math.min(k, 0.15 + 0.85 * Math.max(0, (d - 0.5) / 0.9)); }
  return k;
}

/** A bot's drop shadow now: offset (as a fraction of the shadow's length), opacity and spread. */
function todShadow() {
  const D = TOD_TIMES.day.shadow, sh = TOD.active ? TOD.state.shadow : D;
  const long = typeof duskShadowLength === 'function' ? duskShadowLength() : 1; // (longer with the sun low: js/sunset.js)
  return { kx: 0.12 * (sh.dx / D.dx) * long, ky: 0.16 * (sh.dy / D.dy), alpha: 0.32 * (sh.alpha / D.alpha), grow: 1 + (sh.blur - 1) * 0.35 };
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

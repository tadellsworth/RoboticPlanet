/*
 * Weather, for looks only (it changes nothing in the game): now and then a sandstorm blows in across the red
 * desert, a rainstorm with fog and lightning sweeps the jungle, or a blizzard whites out the poles. The weather
 * comes from the planet's seed and the game clock alone (weatherAt), so it needs no saved state and plays the
 * same on every device. The front blows in from upwind, the storm holds a minute or two, then clears.
 * A display setting, on by default (weatherOn / setWeatherOn; the Pause menu and the new-game menu).
 * A planet event's dust storm (S.event) takes the place of the weather while it lasts.
 */
const WEATHER = {
  slot: 420,     // seconds: at most one spell of weather in each stretch this long (none in the first)
  chance: 0.5,   // of a spell in a stretch
  kinds: { desert: 'sand', jungle: 'rain', polar: 'snow' },
  names: { sand: 'A sandstorm', rain: 'A rainstorm', snow: 'A blizzard' },
};
let WX_ON = true;
try { WX_ON = localStorage.getItem('botfall.weather') !== '0'; } catch (e) { /* storage unavailable */ }
function weatherOn() { return WX_ON; }
function setWeatherOn(on) { WX_ON = !!on; try { localStorage.setItem('botfall.weather', on ? '1' : '0'); } catch (e) { /* storage unavailable */ } }

/** The weather at game time t: null, or { kind, k (0..1 how heavy now), front (0..1 how far the front has blown across), dir, slot }. */
function weatherAt(t) {
  if (!S || !S.settings) return null;
  const kind = WEATHER.kinds[biome()];
  if (!kind) return null;
  const n = Math.floor(t / WEATHER.slot), seed = (S.seed || 1) | 0;
  if (n < 1 || hash2(seed, n, 71) >= WEATHER.chance) return null;
  const t0 = n * WEATHER.slot + 40 + hash2(seed, n, 72) * 160, len = 80 + hash2(seed, n, 73) * 90;
  const x = t - t0;
  if (x < 0 || x > len) return null;
  const rise = kind === 'rain' ? 10 : 14, fall = 16;
  const k = clamp(Math.min(x / rise, (len - x) / fall), 0, 1) * (0.7 + 0.3 * hash2(seed, n, 74));
  return { kind, k, front: clamp(x / rise, 0, 1), dir: hash2(seed, n, 75) < 0.5 ? 1 : -1, slot: n, x };
}

/** A soft round cloud in an rgb colour (cached), for the storm's billows. */
function wxCloud(rgb) {
  R.wxClouds = R.wxClouds || {};
  if (R.wxClouds[rgb]) return R.wxClouds[rgb];
  const n = 96, c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d'), gr = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  gr.addColorStop(0, `rgba(${rgb},0.7)`); gr.addColorStop(0.5, `rgba(${rgb},0.35)`); gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, n, n);
  return (R.wxClouds[rgb] = c);
}

/** Wrap screen coordinate v (px) into [-m, span + m). */
function wxWrap(v, span, m) { const w = span + 2 * m; return ((v % w) + w) % w - m; }

/**
 * A storm front blowing across the view (the sandstorm and the blizzard): a haze that sweeps in from upwind and
 * then fills the view, thicker toward its edges (you can't see far), billows rolling past with the wind, and
 * streaks of sand or snow driven along. C: { haze, edge, cloud, streak (rgb), a (haze alpha), n (streaks) }.
 */
function wxStorm(ctx, W, C, camX, camY) {
  const k = W.k, dir = W.dir, t = R.time, cw = R.w, ch = R.h;
  const fx = dir > 0 ? -0.3 * cw + W.front * 1.6 * cw : 1.3 * cw - W.front * 1.6 * cw;
  const ahead = (x) => W.front < 1 && (x - fx) * dir > 0; // not reached by the front yet
  if (W.front < 1) {
    const g = ctx.createLinearGradient(fx - dir * cw * 0.35, 0, fx + dir * cw * 0.35, 0);
    g.addColorStop(0, `rgba(${C.haze},${C.a * k})`); g.addColorStop(1, `rgba(${C.haze},0)`);
    ctx.fillStyle = g;
  } else ctx.fillStyle = `rgba(${C.haze},${C.a * k})`;
  ctx.fillRect(0, 0, cw, ch);
  const v = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.18, cw / 2, ch / 2, Math.max(cw, ch) * 0.72);
  v.addColorStop(0, `rgba(${C.edge},0)`); v.addColorStop(1, `rgba(${C.edge},${0.62 * k * W.front})`);
  ctx.fillStyle = v; ctx.fillRect(0, 0, cw, ch);
  // billows rolling past
  const cloud = wxCloud(C.cloud);
  for (let n = 0; n < 22; n++) {
    const h1 = hash2(n, 3, 91), h2 = hash2(n, 5, 93), sp = (110 + 170 * hash2(n, 7, 95)) * dir;
    const s = Math.max(cw, ch) * (0.22 + 0.32 * hash2(n, 9, 97));
    const x = wxWrap(h1 * cw + t * sp - camX, cw, s), y = wxWrap(h2 * ch + Math.sin(t * 0.3 + n) * 30 - camY, ch, s / 2);
    if (ahead(x)) continue;
    ctx.globalAlpha = 0.62 * k;
    ctx.drawImage(cloud, x - s / 2, y - s * 0.3, s, s * 0.6);
  }
  ctx.globalAlpha = 1;
  // driven streaks: long and fast, plus a finer, faster layer of grains or flakes
  ctx.strokeStyle = `rgba(${C.streak},${0.6 * k})`;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (let n = 0; n < C.n; n++) {
    const h1 = hash2(n, 7, 31), h2 = hash2(n, 13, 77), sp = (420 + 420 * h2) * dir;
    const x = wxWrap(h1 * cw + t * sp - camX * 1.1, cw, 60), y = wxWrap(h2 * ch + t * (24 + C.drop * h1) - camY * 1.1, ch, 10);
    if (ahead(x)) continue;
    ctx.moveTo(x, y); ctx.lineTo(x - dir * (18 + h1 * 30), y - 2 - h2 * 3 - C.drop * 0.02);
  }
  ctx.stroke();
  ctx.fillStyle = `rgba(${C.streak},${0.75 * k})`;
  ctx.beginPath();
  for (let n = 0; n < C.n; n++) {
    const h1 = hash2(n, 37, 61), h2 = hash2(n, 41, 63), sp = (600 + 500 * h1) * dir, r = C.dot * (0.6 + h2);
    const x = wxWrap(h1 * cw + t * sp - camX * 1.2, cw, 20), y = wxWrap(h2 * ch + t * (40 + C.drop * h2) + Math.sin(t * 3 + n) * 6 - camY * 1.2, ch, 10);
    if (ahead(x)) continue;
    ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI * 2);
  }
  ctx.fill();
}

/** Draw the weather over the whole view (after everything on the ground and in the air, under the HUD). */
function drawWeather(ctx, ox, oy, z) {
  if (!WX_ON || (S.event && S.event.type === 'dust')) return;
  const W = weatherAt(S.time);
  if (!W || W.k < 0.01) return;
  if (R.wxSlot !== W.slot && W.x < 20 && typeof postMsg === 'function') postMsg(0, `${WEATHER.names[W.kind]} is blowing in.`, undefined, undefined, 'info');
  R.wxSlot = W.slot;
  const night = fxNight() > 0.3, k = W.k, dir = W.dir, t = R.time, cw = R.w, ch = R.h;
  const camX = R.cam.x * z, camY = R.cam.y * z; // so the weather moves over the ground, not stuck to the screen
  ctx.save();
  if (W.kind === 'sand') {
    wxStorm(ctx, W, night
      ? { haze: '70,48,32', edge: '58,40,26', cloud: '104,74,50', streak: '150,112,80', a: 0.4, n: 160, dot: 1.2, drop: 30 }
      : { haze: '184,132,74', edge: '160,110,60', cloud: '204,156,100', streak: '242,210,156', a: 0.5, n: 160, dot: 1.2, drop: 30 }, camX, camY);
  } else if (W.kind === 'snow') {
    // the blizzard: a white-out driven by a gale
    wxStorm(ctx, W, night
      ? { haze: '120,136,160', edge: '96,110,136', cloud: '170,184,206', streak: '220,232,250', a: 0.34, n: 260, dot: 1.8, drop: 160 }
      : { haze: '226,234,246', edge: '236,242,252', cloud: '246,250,255', streak: '255,255,255', a: 0.42, n: 260, dot: 1.8, drop: 160 }, camX, camY);
  } else {
    // the rainstorm: a dark overcast, sheets of driving rain, splashes, fog banks drifting through, and lightning
    ctx.fillStyle = `rgba(20,28,40,${(night ? 0.3 : 0.32) * k})`; ctx.fillRect(0, 0, cw, ch);
    const fog = wxCloud(night ? '112,124,140' : '206,214,222');
    for (let n = 0; n < 12; n++) {
      const h1 = hash2(n, 43, 11), h2 = hash2(n, 47, 13), s = Math.max(cw, ch) * (0.35 + 0.4 * hash2(n, 53, 17));
      const x = wxWrap(h1 * cw + t * (14 + 18 * h2) * dir - camX, cw, s), y = wxWrap(h2 * ch + Math.sin(t * 0.15 + n) * 20 - camY, ch, s / 3);
      ctx.globalAlpha = (night ? 0.35 : 0.5) * k;
      ctx.drawImage(fog, x - s / 2, y - s * 0.2, s, s * 0.4);
    }
    ctx.globalAlpha = 1;
    const v = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.25, cw / 2, ch / 2, Math.max(cw, ch) * 0.75);
    v.addColorStop(0, 'rgba(150,160,172,0)'); v.addColorStop(1, `rgba(${night ? '60,68,80' : '170,178,188'},${0.45 * k})`);
    ctx.fillStyle = v; ctx.fillRect(0, 0, cw, ch);
    ctx.strokeStyle = night ? `rgba(170,190,215,${0.42 * k})` : `rgba(220,232,248,${0.5 * k})`;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    for (let n = 0; n < 380; n++) {
      const h1 = hash2(n, 17, 41), h2 = hash2(n, 19, 43), fall = 900 + 600 * h2;
      const x = wxWrap(h1 * cw + t * fall * 0.3 * dir - camX, cw, 40), y = wxWrap(h2 * ch + t * fall - camY, ch, 40);
      ctx.moveTo(x, y); ctx.lineTo(x - dir * 8, y - 24 - 14 * h1);
    }
    ctx.stroke();
    // splashes on the ground: little rings that flicker up and fade
    ctx.strokeStyle = night ? `rgba(160,180,205,${0.4 * k})` : `rgba(225,235,250,${0.45 * k})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let n = 0; n < 70; n++) {
      const ph = (t * 2.2 + hash2(n, 59, 19)) % 1, cyc = Math.floor(t * 2.2 + hash2(n, 59, 19));
      const x = wxWrap(hash2(n, cyc, 61) * cw - camX, cw, 10), y = wxWrap(hash2(cyc, n, 67) * ch - camY, ch, 10), r = 2 + ph * 5;
      ctx.moveTo(x + r, y); ctx.ellipse(x, y, r, r * 0.45, 0, 0, Math.PI * 2);
    }
    ctx.stroke();
    // lightning: a flash of the whole sky now and then (brighter at night), sometimes a double flicker
    const bolt = Math.floor(S.time / 5), at = hash2(S.seed | 0, bolt, 81) * 5, since = S.time - bolt * 5 - at;
    if (hash2(bolt, 3, 83) < 0.4 && since > 0 && since < 0.4) {
      const on = since < 0.07 || (since > 0.15 && since < 0.21) ? 1 : 0.25;
      ctx.fillStyle = `rgba(225,232,255,${(night ? 0.42 : 0.22) * k * on})`;
      ctx.fillRect(0, 0, cw, ch);
    }
  }
  ctx.restore();
}

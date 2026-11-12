/*
 * Weather, for looks only (it changes nothing in the game): now and then a sandstorm blows in across the red
 * desert, a rainstorm with fog and lightning sweeps the forest, a blizzard whites out the poles, ash and embers
 * fall on the volcanic ashlands, meteors streak over the moon, a gale strips the autumn forest, dust devils
 * whirl over the savanna, an aurora ripples over the alien bloom, or a thick fog (and fireflies by night)
 * settles on the swamp. The weather
 * comes from the planet's seed and the game clock alone (weatherAt), so it needs no saved state and plays the
 * same on every device. The front blows in from upwind, the storm holds a minute or two, then clears.
 * A display setting, on by default (weatherOn / setWeatherOn; the Pause menu and the new-game menu).
 * A planet event's dust storm (S.event) takes the place of the weather while it lasts.
 */
const WEATHER = {
  slot: 420,     // seconds: at most one spell of weather in each stretch this long (none in the first)
  chance: 0.5,   // of a spell in a stretch
  kinds: { desert: 'sand', jungle: 'rain', polar: 'snow', volcanic: 'ash', lunar: 'meteors', autumn: 'leaves', savanna: 'dust', alien: 'aurora', swamp: 'fog' },
  names: { sand: 'A sandstorm', rain: 'A rainstorm', snow: 'A blizzard', ash: 'An ashfall', meteors: 'A meteor shower', leaves: 'A gale', dust: 'Dust devils', aurora: 'An aurora', fog: 'A thick fog' },
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
  const rise = kind === 'rain' ? 10 : kind === 'fog' || kind === 'aurora' ? 24 : 14, fall = kind === 'fog' || kind === 'aurora' ? 24 : 16;
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
  } else if (W.kind === 'ash') wxAsh(ctx, W, night, camX, camY);
  else if (W.kind === 'meteors') wxMeteors(ctx, W, night, camX, camY);
  else if (W.kind === 'leaves') wxLeaves(ctx, W, night, camX, camY);
  else if (W.kind === 'dust') wxDust(ctx, W, night, camX, camY);
  else if (W.kind === 'aurora') wxAurora(ctx, W, night, camX, camY);
  else if (W.kind === 'fog') wxFog(ctx, W, night, camX, camY);
  else {
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

/** Ashfall: a dim, smoky sky, grey ash drifting down and swaying, and embers swirling up glowing. */
function wxAsh(ctx, W, night, camX, camY) {
  const k = W.k, t = R.time, cw = R.w, ch = R.h, dir = W.dir;
  ctx.fillStyle = `rgba(${night ? '40,26,22' : '86,72,64'},${(night ? 0.36 : 0.36) * k})`; ctx.fillRect(0, 0, cw, ch);
  const smoke = wxCloud(night ? '70,52,46' : '120,108,100');
  for (let n = 0; n < 10; n++) {
    const s = Math.max(cw, ch) * (0.3 + 0.35 * hash2(n, 3, 11)), x = wxWrap(hash2(n, 5, 13) * cw + t * 12 * dir - camX, cw, s), y = wxWrap(hash2(n, 7, 17) * ch - camY, ch, s / 3);
    ctx.globalAlpha = 0.4 * k; ctx.drawImage(smoke, x - s / 2, y - s * 0.2, s, s * 0.4);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = `rgba(${night ? '130,122,118' : '226,222,216'},${0.85 * k})`;
  ctx.beginPath();
  for (let n = 0; n < 420; n++) {
    const h1 = hash2(n, 11, 21), h2 = hash2(n, 13, 23), r = 1.1 + 1.8 * h2;
    const x = wxWrap(h1 * cw + Math.sin(t * (0.6 + h2) + n) * 18 + t * 14 * dir - camX, cw, 20), y = wxWrap(h2 * ch + t * (22 + 30 * h1) - camY, ch, 20);
    ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.globalCompositeOperation = 'lighter';
  for (let n = 0; n < 70; n++) {
    const h1 = hash2(n, 17, 31), h2 = hash2(n, 19, 33), life = 3 + 3 * h2, ph = ((t + h1 * life) % life) / life;
    const x = wxWrap(h1 * cw + Math.sin(t * 1.3 + n) * 26 + ph * 60 * dir - camX, cw, 20), y = wxWrap(h2 * ch - ph * 90 - camY, ch, 20);
    const a = Math.sin(ph * Math.PI) * k * (night ? 0.95 : 0.6), r = 1.2 + 1.6 * h1;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
    g.addColorStop(0, `rgba(255,190,90,${a})`); g.addColorStop(1, 'rgba(255,90,20,0)');
    ctx.fillStyle = g; ctx.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
  }
  ctx.globalCompositeOperation = 'source-over';
}

/** A meteor shower: bright streaks with fading tails across the sky (vivid at night, faint by day). */
function wxMeteors(ctx, W, night, camX, camY) {
  const k = W.k, t = R.time, cw = R.w, ch = R.h, dir = W.dir, vis = night ? 1 : 0.35;
  if (night) { ctx.fillStyle = `rgba(6,8,20,${0.18 * k})`; ctx.fillRect(0, 0, cw, ch); }
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (let n = 0; n < 36; n++) {
    const per = 1.8 + 2.6 * hash2(n, 3, 41), cyc = Math.floor((t + hash2(n, 5, 43) * per) / per), ph = ((t + hash2(n, 5, 43) * per) % per) / 0.9;
    if (ph > 1 || hash2(n, cyc, 45) > 0.35 + 0.6 * k) continue;
    const x0 = wxWrap(hash2(cyc, n, 47) * cw * 1.2 - camX * 0.2, cw, 60), y0 = wxWrap(hash2(n, cyc, 49) * ch * 0.6 - camY * 0.2, ch, 60);
    const len = 160 + 240 * hash2(cyc, n, 51), ang = (0.35 + 0.35 * hash2(n, cyc, 53)) * (dir > 0 ? 1 : -1);
    const dx = Math.cos(ang) * dir, dy = Math.abs(Math.sin(ang)), hx = x0 + dx * len * ph, hy = y0 + dy * len * ph;
    const tail = 70 + 90 * hash2(n, cyc, 55), a = Math.sin(ph * Math.PI) * k * vis;
    const g = ctx.createLinearGradient(hx - dx * tail, hy - dy * tail, hx, hy);
    g.addColorStop(0, 'rgba(160,200,255,0)'); g.addColorStop(1, `rgba(235,245,255,${0.95 * a})`);
    ctx.strokeStyle = g; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(hx - dx * tail, hy - dy * tail); ctx.lineTo(hx, hy); ctx.stroke();
    const h = ctx.createRadialGradient(hx, hy, 0, hx, hy, 9);
    h.addColorStop(0, `rgba(255,255,240,${a})`); h.addColorStop(1, 'rgba(180,210,255,0)');
    ctx.fillStyle = h; ctx.fillRect(hx - 9, hy - 9, 18, 18);
  }
  ctx.globalCompositeOperation = 'source-over';
}

/** A gale in the autumn forest: leaves torn off and tumbling past on the wind, spinning as they go. */
function wxLeaves(ctx, W, night, camX, camY) {
  const k = W.k, t = R.time, cw = R.w, ch = R.h, dir = W.dir;
  ctx.fillStyle = `rgba(${night ? '30,24,20' : '200,170,120'},${0.08 * k})`; ctx.fillRect(0, 0, cw, ch);
  const cols = night ? ['120,64,30', '110,40,24', '130,100,40', '80,56,34'] : ['226,120,40', '200,60,32', '236,184,60', '150,96,52', '214,148,48'];
  for (let n = 0; n < 190; n++) {
    const h1 = hash2(n, 23, 61), h2 = hash2(n, 29, 63), sp = (180 + 260 * h2) * dir * (0.6 + 0.4 * k);
    const x = wxWrap(h1 * cw + t * sp - camX * 1.05, cw, 30), y = wxWrap(h2 * ch + Math.sin(t * (1.5 + h1 * 2) + n) * 24 + t * (20 + 30 * h1) - camY * 1.05, ch, 30);
    const r = 3 + 3.5 * hash2(n, 31, 65), spin = t * (3 + 5 * h2) + n;
    ctx.fillStyle = `rgba(${cols[n % cols.length]},${0.9 * k})`;
    ctx.beginPath(); ctx.ellipse(x, y, r, r * Math.abs(Math.cos(spin)) * 0.55 + 0.6, spin * 0.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = `rgba(${night ? '150,150,160' : '255,250,235'},${0.18 * k})`;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let n = 0; n < 60; n++) {
    const h1 = hash2(n, 37, 67), h2 = hash2(n, 41, 69), x = wxWrap(h1 * cw + t * 520 * dir - camX, cw, 80), y = wxWrap(h2 * ch - camY, ch, 10);
    ctx.moveTo(x, y); ctx.quadraticCurveTo(x - dir * 30, y - 4, x - dir * 70, y + 2);
  }
  ctx.stroke();
}

/** Dust devils whirling across the savanna: a hot, hazy light and a few spinning columns of dust carrying grit. */
function wxDust(ctx, W, night, camX, camY) {
  const k = W.k, t = R.time, cw = R.w, ch = R.h, dir = W.dir;
  ctx.fillStyle = `rgba(${night ? '50,40,30' : '226,196,140'},${0.2 * k})`; ctx.fillRect(0, 0, cw, ch);
  const dust = wxCloud(night ? '96,80,62' : '210,176,120');
  for (let n = 0; n < 4; n++) {
    const h1 = (n + 0.2 + 0.6 * hash2(n, 3, 71)) / 4, h2 = 0.35 + 0.5 * hash2(n, 5, 73), sp = (30 + 40 * h2) * dir;
    const bx = wxWrap(h1 * cw + t * sp - camX * 0.6, cw, 120), by = h2 * ch + Math.sin(t * 0.4 + n) * 30;
    const hgt = 150 + 120 * hash2(n, 7, 75);
    for (let s = 0; s < 14; s++) {
      const q = s / 13, w = 18 + q * 70, sway = Math.sin(t * 2 + q * 3 + n) * q * 26, a = t * (5 + n) + q * 9;
      const x = bx + sway + Math.cos(a) * w * 0.25, y = by - q * hgt;
      ctx.globalAlpha = (0.8 - q * 0.45) * k;
      ctx.drawImage(dust, x - w, y - w * 0.3, w * 2, w * 0.6);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = `rgba(${night ? '110,96,80' : '120,96,64'},${0.7 * k})`;
    ctx.beginPath();
    for (let m = 0; m < 26; m++) {
      const q = hash2(n, m, 77), a = t * (6 + n) + m, r = 8 + q * 60;
      const x = bx + Math.cos(a) * r * 0.6, y = by - q * hgt + Math.sin(a) * r * 0.15;
      ctx.moveTo(x + 1.4, y); ctx.arc(x, y, 1.4, 0, Math.PI * 2);
    }
    ctx.fill();
  }
}

/** An aurora over the alien bloom: curtains of green, pink and violet light rippling across the sky (best at night), and glowing spores drifting up. */
function wxAurora(ctx, W, night, camX, camY) {
  const k = W.k * (night ? 1 : 0.35), t = R.time, cw = R.w, ch = R.h;
  ctx.globalCompositeOperation = 'lighter';
  const bands = [['80,255,170', '160,90,255'], ['255,90,200', '120,80,255'], ['90,220,255', '200,255,140']];
  bands.forEach(([c1, c2], b) => {
    const base = ch * (0.12 + 0.16 * b) - camY * 0.05, amp = 26 + 14 * b, depth = ch * (0.22 + 0.06 * b);
    for (let x = -40; x < cw + 40; x += 6) {
      const wx = x + camX * 0.05, y = base + Math.sin(wx * 0.006 + t * 0.35 + b) * amp + Math.sin(wx * 0.017 - t * 0.6 + b * 2) * amp * 0.4;
      const a = (0.075 + 0.05 * Math.sin(wx * 0.012 + t * 1.3 + b)) * k;
      const g = ctx.createLinearGradient(0, y, 0, y + depth);
      g.addColorStop(0, `rgba(${c1},0)`); g.addColorStop(0.15, `rgba(${c1},${a})`); g.addColorStop(0.6, `rgba(${c2},${a * 0.5})`); g.addColorStop(1, `rgba(${c2},0)`);
      ctx.fillStyle = g; ctx.fillRect(x, y, 6.5, depth);
    }
  });
  for (let n = 0; n < 90; n++) {
    const h1 = hash2(n, 3, 81), h2 = hash2(n, 5, 83), life = 5 + 4 * h2, ph = ((t + h1 * life) % life) / life;
    const x = wxWrap(h1 * cw + Math.sin(t * 0.8 + n) * 20 - camX, cw, 20), y = wxWrap(h2 * ch - ph * 120 - camY, ch, 20);
    const a = Math.sin(ph * Math.PI) * W.k * (night ? 0.9 : 0.4), r = 1.5 + 2 * h1;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
    g.addColorStop(0, `rgba(${n % 3 ? '255,140,230' : '170,255,210'},${a})`); g.addColorStop(1, 'rgba(160,80,255,0)');
    ctx.fillStyle = g; ctx.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
  }
  ctx.globalCompositeOperation = 'source-over';
}

/** A thick swamp fog: banks of mist rolling slowly through, a pale veil over everything, and fireflies blinking at night. */
function wxFog(ctx, W, night, camX, camY) {
  const k = W.k, t = R.time, cw = R.w, ch = R.h, dir = W.dir;
  ctx.fillStyle = `rgba(${night ? '70,84,80' : '196,206,196'},${(night ? 0.26 : 0.34) * k})`; ctx.fillRect(0, 0, cw, ch);
  const fog = wxCloud(night ? '96,112,108' : '222,230,222');
  for (let n = 0; n < 16; n++) {
    const h1 = hash2(n, 61, 11), h2 = hash2(n, 67, 13), s = Math.max(cw, ch) * (0.35 + 0.45 * hash2(n, 71, 17));
    const x = wxWrap(h1 * cw + t * (8 + 10 * h2) * dir - camX, cw, s), y = wxWrap(h2 * ch + Math.sin(t * 0.1 + n) * 24 - camY, ch, s / 3);
    ctx.globalAlpha = (night ? 0.45 : 0.6) * k;
    ctx.drawImage(fog, x - s / 2, y - s * 0.2, s, s * 0.4);
  }
  ctx.globalAlpha = 1;
  if (!night) return;
  ctx.globalCompositeOperation = 'lighter';
  for (let n = 0; n < 110; n++) {
    const h1 = hash2(n, 73, 91), h2 = hash2(n, 79, 93), blink = Math.max(0, Math.sin(t * (1.6 + h2 * 2) + n * 1.7));
    if (blink < 0.2) continue;
    const x = wxWrap(h1 * cw + Math.sin(t * 0.5 + n) * 30 - camX, cw, 20), y = wxWrap(h2 * ch + Math.cos(t * 0.4 + n * 2) * 20 - camY, ch, 20);
    const g = ctx.createRadialGradient(x, y, 0, x, y, 6);
    g.addColorStop(0, `rgba(220,255,120,${0.9 * blink * k})`); g.addColorStop(1, 'rgba(160,255,80,0)');
    ctx.fillStyle = g; ctx.fillRect(x - 6, y - 6, 12, 12);
  }
  ctx.globalCompositeOperation = 'source-over';
}

/*
 * Battle effects, drawn in code (all cosmetic): tracer rounds, muzzle flashes, fireballs with shock rings
 * and sparks, burning wreckage, missile and rocket trails, the pulse cannon's charge-up, and the eerie green
 * glow and haze a nuclear blast leaves behind. Everything that burns or flashes also lights the ground
 * round it, faintly by day and strongly at dusk and night (fxNight), so a battle at night is a show of light.
 * drawEffects (render.js) hands each effect here; nothing in this file touches the game state or its RNG.
 */

/** How many of n sparks, embers or puffs to draw at the Graphics step now (n at Auto, half on Saver, more on High and Ultra). */
function fxCount(n) { return Math.max(1, Math.round(n * gfx().fx)); }

/** How dark it is, 0 (day) to 1 (night): how much effects light up the ground. */
function fxNight() { return typeof TOD !== 'undefined' && TOD.active ? clamp(TOD.state.pools / 0.8, 0, 1) : 0; }

/** A soft additive glow of radius r px (a white-hot core in `color`). */
function fxGlow(ctx, x, y, r, color, a) {
  if (!(a > 0.003) || !(r > 0.5)) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.min(1, a);
  ctx.drawImage(glowSprite(color), x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

/** Light thrown on the ground round (x, y), radius r px: faint by day, bright at night. */
function fxGround(ctx, x, y, r, color, a) {
  const k = a * (0.18 + 0.82 * fxNight());
  if (!(k > 0.004) || !(r > 1)) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.min(1, k);
  ctx.drawImage(fxPool(color), x - r, y - r * 0.62, r * 2, r * 1.24); // squashed a little: the ground seen at an angle
  ctx.restore();
}

/** A soft round pool of light in `color` (cached), for fxGround. */
function fxPool(color) {
  R.fxPools = R.fxPools || {};
  if (R.fxPools[color]) return R.fxPools[color];
  const n = 128, c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d'), gr = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  const rgb = fxRGB(color);
  gr.addColorStop(0, `rgba(${rgb},0.9)`); gr.addColorStop(0.3, `rgba(${rgb},0.5)`); gr.addColorStop(0.65, `rgba(${rgb},0.16)`); gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, n, n);
  return (R.fxPools[color] = c);
}

/** A colour shaded for the dark (things that don't glow: dust, smoke, debris), cached per colour and darkness step. */
function fxDim(hex) {
  const n = Math.round(fxNight() * 8);
  if (!n) return hex;
  R.fxDims = R.fxDims || {};
  const key = hex + n;
  return R.fxDims[key] || (R.fxDims[key] = fxMix(hex, '#0d1018', n / 8 * 0.72, 1));
}

/** '#rrggbb' -> 'r,g,b' */
function fxRGB(hex) {
  const h = hex.replace('#', ''), v = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `${(v >> 16) & 255},${(v >> 8) & 255},${v & 255}`;
}

/** A soft grey smoke puff (cached sprite), for trails and fires. */
function fxPuff(dark) {
  const key = dark ? 'fxPuffD' : 'fxPuff';
  if (R[key]) return R[key];
  const n = 64, c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d'), gr = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  const col = dark ? '34,30,28' : '150,146,140';
  gr.addColorStop(0, `rgba(${col},0.75)`); gr.addColorStop(0.55, `rgba(${col},0.4)`); gr.addColorStop(1, `rgba(${col},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, n, n);
  return (R[key] = c);
}

/** A blend of two '#rrggbb' colours as an rgba() string. */
function fxMix(a, b, t, alpha) {
  const A = fxRGB(a).split(',').map(Number), B = fxRGB(b).split(',').map(Number);
  return `rgba(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')},${alpha})`;
}

/* ------------------------------------------------------------------ guns */

/**
 * A tracer round in flight from (x, y) to (x2, y2) (screen px) over the effect's life: a white-hot head in a
 * glow of the shooter's colour, a fading streak behind it, and at night a little light under it as it flies.
 * f.rico: a round glancing off armour (thinner and quicker to fade).
 */
function drawTracerFx(ctx, f, x, y, x2, y2, z, k) {
  const d = Math.hypot(x2 - x, y2 - y) || 1, p = Math.min(1, k);
  const hx = x + (x2 - x) * p, hy = y + (y2 - y) * p;
  const tail = Math.min(p, (z * (f.rico ? 0.45 : 0.85)) / d), tx = x + (x2 - x) * (p - tail), ty = y + (y2 - y) * (p - tail);
  const col = f.color || '#ffd27a', fade = f.rico ? 1 - p : p > 0.85 ? (1 - p) / 0.15 : 1;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  const gr = ctx.createLinearGradient(tx, ty, hx, hy);
  gr.addColorStop(0, fxMix(col, col, 0, 0)); gr.addColorStop(1, fxMix(col, '#ffffff', 0.25, 0.9 * fade));
  ctx.strokeStyle = gr; ctx.lineWidth = Math.max(1.5, z * (f.rico ? 0.04 : 0.065));
  ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
  const gc = ctx.createLinearGradient(tx, ty, hx, hy);
  gc.addColorStop(0, 'rgba(255,250,230,0)'); gc.addColorStop(1, `rgba(255,252,240,${fade})`);
  ctx.strokeStyle = gc; ctx.lineWidth = Math.max(1, z * 0.022);
  ctx.beginPath(); ctx.moveTo(x + (x2 - x) * (p - tail * 0.5), y + (y2 - y) * (p - tail * 0.5)); ctx.lineTo(hx, hy); ctx.stroke();
  ctx.restore();
  fxGlow(ctx, hx, hy, z * (f.rico ? 0.09 : 0.13), col, 0.85 * fade);
  if (!f.rico) fxGround(ctx, hx, hy + z * 0.15, z * 0.45, '#ffd59a', 0.35 * fade);
}

/** A muzzle flash: a hot star of fire out of the barrel, a glow round it, and a flicker of light on the ground. */
function drawMuzzleFx(ctx, f, x, y, z, k) {
  const big = !!f.big, a = 1 - k, L = z * (big ? 0.62 : 0.36), W = L * 0.38, col = f.pulse ? f.color : '#ffc65a';
  fxGlow(ctx, x, y, z * (big ? 0.7 : 0.42) * (0.8 + 0.4 * a), f.pulse ? f.color : '#ffb347', 0.9 * a);
  ctx.save();
  ctx.translate(x, y); ctx.rotate(f.a || 0);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = a;
  ctx.fillStyle = col;
  // the main tongue forward and two short side spikes
  ctx.beginPath(); ctx.moveTo(-L * 0.1, 0); ctx.lineTo(L * 0.3, -W); ctx.lineTo(L * (1.05 + 0.15 * Math.sin(f.t * 90)), 0); ctx.lineTo(L * 0.3, W); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(L * 0.15, 0); ctx.lineTo(L * 0.32, -W * 2.1); ctx.lineTo(L * 0.42, 0); ctx.lineTo(L * 0.32, W * 2.1); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fffbea';
  ctx.beginPath(); ctx.ellipse(L * 0.22, 0, L * 0.3, W * 0.55, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  fxGround(ctx, x, y + z * 0.25, z * (big ? 1.4 : 0.85), f.pulse ? f.color : '#ffb45a', 0.7 * a);
}

/* ------------------------------------------------------------------ explosions */

/**
 * A fireball of radius f.r tiles: a white-hot flash, billowing fire that rolls up and darkens into smoke,
 * a shock ring racing out across the ground, sparks and embers thrown out in arcs, and a burst of light.
 */
function drawBoomFx(ctx, f, x, y, z, k) {
  const r = (f.r || 0.6) * z, sd = Math.floor(((f.seed || 0) + f.x * 13.7 + f.y * 7.3) * 97) | 0;
  // light on the ground: a burst, dying away
  fxGround(ctx, x, y, r * 3.2, '#ff9a3c', Math.pow(1 - k, 1.6) * 1.1);
  // the shock ring
  if (k < 0.45) {
    const q = k / 0.45, rr = r * (0.4 + 1.9 * Math.sqrt(q));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(255,228,180,${0.75 * (1 - q)})`; ctx.lineWidth = Math.max(1.5, r * 0.09 * (1 - q));
    ctx.beginPath(); ctx.ellipse(x, y, rr, rr * 0.62, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  // the fire: lobes swelling and rising, white-yellow at first, then orange, red and finally sooty
  const n = 7;
  for (let i = 0; i < n; i++) {
    const ang = hash2(sd, i, 1) * Math.PI * 2, off = i ? r * (0.25 + 0.35 * hash2(sd, i, 2)) * (0.5 + k) : 0;
    const rise = k * r * (0.5 + 0.6 * hash2(sd, i, 3)), rr = r * (0.38 + 0.3 * hash2(sd, i, 4)) * (0.55 + 0.9 * Math.sqrt(k));
    const bx = x + Math.cos(ang) * off, by = y + Math.sin(ang) * off * 0.6 - rise;
    const heat = clamp(1 - k * 1.6 - i * 0.04, 0, 1), soot = clamp((k - 0.35) / 0.65, 0, 1);
    const g = ctx.createRadialGradient(bx, by - rr * 0.2, rr * 0.05, bx, by, rr);
    if (soot < 1) {
      g.addColorStop(0, heat > 0.5 ? `rgba(255,248,215,${(1 - soot) * 0.95})` : `rgba(255,190,90,${(1 - soot) * 0.9})`);
      g.addColorStop(0.45, `rgba(255,${Math.round(110 + 80 * heat)},40,${(1 - soot) * 0.75})`);
      g.addColorStop(1, 'rgba(120,30,10,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx, by, rr, 0, Math.PI * 2); ctx.fill();
    }
    if (soot > 0) {
      ctx.globalAlpha = 0.55 * soot * (1 - k);
      const s = rr * 2.1; ctx.drawImage(fxPuff(true), bx - s / 2, by - s / 2, s, s);
      ctx.globalAlpha = 1;
    }
  }
  // the white-hot heart and its glow
  if (k < 0.35) fxGlow(ctx, x, y - r * 0.15, r * (1.1 + k), '#ffcf6b', 1 - k / 0.35);
  // sparks and embers: streaks flying out and falling, glowing
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  const ns = fxCount(f.small ? 8 : 14);
  for (let i = 0; i < ns; i++) {
    const ang = hash2(sd, i, 7) * Math.PI * 2, sp = r * (1.2 + 1.6 * hash2(sd, i, 8)), up = r * (0.6 + 1.4 * hash2(sd, i, 9));
    const t1 = Math.min(1, k * 1.25), t0 = Math.max(0, t1 - 0.08);
    const px = (t) => x + Math.cos(ang) * sp * t, py = (t) => y + Math.sin(ang) * sp * t * 0.6 - up * t + up * 1.6 * t * t;
    const al = (1 - t1) * (0.6 + 0.4 * hash2(sd, i, 10));
    if (al <= 0.01) continue;
    ctx.strokeStyle = i % 3 ? `rgba(255,200,110,${al})` : `rgba(255,250,225,${al})`;
    ctx.lineWidth = Math.max(1, z * 0.03);
    ctx.beginPath(); ctx.moveTo(px(t0), py(t0)); ctx.lineTo(px(t1), py(t1)); ctx.stroke();
  }
  ctx.restore();
}

/**
 * A fire burning in wreckage for a while: flickering tongues of flame, embers rising, black smoke pouring up
 * and drifting, and the flicker of firelight on the ground round it. It dies down over its last third.
 */
function drawFireFx(ctx, f, x, y, z, k) {
  const r = (f.r || 0.4) * z, sd = (f.seed || 0) * 13 + 7, t = S.time;
  const life = clamp(k < 0.08 ? k / 0.08 : (1 - k) / 0.35, 0, 1), flick = 0.82 + 0.18 * Math.sin(t * 17 + sd) * Math.sin(t * 7.3 + sd * 2);
  fxGround(ctx, x, y, r * 4.2, '#ff8a2a', 0.9 * life * flick);
  // smoke pouring up and drifting off
  const np = fxCount(6), ne = fxCount(8);
  for (let i = 0; i < np; i++) {
    const ph = (t * 0.32 + i / np + sd * 0.01) % 1, s = r * (1.1 + 2.6 * ph);
    ctx.globalAlpha = 0.5 * life * Math.sin(ph * Math.PI);
    ctx.drawImage(fxPuff(true), x + ph * r * 1.6 + Math.sin(ph * 5 + i) * r * 0.3 - s / 2, y - r * 0.6 - ph * r * 6 - s / 2, s, s);
  }
  ctx.globalAlpha = 1;
  // the flames
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 5; i++) {
    const ox = (hash2(sd, i, 1) - 0.5) * r * 1.4, hgt = r * (0.9 + 0.8 * hash2(sd, i, 2)) * (0.75 + 0.25 * Math.sin(t * (9 + i * 2.3) + i * 1.7)) * life;
    if (hgt < 1) continue;
    const w = r * (0.32 + 0.18 * hash2(sd, i, 3)), bx = x + ox, by = y + (hash2(sd, i, 4) - 0.5) * r * 0.5;
    const g = ctx.createLinearGradient(bx, by, bx, by - hgt);
    g.addColorStop(0, 'rgba(255,245,200,0.85)'); g.addColorStop(0.35, 'rgba(255,170,60,0.75)'); g.addColorStop(1, 'rgba(255,60,10,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(bx - w, by); ctx.quadraticCurveTo(bx - w * 0.9, by - hgt * 0.55, bx + Math.sin(t * 6 + i) * w * 0.4, by - hgt);
    ctx.quadraticCurveTo(bx + w * 0.9, by - hgt * 0.55, bx + w, by); ctx.closePath(); ctx.fill();
  }
  // embers rising
  for (let i = 0; i < ne; i++) {
    const ph = (t * 0.55 + i / ne + hash2(sd, i, 6)) % 1;
    const ex = x + (hash2(sd, i, 5) - 0.5) * r * 1.6 + Math.sin(ph * 6 + i) * r * 0.4, ey = y - ph * r * 4.5;
    ctx.fillStyle = `rgba(255,${180 + (i % 3) * 25},90,${(1 - ph) * life})`;
    const s = Math.max(1.2, z * 0.03);
    ctx.fillRect(ex - s / 2, ey - s / 2, s, s);
  }
  ctx.restore();
  fxGlow(ctx, x, y - r * 0.4, r * 1.6 * flick, '#ff8a2a', 0.55 * life);
}

/** A spot of armour or ground left glowing hot where a pulse blast struck: white, then the beam's colour, cooling. */
function drawHeatFx(ctx, f, x, y, z, k) {
  const col = f.color || '#aa5cff', a = Math.pow(1 - k, 1.3);
  fxGlow(ctx, x, y, z * (0.18 + 0.12 * (1 - k)), k < 0.25 ? '#ffffff' : col, a);
  fxGround(ctx, x, y, z * 0.9, col, 0.6 * a);
}

/**
 * The nuclear afterglow: a blinding green-white flash, then for a long while an eerie green glow over the
 * blast zone that slowly pulses, a green haze drifting off on the wind, and motes of light rising from the
 * ground, all fading out over the effect's life.
 */
function drawNukeGlowFx(ctx, f, x, y, z, k) {
  const r = (f.r || 6) * z, t = f.t, sd = 31;
  const fade = clamp(t / 1.5, 0, 1) * Math.pow(1 - k, 1.1), night = fxNight(), pulse = 0.82 + 0.18 * Math.sin(S.time * 1.6) + 0.06 * Math.sin(S.time * 4.1);
  // the flash
  if (t < 1.4) {
    const q = 1 - t / 1.4;
    fxGlow(ctx, x, y, r * 2.4, '#9dff7a', q * q);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35 * q * q;
    ctx.fillStyle = '#c8ffb8'; ctx.fillRect(0, 0, R.w, R.h); ctx.restore();
  }
  // the glow over the zone and light on the ground
  fxGround(ctx, x, y, r * 1.5, '#5dff4a', (0.55 + 0.45 * night) * fade * pulse);
  fxGlow(ctx, x, y - r * 0.15, r * 0.9, '#7dff6a', 0.22 * fade * pulse);
  // the haze: big soft green clouds drifting off downwind, normal blend so it shows by day too
  const H = glowDisc('#6cff57');
  for (let i = 0; i < 8; i++) {
    const ang = hash2(sd, i, 1) * Math.PI * 2, d0 = r * 0.6 * hash2(sd, i, 2), drift = t * z * 0.045 * (0.6 + 0.6 * hash2(sd, i, 3));
    const hx = x + Math.cos(ang) * d0 + drift, hy = y + Math.sin(ang) * d0 * 0.6 - drift * 0.35 - r * 0.1;
    const s = r * (0.9 + 0.7 * hash2(sd, i, 4)) * (1 + k * 0.6);
    ctx.globalAlpha = (0.12 + 0.08 * night) * fade * (0.8 + 0.2 * Math.sin(S.time * 0.7 + i));
    ctx.drawImage(H, hx - s / 2, hy - s * 0.35, s, s * 0.7);
  }
  ctx.globalAlpha = 1;
  // motes of green light rising off the ground
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0, n = fxCount(26); i < n; i++) {
    const ph = (S.time * 0.12 + hash2(sd, i, 6)) % 1, ang = hash2(sd, i, 7) * Math.PI * 2, d = r * Math.sqrt(hash2(sd, i, 8)) * 0.95;
    const mx = x + Math.cos(ang) * d + Math.sin(ph * 6 + i) * z * 0.15, my = y + Math.sin(ang) * d * 0.62 - ph * z * 1.6;
    ctx.fillStyle = `rgba(170,255,140,${0.8 * fade * Math.sin(ph * Math.PI)})`;
    const s = Math.max(1.5, z * 0.05);
    ctx.beginPath(); ctx.arc(mx, my, s, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

/** How much big blasts near the middle of the screen shake it this frame (px). */
function fxShake(ox, oy, z) {
  let a = 0;
  for (const f of S.fx) {
    if (f.t < 0) continue;
    let s = 0;
    if (f.type === 'nuke' && f.t < 0.9) s = 11 * (1 - f.t / 0.9);
    else if (f.type === 'boom' && (f.r || 0) >= 0.9 && f.t < 0.35) s = Math.min(6, (f.r || 1) * 2.4) * (1 - f.t / 0.35);
    else if (f.type === 'sunderhit' && f.t < 1.4) s = (f.deep ? 5 : 7) * (1 - f.t / 1.4); // (a Sundering Ray's blow landing: the ground jumps near it)
    else if (f.type === 'quake') { a = Math.max(a, (f.amp || 2) * Math.min(1, f.t * 2, (f.life - f.t) / 1.5) * (0.7 + 0.3 * Math.sin(S.time * 23))); continue; } // the ground itself shaking: everywhere on screen
    if (!s) continue;
    const sx = ox + f.x * z, sy = oy + f.y * z, d = Math.hypot(sx - R.w / 2, sy - R.h / 2) / Math.max(R.w, R.h);
    a = Math.max(a, s * clamp(1.2 - d * 1.6, 0, 1));
  }
  // The Harrow: its slam landing (S.mur.cracks), and its death (S.mur.husks): the thud as it comes down, its core bursting.
  const M = S.mur, near = (x, y, s) => { const d = Math.hypot(ox + x * z - R.w / 2, oy + y * z - R.h / 2) / Math.max(R.w, R.h); a = Math.max(a, s * clamp(1.2 - d * 1.6, 0, 1)); };
  if (M && M.cracks) for (const c of M.cracks) { const t = S.time - c.t; if (t >= 0 && t < 0.45) near(c.x, c.y, 6 * (1 - t / 0.45)); }
  if (M && M.husks && typeof HARROW_DEATH !== 'undefined') for (const c of M.husks) {
    const t = S.time - c.t, D = HARROW_DEATH;
    if (t >= D.thud && t < D.thud + 0.6) near(c.x, c.y, 8 * (1 - (t - D.thud) / 0.6));
    else if (t >= D.burst && t < D.burst + 0.4) near(c.x, c.y, 4 * (1 - (t - D.burst) / 0.4));
  }
  return a;
}

/* ------------------------------------------------------------------ missiles, rockets, shells */

/** Where missile m is at fraction q of its flight (world tiles; y raised by its height), and its ground point. */
function fxFlight(m, q) {
  const H = m.nuke ? 7 : m.rocket ? ROCKET.arc : m.shell ? 2.2 : 2.5;
  const gx = lerp(m.x0, m.x1, q), gy = lerp(m.y0, m.y1, q);
  return { x: gx, y: gy - Math.sin(q * Math.PI) * H, gx, gy };
}

const FX_TRAIL = { // smoke left behind: how long a puff lasts (s), how big it gets (tiles), how dense
  missile: { life: 2.6, r0: 0.16, r1: 0.55, step: 0.09, glow: '#ffb347', flame: 0.42 },
  nuke: { life: 4, r0: 0.26, r1: 0.95, step: 0.14, glow: '#ffd27a', flame: 0.8 },
  rocket: { life: 1.8, r0: 0.07, r1: 0.26, step: 0.08, glow: '#ffcf8a', flame: 0.15 }, // a Howitzer's shell: its tracer and a thin smoke trail
  shell: { life: 0, glow: '#ffcf8a', flame: 0 },
};
function fxKind(m) { return m.nuke ? 'nuke' : m.rocket ? 'rocket' : m.shell ? 'shell' : m.bomb ? null : 'missile'; }

/**
 * Behind each missile, rocket and shell in flight: its smoke trail (puffs along the path, swelling and fading
 * with age), a hot exhaust streak and flame glow, and light on the ground under it at night. Trails stay a
 * moment after their missile lands, fading out. Drawn before the missiles themselves.
 */
function drawTrails(ctx, ox, oy, z) {
  if (R.trailS !== S) { R.trailS = S; R.mLive = new Map(); R.mGone = []; }
  const now = S.time, seen = new Set(S.missiles);
  for (const [m] of R.mLive) if (!seen.has(m)) { R.mLive.delete(m); if (FX_TRAIL[fxKind(m)] && FX_TRAIL[fxKind(m)].life) R.mGone.push({ m, end: now }); }
  for (const m of S.missiles) R.mLive.set(m, 1);
  R.mGone = R.mGone.filter((g) => now - g.end < FX_TRAIL[fxKind(g.m)].life);
  for (const g of R.mGone) drawTrail(ctx, g.m, 1, now - g.end, ox, oy, z);
  for (const m of S.missiles) {
    const kind = fxKind(m);
    if (!kind) continue;
    const k = Math.min(1, m.t / m.dur);
    drawTrail(ctx, m, k, 0, ox, oy, z);
    const T = FX_TRAIL[kind], p = fxFlight(m, k), sx = ox + p.x * z, sy = oy + p.y * z;
    if (kind === 'shell') {
      // a mortar shell's fuse glowing as it flies, with a short streak behind it
      const b = fxFlight(m, Math.max(0, k - 0.05));
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(255,190,110,0.7)'; ctx.lineWidth = Math.max(1, z * 0.05);
      ctx.beginPath(); ctx.moveTo(ox + b.x * z, oy + b.y * z); ctx.lineTo(sx, sy); ctx.stroke(); ctx.restore();
      fxGlow(ctx, sx, sy, z * 0.16, T.glow, 0.8);
      continue;
    }
    // the exhaust: a hot streak and a flickering flame glow, lighting the ground below
    const b = fxFlight(m, Math.max(0, k - (kind === 'rocket' ? 0.07 : 0.05)));
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    const gr = ctx.createLinearGradient(ox + b.x * z, oy + b.y * z, sx, sy);
    gr.addColorStop(0, 'rgba(255,140,40,0)'); gr.addColorStop(0.7, 'rgba(255,190,90,0.8)'); gr.addColorStop(1, 'rgba(255,250,230,1)');
    ctx.strokeStyle = gr; ctx.lineWidth = Math.max(2, z * T.flame * 0.28);
    ctx.beginPath(); ctx.moveTo(ox + b.x * z, oy + b.y * z); ctx.lineTo(sx, sy); ctx.stroke(); ctx.restore();
    fxGlow(ctx, sx, sy, z * T.flame * (0.9 + 0.25 * Math.sin(S.time * 40 + m.t * 13)), T.glow, 0.95);
    const h = Math.hypot(p.x - p.gx, p.y - p.gy);
    fxGround(ctx, ox + p.gx * z, oy + p.gy * z, z * (1 + h * 0.35), '#ffb45a', 0.75 / (1 + h * 0.6));
  }
}

/** One missile's smoke trail, up to fraction k of its flight, `late` seconds after it landed (0 while flying). */
function drawTrail(ctx, m, k, late, ox, oy, z) {
  const T = FX_TRAIL[fxKind(m)];
  if (!T || !T.life) return;
  const len = Math.hypot(m.x1 - m.x0, m.y1 - m.y0) + (m.nuke ? 10 : 3), dq = clamp(T.step / len, 0.004, 0.05) / gfx().fx; // (puffs closer together on High and Ultra)
  const puff = fxPuff(false);
  for (let q = Math.floor(k / dq) * dq; q >= 0; q -= dq) {
    const age = (k - q) * m.dur + late;
    if (age > T.life) break;
    const a = age / T.life, p = fxFlight(m, q), s = z * (T.r0 + (T.r1 - T.r0) * Math.sqrt(a)) * 2;
    ctx.globalAlpha = 0.32 * (1 - a) * Math.min(1, age * 8 + 0.3) * (1 - 0.5 * fxNight());
    ctx.drawImage(puff, ox + p.x * z - s / 2 + a * z * 0.25, oy + p.y * z - s / 2 - a * z * 0.15, s, s);
  }
  ctx.globalAlpha = 1;
}

/* ------------------------------------------------------------------ flak and the pulse cannon */

/** Flak shells climbing to their bursts: streams of tracers arcing up from each gun. */
function drawFlakTracers(ctx, ox, oy, z, inView) {
  for (const sh of S.flak || []) {
    if (S.time < sh.t0 || !inView(sh.x, sh.y, 4)) continue;
    const p = clamp((S.time - sh.t0) / Math.max(0.05, sh.at - sh.t0), 0, 1);
    const x0 = ox + sh.x0 * z, y0 = oy + (sh.y0 - 0.45) * z, x1 = ox + sh.x * z, y1 = oy + sh.y * z;
    drawTracerFx(ctx, { color: '#ffb35a', t: 0 }, x0, y0, x1, y1, z, p);
  }
}

/**
 * The pulse cannon gathering its charge: light building at the muzzle well before it fires (from when it
 * starts to reload on a target), sparks drawn in, a violet light swelling on the ground, then the discharge
 * flash. Drawn over the turret's own charge-up art.
 */
function drawPulseChargeGlow(ctx, b, x, y, z, lv, fired) {
  const col = ART['fx-pulse-laser'] ? '#aa5cff' : PLAYER_COLORS[b.owner];
  const pre = b.tgt ? clamp((1.0 - (b.cd || 0)) / 0.55, 0, 1) * 0.45 : 0, v = Math.max(lv, pre);
  if (fired) {
    fxGlow(ctx, x, y, z * 1.1, col, 1);
    fxGround(ctx, x, y + z * 0.4, z * 2.6, col, 1.1);
    return;
  }
  if (v < 0.02) return;
  const flick = 0.85 + 0.15 * Math.sin(R.time * 50 + b.id);
  fxGlow(ctx, x, y, z * (0.2 + 0.55 * v) * flick, col, 0.4 + 0.6 * v);
  fxGround(ctx, x, y + z * 0.4, z * (0.8 + 1.4 * v), col, 0.7 * v);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, z * 0.025);
  for (let n = 0; n < 9; n++) {
    const ph = (R.time * 2.4 + n / 9) % 1, a = (b.id * 1.7 + n * 2.39) + Math.floor(R.time * 2.4 + n / 9) * 1.3;
    const r0 = z * (0.7 - 0.6 * ph), r1 = r0 + z * 0.1;
    ctx.globalAlpha = v * ph;
    ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); ctx.lineTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); ctx.stroke();
  }
  ctx.restore();
}

/** The pulse beam's halo: a wide soft glow along it and a white-hot core, drawn with the beam art. */
function drawPulseHalo(ctx, x, y, x2, y2, z, w, col) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.strokeStyle = col; ctx.globalAlpha = 0.22 * w; ctx.lineWidth = z * 0.55 * w + 2;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.strokeStyle = '#ffffff'; ctx.globalAlpha = 0.8 * w; ctx.lineWidth = Math.max(1, z * 0.05 * w);
  ctx.stroke();
  ctx.restore();
  fxGround(ctx, x2, y2, z * 1.6, col, 0.9 * w);
}

/* ------------------------------------------------------------------ flak searchlights */

/**
 * At dusk and night every Flak Gun has two searchlights sweeping the sky in slow crossing arcs, like an air-raid
 * battery. When the gun has an enemy aircraft in range (b.skyTgt) both beams swing onto it and hold it lit while
 * the gun fires. pass 'beams' draws the beams (under the aircraft); pass 'lit' the glare on a caught aircraft.
 */
function drawFlakSearchlights(ctx, ox, oy, z, inView, pass) {
  const k = typeof TOD !== 'undefined' && TOD.active ? TOD.state.lights : 0;
  if (!(k > 0.01)) return;
  R.sky = R.sky || new Map();
  const dt = Math.min(0.1, R.dt || 0.016), now = S.time;
  for (const b of S.buildings) {
    if (b.type !== 'flak' || b.dead || !b.built || b.paused || !inView(b.x, b.y, 10)) continue;
    const cx = ox + (b.x + 0.5) * z, cy = oy + (b.y + 0.5 - 0.42) * z;
    const tg = b.skyTgt ? getE(b.skyTgt) : null, live = tg && !tg.dead && tg.flight;
    let st = R.sky.get(b.id);
    if (!st) { st = [{ a: -0.4, l: z * 7 }, { a: 0.4, l: z * 7 }]; R.sky.set(b.id, st); }
    if (pass === 'beams') {
      const ph = (b.id % 17) * 0.61;
      st.forEach((bm, n) => {
        let wa, wl;
        if (live) {
          // onto the aircraft, the two beams a hair apart so they cross on it
          const dx = ox + tg.x * z - cx, dy = oy + tg.y * z - cy;
          wa = Math.atan2(dx, -dy) + (n ? 0.03 : -0.03); wl = Math.hypot(dx, dy);
        } else {
          wa = (n ? 0.38 : -0.38) + 0.8 * Math.sin(now * (n ? 0.37 : 0.29) + ph + n * 2.1);
          wl = z * (6.2 + 1.8 * Math.sin(now * 0.23 + ph * 1.7 + n));
        }
        const ease = 1 - Math.exp(-dt * (live ? 4 : 1.2));
        bm.a += wrapAngle(wa - bm.a) * ease; bm.l += (wl - bm.l) * ease;
        // the beam: a long, slowly widening shaft of cold white light, fading with height
        ctx.save();
        ctx.translate(cx, cy); ctx.rotate(bm.a);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = k * (live ? 1 : 0.8);
        const L = bm.l, w0 = z * 0.1, w1 = z * (0.55 + L / z * 0.06);
        const g = ctx.createLinearGradient(0, 0, 0, -L);
        g.addColorStop(0, 'rgba(225,238,255,0.42)'); g.addColorStop(0.6, `rgba(215,232,255,${live ? 0.22 : 0.14})`); g.addColorStop(1, `rgba(205,225,255,${live ? 0.12 : 0})`);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(-w0 / 2, 0); ctx.lineTo(-w1 / 2, -L); ctx.lineTo(w1 / 2, -L); ctx.lineTo(w0 / 2, 0); ctx.closePath(); ctx.fill();
        // a brighter core down the middle
        const c = ctx.createLinearGradient(0, 0, 0, -L);
        c.addColorStop(0, 'rgba(245,250,255,0.5)'); c.addColorStop(1, 'rgba(240,248,255,0)');
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.moveTo(-w0 / 4, 0); ctx.lineTo(-w1 / 6, -L); ctx.lineTo(w1 / 6, -L); ctx.lineTo(w0 / 4, 0); ctx.closePath(); ctx.fill();
        ctx.restore();
      });
      // the lamps on the gun
      fxGlow(ctx, cx, cy, z * 0.3, '#dfeeff', 0.9 * k);
    } else if (live) {
      // the aircraft caught in the beams: a hard white glare on it
      const tx = ox + tg.x * z, ty = oy + tg.y * z;
      fxGlow(ctx, tx, ty, z * 0.75, '#eef6ff', 0.65 * k);
    }
  }
}

/** Low crests drift across open water under the ships. The tips stay within liquid water. */
function drawWaterRipples(ctx, ox, oy, z, v0, v1) {
  if (z < 13 || biome() === 'lunar' || biome() === 'volcanic' || (LESS_MOTION && LESS_MOTION.matches)) return;
  const step = 2, now = R.time, seed = S.seed | 0, dark = fxNight();
  const wind = ambWind(Math.floor(S.time / WEATHER.slot)).x < 0 ? -1 : 1;
  const low = gfxStep() === 'saver';
  ctx.save();
  ctx.strokeStyle = dark > 0.5 ? '#9cbec3' : '#d4eee2';
  ctx.lineCap = 'round'; ctx.lineWidth = Math.max(0.65, z * 0.019);
  for (let j = Math.max(0, Math.floor(v0.y / step)); j < Math.min(S.H / step, v1.y / step + 1); j++) {
    for (let i = Math.max(0, Math.floor(v0.x / step)); i < Math.min(S.W / step, v1.x / step + 1); i++) {
      const t = tIdx(i * step, j * step);
      if (S.terrain[t] !== T_WATER && S.terrain[t + 1] !== T_WATER && S.terrain[t + S.W] !== T_WATER && S.terrain[t + S.W + 1] !== T_WATER) continue;
      const tone = hash2(i, j, seed + 817);
      if (tone > (low ? 0.42 : 0.75)) continue;
      const age = (now * (0.16 + tone * 0.05) + hash2(j, i, seed + 818)) % 1;
      const x = i * step + 0.5 + 1.15 * hash2(i, j, seed + 819) + wind * age * 0.46;
      const y = j * step + 0.39 + 1.22 * hash2(j, i, seed + 820) + age * 0.14;
      const width = 0.18 + 0.42 * tone + age * 0.10;
      if (!marineWater(x - width, y) || !marineWater(x + width, y)) continue;
      const px = ox + x * z, py = oy + y * z, w = width * z;
      ctx.globalAlpha = Math.sin(age * Math.PI) * (0.14 + tone * 0.17) * (1 - 0.58 * dark);
      ctx.beginPath(); ctx.moveTo(px - w, py);
      ctx.quadraticCurveTo(px - w * 0.08, py - z * (0.055 + tone * 0.06), px + w, py + wind * z * 0.027);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ lava */

function lavaSurface(t) {
  return S.terrain[t] === T_WATER && (S.lava?.[t] || renderBiomeAt(t) === 'volcanic');
}

/**
 * Lava gives off its own light: a warm glow over every lava tile (and a halo round it), faint by day and
 * strong at night, flickering slowly; stronger round the crater while the volcano erupts. The glow map is
 * one pixel a tile, drawn scaled up so it's soft (rebuilt when land and water change).
 */
function drawLavaGlow(ctx, ox, oy, z) {
  if (!S.lava && R.biome !== 'volcanic' && R.secondRegion?.biome !== 'volcanic') return;
  const key = [S.roadVer, S.railVer, S.tide?.high, R.biome, R.secondRegion?.biome].join(':');
  if (!R.lavaGlow || R.lavaGlow.S !== S || R.lavaGlow.key !== key) {
    const c = document.createElement('canvas');
    c.width = S.W; c.height = S.H;
    const g = c.getContext('2d'), img = g.createImageData(S.W, S.H);
    const surface = new Path2D(), vents = [];
    let any = false;
    for (let j = 0; j < S.H; j++) {
      let run = -1;
      for (let i = 0; i <= S.W; i++) {
        const t = tIdx(i, j), lava = i < S.W && lavaSurface(t), clear = lava && !S.road[t] && !S.rail[t];
        if (lava) {
          img.data[t * 4] = 255; img.data[t * 4 + 1] = 120; img.data[t * 4 + 2] = 30; img.data[t * 4 + 3] = 255; any = true;
        }
        if (clear && run < 0) run = i;
        if (!clear && run >= 0) { surface.rect(run, j, i - run, 1); run = -1; }
        if (clear && hash2(i, j, S.seed + 444) < 0.17 &&
          [[0, -1], [1, 0], [0, 1], [-1, 0]].some(([x, y]) => terrAt(i + x, j + y) === T_GROUND)) {
          vents.push({ x: i + 0.28 + 0.44 * hash2(j, i, 445), y: j + 0.28 + 0.44 * hash2(i, j, 446), seed: hash2(i, j, 447) });
        }
      }
    }
    g.putImageData(img, 0, 0);
    R.lavaGlow = { S, key, c: any ? c : null, surface, vents };
  }
  if (!R.lavaGlow.c) return;
  const night = Math.max(fxNight(), typeof duskWake === 'function' ? duskWake() : 0), V = S.volcano, erupt = V && V.erupting ? 1 : 0;
  const flick = 0.85 + 0.1 * Math.sin(S.time * 1.7) + 0.05 * Math.sin(S.time * 5.3);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.imageSmoothingEnabled = true;
  ctx.globalAlpha = (0.1 + 0.55 * night) * flick;
  ctx.drawImage(R.lavaGlow.c, ox, oy, S.W * z, S.H * z);
  // The halo: the same map drawn bigger and fainter, spilling light onto the banks.
  ctx.globalAlpha = (0.05 + 0.3 * night) * flick;
  const pad = z * 0.9;
  ctx.drawImage(R.lavaGlow.c, ox - pad, oy - pad, S.W * z + pad * 2, S.H * z + pad * 2);
  if (V) {
    const x = ox + V.x * z, y = oy + V.y * z, r = z * (V.crater + 1.5 + erupt * 2.5);
    const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(255,170,60,${(0.25 + 0.35 * night + 0.35 * erupt) * flick})`);
    gr.addColorStop(1, 'rgba(255,80,20,0)');
    ctx.globalAlpha = 1; ctx.fillStyle = gr;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.restore();
}

/** A seamless pattern of slowly drifting thin highlights over the already-baked lava texture. */
function lavaCurrentTexture() {
  if (R.lavaCurrent) return R.lavaCurrent;
  const c = document.createElement('canvas'), n = 160;
  c.width = c.height = n;
  const ctx = c.getContext('2d');
  ctx.lineCap = 'round';
  for (let k = 0; k < 46; k++) {
    const cx = hash2(k, 8, 21) * n, cy = hash2(k, 5, 22) * n;
    const w = 8 + 54 * hash2(k, 6, 23), h = 2 + 8 * hash2(k, 7, 24);
    for (const dx of [-n, 0, n]) for (const dy of [-n, 0, n]) {
      const x = cx + dx, y = cy + dy;
      const g = ctx.createLinearGradient(x, y, x + w, y + h);
      g.addColorStop(0, 'rgba(255,114,38,0)');
      g.addColorStop(0.42, `rgba(255,168,66,${0.12 + 0.43 * hash2(k, 8, 25)})`);
      g.addColorStop(1, 'rgba(255,126,40,0)');
      ctx.strokeStyle = g; ctx.lineWidth = 0.75 + 1.9 * hash2(k, 9, 25);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.bezierCurveTo(x + w * 0.28, y - h * 0.6, x + w * 0.68, y + h, x + w, y + h); ctx.stroke();
    }
  }
  R.lavaCurrent = c;
  return c;
}

function drawLavaCurrents(ctx, ox, oy, z, v0, v1) {
  const lava = R.lavaGlow;
  if (!lava?.c || z < 9 || (LESS_MOTION && LESS_MOTION.matches)) return;
  const art = lavaCurrentTexture(), now = R.time;
  ctx.save();
  ctx.translate(ox, oy); ctx.scale(z, z); ctx.clip(lava.surface);
  ctx.globalCompositeOperation = 'lighter';
  const p = ctx.createPattern(art, 'repeat');
  if (p?.setTransform && typeof DOMMatrix !== 'undefined') {
    p.setTransform(new DOMMatrix().translate(now * 0.12 % 5, now * 0.035 % 5).scale(1 / 32));
    ctx.globalAlpha = 0.58 + 0.19 * Math.sin(now * 0.42);
    ctx.fillStyle = p; ctx.fillRect(v0.x - 1, v0.y - 1, v1.x - v0.x + 2, v1.y - v0.y + 2);
  }
  ctx.restore();
}

function drawLavaVents(ctx, ox, oy, z, v0, v1) {
  if (!R.lavaGlow?.vents.length || z < 11 || (LESS_MOTION && LESS_MOTION.matches)) return;
  const cloud = wxCloud(fxNight() > 0.5 ? '172,148,138' : '221,204,181');
  const saver = gfxStep() === 'saver', n = saver ? 3 : 6, now = R.time;
  const wind = ambWind(Math.floor(S.time / WEATHER.slot)).x;
  let budget = saver ? 7 : 18;
  ctx.save();
  for (const v of R.lavaGlow.vents) {
    if (v.x < v0.x - 1 || v.x > v1.x + 1 || v.y < v0.y - 1 || v.y > v1.y + 2) continue;
    const x = ox + v.x * z, y = oy + v.y * z, burst = 0.58 + 0.42 * Math.sin(now * 0.9 + v.seed * 21) ** 2;
    fxGlow(ctx, x, y, z * 0.21, '#ffc984', 0.22 * burst);
    for (let k = 0; k < n; k++) {
      const a = (now * (0.27 + v.seed * 0.07) + v.seed + k / n) % 1;
      const px = x + z * (wind * a + 0.10 * Math.sin(a * 9 + v.seed * 7));
      const py = y - a * z * (0.67 + burst * 0.88), w = z * (0.23 + a * 0.76);
      ctx.globalAlpha = Math.sin(a * Math.PI) * burst * 0.68;
      ctx.drawImage(cloud, px - w / 2, py - w * 0.35, w, w * 0.7);
    }
    ctx.globalAlpha = 1;
    if (--budget <= 0) break;
  }
  ctx.restore();
}

/** Lava bombs in flight from an erupting volcano: glowing blobs on high arcs, trailing sparks and smoke, a shadow below. */
function drawLavaBombs(ctx, ox, oy, z) {
  const V = S.volcano;
  if (!V || !V.bombs || !V.bombs.length) return;
  ctx.save();
  for (const b of V.bombs) {
    const q = clamp((S.time - b.t0) / b.dur, 0, 1), H = 3.5 + b.dur;
    const at = (k) => { const gx = lerp(b.x0, b.x1, k), gy = lerp(b.y0, b.y1, k); return [ox + gx * z, oy + (gy - Math.sin(k * Math.PI) * H) * z, ox + gx * z, oy + gy * z]; };
    const [x, y, sx, sy] = at(q);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(0,0,0,${0.12 + 0.2 * q})`;
    ctx.beginPath(); ctx.ellipse(sx, sy, z * 0.22, z * 0.11, 0, 0, Math.PI * 2); ctx.fill();
    for (let k = 1; k <= 6; k++) {
      const qq = q - k * 0.035;
      if (qq <= 0) break;
      const [tx, ty] = at(qq);
      ctx.fillStyle = `rgba(70,60,56,${0.22 * (1 - k / 7)})`;
      ctx.beginPath(); ctx.arc(tx, ty, z * (0.1 + k * 0.03), 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 0, x, y, z * 0.6);
    g.addColorStop(0, 'rgba(255,240,180,0.95)'); g.addColorStop(0.25, 'rgba(255,150,40,0.8)'); g.addColorStop(1, 'rgba(255,60,10,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - z * 0.6, y - z * 0.6, z * 1.2, z * 1.2);
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ Torch and Bulwark */

/** A soft blob of `color` fading to nothing at its edge (no white core, unlike glowSprite), cached. For fire. */
function fxBlob(color) {
  R.fxBlobs = R.fxBlobs || {};
  if (R.fxBlobs[color]) return R.fxBlobs[color];
  const n = 64, c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d'), gr = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  const rgb = fxRGB(color);
  gr.addColorStop(0, `rgba(${rgb},0.95)`); gr.addColorStop(0.4, `rgba(${rgb},0.6)`); gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, n, n);
  return (R.fxBlobs[color] = c);
}

/**
 * A Torch's spray of fire from its nozzle at (x, y) along f.a, f.len tiles long: a blue-white jet at the nozzle
 * blooming into a roiling cone of yellow, orange and red, licks of flame, sparks flung past the tip and black smoke
 * rolling off the end, all throwing a big orange light on the ground (bright at night). A Torch firing keeps one
 * going every TORCH.tick, so they overlap into a steady roar of flame.
 */
function drawFlameFx(ctx, f, x, y, z, k) {
  const a = f.a || 0, ca = Math.cos(a), sa = Math.sin(a), L = (f.len || 1.6) * z, sd = (f.seed || 0) * 7 + 3, t = S.time;
  const p = Math.min(1, k * 3.2), fade = k > 0.55 ? (1 - k) / 0.45 : 1, cone = Math.tan(TORCH.cone) * 0.6;
  // light on the ground: a long pool along the flame, a hot one at the nozzle
  fxGround(ctx, x + ca * L * 0.55, y + sa * L * 0.55, L * 1.15, '#ff7a1a', 0.75 * fade);
  fxGround(ctx, x + ca * L * 0.15, y + sa * L * 0.15, L * 0.5, '#ffc46a', 0.5 * fade);
  // smoke rolling off the end (under the fire)
  for (let i = 0; i < 3; i++) {
    const d = L * (0.8 + 0.25 * i + k * 0.35) * p, s = z * (0.35 + 0.25 * i + k * 0.5);
    const lat = (hash2(sd, i, 3) - 0.5) * d * cone;
    ctx.globalAlpha = 0.32 * fade * (1 - i * 0.2);
    ctx.drawImage(fxPuff(true), x + ca * d - sa * lat - s / 2, y + sa * d + ca * lat - s / 2 - k * z * 0.25, s, s);
  }
  ctx.globalAlpha = 1;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // the body: blobs from a blue-white jet out to a red, ragged tip
  for (let i = 0; i <= 11; i++) {
    const q = i / 11, d = q * L * p, w = d * cone + z * 0.04;
    const lat = ((hash2(sd, i, 1) - 0.5) * 0.9 + Math.sin(t * 31 + i * 1.7 + sd) * 0.25) * w;
    const r = z * 0.045 + w * (0.6 + 0.25 * hash2(sd, i, 2));
    const col = q < 0.12 ? '#bfe2ff' : q < 0.35 ? '#ffd060' : q < 0.7 ? '#ff8a20' : '#e8400c';
    ctx.globalAlpha = Math.min(1, fade * (0.6 - q * 0.28));
    ctx.drawImage(fxBlob(col), x + ca * d - sa * lat - r, y + sa * d + ca * lat - r, r * 2, r * 2);
  }
  // licks of flame: tapered tongues fanned across the cone
  for (let i = 0; i < 3; i++) {
    const da = (hash2(sd, i, 5) - 0.5) * TORCH.cone * 1.3 + Math.sin(t * 23 + i * 2.1) * 0.06, aa = a + da;
    const len = L * p * (0.72 + 0.28 * hash2(sd, i, 6)), w = len * cone * 0.5, c2 = Math.cos(aa), s2 = Math.sin(aa);
    const g = ctx.createLinearGradient(x, y, x + c2 * len, y + s2 * len);
    g.addColorStop(0, `rgba(255,250,225,${0.7 * fade})`); g.addColorStop(0.3, `rgba(255,185,60,${0.55 * fade})`); g.addColorStop(0.75, `rgba(255,80,15,${0.32 * fade})`); g.addColorStop(1, 'rgba(255,40,0,0)');
    ctx.fillStyle = g; ctx.globalAlpha = 1;
    const wob = Math.sin(t * 19 + i * 3 + sd) * w * 0.5;
    ctx.beginPath();
    ctx.moveTo(x - s2 * z * 0.03, y + c2 * z * 0.03);
    ctx.quadraticCurveTo(x + c2 * len * 0.5 - s2 * (w + wob), y + s2 * len * 0.5 + c2 * (w + wob), x + c2 * len - s2 * wob, y + s2 * len + c2 * wob);
    ctx.quadraticCurveTo(x + c2 * len * 0.5 + s2 * (w - wob), y + s2 * len * 0.5 - c2 * (w - wob), x + s2 * z * 0.03, y - c2 * z * 0.03);
    ctx.closePath(); ctx.fill();
  }
  // sparks and burning droplets flung on past the tip
  for (let i = 0, n = fxCount(7); i < n; i++) {
    const q = (k * 1.4 + hash2(sd, i, 7)) % 1, d = L * (0.35 + q * 0.95), lat = (hash2(sd, i, 8) - 0.5) * d * cone * 1.3;
    const ex = x + ca * d - sa * lat, ey = y + sa * d + ca * lat - q * q * z * 0.15, s = Math.max(1.2, z * 0.028);
    ctx.globalAlpha = (1 - q) * fade;
    ctx.fillStyle = i % 3 ? '#ffd27a' : '#fff4d0';
    ctx.fillRect(ex - s / 2, ey - s / 2, s, s);
  }
  ctx.restore();
  // a blinding blue-white core right at the nozzle
  fxGlow(ctx, x, y, z * 0.2, '#9fd4ff', 0.8 * fade);
  fxGlow(ctx, x + ca * L * 0.3, y + sa * L * 0.3, L * 0.32, '#ff8a2a', 0.22 * fade);
}

/** Half the width of the shield as drawn (radians either side of where it faces). */
const SHIELD_DRAW_ARC = 0.95;

/** The shield's curve, from angle a0 to a1, round (cx, cy) at radius r px. */
function shieldPath(ctx, cx, cy, r, a0, a1) { ctx.beginPath(); ctx.arc(cx, cy, r, a0, a1); }

/**
 * A Bulwark's shield, standing across its front: a curtain of violet light with a white-hot edge, shimmering
 * bands crawling across it and crackles of static, fading off at its ends. It glows faintly by day and brightly at
 * night (lighting the ground before it), flares where it's hit, dims as it's worn down, and flickers back on after
 * a failure. (x, y): the Bulwark on screen, z: pixels a tile.
 */
function drawShieldArc(ctx, u, x, y, z) {
  const B = BULWARK, now = S.time, night = fxNight();
  if (u.shDown && u.shDown > now) {
    // down: the emitters spit sparks now and then
    if (hash2(u.id, Math.floor(R.time * 9), 3) < 0.35) {
      const aa = (u.shAim ?? u.face ?? 0) + (hash2(u.id, Math.floor(R.time * 9), 4) - 0.5) * 1.4;
      fxGlow(ctx, x + Math.cos(aa) * z * 0.3, y + Math.sin(aa) * z * 0.3, z * 0.1, '#b77bff', 0.8);
    }
    return;
  }
  const aim = u.shAim ?? u.face ?? 0, str = clamp((u.sh ?? B.shield) / B.shield, 0, 1);
  const hit = clamp(1 - (now - (u.shHit ?? -99)) / 0.3, 0, 1);
  const boot = u.shDown === 0 && u.sh < B.shield * B.reboot + 2 && (R.time * 20) % 2 < 1 ? 0.4 : 1; // (just back on: a flicker)
  const shim = 0.85 + 0.15 * Math.sin(R.time * 7 + u.id);
  const A = Math.min(1.2, ((0.32 + 0.45 * str) * (0.6 + 0.55 * night) + 0.55 * hit) * shim * boot);
  const r = z * BULWARK.r, a0 = aim - SHIELD_DRAW_ARC, a1 = aim + SHIELD_DRAW_ARC;
  fxGround(ctx, x + Math.cos(aim) * r * 0.9, y + Math.sin(aim) * r * 0.9 + z * 0.08, z * 1.0, '#9b5cff', (0.55 + 0.45 * str) * (0.7 + hit) * boot);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  // the curtain: segments that fade out toward the ends
  const N = 9, step = (a1 - a0) / N;
  for (let i = 0; i < N; i++) {
    const m = Math.sqrt(Math.sin(Math.PI * (i + 0.5) / N)), s0 = a0 + i * step, s1 = s0 + step + 0.01;
    ctx.strokeStyle = `rgba(140,80,255,${0.2 * A * m})`; ctx.lineWidth = z * 0.2;
    shieldPath(ctx, x, y, r * 0.97, s0, s1); ctx.stroke();
    ctx.strokeStyle = `rgba(183,123,255,${0.45 * A * m})`; ctx.lineWidth = z * 0.075;
    shieldPath(ctx, x, y, r, s0, s1); ctx.stroke();
    ctx.strokeStyle = `rgba(245,232,255,${0.8 * A * m})`; ctx.lineWidth = Math.max(1, z * 0.02);
    shieldPath(ctx, x, y, r, s0, s1); ctx.stroke();
  }
  // shimmer: bands of light crawling across it
  ctx.setLineDash([z * 0.05, z * 0.09]);
  ctx.lineDashOffset = -R.time * z * 0.35;
  ctx.strokeStyle = `rgba(210,175,255,${0.4 * A})`; ctx.lineWidth = Math.max(1, z * 0.035);
  shieldPath(ctx, x, y, r * 0.9, a0 + 0.12, a1 - 0.12); ctx.stroke();
  ctx.setLineDash([]);
  // static: little jagged crackles that jump about on it
  const tick = Math.floor(R.time * 14);
  ctx.strokeStyle = `rgba(235,220,255,${0.75 * A})`; ctx.lineWidth = Math.max(1, z * 0.014);
  for (let n = 0; n < 2; n++) {
    if (hash2(u.id, tick, 20 + n) > 0.55 + 0.35 * str) continue;
    const c0 = a0 + 0.15 + hash2(u.id, tick, 30 + n) * (a1 - a0 - 0.5);
    ctx.beginPath();
    for (let j = 0; j <= 4; j++) {
      const aa = c0 + j * 0.07, rr = r * (1 + (hash2(u.id + j, tick, 40 + n) - 0.5) * 0.14);
      const px = x + Math.cos(aa) * rr, py = y + Math.sin(aa) * rr;
      j ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.stroke();
  }
  ctx.restore();
  // the emitters at its ends
  for (const e of [a0 + 0.06, a1 - 0.06]) fxGlow(ctx, x + Math.cos(e) * r * 0.98, y + Math.sin(e) * r * 0.98, z * 0.09, '#b77bff', 0.55 * A);
}

/**
 * Fire striking a Bulwark's shield where it meets it (angle f.a from the Bulwark's centre (cx, cy) on screen): a
 * violet-white flash, the shield's cells lighting up round the spot, a ripple running away along the shield both
 * ways, a ring spreading on its face, and sparks glancing off.
 */
function drawShieldHitFx(ctx, f, x, y, z, k, cx, cy) {
  const a = f.a || 0, r = z * BULWARK.r, big = f.big ? 1.45 : 1, sd = (f.seed || 0) * 5 + 1;
  const aim = f.aim ?? a, lim = SHIELD_DRAW_ARC;
  const da = clamp(wrapAngle(a - aim), -lim + 0.05, lim - 0.05), ha = aim + da;
  const px = cx + Math.cos(ha) * r, py = cy + Math.sin(ha) * r, tx = -Math.sin(ha), ty = Math.cos(ha);
  const fade = Math.pow(1 - k, 1.4);
  fxGround(ctx, px, py + z * 0.1, z * 1.25 * big, '#9b5cff', 0.9 * fade);
  fxGlow(ctx, px, py, z * 0.5 * big * (1 - k * 0.4), '#a45cff', 0.85 * fade);
  fxGlow(ctx, px, py, z * 0.2 * big, '#f4e8ff', fade);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  // the ripple racing away along the shield, both ways
  const sp = 0.1 + Math.pow(k, 0.6) * 1.1;
  for (const sg of [-1, 1]) {
    const e = clamp(da + sg * sp, -lim, lim), b0 = Math.min(da, e), b1 = Math.max(da, e);
    if (b1 - b0 < 0.01) continue;
    ctx.strokeStyle = `rgba(200,150,255,${0.55 * fade})`; ctx.lineWidth = z * 0.05;
    shieldPath(ctx, cx, cy, r, aim + b0, aim + b1); ctx.stroke();
    const fx0 = aim + e;
    ctx.strokeStyle = `rgba(250,240,255,${0.95 * fade})`; ctx.lineWidth = Math.max(1.5, z * 0.035);
    shieldPath(ctx, cx, cy, r, fx0 - 0.05, fx0 + 0.05); ctx.stroke();
  }
  // hex cells lighting up round the spot
  const hs = z * 0.055;
  ctx.strokeStyle = `rgba(215,185,255,${0.8 * fade})`; ctx.lineWidth = Math.max(1, z * 0.012);
  for (const [u, v] of [[0, 0], [-1.7, 0], [1.7, 0], [-0.85, 1.5], [0.85, 1.5], [-0.85, -1.5], [0.85, -1.5]]) {
    const hx = px + (tx * u + Math.cos(ha) * v) * hs, hy = py + (ty * u + Math.sin(ha) * v) * hs, cf = 1 - Math.hypot(u, v) / 3.2;
    if (cf * fade < 0.05) continue;
    ctx.globalAlpha = Math.min(1, cf * 1.3);
    ctx.beginPath();
    for (let j = 0; j < 6; j++) { const aa = ha + j * Math.PI / 3, qx = hx + Math.cos(aa) * hs * 0.55, qy = hy + Math.sin(aa) * hs * 0.55; j ? ctx.lineTo(qx, qy) : ctx.moveTo(qx, qy); }
    ctx.closePath(); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // a ring spreading across the shield's face
  ctx.strokeStyle = `rgba(230,210,255,${0.7 * fade})`; ctx.lineWidth = Math.max(1, z * 0.02);
  ctx.beginPath(); ctx.ellipse(px, py, z * (0.05 + k * 0.32) * big, z * (0.03 + k * 0.12) * big, ha + Math.PI / 2, 0, Math.PI * 2); ctx.stroke();
  // sparks glancing off, back the way the shot came
  const go = 1 - Math.pow(1 - k, 2.2);
  for (let i = 0, n = fxCount(9); i < n; i++) {
    const aa = ha + (hash2(sd, i, 1) - 0.5) * 2.4, d = z * (0.12 + 0.55 * hash2(sd, i, 2)) * big * go;
    const ex = px + Math.cos(aa) * d, ey = py + Math.sin(aa) * d, bx = px + Math.cos(aa) * d * 0.6, by = py + Math.sin(aa) * d * 0.6;
    ctx.strokeStyle = i % 3 ? `rgba(200,160,255,${fade})` : `rgba(255,250,255,${fade})`; ctx.lineWidth = Math.max(1, z * 0.018);
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke();
  }
  ctx.restore();
}

/** A Bulwark's shield failing: it shatters into falling shards of violet light with a burst and a crackle of static. */
function drawShieldBreakFx(ctx, f, x, y, z, k) {
  const aim = f.aim || 0, r = z * BULWARK.r, sd = (f.seed || 0) * 3 + 2, fade = Math.pow(1 - k, 1.2);
  const fx0 = x + Math.cos(aim) * r * 0.8, fy0 = y + Math.sin(aim) * r * 0.8;
  fxGround(ctx, fx0, fy0, z * 1.8, '#9b5cff', 1.1 * fade);
  fxGlow(ctx, fx0, fy0, z * 0.9 * (0.6 + k * 0.6), '#b77bff', fade);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (let i = 0; i < 11; i++) {
    const th = aim - SHIELD_DRAW_ARC + (2 * SHIELD_DRAW_ARC * i) / 10, out = r + z * k * (0.25 + 0.6 * hash2(sd, i, 1));
    const spin = (hash2(sd, i, 2) - 0.5) * 3 * k, len = 0.09 + 0.06 * hash2(sd, i, 3);
    const cx = x + Math.cos(th) * out, cy = y + Math.sin(th) * out + k * k * z * 0.2;
    ctx.strokeStyle = `rgba(225,205,255,${fade})`; ctx.lineWidth = Math.max(1.2, z * 0.03 * (1 - k * 0.5));
    ctx.beginPath(); ctx.arc(cx - Math.cos(th) * r, cy - Math.sin(th) * r, r, th - len + spin, th + len + spin); ctx.stroke();
  }
  if (k < 0.5) {
    ctx.strokeStyle = `rgba(245,235,255,${1 - k * 2})`; ctx.lineWidth = Math.max(1, z * 0.016);
    for (let n = 0; n < 3; n++) {
      ctx.beginPath();
      for (let j = 0; j <= 6; j++) {
        const th = aim - SHIELD_DRAW_ARC + (2 * SHIELD_DRAW_ARC * j) / 6, rr = r * (0.75 + 0.5 * hash2(sd + n, j, Math.floor(k * 12)));
        const px = x + Math.cos(th) * rr, py = y + Math.sin(th) * rr;
        j ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}

/**
 * A Torch's nozzle: a little blue pilot flame always burning in its mouth (it lights the ground at night), and
 * an orange glow round it for a moment after it fires. (x, y): the Torch on screen; size: its sprite in px.
 */
function drawTorchPilot(ctx, u, x, y, z, size) {
  const a = u.face || 0, nx = x + Math.cos(a) * size * 0.4, ny = y + Math.sin(a) * size * 0.4, night = fxNight();
  const lit = (u.gel ?? TORCH.tank) > 0.05, hot = clamp(1 - (S.time - (u.flameT ?? -99)) / 0.6, 0, 1);
  const fl = 0.8 + 0.2 * Math.sin(R.time * 23 + u.id) * Math.sin(R.time * 9 + u.id * 3);
  if (lit) {
    fxGlow(ctx, nx, ny, z * 0.09 * fl, '#7cc8ff', 0.6 + 0.4 * night);
    fxGround(ctx, nx, ny + z * 0.05, z * 0.45, '#ff9a4a', (0.35 + 0.4 * hot) * fl);
  }
  if (hot > 0) fxGlow(ctx, nx, ny, z * 0.3, '#ff8a2a', 0.6 * hot);
}

/*
 * The Skirmisher, the Arc Caster and the Railgunner (see SKIRM, ARC and RAIL).
 */

/** A jagged line from (x1, y1) to (x2, y2) on screen, `n` pieces, `jag` px off the straight line at most; [[x, y], ...]. */
function fxBolt(x1, y1, x2, y2, n, jag, sd) {
  const pts = [], nx = -(y2 - y1), ny = x2 - x1, nl = Math.hypot(nx, ny) || 1;
  for (let i = 0; i <= n; i++) {
    const t = i / n, off = i === 0 || i === n ? 0 : (hash2(sd, i, 5) - 0.5) * 2 * jag * Math.sin(t * Math.PI);
    pts.push([x1 + (x2 - x1) * t + (nx / nl) * off, y1 + (y2 - y1) * t + (ny / nl) * off]);
  }
  return pts;
}
function fxStroke(ctx, pts) { ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.stroke(); }

/**
 * An Arc Caster's chain lightning ('chain', f.pts: the caster, then each robot it jumped to, in tiles): a jagged
 * electric-blue bolt from one to the next that re-forms every few frames, forking little side branches, a white-hot
 * core, a spark of light where it lands, and the ground lit blue round it at night.
 */
function drawChainFx(ctx, f, ox, oy, z, k) {
  const P = (f.pts || []).map(([px, py]) => [ox + px * z, oy + py * z]);
  if (P.length < 2) return;
  const sd = (f.seed || 0) + Math.floor(f.t * 30) * 13, a = Math.max(0, 1 - k * k), night = fxNight();
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  for (let s = 0; s < P.length - 1; s++) {
    const [x1, y1] = P[s], [x2, y2] = P[s + 1], len = Math.hypot(x2 - x1, y2 - y1), n = Math.max(4, Math.round(len / (z * 0.22)));
    const main = fxBolt(x1, y1, x2, y2, n, Math.min(z * 0.22, len * 0.18), sd + s * 101);
    const branches = [];
    for (let b = 0; b < 2; b++) {
      const i = 1 + Math.floor(hash2(sd, s, 30 + b) * (n - 1)), [bx, by] = main[i];
      const ang = Math.atan2(y2 - y1, x2 - x1) + (hash2(sd, s, 40 + b) - 0.5) * 2.2, bl = z * (0.18 + hash2(sd, s, 50 + b) * 0.3);
      branches.push(fxBolt(bx, by, bx + Math.cos(ang) * bl, by + Math.sin(ang) * bl, 3, z * 0.06, sd + s * 7 + b));
    }
    ctx.strokeStyle = '#3aa8ff'; ctx.globalAlpha = 0.35 * a; ctx.lineWidth = Math.max(4, z * 0.2); fxStroke(ctx, main);
    ctx.strokeStyle = '#8fd8ff'; ctx.globalAlpha = 0.8 * a; ctx.lineWidth = Math.max(2, z * 0.07); fxStroke(ctx, main);
    ctx.lineWidth = Math.max(1, z * 0.035); for (const br of branches) fxStroke(ctx, br);
    ctx.strokeStyle = '#f4fcff'; ctx.globalAlpha = a; ctx.lineWidth = Math.max(1, z * 0.025); fxStroke(ctx, main);
    fxGlow(ctx, x2, y2, z * 0.32, '#8fd8ff', 0.9 * a);
    fxGround(ctx, x2, y2 + z * 0.05, z * 0.7, '#6cc4ff', 0.7 * a);
  }
  ctx.restore();
  fxGlow(ctx, P[0][0], P[0][1], z * (0.35 + 0.15 * night), '#bff0ff', a);
  fxGround(ctx, P[0][0], P[0][1] + z * 0.05, z * 0.9, '#6cc4ff', 0.8 * a);
}

/**
 * A Railgunner's shot ('railshot', from (x, y) to (x2, y2) in tiles): a bright straight streak, white-hot at the core in
 * a glow of the shooter's colour, that flashes out at once and fades from the back; a ring of air punched out at the
 * muzzle, and the line lit on the ground at night.
 */
function drawRailFx(ctx, f, x, y, x2, y2, z, k) {
  const col = PLAYER_COLORS[f.owner] || '#8fd8ff', a = Math.pow(1 - k, 1.6), tail = Math.min(1, k * 1.8);
  const sx = x + (x2 - x) * tail * 0.85, sy = y + (y2 - y) * tail * 0.85;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.strokeStyle = col; ctx.globalAlpha = 0.45 * a; ctx.lineWidth = Math.max(4, z * 0.26 * (1 + k));
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.globalAlpha = 0.9 * a; ctx.lineWidth = Math.max(2, z * 0.09);
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.strokeStyle = '#ffffff'; ctx.globalAlpha = a; ctx.lineWidth = Math.max(1, z * 0.035);
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(x2, y2); ctx.stroke();
  // the ring of air at the muzzle, spreading
  ctx.strokeStyle = '#e8f6ff'; ctx.globalAlpha = 0.6 * (1 - k); ctx.lineWidth = Math.max(1, z * 0.03);
  ctx.beginPath(); ctx.ellipse(x, y, z * (0.12 + k * 0.5), z * (0.07 + k * 0.3), Math.atan2(y2 - y, x2 - x), 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  fxGlow(ctx, x, y, z * 0.45, col, a);
  if (fxNight() > 0.05) for (let t = 0.2; t <= 1; t += 0.2) fxGround(ctx, x + (x2 - x) * t, y + (y2 - y) * t, z * 0.5, col, 0.5 * a);
}

/** Where a Railgunner's slug strikes ('railhit'): a white flash and a spray of sparks thrown on along its line. */
function drawRailHitFx(ctx, f, x, y, z, k) {
  const a = f.a || 0;
  fxGlow(ctx, x, y, z * 0.4 * (1 - k * 0.5), '#fff3d6', 1 - k);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = '#ffd98a'; ctx.lineCap = 'round'; ctx.lineWidth = Math.max(1, z * 0.025);
  for (let n = 0; n < 7; n++) {
    const sa = a + (hash2(n, Math.floor(f.x * 31), 3) - 0.5) * 1.4, d0 = z * 0.1 * k, d1 = z * (0.2 + 0.5 * hash2(n, Math.floor(f.y * 29), 4)) * Math.min(1, k * 2.5);
    ctx.globalAlpha = 1 - k;
    ctx.beginPath(); ctx.moveTo(x + Math.cos(sa) * d0, y + Math.sin(sa) * d0); ctx.lineTo(x + Math.cos(sa) * d1, y + Math.sin(sa) * d1); ctx.stroke();
  }
  ctx.restore();
}

/** A Railgunner charging ('railglint', at its muzzle): a star of light that swells and spins as the rail charges, then bursts. */
function drawRailGlintFx(ctx, f, x, y, z, k) {
  const col = PLAYER_COLORS[f.owner] || '#8fd8ff', s = z * (0.06 + 0.3 * k * k), rot = (f.a || 0) + k * 2.5;
  fxGlow(ctx, x, y, z * (0.12 + 0.3 * k), col, 0.4 + 0.6 * k);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = '#ffffff'; ctx.lineCap = 'round'; ctx.globalAlpha = 0.5 + 0.5 * k;
  for (let n = 0; n < 4; n++) {
    const aa = rot + n * Math.PI / 2, l = n % 2 ? s * 0.55 : s;
    ctx.lineWidth = Math.max(1, z * (n % 2 ? 0.015 : 0.025));
    ctx.beginPath(); ctx.moveTo(x - Math.cos(aa) * l, y - Math.sin(aa) * l); ctx.lineTo(x + Math.cos(aa) * l, y + Math.sin(aa) * l); ctx.stroke();
  }
  ctx.restore();
}

/** A Skirmisher's dash ('dash', where it set off, f.a its heading): a kick of dust and a fading streak of thruster light. */
function drawDashFx(ctx, f, x, y, z, k) {
  const a = f.a || 0, col = PLAYER_COLORS[f.owner] || '#8fd8ff';
  for (let n = 0; n < 3; n++) {
    const s = z * (0.18 + k * 0.35 + n * 0.06) * 2;
    ctx.globalAlpha = 0.45 * (1 - k) * (1 - 0.5 * fxNight());
    ctx.drawImage(fxPuff(false), x - Math.cos(a) * z * (0.15 + n * 0.18) - s / 2, y - Math.sin(a) * z * (0.15 + n * 0.18) - s / 2 - k * z * 0.1, s, s);
  }
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = col; ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    const px = -Math.sin(a) * z * 0.1 * side, py = Math.cos(a) * z * 0.1 * side, l = z * (0.3 + 0.9 * k);
    ctx.globalAlpha = 0.7 * (1 - k); ctx.lineWidth = Math.max(1, z * 0.05 * (1 - k));
    ctx.beginPath(); ctx.moveTo(x + px, y + py); ctx.lineTo(x + px + Math.cos(a) * l, y + py + Math.sin(a) * l); ctx.stroke();
  }
  ctx.restore();
}

/**
 * The new robots' own lights on top of their sprite: a Skirmisher's tail thrusters, flaring while it dashes; an Arc
 * Caster's coil, glowing with the bolts left in it and flaring as it fires; a Railgunner's coil clamps brightening as
 * it charges. Each lights the ground round it at night. (x, y): the robot on screen; size: its sprite in px.
 */
function drawArmyLights(ctx, u, x, y, z, size) {
  const bt = BOTS[u.type], a = u.face || 0, c = Math.cos(a), s = Math.sin(a), night = fxNight(), col = PLAYER_COLORS[u.owner] || '#8fd8ff';
  if (bt.flank) {
    const dash = clamp(((u.dashT ?? -9) - S.time) / SKIRM.dash, 0, 1), tx = x - c * size * 0.37, ty = y - s * size * 0.37;
    if (dash > 0) {
      fxGlow(ctx, tx, ty, size * (0.25 + 0.2 * dash), col, 0.9 * dash);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = col; ctx.lineCap = 'round';
      for (const sd of [-1, 1]) {
        const px = -s * size * 0.047 * sd, py = c * size * 0.047 * sd, l = size * 0.45 * dash * (0.8 + 0.2 * Math.sin(R.time * 40 + sd));
        ctx.globalAlpha = 0.8 * dash; ctx.lineWidth = Math.max(1.5, size * 0.04);
        ctx.beginPath(); ctx.moveTo(tx + px, ty + py); ctx.lineTo(tx + px - c * l, ty + py - s * l); ctx.stroke();
      }
      ctx.restore();
    }
    if (night > 0.05) fxGround(ctx, tx, ty, size * 0.4, col, 0.3 + 0.5 * dash);
  } else if (bt.arc) {
    const full = clamp((u.gel ?? ARC.cells) / ARC.cells, 0, 1), hot = clamp(1 - (S.time - (u.arcT ?? -9)) / 0.4, 0, 1);
    const cx = x + c * size * 0.025, cy = y + s * size * 0.025, fl = 0.85 + 0.15 * Math.sin(R.time * 31 + u.id) * Math.sin(R.time * 7 + u.id);
    if (full > 0.05) fxGlow(ctx, cx, cy, size * (0.16 + 0.06 * full) * fl, '#9fe6ff', (0.35 + 0.4 * night) * full + 0.6 * hot);
    fxGround(ctx, cx, cy + z * 0.05, z * 0.6, '#6cc4ff', (0.15 + 0.35 * full) * fl + 0.6 * hot);
  } else if (bt.railgun) {
    const ch = u.rc ? clamp(1 - (u.rc - S.time) / RAIL.charge, 0, 1) : 0;
    if (ch > 0) for (let n = 0; n < 6; n++) {
      const d = size * (0.07 + n * 0.07);
      fxGlow(ctx, x + c * d, y + s * d, size * 0.07, col, ch * (0.3 + 0.7 * ((n + 1) / 6 <= ch + 0.15 ? 1 : 0.2)));
    }
    if (night > 0.05) fxGround(ctx, x + c * size * 0.25, y + s * size * 0.25, z * 0.5, col, 0.25 + 0.5 * ch);
  }
}

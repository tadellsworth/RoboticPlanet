/*
 * Battle effects, drawn in code (all cosmetic): tracer rounds, muzzle flashes, fireballs with shock rings
 * and sparks, burning wreckage, missile and rocket trails, the pulse cannon's charge-up, and the eerie green
 * glow and haze a nuclear blast leaves behind. Everything that burns or flashes also lights the ground
 * round it, faintly by day and strongly at dusk and night (fxNight), so a battle at night is a show of light.
 * drawEffects (render.js) hands each effect here; nothing in this file touches the game state or its RNG.
 */

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
  const ns = f.small ? 8 : 14;
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
  for (let i = 0; i < 6; i++) {
    const ph = (t * 0.32 + i / 6 + sd * 0.01) % 1, s = r * (1.1 + 2.6 * ph);
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
  for (let i = 0; i < 8; i++) {
    const ph = (t * 0.55 + i / 8 + hash2(sd, i, 6)) % 1;
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
  for (let i = 0; i < 26; i++) {
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
    if (!s) continue;
    const sx = ox + f.x * z, sy = oy + f.y * z, d = Math.hypot(sx - R.w / 2, sy - R.h / 2) / Math.max(R.w, R.h);
    a = Math.max(a, s * clamp(1.2 - d * 1.6, 0, 1));
  }
  return a;
}

/* ------------------------------------------------------------------ missiles, rockets, shells */

/** Where missile m is at fraction q of its flight (world tiles; y raised by its height), and its ground point. */
function fxFlight(m, q) {
  const H = m.nuke ? 7 : m.rocket ? 1.2 : m.shell ? 2.2 : 2.5;
  const gx = lerp(m.x0, m.x1, q), gy = lerp(m.y0, m.y1, q);
  return { x: gx, y: gy - Math.sin(q * Math.PI) * H, gx, gy };
}

const FX_TRAIL = { // smoke left behind: how long a puff lasts (s), how big it gets (tiles), how dense
  missile: { life: 2.6, r0: 0.16, r1: 0.55, step: 0.09, glow: '#ffb347', flame: 0.42 },
  nuke: { life: 4, r0: 0.26, r1: 0.95, step: 0.14, glow: '#ffd27a', flame: 0.8 },
  rocket: { life: 1.3, r0: 0.11, r1: 0.32, step: 0.08, glow: '#ffb347', flame: 0.24 },
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
  const len = Math.hypot(m.x1 - m.x0, m.y1 - m.y0) + (m.nuke ? 10 : 3), dq = clamp(T.step / len, 0.004, 0.05);
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

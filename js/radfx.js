'use strict';
/*
 * Radiation, for looks and sound only (the rules are in js/sim.js: radAdd, updateRads, reactorDown; the numbers in RAD,
 * js/defs.js). Nothing here changes the game, S, saves or orders: it reads the zones (S.rads), the breached Reactors
 * (S.ruins) and the game's clock, and keeps only display state (R.radfx, made afresh for each game). Every device draws
 * its own; none of it has to agree.
 *
 * - The zone on the ground (drawRadGround): the grass under it goes dead and grey, a sickly green-yellow haze lies over
 *   it, thickest towards its rim, and a dashed ring marks its edge plainly (a small trefoil on its north side, close up),
 *   so it reads at a glance where it is safe to go. The haze breathes with a slow flicker. All of it shrinks with the zone.
 * - The ruin (radRuinItems, drawRadRuin): a breached Reactor is drawn among the buildings, as its own art greyed and
 *   burned, its cooling stack broken off, its dome holed, debris round its pad. Its breach glows green while it is hot.
 * - Over everything (drawRadAir): motes drifting up through the haze; smoke leaking from the broken stack; robots out in a
 *   zone flickering green as it hurts them; and at night a hot ruin casts a column of green and blue light straight up
 *   into the sky over itself, fading over its RAD.glow s to a dead, cold wreck.
 * - The minimap (drawRadMinimap): each zone as a ringed green-yellow disc, each ruin a dot.
 * - Sound (radGeiger): a faint Geiger crackle while a selected robot is in a zone, or the camera is over one, quicker the
 *   hotter it is there. Quiet, on the Effects volume.
 *
 * Graphics: on Saver the grass is greyed with a plain wash (no blending pass), with no motes and no halo round the light
 * column; High and Ultra draw more motes. With the device set to reduce motion: no flicker, no drift, the ring still.
 */

const RADFX = {
  motes: { saver: 0, auto: 16, high: 26, ultra: 40 }, // (motes in a zone of 7 tiles; a smaller zone has fewer)
  column: { h: 12, w: 0.42 },                          // the light column over a hot ruin at night: tiles high, wide
  geiger: { vol: 0.022, rate: [2.5, 16] },             // clicks a second, from a zone's rim to its middle
  // where the breaches are on the Reactor's 512 px art: the broken stack's mouth and the hole in the dome
  stack: [160, 140], dome: [302, 176],
};

function radLess() { return !!(typeof LESS_MOTION !== 'undefined' && LESS_MOTION && LESS_MOTION.matches); }
function radStep() { return typeof gfxStep === 'function' ? gfxStep() : 'auto'; }
/** A zone's radius as drawn now (smooth between the half-second steps the rules take). */
function radDrawR(zn) { return Math.max(0, zn.r * (1 - (S.time - zn.t0) / zn.life)); }
/** How hot ruin r still is: 1 when fresh, fading over the last third of RAD.glow s to 0 (cold). */
function radHeat(r) { const left = RAD.glow - (S.time - r.t); return clamp(left / (RAD.glow * 0.33), 0, 1); }

function radState() {
  let F = R.radfx;
  if (!F || F.of !== S) F = R.radfx = { of: S, ruin: {}, last: 0 };
  return F;
}

/* ------------------------------------------------------------------ the zone on the ground */

/** Under everything standing: dead grey grass, the haze and the zone's edge. */
function drawRadGround(ctx, ox, oy, z, v0, v1) {
  if (!S || !S.rads || !S.rads.length) return;
  const less = radLess(), saver = radStep() === 'saver', night = typeof fxNight === 'function' ? fxNight() : 0;
  ctx.save();
  ctx.beginPath(); ctx.rect(ox, oy, S.W * z, S.H * z); ctx.clip(); // (on the map only)
  for (const zn of S.rads) {
    const r = radDrawR(zn);
    if (r < 0.15 || zn.x + r < v0.x - 1 || zn.x - r > v1.x + 1 || zn.y + r < v0.y - 1 || zn.y - r > v1.y + 1) continue;
    const x = ox + zn.x * z, y = oy + zn.y * z, rr = r * z;
    const flick = less ? 1 : 0.86 + 0.09 * Math.sin(R.time * 0.9 + zn.id) + 0.05 * Math.sin(R.time * 2.3 + zn.id * 1.7);
    ctx.save();
    // Dead grass: the colour drained out of the ground, a little darker and duller.
    let g = ctx.createRadialGradient(x, y, 0, x, y, rr * 1.06);
    if (saver) {
      g.addColorStop(0, 'rgba(118,116,104,0.5)'); g.addColorStop(0.88, 'rgba(118,116,104,0.42)'); g.addColorStop(1, 'rgba(118,116,104,0)');
    } else {
      ctx.globalCompositeOperation = 'saturation';
      g.addColorStop(0, 'rgba(128,128,128,0.92)'); g.addColorStop(0.86, 'rgba(128,128,128,0.8)'); g.addColorStop(1, 'rgba(128,128,128,0)');
    }
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, rr * 1.06, 0, Math.PI * 2); ctx.fill();
    if (!saver) {
      ctx.globalCompositeOperation = 'multiply';
      g = ctx.createRadialGradient(x, y, 0, x, y, rr * 1.04);
      g.addColorStop(0, 'rgba(160,158,140,0.55)'); g.addColorStop(0.85, 'rgba(176,174,150,0.4)'); g.addColorStop(1, 'rgba(176,174,150,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, rr * 1.04, 0, Math.PI * 2); ctx.fill();
    }
    // The haze: sickly green-yellow, thicker towards the rim, soft past it (it glows a little at night).
    ctx.globalCompositeOperation = night > 0.3 ? 'lighter' : 'source-over';
    const k = (night > 0.3 ? 0.55 : 1) * flick;
    g = ctx.createRadialGradient(x, y, 0, x, y, rr * 1.12);
    g.addColorStop(0, `rgba(150,190,40,${(0.13 * k).toFixed(3)})`);
    g.addColorStop(0.7, `rgba(176,206,52,${(0.17 * k).toFixed(3)})`);
    g.addColorStop(0.89, `rgba(206,228,72,${(0.3 * k).toFixed(3)})`);
    g.addColorStop(1, 'rgba(206,228,72,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, rr * 1.12, 0, Math.PI * 2); ctx.fill();
    // The edge, shown plainly: a soft band of light and a dashed ring on it, creeping round slowly.
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'rgba(214,240,80,0.22)'; ctx.lineWidth = Math.max(3, z * 0.22);
    ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(20,24,8,0.55)'; ctx.lineWidth = Math.max(2.4, z * 0.1);
    ctx.setLineDash([z * 0.34, z * 0.2]); ctx.lineDashOffset = less ? 0 : -R.time * z * 0.12;
    ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(222,248,92,0.92)'; ctx.lineWidth = Math.max(1.4, z * 0.06);
    ctx.stroke();
    ctx.setLineDash([]);
    if (z >= 12 && rr > z * 1.2 && !R.clean) radTrefoil(ctx, x, y - rr, Math.max(6, z * 0.26));
    ctx.restore();
  }
  ctx.restore();
}

/** The radiation sign: a small yellow disc with the black trefoil, at (x, y), radius s px. */
function radTrefoil(ctx, x, y, s) {
  ctx.fillStyle = '#e8f04a'; ctx.strokeStyle = '#15160c'; ctx.lineWidth = Math.max(1, s * 0.12);
  ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#15160c';
  for (let k = 0; k < 3; k++) {
    const a = -Math.PI / 2 + k * (Math.PI * 2 / 3);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, s * 0.82, a - 0.52, a + 0.52); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = '#e8f04a'; ctx.beginPath(); ctx.arc(x, y, s * 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#15160c'; ctx.beginPath(); ctx.arc(x, y, s * 0.18, 0, Math.PI * 2); ctx.fill();
}

/* ------------------------------------------------------------------ the ruin */

/** The breached Reactors in view, as items among the buildings and robots (drawn by y). */
function radRuinItems(items, inView) {
  if (!S || !S.ruins || !S.ruins.length) return;
  for (const r of S.ruins) if (inView(r.x, r.y, 2)) items.push({ ent: 'ruin', x: r.x, y: r.y + 0.5, ruin: r });
}

/** A deterministic jagged line from (x0, y0) to (x1, y1) in n steps, wandering `amp` px either side (seeded by `seed`). */
function radJag(g, x0, y0, x1, y1, n, amp, seed) {
  for (let k = 1; k <= n; k++) {
    const f = k / n, w = k === n ? 0 : (hash2(k, seed, 77) - 0.5) * 2 * amp;
    g.lineTo(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f + w);
  }
}

/** The ruin's art (512 px, as the Reactor's): its owner's Reactor greyed and burned, the stack broken, the dome holed. */
function radRuinArt(owner) {
  const F = radState(), key = 'o' + owner;
  if (F.ruin[key]) return F.ruin[key];
  const art = typeof artFor === 'function' ? artFor('reactor', owner) : null;
  if (!art || !art.img || !art.img.width || typeof document === 'undefined') return null;
  const N = 512, mk = () => { const c = document.createElement('canvas'); c.width = N; c.height = N; return c; };
  const day = mk(), g = day.getContext('2d');
  const own = artFor('reactor-ruin', owner); // (a painted ruin, if one is installed: ART_GUIDE, Radiation)
  if (own && own.img && own.img.width) {
    g.drawImage(own.img, 0, 0, N, N);
    const night = mk(), n = night.getContext('2d');
    n.drawImage(day, 0, 0); n.globalCompositeOperation = 'source-atop'; n.fillStyle = 'rgba(10,16,34,0.62)'; n.fillRect(0, 0, N, N);
    return (F.ruin[key] = { day, night, scale: own.scale || art.scale || 1, anchor: own.anchor || art.anchor });
  }
  g.filter = 'grayscale(0.78) brightness(0.6) contrast(1.08)';
  g.drawImage(art.img, 0, 0, N, N);
  g.filter = 'none';
  // The stack broken off: everything above a jagged line through the tower is gone.
  g.globalCompositeOperation = 'destination-out';
  g.beginPath(); g.moveTo(80, 30); g.lineTo(240, 30); g.lineTo(240, 118);
  radJag(g, 240, 118, 84, 150, 10, 14, 1);
  g.closePath(); g.fill();
  // ...its broken rim charred, and the dark inside of what's left of it.
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = 'rgba(14,14,10,0.95)';
  g.beginPath(); g.ellipse(RADFX.stack[0], RADFX.stack[1] + 6, 46, 12, -0.18, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(40,30,22,0.9)'; g.lineWidth = 6;
  g.beginPath(); g.moveTo(240, 118); radJag(g, 240, 118, 84, 150, 10, 14, 1); g.stroke();
  // ...and the bent reinforcing bars sticking up out of the break.
  g.globalCompositeOperation = 'source-over';
  g.strokeStyle = '#3a2f28'; g.lineWidth = 2.5;
  for (let k = 0; k < 9; k++) {
    const f = (k + 0.5) / 9, bx = 236 - 150 * f, by = 118 + 32 * f + (hash2(k, 2, 71) - 0.5) * 10, h = 10 + 16 * hash2(k, 2, 73), lean = (hash2(k, 2, 79) - 0.5) * 14;
    g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(bx + lean * 0.3, by - h * 0.6, bx + lean, by - h); g.stroke();
  }
  g.globalCompositeOperation = 'source-atop';
  // A hole torn in the dome.
  g.fillStyle = 'rgba(10,12,8,0.96)';
  g.beginPath();
  for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2, rr = 26 + 12 * hash2(k, 3, 19); const px = RADFX.dome[0] + Math.cos(a) * rr * 1.2, py = RADFX.dome[1] + Math.sin(a) * rr * 0.85; if (k) g.lineTo(px, py); else g.moveTo(px, py); }
  g.closePath(); g.fill();
  // Burns across the pad.
  for (let k = 0; k < 7; k++) {
    const px = 120 + 280 * hash2(k, 5, 41), py = 200 + 220 * hash2(k, 6, 43), rr = 30 + 40 * hash2(k, 7, 47);
    const b = g.createRadialGradient(px, py, 0, px, py, rr);
    b.addColorStop(0, 'rgba(10,8,6,0.6)'); b.addColorStop(1, 'rgba(10,8,6,0)');
    g.fillStyle = b; g.fillRect(px - rr, py - rr, rr * 2, rr * 2);
  }
  // Pieces of the stack fallen on the pad and beside it.
  g.globalCompositeOperation = 'source-over';
  for (let k = 0; k < 16; k++) {
    const px = 70 + 200 * hash2(k, 8, 53), py = 220 + 200 * hash2(k, 9, 59), s = 7 + 13 * hash2(k, 10, 61), a = hash2(k, 11, 67) * 6.28;
    g.save(); g.translate(px, py); g.rotate(a);
    g.fillStyle = k % 3 ? '#6d6a62' : '#4a4740';
    g.beginPath(); g.moveTo(-s, -s * 0.4); g.lineTo(s * 0.7, -s * 0.6); g.lineTo(s, s * 0.3); g.lineTo(-s * 0.4, s * 0.6); g.closePath(); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(-s, s * 0.35, s * 1.8, s * 0.3);
    g.restore();
  }
  // The night's: the same, sunk into the dark.
  const night = mk(), n = night.getContext('2d');
  n.drawImage(day, 0, 0);
  n.globalCompositeOperation = 'source-atop';
  n.fillStyle = 'rgba(10,16,34,0.62)'; n.fillRect(0, 0, N, N);
  const out = { day, night, scale: art.scale || 1, anchor: art.anchor };
  F.ruin[key] = out;
  return out;
}

/** Where the ruin's art goes for ruin item e: its top-left corner and size, px. */
function radRuinBox(A, ox, oy, z, rx, ry) {
  const s = z * A.scale, cx = ox + (rx + 0.5) * z, cy = oy + (ry + 0.5) * z;
  if (Array.isArray(A.anchor)) return { x: cx - A.anchor[0] * s, y: cy - A.anchor[1] * s, s };
  return { x: cx - s / 2, y: cy - s / 2 + (A.anchor === 'bottom' ? (z - s) / 2 : 0), s };
}

/** A breached Reactor's ruin (an item: see radRuinItems), and its breaches glowing while it's hot. */
function drawRadRuin(ctx, e, ox, oy, z) {
  const r = e.ruin, A = radRuinArt(r.o);
  const night = typeof fxNight === 'function' ? fxNight() : 0;
  if (!A) { // (before the art has loaded: rubble)
    ctx.fillStyle = '#4a4740';
    ctx.beginPath(); ctx.ellipse(ox + (r.x + 0.5) * z, oy + (r.y + 0.6) * z, z * 0.42, z * 0.24, 0, 0, Math.PI * 2); ctx.fill();
    return;
  }
  const B = radRuinBox(A, ox, oy, z, r.x, r.y);
  ctx.drawImage(A.day, B.x, B.y, B.s, B.s);
  if (night > 0.01) { const ga = ctx.globalAlpha; ctx.globalAlpha = ga * night; ctx.drawImage(A.night, B.x, B.y, B.s, B.s); ctx.globalAlpha = ga; }
  const heat = radHeat(r);
  if (heat <= 0 || typeof fxGlow !== 'function') return;
  const less = radLess(), fl = less ? 1 : 0.85 + 0.1 * Math.sin(R.time * 3.1 + r.id) + 0.05 * Math.sin(R.time * 7.7 + r.id * 2);
  const k = heat * fl * (0.45 + 0.55 * night), u = B.s / 512;
  fxGlow(ctx, B.x + RADFX.stack[0] * u, B.y + RADFX.stack[1] * u, z * 0.5, '#9dff7a', 0.75 * k);
  fxGlow(ctx, B.x + RADFX.dome[0] * u, B.y + RADFX.dome[1] * u, z * 0.42, '#7ad8ff', 0.7 * k);
}

/* ------------------------------------------------------------------ over everything */

/** Motes, the ruins' smoke and light, robots sickening; then the Geiger counter. */
function drawRadAir(ctx, ox, oy, z, v0, v1) {
  if (!S) return;
  const zones = S.rads || [], ruins = S.ruins || [];
  const F = radState();
  if (!zones.length && !ruins.length) { F.lvl = 0; return; }
  const less = radLess(), step = radStep(), night = typeof fxNight === 'function' ? fxNight() : 0;
  const inView = (x, y, m) => x > v0.x - m && x < v1.x + m && y > v0.y - m && y < v1.y + m;
  ctx.save();
  // Motes drifting up through the haze.
  const most = RADFX.motes[step] ?? RADFX.motes.auto;
  if (most) {
    ctx.globalCompositeOperation = 'lighter';
    for (const zn of zones) {
      const r = radDrawR(zn);
      if (r < 0.3 || !inView(zn.x, zn.y, r + 1)) continue;
      const n = Math.round(most * Math.min(1, (r * r) / 49) + 2);
      for (let k = 0; k < n; k++) {
        const a = hash2(k, zn.id, 11) * Math.PI * 2, d = Math.sqrt(hash2(k, zn.id, 13)) * r * 0.95;
        const per = 5 + 4 * hash2(k, zn.id, 17), ph = less ? 0.5 : ((R.time / per) + hash2(k, zn.id, 19)) % 1;
        const mx = zn.x + Math.cos(a) * d + (less ? 0 : Math.sin(R.time * 0.6 + k) * 0.12), my = zn.y + Math.sin(a) * d - ph * 0.9;
        const al = Math.sin(ph * Math.PI) * (0.35 + 0.35 * night) * (less ? 0.6 : 1);
        ctx.globalAlpha = al;
        ctx.fillStyle = k % 4 ? '#d6ff6a' : '#a8ffd8';
        const s = Math.max(1.2, z * (0.03 + 0.03 * hash2(k, zn.id, 23)));
        ctx.fillRect(ox + mx * z - s / 2, oy + my * z - s / 2, s, s);
      }
    }
    ctx.globalAlpha = 1;
  }
  // Robots out in a zone flicker green as it hurts them.
  if (zones.length) {
    ctx.globalCompositeOperation = 'lighter';
    for (const u of S.bots) {
      if (u.dead || u.inside || u.dropping || !inView(u.x, u.y, 1) || (BOTS[u.type].air && u.flight)) continue;
      const k = radDose(u.x, u.y);
      if (k <= 0 || calmAt(u.x, u.y)) continue; // (nothing hurts it on a Trade Post's ground)
      const fl = less ? 0.8 : 0.55 + 0.45 * Math.abs(Math.sin(R.time * 5.3 + u.id * 1.7));
      if (typeof fxGlow === 'function') fxGlow(ctx, ox + u.x * z, oy + (u.y - 0.12) * z, z * 0.55, '#a6ff4a', (0.55 + 0.4 * k) * fl);
      if (!less) for (let q = 0; q < 5; q++) {
        const ph = (R.time * 0.9 + hash2(u.id, q, 29)) % 1, px = u.x + (hash2(u.id, q, 31) - 0.5) * 0.5, py = u.y - 0.1 - ph * 0.55;
        ctx.globalAlpha = Math.sin(ph * Math.PI) * (0.6 + 0.4 * k); ctx.fillStyle = '#dcff7a';
        const s = Math.max(1.6, z * 0.06);
        ctx.fillRect(ox + px * z - s / 2, oy + py * z - s / 2, s, s);
      }
      ctx.globalAlpha = 1;
    }
  }
  ctx.restore();
  // The ruins: smoke from the broken stack, and at night the column of light over a hot one.
  for (const r of ruins) {
    const heat = radHeat(r), age = S.time - r.t, A = radRuinArt(r.o);
    const B = A ? radRuinBox(A, ox, oy, z, r.x, r.y) : null, u = B ? B.s / 512 : 0;
    const sx = B ? (B.x + RADFX.stack[0] * u - ox) / z : r.x + 0.3, sy = B ? (B.y + RADFX.stack[1] * u - oy) / z : r.y + 0.2;
    if ((heat > 0 || age < RAD.glow + 90) && inView(r.x, r.y, 3) && typeof smokeReady === 'function' && smokeReady('ruin' + r.id, heat > 0 ? 0.45 : 1.2)) {
      addPuff(sx + (Math.random() - 0.5) * 0.2, sy, SMOKE_SHEET.black, 0.55 + 0.35 * heat, 2.2, 0.32, false);
    }
    if (heat > 0 && night > 0.02 && r.x > v0.x - 3 && r.x < v1.x + 3 && r.y > v0.y - 2 && r.y < v1.y + RADFX.column.h + 2) radColumn(ctx, ox + sx * z, oy + sy * z, z, heat * night, r.id, less, step);
  }
  radGeiger();
}

/** The column of green and blue light straight up from a hot ruin's stack, at (x, y) px, strength k. */
function radColumn(ctx, x, y, z, k, id, less, step) {
  const H = RADFX.column.h * z, w = RADFX.column.w * z;
  const fl = less ? 1 : 0.86 + 0.08 * Math.sin(R.time * 1.7 + id) + 0.06 * Math.sin(R.time * 4.3 + id * 3);
  const a = k * fl;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // the halo round it (not on Saver)
  if (step !== 'saver') {
    const g = ctx.createLinearGradient(0, y, 0, y - H * 1.1);
    g.addColorStop(0, `rgba(80,230,140,${(0.16 * a).toFixed(3)})`); g.addColorStop(0.4, `rgba(60,150,255,${(0.09 * a).toFixed(3)})`); g.addColorStop(1, 'rgba(40,90,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(x - w * 1.6, y); ctx.lineTo(x - w * 3.2, y - H * 1.1); ctx.lineTo(x + w * 3.2, y - H * 1.1); ctx.lineTo(x + w * 1.6, y); ctx.closePath(); ctx.fill();
  }
  // the beam itself, a little wider as it rises and fading into the sky
  const g = ctx.createLinearGradient(0, y, 0, y - H);
  g.addColorStop(0, `rgba(190,255,170,${(0.7 * a).toFixed(3)})`); g.addColorStop(0.18, `rgba(120,240,170,${(0.5 * a).toFixed(3)})`);
  g.addColorStop(0.55, `rgba(80,170,255,${(0.28 * a).toFixed(3)})`); g.addColorStop(1, 'rgba(60,110,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(x - w * 0.5, y); ctx.lineTo(x - w, y - H); ctx.lineTo(x + w, y - H); ctx.lineTo(x + w * 0.5, y); ctx.closePath(); ctx.fill();
  // its bright core
  const c = ctx.createLinearGradient(0, y, 0, y - H * 0.8);
  c.addColorStop(0, `rgba(235,255,225,${(0.6 * a).toFixed(3)})`); c.addColorStop(1, 'rgba(150,220,255,0)');
  ctx.fillStyle = c;
  ctx.fillRect(x - w * 0.14, y - H * 0.8, w * 0.28, H * 0.8);
  ctx.restore();
  // its light on the ground round the ruin
  if (typeof fxGround === 'function') fxGround(ctx, x, y + z * 0.3, z * 2.2, '#6effb0', 0.55 * a);
}

/* ------------------------------------------------------------------ the minimap and the sound */

/** The zones on the minimap: ringed green-yellow discs; breached Reactors as dots. */
function drawRadMinimap(ctx, sx, sy) {
  if (!S || ((!S.rads || !S.rads.length) && (!S.ruins || !S.ruins.length))) return;
  for (const zn of S.rads || []) {
    const r = radDrawR(zn);
    if (r < 0.2) continue;
    const x = zn.x * sx, y = zn.y * sy, rr = Math.max(2.5, r * sx);
    ctx.fillStyle = 'rgba(196,226,64,0.3)'; ctx.strokeStyle = '#dff65a'; ctx.lineWidth = 1.3;
    ctx.setLineDash([2.5, 1.8]);
    ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.setLineDash([]);
  }
  for (const r of S.ruins || []) {
    const x = (r.x + 0.5) * sx, y = (r.y + 0.5) * sy, hot = radHeat(r) > 0;
    ctx.fillStyle = hot ? '#9dff7a' : '#6a6a60'; ctx.strokeStyle = '#11140a'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
}

/** A faint Geiger crackle while a selected robot is in a zone, or the camera is over one: quicker where it's hotter. */
function radGeiger() {
  const F = radState();
  if (!S.rads || !S.rads.length || typeof sfxReady !== 'function' || !sfxReady() || typeof UI === 'undefined' || !UI.inGame || UI.speed === 0) { F.lvl = 0; return; }
  let lvl = 0;
  const sel = UI.selBot ? getE(UI.selBot) : null;
  if (sel && !sel.dead && !sel.inside) lvl = radDose(sel.x, sel.y);
  if (UI.selSet && UI.selSet.size && lvl < 1) { let n = 0; for (const id of UI.selSet) { const u = getE(id); if (u && !u.dead && !u.inside) lvl = Math.max(lvl, radDose(u.x, u.y)); if (++n > 24) break; } }
  lvl = Math.max(lvl, 0.7 * radDose(R.cam.x, R.cam.y));
  F.lvl = lvl;
  if (lvl <= 0) return;
  const dt = Math.min(0.1, R.dt || 0.016), rate = RADFX.geiger.rate[0] + (RADFX.geiger.rate[1] - RADFX.geiger.rate[0]) * lvl;
  let want = rate * dt;
  while (want > 0) {
    if (Math.random() < Math.min(1, want)) _noise(0.012 + Math.random() * 0.008, RADFX.geiger.vol * (0.6 + 0.4 * lvl) * (0.7 + 0.6 * Math.random()), { type: 'highpass', freq: 2400 + Math.random() * 1600, attack: 0.0008, delay: Math.random() * dt });
    want -= 1;
  }
}

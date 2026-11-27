'use strict';
/*
 * Terrafall — The Graveyard's look (space expansion, phase 2: SHAPE_PRESETS graveyard, graveMap in js/world.js, the rules in
 * js/sim.js: graveTick, salvageIn, the Shuttle's Drop Outpost). Looks only: nothing here reads or changes anything the game
 * decides, so it may use Math.random and the real clock.
 *
 *   - The backdrop is The Ring's (R.void: ringSpace in js/ring.js), the wreck field adrift in its shadow pass.
 *   - graveDeckPaint (baked with the ground): a hulk's deck plating, the renderer's plates (renderer/b/grave.js c=plate:
 *     ground-grave-0 the dead hulls, -1 torn up, -2 the Arbiter's Accord white; each image 4 by 4 plates, one a tile, picked
 *     per tile so nothing repeats), then in code the
 *     wreck's edges: a torn lip of buckled plate along every side with space beyond, rib stubs, and now and then a dead
 *     running light. Piles of wreckage (the hulks' crags) are drawn as heaped, twisted plates.
 *   - graveVoidPaint (baked): the tile of space beside a hulk: rib ends sticking out past the torn edge, and under a hulk's
 *     southern edge the ship's flank going down, ribs bare, ports dark, fading into the void (Orbital's hull, wrecked).
 *   - drawArb (every frame, among the buildings): the Arbiter's relay over its core tiles (art: grave-arb derelict, grave-arb@T
 *     its holder's), a ring in the holder's colour (flashing red while jammed), its beacon's slow pulse.
 *   - drawGraveRock (from space.js's drawRock): the towable salvage (grave-salvage-0/1, slowly tumbling) and a debris lane's
 *     shard clouds (grave-junk), in code when the art is missing.
 * With no art everything is drawn plainly in code.
 */

const GRAVE_LOOK = {
  arbFrame: 5.6, // (tiles the relay's art is drawn across: its 46-unit frame, a little larger than life over the 4-tile relay)
  salvageFrame: 1.2, junkFrame: 1.2, // (the art's frame over the rock's width: DRIFT.r)
  lip: '#20242a', rib: '#5d646c', ribD: '#2c3036', dead: ['#3a2a22', '#24303a', '#3b3020'], beacon: '#ffc860',
};

/** A tile of a hulk's deck, painted over the ground when the map is baked: plating, then the torn edges and wreckage. */
function graveDeckPaint(ctx, i, j, x, y, t) {
  const h = graveHulkAt(i, j), arb = h && h.kind === 'arb', bi = Math.floor(i / 4), bj = Math.floor(j / 4);
  const v = arb ? 2 : hash2(bi, bj, 4417) < 0.22 ? 1 : 0, art = ART['ground-grave-' + v] || ART['ground-grave-0'];
  if (art) { // (one plate of the 4 by 4 sheet, picked per tile: every plate ends on the tile's edges, so they mix without a seam or a repeat)
    const k = Math.floor(hash2(i * 7 + 3, j * 13 + 1, 977) * 16), img = art.img, sw = img.width / 4, sh = img.height / 4;
    ctx.drawImage(img, (k % 4) * sw, (k >> 2) * sh, sw, sh, x, y, TP, TP);
  } else {
    const n = hash2(i, j, 311);
    ctx.fillStyle = arb ? `rgb(${160 + n * 14 | 0},${157 + n * 14 | 0},${148 + n * 12 | 0})` : `rgb(${66 + n * 10 | 0},${70 + n * 10 | 0},${76 + n * 10 | 0})`;
    ctx.fillRect(x, y, TP, TP);
    ctx.fillStyle = 'rgba(8,10,14,0.5)'; ctx.fillRect(x, y, TP, i % 2 ? 1 : 2); ctx.fillRect(x, y, j % 2 ? 1 : 2, TP);
  }
  // (no two plates quite the same shade: a faint wash, and old scorch here and there)
  const h2 = hash2(i + 7, j * 3, 29);
  ctx.fillStyle = `rgba(${h2 < 0.5 ? '255,255,255' : '0,0,0'},${0.02 + 0.05 * Math.abs(h2 - 0.5)})`; ctx.fillRect(x, y, TP, TP);
  if (!arb && hash2(i, j, 913) > 0.93) { const g = ctx.createRadialGradient(x + TP / 2, y + TP / 2, 0, x + TP / 2, y + TP / 2, TP * 0.7); g.addColorStop(0, 'rgba(14,10,8,0.55)'); g.addColorStop(1, 'rgba(14,10,8,0)'); ctx.fillStyle = g; ctx.fillRect(x, y, TP, TP); }
  if (S.terrain[t] === T_ROCK) graveWreckage(ctx, i, j, x, y);
  // The torn edges: a dark lip of buckled plate along each side with space beyond, rib ends showing through it.
  const sp = (a, b) => !inMap(a, b) || S.terrain[tIdx(a, b)] === T_CHASM;
  for (const [di, dj] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
    if (!sp(i + di, j + dj)) continue;
    const hor = dj !== 0, seed = hash2(i * 3 + di, j * 5 + dj, 71);
    ctx.fillStyle = GRAVE_LOOK.lip;
    ctx.beginPath();
    for (let k = 0; k <= 6; k++) {
      const a = (k / 6) * TP, d = 2 + hash2(i * 11 + k, j * 7 + di + dj * 3, 19) * (arb ? 2 : 5);
      const px = hor ? x + a : di > 0 ? x + TP - d : x + d, py = hor ? (dj > 0 ? y + TP - d : y + d) : y + a;
      if (k === 0) ctx.moveTo(hor ? x : di > 0 ? x + TP : x, hor ? (dj > 0 ? y + TP : y) : y);
      ctx.lineTo(px, py);
    }
    ctx.lineTo(hor ? x + TP : di > 0 ? x + TP : x, hor ? (dj > 0 ? y + TP : y) : y + TP);
    ctx.closePath(); ctx.fill();
    // a pale edge where the plate broke
    ctx.strokeStyle = arb ? 'rgba(230,226,214,0.35)' : 'rgba(170,178,188,0.28)'; ctx.lineWidth = 1; ctx.stroke();
    // rib ends: two short bars across the edge
    if (!arb) for (const f of [0.28, 0.72]) {
      if (hash2(i + f * 10, j, 37 + di + dj * 2) < 0.35) continue;
      const a = f * TP;
      ctx.fillStyle = GRAVE_LOOK.rib;
      if (hor) ctx.fillRect(x + a - 1.5, dj > 0 ? y + TP - 6 : y, 3, 6); else ctx.fillRect(di > 0 ? x + TP - 6 : x, y + a - 1.5, 6, 3);
    }
    // a dead running light along the edge, now and then (the Arbiter's still glow, faintly)
    if (seed > (arb ? 0.55 : 0.82)) {
      const a = (0.3 + 0.4 * hash2(i, j, 5)) * TP, lx = hor ? x + a : di > 0 ? x + TP - 4 : x + 4, ly = hor ? (dj > 0 ? y + TP - 4 : y + 4) : y + a;
      ctx.fillStyle = arb ? 'rgba(255,200,96,0.7)' : GRAVE_LOOK.dead[Math.floor(seed * 30) % 3];
      ctx.fillRect(lx - 1.5, ly - 1.5, 3, 3);
    }
  }
}

/** A pile of wreckage on a hulk (a crag): buckled plates heaped up, a beam or two across, in shadow. */
function graveWreckage(ctx, i, j, x, y) {
  const r = (k) => hash2(i * 13 + k, j * 7 - k, 557);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x + 2, y + 4, TP - 2, TP - 4);
  for (let k = 0; k < 4; k++) {
    const cx = x + 6 + r(k) * (TP - 12), cy = y + 6 + r(k + 9) * (TP - 12), w = 8 + r(k + 3) * 10, a = r(k + 5) * Math.PI;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
    ctx.fillStyle = k % 2 ? '#575c63' : '#3d4147'; ctx.fillRect(-w / 2, -w * 0.3, w, w * 0.6);
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(-w / 2, -w * 0.3, w, 1.5);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(-w / 2, w * 0.3 - 2, w, 2);
    ctx.restore();
  }
  ctx.strokeStyle = GRAVE_LOOK.rib; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(x + 3 + r(20) * 6, y + 4 + r(21) * 20); ctx.lineTo(x + TP - 3 - r(22) * 6, y + 4 + r(23) * 20); ctx.stroke();
}

/** A tile of space beside a hulk (left clear over the backdrop): rib ends past the torn edge, and under a southern edge the ship's flank going down. */
function graveVoidPaint(ctx, i, j, x, y) {
  const g0 = (a, b) => inMap(a, b) && S.terrain[tIdx(a, b)] !== T_CHASM;
  const one = g0(i, j - 1), two = !one && inMap(i, j - 1) && S.terrain[tIdx(i, j - 1)] === T_CHASM && g0(i, j - 2);
  if (one || two) {
    // the flank: dark hull plating with ribs, a row of dead ports, fading out below
    const g = ctx.createLinearGradient(0, y, 0, y + TP);
    if (one) { g.addColorStop(0, '#3a3f46'); g.addColorStop(1, '#1a1d22'); } else { g.addColorStop(0, '#1a1d22'); g.addColorStop(1, '#0c0e12'); }
    ctx.fillStyle = g; ctx.fillRect(x, y, TP, TP);
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; for (let k = 3; k < TP; k += 7) ctx.fillRect(x + k, y, 2, TP); // (ribs)
    if (one) {
      const h = hash2(i, j, 81);
      ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(x, y, TP, 2);
      for (let k = 0; k < 3; k++) { ctx.fillStyle = h > 0.85 && k === 1 ? 'rgba(255,170,90,0.55)' : 'rgba(8,10,14,0.85)'; ctx.fillRect(x + 4 + k * 9, y + 10, 4, 3); } // (dead ports, one still glowing)
      if (h < 0.3) { ctx.fillStyle = 'rgba(0,0,0,0.9)'; ctx.beginPath(); ctx.moveTo(x + 6, y + 4); ctx.lineTo(x + 20, y + 6); ctx.lineTo(x + 14, y + 22); ctx.closePath(); ctx.fill(); } // (a hole torn in it)
    }
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    const f = ctx.createLinearGradient(0, y, 0, y + TP);
    f.addColorStop(0, `rgba(0,0,0,${one ? 0 : 0.5})`); f.addColorStop(1, `rgba(0,0,0,${one ? 0.55 : 1})`);
    ctx.fillStyle = f; ctx.fillRect(x, y, TP, TP);
    // (the flank is narrower than the deck: its sides taper, ragged)
    const sx = (one ? 0.08 : 0.25) * TP;
    ctx.fillStyle = 'rgba(0,0,0,0.92)';
    if (!g0(i - 1, j) && !g0(i - 1, j - 1)) ctx.fillRect(x, y, sx + hash2(i, j, 3) * 4, TP);
    if (!g0(i + 1, j) && !g0(i + 1, j - 1)) ctx.fillRect(x + TP - sx - hash2(i, j, 4) * 4, y, sx + 4, TP);
    if (two && hash2(i, j, 771) < 0.45) ctx.fillRect(x, y + TP * 0.4, TP, TP * 0.6); // (a ragged bottom)
    ctx.restore();
  }
  // rib ends sticking out past a torn edge on the north, west or east (beams snapped off where the hull broke)
  for (const [di, dj] of [[0, 1], [-1, 0], [1, 0]]) {
    if (!g0(i - di, j - dj) || (dj === 1 && (one || two))) continue;
    const h = hash2(i * 5 + di, j * 3 + dj, 613);
    if (h < 0.45) continue;
    ctx.strokeStyle = GRAVE_LOOK.ribD; ctx.lineWidth = 3;
    for (const f of [0.3, 0.7]) {
      const a = f * TP, len = 4 + hash2(i, j + f * 9, 17) * 9;
      ctx.beginPath();
      if (dj) { ctx.moveTo(x + a, y); ctx.lineTo(x + a + (h - 0.7) * 6, y + len); }
      else { const ex = di > 0 ? x : x + TP; ctx.moveTo(ex, y + a); ctx.lineTo(ex + (di > 0 ? len : -len), y + a + (h - 0.7) * 6); }
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(150,158,168,0.35)'; ctx.lineWidth = 1; ctx.stroke();
  }
}

/** The Arbiter's relay over its core tiles, at (cx, cy) on screen (the core's middle), tile size z. */
function drawArb(ctx, cx, cy, z) {
  const A = S.grave, held = arbHolder(), F = GRAVE_LOOK.arbFrame * z;
  const art = held >= 0 ? artFor('grave-arb', held) : ART['grave-arb'];
  ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(cx + F * 0.06, cy + F * 0.1, F * 0.42, F * 0.2, 0, 0, Math.PI * 2); ctx.fill();
  if (art) drawArt(ctx, art, cx, cy, F, 0);
  else {
    ctx.fillStyle = '#c9c5ba'; ctx.fillRect(cx - F * 0.3, cy - F * 0.1, F * 0.5, F * 0.2);
    ctx.beginPath(); ctx.arc(cx + F * 0.3, cy, F * 0.17, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = held >= 0 ? PLAYER_COLORS[held] : '#8c8a84'; ctx.lineWidth = Math.max(1, z * 0.08); ctx.stroke();
  }
  // its beacon, still answering: a slow pulse (brighter, in the holder's colour, once held)
  const pulse = 0.5 + 0.5 * Math.sin((R.time || 0) * (held >= 0 ? 2.4 : 1.1));
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const bc = held >= 0 ? PLAYER_COLORS[held] : GRAVE_LOOK.beacon, br = z * (0.35 + 0.25 * pulse);
  const g = ctx.createRadialGradient(cx, cy - z * 0.55, 0, cx, cy - z * 0.55, br * 2);
  g.addColorStop(0, `rgba(255,248,230,${0.45 + 0.35 * pulse})`); g.addColorStop(0.3, hexA(bc, 0.35 * pulse)); g.addColorStop(1, hexA(bc, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy - z * 0.55, br * 2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  if (R.clean) return;
  // the holder's ring round the core, dashed (red, flashing, while jammed)
  const C = A.core, w = (C.x1 - C.x0 + 1) * z, h = (C.y1 - C.y0 + 1) * z;
  const col = held >= 0 ? PLAYER_COLORS[held] : A.jam ? '#ff5a6e' : '#ffcf7a';
  ctx.strokeStyle = col; ctx.globalAlpha = held >= 0 ? 0.6 : A.jam && Math.sin((R.time || 0) * 10) > 0 ? 0.95 : 0.4;
  ctx.lineWidth = Math.max(1, z * 0.04); ctx.setLineDash([z * 0.22, z * 0.14]);
  ctx.beginPath(); ctx.ellipse(cx, cy, w * 0.78, h * 0.72, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]); ctx.globalAlpha = 1;
}

/** A salvage wreck (towable) or a debris lane's shard cloud, drifting: slowly tumbling. True if drawn (a Graveyard kind). */
function drawGraveRock(ctx, r, ox, oy, z) {
  if (r.k !== 'salvage' && r.k !== 'junk') return false;
  const p = rockPos(r), x = ox + p.x * z, y = oy + p.y * z, d = 2 * DRIFT.r[r.k] * z;
  const art = r.k === 'salvage' ? ART['grave-salvage-' + (r.id % 2)] : ART['grave-junk'];
  let a = (R.time || 0) * (r.k === 'junk' ? 0.03 : 0.06) * (r.id % 2 ? 1 : -1) + r.id * 1.7;
  if (r.tow) {
    const u = getE(r.tow);
    a = u ? Math.atan2(u.y - p.y, u.x - p.x) + Math.PI : 0;
    if (u) { // the cable, from the wreck's tow eye to the Shuttle's claw
      const cx = ox + (u.x - Math.cos(u.face || 0) * 0.75) * z, cy = oy + (u.y - Math.sin(u.face || 0) * 0.75) * z - (u.alt || 0) * z * 0.35;
      ctx.strokeStyle = 'rgba(20,22,26,0.9)'; ctx.lineWidth = Math.max(1, z * 0.04);
      ctx.beginPath(); ctx.moveTo(x - Math.cos(a) * d * 0.4, y - Math.sin(a) * d * 0.4); ctx.lineTo(cx, cy); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,166,50,0.55)'; ctx.lineWidth = Math.max(0.5, z * 0.012); ctx.stroke();
    }
  }
  ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(x + d * 0.35, y + d * 0.5, d * 0.45, d * 0.3, 0, 0, Math.PI * 2); ctx.fill();
  if (art) { drawArt(ctx, art, x, y, d * (r.k === 'salvage' ? GRAVE_LOOK.salvageFrame : GRAVE_LOOK.junkFrame), a); return true; }
  ctx.save(); ctx.translate(x, y); ctx.rotate(a);
  if (r.k === 'salvage') { ctx.fillStyle = '#b9b6ad'; ctx.fillRect(-d * 0.35, -d * 0.25, d * 0.7, d * 0.5); ctx.fillStyle = '#23272b'; ctx.fillRect(-d * 0.45, -d * 0.15, d * 0.3, d * 0.3); }
  else for (let k = 0; k < 6; k++) { const q = hash2(r.id, k, 9), b = k * 1.1 + q; ctx.fillStyle = k % 2 ? '#575c63' : '#8c8a84'; ctx.fillRect(Math.cos(b) * d * 0.35 * q - 3, Math.sin(b) * d * 0.3 * q - 2, 6 + q * 6, 3 + q * 3); }
  ctx.restore();
  return true;
}

/* -- the Arbiter's panel and the minimap */

/** Is (wx, wy) on the Arbiter's relay? */
function arbAtTap(wx, wy) {
  if (!S.grave) return false;
  const C = S.grave.core;
  return wx >= C.x0 - 0.4 && wx <= C.x1 + 1.4 && wy >= C.y0 - 0.6 && wy <= C.y1 + 1.4;
}
function openArbSheet() {
  const A = S.grave, held = arbHolder(), who = held >= 0 ? (held === ME ? 'yours' : playerName(held)) : A.jam ? 'jammed: no one holds it' : 'derelict: no one holds it';
  const up = S.victory === 'uplinks' && S.uplinks && S.uplinks[0] && S.uplinks[0].arb;
  openSheet('space', 2000, `<div class="sheet-title"><div><h3>The Arbiter</h3><div class="owner">${held >= 0 ? `<span class="dot" style="background:${PLAYER_COLORS[held]}"></span> ` : ''}${who}</div></div></div>
    <p class="desc">An old Accord arbitration relay ship, dead in the middle of the wreck field. Its relay carried the Accord's rulings between the Uplinks and home; its beacon still answers. Held, it sends its holder salvage: ${costText(GRAVE.arb.haul)} into the Command Base every ${GRAVE.arb.every} s.</p>
    <p class="hint">The colony with the most land over its relay holds it: build an Outpost on its deck beside the relay, or land a Drop Outpost there by Shuttle. Another colony's armed robots within ${GRAVE.arb.jam} tiles of the relay jam it: then no one holds it.${up ? ` <b>Hold the Arbiter</b>: once it comes online, ${UPLINK.online / 60} minutes in, holding it for ${UPLINK.hold / 60} minutes in all wins.` : ''}</p>
    <div class="kv"><span>Sent so far</span><span>${A.paid || 0} hauls</span></div>`);
}
/** The minimap's Arbiter: a ringed diamond at the relay in its holder's colour (white while no one holds it; flashing while jammed). */
function graveMinimap(ctx, sx, sy) {
  if (!S.grave) return;
  const C = S.grave.core, x = ((C.x0 + C.x1 + 1) / 2) * sx, y = ((C.y0 + C.y1 + 1) / 2) * sy, r = Math.max(4, sx * 2.4), held = arbHolder();
  ctx.fillStyle = S.grave.jam && (R.time * 4) % 2 < 1 ? '#ff4030' : held >= 0 ? PLAYER_COLORS[held] : '#f2f6fa';
  ctx.strokeStyle = '#0b1420'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#ffcf7a'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(x, y, r + 2.5, 0, Math.PI * 2); ctx.stroke();
}

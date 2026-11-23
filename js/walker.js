'use strict';
/*
 * Terrafall: the Walking Factory's look and its panel (SHAPE_PRESETS walker). It is laid by walkerSetup (world.js) and
 * runs in sim.js (walkerTick, walkerClaim, walkerBuild); this file only draws it and opens its panel.
 *
 * An old Accord mobile works, huge (its deck WALKER.deck tiles round its middle), on six legs that step in a tripod
 * gait as it walks (by S.walker.od, the tiles it has walked). Weathered grey plate and old Accord yellow; its holder's
 * colour on its flanks, its lamps and its pennant. Drawn in the game's projection: straight down, its stacks and crane
 * standing up toward the camera.
 *
 *   walkerGround   its yard (the ground it has trampled flat), the worn track of its loop, the cradle in the middle;
 *                  drawn with the ground
 *   walkerBody     its legs, hull and deck, under the robots (the ones aboard stand on it), before the items
 *   walkerItems    its stacks and crane among the buildings and robots, sorted with them by its middle
 *   walkerLights   its lamps at night (render.js's pool)
 *   walkerMarks    on top: the deck's ring, the claim (an arc in the claimant's colour), CONTESTED, its name and state
 */

const WALKER_LOOK = {
  len: 5.4, wid: 3.4,            // the hull, tiles (along its heading, across)
  stride: 1.3,                   // tiles walked per step of a leg
  hips: [-1.75, 0, 1.75],        // the legs' hips along the hull
  reach: 2.75,                   // a foot's distance from the middle line
  plate: '#5b6066', plateHi: '#7d838a', plateLo: '#33373c', rust: '#7a5236', accord: '#d8b04a', grate: '#464b51',
};

/** Its holder's colour, or the old Accord yellow while no one holds it. */
function walkerColor(w) { return w.owner >= 0 ? PLAYER_COLORS[w.owner] : WALKER_LOOK.accord; }

/** Local (u along its heading, v to its right) to the screen. */
function walkerPt(w, ox, oy, z, u, v) {
  const c = Math.cos(w.h), s = Math.sin(w.h);
  return [ox + (w.x + u * c - v * s) * z, oy + (w.y + u * s + v * c) * z];
}

/* ------------------------------------------------------------------ the yard */

function walkerGround(ctx, ox, oy, z) {
  const w = S.walker;
  if (!w) return;
  const cx = ox + w.cx * z, cy = oy + w.cy * z;
  ctx.save();
  // The yard: the ground it has trampled flat for sixty years, a shade paler and bare.
  ctx.beginPath(); ctx.arc(cx, cy, (w.R + w.Y) * z, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(214,196,160,0.10)'; ctx.fill();
  // The track of its loop: two worn ruts where its feet come down, and the old marker posts' bases.
  ctx.strokeStyle = 'rgba(70,52,36,0.13)'; ctx.lineWidth = Math.max(1, z * 0.55);
  for (const k of [-1, 1]) { ctx.beginPath(); ctx.arc(cx, cy, (w.R + k * WALKER_LOOK.reach * 0.85) * z, 0, Math.PI * 2); ctx.stroke(); }
  // Its footprints along the ruts, pressed in over the years.
  ctx.fillStyle = 'rgba(60,44,30,0.16)';
  const n = Math.round((w.R * Math.PI * 2) / WALKER_LOOK.stride);
  for (let k = 0; k < n; k++) for (const sd of [-1, 1]) {
    const a = ((k + (sd > 0 ? 0.5 : 0)) / n) * Math.PI * 2, r = (w.R + sd * WALKER_LOOK.reach * 0.85) * z;
    ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * r, cy + Math.sin(a) * r, z * 0.3, z * 0.2, a, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(240,226,190,0.12)'; ctx.lineWidth = Math.max(1, z * 0.18); ctx.setLineDash([z * 0.5, z * 0.7]);
  ctx.beginPath(); ctx.arc(cx, cy, w.R * z, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2, r = (w.R + w.Y - 0.4) * z;
    ctx.fillStyle = 'rgba(216,176,74,0.35)'; ctx.fillRect(cx + Math.cos(a) * r - z * 0.12, cy + Math.sin(a) * r - z * 0.12, z * 0.24, z * 0.24);
  }
  // The cradle in the middle: a concrete pad with the Accord's yellow chevrons, where it lay dormant.
  const pr = 3.1 * z;
  ctx.fillStyle = 'rgba(130,126,118,0.3)'; ctx.beginPath(); ctx.arc(cx, cy, pr, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(216,176,74,0.45)'; ctx.lineWidth = Math.max(1, z * 0.12); ctx.setLineDash([z * 0.45, z * 0.35]);
  ctx.beginPath(); ctx.arc(cx, cy, pr, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(90,86,80,0.35)'; ctx.lineWidth = Math.max(1, z * 0.06);
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * pr * 0.35, cy + Math.sin(a) * pr * 0.35); ctx.lineTo(cx + Math.cos(a) * pr * 0.92, cy + Math.sin(a) * pr * 0.92); ctx.stroke(); }
  ctx.restore();
}

/* ------------------------------------------------------------------ the machine */

/** Leg k (0..5: hips front to back, left then right): where its foot is and how high it's lifted (0 down, 1 top). */
function walkerLeg(w, k) {
  const L = WALKER_LOOK, side = k < 3 ? -1 : 1, hip = L.hips[k % 3];
  const group = ((k % 3) + (side > 0 ? 1 : 0)) % 2; // (a tripod gait: front and back on one side with the middle on the other)
  const walking = w.ph > 0;
  const ph = (w.od / L.stride + group * 0.5) % 1, s = Math.sin(ph * Math.PI * 2);
  const swing = walking ? (ph < 0.5 ? -Math.cos(ph * 2 * Math.PI) : Math.cos((ph - 0.5) * 2 * Math.PI)) : 0;
  const lift = walking && ph < 0.5 ? Math.max(0, s) : 0;
  return { u: hip * 1.08 + swing * 0.42, v: side * (L.reach - lift * 0.25), hu: hip, hv: side * L.wid * 0.46, lift, side };
}

function walkerBody(ctx, ox, oy, z) {
  const w = S.walker;
  if (!w) return;
  const L = WALKER_LOOK, col = walkerColor(w), P = (u, v) => walkerPt(w, ox, oy, z, u, v);
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // Its shadow.
  { const [sx, sy] = P(0, 0); ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(sx + z * 0.35, sy + z * 0.45, L.len * 0.62 * z, L.wid * 0.85 * z, w.h, 0, Math.PI * 2); ctx.fill(); }
  // The legs: hip, knee up off the ground (toward the camera), foot.
  for (let k = 0; k < 6; k++) {
    const g = walkerLeg(w, k), [hx, hy0] = P(g.hu, g.hv), [fx, fy] = P(g.u, g.v), up = z * (1.0 + g.lift * 0.4), hy = hy0 - z * 0.5;
    const [kx, ky0] = P((g.hu + g.u) / 2, g.side * (L.reach + 0.55));
    const ky = ky0 - up;
    if (!g.lift) { ctx.fillStyle = 'rgba(30,24,18,0.35)'; ctx.beginPath(); ctx.ellipse(fx, fy + z * 0.05, z * 0.36, z * 0.22, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.strokeStyle = L.plateLo; ctx.lineWidth = Math.max(2, z * 0.36);
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(kx, ky); ctx.lineTo(fx, fy - g.lift * z * 0.4); ctx.stroke();
    ctx.strokeStyle = L.plateHi; ctx.lineWidth = Math.max(1, z * 0.14);
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(kx, ky); ctx.lineTo(fx, fy - g.lift * z * 0.4); ctx.stroke();
    ctx.fillStyle = L.accord; ctx.beginPath(); ctx.arc(kx, ky, Math.max(1.5, z * 0.2), 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = L.plateLo; ctx.beginPath(); ctx.ellipse(fx, fy - g.lift * z * 0.4, z * 0.34, z * 0.24, w.h, 0, Math.PI * 2); ctx.fill();
  }
  // The hull: a long plated body, its corners cut, standing a little off the ground.
  ctx.translate(ox + w.x * z, oy + w.y * z - z * 0.5); ctx.rotate(w.h);
  const hl = (L.len / 2) * z, hw = (L.wid / 2) * z, cut = z * 0.7;
  const hull = () => { ctx.beginPath(); ctx.moveTo(-hl + cut, -hw); ctx.lineTo(hl - cut, -hw); ctx.lineTo(hl, -hw + cut); ctx.lineTo(hl, hw - cut); ctx.lineTo(hl - cut, hw); ctx.lineTo(-hl + cut, hw); ctx.lineTo(-hl, hw - cut); ctx.lineTo(-hl, -hw + cut); ctx.closePath(); };
  ctx.fillStyle = L.plateLo; ctx.save(); ctx.translate(0, z * 0.18); hull(); ctx.fill(); ctx.restore();
  hull(); ctx.fillStyle = L.plate; ctx.fill();
  ctx.strokeStyle = L.plateLo; ctx.lineWidth = Math.max(1, z * 0.08); ctx.stroke();
  // Rust streaks and plate seams (the same every frame).
  ctx.fillStyle = 'rgba(122,82,54,0.45)';
  for (let k = 0; k < 7; k++) ctx.fillRect(-hl + z * 0.4 + hash2(k, 3, 9071) * (hl * 2 - z), -hw + hash2(k, 5, 9071) * hw * 1.6, z * 0.5, z * 0.16);
  ctx.strokeStyle = 'rgba(30,32,36,0.45)'; ctx.lineWidth = Math.max(1, z * 0.04);
  for (let k = 1; k < 5; k++) { const x = -hl + (k / 5) * hl * 2; ctx.beginPath(); ctx.moveTo(x, -hw); ctx.lineTo(x, hw); ctx.stroke(); }
  // Its flanks in its holder's colour (old Accord yellow while no one holds it), with hazard chevrons.
  ctx.fillStyle = col;
  ctx.fillRect(-hl + cut, -hw, hl * 2 - cut * 2, z * 0.26); ctx.fillRect(-hl + cut, hw - z * 0.26, hl * 2 - cut * 2, z * 0.26);
  ctx.fillStyle = 'rgba(20,20,22,0.6)';
  for (let x = -hl + cut + z * 0.1; x < hl - cut - z * 0.3; x += z * 0.6) for (const y of [-hw, hw - z * 0.26]) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + z * 0.18, y); ctx.lineTo(x + z * 0.36, y + z * 0.26); ctx.lineTo(x + z * 0.18, y + z * 0.26); ctx.closePath(); ctx.fill(); }
  // The deck: a grating where the robots aboard stand (the front two thirds), the works behind it.
  const dx0 = -hl * 0.35, dx1 = hl - cut * 0.6;
  ctx.fillStyle = L.grate; ctx.fillRect(dx0, -hw + z * 0.36, dx1 - dx0, hw * 2 - z * 0.72);
  ctx.strokeStyle = 'rgba(140,146,152,0.35)'; ctx.lineWidth = Math.max(1, z * 0.04);
  for (let x = dx0 + z * 0.3; x < dx1; x += z * 0.3) { ctx.beginPath(); ctx.moveTo(x, -hw + z * 0.36); ctx.lineTo(x, hw - z * 0.36); ctx.stroke(); }
  // Its line's mouth at the front: a ramp, glowing as the next Warbot nears.
  const due = w.owner >= 0 && !w.hot ? clamp(1 - w.t / WALKER.every, 0, 1) : 0;
  ctx.fillStyle = '#2a2d31'; ctx.fillRect(hl - z * 0.55, -z * 0.6, z * 0.55, z * 1.2);
  if (due > 0) { ctx.fillStyle = col; ctx.globalAlpha = 0.25 + 0.6 * due * due; ctx.fillRect(hl - z * 0.5, -z * 0.5 * due, z * 0.4, z * due); ctx.globalAlpha = 1; }
  // The works at the back: a raised block (its stacks and crane stand on it: walkerItems).
  ctx.fillStyle = L.plateHi; ctx.fillRect(-hl + cut * 0.5, -hw + z * 0.4, hl * 0.62, hw * 2 - z * 0.8);
  ctx.fillStyle = L.plateLo; ctx.fillRect(-hl + cut * 0.5, hw - z * 0.6, hl * 0.62, z * 0.2);
  // The Accord's mark on the works: a ring of four.
  ctx.strokeStyle = L.accord; ctx.lineWidth = Math.max(1, z * 0.09);
  const mx = -hl + cut * 0.5 + hl * 0.31;
  ctx.beginPath(); ctx.arc(mx, 0, z * 0.42, 0, Math.PI * 2); ctx.stroke();
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; ctx.beginPath(); ctx.arc(mx + Math.cos(a) * z * 0.42, Math.sin(a) * z * 0.42, z * 0.1, 0, Math.PI * 2); ctx.fillStyle = L.accord; ctx.fill(); }
  // Running lamps at the corners: its holder's colour, dim while it's dormant.
  const lit = w.ph === 0 && w.owner < 0 ? 0.35 : 0.75 + 0.25 * Math.sin((typeof R !== 'undefined' ? R.time : 0) * 3);
  ctx.globalAlpha = lit; ctx.fillStyle = col;
  for (const [x, y] of [[hl - cut, -hw], [hl - cut, hw], [-hl + cut, -hw], [-hl + cut, hw]]) { ctx.beginPath(); ctx.arc(x, y, z * 0.14, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

/** Its stacks and crane, standing up off the works at the back, sorted with the buildings and robots. */
function walkerItems(items, inView) {
  const w = S.walker;
  if (w && inView(w.x, w.y, 6)) items.push({ ent: 'walker', x: w.x, y: w.y });
}

function walkerDraw(ctx, e, ox, oy, z) {
  const w = S.walker, L = WALKER_LOOK, col = walkerColor(w), P = (u, v) => walkerPt(w, ox, oy, z, u, v), lift = z * 0.5;
  const t = typeof R !== 'undefined' ? R.time : 0;
  ctx.save();
  ctx.lineCap = 'round';
  // The crane: a mast at the back corner with its jib swung out over the deck.
  const [bx, by0] = P(-L.len * 0.32, L.wid * 0.3), by = by0 - lift, top = by - z * 2.2;
  ctx.strokeStyle = L.accord; ctx.lineWidth = Math.max(1.5, z * 0.16);
  ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx, top); ctx.stroke();
  const [jx0, jy0] = P(L.len * 0.15, -L.wid * 0.05), jy = jy0 - lift - z * 2.0;
  ctx.lineWidth = Math.max(1, z * 0.11); ctx.beginPath(); ctx.moveTo(bx, top); ctx.lineTo(jx0, jy); ctx.stroke();
  ctx.strokeStyle = 'rgba(30,30,30,0.7)'; ctx.lineWidth = Math.max(1, z * 0.04); ctx.beginPath(); ctx.moveTo(jx0, jy); ctx.lineTo(jx0, jy + z * 1.2 + Math.sin(t * 1.3) * z * 0.1); ctx.stroke();
  // Two smokestacks on the works, smoking while it walks.
  for (const [u, v, hgt] of [[-L.len * 0.42, -L.wid * 0.18, 2.6], [-L.len * 0.3, -L.wid * 0.18, 2.1]]) {
    const [sx, sy0] = P(u, v), sy = sy0 - lift, r = z * 0.32, h = z * hgt;
    ctx.fillStyle = L.plateLo; ctx.fillRect(sx - r, sy - h, r * 2, h);
    ctx.fillStyle = L.plate; ctx.fillRect(sx - r, sy - h, r, h);
    ctx.fillStyle = col; ctx.fillRect(sx - r, sy - h + z * 0.25, r * 2, z * 0.18);
    ctx.fillStyle = '#1d1f22'; ctx.beginPath(); ctx.ellipse(sx, sy - h, r, r * 0.45, 0, 0, Math.PI * 2); ctx.fill();
    if (w.ph > 0 && !(typeof LESS_MOTION !== 'undefined' && LESS_MOTION && LESS_MOTION.matches)) {
      for (let k = 0; k < 4; k++) {
        const a = ((t * 0.45 + k / 4 + hgt) % 1), px = sx + a * z * 0.9 + Math.sin(t + k) * z * 0.15, py = sy - h - a * z * 1.6;
        ctx.fillStyle = `rgba(150,146,140,${0.35 * (1 - a)})`; ctx.beginPath(); ctx.arc(px, py, r * (0.6 + a * 1.4), 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  // A pennant on the crane mast: its holder's colour (none while no one holds it).
  if (w.owner >= 0) {
    const wave = Math.sin(t * 4) * z * 0.12;
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(bx, top); ctx.lineTo(bx + z * 0.9, top + z * 0.22 + wave); ctx.lineTo(bx, top + z * 0.45); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

/** Its lamps at night: a warm floodlight over the deck, and its holder's colour. */
function walkerLights(pool, ox, oy, z) {
  const w = S.walker;
  if (!w) return;
  pool(ox + w.x * z, oy + w.y * z, z * 4.5, '#ffe2a8');
  if (w.owner >= 0) pool(ox + w.x * z, oy + w.y * z, z * 3, PLAYER_COLORS[w.owner]);
}

/* ------------------------------------------------------------------ the claim, on top */

/** Its state in a few words, for the marks and the panel. */
function walkerState(w) {
  if (w.hot) return 'CONTESTED';
  if (w.owner >= 0) return w.prog < 1 ? `${playerName(w.owner).toUpperCase()}: HOLD ${Math.round(w.prog * 100)}%` : playerName(w.owner).toUpperCase();
  if (w.cap >= 0 && w.prog > 0) return `CLAIMING ${Math.round(w.prog * 100)}%`;
  if (S.time < walkerWakeAt()) { const s = Math.ceil(walkerWakeAt() - S.time); return `WAKES IN ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
  return w.ph === 0 ? 'DORMANT' : 'NO ONE';
}

function walkerMarks(ctx, ox, oy, z) {
  const w = S.walker;
  if (!w || (typeof R !== 'undefined' && R.clean >= 2)) return;
  const x = ox + w.x * z, y = oy + w.y * z, r = WALKER.deck * z, t = typeof R !== 'undefined' ? R.time : 0;
  ctx.save();
  // The deck's ring: who may stand aboard.
  ctx.lineWidth = Math.max(1.5, z * 0.09);
  if (w.hot) { ctx.strokeStyle = Math.sin(t * 9) > 0 ? '#ff5a4e' : '#fff3e0'; ctx.setLineDash([]); }
  else { ctx.strokeStyle = w.owner >= 0 ? PLAYER_COLORS[w.owner] : 'rgba(255,240,200,0.7)'; ctx.setLineDash([z * 0.4, z * 0.3]); ctx.lineDashOffset = -t * z * 0.4; }
  ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  // The claim: an arc in the claimant's colour (a holder's, taken down, in its own).
  const who = w.owner >= 0 ? w.owner : w.cap;
  if (who >= 0 && w.prog > 0 && w.prog < 1) {
    ctx.globalAlpha = 1; ctx.lineWidth = Math.max(3, z * 0.28); ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath(); ctx.arc(x, y, r + z * 0.35, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = PLAYER_COLORS[who]; ctx.lineWidth = Math.max(2, z * 0.2);
    ctx.beginPath(); ctx.arc(x, y, r + z * 0.35, -Math.PI / 2, -Math.PI / 2 + w.prog * Math.PI * 2); ctx.stroke();
  }
  // Held: the time to its next Warbot, a thin arc inside the ring.
  if (w.owner >= 0 && !w.hot && w.prog >= 1) {
    ctx.globalAlpha = 0.7; ctx.lineWidth = Math.max(1, z * 0.08); ctx.strokeStyle = '#fff3d0';
    ctx.beginPath(); ctx.arc(x, y, r - z * 0.25, -Math.PI / 2, -Math.PI / 2 + clamp(1 - w.t / WALKER.every, 0, 1) * Math.PI * 2); ctx.stroke();
  }
  // Its name and state over it.
  const fs = Math.max(10, Math.min(16, z * 0.75)), ty = y - (WALKER_LOOK.wid / 2 + 3.2) * z;
  ctx.globalAlpha = 0.95; ctx.textAlign = 'center'; ctx.font = `700 ${fs}px system-ui, sans-serif`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(fs * 0.12)}px`;
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(16,14,12,0.7)';
  ctx.strokeText('THE WALKING FACTORY', x, ty); ctx.fillStyle = '#f4e6c4'; ctx.fillText('THE WALKING FACTORY', x, ty);
  const st = walkerState(w);
  ctx.font = `700 ${Math.round(fs * 0.85)}px system-ui, sans-serif`;
  ctx.strokeText(st, x, ty + fs * 1.15);
  ctx.fillStyle = w.hot ? '#ff7a6e' : w.owner >= 0 ? PLAYER_COLORS[w.owner] : w.cap >= 0 && w.prog > 0 ? PLAYER_COLORS[w.cap] : '#e8d8b0';
  ctx.fillText(st, x, ty + fs * 1.15);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  ctx.restore();
}

/* ------------------------------------------------------------------ its panel */

/** Is map tile (i, j) on its deck (a tap there opens its panel)? */
function walkerAtTap(i, j) { const w = S && S.walker; return !!w && dist2(i + 0.5, j + 0.5, w.x, w.y) <= WALKER.deck * WALKER.deck; }

/** Tapped: its panel (who holds it, who's aboard, its line; Send warbots aboard). */
function walkerSheet() {
  const w = S.walker;
  if (!w) return;
  if (typeof R !== 'undefined') { R.selected = 0; R.selTile = -1; }
  if (typeof UI !== 'undefined') UI.selBot = 0;
  const crew = walkerCrew(), mine = crew[ME] || 0, theirs = crew.reduce((n, c, p) => n + (p !== ME && foes(p, ME) ? c : 0), 0);
  let state;
  if (w.hot) state = '<b>Contested:</b> robots of two sides are aboard. Nothing changes and its line stops until one side is gone.';
  else if (w.owner === ME) state = w.prog < 1 ? `<b>Yours, but enemy robots took your hold down to ${Math.round(w.prog * 100)}%.</b>` : `<b>Yours.</b> Its next Warbot in ${Math.ceil(w.t)} s (${w.kids.filter((id) => { const u = getE(id); return u && !u.dead && u.owner === ME; }).length} of ${WALKER.kids} of its Warbots out at most).`;
  else if (w.owner >= 0) state = `<b>Held by ${esc(playerName(w.owner))}</b>${w.prog < 1 ? `: their hold is down to ${Math.round(w.prog * 100)}%` : ''}. Board it with armed robots to take their hold down, then claim it.`;
  else if (w.cap >= 0 && w.prog > 0) state = `<b>${w.cap === ME ? 'Your claim' : esc(playerName(w.cap)) + '\'s claim'}: ${Math.round(w.prog * 100)}%.</b> Robots aboard alone finish it.`;
  else if (S.time < walkerWakeAt()) state = `<b>Warming up:</b> it can be claimed in ${Math.ceil(walkerWakeAt() - S.time)} s. Robots aboard before then count for nothing yet.`;
  else state = w.ph === 0 ? '<b>Dormant in its cradle.</b> Armed robots aboard alone claim it, and it wakes.' : '<b>No one holds it.</b> Armed robots aboard alone claim it.';
  const html = `<div class="sheet-title"><div><h3>The Walking Factory</h3><div class="sub">Accord Mobile Works</div></div></div>
    <p class="flavor">${esc(WALKER_LINE)}</p>
    <p class="desc">${state}</p>
    <p class="desc">Aboard: <b>${mine}</b> of yours${theirs ? `, <b>${theirs}</b> enemy` : ''}. Armed robots on its deck (inside the ring) count; alone aboard, one claims it in ${WALKER.capture} s, more faster. Held, it builds you a Warbot every ${WALKER.every} s and recharges and reloads your robots aboard. Robots sent onto its deck walk with it.</p>
    <div class="btn-row"><button class="btn primary" id="sh-board">Send warbots aboard</button></div>`;
  openSheet('walker', 1, html);
  const b = $('sh-board');
  if (b) b.onclick = () => { sfx('click'); act('rally', [Math.floor(w.x), Math.floor(w.y), 4], (r) => { const n = r && r.sent; toast(n ? `${n} warbot${n > 1 ? 's are' : ' is'} on the way aboard the Walking Factory.` : 'No warbots free to send: build more, or select some and tap its deck.', n ? 'info' : 'warn'); walkerSheet(); }); };
}

/** A few times a second (the interface): its open panel kept current. */
function walkerUiTick() {
  if (!S || !S.walker || typeof UI === 'undefined' || UI.sheetKind !== 'walker') return;
  UI.walkerT = (UI.walkerT || 0) + 1;
  if (UI.walkerT % 4 === 0) walkerSheet();
}

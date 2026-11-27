'use strict';
/*
 * Terrafall — space expansion phase 1: its look (the rules in js/sim.js: SPACE, GUNSHIP, PDT, DRIFT, DERELICT in js/defs.js).
 * Looks only: nothing here reads or changes anything the game decides, so it may use Math.random and the real clock.
 *
 *   - The spacecraft (art: renderer/b/ships.js, tools/render_space.sh, installed by tools/install_space.py; straight down,
 *     nose east): the Shuttle (Frame Tug), the Dropship (Clamshell) and the Gunship (Lancet). Flying, the lit sprite, a
 *     slow hover bob and its thrusters' glow pulsing; parked or landed, the gear-down sprite; the Dropship's stern ramp in
 *     two frames as it lowers. Each throws a shadow down-sun, further off the higher it flies. Parked craft are drawn on
 *     their Launch Pad with it (spaceDrawBuilding); the rest over everything (spaceDrawAir), as aircraft are.
 *   - The Launch Pad (Cradle Ring, accent pad lilac) and the Point-Defence Turret (Twin Rotary, accent orchid: its guns in
 *     8 headings, the nearest to its aim).
 *   - Drifting asteroids, slowly tumbling (plain, Ore- and Crystal-bearing; a towed one in its harness, the cable drawn in
 *     code to the Shuttle's claw) and the derelict modules adrift off the decks (Accord white and Trade Post amber while
 *     no one holds them, lit in the holder's colour once held), bobbing a little.
 *   - In code: the Gunship's purple laser (a white-violet core and an indigo-violet glow, a short bolt, a flare where it
 *     hits: kept apart from the Murmur's violet and Point-Defence's orchid) and Point-Defence's tracers (orchid-white
 *     dashes). With no art installed (or not loaded yet: ensureSpaceArt) everything is drawn plainly in code.
 */

/*
 * The space art (the craft, the Launch Pad, Point-Defence, the drifting rocks, the derelict modules and the Graveyard's
 * salvage, shards and Arbiter relay, and their re-lit
 * sets for the time of day: SPACE_TOD_KEYS) loads only on a space map (ensureSpaceArt, from applyBiome), as the
 * landmarks' and the Murmur's do. In a single-file copy it's a bundle beside the page (space-art.js: the day art and
 * each time's set). Until it's in, everything here is drawn plainly in code.
 */
const SPACE_ART = /^(shuttle|dropship|gunship)(-park|-ramp[12])?@\d$|^launchpad@\d$|^pdturret(-\d)?@\d$|^rock-(plain|ore|crystal)(-tow)?$|^mod-(solar|dock|hulk)(@\d)?$|^grave-(salvage-\d|junk|arb)(@\d)?$/;
const _spaceArt = { state: '' };
function spaceArtKey(key) { return SPACE_ART.test(key); }
function ensureSpaceArt() {
  if (_spaceArt.state || typeof ART_MANIFEST !== 'object') return;
  _spaceArt.state = 'loading';
  const keys = Object.keys(ART_MANIFEST).filter(spaceArtKey);
  const entryOf = (k) => (typeof ART_MANIFEST[k] === 'string' ? { src: ART_MANIFEST[k] } : ART_MANIFEST[k]);
  const done = () => { _spaceArt.state = 'in'; if (typeof todSpaceIn === 'function') todSpaceIn(); };
  if (typeof window !== 'undefined' && window.SPACE_BUNDLE) {
    const go = () => { const d = window.SPACE_DATA && window.SPACE_DATA.day; if (d) for (const k of keys) if (d[k]) loadArtKey(k, { ...entryOf(k), src: d[k] }); done(); };
    if (window.SPACE_DATA) { go(); return; }
    const sc = document.createElement('script');
    sc.src = 'space-art.js';
    sc.onload = go;
    sc.onerror = () => { _spaceArt.state = 'failed'; }; // (no bundle: drawn in code)
    document.head.appendChild(sc);
    return;
  }
  for (const k of keys) loadArtKey(k, entryOf(k));
  done();
}

/** The art's frames in tiles across (the top views' W in renderer units / 10), and the look's colours. */
const SPACE_LOOK = {
  frame: { shuttle: 1.8, dropship: 1.8, gunship: 1.5 },
  rockFrame: 12 / 7, towFrame: 16 / 7, // (the rock's frame over its width: s=7 in a W=12 frame, W=16 in harness)
  modFrame: 2.6,
  laser: { core: '#f3eeff', glow: '#7d5cff', flare: '#b8a4ff' },
  tracer: { core: '#fff3fd', glow: '#ffb8ff' },
  plume: '#ffc47a',
  bob: 0.035, // (tiles of hover bob)
  // where each craft's lift thrusters are, as fractions of its frame from its middle (nose east), for their glow in code
  pods: {
    shuttle: [[0.233, -0.186], [0.233, 0.186], [-0.3, -0.186], [-0.3, 0.186]],
    dropship: [[0.144, -0.186], [0.144, 0.186], [-0.167, -0.186], [-0.167, 0.186]],
    gunship: [[-0.01, -0.183], [-0.01, 0.183], [-0.2, -0.137], [-0.2, 0.137]],
  },
};

/** The sprite for craft u now: flying, parked (gear down), or the Dropship's ramp coming down. */
function craftArt(u) {
  const air = (u.alt || 0) > 0.05;
  let k = air ? u.type : u.type + '-park';
  if (u.type === 'dropship' && !air && (u.ramp || 0) > 0.05) k = u.ramp > 0.7 ? 'dropship-ramp2' : 'dropship-ramp1';
  return artFor(k, u.owner) || artFor(u.type, u.owner);
}

/** Craft u at (sx, sy) on screen (the ground under it), tile size s. */
function drawCraft(ctx, u, sx, sy, s) {
  const alt = u.alt || 0, f = u.rface ?? u.face ?? 0, F = s * (SPACE_LOOK.frame[u.type] || 1.6) * (1 + 0.08 * alt);
  const bob = alt > 0.05 ? Math.sin((R.time || 0) * 2.2 + u.id) * SPACE_LOOK.bob * s * alt : 0, y = sy - alt * s * 0.35 + bob;
  // its shadow, down-sun, further off the higher it is
  const off = s * (0.08 + 0.75 * alt), art = craftArt(u);
  ctx.save();
  ctx.globalAlpha *= (0.38 - 0.16 * alt) * (TOD.active ? 1 - 0.45 * (TOD.state.pools || 0) : 1);
  ctx.translate(sx + off * 0.7, sy + off); ctx.rotate(f);
  ctx.fillStyle = 'rgba(4,8,14,1)';
  ctx.beginPath(); ctx.ellipse(0, 0, F * 0.36, F * (u.type === 'gunship' ? 0.24 : 0.2), 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // thruster glow under it while it is up (code, pulsing: the art's own plumes are baked)
  if (alt > 0.05) {
    const pods = SPACE_LOOK.pods[u.type] || [], c = Math.cos(f), sn = Math.sin(f), r = F * 0.11 * (0.85 + 0.15 * Math.sin((R.time || 0) * 31 + u.id));
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const [px, py] of pods) {
      const x = sx + (px * c - py * sn) * F, yy = y + (px * sn + py * c) * F;
      const g = ctx.createRadialGradient(x, yy, 0, x, yy, r * 1.8);
      g.addColorStop(0, `rgba(255,244,224,${0.55 * alt})`); g.addColorStop(0.35, `rgba(255,196,122,${0.35 * alt})`); g.addColorStop(1, 'rgba(255,122,58,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, yy, r * 1.8, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  if (art) drawArt(ctx, art, sx, y, F, f);
  else {
    ctx.save(); ctx.translate(sx, y); ctx.rotate(f);
    ctx.fillStyle = '#4a5158'; ctx.strokeStyle = PLAYER_COLORS[u.owner] || '#fff'; ctx.lineWidth = Math.max(1, F * 0.02);
    ctx.beginPath(); ctx.moveTo(F * 0.4, 0); ctx.lineTo(-F * 0.3, -F * 0.2); ctx.lineTo(-F * 0.3, F * 0.2); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  // at night its team lights pool on the ground under it
  if (TOD.active && TOD.state.pools > 0.05 && typeof drawLightPool === 'function' && alt > 0.05) drawLightPool(ctx, sx + off * 0.7, sy + off, s * 0.9, PLAYER_COLORS[u.owner] || '#ffffff');
  if (R.clean) return;
  const bh = Math.max(2, s * 0.05), ext = F * 0.32;
  if (u.hp < u.maxHp) hpBar(ctx, u.id, u.hp / u.maxHp, sx - s * 0.4, y - ext - bh - 2, s * 0.8, bh);
  if (u.owner === ME && u.bat !== undefined && alt > 0.05) { // (its tank, yours only, as a plane's)
    const w = s * 0.8, gy = y + ext + 2, k = clamp(u.bat, 0, 100) / 100;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(sx - w / 2 - 1, gy - 1, w + 2, bh + 2);
    ctx.fillStyle = k < 0.3 ? '#ff8a3c' : GOOD.fuel.color; ctx.fillRect(sx - w / 2, gy, w * k, bh);
  }
  if (typeof UI !== 'undefined' && (UI.sel && UI.sel.includes(u.id) || UI.selBot === u.id)) {
    ctx.strokeStyle = PLAYER_COLORS[u.owner] || '#fff'; ctx.lineWidth = Math.max(1.5, s * 0.04);
    ctx.beginPath(); ctx.ellipse(sx, y, F * 0.42, F * 0.3, 0, 0, Math.PI * 2); ctx.stroke();
  }
}

/** A Launch Pad (with the craft parked on it) or a Point-Defence Turret (its guns at the heading nearest its aim). False: drawn the usual way. */
function spaceDrawBuilding(ctx, type, cx, cy, s, owner, b) {
  if (type === 'pdturret') {
    const aim = b && b.aim !== undefined ? b.aim : -Math.PI / 4, k = ((Math.round(aim / (Math.PI / 4)) % 8) + 8) % 8;
    const art = artFor('pdturret-' + k, owner);
    if (!art) return false;
    drawArt(ctx, art, cx, cy, s);
    if (b && b.flash !== undefined && (R.time !== undefined) && S.time - b.flash < 0.12 && TOD.active && typeof drawLightPool === 'function') drawLightPool(ctx, cx, cy, s * 0.9, SPACE_LOOK.tracer.glow);
    return true;
  }
  if (type !== 'launchpad') return false;
  const art = artFor('launchpad', owner);
  if (art) drawArt(ctx, art, cx, cy, s * 2);
  else {
    ctx.fillStyle = '#5a5d60'; ctx.beginPath(); ctx.arc(cx, cy, s * 0.85, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#d9c8ff'; ctx.lineWidth = Math.max(1, s * 0.05); ctx.stroke();
  }
  // its craft parked on it (inside the pad: the bot pass leaves them out)
  if (b && b.id && b.built) {
    const z = s, ox = cx - (b.x + 1) * z, oy = cy - (b.y + 1) * z;
    for (const u of S.bots) if (!u.dead && u.inside === b.id && BOTS[u.type].craft) drawCraft(ctx, u, ox + u.x * z, oy + u.y * z, z);
  }
  return true;
}

/** Where drifting asteroid r is on screen this frame (rockPos, smoothed between steps by nothing more than the sim's own). */
function drawRock(ctx, r, ox, oy, z) {
  if (typeof drawGraveRock === 'function' && drawGraveRock(ctx, r, ox, oy, z)) return; // (The Graveyard's salvage and debris: js/grave.js)
  const p = rockPos(r), x = ox + p.x * z, y = oy + p.y * z, d = 2 * DRIFT.r[r.k] * z;
  if (r.tow) {
    const u = getE(r.tow), art = ART['rock-' + r.k + '-tow'];
    const a = u ? Math.atan2(u.y - p.y, u.x - p.x) + Math.PI : 0;
    // the cable, from the harness to the Shuttle's claw
    if (u) {
      const cx = ox + (u.x - Math.cos(u.face || 0) * 0.75) * z, cy = oy + (u.y - Math.sin(u.face || 0) * 0.75) * z - (u.alt || 0) * z * 0.35;
      ctx.strokeStyle = 'rgba(20,22,26,0.9)'; ctx.lineWidth = Math.max(1, z * 0.04);
      ctx.beginPath(); ctx.moveTo(x - Math.cos(a) * d * 0.55, y - Math.sin(a) * d * 0.55); ctx.lineTo(cx, cy); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,166,50,0.55)'; ctx.lineWidth = Math.max(0.5, z * 0.012); ctx.stroke();
    }
    if (art) { drawArt(ctx, art, x, y, d * SPACE_LOOK.towFrame, a); return; }
  }
  const art = ART['rock-' + r.k];
  const spin = (R.time || 0) * 0.05 * (r.id % 2 ? 1 : -1) + r.id * 1.7;
  // its shadow on the void below, faint
  ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(x + d * 0.35, y + d * 0.5, d * 0.45, d * 0.3, 0, 0, Math.PI * 2); ctx.fill();
  if (art) drawArt(ctx, art, x, y, d * SPACE_LOOK.rockFrame, spin);
  else { ctx.fillStyle = r.k === 'ore' ? '#8a6a52' : r.k === 'crystal' ? '#7d74a0' : '#7d756e'; ctx.beginPath(); ctx.arc(x, y, d / 2, 0, Math.PI * 2); ctx.fill(); }
}

/** A derelict module adrift off a deck: as it was left (no one holds it) or lit in its holder's colour, a slow bob; jammed, its lights flicker. */
function drawSpaceMod(ctx, m, ox, oy, z) {
  const held = modHolder(m), bob = Math.sin((R.time || 0) * 0.6 + m.id) * 0.04 * z;
  const x = ox + (m.x + 1) * z, y = oy + (m.y + 1) * z + bob, F = SPACE_LOOK.modFrame * z;
  const art = held >= 0 ? artFor('mod-' + m.k, held) : ART['mod-' + m.k];
  ctx.fillStyle = 'rgba(0,0,0,0.26)'; ctx.beginPath(); ctx.ellipse(x + F * 0.12, y + F * 0.22, F * 0.38, F * 0.16, 0, 0, Math.PI * 2); ctx.fill();
  if (art) drawArt(ctx, art, x, y, F, m.k === 'dock' ? 0 : m.tw % 2 ? Math.PI : 0);
  else { ctx.fillStyle = '#b9b6ad'; ctx.fillRect(x - F * 0.35, y - F * 0.15, F * 0.7, F * 0.3); }
  if (R.clean) return;
  // its holder's ring, and a jammed one's warning
  const col = held >= 0 ? PLAYER_COLORS[held] : m.jam ? '#ff5a6e' : '#ffcf7a';
  ctx.strokeStyle = col; ctx.globalAlpha = held >= 0 ? 0.55 : m.jam && Math.sin((R.time || 0) * 10) > 0 ? 0.9 : 0.35;
  ctx.lineWidth = Math.max(1, z * 0.03); ctx.setLineDash([z * 0.18, z * 0.12]);
  ctx.beginPath(); ctx.ellipse(x, y, F * 0.48, F * 0.32, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]); ctx.globalAlpha = 1;
  if (m.k === 'hulk' && m.done) { ctx.fillStyle = 'rgba(10,10,14,0.35)'; ctx.beginPath(); ctx.ellipse(x, y, F * 0.4, F * 0.15, 0, 0, Math.PI * 2); ctx.fill(); }
}

/** The Gunship's laser bolt (fx 'laser'): a short white-violet bolt flies to the target, then a violet flare where it hits. */
function drawLaserFx(ctx, f, ox, oy, z) {
  const k = f.t / f.life, x0 = ox + f.x * z, y0 = oy + f.y * z - z * 0.35, x1 = ox + f.x2 * z, y1 = oy + f.y2 * z - z * 0.1;
  const L = SPACE_LOOK.laser, fly = 0.42;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  if (k < fly) {
    const q = k / fly, hx = x0 + (x1 - x0) * q, hy = y0 + (y1 - y0) * q, len = Math.hypot(x1 - x0, y1 - y0) || 1, bl = Math.min(len * q, z * 0.8);
    const tx = hx - ((x1 - x0) / len) * bl, ty = hy - ((y1 - y0) / len) * bl;
    ctx.strokeStyle = L.glow; ctx.globalAlpha = 0.45; ctx.lineWidth = Math.max(3, z * 0.16); ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.globalAlpha = 0.9; ctx.lineWidth = Math.max(2, z * 0.08); ctx.stroke();
    ctx.strokeStyle = L.core; ctx.globalAlpha = 1; ctx.lineWidth = Math.max(1, z * 0.03); ctx.stroke();
    // the muzzle's flash, a moment
    if (q < 0.4) { const g = ctx.createRadialGradient(x0, y0, 0, x0, y0, z * 0.3); g.addColorStop(0, 'rgba(243,238,255,0.9)'); g.addColorStop(1, 'rgba(125,92,255,0)'); ctx.fillStyle = g; ctx.globalAlpha = 1 - q / 0.4; ctx.beginPath(); ctx.arc(x0, y0, z * 0.3, 0, Math.PI * 2); ctx.fill(); }
  } else {
    const q = (k - fly) / (1 - fly), r = z * (0.25 + 0.35 * q);
    const g = ctx.createRadialGradient(x1, y1, 0, x1, y1, r);
    g.addColorStop(0, `rgba(243,238,255,${1 - q})`); g.addColorStop(0.35, `rgba(184,164,255,${0.8 * (1 - q)})`); g.addColorStop(1, 'rgba(125,92,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x1, y1, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = L.flare; ctx.globalAlpha = 0.8 * (1 - q); ctx.lineWidth = Math.max(1, z * 0.025);
    for (let n = 0; n < 4; n++) { const a = n * Math.PI / 2 + (f.side || 1) * 0.4, rr = r * (0.9 + 0.5 * q); ctx.beginPath(); ctx.moveTo(x1 + Math.cos(a) * rr * 0.3, y1 + Math.sin(a) * rr * 0.3); ctx.lineTo(x1 + Math.cos(a) * rr, y1 + Math.sin(a) * rr); ctx.stroke(); }
  }
  ctx.restore();
}

/** Point-Defence's tracers (fx 'pdtracer'): orchid-white dashes racing along the line of fire. */
function drawPdTracerFx(ctx, f, ox, oy, z) {
  const k = f.t / f.life, x0 = ox + f.x * z, y0 = oy + f.y * z, x1 = ox + f.x2 * z, y1 = oy + f.y2 * z, T = SPACE_LOOK.tracer;
  const len = Math.hypot(x1 - x0, y1 - y0) || 1, ux = (x1 - x0) / len, uy = (y1 - y0) / len, dl = Math.min(len * 0.35, z * 0.55), p = len * k;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  ctx.strokeStyle = T.glow; ctx.globalAlpha = 0.6; ctx.lineWidth = Math.max(2, z * 0.06);
  ctx.beginPath(); ctx.moveTo(x0 + ux * Math.max(0, p - dl), y0 + uy * Math.max(0, p - dl)); ctx.lineTo(x0 + ux * p, y0 + uy * p); ctx.stroke();
  ctx.strokeStyle = T.core; ctx.globalAlpha = 1; ctx.lineWidth = Math.max(1, z * 0.022); ctx.stroke();
  ctx.restore();
}

/** Over everything on a space map (from drawAirLayer, after the aircraft): the modules and rocks out in the void, the craft not parked, their lasers and the tracers. */
function spaceDrawAir(ctx, ox, oy, z, inView) {
  if (!S.space) return;
  for (const m of S.space.mods) if (inView(m.x + 1, m.y + 1, 3)) drawSpaceMod(ctx, m, ox, oy, z);
  for (const r of S.space.rocks) { if (r.gone) continue; const p = rockPos(r); if (inView(p.x, p.y, 3)) drawRock(ctx, r, ox, oy, z); }
  for (const u of S.bots) {
    if (u.dead || !BOTS[u.type].craft || u.inside || !inView(u.x, u.y, 3)) continue;
    const want = u.face || 0, turn = 6 * Math.min(0.1, R.dt || 0) * ((typeof UI !== 'undefined' && UI.speed) || 1);
    u.rface = u.rface === undefined ? want : u.rface + clamp(wrapAngle(want - u.rface), -turn, turn);
    drawCraft(ctx, u, ox + u.x * z, oy + u.y * z, z);
  }
  for (const f of S.fx) {
    if (f.t < 0 || !inView(f.x, f.y, 6)) continue;
    if (f.type === 'laser') drawLaserFx(ctx, f, ox, oy, z);
    else if (f.type === 'pdtracer') drawPdTracerFx(ctx, f, ox, oy, z);
  }
}

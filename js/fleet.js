'use strict';
/*
 * Terrafall — space expansion phase 3, The Void Fleet: the capital ships' look and panels (the rules in js/sim.js: CAPITAL,
 * updateCapital, capHit, the Flagship's deck and aura, the Line Ship's broadsides; the map: voidMap in js/world.js). Looks
 * and panels only: nothing here changes what the game decides but through an order (js/orders.js: capital, fyard), so the
 * look may use Math.random and the real clock.
 *
 *   - The ships (art: renderer/b/capital.js, renderer/tools/render_capital.sh, installed by renderer/tools/install_capital.py;
 *     straight down, nose east, the lazy space-art bundle with its re-lit sets): the Flagship (the canvas's "Tender": a
 *     long faceted hull, the docking collar it rides under its Carrier by, a flight deck with two launch rails, four
 *     point-defence sponsons, four great engines) and the Line Ship (the canvas's "Line": an armoured hull with belt plates,
 *     two twin turrets, a spinal gun). Extra frames: the Flagship's launch rails lit (flagship-launch) while a Gunship goes
 *     up off its deck, the Line Ship's turrets trained to port or starboard and firing (line-fireL, line-fireR).
 *   - In code: the Flagship's main battery (two heavy turrets fore and aft, trained on what they fire at, a flash and smoke
 *     at the muzzles, the barrels kicking back: drawCapBattery), the engines' glow (brighter under way), the shadow far below, the shield (the Shield Dome's pale blue
 *     drawn round the hull: a faint fill, a crisp rim, a hexagon lattice with a shimmer over it; panels flash and a ring
 *     spreads where a shot lands; it flickers and breaks up as it fails; it draws back round from the stern as it
 *     recharges; a soft blue spill under it at night), the broadsides' muzzle flashes and shells, the launch rail's
 *     streak, the ship breaking up, the two bars over it (shield, then hull). With no art everything is drawn in code.
 *   - The home stations' decks are painted as Orbital platforms' decks (orbDeckPaint), the rocks as The Ring's.
 *   - Panels: a capital ship's rows, buttons and orders (capRows, capButtons), the Flagship's deck (its yard), the Army
 *     panel's capital ships, the map pick (tapping its hull), the minimap's marks.
 */

/** The art's frames in tiles across (the top views' W in renderer units / 10), the hull's half-sizes for the shield, the look's colours. */
const FLEET_LOOK = {
  frame: { flagship: 6.8, line: 5.0 },
  hull: { flagship: [3.05, 0.95], line: [2.25, 0.6] }, // (half length, half width in tiles: the shield is drawn round this)
  shield: '120,200,255', rim: '200,236,255',
  // the engines' nozzles, as fractions of the frame from its middle (nose east)
  eng: { flagship: [[-0.455, -0.075], [-0.455, -0.025], [-0.455, 0.025], [-0.455, 0.075]], line: [[-0.455, -0.045], [-0.455, 0], [-0.455, 0.045]] },
  // its turrets' muzzles (a broadside's flashes): fractions of the frame along it, and out to the side
  guns: { line: [[0.12, 0.06], [-0.05, 0.06], [0.3, 0.02]] },
  // the Flagship's main battery: its two turrets along its centreline (fractions of the frame: CAPITAL.flagship.battery.at
  // times its reach over the frame), their housing's radius and barrels' length (tiles)
  battery: { r: 0.32, len: 0.62 },
  // the Flagship's launch rails along its deck: [from, to] along it, their side offsets
  rails: { from: -0.22, to: 0.24, off: [-0.045, 0.045] },
  shell: { core: '#fff6e0', glow: '#ffae4a' },
  plume: '#ffc47a',
};

/** The sprite for capital ship u now: firing (a Line Ship's turrets trained), launching (the Flagship's rails lit), or plain. */
function capArt(u) {
  if (u.type === 'line') {
    const f = capFxOf(u, 'broadside');
    if (f) { const a = artFor(f.side > 0 ? 'line-fireR' : 'line-fireL', u.owner); if (a) return a; }
  } else if (capFxOf(u, 'caplaunch')) { const a = artFor('flagship-launch', u.owner); if (a) return a; }
  return artFor(u.type, u.owner);
}
/** The newest live effect of `type` on capital ship u (a hit, a launch, a broadside), or null. */
function capFxOf(u, type) {
  let best = null;
  for (const f of S.fx) if (f.type === type && f.u === u.id && f.t >= 0 && f.t < f.life && (!best || f.t < best.t)) best = f;
  return best;
}

/** A point on capital ship u's frame (fractions fx along, fy across, of its frame F px) on screen, from its middle (sx, sy). */
function capPt(u, sx, sy, F, fx, fy) {
  const c = Math.cos(u.face || 0), s = Math.sin(u.face || 0);
  return [sx + (fx * c - fy * s) * F, sy + (fx * s + fy * c) * F];
}

/** Capital ship u at (sx, sy) on screen (its middle), tile size z. */
function drawCapital(ctx, u, sx, sy, z) {
  const F = z * FLEET_LOOK.frame[u.type], f = u.face || 0, art = capArt(u), H = FLEET_LOOK.hull[u.type];
  const bob = Math.sin((R.time || 0) * 0.9 + u.id) * 0.03 * z, y = sy - z * 0.35 + bob;
  // Its shadow, far below on the void (faint) or on a deck.
  ctx.save();
  ctx.globalAlpha *= 0.22 * (TOD.active ? 1 - 0.45 * (TOD.state.pools || 0) : 1);
  ctx.translate(sx + z * 0.75, sy + z * 1.0); ctx.rotate(f);
  ctx.fillStyle = 'rgba(4,8,14,1)';
  ctx.beginPath(); ctx.ellipse(0, 0, H[0] * z, H[1] * z * 0.9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // At night its team lights, and its shield's soft blue spill, pool on the void under it (faint, under the hull).
  if (TOD.active && TOD.state.pools > 0.05 && typeof drawLightPool === 'function') {
    const ga = ctx.globalAlpha, frac = clamp((u.cs ?? 0) / CAPITAL[u.type].sh, 0, 1);
    ctx.globalAlpha = ga * 0.35; drawLightPool(ctx, sx, sy, z * H[0] * 0.55, PLAYER_COLORS[u.owner] || '#ffffff');
    if (frac > 0) { ctx.globalAlpha = ga * 0.25 * frac; drawLightPool(ctx, sx, sy, z * H[0] * 0.7, '#78c8ff'); }
    ctx.globalAlpha = ga;
  }
  // The engines' glow, behind the hull: longer and brighter under way.
  {
    const go = clamp((u.vel || 0) / (BOTS[u.type].speed || 1), 0, 1), pulse = 0.85 + 0.15 * Math.sin((R.time || 0) * 23 + u.id);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const [ex, ey] of FLEET_LOOK.eng[u.type]) {
      const [x0, y0] = capPt(u, sx, y, F, ex, ey), len = F * (0.03 + 0.07 * go) * pulse, r = F * 0.022 * (1 + 0.4 * go);
      const tx = x0 - Math.cos(f) * len, ty = y0 - Math.sin(f) * len;
      const g = ctx.createRadialGradient(x0, y0, 0, x0, y0, r * 2.4 + len * 0.5);
      g.addColorStop(0, `rgba(255,244,224,${0.55 + 0.3 * go})`); g.addColorStop(0.35, `rgba(255,196,122,${0.35 + 0.25 * go})`); g.addColorStop(1, 'rgba(255,122,58,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x0, y0, r * 2.4 + len * 0.5, 0, Math.PI * 2); ctx.fill();
      if (go > 0.05) { ctx.strokeStyle = `rgba(255,210,150,${0.35 * go})`; ctx.lineWidth = r * 1.4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(tx, ty); ctx.stroke(); }
    }
    ctx.restore();
  }
  if (art) drawArt(ctx, art, sx, y, F, f);
  else capCodeHull(ctx, u, sx, y, z);
  // A Gunship going up off the Flagship's deck: a streak of light down its launch rail.
  const L = u.type === 'flagship' && capFxOf(u, 'caplaunch');
  if (L) {
    const k = L.t / L.life, Rl = FLEET_LOOK.rails, off = L.rail > 0 ? Rl.off[1] : Rl.off[0], q = clamp(k / 0.6, 0, 1);
    const [ax, ay] = capPt(u, sx, y, F, Rl.from, off), [bx, by] = capPt(u, sx, y, F, Rl.from + (Rl.to - Rl.from) * q, off);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    ctx.strokeStyle = PLAYER_COLORS[u.owner] || '#9fe8ff'; ctx.globalAlpha = 0.8 * (1 - k); ctx.lineWidth = Math.max(2, z * 0.12);
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1, z * 0.04); ctx.stroke();
    const g = ctx.createRadialGradient(bx, by, 0, bx, by, z * 0.5); g.addColorStop(0, `rgba(255,255,255,${0.8 * (1 - k)})`); g.addColorStop(1, 'rgba(160,230,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx, by, z * 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // The Flagship's main battery: two heavy turrets, fore and aft, trained on what they fire at (forward when quiet), a flash
  // and smoke at the muzzles as they fire, the barrels kicking back.
  if (u.type === 'flagship') drawCapBattery(ctx, u, sx, y, z, F);
  // A broadside: flashes and smoke at the turrets on that side.
  const B = u.type === 'line' && capFxOf(u, 'broadside');
  if (B) {
    const k = B.t / B.life;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const [gx, gy] of FLEET_LOOK.guns.line) {
      const [mx, my] = capPt(u, sx, y, F, gx, gy * B.side * 2.2), out = f + B.side * Math.PI / 2, r = z * (0.35 + 0.5 * k);
      const px = mx + Math.cos(out) * z * 0.35 * (0.5 + k), py = my + Math.sin(out) * z * 0.35 * (0.5 + k);
      const g = ctx.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, `rgba(255,250,230,${0.95 * (1 - k)})`); g.addColorStop(0.4, `rgba(255,174,74,${0.7 * (1 - k)})`); g.addColorStop(1, 'rgba(255,110,40,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    ctx.save(); ctx.globalAlpha *= 0.35 * (1 - k); ctx.fillStyle = 'rgba(170,170,175,1)';
    for (const [gx, gy] of FLEET_LOOK.guns.line) { const [mx, my] = capPt(u, sx, y, F, gx, gy * B.side * 2.2), out = f + B.side * Math.PI / 2; ctx.beginPath(); ctx.arc(mx + Math.cos(out) * z * (0.5 + 0.8 * k), my + Math.sin(out) * z * (0.5 + 0.8 * k), z * (0.18 + 0.35 * k), 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
  drawCapShield(ctx, u, sx, y, z);
  if (R.clean) return;
  // Its two bars: the shield (pale blue) over the hull.
  const sel = typeof UI !== 'undefined' && ((UI.selSet && UI.selSet.has(u.id)) || UI.selBot === u.id || (UI.sel && UI.sel.includes(u.id)));
  const max = CAPITAL[u.type].sh, cs = u.cs ?? max, hurt = u.hp < u.maxHp || cs < max;
  if (R.clean < 2 && (sel || (hurt && R.hpBars !== false))) {
    const w = z * H[0] * 1.2, bh = Math.max(2, z * 0.07), bx = sx - w / 2, by = y - H[1] * z - z * 0.9;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(bx - 1, by - 1, w + 2, bh * 2 + 4);
    ctx.fillStyle = '#78c8ff'; ctx.fillRect(bx, by, w * clamp(cs / max, 0, 1), bh);
    const fr = u.hp / u.maxHp;
    ctx.fillStyle = fr > 0.6 ? '#7bea6b' : fr > 0.3 ? '#ffd166' : '#ff5a5a'; ctx.fillRect(bx, by + bh + 2, w * clamp(fr, 0, 1), bh);
  }
  if (sel) {
    ctx.strokeStyle = PLAYER_COLORS[u.owner] || '#fff'; ctx.lineWidth = Math.max(1.5, z * 0.05); ctx.setLineDash([z * 0.3, z * 0.18]);
    ctx.beginPath(); ctx.ellipse(sx, y, (H[0] + 0.6) * z, (H[1] + 0.6) * z, f, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  }
}

/** The Flagship's two battery turrets at (sx, sy) (its hull's middle on screen), its frame F px: housings, twin barrels, the flash as they fire. */
function drawCapBattery(ctx, u, sx, sy, z, F) {
  const B = FLEET_LOOK.battery, fire = capFxOf(u, 'battery'), k = fire ? fire.t / fire.life : 1, col = PLAYER_COLORS[u.owner] || '#fff';
  const aim = fire ? fire.a : u.face || 0, kick = fire ? Math.max(0, 1 - k * 3) * 0.18 : 0;
  for (const at of CAPITAL.flagship.battery.at) {
    const [tx, ty] = capPt(u, sx, sy, F, (at * CAPITAL.r.flagship) / FLEET_LOOK.frame.flagship, 0), r = B.r * z;
    ctx.save(); ctx.translate(tx, ty);
    // the barrels (under the housing's front), recoiling as they fire
    ctx.rotate(aim);
    ctx.fillStyle = '#2a2f35'; ctx.strokeStyle = '#121518'; ctx.lineWidth = Math.max(0.8, z * 0.025);
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.rect(r * 0.2 - kick * z, s * r * 0.32 - z * 0.05, B.len * z, z * 0.1); ctx.fill(); ctx.stroke(); }
    // the housing: a squat armoured dome, a team-coloured band
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    g.addColorStop(0, '#8d949c'); g.addColorStop(1, '#3b4148');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, z * 0.045); ctx.beginPath(); ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    if (!fire || k > 0.6) continue;
    // the muzzle flash and smoke, as the broadsides'
    const q = k / 0.6, mx = tx + Math.cos(aim) * (r * 0.2 + B.len * z) , my = ty + Math.sin(aim) * (r * 0.2 + B.len * z);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const rr = z * (0.4 + 0.6 * q), px = mx + Math.cos(aim) * z * 0.3 * (0.5 + q), py = my + Math.sin(aim) * z * 0.3 * (0.5 + q);
    const fg = ctx.createRadialGradient(px, py, 0, px, py, rr);
    fg.addColorStop(0, `rgba(255,250,230,${0.95 * (1 - q)})`); fg.addColorStop(0.4, `rgba(255,174,74,${0.75 * (1 - q)})`); fg.addColorStop(1, 'rgba(255,110,40,0)');
    ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(px, py, rr, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.save(); ctx.globalAlpha *= 0.35 * (1 - q); ctx.fillStyle = 'rgba(170,170,175,1)';
    ctx.beginPath(); ctx.arc(mx + Math.cos(aim) * z * (0.6 + 0.9 * q), my + Math.sin(aim) * z * (0.6 + 0.9 * q), z * (0.22 + 0.4 * q), 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

/** Capital ship u drawn plainly in code (no art yet): a faceted hull in gunmetal, its team strips, deck or turrets. */
function capCodeHull(ctx, u, sx, sy, z) {
  const H = FLEET_LOOK.hull[u.type], L = H[0] * z, W = H[1] * z, col = PLAYER_COLORS[u.owner] || '#fff';
  ctx.save(); ctx.translate(sx, sy); ctx.rotate(u.face || 0);
  ctx.fillStyle = '#3d444b'; ctx.strokeStyle = '#1a1d21'; ctx.lineWidth = Math.max(1, z * 0.04);
  ctx.beginPath(); ctx.moveTo(L, 0); ctx.lineTo(L * 0.78, -W); ctx.lineTo(-L * 0.92, -W); ctx.lineTo(-L, -W * 0.6); ctx.lineTo(-L, W * 0.6); ctx.lineTo(-L * 0.92, W); ctx.lineTo(L * 0.78, W); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, z * 0.05);
  ctx.beginPath(); ctx.moveTo(L * 0.7, -W * 0.85); ctx.lineTo(-L * 0.85, -W * 0.85); ctx.moveTo(L * 0.7, W * 0.85); ctx.lineTo(-L * 0.85, W * 0.85); ctx.stroke();
  if (u.type === 'flagship') { ctx.fillStyle = '#4a4238'; ctx.fillRect(-L * 0.45, -W * 0.5, L * 1.05, W); ctx.fillStyle = '#e0b040'; ctx.fillRect(-L * 0.45, -W * 0.5, z * 0.08, W); ctx.fillRect(L * 0.58, -W * 0.5, z * 0.08, W); }
  else { ctx.fillStyle = '#5a6168'; for (const x of [0.2, -0.15]) { ctx.beginPath(); ctx.arc(L * x, 0, W * 0.55, 0, Math.PI * 2); ctx.fill(); } ctx.fillStyle = '#23272b'; ctx.fillRect(L * 0.5, -z * 0.06, L * 0.6, z * 0.12); }
  ctx.restore();
}

/* -- the shield */

/** The shield's hexagon lattice, in the unit disc (made once): cells of six points, a shimmer seed each. */
let _capCells = null;
function capCells() {
  if (_capCells) return _capCells;
  const out = [], r = 0.16, h = r * Math.sqrt(3);
  for (let row = -8; row <= 8; row++) for (let col = -8; col <= 8; col++) {
    const cx = col * r * 1.5, cy = row * h + (col % 2 ? h / 2 : 0);
    if (cx * cx + cy * cy > 0.92) continue;
    const pts = [];
    for (let k = 0; k < 6; k++) pts.push([cx + Math.cos((k * Math.PI) / 3) * r * 0.96, cy + Math.sin((k * Math.PI) / 3) * r * 0.96]);
    out.push({ u: cx, v: cy, pts, n: hash2(col + 50, row + 50, 77) });
  }
  return (_capCells = out);
}

/**
 * Capital ship u's shield round its hull at (sx, sy): idle, barely there; hits flash a panel and spread a ring where they
 * land; failing (under a quarter), it flickers; down, nothing but a few sparks; recharging, it draws back round from the
 * stern; up again, a flash all over.
 */
function drawCapShield(ctx, u, sx, sy, z) {
  const max = CAPITAL[u.type].sh, cs = u.cs ?? max, H = FLEET_LOOK.hull[u.type], a = (H[0] + 0.75) * z, b = (H[1] + 0.75) * z, f = u.face || 0, t = R.time || 0;
  const hits = S.fx.filter((q) => q.u === u.id && q.t >= 0 && q.t < q.life && (q.type === 'caphit' || q.type === 'capfall' || q.type === 'capup'));
  const fall = hits.find((q) => q.type === 'capfall'), up = hits.find((q) => q.type === 'capup');
  const frac = clamp(cs / max, 0, 1), col = FLEET_LOOK.shield;
  ctx.save(); ctx.translate(sx, sy); ctx.rotate(f);
  if (cs <= 0 && !fall) {
    // Down: a few motes where it was.
    ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 5; k++) { const q = (t * 0.3 + k * 0.37 + u.id * 0.1) % 1, an = k * 1.7 + u.id; ctx.fillStyle = `rgba(${col},${0.35 * (1 - q)})`; ctx.fillRect(Math.cos(an) * a * (0.9 + q * 0.3), Math.sin(an) * b * (0.9 + q * 0.3), 2, 2); }
    ctx.restore(); return;
  }
  // How much of it is there: recharging, it closes round from the stern (the arc's half-angle grows with its strength).
  const recharging = cs < max && S.time - (u.csT ?? -99) >= CAPITAL.wait, arc = recharging ? Math.PI * clamp(frac * 1.15, 0.05, 1) : Math.PI;
  let alpha = 0.55 + 0.45 * frac;
  if (frac < 0.25 && !recharging) alpha *= 0.5 + 0.5 * (Math.sin(t * 17 + u.id) > -0.2 ? 1 : 0.2); // (failing: it flickers)
  if (fall) alpha *= Math.max(0, 1 - fall.t / fall.life) * (Math.sin(t * 40) > 0 ? 1 : 0.4);
  if (up) alpha = Math.min(1, alpha + 0.6 * (1 - up.t / up.life));
  const path = () => { ctx.beginPath(); if (arc >= Math.PI - 1e-3) ctx.ellipse(0, 0, a, b, 0, 0, Math.PI * 2); else { ctx.ellipse(0, 0, a, b, 0, Math.PI - arc, Math.PI + arc); } };
  // The faint fill, brighter at the rim.
  path();
  if (arc >= Math.PI - 1e-3) {
    const g = ctx.createRadialGradient(0, 0, Math.min(a, b) * 0.2, 0, 0, a);
    g.addColorStop(0, `rgba(${col},${0.02 * alpha})`); g.addColorStop(0.75, `rgba(${col},${0.06 * alpha})`); g.addColorStop(1, `rgba(${col},${0.2 * alpha})`);
    ctx.fillStyle = g; ctx.fill();
  }
  ctx.strokeStyle = `rgba(${FLEET_LOOK.rim},${0.6 * alpha})`; ctx.lineWidth = Math.max(1, z * 0.06); ctx.stroke();
  ctx.globalCompositeOperation = 'lighter';
  // The lattice: hexagon panels, a shimmer drifting along it (inside the arc that is there).
  if (z >= 5) {
    const cells = capCells(), buckets = [[], [], [], []];
    for (const c of cells) {
      if (Math.abs(Math.atan2(c.v * b, c.u * a) + (c.u < 0 ? 0 : 0)) < Math.PI - arc && arc < Math.PI) continue; // (not yet closed round there)
      if (fall && c.n < fall.t / fall.life) continue; // (breaking up as it fails)
      const sh = Math.pow(Math.max(0, Math.cos(c.u * 2.2 + c.v * 0.8 - t * 1.6)), 6);
      buckets[Math.min(3, Math.floor(sh * 3 + c.n * 0.8))].push(c);
    }
    for (let k = 0; k < 4; k++) {
      if (!buckets[k].length) continue;
      ctx.strokeStyle = `rgba(${col},${(0.05 + 0.07 * k) * alpha})`; ctx.lineWidth = Math.max(0.6, z * 0.03);
      ctx.beginPath();
      for (const c of buckets[k]) { ctx.moveTo(c.pts[0][0] * a, c.pts[0][1] * b); for (let q = 1; q < 6; q++) ctx.lineTo(c.pts[q][0] * a, c.pts[q][1] * b); ctx.closePath(); }
      ctx.stroke();
    }
  }
  // Where shots land: a panel flashes, a ring spreads (a Disruptor's drain: a blue crackle all round).
  for (const h of hits) {
    if (h.type !== 'caphit') continue;
    const k = h.t / h.life, la = h.a - f, px = Math.cos(la) * a, py = Math.sin(la) * b;
    if (h.drain) { ctx.strokeStyle = `rgba(143,216,255,${0.7 * (1 - k)})`; ctx.lineWidth = Math.max(1, z * 0.08); ctx.beginPath(); ctx.ellipse(0, 0, a * (1 + 0.05 * k), b * (1 + 0.05 * k), 0, 0, Math.PI * 2); ctx.stroke(); continue; }
    const g = ctx.createRadialGradient(px, py, 0, px, py, z * 0.7);
    g.addColorStop(0, `rgba(235,248,255,${0.85 * (1 - k)})`); g.addColorStop(0.4, `rgba(${col},${0.5 * (1 - k)})`); g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, z * 0.7, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `rgba(${FLEET_LOOK.rim},${0.7 * (1 - k)})`; ctx.lineWidth = Math.max(1, z * 0.04);
    ctx.beginPath(); ctx.arc(px, py, z * (0.2 + 0.9 * k), 0, Math.PI * 2); ctx.stroke();
  }
  // Failing: shards flying off the rim.
  if (fall) {
    const k = fall.t / fall.life;
    for (let q = 0; q < 14; q++) { const an = q * 0.45 + u.id, r = 1 + k * (0.4 + (q % 3) * 0.2); ctx.fillStyle = `rgba(${FLEET_LOOK.rim},${0.8 * (1 - k)})`; ctx.fillRect(Math.cos(an) * a * r - 1.5, Math.sin(an) * b * r - 1.5, 3, 3); }
  }
  // Recharging: the leading edges glow.
  if (recharging && arc < Math.PI - 1e-3) for (const s of [-1, 1]) {
    const an = Math.PI + s * arc, px = Math.cos(an) * a, py = Math.sin(an) * b, g = ctx.createRadialGradient(px, py, 0, px, py, z * 0.45);
    g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, `rgba(${col},0)`); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, z * 0.45, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

/* -- the shells and the breaking up */

/** A Line Ship's shell, or the Flagship's battery's (fx 'capshell', `big`): a bright slug with a short trail flying to its mark, then a flash where it lands. */
function drawCapShell(ctx, f, ox, oy, z) {
  const k = f.t / f.life, fly = 0.8, x0 = ox + f.x * z, y0 = oy + f.y * z - z * 0.35, x1 = ox + f.x2 * z, y1 = oy + f.y2 * z - z * 0.2, L = FLEET_LOOK.shell;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  if (k < fly) {
    const q = k / fly, hx = x0 + (x1 - x0) * q, hy = y0 + (y1 - y0) * q - Math.sin(q * Math.PI) * z * 0.3, len = Math.hypot(x1 - x0, y1 - y0) || 1, tl = Math.min(len * q, z * 0.9);
    const tx = hx - ((x1 - x0) / len) * tl, ty = hy - ((y1 - y0) / len) * tl;
    const big = f.big ? 1.5 : 1; // (the Flagship's battery: a heavier shell)
    ctx.strokeStyle = L.glow; ctx.globalAlpha = 0.5; ctx.lineWidth = Math.max(2, z * 0.14 * big); ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.strokeStyle = L.core; ctx.globalAlpha = 1; ctx.lineWidth = Math.max(1, z * 0.05 * big); ctx.stroke();
  } else {
    const q = (k - fly) / (1 - fly), r = z * (0.3 + 0.6 * q) * (f.big ? 1.4 : 1), g = ctx.createRadialGradient(x1, y1, 0, x1, y1, r);
    g.addColorStop(0, `rgba(255,246,224,${1 - q})`); g.addColorStop(0.4, `rgba(255,174,74,${0.8 * (1 - q)})`); g.addColorStop(1, 'rgba(255,110,40,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x1, y1, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

/** A capital ship breaking up (fx 'capdie'): its hull drifting apart in two, dark and burning, fading out. */
function drawCapDie(ctx, f, ox, oy, z) {
  const k = f.t / f.life, x = ox + f.x * z, y = oy + f.y * z - z * 0.35, F = z * FLEET_LOOK.frame[f.type], art = artFor(f.type, f.owner);
  ctx.save(); ctx.globalAlpha *= Math.max(0, 1 - k * k);
  for (const s of [-1, 1]) {
    ctx.save();
    const c = Math.cos(f.face), sn = Math.sin(f.face), n = z * 0.4 * k * s;
    ctx.translate(x + c * n, y + sn * n); ctx.rotate(f.face + s * 0.12 * k);
    ctx.beginPath(); ctx.rect(s > 0 ? 0 : -F, -F, F, F * 2); ctx.clip();
    ctx.filter = 'brightness(0.55)';
    if (art) drawArtRaw(ctx, art, 0, 0, F, 0); else { ctx.fillStyle = '#2a2d31'; ctx.fillRect(-F * 0.4, -F * 0.08, F * 0.8, F * 0.16); }
    ctx.filter = 'none';
    ctx.restore();
  }
  ctx.globalCompositeOperation = 'lighter';
  for (let q = 0; q < 6; q++) {
    const an = q * 1.3 + f.x, r = F * 0.3 * ((q * 0.37) % 1), px = x + Math.cos(an) * r, py = y + Math.sin(an) * r * 0.4, rr = z * (0.3 + 0.4 * Math.abs(Math.sin(R.time * 9 + q)));
    const g = ctx.createRadialGradient(px, py, 0, px, py, rr); g.addColorStop(0, 'rgba(255,220,160,0.8)'); g.addColorStop(1, 'rgba(255,90,30,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, rr, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

/** From spaceDrawAir (js/space.js), before the small craft: the capital ships in view, and their dying hulks. */
function fleetDrawAir(ctx, ox, oy, z, inView) {
  for (const f of S.fx) if (f.type === 'capdie' && f.t >= 0 && inView(f.x, f.y, 6)) drawCapDie(ctx, f, ox, oy, z);
  for (const u of S.bots) if (!u.dead && BOTS[u.type].capital && inView(u.x, u.y, 6)) drawCapital(ctx, u, ox + u.x * z, oy + u.y * z, z);
}
/** From spaceDrawAir's effects: a Line Ship's shells. True if it drew `f`. */
function fleetDrawFx(ctx, f, ox, oy, z) {
  if (f.type === 'capshell') { drawCapShell(ctx, f, ox, oy, z); return true; }
  return false;
}

/* -- the home stations (paintTile, drawVoidTile) */

/** Is tile (i, j) on a home station's deck (its box: voidMap), not a rock? */
function vfStationAt(i, j) { return !!(S.vf && S.vf.st.some((r) => i >= r.x0 && i <= r.x1 && j >= r.y0 && j <= r.y1)); }

/* -- picking one on the map, and the minimap */

/** The capital ship whose hull is under (wx, wy) (an ellipse round it), with how near its middle: [d2, u] or null. */
function capAtTap(u, wx, wy) {
  const H = FLEET_LOOK.hull[u.type], dx = wx - u.x, dy = wy + 0.35 - u.y, c = Math.cos(u.face || 0), s = Math.sin(u.face || 0);
  const lx = dx * c + dy * s, ly = -dx * s + dy * c, e = sq(lx / (H[0] + 0.2)) + sq(ly / (H[1] + 0.3));
  return e <= 1 ? e * 0.5 : -1;
}
/** On the minimap: each capital ship a bar along its heading in its colour, the Flagship's ringed. */
function fleetMinimap(ctx, sx, sy) {
  for (const u of S.bots) {
    if (u.dead || !BOTS[u.type].capital) continue;
    const x = u.x * sx, y = u.y * sy, L = FLEET_LOOK.hull[u.type][0], c = Math.cos(u.face || 0), s = Math.sin(u.face || 0);
    ctx.strokeStyle = '#0b1420'; ctx.lineWidth = Math.max(3, sx * 1.4); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - c * L * sx, y - s * L * sy); ctx.lineTo(x + c * L * sx, y + s * L * sy); ctx.stroke();
    ctx.strokeStyle = PLAYER_COLORS[u.owner] || '#fff'; ctx.lineWidth = Math.max(2, sx * 0.9); ctx.stroke();
    if (u.type === 'flagship') { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, Math.max(4, sx * 3.6), 0, Math.PI * 2); ctx.stroke(); }
  }
}

/* -- panels */

/** What capital ship u is doing, in words (lower case first). */
function capStatus(u) {
  const T = u.task, max = CAPITAL[u.type].sh, sh = u.cs <= 0 ? 'its shield down' : u.cs < max ? (S.time - (u.csT ?? -99) >= CAPITAL.wait ? 'its shield recharging' : 'its shield taking hits') : '';
  let s;
  if (u.type === 'flagship') s = T && T.type === 'move' ? 'under way' : 'holding station';
  else if (u.rearm) s = flagshipOf(u.owner) ? 'out of shells: rearming beside the Flagship' : 'out of shells: rearming over a Launch Pad';
  else if (T && (T.type === 'attack' || T.type === 'hunt')) { const g = lineGoal(u); s = g ? `closing to fire on ${g.ent === 'b' ? 'the enemy ' + BDEFS[g.type].name : 'an enemy ' + BOTS[g.type].name}` : 'looking for a target'; }
  else if (T && T.type === 'hold') s = 'holding its spot, firing at anything in reach';
  else s = flagshipOf(u.owner) ? 'escorting the Flagship' : 'holding where it is';
  return sh ? `${s}; ${sh}` : s;
}

/** The rows on a capital ship's panel: its shield and hull, its guns, its magazine or its deck. */
function capRows(u) {
  const C = CAPITAL[u.type], max = C.sh, cs = Math.round(u.cs ?? max), wait = Math.max(0, CAPITAL.wait - (S.time - (u.csT ?? -99)));
  const bar = (k, n, m, c) => `<div class="kv"><span>${k}</span><span>${n} of ${m}</span></div><div class="bar battery"><div style="width:${Math.round(clamp(n / m, 0, 1) * 100)}%;background:${c}"></div></div>`;
  let h = bar('Shield', cs, max, '#78c8ff') + bar('Hull', Math.round(u.hp), u.maxHp, u.hp / u.maxHp > 0.6 ? '#7bea6b' : u.hp / u.maxHp > 0.3 ? '#ffd166' : '#ff5a5a');
  h += `<p class="hint">${cs <= 0 ? 'Shield down: the hull takes every hit.' : cs < max ? (wait > 0 ? `Shield recharging in ${Math.ceil(wait)} s, if nothing hits it.` : 'Shield recharging.') : 'Shield up.'} It takes every hit first and recharges ${C.regen} a second once nothing has hit it for ${CAPITAL.wait} s. A Disruptor Tower's pulse drains it ${CAPITAL.disrupt} times as fast.</p>`;
  if (u.type === 'line') {
    h += `<div class="kv"><span>Broadsides</span><span>${C.salvo} shells every ${C.reload} s out to ${C.range} tiles of its hull (${C.bldRange} at a building: a siege outranges Point-Defence and Disruptors): ${C.cap} off a capital ship, ${C.bld} off a building, ${C.bot} off a robot, ${C.craft} off a small craft</span></div>`;
    h += `<div class="kv"><span>Magazine</span><span>${Math.floor(u.mag ?? C.mag)} of ${C.mag} shells${u.rearm ? ' (rearming)' : ''}</span></div>`;
  } else {
    h += `<div class="kv"><span>Main battery</span><span>two heavy turrets: a shell each every ${C.battery.reload} s at enemy capital ships within ${C.battery.range} tiles of its hull, ${C.battery.cap} a shell</span></div>`;
    h += `<div class="kv"><span>Point-defence</span><span>bursts at enemy craft within ${C.pd.range} tiles of its hull, Gunships first</span></div>`;
    h += `<div class="kv"><span>Aura</span><span>mends, refuels and rearms your craft within ${C.aura} tiles of its hull</span></div>`;
    h += `<div class="kv"><span>Wing</span><span>${wingCraft(u).length} of ${C.wing} Gunships</span></div>`;
  }
  return h;
}

/** A capital ship's buttons (yours): the Flagship's deck and its move; a Line Ship's attack and escort. */
function capButtons(u) {
  if (u.type === 'flagship') {
    const L = BOTS.line, rd = (k) => { const r = BOTS[k].round || { alloy: 1, chip: 1 }, c = {}; for (const g in r) c[g] = r[g] * (BOTS[k].parts || 1); return costText(c); };
    const rows = CAPITAL.flagship.yard.filter((k) => warOn() || !BOTS[k].war).map((k) => `<div class="order-row yard-row" data-k="${k}"><span>${BOTS[k].plural}<small id="fy-${k}"></small></span><button class="btn" data-fy="${k}" data-d="1">+1</button><button class="btn ghost" data-fy="${k}" data-d="-99">Clear</button></div>`).join('');
    return `<div class="section-label">Deck <span class="label-note">parts come up from your stores</span></div><div id="fy-rows">${rows}</div><div class="kv"><span id="fy-status"></span></div><div class="bar" id="fy-bar" hidden><div></div></div>
      <p class="hint">A Gunship costs ${rd('gunship')} and flies as the Flagship's wing (${CAPITAL.flagship.wing} at most), guarding it; a Line Ship costs ${rd('line')} (${CAPITAL.line.most} to a colony). ${L ? '' : ''}</p>
      <div class="actions"><button class="btn primary" id="cap-move">Move: tap where</button><button class="btn" id="cap-stop">Hold here</button></div>
      <p class="hint">With a mouse, select it and right-click where it goes. It is slow: its main battery fires back at enemy capital ships close by, but alone it can't outfight an escorted fleet, so keep your own Line Ships and Gunships round it. Lose it and you lose the game.</p>`;
  }
  return `<div class="actions"><button class="btn primary" id="cap-atk">Attack: tap a target</button><button class="btn" id="cap-home">${flagshipOf(u.owner) ? 'Escort the Flagship' : 'Stop'}</button></div>
    <p class="hint">Tap an enemy building, robot or ship to attack it, or open space to hold there. With a mouse, select it and right-click, as for warbots. Out of shells, it rearms beside your Flagship or over a Launch Pad.</p>`;
}
/** Refresh the Flagship's deck rows on its open panel (from the sheet's refresh). */
function renderFlagYard(u) {
  if (!$('fy-rows')) return;
  for (const k of CAPITAL.flagship.yard) {
    const el = $('fy-' + k); if (!el) continue;
    const n = (u.yard && u.yard[k]) || 0, parts = (u.yardParts && u.yardParts[k]) || 0;
    el.textContent = ` · ${k === 'gunship' ? `${wingCraft(u).length} in its wing` : `${lineCount(u.owner)} flying`}${n ? ` · ${n} ordered${parts ? `, ${parts} of ${BOTS[k].parts} parts in` : ''}` : ''}`;
  }
  $('fy-status').textContent = u.yardStatus || (u.yard ? '' : 'Nothing ordered');
  $('fy-bar').hidden = !flagYardKind(u);
  $('fy-bar').firstElementChild.style.width = `${Math.round((u.yardFrac || 0) * 100)}%`;
}
/** Wire a capital ship's buttons. */
function bindCapButtons(u) {
  for (const b of document.querySelectorAll('[data-fy]')) b.onclick = () => { sfx('click'); act('fyard', [u.id, b.dataset.fy, +b.dataset.d], () => renderFlagYard(u)); };
  if ($('cap-move')) $('cap-move').onclick = () => { sfx('click'); startSpaceMode('capmove', u.id); };
  if ($('cap-stop')) $('cap-stop').onclick = () => act('capital', [[u.id], 'home', 0, 0, 0], () => { sfx('order'); toast('The Flagship holds here.', 'info'); });
  if ($('cap-atk')) $('cap-atk').onclick = () => { sfx('click'); startSpaceMode('capatk', u.id); };
  if ($('cap-home')) $('cap-home').onclick = () => act('capital', [[u.id], 'home', 0, 0, 0], () => { sfx('order'); toast(flagshipOf(ME) ? 'The Line Ship goes back to escort the Flagship.' : 'The Line Ship holds where it is.', 'info'); });
  renderFlagYard(u);
}

/** The space mode's banner for a capital ship's pick (from showSpaceBanner). True if it was one. */
function capBanner(A, err) {
  if (A.kind === 'capmove') { showBanner(err + 'Tap where the <b>Flagship</b> goes: anywhere, over the void or a deck.', null, 'Cancel'); return true; }
  if (A.kind === 'capatk') { showBanner(err + 'Tap an <b>enemy</b> for the Line Ship to attack, or <b>open space</b> to hold there.', null, 'Cancel'); return true; }
  return false;
}
/** A tap in the space mode for a capital ship's pick (from spaceTap). True if it was one. */
function capSpaceTap(A, u, i, j, wx, wy) {
  if (A.kind === 'capmove') {
    if (!inMap(i, j)) { sfx('error'); showSpaceBanner('Outside the map.'); return true; }
    act('capital', [[u.id], 'move', 0, i, j], (n) => { if (!n) { sfx('error'); return; } sfx('order'); setMode('normal'); addFx('ring', i + 0.5, j + 0.5, { color: '#7dffa0' }); toast('The Flagship is under way.', 'info'); });
    return true;
  }
  if (A.kind !== 'capatk') return false;
  const b = buildingAtTap(i, j, wx, wy), foe = !b || !foes(b.owner, ME) ? spaceFoeAt(wx, wy) : null;
  const args = b && b.owner >= 0 && foes(b.owner, ME) ? ['attack', b.id, 0, 0] : foe ? ['hunt', foe.id, 0, 0] : inMap(i, j) ? ['hold', 0, i, j] : null;
  if (!args) { sfx('error'); showSpaceBanner('Outside the map.'); return true; }
  act('capital', [[u.id], ...args], (n) => {
    if (!n) { sfx('error'); showSpaceBanner('It can\'t take that order.'); return; }
    sfx('order'); setMode('normal'); addFx('ring', b ? b.x + 0.5 : foe ? foe.x : i + 0.5, b ? b.y + 0.5 : foe ? foe.y : j + 0.5, { color: args[0] === 'hold' ? '#7dffa0' : '#ff5a6e' });
    toast(args[0] === 'attack' ? `The Line Ship closes on the ${BDEFS[b.type].name}.` : args[0] === 'hunt' ? `The Line Ship goes after the ${BOTS[foe.type].name}.` : 'The Line Ship holds that spot.', 'info');
  });
  return true;
}

/** The Army panel's Space tab: your capital ships (from refreshSpaceTab), with their buttons. */
function capArmyRows() {
  const cs = S.bots.filter((u) => !u.dead && u.owner === ME && BOTS[u.type].capital);
  if (!cs.length && !S.vf) return '';
  const row = (u, btns) => `<div class="kv army-row"><span><b>${BOTS[u.type].name}</b>: ${capStatus(u)} <span class="label-note">shield ${Math.round(((u.cs ?? 0) / CAPITAL[u.type].sh) * 100)}%, hull ${Math.round((u.hp / u.maxHp) * 100)}%</span></span><span>${btns}<button class="btn small ghost" data-act="showbot" data-id="${u.id}">Show</button></span></div>`;
  let h = '<div class="section-label">Capital ships <span class="label-note">shields over their hulls</span></div>';
  h += cs.length ? cs.map((u) => row(u, u.type === 'line' ? `<button class="btn small" data-act="capatk" data-id="${u.id}">Attack</button><button class="btn small" data-act="caphome" data-id="${u.id}">Escort</button>` : `<button class="btn small" data-act="capmove" data-id="${u.id}">Move</button>`)).join('') + `<div class="army-cmds"><button class="btn ghost" data-act="capselline">Select all Line Ships</button></div>`
    : '<p class="hint">None yet: order a Line Ship at a Launch Pad (+ Line Ship) or on your Flagship\'s panel.</p>';
  return h;
}
/** A capital ship's button on the Army panel (from spaceArmyButton). True if it was one. */
function capArmyButton(btn, what, e) {
  switch (what) {
    case 'capatk': if (e) startSpaceMode('capatk', e.id); return true;
    case 'capmove': if (e) startSpaceMode('capmove', e.id); return true;
    case 'caphome': if (e) act('capital', [[e.id], 'home', 0, 0, 0], () => { UI.armySig = ''; }); return true;
    case 'capselline': { const ids = S.bots.filter((u) => !u.dead && u.owner === ME && u.type === 'line').map((u) => u.id); closeSheet(); selectBots(ids, false); if (UI.sel.length) toast(`${UI.sel.length} Line Ship${UI.sel.length > 1 ? 's' : ''} selected: ${onTouch() ? 'tap' : 'right-click'} an enemy to attack, open space to hold there.`, 'info'); return true; }
  }
  return false;
}

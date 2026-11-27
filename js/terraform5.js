'use strict';
/*
 * Terrafall — Terraforming, stage 5: the big projects and greening. The interface and the drawing; the rules are in
 * js/sim.js (the stage 5 block: rsvBasin, updateReservoir, rsvStage, lvlHill, updateLeveller, lvlCommit, greenTick) and
 * the numbers in RSV, LVL and GREEN (js/defs.js).
 *
 *  - Build → Mega (key 5): the Reservoir (V) and the Leveller (G). Placing a Reservoir outlines the basin it would fill
 *    (teal) or what stands in its way (red), and the Generators' reach (t5Ranges, t5PlaceText). A Leveller shows its reach.
 *  - Their panels (t5Panel, t5Buttons): the Reservoir's stage lamps (dry, puddling, half, full) and power; the Leveller's
 *    Level a hill (F: the aim mode, ORDERS.levelAim; tap a hill in reach) and Stop (C), its hopper and what's left.
 *  - On the map (t5Marks): a filling basin's outline, the hill a Leveller is cutting and the dust at its cut.
 *  - The buildings (t5DrawBuilding, t5DrawSite): renderer/b/reservoir.js and leveller.js (ART_GUIDE Batch 42), the base
 *    art at every time of day, the moving parts over it in 4 frames (still when it stops), the two build stages.
 *  - The greening meter, "Land made ready": a ring in the top bar's land chip (t5Chip; tap it), the Greening panel
 *    (Shift+G: openGreening), the minimap's Green layer (its GREEN tag at the minimap's foot: t5MiniGreen), and in a
 *    Colony game with the Made ready goal its progress card (t5WinCard) and the green VICTORY.
 * The look is the owner's picks from the stage 5 canvas: the Reservoir (Dew Towers, basin teal #0ad5d8), the Leveller
 * (Bucket Wheel, cut-stone tan #d8b18c), the meter (ring A in the land chip; greening leaf green #7be05a, never on a
 * building). Looks only: nothing here changes the simulation.
 */

const T5_COL = { rsv: '#0ad5d8', lvl: '#d8b18c', green: '#7be05a' };

/* ------------------------------------------------------------------ placing, panels and the aim */

/** What placing a Reservoir or a Leveller at (i, j) would do (the placing banner's extra line). */
function t5PlaceText(type, i, j) {
  if (BDEFS[type].rsv) {
    const B = rsvBasin(ME, i, j);
    if (B.why) return '';
    return `Fills a basin of <b>${B.ts.length}</b> tiles (outlined) over ${Math.round(RSV.fill[2] / 60)} minutes of power: ${RSV.gens} Generators with Fuel within ${RSV.reach} tiles.`;
  }
  if (BDEFS[type].lvl) return `Cuts a hill or mesa within <b>${LVL.reach}</b> tiles of it (aim it from its panel). Power: a Generator with Fuel within ${LVL.powReach} tiles.`;
  return '';
}

/** A Reservoir's or a Leveller's rows on its panel. */
function t5Panel(b, mine) {
  const out = [];
  if (BDEFS[b.type].rsv) {
    const R = b.rv, st = R ? R.st : 0;
    const lamps = [1, 2, 3].map((k) => `<span class="t5-lamp${k <= st ? ' on' : ''}" title="${RSV_STAGE_NAMES[k]}"></span>`).join('');
    if (!b.built) return out;
    if (!R) { out.push(`<div class="kv"><span>Basin</span><span><b class="err">${esc(b.rvNo || 'None')}</b></span></div>`); return out; }
    const wet = R.ts.filter((t) => S.terrain[t] === T_WATER).length, T = b.rsvT || 0, nx = st < 3 ? RSV.fill[st] : 0, p0 = st ? RSV.fill[st - 1] : 0;
    out.push(`<div class="kv"><span>Basin</span><span>${lamps} ${RSV_STAGE_NAMES[st][0].toUpperCase() + RSV_STAGE_NAMES[st].slice(1)}: ${wet} of ${R.ts.length} tiles under water${st < 3 ? `; ${RSV_STAGE_NAMES[st + 1]} after ${fmtSecs(nx - T)} more of power` : ''}</span></div><div class="bar"><div style="width:${Math.round((st >= 3 ? 1 : Math.max(0, Math.min(1, (T - p0) / (nx - p0)))) * 100)}%;background:${T5_COL.rsv}"></div></div>`);
    let bank = 0, rich = 0;
    if (S.rsvBank) for (let t = 0; t < S.rsvBank.length; t++) if (S.rsvBank[t] === b.owner + 1) { bank++; if (S.soil && S.soil[t] >= SOIL.rich) rich++; }
    if (st) out.push(`<div class="kv"><span>Its banks</span><span>${bank} tiles of wet ground, ${rich} of them rich farmland${navalOk() ? '. A Port goes on its shore' : ''}</span></div>`);
    if (mine && st < 3) out.push(`<div class="kv"><span>Power</span><span>${b.working ? `${RSV.gens} Generators in reach: a Fuel a minute from each` : `<b>None</b>: ${RSV.gens} Generators with Fuel within ${RSV.reach} tiles. Its water is kept`}</span></div>`);
    out.push(`<p class="hint">Dew Towers draw water out of the air into the cistern, and the spillway runs it down into the basin, the deepest ground first. Your robots go round the lake; its banks are wet and grow richer, toward farmland, and count as land made ready.</p>`);
  } else if (BDEFS[b.type].lvl) {
    if (!b.built) return out;
    const base = S.elev[tIdx(b.x, b.y)], left = (b.lvTs || []).reduce((n, t) => n + Math.max(0, S.elev[t] - base), 0);
    out.push(`<div class="kv"><span>Hill</span><span>${b.lvAim !== undefined ? `${left} level${left === 1 ? '' : 's'} to cut, about ${fmtClock(left * LVL.every)} of power` : b.lvDone ? 'Levelled. Aim it at another' : 'None: aim it at a hill or mesa within reach'}</span></div>`);
    if (mine) out.push(`<div class="kv"><span>STONE hopper</span><span>${goodTag('stone', `${b.stock.stone || 0}/${LVL.cap}`, (b.stock.stone || 0) >= LVL.cap)} (${LVL.stone} a level; Haulers carry it off)</span></div>`);
    if (mine) out.push(`<div class="kv"><span>Power</span><span>${b.working ? 'A Generator in reach: a Fuel a minute' : `${b.lvAim !== undefined ? '<b>None</b>: a' : 'A'} Generator with Fuel within ${LVL.powReach} tiles`}</span></div>`);
    out.push(`<p class="hint">It cuts the highest ground first, a level off a tile every ${LVL.every} s, down to its own level, and never leaves a step a Ramp couldn't climb. Buildings, roads, track, resources and earthworks are left standing. The cut ground counts as land made ready.</p>`);
  }
  return out;
}

/** The Leveller's buttons (yours, built): Level a hill and Stop. */
function t5Buttons(b) {
  if (!BDEFS[b.type].lvl) return '';
  return `<button class="btn primary big" id="sh-level">Level a hill</button><p class="hint">Then tap a hill or mesa within ${LVL.reach} tiles of it: it cuts it down to its own level.</p>` +
    `<button class="btn" id="sh-lvstop"${b.lvAim === undefined ? ' hidden' : ''}>Stop cutting</button>`;
}
function t5Bind(b) {
  if ($('sh-level')) $('sh-level').onclick = () => { sfx('click'); startAim(b); };
  if ($('sh-lvstop')) $('sh-lvstop').onclick = () => { sfx('click'); act('levelStop', [b.id], () => { toast('The Leveller stops: what it has cut stays cut.', 'info'); refreshSheet(); }); };
}

/** The aim banner for a Leveller (showAimBanner). */
function t5AimBanner(b, html) {
  const H = R.aim ? lvlHill(b, tIdx(R.aim.i, R.aim.j)) : null, base = S.elev[tIdx(b.x, b.y)];
  const lv = H && H.ts ? H.ts.reduce((n, t) => n + Math.max(0, S.elev[t] - base), 0) : 0;
  html += R.aim && H && H.ts
    ? `<b>Level this hill?</b> ${H.ts.length} tiles, ${lv} level${lv === 1 ? '' : 's'} of ground: about ${fmtClock(lv * LVL.every)} of power and ${lv * LVL.stone} Stone into its hopper.`
    : `Tap a hill or mesa within ${LVL.reach} tiles of the Leveller (the tan outline): ground higher than its own.`;
  showBanner(html, R.aim ? 'Level it' : null, 'Cancel');
}
function t5AimFire(b, i, j) {
  act('levelAim', [b.id, tIdx(i, j)], (why) => {
    if (!why) { setMode('normal'); sfx('order'); toast('The Leveller swings its wheel onto the hill.', 'info'); return; }
    sfx('error'); showAimBanner(why);
  });
}

/* ------------------------------------------------------------------ drawing: the ranges, the basin and the cut */

/** Outline the tiles `ts` (a Set) on the map in colour `col`, filled at alpha `fa`. */
function t5Outline(ctx, ts, ox, oy, z, col, fa, dash) {
  ctx.save();
  if (fa) { ctx.fillStyle = col; ctx.globalAlpha = fa; for (const t of ts) ctx.fillRect(ox + (t % S.W) * z, oy + ((t / S.W) | 0) * z, z + 0.5, z + 0.5); ctx.globalAlpha = 1; }
  ctx.strokeStyle = col; ctx.lineWidth = Math.max(1.5, z * 0.06);
  if (dash) ctx.setLineDash([z * 0.25, z * 0.15]);
  ctx.beginPath();
  for (const t of ts) {
    const i = t % S.W, j = (t / S.W) | 0, x = ox + i * z, y = oy + j * z;
    if (!ts.has(t - S.W) || j === 0) { ctx.moveTo(x, y); ctx.lineTo(x + z, y); }
    if (!ts.has(t + S.W) || j === S.H - 1) { ctx.moveTo(x, y + z); ctx.lineTo(x + z, y + z); }
    if (i === 0 || !ts.has(t - 1)) { ctx.moveTo(x, y); ctx.lineTo(x, y + z); }
    if (i === S.W - 1 || !ts.has(t + 1)) { ctx.moveTo(x + z, y); ctx.lineTo(x + z, y + z); }
  }
  ctx.stroke();
  ctx.restore();
}

/** Placing (or a selected) Reservoir or Leveller: the basin it fills, or its reach, and its Generators' reach (drawRanges). */
let _t5Basin = { k: '', B: null };
function t5Ranges(ctx, type, x, y, ox, oy, z, owner) {
  const c = bCentre({ type, x, y }), cx = ox + c.x * z, cy = oy + c.y * z;
  if (BDEFS[type].rsv) {
    const live = getE(S.bAt[tIdx(x, y)]), k = `${x},${y},${S.roadVer},${S.planVer},${S.buildings.length}`;
    if (live && live.rv) { const wet = new Set(live.rv.ts.filter((t) => S.terrain[t] !== T_WATER)); if (wet.size) t5Outline(ctx, wet, ox, oy, z, T5_COL.rsv, 0.18, true); }
    else {
      if (_t5Basin.k !== k) _t5Basin = { k, B: rsvBasin(owner, x, y) };
      const B = _t5Basin.B;
      if (B.ts) t5Outline(ctx, new Set(B.ts), ox, oy, z, T5_COL.rsv, 0.3, false);
      else if (B.at !== undefined) t5Outline(ctx, new Set([B.at]), ox, oy, z, '#ff5a5a', 0.35, false);
    }
    ctx.strokeStyle = 'rgba(255,205,110,0.7)'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.arc(cx, cy, (RSV.reach + 1.5) * z, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    return;
  }
  // The Leveller: its reach (LVL.reach tiles round its square), and its Generator's
  const r = (LVL.reach + 1.5) * z;
  ctx.strokeStyle = T5_COL.lvl; ctx.lineWidth = Math.max(1.5, z * 0.06); ctx.setLineDash([z * 0.3, z * 0.18]);
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,205,110,0.7)'; ctx.setLineDash([6, 4]); ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(cx, cy, (LVL.powReach + 1.5) * z, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  if (R.mode === 'aim' && R.aim) {
    const b = getE(UI.aimSilo), H = b && BDEFS[b.type].lvl ? lvlHill(b, tIdx(R.aim.i, R.aim.j)) : null;
    if (H && H.ts) t5Outline(ctx, new Set(H.ts), ox, oy, z, T5_COL.lvl, 0.28, false);
  }
}

/** Over the ground: each Leveller's hill being cut (selected: outlined) and the dust at its cut; a Reservoir's basin while it fills. */
const _t5Cut = new Map();
function t5Marks(ctx, ox, oy, z, v0, v1) {
  for (const b of S.buildings) {
    if (b.dead || !b.built) continue;
    if (BDEFS[b.type].lvl && b.lvTs) {
      const base = S.elev[tIdx(b.x, b.y)];
      if (R.selected === b.id || (R.mode === 'aim' && UI.aimSilo === b.id)) t5Outline(ctx, new Set(b.lvTs.filter((t) => S.elev[t] > base)), ox, oy, z, T5_COL.lvl, 0.12, true);
      if (!b.working || R.inMap) continue;
      let c = _t5Cut.get(b.id);
      if (!c || R.time - c.at > 1.5) { c = { at: R.time, t: lvlPick(b) }; _t5Cut.set(b.id, c); }
      if (c.t < 0) continue;
      const x = ox + ((c.t % S.W) + 0.5) * z, y = oy + (((c.t / S.W) | 0) + 0.5) * z;
      ctx.save();
      for (let k = 0; k < 4; k++) {
        const ph = (R.time * 0.7 + k / 4) % 1, a = 0.38 * (1 - ph);
        ctx.fillStyle = `rgba(206,184,152,${a})`;
        ctx.beginPath(); ctx.arc(x + Math.sin(k * 2.1 + b.id) * z * 0.3, y - ph * z * 0.9, z * (0.2 + ph * 0.45), 0, Math.PI * 2); ctx.fill();
      }
      ctx.strokeStyle = T5_COL.lvl; ctx.globalAlpha = 0.5 + 0.3 * Math.sin(R.time * 4); ctx.lineWidth = Math.max(1, z * 0.05);
      ctx.strokeRect(x - z * 0.5, y - z * 0.5, z, z);
      ctx.restore();
    }
  }
}

/* ------------------------------------------------------------------ drawing: the buildings */

const T5_WORK = new Map(); // (each one's work frame where it stopped: looks only)
/** The Reservoir or the Leveller, built: its art at the time of day, its lamps, its moving parts over it. True if drawn. */
function t5DrawBuilding(ctx, type, cx, cy, s, owner, b) {
  const art = artFor(type, owner);
  if (!art) { t5Plain(ctx, type, cx, cy, s, owner); return true; }
  drawMegaArt(ctx, art, cx, cy, s, b);
  megaNight(ctx, art, cx, cy, s, owner, b);
  const live = !!(b && b.id && b.built);
  let f = 0;
  if (live) {
    if (T5_WORK.size > 64) T5_WORK.clear();
    f = b.working && !megaDark(b) ? Math.floor(R.time * 6) % 4 : T5_WORK.get(b.id) || 0;
    T5_WORK.set(b.id, f);
  }
  const w = ART[`${type}-work-${f}`];
  if (w) drawMegaArt(ctx, w, cx, cy, s, b);
  return true;
}
/** Going up: footings and a crane to 45%, the structure in scaffolding to 85%, then the finished art rising over it. */
function t5DrawSite(ctx, type, cx, cy, s, owner, b) {
  const st1 = artFor(type + '-site1', owner), st2 = artFor(type + '-site2', owner), whole = artFor(type, owner);
  if (!st1 || !st2 || !whole) return false;
  const p = b.progress || 0, w = 3 * s, color = PLAYER_COLORS[owner];
  const fade = (a, k) => { if (k <= 0) return; const ga = ctx.globalAlpha; ctx.globalAlpha = ga * Math.min(1, k); drawArt(ctx, a, cx, cy, s); ctx.globalAlpha = ga; };
  fade(st1, 1);
  fade(st2, (p - 0.4) / 0.1);
  if (p > 0.85) { ctx.save(); ctx.beginPath(); ctx.rect(cx - w * 1.5, cy + w * 0.5 - w * 1.6 * ((p - 0.85) / 0.15), w * 3, w * 3); ctx.clip(); drawArt(ctx, whole, cx, cy, s); ctx.restore(); }
  const bw = w * 0.8;
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(cx - bw / 2, cy + w * 0.46, bw, Math.max(3, s * 0.1));
  ctx.fillStyle = color; ctx.fillRect(cx - bw / 2, cy + w * 0.46, bw * p, Math.max(3, s * 0.1));
  return true;
}
/** Before the art has loaded (and in the build menu's icon): three towers and a cistern, or a wheel on a boom. */
function t5Plain(ctx, type, cx, cy, s, owner) {
  const col = PLAYER_COLORS[owner] || '#9aa2ab';
  ctx.save();
  ctx.fillStyle = 'rgba(20,14,10,0.3)'; roundRect(ctx, cx - 1.38 * s, cy - 1.3 * s, 2.76 * s, 2.76 * s, s * 0.15); ctx.fill();
  ctx.fillStyle = '#9b958a'; roundRect(ctx, cx - 1.38 * s, cy - 1.38 * s, 2.76 * s, 2.76 * s, s * 0.15); ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = Math.max(1.5, s * 0.06); ctx.stroke();
  if (type === 'reservoir') {
    ctx.fillStyle = '#2a6f86'; ctx.fillRect(cx - 1.1 * s, cy + 0.1 * s, 2 * s, 0.6 * s);
    for (const dx of [-0.85, 0, 0.85]) { ctx.fillStyle = '#d6d2c8'; ctx.fillRect(cx + dx * s - 0.22 * s, cy - 1.5 * s, 0.44 * s, 1.3 * s); ctx.fillStyle = T5_COL.rsv; ctx.fillRect(cx + dx * s - 0.22 * s, cy - 0.7 * s, 0.44 * s, 0.08 * s); }
  } else {
    ctx.fillStyle = '#c9962a'; ctx.fillRect(cx - 0.6 * s, cy - 0.5 * s, 1.3 * s, 1 * s);
    ctx.strokeStyle = '#c9962a'; ctx.lineWidth = s * 0.12; ctx.beginPath(); ctx.moveTo(cx, cy - 0.3 * s); ctx.lineTo(cx - 0.7 * s, cy - 1.5 * s); ctx.stroke();
    ctx.lineWidth = s * 0.08; ctx.beginPath(); ctx.arc(cx - 0.8 * s, cy - 1.6 * s, 0.45 * s, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = T5_COL.lvl; ctx.fillRect(cx + 0.5 * s, cy + 0.7 * s, 0.6 * s, 0.4 * s);
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ the greening meter: top bar, panel, minimap */

/** The ring for share `v` (0..1) against goal `g` (0..1, or 0: none), `px` across. */
function t5Ring(v, g, px) {
  const r = px / 2 - 2, C = 2 * Math.PI * r, a = Math.max(0, Math.min(1, v));
  const tick = g ? (() => { const ang = -Math.PI / 2 + g * 2 * Math.PI, x1 = px / 2 + Math.cos(ang) * (r - 3), y1 = px / 2 + Math.sin(ang) * (r - 3), x2 = px / 2 + Math.cos(ang) * (r + 2.5), y2 = px / 2 + Math.sin(ang) * (r + 2.5); return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#fff" stroke-width="1.6"/>`; })() : '';
  return `<svg class="gm-ring" width="${px}" height="${px}" viewBox="0 0 ${px} ${px}" aria-hidden="true"><circle cx="${px / 2}" cy="${px / 2}" r="${r}" fill="none" stroke="rgba(123,224,90,0.22)" stroke-width="3"/>` +
    `<circle cx="${px / 2}" cy="${px / 2}" r="${r}" fill="none" stroke="${T5_COL.green}" stroke-width="3" stroke-dasharray="${(a * C).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 ${px / 2} ${px / 2})" stroke-linecap="round"/>${tick}</svg>`;
}
/** Is the Colony goal Made ready on in this game? */
function t5GoalOn() { return !!(S && S.settings && S.settings.greenWin && S.mode === 'colony' && !S.mission); }
/** The top bar's ring and share, after the land share (Colony; Versus once anyone has greened a tile). '' when none. */
function t5Chip() {
  if (!S || !S.gm || (S.mode !== 'colony' && !S.gm.n.some((n) => n > 0))) return '';
  const v = greenShare(ME);
  return ` <span class="gm-chip" title="Land made ready: ${Math.round(v * 100)}% of the open land is green${t5GoalOn() ? ` (the goal: ${Math.round(GREEN.goal * 100)}%)` : ''}. Tap for the Greening panel (Shift+G)">${t5Ring(v, t5GoalOn() ? GREEN.goal : 0, 16)}${Math.floor(v * 100)}% green</span>`;
}

/** The kinds the meter counts, as the panel lists them (S.gm.k index). */
const T5_KINDS = [null, ['Soil and graded ground', 'Composters, Spread soil, the Graders and the Leveller', '#c8925a'], ['Wet ground', 'Water Pumps, the Atmosphere Engine\'s rain, the Reservoir\'s banks', T5_COL.rsv],
  ['Shifted land', 'the biome shift, the Atmosphere Engine\'s Green', '#9ad86a'], ['Groves', 'Tree Nurseries', '#3f8f44']];

/** The Greening panel (Shift+G, or a tap on the ring): your share, its trend to the goal, what counts, what's at risk, the planet. */
function openGreening() {
  if (!UI.inGame || !S || !S.players[ME]) return;
  setMode('normal');
  R.greenMap = true; if (typeof MM !== 'undefined') MM.dirty = true;
  openSheet('green', 0, `<div class="sheet-title"><div><h3>Greening</h3></div></div><div id="gm-body"></div>`);
  refreshGreening();
}
function refreshGreening() {
  const el = $('gm-body');
  if (!el) return;
  const G = S.gm, v = greenShare(ME), goal = t5GoalOn() ? GREEN.goal : 0, h = (G && G.h) || [];
  const rate = h.length >= 2 ? (h[h.length - 1] - h[Math.max(0, h.length - 6)]) / Math.min(5, h.length - 1) : 0;
  const togo = goal && rate > 0 && v < goal ? Math.round((goal * 100 - v * 100) / rate) : 0;
  const parts = [];
  parts.push(`<div class="gm-head">${t5Ring(v, goal, 56)}<div><div class="gm-big">${Math.floor(v * 100)}% <small>made ready</small></div><div class="gm-sub">${G ? G.n[ME] || 0 : 0} of ${G ? G.of : 0} tiles of open land${goal ? ` · goal ${Math.round(goal * 100)}%` : ''}${rate ? ` · ${rate > 0 ? '+' : ''}${rate.toFixed(1)}% a minute` : ''}${togo ? ` · about ${togo} min to go` : ''}</div></div></div>`);
  if (h.length >= 2) {
    const W = 260, H = 60, max = Math.max(goal * 100 || 0, ...h, 10), pts = h.map((y, k) => `${((k / (h.length - 1)) * W).toFixed(1)},${(H - (y / max) * H).toFixed(1)}`).join(' ');
    parts.push(`<div class="section-label">The last ${h.length} minutes</div><svg class="gm-hist" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Your share of the land made ready, a minute at a time"><polyline points="${pts}" fill="none" stroke="${T5_COL.green}" stroke-width="2"/>${goal ? `<line x1="0" x2="${W}" y1="${H - goal * 100 / max * H}" y2="${H - goal * 100 / max * H}" stroke="#fff" stroke-dasharray="4 3" stroke-width="1"/>` : ''}</svg>`);
  }
  parts.push('<div class="section-label">What counts</div>');
  for (let k = 4; k >= 1; k--) parts.push(`<div class="kv"><span><i class="gm-sw" style="background:${T5_KINDS[k][2]}"></i>${T5_KINDS[k][0]}</span><span>${G ? G.k[k] || 0 : 0} tiles · ${T5_KINDS[k][1]}</span></div>`);
  parts.push(`<p class="hint">Open land is ground with nothing built or laid on it and no deposit to dig; water, rock, roads and buildings count for no one. A tile is green once its soil is improving, it is wet, its biome has shifted, a grove stands on it or it has been graded.${goal ? ` Green ${Math.round(goal * 100)}% of it and Ithaca I is made ready: you win.` : ''}</p>`);
  // At risk: your groves burning, and green under a rival's Storm Front
  let burn = 0;
  for (const f of S.fires || []) { const t = tIdx(Math.floor(f.x), Math.floor(f.y)); if (inMap(Math.floor(f.x), Math.floor(f.y)) && S.grove && S.grove[t] && greenOwner(t) === ME) burn++; }
  const storms = typeof atmosStorms === 'function' ? atmosStorms().filter((b) => foes(b.owner, ME)).length : 0;
  parts.push(`<div class="section-label">At risk</div><div class="kv"><span>Burning groves</span><span>${burn || 'None'}</span></div><div class="kv"><span>Rival Storm Fronts</span><span>${storms || 'None'}</span></div>`);
  if (S.mode !== 'colony' && G) {
    parts.push('<div class="section-label">The planet</div>');
    for (const P of S.players) if (!P.absent && !P.out) { const s = G.of ? (G.n[P.id] || 0) / G.of : 0; parts.push(`<div class="kv"><span style="color:${PLAYER_COLORS[P.id]}">${esc(callsign(P.id))}</span><span>${Math.round(s * 100)}%</span></div>`); }
  }
  const html = parts.join('');
  if (el.dataset.html !== html) { el.dataset.html = html; el.innerHTML = html; }
}

/** The minimap's Green layer: green land by kind (groves darkest), the rest dimmed. `c` the colour so far. */
let _t5Rain = { at: -1, M: null };
function t5MiniGreen(t, c) {
  if (S.terrain[t] !== T_GROUND) return [c[0] * 0.45, c[1] * 0.45, c[2] * 0.5];
  if (_t5Rain.at !== S.tick) _t5Rain = { at: S.tick, M: greenRain() };
  const k = greenOpen(t) ? greenKind(t, _t5Rain.M) : 0;
  if (!k) return [c[0] * 0.4 + 20, c[1] * 0.4 + 20, c[2] * 0.4 + 20];
  return [[0, 0, 0], [176, 214, 120], [150, 224, 120], [104, 196, 78], [46, 128, 52]][k];
}
/** The GREEN tag at the minimap's foot: the share, lit while the layer is on; a tap toggles it. */
function t5MiniTag() {
  const el = $('mm-green');
  if (!el) return;
  const on = !!(S && S.gm && (S.mode === 'colony' || S.gm.n.some((n) => n > 0)));
  el.hidden = !on;
  if (!on) return;
  const txt = `GREEN ${Math.floor(greenShare(ME) * 100)}%`;
  if (el.textContent !== txt) el.textContent = txt;
  el.classList.toggle('on', !!R.greenMap);
  el.setAttribute('aria-pressed', R.greenMap ? 'true' : 'false');
  if (!el.onclick) el.onclick = (e) => { e.stopPropagation(); R.greenMap = !R.greenMap; if (typeof MM !== 'undefined') MM.dirty = true; sfx('click'); t5MiniTag(); };
  // (the layer is worked out from the meter's layers: made again now and then while it shows)
  if (R.greenMap && typeof MM !== 'undefined' && S.tick % 60 === 0) MM.dirty = true;
}

/** Colony, with the Made ready goal: the win card (the Domination card's shape): your share against the goal. */
function t5WinCard() {
  const el = $('win-card');
  if (!t5GoalOn() || S.winner >= 0 || S.endless || !S.gm) return false;
  const v = greenShare(ME), goal = GREEN.goal, h = S.gm.h || [], rate = h.length >= 2 ? (h[h.length - 1] - h[Math.max(0, h.length - 6)]) / Math.min(5, h.length - 1) : 0;
  if (el.dataset.key !== 'green') {
    el.dataset.key = 'green';
    el.innerHTML = '<div class="ev-head"><span class="ev-dot"></span><b class="wc-head"></b><span class="ev-time"></span></div><div class="win-rows"></div><div class="win-note"></div>';
    el.onclick = () => openGreening();
  }
  el.classList.add('mine'); el.classList.remove('theirs');
  const dot = el.querySelector('.ev-dot'); dot.style.background = T5_COL.green; dot.style.color = T5_COL.green;
  el.querySelector('.wc-head').textContent = `Made ready: green ${Math.round(goal * 100)}% of the land`;
  el.querySelector('.ev-time').textContent = rate > 0 && v < goal ? `~${Math.round((goal * 100 - v * 100) / rate)} min` : '';
  el.querySelector('.win-rows').innerHTML = `<span class="wn">${esc(callsign(ME))}</span><span class="win-bar" style="--c:${T5_COL.green}"><i style="width:${Math.min(100, (v / goal) * 100).toFixed(1)}%"></i><b style="left:100%"></b></span><span class="wp">${Math.floor(v * 100)}%</span>`;
  const k = S.gm.k;
  el.querySelector('.win-note').textContent = `${rate ? `${rate > 0 ? '+' : ''}${rate.toFixed(1)}% a minute. ` : ''}Groves ${k[4]}, shifted ${k[3]}, wet ${k[2]}, soil and graded ${k[1]} tiles. Tap for the Greening panel.`;
  UI.winMini = ` <span class="win-mini"><i style="background:${T5_COL.green}"></i>${Math.floor(v * 100)}%</span>`;
  el.hidden = !!UI.objCollapsed;
  return true;
}

'use strict';
/*
 * Terrafall — Terraforming, stage 4: military earthworks. The interface and the drawing; the rules are in js/sim.js (the
 * stage 4 block: t4Job, t4Earthwork, ewCover, ewHit, the Sluice's sluiceOrder and sluiceTick, t4CaveIn, the Sap Head's
 * sapPlan, updateSapHead and sapRide) and the numbers in EW, SLUICE, CAVE and SAP (js/defs.js).
 *
 *  - Build → Terraform (key 6) holds them after stage 3's: the Grader's Earth Bank (K), Fire Trench (X) and Dragon's
 *    Teeth (Z), dragged like Walls, and its Cave in (V) (TF_TOOLS_UI, below); the Sluice (U) and the Sap Head (Q)
 *    (t4Cards), with what each would do shown while placing (t4PlaceText) and their panels (t4Panel, t4Buttons).
 *  - A Sap Head's route is planned in the Terraform mode with the tool 'sap' (sapStart: its panel's Plan sap, T): drag
 *    out from the Sap Head a tile at a time (sapPaint), the banner's Dig sends it (ORDERS.sap).
 *  - The earthworks on the ground, baked with the map and graded with it (t4PaintTile): per-tile pieces that join their
 *    neighbours like Walls (a post or hub, an arm toward each neighbour of the same kind), at three looks (intact, worn,
 *    breached), the team's colour on the stakes, lamps and cat's-eyes (lit at night: t4Glow). The rendered pieces
 *    (renderer/walls/b/earthwork.js: ew-<kind>-<piece>-<look>) when they're loaded, else drawn in code the same way.
 *    A caved-in tunnel's groove with its dead veins is baked the same way.
 *  - A Sluice's flood, drawn over the ground each frame and graded with it (t4Overlay): only the tiles of a flood, by
 *    stage; the spill at an open Sluice. The Sluice itself, the Sap Head (its working loop while it digs) and the Sap
 *    Exit (t4DrawBuilding).
 *  - Over the graded ground (t4Marks): your saps' routes (dashed, the head ringed; only yours: sapSeen), the tremors
 *    you feel (rings where the ground shook), and the earthworks your warbots are ordered to shoot (a reticle, its
 *    strength as a ring). An Attack order on an earthwork's tile: ewOrderAt (right-click a foe's; Ctrl, Alt or Cmd for
 *    your own), the rules in sim.js (orderEwShoot, ewShoot).
 *  - The minimap's colours (t4MiniColor).
 * The look is the owner's picks from the stage 4 concept canvas (ART_GUIDE Batch 38): Earth Bank (Berm A), Fire Trench
 * (Revetted, A), Dragon's Teeth (Tank traps B), Sluice (Radial Gates, A; spillway mint), Sap Head (Tunnel Bore A;
 * tunnel-lamp salmon). Looks only: nothing here changes the simulation.
 */

const T4_TYPES = ['sluice', 'saphead'];
/** The stage 4 buildings on the Terraform tab. */
function t4Types() { return T4_TYPES; }

// The Grader's stage 4 tools (TF_TOOLS in sim.js): their cards and the Terraform banner's rows (js/terraform.js).
Object.assign(TF_TOOLS_UI, {
  bank: { card: 'Stops vehicles, slows robots, cover.', key: 'k', name: 'Earth Bank', glyph: '⌒',
    how: `Drag a line: a bank of heaped earth, ${EW.kinds.bank.cost.stone} Stone a tile. Vehicles and heavy robots can't cross it, other robots climb over slowly, and yours behind it take less fire. Drag over a worn one to repair it.` },
  trench: { card: 'Slows crossing; cover inside.', key: 'x', name: 'Fire Trench', glyph: '⊔',
    how: `Drag a line: a revetted trench, ${EW.kinds.trench.cost.stone} Stone a tile. Everyone crossing it slows down; your robots in it take half the fire. Drag over a worn one to repair it.` },
  teeth: { card: 'Stops vehicles; robots pass.', key: 'z', name: 'Dragon\'s Teeth', glyph: '⩓',
    how: `Drag a line: concrete pyramids, ${EW.kinds.teeth.cost.cement} Cement and ${EW.kinds.teeth.cost.alloy} Alloy a tile. Vehicles and heavy robots can't pass; small robots go between them. Drag over a worn one to repair it.` },
  cave: { card: 'Collapse a Murmur tunnel.', key: 'v', name: 'Cave in', glyph: '✕',
    how: 'Tap a Murmur tunnel (the raised ridge with the veins): the Grader caves it in for a stretch, the Murmur can never dig through there again, and the exits it cuts off from their nest cave in. Or tap beside a tunnel exit, or an enemy Sap Exit, to collapse it.' },
});

/** The earthworks' names by kind (1 bank, 2 trench, 3 teeth). */
const EW_NAMES = ['', 'Earth Bank', 'Fire Trench', 'Dragon\'s Teeth'];
/**
 * A right-click (or a tap) with warbots selected on tile (i, j): its earthwork's kind if it's one to attack (ORDERS.command
 * with `ew`: orderEwShoot), else 0. A foe's (or no one's) is attacked; your own or an ally's only with `force` (Ctrl,
 * Alt or Cmd held), since a plain right-click there moves them onto it (into your trench, say).
 */
function ewOrderAt(i, j, force) {
  if (!S.ewK || !inMap(i, j)) return 0;
  const t = tIdx(i, j), k = ewAt(t), o = ewOwner(t);
  return k && (force || o < 0 || foes(o, ME)) ? k : 0;
}

/** Their cards on the Terraform tab, after stage 3's (openBuildMenu binds them as it does every building card). */
function t4Cards() {
  const have = playerGoods(ME), sites = siteCount(ME);
  return T4_TYPES.map((t) => {
    const ban = worldBan(t), k = BUILD_KEYS.terra[t];
    return `<button class="bcard${ban ? ' banned' : ''}" data-t="${t}" data-g="terra" ${sites >= MAX_SITES || ban ? 'disabled' : ''} title="${ban || BDEFS[t].name}">` +
      `<kbd data-tab="${BUILD_TAB_KEYS.terra}" data-key="${k.toUpperCase()}">${k.toUpperCase()}</kbd><img src="${iconFor(t)}" alt=""><div class="bname">${BDEFS[t].name}</div>` +
      `<div class="bcost">${costHTML(BDEFS[t].cost, have)}</div><div class="bhave">${ownedText(t)}</div></button>`;
  }).join('');
}

/** What the placing banner says about a stage 4 building at (i, j). */
function t4PlaceText(type, i, j) {
  if (type === 'sluice') {
    const axis = (typeof UI !== 'undefined' && UI.mdAxis) || 'ew', why = inMap(i, j) ? sluiceWhy(i, j, axis) : '';
    if (why) return ` <span class="err">${why}</span>`;
    const n = sluiceFloodPlan({ x: i, y: j, mdAxis: axis, id: -1 }).length;
    return ` <span class="ok">Opened, its water would flood about ${n} tile${n === 1 ? '' : 's'} of low ground beyond it.</span> R turns it.`;
  }
  if (type === 'saphead') return ` Once it stands, plan its sap from its panel (Plan sap): up to ${SAP.most} tiles, a tile every ${SAP.dig} s.`;
  return '';
}

/** A stage 4 building's panel rows (buildingSheet). */
function t4Panel(b, mine) {
  const def = BDEFS[b.type], out = [];
  if (def.sluice) {
    const F = b.fl, wet = F ? F.st.filter((v) => v === 3).length : 0;
    out.push(`<div class="kv"><span>Water behind it</span><span>${sluiceWater(b)} tiles</span></div>`);
    if (F) out.push(`<div class="kv"><span>Its flood</span><span>${F.n} tiles · ${wet} under water now</span></div>`);
    else if (b.built) out.push(`<div class="kv"><span>Opened, it floods</span><span>about ${sluiceFloodPlan(b).length} tiles</span></div>`);
    out.push(`<p class="hint">Opened, the water pours out over the low ground beyond it (pouring, spreading, under water), stands about ${SLUICE.stay} s and goes down the far end first (wet mud, then dried silt, part of it fertile). Nobody walks under water and mud slows everyone; buildings the water reaches lose a third of their strength and are knocked out while it stands, robots are knocked about. It refills for ${Math.round(SLUICE.refill / 60)} minutes after it shuts.</p>`);
  } else if (def.saphead) {
    const A = b.sap;
    if (A && mine) out.push(`<div class="kv"><span>Sap</span><span>${A.exit ? (sapExitOf(b) ? 'open: robots go through' : 'its exit was lost') : `${A.dug} of ${A.route.length} tiles dug`}</span></div>`);
    out.push(`<p class="hint">Plan a route from it a tile at a time (up to ${SAP.most} tiles): it digs a tile every ${SAP.dig} s under ground, roads, buildings and Walls. Only you see the route; a rival feels a tremor when it passes under something of theirs. At its end an exit opens, and your robots go through the sap between here and there. The enemy can shoot the exit down or cave it in; then plan it again.</p>`);
  } else if (def.sapexit) {
    out.push(`<p class="hint">${b.owner === ME ? 'Your sap comes up here: your robots go through between it and its Sap Head.' : 'An enemy sap comes up here. Shoot it down, or cave it in with a Grader (Build, 6, Cave in: tap beside it).'}</p>`);
  }
  return out;
}

/** A stage 4 building's buttons on its panel (yours, built): the Sluice's Open or Shut, the Sap Head's Plan sap. */
function t4Buttons(b) {
  if (BDEFS[b.type].sluice) return `<button class="btn primary big" id="sh-sluice">${b.slOpen ? 'Shut the Sluice' : 'Open the Sluice'}</button><p class="hint" id="sh-sluice-hint">${b.slOpen ? 'The water is pouring out: shut it to stop the front where it is.' : sluiceCan(b) || 'Open the gates: the water floods the low ground beyond it.'}</p>`;
  if (BDEFS[b.type].saphead) return `<button class="btn primary big" id="sh-sap">${b.sap ? 'Plan the sap again' : 'Plan sap'}</button><p class="hint">Drag out from the Sap Head a tile at a time, then Dig.${b.sap ? ' Planning again starts the dig over and closes the old sap.' : ''}</p>`;
  return '';
}
/** Bind those buttons (buildingSheet, after it's drawn). */
function t4Bind(b) {
  const sl = $('sh-sluice');
  if (sl) {
    sl.disabled = !b.slOpen && !!sluiceCan(b);
    sl.onclick = () => { sfx('click'); act('sluice', [b.id, !b.slOpen], (r) => { if (r && r.why) { sfx('error'); toast(r.why, 'warn'); return; } sfx('order'); toast(b.slOpen ? 'Sluice open: the water is pouring out.' : 'Sluice shut: the front stops where it is.', 'info'); refreshSheet(); }); };
  }
  const sp = $('sh-sap');
  if (sp) sp.onclick = () => sapStart(b);
}

/* ------------------------------------------------------------------ planning a sap (the Terraform mode, tool 'sap') */

/** Start planning Sap Head b's sap: the Terraform mode with the tool 'sap' (the drag runs out from it). */
function sapStart(b) {
  if (!b || b.dead || !b.built) return;
  sfx('click');
  closeSheet();
  setMode('terra');
  UI.tf = { tool: 'sap', head: b.id, list: [], start: -1, end: -1, prev: { rows: [], plan: new Map(), why: '' } };
  sapBanner();
}
/** The tiles of a four-way line from (a, b) to (c, d): along the longer way first, then the other. */
function sapLine(a, b, c, d) {
  const out = [];
  let x = a, y = b;
  while (x !== c || y !== d) {
    if (Math.abs(c - x) >= Math.abs(d - y) && x !== c) x += Math.sign(c - x); else y += Math.sign(d - y);
    out.push([x, y]);
  }
  return out;
}
/** A drag on the map while planning a sap: the route grows out from its end (dragging back over it takes it back). */
function sapPaint(i, j, first) {
  const F = UI.tf, h = getE(F.head);
  if (!h || !inMap(i, j)) return;
  const last = F.list.length ? F.list[F.list.length - 1] : tIdx(h.x, h.y);
  if (first && !F.list.length && Math.abs(i - h.x) + Math.abs(j - h.y) > 1 && !(i === h.x && j === h.y)) { /* (a drag started away from the head: run out to it from the head) */ }
  if (i === h.x && j === h.y) { if (first) F.list = []; sapBanner(); return; }
  const back = F.list.indexOf(tIdx(i, j));
  if (back >= 0) { F.list.length = back + 1; sapBanner(); return; }
  for (const [x, y] of sapLine(last % S.W, (last / S.W) | 0, i, j)) {
    const t = tIdx(x, y), k = F.list.indexOf(t);
    if (k >= 0) { F.list.length = k + 1; continue; }
    if (t === tIdx(h.x, h.y) || F.list.length >= SAP.most) break;
    F.list.push(t);
  }
  sapBanner();
}
/** A tap while planning a sap: the route runs out to the tile tapped. */
function sapTap(i, j) { sapPaint(i, j, false); sfx('click'); }
/** The banner while planning a sap: what it is, how long, how long to dig, why not. */
function sapBanner() {
  const F = UI.tf, h = getE(F.head);
  if (!h) { setMode('normal'); return; }
  const n = F.list.length, why = n ? sapWhy(ME, h, F.list) : '';
  F.prev = { rows: [], plan: new Map(), why };
  const sum = n ? `<b>${n}</b> tile${n === 1 ? '' : 's'} · about <b>${fmtClock(n * SAP.dig)}</b> to dig` : 'Drag out from the Sap Head (the ringed tile) a tile at a time, round corners as you like.';
  showBanner(`<div class="tf-how"><b>Plan sap</b>: the route of the tunnel, under anything but water and rock. Only you see it; a rival feels a tremor as it passes under their buildings. It breaks out at the end.</div><div class="tf-sum">${sum}${why ? ` <span class="err">${why}</span>` : ''}</div>`, 'Dig', 'Done');
  $('banner-ok').disabled = !n || !!why;
  if (typeof bannerMissionHint === 'function') bannerMissionHint();
}
/** The banner's Dig: the route goes to the Sap Head. */
function sapConfirm() {
  const F = UI.tf;
  if (!F || !F.list.length) return;
  act('sap', [F.head, F.list.slice()], (r) => {
    if (r && r.why) { sfx('error'); toast(r.why, 'warn'); return; }
    sfx('place'); haptic('order');
    toast(`Sap planned: ${F.list.length} tiles, about ${fmtClock(F.list.length * SAP.dig)} to dig. Only you can see it.`, 'info');
    setMode('normal');
  });
}

/* ------------------------------------------------------------------ drawing: colours and the earthworks' pieces */

/** Stage 4's colours: the Sluice's spillway mint, the Sap Head's tunnel-lamp salmon, the flood's stages, concrete. */
const T4_COL = { sluice: '#b8ffe8', sap: '#ffa38c', conc: [196, 190, 178], bag: [205, 194, 166],
  fld: [null, [196, 226, 232, 0.8], [84, 122, 136, 0.78], [44, 100, 126, 0.84], [62, 46, 32, 0.62], [190, 170, 132, 0.4]] };
const EW_PIECES = ['n', 'e', 's', 'w'];

/** The earthwork's look on tile t: 0 intact, 1 worn (below EW.worn of its strength), 2 breached. */
function ewLook(t) {
  const k = S.ewK[t], h = S.ewH[t];
  if (!h) return 2;
  return h < EW.kinds[EW_KINDS[k]].hp * EW.worn ? 1 : 0;
}
/** Which of tile (i, j)'s sides join an earthwork (or a site of one) of kind k: [n, e, s, w]. */
function ewJoins(i, j, k) {
  const at = (x, y) => {
    if (!inMap(x, y)) return false;
    const t = tIdx(x, y);
    if (S.ewK && S.ewK[t] === k) return true;
    const s = S.bAt[t] ? getE(S.bAt[t]) : null;
    return !!(s && s.tf && !s.built && (s.tf.k === EW_KINDS[k] || (s.tf.k === 'ewfix' && s.tf.n === k)));
  };
  return [at(i, j - 1), at(i + 1, j), at(i, j + 1), at(i - 1, j)];
}

/**
 * One earthwork piece of kind k (1 bank, 2 trench, 3 teeth) on the tile at (x, y), s px across: its post (or hub) and
 * an arm toward each side in `J` ([n, e, s, w]), at look d (0 intact, 1 worn, 2 breached), the owner's colour on its
 * stakes, lamps and cat's-eyes. The rendered pieces when they're loaded; else drawn in code the same way.
 */
function ewDraw(ctx, x, y, s, k, J, d, owner, seed, soil) {
  const kind = EW_KINDS[k], cx = x + s / 2, cy = y + s / 2;
  const art = (p) => artFor(`ew-${kind}-${p}-${d}`, owner);
  if (art('post')) {
    // (as the Walls: the arms north, west and east, then the post (a hub on a straight run), then the south arm)
    const ns = J[0] && J[2] && !J[1] && !J[3], ew = J[1] && J[3] && !J[0] && !J[2];
    for (const q of [0, 3, 1]) if (J[q]) { const a = art(EW_PIECES[q]); if (a) drawArt(ctx, a, cx, cy, s); }
    const hub = (ns || ew) && art(ns ? 'hub-ns' : 'hub-ew');
    drawArt(ctx, hub || art('post'), cx, cy, s);
    if (J[2]) { const a = art('s'); if (a) drawArt(ctx, a, cx, cy, s); }
    return;
  }
  const col = PLAYER_COLORS[owner] || '#9aa2ab';
  const rnd = (n) => hash2(seed, n, 9137);
  // the arms' rectangles: from the middle out to each joined side (a lone tile: a short stretch east-west)
  let arms = EW_PIECES.map((p, q) => J[q]);
  if (!arms.some((v) => v)) arms = [false, true, false, true];
  const seg = (q, w, a0 = 0, a1 = 0.5) => { // [x0, y0, x1, y1] of arm q, w wide (tile units), a0..a1 from the middle
    const h = w / 2;
    if (q === 0) return [cx - h * s, cy - a1 * s, cx + h * s, cy - a0 * s];
    if (q === 2) return [cx - h * s, cy + a0 * s, cx + h * s, cy + a1 * s];
    if (q === 1) return [cx + a0 * s, cy - h * s, cx + a1 * s, cy + h * s];
    return [cx - a1 * s, cy - h * s, cx - a0 * s, cy + h * s];
  };
  const fill = (r, style) => { ctx.fillStyle = style; ctx.fillRect(r[0], r[1], r[2] - r[0], r[3] - r[1]); };
  const sh = (rgb, m, a = 1) => `rgba(${rgb.map((v) => Math.round(clamp(v * m, 0, 255))).join(',')},${a})`;
  const gap = d === 2 ? 0.22 : 0; // (breached: the middle gone)
  ctx.save();
  if (k === 1) {
    // Earth Bank: a rounded bank of the biome's own earth, lit from the upper left, blade furrows along it; stakes.
    const w = d === 1 ? 0.6 : 0.66, hgt = d === 1 ? 0.7 : 1;
    for (const [dx, a, m] of [[0.07, 0.32, 0.25], [0, 1, 0.82], [-0.035, 1, 1.08 * hgt + 0.0], [-0.06, 1, 1.22]]) { // shadow, body, slope, crest
      const ww = dx === 0 ? w : dx > 0 ? w : dx > -0.05 ? w * 0.62 : w * 0.26;
      for (let q = 0; q < 4; q++) if (arms[q]) {
        const r = seg(q, ww, gap, 0.5);
        if (dx > 0) { ctx.fillStyle = `rgba(20,10,4,${a})`; ctx.fillRect(r[0] + dx * s, r[1] + dx * s, r[2] - r[0], r[3] - r[1]); }
        else fill([r[0] + dx * s * 0.4, r[1] + dx * s * 0.4, r[2] + dx * s * 0.4, r[3] + dx * s * 0.4], sh(soil, m));
      }
      if (!gap) {
        ctx.beginPath(); ctx.arc(cx + (dx > 0 ? dx * s : dx * s * 0.4), cy + (dx > 0 ? dx * s : dx * s * 0.4), (ww / 2) * s, 0, Math.PI * 2);
        ctx.fillStyle = dx > 0 ? `rgba(20,10,4,${a})` : sh(soil, m); ctx.fill();
      }
    }
    // furrows along the crest
    ctx.strokeStyle = sh(soil, 0.7, 0.55); ctx.lineWidth = Math.max(1, s * 0.02);
    for (let q = 0; q < 4; q++) if (arms[q]) for (const o of [-0.12, 0.05, 0.18]) {
      const r = seg(q, 0.001, gap, 0.5), v = q % 2 === 0;
      ctx.beginPath(); if (v) { ctx.moveTo(cx + o * s, r[1]); ctx.lineTo(cx + o * s, r[3]); } else { ctx.moveTo(r[0], cy + o * s); ctx.lineTo(r[2], cy + o * s); } ctx.stroke();
    }
    if (d >= 1) { // craters, and for a breach the slumped earth either side of the gap
      for (let n = 0; n < (d === 1 ? 2 : 3); n++) { const px = cx + (rnd(n) - 0.5) * s * 0.5, py = cy + (rnd(n + 9) - 0.5) * s * 0.5, r = s * (0.07 + 0.05 * rnd(n + 3));
        ctx.fillStyle = 'rgba(30,18,10,0.55)'; ctx.beginPath(); ctx.ellipse(px, py, r, r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = sh(soil, 1.2, 0.6); ctx.beginPath(); ctx.ellipse(px - r * 0.25, py - r * 0.3, r * 0.5, r * 0.35, 0, 0, Math.PI * 2); ctx.fill(); }
      if (d === 2) for (let n = 0; n < 10; n++) { ctx.fillStyle = sh(soil, 0.8 + rnd(n + 20) * 0.5); const r = s * (0.02 + 0.03 * rnd(n + 30)); ctx.beginPath(); ctx.arc(cx + (rnd(n + 40) - 0.5) * s * 0.4, cy + (rnd(n + 50) - 0.5) * s * 0.4, r, 0, Math.PI * 2); ctx.fill(); }
    }
    // the team's stakes: two along the back of the bank (one worn, none breached)
    for (let n = 0; n < 2 - d; n++) {
      const q = arms.findIndex((v) => v), v = q % 2 === 0, a = n ? 0.32 : -0.08;
      const px = v ? cx + w * 0.42 * s : cx + a * s, py = v ? cy + a * s : cy - w * 0.42 * s;
      ctx.fillStyle = 'rgba(20,10,4,0.4)'; ctx.fillRect(px + s * 0.02, py + s * 0.02, s * 0.03, s * 0.1);
      ctx.fillStyle = '#d8d0bc'; ctx.fillRect(px - s * 0.015, py - s * 0.08, s * 0.03, s * 0.12);
      ctx.fillStyle = col; ctx.fillRect(px - s * 0.025, py - s * 0.11, s * 0.05, s * 0.04);
    }
  } else if (k === 2) {
    // Fire Trench: a revetted cut, steel-lined, its floor dark, sandbag lips both sides; the team's lamp posts.
    const w = 0.34;
    for (let q = 0; q < 4; q++) if (arms[q]) { const r = seg(q, w + 0.24, 0, 0.5); fill([r[0] + s * 0.03, r[1] + s * 0.03, r[2] + s * 0.03, r[3] + s * 0.03], 'rgba(20,12,6,0.28)'); }
    for (let q = 0; q < 4; q++) if (arms[q]) fill(seg(q, w, 0, 0.5), d === 2 ? sh(soil, 0.75) : 'rgb(58,54,52)');
    fill([cx - w / 2 * s, cy - w / 2 * s, cx + w / 2 * s, cy + w / 2 * s], d === 2 ? sh(soil, 0.75) : 'rgb(58,54,52)');
    if (d < 2) {
      for (let q = 0; q < 4; q++) if (arms[q]) fill(seg(q, w * 0.62, 0, 0.5), 'rgb(34,30,28)'); // the floor, in shadow
      fill([cx - w * 0.31 * s, cy - w * 0.31 * s, cx + w * 0.31 * s, cy + w * 0.31 * s], 'rgb(34,30,28)');
      ctx.strokeStyle = 'rgba(150,156,160,0.8)'; ctx.lineWidth = Math.max(1, s * 0.018); // (the steel revetment's top edge)
      for (let q = 0; q < 4; q++) if (arms[q]) { const r = seg(q, w, 0, 0.5); ctx.strokeRect(r[0], r[1], r[2] - r[0], r[3] - r[1]); }
    }
    // sandbag lips, in rows along each side
    const bags = (q, side) => {
      const v = q % 2 === 0, n = 3;
      for (let m = 0; m < n; m++) {
        if (d === 1 && rnd(q * 7 + m + side * 3) < 0.35) continue;
        if (d === 2 && rnd(q * 7 + m + side * 3) < 0.7) continue;
        const a = (0.12 + (m + 0.5) * (0.38 / n)) * (q === 0 || q === 3 ? -1 : 1), o = side * (w / 2 + 0.08);
        const px = v ? cx + o * s : cx + a * s, py = v ? cy + a * s : cy + o * s, bw = (v ? 0.11 : 0.13) * s, bh = (v ? 0.13 : 0.11) * s;
        ctx.fillStyle = 'rgba(30,20,10,0.35)'; ctx.fillRect(px - bw / 2 + s * 0.015, py - bh / 2 + s * 0.015, bw, bh);
        ctx.fillStyle = sh(T4_COL.bag, 0.95 + rnd(m + q) * 0.1); ctx.fillRect(px - bw / 2, py - bh / 2, bw, bh);
        ctx.fillStyle = sh(T4_COL.bag, 1.12, 0.8); ctx.fillRect(px - bw / 2, py - bh / 2, bw, bh * 0.35);
      }
    };
    for (let q = 0; q < 4; q++) if (arms[q]) { bags(q, -1); bags(q, 1); }
    if (d < 2) { // a lamp post at the side of the middle
      const v = arms[0] || arms[2], px = v ? cx + (w / 2 + 0.17) * s : cx, py = v ? cy : cy - (w / 2 + 0.17) * s;
      ctx.fillStyle = '#4a4e52'; ctx.fillRect(px - s * 0.012, py - s * 0.09, s * 0.024, s * 0.11);
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(px, py - s * 0.1, s * 0.03, 0, Math.PI * 2); ctx.fill();
    }
  } else {
    // Dragon's Teeth: pale concrete pyramids in two staggered rows along the line, cat's-eyes in the team's colour.
    const pts = [[0, 0]];
    for (let q = 0; q < 4; q++) if (arms[q]) for (const [a, o] of [[0.28, -0.13], [0.42, 0.13]]) { const v = q % 2 === 0, sg = q === 0 || q === 3 ? -1 : 1; pts.push(v ? [o, sg * a] : [sg * a, o]); }
    pts.forEach(([px0, py0], n) => {
      const r = rnd(n + 60), down = d === 2 ? r < 0.6 : d === 1 && r < 0.2, chip = d === 1 && r < 0.5;
      const px = cx + px0 * s, py = cy + py0 * s, hs = s * (chip ? 0.08 : 0.1);
      if (down) { // (toppled: rubble)
        ctx.fillStyle = sh(T4_COL.conc, 0.7); ctx.beginPath(); ctx.moveTo(px - hs, py); ctx.lineTo(px - hs * 0.2, py - hs * 0.6); ctx.lineTo(px + hs, py - hs * 0.1); ctx.lineTo(px + hs * 0.3, py + hs * 0.6); ctx.closePath(); ctx.fill();
        ctx.fillStyle = sh(T4_COL.conc, 0.55); ctx.fillRect(px + hs * 0.6, py + hs * 0.3, hs * 0.5, hs * 0.4);
        return;
      }
      ctx.fillStyle = 'rgba(20,14,8,0.35)'; ctx.beginPath(); ctx.moveTo(px - hs, py + hs * 0.2); ctx.lineTo(px + hs * 1.6, py + hs * 1.1); ctx.lineTo(px + hs, py + hs); ctx.lineTo(px, py + hs * 1.1); ctx.closePath(); ctx.fill();
      const faces = [[[-1, 0], [0, -1], 1.18], [[0, -1], [1, 0], 1.0], [[1, 0], [0, 1], 0.72], [[0, 1], [-1, 0], 0.86]];
      for (const [[ax, ay], [bx, by], m] of faces) { ctx.fillStyle = sh(T4_COL.conc, m); ctx.beginPath(); ctx.moveTo(px, py - hs * 0.15); ctx.lineTo(px + ax * hs, py + ay * hs); ctx.lineTo(px + bx * hs, py + by * hs); ctx.closePath(); ctx.fill(); }
      if (d < 2 && n % 2 === 0) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(px + hs * 0.3, py + hs * 0.35, s * 0.016, 0, Math.PI * 2); ctx.fill(); }
    });
  }
  ctx.restore();
}

/** Tile (i, j)'s stage 4 ground, baked with the map (paintTile): an earthwork's piece, or a caved-in tunnel's groove. */
function t4PaintTile(ctx, i, j, x, y, t) {
  if (S.caveIn && S.caveIn[t]) t4GrooveDraw(ctx, i, j, x, y, t);
  const k = S.ewK ? S.ewK[t] : 0;
  if (!k) return;
  const soil = TF_SOIL[renderBiomeAt(t)] || TF_SOIL.desert;
  ewDraw(ctx, x, y, TP, k, ewJoins(i, j, k), ewLook(t), ewOwner(t), t, soil);
}

/** A caved-in tunnel's groove on tile (i, j): the ridge slumped into a trough along the tunnel, its veins dead and grey. */
function t4GrooveDraw(ctx, i, j, x, y, t) {
  const soil = TF_SOIL[renderBiomeAt(t)] || TF_SOIL.desert, C = S.caveIn;
  const J = [[0, -1], [1, 0], [0, 1], [-1, 0]].map(([a, b]) => inMap(i + a, j + b) && !!C[tIdx(i + a, j + b)]);
  const cx = x + TP / 2, cy = y + TP / 2, sh = (m, a = 1) => `rgba(${soil.map((v) => Math.round(clamp(v * m, 0, 255))).join(',')},${a})`;
  ctx.save();
  ctx.lineCap = 'round';
  const arms = J.some((v) => v) ? J : [false, true, false, true];
  const stroke = (w, style) => { ctx.strokeStyle = style; ctx.lineWidth = w; ctx.beginPath(); arms.forEach((on, q) => { if (!on) return; const [a, b] = [[0, -1], [1, 0], [0, 1], [-1, 0]][q]; ctx.moveTo(cx, cy); ctx.lineTo(cx + a * TP * 0.55, cy + b * TP * 0.55); }); ctx.stroke(); };
  stroke(TP * 0.62, sh(1.12, 0.55)); // (the slumped spoil either side)
  stroke(TP * 0.38, sh(0.62, 0.9)); // (the groove)
  stroke(TP * 0.16, 'rgba(24,18,16,0.6)');
  // dead veins: grey-violet threads across it, broken
  ctx.strokeStyle = 'rgba(120,112,128,0.75)'; ctx.lineWidth = 1.2;
  for (let n = 0; n < 4; n++) {
    let px = x + hash2(i * 5 + n, j, 6201) * TP, py = y + hash2(i, j * 5 + n, 6203) * TP, a = hash2(i + n, j - n, 6205) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(px, py);
    for (let q = 0; q < 4; q++) { a += (hash2(i * 3 + q, j + n, 6207) - 0.5) * 1.4; px += Math.cos(a) * 5; py += Math.sin(a) * 4; ctx.lineTo(px, py); }
    ctx.stroke();
  }
  ctx.restore();
}

/** Tile (i, j)'s night glow (glowTiles): an earthwork's stakes, lamps and cat's-eyes in its owner's colour (not breached). */
function t4Glow(ctx, i, j, t) {
  const k = S.ewK ? S.ewK[t] : 0;
  if (!k || !S.ewH[t]) return;
  const x = i * TP, y = j * TP, g = artFor(`ew-${EW_KINDS[k]}-glow-${ewLook(t)}`, ewOwner(t));
  if (g) { drawArt(ctx, g, x + TP / 2, y + TP / 2, TP); return; }
  const col = PLAYER_COLORS[ewOwner(t)] || '#ffffff', gr = ctx.createRadialGradient(x + TP / 2, y + TP / 2, 1, x + TP / 2, y + TP / 2, TP * 0.5);
  gr.addColorStop(0, col + '88'); gr.addColorStop(1, col + '00');
  ctx.fillStyle = gr; ctx.fillRect(x, y, TP, TP);
}

/* ------------------------------------------------------------------ drawing: the flood, the buildings, the marks */

/** The floods in play, refreshed as they change (only their tiles are ever looked at). */
function t4Floods() {
  const out = [];
  for (const b of S.buildings) if (!b.dead && b.fl && BDEFS[b.type].sluice) out.push(b);
  return out;
}

/**
 * The Sluices' floods (render, with the ground: graded for the time of day with it): each tile by its stage (the foam of
 * the front pouring in, the brown water spreading, the deep water with its ripples, glossy wet mud, pale cracked silt),
 * streaks running away from the Sluice; and the spill pouring through an open Sluice's gates.
 */
function t4Overlay(ctx, ox, oy, z, v0, v1) {
  if (!S.fld) return;
  const fl = t4Floods();
  if (!fl.length) return;
  const rt = R.time || 0, W = S.W;
  ctx.save();
  for (const b of fl) {
    const F = b.fl, c = bCentre(b);
    for (let q = 0; q < F.ts.length; q++) {
      const st = F.st[q];
      if (!st) continue;
      const t = F.ts[q], i = t % W, j = (t / W) | 0;
      if (i < v0.x - 1 || i > v1.x + 1 || j < v0.y - 1 || j > v1.y + 1) continue;
      const X = ox + i * z, Y = oy + j * z, [r, g, bl, a] = T4_COL.fld[st];
      ctx.fillStyle = `rgba(${r},${g},${bl},${a})`; ctx.fillRect(X, Y, z + 0.5, z + 0.5);
      if (st <= 3) { // streaks running away from the Sluice
        const ux = i + 0.5 - c.x, uy = j + 0.5 - c.y, ul = Math.hypot(ux, uy) || 1, sx = ux / ul, sy = uy / ul;
        ctx.strokeStyle = `rgba(232,246,244,${st === 1 ? 0.7 : st === 2 ? 0.4 : 0.18})`; ctx.lineWidth = Math.max(1, z * 0.05);
        ctx.beginPath();
        for (let n = 0; n < (st === 3 ? 1 : 2); n++) {
          const ph = ((rt * (st === 3 ? 0.25 : 0.8) + hash2(i, j * 3 + n, 7311)) % 1 + 1) % 1, px = X + (0.2 + 0.6 * hash2(i + n, j, 7312)) * z, py = Y + (0.2 + 0.6 * hash2(i, j + n, 7313)) * z;
          const L = z * 0.32, off = (ph - 0.5) * z * 0.6;
          ctx.moveTo(px + sx * off, py + sy * off); ctx.lineTo(px + sx * (off + L), py + sy * (off + L));
        }
        ctx.stroke();
      } else if (st === 4 && z > 10) { // glossy wet mud
        ctx.fillStyle = 'rgba(200,210,214,0.22)'; ctx.fillRect(X + hash2(i, j, 7321) * z * 0.6, Y + hash2(j, i, 7322) * z * 0.7, z * 0.3, z * 0.08);
      } else if (st === 5 && z > 10) { // cracked silt
        ctx.strokeStyle = 'rgba(120,100,70,0.35)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(X + z * 0.1, Y + z * hash2(i, j, 7331)); ctx.lineTo(X + z * 0.5, Y + z * 0.5); ctx.lineTo(X + z * hash2(j, i, 7332), Y + z * 0.9); ctx.stroke();
      }
    }
    // the spill through the gates while it's open: mint foam pouring out of the sill onto the first tiles
    if (b.slOpen) {
      const d0 = sluiceSides(b.x, b.y, b.mdAxis);
      if (d0) for (const t of d0[1]) {
        const i = t % W, j = (t / W) | 0, X = ox + (i + 0.5) * z, Y = oy + (j + 0.5) * z;
        const g = ctx.createRadialGradient(X, Y, 0, X, Y, z * 0.7);
        g.addColorStop(0, 'rgba(232,255,246,0.8)'); g.addColorStop(1, 'rgba(184,255,232,0)');
        ctx.fillStyle = g; ctx.fillRect(X - z * 0.7, Y - z * 0.7, z * 1.4, z * 1.4);
      }
    }
  }
  ctx.restore();
}

/** The side Sluice b's water is on (n, s, e or w): which of its rendered looks it shows (the menu's icon: n). */
function sluiceDir(b) {
  if (!b || b.x === undefined) return 'n';
  const sd = sluiceSides(b.x, b.y, b.mdAxis), w = sd && sd[0][0];
  if (w === undefined) return b.mdAxis === 'ns' ? 'w' : 'n';
  const i = w % S.W, j = (w / S.W) | 0;
  return b.mdAxis === 'ns' ? (i < b.x ? 'w' : 'e') : (j < b.y ? 'n' : 's');
}

/**
 * A Sluice, Sap Head or Sap Exit (drawBuilding, built): its rendered art where it's loaded (a Sluice's open gates; the Sap
 * Head's working loop while it digs), else drawn in code. True: drawn.
 */
function t4DrawBuilding(ctx, type, cx, cy, s, owner, b) {
  const col = PLAYER_COLORS[owner] || '#9aa2ab', t = R.time || 0;
  if (type === 'sluice') {
    const ns = b && b.mdAxis === 'ns', open = b && b.slOpen, dir = sluiceDir(b);
    const art = artFor(`sluice-${dir}${open ? '-open' : ''}`, owner) || artFor(`sluice-${dir}`, owner);
    if (art) { drawArt(ctx, art, cx, cy, s); return true; }
    // code: a concrete sill two tiles long, piers, three radial gates (raised while open), the spillway mint, team stripe
    const L = s * 0.64, Wd = s * 0.24;
    ctx.save(); ctx.translate(cx, cy); if (ns) ctx.rotate(Math.PI / 2);
    ctx.fillStyle = 'rgba(10,8,6,0.3)'; ctx.fillRect(-L + s * 0.04, -Wd + s * 0.05, L * 2, Wd * 2);
    ctx.fillStyle = todColor('#9d9a92'); ctx.fillRect(-L, -Wd, L * 2, Wd * 2);
    ctx.fillStyle = todColor('#7d7a74'); ctx.fillRect(-L, Wd * 0.4, L * 2, Wd * 0.6);
    for (let k = 0; k < 4; k++) { const px = -L + (k / 3) * L * 2; ctx.fillStyle = todColor('#b8b4aa'); ctx.fillRect(px - s * 0.04, -Wd * 1.25, s * 0.08, Wd * 2.3); }
    for (let k = 0; k < 3; k++) {
      const px = -L + ((k + 0.5) / 3) * L * 2, lift = open ? Wd * 0.8 : 0;
      ctx.fillStyle = todColor('#5a6066'); ctx.beginPath(); ctx.ellipse(px, -lift, s * 0.17, Wd * 0.55, 0, Math.PI, 0); ctx.fill();
      if (open) { ctx.fillStyle = 'rgba(184,255,232,0.75)'; ctx.fillRect(px - s * 0.13, Wd * 0.2, s * 0.26, Wd * 1.1 + Math.sin(t * 9 + k) * s * 0.02); }
    }
    ctx.fillStyle = T4_COL.sluice; ctx.fillRect(-L, -Wd * 0.08, L * 2, Wd * 0.12);
    ctx.fillStyle = col; ctx.fillRect(-L, -Wd, L * 2, Wd * 0.16);
    ctx.restore();
    return true;
  }
  if (type === 'saphead') {
    const working = b && b.working, art = artFor(`saphead-f${working ? Math.floor(t * 3) % 4 : 0}`, owner) || artFor('saphead-f0', owner);
    if (art) { drawArt(ctx, art, cx, cy, s); return true; }
    // code: a hut of shoring timbers over the bore, a spoil heap, the conveyor, the tunnel lamp
    ctx.save();
    ctx.fillStyle = 'rgba(10,8,6,0.3)'; ctx.fillRect(cx - s * 0.36, cy - s * 0.26, s * 0.78, s * 0.66);
    ctx.fillStyle = todColor('#6b5a46'); ctx.fillRect(cx - s * 0.38, cy - s * 0.3, s * 0.76, s * 0.62);
    ctx.fillStyle = todColor('#3a332c'); ctx.fillRect(cx - s * 0.2, cy - s * 0.1, s * 0.4, s * 0.36);
    ctx.strokeStyle = todColor('#8c7656'); ctx.lineWidth = Math.max(1, s * 0.04);
    for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(cx - s * 0.38 + k * s * 0.25, cy - s * 0.3); ctx.lineTo(cx - s * 0.38 + k * s * 0.25, cy + s * 0.32); ctx.stroke(); }
    ctx.fillStyle = todColor('#7a6a58'); ctx.beginPath(); ctx.ellipse(cx + s * 0.3, cy + s * 0.25, s * 0.18, s * 0.12, 0, 0, Math.PI * 2); ctx.fill();
    const on = working ? 0.75 + 0.25 * Math.sin(t * 6) : 0.6;
    ctx.fillStyle = `rgba(255,163,140,${on})`; ctx.beginPath(); ctx.arc(cx - s * 0.26, cy - s * 0.22, s * 0.06, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = col; ctx.fillRect(cx - s * 0.38, cy + s * 0.32, s * 0.76, s * 0.05);
    ctx.restore();
    return true;
  }
  if (type === 'sapexit') {
    const art = artFor('sapexit', owner);
    if (art) { drawArt(ctx, art, cx, cy, s); return true; }
    ctx.save();
    ctx.fillStyle = todColor('#7a6650'); ctx.beginPath(); ctx.ellipse(cx, cy + s * 0.05, s * 0.42, s * 0.34, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#17120f'; ctx.beginPath(); ctx.ellipse(cx, cy + s * 0.05, s * 0.24, s * 0.18, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = todColor('#a08460'); ctx.lineWidth = Math.max(1.5, s * 0.05);
    ctx.beginPath(); ctx.ellipse(cx, cy + s * 0.05, s * 0.27, s * 0.21, 0, Math.PI, 0); ctx.stroke();
    ctx.fillStyle = T4_COL.sap; ctx.beginPath(); ctx.arc(cx + s * 0.25, cy - s * 0.12, s * 0.05, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = col; ctx.fillRect(cx - s * 0.3, cy + s * 0.34, s * 0.6, s * 0.05);
    ctx.restore();
    return true;
  }
  return false;
}

/**
 * Over the graded ground (render): your saps' routes (sapSeen: yours only), dashed in the tunnel-lamp salmon, solid
 * where dug, the head ringed; the plan being made; and the tremors you feel, rings spreading where the ground shook.
 */
function t4Marks(ctx, ox, oy, z, v0, v1) {
  ctx.save();
  const route = (h, list, dug, plan) => {
    let px = ox + (h.x + 0.5) * z, py = oy + (h.y + 0.5) * z;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let k = 0; k < list.length; k++) {
      const t = list[k], x = ox + ((t % S.W) + 0.5) * z, y = oy + (((t / S.W) | 0) + 0.5) * z, done = k < dug;
      ctx.strokeStyle = done ? 'rgba(255,163,140,0.95)' : plan ? 'rgba(255,209,102,0.9)' : 'rgba(255,163,140,0.6)';
      ctx.lineWidth = Math.max(1.5, z * (done ? 0.09 : 0.06)); ctx.setLineDash(done ? [] : [z * 0.18, z * 0.14]); ctx.lineDashOffset = done ? 0 : -(R.time || 0) * z * 0.3;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x, y); ctx.stroke();
      px = x; py = y;
    }
    ctx.setLineDash([]);
    const hd = dug > 0 && dug <= list.length ? list[dug - 1] : -1;
    if (hd >= 0 && dug < list.length) { // the head, ringed, a pulse as it bites
      const x = ox + ((hd % S.W) + 0.5) * z, y = oy + (((hd / S.W) | 0) + 0.5) * z, r = z * (0.32 + 0.06 * Math.sin((R.time || 0) * 5));
      ctx.strokeStyle = 'rgba(255,163,140,1)'; ctx.lineWidth = Math.max(1.5, z * 0.07); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    }
    if (list.length) { const e = list[list.length - 1], x = ox + ((e % S.W) + 0.5) * z, y = oy + (((e / S.W) | 0) + 0.5) * z; ctx.strokeStyle = 'rgba(255,163,140,0.85)'; ctx.lineWidth = Math.max(1, z * 0.04); ctx.strokeRect(x - z * 0.3, y - z * 0.3, z * 0.6, z * 0.6); }
  };
  for (const b of S.buildings) {
    if (b.dead || !BDEFS[b.type].saphead || !b.sap || !sapSeen(b, ME) || b.sap.exit) continue;
    route(b, b.sap.route, b.sap.dug, false);
  }
  const F = typeof UI !== 'undefined' && UI.tf;
  if (R.mode === 'terra' && F && F.tool === 'sap') {
    const h = getE(F.head);
    if (h) {
      route(h, F.list, 0, true);
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(2, z * 0.07); ctx.setLineDash([z * 0.12, z * 0.08]);
      ctx.strokeRect(ox + h.x * z + z * 0.04, oy + h.y * z + z * 0.04, z * 0.92, z * 0.92); ctx.setLineDash([]);
    }
  }
  // the earthworks your warbots are ordered to shoot (orderEwShoot): a coral reticle on the tile, its strength as a ring
  if (S.ewK) {
    const seen = new Set();
    for (const u of S.bots) {
      const t = u.task && u.task.type === 'ewshoot' && u.owner === ME && !u.dead ? u.task.tile : -1;
      if (t < 0 || seen.has(t) || !ewAt(t)) continue;
      seen.add(t);
      const i = t % S.W, j = (t / S.W) | 0;
      if (i < v0.x - 1 || i > v1.x + 1 || j < v0.y - 1 || j > v1.y + 1) continue;
      const x = ox + (i + 0.5) * z, y = oy + (j + 0.5) * z, r = z * (0.42 + 0.03 * Math.sin((R.time || 0) * 4)), lw = Math.max(1.5, z * 0.06);
      const left = S.ewH[t] / EW.kinds[EW_KINDS[S.ewK[t]]].hp;
      ctx.strokeStyle = 'rgba(20,10,10,0.55)'; ctx.lineWidth = lw + 2; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,90,110,0.95)'; ctx.lineWidth = lw; ctx.beginPath(); ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left); ctx.stroke();
      ctx.beginPath();
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ctx.moveTo(x + a * r * 0.55, y + b * r * 0.55); ctx.lineTo(x + a * r * 1.2, y + b * r * 1.2); }
      ctx.stroke();
      ctx.fillStyle = '#ffe9c2'; ctx.beginPath(); ctx.arc(x, y, Math.max(1.5, z * 0.05), 0, Math.PI * 2); ctx.fill();
    }
  }
  for (const r of S.tremors || []) {
    if (r.p !== ME) continue;
    const age = S.time - r.t;
    if (age < 0 || age > 10) continue;
    for (let k = 0; k < 3; k++) {
      const ph = ((R.time || 0) * 0.8 + k / 3) % 1, rr = z * (0.4 + ph * 2.2);
      ctx.strokeStyle = `rgba(255,190,90,${(1 - ph) * 0.8 * (1 - age / 10)})`; ctx.lineWidth = Math.max(1.5, z * 0.06);
      ctx.beginPath(); ctx.arc(ox + r.x * z, oy + r.y * z, rr, 0, Math.PI * 2); ctx.stroke();
    }
  }
  ctx.restore();
}

/** The minimap's colour of tile t with stage 4 on it: an earthwork darker earth (its owner's tinge), the flood blue, a groove dark. */
function t4MiniColor(t, c) {
  if (S.fld && S.fld[t] && S.fld[t] <= 3) return mixBiomeRGB(c, [60, 110, 150], 0.8);
  if (S.fld && S.fld[t] === 4) return mixBiomeRGB(c, [70, 52, 36], 0.6);
  const k = S.ewK ? S.ewK[t] : 0;
  if (k) return mixBiomeRGB(c, k === 3 ? [200, 196, 186] : k === 2 ? [50, 46, 44] : [120, 86, 60], 0.75);
  if (S.caveIn && S.caveIn[t]) return mixBiomeRGB(c, [60, 50, 48], 0.5);
  return c;
}

/** A stage 4 Earthworks site's ground as it's worked (tfSiteGround): the earthwork rising out of the ground with its progress. */
function t4SiteGround(ctx, b, x, y, z) {
  const J = b.tf, k = clamp(b.progress || 0, 0, 1);
  if (k <= 0 || J.k === 'cave') return;
  const kind = J.k === 'ewfix' ? J.n : EW.kinds[J.k] ? EW.kinds[J.k].k : 0;
  if (!kind) return;
  ctx.save(); ctx.globalAlpha = 0.25 + 0.75 * k;
  ewDraw(ctx, x, y, z, kind, ewJoins(b.x, b.y, kind), J.k === 'ewfix' ? 1 : k < 0.5 ? 2 : k < 0.85 ? 1 : 0, b.owner, tIdx(b.x, b.y), TF_SOIL[renderBiomeAt(tIdx(b.x, b.y))] || TF_SOIL.desert);
  ctx.restore();
}

/** A stage 4 job's glyph on its plan (tfPlanTile): a bank's arc, a trench's cut, the teeth, a cave-in's cross. */
function t4Glyph(ctx, k, cx, cy, s, both) {
  if (k === 'bank' || (k === 'ewfix')) { both([[cx - s * 1.2, cy + s * 0.5], [cx - s * 0.6, cy - s * 0.4], [cx + s * 0.6, cy - s * 0.4], [cx + s * 1.2, cy + s * 0.5]]); return true; }
  if (k === 'trench') { both([[cx - s * 1.2, cy - s * 0.6], [cx - s * 0.5, cy - s * 0.6], [cx - s * 0.5, cy + s * 0.6], [cx + s * 0.5, cy + s * 0.6], [cx + s * 0.5, cy - s * 0.6], [cx + s * 1.2, cy - s * 0.6]]); return true; }
  if (k === 'teeth') { for (const o of [-0.7, 0.7]) both([[cx + (o - 0.5) * s, cy + s * 0.5], [cx + o * s, cy - s * 0.6], [cx + (o + 0.5) * s, cy + s * 0.5]]); return true; }
  if (k === 'cave') { both([[cx - s * 0.8, cy - s * 0.8], [cx + s * 0.8, cy + s * 0.8]]); both([[cx + s * 0.8, cy - s * 0.8], [cx - s * 0.8, cy + s * 0.8]]); return true; }
  return false;
}

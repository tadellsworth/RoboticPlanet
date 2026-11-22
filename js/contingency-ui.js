'use strict';
/*
 * Terrafall: Contingency's screens (CONTINGENCY.md, Screens): the globe, the territory card, the Spend panel, the
 * battle cards, the year report and the new-run screen. The engine is js/contingency.js; this only shows a run and
 * passes the person's choices to it (contBuy*, contOrder, contEndTurn...), saving it to the Contingency slot after
 * each step (contStore).
 *
 * The globe is the menu planet's (js/menuplanet.js): its face is the atlas picture (mplMakeMap reads
 * art/lore/ithaca-map.webp), shaded per pixel into a small image as the menu planet's is, turned by drag, swipe or
 * the arrow keys, with each territory tinted by its owner and its borders drawn from the atlas's territory map
 * (CONT_CELLS). Markers over it: each territory's Uplink, home, Command Groups, fortifications and Murmur; the moon,
 * Argos, beside it with its two territories; the orders as arcs. Drawn only when something changed.
 *
 * openContingency() is the one way in (from the main menu's Contingency button, #m-contingency).
 */

const CGV = { maxRes: 560, turnKey: 0.18, tilt: 1.25, tint: 0.42, minR: 120 };
const CG = { coach: -1, run: null, on: false, yaw: 0, pitch: 0.3, sel: -1, group: 0, sheet: null, dirty: true, raf: 0, map: null, cells: null,
  geo: null, img: null, off: null, drag: null, v: { w: 0, h: 0, dpr: 1, cx: 0, cy: 0, r: 100, moon: null }, note: '', battleAt: 0, marks: [] };
const CG_RES_ICON = { ore: 'Ore', fiber: 'Fiber', stone: 'Stone', crude: 'Crude', fuel: 'Fuel', crystal: 'Crystal' };
const CG_REGION_SHAPES_NOTE = 'Each battle is a Terrafall match on the territory\'s ground.';

/** The one way in: the main menu's Contingency button. Continue a run, or start one. */
function openContingency() {
  if (typeof audioUnlock === 'function') audioUnlock();
  const scr = $('screen-contingency');
  scr.hidden = false;
  $('screen-menu').hidden = true;
  CG.on = true;
  cgInit();
  const run = contRestore();
  CG.run = run && run.phase !== 'over' ? run : null;
  if (CG.run) { cgFace(CG.run.sides[0].home); cgAfter(); } else cgSheet('new');
  cgMusic();
  cgResize();
  cgLoop();
}
/** Back to the main menu (the run is saved already). */
function closeContingency() {
  $('screen-contingency').hidden = true;
  $('screen-menu').hidden = false;
  CG.on = false; CG.sheet = null;
  cancelAnimationFrame(CG.raf);
  if (typeof musicLore === 'function') { MUSIC.loreLevel = null; musicLore(false); }
}
/** Is the globe showing (main.js then skips drawing the demo game behind it)? */
function contCovers() { return CG.on; }

let _cgReady = false;
function cgInit() {
  if (_cgReady) return;
  _cgReady = true;
  const c = $('cg-globe');
  CG.g = c.getContext('2d');
  // the territory map: one byte a spot, from the atlas's run-length rows
  const W = CONT_CELLS.w, H = CONT_CELLS.h, cells = new Int8Array(W * H), ALPHA = 'abcdefghijklmnopqrstuvwxyzAB';
  CONT_CELLS.rows.forEach((row, j) => {
    let i = 0;
    for (const m of row.matchAll(/([a-zA-Z.])(\d+)/g)) { const v = m[1] === '.' ? -1 : ALPHA.indexOf(m[1]); for (let k = 0; k < +m[2]; k++) cells[j * W + i++] = v; }
  });
  CG.cells = cells;
  window.addEventListener('resize', () => { if (CG.on) cgResize(); });
  c.addEventListener('pointerdown', cgDown);
  c.addEventListener('pointermove', cgMove);
  c.addEventListener('pointerup', cgUp);
  c.addEventListener('pointercancel', () => { CG.drag = null; });
  c.addEventListener('wheel', (e) => { e.preventDefault(); CG.yaw += e.deltaX * 0.004; CG.pitch = clamp(CG.pitch - e.deltaY * 0.003, -CGV.tilt, CGV.tilt); CG.dirty = true; }, { passive: false });
  document.addEventListener('keydown', cgKey);
  $('cg-end').onclick = () => cgEndTurn();
  $('cg-spend').onclick = () => { sfx('click'); cgSheet('spend'); };
  $('cg-report').onclick = () => { sfx('click'); cgSheet('report'); };
  $('cg-exit').onclick = () => { sfx('click'); closeContingency(); };
  $('cg-help').onclick = () => { sfx('click'); cgHelp(); };
  $('cg-battles').onclick = () => { sfx('click'); cgSheet('battle'); };
}
function cgHelp() {
  showHelp();
  helpPage('hs-contingency');
}

/** The campaign theme, at Contingency's place in the story (missions 7 to 10 of CAMPAIGN.md), darkening year by year. */
function cgMusic() {
  if (typeof musicLore !== 'function' || typeof MUSIC === 'undefined') return;
  const t = CG.run ? CG.run.turn : 1;
  MUSIC.loreLevel = 6 / 14 + (3 / 14) * Math.min(1, (t - 1) / 30);
  musicLore(true);
}

/* ------------------------------------------------------------------ the globe */

function cgResize() {
  const c = $('cg-globe'), dpr = Math.min(2, window.devicePixelRatio || 1), w = c.clientWidth || window.innerWidth, h = c.clientHeight || window.innerHeight;
  c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
  const top = $('cg-top').offsetHeight + 8, foot = $('cg-foot').offsetHeight + 8, side = w >= 760 && !$('cg-card').hidden ? 360 : 0;
  const cardUp = w < 760 && !$('cg-card').hidden ? Math.min($('cg-card').offsetHeight, h * 0.46) : 0;
  const aw = w - side, ah = h - top - foot - cardUp;
  const r = Math.max(CGV.minR * 0.6, Math.min(aw * 0.4, ah * 0.42));
  CG.v = { w, h, dpr, cx: aw / 2, cy: top + ah / 2 + r * 0.06, r, moon: { x: aw / 2 + r * 0.98, y: top + ah / 2 - r * 0.78, r: Math.max(18, Math.min(60, r * 0.17)) } };
  if (CG.v.moon.x + CG.v.moon.r > aw - 6) CG.v.moon.x = aw - 6 - CG.v.moon.r;
  if (CG.v.moon.y - CG.v.moon.r < top + 4) CG.v.moon.y = top + 4 + CG.v.moon.r;
  CG.dirty = true;
}
/** Turn the globe to face territory t. */
function cgFace(t) {
  if (t < 0 || contIsArgos(t)) return;
  const T = CONT_MAP.T[t];
  CG.yaw = T.lon * Math.PI / 180; CG.pitch = clamp(T.lat * Math.PI / 180, -CGV.tilt, CGV.tilt); CG.dirty = true;
}
function cgLoop() {
  cancelAnimationFrame(CG.raf);
  const step = () => {
    if (!CG.on) return;
    if (!CG.map) { CG.map = mplMakeMap(); }
    if (!CG.map.done) { CG.map.step(6); if (CG.map.done) CG.dirty = true; }
    const battling = CG.run && CG.run.battles.some((b) => !b.result);
    if (CG.dirty || battling) { CG.dirty = false; cgDraw(); }
    CG.raf = requestAnimationFrame(step);
  };
  CG.raf = requestAnimationFrame(step);
}
/** Where (lon, lat in degrees) is on screen now: { x, y, z } (z > 0 faces you). */
function cgProject(lon, lat) {
  const la = lat * Math.PI / 180, d = lon * Math.PI / 180 - CG.yaw, cp = Math.cos(CG.pitch), sp = Math.sin(CG.pitch);
  const X = Math.cos(la) * Math.sin(d), Y = Math.sin(la), Z = Math.cos(la) * Math.cos(d);
  const y = Y * cp - Z * sp, z = Y * sp + Z * cp, V = CG.v;
  return { x: V.cx + X * V.r, y: V.cy - y * V.r, z };
}
/** The point of the globe under screen (x, y): { lon, lat } in degrees, or null off the globe. */
function cgUnproject(x, y) {
  const V = CG.v, u = (x - V.cx) / V.r, v = -(y - V.cy) / V.r, rr = u * u + v * v;
  if (rr > 1) return null;
  const z = Math.sqrt(1 - rr), cp = Math.cos(CG.pitch), sp = Math.sin(CG.pitch);
  const Y = v * cp + z * sp, Z = -v * sp + z * cp;
  let lon = (Math.atan2(u, Z) + CG.yaw) * 180 / Math.PI;
  lon = ((lon + 180) % 360 + 360) % 360 - 180;
  return { lon, lat: Math.asin(clamp(Y, -1, 1)) * 180 / Math.PI };
}
function cgCellAt(lon, lat) {
  const W = CONT_CELLS.w, H = CONT_CELLS.h, i = Math.min(W - 1, Math.floor((lon + 180) / 360 * W)), j = Math.min(H - 1, Math.max(0, Math.floor((90 - lat) / 180 * H)));
  return CG.cells[j * W + i];
}
function cgColor(s) { return s >= 0 && CG.run ? CONT_CS_COLORS[CG.run.sides[s].cs] : '#8a8f99'; }
function cgRgb(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }

/** The move targets of the selected group (each territory index it may be ordered to). */
function cgTargets() {
  const run = CG.run, g = run && CG.group ? contGroup(run, CG.group) : null;
  if (!g || g.side !== 0 || run.phase !== 'plan') return new Set();
  const out = new Set(contMovesFrom(run, 0, g.at).filter((m) => contMayEnter(run, 0, m.to)).map((m) => m.to));
  const path = run.orders[g.id];
  if (run.sides[0].silent === g.id && path && path.length === 1 && run.t[path[0]].owner === 0) for (const m of contMovesFrom(run, 0, path[0])) if (contMayEnter(run, 0, m.to)) out.add(m.to);
  return out;
}

function cgDraw() {
  const V = CG.v, g = CG.g, dpr = V.dpr, run = CG.run;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, V.w, V.h);
  // the sphere: shaded per pixel into a small image, drawn smoothly at its size
  const n = Math.max(64, Math.min(CGV.maxRes, Math.round(V.r * 2 * Math.min(dpr, 1.5))));
  if (!CG.off || CG.off.width !== n) { CG.off = document.createElement('canvas'); CG.off.width = CG.off.height = n; CG.img = CG.off.getContext('2d').createImageData(n, n); }
  const px = CG.img.data, M = CG.map, TW = M ? M.W : 1, TH = M ? M.H : 1, CW = CONT_CELLS.w, CH = CONT_CELLS.h, cells = CG.cells;
  const cp = Math.cos(CG.pitch), sp = Math.sin(CG.pitch), yaw = CG.yaw, PI = Math.PI;
  const tint = [], tAmt = [], targets = cgTargets(), sel = CG.sel;
  for (let t = 0; t < CONT_MAP.n; t++) {
    const T = run ? run.t[t] : null;
    tint[t] = T && T.owner >= 0 ? cgRgb(cgColor(T.owner)) : T && T.murmur ? [150, 90, 220] : null;
    tAmt[t] = T && T.owner >= 0 ? CGV.tint : T && T.murmur ? 0.08 * T.murmur : 0;
  }
  for (let j = 0; j < n; j++) {
    const v = -(((j + 0.5) / n) * 2 - 1);
    for (let i = 0; i < n; i++) {
      const u = ((i + 0.5) / n) * 2 - 1, rr = u * u + v * v, o = (j * n + i) * 4;
      if (rr > 1) { px[o + 3] = 0; continue; }
      const z = Math.sqrt(1 - rr), Y = v * cp + z * sp, Z = -v * sp + z * cp;
      const lat = Math.asin(Y);
      let lon = Math.atan2(u, Z) + yaw;
      lon = (lon / (2 * PI) + 0.5) % 1; if (lon < 0) lon += 1; // (0..1 from −180°)
      const ty = Math.min(TH - 1, Math.max(0, ((0.5 - lat / PI) * TH) | 0)), ti = ty * TW + ((lon * TW) | 0);
      let r = M ? M.tex[ti * 3] : 60, gg = M ? M.tex[ti * 3 + 1] : 90, b = M ? M.tex[ti * 3 + 2] : 110;
      // the territory here, and whether a border runs through this spot
      const fx = lon * CW, fy = (0.5 - lat / PI) * CH, ci = Math.min(CW - 1, fx | 0), cj = Math.min(CH - 1, Math.max(0, fy | 0));
      const t = cells[cj * CW + ci];
      if (t >= 0) {
        const ex = fx - ci, ey = fy - cj;
        let edge = false;
        if (ex < 0.2) { const q = cells[cj * CW + (ci + CW - 1) % CW]; edge = q >= 0 && q !== t; }
        else if (ex > 0.8) { const q = cells[cj * CW + (ci + 1) % CW]; edge = q >= 0 && q !== t; }
        if (!edge && ey < 0.2 && cj > 0) { const q = cells[(cj - 1) * CW + ci]; edge = q >= 0 && q !== t; }
        else if (!edge && ey > 0.8 && cj < CH - 1) { const q = cells[(cj + 1) * CW + ci]; edge = q >= 0 && q !== t; }
        const tc = tint[t];
        if (tc) { const a = tAmt[t]; r += (tc[0] - r) * a; gg += (tc[1] - gg) * a; b += (tc[2] - b) * a; }
        if (t === sel) { r = r * 1.18 + 18; gg = gg * 1.18 + 18; b = b * 1.18 + 18; }
        else if (targets.has(t)) { r = r * 1.08 + 26; gg = gg * 1.08 + 22; b = b * 1.04; }
        if (edge) {
          if (t === sel || targets.has(t)) { r = 255; gg = t === sel ? 255 : 220; b = t === sel ? 255 : 120; }
          else { r *= 0.45; gg *= 0.45; b *= 0.45; }
        }
      }
      // light from the upper left, a soft limb and a thin blue edge of air
      const lit = 0.5 + 0.55 * Math.max(0, -0.35 * u + 0.42 * v + 0.84 * z), limb = 1 - Math.pow(1 - z, 3) * 0.6;
      const k = lit * limb, air = Math.pow(1 - z, 4) * 0.7;
      px[o] = r * k + 90 * air; px[o + 1] = gg * k + 140 * air; px[o + 2] = b * k + 220 * air;
      px[o + 3] = 255 * Math.min(1, (1 - Math.sqrt(rr)) * n * 0.5);
    }
  }
  CG.off.getContext('2d').putImageData(CG.img, 0, 0);
  // a glow of air round it
  const glow = g.createRadialGradient(V.cx, V.cy, V.r * 0.96, V.cx, V.cy, V.r * 1.12);
  glow.addColorStop(0, 'rgba(110,170,255,0.32)'); glow.addColorStop(1, 'rgba(110,170,255,0)');
  g.fillStyle = glow; g.beginPath(); g.arc(V.cx, V.cy, V.r * 1.12, 0, PI * 2); g.fill();
  g.imageSmoothingEnabled = true;
  g.drawImage(CG.off, V.cx - V.r, V.cy - V.r, V.r * 2, V.r * 2);
  if (run) cgOverlay(g);
}

/** Markers, the moon and the orders' arcs, over the sphere. */
function cgOverlay(g) {
  const run = CG.run, V = CG.v, small = V.r < 190, marks = [];
  const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 260);
  // orbit: a dashed line from the launch sites to the moon
  run.t.forEach((T, t) => {
    if (!contLaunch(run, t)) return;
    const p = cgProject(CONT_MAP.T[t].lon, CONT_MAP.T[t].lat);
    if (p.z <= 0.05) return;
    g.save(); g.setLineDash([4, 5]); g.strokeStyle = 'rgba(200,220,255,0.45)'; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(V.moon.x, V.moon.y); g.stroke(); g.restore();
  });
  // the moon, Argos: its two territories as its two halves
  const Mo = V.moon;
  [CONT_MAP.ix.lunar, CONT_MAP.ix.silent].forEach((t, k) => {
    const T = run.t[t];
    g.beginPath(); g.moveTo(Mo.x, Mo.y - Mo.r); g.arc(Mo.x, Mo.y, Mo.r, -PI_2(), PI_2(), k === 0); g.closePath();
    g.fillStyle = '#7d7f86'; g.fill();
    if (T.owner >= 0) { g.fillStyle = cgColor(T.owner); g.globalAlpha = 0.45; g.fill(); g.globalAlpha = 1; }
    g.lineWidth = CG.sel === t ? 3 : cgTargets().has(t) ? 2.5 : 1;
    g.strokeStyle = CG.sel === t ? '#fff' : cgTargets().has(t) ? '#ffdc78' : 'rgba(255,255,255,0.35)'; g.stroke();
    marks.push({ t, x: Mo.x + (k === 0 ? -Mo.r * 0.45 : Mo.r * 0.45), y: Mo.y, r: Mo.r * 0.6 });
  });
  g.fillStyle = 'rgba(230,235,245,0.85)'; g.font = `600 ${small ? 10 : 11}px system-ui, sans-serif`; g.textAlign = 'center';
  g.fillText('Argos', Mo.x, Mo.y + Mo.r + 13);
  // the orders: arcs from where each group stands to where it goes
  for (const [id, path] of Object.entries(run.orders)) {
    const gr = contGroup(run, +id);
    if (!gr || gr.side !== 0) continue;
    let a = gr.at;
    for (const b of path) { cgArc(g, a, b, '#ffdc78'); a = b; }
  }
  // the battles waiting
  for (const b of run.battles) if (!b.result) {
    const p = cgSpot(b.at);
    if (!p) continue;
    g.strokeStyle = `rgba(255,90,90,${0.5 + 0.5 * pulse})`; g.lineWidth = 3;
    g.beginPath(); g.arc(p.x, p.y, 16 + 4 * pulse, 0, Math.PI * 2); g.stroke();
  }
  // each territory's marker: its owner's colour, an Uplink's diamond, a home's ring; groups above, forts below
  for (let t = 0; t < CONT_MAP.n; t++) {
    if (contIsArgos(t)) { cgMarker(g, t, cgSpot(t), small, marks, true); continue; }
    const p = cgSpot(t);
    if (!p) continue;
    cgMarker(g, t, p, small, marks, false);
  }
  // a group being dragged: a line from where it stands to the pointer
  const dg = CG.dragAt && CG.group ? contGroup(run, CG.group) : null, from = dg && cgSpot(dg.at);
  if (from) {
    const to = cgPick(CG.dragAt.x, CG.dragAt.y), ok = to >= 0 && cgTargets().has(to);
    g.strokeStyle = ok ? '#ffdc78' : 'rgba(255,255,255,0.6)'; g.lineWidth = 3; g.setLineDash(ok ? [] : [6, 5]);
    g.beginPath(); g.moveTo(from.x, from.y); g.lineTo(CG.dragAt.x, CG.dragAt.y); g.stroke(); g.setLineDash([]);
    g.fillStyle = cgColor(0); g.beginPath(); g.arc(CG.dragAt.x, CG.dragAt.y, 7, 0, Math.PI * 2); g.fill();
  }
  CG.marks = marks;
}
function PI_2() { return Math.PI / 2; }
/** Where territory t's marker sits now ({ x, y, z }), or null when it's round the back. */
function cgSpot(t) {
  const V = CG.v, T = CONT_MAP.T[t];
  if (contIsArgos(t)) { const k = T.id === 'lunar' ? -1 : 1; return { x: V.moon.x + k * V.moon.r * 0.45, y: V.moon.y, z: 1 }; }
  const p = T.id === 'hollow' ? cgProject(T.lon + 4, T.lat - 9) : cgProject(T.lon, T.lat);
  return p.z > 0.12 ? p : null;
}
function cgArc(g, a, b, col) {
  const A = cgSpot(a), B = cgSpot(b);
  if (!A || !B) return;
  const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2 - Math.hypot(B.x - A.x, B.y - A.y) * 0.25;
  g.strokeStyle = col; g.lineWidth = 2.5; g.setLineDash([]);
  g.beginPath(); g.moveTo(A.x, A.y); g.quadraticCurveTo(mx, my, B.x, B.y); g.stroke();
  const ang = Math.atan2(B.y - my, B.x - mx);
  g.fillStyle = col; g.beginPath(); g.moveTo(B.x, B.y);
  g.lineTo(B.x - 10 * Math.cos(ang - 0.4), B.y - 10 * Math.sin(ang - 0.4)); g.lineTo(B.x - 10 * Math.cos(ang + 0.4), B.y - 10 * Math.sin(ang + 0.4)); g.fill();
}
function cgMarker(g, t, p, small, marks, moon) {
  if (!p) return;
  const run = CG.run, T = run.t[t], R = small ? 6 : 7.5, col = T.owner >= 0 ? cgColor(T.owner) : '#3a3f4a', hollow = t === CONT_MAP.hollow;
  if (hollow) {
    g.strokeStyle = T.murmur ? '#c79bff' : '#6b6f78'; g.lineWidth = 2; g.setLineDash([3, 3]);
    g.beginPath(); g.arc(p.x, p.y, R + 3, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
  } else if (T.uplink) {
    g.beginPath(); g.moveTo(p.x, p.y - R - 2); g.lineTo(p.x + R + 1, p.y); g.lineTo(p.x, p.y + R + 2); g.lineTo(p.x - R - 1, p.y); g.closePath();
    g.fillStyle = col; g.fill(); g.lineWidth = 2; g.strokeStyle = '#9ff0ff'; g.stroke();
  } else {
    g.beginPath(); g.arc(p.x, p.y, R, 0, Math.PI * 2); g.fillStyle = col; g.fill();
    g.lineWidth = 1.5; g.strokeStyle = 'rgba(0,0,0,0.6)'; g.stroke();
  }
  if (T.home >= 0) { g.strokeStyle = cgColor(T.home); g.lineWidth = 2; g.beginPath(); g.arc(p.x, p.y, R + 4.5, 0, Math.PI * 2); g.stroke(); }
  if (T.special && !hollow) { g.fillStyle = T.special === 'trade' ? '#8cffaa' : '#ffe27a'; g.beginPath(); g.arc(p.x + R + 3, p.y - R, 3, 0, Math.PI * 2); g.fill(); }
  // forts: pips below
  for (let k = 0; k < contFortOf(run, t); k++) { g.fillStyle = '#e8e2d0'; g.fillRect(p.x - 7 + k * 5, p.y + R + 3, 4, 4); }
  // the Murmur: violet dots on the left
  for (let k = 0; k < T.murmur && !hollow; k++) { g.fillStyle = '#c08cff'; g.beginPath(); g.arc(p.x - R - 4, p.y - 4 + k * 5, 2, 0, Math.PI * 2); g.fill(); }
  if (T.mega) { g.fillStyle = '#ffffff'; g.font = '700 10px system-ui, sans-serif'; g.textAlign = 'left'; g.fillText('◆', p.x + R + 1, p.y + R + 6); }
  // the groups: a pill each side, with its stars
  const sides = [0, 1, 2, 3].filter((s) => run.groups.some((x) => x.at === t && x.side === s));
  sides.forEach((s, k) => {
    const gs = run.groups.filter((x) => x.at === t && x.side === s), best = Math.max(...gs.map((x) => x.stars));
    const label = (gs.length > 1 ? gs.length + '×' : '') + '★' + best, w = 9 + label.length * 6.2, x = p.x - w / 2 + (k - (sides.length - 1) / 2) * (w + 3), y = p.y - R - 17;
    g.fillStyle = cgColor(s); g.globalAlpha = 0.95;
    g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, 13, 6); else g.rect(x, y, w, 13); g.fill(); g.globalAlpha = 1;
    if (s === 0 && gs.some((x) => x.id === CG.group)) { g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke(); }
    if (s === 0) marks.push({ t, x: x + w / 2, y: y + 6.5, r: 14, pill: true });
    g.fillStyle = '#071018'; g.font = '700 10px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(label, x + w / 2, y + 10);
  });
  // the name: all of them on a big globe, the picked one and the move targets on a small one
  const name = CONT_MAP.T[t].name;
  if (!moon && (!small || t === CG.sel || cgTargets().has(t))) {
    g.font = `${t === CG.sel ? 700 : 500} ${small ? 10 : 11}px system-ui, sans-serif`; g.textAlign = 'center';
    g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.75)'; g.strokeText(name, p.x, p.y + R + 16); g.fillStyle = '#f3efe4'; g.fillText(name, p.x, p.y + R + 16);
  }
  marks.push({ t, x: p.x, y: p.y, r: R + 8 });
}

/* ------------------------------------------------------------------ turning and tapping */

/** Where a pointer event is on the globe's canvas (css px). */
function cgAt(e) { const r = $('cg-globe').getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
/** The territory under (x, y): a marker first, then the globe's own cells. */
function cgPick(x, y) {
  let t = -1, best = 1e9;
  for (const m of CG.marks) { const d = Math.hypot(m.x - x, m.y - y); if (d < m.r && d < best) { best = d; t = m.t; } }
  if (t < 0) { const q = cgUnproject(x, y); if (q) t = cgCellAt(q.lon, q.lat); }
  return t;
}
/**
 * A press on the globe: on one of your groups' pills (or the marker of a territory where you have one), it picks the
 * group up, to drag onto a neighbour; anywhere else it turns the globe.
 */
function cgDown(e) {
  if (!CG.run) return;
  $('cg-globe').setPointerCapture(e.pointerId);
  const p = cgAt(e);
  let grab = null;
  if (CG.run.phase === 'plan') {
    const hit = CG.marks.filter((m) => Math.hypot(m.x - p.x, m.y - p.y) < m.r).sort((a, b) => (b.pill ? 1 : 0) - (a.pill ? 1 : 0))[0];
    const gs = hit ? contGroupAt(CG.run, hit.t, 0) : [];
    if (gs.length) grab = (gs.find((g) => g.id === CG.group) || gs.find((g) => !CG.run.orders[g.id]) || gs[0]).id;
  }
  CG.drag = { x: e.clientX, y: e.clientY, yaw: CG.yaw, pitch: CG.pitch, moved: false, grab };
}
function cgMove(e) {
  const D = CG.drag;
  if (!D) return;
  const dx = e.clientX - D.x, dy = e.clientY - D.y;
  if (!D.moved && Math.hypot(dx, dy) < 7) return;
  D.moved = true;
  if (D.grab) { CG.group = D.grab; CG.dragAt = cgAt(e); CG.dirty = true; return; }
  CG.yaw = D.yaw - dx / CG.v.r; CG.pitch = clamp(D.pitch + dy / CG.v.r, -CGV.tilt, CGV.tilt); CG.dirty = true;
}
function cgUp(e) {
  const D = CG.drag; CG.drag = null;
  if (!D) return;
  const p = cgAt(e);
  if (D.grab && D.moved) {
    // a group dropped: on a territory it may move to, the order; anywhere else, nothing
    CG.dragAt = null; CG.dirty = true;
    const t = cgPick(p.x, p.y), gr = contGroup(CG.run, D.grab);
    if (gr && t >= 0 && cgTargets().has(t)) { CG.sel = gr.at; cgTap(t); return; }
    if (gr && t === gr.at) { cgTap(t); return; }
    CG.note = 'Drop a Command Group on a highlighted territory to move it there.'; CG.sel = gr ? gr.at : CG.sel; cgSync();
    return;
  }
  if (D.moved) return;
  cgTap(cgPick(p.x, p.y));
}
function cgKey(e) {
  if (!CG.on || e.defaultPrevented || $('screen-contingency').hidden || !$('screen-help').hidden) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    if (CG.sheet && CG.sheet !== 'new' && CG.sheet !== 'battle') cgSheet(null);
    else if (CG.sheet === 'new' && CG.run) cgSheet(null);
    else if (CG.group) { CG.group = 0; cgSync(); }
    else if (CG.sel >= 0) { CG.sel = -1; cgSync(); }
    else closeContingency();
    return;
  }
  if (CG.sheet || /^(INPUT|SELECT|TEXTAREA)$/.test((e.target && e.target.tagName) || '')) return;
  const k = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
  if (!k) return;
  e.preventDefault();
  CG.yaw += k[0] * CGV.turnKey; CG.pitch = clamp(CG.pitch + k[1] * CGV.turnKey, -CGV.tilt, CGV.tilt); CG.dirty = true;
}
/** A tap on territory t (or on nothing: -1): with a group picked, a move order there; else the territory's card. */
function cgTap(t) {
  const run = CG.run;
  if (CG.group && t >= 0 && run.phase === 'plan') {
    const gr = contGroup(run, CG.group), targets = cgTargets();
    if (gr && targets.has(t)) {
      const path = run.orders[gr.id];
      const two = run.sides[0].silent === gr.id && path && path.length === 1 && !contMovesFrom(run, 0, gr.at).some((m) => m.to === t);
      if (contOrder(run, gr.id, two ? [path[0], t] : [t])) { sfx('click'); if (CG.coach === 1) cgCoach(2); CG.note = `Command Group ${gr.id} ordered to ${contName(t)}.`; CG.group = 0; cgSave(); cgSync(); return; }
      CG.note = 'That order can\'t be given (not enough Reserve for the launch?).';
    } else if (gr && t === gr.at) { contOrder(run, gr.id, []); CG.note = `Command Group ${gr.id} holds position.`; CG.group = 0; cgSave(); cgSync(); return; }
  }
  CG.sel = t; if (t < 0) CG.group = 0;
  cgSync();
}

/* ------------------------------------------------------------------ the bars and the territory card */

function cgSave() { if (CG.run) contStore(CG.run); }
/** After every step of the engine: save, redraw, and open what the person has to see or do next. */
function cgAfter() {
  const run = CG.run;
  cgSave(); cgMusic();
  if (!run) return;
  if (run.phase === 'over') { contForget(); cgSheet('over'); }
  else if (run.battles.some((b) => !b.result)) cgSheet('battle');
  else if (CG.showReport) { CG.showReport = false; cgSheet('report'); }
  else if (run.offers.length) cgSheet('offer');
  cgSync();
}

function cgSync() {
  const run = CG.run;
  CG.dirty = true;
  $('cg-top').hidden = $('cg-foot').hidden = !run;
  if (!run) { $('cg-card').hidden = true; return; }
  const S = run.sides[0], up = contUplinksToward(run, 0), leaders = [1, 2, 3].filter((s) => run.sides[s].alive && run.sides[s].streak > 0 && contAlly(run, 0) !== s);
  $('cg-clock').textContent = `T+${run.turn}`;
  $('cg-clock').title = `Arrival clock: T+${run.turn} (one turn is one year). ${run.window ? 'The window: the last turn.' : `The run ends at T+${CONT.lastTurn}${run.opts.turnCap ? '' : ' (turn cap off: it runs until someone wins)'}.`}`;
  $('cg-reserve').textContent = `${S.reserve}`;
  $('cg-reserve-inc').textContent = `+${contIncome(run, 0)}`;
  $('cg-uplinks').textContent = `${up}/5`;
  const count = S.streak ? `year ${S.streak} of ${CONT.uplinkYears}` : leaders.length ? `${contSideName(run, leaders[0])}: year ${run.sides[leaders[0]].streak} of ${CONT.uplinkYears}` : `hold ${CONT.uplinksToWin} for ${CONT.uplinkYears} years`;
  $('cg-upcount').textContent = count;
  $('cg-upchip').classList.toggle('warn', !!leaders.length);
  $('cg-upchip').classList.toggle('good', !!S.streak);
  $('cg-meter').style.setProperty('--m', `${Math.round(run.meter)}%`);
  $('cg-meter-v').textContent = Math.round(run.meter);
  const pend = run.battles.filter((b) => !b.result).length;
  $('cg-battles').hidden = !pend;
  $('cg-battles').textContent = `Battles: ${pend}`;
  $('cg-end').disabled = run.phase !== 'plan';
  $('cg-end').textContent = run.window ? 'End the last turn' : 'End turn';
  $('cg-spend').disabled = run.phase !== 'plan';
  const n = Object.keys(run.orders).length;
  $('cg-orders').textContent = n ? `${n} order${n > 1 ? 's' : ''}` : contGroups(run, 0).length ? 'No orders yet' : '';
  cgCard();
  cgResize();
}

/** The territory card: owner, income, specials, fortification, Murmur, megastructure, the groups there, the moves. */
function cgCard() {
  const run = CG.run, t = CG.sel, el = $('cg-card');
  if (!run || t < 0) { el.hidden = true; return; }
  el.hidden = false;
  const T = run.t[t], M = CONT_MAP.T[t], me = 0, plan = run.phase === 'plan', mine = T.owner === me;
  const owner = T.owner >= 0 ? `<b style="color:${cgColor(T.owner)}">${contSideName(run, T.owner)}</b>${T.owner === me ? ' (you)' : ` · ${PERSONALITIES[run.sides[T.owner].doctrine].name}`}` : t === CONT_MAP.hollow ? 'Nobody: the Murmur\'s lair' : 'Unheld';
  const region = CONT_REGIONS[M.region][0];
  const spec = [];
  if (T.uplink) spec.push('<b>Uplink</b> (hold 3 of the 5 for 3 years to win)');
  if (T.special === 'pathfinder') spec.push('<b>The Pathfinder\'s landing site</b>: orbital launch, the way to Argos');
  if (T.special === 'passenger') spec.push('<b>Passenger Town</b>: the empty town, the Arrival City site');
  if (T.special === 'trade') spec.push('<b>A Trade Post</b> (neutral): the Accord Ledger Deal');
  if (T.res) spec.push(`${CG_RES_ICON[T.res]}: every battle starts with more of it while you hold this`);
  if (T.home >= 0) spec.push(`Home of <b style="color:${cgColor(T.home)}">${contSideName(run, T.home)}</b>${T.home === me ? ': losing it costs a third of your Reserve' : ''}`);
  if (CONT_MAP.coastal[t]) spec.push('Coastal: a Port, for the sea crossings');
  if (contIsArgos(t)) spec.push('Reached only by orbit. No Murmur.');
  if (t === CONT_MAP.hollow) spec.push(run.hollowDone ? 'The Deep\'s mound was destroyed at T+' + run.hollowDone + '.' : 'An optional assault from Violet Reach: destroy the Deep\'s mound and every territory\'s Murmur falls to 0.');
  const inc = T.owner >= 0 ? contIncomeOf(run, t) : 0;
  const fort = contFortOf(run, t), mur = ['none', 'Quiet', 'Active', 'Active, with nests'][T.murmur];
  let h = `<header class="cg-card-head"><div><h3>${esc(M.name)}</h3><p class="cg-sub">${esc(region)} · ${owner}</p></div><button type="button" class="sheet-close" id="cg-card-x" aria-label="Close"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg></button></header>`;
  h += '<dl class="cg-facts">';
  if (T.owner >= 0) h += `<dt>Income</dt><dd>${inc >= 0 ? '+' : ''}${inc} Reserve a year</dd>`;
  h += `<dt>Fortification</dt><dd>${fort ? 'level ' + fort : 'none'}${T.mega === 'city' && T.fort < 3 ? ' (Arrival City)' : ''}${mine && plan && T.fort < CONT.maxFort ? ` <button type="button" class="btn small" data-act="fort">Fortify (${CONT.fortCost})</button>` : ''}</dd>`;
  if (!contIsArgos(t)) h += `<dt>The Murmur</dt><dd>${T.murmur ? `level ${T.murmur}: ${mur}` : 'none'}</dd>`;
  if (T.mega) h += `<dt>Megastructure</dt><dd><b>${CONT_MEGA[T.mega].name}</b>: ${CONT_MEGA[T.mega].desc}</dd>`;
  h += '</dl>';
  if (spec.length) h += `<ul class="cg-spec">${spec.map((s) => `<li>${s}</li>`).join('')}</ul>`;
  // the groups here
  const gs = contGroupAt(run, t);
  if (gs.length) {
    h += '<h4>Command Groups here</h4><ul class="cg-groups">';
    for (const gr of gs) {
      const ord = run.orders[gr.id], picked = CG.group === gr.id;
      const stars = '★'.repeat(gr.stars) + '☆'.repeat(CONT.maxStars - gr.stars);
      h += `<li class="${picked ? 'on' : ''}"><span class="cg-dot" style="background:${cgColor(gr.side)}"></span><span class="cg-gname">${gr.side === me ? 'Group ' + gr.id : contSideName(run, gr.side)} <span class="cg-stars" aria-label="${gr.stars} stars">${stars}</span> <small>${contWarbots(run, gr)} warbots</small>${ord ? `<small class="cg-ord"> → ${ord.map(contName).join(' → ')}</small>` : ''}</span>`;
      if (gr.side === me && plan) {
        h += `<button type="button" class="btn small ${picked ? 'primary' : ''}" data-act="pick" data-g="${gr.id}">${picked ? 'Tap where to' : 'Move'}</button>`;
        if (ord) h += `<button type="button" class="btn small ghost" data-act="hold" data-g="${gr.id}">Hold</button>`;
        if (run.sides[0].cards.includes('silent') && run.sides[0].silent == null) h += `<button type="button" class="btn small ghost" data-act="silent" data-g="${gr.id}" title="Silent Running: this group moves two borders this turn">Silent Running</button>`;
      }
      h += '</li>';
    }
    h += '</ul>';
  }
  if (mine && plan && contCanBuyGroup(run, me)) h += `<p><button type="button" class="btn small" data-act="buy">Ready a Command Group here (${CONT.groupCost})</button></p>`;
  // the neighbours, with odds for the picked group
  const links = CONT_MAP.links[t].filter((L) => L.kind !== 'orbit').concat(contLaunch(run, t) ? CONT_MAP.argos.map((m) => ({ to: m, kind: 'orbit' })) : []);
  if (contIsArgos(t)) run.t.forEach((X, i) => { if (contLaunch(run, i)) links.push({ to: i, kind: 'orbit' }); });
  const gr = CG.group ? contGroup(run, CG.group) : null, targets = cgTargets();
  h += '<h4>Borders</h4><ul class="cg-links">';
  for (const L of links) {
    const N = run.t[L.to], how = { land: '', sea: ` (by sea: ${L.sea || ''})`, orbit: ' (by orbit)', below: ' (down the Breach Fields)' }[L.kind];
    let odds = '';
    if (gr && targets.has(L.to)) { const o = contOddsAgainst(run, 0, gr, L.to); odds = ` <span class="cg-odds">${o >= 1 ? 'walk in' : Math.round(o * 100) + '%'}</span>`; }
    h += `<li><button type="button" class="cg-link ${targets.has(L.to) ? 'go' : ''}" data-act="to" data-t="${L.to}"><span class="cg-dot" style="background:${N.owner >= 0 ? cgColor(N.owner) : '#555'}"></span>${esc(contName(L.to))}${how}${odds}</button></li>`;
  }
  h += '</ul>';
  if (T.owner > 0 && plan) {
    const tr = contTruce(run, 0, T.owner), al = contAlly(run, 0) === T.owner;
    h += `<p class="cg-truce">${al ? 'Allied for the run.' : tr ? `Truce: ${tr.left} year${tr.left > 1 ? 's' : ''} left. <button type="button" class="btn small danger" data-act="break">Break the truce</button>` : `<button type="button" class="btn small" data-act="truce">Offer a truce</button>`}</p>`;
  }
  if (CG.note) h += `<p class="cg-note" role="status">${esc(CG.note)}</p>`;
  el.innerHTML = h;
  $('cg-card-x').onclick = () => { CG.sel = -1; CG.group = 0; cgSync(); };
  el.querySelectorAll('[data-act]').forEach((b) => { b.onclick = () => cgCardAct(b.dataset.act, +b.dataset.g || 0, b.dataset.t !== undefined ? +b.dataset.t : -1); });
}
function cgCardAct(act, gid, to) {
  const run = CG.run, t = CG.sel;
  sfx('click');
  CG.note = '';
  if (act === 'fort' && !contFortify(run, 0, t)) CG.note = `Fortifying costs ${CONT.fortCost} Reserve.`;
  if (act === 'buy' && contBuyGroup(run, 0, t)) CG.note = 'A Command Group stands ready here, at 1 star.';
  if (act === 'pick') { CG.group = CG.group === gid ? 0 : gid; if (CG.group) CG.note = 'Tap a highlighted territory to move there; tap this one again to hold.'; }
  if (act === 'hold') { contOrder(run, gid, []); CG.note = `Command Group ${gid} holds position.`; }
  if (act === 'silent' && contUseCard(run, 0, 'silent', gid)) { CG.group = gid; CG.note = 'Silent Running: order it to one of your territories, then on across one more border.'; }
  if (act === 'to') {
    if (CG.group && cgTargets().has(to)) { cgTap(to); return; }
    CG.sel = to; cgFace(to);
  }
  if (act === 'truce') {
    const r = run.t[t].owner, P = contTruceAnswer(run, r, 0, 99), price = P.price || 0;
    const A = contOfferTruce(run, 0, r, price);
    CG.note = `${contSideName(run, r)}: “${A.line}”${A.yes && price ? ` (${price} Reserve paid)` : ''}`;
  }
  if (act === 'break') contBreakTruce(run, 0, run.t[t].owner);
  cgSave(); cgSync();
}

/* ------------------------------------------------------------------ the sheets: new run, Spend, battles, report */

function cgSheet(kind) {
  CG.sheet = kind;
  const el = $('cg-sheet'), box = $('cg-sheet-box');
  el.hidden = !kind;
  if (!kind) { cgSync(); return; }
  const html = { new: cgNewRun, spend: cgSpend, battle: cgBattle, report: cgReport, offer: cgOffer, over: cgOver }[kind]();
  box.innerHTML = html;
  box.scrollTop = 0;
  box.querySelectorAll('[data-x]').forEach((b) => { b.onclick = () => cgSheetAct(b.dataset.x, b.dataset); });
  const first = box.querySelector('.cg-focus') || box.querySelector('button');
  if (first) first.focus({ preventScroll: true });
}

/** The new-run screen: Continue, or your callsign, the difficulty and the Advanced options. */
const CGN = { cs: 0, diff: 'normal', docs: ['random', 'random', 'random'], murmur: 'normal', events: true, cap: true, ironman: false, seed: '' };
function cgNewRun() {
  const saved = contRestore(), cont = saved && saved.phase !== 'over' ? saved : null;
  let h = '<header class="cg-sh-head"><h2>Contingency</h2><button type="button" class="btn small ghost" data-x="back">Back</button></header>';
  h += '<p class="cg-lede">Arrival clock: T+1. The Accord has been ruled void, and every vanguard\'s sealed orders open: <i>secure Ithaca I for us.</i> Take the planet territory by territory, one year a turn, until T+31.</p>';
  if (cont) h += `<button type="button" class="btn primary big cg-focus" data-x="continue">Continue: T+${cont.turn} · ${CONT_CS_NAMES[cont.sides[0].cs]} · ${contHeld(cont, 0).length} territories</button>`;
  h += '<h3>Your callsign</h3><div class="cg-cs" role="radiogroup" aria-label="Your callsign">';
  CONT_CS_NAMES.forEach((c, k) => {
    const C = CONT_CALLSIGNS[k], card = CONT_CARDS[C.card];
    h += `<button type="button" role="radio" aria-checked="${CGN.cs === k}" class="cg-cs-b ${CGN.cs === k ? 'on' : ''}" data-x="cs" data-k="${k}" style="--c:${CONT_CS_COLORS[k]}"><b>${c}</b><span>${C.perk}.</span><span><i>${card.name}:</i> ${card.desc}.</span></button>`;
  });
  h += '</div><h3>Difficulty</h3><div class="seg" role="radiogroup" aria-label="Difficulty">';
  for (const d of DIFF_ORDER) h += `<button type="button" role="radio" aria-checked="${CGN.diff === d}" class="${CGN.diff === d ? 'on' : ''}" data-x="diff" data-k="${d}">${DIFFICULTY[d].label}</button>`;
  h += `</div><p class="hint">It sets the rivals in battle, as in a normal match, and their income on the globe (×${CONT.rivalIncome[CGN.diff]}).</p>`;
  h += '<details class="cg-adv"><summary>Advanced</summary>';
  const others = [0, 1, 2, 3].filter((c) => c !== CGN.cs);
  others.forEach((c, k) => {
    h += `<label class="cg-row"><span>${CONT_CS_NAMES[c]}'s doctrine</span><select data-doc="${k}"><option value="random">Random</option>${CONT_DOCTRINES.map((d) => `<option value="${d}" ${CGN.docs[k] === d ? 'selected' : ''}>${docLabel(d)}</option>`).join('')}</select></label>`;
  });
  h += `<div class="cg-row"><span>The Murmur</span><div class="seg">${['off', 'normal', 'rampant'].map((m) => `<button type="button" class="${CGN.murmur === m ? 'on' : ''}" data-x="murmur" data-k="${m}">${m[0].toUpperCase() + m.slice(1)}</button>`).join('')}</div></div>`;
  h += `<label class="cg-row"><span>Events</span><input type="checkbox" id="cg-o-events" ${CGN.events ? 'checked' : ''}></label>`;
  h += `<label class="cg-row"><span>Turn cap (the run ends at T+31)</span><input type="checkbox" id="cg-o-cap" ${CGN.cap ? 'checked' : ''}></label>`;
  h += `<label class="cg-row"><span>Ironman (one save, no reloading a lost battle)</span><input type="checkbox" id="cg-o-iron" ${CGN.ironman ? 'checked' : ''}></label>`;
  h += `<label class="cg-row"><span>Run seed (blank: a new one)</span><input type="text" inputmode="numeric" id="cg-o-seed" value="${esc(CGN.seed)}" maxlength="10" size="10"></label>`;
  h += '</details>';
  h += `<button type="button" class="btn ${cont ? '' : 'primary'} big ${cont ? '' : 'cg-focus'}" data-x="start">${cont ? 'Start a new run (ends the one in progress)' : 'Start the run'}</button>`;
  return h;
}
function cgReadNew() {
  const box = $('cg-sheet-box');
  box.querySelectorAll('[data-doc]').forEach((s) => { CGN.docs[+s.dataset.doc] = s.value; });
  const ev = $('cg-o-events'); if (ev) { CGN.events = ev.checked; CGN.cap = $('cg-o-cap').checked; CGN.ironman = $('cg-o-iron').checked; CGN.seed = $('cg-o-seed').value.replace(/\D/g, ''); }
}

function cgSpend() {
  const run = CG.run, S = run.sides[0], held = contHeld(run, 0);
  let h = `<header class="cg-sh-head"><h2>Spend <small>Reserve ${S.reserve}</small></h2><button type="button" class="btn small cg-focus" data-x="close">Done</button></header>`;
  // Command Groups
  const n = contGroups(run, 0).length, cap = contGroupCap(run, 0);
  h += `<section><h3>Command Groups <small>${n} of ${cap}</small></h3><p class="hint">A reserve Command Base with its landing kit. You hold 2, +1 for every ${CONT.groupsPer} territories, never more than ${CONT.maxGroups}. A new one lands at 1 star.</p>`;
  h += `<div class="cg-buyrow"><select id="cg-buy-at" aria-label="Where it lands">${held.map((t) => `<option value="${t}" ${t === CG.sel ? 'selected' : ''}>${esc(contName(t))}</option>`).join('')}</select><button type="button" class="btn small" data-x="group" ${contCanBuyGroup(run, 0) ? '' : 'disabled'}>Ready one (${CONT.groupCost})</button></div></section>`;
  // Fortify
  h += `<section><h3>Fortify <small>${CONT.fortCost} a level, up to ${CONT.maxFort}</small></h3><p class="hint">Level 1: two turrets. Level 2: walls and a Keep. Level 3: a Shield Dome site and Mortar Pits. A fortified territory stops the Murmur spreading in.</p><ul class="cg-list">`;
  for (const t of held) h += `<li><span>${esc(contName(t))} <small>level ${run.t[t].fort}</small></span><button type="button" class="btn small" data-x="fort" data-t="${t}" ${run.t[t].fort >= CONT.maxFort || S.reserve < CONT.fortCost ? 'disabled' : ''}>+1</button></li>`;
  h += '</ul></section>';
  // Refits
  h += '<section><h3>Refits <small>for the whole run</small></h3><ul class="cg-list">';
  for (const [k, R] of Object.entries(CONT_REFITS)) {
    const own = S.refits.includes(k);
    h += `<li><span><b>${R.name}</b>: ${R.desc}.</span>${own ? '<small class="cg-own">Fitted</small>' : `<button type="button" class="btn small" data-x="refit" data-k="${k}" ${S.reserve < R.cost ? 'disabled' : ''}>${R.cost}</button>`}</li>`;
  }
  h += '</ul></section>';
  // Cards
  h += '<section><h3>Cards <small>one use each</small></h3><ul class="cg-list">';
  for (const k of contCardsFor(run, 0)) {
    const C = CONT_CARDS[k], cost = contCardCost(run, 0, k);
    h += `<li><span><b>${C.name}</b>${C.own !== undefined ? ' <small>(your callsign\'s)</small>' : ''}: ${C.desc}.${C.battle ? ' <small>Played in a battle.</small>' : ''}</span><button type="button" class="btn small" data-x="card" data-k="${k}" ${S.reserve < cost || S.cards.length >= 6 ? 'disabled' : ''}>${cost}</button></li>`;
  }
  h += '</ul>';
  if (S.cards.length) {
    h += '<h4>In hand</h4><ul class="cg-list">';
    S.cards.forEach((k, i) => {
      const C = CONT_CARDS[k];
      let use = '';
      if (C.globe === 'fort') use = `<select id="cg-use-${i}" aria-label="Target">${run.t.map((T, j) => j).filter((j) => run.t[j].owner > 0 && run.t[j].fort > 0 && run.t[j].mega !== 'dome' && !contFriends(run, 0, run.t[j].owner) && CONT_MAP.links[j].some((L) => run.t[L.to].owner === 0)).map((j) => `<option value="${j}">${esc(contName(j))} (level ${run.t[j].fort})</option>`).join('')}</select>`;
      if (C.globe === 'reseed') use = `<select id="cg-use-${i}" aria-label="Territory">${held.map((j) => `<option value="${j}">${esc(contName(j))}${run.t[j].murmur ? ' (Murmur ' + run.t[j].murmur + ')' : ''}</option>`).join('')}</select>`;
      const can = C.globe && C.globe !== 'silent';
      h += `<li><span><b>${C.name}</b>${C.globe === 'silent' ? ' <small>(use it from a group\'s card)</small>' : C.battle ? ' <small>(played from a battle card)</small>' : ''}</span>${use}${can ? `<button type="button" class="btn small" data-x="use" data-i="${i}">Use</button>` : ''}</li>`;
    });
    h += '</ul>';
  }
  h += '</section>';
  // Truces
  h += '<section><h3>The rivals</h3><ul class="cg-list">';
  for (let r = 1; r < 4; r++) {
    const R = run.sides[r], tr = contTruce(run, 0, r), al = contAlly(run, 0) === r;
    h += `<li><span><span class="cg-dot" style="background:${cgColor(r)}"></span><b>${contSideName(run, r)}</b> · ${docLabel(R.doctrine)} · ${R.alive ? `${contHeld(run, r).length} territories, ${contUplinks(run, r)} Uplinks` : 'carrier dark'}${al ? ' · <i>allied</i>' : tr ? ` · <i>truce, ${tr.left} years left</i>` : ''}</span>${R.alive && !tr && !al ? `<button type="button" class="btn small" data-x="truce" data-r="${r}">Offer a truce</button>` : ''}</li>`;
  }
  h += '</ul></section>';
  if (CG.note) h += `<p class="cg-note" role="status">${esc(CG.note)}</p>`;
  return h;
}

/** The battle card: where, who's in it, the kit, the odds, a card to play, and Play or Auto-resolve. */
function cgBattle() {
  const run = CG.run, b = run.battles.find((x) => !x.result);
  if (!b) { CG.sheet = null; return ''; }
  const T = run.t[b.at], M = CONT_MAP.T[b.at], setup = typeof contBattleSetup === 'function' ? contBattleSetup(run, b) : null;
  const kind = { assault: 'Assault', claim: 'Landing', murmur: 'Landing on Murmur ground', surge: 'Murmur surge: hold until dawn', hollow: 'The Hollow assault' }[b.kind];
  const left = run.battles.filter((x) => !x.result).length;
  let h = `<header class="cg-sh-head"><h2>Battle for ${esc(contName(b.at))}</h2><small>${left > 1 ? left + ' battles this year' : 'the last battle this year'}</small></header>`;
  h += `<p class="cg-sub">${kind} · ${esc(CONT_REGIONS[M.region][0])}${setup ? ` · ${esc(setup.shapeName)} · ${esc(setup.sizeName)} · ${setup.minutes}-minute cap` : ''}${T.murmur && b.kind !== 'surge' ? ` · Murmur level ${T.murmur}` : ''}</p>`;
  h += '<ul class="cg-sides">';
  b.sides.forEach((s, k) => {
    const pct = Math.round(b.odds[k] * 100);
    let who, kit = '';
    if (s === CONT_MURMUR) { who = 'The Murmur'; kit = b.kind === 'hollow' ? 'the Deep\'s mound, at full strength' : 'nests and packs'; }
    else {
      const gs = (b.groups[s] || []).map((id) => contGroup(run, id)).filter(Boolean);
      who = `${contSideName(run, s)}${s === 0 ? ' (you)' : ` · ${PERSONALITIES[run.sides[s].doctrine].name}`}${b.defender === s ? ' · defending' : ''}`;
      kit = gs.length ? gs.map((g) => `${'★'.repeat(g.stars)} ${contWarbots(run, g)} warbots`).join(', ') : 'the garrison only';
      if (b.defender === s && contFortOf(run, b.at)) kit += `; fortification level ${contFortOf(run, b.at)}`;
      if (b.cards[s]) kit += `; ${CONT_CARDS[b.cards[s]].name}`;
    }
    h += `<li><span class="cg-dot" style="background:${s === CONT_MURMUR ? '#a070e0' : cgColor(s)}"></span><span><b>${esc(who)}</b><small>${esc(kit)}</small></span><span class="cg-pct"><i style="width:${pct}%;background:${s === CONT_MURMUR ? '#a070e0' : cgColor(s)}"></i>${pct}%</span></li>`;
  });
  h += '</ul><p class="hint">The odds are auto-resolve\'s: a seeded roll on them, set a little below what playing it well gets you.</p>';
  const hand = run.sides[0].cards.filter((k) => CONT_CARDS[k].battle);
  if (hand.length && !b.cards[0]) h += `<div class="cg-buyrow"><select id="cg-bcard" aria-label="A card for this battle">${hand.map((k) => `<option value="${k}">${CONT_CARDS[k].name}</option>`).join('')}</select><button type="button" class="btn small" data-x="bcard">Play this card</button></div>`;
  const live = typeof contPlayBattle === 'function', resume = live && run.playing === b.id && contSavedBattle();
  h += `<div class="cg-btns"><button type="button" class="btn big ${live ? 'primary cg-focus' : ''}" data-x="play">${resume ? 'Resume the battle' : live ? 'Play' : 'Play (battles coming soon: auto-resolves for now)'}</button>${resume && run.opts.ironman ? '' : `<button type="button" class="btn big ${live ? '' : 'primary cg-focus'}" data-x="auto">Auto-resolve</button>`}</div>${resume && run.opts.ironman ? '<p class="hint">Ironman: this battle has begun, so it is played to its end (or withdrawn from).</p>' : ''}`;
  if (CG.lastBattle) h += `<p class="cg-note" role="status">${esc(CG.lastBattle)}</p>`;
  return h;
}

function cgReport() {
  const run = CG.run, R = run.reports[run.reports.length - 1];
  let h = `<header class="cg-sh-head"><h2>Year report${R ? ` <small>T+${R.turn}</small>` : ''}</h2><button type="button" class="btn small cg-focus" data-x="close">Continue</button></header>`;
  if (!R) return h + '<p class="cg-log">Arrival clock: T+1. No reports yet.</p>';
  h += cgLog(R.lines);
  if (run.reports.length > 1) h += `<details class="cg-adv"><summary>Earlier years</summary>${run.reports.slice(0, -1).reverse().map((r) => cgLog(r.lines)).join('<hr>')}</details>`;
  return h;
}
/** A report's lines as the log: its '§' lines as headings, a rival's quoted line set apart. */
function cgLog(lines) {
  return '<div class="cg-log">' + lines.map((l) => l.startsWith('§ ') ? `<h4>${esc(l.slice(2))}</h4>` : `<p${/: “/.test(l) ? ' class="cg-voice"' : ''}>${esc(l)}</p>`).join('') + '</div>';
}
function cgOffer() {
  const run = CG.run, O = run.offers[0];
  if (!O) return '';
  const what = O.kind === 'alliance' ? 'an alliance for the run (allied Command Groups next door join each other\'s battles, and your Uplinks count together, until a win is near)' : `a truce for ${CONT.truceTurns} years (neither side moves into the other's territory)`;
  return `<header class="cg-sh-head"><h2>${contSideName(run, O.from)} offers ${O.kind === 'alliance' ? 'an alliance' : 'a truce'}</h2></header>
    <p class="cg-log">“${esc(O.line)}”</p><p>${contSideName(run, O.from)} (${docLabel(run.sides[O.from].doctrine)}) offers ${what}.</p>
    <div class="cg-btns"><button type="button" class="btn big primary cg-focus" data-x="yes">Accept</button><button type="button" class="btn big" data-x="no">Decline</button></div>`;
}
function cgOver() {
  const run = CG.run, R = run.reports[run.reports.length - 1], won = run.over.winner === 0;
  return `<header class="cg-sh-head"><h2>${won ? 'Ithaca I secured' : run.over.winner < 0 ? 'Carrier dark' : 'The run is over'}</h2></header>
    ${cgLog(R ? R.lines.slice(Math.max(0, R.lines.indexOf('§ The end of the run'))) : contEnding(run))}
    <div class="cg-btns"><button type="button" class="btn big primary cg-focus" data-x="again">New run</button><button type="button" class="btn big" data-x="back">Main menu</button></div>`;
}

function cgSheetAct(x, d) {
  const run = CG.run;
  sfx('click');
  CG.note = '';
  if (x === 'back') { if (CG.sheet === 'new' && CG.run) { cgSheet(null); return; } closeContingency(); return; }
  if (x === 'close') { cgSheet(null); cgAfter(); return; }
  if (x === 'continue') { CG.run = contRestore(); cgFace(CG.run.sides[0].home); cgSheet(null); cgAfter(); return; }
  if (x === 'cs' || x === 'diff' || x === 'murmur') {
    cgReadNew();
    if (x === 'cs') CGN.cs = +d.k; else if (x === 'diff') CGN.diff = d.k; else CGN.murmur = d.k;
    const open = $('cg-sheet-box').querySelector('details') && $('cg-sheet-box').querySelector('details').open;
    cgSheet('new');
    if (open) $('cg-sheet-box').querySelector('details').open = true;
    return;
  }
  if (x === 'start') {
    cgReadNew();
    const seed = CGN.seed ? (+CGN.seed >>> 0) || 1 : (Math.floor(Math.random() * 0xffffffff) >>> 0) || 1;
    CG.run = contNewRun({ seed, callsign: CGN.cs, difficulty: CGN.diff, doctrines: CGN.docs, murmur: CGN.murmur, events: CGN.events, turnCap: CGN.cap, ironman: CGN.ironman });
    CG.sel = CG.run.sides[0].home; CG.group = 0;
    cgFace(CG.sel);
    CG.note = 'Your home territory. Pick a Command Group (Move), then tap a highlighted territory to send it. End turn when your orders are in.';
    if (!cgCoachSeen()) CG.note = ''; // (the walkthrough says it)
    cgSheet(null); cgAfter();
    cgCoach(0);
    return;
  }
  if (x === 'group') { if (!contBuyGroup(run, 0, +$('cg-buy-at').value)) CG.note = 'No room for another Command Group, or not enough Reserve.'; }
  if (x === 'fort') contFortify(run, 0, +d.t);
  if (x === 'refit') contBuyRefit(run, 0, d.k);
  if (x === 'card') contBuyCard(run, 0, d.k);
  if (x === 'use') {
    const k = run.sides[0].cards[+d.i], sel = $('cg-use-' + d.i);
    if (!contUseCard(run, 0, k, sel ? +sel.value : undefined)) CG.note = k === 'ledger' ? 'The Ledger Deal needs a Trade Post territory you hold.' : 'That card can\'t be used there.';
  }
  if (x === 'truce') {
    const r = +d.r, P = contTruceAnswer(run, r, 0, 99), A = contOfferTruce(run, 0, r, P.price || 0);
    CG.note = `${contSideName(run, r)}: “${A.line}”`;
  }
  if (x === 'bcard') { const b = run.battles.find((y) => !y.result); contBattleCard(run, b, 0, $('cg-bcard').value); cgSheet('battle'); cgSave(); return; }
  if (x === 'auto' || x === 'play') {
    const b = run.battles.find((y) => !y.result);
    if (x === 'play' && typeof contPlayBattle === 'function') { contPlayBattle(run, b); return; }
    contAutoResolve(run, b);
    const W = b.result.winner;
    CG.lastBattle = `${contName(b.at)}: ${W === 0 ? 'won' : W === CONT_MURMUR ? 'the Murmur won' : contSideName(run, W) + ' won'}${b.result.scarred ? ', at a cost' : ''}.`;
    if (run.phase === 'plan' || run.phase === 'over') { CG.lastBattle = ''; CG.showReport = run.phase === 'plan'; cgSheet(null); cgAfter(); return; }
    cgSave(); cgSheet('battle'); cgSync();
    return;
  }
  if (x === 'yes' || x === 'no') { contAnswer(run, 0, x === 'yes'); cgSave(); if (run.offers.length) cgSheet('offer'); else cgSheet(null); return; }
  if (x === 'again') { CG.run = null; cgSheet('new'); return; }
  cgSave();
  if (CG.sheet === 'spend') cgSheet('spend');
  cgSync();
}

function cgEndTurn() {
  const run = CG.run;
  if (!run || run.phase !== 'plan') return;
  sfx('click');
  CG.group = 0; CG.note = '';
  if (CG.coach >= 0 && !$('cg-coach').hidden) cgCoachDone(); // (the walkthrough ends with the first turn)
  contEndTurn(run);
  CG.showReport = run.phase === 'plan';
  cgAfter();
}

/* ------------------------------------------------------------------ the first-turn walkthrough (plan stage 8) */

const CG_COACH_KEY = 'terrafall.contingency.coach';
const CG_COACH = [
  'Year one: T+1. This is Ithaca I. Drag or swipe to turn it (or the arrow keys). Your territories wear your callsign\'s colour, and your home has a ring round it.',
  'Your home\'s card is open. Tap <b>Move</b> on a Command Group, then a highlighted territory next to it. Or drag the group\'s pill on the globe onto a neighbour.',
  '<b>Spend</b> buys Command Groups, fortifications, refits and cards with your Reserve. The diamonds are the Uplinks: hold 3 of the 5 for 3 years and the run is yours.',
  'When your orders are in, tap <b>End turn</b>. Everyone moves at once, then come the battles: <b>Play</b> one as a match, or <b>Auto-resolve</b> it on the odds shown.',
];
/** Has the walkthrough been seen (or skipped) on this device? */
function cgCoachSeen() { try { return localStorage.getItem(CG_COACH_KEY) === '1'; } catch (e) { return true; } }
/** Show step k of the walkthrough, on the first turn of a run, unless it has been seen. */
function cgCoach(k) {
  const el = $('cg-coach'), run = CG.run;
  if (!run || run.turn !== 1 || run.phase !== 'plan' || cgCoachSeen() || k >= CG_COACH.length) { el.hidden = true; if (k >= CG_COACH.length) cgCoachDone(); return; }
  CG.coach = k;
  el.hidden = false;
  $('cg-coach-text').innerHTML = CG_COACH[k];
  $('cg-coach-n').textContent = `${k + 1} of ${CG_COACH.length}`;
  $('cg-coach-next').textContent = k === CG_COACH.length - 1 ? 'Got it' : 'Next';
  $('cg-coach-next').onclick = () => { sfx('click'); cgCoach(k + 1); };
  $('cg-coach-skip').onclick = () => { sfx('click'); cgCoachDone(); };
}
function cgCoachDone() { try { localStorage.setItem(CG_COACH_KEY, '1'); } catch (e) { /* storage unavailable */ } $('cg-coach').hidden = true; CG.coach = -1; }

/** The main menu's Campaigns card line for Contingency: the run in progress, if there is one. */
function contingencyMenuLine() {
  const run = contRestore();
  if (!run || run.phase === 'over') return null;
  const held = contHeld(run, 0).length, up = contUplinksToward(run, 0);
  return `Year T+${run.turn} · ${CONT_CS_NAMES[run.sides[0].cs]} · ${held} of ${CONT_MAP.n} territories${up ? ` · ${up} Uplink${up > 1 ? 's' : ''}` : ''}${run.playing ? ' · a battle under way' : ''}`;
}

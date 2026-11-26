'use strict';
/*
 * Terrafall — Terraforming, stage 1: the interface and the drawing (the rules and the work are in js/sim.js: tfJob,
 * tfPlace, graderDispatch, completeEarthwork; the numbers in TERRA, js/defs.js).
 *
 *  - Build → Terraform (key 7): five tools, each with its letter (TF_TOOLS_UI). Picking one opens the Terraform mode
 *    (R.mode 'terra'): drag (or tap) tiles to plan; Flatten drags a rectangle, every tile to the level of the tile the
 *    drag started on (shown on the map and in the banner). The plan is previewed tile by tile (tfPreview, the same
 *    rules as the order: tfJob), with what it costs, yields and takes; refused tiles in red with the reason. The
 *    banner's Terraform button sends it (ORDERS.terraform); the mode stays open for the next plan.
 *  - Earthworks sites (drawEarthwork) and the Grader (drawGrader): placeholder art drawn in code, cached as sprites. The
 *    final look comes from Claude Design and renderer/ (ART_GUIDE.md, "Terraforming"): drawGrader and tfSiteFx are the
 *    only places that draw them, and graderPose names the states the rendered frames will be picked by.
 */

/** The Terraform tab's tools: key, name, what it does (the build menu's cards and the banner). */
const TF_TOOLS_UI = {
  raise: { card: 'Up a level.', key: 'r', name: 'Raise', glyph: '▲', how: 'Raise a tile a level. Drag over tiles.' },
  lower: { card: 'Down a level: Stone out.', key: 'l', name: 'Lower', glyph: '▼', how: 'Lower a tile a level (the earth comes out as Stone). Drag over tiles.' },
  flatten: { card: 'An area to one level.', key: 'f', name: 'Flatten', glyph: '▬', how: 'Drag a rectangle: every tile in it goes to the level of the tile you started on.' },
  fill: { card: 'Water beside land to land.', key: 'h', name: 'Fill shallows', glyph: '◢', how: `Water beside land becomes land, up to ${TERRA.reach} tiles from the original shore. Drag out from the shore for a land bridge.` },
  dig: { card: 'Land beside water to water.', key: 'c', name: 'Dig channel', glyph: '≈', how: 'Land beside water becomes water: moats, and canals for ships. Drag in from the shore.' },
};

/** The tab's button and its cards (openBuildMenu). */
function tfTabButton() { return `<button data-g="terra"><kbd>${BUILD_TAB_KEYS.terra}</kbd>Terraform<span class="n">${TF_TOOLS.length}</span></button>`; }
function tfCards() {
  const n = S.bots.filter((u) => !u.dead && u.owner === ME && BOTS[u.type].grader).length;
  return TF_TOOLS.map((k) => {
    const T = TF_TOOLS_UI[k];
    return `<button class="bcard tf-card" data-tf="${k}" data-g="terra" title="${T.name}"><kbd data-tab="${BUILD_TAB_KEYS.terra}" data-key="${T.key.toUpperCase()}">${T.key.toUpperCase()}</kbd>` +
      `<div class="tf-glyph tf-${k}" aria-hidden="true">${T.glyph}</div><div class="bname">${T.name}</div><div class="bhave">${T.card}</div></button>`;
  }).join('') + `<p class="tf-note" data-g="terra">${n ? `${n} Grader${n === 1 ? '' : 's'} to do the work.` : 'A <b>Grader</b> does the work: order one at the Bot Foundry.'} Not on a rival's land, nor under buildings, roads, track, pipes or resources.</p>`;
}
function tfBind(body) { for (const el of body.querySelectorAll('.bcard[data-tf]')) el.onclick = () => tfStart(el.dataset.tf); }

/** Open the Terraform mode with `tool`. */
function tfStart(tool) {
  if (!TF_TOOLS.includes(tool)) return;
  sfx('click');
  setMode('terra');
  UI.tf = { tool, list: [], start: -1, end: -1, prev: null };
  tfBanner();
}

/** Switch tool while planning: the plan so far is dropped. */
function tfTool(tool) { if (!UI.tf) return; UI.tf = { tool, list: [], start: -1, end: -1, prev: null }; tfBanner(); }

/** Flatten's tiles: the rectangle from the start tile to the end, nearest the start first (so it's checked outward). */
function tfRect(a, b) {
  const ai = a % S.W, aj = (a / S.W) | 0, bi = b % S.W, bj = (b / S.W) | 0, out = [];
  for (let j = Math.min(aj, bj); j <= Math.max(aj, bj); j++) for (let i = Math.min(ai, bi); i <= Math.max(ai, bi); i++) out.push(j * S.W + i);
  out.sort((p, q) => dist2(p % S.W, (p / S.W) | 0, ai, aj) - dist2(q % S.W, (q / S.W) | 0, ai, aj) || p - q);
  return out;
}
/** The level a Flatten plan works to: the start tile's (null off open ground). */
function tfTarget() { const F = UI.tf; return F && F.start >= 0 && tfLevel(F.start) !== null ? tfLevel(F.start) : null; }

/** Work out the preview: each tile's job (the order's own rules), the totals. */
function tfPreview() {
  const F = UI.tf;
  if (!F) return;
  const plan = new Map(), rows = [], target = tfTarget();
  let stone = 0, yieldN = 0, time = 0, why = '';
  for (const t of F.list.slice(0, TERRA.most)) {
    const J = tfJob(ME, F.tool, t, target, plan);
    if (J.why) { rows.push([t, null, J.why, J.same]); if (!why && !J.same) why = J.why; continue; } // (Flatten: a tile already at its level is left alone)
    plan.set(t, J); rows.push([t, J]);
    stone += J.cost.stone || 0; yieldN += J.yieldN; time += J.time;
  }
  F.prev = { rows, plan, stone, yieldN, time, why, over: F.list.length > TERRA.most };
}

function tfBanner() {
  const F = UI.tf;
  if (!F) return;
  tfPreview();
  const T = TF_TOOLS_UI[F.tool], P = F.prev, n = P.plan.size;
  const graders = S.bots.filter((u) => !u.dead && u.owner === ME && BOTS[u.type].grader).length;
  const seg = `<span class="seg tf-seg" id="tf-seg">${TF_TOOLS.map((k) => `<button data-tf="${k}" class="${k === F.tool ? 'on' : ''}"><kbd>${TF_TOOLS_UI[k].key.toUpperCase()}</kbd>${TF_TOOLS_UI[k].name}</button>`).join('')}</span>`;
  const lv = F.tool === 'flatten' ? (tfTarget() !== null ? ` To <b>level ${tfTarget()}</b> (the first tile's).` : ' Start on open ground: its level is the one the rest go to.') : '';
  const sum = n ? `<b>${n}</b> tile${n === 1 ? '' : 's'}${P.stone ? ` · costs <b>${P.stone}</b> Stone` : ''}${P.yieldN ? ` · yields <b>${P.yieldN}</b> Stone` : ''} · about <b>${fmtClock(P.time / Math.max(1, graders))}</b> of Grader work` : 'Nothing planned yet.';
  const warn = (P.why ? ` <span class="err">${P.why}</span>` : '') + (P.over ? ` <span class="err">A plan takes ${TERRA.most} tiles at most.</span>` : '') +
    (!graders ? ' <span class="err">No Grader: order one at the Bot Foundry.</span>' : '');
  showBanner(`${seg}<div class="tf-how"><b>${T.name}</b>: ${T.how}${lv}</div><div class="tf-sum">${sum}${warn}</div>`, 'Terraform', 'Done');
  $('banner-ok').disabled = !n;
  for (const b of $('banner-text').querySelectorAll('#tf-seg button')) b.onclick = (e) => { e.stopPropagation(); sfx('click'); tfTool(b.dataset.tf); };
  if (typeof bannerMissionHint === 'function') bannerMissionHint();
}

/** A drag on the map in the Terraform mode (from onRoadPaint). */
function tfPaint(i, j, first) {
  const F = UI.tf;
  if (!F || !inMap(i, j)) return;
  const t = tIdx(i, j);
  if (F.tool === 'flatten') {
    if (first) F.start = t;
    F.end = t;
    F.list = tfRect(F.start, F.end);
  } else {
    if (first) F.last = null;
    const from = F.last || { i, j };
    for (const [x, y] of tileLine(from.i, from.j, i, j)) { const u = tIdx(x, y); if (!F.list.includes(u)) F.list.push(u); }
    F.last = { i, j };
  }
  tfBanner();
}

/** A tap in the Terraform mode: a tile in or out of the plan; Flatten: the start, then the far corner. */
function tfTap(i, j) {
  const F = UI.tf;
  if (!F || !inMap(i, j)) return;
  const t = tIdx(i, j);
  if (F.tool === 'flatten') {
    if (F.start < 0 || F.list.length > 1 || F.start === t) { F.start = t; F.end = t; F.list = [t]; }
    else { F.end = t; F.list = tfRect(F.start, t); }
  } else {
    const k = F.list.indexOf(t);
    if (k >= 0) F.list.splice(k, 1); else F.list.push(t);
  }
  sfx('click');
  tfBanner();
}

/** The banner's Terraform: send the plan's good tiles. */
function tfConfirm() {
  const F = UI.tf;
  if (!F || !F.prev || !F.prev.plan.size) return;
  const tiles = [...F.prev.plan.keys()], tool = F.tool, target = tfTarget() ?? 0;
  act('terraform', [tool, tiles, target], (r) => {
    if (!r || !r.placed) { sfx('error'); toast((r && r.why) || 'Nothing could be planned there.', 'warn'); return; }
    sfx('place'); haptic('order');
    toast(`${r.placed} Earthworks planned${r.stone ? `: ${r.stone} Stone to bring` : ''}${r.yieldN ? `${r.stone ? ',' : ':'} ${r.yieldN} Stone to dig out` : ''}.${r.graders ? '' : ' Order a Grader at the Bot Foundry to do them.'}`, r.graders ? 'info' : 'warn');
    if (S.mission) S.mission.tfPlanned = (S.mission.tfPlanned || 0) + r.placed;
    UI.tf = { tool, list: [], start: -1, end: -1, prev: null };
    tfBanner();
  });
}

/** A letter in the Terraform mode switches tool (true if it did). */
function tfKey(k) {
  if (R.mode !== 'terra' || !UI.tf) return false;
  const tool = TF_TOOLS.find((q) => TF_TOOLS_UI[q].key === k);
  if (!tool) return false;
  sfx('click'); tfTool(tool);
  return true;
}

/* ------------------------------------------------------------------ drawing */

const TF_COL = { up: '#ffb24a', down: '#7fb4ff', fill: '#e2c48a', dig: '#3fb6e8' };

/** The plan being made (the Terraform mode): each tile's job, its new level, refused tiles crossed out. */
function tfDrawPlan(ctx, ox, oy, z, inView) {
  const F = typeof UI !== 'undefined' && UI.tf;
  if (R.mode !== 'terra' || !F || !F.prev) return;
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const fs = Math.max(9, z * 0.34);
  for (const [t, J, , same] of F.prev.rows) {
    const i = t % S.W, j = (t / S.W) | 0;
    if (!inView(i, j, 1)) continue;
    const x = ox + i * z, y = oy + j * z;
    if (same) { ctx.globalAlpha = 0.5; ctx.strokeStyle = '#e8e2d4'; ctx.lineWidth = Math.max(1, z * 0.03); ctx.strokeRect(x + z * 0.1, y + z * 0.1, z * 0.8, z * 0.8); ctx.globalAlpha = 1; continue; }
    if (!J) {
      ctx.strokeStyle = 'rgba(255,90,90,0.85)'; ctx.lineWidth = Math.max(1.2, z * 0.04);
      ctx.beginPath(); ctx.moveTo(x + z * 0.25, y + z * 0.25); ctx.lineTo(x + z * 0.75, y + z * 0.75); ctx.moveTo(x + z * 0.75, y + z * 0.25); ctx.lineTo(x + z * 0.25, y + z * 0.75); ctx.stroke();
      continue;
    }
    const c = TF_COL[J.k];
    ctx.globalAlpha = 0.3; ctx.fillStyle = c; ctx.fillRect(x + 1, y + 1, z - 2, z - 2);
    ctx.globalAlpha = 0.95; ctx.strokeStyle = c; ctx.lineWidth = Math.max(1, z * 0.035); ctx.strokeRect(x + z * 0.06, y + z * 0.06, z * 0.88, z * 0.88);
    if (z >= 18) {
      ctx.font = `700 ${fs}px system-ui, sans-serif`;
      ctx.fillStyle = 'rgba(10,12,16,0.75)'; ctx.fillText(J.k === 'dig' ? '≈' : String(J.to), x + z / 2 + 1, y + z / 2 + 1);
      ctx.fillStyle = '#fff'; ctx.fillText(J.k === 'dig' ? '≈' : String(J.to), x + z / 2, y + z / 2);
    }
  }
  // Flatten: the tile it's measured from.
  if (F.tool === 'flatten' && F.start >= 0) {
    const i = F.start % S.W, j = (F.start / S.W) | 0, x = ox + i * z, y = oy + j * z;
    ctx.globalAlpha = 1; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(2, z * 0.07); ctx.setLineDash([z * 0.12, z * 0.08]);
    ctx.strokeRect(x + z * 0.04, y + z * 0.04, z * 0.92, z * 0.92); ctx.setLineDash([]);
  }
  // The tile under the pointer: its level (what Flatten would level to).
  if (R.hover >= 0 && z >= 14) {
    const t = R.hover, i = t % S.W, j = (t / S.W) | 0, lv = tfLevel(t);
    const lab = lv === null ? (S.terrain[t] === T_WATER ? 'water' : '—') : `level ${lv}`;
    ctx.globalAlpha = 0.95; ctx.font = `600 ${Math.max(10, z * 0.26)}px system-ui, sans-serif`;
    const w = ctx.measureText(lab).width + 10, x = ox + i * z + z / 2, y = oy + j * z - Math.max(9, z * 0.2);
    ctx.fillStyle = 'rgba(12,14,20,0.85)'; ctx.fillRect(x - w / 2, y - Math.max(8, z * 0.16), w, Math.max(16, z * 0.32));
    ctx.fillStyle = '#fff'; ctx.fillText(lab, x, y);
  }
  ctx.restore();
}

/**
 * An Earthworks site (drawBuilding, unbuilt): the ground being worked. Placeholder art: a staked-out patch in its
 * owner's colour, the earth changing as the work goes (tfSiteFx), and a progress bar.
 */
function drawEarthwork(ctx, cx, cy, s, owner, b) {
  const J = b.tf || { k: 'up', to: 0 }, k = clamp(b.progress || 0, 0, 1), color = PLAYER_COLORS[owner] || '#9aa2ab';
  const x = cx - s / 2, y = cy - s / 2;
  tfSiteFx(ctx, J, k, x, y, s);
  // Survey stakes at the corners, with their owner's flags.
  ctx.lineWidth = Math.max(1, s * 0.025);
  for (const [a, c] of [[0.1, 0.1], [0.9, 0.1], [0.1, 0.9], [0.9, 0.9]]) {
    const px = x + a * s, py = y + c * s;
    ctx.strokeStyle = '#d9cdb4'; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py - s * 0.14); ctx.stroke();
    ctx.fillStyle = color; ctx.fillRect(px, py - s * 0.14, s * 0.07, s * 0.045);
  }
  if (s >= 16) {
    ctx.fillStyle = 'rgba(10,12,16,0.7)'; ctx.font = `700 ${Math.max(8, s * 0.22)}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(J.k === 'dig' ? '≈' : J.k === 'fill' ? '◢' + J.to : (J.k === 'up' ? '▲' : '▼') + J.to, cx, cy);
  }
  const bw = s * 0.8;
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(cx - bw / 2, y + s * 0.92, bw, Math.max(2, s * 0.06));
  ctx.fillStyle = color; ctx.fillRect(cx - bw / 2, y + s * 0.92, bw * k, Math.max(2, s * 0.06));
}

/**
 * The work on the ground (the "work site" hook the rendered effects will replace): a mound rising (Raise), a pit
 * going down (Lower), earth spreading over the water (Fill) or water coming in (Dig), with a spoil pile of dug earth.
 */
function tfSiteFx(ctx, J, k, x, y, s) {
  ctx.save();
  if (J.k === 'fill') {
    ctx.fillStyle = '#8a6a44'; ctx.globalAlpha = 0.35 + 0.65 * k;
    ctx.beginPath(); ctx.ellipse(x + s / 2, y + s / 2, s * (0.2 + 0.32 * k), s * (0.16 + 0.32 * k), 0, 0, Math.PI * 2); ctx.fill();
  } else if (J.k === 'dig') {
    ctx.fillStyle = '#6a4e30'; ctx.globalAlpha = 0.8; ctx.fillRect(x + s * 0.08, y + s * 0.08, s * 0.84, s * 0.84);
    ctx.fillStyle = '#2f7fa8'; ctx.globalAlpha = 0.25 + 0.7 * k;
    ctx.beginPath(); ctx.ellipse(x + s / 2, y + s / 2, s * 0.42 * k + s * 0.05, s * 0.4 * k + s * 0.05, 0, 0, Math.PI * 2); ctx.fill();
  } else {
    const up = J.k === 'up';
    ctx.fillStyle = '#7a5a38'; ctx.globalAlpha = 0.75; ctx.fillRect(x + s * 0.06, y + s * 0.06, s * 0.88, s * 0.88);
    const g = ctx.createRadialGradient(x + s * 0.45, y + s * 0.42, s * 0.05, x + s / 2, y + s / 2, s * 0.5);
    g.addColorStop(0, up ? '#c49a64' : '#3a2a1a'); g.addColorStop(1, up ? 'rgba(122,90,56,0)' : 'rgba(122,90,56,0)');
    ctx.globalAlpha = 0.3 + 0.7 * k; ctx.fillStyle = g; ctx.fillRect(x, y, s, s);
  }
  // The spoil pile (dug earth waiting to be carted off as Stone) / the heap of Stone being worked in.
  if (J.k !== 'fill') {
    ctx.globalAlpha = 0.9; ctx.fillStyle = J.k === 'up' ? '#9c9488' : '#8b6b48';
    ctx.beginPath(); ctx.ellipse(x + s * 0.78, y + s * 0.74, s * 0.13, s * 0.09, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

/**
 * What Grader u is doing, for its art: 'idle', 'driving', or at work 'cutting' (lowering, digging), 'pushing'
 * (flattening down) or 'filling' (raising, filling). The rendered frames will be picked by it.
 */
function graderPose(u) {
  const t = u.task;
  if (t && t.type === 'build' && t.phase !== 'go') { const s = getE(t.site); const k = s && s.tf ? s.tf.k : 'up'; return k === 'dig' ? 'cutting' : k === 'down' ? (s.tf.n > 1 ? 'pushing' : 'cutting') : 'filling'; }
  return u.path && u.pi < u.path.length ? 'driving' : 'idle';
}

/** The Grader's placeholder sprite: tracks, a hull with its team stripe, a cab and the blade in front (facing right). */
const _graderArt = {};
function graderArt(owner, frame) {
  const team = artTeam(owner), key = `grader@${team}-f${frame}`;
  if (_graderArt[key]) return _graderArt[key];
  const n = 128, c = document.createElement('canvas'); c.width = c.height = n;
  const x = c.getContext('2d'), col = PLAYER_COLORS[owner] || '#38d4ff';
  x.translate(n / 2, n / 2);
  // Tracks: dark belts with links that roll a quarter link a frame.
  for (const sy of [-26, 18]) {
    x.fillStyle = '#1d1f24'; x.fillRect(-34, sy, 60, 8);
    x.fillStyle = '#3a3d44';
    for (let k = -34 + (frame * 2); k < 26; k += 8) x.fillRect(k, sy + 1, 3, 6);
  }
  // Hull.
  x.fillStyle = '#5b5e63'; x.fillRect(-30, -18, 52, 36);
  x.fillStyle = '#6e7176'; x.fillRect(-28, -16, 30, 32);
  x.fillStyle = col; x.fillRect(-30, -3, 52, 6); // (team stripe)
  // Cab: glass toward the front.
  x.fillStyle = '#3c3f45'; x.fillRect(-6, -12, 20, 24);
  x.fillStyle = '#9fd4e8'; x.fillRect(8, -10, 5, 20);
  // Exhaust stack and rust at the seams.
  x.fillStyle = '#2a2b2f'; x.beginPath(); x.arc(-22, -10, 3.5, 0, Math.PI * 2); x.fill();
  x.fillStyle = 'rgba(160,80,30,0.5)'; x.fillRect(-30, 14, 52, 3);
  // Push arms and the blade, hazard-striped.
  x.fillStyle = '#444'; x.fillRect(22, -20, 12, 4); x.fillRect(22, 16, 12, 4);
  x.fillStyle = '#c9a227'; x.fillRect(33, -32, 7, 64);
  x.fillStyle = '#1d1f24';
  for (let k = -32; k < 32; k += 10) x.fillRect(33, k, 7, 4);
  x.fillStyle = '#8a8d92'; x.fillRect(39, -32, 2, 64);
  return (_graderArt[key] = { img: c, scale: 1, key });
}

/** Draw Grader u at (sx, sy), s pixels a tile: its sprite turned its way, the blade working, headlights after dark. */
function drawGrader(ctx, u, sx, sy, s) {
  const pose = graderPose(u), work = pose === 'cutting' || pose === 'pushing' || pose === 'filling';
  const frame = work ? Math.floor(R.time * 6) % 4 : Math.floor((u.odo || 0) / FRAME_STEP) % 4;
  // The rendered set, once it exists (ART_GUIDE.md, "Terraforming"): a pose's frames, else the driving frames; else the placeholder.
  const team = artTeam(u.owner), key = { cutting: 'grader-cut', pushing: 'grader-push', filling: 'grader-fill', idle: 'grader-idle' }[pose] || 'grader';
  const rendered = ART[`${key}@${team}-f${frame}`] || ART[`${key}@${team}`] || driveFrame(u);
  const art = rendered || graderArt(u.owner, frame), size = s * 0.62;
  const jig = work ? Math.sin(R.time * 9 + u.id) * s * 0.02 : 0; // (rocking as the blade bites)
  drawBotShadow(ctx, u, sx, sy, size * 0.42, size * 0.32);
  drawArt(ctx, art, sx + Math.cos(u.face || 0) * jig, sy + Math.sin(u.face || 0) * jig, size, u.face || 0);
  if (work && !R.clean) {
    // Earth thrown up off the blade.
    const a = u.face || 0, bx = sx + Math.cos(a) * size * 0.36, by = sy + Math.sin(a) * size * 0.36;
    ctx.save(); ctx.fillStyle = pose === 'filling' ? 'rgba(170,140,100,0.7)' : 'rgba(110,82,52,0.75)';
    for (let k = 0; k < 4; k++) { const q = (R.time * 2.3 + k * 0.25 + u.id * 0.13) % 1, r = s * 0.025 * (1 - q); ctx.beginPath(); ctx.arc(bx + Math.cos(a + k) * s * 0.08 * q, by + Math.sin(a + k * 1.7) * s * 0.08 * q - s * 0.1 * q, Math.max(0.6, r), 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
  // Headlights at dusk and night: two lamps on the cab roof and a pool of light ahead of the blade.
  const night = typeof TOD !== 'undefined' && TOD.active ? TOD.state.headlights : 0;
  if (rendered && TOD.shared && TOD.shared['grader-headlights']) drawHeadlights(ctx, 'grader', sx, sy, size, u.face || 0);
  else if (night > 0.02 && typeof fxGlow === 'function') {
    const a = u.face || 0, c = Math.cos(a), sn = Math.sin(a);
    for (const side of [-0.14, 0.14]) fxGlow(ctx, sx + c * size * 0.2 - sn * side * size, sy + sn * size * 0.2 + c * side * size, size * 0.14, '#f4f0dc', night * 0.9);
    fxGlow(ctx, sx + c * size * 0.75, sy + sn * size * 0.75, size * 0.5, '#fff2c8', night * 0.35);
  }
}

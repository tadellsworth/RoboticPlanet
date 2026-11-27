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
 *  - Earthworks sites (tfGround: the ground being worked; drawEarthwork: stakes and the plan) and the Grader
 *    (drawGrader: its rendered frames, renderer/b/rob_grader.js), the owner's concept A "Dozer" (ART_GUIDE.md,
 *    Batch 35). Looks only: they read the simulation and never change it.
 */

/** The Terraform tab's tools: key, name, what it does (the build menu's cards and the banner). */
const TF_TOOLS_UI = {
  raise: { card: 'Up a level.', key: 'r', name: 'Raise', glyph: '▲', how: 'Raise a tile a level. Drag over tiles.' },
  lower: { card: 'Down a level: Stone out.', key: 'l', name: 'Lower', glyph: '▼', how: 'Lower a tile a level (the earth comes out as Stone). Drag over tiles.' },
  flatten: { card: 'An area to one level.', key: 'f', name: 'Flatten', glyph: '▬', how: 'Drag a rectangle: every tile in it goes to the level of the tile you started on.' },
  fill: { card: 'Water beside land to land.', key: 'h', name: 'Fill shallows', glyph: '◢', how: `Water beside land becomes land, up to ${TERRA.reach} tiles from the original shore. Drag out from the shore for a land bridge.` },
  dig: { card: 'Land beside water to water.', key: 'c', name: 'Dig channel', glyph: '≈', how: 'Land beside water becomes water: moats, canals for ships, and irrigation ditches a Water Pump fills. Drag in from the shore.' },
  // Stage 2 (SOIL): the Grader's soil jobs.
  soil: { card: 'Barren ground richer.', key: 'o', name: 'Spread soil', glyph: '▦', how: `Spread humus over a tile: it grows a step richer (barren, improving, rich). ${SOIL.spread.fiber} Fiber and ${SOIL.spread.stone} Stone a tile. Drag over tiles.` },
  reclaim: { card: 'Craters and scorch to ground.', key: 'e', name: 'Reclaim', glyph: '✚', how: 'Clear a crater, scorched or burned ground, or a grove back to usable ground. Drag over tiles.' },
};

/** The tab's button and its cards (openBuildMenu). */
function tfTabButton() { return `<button data-g="terra"><kbd>${BUILD_TAB_KEYS.terra}</kbd>Terraform<span class="n">${TF_TOOLS.length + (typeof t2Types === 'function' ? t2Types().length : 0)}</span></button>`; }
function tfCards() {
  const n = S.bots.filter((u) => !u.dead && u.owner === ME && BOTS[u.type].grader).length;
  return TF_TOOLS.map((k) => {
    const T = TF_TOOLS_UI[k];
    return `<button class="bcard tf-card" data-tf="${k}" data-g="terra" title="${T.name}"><kbd data-tab="${BUILD_TAB_KEYS.terra}" data-key="${T.key.toUpperCase()}">${T.key.toUpperCase()}</kbd>` +
      `<div class="tf-glyph tf-${k}" aria-hidden="true">${T.glyph}</div><div class="bname">${T.name}</div><div class="bhave">${T.card}</div></button>`;
  }).join('') + (typeof t2Cards === 'function' ? t2Cards() : '') + `<p class="tf-note" data-g="terra">${n ? `${n} Grader${n === 1 ? '' : 's'} to do the work.` : 'A <b>Grader</b> does the work: order one at the Bot Foundry.'} Not on a rival's land, nor under buildings, roads, track, pipes or resources.</p>`;
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
  let stone = 0, fiber = 0, yieldN = 0, time = 0, why = '';
  for (const t of F.list.slice(0, TERRA.most)) {
    const J = tfJob(ME, F.tool, t, target, plan);
    if (J.why) { rows.push([t, null, J.why, J.same]); if (!why && !J.same) why = J.why; continue; } // (Flatten: a tile already at its level is left alone)
    plan.set(t, J); rows.push([t, J]);
    stone += J.cost.stone || 0; fiber += J.cost.fiber || 0; yieldN += J.yieldN; time += J.time;
  }
  F.prev = { rows, plan, stone, fiber, yieldN, time, why, over: F.list.length > TERRA.most };
}

function tfBanner() {
  const F = UI.tf;
  if (!F) return;
  tfPreview();
  const T = TF_TOOLS_UI[F.tool], P = F.prev, n = P.plan.size;
  const graders = S.bots.filter((u) => !u.dead && u.owner === ME && BOTS[u.type].grader).length;
  const seg = `<span class="seg tf-seg" id="tf-seg">${TF_TOOLS.map((k) => `<button data-tf="${k}" class="${k === F.tool ? 'on' : ''}"><kbd>${TF_TOOLS_UI[k].key.toUpperCase()}</kbd>${TF_TOOLS_UI[k].name}</button>`).join('')}</span>`;
  const lv = F.tool === 'flatten' ? (tfTarget() !== null ? ` To <b>level ${tfTarget()}</b> (the first tile's).` : ' Start on open ground: its level is the one the rest go to.') : '';
  const sum = n ? `<b>${n}</b> tile${n === 1 ? '' : 's'}${P.stone || P.fiber ? ` · costs ${P.fiber ? `<b>${P.fiber}</b> Fiber${P.stone ? ', ' : ''}` : ''}${P.stone ? `<b>${P.stone}</b> Stone` : ''}` : ''}${P.yieldN ? ` · yields <b>${P.yieldN}</b> Stone` : ''} · about <b>${fmtClock(P.time / Math.max(1, graders))}</b> of Grader work` : 'Nothing planned yet.';
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
    toast(`${r.placed} Earthworks planned${r.fiber ? `: ${r.fiber} Fiber and ${r.stone} Stone to bring` : r.stone ? `: ${r.stone} Stone to bring` : ''}${r.yieldN ? `${r.stone ? ',' : ':'} ${r.yieldN} Stone to dig out` : ''}.${r.graders ? '' : ' Order a Grader at the Bot Foundry to do them.'}`, r.graders ? 'info' : 'warn');
    if (S.mission) S.mission.tfPlanned = (S.mission.tfPlanned || 0) + r.placed;
    if (tool === 'flatten') { R.tfFlat = R.tfFlat || new Set(); for (const t of tiles) R.tfFlat.add(t); } // (drawn with Flatten's glyph: looks only)
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

/*
 * The look is the owner's pick from the Grader concept canvas (concept A, "Dozer"; ART_GUIDE Batch 35):
 *  - the plans, on the map as the road plans are (an inset dashed outline, amber for yours and faint red for a rival's,
 *    a pale fill, a grey bar filling along the bottom while a Grader works, the sparser orange dash and a Stone pip
 *    while it waits for its Stone), each job with its glyph and tint (tfPlanTile);
 *  - the ground being worked, drawn with the ground and re-lit with it (tfGround, before the time of day's grading):
 *    a cut opening with a spoil heap (Lower), a fill heap spread and levelled (Raise), a tongue of new land with a mud
 *    plume (Fill shallows), a trench with the water following it in (Dig channel), fresh soil in the biome's own earth
 *    fading into the ground after the job, and the Graders' track marks;
 *  - the Grader itself, rendered (renderer/b/rob_grader.js): drive frames with the blade up, work frames with it down,
 *    the heap of earth ahead of the blade, clods and dust off it, its headlights and work lights at night (drawGrader).
 * Every piece is cached as a sprite (per biome, team or size); the extras (track marks, plumes, clods, splashes,
 * exhaust, fresh soil) are left out on the Saver graphics setting. Looks only: nothing here touches the simulation.
 */

/** The jobs' tints and glyph colours (the canvas legend): raise warm, lower cool, flatten pale, fill and dig blue. */
const TF_COL = { up: '#ffc46e', down: '#8fd8ff', flatten: '#ecf0f4', fill: '#78c8ff', dig: '#5fc8ff', soil: '#c8925a', clear: '#a6e08c' };
const TF_FRESH = 180; // (seconds of game time new ground takes to weather into the biome's)
/** Fresh, turned soil for each biome (RGB): the Rust's red-brown earth, darker and browner in the forests and swamps. */
const TF_SOIL = {
  desert: [138, 88, 62], jungle: [98, 74, 56], polar: [112, 98, 88], autumn: [112, 78, 54], savanna: [134, 96, 64],
  swamp: [74, 58, 44], volcanic: [72, 60, 54], lunar: [116, 112, 108], alien: [112, 82, 92], springs: [150, 118, 84],
  tropical: [168, 142, 104], hollow: [78, 62, 66],
};
function tfSaver() { return typeof gfxStep === 'function' && gfxStep() === 'saver'; }

/** Biome b's fresh soil: a 96 px tile of grain (one tile of ground), its colours. Made once a biome. */
const _tfSoil = {};
function tfSoil(b) {
  if (_tfSoil[b]) return _tfSoil[b];
  const rgb = TF_SOIL[b] || TF_SOIL.desert, n = 96, c = document.createElement('canvas'); c.width = c.height = n;
  const x = c.getContext('2d'), sh = (k) => `rgb(${rgb.map((v) => Math.round(clamp(v * k, 0, 255))).join(',')})`;
  x.fillStyle = sh(1); x.fillRect(0, 0, n, n);
  // clumps, then grain and crumbs, lit from the upper left (seamless: drawn wrapped)
  for (let k = 0; k < 220; k++) {
    const px = hash2(k, 1, 77) * n, py = hash2(k, 2, 77) * n, r = 1 + hash2(k, 3, 77) * 5, v = 0.78 + hash2(k, 4, 77) * 0.38;
    for (const [dx, dy] of [[0, 0], [n, 0], [0, n], [n, n], [-n, 0], [0, -n], [-n, -n]]) {
      x.fillStyle = sh(v * 0.86); x.beginPath(); x.arc(px + dx + r * 0.25, py + dy + r * 0.3, r, 0, Math.PI * 2); x.fill();
      x.fillStyle = sh(v); x.beginPath(); x.arc(px + dx, py + dy, r * 0.8, 0, Math.PI * 2); x.fill();
    }
  }
  for (let k = 0; k < 900; k++) { x.fillStyle = sh(0.6 + hash2(k, 5, 78) * 0.7); x.fillRect(hash2(k, 6, 78) * n, hash2(k, 7, 78) * n, 1 + (k % 2), 1); }
  return (_tfSoil[b] = { img: c, rgb, sh, pat: null, ctx: null });
}
/** A fill style of image `img` laid over the map with `tiles` tiles to the image (it scrolls and zooms with the map). */
function tfPattern(ctx, holder, img, ox, oy, z, tiles) {
  if (!holder.pat || holder.ctx !== ctx) { holder.pat = ctx.createPattern(img, 'repeat'); holder.ctx = ctx; }
  if (holder.pat.setTransform) holder.pat.setTransform(new DOMMatrix([(z * tiles) / img.width, 0, 0, (z * tiles) / img.height, ox, oy]));
  return holder.pat;
}

/**
 * A heap's sprite (128 px, lit from the upper left, clods round its foot): 'spoil' (dug earth), 'fill' (earth to be
 * spread, blade furrows over it) or 'stone' (the grey Stone a job is fed from), in biome b's soil. Made once a kind.
 */
const _tfHeap = {};
function tfHeap(kind, b, v = 0) {
  const key = `${kind}:${b}:${v}`;
  if (_tfHeap[key]) return _tfHeap[key];
  const n = 128, c = document.createElement('canvas'); c.width = c.height = n;
  const x = c.getContext('2d'), base = kind === 'stone' ? [142, 136, 126] : (TF_SOIL[b] || TF_SOIL.desert);
  const col = (k, a = 1) => `rgba(${base.map((q) => Math.round(clamp(q * k, 0, 255))).join(',')},${a})`;
  const R = n * 0.36, cx = n / 2, cy = n / 2, pts = [];
  for (let k = 0; k < 28; k++) { const a = (k / 28) * Math.PI * 2, w = 1 + 0.13 * Math.sin(a * 3 + v * 2.1) + 0.08 * Math.sin(a * 7 + v) + 0.05 * Math.sin(a * 13 + v * 3); pts.push([cx + Math.cos(a) * R * w, cy + Math.sin(a) * R * w * 0.92]); }
  const outline = () => { x.beginPath(); pts.forEach(([px, py], k) => (k ? x.lineTo(px, py) : x.moveTo(px, py))); x.closePath(); };
  // its shadow down and to the right, then the body shaded as a dome
  x.save(); x.translate(n * 0.05, n * 0.06); x.filter = 'blur(3px)'; outline(); x.fillStyle = 'rgba(20,10,5,0.35)'; x.fill(); x.restore();
  outline(); const g = x.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R * 1.15);
  g.addColorStop(0, col(1.28)); g.addColorStop(0.55, col(1.0)); g.addColorStop(1, col(0.62)); x.fillStyle = g; x.fill();
  x.save(); outline(); x.clip();
  if (kind === 'fill') { // blade furrows: arcs pushed across it
    x.lineWidth = 2;
    for (let k = -4; k <= 4; k++) { x.strokeStyle = col(k % 2 ? 0.72 : 1.18, 0.55); x.beginPath(); x.arc(cx - R * 1.6, cy, R * (1.3 + k * 0.13), -0.7, 0.7); x.stroke(); }
  }
  for (let k = 0; k < 70; k++) { // crumbs and stones over it
    const a = hash2(k, v, 31) * Math.PI * 2, d = Math.sqrt(hash2(k, v, 32)) * R, r = 1 + hash2(k, v, 33) * (kind === 'stone' ? 4 : 2.6);
    const px = cx + Math.cos(a) * d, py = cy + Math.sin(a) * d, lit = 1.25 - 0.5 * ((px - cx + py - cy) / (2 * R) + 0.5);
    x.fillStyle = col(lit * 0.7); x.beginPath(); x.arc(px + 0.8, py + 0.8, r, 0, Math.PI * 2); x.fill();
    x.fillStyle = col(lit * 1.08); x.beginPath(); x.arc(px, py, r * 0.8, 0, Math.PI * 2); x.fill();
  }
  x.restore();
  for (let k = 0; k < 14; k++) { // clods round its foot
    const a = hash2(k, v, 41) * Math.PI * 2, d = R * (1.0 + hash2(k, v, 42) * 0.35), r = 1.5 + hash2(k, v, 43) * 2.5;
    const px = cx + Math.cos(a) * d, py = cy + Math.sin(a) * d * 0.92;
    x.fillStyle = 'rgba(20,10,5,0.3)'; x.beginPath(); x.arc(px + 1.2, py + 1.2, r, 0, Math.PI * 2); x.fill();
    x.fillStyle = col(1.02); x.beginPath(); x.arc(px, py, r, 0, Math.PI * 2); x.fill();
  }
  return (_tfHeap[key] = c);
}

/** A survey stake (the Accord's own markers): a pale post with an orange band, its tip lit in the team's colour. */
const _tfStake = {};
function tfStake(color) {
  if (_tfStake[color]) return _tfStake[color];
  const n = 32, c = document.createElement('canvas'); c.width = c.height = n;
  const x = c.getContext('2d');
  x.fillStyle = 'rgba(20,10,5,0.3)'; x.beginPath(); x.ellipse(n * 0.6, n * 0.88, n * 0.16, n * 0.07, 0.3, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#ddd5c2'; x.fillRect(n * 0.45, n * 0.3, n * 0.1, n * 0.58);
  x.fillStyle = '#f4ecda'; x.fillRect(n * 0.45, n * 0.3, n * 0.04, n * 0.58);
  x.fillStyle = '#e07a28'; x.fillRect(n * 0.43, n * 0.48, n * 0.14, n * 0.1);
  x.fillStyle = color; x.beginPath(); x.arc(n * 0.5, n * 0.26, n * 0.11, 0, Math.PI * 2); x.fill();
  x.fillStyle = 'rgba(255,255,255,0.75)'; x.beginPath(); x.arc(n * 0.47, n * 0.23, n * 0.045, 0, Math.PI * 2); x.fill();
  return (_tfStake[color] = c);
}

/** A ragged-edged rectangle path (tile px; seeded, so it keeps its shape frame to frame). */
function tfRagged(ctx, x0, y0, x1, y1, seed, amp) {
  ctx.beginPath();
  const side = (ax, ay, bx, by, k0, nx, ny) => {
    const L = Math.max(2, Math.round(Math.hypot(bx - ax, by - ay) / Math.max(4, amp * 2.2)));
    for (let k = 0; k < L; k++) { const t = k / L, w = (hash2(seed, k + k0, 5) - 0.5) * amp; ctx.lineTo(ax + (bx - ax) * t + nx * w, ay + (by - ay) * t + ny * w); }
  };
  ctx.moveTo(x0, y0);
  side(x0, y0, x1, y0, 0, 0, 1); side(x1, y0, x1, y1, 40, 1, 0); side(x1, y1, x0, y1, 80, 0, 1); side(x0, y1, x0, y0, 120, 1, 0);
  ctx.closePath();
}

/** The side of tile t (a unit step [di, dj]) that passes `test`, or null. */
function tfSide(t, test) {
  const i = t % S.W, j = (t / S.W) | 0;
  for (const [di, dj] of [[-1, 0], [0, -1], [1, 0], [0, 1]]) if (inMap(i + di, j + dj) && test(tIdx(i + di, j + dj))) return [di, dj];
  return null;
}

/** What the drawing remembers of an Earthworks site (looks only): which way the work goes, its seed. */
function tfInfo(b) {
  const R0 = R.tfInfo || (R.tfInfo = new Map());
  let I = R0.get(b.id);
  if (!I) { I = { seed: (b.id * 2654435761) >>> 0, dir: null }; R0.set(b.id, I); }
  const t = tIdx(b.x, b.y);
  if (!I.dir) {
    // (the way the work moves: a tongue of land out from the shore, a channel in from the water)
    const side = b.tf.k === 'fill' ? tfSide(t, (u) => S.terrain[u] === T_GROUND) : b.tf.k === 'dig' ? tfSide(t, (u) => S.terrain[u] === T_WATER) : null;
    if (side) I.dir = [-side[0], -side[1]]; else if (b.tf.k === 'fill' || b.tf.k === 'dig') I.dir = [1, 0];
  }
  if (b.tf.k === 'down' || b.tf.k === 'up' || b.tf.k === 'soil' || b.tf.k === 'clear') {
    // A cut starts on the side its Grader works from and moves away from it (west to east until one is there).
    const g = tfGrader(b);
    if (g && g.task.phase !== 'go' && !I.locked) { const di = Math.sign(Math.round(b.x + 0.5 - g.x)), dj = Math.sign(Math.round(b.y + 0.5 - g.y)); if (di || dj) { I.dir = di ? [di, 0] : [0, dj]; I.locked = true; } }
    if (!I.dir) I.dir = [1, 0];
  }
  return I;
}

/** The Earthworks sites in play (refreshed twice a second), and the ground they leave fresh when they finish. */
function tfSites() {
  const C = R.tfCache;
  if (C && C.of === S && R.time - C.at < 0.5) return C.list;
  const list = S.buildings.filter((b) => !b.dead && !b.built && b.tf);
  if (C && C.of === S) {
    const now = new Set(list);
    for (const b of C.list) {
      if (now.has(b)) continue;
      if (b.dead && b.gone === 1 && b.tf) { // (finished: new ground, fresh for a while)
        const F = R.tfFresh || (R.tfFresh = new Map());
        F.set(tIdx(b.x, b.y), { t0: S.time, k: b.tf.k, seed: tfInfo(b).seed });
      }
      if (R.tfInfo) R.tfInfo.delete(b.id);
      if (R.tfFlat) R.tfFlat.delete(tIdx(b.x, b.y));
    }
  } else { R.tfFresh = null; R.tfTrail = null; R.tfInfo = null; R.tfFlat = null; } // (another game: nothing of the last one's)
  R.tfCache = { of: S, at: R.time, list };
  return list;
}

/**
 * The ground of the Earthworks (render, with the ground: graded for the time of day with it): each site's work, the
 * fresh ground jobs have left, the Graders' track marks.
 */
function tfGround(ctx, ox, oy, z, inView) {
  if (!S || !S.buildings) return;
  const sites = tfSites(), saver = tfSaver();
  if (!sites.length && !(R.tfFresh && R.tfFresh.size) && !(R.tfTrail && R.tfTrail.size)) return;
  ctx.save();
  // fresh ground, weathering back into the biome's
  if (R.tfFresh && R.tfFresh.size) for (const [t, F] of R.tfFresh) {
    const age = S.time - F.t0, i = t % S.W, j = (t / S.W) | 0;
    if (age > TF_FRESH || age < 0) { R.tfFresh.delete(t); continue; }
    if (saver || !inView(i, j, 1)) continue;
    tfFreshGround(ctx, t, F, ox + i * z, oy + j * z, z, 1 - age / TF_FRESH, ox, oy);
  }
  if (!saver && z >= 14) tfTracks(ctx, ox, oy, z, inView);
  for (const b of sites) {
    if (!inView(b.x, b.y, 2)) continue;
    tfSiteGround(ctx, b, ox + b.x * z, oy + b.y * z, z, ox, oy, saver);
  }
  ctx.restore();
}

/** Tile t's fresh ground after its job (k), `f` 1 just done .. 0 weathered in. */
function tfFreshGround(ctx, t, F, x, y, z, f, ox, oy) {
  const soil = tfSoil(renderBiomeAt(t));
  if (S.terrain[t] === T_GROUND) {
    ctx.globalAlpha = 0.72 * f * f; ctx.fillStyle = tfPattern(ctx, soil, soil.img, ox, oy, z, 1);
    tfRagged(ctx, x - z * 0.04, y - z * 0.04, x + z * 1.04, y + z * 1.04, F.seed, z * 0.08); ctx.fill();
  } else if (S.terrain[t] === T_WATER) {
    // a dug tile: silt still settling in the water, and its banks of fresh soil
    const pl = ART['fx-mud-plume'];
    if (pl) { ctx.globalAlpha = 0.55 * f; drawSheetFrame(ctx, pl, F.seed % 3, x + z / 2, y + z / 2, z * 1.3, 0, (F.seed % 4) * Math.PI / 2); }
    ctx.globalAlpha = 0.7 * f * f; ctx.fillStyle = tfPattern(ctx, soil, soil.img, ox, oy, z, 1);
    const i = t % S.W, j = (t / S.W) | 0;
    for (const [di, dj] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      if (!inMap(i + di, j + dj) || S.terrain[tIdx(i + di, j + dj)] !== T_GROUND) continue;
      const bx = di < 0 ? x - z * 0.2 : di > 0 ? x + z : x, by = dj < 0 ? y - z * 0.2 : dj > 0 ? y + z : y;
      tfRagged(ctx, bx, by, bx + (di ? z * 0.2 : z), by + (dj ? z * 0.2 : z), F.seed + di * 3 + dj * 7, z * 0.06); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

/** The ground of one Earthworks site at (x, y), z px a tile: the job's look at its progress. */
function tfSiteGround(ctx, b, x, y, z, ox, oy, saver) {
  const J = b.tf, k = clamp(b.progress || 0, 0, 1), t = tIdx(b.x, b.y), I = tfInfo(b), bio = renderBiomeAt(t);
  const soil = tfSoil(bio), [di, dj] = I.dir, sd = I.seed;
  const soilFill = () => tfPattern(ctx, soil, soil.img, ox, oy, z, 1);
  // A rectangle running along the work's direction, from its start edge (`a0`..`a1` along, `w` across, centred).
  const band = (a0, a1, w, c0 = 0.5) => {
    const lo = Math.min(a0, a1), hi = Math.max(a0, a1);
    if (di) { const xa = di > 0 ? x + lo * z : x + z - hi * z; return [xa, y + (c0 - w / 2) * z, xa + (hi - lo) * z, y + (c0 + w / 2) * z]; }
    const ya = dj > 0 ? y + lo * z : y + z - hi * z; return [x + (c0 - w / 2) * z, ya, x + (c0 + w / 2) * z, ya + (hi - lo) * z];
  };
  const along = (a, c = 0.5) => (di ? [di > 0 ? x + a * z : x + z - a * z, y + c * z] : [x + c * z, dj > 0 ? y + a * z : y + z - a * z]);
  const heap = (kind, a, c, r, v) => { const [hx, hy] = along(a, c), img = tfHeap(kind, bio, v); ctx.drawImage(img, hx - r * z * 1.39, hy - r * z * 1.39, r * z * 2.78, r * z * 2.78); };
  if (J.k === 'down') {
    if (k <= 0) return; // (planned, not started: the ground as it is)
    // Lower (and Flatten down): the cut opens from the Grader's side, its face moving across; a spoil heap grows
    // beside it. The pit's far walls lit, the near ones in shade (light from the upper left).
    const f = 0.06 + 0.94 * k, deep = Math.min(1, (J.n || 1) * 0.6);
    const r = band(0, f, 1);
    ctx.fillStyle = soilFill(); tfRagged(ctx, r[0], r[1], r[2], r[3], sd, z * 0.05); ctx.fill();
    ctx.fillStyle = `rgba(28,16,8,${0.16 + 0.2 * deep})`; ctx.fill();
    const gw = z * 0.09;
    let g = ctx.createLinearGradient(r[0], 0, r[0] + gw, 0); g.addColorStop(0, 'rgba(20,10,4,0.55)'); g.addColorStop(1, 'rgba(20,10,4,0)');
    ctx.fillStyle = g; ctx.fillRect(r[0], r[1], gw, r[3] - r[1]);
    g = ctx.createLinearGradient(0, r[1], 0, r[1] + gw); g.addColorStop(0, 'rgba(20,10,4,0.5)'); g.addColorStop(1, 'rgba(20,10,4,0)');
    ctx.fillStyle = g; ctx.fillRect(r[0], r[1], r[2] - r[0], gw);
    ctx.strokeStyle = `rgba(255,236,200,${0.18 + 0.1 * deep})`; ctx.lineWidth = Math.max(1, z * 0.025);
    ctx.beginPath(); ctx.moveTo(r[0], r[3]); ctx.lineTo(r[2], r[3]); ctx.lineTo(r[2], r[1]); ctx.stroke();
    // the face being cut: a dark edge where the blade is biting
    const [fx, fy] = along(f, 0);
    ctx.strokeStyle = 'rgba(24,12,6,0.55)'; ctx.lineWidth = Math.max(1.5, z * 0.05);
    ctx.beginPath(); if (di) { ctx.moveTo(fx, y); ctx.lineTo(fx, y + z); } else { ctx.moveTo(x, fy); ctx.lineTo(x + z, fy); } ctx.stroke();
    heap('spoil', 1.02, 0.5, 0.09 + 0.17 * Math.sqrt(k), sd % 5);
  } else if (J.k === 'up') {
    // Raise (and Flatten up): fill heaped on, spread with the blade, then levelled; the new level's south face as a band.
    const lv = clamp((k - 0.55) / 0.45, 0, 1), spread = clamp(k / 0.7, 0, 1);
    if (k > 0.02) {
      ctx.globalAlpha = clamp(k / 0.15, 0, 1); ctx.fillStyle = soilFill();
      tfRagged(ctx, x + z * 0.04, y + z * 0.04, x + z * 0.96, y + z * 0.96, sd, z * 0.06); ctx.fill();
      if (lv > 0) {
        ctx.globalAlpha = lv; ctx.fillStyle = 'rgba(30,16,8,0.5)';
        tfRagged(ctx, x + z * 0.04, y + z * 0.9, x + z * 0.96, y + z * (0.96 + 0.08 * lv), sd + 9, z * 0.03); ctx.fill();
        ctx.strokeStyle = `rgba(255,236,200,${0.25 * lv})`; ctx.lineWidth = Math.max(1, z * 0.025);
        ctx.beginPath(); ctx.moveTo(x + z * 0.05, y + z * 0.92); ctx.lineTo(x + z * 0.05, y + z * 0.05); ctx.lineTo(x + z * 0.95, y + z * 0.05); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    if (lv < 1 && k > 0) { ctx.globalAlpha = (1 - lv) * clamp(k / 0.08, 0, 1); heap('fill', 0.3 + 0.25 * spread, 0.5, 0.14 + 0.24 * Math.min(1, k / 0.5), sd % 5); ctx.globalAlpha = 1; }
    if (k < 0.9 && siteFrac(b) > k + 0.02) heap('stone', 0.12, 0.84, 0.07 + 0.05 * (1 - k), (sd >> 3) % 5); // (the Stone brought for it, not yet worked in)
  } else if (J.k === 'fill') {
    if (k <= 0) return;
    // Fill shallows: a tongue of new land pushed out from the shore, a muddy plume spreading ahead, a foam rim.
    const L = 0.04 + 0.96 * k, w = k > 0.92 ? 1 : 0.78, r = band(0, L, w);
    if (!saver && k < 0.98 && ART['fx-mud-plume']) {
      const [px, py] = along(L + 0.25), ang = Math.atan2(dj, di) * 1;
      ctx.globalAlpha = 1 - 0.4 * k; const pl = ART['fx-mud-plume'];
      drawSheetFrame(ctx, pl, sd % 3, px, py, z * (1.1 + 0.6 * k), 0, ang); drawSheetFrame(ctx, pl, (sd + 1) % 3, px + di * z * 0.1, py + dj * z * 0.1, z * (0.8 + 0.5 * k), 0, ang + 0.6);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = soilFill(); tfRagged(ctx, r[0], r[1], r[2], r[3], sd, z * 0.06); ctx.fill();
    ctx.fillStyle = 'rgba(30,16,8,0.3)'; ctx.fill(); // (wet)
    ctx.strokeStyle = 'rgba(238,246,247,0.55)'; ctx.lineWidth = Math.max(1, z * 0.045); ctx.stroke();
  } else if (J.k === 'soil' || J.k === 'clear') {
    if (k <= 0) return;
    // Stage 2: Spread soil lays dark humus across the tile from the Grader's side, a heap of it ahead of the blade;
    // Reclaim levels fresh earth over the crater or scorch, the same way.
    const f = 0.06 + 0.94 * k, r = band(0, f, 1);
    ctx.fillStyle = soilFill(); tfRagged(ctx, r[0], r[1], r[2], r[3], sd, z * 0.05); ctx.fill();
    if (J.k === 'soil') { ctx.fillStyle = 'rgba(34,20,10,0.42)'; ctx.fill(); }
    if (k < 0.95) heap(J.k === 'soil' ? 'fill' : 'spoil', Math.min(0.98, f + 0.08), 0.5, 0.1 + 0.08 * (1 - k), sd % 5);
  } else if (J.k === 'dig') {
    if (k <= 0) return;
    // Dig channel: a trench cut in from the water, the water following it in with a muddy front; spoil berms either side.
    const L = 0.05 + 0.95 * k, w = k > 0.88 ? 0.46 + (k - 0.88) / 0.12 * 0.54 : 0.46;
    for (const c of [0.5 - w / 2 - 0.1, 0.5 + w / 2 + 0.1]) { // berms
      const r = band(0, L, 0.18, c);
      ctx.fillStyle = soilFill(); tfRagged(ctx, r[0], r[1], r[2], r[3], sd + c * 10, z * 0.04); ctx.fill();
      ctx.fillStyle = 'rgba(255,230,190,0.12)'; ctx.fill();
    }
    const r = band(0, L, w);
    ctx.fillStyle = soilFill(); tfRagged(ctx, r[0], r[1], r[2], r[3], sd, z * 0.03); ctx.fill();
    ctx.fillStyle = 'rgba(28,14,6,0.35)'; ctx.fill();
    const wl = Math.max(0, L - 0.22); // (the water, a little behind the cut)
    if (wl > 0.01) {
      const q = band(0, wl, w * 0.86), wt = R.tex && R.tex.water, H = R.tfWater || (R.tfWater = {});
      if (wt && H.img !== wt.img) { H.img = wt.img; H.pat = null; }
      ctx.fillStyle = wt ? tfPattern(ctx, H, wt.img, ox, oy, z, 4) : '#2f7fa8';
      ctx.fillRect(q[0], q[1], q[2] - q[0], q[3] - q[1]);
      const [hx, hy] = along(wl);
      const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, z * 0.28); g.addColorStop(0, 'rgba(150,98,62,0.7)'); g.addColorStop(1, 'rgba(150,98,62,0)');
      ctx.save(); ctx.beginPath(); ctx.rect(q[0], q[1], q[2] - q[0], q[3] - q[1]); ctx.clip(); ctx.fillStyle = g; ctx.fillRect(hx - z * 0.3, hy - z * 0.3, z * 0.6, z * 0.6); ctx.restore();
    }
  }
}

/** Track marks the Graders leave: two bands of cleat prints along where they drove, fading out. */
function tfTracks(ctx, ox, oy, z, inView) {
  if (!R.tfTrail || !R.tfTrail.size) return;
  ctx.fillStyle = 'rgba(40,24,14,1)';
  for (const [id, T] of R.tfTrail) {
    const u = getE(id);
    while (T.length && R.time - T[0][3] > 45) T.shift();
    if (!T.length) { if (!u || u.dead) R.tfTrail.delete(id); continue; }
    const hx = u && !u.dead ? T[T.length - 1][0] : -99, hy = u && !u.dead ? T[T.length - 1][1] : -99;
    for (const [px, py, a, t0] of T) {
      if (!inView(px, py, 1) || (px - hx) ** 2 + (py - hy) ** 2 < 0.1) continue; // (none under the Grader itself)
      const age = (R.time - t0) / 45, c = Math.cos(a), s = Math.sin(a), sx = ox + px * z, sy = oy + py * z;
      ctx.globalAlpha = 0.3 * (1 - age);
      for (const side of [-0.125, 0.125]) {
        ctx.save(); ctx.translate(sx - s * side * z, sy + c * side * z); ctx.rotate(a);
        for (let q = -1; q <= 1; q++) ctx.fillRect(q * z * 0.035 - z * 0.012, -z * 0.04, z * 0.024, z * 0.08);
        ctx.restore();
      }
    }
  }
  ctx.globalAlpha = 1;
}

/**
 * One tile of a Terraform plan, in the road plans' language (drawPlans): job k ('up', 'down', 'flatten', 'fill' or
 * 'dig'), `prog` 0..1, `owed` waiting for Stone, `mine` the player's own, `dir` (dig) the way to the water.
 */
function tfPlanTile(ctx, x, y, z, k, prog, owed, mine, dir, work) {
  const m = z * 0.16, x0 = x + m, y0 = y + m, w = z - 2 * m, c = TF_COL[k] || '#ffffff';
  ctx.save();
  // (paler once the work is under way, so the ground being worked shows through)
  ctx.globalAlpha = owed ? 0.16 : (mine ? 0.23 : 0.11) * (prog > 0 ? 0.5 : 1); ctx.fillStyle = owed ? '#ffaa5a' : c; ctx.fillRect(x0, y0, w, w);
  if (prog > 0) { ctx.globalAlpha = 0.16; ctx.fillStyle = c; ctx.fillRect(x0, y0 + w * (1 - prog), w, w * prog); } // (its tint fills from the bottom)
  ctx.globalAlpha = 1;
  ctx.lineWidth = Math.max(1, z * 0.04);
  ctx.setLineDash(owed ? [z * 0.06, z * 0.12] : [z * 0.12, z * 0.09]);
  ctx.strokeStyle = owed ? 'rgba(255,140,60,0.95)' : mine ? 'rgba(255,209,102,0.9)' : 'rgba(255,120,120,0.5)';
  ctx.strokeRect(x0, y0, w, w);
  if (TOD.active && TOD.state.lights > 0.01) { // (interface lights: a slight glow after dark)
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.3 * TOD.state.lights; ctx.lineWidth = Math.max(2, z * 0.1); ctx.strokeRect(x0, y0, w, w);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }
  ctx.setLineDash([]);
  if (z >= 14) { // the job's glyph
    const cx = x + z / 2, cy = y + z / 2, s = z * 0.16, gw = Math.max(1.5, z * 0.045);
    ctx.lineWidth = gw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.globalAlpha = (mine ? 1 : 0.55) * (work ? 0.8 : 1);
    const both = (pts) => {
      for (const [col, d] of [['rgba(10,12,16,0.6)', gw * 0.6], [c, 0]]) {
        ctx.strokeStyle = col; ctx.beginPath(); pts.forEach(([px, py], q) => (q ? ctx.lineTo(px + d, py + d) : ctx.moveTo(px + d, py + d))); ctx.stroke();
      }
    };
    if (k === 'up' || k === 'down') {
      const q = k === 'up' ? -1 : 1;
      for (const o of [-0.6, 0.6]) both([[cx - s, cy + o * s - q * s * 0.5], [cx, cy + o * s + q * s * 0.5], [cx + s, cy + o * s - q * s * 0.5]]);
    } else if (k === 'flatten') {
      for (const o of [-0.5, 0, 0.5]) both([[cx - s * 1.2, cy + o * s * 1.1], [cx + s * 1.2, cy + o * s * 1.1]]);
    } else if (k === 'fill') {
      const pts = []; for (let q = 0; q < 9; q++) pts.push([cx - s * 1.2 + q * s * 0.3, cy - s * 0.45 + (q % 2 ? 0.25 : -0.25) * s]);
      both(pts); both([[cx - s * 1.2, cy + s * 0.6], [cx + s * 1.2, cy + s * 0.6]]);
      ctx.globalAlpha *= 0.5; ctx.fillStyle = c; ctx.fillRect(cx - s * 1.2, cy + s * 0.6, s * 2.4, s * 0.35);
    } else if (k === 'dig') {
      const [ddx, ddy] = dir || [1, 0], bw = z * 0.24;
      ctx.globalAlpha *= 0.47; ctx.fillStyle = 'rgb(40,120,190)';
      if (ddx) ctx.fillRect(x, cy - bw / 2, z, bw); else ctx.fillRect(cx - bw / 2, y, bw, z);
      ctx.globalAlpha = (mine ? 1 : 0.55) * (work ? 0.8 : 1);
      const R2 = (u, v) => [cx + u * ddx - v * ddy, cy + u * ddy + v * ddx];
      for (const o of [-0.55, 0.55]) both([R2(o * s - s * 0.45, -s * 0.55), R2(o * s + s * 0.15, 0), R2(o * s - s * 0.45, s * 0.55)]);
    } else if (k === 'soil') { // (stage 2: humus raked in, three furrows over a band of soil)
      ctx.globalAlpha *= 0.5; ctx.fillStyle = c; ctx.fillRect(cx - s * 1.2, cy - s * 0.9, s * 2.4, s * 1.8); ctx.globalAlpha = (mine ? 1 : 0.55) * (work ? 0.8 : 1);
      for (const o of [-0.55, 0, 0.55]) both([[cx - s * 1.1, cy + o * s + s * 0.18], [cx - s * 0.35, cy + o * s - s * 0.18], [cx + s * 0.4, cy + o * s + s * 0.18], [cx + s * 1.1, cy + o * s - s * 0.18]]);
    } else if (k === 'clear') { // (stage 2, Reclaim: a sprout over a levelled line)
      both([[cx - s * 1.2, cy + s * 0.8], [cx + s * 1.2, cy + s * 0.8]]);
      both([[cx, cy + s * 0.8], [cx, cy - s * 0.4]]);
      both([[cx, cy - s * 0.1], [cx - s * 0.7, cy - s * 0.7], [cx - s * 0.1, cy - s * 0.75], [cx, cy - s * 0.1]]);
      both([[cx, cy - s * 0.3], [cx + s * 0.7, cy - s * 0.95], [cx + s * 0.15, cy - s * 0.95], [cx, cy - s * 0.3]]);
    }
    ctx.globalAlpha = 1;
  }
  if (work || prog > 0) { // the road plans' bar, filling as the Grader works
    ctx.fillStyle = 'rgba(20,22,26,0.6)'; ctx.fillRect(x0, y0 + w - z * 0.12, w, z * 0.12);
    ctx.fillStyle = 'rgba(169,180,194,0.9)'; ctx.fillRect(x0, y0 + w - z * 0.12, w * prog, z * 0.12);
  }
  if (owed && z >= 14) { // a small Stone pip: waiting for a Hauler
    ctx.fillStyle = '#968f88'; ctx.strokeStyle = '#282420'; ctx.lineWidth = Math.max(1, z * 0.015);
    ctx.beginPath(); ctx.arc(x0 + w - z * 0.075, y0 + z * 0.105, z * 0.065, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

/** The plan being made (the Terraform mode): each tile's job as it will be placed, refused tiles crossed out. */
function tfDrawPlan(ctx, ox, oy, z, inView) {
  const F = typeof UI !== 'undefined' && UI.tf;
  if (R.mode !== 'terra' || !F || !F.prev) return;
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
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
    const k = F.tool === 'flatten' ? 'flatten' : J.k, dir = J.k === 'dig' ? tfSide(t, (u) => tfWet(u, F.prev.plan) && u !== t) : null;
    tfPlanTile(ctx, x, y, z, k, 0, false, true, dir, false);
    if (z >= 22 && J.k !== 'dig' && J.k !== 'soil' && J.k !== 'clear') { // (its new level, small in the corner)
      ctx.font = `700 ${Math.max(9, z * 0.2)}px system-ui, sans-serif`;
      ctx.fillStyle = 'rgba(10,12,16,0.75)'; ctx.fillText(String(J.to), x + z * 0.8 + 1, y + z * 0.22 + 1);
      ctx.fillStyle = '#fff'; ctx.fillText(String(J.to), x + z * 0.8, y + z * 0.22);
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
 * An Earthworks site (drawBuilding, unbuilt), over the ground tfGround drew: the survey stakes at its corners (their
 * tips lit in the owner's colour), the plan in the road plans' language, and a splash where earth goes into the water.
 */
function drawEarthwork(ctx, cx, cy, s, owner, b) {
  const J = b.tf || { k: 'up', to: 0 }, k = clamp(b.progress || 0, 0, 1), color = PLAYER_COLORS[owner] || '#9aa2ab';
  const x = cx - s / 2, y = cy - s / 2, t = tIdx(b.x, b.y), g = tfGrader(b), work = !!(g && g.task.phase !== 'go');
  const I = tfInfo(b), night = TOD.active ? TOD.state.lights : 0;
  // A splash where the earth goes over the shore (Fill shallows, a Grader at it).
  if (J.k === 'fill' && work && !tfSaver() && ART['fx-grader-splash'] && s >= 12) {
    const [di, dj] = I.dir, L = 0.04 + 0.96 * k, fr = Math.floor(R.time * 10 + I.seed) % 8, sp = tfGraded(ART['fx-grader-splash']);
    drawSheetFrame(ctx, sp, fr, (di ? (di > 0 ? x + L * s : x + s - L * s) : cx), (dj ? (dj > 0 ? y + L * s : y + s - L * s) : cy), s * 0.7, 0, 0);
  }
  // At night the Grader's work lights throw a pool of light over the ground it works.
  if (work && night > 0.02 && typeof fxGlow === 'function') fxGlow(ctx, cx, cy, s * 0.8, '#fff1c8', night * 0.3);
  // Survey stakes at the corners.
  if (s >= 12) {
    const st = tfStake(color), ss = s * 0.22;
    for (const [a, c] of [[0.1, 0.1], [0.9, 0.1], [0.1, 0.9], [0.9, 0.9]]) {
      ctx.drawImage(st, x + a * s - ss / 2, y + c * s - ss * 0.85, ss, ss);
      if (night > 0.02 && typeof fxGlow === 'function') fxGlow(ctx, x + a * s, y + c * s - ss * 0.6, ss * 0.45, color, night * 0.7);
    }
  }
  const owed = k < 1 && sumValues(siteCost(b)) > 0 && !tfReady(b);
  const kind = J.k === 'up' || J.k === 'down' ? (R.tfFlat && R.tfFlat.has(t) ? 'flatten' : J.k) : J.k;
  tfPlanTile(ctx, x, y, s, kind, k, owed, owner === ME, J.k === 'dig' ? [-I.dir[0], -I.dir[1]] : I.dir, work);
}

/** Effect art graded for the time of day (a sheet: its frames kept). */
function tfGraded(art) {
  if (!art || !TOD.active || typeof todGraded !== 'function' || !TOD.state.a || TOD.state.a === 'day') return art;
  const v = todGraded(art, TOD.state.a); // (fx- art is never re-lit by drawArt: TOD_NEVER)
  if (v && v !== art && !v.frames) { v.frames = art.frames; v.cols = art.cols; v.slice = art.slice; }
  return v || art;
}

/**
 * What Grader u is doing, for its art: 'idle', 'driving', or at work 'cutting' (lowering, digging), 'pushing'
 * (flattening down), 'filling' (raising, filling) or 'finishing' (the last passes over a job nearly done).
 */
function graderPose(u) {
  const t = u.task;
  if (t && t.type === 'build' && t.phase !== 'go') {
    const s = getE(t.site), k = s && s.tf ? s.tf.k : 'up';
    if (s && s.progress > 0.86) return 'finishing';
    return k === 'dig' || k === 'clear' ? 'cutting' : k === 'down' ? (s.tf.n > 1 ? 'pushing' : 'cutting') : k === 'soil' ? 'pushing' : 'filling';
  }
  return u.path && u.pi < u.path.length ? 'driving' : 'idle';
}

/** The Grader's placeholder sprite (while its art loads, or without it): tracks, hull, team stripe, cab, blade. */
const _graderArt = {};
function graderArt(owner, frame) {
  const team = artTeam(owner), key = `grader-code@${team}-f${frame}`;
  if (_graderArt[key]) return _graderArt[key];
  const n = 128, c = document.createElement('canvas'); c.width = c.height = n;
  const x = c.getContext('2d'), col = PLAYER_COLORS[owner] || '#38d4ff';
  x.translate(n / 2, n / 2);
  for (const sy of [-26, 18]) { x.fillStyle = '#1d1f24'; x.fillRect(-34, sy, 60, 8); x.fillStyle = '#3a3d44'; for (let k = -34 + (frame * 2); k < 26; k += 8) x.fillRect(k, sy + 1, 3, 6); }
  x.fillStyle = '#5b5e63'; x.fillRect(-30, -18, 52, 36); x.fillStyle = '#9c7a3c'; x.fillRect(-2, -14, 24, 28);
  x.fillStyle = col; x.fillRect(-30, -3, 52, 6); x.fillStyle = '#a7a397'; x.fillRect(-26, -14, 22, 28);
  x.fillStyle = '#c9a227'; x.fillRect(33, -32, 7, 64);
  return (_graderArt[key] = { img: c, scale: 1, key });
}

/**
 * Draw Grader u at (sx, sy), s pixels a tile: its rendered frames turned its way (driving: the blade raised and the
 * tracks rolling with distance driven; at work: the blade down, the earth heaped ahead of it, clods and dust off it,
 * rocking as it bites; finishing: passes back and forth), brake and dust overlays, exhaust, and after dark its
 * headlights, work lights and beacon.
 */
function drawGrader(ctx, u, sx, sy, s) {
  const pose = graderPose(u), work = pose !== 'driving' && pose !== 'idle', saver = tfSaver(), a = u.face || 0;
  const team = artTeam(u.owner), wf = Math.floor(R.time * 8 + u.id) % 4;
  let art = work ? ART[`grader-work@${team}-f${wf}`] : driveFrame(u);
  const rendered = !!art;
  if (!art) art = graderArt(u.owner, work ? wf : Math.floor((u.odo || 0) / FRAME_STEP) % 4);
  const size = s * (rendered ? 0.5 : 0.62), c = Math.cos(a), sn = Math.sin(a);
  // (rocking as the blade bites; the finishing passes back and forth over the new ground)
  // (at work it noses up to the edge of the tile it works, from the one beside it, and pushes in and backs off)
  const jig = !work ? 0 : (rendered ? s * 0.34 : 0) + (pose === 'finishing' ? Math.sin(R.time * 1.4 + u.id) * s * 0.12 : Math.sin(R.time * 1.1 + u.id) * s * 0.05 + Math.sin(R.time * 9 + u.id) * s * 0.012);
  const x = sx + c * jig, y = sy + sn * jig;
  // Track marks behind it (drawn with the ground: tfTracks).
  if (!saver) {
    const T0 = R.tfTrail || (R.tfTrail = new Map());
    let T = T0.get(u.id); if (!T) T0.set(u.id, (T = []));
    const wx = (x - R.w / 2) / s + R.cam.x, wy = (y - R.h / 2) / s + R.cam.y, last = T[T.length - 1]; // (where it's drawn)
    if (!last || (wx - last[0]) ** 2 + (wy - last[1]) ** 2 > 0.012) { T.push([wx, wy, a, R.time]); if (T.length > 60) T.shift(); }
  }
  drawBotShadow(ctx, u, x, y, size * 0.4, size * 0.34);
  // The earth heaped ahead of the blade (under the sprite: the blade stands in front of it).
  if (rendered && work && pose !== 'finishing') {
    const cyc = (R.time * 0.33 + u.id * 0.17) % 1;
    const n = pose === 'pushing' ? 3 : pose === 'cutting' ? 1 + Math.min(2, Math.floor(cyc * 3)) : 3 - Math.min(2, Math.floor(cyc * 3));
    const L = ART[`grader-load-${n}`];
    if (L) drawArt(ctx, L, x, y, size, a);
  }
  drawArt(ctx, art, x, y, size, a);
  if (rendered && !work) drawDriveOverlays(ctx, u, x, y, size);
  if (!saver) {
    // Clods and dust thrown off the blade.
    if (work && pose !== 'finishing' && ART['fx-grader-clods'] && s >= 12) {
      const fw = size * 0.95, d = size * 0.375 + fw * (24 / 128);
      drawSheetFrame(ctx, tfGraded(ART['fx-grader-clods']), Math.floor(R.time * 12 + u.id) % 8, x + c * d, y + sn * d, fw, 0, a);
    }
    // Exhaust off the stack: a few soft grey puffs, heavier at work.
    if (pose !== 'driving' && s >= 16) {
      const px = x + (c * 18 - sn * -30) / 256 * size, py = y + (sn * 18 + c * -30) / 256 * size;
      ctx.save();
      for (let q = 0; q < 3; q++) {
        const f = (R.time * (work ? 0.9 : 0.5) + q / 3 + u.id * 0.31) % 1;
        ctx.globalAlpha = (work ? 0.32 : 0.18) * (1 - f); ctx.fillStyle = '#4a4440';
        ctx.beginPath(); ctx.arc(px - f * s * 0.08, py - f * s * 0.16, s * (0.02 + 0.05 * f), 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
  }
  // After dark: the headlights and roof work lights (its own image), and the amber beacon turning while it works.
  if (rendered) drawHeadlights(ctx, 'grader', x, y, size, a);
  const night = TOD.active ? TOD.state.headlights : 0;
  if (!rendered && night > 0.02 && typeof fxGlow === 'function') fxGlow(ctx, x + c * size * 0.75, y + sn * size * 0.75, size * 0.5, '#fff2c8', night * 0.35);
  if (work && night > 0.02 && typeof fxGlow === 'function') {
    const bx = x + (c * -24 - sn * 28) / 256 * size, by = y + (sn * -24 + c * 28) / 256 * size, pulse = 0.5 + 0.5 * Math.sin(R.time * 7 + u.id);
    fxGlow(ctx, bx, by, size * 0.22, '#ffa632', night * (0.35 + 0.5 * pulse));
  }
}

'use strict';
/*
 * Terrafall — blueprints: a block of your buildings and the roads between them (a Smelter block, say), kept on this
 * device and placed again elsewhere in one go.
 *
 * Saving. On a computer, drag a box round buildings of yours on the map (a box that catches no warbots): a chip at
 * the foot of the map offers Save as blueprint. Anywhere, phones too: Build → Blueprints → New blueprint, then tap
 * your buildings to pick them (again to drop one; a mouse can drag a box round several) and Save blueprint. A
 * blueprint keeps each building's kind and place, and your roads (laid or planned) within a tile of them. Up to
 * BP_MAX are kept, newest first, each named after what it's mostly made of; the name can be changed in the list.
 *
 * Placing. Place on a blueprint shows it as a ghost: it follows the mouse, or goes where a finger taps (it starts in
 * the middle of the screen); Rotate (R) turns it a quarter turn. A piece that can't go there is red (the banner says
 * why), and a building past the site limit is red and dashed. Place here (or a click, or a second tap on the same
 * spot) plans every building site and road at once, through the usual orders (`place` for each building, one `paths`
 * for the roads, as Paths sends), then says how many went down and why the rest didn't. Display state only lives
 * here (UI.bpPick, UI.bpPlace, UI.bpOffer); the game changes only through those orders.
 */

const BP_KEY = 'terrafall.blueprints';
const BP_MAX = 8;      // blueprints kept on a device
const BP_PIECES = 30;  // buildings in one blueprint at most
const BP_OFFER = 8000; // ms the Save as blueprint chip stays after a box

/* ------------------------------------------------------------------ kept on this device */

/** Can a building of this kind go in a blueprint? What the Build menu places, and Walls and Gates. */
function bpKind(type) { return BUILD_MENU.includes(type) || type === 'wall' || type === 'gate'; }

/** Is it in this game (as the Build menu has it: war, a Nuclear race, Colony's Lab, a sea map)? */
function bpAvail(type) {
  const d = BDEFS[type];
  return !!d && (!(d.war || type === 'wall' || type === 'gate') || warOn()) && !(d.nuke && !nukeOn()) && !(d.colony && !labOn()) && !(d.naval && !navalMap());
}

function bpOk(bp) {
  const xy = (a, k) => Number.isInteger(a[k]) && Math.abs(a[k]) < 64;
  return !!bp && typeof bp.name === 'string' && Array.isArray(bp.b) && bp.b.length > 0 && bp.b.length <= BP_PIECES &&
    bp.b.every((p) => Array.isArray(p) && BDEFS[p[0]] && bpKind(p[0]) && xy(p, 1) && xy(p, 2)) && Array.isArray(bp.r) && bp.r.every((r) => Array.isArray(r) && xy(r, 0) && xy(r, 1));
}

/** The blueprints on this device, newest first: { name, b: [[type, dx, dy]...], r: [[dx, dy]...] } round the middle. */
function bpList() {
  let l = null;
  try { l = JSON.parse(localStorage.getItem(BP_KEY) || '[]'); } catch (e) { l = null; }
  return Array.isArray(l) ? l.filter(bpOk).slice(0, BP_MAX) : [];
}
function bpWrite(list) { try { localStorage.setItem(BP_KEY, JSON.stringify(list.slice(0, BP_MAX))); return true; } catch (e) { return false; } }

/** A blueprint of your buildings `ids` (the ones that can go in one) and your roads within a tile of them, or null. */
function bpFrom(ids) {
  const bs = [];
  for (const id of ids) { const b = getE(id); if (b && !b.dead && b.owner === ME && BDEFS[b.type] && bpKind(b.type) && S.buildings.includes(b)) bs.push(b); }
  if (!bs.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const b of bs) { x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x); y1 = Math.max(y1, b.y); }
  const cx = Math.floor((x0 + x1) / 2), cy = Math.floor((y0 + y1) / 2), on = new Set(bs.map((b) => tIdx(b.x, b.y))), r = [];
  for (let j = y0 - 1; j <= y1 + 1; j++) {
    for (let i = x0 - 1; i <= x1 + 1; i++) {
      if (!inMap(i, j)) continue;
      const t = tIdx(i, j);
      if (!on.has(t) && ((S.road[t] && wayOwner(t) === ME) || S.plan[t] === ME + 1)) r.push([i - cx, j - cy]);
    }
  }
  bs.sort((a, b) => a.y - b.y || a.x - b.x);
  return { name: '', b: bs.map((b) => [b.type, b.x - cx, b.y - cy]), r, cx, cy }; // (cx, cy: where its middle is now; not kept)
}

/** A name for a new blueprint, after what it's mostly made of ("Smelter block"; "Smelter block 2" if that's taken). */
function bpName(bp, list) {
  const n = {};
  for (const [t] of bp.b) n[t] = (n[t] || 0) + 1;
  const wall = (t) => (t === 'wall' || t === 'gate' ? 1 : 0); // (named after its buildings, before its Walls)
  const top = Object.keys(n).sort((a, b) => wall(a) - wall(b) || n[b] - n[a])[0];
  const base = bp.b.length === 1 ? BDEFS[top].name : `${BDEFS[top].name} block`;
  let name = base, k = 2;
  while (list.some((o) => o.name === name)) name = `${base} ${k++}`;
  return name;
}

/** "4 buildings and 12 road tiles" */
function bpCounts(nb, nr) { return `${nb} building${nb === 1 ? '' : 's'}${nr ? ` and ${nr} road tile${nr === 1 ? '' : 's'}` : ''}`; }

/** A small picture of a blueprint: its roads, and each building's icon where it stands. */
function bpThumb(bp) {
  const xs = bp.b.map((p) => p[1]).concat(bp.r.map((r) => r[0])), ys = bp.b.map((p) => p[2]).concat(bp.r.map((r) => r[1]));
  const x0 = Math.min(...xs), y0 = Math.min(...ys), w = Math.max(...xs) - x0 + 1, h = Math.max(...ys) - y0 + 1;
  return `<svg class="bp-thumb" viewBox="${x0} ${y0} ${w} ${h}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">` +
    bp.r.map(([x, y]) => `<rect x="${x + 0.06}" y="${y + 0.06}" width="0.88" height="0.88" rx="0.12" fill="#5c6575"/>`).join('') +
    bp.b.map(([t, x, y]) => `<image href="${iconFor(t, ME)}" x="${x}" y="${y}" width="1" height="1"/>`).join('') + '</svg>';
}

/* ------------------------------------------------------------------ the Blueprints panel (Build → Blueprints) */

/** The Build menu's Blueprints card: how many are kept. */
function bpCardText() { const n = bpList().length; return n ? `${n} saved: place one, or save another` : 'Save a block of buildings to place again'; }

/** The list of blueprints: each with its picture, its name (to change), Place and Delete; and New blueprint. */
function openBlueprints(focus) {
  const list = bpList();
  const rows = list.map((bp, k) => `<div class="bp-row">${bpThumb(bp)}<div class="bp-mid"><input class="bp-name" data-k="${k}" maxlength="40" value="${esc(bp.name)}" aria-label="Blueprint name" spellcheck="false">` +
    `<small>${bpCounts(bp.b.length, bp.r.length)}</small></div><button class="btn small primary" data-place="${k}">Place</button>` +
    `<button class="btn small ghost bp-del" data-del="${k}" aria-label="Delete the blueprint" title="Delete">✕</button></div>`).join('');
  openSheet('bp', 0, `<div class="sheet-title"><h3>Blueprints</h3></div>
    <p class="desc">A block of your buildings and the roads between them, kept on this device (up to ${BP_MAX}). Place one and every building site and road in it is planned at once, wherever it fits.</p>
    <button class="btn primary bp-new" id="bp-new">New blueprint: pick buildings</button>
    ${list.length ? `<div class="bp-list">${rows}</div>` : `<p class="hint">None yet. Tap <b>New blueprint</b> and pick buildings of yours (a Smelter with its Mine, say)${onTouch() ? '' : ', or drag a box round them on the map'}: their roads come with them.</p>`}`);
  $('bp-new').onclick = () => { sfx('click'); startBpPick([]); };
  const body = $('sheet-body');
  for (const btn of body.querySelectorAll('[data-place]')) btn.onclick = () => { sfx('click'); startBpPlace(+btn.dataset.place); };
  for (const btn of body.querySelectorAll('[data-del]')) btn.onclick = () => {
    const k = +btn.dataset.del, l = bpList();
    if (!l[k]) return;
    // (a second tap within 3 s deletes it, like Dismantle)
    if (!(UI.bpDel && UI.bpDel.k === k && performance.now() - UI.bpDel.at < 3000)) {
      UI.bpDel = { k, at: performance.now() }; sfx('click');
      btn.textContent = 'Delete?'; btn.classList.add('danger'); btn.classList.remove('ghost');
      return;
    }
    UI.bpDel = null;
    const gone = l.splice(k, 1)[0];
    bpWrite(l); sfx('click');
    toast(`Deleted the blueprint “${gone.name}”.`, 'info');
    openBlueprints();
  };
  for (const inp of body.querySelectorAll('.bp-name')) {
    inp.onchange = () => {
      const l = bpList(), bp = l[+inp.dataset.k], v = inp.value.replace(/\s+/g, ' ').trim().slice(0, 40);
      if (!bp) return;
      if (!v) { inp.value = bp.name; return; }
      bp.name = v; inp.value = v;
      bpWrite(l);
    };
    inp.onkeydown = (e) => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); inp.blur(); } };
  }
  const f = focus != null && body.querySelector(`.bp-name[data-k="${focus}"]`);
  if (f && !onTouch()) { f.focus(); f.select(); }
}

/* ------------------------------------------------------------------ picking buildings for a new one */

/** New blueprint: tap your buildings to pick them (they start as `ids`), then Save blueprint. */
function startBpPick(ids) {
  closeSheet();
  setMode('bppick');
  UI.bpPick = new Set(ids);
  UI.bpOffer = null; bpOfferShow();
  bpPickBanner();
}

function bpPickBanner(note) {
  const P = UI.bpPick, bp = P && P.size ? bpFrom([...P]) : null;
  const how = onTouch() ? '' : ' (or drag a box round several)';
  showBanner((note ? `<span class="err">${note}</span> ` : '') + (bp
    ? `<b>${bpCounts(bp.b.length, bp.r.length)}</b> picked. Tap more of your buildings to add them${how}, or one again to drop it.`
    : `Tap your buildings to put them in the blueprint${how}: a block of them, and the roads between them come too.`), bp ? 'Save blueprint' : null, 'Cancel');
}

/** A tap while picking: your building there goes in (or out). */
function bpPickTap(i, j, wx, wy) {
  const b = buildingAtTap(i, j, wx, wy);
  if (!b || b.dead || b.owner !== ME) { sfx('error'); bpPickBanner('Tap a building of yours.'); return; }
  if (!bpKind(b.type)) { sfx('error'); bpPickBanner(`The ${BDEFS[b.type].name} can't go in a blueprint.`); return; }
  if (UI.bpPick.has(b.id)) UI.bpPick.delete(b.id);
  else if (UI.bpPick.size >= BP_PIECES) { sfx('error'); bpPickBanner(`A blueprint takes up to ${BP_PIECES} buildings.`); return; }
  else UI.bpPick.add(b.id);
  sfx('click');
  bpPickBanner();
}

/** Your buildings that can go in a blueprint inside a box drawn on the screen (pixels). */
function bpInBox(box) {
  const x0 = Math.min(box.x0, box.x1), x1 = Math.max(box.x0, box.x1), y0 = Math.min(box.y0, box.y1), y1 = Math.max(box.y0, box.y1), ids = [];
  for (const b of S.buildings) {
    if (b.dead || b.owner !== ME || !bpKind(b.type)) continue;
    const p = worldToScreen(b.x + 0.5, b.y + 0.5);
    if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1) ids.push(b.id);
  }
  return ids;
}

/** A box drawn while picking: every building of yours in it goes in. */
function bpPickBox(box) {
  const ids = bpInBox(box);
  if (!ids.length) { bpPickBanner('No buildings of yours in that box.'); return; }
  for (const id of ids) if (UI.bpPick.size < BP_PIECES) UI.bpPick.add(id);
  sfx('click');
  bpPickBanner();
}

/**
 * A selection box on the map that caught no warbots (onSelectBox): if it caught buildings of yours, the chip at the
 * foot of the map offers to save them as a blueprint, for a few seconds. True if it did.
 */
function bpBoxOffer(box) {
  const ids = bpInBox(box).slice(0, BP_PIECES);
  if (!ids.length) return false;
  UI.bpOffer = { ids, of: S };
  bpOfferShow();
  const o = UI.bpOffer;
  setTimeout(() => { if (UI.bpOffer === o) { UI.bpOffer = null; bpOfferShow(); } }, BP_OFFER);
  return true;
}

/** The Save as blueprint chip (#bp-offer), on show while there's an offer. */
function bpOfferShow() {
  const el = $('bp-offer');
  if (UI.bpOffer && UI.bpOffer.of !== S) UI.bpOffer = null; // (from a game left since)
  const o = UI.bpOffer;
  if (!el) return;
  el.hidden = !o || !UI.inGame;
  if (!o) return;
  const bp = bpFrom(o.ids);
  if (!bp) { el.hidden = true; UI.bpOffer = null; return; }
  el.innerHTML = `<b>Save as blueprint</b><span class="us-name">${bpCounts(bp.b.length, bp.r.length)}</span>`;
  el.title = 'Keep these buildings and their roads as a blueprint, to place again elsewhere (Build → Blueprints)';
  el.onclick = () => { const ids = UI.bpOffer ? UI.bpOffer.ids : []; UI.bpOffer = null; bpOfferShow(); bpSave(ids); };
}

/** Keep these buildings (and their roads) as a new blueprint, then show the list with its name ready to change. */
function bpSave(ids) {
  const bp = bpFrom(ids);
  if (!bp) { sfx('error'); toast('Those buildings are gone.', 'warn'); return; }
  const list = bpList();
  list.unshift({ name: bpName(bp, list), b: bp.b, r: bp.r });
  const dropped = list.length > BP_MAX ? list[BP_MAX] : null;
  if (!bpWrite(list)) { sfx('error'); toast('The blueprint couldn\'t be kept: this device\'s storage is full or switched off.', 'warn'); return; }
  sfx('place');
  setMode('normal');
  toast(`Saved the blueprint “${list[0].name}”: ${bpCounts(bp.b.length, bp.r.length)}. Place it from Build → Blueprints.` + (dropped ? ` (The oldest, “${dropped.name}”, made way for it.)` : ''), 'good');
  openBlueprints(0);
}

/* ------------------------------------------------------------------ placing one */

/** (dx, dy) turned k quarter turns clockwise. */
function bpTurn(dx, dy, k) { return k === 1 ? [-dy, dx] : k === 2 ? [-dx, -dy] : k === 3 ? [dy, -dx] : [dx, dy]; }

/** Place blueprint k: its ghost in the middle of the screen, to move (pointer or taps), turn and place. */
function startBpPlace(k) {
  const bp = bpList()[k];
  if (!bp) return;
  closeSheet();
  setMode('bpplace');
  UI.bpPlace = { bp, rot: 0, at: { i: clamp(Math.floor(R.cam.x), 0, S.W - 1), j: clamp(Math.floor(R.cam.y), 0, S.H - 1) }, ev: null };
  bpPlaceBanner();
}

/**
 * Where each piece of the blueprint would go, and whether it can: { pieces: [{ type, i, j, ok, over, why }],
 * roads: [{ i, j, ok, have }], fit, over, bad, why, roadsNew, roadsBad }. Worked out again when it moves or turns,
 * and twice a second (the map changes under it).
 */
function bpEval() {
  const P = UI.bpPlace;
  if (!P || !P.at || !S) return null;
  const key = `${P.at.i},${P.at.j},${P.rot}`, now = performance.now();
  if (P.ev && P.ev.key === key && now - P.ev.t < 500) return P.ev;
  const free = Math.max(0, MAX_SITES - siteCount(ME));
  let used = 0;
  const pieces = P.bp.b.map(([type, dx, dy]) => {
    const [ox, oy] = bpTurn(dx, dy, P.rot), i = P.at.i + ox, j = P.at.j + oy, p = { type, i, j, ok: false, over: false, why: '' };
    if (!bpAvail(type)) { p.why = `There are no ${BDEFS[type].name}s in this game.`; return p; }
    const chk = canPlace(ME, type, i, j);
    if (!chk.ok) { p.why = chk.reason; return p; }
    const counts = !BDEFS[type].prepaid && !BDEFS[type].ramp; // (Walls and Gates don't count toward the site limit)
    if (counts && used >= free) { p.over = true; p.why = `Over the site limit: ${MAX_SITES} sites at a time.`; return p; }
    if (counts) used++;
    p.ok = true;
    return p;
  });
  const at = new Set(pieces.map((p) => (inMap(p.i, p.j) ? tIdx(p.i, p.j) : -1)));
  const roads = P.bp.r.map(([dx, dy]) => {
    const [ox, oy] = bpTurn(dx, dy, P.rot), i = P.at.i + ox, j = P.at.j + oy;
    if (!inMap(i, j)) return { i, j, ok: false, have: false };
    const t = tIdx(i, j), have = !!(S.road[t] || S.plan[t]);
    return { i, j, have, ok: have || (!at.has(t) && canRoad(ME, i, j)) };
  });
  const badList = pieces.filter((p) => !p.ok && !p.over);
  P.ev = { key, t: now, pieces, roads, fit: pieces.filter((p) => p.ok).length, over: pieces.filter((p) => p.over).length, bad: badList.length,
    why: badList.length ? badList[0].why : '', roadsNew: roads.filter((r) => r.ok && !r.have).length, roadsBad: roads.filter((r) => !r.ok).length };
  return P.ev;
}

function bpPlaceBanner(note) {
  const P = UI.bpPlace, ev = bpEval();
  if (!P || !ev) return;
  const n = P.bp.b.length, touch = onTouch();
  const parts = [`${ev.fit} of ${n} building${n === 1 ? '' : 's'} fit here`];
  if (ev.over) parts.push(`${ev.over} more over the site limit (${MAX_SITES} at a time: dashed)`);
  if (ev.bad) parts.push(`${ev.bad} can't go (red): ${ev.why.replace(/\.$/, '')}`);
  const roads = ev.roadsNew || ev.roadsBad ? ` ${ev.roadsNew} road tile${ev.roadsNew === 1 ? '' : 's'} to plan${ev.roadsBad ? ` (${ev.roadsBad} can't go)` : ''}.` : '';
  showBanner((note ? `<span class="err">${note}</span> ` : '') + `<b>${esc(P.bp.name)}</b>: ${parts.join('; ')}.${roads} ` +
    `<span class="muted">${touch ? 'Tap the map to move it.' : 'Click to place it.'}</span>` +
    `<span class="keep-all"><button class="btn small" id="bp-rot">Rotate${touch ? '' : ' <kbd>R</kbd>'}</button></span>`, ev.fit || ev.roadsNew ? 'Place here' : null, 'Cancel');
  $('bp-rot').onclick = (e) => { e.stopPropagation(); bpRotate(); };
}

/** Rotate (R): a quarter turn clockwise. */
function bpRotate() {
  const P = UI.bpPlace;
  if (R.mode !== 'bpplace' || !P) return;
  P.rot = (P.rot + 1) % 4;
  sfx('click');
  bpPlaceBanner();
}

/** The mouse over the map: the ghost follows it. */
function bpHover(i, j) {
  const P = UI.bpPlace;
  if (!P || !inMap(i, j) || (P.at && P.at.i === i && P.at.j === j)) return;
  P.at = { i, j };
  bpPlaceBanner();
}

/** A tap (or click) on the map: on the ghost's spot it places it; elsewhere the ghost moves there. */
function bpPlaceTap(i, j) {
  const P = UI.bpPlace;
  if (!P || !inMap(i, j)) return;
  if (P.at && P.at.i === i && P.at.j === j) { bpPlaceNow(); return; }
  P.at = { i, j };
  sfx('click');
  bpPlaceBanner();
}

/**
 * Place here: every building that fits gets its site (`place`, one order each) and every road tile its plan (one
 * `paths` order, as Paths sends), then a message says how many went down, and why the rest didn't.
 */
function bpPlaceNow() {
  const P = UI.bpPlace;
  if (!P) return;
  P.ev = null;
  const ev = bpEval(), go = ev.pieces.filter((p) => p.ok), roads = ev.roads.filter((r) => r.ok && !r.have).map((r) => tIdx(r.i, r.j));
  if (!go.length && !roads.length) { sfx('error'); bpPlaceBanner('Nothing of it can go here.'); return; }
  const name = P.bp.name, n = P.bp.b.length, at = P.at, out = { placed: 0, why: '', laid: 0, roadWhy: '' };
  const why = [ev.over ? `${ev.over} held back by the site limit (${MAX_SITES} at a time): place it here again once some are built` : '', ev.bad ? `${ev.bad} couldn't go (${ev.why.replace(/\.$/, '')})` : ''];
  let left = go.length + (roads.length ? 1 : 0);
  const done = () => {
    if (--left > 0) return;
    const failed = go.length - out.placed;
    if (failed) why.push(`${failed} more couldn't go once the others were down (${out.why.replace(/\.$/, '')})`);
    const roadsText = roads.length ? ` and ${out.laid} road tile${out.laid === 1 ? '' : 's'} planned${out.roadWhy ? ` (${out.roadWhy.replace(/\.$/, '')})` : ''}` : '';
    const rest = why.filter(Boolean);
    toast(`${name}: ${out.placed} of ${n} building site${n === 1 ? '' : 's'} placed${roadsText}.` + (rest.length ? ` ${rest.join('; ')}.` : ''), rest.length ? 'warn' : 'good', at.i, at.j);
  };
  for (const p of go) {
    act('place', [p.type, p.i, p.j], (r) => {
      if (r && r.ok) { out.placed++; noteSiteUndo(r.id); } else if (!out.why) out.why = (r && r.reason) || 'it can\'t go there';
      done();
    });
  }
  if (roads.length) act('paths', [{ add: roads }], (r) => { out.laid = r ? r.laid : 0; out.roadWhy = (r && r.why) || ''; done(); });
  sfx('place'); haptic('order');
  addFx('ring', at.i + 0.5, at.j + 0.5, { color: PLAYER_COLORS[ME] });
  setMode('normal');
}

/* ------------------------------------------------------------------ on the map (drawn by render.js) */

/** The blueprint on the map: buildings being picked (or just boxed) with their roads, or the ghost being placed. */
function drawBlueprint(ctx, ox, oy, z) {
  if (typeof UI === 'undefined' || !S) return;
  const ids = R.mode === 'bppick' && UI.bpPick ? [...UI.bpPick] : UI.bpOffer && UI.bpOffer.of === S ? UI.bpOffer.ids : null;
  if (ids && ids.length) {
    const key = ids.join(',') + '|' + (S.roadVer || 0);
    if (!UI.bpShown || UI.bpShown.key !== key || performance.now() - UI.bpShown.t > 1000) UI.bpShown = { key, t: performance.now(), r: bpRoadTiles(ids) };
    ctx.fillStyle = 'rgba(56, 212, 255, 0.22)';
    for (const t of UI.bpShown.r) ctx.fillRect(ox + (t % S.W) * z + 1, oy + ((t / S.W) | 0) * z + 1, z - 2, z - 2);
    ctx.strokeStyle = '#38d4ff'; ctx.lineWidth = 2.5;
    ctx.setLineDash([z * 0.16, z * 0.1]); ctx.lineDashOffset = -R.time * z * 0.4;
    for (const id of ids) { const b = getE(id); if (b && !b.dead) ctx.strokeRect(ox + b.x * z + 2, oy + b.y * z + 2, z - 4, z - 4); }
    ctx.setLineDash([]); ctx.lineDashOffset = 0;
  }
  if (R.mode !== 'bpplace' || !UI.bpPlace) return;
  const ev = bpEval();
  if (!ev) return;
  for (const r of ev.roads) {
    if (r.have && r.ok) continue; // (already road there)
    ctx.fillStyle = r.ok ? 'rgba(125, 255, 160, 0.3)' : 'rgba(255, 107, 107, 0.4)';
    ctx.fillRect(ox + r.i * z + 1, oy + r.j * z + 1, z - 2, z - 2);
  }
  for (const p of ev.pieces) {
    const x = ox + p.i * z, y = oy + p.j * z;
    ctx.globalAlpha = p.ok ? 0.75 : 0.5;
    drawBuilding(ctx, p.type, x + z / 2, y + z / 2, z, ME, { built: true, garrison: [], stock: {}, aim: -Math.PI / 2 });
    ctx.globalAlpha = 1;
    if (!p.ok) { ctx.fillStyle = 'rgba(255, 70, 70, 0.28)'; ctx.fillRect(x + 1, y + 1, z - 2, z - 2); }
    ctx.strokeStyle = p.ok ? '#9dffb8' : '#ff6b6b'; ctx.lineWidth = 2.5;
    if (p.over) ctx.setLineDash([z * 0.14, z * 0.1]);
    ctx.strokeRect(x + 1, y + 1, z - 2, z - 2);
    ctx.setLineDash([]);
  }
}

/** The road tiles a blueprint of buildings `ids` would take with it, as map tiles. */
function bpRoadTiles(ids) {
  const bp = bpFrom(ids);
  return bp ? bp.r.map(([dx, dy]) => tIdx(bp.cx + dx, bp.cy + dy)) : [];
}

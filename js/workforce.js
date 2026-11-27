'use strict';
/*
 * Terrafall — the Workforce panel (Shift+W, or tap the Workers count in the top bar): what every Worker is doing, what
 * is held up for want of one, and the priority ladder of job types the Workers fill (WF_ROWS in defs.js; the rules are
 * dispatch's and wfOrder's in sim.js, every change an order in orders.js).
 *
 *  - What they're doing: a count for each activity (building, running buildings, stuck or waiting, carrying, paving,
 *    charging, free); tap one for its Workers, each in a line of plain words, and a line to go to that Worker.
 *  - Problems: sites waiting for a builder, buildings that want a Worker and don't get one (and why), the goods the
 *    colony is short of and what makes them; tap one to go there.
 *  - The ladder: on Auto it shows the order the game uses anyway (sites, repairs, then the buildings by what the economy
 *    needs, paving), with why; moving a row (drag it, or its arrows) makes it Manual: your order decides. Each row can
 *    have a minimum, a cap and a pin (the editor under the ladder, for the row tapped). Presets, Back to Auto and
 *    Rebalance now; and three presets of your own (Save as preset 1, 2, 3, each with a name you give it), kept on this
 *    device: loading one sends the same orders as setting it all by hand (wfPresetOrders), so a network game agrees.
 * While it's open the map shows each Worker with a line to its job in its activity's colour, and a small worker with a
 * red slash over each building that wants one (drawWorkerView in render.js calls wfMapOn and wfDrawWants).
 */

/** The activities, in the panel's order: [key, label, colour]. */
const WF_ACTS = [
  ['building', 'Building', '#ffb24a'], ['running', 'Running', '#5dd88a'], ['stuck', 'Stuck', '#ff4d8a'],
  ['carrying', 'Carrying', '#6ec8ff'], ['paving', 'Paving', '#d8c48a'], ['charging', 'Charging', '#c79bff'], ['free', 'Free', '#ffe45a'],
];
const WF_ACT = Object.fromEntries(WF_ACTS.map(([k, l, c]) => [k, { label: l, color: c }]));
const WF_PAGE = 7; // (Workers listed at a time: the list never scrolls)

/*
 * Your own presets: WF_MINE slots kept on this device (localStorage, never in the game or a save), each
 * { name, set: wfSettings(ME) or none yet }.
 */
const WF_MINE = 3, WF_MINE_KEY = 'terrafall.wfPresets', WF_NAME_MAX = 14;
function wfMineRead() {
  let l = null;
  try { l = JSON.parse(localStorage.getItem(WF_MINE_KEY) || 'null'); } catch (e) { l = null; }
  const out = [];
  for (let i = 0; i < WF_MINE; i++) {
    const q = Array.isArray(l) && l[i] && typeof l[i] === 'object' ? l[i] : {};
    const name = typeof q.name === 'string' && q.name.trim() ? q.name.trim().slice(0, WF_NAME_MAX) : `Custom ${i + 1}`;
    out.push({ name, set: q.set && typeof q.set === 'object' ? q.set : null });
  }
  return out;
}
function wfMineWrite(l) { try { localStorage.setItem(WF_MINE_KEY, JSON.stringify(l)); return true; } catch (e) { return false; } }
/** Save your Workforce settings now as preset i (0-based). */
function wfMineSave(i) {
  const l = wfMineRead();
  l[i].set = wfSettings(ME);
  if (S.mission) S.mission.wfSaved = 1; // (a mission's goal: Assembly Line, js/missions.js)
  if (!wfMineWrite(l)) { sfx('error'); toast('Couldn\'t save the preset: this browser keeps nothing for the game.', 'warn'); return; }
  sfx('click');
  toast(`Saved as preset ${i + 1}, “${l[i].name}”: ${l[i].set.order ? 'your ladder' : 'Auto'}${Object.keys(l[i].set.rows).length ? ' and your row settings' : ''}. Load it any time, in any game on this device.`, 'info');
  refreshWorkforce(true);
}
/** Load preset i: the orders that make your settings its (wfPresetOrders), as if set by hand. */
function wfMineLoad(i) {
  const q = wfMineRead()[i];
  if (!q.set) { sfx('error'); toast(`Preset ${i + 1} is empty: set the ladder the way you like it, then Save.`, 'info'); return; }
  const ords = wfPresetOrders(ME, q.set);
  if (!ords.length) { sfx('click'); toast(`“${q.name}” is what you have now.`, 'info'); return; }
  let n = 0;
  for (const [name, args] of ords) act(name, args, () => { if (++n === ords.length) { sfx('click'); toast(`“${q.name}” loaded: ${q.set.order ? `${WF_ROW[wfNormOrder(q.set.order)[0]].name} first` : 'Auto'}${Object.keys(q.set.rows || {}).length ? ', with its row settings' : ''}.`, 'info'); refreshWorkforce(true); } });
}
/** Rename preset i (its name box: Enter or leaving it). */
function wfMineName(i, v) {
  const l = wfMineRead(), name = String(v || '').trim().slice(0, WF_NAME_MAX) || `Custom ${i + 1}`;
  if (name === l[i].name) return;
  l[i].name = name;
  wfMineWrite(l);
  refreshWorkforce(true);
}

/** Is the Workforce panel open (and its map overlay on)? */
function wfMapOn() { return UI.sheetKind === 'wf'; }

function wfEsc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function wfName(b) { return b ? BDEFS[b.type].name : ''; }
function wfLower(s) { return s ? s[0].toLowerCase() + s.slice(1) : s; }
/** Where building or tile `at` is: { x, y } in tiles (the middle), for the camera and the map's lines. */
function wfSpot(at) { return at == null ? null : typeof at === 'number' ? { x: (at % S.W) + 0.5, y: ((at / S.W) | 0) + 0.5 } : { x: at.x + 0.5, y: at.y + 0.5 }; }

/**
 * What Worker u is doing, in plain words: { k: an activity (WF_ACTS), s: the words, at: the building or tile it's at or
 * going to (or null) }. "In the Chip Fab, waiting for Crystal for 3:20", "Walking to build the Keep".
 */
function wfWhat(u) {
  const t = u.task, tt = t && t.type, here = u.inside ? getE(u.inside) : null;
  const b = t && (getE(t.bld) || getE(t.site)) || null;
  if (tt === 'recycle' || u.recycleTo) return { k: 'free', s: 'Going to the Bot Foundry to be recycled', at: b };
  if (tt === 'charge' || tt === 'refuel' || (here && insideCharger(u) && !tt && (u.bat ?? 100) < 99)) {
    const c = b || here;
    return { k: 'charging', s: `${here ? 'Recharging' : 'Going to recharge'} at the ${wfName(c) || 'Fuel Station'} (${Math.round(u.bat ?? 100)}%)`, at: c };
  }
  if (tt === 'repair') return { k: 'charging', s: `${here ? 'Being repaired' : 'Going to be repaired'} at the ${wfName(b) || 'Repair Station'}`, at: b };
  if (tt === 'staff' && b) {
    const why = stallWhy(b);
    if (u.inside === b.id && why) return { k: 'stuck', s: `In the ${wfName(b)}, ${wfLower(why)}${b.stallSince != null && S.time - b.stallSince >= 5 ? ' for ' + fmtClock(S.time - b.stallSince) : ''}`, at: b };
    if (u.inside === b.id) return { k: 'running', s: `Running the ${wfName(b)}`, at: b };
    return { k: 'running', s: `Walking to run the ${wfName(b)}`, at: b };
  }
  if (tt === 'build' && b) {
    if (t.phase === 'wait') return { k: 'stuck', s: `At the ${wfName(b)} site, waiting for its goods${t.waitT != null ? ' for ' + fmtClock(S.time - t.waitT) : ''}`, at: b };
    if (t.phase === 'go') return { k: 'building', s: `Walking to build the ${wfName(b)}`, at: b };
    return { k: 'building', s: `Building the ${wfName(b)} (${Math.round((b.progress || 0) * 100)}%)`, at: b };
  }
  if (tt === 'fix' && b) return { k: 'building', s: `${t.phase === 'go' ? 'Walking to repair' : 'Repairing'} the ${wfName(b)}`, at: b };
  if (tt === 'mend') return { k: 'building', s: 'Mending a road the Quake cracked', at: t.tile };
  if (tt === 'magfix') return { k: 'building', s: 'Rebuilding a Maglev pylon', at: b };
  if (tt === 'capshaft') return { k: 'building', s: 'Capping a fallen Deep Core\'s shaft', at: b };
  if (tt === 'dammend') return { k: 'building', s: 'Shoring up a dam', at: t.tile };
  if (tt === 'strip') return { k: 'building', s: 'Stripping a building in the Town', at: t.tile };
  if (tt === 'pave') return { k: 'paving', s: t.phase === 'go' ? 'Walking to lay road' : 'Laying road', at: t.tile };
  if (tt === 'clear') { const r = RES[S.res[t.tile]]; return { k: 'paving', s: `${t.phase === 'go' ? 'Walking to clear' : 'Clearing'} ${r ? aOrAn(r.name.toLowerCase()) : 'ground'}`, at: t.tile }; }
  if (tt === 'haul') {
    const src = getE(t.src), dst = getE(t.dst), g = GOOD[t.good] ? GOOD[t.good].name : 'goods';
    return { k: 'carrying', s: `Carrying ${t.n || 1} ${g}${src ? ' from the ' + wfName(src) : ''}${dst ? ' to the ' + wfName(dst) : ''}`, at: t.phase === 'toSrc' ? src : dst };
  }
  if (tt === 'crate' || tt === 'loot' || tt === 'carry') return { k: 'carrying', s: 'Fetching goods from crates', at: null };
  if (u.failUntil > S.time) return { k: 'stuck', s: 'Found no way to its job: it tries again soon', at: null };
  if (tt === 'flee' || tt === 'cover') return { k: 'free', s: 'Keeping away from enemies', at: null };
  if (u.carry) return { k: 'carrying', s: `Taking ${GOOD[u.carry] ? GOOD[u.carry].name : 'goods'} to storage`, at: null };
  return { k: 'free', s: tt === 'home' ? 'Free, heading in to wait' : 'Free', at: null };
}

/** Your Workers, each with what it's doing (wfWhat), and how many there are of each activity. */
function wfWorkers() {
  const list = [], n = {};
  for (const [k] of WF_ACTS) n[k] = 0;
  for (const u of S.bots) {
    if (u.dead || u.owner !== ME || u.type !== 'worker') continue;
    const w = wfWhat(u);
    list.push({ u, ...w });
    n[w.k]++;
  }
  return { list, n };
}

/** How many of your Workers are free and how many the colony keeps free for building (as dispatch does). */
function wfFree() {
  let idle = 0;
  for (const u of S.bots) if (!u.dead && u.owner === ME && u.type === 'worker' && isIdleWorker(u)) idle++;
  return { idle, keep: wfKeepFree(ME, siteCount(ME) > 0 ? MIN_FREE_WORKERS : 1) };
}

/**
 * What's held up for want of a Worker, and the goods the colony is short of: [{ s, at, b }] (at: where to go).
 * Sites with their goods in and nobody to build them; buildings that want a Worker and could work, and why they don't
 * get one; for each good short (goodsWanted), what makes it and why that isn't helping.
 */
function wfProblems(auto) {
  const out = [], mine = S.buildings.filter((b) => !b.dead && b.owner === ME);
  const P = S.players[ME], counts = wfCounts(ME), fr = wfFree();
  const capped = (k) => counts[k] >= wfRow(ME, k).cap;
  const noneFree = fr.idle === 0 ? 'no Worker is free' : fr.idle <= fr.keep ? `only the ${fr.idle === 1 ? 'one' : fr.idle} kept free for building ${fr.idle === 1 ? 'is' : 'are'} free` : 'one is on the way';
  const sites = mine.filter((b) => !b.built && !b.builder && siteReady(b));
  for (const b of sites) {
    const danger = P.danger && dangerAt(ME, b.x, b.y);
    out.push({ s: `<b>${wfName(b)} site</b>: goods in, waiting for a builder${danger ? ' (enemies about: workers keep away)' : capped('sites') ? ' (Building sites are at their cap)' : ''}`, at: b, kind: 'site' });
  }
  // Terraform jobs (Earthworks sites) are a Grader's, never a Worker's: one line when they wait with no Grader on them.
  const earth = mine.filter((b) => !b.built && b.tf && tfReady(b) && !tfGrader(b));
  if (earth.length) {
    const graders = S.bots.filter((u) => !u.dead && u.owner === ME && BOTS[u.type].grader).length;
    out.push({ s: `<b>${earth.length} Earthworks</b> wait${earth.length === 1 ? 's' : ''} for a Grader: ${graders ? `your ${graders === 1 ? 'Grader is' : graders + ' Graders are'} busy` : 'order one at the Bot Foundry (Workers don\'t do them)'}`, at: earth[0], kind: 'site' });
  }
  // (one line for each kind of building: "2 Quarries want a Worker: no Worker is free"; a row held at your cap says so)
  const kinds = new Map();
  for (const b of mine) {
    if (!wantsStaff(b) || stallWhy(b)) continue;
    if (!kinds.has(b.type)) kinds.set(b.type, []);
    kinds.get(b.type).push(b);
  }
  for (const [type, bs] of kinds) {
    const k = wfRowOf(type), n = bs.length, row = WF_ROWS.find((r) => r.types && r.types.includes(type));
    const name = n === 1 ? BDEFS[type].name : `${n} ${row ? row.name : BDEFS[type].name + 's'}`;
    out.push({ s: `<b>${name}</b> want${n === 1 ? 's' : ''} a Worker: ${capped(k) ? `held at your cap of ${wfRow(ME, k).cap}` : noneFree}`, at: bs[0], kind: capped(k) ? 'capped' : 'staff' });
  }
  const want = auto.want, goods = Object.keys(want).sort((a, c) => want[c] - want[a] || GOODS.indexOf(a) - GOODS.indexOf(c));
  for (const g of goods) {
    const makers = mine.filter((b) => b.built && madeGoods(b).includes(g));
    const idle = makers.filter((b) => wantsStaff(b));
    const kind = Object.keys(BDEFS).find((t) => BDEFS[t].staff && !BDEFS[t].crew && ((BDEFS[t].make && BDEFS[t].make[g]) || (BDEFS[t].gather && gatherTypes(t).some((ty) => RES[ty].good === g))));
    const kname = kind ? BDEFS[kind].name : '';
    const plural = (n) => (n === 1 ? kname : WF_ROWS.find((r) => r.types && r.types.includes(kind))?.name || kname + 's');
    let s;
    if (!makers.length) s = kname ? `no ${kname} built` : 'nothing of yours makes it';
    else if (idle.length) s = `${idle.length} ${plural(idle.length)} unstaffed`;
    else {
      const stuck = makers.filter((b) => stallWhy(b));
      s = stuck.length ? `${stuck.length} ${plural(stuck.length)} ${wfLower(stallWhy(stuck[0]))}` : `every ${kname || 'maker'} is running`;
    }
    out.push({ s: `<b>${GOOD[g].name} short</b>: ${s} (${want[g]} waiting for it)`, at: idle[0] || makers[0] || null, kind: 'good', g });
  }
  return out;
}

/** The order the ladder shows: yours (Manual), or the one the game is using (Auto). */
function wfLadder(auto) { return wfOrder(ME) || auto.order; }

/** Should row k be on the ladder? Building sites, Repairs and Paving always; a row of buildings once you have one (or set it). */
function wfShown(k, mine) {
  if (!WF_ROW[k].types && k !== 'other') return true;
  const s = S.players[ME].wf && S.players[ME].wf.rows && S.players[ME].wf.rows[k];
  return !!s || mine.some((b) => b.built && wfRowOf(b.type) === k);
}

/** A row's line under its name: how it stands, and on Auto why it's where it is. */
function wfRowNote(k, auto, mine, manual) {
  if (k === 'sites') { const r = mine.filter((b) => !b.built && !b.builder && siteReady(b)).length, all = mine.filter((b) => !b.built).length; return all ? `${all} site${all === 1 ? '' : 's'}${r ? `, ${r} ready for a builder` : ''}` : 'no sites'; }
  if (k === 'repair') { const r = mine.filter((b) => b.built && b.fixLeft > 0).length; return r ? `${r} to repair` : 'nothing to repair'; }
  if (k === 'pave') {
    const n = planList(ME).length, c = S.clr && S.clrN > 0 ? clrTiles().filter((t) => S.clr[t] === ME + 1).length : 0;
    const bits = [n ? `${n} tile${n === 1 ? '' : 's'} of road planned` : '', c ? `${c} to clear` : ''].filter(Boolean);
    return bits.length ? bits.join(', ') : 'no road planned';
  }
  const bs = mine.filter((b) => b.built && wfRowOf(b.type) === k);
  const wait = bs.filter((b) => wantsStaff(b) && !stallWhy(b)).length, stuck = bs.filter((b) => b.staff && stallWhy(b)).length;
  const bits = [];
  if (!manual) {
    const why = auto.why[k], g = bs.length ? madeGoods(bs[0]).find((q) => auto.want[q]) || madeGoods(bs[0])[0] : null;
    if (why === 'wanted' && g) bits.push(`${GOOD[g].name} short`);
    else if (why === 'plenty' && g) bits.push(`plenty of ${GOOD[g].name}`);
    else if (why === 'high') bits.push('High priority');
    else if (why === 'low') bits.push('Low priority');
  }
  if (wait) bits.push(`${wait} want${wait === 1 ? 's' : ''} a Worker`);
  if (stuck) bits.push(`${stuck} stuck`);
  const off = bs.filter((b) => !b.staff && !b.staffInc).length - wait;
  if (off > 0) bits.push(`${off} can't work now`);
  return bits.join(' · ') || (bs.length ? 'all running' : 'none built');
}

/** Open the Workforce panel. */
function openWorkforce() {
  if (!UI.inGame || !S || !S.players[ME]) return;
  setMode('normal');
  UI.wfAct = UI.wfAct || 'stuck';
  UI.wfPage = 0;
  openSheet('wf', 0, `<div class="sheet-title"><div><h3>Workforce</h3></div></div>
    <div class="wf-grid" id="wf-grid">
      <section class="wf-col">
        <div class="section-label">What they're doing <span class="label-note" id="wf-total"></span></div>
        <div class="wf-acts" id="wf-acts">${WF_ACTS.map(([k, l, c]) => `<button type="button" class="wf-act" data-act="${k}" style="--c:${c}"><b>0</b><span>${l}</span></button>`).join('')}</div>
        <div class="wf-list" id="wf-list"></div>
        <div class="wf-pager" id="wf-pager"></div>
      </section>
      <section class="wf-col">
        <div class="section-label">Problems <span class="label-note" id="wf-pn"></span></div>
        <div class="wf-probs" id="wf-probs"></div>
        <div class="section-label">Who gets Workers first</div>
        <div class="seg" id="wf-mode"><button type="button" data-v="auto">Auto</button><button type="button" data-v="manual">Manual</button></div>
        <p class="hint" id="wf-mode-hint"></p>
        <div class="wf-presets" id="wf-presets">${Object.keys(WF_PRESETS).map((k) => `<button type="button" class="btn small" data-preset="${k}">${WF_PRESETS[k].name}</button>`).join('')}</div>
        <div class="section-label">Your presets <span class="label-note">on this device</span></div>
        <div class="wf-mine" id="wf-mine">${wfMineRead().map((q, i) => `<div class="wf-slot" data-slot="${i}"><input type="text" class="wf-sname" maxlength="${WF_NAME_MAX}" value="${wfEsc(q.name)}" aria-label="Name of preset ${i + 1}" spellcheck="false">` +
          `<div class="wf-sbtns"><button type="button" class="btn small" data-mine="load" aria-label="Load preset ${i + 1}">Load</button><button type="button" class="btn small ghost" data-mine="save" aria-label="Save as preset ${i + 1}" title="Save as preset ${i + 1}">Save</button></div></div>`).join('')}</div>
        <button type="button" class="btn primary" id="wf-rebal">Rebalance now</button>
        <p class="hint" id="wf-rebal-hint"></p>
      </section>
      <section class="wf-col wf-lcol">
        <div class="section-label">Priority ladder <span class="label-note">top first · drag or ▲▼</span></div>
        <ol class="wf-ladder" id="wf-ladder"></ol>
        <div class="wf-edit" id="wf-edit"></div>
      </section>
    </div>`);
  document.body.classList.add('sheet-wf');
  wfWire();
  refreshWorkforce(true);
}

/** The panel's buttons: one listener each part, by data attributes (the parts are rebuilt as the game moves). */
function wfWire() {
  const grid = $('wf-grid');
  // (a press holds the panel still until it's let go: a button rebuilt under the finger would lose its click)
  grid.addEventListener('pointerdown', () => { UI.wfHold = performance.now(); });
  grid.addEventListener('pointerup', () => { UI.wfHold = performance.now() - 450; });
  $('wf-acts').onclick = (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    sfx('click');
    UI.wfAct = UI.wfAct === b.dataset.act ? 'all' : b.dataset.act; UI.wfPage = 0;
    refreshWorkforce(true);
  };
  $('wf-list').onclick = (e) => { const r = e.target.closest('[data-u]'); if (r) wfGoTo(getE(+r.dataset.u)); };
  $('wf-pager').onclick = (e) => { const b = e.target.closest('[data-pg]'); if (!b) return; sfx('click'); UI.wfPage += +b.dataset.pg; refreshWorkforce(true); };
  $('wf-probs').onclick = (e) => { const r = e.target.closest('[data-at]'); if (r) wfGoTo(getE(+r.dataset.at)); };
  $('wf-mode').onclick = (e) => {
    const b = e.target.closest('[data-v]'); if (!b) return;
    if (b.dataset.v === 'auto') { if (wfOrder(ME)) act('wfOrder', [null], () => { sfx('click'); toast('Back to Auto: the game decides who gets Workers first again.', 'info'); refreshWorkforce(true); }); }
    else if (!wfOrder(ME)) act('wfOrder', [wfAutoOrder(ME).order], () => { sfx('click'); toast('Manual: the ladder stays in this order until you change it. Move rows to choose who gets Workers first.', 'info'); refreshWorkforce(true); });
  };
  $('wf-presets').onclick = (e) => {
    const b = e.target.closest('[data-preset]'); if (!b) return;
    act('wfPreset', [b.dataset.preset], () => { sfx('click'); toast(`${WF_PRESETS[b.dataset.preset].name} order: ${WF_PRESETS[b.dataset.preset].order.slice(0, 3).map((k) => WF_ROW[k].name).join(', ')} first.`, 'info'); refreshWorkforce(true); });
  };
  const mine = $('wf-mine');
  mine.onclick = (e) => {
    const b = e.target.closest('[data-mine]'); if (!b) return;
    const i = +b.closest('[data-slot]').dataset.slot;
    if (b.dataset.mine === 'save') wfMineSave(i); else wfMineLoad(i);
  };
  mine.addEventListener('change', (e) => { const s = e.target.closest('[data-slot]'); if (s && e.target.classList.contains('wf-sname')) wfMineName(+s.dataset.slot, e.target.value); });
  mine.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.classList.contains('wf-sname')) { e.preventDefault(); e.target.blur(); } });
  $('wf-rebal').onclick = () => act('wfRebalance', [], (n) => {
    if (!n) { sfx('error'); toast('Nothing to move: no job is waiting that a Worker could be taken off a stuck or plenty building for.', 'info'); return; }
    sfx('order');
    toast(`${n} Worker${n === 1 ? '' : 's'} taken off buildings that can't work or make plenty: they go to the jobs at the top of the ladder.`, 'info');
    refreshWorkforce(true);
  });
  const lad = $('wf-ladder');
  lad.onclick = (e) => {
    const li = e.target.closest('[data-k]'); if (!li) return;
    const mv = e.target.closest('[data-mv]');
    if (mv) { wfMove(li.dataset.k, +mv.dataset.mv); return; }
    sfx('click'); UI.wfSel = li.dataset.k; refreshWorkforce(true);
  };
  // Drag a row (a mouse): drop it over another to take that one's place.
  lad.addEventListener('dragstart', (e) => { const li = e.target.closest('[data-k]'); if (!li) return; UI.wfDrag = li.dataset.k; li.classList.add('drag'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', li.dataset.k); } catch (_) { /* (old browsers) */ } });
  lad.addEventListener('dragover', (e) => {
    if (!UI.wfDrag) return;
    e.preventDefault();
    const li = e.target.closest('[data-k]');
    for (const x of lad.children) x.classList.toggle('over', x === li && li.dataset.k !== UI.wfDrag);
  });
  lad.addEventListener('dragleave', (e) => { if (e.target === lad) for (const x of lad.children) x.classList.remove('over'); });
  lad.addEventListener('drop', (e) => {
    e.preventDefault();
    const li = e.target.closest('[data-k]'), k = UI.wfDrag;
    UI.wfDrag = null;
    if (!li || !k || li.dataset.k === k) { refreshWorkforce(true); return; }
    const vis = [...lad.children].map((x) => x.dataset.k);
    wfMove(k, vis.indexOf(li.dataset.k) - vis.indexOf(k));
  });
  lad.addEventListener('dragend', () => { if (UI.wfDrag) { UI.wfDrag = null; refreshWorkforce(true); } });
  $('wf-edit').onclick = (e) => {
    const b = e.target.closest('[data-ed]'); if (!b) return;
    const k = UI.wfSel, r = wfRow(ME, k), n = wfCounts(ME)[k];
    let what, v;
    if (b.dataset.ed === 'min-') { what = 'min'; v = Math.max(0, r.min - 1); }
    else if (b.dataset.ed === 'min+') { what = 'min'; v = Math.min(WF_MAX, r.min + 1); }
    else if (b.dataset.ed === 'cap-') { what = 'cap'; v = r.cap === Infinity ? Math.max(r.min, n - 1, 0) : Math.max(r.min, r.cap - 1); }
    else if (b.dataset.ed === 'cap+') { what = 'cap'; v = r.cap === Infinity ? -1 : r.cap + 1 > WF_MAX ? -1 : r.cap + 1; }
    else if (b.dataset.ed === 'cap0') { what = 'cap'; v = -1; }
    else { what = 'pin'; v = !r.pin; }
    act('wfRow', [k, what, v], () => { sfx('click'); refreshWorkforce(true); });
  };
}

/** Row k moves d places on the ladder (among the rows shown): the ladder becomes yours (Manual). */
function wfMove(k, d) {
  const auto = wfAutoOrder(ME), full = wfLadder(auto).slice(), mine = S.buildings.filter((b) => !b.dead && b.owner === ME);
  const vis = full.filter((q) => wfShown(q, mine)), i = vis.indexOf(k), j = Math.max(0, Math.min(vis.length - 1, i + d));
  if (i < 0 || i === j) { sfx('error'); return; }
  vis.splice(i, 1); vis.splice(j, 0, k);
  // (the rows not shown keep their places among the others)
  let n = 0;
  const order = full.map((q) => (wfShown(q, mine) ? vis[n++] : q));
  const was = !wfOrder(ME);
  act('wfOrder', [order], () => {
    sfx('click');
    UI.wfSel = k;
    if (was) toast(`Manual: your order decides now. ${WF_ROW[k].name} ${d < 0 ? 'up' : 'down'} to ${j + 1}. Back to Auto lets the game decide again.`, 'info');
    refreshWorkforce(true);
  });
}

/** Take the camera to a Worker (inside a building: the building) or a building, and mark it a moment; the panel stays open. */
function wfGoTo(e) {
  if (!e || e.dead) return;
  sfx('click');
  const inB = e.inside ? getE(e.inside) : null, x = inB ? inB.x + 0.5 : BDEFS[e.type] ? e.x + 0.5 : e.x, y = inB ? inB.y + 0.5 : BDEFS[e.type] ? e.y + 0.5 : e.y;
  centerOn(x, y);
  UI.wfFocus = { x, y, until: performance.now() + 2200 };
}

/** Bring the panel up to date (four times a second; `now`: at once, even while a button is held). */
function refreshWorkforce(now) {
  if (UI.sheetKind !== 'wf' || !$('wf-grid')) return;
  if (!now && (UI.wfDrag || (UI.wfHold && performance.now() - UI.wfHold < 500))) return;
  const auto = wfAutoOrder(ME), manual = !!wfOrder(ME), mine = S.buildings.filter((b) => !b.dead && b.owner === ME);
  const set = (id, html) => { const el = $(id); if (el && el.dataset.html !== html) { el.dataset.html = html; el.innerHTML = html; } };
  // What they're doing.
  const W = wfWorkers();
  $('wf-total').textContent = `${W.list.length} Worker${W.list.length === 1 ? '' : 's'}`;
  for (const b of $('wf-acts').children) {
    const k = b.dataset.act, n = W.n[k];
    b.firstChild.textContent = n;
    b.classList.toggle('on', UI.wfAct === k);
    b.classList.toggle('zero', !n);
  }
  const shown = UI.wfAct === 'all' ? W.list : W.list.filter((w) => w.k === UI.wfAct);
  const pages = Math.max(1, Math.ceil(shown.length / WF_PAGE));
  UI.wfPage = Math.max(0, Math.min(pages - 1, UI.wfPage || 0));
  const part = shown.slice(UI.wfPage * WF_PAGE, UI.wfPage * WF_PAGE + WF_PAGE);
  set('wf-list', part.length ? part.map((w) => `<button type="button" class="wf-li" data-u="${w.u.id}" style="--c:${WF_ACT[w.k].color}"><i></i><span>${w.s}</span></button>`).join('')
    : `<p class="hint">${UI.wfAct === 'all' ? 'No Workers.' : `None ${WF_ACT[UI.wfAct].label.toLowerCase()} now.`}</p>`);
  set('wf-pager', pages > 1 ? `<button type="button" class="btn small ghost" data-pg="-1"${UI.wfPage ? '' : ' disabled'} aria-label="Earlier">◀</button><span>${UI.wfPage * WF_PAGE + 1}–${Math.min(shown.length, UI.wfPage * WF_PAGE + WF_PAGE)} of ${shown.length}</span><button type="button" class="btn small ghost" data-pg="1"${UI.wfPage < pages - 1 ? '' : ' disabled'} aria-label="Later">▶</button>`
    : `<span>${UI.wfAct === 'all' ? 'All your Workers' : WF_ACT[UI.wfAct].label}: tap one to go to it${UI.wfAct === 'all' ? '' : ' (tap the count again for all)'}</span>`);
  // Problems.
  const probs = wfProblems(auto), most = innerHeight <= 760 ? 4 : innerHeight <= 820 ? 5 : 6; // (a short screen: fewer, so the panel never scrolls)
  $('wf-pn').textContent = probs.length ? String(probs.length) : '';
  set('wf-probs', probs.length ? probs.slice(0, most).map((q) => `<button type="button" class="wf-pr ${q.kind}"${q.at ? ` data-at="${q.at.id}"` : ''}><span>${q.s}</span></button>`).join('') +
    (probs.length > most ? `<p class="hint">and ${probs.length - most} more.</p>` : '') : '<p class="hint">None: every site with its goods in has a builder, and every building that could work has a Worker.</p>');
  // The mode, the presets, Rebalance.
  for (const b of $('wf-mode').children) b.classList.toggle('on', b.dataset.v === (manual ? 'manual' : 'auto'));
  $('wf-mode-hint').textContent = manual ? 'Manual: free Workers fill the rows top first, in your order (within a row, the shortages and High or Low priority decide). Auto gives the game the order back.'
    : 'Auto: the order the game uses, by what the economy needs now. Move a row (or pick a preset) to set your own.';
  // Your presets: an empty one says so, the one you have now is lit (the names are left alone while you type in them).
  const mineL = wfMineRead();
  for (const el of $('wf-mine').children) {
    const i = +el.dataset.slot, q = mineL[i], cur = !!q.set && !wfPresetOrders(ME, q.set).length;
    const ld = el.querySelector('[data-mine="load"]'), inp = el.querySelector('.wf-sname');
    el.classList.toggle('empty', !q.set);
    el.classList.toggle('on', cur);
    ld.disabled = !q.set;
    ld.title = q.set ? `Load “${q.name}”: ${q.set.order ? wfNormOrder(q.set.order).slice(0, 3).map((k) => WF_ROW[k].name).join(', ') + ' first' : 'Auto'}${Object.keys(q.set.rows || {}).length ? ', with its row settings' : ''}` : 'Empty: Save puts your ladder and row settings here';
    if (document.activeElement !== inp && inp.value !== q.name) inp.value = q.name;
  }
  const would = wfRebalance(ME, true);
  $('wf-rebal').disabled = !would;
  $('wf-rebal-hint').textContent = would ? `Takes ${would} Worker${would === 1 ? '' : 's'} off buildings that can't work or make what you have plenty of, for the jobs waiting at the top.` : 'Nothing to move now: no job waits that a stuck or plenty building\'s Worker could take.';
  // The ladder.
  const counts = wfCounts(ME), order = wfLadder(auto).filter((k) => wfShown(k, mine));
  if (!UI.wfSel || !order.includes(UI.wfSel)) UI.wfSel = order.find((k) => WF_ROW[k].types) || order[0];
  set('wf-ladder', order.map((k, i) => {
    const r = wfRow(ME, k), tags = (r.min ? `<em>≥${r.min}</em>` : '') + (r.cap !== Infinity ? `<em>≤${r.cap}</em>` : '') + (r.pin ? '<em class="pin">Pin</em>' : '');
    const of = WF_ROW[k].types || k === 'other' ? `<small>/${mine.filter((b) => b.built && wfRowOf(b.type) === k).length}</small>` : '';
    return `<li class="wf-row${UI.wfSel === k ? ' sel' : ''}" data-k="${k}" draggable="true"><span class="wf-grip" aria-hidden="true">⋮⋮</span><span class="wf-i">${i + 1}</span>` +
      `<span class="wf-name"><b>${WF_ROW[k].name}</b><small>${wfRowNote(k, auto, mine, manual)}</small></span><span class="wf-tags">${tags}</span>` +
      `<span class="wf-n" title="Workers on it${of ? ' / buildings' : ''}">${counts[k]}${of}</span>` +
      `<button type="button" class="wf-mv" data-mv="-1" aria-label="Move ${WF_ROW[k].name} up"${i ? '' : ' disabled'}>▲</button><button type="button" class="wf-mv" data-mv="1" aria-label="Move ${WF_ROW[k].name} down"${i < order.length - 1 ? '' : ' disabled'}>▼</button></li>`;
  }).join(''));
  const k = UI.wfSel, r = wfRow(ME, k);
  set('wf-edit', `<div class="wf-ed-name">${WF_ROW[k].name}<small>${counts[k]} Worker${counts[k] === 1 ? '' : 's'} on it now</small></div>
    <div class="wf-ed-row"><span>At least</span><button type="button" class="btn small" data-ed="min-" aria-label="Fewer"${r.min ? '' : ' disabled'}>−</button><b>${r.min}</b><button type="button" class="btn small" data-ed="min+" aria-label="More">+</button></div>
    <div class="wf-ed-row"><span>At most</span><button type="button" class="btn small" data-ed="cap-" aria-label="Fewer"${r.cap === 0 ? ' disabled' : ''}>−</button><b>${r.cap === Infinity ? 'any' : r.cap}</b><button type="button" class="btn small" data-ed="cap+" aria-label="More"${r.cap === Infinity ? ' disabled' : ''}>+</button></div>
    <button type="button" class="btn small${r.pin ? ' primary' : ''}" data-ed="pin" aria-pressed="${r.pin}">${r.pin ? 'Pinned' : 'Pin'}</button>
    <p class="hint">${r.pin ? 'Pinned: its Workers stay even when the game would move them for a shortage or because they can\'t work (at a stock limit one goes, and comes back first).' : 'At least: Workers are moved here (two at a time, from rows lower down) until it has that many. At most: the extra leave. Pin: never moved off by the game.'}</p>`);
}

/**
 * The map while the panel is open (drawWorkerView, render.js): a small worker with a red slash over each building of
 * yours that wants a Worker and could work, and over each site with its goods in and nobody to build it; and a ring
 * where the panel last sent the camera.
 */
function wfDrawWants(ctx, ox, oy, z) {
  ctx.save();
  const r = Math.max(7, z * 0.2);
  for (const b of S.buildings) {
    if (b.dead || b.owner !== ME) continue;
    if (!(b.built ? wantsStaff(b) && !stallWhy(b) : !b.builder && siteReady(b))) continue;
    const x = ox + (b.x + 0.5) * z, y = oy + (b.y + 0.12) * z - r * 0.4;
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = 'rgba(14,15,20,0.88)'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ff4d8a'; ctx.lineWidth = Math.max(1.2, r * 0.13); ctx.stroke();
    // (a worker: head and shoulders)
    ctx.fillStyle = '#ece6da';
    ctx.beginPath(); ctx.arc(x, y - r * 0.28, r * 0.26, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x, y + r * 0.34, r * 0.46, r * 0.3, 0, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = '#ff4d8a'; ctx.lineWidth = Math.max(1.5, r * 0.17); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - r * 0.62, y + r * 0.62); ctx.lineTo(x + r * 0.62, y - r * 0.62); ctx.stroke();
  }
  const F = UI.wfFocus;
  if (F && performance.now() < F.until) {
    const k = (F.until - performance.now()) / 2200, x = ox + F.x * z, y = oy + F.y * z;
    ctx.globalAlpha = Math.min(1, k * 1.5);
    ctx.strokeStyle = '#fff1ec'; ctx.lineWidth = Math.max(2, z * 0.07);
    ctx.beginPath(); ctx.arc(x, y, z * (0.7 + (1 - k) * 0.6), 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

/** A Worker's colour on the map while the panel is open, and where its line goes (wfWhat). */
function wfMapMark(u) { const w = wfWhat(u); return { color: WF_ACT[w.k].color, to: wfSpot(w.at), free: w.k === 'free' }; }

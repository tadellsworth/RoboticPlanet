'use strict';
/*
 * Interface helpers that never touch the game's rules (nothing here is an order, nothing is read by js/sim.js, and
 * hashState leaves it all out):
 *  - Camera spots: Shift+F1–F4 keeps the view, F1–F4 goes back to it; the 1–4 pips on the minimap do the same under a
 *    finger (tap an empty one to keep the view, tap a kept one to go there, hold it to keep the view there instead).
 *    Kept with the game (S.camSpots, a UI-only field like S.checkpointRun; in multiplayer only for this tab).
 *  - Recent alerts: J goes to the latest; pressed again within a few seconds, the one before, and so on (the last 8).
 *  - The goods' net change a minute (sampled here from playerGoods over the last ~60 s of game time) beside each
 *    counter on a wide screen and in its tooltip, a ring on a counter whose producers' output stores are nearly full
 *    (at least 90%: the haulers aren't keeping up), and the robot count when it nears the robot limit.
 *  - Save slots: the autosave (Continue's own save, botfall.save.v1) and five named slots, listed with their map, mode,
 *    game time and real date on the Saved games screen (pause menu Save → Slots, main menu Saved games), and the
 *    main menu's Continue card, which resumes whichever of them is the newest.
 */

const QOL = { s: null, samples: [], alerts: [], alertAt: 0, alertI: 0, full: {}, fullAt: {}, fullWarned: {}, botWarn: 0, spots: null, flashT: 0 };
const CAM_SPOTS = 4, ALERTS_KEEP = 8, RATE_WINDOW = 60;
const SLOTS = 5, SLOT_PREFIX = 'terrafall.slot.', SAVE_META_KEY = 'terrafall.saveMeta.v1';

/** A new game (or a loaded one) starts with no samples, no alerts and no warnings. */
function qolReset() {
  if (QOL.s === S) return;
  QOL.s = S; QOL.samples = []; QOL.alerts = []; QOL.alertI = 0; QOL.full = {}; QOL.fullAt = {}; QOL.fullWarned = {}; QOL.botWarn = 0; QOL.spots = null;
}

/** A short line in the middle of the screen for a moment (not kept with the messages). */
function qolFlash(text) {
  let el = $('qol-flash');
  if (!el) { el = document.createElement('div'); el.id = 'qol-flash'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.textContent = text;
  el.classList.remove('out');
  el.hidden = false;
  clearTimeout(QOL.flashT);
  QOL.flashT = setTimeout(() => { el.classList.add('out'); QOL.flashT = setTimeout(() => { el.hidden = true; }, 400); }, 2600);
}

/* ------------------------------------------------------------------ camera spots */

function camSpotList() {
  if (!S) return [];
  if (typeof MP !== 'undefined' && MP.on) return QOL.spots || (QOL.spots = []);
  if (!Array.isArray(S.camSpots)) S.camSpots = [];
  return S.camSpots;
}
function camSpotOk(c) { return !!c && Number.isFinite(c.x) && Number.isFinite(c.y) && Number.isFinite(c.z); }
function canCamSpot() { return UI.inGame && S && !UI.watch; }

function saveCamSpot(n) {
  if (!canCamSpot() || n < 1 || n > CAM_SPOTS) return;
  const r2 = (v) => Math.round(v * 100) / 100;
  camSpotList()[n - 1] = { x: r2(R.cam.x), y: r2(R.cam.y), z: r2(R.cam.z) };
  for (let i = 0; i < CAM_SPOTS; i++) if (camSpotList()[i] === undefined) camSpotList()[i] = null;
  sfx('place');
  qolFlash(onTouch() ? `View kept as spot ${n}: tap ${n} on the minimap to come back.` : `View kept as spot ${n}: F${n} brings you back.`);
  syncCamSpots();
}

function goCamSpot(n) {
  if (!canCamSpot()) return;
  const c = camSpotList()[n - 1];
  if (!camSpotOk(c)) { sfx('error'); qolFlash(onTouch() ? `No view kept as spot ${n} yet: tap its pip on the minimap to keep one.` : `No view kept as spot ${n} yet: Shift+F${n} keeps this one.`); return; }
  R.cam.z = clamp(c.z, minZoom(), maxZoom());
  centerOn(c.x, c.y);
  sfx('click');
}

/** The 1–4 pips on the minimap: kept spots lit. */
function syncCamSpots() {
  const box = $('mm-spots');
  if (!box) return;
  const l = canCamSpot() ? camSpotList() : [];
  for (const b of box.children) {
    const n = +b.dataset.n, on = camSpotOk(l[n - 1]);
    b.classList.toggle('on', on);
    b.title = on ? `Spot ${n}: go there (F${n}); hold to keep this view instead (Shift+F${n})` : `Keep this view as spot ${n} (Shift+F${n})`;
    b.setAttribute('aria-label', on ? `Camera spot ${n}: go there` : `Keep this view as camera spot ${n}`);
  }
}

function initCamSpots() {
  const mm = $('minimap');
  if (!mm || $('mm-spots')) return;
  const box = document.createElement('div');
  box.id = 'mm-spots'; box.className = 'mm-spots';
  for (let n = 1; n <= CAM_SPOTS; n++) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'mm-spot'; b.dataset.n = n; b.textContent = n;
    let hold = 0, held = false;
    b.addEventListener('pointerdown', (e) => {
      e.stopPropagation(); held = false;
      clearTimeout(hold);
      hold = setTimeout(() => { held = true; saveCamSpot(n); }, 550);
    });
    const stop = (e) => { e.stopPropagation(); clearTimeout(hold); };
    b.addEventListener('pointerup', stop);
    b.addEventListener('pointerleave', () => clearTimeout(hold));
    b.addEventListener('pointercancel', () => clearTimeout(hold));
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    b.onclick = (e) => {
      e.stopPropagation();
      if (held) { held = false; return; }
      if (camSpotOk(camSpotList()[n - 1])) goCamSpot(n); else saveCamSpot(n);
    };
    box.appendChild(b);
  }
  mm.appendChild(box);
}

/* ------------------------------------------------------------------ recent alerts */

/** An alert (bad, warn or lost, with a place) as it reaches this player's messages: kept for J. */
function qolAlert(m) {
  qolReset();
  const l = QOL.alerts, last = l[l.length - 1];
  if (last && last.text === m.text && Math.abs(last.x - m.x) < 2 && Math.abs(last.y - m.y) < 2) { last.t = S.time; return; }
  l.push({ x: m.x, y: m.y, text: m.text, t: S.time });
  if (l.length > ALERTS_KEEP) l.shift();
  QOL.alertI = 0;
}

/** J: the latest alert; again within 5 s, the one before it (round to the latest after the oldest). */
function jumpAlert() {
  qolReset();
  const l = QOL.alerts;
  if (!l.length) { qolFlash('No alerts yet.'); return; }
  const now = performance.now();
  QOL.alertI = now - QOL.alertAt < 5000 ? (QOL.alertI + 1) % l.length : 0;
  QOL.alertAt = now;
  const a = l[l.length - 1 - QOL.alertI];
  centerOn(a.x + 0.5, a.y + 0.5);
  sfx('click');
  const ago = Math.max(0, Math.round(S.time - a.t));
  qolFlash(`Alert ${QOL.alertI + 1} of ${l.length} (${ago < 60 ? ago + ' s' : Math.round(ago / 60) + ' min'} ago): ${a.text}` + (l.length > 1 ? ' · J again for the one before' : ''));
}

/* ------------------------------------------------------------------ goods per minute and warnings */

/** The net change of good g over the last minute of game time, per minute; null until there's 15 s to go on. */
function goodPerMin(g) {
  const l = QOL.samples;
  if (QOL.s !== S || l.length < 2) return null;
  const a = l[0], b = l[l.length - 1], dt = b.t - a.t;
  if (dt < 15) return null;
  return (b.g[g] - a.g[g]) * 60 / dt;
}
function rateText(r) { const v = Math.round(r); return (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(v); }

/** The goods tooltip's line. */
function goodRateTip(g) {
  const r = goodPerMin(g);
  const full = QOL.full[g] ? ' <span class="err">Output stores nearly full: haulers aren\'t keeping up.</span>' : '';
  return (r === null ? '' : `<span class="tip-rate">${rateText(r)} a minute (net, last minute)</span>`) + full;
}

/** Each quarter second with the HUD (uiTick): sample the goods, show the rates and the warnings. */
function qolHudTick() {
  if (!UI.inGame || !S) return;
  qolReset();
  syncCamSpots();
  if (UI.watch) return;
  const goods = playerGoods(ME), l = QOL.samples;
  if (!l.length || S.time - l[l.length - 1].t >= 1) l.push({ t: S.time, g: goods });
  while (l.length > 2 && S.time - l[1].t >= RATE_WINDOW) l.shift();
  // Output stores: each good's producers (not storage), what they hold against what they can hold.
  const held = {}, cap = {}, spot = {};
  for (const b of S.buildings) {
    if (b.dead || b.owner !== ME || !b.built) continue;
    const def = BDEFS[b.type];
    if (def.store || def.tank || !def.out) continue;
    for (const g in def.out) {
      held[g] = (held[g] || 0) + Math.min(b.stock[g] || 0, def.out[g]);
      cap[g] = (cap[g] || 0) + def.out[g];
      if ((b.stock[g] || 0) >= def.out[g] * 0.9 && !spot[g]) spot[g] = b;
    }
  }
  for (const g of GOODS) {
    const el = UI.goodEls[g];
    if (!el || el.hidden) continue;
    let rt = el.querySelector('.rate');
    if (!rt) { rt = document.createElement('small'); rt.className = 'rate'; el.insertBefore(rt, el.lastChild); }
    const r = goodPerMin(g), v = r === null ? 0 : Math.round(r);
    const txt = v ? rateText(r) : '';
    if (rt.textContent !== txt) rt.textContent = txt;
    rt.classList.toggle('neg', v < 0);
    const share = cap[g] ? held[g] / cap[g] : 0, was = !!QOL.full[g];
    const full = share >= 0.9 || (was && share >= 0.75);
    if (full && !was) QOL.fullAt[g] = QOL.fullAt[g] ?? S.time;
    if (!full) delete QOL.fullAt[g];
    // (A warning once it has held for 20 s, at most every 3 minutes for a good.)
    const on = full && S.time - (QOL.fullAt[g] ?? S.time) >= 20;
    if (on && !was) {
      QOL.full[g] = true;
      if (!(S.time - (QOL.fullWarned[g] ?? -999) < 180)) {
        QOL.fullWarned[g] = S.time;
        const b = spot[g];
        toast(`${GOOD[g].name}: its makers' output stores are nearly full. More haulers, or a shorter road to storage.`, 'warn', b ? b.x : undefined, b ? b.y : undefined);
        if (b) qolAlert({ x: b.x, y: b.y, text: `${GOOD[g].name}: output stores nearly full.` });
      }
    } else if (!on && was) QOL.full[g] = false;
    el.classList.toggle('full', !!QOL.full[g]);
  }
  // The robot limit.
  const n = botCount(ME), lim = S.mode === 'colony' ? MAX_BOTS_COLONY : MAX_BOTS, pop = $('pop');
  const near = n >= lim * 0.9;
  pop.classList.toggle('cap', near);
  if (near && !pop.querySelector('.pop-cap')) pop.insertAdjacentHTML('beforeend', ` <span class="pop-cap">${n}/${lim}</span>`);
  if (near) pop.title = `${n} of ${lim} robots: ${n >= lim ? 'at the robot limit, so no Bot Foundry makes more' : 'close to the robot limit'}. Recycle spare ones at a Bot Foundry to make room. ` + pop.title;
  const lvl = n >= lim ? 2 : near ? 1 : 0;
  if (lvl > QOL.botWarn) toast(lvl === 2 ? `Robot limit reached (${lim}): the Bot Foundries stop. Recycle spare robots to make room.` : `${n} of ${lim} robots: close to the robot limit.`, 'warn');
  if (lvl > QOL.botWarn || n < lim * 0.85) QOL.botWarn = lvl;
}

/* ------------------------------------------------------------------ save slots */

function readSaveMeta() {
  let m = null;
  try { m = JSON.parse(localStorage.getItem(SAVE_META_KEY) || 'null'); } catch (e) { m = null; }
  if (!m || typeof m !== 'object') m = {};
  if (!m.slots || typeof m.slots !== 'object') m.slots = {};
  // The single save of earlier versions is the Autosave: give it a line the first time it's seen.
  if (hasSave() && !m.auto) {
    try { m.auto = metaOf(JSON.parse(localStorage.getItem(SAVE_KEY)), 'Autosave', 0); writeSaveMeta(m); } catch (e) { m.auto = { name: 'Autosave', at: 0, map: 'Saved game', mode: '', time: 0 }; }
  }
  if (!hasSave()) m.auto = null;
  for (let n = 1; n <= SLOTS; n++) if (m.slots[n] && !slotHas(n)) delete m.slots[n];
  return m;
}
function writeSaveMeta(m) { try { localStorage.setItem(SAVE_META_KEY, JSON.stringify(m)); return true; } catch (e) { return false; } }
function slotHas(n) { try { return !!localStorage.getItem(SLOT_PREFIX + n); } catch (e) { return false; } }

/** A save's line: its map (or mission), mode and game time, and when it was saved. g is S or a parsed save. */
function metaOf(g, name, at) {
  const mis = g.mission && typeof MISSIONS !== 'undefined' ? MISSIONS.find((d) => d.id === g.mission.id) : null;
  const biome = g.settings && g.settings.biome;
  const map = g.mission ? `Mission: ${mis ? mis.name : 'mission'}` : `Planet #${g.seed}` + (biome ? ` · ${regionName(biome, true)}` : '');
  return { name: String(name || '').replace(/[<>"]/g, '').slice(0, 32), at, map, mode: g.mission ? 'Mission' : g.mode === 'colony' ? 'Colony' : 'Versus', time: +g.time || 0 };
}

/** Called by saveGame (js/world.js) once Continue's save is written. */
function noteAutoSaved() {
  if (!S) return;
  const m = readSaveMeta();
  m.auto = metaOf(S, 'Autosave', Date.now());
  writeSaveMeta(m);
}

function canSaveSlot() { return UI.inGame && S && !UI.watch && !(typeof MP !== 'undefined' && MP.on) && !S.players[0].ai && S.winner < 0 && !UI.saveHold && !(typeof contIronman === 'function' && contIronman()); }

function fmtSavedAt(at) {
  if (!at) return 'earlier';
  const d = new Date(at), now = new Date(), hm = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return 'today ' + hm;
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'yesterday ' + hm;
  return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' }) + ' ' + hm;
}
function metaLine(m) { return [m.map, m.mode, m.time ? fmtClock(m.time) + ' played' : '', fmtSavedAt(m.at)].filter(Boolean).join(' · '); }

/** The newest save there is: { slot: 0 for the Autosave or 1–5, meta }, or null. */
function newestSave() {
  const m = readSaveMeta();
  let best = m.auto ? { slot: 0, meta: m.auto } : null;
  for (let n = 1; n <= SLOTS; n++) if (m.slots[n] && (!best || (m.slots[n].at || 0) > (best.meta.at || 0))) best = { slot: n, meta: m.slots[n] };
  return best;
}

/** The main menu's Continue card: the newest save's line under it. */
function syncContinue() {
  const btn = $('m-continue'), best = newestSave();
  btn.hidden = !best;
  $('m-saves').hidden = !best;
  if (!best) return;
  const sub = (best.slot ? `${best.meta.name} · ` : '') + metaLine(best.meta);
  btn.innerHTML = `<span class="mc-t">Continue</span><span class="mc-sub">${esc(sub)}</span>`;
  btn.setAttribute('aria-label', 'Continue: ' + sub);
}

function continueNewest() {
  const best = newestSave();
  if (!best || best.slot === 0) { continueGame(); return; }
  loadSlot(best.slot, true);
}

function saveSlot(n, name) {
  if (!canSaveSlot()) return;
  const m = readSaveMeta();
  const meta = metaOf(S, (name || '').trim() || (m.slots[n] && m.slots[n].name) || `Slot ${n}`, Date.now());
  try { localStorage.setItem(SLOT_PREFIX + n, serializeGame()); } catch (e) {
    sfx('error'); savesSay('That didn’t fit: this browser’s storage is full. Delete a slot (or a restore point) and try again, or use Save → File.');
    return;
  }
  m.slots[n] = meta;
  writeSaveMeta(m);
  sfx('place');
  savesSay(`Saved as “${meta.name}”.`);
  renderSaves();
}

function loadSlot(n, fromContinue) {
  const m = readSaveMeta(), meta = m.slots[n];
  let json = null;
  try { json = localStorage.getItem(SLOT_PREFIX + n); } catch (e) { json = null; }
  if (!json || !meta) { savesSay('That slot is empty.'); return; }
  if (typeof contIronmanSave === 'function' && contIronmanSave(json)) { savesSay(CONT_IRONMAN_NO); return; } // (none is saved there now; an older one, refused)
  if (UI.inGame && !window.confirm(`Load “${meta.name}”? The game you’re playing closes (keep it in a slot first if you want it).`)) return;
  if (!UI.inGame) audioUnlock();
  if (loadSaveText(json, fromContinue ? 'Welcome back.' : `Loaded “${meta.name}”.`)) {
    $('screen-saves').hidden = true;
    $('screen-pause').hidden = true;
    $('screen-over').hidden = true;
  } else if (UI.inGame) savesSay('That save couldn’t be loaded.');
  else { $('screen-saves').hidden = true; menuMsg('That save couldn’t be loaded: it may be damaged, or from a newer version of the game.'); }
}

function deleteSlot(n) {
  const m = readSaveMeta();
  if (n === 0) {
    if (!window.confirm('Delete the autosave? Continue won’t have it any more.')) return;
    clearSave();
    m.auto = null;
  } else {
    if (!m.slots[n] || !window.confirm(`Delete “${m.slots[n].name}”?`)) return;
    try { localStorage.removeItem(SLOT_PREFIX + n); } catch (e) { /* storage blocked */ }
    delete m.slots[n];
  }
  writeSaveMeta(m);
  sfx('click');
  renderSaves();
  if (!UI.inGame) syncMenu();
}

function savesSay(t) { const el = $('sv-msg'); if (!el) return; el.textContent = t; el.hidden = !t; }

function renderSaves() {
  const m = readSaveMeta(), inGame = UI.inGame, canSave = canSaveSlot();
  const row = (n, meta) => {
    const auto = n === 0, empty = !meta;
    const title = auto ? 'Autosave' : empty ? `Slot ${n}` : meta.name;
    const info = empty ? (auto ? 'Nothing saved yet.' : 'Empty') : metaLine(meta);
    const nameIn = !auto && canSave ? `<input type="text" class="sv-name" maxlength="32" data-n="${n}" aria-label="Name for slot ${n}" placeholder="Slot ${n}" value="${esc(empty ? '' : meta.name)}">` : '';
    const btns = [
      !auto && canSave ? `<button type="button" class="btn small primary" data-act="save" data-n="${n}">${empty ? 'Save here' : 'Save over'}</button>` : '',
      !empty && !(auto && inGame) ? `<button type="button" class="btn small" data-act="load" data-n="${n}">Load</button>` : '',
      !empty && !(auto && inGame) ? `<button type="button" class="btn small ghost" data-act="del" data-n="${n}" aria-label="Delete ${esc(title)}">Delete</button>` : '',
    ].join('');
    return `<div class="sv-row${empty ? ' empty' : ''}"><div class="sv-info"><b>${esc(title)}</b><span>${esc(info)}</span>${nameIn}</div><div class="sv-acts">${btns}</div></div>`;
  };
  let html = row(0, m.auto);
  for (let n = 1; n <= SLOTS; n++) html += row(n, m.slots[n]);
  $('sv-list').innerHTML = html;
  $('sv-hint').textContent = canSave ? 'Keep this game in a slot (a name is optional), or load another. The autosave is Continue’s: it saves itself every in-game minute.'
    : inGame ? 'This game can’t be kept in a slot (multiplayer, Observer mode or a finished game), but you can load one.' : 'Load a saved game, or delete one you no longer need. Continue resumes the newest.';
  for (const b of $('sv-list').querySelectorAll('button[data-act]')) {
    const n = +b.dataset.n;
    b.onclick = () => {
      if (b.dataset.act === 'save') {
        const inp = $('sv-list').querySelector(`.sv-name[data-n="${n}"]`);
        if (m.slots[n] && !window.confirm(`Save over “${m.slots[n].name}”?`)) return;
        saveSlot(n, inp ? inp.value : '');
      } else if (b.dataset.act === 'load') { if (n === 0) { $('screen-saves').hidden = true; continueGame(); } else loadSlot(n); }
      else deleteSlot(n);
    };
  }
}

function openSaves() {
  sfx('click');
  savesSay('');
  renderSaves();
  $('screen-saves').hidden = false;
}
function closeSaves() { $('screen-saves').hidden = true; if (!UI.inGame) syncMenu(); }

function initQol() {
  initCamSpots();
  $('p-slots').onclick = openSaves;
  $('m-saves').onclick = () => { audioUnlock(); $('m-import-msg').hidden = true; openSaves(); };
  $('sv-close').onclick = () => { sfx('click'); closeSaves(); };
  // Keys typed here are the dialog's (a slot's name isn't hotkeys); Esc closes it.
  $('screen-saves').addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape' && !e.isComposing) { e.preventDefault(); closeSaves(); }
  });
}

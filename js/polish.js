'use strict';
/*
 * Polish round 2: interface helpers. Nothing here is read by js/sim.js or kept in hashState; the one thing that
 * changes the game, Surrender, goes through an order (ORDERS.surrender in js/orders.js) so it works in multiplayer.
 *  - Reach rings: a defence hovered (any colony's), and an armed robot picked or hovered, show how far they shoot
 *    as a faint ring (a building picked or being placed already shows its own: drawRanges in js/render.js).
 *  - Health bars (hpBar in js/render.js): the Settings switch, on by default, kept on this device.
 *  - +N popups: a small "+3 ▪" rises where your buildings near the camera make goods or storage takes them in,
 *    merged per building and rate-limited; none on Graphics Saver or zoomed far out.
 *  - The ? on a building's or robot's panel: the How to play section about it.
 *  - Idle army: the Idle button (and ,) picks your warbots standing about with nothing to do, a group at a time,
 *    and takes the camera to them; its badge counts them.
 *  - Surrender (pause menu, tapped twice) and Rematch (the end screen: the same planet, mode and rivals again).
 */

const POL = { hover: 0, hoverT: -1, pops: [], snap: new Map(), acc: new Map(), last: new Map(), sampleT: 0, popT: 0, s: null,
  idleI: -1, idleAt: 0, idleN: -1, surArm: 0, topics: null };
const HPBARS_KEY = 'terrafall.hpbars';
const POP_LIFE = 1.8, POP_GAP = 2.5, POPS_MAX = 7, IDLE_GROUP_R = 5, SEL_RINGS_MAX = 12;

R.hpBars = true;
try { if (localStorage.getItem(HPBARS_KEY) === '0') R.hpBars = false; } catch (e) { /* storage unavailable */ }
function setHpBars(on) {
  R.hpBars = !!on;
  try { localStorage.setItem(HPBARS_KEY, on ? '1' : '0'); } catch (e) { /* storage unavailable: this session only */ }
}

/* ------------------------------------------------------------------ reach rings */

/** How far robot u shoots (0: it doesn't): a Howitzer's shells, an army robot's gun. */
function unitReach(u) {
  const bt = u && BOTS[u.type];
  if (!bt) return 0;
  if (bt.siege) return ROCKET.range;
  return bt.army ? bt.range || WARBOT_RANGE : 0;
}
/** A building that shoots (or jams, or fires missiles): it has a reach ring worth showing on hover. */
function armedBuilding(b) { const d = b && BDEFS[b.type]; return !!d && !!(d.range || d.missile); }

/** What's under the mouse, looked for every tenth of a second: a building that shoots, or a robot that does. */
function reachHover() {
  if (!R.mouse || R.mode !== 'normal' || typeof UI === 'undefined' || !UI.inGame || uiFrozen()) return 0;
  if (R.time - POL.hoverT < 0.1) return POL.hover;
  POL.hoverT = R.time;
  const w = screenToWorld(R.mouse.x, R.mouse.y);
  let best = 0, bd = 0.2;
  for (const u of S.bots) {
    if (u.dead || u.inside || !unitReach(u)) continue;
    const d = dist2(u.x, u.y, w.x, w.y);
    if (d < bd) { bd = d; best = u.id; }
  }
  if (!best) { const b = getE(S.bAt[tIdx(clamp(Math.floor(w.x), 0, S.W - 1), clamp(Math.floor(w.y), 0, S.H - 1))]); if (b && !b.dead && b.built && armedBuilding(b)) best = b.id; }
  return (POL.hover = best);
}

function reachRing(ctx, ox, oy, z, x, y, r, strong, min) {
  ctx.strokeStyle = strong ? 'rgba(255,160,150,0.6)' : 'rgba(255,160,150,0.38)';
  ctx.lineWidth = Math.max(1, z * 0.03);
  ctx.beginPath(); ctx.arc(ox + x * z, oy + y * z, r * z, 0, Math.PI * 2); ctx.stroke();
  if (min) { ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(ox + x * z, oy + y * z, min * z, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
}

/** Under the buildings and robots (render, after the picked building's rings): the rings of what's hovered or picked. */
function drawReach(ctx, ox, oy, z) {
  if (typeof UI === 'undefined' || !UI.inGame || !S) return;
  const h = getE(reachHover());
  ctx.save();
  if (h && BDEFS[h.type] && h.id !== R.selected) { ctx.globalAlpha = 0.55; drawRanges(ctx, h.type, h.x, h.y, ox, oy, z, h.owner); ctx.globalAlpha = 1; }
  const seen = new Set();
  const ring = (u, strong) => {
    if (!u || u.dead || u.inside || seen.has(u.id)) return;
    const r = unitReach(u);
    if (!r) return;
    seen.add(u.id);
    reachRing(ctx, ox, oy, z, u.x, u.y, r, strong, BOTS[u.type].siege ? ROCKET.min : 0);
  };
  if (h && BOTS[h.type]) ring(h, true);
  if (UI.selBot) ring(getE(UI.selBot), true);
  if (UI.sel && UI.sel.length && UI.sel.length <= SEL_RINGS_MAX) for (const id of UI.sel) ring(getE(id), false);
  ctx.restore();
}

/* ------------------------------------------------------------------ +N popups */

/** The goods building b's stock is watched for: storage, all of them; a producer, what it makes. */
function popGoods(def) { return def.store ? null : def.make || def.out || null; }

/** Twice a second: what your buildings in view gained since the last look, added up per building. */
function samplePops(ox, oy, z) {
  if (POL.s !== S) { POL.s = S; POL.snap.clear(); POL.acc.clear(); POL.last.clear(); POL.pops = []; }
  if (R.time - POL.sampleT < 0.5) return;
  POL.sampleT = R.time;
  const seen = new Set();
  for (const b of S.buildings) {
    if (b.dead || b.owner !== ME || !b.built || !b.stock) continue;
    const def = BDEFS[b.type];
    if (!def.store && !def.make && !def.out) continue;
    const sx = ox + (b.x + 0.5) * z, sy = oy + (b.y + 0.5) * z;
    if (sx < -z || sy < -z || sx > R.w + z || sy > R.h + z) continue;
    seen.add(b.id);
    const want = popGoods(def), prev = POL.snap.get(b.id), now = {};
    for (const g in b.stock) if (GOOD[g] && (!want || want[g] !== undefined)) now[g] = b.stock[g] || 0;
    POL.snap.set(b.id, now);
    if (!prev) continue;
    for (const g in now) {
      const d = now[g] - (prev[g] || 0);
      if (d <= 0) continue;
      const a = POL.acc.get(b.id) || {};
      a[g] = (a[g] || 0) + d;
      POL.acc.set(b.id, a);
    }
  }
  for (const id of POL.snap.keys()) if (!seen.has(id)) { POL.snap.delete(id); POL.acc.delete(id); }
  // One popup a building every few seconds at most, the goods it gained since, a few on screen at once.
  for (const [id, a] of POL.acc) {
    if (POL.pops.length >= POPS_MAX) break;
    if (R.time - (POL.last.get(id) || -99) < POP_GAP || R.time - POL.popT < 0.3) continue;
    const gs = Object.keys(a).filter((g) => a[g] >= 1).sort((p, q) => a[q] - a[p]).slice(0, 2);
    if (!gs.length) continue;
    const b = getE(id), c = bCentre(b);
    POL.pops.push({ x: c.x, y: c.y - 0.35, t: R.time, items: gs.map((g) => [g, Math.floor(a[g])]) });
    POL.last.set(id, R.time); POL.popT = R.time;
    POL.acc.delete(id);
  }
}

function drawGoodsPops(ctx, ox, oy, z) {
  if (typeof UI === 'undefined' || !UI.inGame || UI.watch || !S || gfxStep() === 'saver' || z < 16) { POL.pops.length = 0; return; }
  samplePops(ox, oy, z);
  if (!POL.pops.length) return;
  const fs = Math.round(clamp(z * 0.28, 10, 13)), q = fs * 0.75;
  ctx.save();
  ctx.font = `700 ${fs}px system-ui, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  POL.pops = POL.pops.filter((p) => R.time - p.t < POP_LIFE);
  for (const p of POL.pops) {
    const k = (R.time - p.t) / POP_LIFE;
    ctx.globalAlpha = k < 0.15 ? k / 0.15 : k > 0.6 ? (1 - k) / 0.4 : 1;
    let x = ox + p.x * z;
    const y = oy + (p.y - k * 0.5) * z;
    // its width first, to centre it: "+3 ▪ +1 ▪"
    const parts = p.items.map(([g, n]) => [g, `+${n}`]);
    const wid = parts.reduce((s, [, t]) => s + ctx.measureText(t).width + q + 6, -3);
    x -= wid / 2;
    for (const [g, t] of parts) {
      ctx.strokeStyle = 'rgba(10,12,16,0.8)'; ctx.lineWidth = 3; ctx.strokeText(t, x, y);
      ctx.fillStyle = '#f4f1ea'; ctx.fillText(t, x, y);
      x += ctx.measureText(t).width + 2;
      ctx.fillStyle = 'rgba(10,12,16,0.8)'; ctx.fillRect(x - 1, y - q / 2 - 1, q + 2, q + 2);
      ctx.fillStyle = GOOD[g].color; ctx.fillRect(x, y - q / 2, q, q);
      x += q + 4;
    }
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ the ? on a panel */

/** Panels that aren't about one building or robot, and the section each opens. */
const PANEL_TOPICS = { ally: 'hs-ally', army: 'hs-army', rally: 'hs-army', post: 'hs-trade', road: 'hs-roads', dam: 'hs-dam', goods: 'hs-supply', pop: 'hs-bots', res: 'hs-supply', uplink: 'hs-rivals', soil: 'hs-colony' };
/** Where a name's own section isn't the one that names it most. */
const TOPIC_FIX = {
  lander: 'hs-start', outpost: 'hs-land', foundry: 'hs-bots', worker: 'hs-bots', hauler: 'hs-bots', repair: 'hs-defence', wall: 'hs-defence', gate: 'hs-defence',
  silo: 'hs-missiles', nukesilo: 'hs-missiles', munitions: 'hs-missiles', reactor: 'hs-missiles', warbot: 'hs-army', rocket: 'hs-army', nest: 'hs-murmur', burrow: 'hs-murmur',
};

/**
 * The How to play section about a building or robot type: TOPIC_FIX, else the section that names it most (a name in
 * bold counts three times: that's where it's explained), else `fallback`.
 */
function helpTopic(type, fallback) {
  if (TOPIC_FIX[type]) return TOPIC_FIX[type];
  const def = BDEFS[type] || BOTS[type];
  if (!def || !def.name) return fallback;
  POL.topics = POL.topics || new Map();
  if (POL.topics.has(type)) return POL.topics.get(type);
  const esc = def.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), re = new RegExp(`\\b${esc}s?\\b`, 'g'), bold = new RegExp(`<b>${esc}s?</b>`, 'g');
  let best = fallback, bn = 0;
  for (const sec of document.querySelectorAll('#screen-help .help-body > section[id^="hs-"]')) {
    if (sec.id === 'hs-top') continue;
    const n = (sec.textContent.match(re) || []).length + 2 * (sec.innerHTML.match(bold) || []).length;
    if (n > bn) { bn = n; best = sec.id; }
  }
  POL.topics.set(type, best);
  return best;
}

/** How to play, open at one section (over the game: it pauses a game against the computer, as How to play does). */
function showHelpAt(id) {
  showHelp();
  if (id && $(id)) helpPage(id);
}

/** After a panel opens (openSheet): a ? in its title for the How to play section about what it shows. */
function panelHelp(kind, id) {
  const head = $('sheet-body').querySelector('.sheet-title');
  if (!head || head.querySelector('.sh-help')) return;
  const e = kind === 'bld' || kind === 'bot' ? getE(id) : null;
  const topic = e ? helpTopic(e.type, kind === 'bot' ? 'hs-bots' : 'hs-build') : PANEL_TOPICS[kind];
  if (!topic || !$(topic)) return;
  const name = pagerTitle($(topic));
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'sh-help'; b.textContent = '?';
  b.title = `How to play: ${name}`; b.setAttribute('aria-label', `How to play: ${name}`);
  b.onclick = (ev) => { ev.stopPropagation(); sfx('click'); showHelpAt(topic); };
  head.appendChild(b);
}

/* ------------------------------------------------------------------ idle army */

/** Your warbots (and Howitzers) out in the field with nothing to do: no orders, or standing where they were sent, not fighting. */
function idleArmy() {
  if (!S || !warOn() || UI.watch) return [];
  const out = [];
  for (const u of S.bots) {
    if (u.dead || u.owner !== ME || u.inside || u.dropping || !(isArmy(u) || BOTS[u.type].siege)) continue;
    const t = u.task && u.task.type;
    if (t && t !== 'hold' && t !== 'park') continue;
    if (u.fight || (u.vel || 0) > 0.05 || u.salvo) continue;
    out.push(u);
  }
  return out;
}

/** The idle ones in groups (each within a few tiles of another in it), biggest first. */
function idleGroups() {
  const l = idleArmy(), groups = [], used = new Set(), r2 = IDLE_GROUP_R * IDLE_GROUP_R;
  for (const u of l) {
    if (used.has(u.id)) continue;
    const g = [u]; used.add(u.id);
    for (let i = 0; i < g.length; i++) for (const v of l) if (!used.has(v.id) && dist2(g[i].x, g[i].y, v.x, v.y) <= r2) { used.add(v.id); g.push(v); }
    groups.push(g);
  }
  return groups.sort((a, b) => b.length - a.length || a[0].id - b[0].id);
}

/** The Idle button, or ,: the next group of idle warbots picked, and the camera on them. */
function nextIdleArmy() {
  if (!UI.inGame || !S || UI.watch || !warOn()) return false;
  const groups = idleGroups();
  if (!groups.length) { qolFlash('No idle warbots: all of them have something to do.'); return true; }
  const now = performance.now();
  POL.idleI = now - POL.idleAt < 8000 ? (POL.idleI + 1) % groups.length : 0;
  POL.idleAt = now;
  const g = groups[POL.idleI];
  selectBots(g.map((u) => u.id), false);
  let x = 0, y = 0;
  for (const u of g) { x += u.x; y += u.y; }
  centerOn(x / g.length, y / g.length);
  sfx('click');
  const n = groups.reduce((s, q) => s + q.length, 0);
  qolFlash(`Idle: ${g.length} of ${n} picked` + (groups.length > 1 ? ` (group ${POL.idleI + 1} of ${groups.length}; ${onTouch() ? 'Idle' : ','} again for the next)` : '') + '.');
  return true;
}

/** Four times a second: the Idle button shown in a war, with its count. */
function polishHudTick() {
  const btn = $('btn-idle');
  if (!btn || !UI.inGame || !S) return;
  if (!$('screen-pause').hidden) syncSurrender();
  const on = warOn() && !UI.watch;
  btn.hidden = !on;
  $('bottombar').classList.toggle('five', on);
  if (!on) return;
  const n = idleArmy().length;
  if (n === POL.idleN) return;
  POL.idleN = n;
  const badge = $('idle-n');
  badge.hidden = !n; badge.textContent = n > 99 ? '99+' : n;
  btn.classList.toggle('none', !n);
  btn.title = n ? `${n} idle warbot${n > 1 ? 's' : ''}: pick them, a group at a time, and go to them (,)` : 'Idle warbots: none right now (,)';
}

/* ------------------------------------------------------------------ surrender and rematch */

/** Surrender is offered in a Versus game still on, to a colony still in. */
function canSurrender() {
  return !!(UI.inGame && S && !UI.watch && !S.mission && S.mode !== 'colony' && S.winner < 0 && S.players[ME] && !S.players[ME].out && surrenderTo(ME) >= 0);
}
function syncSurrender() {
  const b = $('p-surrender');
  if (!b) return;
  b.hidden = !canSurrender();
  const armed = performance.now() - POL.surArm < 5000;
  b.textContent = armed ? `Tap again to surrender to ${playerName(surrenderTo(ME))}` : 'Surrender';
  b.classList.toggle('p-arm', armed);
}
function surrenderClick() {
  if (!canSurrender()) return;
  if (performance.now() - POL.surArm > 5000) { POL.surArm = performance.now(); sfx('click'); syncSurrender(); return; }
  POL.surArm = 0;
  act('surrender', [ME], (ok) => { if (ok === false) { sfx('error'); toast('You can\'t surrender now.', 'warn'); } });
  $('screen-pause').hidden = true;
  UI.paused = false;
}

/** The end screen's Rematch: the game just played (from the new-game menu or a mission) over again; not in multiplayer. */
function syncRematch() {
  const L = UI.lastGame, b = $('o-rematch');
  const ok = !!L && L.s === S && !MP.on && !UI.watch && (!L.mission || (S.winner === ME && L.mission[0] + 1 < MISSIONS.length));
  b.hidden = !ok;
  b.title = ok ? 'The same planet, mode, rivals and rules again, from the landing' : '';
}
function rematch() {
  const L = UI.lastGame;
  if (!L || L.s !== S || MP.on) return;
  $('screen-over').hidden = true;
  sfx('click');
  if (L.mission) startMission(L.mission[0], L.mission[1]);
  else startNewGame(L.opts);
}

function initPolish() {
  const sw = () => pauseSwitch('p-hpbars', R.hpBars);
  sw();
  $('p-hpbars').onclick = () => { setHpBars(!R.hpBars); sw(); sfx('click'); };
  const prev = UI.syncSwitches;
  UI.syncSwitches = () => { if (prev) prev(); sw(); };
  $('btn-idle').onclick = () => { if (!nextIdleArmy()) sfx('error'); };
  $('p-surrender').onclick = surrenderClick;
  $('btn-pause').addEventListener('click', () => { POL.surArm = 0; syncSurrender(); });
  $('o-rematch').onclick = rematch;
}

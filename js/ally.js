'use strict';
/*
 * Commands for a computer ally: interface only. In a team game with a computer colony on your side, Ally on the bar
 * (Shift+A) opens a panel: Attack here (Q) and Defend this area (G) ask for a tap on the map, Help me (H), Hold back
 * (B), Ask for goods (a good's button) and Back to its own plan (C). Each is an order (allyCmd in js/orders.js), so
 * every device in a multiplayer game sees the ally do the same; the ally answers in its own voice (ai.js
 * allyCommand), and where it went shows as a ping on the map (and the minimap). Goods on a supply run from an ally
 * are drawn as a crate crossing to your storage (drawAllyShips).
 */

const ALLY_UI = { to: -1, sig: '' };
/** Which of the panel's commands takes a tap on the map first. */
const ALLY_AIMED = { attack: 'attack', defend: 'defend' };

/** The computer allies on my team that take commands (none outside a team game, or when only watching). */
function myAiAllies() {
  if (typeof S === 'undefined' || !S || !S.teams || S.watch || !UI.inGame || !S.players[ME] || S.players[ME].ai || S.players[ME].out) return [];
  if (typeof mpWatching === 'function' && MP.on && mpWatching()) return [];
  return allyCmdTargets(ME, -1);
}
/** Who a command goes to: the one picked on the panel, or all of them (-1). */
function allyTo() { const qs = myAiAllies(); return ALLY_UI.to >= 0 && qs.includes(ALLY_UI.to) ? ALLY_UI.to : -1; }
function allyWho() { const q = allyTo(), qs = myAiAllies(); return q >= 0 || qs.length === 1 ? callsign(q >= 0 ? q : qs[0]) : 'your allies'; }

/** What computer ally q is doing for its team, in a few words. */
function allyDoing(q) {
  const C = S.players[q].allyCmd || {}, bits = [];
  if (C.atk) bits.push(C.atk.k === 'help' ? 'helping you' : 'attacking your mark');
  if (C.def) bits.push('holding your ground');
  if (C.hold && S.time < C.hold.until) bits.push('held back');
  return bits.length ? bits.join(', ') : 'its own plan';
}

function openAllySheet() {
  const qs = myAiAllies();
  if (!qs.length) { sfx('error'); toast('No computer ally on your team in this game.', 'info'); return false; }
  if (R.mode === 'allyaim') setMode('normal');
  ALLY_UI.sig = '';
  openSheet('ally', 0, `<div class="sheet-title"><div><h3>Ally</h3></div></div><div id="al-body"></div>`);
  $('al-body').onclick = (e) => {
    const btn = e.target.closest('button');
    if (!btn || btn.disabled) return;
    if (btn.dataset.q !== undefined) { sfx('click'); ALLY_UI.to = +btn.dataset.q; ALLY_UI.sig = ''; refreshAllySheet(); return; }
    if (btn.dataset.g) { allyOrder('goods', [btn.dataset.g]); return; }
    if (btn.dataset.c) allyButton(btn.dataset.c);
  };
  refreshAllySheet();
  return true;
}

function refreshAllySheet() {
  const qs = myAiAllies(), body = $('al-body');
  if (!body) return;
  if (!qs.length) { closeSheet(); return; }
  const to = allyTo();
  const army = (q) => S.bots.reduce((n, u) => n + (!u.dead && u.owner === q && isArmy(u) ? 1 : 0), 0);
  const rows = qs.map((q) => [q, army(q), allyDoing(q)]);
  const sig = JSON.stringify([to, rows]);
  if (sig === ALLY_UI.sig) return;
  ALLY_UI.sig = sig;
  let h = '';
  if (qs.length > 1) h += `<div class="seg" id="al-to"><button data-q="-1" class="${to < 0 ? 'on' : ''}">All</button>${qs.map((q) => `<button data-q="${q}" class="${to === q ? 'on' : ''}">${callsign(q)}</button>`).join('')}</div>`;
  for (const [q, n, doing] of rows) h += `<div class="kv"><span><b style="color:${PLAYER_COLORS[q]}">${callsign(q)}</b> (${PERSONALITIES[S.players[q].style] ? PERSONALITIES[S.players[q].style].name : 'ally'})</span><span>${n} warbot${n === 1 ? '' : 's'}, ${doing}</span></div>`;
  h += `<div class="army-cmds">
      <button class="btn primary" id="al-attack" data-c="attack">Attack here</button>
      <button class="btn" id="al-defend" data-c="defend">Defend this area</button>
      <button class="btn" id="al-help" data-c="help">Help me</button>
      <button class="btn" id="al-hold" data-c="hold">Hold back</button>
    </div>
    <div class="section-label">Ask for goods <span class="label-note">what it can spare</span></div>
    <div class="army-cmds ally-goods">${ALLY_GOODS.map((g) => `<button class="btn small ghost" data-g="${g}">${GOOD[g].name}</button>`).join('')}</div>
    <div class="army-cmds"><button class="btn ghost" id="al-cancel" data-c="cancel">Back to its own plan</button></div>
    <p class="hint"><b>Attack here</b>: tap an enemy building, robot or spot and its army goes for it, then home. <b>Defend this area</b>: tap ground for part of its army to hold (about ten minutes). <b>Help me</b>: to your army's fight, or your base. <b>Hold back</b>: no attacks for ten minutes.</p>`;
  body.innerHTML = h;
  markSheetKeys();
}

function allyButton(c) {
  if (ALLY_AIMED[c]) { allyAim(c); return; }
  allyOrder(c, []);
}

/** Attack here or Defend this area: the next tap on the map says where. */
function allyAim(c) {
  closeSheet();
  setMode('allyaim');
  UI.allyAim = c;
  showBanner(c === 'attack' ? `Tap an enemy building, robot or spot for <b>${allyWho()}</b> to attack.` : `Tap the ground <b>${allyWho()}</b> should defend.`, null, 'Cancel');
}

/** A tap on the map while choosing where (R.mode 'allyaim'). */
function allyAimTap(i, j, wx, wy) {
  const c = UI.allyAim;
  if (!inMap(i, j) || !c) { sfx('error'); return; }
  let tid = 0;
  if (c === 'attack') {
    const b = buildingAtTap(i, j, wx, wy);
    if (b && b.owner >= 0 && foes(b.owner, ME)) tid = b.id;
    else {
      let bd = 1.5 * 1.5;
      for (const u of S.bots) if (!u.dead && !u.inside && u.owner >= 0 && foes(u.owner, ME) && dist2(u.x, u.y, wx, wy) < bd) { bd = dist2(u.x, u.y, wx, wy); tid = u.id; }
    }
  }
  setMode('normal');
  allyOrder(c, [i, j, tid]);
}

/** Send command c to the ally (or allies); on its answer, a ping where it went. */
function allyOrder(c, args) {
  const to = allyTo();
  act('allyCmd', [to, c, ...args], (r) => {
    if (!r) return;
    if (!r.n) { sfx('error'); if (r.why && !myAiAllies().length) toast(r.why, 'warn'); ALLY_UI.sig = ''; refreshAllySheet(); return; }
    sfx('order');
    if (typeof haptic === 'function') haptic('tap');
    const L = getE(S.players[ME].lander);
    const x = r.i >= 0 ? r.i + 0.5 : L ? L.x + 0.5 : null, y = r.j >= 0 ? r.j + 0.5 : L ? L.y + 0.5 : null;
    if (x !== null && c !== 'goods') allyPing(x, y, to >= 0 ? to : myAiAllies()[0]);
    ALLY_UI.sig = '';
    if (UI.sheetKind === 'ally') refreshAllySheet();
  });
}

/** Where a command went, as a ping in the ally's colour (and for my human teammates too, in multiplayer). */
function allyPing(x, y, q) {
  if (typeof COOP === 'undefined') return;
  COOP.pings.push({ x, y, q: -1, col: PLAYER_COLORS[q] || '#ffd84a', tag: callsign(q), t0: performance.now() });
  if (COOP.pings.length > 8) COOP.pings.shift();
  sfx('ping');
  if (typeof pingOn === 'function' && pingOn()) coopSend({ t: 'mark', p: MP.me, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, to: mpTeammates() });
}

/** Goods on a supply run from an ally to me: a crate gliding from its Command Base to my storage. */
function drawAllyShips(ctx, ox, oy, z) {
  for (const s of S.allyShips || []) {
    if (s.to !== ME && s.from !== ME) continue;
    const b = getE(s.sid), tx = b ? b.x + 0.5 : s.x, ty = b ? b.y + 0.5 : s.y;
    const k = clamp((S.time - s.t0) / Math.max(1, s.at - s.t0), 0, 1), x = ox + (s.x + (tx - s.x) * k) * z, y = oy + (s.y + (ty - s.y) * k) * z - z * 0.6 * Math.sin(Math.PI * k);
    const w = Math.max(5, z * 0.45);
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = PLAYER_COLORS[s.from] || '#fff';
    ctx.setLineDash([z * 0.3, z * 0.3]);
    ctx.lineWidth = Math.max(1, z * 0.06);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ox + tx * z, oy + ty * z); ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#c99a5a'; ctx.strokeStyle = '#3a2a18'; ctx.lineWidth = Math.max(1, w * 0.12);
    ctx.fillRect(x - w / 2, y - w / 2, w, w); ctx.strokeRect(x - w / 2, y - w / 2, w, w);
    ctx.fillStyle = PLAYER_COLORS[s.from] || '#fff';
    ctx.fillRect(x - w / 2, y - w * 0.12, w, w * 0.24);
    ctx.restore();
  }
}

/** Every frame: the bar's Ally button only in a game with a computer ally; the open panel kept current. */
function allyTick() {
  const btn = $('btn-ally');
  if (btn) btn.hidden = !myAiAllies().length;
  if (UI.sheetKind === 'ally' && UI.inGame && (S.tick % 30) === 0) refreshAllySheet();
}

function initAlly() {
  $('btn-ally').onclick = () => { sfx('click'); if (UI.sheetKind === 'ally') closeSheet(); else openAllySheet(); };
}

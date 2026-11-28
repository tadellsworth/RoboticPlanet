'use strict';
/*
 * Terrafall — space expansion phase 1: its panels and the orders given from them (the rules in js/sim.js, the look in
 * js/space.js). Every change goes through an order (js/orders.js: tow, squad, gunships, craftHome, yard, command).
 *   - A Launch Pad's panel: its spacecraft and what each is doing, with Show and their own buttons; its yard (renderYard).
 *   - A spacecraft's panel: its job, tank and hull, and its orders: a Shuttle tows an asteroid (tap one), a Dropship lands
 *     a squad (6 Warbots from your garrisons, 6 idle Workers, or the robots you have selected: then tap where), a Gunship
 *     attacks (tap an enemy, open space or ground to hold it, its pad to come home) or comes home.
 *   - With a mouse: select craft and robots (a box, Shift-click) and right-click, as for warbots (ORDERS.command:
 *     spaceCommand): Gunships attack or hold; a Dropship picked with robots lands them where you click.
 *   - A tap on a drifting asteroid or a derelict module out in the void opens its panel.
 *   - The Army panel's Space tab (the Air tab's place out in space): every pad and craft.
 */

/** Your built Launch Pads. */
function myPads() { return S.buildings.filter((b) => !b.dead && b.owner === ME && b.built && BDEFS[b.type].pad); }

/** What craft u is doing, in words (lower case first). */
function craftStatus(u) {
  const M = u.mission, F = u.sf, t = u.task;
  if (BOTS[u.type].gunship) {
    const g = typeof gunshipGoal === 'function' ? gunshipGoal(u) : null, what = g ? (g.ent === 'b' ? `the enemy ${BDEFS[g.type].name}` : `an enemy ${BOTS[g.type].name}`) : '';
    if (!F) return t ? 'taking off' : u.bat < SPACE.low + 20 || u.hp < u.maxHp * (SPACE.hurt + 0.3) ? 'on its pad, refuelling and mending' : 'on guard on its pad: it takes off at enemy craft or warbots near it';
    if (t && (t.type === 'attack' || t.type === 'hunt') && g) return t.guard ? `up after ${what} near its pad` : `attacking ${what}`;
    if (t && t.type === 'hold') return 'holding its spot in the air, firing at anything in reach';
    return 'flying home';
  }
  if (F && F.ph === 'ground' && F.wait) return 'down in the field: it flies to a Launch Pad with room once there is one';
  if (!M) return F ? 'flying home' : u.inside ? 'parked on its pad' : 'flying to a Launch Pad';
  const n = ferryAboard(u).length;
  if (M.kind === 'supply') return M.phase === 'load' ? 'loading supplies' : F && F.ph === 'ground' ? 'unloading' : M.phase === 'back' ? 'flying home' : 'flying supplies out';
  const what = (rockById(M.rock) || {}).k === 'salvage' ? 'a salvage wreck' : 'an asteroid';
  if (M.kind === 'tow') return M.phase === 'load' ? `off to tow ${what}` : M.phase === 'tow' ? `towing ${what} home` : `flying out to ${what}`;
  if (M.kind === 'outpost') return M.phase === 'load' ? 'loading a Drop Outpost kit' : F && F.ph === 'ground' ? 'down: unfolding the Drop Outpost' : M.done ? 'flying home' : 'flying a Drop Outpost out';
  if (M.phase === 'load') return `boarding: ${n} of ${M.n} aboard`;
  if (F && F.ph === 'ground') return u.ramp < 1 ? 'landed: lowering its ramp' : `letting its squad out (${n} still aboard)`;
  return `flying ${n} robot${n === 1 ? '' : 's'} out`;
}

/** The extra rows on a craft's panel (its tank, what it seats or carries). */
function craftRows(u) {
  const P = craftPad(u);
  return `<div class="kv"><span>Fuel</span><span>fills up on its Launch Pad, one Fuel ${SPACE.fill}% of the tank; it burns ${SPACE.burn}% a second in the air</span></div>` +
    (u.type === 'dropship' ? `<div class="kv"><span>Seats</span><span>${ferryAboard(u).length} of ${BOTS.dropship.seats} taken</span></div>` : '') +
    (u.type === 'shuttle' ? `<div class="kv"><span>Hold</span><span>${u.cargo ? sumValues(u.cargo) : 0} of ${BOTS.shuttle.carry} goods${dockHeld(u.owner) ? '; a Docking Ring of yours makes it faster' : ''}</span></div>` : '') +
    (BOTS[u.type].gunship ? `<div class="kv"><span>Lasers</span><span>a bolt every ${GUNSHIP.reload} s out to ${GUNSHIP.range} tiles: ${GUNSHIP.craft} off a craft, ${GUNSHIP.bot} off a robot, ${GUNSHIP.bld} off a building</span></div>` : '') +
    `<div class="kv"><span>Base</span><span>${P ? 'the Launch Pad ' + dirText(getE(S.players[u.owner].lander) || P, P) + ' from the Command Base' : 'no Launch Pad'}</span></div>`;
}

/** A craft's buttons on its panel (yours). */
function craftButtons(u) {
  if (u.type === 'shuttle') return `<div class="actions"><button class="btn primary" id="sh-sp-tow">${S.grave ? 'Tow salvage' : 'Tow an asteroid'}</button><button class="btn" id="sh-sp-post">Land a Drop Outpost</button></div><button class="btn" id="sh-sp-home">Call off</button><p class="hint">${S.grave ? '<b>Tow salvage</b>: tap a wreck drifting through the void; it flies out, hooks it and tows it home to its pad, where it is broken down for ' + costText(DRIFT.salvage) + '.' : '<b>Tow an asteroid</b>: tap an Ore or Crystal rock drifting through the void; it flies out, hooks it and tows it home to its pad, where it is broken up into a field beside the pad to mine.'} <b>Land a Drop Outpost</b> (${costText(BDEFS.dropost.cost)}): tap open ground on a deck or hulk nobody holds; it lands the kit there and it unfolds, claiming the land round it. Supplies: switch on <b>Supply by air</b> in a Depot\'s or Outpost\'s panel, and it keeps that place stocked by itself.</p>`;
  if (u.type === 'dropship') return `<div class="actions"><button class="btn primary" id="sh-sp-sq-w">Land ${BOTS.dropship.seats} Warbots</button><button class="btn" id="sh-sp-sq-k">Land ${BOTS.dropship.seats} Workers</button></div><button class="btn" id="sh-sp-home">Call off</button><p class="hint">Then tap where: any flat, free ground, a deck behind a raised drawbridge or a rock no bridge reaches. They board at its pad (Warbots from your garrisons, idle Workers), it flies straight over the void, lands and they walk out down its ramp. With a mouse, select robots and the Dropship together and right-click where to land them.</p>`;
  if (BOTS[u.type].gunship) return '<div class="actions"><button class="btn primary" id="sh-sp-gun">Attack: tap a target</button><button class="btn" id="sh-sp-home">Come home</button></div><p class="hint">Tap an enemy building, robot or craft to attack it, open space or ground to hold there, or its Launch Pad to come home. With a mouse, select it and right-click, as for warbots. It flies home by itself to refuel and mend.</p>';
  return '';
}

/** Wire a craft's buttons. */
function bindCraftButtons(u) {
  if ($('sh-sp-tow')) $('sh-sp-tow').onclick = () => { sfx('click'); startSpaceMode('tow', u.id); };
  if ($('sh-sp-post')) $('sh-sp-post').onclick = () => { sfx('click'); startSpaceMode('post', u.id); };
  if ($('sh-sp-sq-w')) $('sh-sp-sq-w').onclick = () => { sfx('click'); startSpaceMode('squad', u.id, { sub: 'warbot' }); };
  if ($('sh-sp-sq-k')) $('sh-sp-sq-k').onclick = () => { sfx('click'); startSpaceMode('squad', u.id, { sub: 'worker' }); };
  if ($('sh-sp-gun')) $('sh-sp-gun').onclick = () => { sfx('click'); startSpaceMode('gun', u.id); };
  if ($('sh-sp-home')) $('sh-sp-home').onclick = () => act('craftHome', [u.id], (ok) => { sfx(ok ? 'order' : 'error'); toast(ok ? `The ${BOTS[u.type].name} is called back.` : 'Nothing to call off: it is already on its way.', ok ? 'info' : 'warn'); refreshSheet(); });
}

/** A Launch Pad's own section on its panel: its craft. */
function padSection(b) {
  return '<div class="section-label">Spacecraft <span class="label-note">' + SPACE.holds + ' to a pad</span></div><div id="sh-pad"></div>' +
    `<p class="hint">Order craft in its yard below. Parked here they refuel from the pad's Fuel (it keeps ${SPACE.padFuel}: Tankers bring it) and mend. Shuttles fly goods to the places you switch to <b>Supply by air</b>; Dropships land squads; Gunships fight. Tap a craft's row to open its panel.</p>`;
}
function renderPad(b) {
  const el = $('sh-pad');
  if (!el) return;
  const cs = padCraft(b), sig = cs.map((u) => u.id + craftStatus(u)).join('|');
  if (el.dataset.sig === sig) return;
  el.dataset.sig = sig;
  el.innerHTML = cs.length ? cs.map((u) => `<div class="kv army-row"><span><b>${BOTS[u.type].name}</b>: ${craftStatus(u)}</span><span><button class="btn small" data-bot="${u.id}">Open</button></span></div>`).join('') : '<p class="hint">None yet.</p>';
  for (const btn of el.querySelectorAll('button[data-bot]')) btn.onclick = () => { const u = getE(+btn.dataset.bot); if (u && !u.dead) { sfx('click'); openBotSheet(u); } };
}

/* -- picking on the map (mode 'space': UI.spaceAct = { kind: 'tow' | 'squad' | 'gun', uid, sub, ids }) */

function startSpaceMode(kind, uid, extra) {
  closeSheet();
  setMode('space');
  UI.spaceAct = { kind, uid, ...(extra || {}) };
  R.spaceAt = null;
  showSpaceBanner();
}
function showSpaceBanner(problem) {
  const A = UI.spaceAct, u = A && getE(A.uid);
  if (!u || u.dead) { setMode('normal'); return; }
  const err = problem ? `<span class="err">${problem}</span> ` : '';
  if (A.kind === 'tow') { showBanner(err + (S.grave ? 'Tap a <b>salvage wreck</b> drifting through the void: the Shuttle tows it home to its pad, where it is broken down for Alloy and Chips.' : 'Tap an <b>Ore or Crystal asteroid</b> drifting through the void: the Shuttle tows it home to its pad.'), null, 'Cancel'); return; }
  if (A.kind === 'post') { showBanner(err + (R.spaceAt ? 'Land the Drop Outpost here?' : `Tap where the Shuttle lands a <b>Drop Outpost</b> (${costText(BDEFS.dropost.cost)}): open ground on a deck or hulk nobody holds.`), R.spaceAt ? 'Land' : null, 'Cancel'); return; }
  if (A.kind === 'gun') { showBanner(err + 'Tap an <b>enemy</b> to attack, <b>open space or ground</b> to hold there, or its <b>Launch Pad</b> to come home.', null, 'Cancel'); return; }
  const what = A.ids ? `${A.ids.length} robot${A.ids.length === 1 ? '' : 's'}` : `${BOTS.dropship.seats} ${BOTS[A.sub].plural}`;
  showBanner(err + (R.spaceAt ? `Land ${what} here?` : `Tap where the Dropship lands ${what}: flat, free ground anywhere.`), R.spaceAt ? 'Land' : null, 'Cancel');
}
/** An enemy robot or craft near (wx, wy), the nearest (craft in the air a little higher up the screen). */
function spaceFoeAt(wx, wy) {
  let best = null, bd = 0.7 * 0.7;
  for (const v of S.bots) {
    if (v.dead || v.inside || !foes(v.owner, ME) || v.owner < 0) continue;
    const d = dist2(v.x, v.y - (v.alt || 0) * 0.35, wx, wy);
    if (d < bd) { bd = d; best = v; }
  }
  return best;
}
/** The drifting asteroid under (wx, wy), or null. */
function rockAtTap(wx, wy) {
  if (!S.space) return null;
  for (const r of S.space.rocks) { if (r.gone) continue; const p = rockPos(r); if (dist2(p.x, p.y, wx, wy) <= sq(DRIFT.r[r.k] + 0.4)) return r; }
  return null;
}
/** The derelict module under (wx, wy), or null. */
function modAtTap(wx, wy) {
  if (!S.space) return null;
  for (const m of S.space.mods) if (Math.abs(wx - (m.x + 1)) <= 1.3 && Math.abs(wy - (m.y + 1)) <= 1.0) return m;
  return null;
}
function spaceTap(i, j, wx, wy) {
  const A = UI.spaceAct, u = A && getE(A.uid);
  if (!u || u.dead) { setMode('normal'); return; }
  if (A.kind === 'tow') {
    const r = rockAtTap(wx, wy);
    if (!r) { sfx('error'); showSpaceBanner('No asteroid there.'); return; }
    act('tow', [u.id, r.id], (why) => {
      if (why) { sfx('error'); showSpaceBanner(why); return; }
      sfx('order'); setMode('normal'); toast('The Shuttle is off to tow it home.', 'info');
    });
    return;
  }
  if (A.kind === 'gun') {
    const b = buildingAtTap(i, j, wx, wy), foe = !b || !foes(b.owner, ME) ? spaceFoeAt(wx, wy) : null;
    const args = b && b.owner >= 0 && foes(b.owner, ME) ? ['attack', b.id, 0, 0] : foe ? ['hunt', foe.id, 0, 0] : b && b.owner === ME && BDEFS[b.type].pad ? ['home', 0, 0, 0] : inMap(i, j) ? ['hold', 0, i, j] : null;
    if (!args) { sfx('error'); showSpaceBanner('Outside the map.'); return; }
    act('gunships', [[u.id], ...args], (n) => {
      if (!n) { sfx('error'); showSpaceBanner('It can\'t take that order.'); return; }
      sfx('order'); setMode('normal'); addFx('ring', (b ? b.x + 0.5 : foe ? foe.x : i + 0.5), (b ? b.y + 0.5 : foe ? foe.y : j + 0.5), { color: args[0] === 'attack' || args[0] === 'hunt' ? '#ff5a6e' : '#7dffa0' });
      toast(args[0] === 'attack' ? `The Gunship is going after the ${BDEFS[b.type].name}.` : args[0] === 'hunt' ? `The Gunship is going after the ${BOTS[foe.type].name}.` : args[0] === 'home' ? 'The Gunship is coming home.' : 'The Gunship holds that spot.', 'info');
    });
    return;
  }
  // a squad's (or a Drop Outpost's) landing spot: a second tap there (or Land) sends it
  const why = A.kind === 'post' ? shuttleOutpostBlocked(ME, u, i, j) : squadBlocked(ME, u, i, j);
  if (why) { sfx('error'); R.spaceAt = null; showSpaceBanner(why); return; }
  if (R.spaceAt && R.spaceAt.i === i && R.spaceAt.j === j) { spaceConfirm(); return; }
  R.spaceAt = { i, j };
  sfx('click');
  showSpaceBanner();
}
function spaceConfirm() {
  const A = UI.spaceAct, u = A && getE(A.uid), at = R.spaceAt;
  if (u && at && A.kind === 'post') {
    act('outpost', [u.id, at.i, at.j], (why) => {
      if (why) { sfx('error'); R.spaceAt = null; showSpaceBanner(why); return; }
      sfx('order'); addFx('ring', at.i + 0.5, at.j + 0.5, { color: '#d9c8ff' }); setMode('normal');
      toast('The Shuttle is loading the Drop Outpost kit: it lands it there and it unfolds.', 'info');
    });
    return;
  }
  if (!u || !at || A.kind !== 'squad') return;
  act('squad', [u.id, at.i, at.j, A.ids || null, A.sub || null, BOTS.dropship.seats], (why) => {
    if (why) { sfx('error'); R.spaceAt = null; showSpaceBanner(why); return; }
    sfx('order'); addFx('ring', at.i + 0.5, at.j + 0.5, { color: '#d9c8ff' }); setMode('normal');
    toast('The squad is boarding the Dropship at its pad: it lifts off once they are aboard.', 'info');
  });
}

/** A tap on the map out in the void: a drifting asteroid's or a derelict module's panel. True if it took the tap. */
function spaceTapped(wx, wy) {
  const r = rockAtTap(wx, wy);
  if (r) { sfx('click'); openRockSheet(r); return true; }
  const m = modAtTap(wx, wy);
  if (m) { sfx('click'); openModSheet(m); return true; }
  return false;
}
const ROCK_NAMES = { plain: 'Drifting asteroid', ore: 'Ore-bearing asteroid', crystal: 'Crystal-bearing asteroid', salvage: 'Salvage wreck', junk: 'Debris lane' };
function openRockSheet(r) {
  if (r.k === 'salvage' || r.k === 'junk') { openSalvageSheet(r); return; }
  const good = r.k === 'plain' ? '' : r.k === 'ore' ? 'Ore' : 'Crystal';
  const sh = S.bots.find((u) => !u.dead && u.owner === ME && u.type === 'shuttle' && !u.mission && craftPad(u) && u.inside === craftPad(u).id);
  openSheet('space', r.id, `<div class="sheet-title"><div><h3>${ROCK_NAMES[r.k]}</h3><div class="owner">drifting through the void</div></div></div>
    <p class="desc">${r.k === 'plain' ? 'A loose rock of the Ring, drifting slowly on its orbit through the void, never over a deck or a rock. Nothing to mine: a craft that clips one takes a little damage.' : `A rock of the Ring with ${good} in it, drifting slowly on its orbit through the void. A ${r.k === 'ore' ? 'Mine' : 'Crystal Tap'} within ${DRIFT.reach} tiles of where it passes mines it as it goes, or a Shuttle tows it home to its Launch Pad, where it is broken up into a field to mine. Towed away or mined out, another drifts in on its orbit ${Math.round(DRIFT.respawn / 60)} minutes later.`}</p>
    ${r.k !== 'plain' ? `<div class="kv"><span>${good}</span><span>${Math.floor(r.amt)} left</span></div>` : ''}
    ${r.k !== 'plain' && sh ? '<button class="btn primary big" id="sh-rock-tow">Tow it home</button>' : ''}`);
  if ($('sh-rock-tow')) $('sh-rock-tow').onclick = () => act('tow', [sh.id, r.id], (why) => { if (why) { sfx('error'); toast(why, 'warn'); } else { sfx('order'); toast('A Shuttle is off to tow it home.', 'info'); closeSheet(); } });
}
/** The Graveyard: a salvage wreck's or a debris lane's panel. */
function openSalvageSheet(r) {
  const sh = r.k === 'salvage' && S.bots.find((u) => !u.dead && u.owner === ME && u.type === 'shuttle' && !u.mission && craftPad(u) && u.inside === craftPad(u).id);
  openSheet('space', r.id, `<div class="sheet-title"><div><h3>${ROCK_NAMES[r.k]}</h3><div class="owner">drifting through the wreck field</div></div></div>
    <p class="desc">${r.k === 'salvage' ? `Wreckage from the old fight: a torn-off engine bell, hull plates round a cargo pod. A Shuttle tows it home to its Launch Pad, where it is broken down for ${costText(DRIFT.salvage)}. Towed away, another drifts in on its orbit ${Math.round(DRIFT.salvageBack / 60 * 10) / 10} minutes later.` : `Loose shards of hull and beam, drifting on a lane through the void. Too many and too small to tow: a craft that flies through them is clipped (${SPACE.bump} damage, once every ${SPACE.bumpGap} s). Fly round, or take the hits.`}</p>
    ${sh ? '<button class="btn primary big" id="sh-rock-tow">Tow it home</button>' : ''}`);
  if ($('sh-rock-tow')) $('sh-rock-tow').onclick = () => act('tow', [sh.id, r.id], (why) => { if (why) { sfx('error'); toast(why, 'warn'); } else { sfx('order'); toast('A Shuttle is off to tow it home.', 'info'); closeSheet(); } });
}
const MOD_TEXT = {
  solar: () => `An Accord station's solar wing, adrift off the deck. Held, it powers its holder's buildings within ${DERELICT.solar.reach} tiles as a Generator does, with no Fuel: factories, Bot Foundries, Oil Pumps and Refineries there work a third faster, and a Maglev Terminal or Mass Driver there has power.`,
  dock: () => `A docking ring off a Pathfinder-era station. Held, it guides its holder's Shuttles in: they fly ${Math.round((SPACE.dock - 1) * 100)}% faster.`,
  hulk: () => `The stripped hull of an Accord transport. The first colony to hold it salvages it once: ${costText(DERELICT.hulk.haul)}, brought into its Command Base.`,
};
function openModSheet(m) {
  const held = modHolder(m), who = held >= 0 ? (held === ME ? 'yours' : playerName(held)) : m.jam ? 'jammed: no one holds it' : 'derelict: no one holds it';
  openSheet('space', 1000 + m.id, `<div class="sheet-title"><div><h3>${MOD_NAMES[m.k]}</h3><div class="owner">${held >= 0 ? `<span class="dot" style="background:${PLAYER_COLORS[held]}"></span> ` : ''}${who}</div></div></div>
    <p class="desc">${MOD_TEXT[m.k]()}${m.k === 'hulk' && m.done ? ` Stripped: ${m.by === ME ? 'you' : playerName(m.by)} salvaged it.` : ''}</p>
    <p class="hint">A derelict module is held, like an Uplink, by the colony whose land reaches out over it (build an Outpost on the deck beside it), unless another colony's armed robots stand within ${DERELICT.jam} tiles of it: they jam it, and no one holds it.</p>`);
}

/* -- the Army panel's Space tab */

function refreshSpaceTab() {
  const pads = myPads(), craft = S.bots.filter((u) => !u.dead && u.owner === ME && BOTS[u.type].craft);
  const sig = JSON.stringify([pads.map((b) => [b.id, b.yard]), craft.map((u) => [u.id, craftStatus(u)])]);
  if (sig === UI.armySig) return;
  UI.armySig = sig;
  const L = getE(S.players[ME].lander);
  let h = '<div class="section-label">Launch Pads</div>';
  for (const b of pads) {
    const ord = b.yard ? Object.keys(b.yard).filter((k) => b.yard[k] > 0).map((k) => `${b.yard[k]} ${b.yard[k] === 1 ? BOTS[k].name : BOTS[k].plural}`) : [];
    h += `<div class="kv army-row"><span>${L ? `${dirText(L, b)} from the Command Base` : 'Launch Pad'}: ${padCraft(b).length} of ${SPACE.holds} craft${ord.length ? `; ordered ${ord.join(', ')}` : ''}</span><span>${BDEFS.launchpad.yard.filter((k) => warOn() || !BOTS[k].war).map((k) => `<button class="btn small" data-act="yard" data-id="${b.id}" data-k="${k}">+ ${BOTS[k].name}</button>`).join('')}<button class="btn small ghost" data-act="showbld" data-id="${b.id}">Open</button></span></div>`;
  }
  const row = (u, btns) => `<div class="kv army-row"><span><b>${BOTS[u.type].name}</b>: ${craftStatus(u)}</span><span>${btns}<button class="btn small ghost" data-act="showbot" data-id="${u.id}">Show</button></span></div>`;
  const parked = (u) => u.inside && craftPad(u) && u.inside === craftPad(u).id && !u.mission;
  const guns = craft.filter((u) => BOTS[u.type].gunship);
  if (warOn()) {
    h += '<div class="section-label">Gunships <span class="label-note">purple lasers</span></div>';
    h += guns.length ? guns.map((u) => row(u, `<button class="btn small" data-act="spgun" data-id="${u.id}">Attack</button><button class="btn small" data-act="sphome" data-id="${u.id}">Home</button>`)).join('') + `<div class="army-cmds"><button class="btn ghost" data-act="spselgun">Select all Gunships</button></div>`
      : '<p class="hint">None yet: order one at a Launch Pad (+ Gunship above). It hovers and shoots purple lasers at enemy robots, buildings and craft; a Point-Defence Turret is its bane.</p>';
  }
  const drops = craft.filter((u) => u.type === 'dropship');
  h += '<div class="section-label">Dropships <span class="label-note">squads over the void</span></div>';
  h += drops.length ? drops.map((u) => row(u, parked(u) ? `${warOn() ? `<button class="btn small" data-act="spsquad" data-k="warbot" data-id="${u.id}">${BOTS.dropship.seats} Warbots</button>` : ''}<button class="btn small" data-act="spsquad" data-k="worker" data-id="${u.id}">${BOTS.dropship.seats} Workers</button>` : '')).join('')
    : `<p class="hint">None yet: order one at a Launch Pad (+ Dropship above). It lands up to ${BOTS.dropship.seats} robots on any flat, free ground: over a raised drawbridge, onto a rock no bridge reaches.</p>`;
  const shs = craft.filter((u) => u.type === 'shuttle');
  h += '<div class="section-label">Shuttles <span class="label-note">goods and towing</span></div>';
  h += shs.length ? shs.map((u) => row(u, parked(u) ? `<button class="btn small" data-act="sptow" data-id="${u.id}">Tow</button><button class="btn small" data-act="sppost" data-id="${u.id}">Drop Outpost</button>` : '')).join('')
    : `<p class="hint">None yet: order one at a Launch Pad (+ Shuttle above). It keeps the places you switch to Supply by air stocked, ${BOTS.shuttle.carry} goods a flight, and tows drifting Ore and Crystal rocks home.</p>`;
  $('ar-body').innerHTML = h;
}
/** A Space tab button (from armyButton). True if it was one. */
function spaceArmyButton(btn, what, e) {
  switch (what) {
    case 'spgun': if (e) startSpaceMode('gun', e.id); return true;
    case 'sphome': if (e) act('craftHome', [e.id], () => { UI.armySig = ''; }); return true;
    case 'spsquad': if (e) startSpaceMode('squad', e.id, { sub: btn.dataset.k }); return true;
    case 'sptow': if (e) startSpaceMode('tow', e.id); return true;
    case 'sppost': if (e) startSpaceMode('post', e.id); return true;
    case 'spselgun': { const ids = S.bots.filter((u) => !u.dead && u.owner === ME && BOTS[u.type].gunship).map((u) => u.id); closeSheet(); selectBots(ids, false); if (UI.sel.length) toast(`${UI.sel.length} Gunship${UI.sel.length > 1 ? 's' : ''} selected: ${onTouch() ? 'tap' : 'right-click'} an enemy to attack, open space to hold there.`, 'info'); return true; }
  }
  return false;
}

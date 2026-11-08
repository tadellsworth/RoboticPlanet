'use strict';
/*
 * Botfall — HTML interface: menus, HUD, build menu, info sheets, objectives, messages.
 */

const UI = {
  inGame: false, paused: false, speed: 1, overShown: false,
  menu: { mode: 'versus', diff: 'normal', seed: randomSeed() },
  sheetKind: null, sheetFor: 0, sheetT: 0, hudT: 0,
  icons: {}, attackN: 0, demolishArm: 0, lastPaint: null, placeType: null,
  goodEls: {}, lastGoods: {}, objCollapsed: false, selBot: 0,
};

const $ = (id) => document.getElementById(id);

function randomSeed() { return 1 + Math.floor(Math.random() * 999998); }

function iconFor(type, owner) {
  const key = type + '@' + (owner || 0);
  if (!UI.icons[key]) UI.icons[key] = buildingIcon(type, 96, owner || 0);
  return UI.icons[key];
}

function goodTag(g, text, short) {
  return `<span class="gtag${short ? ' short' : ''}"><i class="gi ${g}"></i>${text}</span>`;
}

/* ------------------------------------------------------------------ setup */

function initUI() {
  const goods = $('goods');
  for (const g of GOODS) {
    const el = document.createElement('div');
    el.className = 'res-chip';
    el.title = GOOD[g].name;
    el.innerHTML = `<i class="gi ${g}"></i><span>0</span>`;
    goods.appendChild(el);
    UI.goodEls[g] = el;
  }

  // Menu
  for (const btn of $('m-mode').children) btn.onclick = () => { UI.menu.mode = btn.dataset.v; syncMenu(); sfx('click'); };
  for (const btn of $('m-diff').children) btn.onclick = () => { UI.menu.diff = btn.dataset.v; syncMenu(); sfx('click'); };
  $('m-reroll').onclick = () => { UI.menu.seed = randomSeed(); syncMenu(); sfx('click'); };
  $('m-new').onclick = () => { audioUnlock(); startNewGame(); };
  $('m-continue').onclick = () => { audioUnlock(); continueGame(); };
  $('m-help').onclick = () => showHelp();
  $('h-close').onclick = () => { $('screen-help').hidden = true; UI.paused = !$('screen-pause').hidden; };

  // Pause menu
  $('btn-pause').onclick = () => { UI.paused = true; $('screen-pause').hidden = false; sfx('click'); };
  $('p-resume').onclick = () => { UI.paused = false; $('screen-pause').hidden = true; };
  $('p-sound').onclick = () => { AUDIO.on = !AUDIO.on; $('p-sound').textContent = 'Sound: ' + (AUDIO.on ? 'on' : 'off'); };
  $('p-help').onclick = () => showHelp();
  $('p-quit').onclick = () => { saveGame(); $('screen-pause').hidden = true; toMenu(); };

  // Game over
  $('o-new').onclick = () => { $('screen-over').hidden = true; UI.menu.seed = randomSeed(); startNewGame(); };
  $('o-menu').onclick = () => { $('screen-over').hidden = true; toMenu(); };

  // HUD tools
  $('btn-build').onclick = () => { sfx('click'); if (UI.sheetKind === 'build') closeSheet(); else { setMode('normal'); openBuildMenu(); } };
  $('btn-road').onclick = () => { sfx('click'); setMode(R.mode === 'road' ? 'normal' : 'road'); };
  $('btn-attack').onclick = () => { sfx('click'); setMode(R.mode === 'attack' ? 'normal' : 'attack'); };
  $('btn-home').onclick = () => {
    const L = getE(S.players[0].lander);
    if (L) { centerOn(L.x + 0.5, L.y + 0.5); openBuildingSheet(L); }
  };
  $('btn-speed').onclick = () => { UI.speed = UI.speed >= 3 ? 1 : UI.speed + 1; $('btn-speed').textContent = UI.speed + '×'; sfx('click'); };
  $('objective').onclick = () => { UI.objCollapsed = !UI.objCollapsed; UI.hudT = 0; };
  $('sheet-close').onclick = () => closeSheet();
  $('banner-cancel').onclick = () => setMode('normal');
  $('banner-ok').onclick = () => confirmBanner();

  document.addEventListener('visibilitychange', () => { if (document.hidden && UI.inGame) saveGame(); });
  window.addEventListener('pagehide', () => { if (UI.inGame) saveGame(); });
  setInterval(() => { if (UI.inGame && !UI.paused) saveGame(); }, 20000);
  syncMenu();
}

function syncMenu() {
  for (const btn of $('m-mode').children) btn.classList.toggle('on', btn.dataset.v === UI.menu.mode);
  for (const btn of $('m-diff').children) btn.classList.toggle('on', btn.dataset.v === UI.menu.diff);
  $('m-diff-field').hidden = UI.menu.mode === 'colony';
  $('m-mode-desc').textContent = UI.menu.mode === 'colony'
    ? 'No rival. A big planet to settle at your own pace. Build supply chains and spread across the whole map.'
    : 'Race a rival colony on a small planet. Build up, then capture its Lander to win.';
  $('m-seed').textContent = 'Planet #' + UI.menu.seed;
  $('m-continue').hidden = !hasSave();
}

/* ------------------------------------------------------------------ game flow */

function startNewGame() {
  clearSave();
  newGame({ seed: UI.menu.seed, difficulty: UI.menu.diff, mode: UI.menu.mode });
  enterGame();
  postMsg(0, UI.menu.mode === 'colony'
    ? 'Your bots have landed. Build, expand and make this planet home.'
    : 'Your bots have landed. A rival colony landed to the north. Build up fast!', 0, 0, 'info');
}

function continueGame() {
  if (!loadGame()) { syncMenu(); return; }
  enterGame();
  postMsg(0, 'Welcome back.', 0, 0, 'info');
}

function enterGame() {
  bakeMap();
  UI.inGame = true; UI.paused = false; UI.overShown = false; UI.speed = 1;
  $('btn-speed').textContent = '1×';
  $('screen-menu').hidden = true;
  $('hud').hidden = false;
  $('toasts').innerHTML = '';
  const colony = S.mode === 'colony';
  $('btn-attack').hidden = colony;
  $('bottombar').classList.toggle('three', colony);
  closeSheet();
  setMode('normal');
  const L = getE(S.players[0].lander);
  R.cam.z = clamp(Math.min(R.w, 520) / 11, 26, 48);
  if (L) centerOn(L.x + 0.5, L.y - 1);
  saveGame();
}

function toMenu() {
  UI.inGame = false;
  UI.paused = false;
  closeSheet();
  setMode('normal');
  $('hud').hidden = true;
  $('screen-menu').hidden = false;
  syncMenu();
  startDemo();
}

function showHelp() {
  UI.paused = UI.inGame;
  $('screen-help').hidden = false;
}

function showGameOver() {
  UI.overShown = true;
  clearSave();
  const won = S.winner === 0;
  sfx(won ? 'win' : 'lose');
  $('o-title').textContent = won ? 'Victory!' : 'Defeat';
  $('o-text').textContent = won
    ? 'Your warbots captured the rival Lander. The planet is yours.'
    : 'The rival captured your Lander. Regroup and try again.';
  const st = S.players[0].stats;
  $('o-stats').innerHTML = [
    ['Time', fmtTime(S.time)], ['Buildings completed', st.built], ['Bots built', st.bots - START_WORKERS - START_WARBOTS],
    ['Enemy buildings captured', st.captured], ['Bots lost', st.lost],
  ].map(([k, v]) => `<span>${k}</span><span>${v}</span>`).join('');
  $('screen-over').hidden = false;
}

/* ------------------------------------------------------------------ modes & banner */

function setMode(mode) {
  R.mode = mode;
  R.ghost = null;
  R.overlay = null;
  UI.placeType = null;
  $('btn-road').classList.toggle('on', mode === 'road');
  $('btn-attack').classList.toggle('on', mode === 'attack');
  if (mode === 'normal') { $('banner').hidden = true; return; }
  closeSheet();
  if (mode === 'road') showBanner('Drag across open ground to lay <b>paths</b>; bots move almost twice as fast on them. Tap a path to remove it. Use two fingers to move the map.', null, 'Done');
  if (mode === 'attack') showBanner('Tap a <b>rival building</b> to choose how many warbots to send.', null, 'Cancel');
}

function showBanner(html, okLabel, cancelLabel) {
  $('banner').hidden = false;
  $('banner-text').innerHTML = html;
  $('banner-ok').hidden = !okLabel;
  if (okLabel) $('banner-ok').textContent = okLabel;
  $('banner-cancel').textContent = cancelLabel || 'Cancel';
}

function enterPlaceMode(type) {
  closeSheet();
  setMode('place');
  UI.placeType = type;
  refreshOverlay(type);
  showBanner(`Tap a highlighted spot to place a <b>${BDEFS[type].name}</b>.`, null, 'Cancel');
  if (!R.overlay.valid.some((v) => v)) {
    showBanner(`<span class="err">There is no valid spot for a ${BDEFS[type].name} in your territory${BDEFS[type].gather ? ' near the right resource' : ''}. Expand with an Outpost.</span>`, null, 'Close');
  }
}

function confirmBanner() {
  if (R.mode !== 'place' || !R.ghost || !R.ghost.ok) return;
  const { type, x, y } = R.ghost;
  const res = placeSite(0, type, x, y);
  if (!res.ok) { sfx('error'); showBanner(`<span class="err">${res.reason}</span>`, null, 'Cancel'); return; }
  sfx('place');
  addFx('ring', x + 0.5, y + 0.5, { color: PLAYER_COLORS[0] });
  setMode('normal');
}

/* ------------------------------------------------------------------ map taps */

function buildingAtTap(i, j, wx, wy) {
  if (inMap(i, j) && S.bAt[tIdx(i, j)]) return getE(S.bAt[tIdx(i, j)]);
  for (const b of S.buildings) {
    if (!b.dead && b.type === 'lander' && dist2(b.x + 0.5, b.y + 0.5, wx, wy) < 1.1) return b;
  }
  return null;
}

function onMapTap(i, j, wx, wy) {
  if (!UI.inGame || UI.paused) return;
  if (R.mode === 'place') {
    if (!inMap(i, j)) return;
    const type = UI.placeType;
    if (R.ghost && R.ghost.x === i && R.ghost.y === j && R.ghost.ok) { confirmBanner(); return; }
    const chk = canPlace(0, type, i, j);
    R.ghost = { type, x: i, y: j, ok: chk.ok };
    if (chk.ok) {
      let extra = '';
      const def = BDEFS[type];
      if (def.gather) extra = ` <span class="ok">${countResIn(i, j, def.radius, def.gather)} ${RES[def.gather].name.toLowerCase()}s in reach.</span>`;
      showBanner(`Place the <b>${def.name}</b> here?${extra}`, 'Build here', 'Cancel');
    } else {
      sfx('error');
      showBanner(`<span class="err">${chk.reason}</span>`, null, 'Cancel');
    }
    return;
  }
  if (R.mode === 'road') {
    if (!inMap(i, j)) return;
    const t = tIdx(i, j);
    if (S.road[t]) { setRoad(i, j, false); sfx('click'); }
    else if (canRoad(0, i, j)) { setRoad(i, j, true); sfx('click'); }
    else sfx('error');
    return;
  }
  const b = buildingAtTap(i, j, wx, wy);
  if (R.mode === 'attack') {
    if (b && b.owner !== 0) { setMode('normal'); openBuildingSheet(b); }
    else { sfx('error'); showBanner('<span class="err">That is not a rival building. Tap one of theirs (red).</span>', null, 'Cancel'); }
    return;
  }
  if (b) { sfx('click'); openBuildingSheet(b); return; }
  let bot = null, bd = 0.3;
  for (const u of S.bots) {
    if (u.dead || u.inside) continue;
    const d = dist2(u.x, u.y, wx, wy);
    if (d < bd) { bd = d; bot = u; }
  }
  if (bot) { sfx('click'); openBotSheet(bot); return; }
  if (inMap(i, j) && S.res[tIdx(i, j)]) { sfx('click'); openResourceSheet(tIdx(i, j)); return; }
  closeSheet();
}

function onRoadPaint(i, j, first) {
  if (R.mode !== 'road') return;
  const from = first || !UI.lastPaint ? { i, j } : UI.lastPaint;
  for (const [x, y] of tileLine(from.i, from.j, i, j)) if (canRoad(0, x, y)) setRoad(x, y, true);
  UI.lastPaint = { i, j };
}

/* ------------------------------------------------------------------ sheets */

function openSheet(kind, id, html) {
  UI.sheetKind = kind;
  UI.sheetFor = id;
  UI.demolishArm = 0;
  $('sheet-body').innerHTML = html;
  $('sheet').hidden = false;
  $('banner').hidden = true;
}

function closeSheet() {
  $('sheet').hidden = true;
  UI.sheetKind = null;
  UI.sheetFor = 0;
  R.selected = 0;
  R.selTile = -1;
  UI.selBot = 0;
}

function costHTML(cost, have) {
  return Object.keys(cost).map((g) => `<span class="${have && have[g] < cost[g] ? 'short' : ''}"><i class="gi ${g}"></i>${cost[g]}</span>`).join('');
}

function openBuildMenu() {
  const have = playerGoods(0);
  const sites = siteCount(0);
  const list = BUILD_MENU.filter((t) => !(S.mode === 'colony' && t === 'turret'));
  const html = `<div class="sheet-title"><h3>Build</h3></div>
    <p class="desc">Placing a site is free; workers carry the materials over from storage. ${sites}/${MAX_SITES} sites in progress.</p>
    <div class="build-grid">${list.map((t) => `<button class="bcard" data-t="${t}" ${sites >= MAX_SITES ? 'disabled' : ''}>
      <img src="${iconFor(t)}" alt=""><div class="bname">${BDEFS[t].name}</div><div class="bcost">${costHTML(BDEFS[t].cost, have)}</div></button>`).join('')}</div>`;
  openSheet('build', 0, html);
  for (const el of $('sheet-body').querySelectorAll('.bcard')) {
    el.onclick = () => { sfx('click'); enterPlaceMode(el.dataset.t); };
  }
}

function openBuildingSheet(b) {
  const def = BDEFS[b.type];
  const mine = b.owner === 0;
  R.selected = b.id; R.selTile = -1; UI.selBot = 0;
  const desc = !mine && b.type === 'lander' ? 'The rival\'s landing craft and main base. Capture it to win.' : def.desc;
  let html = `<div class="sheet-title"><img src="${iconFor(b.type, b.owner)}" alt=""><div><h3>${def.name}</h3>
    <div class="owner"><span class="dot" style="background:${PLAYER_COLORS[b.owner]}"></span> ${mine ? 'Yours' : 'Rival'}</div></div></div>
    <p class="desc">${desc}</p><div class="status" id="sh-status"></div><div id="sh-dyn"></div>`;
  if (mine) {
    if (b.type === 'foundry' && S.mode !== 'colony') {
      html += `<div class="section-label">Produce</div><div class="seg" id="sh-mode">
        <button data-v="worker">Workers</button><button data-v="alt">Both</button><button data-v="warbot">Warbots</button></div>`;
    }
    html += '<div class="actions">';
    if (def.staff && b.built) html += `<button class="btn" id="sh-pause"></button>`;
    if (b.type !== 'lander') html += `<button class="btn danger" id="sh-demolish">${b.built ? 'Demolish' : 'Cancel site'}</button>`;
    html += '</div>';
  } else if (S.mode !== 'colony') {
    html += `<div class="section-label">Attack</div><div id="sh-attack"></div>
      <div class="stepper" id="sh-stepper"><button class="btn" id="sh-minus">−</button><span class="n" id="sh-n">0</span>
      <button class="btn" id="sh-plus">+</button><button class="btn primary" id="sh-send" style="flex:1">Send warbots</button></div>`;
  }
  openSheet('bld', b.id, html);
  if (mine) {
    const seg = $('sh-mode');
    if (seg) for (const btn of seg.children) btn.onclick = () => { b.mode = btn.dataset.v; sfx('click'); refreshSheet(); };
    if ($('sh-pause')) $('sh-pause').onclick = () => { setPaused(b, !b.paused); sfx('click'); refreshSheet(); };
    if ($('sh-demolish')) $('sh-demolish').onclick = () => {
      if (!UI.demolishArm) {
        UI.demolishArm = 1;
        $('sh-demolish').textContent = BDEFS[b.type].mil && b.built ? 'Tap again: buildings outside your border will be lost' : 'Tap again to confirm';
        return;
      }
      demolish(b);
      sfx('boom');
      closeSheet();
    };
  } else if ($('sh-send')) {
    UI.attackN = attackAvailable(0, b);
    $('sh-minus').onclick = () => { UI.attackN = Math.max(1, UI.attackN - 1); refreshSheet(); };
    $('sh-plus').onclick = () => { UI.attackN = Math.min(attackAvailable(0, b), UI.attackN + 1); refreshSheet(); };
    $('sh-send').onclick = () => {
      const n = sendAttack(0, b, UI.attackN);
      if (n > 0) {
        sfx('alert');
        toast(`${n} warbot${n > 1 ? 's' : ''} sent to attack the ${def.name}.`, 'info');
        closeSheet();
      }
    };
  }
  refreshSheet();
}

function refreshBuildingSheet(b) {
  const def = BDEFS[b.type];
  const mine = b.owner === 0;
  const parts = [];
  $('sh-status').textContent = mine ? b.status || '' : (b.built ? '' : 'Construction site');
  if (!b.built) {
    parts.push(`<div class="bar"><div style="width:${Math.round(b.progress * 100)}%"></div></div>`);
    parts.push('<div class="section-label">Materials delivered</div><div class="goodlist">' +
      Object.keys(def.cost).map((g) => goodTag(g, `${b.stock[g] || 0}/${def.cost[g]}`, (b.stock[g] || 0) < def.cost[g])).join('') + '</div>');
  } else {
    parts.push(`<div class="kv"><span>Armor</span><span>${Math.ceil(Math.max(0, b.armor))} / ${def.armor}</span></div>
      <div class="bar armor"><div style="width:${Math.max(0, (b.armor / def.armor) * 100)}%"></div></div>`);
    if (mine && def.staff) {
      const op = getE(b.staff);
      parts.push(`<div class="kv"><span>Worker</span><span>${b.paused ? 'Paused' : op ? (op.inside === b.id ? 'Inside' : 'Out working') : b.staffInc ? 'On the way' : 'None yet'}</span></div>`);
    }
    if (def.gather) {
      const g = RES[def.gather].good;
      parts.push(`<div class="kv"><span>${RES[def.gather].name}s in reach</span><span>${countResIn(b.x, b.y, def.radius, def.gather)}</span></div>`);
      if (mine) parts.push(`<div class="kv"><span>Waiting for pickup</span><span>${goodTag(g, `${b.stock[g] || 0}/${def.out[g]}`)}</span></div>`);
    }
    if (def.plant) parts.push(`<div class="kv"><span>Stalk groves in reach</span><span>${countResIn(b.x, b.y, def.radius, R_STALK)}</span></div>`);
    if (def.inp && mine) {
      const ins = Object.keys(def.inp).map((g) => goodTag(g, `${b.stock[g] || 0}/${INPUT_CAP}`, !(b.stock[g] > 0))).join('');
      const outs = def.make ? Object.keys(def.make).map((g) => goodTag(g, `${b.stock[g] || 0}/${def.out[g]}`)).join('') : '';
      const recipe = Object.keys(def.inp).map((g) => GOOD[g].name).join(' + ') + ' → ' + (def.make ? Object.keys(def.make).map((g) => GOOD[g].name).join('') : 'a new bot');
      parts.push(`<div class="kv"><span>Recipe</span><span>${recipe}, ${def.work}s</span></div>`);
      parts.push(`<div class="section-label">Inputs</div><div class="goodlist">${ins}</div>`);
      if (outs) parts.push(`<div class="section-label">Output</div><div class="goodlist">${outs}</div>`);
      if (def.bots) parts.push(`<div class="kv"><span>Next bot</span><span>${b.mode === 'alt' ? (b.altNext === 'worker' ? 'Worker' : 'Warbot') : b.mode === 'worker' ? 'Worker' : 'Warbot'}</span></div>`);
      if (b.timer > 0 && b.status === 'Working') parts.push(`<div class="bar"><div style="width:${Math.round((b.timer / def.work) * 100)}%"></div></div>`);
    }
    if (def.store && mine) {
      const list = GOODS.filter((g) => b.stock[g] > 0).map((g) => goodTag(g, b.stock[g])).join('') || '<span class="desc">Empty</span>';
      parts.push(`<div class="section-label">Stored</div><div class="goodlist">${list}</div>`);
      let idle = 0;
      for (const u of S.bots) if (!u.dead && u.inside === b.id && u.type === 'worker') idle++;
      parts.push(`<div class="kv"><span>Workers resting here</span><span>${idle}</span></div>`);
    }
    if (def.mil) parts.push(`<div class="kv"><span>${mine ? 'Warbots inside' : 'Defenders inside'}</span><span>${b.garrison.length} / ${def.garrison}</span></div>`);
    if (def.mil && mine && S.mode !== 'colony') parts.push(`<div class="kv"><span>Territory radius</span><span>${def.terr} tiles</span></div>`);
    if (def.ammo && mine) parts.push(`<div class="kv"><span>Ammo</span><span>${b.shots + (b.stock.crystal || 0) * SHOTS_PER_AMMO} shots</span></div>`);
  }
  $('sh-dyn').innerHTML = parts.join('');
  if ($('sh-pause')) $('sh-pause').textContent = b.paused ? 'Resume' : 'Pause';
  if ($('sh-mode')) for (const btn of $('sh-mode').children) btn.classList.toggle('on', btn.dataset.v === b.mode);
  if ($('sh-send')) {
    const avail = attackAvailable(0, b);
    UI.attackN = clamp(UI.attackN || avail, Math.min(1, avail), avail);
    $('sh-n').textContent = UI.attackN;
    $('sh-send').disabled = avail === 0;
    $('sh-attack').innerHTML = avail
      ? `<p class="desc">${avail} warbot${avail > 1 ? 's' : ''} can reach this from your garrisons (each garrison keeps one at home).</p>`
      : `<p class="desc">No warbots in range. Warbots attack from Outposts or your Lander within ${ATTACK_RANGE} tiles. Build an Outpost closer and let warbots gather there.</p>`;
  }
}

function botActivity(u) {
  const t = u.task;
  const nm = (id) => { const b = getE(id); return b ? BDEFS[b.type].name : 'a building'; };
  if (u.type === 'warbot') {
    if (u.fight) return 'Fighting!';
    if (!t) return u.inside ? 'Standing guard inside' : 'Waiting for orders';
    if (t.type === 'garrison') return `Marching to the ${nm(t.bld)}`;
    if (t.type === 'attack') return `Attacking the rival ${nm(t.target)}`;
    if (t.type === 'defend') return `Defending the ${nm(t.home)}`;
    return 'On patrol';
  }
  if (!t) return u.carry ? `Looking for somewhere to store ${GOOD[u.carry].name}` : u.inside ? 'Resting in storage' : 'Waiting for a job';
  if (t.type === 'home') return 'Heading back to storage';
  if (t.type === 'haul') return t.phase === 'toSrc' ? `Fetching ${GOOD[t.good].name} from the ${nm(t.src)}` : `Delivering ${GOOD[t.good].name} to the ${nm(t.dst)}`;
  if (t.type === 'build') return t.phase === 'go' ? `Walking to build a ${nm(t.site)}` : `Constructing a ${nm(t.site)}`;
  if (t.type === 'staff') {
    const b = getE(t.bld), def = b ? BDEFS[b.type] : {};
    if (t.phase === 'go') return `Walking to its job at the ${nm(t.bld)}`;
    if (t.phase === 'toNode') return def.plant ? 'Heading out to plant a grove' : `Heading out to gather ${def.gather ? GOOD[RES[def.gather].good].name : ''}`;
    if (t.phase === 'work') return def.plant ? 'Planting a stalk grove' : `Harvesting ${def.gather ? RES[def.gather].name.toLowerCase() : ''}`;
    if (t.phase === 'back') return u.carry ? `Bringing ${GOOD[u.carry].name} back` : `Walking back to the ${nm(t.bld)}`;
    return `Working at the ${nm(t.bld)}`;
  }
  return 'Busy';
}

function openBotSheet(u) {
  R.selected = 0; R.selTile = -1; UI.selBot = u.id;
  const html = `<div class="sheet-title"><div><h3>${u.type === 'warbot' ? 'Warbot' : 'Worker'}</h3>
    <div class="owner"><span class="dot" style="background:${PLAYER_COLORS[u.owner]}"></span> ${u.owner === 0 ? 'Yours' : 'Rival'}</div></div></div>
    <p class="desc">${u.type === 'warbot' ? 'Fights enemy bots and captures enemy buildings.' : 'Carries goods, builds construction sites and runs buildings.'}</p>
    <div class="status" id="sh-status"></div><div id="sh-dyn"></div>`;
  openSheet('bot', u.id, html);
  refreshSheet();
}

function openResourceSheet(t) {
  R.selected = 0; R.selTile = t; UI.selBot = 0;
  const type = S.res[t], info = RES[type];
  const by = Object.keys(BDEFS).find((k) => BDEFS[k].gather === type);
  const html = `<div class="sheet-title"><div><h3>${info.name}</h3></div></div>
    <p class="desc">Gives ${GOOD[info.good].name}. Gathered by a ${BDEFS[by].name} within ${BDEFS[by].radius} tiles.${type === R_STALK ? ' A Grove Planter can grow more.' : ' It runs out eventually, so expand to find more.'}</p>
    <div id="sh-dyn"></div>`;
  openSheet('res', t, html);
  refreshSheet();
}

function refreshSheet() {
  if (!UI.sheetKind || UI.sheetKind === 'build') return;
  if (UI.sheetKind === 'bld') {
    const b = getE(UI.sheetFor);
    if (!b) { closeSheet(); return; }
    refreshBuildingSheet(b);
  } else if (UI.sheetKind === 'bot') {
    const u = getE(UI.sheetFor);
    if (!u || u.inside) { closeSheet(); return; }
    $('sh-status').textContent = botActivity(u);
    $('sh-dyn').innerHTML = `<div class="kv"><span>Health</span><span>${Math.ceil(u.hp)} / ${u.maxHp}</span></div>` +
      (u.carry ? `<div class="kv"><span>Carrying</span><span>${goodTag(u.carry, GOOD[u.carry].name)}</span></div>` : '');
  } else if (UI.sheetKind === 'res') {
    const t = UI.sheetFor;
    if (!S.res[t]) { closeSheet(); return; }
    const grow = S.res[t] === R_STALK && S.grow[t] < 1 ? `<div class="kv"><span>Growing</span><span>${Math.round(S.grow[t] * 100)}%</span></div>` : '';
    $('sh-dyn').innerHTML = `<div class="kv"><span>Harvests left</span><span>${S.amt[t]}</span></div>${grow}`;
  }
}

/* ------------------------------------------------------------------ HUD */

const OBJECTIVES = [
  { text: 'Tap <b>Build</b> and place a <b>Harvester</b> beside the teal stalk groves.', done: () => hasBuilt('harvester') },
  { text: 'Build a <b>Quarry</b> near the grey boulders to get Stone.', done: () => hasBuilt('quarry') },
  { text: 'Build an <b>Ore Mine</b> by the dark ore veins and a <b>Crystal Tap</b> by the violet crystals.', done: () => hasBuilt('mine') && hasBuilt('tap') },
  { text: 'Build a <b>Smelter</b>: it turns Ore and Fiber into Alloy.', done: () => hasBuilt('smelter') },
  { text: 'Build a <b>Chip Fab</b>: it turns Crystal and Alloy into Chips.', done: () => hasBuilt('fab') },
  { text: 'Build a <b>Bot Foundry</b> so you can make more workers.', done: () => hasBuilt('foundry') },
  { text: 'Build an <b>Outpost</b> near your border to claim more land.', done: () => hasBuilt('outpost') },
  { text: 'Tap <b>Paths</b> and draw roads between busy buildings so workers move faster.', done: () => S.road.reduce((a, v) => a + v, 0) >= 6 },
];

function hasBuilt(type) {
  for (const b of S.buildings) if (!b.dead && b.owner === 0 && b.built && b.type === type) return true;
  return false;
}

function objectiveText() {
  for (const o of OBJECTIVES) if (!o.done()) return o.text;
  if (S.mode === 'colony') {
    const pct = Math.round(landShare(0) * 100);
    const next = COLONY_MILESTONES[S.milestone];
    return next !== undefined
      ? `Colonize the planet: <b>${pct}%</b> claimed. Next milestone at ${Math.round(next * 100)}%.`
      : `<b>${pct}%</b> of the planet colonized. Every milestone reached!`;
  }
  return 'Gather warbots in Outposts near the rival, then tap the <b>rival Lander</b> and send them in to capture it.';
}

function updateHUD() {
  const goods = playerGoods(0);
  for (const g of GOODS) {
    const el = UI.goodEls[g];
    const v = goods[g];
    if (UI.lastGoods[g] !== undefined && v > UI.lastGoods[g]) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
    UI.lastGoods[g] = v;
    el.lastChild.textContent = v;
  }
  let workers = 0, idle = 0, war = 0;
  for (const u of S.bots) {
    if (u.dead || u.owner !== 0) continue;
    if (u.type === 'warbot') war++;
    else { workers++; if (isIdleWorker(u)) idle++; }
  }
  $('pop').innerHTML = `<span class="dot" style="background:#ece6da;box-shadow:inset 0 0 0 2px ${PLAYER_COLORS[0]}"></span>${workers} workers <span style="color:var(--muted)">(${idle} free)</span>` +
    (S.mode === 'colony' ? '' : ` <span class="dot" style="background:${PLAYER_COLORS[0]};border-radius:2px;transform:rotate(45deg)"></span>${war}`);
  $('clock').textContent = S.mode === 'colony' ? `${Math.round(landShare(0) * 100)}% land` : fmtTime(S.time);
  const obj = $('objective');
  obj.innerHTML = UI.objCollapsed ? 'Goal ▸' : objectiveText();
  obj.classList.toggle('small', UI.objCollapsed);
  if (UI.sheetKind === 'build') {
    // keep build-menu affordability current without rebuilding the buttons
    for (const el of $('sheet-body').querySelectorAll('.bcard')) {
      const cost = BDEFS[el.dataset.t].cost;
      el.querySelector('.bcost').innerHTML = costHTML(cost, goods);
    }
  }
}

function toast(text, kind, x, y) {
  const box = $('toasts');
  const el = document.createElement('div');
  el.className = 'toast ' + (kind || 'info');
  el.textContent = text;
  if (x !== undefined && (x || y)) el.onclick = () => centerOn(x + 0.5, y + 0.5);
  // Repeat messages (e.g. several buildings finishing at once) collapse into one line.
  const prev = box.lastElementChild;
  if (prev && prev.dataset.text === text) {
    prev.dataset.n = (+prev.dataset.n || 1) + 1;
    prev.textContent = `${text} ×${prev.dataset.n}`;
    return;
  }
  el.dataset.text = text;
  box.style.top = Math.round(document.getElementById('topbar').getBoundingClientRect().bottom + 6) + 'px';
  box.appendChild(el);
  while (box.children.length > 2) box.removeChild(box.firstChild);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 450); }, 3800);
}

function uiTick(dt) {
  AUDIO.suppress = !UI.inGame;
  if (!UI.inGame || !S) return;
  while (S.msgs.length) {
    const m = S.msgs.shift();
    toast(m.text, m.kind, m.x, m.y);
  }
  UI.hudT -= dt;
  if (UI.hudT <= 0) { UI.hudT = 0.25; updateHUD(); refreshSheet(); }
  if (S.winner >= 0 && !UI.overShown) showGameOver();
}

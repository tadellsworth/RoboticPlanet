'use strict';
/*
 * Terrafall: Contingency's bridge to battles (CONTINGENCY.md, Battles). A battle on the globe becomes a normal match
 * (contPlayBattle: contBattleSetup's ground, size and seats; the kit by rank, supply lines and refits; the defender's
 * fortifications and megastructure built; the Murmur at the territory's level), played as any game is, saved as any
 * game is (so Continue, or the battle card, resumes it), and when it ends its result goes back to the globe
 * (contBattleOver: the winner, the survivors, a megastructure finished, the fortifications standing). Withdraw, in the
 * pause menu, gives it up as a loss with a retreat.
 *
 * In the game, S.contingency holds what the match needs to know: the run's seed and the battle's id, the seats' sides,
 * the cap (25 minutes, 35 at a home), the hold for a battle against the Murmur alone, the defender's seat and the
 * colours (look: each seat in its callsign's colour). contBattleCheck runs from the simulation a few times a second:
 * deterministic, it reads only the game.
 */

const CONT_MEGA_TYPE = { lance: 'lance', ray: 'sunder', dome: 'dome', city: 'city', lift: 'lift', atmos: 'atmos', deepcore: 'deepcore', uplink: 'gup' };
/** The cards played inside a battle (CONT_CARDS: Orbital Drop, Called Ringfall, Corvane Flare), as orders (contCard). */
const CONT_IN_BATTLE = ['drop', 'ringfall', 'flare'];
/** The kit's warbots: how many land with the base (and how many more for the defender), and when the rest come (s). */
const CONT_WAVES = { first: 4, defender: 2, at: [180, 360] };
const CONT_DROP = { warbots: 6, reach: 4 }, CONT_RINGFALL = { hits: 5, spread: 2 }, CONT_FLARE = { bat: 20 };
const CONT_GOODS = { ore: 'ore', fiber: 'fiber', stone: 'stone', crude: 'crude', fuel: 'fuel', crystal: 'crystal' };

/** The new-game options for battle b of the run (its setup builds the kits). */
function contBattleOptions(run, b) {
  const B = contBattleSetup(run, b), def = B.seat.findIndex((x) => x.defender);
  const used = B.seat.map((x) => x.cs), look = used.concat([0, 1, 2, 3].filter((c) => !used.includes(c))).join('');
  return {
    seed: B.seed, mode: B.mode, size: B.size, rough: 1, rich: 1, shape: B.shape, biome: B.biome, players: Math.max(2, B.seat.length),
    difficulty: B.difficulty, styles: B.seat.slice(1).map((x) => x.doctrine), murmur: B.murmur, victory: B.victory, events: false, mega: true,
    setup(S) {
      S.contingency = { run: run.seed, battle: b.id, turn: run.turn, at: b.at, kind: B.kind, sides: B.seat.map((x) => x.side), def,
        cap: B.minutes * 60, hold: B.hold * 60, harrow: B.harrow ? 0 : -1, look, mega0: B.mega ? CONT_MEGA_TYPE[B.mega] : null,
        ironman: !!run.opts.ironman, torch: [], waves: B.seat.map(() => 0), waveN: 0, hands: B.seat.map((X) => contBattleHand(run, X)), pre: B.seat.map((X) => (X.card && CONT_IN_BATTLE.includes(X.card) ? 0 : -1)), used: B.seat.map(() => []), surge: -1 };
      B.seat.forEach((X, p) => contKit(S, p, X, B));
      // the cards that act as the battle starts: Road Standard, Foundry Surge, and a Corvane Flare year
      B.seat.forEach((X, p) => { if (X.card === 'road') contRoadStandard(p); if (X.card === 'surge') S.contingency.surge = p; });
      if (B.flare) for (const u of S.bots) if (!u.dead) u.bat = Math.min(u.bat ?? 100, 40);
    },
  };
}

/** Seat p's landing kit: goods by rank and supply lines, warbots by rank, refits; a defender's works. */
function contKit(S, p, X, B) {
  const P = S.players[p];
  if (!P || P.absent) return;
  const L = getE(P.lander);
  if (!L) return;
  const k = (X.stars - 1) / 4; // (1 star: the basic stock; 5 stars: about a 10-minute colony's worth)
  for (const g in START_STOCK) L.stock[g] = (L.stock[g] || 0) + Math.round(START_STOCK[g] * 2.5 * k);
  L.stock.ore = (L.stock.ore || 0) + Math.round(30 * k);
  for (const r of X.supply) if (CONT_GOODS[r]) L.stock[CONT_GOODS[r]] = (L.stock[CONT_GOODS[r]] || 0) + 15;
  const have = S.bots.filter((u) => !u.dead && u.owner === p && u.type === 'warbot').length;
  // the kit's warbots: CONT_WAVES.first land with the base (more for a defender), the rest in waves from the Carrier
  const now = Math.min(X.warbots, CONT_WAVES.first + (X.defender ? CONT_WAVES.defender : 0));
  for (let n = have; n < now; n++) enterBuilding(addBot(p, 'warbot', L.x, L.y), L);
  if (S.contingency) S.contingency.waves[p] = Math.max(0, X.warbots - Math.max(now, have));
  const put = (type, stock) => { const s = aiFindSpot(p, type, L); return s ? preBuild(p, type, s.x, s.y, { road: true, reach: 4, stock }) : null; };
  if (X.refits.includes('outpost')) put('outpost');
  // Sealed Research: its Research Lab upgrade, done; Torch Doctrine: its Torches burn the Murmur harder (contTorch)
  if (X.sealed && TECHS[X.sealed]) { P.tech = P.tech || {}; P.tech[X.sealed] = true; }
  if (X.refits.includes('torch') && S.contingency && !S.contingency.torch.includes(p)) S.contingency.torch.push(p);
  if (X.refits.includes('foundry')) put('foundry');
  if (X.defender) {
    if (B.fort >= 1) { put('turret', { crystal: 20 }); put('turret', { crystal: 20 }); }
    if (B.fort >= 2) { put('keep'); contWalls(S, p); }
    if (B.fort >= 3) {
      put('mortar', { ammo: 12 }); put('mortar', { ammo: 12 });
      // a Shield Dome site, laid out and waiting for its materials
      const s = aiFindSpot(p, 'dome', L);
      if (s) { const r = placeSite(p, 'dome', s.x, s.y); if (r && r.ok) { const route = roadRouteTo(p, r.building) || []; for (const t of route) setRoad(t % S.W, (t / S.W) | 0, true, p); } }
    }
    if (B.mega && CONT_MEGA_TYPE[B.mega]) put(CONT_MEGA_TYPE[B.mega]);
  }
  computeTerritory();
  P.stats.startBots = P.stats.bots;
}

/**
 * Fortification level 2's walls: a line of Wall 7 pieces long, 7 tiles out from seat p's Command Base across the way in
 * from its nearest foe (as Siege Breakers' outer works), with a gap where a road goes through.
 */
function contWalls(S, p) {
  const R = getE(S.players[p].lander), foes = S.players.filter((Q) => Q.id !== p && !Q.absent).map((Q) => getE(Q.lander)).filter(Boolean);
  if (!R || !foes.length) return;
  const L = foes.reduce((a, x) => (dist2(x.x, x.y, R.x, R.y) < dist2(a.x, a.y, R.x, R.y) ? x : a));
  const dx = L.x - R.x, dy = L.y - R.y, d = Math.sqrt(dx * dx + dy * dy) || 1, fx = dx / d, fy = dy / d, px = -fy, py = fx;
  const cx = R.x + fx * 7, cy = R.y + fy * 7;
  for (let k = -3; k <= 3; k++) {
    const i = Math.round(cx + px * k), j = Math.round(cy + py * k);
    if (!inMap(i, j)) continue;
    if (S.road[tIdx(i, j)]) continue; // (a gap where a road goes through)
    if (canPlace(p, 'wall', i, j).ok) addBuilding(p, 'wall', i, j, true);
  }
}

/** Play battle b as a match (the battle card's Play). */
function contPlayBattle(run, b) {
  run.playing = b.id;
  contStore(run);
  // (a battle already under way, saved: carry on with it)
  const saved = contSavedBattle();
  $('screen-contingency').hidden = true;
  CG.on = false; cancelAnimationFrame(CG.raf);
  if (typeof musicLore === 'function') { MUSIC.loreLevel = null; musicLore(false); }
  if (saved && saved.run === run.seed && saved.battle === b.id) { continueGame(); return; }
  clearSave();
  newGame({ ...contBattleOptions(run, b), scars: typeof scarsPref === 'function' ? scarsPref() : 'full' });
  UI.lastGame = null;
  enterGame();
  updateHUD();
  placeMinimap();
  const B = contBattleSetup(run, b), C = S.contingency;
  S.msgs.length = 0;
  const foes = C.sides.slice(1).map((s) => `${contSideName(run, s)} (${PERSONALITIES[run.sides[s].doctrine].name})`);
  postMsg(ME, `Terrafall complete: ${contName(b.at)}, ${CONT_REGIONS[CONT_MAP.T[b.at].region][0]}. Arrival clock: T+${run.turn}.`, 0, 0, 'info');
  if (B.mode === 'colony') postMsg(ME, b.kind === 'hollow' ? 'The Hollow assault: destroy the Deep\'s mound.' : `The Murmur hold this ground. Hold for ${B.hold} minutes, or clear the nests.`, 0, 0, 'warn');
  else postMsg(ME, `${foes.join(' and ')} ${foes.length > 1 ? 'are' : 'is'} here. ${B.victory === 'uplinks' ? 'Uplinks victory: hold the most.' : 'Capture their Command Base.'} At ${B.minutes} minutes the land held decides it${C.def >= 0 ? ', and a close count goes to the defender' : ''}. Withdraw is in the pause menu.`, 0, 0, 'info');
  $('br-title').textContent = `Battle for ${contName(b.at)}`;
  showBriefing();
  saveGame();
}
/** The saved game's Contingency battle, if the save is one: { run, battle }. */
function contSavedBattle() {
  try { const j = localStorage.getItem(SAVE_KEY); if (!j) return null; const m = /"contingency":\{"run":(\d+),"battle":(\d+)/.exec(j); return m ? { run: +m[1], battle: +m[2] } : null; } catch (e) { return null; }
}

/** From the simulation, a few times a second (deterministic): the cap, the hold, the Hollow's mound, the Harrow. */
function contBattleCheck() {
  const C = S.contingency;
  if (!C || S.winner >= 0) return;
  if (C.hands) contAiCards();
  // the rest of each kit, in waves at its Command Base
  if (C.waves && C.waveN < CONT_WAVES.at.length && S.time >= CONT_WAVES.at[C.waveN]) {
    const last = C.waveN === CONT_WAVES.at.length - 1;
    C.waves.forEach((n, p) => {
      const P = S.players[p], L = P && !P.out && getE(P.lander), k = last ? n : Math.ceil(n / 2);
      if (!L || !k) return;
      for (let q = 0; q < k; q++) enterBuilding(addBot(p, 'warbot', L.x, L.y), L);
      C.waves[p] = n - k;
      postMsg(p, `${k} more warbots down from the Carrier.`, L.x, L.y, 'good');
    });
    C.waveN++;
  }
  // the Harrow comes up six minutes in, at the nest nearest your landing, where the Murmur are at full strength
  if (C.harrow === 0 && S.time >= 360 && typeof spawnHarrow === 'function') {
    C.harrow = 1;
    const L = getE(S.players[0].lander), nests = S.buildings.filter((x) => !x.dead && (x.type === 'nest' || x.type === 'mound'));
    if (L && nests.length) { const n = nests.reduce((a, x) => (dist2(x.x, x.y, L.x, L.y) < dist2(a.x, a.y, L.x, L.y) ? x : a)); spawnHarrow(n.x, n.y, 0); }
  }
  // the Hollow: the mound's Harrows, two of them, one each way (with one colony, harrowMound sends only one)
  if (C.kind === 'hollow' && !C.twin && S.mur && S.mur.hw && S.mur.hw.mound) {
    C.twin = 1;
    const m = S.buildings.find((x) => !x.dead && x.type === 'mound'), L = getE(S.players[0].lander);
    if (m && L) { const cs = bCentre(m), a = datan2(L.y + 0.5 - cs.y, L.x + 0.5 - cs.x) + Math.PI; spawnHarrow(cs.x + dcos(a) * 4, cs.y + dsin(a) * 4, 0, { nest: m.id }); }
  }
  if (C.kind === 'hollow' && S.time > 30 && !S.buildings.some((x) => !x.dead && x.type === 'mound')) { S.winner = 0; S.endHow = 'capture'; return; }
  if (C.hold && S.time >= C.hold) { S.winner = 0; S.endHow = 'hold'; return; }
  if (C.kind === 'murmur' && S.time > 60 && !S.buildings.some((x) => !x.dead && x.type === 'nest')) { S.winner = 0; S.endHow = 'capture'; return; } // (the nests cleared)
  if (S.mode === 'colony' && S.players[0].out) { S.winner = 1; S.endHow = 'capture'; return; }
  if (S.time < C.cap) return;
  // the cap: scored on land held (the Domination count); a close count goes to the defender
  const land = S.players.map(() => 0);
  for (let t = 0; t < S.W * S.H; t++) { const o = S.owner[t]; if (o >= 0 && o < land.length && !S.players[o].out) land[o]++; }
  let best = 0;
  for (let p = 1; p < land.length; p++) if (land[p] > land[best]) best = p;
  if (C.def >= 0 && C.def !== best && !S.players[C.def].out && land[C.def] >= land[best] * 0.9) best = C.def;
  if (S.mode === 'colony') best = 0;
  S.winner = best; S.endHow = 'domination';
}

/** The match is over (showGameOver hands it here): its result to the globe, and back to the globe. */
function contBattleOver(withdrew) {
  const C = S.contingency, run = contRestore();
  const b = run && run.battles.find((x) => x.id === C.battle && !x.result);
  clearSave();
  if (!b) { toMenu(); openContingency(); return; }
  const side = (p) => (p >= 0 && p < C.sides.length ? C.sides[p] : CONT_MURMUR);
  let winner;
  if (withdrew) winner = b.sides.find((s) => s !== 0) ?? CONT_MURMUR;
  else if (S.mode === 'colony') winner = S.winner === 0 ? 0 : CONT_MURMUR;
  else winner = side(S.winner);
  if (!b.sides.includes(winner)) winner = b.sides.find((s) => s !== 0);
  const wp = C.sides.indexOf(winner);
  const survivors = wp >= 0 ? S.bots.filter((u) => !u.dead && u.owner === wp && BOTS[u.type] && BOTS[u.type].war).length : 0;
  // a megastructure the winner finished (one not built for it at the start), and the defences standing
  const megas = wp >= 0 ? S.buildings.filter((x) => !x.dead && x.built && x.owner === wp && BDEFS[x.type].mega && x.type !== C.mega0) : [];
  const mega = megas.length ? Object.keys(CONT_MEGA_TYPE).find((k) => CONT_MEGA_TYPE[k] === megas[0].type) : null;
  const holder = run.t[b.at].owner === winner || winner === CONT_MURMUR ? (C.def >= 0 ? C.def : -1) : wp;
  let forts;
  if (holder >= 0) {
    const n = (type) => S.buildings.filter((x) => !x.dead && x.built && x.owner === holder && x.type === type).length;
    forts = n('turret') + n('minigun') + n('bunker') >= 2 ? 1 : 0;
    if (forts && n('keep')) forts = 2;
    if (forts === 2 && (n('mortar') || n('dome'))) forts = 3;
  }
  // the cards: those played are spent from the run's hand; one played on the battle card and not used goes back to it
  if (C.hands) C.sides.forEach((s, p) => {
    const hand = C.hands[p] || [], used = C.used[p] || [], S0 = run.sides[s];
    hand.forEach((k, i) => {
      if (i === 0 && C.pre[p] === 0) { if (!used.includes(0)) S0.cards.push(k); return; }
      if (used.includes(i)) { const j = S0.cards.indexOf(k); if (j >= 0) S0.cards.splice(j, 1); }
    });
  });
  contBattleResult(run, b, { winner, survivors: { [winner]: survivors }, mega, forts, withdrew: !!withdrew });
  run.playing = 0;
  contStore(run);
  toMenu();
  CG.lastBattle = `${contName(b.at)}: ${winner === 0 ? 'won' : withdrew ? 'withdrawn' : 'lost'}${survivors && winner === 0 ? `, ${survivors} warbots standing` : ''}.`;
  openContingency();
  if (CG.run && CG.run.phase === 'plan') { CG.lastBattle = ''; cgSheet('report'); }
}

/** Withdraw (the pause menu, in a Contingency battle): a loss with a retreat. */
function contWithdraw() {
  if (!S || !S.contingency) return;
  $('screen-pause').hidden = true;
  UI.paused = false;
  contBattleOver(true);
}

/* ------------------------------------------------------------------ cards in battle (stage 4): lockstep orders */

/**
 * Seat X's cards for the battle: the one played on the battle card first (if it acts in battle), then the in-battle
 * cards in its side's hand (Orbital Drop, Called Ringfall, Corvane Flare). Using one in the match spends it from the run.
 */
function contBattleHand(run, X) {
  const hand = X.card && CONT_IN_BATTLE.includes(X.card) ? [X.card] : [];
  for (const k of run.sides[X.side].cards) if (CONT_IN_BATTLE.includes(k) && hand.length < 6) hand.push(k);
  return hand;
}
/** Is card i of seat p's hand there to play (and its spot, for those aimed, on the map)? */
function contCardOk(p, i, x, y) {
  const C = S.contingency;
  if (!C || S.winner >= 0 || !Array.isArray(C.hands) || !C.hands[p] || !Number.isInteger(i) || i < 0 || i >= C.hands[p].length || C.used[p].includes(i)) return false;
  const k = C.hands[p][i];
  if (k === 'flare') return true;
  return Number.isInteger(x) && Number.isInteger(y) && inMap(x, y);
}
/**
 * Seat p plays card i of its hand (an order: contCard in js/orders.js, the same tick on every device; the computer's
 * from contBattleCheck). Orbital Drop: warbots land at (x, y), on open ground near it. Called Ringfall: pieces of the
 * Ring strike round (x, y). Corvane Flare: every rival colony's robots' batteries drain.
 */
function contPlayCard(p, i, x, y) {
  if (!contCardOk(p, i, x, y)) return false;
  const C = S.contingency, k = C.hands[p][i];
  if (k === 'drop') {
    let n = 0;
    for (let r = 0; r <= CONT_DROP.reach && n < CONT_DROP.warbots; r++) for (let j = y - r; j <= y + r && n < CONT_DROP.warbots; j++) for (let q = x - r; q <= x + r && n < CONT_DROP.warbots; q++) {
      if (Math.max(Math.abs(q - x), Math.abs(j - y)) !== r || !inMap(q, j)) continue;
      const t = tIdx(q, j);
      if (S.terrain[t] !== T_GROUND || S.bAt[t] || !walkable(t)) continue;
      addBot(p, 'warbot', q + 0.5, j + 0.5); n++;
    }
    if (!n) return false;
    addFx('ring', x + 0.5, y + 0.5, { color: PLAYER_COLORS[p], r: 3 });
    postMsg(p, `Orbital Drop: ${n} warbots down from the Carrier.`, x, y, 'good');
    for (const P of S.players) if (P.id !== p && !P.absent) postMsg(P.id, `${playerName(p)} dropped reinforcements from orbit!`, x, y, 'bad');
  } else if (k === 'ringfall') {
    const E = { cratered: {}, relaid: {}, msgT: -99 };
    for (let h = 0; h < CONT_RINGFALL.hits; h++) {
      const a = (h / CONT_RINGFALL.hits) * Math.PI * 2, d = h ? CONT_RINGFALL.spread : 0;
      const i2 = clamp(Math.round(x + dcos(a) * d), 0, S.W - 1), j2 = clamp(Math.round(y + dsin(a) * d), 0, S.H - 1);
      meteorImpact(E, { x: i2, y: j2 });
    }
    postMsg(p, 'Called Ringfall: the Ring answered.', x, y, 'good');
  } else if (k === 'flare') {
    for (const u of S.bots) if (!u.dead && u.owner !== p && S.players[u.owner] && !isWild(u.owner)) u.bat = Math.min(u.bat ?? 100, CONT_FLARE.bat);
    for (const P of S.players) if (!P.absent) postMsg(P.id, P.id === p ? 'Corvane Flare called: the rivals\' batteries are draining.' : 'Corvane flare! Battery reserves draining.', undefined, undefined, P.id === p ? 'good' : 'bad');
  } else return false;
  C.used[p].push(i);
  return true;
}
/** The computer's cards in a battle: the Flare at 4 minutes, the Drop beside its base at 5, the Ringfall on its foe's at 7. */
function contAiCards() {
  const C = S.contingency;
  for (let p = 1; p < C.hands.length; p++) {
    const P = S.players[p];
    if (!P || P.absent || P.out || !P.ai) continue;
    C.hands[p].forEach((k, i) => {
      if (C.used[p].includes(i)) return;
      const L = getE(P.lander), foe = getE(S.players[0].lander);
      if (k === 'flare' && S.time >= 240) contPlayCard(p, i);
      else if (k === 'drop' && S.time >= 300 && L) contPlayCard(p, i, L.x, L.y + 3);
      else if (k === 'ringfall' && S.time >= 420 && foe) contPlayCard(p, i, foe.x, foe.y);
    });
  }
}
/** Foundry Surge: seat C.surge's Bot Foundries work at double speed for the first 5 minutes (produce, in js/sim.js). */
function contWork(b) { const C = S.contingency; return C && C.surge === b.owner && b.type === 'foundry' && S.time < 300 ? 2 : 1; }
/** Road Standard: seat p's base starts linked by road to its nearest Stone and Ore (as far as open ground allows). */
function contRoadStandard(p) {
  const L = getE(S.players[p].lander);
  if (!L) return;
  for (const want of [R_BOULDER, R_ORE]) {
    let best = -1, bd = 30 * 30;
    for (let t = 0; t < S.W * S.H; t++) { if (S.res[t] !== want) continue; const d = dist2(t % S.W, (t / S.W) | 0, L.x, L.y); if (d < bd) { bd = d; best = t; } }
    if (best < 0) continue;
    const tx = best % S.W, ty = (best / S.W) | 0, n = Math.ceil(Math.sqrt(bd));
    for (let s = 2; s < n; s++) {
      const i = Math.round(L.x + ((tx - L.x) * s) / n), j = Math.round(L.y + ((ty - L.y) * s) / n), t = tIdx(i, j);
      if (S.terrain[t] !== T_GROUND || S.res[t] || S.ramp[t]) break;
      if (S.bAt[t] || S.road[t]) continue;
      setRoad(i, j, true, p);
    }
  }
}

/* ------------------------------------------------------------------ the battle's corner: its clock and the card bar */

const CGB = { aim: -1, key: '' };
/** A few times a second (uiTick): the clock, and the cards still to play. */
function contBarTick() {
  const C = UI.inGame && S && S.contingency, bar = $('cg-bar');
  if (!C || S.winner >= 0) { if (!bar.hidden) { bar.hidden = true; $('cg-aim').hidden = true; CGB.aim = -1; } return; }
  bar.hidden = false;
  const left = C.hold ? C.hold - S.time : C.cap - S.time, m = Math.max(0, Math.floor(left / 60)), s = Math.max(0, Math.floor(left % 60));
  $('cg-bar-time').textContent = `${C.hold ? 'Dawn in' : 'Cap'} ${m}:${String(s).padStart(2, '0')}`;
  const hand = (C.hands && C.hands[ME]) || [], key = hand.map((k, i) => (C.used[ME].includes(i) ? '-' : k)).join(',');
  if (key === CGB.key) return;
  CGB.key = key;
  $('cg-bar-cards').innerHTML = hand.map((k, i) => C.used[ME].includes(i) ? '' : `<button type="button" class="btn small cg-card-b" data-i="${i}" title="${esc(CONT_CARDS[k].name + ': ' + CONT_CARDS[k].desc)}">${esc(CONT_CARDS[k].name)}</button>`).join('');
  $('cg-bar-cards').querySelectorAll('[data-i]').forEach((b) => { b.onclick = () => contCardTap(+b.dataset.i); });
}
/** A card tapped: the Flare goes at once; a Drop or a Ringfall aims at the middle of the view first (pan to aim). */
function contCardTap(i) {
  const C = S.contingency, k = C.hands[ME][i];
  sfx('click');
  if (k === 'flare') { act('contCard', [i]); CGB.key = ''; return; }
  CGB.aim = i;
  $('cg-aim').hidden = false;
  $('cg-aim-what').textContent = `${CONT_CARDS[k].name}: tap the spot (or move the map and tap Here)`;
  const fire = (x, y) => { act('contCard', [CGB.aim, Math.floor(x), Math.floor(y)], (r) => { if (!r) toast('It can\'t land there: aim at open ground.', 'warn'); }); CGB.aim = -1; CGB.key = ''; $('cg-aim').hidden = true; };
  $('cg-aim-go').onclick = () => fire(R.cam.x, R.cam.y);
  // the pad over the map: a tap aims there; a drag still moves the map
  const pad = $('cg-aim-pad');
  let down = null;
  pad.onpointerdown = (e) => { down = { x: e.clientX, y: e.clientY, moved: false }; pad.setPointerCapture(e.pointerId); };
  pad.onpointermove = (e) => {
    if (!down) return;
    if (!down.moved && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 8) return;
    const a = screenToWorld(down.x, down.y), b = screenToWorld(e.clientX, e.clientY);
    R.cam.x += a.x - b.x; R.cam.y += a.y - b.y; down = { x: e.clientX, y: e.clientY, moved: true };
  };
  pad.onpointerup = (e) => { const d = down; down = null; if (d && !d.moved) { const w = screenToWorld(e.clientX, e.clientY); fire(w.x, w.y); } };
  $('cg-aim-no').onclick = () => { CGB.aim = -1; $('cg-aim').hidden = true; };
}

/* ------------------------------------------------------------------ Ironman: no reloading a battle */

/** Is the game in S an Ironman run's battle? Then it keeps one save, for Continue: no restore points, slots, files or codes. */
function contIronman(G = typeof S !== 'undefined' ? S : null) { return !!(G && G.contingency && G.contingency.ironman); }
/** Is this save text an Ironman run's battle (a restore point, a slot, a file)? */
function contIronmanSave(text) { return /"contingency":\{[^{}]*"ironman":true/.test(String(text || '')); }
const CONT_IRONMAN_NO = 'Ironman: this Contingency battle keeps one save, to carry on from (Continue, or its battle card). No restore points, slots, files or codes.';

/** The goal card in a Contingency battle (objectiveText): what wins it, in place of the Colony steps and milestones. */
function contObjective() {
  const C = S.contingency, where = `<b>Battle for ${esc(contName(C.at))}</b>`;
  if (C.kind === 'hollow') return `${where}: destroy the Deep's mound.`;
  if (C.hold) return `${where}: hold against the Murmur until the clock runs out${C.kind === 'surge' ? ' (until dawn)' : ', or clear the nests'}.`;
  const up = S.victory === 'uplinks';
  return `${where}: ${up ? 'hold the most Uplinks' : 'capture the rival Command Base'}. At the cap the land held decides it${C.def >= 0 ? `, and a close count goes to ${C.def === ME ? 'you, defending' : 'the defender'}` : ''}.`;
}

/** Torch Doctrine: seat p's Torches do half as much again to the Murmur (torchFire, in js/sim.js). */
function contTorch(p) { const C = S.contingency; return C && C.torch && C.torch.includes(p) ? CONT_TORCH : 1; }
const CONT_TORCH = 1.5;
/** The top bar's clock in a battle against the Murmur alone: the time to dawn, or the Deep's mound standing. */
function contTopLine() {
  const C = S.contingency;
  if (C.kind === 'hollow') { const m = S.buildings.find((x) => !x.dead && x.type === 'mound'); return m ? `The Deep ${Math.ceil((100 * m.armor) / BDEFS.mound.armor)}%` : 'The Deep: down'; }
  const left = Math.max(0, C.hold - S.time), nests = S.buildings.filter((x) => !x.dead && x.type === 'nest').length;
  return `Dawn ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')} · ${nests} nest${nests === 1 ? '' : 's'}`;
}

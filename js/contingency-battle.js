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
        cap: B.minutes * 60, hold: B.hold * 60, harrow: B.harrow ? 0 : -1, look, mega0: B.mega ? CONT_MEGA_TYPE[B.mega] : null };
      B.seat.forEach((X, p) => contKit(S, p, X, B));
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
  for (let n = have; n < X.warbots; n++) enterBuilding(addBot(p, 'warbot', L.x, L.y), L);
  const put = (type, stock) => { const s = aiFindSpot(p, type, L); return s ? preBuild(p, type, s.x, s.y, { road: true, reach: 4, stock }) : null; };
  if (X.refits.includes('outpost')) put('outpost');
  if (X.refits.includes('foundry')) put('foundry');
  if (X.defender) {
    if (B.fort >= 1) { put('turret', { crystal: 20 }); put('turret', { crystal: 20 }); }
    if (B.fort >= 2) put('keep');
    if (B.fort >= 3) { put('mortar', { ammo: 12 }); put('mortar', { ammo: 12 }); }
    if (B.mega && CONT_MEGA_TYPE[B.mega]) put(CONT_MEGA_TYPE[B.mega]);
  }
  computeTerritory();
  P.stats.startBots = P.stats.bots;
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
  // the Harrow comes up six minutes in, at the nest nearest your landing, where the Murmur are at full strength
  if (C.harrow === 0 && S.time >= 360 && typeof spawnHarrow === 'function') {
    C.harrow = 1;
    const L = getE(S.players[0].lander), nests = S.buildings.filter((x) => !x.dead && (x.type === 'nest' || x.type === 'mound'));
    if (L && nests.length) { const n = nests.reduce((a, x) => (dist2(x.x, x.y, L.x, L.y) < dist2(a.x, a.y, L.x, L.y) ? x : a)); spawnHarrow(n.x, n.y, 0); }
  }
  if (C.kind === 'hollow' && S.time > 30 && !S.buildings.some((x) => !x.dead && x.type === 'mound')) { S.winner = 0; S.endHow = 'capture'; return; }
  if (C.hold && S.time >= C.hold) { S.winner = 0; S.endHow = 'hold'; return; }
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

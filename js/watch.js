'use strict';
/*
 * Terrafall — Observer mode: computer colonies play a game out while you watch.
 *
 * Main menu, Observer: a setup card laid out like Custom Game's (Match, Planet, Rules, Challenge), with its controls and
 * texts (segChoice, the map type and biome pickers, MURMUR_INFO, VICTORY, MODS): how many colonies (two, or three or
 * four where the map type has room; Teams, 2 vs 2, with four), the Victory, the computer's level (DIFFICULTY, the same
 * for every colony), each one's doctrine (or Random: one no other colony has), map type and biome (or Random), size,
 * terrain, resources, a saved planet (or a new one each game), the Nuclear race, planetary events, the Murmur and the
 * challenge modifiers (not No turrets, which only binds people). Kept on this device (WATCH_KEY). Then Start observing. It's a normal game in which the
 * computer runs every colony: newGame with no human seat (humans: []), so each gets the rival's head start and its
 * doctrine. ME stays 0 (COBALT, run by the computer like the rest, as in the menu's backdrop game) for what this device
 * shows and hears; nothing is saved (saveGame never saves a game whose COBALT the computer plays, and clearSave is
 * never called), so the player's own save stays as it was. S.watch has the game play on to the last colony standing
 * (eliminate, in sim.js: without a person in it, a game otherwise ends when COBALT falls).
 *
 * In the game: the top bar has the clock, the speed (1×, 2×, 4× or 8×: WATCH_SPEEDS) and the pause menu (Photo mode,
 * Statistics, Back to the menu); the minimap works; the Scout report card names each colony with its doctrine and
 * warbots and says, in a line or two (its title folds them away), what they're doing, read from the computer's own plans (P.stormOn, P.march,
 * P.homeCall, P.raid, P.pushOn, P.massFor: see js/ai.js) and from what happens (a Command Base taken, a nuclear launch).
 * The camera follows the fighting (Follow the action), until the map is moved by hand; F or the button takes it back.
 * Taps on the map select and order nothing (inputSwap), and no key gives an order. The game's own messages are
 * written to a colony's player ("your Command Base"): the scout report speaks instead. At the end a card says who won,
 * with Observe another (the same setup, a new planet) and Main menu.
 */

const WATCH_SPEEDS = [1, 2, 4, 8];
const WATCH_KEY = 'terrafall.watch';
const WATCH_INPUT = { onTap: (i, j, wx, wy) => watchTap(i, j, wx, wy), onPaint: null, onBox: null, onCommand: null, onGrab: null, canBox: () => false, canPaint: () => false };
/** What a colony of each doctrine is about early on, before it has plans to report (the scout report's opening lines). */
const WATCH_OPENING = {
  balanced: 'is building up steadily, an army beside it',
  turtle: 'is digging in behind turrets and walls',
  raider: 'is readying warbots to raid the roads',
  rusher: 'is pouring everything into warbots',
  tycoon: 'is building a big economy first',
};
const WATCH = { setup: null };

/* ------------------------------------------------------------------ the setup screen */

/** The More options button's words (a phone's fold over the Challenge section): open or shut, and how many are on. */
function syncWatchMore() {
  const b = $('w-more'), w = WATCH.setup;
  if (!b || !w) return;
  const n = (w.mods || []).length, open = $('w-sec-challenge').classList.contains('open');
  b.textContent = `${open ? 'Fewer options ▾' : 'More options ▸'}${n ? ` (${n} challenge${n > 1 ? 's' : ''} on)` : ''}`;
}

/** The challenge modifiers on offer here: not No turrets, which only stops people building them (MODS). */
const WATCH_MODS = MOD_ORDER.filter((k) => k !== 'noturret');
/** The computer's level, for every colony (DIFFICULTY; Custom Game's DIFF_INFO speaks of one rival against you). */
const WATCH_DIFF_INFO = {
  easy: 'Easy: every colony plays slow and forgiving, building up and attacking late.',
  medium: 'Medium: between Easy and Normal: later attacks, smaller armies, fewer raids.',
  normal: 'Normal: every colony expands, raids the roads and attacks in force.',
  hard: 'Hard: every colony lands with extra goods and attacks early and often.',
};

/**
 * The last setup, kept on this device (WATCH_KEY): { shape, shapeRnd, n (colonies), teams, docs (four doctrine keys or
 * 'random'), murmur ('off', 'quiet' or 'active'), diff (DIFFICULTY, every colony's), victory (VICTORY), size, rough,
 * rich, biome (BIOME_ORDER index), biomeRnd, nuke, mega (Megastructures), events, mods (WATCH_MODS), seed (a saved planet's, or null: a new
 * planet each game) }. What a setup from an earlier build lacks is as Observer mode always had it: Normal, the usual
 * size, terrain and resources, the Nuclear race on, no planetary events, Capture, a random biome, the Murmur active.
 */
function watchSetup() {
  let w = null;
  try { w = JSON.parse(localStorage.getItem(WATCH_KEY) || 'null'); } catch (e) { w = null; }
  if (!w || typeof w !== 'object') w = {};
  const ok = (k) => k === 'random' || isDoctrine(k), idx = (v, n, d) => (Number.isInteger(v) && v >= 0 && v < n ? v : d);
  const docs = Array.isArray(w.docs) ? w.docs : [];
  const shape = idx(w.shape, SHAPE_PRESETS.length, 0), biome = idx(w.biome, BIOME_ORDER.length, 0);
  return {
    shape, shapeRnd: w.shapeRnd ? 1 : 0, n: Number.isInteger(w.n) ? clamp(w.n, 2, 4) : 2, teams: w.teams ? 1 : 0,
    murmur: murmurLevelOk(w.murmur) ? w.murmur : 'active', // (Active, as in a new game, unless picked otherwise)
    docs: [0, 1, 2, 3].map((p) => (ok(docs[p]) ? docs[p] : ['turtle', 'rusher', 'raider', 'tycoon'][p])),
    diff: Object.prototype.hasOwnProperty.call(DIFFICULTY, w.diff) ? w.diff : 'normal',
    victory: Object.prototype.hasOwnProperty.call(VICTORY, w.victory) ? w.victory : 'capture',
    size: idx(w.size, SIZE_PRESETS.length, DEFAULT_SIZE.versus), rough: idx(w.rough, TERRAIN_PRESETS.length, DEFAULT_ROUGH), rich: idx(w.rich, RESOURCE_PRESETS.length, DEFAULT_RICH),
    biome: biomeAllowed(BIOME_ORDER[biome], w.shapeRnd ? -1 : shape) ? biome : 0, biome2: BIOME_ORDER.includes(w.biome2) ? w.biome2 : null, biomeRnd: w.biomeRnd === undefined || w.biomeRnd ? 1 : 0,
    nuke: w.nuke === undefined || w.nuke ? 1 : 0, mega: w.mega === undefined || w.mega ? 1 : 0, events: w.events ? 1 : 0,
    mods: modList(w.mods).filter((k) => WATCH_MODS.includes(k)),
    seed: Number.isInteger(w.seed) && w.seed >= 0 ? w.seed : null,
  };
}
function watchKeepSetup() { try { localStorage.setItem(WATCH_KEY, JSON.stringify(WATCH.setup)); } catch (e) { /* storage unavailable */ } }

/** How many colonies the setup makes on its map type (as many as it asks for that the map has room for; Random: as asked). */
function watchCount(w, shape) {
  if (shape === undefined && w.shapeRnd) return clamp(w.n, 2, 4);
  return playerCount('versus', shape === undefined ? w.shape : shape, w.n);
}
/** Two against two (Teams, with four colonies)? */
const watchSize = (w, n = watchCount(w)) => mapSizeForPlayers(w.size ?? DEFAULT_SIZE.versus, n);
const watchTeams = (w, n = watchCount(w)) => !!w.teams && n === 4;
/** The map type is the Hollow (no Uplinks there; it has its own look and Murmur). */
const watchHollow = (w) => !w.shapeRnd && !!SHAPE_PRESETS[w.shape].hollow;
/** Can the setup have the Murmur? Not on Argos, nor a map type without room for nests (as menuMurmur). */
const watchMurmurOk = (w) => (w.shapeRnd || murmurShape(w.shape)) && (w.biomeRnd || murmurGround(BIOME_ORDER[w.biome]));
/** The Murmur as the setup has them ('off' where they can't be). */
const watchMurmur = (w) => (watchMurmurOk(w) && murmurLevelOk(w.murmur) ? w.murmur : 'off');
/** How the game is won: Capture with teams, and in the Hollow instead of Uplinks. */
const watchVictory = (w) => (watchTeams(w) || (w.victory === 'uplinks' && watchHollow(w)) ? 'capture' : w.victory);
/** The planet the setup makes, as Custom Game's saved planets keep one (seed: the saved planet's, when one is picked). */
const watchPlanet = (w) => ({ seed: w.seed, shape: w.shape, size: watchSize(w), rough: w.rough, rich: w.rich, biome: w.biome, biome2: chosenSecondBiome(w, watchSize(w)), players: watchCount(w) });
/** A change to the map's settings: it's no longer the saved planet picked (a new planet each game again). */
function watchMapChanged(w) { w.seed = null; }

/** The setup in a line (and what isn't the usual in a second one), beside Start observing. */
function watchSummary(w) {
  const n = watchCount(w), vic = watchVictory(w), main = [watchTeams(w) ? 'Teams · 2 vs 2' : `${n} colonies`, `${DIFFICULTY[w.diff].label}`];
  if (vic !== 'capture') main.push(VICTORY[vic].name);
  const size = watchSize(w, n), otherBiome = chosenSecondBiome(w, size);
  if (otherBiome) main.push(BIOMES[otherBiome].name);
  main.push(w.shapeRnd ? 'Random map' : SHAPE_PRESETS[w.shape].name, w.biomeRnd ? 'Random biome' : biomeName(w.biome), SIZE_PRESETS[size].name + ' size');
  const extra = [];
  if (w.seed !== null) extra.push(`Planet #${w.seed}`);
  if (w.rough !== DEFAULT_ROUGH) extra.push(TERRAIN_PRESETS[w.rough].name + ' terrain');
  if (w.rich !== DEFAULT_RICH) extra.push(RESOURCE_PRESETS[w.rich].name + ' resources');
  if (!w.nuke) extra.push('no Nuclear race');
  if (!w.mega) extra.push('no Megastructures');
  extra.push(watchMurmur(w) === 'off' ? 'no Murmur' : `Murmur: ${MURMUR_NAMES[watchMurmur(w)]}`);
  if (w.events) extra.push('Planetary events');
  if (w.mods.length) extra.push('Challenge: ' + w.mods.map((k) => MODS[k].name).join(', '));
  return { main: main.join(' · '), extra: extra.join(' · ') };
}

/** The map type and biome pickers (openPicker, in js/ui.js), picking for this setup. */
function watchPickCtx() {
  const w = WATCH.setup;
  return { shape: w.shape, shapeRnd: w.shapeRnd, biome: w.biome, biomeRnd: w.biomeRnd, want: watchCount(w), pick: (kind, v) => {
    const rnd = v === 'rnd';
    if (kind === 'shape') { w.shapeRnd = rnd ? 1 : 0; if (!rnd) w.shape = +v; } else { w.biomeRnd = rnd ? 1 : 0; if (!rnd) w.biome = +v; }
    if (kind === 'shape' && !rnd) {
      const SH = SHAPE_PRESETS[w.shape];
      if (SH.teamDefault) { w.teams = 1; w.n = 4; } // (a map made for 2 vs 2: four colonies, Teams on, as in Custom Game)
      if (murmurLevelOk(SH.murmur)) w.murmur = SH.murmur; // (a map type with its own Murmur: the Hollow)
      w.n = clamp(w.n, minPlayers(w.shape), maxPlayers(w.shape));
    }
    if (!biomeAllowed(BIOME_ORDER[w.biome], w.shapeRnd ? -1 : w.shape)) w.biome = 0;
    watchMapChanged(w); watchKeepSetup(); syncWatch();
  } };
}

/** Build the setup screen's controls (once): the choices that come from the game's own lists. */
function buildWatch() {
  const w = () => WATCH.setup, set = (fn) => () => { fn(); watchKeepSetup(); syncWatch(); sfx('click'); };
  segChoice($('w-size'), SIZE_PRESETS.map((p) => p.name), () => watchSize(w()), (v) => set(() => { w().size = v; watchMapChanged(w()); })());
  segChoice($('w-rough'), TERRAIN_PRESETS.map((p) => p.name), () => w().rough, (v) => set(() => { w().rough = v; watchMapChanged(w()); })(), terrainInfo, true);
  segChoice($('w-rich'), RESOURCE_PRESETS.map((p) => p.name), () => w().rich, (v) => set(() => { w().rich = v; watchMapChanged(w()); })(), resourceInfo, true);
  for (const b of $('w-diff').children) { b.dataset.info = WATCH_DIFF_INFO[b.dataset.v]; b.onclick = set(() => { w().diff = b.dataset.v; }); }
  for (const b of $('w-victory').children) { b.dataset.info = VICTORY[b.dataset.v].info.replace('a rival\'s', 'another colony\'s'); b.onclick = set(() => { w().victory = b.dataset.v; }); }
  for (const b of $('w-teams').children) {
    b.dataset.info = +b.dataset.v ? '2 vs 2: two colonies against the two others, side by side. A team wins once both of the other team\'s Command Bases are taken (Capture).' : 'Free-for-all: every colony for itself; the last one standing wins.';
    b.onclick = set(() => { w().teams = +b.dataset.v; });
  }
  for (const b of $('w-n').children) b.onclick = set(() => { w().n = +b.dataset.v; });
  for (const b of $('w-murmur').children) b.onclick = () => {
    if (!watchMurmurOk(w())) { WATCH.hover['w-sec-rules'] = $('w-murmur-row'); syncWatchInfo(); sfx('error'); return; }
    w().murmur = b.dataset.v; WATCH.hover['w-sec-rules'] = b; watchKeepSetup(); syncWatch(); sfx('click');
  };
  for (const k of ['nuke', 'mega', 'events']) $('w-' + k).onchange = set(() => { w()[k] = $('w-' + k).checked ? 1 : 0; });
  $('w-mods').innerHTML = WATCH_MODS.map((k) => `<label class="tchip" id="w-mod-${k}-row" data-info="${esc(MODS[k].desc)}"><input type="checkbox" id="w-mod-${k}" role="switch"><span>${MODS[k].name}</span></label>`).join('');
  for (const k of WATCH_MODS) $('w-mod-' + k).onchange = set(() => { const l = w().mods.filter((x) => x !== k); w().mods = modList($('w-mod-' + k).checked ? l.concat(k) : l); });
  $('w-shape').onclick = () => { sfx('click'); openPicker('shape', watchPickCtx()); };
  $('w-biome').onclick = () => { sfx('click'); openPicker('biome', watchPickCtx()); };
  $('w-biome2').onchange = set(() => { w().biome2 = $('w-biome2').value || null; });
  // A saved planet (Custom Game's Save): its seed and map settings, played each time; or a new planet each game.
  $('w-planet').onchange = set(() => {
    const p = savedPlanets()[+$('w-planet').value], s = w();
    if (!p || $('w-planet').value === '') { s.seed = null; return; }
    Object.assign(s, { seed: p.seed, shape: p.shape, size: p.size, rough: p.rough, rich: p.rich, biome: p.biome || 0, biome2: p.biome2 || null, n: p.players || 2, shapeRnd: 0, biomeRnd: 0 });
  });
  WATCH.hover = {};
  // On a phone the Challenge section folds away under More options (it says how many are on).
  $('w-more').onclick = () => { const s = $('w-sec-challenge'), open = !s.classList.contains('open'); s.classList.toggle('open', open); $('w-more').setAttribute('aria-expanded', open ? 'true' : 'false'); syncWatchMore(); sfx('click'); };
  for (const sec of ['w-sec-match', 'w-sec-planet', 'w-sec-rules', 'w-sec-challenge']) hoverInfo($(sec), (k) => { WATCH.hover[sec] = k; syncWatchInfo(); });
}

function openWatch() {
  WATCH.setup = WATCH.setup || watchSetup();
  if (!WATCH.built) { buildWatch(); WATCH.built = true; }
  WATCH.note = null;
  WATCH.hover = {};
  $('screen-watch').hidden = false; // (shown first: the rows' thumbnails are drawn at their size)
  syncWatch();
  $('w-body').scrollTop = 0;
  try { history.pushState({ watchSetup: 1 }, ''); } catch (e) { /* no history to add to (a sandboxed frame) */ }
}

function closeWatch(fromBack) {
  if ($('screen-watch').hidden) return;
  closePicker(false);
  $('screen-watch').hidden = true;
  if (!fromBack) try { if (history.state && history.state.watchSetup) history.back(); } catch (e) { /* as above */ }
}

/** The setup screen up to date with WATCH.setup. */
function syncWatch() {
  syncWatchMore();
  const w = WATCH.setup, n = watchCount(w), teams = watchTeams(w);
  if (typeof ensureBiomeArt === 'function' && !w.biomeRnd) ensureBiomeArt(BIOME_ORDER[w.biome]); // (the chosen biome's swatch)
  const mark = (b, on) => { b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); };
  // Match: colonies (as many as the map type has room for), Teams with four, Victory (Capture with teams), the computer's level.
  for (const b of $('w-n').children) {
    const v = +b.dataset.v;
    b.disabled = !w.shapeRnd && (v < minPlayers(w.shape) || v > maxPlayers(w.shape));
    b.dataset.info = b.disabled ? `${SHAPE_PRESETS[w.shape].name} has room for ${minPlayers(w.shape) === maxPlayers(w.shape) ? maxPlayers(w.shape) : `${minPlayers(w.shape)} to ${maxPlayers(w.shape)}`} colonies.`
      : v === 2 ? 'Two colonies, landing at either end of the planet.' : `${v} colonies${w.shapeRnd ? ' (Random picks a map type with room for them)' : ''}, a free-for-all unless Teams says otherwise.`;
    mark(b, v === n);
  }
  $('w-teams-row').hidden = n !== 4;
  for (const b of $('w-teams').children) mark(b, +b.dataset.v === (teams ? 1 : 0));
  const vic = watchVictory(w), noUplinks = watchHollow(w);
  $('w-victory-row').hidden = teams;
  for (const b of $('w-victory').children) {
    mark(b, b.dataset.v === vic);
    b.disabled = noUplinks && b.dataset.v === 'uplinks';
    b.title = b.disabled ? 'No Uplinks in the Hollow: the Pathfinder never mapped it.' : '';
  }
  for (const b of $('w-diff').children) mark(b, b.dataset.v === w.diff);
  // Each colony's doctrine.
  const names = [['random', 'Random'], ...PERSONALITY_ORDER.map((k) => [k, PERSONALITIES[k].name])];
  $('w-seats').innerHTML = Array.from({ length: n }, (_, p) => `<label class="m-seat" title="${callsign(p, true)}"><i class="dot" style="background:${PLAYER_COLORS[p]}"></i>` +
    `<select data-p="${p}" aria-label="${callsign(p, true)}'s doctrine">${names.map(([k, name]) => `<option value="${k}"${w.docs[p] === k ? ' selected' : ''}>${name}</option>`).join('')}</select></label>`).join('');
  for (const s of $('w-seats').querySelectorAll('select')) s.onchange = () => { w.docs[+s.dataset.p] = s.value; WATCH.note = +s.dataset.p; watchKeepSetup(); syncWatch(); sfx('click'); };
  // The line under them: the doctrine just picked (or the first colony's), in a sentence.
  const p = WATCH.note != null && WATCH.note < n ? WATCH.note : 0, k = w.docs[p];
  $('w-note').innerHTML = `<i class="dot" style="background:${PLAYER_COLORS[p]}"></i> ` + (k === 'random' ? `<b>Random:</b> ${DOCTRINE_RANDOM_TAG}, picked when the game starts.`
    : `<b>${docLabel(k)}:</b> “${PERSONALITIES[k].quote}” ${PERSONALITIES[k].tag.replace(/^./, (c) => c.toUpperCase())}.`);
  // Planet: map type and biome (the pickers' rows), size, terrain, resources, and a saved planet.
  watchPickRows();
  for (const id of ['w-size', 'w-rough', 'w-rich']) markSeg($(id));
  const dShape = w.shapeRnd ? 0 : w.shape, dims = mapDims({ size: watchSize(w, n), shape: dShape, players: n });
  syncSizeChoices($('w-size'), dShape, n, w.shapeRnd);
  $('w-size-v').textContent = `${w.shapeRnd ? '~' : ''}${dims.W}×${dims.H}`;
  $('w-rough-v').textContent = TERRAIN_PRESETS[w.rough].name;
  $('w-rich-v').textContent = RESOURCE_PRESETS[w.rich].name;
  const saved = savedPlanets(), cur = w.seed === null || w.shapeRnd || w.biomeRnd ? -1 : saved.findIndex((q) => planetKey(q) === planetKey(watchPlanet(w)));
  if (w.seed !== null && cur < 0) w.seed = null; // (the saved planet is gone, or the settings moved off it)
  $('w-planet-row').hidden = !saved.length;
  $('w-planet').innerHTML = '<option value="">A new planet each game</option>' + saved.map((q, i) => `<option value="${i}">${planetLabel(q).replace(/<[^>]+>/g, '')}</option>`).join('');
  $('w-planet').value = cur >= 0 ? String(cur) : '';
  // Rules: the Nuclear race, planetary events and the Murmur (none on Argos, or where the map has no room for nests).
  for (const k of ['nuke', 'mega', 'events']) { $('w-' + k).checked = !!w[k]; $('w-' + k + '-row').classList.toggle('on', !!w[k]); }
  const silent = !watchMurmurOk(w), mur = watchMurmur(w);
  $('w-murmur-row').classList.toggle('na', silent);
  $('w-murmur-row').dataset.info = silent ? (!w.shapeRnd && !murmurShape(w.shape) ? `The Murmur: none on ${SHAPE_PRESETS[w.shape].name} (its land has no room for their nests: no tunnels, no raids).` : 'The Murmur: none on Argos, the moon (no nests, no tunnels, no raids).') : MURMUR_INFO[mur];
  for (const b of $('w-murmur').children) { mark(b, b.dataset.v === mur); b.dataset.info = silent ? $('w-murmur-row').dataset.info : MURMUR_INFO[b.dataset.v]; }
  // Challenge.
  for (const k of WATCH_MODS) { const on = w.mods.includes(k); $('w-mod-' + k).checked = on; $('w-mod-' + k + '-row').classList.toggle('on', on); }
  const sum = watchSummary(w);
  $('w-sum').innerHTML = `<span class="sum-main">${sum.main}</span>` + (sum.extra ? `<span class="sum-extra">${sum.extra}</span>` : '');
  syncWatchInfo();
}

/** The Map type and Biome rows (their thumbnails drawn once the card shows, and again as art arrives: menuArtTick). */
function watchPickRows() {
  const w = WATCH.setup;
  shapePickRow($('w-shape'), w.shapeRnd, w.shape, watchCount(w), 'when the game starts');
  biomePickRow($('w-biome'), w.biomeRnd, w.biome, watchHollow(w), 'when the game starts');
  syncSecondBiome('w', w, watchSize(w));
}

/** Each section's line: the option under the mouse or focused, or else what's chosen (as Custom Game's syncInfo). */
function syncWatchInfo() {
  const w = WATCH.setup, H = WATCH.hover || {};
  const line = (sec, def) => { const el = H[sec]; return (el && el.isConnected && !el.closest('[hidden]') && el.dataset.info) || def; };
  const vic = watchVictory(w);
  $('w-match-info').textContent = line('w-sec-match', watchTeams(w) ? $('w-teams').children[1].dataset.info
    : (vic === 'capture' ? 'Capture: take another colony\'s Command Base and all it built is theirs; the last colony standing wins.' : VICTORY[vic].info) + (w.victory === 'uplinks' && watchHollow(w) ? ' (No Uplinks in the Hollow: Capture.)' : ''));
  $('w-planet-info').textContent = line('w-sec-planet', w.seed !== null ? `Planet #${w.seed}, saved from a game of yours: every game here lands on it.` : $('w-shape').dataset.info);
  $('w-rules-info').textContent = line('w-sec-rules', $('w-murmur-row').dataset.info);
  const names = w.mods.map((k) => MODS[k].name);
  $('w-challenge-info').textContent = line('w-sec-challenge', w.mods.length === 1 ? MODS[w.mods[0]].desc
    : w.mods.length ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}, for every colony.` : 'Challenge modifiers change the game for every colony: mix them as you like.');
}

/* ------------------------------------------------------------------ starting and leaving */

/** A biome at random for a game to observe: with the Murmur on, one they live on (not Argos, the silent moon). */
/** Start a game to observe (from the setup screen, or Observe another at the end of one). */
function watchStart(setup) {
  const again = UI.watch;
  if (UI.photo) photoExit();
  // (The setup screen's history entry becomes the game's, which Back steps through as in any game: see armBack.)
  if (!$('screen-watch').hidden) {
    $('screen-watch').hidden = true;
    try { if (history.state && history.state.watchSetup) history.replaceState({ terrafall: 1 }, ''); } catch (e) { /* no history (a sandboxed frame) */ }
  }
  closePicker(false);
  $('screen-over').hidden = true;
  // Random map type and biome: picked now (a map type with room for the colonies asked for).
  const shape = setup.shapeRnd ? randomShape(clamp(setup.n, 2, 4)) : setup.shape;
  const n = watchCount(setup, shape);
  // Random: a doctrine no other colony has (they may repeat only once all five are taken).
  const docs = setup.docs.slice(0, n).map((k) => (isDoctrine(k) ? k : null));
  const pool = PERSONALITY_ORDER.filter((k) => !docs.includes(k));
  for (let p = 0; p < n; p++) {
    if (docs[p]) continue;
    if (!pool.length) pool.push(...PERSONALITY_ORDER);
    docs[p] = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
  }
  // (Nobody's colony is in it, humans: [], so every colony is the computer's, with the level's head start and pace.)
  newGame({
    seed: setup.seed ?? randomSeed(), difficulty: DIFFICULTY[setup.diff] ? setup.diff : 'normal', mode: 'versus', size: watchSize(setup, n),
    rough: setup.rough ?? DEFAULT_ROUGH, rich: setup.rich ?? DEFAULT_RICH, shape, players: n, humans: [], styles: docs, style: 'balanced',
    nuke: setup.nuke !== 0, mega: setup.mega !== 0, events: !!setup.events, victory: setup.victory || 'capture', teams: watchTeams(setup, n), mods: (setup.mods || []).filter((k) => WATCH_MODS.includes(k)),
    murmur: murmurLevelOk(setup.murmur) ? setup.murmur : 'active', // (the setup screen's The Murmur)
    scars: scarsPref(), // (War scars: the Settings menu's)
    biome2: chosenSecondBiome(setup, watchSize(setup, n)),
    biome: setup.biomeRnd === 0 ? BIOME_ORDER[setup.biome] : randomBiomeFor(shape, !!setup.murmur && setup.murmur !== 'off'),
  });
  // (newGame gives the first colony the plain Steward when nobody plays it: it gets its doctrine here, before the
  // game's first step, as newGame would have given it; and the game plays on to the last colony standing.)
  const P0 = S.players[0];
  P0.style = docs[0];
  if (PERSONALITIES[docs[0]].econ) P0.mult *= PERSONALITIES[docs[0]].econ;
  S.watch = true;
  ME = 0;
  enterGame(true);
  UI.watch = { setup, follow: true, cam: null, spot: null, spotT: 0, tour: 0, tourT: 0, reportAt: 0, out: {}, seen: new WeakSet(), events: [], night: null, nests: null, input: again ? again.input : inputSwap(WATCH_INPUT) };
  R.clean = 1;
  document.body.classList.add('watching');
  setSpeed(2, true);
  R.cam.z = clamp(Math.min(R.w, R.h) / 20, minZoom(), maxZoom());
  centerOn(S.W / 2, S.H / 2);
  watchFollow(true);
  $('watch-card').hidden = false;
  updateHUD();
  placeMinimap();
  watchReport();
}

/** Leave Observer mode (toMenu calls it, on the way back to the main menu). */
function watchEnd() {
  const w = UI.watch;
  if (!w) return;
  UI.watch = null;
  Object.assign(INPUT, w.input);
  R.clean = 0;
  document.body.classList.remove('watching');
  $('watch-card').hidden = true;
  setSpeed(1, true);
}

/** The end of a game being watched (showGameOver sends it here): who won, how, and when each colony fell. */
function watchOver() {
  const w = UI.watch, win = S.winner, how = S.endHow || 'capture';
  UI.overNew = () => watchStart(w.setup);
  UI.overMenu = null;
  $('o-code').hidden = true; $('o-keep').hidden = true; $('o-log').hidden = true;
  $('o-new').textContent = 'Observe another'; $('o-menu').textContent = 'Main menu';
  // (Teams: the winner and its ally, who won together, the ally even if its own base fell on the way.)
  const side = S.players.filter((P) => !P.absent && (P.id === win || allies(P.id, win))).map((P) => P.id);
  const who = side.length > 1 ? `${watchThe(side[0], true)} and ${watchThe(side[1])}` : watchThe(win, true);
  $('o-title').textContent = `${who} win${side.length > 1 ? '' : 's'}`;
  $('o-text').textContent = side.length > 1
    ? `Their team took the planet after ${fmtTime(S.time)}: ` + (how === 'surrender' ? 'the last colony against them surrendered.' : how === 'nuke' ? 'a nuclear missile destroyed the last Command Base against them.' : 'both Command Bases against them are theirs.')
    : `${callsign(win)}, the ${(RIVAL_NAMES[win] || '').toLowerCase()} ${watchDoc(win)}, took the planet after ${fmtTime(S.time)}: ` + (how === 'surrender' ? 'the last colony against it surrendered.'
      : how === 'nuke' ? 'its nuclear missile destroyed the last Command Base against it.'
        : how === 'domination' ? `it held most of the planet's land for ${DOM.hold / 60} minutes straight (Domination).`
          : how === 'uplinks' ? `it led on the Uplinks for ${UPLINK.hold / 60} minutes in all.` : 'the last Command Base against it is its own.');
  $('o-stats').innerHTML = [['Time', fmtTime(S.time)]].concat(S.players.filter((P) => !P.absent).map((P) => [
    `<i class="dot" style="background:${PLAYER_COLORS[P.id]}"></i> ${watchDoc(P.id)}`,
    side.includes(P.id) ? (w.out[P.id] !== undefined ? `Won (fell at ${fmtTime(w.out[P.id])})` : 'Won') : w.out[P.id] !== undefined ? `Fell at ${fmtTime(w.out[P.id])}` : how === 'domination' || how === 'uplinks' ? 'Standing' : 'Fell',
  ])).map(([k, v]) => `<span>${k}</span><span>${v}</span>`).join('');
  $('screen-over').hidden = false;
}

/* ------------------------------------------------------------------ the scout report */

/** Player p's doctrine's name ("Warden"). */
function watchDoc(p) { const P = S.players[p]; return PERSONALITIES[P && isDoctrine(P.style) ? P.style : 'balanced'].name; }
/** Player p as the report names it: "the Warden", or "the blue Warden" when another colony has the same doctrine. */
function watchThe(p, cap) {
  const P = S.players[p];
  if (!P) return cap ? 'A colony' : 'a colony';
  const twin = S.players.some((Q) => Q !== P && !Q.absent && Q.style === P.style);
  const s = `the ${twin ? (RIVAL_NAMES[p] || '').toLowerCase() + ' ' : ''}${watchDoc(p)}`;
  return cap ? s[0].toUpperCase() + s.slice(1) : s;
}
const watchThes = (p, cap) => watchThe(p, cap) + '’s';

/** Where a tile lies from player p's Command Base, as a compass point ('north-east'), or '' if right beside it. */
function watchDir(p, x, y) {
  const L = S.players[p] && getE(S.players[p].lander), cx = L ? L.x : S.W / 2, cy = L ? L.y : S.H / 2;
  const dx = x - cx, dy = y - cy;
  if (dx * dx + dy * dy < 25) return '';
  const ns = dy < -Math.abs(dx) * 0.4 ? 'north' : dy > Math.abs(dx) * 0.4 ? 'south' : '';
  const ew = dx > Math.abs(dy) * 0.4 ? 'east' : dx < -Math.abs(dy) * 0.4 ? 'west' : '';
  return ns && ew ? ns + '-' + ew : ns || ew;
}

/** Whose land (or road) a tile is, or -1. */
function watchOwner(x, y) {
  const i = Math.floor(x), j = Math.floor(y);
  if (!inMap(i, j)) return -1;
  const t = tIdx(i, j), o = S.road[t] ? wayOwner(t) : -1;
  return o >= 0 ? o : S.owner[t];
}

/** The middle of a rally flag's band (or the flag, if none of it is out yet). */
function watchBand(r) {
  const band = rallyMembers(r.id).filter((u) => !u.inside);
  if (!band.length) return { x: r.x, y: r.y, n: 0 };
  let x = 0, y = 0;
  for (const u of band) { x += u.x; y += u.y; }
  return { x: x / band.length, y: y / band.length, n: band.length };
}

/**
 * Everything colony P is up to, the most important first, read from the computer's own plans (P.stormOn, P.march and
 * P.siegeAt, P.homeCall, its Missiles and bombers, P.raid, P.pushOn, P.massFor: see js/ai.js) and what it has (`army`:
 * its warbots). Shared by the report here (watchDoing: the first) and the scouts of your own games (js/scout.js), which
 * each put it in their own words. Each is { kind, s (how much it matters), x, y (where its band is, when one is out) }
 * and, by kind:
 *   storm   storming foe's Command Base (flag id): n warbots in the band, go once it goes in (else it's forming up)
 *   march   n warbots on the march (flag id), against building b (when it has picked one)
 *   home    under attack at home: its warbots kept back to hold its base
 *   fire    Missiles in the air (shots) or bombers out (bombs), the last at colony foe's land
 *   raid    a band of n out to raid the road at (tx, ty) (flag id), foe's (or -1); forming: still slipping out to it
 *   push    a Warden's big push (till `until`): every warbot it can spare
 *   mass    massing for a push, on building b when it has one: army of the need it waits for
 *   opening its first minutes; build: building up (built buildings, workers); only when it's up to nothing else
 */
function rivalPlans(P, army) {
  const p = P.id, out = [];
  const target = (at) => { const b = at && inMap(at.x, at.y) ? getE(S.bAt[tIdx(at.x, at.y)]) : null; return b && !b.dead && b.owner >= 0 && b.owner !== p ? b : null; };
  if (P.stormOn) {
    const r = rallyById(P.stormOn.id), at = r ? watchBand(r) : null;
    out.push({ kind: 'storm', s: 100, id: P.stormOn.id, foe: P.stormOn.foe, go: !!P.stormOn.go, n: at ? at.n : 0, x: at && at.x, y: at && at.y });
  }
  const march = P.march && rallyById(P.march);
  if (march && !(P.stormOn && P.stormOn.id === P.march)) {
    const at = watchBand(march);
    out.push({ kind: 'march', s: 80, id: P.march, n: at.n, b: target(P.siegeAt), x: at.x, y: at.y });
  }
  if (P.homeCall > S.time) out.push({ kind: 'home', s: 72 });
  let shots = 0, bombs = 0, foe = -1;
  for (const m of S.missiles) {
    if (m.owner !== p || m.nuke || m.shell || m.rocket) continue;
    if (m.bomb) bombs++; else shots++;
    foe = watchOwner(m.x1, m.y1);
  }
  if (shots || bombs) out.push({ kind: 'fire', s: 66, shots, bombs, foe });
  const raid = P.raid && rallyById(P.raid.id);
  if (raid) {
    const forming = P.raid.to !== undefined, tx = forming ? (P.raid.to % S.W) + 0.5 : raid.x, ty = forming ? ((P.raid.to / S.W) | 0) + 0.5 : raid.y;
    const f = watchOwner(tx, ty), at = watchBand(raid);
    out.push({ kind: 'raid', s: 60, id: P.raid.id, forming, foe: f >= 0 && f !== p ? f : -1, tx, ty, n: at.n, x: at.x, y: at.y });
  }
  if (P.pushOn > S.time) out.push({ kind: 'push', s: 56, until: P.pushOn });
  if (P.massFor && S.time <= P.massFor.until) out.push({ kind: 'mass', s: 50, b: target(P.siegeAt), army: Math.min(army, P.massFor.need), need: P.massFor.need });
  if (out.length) return out;
  if (S.time < 150) return [{ kind: 'opening', s: 10 }];
  let built = 0, workers = 0;
  for (const b of S.buildings) if (!b.dead && b.owner === p && b.built) built++;
  for (const u of S.bots) if (!u.dead && u.owner === p && u.type === 'worker') workers++;
  return [{ kind: 'build', s: 10, built, workers }];
}

/** What colony P is doing, as the report says it: { s (how much it matters), t (the line), x, y (where) }. */
function watchDoing(P, army) {
  const p = P.id, The = watchThe(p, true), Thes = watchThes(p, true), d = rivalPlans(P, army)[0];
  const t = (() => {
    switch (d.kind) {
      case 'storm': return d.go ? `${The} is storming ${watchThes(d.foe)} Command Base!` : `${The} is forming up to storm ${watchThes(d.foe)} Command Base.`;
      case 'march': return `${The} has ${d.n || 'its'} warbots on the march` + (d.b ? ` against ${watchThes(d.b.owner)} ${BDEFS[d.b.type].name}.` : '.');
      case 'home': return `${The} is under attack at home, and keeps its warbots back to hold its base.`;
      case 'fire': return `${The} ${d.shots ? 'is firing Missiles' : 'has bombers out'}${d.foe >= 0 && d.foe !== p ? ` at ${watchThe(d.foe)}` : ''}.`;
      case 'raid': {
        const dir = d.foe >= 0 ? watchDir(d.foe, d.tx, d.ty) : '', road = d.foe >= 0 ? `${watchThes(d.foe)} ${dir ? dir + ' road' : 'roads by its base'}` : 'the roads';
        return d.forming ? `${Thes} band is slipping out to raid ${road}.` : `${Thes} band is raiding ${road}.`;
      }
      case 'push': return `${The} is on its big push: every warbot it can spare will go.`;
      case 'mass': return `${The} is massing for a push${d.b ? ` on ${watchThes(d.b.owner)} ${BDEFS[d.b.type].name}` : ''} (${d.army} of ${d.need} warbots).`;
      case 'opening': return `${The} ${WATCH_OPENING[P.style] || WATCH_OPENING.balanced}.`;
      default: return `${The} is building up: ${d.built} buildings and ${d.workers} workers.`;
    }
  })();
  return { s: d.s, t, x: d.x, y: d.y };
}

/** Something that has just happened (a Command Base taken, a nuclear launch): first in the report for a while. */
function watchEvent(w, t, x, y) {
  w.events.push({ t, at: performance.now(), x, y });
  if (w.events.length > 4) w.events.shift();
  w.reportAt = 0;
  if (x !== undefined && w.follow) { w.spot = { x, y, v: 50 }; w.spotT = 4; }
}

/**
 * A tap on the map while observing: the building or robot there opens its panel, to look at only (style.css hides
 * every button and control in a panel while watching, and no key gives an order). Tapping the same spot again steps
 * to the next thing there, as in a game. The camera stops following the fighting, so what you tapped stays in view
 * (Follow, or F, takes it back).
 */
function watchTap(i, j, wx, wy) {
  if (!UI.inGame || UI.paused || !UI.watch) return;
  const stack = tapStack(null, buildingAtTap(i, j, wx, wy), wx, wy);
  if (!stack.length) { UI.lastTap = null; closeSheet(); return; }
  const L = UI.lastTap;
  let k = 0;
  if (L && Math.hypot(L.wx - wx, L.wy - wy) < 0.7) {
    const cur = stack.findIndex((s) => UI.sheetKind === s.kind && UI.sheetFor === s.e.id);
    if (cur >= 0) k = (cur + 1) % stack.length;
  }
  UI.lastTap = { wx, wy };
  const s = stack[k];
  sfx('click');
  if (UI.watch.follow) watchFollow(false);
  if (s.kind === 'bld') openBuildingSheet(s.e); else if (s.kind !== 'rally') openBotSheet(s.e);
}

/** Every frame: what has happened since the last one. */
function watchEvents(w) {
  for (const P of S.players) {
    if (P.absent || !P.out || w.out[P.id] !== undefined) continue;
    w.out[P.id] = S.time;
    const L = getE(P.lander), by = L && !L.dead ? L.owner : -1;
    if (P.giveUp >= SURRENDER.hold && by >= 0) watchEvent(w, `${watchThe(P.id, true)} has surrendered to ${watchThe(by)}, and all it built is theirs now.`, L.x, L.y);
    else if (by >= 0) watchEvent(w, `${watchThe(by, true)} has taken ${watchThes(P.id)} Command Base! ${watchThe(P.id, true)} is out.`, L.x, L.y);
    else watchEvent(w, `${watchThes(P.id, true)} Command Base is gone: ${watchThe(P.id)} is out.`);
  }
  // The Murmur (with them on): nightfall and dawn, and a nest wrecked, and by whom.
  if (S.wildlife) {
    const night = murmurNight(S.time);
    if (w.night !== null && night !== w.night) watchEvent(w, night ? (alwaysNightMap() ? 'A surge: the Murmur are coming up out of the deep.' : 'Night falls, and the Murmur are coming up out of their nests.') : (alwaysNightMap() ? 'The surge ebbs: the Murmur go back down.' : 'Dawn: the Murmur go back down.'));
    w.night = night;
    // (A nest gone since the last frame: whoever has the most warbots round it wrecked it. The Deep's mound too.)
    const live = new Map();
    for (const b of S.buildings) if (!b.dead && BDEFS[b.type].wild && !BDEFS[b.type].burrow) live.set(b.id, { x: b.x + 0.5, y: b.y + 0.5, mound: b.type === 'mound' });
    if (w.nests) for (const [id, n] of w.nests) {
      if (live.has(id)) continue;
      const near = {};
      for (const u of S.bots) if (!u.dead && u.owner >= 0 && isArmy(u) && dist2(u.x, u.y, n.x, n.y) < 49) near[u.owner] = (near[u.owner] || 0) + 1;
      const by = Object.keys(near).sort((a, c) => near[c] - near[a])[0];
      const what = n.mound ? 'the Deep\'s mound' : 'a Murmur nest';
      watchEvent(w, by !== undefined ? `${watchThe(+by, true)} has wrecked ${what}.` : `${what.charAt(0).toUpperCase() + what.slice(1)} has been wrecked.`, n.x, n.y);
    }
    w.nests = live;
  }
  // Domination and the Uplinks (the Victory picked): who leads, and whose clock runs. (The game's own word goes to a
  // colony's player, and is dropped here.)
  const lead = S.victory === 'domination' ? (S.dom ? S.dom.lead : -1) : S.victory === 'uplinks' ? S.upLead ?? -1 : -1;
  if (S.victory === 'uplinks' && S.upOnline && !w.upOnline) { w.upOnline = true; watchEvent(w, `The Uplinks are online: the colony holding most of them runs its clock, and ${UPLINK.hold / 60} minutes in all wins.`); }
  if (w.lead !== undefined && lead !== w.lead) {
    if (lead >= 0) watchEvent(w, S.victory === 'domination' ? `${watchThe(lead, true)} holds most of the land: ${DOM.hold / 60} minutes of it wins by Domination.` : `${watchThe(lead, true)} leads on the Uplinks, and its clock is running.`);
    else if (w.lead >= 0 && S.players[w.lead] && !S.players[w.lead].out) watchEvent(w, S.victory === 'domination' ? `${watchThe(w.lead, true)} no longer holds most of the land.` : `${watchThe(w.lead, true)} no longer leads on the Uplinks.`);
  }
  w.lead = lead;
  for (const m of S.missiles) {
    if (!m.nuke || w.seen.has(m)) continue;
    w.seen.add(m);
    const f = watchOwner(m.x1, m.y1);
    watchEvent(w, `${watchThe(m.owner, true)} has launched a nuclear missile${f >= 0 && f !== m.owner ? ` at ${watchThe(f)}` : ''}!`, m.x1, m.y1);
  }
}

/** The scout report card: each colony (its doctrine and warbots, or out) and a line or two on what's going on. */
function watchReport() {
  const w = UI.watch, now = performance.now(), live = S.players.filter((P) => !P.absent);
  const army = {};
  for (const P of live) army[P.id] = 0;
  for (const u of S.bots) if (!u.dead && army[u.owner] !== undefined && isArmy(u)) army[u.owner]++;
  const sides = live.map((P) => `<span class="wc-side${P.out ? ' out' : ''}" title="${callsign(P.id, true)}: ${docLabel(P.style)}${P.out ? ', out of the game' : `, ${army[P.id]} warbots`}">` +
    `<i class="dot" style="background:${PLAYER_COLORS[P.id]}"></i>${watchDoc(P.id)}${P.out ? '' : ` <b>${army[P.id]}</b>`}</span>`).join('');
  if ($('wc-sides').innerHTML !== sides) $('wc-sides').innerHTML = sides;
  // News first (for 15 s), then what the colonies are doing, the busiest first (taking turns among the quiet ones).
  w.events = w.events.filter((e) => now - e.at < 15000);
  const lines = w.events.slice(-2).reverse().map((e) => ({ t: e.t, news: true }));
  const turn = Math.floor(now / 7000), doing = live.filter((P) => !P.out).map((P) => ({ ...watchDoing(P, army[P.id]), p: P.id }));
  doing.sort((a, b) => b.s - a.s || ((a.p + turn) % live.length) - ((b.p + turn) % live.length));
  for (const d of doing) { if (lines.length >= 2) break; lines.push(d); }
  const html = lines.map((l) => `<li${l.news ? ' class="news"' : ''}>${l.p !== undefined ? `<i class="dot" style="background:${PLAYER_COLORS[l.p]}"></i>` : ''}${esc(l.t)}</li>`).join('');
  if ($('wc-lines').innerHTML !== html) $('wc-lines').innerHTML = html;
}

/* ------------------------------------------------------------------ the camera */

/** Follow the action, or leave the camera to the player. */
function watchFollow(on, say) {
  const w = UI.watch;
  if (!w) return;
  w.follow = on;
  w.cam = null; w.spotT = 0;
  const b = $('wc-follow');
  b.setAttribute('aria-pressed', on ? 'true' : 'false');
  b.innerHTML = on ? '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="12" cy="12" r="2.6" fill="currentColor"/></svg>Following<span class="wide"> the action</span>'
    : '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>Follow<span class="wide"> the action</span>';
  if (say) toast(on ? 'The camera follows the action.' : 'Free camera: F (or Follow the action) follows the action again.', 'info');
}

/**
 * Where the action is: the busiest spot of fighting (warbots in a fight, buildings just hit, shells and missiles
 * landing; a spot being watched stays while it's still half as busy as the busiest), else the biggest band on the
 * move, else each colony's Command Base in turn.
 */
function watchSpot(w, dt) {
  const cells = new Map(), C = 10;
  const add = (x, y, v) => {
    const k = Math.floor(y / C) * 4096 + Math.floor(x / C), e = cells.get(k) || { v: 0, x: 0, y: 0 };
    e.v += v; e.x += x * v; e.y += y * v; cells.set(k, e);
  };
  for (const u of S.bots) if (!u.dead && !u.inside && u.fight && u.owner >= 0) add(u.x, u.y, 1);
  for (const b of S.buildings) if (!b.dead && b.owner >= 0 && S.time - (b.lastHit ?? -99) < 3) add(b.x + 0.5, b.y + 0.5, 2);
  for (const m of S.missiles) add(m.x1, m.y1, m.nuke ? 30 : 1.5);
  let best = null;
  for (const e of cells.values()) if (!best || e.v > best.v) best = e;
  const cur = w.spot && w.spot.v ? cells.get(Math.floor(w.spot.y / C) * 4096 + Math.floor(w.spot.x / C)) : null;
  const pick = cur && best && cur.v >= best.v * 0.5 ? cur : best;
  if (pick && pick.v >= 3) return { x: pick.x / pick.v, y: pick.y / pick.v, v: pick.v };
  // No fighting: the biggest band on the move (a march, a storm, a raid).
  let band = null;
  for (const P of S.players) {
    if (P.absent || P.out) continue;
    for (const id of [P.stormOn && P.stormOn.id, P.march, P.raid && P.raid.id]) {
      const r = id && rallyById(id), at = r && watchBand(r);
      if (at && at.n > 1 && (!band || at.n > band.n)) band = at;
    }
  }
  if (band) return { x: band.x, y: band.y, v: 0 };
  // Quiet: each colony's Command Base in turn, a while on each.
  w.tourT -= dt;
  const live = S.players.filter((P) => !P.absent && !P.out && getE(P.lander));
  if (!live.length) return null;
  if (w.tourT <= 0) { w.tourT = 14; w.tour = (w.tour + 1) % live.length; }
  const L = getE(live[w.tour % live.length].lander);
  return { x: L.x + 0.5, y: L.y + 0.5, v: 0 };
}

/** Every frame: glide to the action, unless the player has moved the map (then it's theirs until Follow). */
function watchCamera(w, dt) {
  if (!w.follow) return;
  const c = R.cam, k = w.cam;
  if (k && k.w === R.w && k.h === R.h && (Math.abs(c.x - k.x) > 1e-3 || Math.abs(c.y - k.y) > 1e-3 || Math.abs(c.z - k.z) > 1e-3)) { watchFollow(false); return; }
  w.spotT -= dt;
  if (w.spotT <= 0) { w.spotT = 0.5; w.spot = watchSpot(w, 0.5) || w.spot; }
  if (w.spot) {
    const f = Math.min(1, dt * 1.8);
    c.x += (w.spot.x - c.x) * f; c.y += (w.spot.y - c.y) * f;
    clampCam();
  }
  w.cam = { x: c.x, y: c.y, z: c.z, w: R.w, h: R.h };
}

/** Every frame of a game being watched (uiTick). */
function watchTick(dt) {
  const w = UI.watch;
  // (The game's messages speak to a colony's own player, "your Command Base...": the scout report speaks instead.)
  if (S.msgs.length) S.msgs.length = 0;
  watchEvents(w);
  if (!UI.photo) watchCamera(w, dt); else w.cam = null;
  const now = performance.now(); // (by the clock: at 8× a frame can take longer than the tenth of a second dt is held to)
  if (now - w.reportAt >= 1000) { w.reportAt = now; watchReport(); }
}

/* ------------------------------------------------------------------ setup */

function initWatch() {
  $('m-watch').onclick = () => { audioUnlock(); sfx('click'); openWatch(); };
  $('w-close').onclick = () => { sfx('click'); closeWatch(); };
  $('w-start').onclick = () => { audioUnlock(); watchKeepSetup(); watchStart(WATCH.setup); };
  $('wc-follow').onclick = () => { sfx('click'); if (UI.watch) watchFollow(!UI.watch.follow, true); };
  // The report folds away to the colonies' line (on a phone it takes a fair part of the screen), and opens again.
  $('wc-fold').onclick = () => {
    const card = $('watch-card'), folded = !card.classList.contains('folded');
    card.classList.toggle('folded', folded); $('wc-fold').setAttribute('aria-expanded', folded ? 'false' : 'true'); sfx('click');
  };
  window.addEventListener('popstate', () => { if (!UI.inGame) closeWatch(true); });
  // Keys. The setup screen: Esc closes it. In a game being watched: the map moves and zooms, Space and Esc pause, [ ]
  // the speed, M the minimap, I Statistics, ? How to play, F follows the action; no other key reaches the game (they
  // give orders, to a colony the computer plays).
  window.addEventListener('keydown', (e) => {
    const k = (e.key || '').toLowerCase(), tag = (e.target && e.target.tagName) || '';
    if (!UI.inGame) {
      if (k === 'escape' && !$('screen-watch').hidden && tag !== 'SELECT' && !UI.picker) { e.preventDefault(); e.stopPropagation(); closeWatch(); }
      return;
    }
    if (!UI.watch || UI.photo) return;
    if (tag === 'TEXTAREA' || tag === 'SELECT' || (tag === 'INPUT' && !/^(range|checkbox)$/.test(e.target.type))) return; // (typing: the feedback form)
    if (/^Digit[0-9]$/.test(e.code || '') || k === '`') { e.stopPropagation(); return; } // (no control groups, no Boosts)
    if (topScreen() || e.ctrlKey || e.metaKey || e.altKey) return;
    if (k === 'f') { e.preventDefault(); e.stopPropagation(); watchFollow(!UI.watch.follow, true); return; }
    if (PAN_KEYS[k] || ['escape', ' ', 'spacebar', '+', '=', '-', '_', '[', ']', 'm', 'i', '?', 'shift'].includes(k)) return;
    e.stopPropagation();
  }, true);
}

initWatch();

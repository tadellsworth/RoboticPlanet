'use strict';
/*
 * Terrafall — Observer mode: computer colonies play a game out while you watch.
 *
 * Main menu, Observer: pick the map type, how many colonies (two, or three or four where the map type has room)
 * and each one's doctrine (or Random: one no other colony has), then Start observing. It's a normal game in which the
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
const WATCH_INPUT = { onTap: null, onPaint: null, onBox: null, onCommand: null, onGrab: null, canBox: () => false, canPaint: () => false };
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

/** The last setup, kept on this device: { shape, n, docs: four doctrine keys or 'random' }. */
function watchSetup() {
  let w = null;
  try { w = JSON.parse(localStorage.getItem(WATCH_KEY) || 'null'); } catch (e) { w = null; }
  const ok = (k) => k === 'random' || isDoctrine(k);
  const docs = w && Array.isArray(w.docs) ? w.docs : [];
  const shape = w && Number.isInteger(w.shape) && w.shape >= 0 && w.shape < SHAPE_PRESETS.length ? w.shape : 0;
  return {
    shape, n: w && Number.isInteger(w.n) ? clamp(w.n, 2, 4) : 2,
    docs: [0, 1, 2, 3].map((p) => (ok(docs[p]) ? docs[p] : ['turtle', 'rusher', 'raider', 'tycoon'][p])),
  };
}
function watchKeepSetup() { try { localStorage.setItem(WATCH_KEY, JSON.stringify(WATCH.setup)); } catch (e) { /* storage unavailable */ } }

/** How many colonies the setup makes on its map type (as many as it asks for that the map has room for). */
function watchCount(w) { return playerCount('versus', w.shape, w.n); }

function openWatch() {
  WATCH.setup = WATCH.setup || watchSetup();
  const sel = $('w-shape');
  if (!sel.options.length) {
    // The map types, grouped as the Custom Game picker groups them.
    const groups = MAP_GROUPS.map((g) => ({ ...g, list: [] })), other = { key: '', name: 'More', list: [] };
    SHAPE_PRESETS.forEach((P, i) => (groups.find((g) => g.key === P.group) || other).list.push(i));
    sel.innerHTML = groups.concat(other).filter((g) => g.list.length).map((g) => `<optgroup label="${g.name}">` +
      g.list.map((i) => `<option value="${i}">${SHAPE_PRESETS[i].name}${maxPlayers(i) > 2 ? ` (${minPlayers(i) === maxPlayers(i) ? maxPlayers(i) : `${minPlayers(i)}–${maxPlayers(i)}`} colonies)` : ''}</option>`).join('') + '</optgroup>').join('');
  }
  WATCH.note = null;
  syncWatch();
  $('screen-watch').hidden = false;
  try { history.pushState({ watchSetup: 1 }, ''); } catch (e) { /* no history to add to (a sandboxed frame) */ }
}

function closeWatch(fromBack) {
  if ($('screen-watch').hidden) return;
  $('screen-watch').hidden = true;
  if (!fromBack) try { if (history.state && history.state.watchSetup) history.back(); } catch (e) { /* as above */ }
}

/** The setup screen up to date with WATCH.setup. */
function syncWatch() {
  const w = WATCH.setup, n = watchCount(w);
  $('w-shape').value = String(w.shape);
  for (const b of $('w-n').children) {
    const v = +b.dataset.v, can = v >= minPlayers(w.shape) && v <= maxPlayers(w.shape);
    b.disabled = !can;
    b.classList.toggle('on', v === n);
    b.setAttribute('aria-checked', v === n ? 'true' : 'false');
  }
  $('w-n-row').hidden = maxPlayers(w.shape) <= 2;
  const names = [['random', 'Random'], ...PERSONALITY_ORDER.map((k) => [k, PERSONALITIES[k].name])];
  $('w-seats').innerHTML = Array.from({ length: n }, (_, p) => `<label class="m-seat" title="${callsign(p, true)}"><i class="dot" style="background:${PLAYER_COLORS[p]}"></i>` +
    `<select data-p="${p}" aria-label="${callsign(p, true)}'s doctrine">${names.map(([k, name]) => `<option value="${k}"${w.docs[p] === k ? ' selected' : ''}>${name}</option>`).join('')}</select></label>`).join('');
  for (const s of $('w-seats').querySelectorAll('select')) s.onchange = () => { w.docs[+s.dataset.p] = s.value; WATCH.note = +s.dataset.p; watchKeepSetup(); syncWatch(); sfx('click'); };
  // The line under them: the doctrine just picked (or the first colony's), in a sentence.
  const p = WATCH.note != null && WATCH.note < n ? WATCH.note : 0, k = w.docs[p];
  $('w-note').innerHTML = `<i class="dot" style="background:${PLAYER_COLORS[p]}"></i> ` + (k === 'random' ? `<b>Random:</b> ${DOCTRINE_RANDOM_TAG}, picked when the game starts.`
    : `<b>${docLabel(k)}:</b> “${PERSONALITIES[k].quote}” ${PERSONALITIES[k].tag.replace(/^./, (c) => c.toUpperCase())}.`);
}

/* ------------------------------------------------------------------ starting and leaving */

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
  const n = watchCount(setup);
  // Random: a doctrine no other colony has (they may repeat only once all five are taken).
  const docs = setup.docs.slice(0, n).map((k) => (isDoctrine(k) ? k : null));
  const pool = PERSONALITY_ORDER.filter((k) => !docs.includes(k));
  for (let p = 0; p < n; p++) {
    if (docs[p]) continue;
    if (!pool.length) pool.push(...PERSONALITY_ORDER);
    docs[p] = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
  }
  newGame({
    seed: randomSeed(), difficulty: 'normal', mode: 'versus', size: DEFAULT_SIZE.versus, rough: DEFAULT_ROUGH, rich: DEFAULT_RICH,
    shape: setup.shape, players: n, humans: [], styles: docs, style: 'balanced', nuke: true, events: false, victory: 'capture',
    murmur: typeof UI !== 'undefined' && murmurLevelOk(UI.menu.murmur) ? UI.menu.murmur : 'off', // (the Murmur as the new-game screen has them)
    biome: BIOME_ORDER[Math.floor(Math.random() * BIOME_ORDER.length)],
  });
  // (newGame gives the first colony the plain Steward when nobody plays it: it gets its doctrine here, before the
  // game's first step, as newGame would have given it; and the game plays on to the last colony standing.)
  const P0 = S.players[0];
  P0.style = docs[0];
  if (PERSONALITIES[docs[0]].econ) P0.mult *= PERSONALITIES[docs[0]].econ;
  S.watch = true;
  ME = 0;
  enterGame(true);
  UI.watch = { setup, follow: true, cam: null, spot: null, spotT: 0, tour: 0, tourT: 0, reportAt: 0, out: {}, seen: new WeakSet(), events: [], input: again ? again.input : inputSwap(WATCH_INPUT) };
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
  $('o-title').textContent = `${watchThe(win, true)} wins`;
  $('o-text').textContent = `${callsign(win)}, the ${(RIVAL_NAMES[win] || '').toLowerCase()} ${watchDoc(win)}, took the planet after ${fmtTime(S.time)}: ` + (how === 'surrender' ? 'the last colony against it surrendered.'
    : how === 'nuke' ? 'its nuclear missile destroyed the last Command Base against it.' : 'the last Command Base against it is its own.');
  $('o-stats').innerHTML = [['Time', fmtTime(S.time)]].concat(S.players.filter((P) => !P.absent).map((P) => [
    `<i class="dot" style="background:${PLAYER_COLORS[P.id]}"></i> ${watchDoc(P.id)}`,
    P.id === win ? 'Won' : w.out[P.id] !== undefined ? `Fell at ${fmtTime(w.out[P.id])}` : 'Fell',
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
  $('w-shape').onchange = () => { const w = WATCH.setup; w.shape = +$('w-shape').value; w.n = clamp(w.n, minPlayers(w.shape), maxPlayers(w.shape)); watchKeepSetup(); syncWatch(); sfx('click'); };
  for (const b of $('w-n').children) b.onclick = () => { WATCH.setup.n = +b.dataset.v; watchKeepSetup(); syncWatch(); sfx('click'); };
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
      if (k === 'escape' && !$('screen-watch').hidden && tag !== 'SELECT') { e.preventDefault(); e.stopPropagation(); closeWatch(); }
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

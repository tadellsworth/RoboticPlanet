'use strict';
/*
 * Terrafall — scout reports in your own games. Now and then a line about what a computer rival is up to ("Scouts: the
 * Herald is massing for a push on your east Outpost (about 12 warbots)."), read from its real plans by rivalPlans (in
 * js/watch.js: Observer mode's scout report reads them the same way), shown as a message with Go to the place it's
 * about, and kept in the message list. Each piece of news is told once, as it starts, not every second: a storm of
 * your Command Base (and again as it goes in), a march on one of your forts, a band out to raid your roads, an army
 * massing for one of your forts, a Warden's big push, and a rival pulling its warbots home while yours are at its
 * gates. Of the other rivals of a free-for-all, only their storms and marches. Allies and people are never reported.
 *
 * Fair: only what scouts watching the map could tell. A band is reported once it is out in the open (its warbots
 * counted, as the map shows them), a few seconds after it sets off; an army massing is "about" so many (its size, as
 * Statistics has it, rounded), never the number it waits for; Missiles and shells are left to the game's own messages.
 * Scout reports: On or Off in the pause menu (kept on this device). Display only: nothing here changes the game.
 */

const SCOUT_KEY = 'terrafall.scouts';
const SCOUT_DELAY = 6;   // game seconds a plan has to last before the scouts report it
const SCOUT_URGENT = 2;  // ... a storm going in
const SCOUT_AGAIN = 300; // news that goes on (massing, pulling back) is told again after this long
const SCOUT_OVER = 30;   // news not seen for this long is over: when it comes back, it's news again
const SCOUT_GAP = 15;    // at least this long between two reports, unless one is urgent (the other waits its turn)
const SCOUT = { on: true, of: null, news: new Map(), last: -1e9, at: 0 };
try { SCOUT.on = localStorage.getItem(SCOUT_KEY) !== '0'; } catch (e) { /* storage unavailable: on */ }
function setScoutsOn(on) { SCOUT.on = !!on; try { localStorage.setItem(SCOUT_KEY, on ? '1' : '0'); } catch (e) { /* storage unavailable */ } }

/** An army's size as a scout would put it: "a few", "about 8", "about 15". */
function scoutAbout(n) { return n <= 3 ? 'a few' : `about ${n <= 10 ? Math.max(4, Math.round(n / 2) * 2) : Math.round(n / 5) * 5}`; }

/** Whose a building is, in a sentence: "your", "your ally VERMILION's", "the Warden's", "TYRIAN's". */
function scoutWhose(f) {
  const P = S.players[f];
  if (f === ME) return 'your';
  if (allies(f, ME)) return `your ally ${colonyName(f)}’s`;
  return P && P.ai && isDoctrine(P.style) ? watchThes(f) : `${colonyName(f)}’s`;
}

/** One of your buildings, by where it stands from your Command Base: "Command Base", "east Outpost", "Outpost by your base". */
function scoutPlace(b) {
  const name = BDEFS[b.type].name;
  if (b.type === 'lander') return name;
  const d = watchDir(ME, b.x + 0.5, b.y + 0.5);
  return d ? `${d} ${name}` : `${name} by your base`;
}

/**
 * What the scouts have to say about rival P's plans (rivalPlans, `army` its warbots): a list of { key (one piece of
 * news: told once while it lasts), again (told again after SCOUT_AGAIN while it goes on), quiet (it goes on, with
 * nothing to tell of it now), urgent, s (how much it matters), t (the line), kind, x, y }.
 */
function scoutNews(P, plans, army) {
  const p = P.id, The = watchThe(p), out = [];
  const band = (d) => d.x !== null && d.x !== undefined ? { x: Math.floor(d.x), y: Math.floor(d.y) } : {};
  const twin = The !== `the ${watchDoc(p)}`;
  const aBand = twin ? `${watchThes(p)} band` : `${aOrAn(watchDoc(p))} band`;
  const foeCount = S.players.filter((Q) => !Q.absent && !Q.out && Q.id !== p && foes(p, Q.id)).length;
  for (const d of plans) {
    const at = band(d);
    if (d.kind === 'storm' && d.n >= 2) {
      const mine = d.foe === ME || allies(d.foe, ME), whose = scoutWhose(d.foe);
      if (d.go && mine) out.push({ key: 'stormgo:' + d.id, urgent: true, s: 120, t: `${watchThes(p)} storm is going in on ${whose} Command Base!`, kind: 'bad', ...at });
      else if (!d.go) out.push({ key: 'storm:' + d.id, s: 100, t: `${The} is forming up to storm ${whose} Command Base, ${d.n} warbots strong${mine ? '!' : '.'}`, kind: mine ? 'warn' : 'info', ...at });
    } else if (d.kind === 'march' && d.n >= 2 && d.b) {
      const mine = d.b.owner === ME;
      out.push({ key: 'march:' + d.id, s: mine ? 90 : 60, t: `${The} has ${d.n} warbots on the march against ${mine ? 'your ' + scoutPlace(d.b) : `${scoutWhose(d.b.owner)} ${BDEFS[d.b.type].name}`}.`, kind: mine || allies(d.b.owner, ME) ? 'warn' : 'info', ...at });
    } else if (d.kind === 'raid' && d.foe === ME && d.n >= 1) {
      const dir = watchDir(ME, d.tx, d.ty), road = dir ? `your ${dir} road` : 'the roads by your base';
      out.push({ key: 'raid:' + d.id, s: 70, t: `${aBand} ${d.forming ? 'is heading for' : 'is raiding'} ${road} (${d.n} warbot${d.n === 1 ? '' : 's'}).`, kind: 'warn', ...at });
    } else if (d.kind === 'mass') {
      // (One piece of news for as long as it masses, told while it's your fort it means to push on: in a free-for-all
      // its aim moves from one colony to another and back as it masses.)
      if (d.b && d.b.owner === ME) out.push({ key: 'mass:' + p, again: true, s: 50, t: `${The} is massing for a push on your ${scoutPlace(d.b)} (${scoutAbout(army)} warbots).`, kind: 'warn', x: d.b.x, y: d.b.y });
      else out.push({ key: 'mass:' + p, quiet: true });
    } else if (d.kind === 'push' && !plans.some((e) => e.kind === 'storm' || e.kind === 'march')) { // (once it marches, the march is the news)
      out.push({ key: 'push:' + p + ':' + Math.round(d.until), s: 55, t: `${The} is starting its big push: every warbot it can spare will march${foeCount === 1 ? ' on you' : ''}.`, kind: foeCount === 1 ? 'warn' : 'info' });
    } else if (d.kind === 'home') {
      // (only while warbots of yours are at its gates: it's your attack it is answering)
      const L = getE(P.lander);
      let near = 0;
      if (L) for (const u of S.bots) if (!u.dead && !u.inside && u.owner === ME && isArmy(u) && dist2(u.x, u.y, L.x, L.y) <= 144) near++;
      out.push(near >= 3 ? { key: 'home:' + p, again: true, s: 40, t: `${The} is pulling its warbots back to hold its base.`, kind: 'good', x: L.x, y: L.y } : { key: 'home:' + p, quiet: true });
    }
  }
  return out;
}

/**
 * Every frame of a game (uiTick); once a second it looks at each rival and tells the most important news that is due:
 * news that has lasted SCOUT_DELAY (a storm going in, SCOUT_URGENT), not told yet (or, for news that goes on, told
 * SCOUT_AGAIN ago), and at least SCOUT_GAP after the last report (unless it's urgent).
 */
function scoutTick() {
  if (!SCOUT.on || !S || UI.watch || S.mode === 'colony') return;
  const now = performance.now();
  if (now - SCOUT.at < 1000) return;
  SCOUT.at = now;
  if (SCOUT.of !== S) { SCOUT.of = S; SCOUT.news = new Map(); SCOUT.last = -1e9; }
  const army = {};
  for (const P of S.players) army[P.id] = 0;
  for (const u of S.bots) if (!u.dead && army[u.owner] !== undefined && isArmy(u)) army[u.owner]++;
  let best = null, bestE = null;
  for (const P of S.players) {
    if (P.absent || P.out || P.id === ME || !P.ai || !isDoctrine(P.style) || !foes(P.id, ME)) continue;
    for (const n of scoutNews(P, rivalPlans(P, army[P.id]), army[P.id])) {
      let e = SCOUT.news.get(n.key);
      if (!e || S.time - e.seen > SCOUT_OVER || e.seen > S.time) { e = { first: S.time, told: null }; SCOUT.news.set(n.key, e); }
      e.seen = S.time;
      if (n.quiet) continue; // (it goes on, but there's nothing to tell of it now)
      if (S.time - e.first < (n.urgent ? SCOUT_URGENT : SCOUT_DELAY)) continue; // (a little later, as scouts would bring it)
      if (e.told !== null && !(n.again && S.time - e.told >= SCOUT_AGAIN)) continue;
      if (!n.urgent && S.time - SCOUT.last < SCOUT_GAP) continue;
      if (!best || n.s > best.s) { best = n; bestE = e; }
    }
  }
  if (SCOUT.news.size > 200) for (const [k, e] of SCOUT.news) if (S.time - e.seen > SCOUT_OVER) SCOUT.news.delete(k);
  if (!best) return;
  bestE.told = S.time;
  SCOUT.last = S.time;
  toast(`Scouts: ${best.t}`, best.kind, best.x, best.y);
  if (best.kind === 'warn' || best.kind === 'bad') haptic('warn');
}

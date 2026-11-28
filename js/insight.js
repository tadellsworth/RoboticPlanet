'use strict';
/*
 * Terrafall — insight: what is holding the colony up, and how the game went. Display only: everything here reads S
 * and changes nothing (every action is an order: js/orders.js).
 *
 * The bottleneck finder (whyIdle): a factory that isn't making anything (the Bot Foundry first, every factory and the
 * Smelter) gets a "Why idle?" line in its panel. It follows the missing input back down the supply chain and stops at
 * the first real cause, in plain words ("No Crystal: your Crystal Tap ran dry 3 minutes ago and no new one is being
 * built."), with a button to the culprit (or to build the missing link). For a missing good it asks, in order: is any
 * in storage (then why it isn't arriving: no road, no Hauler, enemy guns, every Hauler busy)? Is there a building that
 * makes it, staffed, with its own inputs (asked again, a link further down), out of enemy guns' reach, and for a
 * gatherer with deposits left in reach? If there's none, is one being built, and could one be started (the site
 * limit)? Are any workers free? Worked out for the open panel only, once a second (WHY).
 *
 * The colony's shortage (insightColony): the good the colony has gone longest without while something waited for it
 * (P.dry, kept by the simulation: see logTick in js/sim.js), with its cause. Its chip in the goods bar is ringed and
 * the Economy panel's Bottlenecks lead with it (js/economy.js). Worked out once a second at most.
 *
 * The post-game report (gameReport) on the end screen: the moments that mattered (S.log, written by the simulation),
 * where goods were lost (P.stats), and one tip for next time, chosen from what happened.
 */

const WHY = { s: null, t: -1, id: 0, res: null };
const INSIGHT = { s: null, t: -1, res: null };
/** The building that usually makes each good: the one to suggest when there's none. */
const MAIN_MAKER = { fiber: 'harvester', stone: 'quarry', ore: 'mine', crystal: 'tap', alloy: 'smelter', chip: 'fab', cement: 'kiln', fuel: 'farm',
  crude: 'pump', asphalt: 'tarworks', ammo: 'armory', warhead: 'munitions', uranium: 'mine', fissile: 'reactor' };

function insEsc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function insCap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
/** A building type's name for n of them: "Harvester", "2 Quarries", "Cement Works". */
function insPl(type, n) {
  const nm = BDEFS[type].name;
  if (n === 1) return nm;
  return `${n} ${/s$/.test(nm) ? nm : /[^aeiou]y$/.test(nm) ? nm.slice(0, -1) + 'ies' : nm + 's'}`;
}
/** How long ago game time t was, in words (with a space before it), or '' when it isn't known. */
function insAgo(t) {
  if (!(t > 0)) return '';
  const s = S.time - t, m = Math.round(s / 60);
  return s < 45 ? ' just now' : m <= 1 ? ' a minute ago' : ` ${m} minutes ago`;
}
/** A stretch of seconds in words: "40 seconds", "a minute", "6 minutes". */
function insDur(sec) {
  if (sec < 55) return `${Math.max(10, Math.round(sec / 10) * 10)} seconds`;
  const m = Math.round(sec / 60);
  return m <= 1 ? 'a minute' : `${m} minutes`;
}
/** The good called `name` (as a status line has it), or null. */
function insGood(name) { return GOODS.find((g) => GOOD[g].name === name) || null; }
/** Is the danger map current (so asking it changes nothing the simulation would see: see dangerMap)? */
function insGuns() { return typeof DANGER !== 'undefined' && DANGER.s === S && DANGER.epoch === Math.floor(S.tick / 15) && DANGER.maps.length === S.players.length; }
/** Your buildings. */
function insMine() { return S.buildings.filter((b) => !b.dead && b.owner === ME); }
function insFoundry() { return S.buildings.find((b) => !b.dead && b.owner === ME && b.built && BDEFS[b.type].bots) || null; }
/** Building types that make good g. */
function insMakers(g) {
  const out = [];
  for (const t in BDEFS) {
    const d = BDEFS[t];
    if ((d.make && d.make[g]) || (d.gather && gatherTypes(t).some((r) => RES[r].good === g)) || (d.farm && g === 'fuel')) out.push(t);
  }
  return out;
}
/** Could you put up a `type` in this game (it's in the build menu)? */
function insCanBuild(type) {
  const d = BDEFS[type];
  return !!d && BUILD_MENU.includes(type) && !(d.war && !warOn()) && !(d.nuke && !nukeOn()) && !(d.colony && !labOn()) && !(d.naval && !navalOk());
}
/** Is building b at work (or out gathering) right now? */
function insWorking(b) { return !!b.working || /^(Working|Gathering|Cutting|Digging|Harvesting|Planting|Laying)/.test(b.status || ''); }
/** A Worker of yours free for a job (isIdleWorker, without asking the danger map). */
function insFree(u) {
  if (u.dead || u.owner !== ME || u.type !== 'worker' || u.carry || u.ferryWait || u.dropping || (u.task && u.task.type !== 'home') || u.recycleTo || u.shyUntil > S.time) return false;
  return (u.bat ?? 100) >= BATTERY.low || !canTopUp(u);
}

/** Why no worker comes: { text (a clause), at, ok (nothing wrong: one is coming) }. */
function workerWhy(crew) {
  const f = insFoundry(), at = f ? f.id : 0;
  if (crew) {
    const n = S.bots.filter((u) => !u.dead && u.owner === ME && u.type === crew).length;
    return n ? { text: `your ${n === 1 ? BOTS[crew].name + ' is' : BOTS[crew].plural + ' are'} busy elsewhere`, at, ok: true }
      : { text: `you have no ${BOTS[crew].name}: order one at the Bot Foundry`, at };
  }
  let all = 0, free = 0;
  for (const u of S.bots) if (!u.dead && u.owner === ME && u.type === 'worker') { all++; if (insFree(u)) free++; }
  const sites = siteCount(ME);
  if (!all) return { text: 'you have no Workers left: order some at the Bot Foundry', at };
  if (!free) return { text: `none of your ${all} Workers is free: order more at the Bot Foundry, or pause a building you can spare`, at };
  if (sites && free <= wfKeepFree(ME, MIN_FREE_WORKERS)) return { text: `your free Worker${free === 1 ? ' is' : 's are'} kept for your ${sites} construction site${sites === 1 ? '' : 's'}: order more Workers at the Bot Foundry`, at };
  return { text: 'a free Worker should be on its way', ok: true };
}

/** You have some of g: why it isn't reaching `cons` (who: how to name it, "this building" or "it"). */
function haulWhy(g, cons, have, who) {
  const G = goodN(g, have), inc = (cons.inc && cons.inc[g]) || 0;
  const f = insFoundry(), fid = f ? f.id : 0, liquid = isLiquid(g), carrier = liquid ? 'Tanker' : 'Hauler';
  if (cons.unlinked && needsRoad(cons)) return { text: `${who} has no road to storage, so haulers can't bring it ${goodN(g, 2)}`, at: cons.id, road: true };
  if (inc > 0) return { text: `${inc} ${goodN(g, inc)} ${inc === 1 ? 'is' : 'are'} on the way`, ok: true };
  const carriers = [];
  for (const u of S.bots) {
    if (u.dead || u.owner !== ME) continue;
    const bt = BOTS[u.type];
    if (!bt.haul || bt.sea || bt.rail || bt.train || (!liquid && bt.tanker) || (liquid && bt.truck && !bt.tanker)) continue;
    if (!u.recycleTo) carriers.push(u);
  }
  if (!carriers.length && !S.players[ME].noHaulers) return { text: `you have ${have} ${G} but no ${carrier} to carry ${have === 1 ? 'it' : 'them'}: order one at the Bot Foundry`, at: fid };
  const src = S.buildings.filter((s) => !s.dead && s.owner === ME && s !== cons && supplyOf(s, g) >= 1);
  if (!src.length) return { text: `every ${GOOD[g].name} you have is promised to other buildings and sites`, ok: true };
  const linked = src.filter((s) => roadLinked(s, cons));
  if (!linked.length) {
    const s = src[0], sd = BDEFS[s.type];
    if (!sd.store && s.unlinked) return { text: `you have ${have} ${G}, but waiting at your ${sd.name}, which has no road to storage`, at: s.id };
    return { text: `you have ${have} ${G}, but in ${aOrAn(sd.name)} that no road joins to ${who}`, at: s.id };
  }
  if (insGuns()) {
    if (shunned(cons)) {
      const gun = gunOver(ME, cons.x, cons.y);
      return { text: gun ? `an enemy ${BDEFS[gun.type].name} covers ${who}, so haulers keep clear` : `enemy robots are about ${who}, so haulers keep clear`, at: gun ? gun.id : cons.id };
    }
    if (linked.every((s) => shunned(s))) return { text: `enemy guns or robots cover the storage holding your ${G}, so haulers keep clear`, at: linked[0].id };
  }
  if (haulShy(cons)) return { text: `haulers turning back: Murmur near the road to ${who}. Send warbots to clear the road`, at: cons.id };
  if (linked.every(haulShy)) return { text: `haulers turning back: Murmur near the road to your ${BDEFS[linked[0].type].name} holding your ${G}. Send warbots to clear the road`, at: linked[0].id };
  const connected = carriers.filter((u) => linked.some((s) => !BOTS[u.type].roadOnly || haulRoadConnected(u, s, cons)));
  if (carriers.length && !connected.length && !cons.airSupply && linked.every(onHomeNet)) {
    return { text: `your road carriers can’t reach the route from storage to ${who}: connect their roads to the supply route`, at: linked[0].id };
  }
  if (connected.length && connected.every((u) => u.carry || (u.task && u.task.type !== 'home'))) return { text: `you have ${have} ${G}, but the road carriers that can reach it are busy`, at: fid, soft: true };
  return { text: `you have ${have} ${G}, and no delivery is assigned yet`, ok: true };
}

/** Deposits in gatherer b's reach: { all, own (on no rival's land), safe (and out of enemy guns' reach), ripe (and grown) }. */
function insLeft(b) {
  const def = BDEFS[b.type], r = def.radius, r2 = r * r + 0.3, zone = S.zone[tIdx(b.x, b.y)], types = gatherTypes(b.type), guns = insGuns();
  const out = { all: 0, own: 0, safe: 0, ripe: 0 };
  for (let j = Math.max(0, b.y - r); j <= Math.min(S.H - 1, b.y + r); j++) {
    for (let i = Math.max(0, b.x - r); i <= Math.min(S.W - 1, b.x + r); i++) {
      const t = j * S.W + i;
      if (!types.includes(S.res[t]) || !S.amt[t] || S.zone[t] !== zone || dist2(i, j, b.x, b.y) > r2) continue;
      out.all++;
      if (S.owner[t] >= 0 && S.owner[t] !== b.owner) continue;
      out.own++;
      if (guns && hotFor(b.owner, t)) continue;
      out.safe++;
      if ((S.res[t] !== R_STALK && S.res[t] !== R_VEIN) || S.grow[t] >= 1) out.ripe++;
    }
  }
  return out;
}

/** The latest run of your losses with a building of one of `types` in it: { type, t } or null. */
function insLostRecently(types) {
  for (let i = (S.log || []).length - 1; i >= 0; i--) {
    const e = S.log[i];
    if (e.k !== 'lost' || e.p !== ME || !e.ty) continue;
    const type = Object.keys(e.ty).find((k) => types.includes(k));
    if (type) return { type, t: e.t1 };
  }
  return null;
}

/** Why maker p (yours, built) isn't making anything: { text, at, build, ok, dry } or null (nothing wrong seen). */
function makerWhy(p, depth, seen) {
  const def = BDEFS[p.type], name = `your ${def.name}`, st = p.status || '';
  if (p.paused) return { text: `${name} is paused`, at: p.id };
  if (p.cut) return { text: `${name} is cut off on a rival's ground`, at: p.id };
  if (insGuns() && underGuns(p)) { const gun = gunOver(ME, p.x, p.y); return { text: `an enemy ${gun ? BDEFS[gun.type].name : 'gun'} covers ${name}, so your robots keep clear`, at: gun ? gun.id : p.id }; }
  if ((insGuns() && foesAt(p)) || /about: its worker waits/.test(st)) return { text: `enemy robots are about ${name}, so its worker stays inside`, at: p.id };
  if (def.gather && !def.bedrock && (p.depleted || /left in reach/.test(st))) {
    const L = insLeft(p), res = RES[gatherRes(p.type)].name.toLowerCase() + 's';
    if (L.safe && !L.ripe) return { text: `the new ${res} in reach of ${name} are still growing`, at: p.id, ok: true };
    return { at: p.id, dry: true, text: !L.all ? `${name} ran dry${insAgo(p.dryAt)}` : !L.own ? `the last ${res} in reach of ${name} lie on a rival's land`
      : `enemy guns cover the ${res} in reach of ${name}` };
  }
  if (def.farm && /^No fertile/.test(st)) return { text: `${name} has no fertile soil left in reach`, at: p.id, dry: true };
  if (def.farm && /ripening/.test(st)) return { text: `${name}'s crops are still ripening`, at: p.id, ok: true };
  if (def.pump && pumpDry(p)) return { text: `${name}'s oil seep has run dry`, at: p.id, dry: true };
  if (/^Stopped/.test(st)) return { text: `${name} is stopped at its stock limit`, at: p.id };
  if (def.staff && !p.staff) {
    if (p.staffInc) return { text: `${name}'s ${def.crew ? BOTS[def.crew].name : 'worker'} is on the way`, at: p.id, ok: true };
    const w = workerWhy(def.crew);
    return { text: `${name} has no ${def.crew ? BOTS[def.crew].name : 'worker'}, and ${w.text}`, at: w.ok ? p.id : w.at || p.id, ok: w.ok };
  }
  if (/^Worker (is recharging|on the way)/.test(st)) return { text: `${name}'s worker is ${/recharging/.test(st) ? 'off recharging' : 'on the way'}`, at: p.id, ok: true };
  const m = /^Waiting for ([A-Za-z ]+)/.exec(st), g2 = m && def.inp ? insGood(m[1]) : null;
  if (g2) {
    if (depth < 3 && !seen.has(g2)) {
      seen.add(g2);
      const c = goodWhy(g2, p, depth + 1, seen, 'it');
      if (c) return { text: `${name} has no ${goodN(g2, 2)}, because ${c.text}`, at: c.at || p.id, build: c.build, ok: c.ok, road: c.road && c.at === p.id };
    }
    return { text: `${name} is waiting for ${goodN(g2, 2)}`, at: p.id };
  }
  if (p.unlinked && needsRoad(p)) return { text: `${name} has no road to storage`, at: p.id, road: true };
  return null;
}

/** Why your construction site `site` (of a building that makes something you're out of) isn't done. */
function siteWhy(site, depth, seen) {
  const name = `your new ${BDEFS[site.type].name}`, st = site.status || '';
  if (site.unlinked || /^No road/.test(st)) return { text: `${name} has no road to storage yet`, at: site.id, road: true };
  if (/^Waiting for a builder/.test(st)) { const w = workerWhy(); return { text: `${name} is waiting for a builder, and ${w.text}`, at: w.ok ? site.id : w.at || site.id, ok: w.ok }; }
  if (/^Under construction/.test(st)) return { text: `${name} is going up`, at: site.id, ok: true };
  const c = siteCost(site);
  for (const g in c) {
    if ((site.stock[g] || 0) + (site.inc[g] || 0) >= c[g] || goodTotal(ME, g) >= 1 || seen.has(g) || depth >= 3) continue;
    seen.add(g);
    const sub = goodWhy(g, site, depth + 1, seen, 'it');
    if (sub) return { text: `${name} is waiting for ${goodN(g, 2)}, because ${sub.text}`, at: sub.at || site.id, build: sub.build, ok: sub.ok };
  }
  return { text: `${name} is waiting for its materials`, at: site.id, ok: true };
}

/**
 * Why good g isn't reaching `cons`, as a clause ("your Crystal Tap ran dry 3 minutes ago and no new one is being
 * built"): { text, at (a building to show), build (a type to put up), road, ok (nothing wrong: it's coming), have
 * (some is on hand) } or null. Down the chain to `depth` 3, never asking about a good in `seen` twice.
 */
function goodWhy(g, cons, depth, seen, who) {
  const have = goodTotal(ME, g);
  if (have >= 1 || (cons.inc?.[g] || 0) > 0) { const c = haulWhy(g, cons, have, who); return c && { ...c, have: true }; }
  const types = insMakers(g), mine = insMine().filter((b) => types.includes(b.type));
  const built = mine.filter((b) => b.built), sites = mine.filter((b) => !b.built);
  const main = MAIN_MAKER[g] && types.includes(MAIN_MAKER[g]) ? MAIN_MAKER[g] : types[0];
  if (!main) return null;
  const build = insCanBuild(main) ? main : null, pname = BDEFS[main].name;
  const full = siteCount(ME) >= MAX_SITES ? `, and you can't start one: all ${MAX_SITES} construction sites are taken` : '';
  if (!built.length) {
    if (sites.length) return siteWhy(sites[0], depth, seen);
    const lost = insLostRecently(types);
    if (lost) return { text: `your ${BDEFS[lost.type].name} was destroyed${insAgo(lost.t)} and no new one is being built${full}`, build };
    return { text: `you have no ${pname}${full}`, build };
  }
  const busy = built.filter(insWorking);
  if (busy.length) {
    const t = busy[0].type, n = built.filter((b) => b.type === t).length;
    return { text: `your ${n === 1 ? BDEFS[t].name + ' works' : insPl(t, n) + ' work'}, but every ${GOOD[g].name} is used as soon as it's made: build another ${pname}${full}`, build, soft: true };
  }
  built.sort((a, c) => dist2(a.x, a.y, cons.x, cons.y) - dist2(c.x, c.y, cons.x, cons.y));
  let soft = null;
  for (const p of built) {
    const c = makerWhy(p, depth, seen);
    if (!c) continue;
    if (c.ok) { soft = soft || c; continue; }
    // The last of them dry: is a new one coming?
    if (c.dry && built.every((b) => b === p || !insWorking(b))) {
      if (sites.length) { const s = siteWhy(sites[0], depth, seen); return { ...c, text: `${c.text}, and ${s.ok ? 'a new one is going up' : s.text}`, at: s.ok ? c.at : s.at }; }
      return { ...c, text: `${c.text} and no new one is being built${full}`, build };
    }
    return c;
  }
  return soft || { text: `your ${pname} isn't making any just now`, at: built[0].id, ok: true };
}

/** Why its output isn't collected (a full factory). */
function outWhy(b) {
  if (b.unlinked && needsRoad(b)) return { text: 'This building has no road to storage, so haulers can\'t take what it makes.', at: b.id, road: true };
  if (insGuns() && shunned(b)) { const gun = gunOver(ME, b.x, b.y); return { text: gun ? `An enemy ${BDEFS[gun.type].name} covers it, so haulers keep clear.` : 'Enemy robots are about, so haulers keep clear.', at: gun ? gun.id : b.id }; }
  if (haulShy(b)) return { text: 'Haulers turning back: Murmur near the road. Send warbots to clear the road; each turn-back in a row makes the next Hauler wait longer.', at: b.id };
  let n = 0, idle = 0;
  for (const u of S.bots) if (!u.dead && u.owner === ME && BOTS[u.type].haul && !BOTS[u.type].tanker && !BOTS[u.type].sea && !BOTS[u.type].rail) { n++; if (!u.carry && (!u.task || u.task.type === 'home')) idle++; }
  const f = insFoundry();
  if (!n) return { text: 'Its output is full and you have no Hauler to take it: order one at the Bot Foundry.', at: f ? f.id : 0 };
  if (!idle) return { text: 'Its output is full and every Hauler is busy: order more Haulers at the Bot Foundry.', at: f ? f.id : 0, soft: true };
  return null;
}

/**
 * "Why idle?" for production building b (yours): { text (a sentence or two), at, build, road, ok } or null when it is
 * working or its status already says why (paused, at its stock limit, nothing ordered). Once a second for the open panel.
 */
function whyIdle(b) {
  if (WHY.s === S && WHY.id === b.id && Math.abs(S.time - WHY.t) < 1) return WHY.res;
  WHY.s = S; WHY.id = b.id; WHY.t = S.time;
  return (WHY.res = whyNow(b));
}

function whyNow(b) {
  const def = BDEFS[b.type], st = b.status || '';
  if (!b || b.dead || !b.built || b.owner !== ME || !def.inp || def.pump || b.paused || b.cut) return null;
  if (b.working || /^(Working|Stopped|Idle: tap|Bot limit)/.test(st)) return null;
  if (/^Needs a/.test(st)) { const w = workerWhy(def.crew); return w.ok ? null : { ...w, text: `No worker: ${w.text}.` }; }
  if (/^Worker is recharging/.test(st)) {
    if (S.players[ME].canCharge) return null;
    const c = goodWhy('fuel', b, 1, new Set(['fuel']), 'it');
    return { ...(c || {}), text: 'Its worker is recharging, and no Fuel Station has Fuel' + (c && !c.have ? `: ${c.text}.` : '.') };
  }
  if (/^Output full/.test(st)) return outWhy(b);
  const m = /^Waiting for ([A-Za-z ]+)/.exec(st), g = m ? insGood(m[1]) : null;
  if (!g) return null;
  const c = goodWhy(g, b, 0, new Set([g]), 'this building');
  if (!c) return null;
  return { ...c, text: c.have ? insCap(c.text) + '.' : `No ${goodN(g, 2)}: ${c.text}.` };
}

/** The buttons for a cause: show the culprit, put up the missing building. */
function whyButtons(r, self) {
  let h = '';
  const at = r.at && r.at !== self ? getE(r.at) : null;
  if (at && !at.dead) h += `<button class="btn small" data-why-at="${at.id}">Show the ${insEsc(at.owner === ME ? BDEFS[at.type].name : `enemy ${BDEFS[at.type].name}`)}</button>`;
  if (r.build && siteCount(ME) < MAX_SITES) h += `<button class="btn small" data-why-build="${r.build}">Build ${aOrAn(BDEFS[r.build].name)}</button>`;
  return h ? `<div class="why-acts">${h}</div>` : '';
}

/** Wire the buttons whyButtons made, inside `el`. */
function whyWire(el) {
  for (const btn of el.querySelectorAll('[data-why-at]')) btn.onclick = () => {
    const c = getE(+btn.dataset.whyAt);
    if (!c || c.dead) return;
    sfx('click'); centerOn(c.x + 0.5, c.y + 0.5); openBuildingSheet(c);
  };
  for (const btn of el.querySelectorAll('[data-why-build]')) btn.onclick = () => { sfx('click'); closeSheet(); setMode('normal'); enterPlaceMode(btn.dataset.whyBuild); };
}

/** The "Why idle?" box in production building b's panel (see whyIdle): rewritten only when it changes. */
const WHY_DELAY = 3; // seconds of game time a building waits before its panel says why (refreshWhy)
function refreshWhy(b) {
  const el = $('sh-why');
  if (!el) return;
  let r = whyIdle(b);
  // A steady panel: a building that stops for a moment (the next Hauler is pulling up) shows no box until it has waited
  // WHY_DELAY seconds, and the room a box took stays while the panel is open, so the buttons below don't jump up and
  // down each time it starts and stops (a Bot Foundry waiting on Chips did, by up to 120 px). A panel opened on a
  // building that is already idle shows its box at once.
  if (el._since === undefined) el._since = r ? -Infinity : null;
  if (!r) el._since = null;
  else if (el._since === null) el._since = S.time;
  if (r && S.time - el._since < WHY_DELAY) r = null;
  const html = r ? `<div class="why-box${r.ok ? ' calm' : r.soft ? ' soft' : ''}"><b>${r.ok ? 'Idle for now:' : 'Why idle?'}</b> ${insEsc(r.text)}${r.ok ? '' : whyButtons(r, b.id)}</div>` : '';
  if (el.dataset.html === html) return;
  el.dataset.html = html;
  el.innerHTML = html;
  whyWire(el);
  const h = el.offsetHeight;
  if (h > (el._h || 0)) { el._h = h; el.style.minHeight = h + 'px'; }
}

/**
 * The colony's worst shortage now: the good it has gone longest without (30 s or more) while something waited for it,
 * a shortage that holds up the Bot Foundry first. { g, text, at, build, starved: [every good short now] } or null.
 * Once a second at most.
 */
function insightColony() {
  if (INSIGHT.s === S && Math.abs(S.time - INSIGHT.t) < 1) return INSIGHT.res;
  INSIGHT.s = S; INSIGHT.t = S.time;
  return (INSIGHT.res = colonyNow());
}

function colonyNow() {
  const P = S.players[ME], D = P && P.dry;
  if (!D || P.out) return null;
  const mine = insMine(), f = mine.find((b) => b.built && BDEFS[b.type].bots && /^Waiting for/.test(b.status || ''));
  const waitsFor = (b, g) => (b.status || '').startsWith('Waiting for ' + GOOD[g].name);
  const starved = [];
  let best = null, bs = -1;
  for (const g in D) {
    const r = D[g];
    if (!Array.isArray(r) || !GOOD[g] || S.time - r[1] > 5 || r[1] - r[0] < 30 || goodTotal(ME, g) >= 1) continue;
    starved.push(g);
    const sc = (r[1] - r[0]) + (f && waitsFor(f, g) ? 1e5 : 0) + (g === 'alloy' || g === 'chip' ? 120 : 0);
    if (sc > bs) { bs = sc; best = g; }
  }
  if (!best) return null;
  const g = best, dur = D[g][1] - D[g][0];
  // Ask from the building that waits for it (the Foundry, a factory, else a site).
  const cons = mine.filter((b) => (b.built && waitsFor(b, g)) || (!b.built && (siteCost(b)[g] || 0) > (b.stock[g] || 0)))
    .sort((a, c) => (BDEFS[c.type].bots ? 1 : 0) - (BDEFS[a.type].bots ? 1 : 0))[0] || getE(P.lander);
  const c = cons ? goodWhy(g, cons, 0, new Set([g]), 'it') : null;
  return { g, starved, at: c && c.at, build: c && c.build, text: `No ${goodN(g, 2)} for ${insDur(dur)}` + (c && !c.have ? `: ${c.text}.` : '.') };
}

/* ------------------------------------------------------------------ the post-game report */

/** A colony in a sentence: "you", "VERMILION". */
function insWho(p, the) { return p === ME ? (the ? 'you' : 'You') : insEsc(playerName(p, the)); }
/** "2 Harvesters, a Depot and a Quarry" from { type: n }. */
function insTypes(ty) {
  const parts = Object.keys(ty || {}).filter((t) => BDEFS[t]).sort((a, c) => ty[c] - ty[a]).map((t) => (ty[t] === 1 ? aOrAn(BDEFS[t].name) : insPl(t, ty[t])));
  if (parts.length > 4) parts.splice(3, parts.length - 3, 'more');
  return parts.length > 1 ? parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1] : parts[0] || '';
}

/** The moments that mattered to you, from S.log: [{ t, text, kind ('good', 'bad', 'warn', 'info'), w (weight), key }]. */
function reportMoments() {
  const L = S.log || [], P = S.players[ME], out = [], from = S.logFrom || 0;
  const bname = (t) => (BDEFS[t] ? BDEFS[t].name : 'building');
  for (const e of L) {
    if (!(e.t >= 0)) continue;
    if (e.k === 'bot' && e.p === ME && BOTS[e.u]) out.push({ t: e.t, kind: 'good', w: 20, text: `Your first robot: ${aOrAn(BOTS[e.u].name)} from the Bot Foundry.` });
    else if (e.k === 'def' && e.p === ME && BDEFS[e.b]) out.push({ t: e.t, kind: 'good', w: 19, text: `Your first defence: ${aOrAn(BDEFS[e.b].name)}.` });
    else if (e.k === 'hit' && e.p === ME && e.q >= 0) out.push({ t: e.t, kind: 'bad', w: 21, text: e.b ? `First attack on you: ${insWho(e.q)}'s robots hit your ${bname(e.b)}.` : `First attack on you: ${insWho(e.q)} struck your colony from afar.` });
    else if (e.k === 'hit' && e.q === ME && e.p >= 0) out.push({ t: e.t, kind: 'good', w: 20, text: e.b ? `Your first attack: your robots hit ${insWho(e.p)}'s ${bname(e.b)}.` : `Your first strike on ${insWho(e.p)}.` });
    else if (e.k === 'lost' && e.p === ME) {
      const span = e.t1 - e.t > 40 ? ` (to ${fmtTime(e.t1)})` : '';
      out.push({ t: e.t, kind: 'bad', w: 2 + e.n * 2, n: e.n, p: e.p, t1: e.t1, text: `You lost ${e.n === 1 ? 'a building' : e.n + ' buildings'}${e.q >= 0 ? ` to ${insWho(e.q, true)}` : e.q === -2 ? ' to several rivals' : ''}${span}: ${insTypes(e.ty)}.` });
    } else if (e.k === 'lost' && e.q === ME) out.push({ t: e.t, kind: 'good', w: 1 + e.n * 2, n: e.n, p: e.p, t1: e.t1, text: `Your robots wrecked or took ${e.n === 1 ? 'one' : e.n} of ${insWho(e.p, true)}'s buildings: ${insTypes(e.ty)}.` });
    else if (e.k === 'lost' && e.n >= 4) out.push({ t: e.t, kind: 'info', w: e.n, n: e.n, p: e.p, t1: e.t1, text: `${insWho(e.p)} lost ${e.n} buildings${e.q >= 0 ? ` to ${insWho(e.q, true)}` : ''}.` });
    else if (e.k === 'city' && e.p >= 0) out.push({ t: e.t, kind: e.p === ME ? 'good' : e.q === ME ? 'bad' : 'info', w: 20, text: e.p === ME ? `You took Arrival City${e.q >= 0 ? ` from ${insWho(e.q)}` : ''}.` : `${insWho(e.p)} took Arrival City${e.q === ME ? ' from you' : e.q >= 0 ? ` from ${insWho(e.q)}` : ''}.` });
    else if (e.k === 'cityDown' && e.p >= 0) out.push({ t: e.t, kind: e.p === ME ? 'bad' : 'good', w: 12, text: e.p === ME ? 'Your Arrival City was knocked out: dark, and open to seizing.' : `${insWho(e.p)}'s Arrival City was knocked out.` });
    else if (e.k === 'megaDown' && e.p >= 0 && BDEFS[e.b]) out.push({ t: e.t, kind: e.p === ME ? 'bad' : e.q === ME ? 'good' : 'info', w: 12, text: e.p === ME ? `Your ${bname(e.b)} was knocked out${e.q >= 0 ? ` by ${insWho(e.q, true)}` : ''}: dark, and open to seizing.` : `${insWho(e.p)}'s ${bname(e.b)} was knocked out${e.q === ME ? ' by your robots' : ''}.` });
    else if (e.k === 'megaTaken' && e.p >= 0 && BDEFS[e.b]) out.push({ t: e.t, kind: e.p === ME ? 'good' : e.q === ME ? 'bad' : 'info', w: 18, text: e.p === ME ? (e.q === ME ? `You took your ${bname(e.b)} back.` : `You seized ${insWho(e.q, true)}'s ${bname(e.b)}.`) : `${insWho(e.p)} seized ${e.q === ME ? 'your' : e.q === e.p ? 'back its' : `${insWho(e.q, true)}'s`} ${bname(e.b)}.` });
    else if (e.k === 'reactorDown' && e.p >= 0) out.push({ t: e.t, kind: e.p === ME ? 'bad' : e.q === ME ? 'good' : 'info', w: 14, text: e.p === ME ? `Your Nuclear Reactor was breached${e.q >= 0 ? ` by ${insWho(e.q, true)}` : ''}: radiation over your ground for minutes.` : e.q === ME ? `You breached ${insWho(e.p, true)}'s Nuclear Reactor: radiation over its ground for minutes.` : `${insWho(e.p)}'s Nuclear Reactor was breached.` });
    else if (e.k === 'liftFall' && e.p >= 0) out.push({ t: e.t, kind: e.p === ME ? 'bad' : e.q === ME ? 'good' : 'info', w: 18, text: e.p === ME ? `Your Orbital Lift was destroyed${e.q >= 0 ? ` by ${insWho(e.q, true)}` : ''}, and its cable came down across your land.` : e.q === ME ? `You brought down ${insWho(e.p, true)}'s Orbital Lift: its cable fell across its land.` : `${insWho(e.p)}'s Orbital Lift came down.` });
    else if (e.k === 'liftDrop' && e.p === ME) out.push({ t: e.t, kind: 'good', w: 6, text: `A climber came down your Orbital Lift with ${LIFT.drops[e.g] ? LIFT.drops[e.g].name.toLowerCase() : 'a drop'} from the Carrier.` });
    else if (e.k === 'gupStop' && e.p >= 0) out.push({ t: e.t, kind: e.p === ME || allies(e.p, ME) ? 'warn' : 'good', w: 8, text: e.p === ME ? 'Your Great Uplink stood down.' : `${insWho(e.p)}'s Great Uplink stood down.` });
    else if (e.k === 'gup' && e.p >= 0) out.push({ t: e.t, kind: e.p === ME || allies(e.p, ME) ? 'good' : 'bad', w: 16, text: e.p === ME ? 'Your Great Uplink began transmitting.' : `${insWho(e.p)}'s Great Uplink began transmitting.` });
    else if (e.k === 'lanceFire' && e.p >= 0) out.push({ t: e.t, kind: e.p === ME ? 'good' : 'bad', w: 22, text: e.p === ME ? 'Your Lance of Corvane fired across the map.' : `${insWho(e.p)}'s Lance of Corvane fired across the map.` });
    else if (e.k === 'dry' && e.p === ME && GOOD[e.g] && e.d >= 60) out.push({ t: e.t, kind: 'warn', w: 2 + e.d / 40, text: `Out of ${goodN(e.g, 2)} for ${insDur(e.d)}.`, g: e.g, d: e.d });
    else if (e.k === 'out') {
      const how = e.how === 'nuke' ? 'destroyed by a nuclear missile from' : e.how === 'surrender' ? 'surrendered to' : 'fell to';
      const text = e.p === ME ? (e.how === 'surrender' ? `You surrendered to ${insWho(e.q, true)}.` : `Your Command Base ${how} ${insWho(e.q, true)}.`)
        : e.how === 'surrender' ? `${insWho(e.p)} surrendered to ${insWho(e.q, true)}.` : `${insWho(e.p)}'s Command Base ${how} ${insWho(e.q, true)}.`;
      out.push({ t: e.t, kind: e.p === ME ? 'bad' : e.q === ME ? 'good' : 'info', w: 50, out: true, p: e.p, text });
    }
    else if (e.k === 'back' && e.p >= 0) out.push({ t: e.t, kind: e.p === ME || allies(e.p, ME) ? 'good' : 'bad', w: 30, text: e.p === ME ? `${insWho(e.q)} took your Command Base back: you were back in the game.` : e.q === ME ? `You took ${insWho(e.p, true)}'s Command Base back: they were back in the game.` : `${insWho(e.p)}'s Command Base was taken back by ${insWho(e.q, true)}.` });
  }
  // Shortages still going at the end.
  for (const g in (P && P.dry) || {}) {
    const r = P.dry[g];
    if (Array.isArray(r) && GOOD[g] && r[1] - r[0] >= 60 && S.time - r[1] < 5) out.push({ t: r[0], kind: 'warn', w: 2 + (r[1] - r[0]) / 40, g, d: r[1] - r[0], text: `Out of ${goodN(g, 2)} from here to the end (${insDur(r[1] - r[0])}).` });
  }
  // How it was decided (Domination and the Uplinks leave no "out": the clock ran down).
  const how = S.endHow, win = S.winner;
  if (win >= 0 && how === 'contact') {
    out.push({ t: Math.max(0, S.time - GUP.hold), kind: win === ME || allies(win, ME) ? 'good' : 'bad', w: 60, key: true,
      text: `${insWho(win)} ${win === ME ? 'hold' : 'holds'} the Great Uplink's transmission from here on, ${insDur(GUP.hold)} of it in all: the deciding moment.` });
  }
  if (win >= 0 && (how === 'domination' || how === 'uplinks')) {
    const hold = how === 'domination' ? DOM.hold : UPLINK.hold;
    out.push({ t: Math.max(0, S.time - hold), kind: win === ME || allies(win, ME) ? 'good' : 'bad', w: 60, key: true,
      text: how === 'domination' ? `${insWho(win)} took most of the land and held it for ${insDur(hold)}: the deciding moment.` : `${insWho(win)} ${win === ME ? 'lead' : 'leads'} on the Uplinks from here on, ${insDur(hold)} in all: the deciding moment.` });
  }
  // The deciding battle: the last big run of losses before the colony that fell went out (or the fall itself).
  const fall = out.filter((m) => m.out).pop();
  if (fall) {
    const run = out.filter((m) => m.n >= 2 && m.p === fall.p && m.t1 <= fall.t + 1 && fall.t - m.t1 <= 150).pop();
    const m = run || fall;
    m.key = true; m.w = Math.max(m.w, 40);
  }
  for (const m of out) if (m.t < from && !m.out) m.w = -1; // (before the log began: a save from before it)
  return out.filter((m) => m.w >= 0);
}

/** The one tip for next time, from what happened: HTML. */
function reportTip(won, moments) {
  const P = S.players[ME], st = (P && P.stats) || {}, war = S.mode !== 'colony';
  const short = {};
  for (const m of moments) if (m.g) short[m.g] = (short[m.g] || 0) + m.d;
  const worst = Object.keys(short).sort((a, c) => short[c] - short[a])[0];
  const tips = [];
  const firstHit = moments.find((m) => m.kind === 'bad' && /^First attack on you/.test(m.text));
  const hadDef = (S.log || []).some((e) => e.k === 'def' && e.p === ME);
  if (war && !won && P.out && (S.time < 15 * 60 || (firstHit && firstHit.t < 8 * 60))) tips.push([100, 'a garrison early: keep a few Warbots with Ammo at home (an Ammo Plant first), and put an Outpost or a Pulse Turret where the rival comes in. An early rush beats a colony with no one home.']);
  if (war && !hadDef && (st.lostBld || 0) >= 3) tips.push([50 + st.lostBld, 'defences: you lost buildings and never built a gun. A Pulse Turret or two (Crystal for ammo) and a Bunker where raids come in, with Walls to slow them down.']);
  const SHORT_TIP = {
    fiber: 'more Harvesters by fresh stalk groves, and a Grove Planter beside them so Fiber never runs out',
    stone: 'a second Quarry by boulders and a rock face: Stone makes Cement, and new Cement Works',
    ore: 'more Ore Mines on fresh veins: one Smelter keeps two or three busy',
    crystal: 'a second Crystal Tap on a fresh field before the first runs dry: Chips (and so robots) need Crystal',
    alloy: 'more Ore Mines and a second Smelter: Alloy goes into Chips, robots and most buildings',
    chip: 'a steady Chip supply: a Crystal Tap and the Alloy to go with it for the Chip Fab, or a second Chip Fab',
    cement: 'a second Quarry and Cement Works: nearly everything is built from Cement',
    fuel: 'Fuel to spare: Bio Farms on fertile soil, or an Oil Pump and a Refinery, so Fuel Stations never run dry',
  };
  if (worst && short[worst] >= 240 && SHORT_TIP[worst]) tips.push([short[worst] / 10, `${SHORT_TIP[worst]}. You were out of ${goodN(worst, 2)} for ${insDur(short[worst])} in all.`]);
  if ((st.lostAboard || 0) >= 15) tips.push([30 + st.lostAboard / 2, `guarding your supply roads: raiders destroyed robots carrying ${st.lostAboard} goods. An Outpost or a turret where they cross, or Walls with a Gate.`]);
  if (war && hadDef && (st.lostBld || 0) >= 8) tips.push([20 + st.lostBld, `more defences where the attacks came from: you lost ${st.lostBld} buildings in all. A Keep toughens the Walls and guns round it.`]);
  if (won) tips.push([5, S.mission ? 'the next mission, or this one at a harder level.' : S.difficulty === 'warlord' ? 'another map type or doctrine: every one plays differently.' : 'a harder rival: you won this one.']);
  tips.push([1, 'Statistics and graphs: flat stretches in your goods and output show where the colony stalled.']);
  tips.sort((a, c) => c[0] - a[0]);
  return `<div class="rp-tip"><b>Next time, try</b> ${insEsc(tips[0][1])}</div>`;
}

/** The report for the end screen: the moments that mattered, where goods were lost, a tip. HTML ('' when there's nothing to say). */
function gameReport(won) {
  if (!S || !S.players[ME]) return '';
  const all = reportMoments();
  // The dozen that matter most, in order (the deciding one, falls and firsts first).
  const keep = all.slice().sort((a, c) => (c.key ? 1e3 : 0) + c.w - ((a.key ? 1e3 : 0) + a.w)).slice(0, 12);
  const ms = all.filter((m) => keep.includes(m)).sort((a, c) => a.t - c.t);
  const st = S.players[ME].stats || {};
  let crates = 0;
  for (const l of S.loot || []) if (S.owner[tIdx(l.x, l.y)] === ME) crates += lootLeft(l);
  let h = '';
  if (ms.length) {
    h += `<h3>How it went</h3><ol class="rp-time">${ms.map((m) => `<li class="${m.kind}${m.key ? ' key' : ''}"><span class="rp-t">${fmtTime(m.t)}</span><span>${m.key ? '<b>Deciding: </b>' : ''}${m.text}</span></li>`).join('')}</ol>`;
    if (S.logFrom > 0) h += `<p class="hint">From ${fmtTime(S.logFrom)}: this game was saved before the game kept a record.</p>`;
  }
  const rows = [];
  if (st.lostBld) rows.push(['Buildings destroyed or taken', `${st.lostBld}`], ['… their materials', `${st.lostMat || 0} goods`], ['… goods inside them', `${st.lostIn || 0}`]);
  if (st.lostAboard) rows.push(['Goods on robots destroyed', `${st.lostAboard}`]);
  if (crates) rows.push(['Crates left lying on your land', `${crates} goods`]);
  h += `<h3>Where goods were lost</h3>` + (rows.length ? `<div class="stats rp-loss">${rows.map(([k, v]) => `<span>${k}</span><span>${v}</span>`).join('')}</div>`
    : '<p class="hint rp-none">Nowhere: no building, load or crate of yours was lost.</p>');
  h += reportTip(won, all);
  return h;
}

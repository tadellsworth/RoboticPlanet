'use strict';
/*
 * Terrafall — the Economy panel (tap a good in the top bar, or Y; Statistics, I, opens it on History): where your goods
 * come from, where they go and what holds them up. Display only: it reads S and changes nothing. Its quick actions
 * send orders that already exist (foundryOrder, wfOrder: js/orders.js), only open Build, or (Join the roads) put a road
 * plan in Paths for you to build with its own Build button (ORDERS.paths).
 *
 *  - This good: stock now and over the last ten minutes, made and used a minute, the net ("−3/min, empty in 2:10");
 *    its chain both ways as a small flow diagram (what it's made from, down to the raw goods, and what it goes into);
 *    every building that makes or uses it with its state (working, waiting for an input, output full, unstaffed, no
 *    road), tap one to go there; and the top problems for this good.
 *  - Whole economy: every good a node (stock, made and used a minute), a link from each input to what it's made into
 *    (the thicker, the more goes along it; red where something waits for that good), and the four ends goods go to
 *    (building sites, robots, upkeep, guns). Beside it the Bottlenecks: the worst few, in plain words, each with its
 *    chain ("Chips short ← Chip Fab waits ← Crystal short ← 2 Crystal Taps unstaffed") and the quick action that fixes
 *    it: Make more Haulers (3 at a Bot Foundry), Prioritise this (the maker's row to the top of the Workforce ladder,
 *    Manual), Build a maker (Build, with it picked to place) or, where the goods sit on one road network and the
 *    buildings waiting for them on another (a split network: more Haulers wouldn't help), Join the roads: the shortest
 *    road between the two (roadJoinRoute, world.js) outlined in red and planned in Paths, waiting for Build or Clear.
 *    An action that can't apply isn't shown. On This good a split's gap is outlined on the map too, without the button.
 *  - History: the Statistics graphs (renderStats in ui.js), as they were.
 * The rates are goodRates' (the last two minutes, sim.js); the stock over time is the statistics history (S.hist). While
 * it's open the map shows the goods your robots carried over the last minute as flowing lines in each good's colour
 * (R.gf: sampleGoodsFlow in render.js; on This good only that good), and a ring on each of your buildings in its state's
 * colour (on This good only its makers and users): ecDrawFlow and ecDrawStates, called from render.js.
 */

const EC_TABS = [['good', 'This good'], ['flow', 'Whole economy'], ['hist', 'History']];
/** A building's state on the panel and the map: [label, colour]. */
const EC_ST = {
  work: ['Working', '#5dd88a'], wait: ['Waiting for input', '#ffb24a'], full: ['Output full', '#6ec8ff'],
  staff: ['Unstaffed', '#ff4d8a'], road: ['No road', '#ff5a5a'], off: ['Stopped', '#8a8f9e'], idle: ['Idle', '#c9c3b5'],
};
const EC_BAD = { staff: 0, road: 1, wait: 2, full: 3, off: 4, idle: 5, work: 6 }; // (the list's order: problems first)
/** Where goods end up besides other goods: [key, name]. */
const EC_SINKS = [['sites', 'Building sites'], ['bots', 'Robots'], ['upkeep', 'Upkeep'], ['guns', 'Guns']];
const EC_SINK = Object.fromEntries(EC_SINKS);
const EC = { at: -1, of: null, d: null, pg: 0, join: null, joinWait: false };

function ecMapOn() { return UI.sheetKind === 'econ'; }
function ecEsc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function ecFmt(v) { const a = Math.abs(v); return a >= 10 ? String(Math.round(a)) : String(Math.round(a * 10) / 10); }
function ecSigned(v) { return (v > 0.05 ? '+' : v < -0.05 ? '−' : '±') + ecFmt(Math.abs(v) < 0.05 ? 0 : v); }

/** The goods in play (those the top bar shows). */
function ecGoods() { return GOODS.filter((g) => UI.goodEls && UI.goodEls[g] ? !UI.goodEls[g].hidden : (warOn() || !WAR_GOODS.includes(g)) && (nukeOn() || !NUKE_GOODS.includes(g))); }

/** Does a building of type t use good g, and where does that take it ('make': into another good, or one of EC_SINKS)? */
function ecUse(t, g) {
  const d = BDEFS[t];
  if (d.inp && d.inp[g]) return d.bots ? 'bots' : d.make ? 'make' : 'upkeep';
  if ((d.charger && d.charger.fuel && g === 'fuel') || (d.fuelCap && g === 'fuel') || (d.repair && g === 'alloy') || (d.roadworks && g === 'asphalt')) return 'upkeep';
  if (d.ammo === g || (d.ammoStock && g === 'ammo') || (d.nukeSilo && NUKE.parts[g]) || (d.missile && g === 'warhead')) return 'guns';
  return '';
}
/** The building types that use good g. */
function ecUserTypes(g) { return Object.keys(BDEFS).filter((t) => ecUse(t, g)); }

/**
 * Building b's state (yours, built): { k (EC_ST), s (in words), g (the good it waits for) }. Its status line and
 * stallWhy (sim.js) say most of it; a building that wants a Worker and has none is unstaffed.
 */
function ecState(b) {
  const def = BDEFS[b.type], st = b.status || '';
  if (b.paused) return { k: 'off', s: 'Paused' };
  if (b.cut) return { k: 'off', s: 'Cut off on a rival\'s ground' };
  if (b.unlinked && needsRoad(b)) return { k: 'road', s: 'No road to storage' };
  const m = /^Waiting for ([A-Za-z ]+)/.exec(st), why = stallWhy(b);
  const g = m ? insGood(m[1].trim()) : /^Waiting for /.test(why) ? insGood(why.slice(12)) : null;
  if (g && (def.inp || def.ammo || def.fuelCap || def.charger || def.repair || def.roadworks)) return { k: 'wait', s: `Waiting for ${GOOD[g].name}`, g };
  if (/full/i.test(why) || /^Output full|^Storage full/.test(st)) return { k: 'full', s: 'Output full, waiting for pickup' };
  if (def.staff && !b.staff && !b.staffInc && wantsStaff(b)) return { k: 'staff', s: `No ${def.crew ? BOTS[def.crew].name : 'Worker'}` };
  if (why) return { k: 'off', s: why };
  if (atLimit(b)) return { k: 'off', s: 'Stopped at its stock limit' };
  if (pumpDry(b) || b.depleted) return { k: 'off', s: 'Ran dry' };
  if (def.staff && !b.staff) return { k: b.staffInc ? 'idle' : 'off', s: b.staffInc ? `Its ${def.crew ? BOTS[def.crew].name : 'Worker'} is on the way` : st || 'Idle' };
  if (insWorking(b)) return { k: 'work', s: st || 'Working' };
  // (a gun or a Fuel Station with its goods in is doing its job)
  if (!def.inp && !def.make && !def.gather) return { k: 'work', s: st || 'Stocked' };
  return { k: 'idle', s: st || 'Idle' };
}

/** "Smelter", "2 Smelters", "3 Quarries". */
function ecPl(type, n) { return typeof insPl === 'function' ? insPl(type, n) : `${n} ${BDEFS[type].name}`; }
function ecPlain(type) { const nm = BDEFS[type].name; return /s$/.test(nm) ? nm : /[^aeiou]y$/.test(nm) ? nm.slice(0, -1) + 'ies' : nm + 's'; }

/** How long until good g runs out at the net rate (a minute figure) with `have` on hand: "2:10", or '' (never). */
function ecEmptyIn(have, net) { return net < -0.05 && have > 0 ? fmtClock((have / -net) * 60) : ''; }

/** Your Haulers (the road carriers that aren't Tankers, ships or trains) and the buildings they serve. */
function ecHaulers() {
  let n = 0, free = 0;
  for (const u of S.bots) if (!u.dead && u.owner === ME && BOTS[u.type].haul && !BOTS[u.type].tanker && !BOTS[u.type].sea && !BOTS[u.type].rail && !BOTS[u.type].train) { n++; if (!u.carry && (!u.task || u.task.type === 'home')) free++; }
  let blds = 0;
  for (const b of S.buildings) if (!b.dead && b.owner === ME && needsRoad(b)) blds++;
  return { n, free, blds };
}

/** A Bot Foundry of yours that can take an order for Haulers now (a built one, under the robot limit), or null. */
function ecFoundry() {
  if (BOTS_OFF.has('hauler') || botCount(ME) >= (S.mode === 'colony' ? MAX_BOTS_COLONY : MAX_BOTS)) return null;
  return S.buildings.find((b) => !b.dead && b.owner === ME && b.built && b.type === 'foundry' && !b.paused && !b.cut) || null;
}

/**
 * Everything the panel shows, worked out at most twice a second: { goods, gd (per good), st (per building id), tier,
 * links, sinks, probs }.
 */
function ecData() {
  const now = performance.now();
  if (EC.d && EC.of === S && now - EC.at < 500) return EC.d;
  EC.at = now; EC.of = S;
  return (EC.d = ecWork());
}

function ecWork() {
  const goods = ecGoods(), rates = goodRates(ME), H = S.hist, h = H && H.p[ME];
  const mine = S.buildings.filter((b) => !b.dead && b.owner === ME);
  const st = new Map(), gd = {};
  for (const g of goods) {
    const r = rates[g] || { made: 0, used: 0 };
    gd[g] = { g, have: goodTotal(ME, g), made: r.made, used: r.used, net: r.made - r.used, makers: [], users: [], waitB: [], sites: [], hist: [] };
  }
  for (const b of mine) {
    if (!b.built) {
      // (a site still owed a good, none of it on the way)
      if (storeFunded(b)) continue;
      const c = siteCost(b);
      for (const g in c) if (gd[g] && c[g] - (b.stock[g] || 0) - (b.inc[g] || 0) > 0) gd[g].sites.push(b);
      continue;
    }
    let s = null;
    for (const g of madeGoods(b).concat(BDEFS[b.type].farm ? ['fuel'] : [])) if (gd[g]) { s = s || ecState(b); if (!gd[g].makers.includes(b)) gd[g].makers.push(b); }
    for (const g of goods) if (ecUse(b.type, g)) { s = s || ecState(b); gd[g].users.push(b); if (s.k === 'wait' && s.g === g) gd[g].waitB.push(b); }
    if (s) st.set(b.id, s);
  }
  // The stock over the last ten minutes (the statistics history, a sample every HIST_STEP seconds), and now.
  for (const g of goods) {
    const v = [];
    if (H && h && h.goods && h.goods[g]) for (let i = 0; i < H.t.length; i++) if (H.t[i] >= S.time - 600) v.push(h.goods[g][i] || 0);
    v.push(gd[g].have);
    gd[g].hist = v;
  }
  // Each good's column in the diagram: the raw goods first, then each one a step past the furthest of its inputs.
  const tier = {};
  const tierOf = (g, seen) => {
    if (tier[g] !== undefined) return tier[g];
    let t = 0;
    for (const m of insMakers(g)) { const d = BDEFS[m]; if (d.inp && d.make) for (const i in d.inp) if (!seen.has(i) && goods.includes(i)) t = Math.max(t, 1 + tierOf(i, new Set([...seen, i]))); }
    return (tier[g] = t);
  };
  for (const g of goods) tierOf(g, new Set([g]));
  // The links: input to output, for each kind of factory you have; then each good to the ends it goes to.
  const links = [], have = new Set(mine.filter((b) => b.built).map((b) => b.type));
  const factoryUse = {};
  for (const t of have) {
    const d = BDEFS[t];
    if (!d.inp || !d.make) continue;
    for (const out in d.make) {
      if (!gd[out]) continue;
      const makers = gd[out].makers, share = makers.length ? makers.filter((b) => b.type === t).length / makers.length : 0;
      for (const i in d.inp) {
        if (!gd[i]) continue;
        const w = Math.max(0, gd[out].made * share * (d.inp[i] / d.make[out]));
        factoryUse[i] = (factoryUse[i] || 0) + w;
        const red = mine.some((b) => b.type === t && st.get(b.id)?.k === 'wait' && st.get(b.id).g === i);
        links.push({ a: i, b: out, w, red, via: t });
      }
    }
  }
  const sinks = new Set();
  for (const g of goods) {
    const D = gd[g], ends = {};
    for (const b of D.users) { const k = ecUse(b.type, g); if (k !== 'make') ends[k] = (ends[k] || 0) + 1; }
    if (D.sites.length || (g === 'cement' && mine.some((b) => !b.built))) ends.sites = (ends.sites || 0) + Math.max(1, D.sites.length);
    const left = Math.max(0, D.used - (factoryUse[g] || 0)), n = Object.values(ends).reduce((a, v) => a + v, 0);
    for (const k in ends) {
      sinks.add(k);
      const red = k === 'sites' ? D.sites.length > 0 && D.have < 1 : D.users.some((b) => ecUse(b.type, g) === k && st.get(b.id)?.k === 'wait' && st.get(b.id).g === g);
      links.push({ a: g, b: k, w: n ? (left * ends[k]) / n : 0, red, sink: true });
    }
  }
  const d = { goods, gd, st, tier, links, sinks: EC_SINKS.map(([k]) => k).filter((k) => sinks.has(k)), probs: [] };
  d.probs = ecProblems(d, mine);
  return d;
}

/** Good g's state for its node: 'short' (something waits and you have none), 'low' (out within 5 minutes), 'up', or ''. */
function ecGoodState(D) {
  if ((D.waitB.length || D.sites.length) && D.have < 1) return 'short';
  if (D.net < -0.05 && D.have / -D.net < 5) return 'low';
  return D.net > 0.05 ? 'up' : '';
}

/**
 * The chain behind a shortage of g, in a few words a link: "Chips short ← Chip Fab waits ← Crystal short ← 2 Crystal
 * Taps unstaffed". Up to four links.
 */
function ecChain(d, g, seen) {
  seen = seen || new Set();
  seen.add(g);
  const D = d.gd[g];
  if (!D) return [];
  const out = [`${goodN(g, 2)} ${D.have < 1 ? 'short' : 'low'}`];
  if (seen.size > 3) return out;
  const types = insMakers(g), mk = D.makers;
  if (!mk.length) { const t = MAIN_MAKER[g] && types.includes(MAIN_MAKER[g]) ? MAIN_MAKER[g] : types[0]; return out.concat(t ? [`no ${BDEFS[t].name}`] : []); }
  const by = (k) => mk.filter((b) => d.st.get(b.id)?.k === k);
  const pl = (bs, words) => `${bs.length === 1 && mk.length === 1 ? BDEFS[bs[0].type].name : ecPl(bs[0].type, bs.length)} ${words}`;
  const staff = by('staff'), road = by('road'), wait = by('wait'), full = by('full');
  if (staff.length) return out.concat([pl(staff, 'unstaffed')]);
  if (road.length) return out.concat([pl(road, 'without a road')]);
  if (wait.length) {
    const g2 = d.st.get(wait[0].id).g;
    out.push(pl(wait, wait.length === 1 ? 'waits' : 'wait'));
    if (g2 && !seen.has(g2) && d.gd[g2]) return out.concat(ecChain(d, g2, seen));
    return out;
  }
  if (full.length) return out.concat([pl(full, 'full: Haulers behind')]);
  if (by('work').length) return out.concat([`every ${BDEFS[mk[0].type].name} busy: build another`]);
  return out;
}

/** The Workforce row of the first maker without a Worker down good g's chain (g's makers, then what they wait for), or ''. */
function ecIdleRow(d, g, seen) {
  seen = seen || new Set();
  if (seen.has(g) || !d.gd[g]) return '';
  seen.add(g);
  const mk = d.gd[g].makers, idle = mk.find((b) => d.st.get(b.id)?.k === 'staff');
  if (idle) return wfRowOf(idle.type);
  for (const b of mk) { const s = d.st.get(b.id); if (s && s.k === 'wait' && s.g) { const r = ecIdleRow(d, s.g, seen); if (r) return r; } }
  return '';
}

/**
 * A split road network behind good g's waiting buildings `cons`: you hold g (in storage, at a maker), but on roads that
 * don't join those of some of the buildings waiting for it, so no Hauler can carry it there. { from (the building
 * holding the most of it), to (a waiting one cut off from all of it), n (how many are) } or null.
 */
function ecSplit(g, cons) {
  const src = S.buildings.filter((s) => !s.dead && s.owner === ME && s.built && !cons.includes(s) && supplyOf(s, g) >= 1);
  if (!src.length) return null;
  const cut = cons.filter((b) => !(b.unlinked && needsRoad(b)) && !src.some((s) => roadLinked(s, b)));
  if (!cut.length) return null;
  // (the one holding most, storage first)
  src.sort((a, c) => (BDEFS[c.type].store ? 1 : 0) - (BDEFS[a.type].store ? 1 : 0) || supplyOf(c, g) - supplyOf(a, g) || a.id - c.id);
  return { from: src[0].id, to: cut[0].id, n: cut.length };
}

/**
 * The bottlenecks, worst first: [{ g, s (HTML), chain, at (a building to go to), acts: { haul, prio: row, build: type,
 * join: 'from:to' }, join (ecSplit's), w (weight) }].
 */
function ecProblems(d, mine) {
  const out = [], H = ecHaulers(), fdy = ecFoundry(), auto = wfAutoOrder(ME), top = wfLadder(auto)[0];
  const foundryWaits = mine.find((b) => b.built && BDEFS[b.type].bots && d.st.get(b.id)?.k === 'wait');
  const haulWords = `${H.n} Hauler${H.n === 1 ? '' : 's'} for ${H.blds} building${H.blds === 1 ? '' : 's'}`;
  // The quick actions for a cause (goodWhy's or outWhy's: insight.js) and the maker type behind it.
  const acts = (c, g) => {
    const a = {};
    if (!c) return a;
    const at = c.at ? getE(c.at) : null;
    // (more Haulers help only where they're too few or all busy: not where the roads don't join up)
    if (fdy && ((/busy/.test(c.text) && /carrier|Hauler/.test(c.text)) || /but no Hauler/.test(c.text))) a.haul = fdy.id;
    if (/no worker|unstaffed|no Worker/i.test(c.text)) { const row = ecIdleRow(d, g); if (row && row !== top) a.prio = row; }
    if (c.build && insCanBuild(c.build) && siteCount(ME) < MAX_SITES) a.build = c.build;
    return a;
  };
  for (const g of d.goods) {
    const D = d.gd[g];
    // 1. Buildings (and sites) waiting for g.
    const cons = D.waitB.length ? D.waitB : D.have < 1 ? D.sites : [];
    if (cons.length) {
      const c = goodWhy(g, cons[0], 0, new Set([g]), 'it');
      const types = [...new Set(cons.map((b) => b.type))], who = !D.waitB.length ? `${cons.length} building site${cons.length === 1 ? '' : 's'}` : types.length === 1 ? ecPl(types[0], cons.length) : `${cons.length} buildings`;
      const busy = c && /busy/.test(c.text) && /carrier|Hauler/.test(c.text);
      const s = `<b>${ecEsc(who)} wait${cons.length === 1 && D.waitB.length ? 's' : ''} for ${goodN(g, 2)}</b>: ${c ? ecEsc(c.text) : 'none on hand'}${busy ? ` (${haulWords})` : ''}`;
      const w = 10 * cons.length + (foundryWaits && d.st.get(foundryWaits.id).g === g ? 60 : 0) + (D.have < 1 ? 15 : 0) + (c && c.ok ? -20 : 0);
      const a = acts(c, g);
      let split = D.waitB.length && D.have >= 1 ? ecSplit(g, D.waitB) : null;
      // (out of g because its maker waits behind a split: "Chips short ← the Chip Fab has no Crystal, in a Command Base no road joins to it")
      if (!split && c && /no road joins/.test(c.text)) for (const m of D.makers) { const q = d.st.get(m.id); if (q && q.k === 'wait' && q.g && (split = ecSplit(q.g, [m]))) break; }
      if (split) { delete a.haul; a.join = `${split.from}:${split.to}`; } // (Haulers can't cross from one road network to another)
      out.push({ g, s, chain: D.have < 1 ? ecChain(d, g) : null, at: (c && c.at) || cons[0].id, acts: a, join: split, w });
    }
    // 2. Makers with their output full.
    const full = D.makers.filter((b) => d.st.get(b.id)?.k === 'full');
    if (full.length) {
      const r = outWhy(full[0]);
      const s = `<b>${ecEsc(ecPl(full[0].type, full.length))} output full</b>: ${r ? ecEsc(r.text.replace(/\.$/, '')) : 'waiting for a Hauler'}${r && r.soft ? ` (${haulWords})` : ''}`;
      const a = {};
      if (fdy && (!r || r.soft || /no Hauler/.test(r.text))) a.haul = fdy.id;
      out.push({ g, s, at: r && r.road ? full[0].id : full[0].id, acts: a, w: 8 * full.length + (r && r.road ? 6 : 0) });
    }
    // 3. Makers without a road.
    const road = D.makers.filter((b) => d.st.get(b.id)?.k === 'road');
    if (road.length) out.push({ g, s: `<b>${ecEsc(ecPl(road[0].type, road.length))} without a road</b>: Haulers can't fetch the ${goodN(g, 2)}. Tap it → Lay road.`, at: road[0].id, acts: {}, w: 9 * road.length });
    // 4. Used faster than it's made, and running low.
    if (!cons.length && D.net < -0.3 && D.have > 0 && D.have / -D.net < 8) {
      const idle = D.makers.filter((b) => d.st.get(b.id)?.k === 'staff'), row = idle.length ? wfRowOf(idle[0].type) : '';
      const t = MAIN_MAKER[g] && insMakers(g).includes(MAIN_MAKER[g]) ? MAIN_MAKER[g] : insMakers(g)[0];
      const a = {};
      if (row && row !== top) a.prio = row;
      else if (t && insCanBuild(t) && siteCount(ME) < MAX_SITES && !D.makers.some((b) => d.st.get(b.id)?.k !== 'work')) a.build = t;
      const want = D.sites.length ? `; ${D.sites.length} site${D.sites.length === 1 ? '' : 's'} still owed it` : '';
      out.push({ g, s: `<b>${GOOD[g].name}: making ${ecFmt(D.made)}/min, using ${ecFmt(D.used)}/min</b>, empty in ${ecEmptyIn(D.have, D.net)}${want}${idle.length ? `: ${ecEsc(ecPl(idle[0].type, idle.length))} unstaffed` : ''}`, at: (idle[0] || D.makers[0] || {}).id || 0, acts: a, w: 5 + 12 / Math.max(0.5, D.have / -D.net) });
    }
    // 5. Makers of a good the colony is short of standing without a Worker (and nothing above said so).
    const unst = D.makers.filter((b) => d.st.get(b.id)?.k === 'staff');
    if (unst.length && (cons.length === 0) && (D.have < WANT_LOW || D.net < 0) && !out.some((p) => p.g === g)) {
      const row = wfRowOf(unst[0].type);
      out.push({ g, s: `<b>${ecEsc(ecPl(unst[0].type, unst.length))} unstaffed</b>: ${GOOD[g].name} ${D.have < 1 ? 'is out' : 'runs low'}. ${wfFree().idle ? 'A free Worker goes where the ladder says.' : 'No Worker is free.'}`, at: unst[0].id, acts: row && row !== top ? { prio: row } : {}, w: 4 * unst.length });
    }
  }
  // (the colony's worst shortage, the one its goods-bar chip is ringed for, leads: insightColony, insight.js)
  const worst = typeof insightColony === 'function' ? insightColony() : null;
  if (worst) for (const p of out) if (p.g === worst.g) { p.w += 100; break; }
  return out.sort((a, c) => c.w - a.w);
}

/* ------------------------------------------------------------------ the panel */

/** Open the Economy panel: on `tab` ('good', 'flow' or 'hist'), and on This good at good g. */
function openEconomy(tab, g) {
  if (!UI.inGame || !S || !S.players[ME]) return;
  setMode('normal');
  if (g && GOOD[g]) UI.ecGood = g;
  if (!UI.ecGood || !ecGoods().includes(UI.ecGood)) UI.ecGood = (typeof insightColony === 'function' && insightColony()?.g) || 'cement';
  UI.ecTab = tab || UI.ecTab || 'good';
  UI.ecSide = UI.ecSide || 'make';
  EC.pg = 0; EC.d = null;
  openSheet('econ', 0, `<div class="sheet-title"><div><h3>Economy</h3></div></div>
    <div class="ec-top"><div class="seg" id="ec-tabs">${EC_TABS.map(([k, l]) => `<button type="button" data-t="${k}">${l}</button>`).join('')}</div>
      <div class="ec-key" id="ec-key" aria-label="Map key">${['work', 'wait', 'full', 'staff', 'road'].map((k) => `<span style="--c:${EC_ST[k][1]}"><i></i>${EC_ST[k][0]}</span>`).join('')}</div></div>
    <div id="ec-body"></div>`);
  document.body.classList.add('sheet-econ');
  $('ec-tabs').onclick = (e) => { const b = e.target.closest('[data-t]'); if (!b || b.dataset.t === UI.ecTab) return; sfx('click'); UI.ecTab = b.dataset.t; ecBuild(); };
  const body = $('ec-body');
  body.addEventListener('pointerdown', () => { UI.ecHold = performance.now(); });
  body.addEventListener('pointerup', () => { UI.ecHold = performance.now() - 450; });
  body.onclick = ecClick;
  ecBuild();
}

/** Lay out the tab showing (its parts are filled in by refreshEconomy). */
function ecBuild() {
  for (const b of $('ec-tabs').children) b.classList.toggle('on', b.dataset.t === UI.ecTab);
  $('ec-key').hidden = UI.ecTab === 'hist';
  if (S.mission && (UI.ecTab === 'flow' || (UI.ecTab === 'good' && UI.ecGood === 'alloy'))) S.mission.ecSeen = 1; // (a mission's goal: Hot Metal, js/missions.js)
  const body = $('ec-body');
  body.className = 'ec-on-' + UI.ecTab;
  EC.pg = 0;
  if (UI.ecTab === 'hist') {
    body.innerHTML = '<div class="ec-hist" id="ec-hist"></div>';
    $('st-body').innerHTML = ''; // (one copy of the graphs at a time: their ids)
    UI.stats = UI.stats || { good: 'alloy', type: null };
    UI.stats.econ = UI.stats.econ || 'output';
    UI.stats.mil = UI.stats.mil || 'army';
    renderStats($('ec-hist'));
    UI.ecHistN = S.hist ? S.hist.t.length : 0;
    return;
  }
  if (UI.ecTab === 'flow') {
    body.innerHTML = `<div class="ec-grid ec-grid2">
      <section class="ec-col"><div class="section-label">Supply chain <span class="label-note">thicker: more a minute · red: something waits for it · tap a good</span></div><div class="ec-flow big" id="ec-flow"></div></section>
      <section class="ec-col"><div class="section-label">Bottlenecks <span class="label-note" id="ec-bn"></span></div><div class="ec-probs" id="ec-probs"></div></section></div>`;
  } else {
    body.innerHTML = `<div class="ec-grid ec-grid3">
      <section class="ec-col"><div class="ec-pick" id="ec-pick">${ecGoods().map((g) => `<button type="button" data-g="${g}" title="${GOOD[g].name}" aria-label="${GOOD[g].name}"><i class="gi ${g}"></i></button>`).join('')}</div>
        <div id="ec-sum"></div></section>
      <section class="ec-col"><div class="section-label">Its chain <span class="label-note">made from ← it → goes into</span></div><div class="ec-flow" id="ec-flow"></div>
        <div class="section-label">Problems <span class="label-note" id="ec-bn"></span></div><div class="ec-probs" id="ec-probs"></div></section>
      <section class="ec-col"><div class="seg" id="ec-side"><button type="button" data-v="make">Made by</button><button type="button" data-v="use">Used by</button></div>
        <div class="wf-list ec-list" id="ec-list"></div><div class="wf-pager" id="ec-pager"></div></section></div>`;
  }
  refreshEconomy(true);
}

/** The panel's taps (one listener; its parts are rebuilt as the game moves). */
function ecClick(e) {
  const q = e.target.closest('[data-qa]');
  if (q) { ecAction(q.dataset.qa, q.dataset.v); return; }
  const gb = e.target.closest('[data-g]');
  if (gb && (gb.closest('#ec-pick') || gb.closest('#ec-flow'))) {
    sfx('click');
    UI.ecGood = gb.dataset.g; UI.ecTab = 'good';
    ecBuild();
    return;
  }
  const sd = e.target.closest('#ec-side [data-v]');
  if (sd) { sfx('click'); UI.ecSide = sd.dataset.v; EC.pg = 0; refreshEconomy(true); return; }
  const pg = e.target.closest('[data-pg]');
  if (pg) { sfx('click'); EC.pg += +pg.dataset.pg; refreshEconomy(true); return; }
  const at = e.target.closest('[data-at]');
  if (at) wfGoTo(getE(+at.dataset.at));
}

/** A quick action: only orders that exist already (or Build, which is the interface only). */
function ecAction(k, v) {
  if (k === 'haul') {
    const f = getE(+v);
    if (!f || f.dead || f.owner !== ME) { sfx('error'); return; }
    act('foundryOrder', [f.id, 'hauler', 3], () => { sfx('order'); toast('3 Haulers ordered at the Bot Foundry: they join your roads as they\'re built.', 'good'); EC.d = null; refreshEconomy(true); });
  } else if (k === 'prio') {
    const order = wfLadder(wfAutoOrder(ME)).filter((r) => r !== v);
    act('wfOrder', [[v].concat(order)], () => { sfx('click'); toast(`${WF_ROW[v].name} to the top of the Workforce ladder (Manual): free Workers go there first. Workforce (Shift+W) changes it back.`, 'info'); EC.d = null; refreshEconomy(true); });
  } else if (k === 'build') {
    if (!BDEFS[v] || !insCanBuild(v)) { sfx('error'); return; }
    sfx('click');
    closeSheet();
    openBuildMenu();
    enterPlaceMode(v);
  } else if (k === 'join') ecJoin(v);
}

/* ------------------------------------------------------------------ Join the roads */

/** Building ids 'from:to' (ecSplit's) as buildings of yours still there, or null. */
function ecJoinEnds(v) {
  const [a, b] = String(v).split(':').map((x) => getE(+x));
  return a && b && !a.dead && !b.dead && a.owner === ME && b.owner === ME ? { a, b } : null;
}

/** "the Command Base's roads", "the Fab's". */
function ecRoadsOf(b) { return `the ${BDEFS[b.type].name}'s`; }

/** The new road a join needs, in words: "Lay road: 4 tiles and a Ramp, 3.8 Cement, 1 Fiber". */
function ecJoinCost(r) {
  const n = r.add.length, m = r.ramps.length;
  return `Lay road: ${n ? `${n} tile${n === 1 ? '' : 's'}` : ''}${n && m ? ' and ' : ''}${m ? (m === 1 ? 'a Ramp' : `${m} Ramps`) : ''}${Object.keys(r.cost).length ? ', ' + costText(r.cost) : ''}`;
}

/** A join's gap: the tiles of its route with no road yet (to lay, a Ramp to build, or planned already). */
function ecGap(r) {
  const rampSite = (t) => { const b = S.bAt[t] ? getE(S.bAt[t]) : null; return !!b && b.type === 'ramp' && !b.built; };
  return r.tiles ? r.tiles.filter((t) => r.add.includes(t) || r.ramps.includes(t) || (S.plan[t] && !S.road[t]) || rampSite(t)) : [];
}

/** Why no road joins them, and what would: a plain sentence (r: roadJoinRoute's { why }). */
function ecJoinWhy(e, r) {
  return `No road can join ${ecRoadsOf(e.a)} roads to ${ecRoadsOf(e.b)}: ${r.why}. A bridge (Paths → Bridges, G) or a Ramp (Paths → Ramps, V) where it's narrow, a Viaduct across a valley (Build), or a Port and a Ferry would; or try Paths → Route to (Z) from another spot.`;
}

/**
 * Join the roads (a split-road bottleneck's quick action): the shortest road between the two networks (roadJoinRoute,
 * world.js) is put in Paths as a plan, as Route to does: outlined in red on the map (ecDrawJoin), the map gliding to
 * it, its cost in the banner, and nothing spent until Build (ORDERS.paths, like any plan made in Paths). Clear or Done
 * drops it.
 */
function ecJoin(v) {
  const e = ecJoinEnds(v);
  if (!e) { sfx('error'); return; }
  const r = roadJoinRoute(ME, e.a, e.b);
  if (r.why) { sfx('error'); toast(ecJoinWhy(e, r), 'warn'); return; }
  if (r.joined) { sfx('click'); toast(`The roads are joined now: Haulers can carry from the ${BDEFS[e.a.type].name} to the ${BDEFS[e.b.type].name}.`, 'info'); EC.d = null; refreshEconomy(true); return; }
  const gap = ecGap(r);
  const mid = gap.length ? gap[gap.length >> 1] : r.tiles[r.tiles.length >> 1];
  if (!r.add.length && !r.ramps.length) {
    // (already planned: the workers just haven't got there yet)
    sfx('click');
    UI.joinGap = { tiles: gap, until: performance.now() + 6000 };
    closeSheet();
    UI.glide = { x: (mid % S.W) + 0.5, y: ((mid / S.W) | 0) + 0.5, t: 0.5 };
    toast(`A road joining ${ecRoadsOf(e.a)} roads to ${ecRoadsOf(e.b)} is planned already: ${r.planned} tile${r.planned === 1 ? '' : 's'} on the way wait${r.planned === 1 ? 's' : ''} for Workers (outlined in red). Nothing more to plan.`, 'info');
    return;
  }
  sfx('click');
  closeSheet();
  if (R.mode !== 'road') setMode('road');
  UI.roadMode = 'road'; UI.route = true; UI.routeGhost = null;
  draftReset();
  paintFlagsReset();
  UI.stroke = []; UI.draft.strokes.push(UI.stroke);
  for (const t of r.ramps) draftOp(UI.stroke, t, 'ramp');
  for (const t of r.add) draftOp(UI.stroke, t, 'add');
  UI.routePrev = UI.stroke; // (tap somewhere else and Route to plans that instead, as after any route)
  UI.joinGap = { tiles: gap, draft: true };
  showRoadBanner(`<b>Join the roads</b> (outlined in red): ${ecJoinCost(r)}, joining ${ecRoadsOf(e.a)} roads to ${ecRoadsOf(e.b)}. Tap <b>Build</b> to plan it, or <b>Clear</b> to drop it.`, true);
  // The map glides to the gap, in the band between the Paths banner and the tools below (whichever way it's docked).
  const ban = $('banner').getBoundingClientRect(), bar = $('bottombar').getBoundingClientRect();
  const top = ban.bottom < R.h * 0.6 ? ban.bottom : $('topbar').getBoundingClientRect().bottom;
  const bot = ban.top > R.h * 0.4 ? ban.top : bar.top > R.h * 0.5 ? bar.top : R.h;
  const x = (mid % S.W) + 0.5, y = ((mid / S.W) | 0) + 0.5;
  UI.glide = { x, y: y - ((top + bot) / 2 - R.h / 2) / R.cam.z, t: 0.5 };
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { centerOn(UI.glide.x, UI.glide.y); UI.glide = null; }
}

/**
 * On This good, the gap behind a split there (its route found once, a moment after the tab shows it, and again only
 * when the roads, plans, land or buildings change): roadJoinRoute's result with its { tiles, key }, or null.
 */
function ecJoinFor(p) {
  const e = p && p.join && ecJoinEnds(`${p.join.from}:${p.join.to}`);
  if (!e) return null;
  const key = [e.a.id, e.b.id, S.roadVer, S.planVer, S.territoryVer, S.buildings.length].join(':');
  if (EC.join && EC.join.key === key) return EC.join;
  if (!EC.joinWait) {
    EC.joinWait = true;
    setTimeout(() => {
      EC.joinWait = false;
      if (!S || UI.sheetKind !== 'econ') return;
      const r = roadJoinRoute(ME, e.a, e.b);
      r.key = key; r.e = e;
      r.gap = ecGap(r);
      EC.join = r;
      refreshEconomy(true);
    }, 30);
  }
  return null;
}

/** A problem's line, its chain and its quick actions (on This good, a split's gap in words instead of Join the roads). */
function ecProbHTML(p, here) {
  const a = p.acts || {};
  let note = '';
  if (a.join && here) {
    const r = ecJoinFor(p);
    note = !r ? 'Finding the gap…' : r.why ? ecJoinWhy(r.e, r) : r.joined ? '' : !r.add.length && !r.ramps.length ? `The road joining them is planned: ${r.planned} tile${r.planned === 1 ? '' : 's'} wait${r.planned === 1 ? 's' : ''} for Workers (red on the map).`
      : `The gap is outlined in red on the map: ${ecJoinCost(r)}. Whole economy → Join the roads plans it.`;
  }
  const btns = (a.join && !here ? `<button type="button" class="btn small" data-qa="join" data-v="${a.join}">Join the roads</button>` : '') +
    (a.haul ? `<button type="button" class="btn small" data-qa="haul" data-v="${a.haul}">Make more Haulers</button>` : '') +
    (a.prio ? `<button type="button" class="btn small" data-qa="prio" data-v="${a.prio}">Prioritise this</button>` : '') +
    (a.build ? `<button type="button" class="btn small" data-qa="build" data-v="${a.build}">Build ${aOrAn(BDEFS[a.build].name)}</button>` : '');
  return `<div class="ec-pr" style="--c:${GOOD[p.g].color}"><button type="button" class="ec-prt"${p.at ? ` data-at="${p.at}"` : ''}><i class="gi ${p.g}"></i><span>${p.s}${p.chain && p.chain.length > 2 ? `<small class="ec-chain">${p.chain.map(ecEsc).join(' ← ')}</small>` : ''}${note ? `<small class="ec-chain ec-gap">${ecEsc(note)}</small>` : ''}</span></button>${btns ? `<div class="ec-qa">${btns}</div>` : ''}</div>`;
}

/** The chain diagram: goods (all, or those in `only`) as nodes in columns, links input → output and to the ends. */
function ecFlowHTML(d, only, focus) {
  const goods = d.goods.filter((g) => !only || only.has(g));
  // (on This good, the ends only for the good itself)
  const links = d.links.filter((l) => goods.includes(l.a) && (!only || (l.sink ? !focus || l.a === focus : only.has(l.b))));
  const sinks = d.sinks.filter((k) => links.some((l) => l.b === k));
  // Columns by tier, the ends last; in each, goods ordered by where their inputs sit (fewer crossings).
  const maxT = Math.max(0, ...goods.map((g) => d.tier[g]));
  const cols = [];
  for (let t = 0; t <= maxT; t++) cols.push(goods.filter((g) => d.tier[g] === t));
  if (sinks.length) cols.push(sinks);
  const pos = {};
  cols.forEach((col, ci) => {
    if (ci > 0 && ci <= maxT) {
      const y = (g) => { const ins = links.filter((l) => l.b === g && pos[l.a]); return ins.length ? ins.reduce((a, l) => a + pos[l.a].y, 0) / ins.length : 0.5; };
      col.sort((a, b) => y(a) - y(b));
    }
    col.forEach((g, i) => { pos[g] = { x: cols.length > 1 ? 0.07 + (0.86 * ci) / (cols.length - 1) : 0.5, y: (i + 0.5) / col.length }; });
  });
  const maxW = Math.max(1, ...links.map((l) => l.w));
  const W = 1000, Hh = 600;
  const path = (l) => {
    const a = pos[l.a], b = pos[l.b];
    if (!a || !b) return '';
    const x1 = a.x * W + 52, x2 = b.x * W - 52, y1 = a.y * Hh, y2 = b.y * Hh, mx = (x1 + x2) / 2;
    const wd = 1.5 + 7 * Math.sqrt(l.w / maxW), col = l.red ? '#ff4d6a' : l.sink ? 'rgba(200,205,220,0.55)' : GOOD[l.a].color;
    return `<path d="M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}" stroke="${col}" stroke-width="${wd.toFixed(1)}" fill="none" vector-effect="non-scaling-stroke" stroke-opacity="${l.red ? 1 : l.w > 0 ? 0.85 : 0.35}"${l.red ? ' class="red"' : l.w > 0 ? ' class="go"' : ''}><title>${GOOD[l.a].name} → ${GOOD[l.b] ? GOOD[l.b].name : EC_SINK[l.b]}: about ${ecFmt(l.w)} a minute${l.red ? ' (something waits for it)' : ''}</title></path>`;
  };
  const node = (g) => {
    const p = pos[g];
    if (EC_SINK[g]) return `<div class="ec-node sink" style="left:${p.x * 100}%;top:${p.y * 100}%"><b>${EC_SINK[g]}</b></div>`;
    const D = d.gd[g], s = ecGoodState(D);
    return `<button type="button" class="ec-node ${s}${focus === g ? ' focus' : ''}" data-g="${g}" style="left:${p.x * 100}%;top:${p.y * 100}%;--c:${GOOD[g].color}" title="${GOOD[g].name}: ${Math.floor(D.have)} on hand, made ${ecFmt(D.made)} and used ${ecFmt(D.used)} a minute">` +
      `<span class="ec-nn"><i class="gi ${g}"></i><span class="ec-nt">${GOOD[g].name}</span></span><span class="ec-nv"><b>${Math.floor(D.have)}</b><em class="up">+${ecFmt(D.made)}</em><em class="down">−${ecFmt(D.used)}</em></span></button>`;
  };
  return `<svg class="ec-links" viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="none" aria-hidden="true">${links.map(path).join('')}</svg>` + goods.map(node).join('') + sinks.map(node).join('');
}

/** Good g's chain both ways: what it's made from (down to the raw goods) and what it goes into (on to the end). */
function ecChainSet(d, g) {
  const set = new Set([g]);
  const up = (x) => { for (const l of d.links) if (!l.sink && l.b === x && !set.has(l.a)) { set.add(l.a); up(l.a); } };
  const down = (x) => { for (const l of d.links) if (!l.sink && l.a === x && !set.has(l.b)) { set.add(l.b); down(l.b); } };
  up(g); down(g);
  // (where there's no factory of yours yet, the recipe: what its main maker would take)
  if (set.size === 1) for (const t of insMakers(g)) { const dd = BDEFS[t]; if (dd.inp && dd.make) for (const i in dd.inp) if (d.gd[i]) set.add(i); }
  return set;
}

/** A small line of the stock over the last ten minutes (SVG). */
function ecSpark(v, color) {
  if (!v || v.length < 2) return '<p class="hint">The graph starts once the game has a few samples.</p>';
  const w = 100, h = 28, top = Math.max(1, ...v), n = v.length;
  const pts = v.map((x, k) => `${((k / (n - 1)) * w).toFixed(1)},${(h - 2 - (x / top) * (h - 4)).toFixed(1)}`).join(' ');
  return `<div class="ec-spark"><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><polyline points="0,${h} ${pts} ${w},${h}" fill="${color}" fill-opacity="0.14" stroke="none"/>` +
    `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg><span>On hand, last ${Math.max(1, Math.round(Math.min(600, (n - 1) * HIST_STEP) / 60))} min · most ${Math.round(top)}</span></div>`;
}

/**
 * On a desktop the panel never scrolls: while it would, the last problem shown goes (into "and N more"). Only after the
 * list was rewritten (its html kept in dataset.html, so the same list isn't put back the next time round).
 */
function ecFit() {
  const body = $('sheet-body'), el = $('ec-probs');
  if (!el || innerWidth < 1000 || innerHeight < 520) return;
  let cut = 0;
  while (body.scrollHeight - body.clientHeight > 1 && el.querySelectorAll('.ec-pr').length > 1) {
    const all = el.querySelectorAll('.ec-pr');
    all[all.length - 1].remove();
    cut++;
  }
  if (!cut) return;
  const more = el.querySelector('p.hint.ec-more');
  const n = cut + (more ? +more.dataset.n : 0);
  if (more) more.remove();
  el.insertAdjacentHTML('beforeend', `<p class="hint ec-more" data-n="${n}">and ${n} more${UI.ecTab === 'flow' ? ': tap a good for its own' : ''}.</p>`);
  while (body.scrollHeight - body.clientHeight > 1 && el.querySelectorAll('.ec-pr').length > 1) { const all = el.querySelectorAll('.ec-pr'); all[all.length - 1].remove(); const m = el.querySelector('.ec-more'); m.dataset.n = +m.dataset.n + 1; m.textContent = `and ${m.dataset.n} more.`; }
}

/** Bring the panel up to date (from refreshSheet, four times a second; the figures change at most twice a second). */
function refreshEconomy(now) {
  if (UI.sheetKind !== 'econ' || !$('ec-body')) return;
  if (!now && UI.ecHold && performance.now() - UI.ecHold < 500) return;
  const set = (id, html) => { const el = $(id); if (el && el.dataset.html !== html) { el.dataset.html = html; el.innerHTML = html; if (id === 'ec-probs') EC.fit = true; } };
  if (UI.ecTab === 'hist') {
    // (the graphs again when a new sample is in)
    const n = S.hist ? S.hist.t.length : 0;
    if (n !== UI.ecHistN) { UI.ecHistN = n; renderStats($('ec-hist')); }
    return;
  }
  const d = ecData();
  if (UI.ecTab === 'flow') {
    set('ec-flow', ecFlowHTML(d, null, null));
    const most = innerHeight <= 760 ? 4 : 5;
    $('ec-bn').textContent = d.probs.length ? `${d.probs.length} · tap one to go there` : '';
    set('ec-probs', d.probs.length ? d.probs.slice(0, most).map((p) => ecProbHTML(p)).join('') + (d.probs.length > most ? `<p class="hint ec-more" data-n="${d.probs.length - most}">and ${d.probs.length - most} more: tap a good for its own.</p>` : '')
      : '<p class="hint">None: nothing waits for a good, no maker is full or cut off, and nothing is running out.</p>');
    if (EC.fit) { EC.fit = false; ecFit(); }
    return;
  }
  // This good.
  const g = d.goods.includes(UI.ecGood) ? UI.ecGood : d.goods[0], D = d.gd[g], G = GOOD[g];
  for (const b of $('ec-pick').children) b.classList.toggle('on', b.dataset.g === g);
  const s = ecGoodState(D), empty = ecEmptyIn(D.have, D.net);
  const netWords = D.net < -0.05 ? (empty ? `empty in ${empty}` : 'none left') : D.net > 0.05 ? 'growing' : 'steady';
  const stored = D.makers.reduce((a, b) => a + (BDEFS[b.type].store ? 0 : b.stock[g] || 0), 0);
  set('ec-sum', `<div class="ec-name" style="--c:${G.color}"><i class="gi ${g}"></i><b>${G.name}</b><span class="ec-badge ${s}">${s === 'short' ? 'Short' : s === 'low' ? 'Running low' : s === 'up' ? 'Growing' : 'Steady'}</span></div>
    <div class="gs-stats ec-stats"><div><b>${Math.floor(D.have)}</b><span>on hand</span></div><div><b class="up">+${ecFmt(D.made)}</b><span>made / min</span></div>
      <div><b class="down">−${ecFmt(D.used)}</b><span>used / min</span></div><div><b class="${D.net > 0.05 ? 'up' : D.net < -0.05 ? 'down' : ''}">${ecSigned(D.net)}</b><span>${netWords}</span></div></div>
    ${ecSpark(D.hist, G.color)}
    <div class="kv"><span>Waiting at makers for pickup</span><span>${stored}</span></div>
    <div class="kv"><span>Waiting for it now</span><span>${D.waitB.length + D.sites.length ? `${D.waitB.length ? `${D.waitB.length} building${D.waitB.length === 1 ? '' : 's'}` : ''}${D.waitB.length && D.sites.length ? ', ' : ''}${D.sites.length ? `${D.sites.length} site${D.sites.length === 1 ? '' : 's'}` : ''}` : 'nothing'}</span></div>
    <p class="hint ec-desc">${G.desc}</p>`);
  set('ec-flow', ecFlowHTML(d, ecChainSet(d, g), g));
  const probs = d.probs.filter((p) => p.g === g || (p.chain && p.chain.some((c) => c.startsWith(goodN(g, 2) + ' '))));
  $('ec-bn').textContent = probs.length ? String(probs.length) : '';
  set('ec-probs', probs.length ? probs.slice(0, 2).map((p) => ecProbHTML(p, true)).join('') : `<p class="hint">None for ${G.name}${s === 'up' ? ': you make more than you use' : ''}.</p>`);
  // The makers or the users, a page at a time (problems first).
  const side = UI.ecSide === 'use' ? 'use' : 'make';
  for (const b of $('ec-side').children) { b.classList.toggle('on', b.dataset.v === side); b.textContent = `${b.dataset.v === 'make' ? 'Made by' : 'Used by'} ${b.dataset.v === 'make' ? D.makers.length : D.users.length + (D.sites.length ? 1 : 0)}`; }
  const rows = (side === 'make' ? D.makers : D.users).slice().sort((a, c) => EC_BAD[d.st.get(a.id)?.k || 'idle'] - EC_BAD[d.st.get(c.id)?.k || 'idle'] || a.id - c.id);
  const page = innerHeight <= 760 ? 6 : 8, lines = [];
  if (side === 'use' && D.sites.length) lines.push(`<button type="button" class="wf-li" data-at="${D.sites[0].id}" style="--c:#ffb24a"><i></i><span><b>${D.sites.length} building site${D.sites.length === 1 ? '' : 's'}</b> still owed ${G.name}${D.have < 1 ? ', none on hand' : ''}</span></button>`);
  for (const b of rows) { const q = d.st.get(b.id) || { k: 'idle', s: '' }; lines.push(`<button type="button" class="wf-li" data-at="${b.id}" style="--c:${EC_ST[q.k][1]}"><i></i><span><b>${BDEFS[b.type].name}</b> ${ecEsc(q.s)}</span></button>`); }
  const pages = Math.max(1, Math.ceil(lines.length / page));
  EC.pg = Math.max(0, Math.min(pages - 1, EC.pg));
  const part = lines.slice(EC.pg * page, EC.pg * page + page);
  const none = side === 'make' ? `Nothing of yours makes ${G.name}${insMakers(g).length ? `: build ${aOrAn(BDEFS[MAIN_MAKER[g] && insMakers(g).includes(MAIN_MAKER[g]) ? MAIN_MAKER[g] : insMakers(g)[0]].name)}` : ''}.` : `Nothing of yours uses ${G.name} yet.`;
  set('ec-list', part.length ? part.join('') : `<p class="hint">${none}</p>`);
  set('ec-pager', pages > 1 ? `<button type="button" class="btn small ghost" data-pg="-1"${EC.pg ? '' : ' disabled'} aria-label="Earlier">◀</button><span>${EC.pg * page + 1}–${Math.min(lines.length, EC.pg * page + page)} of ${lines.length}</span><button type="button" class="btn small ghost" data-pg="1"${EC.pg < pages - 1 ? '' : ' disabled'} aria-label="Later">▶</button>`
    : `<span>${lines.length ? 'Tap one to go to it' : ''}</span>`);
  if (EC.fit) { EC.fit = false; ecFit(); }
}

/* ------------------------------------------------------------------ the map while it's open */

/**
 * The goods your robots carried over the last minute (R.gf, display only: sampleGoodsFlow in render.js), as lines
 * along the roads in each good's colour, wider the more went over, with a dash running along them; on This good only
 * that good's. Drawn on the ground, under the buildings.
 */
function ecDrawFlow(ctx, ox, oy, z, v0, v1) {
  const F = R.gf;
  if (!F || F.of !== S) return;
  const W = S.W, H = S.H, G = GOODS.length, rail = S.rail, only = UI.ecTab === 'good' ? F.gi[UI.ecGood] : -1;
  const val = only >= 0 ? (t) => F.acc[t * G + only] : (t) => F.tot[t];
  const i0 = Math.max(0, Math.floor(v0.x) - 1), i1 = Math.min(W - 1, Math.ceil(v1.x) + 1), j0 = Math.max(0, Math.floor(v0.y) - 1), j1 = Math.min(H - 1, Math.ceil(v1.y) + 1);
  const on = (t) => val(t) >= GFLOW_MIN && (S.road[t] || (rail && rail[t]));
  const segs = new Map(), h = z / 2;
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const t = j * W + i;
    if (!on(t)) continue;
    const v = val(t), b = v < GFLOW_STEPS[0] ? 0 : v < GFLOW_STEPS[1] ? 1 : v < GFLOW_STEPS[2] ? 2 : v < GFLOW_STEPS[3] ? 3 : 4;
    const key = (only >= 0 ? only : F.main[t]) * 5 + b;
    let L = segs.get(key);
    if (!L) segs.set(key, (L = []));
    const cx = ox + i * z + h, cy = oy + j * z + h, n0 = L.length;
    if (i + 1 < W && on(t + 1)) L.push(cx, cy, cx + h, cy);
    if (i > 0 && on(t - 1)) L.push(cx, cy, cx - h, cy);
    if (j + 1 < H && on(t + W)) L.push(cx, cy, cx, cy + h);
    if (j > 0 && on(t - W)) L.push(cx, cy, cx, cy - h);
    if (L.length === n0) L.push(cx - 0.5, cy, cx + 0.5, cy);
  }
  if (!segs.size) return;
  const width = (b) => Math.min(z * 0.6, Math.max([2, 3, 4.5, 6, 8][b], z * [0.08, 0.13, 0.19, 0.26, 0.34][b]));
  const path = (L) => { ctx.beginPath(); for (let k = 0; k < L.length; k += 4) { ctx.moveTo(L[k], L[k + 1]); ctx.lineTo(L[k + 2], L[k + 3]); } };
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(12,14,20,0.7)';
  for (const [key, L] of segs) { ctx.lineWidth = width(key % 5) + 3; path(L); ctx.stroke(); }
  for (const [key, L] of segs) { ctx.strokeStyle = GOOD[GOODS[(key / 5) | 0]].color; ctx.lineWidth = width(key % 5); path(L); ctx.stroke(); }
  // (the dash running along: goods on the move)
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.setLineDash([Math.max(2, z * 0.08), Math.max(6, z * 0.42)]);
  ctx.lineDashOffset = -R.time * z * 1.2;
  for (const [key, L] of segs) { ctx.lineWidth = Math.max(1, width(key % 5) * 0.4); path(L); ctx.stroke(); }
  ctx.restore();
}

/**
 * A ring on each building of yours that makes or uses goods, in its state's colour (EC_ST): working, waiting for an
 * input, output full, unstaffed, no road; a waiting one pulses. On This good only the good's makers and users.
 */
function ecDrawStates(ctx, ox, oy, z) {
  const d = ecData(), pulse = 0.5 + 0.5 * Math.sin(R.time * 5);
  let keep = null;
  if (UI.ecTab === 'good' && d.gd[UI.ecGood]) keep = new Set(d.gd[UI.ecGood].makers.concat(d.gd[UI.ecGood].users).map((b) => b.id));
  ctx.save();
  for (const [id, s] of d.st) {
    if (keep && !keep.has(id)) continue;
    const b = getE(id);
    if (!b || b.dead) continue;
    const x = ox + (b.x + 0.5) * z, y = oy + (b.y + 0.5) * z, col = EC_ST[s.k][1], bad = s.k !== 'work' && s.k !== 'idle' && s.k !== 'off';
    ctx.globalAlpha = s.k === 'work' ? 0.75 : s.k === 'off' || s.k === 'idle' ? 0.55 : 0.75 + 0.25 * pulse;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = Math.max(3, z * 0.1);
    ctx.beginPath(); ctx.arc(x, y, z * 0.62, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = Math.max(2, z * (bad ? 0.075 : 0.05));
    if (s.k === 'off') ctx.setLineDash([Math.max(3, z * 0.12), Math.max(3, z * 0.1)]);
    ctx.beginPath(); ctx.arc(x, y, z * 0.62, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    // (waiting: a dot of the good it waits for)
    if (s.k === 'wait' && s.g && z >= 14) {
      const r = Math.max(4, z * 0.13);
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(14,15,20,0.9)'; ctx.beginPath(); ctx.arc(x + z * 0.44, y - z * 0.44, r + 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = GOOD[s.g].color; ctx.beginPath(); ctx.arc(x + z * 0.44, y - z * 0.44, r, 0, Math.PI * 2); ctx.fill();
    }
  }
  const F = UI.wfFocus;
  if (F && performance.now() < F.until) {
    const k = (F.until - performance.now()) / 2200, x = ox + F.x * z, y = oy + F.y * z;
    ctx.globalAlpha = Math.min(1, k * 1.5);
    ctx.strokeStyle = '#fff1ec'; ctx.lineWidth = Math.max(2, z * 0.07);
    ctx.beginPath(); ctx.arc(x, y, z * (0.7 + (1 - k) * 0.6), 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

/**
 * The gap a Join the roads would fill, outlined in red on the map, each of its tiles dashed: in Paths while its plan
 * is still there to Build (ecJoin), for a few seconds after it found the join already planned, and on This good while
 * that good waits behind a split (ecJoinFor). Display only.
 */
function ecDrawJoin(ctx, ox, oy, z) {
  if (typeof UI === 'undefined') return;
  let tiles = null;
  const J = UI.joinGap;
  if (J && J.draft) {
    const d = UI.draft;
    if (R.mode === 'road' && d && J.tiles.some((t) => d.addSet.has(t) || d.ramps.has(t))) tiles = J.tiles; else UI.joinGap = null;
  } else if (J && J.until) {
    if (performance.now() < J.until) tiles = J.tiles; else UI.joinGap = null;
  }
  if (!tiles && ecMapOn() && UI.ecTab === 'good' && EC.join && EC.join.gap && EC.join.gap.length) {
    const d = ecData(), p = d.probs.find((q) => q.g === UI.ecGood && q.join && q.join.from === EC.join.e.a.id && q.join.to === EC.join.e.b.id);
    if (p) tiles = EC.join.gap;
  }
  if (!tiles || !tiles.length) return;
  const W = S.W, set = new Set(tiles), pulse = 0.75 + 0.25 * Math.sin(R.time * 4);
  ctx.save();
  // Each tile: a dashed red square (a tile still to lay).
  ctx.setLineDash([Math.max(2, z * 0.14), Math.max(2, z * 0.1)]);
  ctx.lineDashOffset = -R.time * z * 0.5;
  ctx.strokeStyle = `rgba(255,77,106,${0.8 * pulse})`; ctx.lineWidth = Math.max(1.2, z * 0.045);
  for (const t of tiles) ctx.strokeRect(ox + (t % W) * z + z * 0.18, oy + ((t / W) | 0) * z + z * 0.18, z * 0.64, z * 0.64);
  ctx.setLineDash([]);
  // Round the whole gap: its outer edges, dark under red.
  const edges = () => {
    ctx.beginPath();
    for (const t of tiles) {
      const i = t % W, j = (t / W) | 0, x = ox + i * z, y = oy + j * z;
      if (!(i > 0 && set.has(t - 1))) { ctx.moveTo(x, y); ctx.lineTo(x, y + z); }
      if (!(i < W - 1 && set.has(t + 1))) { ctx.moveTo(x + z, y); ctx.lineTo(x + z, y + z); }
      if (!set.has(t - W)) { ctx.moveTo(x, y); ctx.lineTo(x + z, y); }
      if (!set.has(t + W)) { ctx.moveTo(x, y + z); ctx.lineTo(x + z, y + z); }
    }
  };
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(12,14,20,0.7)'; ctx.lineWidth = Math.max(3.5, z * 0.13); edges(); ctx.stroke();
  ctx.strokeStyle = '#ff4d6a'; ctx.globalAlpha = pulse; ctx.lineWidth = Math.max(2, z * 0.07); edges(); ctx.stroke();
  ctx.restore();
}

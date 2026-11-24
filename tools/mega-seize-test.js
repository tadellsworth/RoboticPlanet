// Seizing megastructures (MEGA): every megastructure warbots beat to 0 is knocked out, not wrecked; its charge is lost
// and its stage kept; armed warbots holding it seize it (contested, the clock stops; its old owner can take it back the
// same way, and can't repair it meanwhile); seized, it is offline until its new owner's Haulers bring a quarter of its
// cost and a Worker brings it online; Wreck it destroys it instead, spilling crates; Arrival City is never wrecked; a
// save replays the same.
// Usage: node tools/mega-seize-test.js
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const files = ['util', 'defs', 'world', 'path', 'sim', 'ai', 'missions', 'orders'];
const source = files.map((name) => readFileSync(path.join(__dirname, '..', 'js', name + '.js'), 'utf8')).join('\n');

const out = new Function('assert', 'sfx', source + `
  const log = [];
  const TYPES = ['lance', 'sunder', 'dome', 'city', 'lift', 'gup', 'deepcore', 'atmos'];
  const run = (secs, until) => { const t0 = S.time; while (S.time < t0 + secs && !(until && until())) simStep(SIM_STEP); return S.time - t0; };
  // A fresh two-colony game with no one thinking for itself; the megastructure for colony 1 on open ground half way.
  function setup(type, seed) {
    newGame({ seed: seed || 31, mode: 'versus', players: 2, size: 1, murmur: 'off', mega: true, upWin: true, events: false });
    for (const P of S.players) P.ai = false;
    const A = getE(S.players[0].lander), B = getE(S.players[1].lander), f = BDEFS[type].foot;
    const mx = Math.round((A.x + B.x) / 2), my = Math.round((A.y + B.y) / 2);
    const free = (i, j) => { for (let y = j - 1; y <= j + f; y++) for (let x = i - 1; x <= i + f; x++) { if (!inMap(x, y)) return false; const t = tIdx(x, y); if (S.terrain[t] !== T_GROUND || S.bAt[t] || calmAt(x + 0.5, y + 0.5) || S.elev[t] !== S.elev[tIdx(i, j)]) return false; } return true; };
    let spot = null;
    for (let r = 0; r < 30 && !spot; r++) for (let j = my - r; j <= my + r && !spot; j++) for (let i = mx - r; i <= mx + r && !spot; i++) if (Math.max(Math.abs(i - mx), Math.abs(j - my)) === r && free(i, j) && S.zone[tIdx(i - 1, j)] === S.zone[tIdx(A.x, A.y)]) spot = [i, j];
    assert.ok(spot, type + ': room for it');
    for (let y = spot[1] - 1; y <= spot[1] + f; y++) for (let x = spot[0] - 1; x <= spot[0] + f; x++) { const t = tIdx(x, y); S.res[t] = 0; S.amt[t] = 0; }
    const b = addBuilding(1, type, spot[0], spot[1], true);
    computeTerritory(); computeZones && computeZones();
    return { b, A, B };
  }
  // n armed warbots of colony p by megastructure b, told to attack it (or just stand there: hold).
  function band(p, b, n, hold) {
    const f = BDEFS[b.type].foot, us = [], ring = [];
    for (let j = b.y - 1; j <= b.y + f; j++) for (let i = b.x - 1; i <= b.x + f; i++) if (inMap(i, j) && !S.bAt[tIdx(i, j)] && walkable(tIdx(i, j))) ring.push([i, j]);
    assert.ok(ring.length >= 4, 'room round it');
    for (let k = 0; k < n; k++) {
      const [i, j] = ring[Math.floor((k * ring.length) / n)], x = i + 0.5, y = j + 0.5;
      const u = addBot(p, 'warbot', i, j); u.x = x; u.y = y; u.ammo = 999;
      if (!hold) u.task = { type: 'attack', target: b.id };
      us.push(u);
    }
    return us;
  }
  const keep = (us, b) => { for (const u of us) if (!u.dead) { u.ammo = 999; u.hp = u.maxHp; if (!u.task) u.task = { type: 'attack', target: b.id }; } };
  // What each one gathers (its charge, to be lost) and builds up (its stage, kept), set before it is knocked out.
  const charge = {
    lance: (b) => { b.lOn = 1; b.lCharge = 50; b.lTime = LANCE.charge; b.lSrc = 'gen'; b.lAim = [b.x + 20, b.y]; },
    sunder: (b) => { b.sOn = 1; b.sCharge = 40; b.sTime = SUNDER.charge; b.sSrc = 'gen'; b.sMode = 'quake'; b.sAim = [b.x + 10, b.y]; },
    dome: (b) => { b.dUp = 1; b.dStr = 80; b.dCry = 10; },
    city: (b) => { b.cFuel = 30; },
    lift: (b) => { b.lfMove = 1; b.lfT = 20; b.lfPaid = 1; b.lfLoad = 'alloy'; b.lfMul = 1; b.lfBoost = 2; b.lfSend = { cement: 10 }; },
    gup: (b) => { b.gOn = 1; b.gT = 200; b.gBy = 1; b.gPow = 1; },
    deepcore: (b) => { b.dcT = DEEP.stages[1] + 30; b.dcStage = 2; b.dcAcc = { ore: 0.7 }; b.dcFuel = 40; b.dcSrc = 'gen'; },
    atmos: (b) => { b.aeT = ATMOS.stages[1] + 30; b.aeStage = 2; b.aeP = 6; b.aeFuel = 40; b.aeSrc = 'gen'; b.aeStorm = [b.x - 10, b.y]; b.aeWith = 5; },
  };
  const reset = {
    lance: (b) => !b.lOn && !b.lCharge && !b.lAim, sunder: (b) => !b.sOn && !b.sCharge && !b.sAim, dome: (b) => !b.dUp,
    city: (b) => !b.cFuel && b.cDown, lift: (b) => !b.lfMove && !b.lfT && !b.lfPaid && !b.lfBoost && !b.lfSend, gup: (b) => !b.gOn && !b.gT,
    deepcore: (b) => !b.dcFuel && !Object.keys(b.dcAcc || {}).length, atmos: (b) => !b.aeFuel && !b.aeStorm && !b.aeWith,
  };
  const stage = { deepcore: (b) => b.dcStage === 2 && b.dcT >= DEEP.stages[1], atmos: (b) => b.aeStage === 2 && b.aeT >= ATMOS.stages[1] && b.aeP === 6 };

  // 1) Every type: knocked out (not wrecked), charge lost, stage kept; its old owner can't repair or command it; held, it's seized.
  for (const type of TYPES) {
    const { b } = setup(type);
    charge[type](b);
    const def = BDEFS[type];
    b.armor = 6; // (beaten down already)
    const us = band(0, b, 6);
    const tDown = run(60, () => b.mDown || b.dead);
    assert.ok(!b.dead && b.mDown, type + ': knocked out, not wrecked');
    assert.equal(b.owner, 1, type + ': its owner kept on paper');
    assert.equal(b.armor, 0);
    assert.ok(reset[type](b), type + ': its charge is lost ' + JSON.stringify({ lOn: b.lOn, lCharge: b.lCharge, gT: b.gT, lfMove: b.lfMove, dcAcc: b.dcAcc, aeStorm: b.aeStorm }));
    if (stage[type]) assert.ok(stage[type](b), type + ': its stage is kept');
    assert.ok(applyOrder(1, 'repair', [b.id]), type + ': its old owner gets no repair');
    assert.equal(b.fixLeft || 0, 0);
    applyOrder(1, 'demolish', [b.id]);
    assert.ok(!b.dead, type + ': its old owner can\\'t dismantle it');
    if (type === 'lance') assert.ok(lanceBlocked(b), 'a knocked-out Lance can\\'t charge');
    if (type === 'gup') assert.ok(gupBlocked(b), 'nor an Uplink transmit');
    if (type === 'lift') assert.ok(liftCallWhy(b, 'alloy'), 'nor a Lift call down');
    // its warbots don't shoot it now (no Ammo spent), they stand by it
    const ammo = us.map((u) => u.ammo);
    run(3);
    assert.ok(us.every((u, k) => u.dead || u.ammo === ammo[k]), type + ': no shots at a knocked-out one');
    const tSeize = run(MEGA.cap + 15, () => b.owner === 0);
    assert.equal(b.owner, 0, type + ': seized by those holding it');
    assert.ok(b.mOff && !b.mDown, type + ': offline');
    assert.deepEqual(b.mNeed, megaFee(type), type + ': owing a quarter of its cost');
    assert.ok(b.armor >= def.armor * MEGA.armor - 0.5, type + ': at a quarter of its armor');
    if (stage[type]) assert.ok(stage[type](b), type + ': its stage still kept');
    assert.ok(needsOf(b).length > 0 && needsOf(b).every((n) => b.mNeed[n[0]] && n[1] <= b.mNeed[n[0]]), type + ': Haulers are asked for the fee');
    log.push(type + ': knocked out in ' + tDown.toFixed(1) + ' s, seized ' + tSeize.toFixed(1) + ' s later; owes ' + costText(b.mNeed));
  }

  // 2) Brought online: the fee hauled to it (a road to it), then a Worker; and the work starts again.
  for (const type of ['deepcore', 'lance', 'city']) {
    const { b, A } = setup(type, 47);
    charge[type](b);
    b.armor = 1;
    const us = band(0, b, 6);
    run(30, () => b.mDown); run(MEGA.cap + 15, () => b.owner === 0);
    assert.equal(b.owner, 0, type + ": seized " + JSON.stringify({ d: b.mDown, cap: b.mCap, by: b.mBy, armor: b.armor, live: us.filter((u) => !u.dead).map((u) => [u.x.toFixed(1), u.y.toFixed(1), footDist(b, u.x, u.y).toFixed(1), u.task && u.task.type]) }));
    for (const u of us) if (!u.dead) killBot(u);
    for (const g in b.mNeed) bump(A.stock, g, b.mNeed[g] + 20);
    for (const t of roadRouteTo(0, b) || []) setRoad(t % S.W, (t / S.W) | 0, true, 0);
    for (let k = 0; k < 3; k++) enterBuilding(addBot(0, 'hauler', A.x, A.y), A);
    const paid = run(400, () => !b.mNeed);
    assert.ok(!b.mNeed, type + ': its fee delivered by Haulers');
    const on = run(300, () => !b.mOff);
    assert.ok(!b.mOff && !b.mDown, type + ': back online');
    assert.ok(b.armor >= BDEFS[type].armor * MEGA.online - 1, type + ': mended to half');
    if (stage[type]) assert.ok(stage[type](b), type + ': its stage kept through it all');
    if (type === 'lance') assert.equal(lanceBlocked(b).startsWith('It is'), false, 'the Lance can be used again');
    if (type === 'city') assert.ok(!b.cDown, 'Arrival City lit again');
    log.push(type + ': fee hauled in ' + paid.toFixed(0) + ' s, a Worker brought it online ' + on.toFixed(0) + ' s later (armor ' + Math.round(b.armor) + '/' + BDEFS[type].armor + ')');
  }

  // 3) Contested: the clock stops; its old owner takes it back the same way.
  {
    const { b } = setup('lift');
    b.armor = 1;
    const us = band(0, b, 5);
    run(30, () => b.mDown);
    run(10);
    const c0 = b.mCap;
    assert.ok(c0 > 5 && b.mBy === 0, 'the clock fills for colony 0');
    const them = band(1, b, 5, true);
    for (const u of them.concat(us)) u.hp = 1e6;
    const at = them.map((u) => [u.x, u.y]), pin = () => { them.forEach((u, k) => { u.x = at[k][0]; u.y = at[k][1]; u.task = null; u.path = null; }); return false; };
    run(0.5, pin);
    const c1 = b.mCap;
    run(8, pin);
    assert.ok(Math.abs(b.mCap - c1) < 0.01 && b.mDown, 'contested: the clock stops (' + c1.toFixed(1) + ' -> ' + b.mCap.toFixed(1) + ')');
    for (const u of us) if (!u.dead) killBot(u);
    run(MEGA.cap + 10, () => pin() || !b.mDown);
    assert.equal(b.owner, 1, 'its old owner took it back');
    assert.ok(b.mOff, 'and must bring it online too ' + JSON.stringify({ off: b.mOff, need: b.mNeed, down: b.mDown, armor: b.armor, fix: b.fixLeft, st: b.status }));
    log.push('contested at ' + c1.toFixed(1) + ' s: stopped; taken back by its old owner');
  }

  // 4) Wreck it: destroyed, crates spilt; Arrival City refused.
  for (const type of ['gup', 'atmos', 'city']) {
    const { b } = setup(type);
    b.armor = 4;
    const why = applyOrder(0, 'megaWreck', [b.id, true]);
    if (type === 'city') { assert.ok(why, 'Arrival City can\\'t be ordered wrecked'); log.push('city: Wreck it refused (' + why + ')'); continue; }
    assert.equal(why, '', type + ': ordered wrecked');
    const crates0 = (S.loot || []).length;
    const us = band(0, b, 6);
    const t = run(120, () => b.dead);
    assert.ok(b.dead, type + ': wrecked');
    assert.ok((S.loot || []).length > crates0, type + ': part of its goods in crates');
    log.push(type + ': Wreck it, destroyed in ' + t.toFixed(1) + ' s, ' + ((S.loot || []).length - crates0) + ' crate pile(s)');
  }
  // ...and once knocked out, a Wreck it order finishes it off.
  {
    const { b } = setup('dome');
    b.armor = 2; band(0, b, 6);
    run(30, () => b.mDown);
    assert.ok(b.mDown);
    applyOrder(0, 'megaWreck', [b.id, true]);
    const t = run(120, () => b.dead);
    assert.ok(b.dead, 'a knocked-out one ordered wrecked goes');
    log.push('dome: knocked out, then Wreck it: gone ' + t.toFixed(1) + ' s later');
  }
  // 5) A Missile still destroys one (and Arrival City is only knocked out by it).
  for (const type of ['lance', 'city']) {
    const { b } = setup(type);
    b.armor = 1;
    missileImpact({ x1: bCentre(b).x, y1: bCentre(b).y, owner: 0, target: b.id, from: 0 });
    if (type === 'city') assert.ok(!b.dead && b.mDown, 'a Missile knocks Arrival City out');
    else assert.ok(b.dead, 'a Missile destroys the ' + type);
  }
  log.push('a Missile destroys a Lance at 0, and knocks Arrival City out');

  // 6) A save in the middle of a seizing loads as it was and replays the same every time it is loaded. (Compared load
  // against load: a game played on from the moment of saving can differ by its caches from robots told to attack by
  // hand, as before seizing, so the live run isn't the measure.)
  {
    const { b } = setup('deepcore');
    b.armor = 2; band(0, b, 6);
    run(30, () => b.mDown); run(10);
    const cap = b.mCap, saved = serializeGame();
    deserializeGame(saved);
    const b1 = S.buildings.find((e) => e.type === 'deepcore');
    assert.ok(b1.mDown && b1.mCap === cap && b1.mBy === 0, 'its seize clock saved');
    run(45);
    const h1 = hashState(), o1 = b1.owner, need1 = JSON.stringify(b1.mNeed);
    deserializeGame(saved);
    run(45);
    assert.equal(hashState(), h1, 'the save replays the same');
    const b2 = S.buildings.find((e) => e.type === 'deepcore');
    assert.equal(b2.owner, o1); assert.equal(JSON.stringify(b2.mNeed), need1);
    log.push('save mid-seize (' + cap.toFixed(1) + ' s on the clock) loads and replays the same; seized by P' + o1 + ' after');
  }
  return log;
`)(assert, () => {});
for (const l of out) console.log(l);
console.log('mega-seize-test: ALL PASSED');

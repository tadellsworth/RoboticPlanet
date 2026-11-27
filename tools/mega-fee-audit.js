// How long a rival takes to pay a seized megastructure's fee (MEGA.fee), and what resting its Bot Foundry for it costs
// (AI_SEIZE.rest, restFee, restMin; docs/economy-audit-nov26.md). A computer-only Versus game runs to MINUTE; then
// colony 2 is handed a megastructure of TYPE by its Command Base, seized back and offline, owing its fee, and the game
// runs on until it is online (8 minutes at most). Prints the seconds to online, the seconds its Foundry rested, and
// the warbots it made meanwhile, for three rules: `scaled` (the game's: the wait scales with the fee), `fixed` (the
// Foundry rests after AI_SEIZE.rest s whatever the fee) and `never` (the Foundry never rests for it).
// node tools/mega-fee-audit.js MAP SEED TYPE MINUTE
const { readFileSync } = require('node:fs');
const path = require('node:path');

const [shape, seedArg, type, minuteArg] = process.argv.slice(2);
const seed = Number(seedArg), minute = Number(minuteArg);
if (!shape || !Number.isInteger(seed) || !type || !(minute > 0)) throw new Error('Use: node tools/mega-fee-audit.js MAP SEED TYPE MINUTE');
const modules = ['util', 'defs', 'world', 'path', 'sim', 'ai', 'missions', 'orders', 'landmarks', 'city', 'walker', 'dam'];
const source = modules.map((name) => readFileSync(path.join(__dirname, '..', 'js', name + '.js'), 'utf8')).join('\n');
const play = (rule) => new Function('sfx', source + `
  return ({ shape, seed, type, minute, rule }) => {
    if (rule === 'fixed') { AI_SEIZE.restFee = 0; AI_SEIZE.restMin = 0; }
    if (rule === 'never') AI_SEIZE.rest = Infinity;
    newGame({ shape: SHAPE_PRESETS.findIndex((p) => p.name.toLowerCase() === shape.toLowerCase()), seed, players: 2, humans: [], mode: 'versus',
      difficulty: 'normal', style: 'balanced', nuke: true, mega: true, events: false, murmur: 'active', victory: 'capture' });
    S.watch = true;
    while (S.time < minute * 60 && S.winner < 0) simStep(SIM_STEP);
    const p = 1, L = getE(S.players[p].lander);
    if (!L || L.dead || L.owner !== p) return { err: 'colony 2 fell first' };
    // its spot: the nearest to the Command Base, 4 to 14 tiles off, where it could be built
    let spot = null, bd = Infinity;
    for (let j = L.y - 14; j <= L.y + 14; j++) for (let i = L.x - 14; i <= L.x + 14; i++) {
      const d = dist(i, j, L.x, L.y);
      if (d < 4 || d > 14 || d >= bd || !inMap(i, j) || !canPlace(p, type, i, j, true).ok) continue;
      bd = d; spot = [i, j];
    }
    if (!spot) return { err: 'no room' };
    const b = addBuilding(p, type, spot[0], spot[1], true);
    computeTerritory(); S.roadVer = (S.roadVer || 0) + 1;
    for (const t of roadRouteTo(p, b) || []) setRoad(t % S.W, (t / S.W) | 0, true, p);
    megaSeized(b, p);
    const fee = { ...b.mNeed };
    const army0 = S.players[p].stats.botsMade || 0, t0 = S.time;
    const armyNow = () => S.bots.filter((u) => !u.dead && u.owner === p && isArmy(u)).length;
    let rested = 0, made = 0, online = null;
    const seen = new Set(S.bots.filter((u) => u.owner === p).map((u) => u.id));
    while (S.time - t0 < 480 && S.winner < 0) {
      simStep(SIM_STEP);
      if (S.tick % 30) continue;
      for (const u of S.bots) if (u.owner === p && !seen.has(u.id)) { seen.add(u.id); if (isArmy(u)) made++; }
      if (S.buildings.some((f) => !f.dead && f.owner === p && f.type === 'foundry' && f.feeRest)) rested++;
      if (online === null && !b.mOff && !b.dead) { online = Math.round(S.time - t0); break; }
    }
    return { rule, fee, online, rested, warbots: made, army: armyNow(), alloyChipFee: (fee.alloy || 0) + (fee.chip || 0) };
  };
`)(() => {})({ shape, seed, type, minute, rule });
const out = ['scaled', 'fixed', 'never'].map(play);
console.log(JSON.stringify({ shape, seed, type, minute, runs: out }));

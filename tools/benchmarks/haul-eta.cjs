const { readFileSync } = require('node:fs');
const path = require('node:path');
const { runInNewContext } = require('node:vm');
const { performance } = require('node:perf_hooks');
const assert = require('node:assert/strict');
const files = ['util', 'defs', 'world', 'path', 'sim', 'ai', 'missions', 'orders'];
const root = path.resolve(__dirname, '../..');
const experiment = readFileSync(path.join(__dirname, 'haul-eta-estimator.js'), 'utf8');
const source = files.map((file) => readFileSync(path.join(root, 'js', file + '.js'), 'utf8')).join('\n');
const original = 'sources.sort((a, b) => a.d - b.d);';
assert.equal(source.split(original).length, 2, 'The dispatcher source hook must uniquely match this game version.');
runInNewContext(source.replace(original, 'rankExperiment(sources, r.b, r.g, take, idle);') + '\n' + experiment + '\n' + `
function benchmarkWorld(seed, sea) {
  const shape = sea ? SHAPE_PRESETS.findIndex((s) => s.naval) : 0;
  newGame({seed, mode:'colony', size:3, shape, murmur:'off'});
  S.time = 1;
  S.buildings.length = 0; S.bots.length = 0; S.byId.clear();
  for (const field of ['elev','ramp','res','bAt','road','rail','plan','heat']) S[field]?.fill(0);
  S.terrain.fill(T_GROUND); S.owner.fill(0); S.zone.fill(0); S.wown.fill(0);
  if (S.tidal) S.tidal.fill(0);
  S.posts = []; S.players[0].lander = 0; S.players[0].noHaulers = false;
  S.roadVer++; S.railVer++; _seaFor = null;
}
function polyline(points, asphalt = false) {
  for (let k = 1; k < points.length; k++) {
    let [x,y] = points[k-1], [ex,ey] = points[k];
    assert.ok(x === ex || y === ey);
    while (true) {
      setRoad(x,y,true,0);
      const t = tIdx(x,y); S.pave[t] = asphalt ? 2 : 1; S.wear[t] = 0;
      if (x === ex && y === ey) break;
      x += Math.sign(ex-x); y += Math.sign(ey-y);
    }
  }
}
function scenario(name, seed) {
  const sea = name.startsWith('ferry');
  benchmarkWorld(seed, sea);
  let A, B, D, traffic = [], ferries = [];
  const depot = ([x,y]) => addBuilding(0,'depot',x,y,true);
  if (name === 'detour') {
    A = depot([34,23]); B = depot([22,30]); D = depot([44,22]);
    polyline([[34,22],[34,13],[49,13],[49,22],[45,22]]);
    polyline([[23,30],[44,30],[44,23]]);
  } else if (sea) {
    A = depot([34,24]); B = depot([61,24]); D = depot([46,24]);
    for (let y=6; y<=49; y++) for (let x=38; x<=43; x++) S.terrain[tIdx(x,y)] = T_WATER;
    const west = addBuilding(0,'port',37,24,true), east = addBuilding(0,'port',44,24,true);
    polyline([[35,24],[36,24]]);
    const bend = name === 'ferry-best' ? 39 : 25;
    polyline([[45,24],[45,bend],[60,bend],[60,24]]);
    west.stock.fuel = east.stock.fuel = 10;
    const port = name === 'ferry-ready' ? east : west;
    const f = addBot(0,'ferry',port.x,port.y); enterBuilding(f,port);
    f.home = port.id; west.ferryTo=east.id; east.ferryTo=west.id;
    S.tick++; ferryChanged();
    ferries.push(f);
  } else {
    const busy = ['congestion','rush','cleared'].includes(name);
    const a = busy ? 34 : 35;
    A = depot([a,24]); B = depot([busy ? 57 : 56,24]); D = depot([44,24]);
    polyline([[a,23],[44,23]]);
    polyline([[44,25],[B.x,25]], name === 'asphalt');
    if (busy) {
      polyline([[25,23],[a,23]]); polyline([[44,23],[50,23]]);
      const count = name === 'rush' ? 13 : 8;
      for (let k=0;k<count;k++) {
        const x = 27 + k * 1.2 + (seed % 4) * 0.08, y = 23;
        const v = addBot(0, k%2 ? 'roadtrain' : 'truck', Math.floor(x),y);
        v.x = x; v.bat = 100; traffic.push({v,toward:k%3 ? 50 : 25});
        v.task = { type:'benchmark-traffic' };
      }
    }
  }
  A.stock.ore = B.stock.ore = 100;
  assert.ok(roadLinked(A,D) && roadLinked(B,D), name + ' lost its supplier network');
  const fleet = Array.from({length:2}, () => {
    const u = addBot(0,'hauler',D.x,D.y);
    enterBuilding(u,D);
    return u;
  });
  return {A,B,D,fleet,traffic,ferries};
}
function advance(F, active) {
  S.time += SIM_STEP; S.tick++;
  if (active && S.tick % 8 === 0) {
    etaProfile.pathCeiling = etaProfile.paths + 32;
    const start = performance.now();
    dispatch(0);
    const ms = performance.now() - start;
    etaProfile.dispatchMs += ms; etaProfile.samples.push(ms);
    etaProfile.dispatches++;
    for (const u of F.fleet) {
      const t = u.task;
      if (t?.type === 'haul' && t.phase === 'toSrc' && u.testLast !== t) {
        u.testLast = t; etaProfile.pickups.push(t.src === F.A.id ? 'near' : 'far');
      }
    }
  }
  updateLights(SIM_STEP);
  countTraffic();
  for (const {v} of F.traffic) v.moved = 0;
  for (const item of F.traffic) {
    const {v,toward} = item;
    if (!v.path) goTo(v,toward,23);
    if (v.path && moveAlong(v,SIM_STEP)) item.toward = toward === 50 ? 25 : 50;
  }
  for (const f of F.ferries) { updateFerry(f,SIM_STEP); workerBattery(f,SIM_STEP); }
  if (active) for (const u of F.fleet) {
    if (u.ferryWait) ferryPassenger(u); else updateWorker(u,SIM_STEP);
  }
}
function trial(name,seed,mode) {
  etaMode = mode;
  etaProfile = {rankings:0,paths:0,dispatchMs:0,dispatches:0,pickups:[],samples:[]};
  const F = scenario(name,seed);
  for (let i=0;i<900;i++) advance(F,false);
  if (name === 'cleared') {
    for (const {v} of F.traffic) { v.path = null; v.x = 26.5; v.y = 21.5; }
    F.traffic = [];
  }
  F.D.keep = {ore:12};
  const start = S.time;
  let first=null, six=null, all=null, at45=0, at90=0, at120=0;
  for (let i=1;i<=5400;i++) {
    advance(F,true);
    const n=F.D.stock.ore || 0, t=S.time-start;
    if (i<1350) at45=n;
    if (i<2700) at90=n;
    if (i<3600) at120=n;
    if (!first && n) first=t;
    if (!six && n>=6) six=t;
    if (!all && n>=12) all=t;
    if (all) { if (i<1350) at45=n; if(i<2700)at90=n; if(i<3600)at120=n; break; }
  }
  const steady = (F.A.stock.ore || 0) + (F.B.stock.ore || 0) + (F.D.stock.ore || 0) + F.fleet.reduce((sum,u)=>sum+(u.carryN || 0),0);
  assert.equal(steady,200);
  const samples = etaProfile.samples.sort((a,b)=>a-b);
  const dispatchP95 = samples[Math.ceil(samples.length * 0.95)-1];
  delete etaProfile.samples;
  delete etaProfile.pathCeiling;

  return {name, seed, mode, first, six, all, at45, at90, at120, dispatchP95, ...etaProfile};
}

function burst(seed, mode) {
  etaMode = mode;
  etaProfile = {rankings:0,paths:0,pathCeiling:32};
  benchmarkWorld(seed, false);
  const roads = [12,18,24,30,36];
  for (const y of roads) polyline([[10,y],[63,y]]);
  polyline([[10,12],[10,36]]); polyline([[63,12],[63,36]]);
  const make = (x,y) => addBuilding(0,'depot',x,y,true);
  const sources = [make(19,11),make(27,17),make(34,23),make(41,29),make(49,35)];
  for (const source of sources) source.stock.ore = 100;
  for (const y of roads) for (const x of [21,34,54]) make(x,y+1).keep = {ore:12};
  for (let k=0; k<24; k++) {
    const source = sources[k % sources.length], u = addBot(0,'hauler',source.x,source.y);
    enterBuilding(u,source);
  }
  countTraffic();
  const started = performance.now();
  dispatch(0);
  const dispatchMs = performance.now() - started;
  const assigned = S.bots.filter((u) => u.task?.type === 'haul').length;
  assert.equal(assigned,24);
  return {name:'burst',seed,mode,assigned,dispatchMs,paths:etaProfile.paths};
}
const names = process.argv[2] ? process.argv[2].split(',') : ['open','detour','asphalt','congestion','rush','cleared','ferry','ferry-ready','ferry-best'];
const modes = process.argv[3] ? process.argv[3].split(',') : ['distance','eta','eta-guarded','eta-guarded-budget'];
const seeds = Array.from({length:Number(process.argv[4] || 6)},(_,i)=>43011+i);
for (const name of names) for (const seed of seeds) for (const mode of (seed%2 ? modes : modes.slice().reverse())) console.log(JSON.stringify(name === 'burst' ? burst(seed,mode) : trial(name,seed,mode)));
`, { assert, console, performance, process });

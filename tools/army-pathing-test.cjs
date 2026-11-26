const { readFileSync } = require('node:fs');
const path = require('node:path');
const { runInNewContext } = require('node:vm');
const assert = require('node:assert/strict');
const files = ['util', 'defs', 'world', 'path', 'sim', 'ai', 'missions', 'orders'];
const source = files.map((file) => readFileSync(path.join(__dirname, '..', 'js', file + '.js'), 'utf8')).join('\n');
runInNewContext(source + `
function fixture() {
  newGame({seed: 43199, size: 1, mode: 'versus', murmur: 'off'});
  S.time = 100;
  S.buildings.length = 0; S.bots.length = 0; S.byId.clear();
  S.terrain.fill(T_GROUND); S.elev.fill(0); S.ramp.fill(0); S.res.fill(0); S.bAt.fill(0); S.road.fill(0);
  S.owner.fill(-1); S.zone.fill(0); S.posts = []; S.rallies = [];
  SHIELDS.length = 0;
  S.players[0].ai = false;
}
function bot(owner,type,x,y) {
  const u = addBot(owner,type,Math.floor(x),Math.floor(y));
  u.x = x; u.y = y; u.scanT = 0; u.cd = 0;
  return u;
}
const b = (owner,type,x,y) => addBuilding(owner,type,x,y,true);
function report(name, actual, expect) {
  console.log(name, JSON.stringify(actual));
  assert.deepEqual(actual, expect, name);
}
{
  fixture();
  const u = bot(0,'warbot',19.5,20.5), foe = bot(1,'warbot',20.5,20.5);
  const repair = b(0,'repair',15,20), target = b(1,'depot',25,20);
  repair.stock.alloy=2; u.hp=3; u.hurtT=S.time-0.1;
  orderAttack(0,[u.id],target);
  S.tick = u.id % 10;
  updateWarbot(u,SIM_STEP);
  report('damaged but engaged', {order:u.task?.type,fought:!!u.fought}, {order:'attack',fought:true});
  foe.x = 35.5; u.fight = 0; u.hurtT = S.time - 3; S.time += 3;
  updateWarbot(u, SIM_STEP);
  assert.equal(u.task.type, 'repair');
  assert.equal(u.resume.target, target.id);
  orderAttack(0, [u.id], target);
  assert.ok(!u.retreat && !u.resume);
}
{
  fixture();
  const u = bot(0,'torch',20.5,20.5), foe = bot(1,'warbot',22.65,20.5);
  u.fight=foe.id; u.viaT=S.time+1; u.viaFoe=foe.id;
  goTo(u, Math.floor(foe.x),Math.floor(foe.y));
  const fuel=u.gel;
  updateWarbot(u,SIM_STEP);
  report('torch with a detour path', {spentFuel:u.gel<fuel,advanced:u.x>20.5},{spentFuel:false,advanced:true});
}
{
  fixture();
  const u = bot(0,'warbot',20.5,20.5), chase=bot(1,'warbot',23.5,20.5), ambush=bot(1,'warbot',20.5,21.55);
  u.fight=chase.id;
  updateWarbot(u,SIM_STEP);
  report('immediate threat takes priority',{close:u.fight===ambush.id,far:u.fight===chase.id,fought:!!u.fought},{close:true,far:false,fought:true});
}
{
  fixture();
  const u=bot(0,'warbot',19.96,20.5);
  b(1,'wall',20,20);
  u.face=Math.PI;
  const moved=moveDirect(u,22.5,20.5,0.1);
  report('blocked step preserves aim',{moved,unchanged:u.face===Math.PI},{moved:false,unchanged:true});
}
{
  fixture();
  const u=bot(0,'warbot',26.1,26.1), w=bot(0,'bulwark',25.5,25.5), foe=bot(1,'warbot',26.3,25.5);
  w.sh=BULWARK.shield; w.shAim=0; SHIELDS.push(w); shieldCovers(w);
  const target=b(1,'depot',30,25);
  orderAttack(0,[u.id,w.id],target);
  w.fight=foe.id;
  const sx=u.x, sy=u.y;
  updateWarbot(u,SIM_STEP);
  report('active Bulwark in a fight',{fought:!!u.fought,shift:u.x<sx || u.y<sy},{fought:true,shift:true});
  // Keep the target alive while measuring the moving unit's position.
  for (let k = 0; k < 70; k++) {
    S.time += SIM_STEP; S.tick++;
    u.cd = 10; u.fight = foe.id; shieldCovers(w); updateWarbot(u, SIM_STEP);
  }
  shieldCovers(w);
  assert.ok(shieldProtects(w, u, foe.x, foe.y));
  assert.ok(dist(u.x, u.y, foe.x, foe.y) <= WARBOT_RANGE);
  const hp = u.hp;
  damageBot(u, 2, foe.x, foe.y);
  assert.equal(u.hp, hp);
  assert.equal(w.sh, BULWARK.shield - 2);
  w.sh = 0;
  damageBot(u, 2, foe.x, foe.y);
  assert.equal(u.hp, hp - 2);
}

{
  fixture();
  const u = bot(0, 'warbot', 20.5, 20.5), foe = bot(1, 'warbot', 23.5, 20.5);
  for (let y = 4; y <= 36; y++) S.terrain[tIdx(21, y)] = T_WATER;
  u.fight = foe.id;
  updateWarbot(u, SIM_STEP);
  report('long detour rejected before movement', { x: u.x, y: u.y, ignored: u.ignoreFoe === foe.id },
    { x: 20.5, y: 20.5, ignored: true });
}
{
  fixture();
  const u = bot(0, 'warbot', 20.5, 20.5), foe = bot(1, 'warbot', 23.1, 20.5);
  S.terrain[tIdx(21, 20)] = T_WATER;
  u.fight = foe.id; u.cd = 40;
  let far = Infinity, routed = 0;
  for (let k = 0; k < 200; k++) {
    S.tick++; S.time += SIM_STEP;
    updateWarbot(u, SIM_STEP);
    far = Math.min(far, dist(u.x, u.y, foe.x, foe.y));
    if (u.path) routed++;
  }
  assert.ok(routed > 20 && far <= WARBOT_RANGE);
  assert.equal(u.fight, foe.id);
}
{
  fixture();
  const u = bot(0, 'warbot', 20.5, 20.5), foe = bot(1, 'warbot', 20.5, 21.4);
  const start = u.x;
  assert.equal(orderMove(0, [u.id], 28, 20), 1);
  for (let k = 0; k < 60; k++) { S.time += SIM_STEP; S.tick++; updateWarbot(u, SIM_STEP); }
  assert.ok(u.x > start + 1 && u.march > S.time);
  assert.equal(u.ammo, WARBOT_AMMO);
  assert.equal(foe.hp, foe.maxHp);
}
{
  fixture();
  const u = bot(0, 'warbot', 20.5, 20.5), foe = bot(1, 'warbot', 21.5, 20.5);
  const post = b(0, 'outpost', 15, 20), target = b(1, 'depot', 28, 25);
  post.stock.ammo = 3;
  assert.equal(orderAttack(0, [u.id], target), 1);
  u.task.reload = post.id; u.task.trips = 1; u.ammo = 1; u.fight = foe.id;
  const start = u.x;
  for (let k = 0; k < 30; k++) { S.time += SIM_STEP; S.tick++; updateWarbot(u, SIM_STEP); }
  assert.ok(u.x < start - 0.5);
  assert.equal(foe.hp, foe.maxHp);
  assert.equal(u.task.reload, post.id);
}
console.log('Army pathing and combat regression checks passed.');
`, { assert, console, sfx() {} });

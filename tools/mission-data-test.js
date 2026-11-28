// Headless checks for the mission curriculum and its tutorial prompts.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const files = ['util', 'defs', 'world', 'path', 'sim', 'ai', 'missions', 'orders'];
const source = files.map((file) => read(`js/${file}.js`)).join('\n');
const { missions, buildings, harbourSteps, airliftSteps, arterialRun } = vm.runInNewContext(source + `
  ({
    missions: MISSIONS,
    buildings: BDEFS,
    harbourSteps() {
      const goal = MISSIONS.find((mission) => mission.id === 'harbour').goals[3];
      const home = { type: 'port', owner: 0, built: true, stock: {}, keep: {} };
      const far = { type: 'port', owner: 0, built: true, stock: {}, keep: {} };
      const state = { players: [{ madeBots: {} }], buildings: [home, far], bots: [] };
      const original = overseasPorts;
      overseasPorts = () => [far];
      try {
        const order = goal.focus(state);
        state.players[0].madeBots.cargoship = 1;
        const supply = goal.focus(state);
        home.keep.alloy = 10;
        home.stock.alloy = 7;
        const wait = goal.focus(state);
        home.stock.alloy = 8;
        const overseas = goal.focus(state);
        return { order, supply, wait, overseas, home, far };
      } finally {
        overseasPorts = original;
      }
    },
    arterialRun() {
      newGame(missionOptions(MISSIONS.findIndex((m) => m.id === 'arterial'), 3));
      const { x, north, south } = arterialRoute(getE(S.players[0].lander));
      const id = S.mission.arterialDepot;
      const express = [];
      for (let y = north; y <= south; y++) express.push([tIdx(x, y), 5], [tIdx(x - 1, y), 3]);
      applyOrder(0, 'keep', [id, 'cement', 5]);
      for (let tick = 0; tick < 30 * 60; tick++) simStep(1 / 30);
      const bypass = { cement: getE(id).stock.cement, runs: S.mission.arterialRuns };
      const marks = applyOrder(0, 'paths', [{ express }]).lanes;
      const ramps = applyOrder(0, 'paths', [{ add: [tIdx(x + 1, north), tIdx(x + 1, south)] }]).laid;
      for (let tick = 0; tick < 30 * 240 && !missionStates(S.mission)[2].done; tick++) simStep(1 / 30);
      applyOrder(0, 'keep', [id, 'cement', 30]);
      for (let tick = 0; tick < 30 * 240 && S.winner < 0; tick++) simStep(1 / 30);
      return { bypass, marks, ramps, result: S.mission.result, runs: S.mission.arterialRuns, time: S.time };
    },
    airliftSteps() {
      const goal = MISSIONS.find((mission) => mission.id === 'airlift').goals[0];
      const crawler = { type: 'crawler', owner: 0 };
      return { before: goal.focus({ bots: [] }), after: goal.focus({ bots: [crawler] }), crawler };
    },
  })
`, { sfx() {} });

const plain = (hint) => hint.replace(/<[^>]+>/g, '');
const byId = new Map(missions.map((mission) => [mission.id, mission]));
const chapters = [];
for (const mission of missions) {
  if (mission.chapter !== chapters.at(-1)) chapters.push(mission.chapter);
  for (const [index, goal] of mission.goals.entries()) {
    const name = `${mission.id} goal ${index + 1}`;
    assert.ok(plain(goal.hint).length <= 110, `${name} exceeds 110 visible characters`);
    if (goal.at !== undefined) {
      assert.ok(typeof goal.at === 'string' && Object.hasOwn(buildings, goal.at), `${name} must target a building type`);
    }
  }
}
assert.equal(chapters.length, new Set(chapters).size, 'each chapter must appear in one block');
assert.deepEqual(chapters, [
  'First Steps', 'Growing the Colony', 'Roads and Traffic', 'Industry and Trade', 'Sea and Sky', 'Into the Void', 'First Contact', 'War',
]);
const ids = 'touchdown groundwork recharge hotmetal assembly greenfuel frontier rain rushhour crossings blacktop arterial pipeline research longhaul railway maglev driver trade dryground harbour skyline airlift mooring earthworks greening deepground madeready spacefall graveyard bughunt groundwar hollow forms seedvault underbloom livefire ruins walker dam border holdline keepstime harrowhunt supply standing convoy siege voidfleet chain lance landingzone overcast hill descent';
assert.equal(missions.map((mission) => mission.id).join(' '), ids, 'preserve the saved IDs and the curriculum order');
assert.equal(missions.at(-1).name, 'Final Descent');

const shipOrder = "#sh-yard .order-row[data-k='cargoship'] [data-d='1']";
const alloyOrder = "#sh-keep .keep-cell[data-g='alloy'] [data-d='5']";
const controls = [
  ['arterial', 1, ['Express (Shift+E)', 'Build'], ["#banner-seg [data-v='express']", '#banner-ok']],
  ['arterial', 2, ['Roads (R)', 'Build'], ["#banner-seg [data-v='road']", '#banner-ok']],
  ['arterial', 3, ['Marked roads'], ["#sh-pmode [data-v='marked']"]],
  ['arterial', 4, ['Supply orders', 'Cement +5'], ["#sh-keep .keep-cell[data-g='cement'] [data-d='5']"]],
  ['harbour', 4, ['Shipyard', 'Container Ships +1', 'Supply orders', 'Alloy +5', '8 Alloy'], [shipOrder, alloyOrder]],
  ['airlift', 1, ['Order bots', 'Crawlers +1', 'Drive somewhere (G)', 'Deploy here (E)'], ["#sh-orders .order-row[data-k='crawler'] [data-d='1']", '#sh-crawl', '#sh-deploy']],
  ['airlift', 4, ['Supply by air', 'On', 'Supply orders', 'Cement +5'], ["#sh-airsup [data-v='1']", "#sh-keep .keep-cell[data-g='cement'] [data-d='5']"]],
  ['hotmetal', 2, ['Plan while paused', 'Shift+Space', 'Resume'], ['#p-plan']],
  ['holdline', 2, ['Walls (X)', 'Build'], ["#banner-seg [data-v='wall']", '#build-walls', '#banner-ok']],
  ['holdline', 4, ['Pulse Turret', 'Aim (T)', 'right-click'], ['#sh-focus']],
  ['siege', 5, ['Army (Q)', 'Attack (Q)'], ['#btn-attack', '#ar-attack']],
  ['hill', 2, ['Outpost (B 4 O)', 'Bunker (U)'], [".bcard[data-t='outpost']", ".bcard[data-t='bunker']"]],
  ['hill', 3, ['Army (Q)', 'Hold ground (G)'], ['#btn-attack', '#ar-hold', '#win-card']],
  ['standing', 3, ['Raid (R)'], []],
  ['earthworks', 1, ['Order bots', 'Graders +1'], ["#sh-orders .order-row[data-k='grader'] [data-d='1']"]],
  ['earthworks', 2, ['Terraform (6)', 'Flatten (F)', 'Terraform'], ["#build-tabs [data-g='terra']", ".bcard[data-tf='flatten']", '#banner-ok']],
  ['earthworks', 3, ['Fill shallows (H)', 'Terraform'], [".bcard[data-tf='fill']", '#banner-ok']],
  ['greening', 1, ['Terraform (6)', 'Composter (M)'], ["#build-tabs [data-g='terra']", ".bcard[data-t='composter']"]],
  ['greening', 3, ['Tree Nursery (N)'], [".bcard[data-t='nursery']"]],
  ['greening', 4, ['Water Pump (P)', 'Pipe'], [".bcard[data-t='wpump']"]],
  ['deepground', 1, ['Terraform (6)', 'Seam Drill (I)'], ["#build-tabs [data-g='terra']", ".bcard[data-t='seamdrill']"]],
  ['madeready', 1, ['Mega (5)', 'Reservoir (V)'], ["#build-tabs [data-g='mega']", ".bcard[data-t='reservoir']"]],
  ['madeready', 3, ['Leveller (G)', 'Level a hill (F)'], [".bcard[data-t='leveller']", '#sh-level']],
  ['deepground', 3, ['Seed Mast (G)', 'Crystal Tap'], [".bcard[data-t='seedmast']", ".bcard[data-t='tap']"]],
  ['deepground', 4, ['Thermal Plant (T)'], [".bcard[data-t='thermal']"]],
  ['standing', 4, ['Retreat when weak', '50%', 'Stance', 'Aggressive', 'Hold fire'], []],
  ['spacefall', 1, ['Move (3)', 'Launch Pad (L)', 'Lay road (R)'], [".bcard[data-t='launchpad']", '#sh-layroad']],
  ['spacefall', 2, ['Yard', 'Shuttles +1', 'Supply by air', 'On'], ["#sh-yard .order-row[data-k='shuttle'] [data-d='1']", "#sh-airsup [data-v='1']"]],
  ['spacefall', 3, ['Dropships +1', 'Land 6 Workers'], ["#sh-yard .order-row[data-k='dropship'] [data-d='1']", '#sh-sp-sq-k']],
  ['spacefall', 4, ['Defend (4)', 'Outpost (O)'], [".bcard[data-t='outpost']"]],
  ['graveyard', 1, ['Yard', 'Shuttles +1', 'Tow salvage'], ["#sh-yard .order-row[data-k='shuttle'] [data-d='1']", '#sh-sp-tow']],
  ['graveyard', 2, ['Land a Drop Outpost', 'Land'], ['#sh-sp-post', '#banner-ok']],
  ['graveyard', 3, ['Defend 4', 'Outpost'], [".bcard[data-t='outpost']"]],
  ['voidfleet', 1, ['Flagship', 'Deck', 'Line Ships', '+1'], ["[data-fy='line'][data-d='1']"]],
  ['voidfleet', 2, ['Deck', 'Gunships', '+1', "Join the Flagship's wing"], ["[data-fy='gunship'][data-d='1']", '#sh-sp-wing']],
  ['voidfleet', 3, ['Attack: tap a target'], ['#cap-atk']],
  ['voidfleet', 4, [], ['#cap-atk']],
];
const uiSource = read('js/ui.js') + read('index.html') + read('js/terraform5.js') + read('js/space-ui.js') + read('js/fleet.js'); // (stage 5's panel buttons are made there; a spacecraft's, in js/space-ui.js)
// (Standing Orders' Raid and behaviour goals: the panel makes those buttons from lists, so their ids are checked here.)
for (const id of ['ag-order-raid', 'ag-ret-50', 'ag-st-agg', 'ag-st-hold']) assert.ok(/ag-order-\$\{k\}|ag-ret-\$\{v\}|ag-st-\$\{v\}/.test(uiSource), `the group panel makes ${id}`);
{
  const goals = byId.get('standing').goals, raid = goals.find((g) => g.kind === 'agraid'), beh = goals.find((g) => g.kind === 'agbeh');
  assert.equal(goals.indexOf(raid), 2); assert.equal(goals.indexOf(beh), 3);
  assert.deepEqual(raid.ui.split(',').map((q) => q.trim()), ['#agcards .agcard', '#ag-order-raid'], 'the Raid goal lights the card and the Raid button');
  assert.deepEqual(beh.ui.split(',').map((q) => q.trim()), ['#ag-ret-50', '#ag-st-agg', '#ag-st-hold'], 'the behaviour goal lights its buttons');
  const G = (k, b) => ({ agroups: [{ owner: 0, ord: { k }, beh: b }, { owner: 1, ord: { k: 'raid' }, beh: { ret: 50, rel: 1, st: 'agg' } }] });
  assert.equal(raid.count({}, G('hold')), 0, 'a rival\'s raid is not yours');
  assert.equal(raid.count({}, G('raid')), 1, 'a group of yours on Raid counts');
  assert.equal(beh.count({}, G('hold', { ret: 25, rel: 1, st: 'def' })), 0, 'the default behaviours do not count');
  assert.equal(beh.count({}, G('hold', { ret: 50, rel: 1, st: 'def' })), 1, 'Retreat at 50% counts');
  assert.equal(beh.count({}, G('hold', { ret: 25, rel: 1, st: 'hold' })), 1, 'Hold fire counts');
}
for (const [id, number, labels, selectors] of controls) {
  const goal = byId.get(id).goals[number - 1];
  const hint = plain(goal.hint);
  const actual = goal.ui.split(',').map((selector) => selector.trim());
  for (const label of labels) assert.ok(hint.includes(label), `${id} goal ${number} names ${label}`);
  for (const selector of selectors) {
    assert.ok(actual.includes(selector), `${id} goal ${number} highlights ${selector}`);
    const targetId = selector.match(/^#([\w-]+)/)?.[1];
    if (targetId) assert.ok(uiSource.includes(`id="${targetId}"`), `missing UI element ${targetId}`);
  }
}

assert.equal(byId.get('harbour').goals[3].at, 'port');
assert.equal(byId.get('airlift').goals[0].at, 'foundry');
const { order, supply, wait, overseas, home, far } = harbourSteps();
assert.equal(order.e, home);
assert.equal(order.ui, shipOrder);
assert.equal(supply.e, home);
assert.equal(supply.ui, alloyOrder);
assert.equal(wait.e, home);
assert.equal(overseas.e, far);
assert.equal(overseas.ui, alloyOrder);
const { before, after, crawler } = airliftSteps();
assert.equal(before, null);
assert.equal(after.e, crawler);
assert.equal(after.ui, '#sh-crawl, #sh-deploy');
console.log('Mission hints, targets, tutorial selectors and chapter order passed.');

const arterial = arterialRun();
assert.equal(arterial.bypass.cement, 5);
assert.equal(arterial.bypass.runs, 0, 'an ordinary-road delivery does not qualify');
assert.equal(arterial.marks, 32);
assert.equal(arterial.ramps, 2);
assert.equal(arterial.result, 'won');
assert.equal(arterial.runs, 4);
assert.ok(arterial.time < 8 * 60, 'the Hard tutorial is short with the provided materials');

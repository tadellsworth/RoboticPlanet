// Headless checks for the mission curriculum and its tutorial prompts.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const files = ['util', 'defs', 'world', 'path', 'sim', 'ai', 'missions', 'orders'];
const source = files.map((file) => read(`js/${file}.js`)).join('\n');
const { missions, buildings, harbourSteps, airliftSteps } = vm.runInNewContext(source + `
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
  'First Steps', 'Growing the Colony', 'Roads and Traffic', 'Industry and Trade', 'Sea and Sky', 'First Contact', 'War',
]);
const ids = 'touchdown groundwork recharge hotmetal assembly greenfuel frontier rushhour crossings blacktop pipeline research longhaul railway maglev driver trade harbour skyline airlift mooring bughunt hollow forms livefire border holdline supply convoy siege chain lance hill descent';
assert.equal(missions.map((mission) => mission.id).join(' '), ids, 'preserve the saved IDs and the curriculum order');
assert.equal(missions.at(-1).name, 'Final Descent');

const shipOrder = "#sh-yard .order-row[data-k='cargoship'] [data-d='1']";
const alloyOrder = "#sh-keep .keep-cell[data-g='alloy'] [data-d='5']";
const controls = [
  ['harbour', 4, ['Shipyard', 'Container Ships +1', 'Supply orders', 'Alloy +5', '8 Alloy'], [shipOrder, alloyOrder]],
  ['airlift', 1, ['Order bots', 'Crawlers +1', 'Drive somewhere (G)', 'Deploy here (E)'], ["#sh-orders .order-row[data-k='crawler'] [data-d='1']", '#sh-crawl', '#sh-deploy']],
  ['airlift', 4, ['Supply by air', 'On', 'Supply orders', 'Cement +5'], ["#sh-airsup [data-v='1']", "#sh-keep .keep-cell[data-g='cement'] [data-d='5']"]],
  ['holdline', 2, ['Walls (X)', 'Build'], ["#banner-seg [data-v='wall']", '#build-walls', '#banner-ok']],
  ['siege', 5, ['Army (Q)', 'Attack (Q)'], ['#btn-attack', '#ar-attack']],
  ['hill', 2, ['Outpost (B 4 O)', 'Bunker (U)'], [".bcard[data-t='outpost']", ".bcard[data-t='bunker']"]],
  ['hill', 3, ['Army (Q)', 'Hold ground (G)'], ['#btn-attack', '#ar-hold', '#win-card']],
];
const uiSource = read('js/ui.js') + read('index.html');
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

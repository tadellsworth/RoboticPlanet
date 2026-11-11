// Neutral Trade Post: an off-world exchange standing on no-one's ground. An octagonal landing deck with a gold and
// black hazard ring and gold trim, a tall pearl-and-gold exchange spire in the middle with a glowing gold halo
// ring and a beacon, four docking cradles on the diagonals each holding a cargo pod, amber beacons round the rim,
// and landing marks for the off-world lifters. No team colour: it belongs to nobody (gold is the traders' own).
export const config = { pad: false };
export default function (L) {
  const { box, cyl, sphere, hoop, mesh, lamp, ao, M, THREE } = L;
  L.seed(951);
  const deck = M.paint('#6c6f72', { rivets: false, panelW: 256, panelH: 256, rough: 0.9, metal: 0.04 });
  const deckD = M.paint('#45484c', { rivets: false });
  const pearl = M.paint('#d9d6cc', { panelW: 96, panelH: 128 }), pearlD = M.paint('#a9a69c', { rivets: false });
  const gold = M.plain('#d9a73a', 0.3, 0.85), goldD = M.plain('#8a6420', 0.4, 0.8), dark = M.plain('#1c1f23', 0.6, 0.4);
  const glowG = M.emit('#ffc860', 2.4), amber = M.emit('#ffb347', 2.6), cyan = M.emit('#9fe8ff', 1.8), win = M.emit('#ffe2a0', 1.2);
  const oct = (r, h, mat, y = 0, o = {}) => cyl(r, h, mat, 0, y, 0, { seg: 8, ry: Math.PI / 8, ...o });

  // the deck: two stepped octagons, a gold rim, a hazard ring, landing marks
  oct(4.75, 0.28, deckD, 0, { dirt: 0.7 });
  oct(4.55, 0.06, gold, 0.28, { dirt: 0 });
  oct(4.45, 0.1, deck, 0.28, { dirt: 0.5 });
  cyl(3.55, 0.02, M.hazard, 0, 0.38, 0, { seg: 48, dirt: 0, cast: false });
  cyl(3.3, 0.025, deck, 0, 0.38, 0, { seg: 48, dirt: 0.3, cast: false });
  for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    // a chevron landing mark pointing in toward the spire on each side
    const g = new THREE.Group(); g.position.set(Math.cos(a) * 2.55, 0.41, Math.sin(a) * 2.55); g.rotation.y = -a; L.group().add(g);
    for (const s of [-1, 1]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.02, 0.12), M.plain('#e8e2cf', 0.7)); m.position.set(0, 0, s * 0.22); m.rotation.y = -s * 0.6; g.add(m); }
  }

  // the exchange spire: a hexagonal pearl shaft with gold seams, a glazed band, the gold halo, a beacon mast
  cyl(1.35, 0.5, pearlD, 0, 0.38, 0, { seg: 6, dirt: 0.4 });
  cyl(1.15, 3.9, pearl, 0, 0.88, 0, { seg: 6, rTop: 0.62, dirt: 0.25 });
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    L.beam([Math.cos(a) * 1.16, 0.9, Math.sin(a) * 1.16], [Math.cos(a) * 0.63, 4.78, Math.sin(a) * 0.63], 0.07, 0.07, goldD);
  }
  cyl(0.98, 0.42, win, 0, 2.2, 0, { seg: 6, rTop: 0.9, dirt: 0, cast: false }); // a glazed trading floor
  cyl(0.68, 0.22, gold, 0, 4.78, 0, { seg: 6, dirt: 0 });
  hoop(1.75, 0.07, glowG, 0, 3.6, 0, { cast: false }); // the halo: the traders' gold ring
  hoop(1.75, 0.12, goldD, 0, 3.52, 0);
  for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2 + 0.3; L.beam([Math.cos(a) * 0.82, 3.56, Math.sin(a) * 0.82], [Math.cos(a) * 1.7, 3.56, Math.sin(a) * 1.7], 0.06, 0.06, goldD); }
  cyl(0.06, 1.3, dark, 0, 5.0, 0, { seg: 8, dirt: 0 });
  lamp(0, 6.3, 0, '#ffc860', { shape: 'sphere', size: 0.16, intensity: 4, dist: 5, k: 3 });
  ao(0, 0, 2.2, 2.2, 0.45, 0.39);

  // four docking cradles on the diagonals, each with a cargo pod and a blinking beacon
  const pods = ['#7a3b2a', '#3f6b6b', '#957636', '#566170'];
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2, x = Math.cos(a) * 3.0, z = Math.sin(a) * 3.0;
    const g = L.group(x, 0.38, z, -a);
    box(1.5, 0.16, 1.15, deckD, x, 0.38, z, { ry: -a, dirt: 0.5 });
    for (const s of [-1, 1]) box(1.5, 0.55, 0.12, goldD, x - Math.sin(a) * s * 0.55, 0.38, z + Math.cos(a) * s * 0.55, { ry: -a, dirt: 0.2 });
    // the pod: a rounded capsule-ish container lying in the cradle
    const pg = new THREE.CapsuleGeometry(0.42, 0.8, 6, 16); pg.rotateZ(Math.PI / 2);
    mesh(pg, M.ribbed(pods[k]), x, 0.98, z, { ry: -a, dirt: 0.3 });
    lamp(x + Math.cos(a) * 0.95, 0.75, z + Math.sin(a) * 0.95, '#ffb347', { shape: 'sphere', size: 0.1, intensity: 2.5, dist: 2.5, k: 3 });
    void g;
  }

  // amber beacons round the rim, between the cradles, and cyan approach lights
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    sphere(0.09, k % 2 ? amber : cyan, Math.cos(a) * 4.2, 0.46, Math.sin(a) * 4.2, { cast: false });
  }
  // a little control kiosk and an uplink dish on the deck's edge (south-west)
  box(0.9, 0.85, 0.7, pearlD, -2.2, 0.38, 1.35, { dirt: 0.3 });
  box(0.92, 0.22, 0.72, win, -2.2, 0.85, 1.35, { dirt: 0, cast: false });
  cyl(0.06, 0.8, dark, 2.25, 0.38, -1.3, { seg: 8, dirt: 0 });
  { const d = new THREE.SphereGeometry(0.5, 20, 8, 0, Math.PI * 2, 0, 1.0); mesh(d, M.plain('#dfe2e4', 0.45, 0.2), 2.25, 1.3, -1.3, { rz: 2.4, ry: -0.6, dirt: 0 }); }
}

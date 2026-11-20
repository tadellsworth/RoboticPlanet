// The Orbital Lift (IDEAS.md "Megastructures", the owner's look A, "Beacon Cable", Nov 2026): a space elevator's anchor,
// a 3 x 3 concrete pad (30 x 30 world units, the middle of its nine tiles at the origin), rendered on one wide frame like
// the Lance (the pad's 30 units across 0.62 of it, about 4.8 tiles).
//   The pad, hazard-edged, with an eight-sided concrete collar in the middle: eight clamp housings round a steel clamp
//   ring where the cable is held, the cable's foot (a bright braided stub, the game draws the rest of it rising up the
//   screen), and the climber dock: four guide rails up the stub and a buffer ring. Two tension winches on their beds
//   with fat cable drums, a control house with a lit window band and a team stripe, a Fuel feed and a power cabinet, and
//   four floodlight masts at the pad's corners (white floods at dusk and night) with red beacons; a team band round the
//   collar's crest.
//   ?state=down   the Lift below 30%: scorched and holed, a corner floodlight mast down, a clamp housing torn open, the
//                 collar cracked, debris over the pad, the control house's window band dark.
// Marks: 'foot' (the cable's foot, where the game's beam starts), 'dock' (the climber dock's buffer).
const Q = new URLSearchParams(location.search);
const DOWN = Q.get('state') === 'down';
const PI = Math.PI;
export const config = { pad: false };

export default function (L) {
  const { box, cyl, hcyl, hoop, sphere, mesh, group, mark, ao, pointLight, pipe, M, THREE } = L;
  L.seed(8810 + (DOWN ? 7 : 0));
  L.longPad(30, 30);
  L.frameCompoundOpts({ half: 15.12, width: 0.62, cy: 0.56 });
  const R = L.rnd, RR = (a, b) => a + (b - a) * R();
  const dark = L.TOD === 'night' || L.TOD === 'evening', NB = L.TOD === 'night' ? 2.2 : L.TOD === 'evening' ? 1.5 : 1;
  const T = {
    conc: M.rough('#a39b8e'), concD: M.rough('#857d71'), concL: M.rough('#b5ad9f'),
    steel: M.steel, dark: M.dark, chrome: M.chrome, white: M.paint('#d9d6cf', { rivets: false }),
    yellow: M.paint('#d8a92c'), grey: M.paint('#5b6168', { metal: 0.4 }), greyD: M.paint('#41464c', { rivets: false, metal: 0.5 }),
    cable: M.plain('#e7edf3', 0.25, 0.85), cableD: M.plain('#8e979f', 0.35, 0.8), team: M.paint(L.TEAM, { rivets: false, rough: 0.5 }),
    ash: M.plain('#2a2522', 0.95, 0), char: M.plain('#3a2f28', 0.95, 0), nc: { dirt: 0, cast: false },
  };
  const flood = dark && !DOWN ? M.emit('#f4f8ff', 3.2) : M.plain('#cfd6dc', 0.3, 0.3);
  const red = dark ? M.emit('#ff3a22', 3) : M.plain('#a0281c', 0.4, 0.1);
  const amber = dark && !DOWN ? M.emit('#ffb347', 1.8) : M.plain('#3b4652', 0.2, 0.3);

  ao(0, 0, 28, 28, 0.35);
  // ---- markings: a painted ring round the collar, lane arrows to the dock, hazard bands by the winches
  {
    const ring = new THREE.RingGeometry(8.4, 8.9, 64); ring.rotateX(-PI / 2); mesh(ring, M.hazard, 0, 0.012, 0, T.nc);
    for (let k = 0; k < 8; k++) { const a = k * PI / 4; box(0.28, 0.02, 3.2, T.white, Math.cos(a) * 11, 0.012, Math.sin(a) * 11, { ry: -a + PI / 2, ...T.nc }); }
  }
  // ---- the collar: an eight-sided concrete plinth, stepped, a team band round its crest
  const CH = 2.6;
  {
    const g1 = new THREE.CylinderGeometry(6.6, 7.4, 1.2, 8); g1.rotateY(PI / 8); g1.translate(0, 0.6, 0); mesh(g1, T.concD, 0, 0, 0, { dirt: 0.6, dirtH: 1.2 });
    const g2 = new THREE.CylinderGeometry(5.4, 6.1, CH - 1.2, 8); g2.rotateY(PI / 8); g2.translate(0, 1.2 + (CH - 1.2) / 2, 0); mesh(g2, T.conc, 0, 0, 0, { dirt: 0.5, dirtH: 1.4 });
    const band = new THREE.CylinderGeometry(5.42, 5.5, 0.32, 8, 1, true); band.rotateY(PI / 8); band.translate(0, CH - 0.25, 0);
    const bm = mesh(band, T.team, 0, 0, 0, T.nc); bm.material = T.team.clone(); bm.material.side = THREE.DoubleSide;
    const cap = new THREE.CylinderGeometry(5.4, 5.4, 0.12, 8); cap.rotateY(PI / 8); cap.translate(0, CH + 0.06, 0); mesh(cap, T.concL, 0, 0, 0, { dirt: 0.3 });
    if (DOWN) for (let k = 0; k < 5; k++) { const a = RR(0, 2 * PI); box(RR(1.2, 2.6), 0.03, 0.08, T.dark, Math.cos(a) * 4.8, CH + 0.13, Math.sin(a) * 4.8, { ry: RR(0, PI), ...T.nc }); }
  }
  // ---- eight clamp housings round the cable, a steel clamp ring, hydraulic rams
  for (let k = 0; k < 8; k++) {
    const a = k * PI / 4 + PI / 8, r = 3.1, torn = DOWN && k === 2;
    const g = group(Math.cos(a) * r, CH + 0.12, Math.sin(a) * r, -a);
    box(1.6, torn ? 0.7 : 1.5, 1.2, torn ? T.char : T.grey, 0, 0, 0, { parent: g, dirt: 0.4 });
    box(1.7, 0.18, 1.3, T.greyD, 0, torn ? 0.7 : 1.5, 0, { parent: g, dirt: 0.2 });
    if (!torn) hcyl(0.22, 1.6, T.chrome, -1.0, 0.75, 0, { axis: 'x', parent: g, dirt: 0 });
    box(0.5, 0.12, 1.24, M.hazard, 0.6, torn ? 0.6 : 1.4, 0, { parent: g, ...T.nc });
  }
  hoop(1.75, 0.28, T.steel, 0, CH + 1.3, 0);
  hoop(1.75, 0.22, T.steel, 0, CH + 0.5, 0);
  // ---- the cable's foot: a bright braided stub, its guide rails, and the climber dock's buffer ring
  const SH = 9;
  {
    const t = L.canvasTex(256, (g, n) => {
      g.fillStyle = '#d6dde4'; g.fillRect(0, 0, n, n);
      for (let k = -n; k < n * 2; k += 14) { g.strokeStyle = 'rgba(80,90,100,0.55)'; g.lineWidth = 4; g.beginPath(); g.moveTo(k, 0); g.lineTo(k + n * 0.6, n); g.stroke(); g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 2; g.beginPath(); g.moveTo(k + 6, 0); g.lineTo(k + 6 + n * 0.6, n); g.stroke(); }
    });
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 4);
    const cm = new THREE.MeshStandardMaterial({ map: t, roughness: 0.25, metalness: 0.85 }); cm.envMapIntensity = 1.2;
    const geo = new THREE.CylinderGeometry(0.6, 0.9, SH, 24); geo.translate(0, CH + SH / 2, 0); mesh(geo, cm, 0, 0, 0, { dirt: 0 });
    for (let k = 0; k < 4; k++) { const a = k * PI / 2 + PI / 4; box(0.16, SH - 0.6, 0.16, T.cableD, Math.cos(a) * 1.15, CH + 0.4, Math.sin(a) * 1.15, { dirt: 0 }); }
    hoop(1.35, 0.18, T.yellow, 0, CH + 2.4, 0);
    cyl(1.5, 0.3, T.greyD, 0, CH + 2.1, 0, { seg: 24, dirt: 0.2 });
    // the warning lights' first two, on the stub
    sphere(0.16, red, 0.7, CH + SH - 0.5, 0.2, { cast: false }); sphere(0.16, red, -0.6, CH + SH * 0.55, 0.3, { cast: false });
    mark('foot', 0, CH + SH, 0);
    mark('dock', 0, CH + 2.4, 0);
  }
  // ---- two tension winches on their beds, west and east, with fat cable drums and a cable led in to the collar
  for (const s of [-1, 1]) {
    const x = s * 10.2, z = -6.6;
    box(4.6, 0.5, 3.4, T.concD, x, 0, z, { dirt: 0.6 });
    for (const dz of [-1.2, 1.2]) box(0.4, 2.2, 0.6, T.grey, x - 1.6, 0.5, z + dz, { dirt: 0.3 }), box(0.4, 2.2, 0.6, T.grey, x + 1.6, 0.5, z + dz, { dirt: 0.3 });
    hcyl(1.15, 3.4, T.greyD, x, 2.0, z, { axis: 'x', dirt: 0.3 });
    hcyl(1.0, 3.0, T.cableD, x, 2.0, z, { axis: 'x', dirt: 0 });
    for (let k = 0; k < 6; k++) hcyl(1.03, 0.08, T.cable, x - 1.2 + k * 0.48, 2.0, z, { axis: 'x', dirt: 0 });
    box(1.4, 1.2, 1.4, T.yellow, x + s * 2.6, 0.5, z, { dirt: 0.3 });
    pipe([[x - s * 1.4, 2.3, z + 0.6], [x - s * 4.5, 2.8, z + 2.6], [s * 3.4, CH + 0.8, -2.6]], 0.16, T.steel);
    box(4.6, 0.1, 0.4, M.hazard, x, 0.5, z + 1.9, T.nc);
  }
  // ---- the control house (south-west), a lit window band and a team stripe; a power cabinet and the Fuel feed
  {
    const x = -9.4, z = 8.4;
    box(5.4, 2.6, 3.6, T.white, x, 0, z, { dirt: 0.5, dirtH: 2.6 });
    box(5.6, 0.22, 3.8, T.concL, x, 2.6, z, { dirt: 0.3 });
    box(5.42, 0.26, 3.62, T.team, x, 2.24, z, T.nc);
    box(4.6, 0.55, 0.06, amber, x, 1.3, z + 1.81, T.nc);
    box(0.06, 0.55, 2.6, amber, x + 2.71, 1.3, z, T.nc);
    box(0.8, 1.6, 0.06, T.greyD, x - 2.0, 0, z + 1.82, T.nc);
    cyl(0.25, 0.9, T.steel, x + 1.6, 2.82, z - 0.8, { seg: 12 });
    // power cabinet and the Fuel feed: a striped pipe from the pad's east edge into the collar
    box(1.4, 1.8, 0.9, T.grey, 9.6, 0, 9.8, { dirt: 0.4 });
    box(1.42, 0.2, 0.92, M.hazard, 9.6, 1.5, 9.8, T.nc);
    pipe([[14.6, 0.35, 4.0], [10.5, 0.35, 4.0], [6.6, 0.6, 2.4]], 0.22, M.paint('#b8452e', { rivets: false }));
  }
  // ---- four floodlight masts at the pad's corners, aimed in at the collar, a red beacon on each; one down if hurt
  for (const [x, z] of [[-13.4, -13.4], [13.4, -13.4], [-13.4, 13.4], [13.4, 13.4]]) {
    const fallen = DOWN && x > 0 && z > 0;
    if (fallen) {
      // knocked down across the pad: the mast lying on the concrete, its head smashed
      const g = group(x, 0.2, z, PI * 0.75);
      box(0.32, 0.32, 7.2, T.grey, 0, 0, -3.6, { parent: g, dirt: 0.5 });
      box(1.4, 0.7, 0.9, T.char, 0, 0, -7.4, { parent: g, dirt: 0.3 });
      box(1.0, 0.4, 1.0, T.concD, 0, -0.2, 0, { parent: g, dirt: 0.6 });
      continue;
    }
    box(1.0, 0.4, 1.0, T.concD, x, 0, z, { dirt: 0.6 });
    box(0.3, 7.2, 0.3, T.grey, x, 0.4, z, { dirt: 0.3 });
    const a = Math.atan2(-z, -x);
    const g = group(x, 7.6, z, -a);
    box(0.4, 0.5, 1.6, T.greyD, 0, 0, 0, { parent: g, dirt: 0.2 });
    for (const dz of [-0.45, 0.45]) box(0.1, 0.42, 0.62, flood, 0.25, 0.04, dz, { parent: g, cast: false, dirt: 0 });
    sphere(0.14, red, x, 8.3, z, { cast: false });
    if (dark && !DOWN) pointLight('#eef4ff', 7 * NB, x * 0.75, 6.5, z * 0.75, 16);
  }
  if (dark && !DOWN) pointLight('#ffffff', 5 * NB, 0, CH + 3, 0, 9);

  // ---- battle damage: scorch on the pad and the collar, rubble and plates strewn over it, smoke-black holes
  if (DOWN) {
    for (let k = 0; k < 9; k++) {
      const x = RR(-12, 12), z = RR(-12, 12), r = RR(1.2, 3.2);
      const geo = new THREE.CircleGeometry(r, 18); geo.rotateX(-PI / 2);
      const m = mesh(geo, new THREE.MeshBasicMaterial({ color: '#16110d', transparent: true, opacity: RR(0.45, 0.75), depthWrite: false }), x, 0.02 + k * 0.001, z, T.nc); m.userData.decal = true;
    }
    for (let k = 0; k < 22; k++) { const x = RR(-12, 12), z = RR(-12, 12); if (Math.hypot(x, z) < 6) continue; box(RR(0.3, 1.1), RR(0.15, 0.5), RR(0.3, 1.0), R() < 0.5 ? T.concD : T.char, x, 0, z, { ry: RR(0, PI), dirt: 0.5 }); }
    for (let k = 0; k < 6; k++) { const a = RR(0, 2 * PI), r = RR(6, 10); box(RR(0.8, 1.6), 0.08, RR(0.4, 0.9), T.grey, Math.cos(a) * r, 0.04, Math.sin(a) * r, { ry: RR(0, PI), dirt: 0.4 }); }
    // a crack down the collar's south face
    box(0.12, CH - 0.3, 0.06, T.dark, 1.1, 0.2, 6.02, T.nc);
  }
}

// The Great Uplink (IDEAS.md "Megastructures", the owner's look A, "Dish Array", Nov 2026): a 3 x 3 concrete pad (30 x 30
// world units, the middle of its nine tiles at the origin) holding one huge white dish, ribbed and tilted to the sky, a
// feed tripod over its middle, and three small dishes at the corners. Rendered on one wide frame like the Lance and the
// Orbital Lift (the pad's 30 units across 0.62 of it).
//   The dish: a ribbed paraboloid (panel seams in rings and spokes), on an alt-az mount (a turntable ring with a team band,
//   a yoke, the elevation bearings), tilted toward the south so its bright bowl is what you see from above; red rim lights
//   at night; the feed: three struts from the rim to a feed horn at the focus. Three small dishes on posts (north-west,
//   north-east, south-west) look elsewhere in the sky; a control hut (south-east) with a lit window band and a team
//   stripe, a power cabinet, cable trays to the Generators' side, and four floodlights at the dish's foot aimed up at it.
//   ?state=down   below 30% of its armor: the bowl holed and scorched, one feed strut snapped and the horn fallen to the
//                 pad, a small dish toppled, the hut's windows dark, rubble and scorch over the pad.
// Marks: 'feed' (the feed horn's mouth: the game's beam rises from it), 'dish' (the middle of the bowl), 'rim' (the bowl's
// highest rim point), 'rimL', 'rimR' (its sides), for the glow and rim lights drawn in code.
const Q = new URLSearchParams(location.search);
const DOWN = Q.get('state') === 'down';
const PI = Math.PI;
export const config = { pad: false };

export default function (L) {
  const { box, cyl, hcyl, hoop, sphere, mesh, group, mark, ao, pointLight, pipe, beam, M, THREE } = L;
  L.seed(8840 + (DOWN ? 7 : 0));
  L.longPad(30, 30);
  L.frameCompoundOpts({ half: 15.12, width: 0.62, cy: 0.6 });
  const R = L.rnd, RR = (a, b) => a + (b - a) * R();
  const dark = L.TOD === 'night' || L.TOD === 'evening', NB = L.TOD === 'night' ? 2.2 : L.TOD === 'evening' ? 1.5 : 1;
  const T = {
    conc: M.rough('#a39b8e'), concD: M.rough('#857d71'), concL: M.rough('#b5ad9f'),
    steel: M.steel, dark: M.dark, chrome: M.chrome, white: M.paint('#e9e7e1', { rivets: false, rough: 0.45 }),
    grey: M.paint('#5b6168', { metal: 0.4 }), greyD: M.paint('#41464c', { rivets: false, metal: 0.5 }), yellow: M.paint('#d8a92c'),
    team: M.paint(L.TEAM, { rivets: false, rough: 0.5 }), char: M.plain('#3a2f28', 0.95, 0), nc: { dirt: 0, cast: false },
  };
  const red = dark ? M.emit('#ff3a22', 3) : M.plain('#a0281c', 0.4, 0.1);
  const flood = dark && !DOWN ? M.emit('#f4f8ff', 3.2) : M.plain('#cfd6dc', 0.3, 0.3);
  const amber = dark && !DOWN ? M.emit('#ffc773', 1.8) : M.plain('#3b4652', 0.2, 0.3);

  // a straight member from a to b in `parent`'s own space (beam() aims in world space, so not inside a turned group)
  const strut = (a, b, w, h, mat, parent) => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), len = d.length();
    const m = mesh(new THREE.BoxGeometry(w, h, len), mat, 0, 0, 0, { parent, dirt: 0.2 });
    m.position.copy(A).add(B).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d.normalize()); return m;
  };
  ao(0, 0, 28, 28, 0.35);
  // ---- markings: a painted ring round the mount, a hazard ring, cable trays out to the pad's west edge
  {
    const ring = new THREE.RingGeometry(6.2, 6.7, 64); ring.rotateX(-PI / 2); mesh(ring, M.hazard, 0, 0.012, 1, T.nc);
    for (let k = 0; k < 12; k++) { const a = k * PI / 6; box(0.22, 0.02, 1.6, T.white, Math.cos(a) * 8.4, 0.012, 1 + Math.sin(a) * 8.4, { ry: -a + PI / 2, ...T.nc }); }
    for (const z of [-2.6, -1.6]) box(9.5, 0.18, 0.5, T.greyD, -9.6, 0, z, { dirt: 0.3 });
  }
  // ---- the mount: a round concrete plinth, the turntable (a team band round it), a yoke with two arms
  const MZ = 1, MY = 1.0;
  cyl(5.6, MY, T.concD, 0, 0, MZ, { seg: 48, dirt: 0.6, dirtH: 1 });
  cyl(4.4, 0.7, T.grey, 0, MY, MZ, { seg: 48, rTop: 4.2, dirt: 0.3 });
  { const band = cyl(4.25, 0.32, T.team, 0, MY + 0.7, MZ, { seg: 48, ...T.nc }); band.material = T.team; }
  hoop(4.25, 0.12, T.steel, 0, MY + 1.02, MZ);
  cyl(2.6, 2.4, T.white, 0, MY + 1.0, MZ, { seg: 32, rTop: 2.0, dirt: 0.4, dirtH: 2 });
  const AY = MY + 6.2; // the elevation axle's height
  for (const s of [-1, 1]) {
    box(1.1, AY - MY - 3.2, 2.2, T.white, s * 3.6, MY + 3.2, MZ, { dirt: 0.3 });
    beam([s * 1.8, MY + 3.4, MZ], [s * 3.6, MY + 3.4, MZ], 1.0, 0.6, T.white);
    hcyl(0.9, 1.2, T.greyD, s * 3.6, AY, MZ, { axis: 'x', dirt: 0.2 });
    hcyl(0.5, 1.5, T.chrome, s * 3.6, AY, MZ, { axis: 'x', dirt: 0 });
  }
  // a counterweight and the elevation rack behind it
  box(3.4, 1.6, 1.4, T.greyD, 0, AY - 3.4, MZ - 2.6, { dirt: 0.3 });

  // ---- the dish: a ribbed paraboloid, tilted a little to the north, its bowl to the sky: a big bright circle from above, its ribs showing at the back
  const DR = 9.4, F = 5.2, TILT = -0.28; // radius, focal length, tilt from straight up (radians)
  const dish = new THREE.Group(); dish.position.set(0, AY + 0.6, MZ); dish.rotation.x = TILT; L.group(0, 0, 0).add(dish);
  {
    const pts = []; for (let k = 0; k <= 24; k++) { const r = (k / 24) * DR; pts.push(new THREE.Vector2(r, (r * r) / (4 * F))); }
    const seam = L.canvasTex(512, (g, n) => {
      g.fillStyle = '#f2f1ec'; g.fillRect(0, 0, n, n);
      g.strokeStyle = 'rgba(120,128,138,0.55)'; g.lineWidth = 2;
      for (let k = 1; k < 8; k++) { const y = (k / 8) * n; g.beginPath(); g.moveTo(0, y); g.lineTo(n, y); g.stroke(); }
      for (let k = 0; k < 24; k++) { const x = (k / 24) * n; g.beginPath(); g.moveTo(x, n * 0.12); g.lineTo(x, n); g.stroke(); }
      for (let k = 0; k < 900; k++) { g.fillStyle = `rgba(150,150,140,${R() * 0.12})`; g.fillRect(R() * n, R() * n, 2, 2); }
    });
    const bowlM = new THREE.MeshStandardMaterial({ map: seam, roughness: 0.42, metalness: 0.12, side: THREE.DoubleSide, vertexColors: true });
    const geo = new THREE.LatheGeometry(pts, 72);
    mesh(geo, bowlM, 0, 0, 0, { parent: dish, dirt: 0.25, dirtH: 3 });
    // the back's ribs (a truss of spokes) and the rim
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * 2 * PI, ca = Math.cos(a), sa = Math.sin(a);
      for (let q = 0; q < 4; q++) {
        const r0 = 1.4 + q * 2.25, r1 = r0 + 2.25;
        strut([ca * r0, (r0 * r0) / (4 * F) - 0.55, sa * r0], [ca * r1, (r1 * r1) / (4 * F) - 0.55, sa * r1], 0.22, 0.6, T.grey, dish);
      }
    }
    const rim = new THREE.TorusGeometry(DR, 0.22, 8, 96); rim.rotateX(PI / 2); rim.translate(0, (DR * DR) / (4 * F), 0);
    mesh(rim, T.white, 0, 0, 0, { parent: dish, dirt: 0 });
    // a team band round the inside of the bowl, near the rim
    { const r0 = DR - 1.1, band = new THREE.TorusGeometry(r0, 0.2, 6, 96); band.rotateX(PI / 2); band.translate(0, (r0 * r0) / (4 * F) + 0.08, 0); mesh(band, T.team, 0, 0, 0, { parent: dish, ...T.nc }); }
    // the hub
    const hub = new THREE.CylinderGeometry(1.4, 1.7, 0.9, 24); hub.translate(0, -0.3, 0); mesh(hub, T.greyD, 0, 0, 0, { parent: dish, dirt: 0.2 });
    // red lights round the rim (the game blinks them at night)
    for (let k = 0; k < 10; k++) { const a = (k / 10) * 2 * PI + 0.2; sphere(0.2, red, Math.cos(a) * DR, (DR * DR) / (4 * F) + 0.25, Math.sin(a) * DR, { parent: dish, cast: false }); }
    // the feed: three struts from the rim to the horn at the focus (one snapped when it's down, the horn on the pad)
    const H = (DR * DR) / (4 * F);
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * 2 * PI + PI / 2, A = [Math.cos(a) * DR * 0.96, H, Math.sin(a) * DR * 0.96];
      if (DOWN && k === 1) { strut(A, [A[0] * 0.7, A[1] + 1.2, A[2] * 0.7], 0.26, 0.26, T.grey, dish); continue; }
      strut(A, [0, F - 0.5, 0], 0.26, 0.26, T.grey, dish);
    }
    if (!DOWN) {
      const horn = new THREE.CylinderGeometry(0.55, 0.95, 1.6, 24); horn.translate(0, F - 0.2, 0); mesh(horn, T.greyD, 0, 0, 0, { parent: dish, dirt: 0.1 });
      mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.25, 24).translate(0, F + 0.65, 0), T.team, 0, 0, 0, { parent: dish, ...T.nc });
      mark('feed', 0, F - 0.9, 0, dish);
    } else mark('feed', 0, F - 0.9, 0, dish);
    mark('dish', 0, H * 0.4, 0, dish);
    mark('rim', 0, H, -DR, dish); mark('rimL', -DR, H, 0, dish); mark('rimR', DR, H, 0, dish); mark('rimS', 0, H, DR, dish);
    if (DOWN) {
      // holes and scorch on the bowl: dark patches laid on its face
      for (let k = 0; k < 7; k++) {
        const r = RR(2.0, DR - 1.4), a = RR(0, 2 * PI), x = Math.cos(a) * r, z = Math.sin(a) * r, y = (r * r) / (4 * F) + 0.06;
        const g = new THREE.CircleGeometry(RR(0.7, 1.5), 14); g.rotateX(-PI / 2);
        mesh(g, new THREE.MeshBasicMaterial({ color: k < 3 ? '#0d0b0a' : '#3a302a', transparent: true, opacity: RR(0.65, 0.9), depthWrite: false, side: THREE.DoubleSide }), x, y, z, { parent: dish, rx: -Math.atan2(z, 2 * F) * 0, ...T.nc });
      }
    }
  }
  // ---- the fallen horn, on the pad
  if (DOWN) { const g = group(4.2, 0.6, 7.4, 0.7); hcyl(0.75, 1.8, T.char, 0, 0, 0, { axis: 'x', parent: g, dirt: 0.4 }); box(0.4, 0.3, 3.6, T.grey, 1.2, -0.3, -1.6, { parent: g, dirt: 0.4 }); }

  // ---- three small dishes on posts, each looking at a different part of the sky (one toppled when it's down)
  const smalls = [[-11.2, -10.6, 0.6, 2.1], [11.2, -10.6, -0.7, 4.0], [-11.2, 10.4, 0.5, 5.6]];
  for (const [x, z, ry, az] of smalls) {
    const toppled = DOWN && x > 0;
    box(2.4, 0.4, 2.4, T.concD, x, 0, z, { dirt: 0.6 });
    if (toppled) {
      const g = group(x + 0.6, 0.45, z + 0.6, ry);
      const pts = []; for (let k = 0; k <= 10; k++) { const r = (k / 10) * 2.4; pts.push(new THREE.Vector2(r, (r * r) / 6)); }
      const d = mesh(new THREE.LatheGeometry(pts, 32), T.white, 0, 0.8, 0, { parent: g, rx: 1.9, dirt: 0.5 }); d.material = T.white;
      box(0.3, 0.3, 2.6, T.grey, 0, 0, -1.6, { parent: g, dirt: 0.4 });
      continue;
    }
    cyl(0.32, 3.2, T.grey, x, 0.4, z, { seg: 12, dirt: 0.3 });
    const g = new THREE.Group(); g.position.set(x, 3.8, z); g.rotation.set(0.6, az, 0, 'YXZ'); L.group(0, 0, 0).add(g);
    const pts = []; for (let k = 0; k <= 10; k++) { const r = (k / 10) * 2.4; pts.push(new THREE.Vector2(r, (r * r) / 6)); }
    const d = mesh(new THREE.LatheGeometry(pts, 32), T.white, 0, 0, 0, { parent: g, dirt: 0.2 }); d.material = d.material.clone(); d.material.side = THREE.DoubleSide;
    strut([0, 0, 0], [0, 1.6, 0], 0.12, 0.12, T.grey, g);
    sphere(0.2, T.greyD, 0, 1.7, 0, { parent: g });
    sphere(0.12, red, x, 3.4, z + 0.35, { cast: false });
  }
  // ---- the control hut (south-east): white, a team stripe, a lit window band; a power cabinet and a fuel line
  {
    const x = 10.2, z = 9.8;
    box(5.4, 2.6, 4.0, T.white, x, 0, z, { dirt: 0.5, dirtH: 2.6 });
    box(5.6, 0.22, 4.2, T.concL, x, 2.6, z, { dirt: 0.3 });
    box(5.42, 0.26, 4.02, T.team, x, 2.24, z, T.nc);
    box(4.4, 0.55, 0.06, amber, x, 1.3, z + 2.01, T.nc);
    box(0.06, 0.55, 3.0, amber, x - 2.71, 1.3, z, T.nc);
    box(0.8, 1.6, 0.06, T.greyD, x + 1.9, 0, z + 2.02, T.nc);
    cyl(0.18, 1.6, T.steel, x + 1.8, 2.82, z - 1.2, { seg: 10 });
    hcyl(0.1, 2.4, T.steel, x + 1.8, 4.4, z - 1.2, { axis: 'x' });
    box(1.4, 1.8, 0.9, T.grey, -13.0, 0, -0.2, { dirt: 0.4 });
    box(1.42, 0.2, 0.92, M.hazard, -13.0, 1.5, -0.2, T.nc);
    pipe([[-14.6, 0.35, 4.6], [-10.0, 0.35, 4.6], [-5.0, 0.6, 3.0]], 0.2, M.paint('#b8452e', { rivets: false }));
  }
  // ---- four floodlights at the dish's foot, aimed up at it
  for (const [x, z] of [[-6.2, -4.6], [6.2, -4.6], [-6.4, 6.2], [6.4, 6.2]]) {
    box(0.9, 0.5, 0.9, T.concD, x, 0, z, { dirt: 0.5 });
    const g = group(x, 0.9, z, Math.atan2(x, z - MZ));
    box(0.7, 0.45, 0.4, T.greyD, 0, 0, 0, { parent: g, dirt: 0.2 });
    box(0.56, 0.06, 0.32, flood, 0, 0.45, 0, { parent: g, cast: false, dirt: 0 });
    if (dark && !DOWN) pointLight('#eef4ff', 9 * NB, x * 0.8, 1.6, MZ + (z - MZ) * 0.8, 14);
  }
  if (dark && !DOWN) { pointLight('#ffffff', 6 * NB, 0, AY + 2, MZ + 6, 16); pointLight('#ffd9a6', 2.5 * NB, 10.2, 1.8, 12.4, 6); }

  // ---- battle damage: scorch on the pad, rubble and torn panels strewn over it
  if (DOWN) {
    for (let k = 0; k < 9; k++) {
      const x = RR(-12, 12), z = RR(-12, 12), r = RR(1.2, 3.2);
      const geo = new THREE.CircleGeometry(r, 18); geo.rotateX(-PI / 2);
      const m = mesh(geo, new THREE.MeshBasicMaterial({ color: '#16110d', transparent: true, opacity: RR(0.45, 0.75), depthWrite: false }), x, 0.02 + k * 0.001, z, T.nc); m.userData.decal = true;
    }
    for (let k = 0; k < 22; k++) { const x = RR(-13, 13), z = RR(-13, 13); if (Math.hypot(x, z - MZ) < 5.5) continue; box(RR(0.3, 1.1), RR(0.15, 0.5), RR(0.3, 1.0), R() < 0.5 ? T.concD : T.char, x, 0, z, { ry: RR(0, PI), dirt: 0.5 }); }
    for (let k = 0; k < 8; k++) { const a = RR(0, 2 * PI), r = RR(7, 12); box(RR(1.0, 2.2), 0.08, RR(0.6, 1.2), T.white, Math.cos(a) * r, 0.04, MZ + Math.sin(a) * r, { ry: RR(0, PI), dirt: 0.6 }); }
  }
}

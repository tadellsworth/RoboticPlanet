// Disruptor Tower: slim graphite mast on a heavy octagonal base (capacitor banks, cable bundles, cooling fan,
// warning stripes, team-colour light band), three stacked copper-and-steel induction coils with ceramic insulators,
// and a glass-and-steel orb on top. Coils and orb glow ice blue #8fd8ff for every team.
//   ?part=pulse   only the coils and orb, blindingly bright (body kept as depth so hidden parts stay hidden)
// Marks c<k>L / c<k>R (coil rims), c<k>F, orb, orbL, orbR for the arcs drawn on the pulse overlay.
export default function (L) {
  const { box, cyl, hcyl, beam, pipe, hoop, lamp, pointLight, ao, mesh, sphere, group, mark, M, THREE, TEAM } = L;
  const part = new URLSearchParams(location.search).get('part') || 'tower';
  const PULSE = part === 'pulse';
  L.seed(523);
  const ICE = '#8fd8ff';
  const armor = M.paint('#4c5258'), graphite = M.paint('#33373c', { rivets: false, metal: 0.45, rough: 0.5 }), off = M.paint('#c7c2b6', { rivets: false });
  const glow = M.emit(TEAM, 2.6), olive = M.paint('#5d6247');
  const copper = new THREE.MeshStandardMaterial({ color: '#b5653a', roughness: 0.38, metalness: 0.85, vertexColors: true }); copper.envMapIntensity = 0.9;
  const ceramic = new THREE.MeshStandardMaterial({ color: '#e9e4d8', roughness: 0.22, metalness: 0, vertexColors: true }); ceramic.envMapIntensity = 0.7;
  const iceCore = PULSE ? M.emit('#bfeaff', 3.2) : new THREE.MeshStandardMaterial({ color: '#000000', emissive: ICE, emissiveIntensity: 0.8, roughness: 0.6 });
  iceCore.userData.glow = ICE;
  const iceWire = PULSE ? M.emit(ICE, 2.2) : copper;
  const pulseSet = new Set();
  const P = m => { pulseSet.add(m); return m; };
  const cz = -0.3;

  // ---- base
  cyl(3.15, 0.26, M.concrete, 0, 0, cz, { seg: 8, ry: Math.PI / 8 }); ao(0, cz, 5.8, 5.8, 0.55);
  cyl(2.45, 1.35, armor, 0, 0.26, cz, { rTop: 2.2, seg: 8, ry: Math.PI / 8 });
  // warning stripes round the top edge, team light band round the middle
  cyl(2.23, 0.2, M.hazard, 0, 1.43, cz, { rTop: 2.2, seg: 8, ry: Math.PI / 8, dirt: 0 });
  cyl(2.41, 0.11, glow, 0, 0.82, cz, { rTop: 2.39, seg: 8, ry: Math.PI / 8, cast: false, dirt: 0 });
  cyl(2.0, 0.14, M.steel, 0, 1.61, cz, { seg: 8, ry: Math.PI / 8, dirt: 0 });

  // capacitor banks on the four diagonal faces: racks of big cans in a steel frame
  for (const k of [1, 3, 5, 7]) {
    const a = k * Math.PI / 4, g = group(0, 0, cz, a);
    box(1.35, 0.95, 0.42, M.dark, 0, 0.26, 2.42, { parent: g, dirt: 0.3 });
    for (const x of [-0.42, 0, 0.42]) {
      cyl(0.17, 0.78, off, x, 0.28, 2.68, { parent: g, dirt: 0.4 });
      cyl(0.13, 0.08, M.dark, x, 1.06, 2.68, { parent: g, dirt: 0 });
      cyl(0.04, 0.12, M.chrome, x - 0.05, 1.12, 2.68, { parent: g, dirt: 0 });
    }
    box(1.4, 0.08, 0.5, M.steel, 0, 1.18, 2.5, { parent: g, dirt: 0 });
    // cable bundle from the bank up into the deck
    for (const dx of [-0.25, 0, 0.25]) pipe([[dx, 1.15, 2.62], [dx, 1.42, 2.62], [dx * 0.8, 1.66, 1.95]], 0.055, M.dark, { parent: g });
  }
  // cooling fan on the front face
  {
    const g = group(0, 0, cz, 0);
    box(1.15, 1.0, 0.3, armor, 0, 0.32, 2.38, { parent: g, dirt: 0.2 });
    hcyl(0.42, 0.12, M.dark, 0, 0.82, 2.55, { axis: 'z', parent: g, seg: 32 });
    for (let i = 0; i < 5; i++) { const b = box(0.12, 0.38, 0.03, M.steel, 0, 0.82, 2.62, { parent: g, dirt: 0 }); b.position.y = 0.82; b.rotation.z = i * Math.PI * 2 / 5 + 0.3; b.rotation.y = 0.35; }
    cyl(0.08, 0.06, M.steel, 0, 0.82, 2.66, { parent: g });
    hoop(0.43, 0.03, M.steel, 0, 0.82, 2.62, { parent: g }).rotation.x = Math.PI / 2;
    for (const y of [0.6, 0.82, 1.04]) box(0.88, 0.025, 0.03, M.steel, 0, y, 2.64, { parent: g, dirt: 0 });
  }

  // ---- mast plinth and mast
  const MY = 1.75;
  cyl(1.35, 0.55, graphite, 0, MY, cz, { rTop: 0.95, seg: 8, ry: Math.PI / 8, dirt: 0 });
  cyl(0.98, 0.1, M.steel, 0, MY + 0.55, cz, { seg: 8, ry: Math.PI / 8, dirt: 0 });
  cyl(0.4, 7.0, graphite, 0, MY + 0.6, cz, { rTop: 0.3, seg: 8, ry: Math.PI / 8, dirt: 0 });
  for (const y of [2.62]) cyl(0.5, 0.12, M.steel, 0, y, cz, { seg: 8, ry: Math.PI / 8, dirt: 0 });

  // ---- three induction coils, smaller toward the top
  const coil = (k, y0, R, turns) => {
    const pitch = 0.3, h = turns * pitch;
    cyl(R + 0.16, 0.12, M.steel, 0, y0, cz, { seg: 40, dirt: 0 });                       // bottom flange
    cyl(R + 0.16, 0.12, M.steel, 0, y0 + h + 0.12, cz, { seg: 40, dirt: 0 });            // top flange
    P(cyl(R + 0.015, h, iceCore, 0, y0 + 0.12, cz, { seg: 40, cast: false, dirt: 0 }));   // glowing core between the turns
    for (let i = 0; i < turns; i++) P(hoop(R, 0.058, iceWire, 0, y0 + 0.12 + (i + 0.5) * pitch, cz));
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; box(0.09, h + 0.12, 0.09, M.steel, Math.cos(a) * (R + 0.11), y0 + 0.06, cz + Math.sin(a) * (R + 0.11), { dirt: 0 }); }
    const ym = y0 + 0.12 + h / 2;
    mark(`c${k}L`, -R, ym, cz); mark(`c${k}R`, R, ym, cz); mark(`c${k}F`, 0, ym, cz + R);
    mark(`c${k}T`, 0, y0 + h + 0.24, cz); mark(`c${k}B`, 0, y0, cz);
    return y0 + h + 0.24;
  };
  const insul = (y0, y1, r) => { // ceramic insulator stack: alternating sheds
    const n = Math.max(2, Math.round((y1 - y0) / 0.13));
    for (let i = 0; i < n; i++) { const y = y0 + i * (y1 - y0) / n; cyl(i % 2 ? r * 0.72 : r, (y1 - y0) / n * 0.62, ceramic, 0, y, cz, { seg: 32, dirt: 0 }); }
  };
  let top = coil(1, 2.8, 1.0, 5);
  insul(top, top + 0.75, 0.55);
  top = coil(2, top + 0.75, 0.8, 4);
  insul(top, top + 0.7, 0.46);
  top = coil(3, top + 0.7, 0.62, 3);
  insul(top, top + 0.6, 0.38);

  // ---- orb: steel collar, glass shell, glowing core, steel cage, lightning rod
  const OY = top + 0.6 + 0.25 + 0.66;
  cyl(0.48, 0.25, M.steel, 0, top + 0.6, cz, { rTop: 0.3, dirt: 0 });
  const core = P(sphere(0.4, PULSE ? M.emit('#e6f8ff', 9) : M.emit(ICE, 1.7), 0, OY, cz, { cast: false }));
  const glass = new THREE.MeshPhysicalMaterial({ color: '#d6f2ff', roughness: 0.05, metalness: 0, transparent: true, opacity: 0.28, envMapIntensity: 1.4, clearcoat: 0.9 });
  if (!PULSE) sphere(0.66, glass, 0, OY, cz, { cast: false, dirt: 0 });
  for (let i = 0; i < 3; i++) { const h = hoop(0.68, 0.035, M.steel, 0, OY, cz); h.rotation.set(Math.PI / 2, i * Math.PI / 3, 0, 'YXZ'); }
  hoop(0.685, 0.04, M.steel, 0, OY, cz);
  cyl(0.18, 0.16, M.steel, 0, OY + 0.64, cz, { rTop: 0.1, dirt: 0 });
  cyl(0.035, 0.75, M.chrome, 0, OY + 0.8, cz, { dirt: 0 });
  sphere(0.06, M.chrome, 0, OY + 1.56, cz, {});
  mark('orb', 0, OY, cz); mark('orbL', -0.66, OY, cz); mark('orbR', 0.66, OY, cz); mark('orbB', 0, OY - 0.66, cz);
  if (!PULSE) pointLight(ICE, 7, 0, OY, cz + 1.2, 4);

  if (PULSE) {
    const depthOnly = new THREE.MeshBasicMaterial({ colorWrite: false });
    L.hidePad();
    L.getRoot().traverse(o => {
      if (!o.isMesh || pulseSet.has(o)) return;
      if (o.userData.decal) { o.visible = false; return; }
      o.material = depthOnly; o.castShadow = false; o.renderOrder = -10;
    });
  }
}

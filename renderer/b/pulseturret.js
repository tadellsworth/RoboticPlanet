// Pulse Turret, rendered in layers on the shared pad framing.
//   ?part=base            plinth + empty turret ring on the pad (never moves)
//   ?part=head&rot=k&n=N  the gun head alone, turned to direction k of N (0 = east, then clockwise seen from above:
//                         1/8 turn = down-right toward the viewer). Camera and light never move.
export default function (L) {
  const { box, cyl, hcyl, beam, pipe, hoop, lamp, pointLight, ao, mesh, sphere, group, mark, M, THREE, TEAM } = L;
  const chargeSet = new Set();
  const p = new URLSearchParams(location.search), part = p.get('part') || 'base', rot = +(p.get('rot') || 0), n = +(p.get('n') || 8);
  const gun = M.paint('#4b5157'), armor = M.paint('#5d6369'), olive = M.paint('#5d6247'), glow = M.emit(TEAM, 2.4);
  L.seed(231);
  const RING_Y = 1.65;   // top of the turret ring: the head's pivot sits here, identical in every frame

  // ---- base layer
  const base = group(0, 0, 0, 0);
  cyl(2.75, 0.35, M.concrete, 0, 0, 0, { seg: 8, ry: Math.PI / 8, parent: base });
  cyl(2.4, 1.05, armor, 0, 0.35, 0, { rTop: 2.05, seg: 8, ry: Math.PI / 8, parent: base });
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2 + Math.PI / 4, g = group(0, 0, 0, -a, base);
    box(0.85, 0.6, 0.22, gun, 0, 0.55, 2.26, { parent: g, dirt: 0 });
    box(0.6, 0.12, 0.05, glow, 0, 0.92, 2.38, { parent: g, cast: false });
    box(0.6, 0.12, 0.05, glow, 0, 0.72, 2.38, { parent: g, cast: false });
  }
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2, g = group(0, 0, 0, -a, base); box(1.2, 0.1, 0.08, M.hazard, 0, 1.15, 2.3, { parent: g, dirt: 0 }); }
  cyl(1.75, 0.25, M.steel, 0, 1.4, 0, { seg: 40, dirt: 0, parent: base });
  cyl(1.3, 0.02, M.dark, 0, RING_Y, 0, { seg: 40, dirt: 0, cast: false, parent: base });
  hoop(1.58, 0.06, glow, 0, RING_Y, 0, { cast: false, parent: base });
  for (const [x, z] of [[-3.0, 2.6], [3.1, 2.6]]) { box(1.0, 0.7, 0.7, olive, x, 0, z, { parent: base }); box(1.02, 0.1, 0.72, M.hazard, x, 0.4, z, { parent: base, dirt: 0 }); }
  pipe([[-2.2, 0.25, 0.9], [-3.4, 0.25, 0.9], [-3.4, 0.25, 4.0]], 0.1, M.dark, { parent: base });
  pipe([[2.2, 0.25, -0.9], [3.6, 0.25, -0.9], [3.6, 0.25, -4.0]], 0.1, M.dark, { parent: base });
  box(0.12, 0.012, 3.6, M.hazard, -2.9, 0, -2.4, { parent: base, dirt: 0, cast: false });

  // ---- head layer: rounded armoured head, twin pulse barrels with glowing coils; built pointing +x (east)
  const head = group(0, RING_Y, 0, 0);
  cyl(1.15, 0.28, gun, 0, 0, 0, { seg: 40, parent: head, dirt: 0 });
  const shell = new THREE.SphereGeometry(1.1, 36, 18, 0, Math.PI * 2, 0, Math.PI / 2); shell.scale(1.15, 0.75, 1.0);
  mesh(shell, armor, -0.05, 0.28, 0, { parent: head, dirt: 0 });
  box(1.1, 0.5, 1.5, gun, -0.95, 0.28, 0, { parent: head, dirt: 0 });
  box(0.7, 0.14, 1.2, glow, -1.05, 0.62, 0, { parent: head, cast: false });
  box(0.9, 0.55, 1.0, gun, 0.75, 0.4, 0, { parent: head, dirt: 0 });
  for (const dz of [-0.3, 0.3]) {
    hcyl(0.15, 2.2, M.steel, 2.0, 0.68, dz, { axis: 'x', parent: head });
    hcyl(0.2, 0.32, M.dark, 3.05, 0.68, dz, { axis: 'x', parent: head });
    for (const x of [1.3, 1.7, 2.1]) chargeSet.add(mesh(new THREE.TorusGeometry(0.2, 0.06, 8, 24), glow, x, 0.68, dz, { ry: Math.PI / 2, parent: head, cast: false, dirt: 0 }));
    const k = dz < 0 ? 0 : 1;
    mark('tip' + k, 3.32, 0.68, dz, head); mark('tip' + k + 'f', 4.32, 0.68, dz, head);
    for (const x of [1.3, 1.7, 2.1]) mark(`coil${k}-${x}`, x, 0.68, dz, head);
  }
  box(0.6, 0.06, 0.9, M.hazard, 0.3, 1.03, 0, { parent: head, dirt: 0 });
  chargeSet.add(sphere(0.12, M.emit(TEAM, 3), 3.24, 0.68, -0.3, { parent: head, cast: false })); chargeSet.add(sphere(0.12, M.emit(TEAM, 3), 3.24, 0.68, 0.3, { parent: head, cast: false }));
  // clockwise seen from above: east -> toward the viewer (+z) -> west -> away (-z)
  head.scale.setScalar(1.25); head.rotation.y = -rot * (Math.PI * 2 / n);

  if (part === 'base') { head.visible = false; ao(0, 0, 4.9, 4.9, 0.5); pointLight(TEAM, 5, 0, 1.2, 2.6, 3.5); }
  else { base.visible = false; L.hidePad(); }
  // ?part=charge: only the barrel coils and muzzle tips, lit as a white mask (recoloured later); the rest of the head stays as depth
  if (part === 'charge') {
    const lit = new THREE.MeshBasicMaterial({ color: 0xffffff }); lit.userData.glow = '#ffffff';
    const depthOnly = new THREE.MeshBasicMaterial({ colorWrite: false });
    L.getRoot().traverse(o => { if (!o.isMesh) return; if (o.userData.decal) { o.visible = false; return; }
      if (chargeSet.has(o)) o.material = lit; else { o.material = depthOnly; o.castShadow = false; o.renderOrder = -10; } });
  }
}

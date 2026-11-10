// Bio Farm: glass polytunnel with racks of plants under pink grow lights, glowing pink bioreactor columns, nutrient tanks.
export default function (L) {
  const { box, cyl, hcyl, beam, pipe, hoop, lamp, pointLight, ao, mesh, sphere, rnd, M, THREE, ACCENT } = L;
  const gun = M.paint('#50565c'), off = M.paint('#c9c5ba'), warm = M.paint('#8c8579');
  const leaf = [M.plain('#3f8a3a', 0.8), M.plain('#5aa84a', 0.8), M.plain('#2f6a30', 0.8)];
  L.seed(121);

  // polytunnel greenhouse (back), glass over plant racks lit pink
  const gx = -0.7, gz = -2.0, GL = 6.8, GR = 1.75;
  box(GL + 0.3, 0.35, 2 * GR + 0.3, M.concrete, gx, 0, gz); ao(gx, gz, GL + 0.3, 2 * GR + 0.3, 0.5);
  for (const dz of [-0.95, 0, 0.95]) {
    box(GL - 0.6, 0.5, 0.55, gun, gx, 0.35, gz + dz, { dirt: 0 });
    for (let x = -GL / 2 + 0.55; x < GL / 2 - 0.4; x += 0.32) sphere(0.14 + rnd() * 0.05, leaf[Math.floor(rnd() * 3)], gx + x, 0.95, gz + dz + (rnd() - 0.5) * 0.18, { cast: false });
    box(GL - 0.8, 0.05, 0.12, M.emit(ACCENT, 2.6), gx, 1.75, gz + dz, { cast: false });
  }
  pointLight(ACCENT, 14, gx, 1.6, gz + 0.6, 5);
  const glass = new THREE.MeshPhysicalMaterial({ color: '#f2e6f0', roughness: 0.05, transparent: true, opacity: 0.2, clearcoat: 1, depthWrite: false }); glass.envMapIntensity = 1.6;
  const tun = new THREE.CylinderGeometry(GR, GR, GL, 40, 1, false, Math.PI / 2, Math.PI); tun.rotateZ(Math.PI / 2); tun.rotateX(Math.PI / 2);
  mesh(tun, glass, gx, 0.35, gz, { cast: false, dirt: 0 });
  for (let x = -GL / 2; x <= GL / 2 + 0.01; x += GL / 7) { const r = new THREE.TorusGeometry(GR, 0.05, 8, 40, Math.PI); mesh(r, gun, gx + x, 0.35, gz, { ry: Math.PI / 2, dirt: 0 }); }
  beam([gx - GL / 2, 0.35 + GR, gz], [gx + GL / 2, 0.35 + GR, gz], 0.08, 0.08, gun);

  // bioreactor columns (front right): glass tubes of glowing pink culture
  const bx = 1.9, bz = 2.3;
  box(3.4, 0.3, 1.5, gun, bx + 0.6, 0, bz); ao(bx + 0.6, bz, 3.4, 1.5, 0.5);
  const culture = new THREE.MeshStandardMaterial({ color: '#ff6fd8', emissive: ACCENT, emissiveIntensity: 0.5, roughness: 0.15, metalness: 0.05 });
  culture.envMapIntensity = 1.4; culture.userData.glow = '#7a2468';
  for (let i = 0; i < 4; i++) {
    const x = bx - 0.45 + i * 0.85;
    cyl(0.34, 3.7, culture, x, 0.45, bz, { seg: 28, dirt: 0 });
    for (let k = 0; k < 5; k++) sphere(0.05, M.emit('#ffe6f8', 1.5), x + (rnd() - 0.5) * 0.3, 0.8 + rnd() * 3.1, bz + 0.33, { cast: false });
    for (const a of [-0.9, 0.9]) box(0.05, 3.7, 0.05, M.steel, x + Math.sin(a) * 0.36, 0.45, bz + Math.cos(a) * 0.36, { dirt: 0 });
    cyl(0.42, 0.22, M.steel, x, 0.3, bz, { seg: 28, dirt: 0 }); cyl(0.42, 0.26, M.steel, x, 4.1, bz, { seg: 28, dirt: 0 });
    hoop(0.37, 0.04, M.steel, x, 1.6, bz); hoop(0.37, 0.04, M.steel, x, 2.9, bz);
  }
  pipe([[bx - 0.45, 4.35, bz], [bx - 0.45, 4.6, bz], [bx + 2.1, 4.6, bz], [bx + 2.1, 4.35, bz]], 0.08, M.steel);
  pipe([[bx - 1.0, 0.35, bz], [gx + 1.5, 0.35, bz], [gx + 1.5, 0.35, gz + GR + 0.2]], 0.1, M.steel);
  pointLight(ACCENT, 7, bx + 0.8, 2.0, bz + 1.2, 4);

  // nutrient tanks (front left) and a small control kiosk
  for (const z of [1.7, 3.0]) { box(0.25, 0.5, 0.9, M.steel, -3.9, 0, z); box(0.25, 0.5, 0.9, M.steel, -2.3, 0, z); hcyl(0.55, 2.3, off, -3.1, 0.95, z, { axis: 'x' }); }
  ao(-3.1, 2.35, 2.6, 2.4, 0.5);
  box(1.2, 1.5, 1.0, off, -0.6, 0, 3.2); box(1.3, 0.12, 1.1, gun, -0.6, 1.5, 3.2, { dirt: 0 }); ao(-0.6, 3.2, 1.2, 1.0, 0.45);
  box(0.7, 0.35, 0.05, M.emit(ACCENT, 1.4), -0.6, 0.85, 3.71, { cast: false });
  lamp(gx + GL / 2 + 0.15, 1.2, gz + GR, ACCENT, { size: 0.14, intensity: 2, dist: 2, k: 2.4 });
}

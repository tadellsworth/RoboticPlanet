// Bio Farm: glass polytunnel with racks of plants under pink grow lights, glowing pink bioreactor columns, nutrient tanks.
// Powered realism: a lights-and-electricity layer from b/powerkit.js (team-colour strips along the polytunnel's ridge,
// base and end arches, on the bioreactor plinth and column caps, yard lamp posts, a transformer yard with a junction box
// feeding the tunnel, status lights, beacons). Its lights are team-coloured: render one image per team. Base render only.
import { power } from './powerkit.js';
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
  // ================================================================ power layer (lights and electricity), base render only
  const PART = new URLSearchParams(location.search).get('part');
  if (!PART || PART === 'base') {
    const K = power(L), nc = { dirt: 0, cast: false };
    // team light strips: along the polytunnel's ridge and base, its two end arches, the bioreactor plinth, a ring on
    // each column cap, and the kiosk's eave
    K.strip(GL, gx, 0.35 + GR + 0.06, gz, 0, 0.05);
    K.strip(GL + 0.3, gx, 0.33, gz + GR + 0.17);
    for (const s of [-1, 1]) { const r = new THREE.TorusGeometry(GR + 0.05, 0.028, 6, 40, Math.PI); mesh(r, K.glow, gx + s * GL / 2, 0.35, gz, { ry: Math.PI / 2, dirt: 0, cast: false }); }
    K.strip(3.4, bx + 0.6, 0.28, bz + 0.77);
    for (let i = 0; i < 4; i++) L.hoop(0.43, 0.03, K.glow, bx - 0.45 + i * 0.85, 4.23, bz, { cast: false });
    K.strip(1.3, -0.6, 1.6, 3.77);
    // status lights on the nutrient tanks' saddles, a lit door on the kiosk's side
    for (const z of [1.7, 3.0]) for (const [k, m] of [[-0.12, K.green], [0.12, K.amber]]) box(0.06, 0.06, 0.03, m, -2.3 + k, 0.38, z + 0.46, nc);
    // lamp posts in the yard between the tunnel and the kiosk
    K.flood(-2.1, 0.75, 2.3, 0.35);
    K.flood(0.35, 0.95, 2.3, -0.35);
    // transformer yard in the back-right corner, a junction box and a conduit into the tunnel's base, a cable up to
    // the end arch
    const qx = 3.8, qz = -3.0;
    box(1.25, 0.03, 1.05, K.dark, qx, 0, qz, { dirt: 0, cast: false });
    for (const [w, d, x, z] of [[1.25, 0.08, qx, qz - 0.52], [1.25, 0.08, qx, qz + 0.52], [0.08, 1.05, qx - 0.62, qz], [0.08, 1.05, qx + 0.62, qz]]) box(w, 0.04, d, M.hazard, x, 0, z, { dirt: 0, cast: false });
    K.transformer(qx, qz, 0);
    K.junction(3.8, -1.55, 0);
    K.conduit([[qx, 0.14, qz + 0.35], [qx, 0.14, -1.77]], 0.05);
    K.conduit([[3.52, 0.3, -1.55], [gx + GL / 2 + 0.15, 0.3, -1.55]], 0.05);
    K.cable([qx - 0.28, 1.17, qz], [gx + GL / 2 + 0.05, 0.35 + GR - 0.1, gz - 0.5], 0.25);
    // beacons: team on the bioreactor's top manifold ends, amber on the kiosk
    for (const x of [bx - 0.45, bx + 2.1]) K.beacon(x, 4.78, bz);
    K.beacon(-0.25, 1.72, 2.95, '#ffb347');
  }
  // ---------------------------------------------------------------- end of power layer
}

// Trader ship: a small boxy cargo spaceship hovering, seen from the building camera angle (57 degrees, FOV 20) with the
// buildings' sun; no ground, no shadow. Battered white-and-orange hull, two stubby thruster pods glowing pale blue
// underneath, a belly cargo hatch with a winch line and hook, landing lights. Ship = about 75 % of the width.
export const config = { pad: false, size: 512 };
export default function (L) {
  const { box, cyl, hcyl, mesh, beam, sphere, group, pointLight, M, THREE } = L;
  L.seed(8080);
  const hull = M.paint('#dcd8cc'), hullD = M.paint('#b9b4a6'), orange = M.paint('#d8742a'), orangeD = M.paint('#a9561e', { rivets: false });
  const gun = M.paint('#50565c'), gunD = M.paint('#3f4449'), glassD = M.plain('#0e1114', 0.12, 0.6);
  const blue = '#9fe0ff';

  // ---- main hull: a chamfered box (profile in z,y extruded along x), cockpit block at the front (+x)
  const X0 = -2.6, X1 = 1.7, HZ = 1.55, Y0 = -0.75, Y1 = 0.75, CH = 0.32;
  {
    const sh = new THREE.Shape(); sh.moveTo(-HZ + CH, Y0); sh.lineTo(-HZ, Y0 + CH); sh.lineTo(-HZ, Y1 - CH); sh.lineTo(-HZ + CH, Y1); sh.lineTo(HZ - CH, Y1); sh.lineTo(HZ, Y1 - CH); sh.lineTo(HZ, Y0 + CH); sh.lineTo(HZ - CH, Y0); sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: X1 - X0, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2 });
    g.rotateY(Math.PI / 2); g.translate(X0, 0, 0);
    mesh(g, hull, 0, 0, 0, { dirt: 0.5, dirtH: 1.4 });
  }
  // orange livery: a band round the middle, the tail block, roof panels
  box(1.1, Y1 - Y0 + 0.1, HZ * 2 + 0.1, orange, -0.55, Y0 - 0.02, 0, { dirt: 0.4, dirtH: 1.2 });
  for (const s of [-1, 1]) { box(X1 - X0 - 0.2, 0.3, 0.05, orange, (X0 + X1) / 2, -0.25, s * (HZ + 0.07), { dirt: 0.3 }); box(X1 - X0 - 0.2, 0.05, 0.05, gunD, (X0 + X1) / 2, 0.08, s * (HZ + 0.08), { dirt: 0 }); }
  // swept tail fins with orange tips
  for (const s of [-1, 1]) {
    const fs = new THREE.Shape(); fs.moveTo(0, 0); fs.lineTo(0.95, 0); fs.lineTo(0.35, 0.75); fs.lineTo(0.0, 0.75); fs.closePath();
    const fg = new THREE.ExtrudeGeometry(fs, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1 });
    fg.translate(0, 0, -0.04);
    const fm = mesh(fg, hullD, X0 + 0.05, Y1 + 0.02, s * 1.0, { dirt: 0.3 }); fm.rotation.x = s * 0.45;
    box(0.36, 0.14, 0.1, orange, X0 + 0.25, Y1 + 0.66 * Math.cos(0.45) + 0.02, s * (1.0 + 0.6 * Math.sin(0.45)), { dirt: 0 });
  }
  box(0.55, 0.03, HZ * 2 - 0.7, orangeD, -1.9, Y1 + 0.04, 0, { dirt: 0 });
  for (const s of [-1, 1]) box(X1 - X0 - 0.4, 0.04, 0.16, orange, (X0 + X1) / 2, Y1 + 0.02, s * (HZ - 0.45), { dirt: 0 });
  // roof: spine with radiator fins, antenna, top beacon, a few dents/patches
  box(2.4, 0.22, 0.6, gun, -0.7, Y1, 0, { dirt: 0 });
  for (let k = 0; k < 9; k++) box(0.05, 0.22, 0.56, gunD, -1.8 + k * 0.27, Y1 + 0.22, 0, { dirt: 0 });
  cyl(0.03, 0.75, M.steel, 0.9, Y1, -0.95, { seg: 8, dirt: 0 });
  cyl(0.12, 0.1, gunD, -2.2, Y1, 0.9, { seg: 14, dirt: 0 }); sphere(0.09, M.emit('#ffa632', 2.0), -2.2, Y1 + 0.12, 0.9, { dirt: 0 });
  box(0.7, 0.025, 0.5, hullD, 0.6, Y1 + 0.01, 0.75, { dirt: 0.6 }); box(0.45, 0.025, 0.35, M.plain('#8a8378', 0.8), -1.35, Y1 + 0.01, -0.95, { dirt: 0.6 });
  // rear: engine bay grille and two small main nozzles
  box(0.12, 1.0, 2.2, gunD, X0 - 0.06, -0.5, 0, { dirt: 0 });
  box(0.04, 0.8, 1.9, M.grille('#3d4247'), X0 - 0.13, -0.4, 0, { dirt: 0 });
  // cockpit: a stepped-down nose block with a wraparound dark visor
  const NX0 = X1, NX1 = 2.75;
  {
    const sh = new THREE.Shape(); sh.moveTo(NX0, Y0 + 0.1); sh.lineTo(NX0, Y1 - 0.05); sh.lineTo(NX0 + 0.45, Y1 - 0.05); sh.lineTo(NX1, 0.1); sh.lineTo(NX1, Y0 + 0.25); sh.lineTo(NX1 - 0.25, Y0 + 0.1); sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: HZ * 2 - 0.5, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2 });
    g.translate(0, 0, -(HZ * 2 - 0.5) / 2);
    mesh(g, hull, 0, 0, 0, { dirt: 0.4, dirtH: 1.2 });
    beam([NX0 + 0.5, Y1 - 0.02, 0], [NX1 + 0.05, 0.12, 0], HZ * 2 - 0.7, 0.06, glassD);
    beam([NX0 + 0.45, Y1 - 0.0, 0], [NX0 + 0.5, Y1 - 0.0, 0], HZ * 2 - 0.6, 0.05, orange);
  }
  // ---- thruster pods on short pylons either side, nozzles glowing pale blue underneath
  for (const s of [-1, 1]) {
    const z = s * (HZ + 0.85);
    beam([-0.6, 0.05, s * HZ], [-0.6, 0.05, z], 0.5, 0.24, gun);
    hcyl(0.5, 1.7, hullD, -0.6, 0.05, z, { axis: 'x' });
    hcyl(0.52, 0.35, orange, -0.15, 0.05, z, { axis: 'x' });
    hcyl(0.53, 0.06, gunD, -1.25, 0.05, z, { axis: 'x' });
    sphere(0.5, hullD, 0.25, 0.05, z, {}).scale.set(0.7, 1, 1);
    cyl(0.36, 0.3, gunD, -0.6, -0.65, z, { seg: 28, dirt: 0, rTop: 0.3 });                          // nozzle bell
    L.hoop(0.37, 0.05, M.emit(blue, 2.4), -0.6, -0.64, z, {});
    const cone = new THREE.ConeGeometry(0.36, 1.5, 28, 1, true); cone.rotateX(Math.PI); cone.translate(0, -0.75, 0);
    const cm = new THREE.MeshBasicMaterial({ color: blue, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const c = new THREE.Mesh(cone, cm); c.position.set(-0.6, -0.68, z); L.getRoot().add(c);
    pointLight(blue, 6, -0.6, -1.0, z, 3);
    // landing lights on the pod tips: red port (north), green starboard (south)
    sphere(0.07, M.emit(s < 0 ? '#ff3a22' : '#3aff6a', 2.2), 0.55, 0.15, z, { dirt: 0 });
  }
  sphere(0.07, M.emit('#ffffff', 2.4), NX1 - 0.05, 0.2, 0, { dirt: 0 });
  for (const s of [-1, 1]) sphere(0.06, M.emit('#ffffff', 2.0), X0 + 0.05, Y1 - 0.1, s * (HZ - 0.15), { dirt: 0 });
  // ---- belly cargo hatch with a winch line and hook
  box(1.6, 0.06, 1.5, gunD, -0.4, Y0 - 0.05, 0, { dirt: 0 });
  box(1.4, 0.03, 0.08, M.hazard, -0.4, Y0 - 0.07, 0.76, { dirt: 0 });
  cyl(0.18, 0.12, gun, 0.95, Y0 - 0.2, 1.15, { seg: 18, dirt: 0 });
  cyl(0.02, 1.95, M.dark, 0.95, Y0 - 2.15, 1.15, { seg: 6, dirt: 0 });
  const hk = new THREE.TorusGeometry(0.11, 0.035, 8, 16, Math.PI * 1.4); hk.rotateZ(Math.PI * 0.8);
  mesh(hk, M.steel, 0.95, Y0 - 2.25, 1.15, { dirt: 0 });
  box(0.2, 0.16, 0.14, M.paint('#d0a536', { rivets: false }), 0.95, Y0 - 2.15, 1.15, { dirt: 0 });

  // ---- camera: building elevation and FOV, framed so the ship spans 75 % of the width, centred
  const ELEV = 57 * Math.PI / 180, cam = new THREE.PerspectiveCamera(20, 1, 0.5, 200);
  const D = new THREE.Vector3(0, -Math.sin(ELEV), -Math.cos(ELEV)), U = new THREE.Vector3(0, Math.cos(ELEV), -Math.sin(ELEV));
  const pr = v => { const q = v.clone().project(cam); return [(q.x + 1) / 2, (1 - q.y) / 2]; };
  let P = new THREE.Vector3(0.05, -0.3, 0).sub(D.clone().multiplyScalar(30));
  const A = new THREE.Vector3(X0 - 0.15, 0, 0), B = new THREE.Vector3(NX1 + 0.05, 0, 0), T = new THREE.Vector3(0, 1.2, -2.4), Bt = new THREE.Vector3(0, -3.0, 2.4);
  for (let i = 0; i < 200; i++) {
    cam.position.copy(P); cam.lookAt(P.clone().add(D)); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    const w = pr(B)[0] - pr(A)[0], cy = (pr(T)[1] + pr(Bt)[1]) / 2;
    P.add(D.clone().multiplyScalar((0.75 - w) * 25)); P.add(U.clone().multiplyScalar((0.5 - cy) * 6));
  }
  L.useCamera(cam);
}

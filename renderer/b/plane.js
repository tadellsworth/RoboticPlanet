// Cargo Plane: a big four-engined military transport, top-down, facing +x, orthographic camera straight down,
// no ground and no shadow plane (the game draws it on the ground or in the air, with its own shadow).
// 20 world units across the 1024-px frame; the plane is 19 long with a 18.6 span.
// A long, wide fuselage (a body of revolution: a rounded nose with the flight-deck glazing, an upswept tail over
// the cargo ramp), main-gear sponsons along its belly, a high wing swept back about 25 degrees with upturned
// winglets, four turbofans in pods hung forward of the wing on pylons, and a T-tail. Matte grey paint.
// Team colour: the fin cap and the tips of the tailplane, a roundel on each wing, and a thin cheat line.
// At night: navigation lights (red on the left wingtip, green on the right, white at the tail), a red
// anti-collision beacon on the spine, and the flight deck lit warm.
export const config = { pad: false, size: 1024 };
export default function (L) {
  const { box, cyl, hcyl, mesh, sphere, M, THREE, TEAM } = L;
  L.seed(907);
  const W = 20, cam = new THREE.OrthographicCamera(-W / 2, W / 2, W / 2, -W / 2, 0.1, 100);
  cam.position.set(0, 40, 0); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  L.useCamera(cam);

  const grey = M.paint('#69727a', { panelW: 512, rivets: false }), greyD = M.paint('#585f66', { rivets: false });
  const dark = M.plain('#1e2226', 0.6, 0.3), metal = M.plain('#8d9399', 0.35, 0.8);
  const team = M.paint('#' + new THREE.Color(TEAM).multiplyScalar(0.85).getHexString(), { rivets: false });
  const white = M.paint('#d9dcd8', { rivets: false });

  // ---- fuselage: a body of revolution along x (radius by station), its axis at height Y0
  const Y0 = 1.3, XN = 9.5, XT = -9.5;
  const prof = [[XT, 0.22], [-8.6, 0.42], [-7.4, 0.72], [-6.0, 1.0], [-4.6, 1.18], [-3.5, 1.22], [5.6, 1.22], [6.8, 1.16], [7.8, 1.0], [8.6, 0.74], [9.15, 0.44], [XN, 0.05]];
  const pts = prof.map(([x, r]) => new THREE.Vector2(r, x));
  const fus = new THREE.LatheGeometry(pts, 48);
  fus.rotateZ(-Math.PI / 2); // the lathe's y axis becomes +x
  mesh(fus, grey, 0, Y0, 0, { dirt: 0.15, dirtH: 2.4 });
  // the tail sweeps up over the cargo ramp: a fairing on the spine behind the wing, into the fin root
  { const g = new THREE.CapsuleGeometry(0.42, 4.6, 6, 16); g.rotateZ(Math.PI / 2); g.translate(-6.4, 0, 0); g.scale(1, 0.6, 1); mesh(g, M.plain('#68717a', 0.7, 0.15), 0, Y0 + 0.88, 0, { dirt: 0.1 }); }
  // flight-deck glazing round the nose, and the cheat line along each side
  const deck = M.plain('#151c22', 0.15, 0.2);
  for (const [x, w, z] of [[8.3, 0.5, 0.4], [8.3, 0.5, -0.4], [8.62, 0.34, 0.0]]) box(w, 0.08, 0.32, deck, x, Y0 + 0.8 - (x - 8.3) * 0.5, z, { dirt: 0, ry: z ? -Math.sign(z) * 0.35 : 0 });
  for (const s of [-1, 1]) box(12.4, 0.06, 0.06, team, 0.6, Y0 + 0.05, s * 1.2, { dirt: 0, cast: false });
  // main-gear sponsons along the belly, the paratroop doors and the escape hatches on the spine
  for (const s of [-1, 1]) {
    const g = new THREE.CapsuleGeometry(0.5, 4.0, 8, 16); g.rotateZ(Math.PI / 2); mesh(g, greyD, -1.2, Y0 - 0.6, s * 1.15, { dirt: 0.25 });
  }
  for (const x of [3.4, -4.4]) box(0.5, 0.04, 0.32, greyD, x, Y0 + 1.2, 0, { dirt: 0 });
  sphere(0.11, dark, 6.6, Y0 + 1.18, 0, { cast: false }); // a satcom dome

  // ---- the wing: high, swept, on the fuselage's shoulders; flaps and spoilers lined on its top
  const WY = Y0 + 1.05, span = 9.3;
  const LE = (z) => 2.7 - Math.abs(z) * 0.47, TE = (z) => (Math.abs(z) < 3.2 ? -2.0 + Math.abs(z) * 0.06 : -1.81 - (Math.abs(z) - 3.2) * 0.22);
  const wingShape = (s) => {
    const sh = new THREE.Shape(), zs = [0, 3.2, span];
    sh.moveTo(LE(0), 0);
    sh.lineTo(LE(span), s * span); sh.lineTo(TE(span), s * span);
    for (const z of zs.slice().reverse()) sh.lineTo(TE(z), s * z);
    sh.closePath();
    return sh;
  };
  for (const s of [-1, 1]) {
    const g = new THREE.ExtrudeGeometry(wingShape(s), { depth: 0.32, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2, curveSegments: 4 });
    g.rotateX(Math.PI / 2); // the shape's y becomes z; the extrude goes down
    mesh(g, grey, 0, WY + 0.32, 0, { dirt: 0.1, dirtH: 0.5 });
    // flap and spoiler lines along the trailing edge, and the aileron out by the tip
    for (let k = 0; k < 5; k++) {
      const z0 = 1.4 + k * 1.45, z1 = z0 + 1.3, zc = (z0 + z1) / 2;
      box(0.05, 0.03, z1 - z0, greyD, TE(zc) + 0.55, WY + 0.38, s * zc, { dirt: 0, cast: false, ry: s * (zc > 3.2 ? -0.21 : 0) });
    }
    // the winglet, turned up at the tip
    { const g2 = new THREE.BoxGeometry(1.0, 1.1, 0.12); g2.translate(0, 0.55, 0); const m = mesh(g2, grey, (LE(span) + TE(span)) / 2 - 0.15, WY + 0.25, s * (span - 0.02), { dirt: 0 }); m.rotation.x = -s * 0.28; m.rotation.z = 0.25; }
    // a roundel on the upper wing: team disc in a white ring
    cyl(0.62, 0.02, white, LE(6.3) - 1.0, WY + 0.4, s * 6.3, { seg: 40, dirt: 0 });
    cyl(0.44, 0.03, team, LE(6.3) - 1.0, WY + 0.41, s * 6.3, { seg: 40, dirt: 0 });
    // two turbofans each side, in pods on pylons forward of the leading edge
    for (const ez of [3.35, 6.05]) {
      const ex = LE(ez) - 0.55, ey = WY - 0.45; // under the wing, its intake well out in front
      hcyl(0.48, 2.7, greyD, ex, ey, s * ez, { seg: 28, dirt: 0.2 });
      hcyl(0.5, 0.25, metal, ex + 1.3, ey, s * ez, { seg: 28, dirt: 0 });          // intake lip
      hcyl(0.38, 0.06, dark, ex + 1.44, ey, s * ez, { seg: 24, dirt: 0 });          // fan face
      hcyl(0.3, 0.6, dark, ex - 1.55, ey, s * ez, { seg: 20, dirt: 0 });           // exhaust cone
      box(1.9, 0.5, 0.16, greyD, ex - 0.2, ey + 0.25, s * ez, { dirt: 0 });         // pylon
    }
  }
  // the wing-to-body fairing over the shoulders
  { const g = new THREE.CapsuleGeometry(0.62, 3.6, 8, 20); g.rotateZ(Math.PI / 2); g.scale(1, 0.5, 1.3); mesh(g, M.plain('#68717a', 0.7, 0.15), 0.3, WY + 0.22, 0, { dirt: 0.05 }); }

  // ---- T-tail: a tall swept fin, the tailplane across its top
  const FX = -7.6, FY = Y0 + 1.1, FH = 3.6;
  { const sh = new THREE.Shape(); sh.moveTo(-5.4, 0); sh.lineTo(-7.0, FH); sh.lineTo(-8.7, FH); sh.lineTo(-9.3, 0); sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.22, bevelEnabled: false }); g.translate(0, 0, -0.11); mesh(g, grey, 0, FY, 0, { dirt: 0.1 }); }
  box(1.75, 0.3, 0.26, team, -7.85, FY + FH - 0.3, 0, { dirt: 0 }); // the fin cap in team colour
  { const sh = new THREE.Shape(); sh.moveTo(-6.9, 0); sh.lineTo(-8.5, 3.8); sh.lineTo(-9.25, 3.8); sh.lineTo(-8.9, 0); sh.lineTo(-9.25, -3.8); sh.lineTo(-8.5, -3.8); sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 1 }); g.rotateX(Math.PI / 2); mesh(g, grey, 0, FY + FH + 0.2, 0, { dirt: 0 }); }
  for (const s of [-1, 1]) box(0.75, 0.05, 0.5, team, -8.85, FY + FH + 0.21, s * 3.5, { dirt: 0, ry: 0.1 * s });
  void FX;

  // ---- lights: navigation (red left, green right, white tail), the anti-collision beacon, the lit flight deck
  sphere(0.16, M.emit('#ff3a2a', 3.4), LE(span) - 0.5, WY + 0.35, -span + 0.05, { cast: false });
  sphere(0.16, M.emit('#3aff6a', 3.4), LE(span) - 0.5, WY + 0.35, span - 0.05, { cast: false });
  sphere(0.13, M.emit('#ffffff', 3.2), XT + 0.1, Y0 + 0.4, 0, { cast: false });
  sphere(0.15, M.emit('#ff3a2a', 3.0), -1.4, Y0 + 1.42, 0, { cast: false });
  box(0.16, 0.03, 0.42, M.emit('#ffd9a0', 0.6), 8.05, Y0 + 0.9, 0, { dirt: 0, cast: false });
  void cyl;
}

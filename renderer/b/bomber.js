// Strike Bomber (mock-up): a long, slab-sided twin-engine interceptor turned bomber, top-down, facing +x, orthographic
// camera straight down, no ground (the game draws its shadow). 20 world units across the frame; it is 18.4 long with
// a 10.8 span: long and narrow. A pointed radome, a tandem two-seat canopy, big rectangular wedge intakes either side
// behind the cockpit running back into a broad flat body, a thin wing swept about 40 degrees, a large swept tailplane,
// twin fins canted out, and two big engine nozzles side by side. Pale blue-grey with a darker radome. Team colour:
// the fin tips, a stripe down the spine, roundels on the wings; a team-striped bomb on the centreline pylon shows
// between the engines. At night: navigation lights and the afterburner glow in the nozzles.
export const config = { pad: false, size: 1024 };
export default function (L) {
  const { box, cyl, hcyl, mesh, sphere, M, THREE, TEAM } = L;
  L.seed(3131);
  const W = 20, cam = new THREE.OrthographicCamera(-W / 2, W / 2, W / 2, -W / 2, 0.1, 100);
  cam.position.set(0, 40, 0); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  L.useCamera(cam);
  const skin = M.paint('#9aa4ab', { panelW: 256, rivets: false }), skinD = M.paint('#7c868d', { rivets: false });
  const radome = M.paint('#4c5258', { rivets: false }), dark = M.plain('#1b1e21', 0.5, 0.4), metal = M.plain('#5d5f61', 0.35, 0.85);
  const team = M.paint('#' + new THREE.Color(TEAM).multiplyScalar(0.85).getHexString(), { rivets: false }), white = M.paint('#d9dcd8', { rivets: false });
  const canopy = M.plain('#1d2a33', 0.12, 0.3);
  const Y0 = 1.0;

  // ---- fuselage: the nose cone and the long forward body (a body of revolution), the broad flat rear body
  const prof = [[2.0, 0.92], [4.2, 0.9], [5.6, 0.84], [6.8, 0.7], [7.8, 0.48], [8.6, 0.25], [9.2, 0.05]];
  const lathe = new THREE.LatheGeometry(prof.map(([x, r]) => new THREE.Vector2(r, x)), 32); lathe.rotateZ(-Math.PI / 2);
  mesh(lathe, skin, 0, Y0, 0, { dirt: 0.1, dirtH: 2 });
  { const g = new THREE.SphereGeometry(0.5, 20, 12); g.scale(1.6, 0.5, 0.5); mesh(g, radome, 8.55, Y0, 0, { dirt: 0 }); } // the radome
  // the broad, flat rear body between and over the engines, to the tail
  { const sh = new THREE.Shape(); sh.moveTo(2.4, -1.15); sh.lineTo(-7.6, -1.3); sh.lineTo(-8.9, -1.25); sh.lineTo(-8.9, 1.25); sh.lineTo(-7.6, 1.3); sh.lineTo(2.4, 1.15); sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: 1.2, bevelEnabled: true, bevelThickness: 0.15, bevelSize: 0.15, bevelSegments: 2 }); g.rotateX(Math.PI / 2);
    mesh(g, skin, 0, Y0 + 0.6, 0, { dirt: 0.1 }); }
  // the spine and its team stripe
  { const g = new THREE.CapsuleGeometry(0.34, 9.5, 6, 12); g.rotateZ(Math.PI / 2); g.scale(1, 0.6, 1); mesh(g, skinD, -2.2, Y0 + 0.62, 0, { dirt: 0 }); }
  box(9.6, 0.04, 0.16, team, -2.4, Y0 + 0.83, 0, { dirt: 0, cast: false });
  // the tandem canopy
  { const g = new THREE.SphereGeometry(0.42, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2); g.scale(3.4, 0.9, 1); mesh(g, canopy, 5.15, Y0 + 0.7, 0, { dirt: 0 }); }
  box(0.08, 0.1, 0.8, skinD, 5.1, Y0 + 1.0, 0, { dirt: 0 }); // the frame between the two seats
  // ---- the intakes: big slab-sided boxes either side, raked at the mouth, running back into the body
  for (const s of [-1, 1]) {
    const sh = new THREE.Shape(); sh.moveTo(3.9, 0); sh.lineTo(-1.5, 0); sh.lineTo(-1.5, 1.15); sh.lineTo(2.7, 1.15); sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: 1.3, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 1 });
    g.rotateX(Math.PI / 2);
    mesh(g, skin, 0, Y0 + 0.65, s * (s > 0 ? 0.72 : 0.72 + 1.15), { dirt: 0.1 });
    box(0.25, 1.1, 1.0, dark, 3.75, Y0 - 0.55, s * 1.3, { dirt: 0 });                 // the intake mouth
  }
  // ---- the wing: thin, swept about 40 degrees, mid-mounted on the intakes
  const span = 5.4, LE = (z) => 1.5 - (Math.abs(z) - 1.6) * 0.84, TE = (z) => -2.3 - (Math.abs(z) - 1.6) * 0.16;
  for (const s of [-1, 1]) {
    const sh = new THREE.Shape(); sh.moveTo(LE(1.6), s * 1.6); sh.lineTo(LE(span), s * span); sh.lineTo(TE(span), s * span); sh.lineTo(TE(1.6), s * 1.6); sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 1 }); g.rotateX(Math.PI / 2);
    mesh(g, skin, 0, Y0 + 0.25, 0, { dirt: 0.05 });
    // flaps, and the roundel
    box(0.04, 0.03, span - 1.9, skinD, TE(3.2) + 0.45, Y0 + 0.27, s * (1.6 + (span - 1.6) / 2), { dirt: 0, cast: false, ry: s * -0.18 });
    cyl(0.48, 0.02, white, (LE(3.9) + TE(3.9)) / 2, Y0 + 0.28, s * 3.9, { seg: 32, dirt: 0 });
    cyl(0.34, 0.03, team, (LE(3.9) + TE(3.9)) / 2, Y0 + 0.29, s * 3.9, { seg: 32, dirt: 0 });
  }
  // ---- the tail: big swept tailplanes, twin fins canted out, two big nozzles
  for (const s of [-1, 1]) {
    const sh = new THREE.Shape(); sh.moveTo(-6.0, s * 1.3); sh.lineTo(-7.9, s * 3.5); sh.lineTo(-8.9, s * 3.5); sh.lineTo(-8.6, s * 1.3); sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 1 }); g.rotateX(Math.PI / 2);
    mesh(g, skin, 0, Y0 + 0.2, 0, { dirt: 0.05 });
    // the fin: a swept slab standing on the body edge, canted out
    const fs = new THREE.Shape(); fs.moveTo(-5.2, 0); fs.lineTo(-7.2, 2.6); fs.lineTo(-8.2, 2.6); fs.lineTo(-8.4, 0); fs.closePath();
    const fg = new THREE.ExtrudeGeometry(fs, { depth: 0.14, bevelEnabled: false }); fg.translate(0, 0, -0.07);
    const fin = mesh(fg, skin, 0, Y0 + 1.25, s * 1.0, { dirt: 0.05 }); fin.rotation.x = -s * 0.14;
    const cap = box(1.05, 0.25, 0.18, team, -7.7, Y0 + 3.7, s * 1.36, { dirt: 0 }); cap.rotation.x = -s * 0.14;
    // the nozzles, and the afterburner glow inside
    hcyl(0.62, 1.1, metal, -9.0, Y0, s * 0.68, { seg: 24, dirt: 0 });
    hcyl(0.48, 0.05, M.emit('#ff8a3a', 1.6), -9.56, Y0, s * 0.68, { seg: 20, dirt: 0 });
  }
  // the bomb on the centreline pylon, showing between the engines
  hcyl(0.34, 3.0, M.paint('#5a6047', { rivets: false }), -1.0, Y0 - 0.85, 0, { seg: 16 });
  hcyl(0.36, 0.25, team, 0.2, Y0 - 0.85, 0, { seg: 16, dirt: 0 });
  // ---- lights: navigation (red left, green right, white tail), the anti-collision beacon
  sphere(0.13, M.emit('#ff3a2a', 3.4), (LE(span) + TE(span)) / 2, Y0 + 0.3, -span + 0.05, { cast: false });
  sphere(0.13, M.emit('#3aff6a', 3.4), (LE(span) + TE(span)) / 2, Y0 + 0.3, span - 0.05, { cast: false });
  sphere(0.12, M.emit('#ffffff', 3.0), -9.1, Y0 + 1.45, 0, { cast: false });
  sphere(0.13, M.emit('#ff3a2a', 3.0), 1.0, Y0 + 0.95, 0, { cast: false });
}

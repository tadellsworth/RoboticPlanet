// Bunker: low squat reinforced-concrete pillbox. Sloped concrete walls with bolted steel plates, armoured roof with
// hazard-striped edge, sensor dome and periscope, one long firing slit on the front face with two gun barrels.
// Team colour: two roof status lights and a thin strip above the slit.
// Marks gun0/gun1 (barrel tips) and gun0f/gun1f (one unit further out) for the muzzle-flash overlay.
import { chamferRect, offsetPoly, frustum, band, faceFrame, sandbag, bagArc, bagLine } from './milkit.js';

export default function (L) {
  const { box, cyl, hcyl, beam, pipe, hoop, lamp, pointLight, ao, mesh, sphere, group, mark, M, THREE, TEAM } = L;
  L.seed(417);
  const armor = M.paint('#4c5258'), plate = M.paint('#5a5f63'), off = M.paint('#c7c2b6', { rivets: false });
  const conc = M.rough('#a39e95'), glow = M.emit(TEAM, 2.8), olive = M.paint('#5d6247');
  const cz = -0.35;

  // footing apron, sloped concrete shell, armoured roof slab
  const F0 = chamferRect(3.95, 3.0, 1.35), F1 = offsetPoly(F0, 0.06);
  frustum(L, F0, F1, 0, 0.24, M.concrete, { z: cz, dirt: 0.3 }); ao(0, cz, 7.8, 5.9, 0.55);
  const B0 = chamferRect(3.35, 2.5, 1.15), B1 = offsetPoly(B0, 0.72), Y0 = 0.24, Y1 = 2.75;
  frustum(L, B0, B1, Y0, Y1, conc, { z: cz, dirt: 0.8, dirtH: 0.8 });
  const R0 = offsetPoly(B1, -0.1), R1 = offsetPoly(R0, 0.05);
  frustum(L, R0, R1, Y1, Y1 + 0.26, armor, { z: cz, dirt: 0 });
  const RY = Y1 + 0.26;
  band(L, R1, 0.26, RY + 0.004, M.hazard, { z: cz });
  // raised armoured cupola on the roof: carries the dome and the periscope
  const C0 = chamferRect(1.75, 0.95, 0.45).map(p => [p[0] + 0.15, p[1] - 0.45]), C1 = offsetPoly(C0, 0.12), CY = RY + 0.5;
  frustum(L, C0, C1, RY, CY, armor, { z: cz, dirt: 0.2 });
  band(L, C1, 0.12, CY + 0.004, M.steel, { z: cz });

  // chipped concrete edges: a few darker broken corner chunks along the wall foot
  for (let i = 0; i < 8; i++) { const p = B0[i]; box(0.32, 0.22, 0.28, M.concrete, p[0] * 0.98, Y0 - 0.02, cz + p[1] * 0.98, { ry: L.rnd() * 3, dirt: 0.6 }); }

  // steel plates bolted over the walls (side faces and the four chamfers), with rust streaks from the paint texture
  for (const i of [2, 6, 1, 3, 7]) {
    const f = faceFrame(L, B0, B1, Y0, Y1, i, { z: cz });
    const w = i === 2 || i === 6 ? 2.4 : 1.15;
    box(w, f.slant * 0.62, 0.07, plate, 0, f.slant * 0.12, 0.02, { parent: f.g, dirt: 0.3 });
    for (const sx of [-1, 1]) for (const sy of [0.2, 0.68]) sphere(0.045, M.steel, sx * (w / 2 - 0.12), f.slant * sy, 0.07, { parent: f.g, dirt: 0 });
  }

  // front face: steel visor frame, dark firing slit, brow, two gun barrels, team light strip
  const fr = faceFrame(L, B0, B1, Y0, Y1, 0, { z: cz }), sl = fr.slant;
  box(4.0, 1.15, 0.12, plate, 0, sl * 0.32, 0.03, { parent: fr.g, dirt: 0.2 });
  box(3.55, 0.5, 0.18, M.dark, 0, sl * 0.34 + 0.34, 0.06, { parent: fr.g, dirt: 0 });
  box(4.15, 0.14, 0.55, armor, 0, sl * 0.34 + 0.95, 0.2, { parent: fr.g, dirt: 0 });
  box(3.4, 0.08, 0.07, glow, 0, sl * 0.34 + 1.2, 0.05, { parent: fr.g, cast: false });
  for (const [k, sx] of [[0, -0.95], [1, 0.95]]) {
    const gy = sl * 0.34 + 0.56;
    box(0.62, 0.4, 0.14, armor, sx, gy - 0.2, 0.12, { parent: fr.g, dirt: 0 });       // gun mantlet
    hcyl(0.12, 1.1, M.chrome, sx, gy, 0.6, { axis: 'z', parent: fr.g });
    hcyl(0.17, 0.2, armor, sx, gy, 1.12, { axis: 'z', parent: fr.g });
    mark('gun' + k, sx, gy, 1.22, fr.g); mark('gun' + k + 'f', sx, gy, 2.22, fr.g);
  }
  // lower front plates either side
  for (const sx of [-1.45, 1.45]) box(1.2, 0.4, 0.07, plate, sx, 0.06, 0.02, { parent: fr.g, dirt: 0.5 });

  // roof: hatch, sensor dome, periscope, vents, status lights, antenna
  const rz = cz;
  cyl(0.5, 0.12, armor, -0.55, CY, rz - 0.5, { dirt: 0 });
  cyl(0.4, 0.07, M.steel, -0.55, CY + 0.12, rz - 0.5, { dirt: 0 });
  beam([-0.75, CY + 0.23, rz - 0.5], [-0.35, CY + 0.23, rz - 0.5], 0.06, 0.06, M.steel);
  // sensor dome on an armoured collar
  cyl(0.72, 0.2, armor, 1.0, CY, rz - 0.5, { rTop: 0.65, dirt: 0 });
  sphere(0.58, off, 1.0, CY + 0.2, rz - 0.5, { dome: true, dirt: 0.2 });
  box(0.22, 0.1, 0.06, M.dark, 1.0, CY + 0.46, rz + 0.06, { dirt: 0 });
  box(0.04, 1.25, 0.04, M.steel, 1.55, CY + 0.15, rz - 0.95, { dirt: 0 });
  sphere(0.06, M.steel, 1.55, CY + 1.42, rz - 0.95, {});
  // periscope: armoured tube with a head and a dark lens facing front
  cyl(0.26, 0.18, armor, -1.2, CY, rz - 0.2, { dirt: 0 });
  cyl(0.13, 0.8, M.steel, -1.2, CY + 0.18, rz - 0.2, { dirt: 0 });
  box(0.38, 0.32, 0.5, armor, -1.2, CY + 0.9, rz - 0.15, { dirt: 0 });
  box(0.28, 0.16, 0.04, M.glass('#203040', 0.85), -1.2, CY + 1.0, rz + 0.11, { cast: false });
  // mushroom vents on the main roof
  for (const [x, z] of [[-1.9, -0.9], [2.1, -0.95]]) { cyl(0.15, 0.3, M.steel, x, RY, rz + z, { dirt: 0 }); cyl(0.28, 0.1, armor, x, RY + 0.3, rz + z, { rTop: 0.17, dirt: 0 }); }
  // two team status lights on low housings at the front corners of the roof
  for (const x of [-1.85, 1.85]) {
    box(0.55, 0.2, 0.45, armor, x, RY, rz + 0.75, { dirt: 0 });
    box(0.34, 0.18, 0.28, glow, x, RY + 0.2, rz + 0.75, { cast: false, dirt: 0 });
  }
  pointLight(TEAM, 2.5, 0, RY + 0.6, rz + 1.6, 3);

  // concrete blocks and sandbags banked against the corners
  const bag = M.rough('#9a8763');
  // front-left corner: curved sandbag bank
  bagArc(L, -3.15, cz + 2.25, 0.95, Math.PI * 0.05, Math.PI * 1.05, 3, { lean: 0.12, mat: bag });
  // front-right corner: two jersey blocks with hazard tops and a couple of bags
  for (const [x, z, r] of [[3.55, cz + 2.55, -0.6], [4.05, cz + 1.4, -1.2]]) {
    box(1.25, 0.62, 0.5, M.concrete, x, 0, z, { ry: r, dirt: 0.5 });
    box(1.27, 0.1, 0.52, M.hazard, x, 0.42, z, { ry: r, dirt: 0 });
  }
  sandbag(L, 2.75, 0, cz + 3.05, 0.2, { mat: bag }); sandbag(L, 2.6, 0.31, cz + 3.0, 0.35, { mat: bag });
  // back corners: stacked concrete blocks
  for (const [x, z, r] of [[-3.75, cz - 2.2, 0.75], [3.8, cz - 2.15, -0.75]]) {
    box(1.1, 0.55, 0.6, M.concrete, x, 0, z, { ry: r, dirt: 0.5 });
    box(0.8, 0.45, 0.5, M.concrete, x * 0.97, 0.55, z, { ry: r + 0.1, dirt: 0.5 });
  }
  bagLine(L, -1.6, cz + 3.25, -0.4, cz + 3.25, 1, { mat: bag });
  // ammunition crate by the rear corner
  box(0.8, 0.45, 0.55, olive, -2.4, 0, cz - 2.85, { ry: 0.1 }); box(0.82, 0.06, 0.57, M.hazard, -2.4, 0.3, cz - 2.85, { ry: 0.1, dirt: 0 });
}

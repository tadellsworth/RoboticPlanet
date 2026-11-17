// Fuel Tank: an oil bloc's storage, three domed storage tanks for Crude and Fuel inside a concrete containment bund,
// a pipe manifold along the front with a small pump house, a catwalk between the two big tanks' roofs, hazard
// stripes on the bund and the pump house door. Powered realism (b/powerkit.js): team bands round each tank, a team
// strip along the bund's front, beacons on the tank roofs, a floodlight, a junction box with its conduit to the
// pump house. Team-coloured: render one image per team.
import { power } from './powerkit.js';
export default function (L) {
  const { box, cyl, beam, pipe, hoop, ao, mesh, sphere, ladder, pointLight, group, M, THREE } = L;
  const gun = M.paint('#50565c'), off = M.paint('#d6d1c6'), warm = M.paint('#8c8579'), crude = M.paint('#3a3631');
  L.seed(277);

  // the containment bund: a low concrete wall round the whole yard, its floor stained
  box(8.2, 0.06, 8.2, M.concrete, 0, 0, 0, { dirt: 0.8, cast: false });
  for (const [w, d, x, z] of [[8.4, 0.24, 0, -4.1], [8.4, 0.24, 0, 4.1], [0.24, 8.4, -4.1, 0], [0.24, 8.4, 4.1, 0]]) box(w, 0.42, d, M.concrete, x, 0, z, { dirtH: 0.3 });
  box(3.2, 0.08, 0.05, M.hazard, -1.4, 0.2, 4.23, { dirt: 0, cast: false });
  box(2.0, 0.08, 0.05, M.hazard, 2.6, 0.2, 4.23, { dirt: 0, cast: false });

  // the tanks: [x, z, r, h], each on a concrete ring footing with a darker crude-stained lower band and a low cone roof
  const TANKS = [[-1.75, -1.55, 1.75, 2.6], [2.05, -1.85, 1.45, 2.25], [1.55, 2.1, 1.2, 1.8]];
  for (const [x, z, r, h] of TANKS) {
    cyl(r + 0.18, 0.18, M.concrete, x, 0.06, z, { seg: 40, dirt: 0.6 });
    ao(x, z, r * 2.2, r * 2.2, 0.55);
    cyl(r, h, off, x, 0.24, z, { seg: 40, dirtH: 0.9 });
    cyl(r + 0.01, 0.42, crude, x, 0.24, z, { seg: 40, dirt: 0.4 });
    const roof = mesh(new THREE.ConeGeometry(r * 1.02, r * 0.32, 40), off, x, 0.24 + h + r * 0.16, z, { dirt: 0.3 });
    roof.castShadow = true;
    hoop(r + 0.015, 0.035, gun, x, 0.24 + h, z, { dirt: 0 });
    hoop(r + 0.015, 0.03, gun, x, 0.24 + h * 0.5, z, { dirt: 0 });
    // a vent and a hatch on the roof
    cyl(0.13, 0.28, M.steel, x + r * 0.35, 0.24 + h + r * 0.16, z - r * 0.25, { seg: 12, dirt: 0 });
    box(0.32, 0.06, 0.32, gun, x - r * 0.3, 0.24 + h + r * 0.1, z + r * 0.3, { dirt: 0 });
    // a ladder up the side facing the yard's centre
    const a = Math.atan2(-z, -x);
    ladder(x + Math.cos(a) * (r + 0.08), 0.24, h, z + Math.sin(a) * (r + 0.08), { ry: -a + Math.PI / 2 });
  }
  // catwalk between the two big tanks' roofs, with handrails
  const [ax, az, ar, ah] = TANKS[0], [bx, bz, br, bh] = TANKS[1], cy = 0.24 + Math.min(ah, bh) + 0.1;
  beam([ax + ar * 0.75, cy, az - 0.1], [bx - br * 0.75, cy, bz + 0.05], 0.36, 0.06, gun);
  for (const dz of [-0.17, 0.17]) beam([ax + ar * 0.75, cy + 0.42, az - 0.1 + dz], [bx - br * 0.75, cy + 0.42, bz + 0.05 + dz], 0.03, 0.03, M.steel);

  // the manifold: a pipe from each tank's foot to a header along the front, and on through the pump house
  const hz = 3.35;
  pipe([[-3.6, 0.38, hz], [3.6, 0.38, hz]], 0.13, M.paint('#3f6b6b', { rivets: false }));
  pipe([[-3.6, 0.62, hz - 0.3], [3.6, 0.62, hz - 0.3]], 0.1, M.paint('#b8952e', { rivets: false }));
  for (const [x, z, r] of TANKS) {
    const fz = z + r + 0.05;
    pipe([[x, 0.38, fz], [x, 0.38, hz]], 0.1, M.steel);
    cyl(0.16, 0.1, M.dark, x, 0.3, Math.min(fz + 0.35, hz - 0.2), { seg: 12, dirt: 0 }); // a valve wheel
  }
  // the pump house (front left) with a door and a hazard band
  const px = -2.6, pz = 2.35;
  box(1.5, 1.15, 1.1, warm, px, 0.06, pz, { dirtH: 0.5 }); ao(px, pz, 1.5, 1.1, 0.45);
  box(1.6, 0.1, 1.2, gun, px, 1.21, pz, { dirt: 0 });
  box(0.42, 0.8, 0.04, M.dark, px + 0.35, 0.06, pz + 0.56, { dirt: 0.3 });
  box(1.5, 0.08, 0.04, M.hazard, px, 0.9, pz + 0.57, { dirt: 0, cast: false });
  cyl(0.2, 0.5, M.steel, px - 0.35, 1.31, pz - 0.1, { seg: 14, soot: 0.3 });

  if (L.getRoot) powerLayer();

  // ================================================================ power layer (lights and electricity)
  function powerLayer() {
    const P = power(L), nc = { dirt: 0, cast: false };
    // team bands round each tank, and beacons on the roofs
    for (const [x, z, r, h] of TANKS) {
      hoop(r + 0.03, 0.035, P.glow, x, 0.24 + h * 0.78, z, { cast: false });
      P.beacon(x, 0.24 + h + r * 0.34, z, '#ffb347');
    }
    // a team strip along the top of the bund's front
    P.strip(8.0, 0, 0.44, 4.1, 0, 0.05);
    // a floodlight on a pole by the pump house, aimed into the yard
    const fx = -3.7, fz = 3.7;
    cyl(0.06, 2.6, P.steelD, fx, 0.06, fz, { seg: 8, dirt: 0 });
    const g = group(fx, 2.66, fz, Math.PI * 0.75);
    box(0.4, 0.24, 0.2, P.steel, 0, -0.12, 0.08, { parent: g, dirt: 0 });
    box(0.34, 0.18, 0.03, P.white, 0, -0.1, 0.19, { parent: g, ...nc });
    pointLight('#fff1d6', 3, fx + 1.0, 2.2, fz - 1.0, 5);
    // the pump house window, its door lamp, and a junction box with a conduit to it
    P.windows(0.7, 0.26, px - 0.3, 0.68, pz + 0.57, 0, 2);
    box(0.16, 0.05, 0.05, P.white, px + 0.35, 0.92, pz + 0.6, nc);
    pointLight('#ffd9a0', 1.4, px + 0.35, 0.8, pz + 1.1, 2);
    P.junction(-0.6, 3.75, Math.PI);
    P.conduit([[-0.85, 0.3, 3.75], [-1.85, 0.3, 3.75], [-1.85, 0.3, pz + 0.6]], 0.05);
  }
}

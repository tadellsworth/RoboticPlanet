// Nuclear Reactor: hyperboloid cooling tower with a steam plume, domed containment building with a glowing
// ring of ports and a radiation trefoil, turbine hall, coolant tanks with glowing sight glasses, big coolant pipes,
// and a small switchyard. Accent: radioactive green.
// Powered realism (b/powerkit.js): team light rings round the containment's plinth and the cooling tower's lip, team
// strips on the turbine hall's roof edge, warm lit windows on the hall, amber obstruction lights round the tower rim,
// a transformer bank with arcing insulators between the tower and the coolant tanks, arcs across the switchyard's
// insulators and the transformer, a junction box and conduits with glowing collars to the hall, floodlights on the
// hall roof, cables, beacons. Team-coloured: render one image per team.
import { trefoil } from './nuke.js';
import { power } from './powerkit.js';
export default function (L) {
  const { box, cyl, hcyl, beam, pipe, hoop, lamp, pointLight, ao, mesh, sphere, group, M, THREE, ACCENT } = L;
  const gun = M.paint('#50565c'), off = M.paint('#c9c5ba'), cream = M.rough('#b9b2a4'), conc = M.rough('#9a9285');
  const glow = M.emit(ACCENT, 2.4), dim = M.emit(ACCENT, 1.2);
  const P = power(L), nc = { dirt: 0, cast: false };
  L.seed(401);

  // ---- cooling tower (back left): hyperboloid concrete shell, ring of support legs, dark throat, steam
  const tx = -2.45, tz = -2.25, a = 1.32, yw = 3.9, b = 3.075, H = 5.4;
  const prof = []; for (let i = 0; i <= 24; i++) { const y = 0.55 + (H - 0.55) * i / 24; prof.push(new THREE.Vector2(a * Math.sqrt(1 + ((y - yw) / b) ** 2), y)); }
  const shellMat = M.rough('#b3ab9c'); shellMat.side = THREE.DoubleSide;
  mesh(new THREE.LatheGeometry(prof, 48), shellMat, tx, 0, tz, { dirt: 0.35, dirtH: 2.5 });
  const rTop = a * Math.sqrt(1 + ((H - yw) / b) ** 2), rBot = a * Math.sqrt(1 + ((0.55 - yw) / b) ** 2);
  hoop(rTop, 0.07, M.rough('#8a8377'), tx, H, tz);
  for (const y of [H - 0.45, H - 0.75]) { const r = a * Math.sqrt(1 + ((y - yw) / b) ** 2); hoop(r + 0.01, 0.06, M.plain('#a8423a', 0.8), tx, y, tz); }
  for (let k = 0; k < 20; k++) {                                                   // diagonal support legs
    const t0 = k / 20 * Math.PI * 2, t1 = t0 + Math.PI / 20;
    beam([tx + Math.cos(t0) * rBot * 1.03, 0, tz + Math.sin(t0) * rBot * 1.03], [tx + Math.cos(t1) * rBot, 0.58, tz + Math.sin(t1) * rBot], 0.1, 0.1, conc);
  }
  cyl(rBot - 0.1, 0.05, M.dark, tx, 0.0, tz, { seg: 40, dirt: 0, cast: false });
  cyl(a * 1.05, 0.04, M.dark, tx, 2.2, tz, { seg: 40, dirt: 0, cast: false });         // dark throat seen from above
  ao(tx, tz, 4.4, 4.4, 0.5);
  // steam plume: soft white puffs rising out of the throat
  const steam = new THREE.MeshStandardMaterial({ color: '#f2f0ea', roughness: 1, transparent: true, opacity: 0.3, depthWrite: false });
  L.seed(55);
  for (let k = 0; k < 10; k++) {
    const t = k / 9, r = 0.4 + t * 0.6 + L.rnd() * 0.15;
    const m = mesh(new THREE.SphereGeometry(r, 18, 12), steam, tx + 1.3 * t + (L.rnd() - 0.5) * 0.5, H + 0.05 + t * 1.5, tz + 0.3 * t + (L.rnd() - 0.5) * 0.5, { cast: false, dirt: 0 });
    m.scale.y = 0.65;
  }
  L.seed(402);

  // ---- containment building (right): cylinder + dome, ring of glowing ports, trefoil on the front
  const cx = 1.75, cz = -1.35, R = 1.85, CH = 2.1;
  cyl(R + 0.2, 0.3, conc, cx, 0, cz, { seg: 48 }); ao(cx, cz, 4.2, 4.2, 0.55);
  cyl(R, CH, cream, cx, 0.3, cz, { seg: 48, dirtH: 1.5 });
  sphere(R, cream, cx, 0.3 + CH, cz, { dome: true, dirt: 0.2 });
  hoop(R + 0.02, 0.06, gun, cx, 0.3 + CH, cz);
  for (let k = 0; k < 18; k++) { const t = k / 18 * Math.PI * 2; box(0.28, 0.16, 0.06, glow, cx + Math.cos(t) * (R + 0.01), 0.3 + CH - 0.42, cz + Math.sin(t) * (R + 0.01), { ry: -t + Math.PI / 2, cast: false }); }
  hoop(R + 0.03, 0.035, gun, cx, 0.3 + CH - 0.25, cz); hoop(R + 0.03, 0.035, gun, cx, 0.3 + CH - 0.6, cz);
  const lab = new THREE.MeshStandardMaterial({ map: trefoil(L), transparent: true, roughness: 0.7, alphaTest: 0.5 });
  const lg = new THREE.CylinderGeometry(R + 0.015, R + 0.015, 0.95, 24, 1, true, 0.05, 0.54); lg.translate(0, 1.45, 0);
  const lm = new THREE.Mesh(lg, lab); lm.position.set(cx, 0, cz); L.getRoot().add(lm);
  // crane rail ring and a top hatch on the dome
  cyl(0.55, 0.22, gun, cx, 0.3 + CH + R - 0.12, cz, { seg: 24, dirt: 0 });
  hoop(0.56, 0.05, glow, cx, 0.3 + CH + R + 0.1, cz, { cast: false });
  // airlock (front of the containment)
  box(1.1, 1.3, 0.9, gun, cx - 0.55, 0.3, cz + R + 0.1); box(0.7, 0.9, 0.04, M.dark, cx - 0.55, 0.35, cz + R + 0.57, { dirt: 0 });
  box(0.5, 0.06, 0.04, glow, cx - 0.55, 1.35, cz + R + 0.58, { cast: false });
  pointLight(ACCENT, 6, cx, 2.5, cz + R + 1.0, 4);

  // ---- turbine hall (front right) with green-lit windows and roof vents
  const hx = 2.35, hz = 2.65;
  box(4.0, 1.75, 2.2, M.paint('#8c8579'), hx, 0, hz); ao(hx, hz, 4.0, 2.2, 0.55);
  box(4.1, 0.12, 2.3, gun, hx, 1.75, hz, { dirt: 0 });
  box(3.9, 0.08, 2.1, M.ribbed('#7b8086'), hx, 1.87, hz, { dirt: 0 });
  for (let k = 0; k < 6; k++) { box(0.42, 0.3, 0.04, dim, hx - 1.6 + k * 0.64, 1.15, hz + 1.11, { cast: false }); box(0.46, 0.04, 0.05, gun, hx - 1.6 + k * 0.64, 1.31, hz + 1.12, { dirt: 0 }); }
  for (const x of [-1.2, 0, 1.2]) { cyl(0.28, 0.35, M.steel, hx + x, 1.95, hz - 0.2, { seg: 16, dirt: 0 }); cyl(0.32, 0.06, M.dark, hx + x, 2.3, hz - 0.2, { seg: 16, dirt: 0 }); }
  box(1.0, 1.2, 0.08, M.dark, hx + 1.3, 0, hz + 1.11, { dirt: 0 });
  // big coolant pipes: containment -> turbine hall, turbine hall -> cooling tower
  pipe([[cx - 0.8, 1.0, cz + R - 0.2], [cx - 0.8, 1.0, hz - 1.4], [cx - 0.8, 0.9, hz - 1.1]], 0.2, M.paint('#c9c5ba', { rivets: false }));
  pipe([[cx + 0.6, 0.8, cz + R - 0.3], [cx + 0.6, 0.8, hz - 1.1]], 0.2, M.paint('#3f6f8a', { rivets: false }));
  pipe([[hx - 2.0, 0.6, hz - 0.4], [tx + 0.6, 0.6, hz - 0.4], [tx + 0.6, 0.6, tz + rBot - 0.1]], 0.24, M.paint('#3f6f8a', { rivets: false }));
  pipe([[hx - 2.0, 1.1, hz + 0.3], [tx + 1.1, 1.1, hz + 0.3], [tx + 1.1, 1.1, tz + rBot - 0.2]], 0.18, M.paint('#c9c5ba', { rivets: false }));
  for (const z of [hz - 0.4, hz + 0.3]) for (const x of [-1.2, -0.2]) box(0.14, z < hz ? 0.5 : 1.0, 0.14, gun, x, 0, z, { dirt: 0 });

  // ---- coolant tanks with glowing sight glasses (front left)
  for (let i = 0; i < 3; i++) {
    const x = -3.55 + i * 0.95, z = 2.55;
    cyl(0.4, 1.7, M.steel, x, 0, z, { seg: 24 }); sphere(0.4, M.steel, x, 1.7, z, { dome: true });
    box(0.14, 1.1, 0.06, glow, x, 0.3, z + 0.39, { cast: false });
    hoop(0.41, 0.03, M.hazard, x, 0.25, z);
    pointLight(ACCENT, 1.5, x, 0.8, z + 0.8, 1.8);
  }
  box(3.0, 0.12, 1.1, conc, -2.6, 0, 2.55, { dirt: 0 }); ao(-2.6, 2.55, 3.0, 1.1, 0.5);
  pipe([[-1.65, 0.45, 2.55], [-1.2, 0.45, 2.55], [-1.2, 0.45, hz + 0.3]], 0.08, M.dark);

  // ---- switchyard: two insulator posts and a transformer (front left corner) + hazard markings
  for (const x of [-3.9, -3.1]) { box(0.12, 1.0, 0.12, gun, x, 0, 4.05, { dirt: 0 }); for (const y of [1.0, 1.15, 1.3]) cyl(0.12, 0.05, M.plain('#e4e0d6', 0.3), x, y, 4.05, { seg: 12, dirt: 0 }); }
  box(1.0, 0.8, 0.7, gun, -1.95, 0, 4.0); for (let i = 0; i < 5; i++) box(0.05, 0.6, 0.18, M.steel, -2.35 + i * 0.2, 0.1, 4.4, { dirt: 0 });
  box(2.6, 0.02, 0.22, M.hazard, 0.2, 0, 4.3, { dirt: 0, cast: false });
  lamp(cx + R * 0.7, 0.3 + CH + 0.3, cz - R * 0.7, ACCENT, { size: 0.14, light: false, k: 3 });

  // ================================================================ power layer (lights and electricity)
  // team light rings round the containment's plinth and the cooling tower's lower lip; a team beacon on the hatch
  hoop(R + 0.21, 0.03, P.glow, cx, 0.31, cz, { cast: false });
  hoop(rBot + 0.02, 0.035, P.glow, tx, 0.62, tz, { cast: false });
  P.beacon(cx, 0.3 + CH + R + 0.2, cz);
  // amber obstruction lights round the cooling tower's rim
  for (let k = 0; k < 4; k++) { const t = (k + 0.5) * Math.PI / 2; P.beacon(tx + Math.cos(t) * (rTop + 0.05), H + 0.1, tz + Math.sin(t) * (rTop + 0.05), '#ffb347'); }
  // turbine hall: team strips along the roof's front and side edges, warm lit windows below the green ones,
  // floodlights on the roof's front corners, a lamp over the door
  P.strip(4.12, hx, 1.8, hz + 1.17, 0, 0.07);
  for (const s of [-1, 1]) P.strip(2.3, hx + s * 2.07, 1.8, hz, Math.PI / 2, 0.06);
  P.windows(2.3, 0.26, hx - 0.65, 0.55, hz + 1.12, 0, 4);
  box(0.24, 0.06, 0.06, P.white, hx + 1.3, 1.27, hz + 1.15, nc); pointLight('#ffd9a0', 1.6, hx + 1.3, 1.0, hz + 1.7, 2.2);
  for (const s of [-1, 1]) {
    const x = hx + s * 1.85, g = L.group(x, 1.93, hz + 0.95, s * 0.35);
    box(0.08, 0.45, 0.08, P.steelD, 0, 0, 0, { parent: g, dirt: 0 });
    const h = new THREE.Group(); h.position.set(0, 0.5, 0.06); h.rotation.x = 0.4; g.add(h);
    box(0.36, 0.22, 0.18, P.steel, 0, -0.11, 0, { parent: h, dirt: 0 }); box(0.3, 0.16, 0.03, P.white, 0, -0.08, 0.1, { parent: h, ...nc });
    pointLight('#fff1d6', 3, x + s * 0.3, 1.6, hz + 2.0, 4.5);
  }
  for (const s of [-1, 1]) P.beacon(hx + s * 1.95, 2.0, hz - 1.0);
  // transformer bank between the cooling tower and the coolant tanks, on a hazard-framed plate, cabled together
  const bx = -3.15, bz = 0.95;
  box(2.3, 0.06, 1.1, P.dark, bx, 0, bz, { dirt: 0, cast: false });
  for (const [w, d, x, z] of [[2.3, 0.07, bx, bz - 0.55], [2.3, 0.07, bx, bz + 0.55], [0.07, 1.1, bx - 1.15, bz], [0.07, 1.1, bx + 1.15, bz]]) box(w, 0.07, d, M.hazard, x, 0, z, { dirt: 0, cast: false });
  for (const x of [bx - 0.52, bx + 0.52]) P.transformer(x, bz, 0);
  P.cable([bx - 0.24, 1.17, bz], [bx + 0.24, 1.17, bz], 0.12, 6);
  // a junction box between the bank and the hall's pipes; conduits from it to the bank and into the hall
  P.junction(-1.85, 1.2, 0);
  P.conduit([[bx + 0.97, 0.3, bz], [-2.12, 0.3, bz]], 0.05);
  P.conduit([[-1.58, 0.25, 1.2], [-0.75, 0.25, 1.2], [-0.75, 0.25, 1.75], [hx - 2.0, 0.25, 1.75]], 0.05);
  // switchyard: the insulator posts carry glowing caps with an arc between them, cables to the transformer, which gets
  // its own insulators and arcs; a conduit from it into the hall
  const sw = [-3.9, -3.1].map(x => [x, 1.42, 4.05]);
  for (const t of sw) sphere(0.07, P.white, ...t, { cast: false });
  P.arc(sw[0], sw[1], 6, 4); pointLight('#bfe8ff', 1.5, -3.5, 1.6, 4.3, 2.2);
  const ins = [-0.3, 0, 0.3].map(dx => [-1.95 + dx, 1.12, 4.0]);
  for (const t of ins) { cyl(0.04, 0.26, M.plain('#c9c2b0', 0.4, 0.1), t[0], 0.8, t[2], { seg: 10, dirt: 0 }); for (const y of [0.87, 0.95]) cyl(0.07, 0.02, M.plain('#d8d2c2', 0.4, 0.1), t[0], y, t[2], { seg: 12, dirt: 0 }); sphere(0.05, P.white, ...t, { cast: false }); }
  P.arc(ins[0], ins[1], 4, 9); P.arc(ins[1], ins[2], 4, 11);
  for (const [i, t] of sw.entries()) P.cable(t, ins[i * 2], 0.15, 6);
  P.conduit([[-1.45, 0.3, 3.85], [hx - 2.0 + 0.25, 0.3, 3.85], [hx - 2.0 + 0.25, 0.3, hz + 1.1]], 0.05);
}

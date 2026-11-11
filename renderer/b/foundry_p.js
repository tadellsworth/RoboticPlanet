// Foundry, POWERED proposal (foundry_p): the realistic barrel-roofed hangar from foundry.js (open bay, robot arms
// assembling a bot, gear emblem on the gable, crates on the apron) with a lights-and-electricity layer from
// b/powerkit.js: team-colour light strips along the eaves, the steel roof ribs and the gable arch, warm lit skylights
// and window bands, a glowing assembly bay, a transformer bank with arcing insulators beside the hall feeding the
// wall by cables and a conduit into a junction box, floodlights over the apron, a glowing charging pad and beacons.
// Team-coloured lights: render one image per team (the team field of the job).
import { power } from './powerkit.js';
export default function (L) {
  const { box, cyl, beam, pipe, lamp, pointLight, ao, mesh, gear, sphere, hoop, M, THREE } = L;
  const P = power(L), nc = { dirt: 0, cast: false };
  const gun = M.paint('#50565c'), off = M.paint('#c7c2b6'), rib = M.ribbed('#9d978b'), yel = M.paint('#c9a032');
  L.seed(61);
  const hx = -0.2, hz = -1.3, W = 7.8, D = 6.0, WH = 2.1, R = W / 2, sy = 0.56, fz = hz + D / 2;

  // walls with the bay opening in the front
  box(W, WH, 0.25, off, hx, 0, hz - D / 2 + 0.125); ao(hx, hz, W, D);
  box(0.25, WH, D, off, hx - W / 2 + 0.125, 0, hz); box(0.25, WH, D, off, hx + W / 2 - 0.125, 0, hz);
  box(1.95, WH, 0.25, off, hx - W / 2 + 0.975, 0, fz - 0.125); box(1.95, WH, 0.25, off, hx + W / 2 - 0.975, 0, fz - 0.125);
  box(W - 0.5, 0.02, D - 0.5, M.plain('#202326', 0.6, 0.3), hx, 0.01, hz, { dirt: 0, cast: false });

  // barrel roof
  const roof = new THREE.CylinderGeometry(R, R, D + 0.3, 56, 1, false, Math.PI / 2, Math.PI); roof.rotateX(Math.PI / 2); roof.scale(1, sy, 1);
  mesh(roof, rib, hx, WH, hz, { dirt: 0 });
  const crest = WH + R * sy;
  // lit skylights along the crest (warm interior light)
  for (const dz of [-1.8, 0, 1.8]) { box(0.7, 0.05, 1.3, M.plain('#2b3238', 0.3, 0.6), hx, crest - 0.03, hz + dz, nc); box(0.5, 0.05, 1.1, P.warm, hx, crest - 0.01, hz + dz, { cast: false }); }
  for (const dz of [-1.8, 1.8]) for (const s of [-1, 1]) cyl(0.3, 0.38, M.steel, hx + s * 1.45, crest - 0.42, hz + dz);

  // steel arch ribs over the roof, each carrying a team light strip; the front one outlines the gable
  const arch = (r, tube, z, mat, cast) => {
    const g = new THREE.TorusGeometry(r, tube, 6, 72, Math.PI); g.scale(1, sy, 1);
    mesh(g, mat, hx, WH, z, { dirt: 0, cast });
  };
  for (const dz of [-0.9, 0.9]) { arch(R + 0.03, 0.07, hz + dz, gun, true); arch(R + 0.1, 0.038, hz + dz, P.glow, false); }
  arch(R + 0.02, 0.09, fz + 0.12, gun, true); arch(R - 0.06, 0.045, fz + 0.22, P.glow, false);
  arch(R + 0.02, 0.09, hz - D / 2 - 0.12, gun, true);
  // eave strips along both long sides
  for (const s of [-1, 1]) { box(0.14, 0.12, D + 0.3, gun, hx + s * (R + 0.02), WH - 0.1, hz, { dirt: 0 }); P.strip(D + 0.2, hx + s * (R + 0.1), WH - 0.08, hz, Math.PI / 2, 0.08); }

  // gear emblem on the front gable, with a glowing hub
  gear(1.05, 0.8, 12, 0.18, M.paint('#d9d5ca', { rivets: false }), hx, WH + 0.95, fz + 0.25);
  cyl(0.2, 0.1, M.steel, hx, WH + 0.95, fz + 0.3).rotation.x = Math.PI / 2;
  cyl(0.11, 0.06, P.glowHi, hx, WH + 0.95, fz + 0.38, { cast: false }).rotation.x = Math.PI / 2;
  for (const s of [-1, 1]) box(0.22, 0.07, 0.1, P.white, hx + s * 0.55, WH, fz + 0.3, nc);          // emblem uplights on the header
  pointLight('#fff1d6', 2.5, hx, WH + 0.25, fz + 0.9, 2.2);

  // bay door frame with team light strips: a glowing header and both jambs
  box(0.18, WH, 0.32, M.hazard, hx - 1.9, 0, fz, { dirt: 0 }); box(0.18, WH, 0.32, M.hazard, hx + 1.9, 0, fz, { dirt: 0 });
  box(3.9, 0.2, 0.32, M.hazard, hx, WH - 0.2, fz, { dirt: 0 });
  box(3.6, 0.07, 0.07, P.glowHi, hx, WH - 0.3, fz + 0.18, { cast: false });
  for (const s of [-1, 1]) box(0.06, WH - 0.35, 0.06, P.glow, hx + s * 1.78, 0.02, fz + 0.18, nc);
  box(3.4, 0.012, 0.08, P.glow, hx, 0, fz + 0.3, nc);                                        // glowing threshold
  pointLight('#dcefff', 12, hx, 1.3, fz - 0.6, 5);
  pointLight(L.TEAM, 5, hx, 0.9, fz - 0.2, 3.5);
  pointLight('#dcefff', 3, hx, 0.6, fz + 0.9, 3);

  // lit window bands on the front walls either side of the bay
  for (const s of [-1, 1]) P.windows(1.45, 0.3, hx + s * (W / 2 - 0.975), 1.28, fz + 0.03, 0, 3);

  // in the doorway: assembly platform, half-built bot with a glowing core, two robot arms with welding sparks
  cyl(0.75, 0.16, M.steel, hx, 0, fz - 0.35, { dirt: 0 });
  hoop(0.72, 0.025, P.glow, hx, 0.17, fz - 0.35, { cast: false });
  box(0.9, 0.42, 0.75, off, hx, 0.16, fz - 0.35, { dirt: 0 });
  box(1.0, 0.24, 0.16, M.dark, hx, 0.16, fz - 0.8, { dirt: 0 }); box(1.0, 0.24, 0.16, M.dark, hx, 0.16, fz + 0.1, { dirt: 0 });
  sphere(0.2, P.glow, hx + 0.3, 0.68, fz - 0.35, { cast: false });
  for (const s of [-1, 1]) {
    const ax = hx + s * 1.35, az = fz - 0.4;
    cyl(0.28, 0.3, M.steel, ax, 0, az, { dirt: 0 });
    beam([ax, 0.3, az], [ax - s * 0.1, 1.35, az + 0.1], 0.22, 0.22, yel);
    beam([ax - s * 0.1, 1.35, az + 0.1], [hx + s * 0.5, 0.85, fz - 0.3], 0.17, 0.17, yel);
    sphere(0.15, M.steel, ax - s * 0.1, 1.35, az + 0.1);
    sphere(0.07, M.emit('#ffffff', 3), hx + s * 0.45, 0.78, fz - 0.3, { cast: false });
  }

  // transformer bank on a plinth at the apron's right, cabled up to a bushing rack under the eave
  box(2.3, 0.08, 1.15, P.conc, 3.38, 0, 2.78, { dirt: 0.4, cast: false }); ao(3.38, 2.78, 2.3, 1.15, 0.4);
  box(2.3, 0.1, 0.05, M.hazard, 3.38, 0, 3.37, { dirt: 0, cast: false });
  for (const x of [2.86, 3.9]) P.transformer(x, 2.78, 0);
  box(1.3, 0.08, 0.16, gun, hx + 3.1, 1.74, fz + 0.08, { dirt: 0 });
  for (const [bx, tx] of [[hx + 2.65, 2.58], [hx + 3.05, 3.14], [hx + 3.45, 3.62]]) {
    cyl(0.035, 0.14, M.plain('#c9c2b0', 0.4, 0.1), bx, 1.82, fz + 0.12, { seg: 8, dirt: 0 });
    P.cable([tx, 1.2, 2.78], [bx, 1.96, fz + 0.12], 0.14, 6);
  }
  // junction box under the windows, its conduit up the wall and into the bay's jamb
  P.junction(hx + 2.5, fz + 0.24, 0);
  P.conduit([[hx + 2.5, 0.76, fz + 0.06], [hx + 2.5, 1.02, fz + 0.06], [hx + 2.02, 1.02, fz + 0.06], [hx + 2.02, 1.02, fz + 0.2]]);

  // floodlights on the hall's front corners, aimed over the apron
  for (const s of [-1, 1]) {
    P.flood(hx + s * (R - 0.14), fz + 0.32, 1.62, -s * 0.3);
    box(0.08, 0.08, 0.3, P.steelD, hx + s * (R - 0.14), 1.4, fz + 0.16, { dirt: 0 });            // wall bracket for the pole
  }

  // beacons: amber on the gable top, team on the vents
  P.beacon(hx, crest + 0.1, fz + 0.16, '#ffb347');
  for (const s of [-1, 1]) P.beacon(hx + s * 1.45, crest - 0.0, hz - 1.8);

  // parts crates stacked beside the hall; apron: a glowing charging pad with its post and conduit, a lane line
  for (const [x, z, y] of [[4.08, -0.9, 0], [4.08, -0.05, 0], [4.08, -0.48, 0.75]]) box(0.72, 0.75, 0.75, M.wood, x, y, z);
  ao(4.08, -0.48, 0.7, 1.7, 0.45);
  const cx = -3.05, cz = 3.15;
  cyl(0.66, 0.05, P.steelD, cx, 0, cz, { seg: 48, dirt: 0, cast: false });
  hoop(0.56, 0.028, P.glow, cx, 0.06, cz, { cast: false });
  hoop(0.3, 0.018, P.glowSoft, cx, 0.06, cz, { cast: false });
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; box(0.22, 0.02, 0.07, M.hazard, cx + Math.cos(a) * 0.43, 0.05, cz + Math.sin(a) * 0.43, { dirt: 0, cast: false, ry: -a }); }
  box(0.5, 1.5, 0.5, gun, -4.05, 0, 2.35); box(0.36, 0.5, 0.05, P.glow, -4.05, 0.9, 2.61, { cast: false }); ao(-4.05, 2.35, 0.6, 0.6, 0.4);
  box(0.36, 0.06, 0.05, P.green, -4.05, 0.7, 2.61, nc);
  P.conduit([[-4.05, 0.35, 2.08], [-4.05, 0.35, fz + 0.08], [hx - 2.3, 0.35, fz + 0.08]], 0.055);
  pipe([[-3.8, 0.12, 2.5], [-3.55, 0.03, 2.75], [-3.45, 0.03, 2.85]], 0.04, M.dark);
  box(4.6, 0.012, 0.14, M.plain('#c9a032'), 0, 0, fz + 1.5, { dirt: 0, cast: false });
}

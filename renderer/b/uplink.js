// Neutral Uplink (the Uplinks victory): an old relay mast standing on no-one's ground. A hexagonal concrete pad
// with a hazard ring and guy-wire anchors, a tall tapering steel lattice mast (three legs, cross-braced) with a
// big dish on a yoke near the top aimed at the sky, a white signal ring round the mast and a beacon on the tip,
// and an equipment hut at its foot. No team colour: the game lights the ring and the beacon in the colour of
// whoever holds it (marks 'ring' and 'beacon'), so the sprite's own lights are a plain pale white.
export const config = { pad: false };
export default function (L) {
  const { box, cyl, sphere, hoop, mesh, lamp, ao, M, THREE } = L;
  L.seed(733);
  const pad = M.paint('#6d7073', { rivets: false, panelW: 256, panelH: 256, rough: 0.92, metal: 0.04 });
  const padD = M.paint('#46494d', { rivets: false });
  const steel = M.plain('#b9bec4', 0.45, 0.7), steelD = M.plain('#6b7178', 0.5, 0.7), dark = M.plain('#1d2024', 0.6, 0.4);
  const white = M.paint('#e2e4e6', { panelW: 96, panelH: 96 }), hut = M.paint('#8f969c', { panelW: 128, panelH: 96 });
  const sig = M.emit('#eef6ff', 2.2), win = M.emit('#cfe8ff', 1.2), red = M.emit('#ff5040', 2.4);
  const hex = (r, h, mat, y = 0, o = {}) => cyl(r, h, mat, 0, y, 0, { seg: 6, ry: Math.PI / 6, ...o });

  // the pad: two stepped hexagons, a hazard ring, guy anchors on three corners
  hex(4.4, 0.26, padD, 0, { dirt: 0.75 });
  hex(4.15, 0.1, pad, 0.26, { dirt: 0.55 });
  cyl(3.25, 0.02, M.hazard, 0, 0.36, 0, { seg: 48, dirt: 0, cast: false });
  cyl(3.0, 0.025, pad, 0, 0.36, 0, { seg: 48, dirt: 0.35, cast: false });

  // the mast: three legs tapering from a wide foot to the head, braced every metre and a bit
  const H = 6.9, r0 = 1.45, r1 = 0.32;
  const leg = (k, y) => { const a = (k / 3) * Math.PI * 2 + Math.PI / 2, r = r0 + (r1 - r0) * (y / H); return [Math.cos(a) * r, 0.38 + y, Math.sin(a) * r]; };
  for (let k = 0; k < 3; k++) {
    L.beam(leg(k, 0), leg(k, H), 0.13, 0.13, steel);
    cyl(0.26, 0.22, steelD, leg(k, 0)[0], 0.36, leg(k, 0)[2], { seg: 8, dirt: 0.4 }); // the footing
  }
  for (let y = 0.9; y < H - 0.3; y += 1.15) {
    for (let k = 0; k < 3; k++) {
      const a = leg(k, y), b = leg((k + 1) % 3, y), c = leg((k + 1) % 3, y + 1.15 > H ? H : y + 1.15);
      L.beam(a, b, 0.06, 0.06, steelD); // the ring brace
      L.beam(a, c, 0.045, 0.045, steelD); // the diagonal
    }
  }
  // the signal ring round the mast, half-way up (lit in the holder's colour by the game)
  const ry = 0.38 + H * 0.55, rr = r0 + (r1 - r0) * 0.55 + 0.35;
  hoop(rr, 0.08, sig, 0, ry, 0, { cast: false });
  hoop(rr, 0.12, steelD, 0, ry - 0.08, 0);
  L.mark('ring', 0, ry, 0);

  // the head: a platform, a yoke and the big dish aimed up at the sky, its feed horn on struts
  const top = 0.38 + H;
  cyl(0.62, 0.12, steelD, 0, top, 0, { seg: 12, dirt: 0.2 });
  // (built with the kit's own mesh and beam, at world positions: the bowl opens up and toward the viewer)
  for (const sx of [-0.62, 0.62]) L.beam([sx, top + 0.12, 0], [sx * 0.9, top + 0.95, 0.12], 0.09, 0.09, steel);
  const dc = [0, top + 1.25, 0.25];
  mesh(new THREE.SphereGeometry(1.55, 32, 12, 0, Math.PI * 2, 0, 0.62), M.plain('#eceef0', 0.55, 0.1), dc[0], dc[1] - 0.95, dc[2] - 1.0, { rx: -2.3, dirt: 0 });
  mesh(new THREE.TorusGeometry(0.9, 0.05, 6, 36), steelD, dc[0], dc[1] + 0.03, dc[2] + 0.02, { rx: -0.73, dirt: 0 });
  for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; L.beam([Math.cos(a) * 0.85, dc[1] + Math.sin(a) * 0.55, dc[2] - Math.sin(a) * 0.3], [0, dc[1] + 0.75, dc[2] + 0.62], 0.035, 0.035, steelD); }
  cyl(0.11, 0.3, dark, 0, dc[1] + 0.62, dc[2] + 0.55, { seg: 10, rx: -0.84, dirt: 0 });
  // the beacon on the tip: a short mast and a lamp (the holder's colour, from the game), and two red aircraft lights
  cyl(0.05, 1.0, dark, 0.38, top + 0.12, -0.3, { seg: 8, dirt: 0 });
  sphere(0.17, sig, 0.38, top + 1.2, -0.3, { cast: false });
  lamp(0.38, top + 1.2, -0.3, '#eef6ff', { shape: 'sphere', size: 0.12, intensity: 3, dist: 4, k: 3 });
  L.mark('beacon', 0.38, top + 1.2, -0.3);
  for (let k = 0; k < 3; k++) { const p = leg(k, H * 0.82); sphere(0.07, red, p[0] * 1.15, p[1], p[2] * 1.15, { cast: false }); }

  // the equipment hut at the foot, with a lit panel and cable trays up the mast
  box(1.25, 0.95, 0.9, hut, -1.95, 0.36, 1.35, { dirt: 0.4 });
  box(1.3, 0.08, 0.95, steelD, -1.95, 1.31, 1.35, { dirt: 0.2 });
  box(0.6, 0.24, 0.02, win, -1.95, 0.85, 1.81, { dirt: 0, cast: false });
  box(0.2, 0.2, 0.02, win, -1.4, 0.75, 1.81, { dirt: 0, cast: false });
  L.beam([-1.5, 1.1, 1.0], [-0.55, 1.6, 0.35], 0.08, 0.05, dark);
  // guy-wire anchors on three corners of the pad
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + Math.PI / 6, x = Math.cos(a) * 3.55, z = Math.sin(a) * 3.55;
    box(0.4, 0.18, 0.4, padD, x, 0.36, z, { dirt: 0.5 });
    const p = leg((k + 1) % 3, H * 0.62);
    L.beam([x, 0.52, z], p, 0.02, 0.02, steelD);
  }
  // white approach lights round the pad's edge
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; sphere(0.08, sig, Math.cos(a) * 3.95, 0.42, Math.sin(a) * 3.95, { cast: false }); }
  ao(0, 0, 2.4, 2.4, 0.45, 0.39);
  void mesh;
}

// The "powered realism" kit for buildings: real materials (concrete, plated steel, hazard stripes, weathering,
// the usual concrete pad) like the Keep and Command Base, with lights and electricity added on top: team-colour
// light strips along edges, lit windows, power conduits with glowing collars, junction boxes with status lights,
// transformers with glowing insulators and a crackle of arc between them, floodlights on poles, sagging cables
// and blinking beacons.
//
// Use (the normal pad stays):  const P = power(L);
//   P.strip(len, x, y, z, ry)            a thin team-colour light strip (along x before rotating by ry)
//   P.windows(w, h, x, y, z, ry, n)      a band of n lit windows on a wall face
//   P.conduit(points, r)                 a steel conduit along [[x, y, z], ...] with glowing collars
//   P.junction(x, z, ry)                 a junction box on the ground: status lights and a glowing vent
//   P.transformer(x, z, ry)              a ribbed transformer with glowing insulators and a small arc between them
//   P.flood(x, z, h, ry)                 a floodlight on a pole, aimed outward (ry), casting warm light
//   P.cable(a, b, sag)                   a sagging power cable between two points
//   P.beacon(x, y, z, hex)               a small glowing beacon (with light)
//   P.arc(a, b, kinks)                   a jagged electric arc between two points
// Materials: P.steel, P.steelD, P.conc, P.glow (team), P.glowSoft, P.warm (window light), P.white, P.amber, P.green.
export function power(L, opts = {}) {
  const { box, cyl, beam, sphere, lamp, M, THREE } = L;
  // The red team's light runs deeper and a little stronger: its pinkish #ff5a6e washes out to pale pink in daylight
  // on bright concrete and yellow steel.
  const C0 = opts.color || L.TEAM, red = /^#ff5a6e$/i.test(C0), C = red ? '#ff2a40' : C0, kk = red ? 1.25 : 1;
  const P = {
    steel: M.paint('#5a6066'), steelD: M.paint('#3f4449', { rivets: false }), conc: M.rough('#8f887c'),
    dark: M.plain('#1b1d20', 0.6, 0.3),
    glow: M.emit(C, 2.4 * kk), glowHi: M.emit(C, 3.4 * kk), glowSoft: M.emit(C, 1.0 * kk),
    warm: M.emit('#ffd9a0', 1.3), white: M.emit('#e8fbff', 2.2), amber: M.emit('#ffb347', 2.6), green: M.emit('#7dff9a', 2.2), arcM: M.emit('#cfefff', 4),
  };
  const nc = { dirt: 0, cast: false };

  function strip(len, x, y, z, ry = 0, w = 0.06, mat = P.glow) { box(len, w, w, mat, x, y, z, { ...nc, ry }); }

  function windows(w, h, x, y, z, ry = 0, n = 4, mat = P.warm) {
    const g = 0.08, ww = (w - g * (n + 1)) / n;
    const c = Math.cos(ry), s = -Math.sin(ry);
    box(w, h + 0.08, 0.04, P.dark, x, y - 0.04, z, { ...nc, ry });
    for (let k = 0; k < n; k++) { const off = -w / 2 + g + ww / 2 + k * (ww + g); box(ww, h, 0.05, mat, x + c * off, y, z + s * off, { ...nc, ry }); }
  }

  function conduit(pts, r = 0.06) {
    L.pipe(pts, r, P.steelD, { cast: true });
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), n = Math.max(1, Math.floor(len / 0.9));
      for (let k = 1; k <= n; k++) {
        const t = k / (n + 1), p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
        const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]].map((v) => v / len);
        beam([p[0] - d[0] * 0.04, p[1] - d[1] * 0.04, p[2] - d[2] * 0.04], [p[0] + d[0] * 0.04, p[1] + d[1] * 0.04, p[2] + d[2] * 0.04], r * 2.6, r * 2.6, P.glow, nc);
      }
    }
  }

  function junction(x, z, ry = 0) {
    box(0.55, 0.7, 0.4, P.steel, x, 0, z, { ry, dirt: 0.5 });
    box(0.6, 0.06, 0.45, P.steelD, x, 0.7, z, { ry, dirt: 0 });
    const c = Math.cos(ry), s = -Math.sin(ry), fx = x - s * 0.21, fz = z + c * 0.21; // front face (+z before rotating)
    for (const [k, mat] of [[-0.15, P.green], [0, P.amber], [0.15, P.glow]]) box(0.06, 0.06, 0.03, mat, fx + c * k, 0.5, fz + s * k, { ...nc, ry });
    box(0.36, 0.14, 0.03, P.glowSoft, fx, 0.22, fz, { ...nc, ry });
  }

  function arc(a, b, kinks = 5, seed = 1) {
    const pts = [a];
    for (let k = 1; k < kinks; k++) {
      const t = k / kinks, j = (n) => Math.sin(seed * 12.9898 + k * 78.233 + n) * 0.08;
      pts.push([a[0] + (b[0] - a[0]) * t + j(1), a[1] + (b[1] - a[1]) * t + j(2), a[2] + (b[2] - a[2]) * t + j(3)]);
    }
    pts.push(b);
    for (let i = 0; i < pts.length - 1; i++) beam(pts[i], pts[i + 1], 0.025, 0.025, P.arcM, nc);
  }

  function transformer(x, z, ry = 0) {
    box(0.9, 0.85, 0.7, P.steelD, x, 0, z, { ry, dirt: 0.5 });
    const c = Math.cos(ry), s = -Math.sin(ry);
    for (let k = -3; k <= 3; k++) box(0.04, 0.7, 0.78, P.steel, x + c * k * 0.12, 0.05, z + s * k * 0.12, { ry, dirt: 0.3 }); // cooling fins
    const tops = [];
    for (const k of [-0.28, 0, 0.28]) {
      const ix = x + c * k, iz = z + s * k;
      cyl(0.05, 0.28, M.plain('#c9c2b0', 0.4, 0.1), ix, 0.85, iz, { seg: 10, dirt: 0 });
      for (const h of [0.92, 1.0, 1.08]) cyl(0.08, 0.02, M.plain('#d8d2c2', 0.4, 0.1), ix, h, iz, { seg: 12, dirt: 0 });
      sphere(0.06, P.white, ix, 1.17, iz, { cast: false });
      tops.push([ix, 1.17, iz]);
    }
    arc(tops[0], tops[1], 4, x + z); arc(tops[1], tops[2], 4, x - z);
    L.pointLight('#bfe8ff', 1.5, x, 1.3, z, 2.2);
  }

  function flood(x, z, h = 2.2, ry = 0) {
    cyl(0.05, h, P.steelD, x, 0, z, { seg: 10, dirt: 0.3 });
    const c = Math.cos(ry), s = Math.sin(ry); // a box turned by ry faces (sin ry, cos ry)
    box(0.34, 0.2, 0.16, P.steel, x + s * 0.05, h, z + c * 0.05, { ry, dirt: 0 });
    box(0.28, 0.14, 0.03, P.white, x + s * 0.14, h + 0.03, z + c * 0.14, { ...nc, ry });
    L.pointLight('#fff1d6', 3, x + s * 0.8, h - 0.4, z + c * 0.8, 4.5);
  }

  function cable(a, b, sag = 0.3, n = 8) {
    const pts = [];
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t]);
    }
    L.pipe(pts, 0.018, P.dark, { cast: true });
  }

  function beacon(x, y, z, hex) { lamp(x, y, z, hex || C, { shape: 'sphere', size: 0.08, intensity: 2.5, dist: 2.5, k: 3.5 }); }

  return { ...P, P, strip, windows, conduit, junction, transformer, flood, cable, beacon, arc };
}

// Shared parts for the "Lancer" road vehicles (truck_l, tanker_l, roadtrain_l): the rocket truck's language on the
// civilian haulers. Dark gunmetal armour, a wedge-nosed cab with a glowing sensor-slit eye across the prow, white LED
// headlight bars on the nose chamfers, an amber beacon, team-colour light strips along the armoured skirts.
// Coordinates are robkit px (1 px = 1/25.6 world unit), x forward, y across (= world z); 10 world units across the frame.
import { kit } from './robkit.js';

export function lancer(L) {
  const { M, TEAM, THREE } = L;
  const R = kit(L, 0, 0), k = R.k;
  const { rect, rr, poly, ext, disc, strip, grime, eye } = R;
  const m = {
    armor: M.paint('#3a4046'), top: M.paint('#4f565e'), roof: M.paint('#5e666f', { rivets: false }),
    dark: M.plain('#1a1c1f', 0.7, 0.3), black: M.plain('#08090a', 0.8), glow: M.emit(TEAM, 1.1),
    steel: M.plain('#626970', 0.3, 0.85), seam: M.plain('#101214', 0.8), lamp: M.emit('#fff1d0', 2.2), amber: M.emit('#ff9a2a', 1.3),
    pipe: M.plain('#2b2f33', 0.45, 0.65), lens: M.plain('#5a1414', 0.35),
  };
  const mir = (pts, s) => pts.map(([x, y]) => [x, s * y]);
  const brakes = [];

  // ---- the cab: wedge body, stepped upper armour, roof plate, seams, the sensor-slit eye and LED bars on the chamfers.
  //   x0 rear, xf nose, xc where the chamfer meets the side, hw half-width, nf half-width of the flat prow,
  //   y0..yt the body; the upper armour sits on top (yt..yt + 0.26), the roof plate on that.
  function cab(o) {
    const { x0, xf, xc, hw, nf, y0, yt } = o, yu = yt + 0.24;
    ext(poly([[xf, -nf], [xc, -hw], [x0 + 3, -hw], [x0, -hw + 3], [x0, hw - 3], [x0 + 3, hw], [xc, hw], [xf, nf]]), y0, yt - y0, m.armor, { bevel: 0.08 });
    ext(poly([[xf - 5, -nf + 3], [xc - 3, -hw + 5], [x0 + 3, -hw + 5], [x0 + 3, hw - 5], [xc - 3, hw - 5], [xf - 5, nf - 3]]), yt - 0.02, 0.26, m.top, { bevel: 0.05 });
    if (o.roof) ext(rr(...o.roof, 4), yu, 0.07, m.roof, { bevel: 0.02 });
    const xb = xc - 8;                                                       // the brow seam where the nose begins
    strip(xb, -hw + 6, xb, hw - 6, 2, yu + 0.01, 0.01, m.seam); strip(xf - 6, 0, xb, 0, 2, yu + 0.01, 0.01, m.seam);
    grime(x0, -hw, xf - x0, 2 * hw, yu + 0.02, 0.7, o.grime ?? 17);
    // the sensor-slit eye: a glowing bracket across the prow
    const xe = xf - 5.5;
    ext(poly([[xe - 6, -15], [xe, -5], [xe, 5], [xe - 6, 15], [xe - 10.5, 13], [xe - 5, 4], [xe - 5, -4], [xe - 10.5, -13]]), yu - 0.02, 0.1, eye(TEAM, 1.3, 0.32), { bevel: 0.01, cast: false });
    // LED headlight bars along the nose chamfers, nudged out so they sit on the chamfer face
    for (const s of [-1, 1]) {
      const ax = xf, az = s * nf, bx = xc, bz = s * hw, dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz);
      const nx = Math.abs(dz) / len, nz = s * Math.abs(dx) / len, t0 = o.lamp0 ?? 0.3, t1 = o.lamp1 ?? 0.85;
      strip(ax + dx * t0 + nx * 0.8, az + dz * t0 + nz * 0.8, ax + dx * t1 + nx * 0.8, az + dz * t1 + nz * 0.8, 3.6, yt - 0.42, 0.18, m.lamp, { cast: false });
    }
    return { yu, xb };
  }
  // ---- small roof furniture
  function beacon(x, y, yb) { disc(x, y, 3.6, yb, 0.06, M.plain('#22262a', 0.6, 0.5)); disc(x, y, 2.6, yb + 0.04, 0.14, m.amber, { cast: false }); }
  function hatch(x, y, r, yb) { disc(x, y, r, yb, 0.05, M.plain('#2d3236', 0.55, 0.5)); L.hoop(r * k, 0.02, m.steel, x * k, yb + 0.05, y * k, R.O()); }
  function mast(x, y, yb) {                                                  // a stub sensor mast with a team eye, as on the warbot
    L.cyl(1.4 * k, 0.3, M.plain('#15171a', 0.6, 0.5), x * k, yb, y * k, R.O({ dirt: 0 }));
    ext(rr(x - 8, y - 3, 16, 6, 3), yb + 0.3, 0.05, M.plain('#c9cdd1', 0.4, 0.3), { bevel: 0.01 });
    disc(x, y, 2.2, yb + 0.35, 0.04, eye(TEAM, 1, 0.3), { cast: false });
  }
  // ---- an exhaust stack in gunmetal: dark pipe, perforated heat shield, soot tip, rain flap; returns the tip height
  function stack(xw, zw, top, foot = 0.55) {
    L.cyl(0.15, top - foot, m.pipe, xw, foot, zw, R.O({ seg: 24, dirt: 0, soot: 0.8 }));
    L.cyl(0.19, 1.0, M.grille('#4f565e'), xw, foot + 0.7, zw, R.O({ seg: 24, dirt: 0 }));
    L.cyl(0.165, 0.22, M.plain('#24211e', 0.8), xw, top - 0.22, zw, R.O({ seg: 24, dirt: 0 }));
    L.cyl(0.12, 0.02, M.plain('#080808', 0.9), xw, top, zw, R.O({ seg: 20, dirt: 0 }));
    const cap = new THREE.CylinderGeometry(0.15, 0.15, 0.025, 20); cap.translate(0.15, 0.012, 0);
    const cm = L.mesh(cap, m.armor, xw - 0.15, top + 0.01, zw, R.O({ dirt: 0 })); cm.rotation.z = 1.15;
    for (const y of [foot + 0.35, top - 0.55]) L.hoop(0.14, 0.03, m.armor, xw, y, zw, R.O());
  }
  // ---- a brake lens (unlit; lit alone in the brake pass)
  function brake(x, y, w, h, y0) { const b = rect(x, y, w, h, y0, 0.05, m.lens, { dirt: 0, cast: false }); brakes.push(b); return b; }
  // ---- finish: low reflections looking straight down (as robkit), then the overlay passes
  function finish(part, keep = {}) {
    const seen = new Set();
    L.getRoot().traverse(o => { if (o.isMesh && !seen.has(o.material) && o.material.envMapIntensity !== undefined) { seen.add(o.material); o.material.envMapIntensity *= o.material.emissiveIntensity > 0 ? 1 : 0.35; } });
    if (!keep[part] && part !== 'brake') return;
    L.getRoot().traverse(o => { if (o.isMesh) o.visible = false; });
    if (part === 'brake') for (const b of brakes) { b.visible = true; b.material = M.emit('#ff2a1e', 4); }
    if (keep[part]) for (const [mm, mat] of keep[part]) { mm.visible = true; mm.material = mat; }
  }
  return { R, k, m, mir, cab, beacon, hatch, mast, stack, brake, finish };
}

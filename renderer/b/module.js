// Space expansion concepts: derelict Accord station modules, neutral, captured like Trade Posts. Pathfinder-era Accord
// white over a gunmetal frame (not the vanguards' war gunmetal), the Trade Post's amber as the neutral light.
//   c=solar  Solar Array: a hub and truss carrying four great sun wings (free power)
//   c=dock   Docking Ring: a ring with four berth arms round a hub (faster Shuttles)
//   c=hulk   Salvage Hulk: the broken mid-section of an Accord freighter, ribs and spilled containers (a one-time haul)
// cap=0 derelict: dark, torn, a dim amber beacon; cap=1 captured: team lights along it, beacons lit, wings mended.
// view=top|hero. (These float in the void, so top is how the game would draw them.)
import { space, num, P } from './spacekit.js';
export const config = { pad: false, size: 1024 };

export function station(K, c, cap, y) {
  const { L, THREE, M, G, mat, B, C, S, beam, hc, strip, plate, tube, facet, oct } = K;
  const NEU = M.emit('#ffc860', cap ? 2.0 : 0.9), lit = cap ? mat.team : M.plain('#2a2c2e', 0.6, 0.3);
  const white = mat.accord, whiteD = mat.accordD;
  let sd = 5; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  if (c === 'solar') {
    hc(1.3, 4.2, white, 0, y, 0, 'x', { seg: 12 }); hc(1.36, 0.25, lit, 1.4, y, 0, 'x', { seg: 12, cast: false }); hc(1.36, 0.25, lit, -1.4, y, 0, 'x', { seg: 12, cast: false });
    B(1.0, 1.0, 22, mat.steel, 0, y - 0.5, 0);
    const cell = M.plain('#1b2a52', 0.25, 0.6), cellB = M.plain('#2b3f78', 0.2, 0.6), frame = M.plain('#a9a59b', 0.5, 0.4);
    for (const [z0, z1] of [[1.2, 10.8], [-1.2, -10.8]]) for (const x0 of [-9.5, 2.0]) {
      const torn = !cap && ((z0 < 0 && x0 > 0) || (z0 > 0 && x0 < 0 && false));
      const segs = 5; for (let k = 0; k < segs; k++) {
        const za = z0 + (z1 - z0) * k / segs, zb = z0 + (z1 - z0) * (k + 1) / segs; if (torn && k >= 2) continue;
        const tilt = torn && k === 1 ? 0.35 : 0; const xa = x0, xb = x0 + 7.5;
        const p = plate([[xa, Math.min(za, zb) + 0.06], [xb, Math.min(za, zb) + 0.06], [xb, Math.max(za, zb) - 0.06], [xa, Math.max(za, zb) - 0.06]], y + 0.1, 0.12, (k % 2 ? cell : cellB), { bevel: 0.02 });
        if (tilt) p.rotation.x = tilt * Math.sign(z0);
        if (!cap && r() < 0.25) B(1.6, 0.14, 1.4, mat.burnt, xa + 1 + r() * 5, y + 0.1, (za + zb) / 2);
      }
      B(7.6, 0.18, 0.18, frame, x0 + 3.75, y + 0.0, z0); B(7.6, 0.18, 0.18, frame, x0 + 3.75, y + 0.0, torn ? z0 + (z1 - z0) * 0.4 : z1);
      beam([x0 + 3.75, y, 0], [x0 + 3.75, y, z0], 0.3, 0.3, mat.steel);
      if (cap) S(0.2, mat.team, x0 + 3.75, y + 0.3, z1);
    }
    S(0.25, NEU, 0, y + 1.4, 0);
  }
  if (c === 'dock') {
    { const g = new THREE.TorusGeometry(8.5, 0.9, 8, 48); g.rotateX(Math.PI / 2); L.mesh(g, white, 0, y, 0, { parent: G, dirt: 0 }); }
    { const g = new THREE.TorusGeometry(8.5, 0.18, 4, 64); g.rotateX(Math.PI / 2); L.mesh(g, lit, 0, y + 0.85, 0, { parent: G, dirt: 0, cast: false }); }
    C(2.4, 2.4, white, 0, y - 1.2, 0, { seg: 12 }); C(1.6, 0.5, whiteD, 0, y + 1.2, 0, { seg: 12 }); C(2.45, 0.2, lit, 0, y + 0.4, 0, { seg: 12, cast: false });
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4, ca = Math.cos(a), sa = Math.sin(a);
      beam([ca * 2.3, y, sa * 2.3], [ca * 7.7, y, sa * 7.7], 0.8, 0.6, mat.steel);
      // a berth: a clamp cradle on the ring's outside, a lamp each side; one broken off when derelict
      if (!cap && k === 3) { B(2.2, 0.4, 1.4, mat.burnt, ca * 11, y - 0.4, sa * 11, { ry: a + 0.6 }); continue; }
      const bx = ca * 10.4, bz = sa * 10.4; B(3.4, 0.6, 2.6, whiteD, bx, y - 0.3, bz, { ry: -a });
      for (const s of [-1, 1]) B(3.0, 0.9, 0.25, mat.armor, bx - sa * s * 1.2, y, bz + ca * s * 1.2, { ry: -a });
      S(0.18, cap ? mat.team : NEU, bx + ca * 1.8, y + 0.5, bz + sa * 1.8);
      for (const s of [-1, 1]) S(0.12, cap ? mat.white : mat.dark, bx - sa * s * 1.4 + ca * 1.6, y + 0.6, bz + ca * s * 1.4 + sa * 1.6);
    }
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; if (!cap && k % 4 === 1) B(1.2, 0.1, 1.0, mat.burnt, Math.cos(a) * 8.5, y + 0.82, Math.sin(a) * 8.5, { ry: -a }); }
    S(0.25, NEU, 0, y + 1.8, 0);
  }
  if (c === 'hulk') {
    // a broken length of Accord freighter: a forward hull piece and an aft piece, ribs across the gap, cargo spilled
    tube([[9.5, 2.2, 1.9], [6.5, 2.6, 2.2], [1.5, 2.6, 2.2]], y, 0, [white, white, whiteD], { t: 0.62, capBack: false });
    tube([[-3.5, 2.6, 2.2], [-8.0, 2.6, 2.2], [-10.0, 2.0, 1.7]], y, 0, [white, white, whiteD], { t: 0.62, capFront: false });
    for (const x of [0.8, -0.2, -1.2, -2.6]) { const g = new THREE.TorusGeometry(2.4, 0.14, 4, 16, Math.PI * (x > 0 ? 1.0 : 0.7)); g.rotateY(Math.PI / 2); const m = L.mesh(g, mat.steel, x, y, 0, { parent: G, dirt: 0 }); m.rotation.x = x * 0.3; }
    B(5.0, 0.2, 2.4, mat.steel, -1.0, y - 1.9, 0);
    const cols = ['#7a5a36', '#4d5a63', '#8a4a2e', '#5f6a4a', '#8b6a2e'];
    [[-0.6, -0.5, 0.2], [0.4, 0.8, -0.3], [-1.8, 0.2, 0.6], [3.0, 3.4, 0.9], [-5.0, -3.8, -0.7]].forEach(([x, z, a], i) => B(2.2, 1.0, 1.1, M.ribbed(cols[i]), x, y - 1.4 + (i > 2 ? 0.8 : 0), z, { ry: a, dirt: 0.4 }));
    for (const [x0, x1] of [[1.5, 1.4], [-3.5, -3.4]]) for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; B(0.4, 0.3, 0.6, mat.burnt, x0, y + Math.cos(a) * 2.0, Math.sin(a) * 2.3); }
    for (const x of [8.0, -7.0]) for (const s of [-1, 1]) S(0.16, cap ? mat.team : (x > 0 && s > 0 ? NEU : mat.dark), x, y + 1.6, s * 2.3);
    if (cap) { strip(9, 2.0, 2, 2.4, 0.12, y + 1.2, 0.05, mat.team); strip(9, -2.0, 2, -2.4, 0.12, y + 1.2, 0.05, mat.team); }
    // a cutting rig clamped on once captured: haulers cut it up
    if (cap) { B(1.6, 1.0, 1.6, mat.armor, 5.0, y + 2.0, 0); beam([5.0, y + 2.8, 0], [1.6, y + 1.2, 0], 0.2, 0.2, mat.steel); S(0.3, M.emit('#fff1c2', 3), 1.5, y + 1.2, 0); }
  }
}

export default function (L) {
  const c = P.get('c') || 'solar', view = P.get('view') || 'top', cap = num('cap', 0);
  const K = space(L, { view, W: num('W', 26), hero: { half: num('half', 11), width: 0.75, cy: 0.5 } });
  station(K, c, cap, view === 'hero' ? num('alt', 4) : 0);
  K.settle();
}

// Terraforming stage 4: the Sluice, the owner's pick from the stage 4 canvas (Sluice Dam concept A, "Radial Gates";
// the concept scene with its three looks stayed on the canvas). Two tiles long (20 x 10 world units, framed like the
// Mass Driver), on the bank: the water on one long side, the low ground on the other. Shipped without land or water
// (the game draws them): the concrete sill and apron, three piers, two curved steel radial gates on trunnion arms, the
// deck with its railings and a hoist house over each bay (the team strip, an accent lamp: spillway mint, lit while it
// runs), a floodlight and a beacon.
//   dir = n | s | e | w   the side the water is on (n: the gates face south, the spill runs south; e and w lie north-south)
//   f   = 0 shut | 3 open (the gates swung up, the spill sheet and its foam below the sill)
const Q = new URLSearchParams(location.search);
const DIR = Q.get('dir') || 'n', F = +(Q.get('f') || 0);
import { power } from './powerkit.js';
export const config = { pad: false };
export const FRAME = { half: 10.12, width: 0.85, cy: 0.57 };
const ROT = { n: 0, s: Math.PI, e: -Math.PI / 2, w: Math.PI / 2 };

export default function (L) {
  const { THREE, M, box, beam, sphere, hcyl, mesh, ACCENT } = L;
  L.seed(9100 + 6);
  L.frameCompoundOpts(FRAME);
  const P = power(L);
  const conc = M.rough('#9a9285'), concD = M.rough('#7d766b'), steel = M.paint('#5a6066'), steelD = M.paint('#3f4449', { rivets: false });
  const gateM = M.paint('#4f5a5e', { panelW: 128, panelH: 96 });
  const acc = M.emit(ACCENT, 2.4), accDim = M.emit(ACCENT, 0.9);
  const nc = { dirt: 0, cast: false };
  const open = Math.min(1, F / 3);
  const root = L.getRoot(), before = new Set(root.children);
  const CW = 12, lowY = -0.4;
  const foamM = new THREE.MeshStandardMaterial({ color: '#f4f6f6', roughness: 0.6, transparent: true, opacity: 0.55, depthWrite: false });
  const foamD = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6, transparent: true, opacity: 0.8, depthWrite: false });
  function spill(x0, x1, k) {
    const w = x1 - x0, n = 10, g = new THREE.PlaneGeometry(w, 1, 1, n), pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) { const t = pos.getY(i) + 0.5; pos.setXYZ(i, pos.getX(i), -0.3 - (1 - t) * 0.4 + 0.2, 1.0 + (1 - t) * (1 - t) * 1.2 * k); }
    g.computeVertexNormals();
    const wm = new THREE.MeshStandardMaterial({ color: '#cfe9ee', roughness: 0.3, transparent: true, opacity: 0.85, side: THREE.DoubleSide, emissive: '#223338', depthWrite: false });
    mesh(g, wm, (x0 + x1) / 2, 0, 0.2, nc);
    const fl = (r, m, x, y, z, sy = 0.3) => { const s = new THREE.SphereGeometry(r, 12, 8); s.scale(1, sy, 1); mesh(s, m, x, y, z, nc); };
    for (let i = 0; i < 40 * k * w / 4; i++) fl(0.15 + L.rnd() * 0.3 * k, L.rnd() < 0.5 ? foamM : foamD, x0 + L.rnd() * w, lowY + 0.08, 1.4 + L.rnd() * 2.2 * k);
    for (let i = 0; i < 18 * k; i++) fl(0.18 + L.rnd() * 0.25, foamM, x0 + L.rnd() * w, lowY + 0.3 + L.rnd() * 1.0 * k, 1.2 + L.rnd() * 0.8, 0.8);
  }
  const lamp = (x, y, z, lit) => { box(0.22, 0.22, 0.22, steelD, x, y, z, { dirt: 0 }); sphere(0.1, lit ? acc : accDim, x, y + 0.26, z, { cast: false }); };
  // three piers, two bays; radial gates on trunnion arms; a hoist house over each bay; the deck; the apron below
  const piers = [-CW / 2 + 0.6, 0, CW / 2 - 0.6], BW = CW / 2 - 1.2;
  box(CW + 0.4, 0.8, 2.4, concD, 0, -0.6, 0.4, { dirt: 0.5 });
  box(CW, 0.25, 3.2, conc, 0, -0.45, 2.2, { dirt: 0.4 });
  for (const x of piers) { box(1.2, 1.6, 3.6, conc, x, -0.4, 0, { dirtH: 1.5 }); mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.6, 20, 1, false, 0, Math.PI).translate(0, 0.8, 0), conc, x, -0.4, -1.8, { ry: Math.PI / 2 }); }
  for (const s of [-1, 1]) box(1.6, 1.0, 4.4, conc, s * (CW / 2 + 1.4), -0.4, 0.2, { dirtH: 1 }); // (the abutments in the banks)
  box(CW + 1.4, 0.3, 1.6, conc, 0, 1.2, -0.4, { dirt: 0.3 });
  L.railing([[-CW / 2, -1.15], [CW / 2, -1.15]], 1.5); L.railing([[-CW / 2, 0.35], [CW / 2, 0.35]], 1.5);
  for (const b of [-1, 1]) {
    const cx = b * (CW / 4), ang = open * 0.95, TR = [cx, 0.3, 1.6], R = 2.0;
    const g = L.group(cx, TR[1], TR[2]); g.rotation.x = -ang;
    const sk = new THREE.CylinderGeometry(R, R, BW, 24, 1, true, Math.PI * 1.08, Math.PI * 0.32); sk.rotateZ(Math.PI / 2);
    mesh(sk, gateM, 0, 0, 0, { parent: g, dirt: 0.4 }).material.side = THREE.DoubleSide;
    for (const s of [-1, 1]) { beam([s * BW / 2 * 0.92, 0, 0], [s * BW / 2 * 0.92, -R * Math.cos(0.36), -R * 0.55], 0.22, 0.3, steel, { parent: g }); beam([s * BW / 2 * 0.92, 0, 0], [s * BW / 2 * 0.92, -R * 0.35, -R * 0.94], 0.22, 0.3, steel, { parent: g }); }
    L.box(BW * 0.96, 0.12, 0.14, M.hazard, 0, -R * 0.98, -R * 0.2, { parent: g, dirt: 0 });
    hcyl(0.35, 0.5, steelD, cx - BW / 2 + 0.2, TR[1], TR[2], { axis: 'x' }); hcyl(0.35, 0.5, steelD, cx + BW / 2 - 0.2, TR[1], TR[2], { axis: 'x' });
    box(2.4, 1.3, 1.3, M.paint('#c9c5ba', { rivets: false }), cx, 1.5, -0.45, { dirtH: 1 }); box(2.5, 0.12, 1.4, steelD, cx, 2.8, -0.45, { dirt: 0 });
    P.strip(2.2, cx, 2.3, 0.21, 0); lamp(cx + 0.9, 2.92, -0.45, open > 0);
    for (const s of [-1, 1]) beam([cx + s * 0.8, 1.5, 0.15], [cx + s * 0.8, 0.3 + Math.cos(ang) * 0.4, 1.6 - Math.sin(ang) * 2.0], 0.06, 0.06, M.plain('#222', 0.5, 0.6), nc);
    if (open > 0) spill(cx - BW / 2, cx + BW / 2, open);
  }
  P.flood(-CW / 2 - 1.6, 0.6, 2.4, 0.6); P.beacon(CW / 2 + 1.4, 1.7, -0.6);
  // turned for the side the water is on
  const G = new THREE.Group(); G.rotation.y = ROT[DIR] || 0; root.add(G);
  for (const c of root.children.slice()) if (!before.has(c) && c !== G) G.add(c);
}

// Stone gates to go with stone.js (?style= a | b | c), piece = ew-closed | ew-open | ns-closed | ns-open.
// Two of the style's towers flank the opening under a massive stone lintel lined with lanterns:
//   a  heavy double doors of dark iron-banded timber with a team emblem, swung back into the towers when open
//   b  an iron portcullis, raised up into the lintel when open
//   c  two thick white slabs with a team light-line, slid apart into the towers when open
// 'ew' sits in a wall running east-west (the doors face the camera); 'ns' in a wall running north-south.
import { stoneKit } from './stone.js';

let L, K, m, NS, OPEN, HL, PX, GW;
const DH = 3.6;
function W(u, y, z) { return NS ? [z, y, -u] : [u, y, z]; }

export function sparks(f, grp) {
  if (K.STYLE !== 'e') return;
  const { arc, spark, R, seed } = L;
  seed(4400 + f * 131 + (NS ? 7 : 0));
  const y = DH + 0.35 + 1.3, sc = HL / 5;
  const W2 = (u, yy, z) => (NS ? [z, yy, -u] : [u, yy, z]);
  for (let k = 0; k < 1 + (f % 2); k++) {
    const u0 = R(-PX + 1.3, PX - 2.2), u1 = Math.min(PX - 1.3, u0 + R(0.8, 1.6));
    arc(grp, W2(u0, y + R(-0.2, 0.2), R(-0.25, 0.25)), W2(u1, y + R(-0.2, 0.2), R(-0.25, 0.25)), { r: 0.05, rough: 0.4, branches: 2 });
  }
  const u = [-1.2, 0, 1.2][f % 3] * sc;
  arc(grp, W2(u, y + 0.1, 0.2), W2(u, DH + 0.35 + 1.95, 0), { r: 0.04, branches: 0 });
  spark(grp, W2(u, DH + 0.35 + 1.95, 0), 0.1);
}

export default function (lib) {
  L = lib;
  K = stoneKit(L); m = K.mats();
  const { box, group, mesh, THREE } = L;
  const S = K.STYLE, P = L.PIECE;
  NS = P.startsWith('ns'); OPEN = P.endsWith('open');
  HL = NS ? L.TILE_NS : 5.0;
  const sc = HL / 5;
  PX = 3.55 * sc; GW = PX - 1.5;
  L.seed(4243);
  const yaw = NS ? Math.PI / 2 : 0;
  K.segment(PX + 1.4, HL, yaw, m, { light: false });
  K.segment(-HL, -PX - 1.4, yaw, m, { light: false });
  // the towers either side
  let topY = 0;
  for (const s of [-1, 1]) { const [x, , z] = W(s * PX, 0, 0); topY = K.tower(x, z, m, 0.82); }
  // the lintel across the top, with lanterns, and the team band on its face
  const g = group(0, 0, 0, yaw);
  const ly = DH + 0.35;
  box(2 * PX, 1.0, 2.6, S === 'c' ? m.slab : m.cap, 0, ly, 0, { parent: g, dirt: 0.15 });
  for (const s of [-1, 1]) box(2 * PX - 1.2, 0.18, 0.05, S === 'c' ? m.glow : m.team, 0, ly + 0.45, s * 1.31, { parent: g, dirt: 0, cast: S !== 'c' });
  if (S !== 'e') for (const u of [-1.0, 0, 1.0]) K.lantern(g, m, u * sc * 1.1, ly + 1.0, 0);
  else for (const u of [-1.2, 0, 1.2]) { L.box(0.12, 0.9, 0.12, m.iron, u * sc, ly + 1.0, 0, { parent: g, dirt: 0 }); L.cyl(0.08, 0.18, m.ins, u * sc, ly + 1.85, 0, { parent: g, seg: 10, dirt: 0 }); }
  // the threshold
  box(2 * GW + 0.4, 0.12, 2.4, m.footing, 0, 0, 0, { parent: g, dirt: 0.3 });
  if (S === 'e') { // a coil of wire along the lintel, live
    K.coil(g, m, -PX + 1.2, PX - 1.2, ly + 1.3, 0, 0.3);
  }
  if (S === 'e') {
    // a steel blast door: two thick gunmetal leaves, riveted plate with raised ribs and stiffeners, a hazard band at
    // the foot and the team light-line down the seam; open, they slide apart into the towers
    const steelP = L.M.paint('#3c4146', { panelW: 128, panelH: 170 }), rib = L.M.paint('#2c3034', { rivets: false });
    for (const s of [-1, 1]) {
      const slide = OPEN ? s * (GW - 0.1) : 0;
      const leaf = group(slide + s * GW / 2, 0.12, 0, 0, g);
      box(GW - 0.04, DH - 0.15, 0.7, steelP, 0, 0, 0, { parent: leaf, dirtH: 1.3 });
      for (const z of [-0.37, 0.37]) {
        for (const y of [0.55, 1.45, 2.35]) box(GW - 0.25, 0.22, 0.08, rib, 0, y, z, { parent: leaf, dirt: 0.2 });
        for (const u of [-GW / 2 + 0.3, 0, GW / 2 - 0.3]) box(0.16, DH - 0.5, 0.06, rib, u, 0.2, z, { parent: leaf, dirt: 0.2 });
        box(GW - 0.1, 0.3, 0.05, m.haz || L.M.hazard, 0, 0.05, z * 1.04, { parent: leaf, dirt: 0 });
        box(0.06, DH - 0.7, 0.04, m.glow, -s * (GW / 2 - 0.06), 0.35, z * 1.06, { parent: leaf, dirt: 0, cast: false });
      }
    }
  } else if (S === 'a' || S === 'd') {
    // two door leaves of iron-banded timber; open, they swing back flat against the towers' faces
    for (const s of [-1, 1]) {
      const leaf = group(s * GW, 0.12, 0.35, OPEN ? -s * Math.PI / 2 * 0.92 : 0, g);
      box(GW, DH - 0.2, 0.32, L.M.plain('#4a3524', 0.85), -s * GW / 2, 0, 0, { parent: leaf, dirtH: 1.4 });
      for (const y of [0.5, 1.6, 2.7]) box(GW, 0.16, 0.36, m.iron, -s * GW / 2, y, 0, { parent: leaf, dirt: 0 });
      for (let k = 0; k < 3; k++) box(0.08, DH - 0.25, 0.34, L.M.plain('#3a2a1c', 0.9), -s * (0.35 + k * (GW - 0.5) / 2), 0.02, 0, { parent: leaf, dirt: 0 });
    }
    if (!OPEN) { L.cyl(0.42, 0.06, m.team, 0, 1.9, 0.53, { parent: g, seg: 20, dirt: 0 }); box(0.18, 0.62, 0.08, m.team, 0, 1.6, 0.53, { parent: g, dirt: 0 }); }
  } else if (S === 'b') {
    // the portcullis: an iron grid in grooves, down or raised into the lintel
    const lift = OPEN ? DH - 0.55 : 0;
    const pc = group(0, 0.12 + lift, 0, 0, g);
    for (let u = -GW + 0.25; u <= GW - 0.24; u += 0.42) box(0.1, DH - 0.15, 0.1, m.iron, u, 0, 0, { parent: pc, dirt: 0 });
    for (let y = 0.35; y < DH - 0.2; y += 0.55) box(2 * GW - 0.2, 0.09, 0.12, m.iron, 0, y, 0, { parent: pc, dirt: 0 });
    for (let u = -GW + 0.25; u <= GW - 0.24; u += 0.42) { const cg = new THREE.ConeGeometry(0.06, 0.25, 5); cg.rotateX(Math.PI); mesh(cg, m.iron, u, -0.12, 0, { parent: pc, dirt: 0 }); }
    for (const s of [-1, 1]) box(0.25, DH, 0.3, m.grey, s * (GW + 0.05), 0.12, 0, { parent: g, dirt: 0.3 });
  } else {
    // two thick white slabs with a team light-line, slid apart into the towers when open
    for (const s of [-1, 1]) {
      const slide = OPEN ? s * (GW - 0.15) : 0;
      const leaf = group(slide + s * GW / 2, 0.12, 0, 0, g);
      box(GW - 0.04, DH - 0.15, 0.9, m.slab, 0, 0, 0, { parent: leaf, dirtH: 1.2 });
      for (const z of [-0.46, 0.46]) {
        box(0.07, DH - 0.6, 0.03, m.glow, -s * (GW / 2 - 0.25), 0.25, z, { parent: leaf, dirt: 0, cast: false });
        box(GW - 0.6, 0.06, 0.03, m.mortar, 0, 1.75, z, { parent: leaf, dirt: 0, cast: false });
      }
    }
  }
  void topY;
}

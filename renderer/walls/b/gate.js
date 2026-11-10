// Electrified gate: two tall horned pylons with angry eye-slits, an overhead gantry, and jaw-like blast doors
// with interlocking teeth. piece = ew-closed | ew-open | ns-closed | ns-open.
// 'ew' sits in a wall running east-west (doors face the camera); 'ns' in a wall running north-south.
import { kit } from './wall.js';

let L, K, m, TEAM, NS, OPEN, HL, PX, GW;
const DH = 3.5, DT = 0.62, BEAM_Y = 4.55;

// local gate coords: u along the wall, z across it; to world
function W(u, y, z) { return NS ? [z, y, -u] : [u, y, z]; }
function fromLocal(u, z) { return NS ? [z, -u] : [u, z]; }

function horn(base, dirOut, len, r0) {
  const { THREE } = L;
  // a curved tapering horn: rises, then hooks toward the gate centre
  const pts = [];
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    pts.push(new THREE.Vector3(base[0] + dirOut[0] * len * 0.75 * t * t, base[1] + len * Math.sin(t * 1.25) * 0.85, base[2] + dirOut[1] * len * 0.75 * t * t));
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], ra = r0 * (1 - i / 6) + 0.02, rb = r0 * (1 - (i + 1) / 6) + 0.02;
    const d = b.clone().sub(a), len2 = d.length();
    const geo = new THREE.CylinderGeometry(rb, ra, len2 * 1.06, 10); geo.translate(0, len2 / 2, 0);
    const mm = L.mesh(geo, m.steel, a.x, a.y, a.z, { dirt: 0 });
    mm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  }
  return pts[pts.length - 1].toArray();
}

const tips = [];
function pylon(sign) {
  const { box, cyl, mesh, sphere, hoop, ao, pointLight, THREE } = L;
  const [x, z] = fromLocal(sign * PX, 0);
  const r8 = Math.PI / 8;
  cyl(2.15, 0.55, m.conc, x, 0, z, { seg: 8, ry: r8, rTop: 2.05, dirtH: 0.55 });
  cyl(2.08, 0.13, m.haz, x, 0.36, z, { seg: 8, ry: r8, dirt: 0 });
  cyl(1.6, 4.6, m.armor, x, 0.55, z, { seg: 8, ry: r8, rTop: 1.22, dirtH: 1.9 });
  for (let k = 0; k < 4; k++) {
    const ang = Math.PI / 4 + k * Math.PI / 2;
    const rg = new THREE.BoxGeometry(0.34, 4.3, 0.3); rg.translate(0, 4.3 / 2, 0);
    const rib = mesh(rg, m.armorD, x + Math.cos(ang) * 1.5, 0.55, z + Math.sin(ang) * 1.5, { dirtH: 1.6 });
    rib.rotation.y = -ang; rib.rotation.z = 0.085;
  }
  // angry eyes toward the camera (world +z), plus a vent stack
  const fz = z + 1.32;
  for (const s of [-1, 1]) {
    const e = mesh(new THREE.BoxGeometry(0.7, 0.22, 0.08), m.dark, x + s * 0.4, 3.75, fz, { dirt: 0, cast: false });
    e.rotation.z = s * 0.4; e.rotation.x = -0.08;
    const g = mesh(new THREE.BoxGeometry(0.58, 0.085, 0.06), m.glowHot, x + s * 0.4, 3.75, fz + 0.05, { dirt: 0, cast: false });
    g.rotation.z = s * 0.4; g.rotation.x = -0.08;
  }
  for (let k = 0; k < 4; k++) { box(0.56, 0.07, 0.06, m.glow, x, 1.45 + k * 0.36, z + 1.46 - k * 0.03, { cast: false }); box(0.7, 0.18, 0.05, m.dark, x, 1.4 + k * 0.36, z + 1.44 - k * 0.03, { dirt: 0, cast: false }); }
  // collar, coil, toroid
  cyl(1.36, 0.28, m.cap, x, 5.15, z, { seg: 8, ry: r8, dirt: 0 });
  for (let k = 0; k < 4; k++) { cyl(0.4 - k * 0.03, 0.11, m.ins, x, 5.43 + k * 0.2, z, { seg: 18, dirt: 0 }); cyl(0.25, 0.09, m.ins, x, 5.54 + k * 0.2, z, { seg: 14, dirt: 0 }); }
  hoop(0.62, 0.22, m.steel, x, 6.35, z);
  hoop(0.62, 0.035, L.M.emit(TEAM, 1.6), x, 6.57, z, { cast: false });
  sphere(0.16, L.M.emit(TEAM, 2.0), x, 6.42, z, { cast: false });
  // two hooked horns reaching toward the opening (lightning jumps between their tips)
  const inward = fromLocal(-sign, 0);
  for (const off of [-0.55, 0.55]) {
    const [ox, oz] = fromLocal(0, off);
    const tip = horn([x + inward[0] * 0.9 + ox, 5.3, z + inward[1] * 0.9 + oz], inward, 1.9, 0.2);
    tips.push({ sign, tip });
  }
  pointLight(TEAM, 3, x, 6.9, z + 0.6, 3);
  pointLight(TEAM, 2.5, x, 3.7, z + 2.4, 2.4);
  ao(x, z, 4.2, 4.2, 0.45);
}

function seam() {
  // shared zig-zag boundary between the two jaw halves (u, y), top to bottom
  const teeth = 5, th = DH / teeth, tw = 0.45, Z = [[0, DH]];
  for (let k = 0; k < teeth; k++) {
    Z.push([-tw, DH - (k + 0.5) * th]);
    if (k < teeth - 1) Z.push([tw, DH - (k + 1) * th]);
  }
  Z.push([0, 0]);
  return Z;
}
function doorHalf(sign, slide) {
  const { THREE, mesh, box } = L;
  const Z = seam(), E = sign * (GW + 0.25);
  const sh = new THREE.Shape();
  if (sign > 0) { sh.moveTo(E, 0); sh.lineTo(E, DH); for (const [u, y] of Z) sh.lineTo(u, y); }
  else { sh.moveTo(E, DH); sh.lineTo(E, 0); for (const [u, y] of [...Z].reverse()) sh.lineTo(u, y); }
  sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: DT, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 1 });
  geo.translate(0, 0, -DT / 2);
  const u0 = sign * slide;
  const g = L.group(...(NS ? [0, 0, -u0] : [u0, 0, 0]), NS ? Math.PI / 2 : 0);
  mesh(geo, m.armorDoor, 0, Y_DOOR, 0, { parent: g, dirtH: 1.6 });
  for (const s of [-1, 1]) {
    const zf = s * (DT / 2 + 0.06);
    box(GW - 0.55, 0.5, 0.05, m.haz, sign * (GW / 2 + 0.45), Y_DOOR + 0.3, zf, { parent: g, dirt: 0 });
    for (const uu of [1.0, GW - 0.1]) box(0.16, DH - 0.4, 0.08, m.armorD, sign * uu, Y_DOOR + 0.2, zf, { parent: g, dirt: 0 });
    box(GW - 1.4, 0.07, 0.05, m.glow, sign * (GW / 2 + 0.55), Y_DOOR + DH - 0.55, zf + s * 0.02, { parent: g, cast: false });
    if (sign > 0) {
      // the glowing seam between the jaws
      for (let i = 0; i < Z.length - 1; i++) {
        const [u1, y1] = Z[i], [u2, y2] = Z[i + 1], len = Math.hypot(u2 - u1, y2 - y1);
        const sm = mesh(new THREE.BoxGeometry(len, 0.075, 0.05), m.glowHot, (u1 + u2) / 2, Y_DOOR + (y1 + y2) / 2, zf + s * 0.03, { parent: g, dirt: 0, cast: false });
        sm.rotation.z = Math.atan2(y2 - y1, u2 - u1);
      }
    }
  }
  return g;
}
const Y_DOOR = 0.2;

export default function (lib) {
  L = lib; TEAM = L.TEAM;
  K = kit(L); m = K.mats();
  m.armorDoor = L.M.paint('#2b3034', { panelW: 170, panelH: 128 });
  const P = L.PIECE;
  NS = P.startsWith('ns'); OPEN = P.endsWith('open');
  HL = NS ? L.TILE_NS : 5.0;
  const sc = HL / 5;
  PX = 3.45 * sc; GW = PX - 1.3;
  L.seed(4242);
  const yaw = NS ? Math.PI / 2 : 0;
  // wall stubs out to the tile edges (they continue the neighbouring wall arms)
  K.segment(PX, HL, yaw, m);
  K.segment(-HL, -PX, yaw, m);
  pylon(1); pylon(-1);
  // threshold: grating with hazard edges and live rails
  const { box } = L;
  const tl = 2 * GW + 0.6;
  const [tw, td] = NS ? [3.2, tl] : [tl, 3.2];
  box(tw, 0.14, td, L.M.grating, 0, 0, 0, { dirt: 0 });
  for (const s of [-1, 1]) {
    const [x, z] = fromLocal(0, s * 1.5);
    box(NS ? 0.26 : tl, 0.16, NS ? tl : 0.26, m.haz, x, 0, z, { dirt: 0 });
    const [x2, z2] = fromLocal(0, s * 0.9);
    box(NS ? 0.08 : tl - 0.4, 0.06, NS ? tl - 0.4 : 0.08, m.glow, x2, 0.14, z2, { cast: false });
  }
  // overhead gantry between the pylons with a hazard-striped face and team warning lights
  const gl = 2 * PX;
  const [gw2, gd2] = NS ? [0.9, gl] : [gl, 0.9];
  box(gw2, 0.55, gd2, m.cap, 0, BEAM_Y, 0, {});
  for (const s of [-1, 1]) {
    const [x, z] = fromLocal(0, s * 0.47);
    box(NS ? 0.05 : gl - 2.6, 0.32, NS ? gl - 2.6 : 0.05, m.haz, x, BEAM_Y + 0.12, z, { dirt: 0 });
  }
  for (const u of [-1.1, 0, 1.1]) { const [x, z] = fromLocal(u * sc, 0); L.lamp(x, BEAM_Y + 0.55, z, TEAM, { size: 0.2, k: 3, intensity: 2.5, dist: 3 }); }
  // the doors: closed = jaws meeting in the middle; open = slid away into the pylons
  const slide = OPEN ? GW + 0.4 : 0;
  doorHalf(1, slide); doorHalf(-1, slide);
}

export function sparks(f, grp) {
  const { arc, spark, R, seed } = L;
  seed(5000 + (NS ? 300 : 0) + (OPEN ? 70 : 0) + f * 131);
  // lightning between the horn tips across the opening
  const left = tips.filter(t => t.sign < 0), right = tips.filter(t => t.sign > 0);
  const nb = OPEN ? 2 : 1 + (f % 2);
  for (let k = 0; k < nb; k++) {
    const a = left[Math.floor(R(0, left.length))].tip, b = right[Math.floor(R(0, right.length))].tip;
    arc(grp, a, b, { r: R(0.06, 0.09), rough: 0.22, branches: 3 });
    spark(grp, a, 0.14); spark(grp, b, 0.14);
  }
  if (!OPEN) {
    // crackle along the jaw seam
    for (let k = 0; k < 3; k++) {
      const y = Y_DOOR + R(0.4, DH - 0.3), z = R(-1, 1) < 0 ? -(DT / 2 + 0.1) : DT / 2 + 0.1;
      const p0 = W(-0.35, y, z), p1 = W(0.35, y + R(-0.4, 0.4), z);
      arc(grp, p0, p1, { r: 0.045, rough: 0.5, branches: 1 });
    }
  } else {
    // the live rails in the threshold spit sparks
    for (let k = 0; k < 2; k++) {
      const s = R(-1, 1) < 0 ? -0.9 : 0.9, u = R(-GW + 0.4, GW - 0.4);
      const p0 = W(u, 0.2, s), p1 = W(u + R(-0.5, 0.5), R(0.5, 1.1), s + R(-0.3, 0.3));
      arc(grp, p0, p1, { r: 0.045, branches: 1 });
      spark(grp, p0, 0.1);
    }
  }
}

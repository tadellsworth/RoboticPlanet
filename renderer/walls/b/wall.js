// Electrified wall: a pylon post with a tesla coil and angry glowing eye-slits, plus four arm pieces
// (n, e, s, w) of sloped dark armour with spikes, insulators and a live conductor rail.
// One tile = 10 world units across; n/s arms are TILE_NS long so they meet the next tile on screen.
// piece = post | n | e | s | w | all
let L, TEAM, PIECE, TILE_NS;
const ARM0 = 0.55;                       // arms start inside the post

function armLen(dir) { return (dir === 'n' || dir === 's') ? TILE_NS : 5.0; }
const YAW = { e: 0, n: Math.PI / 2, w: Math.PI, s: -Math.PI / 2 };

function mats() {
  const { M } = L;
  return {
    conc: M.rough('#5c5852'), armor: M.paint('#30353a', { panelW: 128, panelH: 170 }), armorD: M.paint('#24282c', { rivets: false }),
    cap: M.paint('#3b4045', { rivets: false }), steel: M.steel, ins: M.plain('#3a2c27', 0.32, 0.15),
    copper: M.plain('#9a6038', 0.38, 0.85), glow: M.emit(TEAM, 2.6), glowHot: M.emit(TEAM, 4), haz: M.hazard, dark: M.dark,
  };
}

const WH = 2.6, HB = 1.1, HT = 0.66, Y0 = 0.45, YC = Y0 + WH;   // wall body height, half-widths, footing top, coping

// a straight wall segment from x=a to x=b along the local +x axis, turned by yaw
function segment(a, b, yaw, m, o = {}) {
  const { box, cyl, hcyl, mesh, group, ao, THREE } = L;
  const l = b - a, cx = (a + b) / 2;
  const g = group(0, 0, 0, yaw);
  box(l, Y0, 2.7, m.conc, cx, 0, 0, { parent: g, dirtH: Y0 });
  box(l, 0.11, 2.73, m.haz, cx, 0.27, 0, { parent: g, dirt: 0 });
  const sh = new THREE.Shape();
  sh.moveTo(-HB, 0); sh.lineTo(HB, 0); sh.lineTo(HT, WH); sh.lineTo(-HT, WH); sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: l, bevelEnabled: false });
  geo.rotateY(Math.PI / 2); geo.translate(a, Y0, 0);
  mesh(geo, m.armor, 0, 0, 0, { parent: g, dirtH: 1.5 });
  const tilt = Math.atan((HB - HT) / WH);
  if (o.fins !== false) {
    const n = Math.max(2, Math.round(l / 1.3)), step = l / n;
    for (let k = 0; k < n; k++) {
      const x = a + k * step + (k === 0 ? 0.4 : 0);
      for (const s of [-1, 1]) {
        const fg = new THREE.BoxGeometry(0.22, WH + 0.05, 0.36); fg.translate(0, (WH + 0.05) / 2, 0);
        const f = mesh(fg, m.armorD, x, Y0, s * (HB - 0.08), { parent: g, dirtH: 1.3 });
        f.rotation.x = -s * tilt;
      }
      const xm = a + k * step + step / 2;
      for (const s of [-1, 1]) {
        const hw = HB - (HB - HT) * (0.95 / WH);
        box(0.66, 0.22, 0.06, m.dark, xm, Y0 + 0.88, s * (hw + 0.02), { parent: g, dirt: 0, cast: false });
        box(0.54, 0.065, 0.05, m.glow, xm, Y0 + 0.95, s * (hw + 0.045), { parent: g, cast: false });
      }
    }
  }
  box(l, 0.16, 2 * HT + 0.12, m.cap, cx, YC, 0, { parent: g, dirt: 0 });
  for (let x = a + 0.35; x < b - 0.15; x += 0.72) {
    for (const s of [-1, 1]) {
      const cg = new THREE.ConeGeometry(0.11, 0.66, 6); cg.translate(0, 0.33, 0); cg.rotateX(s * 0.75);
      mesh(cg, m.steel, x, YC + 0.11, s * (HT + 0.02), { parent: g, dirt: 0 });
    }
  }
  const ins = [];
  for (let x = (o.insStart ?? a + 1.1); x < b - 0.5; x += 1.6) ins.push(x);
  for (const x of ins) {
    for (let k = 0; k < 3; k++) { cyl(0.2, 0.07, m.ins, x, YC + 0.16 + k * 0.13, 0, { parent: g, dirt: 0, seg: 16 }); cyl(0.11, 0.06, m.ins, x, YC + 0.23 + k * 0.13, 0, { parent: g, dirt: 0, seg: 12 }); }
    box(0.18, 0.08, 0.18, m.steel, x, YC + 0.55, 0, { parent: g, dirt: 0 });
  }
  hcyl(0.07, l, m.copper, cx, RAIL_Y, 0, { parent: g, axis: 'x', dirt: 0, seg: 12 });
  const wx = Math.cos(yaw) * cx, wz = -Math.sin(yaw) * cx;
  const horiz = Math.abs(Math.cos(yaw)) > 0.5;
  ao(wx, wz, horiz ? l : 2.6, horiz ? 2.6 : l, 0.38);
}
const RAIL_Y = YC + 0.66;

function arm(dir, m) { segment(ARM0, armLen(dir), YAW[dir], m); }
function hub(kind, m) {   // connector used instead of the post on straight runs (covers where the post would stand)
  const h = kind === 'hub-ns' ? 2.0 * TILE_NS / 5 : 2.0;
  segment(-h, h, kind === 'hub-ns' ? Math.PI / 2 : 0, m, { insStart: -h + 0.9 });
}

function post(m) {
  const { box, cyl, mesh, sphere, hoop, ao, pointLight, THREE } = L;
  const r8 = Math.PI / 8;
  cyl(1.95, 0.5, m.conc, 0, 0, 0, { seg: 8, ry: r8, rTop: 1.85, dirtH: 0.5 });
  cyl(1.88, 0.12, m.haz, 0, 0.32, 0, { seg: 8, ry: r8, dirt: 0 });
  cyl(1.5, 4.0, m.armor, 0, 0.5, 0, { seg: 8, ry: r8, rTop: 1.15, dirtH: 1.7 });
  // vertical armour ribs on the diagonals
  for (let k = 0; k < 4; k++) {
    const ang = Math.PI / 4 + k * Math.PI / 2;
    const rg = new THREE.BoxGeometry(0.3, 3.7, 0.28); rg.translate(0, 3.7 / 2, 0);
    const rib = mesh(rg, m.armorD, Math.cos(ang) * 1.4, 0.5, Math.sin(ang) * 1.4, { dirtH: 1.4 });
    rib.rotation.y = -ang; rib.rotation.z = 0.08;
  }
  // angry eye-slits on the face toward the camera
  for (const s of [-1, 1]) {
    const eg = new THREE.BoxGeometry(0.62, 0.2, 0.08); const e = mesh(eg, m.dark, s * 0.36, 3.25, 1.22, { dirt: 0, cast: false });
    e.rotation.z = s * 0.38; e.rotation.x = -0.09;
    const gg = new THREE.BoxGeometry(0.5, 0.075, 0.06); const gm = mesh(gg, m.glowHot, s * 0.36, 3.25, 1.27, { dirt: 0, cast: false });
    gm.rotation.z = s * 0.38; gm.rotation.x = -0.09;
  }
  // a vertical vent stack under the eyes
  for (let k = 0; k < 3; k++) { box(0.5, 0.07, 0.06, m.glow, 0, 1.4 + k * 0.34, 1.36 - k * 0.028, { cast: false }); box(0.62, 0.17, 0.05, m.dark, 0, 1.35 + k * 0.34, 1.34 - k * 0.028, { dirt: 0, cast: false }); }
  // collar and horns
  cyl(1.3, 0.26, m.cap, 0, 4.5, 0, { seg: 8, ry: r8, dirt: 0 });
  for (let k = 0; k < 4; k++) {
    const ang = Math.PI / 4 + k * Math.PI / 2;
    const cg = new THREE.ConeGeometry(0.17, 1.25, 7); cg.translate(0, 0.62, 0); cg.rotateZ(-0.8);
    const h = mesh(cg, m.steel, Math.cos(ang) * 0.95, 4.68, Math.sin(ang) * 0.95, { dirt: 0 });
    h.rotation.y = -ang;
  }
  // tesla coil: insulator stack, toroid electrode, hot core
  for (let k = 0; k < 5; k++) { cyl(0.42 - k * 0.03, 0.11, m.ins, 0, 4.76 + k * 0.2, 0, { seg: 20, dirt: 0 }); cyl(0.26, 0.09, m.ins, 0, 4.87 + k * 0.2, 0, { seg: 16, dirt: 0 }); }
  hoop(0.66, 0.24, m.steel, 0, 5.98, 0);
  hoop(0.66, 0.035, L.M.emit(TEAM, 1.6), 0, 6.21, 0, { cast: false });
  sphere(0.17, L.M.emit(TEAM, 2.0), 0, 6.06, 0, { cast: false });
  for (let k = 0; k < 6; k++) { const an = k * Math.PI / 3; box(0.12, 0.1, 0.12, m.dark, Math.cos(an) * 0.66, 6.18, Math.sin(an) * 0.66, { dirt: 0 }); }
  pointLight(TEAM, 3, 0, 6.6, 0.6, 3);
  pointLight(TEAM, 2.5, 0, 3.2, 2.2, 2.2);
  ao(0, 0, 3.8, 3.8, 0.45);
}

export default function (lib) {
  L = lib; TEAM = L.TEAM; PIECE = L.PIECE; TILE_NS = L.TILE_NS;
  L.seed(777);
  const m = mats();
  if (PIECE === 'post' || PIECE === 'all') post(m);
  else if (PIECE in YAW) L.asOccluder(() => post(m));      // the post always stands at a corner/end/junction: hide arm parts inside it
  for (const d of ['n', 'e', 's', 'w']) if (PIECE === d || PIECE === 'all') arm(d, m);
  if (PIECE === 'hub-ew' || PIECE === 'hub-ns') hub(PIECE, m);
}

// ---------- spark frames ----------
function toWorld(dir, x, y, z) {
  const c = Math.cos(YAW[dir]), s = Math.sin(YAW[dir]);
  return [x * c + z * s, y, -x * s + z * c];
}
export function sparks(f, grp) {
  const { arc, spark, R, seed } = L;
  const H = { post: 11, n: 23, e: 37, s: 53, w: 71, 'hub-ew': 83, 'hub-ns': 97 }[PIECE] || 5;
  seed(1000 + H * 97 + f * 131);
  if (PIECE === 'post') {
    const nb = 3 + (f % 2);
    for (let k = 0; k < nb; k++) {
      const ang = R(0, Math.PI * 2), r0 = 0.66, r1 = R(1.4, 2.3);
      const a = [Math.cos(ang) * r0, 6.02 + R(-0.1, 0.15), Math.sin(ang) * r0];
      const b = [Math.cos(ang + R(-0.4, 0.4)) * r1, R(5.4, 7.3), Math.sin(ang + R(-0.4, 0.4)) * r1];
      arc(grp, a, b, { r: R(0.05, 0.075), branches: 2 });
    }
    // one bolt grounding into a horn tip
    const hk = Math.floor(R(0, 4)), ang = Math.PI / 4 + hk * Math.PI / 2;
    const tip = [Math.cos(ang) * 1.85, 5.55, Math.sin(ang) * 1.85];
    arc(grp, [Math.cos(ang) * 0.7, 5.95, Math.sin(ang) * 0.7], tip, { r: 0.06, branches: 1 });
    spark(grp, tip, 0.13);
    return;
  }
  let dir, a, b;
  if (PIECE in YAW) { dir = PIECE; a = ARM0 + 0.6; b = armLen(dir) - 0.35; }
  else if (PIECE === 'hub-ew' || PIECE === 'hub-ns') {
    dir = PIECE === 'hub-ew' ? 'e' : 'n'; const h = PIECE === 'hub-ns' ? 0.75 * TILE_NS / 5 : 0.75;
    if (f % 2) return;
    const p0 = toWorld(dir, -h + 0.15, RAIL_Y, 0), p1 = toWorld(dir, h - 0.15, RAIL_Y, 0), mid = toWorld(dir, 0, RAIL_Y + R(0.2, 0.45), R(-0.2, 0.2));
    arc(grp, p0, mid, { r: 0.05, branches: 1 }); arc(grp, mid, p1, { r: 0.05, branches: 0 });
    return;
  } else return;
  const nb = 2 + (f % 3 === 0 ? 1 : 0);
  for (let k = 0; k < nb; k++) {
    const x0 = R(a, b - 0.8), x1 = Math.min(b, x0 + R(0.6, 1.5));
    const p0 = toWorld(dir, x0, RAIL_Y, 0), p1 = toWorld(dir, x1, RAIL_Y, 0);
    const mid = toWorld(dir, (x0 + x1) / 2, RAIL_Y + R(0.25, 0.6), R(-0.25, 0.25));
    arc(grp, p0, mid, { r: 0.055, branches: 1 }); arc(grp, mid, p1, { r: 0.055, branches: 1 });
    spark(grp, p0, 0.09); spark(grp, p1, 0.09);
  }
  // a crackle jumping from a spike tip to the rail
  const xs = R(a, b), s = R(0, 1) < 0.5 ? -1 : 1;
  const tip = toWorld(dir, xs, YC + 0.55, s * (HT + 0.42)), rail = toWorld(dir, xs + R(-0.3, 0.3), RAIL_Y, 0);
  arc(grp, tip, rail, { r: 0.03, branches: 0 });
  spark(grp, tip, 0.07);
}

// shared with the gate scenes
export function kit(lib) {
  L = lib; TEAM = L.TEAM; TILE_NS = L.TILE_NS;
  return { mats, segment, WH, HB, HT, Y0, YC, RAIL_Y };
}

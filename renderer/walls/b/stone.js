// Stone walls: big, thick, white stone with lights along the top. Three styles to choose from (?style=):
//   a  Citadel: a battered wall of huge ashlar blocks laid in courses (each a shade off-white, deep joints), a
//      projecting cap course with bronze lanterns along its crown and a thin team light-line under the cap;
//      the post is a square bastion of the same blocks with a lamp at each corner and the team beacon.
//   b  Battlements: a grey battered plinth, a tall white curtain wall with coursed joints and a team band,
//      merlons along both edges of the wall-walk, a lantern on every other merlon; the post is a round tower
//      with a crenellated crown, lanterns and the team beacon.
//   c  Monolith: massive smooth white slabs on a dark footing, each a battered block with deep joints between,
//      a glowing team light-channel down the middle of the top and white floodlight pods at the joints; the post
//      is a fluted octagonal pillar with a team light-ring and floods on its cap.
// Same pieces and framing as wall.js: piece = post | n | e | s | w | hub-ew | hub-ns | all. One tile = 10 units.
let L, TEAM, PIECE, TILE_NS, STYLE;
const ARM0 = 0.55;
const YAW = { e: 0, n: Math.PI / 2, w: Math.PI, s: -Math.PI / 2 };
function armLen(dir) { return (dir === 'n' || dir === 's') ? TILE_NS : 5.0; }

function mats() {
  const { M } = L;
  const stones = (STYLE === 'b' ? ['#d9d3c6', '#cfc8ba', '#e0dbcf', '#d3ccbf'] : ['#ebe7de', '#e2ddd2', '#f1eee7', '#d9d3c6', '#e6e1d6']).map((h) => M.rough(h));
  return {
    stones, white: M.rough(STYLE === 'b' ? '#d8d2c5' : '#ece8df'), cap: M.rough(STYLE === 'e' ? '#303236' : '#f3f0ea'),
    wire: M.plain('#8a8f94', 0.35, 0.85), ins: M.plain('#e8e4d8', 0.3, 0.05), mortar: M.rough('#8f897d'), grey: M.rough('#8a857c'),
    footing: M.rough(STYLE === 'e' ? '#2a2b2d' : '#6d6860'), smooth: M.rough(STYLE === 'e' ? '#3b3d41' : '#ebe7de'), slab: M.paint('#ebe9e3', { rivets: false, panelW: 512, panelH: 512, rough: 0.6, metal: 0.05 }),
    dark: M.dark, bronze: M.plain('#5a4630', 0.5, 0.6), steel: M.steel, team: M.paint(TEAM, { rivets: false }),
    glow: M.emit(TEAM, 2.6), warm: M.emit('#ffd9a0', 2.6), flood: M.emit('#fff4e0', 3.0), iron: M.plain('#2c2e30', 0.55, 0.7),
  };
}
const pick = (m) => m.stones[Math.floor(L.rnd() * m.stones.length)];

// The wall's cross-section and height, per style.
const DIM = { a: { Y0: 0.25, H: 3.6, HB: 2.0, HT: 1.55 }, d: { Y0: 0.25, H: 3.6, HB: 2.0, HT: 1.55 }, e: { Y0: 0.25, H: 3.6, HB: 2.0, HT: 1.55 }, b: { Y0: 0.75, H: 3.0, HB: 1.5, HT: 1.45 }, c: { Y0: 0.3, H: 3.8, HB: 2.05, HT: 1.45 } };

/** A lantern on the wall top at local (x, y, z): a bronze housing with warm glass and a little roof. */
function lantern(g, m, x, y, z) {
  const { box } = L;
  box(0.32, 0.12, 0.32, m.bronze, x, y, z, { parent: g, dirt: 0 });
  box(0.22, 0.26, 0.22, m.warm, x, y + 0.12, z, { parent: g, dirt: 0, cast: false });
  box(0.34, 0.06, 0.34, m.bronze, x, y + 0.38, z, { parent: g, dirt: 0 });
}

/** A concertina coil of razor wire along local x from a to b at height y (radius r). */
function coil(g, m, a, b, y, z, r = 0.3) {
  const { THREE, mesh } = L;
  const turns = Math.max(3, Math.round((b - a) / 0.28)), pts = [];
  for (let i = 0; i <= turns * 12; i++) { const t = i / (turns * 12), ang = t * turns * Math.PI * 2; pts.push(new THREE.Vector3(a + (b - a) * t, y + Math.sin(ang) * r, z + Math.cos(ang) * r)); }
  const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), turns * 12, 0.022, 4, false);
  mesh(geo, m.wire, 0, 0, 0, { parent: g, dirt: 0 });
}
/** A Y-post on the wall top at local x: two arms out to the sides with insulators, strands strung between posts. */
function wirePost(g, m, x, y) {
  const { box, cyl, beam } = L;
  box(0.12, 0.7, 0.12, m.iron, x, y, 0, { parent: g, dirt: 0 });
  for (const s of [-1, 1]) {
    beam([x, y + 0.65, 0], [x, y + 1.15, s * 0.55], 0.07, 0.07, m.iron, { parent: g });
    cyl(0.07, 0.16, m.ins, x, y + 1.12, s * 0.55, { parent: g, seg: 10, dirt: 0 });
  }
}
// where the arcs play, per piece (see sparks)
const WIRE = { y: 0, runs: [] }, TOWER_TOP = { y: 0, e: 0, k: 1 };

/** A straight run of wall from x=a to x=b along local +x, turned by yaw. */
function segment(a, b, yaw, m, o = {}) {
  const { box, mesh, group, ao, pointLight, THREE } = L;
  const S = STYLE, d = DIM[S], l = b - a, cx = (a + b) / 2;
  const g = group(0, 0, 0, yaw);
  const top = d.Y0 + d.H;
  if (S === 'a') {
    box(l, d.Y0, 2 * d.HB + 0.5, m.footing, cx, 0, 0, { parent: g, dirtH: d.Y0 });
    const N = 4, CH = d.H / N;
    // the core behind the blocks shows as deep joints
    box(l, d.H, 2 * d.HT - 0.2, m.mortar, cx, d.Y0, 0, { parent: g, dirt: 0.3 });
    for (let k = 0; k < N; k++) {
      const hw = d.HB - (d.HB - d.HT) * (k / (N - 1)), y = d.Y0 + k * CH;
      let x = a - (k % 2 ? 0.9 : 0) - L.rnd() * 0.4;
      while (x < b) {
        const len = 1.5 + L.rnd() * 0.9, x0 = Math.max(a, x), x1 = Math.min(b, x + len);
        if (x1 - x0 > 0.15) box(x1 - x0 - 0.08, CH - 0.08, 2 * hw, pick(m), (x0 + x1) / 2, y + 0.04, 0, { parent: g, dirtH: k === 0 ? 1.2 : 0.4 });
        x += len;
      }
    }
    box(l, 0.34, 2 * d.HT + 0.36, m.cap, cx, top, 0, { parent: g, dirt: 0.15 });
    for (const s of [-1, 1]) box(l, 0.06, 0.05, m.glow, cx, top - 0.12, s * (d.HT + 0.03), { parent: g, cast: false, dirt: 0 });
    const n = Math.max(1, Math.round(l / 1.65));
    for (let k = 0; k < n; k++) lantern(g, m, a + (k + 0.5) * (l / n), top + 0.34, 0);
  } else if (S === 'e') {
    // Citadel, dark: charcoal stone, smooth, with razor wire and live strands along the top
    box(l, d.Y0, 2 * d.HB + 0.5, m.footing, cx, 0, 0, { parent: g, dirtH: d.Y0 });
    const sh = new THREE.Shape(); sh.moveTo(-d.HB, 0); sh.lineTo(d.HB, 0); sh.lineTo(d.HT, d.H); sh.lineTo(-d.HT, d.H); sh.closePath();
    const geo = new THREE.ExtrudeGeometry(sh, { depth: l, bevelEnabled: false }); geo.rotateY(Math.PI / 2); geo.translate(a, d.Y0, 0);
    mesh(geo, m.smooth, 0, 0, 0, { parent: g, dirtH: 1.2 });
    box(l, 0.34, 2 * d.HT + 0.36, m.cap, cx, top, 0, { parent: g, dirt: 0.15 });
    for (const s of [-1, 1]) box(l, 0.06, 0.05, m.glow, cx, top - 0.12, s * (d.HT + 0.03), { parent: g, cast: false, dirt: 0 });
    const n = Math.max(1, Math.round(l / 1.65)), y0 = top + 0.34;
    for (let k = 0; k <= n; k++) if (k > 0 || a > 0.6) wirePost(g, m, a + k * (l / n) - (k === n ? 0.1 : 0), y0);
    coil(g, m, a, b, y0 + 0.45, 0, 0.32);
    for (const s of [-1, 1]) L.hcyl(0.018, l, m.wire, cx, y0 + 1.16, s * 0.55, { parent: g, axis: 'x', dirt: 0, seg: 6 });
    WIRE.y = y0; WIRE.runs.push({ a, b, yaw });
  } else if (S === 'd') {
    // Citadel, smooth: one clean battered face of white stone each side, no courses
    box(l, d.Y0, 2 * d.HB + 0.5, m.footing, cx, 0, 0, { parent: g, dirtH: d.Y0 });
    const sh = new THREE.Shape(); sh.moveTo(-d.HB, 0); sh.lineTo(d.HB, 0); sh.lineTo(d.HT, d.H); sh.lineTo(-d.HT, d.H); sh.closePath();
    const geo = new THREE.ExtrudeGeometry(sh, { depth: l, bevelEnabled: false }); geo.rotateY(Math.PI / 2); geo.translate(a, d.Y0, 0);
    mesh(geo, m.smooth, 0, 0, 0, { parent: g, dirtH: 1.2 });
    box(l, 0.34, 2 * d.HT + 0.36, m.cap, cx, top, 0, { parent: g, dirt: 0.15 });
    for (const s of [-1, 1]) box(l, 0.06, 0.05, m.glow, cx, top - 0.12, s * (d.HT + 0.03), { parent: g, cast: false, dirt: 0 });
    const n = Math.max(1, Math.round(l / 1.65));
    for (let k = 0; k < n; k++) lantern(g, m, a + (k + 0.5) * (l / n), top + 0.34, 0);
  } else if (S === 'b') {
    // plinth with a sloped top, the curtain wall, a team band, coursed joints
    const ps = new THREE.Shape(); ps.moveTo(-2.15, 0); ps.lineTo(2.15, 0); ps.lineTo(2.0, d.Y0 * 0.6); ps.lineTo(1.6, d.Y0); ps.lineTo(-1.6, d.Y0); ps.lineTo(-2.0, d.Y0 * 0.6); ps.closePath();
    const pg = new THREE.ExtrudeGeometry(ps, { depth: l, bevelEnabled: false }); pg.rotateY(Math.PI / 2); pg.translate(a, 0, 0);
    mesh(pg, m.grey, 0, 0, 0, { parent: g, dirtH: d.Y0 });
    box(l, d.H, 2 * d.HB, m.white, cx, d.Y0, 0, { parent: g, dirtH: 1.2 });
    for (const s of [-1, 1]) {
      for (let k = 1; k < 4; k++) box(l, 0.05, 0.03, m.mortar, cx, d.Y0 + k * 0.75, s * (d.HB + 0.005), { parent: g, dirt: 0, cast: false });
      for (let k = 0; k < 4; k++) for (let x = a + (k % 2 ? 0.6 : 1.4); x < b - 0.1; x += 1.6) box(0.04, 0.72, 0.03, m.mortar, x, d.Y0 + k * 0.75 + 0.02, s * (d.HB + 0.005), { parent: g, dirt: 0, cast: false });
      box(l, 0.3, 0.04, m.team, cx, d.Y0 + 1.7, s * (d.HB + 0.01), { parent: g, dirt: 0 });
    }
    box(l, 0.18, 2 * d.HB + 0.2, m.cap, cx, top, 0, { parent: g, dirt: 0.1 });
    // merlons along both edges, a lantern on every other one
    const n = Math.max(2, Math.round(l / 1.25));
    for (let k = 0; k < n; k++) {
      const x = a + (k + 0.5) * (l / n);
      for (const s of [-1, 1]) {
        box(0.78, 0.75, 0.5, pick(m), x, top + 0.18, s * (d.HB - 0.15), { parent: g, dirt: 0.2 });
        if ((k + (s > 0 ? 1 : 0)) % 2 === 0) lantern(g, m, x, top + 0.93, s * (d.HB - 0.15));
      }
    }
  } else {
    box(l, d.Y0, 2 * d.HB + 0.4, m.footing, cx, 0, 0, { parent: g, dirtH: d.Y0 });
    const sh = new THREE.Shape(); sh.moveTo(-d.HB, 0); sh.lineTo(d.HB, 0); sh.lineTo(d.HT, d.H); sh.lineTo(-d.HT, d.H); sh.closePath();
    // the slabs, a deep joint between each
    const joints = [];
    for (let x = a + 1.25; x < b - 0.3; x += 2.5) joints.push(x);
    const edges = [a, ...joints, b];
    for (let k = 0; k < edges.length - 1; k++) {
      const x0 = edges[k] + (k ? 0.07 : 0), x1 = edges[k + 1] - (k < edges.length - 2 ? 0.07 : 0);
      const geo = new THREE.ExtrudeGeometry(sh, { depth: x1 - x0, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2 });
      geo.rotateY(Math.PI / 2); geo.translate(x0, d.Y0, 0);
      mesh(geo, m.slab, 0, 0, 0, { parent: g, dirtH: 1.4 });
    }
    box(l, d.H - 0.1, 2 * d.HT - 0.3, m.mortar, cx, d.Y0, 0, { parent: g, dirt: 0 });   // the dark inside showing in the joints
    // the light-channel down the top, and floods at the joints
    box(l, 0.08, 0.7, m.dark, cx, top + 0.005, 0, { parent: g, dirt: 0, cast: false });
    box(l, 0.06, 0.26, m.glow, cx, top + 0.02, 0, { parent: g, dirt: 0, cast: false });
    for (const x of joints) for (const s of [-1, 1]) {
      box(0.3, 0.16, 0.24, m.iron, x, top, s * (d.HT - 0.25), { parent: g, dirt: 0 });
      box(0.22, 0.08, 0.05, m.flood, x, top + 0.05, s * (d.HT - 0.12), { parent: g, dirt: 0, cast: false });
    }
  }
  // night: the lights along the top wash the white stone
  if (o.light !== false) pointLight(S === 'c' ? TEAM : '#ffd9a0', S === 'c' ? 1.4 : 1.8, Math.cos(yaw) * cx, top + 0.8, -Math.sin(yaw) * cx, 3.4);
  const wx = Math.cos(yaw) * cx, wz = -Math.sin(yaw) * cx, horiz = Math.abs(Math.cos(yaw)) > 0.5, w = 2 * d.HB + 0.6;
  ao(wx, wz, horiz ? l : w, horiz ? w : l, 0.4);
}

function arm(dir, m) { segment(ARM0, armLen(dir), YAW[dir], m); }
function hub(kind, m) {
  const h = kind === 'hub-ns' ? 2.0 * TILE_NS / 5 : 2.0;
  segment(-h, h, kind === 'hub-ns' ? Math.PI / 2 : 0, m, { light: false });
}

/** The post: the style's tower, standing at corners, ends and junctions. Scaled by `k` for a gate's towers. */
export function tower(x, z, m, k = 1) {
  const { box, cyl, sphere, group, ao, pointLight } = L;
  const S = STYLE, d = DIM[S];
  const g = group(x, 0, z, 0);
  const P = { parent: g };
  let topY;
  if (S === 'a') {
    const N = 5, CH = 0.95 * k, w0 = 4.3 * k;
    box(w0 + 0.4, 0.25, w0 + 0.4, m.footing, 0, 0, 0, { ...P, dirtH: 0.25 });
    for (let c = 0; c < N; c++) {
      const w = w0 - c * 0.14 * k, y = 0.25 + c * CH;
      // two blocks a course, the joint turned each course
      for (const s of [-1, 1]) {
        if (c % 2) box(w, CH - 0.07, w / 2 - 0.05, pick(m), 0, y + 0.035, s * w / 4, { ...P, dirtH: 0.5 });
        else box(w / 2 - 0.05, CH - 0.07, w, pick(m), s * w / 4, y + 0.035, 0, { ...P, dirtH: 0.5 });
      }
    }
    topY = 0.25 + N * CH;
    const wt = w0 - (N - 1) * 0.14 * k;
    box(wt + 0.45, 0.4, wt + 0.45, m.cap, 0, topY, 0, { ...P, dirt: 0.1 });
    for (const s of [-1, 1]) box(wt + 0.47, 0.07, 0.05, m.glow, 0, topY + 0.12, s * (wt / 2 + 0.24), { ...P, cast: false, dirt: 0 });
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) lantern(g, m, sx * (wt / 2 - 0.15), topY + 0.4, sz * (wt / 2 - 0.15));
    topY += 0.4;
  } else if (S === 'e') {
    const w0 = 4.3 * k, H = 4.75 * k, wt = w0 - 0.56 * k;
    box(w0 + 0.4, 0.25, w0 + 0.4, m.footing, 0, 0, 0, { ...P, dirtH: 0.25 });
    cyl(w0 / Math.SQRT2, H, m.smooth, 0, 0.25, 0, { ...P, seg: 4, ry: Math.PI / 4, rTop: wt / Math.SQRT2, dirtH: 1.4 });
    topY = 0.25 + H;
    box(wt + 0.45, 0.4, wt + 0.45, m.cap, 0, topY, 0, { ...P, dirt: 0.1 });
    for (const s of [-1, 1]) box(wt + 0.47, 0.07, 0.05, m.glow, 0, topY + 0.12, s * (wt / 2 + 0.24), { ...P, cast: false, dirt: 0 });
    // a coil of wire round the top's edge, insulator posts at the corners
    const e = wt / 2 - 0.2;
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      box(0.14, 1.0, 0.14, m.iron, sx * e, topY + 0.4, sz * e, { ...P, dirt: 0 });
      cyl(0.08, 0.2, m.ins, sx * e, topY + 1.4, sz * e, { ...P, seg: 10, dirt: 0 });
    }
    for (const [ry, off] of [[0, -e], [0, e], [Math.PI / 2, -e], [Math.PI / 2, e]]) {
      const gg = L.group(0, 0, 0, ry, g);
      coil(gg, m, -e, e, topY + 0.75, off, 0.26);
    }
    TOWER_TOP.y = topY + 0.4; TOWER_TOP.e = e; TOWER_TOP.k = k;
    topY += 0.4;
  } else if (S === 'd') {
    const w0 = 4.3 * k, H = 4.75 * k, wt = w0 - 0.56 * k;
    box(w0 + 0.4, 0.25, w0 + 0.4, m.footing, 0, 0, 0, { ...P, dirtH: 0.25 });
    // a square battered tower: a four-sided frustum turned square to the walls
    cyl(w0 / Math.SQRT2, H, m.smooth, 0, 0.25, 0, { ...P, seg: 4, ry: Math.PI / 4, rTop: wt / Math.SQRT2, dirtH: 1.4 });
    topY = 0.25 + H;
    box(wt + 0.45, 0.4, wt + 0.45, m.cap, 0, topY, 0, { ...P, dirt: 0.1 });
    for (const s of [-1, 1]) box(wt + 0.47, 0.07, 0.05, m.glow, 0, topY + 0.12, s * (wt / 2 + 0.24), { ...P, cast: false, dirt: 0 });
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) lantern(g, m, sx * (wt / 2 - 0.15), topY + 0.4, sz * (wt / 2 - 0.15));
    topY += 0.4;
  } else if (S === 'b') {
    const r = 2.25 * k;
    cyl(r + 0.45, 0.75, m.grey, 0, 0, 0, { ...P, seg: 32, rTop: r + 0.1, dirtH: 0.75 });
    cyl(r, 3.9 * k, m.white, 0, 0.75, 0, { ...P, seg: 32, dirtH: 1.4 });
    for (let c = 1; c < 5; c++) cyl(r + 0.01, 0.05, m.mortar, 0, 0.75 + c * 0.78 * k, 0, { ...P, seg: 32, dirt: 0, cast: false });
    cyl(r + 0.02, 0.32, m.team, 0, 0.75 + 2.1 * k, 0, { ...P, seg: 32, dirt: 0 });
    topY = 0.75 + 3.9 * k;
    cyl(r + 0.25, 0.22, m.cap, 0, topY, 0, { ...P, seg: 32, dirt: 0.1 });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2, gm = group(Math.cos(a) * (r + 0.05), topY + 0.22, Math.sin(a) * (r + 0.05), -a, g);
      box(0.5, 0.8, 0.95, pick(m), 0, 0, 0, { parent: gm, dirt: 0.2 });
      if (i % 2 === 0) lantern(gm, m, 0, 0.8, 0);
    }
    topY += 0.22;
  } else {
    box(4.6 * k, 0.3, 4.6 * k, m.footing, 0, 0, 0, { ...P, dirtH: 0.3 });
    cyl(2.25 * k, 4.6 * k, m.slab, 0, 0.3, 0, { ...P, seg: 8, ry: Math.PI / 8, rTop: 1.85 * k, dirtH: 1.5 });
    for (let i = 0; i < 8; i++) {
      const a = Math.PI / 8 + (i * Math.PI) / 4, gm = group(0, 0, 0, -a, g);
      box(0.08, 4.3 * k, 0.06, m.mortar, 2.06 * k, 0.45, 0, { parent: gm, dirt: 0, cast: false });
    }
    topY = 0.3 + 4.6 * k;
    cyl(1.95 * k, 0.12, m.glow, 0, topY - 0.55, 0, { ...P, seg: 8, ry: Math.PI / 8, cast: false, dirt: 0 });
    cyl(2.0 * k, 0.3, m.slab, 0, topY, 0, { ...P, seg: 8, ry: Math.PI / 8, dirt: 0 });
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2, gm = group(Math.cos(a) * 1.3 * k, topY + 0.3, Math.sin(a) * 1.3 * k, -a, g);
      box(0.4, 0.22, 0.32, m.iron, 0, 0, 0, { parent: gm, dirt: 0 });
      box(0.06, 0.14, 0.26, m.flood, 0.2, 0.04, 0, { parent: gm, dirt: 0, cast: false });
    }
    topY += 0.3;
  }
  // the team beacon on top
  cyl(0.18, 0.5, m.steel, 0, topY, 0, { ...P, seg: 10, dirt: 0 });
  sphere(0.24, L.M.emit(TEAM, 3.5), 0, topY + 0.65, 0, { ...P, cast: false });
  pointLight(TEAM, 3, x, topY + 1.0, z + 0.6, 3.5);
  pointLight('#ffd9a0', 2.2, x, topY + 0.4, z + 2.3 + (S === 'b' ? 0.6 : 0), 3.2);
  ao(x, z, 4.8 * k, 4.8 * k, 0.45);
  return topY;
}

export default function (lib) {
  L = lib; TEAM = L.TEAM; PIECE = L.PIECE; TILE_NS = L.TILE_NS;
  STYLE = new URLSearchParams(location.search).get('style') || 'a';
  L.seed(911);
  const m = mats();
  if (PIECE === 'post' || PIECE === 'all') tower(0, 0, m);
  else if (PIECE in YAW) L.asOccluder(() => tower(0, 0, m));
  for (const d of ['n', 'e', 's', 'w']) if (PIECE === d || PIECE === 'all') arm(d, m);
  if (PIECE === 'hub-ew' || PIECE === 'hub-ns') hub(PIECE, m);
}

// shared with the gate scene
export function stoneKit(lib) {
  L = lib; TEAM = L.TEAM; TILE_NS = L.TILE_NS; STYLE = new URLSearchParams(location.search).get('style') || 'a';
  return { mats, segment, tower, lantern, coil, DIM, STYLE };
}


// ---------- spark frames (style e): arcs crackling along the razor wire and jumping to the insulators ----------
function toWorld(yaw, x, y, z) { const c = Math.cos(yaw), s = Math.sin(yaw); return [x * c + z * s, y, -x * s + z * c]; }
export function sparks(f, grp) {
  if (STYLE !== 'e') return;
  const { arc, spark, R, seed } = L;
  seed(3100 + (PIECE || '').length * 97 + f * 131);
  if (PIECE === 'post' && TOWER_TOP.y) {
    const e = TOWER_TOP.e, y = TOWER_TOP.y + 1.0, c = [[-e, -e], [e, -e], [e, e], [-e, e]];
    const k = f % 4, a = c[k], b = c[(k + 1) % 4];
    arc(grp, [a[0], y, a[1]], [b[0], y + R(-0.2, 0.3), b[1]], { r: 0.06, branches: 2 });
    spark(grp, [a[0], y, a[1]], 0.12); spark(grp, [b[0], y, b[1]], 0.1);
    if (f % 2) { const d = c[(k + 2) % 4]; arc(grp, [b[0], y, b[1]], [d[0], y + 0.2, d[1]], { r: 0.045, branches: 1 }); }
    return;
  }
  for (const run of WIRE.runs) {
    const y = WIRE.y + 0.45, nb = 1 + (f % 2);
    for (let k = 0; k < nb; k++) {
      const x0 = R(run.a + 0.2, run.b - 0.9), x1 = Math.min(run.b - 0.1, x0 + R(0.5, 1.3));
      const p0 = toWorld(run.yaw, x0, y + R(-0.25, 0.25), R(-0.3, 0.3)), p1 = toWorld(run.yaw, x1, y + R(-0.25, 0.25), R(-0.3, 0.3));
      arc(grp, p0, p1, { r: 0.05, rough: 0.4, branches: 2 });
      spark(grp, p0, 0.08);
    }
    // a strand flashing over to an insulator
    const xs = R(run.a + 0.3, run.b - 0.3), s = R(0, 1) < 0.5 ? -1 : 1;
    arc(grp, toWorld(run.yaw, xs, y + 0.2, s * 0.25), toWorld(run.yaw, xs + R(-0.4, 0.4), WIRE.y + 1.16, s * 0.55), { r: 0.035, branches: 0 });
  }
}

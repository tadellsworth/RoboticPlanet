// Rail track tiles, 256 px, straight down (image top = -z), 10 world units per tile, lit like the buildings.
//   ?piece = straight | curve | tee | cross | end | level | barrier-up | barrier-down | lights-on
// Rails at 33 % and 67 % across (z = ±1.7 for an east-west track); ballast bed 70 % wide.
export const config = { pad: false, size: 512 };
const G = 1.7, BED = 3.5, SL = 0.625;               // half gauge, half bed width, sleeper spacing
const BALLAST_Y = 0.32, SLEEPER_H = 0.13, RAIL_H = 0.3;

export default function (L) {
  const { box, cyl, mesh, group, M, THREE, R } = L;
  const piece = new URLSearchParams(location.search).get('piece') || 'straight';
  L.seed(4040);
  const W = 10, cam = new THREE.OrthographicCamera(-W / 2, W / 2, W / 2, -W / 2, 0.1, 100);
  cam.position.set(0, 40, 0); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  L.useCamera(cam);

  // ---------- materials
  const gravelTex = L.canvasTex(512, (g, n) => {
    g.fillStyle = '#4f4841'; g.fillRect(0, 0, n, n);
    const cols = ['#6f675e', '#5d554d', '#7b7268', '#4d4640', '#6a5c50', '#746a60', '#847b70', '#463f39'];
    for (let i = 0; i < 5200; i++) {
      const x = R(0, n), y = R(0, n), rx = R(3.5, 8), ry = rx * R(0.6, 1), a = R(0, 3.14), c = cols[Math.floor(R(0, cols.length))];
      for (const ox of [-n, 0, n]) for (const oy of [-n, 0, n]) {
        const X = x + ox, Y = y + oy; if (X < -20 || X > n + 20 || Y < -20 || Y > n + 20) continue;
        g.fillStyle = 'rgba(25,20,16,0.55)'; g.beginPath(); g.ellipse(X + 2, Y + 2, rx, ry, a, 0, 7); g.fill();
        g.fillStyle = c; g.beginPath(); g.ellipse(X, Y, rx, ry, a, 0, 7); g.fill();
        g.fillStyle = 'rgba(255,248,236,0.13)'; g.beginPath(); g.ellipse(X - rx * 0.3, Y - ry * 0.3, rx * 0.45, ry * 0.4, a, 0, 7); g.fill();
      }
    }
  });
  const gravel = new THREE.MeshStandardMaterial({ map: gravelTex, roughness: 0.95, metalness: 0, vertexColors: true });
  const timberTex = L.canvasTex(256, (g, n) => {
    g.fillStyle = '#4b3b2d'; g.fillRect(0, 0, n, n);
    for (let i = 0; i < 260; i++) { g.strokeStyle = `rgba(${R(0, 1) < 0.5 ? '20,14,9' : '120,96,70'},${R(0.1, 0.35)})`; g.lineWidth = R(1, 2.5); const y = R(0, n); g.beginPath(); g.moveTo(0, y); g.lineTo(n, y + R(-4, 4)); g.stroke(); }
    L.blotches(g, n, 30, 6, 30, 0.2);
  });
  const timber = new THREE.MeshStandardMaterial({ map: timberTex, roughness: 0.9, metalness: 0, vertexColors: true });
  const railBody = M.plain('#5c4535', 0.7, 0.45), railTop = M.plain('#cfd3d6', 0.28, 0.95), plate = M.plain('#2a2725', 0.6, 0.6);
  const conc = M.rough('#9a948a');

  // ---------- path helpers: a path is a function t (0..1) -> {x, z, tx, tz}, with arc length 'len'
  const straightPath = (x0, z0, x1, z1) => { const len = Math.hypot(x1 - x0, z1 - z0); return { len, at: t => ({ x: x0 + (x1 - x0) * t, z: z0 + (z1 - z0) * t, tx: (x1 - x0) / len, tz: (z1 - z0) / len }) }; };
  // quarter circle around (cx, cz) radius r from angle a0 to a1 (radians, a measured from +x toward +z)
  const arcPath = (cx, cz, r, a0, a1) => ({ len: Math.abs(a1 - a0) * r, at: t => { const a = a0 + (a1 - a0) * t, s = Math.sign(a1 - a0); return { x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r, tx: -Math.sin(a) * s, tz: Math.cos(a) * s }; } });
  // left normal of a direction (tx, tz) in the x-z plane (pointing to -z for an eastward track = north)
  const nrm = (p) => ({ nx: p.tz, nz: -p.tx });

  // extrude a cross-section profile [[d, y], ...] (d = offset to the left/north of travel) along a path; UVs from world x,z
  function strip(path, profile, mat, o = {}) {
    const n = Math.max(2, Math.ceil(path.len / (o.step || 0.25)) + 1), P = profile.length;
    const pos = [], uv = [], idx = [];
    for (let i = 0; i < n; i++) {
      const p = path.at(i / (n - 1)), { nx, nz } = nrm(p);
      for (const [d, y] of profile) { const x = p.x + nx * d, z = p.z + nz * d; pos.push(x, y, z); uv.push(x / (o.uvP || 5), -z / (o.uvP || 5)); }
    }
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < P - 1; j++) { const a = i * P + j, b = a + 1, c = a + P, d = c + 1; idx.push(a, b, c, b, d, c); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeVertexNormals();
    return mesh(geo, mat, 0, 0, 0, { dirt: o.dirt ?? 0, cast: o.cast ?? true });
  }
  const bedProfile = (hw) => [[hw, 0], [hw - 0.75, BALLAST_Y * 0.9], [hw - 1.1, BALLAST_Y], [-(hw - 1.1), BALLAST_Y], [-(hw - 0.75), BALLAST_Y * 0.9], [-hw, 0]];
  function bed(path, hw = BED) { strip(path, bedProfile(hw), gravel, { step: 0.2 }); }
  function sleepers(path, o = {}) {
    const n = Math.round(path.len / SL), half = o.half ?? 2.65, skip = o.skip || (() => false);
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n, p = path.at(t); if (skip(p)) continue;
      const g = group(p.x, BALLAST_Y - 0.02, p.z, -Math.atan2(p.tz, p.tx));
      box(0.27, SLEEPER_H, half * 2, timber, 0, 0, 0, { parent: g, dirt: 0, tint: R(0.8, 1.1) });
      for (const s of (o.rails || [-G, G])) box(0.42, 0.035, 0.36, plate, 0, SLEEPER_H, s, { parent: g, dirt: 0 });
    }
  }
  const RY = BALLAST_Y - 0.02 + SLEEPER_H + 0.03;
  function rail(path, d, o = {}) {
    const w = o.w ?? 1, y0 = RY;
    strip(path, [[d + 0.15, y0], [d + 0.15, y0 + 0.05], [d + 0.045, y0 + 0.06], [d + 0.045, y0 + RAIL_H - 0.08], [d + 0.08, y0 + RAIL_H - 0.07], [d + 0.08 * w, y0 + RAIL_H],
                 [d - 0.08 * w, y0 + RAIL_H], [d - 0.08, y0 + RAIL_H - 0.07], [d - 0.045, y0 + RAIL_H - 0.08], [d - 0.045, y0 + 0.06], [d - 0.15, y0 + 0.05], [d - 0.15, y0]], railBody, { step: 0.12, uvP: 2 });
    strip(path, [[d + 0.065 * w, y0 + RAIL_H + 0.004], [d - 0.065 * w, y0 + RAIL_H + 0.004]], railTop, { step: 0.12, uvP: 2, cast: false });
  }
  const track = (path, o = {}) => { if (o.bed !== false) bed(path); sleepers(path, o); for (const d of (o.rails || [-G, G])) rail(path, d); };

  const EW = straightPath(-5, 0, 5, 0), NS = straightPath(0, -5, 0, 5);
  const CURVE = arcPath(-5, 5, 5, -Math.PI / 2, 0);            // in through the left edge, out through the bottom edge

  if (piece === 'straight') track(EW);
  else if (piece === 'curve') { bed(CURVE); sleepers(CURVE); rail(CURVE, -G); rail(CURVE, G); }
  else if (piece === 'tee') {
    bed(EW); bed(CURVE);
    // turnout: long timbers under both routes near the points, then each route's own sleepers
    const inTurnout = (p) => p.x < -1.2;
    sleepers(EW, { half: 2.65, skip: p => inTurnout(p) });
    for (let x = -4.69; x < -1.2; x += SL) {
      const zMax = Math.min(4.6, 5 - Math.sqrt(Math.max(0, 25 - (x + 5) ** 2)) + 2.65);
      const g = group(x, BALLAST_Y - 0.02, 0, 0);
      box(0.27, SLEEPER_H, 2.65 + zMax, timber, 0, 0, (zMax - 2.65) / 2, { parent: g, dirt: 0, tint: R(0.8, 1.1) });
    }
    sleepers(CURVE, { skip: p => p.x < -1.2 || (p.z < 2.7 && p.x < 1.5) });
    rail(EW, -G); rail(EW, G);
    // diverging route: switch blades taper in from the stock rails at the points
    const blade = { len: CURVE.len, at: t => CURVE.at(t) };
    rail({ len: CURVE.len * 0.92, at: t => CURVE.at(0.08 + 0.92 * t) }, -G);
    rail({ len: CURVE.len * 0.92, at: t => CURVE.at(0.08 + 0.92 * t) }, G);
    rail({ len: CURVE.len * 0.08, at: t => CURVE.at(0.08 * t) }, -G, { w: 0.55 });
    rail({ len: CURVE.len * 0.08, at: t => CURVE.at(0.08 * t) }, G, { w: 0.55 });
    // check rails beside the frog and a small lever box at the points
    box(0.7, 0.45, 0.5, M.paint('#5a6066', { rivets: false }), -4.0, BALLAST_Y - 0.1, -3.05, { dirt: 0.4 });
    box(0.5, 0.06, 0.32, M.hazard, -4.0, BALLAST_Y + 0.36, -3.05, { dirt: 0 });
    const lev = mesh(new THREE.BoxGeometry(0.07, 0.7, 0.07).translate(0, 0.35, 0), M.paint('#b8322a', { rivets: false }), -4.0, BALLAST_Y + 0.35, -3.05, { dirt: 0 });
    lev.rotation.x = 0.6;
    for (const x of [-4.3, -3.7]) box(0.08, 0.06, 1.4, M.steel, x, BALLAST_Y + 0.05, -2.3, { dirt: 0 });   // point rodding
  } else if (piece === 'cross') {
    bed(EW); bed(NS);
    const centre = (p) => Math.abs(p.x) < 2.3 && Math.abs(p.z) < 2.3;
    sleepers(EW, { skip: p => Math.abs(p.x) < 2.3 }); sleepers(NS, { skip: p => Math.abs(p.z) < 2.3 });
    // diamond: a square of long timbers under the crossing
    for (let x = -2.0; x <= 2.01; x += 0.5) box(0.3, SLEEPER_H, 5.3, timber, x, BALLAST_Y - 0.02, 0, { dirt: 0, tint: R(0.8, 1.1) });
    const gap = 0.14;
    for (const d of [-G, G]) {
      for (const [a, b] of [[-5, -G - gap], [-G + gap, G - gap], [G + gap, 5]]) { rail(straightPath(a, 0, b, 0), d); rail(straightPath(0, a, 0, b), -d); }
    }
  } else if (piece === 'end') {
    const P = straightPath(-5, 0, 3.6, 0);
    bed(straightPath(-5, 0, 4.4, 0));
    box(0.9, BALLAST_Y * 0.95, 7.0 - 2.2, gravel, 4.45, 0, 0, { dirt: 0 });
    sleepers(straightPath(-5, 0, 3.75, 0)); rail(P, -G); rail(P, G);
    // buffer stop: steel frame, striped buffer beam with two buffers
    const stripe = new THREE.MeshStandardMaterial({ map: L.canvasTex(256, (g, n) => { for (let k = 0; k < 8; k++) { g.fillStyle = k % 2 ? '#e8e2d6' : '#b8282a'; g.fillRect(k * n / 8, 0, n / 8, n); } L.speckle(g, n, 800, 0.2); }), roughness: 0.6, metalness: 0.1, vertexColors: true });
    for (const s of [-G, G]) { L.beam([2.9, RY + 0.2, s], [3.9, RY + 0.95, s], 0.22, 0.22, M.paint('#3f4449', { rivets: false })); L.beam([4.2, BALLAST_Y, s], [3.9, RY + 0.95, s], 0.2, 0.2, M.paint('#3f4449', { rivets: false })); }
    const bb = new THREE.BoxGeometry(0.42, 0.5, 4.6); bb.rotateX(0); const bm = mesh(bb, stripe, 3.75, RY + 0.95, 0, { dirt: 0 });
    bm.geometry.attributes.uv.array.forEach((v, i, a) => { a[i] = v * 1.0; });
    for (const s of [-G, G]) { L.hcyl(0.17, 0.4, M.steel, 3.45, RY + 0.95, s, { axis: 'x' }); L.hcyl(0.26, 0.06, M.dark, 3.24, RY + 0.95, s, { axis: 'x' }); }
  } else if (piece === 'level') {
    // concrete road 56 % wide running top to bottom; the track crosses it; rubber panels between the rails
    const RW = 2.8;
    bed(straightPath(-5, 0, -RW, 0)); bed(straightPath(RW, 0, 5, 0));
    box(RW * 2, 0.42, 10, conc, 0, 0, 0, { dirt: 0 });
    for (const s of [-1, 1]) box(0.14, 0.44, 10, M.rough('#7c766c'), s * (RW - 0.07), 0, 0, { dirt: 0 });
    sleepers(EW, { skip: p => Math.abs(p.x) < RW });
    const rub = M.ribbed('#2c2d2f', { period: 10 });
    for (const [a, b] of [[-2.2, -G - 0.1], [-G + 0.1, G - 0.1], [G + 0.1, 2.2]]) box(RW * 2 - 0.2, 0.08, b - a, rub, 0, 0.42, (a + b) / 2, { dirt: 0 });
    rail(EW, -G); rail(EW, G);
    const white = M.plain('#e8e6e0', 0.6, 0);
    for (const s of [-1, 1]) box(RW * 2 - 0.5, 0.02, 0.28, white, 0, 0.42, s * 3.9, { dirt: 0, cast: false });
    for (let z = -4.6; z < 5; z += 1.6) if (Math.abs(z) > 2.6) box(0.14, 0.02, 0.7, M.plain('#d9b43a', 0.6, 0), 0, 0.42, z + 0.35, { dirt: 0, cast: false });
  } else {
    // level-crossing overlays: barrier posts at the road edges (NW and SE), arms up or down, or only the lit lamps
    const RW = 2.8, down = piece === 'barrier-down', lit = piece === 'lights-on';
    const stripe = new THREE.MeshStandardMaterial({ map: L.canvasTex(256, (g, n) => { for (let k = 0; k < 10; k++) { g.fillStyle = k % 2 ? '#ece6da' : '#c42a2a'; g.fillRect(k * n / 10, 0, n / 10, n); } }), roughness: 0.55, metalness: 0.1 });
    const lamps = [];
    for (const [px, pz, dir] of [[-RW - 0.45, -2.85, 1], [RW + 0.45, 2.85, -1]]) {
      cyl(0.38, 0.12, conc, px, 0.42, pz, { seg: 16, dirt: 0 });
      cyl(0.11, 1.5, M.paint('#d8d4cc', { rivets: false }), px, 0.54, pz, { seg: 12, dirt: 0 });
      box(0.62, 0.2, 0.2, M.dark, px, 1.62, pz, { dirt: 0 });
      for (const s of [-1, 1]) { lamps.push(cyl(0.12, 0.06, M.plain('#4a1010', 0.35), px + s * 0.22, 1.82, pz, { seg: 16, dirt: 0 })); }
      box(0.42, 0.42, 0.42, M.paint('#3f4449', { rivets: false }), px, 0.54, pz - dir * 0.2, { dirt: 0 });
      const arm = group(px, 1.05, pz, 0);
      const len = RW + 0.45;
      const ag = new THREE.BoxGeometry(len, 0.14, 0.12); ag.translate(dir * len / 2, 0, 0);
      const a = mesh(ag, stripe, 0, 0, 0, { parent: arm, dirt: 0 });
      if (!down) arm.rotation.z = dir * Math.PI / 2 * 0.97;      // raised: the arm stands up, seen from above as a stub
      box(0.12, 0.14, 0.7, M.dark, -dir * 0.3, -0.07, 0, { parent: arm, dirt: 0 });   // counterweight
    }
    // shadows of the posts and arms on the road
    const g = new THREE.PlaneGeometry(10, 10); g.rotateX(-Math.PI / 2);
    const sm = new THREE.Mesh(g, new THREE.ShadowMaterial({ opacity: 0.45, color: 0x120c08 })); sm.position.y = 0.425; sm.receiveShadow = true; L.getRoot().add(sm);
    if (lit) {
      L.getRoot().traverse(o => { if (o.isMesh) o.visible = false; });
      for (const m of lamps) { m.visible = true; m.material = M.emit('#ff2a1e', 4); }
    }
  }
}

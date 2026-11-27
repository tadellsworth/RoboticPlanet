// Space expansion concepts: the shared kit. Every ship, pad, turret and module scene builds with these helpers, in
// the Cargo Plane's armour language (b/plane.js: faceted gunmetal, thin seams, team glow strips, a sensor visor, no
// canopy glass: nobody rides in them).
// Views (`view=`):
//   top   the game's aircraft view: orthographic, straight down, nose toward +x, `W` world units across, no ground
//   hero  the buildings' 57 degree camera, framed on the model, a shadow catcher under it (the deck it hovers over)
// Units are building units: the 10-unit pad is one tile.
// Plumes are not modelled: each nozzle places marks (`pN_a` nozzle centre, `pN_b` the plume's end, `pN_r` the rim)
// that post/space_post.py paints the exhaust from, so the game can draw the same flame in code.
export const P = new URLSearchParams(location.search);
export const num = (k, d) => (P.has(k) ? +P.get(k) : d);
export const PLUME = { core: '#fff4e0', mid: '#ffc47a', edge: '#ff7a3a' };

export function space(L, o = {}) {
  const { THREE, M, mesh, box, cyl, sphere, TEAM } = L;
  const view = P.get('view') || o.view || 'top';
  const root = L.getRoot();
  const G = L.group(0, 0, 0, 0);
  const O = (x = {}) => ({ parent: G, ...x });
  L.seed(o.seed || 411);
  if (view === 'top') {
    const W = o.W || 20, cam = new THREE.OrthographicCamera(-W / 2, W / 2, W / 2, -W / 2, 0.1, 400);
    cam.position.set(0, 200, 0); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    L.useCamera(cam);
    L.getScene().traverse((q) => { if (q.isDirectionalLight) { q.intensity *= q.castShadow ? 0.6 : 0.6; const sc = q.shadow && q.shadow.camera; if (sc) { const R0 = W * 0.75; sc.left = -R0; sc.right = R0; sc.top = R0; sc.bottom = -R0; sc.far = 400; q.position.multiplyScalar(4); sc.updateProjectionMatrix(); } } if (q.isHemisphereLight) q.intensity *= 0.7; });
  } else if (view === 'hero') {
    L.frameCompoundOpts(o.hero || { half: 8, width: 0.8, cy: 0.55 });
    L.getScene().traverse((q) => { if (q.isDirectionalLight && q.castShadow) { const sc = q.shadow.camera, R0 = (o.hero ? o.hero.half : 8) * 2.2; sc.left = -R0; sc.right = R0; sc.top = R0; sc.bottom = -R0; sc.far = 200; q.position.multiplyScalar(2.5); sc.updateProjectionMatrix(); } });
    if (o.catcher !== false) {
      const g = new THREE.PlaneGeometry(400, 400); g.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(g, new THREE.ShadowMaterial({ opacity: 0.45 })); m.receiveShadow = true; m.userData.decal = true; root.add(m);
    }
  }

  // ---- materials: the Cargo Plane's gunmetal, seams and steel; Accord white for the neutral Pathfinder-era hulls
  const mat = {
    armor: M.paint('#33393f'), top: M.paint('#434a52'), roof: M.paint('#4d545c', { rivets: false }), under: M.paint('#2c3136'),
    dark: M.plain('#1a1c1f', 0.7, 0.3), black: M.plain('#08090a', 0.8), seam: M.plain('#101214', 0.8),
    steel: M.plain('#626970', 0.3, 0.85), rail: M.plain('#23272b', 0.4, 0.7), hood: M.plain('#121518', 0.3, 0.6),
    accord: M.paint('#b9b6ad', { rivets: false }), accordD: M.paint('#8c8a84'), burnt: M.plain('#17130f', 0.95, 0.1),
    glow: M.emit(TEAM, 1.1), team: M.emit(TEAM, 1.6), hot: M.emit(PLUME.mid, 3.2), cool: M.plain('#2b2622', 0.5, 0.6),
    navR: M.emit('#ff3a2a', 3.2), navG: M.emit('#3aff6a', 3.2), white: M.emit('#ffffff', 3.0), amber: M.emit('#ffa632', 2.4),
    visor: M.emit(TEAM, 2.2), hazard: M.hazard,
  };
  const UV = 0.5;
  function facet(st, mats, op = {}) {
    const ring = (s) => { const y = s.y ?? 0, z = s.z ?? 0, w = s.w, h = s.h, b = s.b ?? h, t = s.t ?? w * 0.55, m = (s.m ?? 0.35) * h, bt = s.bt ?? w * 0.6, mb = -0.3 * b;
      return [[z + bt, y - b], [z + w, y + mb], [z + w, y + m], [z + t, y + h], [z - t, y + h], [z - w, y + m], [z - w, y + mb], [z - bt, y - b]]; };
    const mi = (e) => (e === 3 ? 0 : e === 2 || e === 4 ? 1 : 2);
    const Pp = [[], [], []], U = [[], [], []], rings = st.map(ring);
    const per = rings.map((r) => { const a = [0]; for (let j = 0; j < 8; j++) { const p = r[j], q = r[(j + 1) % 8]; a.push(a[j] + Math.hypot(q[0] - p[0], q[1] - p[1])); } return a; });
    const V = (i, j) => [st[i].x, rings[i][j % 8][1], rings[i][j % 8][0]];
    for (let i = 0; i < st.length - 1; i++) for (let j = 0; j < 8; j++) {
      const g = mi(j), a = V(i, j), a1 = V(i, j + 1), b = V(i + 1, j), b1 = V(i + 1, j + 1);
      const ua = [st[i].x * UV, per[i][j] * UV], ua1 = [st[i].x * UV, per[i][j + 1] * UV], ub = [st[i + 1].x * UV, per[i + 1][j] * UV], ub1 = [st[i + 1].x * UV, per[i + 1][j + 1] * UV];
      Pp[g].push(...a, ...a1, ...b, ...a1, ...b1, ...b); U[g].push(...ua, ...ua1, ...ub, ...ua1, ...ub1, ...ub);
    }
    const cap = (i, back) => { const s = st[i], c = [s.x, s.y ?? 0, s.z ?? 0];
      for (let j = 0; j < 8; j++) { const p = V(i, j), q = V(i, j + 1); if (back) Pp[2].push(...c, ...p, ...q); else Pp[2].push(...c, ...q, ...p);
        for (const v of back ? [c, p, q] : [c, q, p]) U[2].push(v[2] * UV, v[1] * UV); } };
    if (op.capFront !== false) cap(0, false);
    if (op.capBack !== false) cap(st.length - 1, true);
    const g = new THREE.BufferGeometry(), pos = [], uv = []; let start = 0;
    for (let k = 0; k < 3; k++) { pos.push(...Pp[k]); uv.push(...U[k]); const n = Pp[k].length / 3; if (n) g.addGroup(start, n, k); start += n; }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
    return mesh(g, [mats[0], mats[1] ?? mats[0], mats[2] ?? mats[1] ?? mats[0]], 0, 0, 0, O({ dirt: 0, ...op }));
  }
  const oct = (r) => ({ w: r, h: r, t: r * 0.41, m: 0.41, bt: r * 0.41 });
  // a body along x through [x, r] stations (an octagonal tube), or [x, w, h, b] for flattened ones
  const tube = (pts, y, z, mats, op = {}) => facet(pts.map((p) => (p.length === 2 ? { x: p[0], ...oct(p[1]), y, z } : { x: p[0], w: p[1], h: p[2], b: p[3] ?? p[2], t: p[1] * (op.t ?? 0.6), m: op.m ?? 0.4, bt: p[1] * 0.5, y, z })), mats, op);
  const band = (x, len, r, y, z, m) => facet([{ x: x + len / 2, ...oct(r), y, z }, { x: x - len / 2, ...oct(r), y, z }], [m, m, m], { cast: false });
  function plate(pts, y, thick, m, op = {}) {
    const bev = Math.min(op.bevel ?? 0.03, thick / 3), sh = new THREE.Shape();
    pts.forEach(([x, z], i) => (i ? sh.lineTo(x, z) : sh.moveTo(x, z))); sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: Math.max(0.002, thick - 2 * bev), bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev, bevelOffset: -bev, bevelSegments: 1 });
    g.rotateX(Math.PI / 2); g.translate(0, -bev, 0);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * UV, uv.getY(i) * UV);
    return mesh(g, m, 0, y, 0, O({ dirt: 0, ...op }));
  }
  const rect = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  const strip = (x1, z1, x2, z2, w, y, h, m, op = {}) => { const dx = x2 - x1, dz = z2 - z1;
    return box(Math.hypot(dx, dz), h, w, m, (x1 + x2) / 2, y, (z1 + z2) / 2, O({ ry: -Math.atan2(dz, dx), dirt: 0, cast: false, ...op })); };
  const B = (w, h, d, m, x, y, z, op = {}) => box(w, h, d, m, x, y, z, O({ dirt: 0, ...op }));
  const C = (r, h, m, x, y, z, op = {}) => cyl(r, h, m, x, y, z, O({ dirt: 0, seg: 24, ...op }));
  const S = (r, m, x, y, z, op = {}) => sphere(r, m, x, y, z, O({ cast: false, ...op }));
  const beam = (a, b, w, h, m, op = {}) => L.beam(a, b, w, h, m, O(op));
  // a horizontal cylinder along an axis ('x' or 'z'), centred at (x, y, z)
  function hc(r, len, m, x, y, z, axis = 'x', op = {}) {
    const g = new THREE.CylinderGeometry(op.r2 ?? r, r, len, op.seg ?? 24, 1, op.open ?? false);
    if (axis === 'x') g.rotateZ(-Math.PI / 2); else g.rotateX(Math.PI / 2);
    return mesh(g, m, x, y, z, O({ dirt: 0, ...op }));
  }
  function grime(pts, y, amt = 1, sd = 1) {
    const t = L.canvasTex(256, (g, n) => {
      let s = sd * 9301 + 49297; const r = () => (s = (s * 9301 + 49297) % 233280) / 233280;
      for (let i = 0; i < 26 * amt; i++) { const cx = r() * n, cy = r() * n, rr = 8 + r() * 30; const gr = g.createRadialGradient(cx, cy, 0, cx, cy, rr); const c = r() < 0.5 ? '122,84,50' : '40,36,34';
        gr.addColorStop(0, `rgba(${c},${0.12 + r() * 0.18})`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.fillRect(cx - rr, cy - rr, rr * 2, rr * 2); }
      for (let i = 0; i < 900 * amt; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '20,18,16' : '150,140,120'},${r() * 0.35})`; g.fillRect(r() * n, r() * n, 1 + r() * 2, 1 + r() * 2); }
    });
    const sh = new THREE.Shape(); pts.forEach(([x, z], i) => (i ? sh.lineTo(x, -z) : sh.moveTo(x, -z))); sh.closePath();
    const geo = new THREE.ShapeGeometry(sh); geo.rotateX(-Math.PI / 2);
    const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 5, uv.getY(i) / 5);
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.9, depthWrite: false }));
    m.position.y = y; m.userData.decal = true; m.receiveShadow = true; G.add(m); return m;
  }
  // a rocket nozzle pointing along d ([0,-1,0] down, [-1,0,0] aft): a dark bell, a hot throat ring when firing.
  // thr: 0 off .. 1 full (the plume's length in nozzle radii is set by post). Marks the plume for post.
  let np = 0;
  function nozzle(x, y, z, r, d = [0, -1, 0], thr = 1, len = 0.9) {
    const g = new THREE.CylinderGeometry(r, r * 0.55, r * len * 1.4, 18, 1, true);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3(...d));
    const m = mesh(g, mat.rail, x + d[0] * r * len * 0.7, y + d[1] * r * len * 0.7, z + d[2] * r * len * 0.7, O({ dirt: 0 }));
    m.quaternion.copy(q); m.material.side = THREE.DoubleSide;
    const e = r * len * 1.38;
    const inner = mesh(new THREE.CircleGeometry(r * 0.92, 18), thr > 0 ? M.emit(PLUME.mid, 1.5 + 2.5 * thr) : mat.cool, x + d[0] * e, y + d[1] * e, z + d[2] * e, O({ dirt: 0, cast: false }));
    inner.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...d)));
    const k = np++;
    if (thr > 0) {
      L.mark(`p${k}_a`, x + d[0] * e, y + d[1] * e, z + d[2] * e, G);
      const pl = r * (4 + 7 * thr);
      L.mark(`p${k}_b`, x + d[0] * (e + pl), y + d[1] * (e + pl), z + d[2] * (e + pl), G);
      const side = Math.abs(d[1]) > 0.5 ? [r, 0, 0] : [0, 0, r];
      L.mark(`p${k}_r`, x + d[0] * e + side[0], y + d[1] * e + side[1], z + d[2] * e + side[2], G);
    }
    return m;
  }
  // a landing leg at (x, z) under a hull bottom at yb: ext 0 stowed flush .. 1 down to the ground (y = 0)
  function leg(x, z, yb, ext, sx = 0, sz = 0) {
    const g0 = K.gy || 0, yf = yb - (yb - g0 - 0.12) * ext, ox = sx * 0.5 * ext, oz = sz * 0.5 * ext;
    beam([x, yb, z], [x + ox, yf + 0.25, z + oz], 0.22, 0.22, mat.steel);
    beam([x + ox * 0.3, yb - 0.1, z + oz * 0.3], [x + ox, yf + 0.3, z + oz], 0.12, 0.12, mat.rail);
    C(0.38, 0.14, mat.dark, x + ox, yf, z + oz, { seg: 8 });
  }
  const lights = (pts) => { for (const [x, y, z, m, r] of pts) S(r ?? 0.13, m, x, y, z); };
  // a landing lamp pointing down: an emissive lens, and a mark for the light pool post draws on the ground below
  let nl = 0;
  function landLamp(x, y, z, r = 0.12) { S(r, mat.white, x, y, z); L.mark(`l${nl}_a`, x, y, z, G); L.mark(`l${nl++}_g`, x, 0, z, G); }
  // a muzzle: a mark at the barrel's tip, and its direction (a second mark a unit along it)
  let nm = 0;
  function muzzle(x, y, z, d) { L.mark(`m${nm}_a`, x, y, z, G); L.mark(`m${nm++}_b`, x + d[0] * 8, y + d[1] * 8, z + d[2] * 8, G); }
  // keep reflections low on flat tops seen from above, as the aircraft do
  function settle() {
    const seen = new Set();
    root.traverse((q) => { if (!q.isMesh) return; for (const m of [].concat(q.material)) if (!seen.has(m) && m.envMapIntensity !== undefined) { seen.add(m); m.envMapIntensity *= m.emissiveIntensity > 0 ? 1 : 0.4; } });
  }
  // a simple Accord robot standing (for dropship loads): a body, a head and a team visor
  function bot(x, y, z, s = 1, ry = 0) {
    const g = L.group(x, y, z, ry, G); const o2 = { parent: g, dirt: 0 };
    box(0.7 * s, 0.6 * s, 0.9 * s, mat.armor, 0, 0, 0, o2); box(0.5 * s, 0.3 * s, 0.5 * s, mat.top, 0, 0.6 * s, 0, o2);
    box(0.06 * s, 0.08 * s, 0.36 * s, mat.visor, 0.26 * s, 0.72 * s, 0, { ...o2, cast: false });
    box(0.5 * s, 0.25 * s, 0.18 * s, mat.dark, 0.05 * s, 0.25 * s, 0.5 * s, o2); box(0.5 * s, 0.25 * s, 0.18 * s, mat.dark, 0.05 * s, 0.25 * s, -0.5 * s, o2);
    return g;
  }
  const K = { L, THREE, M, G, O, view, mat, facet, oct, tube, band, plate, rect, strip, B, C, S, hc, beam, grime, nozzle, leg, lights, landLamp, muzzle, settle, bot, TEAM };
  return K;
}

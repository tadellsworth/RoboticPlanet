// Shared parts for the military family (Bunker, Mortar Pit): sloped polygon walls, wall-face frames, sandbags.
// Polygons are lists of [x, z] points going round the shape.

export function chamferRect(hx, hz, c) {
  return [[-hx + c, hz], [hx - c, hz], [hx, hz - c], [hx, -hz + c], [hx - c, -hz], [-hx + c, -hz], [-hx, -hz + c], [-hx, hz - c]];
}

// move every edge of a convex polygon inward by s (negative s grows it)
export function offsetPoly(pts, s) {
  const n = pts.length, cx = pts.reduce((a, p) => a + p[0], 0) / n, cz = pts.reduce((a, p) => a + p[1], 0) / n;
  const lines = pts.map((p, i) => {
    const q = pts[(i + 1) % n], dx = q[0] - p[0], dz = q[1] - p[1], l = Math.hypot(dx, dz);
    let nx = -dz / l, nz = dx / l;
    if ((cx - p[0]) * nx + (cz - p[1]) * nz < 0) { nx = -nx; nz = -nz; }   // point the normal inward
    return { p: [p[0] + nx * s, p[1] + nz * s], d: [dx / l, dz / l] };
  });
  return lines.map((L1, i) => {
    const L0 = lines[(i - 1 + n) % n];
    const den = L0.d[0] * L1.d[1] - L0.d[1] * L1.d[0];
    const t = ((L1.p[0] - L0.p[0]) * L1.d[1] - (L1.p[1] - L0.p[1]) * L1.d[0]) / den;
    return [L0.p[0] + L0.d[0] * t, L0.p[1] + L0.d[1] * t];
  });
}

// sloped wall shell between two polygons (bottom pts0 at y0, top pts1 at y1) with a flat top cap
export function frustum(L, pts0, pts1, y0, y1, mat, o = {}) {
  const { THREE, mesh } = L, T = 2, pos = [], uv = [];
  const n = pts0.length; let run = 0;
  for (let i = 0; i < n; i++) {
    const a0 = pts0[i], b0 = pts0[(i + 1) % n], a1 = pts1[i], b1 = pts1[(i + 1) % n];
    const len = Math.hypot(b0[0] - a0[0], b0[1] - a0[1]);
    const sl = Math.hypot(y1 - y0, Math.hypot((a0[0] + b0[0]) / 2 - (a1[0] + b1[0]) / 2, (a0[1] + b0[1]) / 2 - (a1[1] + b1[1]) / 2));
    const A0 = [a0[0], y0, a0[1]], B0 = [b0[0], y0, b0[1]], A1 = [a1[0], y1, a1[1]], B1 = [b1[0], y1, b1[1]];
    const u0 = run / T, u1 = (run + len) / T, v1 = sl / T; run += len;
    pos.push(...A0, ...B0, ...B1, ...A0, ...B1, ...A1);
    uv.push(u0, 0, u1, 0, u1, v1, u0, 0, u1, v1, u0, v1);
  }
  if (o.cap !== false) {
    const cx = pts1.reduce((a, p) => a + p[0], 0) / n, cz = pts1.reduce((a, p) => a + p[1], 0) / n;
    for (let i = 0; i < n; i++) {
      const a = pts1[i], b = pts1[(i + 1) % n];
      pos.push(cx, y1, cz, b[0], y1, b[1], a[0], y1, a[1]);
      uv.push(cx / T, cz / T, b[0] / T, b[1] / T, a[0] / T, a[1] / T);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  // make every triangle face outward / upward
  const P = geo.attributes.position;
  for (let i = 0; i < P.count; i += 3) {
    const ax = P.getX(i), ay = P.getY(i), az = P.getZ(i);
    const e1 = [P.getX(i + 1) - ax, P.getY(i + 1) - ay, P.getZ(i + 1) - az], e2 = [P.getX(i + 2) - ax, P.getY(i + 2) - ay, P.getZ(i + 2) - az];
    const nx = e1[1] * e2[2] - e1[2] * e2[1], ny = e1[2] * e2[0] - e1[0] * e2[2], nz = e1[0] * e2[1] - e1[1] * e2[0];
    const mx = (ax + P.getX(i + 1) + P.getX(i + 2)) / 3, mz = (az + P.getZ(i + 1) + P.getZ(i + 2)) / 3;
    const out = Math.abs(ny) > 0.5 * Math.hypot(nx, ny, nz) ? ny : nx * mx + nz * mz;
    if (out < 0) { // swap vertices 1 and 2
      for (const k of [0, 1, 2]) { const t = P.array[(i + 1) * 3 + k]; P.array[(i + 1) * 3 + k] = P.array[(i + 2) * 3 + k]; P.array[(i + 2) * 3 + k] = t; }
      const U = geo.attributes.uv.array; for (const k of [0, 1]) { const t = U[(i + 1) * 2 + k]; U[(i + 1) * 2 + k] = U[(i + 2) * 2 + k]; U[(i + 2) * 2 + k] = t; }
    }
  }
  geo.computeVertexNormals();
  return mesh(geo, mat, o.x || 0, 0, o.z || 0, o);
}

// flat painted band just inside a polygon outline (roof-edge stripes)
export function band(L, pts, w, y, mat, o = {}) {
  const { THREE, mesh } = L, inner = offsetPoly(pts, w), pos = [], uv = [], n = pts.length; let run = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n], c = inner[(i + 1) % n], d = inner[i], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const u0 = run / 2, u1 = (run + len) / 2, v = w / 2; run += len;
    pos.push(a[0], y, a[1], c[0], y, c[1], b[0], y, b[1], a[0], y, a[1], d[0], y, d[1], c[0], y, c[1]);
    uv.push(u0, 0, u1, v, u1, 0, u0, 0, u0, v, u1, v);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  const P = geo.attributes.position, U = geo.attributes.uv.array;
  for (let i = 0; i < P.count; i += 3) { // face up
    const e1x = P.getX(i + 1) - P.getX(i), e1z = P.getZ(i + 1) - P.getZ(i), e2x = P.getX(i + 2) - P.getX(i), e2z = P.getZ(i + 2) - P.getZ(i);
    if (e1z * e2x - e1x * e2z < 0) { for (const k of [0, 1, 2]) { const t = P.array[(i + 1) * 3 + k]; P.array[(i + 1) * 3 + k] = P.array[(i + 2) * 3 + k]; P.array[(i + 2) * 3 + k] = t; } for (const k of [0, 1]) { const t = U[(i + 1) * 2 + k]; U[(i + 1) * 2 + k] = U[(i + 2) * 2 + k]; U[(i + 2) * 2 + k] = t; } }
  }
  geo.computeVertexNormals();
  return mesh(geo, mat, o.x || 0, 0, o.z || 0, { dirt: 0, cast: false, ...o });
}

// a frame on wall face i: local x runs along the face, local y up the slope, local z out of the wall
export function faceFrame(L, pts0, pts1, y0, y1, i, o = {}) {
  const { THREE, group } = L, n = pts0.length, a = pts0[i], b = pts0[(i + 1) % n], a1 = pts1[i], b1 = pts1[(i + 1) % n];
  const mx = (a[0] + b[0]) / 2 + (o.x || 0), mz = (a[1] + b[1]) / 2 + (o.z || 0);
  const run = Math.hypot((a[0] + b[0]) / 2 - (a1[0] + b1[0]) / 2, (a[1] + b[1]) / 2 - (a1[1] + b1[1]) / 2);
  const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz);
  let nx = dz / l, nz = -dx / l; if (nx * ((a[0] + b[0]) / 2) + nz * ((a[1] + b[1]) / 2) < 0) { nx = -nx; nz = -nz; }
  const g = group(mx, y0, mz, Math.atan2(nx, nz)), t = new THREE.Group(); g.add(t);
  t.rotation.x = -Math.atan2(run, y1 - y0);
  return { g: t, w: l, wTop: Math.hypot(b1[0] - a1[0], b1[1] - a1[1]), slant: Math.hypot(run, y1 - y0) };
}

// ---- sandbags
let _bagGeo = null;
function bagGeo(THREE) {
  if (_bagGeo) return _bagGeo;
  const g = new THREE.SphereGeometry(1, 18, 10), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), f = v => Math.sign(v) * Math.pow(Math.abs(v), 0.55);
    // pillow: square-ish ends, flattened top and bottom, a slight sag in the middle of the top
    let X = f(x), Y = Math.sign(y) * Math.pow(Math.abs(y), 0.8), Z = f(z);
    if (Y > 0) Y *= 1 - 0.18 * (1 - Math.abs(X));
    p.setXYZ(i, X * 0.44, Y * 0.15, Z * 0.27);
  }
  g.computeVertexNormals(); return (_bagGeo = g);
}
export function sandbag(L, x, y, z, ry, o = {}) {
  const { THREE, mesh, M, rnd } = L;
  const mat = o.mat || M.rough('#9a8763');
  const m = mesh(bagGeo(THREE).clone(), mat, x, y + 0.165, z, { ry, rz: (rnd() - 0.5) * 0.08, rx: (rnd() - 0.5) * 0.06, dirt: 0.45, dirtH: 0.3, tint: 0.86 + rnd() * 0.24, parent: o.parent });
  const s = o.scale ?? 1; m.scale.set(s * (0.94 + rnd() * 0.12), s, s * (0.95 + rnd() * 0.1));
  return m;
}
// a run of bags along a circular arc (angles in radians, x = cos, z = sin), staggered layer by layer
export function bagArc(L, cx, cz, r, a0, a1, layers, o = {}) {
  const lay = o.lean ?? 0.04, y0 = o.y ?? 0, h = 0.31 * (o.scale ?? 1), len = 0.86 * (o.scale ?? 1);
  for (let k = 0; k < layers; k++) {
    const rr = r - k * lay, n = Math.max(1, Math.round(Math.abs(a1 - a0) * rr / len)), st = (a1 - a0) / n;
    const off = (k % 2) * 0.5;
    for (let i = 0; i < n + (k % 2 ? -1 : 0) + (o.closed ? 0 : 0); i++) {
      const a = a0 + (i + 0.5 + off) * st;
      if (o.skip && o.skip(a, k)) continue;
      sandbag(L, cx + Math.cos(a) * rr, y0 + k * h, cz + Math.sin(a) * rr, -a + Math.PI / 2, o);
    }
  }
}
// a straight run of bags from (x0,z0) to (x1,z1)
export function bagLine(L, x0, z0, x1, z1, layers, o = {}) {
  const len = Math.hypot(x1 - x0, z1 - z0), bl = 0.86 * (o.scale ?? 1), h = 0.31 * (o.scale ?? 1), n = Math.max(1, Math.round(len / bl));
  const ry = -Math.atan2(z1 - z0, x1 - x0);
  for (let k = 0; k < layers; k++) {
    const off = (k % 2) * 0.5, m = n - (k % 2);
    for (let i = 0; i < m; i++) { const t = (i + 0.5 + off) / n; sandbag(L, x0 + (x1 - x0) * t, (o.y ?? 0) + k * h, z0 + (z1 - z0) * t, ry, o); }
  }
}

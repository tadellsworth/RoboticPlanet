// Shared kit for the top-down robots: orthographic camera straight down (10 world units across the frame, image top
// = -z), helpers that take the old SVG sprite's pixel coordinates (1 px = 1/25.6 world unit) so each 3D model lines up
// with its reference image, animated tracks and tyres, and the brake / boost overlay passes.
export const K = 1 / 25.6;

export function kit(L, cx, cz) {
  const { THREE, M } = L;
  const p = new URLSearchParams(location.search), f = +(p.get('f') || 0), part = p.get('part') || 'robot';
  const W = 10, cam = new THREE.OrthographicCamera(-W / 2, W / 2, W / 2, -W / 2, 0.1, 100);
  cam.position.set(0, 40, 0); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  L.useCamera(cam);
  // straight-down sun lights every top face fully: tone it down so the robots keep the darker, grimier look of the sprites
  L.getScene().traverse(o => { if (o.isDirectionalLight) o.intensity *= o.castShadow ? 0.58 : 0.6; if (o.isHemisphereLight) o.intensity *= 0.7; });
  const G = L.group(-cx * K, 0, -cz * K);                    // the vehicle's bounding-box centre lands on the image centre
  const O = (o = {}) => Object.assign({ parent: G }, o);
  const k = K;
  const brakes = [];

  const rect = (x, y, w, h, y0, hgt, mat, o = {}) => L.box(w * k, hgt, h * k, mat, (x + w / 2) * k, y0, (y + h / 2) * k, O(o));
  // a closed outline drawn with px coordinates (pen.m / l / c / q), extruded upward with soft bevelled edges
  function shape(draw) {
    const s = new THREE.Shape(); const T = (x, y) => [x * k, -y * k];
    draw({ m: (x, y) => s.moveTo(...T(x, y)), l: (x, y) => s.lineTo(...T(x, y)),
      c: (a, b, c2, d, e, g) => s.bezierCurveTo(...T(a, b), ...T(c2, d), ...T(e, g)), q: (a, b, c2, d) => s.quadraticCurveTo(...T(a, b), ...T(c2, d)) });
    return s;
  }
  function rr(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    return shape(P => { P.m(x + r, y); P.l(x + w - r, y); P.q(x + w, y, x + w, y + r); P.l(x + w, y + h - r); P.q(x + w, y + h, x + w - r, y + h);
      P.l(x + r, y + h); P.q(x, y + h, x, y + h - r); P.l(x, y + r); P.q(x, y, x + r, y); });
  }
  function poly(pts) { return shape(P => pts.forEach(([x, y], i) => i ? P.l(x, y) : P.m(x, y))); }
  function ext(s, y0, hgt, mat, o = {}) {
    const bev = Math.min(o.bevel ?? 0.05, hgt / 3);
    const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.002, hgt - 2 * bev), bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev, bevelOffset: -bev, bevelSegments: 2, curveSegments: 18 });
    g.rotateX(-Math.PI / 2); g.translate(0, y0 + bev, 0);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 2, uv.getY(i) / 2);
    return L.mesh(g, mat, 0, 0, 0, O(Object.assign({ dirt: 0.25, dirtH: 1.2 }, o)));
  }
  const disc = (x, y, r, y0, hgt, mat, o = {}) => L.cyl(r * k, hgt, mat, x * k, y0, y * k, O(Object.assign({ seg: 32, dirt: 0 }, o)));
  // thin flat strip between two px points (for glowing lines and seams)
  const strip = (x1, y1, x2, y2, wpx, y0, hgt, mat, o = {}) => {
    const dx = (x2 - x1) * k, dz = (y2 - y1) * k, len = Math.hypot(dx, dz);
    return L.box(len, hgt, wpx * k, mat, (x1 + x2) / 2 * k, y0, (y1 + y2) / 2 * k, O(Object.assign({ ry: -Math.atan2(dz, dx), dirt: 0, cast: false }, o)));
  };
  // hazard stripes in any two colours (the SVG robots use amber and yellow variants)
  const hazCache = {};
  function hazard(a = '#f0a030', b = '#1b1a17') {
    const key = a + b; if (hazCache[key]) return hazCache[key];
    const t = L.canvasTex(256, (g, n) => {
      g.fillStyle = b; g.fillRect(0, 0, n, n); g.fillStyle = a; const s = n / 12;
      for (let x = -n; x < 2 * n; x += 2 * s) { g.beginPath(); g.moveTo(x, n); g.lineTo(x + s, n); g.lineTo(x + s + n, 0); g.lineTo(x + n, 0); g.closePath(); g.fill(); }
      for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(50,40,30,${L.rnd() * 0.3})`; g.fillRect(L.rnd() * n, L.rnd() * n, 3, 2); }
    });
    return (hazCache[key] = new THREE.MeshStandardMaterial({ map: t, roughness: 0.7, metalness: 0.2, vertexColors: true }));
  }

  // ---- track: a loop of links around a stadium path in the vertical plane; links advance a quarter pitch per frame
  function track(x0, x1, yc, wpx, r, o = {}) {
    const xa = x0 * k + r, xb = x1 * k - r, Ls = xb - xa, Lp = 2 * Ls + 2 * Math.PI * r;
    const N = Math.max(8, Math.round(Lp / (o.pitch ?? 0.33))), pitch = Lp / N, Wd = wpx * k, zc = yc * k, base = o.y0 ?? 0.05;
    const P = s => { s = ((s % Lp) + Lp) % Lp;
      if (s < Ls) return [xa + s, 2 * r];
      s -= Ls; if (s < Math.PI * r) { const a = s / r; return [xb + r * Math.sin(a), r + r * Math.cos(a)]; }
      s -= Math.PI * r; if (s < Ls) return [xb - s, 0];
      s -= Ls; const a = s / r; return [xa - r * Math.sin(a), r - r * Math.cos(a)]; };
    const linkM = o.link ?? M.plain('#24262a', 0.6, 0.5), cleatM = o.cleat ?? M.plain('#45484d', 0.55, 0.55);
    const tg = L.group(0, base, zc, 0, G);
    for (let i = 0; i < N; i++) {
      const s = (i + f / 4) * pitch, [x, y] = P(s), [xp, yp] = P(s + 0.01), [xm, ym] = P(s - 0.01);
      const g = new THREE.Group(); g.position.set(x, y, 0); g.rotation.z = Math.atan2(yp - ym, xp - xm); tg.add(g);
      L.box(pitch * 0.82, 0.07, Wd, linkM, 0, -0.035, 0, { parent: g, dirt: 0 });
      L.box(pitch * 0.36, 0.08, Wd * (o.cleatW ?? 0.9), cleatM, 0, 0.03, 0, { parent: g, dirt: 0 });
    }
    L.box(Ls, 2 * r - 0.12, Wd * 0.94, M.plain('#121315', 0.9), (xa + xb) / 2, 0.06, 0, { parent: tg, dirt: 0 });
    for (const xe of [xa, xb]) L.hcyl(r - 0.07, Wd * 0.94, M.plain('#2a2c30', 0.6, 0.5), xe, r, 0, { axis: 'z', parent: tg, dirt: 0 });
    return tg;
  }
  // ---- tyre: rubber drum with two staggered rows of tread blocks; rolls a quarter block per frame
  function tyre(cxp, czp, Rpx, Wpx, o = {}) {
    const R = Rpx * k, Wd = Wpx * k, NL = o.blocks ?? 16, pitch = Math.PI * 2 / NL;
    const w = L.group(cxp * k, R + (o.y0 ?? 0), czp * k, 0, G); w.rotation.z = -f * pitch / 4;
    const tgeo = new THREE.CylinderGeometry(R - 0.07, R - 0.07, Wd, 32, 1); tgeo.rotateX(Math.PI / 2);
    L.mesh(tgeo, M.plain('#141516', 0.95), 0, 0, 0, { parent: w, dirt: 0 });
    for (let i = 0; i < NL; i++) for (const half of [-1, 1]) {
      const b = new THREE.BoxGeometry(pitch * R * 0.55, 0.1, Wd * 0.46); b.translate(0, R - 0.06, half * Wd * 0.26);
      const m = L.mesh(b, M.plain('#4a4c50', 0.8), 0, 0, 0, { parent: w, dirt: 0 }); m.rotation.z = i * pitch + (half > 0 ? pitch / 2 : 0);
    }
    return w;
  }
  // ---- grime decal: rust-brown blotches, streaks and specks on a transparent plane laid over a top surface
  function grime(x, y, w, h, y0, amt = 1, seed = 1) {
    const t = L.canvasTex(256, (g, n) => {
      let sd = seed * 9301 + 49297; const r = () => (sd = (sd * 9301 + 49297) % 233280) / 233280;
      for (let i = 0; i < 26 * amt; i++) { const cx = r() * n, cy = r() * n, rr = 8 + r() * 30;
        const gr = g.createRadialGradient(cx, cy, 0, cx, cy, rr); const c = r() < 0.5 ? '122,84,50' : '70,52,36';
        gr.addColorStop(0, `rgba(${c},${0.25 + r() * 0.3})`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.fillRect(cx - rr, cy - rr, rr * 2, rr * 2); }
      for (let i = 0; i < 900 * amt; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '20,18,16' : '150,120,90'},${r() * 0.35})`; g.fillRect(r() * n, r() * n, 1 + r() * 2, 1 + r() * 2); }
    });
    const m = new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.9, depthWrite: false });
    const geo = new THREE.PlaneGeometry(w * k, h * k); geo.rotateX(-Math.PI / 2);
    const o = new THREE.Mesh(geo, m); o.position.set((x + w / 2) * k, y0 + 0.004, (y + h / 2) * k); o.userData.decal = true; o.receiveShadow = true; G.add(o); return o;
  }
  // a sensor lens: coloured emissive with a dimmer bloom, so it reads as a lens rather than a white-hot blob
  function eye(hex, k = 0.5, g = 0.16) { const m = M.emit(hex, k).clone(); m.color = new THREE.Color(hex).multiplyScalar(0.12); m.roughness = 0.7; m.envMapIntensity = 0.1; m.userData.glow = '#' + new THREE.Color(hex).multiplyScalar(g).getHexString(); return m; }
  // beam between two points given in the vehicle group's own space
  function beamL(a, b, w, h, mat, o = {}) { const m = L.beam(a, b, w, h, mat, O(o)); G.updateMatrixWorld(true); m.lookAt(G.localToWorld(new THREE.Vector3(...b))); return m; }
  // ---- brake lens (unlit in the robot; lit alone in the brake overlay)
  function brake(x, y, w, h, y0) { const m = rect(x, y, w, h, y0, 0.05, M.plain('#5a1414', 0.35), { dirt: 0, cast: false }); brakes.push(m); return m; }

  function finish() {
    // looking straight down, the studio environment reflects off every flat top: keep reflections low
    const seen = new Set();
    L.getRoot().traverse(o => { if (o.isMesh && !seen.has(o.material) && o.material.envMapIntensity !== undefined) { seen.add(o.material); o.material.envMapIntensity *= o.material.emissiveIntensity > 0 ? 1 : 0.35; } });
    if (part === 'robot') return;
    L.getRoot().traverse(o => { if (o.isMesh) o.visible = false; });
    if (part === 'brake') for (const m of brakes) { m.visible = true; m.material = M.emit('#ff2a1e', 4); }
  }
  return { f, part, G, O, k, rect, shape, rr, poly, ext, disc, strip, hazard, track, tyre, brake, grime, beamL, eye, finish };
}

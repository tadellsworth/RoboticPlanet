// The Murmur, design direction A, "Burrowers": tunnel-adapted, segmented native life of Ithaca I. Eyeless; armoured
// digging head plates; a round lamprey mouth that glows with stolen charge; soil caked in every crease.
// Creatures render top-down like the robots (orthographic straight down, 10 world units across the 256 frame, sun toned
// the way robkit.js does it), facing +x, centred, no ground, no shadow. The Burrow uses the building camera (512, no pad).
//   ?c=swarmer | drainer | brute | burrow
//   ?f=0..3        walking frame (Swarmer: leg ripple + body wave; Drainer: body wave; Brute: dig-stroke gait)
//   ?v=base | rust | white | bloom   regional variant (palette and build)
//   ?pose=feed     Drainer: anchored by its rear hooks, proboscis pushed out and glowing
//   ?hero=1        3/4 perspective presentation render with a ground patch (1536 -> 768)
//   tod=night|evening: the creatures' own bioluminescence (pores, sacs, Bloom spots) turns up.
const Q = new URLSearchParams(location.search);
const C = Q.get('c') || 'swarmer', HERO = Q.get('hero') === '1';
export const config = C === 'burrow' ? { pad: false } : { pad: false, size: HERO ? 1536 : 512 };

export default function (L) {
  const { THREE, M } = L;
  const f = +(Q.get('f') || 0), V = Q.get('v') || 'base', FEED = Q.get('pose') === 'feed';
  const NIGHT = L.TOD === 'night' || L.TOD === 'evening';
  const PH = f * Math.PI / 2;
  L.seed({ swarmer: 7101, drainer: 7202, brute: 7303, burrow: 7404 }[C] + { base: 0, rust: 11, white: 22, bloom: 33 }[V]);
  const rnd = L.rnd, RR = (a, b) => a + (b - a) * rnd();
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const col = (h) => new THREE.Color(h);
  const dim = (hex, k) => '#' + new THREE.Color(hex).multiplyScalar(k).getHexString();

  // ---- smooth pseudo-noise from random plane waves
  function makeNoise(seed) {
    let s = seed; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    const W = []; for (let i = 0; i < 16; i++) { const th = r() * 6.283, ph = Math.acos(2 * r() - 1); W.push([Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th), 1 + r() * 3.2, r() * 6.283]); }
    return (x, y, z) => { let v = 0, w = 0; for (const [a, b, c, fr, o] of W) { const amp = 1 / fr; v += Math.sin((a * x + b * y + c * z) * fr + o) * amp; w += amp; } return v / w; };
  }
  const nz = makeNoise(3301 + V.length * 17), nz2 = makeNoise(9917);

  // ---- palettes per region. Glow is amber (not a team colour); the Bloom variant glows violet as the lore says.
  const PAL = {
    base:  { plate: '#4e3e34', edge: '#a3876c', tuck: '#211814', dust: '#b59b7d', mem: '#a7806e', memD: '#5a3d35', leg: '#3d2d26', tip: '#cfb795', glow: '#ffa526', core: '#ffe6a0', pore: '#ff9c22' },
    rust:  { plate: '#8e4620', edge: '#dc8c4c', tuck: '#33140a', dust: '#c98f62', mem: '#7c4434', memD: '#3c1f18', leg: '#4f2516', tip: '#e2b27c', glow: '#ff9622', core: '#ffd68a', pore: '#ff8a1c' },
    white: { plate: '#b9c1c5', edge: '#eef2f4', tuck: '#5f6a70', dust: '#f6faff', mem: '#c9b3ac', memD: '#7c6a66', leg: '#8b8682', tip: '#eee9e1', glow: '#ffcf78', core: '#fff3d0', pore: '#ffc870' },
    bloom: { plate: '#2c2431', edge: '#6e5a79', tuck: '#120d15', dust: '#4b3a55', mem: '#5b3a66', memD: '#2a1a30', leg: '#241b29', tip: '#a28cae', glow: '#dd8cff', core: '#f8e2ff', pore: '#d27dff' },
  };
  const P = PAL[V] || PAL.base;

  // ---- materials
  function heightToNormal(src, s = 2.5) {
    const n = src.width, d = src.getContext('2d').getImageData(0, 0, n, n).data;
    const out = document.createElement('canvas'); out.width = out.height = n; const og = out.getContext('2d'), od = og.createImageData(n, n);
    const H = (x, y) => d[((((y + n) % n) * n) + ((x + n) % n)) * 4] / 255;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const gx = (H(x + 1, y) - H(x - 1, y)) * s, gy = (H(x, y + 1) - H(x, y - 1)) * s;
      let a = -gx, b = gy, c = 1; const l = Math.hypot(a, b, c); a /= l; b /= l; c /= l;
      const i = (y * n + x) * 4; od.data[i] = (a * 0.5 + 0.5) * 255; od.data[i + 1] = (b * 0.5 + 0.5) * 255; od.data[i + 2] = (c * 0.5 + 0.5) * 255; od.data[i + 3] = 255;
    }
    og.putImageData(od, 0, 0); const t = new THREE.CanvasTexture(out); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }
  let _detail;
  function detail() {   // greyscale chitin detail (pits, growth lines, scratches) + its normal map; hue comes from vertex colours
    if (_detail) return _detail;
    const n = 512, c = document.createElement('canvas'), h = document.createElement('canvas'); c.width = c.height = h.width = h.height = n;
    const g = c.getContext('2d'), hg = h.getContext('2d');
    g.fillStyle = '#e4e4e4'; g.fillRect(0, 0, n, n); hg.fillStyle = '#808080'; hg.fillRect(0, 0, n, n);
    L.blotches(g, n, 80, 10, 60, 0.07); L.blotches(g, n, 40, 10, 50, 0.08, '255,255,255');
    for (let i = 0; i < 70; i++) {     // growth lines: long faint arcs
      const y = RR(0, n), a = RR(-0.25, 0.25); g.strokeStyle = `rgba(0,0,0,${RR(0.04, 0.12)})`; hg.strokeStyle = `rgba(160,160,160,${RR(0.3, 0.6)})`; g.lineWidth = hg.lineWidth = RR(1, 2.5);
      for (const k of [g, hg]) { k.beginPath(); k.moveTo(0, y); k.bezierCurveTo(n * 0.3, y + a * 80, n * 0.7, y - a * 80, n, y); k.stroke(); }
    }
    for (let i = 0; i < 2600; i++) {   // pits
      const x = RR(0, n), y = RR(0, n), r = RR(0.8, 3.2);
      g.fillStyle = `rgba(20,14,10,${RR(0.12, 0.4)})`; g.beginPath(); g.ellipse(x, y, r, r * RR(0.6, 1), RR(0, 3), 0, 7); g.fill();
      hg.fillStyle = `rgba(30,30,30,${RR(0.5, 0.9)})`; hg.beginPath(); hg.arc(x, y, r, 0, 7); hg.fill();
    }
    for (let i = 0; i < 60; i++) { g.strokeStyle = `rgba(255,255,255,${RR(0.08, 0.22)})`; g.lineWidth = 1; const x = RR(0, n), y = RR(0, n); g.beginPath(); g.moveTo(x, y); g.lineTo(x + RR(-40, 40), y + RR(-10, 10)); g.stroke(); }
    L.speckle(g, n, 6000, 0.12);
    const map = new THREE.CanvasTexture(c); map.wrapS = map.wrapT = THREE.RepeatWrapping; map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
    return (_detail = { map, normal: heightToNormal(h, 2.2) });
  }
  const chitin = (rough = 0.56, clear = 0.22) => {
    const d = detail(); const m = new THREE.MeshPhysicalMaterial({ color: '#ffffff', map: d.map, normalMap: d.normal, roughness: rough, metalness: 0, clearcoat: clear, clearcoatRoughness: 0.55, vertexColors: true });
    m.normalScale.set(0.9, 0.9); m.envMapIntensity = 0.28; return m;
  };
  const flesh = (hex, rough = 0.5) => { const m = new THREE.MeshPhysicalMaterial({ color: hex, roughness: rough, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.35, sheen: 0.4, sheenColor: new THREE.Color(P.mem), vertexColors: true }); m.envMapIntensity = 0.3; return m; };
  const glowMat = (hex, k, glowHex) => { const m = new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: k, roughness: 0.3 }); m.userData.glow = glowHex || hex; return m; };
  // bioluminescent pores: dim by day, bright at night
  const poreMat = () => { if (NIGHT) return glowMat(P.pore, 2.6, P.pore);
    const m = new THREE.MeshStandardMaterial({ color: dim(P.pore, 0.38), emissive: P.pore, emissiveIntensity: 0.1, roughness: 0.4 }); return m; };
  // a pore: a small flat disc sunk into the surface
  function pore(parent, p, r) { const g = new THREE.SphereGeometry(r, 14, 8); g.scale(1, 0.35, 1); return addMesh(g, poreMat(), parent, p.x, p.y - r * 0.08, p.z, { cast: false }); }
  const chitM = chitin(), legM = chitin(0.5, 0.3), memM = flesh('#ffffff');

  // ---- modelling helpers (all take a parent group; coordinates are in that group's frame)
  function addMesh(geo, mat, parent, x = 0, y = 0, z = 0, o = {}) { return L.mesh(geo, mat, x, y, z, Object.assign({ parent, dirt: 0 }, o)); }
  function ell(rx, ry, rz, mat, parent, x, y, z, o = {}) {
    const g = new THREE.SphereGeometry(1, o.seg ?? 32, o.seg ? o.seg / 2 : 16); g.scale(rx, ry, rz);
    if (o.color) paint(g, o.color, o.colorB, o.colorK ?? 0.5);
    const m = addMesh(g, mat, parent, x, y, z, { dirt: o.dirt ?? 0.3, dirtH: ry * 1.6, cast: o.cast });
    if (o.rx) m.rotation.x = o.rx; if (o.ry) m.rotation.y = o.ry; if (o.rz) m.rotation.z = o.rz; return m;
  }
  // vertex colours: a, darkening to b underneath, with soil dust on top
  function paint(g, a, b, k = 0.5, dust = 0.5) {
    const pos = g.attributes.position, c = new Float32Array(pos.count * 3), A = col(a), B = col(b || a), D = col(P.dust);
    g.computeBoundingBox(); const y0 = g.boundingBox.min.y, y1 = g.boundingBox.max.y;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), t = (y - y0) / Math.max(1e-4, y1 - y0);
      const cc = A.clone().lerp(B, (1 - sstep(0.15, 0.85, t)) * k);
      cc.lerp(D, clamp((nz(x * 2.1, 3, z * 2.1) + 0.05) * 2.6) * dust * sstep(0.55, 1, t));
      c[i * 3] = cc.r; c[i * 3 + 1] = cc.g; c[i * 3 + 2] = cc.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  }
  // tapered limb segment from a to b
  function seg(a, b, r0, r1, mat, parent, o = {}) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), len = A.distanceTo(B);
    const g = new THREE.CylinderGeometry(r1, r0, len, o.n ?? 12, 1); g.translate(0, len / 2, 0);
    if (o.color) paint(g, o.color, o.colorB, 0.5, 0);
    const m = addMesh(g, mat, parent, A.x, A.y, A.z, { dirt: o.color ? 0 : 0.2, dirtH: 0.6 }); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
    if (o.joint !== false) { const s = new THREE.SphereGeometry(r0 * 1.05, 14, 8); if (o.color) paint(s, o.color, o.colorB, 0.5, 0); addMesh(s, mat, parent, A.x, A.y, A.z, { dirt: 0.2 }); }
    return m;
  }
  function cone(r, len, mat, parent, at, dir, o = {}) {
    const g = new THREE.ConeGeometry(r, len, o.n ?? 10, 1); g.translate(0, len / 2, 0);
    if (o.color) paint(g, o.color, o.colorB, 0.6, 0);
    const m = addMesh(g, mat, parent, at[0], at[1], at[2], { dirt: o.color ? 0 : 0.25, dirtH: len, cast: o.cast });
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...dir).normalize()); return m;
  }
  // a curved spike along a quadratic curve (hooks, claws, cerci)
  function hook(pts, r0, r1, mat, parent, o = {}) {
    const curve = new THREE.QuadraticBezierCurve3(...pts.map(p => new THREE.Vector3(...p)));
    const N = 16, R = 10, g = new THREE.TubeGeometry(curve, N, 1, R, false);
    const pos = g.attributes.position, nrm = g.attributes.normal;   // taper: shrink each ring toward the curve
    for (let i = 0; i <= N; i++) { const t = i / N, c = curve.getPointAt(t), rr = r0 + (r1 - r0) * t;
      for (let j = 0; j <= R; j++) { const k = i * (R + 1) + j; const v = new THREE.Vector3().fromBufferAttribute(pos, k).sub(c).multiplyScalar(rr).add(c); pos.setXYZ(k, v.x, v.y, v.z); } }
    g.computeVertexNormals(); if (o.color) paint(g, o.color, o.colorB, 0.5, 0);
    const cap = new THREE.SphereGeometry(r0, 12, 8); if (o.color) paint(cap, o.color, o.colorB, 0.5, 0);
    addMesh(cap, mat, parent, ...pts[0], { dirt: 0.2 });
    return addMesh(g, mat, parent, 0, 0, 0, { dirt: o.color ? 0 : 0.2, dirtH: 0.5, cast: o.cast });
  }

  // ---- the armour plate (tergite): a domed lens with swept-back corners, a thick rear rim, a keel and soil in it.
  // Local frame: +x forward, plate centred on the origin, base at y = 0. Returns { m, at(u, v) } (u 0 rear -> 1 front,
  // v -1 left .. 1 right; at() gives a point on the top surface in the plate's frame).
  function plate(o, parent, x = 0, y = 0, z = 0, rz = 0) {
    const NU = o.nu ?? 26, NV = o.nv ?? 34, Lh = o.L, Wd = o.W, H = o.H;
    const sweep = o.sweep ?? 0.25, front = o.front ?? 0.2, keel = o.keel ?? 0.05, rim = o.rim ?? 0.06, pw = o.pw ?? 0.55;
    const rearIn = o.rearIn ?? 0, notch = o.notch ?? 0, lipF = o.lipF ?? 0, ribN = o.ribN ?? 0, ribH = o.ribH ?? 0;
    const pal = o.pal || P, A = col(pal.plate), E = col(pal.edge), T = col(pal.tuck), D = col(pal.dust);
    const S = (u, v, top) => {
      const av = Math.abs(v);
      const xr = -Lh / 2 + rearIn * (1 - av * av) - sweep * Math.pow(av, o.sweepP ?? 3);
      const xf = Lh / 2 - front * av * av - notch * Math.exp(-v * v / 0.012) + (o.wavy ?? 0) * Math.sin(v * Math.PI * 7.5) * (1 - av * 0.5);
      const xx = xr + (xf - xr) * u;
      const wz = 1 - (o.taperF ?? 0) * Math.pow(u, 0.8) - (o.taperR ?? 0) * (1 - u);
      const zz = v * Wd / 2 * wz;
      const dome = Math.pow(Math.max(0, 1 - av * av), pw);
      if (!top) return [xx, -H * 0.2 * dome, zz, dome];
      const along = (0.8 + 0.2 * Math.sin(Math.PI * u)) * (1 - (o.dip ?? 0.35) * u * u);
      let yy = H * dome * along + keel * Math.exp(-v * v / 0.02) * dome * (0.4 + 0.6 * u)
        + rim * Math.exp(-Math.pow(u / 0.09, 2)) * Math.pow(dome, 0.3) + lipF * Math.exp(-Math.pow((1 - u) / 0.08, 2)) * Math.pow(dome, 0.3);
      if (ribN) yy += ribH * Math.pow(0.5 + 0.5 * Math.cos(v * Math.PI * ribN), 5) * dome * sstep(0.1, 0.8, u);
      yy += (o.bumpy ?? 0.025) * nz(xx * 3.1 + x * 1.7, 1, zz * 3.1 + z * 1.3) * dome;
      return [xx, yy, zz, dome];
    };
    const pos = [], uv = [], cl = [], idx = [], ou = rnd() * 4, ov = rnd() * 4, tone = 0.9 + 0.2 * rnd();
    for (const top of [true, false]) {
      const base = pos.length / 3;
      for (let i = 0; i <= NU; i++) for (let j = 0; j <= NV; j++) {
        const u = i / NU, v = -1 + 2 * j / NV, [px, py, pz, dome] = S(u, v, top); pos.push(px, py, pz); uv.push(px * 0.45 + ou, pz * 0.45 + ov);
        let c;
        if (!top) c = T.clone();
        else {
          const av = Math.abs(v);
          c = A.clone().multiplyScalar(tone);
          c.lerp(E, clamp(sstep(0.7, 1, av) * 0.7 + Math.exp(-Math.pow(u / 0.07, 2)) * 0.55 * Math.pow(dome, 0.5) + (o.wearF ?? 0) * sstep(0.85, 1, u)));
          c.lerp(T, sstep(0.72, 1, u) * (o.tuckK ?? 0.55) * (1 - (o.wearF ? 1 : 0)));
          const dn = clamp((nz(px * 1.6 + x, 5, pz * 1.6 + z) + 0.02) * 2.4) * (o.dust ?? 0.55);
          c.lerp(D, dn * sstep(0.05, 0.5, dome));
          if (o.paintFn) o.paintFn(c, u, v, px, pz);
        }
        cl.push(c.r, c.g, c.b);
      }
      for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) {
        const a = base + i * (NV + 1) + j, b = a + NV + 1, c = a + 1, d = b + 1;
        if (top) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3)); g.setIndex(idx); g.computeVertexNormals();
    const pg = new THREE.Group(); pg.position.set(x, y, z); pg.rotation.z = rz; parent.add(pg);
    const m = addMesh(g, o.mat || chitM, pg);
    return { m, g: pg, at: (u, v) => { const [a, b, c] = S(u, v, true); return new THREE.Vector3(a, b, c).applyMatrix4(new THREE.Matrix4().compose(pg.position, pg.quaternion, pg.scale)); } };
  }

  // ---- the round lamprey mouth: lip, rings of inward teeth, a dark throat with a glowing core. Faces local +y, tilted
  // toward +x by `tilt` degrees.
  function mouth(parent, x, y, z, R, tilt, o = {}) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.z = -tilt * Math.PI / 180; if (o.yaw) g.rotation.y = o.yaw; parent.add(g);
    const lip = new THREE.TorusGeometry(R, R * 0.3, 12, 36); lip.rotateX(Math.PI / 2); paint(lip, P.memD, P.tuck, 0.6, 0.2); addMesh(lip, memM, g, 0, 0, 0, { dirt: 0 });
    const k = o.k ?? 1;
    const ring = new THREE.TorusGeometry(R * 0.74, R * 0.13, 8, 36); ring.rotateX(Math.PI / 2); addMesh(ring, glowMat(P.glow, 2.2 * k), g, 0, R * 0.05, 0, { cast: false });
    const throat = new THREE.CircleGeometry(R * 0.78, 32); throat.rotateX(-Math.PI / 2); addMesh(throat, M.plain('#140805', 0.9), g, 0, -R * 0.08, 0, { cast: false });
    const core = new THREE.CircleGeometry(R * 0.36, 28); core.rotateX(-Math.PI / 2); addMesh(core, glowMat(P.core, 3 * k, P.core), g, 0, -R * 0.04, 0, { cast: false });
    const N = o.teeth ?? 12, toothM = M.plain(P.tip, 0.45);
    for (let i = 0; i < N; i++) {
      const a = i / N * Math.PI * 2, rr = R * 0.86, b = [Math.cos(a) * rr, R * 0.12, Math.sin(a) * rr];
      cone(R * 0.1, R * 0.42, toothM, g, b, [-Math.cos(a), -0.35, -Math.sin(a)], { n: 6, cast: false });
    }
    return g;
  }

  // ---- spine: a lateral travelling wave (backwards along the body, a quarter period per frame so 4 frames loop)
  function spine(x0, x1, amp, waves, headFrac) {
    const len = x1 - x0;
    const zf = (x) => { const u = (x1 - x) / len; return amp * (headFrac + (1 - headFrac) * u) * Math.sin(2 * Math.PI * waves * u - PH); };
    return (x) => { const z = zf(x), dz = (zf(x + 0.02) - zf(x - 0.02)) / 0.04; return { x, z, ang: Math.atan2(dz, 1) }; };
  }
  const root = L.getRoot();
  const segGroup = (sp, x, y = 0) => { const s = sp(x); return L.group(s.x, y, s.z, -s.ang, root); };

  // ---- legs: hip -> raised knee -> foot, metachronal ripple (phase steps a quarter period per frame)
  function leg(parent, hip, footOut, footFwd, kneeUp, r0, phase, stride, lift, mat, tipMat, o = {}) {
    const s = Math.sign(hip[2]);
    const dx = stride * Math.cos(phase), up = Math.max(0, -Math.sin(phase)) * lift;
    const foot = [hip[0] + footFwd + dx, 0.04 + up, s * (Math.abs(hip[2]) + footOut - up * 0.5)];
    const knee = [hip[0] + (footFwd + dx) * 0.45, hip[1] + kneeUp + up * 0.5, s * (Math.abs(hip[2]) + footOut * 0.5)];
    seg(hip, knee, r0, r0 * 0.82, mat, parent, { color: P.leg, colorB: P.tuck });
    seg(knee, foot, r0 * 0.82, r0 * 0.3, tipMat || mat, parent, { color: P.leg, colorB: P.tip });
    if (o.claw) cone(r0 * 0.35, o.claw, M.plain(P.tip, 0.45), parent, foot, [1, -0.3, s * 0.6], { n: 6 });
    return { knee, foot };
  }

  // light toning for the straight-down sprites (as robkit.js / creature.js)
  if (!HERO && C !== 'burrow') {
    const W = 10, cam = new THREE.OrthographicCamera(-W / 2, W / 2, W / 2, -W / 2, 0.1, 100);
    cam.position.set(0, 40, 0); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    L.useCamera(cam);
    L.getScene().traverse(o => { if (o.isDirectionalLight) o.intensity *= o.castShadow ? 0.58 : 0.6; if (o.isHemisphereLight) o.intensity *= 0.7; });
  }

  // ======================================================================================================== SWARMER
  // A blind, plated centipede the size of a big dog: a spade head with a glowing lamprey mouth, eight shingled plates
  // with swept-back points, sixteen short legs rippling in waves, two tail feelers.
  function swarmer() {
    const rust = V === 'rust', white = V === 'white', bloom = V === 'bloom';
    const fat = white ? 1.12 : 1, tall = white ? 1.3 : rust ? 1.25 : 1;
    const sp = spine(-4.0, 3.4, white ? 0.09 : 0.2, 0.75, 0.15);
    // trunk plates, front to back
    const XS = [1.92, 1.25, 0.58, -0.09, -0.76, -1.43, -2.1, -2.74];
    const WS = [1.95, 2.12, 2.18, 2.12, 2.0, 1.8, 1.55, 1.25].map(w => w * fat * (rust ? 1.04 : 1));
    // soft body under the plates
    for (let i = 0; i < XS.length; i++) {
      const g = segGroup(sp, XS[i] - 0.33);
      ell(0.5, 0.36 * tall, WS[i] * 0.42, memM, g, 0, 0.36 * tall, 0, { color: P.mem, colorB: P.memD, colorK: 0.7 });
    }
    // plates (drawn back to front so the overlaps stack correctly; each tips its nose down under the plate ahead)
    const plates = [];
    for (let i = XS.length - 1; i >= 0; i--) {
      const g = segGroup(sp, XS[i]);
      const pl = plate({ L: 0.98, W: WS[i], H: 0.36 * tall, sweep: rust ? 0.42 : 0.32, front: 0.14, keel: rust ? 0.1 : 0.05, rim: rust ? 0.1 : 0.07, pw: white ? 0.38 : 0.55, dust: white ? 0.75 : 0.5,
        paintFn: bloom ? bloomSpots(i) : null }, g, 0, 0.42 * tall, 0, -0.1);
      plates[i] = { g, pl };
      // pores on the flanks: a pair per plate
      for (const s of [-1, 1]) { const p = pl.at(0.42, s * 0.8); ell(0.075, 0.05, 0.075, poreMat(), g, p.x, p.y + 0.01, p.z, { dirt: 0, cast: false }); }
      if (rust) for (const v of [-0.55, 0, 0.55]) { const p = pl.at(0.12, v); cone(0.09, 0.2, chitM, g, [p.x, p.y - 0.04, p.z], [-0.5, 1, v * 0.4], { color: P.edge, colorB: P.plate }); }
      if (rust) for (const s of [-1, 1]) { const p = pl.at(0.2, s * 0.97); cone(0.08, 0.32, chitM, g, [p.x, p.y, p.z], [-0.7, 0.15, s], { color: P.edge, colorB: P.plate }); }
      if (white) frost(g, pl, 7);
      if (bloom && i % 2 === 1) bloomFronds(g, pl, 2);
      // legs: one pair per plate, metachronal wave down the body; left and right in antiphase
      const reach = (white ? 0.55 : 0.78) * (i > 5 ? 0.9 : 1), r0 = white ? 0.1 : 0.075;
      for (const s of [-1, 1]) {
        const ph = PH + i * 0.95 + (s > 0 ? Math.PI : 0);
        leg(g, [0.05, 0.3, s * WS[i] * 0.36], reach, (i < 3 ? 0.18 : i > 5 ? -0.25 : 0), 0.24, r0, ph, white ? 0.12 : 0.22, white ? 0.12 : 0.2, legM);
      }
    }
    // tail plate and two feelers
    {
      const g = segGroup(sp, -3.32);
      ell(0.42, 0.3 * tall, 0.5 * fat, memM, g, 0.1, 0.32, 0, { color: P.mem, colorB: P.memD });
      const pl = plate({ L: 0.82, W: 1.0 * fat, H: 0.3 * tall, sweep: -0.25, front: 0.1, rim: 0.05, keel: 0.04, pw: 0.6 }, g, 0, 0.38 * tall, 0, -0.06);
      for (const s of [-1, 1]) hook([[-0.3, 0.45, s * 0.25], [-0.9, 0.5, s * 0.45], [-1.15, 0.42, s * 0.85 + s * 0.12 * Math.sin(PH + s)]], 0.07, 0.015, legM, g, { color: P.leg, colorB: P.tip });
    }
    // head: a spade-shaped digging plate with three blunt tines, the mouth set under its lip, two short curved hooks
    {
      const g = segGroup(sp, 2.72);
      ell(0.62, 0.4 * tall, 0.78 * fat, memM, g, -0.2, 0.36, 0, { color: P.memD, colorB: P.tuck });
      const hd = plate({ L: 1.2, W: 1.8 * fat, H: 0.42 * tall, sweep: 0.05, front: 0.55, keel: 0.09, rim: 0.05, dip: 0.62, lipF: 0.05, wearF: 0.6, pw: 0.5, dust: 0.65,
        paintFn: bloom ? bloomSpots(9) : null }, g, 0.1, 0.5 * tall, 0, -0.12);
      for (const v of [-0.42, 0, 0.42]) { const p = hd.at(0.97, v); cone(0.1, 0.24, chitM, g, [p.x - 0.04, p.y - 0.06, p.z], [1, -0.35, v * 0.7], { color: P.edge, colorB: P.plate }); }
      // the head's sensory pits (eyeless): two rows of dim pores
      for (const s of [-1, 1]) for (const u of [0.45, 0.65]) { const p = hd.at(u, s * 0.62); ell(0.055, 0.04, 0.055, poreMat(), g, p.x, p.y, p.z, { dirt: 0, cast: false }); }
      mouth(g, 0.83, 0.42 * tall, 0, 0.3, 58, { teeth: 10 });
      for (const s of [-1, 1]) hook([[0.55, 0.3, s * 0.5], [1.05, 0.28, s * 0.78], [1.25, 0.26, s * 0.28]], 0.09, 0.025, legM, g, { color: P.leg, colorB: P.tip });
      if (white) frost(g, hd, 5);
    }
  }
  // Bloom variant: violet bioluminescent spots on the plates (vertex paint) + glowing fronds growing from the seams
  function bloomSpots(i) {
    return (c, u, v) => {
      const k = Math.exp(-(Math.pow((u - 0.45) / 0.18, 2) + Math.pow((Math.abs(v) - 0.42) / 0.14, 2)));
      c.lerp(col(NIGHT ? '#f0b8ff' : '#8b56a6'), k * (NIGHT ? 0.9 : 0.6));
    };
  }
  function bloomFronds(g, pl, n) {
    const fm = NIGHT ? glowMat('#e7a6ff', 1.8, '#c56cff') : glowMat('#b77ad6', 0.45, '#4a2266');
    for (let k = 0; k < n; k++) {
      const v = (k % 2 ? 1 : -1) * RR(0.15, 0.55), p = pl.at(0.15, v);
      for (let j = 0; j < 4; j++) {
        const a = RR(-0.9, 0.9), len = RR(0.22, 0.4);
        hook([[p.x, p.y - 0.03, p.z], [p.x - 0.08, p.y + len * 0.7, p.z + a * 0.1], [p.x - len * 0.5, p.y + len * 0.6, p.z + a * len * 0.6]], 0.022, 0.008, fm, g, { cast: false });
        ell(0.04, 0.04, 0.04, fm, g, p.x - len * 0.5, p.y + len * 0.6, p.z + a * len * 0.6, { dirt: 0, cast: false });
      }
    }
  }
  // White variant: frost crystals sitting on the plates
  function frost(g, pl, n) {
    const fm = new THREE.MeshStandardMaterial({ color: '#f4fbff', roughness: 0.15, metalness: 0.1, flatShading: true }); fm.envMapIntensity = 1.2;
    for (let k = 0; k < n; k++) {
      const p = pl.at(RR(0.15, 0.85), RR(-0.85, 0.85)), s = RR(0.04, 0.09);
      const geo = new THREE.OctahedronGeometry(s, 0); geo.scale(1, RR(0.5, 1.4), 1);
      const m = addMesh(geo, fm, g, p.x, p.y + s * 0.3, p.z, { dirt: 0, cast: false }); m.rotation.set(RR(0, 3), RR(0, 3), RR(0, 3));
    }
  }

  // ======================================================================================================== DRAINER
  // A legless, plated lamprey-worm. Walks by undulating; feeds by hooking its rear segments into the ground and pushing
  // a long telescoping proboscis into anything that holds charge. Blister sacs along its flanks fill with stolen charge.
  function drainer() {
    const off = FEED ? -1.45 : 0;
    const sp = spine(-3.7 + off, 2.9 + off, FEED ? 0.1 : 0.42, 1.05, FEED ? 0 : 0.22);
    const XS = [2.18, 1.6, 1.02, 0.44, -0.14, -0.72, -1.3, -1.88, -2.44, -2.96].map(x => x + off);
    const WS = [1.38, 1.7, 2.0, 2.22, 2.3, 2.2, 1.95, 1.65, 1.4, 1.1];
    const swell = (i) => FEED ? 1 + 0.05 * Math.sin(i * 1.3) : 1 + 0.06 * Math.sin(PH - i * 0.9);
    const full = FEED ? 1 : 0.55;
    for (let i = XS.length - 1; i >= 0; i--) {
      const g = segGroup(sp, XS[i]), W = WS[i] * swell(i);
      ell(0.42, 0.42, W * 0.48, memM, g, -0.05, 0.42, 0, { color: P.mem, colorB: P.memD, colorK: 0.75 });
      // a narrow dorsal plate with a keel; the soft flanks stay bare
      const pl = plate({ L: 0.7, W: W * 0.66, H: 0.3, sweep: 0.14, front: 0.08, keel: 0.07, rim: 0.06, pw: 0.6, dust: 0.6 }, g, 0, 0.6, 0, -0.08);
      // charge blisters on the widest segments
      if (i >= 2 && i <= 6) for (const s of [-1, 1]) {
        const sm = new THREE.MeshPhysicalMaterial({ color: '#f3dcae', emissive: P.glow, emissiveIntensity: (NIGHT ? 1.5 : 0.38) * full, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.1 });
        sm.userData.glow = NIGHT ? P.glow : dim(P.glow, 0.32 * full + 0.1); sm.envMapIntensity = 0.9;
        const r = 0.2 + 0.05 * Math.sin(i * 2.1 + s);
        ell(r * 1.25, r * 0.9, r, sm, g, -0.02, 0.5, s * W * 0.42, { dirt: 0, cast: false });
      } else if (i > 0) for (const s of [-1, 1]) { const p = pl.at(0.45, s * 0.9); ell(0.06, 0.045, 0.06, poreMat(), g, p.x, p.y, p.z, { dirt: 0, cast: false }); }
      // the rear anchors: two pairs of big hooks; folded back while it walks, splayed and driven into the ground to feed
      if (i >= 8) for (const s of [-1, 1]) {
        const k = i === 8 ? 1 : 0.8;
        const pts = FEED
          ? [[0, 0.5, s * W * 0.4], [-0.15 * k, 0.55, s * (W * 0.5 + 1.1 * k)], [-0.55 * k, 0.02, s * (W * 0.5 + 1.25 * k)]]
          : [[0, 0.5, s * W * 0.4], [-0.55 * k, 0.5, s * (W * 0.5 + 0.55 * k)], [-1.05 * k, 0.3, s * (W * 0.5 + 0.2 * k + 0.08 * Math.sin(PH + s))]];
        hook(pts, 0.12 * k, 0.025, chitM, g, { color: P.edge, colorB: P.plate });
      }
    }
    // tail: a short spade
    { const g = segGroup(sp, -3.45 + off); ell(0.5, 0.3, 0.42, memM, g, 0.15, 0.32, 0, { color: P.mem, colorB: P.memD });
      plate({ L: 0.8, W: 0.95, H: 0.24, sweep: -0.3, front: 0.05, keel: 0.05, rim: 0.04 }, g, -0.05, 0.42, 0, -0.05); }
    // head: three armoured petals round an oral sucker; closed into a digging cone while walking, opened to feed
    {
      const g = segGroup(sp, 2.72 + off);
      ell(0.55, 0.42, 0.62, memM, g, -0.1, 0.45, 0, { color: P.memD, colorB: P.tuck });
      const open = FEED ? 1 : 0;
      mouth(g, 0.48 + 0.12 * open, 0.48, 0, FEED ? 0.48 : 0.4, FEED ? 72 : 80, { teeth: 14, k: FEED ? 1.3 : 0.9 });
      // each petal: rolled round the body axis to its place, hinged at its rear so its tip swings away from the mouth
      const petal = (roll, w) => {
        const pg = new THREE.Group(); pg.position.set(-0.25, 0.48, 0); pg.rotation.x = roll; g.add(pg);
        const hg = new THREE.Group(); hg.rotation.z = open ? 0.8 : 0.05; pg.add(hg);
        plate({ L: 1.2, W: w, H: 0.26, sweep: -0.15, front: 0.75, keel: 0.08, rim: 0.03, dip: 0.55, lipF: 0.03, wearF: 0.7, pw: 0.5, dust: 0.6 }, hg, 0.62, 0.14, 0, -0.1);
      };
      petal(-1.3, 0.92); petal(1.3, 0.92); petal(0, 1.08);
      // the proboscis: telescoping rings with glowing joints and a barbed glowing tip
      const ext = FEED ? 3.3 : 0.38, rings = FEED ? 7 : 1, dir = new THREE.Vector3(1, FEED ? -0.08 : 0, 0).normalize();
      const p0 = new THREE.Vector3(0.62 + 0.12 * open, 0.5, 0);
      const pm = flesh('#ffffff', 0.35);
      for (let k = 0; k < rings; k++) {
        const a = p0.clone().add(dir.clone().multiplyScalar(ext * k / rings)), b = p0.clone().add(dir.clone().multiplyScalar(ext * (k + 1) / rings));
        const r = 0.17 - 0.08 * (k / rings);
        seg(a.toArray(), b.toArray(), r, r * 0.85, pm, g, { color: P.mem, colorB: P.memD, joint: false });
        const jr = new THREE.TorusGeometry(r * 0.95, r * 0.22, 8, 20); jr.rotateY(Math.PI / 2);
        addMesh(jr, glowMat(P.glow, FEED ? 2.2 : 1.2), g, b.x, b.y, b.z, { cast: false });
      }
      const tip = p0.clone().add(dir.clone().multiplyScalar(ext));
      ell(0.13, 0.1, 0.1, glowMat(P.core, FEED ? 3.2 : 2, P.core), g, tip.x + 0.06, tip.y, tip.z, { dirt: 0, cast: false });
      for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; cone(0.03, 0.16, M.plain(P.tip, 0.4), g, [tip.x + 0.04, tip.y + Math.cos(a) * 0.08, tip.z + Math.sin(a) * 0.08], [0.6, Math.cos(a), Math.sin(a)], { n: 5, cast: false }); }
      if (FEED) {   // a charge vein running back along the extended proboscis
        const vm = glowMat(P.glow, 2.4);
        for (const s of [-1, 1]) seg([p0.x, p0.y + 0.1, s * 0.06], [tip.x - 0.1, tip.y + 0.06, s * 0.04], 0.025, 0.018, vm, g, { joint: false });
      }
    }
  }

  // ========================================================================================================== BRUTE
  // A wide tunnelling beast: a crescent shovel-shield with a ribbed scraping edge and the mouth in a notch at its front,
  // mole-like spade claws either side, four broad shingled plates with blunt knobs, glowing seams.
  function brute() {
    const sp = spine(-4.2, 3.9, 0.12, 0.6, 0.35);
    const XS = [0.5, -0.62, -1.72, -2.75], WS = [4.5, 4.3, 3.75, 2.95];
    // body
    for (let i = 0; i < XS.length; i++) { const g = segGroup(sp, XS[i] - 0.4); ell(0.8, 0.75, WS[i] * 0.4, memM, g, 0, 0.75, 0, { color: P.mem, colorB: P.memD, colorK: 0.75 }); }
    // hind legs (two pairs), heavy and short
    const hips = [[-0.55, 1.75, 0], [-1.9, 1.55, Math.PI]];
    for (const [hx, hz, p0] of hips) {
      const g = segGroup(sp, hx);
      for (const s of [-1, 1]) leg(g, [0, 0.62, s * hz], 1.15, hx > -1 ? 0.1 : -0.35, 0.45, 0.24, PH + p0 + (s > 0 ? Math.PI : 0), 0.32, 0.32, legM, null, { claw: 0.3 });
    }
    // plates, back to front
    const ruststuds = V === 'rust';
    for (let i = XS.length - 1; i >= 0; i--) {
      const g = segGroup(sp, XS[i]);
      const pl = plate({ L: 1.6, W: WS[i], H: 0.75, sweep: 0.5, front: 0.25, keel: 0.08, rim: 0.14, pw: 0.42, dust: 0.6, nu: 30, nv: 44 }, g, 0, 0.95, 0, -0.1);
      // blunt knobs along the rear rim
      const nK = i < 3 ? 5 : 3;
      for (let k = 0; k < nK; k++) { const v = -0.62 + 1.24 * k / (nK - 1), p = pl.at(0.16, v); const kb = new THREE.SphereGeometry(0.17, 16, 10); kb.scale(1, 0.75, 1); paint(kb, P.edge, P.plate, 0.6, 0.3); addMesh(kb, chitM, g, p.x, p.y - 0.02, p.z, { dirt: 0 }); }
      // glowing seam pores along both flanks
      for (const s of [-1, 1]) for (const v of [0.72, 0.86]) { const p = pl.at(0.06, s * v); ell(0.09, 0.06, 0.09, poreMat(), g, p.x - 0.04, p.y - 0.03, p.z, { dirt: 0, cast: false }); }
    }
    // tail plate with a blunt spike
    { const g = segGroup(sp, -3.65); ell(0.6, 0.5, 0.8, memM, g, 0.2, 0.55, 0, { color: P.mem, colorB: P.memD });
      const pl = plate({ L: 1.15, W: 2.0, H: 0.55, sweep: -0.4, front: 0.15, keel: 0.12, rim: 0.08, pw: 0.5 }, g, 0, 0.75, 0, -0.08);
      cone(0.22, 0.6, chitM, g, [-0.5, 0.95, 0], [-1, 0.25, 0], { color: P.edge, colorB: P.plate }); }
    // spade forelimbs: arm out from under the shield, a broad flat hand with four digging claws; they alternate strokes
    {
      const g = segGroup(sp, 2.0);
      for (const s of [-1, 1]) {
        const ph = PH + (s > 0 ? Math.PI : 0), dx = 0.4 * Math.cos(ph), up = Math.max(0, -Math.sin(ph)) * 0.35;
        const sh = [-0.2, 0.75, s * 1.6], el = [0.55 + dx * 0.5, 0.95 + up * 0.5, s * 2.75], hand = [1.25 + dx, 0.45 + up, s * 2.95];
        seg(sh, el, 0.38, 0.32, legM, g, { color: P.leg, colorB: P.tuck });
        seg(el, hand, 0.32, 0.28, legM, g, { color: P.leg, colorB: P.tuck });
        const hg = new THREE.Group(); hg.position.set(...hand); hg.rotation.y = -s * 0.5; hg.rotation.x = s * 0.25; g.add(hg);
        ell(0.55, 0.22, 0.5, chitM, hg, 0, 0, 0, { color: P.plate, colorB: P.tuck });
        for (let k = 0; k < 4; k++) { const z = (-0.36 + 0.24 * k); cone(0.12, 0.62, M.plain(P.tip, 0.45), hg, [0.35, 0, z], [1, -0.18, z * 0.45], { n: 8, color: P.tip, colorB: P.leg }); }
      }
    }
    // the shovel-shield: a wide crescent, ribbed, sloping to a scraped lip with a notch for the mouth
    {
      const g = segGroup(sp, 2.05);
      ell(0.9, 0.7, 1.7, memM, g, -0.4, 0.75, 0, { color: P.memD, colorB: P.tuck });
      const sh = plate({ L: 2.45, W: 5.3, H: 0.95, sweep: 0.15, front: 1.15, rearIn: 0.55, notch: 0.42, keel: 0.1, rim: 0.0, dip: 0.6, lipF: 0.1, wearF: 0.75, ribN: 7, ribH: 0.07, pw: 0.35, dust: 0.7, nu: 40, nv: 64,
        paintFn: V === 'bloom' ? bloomSpots(0) : null }, g, 0.15, 0.85, 0, -0.16);
      // blunt scraping teeth along the front edge (skipping the notch)
      for (const v of [-0.86, -0.66, -0.46, -0.27, 0.27, 0.46, 0.66, 0.86]) { const p = sh.at(0.985, v); cone(0.13, 0.32, chitM, g, [p.x - 0.05, p.y - 0.08, p.z], [1, -0.5, v * 0.9], { color: P.tip, colorB: P.edge }); }
      // eyeless sensor pits: dim pores in two arcs
      for (const s of [-1, 1]) for (const [u, v] of [[0.55, 0.3], [0.62, 0.45], [0.5, 0.58]]) { const p = sh.at(u, s * v); ell(0.08, 0.05, 0.08, poreMat(), g, p.x, p.y, p.z, { dirt: 0, cast: false }); }
      const m = sh.at(0.98, 0); mouth(g, m.x - 0.05, 0.75, 0, 0.5, 52, { teeth: 14 });
    }
  }

  // ========================================================================================================= BURROW
  // The tunnel mouth they come out of: a crater of upthrust crust round a dark throat that slants down and away, its
  // ribbed lining glowing amber deep inside; spoil, drained Crystal, a shed plate, furrows, and Bloom taking hold.
  function burrow() {
    const CX = 0.1, CZ = -0.2, RH = 1.55, RO = 4.3;
    const crest = (a) => 1.0 + 0.25 * nz(Math.cos(a) * 1.4, 2, Math.sin(a) * 1.4) + 0.15 * Math.sin(a * 5 + 1);
    // mound of thrown-out soil: radial profile from the lip (r = RH) to the ground (r = RO)
    {
      const NA = 140, NR = 36, pos = [], cl = [], idx = [], uv = [];
      const wet = col('#3d2a1f'), dry = col('#a37a52'), mid = col('#6e4c33');
      for (let j = 0; j <= NR; j++) for (let i = 0; i <= NA; i++) {
        const a = i / NA * Math.PI * 2, t = j / NR;
        const ro = RO * (1 + 0.12 * nz(Math.cos(a) * 2, 7, Math.sin(a) * 2)), rr = RH + (ro - RH) * t;
        const hc = crest(a), prof = t < 0.12 ? hc * (0.75 + 0.25 * sstep(0, 0.12, t)) : hc * Math.pow(1 - sstep(0.12, 1, t), 1.5);
        const x = CX + Math.cos(a) * rr, z = CZ + Math.sin(a) * rr;
        const y = prof + 0.18 * nz(x * 1.8, 1, z * 1.8) * (1 - t) + 0.06 * nz(x * 5, 3, z * 5) * (1 - t * 0.5) - 0.02;
        pos.push(x, Math.max(0, y), z); uv.push(x * 0.4, z * 0.4);
        const c = wet.clone().lerp(mid, sstep(0.05, 0.4, t)).lerp(dry, sstep(0.35, 0.95, t) * (0.7 + 0.3 * nz(x * 2, 4, z * 2)));
        c.multiplyScalar(0.85 + 0.3 * (0.5 + nz(x * 4, 9, z * 4)));
        cl.push(c.r, c.g, c.b);
      }
      for (let j = 0; j < NR; j++) for (let i = 0; i < NA; i++) { const a = j * (NA + 1) + i, b = a + 1, c = a + NA + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
      const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, map: M.rough('#ffffff').map }); m.envMapIntensity = 0.35;
      L.mesh(g, m, 0, 0, 0, {});
    }
    // the throat: a ribbed tube from the lip down and away (-z), hardened lining, amber glow at the bottom
    {
      const NA = 72, NS = 30, pos = [], cl = [], idx = [];
      const lining = col('#2a1a14'), rib = col('#5a3a2a'), hot = col(P.glow);
      const centre = (t) => new THREE.Vector3(CX + 0.0, 0.9 - 3.4 * t, CZ - 2.2 * t * t);
      for (let j = 0; j <= NS; j++) for (let i = 0; i <= NA; i++) {
        const t = j / NS, a = i / NA * Math.PI * 2, c = centre(t);
        const ribk = Math.pow(0.5 + 0.5 * Math.cos(t * 26), 3);
        const r = (RH * (1 - 0.35 * t) + 0.06 * ribk) * (1 + 0.06 * nz(Math.cos(a) * 2, t * 4, Math.sin(a) * 2));
        const lipH = t === 0 ? crest(a) * 0.75 : 0;
        pos.push(c.x + Math.cos(a) * r, c.y + (t === 0 ? lipH - 0.9 : 0), c.z + Math.sin(a) * r);
        const k = lining.clone().lerp(rib, ribk * 0.6).lerp(hot, sstep(0.55, 1, t) * 0.55);
        cl.push(k.r, k.g, k.b);
      }
      for (let j = 0; j < NS; j++) for (let i = 0; i < NA; i++) { const a = j * (NA + 1) + i, b = a + 1, c = a + NA + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3)); g.setIndex(idx); g.computeVertexNormals();
      const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05, side: THREE.DoubleSide }); m.envMapIntensity = 0.3;
      L.mesh(g, m, 0, 0, 0, { cast: false });
      const c = centre(0.92), fl = new THREE.CircleGeometry(RH * 0.75, 32); fl.rotateX(-Math.PI / 2);
      L.mesh(fl, glowMat(P.glow, NIGHT ? 2.4 : 1.4, NIGHT ? P.glow : dim(P.glow, 0.75)), c.x, c.y, c.z, { cast: false });
      L.pointLight(P.glow, NIGHT ? 26 : 12, c.x, c.y + 1.2, c.z + 0.6, 4.5);
      // glowing beads of charge on the ribs, brighter toward the bottom
      for (let k = 0; k < 26; k++) { const t = RR(0.15, 0.85), a = RR(0.2, Math.PI - 0.2) + (rnd() < 0.4 ? Math.PI : 0), cc = centre(t), r = RH * (1 - 0.35 * t) - 0.03;
        ell(0.07, 0.07, 0.07, t > 0.45 || NIGHT ? glowMat(P.pore, NIGHT ? 2.4 : 1.2, NIGHT ? P.pore : dim(P.pore, 0.7)) : poreMat(), root, cc.x + Math.cos(a) * r, cc.y, cc.z + Math.sin(a) * r, { dirt: 0, cast: false }); }
    }
    // upthrust slabs of crust, tipped outward round the lip, as if something burst up from below
    const slabM = M.rough('#8e6a4a'), slabTop = M.rough('#b38a62');
    for (let i = 0; i < 11; i++) {
      const a = i / 11 * Math.PI * 2 + RR(-0.2, 0.2), r = RH + RR(0.35, 0.8), w = RR(0.8, 1.4), h = RR(0.18, 0.32), d = RR(0.6, 1.0);
      if (Math.abs(Math.sin(a) + 1) < 0.25 && rnd() < 0.5) continue;
      const g = L.group(CX + Math.cos(a) * r, crest(a) * 0.55, CZ + Math.sin(a) * r, -a, root);
      const geo = new THREE.BoxGeometry(d, h, w, 3, 1, 3); const p = geo.attributes.position;
      for (let k = 0; k < p.count; k++) p.setXYZ(k, p.getX(k) * (1 + 0.25 * nz(p.getX(k) * 4 + i, 1, p.getZ(k) * 4)), p.getY(k), p.getZ(k) * (1 + 0.2 * nz(p.getZ(k) * 3, i, 2)));
      geo.computeVertexNormals();
      const m = L.mesh(geo, rnd() < 0.5 ? slabM : slabTop, 0, 0, 0, { parent: g, dirt: 0.5, dirtH: h }); m.rotation.z = RR(0.35, 0.75); m.rotation.x = RR(-0.25, 0.25);
    }
    // spoil: clods and stones thrown out in a fan toward the front-right
    const clodM = M.rough('#5a3d2a'), stoneM = M.rough('#9a8068');
    for (let i = 0; i < 46; i++) {
      const a = RR(-0.6, 2.4), r = RR(RH + 0.9, RO + 0.9), s = RR(0.07, 0.24) * (1.4 - r / (RO + 1));
      const x = CX + Math.cos(a) * r, z = CZ + Math.sin(a) * r;
      const geo = new THREE.DodecahedronGeometry(s, 0); geo.scale(1, 0.65, 1);
      const m = L.mesh(geo, rnd() < 0.7 ? clodM : stoneM, x, groundH(x, z) + s * 0.3, z, { dirt: 0.3 }); m.rotation.y = RR(0, 3);
    }
    function groundH(x, z) { const dx = x - CX, dz = z - CZ, rr = Math.hypot(dx, dz), a = Math.atan2(dz, dx), t = (rr - RH) / (RO - RH); if (t < 0) return 1; if (t > 1) return 0; return (t < 0.12 ? crest(a) : crest(a) * Math.pow(1 - sstep(0.12, 1, t), 1.5)); }
    // drained Crystal: grey, cracked shards (one still faintly lit), and a shed Swarmer plate
    const deadX = M.crystal('#5b5560', '#000000', 0.05); deadX.userData.glow = null; deadX.emissiveIntensity = 0.0;
    const halfX = M.crystal('#8f6fb0', NIGHT ? '#a57cff' : '#3a2a55', NIGHT ? 0.7 : 0.25);
    for (const [x, z, r, len, rx, rz, mat] of [[-3.0, 0.9, 0.22, 0.9, 0.3, 0.5, deadX], [-3.35, 0.35, 0.16, 0.6, -0.2, 0.7, deadX], [-2.6, 1.45, 0.14, 0.5, 0.5, -0.2, halfX], [2.9, -1.9, 0.18, 0.7, -0.4, -0.5, deadX]]) {
      L.crystal(r, len, r * 1.6, mat, x, groundH(x, z) - 0.05, z, rx, rz);
    }
    { const g = L.group(2.55, groundH(2.55, 1.6) + 0.02, 1.6, 0.6, root);
      plate({ L: 0.98, W: 2.0, H: 0.32, sweep: 0.32, front: 0.14, keel: 0.05, rim: 0.07, pal: { plate: '#9a8670', edge: '#d8c7a8', tuck: '#5a4a3a', dust: '#c9a97e' }, dust: 0.8 }, g, 0, 0.0, 0, 0.12).m.rotation.x = 0.25; }
    // Bloom taking hold on the far side: violet fronds and bulbs (glow at night)
    const bm = NIGHT ? glowMat('#e2a0ff', 1.8, '#c46bff') : glowMat('#a86ccc', 0.35, '#3a1a55'), stalk = M.plain('#4a3352', 0.6);
    for (let i = 0; i < 9; i++) {
      const a = RR(3.6, 5.2), r = RR(RH + 1.2, RO - 0.2), x = CX + Math.cos(a) * r, z = CZ + Math.sin(a) * r, y0 = groundH(x, z);
      for (let j = 0; j < 5; j++) { const b = RR(0, 6.28), len = RR(0.25, 0.6);
        hook([[x, y0 - 0.03, z], [x + Math.cos(b) * 0.06, y0 + len * 0.8, z + Math.sin(b) * 0.06], [x + Math.cos(b) * len * 0.5, y0 + len, z + Math.sin(b) * len * 0.5]], 0.03, 0.012, stalk, root, { cast: false });
        ell(0.07, 0.07, 0.07, bm, root, x + Math.cos(b) * len * 0.5, y0 + len, z + Math.sin(b) * len * 0.5, { dirt: 0, cast: false }); }
    }
    // the ground disturbance: furrows of trails radiating out and a darker damp halo (a decal, transparent at its edge)
    {
      const n = 1024, S = 11;
      const tex = L.canvasTex(n, (g) => {
        const img = g.createImageData(n, n), Dd = img.data;
        const trails = [0.5, 1.4, 2.3, 3.9, 5.2].map(a => a + RR(-0.2, 0.2));
        for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
          const wx = (x / n - 0.5) * S, wz = (y / n - 0.5) * S, dx = wx - CX, dz = wz - CZ, rr = Math.hypot(dx, dz), a = Math.atan2(dz, dx);
          let al = 0, R0 = 0x4a, G0 = 0x33, B0 = 0x24;
          const halo = 1 - sstep(RO * 0.85, RO + 1.0 + 0.4 * nz(Math.cos(a) * 2, 1, Math.sin(a) * 2), rr); al = Math.max(al, halo * 0.55);
          for (const ta of trails) {
            const wig = ta + 0.08 * Math.sin(rr * 2.2 + ta * 3); let da = Math.abs(((a - wig + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
            const off = da * rr, w = 0.32 * (1 - sstep(RO, RO + 2.4, rr));
            if (off < w && rr > RO * 0.7) { const k = 1 - off / w; al = Math.max(al, 0.6 * k * (1 - sstep(RO + 1.2, RO + 2.4, rr))); const ring = 0.5 + 0.5 * Math.cos(rr * 9); R0 -= 10 * ring; G0 -= 8 * ring; }
          }
          const i4 = (y * n + x) * 4; Dd[i4] = R0; Dd[i4 + 1] = G0; Dd[i4 + 2] = B0; Dd[i4 + 3] = Math.round(clamp(al) * 255);
        }
        g.putImageData(img, 0, 0);
      });
      const m = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.95, metalness: 0, depthWrite: false });
      const pg = new THREE.PlaneGeometry(S, S); pg.rotateX(-Math.PI / 2);
      const pm = new THREE.Mesh(pg, m); pm.position.set(0, 0.012, 0); pm.receiveShadow = true; pm.userData.decal = true; root.add(pm);
    }
  }

  // ========================================================================================================== build
  if (C === 'swarmer') swarmer(); else if (C === 'drainer') drainer(); else if (C === 'brute') brute(); else burrow();

  if (HERO) {
    // 3/4 presentation: a sand patch with the shadow, a warm key from the camera side, a cool rim from behind
    const sand = M.rough('#a6754a'), gg = new THREE.CircleGeometry(14, 64); gg.rotateX(-Math.PI / 2);
    const gm = L.mesh(gg, sand, 0, 0, 0, { cast: false });
    for (let i = 0; i < 40; i++) { const a = RR(0, 6.28), r = RR(3.5, 9), s = RR(0.06, 0.3); const geo = new THREE.DodecahedronGeometry(s, 0); geo.scale(1, 0.6, 1); L.mesh(geo, M.rough(rnd() < 0.5 ? '#7d5a3c' : '#9c8064'), Math.cos(a) * r, s * 0.2, Math.sin(a) * r, { dirt: 0.3 }); }
    const key = new THREE.DirectionalLight('#ffd8b0', 1.6); key.position.set(12, 9, 10); L.getScene().add(key);
    const rimL = new THREE.DirectionalLight('#9fb8ff', 1.4); rimL.position.set(-10, 6, -8); L.getScene().add(rimL);
    const cam = new THREE.PerspectiveCamera(26, 1, 0.5, 200);
    const tgt = new THREE.Vector3(0.6, 0.6, 0.2);
    cam.position.set(12.5, 7.6, 11.5); cam.lookAt(tgt); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    L.useCamera(cam);
  }
}

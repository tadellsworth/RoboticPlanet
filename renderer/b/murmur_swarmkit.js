// Murmur, direction B ("Crystal-backed swarm"): the shared kit for murmur_swarm.js.
// Chitin and crystal materials, banded body segments, glowing Ring Crystal shards that grow out through the shell,
// jointed legs with a walking gait, and the cameras (top-down sprite, or a 3/4 perspective hero shot).
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function mkit(L) {
  const { THREE } = L;
  const TOD = L.TOD;
  // how strongly the creatures' own lights burn: dim by day, bright at night (the game swaps in the night sprites)
  const GLOW = { day: 0.35, morning: 0.45, evening: 1.15, night: 1.7 }[TOD] ?? 0.35;
  const NIGHTISH = TOD === 'night' || TOD === 'evening';

  // ---- deterministic smooth noise (random plane waves, as nest.js does)
  let s0 = 7331; const r = () => { s0 = (s0 * 16807) % 2147483647; return s0 / 2147483647; };
  const waves = []; for (let i = 0; i < 16; i++) { const th = r() * 6.283, ph = Math.acos(2 * r() - 1); waves.push([Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th), 1.3 + r() * 3.2, r() * 6.28]); }
  const nz = (x, y, z) => { let v = 0, w = 0; for (const [a, b, c, f, o] of waves) { const amp = 1 / f; v += Math.sin((a * x + b * y + c * z) * f + o) * amp; w += amp; } return v / w; };

  // ---- textures
  function heightToNormal(src, n, s) {
    const out = document.createElement('canvas'); out.width = out.height = n; const og = out.getContext('2d'), od = og.createImageData(n, n);
    const d = src.getContext('2d').getImageData(0, 0, n, n).data, H = (x, y) => d[((((y + n) % n) * n) + ((x + n) % n)) * 4] / 255;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const gx = (H(x + 1, y) - H(x - 1, y)) * s, gy = (H(x, y + 1) - H(x, y - 1)) * s; let a = -gx, b = gy, c = 1; const l = Math.hypot(a, b, c);
      const i = (y * n + x) * 4; od.data[i] = (a / l * 0.5 + 0.5) * 255; od.data[i + 1] = (b / l * 0.5 + 0.5) * 255; od.data[i + 2] = (c / l * 0.5 + 0.5) * 255; od.data[i + 3] = 255;
    }
    og.putImageData(od, 0, 0); const t = new THREE.CanvasTexture(out); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }
  function texPair(n, draw, nscale) {
    const c = document.createElement('canvas'); c.width = c.height = n; const h = document.createElement('canvas'); h.width = h.height = n;
    draw(c.getContext('2d'), h.getContext('2d'), n);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
    return [t, heightToNormal(h, n, nscale)];
  }
  // chitin: mottled, finely pitted, with faint growth lines
  const [chitinMap, chitinNrm] = texPair(512, (g, hg, n) => {
    g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, n, n); hg.fillStyle = '#808080'; hg.fillRect(0, 0, n, n);
    L.blotches(g, n, 160, 10, 70, 0.16); L.blotches(g, n, 60, 8, 40, 0.12, '255,255,255');
    for (let i = 0; i < 70; i++) { const y = L.rnd() * n; g.strokeStyle = `rgba(0,0,0,${0.04 + L.rnd() * 0.08})`; g.lineWidth = 1 + L.rnd() * 2; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= n; x += 16) g.lineTo(x, y + Math.sin(x * 0.02 + i) * 4); g.stroke(); }
    for (let i = 0; i < 2600; i++) { const x = L.rnd() * n, y = L.rnd() * n, rr = 0.8 + L.rnd() * 2.2; hg.fillStyle = `rgba(30,30,30,${0.3 + L.rnd() * 0.5})`; hg.beginPath(); hg.arc(x, y, rr, 0, 7); hg.fill(); g.fillStyle = `rgba(0,0,0,${0.08 + L.rnd() * 0.12})`; g.beginPath(); g.arc(x, y, rr * 0.8, 0, 7); g.fill(); }
    L.speckle(g, n, 6000, 0.1);
  }, 2.2);
  chitinMap.repeat.set(2, 1); chitinNrm.repeat.set(2, 1);
  // stone crust (the Brute's geode shell): lumpy, cracked, dusty
  const [crustMap, crustNrm] = texPair(512, (g, hg, n) => {
    g.fillStyle = '#c9c4bc'; g.fillRect(0, 0, n, n); hg.fillStyle = '#808080'; hg.fillRect(0, 0, n, n);
    for (let i = 0; i < 900; i++) { const x = L.rnd() * n, y = L.rnd() * n, rr = 3 + L.rnd() * 16, k = L.rnd();
      const gr = hg.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, `rgba(${k < 0.5 ? '255,255,255' : '0,0,0'},0.35)`); gr.addColorStop(1, 'rgba(128,128,128,0)'); hg.fillStyle = gr; hg.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
    L.blotches(g, n, 200, 8, 60, 0.2); L.blotches(g, n, 90, 6, 40, 0.18, '255,250,240');
    for (let i = 0; i < 40; i++) { let x = L.rnd() * n, y = L.rnd() * n; hg.strokeStyle = 'rgba(0,0,0,0.9)'; g.strokeStyle = 'rgba(20,15,10,0.5)'; hg.lineWidth = 2; g.lineWidth = 1.5; hg.beginPath(); g.beginPath(); hg.moveTo(x, y); g.moveTo(x, y);
      for (let k = 0; k < 6; k++) { x += (L.rnd() - 0.5) * 40; y += (L.rnd() - 0.5) * 40; hg.lineTo(x, y); g.lineTo(x, y); } hg.stroke(); g.stroke(); }
    L.speckle(g, n, 16000, 0.22);
  }, 3.5);
  crustMap.repeat.set(3, 2); crustNrm.repeat.set(3, 2);

  // ---- materials
  const mats = {};
  function chitin(hex, o = {}) {
    const key = 'c' + hex + JSON.stringify(o); if (mats[key]) return mats[key];
    const m = new THREE.MeshPhysicalMaterial({ color: hex, map: o.noTex ? null : chitinMap, normalMap: o.noTex ? null : chitinNrm, normalScale: new THREE.Vector2(o.ns ?? 0.5, o.ns ?? 0.5),
      roughness: o.rough ?? 0.34, metalness: 0.04, clearcoat: o.cc ?? 0.75, clearcoatRoughness: o.ccr ?? 0.28,
      iridescence: o.irid ?? 0.45, iridescenceIOR: 1.32, iridescenceThicknessRange: [220, 480],
      sheen: o.sheen ?? 0, sheenColor: new THREE.Color(o.sheenColor ?? '#ffffff'), sheenRoughness: 0.6, vertexColors: true });
    m.envMapIntensity = o.env ?? 0.55;
    if (o.emissiveMap) { m.emissive = new THREE.Color(o.emissive); m.emissiveMap = o.emissiveMap; m.emissiveIntensity = (o.ek ?? 1) * GLOW; m.userData.glow = o.glow; }
    return (mats[key] = m);
  }
  function crust(hex, o = {}) {
    const key = 'r' + hex; if (mats[key]) return mats[key];
    const m = new THREE.MeshStandardMaterial({ color: hex, map: crustMap, normalMap: crustNrm, normalScale: new THREE.Vector2(1.1, 1.1), roughness: o.rough ?? 0.86, metalness: 0.02, vertexColors: true });
    m.envMapIntensity = 0.4; return (mats[key] = m);
  }
  const plain = (hex, rough = 0.5, metal = 0.02) => { const key = 'p' + hex + rough; if (mats[key]) return mats[key]; const m = new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: metal, vertexColors: true }); m.envMapIntensity = 0.5; return (mats[key] = m); };
  // glossy black compound eye
  const eye = () => mats.eye || (mats.eye = (() => { const m = new THREE.MeshPhysicalMaterial({ color: '#120c0c', roughness: 0.3, metalness: 0.0, clearcoat: 0.5, clearcoatRoughness: 0.25 }); m.envMapIntensity = 0.35; return m; })());
  // a glowing organ (mouth disc, sucker pads, Bloom spots): flat emissive with a glow colour for the bloom pass
  function glowMat(hex, k = 1, glowHex) {
    const key = 'g' + hex + k + glowHex; if (mats[key]) return mats[key];
    const m = new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: k * GLOW * 2.2, roughness: 0.3 });
    m.userData.glow = glowHex || dimGlow(hex); return (mats[key] = m);
  }
  // the glow-pass colour sets how much bloom a part gets: keep it low by day so the shards only shimmer
  function dimGlow(hex, k = 1) { const c = new THREE.Color(hex); c.multiplyScalar(Math.min(1, (NIGHTISH ? 0.1 + GLOW * 0.5 : 0.008 + GLOW * 0.055) * k)); return '#' + c.getHexString(); }
  // Ring Crystal: a pale faceted shell with a brighter core glowing through it
  function crystalMats(pal) {
    const key = 'x' + JSON.stringify(pal); if (mats[key]) return mats[key];
    // brightness rides on the emissive colour, not the intensity, so the night point lights lib.js hangs on every glowing
    // part (weighted by emissiveIntensity) stay soft and only tint the chitin next to the shards
    // by day the core is only a soft light inside the glass, so the shards read as violet crystal, not as lamps;
    // from dusk the core burns near-white
    const k = pal.k ?? 1, B = k * (NIGHTISH ? 0.3 + GLOW * 1.25 : 0.06 + GLOW * 0.55);
    const shell = new THREE.MeshPhysicalMaterial({ color: pal.shell, emissive: new THREE.Color(pal.core).multiplyScalar(k * (NIGHTISH ? 0.02 + GLOW * 0.32 : 0.01 + GLOW * 0.1)), emissiveIntensity: 1, roughness: 0.22, metalness: 0, flatShading: true,
      clearcoat: 0.6, clearcoatRoughness: 0.1, transparent: true, opacity: pal.opacity ?? 0.8, depthWrite: true, side: THREE.FrontSide, specularIntensity: 0.6 });
    shell.envMapIntensity = 0.55;
    const coreCol = NIGHTISH ? new THREE.Color(pal.core) : new THREE.Color(pal.shell).lerp(new THREE.Color(pal.core), pal.dayCore ?? 0.45);
    const core = new THREE.MeshStandardMaterial({ color: coreCol, emissive: new THREE.Color(pal.core).multiplyScalar(B / 0.3), emissiveIntensity: 0.3, roughness: 0.3, flatShading: true });
    // by day only a faint lilac shimmer blooms off the shards; at night the full near-white light
    core.userData.glow = dimGlow(NIGHTISH ? (pal.glow || pal.core) : '#' + new THREE.Color(pal.glow || pal.core).lerp(new THREE.Color(pal.shell), 0.35).getHexString(), k);
    return (mats[key] = { shell, core });
  }

  // ---- geometry helpers
  const V = (a) => new THREE.Vector3(...a);
  const UP = new THREE.Vector3(0, 1, 0);
  // a banded body segment (an ellipsoid whose surface steps like overlapping plates), with its own vertex colours.
  // o: { bands, depth, axisFlat (0..1 flattens the belly), lump, crease (dorsal midline groove), shade (seam darkening) }
  function segGeo(rx, ry, rz, o = {}) {
    const g = new THREE.SphereGeometry(1, o.ws ?? 72, o.hs ?? 40);
    const pos = g.attributes.position, col = new Float32Array(pos.count * 3), v = new THREE.Vector3();
    const bands = o.bands ?? 0, dep = o.depth ?? 0.06, lump = o.lump ?? 0.02, crease = o.crease ?? 0, sh = o.shade ?? 0.45, taper = o.taper ?? 0;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const t = (v.x + 1) / 2;                                   // 0 at the back, 1 at the front
      let k = 1, seam = 0;
      if (bands) {
        const u = (t * bands) % 1, w = 0.1;
        const prof = u < w ? u / w : Math.pow(1 - (u - w) / (1 - w), 1.4);   // each plate's rear lip stands proud
        k += dep * (prof - 0.5); seam = u < w ? 1 - u / w : 0; if (u > w && u < w + 0.12) seam = -0.5 * (1 - (u - w) / 0.12);
      }
      if (crease) { const c = Math.exp(-(v.z * v.z) / (crease * crease)) * Math.max(0, v.y); k -= 0.06 * c; }
      k += lump * nz(v.x * 2.5 + (o.seed ?? 0), v.y * 2.5, v.z * 2.5);
      let x = v.x * k, y = v.y * k, z = v.z * k;
      if (taper) { const s = 1 - taper * (1 - t); y *= s; z *= s; }            // narrower towards the back
      if (y < 0) y *= (1 - (o.axisFlat ?? 0.45));
      pos.setXYZ(i, x * rx, y * ry, z * rz);
      const belly = Math.max(0, Math.min(1, (v.y + 0.35) / 0.9)), b = Math.min(1.25, (0.45 + 0.55 * belly) * (1 - sh * seam));
      col[i * 3] = b; col[i * 3 + 1] = b; col[i * 3 + 2] = b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
    return g;
  }
  function seg(parent, at, rx, ry, rz, mat, o = {}) {
    const m = L.mesh(segGeo(rx, ry, rz, o), mat, at[0], at[1], at[2], { parent });
    if (o.rot) m.rotation.set(...o.rot); return m;
  }
  // tapered, slightly bulging limb piece from a to b (a lathe, so it has round ends)
  function limb(parent, a, b, r0, r1, mat, o = {}) {
    const A = V(a), B = V(b), len = A.distanceTo(B), pts = [], N = 10, bul = o.bulge ?? 0.15;
    pts.push(new THREE.Vector2(0.0001, -r0 * 0.6));
    for (let i = 0; i <= N; i++) { const t = i / N; const rr = (r0 + (r1 - r0) * t) * (1 + bul * Math.sin(Math.PI * t)); pts.push(new THREE.Vector2(rr, t * len)); }
    pts.push(new THREE.Vector2(0.0001, len + r1 * 0.6));
    const g = new THREE.LatheGeometry(pts, o.seg ?? 12);
    const m = L.mesh(g, mat, A.x, A.y, A.z, { parent, dirt: o.dirt ?? 0.15, dirtH: len });
    m.quaternion.setFromUnitVectors(UP, B.clone().sub(A).normalize());
    return m;
  }
  // a chain of limb pieces through points (antennae, palps, mandibles), radius tapering r0 -> r1, knobbed joints
  function chain(parent, pts, r0, r1, mat, o = {}) {
    const n = pts.length - 1, out = [];
    for (let i = 0; i < n; i++) {
      const ra = r0 + (r1 - r0) * (i / n), rb = r0 + (r1 - r0) * ((i + 1) / n);
      out.push(limb(parent, pts[i], pts[i + 1], ra, rb, (o.tipMat && i === n - 1) ? o.tipMat : mat, { bulge: o.bulge ?? 0.12, seg: o.seg ?? 10, dirt: 0.1 }));
      if (o.knob && i > 0) L.sphere(ra * o.knob, o.knobMat || mat, pts[i][0], pts[i][1], pts[i][2], { parent, dirt: 0 });
    }
    return out;
  }
  // one smooth tapered tube along a curve through control points (mandibles, antennae, palps, tusks)
  // rf(t) gives the radius along it (t 0..1); closed with round caps
  function tube(parent, ctrl, rf, mat, o = {}) {
    const c = new THREE.CatmullRomCurve3(ctrl.map(V)), N = o.n ?? 24, R = o.radial ?? 10;
    const fr = c.computeFrenetFrames(N, false), pos = [], idx = [], uv = [];
    const ring = (i, rr, p) => { for (let j = 0; j <= R; j++) { const a = j / R * Math.PI * 2, n = fr.normals[i].clone().multiplyScalar(Math.cos(a)).add(fr.binormals[i].clone().multiplyScalar(Math.sin(a))); pos.push(p.x + n.x * rr, p.y + n.y * rr, p.z + n.z * rr); uv.push(j / R, i / N); } };
    for (let i = 0; i <= N; i++) ring(i, Math.max(0.0005, rf(i / N)), c.getPointAt(i / N));
    for (let i = 0; i < N; i++) for (let j = 0; j < R; j++) { const a = i * (R + 1) + j, b = a + R + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    // caps
    for (const [i, sgn] of [[0, -1], [N, 1]]) { const p = c.getPointAt(i / N), t = fr.tangents[i].clone().multiplyScalar(sgn * rf(i / N) * 0.6), k = pos.length / 3; pos.push(p.x + t.x, p.y + t.y, p.z + t.z); uv.push(0.5, i / N); const base = i * (R + 1); for (let j = 0; j < R; j++) sgn < 0 ? idx.push(k, base + j + 1, base + j) : idx.push(k, base + j, base + j + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    return L.mesh(g, mat, 0, 0, 0, { parent, dirt: o.dirt ?? 0.1, dirtH: 0.6 });
  }
  // a smooth curve through control points, resampled to n points
  function curve(ctrl, n) { const c = new THREE.CatmullRomCurve3(ctrl.map(V)); return c.getPoints(n).map(p => [p.x, p.y, p.z]); }
  function cone(parent, base, dir, len, rad, mat, o = {}) {
    const g = new THREE.ConeGeometry(rad, len, o.seg ?? 8, 1); g.translate(0, len / 2, 0);
    const m = L.mesh(g, mat, base[0], base[1], base[2], { parent, dirt: o.dirt ?? 0.1, dirtH: len });
    m.quaternion.setFromUnitVectors(UP, V(dir).normalize()); return m;
  }

  // ---- Ring Crystal shard: an irregular hexagonal prism with a pointed tip; shell + glowing core; a chitin socket
  // collar where it breaks out through the shell. base is sunk into the body; dir is its growth direction.
  function shardGeo(len, rad, rs) {
    const body = new THREE.CylinderGeometry(rad * 0.86, rad, len * 0.66, 6, 1); body.translate(0, len * 0.33, 0);
    const tip = new THREE.ConeGeometry(rad * 0.86, len * 0.34, 6, 1); tip.translate(0, len * 0.66 + len * 0.17, 0);
    const g = mergeGeometries([body.toNonIndexed(), tip.toNonIndexed()]);
    // jitter each corner a little so no two shards are alike
    const p = g.attributes.position, key = (x, y, z) => `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`, off = new Map();
    for (let i = 0; i < p.count; i++) { const k = key(p.getX(i), p.getY(i), p.getZ(i)); if (!off.has(k)) off.set(k, [(rs() - 0.5) * rad * 0.35, (rs() - 0.5) * len * 0.05, (rs() - 0.5) * rad * 0.35]); const d = off.get(k); p.setXYZ(i, p.getX(i) + d[0], p.getY(i) + d[1], p.getZ(i) + d[2]); }
    g.computeVertexNormals(); return g;
  }
  function shard(parent, base, dir, len, rad, pal, o = {}) {
    const { shell, core } = crystalMats(pal), q = new THREE.Quaternion().setFromUnitVectors(UP, V(dir).normalize());
    const rs = () => L.rnd();
    const g = shardGeo(len, rad, rs); g.rotateY(L.rnd() * 6.28);
    const m = L.mesh(g, shell, base[0], base[1], base[2], { parent, dirt: 0, cast: true }); m.quaternion.copy(q); m.renderOrder = 2;
    const cg = new THREE.CylinderGeometry(rad * 0.38, rad * 0.5, len * 0.78, 6, 1); cg.translate(0, len * 0.39, 0);
    const c = L.mesh(cg, core, base[0], base[1], base[2], { parent, dirt: 0, cast: false }); c.quaternion.copy(q);
    if (o.collar !== false && o.collarMat) {
      const cl = new THREE.CylinderGeometry(rad * 1.25, rad * 1.7, len * 0.16, 7, 1, true); cl.translate(0, len * 0.06, 0);
      const k = L.mesh(cl, o.collarMat, base[0], base[1], base[2], { parent, dirt: 0.3, dirtH: len * 0.16 }); k.quaternion.copy(q); k.material.side = THREE.DoubleSide;
    }
    return m;
  }
  // a cluster of shards fanning out of one spot
  function cluster(parent, base, dir, n, len, rad, pal, spread = 0.45, o = {}) {
    const D = V(dir).normalize(), a = new THREE.Vector3().crossVectors(D, Math.abs(D.y) < 0.9 ? UP : new THREE.Vector3(1, 0, 0)).normalize(), b = new THREE.Vector3().crossVectors(D, a);
    for (let i = 0; i < n; i++) {
      const th = (i / n) * 6.283 + L.rnd() * 0.8, s = i === 0 ? 0 : spread * (0.6 + L.rnd() * 0.5);
      const d = D.clone().add(a.clone().multiplyScalar(Math.cos(th) * s)).add(b.clone().multiplyScalar(Math.sin(th) * s)).normalize();
      const k = i === 0 ? 1 : 0.55 + L.rnd() * 0.35;
      const bp = [base[0] + (Math.cos(th) * a.x + Math.sin(th) * b.x) * rad * (i ? 1.1 : 0), base[1] + (Math.cos(th) * a.y + Math.sin(th) * b.y) * rad * (i ? 1.1 : 0), base[2] + (Math.cos(th) * a.z + Math.sin(th) * b.z) * rad * (i ? 1.1 : 0)];
      shard(parent, bp, [d.x, d.y, d.z], len * k, rad * (0.7 + 0.3 * k), pal, { ...o, collar: i === 0 && o.collar !== false });
    }
  }

  // ---- gait: legs listed front to back, alternating sides (L1,R1,L2,R2,...). Two alternating groups (tripod for six
  // legs, alternating tetrapod for eight). f = 0..3 steps a quarter stride.
  function legPhase(i, f, nLegs) {
    const pair = Math.floor(i / 2), side = i % 2, grp = (pair + side) % 2;
    const ph = f * Math.PI / 2 + Math.PI / 4 + grp * Math.PI;
    return [Math.cos(ph), Math.max(0, -Math.sin(ph))];         // fore/aft (-1..1), lift (0..1)
  }
  // one leg: hip -> knee (femur) -> ankle (tibia) -> foot (tarsus). spec: { hip, foot, kneeUp, kneeOut, r, mats, spines }
  function leg(parent, hip, foot, o) {
    const s = Math.sign(foot[2]) || 1;
    const knee = [hip[0] + (foot[0] - hip[0]) * (o.kneeT ?? 0.42) + (o.kneeFwd ?? 0), hip[1] + o.kneeUp, hip[2] + (foot[2] - hip[2]) * (o.kneeT ?? 0.42) + s * (o.kneeOut ?? 0)];
    const ank = [foot[0] + (knee[0] - foot[0]) * (o.ankT ?? 0.26), foot[1] + (o.ankUp ?? 0.18), foot[2] + (knee[2] - foot[2]) * (o.ankT ?? 0.26)];
    const r = o.r;
    limb(parent, hip, knee, r * 1.15, r * 0.95, o.mat, { bulge: o.bulge ?? 0.28 });
    L.sphere(r * 1.0, o.jointMat || o.mat, knee[0], knee[1], knee[2], { parent, dirt: 0 });
    limb(parent, knee, ank, r * 0.9, r * 0.6, o.mat, { bulge: 0.12 });
    L.sphere(r * 0.62, o.jointMat || o.mat, ank[0], ank[1], ank[2], { parent, dirt: 0 });
    limb(parent, ank, foot, r * 0.55, r * 0.22, o.tipMat || o.mat, { bulge: 0.05 });
    if (o.spines) for (const t of [0.35, 0.6, 0.85]) {          // backward-pointing tibial spines
      const p = [knee[0] + (ank[0] - knee[0]) * t, knee[1] + (ank[1] - knee[1]) * t, knee[2] + (ank[2] - knee[2]) * t];
      cone(parent, p, [-0.6, 0.5, s * 0.5], r * 0.9 * o.spines, r * 0.18, o.tipMat || o.mat);
    }
    if (o.claw) cone(parent, foot, [1, -0.1, s * 0.4], r * 0.9, r * 0.2, o.tipMat || o.mat);
    if (o.shin) {                                                   // an armour plate riding on the outside of the shin
      const A = V(knee), B = V(ank), mid = A.clone().lerp(B, 0.45), len = A.distanceTo(B);
      const g = segGeo(len * 0.4, r * 0.45, r * 0.75, { lump: 0.05, axisFlat: 0.8, seed: hip[0] * 7 + s });
      const m = L.mesh(g, o.shin, mid.x, mid.y + r * 0.45, mid.z, { parent });
      m.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), B.clone().sub(A).normalize());
    }
    return { knee, ank };
  }
  function legs(parent, list, f, o) {
    list.forEach(([hip, foot, extra = {}], i) => {
      const [fa, lift] = legPhase(i, f, list.length), st = (extra.stride ?? o.stride);
      const F = [foot[0] + fa * st, foot[1] + lift * o.lift, foot[2] - Math.sign(foot[2]) * lift * o.lift * 0.6];
      leg(parent, hip, F, { ...o, ...extra, kneeUp: (extra.kneeUp ?? o.kneeUp) + lift * o.lift * 0.5 });
    });
  }

  // ---- cameras
  // top-down sprite (orthographic, facing +x, W world units across), toned like robkit.js; or a perspective hero shot
  function camera(W, hero) {
    let cam;
    if (hero) {
      cam = new THREE.PerspectiveCamera(hero.fov ?? 28, 1, 0.5, 200);
      cam.position.set(...hero.pos); cam.lookAt(...hero.at);
    } else {
      cam = new THREE.OrthographicCamera(-W / 2, W / 2, W / 2, -W / 2, 0.1, 100);
      cam.position.set(0, 40, 0); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0);
    }
    cam.updateMatrixWorld(); cam.updateProjectionMatrix(); L.useCamera(cam);
    if (!hero) L.getScene().traverse(o => { if (o.isDirectionalLight) o.intensity *= o.castShadow ? 0.58 : 0.6; if (o.isHemisphereLight) o.intensity *= 0.7; });
    return cam;
  }

  return { THREE, TOD, GLOW, NIGHTISH, nz, tube, chitinMap, chitin, crust, plain, eye, glowMat, dimGlow, crystalMats, segGeo, seg, limb, chain, curve, cone, shard, cluster, leg, legs, legPhase, camera, V };
}

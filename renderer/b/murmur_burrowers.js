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
  const dim = (hex, k) => '#' + [1, 3, 5].map(i => Math.round(Math.min(255, parseInt(hex.slice(i, i + 2), 16) * k)).toString(16).padStart(2, '0')).join('');   // in sRGB

  // ---- smooth pseudo-noise from random plane waves
  function makeNoise(seed) {
    let s = seed; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    const W = []; for (let i = 0; i < 16; i++) { const th = r() * 6.283, ph = Math.acos(2 * r() - 1); W.push([Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th), 1 + r() * 3.2, r() * 6.283]); }
    return (x, y, z) => { let v = 0, w = 0; for (const [a, b, c, fr, o] of W) { const amp = 1 / fr; v += Math.sin((a * x + b * y + c * z) * fr + o) * amp; w += amp; } return v / w; };
  }
  const nz = makeNoise(3301 + V.length * 17), nz2 = makeNoise(9917);

  // ---- palettes per region. Glow is amber (not a team colour); the Bloom variant glows violet as the lore says.
  const PAL = {
    base:  { plate: '#43342b', edge: '#a3896c', tuck: '#17110f', dust: '#b8a083', mem: '#a8806c', memD: '#4a322c', leg: '#4a3a31', tip: '#d6c09e', glow: '#ffa526', core: '#ffe6a0', pore: '#ff9c22' },
    rust:  { plate: '#8e4620', edge: '#dc8c4c', tuck: '#33140a', dust: '#c98f62', mem: '#7c4434', memD: '#3c1f18', leg: '#4f2516', tip: '#e2b27c', glow: '#ff9622', core: '#ffd68a', pore: '#ff8a1c' },
    white: { plate: '#b9c1c5', edge: '#eef2f4', tuck: '#5f6a70', dust: '#f6faff', mem: '#c9b3ac', memD: '#7c6a66', leg: '#a7a19b', tip: '#eee9e1', glow: '#ffcf78', core: '#fff3d0', pore: '#ffc870' },
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
    for (let i = 0; i < 0; i++) {      // (growth lines: off, they read as woven cloth)
      const y = RR(0, n), a = RR(-0.25, 0.25); g.strokeStyle = `rgba(0,0,0,${RR(0.04, 0.12)})`; hg.strokeStyle = `rgba(160,160,160,${RR(0.3, 0.6)})`; g.lineWidth = hg.lineWidth = RR(1, 2.5);
      for (const k of [g, hg]) { k.beginPath(); k.moveTo(0, y); k.bezierCurveTo(n * 0.3, y + a * 80, n * 0.7, y - a * 80, n, y); k.stroke(); }
    }
    L.blotches(g, n, 60, 30, 120, 0.1); L.blotches(g, n, 30, 20, 90, 0.08, '255,250,240');
    for (let i = 0; i < 900; i++) {   // pits
      const x = RR(0, n), y = RR(0, n), r = RR(1.2, 3.6);
      g.fillStyle = `rgba(20,14,10,${RR(0.06, 0.2)})`; g.beginPath(); g.ellipse(x, y, r, r * RR(0.6, 1), RR(0, 3), 0, 7); g.fill();
      hg.fillStyle = `rgba(50,50,50,${RR(0.3, 0.6)})`; hg.beginPath(); hg.arc(x, y, r, 0, 7); hg.fill();
    }
    for (let i = 0; i < 60; i++) { g.strokeStyle = `rgba(255,255,255,${RR(0.08, 0.22)})`; g.lineWidth = 1; const x = RR(0, n), y = RR(0, n); g.beginPath(); g.moveTo(x, y); g.lineTo(x + RR(-40, 40), y + RR(-10, 10)); g.stroke(); }
    L.speckle(g, n, 2500, 0.08);
    const map = new THREE.CanvasTexture(c); map.wrapS = map.wrapT = THREE.RepeatWrapping; map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
    return (_detail = { map, normal: heightToNormal(h, 1.4) });
  }
  const chitin = (rough = 0.66, clear = 0.18) => {
    const d = detail(); const m = new THREE.MeshPhysicalMaterial({ color: '#ffffff', map: d.map, normalMap: d.normal, roughness: rough, metalness: 0, clearcoat: clear, clearcoatRoughness: 0.6, vertexColors: true });
    m.normalScale.set(0.9, 0.9); m.envMapIntensity = 0.15; return m;
  };
  const flesh = (hex, rough = 0.5) => { const m = new THREE.MeshPhysicalMaterial({ color: hex, roughness: rough, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.35, sheen: 0.25, sheenColor: new THREE.Color(P.memD), vertexColors: true }); m.envMapIntensity = 0.3; return m; };
  const glowMat = (hex, k, glowHex) => { const m = new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: k, roughness: 0.3 }); m.userData.glow = glowHex || hex; return m; };
  // bioluminescent pores: dim by day, bright at night
  const poreMat = () => { if (NIGHT) return glowMat(P.pore, 2.6, P.pore);
    return M.plain(dim(P.pore, 0.16), 0.5); };
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
    const sweep = o.sweep ?? 0.25, front = o.front ?? 0.2, keel = o.keel ?? 0.05, rim = o.rim ?? 0.06, pw = o.pw ?? 1.1;
    const rearIn = o.rearIn ?? 0, notch = o.notch ?? 0, lipF = o.lipF ?? 0, ribN = o.ribN ?? 0, ribH = o.ribH ?? 0;
    const lift = o.lift ?? (o.shield ? 0.02 : 0.12), flare = o.flare ?? (o.shield ? 0 : 0.06), th = o.th ?? Math.max(0.06, H * 0.16);
    const pal = o.pal || P, A = col(pal.plate), E = col(pal.edge), T = col(pal.tuck), D = col(pal.dust);
    // the top surface; the plate is a shell of thickness th under it, closed by walls round its outline
    const S = (u, v) => {
      const av = Math.abs(v);
      const xr = -Lh / 2 + rearIn * (1 - av * av) - sweep * Math.pow(av, o.sweepP ?? 3) + (o.ragged ?? 0.035) * Lh * nz2(v * 6 + x * 3, 2, z * 3);
      const xf = Lh / 2 - front * av * av - notch * Math.exp(-v * v / 0.012) + (o.wavy ?? 0) * Math.sin(v * Math.PI * 7.5) * (1 - av * 0.5);
      const xx = xr + (xf - xr) * u;
      const wz = o.shield ? 1 - (o.taperF ?? 0) * Math.pow(u, 0.8) - (o.taperR ?? 0) * Math.pow(1 - u, 2) : 1 - (o.taperF ?? 0) * sstep(o.slide0 ?? 0.62, 1, u) - (o.taperR ?? 0) * Math.pow(1 - u, 3);
      const zz = v * Wd / 2 * wz;
      const dome = Math.pow(Math.max(0, 1 - av * av), pw);
      let yy;
      if (o.shield) yy = H * dome * (0.82 + 0.18 * Math.sin(Math.PI * Math.min(1, u * 1.4))) * (1 - (o.dip ?? 0.2) * u * u) + lift;
      else          // trunk plates: level along the body, the rear edge lifted and its corners flared, the front sliding under the plate ahead
        yy = (H * dome + lift + flare * Math.pow(av, 3) * (1 - sstep(0, 0.6, u))) * (1 - (o.slide ?? 0.75) * sstep(o.slide0 ?? 0.62, 0.9, u));
      yy += keel * Math.exp(-v * v / 0.02) * dome * (o.shield ? 0.4 + 0.6 * u : 1)
        + rim * Math.exp(-Math.pow(u / 0.08, 2)) * Math.pow(dome, 0.3) + lipF * Math.exp(-Math.pow((1 - u) / 0.08, 2)) * Math.pow(dome, 0.3);
      if (ribN) yy += ribH * Math.pow(0.5 + 0.5 * Math.cos(v * Math.PI * ribN), 5) * dome * sstep(0.1, 0.8, u);
      yy += (o.bumpy ?? 0.025) * nz(xx * 3.1 + x * 1.7, 1, zz * 3.1 + z * 1.3) * dome;
      return [xx, yy, zz, dome];
    };
    const pos = [], uv = [], cl = [], idx = [], ou = rnd() * 4, ov = rnd() * 4, tone = 0.9 + 0.2 * rnd();
    const R = NV + 1, NT = (NU + 1) * R;
    for (const top of [true, false]) for (let i = 0; i <= NU; i++) for (let j = 0; j <= NV; j++) {
      const u = i / NU, v = -1 + 2 * j / NV, av = Math.abs(v), [px, py0, pz, dome] = S(u, v);
      const py = top ? py0 : py0 - th * (0.3 + 0.7 * Math.sqrt(dome));
      pos.push(px, py, pz); uv.push(px * 0.45 + ou, pz * 0.45 + ov);
      let c;
      if (!top) c = T.clone().lerp(E, 0.25);
      else {
        c = A.clone().multiplyScalar(tone * (0.86 + 0.32 * (0.5 + nz2(px * 2.2 + x * 1.3, 4, pz * 2.2 + z * 1.1))));
        c.lerp(E, clamp(sstep(0.8, 1, av) * 0.4 + (o.shield ? 0 : Math.exp(-Math.pow(u / 0.05, 2)) * 0.8) + (o.wearF ?? 0) * sstep(0.8, 1, u)));
        if (!o.shield) c.lerp(T, sstep(0.06, 0.09, u) * (1 - sstep(0.14, 0.22, u)) * 0.5 * (o.band ?? 1));
        if (ribN) c.multiplyScalar(0.78 + 0.3 * Math.pow(0.5 + 0.5 * Math.cos(v * Math.PI * ribN), 3));
        if (!o.shield) c.lerp(T, sstep(0.66, 0.85, u) * (o.tuckK ?? 0.6));
        const dn = clamp((nz(px * 1.6 + x, 5, pz * 1.6 + z) + 0.02) * 2.4) * (o.dust ?? 0.55);
        c.lerp(D, dn * sstep(0.05, 0.5, dome));
        if (!o.shield) c.lerp(D, Math.exp(-v * v / 0.012) * (o.keelDust ?? 0.35) * sstep(0.12, 0.3, u) * (1 - sstep(0.5, 0.62, u)));
        if (o.paintFn) o.paintFn(c, u, v, px, pz);
        if (Q.get('dbg')) c.setRGB(1 - u, u, av > 0.9 ? 1 : 0);
      }
      cl.push(c.r, c.g, c.b);
    }
    const t = (i, j) => i * R + j, b = (i, j) => NT + i * R + j;
    for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) {
      idx.push(t(i, j), t(i, j + 1), t(i + 1, j), t(i + 1, j), t(i, j + 1), t(i + 1, j + 1));        // top, facing up
      idx.push(b(i, j), b(i + 1, j), b(i, j + 1), b(i + 1, j), b(i + 1, j + 1), b(i, j + 1));        // underside, facing down
    }
    for (let j = 0; j < NV; j++) {   // rear wall (faces -x) and front wall (faces +x)
      idx.push(t(0, j), b(0, j), t(0, j + 1), t(0, j + 1), b(0, j), b(0, j + 1));
      idx.push(t(NU, j), t(NU, j + 1), b(NU, j), t(NU, j + 1), b(NU, j + 1), b(NU, j));
    }
    for (let i = 0; i < NU; i++) {   // side walls (-z and +z)
      idx.push(t(i, 0), t(i + 1, 0), b(i, 0), t(i + 1, 0), b(i + 1, 0), b(i, 0));
      idx.push(t(i, NV), b(i, NV), t(i + 1, NV), t(i + 1, NV), b(i, NV), b(i + 1, NV));
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3)); g.setIndex(idx); g.computeVertexNormals();
    const pg = new THREE.Group(); pg.position.set(x, y, z); pg.rotation.z = rz; parent.add(pg);
    const m = addMesh(g, o.mat || chitM, pg);
    return { m, g: pg, at: (u, v) => { const [a, bb, c] = S(u, v); return new THREE.Vector3(a, bb, c).applyMatrix4(new THREE.Matrix4().compose(pg.position, pg.quaternion, pg.scale)); } };
  }


  const _throat = {};
  function throatMat(k) {   // a glowing throat: hot core, amber, then dark folds toward the lip (emissive map = glow pass)
    const key = P.glow + k; if (_throat[key]) return _throat[key];
    const tex = L.canvasTex(256, (g, n) => {
      const gr = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.14, P.core); gr.addColorStop(0.38, P.glow); gr.addColorStop(0.66, dim(P.glow, 0.28)); gr.addColorStop(0.9, '#0c0504'); gr.addColorStop(1, '#0c0504');
      g.fillStyle = gr; g.fillRect(0, 0, n, n);
      for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2 + 0.1 * Math.sin(i * 3); g.strokeStyle = 'rgba(12,4,2,0.55)'; g.lineWidth = 6; g.beginPath(); g.moveTo(n / 2 + Math.cos(a) * n * 0.16, n / 2 + Math.sin(a) * n * 0.16); g.lineTo(n / 2 + Math.cos(a) * n * 0.5, n / 2 + Math.sin(a) * n * 0.5); g.stroke(); }
    });
    const m = new THREE.MeshStandardMaterial({ color: '#000000', emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: k, roughness: 0.6 });
    m.userData.glow = '#ffffff'; return (_throat[key] = m);
  }
  // ---- the round lamprey mouth: a lobed fleshy lip, two rings of inward teeth, a throat glowing with stolen charge.
  // Faces local +y, tilted toward +x by `tilt` degrees.
  function mouth(parent, x, y, z, R, tilt, o = {}) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.z = -tilt * Math.PI / 180; if (o.yaw) g.rotation.y = o.yaw; parent.add(g);
    const lip = new THREE.TorusGeometry(R, R * 0.3, 12, 48); lip.rotateX(Math.PI / 2);
    { const p = lip.attributes.position; for (let i = 0; i < p.count; i++) { const px = p.getX(i), pz = p.getZ(i), a = Math.atan2(pz, px), k = 1 + 0.08 * Math.sin(a * 7 + 1) + 0.04 * Math.sin(a * 13); p.setXYZ(i, px * k, p.getY(i), pz * k); } lip.computeVertexNormals(); }
    paint(lip, P.memD, P.tuck, 0.6, 0.15); addMesh(lip, memM, g, 0, 0, 0, { dirt: 0 });
    const k = (o.k ?? 1) * (NIGHT ? 2.4 : 1.7);
    const th = new THREE.CircleGeometry(R * 0.92, 40); th.rotateX(-Math.PI / 2); addMesh(th, throatMat(k), g, 0, -R * 0.12, 0, { cast: false });
    const N = o.teeth ?? 12, toothM = M.plain(P.tip, 0.45);
    for (let i = 0; i < N; i++) {
      const a = i / N * Math.PI * 2, rr = R * 0.84;
      cone(R * 0.11, R * 0.46, toothM, g, [Math.cos(a) * rr, R * 0.1, Math.sin(a) * rr], [-Math.cos(a), -0.3, -Math.sin(a)], { n: 6, cast: false });
      const b = a + Math.PI / N, r2 = R * 0.6;
      if (i % 2 === 0) cone(R * 0.07, R * 0.28, toothM, g, [Math.cos(b) * r2, -R * 0.04, Math.sin(b) * r2], [-Math.cos(b), -0.6, -Math.sin(b)], { n: 5, cast: false });
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
    const kf = o.kneeFwd ?? 0;
    const knee = [hip[0] + (footFwd + dx) * 0.35 + kf, hip[1] + kneeUp + up * 0.5, s * (Math.abs(hip[2]) + footOut * (o.kneeOut ?? 0.5))];
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
  // A blind, plated centipede the size of a big dog: a spade head wider than its neck with a glowing lamprey mouth
  // under the lip, eight shingled plates with pointed, swept-back corners, sixteen jointed legs rippling in waves, and
  // two long tail feelers.
  function stud(g, p, r, pal = P) { const kb = new THREE.SphereGeometry(r, 14, 9); kb.scale(1.15, 0.7, 1); paint(kb, '#' + col(pal.plate).lerp(col(pal.edge), 0.45).getHexString(), pal.plate, 0.7, 0.5); return addMesh(kb, chitM, g, p.x, p.y - r * 0.25, p.z, { dirt: 0 }); }
  function swarmer() {
    const rust = V === 'rust', white = V === 'white', bloom = V === 'bloom';
    const fat = white ? 1.15 : rust ? 1.05 : 1, tall = white ? 1.3 : rust ? 1.2 : 1;
    const sp = spine(-4.1, 3.5, white ? 0.1 : 0.22, 0.8, 0.12);
    const XS = [1.95, 1.3, 0.62, -0.06, -0.74, -1.4, -2.05, -2.68];
    const LS = [0.95, 1.02, 0.9, 1.02, 0.9, 1.0, 0.88, 0.85];       // long / short alternation, as on a real centipede
    const WS = [1.5, 1.72, 1.82, 1.8, 1.7, 1.55, 1.36, 1.12].map(w => w * fat);
    for (let i = 0; i < XS.length; i++) { const g = segGroup(sp, XS[i] - 0.3); ell(0.48, 0.34 * tall, WS[i] * 0.4, memM, g, 0, 0.34 * tall, 0, { color: P.memD, colorB: P.tuck, colorK: 0.6 }); }
    for (let i = XS.length - 1; i >= 0; i--) {
      const g = segGroup(sp, XS[i]), W = WS[i] * (0.97 + 0.06 * rnd());
      const pl = plate({ L: LS[i], W, H: 0.5 * tall, sweep: rust ? 0.4 : 0.34, sweepP: 6, taperF: 0.25, taperR: 0.04, front: 0.1, keel: rust ? 0.12 : 0.07, rim: 0, pw: white ? 0.7 : 1.0, dust: white ? 0.85 : 0.6,
        paintFn: bloom ? bloomSpots(i) : null }, g, 0, 0.36 * tall, 0, 0);
      for (const s of [-1, 1]) if ((i + (s > 0 ? 1 : 0)) % 2 === 0 || i === 2) pore(g, pl.at(0.38 + 0.18 * rnd(), s * (0.6 + 0.16 * rnd())), 0.06 + 0.02 * rnd());
      if (rust) {   // armoured: studs along the rear rim, spurs off the corners
        for (const v of [-0.5, 0, 0.5]) stud(g, pl.at(0.14, v), 0.09);
        for (const s of [-1, 1]) { const p = pl.at(0.06, s * 0.98); cone(0.08, 0.34, chitM, g, [p.x, p.y, p.z], [-0.8, 0.12, s], { color: P.edge, colorB: P.plate }); }
      }
      if (white) frost(g, pl, 6);
      if (bloom && i % 2 === 1) bloomFronds(g, pl, 2);
      // a pair of jointed legs; front legs reach forward, rear legs trail back
      const reach = (white ? 0.62 : 0.95) * (i > 5 ? 0.92 : 1), r0 = white ? 0.1 : 0.075, fwd = [0.45, 0.3, 0.12, 0, -0.12, -0.25, -0.38, -0.5][i];
      for (const s of [-1, 1]) leg(g, [0.05, 0.3 * tall, s * W * 0.34], reach, fwd, 0.28, r0, PH + i * 0.95 + (s > 0 ? Math.PI : 0), white ? 0.12 : 0.24, white ? 0.12 : 0.22, legM, null, { kneeOut: 0.62 });
    }
    {   // tail: a small rounded plate and two long feelers
      const g = segGroup(sp, -3.28);
      ell(0.4, 0.28 * tall, 0.44 * fat, memM, g, 0.1, 0.3, 0, { color: P.memD, colorB: P.tuck });
      plate({ L: 0.78, W: 0.92 * fat, H: 0.36 * tall, sweep: -0.3, front: 0.08, rim: 0.05, keel: 0.05, pw: 1.0 }, g, 0, 0.36 * tall, 0, -0.06);
      for (const s of [-1, 1]) hook([[-0.3, 0.42, s * 0.22], [-1.0, 0.5, s * 0.42], [-1.35, 0.42, s * 0.85 + s * 0.12 * Math.sin(PH + s)]], 0.07, 0.015, legM, g, { color: P.leg, colorB: P.tip });
    }
    {   // head: a spade-shaped digging shield, wider than the neck, scraped pale at its edge; the mouth under its lip
      const g = segGroup(sp, 2.78);
      ell(0.55, 0.36 * tall, 0.6 * fat, memM, g, -0.3, 0.34, 0, { color: P.memD, colorB: P.tuck });
      const hd = plate({ shield: true, L: 1.25, W: 1.95 * fat, H: 0.55 * tall, sweep: -0.1, rearIn: 0.15, front: 0.6, keel: 0.1, rim: 0.04, dip: 0.6, lipF: 0.06, wearF: 0.75, pw: 0.9, dust: 0.7, wavy: 0.025, nv: 44,
        paintFn: bloom ? bloomSpots(9) : null }, g, 0.12, 0.46 * tall, 0, -0.13);
      for (const v of [-0.5, 0, 0.5]) { const p = hd.at(0.97, v); cone(0.1, 0.26, chitM, g, [p.x - 0.05, p.y - 0.07, p.z], [1, -0.35, v * 0.8], { color: P.tip, colorB: P.edge }); }
      for (const s of [-1, 1]) for (const u of [0.45, 0.62]) pore(g, hd.at(u, s * 0.55), 0.05);
      mouth(g, 0.9, 0.38 * tall, 0, 0.34, 60, { teeth: 10 });
      for (const s of [-1, 1]) hook([[0.55, 0.28, s * 0.5], [1.12, 0.26, s * 0.8], [1.32, 0.24, s * 0.3]], 0.09, 0.025, legM, g, { color: P.leg, colorB: P.tip });
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
    const off = FEED ? -1.25 : 0, sc = FEED ? 0.88 : 1;   // anchored, the body bunches up behind the proboscis
    const sp = spine(-3.7 * sc + off, 2.9 * sc + off, FEED ? 0.1 : 0.42, 1.05, FEED ? 0 : 0.22);
    const XS = [2.18, 1.6, 1.02, 0.44, -0.14, -0.72, -1.3, -1.88, -2.44, -2.96].map(x => x * sc + off);
    const WS = [1.38, 1.7, 2.0, 2.22, 2.3, 2.2, 1.95, 1.65, 1.4, 1.1];
    const swell = (i) => FEED ? 1 + 0.05 * Math.sin(i * 1.3) : 1 + 0.06 * Math.sin(PH - i * 0.9);
    const full = FEED ? 1 : 0.6;
    const sacM = () => {
      const m = new THREE.MeshPhysicalMaterial({ color: NIGHT ? '#ffe3a6' : dim(P.glow, 0.62), emissive: P.glow, emissiveIntensity: NIGHT ? 1.6 * full : 0.22 * full, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.1 });
      if (NIGHT) m.userData.glow = dim(P.glow, 0.55 + 0.45 * full); m.envMapIntensity = 0.6; return m;
    };
    for (let i = XS.length - 1; i >= 0; i--) {
      const g = segGroup(sp, XS[i]), W = WS[i] * swell(i);
      ell(0.42, 0.42, W * 0.48, memM, g, -0.05, 0.42, 0, { color: P.mem, colorB: P.memD, colorK: 0.75 });
      const pl = plate({ L: 0.72, W: W * 0.64, H: 0.36, sweep: 0.2, sweepP: 3, taperF: 0.12, front: 0.08, keel: 0.08, rim: 0.07, pw: 1.0, dust: 0.65 }, g, 0, 0.6, 0, -0.08);
      if (i >= 2 && i <= 6) for (const s of [-1, 1]) {   // charge blisters, uneven
        const r = 0.12 + 0.07 * (0.5 + 0.5 * Math.sin(i * 2.3 + s * 1.7)) * (FEED ? 1.25 : 1);
        ell(r * 1.25, r * 0.8, r, sacM(), g, -0.04 + 0.1 * Math.sin(i + s), 0.5, s * W * 0.38, { dirt: 0, cast: false });
      } else if (i > 0) for (const s of [-1, 1]) pore(g, pl.at(0.45, s * 0.86), 0.055);
      if (i >= 8) for (const s of [-1, 1]) {   // rear anchors: folded back while walking, splayed and driven in to feed
        const k = i === 8 ? 1 : 0.8;
        const pts = FEED
          ? [[0, 0.5, s * W * 0.4], [-0.2 * k, 0.6, s * (W * 0.5 + 0.85 * k)], [-0.6 * k, 0.02, s * (W * 0.5 + 0.95 * k)]]
          : [[0, 0.5, s * W * 0.4], [-0.55 * k, 0.5, s * (W * 0.5 + 0.55 * k)], [-1.05 * k, 0.3, s * (W * 0.5 + 0.2 * k + 0.08 * Math.sin(PH + s))]];
        hook(pts, 0.12 * k, 0.025, chitM, g, { color: P.edge, colorB: P.plate });
      }
    }
    { const g = segGroup(sp, -3.45 * sc + off); ell(0.5, 0.3, 0.42, memM, g, 0.15, 0.32, 0, { color: P.mem, colorB: P.memD });
      plate({ L: 0.8, W: 0.95, H: 0.28, sweep: -0.3, front: 0.05, keel: 0.05, rim: 0.04, pw: 1.0 }, g, -0.05, 0.42, 0, -0.05); }
    {   // head: three armoured petals round an oral sucker; closed into a digging cone while walking, opened to feed
      const g = segGroup(sp, 2.72 * sc + off);
      ell(0.55, 0.42, 0.62, memM, g, -0.1, 0.45, 0, { color: P.memD, colorB: P.tuck });
      const open = FEED ? 1 : 0;
      mouth(g, 0.48 + 0.12 * open, 0.48, 0, FEED ? 0.48 : 0.4, FEED ? 72 : 80, { teeth: 14, k: FEED ? 1.3 : 0.9 });
      const petal = (roll, w) => {
        const pg = new THREE.Group(); pg.position.set(-0.25, 0.48, 0); pg.rotation.x = roll; g.add(pg);
        const hg = new THREE.Group(); hg.rotation.z = open ? 0.8 : 0.05; pg.add(hg);
        plate({ shield: true, L: 1.2, W: w, H: 0.3, sweep: -0.15, front: 0.75, keel: 0.08, rim: 0.03, dip: 0.55, lipF: 0.03, wearF: 0.7, pw: 0.9, dust: 0.6 }, hg, 0.62, 0.14, 0, -0.1);
      };
      petal(-1.3, 0.92); petal(1.3, 0.92); petal(0, 1.08);
      const ext = FEED ? 2.3 : 0.36, p0 = new THREE.Vector3(0.62 + 0.12 * open, 0.5, 0), pm = flesh('#ffffff', 0.35);
      const curve = new THREE.CatmullRomCurve3([p0, p0.clone().add(new THREE.Vector3(ext * 0.35, 0.06, FEED ? 0.12 : 0)), p0.clone().add(new THREE.Vector3(ext * 0.7, -0.02, FEED ? -0.08 : 0)), p0.clone().add(new THREE.Vector3(ext, FEED ? -0.18 : 0, 0))]);
      const tube = (r0, r1, mat, color, colorB, rot = 0, off = 0) => {
        const N = 40, R = 12, g2 = new THREE.TubeGeometry(curve, N, 1, R, false), pos = g2.attributes.position;
        for (let i = 0; i <= N; i++) { const t = i / N, c = curve.getPointAt(t), rr = (r0 + (r1 - r0) * t) * (1 + 0.08 * Math.sin(t * 40));
          for (let j = 0; j <= R; j++) { const k = i * (R + 1) + j; const v = new THREE.Vector3().fromBufferAttribute(pos, k).sub(c).multiplyScalar(rr).add(c); pos.setXYZ(k, v.x, v.y, v.z); } }
        g2.computeVertexNormals(); if (color) paint(g2, color, colorB, 0.5, 0); return addMesh(g2, mat, g, 0, 0, 0, { cast: false });
      };
      tube(0.17, 0.08, pm, P.mem, P.memD);
      const tip = curve.getPointAt(1);
      if (FEED) for (const s of [-1, 1]) {   // two charge veins along the top of the proboscis
        const pts = []; for (let k = 0; k <= 24; k++) { const t = k / 24, c = curve.getPointAt(t), r = 0.17 + (0.08 - 0.17) * t; pts.push(c.clone().add(new THREE.Vector3(0, r * 0.82, s * r * 0.45 * Math.cos(t * 9)))); }
        const vc = new THREE.CatmullRomCurve3(pts), vg = new THREE.TubeGeometry(vc, 48, 0.026, 6, false); addMesh(vg, glowMat(P.glow, 2.4), g, 0, 0, 0, { cast: false });
      }
      ell(0.14, 0.11, 0.11, glowMat(P.core, FEED ? 3.2 : 2, P.core), g, tip.x + 0.05, tip.y, tip.z, { dirt: 0, cast: false });
      for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; cone(0.03, 0.17, M.plain(P.tip, 0.4), g, [tip.x + 0.02, tip.y + Math.cos(a) * 0.09, tip.z + Math.sin(a) * 0.09], [0.5, Math.cos(a), Math.sin(a)], { n: 5, cast: false }); }
    }
  }

  // ========================================================================================================== BRUTE
  // A wide tunnelling beast: a pale, ribbed crescent shovel-shield scraped bare at its edge, the mouth glowing in a notch
  // at its front, mole-like spade claws either side, four broad rock-rough plates with blunt knobs, glowing seams.
  function brute() {
    const sp = spine(-4.3, 3.9, 0.12, 0.6, 0.35);
    const XS = [0.45, -0.68, -1.78, -2.78], WS = [4.45, 4.05, 3.4, 2.6], LS = [1.62, 1.55, 1.5, 1.4];
    const SH = V === 'base' ? { plate: '#9c8263', edge: '#e2d2b4', tuck: '#3e2e22', dust: P.dust } : { plate: P.edge, edge: '#efe4cf', tuck: P.tuck, dust: P.dust };
    for (let i = 0; i < XS.length; i++) { const g = segGroup(sp, XS[i] - 0.4); ell(0.8, 0.75, WS[i] * 0.4, memM, g, 0, 0.75, 0, { color: P.memD, colorB: P.tuck, colorK: 0.6 }); }
    for (const [hx, hz, p0, fw] of [[-0.55, 1.75, 0, 0.15], [-1.9, 1.55, Math.PI, -0.45]]) {   // hind legs, heavy and short
      const g = segGroup(sp, hx);
      for (const s of [-1, 1]) leg(g, [0, 0.62, s * hz], 1.2, fw, 0.5, 0.26, PH + p0 + (s > 0 ? Math.PI : 0), 0.32, 0.32, legM, null, { claw: 0.32 });
    }
    for (let i = XS.length - 1; i >= 0; i--) {
      const g = segGroup(sp, XS[i]);
      const pl = plate({ L: LS[i], W: WS[i], H: 1.1, sweep: 0.5, sweepP: 6, taperF: 0.2, taperR: 0.03, front: 0.22, keel: 0.1, rim: 0, pw: 0.75, dust: 0.7, bumpy: 0.1, nu: 30, nv: 48, lift: 0.2, flare: 0.1 }, g, 0, 0.8, 0, 0);
      // warty knobs, irregular: a big pair astride the keel, smaller ones scattered toward the flanks
      for (const s of [-1, 1]) stud(g, pl.at(0.3 + RR(-0.08, 0.08), s * RR(0.12, 0.2)), RR(0.17, 0.23));
      for (let k = 0; k < 4; k++) stud(g, pl.at(RR(0.15, 0.5), (k % 2 ? 1 : -1) * RR(0.35, 0.7)), RR(0.08, 0.14));
      for (const s of [-1, 1]) for (const v of [0.7, 0.84]) pore(g, pl.at(0.05 + 0.08 * rnd(), s * v), 0.085);
    }
    { const g = segGroup(sp, -3.65); ell(0.6, 0.5, 0.8, memM, g, 0.2, 0.55, 0, { color: P.memD, colorB: P.tuck });
      plate({ L: 1.15, W: 1.75, H: 0.65, sweep: -0.4, front: 0.15, keel: 0.12, rim: 0, pw: 0.9, dust: 0.7 }, g, 0, 0.72, 0, 0);
      cone(0.22, 0.6, chitM, g, [-0.5, 0.95, 0], [-1, 0.25, 0], { color: P.edge, colorB: P.plate }); }
    {   // spade forelimbs: thick arms from under the shield, broad hands with four curved digging claws; alternate strokes
      const g = segGroup(sp, 2.0), boneM = chitin(0.5, 0.3);
      for (const s of [-1, 1]) {
        const ph = PH + (s > 0 ? Math.PI : 0), dx = 0.4 * Math.cos(ph), up = Math.max(0, -Math.sin(ph)) * 0.35;
        const sh = [-0.3, 0.8, s * 1.5], el = [0.5 + dx * 0.5, 1.0 + up * 0.5, s * 2.3], hand = [1.35 + dx, 0.5 + up, s * 2.9];
        seg(sh, el, 0.46, 0.36, legM, g, { color: P.leg, colorB: P.tuck, joint: false });
        seg(el, hand, 0.36, 0.3, legM, g, { color: P.leg, colorB: P.tuck, joint: false });
        { const A = new THREE.Vector3(...el), B = new THREE.Vector3(...hand), len = A.distanceTo(B) + 0.35;
          const fg = new THREE.SphereGeometry(1, 28, 16); fg.scale(len / 2, 0.42, 0.44); paint(fg, SH.plate, P.tuck, 0.8, 0.5);
          const fm = addMesh(fg, chitM, g, (A.x + B.x) / 2, (A.y + B.y) / 2 + 0.08, (A.z + B.z) / 2, { dirt: 0 });
          fm.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), B.clone().sub(A).normalize()); }
        const hg = new THREE.Group(); hg.position.set(...hand); hg.rotation.y = -s * 0.45; g.add(hg);
        ell(0.5, 0.24, 0.52, legM, hg, 0.05, 0, 0, { color: SH.plate, colorB: P.tuck });
        plate({ L: 0.8, W: 0.95, H: 0.18, sweep: 0.1, front: 0.2, keel: 0.03, rim: 0.05, pw: 0.5, pal: SH, dust: 0.6, wearF: 0.5 }, hg, 0.0, 0.12, 0, 0);
        for (let k = 0; k < 4; k++) { const z = -0.39 + 0.26 * k, len = 0.85 - Math.abs(z) * 0.5;
          hook([[0.3, 0.02, z], [0.3 + len * 0.8, 0.08, z * 1.25], [0.3 + len, -0.32, z * 1.35]], 0.12, 0.025, boneM, hg, { color: SH.edge, colorB: SH.plate }); }
      }
    }
    {   // the shovel-shield: a wide crescent of pale bone, ribbed, sloping to a scraped, toothed lip with a notch for the mouth
      const g = segGroup(sp, 2.05);
      ell(0.9, 0.7, 1.7, memM, g, -0.4, 0.75, 0, { color: P.memD, colorB: P.tuck });
      const sh = plate({ shield: true, L: 2.45, W: 5.3, H: 1.2, sweep: 0.15, front: 1.15, rearIn: 0.55, notch: 0.42, keel: 0.12, rim: 0.0, dip: 0.6, lipF: 0.1, wearF: 0.75, ribN: 7, ribH: 0.1, pw: 0.9, dust: 0.55, wavy: 0.03, bumpy: 0.05, nu: 40, nv: 72, pal: SH,
        paintFn: V === 'bloom' ? bloomSpots(0) : null }, g, 0.15, 0.85, 0, -0.16);
      for (const v of [-0.86, -0.66, -0.46, -0.27, 0.27, 0.46, 0.66, 0.86]) { const p = sh.at(0.985, v), k = 0.8 + 0.4 * rnd(); cone(0.13 * k, 0.32 * k, chitM, g, [p.x - 0.05, p.y - 0.08, p.z], [1, -0.5, v * 0.9], { color: SH.edge, colorB: SH.plate }); }
      for (const s of [-1, 1]) for (const [u, v] of [[0.55, 0.3], [0.62, 0.45], [0.5, 0.58]]) pore(g, sh.at(u, s * v), 0.07);
      const m = sh.at(0.98, 0); mouth(g, m.x - 0.05, 0.75, 0, 0.5, 52, { teeth: 14 });
    }
  }
  // ========================================================================================================= BURROW
  // The tunnel mouth they come out of: a crater of thrown-up soil and upthrust crust round a dark throat that slants down
  // and away, ribbed with a hardened lining, a faint amber glow far down; spoil, drained Crystal, shed plates, furrows
  // where bodies dragged, and the Bloom starting to take hold. Building camera, no pad.
  function burrow() {
    const CX = 0.1, CZ = -0.15, RH = 1.6, RO = 4.6;
    const crest = (a) => 1.0 + 0.7 * Math.max(0, -Math.sin(a)) + 0.22 * nz(Math.cos(a) * 1.4, 2, Math.sin(a) * 1.4) + 0.12 * Math.sin(a * 5 + 1);
    const prof = (a, t) => crest(a) * (t < 0.1 ? 0.78 + 0.22 * sstep(0, 0.1, t) : Math.pow(1 - sstep(0.1, 1, t), 1.35));
    const outer = (a) => RO * (1 + 0.14 * nz(Math.cos(a) * 2, 7, Math.sin(a) * 2) + 0.06 * Math.sin(a * 3));
    function groundH(x, z) { const dx = x - CX, dz = z - CZ, rr = Math.hypot(dx, dz), a = Math.atan2(dz, dx), t = (rr - RH) / (outer(a) - RH); if (t < 0) return 0.9; if (t > 1) return 0; return prof(a, t); }
    {   // the mound of thrown-out soil, wet and dark at the lip, drying pale toward its edge
      const NA = 160, NR = 40, pos = [], cl = [], idx = [], uv = [];
      const wet = col('#2e2018'), mid = col('#6a4a32'), dry = col('#a8805a');
      for (let j = 0; j <= NR; j++) for (let i = 0; i <= NA; i++) {
        const a = i / NA * Math.PI * 2, t = j / NR, rr = RH + (outer(a) - RH) * t;
        const x = CX + Math.cos(a) * rr, z = CZ + Math.sin(a) * rr;
        const y = prof(a, t) + (0.22 * nz(x * 1.9, 1, z * 1.9) + 0.08 * nz(x * 5.5, 3, z * 5.5)) * (1 - t * 0.7) * sstep(0, 0.05, t);
        pos.push(x, Math.max(0, y), z); uv.push(x * 0.4, z * 0.4);
        const c = wet.clone().lerp(mid, sstep(0.0, 0.35, t)).lerp(dry, sstep(0.3, 0.9, t) * (0.75 + 0.25 * nz(x * 2, 4, z * 2)));
        c.multiplyScalar(0.82 + 0.36 * (0.5 + nz(x * 4, 9, z * 4)));
        cl.push(c.r, c.g, c.b);
      }
      for (let j = 0; j < NR; j++) for (let i = 0; i < NA; i++) { const a = j * (NA + 1) + i, b = a + 1, c = a + NA + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
      const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, map: M.rough('#ffffff').map }); m.envMapIntensity = 0.35;
      L.mesh(g, m, 0, 0, 0, {});
    }
    // the throat: a ribbed tube from the lip, down and away (-z); dark lining, amber only far down
    const centre = (t) => new THREE.Vector3(CX, 0.75 - 4.4 * t, CZ - 2.6 * t * t);
    {
      const NA = 80, NS = 36, pos = [], cl = [], idx = [];
      const lining = col('#100a07'), rib = col('#2c1e16'), hot = col(P.glow);
      for (let j = 0; j <= NS; j++) for (let i = 0; i <= NA; i++) {
        const t = j / NS, a = i / NA * Math.PI * 2, c = centre(t);
        const ribk = Math.pow(0.5 + 0.5 * Math.cos(t * 30), 4) * (1 - t * 0.5);
        const r = (RH * (1 - 0.42 * t) - 0.07 * ribk) * (1 + 0.07 * nz(Math.cos(a) * 2, t * 4, Math.sin(a) * 2));
        const y = j === 0 ? prof(a, 0) : c.y;
        pos.push(c.x + Math.cos(a) * r, y, c.z + Math.sin(a) * r);
        const k = lining.clone().lerp(rib, ribk * 0.8).lerp(col(P.memD), 0.25 * (1 - sstep(0, 0.2, t))).lerp(hot, sstep(0.8, 1, t) * (NIGHT ? 0.5 : 0.25));
        cl.push(k.r, k.g, k.b);
      }
      for (let j = 0; j < NS; j++) for (let i = 0; i < NA; i++) { const a = j * (NA + 1) + i, b = a + 1, c = a + NA + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3)); g.setIndex(idx); g.computeVertexNormals();
      const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, side: THREE.DoubleSide }); m.envMapIntensity = 0.2;
      L.mesh(g, m, 0, 0, 0, { cast: false });
      const c = centre(0.97), fl = new THREE.CircleGeometry(RH * 0.3, 32); fl.rotateX(-Math.PI / 2);
      L.mesh(fl, glowMat(P.glow, NIGHT ? 2.2 : 1.1, NIGHT ? dim(P.glow, 0.8) : dim(P.glow, 0.45)), c.x, c.y + 0.02, c.z, { cast: false });
      L.pointLight(P.glow, NIGHT ? 4 : 1.5, c.x, c.y + 0.5, c.z + 0.3, 2.2);
      // beads of charge on the lining, brighter toward the bottom
      for (let k = 0; k < (NIGHT ? 9 : 18); k++) { const t = RR(0.2, 0.85), a = RR(0, Math.PI * 2), cc = centre(t), r = RH * (1 - 0.42 * t) - 0.06;
        const hot2 = t > 0.55; const bm = NIGHT ? glowMat(P.pore, 2.2, P.pore) : hot2 ? glowMat(P.pore, 0.9, dim(P.pore, 0.45)) : M.plain(dim(P.pore, 0.3), 0.4);
        ell(0.05 + 0.03 * rnd(), 0.05, 0.05 + 0.03 * rnd(), bm, root, cc.x + Math.cos(a) * r, cc.y, cc.z + Math.sin(a) * r, { dirt: 0, cast: false }); }
    }
    // upthrust slabs of crust tipped outward round the lip, bigger on the far side, uneven and broken
    const slabA = M.rough('#9c7550'), slabB = M.rough('#b8916a'), slabC = M.rough('#7d5c40');
    for (let i = 0; i < 20; i++) {
      const a = i / 20 * Math.PI * 2 + RR(-0.25, 0.25), far = Math.max(0, -Math.sin(a));
      if (Math.sin(a) > 0.75 && rnd() < 0.6) continue;              // keep the near lip low so the mouth shows
      const fallen = rnd() < 0.3, r = RH + (fallen ? RR(1.0, 2.2) : RR(0.25, 0.8)), w = RR(0.4, 1.15) * (0.8 + 0.6 * far) * (fallen ? 0.6 : 1), h = RR(0.14, 0.26), d = RR(0.4, 0.85) * (0.8 + 0.5 * far);
      const x = CX + Math.cos(a) * r, z = CZ + Math.sin(a) * r;
      const g = L.group(x, groundH(x, z) - 0.12, z, -a, root);
      const geo = new THREE.BoxGeometry(d, h, w, 4, 1, 4); const p = geo.attributes.position;
      for (let k = 0; k < p.count; k++) { const px = p.getX(k), pz = p.getZ(k); p.setXYZ(k, px * (1 + 0.3 * nz(px * 4 + i, 1, pz * 4)), p.getY(k) * (1 + 0.4 * nz(px * 3, i, pz * 3)), pz * (1 + 0.25 * nz(pz * 3, i, 2))); }
      geo.computeVertexNormals();
      const m = L.mesh(geo, [slabA, slabB, slabC][i % 3], 0, 0, 0, { parent: g, dirt: 0.7, dirtH: h }); m.rotation.z = fallen ? RR(-0.2, 0.3) : RR(0.45, 1.05); m.rotation.x = RR(-0.35, 0.35); m.rotation.y = RR(-0.5, 0.5);
    }
    // spoil: clods and stones thrown out, mostly toward the front-right
    const clodM = M.rough('#4e3526'), stoneM = M.rough('#9a8068');
    for (let i = 0; i < 60; i++) {
      const a = RR(-0.8, 2.6), r = RR(RH + 1.0, RO + 1.2), s = RR(0.05, 0.2) * (1.5 - r / (RO + 1.4));
      const x = CX + Math.cos(a) * r, z = CZ + Math.sin(a) * r;
      const geo = new THREE.DodecahedronGeometry(s, 0); geo.scale(1, 0.65, 1);
      const m = L.mesh(geo, rnd() < 0.7 ? clodM : stoneM, x, groundH(x, z) + s * 0.25, z, { dirt: 0.3 }); m.rotation.y = RR(0, 3);
    }
    // drained Crystal: grey, cracked shards, one still faintly lit
    const deadX = new THREE.MeshStandardMaterial({ color: '#6a6470', roughness: 0.35, metalness: 0.1, flatShading: true }); deadX.envMapIntensity = 1.1;
    const halfX = M.crystal('#9a7cc0', NIGHT ? '#a57cff' : '#3a2a55', NIGHT ? 0.8 : 0.3);
    for (const [x, z, r, len, rx, rz, mat] of [[-3.2, 0.7, 0.26, 1.1, 0.25, 0.45, deadX], [-3.55, 0.05, 0.19, 0.75, -0.25, 0.7, deadX], [-2.75, 1.35, 0.17, 0.6, 0.5, -0.15, halfX], [-3.05, 1.6, 0.12, 0.45, 0.2, 0.3, deadX], [3.05, -2.2, 0.2, 0.8, -0.4, -0.5, deadX]])
      L.crystal(r, len, r * 1.6, mat, x, groundH(x, z) - 0.06, z, rx, rz);
    // a shed Swarmer plate and a broken one, at the creatures' true size
    for (const [x, z, ry, sc] of [[2.45, 1.75, 0.6, 0.32], [2.9, 1.25, 2.2, 0.26]]) {
      const g = L.group(x, groundH(x, z) + 0.02, z, ry, root); g.scale.setScalar(sc);
      plate({ L: 0.98, W: 1.8, H: 0.42, sweep: 0.34, sweepP: 6, front: 0.1, keel: 0.07, rim: 0, pal: { plate: '#8f7b66', edge: '#d2c0a2', tuck: '#55463a', dust: '#c9a97e' }, dust: 0.8 }, g, 0, 0, 0, 0.1);
    }
    // the Bloom taking hold on the far-left side: violet fronds and bulbs (glow at night)
    const bm = NIGHT ? glowMat('#e2a0ff', 1.8, '#c46bff') : glowMat('#b07ad2', 0.3, '#2e1544'), stalk = M.plain('#4a3352', 0.6);
    for (let i = 0; i < 8; i++) {
      const a = RR(3.5, 4.6), r = RR(RH + 1.1, RO - 0.4), x = CX + Math.cos(a) * r, z = CZ + Math.sin(a) * r, y0 = groundH(x, z);
      for (let j = 0; j < 6; j++) { const b = RR(0, 6.28), len = RR(0.2, 0.5);
        hook([[x, y0 - 0.03, z], [x + Math.cos(b) * 0.06, y0 + len * 0.8, z + Math.sin(b) * 0.06], [x + Math.cos(b) * len * 0.5, y0 + len, z + Math.sin(b) * len * 0.5]], 0.028, 0.012, stalk, root, { cast: false });
        ell(0.06, 0.07, 0.06, bm, root, x + Math.cos(b) * len * 0.5, y0 + len, z + Math.sin(b) * len * 0.5, { dirt: 0, cast: false }); }
    }
    // ground decal: a damp halo of disturbed soil and the furrows where segmented bodies dragged
    {
      const n = 1024, S = 11;
      const tex = L.canvasTex(n, (g) => {
        const img = g.createImageData(n, n), Dd = img.data;
        const trails = [0.45, 1.35, 2.35, 3.75, 5.3].map(a => a + RR(-0.2, 0.2));
        for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
          const wx = (x / n - 0.5) * S, wz = (y / n - 0.5) * S, dx = wx - CX, dz = wz - CZ, rr = Math.hypot(dx, dz), a = Math.atan2(dz, dx);
          let al = 0, R0 = 0x52, G0 = 0x3a, B0 = 0x28;
          const ro = outer(a), halo = 1 - sstep(ro * 0.9, ro + 0.9 + 0.4 * nz(Math.cos(a) * 2, 1, Math.sin(a) * 2), rr); al = Math.max(al, halo * 0.5);
          for (const ta of trails) {
            const wig = ta + 0.1 * Math.sin(rr * 1.8 + ta * 3); const da = Math.abs(((a - wig + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
            const off = da * rr, w = 0.26 * (1 - sstep(ro, ro + 2.2, rr));
            if (off < w && rr > ro * 0.8) { const k = 1 - off / w, ring = 0.5 + 0.5 * Math.cos(rr * 10); al = Math.max(al, (0.22 + 0.2 * ring) * Math.sqrt(k) * (1 - sstep(ro + 1.0, ro + 2.2, rr))); R0 -= 8 * ring; G0 -= 6 * ring; }
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

// The Murmur, design direction C, "Mycelial": the shared kit for murmur_mycelial.js.
// Soft, dark, jelly-fungus flesh with veins of bioluminescence running through it (an emissive map drawn in top-down
// space, so the veins line up with the sprite), root-like tendrils instead of legs, smoky quartz growths with a glowing
// core, pale fruiting caps and shelf fungi, fibrous bark tissue, and the cameras (top-down sprite or a 3/4 hero shot).
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export function mkit(L) {
  const { THREE } = L;
  const Q = new URLSearchParams(location.search);
  const TOD = L.TOD;
  // the creatures' own light: dim by day, bright at night (the game swaps in the night sprites)
  const GLOW = { day: 0.5, morning: 0.6, evening: 1.1, night: 1.5 }[TOD] ?? 0.5;
  // the vein web through the flesh and the threads along the roots: only faint lines by day, so the dark body and its
  // few lit points (feeler tips, eyes, charge sacs) carry the sprite; at night the whole web lights up
  const VEIN = { day: 0.22, morning: 0.3, evening: 0.9, night: 1.25 }[TOD] ?? 0.22;
  const NIGHT = TOD === 'night' || TOD === 'evening';
  const V = Q.get('v') || 'base';

  // ---- palettes. Glow is foxfire lemon (no team uses yellow); the Bloom variant glows violet as the lore says.
  const PALS = {
    base:  { core: '#1b1f1c', body: '#2c332d', rim: '#8e8a6c', sheen: '#9c9a80', root: '#3a2b22', rootTip: '#d8ccae', crys: '#a29b87', crysD: '#5e594f',
             cap: '#d9c9a0', capRim: '#8a6a44', gill: '#4a3a2c', bark: '#4f463c', barkD: '#272019', glow: '#f2f75a', hot: '#fdffd8' },
    rust:  { core: '#22160f', body: '#3c261b', rim: '#a8744f', sheen: '#b8835a', root: '#3a2216', rootTip: '#dca878', crys: '#d8a679', crysD: '#6a3f26',
             cap: '#d9b48a', capRim: '#8a4a2a', gill: '#4a2a1c', bark: '#6a3f2a', barkD: '#2e1a12', glow: '#f6f45a', hot: '#fffbd6',
             plate: '#a5532a', plateE: '#e0904f' },
    white: { core: '#55626c', body: '#8d9aa3', rim: '#d6dfe3', sheen: '#c8d4da', root: '#5e5852', rootTip: '#e6e4de', crys: '#d4e6ee', crysD: '#8aa0aa',
             cap: '#eeeae0', capRim: '#a9a196', gill: '#6e6862', bark: '#a8a49c', barkD: '#5e5a54', glow: '#e4f77a', hot: '#fbffe0' },
    bloom: { core: '#1a1020', body: '#2c1d33', rim: '#86609a', sheen: '#a77cbc', root: '#2a1a2e', rootTip: '#c9a3dc', crys: '#d7b0f0', crysD: '#5a3a7a',
             cap: '#d6c0e6', capRim: '#7a4a96', gill: '#3a2244', bark: '#4a3552', barkD: '#22162a', glow: '#e57af2', hot: '#fbe8ff' },
  };
  const P = PALS[V] || PALS.base;
  const C = h => new THREE.Color(h);
  const dimHex = (hex, k) => '#' + C(hex).multiplyScalar(k).getHexString();
  // what the glow pass (and so the bloom) sees: dim by day, full at night
  const GLOWHEX = dimHex(P.glow, (NIGHT ? 0.85 : TOD === 'morning' ? 0.55 : 0.45) * (V === 'white' ? 0.2 : 1));
  // what the glow pass sees of the veins: almost nothing by day (no bloom wash over the body), most of it at night
  const VEINHEX = dimHex(P.glow, (NIGHT ? 0.62 : TOD === 'morning' ? 0.14 : 0.1) * (V === 'white' ? 0.35 : 1));

  // ---- deterministic randomness of our own, so every walking frame builds the same creature
  let s0 = 1;
  const seed = n => { s0 = (n >>> 0) || 1; };
  const rnd = () => { s0 = (s0 * 16807) % 2147483647; return s0 / 2147483647; };
  const R = (a, b) => a + (b - a) * rnd();
  function noise3(sd, n = 14) {
    const keep = s0; seed(sd);
    const W = []; for (let i = 0; i < n; i++) { const th = rnd() * 6.283, ph = Math.acos(2 * rnd() - 1); W.push([Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th), 1 + rnd() * 3.5, rnd() * 6.283]); }
    s0 = keep;
    return (x, y, z) => { let v = 0, w = 0; for (const [a, b, c, f, o] of W) { const amp = 1 / f; v += Math.sin((a * x + b * y + c * z) * f + o) * amp; w += amp; } return v / w; };
  }
  const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  // ---- top-down texture space: canvas pixel (px,py) <-> world (x0 + px/n*S, z0 + py/n*S). Planar UVs follow it.
  let TS = { S: 10, cx: 0, cz: 0 };
  function texSpace(S, cx = 0, cz = 0) { TS = { S, cx, cz }; }
  function planarUV(g, ch = 'uv') {
    const p = g.attributes.position, uv = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) { uv[i * 2] = (p.getX(i) - TS.cx) / TS.S + 0.5; uv[i * 2 + 1] = 1 - ((p.getZ(i) - TS.cz) / TS.S + 0.5); }
    g.setAttribute(ch, new THREE.BufferAttribute(uv, 2));
  }
  function canvas(n, draw, world = true) {
    const c = document.createElement('canvas'); c.width = c.height = n; const g = c.getContext('2d');
    if (world) { g.fillStyle = '#000000'; g.fillRect(0, 0, n, n); const k = n / TS.S; g.setTransform(k, 0, 0, k, n / 2 - TS.cx * k, n / 2 - TS.cz * k); }
    draw(g, n); return c;
  }
  const texOf = (c, srgb = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };

  // a branching, wandering vein from (x,z) heading ang: a faint halo plus a bright core, in world units
  function vein(g, x, z, ang, len, w, depth, o = {}) {
    const steps = Math.max(3, Math.round(len / 0.05)); let a = ang;
    const pts = [[x, z]];
    for (let i = 0; i < steps; i++) { a += R(-0.3, 0.3) * (o.wig ?? 1); x += Math.cos(a) * len / steps; z += Math.sin(a) * len / steps; pts.push([x, z]); }
    for (const [lw, al] of [[w * 2.6, 0.13], [w * 1.6, 0.3], [w, 1]]) {
      g.strokeStyle = `rgba(255,255,255,${al * (o.alpha ?? 1)})`; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath(); pts.forEach(([px, pz], i) => i ? g.lineTo(px, pz) : g.moveTo(px, pz)); g.stroke();
    }
    // side twigs along the way
    if (depth > 0 && o.twigs !== false) for (let i = 2; i < pts.length - 1; i += 3) if (rnd() < 0.5) {
      const [px, pz] = pts[i]; vein(g, px, pz, a + (rnd() < 0.5 ? -1 : 1) * R(0.7, 1.3), len * R(0.18, 0.32), w * 0.55, 0, { ...o, twigs: false });
    }
    if (depth > 0) {
      const nb = rnd() < 0.35 ? 3 : 2;
      for (let b = 0; b < nb; b++) vein(g, x, z, a + (b - (nb - 1) / 2) * R(0.5, 0.85), len * R(0.5, 0.7), w * 0.7, depth - 1, o);
    }
  }
  function node(g, x, z, r, a = 1) {
    const gr = g.createRadialGradient(x, z, 0, x, z, r);
    gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(0.35, `rgba(255,255,255,${a * 0.6})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, z, r, 0, 7); g.fill();
  }

  // ---- materials
  // jelly-fungus flesh: dark, glossy, a sheen like wet wax on the thin edges, veins glowing through
  function flesh(emapCanvas, o = {}) {
    const m = new THREE.MeshPhysicalMaterial({ color: '#ffffff', vertexColors: true, roughness: o.rough ?? 0.4, metalness: 0,
      clearcoat: o.cc ?? 0.85, clearcoatRoughness: 0.32, sheen: (o.sheen ?? 0.7) * 0.5, sheenColor: C(P.sheen), sheenRoughness: 0.45 });
    m.envMapIntensity = o.env ?? 0.26;
    // the brightness lives in the colour so lib.js's night pass doesn't turn the whole body into one big lamp
    if (emapCanvas) { m.emissive = C(P.glow).multiplyScalar((o.k ?? 1.7) * VEIN / 0.3); m.emissiveMap = texOf(emapCanvas); m.emissiveIntensity = 0.3; m.userData.glow = VEINHEX; }
    return m;
  }
  // roots and tendrils: velvety umber, pale toward the tip (vertex colours)
  let _root = null;
  const rootMat = () => { if (_root) return _root; const m = new THREE.MeshPhysicalMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.74, metalness: 0, sheen: 0.7, sheenColor: C(P.rootTip), sheenRoughness: 0.6 }); m.envMapIntensity = 0.35; return (_root = m); };
  // a glowing thread whose light fades along its length (u of a tube)
  let _fade = {};
  function fadeTex(from, to) {
    const key = from + ',' + to; if (_fade[key]) return _fade[key];
    const c = canvas(256, (g, n) => { const gr = g.createLinearGradient(0, 0, n, 0); gr.addColorStop(0, '#ffffff'); gr.addColorStop(from, '#ffffff'); gr.addColorStop(to, '#000000'); gr.addColorStop(1, '#000000'); g.fillStyle = gr; g.fillRect(0, 0, n, n); }, false);
    return (_fade[key] = texOf(c));
  }
  function glowMat(k = 2.2, map = null, hex = P.glow, vein = false) {
    const m = new THREE.MeshStandardMaterial({ color: dimHex(hex, vein && !NIGHT ? 0.35 : 0.6), emissive: C(hex), emissiveIntensity: k * (vein ? VEIN : GLOW), roughness: 0.35, emissiveMap: map });
    if (map) m.map = map;
    m.userData.glow = vein ? VEINHEX : hex === P.glow ? GLOWHEX : dimHex(hex, NIGHT ? 1 : 0.45); return m;
  }
  // smoky quartz grown out of the flesh: faceted, glossy, glowing from the base up (emissive gradient along its length)
  let _crys = null;
  function crystalMat() {
    if (_crys) return _crys;
    const c = canvas(64, (g, n) => { const gr = g.createLinearGradient(0, n, 0, 0); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.16, '#9a9a9a'); gr.addColorStop(0.42, '#262626'); gr.addColorStop(1, '#101010'); g.fillStyle = gr; g.fillRect(0, 0, n, n); }, false);
    const m = new THREE.MeshPhysicalMaterial({ color: P.crys, roughness: 0.1, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.06, flatShading: true,
      emissive: C(P.glow), emissiveMap: texOf(c), emissiveIntensity: (V === 'white' ? 0.2 : 0.75) * VEIN });
    m.envMapIntensity = 0.75; m.userData.glow = VEINHEX; return (_crys = m);
  }
  // dark smoky quartz (the Brute's ram and boulders): glossy but deep, so it reads as crystal and not as grey rock
  const crystalDark = () => { const m = new THREE.MeshPhysicalMaterial({ color: dimHex(P.crysD, 0.7), roughness: 0.12, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.05, sheen: 0.4, sheenColor: C(P.glow).multiplyScalar(0.35), flatShading: true }); m.envMapIntensity = 0.7; return m; };
  // fruiting caps: pale, matte, finely speckled
  let _capT = null;
  function capMat() {
    if (!_capT) _capT = texOf(canvas(256, (g, n) => {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, n, n);
      for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(90,60,30,${R(0.08, 0.35)})`; g.beginPath(); g.arc(R(0, n), R(0, n), R(1, 4), 0, 7); g.fill(); }
      for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(255,255,240,${R(0.2, 0.5)})`; g.beginPath(); g.arc(R(0, n), R(0, n), R(1, 3), 0, 7); g.fill(); }
    }, false));
    const m = new THREE.MeshPhysicalMaterial({ color: '#ffffff', map: _capT, vertexColors: true, roughness: 0.58, sheen: 1, sheenColor: C('#fff6e0'), sheenRoughness: 0.5 }); m.envMapIntensity = 0.5; return m;
  }
  // fibrous bark tissue: long fibres along v, with a normal map from the same streaks
  let _bark = {};
  function barkMat(rep = 3, rot = 0) {
    const key = rep + ',' + rot; if (_bark[key]) return _bark[key];
    const n = 512, h = document.createElement('canvas'); h.width = h.height = n; const hg = h.getContext('2d');
    hg.fillStyle = '#808080'; hg.fillRect(0, 0, n, n);
    const col = canvas(n, (g) => {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, n, n);
      for (let i = 0; i < 420; i++) {
        const x = R(0, n), w = R(3, 12), y = R(-n, n), l = R(80, 420), d = R(0, 1);
        g.fillStyle = d < 0.5 ? `rgba(0,0,0,${R(0.05, 0.18)})` : `rgba(255,250,235,${R(0.03, 0.12)})`; g.fillRect(x, y, w, l); g.fillRect(x, y + n, w, l); g.fillRect(x, y - n, w, l);
        const k = d < 0.5 ? Math.round(R(70, 115)) : Math.round(R(140, 190)); hg.fillStyle = `rgb(${k},${k},${k})`; hg.fillRect(x, y, w, l); hg.fillRect(x, y + n, w, l); hg.fillRect(x, y - n, w, l);
      }
    }, false);
    // height -> normal
    const src = hg.getImageData(0, 0, n, n).data, out = document.createElement('canvas'); out.width = out.height = n;
    const og = out.getContext('2d'), od = og.createImageData(n, n), H = (x, y) => src[((((y + n) % n) * n) + ((x + n) % n)) * 4] / 255;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const gx = (H(x + 1, y) - H(x - 1, y)) * 3, gy = (H(x, y + 1) - H(x, y - 1)) * 3; let nx = -gx, ny = gy, nz = 1; const l = Math.hypot(nx, ny, nz);
      const i = (y * n + x) * 4; od.data[i] = (nx / l * 0.5 + 0.5) * 255; od.data[i + 1] = (ny / l * 0.5 + 0.5) * 255; od.data[i + 2] = (nz / l * 0.5 + 0.5) * 255; od.data[i + 3] = 255;
    }
    og.putImageData(od, 0, 0);
    const map = texOf(col), nm = texOf(out, false);
    for (const t of [map, nm]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rot ? rep : 1); if (rot) { t.center.set(0.5, 0.5); t.rotation = rot; } }
    const m = new THREE.MeshPhysicalMaterial({ color: '#ffffff', map, normalMap: nm, normalScale: new THREE.Vector2(0.55, 0.55), vertexColors: true, roughness: 0.68, sheen: 0.5, sheenColor: C(P.rootTip), sheenRoughness: 0.6 });
    m.envMapIntensity = 0.45; return (_bark[key] = m);
  }

  // ---- geometry
  // a deformed sphere: fn(dir) -> [x,y,z]; colFn(pos, dir) -> THREE.Color. Merged seam, planar top-down UVs.
  function blob(fn, colFn, mat, o = {}) {
    let g = new THREE.SphereGeometry(1, o.w ?? 128, o.h ?? 64); g.deleteAttribute('uv'); g.deleteAttribute('normal');
    g = mergeVertices(g, 1e-5);
    const p = g.attributes.position, d = new THREE.Vector3(), cols = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      d.fromBufferAttribute(p, i).normalize(); const q = fn(d.x, d.y, d.z); p.setXYZ(i, q[0], q[1], q[2]);
      const c = colFn(q, d); cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    g.computeVertexNormals(); planarUV(g);
    if (o.uv1) o.uv1(g);
    return L.mesh(g, mat, 0, 0, 0, { parent: o.parent });
  }
  // tapered tube through points; r(u) radius; colours from root to tip; returns the curve
  function tube(pts, r, mat, o = {}) {
    const curve = new THREE.CatmullRomCurve3(pts.map(q => new THREE.Vector3(...q)), false, 'centripetal');
    const seg = o.seg ?? 28, rad = o.rad ?? 10;
    const g = new THREE.TubeGeometry(curve, seg, 1, rad, false);
    const p = g.attributes.position, v = new THREE.Vector3(), P0 = new THREE.Vector3(), cols = new Float32Array(p.count * 3);
    const c0 = C(o.c0 ?? P.root), c1 = C(o.c1 ?? P.rootTip), from = o.tipFrom ?? 0.55;
    for (let i = 0; i <= seg; i++) {
      const u = i / seg; curve.getPointAt(u, P0); const rr = typeof r === 'function' ? r(u) : r;
      const cc = c0.clone().lerp(c1, sstep(from, 1, u));
      for (let j = 0; j <= rad; j++) { const k = i * (rad + 1) + j; v.fromBufferAttribute(p, k).sub(P0).multiplyScalar(rr).add(P0); p.setXYZ(k, v.x, v.y, v.z); cols[k * 3] = cc.r; cols[k * 3 + 1] = cc.g; cols[k * 3 + 2] = cc.b; }
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3)); g.computeVertexNormals();
    L.mesh(g, mat, 0, 0, 0, { parent: o.parent, cast: o.cast ?? true });
    if (o.cap !== false) { const e = curve.getPointAt(1); L.sphere(Math.max(0.004, (typeof r === 'function' ? r(1) : r)), mat, e.x, e.y, e.z, { parent: o.parent, dirt: 0 }).geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(Array(17 * 33 * 3).fill(0).map((_, i) => [c1.r, c1.g, c1.b][i % 3])), 3)); }
    return curve;
  }
  // a thin glowing thread laid along (just above) a curve, fading from its base
  function glowThread(curve, u0, u1, r, lift, o = {}) {
    const pts = []; const n = 16;
    for (let i = 0; i <= n; i++) { const q = curve.getPointAt(u0 + (u1 - u0) * i / n); pts.push([q.x, q.y + (typeof lift === 'function' ? lift(u0 + (u1 - u0) * i / n) : lift), q.z]); }
    const c = new THREE.CatmullRomCurve3(pts.map(q => new THREE.Vector3(...q)));
    const g = new THREE.TubeGeometry(c, 24, r, 6, false);
    const m = glowMat(o.k ?? 2.4, fadeTex(o.from ?? 0.15, o.to ?? 0.95), o.hex, o.vein ?? true);
    return L.mesh(g, m, 0, 0, 0, { parent: o.parent, cast: false, dirt: 0 });
  }
  // hexagonal crystal (prism + point) from base b along dir
  function crystal(b, dir, r, len, tip, mat, parent) {
    const D = new THREE.Vector3(...dir).normalize(), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), D);
    const body = new THREE.CylinderGeometry(r, r * 1.08, len, 6, 1); body.translate(0, len / 2, 0);
    const cone = new THREE.ConeGeometry(r, tip, 6, 1); cone.translate(0, len + tip / 2, 0);
    const out = [];
    for (const g of [body, cone]) { const m = L.mesh(g, mat, b[0], b[1], b[2], { parent, dirt: 0 }); m.quaternion.copy(q); m.rotateY(R(0, 1)); out.push(m); }
    return out;
  }
  function crystalCluster(b, dir, n, size, spread, parent) {
    const mat = crystalMat(), D = new THREE.Vector3(...dir).normalize();
    for (let i = 0; i < n; i++) {
      const k = i === 0 ? 1 : R(0.45, 0.85), d = D.clone().add(new THREE.Vector3(R(-1, 1), R(-0.3, 0.6), R(-1, 1)).multiplyScalar(i === 0 ? spread * 0.25 : spread)).normalize();
      const off = i === 0 ? [0, 0, 0] : [R(-1, 1) * size * 0.35, 0, R(-1, 1) * size * 0.35];
      crystal([b[0] + off[0], b[1] + off[1], b[2] + off[2]], d.toArray(), size * 0.2 * k, size * k, size * 0.38 * k, mat, parent);
    }
  }
  // a fruiting cap on a short stem: pale dome, dark gills underneath (faintly glowing at night)
  function cap(x, y, z, r, h, tilt = [0, 0], o = {}) {
    const g = L.group(x, y, z, 0, o.parent); g.rotation.set(tilt[0], R(0, 6), tilt[1]);
    const dome = new THREE.SphereGeometry(r, 36, 14, 0, Math.PI * 2, 0, Math.PI / 2); dome.scale(1, h / r, 1);
    const p = dome.attributes.position, cols = new Float32Array(p.count * 3), cT = C(P.cap), cR = C(P.capRim);
    for (let i = 0; i < p.count; i++) { const t = Math.hypot(p.getX(i), p.getZ(i)) / r; const c = cT.clone().lerp(cR, sstep(0.55, 1.0, t)); cols.set([c.r, c.g, c.b], i * 3); }
    dome.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    L.mesh(dome, capMat(), 0, (o.stem ?? h * 0.6), 0, { parent: g });
    const gill = new THREE.ConeGeometry(r * 0.98, r * 0.32, 36, 1, true); gill.rotateX(Math.PI); gill.translate(0, -r * 0.16, 0);
    const gm = o.glowGill && NIGHT ? glowMat(0.9, null) : L.M.plain(P.gill, 0.8);
    L.mesh(gill, gm, 0, (o.stem ?? h * 0.6) + 0.002, 0, { parent: g, dirt: 0 });
    if ((o.stem ?? h * 0.6) > 0.01) L.cyl(r * 0.22, (o.stem ?? h * 0.6), L.M.plain(P.cap, 0.7), 0, 0, 0, { parent: g, rTop: r * 0.18, dirt: 0.4, dirtH: h, seg: 14 });
    return g;
  }
  // a shelf (bracket) fungus on a surface: a half-disc ledge sticking out along 'out' (horizontal angle)
  function shelf(x, y, z, ang, r, o = {}) {
    const g = L.group(x, y, z, -ang, o.parent);
    const s = new THREE.SphereGeometry(r, 30, 10, Math.PI / 2, Math.PI, 0, Math.PI / 2); s.scale(1, 0.32, 1);
    const p = s.attributes.position, cols = new Float32Array(p.count * 3), cT = C(P.cap), cR = C(P.capRim);
    for (let i = 0; i < p.count; i++) { const t = Math.hypot(p.getX(i), p.getZ(i)) / r, rings = 0.5 + 0.5 * Math.sin(t * 22); const c = cR.clone().lerp(cT, 0.35 + 0.5 * t).multiplyScalar(0.88 + 0.12 * rings); cols.set([c.r, c.g, c.b], i * 3); }
    s.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    L.mesh(s, capMat(), 0, 0, 0, { parent: g });
    const u = new THREE.CircleGeometry(r * 0.99, 30, -Math.PI / 2, Math.PI); u.rotateX(Math.PI / 2);
    L.mesh(u, L.M.plain(P.gill, 0.85), 0, -0.002, 0, { parent: g, dirt: 0 });
    return g;
  }

  // a root-leg: hip -> knee -> ankle as one knobbly tapering root, then n rootlets splayed out and gripping the ground.
  // swing (0..1) lifts it: the ankle rises and pulls in and the rootlets curl together.
  function rootLeg(hip, knee, ankle, o = {}) {
    const mat = o.mat || rootMat(), ph = o.ph ?? R(0, 6), r0 = o.r0 ?? 0.14, rA = o.rA ?? r0 * 0.4, sw = o.swing ?? 0, n = o.n ?? 3;
    const r = u => (rA + (r0 - rA) * Math.pow(1 - u, 1.2)) * (1 + (o.knob ?? 0.12) * Math.sin(u * 21 + ph));
    const mid = (a, b, t, up, side) => [a[0] + (b[0] - a[0]) * t + side[0], a[1] + (b[1] - a[1]) * t + up, a[2] + (b[2] - a[2]) * t + side[1]];
    const wob = () => [R(-1, 1) * 0.06, R(-1, 1) * 0.06];
    const curve = tube([hip, mid(hip, knee, 0.5, 0.06, wob()), knee, mid(knee, ankle, 0.5, 0.05, wob()), ankle], r, mat, { seg: o.seg ?? 34, rad: o.rad ?? 10, tipFrom: o.tipFrom ?? 0.75, c0: o.c0, c1: o.c1m ?? o.c1, parent: o.parent });
    if (o.glow !== false) glowThread(curve, 0.0, o.glowTo ?? 0.8, (o.gw ?? 0.024), u => r(u) * 0.86, { parent: o.parent, k: o.gk ?? 2.3, from: 0.1, to: 1.0, hex: o.hex });
    const out = Math.atan2(ankle[2] - hip[2], ankle[0] - hip[0]);
    const spread = (o.spread ?? 0.95) * (1 - 0.55 * sw), len = (o.len ?? 0.6) * (1 - 0.35 * sw);
    for (let k = 0; k < n; k++) {
      const a = out + (n > 1 ? (k / (n - 1) - 0.5) * spread : 0) + R(-0.12, 0.12) + (o.bias ?? 0), l = len * R(0.8, 1.15);
      const p1 = [ankle[0] + Math.cos(a) * l * 0.35, ankle[1] * 0.45 + sw * 0.12, ankle[2] + Math.sin(a) * l * 0.35];
      const p2 = [ankle[0] + Math.cos(a) * l * 0.75, 0.035 + sw * (0.1 + ankle[1] * 0.2), ankle[2] + Math.sin(a) * l * 0.75];
      const a2 = a + R(-0.35, 0.35), p3 = [p2[0] + Math.cos(a2) * l * 0.32, 0.02 + sw * 0.05, p2[2] + Math.sin(a2) * l * 0.32];
      const rr0 = r(1) * 0.85;
      tube([ankle, p1, p2, p3], u => rr0 * (1 - u) * 0.9 + 0.008, o.rootletMat || mat, { seg: 16, rad: 7, tipFrom: o.rootletTip ?? 0.05, c0: o.c1m ?? o.c0, c1: o.c1, parent: o.parent });
      if (o.hairs !== false && sw < 0.5) for (const hk of [-1, 1]) { const b = a2 + hk * 0.6; tube([p3, [p3[0] + Math.cos(b) * l * 0.18, 0.012, p3[2] + Math.sin(b) * l * 0.18]], 0.006, mat, { seg: 2, rad: 4, tipFrom: 0, c0: o.c1, c1: o.c1, parent: o.parent, cap: false }); }
    }
    return curve;
  }

  // lib.js gives every glowing part its own coloured point light at evening and night. A Murmur has dozens of small
  // glowing parts, so those lights would flood the body; scale them down just before the render (three.js gathers the
  // lights after scene.onBeforeRender), keeping the flesh dark between its glowing veins.
  function tameLights(k) {
    const sc = L.getScene();
    sc.onBeforeRender = () => sc.traverse(o => { if (o.isPointLight && !o.userData.mine && !o.userData.tamed) { o.intensity *= k; o.userData.tamed = true; } });
  }
  function myLight(hex, intensity, x, y, z, dist = 3) { const l = L.pointLight(hex, intensity, x, y, z, dist); l.userData.mine = true; return l; }

  // ---- cameras
  function topDown(W) {
    const cam = new THREE.OrthographicCamera(-W / 2, W / 2, W / 2, -W / 2, 0.1, 100);
    cam.position.set(0, 40, 0); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    L.useCamera(cam);
    // straight-down sun lights every top face fully: tone it down like the robots (robkit.js)
    L.getScene().traverse(o => { if (o.isDirectionalLight) o.intensity *= o.castShadow ? 0.58 : 0.6; if (o.isHemisphereLight) o.intensity *= 0.7; });
    return cam;
  }
  function hero(pos, look, fov = 30) {
    const cam = new THREE.PerspectiveCamera(fov, 1, 0.3, 200);
    cam.position.set(...pos); cam.lookAt(...look); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    L.useCamera(cam);
    return cam;
  }
  // a patch of ground for the hero shot: soft-edged disc, receives the creature's shadow
  function groundPatch(r, hex = '#b98f5e') {
    const n = 1024;
    const c = canvas(n, (g) => {
      const im = g.createImageData(n, n), D = im.data, nz = noise3(77, 18);
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const dx = (x - n / 2) / (n / 2), dy = (y - n / 2) / (n / 2), rr = Math.hypot(dx, dy);
        const k = 0.86 + 0.1 * nz(dx * 3, 0.5, dy * 3) + 0.06 * nz(dx * 14, 2, dy * 14) + (Math.random() - 0.5) * 0.06;
        const cc = C(hex).multiplyScalar(k); const a = 1 - sstep(0.72, 1.0, rr + 0.05 * nz(dx * 5, 9, dy * 5));
        const i = (y * n + x) * 4; D[i] = Math.min(255, cc.r * 255); D[i + 1] = Math.min(255, cc.g * 255); D[i + 2] = Math.min(255, cc.b * 255); D[i + 3] = a * 255;
      }
      g.putImageData(im, 0, 0);
    }, false);
    const t = texOf(c); t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.95, metalness: 0, depthWrite: true });
    const pg = new THREE.PlaneGeometry(2 * r, 2 * r); pg.rotateX(-Math.PI / 2);
    const pm = new THREE.Mesh(pg, m); pm.receiveShadow = true; pm.userData.decal = true; L.getRoot().add(pm); return pm;
  }

  return { THREE, Q, TOD, NIGHT, GLOW, GLOWHEX, VEIN, VEINHEX, V, P, C, dimHex, seed, rnd, R, noise3, sstep, texSpace, planarUV, canvas, texOf, vein, node,
    flesh, rootMat, rootLeg, fadeTex, glowMat, crystalMat, crystalDark, capMat, barkMat, blob, tube, glowThread, crystal, crystalCluster, cap, shelf,
    topDown, hero, groundPatch, tameLights, myLight };
}

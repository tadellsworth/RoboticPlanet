// Shared scene, camera, lighting, materials and modelling helpers for Botfall building renders.
// World units: the foundation pad is 10 x 10, its top surface at y = 0; +z faces the camera.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
export { THREE };

const params = new URLSearchParams(location.search);
export const ACCENT = params.get('accent') || '#ff8a1e';
export const TEAM = params.get('team') || '#38d4ff';
// ---- time of day: ?tod=day (default, identical to the shipped renders) | morning | evening | night
export const TOD = params.get('tod') || 'day';
const TODS = {
  day:     { sun: [0xffd9a8, 3.4, [-7, 15, -6.5]], hemi: [0xd7e0ec, 0x8a5a3a, 0.55], fill: [0xbfd0ff, 0.3, [6, 5, 12]], env: 1, exp: 0.8, lights: 0 },
  morning: { sun: [0xffc49a, 3.1, [14, 8.5, -5]], hemi: [0xc2cff2, 0x8a6450, 0.5], fill: [0xffd2c0, 0.22, [-6, 5, 12]], env: 0.85, exp: 0.8, lights: 0.2 },
  evening: { sun: [0xff8a48, 2.8, [-14, 6.2, -4]], hemi: [0x8a84c4, 0x6a3a2c, 0.42], fill: [0xa48cff, 0.25, [6, 5, 12]], env: 0.55, exp: 0.8, lights: 0.7 },
  night:   { sun: [0x93abff, 0.55, [-6, 16, -8]], hemi: [0x2a3656, 0x120e0c, 0.6], fill: [0x5a6cff, 0.06, [6, 5, 12]], env: 0.12, exp: 0.85, lights: 1 },
};
const TS = TODS[TOD] || TODS.day;
export const T = 2;               // world units covered by one texture tile
let N = 1024;                     // render size (downsampled 2x afterwards)
let customCam = null;
export function useCamera(c) { customCam = c; }
export const getRoot = () => root, getScene = () => scene;
const ELEV = 57 * Math.PI / 180;  // camera looks down at 57 degrees
const FOV = 20;

// ---------- deterministic random ----------
let _s = 9871;
export function seed(n) { _s = n >>> 0; }
export function rnd() { _s = (_s + 0x6D2B79F5) | 0; let t = Math.imul(_s ^ (_s >>> 15), 1 | _s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
const R = (a, b) => a + (b - a) * rnd();

// ---------- canvas texture helpers ----------
function mk(n) { const c = document.createElement('canvas'); c.width = c.height = n; return c; }
function tex(c, srgb = true) { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; }
function line(g, x1, y1, x2, y2) { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); }
function blotches(g, n, count, r0, r1, a, col = '0,0,0') {
  for (let i = 0; i < count; i++) {
    const x = R(0, n), y = R(0, n), r = R(r0, r1), k = R(0.3, 1) * a;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(${col},${k})`); gr.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
}
function speckle(g, n, count, a = 0.18) {
  for (let i = 0; i < count; i++) { const v = rnd() < 0.5 ? 0 : 255; g.fillStyle = `rgba(${v},${v},${v},${R(0.04, a)})`; g.fillRect(R(0, n), R(0, n), R(1, 2.2), R(1, 2.2)); }
}
function heightToNormal(hc, s = 2.5) {
  const n = hc.width, src = hc.getContext('2d').getImageData(0, 0, n, n).data;
  const out = mk(n), og = out.getContext('2d'), od = og.createImageData(n, n);
  const H = (x, y) => src[((((y + n) % n) * n) + ((x + n) % n)) * 4] / 255;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const gx = (H(x + 1, y) - H(x - 1, y)) * s, gy = (H(x, y + 1) - H(x, y - 1)) * s;
    let nx = -gx, ny = gy, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const i = (y * n + x) * 4; od.data[i] = (nx * 0.5 + 0.5) * 255; od.data[i + 1] = (ny * 0.5 + 0.5) * 255; od.data[i + 2] = (nz * 0.5 + 0.5) * 255; od.data[i + 3] = 255;
  }
  og.putImageData(od, 0, 0); return out;
}
function hazardStripes(g, x, y, w, h, s = 22) {
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = '#1d1c1a'; g.fillRect(x, y, w, h); g.fillStyle = '#d2a326';
  for (let k = -h; k < w + h; k += 2 * s) { g.beginPath(); g.moveTo(x + k, y + h); g.lineTo(x + k + s, y + h); g.lineTo(x + k + s + h, y); g.lineTo(x + k + h, y); g.closePath(); g.fill(); }
  g.restore();
}

// ---------- materials ----------
const cache = {};
function std(o) { const m = new THREE.MeshStandardMaterial(o); m.envMapIntensity = o.env ?? 0.55; return m; }
export const M = {
  paint(hex, o = {}) {
    const key = 'p' + hex + JSON.stringify(o); if (cache[key]) return cache[key];
    const n = 512, c = mk(n), g = c.getContext('2d'), h = mk(n), hg = h.getContext('2d');
    g.fillStyle = hex; g.fillRect(0, 0, n, n); hg.fillStyle = '#808080'; hg.fillRect(0, 0, n, n);
    blotches(g, n, 90, 12, 70, 0.08); blotches(g, n, 40, 10, 50, 0.06, '255,255,255');
    const pw = o.panelW ?? 256, ph = o.panelH ?? 256;
    g.strokeStyle = 'rgba(15,12,10,0.55)'; g.lineWidth = 3; hg.strokeStyle = '#1a1a1a'; hg.lineWidth = 5;
    for (let x = 0; x <= n; x += pw) { line(g, x, 0, x, n); line(hg, x, 0, x, n); }
    for (let y = 0; y <= n; y += ph) { line(g, 0, y, n, y); line(hg, 0, y, n, y); }
    if (o.rivets !== false) {
      for (let x = 0; x <= n; x += pw) for (let y = 10; y < n; y += 26) { hg.fillStyle = '#e0e0e0'; hg.beginPath(); hg.arc(x + 9, y, 3.2, 0, 7); hg.fill(); hg.beginPath(); hg.arc(x - 9, y, 3.2, 0, 7); hg.fill(); g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.arc(x + 9, y + 1, 3, 0, 7); g.fill(); g.beginPath(); g.arc(x - 9, y + 1, 3, 0, 7); g.fill(); }
    }
    for (let i = 0; i < 26; i++) { // drip streaks below seams
      const x = R(0, n), y = Math.floor(R(0, n / ph)) * ph + 4, l = R(30, 140);
      const gr = g.createLinearGradient(0, y, 0, y + l); gr.addColorStop(0, 'rgba(60,35,20,0.35)'); gr.addColorStop(1, 'rgba(60,35,20,0)'); g.fillStyle = gr; g.fillRect(x, y, R(2, 6), l);
    }
    for (let i = 0; i < 14; i++) { const x = Math.floor(R(0, n / pw + 1)) * pw + R(-14, 14), y = R(0, n); const r = R(5, 16); const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(140,62,22,0.55)'); gr.addColorStop(1, 'rgba(140,62,22,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
    for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(40,36,32,${R(0.2, 0.6)})`; const x = R(0, n), y = R(0, n); g.beginPath(); g.ellipse(x, y, R(1, 4), R(1, 3), R(0, 3), 0, 7); g.fill(); hg.fillStyle = '#6a6a6a'; hg.fillRect(x - 1, y - 1, 2, 2); }
    for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(255,255,255,${R(0.05, 0.18)})`; g.lineWidth = 1; const x = R(0, n), y = R(0, n); line(g, x, y, x + R(-30, 30), y + R(-8, 8)); }
    speckle(g, n, 5000, 0.12);
    const m = std({ map: tex(c), normalMap: tex(heightToNormal(h, 3), false), roughness: o.rough ?? 0.72, metalness: o.metal ?? 0.25, vertexColors: true });
    return (cache[key] = m);
  },
  ribbed(hex, o = {}) {
    const key = 'r' + hex; if (cache[key]) return cache[key];
    const n = 512, c = mk(n), g = c.getContext('2d'), h = mk(n), hg = h.getContext('2d'), p = o.period ?? 32;
    g.fillStyle = hex; g.fillRect(0, 0, n, n);
    for (let x = 0; x < n; x++) { const v = Math.cos((x / p) * Math.PI * 2); const k = Math.round(128 + 110 * v); hg.fillStyle = `rgb(${k},${k},${k})`; hg.fillRect(x, 0, 1, n); g.fillStyle = v > 0.6 ? 'rgba(255,255,255,0.08)' : v < -0.6 ? 'rgba(0,0,0,0.16)' : 'rgba(0,0,0,0)'; g.fillRect(x, 0, 1, n); }
    blotches(g, n, 70, 14, 80, 0.09);
    for (let i = 0; i < 40; i++) { const x = R(0, n), y = R(0, n), l = R(40, 200); const gr = g.createLinearGradient(0, y, 0, y + l); gr.addColorStop(0, 'rgba(70,40,22,0.3)'); gr.addColorStop(1, 'rgba(70,40,22,0)'); g.fillStyle = gr; g.fillRect(x, y, R(2, 5), l); }
    speckle(g, n, 4000, 0.1);
    return (cache[key] = std({ map: tex(c), normalMap: tex(heightToNormal(h, 4), false), roughness: 0.66, metalness: 0.3, vertexColors: true }));
  },
  rough(hex) {
    const key = 'c' + hex; if (cache[key]) return cache[key];
    const n = 512, c = mk(n), g = c.getContext('2d'); g.fillStyle = hex; g.fillRect(0, 0, n, n);
    blotches(g, n, 120, 10, 90, 0.08); blotches(g, n, 50, 10, 60, 0.07, '255,250,240'); speckle(g, n, 14000, 0.2);
    for (let i = 0; i < 18; i++) { const x = R(0, n), y = R(0, n), l = R(30, 160); const gr = g.createLinearGradient(0, y, 0, y + l); gr.addColorStop(0, 'rgba(60,45,30,0.22)'); gr.addColorStop(1, 'rgba(60,45,30,0)'); g.fillStyle = gr; g.fillRect(x, y, R(3, 10), l); }
    return (cache[key] = std({ map: tex(c), roughness: 0.92, metalness: 0, vertexColors: true, env: 0.35 }));
  },
  get concrete() { return M.rough('#9a9285'); },
  get wood() {
    if (cache.wood) return cache.wood;
    const n = 256, c = mk(n), g = c.getContext('2d'); g.fillStyle = '#8a6a45'; g.fillRect(0, 0, n, n);
    for (let y = 0; y < n; y += 32) { g.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '255,240,220'},${R(0.04, 0.12)})`; g.fillRect(0, y, n, 32); g.fillStyle = 'rgba(30,20,10,0.6)'; g.fillRect(0, y, n, 3); }
    for (let i = 0; i < 300; i++) { g.strokeStyle = `rgba(50,32,18,${R(0.08, 0.25)})`; g.lineWidth = 1; const y = R(0, n); line(g, R(0, n), y, R(0, n), y + R(-2, 2)); }
    blotches(g, n, 30, 8, 40, 0.15); return (cache.wood = std({ map: tex(c), roughness: 0.85, metalness: 0, vertexColors: true, env: 0.3 }));
  },
  crystal(hex, glowHex, k = 0.9) {
    const key = 'x' + hex + glowHex + k; if (cache[key]) return cache[key];
    const m = new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: k, roughness: 0.12, metalness: 0.1, flatShading: true }); m.envMapIntensity = 1.5;
    m.userData.glow = glowHex || hex; return (cache[key] = m);
  },
  plain(hex, rough = 0.8, metal = 0) { const key = 's' + hex + rough + metal; return cache[key] || (cache[key] = std({ color: hex, roughness: rough, metalness: metal, vertexColors: true })); },
  get steel() {
    if (cache.steel) return cache.steel;
    const n = 256, c = mk(n), g = c.getContext('2d'); g.fillStyle = '#4a4f55'; g.fillRect(0, 0, n, n);
    blotches(g, n, 60, 8, 40, 0.12); blotches(g, n, 14, 6, 20, 0.35, '120,60,25'); speckle(g, n, 3000, 0.15);
    return (cache.steel = std({ map: tex(c), roughness: 0.5, metalness: 0.65, vertexColors: true, env: 0.8 }));
  },
  get dark() { return cache.dark || (cache.dark = std({ color: '#1c1d1f', roughness: 0.85, metalness: 0.2, vertexColors: true })); },
  get chrome() { return cache.chrome || (cache.chrome = std({ color: '#cfd5da', roughness: 0.22, metalness: 1, vertexColors: true, env: 1.2 })); },
  get hazard() {
    if (cache.haz) return cache.haz;
    const n = 256, c = mk(n), g = c.getContext('2d'); hazardStripes(g, 0, 0, n, n, 32);
    blotches(g, n, 40, 6, 30, 0.25); speckle(g, n, 2000, 0.25);
    for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(55,50,45,${R(0.3, 0.7)})`; g.fillRect(R(0, n), R(0, n), R(2, 7), R(2, 5)); }
    return (cache.haz = std({ map: tex(c), roughness: 0.7, metalness: 0.2, vertexColors: true }));
  },
  get grating() {
    if (cache.grat) return cache.grat;
    const n = 128, c = mk(n), g = c.getContext('2d'); g.fillStyle = '#26282b'; g.fillRect(0, 0, n, n);
    g.strokeStyle = '#7c838a'; g.lineWidth = 3; for (let k = 0; k <= n; k += 16) { line(g, k, 0, k, n); } g.lineWidth = 2; for (let k = 0; k <= n; k += 8) line(g, 0, k, n, k);
    return (cache.grat = std({ map: tex(c), roughness: 0.6, metalness: 0.6, vertexColors: true }));
  },
  grille(hex = '#3d4247') {
    const key = 'g' + hex; if (cache[key]) return cache[key];
    const n = 128, c = mk(n), g = c.getContext('2d'); g.fillStyle = hex; g.fillRect(0, 0, n, n);
    g.fillStyle = '#0d0e10'; for (let y = 6; y < n; y += 16) g.fillRect(6, y, n - 12, 8);
    return (cache[key] = std({ map: tex(c), roughness: 0.6, metalness: 0.4, vertexColors: true }));
  },
  emit(hex, k = 2.5) {
    const key = 'e' + hex + k; if (cache[key]) return cache[key];
    const m = new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: k, roughness: 0.4 });
    m.userData.glow = hex; return (cache[key] = m);
  },
  glass(hex, op = 0.35) { return new THREE.MeshPhysicalMaterial({ color: hex, roughness: 0.08, metalness: 0, transmission: 0, transparent: true, opacity: op, envMapIntensity: 1.4, clearcoat: 1 }); },
};

// ---------- scene ----------
let renderer, scene, camera, root;
export function init(opts = {}) {
  if (opts.size) N = opts.size;
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(opts.w || N, opts.h || N); renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = TS.exp;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);
  scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  root = new THREE.Group(); scene.add(root);

  if (opts.lights === false) { if (opts.pad !== false) pad(); return; }
  const sun = new THREE.DirectionalLight(TS.sun[0], TS.sun[1]);
  sun.position.set(...TS.sun[2]); sun.target.position.set(0, 0, 0);
  sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
  const R0 = TOD === 'day' ? 11 : 15;
  const sc = sun.shadow.camera; sc.left = -R0; sc.right = R0; sc.top = R0; sc.bottom = -R0; sc.near = 1; sc.far = TOD === 'day' ? 50 : 80;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight(TS.hemi[0], TS.hemi[1], TS.hemi[2]));
  const fill = new THREE.DirectionalLight(TS.fill[0], TS.fill[1]); fill.position.set(...TS.fill[2]); scene.add(fill);

  if (opts.pad !== false) pad();
}

// ---------- geometry helpers ----------
function colorize(geo, o = {}) {
  geo.computeBoundingBox(); const y0 = geo.boundingBox.min.y, y1 = geo.boundingBox.max.y;
  const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
  const d = o.dirt ?? 1, dh = o.dirtH ?? 0.9;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) - y0; let s = Math.min(1, Math.max(0, y / dh)); s = s * s * (3 - 2 * s);
    let r = 1 - (1 - (0.6 + 0.4 * s)) * d, gg = 1 - (1 - (0.5 + 0.5 * s)) * d, b = 1 - (1 - (0.4 + 0.6 * s)) * d;
    if (o.soot) { let t = Math.min(1, Math.max(0, (pos.getY(i) - (y1 - o.soot)) / o.soot)); const k = 1 - 0.8 * t; r *= k; gg *= k; b *= k; }
    const tint = o.tint ?? 1; col[i * 3] = r * tint; col[i * 3 + 1] = gg * tint; col[i * 3 + 2] = b * tint;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
}
function scaleUV(geo, dims, fixed = false) { // dims: materialIndex -> [faceW, faceH]
  const uv = geo.attributes.uv, idx = geo.index, ou = fixed ? 0 : rnd(), ov = fixed ? 0 : rnd(), seen = new Set();
  for (const gr of geo.groups) { const [fw, fh] = dims[gr.materialIndex];
    for (let k = gr.start; k < gr.start + gr.count; k++) { const v = idx.getX(k); if (seen.has(v)) continue; seen.add(v); uv.setXY(v, uv.getX(v) * fw / T + ou, uv.getY(v) * fh / T + ov); } }
}
function add(mesh, o) { mesh.castShadow = o.cast ?? true; mesh.receiveShadow = true; (o.parent || root).add(mesh); return mesh; }
export function group(x = 0, y = 0, z = 0, ry = 0, parent) { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; (parent || root).add(g); return g; }

// box with its BASE at y
export function box(w, h, d, mat, x = 0, y = 0, z = 0, o = {}) {
  const hs = Math.min(24, Math.max(1, Math.ceil(h / 0.25)));
  const geo = new THREE.BoxGeometry(w, h, d, 1, hs, 1); geo.translate(0, h / 2, 0);
  scaleUV(geo, { 0: [d, h], 1: [d, h], 2: [w, d], 3: [w, d], 4: [w, h], 5: [w, h] }); colorize(geo, o);
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (o.ry) m.rotation.y = o.ry; return add(m, o);
}
// vertical cylinder / frustum with its BASE at y; r = bottom radius
export function cyl(r, h, mat, x = 0, y = 0, z = 0, o = {}) {
  const rt = o.rTop ?? r, seg = o.seg ?? 40, hs = Math.min(24, Math.max(1, Math.ceil(h / 0.25)));
  const geo = new THREE.CylinderGeometry(rt, r, h, seg, hs, o.open ?? false); geo.translate(0, h / 2, 0);
  scaleUV(geo, { 0: [2 * Math.PI * Math.max(r, rt), h], 1: [2 * rt, 2 * rt], 2: [2 * r, 2 * r] }); colorize(geo, o);
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (o.ry) m.rotation.y = o.ry; return add(m, o);
}
// any geometry; colours it for dirt unless it already has colours
export function mesh(geo, mat, x = 0, y = 0, z = 0, o = {}) {
  if (!geo.attributes.color) colorize(geo, o);
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
  if (o.rx) m.rotation.x = o.rx; if (o.ry) m.rotation.y = o.ry; if (o.rz) m.rotation.z = o.rz; if (o.order) m.rotation.order = o.order;
  return add(m, o);
}
// box spanning from point a to point b (not vertical), cross-section w x h
export function beam(a, b, w, h, mat, o = {}) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), len = A.distanceTo(B);
  const geo = new THREE.BoxGeometry(w, h, len); scaleUV(geo, { 0: [len, h], 1: [len, h], 2: [w, len], 3: [w, len], 4: [w, h], 5: [w, h] }); colorize(geo, { dirt: 0 });
  const m = new THREE.Mesh(geo, mat); m.position.copy(A).add(B).multiplyScalar(0.5); add(m, o); m.lookAt(B); return m;
}
// upright gear (in the XY plane, facing the camera)
export function gear(rOut, rIn, teeth, depth, mat, x, y, z, o = {}) {
  const s = new THREE.Shape(), st = (Math.PI * 2) / teeth;
  for (let k = 0; k < teeth; k++) { const a = k * st; const P = (r, t) => [Math.cos(a + t * st) * r, Math.sin(a + t * st) * r];
    const pts = [P(rIn, 0), P(rOut, 0.18), P(rOut, 0.48), P(rIn, 0.66)]; pts.forEach(([px, py], i) => (k === 0 && i === 0) ? s.moveTo(px, py) : s.lineTo(px, py)); }
  s.closePath(); const hole = new THREE.Path(); hole.absarc(0, 0, rIn * 0.42, 0, Math.PI * 2, true); s.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2, curveSegments: 24 });
  geo.translate(0, 0, -depth / 2); return mesh(geo, mat, x, y, z, { dirt: 0, ...o });
}
// hexagonal crystal: prism + pointed tip, tilted (rx, rz in radians), base at (x,y,z)
export function crystal(r, len, tip, mat, x, y, z, rx = 0, rz = 0) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.set(rx, 0, rz); root.add(g);
  const body = new THREE.CylinderGeometry(r, r * 1.05, len, 6, 1); body.translate(0, len / 2, 0);
  const cone = new THREE.ConeGeometry(r, tip, 6, 1); cone.translate(0, len + tip / 2, 0);
  for (const geo of [body, cone]) { colorize(geo, { dirt: 0 }); const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; g.add(m); }
  return g;
}
export function canvasTex(n, draw, srgb = true) { const c = mk(n); draw(c.getContext('2d'), n); return tex(c, srgb); }
export { hazardStripes, blotches, speckle, R };
// horizontal cylinder centred at (x,y,z) along 'x' or 'z'
export function hcyl(r, len, mat, x, y, z, o = {}) {
  const geo = new THREE.CylinderGeometry(r, r, len, o.seg ?? 32, 1, o.open ?? false);
  scaleUV(geo, { 0: [2 * Math.PI * r, len], 1: [2 * r, 2 * r], 2: [2 * r, 2 * r] });
  if ((o.axis ?? 'x') === 'x') geo.rotateZ(Math.PI / 2); else geo.rotateX(Math.PI / 2);
  colorize(geo, { dirt: o.dirt ?? 0.5, dirtH: 2 * r });
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return add(m, o);
}
export function sphere(r, mat, x, y, z, o = {}) {
  const geo = new THREE.SphereGeometry(r, 32, 16, 0, Math.PI * 2, 0, o.dome ? Math.PI / 2 : Math.PI); colorize(geo, { dirt: o.dirt ?? 0.3, dirtH: r });
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return add(m, o);
}
// flat ring band around a vertical axis (reinforcing hoops, rims)
export function hoop(r, tube, mat, x, y, z, o = {}) {
  const geo = new THREE.TorusGeometry(r, tube, 10, 64); geo.rotateX(Math.PI / 2); colorize(geo, { dirt: 0 });
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return add(m, o);
}
// straight-segment pipe through points, with elbows and optional end flanges
export function pipe(pts, r, mat, o = {}) {
  const V = pts.map(p => new THREE.Vector3(...p)), up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < V.length - 1; i++) {
    const a = V[i], b = V[i + 1], dir = b.clone().sub(a), len = dir.length();
    const geo = new THREE.CylinderGeometry(r, r, len, 18, 1, true); colorize(geo, { dirt: 0 });
    const m = new THREE.Mesh(geo, mat); m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(up, dir.normalize()); add(m, o);
    if (i > 0) sphere(r * 1.08, mat, a.x, a.y, a.z, { parent: o.parent });
  }
  if (o.flange !== false) for (const p of [V[0], V[V.length - 1]]) { /* small collars at ends */ }
}
// railing along a polyline at deck height y (posts + two rails)
export function railing(pts, y, o = {}) {
  const mat = o.mat || M.paint('#c49a2c', { rivets: false }), h = o.h ?? 0.8, sp = o.spacing ?? 0.7;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, z1] = pts[i], [x2, z2] = pts[i + 1], len = Math.hypot(x2 - x1, z2 - z1), n = Math.max(1, Math.round(len / sp));
    for (let k = 0; k <= n; k++) { if (k === 0 && i > 0) continue; const t = k / n; box(0.07, h, 0.07, mat, x1 + (x2 - x1) * t, y, z1 + (z2 - z1) * t); }
    pipe([[x1, y + h, z1], [x2, y + h, z2]], 0.045, mat); pipe([[x1, y + h * 0.5, z1], [x2, y + h * 0.5, z2]], 0.035, mat);
  }
}
// rectangular grating catwalk; rails on listed sides ('n','s','e','w')
export function catwalk(x, y, z, w, d, sides = 'nsew', o = {}) {
  box(w, 0.1, d, M.grating, x, y - 0.1, z, { dirt: 0 });
  const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2;
  if (sides.includes('n')) railing([[x0, z0], [x1, z0]], y, o);
  if (sides.includes('s')) railing([[x0, z1], [x1, z1]], y, o);
  if (sides.includes('w')) railing([[x0, z0], [x0, z1]], y, o);
  if (sides.includes('e')) railing([[x1, z0], [x1, z1]], y, o);
}
// circular catwalk ring around a vertical axis
export function ringWalk(cx, y, cz, r0, r1, o = {}) {
  const geo = new THREE.RingGeometry(r0, r1, 56, 1); geo.rotateX(-Math.PI / 2); colorize(geo, { dirt: 0 });
  const m = new THREE.Mesh(geo, M.grating); m.position.set(cx, y, cz); add(m, {}); m.material.side = THREE.DoubleSide;
  const mat = o.mat || M.paint('#c49a2c', { rivets: false }), n = o.posts ?? 16;
  for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2; box(0.07, 0.8, 0.07, mat, cx + Math.cos(a) * (r1 - 0.05), y, cz + Math.sin(a) * (r1 - 0.05)); }
  hoop(r1 - 0.05, 0.045, mat, cx, y + 0.8, cz); hoop(r1 - 0.05, 0.035, mat, cx, y + 0.4, cz);
}
export function ladder(x, y0, y1, z, o = {}) {
  const mat = o.mat || M.paint('#c49a2c', { rivets: false }), ry = o.ry ?? 0, w = 0.45;
  const g = group(x, 0, z, ry);
  box(0.06, y1 - y0, 0.06, mat, -w / 2, y0, 0, { parent: g }); box(0.06, y1 - y0, 0.06, mat, w / 2, y0, 0, { parent: g });
  for (let y = y0 + 0.3; y < y1; y += 0.3) box(w, 0.04, 0.04, mat, 0, y, 0, { parent: g, dirt: 0 });
}
// glowing element + a coloured point light that spills onto nearby surfaces
export function lamp(x, y, z, hex, o = {}) {
  const s = o.size ?? 0.16;
  if (o.shape === 'sphere') sphere(s, M.emit(hex, o.k ?? 4), x, y, z, { cast: false }); else box(s, s, s, M.emit(hex, o.k ?? 4), x, y, z, { cast: false, dirt: 0 });
  if (o.light !== false) { const L = new THREE.PointLight(hex, o.intensity ?? 6, o.dist ?? 4, 2); L.position.set(x, y + s / 2 + (o.lift ?? 0.2), z); scene.add(L); }
}
export function pointLight(hex, intensity, x, y, z, dist = 6) { const L = new THREE.PointLight(hex, intensity, dist, 2); L.position.set(x, y, z); scene.add(L); return L; }
// soft dark contact shadow on the pad under a footprint
let _aoTex;
export function ao(x, z, w, d, a = 0.55, y = 0.004) {
  if (!_aoTex) { const c = mk(128), g = c.getContext('2d'); g.filter = 'blur(14px)'; g.fillStyle = '#000'; g.fillRect(28, 28, 72, 72); _aoTex = new THREE.CanvasTexture(c); }
  const s = 1.6, geo = new THREE.PlaneGeometry(w * s + 0.6, d * s + 0.6); geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: _aoTex, transparent: true, opacity: a, depthWrite: false }));
  m.position.set(x, y, z); m.userData.decal = true; m.renderOrder = 1; root.add(m); return m;
}

// ---------- the shared foundation pad ----------
function padTopTexture() {
  const n = 1024, c = mk(n), g = c.getContext('2d');
  g.fillStyle = '#857e73'; g.fillRect(0, 0, n, n);
  blotches(g, n, 260, 10, 120, 0.07); blotches(g, n, 90, 10, 80, 0.06, '255,250,240'); speckle(g, n, 40000, 0.2);
  g.strokeStyle = 'rgba(45,38,30,0.6)'; g.lineWidth = 3; for (const t of [n / 3, 2 * n / 3]) { line(g, t, 60, t, n - 60); line(g, 60, t, n - 60, t); }
  for (let i = 0; i < 7; i++) { const x = R(140, n - 140), y = R(140, n - 140), r = R(20, 55); const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(30,24,20,0.35)'); gr.addColorStop(1, 'rgba(30,24,20,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, r, r * R(0.5, 0.9), R(0, 3), 0, 7); g.fill(); }
  const bw = 34, inset = 22; // hazard border band
  hazardStripes(g, inset, inset, n - 2 * inset, bw); hazardStripes(g, inset, n - inset - bw, n - 2 * inset, bw);
  g.save(); g.translate(n, 0); g.rotate(Math.PI / 2); hazardStripes(g, inset, inset, n - 2 * inset, bw); hazardStripes(g, inset, n - inset - bw, n - 2 * inset, bw); g.restore();
  for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(95,90,82,${R(0.4, 0.8)})`; const e = rnd() < 0.5; const x = e ? (rnd() < 0.5 ? R(inset, inset + bw) : R(n - inset - bw, n - inset)) : R(inset, n - inset); const y = e ? R(inset, n - inset) : (rnd() < 0.5 ? R(inset, inset + bw) : R(n - inset - bw, n - inset)); g.fillRect(x, y, R(2, 9), R(2, 6)); }
  for (const [x0, y0, x1, y1] of [[0, 0, 0, 130], [0, n, 0, n - 130], [0, 0, 130, 0], [n, 0, n - 130, 0]]) { const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, 'rgba(160,110,62,0.45)'); gr.addColorStop(1, 'rgba(160,110,62,0)'); g.fillStyle = gr; g.fillRect(0, 0, n, n); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function pad() {
  const conc = M.concrete, topMat = new THREE.MeshStandardMaterial({ map: padTopTexture(), roughness: 0.9, metalness: 0, vertexColors: true }); topMat.envMapIntensity = 0.35;
  const geo = new THREE.BoxGeometry(10, 0.6, 10, 1, 3, 1); geo.translate(0, -0.3, 0);
  scaleUV(geo, { 0: [10, 0.6], 1: [10, 0.6], 2: [T, T], 3: [10, 10], 4: [10, 0.6], 5: [10, 0.6] }, true); colorize(geo, { dirt: 0.6, dirtH: 0.6 });
  const m = new THREE.Mesh(geo, [conc, conc, topMat, conc, conc, conc]); m.receiveShadow = true; m.castShadow = false; root.add(m);
  const padStart = root.children.length - 1;
  const st = M.paint('#3f4449', { rivets: false });
  box(10.08, 0.16, 0.12, st, 0, -0.12, 4.98, { dirt: 0, cast: false }); box(10.08, 0.16, 0.12, st, 0, -0.12, -4.98, { dirt: 0, cast: false });
  box(0.12, 0.16, 10.08, st, 4.98, -0.12, 0, { dirt: 0, cast: false }); box(0.12, 0.16, 10.08, st, -4.98, -0.12, 0, { dirt: 0, cast: false });
  for (const [x, z] of [[-4.55, -4.55], [4.55, -4.55], [-4.55, 4.55], [4.55, 4.55]]) { box(0.9, 0.05, 0.9, st, x, 0, z, { dirt: 0, cast: false }); for (const [a, b] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) cyl(0.05, 0.05, M.chrome, x + a, 0.05, z + b, { seg: 10, dirt: 0, cast: false }); }
  root.children.slice(padStart).forEach(o => (o.userData.pad = true));
}
export function hidePad() { root.children.forEach(o => { if (o.userData.pad) o.visible = false; }); }

// ---------- camera framing + render passes ----------
function project(cam, v) { const p = v.clone().project(cam); return [(p.x + 1) / 2, (1 - p.y) / 2]; }
function frameCamera() {
  camera = new THREE.PerspectiveCamera(FOV, 1, 0.5, 200);
  const D = new THREE.Vector3(0, -Math.sin(ELEV), -Math.cos(ELEV)), U = new THREE.Vector3(0, Math.cos(ELEV), -Math.sin(ELEV));
  let P = new THREE.Vector3(0, 0, 0).sub(D.clone().multiplyScalar(40));
  const BL = new THREE.Vector3(-5.06, -0.6, 5.06), BR = new THREE.Vector3(5.06, -0.6, 5.06);
  for (let i = 0; i < 80; i++) {
    camera.position.copy(P); camera.lookAt(P.clone().add(D)); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
    const a = project(camera, BL), b = project(camera, BR), w = b[0] - a[0], bottom = a[1];
    P.add(D.clone().multiplyScalar((0.75 - w) * 20)); P.add(U.clone().multiplyScalar((0.96 - bottom) * 8));
  }
}
let compound = null;
export function frameCompoundOpts(o) { compound = o; }
function frameCompound({ half, width, cy }) {
  camera = new THREE.PerspectiveCamera(FOV, 1, 0.5, 300);
  const D = new THREE.Vector3(0, -Math.sin(ELEV), -Math.cos(ELEV)), U = new THREE.Vector3(0, Math.cos(ELEV), -Math.sin(ELEV));
  let P = new THREE.Vector3(0, 0, 0).sub(D.clone().multiplyScalar(60));
  const BL = new THREE.Vector3(-half, 0, half), BR = new THREE.Vector3(half, 0, half), C = new THREE.Vector3(0, 0, 0);
  for (let i = 0; i < 120; i++) {
    camera.position.copy(P); camera.lookAt(P.clone().add(D)); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
    const w = project(camera, BR)[0] - project(camera, BL)[0], c = project(camera, C)[1];
    P.add(D.clone().multiplyScalar((width - w) * 30)); P.add(U.clone().multiplyScalar((cy - c) * 12));
  }
}
function margins() {
  const box3 = new THREE.Box3(); root.traverse(o => { if (o.isMesh && !o.userData.decal) box3.expandByObject(o); });
  let minx = 1, maxx = 0, miny = 1, maxy = 0;
  root.traverse(o => { if (!o.isMesh || o.userData.decal) return; const pos = o.geometry.attributes.position; const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i += 1) { v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); const [x, y] = project(camera, v); minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y); } });
  return { left: minx, right: 1 - maxx, top: miny, bottom: 1 - maxy };
}
export const extra = {};
// named 3D points reported back in screen space (for 2D overlays drawn afterwards)
const _marks = [];
export function mark(name, x, y, z, parent) { const o = new THREE.Object3D(); o.position.set(x, y, z); (parent || root).add(o); _marks.push([name, o]); return o; }
export function snap(name) { renderer.render(scene, camera); extra[name] = renderer.domElement.toDataURL('image/png'); }
export function getRenderer() { return renderer; }
export function getCamera() { return camera; }
function applyTOD() {
  if (TOD === 'day') return;
  root.updateMatrixWorld(true);
  const seen = new Set(), k = TS.lights;
  const clusters = new Map();
  root.traverse(o => {
    if (!o.isMesh || !o.visible) return;
    let vis = true; for (let p = o; p; p = p.parent) if (p.visible === false) vis = false; if (!vis) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!seen.has(m)) {
        seen.add(m);
        if (m.envMapIntensity !== undefined) m.envMapIntensity *= TS.env;
        // window glass glows warm once the lights come on
        if (k > 0.5 && m.isMeshPhysicalMaterial && m.transparent && m.clearcoat === 1) { m.emissive = new THREE.Color('#ffc477'); m.emissiveIntensity = 0.9 * k; }
        // tail-light lenses switch on
        if (k > 0.5 && m.color && m.color.getHex() === 0x5a1414 && !m.userData.glow) { m.emissive = new THREE.Color('#ff2a1e'); m.emissiveIntensity = 1.4 * k; }
      }
    }
    // every glowing part throws light onto its surroundings
    const gm = mats.find(m => m.userData && m.userData.glow);
    if (!gm || k <= 0 || o.userData.pad) return;
    const b = new THREE.Box3().setFromObject(o); if (b.isEmpty()) return;
    const c = b.getCenter(new THREE.Vector3()), sz = b.getSize(new THREE.Vector3());
    const dims = [sz.x, sz.y, sz.z].sort((a, b2) => b2 - a);
    const w = Math.min(4, dims[0] * dims[1] + 0.02) * (gm.emissiveIntensity || 1);
    const key = Math.round(c.x / 1.2) + ',' + Math.round(c.y / 1.2) + ',' + Math.round(c.z / 1.2);
    const e = clusters.get(key) || { p: new THREE.Vector3(), col: new THREE.Color(0, 0, 0), w: 0 };
    e.p.addScaledVector(c, w); e.col.add(new THREE.Color(gm.userData.glow).multiplyScalar(w)); e.w += w; clusters.set(key, e);
  });
  let hasPad = false; root.traverse(o => { if (o.userData && o.userData.pad) hasPad = true; });
  const vf = hasPad ? 1 : 0.4;                                   // vehicles and creatures: lights glow, but don't floodlight the hull
  const list = [...clusters.values()].sort((a, b) => b.w - a.w).slice(0, 28);
  for (const e of list) {
    const p = e.p.multiplyScalar(1 / e.w), col = e.col.multiplyScalar(1 / e.w);
    const m = Math.max(col.r, col.g, col.b) || 1; col.multiplyScalar(1 / m);
    const L = new THREE.PointLight(col, vf * k * Math.min(22, 4 + e.w * 5), 5.5, 2); L.position.set(p.x, p.y + 0.3, p.z); scene.add(L);
  }
}
export function finish(mod) {
  root.updateMatrixWorld(true); applyTOD(); if (customCam) camera = customCam; else if (compound) frameCompound(compound); else frameCamera();
  renderer.render(scene, camera);
  const beauty = renderer.domElement.toDataURL('image/png');
  const black = new THREE.MeshBasicMaterial({ color: 0x000000 });
  scene.traverse(o => {
    if (o.isMesh) { const mats = Array.isArray(o.material) ? o.material : [o.material];
      if (o.userData.decal || mats.some(m => m.transparent)) { o.visible = false; return; }
      const gm = mats.find(m => m.userData && m.userData.glow);
      o.material = gm ? new THREE.MeshBasicMaterial({ color: gm.userData.glow, map: gm.emissiveMap || null }) : black; }
  });
  renderer.shadowMap.enabled = false; scene.environment = null; renderer.toneMapping = THREE.NoToneMapping;
  renderer.render(scene, camera);
  const glow = renderer.domElement.toDataURL('image/png');
  const P = (x, y, z) => project(camera, new THREE.Vector3(x, y, z)).map(v => +v.toFixed(4));
  if (mod && mod.after) mod.after();
  if (params.get('mk')) for (const [nm, x, y, z] of JSON.parse(params.get('mk'))) mark(nm, x, y, z);   // extra points passed in the URL
  const marks = {}; for (const [nm, o] of _marks) { const v = new THREE.Vector3(); o.getWorldPosition(v); marks[nm] = P(v.x, v.y, v.z); }
  window.result = { beauty, glow, extra, marks, margins: margins(), anchor: P(0, 0, 0), padTop: [P(-5, 0, -5), P(5, 0, -5), P(5, 0, 5), P(-5, 0, 5)] };
}

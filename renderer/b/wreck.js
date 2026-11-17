// Crash sites: the broken, burnt airframe an aircraft shot down leaves lying on the ground for the rest of the game
// (S.wrecks in js/sim.js, drawn by ambWreckArt in js/ambient.js). `c=` picks the aircraft:
//   cargoplane  the Cargo Plane (b/plane.js): it came down belly first. The nose has broken off at the flight deck,
//               swung aside and dug in; the tail has snapped behind the wing and twisted away, its T-tail knocked flat;
//               the right wing has folded down onto the ground; the left wing lost its tip and its outer engine in the
//               fall (the engine lies on its side beside it); the roof has burned through behind the wing, its frames
//               showing.
//   bomber      the Vulcan Bomber (b/bomber.js): the radome and canopy have broken off and rolled ahead, the right wing
//               lost its tip pod in the air, the left fin lies flat beside the tail, the right one is bent outward, a
//               tailplane is bent down, and the deck over the engines has burned through.
//   airship    the Airship's armoured blimp (b/airship.js, v=c, on branch airship-art): it settled heavily, and the
//               envelope collapsed on itself, long, flattened and buckled into folds, kinked behind the middle, its nose
//               crushed into the ground; its skin has burned through in three places to the ring frames; one lift fan
//               was torn off and lies on its side, the others hang off bent pylons, one V-tail fin lies flat.
// Each is the aircraft's own scene, built as usual, then broken here: every mesh is baked into world space and cut into
// small triangles (so it can bend and tear anywhere), and each triangle is given to a piece by where it lies. The
// pieces are crumpled (more where they tore), laid on the ground (y = 0) at the angles the crash left them, and the
// paint charred: soot over the hottest places, heat-browned metal round them, a little scorched paint showing, every
// glow dead. Like the aircraft, seen straight down, facing +x (the game turns it to the way it came in), no ground: a
// shadow catcher keeps only the shadows under it. The sun stays high (52 degrees or more), so the short shadows still
// look right when the game turns the sprite. `w=` world units across the frame.
import { kit } from './robkit.js';
import planeScene from './plane.js';
import bomberScene from './bomber.js';
const AIR = await import('./airship.js').catch(() => null); // (the Airship's scene: on branch airship-art until it's merged)
export const config = { pad: false, size: 1024 };

// The frame, world units across (and the aircraft scene's units per map tile: Cargo Plane 12.5, the bomber drawn at 0.72
// of that, the Airship 10: drawAirship draws its 30-unit frame 3 tiles across), and the pieces, the first whose test a triangle's centre passes taking it.
// A piece: `drop` (gone: broke off in the air), `parent` (moves with that piece), else it rests on the ground (its lowest
// point `dig` below). Its own move: about `pivot`, rotations rx (roll, about x), ry (yaw), rz (pitch, nose down < 0) in
// that order, then `move`. crumple: how hard it's crushed. Holes burn through the top (an ellipse [x, z, rx, rz] above
// y); frames: ribs added inside before the break, seen through the holes; burn: [x, y, z, r] the hottest places.
const WRECKS = {
  cargoplane: {
    w: 26, seed: 31, tear: [['x', 5.2], ['x', -4.4], ['z', 4.7], ['z', -4.7], ['z', -7.2]],
    pieces: [
      { name: 'tip', test: (x, y, z) => z < -7.2, drop: true },
      { name: 'engine', test: (x, y, z) => z < -5.4 && z > -6.7 && y < 2.28, pivot: [0.4, 1.9, -6.05], rx: 1.45, ry: 0.85, move: [1.4, 0, -2.0], dig: 0.12, crumple: 0.1 },
      { name: 'fin', test: (x, y, z) => x < -4.95 && y > 2.56, parent: 'tail', pivot: [-7.3, 2.45, 0], rx: 1.38, crumple: 0.06 },
      { name: 'tail', test: (x) => x < -4.4, parent: 'body', pivot: [-4.4, 1.0, 0], ry: -0.3, rz: 0.04, move: [-0.75, -0.05, 0.3], crumple: 0.08 },
      { name: 'nose', test: (x) => x > 5.2, parent: 'body', pivot: [5.2, 0.4, 0], ry: 0.2, rz: -0.13, move: [0.5, -0.1, -0.3], crumple: 0.2 },
      { name: 'wingR', test: (x, y, z) => z > 4.7, parent: 'body', pivot: [0.4, 2.4, 4.7], rx: 0.46, ry: -0.12, crumple: 0.1 },
      { name: 'wingL', test: (x, y, z) => z < -4.7, parent: 'body', pivot: [0.4, 2.4, -4.7], rx: 0.1, ry: 0.06, crumple: 0.08 },
      { name: 'body', dig: 0.32, crumple: 0.07 },
    ],
    holes: [[-3.25, 0, 0.8, 0.66, 2.2], [-0.6, 2.4, 0.55, 0.5, 2.6]],
    frames: (add) => { for (const x of [-3.85, -3.4, -2.95, -2.5]) add.rib(x, 1.3, 0, 1.12, 1.12); add.keel(-4.1, -2.2, 2.38, 0); },
    burn: [[-3.2, 2.5, 0, 2.4], [-0.2, 2.6, 2.6, 2.6], [1.0, 1.9, -6.0, 1.6], [5.6, 1.4, 0, 1.2]],
    debris: [[3.0, 4.2, 0.7, 0.5], [-1.6, -3.4, 0.5, 0.35], [7.6, 2.4, 0.45, 0.4], [-7.9, 2.6, 0.6, 0.3], [2.4, -7.6, 0.4, 0.4], [-5.6, -2.8, 0.35, 0.3], [9.9, -1.6, 0.4, 0.25]],
  },
  bomber: {
    w: 24, seed: 57, tear: [['x', 4.4], ['z', 4.6]],
    pieces: [
      { name: 'tip', test: (x, y, z) => z > 4.6 && x < -1.8, drop: true },
      { name: 'nose', test: (x) => x > 4.4, pivot: [4.4, 1.0, 0], rx: 0.55, ry: -0.32, move: [1.0, 0, 0.6], dig: 0.18, crumple: 0.14 },
      { name: 'finL', test: (x, y, z) => z < 0 && y > 1.7 && x < -3.5, pivot: [-6.2, 1.55, -1.12], rx: -1.42, ry: 0.15, move: [-0.3, 0, -0.9], dig: 0.04, crumple: 0.05 },
      { name: 'finR', test: (x, y, z) => z > 0 && y > 1.7 && x < -3.5, parent: 'body', pivot: [-6.2, 1.52, 1.12], rx: -0.62, crumple: 0.05 },
      { name: 'stab', test: (x, y, z) => x < -6.3 && z < -1.2 && y < 1.4, parent: 'body', pivot: [-7.2, 1.08, -1.25], rx: -0.3, crumple: 0.08 },
      { name: 'wingL', test: (x, y, z) => z < -1.35 && x < -0.3 && y > 1.15, parent: 'body', pivot: [-3.2, 1.34, -1.35], rx: -0.2, crumple: 0.08 },
      { name: 'body', dig: 0.3, crumple: 0.07 },
    ],
    holes: [[-3.6, 0.0, 0.95, 0.42, 1.45], [-2.6, 2.6, 0.5, 0.45, 1.36]],
    frames: (add) => { for (const x of [-4.2, -3.75, -3.3, -2.85]) add.rib(x, 1.0, 0, 0.95, 0.5); },
    burn: [[-7.0, 1.0, 0, 2.6], [-3.4, 1.4, 2.0, 2.4], [-3.6, 1.6, 0, 1.6], [5.0, 1.0, 0, 1.0]],
    debris: [[1.6, 2.6, 0.45, 0.35], [-2.4, -6.2, 0.4, 0.3], [-9.6, 1.8, 0.5, 0.25], [6.4, -1.9, 0.35, 0.3], [-4.6, 6.0, 0.55, 0.4], [-8.8, -3.6, 0.3, 0.3]],
  },
  airship: {
    w: 34, seed: 83, tear: [['x', -1.2], ['x', 8.0]],
    // the envelope comes down on itself: flattened to about a third of its height (its ends further), folded across
    flat: { k: 0.36, kEnd: 0.16, fold: 0.38, spread: 0.08 },
    pieces: [
      { name: 'pod', test: (x, y) => y < -2.35, drop: true },
      { name: 'fanFL', test: (x, y, z) => x > 2.6 && z < -5.0, pivot: [5.2, -0.5, -7.2], rx: -1.3, ry: 0.55, move: [1.4, 0, -2.4], dig: 0.08, crumple: 0.1 },
      { name: 'finL', test: (x, y, z) => x < -5.2 && z < -0.2 && y > 0.75, pivot: [-8.5, 0.5, -1.4], rx: 0.95, ry: -0.18, move: [-0.4, 0, -1.6], dig: 0.04, crumple: 0.06 },
      { name: 'finR', test: (x, y, z) => x < -5.2 && z > 0.2 && y > 0.75, parent: 'aft', pivot: [-8.0, 0.6, 1.0], rx: -0.45, crumple: 0.06 },
      { name: 'fanRR', test: (x, y, z) => x < -2.6 && z > 5.0, parent: 'aft', pivot: [-5.4, -0.2, 5.0], rx: 0.38, crumple: 0.12 },
      { name: 'fanRL', test: (x, y, z) => x < -2.6 && z < -5.0, parent: 'aft', pivot: [-5.4, -0.2, -5.0], rx: -0.3, crumple: 0.1 },
      { name: 'fanFR', test: (x, y, z) => x > 2.6 && z > 5.0, parent: 'fore', pivot: [5.2, -0.2, 5.0], rx: 0.26, crumple: 0.1 },
      { name: 'aft', test: (x) => x < -1.2, parent: 'fore', pivot: [-1.2, -0.6, 0], ry: -0.13, move: [0, 0, 0.25], crumple: 0.12 },
      { name: 'nose', test: (x) => x > 8.0, parent: 'fore', pivot: [8.0, -0.6, 0], rz: -0.22, crumple: 0.3 },
      { name: 'fore', dig: 0.2, crumple: 0.12 },
    ],
    holes: [[-3.2, 1.6, 1.7, 1.2, 1.2], [2.6, -1.4, 1.3, 1.0, 1.2], [6.2, 0.9, 0.9, 0.7, 1.2]],
    frames: (add, sec) => {
      for (const x of [-4.6, -3.8, -3.0, -2.2, -1.4, 1.6, 2.4, 3.2, 5.6, 6.4]) { const [w, h] = sec(x); add.rib(x, 0.1, 0, w * 0.93, h * 0.9); }
      add.keel(-5.2, 7.0, 2.1, 0.0); add.keel(-5.2, 3.8, 1.8, 1.4); add.keel(-5.2, 3.8, 1.8, -1.4);
    },
    burn: [[-2.4, 2.0, 0.6, 5.5], [5.4, 2.0, 0.4, 3.2], [-8.6, 1.0, 0, 2.6], [5.2, 0, -7.2, 1.8]],
    debris: [[1.0, 6.6, 0.8, 0.5], [-3.4, -6.8, 0.7, 0.5], [9.6, 3.4, 0.6, 0.4], [-12.4, 2.2, 0.6, 0.4], [3.6, -8.6, 0.5, 0.45], [-7.8, 6.2, 0.5, 0.3], [12.6, -2.4, 0.5, 0.35], [-0.8, 7.8, 0.45, 0.3]],
  },
};

// ---- a little noise (value noise over a hash), the same everywhere the same point is asked
function hash3(x, y, z, s) { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647) ^ Math.imul(s | 0, 1274126177); h = Math.imul(h ^ (h >>> 13), 1103515245); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function noise3(x, y, z, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const sm = (t) => t * t * (3 - 2 * t), u = sm(xf), v = sm(yf), w = sm(zf);
  let r = 0;
  for (let k = 0; k < 8; k++) { const a = k & 1, b = (k >> 1) & 1, c = (k >> 2) & 1; r += hash3(xi + a, yi + b, zi + c, s) * (a ? u : 1 - u) * (b ? v : 1 - v) * (c ? w : 1 - w); }
  return r * 2 - 1;
}
const fbm = (x, y, z, s) => noise3(x, y, z, s) * 0.6 + noise3(x * 2.3, y * 2.3, z * 2.3, s + 7) * 0.3 + noise3(x * 5.1, y * 5.1, z * 5.1, s + 13) * 0.1;

// ---- a triangle soup: the position, normal, uv and colour of each corner, flat arrays
function soup(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone(), n = g.attributes.position.count;
  const get = (name, k, def) => { const a = g.attributes[name]; if (!a) return new Float32Array(n * k).fill(def); const out = new Float32Array(n * k); for (let i = 0; i < n; i++) for (let c = 0; c < k; c++) out[i * k + c] = c < a.itemSize ? a.array[i * a.itemSize + c] : def; return out; };
  return { p: get('position', 3, 0), n: get('normal', 3, 0), uv: get('uv', 2, 0), c: get('color', 3, 1), count: n, groups: g.groups.length ? g.groups : [{ start: 0, count: n, materialIndex: 0 }] };
}
// cut every triangle with an edge longer than `max` in two, at the middle of its longest edge, until none is left
function subdivide(tris, max) {
  const out = [], stack = tris.slice(), m2 = max * max;
  while (stack.length) {
    const t = stack.pop(), P = t.map((v) => v.p), d = [0, 1, 2].map((k) => { const a = P[k], b = P[(k + 1) % 3]; return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2; });
    const k = d.indexOf(Math.max(...d));
    if (d[k] <= m2 || stack.length + out.length > 400000) { out.push(t); continue; }
    const A = t[k], B = t[(k + 1) % 3], C = t[(k + 2) % 3], mid = {};
    for (const key in A) mid[key] = A[key].map((v, i) => (v + B[key][i]) / 2);
    stack.push([A, mid, C], [mid, B, C]);
  }
  return out;
}

export default function (L) {
  const { THREE, M } = L, p = new URLSearchParams(location.search), type = p.get('c') || 'cargoplane', D = WRECKS[type];
  if (!D) throw new Error('unknown wreck ' + type);
  // ---- the aircraft, built by its own scene
  let sec = () => [1, 1];
  if (type === 'cargoplane' || type === 'bomber') {
    (type === 'bomber' ? bomberScene : planeScene)(L); // (each sets up its own lights and camera; the camera is replaced below)
  } else {
    if (!AIR) throw new Error('the Airship wreck is built from b/airship.js (branch airship-art): check it out into b/ first');
    L.seed(4040 + 'c'.charCodeAt(0));
    kit(L, 0, 0);
    const G = L.group();
    AIR.buildAirship(L, 'c', G);
    const bb = new THREE.Box3().setFromObject(G); G.position.x = -(bb.min.x + bb.max.x) / 2;
    // the envelope's section (half-width, height) along it, for the ring frames (as airship.js's `prof`)
    const prof = [[11.0, 0.5, 0.35], [10.2, 2.4, 1.45], [8.4, 4.1, 2.2], [5.8, 4.8, 2.5], [-3.0, 4.8, 2.5], [-6.6, 4.3, 2.25], [-9.2, 2.9, 1.5], [-10.6, 1.4, 0.75], [-11.0, 0.5, 0.35]];
    sec = (x) => { for (let i = 0; i < prof.length - 1; i++) { const [xa, wa, ha] = prof[i], [xb, wb, hb] = prof[i + 1]; if (x <= xa && x >= xb) { const t = (xa - x) / (xa - xb); return [wa + (wb - wa) * t, ha + (hb - ha) * t]; } } return [0.3, 0.3]; };
  }
  const root = L.getRoot(), scene = L.getScene();
  L.seed(D.seed);

  // ---- materials, charred: paint darkened and dulled, every glowing part dead and black
  const soot = new THREE.MeshStandardMaterial({ color: '#25211e', roughness: 0.92, metalness: 0.25, vertexColors: true, side: THREE.DoubleSide }); soot.envMapIntensity = 0.12;
  const charred = new Map();
  function charMat(m) {
    if (charred.has(m)) return charred.get(m);
    let c;
    if ((m.userData && m.userData.glow) || (m.emissive && m.emissive.getHex() && m.emissiveIntensity > 0) || m.isMeshPhysicalMaterial) c = soot;
    else {
      c = m.clone();
      if (c.color) c.color.multiplyScalar(m.transparent ? 0.55 : 0.8);
      c.roughness = Math.min(1, (m.roughness ?? 0.7) + 0.18); c.metalness = (m.metalness ?? 0.2) * 0.55;
      c.envMapIntensity = (m.envMapIntensity ?? 0.5) * 0.45; c.vertexColors = true; c.side = THREE.DoubleSide;
      if (c.emissive) c.emissive.setRGB(0, 0, 0);
    }
    // the inside of the skin (its back faces, seen through a tear or a hole) is black with soot
    if (c !== soot && !c.transparent) {
      c.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n  if (!gl_FrontFacing) diffuseColor.rgb *= 0.18;'); };
      c.customProgramCacheKey = () => 'wreck-inside';
    }
    charred.set(m, c);
    return c;
  }

  // ---- extra structure: ring frames and keel girders inside the hull, seen where the skin has burned away
  const frame = M.plain('#8a847a', 0.6, 0.55), frameMat = charMat(frame);
  const add = {
    rib(x, yc, zc, rz, ry) { const g = new THREE.TorusGeometry(1, 0.085, 6, 48); g.scale(1, ry, rz); g.rotateY(Math.PI / 2); L.mesh(g, frame, x, yc, zc, { dirt: 0 }); },
    keel(x0, x1, y, z) { L.box(x1 - x0, 0.14, 0.18, frame, (x0 + x1) / 2, y - 0.06, z, { dirt: 0 }); },
  };
  D.frames(add, sec);

  // ---- every mesh into world space, cut small; each triangle to its piece
  root.updateMatrixWorld(true);
  const pieces = D.pieces.map((q) => ({ ...q, tris: new Map() })), byName = Object.fromEntries(pieces.map((q) => [q.name, q]));
  const meshes = []; root.traverse((o) => { if (o.isMesh && o.visible) meshes.push(o); });
  for (const o of meshes) {
    const g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld);
    const S = soup(g), mats = [].concat(o.material);
    for (const gr of S.groups) {
      const mat = mats[gr.materialIndex ?? 0] || mats[0];
      if (!mat || mat.visible === false) continue;
      const tris = [];
      for (let i = gr.start; i < Math.min(S.count, gr.start + gr.count); i += 3) {
        tris.push([0, 1, 2].map((k) => { const v = i + k; return { p: [S.p[v * 3], S.p[v * 3 + 1], S.p[v * 3 + 2]], n: [S.n[v * 3], S.n[v * 3 + 1], S.n[v * 3 + 2]], uv: [S.uv[v * 2], S.uv[v * 2 + 1]], c: [S.c[v * 3], S.c[v * 3 + 1], S.c[v * 3 + 2]] }; }));
      }
      const key = { mat: charMat(mat), decal: !!o.userData.decal || mat.transparent, cast: o.castShadow };
      for (const t of subdivide(tris, key.decal ? 1.2 : 0.42)) {
        const cx = (t[0].p[0] + t[1].p[0] + t[2].p[0]) / 3, cy = (t[0].p[1] + t[1].p[1] + t[2].p[1]) / 3, cz = (t[0].p[2] + t[1].p[2] + t[2].p[2]) / 3;
        const pc = pieces.find((q) => !q.test || q.test(cx, cy, cz));
        if (pc.drop) continue;
        // burned through: a hole in the top skin (everything above the hole's height, frames apart)
        if (key.mat !== frameMat && D.holes.some(([hx, hz, rx, rz, hy]) => cy > hy && ((cx - hx) / rx) ** 2 + ((cz - hz) / rz) ** 2 + 0.25 * fbm(cx * 1.6, 0, cz * 1.6, 5) < 1)) continue;
        if (!pc.tris.has(key.mat)) pc.tris.set(key.mat, { key, list: [] });
        pc.tris.get(key.mat).list.push(t);
      }
    }
    o.parent.remove(o);
  }
  for (const o of [...root.children]) if (!o.isLight) root.remove(o);

  // ---- where it tore, how hard each piece is crushed, and the envelope's collapse
  const tearAt = (x, y, z) => { let k = 0; for (const [ax, at] of D.tear) { const d = Math.abs((ax === 'x' ? x : z) - at); if (d < 0.9) k = Math.max(k, 1 - d / 0.9); } return k; };
  const F = D.flat;
  let y0 = Infinity, y1 = -Infinity;
  if (F) for (const q of pieces) for (const { list } of q.tris.values()) for (const t of list) for (const v of t) { y0 = Math.min(y0, v.p[1]); y1 = Math.max(y1, v.p[1]); }
  const moved = new Map(); // (one answer per corner point, so the triangles stay joined)
  function bend(v, q) {
    const key = v.p.map((a) => Math.round(a * 2000)).join(',');
    let r = moved.get(key);
    if (!r) {
      let [x, y, z] = v.p;
      if (F) {
        const h = (y - y0) / (y1 - y0), ends = Math.min(1, Math.abs(x) / 11);
        const k = F.k - (F.k - F.kEnd) * ends * ends;
        y = y0 + (y - y0) * k + F.fold * Math.sin(x * 1.7 + 1.3 * Math.sin(z * 0.45)) * h + 0.12 * fbm(x * 0.5, 0, z * 0.5, 3) * h;
        z *= 1 + F.spread * (1 - h);
      }
      // dents everywhere (two scales), torn edges ragged
      const amp = (q.crumple || 0.05) * 1.6 + 0.42 * tearAt(v.p[0], v.p[1], v.p[2]), s = 1.35, S2 = 0.45;
      x += amp * 0.9 * fbm(v.p[0] * s, v.p[1] * s, v.p[2] * s, 11);
      y += amp * (fbm(v.p[0] * s, v.p[1] * s, v.p[2] * s, 17) - 0.45) + (q.crumple || 0.05) * 1.4 * (fbm(v.p[0] * S2, 0, v.p[2] * S2, 19) - 0.3);
      z += amp * 0.9 * fbm(v.p[0] * s, v.p[1] * s, v.p[2] * s, 23);
      r = [x, y, z];
      moved.set(key, r);
    }
    return r;
  }
  // ---- the char: soot over the hottest places, heat-browned metal round them, a little scorched paint showing
  function charOf(x, y, z) {
    let heat = 0;
    for (const [bx, by, bz, br] of D.burn) heat += Math.exp(-((x - bx) ** 2 + (y - by) ** 2 * 0.5 + (z - bz) ** 2) / (br * br));
    heat = heat * 0.8 + 0.38 * fbm(x * 0.6, y * 0.6, z * 0.6, 29) + 0.12;
    const spot = fbm(x * 2.1, y * 2.1, z * 2.1, 31), fleck = fbm(x * 6, y * 6, z * 6, 37);
    const k = Math.max(0, Math.min(1, heat + 0.22 * spot));
    // paint, scorched paint, heat-browned and blistered, soot; where it burned hottest the alloy has burned to grey-white ash
    const paint = [0.98, 0.96, 0.93], scorch = [0.78, 0.6, 0.47], brown = [0.55, 0.34, 0.2], black = [0.09, 0.08, 0.075], ash = [1.3, 1.26, 1.2];
    const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * Math.max(0, Math.min(1, t)));
    let c = k < 0.25 ? mix(paint, scorch, k / 0.25) : k < 0.5 ? mix(scorch, brown, (k - 0.25) / 0.25) : mix(brown, black, (k - 0.5) / 0.22);
    if (k > 0.7) c = mix(c, ash, (spot + 0.35 * fleck - 0.2) * 2.6 * Math.min(1, (k - 0.7) / 0.15));
    return c;
  }

  // ---- the pieces: built, moved into place, laid on the ground
  const built = new Map();
  function matrixOf(q) {
    const P = q.pivot || [0, 0, 0], mv = q.move || [0, 0, 0];
    const R = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(q.rx || 0, q.ry || 0, q.rz || 0, 'ZYX'));
    return new THREE.Matrix4().makeTranslation(P[0] + mv[0], P[1] + mv[1], P[2] + mv[2]).multiply(R).multiply(new THREE.Matrix4().makeTranslation(-P[0], -P[1], -P[2]));
  }
  function build(q) {
    if (built.has(q.name)) return built.get(q.name);
    let Mx = matrixOf(q);
    if (q.parent) Mx = build(byName[q.parent]).clone().multiply(Mx);
    const geos = [];
    for (const { key, list } of q.tris.values()) {
      const n = list.length * 3, pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = new Float32Array(n * 3);
      let i = 0;
      for (const t of list) for (const v of t) {
        const b = key.decal ? v.p : bend(v, q), c = key.mat === frameMat ? [0.8, 0.72, 0.64] : charOf(v.p[0], v.p[1], v.p[2]); // (the frames: scorched steel)
        pos.set(b, i * 3); uv.set(v.uv, i * 2); col.set([v.c[0] * c[0], v.c[1] * c[1], v.c[2] * c[2]], i * 3); i++;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      g.applyMatrix4(Mx); g.computeVertexNormals();
      geos.push([g, key]);
    }
    // a piece lying loose rests on the ground, its lowest point dug in a little
    if (!q.parent) {
      let lo = Infinity;
      for (const [g] of geos) { g.computeBoundingBox(); lo = Math.min(lo, g.boundingBox.min.y); }
      if (lo < Infinity) { const dy = -(q.dig || 0.1) - lo; for (const [g] of geos) g.translate(0, dy, 0); Mx = new THREE.Matrix4().makeTranslation(0, dy, 0).multiply(Mx); }
    }
    for (const [g, key] of geos) {
      const m = new THREE.Mesh(g, key.mat); m.castShadow = key.cast && !key.decal; m.receiveShadow = true;
      if (key.decal) { m.userData.decal = true; m.renderOrder = 2; }
      root.add(m);
    }
    built.set(q.name, Mx);
    return Mx;
  }
  for (const q of pieces) if (!q.drop) build(q);

  // ---- torn panels and fragments lying round it
  const panel = M.paint('#3a4046');
  D.debris.forEach(([x, z, a, b], k) => {
    const g = new THREE.BoxGeometry(a, 0.05, b, 3, 1, 3), pa = g.attributes.position;
    for (let i = 0; i < pa.count; i++) pa.setY(i, pa.getY(i) + 0.05 * noise3(pa.getX(i) * 4, k, pa.getZ(i) * 4, 41));
    g.computeVertexNormals();
    const cc = new Float32Array(pa.count * 3); for (let i = 0; i < pa.count; i++) cc.set(charOf(x + pa.getX(i), 1.5, z + pa.getZ(i)), i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(cc, 3));
    const m = new THREE.Mesh(g, charMat(panel)); m.position.set(x, 0.03, z); m.rotation.set(0.12 * noise3(k, 1, 2, 43), 6.28 * hash3(k, 3, 5, 47), 0.15 * noise3(k, 4, 1, 53));
    m.castShadow = true; m.receiveShadow = true; root.add(m);
  });

  // ---- the ground keeps only the shadows on it (what dug in stays in sight below it: it's under the wreck, and it's what
  // shows through the holes)
  const W = +(p.get('w') || D.w);
  const catcher = new THREE.Mesh(new THREE.PlaneGeometry(W * 3, W * 3), new THREE.ShadowMaterial({ opacity: 0.5 }));
  catcher.rotation.x = -Math.PI / 2; catcher.position.y = 0.002; catcher.receiveShadow = true; catcher.userData.decal = true; root.add(catcher);

  // ---- the sun from its own quarter but high (at least 52 degrees: the game turns the wreck any way, so its shadows are
  // kept short), its shadow box over the whole frame; the camera
  scene.traverse((o) => {
    if (!o.isDirectionalLight || !o.castShadow) return;
    const d = o.position.clone(), hz = Math.hypot(d.x, d.z) || 1, el = Math.max(Math.atan2(d.y, hz), 52 * Math.PI / 180);
    o.position.set((d.x / hz) * Math.cos(el) * 30, Math.sin(el) * 30, (d.z / hz) * Math.cos(el) * 30);
    const c = o.shadow.camera; c.left = c.bottom = -W * 0.62; c.right = c.top = W * 0.62; c.far = 90; c.updateProjectionMatrix(); o.shadow.radius = 4;
  });
  const cam = new THREE.OrthographicCamera(-W / 2, W / 2, W / 2, -W / 2, 0.1, 100);
  cam.position.set(0, 40, 0); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  L.useCamera(cam);
}

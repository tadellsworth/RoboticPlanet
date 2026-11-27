// Half underground's cave mouths (js/world.js cavesMap): where the solid wall between the surface and the caves opens.
// A wall section seen in the game's terrain projection: straight down for the ground (one map tile = 2 world units =
// 64 px after compose, so tiles join the map exactly), heights shifted up the screen by cot 57° (the buildings' camera
// angle), so a face that looks south shows as it does on a building. Rendered as one strip that the game cuts at the
// middle and closes up to the gap's width (js/render.js, caveMouths):
//   [left cheek, 8 tiles | 7 tiles of roof lip | 7 tiles of roof lip | right cheek, 8 tiles]
// with a keystone piece drawn over the cut.
//   ?c=arch|portal|breach   the concept: a natural rock arch, an Accord-era portal, a collapsed breach
//   ?face=s|n               the side the surface is on: s (the caves north of the wall), n (the caves south)
//   ?part=all|floor|rock|lip|key
//       all    every piece (the concept heroes, and the glow pass the game adds after dark)
//       floor  what lies flat on the ground (the threshold, scree, the shadows): drawn with the ground, graded with it
//       rock   the cheeks: the wall rising either side, drawn after the ground under the robots
//       lip    the roof's edge across the gap, drawn over the robots (they pass under it)
//       key    the keystone over the cut, alone
//   ?w=<tiles>  all only: the two halves closed up to a gap this wide (the concept heroes)
// The frame is fixed: x -30..30 units (30 tiles), z -10..10 (10 tiles); the roof's line (where the caves begin) at z 0,
// the middle of the frame; the cheeks' inner faces at x = -14 and 14.
const P = new URLSearchParams(location.search);
const C = P.get('c') || 'arch', FACE = P.get('face') || 's', PART = P.get('part') || 'all';
const SG = FACE === 's' ? 1 : -1; // +z is south; the caves lie where z * SG < 0
const PPT = 128;                  // render pixels a tile (64 after compose)
const HALF_W = 30, HALF_H = 10;   // frame half extents, world units
const KEY = PART === 'key';
const KW = 8, KH = 8;             // the keystone's frame (units)
export const config = { pad: false, w: KEY ? KW / 2 * PPT : HALF_W * PPT, h: KEY ? KH / 2 * PPT : HALF_H * PPT };
const LIPX = 14;                  // the lip runs x -14..14 (7 tiles each side of the cut); the cheeks begin there
const K = 1 / Math.tan(57 * Math.PI / 180);

let L, THREE;

// ---------- noise ----------
function hash3(x, y, z) { let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(z | 0, 1442695041); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const s = (t) => t * t * (3 - 2 * t), u = s(xf), v = s(yf), w = s(zf), l = (a, b, t) => a + (b - a) * t, c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz);
  return l(l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v), l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v), w);
}
const fbm = (x, y, z, o = 4) => { let a = 0, f = 1, amp = 0.5; for (let k = 0; k < o; k++) { a += amp * vnoise(x * f, y * f, z * f); f *= 2.03; amp *= 0.5; } return a; };
const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------- materials ----------
let rockMat, rockDark, concrete, steel, hazard, paint;
async function materials() {
  // The Hollow's own rock texture (what the wall is drawn with), lifted: laid flat it is dark for the ground; the game
  // grades this art with the caves' light, as it does the wall.
  const img = await new THREE.ImageLoader().loadAsync('/art/biomes/hollow/rock.webp');
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < d.data.length; i += 4) for (let k = 0; k < 3; k++) d.data[i + k] = Math.min(255, Math.pow(d.data[i + k] / 255, 0.75) * 255 * 1.12 + 4);
  g.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  rockMat = new THREE.MeshStandardMaterial({ map: t, roughness: 0.92, metalness: 0, vertexColors: true, side: THREE.DoubleSide }); rockMat.envMapIntensity = 0.45;
  rockDark = new THREE.MeshStandardMaterial({ map: t, color: 0x9088a0, roughness: 0.95, metalness: 0, vertexColors: true }); rockDark.envMapIntensity = 0.3;
  concrete = L.M.rough('#9a9285'); steel = L.M.steel; hazard = L.M.hazard; paint = L.M.paint('#50565c', { rivets: false });
}

function planarUV(geo, scale = 8) {
  const p = geo.attributes.position, n = p.count, uv = new Float32Array(n * 2);
  if (!geo.attributes.normal) geo.computeVertexNormals();
  const nm = geo.attributes.normal;
  for (let i = 0; i < n; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), ny = Math.abs(nm.getY(i)), nx = Math.abs(nm.getX(i));
    if (ny > 0.55) { uv[i * 2] = x / scale; uv[i * 2 + 1] = z / scale; } else if (nx > 0.6) { uv[i * 2] = z / scale; uv[i * 2 + 1] = y / scale; } else { uv[i * 2] = x / scale; uv[i * 2 + 1] = y / scale; }
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}
function shade(geo, fn) {
  const p = geo.attributes.position, col = new Float32Array(p.count * 3);
  if (!geo.attributes.normal) geo.computeVertexNormals();
  const nm = geo.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    const v = fn(p.getX(i), p.getY(i), p.getZ(i));
    // (steep faces darker than tops, the crevices darker still: the relief reads from above)
    const ny = nm.getY(i), k = 0.55 + 0.45 * Math.max(0, ny) * Math.max(0, ny);
    col[i * 3] = v[0] * k; col[i * 3 + 1] = v[1] * k; col[i * 3 + 2] = v[2] * k;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
}
let STRATA = 0;
// rock: darker low down; strata bands for the arch; a faint warm dust on the surface side
const rockShade = (x, y, z) => {
  const n = fbm(x * 0.6, y * 0.6, z * 0.6, 3), band = STRATA ? 0.12 * Math.sin(y * STRATA + fbm(x * 0.3, 0, z * 0.3, 2) * 3) : 0;
  const d = 0.66 + 0.34 * sm(0, 2.4, y) + (n - 0.5) * 0.45 + band, surf = sm(0, 3, -z * SG);
  return [d * (0.95 + 0.1 * surf), d * (0.92 + 0.04 * surf), d * (1.02 - 0.06 * surf)];
};
// tags: floor (flat on the ground), lip, key; untagged is rock
function add(geo, mat, tag) { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; if (tag) m.userData[tag] = true; L.getRoot().add(m); return m; }
function tagLast(tag, n = 1) { const ch = L.getRoot().children; for (let k = 1; k <= n; k++) ch[ch.length - k].traverse((o) => { o.userData[tag] = true; }); }

/** A rock: a displaced sphere, flattened under y = 0, rx/ry/rz its radii. */
function rock(cx, cy, cz, rx, ry, rz, o = {}) {
  const geo = new THREE.IcosahedronGeometry(1, o.detail ?? 3), p = geo.attributes.position, sd = o.seed ?? (cx * 7.1 + cz * 3.3);
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + (fbm(x * 1.6 + sd, y * 1.6, z * 1.6 - sd, 4) - 0.5) * (o.rough ?? 0.55);
    x = x * rx * k + cx; y = Math.max(-0.05, y * ry * k + cy); z = z * rz * k + cz;
    p.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals(); planarUV(geo); shade(geo, o.shade || rockShade);
  return add(geo, o.mat || rockMat, o.tag);
}

/** A sweep along x: at each x a closed cross-section of points (z, y) from sect(x, v), v 0..1 round it. */
function sweep(x0, x1, nx, nv, sect, mat, tag) {
  const pos = [], idx = [];
  for (let i = 0; i <= nx; i++) { const x = x0 + (x1 - x0) * i / nx; for (let j = 0; j < nv; j++) { const [z, y] = sect(x, j / nv); pos.push(x, y, z); } }
  for (let i = 0; i < nx; i++) for (let j = 0; j < nv; j++) { const a = i * nv + j, b = i * nv + (j + 1) % nv, c = a + nv, d = b + nv; idx.push(a, c, b, b, c, d); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx);
  geo.computeVertexNormals(); planarUV(geo); shade(geo, rockShade);
  return add(geo, mat, tag);
}

/**
 * A heightfield over x0..x1, z0..z1 (step `st`): h(x, z) the height, a(x, z) its alpha (0 lets the game's own wall show).
 * The cheeks and the roof over the gap are made this way.
 */
function field(x0, x1, z0, z1, st, h, a, mat, tag) {
  if (x1 < x0) [x0, x1] = [x1, x0];
  if (z1 < z0) [z0, z1] = [z1, z0];
  const nx = Math.round((x1 - x0) / st), nz = Math.round((z1 - z0) / st), pos = [], al = [], idx = [];
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) { const x = x0 + (x1 - x0) * i / nx, z = z0 + (z1 - z0) * j / nz; pos.push(x, h(x, z), z); al.push(a ? a(x, z) : 1); }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const p = j * (nx + 1) + i; idx.push(p, p + nx + 1, p + 1, p + 1, p + nx + 1, p + nx + 2); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx);
  geo.computeVertexNormals(); planarUV(geo); shade(geo, rockShade);
  const col = geo.attributes.color, c4 = new Float32Array(col.count * 4);
  for (let i = 0; i < col.count; i++) { c4[i * 4] = col.getX(i); c4[i * 4 + 1] = col.getY(i); c4[i * 4 + 2] = col.getZ(i); c4[i * 4 + 3] = al[i]; }
  geo.setAttribute('color', new THREE.BufferAttribute(c4, 4));
  let m = mat;
  if (a) { m = mat.clone(); m.transparent = true; m.vertexColors = true; m.depthWrite = true; m.userData.fade = true; }
  const mesh = add(geo, m, tag); mesh.userData.fade = !!a; return mesh;
}

// ---------- the frame: the terrain projection ----------
function camera() {
  let x0 = -HALF_W, x1 = HALF_W, z0 = -HALF_H, z1 = HALF_H;
  if (KEY) { x0 = -KW / 2; x1 = KW / 2; z0 = -KH / 2 - 1.5 * SG; z1 = KH / 2 - 1.5 * SG; }
  const cam = new THREE.OrthographicCamera(x0, x1, -z0, -z1, 0.1, 400);
  cam.position.set(0, 100, 0); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  // straight down (view y = -world z, depth = height), then heights shifted up the screen: view y += K * world y
  const sh = new THREE.Matrix4().set(1, 0, 0, 0, 0, 1, K, 100 * K, 0, 0, 1, 0, 0, 0, 0, 1);
  cam.projectionMatrix.multiply(sh); cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
  cam.updateProjectionMatrix = () => {};
  L.useCamera(cam);
}
function widenShadows() {
  L.getScene().traverse((o) => { if (o.isDirectionalLight && o.castShadow) { const c = o.shadow.camera; c.left = -36; c.right = 36; c.top = 36; c.bottom = -36; c.far = 140; c.updateProjectionMatrix(); o.shadow.mapSize.set(6144, 6144); } });
}
function shadowCatcher() {
  const g = new THREE.PlaneGeometry(HALF_W * 2 + 4, HALF_H * 2 + 8); g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, new THREE.ShadowMaterial({ opacity: 0.55 })); m.receiveShadow = true; m.position.y = 0.004; m.userData.catcher = true; m.userData.floor = true; L.getRoot().add(m);
}

const zc = (d) => -d * SG; // the z at depth d into the caves (d < 0: out on the surface)
const BAND_C = 6, BAND_S = 4; // the wall: 3 tiles on the caves' side of the line, 2 on the surface's

/**
 * The cheeks: the wall rising either side of the gap, a ridge along the band, highest at the gap (crest `top`) and
 * sinking into the flat wall outward (gone `fade` units out), its faces steep. rough: how broken its crest.
 */
function cheeks(cx, top, o = {}) {
  const fade = o.fade ?? 13, rough = o.rough ?? 1;
  for (const s of [-1, 1]) {
    const x0 = s < 0 ? -cx - fade - 2 : cx, x1 = s < 0 ? -cx : cx + fade + 2;
    const H = (x, z) => {
      const u = Math.abs(x) - cx, d = -z * SG; // d: depth into the caves
      const t = (d + BAND_S) / (BAND_S + BAND_C); // 0 at the surface face, 1 at the caves' face
      const prof = sm(-0.02, 0.36, t) * sm(1.02, 0.72, t);
      const crest = (top * (1 - sm(1.5, fade - 2, u)) + 0.35) * (1 + (fbm(x * 0.22, 3.3, z * 0.22, 3) - 0.5) * 0.9 * rough);
      const n = (fbm(x * 0.7, 1.1, z * 0.7, 4) - 0.5) * 1.6 * rough + (Math.abs(fbm(x * 0.35, 4.2, z * 0.35, 3) - 0.5) * 2 - 0.25) * 1.4 * rough;
      // the end at the gap: a steep face
      const end = sm(-0.05, 0.9 + 0.5 * fbm(1.3, z * 0.8, x * 0.1, 2), u);
      return Math.max(0, (crest * prof + n * prof) * end) + (o.lift || 0);
    };
    const A = (x, z) => { const u = Math.abs(x) - cx, d = -z * SG, t = (d + BAND_S) / (BAND_S + BAND_C); return (1 - sm(fade - 3, fade + 1.5, u)) * sm(-0.1, 0.06, t) * sm(1.1, 0.94, t); };
    field(x0, x1, zc(BAND_C + 0.6), zc(-BAND_S - 0.6), 0.12, H, A, rockMat);
  }
}

export default async function (lib) {
  L = lib; THREE = L.THREE; L.seed(4100 + C.length * 13 + (FACE === 's' ? 0 : 7));
  await materials();
  camera(); widenShadows(); shadowCatcher();
  const W = +(P.get('w') || 0);
  ({ arch, portal, breach })[C](W);
  if (P.get('nokey')) L.getRoot().traverse((o) => { if (o.userData.key) o.visible = false; });
  // The passes: each shows its own pieces; the rest are there (shadows, and hiding what is behind them) but draw nothing.
  const U = (o) => o.userData;
  const want = (o) => PART === 'all' ? true : PART === 'floor' ? !!U(o).floor : PART === 'lip' ? !!U(o).lip : PART === 'key' ? !!U(o).key : !U(o).floor && !U(o).lip && !U(o).key;
  L.getRoot().traverse((o) => {
    if (!o.isMesh || want(o)) return;
    if (U(o).catcher || PART === 'key' || (PART === 'rock' && U(o).floor) || (PART === 'lip' && (U(o).floor || U(o).key))) { o.visible = false; return; }
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const hid = mats.map((m) => { const c = m.clone(); c.colorWrite = false; if (PART === 'floor') c.depthWrite = false; c.transparent = false; c.userData = {}; return c; });
    o.material = Array.isArray(o.material) ? hid : hid[0];
  });
}

/** The cheeks' inner faces for a gap `w` tiles wide shown closed up (0: the full strip). */
const cheekX = (W) => (W ? W : LIPX);

/** The roof over the gap, faded into the caves past its edge: h(x, d) its top, front at d = 0. */
function roofFade(span, top, o = {}) {
  field(-span - 1, span + 1, zc(o.from ?? 0.4), zc(o.to ?? 4.5), 0.12,
    (x, z) => { const d = -z * SG; return top + (fbm(x * 0.6, 7.7, z * 0.6, 3) - 0.5) * 0.9 + sm(1, 4, d) * 0.4; },
    (x, z) => { const d = -z * SG; return sm(o.to ?? 4.5, o.from ?? 0.4, d) * 0.92; }, o.mat || rockMat, 'lip');
}

// ===================================================================== A: a natural rock arch
function arch(W) {
  const cx = cheekX(W), span = cx; STRATA = 5.5;
  cheeks(cx, 3.6, { rough: 0.8 });
  // the arch: the wall carried on over the gap as a thick rock span, its front face over the line, slightly overhanging,
  // its underside 1.7 units up, ragged, with drips hanging under the front edge
  // (the section, depth into the caves d and height y, round from the front's foot: front face, top, back, underside)
  const SEC = [[0.05, 1.6], [-0.2, 2.5], [-0.1, 3.3], [0.6, 3.55], [1.8, 3.5], [2.6, 3.3], [2.6, 2.4], [1.9, 2.0], [0.9, 1.75]];
  const secAt = (v) => { const f = v * SEC.length, i = Math.floor(f) % SEC.length, j = (i + 1) % SEC.length, t = f - Math.floor(f); return [SEC[i][0] + (SEC[j][0] - SEC[i][0]) * t, SEC[i][1] + (SEC[j][1] - SEC[i][1]) * t]; };
  sweep(-span - 2, span + 2, 180, 36, (x, v) => {
    const [d, y] = secAt(v), n = fbm(x * 0.5, v * 4, 2.7, 4) - 0.5, n2 = fbm(x * 1.4, v * 7, 9.1, 3) - 0.5;
    const sag = 0.3 * (1 - Math.pow(x / (span + 2), 2));
    return [zc(d + (n * 0.6 + n2 * 0.25) * (d < 1.5 ? 1 : 0.5)), y - sag * (y < 2.6 ? 1 : 0.3) + (n * 0.5 + n2 * 0.2)];
  }, rockMat, 'lip');
  roofFade(span, 3.35, { from: 2.2, to: SG > 0 ? 4.4 : 3.0 });
  for (let k = 0; k < 46; k++) {
    const x = (L.rnd() * 2 - 1) * (span + 0.5), h = 0.25 + L.rnd() * 0.55, r = 0.07 + L.rnd() * 0.1;
    const g = new THREE.ConeGeometry(r, h, 7, 1); g.rotateX(Math.PI); g.translate(x, 1.7 - h / 2 + 0.05, zc(-0.05 + L.rnd() * 0.9));
    g.computeVertexNormals(); planarUV(g); shade(g, rockShade); add(g, rockDark, 'lip');
  }
  // Bloom knots on the underside, the caves' side: violet, faint (the only light it has of its own)
  const bloom = L.M.crystal('#8a5cff', '#a77bff', 0.9);
  for (let k = 0; k < 14; k++) {
    L.crystal(0.06 + L.rnd() * 0.05, 0.16 + L.rnd() * 0.2, 0.1, bloom, (L.rnd() * 2 - 1) * (span - 0.5), 1.7, zc(1.0 + L.rnd() * 0.6), Math.PI + (L.rnd() - 0.5) * 0.6, (L.rnd() - 0.5) * 0.6);
    tagLast('lip');
  }
  // scree at the cheeks' feet, on the floor
  for (const s of [-1, 1]) {
    for (let k = 0; k < 40; k++) {
      const d = -BAND_S - 0.6 + L.rnd() * 1.1, x = s * (cx + L.rnd() * 9 - 0.4), r = 0.1 + L.rnd() * 0.26;
      rock(x, 0, zc(d), r, r * 0.6, r, { detail: 1, rough: 0.6, seed: k + s * 40, tag: 'floor' });
    }
    for (let k = 0; k < 16; k++) {
      const d = -BAND_S + 0.2 + L.rnd() * (BAND_S + BAND_C - 0.4), x = s * (cx - 0.15 - L.rnd() * 0.55), r = 0.08 + L.rnd() * 0.2;
      rock(x, 0, zc(d), r, r * 0.6, r, { detail: 1, rough: 0.6, seed: k * 3 + s * 70, tag: 'floor' });
    }
    // a Bloom knot glowing at the foot of each cheek inside
    L.crystal(0.09, 0.3, 0.14, bloom, s * (cx - 0.4), 0, zc(BAND_C - 1.2), 0.3 * s, 0.2); tagLast('floor');
    L.crystal(0.07, 0.22, 0.1, bloom, s * (cx - 0.7), 0, zc(BAND_C - 0.8), -0.2, -0.3 * s); tagLast('floor');
  }
  // the keystone: a hanging lobe of rock with a knot of Bloom crystal in it
  const g = new THREE.IcosahedronGeometry(1, 3), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const n = fbm(p.getX(i) * 1.7 + 3, p.getY(i) * 1.7, p.getZ(i) * 1.7, 4) - 0.5; p.setXYZ(i, p.getX(i) * 1.3 * (1 + n * 0.5), p.getY(i) * 1.0 * (1 + n * 0.5) + 2.5, zc(0.55) + p.getZ(i) * 0.9 * (1 + n * 0.5)); }
  g.computeVertexNormals(); planarUV(g); shade(g, rockShade); add(g, rockMat, 'key');
  for (let k = 0; k < 5; k++) { L.crystal(0.09, 0.3 + L.rnd() * 0.2, 0.14, bloom, (L.rnd() - 0.5) * 1.2, 1.55, zc(0.2 + L.rnd() * 0.4), Math.PI + (L.rnd() - 0.5) * 0.7, (L.rnd() - 0.5) * 0.7); tagLast('key'); }
}

// ===================================================================== B: an Accord-era portal
function portal(W) {
  const cx = cheekX(W), span = cx, amber = '#ffa632', warm = '#ffd9a0';
  cheeks(cx + 1.3, 3.4, { rough: 0.7 });
  // the lintel: a cast box beam across the gap with a striped front edge, a steel cap, a row of small lamps on its face
  const x0 = -span - 1, x1 = span + 1;
  L.box(x1 - x0, 0.95, 1.1, concrete, 0, 1.75, zc(0.45)); tagLast('lip');
  L.box(x1 - x0, 0.24, 0.1, hazard, 0, 1.8, zc(-0.12)); tagLast('lip');
  L.box(x1 - x0, 0.14, 1.2, paint, 0, 2.7, zc(0.45)); tagLast('lip');
  for (let x = Math.ceil(x0 / 2) * 2 + 1; x < x1; x += 2) { L.box(0.26, 0.12, 0.08, L.M.emit(warm, 5), x, 2.28, zc(-0.12), { cast: false }); tagLast('lip'); }
  // the roof's rock over it, faded into the caves
  roofFade(span, 3.2, { from: 1.2, to: SG > 0 ? 4.2 : 2.6 });
  for (const s of [-1, 1]) {
    const ix = s * cx;
    // a pylon either side: cast concrete, a hazard band at its foot, an amber cage lamp on its face
    L.box(1.3, 2.85, 1.8, concrete, ix + s * 0.65, 0, zc(0.3));
    L.box(1.34, 0.42, 1.84, hazard, ix + s * 0.65, 0.12, zc(0.3));
    L.box(0.95, 0.32, 0.32, paint, ix + s * 0.65, 2.05, zc(-0.8));
    L.box(0.34, 0.3, 0.22, L.M.emit(amber, 6), ix + s * 0.65, 1.68, zc(-0.78), { cast: false });
    L.pointLight(amber, 10, ix + s * 0.65, 1.8, zc(-1.5), 7);
    // a cable tray from the lamp up into the rock
    L.box(0.14, 0.12, 2.4, paint, ix + s * 1.15, 2.4, zc(0.7));
    // a retaining wall of cast panels along the wall's face either side, the rock heaped behind it
    for (let k = 0; k < 4; k++) L.box(1.85, 1.35 - k * 0.22, 0.5, concrete, ix + s * (1.3 + k * 1.9 + 0.95), 0, zc(-BAND_S + 0.3));
  }
  // the threshold: a concrete apron across the gap on the surface side, a hazard edge where the roof begins, and
  // painted arrows pointing in
  const ax = span + 0.2;
  L.box(ax * 2, 0.05, BAND_S + 0.4, concrete, 0, 0, zc(-BAND_S / 2 - 0.1)); tagLast('floor');
  L.box(ax * 2, 0.06, 0.35, hazard, 0, 0, zc(-0.25)); tagLast('floor');
  for (let x = -ax + 1; x < ax - 0.5; x += 2) {
    const g = new THREE.ConeGeometry(0.34, 0.62, 3); g.rotateX(SG > 0 ? -Math.PI / 2 : Math.PI / 2); g.scale(1, 0.05, 1); g.translate(x, 0.07, zc(-2.3));
    const m = add(g, L.M.plain('#e2d9c0', 0.8), 'floor'); m.castShadow = false;
  }
  // the keystone: a sign plate on the lintel, stencilled in the Accord's survey hand, with a lamp over it
  const sign = L.canvasTex(1024, (g, n) => {
    g.fillStyle = '#c9c5ba'; g.fillRect(0, 0, n, n / 4);
    g.fillStyle = '#d2a326'; g.fillRect(0, 0, n, 22); g.fillRect(0, n / 4 - 22, n, 22);
    g.fillStyle = '#1d1c1a'; g.font = 'bold 92px monospace'; g.textAlign = 'center'; g.fillText('ADIT 3', n / 2, 118);
    g.font = 'bold 48px monospace'; g.fillText('UNSURVEYED BEYOND THIS MARK', n / 2, 196);
    L.blotches(g, n, 50, 6, 30, 0.2); L.speckle(g, n, 5000, 0.2);
  });
  sign.repeat.set(1, 0.25); sign.offset.set(0, 0.75); sign.wrapT = THREE.ClampToEdgeWrapping;
  const sm2 = new THREE.MeshStandardMaterial({ map: sign, roughness: 0.7, metalness: 0.15 });
  const front = SG > 0 ? 4 : 5; // (BoxGeometry faces: +z is 4, -z is 5)
  const mats = [steel, steel, steel, steel, steel, steel]; mats[SG > 0 ? 4 : 5] = sm2;
  // (seen from inside, the plate faces the caves: the same words)
  if (SG < 0) { mats[5] = steel; mats[4] = sm2; }
  const sp = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.85, 0.08), mats);
  sp.position.set(0, 2.22, zc(-0.24) + (SG < 0 ? 0 : 0)); sp.castShadow = true; sp.userData.key = true; L.getRoot().add(sp);
  if (SG < 0) sp.position.z = zc(1.12);
  L.box(0.6, 0.1, 0.18, L.M.emit(warm, 5), 0, 2.72, SG > 0 ? zc(-0.3) : zc(1.18), { cast: false }); tagLast('key');
  void front;
}

// ===================================================================== C: a collapsed breach
function breach(W) {
  const cx = cheekX(W), span = cx;
  cheeks(cx, 3.1, { rough: 1.6 });
  // the roof's broken edge: thick slabs of it hanging at angles, cracked through, the soil above showing
  for (let x = -span - 1.5, k = 0; x < span + 1.5; k++) {
    const w = 1.5 + L.rnd() * 1.6, tilt = (L.rnd() - 0.5) * 0.4, drop = L.rnd() * 0.6;
    const g = new THREE.BoxGeometry(w, 1.0 + L.rnd() * 0.4, 2.0 + L.rnd() * 0.8, 6, 3, 4); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const n = fbm(p.getX(i) * 2 + k * 9, p.getY(i) * 2, p.getZ(i) * 2, 3) - 0.5; p.setXYZ(i, p.getX(i) * (1 + n * 0.25), p.getY(i) + n * 0.35, p.getZ(i) + n * 0.4); }
    g.rotateZ(tilt); g.rotateX(SG * (0.15 + L.rnd() * 0.25));
    g.translate(x + w / 2, 2.5 - drop, zc(1.0 + L.rnd() * 0.3)); g.computeVertexNormals(); planarUV(g); shade(g, rockShade);
    add(g, rockMat, 'lip');
    x += w * (0.8 + L.rnd() * 0.15);
  }
  roofFade(span, 3.0, { from: 1.8, to: SG > 0 ? 4.0 : 2.8 });
  // roots of the surface's plants hanging down through the break
  const rootMat = L.M.plain('#5a4030', 0.9);
  for (let k = 0; k < 22; k++) {
    const x = (L.rnd() * 2 - 1) * (span + 1), pts = []; let y = 2.7, z = zc(0.1);
    for (let q = 0; q < 6; q++) { pts.push(new THREE.Vector3(x + (L.rnd() - 0.5) * 0.3, y, z)); y -= 0.22 + L.rnd() * 0.2; z += SG * (L.rnd() - 0.3) * 0.15; }
    const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.03 + L.rnd() * 0.03, 5); shade(g, () => [1, 1, 1]);
    add(g, rootMat, 'lip');
  }
  for (const s of [-1, 1]) {
    const ix = s * cx;
    // slabs fallen against the cheek
    for (let k = 0; k < 3; k++) {
      const g = new THREE.BoxGeometry(1.3 + L.rnd(), 0.45, 1.7 + L.rnd()); g.rotateZ(s * (0.5 + L.rnd() * 0.4)); g.rotateY(L.rnd() - 0.5);
      g.translate(ix + s * (0.8 + L.rnd() * 0.8), 0.7, zc(-BAND_S + 1.2 + k * 2.8)); g.computeVertexNormals(); planarUV(g); shade(g, rockShade); add(g, rockMat);
    }
    // rubble ramps: broken rock fanning out of each cheek onto the floor of the gap, both sides of the line
    for (let k = 0; k < 70; k++) {
      const t = Math.pow(L.rnd(), 1.4), x = ix - s * t * 2.4 + s * L.rnd() * 0.8, d = -BAND_S - 1.2 + L.rnd() * (BAND_S + BAND_C + 0.6), r = (0.12 + L.rnd() * 0.3) * (1.2 - t * 0.7);
      rock(x, 0, zc(d), r, r * 0.7, r * 1.1, { detail: 1, rough: 0.7, seed: k * 1.7 + s * 30, tag: 'floor' });
    }
  }
  // grit and small stones over the floor of the gap
  for (let k = 0; k < 90; k++) { const x = (L.rnd() * 2 - 1) * span, d = -BAND_S + L.rnd() * (BAND_S + 3), r = 0.05 + L.rnd() * 0.11; rock(x, 0, zc(d), r, r * 0.55, r, { detail: 1, rough: 0.6, seed: k * 5.3, tag: 'floor' }); }
  // the keystone: one big block of the roof come down across the line
  const g = new THREE.IcosahedronGeometry(1, 3), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const n = fbm(p.getX(i) * 1.7, p.getY(i) * 1.7, p.getZ(i) * 1.7, 4) - 0.5; p.setXYZ(i, p.getX(i) * 1.5 * (1 + n * 0.5), Math.max(-0.05, p.getY(i) * 0.8 * (1 + n * 0.5) + 0.35), zc(1.4) + p.getZ(i) * 1.2 * (1 + n * 0.5)); }
  g.computeVertexNormals(); planarUV(g); shade(g, rockShade); add(g, rockMat, 'key');
}

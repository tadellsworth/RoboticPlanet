// The behemoth: three design directions for the biggest Murmur form, for the owner to choose from (a design sheet;
// nothing here is installed). Built with the same kit as every other Murmur (murmur_moleskit.js) and the same body
// plan, palettes and face as murmur_moles.js, so it reads as the same family: near-black velvet, eaten Crystal split out
// through the hide as geodes, spade hands that look a little too much like hands, no eyes, the tendril star for a face.
// What makes these three different from the Brute is scale and age: the crystal has had so long to grow that it has
// become armour, the geodes have cracked open into a glowing core, and the ground breaks under its weight.
//   ?c=harrow | maw | bearer
//     harrow   A: the walking siege mound. A badger-mole the size of a hill, its back a mantle of geode plate and a ridge
//              of crystal spires, a glowing throat under the star. Tears up the ground it walks on; rears and slams.
//     maw      B: the burrowing leviathan. Only ever half seen: a long armoured head and shoulders and two enormous hands
//              breaking up out of a crater, the jaws open on a throat lined with glowing crystal.
//     bearer   C: the carrier. A vast swollen mole-rat, its back a comb of open geode cells where Scuttlers ride and are
//              born, charge sacs glowing along its flanks; it draws charge in from all round it.
//   ?pose=   harrow: walk (f=0..3, in steps of 0.5 for the game's 8 frames) | rear (the wind-up) | slam (the ground
//            breaking) | bite (a lunge, jaws wide, a hand swiping) | hurt | die (f=0 staggering, the seams blazing;
//            f=1 toppling, spires snapped) | fall (dead, on its side, dark)
//            maw:    up (surfaced, the key pose) | heave (moving under the ground) | erupt (bursting up) | sink (dying)
//            bearer: walk (f=0..3) | draw (pulling charge from all round) | birth (Scuttlers climbing out) | fall (dying)
//   ?charge=0..1   how full (default 0.9 here: a behemoth is always well fed); the dying poses pass a low charge
//   ?hero=1&hi=1|2 a 3/4 presentation shot on a patch of ground; ?tod=night etc. as everywhere
// The sprite camera is the creatures' (straight down, facing +x); the frame is W world units across and is meant to be
// drawn FRAME_TILES tiles wide in the game (the Command Base's art is drawn 2.4).
import { molekit } from './murmur_moleskit.js';
import { PAL, coat, plan, face, centreOn, scuttler } from './murmur_moles.js';

const P = new URLSearchParams(location.search);
const C = P.get('c') || 'harrow', HI = +(P.get('hi') || 0), HERO = !!+(P.get('hero') || 0);
// ?px=: the render size (the game's frames: 1280, composed to 640)
export const config = { pad: false, size: +(P.get('px') || 0) || [1024, 2048, 2048][HI] };
const GAME = !!+(P.get('game') || 0);   // the game's frames: every pose centred on the body like the walk, the ground effects left to the game
export const W = 18, FRAME_TILES = 4.8;
const SC = 1.5;                                                         // the models are built in Brute-sized units, then grown

export default function (L) {
  if (!P.has('charge')) history.replaceState(null, '', location.search + '&charge=0.9');
  const K = molekit(L);
  const f = +(P.get('f') || 0), POSE = P.get('pose') || ({ harrow: 'walk', maw: 'up', bearer: 'walk' })[C];
  L.seed({ harrow: 9100, maw: 9200, bearer: 9300 }[C]);
  const heroCam = {
    harrow: { pos: [17, 5.2, 14], at: [0.2, 2.6, 0.2], fov: 40 },
    maw: { pos: [18.5, 6.4, 12], at: [1.0, 1.4, 0], fov: 42 },
    bearer: { pos: [17, 5.2, 14], at: [0.0, 2.4, 0.2], fov: 40 },
  }[C];
  K.camera(W, HERO && heroCam);
  if (HERO && C !== 'maw' && P.get('ground') !== '0') K.heroGround(W * 1.1);
  const G = L.group(0, 0, 0);
  G.scale.setScalar(SC);
  const ctx = { L, K, G, f, pose: POSE };
  const body = C === 'maw' ? maw(ctx) : C === 'bearer' ? bearer(ctx) : harrow(ctx);
  if (body) centreOn(K, G, [body.mesh]);
}

// ---------------------------------------------------------------------------------------------------------------
// shared pieces

// the crystal of a behemoth: the same pale lilac, but older and denser: a little deeper and brighter at the core
const XB = (K) => ({ ...K.XTAL, shell: '#bca4ee', core: '#a868ff', glow: '#9a5cff', k: 1.15, dayCore: 0.6 });

// pivot(B, p, rz, rx): turn group B by rz (pitch, nose up +) and rx (roll) about the point p (in its parent's space)
function pivot(K, B, p, rz = 0, rx = 0) {
  const { THREE } = K;
  B.rotation.set(rx, 0, rz);
  B.updateMatrix();
  const q = new THREE.Vector3(...p).applyEuler(B.rotation);
  B.position.set(p[0] - q.x, p[1] - q.y, p[2] - q.z);
}
// toParent(K, B, P, p): a point in B's space, in P's space
function toParent(K, B, Par, p) { Par.updateMatrixWorld(true); return Par.worldToLocal(B.localToWorld(new K.THREE.Vector3(...p))).toArray(); }

// fissure glow: violet-white light in cracks in the ground or the armour, as bright as it is charged
function fissureMat(K, k = 1) {
  const ch = K.chargeK(K.CHARGE);
  return K.glowMat(K.NIGHTISH ? '#ead8ff' : '#b688ff', (0.5 + 0.9 * ch) * k, K.dimGlow('#a060ff', 3.2 * ch * k));
}
// a jagged crack path from a to b (in the parent's xz plane at height y(x, z)), as points
function crackPath(L, a, b, n, jag, yf) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = a[0] + (b[0] - a[0]) * t + (i && i < n ? (L.rnd() - 0.5) * jag : 0), z = a[1] + (b[1] - a[1]) * t + (i && i < n ? (L.rnd() - 0.5) * jag : 0);
    pts.push([x, yf(x, z), z]);
  }
  return pts;
}

// broken(ctx, o): the ground breaking under it: a disc of the planet's soil (fading out at its edge, so it sits on any
// ground) split by cracks that run out from the centre, the cracks lit from below with the violet of its charge,
// slabs of the crust heaved up along them, clods thrown out. o: { cx, cz, r (radius), n (cracks), lift (slab tilt),
// glow (0..1), clods, air (clods in the air), dust }
function broken(ctx, o) {
  const { L, K, G } = ctx, { THREE } = K, cx = o.cx ?? 0, cz = o.cz ?? 0, R = o.r ?? 4, glow = o.glow ?? 1;
  const yAt = () => 0.03;
  // the cracks: n main ones out from near the centre, each forking once or twice
  const cracks = [];
  for (let i = 0; i < (o.n ?? 9); i++) {
    const a = (i + 0.3 * L.rnd()) / (o.n ?? 9) * Math.PI * 2, r0 = R * (0.08 + 0.12 * L.rnd()), r1 = R * (0.72 + 0.25 * L.rnd());
    const pts = crackPath(L, [cx + Math.cos(a) * r0, cz + Math.sin(a) * r0], [cx + Math.cos(a) * r1, cz + Math.sin(a) * r1], 9, R * 0.09, yAt);
    cracks.push({ pts, w: 1 });
    for (let k = 0; k < 2; k++) if (L.rnd() < 0.7) {
      const s = pts[3 + Math.floor(L.rnd() * 4)], b = a + (L.rnd() < 0.5 ? -1 : 1) * (0.5 + 0.4 * L.rnd()), l = R * (0.25 + 0.25 * L.rnd());
      cracks.push({ pts: crackPath(L, [s[0], s[2]], [s[0] + Math.cos(b) * l, s[2] + Math.sin(b) * l], 5, R * 0.06, yAt), w: 0.6 });
    }
  }
  // the disc: soil, darkened along the cracks and in a ring of crushed ground at the centre, faded out at the rim
  const tex = L.canvasTex(1024, (g, n) => {
    const S = n / (2 * R), X = (x) => (x - cx + R) * S, Z = (z) => (z - cz + R) * S;
    g.fillStyle = '#7a6046'; g.fillRect(0, 0, n, n);
    L.blotches(g, n, 140, 10, 70, 0.22); L.blotches(g, n, 60, 10, 50, 0.12, '255,240,220');
    for (let i = 0; i < 9000; i++) { const v = L.rnd() < 0.5 ? 0 : 255; g.fillStyle = `rgba(${v},${v},${v},${0.05 + 0.12 * L.rnd()})`; g.fillRect(L.rnd() * n, L.rnd() * n, 2, 2); }
    const gr = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n * 0.3); gr.addColorStop(0, 'rgba(20,14,10,0.55)'); gr.addColorStop(1, 'rgba(20,14,10,0)'); g.fillStyle = gr; g.fillRect(0, 0, n, n);
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const c of cracks) for (const [w, col] of [[16, 'rgba(30,20,14,0.35)'], [7, 'rgba(12,8,8,0.9)'], [3, 'rgba(0,0,0,1)']]) {
      g.strokeStyle = col; g.lineWidth = w * c.w * (n / 1024); g.beginPath(); c.pts.forEach((p, i) => (i ? g.lineTo(X(p[0]), Z(p[2])) : g.moveTo(X(p[0]), Z(p[2])))); g.stroke();
    }
  });
  const alpha = L.canvasTex(512, (g, n) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, n, n);
    const gr = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); gr.addColorStop(0, '#fff'); gr.addColorStop(0.62, '#fff'); gr.addColorStop(1, '#000');
    g.fillStyle = gr; g.fillRect(0, 0, n, n);
  }, false);
  const dm = new THREE.MeshStandardMaterial({ map: tex, alphaMap: alpha, transparent: true, depthWrite: false, roughness: 0.95 });
  const dg = new THREE.PlaneGeometry(2 * R, 2 * R).rotateX(-Math.PI / 2);
  const disc = new THREE.Mesh(dg, dm); disc.position.set(cx, 0.01, cz); disc.receiveShadow = true; disc.userData.decal = true; disc.renderOrder = -1; G.add(disc);
  // the light in the cracks
  if (glow > 0) { const fm = fissureMat(K, glow); for (const c of cracks) K.tube(G, c.pts, t => 0.045 * c.w * (1 - 0.6 * t) + 0.01, fm, { n: 40, radial: 5, dirt: 0 }); }
  // slabs of the crust heaved up along the cracks, tilted away from the centre
  const slabM = [K.crust('#6e5640', { rough: 0.96 }), K.crust('#5c4836', { rough: 0.96 }), K.crust('#80664c', { rough: 0.96 })];
  for (const c of cracks) for (let i = 1; i < c.pts.length - 1; i += 2) {
    if (L.rnd() > 0.65 * c.w) continue;
    const p = c.pts[i], dx = p[0] - cx, dz = p[2] - cz, d = Math.hypot(dx, dz) || 1, s = (0.22 + 0.3 * L.rnd()) * (1.2 - d / R * 0.6);
    const bg = new THREE.BoxGeometry(s * (1.2 + L.rnd()), s * 0.35, s * (0.8 + 0.6 * L.rnd()), 2, 1, 2), pp = bg.attributes.position;
    for (let k = 0; k < pp.count; k++) pp.setXYZ(k, pp.getX(k) * (1 + 0.15 * (L.rnd() - 0.5)), pp.getY(k), pp.getZ(k) * (1 + 0.15 * (L.rnd() - 0.5)));
    bg.computeVertexNormals();
    const m = L.mesh(bg, slabM[i % 3], p[0] + dx / d * s * 0.3, s * 0.12, p[2] + dz / d * s * 0.3, { parent: G, dirt: 0.2, dirtH: s });
    m.rotation.set((L.rnd() - 0.5) * 0.3, -Math.atan2(dz, dx), (o.lift ?? 0.35) * (0.6 + 0.6 * L.rnd()));
  }
  clods(ctx, { cx, cz, r0: R * 0.1, r1: R * 0.75, n: o.clods ?? 120, air: o.air ?? 0 });
  if (o.dust) dust(ctx, { cx, cz, r: R * 0.8, n: o.dust });
}
// clods(ctx, o): lumps of soil scattered (or flying: air > 0, that many in the air) round (cx, cz)
function clodGeo(K, L, s, k) {
  const { THREE } = K, g = new THREE.DodecahedronGeometry(1, 1), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const q = 1 + 0.3 * K.nz(p.getX(i) * 2 + k, p.getY(i) * 2, p.getZ(i) * 2); p.setXYZ(i, p.getX(i) * q, p.getY(i) * q, p.getZ(i) * q); }
  g.scale(s, s * 0.72, s * (0.8 + 0.4 * L.rnd())); g.computeVertexNormals(); return g;
}
function clods(ctx, o) {
  const { L, K, G } = ctx, soil = [K.crust('#5a4636', { rough: 0.97 }), K.crust('#4a3a2e', { rough: 0.97 }), K.crust('#6e5844', { rough: 0.97 })];
  for (let i = 0; i < o.n; i++) {
    const a = L.rnd() * Math.PI * 2, r = o.r0 + Math.pow(L.rnd(), 0.9) * (o.r1 - o.r0), s = 0.05 + Math.pow(L.rnd(), 2.2) * 0.22, up = i < (o.air || 0);
    L.mesh(clodGeo(K, L, s, i), soil[i % 3], (o.cx ?? 0) + Math.cos(a) * r, up ? 0.6 + L.rnd() * (o.airH ?? 3) : s * 0.2, (o.cz ?? 0) + Math.sin(a) * r, { parent: G, dirt: 0.1, dirtH: s, ry: L.rnd() * 6 });
  }
}
// dust(ctx, o): soft brown puffs of dust hanging over (cx, cz): flat soft discs at a few heights, seen from above as haze
let _puff;
function dust(ctx, o) {
  const { L, K, G } = ctx, { THREE } = K;
  _puff = _puff || L.canvasTex(256, (g, n) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, n, n);
    for (let i = 0; i < 14; i++) { const x = n * (0.3 + 0.4 * L.rnd()), y = n * (0.3 + 0.4 * L.rnd()), r = n * (0.12 + 0.16 * L.rnd()); const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, n, n); }
  }, false);
  for (let i = 0; i < o.n; i++) {
    const a = L.rnd() * Math.PI * 2, r = Math.pow(L.rnd(), 0.6) * o.r, s = (0.9 + 1.4 * L.rnd()) * (o.size ?? 1);
    const m = new THREE.MeshStandardMaterial({ color: o.col ?? '#86705a', alphaMap: _puff, transparent: true, opacity: 0.75 * (o.op ?? 0.5) * (0.6 + 0.4 * L.rnd()), depthWrite: false, roughness: 1 });
    const pm = new THREE.Mesh(new THREE.PlaneGeometry(s * 2, s * 2).rotateX(-Math.PI / 2), m);
    pm.position.set((o.cx ?? 0) + Math.cos(a) * r, (o.y ?? 0.4) + L.rnd() * (o.h ?? 1.6), (o.cz ?? 0) + Math.sin(a) * r); pm.rotation.y = L.rnd() * 6; pm.renderOrder = 5;
    G.add(pm);
  }
}
// throat(ctx, par, at, r, dir): a glowing gullet: the mouth's back lined with crystal points round a hot violet-white core
function throat(ctx, par, at, r, dir, k = 1) {
  const { L, K } = ctx, X = XB(K), ch = K.chargeK(K.CHARGE);
  const coreM = K.glowMat('#f0e4ff', (0.8 + 1.6 * ch) * k, K.dimGlow('#b070ff', 4 * ch * k));
  L.sphere(r * 0.62, coreM, at[0], at[1], at[2], { parent: par, dirt: 0, cast: false });
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2, d = [dir[0] * 0.2 - Math.cos(a) * 0.0, Math.cos(a), Math.sin(a)];
    K.shard(par, [at[0] - dir[0] * r * 0.2 + Math.cos(a) * r * 0.05, at[1] + Math.cos(a) * r * 0.95, at[2] + Math.sin(a) * r * 0.95], [dir[0] * 0.9 - d[1] * 0.1, -d[1], -d[2]], r * (0.45 + 0.25 * L.rnd()), r * 0.09, { ...X, k: X.k * k }, { collar: false });
  }
}
// plates(ctx, body, o): crystal-plated armour: heavy rounded plates of geode rind (dark stone, banded where worn)
function plateMat(K, hex = '#3a3440') { return K.crust(hex, { rough: 0.82, ns: 1.5 }); }
// the spine crack of a mantle, packed with crystal points, and big spires standing out of it
function spineCrystal(ctx, sad, x0, x1, n, big, X) {
  const { L, K, G } = ctx, { THREE } = K, geos = [], up = new THREE.Vector3(0, 1, 0), CH = K.CHARGE;
  for (let i = 0; i < 700; i++) {
    const x = x0 + (x1 - x0) * L.rnd(), t = (x - x0) / (x1 - x0), w = 0.3 * Math.max(0, 1 - Math.pow(Math.abs(t - 0.5) / 0.5, 3));
    if (w < 0.04) continue;
    const a = sad.crackZ(x) + (L.rnd() - 0.5) * w * 1.5, p = sad.top(x, a), len = 0.18 + 0.3 * L.rnd() * (0.5 + w * 2);
    const d = new THREE.Vector3((L.rnd() - 0.5) * 0.7 - 0.2, 1, (L.rnd() - 0.5) * 0.7).normalize();
    const cg = new THREE.ConeGeometry(len * 0.28, len, 5, 1); cg.translate(0, len / 2, 0);
    const pp = cg.attributes.position, cc = new Float32Array(pp.count * 3); for (let k = 0; k < pp.count; k++) { const b = 0.6 + 0.4 * pp.getY(k) / len; cc[k * 3] = cc[k * 3 + 1] = cc[k * 3 + 2] = b; }
    cg.setAttribute('color', new THREE.BufferAttribute(cc, 3)); cg.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, d)); cg.translate(p[0], p[1] - len * 0.25, p[2]);
    geos.push(cg.toNonIndexed());
  }
  const n2 = geos.reduce((s, g) => s + g.attributes.position.count, 0), out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv', 'color']) { const sz = geos[0].attributes[name].itemSize, arr = new Float32Array(n2 * sz); let o = 0; for (const g of geos) { arr.set(g.attributes[name].array, o); o += g.attributes[name].array.length; } out.setAttribute(name, new THREE.BufferAttribute(arr, sz)); }
  L.mesh(out, K.druseMat(X, CH), 0, 0, 0, { parent: G, dirt: 0 }).receiveShadow = false;
  const cp = K.charged(X, CH);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.2 + L.rnd() * 0.6) / n, x = x0 + (x1 - x0) * t, mid = Math.max(0, 1 - Math.abs(t - 0.45) * 1.6);
    const a = sad.crackZ(x) + (L.rnd() - 0.5) * 0.1, p = sad.top(x, a);
    K.cluster(G, [p[0], p[1] - 0.25, p[2]], [-0.45 - L.rnd() * 0.3, 1, (i % 2 ? 1 : -1) * (0.2 + L.rnd() * 0.3)], 3 + Math.round(L.rnd()), big * (0.45 + 0.8 * mid) * (0.8 + L.rnd() * 0.3), big * (0.1 + 0.07 * mid), cp, 0.45, { collar: false });
  }
}
// glowing seams in the armour, out from the spine: the core showing through where the plate has split
function armourSeams(ctx, sad, list, k = 1) {
  const { K, G } = ctx, fm = fissureMat(K, k);
  for (const [x, a0, a1, dx] of list) {
    const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8, a = a0 + (a1 - a0) * t + 0.05 * Math.sin(i * 2.7 + x), p = sad.top(x + dx * t + 0.08 * Math.sin(i * 3.1), a); pts.push([p[0], p[1] + 0.02, p[2]]); }
    K.tube(G, pts, t => 0.05 * (1 - 0.6 * t) + 0.012, fm, { n: 30, radial: 5, dirt: 0 });
  }
}

// ---------------------------------------------------------------------------------------------------------------
// A. HARROW: the walking siege mound. The Brute's build, but a hill of it: a vast badger-mole so old the crystal it has
// eaten has grown over its whole back into a mantle of geode plate, split down the spine where a ridge of spires stands
// out of the crack and the core glows through seams in the plate. Its neck and shoulders are plated in heavy rind, its
// spade hands are the size of a Hauler, and under the star its jaws hang open on a throat lit violet-white. It tears up
// the ground it walks on. pose=rear: the front of it reared up, hands raised; slam: the hands brought down, the ground
// breaking in a ring of lit cracks, slabs heaved up, dust; fall: dying, rolled onto its side, the light going out.
function harrow(ctx) {
  const { L, K, G, f, pose } = ctx, X = XB(K), still = pose !== 'walk';
  const furM = K.fur('#161317', { coarse: true, sheen: 0.95, sheenColor: '#6a6274', rough: 0.9, ns: 1.0 });
  const skinM = K.flesh('#7c6e78', { rough: 0.62 }), nailM = K.keratin('#d4c8b2', 0.5), toothM = K.keratin('#e2d4ae', 0.35);
  if (pose === 'crater') { crater(ctx, { RI: 2.6, RP: 3.2, RO: 5.4, glow: 0.5 }); return null; }   // the cave-in crater it leaves
  if (pose === 'cracks') { broken(ctx, { cx: 0, cz: 0, r: 5.6, n: 12, glow: 1, clods: 140, air: 0 }); return null; }   // the slam's broken ground
  const rearing = pose === 'rear', slam = pose === 'slam', fall = pose === 'fall', emerge = pose === 'emerge', hurt = pose === 'hurt';
  const bite = pose === 'bite', dying = pose === 'die', stagger = dying && f < 0.5, topple = dying && f >= 0.5;
  // the body is built in B, turned about the hips for the rear, the slam and the fall
  const B = L.group(0, 0, 0, 0, G);
  const body = K.loft(B, plan({ x0: -4.1, x1: 3.5, w: 2.25, h: 1.95, b: 0.95, cy: 1.5, hip: 0.72, rise: 0.72, head: 0.5, drop: 0.5 }), furM, { lump: 0.045, seed: 21, uv: 2.4, p: 2.45 });
  K.furShells(body, furM, { n: 6, len: 0.13, density: 0.9, comb: 0.9, tip: 0.3, scale: 5 });
  const ctxB = { ...ctx, G: B };
  // ---- the mantle: banded geode plate over the whole back, split along the spine
  const stone = [0.045, 0.04, 0.05], stoneL = [0.13, 0.115, 0.13], vio = [0.12, 0.07, 0.18];
  const bands = [[0.62, 0.56, 0.72], [0.44, 0.36, 0.58], [0.32, 0.24, 0.46], [0.24, 0.17, 0.38], [0.18, 0.13, 0.3]];
  const sad = K.crustSaddle(B, body, { x0: -3.75, x1: 2.0, amax: 1.08, thick: 0.62, bands: 7, crack: 0.26, crackDepth: 0.75, mat: K.crust('#ffffff'),
    colour: (x, a, inC) => {
      if (inC > 0) return bands[Math.min(4, Math.floor(Math.pow(inC, 0.6) * 5))].map(q => q * 1.3);
      const lum = 0.5 + 0.5 * K.nz(x * 3 + 9, a * 3, 2); let c = stone.map((q, j) => q + (stoneL[j] - q) * lum);
      const vs = Math.max(0, K.nz(x * 2, a * 2 + 2, 3.5) - 0.2); return c.map((q, j) => q + (vio[j] - q) * Math.min(1, vs * 2));
    } });
  // (toppling: half its spires snapped off, flung away in the game as shards)
  spineCrystal(ctxB, sad, -3.5, 1.7, topple ? 5 : 9, topple ? 1.25 : 1.9, X);
  const seams = [[0.9, 0.22, 0.95, -0.3], [-0.4, -0.2, -0.98, -0.4], [-1.5, 0.22, 0.9, 0.3], [-2.6, -0.2, -0.85, 0.2], [-0.2, 0.25, 0.75, 0.5], [-2.2, 0.2, 0.8, -0.3]];
  // dying, cracks of light race across every plate (the core breaking up), blazing as it staggers, going as it topples
  const cracksOfLight = [[1.5, 0.1, 1.05, -0.6], [0.3, -0.1, -1.05, 0.6], [-1.0, 0.15, 1.05, -0.5], [-3.0, -0.1, -1.0, 0.5], [-1.9, -0.25, -1.05, -0.6], [0.5, 0.3, 1.05, 0.4], [-3.2, 0.2, 0.95, 0.4], [1.2, -0.25, -1.0, -0.4]];
  if (dying) armourSeams(ctxB, sad, seams.concat(cracksOfLight), stagger ? 2.4 : 0.9);
  else if (!fall) armourSeams(ctxB, sad, seams);
  // plated neck and shoulders: rows of heavy rind plates, the free edges lifted toward the tail
  K.scales(B, body, { x0: 1.6, x1: 2.9, rows: 4, cols: 6, amax: 1.25, size: 0.95, width: 0.9, mat: plateMat(K), lift: 0.3 });
  // and heavy plates down both flanks below the mantle's edge
  K.scales(B, body, { x0: -3.3, x1: 1.4, rows: 7, cols: 9, amax: 1.6, size: 0.9, width: 0.95, mat: plateMat(K, '#332d38'), lift: 0.28,
    skip: (i, j) => { const nc = 9 - i % 2, a = (j / (nc - 1) * 2 - 1) * 1.6 * (nc / 9); return Math.abs(a) < 1.0; } });
  // geodes split out of the shoulders (the biggest) and along the edges of the mantle, low on the flanks
  for (const s of [-1, 1]) K.geodeOn(B, body, 1.15, s * 0.95, 0.72, X, { up: 0.3, lean: 0.2, spires: 3, spireLen: 1.2, spireLean: 0.4, collarMat: furM, open: 0.75, sink: 0.1 });
  for (const [x, a, r] of [[-0.8, 1.15, 0.48], [-1.0, -1.2, 0.5], [-2.4, 1.1, 0.42], [-2.6, -1.05, 0.4], [0.2, 1.25, 0.36], [0.3, -1.25, 0.34], [-3.3, 0.9, 0.3], [-3.4, -0.9, 0.3]])
    K.geodeOn(B, body, x, a, r, X, { up: 0.2, lean: 0.15, spires: r > 0.4 ? 1 : 0, collarMat: furM, sx: 1.2, open: 0.8 });
  // ---- the head: a heavy wedge, the star on the end, the jaws open under it on a lit throat, the incisors
  const st = fall ? { open: 0.25, glow: 0.05 } : hurt ? { open: 0.08, glow: 0.15 } : rearing || bite || stagger ? { open: 1, glow: 1 } : topple ? { open: 0.5, glow: 0.3 } : slam ? { open: 0.9, glow: 0.8 } : { open: 0.55, glow: 0.35 };
  face(L, K, B, { base: [3.1, 0.98, 0], tip: [3.75, 0.9, 0], r: 0.5, r0: 0.3, len: 0.75, tilt: 0.25, pose: '', pal: PAL.base, seed: 13, star: st });
  const jaw = L.group(2.9, 0.62, 0, 0, B); jaw.rotation.z = bite || stagger ? -0.8 : rearing || hurt ? -0.6 : fall || topple ? -0.3 : -0.32;
  K.seg(jaw, [0.42, -0.05, 0], 0.55, 0.16, 0.48, K.flesh('#5a4650', { rough: 0.5 }), { lump: 0.04, flat: 0.2 });
  K.seg(jaw, [0.45, 0.06, 0], 0.46, 0.05, 0.38, K.flesh('#3e2630', { rough: 0.4, cc: 0.3 }), { lump: 0.02 });
  throat({ ...ctx, G: B }, B, [3.3, 0.6, 0], 0.32, [1, 0, 0], fall ? 0.08 : stagger ? 1.6 : topple ? 0.4 : 1);
  for (const s of [-1, 1]) {
    K.claw(B, [3.62, 0.62, s * 0.09], [1, -0.5, s * 0.05], [0, 1, 0], 0.42, 0.07, 0.04, toothM, 0.3);
    K.claw(jaw, [0.85, 0.06, s * 0.08], [1, 0.4, s * 0.04], [0, 1, 0], 0.36, 0.06, 0.035, toothM, -0.2);
    for (let k = 0; k < 4; k++) K.shard(jaw, [0.25 + k * 0.15, 0.05, s * (0.3 - k * 0.04)], [0.2, 1, s * 0.3], 0.16 + 0.06 * (3 - k), 0.04, X, { collar: false });
  }
  K.tail(B, { base: [-4.0, 1.5, 0], tip: [-4.55, 1.32, 0.06], r: 0.26, mat: furM });
  // ---- the limbs
  const hipPose = [-3.1, 1.1, 0];
  if (rearing) pivot(K, B, hipPose, 0.58);
  if (slam) pivot(K, B, hipPose, -0.08);
  if (fall) { pivot(K, B, [0, 0, 0], -0.04, 0.42); B.position.y -= 0.55; }
  // coming up (f=0: the ground bursting, only its spires and hands through; 1: head and shoulders out; 2: climbing out)
  const EM = [[0.75, -0.6, -3.6], [0.5, -1.4, -2.3], [0.28, -0.5, -1.25]][Math.min(2, f)];
  if (emerge) { pivot(K, B, [0, 0, 0], EM[0]); B.position.x += EM[1]; B.position.y += EM[2]; emergeHole(ctx, 2.6); }
  if (hurt) { pivot(K, B, hipPose, -0.07, -0.13); }   // (it flinches: head down, rolled away from the hit)
  // walking: the weight of it: the body dips as each pair of feet comes down and the shoulders roll with the leading hand
  if (pose === 'walk') { const ph = f * Math.PI / 2 + Math.PI / 4; pivot(K, B, [0, 1.2, 0], 0.025 * Math.cos(2 * ph), 0.06 * Math.sin(ph)); B.position.y -= 0.09 * (0.5 + 0.5 * Math.cos(2 * ph)); }
  if (bite) { pivot(K, B, hipPose, -0.06, 0.05); B.position.x += 0.4; }   // (the bite: lunging, head low and forward)
  if (stagger) { pivot(K, B, hipPose, -0.06, -0.2); B.position.x -= 0.15; }   // (dying: reeling back, rolled, head down)
  if (topple) { pivot(K, B, [0, 0, 0], -0.03, 0.27); B.position.y -= 0.3; }    // (toppling onto its side)
  for (const s of [-1, 1]) {
    // hands: walking, rowing; rearing, raised high and spread; slamming, flat on the broken ground ahead; dying, limp
    const fore = { side: s, f, hand: 2.9, armR: 0.92, fat: 1.12, stride: 0.34, lift: 0.3, skin: skinM, arm: furM, nailMat: nailM, splay: 0.58, tilt: 0.5 };
    if (emerge) { const w = toParent(K, G, B, [[2.2, 0.6, s * 2.7], [3.0, 0.45, s * 2.9], [3.6, 0.3, s * 2.4]][Math.min(2, f)]); K.forelimb(B, { ...fore, plant: true, shoulder: [1.75, 1.2, s * 0.9], wrist: w, splay: 0.85, tilt: 0.45, droop: 0.3, curl: 0.4 }); continue; }
    if (rearing) K.forelimb(B, { ...fore, plant: true, shoulder: [1.75, 1.2, s * 0.9], wrist: [2.9, 2.6, s * 2.1], splay: 0.75, tilt: 1.25, droop: -0.5, curl: 0.45 });
    else if (slam) { const w = toParent(K, G, B, [4.25, 0.32, s * 2.0]); K.forelimb(B, { ...fore, plant: true, shoulder: [1.75, 1.2, s * 0.9], wrist: w, splay: 0.7, tilt: 0.35, droop: 0.3, curl: 0.35 }); }
    else if (hurt) K.forelimb(B, { ...fore, plant: true, shoulder: [1.75, 1.2, s * 0.9], wrist: [2.4, 0.5, s * 1.9], splay: 0.9, tilt: 0.6, droop: 0.15, curl: 0.55 });
    else if (bite) K.forelimb(B, { ...fore, plant: true, shoulder: [1.75, 1.2, s * 0.9], wrist: s > 0 ? [3.9, 0.95, s * 1.15] : [2.5, 0.5, s * 1.7], splay: s > 0 ? 0.85 : 0.6, tilt: s > 0 ? 0.9 : 0.45, droop: 0.1, curl: s > 0 ? 0.6 : 0.3 });
    else if (stagger) K.forelimb(B, { ...fore, plant: true, shoulder: [1.75, 1.2, s * 0.9], wrist: s > 0 ? [2.2, 0.45, s * 2.1] : [3.0, 0.55, s * 1.6], splay: 0.9, tilt: 0.7, droop: 0.2, curl: s > 0 ? 0.7 : 0.4 });
    else if (topple) K.forelimb(B, { ...fore, plant: true, shoulder: [1.75, 1.2, s * 0.9], wrist: [2.8, s > 0 ? 0.75 : 0.3, s * 1.95], splay: 0.9, tilt: s > 0 ? 1.0 : 0.3, droop: 0.12, curl: 0.25 });
    else if (fall) K.forelimb(B, { ...fore, plant: true, shoulder: [1.75, 1.2, s * 0.9], wrist: [3.0, s > 0 ? 0.9 : 0.25, s * 1.9], splay: 0.9, tilt: s > 0 ? 1.2 : 0.2, droop: 0.1, curl: 0.1 });
    else K.forelimb(B, { ...fore, shoulder: [1.75, 1.2, s * 0.9], wrist: [2.6, 0.75, s * 1.4] });
    // hind legs: on the ground, whatever the body does
    const hip = toParent(K, B, G, [-3.0, 1.1, s * 0.95]);
    K.hindlimb(still ? G : B, { side: s, f, plant: still, hip: still ? hip : [-3.0, 1.1, s * 0.95], foot: [-3.5, 0.2, s * 1.75], len: 0.95, r: 0.5, stride: 0.3, lift: 0.22, skin: skinM, leg: furM, clawMat: nailM, out: 0.65 });
  }
  // ---- what it does to the ground
  if (slam && !GAME) broken(ctx, { cx: 4.0, cz: 0, r: 3.6, n: 11, glow: 1, clods: 160, air: 50, dust: 22 });
  if (rearing && !GAME) { clods(ctx, { cx: 1.5, cz: 0, r0: 2.2, r1: 3.5, n: 30, air: 18, airH: 2.5 }); dust({ ...ctx }, { cx: 0.5, cz: 0, r: 3.5, n: 10, op: 0.4 }); }
  if (pose === 'walk') {
    // the furrow it leaves: the ground under its tread heaved and broken (its own frames: drawn under it in the game)
  }
  if (fall) {
    // spires broken off in the fall, lying dead beside it; dust settling
    const dead = { ...X, k: 0.04 };
    for (const [x, z, a] of [[-1.2, 2.9, 0.4], [0.4, 3.1, -0.3], [-2.4, 2.7, 0.9]]) K.cluster(G, [x, 0.1, z], [Math.cos(a), 0.15, Math.sin(a)], 3, 1.3, 0.22, dead, 0.4, { collar: false });
    if (!GAME) dust(ctx, { cx: -0.5, cz: 0.5, r: 4.2, n: 16, op: 0.45, y: 0.2, h: 1.2 });
  }
  if (slam && !GAME) { centreOn(K, G, [body.mesh]); G.position.x -= 2.4; return null; }
  return emerge ? null : body;
}

// ---------------------------------------------------------------------------------------------------------------
// B. MAW: the burrowing leviathan. A Sapper grown for a century: long, and never all above the ground. What comes up is
// a skull armoured in a wedge of banded geode rind with a crest of crystal along it, shoulders plated in rind, two hands
// wider than a road gripping the rim of the crater it has broken open, and the jaws thrown wide under the star on a
// throat lined with glowing crystal. pose=up: surfaced, braced on the rim (the key pose); erupt: bursting up, soil and
// slabs flying, the ground lit through every crack; heave: moving under the ground, a long dome of soil splitting at
// the head of its ridge; sink: dying, its head down on the rim, the light going out, the crater falling in.
function maw(ctx) {
  const { L, K, G, f, pose } = ctx, { THREE } = K, X = XB(K);
  if (pose === 'heave') return mawHeave(ctx);
  const erupt = pose === 'erupt', sink = pose === 'sink';
  const furM = K.fur('#17151a', { coarse: true, sheen: 1, sheenColor: '#7a7488', rough: 0.85 }), skinM = K.flesh('#7a6c76', { rough: 0.6 }), nailM = K.keratin('#d8ccb4', 0.45), toothM = K.keratin('#e4d6b0', 0.35);
  // the crater: a dark throat in the ground, a rim of broken earth heaped round it, cracks lit out across the ground
  const RI = 2.5, RP = 3.1, RO = 5.4;
  crater(ctx, { RI, RP, RO, glow: sink ? 0.15 : erupt ? 1.4 : 1, fresh: erupt, fallen: sink });
  // the body, rising out of the hole at a slant: built in B (+x forward), pitched up about the hole's middle
  const pitch = erupt ? 0.95 : sink ? 0.22 : 0.62, B = L.group(0, 0, 0, 0, G);
  B.position.set(erupt ? -0.6 : sink ? 0.2 : -0.3, erupt ? -2.3 : sink ? -1.15 : -1.55, 0); B.rotation.z = pitch;
  if (sink) B.rotation.x = 0.16;
  const body = K.loft(B, plan({ x0: -6.5, x1: 3.3, w: 1.85, h: 1.45, b: 0.85, cy: 0.9, hip: 0.6, rise: 0.66, head: 0.62, drop: 0.12 }), furM, { lump: 0.04, seed: 31, uv: 2.2, p: 2.4 });
  K.furShells(body, furM, { n: 5, len: 0.1, density: 0.9, comb: 0.95, tip: 0.3, scale: 5 });
  // the brow: a wedge of banded geode rind over the skull, cracked along its ridge where crystal stands out as a crest
  const browC = new THREE.Color('#4e4654');
  const shield = K.crustSaddle(B, body, { x0: 0.6, x1: 3.25, amax: 1.35, thick: 0.38, crack: 0.12, mat: K.crust('#ffffff', { rough: 0.85 }), bands: 5,
    colour: (x, a, inC) => {
      if (inC > 0) return [0.62, 0.56, 0.78].map(q => q * (0.7 + 0.5 * inC));
      const ring = 0.82 + 0.18 * Math.sin(x * 22 + 2 * K.nz(a * 2, x, 1)), root = K.sstep(0.8, 1.6, x), k = (0.5 + 0.5 * root) * ring;
      return [browC.r * k, browC.g * k, browC.b * k];
    } });
  const cp = K.charged(X, K.CHARGE);
  for (let i = 0; i < 6; i++) { const x = 0.8 + i * 0.4, p = shield.top(x, shield.crackZ(x)); K.cluster(B, [p[0], p[1] - 0.12, p[2]], [-0.6, 1, (i % 2 ? 0.2 : -0.2)], 3, 0.55 + 0.35 * Math.sin(i / 5 * Math.PI), 0.12, cp, 0.4, { collar: false }); }
  // the shoulders and back plated, a ridge of spires down the spine behind the head, geodes low on the flanks
  K.scales(B, body, { x0: -2.6, x1: 0.6, rows: 6, cols: 6, amax: 1.25, size: 0.85, width: 0.9, mat: plateMat(K, '#36303c'), lift: 0.3, skip: (i, j) => j === 2 && i % 2 === 0 });
  const back = (x) => body.surf(x, 0);
  for (let i = 0; i < 5; i++) { const x = 0.3 - i * 0.7, p = back(x); K.cluster(B, [p[0], p[1] - 0.15, p[2]], [-0.55, 1, (i % 2 ? 0.25 : -0.25)], 3, 1.5 - i * 0.12, 0.2, cp, 0.45, { collar: false }); }
  for (const s of [-1, 1]) {
    K.geodeOn(B, body, 0.2, s * 1.0, 0.6, X, { up: 0.3, lean: 0.2, spires: 3, spireLen: 1.15, collarMat: furM, open: 0.75 });
    K.geodeOn(B, body, -1.4, s * 1.1, 0.42, X, { up: 0.2, spires: 1, collarMat: furM, sx: 1.3, open: 0.8 });
  }
  // ---- the jaws, thrown wide (slack, dying), the star on the upper one, the throat lit
  const up = sink ? 0.08 : erupt ? 0.55 : 0.42, dn = sink ? -0.35 : erupt ? -0.7 : -0.6, hinge = [2.45, 0.8, 0];
  const J1 = L.group(hinge[0], hinge[1] + 0.05, 0, 0, B); J1.rotation.z = up;
  const J2 = L.group(hinge[0], hinge[1] - 0.15, 0, 0, B); J2.rotation.z = dn;
  K.seg(J1, [0.45, 0.05, 0], 0.9, 0.36, 0.95, furM, { lump: 0.05, flat: 0.6 });
  K.seg(J1, [0.95, -0.02, 0], 0.6, 0.26, 0.82, K.hide('#5e505a', { ns: 0.8 }), { lump: 0.04, flat: 0.7 });
  face(L, K, B, { parent: J1, base: [1.05, 0.12, 0], tip: [1.55, 0.12, 0], r: 0.32, r0: 0.24, len: 0.75, tilt: 0.3, pose: '', pal: PAL.base, seed: 17, star: sink ? { open: 0.2, glow: 0 } : { open: 1, glow: erupt ? 1 : 0.8 } });
  K.seg(J2, [0.75, -0.06, 0], 0.85, 0.24, 0.82, K.flesh('#5a4650', { rough: 0.5 }), { lump: 0.04, flat: 0.2 });
  K.seg(J2, [0.75, 0.1, 0], 0.72, 0.06, 0.66, K.flesh('#3e2630', { rough: 0.4, cc: 0.3 }), { lump: 0.02 });
  for (const s of [-1, 1]) {
    K.claw(J1, [1.45, -0.22, s * 0.14], [0.5, -1, s * 0.05], [1, 0, 0], 0.7, 0.11, 0.06, toothM, 0.25);
    K.claw(J2, [1.45, 0.12, s * 0.13], [0.6, 1, s * 0.05], [1, 0, 0], 0.6, 0.1, 0.055, toothM, -0.2);
    for (let k = 0; k < 6; k++) { const a = 0.35 + k * 0.22, x = 0.75 + 0.6 * Math.cos(a), z = s * 0.72 * Math.sin(a); K.shard(J1, [x, -0.1, z], [0.1, -1, 0], 0.22 + 0.08 * (k % 2), 0.05, X, { collar: false }); K.shard(J2, [x, 0.1, z], [0.1, 1, 0], 0.2, 0.05, X, { collar: false }); }
  }
  throat(ctx, B, [2.55, 0.78, 0], 0.48, [1, 0, 0], sink ? 0.06 : erupt ? 1.4 : 1.1);
  // ---- the hands: on the rim, fingers dug into the broken earth (erupting, flung out and up; dying, one slack)
  for (const s of [-1, 1]) {
    const W2 = erupt ? [1.5, 2.0, s * 3.2] : sink ? [2.6, 0.25, s * (s > 0 ? 3.2 : 2.6)] : [2.9, 0.35, s * 3.0];
    const w = toParent(K, G, B, W2);
    K.forelimb(B, { side: s, f: 0, plant: true, shoulder: [1.2, 0.6, s * 1.0], wrist: w, hand: 2.4, armR: 0.68, fat: 1.15, skin: skinM, arm: furM, nailMat: nailM,
      splay: erupt ? 1.2 : 0.8, tilt: erupt ? 1.0 : 0.45, droop: erupt ? -0.2 : 0.3, curl: sink && s > 0 ? 0.1 : 0.4, fan: 0.42 });
  }
  // the unseen floor: hides what is still under the ground (the crater's own bowl shows the hole)
  const flM = new THREE.MeshBasicMaterial({ colorWrite: false }), fl = new THREE.Mesh(new THREE.RingGeometry(RI * SC * 0.98, 60, 96).rotateX(-Math.PI / 2), flM);
  Object.defineProperty(fl, 'material', { get: () => flM, set: () => {} });
  fl.renderOrder = -10; L.getRoot().add(fl);
  if (erupt) { clods(ctx, { cx: 0, cz: 0, r0: 1.5, r1: 6.5, n: 90, air: 90, airH: 4.5 }); dust(ctx, { cx: 0, cz: 0, r: 5.5, n: 26, op: 0.5, y: 0.5, h: 3, size: 1.3 }); }
  if (sink) dust(ctx, { cx: 0.5, cz: 0, r: 4.5, n: 14, op: 0.4, y: 0.2, h: 1 });
  return null;                                     // the crater sits in the middle of the frame
}
// emergeHole(ctx, RI): coming up out of the ground (out of the Deep's mound, in the Hollow): a crater round it, lit, and
// the unseen floor that hides the half of it still under the ground; soil and dust thrown up
function emergeHole(ctx, RI) {
  const { L, K } = ctx, { THREE } = K;
  crater(ctx, { RI, RP: RI + 0.6, RO: RI + 2.8, glow: 1.2, fresh: true });
  const flM = new THREE.MeshBasicMaterial({ colorWrite: false }), fl = new THREE.Mesh(new THREE.RingGeometry(RI * SC * 0.98, 60, 96).rotateX(-Math.PI / 2), flM);
  Object.defineProperty(fl, 'material', { get: () => flM, set: () => {} });
  fl.renderOrder = -10; L.getRoot().add(fl);
  clods(ctx, { cx: 0, cz: 0, r0: 1.5, r1: RI + 3, n: 50, air: 50, airH: 3.5 });
  dust(ctx, { cx: 0, cz: 0, r: RI + 2, n: 16, op: 0.45, y: 0.5, h: 2.4, size: 1.2 });
}
// crater(ctx, o): the hole the Maw comes up through: a dark throat, a heaped rim of broken soil and torn slabs, cracks
// lit out across the ground round it
function crater(ctx, o) {
  const { L, K, G } = ctx, { THREE } = K, { RI, RP, RO } = o;
  const prof = (r) => r < RI ? -1.6 + 1.6 * K.sstep(0.2, RI, r) : r < RP ? 0.75 * K.sstep(RI - 0.1, RP, r) : 0.75 * (1 - K.sstep(RP, RO, r));
  const NR = 60, NA = 160, pos = [], col = [], idx = [];
  for (let j = 0; j <= NR; j++) for (let i = 0; i <= NA; i++) {
    const a = i / NA * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
    const rmax = RO * (1 + 0.1 * K.nz(ca * 1.6, 3.1, sa * 1.6)), r = 0.01 + (j / NR) * (rmax - 0.01), rn = r / rmax * RO;
    const h = prof(rn) * (o.fallen && rn < RP ? 0.6 : 1) * (1 + 0.3 * K.nz(ca * 2, 1.3, sa * 2)) + (rn > RI ? 0.09 * K.nz(ca * r * 4, 4, sa * r * 4) + 0.05 * K.nz(ca * r * 11, 8, sa * r * 11) : 0);
    pos.push(ca * r, h, sa * r);
    const fresh = [0.11, 0.08, 0.06], dry = [0.27, 0.21, 0.16], deep = [0.012, 0.01, 0.014];
    const mix = (p, q, t) => p.map((w, k) => w + (q[k] - w) * Math.max(0, Math.min(1, t)));
    const c = rn < RI ? mix(deep, fresh, (rn - RI * 0.7) / (RI * 0.3)) : mix(fresh, dry, (rn - RP - 0.4) / 1.4);
    const nn = 0.8 + 0.3 * K.nz(ca * r * 3, 5, sa * r * 3) + 0.25 * K.nz(ca * r * 12, 9, sa * r * 12); col.push(...c.map(w => w * nn * 1.35));
  }
  for (let j = 0; j < NR; j++) for (let i = 0; i < NA; i++) { const a = j * (NA + 1) + i, b = a + 1, c = a + NA + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const uv = []; for (let k = 0; k < pos.length; k += 3) uv.push(pos[k] / 1.5, pos[k + 2] / 1.5); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  L.mesh(g, K.crust('#ffffff', { rough: 0.95, ns: 0.8 }), 0, 0, 0, { parent: G });
  // the light down in the throat (the rest of it, deep under)
  if (o.glow > 0.2) { const ch = K.chargeK(K.CHARGE); L.mesh(new THREE.CircleGeometry(RI * 0.55, 40).rotateX(-Math.PI / 2), K.glowMat('#7040c0', 0.35 * o.glow * (0.3 + ch), K.dimGlow('#8040ff', 1.6 * o.glow * ch)), 0, -1.55, 0, { parent: G, dirt: 0 }); }
  // torn slabs of crust on the rim, tilted out; clods; the lit cracks running out from the rim
  const slabM = [K.crust('#6e5640', { rough: 0.96 }), K.crust('#5c4836', { rough: 0.96 }), K.crust('#80664c', { rough: 0.96 })];
  for (let i = 0; i < 26; i++) {
    const a = L.rnd() * Math.PI * 2, r = RP + (L.rnd() - 0.3) * 1.0, s = 0.35 + 0.45 * L.rnd();
    const bg = new THREE.BoxGeometry(s * (1.2 + L.rnd()), s * 0.3, s * (0.9 + 0.5 * L.rnd()));
    const m = L.mesh(bg, slabM[i % 3], Math.cos(a) * r, prof(r) + s * 0.05, Math.sin(a) * r, { parent: G, dirt: 0.2, dirtH: s });
    m.rotation.set((L.rnd() - 0.5) * 0.4, -a, (o.fresh ? 0.9 : 0.55) * (0.5 + 0.6 * L.rnd()));
  }
  clods(ctx, { cx: 0, cz: 0, r0: RI + 0.1, r1: RO * 0.95, n: 260 });
  const k = o.glow, fm = fissureMat(K, Math.max(0.05, k));
  if (k > 0) for (let i = 0; i < 12; i++) {
    const a = (i + 0.4 * L.rnd()) / 12 * Math.PI * 2, r0 = RP * 0.95, r1 = RO * (0.9 + 0.25 * L.rnd());
    const pts = crackPath(L, [Math.cos(a) * r0, Math.sin(a) * r0], [Math.cos(a) * r1, Math.sin(a) * r1], 6, 0.22, (x, z) => Math.max(0.02, prof(Math.hypot(x, z)) + 0.03));
    K.tube(G, pts, t => (0.045 * (1 - 0.7 * t) + 0.01) * Math.min(1.3, k), fm, { n: 40, radial: 5, dirt: 0 });
  }
}
// mawHeave: the Maw moving under the ground: a long low dome of soil lifting and splitting at the head of a fresh ridge
// as wide as a road, the cracks lit violet from below, clods rolling off, a wake of broken ground behind
function mawHeave(ctx) {
  const { L, K, G, f } = ctx, { THREE } = K, X = XB(K);
  const RX = 3.4 * (1 + 0.04 * [0, 1, 1.4, 0.6][f % 4]), RZ = 2.3, lift = [1.0, 1.1, 1.18, 1.06][f % 4], open = 0.24, turn = (f % 4) * 0.13;
  const crack = (x, z) => {
    const r = Math.hypot(x / RX, z / RZ), a = Math.atan2(z / RZ, x / RX), w = a * 3 + 0.9 + turn + 0.5 * K.nz(r * 2.5, 1.3, a);
    return Math.pow(Math.abs(Math.cos(w)), 24) * K.sstep(0.05, 0.25, r) * (1 - K.sstep(0.8, 1.0, r)) + Math.pow(Math.abs(Math.cos(r * 8 + turn * 2 + K.nz(x * 2, 3, z * 2))), 50) * K.sstep(0.25, 0.4, r) * (1 - K.sstep(0.65, 0.8, r)) * 0.7;
  };
  const hgt = (x, z) => {
    const r = Math.hypot(x / RX, z / RZ), dome = lift * Math.pow(Math.max(0, 1 - r * r), 0.7);
    const t = Math.max(0, -x - 1.5) / 4.5, ridge = x < -1.5 ? 0.55 * (1 - t) * Math.exp(-((z / (1.1 * (1 - 0.3 * t))) ** 2)) * (t < 1 ? 1 : 0) : 0;
    return Math.max(dome, ridge) * (1 + 0.14 * K.nz(x * 2, 1, z * 2)) + (dome > 0.02 ? 0.05 * K.nz(x * 7, 6, z * 7) : 0) - open * crack(x, z);
  };
  const g = new THREE.PlaneGeometry(11.5, 6, 300, 160).rotateX(-Math.PI / 2); g.translate(-1.6, 0, 0);
  const p = g.attributes.position, col = new Float32Array(p.count * 3), H = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), h = hgt(x, z), c = crack(x, z); H[i] = h; p.setY(i, Math.max(h, 0));
    const b = (0.36 + 0.3 * Math.min(1, h * 1.6) + 0.14 * K.nz(x * 4, 2, z * 4) + 0.08 * K.nz(x * 11, 4, z * 11)) * (1 - 0.85 * Math.min(1, c * 1.4)); col[i * 3] = b * 0.36; col[i * 3 + 1] = b * 0.285; col[i * 3 + 2] = b * 0.22;
  }
  const idx = g.index.array, keep = [];
  for (let i = 0; i < idx.length; i += 3) if (H[idx[i]] > 0.006 || H[idx[i + 1]] > 0.006 || H[idx[i + 2]] > 0.006) keep.push(idx[i], idx[i + 1], idx[i + 2]);
  g.setIndex(keep); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
  L.mesh(g, K.crust('#ffffff', { rough: 0.95, ns: 0.9 }), 0, 0, 0, { parent: G });
  // the light in the cracks: follow the crack function's spokes over the dome
  const fm = fissureMat(K, 1.1);
  for (let k = 0; k < 6; k++) {
    const w0 = k * Math.PI / 3, pts = [];
    for (let i = 0; i <= 14; i++) { const r = 0.12 + i / 14 * 0.72, a = (w0 - 0.9 - turn) / 3 - 0.5 * K.nz(r * 2.5, 1.3, 0) / 3, x = Math.cos(a) * r * RX, z = Math.sin(a) * r * RZ; pts.push([x, Math.max(0.02, hgt(x, z) + 0.06), z]); }
    K.tube(G, pts, t => 0.05 * Math.sin(Math.PI * Math.min(1, 0.1 + t)) + 0.008, fm, { n: 40, radial: 5, dirt: 0 });
  }
  clods(ctx, { cx: 0, cz: 0, r0: 0.3, r1: 3.4, n: 220 });
  for (const [x, z, l] of [[0.8, -0.3, 0.7], [-0.6, 0.8, 0.55], [0.3, 1.1, 0.45], [-0.3, -1.1, 0.5], [1.9, 0.5, 0.4], [-1.6, 0.2, 0.5]]) K.cluster(G, [x, Math.max(0, hgt(x, z)) - 0.08, z], [x * 0.5, 1, z * 0.5], 3, l, l * 0.26, X, 0.6, { collar: false });
  dust(ctx, { cx: 0.5, cz: 0, r: 3.2, n: 10, op: 0.35, y: 0.6, h: 1 });
  return null;
}

// ---------------------------------------------------------------------------------------------------------------
// C. BEARER: the carrier. The naked mole-rat's colony carried on one back: a vast, swollen animal, low and wide, its
// rump and back grown into a comb of geode cells cracked open, each one lined with glowing crystal, and in them
// Scuttlers ride, curled in the light, until they climb out. Charge sacs of stretched skin bulge along both flanks,
// veined violet, brighter the more it has drawn. Its head is small for its size and its star is enormous.
// pose=walk: on the move, the Scuttlers tucked in their cells; draw: braced, the star flared wide and lit, threads of
// charge pulled in to it from all round; birth: Scuttlers climbing out of the cells and dropping down its sides;
// fall: dying, slumped, the sacs gone slack, the cells dark and empty.
function bearer(ctx) {
  const { L, K, G, f, pose } = ctx, { THREE } = K, X = XB(K);
  const draw = pose === 'draw', birth = pose === 'birth', fall = pose === 'fall', emerge = pose === 'emerge', still = pose !== 'walk';
  const furM = K.fur('#18151a', { coarse: true, sheen: 0.9, sheenColor: '#6e6680', rough: 0.88 }), skinM = K.flesh('#857681', { rough: 0.6 }), nailM = K.keratin('#d8ccb6', 0.45);
  const B = L.group(0, 0, 0, 0, G);
  const body = K.loft(B, plan({ x0: -4.5, x1: 2.9, w: 2.65, h: 2.0, b: 1.1, cy: 1.55, hip: 1.0, rise: 0.98, head: 0.34, drop: 0.55, fat: fall ? 0.92 : 1 }), furM, { lump: 0.05, seed: 41, uv: 2.4, p: 2.35 });
  K.furShells(body, furM, { n: 5, len: 0.12, density: 0.9, comb: 0.9, tip: 0.3, scale: 5 });
  // ---- the comb: banded geode rind over the back and rump, a honeycomb of cells broken open in it
  const stone = [0.05, 0.045, 0.055], stoneL = [0.14, 0.12, 0.14];
  const sad = K.crustSaddle(B, body, { x0: -4.2, x1: 0.9, amax: 1.2, thick: 0.55, bands: 0, crack: 0, mat: K.crust('#ffffff'),
    colour: (x, a) => { const lum = 0.5 + 0.5 * K.nz(x * 3 + 4, a * 3, 2); return stone.map((q, j) => q + (stoneL[j] - q) * lum); } });
  const cells = [];
  for (const [x, a, r] of [[0.2, 0, 0.55], [-0.75, 0.55, 0.55], [-0.75, -0.55, 0.55], [-1.7, 0, 0.6], [-1.75, 0.95, 0.5], [-1.75, -0.95, 0.5], [-2.7, 0.5, 0.55], [-2.7, -0.5, 0.55], [-3.55, 0, 0.48], [-0.6, 1.05, 0.42], [-0.6, -1.05, 0.42]]) {
    const p = sad.top(x, a), { n } = K.onBody(body, x, a, 0);
    const d = [n[0] * 0.5, 0.6 + n[1] * 0.4, n[2] * 0.5];
    K.geode(B, p, d, r, fall ? { ...X, k: 0.03 } : { ...X, k: X.k * (draw ? 1.6 : 1.2) }, { open: 1.15, hk: 0.75, th: 0.18, sink: r * 0.45, spires: 0, n: 30, charge: fall ? 0.02 : K.CHARGE });
    cells.push({ p, d, r });
  }
  // ---- the charge sacs along the flanks: stretched skin, violet veins glowing in it, swollen with what it has drawn
  const veins = L.canvasTex(1024, (g, n) => {
    g.fillStyle = '#1c1c1c'; g.fillRect(0, 0, n, n); g.lineCap = 'round'; L.blotches(g, n, 40, 60, 200, 0.26, '255,255,255');
    const branch = (x, y, a, w, len, d) => { for (let k = 0; k < len; k++) { const nx = x + Math.sin(a) * 8, ny = y + Math.cos(a) * 8; g.strokeStyle = `rgba(255,255,255,${0.25 + 0.75 * w / 6})`; g.lineWidth = w; g.beginPath(); g.moveTo(x, y); g.lineTo(nx, ny); g.stroke(); x = nx; y = ny; a += (L.rnd() - 0.5) * 0.55; w = Math.max(0.8, w * 0.965); if (d < 3 && L.rnd() < 0.1) branch(x, y, a + (L.rnd() < 0.5 ? -0.8 : 0.8), w * 0.7, len - k, d + 1); } };
    for (let i = 0; i < 16; i++) branch((i + L.rnd() * 0.6) / 16 * n, n * (0.16 + L.rnd() * 0.06), (L.rnd() - 0.5) * 0.4, 5.5, 56, 0);
  });
  const CH = fall ? 0.03 : K.CHARGE, FK = draw ? 2.4 : fall ? 0.2 : 1.2, chF = K.chargeK(CH);
  const sacM = new THREE.MeshPhysicalMaterial({ color: '#3a3040', roughness: 0.55, clearcoat: 0.3, clearcoatRoughness: 0.4, vertexColors: true, map: K.hideMap, sheen: 0.35, sheenColor: new THREE.Color('#a890b8'),
    emissive: new THREE.Color(X.core).multiplyScalar(chF * FK * (K.GLOW * K.GLOW * 0.5 + (K.NIGHTISH ? 0.15 : 0.12)) / 0.4), emissiveMap: veins, emissiveIntensity: 0.45 });
  sacM.envMapIntensity = 0.25; sacM.userData.glow = K.dimGlow(X.glow, (K.GLOW > 1 || draw ? 0.9 : 3) * Math.min(2.4, FK) * chF);
  const swell = draw ? 1.1 : fall ? 0.7 : 1;
  for (const s of [-1, 1]) for (const [x, y, rx, ry, rz, z] of [[-1.2, 1.25, 1.5, 0.9, 0.75, 2.3], [-2.9, 1.3, 1.1, 0.8, 0.65, 2.25], [0.4, 1.15, 0.8, 0.6, 0.5, 2.15]]) {
    const gg = new THREE.SphereGeometry(1, 64, 36), pp = gg.attributes.position, col = new Float32Array(pp.count * 3), v = new THREE.Vector3();
    for (let i = 0; i < pp.count; i++) { v.fromBufferAttribute(pp, i); const fold = Math.max(0, K.nz(v.x * 4 + x, v.y * 4, v.z * 4)) ** 2, q = 1 + 0.05 * K.nz(v.x * 2.4, v.y * 2.4 + s, v.z * 2.4) - 0.04 * fold; pp.setXYZ(i, v.x * rx * swell * q, v.y * ry * swell * q * (v.y < 0 ? 0.7 : 1) * (fall ? 0.7 : 1), v.z * rz * swell * q); const b = (0.6 + 0.4 * Math.max(0, v.y)) * (1 - 0.3 * fold); col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = b; }
    gg.setAttribute('color', new THREE.BufferAttribute(col, 3)); gg.computeVertexNormals();
    L.mesh(gg, sacM, x, y - (fall ? 0.35 : 0), s * z, { parent: B });
  }
  // ---- the front: shoulders plated, geodes out of them, a small heavy head and an enormous star
  K.scales(B, body, { x0: 1.0, x1: 2.2, rows: 3, cols: 6, amax: 1.2, size: 0.85, width: 0.9, mat: plateMat(K), lift: 0.3 });
  for (const s of [-1, 1]) K.geodeOn(B, body, 1.3, s * 1.05, 0.55, X, { up: 0.3, lean: 0.2, spires: 2, spireLen: 1.1, collarMat: furM, open: 0.78, charge: CH });
  face(L, K, B, { base: [2.55, 0.95, 0], tip: [3.1, 0.92, 0], r: 0.4, r0: 0.4, len: draw ? 1.25 : 0.95, tilt: draw ? 0.4 : 0.25, pose: '', pal: PAL.base, seed: 19,
    star: draw ? { open: 1, glow: 1 } : fall ? { open: 0.2, glow: 0 } : birth ? { open: 0.8, glow: 0.6 } : { open: 0.55, glow: 0.35 } });
  K.tail(B, { base: [-4.4, 1.5, 0], tip: [-4.9, 1.35, 0.05], r: 0.25, mat: furM });
  if (fall) { pivot(K, B, [0, 0, 0], -0.05, -0.3); B.position.y -= 0.5; }
  if (emerge) { pivot(K, B, [0, 0, 0], 0.45); B.position.x -= 1.0; B.position.y -= 2.4; emergeHole(ctx, 2.9); }
  // ---- short, thick legs: braced wide to draw, splayed in the fall
  for (const s of [-1, 1]) {
    if (emerge) { const w = toParent(K, G, B, [3.1, 0.4, s * 3.1]); K.forelimb(B, { side: s, f, plant: true, shoulder: [1.6, 1.0, s * 1.2], wrist: w, hand: 1.75, armR: 0.65, fat: 1.15, skin: skinM, arm: furM, nailMat: nailM, splay: 0.8, tilt: 0.45, droop: 0.3 }); continue; }
    K.forelimb(B, { side: s, f, plant: still, shoulder: [1.6, 1.0, s * 1.2], wrist: draw ? [2.7, 0.3, s * 2.5] : fall ? [2.6, 0.2, s * 2.6] : [2.4, 0.45, s * 2.0], hand: 1.75, armR: 0.65, fat: 1.15,
      stride: 0.28, lift: 0.22, skin: skinM, arm: furM, nailMat: nailM, splay: draw ? 1.0 : 0.65, tilt: 0.48, droop: draw ? 0.25 : 0.08 });
    const hip = toParent(K, B, G, [-3.3, 1.0, s * 1.3]);
    K.hindlimb(still ? G : B, { side: s, f, plant: still, hip: still ? hip : [-3.3, 1.0, s * 1.3], foot: [-3.8, 0.2, s * 2.3], len: 0.9, r: 0.5, stride: 0.26, lift: 0.18, skin: skinM, leg: furM, clawMat: nailM, out: 0.7 });
  }
  // ---- the brood: Scuttlers curled in the cells (walking, drawing), climbing out (birth), none (dying)
  const pup = (at, ry, k, lean = 0, parent = B) => {
    const PG = L.group(at[0], at[1], at[2], ry, parent); PG.scale.setScalar(k); PG.rotation.z = lean;
    const GL = L.group(0, 0, 0, 0, PG); scuttler(L, K, PG, GL, 1, 'base', '');
  };
  if (!fall) {
    const ride = birth ? [0, 3, 8] : [1, 3, 4, 7, 8];
    for (const i of ride) { const c = cells[i]; pup([c.p[0] - 0.1, c.p[1] - c.r * 0.2, c.p[2]], L.rnd() * 6, 0.32); }
  }
  if (birth) {
    // climbing out over the rims, and down the flanks
    for (const [i, ry, lean] of [[1, -0.9, 0.4], [2, 0.9, 0.4], [6, -1.4, 0.2], [5, 2.2, -0.5]]) { const c = cells[i]; pup([c.p[0], c.p[1] + 0.15, c.p[2] * 1.15], ry, 0.4, lean); }
    // and on the ground round it, running off
    for (const [x, z, ry] of [[-1.2, 3.6, -1.6], [0.8, 3.5, -0.9], [-2.6, -3.6, 1.8], [-0.2, -3.7, 0.9], [2.4, 3.0, -0.5]]) pup([x, 0, z], ry, 0.42, 0, G);
  }
  // ---- drawing: threads of charge pulled in from every side to the star and the sacs
  if (draw) {
    const arcM = K.glowMat(K.NIGHTISH ? '#ece0ff' : '#b890ff', 1.6, K.dimGlow('#a466ff', 3));
    for (let i = 0; i < 16; i++) {
      const a = (i + 0.3 * L.rnd()) / 16 * Math.PI * 2, R0 = 5.6 + 0.4 * L.rnd(), tgt = i % 3 === 0 ? [3.2, 1.0, 0] : [-1.2 + (L.rnd() - 0.5) * 2, 1.3, Math.sign(Math.sin(a) || 1) * 2.2];
      const s = [Math.cos(a) * R0 - 0.6, 0.4 + 0.4 * L.rnd(), Math.sin(a) * R0], pts = [];
      for (let k = 0; k <= 10; k++) { const t = k / 10, j = (1 - t) * 0.35 * (k && k < 10 ? 1 : 0); pts.push([s[0] + (tgt[0] - s[0]) * t + (L.rnd() - 0.5) * j, s[1] + (tgt[1] - s[1]) * t + Math.sin(Math.PI * t) * 0.6 + (L.rnd() - 0.5) * j, s[2] + (tgt[2] - s[2]) * t + (L.rnd() - 0.5) * j]); }
      K.tube(G, pts, t => 0.035 * (0.4 + 0.6 * t), arcM, { n: 40, radial: 5, dirt: 0 });
    }
    broken(ctx, { cx: 0, cz: 0, r: 5.4, n: 10, glow: 0.7, clods: 60, air: 0, lift: 0.2 });
  }
  if (fall) dust(ctx, { cx: -0.5, cz: 0.3, r: 4.0, n: 14, op: 0.4, y: 0.2, h: 1.2 });
  return emerge ? null : body;
}

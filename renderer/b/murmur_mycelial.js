// The Murmur, design direction C, "Mycelial": native life somewhere between animal, fungus and mineral. Soft, dark
// jelly-fungus bodies with veins of foxfire light running through them, root-like tendrils instead of legs, smoky
// quartz growing out of the flesh, pale fruiting caps and shelf fungi. Kit: murmur_mycelialkit.js.
//   ?c=swarmer | drainer | brute | burrow
//   ?v=base | rust | white | bloom      regional variant (palette and build; the Swarmer shows all four)
//   ?f=0..3                             walking frame (tendrils reach and pull in two alternating groups)
//   ?feed=1                             Drainer latched on and feeding: its root fan spread wide and blazing
//   ?hero=1                             a 3/4 perspective hero shot on a patch of ground instead of the sprite
//   ?px=N                               render size (default 512 for creatures, 1024 for the Burrow; final is half)
// Creatures follow the robots: orthographic straight down, facing +x, centred, no ground, no shadow, sun from the
// top-left toned like robkit.js. W (world units across the frame) differs per creature so each fills its frame; in the
// game draw it at tile * 0.06 * W to keep the robots' scale (the Warbot frame is W 10, drawn at 0.6 tile).
// The Burrow uses the building camera (57 degrees, like nest.js) on the 512 building canvas, pad hidden.
import { mkit } from './murmur_mycelialkit.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const Q0 = new URLSearchParams(location.search);
const CREATURE = Q0.get('c') || 'swarmer';
export const config = { pad: false, size: +(Q0.get('px') || (CREATURE === 'burrow' ? 1024 : 512)) };
export const FRAME_W = { swarmer: 6.4, drainer: 8.6, brute: 12.5 };

export default function (L) {
  const K = mkit(L);
  const { THREE, Q, P, NIGHT, GLOW, R, sstep, C } = K;
  const c = CREATURE, f = +(Q.get('f') || 0), V = K.V, feed = Q.get('feed') === '1', HERO = Q.get('hero') === '1';
  const TAU = Math.PI * 2;
  ({ swarmer, drainer, brute, burrow })[c]();

  // ================= SWARMER: a dog-sized jelly mantle running on six roots =================
  function swarmer() {
    K.seed(3101 + ['base', 'rust', 'white', 'bloom'].indexOf(V) * 7);
    const W = FRAME_W.swarmer; K.texSpace(W);
    const white = V === 'white', rust = V === 'rust', bloom = V === 'bloom';
    const n1 = K.noise3(11), n2 = K.noise3(23, 18);
    const fat = white ? 1.1 : rust ? 1.04 : 1;
    // body: a low lobed teardrop, narrow at the front, a soft dorsal ridge, lumpy like jelly fungus
    const bodyFn = (dx, dy, dz) => {
      const front = sstep(-0.3, 1, dx), a = Math.atan2(dz, dx), eq = 1 - Math.abs(dy);
      const lobe = 1 + 0.05 * Math.sin(a * 5 + 0.7) * eq * eq;
      const x = (dx * 1.22 - 0.08) * lobe;
      const z = dz * 0.95 * fat * (1 - 0.3 * front) * lobe;
      let y = dy > 0 ? dy * 0.62 * fat * (1 - 0.3 * front) : dy * 0.22;
      if (dy > 0) y += 0.07 * Math.exp(-(dz * dz) / 0.05) * dy * (1 - front * 0.7);
      const n = n1(dx * 2.2, dy * 2.2, dz * 2.2) * 0.075 + n2(dx * 6, dy * 6, dz * 6) * 0.025;
      return [x + dx * n, 0.42 + y + dy * n, z + dz * n];
    };
    const equator = a => bodyFn(Math.cos(a), 0, Math.sin(a));
    const edgeAt = (x, s) => { const dx = Math.max(-0.99, Math.min(0.99, (x + 0.08) / 1.22)); return bodyFn(dx, 0, s * Math.sqrt(1 - dx * dx)); };

    // six roots: hips under the frill, ankles out to the side; tripod gait (L0 R1 L2 | R0 L1 R2)
    const reachK = white ? 0.86 : 1;
    const LEGS = [[0.62, 0.72, 1.45], [-0.06, 0.05, 1.68], [-0.72, -0.62, 1.48]];
    const hips = [];
    LEGS.forEach(([hx, dx, az], i) => { for (const s of [-1, 1]) { const e = edgeAt(hx, s); hips.push({ i, s, x: hx, z: e[2] * 0.8, dx: dx * reachK, az: az * reachK, grp: (i + (s > 0 ? 1 : 0)) % 2 }); } });

    // ---- glowing veins inside the flesh (top-down texture space)
    const heart = [-0.22, 0];
    const veins = K.canvas(1024, (g) => {
      K.node(g, heart[0], heart[1], 0.9, 0.1);                                       // the light inside the jelly
      K.node(g, heart[0], heart[1], 0.24, 0.9);
      for (const h of hips) { const a = Math.atan2(h.z - heart[1], h.x - heart[0]); K.vein(g, heart[0], heart[1], a, Math.hypot(h.z - heart[1], h.x - heart[0]) * 0.62, 0.03, 2, { wig: 0.8 }); }
      K.vein(g, heart[0], heart[1], 0, 0.85, 0.034, 2, { wig: 0.5 });                // forward to the sensor crown
      for (const a of [Math.PI - 0.5, Math.PI, Math.PI + 0.5]) K.vein(g, heart[0], heart[1], a, 0.55, 0.026, 3);
      if (bloom) for (let i = 0; i < 70; i++) { const a = R(0, TAU), r = Math.sqrt(R(0.05, 1)); K.node(g, heart[0] + Math.cos(a) * r * 1.25, Math.sin(a) * r * 0.9, R(0.025, 0.06), 0.95); }
    });
    // flesh colours: dark core, lighter body, a waxy translucent rim where the jelly thins
    const cCore = C(P.core), cBody = C(P.body), cRim = C(P.rim);
    const fleshCol = (q, d) => {
      const t = Math.hypot(d.x, d.z), m = 0.9 + 0.2 * n2(d.x * 9, d.y * 9, d.z * 9);
      const col = cCore.clone().lerp(cBody, sstep(0.3, 0.9, t)).lerp(cRim, sstep(0.9, 1, t) * 0.5 * (d.y > -0.1 ? 1 : 0.3));
      return col.multiplyScalar(m * (d.y < -0.2 ? 0.6 : 1));
    };
    const fk = bloom ? 2.1 : 1.6;
    const fm = K.flesh(veins, { k: fk, rough: white ? 0.55 : 0.36, cc: white ? 0.35 : 0.85 });
    const G = L.group(0, 0, 0);
    K.blob(bodyFn, fleshCol, fm, { parent: G });

    // ---- the frill: a wavy, thin, translucent-looking skirt round the body (shorter at the front)
    {
      const NA = 240, NT = 7, pos = [], col = [], idx = [];
      for (let j = 0; j <= NT; j++) for (let i = 0; i <= NA; i++) {
        const a = i / NA * TAU, t = j / NT, e = equator(a), front = sstep(0.2, 0.95, Math.cos(a));
        const w = (0.24 + 0.08 * Math.sin(a * 7 + 1.3) + 0.04 * Math.sin(a * 13)) * (1 - 0.8 * front) * fat;
        const rr = Math.hypot(e[0] + 0.08, e[2]), ux = (e[0] + 0.08) / rr, uz = e[2] / rr;
        const x = e[0] + ux * (w * t - 0.14), z = e[2] + uz * (w * t - 0.14);
        const y = 0.4 - 0.16 * t * t + 0.05 * Math.sin(a * 9 + 0.5) * t;
        pos.push(x, y, z);
        const cc = cBody.clone().lerp(cRim, 0.2 + 0.7 * t * t).multiplyScalar(0.9 + 0.14 * Math.sin(a * 23));
        col.push(cc.r, cc.g, cc.b);
      }
      for (let j = 0; j < NT; j++) for (let i = 0; i < NA; i++) { const a = j * (NA + 1) + i, b = a + 1, cc = a + NA + 1, d = cc + 1; idx.push(a, b, cc, b, d, cc); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals(); K.planarUV(g);
      const frm = K.flesh(veins, { k: fk, sheen: 1, rough: white ? 0.6 : 0.42, cc: 0.6 }); frm.side = THREE.DoubleSide;
      L.mesh(g, frm, 0, 0, 0, { parent: G });
    }

    // ---- six roots: knobbly, thick at the hip, splitting into gripping rootlets
    const thick = rust ? 1.22 : white ? 1.12 : 1;
    for (const h of hips) {
      const ph = f * Math.PI / 2 + Math.PI / 4 + h.grp * Math.PI + h.i * 0.2;
      const sw = Math.max(0, -Math.sin(ph)), dxs = 0.3 * Math.cos(ph) * reachK, s = h.s;
      const ankle = [h.x + h.dx + dxs, 0.16 + sw * 0.34, s * (h.az - sw * 0.28)];
      const knee = [h.x + (h.dx + dxs) * 0.45, 0.66 + sw * 0.22, s * (Math.abs(h.z) + (h.az - Math.abs(h.z)) * 0.5)];
      K.rootLeg([h.x, 0.34, h.z], knee, ankle, { r0: 0.15 * thick, rA: 0.06 * thick, swing: sw, n: 3, len: 0.62 * reachK, spread: 1.15, bias: h.i === 0 ? 0.25 * s : h.i === 2 ? -0.25 * s : 0, parent: G, gk: bloom ? 2.6 : 2.2, gw: 0.022 * thick });
    }

    // ---- feelers: two sensing roots out of the front, tipped with light; they twitch frame to frame
    const rm = K.rootMat();
    for (const s of [-1, 1]) {
      const tw = 0.1 * Math.sin(f * Math.PI / 2 + (s > 0 ? 1.2 : 0));
      const pts = [[0.95, 0.52, s * 0.14], [1.4, 0.62, s * (0.26 + tw * 0.4)], [1.85, 0.5, s * (0.46 + tw)], [2.25, 0.36, s * (0.5 + tw * 1.4)], [2.5, 0.3, s * (0.36 + tw * 1.6)]];
      const cv = K.tube(pts, u => 0.012 + 0.04 * (1 - u), rm, { seg: 30, rad: 6, tipFrom: 0.4, parent: G });
      const e = cv.getPointAt(1); L.sphere(0.065, K.glowMat(3), e.x, e.y, e.z, { parent: G, dirt: 0, cast: false });
      K.glowThread(cv, 0.5, 1, 0.012, 0.02, { parent: G, from: 0.0, to: 1.0, k: 2 });
    }
    // ---- the sensor crown: a cluster of glowing papillae at the front (eyes? nobody knows)
    for (const [dz, dy, r] of [[0, 0.3, 0.09], [-0.2, 0.24, 0.075], [0.2, 0.24, 0.075], [-0.37, 0.1, 0.06], [0.37, 0.1, 0.06], [-0.1, 0.46, 0.055], [0.1, 0.46, 0.055]]) {
      const dx = Math.sqrt(Math.max(0, 1 - dz * dz - dy * dy)), q = bodyFn(dx, dy, dz);
      L.sphere(r * 1.4, L.M.plain(P.core, 0.4), q[0] - 0.04, q[1] - 0.02, q[2], { parent: G, dirt: 0 });
      L.sphere(r, K.glowMat(2.6), q[0] + 0.01, q[1] + 0.01, q[2], { parent: G, dirt: 0, cast: false });
    }
    // ---- trailing threads behind: they wave as it runs
    for (const [z0, k] of [[-0.2, 0], [0.2, 1], [0, 2]]) {
      const pts = []; const len = k === 2 ? 1.25 : 1.0;
      for (let i = 0; i <= 6; i++) { const t = i / 6; pts.push([-1.2 - t * len, 0.34 - 0.26 * t, z0 * (1 + t * 1.8) + 0.15 * t * Math.sin(t * 5 + f * Math.PI / 2 + k * 2)]); }
      const cv = K.tube(pts, u => 0.008 + 0.045 * (1 - u), rm, { seg: 24, rad: 6, tipFrom: 0.3, parent: G });
      K.glowThread(cv, 0.0, 1, 0.012, 0.02, { parent: G, from: 0.05, to: 1.0, k: 1.6 });
    }

    // ---- semi-mineral: a crest of smoky quartz grown through the back (icy in the White, Ring Crystal in the Bloom)
    for (const [dx, dz, sz, n] of [[-0.3, 0, 0.5, 3], [0.05, 0.05, 0.32, 2], [-0.62, -0.1, 0.34, 2], [-0.12, -0.36, 0.22, 1], [-0.2, 0.38, 0.24, 1]]) {
      const dy = Math.sqrt(Math.max(0, 1 - dx * dx - dz * dz)), q = bodyFn(dx, dy, dz);
      K.crystalCluster([q[0], q[1] - 0.08, q[2]], [-0.8 + dz * 0.2, 1, dz * 1.4], n, sz * 1.2 * (rust ? 0.75 : 1), 0.45, G);
    }
    // ---- regional build
    if (rust) {   // armour: flaky rust-orange mineral plates over the back, chunky and rough
      const pm = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.86, metalness: 0.08, flatShading: true }); pm.envMapIntensity = 0.4;
      const plates = [[0.5, 0, 0.42, 0.36], [0.1, -0.42, 0.42, 0.32], [0.1, 0.42, 0.42, 0.32], [-0.62, -0.46, 0.4, 0.3], [-0.62, 0.46, 0.4, 0.3], [-0.95, 0, 0.36, 0.34], [0.5, -0.5, 0.3, 0.24], [0.5, 0.5, 0.3, 0.24], [-0.25, -0.62, 0.34, 0.24], [-0.25, 0.62, 0.34, 0.24]];
      const cP = C(P.plate), cE = C(P.plateE), np = K.noise3(91, 10);
      plates.forEach(([px, pz, rx, rz], k) => {
        const dx = (px + 0.08) / 1.22, dz = pz / 0.95, dy = Math.sqrt(Math.max(0.04, 1 - dx * dx - dz * dz));
        const q = bodyFn(dx, dy, dz);
        let g = new THREE.IcosahedronGeometry(1, 2); g.deleteAttribute('normal'); g.deleteAttribute('uv'); g = mergeVertices(g, 1e-5);
        const p = g.attributes.position, cols = new Float32Array(p.count * 3);
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i), y = p.getY(i), z = p.getZ(i), lump = 1 + 0.22 * np(x * 2 + k, y * 2, z * 2);
          p.setXYZ(i, x * rx * lump, (y > 0 ? y * 0.14 : y * 0.06) * lump, z * rz * lump);
          const e = sstep(0.55, 1, Math.hypot(x, z)); const cc = cP.clone().lerp(cE, e * 0.8).multiplyScalar(0.85 + 0.25 * np(x * 5, y * 5 + k, z * 5)); cols.set([cc.r, cc.g, cc.b], i * 3);
        }
        g.setAttribute('color', new THREE.BufferAttribute(cols, 3)); g.computeVertexNormals();
        const m = L.mesh(g, pm, q[0], q[1] + 0.01, q[2], { parent: G });
        m.rotation.order = 'YXZ'; m.rotation.set(-pz * 0.55, R(-0.3, 0.3), (px + 0.1) * -0.35);
      });
    }
    if (white) {   // hoarfrost: a fur of fine ice needles over the back
      const im = new THREE.MeshPhysicalMaterial({ color: '#f4fbff', roughness: 0.1, clearcoat: 1, flatShading: true, sheen: 0.4, sheenColor: C('#ffffff') }); im.envMapIntensity = 1.2;
      for (let i = 0; i < 220; i++) {
        const dx = R(-0.95, 0.7), dz = R(-0.9, 0.9), dy2 = 1 - dx * dx - dz * dz; if (dy2 < 0.05) continue;
        const q = bodyFn(dx, Math.sqrt(dy2), dz), len = R(0.08, 0.2);
        const g = new THREE.ConeGeometry(R(0.012, 0.024), len, 4, 1); g.translate(0, len / 2, 0);
        const m = L.mesh(g, im, q[0], q[1] - 0.02, q[2], { parent: G, dirt: 0 });
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx * 0.8 + R(-0.3, 0.3), 1, dz * 0.8 + R(-0.3, 0.3)).normalize());
      }
    }
  }

  // ================= DRAINER: a bell-capped feeder with a crown of charge sacs and a mouth of root threads =================
  function drainer() {
    K.seed(4207);
    const W = FRAME_W.drainer; K.texSpace(W);
    const n1 = K.noise3(31), n2 = K.noise3(37, 18);
    const CX = -0.35, squat = feed ? 0.82 : 1;
    // the bell: a domed cap with a scalloped, slightly drooping rim; flat underneath
    const capFn = (dx, dy, dz) => {
      const a = Math.atan2(dz, dx), eq = 1 - Math.abs(dy), front = sstep(0, 1, dx);
      const sc = 1 + 0.055 * Math.sin(a * 9 + 0.4) * Math.pow(eq, 6) + 0.03 * Math.sin(a * 4 + 1.1) * eq;
      const x = CX + dx * 1.72 * sc, z = dz * 1.5 * sc * (1 - 0.08 * front);
      let y = dy > 0 ? Math.pow(dy, 0.85) * 1.05 * squat : dy * 0.22;
      y -= 0.12 * Math.pow(eq, 8);                                                   // the rim droops
      y += 0.05 * Math.sin(a * 9 + 0.4) * Math.pow(eq, 6);
      const n = n1(dx * 2, dy * 2, dz * 2) * 0.06 + n2(dx * 7, dy * 7, dz * 7) * 0.02;
      return [x + dx * n, 0.62 * squat + y + dy * n, z + dz * n];
    };
    const top = (dx, dz) => capFn(dx, Math.sqrt(Math.max(0, 1 - dx * dx - dz * dz)), dz);
    const MOUTH = [CX + 1.62, 0.42 * squat, 0];
    // six short, sturdy roots: tripod gait; a feeding Drainer plants all six, splayed wide
    const LEGS = [[0.55, 0.62, 1.85], [-0.35, -0.05, 2.02], [-1.15, -0.7, 1.78]];
    const hips = []; LEGS.forEach(([hx, dx, az], i) => { for (const s of [-1, 1]) hips.push({ i, s, x: CX + hx, dx, az, grp: (i + (s > 0 ? 1 : 0)) % 2 }); });

    // ---- veins: radiating from the crown to the rim like gills, and a bright trunk to the mouth
    const crown = [CX - 0.1, 0];
    const SACS = []; for (let k = 0; k < 7; k++) { const a = k / 7 * TAU + 0.25; SACS.push([crown[0] + Math.cos(a) * 0.74, Math.sin(a) * 0.68, 0.15 + 0.035 * ((k * 3) % 4)]); }
    const veins = K.canvas(1024, (g) => {
      K.node(g, crown[0], crown[1], 1.2, feed ? 0.12 : 0.05);
      K.node(g, crown[0], crown[1], 0.22, 0.7);
      for (let k = 0; k < 15; k++) { const a = k / 15 * TAU + R(-0.08, 0.08); K.vein(g, crown[0] + Math.cos(a) * 0.45, crown[1] + Math.sin(a) * 0.45, a, 1.1, 0.016, 1, { wig: 0.45 }); }
      for (const [sx, sz] of SACS) K.vein(g, crown[0], crown[1], Math.atan2(sz - crown[1], sx - crown[0]), 0.6, 0.02, 0, { wig: 0.3 });
      K.vein(g, crown[0], 0, 0, 1.9, 0.034, 1, { wig: 0.25 });
      for (const s of [-1, 1]) K.vein(g, crown[0], 0, s * 0.35, 1.6, 0.022, 2, { wig: 0.4 });
    });
    const cCore = C(P.core), cBody = C(P.body), cRim = C(P.rim);
    const capCol = (q, d) => {
      const t = Math.hypot(d.x, d.z), m = 0.9 + 0.2 * n2(d.x * 9, d.y * 9, d.z * 9), a = Math.atan2(d.z, d.x);
      const rib = 0.92 + 0.08 * Math.sin(a * 44);                                  // fine gill ridging toward the rim
      const col = cCore.clone().lerp(cBody, sstep(0.25, 0.85, t)).lerp(cRim, sstep(0.88, 1, t) * 0.6 * (d.y > -0.15 ? 1 : 0.3));
      return col.multiplyScalar(m * (t > 0.7 ? rib : 1) * (d.y < -0.2 ? 0.55 : 1));
    };
    const G = L.group(0, 0, 0);
    K.blob(capFn, capCol, K.flesh(veins, { k: feed ? 2.0 : 1.35, rough: 0.34, cc: 0.9 }), { parent: G });

    // ---- the crown of charge sacs: swollen bladders full of stolen charge (they blaze while it feeds)
    const sacM = new THREE.MeshPhysicalMaterial({ color: K.dimHex(P.glow, 0.42), roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.08, sheen: 0.6, sheenColor: C(P.hot),
      emissive: C(P.glow), emissiveIntensity: (feed ? 1.9 : 0.55) * GLOW }); sacM.envMapIntensity = 1.2; sacM.userData.glow = K.dimHex(P.glow, feed ? (NIGHT ? 0.95 : 0.6) : (NIGHT ? 0.55 : 0.22));
    const collarM = L.M.plain(P.core, 0.45, 0);
    for (const [sx, sz, r] of SACS) {
      const dx = (sx - CX) / 1.72, dz = sz / 1.5, q = top(dx, dz);
      const g = new THREE.SphereGeometry(r * (feed ? 1.15 : 1), 28, 18); g.scale(1, 0.85, 1);
      L.mesh(g, sacM, q[0], q[1] + r * 0.45, q[2], { parent: G, dirt: 0 });
      const cg = new THREE.TorusGeometry(r * 0.95, r * 0.22, 8, 24); cg.rotateX(Math.PI / 2);
      L.mesh(cg, collarM, q[0], q[1] + r * 0.05, q[2], { parent: G, dirt: 0 });
      L.sphere(r * 0.3, K.glowMat(feed ? 2.6 : 1.4, null, P.hot), q[0] + r * 0.1, q[1] + r * 0.75, q[2] + r * 0.1, { parent: G, dirt: 0, cast: false });   // the lit core inside
    }
    // ---- fruiting caps clustered at the back of the bell, and a few quartz points by the rim
    for (const [dx, dz, r] of [[-0.62, 0.12, 0.3], [-0.74, -0.2, 0.24], [-0.5, -0.4, 0.18], [-0.82, 0.36, 0.2]]) {
      const q = top(dx, dz); K.cap(q[0], q[1] - 0.05, q[2], r, r * 0.55, [dz * 0.5, dx * 0.4], { parent: G, stem: r * 0.7, glowGill: true });
    }
    for (const [dx, dz, sz] of [[-0.4, 0.7, 0.34], [0.05, -0.78, 0.3], [-0.88, -0.05, 0.3]]) { const q = top(dx, dz); K.crystalCluster([q[0], q[1] - 0.06, q[2]], [dx * 1.4, 1, dz * 1.4], 2, sz, 0.4, G); }

    // ---- roots
    for (const h of hips) {
      const ph = f * Math.PI / 2 + Math.PI / 4 + h.grp * Math.PI + h.i * 0.2;
      const sw = feed ? 0 : Math.max(0, -Math.sin(ph)), dxs = feed ? 0 : 0.26 * Math.cos(ph), s = h.s;
      const az = h.az * (feed ? 1.08 : 1);
      const e = capFn((h.x - CX) / 1.72, -0.05, s * Math.sqrt(Math.max(0, 1 - Math.pow((h.x - CX) / 1.72, 2))));
      const hip = [h.x, 0.32 * squat, e[2] * 0.75];
      const ankle = [h.x + h.dx + dxs, 0.15 + sw * 0.32, s * (az - sw * 0.28)];
      const knee = [h.x + (h.dx + dxs) * 0.45, 0.62 * squat + sw * 0.2, s * (Math.abs(hip[2]) + (az - Math.abs(hip[2])) * 0.52)];
      K.rootLeg(hip, knee, ankle, { r0: 0.17, rA: 0.07, swing: sw, n: 4, len: 0.62, spread: 1.3, parent: G, gk: 2.0, gw: 0.024, glowTo: 0.65 });
    }

    // ---- the feeding organ: a braid of root threads from the mouth under the front rim
    const rm = K.rootMat();
    const threadM = K.glowMat(feed ? 2.8 : 1.6, K.fadeTex(feed ? 0.5 : 0.05, 1.0));
    if (!feed) {   // walking: bundled into a swaying proboscis, its tip splayed and lit
      const sway = 0.14 * Math.sin(f * Math.PI / 2 + 0.6);
      const tip = [MOUTH[0] + 1.35, 0.3, sway * 1.6];
      for (let k = 0; k < 5; k++) {
        const a = k / 5 * TAU, rr = 0.07;
        const pts = [[MOUTH[0] - 0.15, MOUTH[1], Math.sin(a) * 0.12], [MOUTH[0] + 0.4, 0.46 + Math.cos(a + 1) * rr, sway * 0.3 + Math.sin(a + 1) * rr],
          [MOUTH[0] + 0.85, 0.42 + Math.cos(a + 2) * rr, sway * 0.9 + Math.sin(a + 2) * rr], [tip[0], tip[1] + Math.cos(a + 3) * rr * 0.6, tip[2] + Math.sin(a + 3) * rr * 0.6]];
        const cv = K.tube(pts, u => 0.05 - 0.025 * u, rm, { seg: 24, rad: 7, tipFrom: 0.7, parent: G });
        K.glowThread(cv, 0.15, 1, 0.014, u => 0.04, { parent: G, from: 0.0, to: 1.0, k: 1.8 });
      }
      for (let k = 0; k < 7; k++) {   // the splayed tip: short lit filaments, like a hand of roots
        const a = (k / 6 - 0.5) * 1.9 + sway, l = R(0.32, 0.5);
        const pts = [tip, [tip[0] + Math.cos(a) * l * 0.5, 0.24, tip[2] + Math.sin(a) * l * 0.5], [tip[0] + Math.cos(a) * l, 0.14, tip[2] + Math.sin(a) * l]];
        const cv = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)));
        L.mesh(new THREE.TubeGeometry(cv, 12, 0.016, 5, false), K.glowMat(2.2, K.fadeTex(0.2, 1.0)), 0, 0, 0, { parent: G, cast: false, dirt: 0 });
        const e = cv.getPointAt(1); L.sphere(0.03, K.glowMat(3, null, P.hot), e.x, e.y, e.z, { parent: G, dirt: 0, cast: false });
      }
    } else {       // feeding: the threads fan out over whatever it has latched onto, branching like mycelium, blazing
      const fan = (x, z, a, len, w, depth) => {
        const pts = [[x, depth === 3 ? MOUTH[1] : 0.06, z]]; let ang = a, px = x, pz = z;
        const n = 5; for (let i = 1; i <= n; i++) { ang += R(-0.25, 0.25); px += Math.cos(ang) * len / n; pz += Math.sin(ang) * len / n; pts.push([px, depth === 3 ? Math.max(0.05, MOUTH[1] * (1 - i / 2)) : 0.05, pz]); }
        const cv = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)));
        const g = new THREE.TubeGeometry(cv, 20, 1, 6, false), pp = g.attributes.position, v = new THREE.Vector3(), P0 = new THREE.Vector3();
        for (let i = 0; i <= 20; i++) { cv.getPointAt(i / 20, P0); const r = w * (1 - 0.7 * i / 20); for (let j = 0; j <= 6; j++) { const k = i * 7 + j; v.fromBufferAttribute(pp, k).sub(P0).multiplyScalar(r).add(P0); pp.setXYZ(k, v.x, v.y, v.z); } }
        g.computeVertexNormals();
        L.mesh(g, depth === 3 ? K.glowMat(2.4, K.fadeTex(0.6, 1.0)) : threadM, 0, 0, 0, { parent: G, cast: false, dirt: 0 });
        if (depth > 0) for (const b of [-1, 1]) if (rnd() < 0.85) fan(px, pz, ang + b * R(0.35, 0.7), len * R(0.45, 0.65), w * 0.65, depth - 1);
        else L.sphere(w * 1.8, K.glowMat(3, null, P.hot), px, 0.05, pz, { parent: G, dirt: 0, cast: false });
        if (depth === 0) L.sphere(w * 1.6, K.glowMat(3, null, P.hot), px, 0.05, pz, { parent: G, dirt: 0, cast: false });
      };
      const rnd = K.rnd;
      for (let k = 0; k < 9; k++) { const a = (k / 8 - 0.5) * 2.3; fan(MOUTH[0] - 0.05, (k / 8 - 0.5) * 0.5, a, R(0.85, 1.15), 0.045, 3); }
      // the mouth disc itself, pressed down and lit
      const md = new THREE.CylinderGeometry(0.42, 0.5, 0.12, 28); L.mesh(md, K.glowMat(2.2, null, P.hot), MOUTH[0] - 0.05, 0.08, 0, { parent: G, dirt: 0 });
    }
  }

  function brute() { throw new Error('brute: not yet'); }
  function burrow() { throw new Error('burrow: not yet'); }

  function mergeV(g) { return mergeVertices(g, 1e-5); }

  // ---- camera
  if (c !== 'burrow' && !HERO) K.topDown(FRAME_W[c]);
  K.tameLights(c === 'burrow' ? 0.35 : 0.12);
}

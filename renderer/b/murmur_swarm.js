// The Murmur, design direction B: "Crystal-backed swarm". Arthropods with dark chitin, studded with shards of the Ring
// Crystal they have eaten; the shards glow from inside (a faint shimmer by day, white lanterns at night).
//   ?c=swarmer | drainer | brute | burrow
//   ?v=base | rust | white | bloom      (regional variants, Swarmer)
//   ?f=0..3                             walking frame (alternating gait; legs, antennae and palps move)
//   ?feed=1                             Drainer latched on and feeding: palps clamped, mouth disc and sac blazing
//   ?hero=1                             a 3/4 perspective hero shot on a patch of ground instead of the top-down sprite
//   ?hi=1|2                             render 2x / 4x bigger (presentation)
//   ?xt=violet                          the shards in the Crystal resource's violet instead of white (a colour option)
// Sprites follow the robots: orthographic straight down, facing +x, centred, no ground and no shadow (the game draws
// those), sun from the top-left, toned like robkit.js. W (world units across the frame) differs per creature so each
// fills its frame; in the game draw it at tile * 0.06 * W to keep the robots' scale (the Warbot is drawn at 0.6, W 10).
// The Burrow uses the building camera (like nest.js) on the 512 building canvas.
import { mkit } from './murmur_swarmkit.js';

const P = new URLSearchParams(location.search);
const C = P.get('c') || 'swarmer', HI = +(P.get('hi') || 0), HERO = !!+(P.get('hero') || 0);
export const config = C === 'burrow' ? { pad: false } : { pad: false, size: [512, 1024, 2048][HI] };
export const SPRITE_W = { swarmer: 6.4, drainer: 8.4, brute: 11 };

export default function (L) {
  const K = mkit(L), { THREE } = K;
  const f = +(P.get('f') || 0), V = P.get('v') || 'base', FEED = !!+(P.get('feed') || 0);
  L.seed({ swarmer: 6100, drainer: 6200, brute: 6300, burrow: 6400 }[C] + (V === 'base' ? 0 : V.length));

  if (C === 'burrow') return burrow(L, K);
  const W = SPRITE_W[C];
  const heroCams = {
    swarmer: { pos: [5.2, 3.2, 6.2], at: [0.1, 0.5, 0.2], fov: 30 },
    drainer: { pos: [7.0, 4.6, 7.8], at: [0.4, 0.6, 0.2], fov: 30 },
    brute: { pos: [12.0, 4.4, 7.4], at: [0.4, 0.95, 0.1], fov: 40 },
  };
  K.camera(W, HERO && heroCams[C]);
  if (HERO) heroGround(L, K, W);
  const G = L.group(0, 0, 0);
  if (C === 'swarmer') swarmer(L, K, G, f, V);
  else if (C === 'drainer') drainer(L, K, G, f, FEED);
  else brute(L, K, G, f);
}

// ---------------------------------------------------------------------------------------------------------------
// palettes
// Ring Crystal as eaten and grown back: smoky glass with a breath of the Crystal resource's violet, and a near-white light
// inside. White is the one glow no team owns (the robots' lights are cyan, red, green or purple), so a Murmur spark can
// never be mistaken for one of your own units at night. By day the shards read as glass, not as lamps.
const XTAL = P.get('xt') === 'violet'
  ? { shell: '#7a5fc0', core: '#d9c4ff', glow: '#b98cff', opacity: 0.78, dayCore: 0.5 }      // ?xt=violet: the alternative shown on the sheet
  : { shell: '#9a92b6', core: '#f7f5ff', glow: '#f1efff', opacity: 0.78, dayCore: 0.62 };
const PAL = {
  base:  { body: '#3b2c24', plate: '#3b2c24', leg: '#2e231e', tip: '#140f0c', joint: '#3e2a20', mand: '#3b2618', xtal: XTAL, irid: 0.5 },
  rust:  { body: '#3a2419', plate: '#a5512a', leg: '#4a2a1b', tip: '#1c120c', joint: '#6a3a22', mand: '#4a2a18', xtal: XTAL, irid: 0.15 },
  white: { body: '#c8cdd0', plate: '#d7dbdd', leg: '#9da4a8', tip: '#5e666b', joint: '#b9a9a0', mand: '#7f878c', xtal: { shell: '#eef1f4', core: '#e9edf2', glow: '#e4e9ef', opacity: 0.75, k: 0.55, dayCore: 0.5 }, irid: 0.1 },
  bloom: { body: '#251a2b', plate: '#2a1c31', leg: '#20162a', tip: '#0f0a14', joint: '#5a2a66', mand: '#2f1c38', xtal: { shell: '#a274ea', core: '#c48dff', glow: '#b67cff', opacity: 0.6, k: 1.15, dayCore: 0.6 }, irid: 0.7 },
};

// ---------------------------------------------------------------------------------------------------------------
// SWARMER: small, fast, ant-like runner. Big flat head with sickle mandibles and elbowed antennae, a narrow thorax with
// a crest of shards, a pinched waist, and a gaster that bursts with a crown of Ring Crystal swept back like flame.
function swarmer(L, K, G, f, v) {
  const { THREE } = K, pal = PAL[v];
  const SC = v === 'white' ? 1.3 : v === 'rust' ? 1.3 : 1.25;
  G.scale.setScalar(SC);
  const fat = v === 'white' ? 1.18 : v === 'rust' ? 1.08 : 1;        // the the Polar Caps ones are stout, the Rust ones bulked by plates
  const legK = v === 'white' ? 0.8 : 1;                               // short legs: slow-looking
  const sheen = v === 'white' ? { sheen: 1, sheenColor: '#ffffff', rough: 0.62, cc: 0.2, ccr: 0.6 } : {};
  let bodyM, plateM;
  if (v === 'bloom') {
    const spots = L.canvasTex(512, (g, n) => {
      g.fillStyle = '#000'; g.fillRect(0, 0, n, n);
      for (let i = 0; i < 70; i++) { const x = L.rnd() * n, y = L.rnd() * n, r = 3 + L.rnd() * 9; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.5, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
      g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 2;
      for (let i = 0; i < 26; i++) { let x = L.rnd() * n, y = L.rnd() * n; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 8; k++) { x += (L.rnd() - 0.5) * 50; y += (L.rnd() - 0.2) * 30; g.lineTo(x, y); } g.stroke(); }
    });
    spots.repeat.set(2, 1);
    bodyM = K.chitin(pal.body, { irid: pal.irid, emissiveMap: spots, emissive: '#b26bff', glow: K.dimGlow('#b070ff'), ek: 0.9 });
    plateM = bodyM;
  } else {
    bodyM = K.chitin(pal.body, { irid: pal.irid, ...sheen });
    plateM = v === 'rust' ? K.crust(pal.plate) : v === 'white' ? K.chitin(pal.plate, { irid: 0.05, ...sheen }) : bodyM;
  }
  const legM = K.chitin(pal.leg, { irid: pal.irid * 0.6, ns: 0.25, ...sheen }), tipM = K.plain(pal.tip, 0.4), jointM = K.plain(pal.joint, 0.45);
  const mandM = K.chitin(pal.mand, { irid: 0.2, ns: 0.2 });
  const collar = plateM;

  // ---- legs first (under the body). Listed L1,R1,L2,R2,L3,R3 (z<0 is the left side, image top).
  const LG = [], GL = L.group(0, 0, 0, 0, G);                         // the moving parts (legs, antennae) live in GL
  for (const s of [-1, 1]) LG.push([[0.55, 0.3, s * 0.16], [0.6 + 0.85 * legK, 0, s * (0.2 + 0.85 * legK)], { kneeUp: 0.5, kneeOut: 0.22, kneeFwd: -0.08 }]);
  for (const s of [-1, 1]) LG.push([[0.32, 0.3, s * 0.2], [0.35, 0, s * (0.25 + 1.2 * legK)], { kneeUp: 0.55, kneeFwd: 0.12 }]);
  for (const s of [-1, 1]) LG.push([[0.1, 0.3, s * 0.18], [0.1 - 1.3 * legK, 0, s * (0.25 + 1.1 * legK)], { kneeUp: 0.6, kneeT: 0.4, kneeOut: 0.3, kneeFwd: 0.1 }]);
  K.legs(GL, LG, f, { mat: legM, tipMat: tipM, jointMat: jointM, r: (v === 'white' ? 0.078 : v === 'rust' ? 0.074 : 0.064), kneeUp: 0.55, stride: 0.26 * legK, lift: 0.28, spines: v === 'white' ? 0 : 1, claw: true });

  // ---- head: broad and flat, glossy, big compound eyes
  const hx = 1.0;
  K.seg(G, [hx, 0.36, 0], 0.42, 0.25, 0.4 * (v === 'rust' ? 1.08 : 1), plateM, { bands: 0, crease: 0.25, lump: 0.015, axisFlat: 0.5 });
  for (const s of [-1, 1]) {
    const e = L.sphere(0.1, K.eye(), hx + 0.12, 0.47, s * 0.31, { parent: G, dirt: 0 }); e.scale.set(1.15, 0.8, 0.85);
    // sickle mandibles with inner teeth (they open and close a little with the gait)
    const open = 0.05 * Math.sin(f * Math.PI / 2);
    const mk = v === 'white' ? 0.8 : 1;
    const mp = K.curve([[hx + 0.28, 0.3, s * 0.22], [hx + 0.28 + 0.26 * mk, 0.3, s * (0.31 + open)], [hx + 0.28 + 0.5 * mk, 0.28, s * (0.26 + open)], [hx + 0.28 + 0.62 * mk, 0.27, s * (0.1 + open)]], 6);
    K.tube(G, mp, t => 0.1 * (1 - t) ** 0.8 + 0.012, mandM);
    for (const t of [2, 4]) { const p = mp[t]; K.cone(G, p, [0.2, 0, -s], 0.12, 0.03, tipM); }
    // elbowed antennae: a long scape, then the whip; they sweep with the gait
    const sw = 0.1 * Math.cos(f * Math.PI / 2 + (s > 0 ? Math.PI : 0)), ak = v === 'white' ? 0.8 : 1;
    const a0 = [hx + 0.22, 0.48, s * 0.13], a1 = [hx + 0.48, 0.72, s * 0.38];
    K.limb(G, a0, a1, 0.032, 0.026, legM, { bulge: 0.1 });
    L.sphere(0.035, jointM, a1[0], a1[1], a1[2], { parent: G, dirt: 0 });
    K.tube(G, [a1, [a1[0] + 0.35 * ak, 0.78, s * (0.58 + sw)], [a1[0] + 0.72 * ak, 0.66, s * (0.7 + sw)], [a1[0] + 0.98 * ak, 0.5, s * (0.62 + sw * 1.4)]], t => 0.026 - 0.012 * t + (t > 0.9 ? 0.01 : 0), legM);
  }
  // ---- neck, thorax (with a crest of shards), waist
  L.sphere(0.13, legM, 0.64, 0.36, 0, { parent: G, dirt: 0 });
  K.seg(G, [0.3, 0.4, 0], 0.46, 0.25 * fat, 0.27 * fat, plateM, { bands: 2, depth: 0.1, crease: 0.2, seed: 2 });
  // ---- gaster: banded, the shard crown bursting out of its back
  L.sphere(0.12, legM, -0.22, 0.36, 0, { parent: G, dirt: 0 });
  L.sphere(0.1, legM, -0.33, 0.4, 0, { parent: G, dirt: 0 });
  const gx = -0.98, gy = 0.46, grx = 0.8 * fat, gry = 0.44 * fat, grz = 0.6 * fat;
  K.seg(G, [gx, gy, 0], grx, gry, grz, plateM, { bands: 4, depth: v === 'rust' ? 0.2 : 0.12, crease: 0.0, seed: 5, shade: 0.55 });

  // Rust: heavier armour. A pronotum shield over the thorax and head, spiked plate rims on the gaster
  if (v === 'rust') {
    const sh = K.seg(G, [0.55, 0.5, 0], 0.62, 0.2, 0.42, plateM, { bands: 2, depth: 0.12, crease: 0.25, seed: 8 });
    for (let i = 0; i < 4; i++) {
      const x = gx + grx * (0.62 - i * 0.42);
      for (const s of [-1, 1]) K.cone(G, [x, gy + 0.08, s * grz * (0.92 - i * 0.07)], [-0.35, 0.25, s], 0.22, 0.06, K.plain('#5a2d18', 0.7));
    }
    for (const s of [-1, 1]) K.cone(G, [0.7, 0.62, s * 0.38], [0.1, 0.35, s], 0.24, 0.06, K.plain('#5a2d18', 0.7));
  }
  // White: frost. A fringe of pale bristles round the plates and a rime of tiny ice needles on the back
  if (v === 'white') {
    const hair = K.plain('#f4f7f8', 0.8), ice = K.plain('#ffffff', 0.25);
    for (let i = 0; i < 60; i++) {
      const a = L.rnd() * Math.PI * 2, t = L.rnd();
      const x = gx + Math.cos(a) * grx * 0.98, z = Math.sin(a) * grz * 0.98;
      K.cone(G, [x, gy + 0.02, z], [Math.cos(a) * 0.9, 0.25 + L.rnd() * 0.3, Math.sin(a) * 0.9], 0.12 + t * 0.1, 0.012, hair);
    }
    for (let i = 0; i < 40; i++) {
      const x = gx + (L.rnd() - 0.5) * grx * 1.4, z = (L.rnd() - 0.5) * grz * 1.2, y = gy + gry * Math.sqrt(Math.max(0, 1 - ((x - gx) / grx) ** 2 - (z / grz) ** 2)) * 0.95;
      K.cone(G, [x, y, z], [(L.rnd() - 0.5) * 0.6, 1, (L.rnd() - 0.5) * 0.6], 0.07 + L.rnd() * 0.06, 0.015, ice);
    }
  }
  // Bloom: soft glowing fronds growing between the shards (the Bloom's own life, riding on its back)
  if (v === 'bloom') {
    const fr = K.glowMat('#c48dff', 0.6, K.dimGlow('#a46cff'));
    for (let i = 0; i < 7; i++) {
      const s = i % 2 ? 1 : -1, x = gx + 0.4 - i * 0.12, z = s * (0.2 + 0.05 * i);
      K.chain(G, K.curve([[x, gy + gry * 0.85, z], [x - 0.2, gy + gry + 0.18, z + s * 0.14], [x - 0.45, gy + gry + 0.12, z + s * 0.3]], 4), 0.025, 0.01, fr);
    }
  }

  // ---- the shards. Thorax crest, then the gaster crown (big ones swept back, smaller ones fanning out)
  const X = pal.xtal, n = v === 'rust' ? 0.7 : v === 'white' ? 0.85 : 1;
  K.shard(G, [0.42, 0.52, -0.06], [-0.45, 1, -0.35], 0.42 * n, 0.065, X, { collarMat: collar });
  K.shard(G, [0.36, 0.52, 0.08], [-0.5, 1, 0.4], 0.36 * n, 0.06, X, { collarMat: collar });
  K.shard(G, [0.14, 0.55, 0], [-0.8, 1, 0.05], 0.5 * n, 0.07, X, { collarMat: collar });
  const crown = [
    [[-0.8, gy + gry * 0.86, 0], [-1, 1.1, 0], 1.05, 0.15],
    [[-0.6, gy + gry * 0.8, -0.25], [-0.7, 0.9, -0.65], 0.74, 0.13],
    [[-0.58, gy + gry * 0.8, 0.27], [-0.75, 0.85, 0.6], 0.68, 0.125],
    [[-1.05, gy + gry * 0.78, -0.3], [-0.85, 0.65, -0.8], 0.66, 0.12],
    [[-1.02, gy + gry * 0.8, 0.29], [-0.9, 0.7, 0.75], 0.74, 0.125],
    [[-1.38, gy + gry * 0.6, -0.12], [-1, 0.45, -0.35], 0.52, 0.1],
    [[-1.32, gy + gry * 0.62, 0.15], [-1, 0.5, 0.4], 0.5, 0.1],
    [[-0.42, gy + gry * 0.84, 0.02], [-0.3, 1, 0.1], 0.36, 0.1],
    [[-0.85, gy + gry * 0.85, -0.12], [-0.2, 1, -0.25], 0.32, 0.09],
    [[-1.0, gy + gry * 0.85, 0.12], [-0.3, 1, 0.3], 0.3, 0.085],
  ];
  const keep = v === 'rust' ? [0, 1, 4, 7] : crown.map((_, i) => i);
  for (const i of keep) { const [b, d, len, r] = crown[i]; K.shard(G, b, d, len * n, r * (v === 'rust' ? 1.2 : 1), X, { collarMat: collar }); }
  if (v === 'base' || v === 'bloom') for (let i = 0; i < 5; i++) {        // small chips along the plate seams
    const a = -0.9 + i * 0.45, x = gx + grx * (0.5 - i * 0.22);
    K.shard(G, [x, gy + gry * 0.55, Math.sin(a) * grz * 0.75], [-0.4, 0.8, Math.sin(a) * 0.9], 0.24, 0.045, X, { collar: false });
  }
  centre(L, G, GL);
}

// put the still parts (body, head, shards) in the middle of the frame, so walking frames never jitter
function centre(L, G, skip) {
  G.updateMatrixWorld(true);
  const THREE = L.THREE, b = new THREE.Box3(), tmp = new THREE.Box3();
  G.traverse(o => { if (!o.isMesh) return; for (let p = o; p; p = p.parent) if (p === skip) return; tmp.setFromObject(o); b.union(tmp); });
  G.position.x -= (b.min.x + b.max.x) / 2;
}

// ---------------------------------------------------------------------------------------------------------------
// DRAINER: the feeder. A tick-like body: a flat armoured front shield ringed with shards, eight short splayed legs for
// clinging, and a swollen, wrinkled charge sac whose veins glow with what it has drunk. In front, a fleshy mouth disc
// (a puckered, toothed ring, lamprey-like) with soft feeding tendrils round it, between two big jointed palps that
// close round the target like arms. Feeding (?feed=1): palps clamped, tendrils reaching, disc and sac blazing.
function drainer(L, K, G, f, feed) {
  const { THREE } = K;
  G.scale.setScalar(1.25);
  const bodyM = K.chitin('#3d2e26', { irid: 0.45 }), legM = K.chitin('#30241e', { irid: 0.3, ns: 0.25 });
  const tipM = K.plain('#150f0c', 0.4), jointM = K.plain('#2a1d17', 0.5), X = XTAL;
  const fleshM = K.chitin('#5e3a33', { irid: 0.1, rough: 0.45, cc: 0.9, ccr: 0.15, ns: 0.8 });
  const FK = feed ? 2.4 : 1;                                             // feeding: everything that carries charge burns
  const GL = L.group(0, 0, 0, 0, G);

  // ---- legs: eight, short and splayed, built for gripping (alternating tetrapod gait)
  const LG = [];
  const legDef = [[1.0, 0.5, 1.55, 1.3, -0.05], [0.78, 0.6, 0.85, 1.72, 0.05], [0.5, 0.62, -0.1, 1.78, 0.1], [0.22, 0.55, -0.95, 1.58, 0.12]];
  for (const [hx, hz, fx, fz, kf] of legDef) for (const s of [-1, 1]) LG.push([[hx, 0.3, s * hz], [fx, 0, s * fz], { kneeFwd: kf, kneeOut: 0.12 }]);
  K.legs(GL, LG, f, { mat: legM, tipMat: tipM, jointMat: jointM, r: 0.08, kneeUp: 0.5, stride: feed ? 0 : 0.2, lift: feed ? 0 : 0.22, spines: 0.8, claw: true, ankUp: 0.14 });

  // ---- the charge sac: dark, wrinkled, glossy skin over glowing veins
  const veins = L.canvasTex(1024, (g, n) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, n, n); g.lineCap = 'round';
    const branch = (x, y, a, w, len, d) => {
      for (let k = 0; k < len; k++) {
        const nx = x + Math.sin(a) * 8, ny = y + Math.cos(a) * 8;
        g.strokeStyle = `rgba(255,255,255,${0.25 + 0.75 * w / 6})`; g.lineWidth = w; g.beginPath(); g.moveTo(x, y); g.lineTo(nx, ny); g.stroke();
        x = nx; y = ny; a += (L.rnd() - 0.5) * 0.55; w = Math.max(0.8, w * 0.965);
        if (d < 3 && L.rnd() < 0.1) branch(x, y, a + (L.rnd() < 0.5 ? -0.8 : 0.8), w * 0.7, len - k, d + 1);
      }
    };
    for (let i = 0; i < 18; i++) branch((i + L.rnd() * 0.6) / 18 * n, n * (0.16 + L.rnd() * 0.06), (L.rnd() - 0.5) * 0.4, 5, 56, 0);
  });
  const sacM = new THREE.MeshPhysicalMaterial({ color: '#4a2a24', map: K.chitinMap, roughness: 0.5, metalness: 0.0, clearcoat: 0.45, clearcoatRoughness: 0.3, vertexColors: true,
    emissive: new THREE.Color(X.core).multiplyScalar(FK * (K.GLOW * K.GLOW * 0.32 + (K.NIGHTISH ? 0.1 : 0.32)) / 0.4), emissiveMap: veins, emissiveIntensity: 0.4 });
  // by day the veins show as a pale net with a little bloom (the Drainer's own mark at 30 px: the bag of stolen charge);
  // at night, or feeding, the whole sac lights up
  sacM.envMapIntensity = 0.25; sacM.userData.glow = K.dimGlow(X.glow, (K.GLOW > 1 || feed ? 0.8 : 3) * Math.min(2.2, FK));
  const sx = -0.98, sy = 0.62, srx = 1.28, sry = 0.66, srz = 1.08;
  K.seg(G, [sx, sy, 0], srx, sry, srz, sacM, { bands: 7, depth: 0.06, shade: 0.5, lump: 0.03, crease: 0.14, axisFlat: 0.35, seed: 11, ws: 96, hs: 48 });
  // the scutum: a hard plate over the front of the sac
  K.seg(G, [-0.45, sy + 0.18, 0], 0.7, 0.5, 0.82, bodyM, { bands: 2, depth: 0.08, crease: 0.2, lump: 0.02, seed: 13, axisFlat: 0.9, taper: 0.25 });
  // ---- front shield (prosoma): flat, banded
  K.seg(G, [0.66, 0.42, 0], 0.78, 0.3, 0.72, bodyM, { bands: 2, depth: 0.1, crease: 0.22, seed: 3, axisFlat: 0.6 });
  // shards round the shield's rear rim, two big shoulder shards, a spine of small ones down the sac and a cluster at its tail
  for (let i = 0; i < 7; i++) { const a = -1.2 + i * 0.4, z = Math.sin(a) * 0.62; K.shard(G, [0.33 - Math.abs(z) * 0.35, 0.62, z], [-0.55, 1, z * 1.1], 0.34 + (i % 2) * 0.12, 0.07, X, { collarMat: bodyM }); }
  for (const s of [-1, 1]) K.shard(G, [0.62, 0.62, s * 0.5], [-0.25, 0.9, s * 0.9], 0.64, 0.12, X, { collarMat: bodyM });
  for (let i = 0; i < 6; i++) { const a = -1.1 + i * 0.44, z = Math.sin(a) * 0.72, x = -1.08 + Math.abs(Math.sin(a)) * 0.25, y = sy + sry * Math.sqrt(Math.max(0, 1 - ((x - sx) / srx) ** 2 - (z / srz) ** 2)) - 0.04; K.shard(G, [x, y, z], [-0.7, 1, z * 0.9], 0.3 + 0.08 * (i % 2), 0.07, X, { collarMat: bodyM }); }
  K.cluster(G, [-2.05, 0.75, 0], [-1, 0.7, 0], 4, 0.5, 0.09, X, 0.6, { collarMat: bodyM });

  // ---- the mouth: a fleshy, wrinkled collar ending in a puckered, toothed disc that faces forward and up
  const tilt = feed ? 0.3 : 0.85;                                       // feeding: the disc turns to face the target
  const dc = new THREE.Vector3(feed ? 1.98 : 1.82, 0.5, 0), dn = new THREE.Vector3(Math.cos(tilt), Math.sin(tilt), 0);
  K.tube(G, [[1.2, 0.42, 0], [1.5, 0.46, 0], [dc.x - dn.x * 0.1, dc.y - dn.y * 0.1, 0]], t => (0.27 + 0.03 * t) * (1 + 0.07 * Math.sin(t * 40)), fleshM, { radial: 20, n: 40 });
  const D = L.group(dc.x, dc.y, dc.z, 0, G); D.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dn);
  {   // a lumpy lip: a torus pinched into eight lobes
    const lip = new THREE.TorusGeometry(0.3, 0.1, 14, 64), p = lip.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const a = Math.atan2(v.y, v.x), k = 1 + 0.12 * Math.sin(a * 8) + 0.05 * K.nz(v.x * 6, v.y * 6, v.z * 6); p.setXYZ(i, v.x * k, v.y * k, v.z * (1 + 0.3 * Math.sin(a * 8))); }
    lip.computeVertexNormals(); L.mesh(lip, fleshM, 0, 0, 0, { parent: D, dirt: 0 });
  }
  const disc = L.canvasTex(256, (g, n) => {
    const c = n / 2; g.fillStyle = '#000'; g.fillRect(0, 0, n, n);
    const gr = g.createRadialGradient(c, c, n * 0.05, c, c, n * 0.5); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.16, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(120,120,120,0.7)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(c, c, n * 0.5, 0, 7); g.fill();
  });
  const memM = new THREE.MeshStandardMaterial({ color: '#3a1f1d', roughness: 0.4, emissive: new THREE.Color(X.core).multiplyScalar(FK * (0.15 + K.GLOW * 1.1) / 0.4), emissiveMap: disc, emissiveIntensity: 0.4 });
  memM.userData.glow = K.dimGlow(X.glow, Math.min(2.2, FK));
  L.mesh(new THREE.CircleGeometry(0.31, 40), memM, 0, 0, -0.02, { parent: D, dirt: 0, cast: false });
  const toothM = K.plain('#d9cfbd', 0.4);
  for (let ring = 0; ring < 2; ring++) for (let k = 0; k < 14; k++) { const a = (k + ring * 0.5) / 14 * 6.283, rr = 0.26 - ring * 0.08; K.cone(D, [Math.cos(a) * rr, Math.sin(a) * rr, 0.0], [-Math.cos(a), -Math.sin(a), 0.5], 0.1 - ring * 0.025, 0.022, toothM); }

  // ---- soft feeding tendrils round the mouth, their tips lit
  const tipGlow = K.glowMat('#f3f0ff', 0.6 * FK, K.dimGlow(X.glow, Math.min(2.2, FK)));
  for (const [s, zz, yy] of [[-1, 0.2, 0.62], [1, 0.2, 0.62], [-1, 0.32, 0.4], [1, 0.32, 0.4]]) {
    const base = [1.55, yy, s * zz], reach = feed ? 1.25 : 0.75, wob = 0.1 * Math.sin(f * Math.PI / 2 + zz * 9);
    const pts = feed
      ? [base, [2.1, yy + 0.08, s * (zz + 0.25)], [2.65, yy - 0.05, s * (zz + 0.18)], [2.95, 0.45, s * 0.05]]
      : [base, [1.95, yy + 0.18, s * (zz + 0.28 + wob)], [2.15 + reach * 0.2, yy + 0.05, s * (zz + 0.42 + wob)], [2.2 + reach * 0.3, yy - 0.1, s * (zz + 0.3 + wob)]];
    K.tube(G, pts, t => 0.07 * (1 - t) + 0.018, fleshM, { n: 24, radial: 10 });
    const e = pts[pts.length - 1]; L.sphere(0.035, tipGlow, e[0], e[1], e[2], { parent: G, dirt: 0, cast: false });
  }
  // ---- two big jointed palps: thick at the base, three segments, spined on the inner face, a hooked tip.
  // Walking they are held open round the mouth; feeding they clamp shut on the target.
  const palpM = K.chitin('#33251f', { irid: 0.4, ns: 0.4 }), spineM = K.plain('#1e1612', 0.45);
  for (const s of [-1, 1]) {
    const sw = feed ? 0 : 0.06 * Math.sin(f * Math.PI / 2);
    const P0 = [1.15, 0.48, s * 0.52], P1 = feed ? [1.75, 0.9, s * 1.0] : [1.65, 0.95, s * 1.12], P2 = feed ? [2.6, 0.7, s * 0.95] : [2.55, 0.75, s * (1.18 + sw)], P3 = feed ? [3.15, 0.45, s * 0.45] : [3.1, 0.5, s * (0.78 + sw)], P4 = feed ? [3.1, 0.42, s * 0.1] : [3.2, 0.42, s * (0.42 + sw)];
    const segs = [[P0, P1, 0.13, 0.11], [P1, P2, 0.11, 0.085], [P2, P3, 0.085, 0.06], [P3, P4, 0.06, 0.025]];
    for (const [a, b, r0, r1] of segs) { K.limb(G, a, b, r0, r1, palpM, { bulge: 0.3, seg: 14 }); L.sphere(r1 * 1.05, jointM, b[0], b[1], b[2], { parent: G, dirt: 0 }); }
    // spines on the inner face of the two outer segments
    for (const [a, b] of [[P1, P2], [P2, P3]]) for (const t of [0.25, 0.5, 0.75]) {
      const p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
      K.cone(G, p, [0.3, -0.1, -s], 0.14, 0.022, spineM);
    }
    K.cone(G, P4, [0.2, -0.3, -s], 0.2, 0.03, tipM);
  }
  // feeding: a thread of stolen charge running from the target into the disc
  if (feed) {
    const arcM = K.glowMat('#fbfaff', 1.8, K.dimGlow(X.glow, 2.2));
    for (const s of [-1, 0, 1]) {
      const pts = [[3.05, 0.45, s * 0.12]];
      for (let k = 1; k <= 6; k++) { const t = k / 6; pts.push([3.05 + (dc.x + 0.12 - 3.05) * t + (L.rnd() - 0.5) * 0.1, 0.45 + (dc.y + 0.12 - 0.45) * t + L.rnd() * 0.08, s * (0.12 * (1 - t)) + (L.rnd() - 0.5) * 0.12]); }
      K.tube(G, pts, () => 0.02, arcM, { n: 30, radial: 6 });
    }
  }
  centre(L, G, GL);
}

// ---------------------------------------------------------------------------------------------------------------
// BRUTE: a walking geode. A great domed shell of rock-hard crust in five overlapping bands (like a pill bug), split
// down the spine where a seam of Ring Crystal has grown out: the crack is lined with agate banding and packed with
// crystal points, tall in the middle. More crystal breaks through the flanks. A low head shield crusted with shards
// for ramming walls, two short crushing mandibles, six thick legs.
function brute(L, K, G, f) {
  const { THREE } = K, X = { ...XTAL, k: 0.82 };
  G.scale.setScalar(1.6);
  const legM = K.chitin('#2c231e', { irid: 0.2, ns: 0.45, rough: 0.5, cc: 0.35 }), tipM = K.plain('#16100d', 0.5), jointM = K.plain('#211814', 0.6);
  const GL = L.group(0, 0, 0, 0, G);
  const crustM = K.crust('#ffffff');
  // ---- legs: six, thick, armoured, slow heavy steps; crust plates on the femurs
  const LG = [];
  for (const [hx, hz, fx, fz, kf] of [[1.15, 0.95, 2.15, 2.05, -0.1], [0.0, 1.1, 0.15, 2.45, 0.05], [-1.15, 1.0, -2.05, 2.15, 0.15]]) for (const s of [-1, 1]) LG.push([[hx, 0.3, s * hz], [fx, 0, s * fz], { kneeFwd: kf, kneeOut: 0.12 }]);
  K.legs(GL, LG, f, { mat: legM, tipMat: tipM, jointMat: jointM, r: 0.22, kneeUp: 0.32, kneeT: 0.5, ankT: 0.3, stride: 0.3, lift: 0.28, spines: 0.9, claw: true, ankUp: 0.3, bulge: 0.3, shin: K.chitin('#4b423b', { irid: 0, rough: 0.75, cc: 0.15, ns: 0.9 }) });
  // ---- underbody
  K.seg(G, [-0.1, 0.42, 0], 2.1, 0.35, 1.25, K.plain('#221a16', 0.7), { bands: 4, depth: 0.08 });
  // ---- the shell
  const SX = 2.35, SY = 1.12, SZ = 1.68, CX = -0.25, CY = 0.42, NB = 5;
  const crackW = (x) => Math.max(0, 0.3 * (1 - Math.pow(Math.abs(x + 0.08) / 0.8, 2.4)));   // half-width of the split, unit-sphere z
  const crackZ = (x) => 0.07 * Math.sin(x * 7.5 + 0.6) + 0.04 * Math.sin(x * 17);              // and it zig-zags
  {
    const g = new THREE.SphereGeometry(1, 180, 90), pos = g.attributes.position, col = new Float32Array(pos.count * 3), v = new THREE.Vector3();
    const stone = [0.075, 0.07, 0.068], stoneL = [0.17, 0.155, 0.14], rust = [0.2, 0.11, 0.07];
    const bands = [[0.42, 0.4, 0.4], [0.24, 0.22, 0.27], [0.15, 0.13, 0.19], [0.07, 0.06, 0.09], [0.035, 0.03, 0.045]];
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const t = (v.x + 1) / 2, u = (t * NB) % 1, wl = 0.12;
      const prof = u < wl ? u / wl : Math.pow(1 - (u - wl) / (1 - wl), 1.3);   // each band's rear lip stands proud
      let k = 1 + 0.07 * (prof - 0.5) * (v.x > -0.9 && v.x < 0.92 ? 1 : 0);
      k += 0.06 * K.nz(v.x * 2.6, v.y * 2.6, v.z * 2.6) + 0.04 * K.nz(v.x * 6 + 3, v.y * 6, v.z * 6) + 0.025 * K.nz(v.x * 14, v.y * 14 + 5, v.z * 14);
      // pleura: each band pokes out a little at the sides, scalloping the outline
      const side = Math.exp(-((v.y - 0.1) ** 2) / 0.05); k += 0.05 * side * (prof - 0.3);
      const lum = 0.5 + 0.5 * K.nz(v.x * 5 + 9, v.y * 5, v.z * 5);
      let c = stone.map((q, j) => q + (stoneL[j] - q) * lum);
      const rs = Math.max(0, K.nz(v.x * 3.5, v.y * 3.5 + 2, v.z * 3.5) - 0.25); c = c.map((q, j) => q + (rust[j] - q) * Math.min(1, rs * 2));
      if (u < wl) c = c.map(q => q * (0.55 + 0.45 * u / wl));                      // dark gap under each lip
      else if (u < wl + 0.1) c = c.map(q => q * (1.25 - 0.25 * (u - wl) / 0.1));   // the lip catches the light
      const w = crackW(v.x) * (1 + 0.35 * K.nz(v.x * 9, 2, 0.5)) + 0.03 * Math.abs(Math.sin(v.x * 23)), zc = crackZ(v.x);
      if (v.y > 0.15 && w > 0) {
        const d = Math.abs(v.z - zc) / w;                 // 0 in the middle of the crack, 1 at its edge
        if (d < 1) { k -= 0.34 * Math.pow(1 - d, 0.5) * Math.min(1, w / 0.1); const b = bands[Math.min(4, Math.floor(Math.pow(1 - d, 0.6) * 5))]; c = b.slice(); }
        else if (d < 1.35) { k += 0.05 * (1 - (d - 1) / 0.35); }
      }
      let x = v.x * k * SX, y = v.y * k * SY, z = v.z * k * SZ;
      if (y < 0) y *= 0.25;
      const rim = Math.exp(-((v.y - 0.05) ** 2) / 0.02); x *= 1 + 0.04 * rim; z *= 1 + 0.06 * rim;
      pos.setXYZ(i, x, y, z);
      const shade = 0.55 + 0.45 * Math.min(1, Math.max(0, (v.y + 0.1) / 0.6));
      col[i * 3] = c[0] * shade * 1.35; col[i * 3 + 1] = c[1] * shade * 1.35; col[i * 3 + 2] = c[2] * shade * 1.35;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
    L.mesh(g, crustM, CX, CY, 0, { parent: G });
  }
  const shellTop = (x, z) => CY + SY * Math.sqrt(Math.max(0, 1 - ((x - CX) / SX) ** 2 - (z / SZ) ** 2));
  // the seam of crystal: druzy points packed along the crack floor, and a jagged ridge of big ones, tallest mid-back
  // two rows of crystal growing from the crack walls toward the middle and up, plus druzy points along the floor
  // (fewer, bigger points than a druzy froth, leaning back and out of the crack, so the seam still reads as crystal at 30 px)
  for (let i = 0; i < 8; i++) {
    const t = (i + 0.2 + L.rnd() * 0.6) / 8, ux = -0.7 + 1.4 * t, x = CX + SX * ux, mid = Math.max(0, 1 - Math.abs(t - 0.42) * 1.8);
    const w = crackW(ux) * SZ, z = crackZ(ux) * SZ + (L.rnd() - 0.5) * w * 0.6;
    K.cluster(G, [x, shellTop(x, 0) - 0.42, z], [-0.55 - L.rnd() * 0.3, 1, (i % 2 ? 1 : -1) * (0.35 + L.rnd() * 0.35)], 2 + Math.round(L.rnd()), 0.42 + 0.9 * mid * (0.8 + L.rnd() * 0.3), 0.1 + 0.09 * mid, X, 0.45, { collar: false });
  }
  // clusters breaking through the flanks, each in a socket of cracked crust
  for (const [ux, uz, n, len] of [[-0.25, 0.64, 4, 0.7], [0.35, -0.62, 4, 0.66], [-0.75, -0.5, 3, 0.55], [0.62, 0.48, 3, 0.5], [-1.0, 0.36, 3, 0.45]]) {
    const x = CX + SX * ux, z = SZ * uz, y = shellTop(x, z) - 0.05, nrm = [(x - CX) / SX ** 2, (y - CY) / SY ** 2, z / SZ ** 2];
    K.cluster(G, [x, y - 0.04, z], [nrm[0] * 0.6, nrm[1], nrm[2] * 0.9], n, len, 0.11, X, 0.5, { collarMat: crustM });
  }
  // ---- head: a low shield of crust tucked under the shell's front lip; its brow crusted with stubby shards (the ram)
  K.seg(G, [1.98, 0.5, 0], 0.68, 0.44, 1.06, K.crust('#5b534c'), { bands: 2, depth: 0.12, crease: 0.25, seed: 21, lump: 0.06 });
  // the ram: a brow of crystal growing forward off the head shield
  K.cluster(G, [2.32, 0.74, -0.38], [1, 0.55, -0.35], 3, 0.55, 0.09, X, 0.35, { collar: false });
  K.cluster(G, [2.34, 0.76, 0.36], [1, 0.55, 0.35], 3, 0.52, 0.09, X, 0.35, { collar: false });
  K.cluster(G, [2.42, 0.72, 0], [1, 0.45, 0], 3, 0.6, 0.1, X, 0.3, { collar: false });
  for (const s of [-1, 1]) {
    for (const [x, z, r] of [[2.3, 0.62, 0.045], [2.36, 0.55, 0.035], [2.24, 0.7, 0.035]]) L.sphere(r, K.eye(), x, 0.66, s * z, { parent: G, dirt: 0 });
    const m = [[2.35, 0.36, s * 0.62], [2.72, 0.42, s * 0.8], [3.06, 0.5, s * 0.58], [3.2, 0.6, s * 0.26]];
    K.tube(G, m, t => 0.23 * (1 - t) + 0.035, legM, { n: 30, radial: 14 });
    const c = new THREE.CatmullRomCurve3(m.map(p => new THREE.Vector3(...p)));
    for (const t of [0.5, 0.72]) { const p = c.getPointAt(t); K.cone(G, [p.x, p.y, p.z], [0.15, 0, -s], 0.22, 0.055, K.plain('#cfc6b4', 0.5)); }
  }
  centre(L, G, GL);
}

// ---------------------------------------------------------------------------------------------------------------
// BURROW: the tunnel mouth. A crater of churned earth heaped round a dark throat whose ribbed walls are lined with
// glowing crystal. Six crystal pillars stand on the rim, evenly spaced, the one detail that looks planned.
function burrow(L, K) {
  const { THREE } = K, X = XTAL;
  L.getRoot().scale.setScalar(1.1);
  const CZ = -0.3;
  const prof = [[0, -3.8], [0.4, -3.3], [0.85, -2.0], [1.2, -0.8], [1.5, 0.35], [1.85, 1.1], [2.25, 1.28], [2.75, 0.95], [3.35, 0.48], [3.9, 0.14], [4.3, 0.0], [4.5, -0.12]];
  const hProf = (r) => { for (let i = 1; i < prof.length; i++) if (r <= prof[i][0]) { const [r0, h0] = prof[i - 1], [r1, h1] = prof[i], t = (r - r0) / (r1 - r0), s = t * t * (3 - 2 * t); return h0 + (h1 - h0) * s; } return prof[prof.length - 1][1]; };
  const RH = 1.5, RMAX = 4.5;
  // ---- the crater mound: polar heightfield, vertex coloured
  {
    const NR = 90, NA = 180, pos = [], col = [], idx = [];
    for (let j = 0; j <= NR; j++) for (let i = 0; i <= NA; i++) {
      const a = i / NA * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      const rmax = 4.1 + 0.5 * K.nz(ca * 1.7, 0.9, sa * 1.7) + 0.14 * Math.sin(a * 7 + 1) + 0.07 * Math.sin(a * 17);   // a ragged spoil edge
      const r = 0.05 + (j / NR) * (rmax - 0.05), rn = r < 2.3 ? r : 2.3 + (r - 2.3) * (RMAX - 2.3) / (rmax - 2.3);
      let h = hProf(rn);
      const ang = 0.18 * K.nz(ca * 1.5, 0.3, sa * 1.5) + 0.12 * K.nz(ca * 3.2, 1.7, sa * 3.2);
      if (r > 1.5) h += ang * 1.6 * Math.exp(-((r - 2.3) ** 2) / 0.9) + 0.06 * K.nz(ca * r * 2, 3, sa * r * 2);
      const fur = Math.pow(Math.abs(Math.sin(a * 13 + 1.5 * K.nz(ca, 0.5, sa))), 14);    // radial claw furrows down the outer slope
      if (r > 2.4) h -= 0.09 * fur * Math.min(1, (r - 2.4) / 0.4) * Math.max(0, 1 - (r - 2.4) / 1.8);
      const rib = Math.sin(a * 7 + r * 5.5);                                             // spiral ribs down the throat
      if (r < RH + 0.1) h += 0.09 * rib * Math.min(1, (RH + 0.1 - r) / 0.3);
      pos.push(ca * r, h, CZ + sa * r);
      // colours: disturbed soil outside, churned dark earth on the rim, wet resin-dark throat, black depths
      let c;
      const soil = [0.5, 0.42, 0.34], dark = [0.24, 0.19, 0.16], throat = [0.09, 0.07, 0.075], resin = [0.2, 0.13, 0.13], deep = [0.015, 0.012, 0.016];
      const mix = (p, q, t) => p.map((v, k) => v + (q[k] - v) * Math.max(0, Math.min(1, t)));
      if (r > 2.3) c = mix(dark, soil, (rn - 2.3) / 1.6);
      else if (r > RH) c = mix(throat, dark, (r - RH) / 0.8);
      else { c = mix(deep, throat, (r - 0.2) / (RH - 0.2)); if (rib > 0.5) c = mix(c, resin, (rib - 0.5) * 1.4 * Math.min(1, r / 0.6)); }
      const n = 0.85 + 0.3 * K.nz(ca * r * 3, 5, sa * r * 3); c = c.map(v => v * n * (1 - 0.35 * fur * (r > 2.4 ? 1 : 0)));
      col.push(...c.map(v => v * 1.3));
    }
    for (let j = 0; j < NR; j++) for (let i = 0; i < NA; i++) { const a = j * (NA + 1) + i, b = a + 1, c = a + NA + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const uv = []; for (let k = 0; k < pos.length; k += 3) uv.push(pos[k] / 3, pos[k + 2] / 3); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    const m = K.crust('#ffffff'); const mm = m.clone(); mm.roughness = 0.9; mm.normalScale = new THREE.Vector2(0.6, 0.6);
    L.mesh(g, mm, 0, 0, 0, {});
  }
  // the ground stain round the crater: dark disturbed earth with a ragged edge, fading into whatever ground it sits on
  {
    const n = 1024, tex = L.canvasTex(n, (g) => {
      const c = n / 2, img = g.createImageData(n, n), D = img.data;
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const dx = (x - c) / c, dy = (y - c) / c, rr = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
        const edge = 0.93 + 0.05 * K.nz(Math.cos(a) * 1.8, 0.2, Math.sin(a) * 1.8) + 0.03 * Math.sin(a * 9 + 2 * K.nz(dx * 3, 1, dy * 3));
        let al = Math.min(1, Math.max(0, (edge - rr) / 0.12)) * 0.85 * Math.min(1, Math.max(0, (rr - 0.4) / 0.05));
        const speck = K.nz(dx * 40, 7, dy * 40) > 0.55 ? 1 : 0;
        const fade = Math.max(0, Math.min(1, (rr - 0.8) / 0.15)), rr2 = 1 - fade * 0.25;
        const i4 = (y * n + x) * 4; D[i4] = (78 + 40 * speck) * rr2; D[i4 + 1] = (62 + 50 * speck) * rr2; D[i4 + 2] = (50 + 60 * speck) * rr2; D[i4 + 3] = Math.round(al * 255);
      }
      g.putImageData(img, 0, 0);
    });
    const m = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.95, depthWrite: false });
    const pg = new THREE.PlaneGeometry(10.4, 10.4); pg.rotateX(-Math.PI / 2);
    const pm = new THREE.Mesh(pg, m); pm.position.set(0, 0.01, CZ); pm.receiveShadow = true; pm.userData.decal = true; L.getRoot().add(pm);
  }
  // ---- crystal lining the throat: shards growing inward and up from the ribbed walls, brighter the deeper they sit
  for (let i = 0; i < 30; i++) {
    const a = i / 30 * Math.PI * 2 + L.rnd() * 0.2, r = 0.5 + L.rnd() * 0.95, h = hProf(r) + 0.02, deep = Math.max(0, Math.min(1, -h / 2.5));
    K.shard(null, [Math.cos(a) * r, h, CZ + Math.sin(a) * r], [-Math.cos(a) * 0.8, 1.0, -Math.sin(a) * 0.8], 0.35 + L.rnd() * 0.4, 0.07 + L.rnd() * 0.04, { ...X, k: 0.8 + deep * 0.9 }, { collar: false });
  }
  // the glow down in the dark
  const coreM = K.glowMat('#f1eeff', 1.2, K.dimGlow(X.glow, 1.5));
  L.mesh(new THREE.CircleGeometry(0.5, 24).rotateX(-Math.PI / 2), coreM, 0, -3.6, CZ, { cast: false, dirt: 0 });
  L.pointLight('#e6e0ff', 1.5 + K.GLOW * 7, 0, -2.4, CZ, 3.5);
  // ---- six pillars of crystal on the rim, evenly spaced and tilted outward, each with smaller companions
  for (let k = 0; k < 6; k++) {
    const a = k / 6 * Math.PI * 2 + 0.26, r = 2.05, ca = Math.cos(a), sa = Math.sin(a), h = hProf(r) - 0.15;
    K.shard(null, [ca * r, h, CZ + sa * r], [ca * 0.42, 1, sa * 0.42], 2.0 + (k % 2) * 0.45, 0.3, X, { collarMat: K.crust('#4a423c') });
    for (const d of [-0.28, 0.3]) { const b = a + d; K.shard(null, [Math.cos(b) * (r + 0.12), hProf(r + 0.12) - 0.08, CZ + Math.sin(b) * (r + 0.12)], [Math.cos(b) * 0.9 + Math.cos(a) * 0.2, 1, Math.sin(b) * 0.9], 0.55 + L.rnd() * 0.3, 0.1, X, { collar: false }); }
  }
  // ---- broken slabs of crust heaved up and tipped outward between the pillars
  const slabM = K.crust('#8a7f74');
  for (let k = 0; k < 9; k++) {
    const a = (k + 0.5) / 9 * Math.PI * 2 + 0.26 + (L.rnd() - 0.5) * 0.3, r = 2.6 + L.rnd() * 0.5, ca = Math.cos(a), sa = Math.sin(a);
    const g = new THREE.DodecahedronGeometry(1, 1), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const q = 1 + 0.25 * K.nz(p.getX(i) * 2 + k, p.getY(i) * 2, p.getZ(i) * 2); p.setXYZ(i, p.getX(i) * q, p.getY(i) * q, p.getZ(i) * q); }
    g.scale(0.5 + L.rnd() * 0.3, 0.16 + L.rnd() * 0.06, 0.38 + L.rnd() * 0.2); g.computeVertexNormals();
    const m = L.mesh(g, slabM, ca * r, hProf(r) + 0.1, CZ + sa * r, { dirt: 0.4, dirtH: 0.4 });
    m.rotation.set(0, -a + Math.PI / 2, 0); m.rotateX(-(0.4 + L.rnd() * 0.4));
  }
  // ---- spoil: clods and stones thrown out, chips of crystal, and husks of shed shells
  const rockM = K.crust('#6b5f55');
  for (let i = 0; i < 34; i++) {
    const a = L.rnd() * Math.PI * 2, r = 2.4 + L.rnd() * 2.0, s = 0.07 + L.rnd() * 0.16;
    const g = new THREE.DodecahedronGeometry(s, 0); g.scale(1, 0.6, 1);
    L.mesh(g, rockM, Math.cos(a) * r, hProf(r) + s * 0.25, CZ + Math.sin(a) * r, { dirt: 0.3, ry: L.rnd() * 3 });
  }
  for (let i = 0; i < 10; i++) {
    const a = L.rnd() * Math.PI * 2, r = 2.7 + L.rnd() * 1.4;
    K.shard(null, [Math.cos(a) * r, hProf(r) - 0.03, CZ + Math.sin(a) * r], [L.rnd() - 0.5, 0.5, L.rnd() - 0.5], 0.18 + L.rnd() * 0.14, 0.05, X, { collar: false });
  }
  const huskM = K.chitin('#3b2c24', { irid: 0.5 });
  for (const [a, r, s] of [[2.3, 3.3, 0.5], [3.9, 3.1, 0.42], [5.4, 3.6, 0.36], [0.9, 3.7, 0.3]]) {
    const g = new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.42); g.scale(s, s * 0.45, s * 0.7);
    const m = L.mesh(g, huskM, Math.cos(a) * r, hProf(r) + 0.02, CZ + Math.sin(a) * r, { dirt: 0.2 }); m.rotation.set(Math.PI * (0.85 + L.rnd() * 0.2), a, 0.3);
  }
}

// a patch of ground for the hero shot (catches the shadow; fades out at the edge)
function heroGround(L, K, W) {
  const { THREE } = K;
  const n = 512, tex = L.canvasTex(n, (g) => {
    const c = n / 2; g.fillStyle = '#000'; g.fillRect(0, 0, n, n);
    const gr = g.createRadialGradient(c, c, 0, c, c, c); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.22, '#e0e0e0'); gr.addColorStop(0.42, '#303030'); gr.addColorStop(0.5, '#000000'); gr.addColorStop(1, '#000000');
    g.fillStyle = gr; g.fillRect(0, 0, n, n);
  }, false);
  const m = new THREE.MeshStandardMaterial({ map: L.M.rough('#b39470').map, color: '#ffffff', alphaMap: tex, transparent: true, roughness: 0.95, depthWrite: false });
  const pg = new THREE.PlaneGeometry(W * 2.2, W * 2.2); pg.rotateX(-Math.PI / 2);
  const pm = new THREE.Mesh(pg, m); pm.receiveShadow = true; pm.position.y = 0.0; pm.userData.decal = true; L.getRoot().add(pm);
}

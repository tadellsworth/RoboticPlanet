// The Murmur, design direction B: "Crystal-backed swarm". Arthropods with dark chitin, studded with shards of the Ring
// Crystal they have eaten; the shards glow from inside (pale by day, bright at night).
//   ?c=swarmer | drainer | brute | burrow
//   ?v=base | rust | white | bloom      (regional variants, Swarmer)
//   ?f=0..3                             walking frame (alternating gait; legs, antennae and palps move)
//   ?feed=1                             Drainer latched on and feeding: palps clamped, mouth disc and sac blazing
//   ?hero=1                             a 3/4 perspective hero shot on a patch of ground instead of the top-down sprite
//   ?hi=1|2                             render 2x / 4x bigger (presentation)
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
    brute: { pos: [9.6, 5.4, 9.4], at: [0.2, 1.1, 0.3], fov: 32 },
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
const XTAL = { shell: '#4f9fb3', core: '#9ff0ff', glow: '#a6ecff', opacity: 0.7 };
const PAL = {
  base:  { body: '#3b2c24', plate: '#3b2c24', leg: '#2e231e', tip: '#140f0c', joint: '#3e2a20', mand: '#3b2618', xtal: XTAL, irid: 0.5 },
  rust:  { body: '#3a2419', plate: '#a5512a', leg: '#4a2a1b', tip: '#1c120c', joint: '#6a3a22', mand: '#4a2a18', xtal: XTAL, irid: 0.15 },
  white: { body: '#c8cdd0', plate: '#d7dbdd', leg: '#9da4a8', tip: '#5e666b', joint: '#b9a9a0', mand: '#7f878c', xtal: { shell: '#f2fbff', core: '#d6f2ff', glow: '#cfeeff', opacity: 0.75, k: 0.55 }, irid: 0.1 },
  bloom: { body: '#251a2b', plate: '#2a1c31', leg: '#20162a', tip: '#0f0a14', joint: '#5a2a66', mand: '#2f1c38', xtal: { shell: '#efe0ff', core: '#c48dff', glow: '#b67cff', opacity: 0.55, k: 1.15 }, irid: 0.7 },
};

// ---------------------------------------------------------------------------------------------------------------
// SWARMER: small, fast, ant-like runner. Big flat head with sickle mandibles and elbowed antennae, a narrow thorax with
// a crest of shards, a pinched waist, and a gaster that bursts with a crown of Ring Crystal swept back like flame.
function swarmer(L, K, G, f, v) {
  const { THREE } = K, pal = PAL[v];
  const SC = v === 'white' ? 1.3 : v === 'rust' ? 1.3 : 1.25;
  G.scale.setScalar(SC);
  const fat = v === 'white' ? 1.18 : v === 'rust' ? 1.08 : 1;        // the White ones are stout, the Rust ones bulked by plates
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

// placeholders filled in below
function drainer(L, K, G, f, feed) {}
function brute(L, K, G, f) {}
function burrow(L, K) {}
function heroGround(L, K, W) {}

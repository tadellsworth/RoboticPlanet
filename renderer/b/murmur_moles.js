// The Murmur, direction B ("Crystal-backed swarm") reworked as moles at the owner's request ("a little less like bugs
// and more like moles"). Burrowing animals: compact low bodies of matte fur or leathery hide, four limbs (huge
// outward-turned spade forepaws with long pale claws, small hind feet), a pointed fleshy snout, tiny eyes, a stub of a
// tail, and shards of eaten Ring Crystal erupting through the hide along the spine and shoulders: smoky glass with a
// breath of violet by day, burning white at night (no team owns white). The Bloom ones glow violet.
//   ?c=swarmer | drainer | brute | burrow
//   ?v=base | rust | white | bloom      regional variants (Swarmer): Rust armoured, White pale and slow, Bloom violet
//   ?f=0..3                             walking frame: diagonal pairs (left fore with right hind); only the limbs move
//   ?pose=feed  (or ?feed=1)            Drainer latched on: the star of feelers open and lit, the sac blazing
//   ?hero=1                             a 3/4 perspective presentation shot on a patch of ground
//   ?hi=1|2                             render 2x / 4x bigger (presentation)
//   ?tod=night|evening|morning          time of day (lib.js); at night only the creatures' own light shows
// Sprites follow the robots: orthographic straight down, facing +x, centred, no ground and no shadow (the game draws
// those), sun from the top-left, toned like robkit.js. The models share one world scale (a Brute is twice a Swarmer);
// SPRITE_W is the frame width in world units, so in the game draw a sprite at tile * 0.078 * W (the robots' 0.06 per
// unit, times 1.3 so the smallest still reads). The Burrow uses the building camera (like nest.js) on the 512 canvas.
import { molekit } from './murmur_moleskit.js';

const P = new URLSearchParams(location.search);
const C = P.get('c') || 'swarmer', HI = +(P.get('hi') || 0), HERO = !!+(P.get('hero') || 0);
export const config = C === 'burrow' ? { pad: false } : { pad: false, size: [512, 1024, 2048][HI] };
export const SPRITE_W = { swarmer: 5.6, drainer: 7.2, brute: 10.4 };

export default function (L) {
  const K = molekit(L);
  const f = +(P.get('f') || 0), V = P.get('v') || 'base', FEED = P.get('pose') === 'feed' || !!+(P.get('feed') || 0);
  L.seed({ swarmer: 8100, drainer: 8200, brute: 8300, burrow: 8400 }[C] + (V === 'base' ? 0 : V.length));
  if (C === 'burrow') return burrow(L, K);
  const W = SPRITE_W[C];
  const heroCams = {
    swarmer: { pos: [5.6, 3.4, 6.4], at: [0.1, 0.45, 0.1], fov: 30 },
    drainer: { pos: [7.4, 4.4, 8.2], at: [0.2, 0.6, 0.1], fov: 30 },
    brute: { pos: [11.5, 5.6, 9.6], at: [0.0, 1.05, 0.2], fov: 36 },
  };
  K.camera(W, HERO && heroCams[C]);
  if (HERO) K.heroGround(W);
  const G = L.group(0, 0, 0), GL = L.group(0, 0, 0, 0, G);       // GL holds the moving limbs
  if (C === 'swarmer') swarmer(L, K, G, GL, f, V);
  else if (C === 'drainer') drainer(L, K, G, GL, f, FEED);
  else brute(L, K, G, GL, f);
  K.centre(G, GL);
}

// ---------------------------------------------------------------------------------------------------------------
// palettes. Dark, matte animals; claws pale (the mark that reads from above); snouts a dull grey-pink (never a team red).
const PAL = {
  base:  { hide: '#463b3c', belly: '#2a2224', skin: '#8c726c', snout: '#93766f', claw: '#ddd0b4', tooth: '#e6d39c', sheen: '#9a8c86' },
  rust:  { hide: '#40281e', belly: '#24150f', skin: '#8a6656', snout: '#91695a', claw: '#e0c8a2', tooth: '#e6cf98', plate: '#a8582e', sheen: '#a48270' },
  white: { hide: '#c3c8cc', belly: '#9aa0a5', skin: '#b3a29c', snout: '#bba49e', claw: '#efe8da', tooth: '#efe2b8', sheen: '#ffffff' },
  bloom: { hide: '#30243a', belly: '#1c1520', skin: '#77627a', snout: '#7e6680', claw: '#d8cdbf', tooth: '#e2d4a8', sheen: '#9a86a6' },
};

// ---------------------------------------------------------------------------------------------------------------
// SWARMER: a lean mole-rat runner, small and quick, in packs. Wrinkled leathery hide with a few bristles, a long
// pointed snout with buck incisors that never close, small spade hands, longer legs than a mole (it runs on the
// surface), a thin tail. A ridge of crystal runs down its spine from the shoulders, swept back like hackles.
function swarmer(L, K, G, GL, f, v) {
  const pal = PAL[v];
  const fat = v === 'white' ? 1.16 : v === 'rust' ? 1.06 : 1;         // the White ones stout, the Rust ones bulked by plates
  const legK = v === 'white' ? 0.78 : 1;                               // short legs: slow
  let bodyM;
  if (v === 'bloom') {
    const spots = L.canvasTex(512, (g, n) => {
      g.fillStyle = '#000'; g.fillRect(0, 0, n, n);
      for (let i = 0; i < 60; i++) { const x = L.rnd() * n, y = L.rnd() * n, r = 3 + L.rnd() * 9; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.5, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
      g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 2;
      for (let i = 0; i < 22; i++) { let x = L.rnd() * n, y = L.rnd() * n; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 8; k++) { x += (L.rnd() - 0.5) * 50; y += (L.rnd() - 0.2) * 30; g.lineTo(x, y); } g.stroke(); }
    });
    bodyM = K.hide(pal.hide, { sheenColor: pal.sheen, emissiveMap: spots, emissive: '#b26bff', glow: K.dimGlow('#b070ff'), ek: 0.9 });
  } else if (v === 'white') bodyM = K.fur(pal.hide, { coarse: true, sheen: 1, sheenColor: pal.sheen, rough: 0.92 });
  else bodyM = K.hide(pal.hide, { sheenColor: pal.sheen });
  const skinM = K.flesh(pal.skin), snoutM = K.flesh(pal.snout), clawM = K.keratin(pal.claw), toothM = K.keratin(pal.tooth, 0.35);
  const X = v === 'white' ? K.XTAL_WHITE : v === 'bloom' ? K.XTAL_BLOOM : K.XTAL;

  // ---- the body: a lean cylinder, deepest at the shoulders, tapering into the head
  const S = (x, w, h, b, cy) => [x, w * fat, h * fat, b * fat, cy];
  const body = K.loft(G, [
    S(-1.6, 0.0, 0.0, 0.0, 0.53), S(-1.5, 0.29, 0.26, 0.2, 0.54), S(-1.25, 0.46, 0.38, 0.29, 0.56), S(-0.8, 0.52, 0.43, 0.32, 0.57),
    S(-0.25, 0.5, 0.45, 0.32, 0.58), S(0.3, 0.47, 0.45, 0.31, 0.58), S(0.75, 0.38, 0.37, 0.27, 0.56), S(1.08, 0.27, 0.27, 0.2, 0.53),
    S(1.34, 0.15, 0.15, 0.12, 0.5), S(1.46, 0.0, 0.0, 0.0, 0.49),
  ], bodyM, { lump: 0.035, seed: 3, uv: 1.4 });

  // ---- snout, buck teeth, eyes, tail
  const tip = K.snout(G, { base: [1.25, 0.52, 0], tip: [1.86, 0.45, 0], r: 0.14, skin: snoutM, whisker: K.plain(v === 'white' ? '#f6f6f2' : '#cfc6bc', 0.6) });
  for (const s of [-1, 1]) {                                                  // upper and lower incisors, jutting out
    K.claw(G, [1.74, 0.4, s * 0.032], [1, -0.35, s * 0.05], [0, 1, 0], 0.2, 0.026, 0.016, toothM, 0.35);
    K.claw(G, [1.7, 0.33, s * 0.03], [1, 0.25, s * 0.04], [0, 1, 0], 0.24, 0.024, 0.015, toothM, -0.25);
  }
  K.eyes(G, [1.08, 0.66, 0], 0.2 * fat, 0.028);
  K.tail(G, { base: [-1.48, 0.55, 0], tip: [-2.05, 0.42, 0.04], r: 0.055, mat: v === 'white' ? bodyM : skinM, bristle: K.plain('#8a7f78', 0.7) });

  // ---- four limbs (in GL: the only parts that move)
  for (const s of [-1, 1]) {
    K.forelimb(GL, { side: s, f, shoulder: [0.6, 0.45, s * 0.16 * fat], wrist: [0.98, 0.3, s * 0.38 * fat], palm: 0.5, claw: 0.3, armR: 0.16 * fat,
      stride: 0.15 * legK, lift: 0.12, skin: skinM, arm: bodyM, clawMat: clawM, splay: 0.55, tilt: 0.4, fan: 0.6 });
    K.hindlimb(GL, { side: s, f, hip: [-1.0, 0.42, s * 0.2 * fat], foot: [-1.24, 0.07, s * (0.4 + 0.08 * legK) * fat], len: 0.3, r: 0.1 * fat,
      stride: 0.15 * legK, lift: 0.1, skin: skinM, leg: bodyM, clawMat: clawM, out: 0.7 });
  }

  // ---- Rust: armour. Bands of rust-red crust plates over the back, like an armadillo's, with blunt studs on the rims
  if (v === 'rust') {
    const plateM = K.crust(pal.plate);
    K.crustSaddle(G, body, { x0: -1.42, x1: 0.95, amax: 1.25, thick: 0.13, bands: 6, crack: 0, mat: plateM,
      colour: (x, a) => { const n = 0.5 + 0.5 * K.nz(x * 4, a * 3, 1); return [0.75 + 0.35 * n, 0.72 + 0.3 * n, 0.7 + 0.28 * n]; } });
    for (let i = 0; i < 5; i++) for (const s of [-1, 1]) { const { p, n } = K.onBody(body, -1.2 + i * 0.44, s * 1.05, -0.08); K.cone(G, p, [n[0] - 0.3, n[1] * 0.6, n[2]], 0.16, 0.055, K.plain('#5a2d18', 0.7)); }
  }
  // Bloom: soft glowing fronds growing between the shards (the Bloom's own life, riding on its back)
  if (v === 'bloom') {
    const fr = K.glowMat('#c48dff', 0.6, K.dimGlow('#a46cff'));
    for (let i = 0; i < 8; i++) {
      const s = i % 2 ? 1 : -1, x = 0.3 - i * 0.2, { p } = K.onBody(body, x, s * 0.45, 0.02);
      K.tube(G, K.curve([p, [p[0] - 0.18, p[1] + 0.16, p[2] + s * 0.1], [p[0] - 0.4, p[1] + 0.1, p[2] + s * 0.24]], 4), t => 0.024 * (1 - t) + 0.008, fr, { n: 10, radial: 6 });
    }
  }

  // ---- the shards: hackles of crystal down the spine (tallest over the shoulders), and a spray out of each shoulder
  const n = v === 'rust' ? 0.72 : v === 'white' ? 0.85 : 1, rk = v === 'rust' ? 1.25 : 1;
  const collar = v === 'white' ? bodyM : skinM;
  const spine = v === 'rust'
    ? [[0.5, 0, 0.42, 0.1, 0.45], [0.05, 0, 0.5, 0.11, 0.6], [-0.45, 0, 0.46, 0.1, 0.65], [-0.95, 0, 0.36, 0.09, 0.7]]
    : [[0.62, 0, 0.42, 0.07, 0.8], [0.4, -0.16, 0.62, 0.085, 1.0], [0.34, 0.18, 0.58, 0.08, 1.0], [0.1, -0.06, 0.8, 0.1, 1.1],
       [-0.14, 0.16, 0.7, 0.09, 1.15], [-0.36, -0.17, 0.72, 0.09, 1.2], [-0.58, 0.1, 0.64, 0.085, 1.25], [-0.82, -0.12, 0.56, 0.075, 1.3],
       [-1.02, 0.13, 0.46, 0.065, 1.35], [-1.22, -0.03, 0.36, 0.055, 1.4]];
  K.spineShards(G, body, spine.map(([x, a, l, r, lean]) => [x, a, l * n, r * rk, lean, 1.2]), X, { collarMat: collar });
  if (v !== 'rust') for (const s of [-1, 1]) {
    const { p, n: nn } = K.onBody(body, 0.42, s * 0.8, 0.05);
    K.cluster(G, p, [nn[0] - 0.9, nn[1] + 0.2, nn[2] * 1.3], 3, 0.5 * n, 0.075, X, 0.45, { collarMat: collar });
  }
}

// ---------------------------------------------------------------------------------------------------------------
// DRAINER: the feeder, a star-nosed mole. Velvet-furred, fat behind, its back swollen into a bare, thin-skinned sac of
// stolen charge whose veins glow through. On its snout a ring of 22 fleshy feeler-rays round the nostrils: walking they
// stand open and twitch, pale; feeding (?pose=feed) they splay wide and close on the target like fingers, burning white,
// and threads of charge run from the target into the star. Big spade hands, planted wide while it feeds.
function drainer(L, K, G, GL, f, feed) {
  const { THREE } = K, X = K.XTAL;
  const furM = K.fur('#3d3534', { sheenColor: '#9a8c84' }), skinM = K.flesh('#8c726c'), snoutM = K.flesh('#93766f'), clawM = K.keratin('#ddd0b4');
  const FK = feed ? 2.4 : 1;                                             // feeding: everything that carries charge burns
  const body = K.loft(G, [
    [-2.2, 0, 0, 0, 0.74], [-2.08, 0.46, 0.44, 0.34, 0.75], [-1.72, 0.84, 0.78, 0.47, 0.79], [-1.05, 0.98, 0.9, 0.5, 0.81],
    [-0.35, 0.9, 0.82, 0.49, 0.8], [0.3, 0.74, 0.68, 0.45, 0.75], [0.82, 0.57, 0.52, 0.38, 0.7], [1.25, 0.37, 0.35, 0.27, 0.64],
    [1.52, 0.19, 0.19, 0.15, 0.59], [1.64, 0, 0, 0, 0.58],
  ], furM, { lump: 0.03, seed: 7, uv: 1.3 });

  // ---- the charge sac: a bare, swollen bulge of thin dark skin over the rear of the back, glowing veins under it
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
    for (let i = 0; i < 16; i++) branch((i + L.rnd() * 0.6) / 16 * n, n * (0.16 + L.rnd() * 0.06), (L.rnd() - 0.5) * 0.4, 5.5, 56, 0);
  });
  const sacM = new THREE.MeshPhysicalMaterial({ color: '#6a5258', map: K.hideMap, roughness: 0.55, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.4, vertexColors: true,
    sheen: 0.3, sheenColor: new THREE.Color('#c8a8b0'), emissive: new THREE.Color(X.core).multiplyScalar(FK * (K.GLOW * K.GLOW * 0.32 + (K.NIGHTISH ? 0.1 : 0.32)) / 0.4), emissiveMap: veins, emissiveIntensity: 0.4 });
  sacM.envMapIntensity = 0.25; sacM.userData.glow = K.dimGlow(X.glow, (K.GLOW > 1 || feed ? 0.8 : 3) * Math.min(2.2, FK));
  {
    const sx = -1.02, sy = 1.08, rx = 1.12, ry = 0.78, rz = 0.84;
    const g = new THREE.SphereGeometry(1, 96, 48), p = g.attributes.position, col = new Float32Array(p.count * 3), v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      // taut skin, creased in folds across the bulge; a little lop-sided
      const t = (v.x + 1) / 2, fold = Math.pow(Math.abs(Math.sin(t * Math.PI * 5.5)), 6);
      const k = 1 + 0.035 * K.nz(v.x * 3, v.y * 3, v.z * 3) - 0.025 * fold * Math.max(0, v.y);
      p.setXYZ(i, v.x * rx * k, v.y * ry * k * (v.y < 0 ? 0.6 : 1), v.z * rz * k);
      const b = (0.55 + 0.45 * Math.max(0, v.y)) * (1 - 0.35 * fold); col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
    L.mesh(g, sacM, sx, sy, 0, { parent: G });
  }

  // ---- snout and the star
  const tilt = feed ? 0.3 : 0.8;                                          // walking: nose raised, star facing up and forward
  const tip = [1.92, feed ? 0.62 : 0.7, 0];
  K.snout(G, { base: [1.28, 0.7, 0], tip, r: 0.17, skin: snoutM, nostril: false });
  const dn = new THREE.Vector3(Math.cos(tilt), Math.sin(tilt), 0);
  const D = L.group(tip[0] + dn.x * 0.04, tip[1] + dn.y * 0.04, 0, 0, G); D.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dn);
  // in D: +x is the way the star faces, the rays radiate in the y-z plane
  const rayM = feed ? K.glowMat('#f3f0ff', 0.7 * FK, K.dimGlow(X.glow, 2.2)) : K.flesh('#a8867f', { rough: 0.5 });
  const tipM = K.glowMat('#f3f0ff', feed ? 1.2 * FK : 0.5, K.dimGlow(X.glow, feed ? 2.2 : 0.8));
  K.seg(D, [0.03, 0, 0], 0.07, 0.12, 0.12, feed ? K.glowMat('#f8f6ff', 1.4 * FK, K.dimGlow(X.glow, 2.2)) : K.flesh('#6e5250'), { lump: 0.04 });
  for (let k = 0; k < 22; k++) {
    const a = (k + 0.5) / 22 * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
    const lowMid = Math.abs(Math.sin(a)) < 0.2 && Math.cos(a) < 0 ? 0.55 : 1;   // the two bottom rays are small, as on the real animal
    const len = (feed ? 0.42 : 0.3) * lowMid * (0.92 + 0.16 * L.rnd()), wob = feed ? 0 : 0.06 * Math.sin(f * Math.PI / 2 + k * 1.7);
    const r0 = 0.1, P0 = [0.0, ca * r0, sa * r0];
    const pts = feed   // splayed wide, then curling forward: closing round the target
      ? [P0, [0.06, ca * (r0 + len * 0.45), sa * (r0 + len * 0.45)], [0.2, ca * (r0 + len * 0.7), sa * (r0 + len * 0.7)], [0.38, ca * (r0 + len * 0.62), sa * (r0 + len * 0.62)]]
      : [P0, [0.04 + wob, ca * (r0 + len * 0.4), sa * (r0 + len * 0.4)], [0.1 + wob, ca * (r0 + len * 0.75), sa * (r0 + len * 0.75)], [0.18 + wob, ca * (r0 + len * 0.95), sa * (r0 + len * 0.95)]];
    K.tube(D, pts, t => 0.034 * (1 - 0.6 * t) + 0.008, rayM, { n: 12, radial: 7 });
    const e = pts[pts.length - 1]; L.sphere(feed ? 0.028 : 0.02, tipM, e[0], e[1], e[2], { parent: D, dirt: 0, cast: false });
  }
  K.eyes(G, [1.12, 0.84, 0], 0.27, 0.03);
  K.tail(G, { base: [-2.1, 0.76, 0], tip: [-2.62, 0.62, -0.05], r: 0.075, mat: skinM, bristle: K.plain('#8a7f78', 0.7) });

  // ---- limbs: big spade hands (planted wide and dug in while feeding), small hind feet
  for (const s of [-1, 1]) {
    K.forelimb(GL, { side: s, f, plant: feed, shoulder: [0.62, 0.62, s * 0.3], wrist: feed ? [1.2, 0.24, s * 0.74] : [1.02, 0.34, s * 0.55], palm: 0.62, claw: 0.36, armR: 0.21,
      stride: 0.16, lift: 0.13, skin: skinM, arm: furM, clawMat: clawM, splay: feed ? 0.85 : 0.55, tilt: feed ? 0.3 : 0.4, fan: 0.6, droop: feed ? 0.22 : 0.06, fringe: K.plain('#6a605a', 0.8) });
    K.hindlimb(GL, { side: s, f, plant: feed, hip: [-1.62, 0.56, s * 0.42], foot: [-1.94, 0.07, s * 0.76], len: 0.38, r: 0.14,
      stride: 0.15, lift: 0.11, skin: skinM, leg: furM, clawMat: clawM, out: 0.7 });
  }

  // ---- the shards: a spray from each shoulder and a short ridge between them, in front of the sac
  K.spineShards(G, body, [[0.62, 0, 0.36, 0.075, 0.45], [0.34, -0.2, 0.5, 0.09, 0.55], [0.3, 0.22, 0.46, 0.085, 0.55], [0.0, 0.02, 0.56, 0.1, 0.65], [-0.18, -0.38, 0.4, 0.075, 0.7], [-0.2, 0.4, 0.42, 0.075, 0.7]], X, { collarMat: skinM });
  for (const s of [-1, 1]) { const { p, n } = K.onBody(body, 0.4, s * 0.9, 0.05); K.cluster(G, p, [n[0] - 0.4, n[1] + 0.3, n[2]], 3, 0.44, 0.08, X, 0.5, { collarMat: skinM }); }
  K.cluster(G, [-2.05, 0.95, 0], [-1, 0.9, 0], 3, 0.36, 0.07, X, 0.55, { collarMat: skinM });

  // feeding: threads of stolen charge running from the target into the star
  if (feed) {
    const arcM = K.glowMat('#fbfaff', 1.8, K.dimGlow(X.glow, 2.2)), T0 = 2.95, c = [D.position.x + dn.x * 0.15, D.position.y + dn.y * 0.15];
    for (const s of [-1, -0.35, 0.35, 1]) {
      const pts = [[T0, 0.45, s * 0.2]];
      for (let k = 1; k <= 6; k++) { const t = k / 6; pts.push([T0 + (c[0] - T0) * t + (L.rnd() - 0.5) * 0.08, 0.45 + (c[1] - 0.45) * t + L.rnd() * 0.06, s * 0.2 * (1 - t) + (L.rnd() - 0.5) * 0.1]); }
      K.tube(G, pts, () => 0.018, arcM, { n: 30, radial: 6 });
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// BRUTE: twice a Swarmer. A huge badger-mole, broad and low, in a shaggy coarse coat with a pale stripe down its face;
// its back is grown over with a saddle of geode crust split along the spine, where crystal packs the crack and breaks
// out through the flanks. Enormous spade hands with long claws for tearing through walls.
function brute(L, K, G, GL, f) {
  const X = { ...K.XTAL, k: 0.82 };
  const furM = K.fur('#3b312b', { coarse: true, sheen: 0.7, sheenColor: '#8f8174', rough: 0.92, ns: 1.0 });
  const skinM = K.flesh('#7e655f', { rough: 0.62 }), snoutM = K.flesh('#866a64'), clawM = K.keratin('#d7c9aa', 0.5);
  const body = K.loft(G, [
    [-3.45, 0, 0, 0, 1.06], [-3.3, 0.66, 0.56, 0.46, 1.08], [-2.85, 1.18, 0.96, 0.66, 1.12], [-1.9, 1.46, 1.18, 0.75, 1.17],
    [-0.65, 1.6, 1.3, 0.78, 1.2], [0.5, 1.66, 1.32, 0.78, 1.18], [1.35, 1.42, 1.1, 0.7, 1.1], [2.05, 0.98, 0.8, 0.54, 0.98],
    [2.55, 0.54, 0.47, 0.34, 0.9], [2.8, 0, 0, 0, 0.86],
  ], furM, { lump: 0.04, seed: 11, uv: 2.2, p: 2.3,
    col: (x, a) => { const s = K.sstep(1.55, 2.0, x) * Math.exp(-(a * a) / 0.05) + K.sstep(2.0, 2.4, x) * 0.5 * Math.exp(-((Math.abs(a) - 0.9) ** 2) / 0.04); const k = 1 + 1.35 * Math.min(1, s); return [k, k * 0.97, k * 0.92]; } });

  // ---- the geode saddle: stone crust over the back, split along the spine
  const crustM = K.crust('#ffffff');
  const stone = [0.09, 0.085, 0.08], stoneL = [0.21, 0.19, 0.17], rust = [0.24, 0.13, 0.08];
  const bands = [[0.42, 0.4, 0.42], [0.25, 0.23, 0.28], [0.15, 0.13, 0.19], [0.07, 0.06, 0.09], [0.035, 0.03, 0.045]];
  const sad = K.crustSaddle(G, body, { x0: -3.05, x1: 1.25, amax: 1.2, thick: 0.3, bands: 0, crack: 0.3, mat: crustM,
    colour: (x, a, inC) => {
      if (inC > 0) return bands[Math.min(4, Math.floor(Math.pow(inC, 0.6) * 5))].map(q => q * 1.3);
      const lum = 0.5 + 0.5 * K.nz(x * 3 + 9, a * 3, 2); let c = stone.map((q, j) => q + (stoneL[j] - q) * lum);
      const rs = Math.max(0, K.nz(x * 2, a * 2 + 2, 3.5) - 0.25); c = c.map((q, j) => q + (rust[j] - q) * Math.min(1, rs * 2));
      return c.map(q => q * 1.5);
    } });
  // the seam: crystal packed along the crack, tallest mid-back, leaning back and out of it
  for (let i = 0; i < 8; i++) {
    const t = (i + 0.2 + L.rnd() * 0.6) / 8, x = -2.7 + 3.6 * t, mid = Math.max(0, 1 - Math.abs(t - 0.45) * 1.8);
    const a = sad.crackZ(x) + (L.rnd() - 0.5) * 0.12, p = sad.top(x, a);
    K.cluster(G, [p[0], p[1] - 0.18, p[2]], [-0.5 - L.rnd() * 0.3, 1, (i % 2 ? 1 : -1) * (0.3 + L.rnd() * 0.35)], 2 + Math.round(L.rnd()), 0.5 + 0.9 * mid * (0.8 + L.rnd() * 0.3), 0.11 + 0.09 * mid, X, 0.45, { collar: false });
  }
  // clusters breaking out through the flanks of the crust, and two at the shoulders
  for (const [x, a, n, len] of [[-1.4, 0.82, 4, 0.7], [-0.2, -0.85, 4, 0.66], [-2.4, -0.7, 3, 0.55], [0.6, 0.78, 3, 0.55], [-2.6, 0.62, 3, 0.45]]) {
    const p = sad.top(x, a), { n: nn } = K.onBody(body, x, a);
    K.cluster(G, [p[0], p[1] - 0.06, p[2]], [nn[0] * 0.6 - 0.2, nn[1], nn[2] * 0.9], n, len, 0.11, X, 0.5, { collarMat: crustM });
  }
  for (const s of [-1, 1]) { const { p, n } = K.onBody(body, 1.15, s * 0.75, 0.08); K.cluster(G, p, [n[0] - 0.2, n[1] + 0.3, n[2]], 3, 0.55, 0.1, X, 0.45, { collarMat: skinM }); }

  // ---- the head: snout, tiny eyes, a stub tail
  K.snout(G, { base: [2.35, 1.0, 0], tip: [3.28, 0.8, 0], r: 0.3, skin: snoutM, whisker: K.plain('#bdb3a6', 0.6) });
  K.eyes(G, [2.2, 1.5, 0], 0.5, 0.045);
  K.tail(G, { base: [-3.3, 1.12, 0], tip: [-4.0, 0.92, 0.08], r: 0.15, mat: furM });

  // ---- limbs: enormous spade hands, thick hind legs
  for (const s of [-1, 1]) {
    K.forelimb(GL, { side: s, f, shoulder: [1.3, 0.95, s * 0.72], wrist: [2.02, 0.5, s * 1.1], palm: 1.25, claw: 0.8, armR: 0.5, clawW: 1.1,
      stride: 0.26, lift: 0.22, skin: skinM, arm: furM, clawMat: clawM, splay: 0.5, tilt: 0.4, fan: 0.55, fringe: K.plain('#5a4f48', 0.8) });
    K.hindlimb(GL, { side: s, f, hip: [-2.6, 0.85, s * 0.8], foot: [-3.0, 0.12, s * 1.38], len: 0.66, r: 0.3,
      stride: 0.24, lift: 0.18, skin: skinM, leg: furM, clawMat: clawM, out: 0.65 });
  }
}

// ---------------------------------------------------------------------------------------------------------------
// BURROW: the tunnel mouth. A molehill heaped up round a dark throat: crumbly fresh soil thrown up in clods, the throat
// lined with glowing crystal. Six crystal pillars stand on the rim, evenly spaced, the one detail that looks planned.
// Raised ridges of soil (tunnels just under the surface) run off from it, one ending in a small fresh molehill.
function burrow(L, K) {
  const { THREE } = K, X = K.XTAL;
  L.getRoot().scale.setScalar(1.06);
  const CZ = -0.3;
  // a domed heap with a hole in the top
  const prof = [[0, -3.8], [0.35, -3.25], [0.75, -1.9], [1.0, -0.55], [1.2, 0.55], [1.45, 1.35], [1.85, 1.75], [2.3, 1.62], [2.85, 1.1], [3.4, 0.56], [3.9, 0.2], [4.3, 0.03], [4.6, -0.08]];
  const hProf = (r) => { for (let i = 1; i < prof.length; i++) if (r <= prof[i][0]) { const [r0, h0] = prof[i - 1], [r1, h1] = prof[i], t = (r - r0) / (r1 - r0), s = t * t * (3 - 2 * t); return h0 + (h1 - h0) * s; } return prof[prof.length - 1][1]; };
  const RH = 1.4, RMAX = 4.6;
  const soilM = K.crust('#ffffff', { rough: 0.95, ns: 0.8 });
  // ---- the mound: polar heightfield, vertex coloured, crumbly
  const hAt = [];
  {
    const NR = 96, NA = 192, pos = [], col = [], idx = [];
    for (let j = 0; j <= NR; j++) for (let i = 0; i <= NA; i++) {
      const a = i / NA * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      const rmax = 4.15 + 0.45 * K.nz(ca * 1.7, 0.9, sa * 1.7) + 0.12 * Math.sin(a * 7 + 1) + 0.06 * Math.sin(a * 17);
      const r = 0.05 + (j / NR) * (rmax - 0.05), rn = r < 2.3 ? r : 2.3 + (r - 2.3) * (RMAX - 2.3) / (rmax - 2.3);
      let h = hProf(rn);
      if (r > 1.3) h += 0.22 * K.nz(ca * 1.5, 0.3, sa * 1.5) * Math.exp(-((r - 2.2) ** 2) / 1.2)            // the heap is uneven
        + 0.09 * K.nz(ca * r * 2.2, 3, sa * r * 2.2) + 0.05 * K.nz(ca * r * 5, 7, sa * r * 5);              // and crumbly
      const rib = Math.sin(a * 7 + r * 5.5);                                                                // spiral scrapes down the throat
      if (r < RH + 0.1) h += 0.08 * rib * Math.min(1, (RH + 0.1 - r) / 0.3);
      pos.push(ca * r, h, CZ + sa * r);
      // fresh dark soil on the heap (thrown up from below, still damp), drying paler toward the foot; black depths
      const fresh = [0.17, 0.12, 0.09], dry = [0.42, 0.34, 0.26], throat = [0.07, 0.055, 0.05], deep = [0.012, 0.01, 0.014], resin = [0.16, 0.11, 0.1];
      const mix = (p, q, t) => p.map((v, k) => v + (q[k] - v) * Math.max(0, Math.min(1, t)));
      let c;
      if (r > 1.6) c = mix(fresh, dry, (rn - 2.6) / 1.8);
      else if (r > RH) c = mix(throat, fresh, (r - RH) / 0.25);
      else { c = mix(deep, throat, (r - 0.2) / (RH - 0.2)); if (rib > 0.5) c = mix(c, resin, (rib - 0.5) * 1.4 * Math.min(1, r / 0.6)); }
      const nn = 0.82 + 0.36 * K.nz(ca * r * 3, 5, sa * r * 3); c = c.map(v => v * nn);
      col.push(...c.map(v => v * 1.35));
    }
    for (let j = 0; j < NR; j++) for (let i = 0; i < NA; i++) { const a = j * (NA + 1) + i, b = a + 1, c = a + NA + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const uv = []; for (let k = 0; k < pos.length; k += 3) uv.push(pos[k] / 2.5, pos[k + 2] / 2.5); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    L.mesh(g, soilM, 0, 0, 0, {});
  }
  // the ground stain round the heap: dark disturbed earth with a ragged edge, fading into whatever ground it sits on
  {
    const n = 1024, tex = L.canvasTex(n, (g) => {
      const c = n / 2, img = g.createImageData(n, n), D = img.data;
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const dx = (x - c) / c, dy = (y - c) / c, rr = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
        const edge = 0.93 + 0.05 * K.nz(Math.cos(a) * 1.8, 0.2, Math.sin(a) * 1.8) + 0.03 * Math.sin(a * 9 + 2 * K.nz(dx * 3, 1, dy * 3));
        const al = Math.min(1, Math.max(0, (edge - rr) / 0.12)) * 0.8 * Math.min(1, Math.max(0, (rr - 0.4) / 0.05));
        const speck = K.nz(dx * 40, 7, dy * 40) > 0.55 ? 1 : 0, fade = Math.max(0, Math.min(1, (rr - 0.8) / 0.15)), k2 = 1 - fade * 0.25;
        const i4 = (y * n + x) * 4; D[i4] = (70 + 40 * speck) * k2; D[i4 + 1] = (55 + 45 * speck) * k2; D[i4 + 2] = (44 + 50 * speck) * k2; D[i4 + 3] = Math.round(al * 255);
      }
      g.putImageData(img, 0, 0);
    });
    const m = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.95, depthWrite: false });
    const pg = new THREE.PlaneGeometry(10.4, 10.4); pg.rotateX(-Math.PI / 2);
    const pm = new THREE.Mesh(pg, m); pm.position.set(0, 0.01, CZ); pm.receiveShadow = true; pm.userData.decal = true; L.getRoot().add(pm);
  }
  // ---- clods: soil thrown up in lumps all over the heap (what makes it read as a molehill)
  const clodM = [K.crust('#4a3a2e', { rough: 0.95 }), K.crust('#3a2c22', { rough: 0.95 }), K.crust('#5e4a3a', { rough: 0.95 })];
  const clodGeo = (s, k) => { const g = new THREE.DodecahedronGeometry(1, 1), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const q = 1 + 0.3 * K.nz(p.getX(i) * 2 + k, p.getY(i) * 2, p.getZ(i) * 2); p.setXYZ(i, p.getX(i) * q, p.getY(i) * q, p.getZ(i) * q); } g.scale(s, s * 0.7, s * (0.8 + 0.4 * L.rnd())); g.computeVertexNormals(); return g; };
  const clod = (x, z, s, k, lift = 0.3) => { const r = Math.hypot(x, z - CZ); L.mesh(clodGeo(s, k), clodM[k % 3], x, hProf(r) + s * lift, z, { dirt: 0.25, dirtH: s, ry: L.rnd() * 6.28 }); };
  for (let i = 0; i < 220; i++) {
    const a = L.rnd() * Math.PI * 2, r = 1.5 + Math.pow(L.rnd(), 0.8) * 2.7, s = 0.05 + Math.pow(L.rnd(), 2) * 0.2 * (r < 3 ? 1.2 : 0.8);
    clod(Math.cos(a) * r, CZ + Math.sin(a) * r, s, i);
  }
  // ---- raised tunnels running off under the surface, the soil heaved and cracked along them; one ends in a small heap
  const runs = [[0.6, 1, [0.4, 0.6]], [2.5, -1, [0.3, -0.5]], [4.3, 1, [0.5, 0.3]]];
  runs.forEach(([a0, sgn, [wig, bend]], ri) => {
    const pts = []; for (let k = 0; k <= 10; k++) { const t = k / 10, r = 3.3 + t * 1.75, a = a0 + sgn * bend * t * t + wig * 0.15 * Math.sin(t * 7 + ri); pts.push([Math.cos(a) * r, -0.12, CZ + Math.sin(a) * r]); }
    K.tube(null, pts, t => 0.3 * (1 - 0.25 * t), K.crust('#5a4838', { rough: 0.95 }), { n: 40, radial: 12, flat: 0.55, dirt: 0.2 });
    const c = K.curve(pts, 30);
    for (let k = 0; k < 30; k++) for (const s of [-1, 1]) { const p = c[k], q = c[k + 1]; const dx = q[0] - p[0], dz = q[2] - p[2], l = Math.hypot(dx, dz); L.mesh(clodGeo(0.06 + L.rnd() * 0.07, k + ri * 40), clodM[(k + ri) % 3], p[0] - dz / l * s * 0.13, 0.04 + L.rnd() * 0.04, p[2] + dx / l * s * 0.13, { dirt: 0.2, ry: L.rnd() * 6 }); }
    if (ri === 1) {     // a small fresh heap where this tunnel breaks the surface
      const e = pts[pts.length - 1];
      for (let k = 0; k < 26; k++) { const a = L.rnd() * 6.28, rr = Math.pow(L.rnd(), 0.7) * 0.55, s = 0.08 + L.rnd() * 0.1; L.mesh(clodGeo(s, k), clodM[k % 3], e[0] + Math.cos(a) * rr, 0.05 + (0.55 - rr) * 0.45 + s * 0.3, e[2] + Math.sin(a) * rr, { dirt: 0.2, ry: L.rnd() * 6 }); }
    }
  });
  // ---- crystal lining the throat: shards growing inward and up from the walls, brighter the deeper they sit
  for (let i = 0; i < 30; i++) {
    const a = i / 30 * Math.PI * 2 + L.rnd() * 0.2, r = 0.45 + L.rnd() * 0.85, h = hProf(r) + 0.02, deep = Math.max(0, Math.min(1, -h / 2.5));
    K.shard(null, [Math.cos(a) * r, h, CZ + Math.sin(a) * r], [-Math.cos(a) * 0.8, 1.0, -Math.sin(a) * 0.8], 0.35 + L.rnd() * 0.4, 0.07 + L.rnd() * 0.04, { ...X, k: 0.8 + deep * 0.9 }, { collar: false });
  }
  const coreM = K.glowMat('#f1eeff', 1.2, K.dimGlow(X.glow, 1.5));
  L.mesh(new THREE.CircleGeometry(0.5, 24).rotateX(-Math.PI / 2), coreM, 0, -3.6, CZ, { cast: false, dirt: 0 });
  L.pointLight('#e6e0ff', 1.5 + K.GLOW * 7, 0, -2.4, CZ, 3.5);
  // ---- six pillars of crystal on the rim, evenly spaced and tilted outward, each with smaller companions
  for (let k = 0; k < 6; k++) {
    const a = k / 6 * Math.PI * 2 + 0.26, r = 1.75, ca = Math.cos(a), sa = Math.sin(a), h = hProf(r) - 0.15;
    K.shard(null, [ca * r, h, CZ + sa * r], [ca * 0.42, 1, sa * 0.42], 1.9 + (k % 2) * 0.45, 0.28, X, { collarMat: clodM[1] });
    for (const d of [-0.3, 0.32]) { const b = a + d; K.shard(null, [Math.cos(b) * (r + 0.12), hProf(r + 0.12) - 0.08, CZ + Math.sin(b) * (r + 0.12)], [Math.cos(b) * 0.9 + Math.cos(a) * 0.2, 1, Math.sin(b) * 0.9], 0.55 + L.rnd() * 0.3, 0.1, X, { collar: false }); }
  }
  // ---- chips of crystal kicked out with the soil
  for (let i = 0; i < 10; i++) {
    const a = L.rnd() * Math.PI * 2, r = 2.6 + L.rnd() * 1.4;
    K.shard(null, [Math.cos(a) * r, hProf(r) - 0.03, CZ + Math.sin(a) * r], [L.rnd() - 0.5, 0.5, L.rnd() - 0.5], 0.18 + L.rnd() * 0.14, 0.05, X, { collar: false });
  }
}

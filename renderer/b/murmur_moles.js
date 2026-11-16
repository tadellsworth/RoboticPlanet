// The Murmur, direction B ("Crystal-backed swarm") reworked as moles at the owner's request ("a little less like bugs
// and more like moles"). Burrowing animals: compact low bodies of matte fur or leathery hide, four limbs (huge
// outward-turned spade forepaws with long pale claws, small hind feet), a pointed fleshy snout, tiny eyes, a stub of a
// tail, and shards of eaten Ring Crystal erupting through the hide along the spine and shoulders: smoky glass with a
// breath of violet by day, burning white at night (no team owns white). The Bloom ones glow violet.
//   ?c=swarmer | drainer | brute | burrow | spitter | delver | spit-glob
//   ?v=base | rust | white | bloom      regional variants (Swarmer, Spitter, Delver): Rust armoured, White pale and slow,
//                                       Bloom violet
//   ?f=0..3                             walking frame: diagonal pairs (left fore with right hind); only the limbs move
//   ?pose=feed  (or ?feed=1)            Drainer latched on: the star of feelers open and lit, the sac blazing
//   ?pose=spit                          Spitter spitting: jaws wide, the cheek glands squeezed, a glob leaving the mouth
//   ?pose=surface                       Delver breaking the surface: head, forepaws and a ring of thrown-up soil
//   c=spit-glob                         the Spitter's glob on its own (a projectile the game can draw), flying +x
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
export const SPRITE_W = { swarmer: 5.8, drainer: 7.6, brute: 11.4, spitter: 6.8, delver: 8.4, 'spit-glob': 2.6 };
// every model is built at one world scale, then grown by this much (so the game's 0.078 per unit gives B's sizes)
const GROW = 1.2;

export default function (L) {
  const K = molekit(L);
  const f = +(P.get('f') || 0), V = P.get('v') || 'base', FEED = P.get('pose') === 'feed' || !!+(P.get('feed') || 0), POSE = P.get('pose') || '';
  L.seed({ swarmer: 8100, drainer: 8200, brute: 8300, burrow: 8400, spitter: 8500, delver: 8600, 'spit-glob': 8700 }[C] + (V === 'base' ? 0 : V.length));
  if (C === 'burrow') return burrow(L, K);
  const W = SPRITE_W[C];
  const heroCams = {
    swarmer: { pos: [6.6, 4.0, 7.6], at: [0.1, 0.55, 0.1], fov: 30 },
    drainer: { pos: [8.8, 5.2, 9.8], at: [0.2, 0.7, 0.1], fov: 30 },
    brute: { pos: [15.2, 7.0, 12.6], at: [0.9, 1.2, 0.3], fov: 37 },
    spitter: { pos: [7.6, 4.4, 8.4], at: [0.3, 0.65, 0.1], fov: 31 },
    delver: { pos: [9.4, 4.6, 9.8], at: [0.3, 0.5, 0.1], fov: 32 },
    'spit-glob': { pos: [2.6, 1.6, 2.9], at: [0, 0.4, 0], fov: 30 },
  };
  K.camera(W, HERO && heroCams[C]);
  if (HERO) K.heroGround(W);
  const G = L.group(0, 0, 0), GL = L.group(0, 0, 0, 0, G);       // GL holds the moving limbs
  if (C === 'swarmer') swarmer(L, K, G, GL, f, V);
  else if (C === 'drainer') drainer(L, K, G, GL, f, FEED);
  else if (C === 'spitter' || C === 'delver' || C === 'spit-glob') {
    // the two later roles centre themselves, so a special pose stays registered with the walk (see centreOn)
    G.scale.setScalar(GROW);
    if (C === 'spitter') spitter(L, K, G, GL, f, V, POSE === 'spit');
    else if (C === 'delver') delver(L, K, G, GL, f, V, POSE === 'surface');
    else spitGlob(L, K, G, V);
    return;
  }
  else brute(L, K, G, GL, f);
  G.scale.setScalar(GROW);
  K.centre(G, GL);
}

// ---------------------------------------------------------------------------------------------------------------
// palettes. Dark, matte animals; claws pale (the mark that reads from above); snouts a dull grey-pink (never a team red).
const PAL = {
  base:  { hide: '#463c3b', belly: '#2a2224', skin: '#9c8884', snout: '#a38a84', claw: '#ddd0b4', tooth: '#e6d39c', sheen: '#9a8c86' },
  rust:  { hide: '#45291d', belly: '#24150f', skin: '#9c7666', snout: '#a07868', claw: '#e0c8a2', tooth: '#e6cf98', plate: '#8c4a2c', sheen: '#a48270' },
  white: { hide: '#c3c8cc', belly: '#9aa0a5', skin: '#b3a29c', snout: '#bba49e', claw: '#efe8da', tooth: '#efe2b8', sheen: '#ffffff' },
  bloom: { hide: '#30243a', belly: '#1c1520', skin: '#8a748c', snout: '#8e7690', claw: '#d8cdbf', tooth: '#e2d4a8', sheen: '#9a86a6' },
};
// the torn rim of hide where a shard breaks out: dark and raw, near the coat's own tone, so the crystal looks grown out
// of the animal (a pale rim read as a washer round a bolt)
const RAW = { base: '#3e302f', rust: '#42271c', white: '#8e8a88', bloom: '#33263b' };
const rawMat = (K, v) => K.flesh(RAW[v] || RAW.base, { rough: 0.72, cc: 0.05 });

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
    bodyM = K.fur(pal.hide, { sheenColor: pal.sheen, emissiveMap: spots, emissive: '#b26bff', glow: K.dimGlow('#b070ff'), ek: 0.9 });
  } else if (v === 'white') bodyM = K.fur(pal.hide, { coarse: true, sheen: 1, sheenColor: pal.sheen, rough: 0.92 });
  else bodyM = K.fur(pal.hide, { sheenColor: pal.sheen });
  const skinM = K.flesh(pal.skin), snoutM = K.flesh(pal.snout), clawM = K.keratin(pal.claw), toothM = K.keratin(pal.tooth, 0.35);
  const X = v === 'white' ? K.XTAL_WHITE : v === 'bloom' ? K.XTAL_BLOOM : K.XTAL;

  // ---- the body: a lean cylinder, deepest at the shoulders, tapering into the head
  const S = (x, w, h, b, cy) => [x, w * fat, h * fat, b * fat, cy];
  const body = K.loft(G, [
    S(-1.6, 0.0, 0.0, 0.0, 0.53), S(-1.5, 0.29, 0.26, 0.2, 0.54), S(-1.25, 0.46, 0.38, 0.29, 0.56), S(-0.8, 0.52, 0.43, 0.32, 0.57),
    S(-0.25, 0.5, 0.45, 0.32, 0.58), S(0.3, 0.47, 0.45, 0.31, 0.58), S(0.75, 0.38, 0.37, 0.27, 0.56), S(1.08, 0.27, 0.27, 0.2, 0.53),
    S(1.34, 0.15, 0.15, 0.12, 0.5), S(1.46, 0.0, 0.0, 0.0, 0.49),
  ], bodyM, { lump: 0.035, seed: 3, uv: 1.4 });
  // the coat: the White ones shaggy, the rest a short bristly pelt over the wrinkled hide
  K.furShells(body, bodyM, v === 'white' ? { n: 6, len: 0.075, density: 1, comb: 0.8, tip: 0.25 } : { n: 5, len: 0.045, density: 0.9, comb: 0.9, tip: 0.3 });

  // ---- snout, buck teeth, eyes, tail
  const tip = K.snout(G, { base: [1.2, 0.52, 0], tip: [1.86, 0.46, 0], r: 0.155, skin: snoutM, whisker: K.plain(v === 'white' ? '#f6f6f2' : '#cfc6bc', 0.6) });
  for (const s of [-1, 1]) {                                                  // upper and lower incisors, jutting out past the nose
    K.claw(G, [1.74, 0.4, s * 0.034], [1, -0.32, s * 0.06], [0, 1, 0], 0.28, 0.03, 0.017, toothM, 0.3);
    K.claw(G, [1.72, 0.33, s * 0.03], [1, 0.2, s * 0.05], [0, 1, 0], 0.27, 0.026, 0.015, toothM, -0.2);
  }
  K.eyes(G, [1.08, 0.66, 0], 0.2 * fat, 0.028);
  K.tail(G, { base: [-1.48, 0.55, 0], tip: [-2.05, 0.42, 0.04], r: 0.055, mat: v === 'white' ? bodyM : skinM, bristle: K.plain('#8a7f78', 0.7) });

  // ---- four limbs (in GL: the only parts that move)
  for (const s of [-1, 1]) {
    K.forelimb(GL, { side: s, f, shoulder: [0.6, 0.45, s * 0.12 * fat], wrist: [0.98, 0.32, s * 0.36 * fat], palm: 0.6, claw: 0.46, armR: 0.2 * fat,
      stride: 0.19 * legK, lift: 0.14, skin: skinM, arm: bodyM, clawMat: clawM, splay: 0.72, tilt: 0.3 });
    K.hindlimb(GL, { side: s, f, hip: [-1.02, 0.42, s * 0.2 * fat], foot: [-1.26, 0.08, s * (0.4 + 0.06 * legK) * fat], len: 0.32, r: 0.13 * fat,
      stride: 0.18 * legK, lift: 0.12, skin: skinM, leg: bodyM, clawMat: clawM, out: 0.75 });
  }

  // ---- Rust: armour. Overlapping scales of rust-red crust down the back, like a pangolin's (iron grown into the skin).
  // Only on the back: the fur shows on the flanks, so the outline stays furry (plates out to the edge read as a grub's rings)
  if (v === 'rust') {
    K.scales(G, body, { x0: -1.42, x1: 0.8, rows: 9, cols: 5, amax: 0.5, size: 0.42, width: 0.82, mat: K.crust(pal.plate, { rough: 0.8 }), lift: 0.28,
      skip: (i, j) => i % 2 === 0 && j === 2 && i > 0 && i < 8 && i !== 4 });
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
  const n = v === 'rust' ? 0.8 : v === 'white' ? 0.72 : 1, rk = 1;
  const collar = v === 'white' ? bodyM : rawMat(K, v);
  const spine = v === 'rust'
    ? [[0.52, 0, 0.6, 0.075, 1.2], [0.0, 0, 0.66, 0.08, 1.3], [-0.55, 0, 0.6, 0.075, 1.35], [-1.08, 0, 0.5, 0.07, 1.4]]
    : [[0.62, 0, 0.42, 0.07, 0.8], [0.4, -0.16, 0.62, 0.085, 1.0], [0.34, 0.18, 0.58, 0.08, 1.0], [0.1, -0.06, 0.8, 0.1, 1.1],
       [-0.14, 0.16, 0.7, 0.09, 1.15], [-0.36, -0.17, 0.72, 0.09, 1.2], [-0.58, 0.1, 0.64, 0.085, 1.25], [-0.82, -0.12, 0.56, 0.075, 1.3],
       [-1.02, 0.13, 0.46, 0.065, 1.35], [-1.22, -0.03, 0.36, 0.055, 1.4]];
  const keep = v === 'white' ? spine.filter((_, i) => i % 2 === 0 || i === 1) : spine;
  K.spineShards(G, body, keep.map(([x, a, l, r, lean]) => [x, a, l * n, r * rk, lean, 1.2]), X, { collarMat: collar });
  if (v !== 'rust') for (const s of [-1, 1]) {
    const { p, n: nn } = K.onBody(body, 0.42, s * 0.8, 0.05);
    K.cluster(G, p, [nn[0] - 0.9, nn[1] + 0.2, nn[2] * 1.3], v === 'white' ? 2 : 3, 0.5 * n, 0.075, X, 0.45, { collarMat: collar });
  }
}

// ---------------------------------------------------------------------------------------------------------------
// DRAINER: the feeder, a star-nosed mole. Velvet-furred, fat behind, its back swollen into a bare, thin-skinned sac of
// stolen charge whose veins glow through. On its snout a ring of 22 fleshy feeler-rays round the nostrils: walking they
// stand open and twitch, pale; feeding (?pose=feed) they splay wide and close on the target like fingers, burning white,
// and threads of charge run from the target into the star. Big spade hands, planted wide while it feeds.
function drainer(L, K, G, GL, f, feed) {
  const { THREE } = K, X = K.XTAL;
  const furM = K.fur('#3d3534', { sheenColor: '#9a8c84' }), skinM = K.flesh('#9c8884'), snoutM = K.flesh('#a38a84'), clawM = K.keratin('#ddd0b4');
  const FK = feed ? 2.4 : 1;                                             // feeding: everything that carries charge burns
  const rawM = rawMat(K, 'base');
  const body = K.loft(G, [
    [-2.2, 0, 0, 0, 0.74], [-2.08, 0.46, 0.44, 0.34, 0.75], [-1.72, 0.84, 0.78, 0.47, 0.79], [-1.05, 0.98, 0.9, 0.5, 0.81],
    [-0.35, 0.9, 0.82, 0.49, 0.8], [0.3, 0.74, 0.68, 0.45, 0.75], [0.82, 0.57, 0.52, 0.38, 0.7], [1.25, 0.37, 0.35, 0.27, 0.64],
    [1.52, 0.19, 0.19, 0.15, 0.59], [1.64, 0, 0, 0, 0.58],
  ], furM, { lump: 0.03, seed: 7, uv: 1.3 });
  K.furShells(body, furM, { n: 5, len: 0.055, density: 0.95, comb: 0.8 });

  // ---- the charge sac: a bare, swollen bulge of thin dark skin over the rear of the back, glowing veins under it
  const veins = L.canvasTex(1024, (g, n) => {
    g.fillStyle = '#1e1e1e'; g.fillRect(0, 0, n, n); g.lineCap = 'round';
    L.blotches(g, n, 40, 60, 200, 0.28, '255,255,255');                   // the charge inside, a soft light through the skin
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
  const sacM = new THREE.MeshPhysicalMaterial({ color: '#57454c', roughness: 0.5, metalness: 0, clearcoat: 0.45, clearcoatRoughness: 0.35, vertexColors: true,
    sheen: 0.3, sheenColor: new THREE.Color('#c8a8b0'), emissive: new THREE.Color(X.core).multiplyScalar(FK * (K.GLOW * K.GLOW * 0.5 + (K.NIGHTISH ? 0.15 : 0.12)) / 0.4), emissiveMap: veins, emissiveIntensity: 0.4 });
  sacM.envMapIntensity = 0.25; sacM.userData.glow = K.dimGlow(X.glow, (K.GLOW > 1 || feed ? 0.8 : 3) * Math.min(2.2, FK));
  {
    const sx = -1.02, sy = 1.08, rx = 1.12, ry = 0.78, rz = 0.84;
    const g = new THREE.SphereGeometry(1, 96, 48), p = g.attributes.position, col = new Float32Array(p.count * 3), v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      // taut skin over lumps of stored charge; a little lop-sided
      const fold = Math.max(0, K.nz(v.x * 5 + 2, v.y * 5, v.z * 5)) ** 2;
      const k = 1 + 0.05 * K.nz(v.x * 2.6, v.y * 2.6, v.z * 2.6) + 0.025 * K.nz(v.x * 7, v.y * 7 + 3, v.z * 7) - 0.03 * fold;
      p.setXYZ(i, v.x * rx * k, v.y * ry * k * (v.y < 0 ? 0.6 : 1), v.z * rz * k);
      const b = (0.55 + 0.45 * Math.max(0, v.y)) * (1 - 0.35 * fold); col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
    L.mesh(g, sacM, sx, sy, 0, { parent: G });
  }

  // ---- snout and the star
  const tilt = feed ? 0.62 : 0.8;                                         // nose raised, the star facing up and forward
  const tip = [1.92, feed ? 0.62 : 0.7, 0];
  K.snout(G, { base: [1.28, 0.7, 0], tip, r: 0.17, skin: snoutM, nostril: false });
  const dn = new THREE.Vector3(Math.cos(tilt), Math.sin(tilt), 0);
  const D = L.group(tip[0] + dn.x * 0.04, tip[1] + dn.y * 0.04, 0, 0, G); D.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dn);
  // in D: +x is the way the star faces, the rays radiate in the y-z plane
  // feeding, the rays light up from inside (pale flesh glowing) and their tips burn
  const rayM = feed ? K.glowMat('#eadfe6', 0.32 * FK, K.dimGlow(X.glow, 0.7)) : K.flesh('#b8958c', { rough: 0.5 });
  const tipM = K.glowMat('#f3f0ff', feed ? 1.0 * FK : 0.5, K.dimGlow(X.glow, feed ? 2.0 : 0.8));
  K.seg(D, [0.03, 0, 0], 0.06, 0.1, 0.1, feed ? K.glowMat('#f8f6ff', 0.8 * FK, K.dimGlow(X.glow, 1.6)) : K.flesh('#6e5250'), { lump: 0.04 });
  for (let k = 0; k < 22; k++) {
    const a = (k + 0.5) / 22 * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
    const lowMid = Math.abs(Math.sin(a)) < 0.2 && Math.cos(a) < 0 ? 0.55 : 1;   // the two bottom rays are small, as on the real animal
    const len = (feed ? 0.46 : 0.3) * lowMid * (0.92 + 0.16 * L.rnd()), wob = feed ? 0 : 0.04 * Math.sin(k * 1.7);   // a fixed ragged set, the same in every frame
    const r0 = 0.1, P0 = [0.0, ca * r0, sa * r0], R1 = r0 + len;
    const pts = feed   // splayed wide open, the tips hooking forward: gripping the target
      ? [P0, [0.0, ca * (r0 + len * 0.5), sa * (r0 + len * 0.5)], [0.05, ca * (r0 + len * 0.88), sa * (r0 + len * 0.88)], [0.2, ca * R1 * 0.96, sa * R1 * 0.96]]
      : [P0, [0.04 + wob, ca * (r0 + len * 0.4), sa * (r0 + len * 0.4)], [0.1 + wob, ca * (r0 + len * 0.75), sa * (r0 + len * 0.75)], [0.18 + wob, ca * (r0 + len * 0.95), sa * (r0 + len * 0.95)]];
    K.tube(D, pts, t => 0.034 * (1 - 0.6 * t) + 0.008, rayM, { n: 12, radial: 7 });
    const e = pts[pts.length - 1]; L.sphere(feed ? 0.028 : 0.02, tipM, e[0], e[1], e[2], { parent: D, dirt: 0, cast: false });
  }
  K.eyes(G, [1.12, 0.84, 0], 0.27, 0.03);
  K.tail(G, { base: [-2.1, 0.76, 0], tip: [-2.62, 0.62, -0.05], r: 0.075, mat: skinM, bristle: K.plain('#8a7f78', 0.7) });

  // ---- limbs: big spade hands (planted wide and dug in while feeding), small hind feet
  for (const s of [-1, 1]) {
    K.forelimb(GL, { side: s, f, plant: feed, shoulder: [0.62, 0.62, s * 0.26], wrist: feed ? [1.2, 0.26, s * 0.62] : [1.02, 0.36, s * 0.44], palm: 0.62, claw: 0.52, armR: 0.25,
      stride: 0.16, lift: 0.13, skin: skinM, arm: furM, clawMat: clawM, splay: feed ? 0.85 : 0.55, tilt: feed ? 0.3 : 0.4, droop: feed ? 0.22 : 0.06, fringe: K.plain('#6a605a', 0.8) });
    K.hindlimb(GL, { side: s, f, plant: feed, hip: [-1.62, 0.56, s * 0.4], foot: [-1.94, 0.08, s * 0.72], len: 0.38, r: 0.17,
      stride: 0.15, lift: 0.11, skin: skinM, leg: furM, clawMat: clawM, out: 0.7 });
  }

  // ---- the shards: a spray from each shoulder and a short ridge between them, in front of the sac
  K.spineShards(G, body, [[0.62, 0, 0.36, 0.075, 0.45], [0.34, -0.2, 0.5, 0.09, 0.55], [0.3, 0.22, 0.46, 0.085, 0.55], [0.0, 0.02, 0.56, 0.1, 0.65], [-0.18, -0.38, 0.4, 0.075, 0.7], [-0.2, 0.4, 0.42, 0.075, 0.7]], X, { collarMat: rawM });
  for (const s of [-1, 1]) { const { p, n } = K.onBody(body, 0.4, s * 0.9, 0.05); K.cluster(G, p, [n[0] - 0.4, n[1] + 0.3, n[2]], 3, 0.44, 0.08, X, 0.5, { collarMat: rawM }); }
  K.cluster(G, [-2.05, 0.95, 0], [-1, 0.9, 0], 3, 0.36, 0.07, X, 0.55, { collarMat: rawM });

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
  const skinM = K.flesh('#8e7c77', { rough: 0.62 }), snoutM = K.flesh('#96827b'), clawM = K.keratin('#d7c9aa', 0.5);
  const body = K.loft(G, [
    [-3.45, 0, 0, 0, 1.06], [-3.3, 0.66, 0.56, 0.46, 1.08], [-2.85, 1.18, 0.96, 0.66, 1.12], [-1.9, 1.46, 1.18, 0.75, 1.17],
    [-0.65, 1.6, 1.3, 0.78, 1.2], [0.5, 1.66, 1.32, 0.78, 1.18], [1.35, 1.42, 1.1, 0.7, 1.1], [2.05, 0.98, 0.8, 0.54, 0.98],
    [2.55, 0.54, 0.47, 0.34, 0.9], [2.8, 0, 0, 0, 0.86],
  ], furM, { lump: 0.04, seed: 11, uv: 2.2, p: 2.3,
    col: (x, a0) => { const a = Math.atan2(Math.sin(a0), Math.cos(a0)), s = K.sstep(0.9, 1.6, x) * Math.exp(-(a * a) / 0.14) + K.sstep(1.8, 2.3, x) * 0.7 * Math.exp(-((Math.abs(a) - 1.0) ** 2) / 0.06); const k = 1 + 3.2 * Math.min(1, s); return [k, k * 0.98, k * 0.95]; } });
  K.furShells(body, furM, { n: 6, len: 0.1, density: 0.9, comb: 0.9, tip: 0.3, scale: 5 });

  // ---- the geode ridge: stone crust grown along the spine, split down the middle where the crystal comes through
  const crustM = K.crust('#ffffff');
  const stone = [0.06, 0.055, 0.052], stoneL = [0.15, 0.135, 0.12], rust = [0.2, 0.11, 0.07];
  const bands = [[0.42, 0.4, 0.42], [0.25, 0.23, 0.28], [0.15, 0.13, 0.19], [0.07, 0.06, 0.09], [0.035, 0.03, 0.045]];
  const sad = K.crustSaddle(G, body, { x0: -2.95, x1: 1.0, amax: 0.8, thick: 0.5, bands: 0, crack: 0.24, mat: crustM,
    colour: (x, a, inC) => {
      if (inC > 0) return bands[Math.min(4, Math.floor(Math.pow(inC, 0.6) * 5))].map(q => q * 1.3);
      const lum = 0.5 + 0.5 * K.nz(x * 3 + 9, a * 3, 2); let c = stone.map((q, j) => q + (stoneL[j] - q) * lum);
      const rs = Math.max(0, K.nz(x * 2, a * 2 + 2, 3.5) - 0.25); c = c.map((q, j) => q + (rust[j] - q) * Math.min(1, rs * 2));
      return c.map(q => q * 1.35);
    } });
  // the seam: crystal packed along the crack, tallest mid-back, leaning back and out of it
  for (let i = 0; i < 8; i++) {
    const t = (i + 0.2 + L.rnd() * 0.6) / 8, x = -2.7 + 3.6 * t, mid = Math.max(0, 1 - Math.abs(t - 0.45) * 1.8);
    const a = sad.crackZ(x) + (L.rnd() - 0.5) * 0.12, p = sad.top(x, a);
    K.cluster(G, [p[0], p[1] - 0.18, p[2]], [-0.5 - L.rnd() * 0.3, 1, (i % 2 ? 1 : -1) * (0.3 + L.rnd() * 0.35)], 2 + Math.round(L.rnd()), 0.5 + 0.9 * mid * (0.8 + L.rnd() * 0.3), 0.11 + 0.09 * mid, X, 0.45, { collar: false });
  }
  // scabs of crust on the flanks, crystal breaking out of each; and two sprays at the shoulders
  const scabM = K.crust('#4c443e');
  for (const [x, a, n, len, sz] of [[-1.35, 0.98, 4, 0.7, 0.5], [-0.15, -1.0, 4, 0.66, 0.48], [-2.35, -0.88, 3, 0.55, 0.4], [0.55, 0.95, 3, 0.55, 0.42], [-2.5, 0.8, 3, 0.45, 0.36]]) {
    const { p, n: nn } = K.onBody(body, x, a, 0.06);
    const S = L.group(p[0], p[1], p[2], 0, G); S.quaternion.setFromUnitVectors(new K.THREE.Vector3(0, 1, 0), new K.THREE.Vector3(...nn));
    K.seg(S, [0, 0, 0], sz, sz * 0.32, sz * 0.8, scabM, { lump: 0.18, seed: x * 3, flat: 0 });
    K.cluster(G, [p[0] + nn[0] * 0.1, p[1] + nn[1] * 0.1, p[2] + nn[2] * 0.1], [nn[0] * 0.6 - 0.3, nn[1], nn[2] * 0.9], n, len, 0.11, X, 0.5, { collar: false });
  }
  for (const s of [-1, 1]) { const { p, n } = K.onBody(body, 1.15, s * 0.75, 0.08); K.cluster(G, p, [n[0] - 0.2, n[1] + 0.3, n[2]], 3, 0.55, 0.1, X, 0.45, { collarMat: rawMat(K, 'base') }); }

  // ---- the head: snout, tiny eyes, a stub tail
  K.snout(G, { base: [2.3, 1.0, 0], tip: [3.4, 0.82, 0], r: 0.52, skin: snoutM, whisker: K.plain('#bdb3a6', 0.6) });   // a heavy fleshy cone, not a stick
  K.eyes(G, [2.0, 1.6, 0], 0.62, 0.028);                                 // pinpricks, half lost in the fur behind the snout
  K.tail(G, { base: [-3.3, 1.12, 0], tip: [-4.0, 0.92, 0.08], r: 0.15, mat: furM });

  // ---- limbs: enormous spade hands, thick hind legs
  for (const s of [-1, 1]) {
    K.forelimb(GL, { side: s, f, shoulder: [1.3, 0.95, s * 0.6], wrist: [1.95, 0.55, s * 0.95], palm: 1.25, claw: 1.15, armR: 0.55, clawW: 1.1,
      stride: 0.26, lift: 0.22, skin: skinM, arm: furM, clawMat: clawM, splay: 0.5, tilt: 0.4, fringe: K.plain('#5a4f48', 0.8) });
    K.hindlimb(GL, { side: s, f, hip: [-2.6, 0.85, s * 0.7], foot: [-3.0, 0.14, s * 1.25], len: 0.66, r: 0.36,
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
  const prof = [[0, -3.8], [0.35, -3.2], [0.75, -1.9], [1.0, -0.4], [1.2, 0.85], [1.45, 1.7], [1.85, 2.08], [2.3, 1.95], [2.85, 1.45], [3.4, 0.84], [3.9, 0.34], [4.3, 0.07], [4.6, -0.08]];
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
      if (r > 1.3) h += 0.25 * K.nz(ca * 1.5, 0.3, sa * 1.5) * Math.exp(-((r - 2.2) ** 2) / 1.2)            // the heap is uneven
        + 0.1 * K.nz(ca * r * 2.2, 3, sa * r * 2.2) + 0.07 * K.nz(ca * r * 5, 7, sa * r * 5) + 0.04 * K.nz(ca * r * 11, 2, sa * r * 11);   // and crumbly
      const rib = Math.sin(a * 7 + r * 5.5);                                                                // spiral scrapes down the throat
      if (r < RH + 0.1) h += 0.08 * rib * Math.min(1, (RH + 0.1 - r) / 0.3);
      pos.push(ca * r, h, CZ + sa * r);
      // fresh dark soil on the heap (thrown up from below, still damp), drying paler toward the foot; black depths
      const fresh = [0.11, 0.08, 0.06], dry = [0.26, 0.21, 0.16], throat = [0.07, 0.055, 0.05], deep = [0.012, 0.01, 0.014], resin = [0.16, 0.11, 0.1];
      const mix = (p, q, t) => p.map((v, k) => v + (q[k] - v) * Math.max(0, Math.min(1, t)));
      let c;
      if (r > 1.6) c = mix(fresh, dry, (rn - 3.4) / 1.2);
      else if (r > RH) c = mix(throat, fresh, (r - RH) / 0.25);
      else { c = mix(deep, throat, (r - 0.2) / (RH - 0.2)); if (rib > 0.5) c = mix(c, resin, (rib - 0.5) * 1.4 * Math.min(1, r / 0.6)); }
      const nn = 0.8 + 0.3 * K.nz(ca * r * 3, 5, sa * r * 3) + 0.25 * K.nz(ca * r * 12, 9, sa * r * 12); c = c.map(v => v * nn);
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
  const clodM = [K.crust('#3e3026', { rough: 0.97 }), K.crust('#33271f', { rough: 0.97 }), K.crust('#4a3a2e', { rough: 0.97 })];
  const clodGeo = (s, k) => { const g = new THREE.DodecahedronGeometry(1, 1), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const q = 1 + 0.3 * K.nz(p.getX(i) * 2 + k, p.getY(i) * 2, p.getZ(i) * 2); p.setXYZ(i, p.getX(i) * q, p.getY(i) * q, p.getZ(i) * q); } g.scale(s, s * 0.7, s * (0.8 + 0.4 * L.rnd())); g.computeVertexNormals(); return g; };
  const clod = (x, z, s, k, lift = 0.1) => { const r = Math.hypot(x, z - CZ); L.mesh(clodGeo(s, k), clodM[k % 3], x, hProf(r) + s * lift, z, { dirt: 0.1, dirtH: s, ry: L.rnd() * 6.28 }); };
  for (let i = 0; i < 520; i++) {      // crumbs all over the heap, bigger lumps near the rim where they were thrown up
    const a = L.rnd() * Math.PI * 2, r = 1.45 + Math.pow(L.rnd(), 1.1) * 2.6, s = 0.035 + Math.pow(L.rnd(), 2.2) * 0.17 * (r < 2.6 ? 1.2 : 0.75);
    clod(Math.cos(a) * r, CZ + Math.sin(a) * r, s, i);
  }
  // ---- raised tunnels running off under the surface: a low line of heaved, broken earth (dry soil lumps, two
  // staggered rows with a crack between), fading out at both ends; one breaks the surface in a small fresh heap
  const ridgeM = [K.crust('#6e5a46', { rough: 0.97 }), K.crust('#5f4c3b', { rough: 0.97 }), K.crust('#7a6550', { rough: 0.97 })];
  const runs = [[0.6, 1, [0.4, 0.6]], [2.5, -1, [0.3, -0.5]], [4.3, 1, [0.5, 0.3]]];
  runs.forEach(([a0, sgn, [wig, bend]], ri) => {
    const pts = []; for (let k = 0; k <= 10; k++) { const t = k / 10, r = 3.2 + t * 1.85, a = a0 + sgn * bend * t * t + wig * 0.15 * Math.sin(t * 7 + ri); pts.push([Math.cos(a) * r, 0, CZ + Math.sin(a) * r]); }
    const c = K.curve(pts, 60);
    for (let k = 0; k < 60; k++) {
      const t = k / 60, p = c[k], q = c[k + 1], dx = q[0] - p[0], dz = q[2] - p[2], l = Math.hypot(dx, dz), fade = Math.min(1, t * 6, (1 - t) * 5 + (ri === 1 ? 1 : 0));
      for (const sd of [-1, 1]) {
        const s0 = (0.13 + 0.08 * L.rnd()) * (0.4 + 0.6 * fade), off = sd * (0.12 + 0.05 * L.rnd()) * fade;
        const g = clodGeo(s0, k * 2 + (sd > 0 ? 1 : 0) + ri * 200); g.scale(1.3, 0.75, 1.1);
        L.mesh(g, ridgeM[(k + ri + (sd > 0 ? 1 : 0)) % 3], p[0] - dz / l * off, -0.02 + s0 * 0.2, p[2] + dx / l * off, { dirt: 0, ry: Math.atan2(-dz, dx) + (L.rnd() - 0.5) * 0.6 });
      }
    }
    if (ri === 1) {     // a small fresh molehill where this tunnel breaks the surface
      const e = pts[pts.length - 1];
      K.seg(null, [e[0], -0.04, e[2]], 0.66, 0.42, 0.66, K.crust('#4a3a2e', { rough: 0.97 }), { lump: 0.14, flat: 1 });
      for (let k = 0; k < 60; k++) { const a = L.rnd() * 6.28, rr = Math.pow(L.rnd(), 0.6) * 0.66, s = 0.035 + L.rnd() * 0.06; L.mesh(clodGeo(s, k), clodM[k % 3], e[0] + Math.cos(a) * rr, -0.04 + 0.42 * Math.sqrt(Math.max(0, 1 - (rr / 0.66) ** 2)) + s * 0.1, e[2] + Math.sin(a) * rr, { dirt: 0, ry: L.rnd() * 6 }); }
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

// ===============================================================================================================
// The two later roles: the SPITTER (counters defence lines) and the DELVER (counters walls and turtling). Same kit, same
// palette logic, same regional variants as the Swarmer. They centre themselves on their body alone (centreOn), so the
// special pose (spit, surface) stays registered with the walk frames and the game can swap sprites without a jump.

// the slurry the Spitter makes from eaten crystal (its glands, its glob): milky white with a breath of violet, burning
// white at night. The White ones' frosted and dim, the Bloom ones' violet.
const SLURRY = { skin: '#a49bb2', core: '#f6f2ff', glow: '#ebe2ff', jelly: '#cdbff0', k: 1 };
const SLURRY_WHITE = { skin: '#c4c8ce', core: '#eef1f5', glow: '#e2e7ee', jelly: '#e4e8ee', k: 0.6 };
const SLURRY_BLOOM = { skin: '#76589a', core: '#cf9cff', glow: '#b67cff', jelly: '#a77ae6', k: 1.1 };

// centreOn(K, G, meshes): slide G along x so the given meshes (the body) sit in the middle of the frame
function centreOn(K, G, meshes) {
  G.updateMatrixWorld(true);
  const b = new K.THREE.Box3(), t = new K.THREE.Box3();
  for (const m of meshes) { t.setFromObject(m); b.union(t); }
  G.position.x -= (b.min.x + b.max.x) / 2;
}

// coat(L, K, v, base): the body material for a regional variant; base = { hide, sheen, o } for the plain one
function coat(L, K, v, base) {
  if (v === 'bloom') {
    const spots = L.canvasTex(512, (g, n) => {
      g.fillStyle = '#000'; g.fillRect(0, 0, n, n);
      for (let i = 0; i < 60; i++) { const x = L.rnd() * n, y = L.rnd() * n, r = 3 + L.rnd() * 9; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.5, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
      g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 2;
      for (let i = 0; i < 22; i++) { let x = L.rnd() * n, y = L.rnd() * n; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 8; k++) { x += (L.rnd() - 0.5) * 50; y += (L.rnd() - 0.2) * 30; g.lineTo(x, y); } g.stroke(); }
    });
    return K.fur(PAL.bloom.hide, { sheenColor: PAL.bloom.sheen, emissiveMap: spots, emissive: '#b26bff', glow: K.dimGlow('#b070ff'), ek: 0.9 });
  }
  if (v === 'white') return K.fur(PAL.white.hide, { coarse: true, sheen: 1, sheenColor: PAL.white.sheen, rough: 0.92 });
  if (v === 'rust') return K.fur(PAL.rust.hide, { sheenColor: PAL.rust.sheen });
  return K.fur(base.hide, { sheenColor: base.sheen, ...(base.o || {}) });
}
// bloomFronds(L, K, G, body, x0, n): the Bloom's soft glowing fronds riding on the back
function bloomFronds(L, K, G, body, x0, n, step = 0.2) {
  const fr = K.glowMat('#c48dff', 0.6, K.dimGlow('#a46cff'));
  for (let i = 0; i < n; i++) {
    const s = i % 2 ? 1 : -1, x = x0 - i * step, { p } = K.onBody(body, x, s * 0.45, 0.02);
    K.tube(G, K.curve([p, [p[0] - 0.18, p[1] + 0.16, p[2] + s * 0.1], [p[0] - 0.4, p[1] + 0.1, p[2] + s * 0.24]], 4), t => 0.024 * (1 - t) + 0.008, fr, { n: 10, radial: 6 });
  }
}

// glandMat(L, K, SL, FK): thin, swollen skin over milky slurry: swirls of it and grit of crystal glowing through. FK > 1
// when it is being squeezed (spitting).
function glandMat(L, K, SL, FK) {
  const { THREE } = K;
  const tex = L.canvasTex(512, (g, n) => {
    g.fillStyle = '#222'; g.fillRect(0, 0, n, n); g.lineCap = 'round';
    L.blotches(g, n, 46, 30, 110, 0.32, '255,255,255');
    for (let i = 0; i < 30; i++) {                         // swirls of thicker slurry
      let x = L.rnd() * n, y = L.rnd() * n, a = L.rnd() * 6.28; const w = 3 + L.rnd() * 9, turn = (L.rnd() < 0.5 ? -1 : 1) * (0.2 + L.rnd() * 0.25);
      g.strokeStyle = `rgba(255,255,255,${0.22 + 0.4 * L.rnd()})`; g.lineWidth = w; g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 16; k++) { a += turn; x += Math.cos(a) * 9; y += Math.sin(a) * 9; g.lineTo(x, y); } g.stroke();
    }
    for (let i = 0; i < 700; i++) { const s = 1 + L.rnd() * 3; g.fillStyle = `rgba(255,255,255,${0.45 + 0.55 * L.rnd()})`; g.fillRect(L.rnd() * n, L.rnd() * n, s, s); }   // grit
  });
  const k = SL.k ?? 1;
  const m = new THREE.MeshPhysicalMaterial({ color: SL.skin, roughness: 0.55, metalness: 0, clearcoat: 0.2, clearcoatRoughness: 0.45, vertexColors: true,
    sheen: 0.5, sheenColor: new THREE.Color('#dcd0ea'), emissiveMap: tex, emissiveIntensity: 0.4,
    emissive: new THREE.Color(SL.core).multiplyScalar(k * FK * (K.GLOW * K.GLOW * 0.5 + (K.NIGHTISH ? 0.15 : 0.22)) / 0.4) });
  m.envMapIntensity = 0.3; m.userData.glow = K.dimGlow(SL.glow, (K.GLOW > 1 || FK > 1 ? 0.8 : 3) * Math.min(2.2, FK) * k);
  return m;
}
// sac(L, K, parent, at, r, mat, seed): a swollen, slightly lop-sided bladder (r = [rx, ry, rz]), lit from above
function sac(L, K, parent, at, r, mat, seed) {
  const { THREE } = K;
  const g = new THREE.SphereGeometry(1, 64, 36), p = g.attributes.position, col = new Float32Array(p.count * 3), v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const fold = Math.max(0, K.nz(v.x * 4 + seed, v.y * 4, v.z * 4)) ** 2;
    const q = 1 + 0.06 * K.nz(v.x * 2.4 + seed, v.y * 2.4, v.z * 2.4) - 0.035 * fold;
    p.setXYZ(i, v.x * r[0] * q, v.y * r[1] * q * (v.y < 0 ? 0.75 : 1), v.z * r[2] * q);
    const b = (0.6 + 0.4 * Math.max(0, v.y)) * (1 - 0.3 * fold); col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
  return L.mesh(g, mat, at[0], at[1], at[2], { parent });
}
// dropGeo(K, r, tail, seed): a wobbling drop of slurry, round in front (+x), drawn out into a tail behind
function dropGeo(K, r, tail, seed) {
  const { THREE } = K;
  const g = new THREE.SphereGeometry(1, 44, 28), p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const back = Math.max(0, -v.x), q = 1 + 0.1 * K.nz(v.x * 3 + seed, v.y * 3, v.z * 3) + 0.04 * K.nz(v.x * 8, v.y * 8 + seed, v.z * 8);
    const taper = 1 - 0.8 * Math.pow(back, 1.3);
    p.setXYZ(i, (v.x < 0 ? v.x * (1 + tail * back) : v.x * 0.92) * r * q, v.y * r * q * taper * 0.94, v.z * r * q * taper);
  }
  g.computeVertexNormals(); return g;
}
// glob(L, K, parent, at, dir, SL, o): the Spitter's glob of conductive crystal slurry flying along dir: a milky,
//   wobbling drop in a wet jelly skin with a white-hot heart of charge, grit of crystal in it, short sparks crawling over
//   its front, droplets shed behind. o: { r (radius), tail (how drawn out), strand: [x,y,z] (a thread back to the mouth,
//   in parent space), FK (brightness) }
function glob(L, K, parent, at, dir, SL, o = {}) {
  const { THREE } = K, r = o.r ?? 0.26, FK = o.FK ?? 1, k = SL.k ?? 1, tail = o.tail ?? 0.7, N = K.NIGHTISH;
  const D = L.group(at[0], at[1], at[2], 0, parent); D.quaternion.copy(K.frame(dir, [0, 1, 0]));
  // the heart: charge, white-hot, showing through the milk
  const heartM = K.glowMat(SL.core, 1.2 * FK * k, K.dimGlow(SL.glow, 3 * k));
  // the milk: thick, pale lilac slurry, half see-through; lit from inside at night
  const milkM = new THREE.MeshPhysicalMaterial({ color: '#' + new THREE.Color(SL.core).lerp(new THREE.Color(SL.jelly), 0.6).getHexString(), roughness: 0.35, metalness: 0,
    transparent: true, opacity: N ? 0.8 : 0.74, depthWrite: false, sheen: 0.5, sheenColor: new THREE.Color(SL.core),
    emissive: new THREE.Color(SL.core).multiplyScalar(N ? 0.9 * k : 0.12 * k * FK) });
  milkM.envMapIntensity = 0.6;
  // the film: a wet clear skin over it all (clearcoat kept under 1: lib.js turns clearcoat-1 glass into lit windows)
  const filmM = new THREE.MeshPhysicalMaterial({ color: SL.jelly, roughness: 0.08, metalness: 0, clearcoat: 0.95, clearcoatRoughness: 0.05, transparent: true, opacity: 0.32, depthWrite: false,
    emissive: new THREE.Color(SL.core).multiplyScalar(N ? 0.3 * k : 0.02) });
  filmM.envMapIntensity = 1.0;
  L.mesh(dropGeo(K, r * 0.5, tail * 0.7, 5), heartM, r * 0.1, 0, 0, { parent: D, dirt: 0, cast: false });
  const mm = L.mesh(dropGeo(K, r * 0.86, tail, 1), milkM, 0, 0, 0, { parent: D, dirt: 0, cast: false }); mm.renderOrder = 3;
  const fm = L.mesh(dropGeo(K, r, tail * 1.1, 2), filmM, -r * 0.04, 0, 0, { parent: D, dirt: 0, cast: false }); fm.renderOrder = 4;
  // grit: chips of crystal tumbling in the slurry
  const XG = { ...(SL === SLURRY_BLOOM ? K.XTAL_BLOOM : K.XTAL), k: 1.2 };
  for (let i = 0; i < 7; i++) { const a = i * 2.4, rr = r * (0.45 + 0.25 * L.rnd()); K.shard(D, [Math.cos(a) * rr * 0.5 - r * 0.2, Math.sin(a) * rr * 0.75, Math.cos(a * 1.7) * rr * 0.75], [L.rnd() - 0.5, L.rnd() - 0.5, L.rnd() - 0.5], r * 0.4, r * 0.075, XG, { collar: false }); }
  // sparks: short jagged arcs of charge crawling just under the skin, all round it
  const arcM = K.glowMat('#ffffff', (N ? 1.4 : 1.0) * k, K.dimGlow('#f4f0ff', 2.2 * k));
  for (let j = 0; j < 6; j++) {
    const th0 = j * 1.05 + 0.2, ph0 = 0.35 + 0.3 * (j % 4), pts = [];
    for (let s = 0; s <= 5; s++) {
      const t = s / 5, th = th0 + t * 0.7 + (s % 2 ? 0.16 : -0.16), ph = ph0 + t * 0.5 + (s % 2 ? 0.08 : -0.06);
      const rr = r * 0.9;                                                  // ph from the nose (+x), th round it
      pts.push([Math.cos(ph) * rr * 0.92, Math.cos(th) * Math.sin(ph) * rr * 0.94, Math.sin(th) * Math.sin(ph) * rr]);
    }
    K.tube(D, pts, () => r * 0.022, arcM, { n: 15, radial: 5, dirt: 0 });
  }
  // droplets shed behind, each with a speck of light in it
  for (let i = 0; i < 4; i++) {
    const s = r * (0.22 - i * 0.04), p = [-r * (1.5 + i * 0.42), (L.rnd() - 0.5) * r * 0.6, (i % 2 ? 1 : -1) * r * (0.2 + 0.3 * L.rnd())];
    const dm = L.mesh(dropGeo(K, Math.max(0.025, s), 0.8, i + 3), milkM, p[0], p[1], p[2], { parent: D, dirt: 0, cast: false }); dm.renderOrder = 3;
    L.mesh(dropGeo(K, Math.max(0.012, s * 0.5), 0.6, i + 7), heartM, p[0] + s * 0.1, p[1], p[2], { parent: D, dirt: 0, cast: false });
  }
  if (o.strand) {
    const w = D.worldToLocal(parent.localToWorld(new THREE.Vector3(...o.strand)));
    const pts = [[-r * 0.8, 0, 0], [w.x * 0.35, w.y * 0.35 - r * 0.12, w.z * 0.35], [w.x * 0.7, w.y * 0.7 - r * 0.08, w.z * 0.7], [w.x, w.y, w.z]];
    K.tube(D, pts, t => r * (0.16 - 0.1 * Math.sin(Math.PI * t)), heartM, { n: 24, radial: 8, dirt: 0 });
    const sm = K.tube(D, pts, t => r * (0.34 - 0.2 * Math.sin(Math.PI * t)), milkM, { n: 24, radial: 10, dirt: 0 }); sm.renderOrder = 3;
  }
  return D;
}

// ---------------------------------------------------------------------------------------------------------------
// SPITTER: counters defence lines. A thickset mole with a broad blunt head and a wide frog-like mouth, its cheeks
// swollen into two great glands of milky slurry (crystal it has eaten and ground down) that glow through the thin skin:
// from above a wide, bright "hammer" at the front, nothing like the others. Short chevrons of crystal down the back.
// ?pose=spit: it plants its hands, squeezes the glands, throws its jaws wide and a glob of conductive slurry leaves the
// mouth (c=spit-glob draws the glob alone). The glob shorts robots and turrets for a moment.
const PAL_SPIT = { hide: '#3a3436', skin: '#988482', snout: '#9a827e', lip: '#6a5150', mouth: '#4a2c30', claw: '#ddd0b4', tooth: '#e6d39c', sheen: '#9a8c88' };
function spitter(L, K, G, GL, f, v, spit) {
  const { THREE } = K;
  const pal = v === 'base' ? PAL_SPIT : { ...PAL_SPIT, ...PAL[v], lip: v === 'white' ? '#8f7b78' : PAL_SPIT.lip };
  const fat = v === 'white' ? 1.12 : v === 'rust' ? 1.05 : 1, legK = v === 'white' ? 0.8 : 1;
  const furM = coat(L, K, v, { hide: pal.hide, sheen: pal.sheen });
  const skinM = K.flesh(pal.skin), snoutM = K.flesh(pal.snout), lipM = K.flesh(pal.lip, { rough: 0.5 }), mouthM = K.flesh(pal.mouth, { rough: 0.4, cc: 0.4 });
  const clawM = K.keratin(pal.claw), toothM = K.keratin(pal.tooth, 0.35);
  const X = v === 'white' ? K.XTAL_WHITE : v === 'bloom' ? K.XTAL_BLOOM : K.XTAL;
  const SL = v === 'white' ? SLURRY_WHITE : v === 'bloom' ? SLURRY_BLOOM : SLURRY;
  const FK = spit ? 2.2 : 1;
  const S = (x, w, h, b, cy) => [x, w * fat, h * fat, b * fat, cy];
  // ---- the body: thickset, deepest at the chest, a broad short neck into a broad flat skull
  const body = K.loft(G, [
    S(-1.6, 0, 0, 0, 0.6), S(-1.49, 0.36, 0.32, 0.23, 0.61), S(-1.2, 0.6, 0.5, 0.33, 0.65), S(-0.7, 0.68, 0.57, 0.36, 0.68),
    S(-0.15, 0.68, 0.58, 0.36, 0.69), S(0.35, 0.64, 0.55, 0.35, 0.69), S(0.8, 0.56, 0.47, 0.32, 0.68), S(1.12, 0.52, 0.39, 0.29, 0.66),
    S(1.34, 0.44, 0.29, 0.23, 0.63), S(1.48, 0, 0, 0, 0.61),
  ], furM, { lump: 0.035, seed: 5, uv: 1.4 });
  K.furShells(body, furM, v === 'white' ? { n: 6, len: 0.075, density: 1, comb: 0.8, tip: 0.25 } : { n: 5, len: 0.05, density: 0.9, comb: 0.85, tip: 0.3 });

  // ---- the jaws: a broad blunt muzzle hinged at the cheeks. Walking, closed (slurry beading at the corners); spitting,
  // the upper jaw thrown up and the lower dropped, the mouth's floor and the glob in it showing from above
  const hinge = [1.16, 0.6, 0], up = spit ? 0.8 : -0.03, dn = spit ? -0.45 : 0.03;
  const J1 = L.group(hinge[0], hinge[1] + 0.02, 0, 0, G); J1.rotation.z = up;
  const J2 = L.group(hinge[0], hinge[1] - 0.06, 0, 0, G); J2.rotation.z = dn;
  K.seg(J1, [0.08, 0.08, 0], 0.36, 0.22, 0.5 * fat, furM, { lump: 0.04, flat: 0.6 });                  // furred top of the head and muzzle
  K.seg(J1, [0.36, 0.03, 0], 0.28, 0.16, 0.46 * fat, snoutM, { lump: 0.03, flat: 0.7 });               // naked lip, broad and rounded
  K.seg(J1, [0.58, 0.1, 0], 0.09, 0.075, 0.16, snoutM, { lump: 0.02 });                               // the nose pad
  for (const s of [-1, 1]) L.sphere(0.028, K.plain('#120c0c', 0.5), 0.65, 0.14, s * 0.065, { parent: J1, dirt: 0 });
  K.seg(J2, [0.3, -0.03, 0], 0.32, 0.12, 0.44 * fat, lipM, { lump: 0.03, flat: 0.2 });                // lower jaw, a heavy chin
  K.seg(J2, [0.3, 0.05, 0], 0.28, 0.035, 0.34 * fat, mouthM, { lump: 0.02 });                         // the mouth's floor, a fat tongue
  for (const s of [-1, 1]) {                                                                           // teeth along both rims
    for (let k = 0; k < 4; k++) { const a = 0.25 + k * 0.32, x = 0.36 + 0.26 * Math.cos(a), z = s * 0.42 * fat * Math.sin(a);
      K.claw(J1, [x, -0.04, z], [0.15, -1, 0], [1, 0, 0], 0.07 + (k === 0 ? 0.05 : 0), 0.018, 0.012, toothM, 0.15);
      K.claw(J2, [x - 0.04, 0.04, z * 0.95], [0.15, 1, 0], [1, 0, 0], 0.06, 0.016, 0.011, toothM, -0.15); }
  }
  // whiskers out of the lip
  const whM = K.plain(v === 'white' ? '#f6f6f2' : '#cfc6bc', 0.6);
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) { const x = 0.46 + k * 0.05, z = s * 0.38 * fat; K.tube(J1, [[x, 0.06, z], [x + 0.08, 0.08, z + s * 0.22], [x + 0.1 + k * 0.03, 0.04, z + s * (0.42 + k * 0.05)]], t => 0.011 * (1 - t) + 0.003, whM, { n: 8, radial: 4 }); }
  K.eyes(G, [1.12, 0.86, 0], 0.27 * fat, 0.028);
  K.tail(G, { base: [-1.55, 0.62, 0], tip: [-2.02, 0.48, 0.04], r: 0.06, mat: v === 'white' ? furM : skinM, bristle: K.plain('#8a7f78', 0.7) });

  // ---- the glands: two great cheek pouches of slurry, swelling the head out behind the jaw like a hamster's full cheeks
  // and tapering forward to the corners of the mouth; their rear sinks under the shoulder fur, so they read as part of the
  // head (two loose round balls beside it read as an insect's eyes). Squeezed flatter when it spits.
  const gM = glandMat(L, K, SL, FK), sq = spit ? 0.86 : 1;
  for (const s of [-1, 1]) {
    sac(L, K, G, [0.72, 0.64, s * 0.56 * fat], [0.6 * sq, 0.34 * sq, 0.4 * sq * fat], gM, s);
    sac(L, K, G, [1.1, 0.6, s * 0.48 * fat], [0.3 * sq, 0.25 * sq, 0.27 * sq * fat], gM, s + 3);
    // the shoulder fur grown over the pouch's back end
    K.seg(G, [0.3, 0.7, s * 0.5 * fat], 0.36, 0.34, 0.36 * fat, furM, { lump: 0.08, seed: s * 4, flat: 0.4 });
    // a duct from each gland to the corner of the mouth, glowing through
    K.tube(G, [[1.12, 0.64, s * 0.56 * fat], [1.24, 0.6, s * 0.48 * fat], [1.38, 0.6, s * 0.4 * fat]], t => 0.08 * (1 - 0.4 * t), gM, { n: 12, radial: 10 });
    // beads of slurry at the corners of the mouth (walking), a spray of it (spitting)
    const bead = K.glowMat(SL.core, 0.6 * (SL.k ?? 1), K.dimGlow(SL.glow, 1.6 * (SL.k ?? 1)));
    if (!spit) { L.sphere(0.05, bead, 1.48, 0.55, s * 0.4 * fat, { parent: G, dirt: 0, cast: false }); L.sphere(0.032, bead, 1.53, 0.5, s * 0.35 * fat, { parent: G, dirt: 0, cast: false }); }
  }

  // ---- limbs: middling spade hands tucked under the glands (planted wide and braced when it spits), small hind feet
  for (const s of [-1, 1]) {
    K.forelimb(GL, { side: s, f, plant: spit, shoulder: [0.5, 0.5, s * 0.24 * fat], wrist: spit ? [0.92, 0.28, s * 0.9 * fat] : [0.78, 0.32, s * 0.78 * fat], palm: 0.48, claw: 0.42, armR: 0.21 * fat,
      stride: 0.18 * legK, lift: 0.13, skin: skinM, arm: furM, clawMat: clawM, splay: spit ? 0.95 : 0.7, tilt: 0.35, droop: spit ? 0.2 : 0.06 });
    K.hindlimb(GL, { side: s, f, plant: spit, hip: [-1.0, 0.45, s * 0.24 * fat], foot: spit ? [-1.32, 0.08, s * 0.62 * fat] : [-1.25, 0.08, s * (0.5 + 0.05 * legK) * fat], len: 0.34, r: 0.14 * fat,
      stride: 0.17 * legK, lift: 0.12, skin: skinM, leg: furM, clawMat: clawM, out: 0.75 });
  }

  // ---- regional extras
  if (v === 'rust') K.scales(G, body, { x0: -1.35, x1: 0.5, rows: 8, cols: 5, amax: 0.5, size: 0.42, width: 0.82, mat: K.crust(PAL.rust.plate, { rough: 0.8 }), lift: 0.28, skip: (i, j) => j === 2 && i % 2 === 0 && i > 0 && i < 7 });
  if (v === 'bloom') bloomFronds(L, K, G, body, 0.2, 8);

  // ---- the crystal: short chevrons down the back (pairs leaning out to either side), the biggest behind the glands
  const n = v === 'rust' ? 0.8 : v === 'white' ? 0.85 : 1, collar = v === 'white' ? furM : rawMat(K, v);
  const chev = v === 'rust' ? [[0.2, 0.0, 0.58, 0.08], [-0.6, 0.0, 0.52, 0.075], [-1.25, 0.0, 0.4, 0.06]]
    : [[0.42, 0.3, 0.62, 0.09], [0.36, -0.32, 0.56, 0.09], [-0.08, 0.35, 0.52, 0.085], [-0.14, -0.33, 0.56, 0.085], [-0.56, 0.37, 0.44, 0.075], [-0.62, -0.35, 0.48, 0.075], [-1.0, 0.3, 0.36, 0.065], [-1.04, -0.29, 0.32, 0.065], [-1.3, 0.02, 0.26, 0.055], [0.12, 0.02, 0.3, 0.06]];
  K.spineShards(G, body, chev.map(([x, a, l, r], i) => [x, a, l * n, r, 0.9 + 0.08 * (i % 3), 2.2]), X, { collarMat: collar });

  // ---- spitting: the glob just leaving the mouth, a thread of slurry still joining them
  if (spit) {
    const mid = (up + dn) / 2, d = [Math.cos(mid), Math.sin(mid), 0];
    const at = [hinge[0] + d[0] * 1.02, hinge[1] + d[1] * 1.02, 0];
    glob(L, K, G, at, d, SL, { r: 0.3, tail: 0.8, FK: 1.4, strand: [hinge[0] + d[0] * 0.42, hinge[1] + d[1] * 0.42 - 0.02, 0] });
  }
  centreOn(K, G, [body.mesh]);
}

// c=spit-glob: the glob on its own, in flight (+x), centred on its core
function spitGlob(L, K, G, v) {
  const SL = v === 'white' ? SLURRY_WHITE : v === 'bloom' ? SLURRY_BLOOM : SLURRY;
  glob(L, K, G, [0, 0.5, 0], [1, 0, 0], SL, { r: 0.3, tail: 1.1, FK: 1.4 });
}

// ---------------------------------------------------------------------------------------------------------------
// DELVER: counters walls and turtling: it tunnels under them and comes up behind. The true digger: long and low, a
// sleek velvet torpedo, its huge spade hands set right beside the head and turned out sideways like oars, every claw
// long and caked with soil. Its head is sheathed in a plate of horn grown hard with crystal, tapering to a chisel snout
// and a crystal point: a drill. Its shards lie flat along its flanks, swept back so they never snag in the tunnel.
// ?pose=surface: only the head, the hands and a ring of thrown-up soil show above the ground.
const PAL_DELV = { hide: '#333034', skin: '#9a8884', snout: '#a08a86', plate: '#bdb09a', claw: '#e2d6bc', sheen: '#aaa2a6' };
function delver(L, K, G, GL, f, v, surface) {
  const { THREE } = K;
  const pal = v === 'base' ? PAL_DELV : { ...PAL_DELV, ...PAL[v], plate: v === 'rust' ? '#8a5638' : v === 'white' ? '#e4e2dc' : v === 'bloom' ? '#a59ab0' : PAL_DELV.plate };
  const fat = v === 'white' ? 1.12 : v === 'rust' ? 1.05 : 1, legK = v === 'white' ? 0.8 : 1;
  const furM = coat(L, K, v, { hide: pal.hide, sheen: pal.sheen, o: { sheen: 1, rough: 0.8 } });
  const skinM = K.flesh(pal.skin), clawM = K.keratin(pal.claw, 0.45);
  const X = v === 'white' ? K.XTAL_WHITE : v === 'bloom' ? K.XTAL_BLOOM : K.XTAL;
  const plateM = K.keratin('#ffffff', 0.55);
  const soilM = [K.crust('#3e3026', { rough: 0.97 }), K.crust('#33271f', { rough: 0.97 }), K.crust('#4a3a2e', { rough: 0.97 })], caked = K.crust('#7a6450', { rough: 0.97 });
  const clodGeo = (s, k) => { const g = new THREE.DodecahedronGeometry(1, 1), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const q = 1 + 0.3 * K.nz(p.getX(i) * 2 + k, p.getY(i) * 2, p.getZ(i) * 2); p.setXYZ(i, p.getX(i) * q, p.getY(i) * q, p.getZ(i) * q); } g.scale(s, s * 0.7, s * (0.8 + 0.4 * L.rnd())); g.computeVertexNormals(); return g; };
  const S = (x, w, h, b, cy) => [x, w * fat, h * fat, b * fat, cy];
  // the whole animal is built in B (body space: +x forward). Walking, B is G; surfacing, B is the front half, pitched up
  // out of a hole at the origin.
  const B = surface ? L.group(-0.3, -0.95, 0, 0, G) : G;
  if (surface) B.rotation.z = 0.55;
  const st = [
    S(-2.75, 0, 0, 0, 0.5), S(-2.64, 0.3, 0.26, 0.2, 0.5), S(-2.35, 0.5, 0.4, 0.28, 0.52), S(-1.65, 0.6, 0.46, 0.3, 0.54),
    S(-0.6, 0.62, 0.47, 0.3, 0.55), S(0.4, 0.62, 0.47, 0.3, 0.55), S(1.05, 0.56, 0.43, 0.29, 0.54), S(1.55, 0.42, 0.34, 0.24, 0.52),
    S(1.92, 0.27, 0.22, 0.17, 0.49), S(2.12, 0, 0, 0, 0.47),
  ];
  // soil dust on the lower flanks and the rump
  const dust = (x, a) => { const s = Math.abs(Math.sin(a)), d = K.sstep(0.55, 0.95, s) * (0.5 + 0.5 * K.nz(x * 2.5, a * 2, 4)) + K.sstep(-1.4, -2.6, x) * 0.35 * Math.max(0, K.nz(x * 4, a * 3, 1)); const q = Math.min(1, d) * (v === 'white' ? 0.3 : 1); return [1 + 1.1 * q, 1 + 0.8 * q, 1 + 0.5 * q]; };
  const body = K.loft(B, surface ? [S(0.62, 0, 0, 0, 0.55), S(0.78, 0.5, 0.4, 0.26, 0.55), ...st.slice(6)] : st, furM, { lump: 0.03, seed: 9, uv: 1.4, col: (x, a) => dust(x, a) });
  K.furShells(body, furM, v === 'white' ? { n: 6, len: 0.075, density: 1, comb: 0.8, tip: 0.25 } : { n: 5, len: 0.04, density: 0.95, comb: 0.95, tip: 0.35 });

  // ---- the head plate: horn grown hard over the brow and down the snout (pale, ridged with growth lines, dark at the
  // root), tapering to a chisel; a crystal point on its tip and a keel of small crystals down its ridge
  const plateCol = new THREE.Color(pal.plate);
  const shield = K.crustSaddle(B, body, { x0: 1.02, x1: 2.12, amax: 1.25, thick: 0.15, crack: 0, mat: plateM,
    colour: (x, a) => { const ring = 0.86 + 0.14 * Math.sin(x * 34 + 2 * K.nz(a * 2, x, 1)), root = K.sstep(1.15, 1.6, x); const k = (0.45 + 0.55 * root) * ring; return [plateCol.r * k, plateCol.g * k, plateCol.b * k]; } });
  const horn = K.loft(B, [[1.78, 0, 0, 0, 0.6], [1.84, 0.21, 0.13, 0.11, 0.6], [2.05, 0.2, 0.12, 0.1, 0.57], [2.3, 0.14, 0.085, 0.07, 0.53], [2.52, 0.07, 0.045, 0.035, 0.5], [2.66, 0, 0, 0, 0.48]], plateM,
    { lump: 0.02, seed: 2, p: 2.6, col: (x) => { const ring = 0.85 + 0.15 * Math.sin(x * 40), k = (0.85 + 0.15 * K.sstep(1.8, 2.5, x)) * ring; return [plateCol.r * k, plateCol.g * k, plateCol.b * k]; }, shade: (x, side) => 1 - 0.45 * K.sstep(0.4, 0.95, side) });
  K.shard(B, [2.5, 0.5, 0], [1, -0.12, 0], 0.62, 0.11, { ...X, k: (X.k ?? 1) * 1.15 }, { collar: false });            // the drill point
  for (const [x, l, r] of [[2.2, 0.32, 0.055], [1.92, 0.34, 0.06], [1.62, 0.3, 0.055]]) { const y = shield.top(x, 0)[1]; K.shard(B, [x - 0.12, y - 0.05, 0], [1, 0.32, 0], l, r, X, { collar: false }); }   // the keel
  // whiskers from under the plate
  const whM = K.plain(v === 'white' ? '#f6f6f2' : '#cfc6bc', 0.6);
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) { const x = 2.0 + k * 0.08, z = s * (0.2 - k * 0.03); K.tube(B, [[x, 0.44, z], [x + 0.06, 0.45, z + s * 0.22], [x + 0.04 + k * 0.03, 0.41, z + s * (0.42 + k * 0.06)]], t => 0.011 * (1 - t) + 0.003, whM, { n: 8, radial: 4 }); }

  // ---- the shards: pressed flat along the upper flanks in two lines, swept right back (they never snag in the tunnel)
  const n = v === 'rust' ? 0.8 : v === 'white' ? 0.85 : 1, collar = v === 'white' ? furM : rawMat(K, v);
  const rows = v === 'rust' ? [[0.7, 0, 0.62], [-0.3, 0.04, 0.66], [-1.3, -0.03, 0.56]]
    : [[0.8, 0.5, 0.6], [0.62, -0.54, 0.68], [0.2, 0.57, 0.72], [-0.02, -0.58, 0.62], [-0.42, 0.6, 0.66], [-0.7, -0.57, 0.7], [-1.05, 0.56, 0.56], [-1.32, -0.55, 0.6], [-1.68, 0.5, 0.46], [-1.92, -0.46, 0.4], [-0.22, 0.32, 0.3], [-1.0, -0.3, 0.28]];
  const flat = rows.filter(() => !surface).map(([x, a, l], i) => [x, a, l * n, (v === 'rust' ? 0.06 : 0.075) * (l < 0.35 ? 0.75 : 1), 2.4 + 0.3 * ((i * 7) % 3) / 2, 0.1]);
  K.spineShards(B, body, flat, X, { collarMat: collar });

  if (!surface) {
    K.tail(G, { base: [-2.7, 0.52, 0], tip: [-3.1, 0.42, 0.03], r: 0.055, mat: v === 'white' ? furM : skinM, bristle: K.plain('#8a7f78', 0.7) });
    if (v === 'rust') K.scales(G, body, { x0: -2.4, x1: 1.0, rows: 11, cols: 5, amax: 0.5, size: 0.4, width: 0.82, mat: K.crust(PAL.rust.plate, { rough: 0.8 }), lift: 0.22, skip: (i, j) => j === 2 && i % 3 === 1 });
    if (v === 'bloom') bloomFronds(L, K, G, body, 0.2, 10, 0.24);
  }

  // ---- the hands: huge spades right beside the head, turned out sideways like oars, claws long and caked with soil
  const hand = (s, o) => {
    const r = K.forelimb(o.parent, { side: s, f, palm: 0.68, claw: 0.74, armR: 0.25 * fat, clawW: 1.15, stride: 0.17 * legK, lift: 0.12, skin: skinM, arm: furM, clawMat: clawM, fan: 0.4, curl: 0.28, ...o });
    for (let k = 0; k < 5; k++) { const a = -0.8 + k * 0.4, x = 0.68 * (0.86 + 0.1 * L.rnd()), sz = 0.028 + 0.02 * L.rnd(); L.mesh(clodGeo(sz, k + s * 10), caked, x, 0.0, Math.sin(a) * 0.68 * 0.36, { parent: r.hand, dirt: 0 }); }
    return r;
  };
  if (!surface) for (const s of [-1, 1]) {
    hand(s, { parent: GL, shoulder: [1.18, 0.42, s * 0.4 * fat], wrist: [1.36, 0.3, s * 0.62 * fat], splay: 1.05, swing: 0.22, tilt: 0.75, droop: 0.08, armR: 0.23 * fat });
    K.hindlimb(GL, { side: s, f, hip: [-2.2, 0.42, s * 0.28 * fat], foot: [-2.48, 0.08, s * (0.5 + 0.06 * legK) * fat], len: 0.4, r: 0.14 * fat,
      stride: 0.16 * legK, lift: 0.1, skin: skinM, leg: furM, clawMat: clawM, out: 0.8 });
  }

  if (surface) {
    // ---- surfacing: the hands planted on the rim of the hole, claws dug into the soil
    for (const s of [-1, 1]) hand(s, { parent: G, plant: true, shoulder: [0.3, -0.25, s * 0.34], wrist: [0.5, 0.3, s * 0.92], splay: 0.85, tilt: 0.55, droop: 0.32 });
    // the first shards of the shoulders, just breaking out of the hole behind the head
    for (const s of [-1, 1]) for (const [dx, l] of [[0, 0.5], [-0.32, 0.4]]) K.shard(G, [-0.05 + dx, -0.12, s * 0.3], [-0.9, 0.75, s * 0.35], l * n, 0.07, X, { collar: false });
    // ---- the ring of thrown-up soil: a crumbly ring heaped round a dark hole, lumps of it fallen on the head and hands
    const RI = 0.8, RP = 1.1, RO = 1.85;
    const prof = (r) => r < RI ? -0.6 + 0.6 * K.sstep(0.15, RI, r) : r < RP ? 0.5 * K.sstep(RI - 0.08, RP, r) : 0.5 * (1 - K.sstep(RP, RO, r));
    {
      const NR = 48, NA = 128, pos = [], col = [], idx = [];
      for (let j = 0; j <= NR; j++) for (let i = 0; i <= NA; i++) {
        const a = i / NA * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
        const rmax = RO * (1 + 0.1 * K.nz(ca * 1.6, 3.1, sa * 1.6)) * (1 + 0.12 * Math.max(0, ca)), r = 0.01 + (j / NR) * (rmax - 0.01), rn = r / rmax * RO;
        let h = prof(rn) * (1 + 0.25 * K.nz(ca * 2, 1.3, sa * 2)) + (rn > RI ? 0.06 * K.nz(ca * r * 6, 4, sa * r * 6) + 0.04 * K.nz(ca * r * 13, 8, sa * r * 13) : 0);
        pos.push(ca * r, h, sa * r);
        const fresh = [0.11, 0.08, 0.06], dry = [0.26, 0.21, 0.16], deep = [0.015, 0.012, 0.014];
        const mix = (p, q, t) => p.map((w, k) => w + (q[k] - w) * Math.max(0, Math.min(1, t)));
        let c = rn < RI ? mix(deep, fresh, (rn - 0.55) / (RI - 0.55)) : mix(fresh, dry, (rn - RP - 0.2) / 0.5);
        const nn = 0.8 + 0.3 * K.nz(ca * r * 3, 5, sa * r * 3) + 0.25 * K.nz(ca * r * 12, 9, sa * r * 12); col.push(...c.map(w => w * nn * 1.35));
      }
      for (let j = 0; j < NR; j++) for (let i = 0; i < NA; i++) { const a = j * (NA + 1) + i, b = a + 1, c = a + NA + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      const uv = []; for (let k = 0; k < pos.length; k += 3) uv.push(pos[k] / 1.5, pos[k + 2] / 1.5); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx); g.computeVertexNormals();
      L.mesh(g, K.crust('#ffffff', { rough: 0.95, ns: 0.8 }), 0, 0, 0, { parent: G });
    }
    const ringM = [K.crust('#5a4636', { rough: 0.97 }), K.crust('#4a3a2e', { rough: 0.97 }), K.crust('#6e5844', { rough: 0.97 })];
    for (let i = 0; i < 200; i++) {      // clods all over the ring, the biggest on its crest
      const a = L.rnd() * Math.PI * 2, r = RI + 0.05 + Math.pow(L.rnd(), 1.2) * (RO - RI), s = 0.03 + Math.pow(L.rnd(), 2.2) * 0.13 * (r < RP + 0.3 ? 1.2 : 0.7);
      L.mesh(clodGeo(s, i), ringM[i % 3], Math.cos(a) * r, prof(r) + s * 0.15, Math.sin(a) * r, { parent: G, dirt: 0.1, dirtH: s, ry: L.rnd() * 6.28 });
    }
    for (let i = 0; i < 7; i++) { const p = [1.0 + L.rnd() * 0.6, 0, (L.rnd() - 0.5) * 0.4]; const s = 0.035 + 0.035 * L.rnd(); const w = B.localToWorld(new THREE.Vector3(p[0], body.top(p[0], p[2]) + s * 0.4, p[2])); G.worldToLocal(w); L.mesh(clodGeo(s, i + 40), ringM[i % 3], w.x, w.y, w.z, { parent: G, dirt: 0 }); }
    // chips of crystal kicked out with the soil
    for (let i = 0; i < 6; i++) { const a = L.rnd() * Math.PI * 2, r = RP + L.rnd() * 0.5; K.shard(G, [Math.cos(a) * r, prof(r) - 0.02, Math.sin(a) * r], [L.rnd() - 0.5, 0.5, L.rnd() - 0.5], 0.14 + L.rnd() * 0.1, 0.04, X, { collar: false }); }
    return;                                          // the hole sits in the middle of the frame
  }
  G.position.x = -GROW * (3.12 - 3.1) / 2;           // centred on the whole length, tail tip (-3.1) to drill point (3.12)
}

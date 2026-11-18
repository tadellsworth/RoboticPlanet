// The Murmur, built to LORE.md's art brief (see the kit, murmur_moleskit.js): burrowing mammals from the star-nosed mole
// and the naked mole-rat. Low, heavy, barrel-chested (a mole crossed with a badger), near-black velvet fur dusted with
// Crystal grit that glints violet, huge spade hands with five long fingers turned outward, no eyes, a star of tendrils in
// place of a nose (gathered while they walk, flared open and pulsing when they find power), and eaten Crystal split out
// through the shoulders and spine like broken geodes: pale lilac, glowing violet when they are full, dull when hungry.
//   ?c=swarmer | drainer | brute | spitter | sapper | spit-glob | burrow
//       swarmer is the game's Scuttler (the brief's Runners), brute its Brute (the Breakers), drainer the Leech
//   ?v=base | rust | white | bloom      regional variants (Scuttler, Spitter, Sapper): Rust armoured in ironstone plates,
//                                       the Polar Caps pale, shaggy and slow, Bloom veined and glowing violet
//   ?f=0..3                             walking frame: diagonal pairs (left fore with right hind); only the limbs move
//   ?charge=0..1                        how full of charge (default 0.75): the crystal glows when full, dims when hungry
//   ?pose=sense                         any class standing still, its star flared open and pulsing: it has found power
//   ?pose=feed  (or ?feed=1)            Leech feeding: star pressed to the power and lit, hands planted, threads of charge
//   ?pose=spit                          Spitter spitting: jaws wide under the star, a clot of charged grit leaving the mouth
//   ?pose=surface                       Sapper breaking the surface: head, hands and a ring of thrown-up soil
//   c=spit-glob                         the Spitter's clot on its own (a projectile the game can draw), flying +x
//   c=spit-shards                       the Spitter's volley of crystal shards on its own, flying +x (with pose=spit,
//                                       ?shot=shards puts the volley in its mouth in place of the clot)
//   c=sapper&pose=dig | heave           the Sapper digging in (its front half under the ground, soil thrown back) or
//                                       under it (only the heaving ground shows: the tell at the head of its ridge)
//   c=drainer&pose=feed&charge=0..1     the Leech feeding, as full as `charge` (without it, full): it brightens as it drinks
//   The game's action loops (each ?f= a frame; js/render.js drawCritter plays them):
//   c=drainer&pose=feed&f=0..3          feeding: the star pulsing open and lit, the sac swelling with each draw
//   c=spitter&pose=spit&f=0..3          wind-up (head back, pouches swollen and burning), the spit (the volley leaving),
//                                       recoil (head thrust on, pouches emptied), recovering
//   c=sapper&pose=dig&f=0..3            digging in: the spade hands throwing soil back in turn, clods in the air
//   c=sapper&pose=heave&f=0..3          under the ground: the heave rising and splitting as it goes
//   c=sapper&pose=up&f=0..4             coming up: the ground bursting, hands and star breaking through, head and
//                                       shoulders out, climbing out of its hole
//   c=burrow&s=1|2|3                    the Burrow (the nest) at its three growth levels (the game's nest-1..3)
//   c=burrow&s=4                        the Deep's mound, the Hollow's heart (LORE.md): bigger than any nest, nine spires
//                                       and an outer ring, eight tunnels, satellite molehills, and the Deep's tendril star
//                                       risen high out of the throat. Rendered at 1536 with the whole scene at DEEP_K of
//                                       its size, so the canvas covers more ground (see renderer/preview/hollow_specs.json)
//   ?hero=1                             a 3/4 perspective presentation shot on a patch of ground (the Leech feeding gets
//                                       the power line it is drinking from)
//   ?ground=0                           a hero shot without its patch of ground (to measure where the animal sits)
//   ?hi=1|2                             render 2x / 4x bigger (presentation)
//   ?tod=night|evening|morning          time of day (lib.js); at night only the creatures' own light shows
// Sprites follow the robots: orthographic straight down, facing +x, centred on the body, no ground and no shadow (the
// game draws those), sun from the top-left, toned like robkit.js. The models share one world scale (a Brute is twice a
// Scuttler); SPRITE_W is the frame width in world units, designed to be drawn at tile * 0.078 * W (the robots' 0.06
// per unit, times 1.3 so the smallest still reads); the game draws the Scuttler frame 0.62 of a tile wide and the Brute
// 0.82 (drawCritter in js/render.js). The Burrow uses the building camera (like nest.js) on the 512
// canvas. Rules from the brief: fur, skin, soil and stone only; no shells, mandibles, extra legs, wings or slime.
import { molekit } from './murmur_moleskit.js';

const P = new URLSearchParams(location.search);
const C = P.get('c') || 'swarmer', HI = +(P.get('hi') || 0), HERO = !!+(P.get('hero') || 0);
export const config = C === 'burrow' ? (+(P.get('s')) === 4 ? { pad: false, size: 1536 } : { pad: false }) : { pad: false, size: [512, 1024, 2048][HI] };
// the Deep's mound (s=4) is built 1.25 times a nest-3, then the whole scene drawn at this fraction so it fits the frame
export const DEEP_K = 0.5;
export const SPRITE_W = { swarmer: 5.8, drainer: 7.6, brute: 11.4, spitter: 6.8, sapper: 8.4, 'spit-glob': 2.6, 'spit-shards': 3.2 };
// every model is built at one world scale, then grown by this much (so the game's 0.078 per unit gives these sizes)
const GROW = 1.2;

export default function (L) {
  const K = molekit(L);
  const f = +(P.get('f') || 0), V = P.get('v') || 'base';
  const POSE = P.get('pose') || (+(P.get('feed') || 0) ? 'feed' : '');
  L.seed({ swarmer: 8100, drainer: 8200, brute: 8300, burrow: 8400, spitter: 8500, sapper: 8600, 'spit-glob': 8700, 'spit-shards': 8800 }[C] + (V === 'base' ? 0 : V.length));
  if (C === 'burrow') return burrow(L, K, Math.max(1, Math.min(4, +(P.get('s') || 3))));
  const W = SPRITE_W[C];
  const heroCams = {
    swarmer: { pos: [6.4, 3.9, 7.4], at: [0.15, 0.55, 0.1], fov: 30 },
    drainer: { pos: [8.6, 5.0, 9.6], at: [0.35, 0.7, 0.1], fov: 31 },
    brute: { pos: [14.6, 6.8, 12.2], at: [0.6, 1.25, 0.3], fov: 37 },
    spitter: { pos: [7.4, 4.3, 8.2], at: [0.25, 0.6, 0.1], fov: 31 },
    sapper: { pos: [9.2, 4.6, 9.6], at: [0.3, 0.5, 0.1], fov: 32 },
    'spit-glob': { pos: [2.6, 1.6, 2.9], at: [0, 0.4, 0], fov: 30 },
    'spit-shards': { pos: [3.0, 1.8, 3.3], at: [0, 0.4, 0], fov: 30 },
  };
  K.camera(W, HERO && heroCams[C]);
  if (HERO && P.get('ground') !== '0') K.heroGround(W);
  const G = L.group(0, 0, 0), GL = L.group(0, 0, 0, 0, G);       // GL holds the moving limbs
  G.scale.setScalar(GROW);
  // every class centres itself on its body alone (centreOn), so the walk never jitters and a special pose stays
  // registered with the walk frames: the game can swap sprites without a jump
  let body;
  if (C === 'swarmer') body = scuttler(L, K, G, GL, f, V, POSE);
  else if (C === 'drainer') body = leech(L, K, G, GL, f, POSE);
  else if (C === 'brute') body = brute(L, K, G, GL, f, POSE);
  else if (C === 'spitter') body = spitter(L, K, G, GL, f, V, POSE);
  else if (C === 'sapper') body = sapper(L, K, G, GL, f, V, POSE);
  else if (C === 'spit-shards') { shardVolley(L, K, G, [0.3, 0.5, 0], [1, 0, 0], V); return; }
  else { spitGlob(L, K, G, V); return; }
  if (body) centreOn(K, G, [body.mesh]);
}

// ---------------------------------------------------------------------------------------------------------------
// palettes. Near-black velvet, the naked skin of the hands and muzzle a dull grey-mauve (pale enough that the hands read
// from above, never a team colour), the star a fleshy grey-pink, the nails pale horn.
const PAL = {
  base:  { hide: '#19161b', sheen: '#6e6680', skin: '#857681', muzzle: '#6f6068', star: '#b48f9b', hub: '#7c5e68', nail: '#d9cdb8', tooth: '#e4d6b0' },
  rust:  { hide: '#1f1511', sheen: '#7c6258', skin: '#87736b', muzzle: '#715e58', star: '#b6928e', hub: '#7a5c58', nail: '#dcc8a8', tooth: '#e4d0a4', plate: '#6a3a26' },
  white: { hide: '#c3c6cb', sheen: '#ffffff', skin: '#b1a4a8', muzzle: '#a39398', star: '#d0b4ba', hub: '#9c828a', nail: '#eee8dc', tooth: '#efe6c4' },
  bloom: { hide: '#1a1420', sheen: '#7c6892', skin: '#7f6c87', muzzle: '#6a5872', star: '#b28cba', hub: '#76587e', nail: '#d6ccc4', tooth: '#e0d4b0' },
};
const xtal = (K, v) => (v === 'white' ? K.XTAL_WHITE : v === 'bloom' ? K.XTAL_BLOOM : K.XTAL);
// the star by pose: gathered while it walks, flared and lit when it has found power
const STAR = { '': { open: 0.42, glow: 0 }, sense: { open: 1, glow: 0.75 }, feed: { open: 1, glow: 1 }, spit: { open: 0.85, glow: 0.5 }, surface: { open: 0.95, glow: 0.6 } };

// coat(L, K, v, o): the fur for a regional variant. The Bloom ones carry the Bloom's root-veins under the skin, glowing
// violet (with the grit drawn into the same map); the the Polar Caps ones are pale and shaggy.
function coat(L, K, v, o = {}) {
  const pal = PAL[v];
  if (v === 'bloom') {
    const veins = L.canvasTex(1024, (g, n) => {
      g.fillStyle = '#000'; g.fillRect(0, 0, n, n); g.lineCap = 'round';
      const branch = (x, y, a, w, len, d) => {
        for (let k = 0; k < len; k++) {
          const nx = x + Math.sin(a) * 9, ny = y + Math.cos(a) * 9;
          for (const ox of [-n, 0, n]) { g.strokeStyle = `rgba(255,255,255,${0.4 + 0.6 * w / 3})`; g.lineWidth = w; g.beginPath(); g.moveTo(x + ox, y); g.lineTo(nx + ox, ny); g.stroke(); }
          x = nx; y = ny; a += (L.rnd() - 0.5) * 0.6; w = Math.max(0.7, w * 0.975);
          if (d < 3 && L.rnd() < 0.07) branch(x, y, a + (L.rnd() < 0.5 ? -0.9 : 0.9), w * 0.7, len - k, d + 1);
        }
      };
      for (let i = 0; i < 9; i++) branch((i + L.rnd() * 0.7) / 9 * n, n * L.rnd() * 0.2, (L.rnd() - 0.5) * 0.3, 2.6, 110, 0);
      g.globalAlpha = 0.35; g.scale(2, 2); K.gritSpecks(g, n / 2, 'e'); g.globalAlpha = 1;
    });
    // no glow-pass colour: the veins glow as lines in the fur, without floodlighting the whole animal at night
    return K.fur(pal.hide, { sheenColor: pal.sheen, emissiveMap: veins, emissive: '#a95cff', ek: 0.6, ...o });
  }
  if (v === 'white') return K.fur(pal.hide, { coarse: true, sheen: 1, sheenColor: pal.sheen, rough: 0.92, grit: 0.45, gritColor: '#a090ff', ...o });
  return K.fur(pal.hide, { sheenColor: pal.sheen, ...o });
}
const shells = (K, body, furM, v, o = {}) => K.furShells(body, furM, v === 'white' ? { n: 6, len: 0.075, density: 1, comb: 0.8, tip: 0.25, ...o.white } : { n: 5, len: 0.045, density: 0.9, comb: 0.9, tip: 0.3, ...o.base });

// face(L, K, G, o): the muzzle and the star on its end. o: { base, tip, r (muzzle radius), r0, len (the star), tilt (how
// far the star faces up, rad), pose, pal, parent } -> the star's group
function face(L, K, G, o) {
  const pal = o.pal, st = { ...STAR[o.pose || ''], ...(o.star || {}) }, par = o.parent || G;
  K.muzzle(par, { base: o.base, tip: o.tip, r: o.r, skin: K.hide(pal.muzzle, { ns: 0.8 }) });
  const t = o.tilt ?? 0.3, d = [Math.cos(t), Math.sin(t), 0];
  return K.star(par, { at: [o.tip[0] + d[0] * o.r * 0.25, o.tip[1] + d[1] * o.r * 0.25, o.tip[2]], dir: d, r0: o.r0, len: o.len, open: st.open, glow: st.glow, skin: pal.star, hub: pal.hub, seed: o.seed ?? 1 });
}

// plan(o): the body plan they all share, tail to nose: a rounded rump, the waist, a deep barrel chest under a hump of
// shoulder (the widest and tallest part, well forward, as on a badger), a pinch of neck and a low wedge of a head.
// o: { x0 (tail end), x1 (nose end), w (chest half-width), h (chest height above the centre line), b (depth below it),
// cy (centre line at the chest), hip (rump width / chest), rise (rump height / chest), head (head width / chest),
// drop (how much lower the head is carried), fat } -> loft stations
function plan(o) {
  const L = o.x1 - o.x0, fat = o.fat ?? 1, hip = o.hip ?? 0.66, rise = o.rise ?? 0.74, hd = o.head ?? 0.5, drop = o.drop ?? 0.1 * o.h;
  //        u      width              height             below              centre line
  const T = [[0, 0, 0, 0, 0], [0.035, 0.45 * hip, 0.45 * rise, 0.5, 0.02], [0.13, 0.82 * hip, 0.8 * rise, 0.72, 0.03], [0.3, hip, rise, 0.86, 0.05],
    [0.48, 0.87, 0.88, 0.95, 0.08], [0.62, 1, 1, 1, 0.1], [0.72, 0.97, 0.95, 0.97, 0.08], [0.81, 0.74 * (1 + hd) / 1.5, 0.7, 0.78, 0],
    [0.89, hd * 1.02, 0.5, 0.62, -0.5], [0.955, hd * 0.66, 0.32, 0.44, -0.85], [1, 0, 0, 0, -1]];
  return T.map(([u, w, h, b, c]) => [o.x0 + L * u, o.w * w * fat, o.h * h * fat, o.b * b * fat, o.cy + (c >= 0 ? c * o.h * 0.25 : c * drop)]);
}

// centreOn(K, G, meshes): slide G along x so the given meshes (the body) sit in the middle of the frame
function centreOn(K, G, meshes) {
  G.updateMatrixWorld(true);
  const b = new K.THREE.Box3(), t = new K.THREE.Box3();
  for (const m of meshes) { t.setFromObject(m); b.union(t); }
  G.position.x -= (b.min.x + b.max.x) / 2;
}

// ---------------------------------------------------------------------------------------------------------------
// SCUTTLER (c=swarmer): the brief's Runners, dog-sized, fast, in packs. The lightest build: a deep barrel chest over a
// lean waist, longer legs than the rest (it runs on the surface), a wedge of a head ending in the star, and the naked
// mole-rat's buck incisors under it. Geodes split out of each shoulder and in a seam down the spine.
function scuttler(L, K, G, GL, f, v, pose) {
  const pal = PAL[v], fat = v === 'white' ? 1.14 : v === 'rust' ? 1.05 : 1, legK = v === 'white' ? 0.78 : 1, still = pose === 'sense';
  const furM = coat(L, K, v), skinM = K.flesh(pal.skin), nailM = K.keratin(pal.nail), toothM = K.keratin(pal.tooth, 0.35), X = xtal(K, v);
  const body = K.loft(G, plan({ x0: -1.58, x1: 1.5, w: 0.62, h: 0.56, b: 0.38, cy: 0.55, hip: 0.6, rise: 0.7, head: 0.5, drop: 0.1, fat }), furM, { lump: 0.035, seed: 3, uv: 1.4, p: 2.35 });
  shells(K, body, furM, v);

  face(L, K, G, { base: [1.34, 0.45, 0], tip: [1.6, 0.42, 0], r: 0.12, r0: 0.08, len: 0.24, tilt: 0.3, pose, pal });
  for (const s of [-1, 1]) {                                                  // the mole-rat's incisors, under the star
    K.claw(G, [1.55, 0.34, s * 0.03], [1, -0.45, s * 0.05], [0, 1, 0], 0.17, 0.027, 0.015, toothM, 0.3);
    K.claw(G, [1.53, 0.28, s * 0.026], [1, 0.1, s * 0.04], [0, 1, 0], 0.15, 0.022, 0.013, toothM, -0.2);
  }
  K.tail(G, { base: [-1.5, 0.56, 0], tip: [-1.72, 0.5, 0.02], r: 0.07, mat: furM });

  for (const s of [-1, 1]) {
    K.forelimb(GL, { side: s, f, plant: still, shoulder: [0.6, 0.42, s * 0.18 * fat], wrist: [0.96, 0.3, s * 0.5 * fat], hand: 0.8, armR: 0.21 * fat,
      stride: 0.19 * legK, lift: 0.14, skin: skinM, arm: furM, nailMat: nailM, splay: 0.78, tilt: 0.5 });
    K.hindlimb(GL, { side: s, f, plant: still, hip: [-1.02, 0.42, s * 0.2 * fat], foot: [-1.26, 0.08, s * (0.42 + 0.06 * legK) * fat], len: 0.32, r: 0.13 * fat,
      stride: 0.18 * legK, lift: 0.12, skin: skinM, leg: furM, clawMat: nailM, out: 0.75 });
  }

  // ---- the geodes: one out of each shoulder, and a seam of them split along the spine (stretched along it)
  const cm = furM;
  if (v === 'rust') {
    // ironstone plates down the back (iron grown into the skin, like a pangolin's but stone), the geodes breaking out in
    // the gaps left down the spine; the fur shows on the flanks, so the outline stays furry
    K.scales(G, body, { x0: -1.42, x1: 0.8, rows: 9, cols: 5, amax: 0.5, size: 0.42, width: 0.82, mat: K.crust(pal.plate, { rough: 0.95, ns: 1.6 }), lift: 0.28,
      skip: (i, j) => i % 2 === 0 && j === 2 && i > 0 && i < 8 });
    for (const [x, r] of [[0.245, 0.13], [-0.31, 0.12], [-0.865, 0.1]]) K.geodeOn(G, body, x, 0, r, X, { sx: 1.3, up: 0.1, spires: 1, spireLen: 1.1, spireLean: 0.4, open: 0.8 });
    for (const s of [-1, 1]) K.geodeOn(G, body, 0.42, s * 0.72, 0.14, X, { up: 0.25, lean: 0.25, spires: 1, collarMat: cm });
    return body;
  }
  const k = v === 'white' ? 0.82 : 1;
  for (const s of [-1, 1]) K.geodeOn(G, body, 0.36, s * 0.62, 0.19 * k, X, { up: 0.3, lean: 0.3, spires: v === 'white' ? 1 : 2, spireLen: 1.15, spireLean: 0.5, collarMat: cm, open: 0.78 });
  const seam = v === 'white' ? [[-0.05, 0.04, 0.14], [-0.66, -0.04, 0.11]] : [[-0.02, 0.05, 0.16], [-0.42, -0.05, 0.14], [-0.8, 0.04, 0.12], [-1.12, -0.02, 0.09]];
  seam.forEach(([x, a, r], i) => K.geodeOn(G, body, x, a, r * k, X, { sx: 1.5, up: 0.1, spires: i < 2 ? 1 : 0, spireLen: 1.2, spireLean: 0.6, collarMat: cm, open: 0.8 }));
  return body;
}

// ---------------------------------------------------------------------------------------------------------------
// LEECH (c=drainer): the feeder. Fat behind, its back swollen into a bare sac of stretched, thin skin where it carries
// the charge it drinks: violet veins glow through it and geodes split out of its crown. The biggest star of the small
// ones. ?pose=feed: the hands planted wide, the star flared, pressed to the power and lit, threads of charge running into
// it (the hero shot gets the power line itself, its lamp dimmed as it drinks).
function leech(L, K, G, GL, f, pose) {
  const { THREE } = K, X = K.XTAL, pal = PAL.base, feed = pose === 'feed', still = feed || pose === 'sense';
  const furM = coat(L, K, 'base'), skinM = K.flesh(pal.skin), nailM = K.keratin(pal.nail);
  // feeding: it fills, everything that carries charge burns (?charge=: how far it has filled, hungry 0 to full 1)
  const given = P.has('charge'), CH = feed ? (given ? K.CHARGE : 1) : K.CHARGE, FK = feed ? (given ? 1 + 1.2 * CH : 2.2) : 1;
  // the feeding loop (?f=): each draw the star flares wider and brighter and the sac swells a little
  const pulse = feed && P.has('f') ? [0.15, 0.65, 1, 0.45][f % 4] : feed ? 1 : 0, swell = 1 + 0.04 * pulse;
  const body = K.loft(G, plan({ x0: -2.2, x1: 1.62, w: 0.98, h: 0.86, b: 0.5, cy: 0.76, hip: 0.9, rise: 0.84, head: 0.44, drop: 0.12 }), furM, { lump: 0.03, seed: 7, uv: 1.3, p: 2.3 });
  shells(K, body, furM, 'base', { base: { len: 0.055, density: 0.95, comb: 0.8 } });

  // ---- the charge sac: a bare, swollen bulge of thin dark skin over the rear of the back, violet veins glowing in it
  const veins = L.canvasTex(1024, (g, n) => {
    g.fillStyle = '#1c1c1c'; g.fillRect(0, 0, n, n); g.lineCap = 'round';
    L.blotches(g, n, 40, 60, 200, 0.26, '255,255,255');
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
  const chF = K.chargeK(CH);
  const sacM = new THREE.MeshPhysicalMaterial({ color: '#3a3040', roughness: 0.55, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.4, vertexColors: true, map: K.hideMap,
    sheen: 0.35, sheenColor: new THREE.Color('#a890b8'), emissive: new THREE.Color(X.core).multiplyScalar(chF * FK * (K.GLOW * K.GLOW * 0.5 + (K.NIGHTISH ? 0.15 : 0.12)) / 0.4), emissiveMap: veins, emissiveIntensity: 0.45 });
  sacM.envMapIntensity = 0.25; sacM.userData.glow = K.dimGlow(X.glow, (K.GLOW > 1 || feed ? 0.8 : 3) * Math.min(2.2, FK) * chF);
  const sx = -1.02, sy = 1.06, rx = 1.12 * swell, ry = 0.76 * swell, rz = 0.84 * swell;
  {
    const g = new THREE.SphereGeometry(1, 96, 48), p = g.attributes.position, col = new Float32Array(p.count * 3), v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const fold = Math.max(0, K.nz(v.x * 5 + 2, v.y * 5, v.z * 5)) ** 2;
      const k = 1 + 0.05 * K.nz(v.x * 2.6, v.y * 2.6, v.z * 2.6) + 0.025 * K.nz(v.x * 7, v.y * 7 + 3, v.z * 7) - 0.03 * fold;
      p.setXYZ(i, v.x * rx * k, v.y * ry * k * (v.y < 0 ? 0.6 : 1), v.z * rz * k);
      const b = (0.55 + 0.45 * Math.max(0, v.y)) * (1 - 0.35 * fold); col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
    L.mesh(g, sacM, sx, sy, 0, { parent: G });
  }
  // the crystal it has made of what it drank, split out through the crown of the sac
  for (const [dx, dz, r, sp] of [[0.1, 0.05, 0.24, 3], [-0.48, -0.22, 0.18, 1], [-0.42, 0.3, 0.16, 1], [0.5, -0.28, 0.14, 0]]) {
    const x = sx + dx, z = dz, q = 1 - (dx / rx) ** 2 - (z / rz) ** 2, y = sy + ry * Math.sqrt(Math.max(0, q));
    K.geode(G, [x, y, z], [dx * 0.6 - 0.15, 1, z * 0.9], r, X, { charge: CH, spires: sp, spireLen: 1.1, spireLean: 0.3, open: 0.8, collarMat: K.hide('#3a3040') });
  }

  // ---- the face: the star raised and facing forward; feeding, flared and pressed to the power
  const tip = feed ? [1.82, 0.58, 0] : [1.78, 0.66, 0];
  const D = face(L, K, G, { base: [1.36, 0.66, 0], tip, r: 0.15, r0: 0.1, len: 0.3, tilt: feed ? 0.15 : 0.45, pose, pal, seed: 3, star: feed ? { open: 0.74 + 0.26 * pulse, glow: 0.45 + 0.55 * pulse } : undefined });
  K.tail(G, { base: [-2.1, 0.76, 0], tip: [-2.4, 0.68, -0.03], r: 0.09, mat: furM });

  // ---- limbs: big spade hands (planted wide and dug in while feeding), small hind feet
  for (const s of [-1, 1]) {
    K.forelimb(GL, { side: s, f, plant: still, shoulder: [0.62, 0.6, s * 0.26], wrist: feed ? [1.22, 0.26, s * 0.66] : [1.04, 0.34, s * 0.48], hand: 0.78, armR: 0.25,
      stride: 0.16, lift: 0.13, skin: skinM, arm: furM, nailMat: nailM, splay: feed ? 0.95 : 0.6, tilt: feed ? 0.35 : 0.48, droop: feed ? 0.22 : 0.06, fat: 1.05 });
    K.hindlimb(GL, { side: s, f, plant: still, hip: [-1.62, 0.56, s * 0.4], foot: [-1.94, 0.08, s * 0.72], len: 0.38, r: 0.17,
      stride: 0.15, lift: 0.11, skin: skinM, leg: furM, clawMat: nailM, out: 0.7 });
  }
  // ---- geodes out of the shoulders, in front of the sac
  for (const s of [-1, 1]) K.geodeOn(G, body, 0.4, s * 0.68, 0.19, X, { charge: CH, up: 0.3, lean: 0.25, spires: 1, spireLean: 0.4, collarMat: furM });
  K.geodeOn(G, body, 0.05, 0.02, 0.15, X, { charge: CH, sx: 1.4, up: 0.15, collarMat: furM });

  // ---- feeding: threads of stolen charge running from the target into the star
  if (feed) {
    G.updateMatrixWorld(true);
    const c = G.worldToLocal(D.localToWorld(new THREE.Vector3(0.02, 0, 0))), T0 = c.x + (HERO ? 0.2 : 0.42);
    for (let i = 0; i < f * 9; i++) L.rnd();                        // (a fresh crackle each frame)
    const arcM = K.glowMat('#e8d8ff', 1.6 * (0.6 + 0.5 * pulse), K.dimGlow(X.glow, 2.4 * (0.6 + 0.5 * pulse)));
    for (const s of [-1, -0.35, 0.35, 1]) {
      const pts = [[T0, c.y - 0.05 + s * 0.04, s * 0.22]];
      for (let k = 1; k <= 6; k++) { const t = k / 6; pts.push([T0 + (c.x - T0) * t + (L.rnd() - 0.5) * 0.06, c.y - 0.05 + 0.05 * t + (L.rnd() - 0.5) * 0.06, s * 0.22 * (1 - t) + (L.rnd() - 0.5) * 0.08]); }
      K.tube(G, pts, () => 0.016, arcM, { n: 30, radial: 6 });
    }
    // the hero shot: the power line it is drinking from, a cable slung on two short posts; the lamp on it dimmed
    if (HERO) {
      const cableM = K.plain('#26272b', 0.45), postM = K.plain('#6c7074', 0.5, 0.5), Z = 1.7, cy = c.y - 0.08;
      const pts = []; for (let k = 0; k <= 16; k++) { const z = -Z + 2 * Z * k / 16, sag = 0.1 * (1 - (z / Z) ** 2); pts.push([T0 + 0.06, cy + 0.1 - sag, z]); }
      K.tube(G, pts, () => 0.055, cableM, { n: 64, radial: 10 });
      for (const z of [-Z, Z]) { L.cyl(0.07, cy + 0.2, postM, T0 + 0.06, 0, z, { parent: G }); L.box(0.22, 0.08, 0.22, postM, T0 + 0.06, cy + 0.12, z, { parent: G }); }
      const lampM = new THREE.MeshStandardMaterial({ color: '#7a6a50', emissive: '#ffb860', emissiveIntensity: 0.08, roughness: 0.3 });
      L.cyl(0.04, 0.5, postM, T0 + 0.06, cy + 0.2, -Z, { parent: G }); L.sphere(0.11, lampM, T0 + 0.06, cy + 0.78, -Z, { parent: G, dirt: 0 });
    }
  }
  return body;
}

// ---------------------------------------------------------------------------------------------------------------
// BRUTE: the brief's Breakers, rhino-sized heavy raiders plated in crystal growths (twice a Scuttler in the game). A
// huge badger-mole: an enormous barrel chest and shoulder hump, low and broad, coarse near-black velvet; its back grown
// over with a mantle of geode rind split along the spine, where crystal packs the crack, and geodes breaking out of the
// shoulders and flanks. The biggest hands, for tearing through walls.
function brute(L, K, G, GL, f, pose) {
  const pal = PAL.base, still = pose === 'sense', X = { ...K.XTAL, k: 0.9 };
  const furM = K.fur('#1b181c', { coarse: true, sheen: 0.9, sheenColor: '#6a6274', rough: 0.9, ns: 1.0 });
  const skinM = K.flesh('#80727c', { rough: 0.62 }), nailM = K.keratin('#d4c8b2', 0.5);
  const body = K.loft(G, plan({ x0: -3.4, x1: 2.8, w: 1.8, h: 1.48, b: 0.84, cy: 1.14, hip: 0.7, rise: 0.74, head: 0.46, drop: 0.3 }), furM, { lump: 0.04, seed: 11, uv: 2.2, p: 2.4 });
  K.furShells(body, furM, { n: 6, len: 0.1, density: 0.9, comb: 0.9, tip: 0.3, scale: 5 });

  // ---- the mantle: geode rind grown over the back, thick along the spine and sunk into the fur at its edges; split down
  // the middle, banded agate in the break and the crystal packed along it
  const crustM = K.crust('#ffffff');
  const stone = [0.05, 0.046, 0.05], stoneL = [0.12, 0.11, 0.118], vio = [0.1, 0.07, 0.15];
  const bands = [[0.6, 0.56, 0.7], [0.42, 0.36, 0.56], [0.3, 0.24, 0.44], [0.22, 0.17, 0.36], [0.18, 0.14, 0.3]];
  const sad = K.crustSaddle(G, body, { x0: -2.95, x1: 1.15, amax: 0.82, thick: 0.5, bands: 0, crack: 0.24, crackDepth: 0.7, mat: crustM,
    colour: (x, a, inC) => {
      if (inC > 0) return bands[Math.min(4, Math.floor(Math.pow(inC, 0.6) * 5))].map(q => q * 1.3);
      const lum = 0.5 + 0.5 * K.nz(x * 3 + 9, a * 3, 2); let c = stone.map((q, j) => q + (stoneL[j] - q) * lum);
      const vs = Math.max(0, K.nz(x * 2, a * 2 + 2, 3.5) - 0.25); c = c.map((q, j) => q + (vio[j] - q) * Math.min(1, vs * 2));
      return c;
    } });
  const CH = K.CHARGE, cp = K.charged(X, CH);
  // the crack packed with crystal like a long geode: a lining of small points all along it
  {
    const { THREE } = K, geos = [], up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < 420; i++) {
      const x = -2.75 + 3.75 * L.rnd(), t = (x + 2.95) / 4.1, w = 0.24 * Math.max(0, 1 - Math.pow(Math.abs(t - 0.5) / 0.48, 3));
      if (w < 0.03) continue;
      const a = sad.crackZ(x) + (L.rnd() - 0.5) * w * 1.5, p = sad.top(x, a), len = 0.12 + 0.2 * L.rnd() * (0.5 + w * 2);
      const d = new THREE.Vector3((L.rnd() - 0.5) * 0.7 - 0.2, 1, (L.rnd() - 0.5) * 0.7).normalize();
      const cg = new THREE.ConeGeometry(len * 0.28, len, 5, 1); cg.translate(0, len / 2, 0);
      const pp = cg.attributes.position, cc = new Float32Array(pp.count * 3); for (let k = 0; k < pp.count; k++) { const b = 0.6 + 0.4 * pp.getY(k) / len; cc[k * 3] = cc[k * 3 + 1] = cc[k * 3 + 2] = b; }
      cg.setAttribute('color', new THREE.BufferAttribute(cc, 3)); cg.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, d)); cg.translate(p[0], p[1] - len * 0.25, p[2]);
      geos.push(cg.toNonIndexed());
    }
    L.mesh(mergeAll(K, geos), K.druseMat(X, CH), 0, 0, 0, { parent: G, dirt: 0 }).receiveShadow = false;
  }
  // the seam: crystal points packed along the crack, tallest mid-back, leaning back and out of it
  for (let i = 0; i < 6; i++) {
    const t = (i + 0.2 + L.rnd() * 0.6) / 6, x = -2.7 + 3.7 * t, mid = Math.max(0, 1 - Math.abs(t - 0.45) * 1.8);
    const a = sad.crackZ(x) + (L.rnd() - 0.5) * 0.1, p = sad.top(x, a);
    K.cluster(G, [p[0], p[1] - 0.16, p[2]], [-0.5 - L.rnd() * 0.3, 1, (i % 2 ? 1 : -1) * (0.25 + L.rnd() * 0.3)], 2 + Math.round(L.rnd()), 0.42 + 0.8 * mid * (0.8 + L.rnd() * 0.3), 0.1 + 0.08 * mid, cp, 0.45, { collar: false });
  }
  // geodes split out of the shoulders (the biggest, on the hump) and along the edges of the mantle
  for (const s of [-1, 1]) K.geodeOn(G, body, 0.75, s * 0.62, 0.48, X, { up: 0.3, lean: 0.2, spires: 3, spireLen: 1.1, spireLean: 0.4, collarMat: furM, open: 0.75, sink: 0.08 });
  for (const [x, a, r] of [[-0.6, 0.9, 0.34], [-0.75, -0.95, 0.36], [-1.9, 0.85, 0.3], [-2.05, -0.82, 0.28], [1.25, 0.95, 0.26], [1.3, -1.0, 0.24]])
    K.geodeOn(G, body, x, a, r, X, { up: 0.2, lean: 0.15, spires: r > 0.3 ? 1 : 0, collarMat: furM, sx: 1.2, open: 0.78 });

  // ---- the head: a heavy wedge, the muzzle and a wide star; a stub of a tail
  face(L, K, G, { base: [2.55, 0.86, 0], tip: [3.05, 0.78, 0], r: 0.34, r0: 0.21, len: 0.5, tilt: 0.28, pose, pal, seed: 5 });
  K.tail(G, { base: [-3.3, 1.15, 0], tip: [-3.75, 1.02, 0.05], r: 0.2, mat: furM });

  // ---- limbs: enormous spade hands, thick hind legs
  for (const s of [-1, 1]) {
    K.forelimb(GL, { side: s, f, plant: still, shoulder: [1.35, 0.95, s * 0.65], wrist: [2.0, 0.55, s * 1.02], hand: 1.6, armR: 0.55, fat: 1.12,
      stride: 0.26, lift: 0.22, skin: skinM, arm: furM, nailMat: nailM, splay: 0.58, tilt: 0.5 });
    K.hindlimb(GL, { side: s, f, plant: still, hip: [-2.6, 0.85, s * 0.7], foot: [-3.0, 0.14, s * 1.25], len: 0.66, r: 0.36,
      stride: 0.24, lift: 0.18, skin: skinM, leg: furM, clawMat: nailM, out: 0.65 });
  }
  return body;
}

// ===============================================================================================================
// The two later roles: the SPITTER (counters defence lines) and the SAPPER (counters walls and turtling). Same kit, same
// palette logic, same regional variants as the Scuttler.

// the grit the Spitter grinds from eaten crystal and carries in its cheek pouches: pale lilac, glowing violet. The Polar Caps
// ones' frosted and dim, the Bloom ones' deep violet.
const GRIT = { skin: '#9a8cae', core: '#d2b8ff', glow: '#a466ff', chip: '#e0d4f8', k: 1.7 };   // (pale and bright, so a Spitter reads apart from a Scuttler)
const GRIT_WHITE = { skin: '#b4b2bc', core: '#e0dcf2', glow: '#bdb4e6', chip: '#eef0f6', k: 0.55 };
const GRIT_BLOOM = { skin: '#6a4c8e', core: '#cf8cff', glow: '#b048ff', chip: '#b48af0', k: 1.2 };

// pouchMat(L, K, GR, FK): the stretched skin of a cheek pouch packed with crystal grit, the grit glowing through it (and
// brighter, FK > 1, when it is squeezed to spit)
function pouchMat(L, K, GR, FK) {
  const { THREE } = K;
  const tex = L.canvasTex(512, (g, n) => {
    g.fillStyle = '#202020'; g.fillRect(0, 0, n, n);
    L.blotches(g, n, 50, 26, 90, 0.3, '255,255,255');
    for (let i = 0; i < 2600; i++) { const s = 1 + L.rnd() * 3.5, x = L.rnd() * n, y = L.rnd() * n; g.fillStyle = `rgba(255,255,255,${0.3 + 0.7 * L.rnd()})`; g.save(); g.translate(x, y); g.rotate(L.rnd() * 3); g.fillRect(-s / 2, -s / 3, s, s * 0.66); g.restore(); }
  });
  const k = (GR.k ?? 1) * Math.max(0.4, K.chargeK(K.CHARGE));     // (the grit always shows a little: the Spitter's mark)
  const m = new THREE.MeshPhysicalMaterial({ color: GR.skin, roughness: 0.62, metalness: 0, clearcoat: 0.12, clearcoatRoughness: 0.5, vertexColors: true, map: K.hideMap,
    sheen: 0.55, sheenColor: new THREE.Color('#e4daf2'), emissiveMap: tex, emissiveIntensity: 0.4,
    emissive: new THREE.Color(GR.core).multiplyScalar(k * FK * (K.GLOW * K.GLOW * 0.5 + (K.NIGHTISH ? 0.15 : 0.2)) / 0.4) });
  m.envMapIntensity = 0.3; m.userData.glow = K.dimGlow(GR.glow, (K.GLOW > 1 || FK > 1 ? 0.8 : 3) * Math.min(2.2, FK) * k);
  return m;
}
// sac(L, K, parent, at, r, mat, seed): a swollen, slightly lop-sided pouch (r = [rx, ry, rz]), lit from above
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
// clot(L, K, parent, at, dir, GR, o): what the Spitter spits: a fist-sized clot of crystal grit and soil packed round a
//   charge it has squeezed into it, crackling: chips of crystal, grains of dark soil, a violet-white heart showing
//   between them, short arcs jumping over it, grit shed behind. Dry: no slime. o: { r, FK, trail (grit back toward
//   [x,y,z] in parent space: the stream still leaving the mouth) }
function clot(L, K, parent, at, dir, GR, o = {}) {
  const { THREE } = K, r = o.r ?? 0.26, FK = o.FK ?? 1, k = GR.k ?? 1;
  const D = L.group(at[0], at[1], at[2], 0, parent); D.quaternion.copy(K.frame(dir, [0, 1, 0]));
  const heartM = K.glowMat(GR.core, 1.1 * FK * k, K.dimGlow(GR.glow, 3 * k));
  L.sphere(r * 0.55, heartM, 0, 0, 0, { parent: D, dirt: 0, cast: false });
  const XG = { ...(GR === GRIT_BLOOM ? K.XTAL_BLOOM : GR === GRIT_WHITE ? K.XTAL_WHITE : K.XTAL), k: 1.3 * k };
  const soilM = [K.crust('#6a5644', { rough: 0.95 }), K.crust('#5a4838', { rough: 0.95 })];
  const lump = (s, q) => { const g = new THREE.DodecahedronGeometry(1, 0), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const w = 1 + 0.25 * K.nz(p.getX(i) * 2 + q, p.getY(i) * 2, p.getZ(i) * 2); p.setXYZ(i, p.getX(i) * w * s, p.getY(i) * w * s * 0.8, p.getZ(i) * w * s); } g.computeVertexNormals(); return g; };
  // packed grit: chips of crystal pointing every way, soil grains between them, a little looser at the back
  for (let i = 0; i < 26; i++) {
    const u = L.rnd() * 2 - 1, th = L.rnd() * 6.283, sq = Math.sqrt(1 - u * u), rr = r * (0.55 + 0.4 * L.rnd()), d = [u, sq * Math.cos(th), sq * Math.sin(th)], back = u < 0 ? 1.1 : 1;
    if (i % 6) K.shard(D, [d[0] * rr * 0.55 * back, d[1] * rr * 0.55, d[2] * rr * 0.55], d, r * (0.4 + 0.3 * L.rnd()), r * 0.1, XG, { collar: false });
    else L.mesh(lump(r * (0.08 + 0.05 * L.rnd()), i), soilM[i % 2], d[0] * rr * 0.85 * back, d[1] * rr * 0.85, d[2] * rr * 0.85, { parent: D, dirt: 0 });
  }
  // sparks: short jagged arcs of charge jumping over it
  const arcM = K.glowMat('#f4ecff', (K.NIGHTISH ? 1.4 : 1.0) * k, K.dimGlow('#e6d8ff', 2.2 * k));
  for (let j = 0; j < 6; j++) {
    const th0 = j * 1.05 + 0.2, ph0 = 0.35 + 0.3 * (j % 4), pts = [];
    for (let s = 0; s <= 5; s++) {
      const t = s / 5, th = th0 + t * 0.7 + (s % 2 ? 0.16 : -0.16), ph = ph0 + t * 0.5 + (s % 2 ? 0.08 : -0.06), rr = r * 1.02;
      pts.push([Math.cos(ph) * rr, Math.cos(th) * Math.sin(ph) * rr, Math.sin(th) * Math.sin(ph) * rr]);
    }
    K.tube(D, pts, () => r * 0.022, arcM, { n: 15, radial: 5, dirt: 0 });
  }
  // grit shed behind it (and, leaving the mouth, a stream of it back to the lips)
  const end = o.trail ? D.worldToLocal(parent.localToWorld(new THREE.Vector3(...o.trail))) : new THREE.Vector3(-r * 2.6, 0, 0);   // (alone, it stays in its frame)
  const nT = o.trail ? 16 : 9;
  for (let i = 0; i < nT; i++) {
    const t = (i + 1) / (nT + 1), p = new THREE.Vector3(-r * 0.9, 0, 0).lerp(end, t), j = r * 0.25 * (1 - t * 0.5);
    p.x += (L.rnd() - 0.5) * j; p.y += (L.rnd() - 0.5) * j; p.z += (L.rnd() - 0.5) * j;
    if (i % 2) K.shard(D, [p.x, p.y, p.z], [L.rnd() - 0.5, L.rnd() - 0.5, L.rnd() - 0.5], r * 0.2 * (1 - 0.5 * t), r * 0.06, XG, { collar: false });
    else L.mesh(lump(r * 0.07 * (1 - 0.4 * t), i + 50), soilM[i % 2], p.x, p.y, p.z, { parent: D, dirt: 0 });
  }
  return D;
}

// ---------------------------------------------------------------------------------------------------------------
// SPITTER: counters defence lines. A thickset mole with a broad blunt head, its cheeks swollen into two great pouches
// packed with crystal grit (crystal it has eaten and ground down) that glows violet through the stretched skin: from
// above a wide, bright "hammer" at the front, nothing like the others. The star sits on the upper jaw like a nose; the
// mouth under it is wide. Geodes in pairs down the back. ?pose=spit: it plants its hands, squeezes the pouches, throws
// its jaws wide and a clot of charged grit leaves the mouth (c=spit-glob draws the clot alone). It shorts robots and
// turrets for a moment.
function spitter(L, K, G, GL, f, v, pose) {
  const { THREE } = K, spit = pose === 'spit', still = spit || pose === 'sense';
  const pal = PAL[v], lip = v === 'white' ? '#8f7f86' : '#5a4650', mouth = '#3e2630';
  const fat = v === 'white' ? 1.12 : v === 'rust' ? 1.05 : 1, legK = v === 'white' ? 0.8 : 1;
  const furM = coat(L, K, v), skinM = K.flesh(pal.skin), lipM = K.flesh(lip, { rough: 0.5 }), mouthM = K.flesh(mouth, { rough: 0.4, cc: 0.3 });
  const nailM = K.keratin(pal.nail), toothM = K.keratin(pal.tooth, 0.35), X = xtal(K, v);
  const GR = v === 'white' ? GRIT_WHITE : v === 'bloom' ? GRIT_BLOOM : GRIT;
  // the spit loop (?f=0..3; without f, the spit itself): wind-up, spit, recoil, recovering
  const SPF = [{ up: -0.06, dn: 0.05, sq: 1.12, FK: 2.0, hx: -0.12, star: 0.55 }, { up: 0.75, dn: -0.45, sq: 0.86, FK: 2.2, hx: 0, star: 0.85, shot: 1 },
    { up: 0.42, dn: -0.26, sq: 0.8, FK: 0.85, hx: 0.08, star: 0.7, grit: 1 }, { up: 0.12, dn: -0.06, sq: 0.94, FK: 1.3, hx: 0.03, star: 0.6 }][spit && P.has('f') ? f % 4 : 1];
  const FK = spit ? SPF.FK : 1;
  // ---- the body: barrel-chested, a broad short neck into a broad flat skull (the pouches and jaws make the head)
  const body = K.loft(G, plan({ x0: -1.62, x1: 1.46, w: 0.7, h: 0.6, b: 0.37, cy: 0.66, hip: 0.64, rise: 0.74, head: 0.7, drop: 0.02, fat }), furM, { lump: 0.035, seed: 5, uv: 1.4, p: 2.35 });
  shells(K, body, furM, v, { base: { len: 0.05, comb: 0.85 } });

  // ---- the jaws: a broad blunt muzzle hinged at the cheeks, the star on the upper one. Walking, closed (grit beading at
  // the corners); spitting, the upper jaw thrown up and the lower dropped, the mouth's floor and the clot showing
  const hinge = [1.16 + (spit ? SPF.hx : 0), 0.6, 0], up = spit ? SPF.up : -0.03, dn = spit ? SPF.dn : 0.03;
  const J1 = L.group(hinge[0], hinge[1] + 0.02, 0, 0, G); J1.rotation.z = up;
  const J2 = L.group(hinge[0], hinge[1] - 0.06, 0, 0, G); J2.rotation.z = dn;
  K.seg(J1, [0.08, 0.08, 0], 0.36, 0.22, 0.5 * fat, furM, { lump: 0.04, flat: 0.6 });                  // furred top of the head
  K.seg(J1, [0.34, 0.03, 0], 0.27, 0.15, 0.44 * fat, K.hide(pal.muzzle, { ns: 0.8 }), { lump: 0.03, flat: 0.7 });   // the naked upper lip
  face(L, K, G, { parent: J1, base: [0.38, 0.08, 0], tip: [0.56, 0.08, 0], r: 0.12, r0: 0.085, len: 0.22, tilt: 0.25, pose, pal, seed: 7, star: spit ? { open: SPF.star } : undefined });
  K.seg(J2, [0.3, -0.03, 0], 0.32, 0.12, 0.44 * fat, lipM, { lump: 0.03, flat: 0.2 });                // lower jaw, a heavy chin
  K.seg(J2, [0.3, 0.05, 0], 0.28, 0.035, 0.34 * fat, mouthM, { lump: 0.02 });                         // the mouth's floor, a fat tongue
  for (const s of [-1, 1]) {                                                                           // teeth along both rims
    for (let k = 0; k < 4; k++) { const a = 0.25 + k * 0.32, x = 0.36 + 0.26 * Math.cos(a), z = s * 0.42 * fat * Math.sin(a);
      K.claw(J1, [x, -0.04, z], [0.15, -1, 0], [1, 0, 0], 0.07 + (k === 0 ? 0.05 : 0), 0.018, 0.012, toothM, 0.15);
      K.claw(J2, [x - 0.04, 0.04, z * 0.95], [0.15, 1, 0], [1, 0, 0], 0.06, 0.016, 0.011, toothM, -0.15); }
  }
  K.tail(G, { base: [-1.55, 0.64, 0], tip: [-1.78, 0.58, 0.02], r: 0.07, mat: furM });

  // ---- the cheek pouches: two great bags of grit swelling the head out behind the jaw like a hamster's full cheeks and
  // tapering forward to the corners of the mouth; their rear sinks under the shoulder fur, so they read as part of the
  // head. Squeezed flatter when it spits.
  const gM = pouchMat(L, K, GR, FK), sq = spit ? SPF.sq : 1;
  for (const s of [-1, 1]) {
    sac(L, K, G, [0.72, 0.64, s * 0.56 * fat], [0.6 * sq, 0.34 * sq, 0.4 * sq * fat], gM, s);
    sac(L, K, G, [1.1, 0.6, s * 0.48 * fat], [0.3 * sq, 0.25 * sq, 0.27 * sq * fat], gM, s + 3);
    K.seg(G, [0.3, 0.7, s * 0.5 * fat], 0.36, 0.34, 0.36 * fat, furM, { lump: 0.08, seed: s * 4, flat: 0.4 });
    K.tube(G, [[1.12, 0.64, s * 0.56 * fat], [1.24, 0.6, s * 0.48 * fat], [1.38, 0.6, s * 0.4 * fat]], t => 0.08 * (1 - 0.4 * t), gM, { n: 12, radial: 10 });
    // grit at the corners of the mouth (walking)
    if (!spit) for (let i = 0; i < 4; i++) K.shard(G, [1.46 + i * 0.02, 0.55, s * (0.4 - i * 0.03) * fat], [1, 0.3, s * 0.5], 0.06, 0.018, { ...X, k: 1.2 }, { collar: false });
  }

  // ---- limbs: spade hands tucked under the pouches (planted wide and braced when it spits), small hind feet
  for (const s of [-1, 1]) {
    K.forelimb(GL, { side: s, f, plant: still, shoulder: [0.5, 0.5, s * 0.24 * fat], wrist: spit ? [0.92, 0.28, s * 0.9 * fat] : [0.8, 0.32, s * 0.8 * fat], hand: 0.66, armR: 0.21 * fat,
      stride: 0.18 * legK, lift: 0.13, skin: skinM, arm: furM, nailMat: nailM, splay: spit ? 1.0 : 0.75, tilt: 0.42, droop: spit ? 0.2 : 0.06 });
    K.hindlimb(GL, { side: s, f, plant: still, hip: [-1.0, 0.45, s * 0.24 * fat], foot: spit ? [-1.32, 0.08, s * 0.62 * fat] : [-1.25, 0.08, s * (0.5 + 0.05 * legK) * fat], len: 0.34, r: 0.14 * fat,
      stride: 0.17 * legK, lift: 0.12, skin: skinM, leg: furM, clawMat: nailM, out: 0.75 });
  }

  // ---- regional extras, and the geodes: pairs down the back, the biggest behind the pouches
  if (v === 'rust') {
    K.scales(G, body, { x0: -1.35, x1: 0.5, rows: 8, cols: 5, amax: 0.5, size: 0.42, width: 0.82, mat: K.crust(PAL.rust.plate, { rough: 0.95, ns: 1.6 }), lift: 0.28, skip: (i, j) => j === 2 && i % 2 === 0 && i > 0 && i < 7 });
    for (const [x, r] of [[0.0, 0.13], [-0.53, 0.12], [-1.06, 0.1]]) K.geodeOn(G, body, x, 0, r, X, { sx: 1.3, up: 0.1, spires: 1, spireLean: 0.4 });
  } else {
    const k = v === 'white' ? 0.82 : 1;
    const pairs = v === 'white' ? [[0.2, 0.17], [-0.65, 0.13]] : [[0.25, 0.17], [-0.25, 0.15], [-0.72, 0.13], [-1.12, 0.1]];
    pairs.forEach(([x, r], i) => { for (const s of [-1, 1]) K.geodeOn(G, body, x - (s > 0 ? 0.06 : 0), s * 0.42, r * k, X, { up: 0.2, lean: 0.3, spires: i < 2 ? 1 : 0, spireLean: 0.6, collarMat: furM, open: 0.78 }); });
  }

  // ---- spitting: the clot just leaving the mouth, a stream of grit still joining them
  if (spit && SPF.grit) {                            // (recoil: the last of the grit still leaving the mouth)
    const mid = (up + dn) / 2, d = [Math.cos(mid), Math.sin(mid), 0], XG = { ...X, k: 1.6 };
    for (let i = 0; i < 9; i++) { const t = 0.45 + i * 0.09; K.shard(G, [hinge[0] + d[0] * t + (L.rnd() - 0.5) * 0.08, hinge[1] + d[1] * t + (L.rnd() - 0.5) * 0.08, (L.rnd() - 0.5) * 0.18], [L.rnd() - 0.5, L.rnd() - 0.5, L.rnd() - 0.5], 0.06, 0.02, XG, { collar: false }); }
  } else if (spit && !SPF.shot) {
    // (winding up or recovering: nothing leaving the mouth)
  } else if (spit && (P.get('shot') === 'shards' || P.has('f'))) {
    const mid = (up + dn) / 2, d = [Math.cos(mid), Math.sin(mid), 0];
    shardVolley(L, K, G, [hinge[0] + d[0] * 0.95, hinge[1] + d[1] * 0.95, 0], d, v, [hinge[0] + d[0] * 0.42, hinge[1] + d[1] * 0.42 - 0.02, 0]);
  } else if (spit) {
    const mid = (up + dn) / 2, d = [Math.cos(mid), Math.sin(mid), 0];
    clot(L, K, G, [hinge[0] + d[0] * 1.02, hinge[1] + d[1] * 1.02, 0], d, GR, { r: 0.28, FK: 1.4, trail: [hinge[0] + d[0] * 0.42, hinge[1] + d[1] * 0.42 - 0.02, 0] });
  }
  return body;
}

// shardVolley(L, K, parent, at, dir, v, trail): the Spitter's volley: five shards of crystal ground sharp in its pouches,
//   spat together and spreading a little, each lit at its core with the charge squeezed into it and trailing grit;
//   short arcs jump between them. (A shard that hits shorts what it strikes for a moment: the impact is a 2D effect,
//   renderer/fx/spit_impact.py.) trail: a stream of grit back toward [x, y, z] in parent space (the mouth).
function shardVolley(L, K, parent, at, dir, v, trail) {
  const { THREE } = K, GR = v === 'white' ? GRIT_WHITE : v === 'bloom' ? GRIT_BLOOM : GRIT, k = GR.k ?? 1;
  const X = { ...(v === 'bloom' ? K.XTAL_BLOOM : v === 'white' ? K.XTAL_WHITE : K.XTAL), k: 1.15 * k };
  const D = L.group(at[0], at[1], at[2], 0, parent); D.quaternion.copy(K.frame(dir, [0, 1, 0]));
  const arcM = K.glowMat('#f4ecff', 1.4 * k, K.dimGlow('#e6d8ff', 2.2 * k)), tips = [];
  // each shard a jagged knot of crystal points, a little off line, with a tail of grit fading out behind it
  for (const [x, y, z, sz] of [[0.34, 0.03, 0.02, 1.0], [0.08, 0.1, 0.26, 0.82], [0.12, -0.05, -0.25, 0.86], [-0.2, 0.12, -0.05, 0.72], [-0.26, -0.04, 0.18, 0.66]]) {
    const d = [1, y * 0.5 + (L.rnd() - 0.5) * 0.3, z * 0.55 + (L.rnd() - 0.5) * 0.3];
    K.cluster(D, [x - 0.12 * sz, y, z], d, 4, 0.3 * sz, 0.075 * sz, X, 0.75, { collar: false });
    tips.push([x + 0.15 * sz, y, z]);
    for (let q = 0; q < 6; q++) { const t = (q + 1) / 6, c = [x - 0.14 - t * 0.7 * sz + (L.rnd() - 0.5) * 0.06, y + (L.rnd() - 0.5) * 0.08 * t, z + (L.rnd() - 0.5) * 0.1 * t]; K.shard(D, c, [L.rnd() - 0.5, L.rnd() - 0.5, L.rnd() - 0.5], 0.07 * sz * (1 - 0.6 * t), 0.024 * sz, X, { collar: false }); }
  }
  // the charge squeezed into them jumps between them in short arcs (only where the light is low enough to see it)
  if (K.NIGHTISH) for (let j = 0; j < tips.length - 1; j += 2) {
    const a = tips[j], b = tips[j + 1], pts = [];
    for (let q = 0; q <= 5; q++) { const t = q / 5; pts.push([a[0] + (b[0] - a[0]) * t + (q % 2 ? 0.04 : -0.03), a[1] + (b[1] - a[1]) * t + (q % 2 ? 0.05 : 0), a[2] + (b[2] - a[2]) * t]); }
    K.tube(D, pts, () => 0.01, arcM, { n: 12, radial: 4, dirt: 0 });
  }
  if (trail) {
    const end = D.worldToLocal(parent.localToWorld(new THREE.Vector3(...trail)));
    for (let i = 0; i < 10; i++) {
      const t = (i + 1) / 11, p = new THREE.Vector3(-0.3, 0, 0).lerp(end, t), j = 0.14 * (1 - t * 0.5);
      p.x += (L.rnd() - 0.5) * j; p.y += (L.rnd() - 0.5) * j; p.z += (L.rnd() - 0.5) * j;
      K.shard(D, [p.x, p.y, p.z], [L.rnd() - 0.5, L.rnd() - 0.5, L.rnd() - 0.5], 0.06 * (1 - 0.5 * t), 0.022, X, { collar: false });
    }
  }
  return D;
}

// c=spit-glob: the clot on its own, in flight (+x), centred on its heart
function spitGlob(L, K, G, v) {
  clot(L, K, G, [0, 0.5, 0], [1, 0, 0], v === 'white' ? GRIT_WHITE : v === 'bloom' ? GRIT_BLOOM : GRIT, { r: 0.3, FK: 1.4 });
}

// ---------------------------------------------------------------------------------------------------------------
// SAPPER: counters walls and turtling: it tunnels under them and comes up behind. The true digger, long for a Murmur but
// still barrel-chested: its huge spade hands set right beside the head and turned out sideways like oars, the fingers
// long and caked with soil. Crystal has grown hard over its brow into a wedge of stone (geode rind, banded where it
// wore), and while it digs it keeps its star shut into a point in front of it. Its geodes lie flat along its flanks,
// split lengthwise and swept back, so they never snag in the tunnel. ?pose=surface: only the head, the hands and a ring
// of thrown-up soil show above the ground, and the star opens.
const PAL_DELV = { ...PAL.base, hide: '#1a181c', sheen: '#7a7488', brow: '#5e585c' };
function sapper(L, K, G, GL, f, v, pose) {
  const { THREE } = K, surface = pose === 'surface', still = pose === 'sense', dig = pose === 'dig', up = pose === 'up';
  if (pose === 'heave') return heave(L, K, G, xtal(K, v), P.has('f') ? f % 4 : 0);
  if (up && f === 0) return heave(L, K, G, xtal(K, v), 0, true);          // (coming up, first the ground bursts)
  const pal = v === 'base' ? PAL_DELV : { ...PAL_DELV, ...PAL[v], brow: v === 'rust' ? '#7a4630' : v === 'white' ? '#cfccc8' : '#5a4a68' };
  const fat = v === 'white' ? 1.12 : v === 'rust' ? 1.05 : 1, legK = v === 'white' ? 0.8 : 1;
  const furM = coat(L, K, v, { sheen: 1, rough: 0.8, sheenColor: pal.sheen }), skinM = K.flesh(pal.skin), nailM = K.keratin(pal.nail, 0.45), X = xtal(K, v);
  const soilM = [K.crust('#3e3026', { rough: 0.97 }), K.crust('#33271f', { rough: 0.97 }), K.crust('#4a3a2e', { rough: 0.97 })], caked = K.crust('#7a6450', { rough: 0.97 });
  const clodGeo = (s, k) => { const g = new THREE.DodecahedronGeometry(1, 1), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const q = 1 + 0.3 * K.nz(p.getX(i) * 2 + k, p.getY(i) * 2, p.getZ(i) * 2); p.setXYZ(i, p.getX(i) * q, p.getY(i) * q, p.getZ(i) * q); } g.scale(s, s * 0.7, s * (0.8 + 0.4 * L.rnd())); g.computeVertexNormals(); return g; };
  const S = (x, w, h, b, cy) => [x, w * fat, h * fat, b * fat, cy];
  // the whole animal is built in B (body space: +x forward). Walking, B is G; surfacing, B is the front half, pitched up
  // out of a hole at the origin.
  // coming up (pose=up, f=1..4): the star and fingers breaking through, head and hands out, shoulders, climbing out
  const UP = up ? [null, [-0.78, -1.32, 0.8], [-0.3, -0.95, 0.55], [0.12, -0.6, 0.38], [0.6, -0.28, 0.2]][Math.min(4, f)] : null;
  const B = surface ? L.group(-0.3, -0.95, 0, 0, G) : dig ? L.group(0, -0.42, 0, 0, G) : up ? L.group(UP[0], UP[1], 0, 0, G) : G;
  if (surface) B.rotation.z = 0.55;
  if (up) B.rotation.z = UP[2];
  if (dig) B.rotation.z = -0.36;   // (digging: nose down into its hole, the rump still up behind)
  const st = plan({ x0: -2.75, x1: 2.14, w: 0.7, h: 0.54, b: 0.33, cy: 0.52, hip: 0.68, rise: 0.76, head: 0.54, drop: 0.06, fat });
  // soil dust on the lower flanks and the rump
  const dust = (x, a) => { const s = Math.abs(Math.sin(a)), d = K.sstep(0.55, 0.95, s) * (0.5 + 0.5 * K.nz(x * 2.5, a * 2, 4)) + K.sstep(-1.4, -2.6, x) * 0.35 * Math.max(0, K.nz(x * 4, a * 3, 1)); const q = Math.min(1, d) * (v === 'white' ? 0.3 : 1); return [1 + 2.6 * q, 1 + 2.0 * q, 1 + 1.4 * q]; };
  const body = K.loft(B, surface ? [S(0.62, 0, 0, 0, 0.55), S(0.78, 0.5, 0.4, 0.26, 0.55), ...st.slice(7)] : st, furM, { lump: 0.03, seed: 9, uv: 1.4, p: 2.35, col: (x, a) => dust(x, a) });
  shells(K, body, furM, v, { base: { len: 0.04, density: 0.95, comb: 0.95, tip: 0.35 } });

  // ---- the brow: crystal grown hard over the skull into a wedge of stone, geode rind banded where it has worn, cracked
  // along its ridge where the crystal shows; the muzzle and the star in front of it, shut into a point (open surfacing)
  const browC = new THREE.Color(pal.brow);
  const shield = K.crustSaddle(B, body, { x0: 1.0, x1: 2.12, amax: 1.25, thick: 0.15, crack: 0.1, mat: K.crust('#ffffff', { rough: 0.85 }),
    colour: (x, a, inC) => {
      if (inC > 0) return [0.62, 0.56, 0.78].map(q => q * (0.7 + 0.5 * inC));
      const ring = 0.84 + 0.16 * Math.sin(x * 30 + 2 * K.nz(a * 2, x, 1)), root = K.sstep(1.1, 1.6, x), k = (0.55 + 0.45 * root) * ring;
      return [browC.r * k, browC.g * k, browC.b * k];
    } });
  const sp = surface || up ? { open: 0.95, glow: 0.6 } : still ? { open: 1, glow: 0.75 } : { open: 0, glow: 0 };
  face(L, K, G, { parent: B, base: [1.98, 0.47, 0], tip: [2.26, 0.45, 0], r: 0.13, r0: 0.085, len: 0.28, tilt: surface || up ? 0.2 : 0.05, pose, pal, star: sp, seed: 9 });
  const browTop = shield.top(1.62, 0);
  K.geode(B, browTop, [0.25, 1, 0], 0.1, X, { sx: 1.8, open: 0.7, sink: 0.04 });

  // ---- the geodes: long and low along the upper flanks, split lengthwise and swept back
  const n = v === 'white' ? 0.82 : 1;
  if (!surface) {
    const rows = v === 'rust' ? [[0.7, 0.13], [-0.3, 0.13], [-1.3, 0.11]].map(([x, r]) => [x, 0, r])
      : [[0.75, 0.86, 0.15], [0.55, -0.88, 0.15], [-0.05, 0.9, 0.15], [-0.3, -0.9, 0.15], [-0.85, 0.88, 0.13], [-1.1, -0.88, 0.13], [-1.6, 0.84, 0.11], [-1.85, -0.82, 0.1]];
    for (const [x, a, r] of (v === 'white' ? rows.filter((_, i) => i % 2 === 0) : rows)) K.geodeOn(B, body, x, a, r * n, X, { sx: 2.2, hk: 0.55, open: 0.62, up: 0, lean: 0.3, sink: r * 0.35, spires: 0, collarMat: furM });
    K.tail(B, { base: [-2.7, 0.54, 0], tip: [-2.94, 0.48, 0.02], r: 0.07, mat: furM });
    if (v === 'rust') K.scales(B, body, { x0: -2.4, x1: 1.0, rows: 11, cols: 5, amax: 0.5, size: 0.4, width: 0.82, mat: K.crust(PAL.rust.plate, { rough: 0.95, ns: 1.6 }), lift: 0.22, skip: (i, j) => j === 2 && i % 3 === 1 });
  }

  // ---- the hands: huge spades right beside the head, turned out sideways like oars, the fingers caked with soil
  const hand = (s, o) => {
    const r = K.forelimb(o.parent, { side: s, f, hand: 0.98, armR: 0.25 * fat, fat: 1.15, stride: 0.17 * legK, lift: 0.12, skin: skinM, arm: furM, nailMat: nailM, fan: 0.42, curl: 0.24, ...o });
    for (let k = 0; k < 7; k++) { const a = -0.9 + k * 0.3, x = 0.98 * (0.55 + 0.4 * L.rnd()), sz = 0.026 + 0.02 * L.rnd(); L.mesh(clodGeo(sz, k + s * 10), caked, x, 0.03, Math.sin(a) * 0.98 * 0.22, { parent: r.hand, dirt: 0 }); }
    return r;
  };
  if (dig) return digIn(L, K, G, B, body, { hand, skinM, furM, nailM, fat, legK, clodGeo, f });
  if (!surface && !up) for (const s of [-1, 1]) {
    hand(s, { parent: GL, plant: still, shoulder: [1.18, 0.42, s * 0.4 * fat], wrist: [1.36, 0.3, s * 0.64 * fat], splay: 1.08, swing: 0.22, tilt: 0.8, droop: 0.08, armR: 0.23 * fat });
    K.hindlimb(GL, { side: s, f, plant: still, hip: [-2.2, 0.42, s * 0.28 * fat], foot: [-2.48, 0.08, s * (0.5 + 0.06 * legK) * fat], len: 0.4, r: 0.14 * fat,
      stride: 0.16 * legK, lift: 0.1, skin: skinM, leg: furM, clawMat: nailM, out: 0.8 });
  }
  if (!surface && !up) return body;

  // ---- surfacing: the hands planted on the rim of the hole, fingers dug into the soil
  if (surface) for (const s of [-1, 1]) hand(s, { parent: G, plant: true, shoulder: [0.25, 0.05, s * 0.34], wrist: [0.55, 0.62, s * 0.84], splay: 0.8, tilt: 0.5, droop: 0.28 });
  // coming up: the hands from the shoulders, reaching out of the hole onto the ground (where they reach, in G)
  if (up) {
    G.updateMatrixWorld(true);
    const W = [null, [0.42, 0.3, 0.62], [0.55, 0.62, 0.84], [1.35, 0.1, 0.82], [2.1, 0.08, 0.72]][Math.min(4, f)];
    for (const s of [-1, 1]) {
      const w = B.worldToLocal(G.localToWorld(new THREE.Vector3(W[0], W[1], s * W[2])));
      hand(s, { parent: B, plant: true, shoulder: [1.18, 0.42, s * 0.4 * fat], wrist: [w.x, w.y, w.z], splay: f >= 3 ? 1.0 : 0.8, tilt: f >= 3 ? 0.75 : 0.5, droop: f >= 3 ? 0.1 : 0.28 });
    }
    // the unseen floor beyond the hole hides the rest of it (the hole's own bowl hides what is in it); its material
    // is locked, so the glow pass leaves it unseen too
    const flM = new THREE.MeshBasicMaterial({ colorWrite: false }), fl = new THREE.Mesh(new THREE.RingGeometry(1.7, 40, 64).rotateX(-Math.PI / 2), flM);
    Object.defineProperty(fl, 'material', { get: () => flM, set: () => {} });
    fl.renderOrder = -10; L.getRoot().add(fl);
  }
  // the first geodes of the shoulders, just breaking out of the hole behind the head
  if (surface) for (const s of [-1, 1]) K.geode(G, [-0.12, 0.02, s * 0.36], [-0.5, 1, s * 0.4], 0.13 * n, X, { spires: 1, open: 0.75 });
  // ---- the ring of thrown-up soil: a crumbly ring heaped round a dark hole, lumps of it fallen on the head and hands
  const RI = 0.8, RP = 1.1, RO = 1.85;
  const prof = (r) => r < RI ? -0.6 + 0.6 * K.sstep(0.15, RI, r) : r < RP ? 0.5 * K.sstep(RI - 0.08, RP, r) : 0.5 * (1 - K.sstep(RP, RO, r));
  {
    const NR = 48, NA = 128, pos = [], col = [], idx = [];
    for (let j = 0; j <= NR; j++) for (let i = 0; i <= NA; i++) {
      const a = i / NA * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      const rmax = RO * (1 + 0.1 * K.nz(ca * 1.6, 3.1, sa * 1.6)) * (1 + 0.12 * Math.max(0, ca)), r = 0.01 + (j / NR) * (rmax - 0.01), rn = r / rmax * RO;
      const h = prof(rn) * (1 + 0.25 * K.nz(ca * 2, 1.3, sa * 2)) + (rn > RI ? 0.06 * K.nz(ca * r * 6, 4, sa * r * 6) + 0.04 * K.nz(ca * r * 13, 8, sa * r * 13) : 0);
      pos.push(ca * r, h, sa * r);
      const fresh = [0.11, 0.08, 0.06], dry = [0.26, 0.21, 0.16], deep = [0.015, 0.012, 0.014];
      const mix = (p, q, t) => p.map((w, k) => w + (q[k] - w) * Math.max(0, Math.min(1, t)));
      const c = rn < RI ? mix(deep, fresh, (rn - 0.55) / (RI - 0.55)) : mix(fresh, dry, (rn - RP - 0.2) / 0.5);
      const nn = 0.8 + 0.3 * K.nz(ca * r * 3, 5, sa * r * 3) + 0.25 * K.nz(ca * r * 12, 9, sa * r * 12); col.push(...c.map(w => w * nn * 1.35));
    }
    for (let j = 0; j < NR; j++) for (let i = 0; i < NA; i++) { const a = j * (NA + 1) + i, b = a + 1, c = a + NA + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const uv = []; for (let k = 0; k < pos.length; k += 3) uv.push(pos[k] / 1.5, pos[k + 2] / 1.5); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    L.mesh(g, K.crust('#ffffff', { rough: 0.95, ns: 0.8 }), 0, 0, 0, { parent: G });
  }
  const ringM = [K.crust('#5a4636', { rough: 0.97 }), K.crust('#4a3a2e', { rough: 0.97 }), K.crust('#6e5844', { rough: 0.97 })];
  for (let i = 0; i < 200; i++) {
    const a = L.rnd() * Math.PI * 2, r = RI + 0.05 + Math.pow(L.rnd(), 1.2) * (RO - RI), s = 0.03 + Math.pow(L.rnd(), 2.2) * 0.13 * (r < RP + 0.3 ? 1.2 : 0.7);
    L.mesh(clodGeo(s, i), ringM[i % 3], Math.cos(a) * r, prof(r) + s * 0.15, Math.sin(a) * r, { parent: G, dirt: 0.1, dirtH: s, ry: L.rnd() * 6.28 });
  }
  for (let i = 0; i < 7; i++) { const p = [1.0 + L.rnd() * 0.6, 0, (L.rnd() - 0.5) * 0.4]; const s = 0.035 + 0.035 * L.rnd(); const w = B.localToWorld(new THREE.Vector3(p[0], body.top(p[0], p[2]) + s * 0.4, p[2])); G.worldToLocal(w); L.mesh(clodGeo(s, i + 40), ringM[i % 3], w.x, w.y, w.z, { parent: G, dirt: 0 }); }
  for (let i = 0; i < 6; i++) { const a = L.rnd() * Math.PI * 2, r = RP + L.rnd() * 0.5; K.shard(G, [Math.cos(a) * r, prof(r) - 0.02, Math.sin(a) * r], [L.rnd() - 0.5, 0.5, L.rnd() - 0.5], 0.14 + L.rnd() * 0.1, 0.04, X, { collar: false }); }
  // bursting out (f=1, 2): clods thrown up into the air all round
  if (up && f <= 2) for (let i = 0; i < (f === 1 ? 60 : 30); i++) {
    const a = L.rnd() * Math.PI * 2, r = 0.4 + L.rnd() * (f === 1 ? 1.4 : 2.0), s = 0.03 + Math.pow(L.rnd(), 2) * 0.1;
    L.mesh(clodGeo(s, i + 90), ringM[i % 3], Math.cos(a) * r, 0.3 + L.rnd() * (f === 1 ? 1.2 : 0.7), Math.sin(a) * r, { parent: G, dirt: 0, ry: L.rnd() * 6.28 });
  }
  return null;                                       // the hole sits in the middle of the frame
}

// digIn: the Sapper digging (pose=dig): nose down and half under already (whatever is below the ground is hidden by
// an unseen floor at y = 0), the rump and tail still up behind, the hind feet braced. One spade hand is thrown up and
// back with a load of soil, the other is down in the hole beside its head. A heap of fresh soil all round where it
// goes in, highest at the sides where the hands throw it, and clods in the air over its back.
function digIn(L, K, G, B, body, o) {
  const { THREE } = K, toG = (p) => G.worldToLocal(B.localToWorld(new THREE.Vector3(...p)));
  G.updateMatrixWorld(true);
  const soil = [K.crust('#5a4636', { rough: 0.97 }), K.crust('#4a3a2e', { rough: 0.97 }), K.crust('#6e5844', { rough: 0.97 })];
  // the hands dig in turn (f = 0..3): one flung up and back with a load of soil while the other is down in the hole
  // (what moves frame to frame draws on its own random numbers, so the crater stays the same in every frame)
  let sd = 9001 + o.f * 7919; const rf = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  const raise = { '-1': [1, 0.55, 0, 0.4][o.f % 4], '1': [0, 0.4, 1, 0.55][o.f % 4] }, mix = (a, b, t) => a + (b - a) * t;
  for (const s of [-1, 1]) {
    const r = raise[s];
    const h = o.hand(s, { parent: B, plant: true, shoulder: [1.18, 0.42, s * 0.42 * o.fat], wrist: [mix(1.9, 0.55, r), mix(-0.25, 1.35, r), s * mix(0.7, 1.05, r) * o.fat],
      splay: mix(0.9, 2.2, r), tilt: mix(0.5, 1.7, r), droop: mix(0.4, -0.35, r), curl: mix(0.24, 0.4, r) });
    if (r > 0.3) for (let i = 0; i < Math.round(16 * r); i++) L.mesh(o.clodGeo(0.04 + 0.06 * rf(), i + 500), soil[i % 3], 0.3 + 0.5 * rf(), 0.1 + 0.1 * rf(), (rf() - 0.5) * 0.4, { parent: h.hand, dirt: 0 });
  }
  // the hind feet, braced out wide behind (on G: on the ground, whatever the tilt of the body)
  for (const s of [-1, 1]) {
    const h = toG([-2.2, 0.42, s * 0.28 * o.fat]);
    K.hindlimb(G, { side: s, f: o.f, plant: true, hip: [h.x, h.y, h.z], foot: [-2.5, 0.05, s * 0.5 * o.fat], len: 0.42, r: 0.22 * o.fat, stride: 0, lift: 0, skin: o.skinM, leg: o.furM, clawMat: o.nailM, out: 1.0 });
  }
  // the unseen floor: hides whatever is under the ground, draws nothing (its material is locked, so the glow pass,
  // which paints every plain mesh black, leaves it unseen there too)
  const flM = new THREE.MeshBasicMaterial({ colorWrite: false }), fl = new THREE.Mesh(new THREE.PlaneGeometry(40, 40).rotateX(-Math.PI / 2), flM);
  Object.defineProperty(fl, 'material', { get: () => flM, set: () => {} });
  fl.renderOrder = -10; L.getRoot().add(fl);
  // the hole, dark, where the head has gone (only its edges show round the body), then the heap of soil round it
  const cx = 1.45, hole = new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2); hole.scale(0.95, 1, 0.85);
  L.mesh(hole, K.crust('#140f0c', { rough: 1 }), cx + 0.15, 0.004, 0, { parent: G, dirt: 0 });
  const RI = 0.82, RO = 1.5;
  // the heap's outer edge and height at an angle round the hole (highest at the sides, where the hands throw it)
  const outer = (a) => RO * (0.82 + 0.18 * Math.abs(Math.sin(a)) + 0.12 * K.nz(Math.cos(a) * 1.7, 3, Math.sin(a) * 1.7));
  const heapH = (x, z) => {
    const r = Math.hypot(x, z), a = Math.atan2(z, x), t = Math.max(0, (r - RI) / (outer(a) - RI));
    if (t >= 1) return -0.02;
    const hk = (0.3 + 0.32 * Math.abs(Math.sin(a)) + 0.12 * Math.max(0, Math.cos(a))) * (1 + 0.35 * K.nz(x * 2.2, 1, z * 2.2));
    return Math.max(0.005, hk * Math.pow(Math.sin(Math.PI * Math.min(1, 0.15 + t * 0.95)), 0.8) + (0.11 * K.nz(x * 6, 4, z * 6) + 0.06 * K.nz(x * 13, 5, z * 13)) * (1 - t));
  };
  const ring = new THREE.RingGeometry(RI * 0.92, RO, 128, 20).rotateX(-Math.PI / 2), p = ring.attributes.position, col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x0 = p.getX(i), z0 = p.getZ(i), r = Math.hypot(x0, z0), a = Math.atan2(z0, x0), sc = r > RI * 1.01 ? outer(a) / RO : 1, x = x0 * sc, z = z0 * sc;
    const h = heapH(x, z); p.setXYZ(i, x, h, z);
    const b = 0.3 + 0.35 * Math.min(1, h * 1.8) + 0.18 * K.nz(x * 7, 2, z * 7); col[i * 3] = b * 0.36; col[i * 3 + 1] = b * 0.285; col[i * 3 + 2] = b * 0.22;
  }
  ring.setAttribute('color', new THREE.BufferAttribute(col, 3)); ring.computeVertexNormals();
  L.mesh(ring, K.crust('#ffffff', { rough: 0.97, ns: 1.2 }), cx, 0, 0, { parent: G });
  for (let i = 0; i < 520; i++) {
    const a = L.rnd() * Math.PI * 2, r = RI + 0.04 + Math.pow(L.rnd(), 1.2) * (outer(a) * 0.98 - RI), s = 0.025 + Math.pow(L.rnd(), 2.2) * 0.12, x = Math.cos(a) * r, z = Math.sin(a) * r;
    L.mesh(o.clodGeo(s, i), soil[i % 3], cx + x, Math.max(0, heapH(x, z)) + s * 0.1, z, { parent: G, dirt: 0.1, dirtH: s, ry: L.rnd() * 6 });
  }
  // clods in the air: thrown from each hand at the top of its stroke back over the body and off to the side, each
  // clod a little further along its arc each frame (so they fly), new ones leaving the hand that is up
  for (const s of [-1, 1]) {
    const top = toG([0.55, 1.35, s * 1.05 * o.fat]), hp = new THREE.Vector3(top.x + 0.25, top.y + 0.2, top.z);
    let sd2 = s > 0 ? 77 : 33; const rs = () => ((sd2 = (sd2 * 16807) % 2147483647) / 2147483647);
    const ph = ((o.f % 4) - (s > 0 ? 2 : 0) + 4) % 4 / 4;           // (each hand's throw half a cycle after the other's)
    for (let i = 0; i < 30; i++) {
      const t0 = rs(), t = (t0 + ph) % 1, sz = 0.03 + Math.pow(rs(), 2) * 0.08, sp = (rs() - 0.5) * 1.4 * t, ry = rs() * 6;
      if (t > 0.97) continue;
      L.mesh(o.clodGeo(sz, i + 300 + (s > 0 ? 50 : 0)), soil[i % 3], hp.x - t * 2.6, hp.y + 0.6 * Math.sin(Math.PI * t * 0.8) - t * 0.9, hp.z + s * t * 1.0 + sp, { parent: G, dirt: 0, ry: ry + t * 3 });
    }
  }
  return body;
}

// heave (pose=heave): the Sapper under the ground, where only the ground shows it: a low dome of soil heaving up and
// splitting at the head of its fresh ridge, the ridge itself running away behind (-x), clods tumbling off, and chips
// of crystal turned up in the cracks (they catch its charge: faint at night). The tell a player sees before it comes
// up inside the walls.
//   f=0..3: the loop as it goes, the dome rising and settling, its cracks opening and shifting, clods rolling off.
//   burst: the first frame of coming up (pose=up&f=0): a rounder dome split wide open, clods jumping off it.
function heave(L, K, G, X, f = 0, burst = false) {
  const { THREE } = K, soil = [K.crust('#5a4636', { rough: 0.97 }), K.crust('#4a3a2e', { rough: 0.97 }), K.crust('#6e5844', { rough: 0.97 })];
  const RX = burst ? 1.5 : 2.0 * (1 + 0.05 * [0, 1, 1.4, 0.6][f]), RZ = burst ? 1.4 : 1.3;   // (about the Sapper's own size: it is right under it)
  const lift = burst ? 0.95 : [0.62, 0.7, 0.76, 0.68][f], open = burst ? 0.3 : [0.12, 0.14, 0.17, 0.15][f], turn = burst ? 0 : f * 0.13;
  const crack = (x, z) => {
    const r = Math.hypot(x / RX, z / RZ), a = Math.atan2(z / RZ, x / RX), w = a * 3 + 0.9 + turn + 0.5 * K.nz(r * 2.5, 1.3, a);
    return Math.pow(Math.abs(Math.cos(w)), burst ? 14 : 40) * K.sstep(0.08, 0.3, r) * (1 - K.sstep(0.75, 1.0, r)) + Math.pow(Math.abs(Math.cos(r * 9 + turn * 2 + K.nz(x * 2, 3, z * 2))), 60) * K.sstep(0.3, 0.45, r) * (1 - K.sstep(0.6, 0.75, r)) * 0.6
      + (burst ? K.sstep(0.32, 0.12, r) * 1.2 : 0);                // (bursting: the middle broken open, dark)
  };
  const hgt = (x, z) => {
    const r = Math.hypot(x / RX, z / RZ), dome = lift * Math.pow(Math.max(0, 1 - r * r), 0.7);
    const t = Math.max(0, -x - 0.8) / 2.4, ridge = !burst && x < -0.8 ? 0.3 * (1 - t) * Math.exp(-((z / (0.6 * (1 - 0.3 * t))) ** 2)) * (t < 1 ? 1 : 0) : 0;
    return Math.max(dome, ridge) * (1 + 0.12 * K.nz(x * 3, 1, z * 3)) + (dome > 0.02 ? 0.03 * K.nz(x * 11, 6, z * 11) : 0) - open * crack(x, z) * (burst ? 2.2 : 1);
  };
  const g = new THREE.PlaneGeometry(7.2, 3.4, 260, 124).rotateX(-Math.PI / 2); g.translate(-0.5, 0, 0);
  const p = g.attributes.position, col = new Float32Array(p.count * 3), H = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), h = hgt(x, z), c = crack(x, z); H[i] = h; p.setY(i, Math.max(h, 0));
    const b = (0.36 + 0.32 * Math.min(1, h * 2.5) + 0.14 * K.nz(x * 6, 2, z * 6) + 0.08 * K.nz(x * 15, 4, z * 15)) * (1 - 0.85 * Math.min(1, c * 1.4)); col[i * 3] = b * 0.36; col[i * 3 + 1] = b * 0.285; col[i * 3 + 2] = b * 0.22;
  }
  // keep only the triangles above the ground
  const idx = g.index.array, keep = [];
  for (let i = 0; i < idx.length; i += 3) if (H[idx[i]] > 0.004 || H[idx[i + 1]] > 0.004 || H[idx[i + 2]] > 0.004) keep.push(idx[i], idx[i + 1], idx[i + 2]);
  g.setIndex(keep); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
  L.mesh(g, K.crust('#ffffff', { rough: 0.95, ns: 0.9 }), 0, 0, 0, { parent: G });
  const clod = (s, k) => { const q = new THREE.DodecahedronGeometry(1, 1), pp = q.attributes.position; for (let i = 0; i < pp.count; i++) { const w = 1 + 0.3 * K.nz(pp.getX(i) * 2 + k, pp.getY(i) * 2, pp.getZ(i) * 2); pp.setXYZ(i, pp.getX(i) * w, pp.getY(i) * w, pp.getZ(i) * w); } q.scale(s, s * 0.7, s); q.computeVertexNormals(); return q; };
  for (let i = 0; i < 150; i++) {
    let a = L.rnd() * Math.PI * 2, r = Math.pow(L.rnd(), 0.6) * 1.15; const s = 0.03 + Math.pow(L.rnd(), 2.2) * 0.1, ry = L.rnd() * 6;
    if (i % 2) { a += f * 0.22; r = Math.min(1.25, r + 0.06 * f); }                // (half of them rolling off as it goes)
    const x = Math.cos(a) * r * RX, z = Math.sin(a) * r * RZ, jump = burst && i % 3 === 0 ? 0.3 + 0.8 * L.rnd() : 0;
    L.mesh(clod(s, i), soil[i % 3], x, Math.max(0, hgt(x, z)) + s * 0.2 + jump, z, { parent: G, dirt: 0.1, dirtH: s, ry: ry + f });
  }
  // chips of crystal turned up in the cracks
  for (const [x, z, l] of [[0.5, -0.15, 0.36], [-0.4, 0.42, 0.28], [0.2, 0.62, 0.22], [-0.2, -0.6, 0.26], [1.1, 0.3, 0.2]]) K.cluster(G, [x, Math.max(0, hgt(x, z)) - 0.05, z], [x * 0.8, 1, z * 0.8], 3, l, l * 0.26, X, 0.6, { collar: false });
  return null;
}

// ---------------------------------------------------------------------------------------------------------------
// BURROW (c=burrow&s=1..3): the nest, the brief's "giant molehill of churned earth, ringed with crystal spires, veins
// running out from it". A heap of crumbly fresh soil thrown up in clods round a dark throat, the throat lined with crystal
// like the inside of a broken geode. Crystal spires stand round the rim, evenly spaced: the one detail that looks
// planned. Raised ridges of heaved earth (tunnels just under the surface) run off from it and branch, the Bloom's violet
// root-veins breaking through along them, and pulses of light running along the veins back to the nest (bright at night:
// a dark mirror of the player's roads). Level 1 is a small fresh heap with three short spires and one tunnel; level 2 a
// full ring of six and three tunnels; level 3 a giant mound, tall spires with smaller ones between, five tunnels, and
// rising out of the throat the tendril star of the Deep, the nest's heart, wider than a Hauler and never seen whole.
function burrow(L, K, lv) {
  const { THREE } = K, X = K.XTAL;
  const SC = [0, 0.64, 0.84, 1, 1.25][lv];
  L.getRoot().scale.setScalar(1.06 * SC * (lv === 4 ? DEEP_K : 1));
  const CZ = -0.3;
  const prof = [[0, -3.8], [0.35, -3.2], [0.75, -1.9], [1.0, -0.4], [1.2, 0.85], [1.45, 1.7], [1.85, 2.08], [2.3, 1.95], [2.85, 1.45], [3.4, 0.84], [3.9, 0.34], [4.3, 0.07], [4.6, -0.08]];
  const hProf = (r) => { for (let i = 1; i < prof.length; i++) if (r <= prof[i][0]) { const [r0, h0] = prof[i - 1], [r1, h1] = prof[i], t = (r - r0) / (r1 - r0), s = t * t * (3 - 2 * t); return h0 + (h1 - h0) * s; } return prof[prof.length - 1][1]; };
  const RH = 1.4, RMAX = 4.6;
  const soilM = K.crust('#ffffff', { rough: 0.95, ns: 0.8 });
  // ---- the mound: polar heightfield, vertex coloured, crumbly
  {
    const NR = 96, NA = 192, pos = [], col = [], idx = [];
    for (let j = 0; j <= NR; j++) for (let i = 0; i <= NA; i++) {
      const a = i / NA * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      const rmax = 4.15 + 0.45 * K.nz(ca * 1.7, 0.9, sa * 1.7) + 0.12 * Math.sin(a * 7 + 1) + 0.06 * Math.sin(a * 17);
      const r = 0.05 + (j / NR) * (rmax - 0.05), rn = r < 2.3 ? r : 2.3 + (r - 2.3) * (RMAX - 2.3) / (rmax - 2.3);
      let h = hProf(rn);
      if (r > 1.3) h += 0.25 * K.nz(ca * 1.5, 0.3, sa * 1.5) * Math.exp(-((r - 2.2) ** 2) / 1.2)
        + 0.1 * K.nz(ca * r * 2.2, 3, sa * r * 2.2) + 0.07 * K.nz(ca * r * 5, 7, sa * r * 5) + 0.04 * K.nz(ca * r * 11, 2, sa * r * 11);
      const rib = Math.sin(a * 7 + r * 5.5);
      if (r < RH + 0.1) h += 0.08 * rib * Math.min(1, (RH + 0.1 - r) / 0.3);
      pos.push(ca * r, h, CZ + sa * r);
      // fresh dark soil on the heap (thrown up from below, still damp), drying paler toward the foot; the throat's walls
      // banded like a geode's agate as they go down
      const fresh = [0.11, 0.08, 0.06], dry = [0.26, 0.21, 0.16], throat = [0.1, 0.085, 0.11], deep = [0.012, 0.01, 0.016], agate = [0.32, 0.27, 0.4];
      const mix = (p, q, t) => p.map((v, k) => v + (q[k] - v) * Math.max(0, Math.min(1, t)));
      let c;
      if (r > 1.6) c = mix(fresh, dry, (rn - 3.4) / 1.2);
      else if (r > RH) c = mix(throat, fresh, (r - RH) / 0.25);
      else { c = mix(deep, throat, (r - 0.2) / (RH - 0.2)); if (rib > 0.5) c = mix(c, agate, (rib - 0.5) * 1.4 * Math.min(1, r / 0.6)); }
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
  for (let i = 0; i < 520; i++) {
    const a = L.rnd() * Math.PI * 2, r = 1.45 + Math.pow(L.rnd(), 1.1) * 2.6, s = (0.035 + Math.pow(L.rnd(), 2.2) * 0.17 * (r < 2.6 ? 1.2 : 0.75)) / Math.sqrt(SC);
    clod(Math.cos(a) * r, CZ + Math.sin(a) * r, s, i);
  }
  // ---- the tunnels: raised ridges of heaved, broken earth (two staggered rows of dry soil lumps with a crack between)
  // running off under the surface and branching, and in the crack the Bloom's root-veins breaking through: violet, with
  // pulses of light running back along them to the nest. Each vein climbs the heap to the rim.
  const ridgeM = [K.crust('#6e5a46', { rough: 0.97 }), K.crust('#5f4c3b', { rough: 0.97 }), K.crust('#7a6550', { rough: 0.97 })];
  const veinM = new THREE.MeshStandardMaterial({ color: '#3c2450', emissive: new THREE.Color('#8a3cff').multiplyScalar(K.NIGHTISH ? 0.35 + K.GLOW * 0.4 : 0.06 + K.GLOW * 0.3), roughness: 0.7 });
  veinM.userData.glow = K.dimGlow('#9a4cff', 1.2);
  const pulseM = K.glowMat('#d8b8ff', 1.1, K.dimGlow('#b070ff', 2.6));
  const runsAll = [[0.6, 1, [0.4, 0.6], 1.85, 0.62], [2.5, -1, [0.3, -0.5], 1.85, 0.4], [4.3, 1, [0.5, 0.3], 2.0, 0.7], [3.5, -1, [0.6, 0.4], 1.6, 0.5], [5.4, 1, [0.35, -0.45], 1.7, 0.3]];
  const runs = runsAll.slice(0, [0, 1, 3, 5, 5][lv]);
  const vein = (pts, r0, seed) => {
    const c = K.curve(pts, 80);
    K.tube(null, c.map(([x, y, z], k) => [x, y + 0.012 * Math.sin(k * 0.9 + seed), z]), t => r0 * (1 - 0.6 * t) + 0.012, veinM, { n: 120, radial: 7, dirt: 0 });
    for (let k = 0; k < 4; k++) { const t = 0.12 + k * 0.23 + 0.05 * Math.sin(seed + k), p = c[Math.round(t * 80)], q = c[Math.min(80, Math.round(t * 80) + 2)];
      const m = K.seg(null, p, 0.075 * (1 - 0.4 * t) + 0.02, 0.03, 0.03, pulseM, { lump: 0 }); m.rotation.y = -Math.atan2(q[2] - p[2], q[0] - p[0]); }
  };
  const ridge = (c, ri, rowW = 1) => {
    for (let k = 0; k < c.length - 1; k++) {
      const t = k / (c.length - 1), p = c[k], q = c[k + 1], dx = q[0] - p[0], dz = q[2] - p[2], l = Math.hypot(dx, dz) || 1, fade = Math.min(1, t * 6, (1 - t) * 5);
      for (const sd of [-1, 1]) {
        const s0 = (0.13 + 0.08 * L.rnd()) * (0.4 + 0.6 * fade) * rowW, off = sd * (0.12 + 0.05 * L.rnd()) * fade * rowW;
        const g = clodGeo(s0, k * 2 + (sd > 0 ? 1 : 0) + ri * 200); g.scale(1.3, 0.75, 1.1);
        L.mesh(g, ridgeM[(k + ri + (sd > 0 ? 1 : 0)) % 3], p[0] - dz / l * off, -0.02 + s0 * 0.2, p[2] + dx / l * off, { dirt: 0, ry: Math.atan2(-dz, dx) + (L.rnd() - 0.5) * 0.6 });
      }
    }
  };
  runs.forEach(([a0, sgn, [wig, bend], len, br], ri) => {
    const pts = []; for (let k = 0; k <= 10; k++) { const t = k / 10, r = 3.2 + t * len / SC, a = a0 + sgn * bend * t * t + wig * 0.15 * Math.sin(t * 7 + ri); pts.push([Math.cos(a) * r, 0, CZ + Math.sin(a) * r]); }
    const c = K.curve(pts, 60);
    ridge(c, ri);
    // a branch: heading off toward something worth draining
    const b0 = Math.round(br * 10), bp = pts[b0], ba = Math.atan2(bp[2] - CZ, bp[0]) + sgn * 0.9, bpts = [bp];
    for (let k = 1; k <= 4; k++) bpts.push([bp[0] + Math.cos(ba) * k * 0.32 / SC, 0, bp[2] + Math.sin(ba) * k * 0.32 / SC + (L.rnd() - 0.5) * 0.08]);
    const bc = K.curve(bpts, 18);
    ridge(bc, ri + 50, 0.7);
    // the veins: from the far end of the tunnel along its crack, up the heap and over the rim into the throat
    const up = []; for (let k = 4; k >= 0; k--) { const r = 1.55 + k * 0.4, a = a0 + 0.04 * Math.sin(k * 2 + ri); up.push([Math.cos(a) * r, hProf(r) + 0.03, CZ + Math.sin(a) * r]); }
    vein([...c.slice().reverse().filter((_, k) => k % 6 === 0).map(([x, , z]) => [x, 0.02, z]), ...up], 0.05, ri * 3.1);
    vein([...bc.slice().reverse().filter((_, k) => k % 6 === 0).map(([x, , z]) => [x, 0.02, z]), [bp[0], 0.02, bp[2]]], 0.032, ri * 5.3 + 1);
    if (ri === 1) {     // a small fresh molehill where this tunnel breaks the surface
      const e = pts[pts.length - 1];
      K.seg(null, [e[0], -0.04, e[2]], 0.66, 0.42, 0.66, K.crust('#4a3a2e', { rough: 0.97 }), { lump: 0.14, flat: 1 });
      for (let k = 0; k < 60; k++) { const a = L.rnd() * 6.28, rr = Math.pow(L.rnd(), 0.6) * 0.66, s = 0.035 + L.rnd() * 0.06; L.mesh(clodGeo(s, k), clodM[k % 3], e[0] + Math.cos(a) * rr, -0.04 + 0.42 * Math.sqrt(Math.max(0, 1 - (rr / 0.66) ** 2)) + s * 0.1, e[2] + Math.sin(a) * rr, { dirt: 0, ry: L.rnd() * 6 }); }
    }
  });
  // ---- the throat: lined with crystal like the inside of a broken geode, a dense lining of small points and bigger
  // shards growing inward and up from the walls, brighter the deeper they sit
  {
    const geos = [], up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < 260; i++) {
      const a = L.rnd() * Math.PI * 2, r = 0.35 + L.rnd() * 1.05, h = hProf(r), len = 0.08 + L.rnd() * 0.14;
      const d = new THREE.Vector3(-Math.cos(a) * 0.8 + (L.rnd() - 0.5) * 0.4, 0.7 + L.rnd() * 0.4, -Math.sin(a) * 0.8 + (L.rnd() - 0.5) * 0.4).normalize();
      const cg = new THREE.ConeGeometry(len * 0.3, len, 5, 1); cg.translate(0, len / 2, 0);
      const cp = cg.attributes.position, cc = new Float32Array(cp.count * 3); for (let k = 0; k < cp.count; k++) { const b = 0.6 + 0.4 * cp.getY(k) / len; cc[k * 3] = cc[k * 3 + 1] = cc[k * 3 + 2] = b; }
      cg.setAttribute('color', new THREE.BufferAttribute(cc, 3)); cg.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, d)); cg.translate(Math.cos(a) * r, h - 0.02, CZ + Math.sin(a) * r);
      geos.push(cg.toNonIndexed());
    }
    L.mesh(mergeAll(K, geos), K.druseMat(X, 1), 0, 0, 0, { dirt: 0 });
  }
  for (let i = 0; i < 30; i++) {
    const a = i / 30 * Math.PI * 2 + L.rnd() * 0.2, r = 0.45 + L.rnd() * 0.85, h = hProf(r) + 0.02, deep = Math.max(0, Math.min(1, -h / 2.5));
    K.shard(null, [Math.cos(a) * r, h, CZ + Math.sin(a) * r], [-Math.cos(a) * 0.8, 1.0, -Math.sin(a) * 0.8], 0.35 + L.rnd() * 0.4, 0.07 + L.rnd() * 0.04, { ...X, k: 0.8 + deep * 0.9 }, { collar: false });
  }
  const coreM = K.glowMat('#c8a8ff', 1.2, K.dimGlow(X.glow, 1.5));
  L.mesh(new THREE.CircleGeometry(0.5, 24).rotateX(-Math.PI / 2), coreM, 0, -3.6, CZ, { cast: false, dirt: 0 });
  L.pointLight('#b48cff', 1.5 + K.GLOW * 7, 0, -2.4, CZ, 3.5);
  // ---- the spires round the rim, evenly spaced and tilted outward, each with smaller companions
  const nS = lv === 1 ? 3 : lv === 4 ? 9 : 6, hS = [0, 1.25, 1.75, 2.1, 2.5][lv];
  for (let k = 0; k < nS; k++) {
    const a = k / nS * Math.PI * 2 + 0.26, r = 1.75, ca = Math.cos(a), sa = Math.sin(a), h = hProf(r) - 0.15;
    K.shard(null, [ca * r, h, CZ + sa * r], [ca * 0.42, 1, sa * 0.42], (hS + (k % 2) * 0.4) / Math.sqrt(SC), 0.28 / Math.sqrt(SC), X, { collarMat: clodM[1] });
    for (const d of (lv === 1 ? [0.3] : [-0.3, 0.32])) { const b = a + d; K.shard(null, [Math.cos(b) * (r + 0.12), hProf(r + 0.12) - 0.08, CZ + Math.sin(b) * (r + 0.12)], [Math.cos(b) * 0.9 + Math.cos(a) * 0.2, 1, Math.sin(b) * 0.9], (0.55 + L.rnd() * 0.3) / Math.sqrt(SC), 0.1, X, { collar: false }); }
    if (lv >= 3) { const b = a + Math.PI / nS, rr = 2.35; K.shard(null, [Math.cos(b) * rr, hProf(rr) - 0.12, CZ + Math.sin(b) * rr], [Math.cos(b) * 0.55, 1, Math.sin(b) * 0.55], 1.0 + 0.3 * L.rnd(), 0.17, X, { collarMat: clodM[0] }); }
  }
  // ---- chips of crystal kicked out with the soil
  for (let i = 0; i < 10; i++) {
    const a = L.rnd() * Math.PI * 2, r = 2.6 + L.rnd() * 1.4;
    K.shard(null, [Math.cos(a) * r, hProf(r) - 0.03, CZ + Math.sin(a) * r], [L.rnd() - 0.5, 0.5, L.rnd() - 0.5], 0.18 + L.rnd() * 0.14, 0.05, X, { collar: false });
  }
  // ---- level 3: the Deep. Only its tendril star shows, rising out of the throat: thick fleshy rays, dark at the root,
  // their tips curling over and lit violet
  if (lv >= 3) {
    const SS = lv === 4 ? 1.6 : 1;      // the Deep's star: half as big again on its own mound, rising higher
    // thick fleshy rays coming up from deep in the throat and arching out over the rim between the spires, dark mauve at
    // the root, paler and lit violet toward the tips, the tips curled down
    const BK = lv === 4 ? 0.55 : 1;   // the Deep's bigger star burns no brighter per ray (more of it would blow out)
    const rayM = K.starMat('#4e3640', 0), midM = [0.2, 0.4].map(b => K.starMat('#8a6472', b * BK)), outM = [0.55, 0.75].map(b => K.starMat('#a8808e', b * BK)), tipM = K.starMat('#c8a0b0', BK);
    const N = lv === 4 ? 16 : 12;
    for (let k = 0; k < N; k++) {
      const a = (k + 0.5) / N * Math.PI * 2 + 0.26, ca = Math.cos(a), sa = Math.sin(a), L1 = 0.88 + 0.24 * Math.abs(Math.sin(k * 1.9 + 0.4));
      const P = [[0.12, -3.0], [0.28, -1.5], [0.5, -0.1], [0.82, 1.15], [1.25, 1.95 * (0.9 + 0.1 * L1)], [1.75 * L1, 2.2 * (0.85 + 0.15 * L1)], [2.2 * L1, 2.0], [2.45 * L1, 1.55]].map(([r, y]) => [ca * r * SS, y >= 0 ? y * SS : y, CZ + sa * r * SS]);
      const TK = SS === 1 ? 1 : SS * 0.85;
      K.tube(null, P.slice(0, 5), t => 0.24 * TK * (1 - 0.25 * t), rayM, { n: 40, radial: 12, dirt: 0 });
      K.tube(null, P.slice(3, 7), t => 0.19 * TK * (1 - 0.45 * t), midM[k % 2], { n: 30, radial: 11, dirt: 0 });
      K.tube(null, P.slice(5), t => (0.11 * (1 - 0.55 * t) + 0.03) * TK, outM[k % 2], { n: 24, radial: 10, dirt: 0 });
      L.sphere(0.07 * TK, tipM, P[7][0], P[7][1], P[7][2], { dirt: 0, cast: false });
    }
    K.seg(null, [0, -0.6, CZ], 0.75, 0.5, 0.75, K.starMat('#3e2a34', 0), { lump: 0.08 });      // the hub, deep in the throat
  }
  if (lv === 4) deepExtras();
  // ---- level 4 only: the cathedral floor round the Deep's mound. Three more tunnels (eight in all), satellite molehills
  // where they break the surface, and an outer ring of tall spires leaning out (built last, so levels 1-3 are unchanged)
  function deepExtras() {
    [[1.5, 1, [0.3, 0.5], 2.1, 0.5], [3.0, -1, [0.45, -0.4], 1.9, 0.6], [6.0, -1, [0.4, 0.35], 2.2, 0.45]].forEach(([a0, sgn, [wig, bend], len, br], ri) => {
      const pts = []; for (let k = 0; k <= 10; k++) { const t = k / 10, r = 3.2 + t * len / SC, a = a0 + sgn * bend * t * t + wig * 0.15 * Math.sin(t * 7 + ri); pts.push([Math.cos(a) * r, 0, CZ + Math.sin(a) * r]); }
      const c = K.curve(pts, 60);
      ridge(c, ri + 10);
      const up = []; for (let k = 4; k >= 0; k--) { const r = 1.55 + k * 0.4, a = a0 + 0.04 * Math.sin(k * 2 + ri); up.push([Math.cos(a) * r, hProf(r) + 0.03, CZ + Math.sin(a) * r]); }
      vein([...c.slice().reverse().filter((_, k) => k % 6 === 0).map(([x, , z]) => [x, 0.02, z]), ...up], 0.055, ri * 4.7 + 2);
    });
    // satellite molehills: fresh heaps where tunnels come up round the mound, each with a few small spires
    for (const [a, r, s0] of [[0.9, 5.2, 0.8], [2.9, 5.6, 0.65], [4.1, 5.0, 0.9], [5.3, 5.5, 0.7]]) {
      const x = Math.cos(a) * r, z = CZ + Math.sin(a) * r;
      K.seg(null, [x, -0.05, z], 0.9 * s0, 0.55 * s0, 0.9 * s0, K.crust('#4a3a2e', { rough: 0.97 }), { lump: 0.16, flat: 1 });
      for (let k = 0; k < 50; k++) { const b = L.rnd() * 6.28, rr = Math.pow(L.rnd(), 0.6) * 1.1 * s0, sz = 0.04 + L.rnd() * 0.07; L.mesh(clodGeo(sz, k + 900), clodM[k % 3], x + Math.cos(b) * rr, -0.04 + 0.5 * s0 * Math.sqrt(Math.max(0, 1 - (rr / (1.1 * s0)) ** 2)) + sz * 0.1, z + Math.sin(b) * rr, { dirt: 0, ry: L.rnd() * 6 }); }
      for (let k = 0; k < 3; k++) { const b = a + (k - 1) * 0.9; K.shard(null, [x + Math.cos(b) * 0.4 * s0, 0.3 * s0, z + Math.sin(b) * 0.4 * s0], [Math.cos(b) * 0.4, 1, Math.sin(b) * 0.4], (0.5 + L.rnd() * 0.4) * s0, 0.1, X, { collar: false }); }
    }
    for (let k = 0; k < 12; k++) {
      const a = k / 12 * Math.PI * 2 + 0.13, rr = 3.0 + 0.25 * Math.sin(k * 2.3);
      K.shard(null, [Math.cos(a) * rr, hProf(rr) - 0.1, CZ + Math.sin(a) * rr], [Math.cos(a) * 0.7, 1, Math.sin(a) * 0.7], 1.3 + 0.5 * L.rnd(), 0.2, X, { collarMat: clodM[2] });
    }
    L.pointLight('#b48cff', 0.4 + K.GLOW * 1.2, 0, 3.2, CZ, 6);
  }
}
// mergeAll(K, geos): merge a pile of small geometries into one
function mergeAll(K, geos) {
  const { THREE } = K, n = geos.reduce((s, g) => s + g.attributes.position.count, 0);
  const out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv', 'color']) {
    const sz = geos[0].attributes[name].itemSize, arr = new Float32Array(n * sz); let o = 0;
    for (const g of geos) { arr.set(g.attributes[name].array, o); o += g.attributes[name].array.length; }
    out.setAttribute(name, new THREE.BufferAttribute(arr, sz));
  }
  return out;
}

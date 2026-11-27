// One tile of Crystal Seedbed (a Seed Mast's bed: BDEFS.seedmast, SEED), seen like the plants and resources
// (orthographic, 70°), on a transparent shadow catcher so it lays over any ground.
//   ?g=0 prepared (raked dark bed, seed pins) | 1 seeded (pins lit, seed grit glinting) | 2 sprouting | 3 harvestable
//     | 4 starved (its Mast's upkeep lapsed: dulled, grey, no glow)
//   ?v=1..3 the variant (each its own scatter of sizes); ?tod=night for its glow pass (seedbed-<g>-glow)
// Grown Crystal stands in a regular 3 x 3 grid on its pins, a lighter lilac than Ring Crystal, its tips lit; Ring
// Crystal (the game's sprite) grows in one wild cluster. The pin caps are the Seed Mast's rose accent.
import { t3 } from './t3kit.js';
export const config = { pad: false, size: 1024 };
export default function (L) {
  const { THREE, M, box, cyl, sphere, rnd } = L;
  const p = new URLSearchParams(location.search), g = +(p.get('g') || 3), W = +(p.get('W') || 12.5);
  const K3 = t3(L);
  L.seed(90 + (+(p.get('v') || 1)) * 7);
  const nc = { dirt: 0, cast: false };
  const starved = g === 4;
  // the bed: a low dark mound of worked ground, raked furrows, a thin steel edging (the ruled grid)
  const bed = M.rough(starved ? '#4a4440' : '#2e2632');
  box(8.8, 0.12, 8.8, bed, 0, 0, 0, { dirt: 0, cast: false });
  for (let k = 0; k < 11; k++) box(8.6, 0.05, 0.12, M.rough(starved ? '#5a534c' : '#3e3443'), 0, 0.12, -4.1 + k * 0.82, nc);
  for (const x of [-1.45, 1.45]) box(0.06, 0.06, 8.6, M.paint('#5a6066', { rivets: false }), x, 0.12, 0, nc);
  for (const z of [-1.45, 1.45]) box(8.6, 0.06, 0.06, M.paint('#5a6066', { rivets: false }), 0, 0.12, z, nc);
  for (const [w, d, x, z] of [[9.0, 0.1, 0, 4.45], [9.0, 0.1, 0, -4.45], [0.1, 9.0, 4.45, 0], [0.1, 9.0, -4.45, 0]]) box(w, 0.16, d, M.paint('#6a7076', { rivets: false }), x, 0, z, { dirt: 0.2 });
  const pin = M.paint('#8a9096', { rivets: false });
  const capOn = M.emit('#f78fc0', g === 1 ? 2.6 : 1.4), capOff = M.plain('#3a3d44', 0.6);
  const grey = M.crystal('#77727e', '#000000', 0.0);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    const x = -2.9 + i * 2.9 + (rnd() - 0.5) * 0.3, z = -2.9 + j * 2.9 + (rnd() - 0.5) * 0.3;
    cyl(0.07, 0.5, pin, x + 0.75, 0.12, z + 0.3, { seg: 8, dirt: 0 }); sphere(0.11, starved ? capOff : capOn, x + 0.75, 0.66, z + 0.3, nc);
    if (g === 1) for (let k = 0; k < 7; k++) sphere(0.06, K3.cryTip, x + (rnd() - 0.5) * 1.1, 0.16, z + (rnd() - 0.5) * 1.1, nc);
    const s = g === 2 ? 0.35 + rnd() * 0.15 : g >= 3 ? 0.85 + rnd() * 0.2 : 0;
    if (s > 0) {
      const k = g === 2 ? 3 : 6;
      for (let n = 0; n < k; n++) {
        const a = n / k * 6.28 + rnd(), d = n === 0 ? 0 : 0.35 + rnd() * 0.25, h = (n === 0 ? 2.4 : 1.2 + rnd() * 0.8) * s, r = (n === 0 ? 0.34 : 0.2) * s + 0.06;
        L.crystal(r, h, r * 2.2, starved ? grey : K3.cryGrown, x + Math.cos(a) * d, 0.12, z + Math.sin(a) * d, n === 0 ? 0 : Math.sin(a) * 0.45, n === 0 ? 0 : -Math.cos(a) * 0.45);
        if (!starved && (n === 0 || g === 3)) sphere(r * 0.5, K3.cryTip, x + Math.cos(a) * d * 1.3, 0.12 + h + r * 1.6, z + Math.sin(a) * d * 1.3, nc);
      }
    }
  }
  const sg = new THREE.PlaneGeometry(40, 40); sg.rotateX(-Math.PI / 2);
  const sh = new THREE.Mesh(sg, new THREE.ShadowMaterial({ opacity: 0.4 })); sh.receiveShadow = true; L.getRoot().add(sh);
  const el = 70 * Math.PI / 180, cam = new THREE.OrthographicCamera(-W / 2, W / 2, W / 2, -W / 2, 0.1, 400);
  cam.position.set(0, Math.sin(el) * 120, Math.cos(el) * 120); cam.lookAt(0, 0, 0); cam.updateProjectionMatrix();
  L.getScene().traverse(o => { if (o.isDirectionalLight && o.castShadow) { const c = o.shadow.camera; c.left = c.bottom = -14; c.right = c.top = 14; c.far = 90; c.updateProjectionMatrix(); } });
  L.useCamera(cam);
}

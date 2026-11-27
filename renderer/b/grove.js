// A grove a Tree Nursery planted (S.grove, js/sim.js), one map tile (10 world units) of it, seen like the plants
// (orthographic, 70° down) on a transparent shadow catcher so it lays over any ground: Earth trees from the
// Pathfinder's seed stock, leafy broadleaves and spruce. Re-cut from the concept canvas's 3 x 3 groves as 1-tile pieces.
//   ?g=1 saplings (staked, mulch rings, tree guards) | 2 young | 3 mature
//   ?v=1..4 the variant: which trees stand on the tile and where (the game picks one per tile from its hash)
//   ?W=     world units across the frame (default 14: the crowns reach a little past their tile)
// The game draws them on the ground layer, graded with it for the time of day, so there are no re-lit versions.
// Shipped as art/resources/grove-<g>-<v>.webp, 256 px (tools/render_t2.sh, tools/install_t2.py).
export const config = { pad: false, size: 512 };
export default function (L) {
  const { THREE, M, mesh, cyl, sphere, rnd } = L;
  const p = new URLSearchParams(location.search), g = +(p.get('g') || 3), v = +(p.get('v') || 1), W = +(p.get('W') || 14);
  L.seed(2024 + v * 17 + g);
  const leafB = [M.plain('#3f7a34', 0.85), M.plain('#55933f', 0.85), M.plain('#2e5e2a', 0.85), M.plain('#6c9a44', 0.85)];
  const leafC = [M.plain('#28503a', 0.85), M.plain('#2f5e3f', 0.85), M.plain('#1f4430', 0.85)];
  const bark = M.plain('#5a3e26', 0.9), mulch = M.plain('#3e2e1e', 0.95);
  function broad(x, z, s) {
    const H = 3.6 * s, R = 2.1 * s;
    cyl(0.12 + 0.3 * s, H * 0.7, bark, x, 0, z, { seg: 8, dirt: 0 });
    const n = 9 + Math.round(10 * s);
    for (let i = 0; i < n; i++) { const a = rnd() * 6.28, d = rnd() * R * 0.7; sphere(R * (0.26 + rnd() * 0.22), leafB[Math.floor(rnd() * 4)], x + Math.cos(a) * d, H * (0.65 + rnd() * 0.35), z + Math.sin(a) * d, { dirt: 0 }); }
  }
  function spruce(x, z, s) {
    const H = 5.0 * s, R = 1.5 * s; cyl(0.1 + 0.2 * s, H * 0.3, bark, x, 0, z, { seg: 8, dirt: 0 });
    const k = 4 + Math.round(2 * s);
    for (let i = 0; i < k; i++) { const t = i / k; const cg = new THREE.ConeGeometry(R * (1 - t * 0.75), H * 0.38, 10); cg.translate(0, H * 0.19, 0); mesh(cg, leafC[i % 3], x, H * 0.18 + t * H * 0.6, z, { dirt: 0 }); }
  }
  function sapling(x, z, s) {
    // a staked sapling with a mulch ring and a tree guard
    cyl(0.6, 0.06, mulch, x, 0, z, { seg: 14, dirt: 0, cast: false });
    cyl(0.06, 1.4, M.wood, x + 0.3, 0, z, { seg: 6, dirt: 0 });
    cyl(0.05, 0.7 + s, bark, x, 0, z, { seg: 6, dirt: 0 });
    for (let i = 0; i < 3; i++) sphere(0.3 + s * 0.45, leafB[(i + Math.floor(rnd() * 4)) % 4], x + (rnd() - 0.5) * 0.35, 0.8 + s + rnd() * 0.3, z + (rnd() - 0.5) * 0.35, { dirt: 0 });
  }
  // The trees on the tile, by variant: [x, z, size, conifer]. Sizes are the mature ones; young trees are 0.55 of them.
  const LAYOUT = {
    1: [[0.2, 0.3, 1.45, false]],
    2: [[-1.9, -1.2, 1.15, true], [1.7, 1.3, 1.25, false]],
    3: [[-2.2, 1.6, 0.95, false], [2.0, 1.9, 0.9, true], [0.1, -2.0, 1.0, false]],
    4: [[-1.2, 0.8, 1.1, true], [1.6, -0.9, 1.0, true], [0.6, 2.4, 0.8, true]],
  };
  const trees = (g === 1 && (LAYOUT[v] || []).length < 2 ? LAYOUT[3] : LAYOUT[v] || LAYOUT[1]).slice().sort((a, b) => a[1] - b[1]);
  for (const [x, z, s, con] of trees) {
    const jx = (rnd() - 0.5) * 0.6, jz = (rnd() - 0.5) * 0.6;
    if (g === 1) { sapling(x + jx, z + jz, 0.15 + rnd() * 0.2); continue; }
    const k = g === 2 ? 0.55 : 1;
    (con ? spruce : broad)(x + jx, z + jz, s * k * (0.92 + rnd() * 0.16));
  }
  // shadow catcher: transparent ground that only shows shadows
  const sg = new THREE.PlaneGeometry(40, 40); sg.rotateX(-Math.PI / 2);
  const sh = new THREE.Mesh(sg, new THREE.ShadowMaterial({ opacity: 0.42 })); sh.receiveShadow = true; L.getRoot().add(sh);
  // camera: orthographic, 70° down, W units across
  const el = 70 * Math.PI / 180, cam = new THREE.OrthographicCamera(-W / 2, W / 2, W / 2, -W / 2, 0.1, 400);
  cam.position.set(0, Math.sin(el) * 120, Math.cos(el) * 120); cam.lookAt(0, 0, 0); cam.updateProjectionMatrix();
  L.getScene().traverse(o => { if (o.isDirectionalLight && o.castShadow) { const c = o.shadow.camera; c.left = c.bottom = -12; c.right = c.top = 12; c.far = 90; c.updateProjectionMatrix(); } });
  L.useCamera(cam);
}

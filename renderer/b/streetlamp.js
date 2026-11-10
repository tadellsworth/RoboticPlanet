// Streetlamps for roads, on a 256 canvas (rendered at 512). Orthographic camera at the buildings' 57 degrees, light from the
// top-left. The post's foot is at the bottom centre; the arm reaches right, over the road. 10 world units = 1 map tile;
// the whole lamp is about 0.9 tiles tall on screen.
//   ?kind=road     older sodium cobra-head lamp for concrete roads
//   ?kind=asphalt  modern white LED highway lamp for asphalt roads
//   &lit=1         only the glowing lamp head (lens), the rest kept as depth so it lines up exactly
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
export const config = { pad: false, size: 512 };

export default function (L) {
  const { box, cyl, hcyl, beam, pipe, hoop, sphere, mesh, group, ao, mark, M, THREE } = L;
  const q = new URLSearchParams(location.search), kind = q.get('kind') || 'road', LIT = q.get('lit') === '1';
  L.seed(kind === 'road' ? 801 : 802);

  // ---- orthographic camera: 1 tile (10 units) across the canvas, the foot at (128, 234) of 256
  const E = 57 * Math.PI / 180, HH = 5;
  const cam = new THREE.OrthographicCamera(-HH, HH, HH, -HH, 0.1, 200);
  const D = new THREE.Vector3(0, -Math.sin(E), -Math.cos(E)), U = new THREE.Vector3(0, Math.cos(E), -Math.sin(E));
  const T = U.clone().multiplyScalar(HH * (1 - 2 * (256 - 234) / 256));
  cam.position.copy(T).sub(D.clone().multiplyScalar(60)); cam.up.copy(U); cam.lookAt(T); cam.updateProjectionMatrix();
  L.useCamera(cam);

  const glowSet = new Set();
  let headTop = 0;
  if (kind === 'road') {
    const pole = M.paint('#5d6459', { rivets: false, metal: 0.35, rough: 0.6, panelW: 4096, panelH: 4096 }), housing = M.paint('#8a9087', { rivets: false, metal: 0.3, rough: 0.5 });
    // concrete footing, base flange with bolts, hazard collar, access hatch
    box(1.1, 0.45, 1.1, M.concrete, 0, 0, 0, { dirt: 0.6 }); ao(0, 0, 1.4, 1.4, 0.55);
    cyl(0.44, 0.12, M.steel, 0, 0.45, 0, { seg: 20, dirt: 0 });
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; cyl(0.05, 0.1, M.chrome, Math.cos(a) * 0.36, 0.57, Math.sin(a) * 0.36, { seg: 8, dirt: 0 }); }
    cyl(0.3, 1.5, pole, 0, 0.57, 0, { rTop: 0.27, seg: 20, dirt: 0.7, dirtH: 1.2 });
    cyl(0.31, 0.55, M.hazard, 0, 0.9, 0, { rTop: 0.3, seg: 20, dirt: 0 });
    box(0.22, 0.42, 0.06, M.dark, 0, 1.55, 0.27, { dirt: 0 });
    // tapered pole
    cyl(0.25, 11.6, pole, 0, 2.05, 0, { rTop: 0.16, seg: 18, dirt: 0.15, dirtH: 3 });
    cyl(0.22, 0.25, M.steel, 0, 13.4, 0, { seg: 16, dirt: 0 });
    // swan-neck arm with a brace
    pipe([[0, 13.5, 0], [0.25, 14.35, 0], [0.9, 14.8, 0], [2.4, 14.92, 0]], 0.12, pole);
    beam([0, 12.2, 0], [1.35, 14.82, 0], 0.07, 0.07, pole);
    // cobra-head housing: long rounded shell, slight nose-down tilt, ballast hump and photocell on top
    const g = group(3.15, 14.8, 0, 0); g.rotation.z = -0.07;
    const shell = new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2); shell.scale(0.95, 0.42, 0.5);
    mesh(shell, housing, 0, 0, 0, { parent: g, dirt: 0.2 });
    cyl(0.5, 0.06, housing, 0, -0.03, 0, { parent: g, dirt: 0 }).scale.set(1.9, 1, 1.0);
    box(0.7, 0.22, 0.5, housing, -0.45, 0.25, 0, { parent: g, dirt: 0 });
    cyl(0.09, 0.14, M.dark, -0.55, 0.47, 0, { parent: g, seg: 12, dirt: 0 });
    hcyl(0.15, 0.4, pole, -1.0, 0.05, 0, { axis: 'x', parent: g });
    // drop-glass sodium lens under the housing (amber when unlit)
    const lensGeo = new THREE.SphereGeometry(1, 28, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2); lensGeo.scale(0.78, 0.3, 0.4);
    const lensMat = LIT ? M.emit('#ffb066', 3.2) : new THREE.MeshPhysicalMaterial({ color: '#c99a5a', roughness: 0.2, metalness: 0, transparent: true, opacity: 0.85, clearcoat: 0.6, envMapIntensity: 1.2 });
    if (LIT) lensMat.userData.glow = '#ff9234';
    glowSet.add(mesh(lensGeo, lensMat, 0.1, -0.02, 0, { parent: g, cast: false, dirt: 0 }));
    mark('lens', 0.1, -0.15, 0, g);
    headTop = 15.2;
  } else {
    const galv = M.plain('#a9aeb3', 0.38, 0.65), dark = M.paint('#3a3f45', { rivets: false, metal: 0.5, rough: 0.45 });
    // round concrete footing with a reflective band, square base plate with bolts, base cover
    cyl(0.62, 0.5, M.concrete, 0, 0, 0, { seg: 24, dirt: 0.5 }); ao(0, 0, 1.4, 1.4, 0.55);
    cyl(0.635, 0.16, M.hazard, 0, 0.26, 0, { seg: 24, dirt: 0 });
    box(0.78, 0.08, 0.78, M.steel, 0, 0.5, 0, { dirt: 0 });
    for (const [x, z] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) cyl(0.05, 0.12, M.chrome, x, 0.58, z, { seg: 8, dirt: 0 });
    cyl(0.32, 0.7, galv, 0, 0.58, 0, { rTop: 0.28, seg: 8, ry: Math.PI / 8, dirt: 0.3 });
    // tall tapered octagonal galvanized pole
    cyl(0.27, 13.75, galv, 0, 1.28, 0, { rTop: 0.13, seg: 8, ry: Math.PI / 8, dirt: 0.08, dirtH: 2 });
    // straight, slightly upswept arm with a tension rod
    const top = 15.0;
    pipe([[0, top - 0.3, 0], [0, top, 0], [3.0, top + 0.22, 0]], 0.1, galv);
    beam([0, top - 1.3, 0], [1.9, top + 0.14, 0], 0.045, 0.045, galv);
    // slim flat LED luminaire with cooling fins; a lit panel underneath and a thin light strip round its front edge
    const g = group(3.55, top + 0.18, 0, 0); g.rotation.z = 0.04;
    const body = new RoundedBoxGeometry(1.95, 0.24, 0.74, 3, 0.1); body.translate(0, 0.12, 0);
    mesh(body, dark, 0, -0.08, 0, { parent: g, dirt: 0 });
    box(0.9, 0.05, 0.4, M.paint('#4a5057', { rivets: false }), -0.25, 0.15, 0, { parent: g, dirt: 0 });
    hcyl(0.13, 0.36, galv, -1.05, 0.04, 0, { axis: 'x', parent: g });
    const panelMat = LIT ? M.emit('#eef4ff', 3.4) : new THREE.MeshPhysicalMaterial({ color: '#cfd8e2', roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.92, clearcoat: 0.6, envMapIntensity: 1.2 });
    if (LIT) panelMat.userData.glow = '#e4eeff';
    glowSet.add(box(1.7, 0.07, 0.6, panelMat, 0.02, -0.12, 0, { parent: g, cast: false, dirt: 0 }));
    glowSet.add(box(1.72, 0.04, 0.04, panelMat, 0.02, -0.05, 0.34, { parent: g, cast: false, dirt: 0 }));
    mark('lens', 0.02, -0.15, 0, g);
    headTop = top + 0.5;
  }

  if (LIT) {
    const depthOnly = new THREE.MeshBasicMaterial({ colorWrite: false });
    L.getRoot().traverse(o => {
      if (!o.isMesh || glowSet.has(o)) return;
      if (o.userData.decal) { o.visible = false; return; }
      o.material = depthOnly; o.castShadow = false; o.renderOrder = -10;
    });
  }
  mark('foot', 0, 0, 0); mark('top', 0, headTop, 0);
}

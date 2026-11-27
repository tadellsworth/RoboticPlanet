// A sprinkler head on an irrigation line (js/terraform2.js draws one where a Water Pump's water comes out of a pipe's
// end, its spray in code over it): a short riser from a buried feed, an impact sprinkler head with its arm and nozzle,
// a brass collar, a stake and a puddle ring of wet earth. Seen like the plants (orthographic, 70° down) on a
// transparent shadow catcher. W = world units across the frame (default 3.2: about a third of a tile).
// Shipped as art/resources/sprinkler.webp, 128 px.
export const config = { pad: false, size: 256 };
export default function (L) {
  const { THREE, M, mesh, cyl, box, sphere } = L;
  const p = new URLSearchParams(location.search), W = +(p.get('W') || 3.2);
  L.seed(77);
  const brass = M.plain('#b08a3c', 0.45), steel = M.steel, black = M.plain('#25282b', 0.7), mud = M.plain('#3a2a1c', 0.95);
  cyl(0.5, 0.02, mud, 0, 0, 0, { seg: 24, dirt: 0, cast: false });
  cyl(0.22, 0.12, M.concrete, 0, 0, 0, { seg: 16, dirt: 0 });
  cyl(0.06, 0.9, steel, 0, 0.12, 0, { seg: 10, dirt: 0 });
  cyl(0.09, 0.1, brass, 0, 0.95, 0, { seg: 12, dirt: 0 });
  // the head: a body, the nozzle angled up, the impact arm with its spring
  box(0.22, 0.14, 0.14, brass, 0, 1.05, 0, { dirt: 0 });
  const nz = new THREE.CylinderGeometry(0.035, 0.05, 0.38, 8); nz.rotateZ(-Math.PI / 2.6); mesh(nz, brass, 0.2, 1.2, 0, { dirt: 0 });
  box(0.42, 0.03, 0.05, black, -0.05, 1.24, 0.07, { dirt: 0 });
  sphere(0.05, black, -0.24, 1.25, 0.07, { dirt: 0 });
  // a stake beside it with a little orange flag (the Accord's survey colour)
  cyl(0.025, 0.9, M.wood, 0.45, 0, -0.35, { seg: 6, dirt: 0 });
  box(0.18, 0.1, 0.01, M.plain('#e07a28', 0.8), 0.54, 0.75, -0.35, { dirt: 0 });
  const sg = new THREE.PlaneGeometry(12, 12); sg.rotateX(-Math.PI / 2);
  const sh = new THREE.Mesh(sg, new THREE.ShadowMaterial({ opacity: 0.42 })); sh.receiveShadow = true; L.getRoot().add(sh);
  const el = 70 * Math.PI / 180, cam = new THREE.OrthographicCamera(-W / 2, W / 2, W / 2, -W / 2, 0.1, 400);
  cam.position.set(0, Math.sin(el) * 120, Math.cos(el) * 120); cam.lookAt(0, 0.4, 0); cam.updateProjectionMatrix();
  L.getScene().traverse(o => { if (o.isDirectionalLight && o.castShadow) { const c = o.shadow.camera; c.left = c.bottom = -4; c.right = c.top = 4; c.far = 90; c.updateProjectionMatrix(); } });
  L.useCamera(cam);
}

// App icon hero: head-and-shoulders bust of a worn colony robot with one big glowing cyan eye.
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
export const config = { size: 2048, pad: false, lights: false };

export default function (L) {
  const { box, cyl, hcyl, pipe, sphere, mesh, M, THREE } = L;
  const CYAN = '#38d4ff';
  const off = M.paint('#cdc8ba', { panelW: 512, panelH: 256 }), gun = M.paint('#4b5157'), steel = M.steel;
  L.seed(7);
  const root = L.getRoot(), scene = L.getScene();
  root.rotation.y = -0.34; root.rotation.x = 0.04;

  // ---- lighting: warm key from top-left, cyan rim from back-right, orange planet rim from back-left
  const key = new THREE.DirectionalLight(0xffd3a2, 3.3); key.position.set(-5, 6.5, 7); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 30 }); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
  const rim = new THREE.DirectionalLight(0x38d4ff, 5.0); rim.position.set(6, 3, -5);
  const rim2 = new THREE.DirectionalLight(0xff8a3c, 3.2); rim2.position.set(-6, 1.5, -4);
  scene.add(key, rim, rim2, new THREE.HemisphereLight(0x8a93b8, 0xa8582a, 0.65));

  // ---- shoulders and neck (cropped by the bottom of the icon)
  box(4.8, 1.2, 2.4, gun, 0, -2.95, -0.25);
  for (const s of [-1, 1]) {
    mesh(new RoundedBoxGeometry(1.7, 0.85, 2.3, 4, 0.22), off, s * 1.8, -1.95, -0.15);
    box(1.5, 0.13, 0.07, M.hazard, s * 1.8, -1.72, 1.0, { dirt: 0 });
  }
  cyl(0.72, 0.75, steel, 0, -1.85, 0);
  for (const y of [-1.55, -1.35]) L.hoop(0.74, 0.05, gun, 0, y, 0);
  pipe([[-0.45, -1.2, 0.45], [-0.85, -1.45, 0.75], [-1.3, -1.62, 0.8]], 0.09, M.dark);
  pipe([[0.45, -1.2, 0.45], [0.85, -1.45, 0.75], [1.3, -1.62, 0.8]], 0.09, M.dark);

  // ---- head shell
  mesh(new RoundedBoxGeometry(2.5, 2.0, 2.1, 6, 0.42), off, 0, 0, 0);
  box(1.05, 0.26, 1.7, gun, 0, 0.93, -0.12, { dirt: 0 });
  box(1.5, 0.13, 0.08, M.hazard, 0, 0.5, 1.02, { dirt: 0 });

  // visor recess with dark glass
  mesh(new RoundedBoxGeometry(2.05, 0.98, 0.22, 4, 0.13), gun, 0, -0.03, 0.98, { dirt: 0 });
  const glass = new THREE.MeshStandardMaterial({ color: '#0a1317', roughness: 0.12, metalness: 0.3 }); glass.envMapIntensity = 1.6;
  mesh(new RoundedBoxGeometry(1.84, 0.78, 0.1, 4, 0.1), glass, 0, -0.03, 1.07, { dirt: 0 });

  // the eye: steel housing, chrome ring, glowing lens with a white-hot core
  const ex = -0.12, ey = -0.03;
  hcyl(0.62, 0.36, steel, ex, ey, 1.18, { axis: 'z', seg: 48 });
  mesh(new THREE.TorusGeometry(0.53, 0.07, 14, 56), M.chrome, ex, ey, 1.36, { dirt: 0 });
  hcyl(0.47, 0.05, M.emit('#1fa8d8', 0.85), ex, ey, 1.36, { axis: 'z', seg: 48, cast: false });
  hcyl(0.33, 0.05, M.emit(CYAN, 1.1), ex, ey, 1.375, { axis: 'z', seg: 48, cast: false });
  mesh(new THREE.TorusGeometry(0.33, 0.025, 10, 48), M.plain('#0d2a33', 0.4, 0.4), ex, ey, 1.4, { dirt: 0, cast: false });
  hcyl(0.15, 0.03, M.emit('#d9f8ff', 2.2), ex, ey, 1.41, { axis: 'z', seg: 32, cast: false });
  const glare = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.75, depthWrite: false });
  const gl = new THREE.CircleGeometry(0.11, 24); gl.scale(1.6, 0.8, 1);
  mesh(gl, glare, ex - 0.2, ey + 0.22, 1.43, { rz: 0.6, cast: false, dirt: 0 });

  // little status LEDs and a chin vent
  for (let i = 0; i < 3; i++) box(0.09, 0.09, 0.05, M.emit(CYAN, 1.2), 0.5 + i * 0.15, 0.16, 1.1, { cast: false, dirt: 0 });
  box(0.36, 0.07, 0.05, M.emit('#ffb02e', 1.0), 0.66, -0.2, 1.1, { cast: false, dirt: 0 });
  box(0.95, 0.28, 0.1, M.grille('#3a3f44'), 0, -0.78, 0.98, { dirt: 0 });

  // ears with vent caps and a faint cyan ring
  for (const s of [-1, 1]) {
    hcyl(0.56, 0.34, gun, s * 1.32, 0.02, -0.05, { axis: 'x', seg: 40 });
    hcyl(0.4, 0.06, M.grille('#2c3034'), s * 1.5, 0.02, -0.05, { axis: 'x', seg: 40 });
    mesh(new THREE.TorusGeometry(0.47, 0.035, 8, 48), M.emit(CYAN, 0.7), s * 1.5, 0.02, -0.05, { ry: Math.PI / 2, cast: false, dirt: 0 });
  }

  // antenna with beacon
  cyl(0.05, 1.05, steel, 0.72, 0.9, -0.45, { dirt: 0 });
  cyl(0.12, 0.12, gun, 0.72, 0.9, -0.45, { dirt: 0 });
  sphere(0.12, M.emit(CYAN, 1.3), 0.72, 2.0, -0.45, { cast: false });

  // camera
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  cam.position.set(1.0, 0.85, 9.3); cam.lookAt(0, -0.12, 0); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  L.useCamera(cam);
}

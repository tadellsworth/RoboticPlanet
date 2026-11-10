// Refinery: twin distillation columns with platforms, spherical storage tanks, pipe rack, heater box, burning flare stack.
// ?part=work&f=k: only the column lights, blinking slowly (frame k of 8). The flare flame comes from fx-flare.
import { workLayer, litMat } from './worklib.js';
const BLINK = [[1.7, 1.7, 1.2, 0.35, 0.25, 0.3, 0.9, 1.5], [0.3, 0.9, 1.6, 1.7, 1.6, 0.9, 0.3, 0.25], [1.6, 0.4, 0.3, 1.6, 0.4, 0.3, 1.6, 0.4]];
export default function (L) {
  const q = new URLSearchParams(location.search), WORK = q.get('part') === 'work', F = +(q.get('f') || 0);
  const blink = [];
  const { box, cyl, hcyl, beam, pipe, hoop, lamp, pointLight, ao, mesh, sphere, ladder, ringWalk, M, THREE, ACCENT } = L;
  const gun = M.paint('#50565c'), off = M.paint('#cfcbc0'), warm = M.paint('#8c8579');
  L.seed(141);

  // distillation columns (back left)
  const cols = [[-2.5, -2.4, 0.62, 6.6], [-1.0, -3.3, 0.48, 5.2]];
  for (const [x, z, r, h] of cols) {
    box(r * 2 + 0.5, 0.45, r * 2 + 0.5, M.concrete, x, 0, z); ao(x, z, r * 2 + 0.5, r * 2 + 0.5, 0.5);
    cyl(r, h, off, x, 0.45, z, { seg: 32, dirtH: 1.2 });
    sphere(r, off, x, 0.45 + h, z, { dome: true });
    for (let y = 1.6; y < h; y += 1.6) ringWalk(x, y + 0.45, z, r + 0.02, r + 0.45, { posts: 12 });
    blink.push(hoop(r + 0.03, 0.06, M.emit(ACCENT, 2.2), x, h + 0.2, z, { cast: false }));
    ladder(x + r + 0.3, 0.45, h - 0.2, z + 0.3, { ry: Math.PI / 2 });
  }
  pipe([[-2.5, 6.5, -2.4], [-2.5, 7.25, -2.4], [-1.0, 7.25, -2.4], [-1.0, 5.9, -2.4], [-1.0, 5.9, -2.85]], 0.13, M.steel);

  // pipe rack across the middle
  for (const x of [-3.6, -1.2, 1.2, 3.6]) { box(0.2, 2.3, 0.2, gun, x, 0, -0.3); box(0.2, 2.3, 0.2, gun, x, 0, 0.5); box(0.25, 0.18, 1.0, gun, x, 2.3, 0.1, { dirt: 0 }); }
  beam([-3.7, 2.4, -0.3], [3.7, 2.4, -0.3], 0.15, 0.15, gun); beam([-3.7, 2.4, 0.5], [3.7, 2.4, 0.5], 0.15, 0.15, gun);
  const pc = [M.paint('#8d949a', { rivets: false }), M.paint('#3f6b6b', { rivets: false }), M.paint('#b8952e', { rivets: false })];
  [-0.1, 0.15, 0.4].forEach((dz, i) => pipe([[-3.8, 2.62, dz], [3.8, 2.62, dz]], 0.11, pc[i]));
  pipe([[-2.5, 1.0, -1.8], [-2.5, 2.62, -1.8], [-2.5, 2.62, -0.1]], 0.12, M.steel);

  // spherical storage tanks on legs (back right)
  for (const [x, z, r] of [[1.9, -2.6, 1.05], [3.75, -1.25, 0.85]]) {
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; box(0.12, r + 0.5, 0.12, gun, x + Math.cos(a) * r * 0.8, 0, z + Math.sin(a) * r * 0.8); }
    sphere(r, off, x, r + 0.55, z); hoop(r * 0.99, 0.04, gun, x, r + 0.55, z); ao(x, z, r * 2, r * 2, 0.45);
    ladder(x - r - 0.05, 0, r * 2 + 0.4, z + 0.3, { ry: Math.PI / 2 });
  }

  // fired heater (front left) and product tanks (front right)
  box(2.2, 2.0, 1.5, gun, -2.7, 0, 2.3); box(2.3, 0.15, 1.6, warm, -2.7, 2.0, 2.3, { dirt: 0 }); ao(-2.7, 2.3, 2.2, 1.5, 0.5);
  cyl(0.28, 1.6, M.steel, -2.7, 2.15, 2.3, { soot: 0.6 });
  box(1.4, 0.3, 0.05, M.emit('#ff7a2a', 1.6), -2.7, 0.35, 3.06, { cast: false });
  for (const [x, z] of [[1.6, 2.6], [3.4, 2.6]]) { cyl(0.82, 1.5, off, x, 0, z, { seg: 32 }); cyl(0.85, 0.1, gun, x, 1.5, z, { dirt: 0 }); hoop(0.84, 0.04, M.emit(ACCENT, 1.6), x, 1.2, z, { cast: false }); }
  ao(2.5, 2.6, 3.6, 1.7, 0.5);
  pipe([[1.6, 0.3, 1.8], [1.6, 0.3, 0.9], [1.2, 0.3, 0.9]], 0.08, M.steel);

  // flare stack (back right corner) with a burning tip
  const fx = 4.2, fz = -4.1;
  box(0.8, 0.3, 0.8, M.concrete, fx, 0, fz);
  cyl(0.16, 4.9, M.paint('#9b3a2a', { rivets: false }), fx, 0.3, fz, { seg: 14, soot: 1.0 });
  for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2 + 0.4; beam([fx + Math.cos(a) * 0.9, 0.05, fz + Math.sin(a) * 0.9], [fx, 3.4, fz], 0.03, 0.03, M.dark); }
  mesh(new THREE.ConeGeometry(0.32, 1.0, 16), M.emit('#ff6a1a', 2.4), fx, 5.7, fz, { cast: false, dirt: 0 });
  mesh(new THREE.ConeGeometry(0.17, 0.62, 16), M.emit('#ffe08a', 3.5), fx, 5.52, fz, { cast: false, dirt: 0 });
  pointLight('#ff7a2a', 5, fx, 5.6, fz + 0.5, 4);
  lamp(-1.0, 5.95, -3.3, ACCENT, { shape: 'sphere', size: 0.13, intensity: 2, dist: 3, k: 2.6 });
  blink.push(L.getRoot().children[L.getRoot().children.length - 1]);
  if (WORK) {
    blink.forEach((m, i) => { m.material = litMat(L, ACCENT, i === 2 ? 2.6 : 2.2, BLINK[i][F], 1.7); });
    workLayer(L, new Set(blink));
  }
}

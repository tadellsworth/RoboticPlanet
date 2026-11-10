// Oil Pump: classic pumpjack (walking beam, horse head, samson post, crank and counterweights), wellhead, storage tank.
// ?part=base      the pumpjack without its moving parts (walking beam, horse head, bridle, cranks, pitman arms)
// ?part=work&f=k  only the moving parts, frame k of 8 through one stroke, with their shadows on the building
import { workLayer, hideParts } from './worklib.js';
export default function (L) {
  const { box, cyl, hcyl, beam, pipe, hoop, lamp, pointLight, ao, mesh, sphere, ladder, group, M, THREE, ACCENT } = L;
  const q = new URLSearchParams(location.search), part = q.get('part') || 'full', F = +(q.get('f') || 0);
  const moving = new Set(), mv = o => (moving.add(o), o);
  // pose: crank angle, beam angle, crank-pin radius used by the pitman arms, carrier-bar height
  let theta = 0.6, phi = -0.13, pinR = 0.75, carrierY = null;
  if (part === 'work') {
    // a consistent crank-rocker linkage (pin on the inner crank hole) solved for 8 crank positions
    const P = [0.3, 4.55], C = [2.6, 1.45], Lp = 2.45, r = 0.5;
    const rot = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
    const solve = (t, prev) => { let best = 1e9, bf = prev; for (let i = -1500; i <= 1500; i++) { const f = prev + i * 0.0004; const pn = rot(r, 0, t), e = rot(2.15, -0.4, f);
      const d = Math.hypot(C[0] + pn[0] - P[0] - e[0], C[1] + pn[1] - P[1] - e[1], 0.15) - Lp; if (Math.abs(d) < best) { best = Math.abs(d); bf = f; } } return bf; };
    const phis = []; let prev = -0.13; for (let k = 0; k < 9; k++) { prev = solve(0.6 + 2 * Math.PI * k / 8 * -1, prev); phis.push(prev); }
    theta = 0.6 - 2 * Math.PI * F / 8; phi = phis[F]; pinR = r;
    const hy = f => P[1] + rot(-4.3, -1.0, f)[1], hmin = Math.min(...phis.map(hy));
    carrierY = 0.62 + (hy(phi) - hmin);
  }
  const yel = M.paint('#c49a26'), gun = M.paint('#50565c'), off = M.paint('#c9c5ba'), red = M.paint('#8a3a2a');
  L.seed(131);
  const z0 = -0.9, bh = 0.4;

  // skid and oil-stained ground
  box(7.0, bh, 1.8, gun, -0.2, 0, z0); ao(-0.2, z0, 7.0, 1.8, 0.55);
  const oil = new THREE.MeshBasicMaterial({ color: '#0b0806', transparent: true, opacity: 0.55, depthWrite: false });
  const st = new THREE.CircleGeometry(1.0, 24); st.rotateX(-Math.PI / 2); st.scale(1.3, 1, 0.8); const sm = mesh(st, oil, -3.2, 0.006, z0 + 0.9, { cast: false }); sm.userData.decal = true;

  // samson post (A-frame) and walking beam with horse head, tilted mid-stroke
  const px = 0.3, py = 4.4;
  for (const [x, z] of [[-0.6, z0 - 0.7], [-0.6, z0 + 0.7], [1.2, z0 - 0.7], [1.2, z0 + 0.7]]) beam([x, bh, z], [px, py - 0.1, z0 + (z - z0) * 0.25], 0.22, 0.22, yel);
  box(0.5, 0.3, 0.7, M.steel, px, py - 0.25, z0, { dirt: 0 });
  const wb = mv(group(px, py + 0.15, z0)); wb.rotation.z = phi;
  box(5.9, 0.42, 0.42, yel, -0.6, -0.21, 0, { parent: wb, dirt: 0 });
  const head = new THREE.Shape(); head.moveTo(0, 0.55); head.lineTo(0.5, 0.55); head.absarc(0.0, -0.25, 0.95, Math.PI * 0.27, Math.PI * 1.38, false); head.lineTo(0.35, -0.75); head.closePath();
  const hg = new THREE.ExtrudeGeometry(head, { depth: 0.55, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03 }); hg.translate(0, 0, -0.275);
  const hm = new THREE.Mesh(hg, yel); hm.position.set(-3.55, 0, 0); hm.castShadow = true; hm.receiveShadow = true; wb.add(hm);
  box(0.6, 0.5, 0.5, red, 2.15, -0.25, 0, { parent: wb, dirt: 0 });
  wb.updateMatrixWorld(true);
  const hp = new THREE.Vector3(-4.3, -1.0, 0).applyMatrix4(wb.matrixWorld);

  // bridle and polished rod down to the wellhead
  const wx = hp.x, wz = z0;
  if (carrierY === null) {
    mv(box(0.035, hp.y - 1.2, 0.035, M.dark, wx - 0.08, 1.2, wz, { dirt: 0 })); mv(box(0.035, hp.y - 1.2, 0.035, M.dark, wx + 0.08, 1.2, wz, { dirt: 0 }));
    mv(box(0.4, 0.12, 0.2, M.steel, wx, 1.15, wz, { dirt: 0 })); mv(cyl(0.05, 0.75, M.chrome, wx, 0.45, wz, { dirt: 0 }));
  } else {
    const cy = carrierY;
    mv(box(0.035, hp.y - cy - 0.05, 0.035, M.dark, wx - 0.08, cy + 0.05, wz, { dirt: 0 })); mv(box(0.035, hp.y - cy - 0.05, 0.035, M.dark, wx + 0.08, cy + 0.05, wz, { dirt: 0 }));
    mv(box(0.4, 0.12, 0.2, M.steel, wx, cy, wz, { dirt: 0 })); mv(cyl(0.05, cy + 0.05 - 0.45, M.chrome, wx, 0.45, wz, { dirt: 0 }));
  }
  cyl(0.38, 0.25, M.steel, wx, 0, wz); cyl(0.22, 0.25, red, wx, 0.25, wz, { dirt: 0 }); hoop(0.3, 0.05, M.steel, wx, 0.35, wz);
  hcyl(0.16, 0.9, red, wx, 0.35, wz, { axis: 'z' });
  for (const s of [-1, 1]) { const w = new THREE.TorusGeometry(0.14, 0.03, 8, 20); mesh(w, M.paint('#c43b2a', { rivets: false }), wx, 0.55, wz + s * 0.48, { dirt: 0 }); }

  // gearbox, cranks, counterweights, pitman arms, motor
  const cx = 2.6;
  box(1.0, 1.3, 0.9, gun, cx, bh, z0);
  for (const s of [-1, 1]) {
    const cr = mv(group(cx, bh + 1.05, z0 + s * 0.6)); cr.rotation.z = theta;
    box(0.35, 0.3, 0.14, gun, 0.15, -0.15, 0, { parent: cr, dirt: 0 });
    const cw = new THREE.CylinderGeometry(0.8, 0.8, 0.18, 24, 1, false, Math.PI * 0.75, Math.PI * 0.5); cw.rotateX(Math.PI / 2);
    const cm = new THREE.Mesh(cw, red); cm.position.set(0.2, 0, 0); cm.castShadow = true; cm.receiveShadow = true; cr.add(cm);
    cr.updateMatrixWorld(true); const pin = new THREE.Vector3(pinR, 0, 0).applyMatrix4(cr.matrixWorld);
    const eq = new THREE.Vector3(2.15, -0.4, s * 0.45).applyMatrix4(wb.matrixWorld);
    mv(beam([pin.x, pin.y, pin.z], [eq.x, eq.y, eq.z], 0.12, 0.12, M.steel));
  }
  box(0.9, 0.7, 0.7, M.paint('#3f6b6b'), cx + 1.15, bh, z0 + 0.3); box(0.15, 0.6, 0.9, M.steel, cx + 0.55, bh + 0.5, z0 + 0.3, { dirt: 0 });

  // storage tank (front right) and flowline from the wellhead
  const tx = 2.7, tz = 2.6;
  cyl(1.05, 2.3, off, tx, 0, tz, { seg: 36 }); cyl(1.08, 0.12, gun, tx, 2.3, tz, { dirt: 0 }); ao(tx, tz, 2.1, 2.1, 0.5);
  for (const y of [0.7, 1.5]) hoop(1.07, 0.04, M.steel, tx, y, tz);
  ladder(tx - 1.1, 0, 2.4, tz + 0.2, { ry: Math.PI / 2 });
  pipe([[wx, 0.2, wz + 0.5], [wx, 0.2, tz], [tx - 1.05, 0.2, tz]], 0.09, M.dark);
  box(1.3, 0.05, 0.05, M.hazard, tx, 1.1, tz + 1.06, { dirt: 0 });

  // accent lights
  lamp(px, py + 0.55, z0, ACCENT, { shape: 'sphere', size: 0.16, intensity: 4, dist: 4, k: 2.6 });
  lamp(tx, 2.55, tz, ACCENT, { shape: 'sphere', size: 0.14, intensity: 3, dist: 3, k: 2.6 });
  lamp(cx, bh + 1.45, z0 + 0.45, ACCENT, { size: 0.12, intensity: 2, dist: 2, k: 2.6 });
  box(1.4, 0.1, 0.06, M.hazard, -0.2, bh - 0.12, z0 + 0.91, { dirt: 0 });

  if (part === 'base') hideParts(moving);
  if (part === 'work') workLayer(L, moving, { shadows: true });
}

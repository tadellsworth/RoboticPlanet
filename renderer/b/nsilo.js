// Nuclear Silo: a hardened octagonal silo block with its giant blast lid hinged up behind the shaft, the dark
// nuclear missile rising out of it, a big radiation trefoil painted on the apron, twin exhaust stacks, a bermed
// launch-control bunker and warning beacons. Team-colour rim lights.
import { trefoil, nukeMissile } from './nuke.js';
export default function (L) {
  const { box, cyl, hcyl, beam, pipe, hoop, lamp, pointLight, ao, mesh, sphere, group, canvasTex, M, THREE, TEAM } = L;
  const gun = M.paint('#4b5157'), armor = M.paint('#454a50'), olive = M.paint('#5d6247'), conc = M.rough('#8f887c'), concD = M.rough('#7a7468');
  const glow = M.emit(TEAM, 2.4), dim = M.emit(TEAM, 1.1);
  L.seed(501);
  const cx = -0.55, cz = -0.45, BR = 2.75, BH = 0.95, SR = 1.25;

  // ---- hardened silo block
  cyl(BR + 0.15, 0.2, concD, cx, 0, cz, { seg: 8, ry: Math.PI / 8 }); ao(cx, cz, 6.0, 6.0, 0.6);
  cyl(BR, BH, conc, cx, 0.2, cz, { rTop: BR - 0.3, seg: 8, ry: Math.PI / 8, dirtH: 0.8 });
  const top = 0.2 + BH;
  cyl(SR + 0.02, 0.03, M.dark, cx, top, cz, { seg: 48, dirt: 0, cast: false });
  hoop(SR + 0.06, 0.1, M.steel, cx, top + 0.02, cz);
  hoop(SR + 0.32, 0.05, glow, cx, top + 0.02, cz, { cast: false });
  hoop(SR + 0.62, 0.12, M.hazard, cx, top + 0.01, cz);
  for (let k = 0; k < 8; k++) { const a = (k + 0.5) * Math.PI / 4; box(0.36, 0.22, 0.36, gun, cx + Math.cos(a) * (SR + 0.95), top, cz + Math.sin(a) * (SR + 0.95), { ry: -a, dirt: 0 }); }
  for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + Math.PI / 8; box(0.5, 0.08, 0.06, dim, cx + Math.cos(a) * (BR - 0.02), 0.6, cz + Math.sin(a) * (BR - 0.02), { ry: -a + Math.PI / 2, cast: false }); }
  // radiation trefoil painted on the apron in front of the shaft
  const tg = new THREE.PlaneGeometry(1.15, 1.15); tg.rotateX(-Math.PI / 2);
  const tm = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ map: trefoil(L), transparent: true, alphaTest: 0.5, roughness: 0.8 }));
  tm.position.set(cx, top + 0.012, cz + SR + 0.95); tm.receiveShadow = true; L.getRoot().add(tm);

  // ---- the giant blast lid, hinged at the back of the shaft and swung up past vertical
  const innerTex = canvasTex(512, (g, n) => {
    g.fillStyle = '#3a3e43'; g.fillRect(0, 0, n, n);
    const c = n / 2;
    for (let k = 0; k < 24; k++) { g.fillStyle = k % 2 ? '#1d1c1a' : '#e3b52c'; g.beginPath(); g.moveTo(c, c); g.arc(c, c, n * 0.5, k * Math.PI / 12, (k + 1) * Math.PI / 12); g.closePath(); g.fill(); }
    g.fillStyle = '#4b5157'; g.beginPath(); g.arc(c, c, n * 0.36, 0, 7); g.fill();
    g.strokeStyle = 'rgba(20,18,16,0.7)'; g.lineWidth = 6; for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; g.beginPath(); g.moveTo(c + Math.cos(a) * n * 0.12, c + Math.sin(a) * n * 0.12); g.lineTo(c + Math.cos(a) * n * 0.36, c + Math.sin(a) * n * 0.36); g.stroke(); }
    g.fillStyle = '#2a2d31'; g.beginPath(); g.arc(c, c, n * 0.12, 0, 7); g.fill();
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(40,34,28,${L.rnd() * 0.35})`; g.fillRect(L.rnd() * n, L.rnd() * n, 3, 2); }
  });
  const inner = new THREE.MeshStandardMaterial({ map: innerTex, roughness: 0.7, metalness: 0.3 });
  const LR = SR + 0.25, hingeZ = cz - SR - 0.3;
  const lid = group(cx, top + 0.15, hingeZ); lid.rotation.x = -(Math.PI / 2 + 0.16);
  const lgeo = new THREE.CylinderGeometry(LR, LR, 0.5, 8, 1); lgeo.rotateY(Math.PI / 8);
  const lmesh = new THREE.Mesh(lgeo, [armor, armor, inner]); lmesh.position.set(0, -0.25, LR + 0.05); lmesh.castShadow = lmesh.receiveShadow = true; lid.add(lmesh);
  box(LR * 1.2, 0.12, 0.3, gun, 0, -0.06, 0.2, { parent: lid, dirt: 0 });
  // hinge block and twin hydraulic rams holding the lid up
  box(LR * 1.6, 0.55, 0.6, gun, cx, top, hingeZ - 0.15);
  hcyl(0.18, LR * 1.7, M.steel, cx, top + 0.3, hingeZ, { axis: 'x' });
  for (const s of [-1, 1]) {
    const bx = cx + s * (LR * 0.75), base = [bx, top, hingeZ - 1.1], end = [bx, top + 1.9, hingeZ - 0.38];
    beam(base, [bx, top + 1.1, hingeZ - 0.75], 0.2, 0.2, M.paint('#d0a536', { rivets: false }));
    beam([bx, top + 0.9, hingeZ - 0.8], end, 0.11, 0.11, M.chrome);
    box(0.4, 0.3, 0.4, gun, bx, top - 0.05, hingeZ - 1.1, { dirt: 0 });
  }
  pointLight(TEAM, 5, cx, top + 1.6, cz + 0.6, 4);

  // ---- the nuclear missile rising out of the shaft
  const mg = group(cx, 0.0, cz); nukeMissile(L, mg, 5.0, 0.64, TEAM);
  if (new URLSearchParams(location.search).get('empty')) mg.visible = false;   // ?empty=1: same scene with the silo empty
  pointLight('#fff4e0', 2, cx - 1.5, 4.5, cz + 2.0, 6);

  // ---- twin exhaust stacks (back right) venting the shaft
  for (const [x, z] of [[3.25, -3.35], [3.25, -1.85]]) {
    cyl(0.62, 0.3, concD, x, 0, z, { seg: 24 }); cyl(0.48, 2.3, gun, x, 0.3, z, { seg: 24, rTop: 0.42 });
    cyl(0.5, 0.25, M.dark, x, 2.6, z, { seg: 24, dirt: 0 }); hoop(0.46, 0.04, glow, x, 2.4, z, { cast: false });
    for (const y of [0.9, 1.6]) hoop(0.47, 0.03, M.hazard, x, y, z);
    ao(x, z, 1.2, 1.2, 0.5);
  }
  pipe([[cx + BR - 0.4, 0.5, cz - 1.0], [2.5, 0.5, cz - 1.0], [2.5, 0.5, -3.35], [2.8, 0.5, -3.35]], 0.16, M.dark);
  pipe([[2.5, 0.5, -1.85], [2.8, 0.5, -1.85]], 0.16, M.dark);

  // ---- launch-control bunker with an earth berm (front right)
  const bx = 2.75, bz = 3.15;
  const berm = new THREE.Shape(); berm.moveTo(-1.6, 0); berm.lineTo(1.6, 0); berm.lineTo(1.0, 1.15); berm.lineTo(-1.0, 1.15); berm.closePath();
  const bg = new THREE.ExtrudeGeometry(berm, { depth: 1.7, bevelEnabled: false }); bg.translate(0, 0, -0.85);
  mesh(bg, M.rough('#857e72'), bx, 0, bz, { dirtH: 1.0 });
  box(2.1, 0.2, 1.75, concD, bx, 1.15, bz, { dirt: 0 });
  box(1.5, 0.9, 0.3, conc, bx, 0, bz + 0.95);
  box(0.8, 0.7, 0.05, armor, bx - 0.25, 0.05, bz + 1.11, { dirt: 0 });
  for (const dx of [0.45]) { box(0.45, 0.1, 0.05, M.dark, bx + dx, 0.6, bz + 1.11, { dirt: 0 }); box(0.36, 0.04, 0.04, glow, bx + dx, 0.63, bz + 1.14, { cast: false }); }
  box(0.6, 0.05, 0.04, glow, bx - 0.25, 0.8, bz + 1.14, { cast: false });
  cyl(0.04, 1.6, M.steel, bx + 0.7, 1.35, bz - 0.4, { seg: 8, dirt: 0 }); sphere(0.09, M.emit(TEAM, 3), bx + 0.7, 2.98, bz - 0.4, { cast: false });
  ao(bx, bz, 3.2, 1.9, 0.5);
  pipe([[bx - 1.4, 0.2, bz - 0.6], [cx + 1.2, 0.2, bz - 0.6], [cx + 1.2, 0.2, cz + BR - 0.5]], 0.07, M.dark);

  // ---- warning beacons on posts at the front-left and back-left, hazard floor bands
  for (const [x, z, h] of [[-3.75, 3.55, 2.2], [-4.0, -3.7, 2.6]]) {
    box(0.6, 0.25, 0.6, concD, x, 0, z); cyl(0.07, h, gun, x, 0.25, z, { seg: 10, dirt: 0 });
    cyl(0.17, 0.25, M.emit(TEAM, 3), x, 0.25 + h, z, { seg: 16, cast: false }); cyl(0.2, 0.06, M.dark, x, 0.5 + h, z, { seg: 16, dirt: 0 });
    pointLight(TEAM, 3, x, h + 0.6, z + 0.5, 3);
  }
  for (const z of [3.3, 3.85]) box(1.9, 0.02, 0.28, M.hazard, -1.6, 0, z, { dirt: 0, cast: false });
}

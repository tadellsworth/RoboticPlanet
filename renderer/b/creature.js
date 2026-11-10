// Creatures, top-down like the robots (orthographic straight down, 10 world units across the 256 frame, sun toned the
// way robkit.js does it), facing +x, centred, no ground, no shadow.
//   ?c=scuttler | brute     ?f=0..3 walking frame (alternating tripod gait; only the legs move)
export const config = { pad: false, size: 512 };
export default function (L) {
  const { mesh, sphere, group, M, THREE } = L;
  const p = new URLSearchParams(location.search), C = p.get('c') || 'scuttler', f = +(p.get('f') || 0);
  L.seed(C === 'brute' ? 5150 : 5050);
  const W = 10, cam = new THREE.OrthographicCamera(-W / 2, W / 2, W / 2, -W / 2, 0.1, 100);
  cam.position.set(0, 40, 0); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  L.useCamera(cam);
  L.getScene().traverse(o => { if (o.isDirectionalLight) o.intensity *= o.castShadow ? 0.58 : 0.6; if (o.isHemisphereLight) o.intensity *= 0.7; });

  const gloss = (hex, rough = 0.3) => { const m = new THREE.MeshPhysicalMaterial({ color: hex, roughness: rough, metalness: 0.05, clearcoat: 0.6, clearcoatRoughness: 0.35, vertexColors: true }); m.envMapIntensity = 0.5; return m; };
  const eyeMat = (hex) => { const m = new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: 2.2, roughness: 0.2 }); m.userData.glow = hex; return m; };
  function ell(rx, ry, rz, mat, x, y, z, o = {}) {
    const g = new THREE.SphereGeometry(1, 48, 24, 0, Math.PI * 2, 0, o.half ? Math.PI / 2 : Math.PI); g.scale(rx, ry, rz);
    const m = mesh(g, mat, x, y, z, { dirt: o.dirt ?? 0.35, dirtH: ry * 1.6 }); if (o.rz) m.rotation.z = o.rz; if (o.ry) m.rotation.y = o.ry; if (o.rx) m.rotation.x = o.rx; return m;
  }
  // tapered limb segment from a to b
  function seg(a, b, r0, r1, mat) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), len = A.distanceTo(B);
    const g = new THREE.CylinderGeometry(r1, r0, len, 12, 1); g.translate(0, len / 2, 0);
    const m = mesh(g, mat, A.x, A.y, A.z, { dirt: 0.2, dirtH: 0.6 }); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
    sphere(r0 * 1.05, mat, A.x, A.y, A.z, { dirt: 0.2 });
    return m;
  }
  // tripod gait: legs 0..5 = [L1,R1,L2,R2,L3,R3]; group A = L1,R2,L3; frames step a quarter stride each
  function legPose(i, stride, lift) {
    const grp = (i === 0 || i === 3 || i === 4) ? 0 : 1;
    const ph = f * Math.PI / 2 + Math.PI / 4 + grp * Math.PI;
    const dx = stride * Math.cos(ph);                 // fore/aft foot offset (stance sweeps backward)
    const up = Math.max(0, -Math.sin(ph)) * lift;     // swing (moving forward) lifts the foot
    return [dx, up];
  }
  function legs(hips, reach, footSpread, kneeUp, r0, mat, matTip, stride, lift, claw) {
    hips.forEach(([hx, hy, hz], i) => {
      const s = Math.sign(hz), [dx, up] = legPose(i, stride, lift);
      const foot = [hx + footSpread[i] + dx, 0.05 + up, s * (Math.abs(hz) + reach[i] - up * 0.8)];
      const knee = [hx + (footSpread[i] + dx) * 0.45, hy + kneeUp + up * 0.6, s * (Math.abs(hz) + reach[i] * 0.55)];
      seg([hx, hy, hz], knee, r0, r0 * 0.8, mat);
      seg(knee, foot, r0 * 0.8, r0 * 0.3, matTip);
      if (claw) seg(foot, [foot[0] + 0.12, 0.02, foot[2] + s * 0.1], r0 * 0.3, r0 * 0.1, matTip);
    });
  }

  if (C === 'scuttler') {
    // body 4.5 units (45 %), legs to +-3.25 (65 %)
    const shell = gloss('#4a2860', 0.34), ridgeM = gloss('#7c4b95', 0.35), under = M.plain('#2a1832', 0.6, 0.05), legM = gloss('#2f1c38', 0.4), legT = M.plain('#1a0f20', 0.5, 0.1);
    ell(1.05, 0.38, 0.9, under, 0.1, 0.35, 0, {});                                  // underside
    ell(1.35, 0.62, 1.12, shell, -0.75, 0.42, 0, { half: true });                    // abdomen / elytra
    for (const s of [-1, 1]) ell(1.2, 0.08, 0.06, ridgeM, -0.7, 0.95, s * 0.42, { ry: s * 0.06 });   // ridges
    ell(1.3, 0.05, 0.03, M.plain('#140a18', 0.6), -0.72, 1.03, 0, {});              // elytra seam
    ell(0.62, 0.44, 0.78, shell, 0.75, 0.42, 0, { half: true });                     // thorax
    ell(0.5, 0.06, 0.05, ridgeM, 0.78, 0.84, 0, {});
    ell(0.46, 0.36, 0.58, shell, 1.45, 0.38, 0, { half: true });                     // head
    for (const s of [-1, 1]) {
      sphere(0.12, eyeMat('#ff5fd2'), 1.72, 0.58, s * 0.3, { dirt: 0 });
      // short curved mandibles
      seg([1.78, 0.42, s * 0.24], [2.12, 0.4, s * 0.3], 0.09, 0.07, legT);
      seg([2.12, 0.4, s * 0.3], [2.32, 0.38, s * 0.12], 0.07, 0.02, legT);
      // antennae
      seg([1.8, 0.62, s * 0.16], [2.25, 0.75, s * 0.5], 0.025, 0.012, legT);
    }
    const hips = [[0.85, 0.42, -0.6], [0.85, 0.42, 0.6], [0.25, 0.42, -0.72], [0.25, 0.42, 0.72], [-0.45, 0.42, -0.85], [-0.45, 0.42, 0.85]];
    legs(hips, [2.3, 2.3, 2.45, 2.45, 2.3, 2.3], [1.0, 1.0, 0.1, 0.1, -1.1, -1.1], 0.75, 0.085, legM, legT, 0.35, 0.35, false);
  } else {
    // Brute: body 7 units (70 %), heavy plates, bony spikes, crushing mandibles
    const plate = gloss('#5e3a26', 0.55), plateL = gloss('#76502f', 0.55), under = M.plain('#2e1e16', 0.7), legM = gloss('#4a3022', 0.5), legT = M.plain('#2a1a12', 0.6);
    const bone = M.plain('#d8ccb2', 0.55), boneD = M.plain('#a8977a', 0.6);
    ell(2.4, 0.6, 1.5, under, -0.2, 0.55, 0, {});
    // overlapping armour plates from the tail forward (each a half-shell, front edge lighter)
    const plates = [[-2.6, 1.0, 1.1, 0.5], [-1.75, 1.25, 1.45, 0.66], [-0.75, 1.35, 1.66, 0.78], [0.25, 1.3, 1.72, 0.82], [1.1, 1.05, 1.6, 0.78]];
    for (const [x, rx, rz, ry] of plates) {
      ell(rx, ry, rz, plate, x, 0.55, 0, { half: true });
      ell(rx * 0.25, ry * 0.95, rz * 0.98, plateL, x + rx * 0.7, 0.55, 0, { half: true });
    }
    // head and crushing mandibles
    ell(0.85, 0.75, 1.15, plate, 1.95, 0.5, 0, { half: true });
    ell(0.5, 0.5, 0.9, plateL, 2.35, 0.5, 0, { half: true });
    for (const s of [-1, 1]) {
      sphere(0.17, eyeMat('#ffb347'), 2.55, 0.92, s * 0.48, { dirt: 0 });
      const m0 = [2.55, 0.55, s * 0.62], m1 = [3.15, 0.55, s * 0.85], m2 = [3.55, 0.5, s * 0.4], m3 = [3.65, 0.48, s * 0.08];
      seg(m0, m1, 0.28, 0.24, legM); seg(m1, m2, 0.24, 0.15, legM); seg(m2, m3, 0.15, 0.04, boneD);
      for (const t of [0.35, 0.65]) { const q = [m1[0] + (m2[0] - m1[0]) * t, 0.55, m1[2] + (m2[2] - m1[2]) * t]; seg(q, [q[0] - 0.05, 0.55, q[2] - s * 0.22], 0.07, 0.01, bone); }
    }
    // bony spikes along the back ridge and the plate edges
    const spike = (x, y, z, dx, dy, dz, len, r) => {
      const g = new THREE.ConeGeometry(r, len, 10, 1); g.translate(0, len / 2, 0);
      const m = mesh(g, bone, x, y, z, { dirt: 0.25, dirtH: len }); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx, dy, dz).normalize());
      const b = new THREE.ConeGeometry(r * 1.3, len * 0.35, 10, 1); b.translate(0, len * 0.17, 0);
      const mb = mesh(b, boneD, x, y, z, { dirt: 0.3 }); mb.quaternion.copy(m.quaternion);
    };
    for (const [x, , , ry] of plates) spike(x + 0.15, 0.55 + ry - 0.08, 0, -0.45, 1, 0, 1.05, 0.2);
    for (const [x, rx, rz, ry] of plates.slice(1)) for (const s of [-1, 1]) spike(x, 0.7, s * (rz - 0.15), -0.35, 0.5, s * 1, 0.85, 0.17);
    const hips = [[1.25, 0.6, -1.2], [1.25, 0.6, 1.2], [0.1, 0.6, -1.4], [0.1, 0.6, 1.4], [-1.15, 0.6, -1.3], [-1.15, 0.6, 1.3]];
    legs(hips, [1.9, 1.9, 2.05, 2.05, 1.9, 1.9], [1.1, 1.1, 0.15, 0.15, -1.15, -1.15], 0.85, 0.22, legM, legT, 0.42, 0.45, true);
  }
}

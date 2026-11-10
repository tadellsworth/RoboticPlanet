// Creature nest (organic, no pad): a ribbed, knobbly mound of dark purple-brown resin and fused rock with burrow holes,
// clusters of pale glowing green eggs in hollows, a sticky purple creep spreading over the sand round its base, and (from
// stage 2) pale bony spikes. ?s=1|2|3. Building camera framing (same as every building, pad hidden).
export const config = { pad: false };
export default function (L) {
  const { mesh, sphere, cyl, group, pointLight, canvasTex, M, THREE } = L;
  const p = new URLSearchParams(location.search), S = +(p.get('s') || 3);
  L.seed(4040);
  const RB = [0, 2.1, 2.8, 3.35][S], HH = [0, 1.25, 2.1, 2.85][S], CR = [0, 3.1, 4.0, 4.6][S];
  const CX = 0, CZ = -0.15;

  // ---- smooth pseudo-noise from random plane waves (same for every stage, so the nest grows rather than changes)
  let s0 = 977; const r = () => { s0 = (s0 * 16807) % 2147483647; return s0 / 2147483647; };
  const waves = []; for (let i = 0; i < 18; i++) { const th = r() * Math.PI * 2, ph = Math.acos(2 * r() - 1); waves.push([Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th), 1.2 + r() * 3.5, r() * 6.28]); }
  const nz = (x, y, z) => { let v = 0, w = 0; for (const [a, b, c, f, o] of waves) { const amp = 1 / f; v += Math.sin((a * x + b * y + c * z) * f + o) * amp; w += amp; } return v / w; };

  // radius of the mound surface in direction (az, el): ribs round the mound, knobs, a slightly lumpy profile
  const bumps = []; for (let i = 0; i < 7; i++) { const az = r() * Math.PI * 2, el = 0.25 + r() * 0.85; bumps.push([Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az), 0.12 + r() * 0.26, 0.28 + r() * 0.25]); }
  const rad = (az, el) => {
    const dx = Math.cos(el) * Math.cos(az), dy = Math.sin(el), dz = Math.cos(el) * Math.sin(az);
    const warp = 1.4 * nz(dx * 1.5, dy * 1.5, dz * 1.5);
    const rib = 0.075 * (0.55 + 0.45 * nz(dx * 3, dy * 3 + 7, dz * 3)) * Math.pow(Math.abs(Math.sin(az * 9 + warp + 0.8 * Math.sin(el * 3))), 0.7) * (1 - dy * 0.5);
    const knob = 0.2 * nz(dx * 2.4, dy * 2.4, dz * 2.4) + 0.09 * nz(dx * 7, dy * 7, dz * 7) + 0.04 * nz(dx * 15, dy * 15, dz * 15);
    let bump = 0; for (const [bx, by, bz, a, w] of bumps) { const c = dx * bx + dy * by + dz * bz, ang = Math.acos(Math.max(-1, Math.min(1, c))); bump += a * Math.exp(-(ang * ang) / (w * w)); }
    return 1 + rib + knob + bump;
  };
  const surf = (az, el, out = 0) => {
    const k = rad(az, el) + out;
    return new THREE.Vector3(CX + Math.cos(el) * Math.cos(az) * RB * k, Math.sin(el) * HH * Math.pow(k, 1.6), CZ + Math.cos(el) * Math.sin(az) * RB * k);
  };

  // ---- mound mesh with vertex colours (resin, fused rock, lighter ridges)
  {
    const NA = 160, NE = 48, pos = [], col = [], idx = [];
    const resin = new THREE.Color('#24141c'), resin2 = new THREE.Color('#3d2131'), rock = new THREE.Color('#4a3d35'), ridge = new THREE.Color('#5e3a50');
    for (let j = 0; j <= NE; j++) for (let i = 0; i <= NA; i++) {
      const az = i / NA * Math.PI * 2, el = j / NE * Math.PI / 2 * 0.999;
      const v = surf(az, el); pos.push(v.x, v.y - 0.12, v.z);
      const n1 = nz(Math.cos(az) * 3, el * 2, Math.sin(az) * 3), ribv = Math.pow(Math.abs(Math.sin(az * 7 + 0.6 * Math.sin(el * 3))), 4);
      const c = resin.clone().lerp(resin2, 0.5 + 0.5 * n1);
      if (n1 > 0.35) c.lerp(rock, Math.min(1, (n1 - 0.35) * 2.5));
      c.lerp(ridge, ribv * 0.45 * (1 - el / 1.6));
      const kk = rad(az, el), sh = (0.7 + 0.3 * Math.min(1, el * 1.4)) * (0.72 + 0.55 * Math.max(0, Math.min(1, (kk - 0.85) / 0.5)));
      col.push(c.r * sh, c.g * sh, c.b * sh);
    }
    for (let j = 0; j < NE; j++) for (let i = 0; i < NA; i++) { const a = j * (NA + 1) + i, b = a + 1, c = a + NA + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.06 }); m.envMapIntensity = 0.7;
    mesh(g, m, 0, 0, 0, {});
  }
  // a few fused rocks embedded round the base
  const rockM = M.rough('#5c4c42');
  for (let i = 0; i < 4 + S * 2; i++) {
    const az = r() * Math.PI * 2, v = surf(az, 0.05, -0.05), s = 0.25 + r() * 0.35 * (0.6 + S * 0.25);
    const g = new THREE.DodecahedronGeometry(s, 0); g.scale(1, 0.6, 1);
    const m = mesh(g, rockM, v.x, s * 0.25, v.z, { dirt: 0.3 }); m.rotation.y = r() * 3;
  }

  // ---- burrow holes: dark mouths with raised resin lips (faint green glow inside on stage 3)
  const holes = [[1.75, 0.35], [2.55, 0.5], [0.9, 0.3], [4.1, 0.45]].slice(0, S === 1 ? 3 : 4);   // az (radians, +z is towards the camera), elevation
  const lipM = M.plain('#2a1620', 0.5, 0.05), mouthM = M.plain('#050304', 0.95);
  for (const [az, el] of holes) {
    const v = surf(az, el, 0.01), nrm = v.clone().sub(new THREE.Vector3(CX, -0.4, CZ)).normalize();
    const hr = 0.32 + 0.12 * S;
    const g = group(v.x, v.y - 0.12, v.z); g.lookAt(v.x + nrm.x, v.y - 0.12 + nrm.y, v.z + nrm.z);
    const lip = new THREE.TorusGeometry(hr, hr * 0.24, 8, 22); lip.scale(1.15, 0.8, 0.7); mesh(lip, lipM, 0, 0, 0.0, { parent: g, dirt: 0 });
    const mouth = new THREE.CircleGeometry(hr * 1.0, 28); mouth.scale(1.15, 0.8, 1); mesh(mouth, mouthM, 0, 0, -0.02, { parent: g, dirt: 0 });
    if (S === 3) {
      const gl = new THREE.CircleGeometry(hr * 0.55, 24); mesh(gl, M.emit('#7dff6a', 0.9), 0, 0, -0.06, { parent: g, dirt: 0, cast: false });
      pointLight('#7dff6a', 3, v.x + nrm.x * 0.4, v.y + nrm.y * 0.4, v.z + nrm.z * 0.4, 2.2);
    }
  }

  // ---- egg clusters in hollows: pale glowing green, slightly translucent
  const eggM = new THREE.MeshStandardMaterial({ color: '#a8e878', emissive: '#62d030', emissiveIntensity: 0.42, roughness: 0.3, metalness: 0 });
  eggM.userData.glow = '#3f8f25';
  const clusters = [[2.2, 0.75, 5], [0.4, 1.0, 5], [3.3, 0.85, 6], [1.4, 1.25, 6], [5.1, 0.7, 5], [4.6, 1.2, 4]].slice(0, [0, 2, 4, 6][S]);
  for (const [az, el, n] of clusters) {
    const c = surf(az, el, -0.04);
    // hollow: dark sticky cup
    const cup = new THREE.SphereGeometry(0.62 + 0.08 * S, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2); cup.scale(1, 0.32, 1);
    mesh(cup, M.plain('#24131d', 0.35, 0.05), c.x, c.y - 0.16, c.z, { dirt: 0 });
    for (let k = 0; k < n + S; k++) {
      const a = r() * Math.PI * 2, d = r() * (0.38 + 0.06 * S), er = 0.15 + r() * 0.08 + 0.02 * S;
      const e = new THREE.SphereGeometry(er, 16, 12); e.scale(1, 1.25, 1);
      mesh(e, eggM, c.x + Math.cos(a) * d, c.y - 0.05 + er * 0.6, c.z + Math.sin(a) * d, { dirt: 0 });
    }
  }

  // ---- bony spikes (stage 2 short, stage 3 tall and jagged)
  if (S >= 2) {
    const bone = M.plain('#cbbd9e', 0.6, 0.0), boneD = M.plain('#8f7f68', 0.65, 0);
    const N = S === 2 ? 9 : 16;
    for (let i = 0; i < N; i++) {
      const az = (i / N) * Math.PI * 2 + r() * 0.3, el = 0.25 + r() * (S === 2 ? 0.6 : 0.95);
      const b = surf(az, el, -0.02), out = b.clone().sub(new THREE.Vector3(CX, 0, CZ)).setY(0).normalize();
      const len = (S === 2 ? 0.45 + r() * 0.45 : 0.9 + r() * 1.3) * (el > 0.9 ? 1.3 : 1);
      const dir = new THREE.Vector3(out.x * 0.55, 1.0 - 0.3 * (1 - el), out.z * 0.55).normalize();
      // two jointed segments, the tip bending outward
      const segs = S === 3 ? 2 : 1; let base = new THREE.Vector3(b.x, b.y - 0.15, b.z), d = dir.clone(), w = 0.17 + 0.05 * S;
      for (let k = 0; k < segs; k++) {
        const l = len / segs, cg = new THREE.ConeGeometry(w, l * 1.05, 10, 1); cg.translate(0, l / 2, 0);
        const m = mesh(cg, k ? bone : boneD, base.x, base.y, base.z, { dirt: 0 });
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
        base = base.clone().add(d.clone().multiplyScalar(l * 0.82)); w *= 0.62;
        d = d.clone().add(new THREE.Vector3(out.x, -0.15, out.z).multiplyScalar(0.35 + r() * 0.3)).normalize();
      }
    }
    // a crown of the tallest spikes on top for stage 3
    if (S === 3) for (let i = 0; i < 5; i++) {
      const az = i * 1.25 + 0.4, v = surf(az, 1.25, -0.03), len = 1.3 + r() * 1.0;
      const cg = new THREE.ConeGeometry(0.2, len, 10, 1); cg.translate(0, len / 2, 0);
      const m = mesh(cg, bone, v.x, v.y - 0.2, v.z, { dirt: 0 });
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(Math.cos(az) * 0.35, 1, Math.sin(az) * 0.35).normalize());
    }
  }

  // ---- sticky purple creep spreading over the sand (a ground decal; transparent round its ragged edge)
  {
    const n = 1024;
    const tex = canvasTex(n, (g) => {
      const c = n / 2, R0 = n / 2 * 0.98;
      const img = g.createImageData(n, n), D = img.data;
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const dx = (x - c) / R0, dy = (y - c) / R0, rr = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
        const edge = 0.78 + 0.12 * nz(Math.cos(a) * 1.6, 0.3, Math.sin(a) * 1.6) + 0.07 * Math.sin(a * 11 + 2 * nz(dx * 4, 1, dy * 4)) + 0.05 * nz(dx * 9, 2, dy * 9);
        let al = Math.min(1, Math.max(0, (edge - rr) / 0.06));
        const vein = Math.pow(Math.abs(Math.sin(a * 23 + rr * 14 + 3 * nz(dx * 3, 4, dy * 3))), 18);
        const wet = 0.5 + 0.5 * nz(dx * 7, 5, dy * 7);
        let R = 0x58, G = 0x26, B = 0x66;
        R *= 0.7 + 0.45 * wet; G *= 0.7 + 0.4 * wet; B *= 0.75 + 0.45 * wet;
        R = R * (1 - 0.5 * vein) + 0x2a * 0.5 * vein; G = G * (1 - 0.5 * vein) + 0x10 * 0.5 * vein; B = B * (1 - 0.5 * vein) + 0x30 * 0.5 * vein;
        // tendrils past the edge
        const tend = Math.pow(Math.abs(Math.sin(a * 9 + nz(dx * 2, 6, dy * 2) * 2)), 40) * Math.max(0, 1 - (rr - edge) / 0.14);
        if (rr > edge) al = Math.max(al, tend * 0.9);
        al *= Math.min(1, rr * 6);                                          // under the mound it doesn't matter; keep the centre clean
        const i4 = (y * n + x) * 4; D[i4] = R; D[i4 + 1] = G; D[i4 + 2] = B; D[i4 + 3] = Math.round(al * 255);
      }
      g.putImageData(img, 0, 0);
    });
    const m = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.32, metalness: 0.05, depthWrite: false });
    const pg = new THREE.PlaneGeometry(CR * 2 / 0.8, CR * 2 / 0.8); pg.rotateX(-Math.PI / 2);
    const pm = new THREE.Mesh(pg, m); pm.position.set(CX, 0.015, CZ); pm.receiveShadow = true; pm.renderOrder = 0; L.getRoot().add(pm);
  }
}

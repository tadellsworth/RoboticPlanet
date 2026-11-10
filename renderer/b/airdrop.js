// Air-drop pieces, seen from a little above and in front (orthographic, tilted 55 degrees down), no ground, no shadow:
// the game draws them falling, swaying and landing (drawAirLayer / drawCrateDrop).
//   ?part=fall    a supply crate hanging under its inflated parachute: the canopy (twelve gores, team colour and
//                 off-white by turns, a vent at the crown, a reinforced skirt), the shroud lines gathering to a
//                 riser, and the crate below
//   ?part=canopy  the inflated canopy alone (the game draws the lines down to a robot or a Drop Outpost)
//   ?part=crate   the crate on its own, landed: an olive wooden supply crate on a skid pallet, steel corners,
//                 two cargo straps over the top, a team band and a stencilled arrow, the lifting ring on top
//   ?part=flat    the spent parachute collapsed on the ground in a wrinkled heap, its lines trailing
// 6.4 world units across the 512-px frame; the canopy's centre is at the frame's centre in 'fall' and 'canopy'.
export const config = { pad: false, size: 512 };
export default function (L) {
  const { box, cyl, mesh, sphere, beam, M, THREE, TEAM } = L;
  const part = new URLSearchParams(location.search).get('part') || 'fall';
  L.seed(1499);
  const W = 6.4, cam = new THREE.OrthographicCamera(-W / 2, W / 2, W / 2, -W / 2, 0.1, 100);
  const el = (part === 'fall' || part === 'canopy' ? 32 : 55) * Math.PI / 180; // the canopy from lower down, so it reads as a dome
  cam.position.set(0, Math.sin(el) * 30, Math.cos(el) * 30); cam.lookAt(0, 0, 0); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  L.useCamera(cam);
  const teamC = M.paint(TEAM, { rivets: false }), cloth = M.paint('#e7e1d2', { rivets: false });
  const olive = M.paint('#6b6a45', { rivets: false }), oliveD = M.paint('#4f4e33', { rivets: false }), steel = M.steel, strap = M.plain('#2a2a26', 0.8);
  const line = M.plain('#d9d3c0', 0.7);

  const canopy = (cy) => {
    const R = 1.75, H = 1.35, n = 12;
    for (let k = 0; k < n; k++) {
      const g = new THREE.SphereGeometry(R, 6, 10, (k * 2 * Math.PI) / n, (2 * Math.PI) / n, 0.12, Math.PI / 2 - 0.12);
      g.scale(1, H / R, 1);
      const m = mesh(g, k % 2 ? cloth : teamC, 0, cy, 0, { dirt: 0.05 }); m.material.side = THREE.DoubleSide;
    }
    const tor = new THREE.TorusGeometry(R, 0.05, 6, 48); tor.rotateX(Math.PI / 2); mesh(tor, cloth, 0, cy, 0, { dirt: 0 });
    cyl(0.24, 0.02, M.dark, 0, cy + H * 0.99, 0, { seg: 20, dirt: 0 }); // the vent
    return { R, H };
  };
  const crate = (cx, cy, cz) => {
    box(1.25, 0.16, 1.0, oliveD, cx, cy, cz, { dirt: 0.4 });                                  // skid pallet
    box(1.15, 0.85, 0.9, olive, cx, cy + 0.16, cz, { dirt: 0.5 });
    for (const x of [-0.56, 0.56]) for (const z of [-0.44, 0.44]) box(0.08, 0.87, 0.08, steel, cx + x, cy + 0.16, cz + z, { dirt: 0 });
    for (const x of [-0.25, 0.25]) { box(0.1, 0.02, 0.94, strap, cx + x, cy + 1.01, cz, { dirt: 0 }); box(0.1, 0.87, 0.02, strap, cx + x, cy + 0.15, cz + 0.46, { dirt: 0 }); }
    box(1.17, 0.12, 0.92, teamC, cx, cy + 0.6, cz, { dirt: 0 });                               // team band
    { const sh = new THREE.Shape(); sh.moveTo(0, 0.16); sh.lineTo(0.13, 0); sh.lineTo(0.05, 0); sh.lineTo(0.05, -0.14); sh.lineTo(-0.05, -0.14); sh.lineTo(-0.05, 0); sh.lineTo(-0.13, 0); sh.closePath();
      mesh(new THREE.ShapeGeometry(sh), M.paint('#e7e1d2', { rivets: false }), cx, cy + 0.38, cz + 0.455, { dirt: 0 }); }   // stencilled arrow
    const ring = new THREE.TorusGeometry(0.1, 0.025, 6, 16); mesh(ring, steel, cx, cy + 1.13, cz, { dirt: 0 });
  };

  if (part === 'fall') {
    const { R } = canopy(1.0);
    const conf = [0, -1.6, 0];
    for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; beam([Math.cos(a) * R * 0.98, 1.0, Math.sin(a) * R * 0.98], conf, 0.03, 0.03, line); }
    beam(conf, [0, -1.9, 0], 0.05, 0.05, strap);
    crate(0, -3.0, 0);
  } else if (part === 'canopy') {
    canopy(-0.4);
  } else if (part === 'crate') {
    crate(0, -0.55, 0);
  } else {
    // the spent parachute: dragged out flat downwind, its gores now stripes running along it, folded in ridges, a
    // little air still caught in the far end; its lines lead back from the narrow end
    const g = new THREE.PlaneGeometry(3.6, 1.6, 48, 24); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, cols = new Float32Array(p.count * 3), tc = new THREE.Color(TEAM), wc = new THREE.Color('#e7e1d2');
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), u = (x + 1.8) / 3.6;                  // 0 at the lines' end, 1 at the far end
      const half = 0.25 + 0.55 * Math.sin(Math.min(1, u * 1.15) * Math.PI / 2);   // tapering to the lines
      const zz = z * half / 0.8;
      const ridge = 0.07 * Math.abs(Math.sin(zz * 9 + u * 3)) + 0.05 * Math.sin(u * 13 + z * 4);
      const bulge = 0.32 * Math.max(0, u - 0.6) / 0.4 * Math.cos((z / 0.8) * Math.PI / 2);
      p.setXYZ(i, x + 0.08 * Math.sin(z * 5), Math.max(0.01, ridge + bulge), zz);
      const c = Math.floor(((z + 0.8) / 1.6) * 6) % 2 ? wc : tc; cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
    }
    g.computeVertexNormals();
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    const m = mesh(g, M.plain('#ffffff', 0.85), 0.5, -0.3, 0, { dirt: 0 }); m.material.side = THREE.DoubleSide;
    for (const o of [-0.16, 0, 0.16]) beam([-1.25, -0.27, o], [-2.6, -0.29, o * 0.3], 0.025, 0.025, line);
  }
  void sphere;
}

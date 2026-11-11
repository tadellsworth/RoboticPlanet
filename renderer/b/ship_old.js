// Ships (naval maps): top-down, facing +x, orthographic camera straight down, no ground and no shadow plane
// (the game draws them on the water, with their wake). 20 world units across the 1024-px frame.
//   ?kind=cargo  Container Ship: a long hull, the bridge aft, coloured containers stacked in bays
//   ?kind=tank   Tanker Ship: a long hull, the bridge aft, a pipe deck with manifolds, hatches and a catwalk
//   ?kind=ferry  Ferry: a short beamy hull, an open vehicle deck with lane marks and a bow ramp, a glazed
//                passenger cabin over the stern
// Team colour: a stripe along both gunwales and the funnel band; navigation lights (red to port, green to
// starboard, white masthead) and lit windows glow at night.
export const config = { pad: false, size: 1024 };
export default function (L) {
  const { box, cyl, hcyl, beam, pipe, mesh, sphere, M, THREE, TEAM, R } = L;
  const p = new URLSearchParams(location.search), kind = p.get('kind') || 'cargo';
  L.seed(kind === 'cargo' ? 811 : kind === 'tank' ? 822 : 833);
  const W = 20, cam = new THREE.OrthographicCamera(-W / 2, W / 2, W / 2, -W / 2, 0.1, 100);
  cam.position.set(0, 40, 0); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  L.useCamera(cam);

  const hullM = M.paint('#3c4248', { panelW: 512 }), deckM = M.paint(kind === 'ferry' ? '#5b6066' : '#6c5a48', { panelW: 256, panelH: 256 });
  const off = M.paint('#d7d3c8', { rivets: false }), dark = M.paint('#2c3136', { rivets: false });
  const team = M.paint('#' + new THREE.Color(TEAM).multiplyScalar(0.7).getHexString(), { rivets: false });
  const len = kind === 'ferry' ? 12.4 : 17.2, half = kind === 'ferry' ? 2.35 : 1.95, bow = kind === 'ferry' ? 1.8 : 3.4;
  const XS = -len / 2, XB = len / 2, HH = 1.1;

  // ---- hull: a flat stern with rounded corners, straight sides, a pointed bow (the ferry's is blunt)
  const hullShape = (inset) => {
    const s = new THREE.Shape(), h = half - inset, xs = XS + inset, xb = XB - inset * 1.8, r = 0.5;
    s.moveTo(xs + r, -h); s.lineTo(xb - bow, -h);
    s.quadraticCurveTo(xb - bow * 0.25, -h * (kind === 'ferry' ? 0.98 : 0.8), xb, kind === 'ferry' ? -h * 0.55 : 0);
    if (kind === 'ferry') s.lineTo(xb, h * 0.55);
    s.quadraticCurveTo(xb - bow * 0.25, h * (kind === 'ferry' ? 0.98 : 0.8), xb - bow, h);
    s.lineTo(xs + r, h); s.quadraticCurveTo(xs, h, xs, h - r); s.lineTo(xs, -h + r); s.quadraticCurveTo(xs, -h, xs + r, -h);
    return s;
  };
  const ext = (shape, depth, mat, y, o = {}) => { const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 24 }); g.rotateX(-Math.PI / 2); return mesh(g, mat, 0, y, 0, o); };
  ext(hullShape(0), HH, hullM, 0, { dirt: 0.2 });
  ext(hullShape(0.18), 0.04, deckM, HH, { dirt: 0.15 });
  // bulwark rails, the team stripe along both gunwales
  for (const s of [-1, 1]) {
    box(len - bow - 0.6, 0.14, 0.12, hullM, (XS + XB - bow) / 2 + 0.2, HH, s * (half - 0.06), { dirt: 0 });
    box(len - bow - 1.4, 0.03, 0.1, team, (XS + XB - bow) / 2 + 0.3, HH + 0.14, s * (half - 0.06), { dirt: 0, cast: false });
  }

  // ---- the superstructure: the bridge aft (cargo, tank) or the passenger cabin (ferry)
  const lights = [];
  const nav = (x, z, hex) => { lights.push(sphere(0.12, M.emit(hex, 3.2), x, HH + 2.5, z, { cast: false })); };
  if (kind !== 'ferry') {
    const bx0 = XS + 0.5, bx1 = XS + 3.0;
    box(bx1 - bx0, 1.3, half * 2 - 0.5, off, (bx0 + bx1) / 2, HH, 0, { dirtH: 0.6 });
    box(bx1 - bx0 - 0.4, 0.9, half * 2 - 0.9, off, (bx0 + bx1) / 2 - 0.1, HH + 1.3, 0, { dirt: 0.2 });
    box(0.7, 0.55, half * 2 + 0.5, off, bx1 - 0.45, HH + 2.2, 0, { dirt: 0.1 });                                        // bridge deck with wings
    box(0.08, 0.3, half * 2 + 0.3, M.glass('#22323d', 0.95), bx1 - 0.08, HH + 2.32, 0, { dirt: 0, cast: false });       // forward windows
    box(0.06, 0.05, half * 2 + 0.2, M.emit('#ffd9a0', 1.1), bx1 - 0.05, HH + 2.3, 0, { cast: false });
    box(0.8, 0.06, half * 2 + 0.6, dark, bx1 - 0.45, HH + 2.75, 0, { dirt: 0 });
    // funnel with the team band, and a mast forward of the bridge
    cyl(0.42, 1.2, off, bx0 + 0.55, HH + 2.2, 0, { seg: 28, dirt: 0.2, soot: 0.8 });
    cyl(0.43, 0.25, team, bx0 + 0.55, HH + 2.95, 0, { seg: 28, dirt: 0 });
    cyl(0.32, 0.05, M.plain('#0b0b0c', 0.9), bx0 + 0.55, HH + 3.4, 0, { seg: 24, dirt: 0 });
    cyl(0.05, 1.1, M.steel, bx1 - 0.2, HH + 2.8, 0, { seg: 10 });
    lights.push(sphere(0.12, M.emit('#ffffff', 3.2), bx1 - 0.2, HH + 3.9, 0, { cast: false }));
    nav(bx1 - 0.45, -half - 0.22, '#ff2a22'); nav(bx1 - 0.45, half + 0.22, '#22ff6a');
    L.mark('funnel', bx0 + 0.55, HH + 3.45, 0);
    // lifeboats in davits on both sides
    for (const s of [-1, 1]) { hcyl(0.24, 1.3, M.paint('#e8701e', { rivets: false }), bx0 + 1.2, HH + 1.5, s * (half - 0.15), { axis: 'x', dirt: 0 }); }
  } else {
    const cx0 = XS + 0.6, cx1 = XS + 5.4;
    box(cx1 - cx0, 1.0, half * 2 - 0.3, off, (cx0 + cx1) / 2, HH, 0, { dirtH: 0.5 });
    box(cx1 - cx0 - 0.5, 0.9, half * 2 - 0.8, off, (cx0 + cx1) / 2 - 0.2, HH + 1.0, 0, { dirt: 0.2 });
    for (const s of [-1, 1]) for (let k = 0; k < 6; k++) {
      box(0.5, 0.3, 0.05, M.glass('#22323d', 0.95), cx0 + 0.6 + k * 0.72, HH + 1.35, s * (half - 0.39), { dirt: 0, cast: false });
      box(0.42, 0.05, 0.04, M.emit('#ffd9a0', 1.2), cx0 + 0.6 + k * 0.72, HH + 1.42, s * (half - 0.37), { cast: false });
    }
    box(1.2, 0.5, half * 2 + 0.3, off, cx1 - 0.85, HH + 1.9, 0, { dirt: 0.1 });                                        // wheelhouse across the beam
    box(0.08, 0.28, half * 2 + 0.1, M.glass('#22323d', 0.95), cx1 - 0.22, HH + 2.0, 0, { dirt: 0, cast: false });
    box(0.06, 0.05, half * 2, M.emit('#ffd9a0', 1.1), cx1 - 0.19, HH + 2.0, 0, { cast: false });
    box(1.3, 0.06, half * 2 + 0.5, dark, cx1 - 0.85, HH + 2.4, 0, { dirt: 0 });
    box(cx1 - cx0 - 1.6, 0.05, 0.3, team, (cx0 + cx1) / 2 - 0.9, HH + 1.92, 0, { dirt: 0, cast: false });               // team roof stripe
    for (const s of [-1, 1]) { cyl(0.26, 0.9, off, cx0 + 0.7, HH + 1.9, s * 0.9, { seg: 24, dirt: 0.2, soot: 0.8 }); cyl(0.27, 0.2, team, cx0 + 0.7, HH + 2.5, s * 0.9, { seg: 24, dirt: 0 }); }
    cyl(0.05, 0.9, M.steel, cx1 - 0.6, HH + 2.45, 0, { seg: 10 });
    lights.push(sphere(0.12, M.emit('#ffffff', 3.2), cx1 - 0.6, HH + 3.4, 0, { cast: false }));
    nav(cx1 - 0.85, -half - 0.22, '#ff2a22'); nav(cx1 - 0.85, half + 0.22, '#22ff6a');
    L.mark('funnel', cx0 + 0.7, HH + 2.85, -0.9);
    // the vehicle deck: lane marks, chocks, and the bow ramp (raised, hinged at the bow)
    const dx0 = cx1 + 0.2, dx1 = XB - 0.9;
    for (const z of [-1.0, 0, 1.0]) box(dx1 - dx0, 0.01, 0.06, M.paint('#d8b53a', { rivets: false }), (dx0 + dx1) / 2, HH + 0.04, z, { dirt: 0 });
    for (const s of [-1, 1]) box(dx1 - dx0, 0.45, 0.12, hullM, (dx0 + dx1) / 2, HH, s * (half - 0.12), { dirt: 0 });
    box(0.25, 0.9, half * 2 - 0.6, M.paint('#4b5157', { panelW: 64 }), XB - 0.75, HH, 0, { dirt: 0.2 });
    box(0.24, 0.04, half * 2 - 0.8, M.hazard, XB - 0.75, HH + 0.9, 0, { dirt: 0 });
  }

  // ---- the cargo: container bays (cargo) or the pipe deck (tank)
  if (kind === 'cargo') {
    const cols = ['#4f6f86', '#a24a32', '#c9c5ba', '#6d7148', '#8a5a2e', '#2f5a5a', '#b88a2a'];
    const bx0 = XS + 3.4, bx1 = XB - bow + 0.6, n = 5, bw = (bx1 - bx0) / n;
    for (let b = 0; b < n; b++) {
      const x = bx0 + bw * (b + 0.5);
      for (const z of [-1.15, -0.38, 0.38, 1.15]) {
        const tiers = 1 + Math.floor(R(0, 3));
        for (let t = 0; t < tiers; t++) box(bw - 0.12, 0.7, 0.72, M.ribbed(cols[Math.floor(R(0, cols.length))], { period: 12 }), x, HH + 0.04 + t * 0.72, z, { dirtH: 0.5 });
      }
    }
    box(0.5, 0.9, half * 2 - 0.3, M.paint('#4b5157', { panelW: 64 }), XB - bow + 0.7, HH, 0, { dirt: 0.2 });           // forecastle bulwark
    cyl(0.18, 0.25, dark, XB - 1.4, HH, -0.5, { seg: 16 }); cyl(0.18, 0.25, dark, XB - 1.4, HH, 0.5, { seg: 16 });    // windlasses
  } else if (kind === 'tank') {
    const px0 = XS + 3.4, px1 = XB - bow + 0.4;
    box(px1 - px0, 0.06, 0.55, M.grating, (px0 + px1) / 2, HH + 0.7, 0, { dirt: 0 });                                  // catwalk on posts
    for (let x = px0 + 0.3; x < px1; x += 1.2) box(0.08, 0.7, 0.08, M.steel, x, HH, 0, { dirt: 0 });
    for (const z of [-0.6, 0.6, -0.95, 0.95]) pipe([[px0, HH + 0.22, z], [px1, HH + 0.22, z]], z * z > 0.5 ? 0.09 : 0.12, z < 0 ? M.paint('#8a6a3a', { rivets: false }) : M.paint('#5d7a8a', { rivets: false }));
    for (let k = 0; k < 6; k++) {                                                                                        // tank hatches and vents
      const x = px0 + 0.8 + k * (px1 - px0 - 1.4) / 5;
      for (const s of [-1, 1]) { cyl(0.28, 0.12, dark, x, HH, s * 1.35, { seg: 20, dirt: 0.1 }); cyl(0.07, 0.4, M.steel, x + 0.4, HH, s * 1.4, { seg: 10 }); }
    }
    const mx = (px0 + px1) / 2;                                                                                           // the cargo manifold amidships
    box(0.9, 0.35, half * 2 - 0.4, M.paint('#4b5157', { panelW: 64 }), mx, HH, 0, { dirt: 0.2 });
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) hcyl(0.1, 0.5, M.paint('#c43b2a', { rivets: false }), mx - 0.25 + k * 0.25, HH + 0.45, s * (half - 0.35), { axis: 'z', dirt: 0 });
    // hazard placards on deck fore and aft of the manifold
    const plac = L.canvasTex(128, (g, n) => { g.fillStyle = '#e8541c'; g.fillRect(0, 0, n, n); g.strokeStyle = '#1b1b1b'; g.lineWidth = 6; g.strokeRect(10, 10, n - 20, n - 20);
      g.fillStyle = '#1b1b1b'; g.beginPath(); g.moveTo(n / 2, 26); g.bezierCurveTo(n * 0.78, n * 0.45, n * 0.7, n * 0.66, n / 2, n * 0.7); g.bezierCurveTo(n * 0.3, n * 0.66, n * 0.24, n * 0.48, n * 0.4, n * 0.36);
      g.bezierCurveTo(n * 0.42, n * 0.48, n * 0.5, n * 0.5, n / 2, 26); g.fill(); });
    const placM = new THREE.MeshStandardMaterial({ map: plac, roughness: 0.6, vertexColors: true });
    for (const x of [mx - 2.2, mx + 2.2]) { const pl = box(0.6, 0.02, 0.6, placM, x, HH + 0.05, 0, { dirt: 0, cast: false }); pl.rotation.y = Math.PI / 4; }
    cyl(0.18, 0.25, dark, XB - 1.6, HH, -0.5, { seg: 16 }); cyl(0.18, 0.25, dark, XB - 1.6, HH, 0.5, { seg: 16 });
  }
  // a fuel-amber working light at the bow
  sphere(0.1, M.emit('#ffd9a0', 2), XB - (kind === 'ferry' ? 0.5 : 1.0), HH + 0.4, 0, { cast: false });
}

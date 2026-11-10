// Shared missile model, built along +y from y = 0 (nozzle) inside the given group.
export function missile(L, g, len, r, teamHex) {
  const { cyl, box, mesh, group, M, THREE } = L;
  const white = M.paint('#d9d5ca', { panelW: 512, panelH: 128 }), gun = M.paint('#4b5157'), team = M.paint(teamHex, { rivets: false });
  cyl(r * 0.72, 0.45, M.dark, 0, 0, 0, { rTop: r * 0.5, parent: g, dirt: 0 });
  cyl(r, len, white, 0, 0.45, 0, { parent: g, seg: 36, dirt: 0 });
  const h = r * 2.6, pts = [[r, 0], [r * 0.97, h * 0.2], [r * 0.86, h * 0.45], [r * 0.62, h * 0.7], [r * 0.32, h * 0.9], [0.02, h]].map(([x, y]) => new THREE.Vector2(x, y));
  const nose = new THREE.LatheGeometry(pts, 36); mesh(nose, gun, 0, 0.45 + len, 0, { parent: g, dirt: 0 });
  for (const y of [0.45 + len * 0.18, 0.45 + len * 0.62]) cyl(r * 1.012, 0.16, gun, 0, y, 0, { parent: g, seg: 36, dirt: 0 });
  cyl(r * 1.015, 0.3, team, 0, 0.45 + len * 0.82, 0, { parent: g, seg: 36, dirt: 0 });
  for (let k = 0; k < 4; k++) { const f = group(0, 0, 0, k * Math.PI / 2 + Math.PI / 4, g); box(0.07, len * 0.2, r * 1.3, gun, 0, 0.5, r + r * 0.55, { parent: f, dirt: 0 }); }
}

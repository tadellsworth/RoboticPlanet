// Shared nuclear parts: the radiation trefoil texture and the nuclear missile model.
// trefoil(L, bg): canvas texture, black trefoil on a yellow disc (transparent outside the disc unless bg is given).
export function trefoil(L, bg = null) {
  return L.canvasTex(256, (g, n) => {
    const c = n / 2, R = n * 0.47;
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, n, n); }
    g.fillStyle = '#f2c230'; g.beginPath(); g.arc(c, c, R, 0, 7); g.fill();
    g.strokeStyle = '#1b1a18'; g.lineWidth = n * 0.035; g.beginPath(); g.arc(c, c, R - n * 0.02, 0, 7); g.stroke();
    g.fillStyle = '#1b1a18'; g.beginPath(); g.arc(c, c, R * 0.17, 0, 7); g.fill();
    for (const mid of [90, 210, 330]) {               // canvas angles run clockwise (y down): bottom, upper left, upper right
      const a0 = (mid - 30) * Math.PI / 180, a1 = (mid + 30) * Math.PI / 180;
      g.beginPath(); g.arc(c, c, R * 0.82, a0, a1); g.arc(c, c, R * 0.26, a1, a0, true); g.closePath(); g.fill();
    }
    for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(60,50,40,${L.rnd() * 0.25})`; g.fillRect(L.rnd() * n, L.rnd() * n, 2, 2); }
  });
}

// Nuclear missile, built along +y from y = 0 (nozzle) inside group g. Made to look nothing like the standard
// missile: slim matte-black body, a long needle nose with a chrome spike, a yellow warhead band with trefoils,
// a hazard ring at the nose, big swept hazard-striped delta fins and sharp mid-body canards; a team-colour ring.
export function nukeMissile(L, g, len, r, teamHex) {
  const { cyl, box, mesh, group, M, THREE } = L;
  const body = M.paint('#202327', { panelW: 512, panelH: 128, rough: 0.85 }), yel = M.paint('#e8b830', { rivets: false });
  const dark = M.paint('#141517', { rivets: false });
  const tf = trefoil(L, '#e8b830'); tf.wrapS = tf.wrapT = THREE.ClampToEdgeWrapping;
  cyl(r * 0.8, 0.5, M.dark, 0, 0, 0, { rTop: r * 0.6, parent: g, dirt: 0 });
  cyl(r, len, body, 0, 0.5, 0, { parent: g, seg: 40, dirt: 0 });
  // yellow warhead band with three trefoil labels, framed by dark rings
  const wy = 0.5 + len * 0.7, wh = r * 1.6;
  cyl(r * 1.01, wh, yel, 0, wy, 0, { parent: g, seg: 40, dirt: 0 });
  const lab = new THREE.MeshStandardMaterial({ map: tf, roughness: 0.6, metalness: 0.1 });
  for (let k = 0; k < 3; k++) {
    const geo = new THREE.CylinderGeometry(r * 1.02, r * 1.02, wh * 0.9, 24, 1, true, k * 2.094 - 0.5, 1.0);
    geo.translate(0, wy + wh * 0.05, 0); const m = new THREE.Mesh(geo, lab); m.castShadow = false; g.add(m);
  }
  for (const y of [wy - 0.07, wy + wh]) cyl(r * 1.03, 0.07, dark, 0, y, 0, { parent: g, seg: 40, dirt: 0 });
  cyl(r * 1.015, 0.22, M.paint(teamHex, { rivets: false }), 0, 0.5 + len * 0.5, 0, { parent: g, seg: 40, dirt: 0 });
  // long needle nose: hazard ring at the base, black ogive, chrome spike
  const top = 0.5 + len, h = r * 5.2;
  cyl(r * 1.02, 0.26, M.hazard, 0, top - 0.26, 0, { parent: g, seg: 40, dirt: 0 });
  const pts = []; for (let i = 0; i <= 16; i++) { const t = i / 16; pts.push(new THREE.Vector2(Math.max(0.012, r * Math.pow(1 - t, 1.25) * (1 - 0.08 * Math.sin(Math.PI * t))), h * t)); }
  mesh(new THREE.LatheGeometry(pts, 40), dark, 0, top, 0, { parent: g, dirt: 0 });
  cyl(r * 0.08, h * 0.22, M.chrome, 0, top + h * 0.86, 0, { rTop: 0.004, parent: g, seg: 16, dirt: 0 });
  // big swept delta fins at the tail (tips reaching below the nozzle) and sharp canards mid-body
  const fin = new THREE.Shape(); fin.moveTo(0, len * 0.3); fin.lineTo(0, 0.55); fin.lineTo(r * 1.9, -0.25); fin.lineTo(r * 1.9, 0.15); fin.closePath();
  const can = new THREE.Shape(); can.moveTo(0, r * 1.6); can.lineTo(0, 0); can.lineTo(r * 0.85, -r * 0.2); can.closePath();
  for (let k = 0; k < 4; k++) {
    const f = group(0, 0, 0, k * Math.PI / 2 + Math.PI / 4, g);
    const fg = new THREE.ExtrudeGeometry(fin, { depth: 0.07, bevelEnabled: false }); fg.translate(0, 0, -0.035); fg.rotateY(-Math.PI / 2);
    mesh(fg, M.hazard, 0, 0.0, r * 0.95, { parent: f, ry: -Math.PI / 2, dirt: 0 });
    const cg = new THREE.ExtrudeGeometry(can, { depth: 0.05, bevelEnabled: false }); cg.translate(0, 0, -0.025); cg.rotateY(-Math.PI / 2);
    mesh(cg, dark, 0, 0.5 + len * 0.42, r * 0.97, { parent: f, ry: -Math.PI / 2, dirt: 0 });
  }
}

// The Reservoir (Terraforming stage 5, the owner's pick: concept A, "Dew Towers": condensation, never ice from orbit):
// three tall finned condenser towers along the back, each with a big fan in a shroud on top drawing the air through,
// mist breathing off the fans; their downpipes fill a long concrete cistern; a stepped spillway runs off the pad's
// front-right corner where the water leaves for the basin. A control house at the front left. 3 x 3 (30 x 30 units),
// framed like the Deep Core. Team colour on the towers' bands and the house; basin teal (the accent) on the gauges.
//   (plain)          the building without its moving parts (the game draws the work frame over it, still when it stops)
//   part=work&f=k    only the moving parts, frame k of 4: the fans turned a fifth of a turn (five blades: the loop
//                    closes), the mist risen, the cistern's ripples and the spill's foam on (renderer/b/worklib.js)
//   site=1|2         build stages: footings and a crawler crane; the towers rising in scaffolding
// Marks: 'beacon', 'fan0'..'fan2', 'cistern', 'outfall'.
import { setup, gameTextures, puffs, site } from './t5kit.js';
import { workLayer, hideParts } from './worklib.js';
const Q = new URLSearchParams(location.search);
const F = +(Q.get('f') || 0), SITE = +(Q.get('site') || 0), WORK = Q.get('part') === 'work';
const PI = Math.PI;
export const config = { pad: false };

export default async function (L) {
  const { box, cyl, beam, sphere, hoop, mesh, group, mark, ao, pointLight, pipe, M, THREE } = L;
  L.seed(5101);
  const { T, dark, NB } = setup(L), G = await gameTextures(L);
  G.waterT.offset.set(F * 0.06, F * 0.03);
  ao(0, 0, 28, 28, 0.3);
  const towers = [[-9.5, -8.5], [0, -10], [9.5, -8.5]], mov = [];
  const finM = M.paint('#b9b4aa', { rivets: false, panelW: 512, panelH: 64 }), bodyM = M.paint('#d6d2c8', { rivets: false, panelH: 128 });
  for (const [k, [x, z]] of towers.entries()) {
    box(6, 1.0, 6, T.concD, x, 0, z, { dirt: 0.6 });
    box(6.2, 0.14, 6.2, T.concL, x, 1.0, z, { dirt: 0.3 });
    // legs and the air inlet skirt
    for (const a of [0.25, 1.82, 3.39, 4.96]) beam([x + Math.cos(a) * 2.8, 1.1, z + Math.sin(a) * 2.8], [x + Math.cos(a) * 2.1, 4, z + Math.sin(a) * 2.1], 0.4, 0.4, T.greyD, { dirt: 0 });
    cyl(2.0, 2.9, T.dark, x, 1.1, z, { seg: 32, dirt: 0 });
    cyl(2.35, 13, bodyM, x, 4, z, { seg: 40, rTop: 2.0, dirt: 0.6, dirtH: 5 });
    for (let y = 4.4; y < 15.6; y += 0.62) hoop(2.38 - (y - 4) * 0.027, 0.09, finM, x, y, z);
    hoop(2.12, 0.18, T.team, x, 12.8, z); hoop(2.1, 0.18, T.team, x, 13.25, z);
    // accent level lamps up the tower's front
    for (let i = 0; i < 5; i++) box(0.3, 0.3, 0.12, i <= 2 ? T.acc : T.accDim, x, 5.2 + i * 1.4, z + 2.3 - i * 0.04, T.nc);
    // the fan shroud and fan
    const TY = 17;
    cyl(2.9, 1.7, T.grey, x, TY - 0.3, z, { seg: 40, open: true, dirt: 0.2 });
    hoop(2.9, 0.14, T.greyD, x, TY + 1.4, z);
    cyl(2.7, 0.08, T.hole, x, TY + 0.6, z, { seg: 32, cast: false, dirt: 0 });
    const fan = group(x, TY + 0.9, z); mov.push(fan); fan.rotation.y = (k % 2 ? -1 : 1) * F * (PI / 10) + k;
    for (let b = 0; b < 5; b++) { const bl = new THREE.BoxGeometry(2.4, 0.06, 0.62); bl.translate(1.3, 0, 0); mesh(bl, T.white, 0, 0, 0, { parent: fan, ry: b * 2 * PI / 5, rx: 0.25, dirt: 0 }); }
    cyl(0.45, 0.5, T.greyD, 0, -0.2, 0, { parent: fan, seg: 16 });
    // under the shroud: the drum the tower's middle cools on
    cyl(2.05, 0.9, T.greyD, x, TY - 1.2, z, { seg: 32 });
    sphere(0.18, T.beacon, x + 2.6, TY + 1.5, z, { cast: false });
    if (k === 1) mark('beacon', x + 2.6, TY + 1.5, z);
    mark('fan' + k, x, TY + 1.2, z);
    // mist off the fan
    if (!SITE) mov.push(...puffs(L, G.mist, x + 0.6, TY + 2.0, z + 0.2, 4, F, 1.7, 1.6, 0.7));
    // the downpipe to the cistern
    pipe([[x + 1.7, 4.4, z + 1.7], [x + 1.7, 3.2, z + 3.4], [x + 1.7, 3.2, -1.6], [x + 1.7, 2.2, -1.6]], 0.42, T.greyD);
  }
  // the cistern: a long concrete basin full of the game's water
  {
    const cx = -1.5, cz = 1.2, w = 22, d = 7;
    box(w, 1.0, d, T.concD, cx, 0, cz, { dirt: 0.5 });
    for (const s of [-1, 1]) { box(w, 2.4, 0.6, T.conc, cx, 0, cz + s * (d / 2 - 0.3), { dirt: 0.5, dirtH: 2.4 }); box(0.6, 2.4, d, T.conc, cx + s * (w / 2 - 0.3), 0, cz, { dirt: 0.5, dirtH: 2.4 }); }
    for (const s of [-1, 1]) { box(w + 0.2, 0.16, 0.8, T.concL, cx, 2.4, cz + s * (d / 2 - 0.3), { dirt: 0.2 }); box(0.8, 0.16, d, T.concL, cx + s * (w / 2 - 0.3), 2.4, cz, { dirt: 0.2 }); }
    const wp = new THREE.PlaneGeometry(w - 1.2, d - 1.2); wp.rotateX(-PI / 2); mesh(wp, G.water, cx, 1.95, cz, { cast: false, dirt: 0 });
    for (let k = 0; k < 3; k++) { const rp = new THREE.RingGeometry(0.6 + ((F + k) % 4) * 0.45, 0.75 + ((F + k) % 4) * 0.45, 32); rp.rotateX(-PI / 2); mov[mov.length] = mesh(rp, G.foam, [-11, -1.5, 8][k] + 0.1, 1.98, cz - 2.2, { cast: false, dirt: 0 }); }
    // rim lamps in the accent, the gauge of how full the basin is
    for (let i = 0; i < 9; i++) box(0.28, 0.22, 0.28, T.acc, cx - w / 2 + 1.2 + i * (w - 2.4) / 8, 2.56, cz + d / 2 - 0.3, T.nc);
    L.railing([[cx - w / 2, cz - d / 2 - 0.1], [cx + w / 2, cz - d / 2 - 0.1]], 2.4, { h: 0.8, spacing: 1.4, mat: T.yellow });
    mark('cistern', cx, 2.3, cz);
  }
  // the spillway: steps down from the cistern's east end, off the pad's front-right corner, foaming
  {
    const steps = 5;
    for (let s = 0; s < steps; s++) {
      const z = 5.2 + s * 2.0, y = 2.2 - s * 0.44, x = 9.0 + s * 0.3;
      box(5.2, y, 2.1, T.concD, x, 0, z, { dirt: 0.5 });
      for (const sx of [-1, 1]) box(0.4, y + 0.8, 2.1, T.conc, x + sx * 2.7, 0, z, { dirt: 0.4 });
      const wp = new THREE.PlaneGeometry(4.8, 2.0); wp.rotateX(-PI / 2); mesh(wp, G.water, x, y + 0.04, z, { cast: false, dirt: 0 });
      const fp = new THREE.PlaneGeometry(4.8, 0.5 + 0.25 * ((s + F) % 2)); fp.rotateX(-PI / 2); mov[mov.length] = mesh(fp, G.foam, x, y + 0.08, z + 0.8, { cast: false, dirt: 0 });
    }
    // the fall off the pad
    const fall = new THREE.PlaneGeometry(4.8, 1.8); mov.push(mesh(fall, G.foam, 10.2, -0.6, 15.05, { cast: false, dirt: 0 }));
    for (let k = 0; k < 6; k++) mov[mov.length] = sphere(0.45 + 0.15 * ((k + F) % 3), G.foam, 8.2 + k * 0.8, -0.2, 15.4 + 0.2 * ((k + F) % 2), { cast: false, dirt: 0 });
    mark('outfall', 10.2, 0, 15.2);
  }
  // the control house, front left
  {
    const hx = -9.5, hz = 9.5;
    box(8, 3.6, 5, T.white, hx, 0, hz, { dirt: 0.5, dirtH: 3.6 });
    box(8.2, 0.22, 5.2, T.concL, hx, 3.6, hz, { dirt: 0.2 });
    box(8.04, 0.3, 5.04, T.team, hx, 3.1, hz, T.nc);
    box(6.4, 0.7, 0.05, T.amber, hx, 1.8, hz + 2.53, T.nc);
    box(1.0, 2.0, 0.06, T.greyD, hx + 3.0, 0, hz + 2.54, T.nc);
    cyl(0.12, 3.4, T.greyD, hx - 3, 3.8, hz - 1.5, { seg: 10 });
    box(1.6, 1.0, 0.1, T.grey, hx - 3, 6.4, hz - 1.5, { dirt: 0 });
  }
  // floodlights and lit
  for (const [x, z, ry] of [[-14, -14, 0.8], [14, -14, -0.8], [-1.5, 6.4, PI]]) {
    cyl(0.12, 5.5, T.greyD, x, 0, z, { seg: 10 }); box(0.8, 0.5, 0.4, T.greyD, x, 5.5, z, { ry }); box(0.6, 0.36, 0.06, T.flood, x + Math.sin(ry) * 0.22, 5.57, z + Math.cos(ry) * 0.22, { ...T.nc, ry });
    if (dark) pointLight('#eef4ff', 5 * NB, x + Math.sin(ry) * 3, 4, z + Math.cos(ry) * 3, 9);
  }
  if (dark) { pointLight(L.ACCENT, 3 * NB, -1.5, 3.5, 5.5, 8); pointLight(L.ACCENT, 2.5 * NB, 10, 2.5, 11, 6); }
  if (!SITE) { if (WORK) workLayer(L, new Set(mov)); else hideParts(mov); }
  site(L, T, SITE, { cut2: 9, scaf: towers.map(([x, z]) => [x, z, 6.4, 6.4, 18]), craneAt: [4, 9, 0, -9, 22, 1.05] });
}

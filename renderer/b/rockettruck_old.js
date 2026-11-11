// Rocket Truck: a six-wheeled armoured truck with a four-tube rocket launcher on its back, top-down, facing +x,
// orthographic camera straight down, no ground (the game draws its shadow). 10 world units across the frame;
// the truck is about 7.6 long and 3.2 wide.
//   ?part=drive  travelling: the launcher box lies flat over the bed, tubes pointing forward
//   ?part=up     deployed: the launcher raised steeply toward the front (tube mouths showing), stabiliser legs out
// Gunmetal and olive armour; team colour on the cab roof band and the launcher's side stripes. Headlights and
// a small amber beacon glow.
export const config = { pad: false, size: 512 };
export default function (L) {
  const { box, cyl, hcyl, mesh, sphere, group, M, THREE, TEAM } = L;
  const part = new URLSearchParams(location.search).get('part') || 'drive';
  L.seed(611);
  const W = 10, cam = new THREE.OrthographicCamera(-W / 2, W / 2, W / 2, -W / 2, 0.1, 100);
  cam.position.set(0, 40, 0); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  L.useCamera(cam);
  const armor = M.paint('#4e5452', { rivets: false, panelW: 128, panelH: 128 }), olive = M.paint('#5d6247', { rivets: false, panelW: 128 });
  const dark = M.plain('#1b1d20', 0.6, 0.3), tyre = M.plain('#17181a', 0.9, 0), steel = M.plain('#6d7276', 0.35, 0.85);
  const team = M.paint(TEAM, { rivets: false }), glass = M.plain('#1d2a33', 0.15, 0.3), lamp = M.emit('#fff1d0', 2.2), amber = M.emit('#ffb347', 2.6);
  const Y = 0.55;
  // chassis and wheels (three axles each side)
  box(7.2, 0.5, 2.7, dark, 0, Y, 0, { dirt: 0.3 });
  for (const x of [2.3, -0.9, -2.5]) for (const s of [-1, 1]) {
    const w = hcyl(0.62, 0.55, tyre, x, Y + 0.05, s * 1.45, { axis: 'z', seg: 18, dirt: 0 });
    void w;
  }
  // the cab at the front: armoured, sloped windscreen, team band on the roof
  box(2.1, 1.35, 2.9, armor, 2.75, Y + 0.45, 0, { dirt: 0.2 });
  { const g = new THREE.BoxGeometry(0.7, 0.9, 2.6); const m = mesh(g, glass, 3.75, Y + 1.35, 0, { dirt: 0 }); m.rotation.z = -0.5; }
  box(0.32, 0.1, 2.92, team, 2.0, Y + 1.8, 0, { dirt: 0 });                       // a team stripe across the roof
  box(0.5, 0.18, 0.5, armor, 2.2, Y + 1.92, 0.8, { dirt: 0 });                    // a roof hatch
  sphere(0.09, M.emit('#ffb347', 1.4), 2.2, Y + 2.0, -0.8, { cast: false });       // the beacon
  for (const s of [-1, 1]) box(0.08, 0.22, 0.4, lamp, 3.82, Y + 0.75, s * 1.1, { dirt: 0, cast: false }); // headlights
  // the bed behind, with side armour
  box(4.5, 0.35, 2.8, olive, -1.35, Y + 0.45, 0, { dirt: 0.3 });
  for (const s of [-1, 1]) box(4.5, 0.55, 0.12, olive, -1.35, Y + 0.8, s * 1.38, { dirt: 0.3 });
  // the launcher: a turntable and a box of 4 tubes (2 x 2)
  const LX = -1.4, LY = Y + 0.95;
  cyl(1.0, 0.22, steel, LX, LY - 0.12, 0, { seg: 24, dirt: 0 });
  const rack = group(LX + 0.2, LY + 0.35, 0, 0);
  const up = part === 'up';
  rack.rotation.z = up ? 0.95 : 0.04; // raised steeply toward the front, or lying flat
  const R = { parent: rack };
  // four launch tubes in a 2 x 2 bundle, held by steel bands, a team stripe down each side
  box(4.0, 0.9, 1.9, dark, 0.6, -0.75, 0, { dirt: 0.1, ...R });
  for (const [yy, zz] of [[-0.6, -0.5], [-0.6, 0.5], [-0.05, -0.5], [-0.05, 0.5]]) {
    hcyl(0.34, 4.0, olive, 0.6, yy, zz, { seg: 18, ...R });
    hcyl(0.36, 0.12, steel, 2.62, yy, zz, { seg: 18, ...R });
    hcyl(0.27, 0.04, M.dark, 2.7, yy, zz, { seg: 16, ...R });                      // tube mouths
    sphere(0.17, M.plain('#c9cdd2', 0.4, 0.5), 2.62, yy, zz, { ...R });            // rocket noses in the tubes
  }
  for (const x of [-0.9, 0.6, 2.1]) box(0.16, 1.4, 2.05, steel, x, -0.95, 0, { dirt: 0, ...R }); // bands round the bundle
  for (const s of [-1, 1]) box(3.0, 0.14, 0.05, team, 0.4, -0.35, s * 0.9, { dirt: 0, ...R });
  box(0.5, 0.6, 0.6, steel, -1.45, -0.45, 0, { dirt: 0, ...R });                    // the elevating ram
  // deployed: stabiliser legs out at the four corners of the bed
  if (up) for (const x of [0.6, -3.2]) for (const s of [-1, 1]) {
    box(0.18, 0.18, 1.0, steel, x, Y + 0.25, s * 1.9, { dirt: 0 });
    cyl(0.28, 0.1, dark, x, Y - 0.25, s * 2.35, { seg: 12, dirt: 0 });
  }
}

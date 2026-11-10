// Pipeline tiles, 256 px, straight down (image top = -z), 10 world units per tile, lit like the buildings and the
// track tiles. The game turns each piece to fit (like the rail pieces).
//   ?piece = straight | corner | tee | cross | end | raised
//   straight  west to east, on a concrete saddle with a bolted flange at the middle
//   corner    in from the west, a long-radius elbow, out to the south
//   tee       west to east with a branch to the south, and a valve with a red handwheel at the joint
//   cross     all four sides, through a square junction box
//   end       from the west to a blind flange (a cap) at the middle
//   raised    west to east, lifted on a steel gantry (two legs at the tile's north and south edges): where the
//             pipe crosses a road, railway track or water
// A shadow catcher at ground level keeps each piece's shadow on a transparent background.
export const config = { pad: false, size: 512 };
const PR = 0.62, PY = 0.86, PY_HI = 2.7;            // pipe radius; centre height on the ground and on the gantry
const RB = 1.7;                                      // elbow radius (centre line)

export default function (L) {
  const { box, cyl, hcyl, mesh, group, M, THREE } = L;
  const piece = new URLSearchParams(location.search).get('piece') || 'straight';
  L.seed(5150);
  const W = 10, cam = new THREE.OrthographicCamera(-W / 2, W / 2, W / 2, -W / 2, 0.1, 100);
  cam.position.set(0, 40, 0); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  L.useCamera(cam);

  const body = M.paint('#a3a9ae', { rivets: false, rough: 0.5, metal: 0.45, panelW: 512, panelH: 512 });
  const flangeM = M.paint('#7d848a', { rivets: false, rough: 0.55, metal: 0.5, panelW: 512, panelH: 512 });
  const bolt = M.plain('#3a3d40', 0.5, 0.7);
  const conc = M.concrete, steelFrame = M.paint('#59616a', { rivets: false });
  const y = piece === 'raised' ? PY_HI : PY;

  // A run of pipe from (x0, z0) to (x1, z1) at height y.
  const run = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0); if (len < 0.01) return;
    hcyl(PR, len, body, (x0 + x1) / 2, y, (z0 + z1) / 2, { axis: x0 === x1 ? 'z' : 'x', dirt: 0.25 });
  };
  // A bolted flange ring around the pipe at (x, z), across the run's axis.
  const flange = (x, z, axis) => {
    hcyl(PR * 1.28, 0.3, flangeM, x, y, z, { axis, dirt: 0.2 });
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2, r = PR * 1.15, dy = Math.cos(a) * r, dd = Math.sin(a) * r;
      if (axis === 'x') L.sphere(0.07, bolt, x + 0.17, y + dy, z + dd, { dirt: 0 }); else L.sphere(0.07, bolt, x + dd, y + dy, z + 0.17, { dirt: 0 });
    }
  };
  // A concrete saddle under ground pipe, with a dark contact shadow.
  const saddle = (x, z, axis) => {
    const along = 0.9, across = PR * 2.5;
    box(axis === 'x' ? along : across, y - PR * 0.55, axis === 'x' ? across : along, conc, x, 0, z, { dirt: 0.6 });
    L.ao(x, z, (axis === 'x' ? along : across) + 0.5, (axis === 'x' ? across : along) + 0.5, 0.45);
  };
  // A long-radius elbow: a quarter torus in the ground plane, centred on (cx, cz), from angle a0 through 90°.
  const elbow = (cx, cz, a0) => {
    const g = new THREE.TorusGeometry(RB, PR, 18, 28, Math.PI / 2); g.rotateX(-Math.PI / 2); g.rotateY(-a0);
    mesh(g, body, cx, y, cz, { dirt: 0 });
  };

  if (piece === 'straight' || piece === 'raised') {
    run(-5, 0, 5, 0);
    flange(0, 0, 'x');
    if (piece === 'straight') saddle(-2.6, 0, 'x'), saddle(2.6, 0, 'x');
    else {
      // The gantry: two legs on concrete footings at the tile's north and south edges, a crossbeam under the pipe.
      for (const s of [-1, 1]) {
        box(0.42, PY_HI - PR - 0.16, 0.42, steelFrame, 0, 0, s * 4.25, { dirt: 0.5 });
        box(0.8, 0.22, 0.8, conc, 0, 0, s * 4.25, { dirt: 0.6 });
        L.beam([0, 0.6, s * 4.25], [0, PY_HI - PR - 0.4, s * 2.6], 0.14, 0.14, steelFrame);
      }
      box(0.46, 0.3, 9.0, steelFrame, 0, PY_HI - PR - 0.46, 0, { dirt: 0.3 });
      box(0.6, 0.16, PR * 1.9, flangeM, 0, PY_HI - PR - 0.16, 0, { dirt: 0.2 });   // pipe shoe
    }
  } else if (piece === 'corner') {
    run(-5, 0, -RB, 0);
    elbow(-RB, RB, 0);
    run(0, RB, 0, 5);
    flange(-RB - 0.15, 0, 'x'); flange(0, RB + 0.15, 'z');
    saddle(-3.6, 0, 'x'); saddle(0, 3.6, 'z');
  } else if (piece === 'tee') {
    run(-5, 0, 5, 0); run(0, 0, 0, 5);
    // The joint: a short drum where the branch meets, with a gate valve on the branch.
    hcyl(PR * 1.18, 1.5, flangeM, 0, y, 0, { axis: 'x', dirt: 0.2 });
    flange(0, 1.6, 'z');
    box(0.9, 0.7, 0.75, flangeM, 0, y + 0.2, 2.35, { dirt: 0.3 });            // valve body
    cyl(0.07, 0.55, M.steel, 0, y + 0.5, 2.35, { seg: 10, dirt: 0 });          // stem
    L.hoop(0.42, 0.06, M.paint('#b8322a', { rivets: false }), 0, y + 1.08, 2.35); // handwheel
    for (const a of [0, Math.PI / 2]) box(0.8 * Math.abs(Math.cos(a)) + 0.06, 0.05, 0.8 * Math.abs(Math.sin(a)) + 0.06, M.paint('#b8322a', { rivets: false }), 0, y + 1.07, 2.35, { dirt: 0 });
    saddle(-3.4, 0, 'x'); saddle(3.4, 0, 'x'); saddle(0, 3.9, 'z');
  } else if (piece === 'cross') {
    run(-5, 0, 5, 0); run(0, -5, 0, 5);
    box(PR * 3.2, PR * 2.5, PR * 3.2, flangeM, 0, y - PR * 1.25, 0, { dirt: 0.3 });   // junction box
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) L.sphere(0.09, bolt, dx * PR * 1.3, y + PR * 1.25, dz * PR * 1.3, { dirt: 0 });
    saddle(-3.4, 0, 'x'); saddle(3.4, 0, 'x'); saddle(0, -3.4, 'z'); saddle(0, 3.4, 'z');
  } else if (piece === 'end') {
    run(-5, 0, 1.2, 0);
    flange(1.2, 0, 'x');
    hcyl(PR * 1.28, 0.22, flangeM, 1.45, y, 0, { axis: 'x', dirt: 0.2 });       // blind flange
    L.sphere(PR * 0.6, flangeM, 1.56, y, 0, { dirt: 0 });
    saddle(-2.2, 0, 'x');
  }

  // Shadows on a transparent ground.
  const g = new THREE.PlaneGeometry(10, 10); g.rotateX(-Math.PI / 2);
  const sm = new THREE.Mesh(g, new THREE.ShadowMaterial({ opacity: 0.42, color: 0x120c08 })); sm.position.y = 0.001; sm.receiveShadow = true; L.getRoot().add(sm);
}

// Construction site: fresh slab with rebar, part-built steel frame, scaffolding, small tower crane, materials, hazard tape.
export default function (L) {
  const { box, cyl, hcyl, beam, pipe, lamp, ao, mesh, M, THREE, ACCENT } = L;
  const yel = M.paint('#b8952e'), primer = M.paint('#8a4a32'), rust = M.plain('#7a4426', 0.8, 0.4), tube = M.plain('#9aa2a8', 0.4, 0.8);
  L.seed(101);

  // fresh slab and formwork
  box(6.4, 0.35, 5.2, M.rough('#b2ab9e'), -0.6, 0, -0.8); ao(-0.6, -0.8, 6.4, 5.2, 0.45);
  box(6.5, 0.4, 0.1, M.wood, -0.6, 0, 1.85, { dirt: 0.4 }); box(0.1, 0.4, 5.3, M.wood, -3.85, 0, -0.8, { dirt: 0.4 });

  // rebar cage (back left)
  for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) cyl(0.035, 1.35, rust, -3.3 + i * 0.45, 0.35, -3.0 + j * 0.5, { seg: 6, dirt: 0 });
  for (let j = 0; j < 4; j++) for (const y of [0.42, 1.2]) beam([-3.35, y, -3.0 + j * 0.5], [-0.95, y, -3.0 + j * 0.5], 0.04, 0.04, rust);
  for (let i = 0; i < 6; i++) beam([-3.3 + i * 0.45, 0.42, -3.05], [-3.3 + i * 0.45, 0.42, -1.45], 0.04, 0.04, rust);

  // part-built steel frame with scaffolding in front
  for (const [x, z] of [[0.6, -2.7], [2.4, -2.7], [0.6, -1.0], [2.4, -1.0]]) box(0.3, 3.5, 0.3, primer, x, 0.35, z);
  beam([0.45, 3.7, -2.7], [2.55, 3.7, -2.7], 0.24, 0.34, primer); beam([0.6, 3.7, -2.85], [0.6, 3.7, -0.85], 0.24, 0.34, primer);
  beam([0.6, 0.6, -1.0], [2.4, 3.5, -1.0], 0.12, 0.12, primer);
  for (const x of [0.25, 1.5, 2.75]) for (const z of [-0.45, 0.05]) cyl(0.04, 3.2, tube, x, 0.35, z, { seg: 8, dirt: 0 });
  for (const y of [1.75, 3.15]) { beam([0.2, y, -0.45], [2.8, y, -0.45], 0.05, 0.05, tube); beam([0.2, y, 0.05], [2.8, y, 0.05], 0.05, 0.05, tube); box(2.7, 0.07, 0.5, M.wood, 1.5, y, -0.2, { dirt: 0 }); }
  beam([0.25, 0.4, 0.05], [1.5, 1.75, 0.05], 0.04, 0.04, tube); beam([1.5, 1.75, 0.05], [2.75, 3.15, 0.05], 0.04, 0.04, tube);

  // small tower crane (back right) carrying a steel beam
  const mx = 3.7, mz = -3.6, MH = 5.9;
  box(1.1, 0.4, 1.1, M.concrete, mx, 0, mz); ao(mx, mz, 1.1, 1.1, 0.5);
  for (const [dx, dz] of [[-0.3, -0.3], [0.3, -0.3], [0.3, 0.3], [-0.3, 0.3]]) box(0.09, MH - 0.4, 0.09, yel, mx + dx, 0.4, mz + dz, { dirt: 0 });
  for (let y = 0.4; y < MH - 0.6; y += 0.7) { beam([mx - 0.3, y, mz + 0.3], [mx + 0.3, y + 0.7, mz + 0.3], 0.05, 0.05, yel); beam([mx - 0.3, y + 0.7, mz - 0.3], [mx - 0.3, y, mz + 0.3], 0.05, 0.05, yel); }
  box(0.9, 0.55, 0.9, yel, mx, MH, mz); box(0.5, 0.45, 0.5, M.paint('#c7c2b6'), mx + 0.55, MH - 0.1, mz + 0.35);
  beam([mx, MH + 0.75, mz], [-2.0, MH + 0.75, mz], 0.08, 0.08, yel); beam([mx, MH + 0.4, mz - 0.2], [-2.0, MH + 0.4, mz - 0.2], 0.08, 0.08, yel); beam([mx, MH + 0.4, mz + 0.2], [-2.0, MH + 0.4, mz + 0.2], 0.08, 0.08, yel);
  for (let x = mx - 0.4; x > -2.0; x -= 0.6) { beam([x, MH + 0.4, mz - 0.2], [x - 0.3, MH + 0.75, mz], 0.04, 0.04, yel); beam([x, MH + 0.4, mz + 0.2], [x - 0.3, MH + 0.75, mz], 0.04, 0.04, yel); }
  beam([mx, MH + 0.6, mz], [4.85, MH + 0.6, mz], 0.2, 0.2, yel); box(0.5, 0.6, 0.5, M.concrete, 4.65, MH + 0.1, mz);
  box(0.3, 0.2, 0.4, M.dark, -0.6, MH + 0.25, mz, { dirt: 0 });
  box(0.03, 2.6, 0.03, M.dark, -0.6, MH - 2.4, mz, { dirt: 0 });
  box(2.2, 0.26, 0.3, primer, -0.6, MH - 2.65, mz, { dirt: 0 });
  lamp(mx, MH + 0.62, mz, ACCENT, { shape: 'sphere', size: 0.14, intensity: 3, dist: 3, k: 2.5 });

  // materials: steel beams on sleepers, pallet of blocks, pipe bundle
  for (const x of [0.6, 2.6]) box(0.2, 0.15, 1.2, M.wood, x, 0, 3.1);
  for (const [dy, dz] of [[0.15, -0.25], [0.15, 0.25], [0.39, 0]]) box(2.6, 0.24, 0.22, M.plain('#7f878d', 0.5, 0.7), 1.6, dy, 3.1 + dz);
  ao(1.6, 3.1, 2.7, 1.3, 0.45);
  box(1.6, 0.15, 1.2, M.wood, -2.3, 0, 3.1);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) for (let k = 0; k < 2; k++) box(0.48, 0.32, 0.55, M.rough('#9c968a'), -2.82 + i * 0.52, 0.15 + k * 0.33, 2.82 + j * 0.57, { dirt: 0.2 });
  ao(-2.3, 3.1, 1.6, 1.2, 0.45);
  for (const [dx, dy] of [[0, 0.2], [0.42, 0.2], [0.21, 0.56], [-0.42, 0.2]]) hcyl(0.2, 2.2, M.plain('#5d666e', 0.45, 0.7), 4.0 + dx, dy, 1.4, { axis: 'z' });

  // hazard tape on posts (front and left)
  const post = M.paint('#d06a2a', { rivets: false });
  const posts = [[-4.5, 4.4], [-1.5, 4.4], [1.5, 4.4], [4.5, 4.4], [-4.5, 1.4], [-4.5, -1.6], [-4.5, -4.4]];
  for (const [x, z] of posts) cyl(0.07, 0.95, post, x, 0, z, { seg: 10, dirt: 0.5 });
  for (let i = 0; i < 3; i++) box(3.0, 0.12, 0.025, M.hazard, -3.0 + i * 3.0, 0.75, 4.4, { dirt: 0 });
  for (const [z0, z1] of [[4.4, 1.4], [1.4, -1.6], [-1.6, -4.4]]) box(0.025, 0.12, Math.abs(z0 - z1), M.hazard, -4.5, 0.75, (z0 + z1) / 2, { dirt: 0 });
}

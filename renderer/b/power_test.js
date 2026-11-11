import { power } from './powerkit.js';
export default function (L) {
  const P = power(L), { box, M } = L;
  box(4, 2, 3, M.rough('#8f887c'), -1, 0, -1, { dirt: 0.6 });
  box(4.1, 0.15, 3.1, P.steelD, -1, 2, -1, { dirt: 0 });
  P.strip(4, -1, 2.17, 0.53); P.strip(4, -1, 2.17, -2.53);
  P.windows(3, 0.35, -1, 1.2, 0.51, 0, 5);
  P.conduit([[1.05, 1.6, -0.2], [1.6, 1.6, -0.2], [1.6, 0.1, -0.2], [2.8, 0.1, -0.2]]);
  P.junction(3.1, -0.2, -Math.PI / 2);
  P.transformer(2.6, 2.2, 0);
  P.flood(-3.6, 3, 2.4, Math.PI / 4);
  P.cable([1.05, 1.9, -1.5], [3.2, 1.5, 2.2], 0.4);
  P.beacon(-1, 2.5, -1);
}

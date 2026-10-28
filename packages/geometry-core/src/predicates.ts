/**
 * The package's one robust orientation seam.
 *
 * `robust-predicates`' `orient2d` is adaptive and exact for doubles. Its public
 * examples use a y-down screen convention, so this adapter negates the result to
 * the package's canonical `(u, v)` math convention:
 *
 *   `orient2dExact(a, b, c) > 0`  → c is left of the directed line a→b
 *   `orient2dExact(a, b, c) < 0`  → c is right of the directed line a→b
 *   `orient2dExact(a, b, c) === 0` → a, b, c are exactly collinear
 *
 * No epsilon is applied anywhere in this package: the sign is the answer.
 */
import { orient2d } from 'robust-predicates';

export function orient2dExact(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number
): number {
  const sign = -orient2d(ax, ay, bx, by, cx, cy);
  // Negation maps exact zero to -0; normalize so callers compare against 0.
  return sign === 0 ? 0 : sign;
}

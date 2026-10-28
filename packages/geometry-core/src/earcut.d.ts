/**
 * `earcut` 2.2.4 ships no type declarations. Only the one canonical call shape
 * is declared: a flat coordinate list, optional hole indices and a dimension.
 */
declare module 'earcut' {
  export default function earcut(
    data: ArrayLike<number>,
    holeIndices?: ArrayLike<number> | null,
    dim?: number
  ): number[];
}

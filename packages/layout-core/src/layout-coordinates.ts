/**
 * `layout-coordinates.ts` — the neutral Layout plan tuple.
 *
 * `LayoutVec2` is a plain `[x, z]` pair in metres on the project/world plan
 * datum: authored Junction points, Wall curve knots, sampled centerline points,
 * compiled bounds and every query record share it. It is deliberately its own
 * module (T1.P02.S05) so the coordinate vocabulary outlives the retired legacy
 * document barrel it used to be declared in: nothing here knows about a
 * document generation, a Room, a Floor or a Wall.
 *
 * The 3D counterpart stays in `types.ts` (`Vec3`).
 */
export type LayoutVec2 = [number, number];

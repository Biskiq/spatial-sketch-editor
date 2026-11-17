/**
 * The cap's fill: polygons with **their own** holes.
 *
 * `sectionMeshes` returns one flat list of loops — outers counter-clockwise, holes
 * clockwise — and the renderer must rebuild which hole belongs to which outer
 * before it can fill anything. Iterating "every hole for every outer" (the shape
 * this module replaced) gives each disjoint solid the other's holes, which puts
 * holes outside a face and lets earcut triangulate a shape that is not the
 * section.
 *
 * The containment mapping already exists in `loopsToPolygons` (smallest containing
 * outer wins). This module is the one place the renderer asks for it, so the
 * call site cannot drift back to the flat list, and it is testable on its own:
 * two outers with independent holes are two polygons, never two shapes sharing
 * both holes.
 */
import { loopsToPolygons, type SectionLoop, type SectionPoint } from './mesh-plane-section';

/** One outer ring with the holes that lie inside it, in the cap's plane basis. */
export type CapFill = {
	readonly outer: readonly SectionPoint[];
	readonly holes: readonly (readonly SectionPoint[])[];
};

/** The fillable polygons of one section group. */
export function capFillsOf(loops: readonly SectionLoop[]): readonly CapFill[] {
	return loopsToPolygons(loops);
}

import type { LayoutVec2 } from './layout-coordinates';
import { CLOSED_WALL_CIRCLE_SPAN_COUNT } from './layout-wall-first-types';

export const TEMPLATE_STEP = (Math.PI * 2) / CLOSED_WALL_CIRCLE_SPAN_COUNT;
export const TEMPLATE_HANDLE_K = (4 / 3) * Math.tan(TEMPLATE_STEP / 4);
export type UnitCubicScalar = readonly [LayoutVec2, LayoutVec2, LayoutVec2, LayoutVec2];

export const UNIT_TEMPLATE_SCALARS: readonly UnitCubicScalar[] = Array.from(
	{ length: CLOSED_WALL_CIRCLE_SPAN_COUNT },
	(_, index) => {
		const a0 = index * TEMPLATE_STEP;
		const a1 = (index + 1) * TEMPLATE_STEP;
		const c0 = Math.cos(a0);
		const s0 = Math.sin(a0);
		const c1 = index === CLOSED_WALL_CIRCLE_SPAN_COUNT - 1 ? 1 : Math.cos(a1);
		const s1 = index === CLOSED_WALL_CIRCLE_SPAN_COUNT - 1 ? 0 : Math.sin(a1);
		const p0: LayoutVec2 = [c0, s0];
		const p1: LayoutVec2 = [c0 - TEMPLATE_HANDLE_K * s0, s0 + TEMPLATE_HANDLE_K * c0];
		const p2: LayoutVec2 = [c1 + TEMPLATE_HANDLE_K * s1, s1 - TEMPLATE_HANDLE_K * c1];
		const p3: LayoutVec2 = [c1, s1];
		return [p0, p1, p2, p3] as const;
	}
);

/** Rotate and scale a seam-aligned unit scalar point to centre-local, then add `center` once. */
export function unitToWorldPoint(
	unitPoint: LayoutVec2,
	center: LayoutVec2,
	radius: number,
	seamDirection: LayoutVec2
): LayoutVec2 {
	const [ux, uz] = seamDirection;
	const localX = radius * (unitPoint[0] * ux - unitPoint[1] * uz);
	const localZ = radius * (unitPoint[0] * uz + unitPoint[1] * ux);
	return [center[0] + localX, center[1] + localZ];
}

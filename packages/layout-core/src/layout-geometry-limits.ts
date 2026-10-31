/**
 * The supported authored-geometry envelope, and the one refusal message.
 *
 * ## Where 1,000 m comes from
 *
 * Measured on 2026-10-31, on latest `main` after PR #235, with the production
 * compiler and Paper drawing over a four-Wall enclosure whose long Wall is the
 * stated length (`apps/editor/tests/lib/authoring/stage-paper.test.ts` fixture;
 * Node 22, `performance.now()`, one warm compile per row):
 *
 * | long Wall | compiled samples | compile | Paper plan build | union outline | Paper scene |
 * | --- | --- | --- | --- | --- | --- |
 * | 1,000 m | 4,000 | 45 ms | 53 ms | 39 ms | 18 ms |
 * | 2,000 m | 8,000 | 89 ms | 171 ms | 87 ms | 35 ms |
 * | 4,000 m | 16,000 | 180 ms | 654 ms | 156 ms | 70 ms |
 * | 8,000 m | 32,000 | 453 ms | 2,495 ms | 317 ms | 154 ms |
 *
 * The S12–S15 spatial index keeps the 1,000 m path linear (4,000 bands) and
 * usable: a full Plan rebuild stays around 150 ms. Above it the Plan drawing
 * build grows ~3–4× per doubling (the index's candidate sets widen), while a
 * pointer drag also re-plans and re-compiles: a typed length's plan plus
 * compile costs 187 ms at 2,000 m, 377 ms at 4,000 m and 800 ms at 8,000 m.
 * 1,000 m is therefore the measured edge of the optimization's envelope, not an
 * arbitrary bound or a second performance mechanism. The 1,000 m acceptance
 * evidence from #235 stays exactly on the supported side of the boundary.
 *
 * The limit applies to authored linear dimensions (Wall height/thickness,
 * Opening measures) and to every Wall's authored span: a straight Wall's chord,
 * or a curved Wall's control-polygon length (an upper bound on arc length, so a
 * far handle cannot hide an oversized curve). Positions are not dimensions; a
 * rigid move may translate a Wall anywhere without changing this check.
 */
import type { LayoutVec2 } from './layout-coordinates';
import type { LayoutDocumentIssue } from './layout-issue';
import type { LayoutDocumentWallFirst, LayoutWall } from './layout-wall-first-types';

/** The largest supported authored dimension or Wall span, in meters. */
export const MAX_LAYOUT_DIMENSION_METERS = 1_000;

/** The one creator-facing refusal for an unsupported dimension. */
export const LAYOUT_DIMENSION_LIMIT_MESSAGE = `Geometry is limited to ${MAX_LAYOUT_DIMENSION_METERS} m; enter a smaller value.`;

/**
 * A micrometre of slack, so a value authored as exactly the limit is never
 * refused because a normalized direction's round trip lands one ULP above it.
 * It is far below any authored precision and far below the next meaningful
 * refusal (the tests pin just-over at +1 mm).
 */
const DIMENSION_LIMIT_TOLERANCE_METERS = 1e-6;

/** True when `value` is finite and outside the supported envelope. */
export function exceedsLayoutDimension(value: number): boolean {
	return Number.isFinite(value) && value > MAX_LAYOUT_DIMENSION_METERS + DIMENSION_LIMIT_TOLERANCE_METERS;
}

/** An import/read issue that names the oversized subject and its measured span. */
export function layoutDimensionIssueMessage(subject: string, value: number): string {
	return `${subject} is ${value} m; geometry is limited to ${MAX_LAYOUT_DIMENSION_METERS} m.`;
}

function distance(a: LayoutVec2, b: LayoutVec2): number {
	return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

/**
 * The authored span of one Wall, or `null` when its Junctions do not resolve.
 *
 * A straight Wall is its chord. A curved Wall uses the control-polygon length,
 * which bounds the Bézier arc length; that keeps the check conservative without
 * sampling the curve a second time.
 */
export function layoutWallSpanMeters(
	wall: Pick<LayoutWall, 'startJunctionId' | 'endJunctionId' | 'centerline'>,
	pointById: ReadonlyMap<string, LayoutVec2>
): number | null {
	const start = pointById.get(wall.startJunctionId);
	const end = pointById.get(wall.endJunctionId);
	if (start === undefined || end === undefined) return null;
	if (wall.centerline.kind === 'line') return distance(start, end);
	const points = [start, ...wall.centerline.knots.map((knot) => knot.point), end];
	let total = 0;
	for (const [index, span] of wall.centerline.spans.entries()) {
		const from = points[index];
		const to = points[index + 1];
		if (from === undefined || to === undefined) return null;
		total += distance(from, span.handleOut) + distance(span.handleOut, span.handleIn) + distance(span.handleIn, to);
	}
	return total;
}

/**
 * Every authored dimension or Wall span outside the supported envelope, in
 * deterministic document order. Used by the canonical read validator, so an
 * imported source is refused before the compiler or the Stage samples it.
 */
export function layoutDimensionLimitIssues(document: LayoutDocumentWallFirst): LayoutDocumentIssue[] {
	const issues: LayoutDocumentIssue[] = [];
	const pointById = new Map(document.junctions.map((junction) => [junction.id, junction.point]));
	document.walls.forEach((wall, index) => {
		const path = `$.walls[${index}]`;
		for (const field of ['height', 'thickness'] as const) {
			const value = wall[field];
			if (exceedsLayoutDimension(value)) {
				issues.push({
					path: `${path}.${field}`,
					code: 'dimension_out_of_range',
					message: layoutDimensionIssueMessage(`Wall '${wall.id}' ${field}`, value)
				});
			}
		}
		const span = layoutWallSpanMeters(wall, pointById);
		if (span !== null && exceedsLayoutDimension(span)) {
			issues.push({
				path: `${path}.endJunctionId`,
				code: 'dimension_out_of_range',
				message: layoutDimensionIssueMessage(`Wall '${wall.id}' span`, span)
			});
		}
	});
	document.openings.forEach((opening, index) => {
		const path = `$.openings[${index}]`;
		for (const field of ['offset', 'width', 'height', 'sillHeight'] as const) {
			const value = opening[field];
			if (exceedsLayoutDimension(value)) {
				issues.push({
					path: `${path}.${field}`,
					code: 'dimension_out_of_range',
					message: layoutDimensionIssueMessage(`Opening '${opening.id}' ${field}`, value)
				});
			}
		}
	});
	return issues;
}

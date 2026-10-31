/**
 * R217.S14 — Layout candidate geometry from the planner's own document.
 *
 * The preview is not a second solve. A caller hands this module the exact
 * document a retained planner produced, compiles it through the same geometry
 * core admission uses, evaluates the live Plan parameters against it, and reads
 * the same `buildPaperPlan` drawing Paper draws. The result is filtered to the
 * source ids the operation changed, so the preview can never show more than the
 * commit will.
 *
 * It emits **world coordinates**. The Stage facade is the one boundary that
 * projects them, exactly as it does every overlay mark.
 */
import {
	compileWallFirstLayoutGeometry,
	evaluateLayoutPlan,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type PlanEvaluation
} from '@portfolio/layout-core';

import { buildPaperPlan } from '$lib/authoring/stage/paper-plan';
import type { StageCandidatePreview } from '$lib/authoring/stage/stage-facade';

type Vec3 = [number, number, number];

export type CandidatePaperGeometry = {
	readonly polygons: readonly (readonly Vec3[])[];
	readonly segments: readonly (readonly [Vec3, Vec3])[];
};

export type LayoutCandidatePaper = {
	readonly subject: CandidatePaperGeometry;
	readonly affected: CandidatePaperGeometry;
};

function worldPoint(point: LayoutVec2, datumMeters: number): Vec3 {
	return [point[0], datumMeters, point[1]];
}

/**
 * Build the filtered Paper drawing for one candidate document.
 *
 * Every point is placed on the level **datum**, never the Paper cut elevation:
 * Plan is top-down and cannot tell the difference, but 3D must show the
 * candidate's footprint on the mat, not a slice floating at cut height.
 */
export function buildLayoutCandidatePaper(
	document: LayoutDocumentWallFirst,
	plan: PlanEvaluation,
	datumMeters: number,
	subjectIds: ReadonlySet<string>,
	affectedIds: ReadonlySet<string>
): LayoutCandidatePaper {
	const compiled = compileWallFirstLayoutGeometry(document).geometry;
	const evaluated = evaluateLayoutPlan(
		compiled,
		{
			cutHeightMeters: plan.cutHeightMeters,
			depthMeters: plan.depthMeters,
			lateralSpanHalfWidthMeters: plan.lateralSpanHalfWidthMeters,
			sourceKindFilter: plan.sourceKindFilter,
			reveal: plan.reveal
		},
		{
			generationId: `${plan.generationId}:candidate`,
			target: plan.target,
			datumMeters: plan.datumMeters
		}
	);
	if (evaluated.kind === 'refused') {
		return { subject: { polygons: [], segments: [] }, affected: { polygons: [], segments: [] } };
	}
	const drawing = buildPaperPlan(evaluated.plan, compiled, { footprints: [] });
	const polygonsFor = (ids: ReadonlySet<string>): CandidatePaperGeometry['polygons'] =>
		drawing.fills.flatMap((fill) =>
			ids.has(fill.sourceId)
				? fill.polygons.map((polygon) =>
						polygon.map((point) => worldPoint(point, datumMeters))
					)
				: []
		);
	const segmentsFor = (ids: ReadonlySet<string>): CandidatePaperGeometry['segments'] =>
		drawing.lines.flatMap((line) =>
			ids.has(line.sourceId)
				? line.segments.map(
						([start, end]) =>
							[
								worldPoint(start, datumMeters),
								worldPoint(end, datumMeters)
							] as const
					)
				: []
		);
	return {
		subject: { polygons: polygonsFor(subjectIds), segments: segmentsFor(subjectIds) },
		affected: { polygons: polygonsFor(affectedIds), segments: segmentsFor(affectedIds) }
	};
}

/** The opening ids hosted by any of the named Walls. */
export function openingIdsOnWalls(
	document: LayoutDocumentWallFirst,
	wallIds: ReadonlySet<string>
): readonly string[] {
	return document.openings
		.filter((opening) => wallIds.has(opening.wallId))
		.map((opening) => opening.id);
}

/** One candidate contribution, with no second projection. */
export function candidatePreviewOf(input: {
	readonly id: string;
	readonly role: StageCandidatePreview['role'];
	readonly geometry: CandidatePaperGeometry;
	readonly labels?: readonly { readonly world: Vec3; readonly text: string }[];
	readonly snap?: { readonly world: Vec3; readonly name: string };
}): StageCandidatePreview {
	return {
		id: input.id,
		role: input.role,
		polygons: input.geometry.polygons,
		segments: input.geometry.segments,
		labels: input.labels ?? [],
		...(input.snap === undefined ? {} : { snap: input.snap })
	};
}

/**
 * R217.S14 — Layout candidate geometry from the planner's own document.
 *
 * The preview is not a second solve. A caller hands this module the compiled
 * geometry of the exact document a retained planner produced (read through the
 * Layout adapter's compile context, E4), evaluates the live Plan parameters against it, and reads
 * the same `buildPaperPlan` drawing Paper draws. The result is filtered to the
 * source ids the operation changed, so the preview can never show more than the
 * commit will.
 *
 * It emits **world coordinates**. The Stage facade is the one boundary that
 * projects them, exactly as it does every overlay mark.
 */
import {
	evaluateLayoutPlan,
	buildArchProfile,
	countWork,
	type LayoutDocumentWallFirst,
	type LayoutWallOpening,
	type LayoutVec2,
	type PlanEvaluation,
	type CompiledLayoutGeometry,
	wallCenterlineSamples,
	openingAttemptSymbolSource,
	openingPlanSymbol
} from '@portfolio/layout-core';

import { compiledOpeningFaceLoops, openingFaceLoops, openingLoopSegments } from '../../layout/opening-faces';
import { buildPaperPlan, unionOutline } from '$lib/authoring/stage/stage-adapter-host';
import type { StageCandidatePreview } from '$lib/authoring/stage/stage-adapter-host';

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

export type OpeningGhostValues = Pick<LayoutWallOpening, 'kind' | 'profile' | 'offset' | 'width' | 'height' | 'sillHeight'>;

/** The candidate's compiled profile outline on both Wall faces in the 3D reading. */
export function openingFacePaper(
	compiled: CompiledLayoutGeometry,
	openingIds: ReadonlySet<string>,
	datumMeters: number
): CandidatePaperGeometry {
	countWork('candidate:opening-build');
	const segments: CandidatePaperGeometry['segments'][number][] = [];
	for (const wall of compiled.walls) {
		for (const opening of wall.openings) {
			if (!openingIds.has(opening.openingId)) continue;
			segments.push(...openingLoopSegments(compiledOpeningFaceLoops(wall, opening, datumMeters)));
		}
	}
	return { polygons: [], segments };
}

/** A rejected placement stays at the raw typed/pointer dimensions and is never clamped. */
export function openingAttemptFacePaper(
	compiled: CompiledLayoutGeometry,
	wallId: string,
	values: OpeningGhostValues,
	datumMeters: number
): CandidatePaperGeometry {
	countWork('candidate:opening-build');
	const wall = compiled.walls.find((candidate) => candidate.wallId === wallId);
	if (wall === undefined) return { polygons: [], segments: [] };
	const profile = values.profile === 'rectangular'
		? { topBoundary: [[0, values.height], [values.width, values.height]] as LayoutVec2[] }
		: buildArchProfile(values.profile, values.width, values.height).profile;
	const envelope = [[0, values.height], [values.width, values.height]] as LayoutVec2[];
	return { polygons: [], segments: openingLoopSegments(openingFaceLoops(wall, values, datumMeters, profile?.topBoundary ?? envelope)) };
}

/**
 * The rejected Plan attempt's symbol at its exact raw dimensions (E4 / I5): the
 * accepted Opening's own `openingPlanSymbol`, fed the compiler's centre frame
 * unclamped, so a refused and an accepted Opening draw identically.
 */
export function openingAttemptPlanPaper(
	compiled: CompiledLayoutGeometry,
	wallId: string,
	values: OpeningGhostValues,
	datumMeters: number
): CandidatePaperGeometry {
	countWork('candidate:opening-build');
	const wall = compiled.walls.find((candidate) => candidate.wallId === wallId);
	if (wall === undefined) return { polygons: [], segments: [] };
	const symbol = openingPlanSymbol(openingAttemptSymbolSource(wall, values), wall.thickness);
	return {
		polygons: [],
		segments: [...symbol.segments, ...symbol.dashedSegments].map(
			([a, b]) => [worldPoint(a, datumMeters), worldPoint(b, datumMeters)] as const
		)
	};
}

/**
 * Build the filtered Paper drawing for one compiled candidate document.
 *
 * Every point is placed on the level **datum**, never the Paper cut elevation:
 * Plan is top-down and cannot tell the difference, but 3D must show the
 * candidate's footprint on the mat, not a slice floating at cut height.
 */
export function buildCompiledLayoutCandidatePaper(
	compiled: CompiledLayoutGeometry,
	plan: PlanEvaluation,
	datumMeters: number,
	subjectIds: ReadonlySet<string>,
	affectedIds: ReadonlySet<string>,
	lateralSpanHalfWidthMeters = plan.lateralSpanHalfWidthMeters
): LayoutCandidatePaper {
	countWork('candidate:paper-build');
	const evaluated = evaluateLayoutPlan(
		compiled,
		{
			cutHeightMeters: plan.cutHeightMeters,
			depthMeters: plan.depthMeters,
			lateralSpanHalfWidthMeters,
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
	const segmentsFor = (ids: ReadonlySet<string>): CandidatePaperGeometry['segments'] => {
		const cutSources = new Set(
			drawing.fills
				.filter((fill) => ids.has(fill.sourceId) && fill.treatment === 'cut')
				.map((fill) => fill.sourceId)
		);
		const fillOutlines = [...ids].flatMap((sourceId) => {
			const polygons = drawing.fills
				.filter((fill) => fill.sourceId === sourceId)
				.flatMap((fill) => fill.polygons);
			return unionOutline(polygons).map(
				([start, end]) =>
					[worldPoint(start, datumMeters), worldPoint(end, datumMeters)] as const
			);
		});
		const planLines = drawing.lines.flatMap((line) =>
			ids.has(line.sourceId) && !(line.treatment === 'cut' && cutSources.has(line.sourceId))
				? line.segments.map(
						([start, end]) =>
							[
								worldPoint(start, datumMeters),
								worldPoint(end, datumMeters)
							] as const
					)
				: []
		);
		return [...fillOutlines, ...planLines];
	};
	return {
		subject: { polygons: polygonsFor(subjectIds), segments: segmentsFor(subjectIds) },
		// Affected geometry is context for the edit, not another filled candidate.
		affected: { polygons: [], segments: segmentsFor(affectedIds) }
	};
}

/**
 * One dashed line per changed Wall: the candidate's centerlines, nothing else.
 *
 * A Wall edit proposal reads as the same single line the creator drew, not as
 * the thickness outline of the band (review pass 2 §2). Thickness, junctions
 * and validation still come from the planner's document; only the drawing is
 * thinned. Curved Walls are sampled through the one curve evaluator.
 */
export function wallCenterlinePaper(
	document: LayoutDocumentWallFirst,
	wallIds: ReadonlySet<string>,
	datumMeters: number
): CandidatePaperGeometry {
	const junctions = new Map(document.junctions.map((junction) => [junction.id, junction.point]));
	const segments: [Vec3, Vec3][] = [];
	for (const wall of document.walls) {
		if (!wallIds.has(wall.id)) continue;
		const start = junctions.get(wall.startJunctionId);
		const end = junctions.get(wall.endJunctionId);
		if (start === undefined || end === undefined) continue;
		const sampled = wall.centerline.kind === 'line' ? undefined : wallCenterlineSamples(wall, start, end, 'forward');
		const points = sampled === undefined ? [start, end] : sampled.samples.map((sample) => sample.point);
		for (let index = 1; index < points.length; index += 1) {
			segments.push([worldPoint(points[index - 1]!, datumMeters), worldPoint(points[index]!, datumMeters)]);
		}
	}
	return { polygons: [], segments };
}

/**
 * The Wall's sheet at a candidate height: its centerline at the base, the
 * same line lifted to the top, and the two end verticals, all dashed. Plan
 * cannot show a height, so this is the ghost a height drag reads in 3D.
 */
export function wallHeightGhostPaper(
	document: LayoutDocumentWallFirst,
	wallId: string,
	datumMeters: number,
	heightMeters: number
): CandidatePaperGeometry {
	const base = wallCenterlinePaper(document, new Set([wallId]), datumMeters).segments;
	if (base.length === 0) return { polygons: [], segments: [] };
	const top = datumMeters + heightMeters;
	const lift = (point: Vec3): Vec3 => [point[0], top, point[2]];
	const first = base[0]![0];
	const last = base[base.length - 1]![1];
	return {
		polygons: [],
		segments: [
			...base,
			...base.map(([start, end]) => [lift(start), lift(end)] as [Vec3, Vec3]),
			[first, lift(first)],
			[last, lift(last)]
		]
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
	readonly drawing?: boolean;
	readonly geometry: CandidatePaperGeometry;
	readonly labels?: readonly { readonly world: Vec3; readonly text: string }[];
	readonly snap?: { readonly world: Vec3; readonly name: string };
}): StageCandidatePreview {
	return {
		id: input.id,
		role: input.role,
		drawing: input.drawing,
		polygons: input.geometry.polygons,
		segments: input.geometry.segments,
		labels: input.labels ?? [],
		...(input.snap === undefined ? {} : { snap: input.snap })
	};
}

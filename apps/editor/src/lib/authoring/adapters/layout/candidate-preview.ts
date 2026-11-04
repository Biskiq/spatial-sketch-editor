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
	buildArchProfile,
	type LayoutDocumentWallFirst,
	type LayoutWallOpening,
	type CompiledPhysicalWall,
	type LayoutVec2,
	type PlanEvaluation,
	wallCenterlineSamples
} from '@portfolio/layout-core';

import { buildPaperPlan, unionOutline } from '$lib/authoring/stage/paper-plan';
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

type OpeningGhostValues = Pick<LayoutWallOpening, 'kind' | 'profile' | 'offset' | 'width' | 'height' | 'sillHeight'>;

function wallPointAtDistance(
	wall: CompiledPhysicalWall,
	distance: number
): { readonly point: LayoutVec2; readonly tangent: LayoutVec2 } | null {
	const samples = wall.samples;
	if (samples.length === 0) return null;
	if (distance <= samples[0]!.distance) {
		const sample = samples[0]!;
		return {
			point: [sample.point[0] + sample.tangent[0] * (distance - sample.distance), sample.point[1] + sample.tangent[1] * (distance - sample.distance)],
			tangent: sample.tangent
		};
	}
	for (let index = 1; index < samples.length; index += 1) {
		const before = samples[index - 1]!;
		const after = samples[index]!;
		if (distance > after.distance) continue;
		const span = after.distance - before.distance;
		const amount = span > 0 ? (distance - before.distance) / span : 0;
		const tangent: LayoutVec2 = [
			before.tangent[0] + (after.tangent[0] - before.tangent[0]) * amount,
			before.tangent[1] + (after.tangent[1] - before.tangent[1]) * amount
		];
		const magnitude = Math.hypot(tangent[0], tangent[1]) || 1;
		return {
			point: [before.point[0] + (after.point[0] - before.point[0]) * amount, before.point[1] + (after.point[1] - before.point[1]) * amount],
			tangent: [tangent[0] / magnitude, tangent[1] / magnitude]
		};
	}
	const sample = samples.at(-1)!;
	return {
		point: [sample.point[0] + sample.tangent[0] * (distance - sample.distance), sample.point[1] + sample.tangent[1] * (distance - sample.distance)],
		tangent: sample.tangent
	};
}

function openingFaceOutline(
	wall: CompiledPhysicalWall,
	values: OpeningGhostValues,
	datumMeters: number,
	topBoundary: readonly LayoutVec2[]
): CandidatePaperGeometry {
	const localOutline: LayoutVec2[] = [[0, 0], [values.width, 0], ...[...topBoundary].reverse()];
	const segments: [Vec3, Vec3][] = [];
	for (const side of [-1, 1]) {
		const points = localOutline.map(([x, y]) => {
			const location = wallPointAtDistance(wall, values.offset + x);
			if (location === null) return null;
			const normal: LayoutVec2 = [-location.tangent[1], location.tangent[0]];
			return [
				location.point[0] + normal[0] * wall.thickness * side / 2,
				datumMeters + values.sillHeight + y,
				location.point[1] + normal[1] * wall.thickness * side / 2
			] as Vec3;
		});
		if (points.some((point) => point === null)) continue;
		const face = points as Vec3[];
		for (let index = 0; index < face.length; index += 1) {
			segments.push([face[index]!, face[(index + 1) % face.length]!]);
		}
	}
	return { polygons: [], segments };
}

/** The candidate's compiled profile outline on both Wall faces in the 3D reading. */
export function openingFacePaper(
	document: LayoutDocumentWallFirst,
	openingIds: ReadonlySet<string>,
	datumMeters: number
): CandidatePaperGeometry {
	const compiled = compileWallFirstLayoutGeometry(document).geometry;
	const segments: CandidatePaperGeometry['segments'][number][] = [];
	for (const wall of compiled.walls) {
		for (const opening of wall.openings) {
			if (!openingIds.has(opening.openingId)) continue;
			const values: OpeningGhostValues = {
				kind: opening.kind,
				profile: opening.profile,
				offset: opening.offset,
				width: opening.width,
				height: opening.height,
				sillHeight: opening.sillHeight
			};
			const boundary = opening.profileShape?.topBoundary ?? [[0, opening.height], [opening.width, opening.height]] as LayoutVec2[];
			segments.push(...openingFaceOutline(wall, values, datumMeters, boundary).segments);
		}
	}
	return { polygons: [], segments };
}

/** A rejected placement stays at the raw typed/pointer dimensions and is never clamped. */
export function openingAttemptFacePaper(
	document: LayoutDocumentWallFirst,
	wallId: string,
	values: OpeningGhostValues,
	datumMeters: number
): CandidatePaperGeometry {
	const wall = compileWallFirstLayoutGeometry(document).geometry.walls.find((candidate) => candidate.wallId === wallId);
	if (wall === undefined) return { polygons: [], segments: [] };
	const profile = values.profile === 'rectangular'
		? { topBoundary: [[0, values.height], [values.width, values.height]] as LayoutVec2[] }
		: buildArchProfile(values.profile, values.width, values.height).profile;
	const envelope = [[0, values.height], [values.width, values.height]] as LayoutVec2[];
	const ghost = openingFaceOutline(wall, values, datumMeters, profile?.topBoundary ?? envelope);
	return ghost.segments.length > 0 ? ghost : { polygons: [], segments: [] };
}

/** The rejected Plan attempt's wall-local symbol, built from its exact raw dimensions. */
export function openingAttemptPlanPaper(
	document: LayoutDocumentWallFirst,
	wallId: string,
	values: OpeningGhostValues,
	datumMeters: number
): CandidatePaperGeometry {
	const wall = compileWallFirstLayoutGeometry(document).geometry.walls.find((candidate) => candidate.wallId === wallId);
	if (wall === undefined) return { polygons: [], segments: [] };
	if (values.kind === 'window') {
		const segments: [Vec3, Vec3][] = [];
		const start = wallPointAtDistance(wall, values.offset);
		const end = wallPointAtDistance(wall, values.offset + values.width);
		if (start !== null && end !== null) {
			for (const location of [start, end]) {
				const normal: LayoutVec2 = [-location.tangent[1], location.tangent[0]];
				segments.push([
					[location.point[0] - normal[0] * wall.thickness / 2, datumMeters, location.point[1] - normal[1] * wall.thickness / 2],
					[location.point[0] + normal[0] * wall.thickness / 2, datumMeters, location.point[1] + normal[1] * wall.thickness / 2]
				]);
			}
		}
		for (const side of [-1, 1]) {
			const points: Vec3[] = [];
			for (let index = 0; index <= 6; index += 1) {
				const location = wallPointAtDistance(wall, values.offset + values.width * index / 6);
				if (location === null) continue;
				const normal: LayoutVec2 = [-location.tangent[1], location.tangent[0]];
				points.push([location.point[0] + normal[0] * wall.thickness * side * 0.2, datumMeters, location.point[1] + normal[1] * wall.thickness * side * 0.2]);
			}
			for (let index = 1; index < points.length; index += 1) segments.push([points[index - 1]!, points[index]!]);
		}
		return { polygons: [], segments };
	}
	const start = wallPointAtDistance(wall, values.offset);
	const end = wallPointAtDistance(wall, values.offset + values.width);
	const center = wallPointAtDistance(wall, values.offset + values.width / 2);
	if (start === null || end === null || center === null) return { polygons: [], segments: [] };
	const tangent = center.tangent;
	const normal: LayoutVec2 = [-tangent[1], tangent[0]];
	const arc: Vec3[] = [];
	for (let index = 0; index <= 18; index += 1) {
		const angle = index / 18 * Math.PI / 2;
		arc.push([
			start.point[0] + tangent[0] * values.width * Math.cos(angle) + normal[0] * values.width * Math.sin(angle),
			datumMeters,
			start.point[1] + tangent[1] * values.width * Math.cos(angle) + normal[1] * values.width * Math.sin(angle)
		]);
	}
	const hinge: Vec3 = [start.point[0], datumMeters, start.point[1]];
	const leafEnd: Vec3 = [start.point[0] + tangent[0] * values.width, datumMeters, start.point[1] + tangent[1] * values.width];
	const startNormal: LayoutVec2 = [-start.tangent[1], start.tangent[0]];
	const endNormal: LayoutVec2 = [-end.tangent[1], end.tangent[0]];
	const jambs: [Vec3, Vec3][] = [
		[
			[start.point[0] - startNormal[0] * wall.thickness / 2, datumMeters, start.point[1] - startNormal[1] * wall.thickness / 2],
			[start.point[0] + startNormal[0] * wall.thickness / 2, datumMeters, start.point[1] + startNormal[1] * wall.thickness / 2]
		],
		[
			[end.point[0] - endNormal[0] * wall.thickness / 2, datumMeters, end.point[1] - endNormal[1] * wall.thickness / 2],
			[end.point[0] + endNormal[0] * wall.thickness / 2, datumMeters, end.point[1] + endNormal[1] * wall.thickness / 2]
		]
	];
	return { polygons: [], segments: [...jambs, ...arc.slice(1).map((point, index) => [arc[index]!, point] as const), [hinge, leafEnd]] };
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
		const sampled = wallCenterlineSamples(wall, start, end, 'forward');
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

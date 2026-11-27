import type { LayoutVec2 } from '../../geometry/coordinates';
import { activeLayoutCompileSession } from '../../geometry/session';
import { compileWallFirstLayoutGeometry } from '../../geometry/compiler';
import { MAX_LAYOUT_DIMENSION_METERS } from '../../geometry/limits';
import type { CompiledLayoutGeometry, CompiledPhysicalWall } from '../../geometry/types';
import { hasBlockingLayoutIssues } from '../../geometry/validation';
import { validateWallFirstOpeningSet } from '../../wall/opening-set';
import { WALL_TOP_PROFILE_UNSUPPORTED_CODE } from '../../wall/wall-top';
import {
	REGION_WALL_RELATION_EPSILON,
	regionWallCoveredTopRangeY,
	regionWallPlanClass,
	regionWallRelations,
} from '../region-relations';
import { MAX_LAYOUT_REGION_POINTS } from '../region-validation';
import { validateWallFirstLayoutDocument } from '../../wall/codec';
import type { LayoutDocumentWallFirst } from '../../wall/types';
import type { RegionPlan } from './contracts';
import {
	centerlineWithinFootprint,
	copyPoints,
	finalizeRegionCandidate,
	findRegion,
	reject,
	samePoints,
	segmentDistance,
	translatePoints,
} from './shared';

/**
 * Both fits read the roof as one level underside. A shed or gable needs the
 * certified Wall-strip extrema of §7.3, which arrive with V3b; until then a
 * sloped roof refuses the whole fit and writes nothing, like a profiled Wall top.
 */
export const REGION_FORM_FIT_UNSUPPORTED_CODE = 'region_form_fit_unsupported';

function slopedFormRefusal(
	region: { readonly id: string; readonly form: { readonly kind: string } },
	verb: string,
): RegionPlan | null {
	if (region.form.kind === 'flat') return null;
	return reject(
		REGION_FORM_FIT_UNSUPPORTED_CODE,
		`${verb} cannot follow a ${region.form.kind} roof yet. Make the roof flat to fit it, or set the heights directly.`,
		[region.id],
	);
}

/**
 * Fit to space: the footprint becomes the compiled Space's centerline outline.
 * A curved Space contributes the compiler's own samples; the point cap still
 * governs how many vertices a region can store.
 */
export function planFitRegionToSpace(
	document: LayoutDocumentWallFirst,
	compiled: CompiledLayoutGeometry,
	regionId: string,
	roomId: string,
): RegionPlan {
	const region = findRegion(document, regionId);
	if (region === undefined)
		return reject('unknown_region', `Unknown region '${regionId}'`, [regionId]);
	const room = compiled.rooms.find((candidate) => candidate.roomId === roomId);
	if (room === undefined) return reject('unknown_room', `Unknown room '${roomId}'`, [roomId]);
	const outline = room.floorPolygon;
	if (outline.length < 3) {
		return reject('invalid_room_outline', `Room '${roomId}' has no usable compiled outline`, [
			roomId,
		]);
	}
	if (outline.length > MAX_LAYOUT_REGION_POINTS) {
		return reject(
			'region_point_count',
			`Room '${roomId}' outline has ${outline.length} points; a region stores at most ${MAX_LAYOUT_REGION_POINTS}`,
			[roomId, regionId],
		);
	}
	if (samePoints(region.footprint.points, outline)) {
		return reject('no_op', `Region '${regionId}' already matches Room '${roomId}'`, [regionId]);
	}
	return finalizeRegionCandidate(
		{
			...document,
			regions: document.regions.map((entry) =>
				entry.id === regionId
					? { ...entry, footprint: { kind: 'polygon', points: copyPoints(outline) } }
					: entry,
			),
		},
		'region-fit-space',
		regionId,
	);
}

/**
 * Meet wall: translate a horizontally gapped footprint's nearest edge onto the
 * near offset face of one straight Wall. A horizontal gap that is not parallel,
 * a curved Wall, or a gap that is not horizontal is refused with words.
 */
export function planFitRegionEdgeToWall(
	document: LayoutDocumentWallFirst,
	compiled: CompiledLayoutGeometry,
	regionId: string,
	wallId: string,
): RegionPlan {
	const region = findRegion(document, regionId);
	if (region === undefined)
		return reject('unknown_region', `Unknown region '${regionId}'`, [regionId]);
	const authoredWall = document.walls.find((wall) => wall.id === wallId);
	if (authoredWall === undefined)
		return reject('unknown_wall', `Unknown wall '${wallId}'`, [wallId]);
	if (authoredWall.centerline.kind !== 'line') {
		return reject(
			'curved_wall_unsupported',
			`Wall '${wallId}' is curved; Meet wall needs a straight Wall`,
			[wallId],
		);
	}
	const wall = compiled.walls.find((candidate) => candidate.wallId === wallId);
	if (wall === undefined || wall.samples.length < 2) {
		return reject('unknown_wall', `Wall '${wallId}' is not part of this compiled Layout`, [wallId]);
	}
	const relations = regionWallRelations(compiled, region);
	if (relations.kind === 'unavailable') {
		return reject('invalid_candidate_document', relations.message, [regionId]);
	}
	const relation = relations.relations.find((entry) => entry.wallId === wallId);
	if (
		relation === undefined ||
		relation.reading !== 'gap' ||
		relation.measureAxis !== 'horizontal'
	) {
		return reject(
			'no_horizontal_gap',
			`Wall '${wallId}' has no horizontal gap to region '${regionId}'`,
			[regionId, wallId],
		);
	}
	const nearest = nearestFootprintEdge(region.footprint.points, wall);
	if (nearest === null)
		return reject('invalid_value', 'This region footprint has no usable edge', [regionId]);
	const first = wall.samples[0]!;
	const last = wall.samples.at(-1)!;
	const wallLength = Math.hypot(last.point[0] - first.point[0], last.point[1] - first.point[1]);
	if (!(wallLength > 0))
		return reject('invalid_value', `Wall '${wallId}' has no usable direction`, [wallId]);
	const wallDirection: LayoutVec2 = [
		(last.point[0] - first.point[0]) / wallLength,
		(last.point[1] - first.point[1]) / wallLength,
	];
	const [edgeStart, edgeEnd] = nearest.edge;
	const edgeLength = Math.hypot(edgeEnd[0] - edgeStart[0], edgeEnd[1] - edgeStart[1]);
	if (!(edgeLength > 0))
		return reject('invalid_value', 'The nearest footprint edge is degenerate', [regionId]);
	const edgeDirection: LayoutVec2 = [
		(edgeEnd[0] - edgeStart[0]) / edgeLength,
		(edgeEnd[1] - edgeStart[1]) / edgeLength,
	];
	const parallel = Math.abs(
		wallDirection[0] * edgeDirection[1] - wallDirection[1] * edgeDirection[0],
	);
	if (parallel > 1e-6) {
		return reject(
			'edge_not_parallel',
			`The nearest edge of region '${regionId}' is not parallel to Wall '${wallId}'`,
			[regionId, wallId],
		);
	}
	const normal: LayoutVec2 = [-wallDirection[1], wallDirection[0]];
	const edgeMid: LayoutVec2 = [(edgeStart[0] + edgeEnd[0]) / 2, (edgeStart[1] + edgeEnd[1]) / 2];
	const signed =
		(edgeMid[0] - first.point[0]) * normal[0] + (edgeMid[1] - first.point[1]) * normal[1];
	const half = wall.thickness / 2;
	let translation: LayoutVec2;
	if (signed > half + REGION_WALL_RELATION_EPSILON) {
		translation = [-normal[0] * (signed - half), -normal[1] * (signed - half)];
	} else if (signed < -half - REGION_WALL_RELATION_EPSILON) {
		translation = [normal[0] * (-signed - half), normal[1] * (-signed - half)];
	} else {
		return reject('no_horizontal_gap', `Wall '${wallId}' already touches region '${regionId}'`, [
			regionId,
			wallId,
		]);
	}
	const translatedStart: LayoutVec2 = [
		edgeStart[0] + translation[0],
		edgeStart[1] + translation[1],
	];
	const translatedEnd: LayoutVec2 = [edgeEnd[0] + translation[0], edgeEnd[1] + translation[1]];
	const stationAt = (point: LayoutVec2): number =>
		first.distance +
		(point[0] - first.point[0]) * wallDirection[0] +
		(point[1] - first.point[1]) * wallDirection[1];
	const stationA = stationAt(translatedStart);
	const stationB = stationAt(translatedEnd);
	const wallFirstStation = Math.min(first.distance, last.distance);
	const wallLastStation = Math.max(first.distance, last.distance);
	const contact =
		Math.min(Math.max(stationA, stationB), wallLastStation) -
		Math.max(Math.min(stationA, stationB), wallFirstStation);
	if (contact <= REGION_WALL_RELATION_EPSILON) {
		return reject(
			'no_wall_contact',
			`Wall '${wallId}' ends before region '${regionId}' can reach it, so Meet wall would leave a gap`,
			[regionId, wallId],
		);
	}
	return finalizeRegionCandidate(
		{
			...document,
			regions: document.regions.map((entry) =>
				entry.id === regionId
					? {
							...entry,
							footprint: {
								kind: 'polygon',
								points: translatePoints(entry.footprint.points, translation),
							},
						}
					: entry,
			),
		},
		'region-fit-edge',
		regionId,
	);
}

type EdgeCandidate = {
	index: number;
	edge: readonly [LayoutVec2, LayoutVec2];
	distance: number;
};

/** The footprint edge nearest to the Wall body strip, ties by document order. */
function nearestFootprintEdge(
	footprint: readonly LayoutVec2[],
	wall: Pick<CompiledPhysicalWall, 'samples' | 'thickness' | 'startJunctionId' | 'endJunctionId'>,
): EdgeCandidate | null {
	if (footprint.length < 3 || wall.samples.length < 2) return null;
	const half = wall.thickness / 2;
	const centerline = wall.samples.map((sample): LayoutVec2 => sample.point);
	let best: EdgeCandidate | null = null;
	for (let index = 0; index < footprint.length; index++) {
		const start = footprint[index]!;
		const end = footprint[(index + 1) % footprint.length]!;
		let minimum = Infinity;
		for (let station = 0; station + 1 < centerline.length; station++) {
			minimum = Math.min(
				minimum,
				segmentDistance(start, end, centerline[station]!, centerline[station + 1]!),
			);
		}
		const distance = Math.max(0, minimum - half);
		if (best === null || distance < best.distance) {
			best = { index, edge: [start, end], distance };
		}
	}
	return best;
}

/**
 * Fit roof to walls: move one overhead region vertically to first contact with
 * the highest chosen Wall top. Only chosen Walls whose compiled body touches or
 * overlaps the footprint take part; the rest are reported as skipped.
 */
export function planFitRegionToWalls(
	document: LayoutDocumentWallFirst,
	compiled: CompiledLayoutGeometry,
	regionId: string,
	wallIds: readonly string[],
): RegionPlan {
	const region = findRegion(document, regionId);
	if (region === undefined)
		return reject('unknown_region', `Unknown region '${regionId}'`, [regionId]);
	if (region.role !== 'overhead') {
		return reject('region_role_not_overhead', 'Fit roof to walls applies to an overhead region', [
			regionId,
		]);
	}
	const roofSloped = slopedFormRefusal(region, 'Fit roof to walls');
	if (roofSloped !== null) return roofSloped;
	const floor = compiled.floors[0];
	const compiledRegion = compiled.regions.find((candidate) => candidate.regionId === regionId);
	if (floor === undefined || compiledRegion === undefined) {
		return reject(
			'invalid_candidate_document',
			`Region '${regionId}' is not part of this compiled Layout`,
			[regionId],
		);
	}
	const chosen = [...new Set(wallIds)];
	if (chosen.length === 0)
		return reject('invalid_value', 'Choose at least one Wall to fit to', [regionId]);
	for (const wallId of chosen) {
		if (!document.walls.some((wall) => wall.id === wallId)) {
			return reject('unknown_wall', `Unknown wall '${wallId}'`, [wallId]);
		}
	}
	const qualifying: CompiledPhysicalWall[] = [];
	const skippedWallIds: string[] = [];
	for (const wall of compiled.walls) {
		if (!chosen.includes(wall.wallId)) continue;
		const plan = regionWallPlanClass(compiledRegion.footprint, wall);
		if (plan.planClass === 'through' || plan.planClass === 'edge') qualifying.push(wall);
		else skippedWallIds.push(wall.wallId);
	}
	if (qualifying.length === 0) {
		return reject('no_covered_walls', `No chosen Wall touches or overlaps region '${regionId}'`, [
			regionId,
			...skippedWallIds,
		]);
	}
	let highest = -Infinity;
	for (const wall of qualifying) {
		const plan = regionWallPlanClass(compiledRegion.footprint, wall);
		highest = Math.max(
			highest,
			regionWallCoveredTopRangeY(compiledRegion.footprint, wall, plan.planClass, floor.elevation)
				.maxY,
		);
	}
	const elevation = highest - floor.elevation;
	if (
		!Number.isFinite(elevation) ||
		Math.abs(elevation) > MAX_LAYOUT_DIMENSION_METERS ||
		!(elevation > 0)
	) {
		return reject(
			'invalid_value',
			`Fitting region '${regionId}' would put its underside outside the Layout envelope`,
			[regionId],
		);
	}
	if (Math.abs(region.elevation - elevation) <= REGION_WALL_RELATION_EPSILON) {
		return reject('no_op', `Region '${regionId}' already touches the highest chosen Wall`, [
			regionId,
		]);
	}
	return finalizeRegionCandidate(
		{
			...document,
			regions: document.regions.map((entry) =>
				entry.id === regionId ? { ...entry, elevation } : entry,
			),
		},
		'region-fit-roof',
		regionId,
		{ fittedWallIds: qualifying.map((wall) => wall.wallId), skippedWallIds },
	);
}

/**
 * Fit walls to roof: set each eligible chosen Wall's height to the overhead
 * region's underside. A Wall qualifies only when its entire compiled centerline
 * lies inside or on the footprint; partly covered Walls are listed as skipped.
 * All heights and Opening gates are validated together before one acceptance.
 */
export function planFitWallsToRegion(
	document: LayoutDocumentWallFirst,
	compiled: CompiledLayoutGeometry,
	regionId: string,
	wallIds: readonly string[],
): RegionPlan {
	const region = findRegion(document, regionId);
	if (region === undefined)
		return reject('unknown_region', `Unknown region '${regionId}'`, [regionId]);
	if (region.role !== 'overhead') {
		return reject('region_role_not_overhead', 'Fit walls to roof applies to an overhead region', [
			regionId,
		]);
	}
	const wallsSloped = slopedFormRefusal(region, 'Fit walls to roof');
	if (wallsSloped !== null) return wallsSloped;
	const floor = compiled.floors[0];
	const compiledRegion = compiled.regions.find((candidate) => candidate.regionId === regionId);
	if (floor === undefined || compiledRegion === undefined) {
		return reject(
			'invalid_candidate_document',
			`Region '${regionId}' is not part of this compiled Layout`,
			[regionId],
		);
	}
	const chosen = [...new Set(wallIds)];
	if (chosen.length === 0)
		return reject('invalid_value', 'Choose at least one Wall to fit', [regionId]);
	for (const wallId of chosen) {
		if (!document.walls.some((wall) => wall.id === wallId)) {
			return reject('unknown_wall', `Unknown wall '${wallId}'`, [wallId]);
		}
	}
	const targetHeight = compiledRegion.bottomY - floor.elevation;
	if (!Number.isFinite(targetHeight) || targetHeight <= 0) {
		return reject(
			'invalid_value',
			`Region '${regionId}' underside sits at or below the Floor datum, so no Wall can reach it`,
			[regionId],
		);
	}
	if (targetHeight > MAX_LAYOUT_DIMENSION_METERS) {
		return reject('invalid_value', 'Fitted Wall height exceeds the 1000 m Layout envelope', [
			regionId,
		]);
	}
	const eligible: CompiledPhysicalWall[] = [];
	const skippedWallIds: string[] = [];
	for (const wall of compiled.walls) {
		if (!chosen.includes(wall.wallId)) continue;
		if (
			wall.samples.length >= 2 &&
			centerlineWithinFootprint(compiledRegion.footprint, wall.samples)
		) {
			eligible.push(wall);
		} else {
			skippedWallIds.push(wall.wallId);
		}
	}
	if (eligible.length === 0) {
		return reject('no_eligible_walls', `No chosen Wall lies entirely under region '${regionId}'`, [
			regionId,
			...skippedWallIds,
		]);
	}
	// Fitting sets `height` to the roof underside. A sloped or gabled Wall's peak
	// would then rise above the region, and the fit that keeps every point of its
	// top under the roof arrives with V3; refuse whole, naming each such Wall.
	const profiled = eligible.filter((wall) => wall.topProfile !== undefined);
	if (profiled.length > 0) {
		const names = profiled.map((wall) => `'${wall.wallId}'`).join(', ');
		return reject(
			WALL_TOP_PROFILE_UNSUPPORTED_CODE,
			`Wall${profiled.length > 1 ? 's' : ''} ${names} ${profiled.length > 1 ? 'have' : 'has'} a sloped or gabled top, so fitting to region '${regionId}' would push its peak through the roof. Make the top level first.`,
			[regionId, ...profiled.map((wall) => wall.wallId)],
		);
	}
	const changes = eligible.filter((wall) => Math.abs(wall.height - targetHeight) > 1e-12);
	if (changes.length === 0) {
		return reject('no_op', `Chosen Walls already meet region '${regionId}'`, [regionId]);
	}
	const heights = new Map(changes.map((wall) => [wall.wallId, targetHeight]));
	const candidate: LayoutDocumentWallFirst = {
		...document,
		walls: document.walls.map((wall) =>
			heights.has(wall.id) ? { ...wall, height: targetHeight } : wall,
		),
	};
	const structural = validateWallFirstLayoutDocument(candidate);
	if (!structural.success) {
		const first = structural.issues[0]!;
		return reject('invalid_candidate_document', first.message, [regionId], structural.issues);
	}
	const openingIssues = validateWallFirstOpeningSet(structural.document);
	if (openingIssues.length > 0) {
		const first = openingIssues[0]!;
		return reject(
			'opening_set_invalid',
			first.message,
			[first.openingId, first.wallId],
			openingIssues,
		);
	}
	const session = activeLayoutCompileSession();
	const accepted = session
		? session.compile(structural.document)
		: compileWallFirstLayoutGeometry(structural.document);
	if (hasBlockingLayoutIssues(accepted.issues)) {
		const first = accepted.issues[0]!;
		return reject(
			'candidate_does_not_compile',
			first.message,
			first.targetId === undefined ? [regionId] : [first.targetId],
			accepted.issues,
		);
	}
	return {
		kind: 'success',
		document: structural.document,
		operation: 'region-fit-walls',
		regionId,
		changedWallIds: changes.map((wall) => wall.wallId),
		fittedWallIds: eligible.map((wall) => wall.wallId),
		skippedWallIds,
	};
}

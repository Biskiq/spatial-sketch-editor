/**
 * `layout-region.ts` — region admission lineage and the region planner family.
 *
 * The planners in this file implement §5.3 and the one-shot fits of §5.5. Each
 * returns exactly one validated candidate document or one typed refusal; none
 * touches Room reconciliation, Scene, Camera or Experience. Geometry-neutral
 * edits keep every region id, document order and flag.
 *
 * Admission is shared with the canonical reader: `layout-region-validation.ts`
 * owns G1/G5 and the codec imports it directly, so Save and these planners cannot
 * disagree about a footprint. Planner-only gates (Opening fit, compiled
 * acceptance) sit on top of that shared predicate.
 */
import type { LayoutVec2 } from './layout-coordinates';
import { pointStrictlyInsidePolygon } from './layout-face-extraction';
import { activeLayoutCompileSession, compileWallFirstLayoutGeometry } from './layout-geometry';
import { MAX_LAYOUT_DIMENSION_METERS } from './layout-geometry-limits';
import { LAYOUT_GEOMETRY_EPSILON } from './layout-geometry-openings';
import type {
	CompiledLayoutGeometry,
	CompiledPhysicalWall,
	CompiledRegion,
	LayoutGeometryIssue
} from './layout-geometry-types';
import { hasBlockingLayoutIssues } from './layout-geometry-validation';
import {
	allocateCapturedId,
	isLayoutIdCapture,
	LayoutIdCollisionError,
	type LayoutIdCapture
} from './layout-id-capture';
import type { LayoutDocumentIssue } from './layout-issue';
import { validateWallFirstOpeningSet } from './layout-opening-set';
import {
	regionWallPlanClass,
	REGION_WALL_RELATION_EPSILON,
	regionWallRelations,
	regionWallTopRangeY
} from './layout-region-relations';
import { MAX_LAYOUT_REGION_POINTS } from './layout-region-validation';
import { validateWallFirstLayoutDocument } from './layout-wall-first-codec';
import type { LayoutDocumentWallFirst, LayoutRegion } from './layout-wall-first-types';

export * from './layout-region-validation';

export type RegionPlannerOperation =
	| 'region-create'
	| 'region-move'
	| 'region-rotate'
	| 'region-footprint'
	| 'region-elevation'
	| 'region-thickness'
	| 'region-intended-gap'
	| 'region-rename'
	| 'region-remove'
	| 'region-duplicate'
	| 'region-fit-space'
	| 'region-fit-edge'
	| 'region-fit-walls'
	| 'region-fit-roof';

export type RegionPlannerRejectionCode =
	| 'unknown_region'
	| 'unknown_wall'
	| 'unknown_room'
	| 'invalid_capture'
	| 'invalid_value'
	| 'no_op'
	| 'curved_wall_unsupported'
	| 'no_horizontal_gap'
	| 'edge_not_parallel'
	| 'no_gap_to_mark'
	| 'region_role_not_overhead'
	| 'no_covered_walls'
	| 'no_eligible_walls'
	| 'invalid_room_outline'
	| 'invalid_candidate_document'
	| 'opening_set_invalid'
	| 'candidate_does_not_compile'
	| 'captured_id_in_use'
	| (string & {});

export type RegionPlannerRejection = {
	code: RegionPlannerRejectionCode;
	message: string;
	targetIds?: readonly string[];
	issues?: readonly (LayoutDocumentIssue | LayoutGeometryIssue)[];
};

export type RegionPlan =
	| {
			kind: 'success';
			document: LayoutDocumentWallFirst;
			operation: RegionPlannerOperation;
			/** The region this planner addressed (the new id for create/duplicate). */
			regionId: string;
			createdRegionId?: string;
			changedWallIds?: readonly string[];
			/** Chosen Walls a fit used as its subject. */
			fittedWallIds?: readonly string[];
			/** Chosen Walls a fit left alone because they are only partly covered. */
			skippedWallIds?: readonly string[];
	  }
	| { kind: 'rejected'; rejection: RegionPlannerRejection };

function reject(
	code: RegionPlannerRejectionCode,
	message: string,
	targetIds?: readonly string[],
	issues?: readonly (LayoutDocumentIssue | LayoutGeometryIssue)[]
): RegionPlan {
	return {
		kind: 'rejected',
		rejection: { code, message, ...(targetIds ? { targetIds } : {}), ...(issues ? { issues } : {}) }
	};
}

function layoutIds(document: LayoutDocumentWallFirst): Set<string> {
	const ids = new Set<string>([document.floor.id]);
	for (const collection of [
		document.junctions,
		document.walls,
		document.rooms,
		document.openings,
		document.objects,
		document.regions
	]) {
		for (const entry of collection as readonly { id: string }[]) ids.add(entry.id);
	}
	return ids;
}

function findRegion(document: LayoutDocumentWallFirst, regionId: string): LayoutRegion | undefined {
	return document.regions.find((region) => region.id === regionId);
}

function finalizeRegionCandidate(
	candidate: LayoutDocumentWallFirst,
	operation: RegionPlannerOperation,
	regionId: string,
	extra: Pick<
		RegionPlan & { kind: 'success' },
		'createdRegionId' | 'changedWallIds' | 'fittedWallIds' | 'skippedWallIds'
	> = {}
): RegionPlan {
	const structural = validateWallFirstLayoutDocument(candidate);
	if (!structural.success) {
		const first = structural.issues[0]!;
		return reject(first.code, first.message, [regionId], structural.issues);
	}
	return {
		kind: 'success',
		document: structural.document,
		operation,
		regionId,
		...extra
	};
}

function finitePoint(point: LayoutVec2): boolean {
	return Number.isFinite(point[0]) && Number.isFinite(point[1]);
}

function copyPoints(points: readonly LayoutVec2[]): LayoutVec2[] {
	return points.map(([x, z]): LayoutVec2 => [x, z]);
}

function samePoints(left: readonly LayoutVec2[], right: readonly LayoutVec2[]): boolean {
	return left.length === right.length &&
		left.every(([x, z], index) => x === right[index]![0] && z === right[index]![1]);
}

function translatePoints(points: readonly LayoutVec2[], delta: LayoutVec2): LayoutVec2[] {
	return points.map(([x, z]): LayoutVec2 => [x + delta[0], z + delta[1]]);
}

/** Area centroid of a simple positive-area footprint, or `null` when degenerate. */
function footprintCentroid(points: readonly LayoutVec2[]): LayoutVec2 | null {
	let twiceArea = 0;
	let weightedX = 0;
	let weightedZ = 0;
	for (let index = 0; index < points.length; index++) {
		const [x, z] = points[index]!;
		const [nextX, nextZ] = points[(index + 1) % points.length]!;
		const cross = x * nextZ - nextX * z;
		twiceArea += cross;
		weightedX += (x + nextX) * cross;
		weightedZ += (z + nextZ) * cross;
	}
	if (Math.abs(twiceArea) <= LAYOUT_GEOMETRY_EPSILON) return null;
	return [weightedX / (3 * twiceArea), weightedZ / (3 * twiceArea)];
}

/**
 * Rotate in the document's own X/Z handedness, matching the shipped Room-unit
 * rotation (`rotatePointAbout`): Plan X/Z has +Z down the screen, so this is the
 * direction the creator's turn gesture already turns architecture.
 */
function rotatePoint(point: LayoutVec2, pivot: LayoutVec2, angle: number): LayoutVec2 {
	const cos = Math.cos(angle);
	const sin = Math.sin(angle);
	const x = point[0] - pivot[0];
	const z = point[1] - pivot[1];
	return [pivot[0] + x * cos + z * sin, pivot[1] - x * sin + z * cos];
}

function validFootprintInput(points: unknown): points is readonly LayoutVec2[] {
	return Array.isArray(points) &&
		points.length >= 3 &&
		points.length <= MAX_LAYOUT_REGION_POINTS &&
		points.every((point) => Array.isArray(point) && point.length === 2 && finitePoint(point as LayoutVec2));
}

export type RegionCreateIntent = {
	readonly role: LayoutRegion['role'];
	readonly footprint: readonly LayoutVec2[];
	readonly elevation: number;
	readonly thickness: number;
	readonly name?: string;
};

/**
 * Create one region. The id is derived from the captured nonce, never from
 * occupancy or geometry, so Redo replays the same identity.
 */
export function planCreateRegion(input: {
	baseline: LayoutDocumentWallFirst;
	capture: LayoutIdCapture;
	intent: RegionCreateIntent;
}): RegionPlan {
	const { baseline, capture, intent } = input;
	if (!isLayoutIdCapture(capture)) return reject('invalid_capture', 'The region is missing its identity capture');
	if (intent.role !== 'floor' && intent.role !== 'overhead') {
		return reject('invalid_value', "A region role must be 'floor' or 'overhead'");
	}
	if (!validFootprintInput(intent.footprint)) return reject('invalid_value', 'A region needs 3 to 1024 finite footprint points');
	if (!Number.isFinite(intent.elevation) || Math.abs(intent.elevation) > MAX_LAYOUT_DIMENSION_METERS) {
		return reject('invalid_value', 'Region elevation must be finite and within 1000 m');
	}
	if (intent.role === 'floor' ? intent.elevation < 0 : !(intent.elevation > 0)) {
		return reject('invalid_value', 'Floor elevation must be nonnegative and overhead elevation must be positive');
	}
	if (!Number.isFinite(intent.thickness) || intent.thickness <= 0 || intent.thickness > MAX_LAYOUT_DIMENSION_METERS) {
		return reject('invalid_value', 'Region thickness must be finite, greater than zero and at most 1000 m');
	}
	if (intent.name !== undefined && (typeof intent.name !== 'string' || intent.name.trim().length === 0)) {
		return reject('invalid_value', 'Region name cannot be empty');
	}
	try {
		const id = allocateCapturedId(layoutIds(baseline), 'region', capture);
		const region: LayoutRegion = {
			id,
			role: intent.role,
			footprint: { kind: 'polygon', points: copyPoints(intent.footprint) },
			elevation: intent.elevation,
			thickness: intent.thickness,
			form: { kind: 'flat' },
			intendedGaps: [],
			...(intent.name === undefined ? {} : { name: intent.name.trim() })
		};
		return finalizeRegionCandidate(
			{ ...baseline, regions: [...baseline.regions, region] },
			'region-create',
			id,
			{ createdRegionId: id }
		);
	} catch (error) {
		if (error instanceof LayoutIdCollisionError) return reject('captured_id_in_use', error.message, [error.id]);
		throw error;
	}
}

/** Translate every footprint point by one X/Z delta. */
export function planMoveRegion(
	document: LayoutDocumentWallFirst,
	regionId: string,
	delta: LayoutVec2
): RegionPlan {
	const region = findRegion(document, regionId);
	if (region === undefined) return reject('unknown_region', `Unknown region '${regionId}'`, [regionId]);
	if (!finitePoint(delta)) return reject('invalid_value', 'Region move delta must be finite', [regionId]);
	if (delta[0] === 0 && delta[1] === 0) return reject('no_op', `Region '${regionId}' already has that position`, [regionId]);
	const candidate: LayoutRegion = {
		...region,
		footprint: { kind: 'polygon', points: translatePoints(region.footprint.points, delta) }
	};
	return finalizeRegionCandidate(
		{ ...document, regions: document.regions.map((entry) => (entry.id === regionId ? candidate : entry)) },
		'region-move',
		regionId
	);
}

/** Rotate every footprint point about the footprint's area centroid. */
export function planRotateRegion(
	document: LayoutDocumentWallFirst,
	regionId: string,
	angle: number
): RegionPlan {
	const region = findRegion(document, regionId);
	if (region === undefined) return reject('unknown_region', `Unknown region '${regionId}'`, [regionId]);
	if (!Number.isFinite(angle)) return reject('invalid_value', 'Region rotation angle must be finite', [regionId]);
	if (angle === 0) return reject('no_op', `Region '${regionId}' already has that rotation`, [regionId]);
	const centroid = footprintCentroid(region.footprint.points);
	if (centroid === null) return reject('invalid_value', 'This region footprint has no area centroid', [regionId]);
	const candidate: LayoutRegion = {
		...region,
		footprint: {
			kind: 'polygon',
			points: region.footprint.points.map((point) => rotatePoint(point, centroid, angle))
		}
	};
	return finalizeRegionCandidate(
		{ ...document, regions: document.regions.map((entry) => (entry.id === regionId ? candidate : entry)) },
		'region-rotate',
		regionId
	);
}

/**
 * Replace a footprint. Corner move, corner insert, corner remove and typed size
 * all arrive here; G1 and G5 are the only gates.
 */
export function planSetRegionFootprint(
	document: LayoutDocumentWallFirst,
	regionId: string,
	points: readonly LayoutVec2[]
): RegionPlan {
	const region = findRegion(document, regionId);
	if (region === undefined) return reject('unknown_region', `Unknown region '${regionId}'`, [regionId]);
	if (!validFootprintInput(points)) return reject('invalid_value', 'A region needs 3 to 1024 finite footprint points', [regionId]);
	if (samePoints(region.footprint.points, points)) return reject('no_op', `Region '${regionId}' already has that footprint`, [regionId]);
	const candidate: LayoutRegion = { ...region, footprint: { kind: 'polygon', points: copyPoints(points) } };
	return finalizeRegionCandidate(
		{ ...document, regions: document.regions.map((entry) => (entry.id === regionId ? candidate : entry)) },
		'region-footprint',
		regionId
	);
}

/** Set the Floor-relative datum face of one region. */
export function planSetRegionElevation(
	document: LayoutDocumentWallFirst,
	regionId: string,
	elevation: number
): RegionPlan {
	const region = findRegion(document, regionId);
	if (region === undefined) return reject('unknown_region', `Unknown region '${regionId}'`, [regionId]);
	if (!Number.isFinite(elevation) || Math.abs(elevation) > MAX_LAYOUT_DIMENSION_METERS) {
		return reject('invalid_value', 'Region elevation must be finite and within 1000 m', [regionId]);
	}
	if (region.role === 'floor' ? elevation < 0 : !(elevation > 0)) {
		return reject(
			'invalid_value',
			'Floor elevation must be nonnegative and overhead elevation must be positive',
			[regionId]
		);
	}
	if (region.elevation === elevation) return reject('no_op', `Region '${regionId}' already has that elevation`, [regionId]);
	return finalizeRegionCandidate(
		{
			...document,
			regions: document.regions.map((entry) => (entry.id === regionId ? { ...entry, elevation } : entry))
		},
		'region-elevation',
		regionId
	);
}

/** Set one region's vertical thickness. */
export function planSetRegionThickness(
	document: LayoutDocumentWallFirst,
	regionId: string,
	thickness: number
): RegionPlan {
	const region = findRegion(document, regionId);
	if (region === undefined) return reject('unknown_region', `Unknown region '${regionId}'`, [regionId]);
	if (!Number.isFinite(thickness) || thickness <= 0 || thickness > MAX_LAYOUT_DIMENSION_METERS) {
		return reject('invalid_value', 'Region thickness must be finite, greater than zero and at most 1000 m', [regionId]);
	}
	if (region.thickness === thickness) return reject('no_op', `Region '${regionId}' already has that thickness`, [regionId]);
	return finalizeRegionCandidate(
		{
			...document,
			regions: document.regions.map((entry) => (entry.id === regionId ? { ...entry, thickness } : entry))
		},
		'region-thickness',
		regionId
	);
}

/**
 * Mark or clear the only authored relation fact: that a Wall's gap to this
 * region is intended. Adding a mark requires a current gap; clearing is always
 * allowed so a stale mark can be removed after the geometry moved.
 */
export function planSetRegionIntendedGap(
	document: LayoutDocumentWallFirst,
	compiled: CompiledLayoutGeometry,
	regionId: string,
	wallId: string,
	intended: boolean
): RegionPlan {
	const region = findRegion(document, regionId);
	if (region === undefined) return reject('unknown_region', `Unknown region '${regionId}'`, [regionId]);
	if (!document.walls.some((wall) => wall.id === wallId)) {
		return reject('unknown_wall', `Unknown wall '${wallId}'`, [wallId]);
	}
	const present = region.intendedGaps.includes(wallId);
	if (intended && present) return reject('no_op', `Region '${regionId}' already marks Wall '${wallId}' as intended`, [regionId, wallId]);
	if (!intended && !present) return reject('no_op', `Region '${regionId}' does not mark Wall '${wallId}' as intended`, [regionId, wallId]);
	if (intended) {
		const relations = regionWallRelations(compiled, region);
		if (relations.kind === 'unavailable') {
			return reject('invalid_candidate_document', relations.message, [regionId]);
		}
		const relation = relations.relations.find((entry) => entry.wallId === wallId);
		if (relation === undefined || relation.reading !== 'gap') {
			return reject('no_gap_to_mark', `Wall '${wallId}' has no gap to region '${regionId}'`, [regionId, wallId]);
		}
	}
	const intendedGaps = intended
		? [...region.intendedGaps, wallId].sort()
		: region.intendedGaps.filter((id) => id !== wallId);
	return finalizeRegionCandidate(
		{
			...document,
			regions: document.regions.map((entry) =>
				entry.id === regionId ? { ...entry, intendedGaps } : entry
			)
		},
		'region-intended-gap',
		regionId
	);
}

/**
 * Set, change or clear a region's optional name. `null` clears; the key absent
 * changes nothing; a blank string is never a name.
 */
export function planRenameRegion(
	document: LayoutDocumentWallFirst,
	regionId: string,
	patch: { readonly name?: string | null }
): RegionPlan {
	const region = findRegion(document, regionId);
	if (region === undefined) return reject('unknown_region', `Unknown region '${regionId}'`, [regionId]);
	if (!('name' in patch)) return reject('no_op', `Region '${regionId}' has no name change`, [regionId]);
	const value = patch.name;
	if (value === null) {
		if (region.name === undefined) return reject('no_op', `Region '${regionId}' is already unnamed`, [regionId]);
		const candidate: LayoutRegion = { ...region };
		delete candidate.name;
		return finalizeRegionCandidate(
			{ ...document, regions: document.regions.map((entry) => (entry.id === regionId ? candidate : entry)) },
			'region-rename',
			regionId
		);
	}
	if (typeof value !== 'string' || value.trim().length === 0) {
		return reject('invalid_value', 'Region name cannot be empty', [regionId]);
	}
	const trimmed = value.trim();
	if (region.name === trimmed) return reject('no_op', `Region '${regionId}' already has that name`, [regionId]);
	return finalizeRegionCandidate(
		{
			...document,
			regions: document.regions.map((entry) => (entry.id === regionId ? { ...entry, name: trimmed } : entry))
		},
		'region-rename',
		regionId
	);
}

/** Remove one region. No Wall, Room or surface reference is rewritten. */
export function planRemoveRegion(document: LayoutDocumentWallFirst, regionId: string): RegionPlan {
	if (!document.regions.some((region) => region.id === regionId)) {
		return reject('unknown_region', `Unknown region '${regionId}'`, [regionId]);
	}
	return finalizeRegionCandidate(
		{ ...document, regions: document.regions.filter((region) => region.id !== regionId) },
		'region-remove',
		regionId
	);
}

/**
 * Duplicate one region: a fresh captured id, every point translated by the same
 * delta, and no intended-gap flags — intent never travels with a copy.
 */
export function planDuplicateRegion(
	document: LayoutDocumentWallFirst,
	intent: { readonly regionId: string; readonly delta: LayoutVec2 },
	capture: LayoutIdCapture
): RegionPlan {
	if (!isLayoutIdCapture(capture)) return reject('invalid_capture', 'The duplicated region is missing its identity capture');
	const source = findRegion(document, intent.regionId);
	if (source === undefined) return reject('unknown_region', `Unknown region '${intent.regionId}'`, [intent.regionId]);
	if (!finitePoint(intent.delta)) return reject('invalid_value', 'Region duplicate delta must be finite', [intent.regionId]);
	try {
		const id = allocateCapturedId(layoutIds(document), 'region', capture);
		const region: LayoutRegion = {
			...source,
			id,
			footprint: { kind: 'polygon', points: translatePoints(source.footprint.points, intent.delta) },
			form: { ...source.form },
			intendedGaps: []
		};
		return finalizeRegionCandidate(
			{ ...document, regions: [...document.regions, region] },
			'region-duplicate',
			id,
			{ createdRegionId: id }
		);
	} catch (error) {
		if (error instanceof LayoutIdCollisionError) return reject('captured_id_in_use', error.message, [error.id]);
		throw error;
	}
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
	roomId: string
): RegionPlan {
	const region = findRegion(document, regionId);
	if (region === undefined) return reject('unknown_region', `Unknown region '${regionId}'`, [regionId]);
	const room = compiled.rooms.find((candidate) => candidate.roomId === roomId);
	if (room === undefined) return reject('unknown_room', `Unknown room '${roomId}'`, [roomId]);
	const outline = room.floorPolygon;
	if (outline.length < 3) {
		return reject('invalid_room_outline', `Room '${roomId}' has no usable compiled outline`, [roomId]);
	}
	if (outline.length > MAX_LAYOUT_REGION_POINTS) {
		return reject(
			'region_point_count',
			`Room '${roomId}' outline has ${outline.length} points; a region stores at most ${MAX_LAYOUT_REGION_POINTS}`,
			[roomId, regionId]
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
					: entry
			)
		},
		'region-fit-space',
		regionId
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
	wallId: string
): RegionPlan {
	const region = findRegion(document, regionId);
	if (region === undefined) return reject('unknown_region', `Unknown region '${regionId}'`, [regionId]);
	const authoredWall = document.walls.find((wall) => wall.id === wallId);
	if (authoredWall === undefined) return reject('unknown_wall', `Unknown wall '${wallId}'`, [wallId]);
	if (authoredWall.centerline.kind !== 'line') {
		return reject('curved_wall_unsupported', `Wall '${wallId}' is curved; Meet wall needs a straight Wall`, [wallId]);
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
	if (relation === undefined || relation.reading !== 'gap' || relation.measureAxis !== 'horizontal') {
		return reject('no_horizontal_gap', `Wall '${wallId}' has no horizontal gap to region '${regionId}'`, [regionId, wallId]);
	}
	const nearest = nearestFootprintEdge(region.footprint.points, wall);
	if (nearest === null) return reject('invalid_value', 'This region footprint has no usable edge', [regionId]);
	const first = wall.samples[0]!;
	const last = wall.samples.at(-1)!;
	const wallLength = Math.hypot(last.point[0] - first.point[0], last.point[1] - first.point[1]);
	if (!(wallLength > 0)) return reject('invalid_value', `Wall '${wallId}' has no usable direction`, [wallId]);
	const wallDirection: LayoutVec2 = [
		(last.point[0] - first.point[0]) / wallLength,
		(last.point[1] - first.point[1]) / wallLength
	];
	const [edgeStart, edgeEnd] = nearest.edge;
	const edgeLength = Math.hypot(edgeEnd[0] - edgeStart[0], edgeEnd[1] - edgeStart[1]);
	if (!(edgeLength > 0)) return reject('invalid_value', 'The nearest footprint edge is degenerate', [regionId]);
	const edgeDirection: LayoutVec2 = [
		(edgeEnd[0] - edgeStart[0]) / edgeLength,
		(edgeEnd[1] - edgeStart[1]) / edgeLength
	];
	const parallel = Math.abs(
		wallDirection[0] * edgeDirection[1] - wallDirection[1] * edgeDirection[0]
	);
	if (parallel > 1e-6) {
		return reject(
			'edge_not_parallel',
			`The nearest edge of region '${regionId}' is not parallel to Wall '${wallId}'`,
			[regionId, wallId]
		);
	}
	const normal: LayoutVec2 = [-wallDirection[1], wallDirection[0]];
	const edgeMid: LayoutVec2 = [
		(edgeStart[0] + edgeEnd[0]) / 2,
		(edgeStart[1] + edgeEnd[1]) / 2
	];
	const signed = (edgeMid[0] - first.point[0]) * normal[0] + (edgeMid[1] - first.point[1]) * normal[1];
	const half = wall.thickness / 2;
	let translation: LayoutVec2;
	if (signed > half + REGION_WALL_RELATION_EPSILON) {
		translation = [-normal[0] * (signed - half), -normal[1] * (signed - half)];
	} else if (signed < -half - REGION_WALL_RELATION_EPSILON) {
		translation = [normal[0] * (-signed - half), normal[1] * (-signed - half)];
	} else {
		return reject('no_horizontal_gap', `Wall '${wallId}' already touches region '${regionId}'`, [regionId, wallId]);
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
								points: translatePoints(entry.footprint.points, translation)
							}
						}
					: entry
			)
		},
		'region-fit-edge',
		regionId
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
	wall: Pick<CompiledPhysicalWall, 'samples' | 'thickness' | 'startJunctionId' | 'endJunctionId'>
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
				segmentDistance(start, end, centerline[station]!, centerline[station + 1]!)
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
	wallIds: readonly string[]
): RegionPlan {
	const region = findRegion(document, regionId);
	if (region === undefined) return reject('unknown_region', `Unknown region '${regionId}'`, [regionId]);
	if (region.role !== 'overhead') {
		return reject('region_role_not_overhead', 'Fit roof to walls applies to an overhead region', [regionId]);
	}
	const floor = compiled.floors[0];
	const compiledRegion = compiled.regions.find((candidate) => candidate.regionId === regionId);
	if (floor === undefined || compiledRegion === undefined) {
		return reject('invalid_candidate_document', `Region '${regionId}' is not part of this compiled Layout`, [regionId]);
	}
	const chosen = [...new Set(wallIds)];
	if (chosen.length === 0) return reject('invalid_value', 'Choose at least one Wall to fit to', [regionId]);
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
		return reject(
			'no_covered_walls',
			`No chosen Wall touches or overlaps region '${regionId}'`,
			[regionId, ...skippedWallIds]
		);
	}
	let highest = -Infinity;
	for (const wall of qualifying) {
		highest = Math.max(highest, regionWallTopRangeY(wall, floor.elevation).maxY);
	}
	const elevation = highest - floor.elevation;
	if (!Number.isFinite(elevation) || Math.abs(elevation) > MAX_LAYOUT_DIMENSION_METERS || !(elevation > 0)) {
		return reject('invalid_value', `Fitting region '${regionId}' would put its underside outside the Layout envelope`, [regionId]);
	}
	if (Math.abs(region.elevation - elevation) <= REGION_WALL_RELATION_EPSILON) {
		return reject('no_op', `Region '${regionId}' already touches the highest chosen Wall`, [regionId]);
	}
	return finalizeRegionCandidate(
		{
			...document,
			regions: document.regions.map((entry) => (entry.id === regionId ? { ...entry, elevation } : entry))
		},
		'region-fit-roof',
		regionId,
		{ fittedWallIds: qualifying.map((wall) => wall.wallId), skippedWallIds }
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
	wallIds: readonly string[]
): RegionPlan {
	const region = findRegion(document, regionId);
	if (region === undefined) return reject('unknown_region', `Unknown region '${regionId}'`, [regionId]);
	if (region.role !== 'overhead') {
		return reject('region_role_not_overhead', 'Fit walls to roof applies to an overhead region', [regionId]);
	}
	const floor = compiled.floors[0];
	const compiledRegion = compiled.regions.find((candidate) => candidate.regionId === regionId);
	if (floor === undefined || compiledRegion === undefined) {
		return reject('invalid_candidate_document', `Region '${regionId}' is not part of this compiled Layout`, [regionId]);
	}
	const chosen = [...new Set(wallIds)];
	if (chosen.length === 0) return reject('invalid_value', 'Choose at least one Wall to fit', [regionId]);
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
			[regionId]
		);
	}
	if (targetHeight > MAX_LAYOUT_DIMENSION_METERS) {
		return reject('invalid_value', 'Fitted Wall height exceeds the 1000 m Layout envelope', [regionId]);
	}
	const eligible: CompiledPhysicalWall[] = [];
	const skippedWallIds: string[] = [];
	for (const wall of compiled.walls) {
		if (!chosen.includes(wall.wallId)) continue;
		if (wall.samples.length >= 2 && wall.samples.every((sample) => footprintContainsInclusive(compiledRegion.footprint, sample.point))) {
			eligible.push(wall);
		} else {
			skippedWallIds.push(wall.wallId);
		}
	}
	if (eligible.length === 0) {
		return reject(
			'no_eligible_walls',
			`No chosen Wall lies entirely under region '${regionId}'`,
			[regionId, ...skippedWallIds]
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
			heights.has(wall.id) ? { ...wall, height: targetHeight } : wall
		)
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
			openingIssues
		);
	}
	const session = activeLayoutCompileSession();
	const accepted = session ? session.compile(structural.document) : compileWallFirstLayoutGeometry(structural.document);
	if (hasBlockingLayoutIssues(accepted.issues)) {
		const first = accepted.issues[0]!;
		return reject(
			'candidate_does_not_compile',
			first.message,
			first.targetId === undefined ? [regionId] : [first.targetId],
			accepted.issues
		);
	}
	return {
		kind: 'success',
		document: structural.document,
		operation: 'region-fit-walls',
		regionId,
		changedWallIds: changes.map((wall) => wall.wallId),
		fittedWallIds: eligible.map((wall) => wall.wallId),
		skippedWallIds
	};
}

/** Inclusive footprint membership: an edge or vertex on the ring qualifies. */
function footprintContainsInclusive(footprint: readonly LayoutVec2[], point: LayoutVec2): boolean {
	if (pointStrictlyInsidePolygon(footprint, point)) return true;
	for (let index = 0; index < footprint.length; index++) {
		const start = footprint[index]!;
		const end = footprint[(index + 1) % footprint.length]!;
		if (distancePointSegment(point, start, end) <= REGION_WALL_RELATION_EPSILON) return true;
	}
	return false;
}

function segmentDistance(a: LayoutVec2, b: LayoutVec2, c: LayoutVec2, d: LayoutVec2): number {
	return Math.min(
		distancePointSegment(a, c, d),
		distancePointSegment(b, c, d),
		distancePointSegment(c, a, b),
		distancePointSegment(d, a, b)
	);
}

function distancePointSegment(point: LayoutVec2, start: LayoutVec2, end: LayoutVec2): number {
	const dx = end[0] - start[0];
	const dz = end[1] - start[1];
	const squared = dx * dx + dz * dz;
	if (!(squared > 0)) return Math.hypot(point[0] - start[0], point[1] - start[1]);
	const t = Math.min(
		1,
		Math.max(0, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dz) / squared)
	);
	return Math.hypot(point[0] - (start[0] + dx * t), point[1] - (start[1] + dz * t));
}

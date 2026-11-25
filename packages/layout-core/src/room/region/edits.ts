import type { LayoutVec2 } from '../../geometry/coordinates';
import { MAX_LAYOUT_DIMENSION_METERS } from '../../geometry/limits';
import type { CompiledLayoutGeometry } from '../../geometry/types';
import type { LayoutIdCapture } from '../../plan/id-capture';
import { LayoutIdCollisionError, allocateCapturedId, isLayoutIdCapture } from '../../plan/id-capture';
import { regionWallRelations } from '../region-relations';
import type { LayoutDocumentWallFirst, LayoutRegion } from '../../wall/types';
import type { RegionCreateIntent, RegionPlan } from './contracts';
import { copyPoints, finalizeRegionCandidate, findRegion, finitePoint, footprintCentroid, layoutIds, reject, rotatePoint, samePoints, translatePoints, validFootprintInput } from './shared';

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

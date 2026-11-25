import type { Vec3 } from '../../kernel/types';
import type { LayoutVec2 } from '../../geometry/coordinates';
import type { CompiledFloor, CompiledLayoutGeometry, CompiledQueryPolygon, CompiledRegion, CompiledRoom } from '../../geometry/types';
import { geometryId } from '../../geometry/types';
import { compareWitnesses, groupWitnessesByElevation, hasUsableBoundary, pointWithinToleranceOfBounds, registerWitness, witnessLabel } from './choice';
import type { FloorSupportWitness } from './contracts';
import { FLOOR_SUPPORT_TOLERANCES, OVERHEAD_SUPPORT_DOWN_NORMAL } from './contracts';
import { polygonContainsWithTolerance } from './floor';

/**
 * The downward query: closed-Space lids and overhead-region undersides at one
 * world X/Z point, ordered by increasing elevation. `aboveElevation` narrows the
 * set to faces more than the coplanar tolerance above that starting height.
 */
export type OverheadSupportQueryPolygon = Pick<
	CompiledQueryPolygon,
	'id' | 'cacheKey' | 'kind' | 'polygon' | 'sourceId' | 'floorId' | 'elevation'
>;


export type OverheadSupportSnapshot = {
	floors: readonly Pick<CompiledFloor, 'floorId' | 'elevation' | 'roomIds'>[];
	rooms: readonly Pick<
		CompiledRoom,
		'roomId' | 'id' | 'cacheKey' | 'overhead' | 'floorElevation' | 'ceilingElevation' | 'ceilingPolygon'
	>[];
	regions: readonly Pick<
		CompiledRegion,
		'regionId' | 'id' | 'cacheKey' | 'role' | 'bottomY' | 'topY' | 'footprint'
	>[];
	queryPolygons: readonly OverheadSupportQueryPolygon[];
};


export function overheadSupportSnapshotOf(compiled: CompiledLayoutGeometry): OverheadSupportSnapshot {
	return {
		floors: compiled.floors,
		rooms: compiled.rooms,
		regions: compiled.regions,
		queryPolygons: compiled.queries.polygons
	};
}


export type OverheadSupportQueryInput = {
	generationId: string;
	evidenceGenerationId?: string;
	x: number;
	z: number;
	/** Select faces strictly above this starting elevation. */
	aboveElevation?: number;
};


export type OverheadSupportWitness = FloorSupportWitness;


export type OverheadSupportCandidate = {
	queryPoint: LayoutVec2;
	elevation: number;
	downNormal: Vec3;
	generationId: string;
	witnesses: readonly OverheadSupportWitness[];
	orderKey: string;
	label: string;
};


export type OverheadSupportQueryResult =
	| { kind: 'candidates'; candidates: readonly OverheadSupportCandidate[] }
	| { kind: 'none' }
	| {
		kind: 'invalid-input';
		code: 'non-finite-point' | 'missing-generation-id' | 'non-finite-height';
		message: string;
	}
	| {
		kind: 'stale-generation';
		generationId: string;
		evidenceGenerationId: string;
		message: string;
	}
	| {
		kind: 'unsupported';
		code: 'missing-support-facts' | 'contradictory-support-facts';
		message: string;
	};


export function queryOverheadSupports(
	snapshot: OverheadSupportSnapshot,
	input: OverheadSupportQueryInput
): OverheadSupportQueryResult {
	if (typeof input.generationId !== 'string' || input.generationId.trim().length === 0) {
		return {
			kind: 'invalid-input',
			code: 'missing-generation-id',
			message: 'An overhead-support query needs the caller compile generation it is resolving against.'
		};
	}
	if (!Number.isFinite(input.x) || !Number.isFinite(input.z)) {
		return {
			kind: 'invalid-input',
			code: 'non-finite-point',
			message: `An overhead-support query needs a finite world X/Z point; received (${String(input.x)}, ${String(input.z)}).`
		};
	}
	if (input.aboveElevation !== undefined && !Number.isFinite(input.aboveElevation)) {
		return {
			kind: 'invalid-input',
			code: 'non-finite-height',
			message: `An overhead-support query needs a finite starting elevation; received ${String(input.aboveElevation)}.`
		};
	}
	if (input.evidenceGenerationId !== undefined && input.evidenceGenerationId !== input.generationId) {
		return {
			kind: 'stale-generation',
			generationId: input.generationId,
			evidenceGenerationId: input.evidenceGenerationId,
			message: `Evidence was captured against generation "${input.evidenceGenerationId}" and the snapshot is generation "${input.generationId}".`
		};
	}

	const point: LayoutVec2 = [input.x, input.z];
	const floorByFloorId = new Map(snapshot.floors.map((floor) => [floor.floorId, floor]));
	const _roomById = new Map(snapshot.rooms.map((room) => [room.roomId, room]));
	const regionById = new Map(snapshot.regions.map((region) => [region.regionId, region]));
	const elevationBySource = new Map<string, number>();
	const witnessByKey = new Map<string, OverheadSupportWitness>();

	for (const room of snapshot.rooms) {
		// Open to sky removes the generated lid and nothing else.
		if (room.overhead !== 'closed') continue;
		if (room.ceilingPolygon.length < 3) {
			if (pointWithinToleranceOfBounds(point, room.ceilingPolygon, FLOOR_SUPPORT_TOLERANCES.boundaryMeters)) {
				return {
					kind: 'unsupported',
					code: 'missing-support-facts',
					message: `Compiled Room "${room.roomId}" has a degenerate lid that reaches the queried point.`
				};
			}
			continue;
		}
		if (!polygonContainsWithTolerance(point, room.ceilingPolygon)) continue;
		const floor = snapshot.floors.find((candidate) => candidate.roomIds.includes(room.roomId)) ?? snapshot.floors[0];
		if (floor === undefined || !Number.isFinite(floor.elevation)) {
			return {
				kind: 'unsupported',
				code: 'missing-support-facts',
				message: `Compiled Room "${room.roomId}" has no compiled floor with a finite datum.`
			};
		}
		if (
			!Number.isFinite(room.floorElevation) ||
			Math.abs(floor.elevation - room.floorElevation) > FLOOR_SUPPORT_TOLERANCES.coplanarElevationMeters
		) {
			return {
				kind: 'unsupported',
				code: 'contradictory-support-facts',
				message: `Compiled Room "${room.roomId}" reports floor elevation ${String(room.floorElevation)} and its floor reports datum ${floor.elevation}.`
			};
		}
		if (!Number.isFinite(room.ceilingElevation)) {
			return {
				kind: 'unsupported',
				code: 'missing-support-facts',
				message: `Compiled Room "${room.roomId}" has no finite lid elevation.`
			};
		}
		const recordId = room.id;
		const witnessKey = geometryId([floor.floorId, 'room-lid', room.roomId, recordId]);
		const witness: OverheadSupportWitness = {
			source: { kind: 'room', roomId: room.roomId },
			floorId: floor.floorId,
			recordId,
			cacheKey: room.cacheKey,
			sourceId: room.roomId,
			orderKey: geometryId([room.roomId, floor.floorId, recordId]),
			elevation: room.ceilingElevation
		};
		if (!registerWitness(witnessByKey, witnessKey, witness)) {
			return {
				kind: 'unsupported',
				code: 'contradictory-support-facts',
				message: `Compiled lid record "${recordId}" has conflicting source correspondence.`
			};
		}
		elevationBySource.set(`room-lid:${room.roomId}`, room.ceilingElevation);
	}

	for (const polygon of snapshot.queryPolygons) {
		if (polygon.kind !== 'region-underside') continue;
		if (!hasUsableBoundary(polygon.polygon)) {
			if (pointWithinToleranceOfBounds(point, polygon.polygon, FLOOR_SUPPORT_TOLERANCES.boundaryMeters)) {
				return {
					kind: 'unsupported',
					code: 'missing-support-facts',
					message: `Compiled region-underside record "${polygon.id}" carries a degenerate boundary but reaches the queried point.`
				};
			}
			continue;
		}
		if (!polygonContainsWithTolerance(point, polygon.polygon)) continue;
		if (polygon.floorId === undefined) {
			return {
				kind: 'unsupported',
				code: 'missing-support-facts',
				message: `Compiled region-underside record "${polygon.id}" names no floor owner.`
			};
		}
		const floor = floorByFloorId.get(polygon.floorId);
		if (floor === undefined || !Number.isFinite(floor.elevation)) {
			return {
				kind: 'unsupported',
				code: 'missing-support-facts',
				message: `Compiled region-underside record "${polygon.id}" has no compiled floor with a finite datum.`
			};
		}
		const regionFacts = snapshot.regions.filter((region) => region.regionId === polygon.sourceId);
		if (regionFacts.some((region) => region.bottomY !== regionFacts[0]!.bottomY)) {
			return {
				kind: 'unsupported',
				code: 'contradictory-support-facts',
				message: `Compiled record "${polygon.id}" has conflicting facts for one region identity.`
			};
		}
		const region = regionById.get(polygon.sourceId);
		if (region === undefined || !Number.isFinite(region.bottomY) || !Number.isFinite(region.topY)) {
			return {
				kind: 'unsupported',
				code: 'missing-support-facts',
				message: `Compiled region-underside record "${polygon.id}" has no compiled region with finite slab facts.`
			};
		}
		if (region.role !== 'overhead') {
			return {
				kind: 'unsupported',
				code: 'contradictory-support-facts',
				message: `Compiled region-underside record "${polygon.id}" names "${region.regionId}", which is not an overhead-role region.`
			};
		}
		if (
			polygon.elevation === undefined ||
			!Number.isFinite(polygon.elevation) ||
			Math.abs(polygon.elevation - region.bottomY) > FLOOR_SUPPORT_TOLERANCES.coplanarElevationMeters
		) {
			return {
				kind: 'unsupported',
				code: 'contradictory-support-facts',
				message: `Compiled region-underside record "${polygon.id}" reports elevation ${String(polygon.elevation)} and region "${region.regionId}" has underside ${region.bottomY}.`
			};
		}
		const known = elevationBySource.get(`region:${region.regionId}`);
		if (
			known !== undefined &&
			Math.abs(known - region.bottomY) > FLOOR_SUPPORT_TOLERANCES.coplanarElevationMeters
		) {
			return {
				kind: 'unsupported',
				code: 'contradictory-support-facts',
				message: `Region "${region.regionId}" appears in two containing compiled records with elevations ${known} and ${region.bottomY}.`
			};
		}
		elevationBySource.set(`region:${region.regionId}`, region.bottomY);
		const orderKey = geometryId([polygon.sourceId, region.regionId, polygon.floorId, polygon.id]);
		const witnessKey = geometryId([polygon.floorId, 'region-underside', region.regionId, polygon.id]);
		const witness: OverheadSupportWitness = {
			source: { kind: 'region', regionId: region.regionId },
			floorId: polygon.floorId,
			recordId: polygon.id,
			cacheKey: polygon.cacheKey,
			sourceId: polygon.sourceId,
			orderKey,
			elevation: region.bottomY
		};
		if (!registerWitness(witnessByKey, witnessKey, witness)) {
			return {
				kind: 'unsupported',
				code: 'contradictory-support-facts',
				message: `Compiled record "${polygon.id}" has conflicting source correspondence.`
			};
		}
	}

	const groups = groupWitnessesByElevation(witnessByKey);
	const candidates: OverheadSupportCandidate[] = [];
	for (const group of groups) {
		if (
			input.aboveElevation !== undefined &&
			group.elevation <= input.aboveElevation + FLOOR_SUPPORT_TOLERANCES.coplanarElevationMeters
		) continue;
		const first = group.witnesses[0]!;
		candidates.push({
			queryPoint: [input.x, input.z],
			elevation: group.elevation,
			downNormal: [
				OVERHEAD_SUPPORT_DOWN_NORMAL[0],
				OVERHEAD_SUPPORT_DOWN_NORMAL[1],
				OVERHEAD_SUPPORT_DOWN_NORMAL[2]
			] as Vec3,
			generationId: input.generationId,
			witnesses: group.witnesses,
			orderKey: first.orderKey,
			label: witnessLabel(first)
		});
	}
	if (candidates.length === 0) return { kind: 'none' };
	candidates.sort((left, right) =>
		left.elevation - right.elevation ||
		compareWitnesses(left.witnesses[0]!, right.witnesses[0]!)
	);
	return { kind: 'candidates', candidates };
}

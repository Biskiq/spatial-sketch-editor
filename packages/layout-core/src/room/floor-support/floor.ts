import type { LayoutVec2 } from '../../geometry/coordinates';
import { geometryId } from '../../geometry/types';
import { pointInPolygon } from '../../geometry/objects';
import { contradictory, distanceToSegment, groupSupportCandidates, hasUsableBoundary, pointWithinToleranceOfBounds, registerWitness } from './choice';
import type { FloorSupportCandidate, FloorSupportQueryInput, FloorSupportQueryPolygon, FloorSupportQueryResult, FloorSupportSnapshot, FloorSupportWitness } from './contracts';
import { DATUM_SUPPORT_ORDER_KEY, FLOOR_SUPPORT_TOLERANCES } from './contracts';

/**
 * The horizontal datum of one compiled Layout, in project-world meters.
 *
 * Current wall-first Layout carries exactly one Floor, so the datum is its
 * elevation. A compile with no Floor at all has nothing to measure against, which
 * is why the fallback is the origin rather than a guess.
 */
export function layoutDatumElevation(geometry: { readonly floors: readonly { readonly elevation: number }[] }): number {
	return geometry.floors[0]?.elevation ?? 0;
}


/**
 * The support the explicit datum offers at one point.
 *
 * The datum is authored, not compiled from a Room, so it has no witness. It is
 * only ever offered where `queryFloorSupports` found no authored floor: a floor
 * that covers a point always decides that point's elevation.
 */
export function datumSupportCandidate(input: {
	readonly elevation: number;
	readonly generationId: string;
	readonly x: number;
	readonly z: number;
}): FloorSupportCandidate {
	return {
		queryPoint: [input.x, input.z],
		elevation: input.elevation,
		upNormal: [0, 1, 0],
		generationId: input.generationId,
		witnesses: [],
		orderKey: DATUM_SUPPORT_ORDER_KEY,
		label: 'Stage datum'
	};
}


/**
 * Tolerance-inclusive point/polygon membership.
 *
 * `pointInPolygon` is a strict ray cast, so a point exactly on a shared Room
 * boundary — or one whose last bit drifted through a canonical round trip —
 * would be reported outside both Rooms. The declared boundary tolerance is what
 * makes a shared boundary a support for the point on it.
 *
 * A degenerate polygon (fewer than three points) can never be a support; the
 * query reports the near-miss case separately instead of silently answering
 * "no support" for a record that carries no usable facts.
 */
export function polygonContainsWithTolerance(
	point: LayoutVec2,
	polygon: readonly LayoutVec2[],
	toleranceMeters: number = FLOOR_SUPPORT_TOLERANCES.boundaryMeters
): boolean {
	if (!hasUsableBoundary(polygon) || point.some(value => !Number.isFinite(value))) return false;
	if (!Number.isFinite(toleranceMeters) || toleranceMeters < 0) return false;
	if (pointInPolygon(point, polygon)) return true;
	for (let index = 0; index < polygon.length; index += 1) {
		const start = polygon[index]!;
		const end = polygon[(index + 1) % polygon.length]!;
		if (distanceToSegment(point, start, end) <= toleranceMeters) return true;
	}
	return false;
}


export function queryFloorSupports(
	snapshot: FloorSupportSnapshot,
	input: FloorSupportQueryInput
): FloorSupportQueryResult {
	if (typeof input.generationId !== 'string' || input.generationId.trim().length === 0) {
		return {
			kind: 'invalid-input',
			code: 'missing-generation-id',
			message: 'A floor-support query needs the caller compile generation it is resolving against.'
		};
	}
	if (!Number.isFinite(input.x) || !Number.isFinite(input.z)) {
		return {
			kind: 'invalid-input',
			code: 'non-finite-point',
			message: `A floor-support query needs a finite world X/Z point; received (${String(input.x)}, ${String(input.z)}).`
		};
	}
	if (
		input.evidenceGenerationId !== undefined &&
		input.evidenceGenerationId !== input.generationId
	) {
		return {
			kind: 'stale-generation',
			generationId: input.generationId,
			evidenceGenerationId: input.evidenceGenerationId,
			message: `Evidence was captured against generation "${input.evidenceGenerationId}" and the snapshot is generation "${input.generationId}".`
		};
	}

	const scopeFloorId = input.scope?.floorId;
	if (scopeFloorId !== undefined && !snapshot.floors.some((floor) => floor.floorId === scopeFloorId)) {
		return {
			kind: 'unsupported',
			code: 'unknown-scope-floor',
			message: `The chosen floor "${scopeFloorId}" is not part of this compiled Layout, so its support cannot be resolved here.`
		};
	}

	const point: LayoutVec2 = [input.x, input.z];
	const floorByFloorId = new Map(snapshot.floors.map((floor) => [floor.floorId, floor]));
	const roomByRoomId = new Map(snapshot.rooms.map((room) => [room.roomId, room]));
	const regionById = new Map(snapshot.regions.map((region) => [region.regionId, region]));
	const containing: FloorSupportQueryPolygon[] = [];
	for (const polygon of snapshot.queryPolygons) {
		if (polygon.kind !== 'room-floor' && polygon.kind !== 'region-top') continue;
		if (scopeFloorId !== undefined && polygon.floorId !== scopeFloorId) continue;
		if (!hasUsableBoundary(polygon.polygon)) {
			if (pointWithinToleranceOfBounds(point, polygon.polygon, FLOOR_SUPPORT_TOLERANCES.boundaryMeters)) {
				return {
					kind: 'unsupported',
					code: 'missing-support-facts',
					message: `Compiled ${polygon.kind} record "${polygon.id}" carries an invalid or degenerate boundary but reaches the queried point, so this query cannot report an honest support set.`
				};
			}
			continue;
		}
		if (polygonContainsWithTolerance(point, polygon.polygon)) containing.push(polygon);
	}
	if (containing.length === 0) return { kind: 'none' };

	const elevationBySource = new Map<string, number>();
	const witnessByKey = new Map<string, FloorSupportWitness>();

	for (const polygon of containing) {
		const floorId = polygon.floorId;
		if (floorId === undefined) {
			return {
				kind: 'unsupported',
				code: 'missing-support-facts',
				message: `Compiled ${polygon.kind} record "${polygon.id}" names no floor owner, so its support cannot be qualified.`
			};
		}
		const floorFacts = snapshot.floors.filter((floor) => floor.floorId === floorId);
		if (floorFacts.some((floor) => floor.elevation !== floorFacts[0]!.elevation)) {
			return {
				kind: 'unsupported',
				code: 'contradictory-support-facts',
				message: `Compiled record "${polygon.id}" has conflicting facts for one floor identity.`
			};
		}
		const floor = floorByFloorId.get(floorId);
		if (floor === undefined || !Number.isFinite(floor.elevation)) {
			return {
				kind: 'unsupported',
				code: 'missing-support-facts',
				message: `Compiled ${polygon.kind} record "${polygon.id}" has no compiled floor with a finite datum for floor "${floorId}".`
			};
		}

		if (polygon.kind === 'room-floor') {
			if (polygon.roomId === undefined) {
				return {
					kind: 'unsupported',
					code: 'missing-support-facts',
					message: `Compiled room-floor record "${polygon.id}" names no Room owner, so its support cannot be qualified.`
				};
			}
			// Duplicate identities must agree exactly; a Map's last writer is no authority.
			const roomFacts = snapshot.rooms.filter((room) => room.roomId === polygon.roomId);
			if (roomFacts.some((room) => room.floorElevation !== roomFacts[0]!.floorElevation)) {
				return {
					kind: 'unsupported',
					code: 'contradictory-support-facts',
					message: `Compiled record "${polygon.id}" has conflicting facts for one source identity.`
				};
			}
			const room = roomByRoomId.get(polygon.roomId);
			if (room === undefined || !Number.isFinite(room.floorElevation)) {
				return {
					kind: 'unsupported',
					code: 'missing-support-facts',
					message: `Compiled room-floor record "${polygon.id}" has no compiled Room with a finite floor elevation for Room "${polygon.roomId}".`
				};
			}
			// Two compiled facts describe one support: the Room's floor elevation and
			// its floor's datum. Only their agreement is an elevation we may act on.
			if (
				Math.abs(floor.elevation - room.floorElevation) >
				FLOOR_SUPPORT_TOLERANCES.coplanarElevationMeters
			) {
				return {
					kind: 'unsupported',
					code: 'contradictory-support-facts',
					message: `Compiled Room "${room.roomId}" reports floor elevation ${room.floorElevation} and its floor "${floor.floorId}" reports datum ${floor.elevation}.`
				};
			}
			const known = elevationBySource.get(`room:${room.roomId}`);
			if (
				known !== undefined &&
				Math.abs(known - room.floorElevation) > FLOOR_SUPPORT_TOLERANCES.coplanarElevationMeters
			) {
				return {
					kind: 'unsupported',
					code: 'contradictory-support-facts',
					message: `Room "${room.roomId}" appears in two containing compiled records with elevations ${known} and ${room.floorElevation}.`
				};
			}
			elevationBySource.set(`room:${room.roomId}`, room.floorElevation);
			const orderKey = geometryId([polygon.sourceId, room.roomId, floorId, polygon.id]);
			const witnessKey = geometryId([floorId, 'room', room.roomId, polygon.id]);
			const witness: FloorSupportWitness = {
				source: { kind: 'room', roomId: room.roomId },
				floorId,
				recordId: polygon.id,
				cacheKey: polygon.cacheKey,
				sourceId: polygon.sourceId,
				orderKey,
				elevation: room.floorElevation
			};
			if (!registerWitness(witnessByKey, witnessKey, witness)) {
				return contradictory(polygon.id);
			}
			continue;
		}

		// `region-top`: the region record is the role/elevation authority; the query
		// record's own elevation must agree with it exactly within the tolerance.
		const regionFacts = snapshot.regions.filter((region) => region.regionId === polygon.sourceId);
		if (regionFacts.some((region) => region.topY !== regionFacts[0]!.topY)) {
			return {
				kind: 'unsupported',
				code: 'contradictory-support-facts',
				message: `Compiled record "${polygon.id}" has conflicting facts for one region identity.`
			};
		}
		const region = regionById.get(polygon.sourceId);
		if (region === undefined || !Number.isFinite(region.topY) || !Number.isFinite(region.bottomY)) {
			return {
				kind: 'unsupported',
				code: 'missing-support-facts',
				message: `Compiled region-top record "${polygon.id}" has no compiled region with finite slab facts for region "${polygon.sourceId}".`
			};
		}
		if (region.role !== 'floor') {
			return {
				kind: 'unsupported',
				code: 'contradictory-support-facts',
				message: `Compiled region-top record "${polygon.id}" names "${region.regionId}", which is not a floor-role region.`
			};
		}
		if (
			polygon.elevation === undefined ||
			!Number.isFinite(polygon.elevation) ||
			Math.abs(polygon.elevation - region.topY) > FLOOR_SUPPORT_TOLERANCES.coplanarElevationMeters
		) {
			return {
				kind: 'unsupported',
				code: 'contradictory-support-facts',
				message: `Compiled region-top record "${polygon.id}" reports elevation ${String(polygon.elevation)} and region "${region.regionId}" has top ${region.topY}.`
			};
		}
		const known = elevationBySource.get(`region:${region.regionId}`);
		if (
			known !== undefined &&
			Math.abs(known - region.topY) > FLOOR_SUPPORT_TOLERANCES.coplanarElevationMeters
		) {
			return {
				kind: 'unsupported',
				code: 'contradictory-support-facts',
				message: `Region "${region.regionId}" appears in two containing compiled records with elevations ${known} and ${region.topY}.`
			};
		}
		elevationBySource.set(`region:${region.regionId}`, region.topY);
		const orderKey = geometryId([polygon.sourceId, region.regionId, floorId, polygon.id]);
		const witnessKey = geometryId([floorId, 'region', region.regionId, polygon.id]);
		const witness: FloorSupportWitness = {
			source: { kind: 'region', regionId: region.regionId },
			floorId,
			recordId: polygon.id,
			cacheKey: polygon.cacheKey,
			sourceId: polygon.sourceId,
			orderKey,
			elevation: region.topY
		};
		if (!registerWitness(witnessByKey, witnessKey, witness)) return contradictory(polygon.id);
	}

	// Source-ID ordering is the only ordering here, and it never picks an
	// elevation: grouping below merges only supports the tolerance declares equal.
	return { kind: 'candidates', candidates: groupSupportCandidates(input, witnessByKey) };
}

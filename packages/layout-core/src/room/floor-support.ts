/**
 * The Layout-owned support queries.
 *
 * Two directions, one contract:
 *
 * - **Upward** (`queryFloorSupports`) answers which `room-floor` and
 *   `region-top` faces support a world X/Z point. Every containing face is a
 *   witness; coincident equivalent supports merge into one candidate that keeps
 *   **all** witnesses; a genuine elevation ambiguity is `choice-required` rather
 *   than an array-order pick.
 * - **Downward** (`queryOverheadSupports`) mirrors the same validation,
 *   tolerances and witness merging for closed-Space lids and overhead-region
 *   undersides, ordered by increasing elevation.
 *
 * Facts come from compiled records only: elevation is the compiled Room's
 * `floorElevation`, the compiled region's `topY`/`bottomY`, or the compiled lid's
 * `ceilingElevation`, cross-checked against the compiled query record and Floor
 * datum where the contract says so. A rendered mesh face, a centroid, a nearest
 * heuristic and a bare datum are never support authorities. The input is read,
 * never mutated.
 */
import type { Vec3 } from '../kernel/types';
import type { LayoutVec2 } from '../geometry/coordinates';
import type { CompiledFloor, CompiledLayoutGeometry, CompiledQueryPolygon, CompiledRegion, CompiledRoom } from '../geometry/types';
import { geometryId } from '../geometry/types';
import { pointInPolygon } from '../geometry/objects';

/**
 * Operation/query tolerances, not compiler epsilon.
 *
 * They never round a canonical value and never
 * change `layout-core`'s compiler tolerances. `boundaryMeters` is the declared
 * boundary-membership tolerance, `coplanarElevationMeters` decides when two
 * compiled elevations denote the same support, and `upNormalComponent` is the
 * per-component tolerance for up-normal equivalence.
 */
export type FloorSupportTolerances = {
	boundaryMeters: number;
	coplanarElevationMeters: number;
	upNormalComponent: number;
};

export const FLOOR_SUPPORT_TOLERANCES: Readonly<FloorSupportTolerances> = Object.freeze({
	boundaryMeters: 1e-6,
	coplanarElevationMeters: 1e-6,
	upNormalComponent: 1e-9
});

/** A compiled Room floor or floor-region top faces up; candidates carry it. */
export const FLOOR_SUPPORT_UP_NORMAL: Readonly<Vec3> = Object.freeze([0, 1, 0]);
/** A closed-Space lid or overhead-region underside faces down. */
export const OVERHEAD_SUPPORT_DOWN_NORMAL: Readonly<Vec3> = Object.freeze([0, -1, 0]);

/**
 * One compiled support face record, narrowed to the fields the query reads.
 */
export type FloorSupportQueryPolygon = Pick<
	CompiledQueryPolygon,
	'id' | 'cacheKey' | 'kind' | 'polygon' | 'sourceId' | 'floorId' | 'roomId' | 'elevation'
>;

/** The compiled region facts an upward region witness is verified against. */
export type FloorSupportRegionFacts = Pick<
	CompiledRegion,
	'regionId' | 'role' | 'topY' | 'bottomY' | 'id' | 'cacheKey'
>;

/**
 * The compiled facts the upward query is a read-only function of.
 *
 * `floorSupportSnapshotOf(compiled)` adapts canonical compiler output; a caller
 * that already holds the records may pass them directly. A consumer that must
 * keep today's Room-only behavior (Scene placement before V1d) narrows
 * `queryPolygons` to `kind: 'room-floor'` and passes `regions: []`.
 */
export type FloorSupportSnapshot = {
	floors: readonly Pick<CompiledFloor, 'floorId' | 'elevation'>[];
	rooms: readonly Pick<CompiledRoom, 'roomId' | 'floorElevation'>[];
	regions: readonly FloorSupportRegionFacts[];
	queryPolygons: readonly FloorSupportQueryPolygon[];
};

export function floorSupportSnapshotOf(compiled: CompiledLayoutGeometry): FloorSupportSnapshot {
	return {
		floors: compiled.floors,
		rooms: compiled.rooms,
		regions: compiled.regions,
		queryPolygons: compiled.queries.polygons
	};
}

export type FloorSupportScope = {
	/**
	 * An explicitly chosen Layout floor source id. It is a filter, never an
	 * inferred nearest-level heuristic. A chosen *level* is resolved to its
	 * floor id above this package (F.1 maps the current floor id to level
	 * qualification), because a level is not a Layout-core concept.
	 */
	floorId?: string;
};

export type FloorSupportQueryInput = {
	/** The caller's compile generation for the snapshot it is querying. */
	generationId: string;
	/**
	 * The generation the captured evidence (a mesh hit, a previous frame's
	 * point) was taken against. A mismatch refuses as `stale-generation`
	 * instead of resolving support from evidence the current snapshot cannot
	 * vouch for. Absent means "the caller already qualified its evidence".
	 */
	evidenceGenerationId?: string;
	x: number;
	z: number;
	scope?: FloorSupportScope;
};

/** One compiled support face that supports the queried point. */
export type FloorSupportWitnessSource =
	| { readonly kind: 'room'; readonly roomId: string }
	| { readonly kind: 'region'; readonly regionId: string };

export type FloorSupportWitness = {
	/** The typed source of this witness: a Room floor or a floor-role region top. */
	source: FloorSupportWitnessSource;
	floorId: string;
	/** Compiled record identity of the containing support polygon. */
	recordId: string;
	/** Compiled identity of the authored inputs that produced the record. */
	cacheKey: string;
	sourceId: string;
	/** Collision-safe choice identity derived from Layout-native IDs; not a lexical comparator. */
	orderKey: string;
	/** World elevation this witness establishes. */
	elevation: number;
};

export type FloorSupportCandidate = {
	/** World X/Z at which these witnesses were queried. */
	queryPoint: LayoutVec2;
	elevation: number;
	upNormal: Vec3;
	/** The caller's generation, echoed so acceptance can recheck it. */
	generationId: string;
	/** Every equivalent source witness, ordered lexically by source, floor and record. */
	witnesses: readonly FloorSupportWitness[];
	/** First source-ordered witness identity: stable and unique, never an elevation pick. */
	orderKey: string;
	/** Stable diagnostic/display label; never an identity and never a float readout. */
	label: string;
};

/** The stable choice identity of datum support; it can never equal a source witness key. */
export const DATUM_SUPPORT_ORDER_KEY = 'stage-datum';

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

export type FloorSupportQueryResult =
	| { kind: 'candidates'; candidates: readonly FloorSupportCandidate[] }
	| { kind: 'none' }
	| {
		kind: 'invalid-input';
		code: 'non-finite-point' | 'missing-generation-id';
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
		code: 'unknown-scope-floor' | 'missing-support-facts' | 'contradictory-support-facts';
		message: string;
	};

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

/** An explicit creator choice, by opaque source-derived choice key or by elevation. */
export type FloorSupportChoice =
	| { kind: 'order-key'; orderKey: string }
	| { kind: 'elevation'; elevation: number };

export type FloorSupportChoiceResult =
	| { kind: 'resolved'; support: FloorSupportCandidate }
	| { kind: 'choice-required'; candidates: readonly FloorSupportCandidate[] }
	| {
		kind: 'invalid-choice';
		code: 'no-support' | 'unknown-choice' | 'ambiguous-choice';
		message: string;
	};

/**
 * Resolve one support from the query's candidates.
 *
 * Exactly one candidate resolves without a choice; anything else asks for one.
 * An elevation choice that matches two candidates (two floors sharing a datum)
 * is `ambiguous-choice`, never a silent first match — that is why the ordering
 * key exists.
 */
export function chooseFloorSupport(
	candidates: readonly FloorSupportCandidate[],
	explicitChoice?: FloorSupportChoice
): FloorSupportChoiceResult {
	if (candidates.length === 0) {
		return {
			kind: 'invalid-choice',
			code: 'no-support',
			message: 'No floor-support candidate is available to choose from.'
		};
	}
	if (explicitChoice === undefined) {
		if (candidates.length === 1) return { kind: 'resolved', support: candidates[0]! };
		return { kind: 'choice-required', candidates };
	}

	const matches =
		explicitChoice.kind === 'order-key'
			? candidates.filter((candidate) => candidate.orderKey === explicitChoice.orderKey)
			: Number.isFinite(explicitChoice.elevation)
				? candidates.filter(
					(candidate) =>
						Math.abs(candidate.elevation - explicitChoice.elevation) <=
						FLOOR_SUPPORT_TOLERANCES.coplanarElevationMeters
				)
				: [];

	if (matches.length === 0) {
		return {
			kind: 'invalid-choice',
			code: 'unknown-choice',
			message:
				explicitChoice.kind === 'order-key'
					? `No floor-support candidate carries ordering key "${explicitChoice.orderKey}".`
					: `No floor-support candidate matches elevation ${String((explicitChoice as { elevation: number }).elevation)}.`
		};
	}
	if (matches.length > 1) {
		return {
			kind: 'invalid-choice',
			code: 'ambiguous-choice',
			message: `${matches.length} floor-support candidates match this choice: ${matches
				.map((candidate) => candidate.orderKey)
				.join(', ')}.`
		};
	}
	return { kind: 'resolved', support: matches[0]! };
}

function registerWitness(
	byKey: Map<string, FloorSupportWitness>,
	key: string,
	witness: FloorSupportWitness
): boolean {
	const previous = byKey.get(key);
	if (previous !== undefined) {
		return previous.cacheKey === witness.cacheKey && previous.sourceId === witness.sourceId;
	}
	byKey.set(key, witness);
	return true;
}

function contradictory(recordId: string) {
	return {
		kind: 'unsupported' as const,
		code: 'contradictory-support-facts' as const,
		message: `Compiled record "${recordId}" has conflicting source correspondence.`
	};
}

function groupSupportCandidates(
	input: FloorSupportQueryInput,
	witnessByKey: ReadonlyMap<string, FloorSupportWitness>
): FloorSupportCandidate[] {
	return groupWitnessesByElevation(witnessByKey)
		.map((group) => {
			const first = group.witnesses[0]!;
			return {
				queryPoint: [input.x, input.z] as LayoutVec2,
				elevation: group.elevation,
				upNormal: [
					FLOOR_SUPPORT_UP_NORMAL[0],
					FLOOR_SUPPORT_UP_NORMAL[1],
					FLOOR_SUPPORT_UP_NORMAL[2]
				] as Vec3,
				generationId: input.generationId,
				witnesses: group.witnesses,
				orderKey: first.orderKey,
				label: witnessLabel(first)
			};
		})
		.sort((left, right) => compareWitnesses(left.witnesses[0]!, right.witnesses[0]!));
}

type WitnessGroup = { floorId: string; elevation: number; witnesses: FloorSupportWitness[] };

function groupWitnessesByElevation(
	witnessByKey: ReadonlyMap<string, FloorSupportWitness>
): WitnessGroup[] {
	const witnesses = [...witnessByKey.values()].sort(compareWitnesses);
	const groups: WitnessGroup[] = [];
	for (const witness of witnesses) {
		// Every member must be within tolerance of the new witness. Checking only
		// the bucket's first elevation would let a middle elevation bridge two
		// supports that are themselves farther apart than one tolerance.
		const group = groups.find(
			(candidate) =>
				candidate.floorId === witness.floorId &&
				candidate.witnesses.every(
					(member) =>
						Math.abs(member.elevation - witness.elevation) <=
						FLOOR_SUPPORT_TOLERANCES.coplanarElevationMeters
				)
		);
		if (group === undefined) groups.push({ floorId: witness.floorId, elevation: witness.elevation, witnesses: [witness] });
		else group.witnesses.push(witness);
	}
	return groups;
}

function witnessLabel(witness: FloorSupportWitness): string {
	return witness.source.kind === 'room'
		? `Floor ${witness.floorId} / Room ${witness.source.roomId}`
		: `Floor ${witness.floorId} / Region ${witness.source.regionId}`;
}

// `geometryId` is collision-safe identity encoding, not a lexical sort key:
// its length prefixes would sort "b" before "a-long-source".
function compareWitnesses(left: FloorSupportWitness, right: FloorSupportWitness): number {
	if (left.source.kind !== right.source.kind) return left.source.kind < right.source.kind ? -1 : 1;
	const leftId = left.source.kind === 'room' ? left.source.roomId : left.source.regionId;
	const rightId = right.source.kind === 'room' ? right.source.roomId : right.source.regionId;
	if (leftId !== rightId) return leftId < rightId ? -1 : 1;
	for (const key of ['floorId', 'recordId', 'cacheKey'] as const) {
		if (left[key] !== right[key]) return left[key] < right[key] ? -1 : 1;
	}
	return 0;
}

function hasUsableBoundary(polygon: readonly LayoutVec2[]): boolean {
	if (polygon.length < 3 || polygon.some(point => point.some(value => !Number.isFinite(value)))) return false;
	const origin = polygon[0]!;
	let area = 0;
	for (let index = 1; index + 1 < polygon.length; index++) {
		const a = polygon[index]!;
		const b = polygon[index + 1]!;
		area += (a[0] - origin[0]) * (b[1] - origin[1]) - (a[1] - origin[1]) * (b[0] - origin[0]);
	}
	return Number.isFinite(area) && area !== 0;
}

function distanceToSegment(point: LayoutVec2, start: LayoutVec2, end: LayoutVec2): number {
	const dx = end[0] - start[0];
	const dz = end[1] - start[1];
	const squared = dx * dx + dz * dz;
	if (!(squared > 0)) return Math.hypot(point[0] - start[0], point[1] - start[1]);
	const rawT = ((point[0] - start[0]) * dx + (point[1] - start[1]) * dz) / squared;
	const t = Math.min(1, Math.max(0, rawT));
	return Math.hypot(point[0] - (start[0] + dx * t), point[1] - (start[1] + dz * t));
}

function pointWithinToleranceOfBounds(
	point: LayoutVec2,
	polygon: readonly LayoutVec2[],
	toleranceMeters: number
): boolean {
	if (polygon.length === 0) return false;
	let minX = Infinity;
	let minZ = Infinity;
	let maxX = -Infinity;
	let maxZ = -Infinity;
	for (const [x, z] of polygon) {
		if (!Number.isFinite(x) || !Number.isFinite(z)) return true;
		minX = Math.min(minX, x);
		minZ = Math.min(minZ, z);
		maxX = Math.max(maxX, x);
		maxZ = Math.max(maxZ, z);
	}
	return (
		point[0] >= minX - toleranceMeters &&
		point[0] <= maxX + toleranceMeters &&
		point[1] >= minZ - toleranceMeters &&
		point[1] <= maxZ + toleranceMeters
	);
}

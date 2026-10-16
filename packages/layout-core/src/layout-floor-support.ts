/**
 * T2.P01.S01 — the Layout-owned floor-support query and chooser.
 *
 * Answers one question over the canonical compiler's output: which compiled
 * Room floors support a world X/Z point, and at what elevation? It is
 * deliberately **not** `findPolygonContaining`: that helper's one reverse-order
 * winner cannot express elevation ambiguity. Here every containing `room-floor`
 * polygon becomes a witness, coincident equivalent supports deduplicate into one
 * choice that keeps **all** of them, and a genuine elevation ambiguity is
 * reported as `choice-required` rather than resolved by array order. Nothing in
 * this module ever chooses an elevation on the creator's behalf.
 *
 * Ownership (2026-10-16 decision 8): the query is Layout-owned and built by its
 * first consumer under T1 review. It sits inside `@portfolio/layout-core`, which
 * is below `@portfolio/project-model`, so it speaks Layout-native source ids
 * (`floorId`, `roomId`) plus an opaque generation id the caller supplies;
 * F.1 qualification into `SemanticReference`/`DerivedSourceRef` happens in the
 * project-model planner, never here. This module imports no F.1 type and adds no
 * package dependency.
 *
 * Facts come from compiled records only: elevation is the compiled Room's
 * `floorElevation`, cross-checked against its floor's datum. A rendered mesh
 * face, a Room centroid, a nearest-Room heuristic and a bare floor datum are
 * never support authorities. The input is read, never mutated.
 */
import type { Vec3 } from './types';
import type { LayoutVec2 } from './layout-types';
import type {
	CompiledFloor,
	CompiledLayoutGeometry,
	CompiledQueryPolygon,
	CompiledRoom
} from './layout-geometry-types';
import { geometryId } from './layout-geometry-types';
import { pointInPolygon } from './layout-geometry-objects';

/**
 * Operation/query tolerances, not compiler epsilon.
 *
 * Proposed values for T1 review; they never round a canonical value and never
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

export const FLOOR_SUPPORT_TOLERANCES: FloorSupportTolerances = {
	boundaryMeters: 1e-6,
	coplanarElevationMeters: 1e-6,
	upNormalComponent: 1e-9
};

/** A compiled Room floor faces up; support candidates carry this normal. */
export const FLOOR_SUPPORT_UP_NORMAL: Vec3 = [0, 1, 0];

/**
 * The one compiled `room-floor` record shape the query reads. Picking the
 * fields (rather than taking `CompiledQueryPolygon` whole) is what makes the
 * read surface reviewable — and it is exactly what `floorSupportSnapshotOf`
 * passes through from compiled output.
 */
export type FloorSupportQueryPolygon = Pick<
	CompiledQueryPolygon,
	'id' | 'cacheKey' | 'kind' | 'polygon' | 'sourceId' | 'floorId' | 'roomId'
>;

/**
 * The compiled facts the query is a read-only function of.
 *
 * `floorSupportSnapshotOf(compiled)` adapts canonical compiler output; a caller
 * that already holds the records may pass them directly.
 */
export type FloorSupportSnapshot = {
	floors: readonly Pick<CompiledFloor, 'floorId' | 'elevation'>[];
	rooms: readonly Pick<CompiledRoom, 'roomId' | 'floorElevation'>[];
	queryPolygons: readonly FloorSupportQueryPolygon[];
};

export function floorSupportSnapshotOf(compiled: CompiledLayoutGeometry): FloorSupportSnapshot {
	return {
		floors: compiled.floors,
		rooms: compiled.rooms,
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

/** One compiled room-floor record that supports the queried point. */
export type FloorSupportWitness = {
	floorId: string;
	roomId: string;
	/** Compiled record identity of the `room-floor` polygon. */
	recordId: string;
	/** Compiled identity of the authored inputs that produced the record. */
	cacheKey: string;
	sourceId: string;
	/** Collision-safe ordering key derived from the Layout-native source ids. */
	orderKey: string;
};

export type FloorSupportCandidate = {
	elevation: number;
	upNormal: Vec3;
	/** The caller's generation, echoed so acceptance can recheck it. */
	generationId: string;
	/** Every equivalent source witness, ordered by `orderKey`. */
	witnesses: readonly FloorSupportWitness[];
	/** Minimum witness `orderKey`: stable, source-derived, never an elevation pick. */
	orderKey: string;
	/** Stable diagnostic/display label; never an identity and never a float readout. */
	label: string;
};

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
	if (polygon.length < 3) return false;
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
	const containing: FloorSupportQueryPolygon[] = [];
	for (const polygon of snapshot.queryPolygons) {
		if (polygon.kind !== 'room-floor') continue;
		if (scopeFloorId !== undefined && polygon.floorId !== scopeFloorId) continue;
		if (polygon.polygon.length < 3) {
			if (pointWithinToleranceOfBounds(point, polygon.polygon, FLOOR_SUPPORT_TOLERANCES.boundaryMeters)) {
				return {
					kind: 'unsupported',
					code: 'missing-support-facts',
					message: `Compiled room-floor record "${polygon.id}" carries fewer than three boundary points but reaches the queried point, so this query cannot report an honest support set.`
				};
			}
			continue;
		}
		if (polygonContainsWithTolerance(point, polygon.polygon)) containing.push(polygon);
	}
	if (containing.length === 0) return { kind: 'none' };

	const roomByRoomId = new Map(snapshot.rooms.map((room) => [room.roomId, room]));
	const floorByFloorId = new Map(snapshot.floors.map((floor) => [floor.floorId, floor]));
	const elevationByRoomId = new Map<string, number>();
	const witnessByKey = new Map<string, FloorSupportWitness>();

	for (const polygon of containing) {
		if (polygon.roomId === undefined || polygon.floorId === undefined) {
			return {
				kind: 'unsupported',
				code: 'missing-support-facts',
				message: `Compiled room-floor record "${polygon.id}" names no ${polygon.roomId === undefined ? 'Room' : 'floor'} owner, so its support cannot be qualified.`
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
		const floor = floorByFloorId.get(polygon.floorId);
		if (floor === undefined || !Number.isFinite(floor.elevation)) {
			return {
				kind: 'unsupported',
				code: 'missing-support-facts',
				message: `Compiled room-floor record "${polygon.id}" has no compiled floor with a finite datum for floor "${polygon.floorId}".`
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
		const known = elevationByRoomId.get(polygon.roomId);
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
		elevationByRoomId.set(polygon.roomId, room.floorElevation);

		// The ordering key is the compiled **source** identity first (the plan's own
		// "ordering by source ID"), with the Room id as its deterministic tie-break: two
		// Rooms may share one floor source, and neither key ever encodes an elevation.
		const orderKey = geometryId([polygon.sourceId, polygon.roomId]);
		const witnessKey = geometryId([polygon.floorId, polygon.roomId, polygon.id]);
		if (!witnessByKey.has(witnessKey)) {
			witnessByKey.set(witnessKey, {
				floorId: polygon.floorId,
				roomId: polygon.roomId,
				recordId: polygon.id,
				cacheKey: polygon.cacheKey,
				sourceId: polygon.sourceId,
				orderKey
			});
		}
	}

	// Source-ID ordering is the only ordering here, and it never picks an
	// elevation: grouping below merges only supports the tolerance declares equal.
	const witnesses = [...witnessByKey.values()].sort(compareByOrderKey);
	const buckets: Array<{ elevation: number; witnesses: FloorSupportWitness[] }> = [];
	for (const witness of witnesses) {
		const elevation = elevationByRoomId.get(witness.roomId)!;
		const bucket = buckets.find(
			(candidate) =>
				Math.abs(candidate.elevation - elevation) <=
				FLOOR_SUPPORT_TOLERANCES.coplanarElevationMeters
		);
		if (bucket === undefined) buckets.push({ elevation, witnesses: [witness] });
		else bucket.witnesses.push(witness);
	}

	const candidates: FloorSupportCandidate[] = buckets
		.map((bucket) => {
			const first = bucket.witnesses[0]!;
			return {
				elevation: bucket.elevation,
				upNormal: [FLOOR_SUPPORT_UP_NORMAL[0], FLOOR_SUPPORT_UP_NORMAL[1], FLOOR_SUPPORT_UP_NORMAL[2]] as Vec3,
				generationId: input.generationId,
				witnesses: bucket.witnesses,
				orderKey: first.orderKey,
				label: `Floor ${first.floorId} / Room ${first.roomId}`
			};
		})
		.sort(compareByOrderKey);

	return { kind: 'candidates', candidates };
}

/** An explicit creator choice, by ordering key or by elevation. */
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

function compareByOrderKey(
	left: Pick<FloorSupportWitness, 'orderKey'>,
	right: Pick<FloorSupportWitness, 'orderKey'>
): number {
	return left.orderKey < right.orderKey ? -1 : left.orderKey > right.orderKey ? 1 : 0;
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

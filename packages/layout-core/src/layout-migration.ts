/**
 * `layout-migration.ts` — P23.0b legacy → wall-first Layout migration.
 *
 * Implements the P23.0 "Full Project migration" pipeline for the Layout
 * document:
 *
 * ```text
 * validated legacy Layout (decoded by the legacy codec upstream)
 * → multi-floor / curve guard (compatibility, never silent normalization)
 * → cluster segment endpoints into Junctions (exact equality first, then
 *   H5's sanctioned conversion equivalence within the geometry epsilon)
 * → derive T/X/collinear-partial-overlap nodes on RAW Room-owned segments
 *   (stems reuse their exact endpoint junctions; overlap interval endpoints
 *   share one allocated junction between both walls; openings rebase by
 *   meter offset; straddled openings reject → compatibility path)
 * → dedupe post-noded fragments by Junction pair + thickness + opening set
 *   (conflicting coincident records reject → compatibility, never merged)
 * → extract candidate faces + reconcile persistent Rooms (H5 witness
 *   correspondence) → one wall-first document + full lineage report
 * ```
 *
 * Noding must precede dedupe because partial adjacency (a room butting into
 * part of another room's wall) is expressed in legacy data as collinear
 * overlapping segments; splitting both at the overlap interval endpoints
 * first lets the coincident fragment collapse into one shared Wall while the
 * remainders stay distinct. Dedupe must follow noding because equality of
 * Junction pairs is only visible after splits.
 *
 * Non-negotiables (P23.0 plan):
 * - lossless migration never flattens legacy curves (auto-bezier rejects);
 * - conflicting coincident walls/openings reject migration so the project
 *   stays on the read-only compatibility path instead of being normalized;
 * - every allocation is deterministic from sorted qualified source keys —
 *   never coordinates, traversal order, timestamps or randomness (H5 §4.5);
 * - wall-first Walls are migrated from the legacy storey height
 *   (`height: floor.height`) because the legacy schema has no independent wall
 *   height (H5: floor elevation/height are floor-level properties); P23.6I then
 *   drops `floor.height` from the canonical Floor, because the value has
 *   completed its conversion and the current model has no Floor scalar.
 */
import type { LayoutDocument, LayoutObject, LayoutVec2 } from './layout-types';
import type {
	LayoutDocumentWallFirst,
	LayoutJunction,
	LayoutWall,
	LayoutWallOpening,
	LayoutWallFirstFloor,
	LayoutWallFirstRoom
} from './layout-wall-first-types';
import { LAYOUT_WALL_FIRST_FORMAT_VERSION } from './layout-wall-first-types';
import { classifyWallIntersection } from './layout-wall-topology';
import { validateWallFirstPortalRelations } from './layout-portals';
import { planWallSplitAtPoint, type NodingIdAllocator } from './layout-wall-noding';
import {
	extractBoundaryCandidateFaces,
	pointStrictlyInsidePolygon
} from './layout-face-extraction';
import {
	reconcileRooms,
	type ComponentLineage,
	type RoomIdAllocator,
	type RoomLineageRecord
} from './layout-room-reconciliation';
import { validateWallFirstLayoutDocument } from './layout-wall-first-codec';

/** Legacy floor as accepted from the codec (validated upstream). */
type LegacyFloor = LayoutDocument['floors'][number];
type LegacyRoom = LegacyFloor['rooms'][number];
type LegacyOpening = LegacyRoom['openings'][number];

export type LayoutMigrationIssue = {
	path: string;
	code: string;
	message: string;
	targetId?: string;
};

export type MigrationRejectionCode =
	| 'multi-floor-unsupported'
	| 'curve-unsupported'
	| 'open-room-boundary'
	| 'node-derivation-rejected'
	| 'conflicting-coincident-walls'
	| 'room-reconciliation-rejected'
	| 'candidate-validation-failed';

export type LegacyWallLineageRecord = {
	/** Qualified legacy segment key: `${roomId}.${segmentId}`. */
	sourceKey: string;
	/** All qualified legacy segment keys that contributed to this Wall. */
	contributorKeys: readonly string[];
	targetWallId: string;
};

export type LegacyOpeningLineageRecord = {
	sourceOpeningKey: string;
	targetOpeningId: string;
};

export type LegacyRoomLineageRecord = {
	sourceRoomId: string;
	targetRoomId: string;
};

export type LegacyLayoutMigrationReport = {
	wallLineage: readonly LegacyWallLineageRecord[];
	openingLineage: readonly LegacyOpeningLineageRecord[];
	/** Legacy Room → surviving wall-first Room (merges map to the survivor). */
	roomLineage: readonly LegacyRoomLineageRecord[];
	retiredRoomIds: readonly string[];
	/** Non-blocking conversion diagnostics (e.g. deduped coincident walls). */
	diagnostics: readonly LayoutMigrationIssue[];
};

export type LegacyLayoutMigrationSuccess = {
	kind: 'success';
	document: LayoutDocumentWallFirst;
	report: LegacyLayoutMigrationReport;
};

export type LegacyLayoutMigrationRejection = {
	kind: 'rejected';
	code: MigrationRejectionCode;
	issues: LayoutMigrationIssue[];
};

export type LegacyLayoutMigrationResult =
	| LegacyLayoutMigrationSuccess
	| LegacyLayoutMigrationRejection;

const EQUIVALENCE_EPSILON = 1e-6;

/** Qualified key for one legacy segment (`${roomId}.${segmentId}`). */
function segmentKey(roomId: string, segmentId: string): string {
	return `${roomId}.${segmentId}`;
}

/** Qualified key for one legacy opening. */
function openingKey(roomId: string, openingId: string): string {
	return `${roomId}.${openingId}`;
}

/** Deterministic collision-free ID from a seed (H5 §4.5); never coordinate-derived. */
function allocateId(taken: ReadonlySet<string>, seed: string): string {
	if (!taken.has(seed)) return seed;
	let index = 2;
	while (taken.has(`${seed}.${index}`)) index += 1;
	return `${seed}.${index}`;
}

const nodingAllocator: NodingIdAllocator = {
	nextWallId(baseDocument, seed) {
		return allocateId(new Set(baseDocument.walls.map((wall) => wall.id)), `${seed}.b`);
	},
	nextJunctionId(baseDocument, seed) {
		return allocateId(new Set(baseDocument.junctions.map((junction) => junction.id)), seed);
	}
};

const roomAllocator: RoomIdAllocator = {
	nextRoomId(baseDocument, faceKey) {
		const taken = new Set(baseDocument.rooms.map((room) => room.id));
		// Face keys are ephemeral topology tokens (they embed '|' separators),
		// so sanitize the seed into the codec's ID charset.
		const seed = `migration.room.${faceKey.replace(/[^A-Za-z0-9._:-]+/g, '-')}`;
		return allocateId(taken, seed);
	},
	nextRoomName(existingNames) {
		// Extends the current `Draft Room N` convention (H5 §"room naming").
		const taken = new Set(existingNames);
		let index = 1;
		while (taken.has(`Draft Room ${index}`)) index += 1;
		return `Draft Room ${index}`;
	}
};

function pointEquals(a: LayoutVec2, b: LayoutVec2): boolean {
	return a[0] === b[0] && a[1] === b[1];
}

function pointsNear(a: LayoutVec2, b: LayoutVec2): boolean {
	return (
		Math.abs(a[0] - b[0]) <= EQUIVALENCE_EPSILON &&
		Math.abs(a[1] - b[1]) <= EQUIVALENCE_EPSILON
	);
}

/**
 * Migrate a validated legacy Layout document to the wall-first schema.
 *
 * The input must already be codec-valid legacy (`LayoutDocument`); rejection
 * here is reserved for documents whose meaning the wall-first minimum cannot
 * represent exactly (multi-floor, curves, conflicting coincident records,
 * unresolvable node topology) — those belong on the read-only compatibility
 * path, never normalized away.
 */
export function migrateLegacyLayoutDocument(
	document: LayoutDocument
): LegacyLayoutMigrationResult {
	if (document.floors.length > 1) {
		return rejected('multi-floor-unsupported', [
			{
				path: '$.floors',
				code: 'multi_floor_unsupported',
				message: `Legacy document has ${document.floors.length} floors; multi-floor topology is outside the P23 wall-first minimum and stays on the compatibility path`
			}
		]);
	}
	const floor = document.floors[0];
	if (!floor) {
		return rejected('multi-floor-unsupported', [
			{ path: '$.floors', code: 'missing_floor', message: 'Legacy document has no floor to migrate' }
		]);
	}
	for (const [roomIndex, room] of floor.rooms.entries()) {
		for (const [segmentIndex, segment] of room.boundary.segments.entries()) {
			if (segment.kind === 'auto-bezier') {
				return rejected('curve-unsupported', [
					{
						path: `$.floors[0].rooms[${roomIndex}].boundary.segments[${segmentIndex}]`,
						code: 'curve_unsupported',
						message: `Legacy curved boundary '${segment.id}' cannot be represented exactly by the wall-first straight-Wall schema; flattening is never a lossless migration`,
						targetId: segment.id
					}
				]);
			}
		}
	}

	const diagnostics: LayoutMigrationIssue[] = [];

	// --- 1. endpoint clustering → junctions --------------------------------
	const cluster = buildJunctionClusters(floor);
	if (cluster.kind === 'rejected') return cluster;

	// --- 2. raw per-segment walls (identity = legacy segment) ---------------
	const raw = buildRawWalls(floor, cluster.junctionIdOf);
	if (raw.kind === 'rejected') return raw;

	// --- 3. node derivation on raw segments (T / X / partial overlap) -------
	const noded = deriveNodes(raw.walls, cluster.junctions, diagnostics);
	if (noded.kind === 'rejected') return noded;

	// --- 4. dedupe post-noded fragments into canonical Walls ----------------
	const dedupe = dedupeFragments(noded.junctions, noded.walls, floor, diagnostics);
	if (dedupe.kind === 'rejected') return dedupe;

	// --- 5. faces + Room reconciliation -------------------------------------
	const roomsResult = reconcileFaces(dedupe.document, floor);
	if (roomsResult.kind === 'rejected') return roomsResult;

	// --- 6. object roomId remap (merge → survivor; disappearance → clear) ---
	const survivorOf = buildSurvivorMap(roomsResult.lineage);
	const objects = document.objects.map((object) => {
		if (!object.roomId) return object;
		const survivor = survivorOf.get(object.roomId);
		if (survivor === undefined) {
			// Associated Room disappeared: clear the association, never the
			// object (P23.0 Layout-object semantics).
			const next: LayoutObject = { ...object };
			delete (next as Partial<LayoutObject>).roomId;
			return next;
		}
		return survivor === object.roomId ? object : { ...object, roomId: survivor };
	});
	const finalDocument: LayoutDocumentWallFirst = { ...roomsResult.document, objects };

	// --- 7. defensive strict validation of the candidate --------------------
	const issues = validateCandidate(finalDocument);
	if (issues.length > 0) {
		return rejected('candidate-validation-failed', issues);
	}

	// --- 8. carried portal relations: non-blocking adjacency diagnostic -----
	// Legacy relations migrate verbatim (never silently cleared) so old
	// projects stay readable; a relation that violates the strict new-schema
	// adjacency contract is diagnosed here and blocks new-schema Save later
	// (P23.0 portal Save-blocker), instead of failing this migration. Path
	// scheme matches the Save gate (`$.openings[<index>].connectsRoomIds`).
	for (const portal of validateWallFirstPortalRelations(finalDocument)) {
		diagnostics.push({
			path: portal.path,
			code: portal.code,
			message: `Carried legacy portal relation: ${portal.message}`,
			targetId: portal.openingId
		});
	}

	return {
		kind: 'success',
		document: finalDocument,
		report: {
			wallLineage: dedupe.wallLineage,
			openingLineage: dedupe.openingLineage,
			roomLineage: roomsResult.roomLineage,
			retiredRoomIds: roomsResult.retiredRoomIds,
			diagnostics
		}
	};
}

function rejected(
	code: MigrationRejectionCode,
	issues: LayoutMigrationIssue[]
): LegacyLayoutMigrationRejection {
	return { kind: 'rejected', code, issues };
}

// ---------------------------------------------------------------------------
// Junction clustering
// ---------------------------------------------------------------------------

type EndpointRef = { roomKey: string; endpoint: 'start' | 'end' };

type JunctionClusterResult =
	| {
			kind: 'success';
			junctions: LayoutJunction[];
			/** `${segmentKey}:${endpoint}` → junction ID. */
			junctionIdOf: Map<string, string>;
	  }
	| LegacyLayoutMigrationRejection;

/**
 * Cluster segment endpoints into Junctions. Exact equality first; then
 * clusters within the conversion equivalence epsilon merge (sanctioned for
 * schema conversion per H5 — the same tolerance the legacy geometry
 * validation accepts for connected boundaries). Junction IDs derive from the
 * sorted qualified source keys incident at the cluster, never coordinates.
 */
function buildJunctionClusters(floor: LegacyFloor): JunctionClusterResult {
	const byExact = new Map<string, { point: LayoutVec2; refs: EndpointRef[] }>();

	for (const room of floor.rooms) {
		for (const segment of room.boundary.segments) {
			for (const endpoint of ['start', 'end'] as const) {
				const point = segment[endpoint];
				const key = `${point[0]}|${point[1]}`;
				const entry = byExact.get(key) ?? { point: [...point] as LayoutVec2, refs: [] };
				entry.refs.push({ roomKey: segmentKey(room.id, segment.id), endpoint });
				byExact.set(key, entry);
			}
		}
	}

	// Epsilon merge: representatives sorted lexicographically; consecutive
	// clusters within epsilon merge into the first representative.
	const exactEntries = [...byExact.entries()].sort(
		(a, b) => a[1].point[0] - b[1].point[0] || a[1].point[1] - b[1].point[1]
	);
	const merged: Array<{ point: LayoutVec2; refs: EndpointRef[] }> = [];
	for (const [, entry] of exactEntries) {
		const last = merged[merged.length - 1];
		if (last && pointsNear(last.point, entry.point)) {
			last.refs.push(...entry.refs);
			continue;
		}
		merged.push({ point: [...entry.point] as LayoutVec2, refs: [...entry.refs] });
	}

	const junctions: LayoutJunction[] = [];
	const junctionIdOf = new Map<string, string>();
	const takenIds = new Set<string>();
	for (const clusterEntry of merged) {
		const refKeys = clusterEntry.refs.map((ref) => `${ref.roomKey}:${ref.endpoint}`).sort();
		const id = allocateId(takenIds, `migration.junction.${refKeys[0]!}`);
		takenIds.add(id);
		junctions.push({ id, point: clusterEntry.point });
		for (const ref of clusterEntry.refs) {
			junctionIdOf.set(`${ref.roomKey}:${ref.endpoint}`, id);
		}
	}
	return { kind: 'success', junctions, junctionIdOf };
}

// ---------------------------------------------------------------------------
// Raw per-segment walls
// ---------------------------------------------------------------------------

/** A pre-noding wall carrying one legacy segment's identity and openings. */
type RawWall = {
	/** Temporary migration wall ID (deterministic from the source key). */
	id: string;
	startJunctionId: string;
	endJunctionId: string;
	/** Distances are measured from this junction (the raw segment's start). */
	orientationIsStartJunctionFirst: boolean;
	thickness: number;
	height: number;
	/** Openings measured from the raw segment start. */
	openings: LayoutWallOpening[];
	contributors: readonly string[];
};

type RawWallsResult =
	| { kind: 'success'; walls: RawWall[] }
	| LegacyLayoutMigrationRejection;

function buildRawWalls(floor: LegacyFloor, junctionIdOf: Map<string, string>): RawWallsResult {
	const walls: RawWall[] = [];
	const takenIds = new Set<string>();
	for (const room of floor.rooms) {
		for (const segment of room.boundary.segments) {
			const startId = junctionIdOf.get(`${segmentKey(room.id, segment.id)}:start`);
			const endId = junctionIdOf.get(`${segmentKey(room.id, segment.id)}:end`);
			if (!startId || !endId) {
				return rejected('open-room-boundary', [
					{
						path: `$.floors[0].rooms.${room.id}.boundary.${segment.id}`,
						code: 'unclustered_endpoint',
						message: `Segment '${segment.id}' endpoint has no junction cluster`,
						targetId: segment.id
					}
				]);
			}
			const length = Math.hypot(
				segment.end[0] - segment.start[0],
				segment.end[1] - segment.start[1]
			);
			if (length <= EQUIVALENCE_EPSILON) {
				return rejected('open-room-boundary', [
					{
						path: `$.floors[0].rooms.${room.id}.boundary.${segment.id}`,
						code: 'zero_length_segment',
						message: `Segment '${segment.id}' has no length and cannot become a Wall`,
						targetId: segment.id
					}
				]);
			}
			const id = allocateId(takenIds, `migration.wall.${segmentKey(room.id, segment.id)}`);
			takenIds.add(id);
			walls.push({
				id,
				startJunctionId: startId,
				endJunctionId: endId,
				orientationIsStartJunctionFirst: true,
				thickness: room.wallThickness,
				height: floor.height,
				openings: room.openings
					.filter((opening) => opening.segmentId === segment.id)
					.map((opening) => ({
						id: opening.id,
						wallId: id,
						kind: opening.kind,
						offset: opening.offset,
						width: opening.width,
						height: opening.height,
						sillHeight: opening.sillHeight,
						profile: opening.profile,
						...(opening.connectsRoomIds ? { connectsRoomIds: [...opening.connectsRoomIds] as [string, string] } : {})
					})),
				contributors: [segmentKey(room.id, segment.id)]
			});
		}
	}
	return { kind: 'success', walls };
}

// ---------------------------------------------------------------------------
// Node derivation (works on RawWalls; mutations flow through noding plans)
// ---------------------------------------------------------------------------

type NodeEvent = {
	/** Raw wall ID the distance is measured along (from its start junction). */
	wallId: string;
	/** Meters from that wall's start junction to the node. */
	distance: number;
	/** Exact node coordinate (validated by the classifier). */
	point: LayoutVec2;
	/** Existing junction to reuse (T stems). */
	existingJunctionId?: string;
	/** Shared junction for an overlap/X node pair (inserted by the first split). */
	sharedJunctionId?: string;
};

type NodingResult =
	| { kind: 'success'; junctions: LayoutJunction[]; walls: RawWall[] }
	| LegacyLayoutMigrationRejection;

function junctionPointOf(junctions: readonly LayoutJunction[], junctionId: string): LayoutVec2 {
	return junctions.find((junction) => junction.id === junctionId)!.point;
}

function rawSpanLength(junctions: readonly LayoutJunction[], wall: RawWall): number {
	const start = junctionPointOf(junctions, wall.startJunctionId);
	const end = junctionPointOf(junctions, wall.endJunctionId);
	return Math.hypot(end[0] - start[0], end[1] - start[1]);
}

/**
 * Classify every raw wall pair and turn outcomes into node events:
 *
 * - `endpoint-on-interior` (T): the host splits at the stem's endpoint
 *   junction (reused, never reallocated);
 * - `proper-crossing` (X): one shared junction, both walls split against it;
 * - `collinear-overlap`: exact segment equality is a duplicate (no node);
 *   a partial overlap splits **both** walls at the overlap interval
 *   endpoints, with one shared junction per endpoint so the coincident
 *   fragment collapses in dedupe;
 * - `collinear-endpoint-touch` creates no connectivity (H3) and is skipped.
 */
function deriveNodes(
	walls: readonly RawWall[],
	junctions: readonly LayoutJunction[],
	_diagnostics: LayoutMigrationIssue[]
): NodingResult {
	const eventsByWall = new Map<string, NodeEvent[]>();
	const rejection = (issue: LayoutMigrationIssue) => rejected('node-derivation-rejected', [issue]);

	const recordEvent = (event: NodeEvent) => {
		const events = eventsByWall.get(event.wallId) ?? [];
		events.push(event);
		eventsByWall.set(event.wallId, events);
	};

	for (let first = 0; first < walls.length; first += 1) {
		for (let second = first + 1; second < walls.length; second += 1) {
			const a = walls[first]!;
			const b = walls[second]!;
			const sharedJunctionIds = [a.startJunctionId, a.endJunctionId].filter(
				(id) => id === b.startJunctionId || id === b.endJunctionId
			);
			const classification = classifyWallIntersection(
				{
					id: a.id,
					start: junctionPointOf(junctions, a.startJunctionId),
					end: junctionPointOf(junctions, a.endJunctionId)
				},
				{
					id: b.id,
					start: junctionPointOf(junctions, b.startJunctionId),
					end: junctionPointOf(junctions, b.endJunctionId)
				},
				sharedJunctionIds
			);
			switch (classification.kind) {
				case 'none':
				case 'shared-explicit-junction':
				case 'collinear-endpoint-touch':
					continue;
				case 'endpoint-on-interior': {
					const stemId = classification.endpointWallId;
					const hostId = classification.interiorWallId;
					const stem = walls.find((candidate) => candidate.id === stemId)!;
					const stemStart = junctionPointOf(junctions, stem.startJunctionId);
					const stemEnd = junctionPointOf(junctions, stem.endJunctionId);
					const stemEndpointId = pointEquals(stemStart, classification.point)
						? stem.startJunctionId
						: pointEquals(stemEnd, classification.point)
							? stem.endJunctionId
							: undefined;
					if (!stemEndpointId) {
						return rejection({
							path: '$.walls',
							code: 'stem_junction_unresolved',
							message: `T stem '${stemId}' endpoint junction could not be resolved at the node point`,
							targetId: stemId
						});
					}
					const hostStart = junctionPointOf(
						junctions,
						walls.find((candidate) => candidate.id === hostId)!.startJunctionId
					);
					recordEvent({
						wallId: hostId,
						distance: Math.hypot(
							classification.point[0] - hostStart[0],
							classification.point[1] - hostStart[1]
						),
						point: [...classification.point] as LayoutVec2,
						existingJunctionId: stemEndpointId
					});
					continue;
				}
				case 'proper-crossing': {
					const sharedId = allocateId(
						new Set(junctions.map((junction) => junction.id)),
						`migration.junction.crossing.${[a.id, b.id].sort().join('.and.')}`
					);
					const point = [...classification.point] as LayoutVec2;
					for (const wall of [a, b]) {
						const start = junctionPointOf(junctions, wall.startJunctionId);
						recordEvent({
							wallId: wall.id,
							distance: Math.hypot(point[0] - start[0], point[1] - start[1]),
							point: [...point] as LayoutVec2,
							sharedJunctionId: sharedId
						});
					}
					continue;
				}
				case 'collinear-overlap': {
					const overlapStart = classification.start;
					const overlapEnd = classification.end;
					// Exact duplicate (same segment, either orientation): no node;
					// dedupe collapses the pair after noding.
					const aStart = junctionPointOf(junctions, a.startJunctionId);
					const aEnd = junctionPointOf(junctions, a.endJunctionId);
					const exactDuplicate =
						(pointEquals(overlapStart, aStart) && pointEquals(overlapEnd, aEnd)) ||
						(pointEquals(overlapStart, aEnd) && pointEquals(overlapEnd, aStart));
					if (exactDuplicate) continue;
					// Partial overlap: split both walls at both interval endpoints,
					// sharing one junction per endpoint.
					for (const endpoint of [overlapStart, overlapEnd] as const) {
						const sharedId = allocateId(
							new Set(junctions.map((junction) => junction.id)),
							`migration.junction.overlap.${[a.id, b.id].sort().join('.and.')}.${
								endpoint === overlapStart ? 's' : 'e'
							}`
						);
						for (const wall of [a, b]) {
							const start = junctionPointOf(junctions, wall.startJunctionId);
							const end = junctionPointOf(junctions, wall.endJunctionId);
							const span = Math.hypot(end[0] - start[0], end[1] - start[1]);
							const distance = Math.hypot(endpoint[0] - start[0], endpoint[1] - start[1]);
							if (distance <= EQUIVALENCE_EPSILON || distance >= span - EQUIVALENCE_EPSILON) {
								// The endpoint coincides with this wall's own endpoint —
								// no split needed on this wall.
								continue;
							}
							recordEvent({
								wallId: wall.id,
								distance,
								point: [...endpoint] as LayoutVec2,
								sharedJunctionId: sharedId
							});
						}
					}
					continue;
				}
				case 'invalid':
					return rejection({
						path: '$.walls',
						code: 'invalid_wall_pair',
						message: `Wall pair '${a.id}'/'${b.id}' could not be classified: ${classification.reason}`,
						targetId: a.id
					});
			}
		}
	}

	// Apply events per wall in ascending distance order.
	const nextJunctions = [...junctions];
	const nextWalls: RawWall[] = [];
	const finalWallsById = new Map<string, RawWall[]>();
	for (const wall of walls) finalWallsById.set(wall.id, [wall]);

	for (const originalWallId of [...eventsByWall.keys()].sort()) {
		const events = eventsByWall.get(originalWallId)!.sort((x, y) => x.distance - y.distance);
		let currentWallId = originalWallId;
		let offset = 0;
		for (const event of events) {
			const currentWalls = finalWallsById.get(currentWallId) ?? [];
			const current = currentWalls[currentWalls.length - 1];
			if (!current) {
				return rejection({
					path: '$.walls',
					code: 'noding_wall_missing',
					message: `Node event references missing wall '${currentWallId}'`,
					targetId: currentWallId
				});
			}
			const span = rawSpanLength(nextJunctions, current);
			const effectiveDistance = event.distance - offset;
			if (effectiveDistance <= EQUIVALENCE_EPSILON || effectiveDistance >= span - EQUIVALENCE_EPSILON) {
				// Node coincides with an endpoint junction — no split needed.
				continue;
			}
			const plan = planWallSplitAtPoint(
				toNodingDocument(nextJunctions, allCurrentWalls(finalWallsById)),
				currentWallId,
				effectiveDistance,
				event.point,
				nodingAllocator,
				event.existingJunctionId
					? { existingJunctionId: event.existingJunctionId }
					: { existingJunctionId: event.sharedJunctionId! }
			);
			if (plan.kind === 'rejected') {
				if (plan.rejection.code === 'split_through_opening_interior') {
					return rejection({
						path: '$.openings',
						code: 'node_through_opening_interior',
						message: `Node derivation on wall '${currentWallId}' passes through an opening interior: ${plan.rejection.message}`,
						targetId: currentWallId
					});
				}
				return rejection({
					path: '$.walls',
					code: `noding_${plan.rejection.code}`,
					message: `Node derivation rejected on wall '${currentWallId}': ${plan.rejection.message}`,
					targetId: currentWallId
				});
			}
			// The plan split `currentWallId` into [current (retained), new]. The
			// retained fragment keeps its openings rebased by the planner; the
			// continuation starts at the node point.
			nextJunctions.length = 0;
			nextJunctions.push(...plan.document.junctions);
			const retained: RawWall = {
				...current,
				endJunctionId: junctionIdAfterSplit(plan, currentWallId),
				openings: plan.document.openings.filter((opening) => opening.wallId === currentWallId)
			};
			const continuationRawId = plan.createdWallIds[0]!;
			const continuation: RawWall = {
				...current,
				id: continuationRawId,
				startJunctionId: retained.endJunctionId,
				openings: plan.document.openings.filter((opening) => opening.wallId === continuationRawId)
			};
			finalWallsById.set(currentWallId, [retained]);
			finalWallsById.set(continuationRawId, [continuation]);
			currentWallId = continuationRawId;
			offset = event.distance;
		}
	}
	for (const fragmentGroup of finalWallsById.values()) nextWalls.push(...fragmentGroup);
	return { kind: 'success', junctions: nextJunctions, walls: nextWalls };
}

function junctionIdAfterSplit(
	plan: Extract<ReturnType<typeof planWallSplitAtPoint>, { kind: 'success' }>,
	_splitWallId: string
): string {
	// The plan's junction sits at the split point; the retained fragment ends
	// there and the continuation starts there.
	return plan.junctionId;
}

function allCurrentWalls(groups: Map<string, RawWall[]>): RawWall[] {
	const all: RawWall[] = [];
	for (const group of groups.values()) all.push(...group);
	return all;
}

/** Adapter: raw walls + junctions as a noding-plan input document. */
function toNodingDocument(
	junctions: readonly LayoutJunction[],
	walls: readonly RawWall[]
): LayoutDocumentWallFirst {
	return {
		units: 'meters',
		formatVersion: LAYOUT_WALL_FIRST_FORMAT_VERSION,
		// Placeholder datum for the noding-plan input only; the migrated Floor is
		// built separately and never inherits this record.
		floor: { id: 'floor', name: 'Floor', elevation: 0 },
		junctions: [...junctions],
		walls: walls.map((wall) => ({
			id: wall.id,
			startJunctionId: wall.startJunctionId,
			endJunctionId: wall.endJunctionId,
			role: 'boundary' as const,
			thickness: wall.thickness,
			height: wall.height
		})),
		rooms: [],
		openings: walls.flatMap((wall) => wall.openings),
		objects: []
	};
}

// ---------------------------------------------------------------------------
// Fragment dedupe → canonical Walls
// ---------------------------------------------------------------------------

type DedupeResult =
	| {
			kind: 'success';
			document: LayoutDocumentWallFirst;
			wallLineage: readonly LegacyWallLineageRecord[];
			openingLineage: readonly LegacyOpeningLineageRecord[];
	  }
	| LegacyLayoutMigrationRejection;

/**
 * Collapse post-noded fragments that share an unordered Junction pair into
 * one canonical Wall — but only when thickness and the full opening set
 * (after orientation normalization) agree. Conflicts reject migration so the
 * project stays on the read-only compatibility path (P23.0 "Conflicting
 * coincident walls"). Canonical orientation: lexicographically smaller
 * Junction ID is the Wall start; openings mirror when reversed.
 */
function dedupeFragments(
	junctions: readonly LayoutJunction[],
	fragments: readonly RawWall[],
	floor: LegacyFloor,
	diagnostics: LayoutMigrationIssue[]
): DedupeResult {
	const pointById = new Map(junctions.map((junction) => [junction.id, junction.point]));
	const byPair = new Map<string, RawWall[]>();
	for (const fragment of fragments) {
		const pairKey = [fragment.startJunctionId, fragment.endJunctionId].sort().join('\u0000');
		const group = byPair.get(pairKey) ?? [];
		group.push(fragment);
		byPair.set(pairKey, group);
	}

	const wallLineage: LegacyWallLineageRecord[] = [];
	const openingLineage: LegacyOpeningLineageRecord[] = [];
	const finalWalls: LayoutWall[] = [];
	const finalOpenings: LayoutWallOpening[] = [];
	const takenIds = new Set<string>();
	const finalWallIdOfFragment = new Map<string, string>();

	const sortedPairs = [...byPair.entries()].sort((a, b) => a[0].localeCompare(b[0]));
	for (const [, group] of sortedPairs) {
		// Canonical orientation from the first member; every other member must
		// match after mirroring.
		const canonical = group[0]!;
		const canonicalStart = canonical.startJunctionId <= canonical.endJunctionId
			? canonical.startJunctionId
			: canonical.endJunctionId;
		const canonicalEnd = canonicalStart === canonical.startJunctionId
			? canonical.endJunctionId
			: canonical.startJunctionId;
		const span = Math.hypot(
			pointById.get(canonicalEnd)![0] - pointById.get(canonicalStart)![0],
			pointById.get(canonicalEnd)![1] - pointById.get(canonicalStart)![1]
		);
		const canonicalOpenings = canonical.openings.map((opening) =>
			canonical.startJunctionId === canonicalStart
				? opening
				: mirrorOpeningRecord(opening, span)
		);
		for (const member of group.slice(1)) {
			const memberSpan = Math.hypot(
				pointById.get(member.endJunctionId)![0] - pointById.get(member.startJunctionId)![0],
				pointById.get(member.endJunctionId)![1] - pointById.get(member.startJunctionId)![1]
			);
			const memberOpenings = member.openings.map((opening) =>
				member.startJunctionId === canonicalStart
					? opening
					: mirrorOpeningRecord(opening, memberSpan)
			);
			if (member.thickness !== canonical.thickness || !openingSetsEqual(canonicalOpenings, memberOpenings)) {
				return rejected('conflicting-coincident-walls', [
					{
						path: '$.walls',
						code: 'conflicting_coincident_walls',
						message: `Coincident legacy segments '${member.contributors[0]}' and '${canonical.contributors[0]}' disagree on thickness or openings; keeping both would not be a lossless wall-first representation`,
						targetId: member.id
					}
				]);
			}
			// Mirrored duplicates whose openings differ from the canonical set
			// only by mirrored offset position are conflicts too (covered above).
			if (memberSpan <= EQUIVALENCE_EPSILON) {
				return rejected('conflicting-coincident-walls', [
					{
						path: '$.walls',
						code: 'conflicting_coincident_walls',
						message: `Coincident fragment '${member.contributors[0]}' collapsed to zero length`,
						targetId: member.id
					}
				]);
			}
		}

		const contributorKeys = [
			...new Set(group.flatMap((member) => [...member.contributors]))
		].sort();
		const wallId = allocateId(takenIds, `migration.wall.${contributorKeys[0]!}`);
		takenIds.add(wallId);
		finalWalls.push({
			id: wallId,
			startJunctionId: canonicalStart,
			endJunctionId: canonicalEnd,
			role: 'boundary',
			thickness: canonical.thickness,
			height: floor.height
		});
		for (const member of group) finalWallIdOfFragment.set(member.id, wallId);
		wallLineage.push({
			sourceKey: contributorKeys[0]!,
			contributorKeys,
			targetWallId: wallId
		});
		if (group.length > 1) {
			diagnostics.push({
				path: '$.walls',
				code: 'coincident_wall_deduped',
				message: `Coincident legacy segments ${contributorKeys.map((key) => `'${key}'`).join(', ')} deduped into Wall '${wallId}'`,
				targetId: wallId
			});
		}
		// Canonical openings get document-global IDs from sorted source keys.
		// Opening IDs survive noding rebasing, so `opening.id` is still the
		// legacy opening ID here; the qualified source key joins the authoring
		// room from the segment key (`${roomId}.${segmentId}`, room is
		// everything before the final dot) with the bare opening ID. Every
		// deduped coincident member's physically identical opening maps to the
		// same target so provenance stays complete (H5 lossless lineage).
		const sortedOpenings = [...canonicalOpenings].sort((a, b) => a.id.localeCompare(b.id));
		for (const opening of sortedOpenings) {
			const globalId = allocateId(takenIds, `migration.opening.${opening.id}`);
			takenIds.add(globalId);
			finalOpenings.push({
				...opening,
				id: globalId,
				wallId
			});
			for (const member of group) {
				const memberKey = member.contributors[0]!;
				const memberRoomId = memberKey.slice(0, memberKey.lastIndexOf('.'));
				const memberStart = pointById.get(
					member.startJunctionId <= member.endJunctionId
						? member.startJunctionId
						: member.endJunctionId
				)!;
				const memberEnd = pointById.get(
					member.startJunctionId <= member.endJunctionId
						? member.endJunctionId
						: member.startJunctionId
				)!;
				const memberSpan = Math.hypot(memberEnd[0] - memberStart[0], memberEnd[1] - memberStart[1]);
				const memberCanonicalStart =
					member.startJunctionId <= member.endJunctionId
						? member.startJunctionId
						: member.endJunctionId;
				const mirroredMemberOpenings = member.openings.map((candidate) =>
					member.startJunctionId === memberCanonicalStart
						? candidate
						: mirrorOpeningRecord(candidate, memberSpan)
				);
				const memberSource = mirroredMemberOpenings.find((candidate) =>
					openingRecordEquals(candidate, opening)
				);
				if (memberSource) {
					openingLineage.push({
						sourceOpeningKey: `${memberRoomId}.${memberSource.id}`,
						targetOpeningId: globalId
					});
				}
			}
		}
	}

	openingLineage.sort((a, b) => a.sourceOpeningKey.localeCompare(b.sourceOpeningKey));
	finalWalls.sort((a, b) => a.id.localeCompare(b.id));
	finalOpenings.sort((a, b) => a.id.localeCompare(b.id));

	// P23.6I — the legacy storey height has done its one conversion job: it seeded
	// every migrated Wall's `height` above. The canonical Floor keeps only the
	// datum, so the legacy scalar does not survive as wall-first truth.
	const floorRecord: LayoutWallFirstFloor = {
		id: floor.id,
		name: floor.name,
		elevation: floor.elevation
	};
	const document: LayoutDocumentWallFirst = {
		units: 'meters',
		formatVersion: LAYOUT_WALL_FIRST_FORMAT_VERSION,
		floor: floorRecord,
		junctions: [...junctions].sort((a, b) => a.id.localeCompare(b.id)),
		walls: finalWalls,
		rooms: [],
		openings: finalOpenings,
		objects: []
	};
	void finalWallIdOfFragment;
	return { kind: 'success', document, wallLineage, openingLineage };
}

/** Mirrors an opening record onto the reversed canonical orientation. */
function mirrorOpeningRecord(opening: LayoutWallOpening, length: number): LayoutWallOpening {
	return {
		...opening,
		// H5 §5.2 mirrored-offset rule: o' = L - (o + width).
		offset: length - (opening.offset + opening.width)
	};
}

function openingRecordEquals(opening: LayoutWallOpening, other: LayoutWallOpening): boolean {
	return (
		opening.offset === other.offset &&
		opening.width === other.width &&
		opening.height === other.height &&
		opening.sillHeight === other.sillHeight &&
		opening.profile === other.profile &&
		opening.kind === other.kind &&
		opening.connectsRoomIds?.[0] === other.connectsRoomIds?.[0] &&
		opening.connectsRoomIds?.[1] === other.connectsRoomIds?.[1]
	);
}

function openingSetsEqual(a: readonly LayoutWallOpening[], b: readonly LayoutWallOpening[]): boolean {
	if (a.length !== b.length) return false;
	const remaining = [...b];
	for (const opening of a) {
		const index = remaining.findIndex((other) => openingRecordEquals(opening, other));
		if (index === -1) return false;
		remaining.splice(index, 1);
	}
	return true;
}

// ---------------------------------------------------------------------------
// Faces + Room reconciliation
// ---------------------------------------------------------------------------

type RoomsResult =
	| {
			kind: 'success';
			document: LayoutDocumentWallFirst;
			lineage: readonly RoomLineageRecord[];
			roomLineage: readonly LegacyRoomLineageRecord[];
			retiredRoomIds: readonly string[];
	  }
	| LegacyLayoutMigrationRejection;

function polygonCentroid(points: readonly LayoutVec2[]): LayoutVec2 {
	if (points.length === 0) return [0, 0];
	let twiceArea = 0;
	let x = 0;
	let z = 0;
	for (let index = 0; index < points.length; index += 1) {
		const current = points[index]!;
		const next = points[(index + 1) % points.length]!;
		const cross = current[0] * next[1] - next[0] * current[1];
		twiceArea += cross;
		x += (current[0] + next[0]) * cross;
		z += (current[1] + next[1]) * cross;
	}
	if (Math.abs(twiceArea) <= EQUIVALENCE_EPSILON) {
		return [
			points.reduce((sum, point) => sum + point[0], 0) / points.length,
			points.reduce((sum, point) => sum + point[1], 0) / points.length
		];
	}
	return [x / (3 * twiceArea), z / (3 * twiceArea)];
}

function reconcileFaces(document: LayoutDocumentWallFirst, floor: LegacyFloor): RoomsResult {
	const extraction = extractBoundaryCandidateFaces(document);
	if (extraction.faces.length === 0) {
		return rejected('room-reconciliation-rejected', [
			{
				path: '$.walls',
				code: 'no_candidate_faces',
				message: 'Boundary walls form no closed candidate face; legacy rooms cannot be reconciled',
				...(extraction.diagnostics[0]?.wallId
					? { targetId: extraction.diagnostics[0]!.wallId }
					: {})
			}
		]);
	}

	// Legacy room records become reconciliation predecessors with their real
	// metadata; witnesses/polygons are the pre-migration geometry evidence.
	const predecessorRooms: LayoutWallFirstRoom[] = floor.rooms.map((room) => ({
		id: room.id,
		name: room.name,
		boundary: [],
		floorThickness: room.floorThickness,
		ceilingThickness: room.ceilingThickness
	}));
	const witnesses = new Map<string, LayoutVec2>();
	const polygons = new Map<string, readonly LayoutVec2[]>();
	for (const room of floor.rooms) {
		const polygon = roomPolygon(room);
		polygons.set(room.id, polygon);
		witnesses.set(room.id, polygonCentroid(polygon));
	}

	// Map each candidate face to its predecessor rooms by witness containment
	// (H5 correspondence): a legacy room pre-derives this face exactly when
	// its centroid witness lies strictly inside the face polygon.
	// Wall-contributor identity is deliberately NOT used — a shared wall's
	// contributors name both adjacent rooms and would make every face claim
	// both predecessors.
	const components: ComponentLineage[] = [];
	for (const face of extraction.faces) {
		const predecessorIds = floor.rooms
			.filter((room) => pointStrictlyInsidePolygon(face.polygon, witnesses.get(room.id)!))
			.map((room) => room.id)
			.sort();
		components.push({
			candidateFaceKeys: [face.key],
			predecessorRoomIds: predecessorIds
		});
	}

	const result = reconcileRooms({
		baseline: { ...document, rooms: predecessorRooms },
		candidateDocument: document,
		extraction,
		components,
		predecessorWitnesses: witnesses,
		predecessorPolygons: polygons,
		allocator: roomAllocator
	});
	if ('rejection' in result) {
		return rejected('room-reconciliation-rejected', [
			{
				path: '$.rooms',
				code: `reconciliation_${result.rejection.code}`,
				message: result.rejection.message,
				...(result.rejection.roomIds
					? { targetId: result.rejection.roomIds.join(',') }
					: {})
			}
		]);
	}

	const roomLineage: LegacyRoomLineageRecord[] = [];
	const seenSources = new Set<string>();
	for (const record of result.lineage) {
		for (const predecessorId of record.predecessorRoomIds) {
			if (seenSources.has(predecessorId)) continue;
			seenSources.add(predecessorId);
			roomLineage.push({ sourceRoomId: predecessorId, targetRoomId: record.roomId });
		}
	}
	return {
		kind: 'success',
		document: result.document,
		lineage: result.lineage,
		roomLineage,
		retiredRoomIds: [...result.retiredRoomIds]
	};
}

function roomPolygon(room: LegacyRoom): LayoutVec2[] {
	const polygon: LayoutVec2[] = [];
	for (const segment of room.boundary.segments) {
		// Curves already rejected migration; only line segments remain here.
		polygon.push([...segment.start] as LayoutVec2);
	}
	return polygon;
}

function buildSurvivorMap(lineage: readonly RoomLineageRecord[]): Map<string, string> {
	const survivorOf = new Map<string, string>();
	for (const record of lineage) {
		for (const predecessorId of record.predecessorRoomIds) {
			survivorOf.set(predecessorId, record.roomId);
		}
	}
	return survivorOf;
}

// ---------------------------------------------------------------------------
// Candidate validation
// ---------------------------------------------------------------------------

function validateCandidate(document: LayoutDocumentWallFirst): LayoutMigrationIssue[] {
	// Structural re-validation through the strict codec catches anything the
	// migration assembly missed (duplicate IDs, dangling references, …).
	const result = validateWallFirstLayoutDocument(document);
	return result.success
		? []
		: result.issues.map((issue) => ({
				path: issue.path,
				code: issue.code,
				message: issue.message
			}));
}

/**
 * `layout-wall-chain.ts` — P23.9 wall/partition chain sketch planner.
 *
 * Two authoring surfaces share this engine:
 * - `planWallSegment()` owns continuous Wall/Partition authoring: one
 *   completed straight segment = one Wall command and one Layout
 *   transaction, with continuation driven by canonical Junction identity.
 * - `planWallChain()` (this file's multi-point entry) remains the bounded
 *   Rectangle/Polygon helper: the caller submits the complete draft points
 *   and the planner builds the complete candidate document below, so one
 *   bounded tool commits one atomic history entry.
 *
 * Either way the planner builds the **complete candidate document** through
 * the P23.8 engine — junction reuse by coordinate, endpoint-on-interior T
 * noding, proper-crossing X noding, collinear-overlap rejection, then the
 * canonical validate → reconcile → compile gates — so one bounded tool
 * commits **one** history entry and an invalid candidate commits nothing.
 * Nothing here mutates its inputs.
 *
 * Semantics ratified by the P23.9 plan:
 * - open chains are valid architecture and commit without producing a Room;
 * - `role: 'boundary'` chains invoke P23.8 face extraction and Room
 *   reconciliation (first-enclosure birth, 1→2 divider split, or no-op
 *   preservation per witness correspondence); `role: 'partition'` chains
 *   never touch Rooms;
 * - snapping is a suggestion (the editor resolves coordinates before this
 *   planner runs); committed topology here is explicit;
 * - collinear overlap rejects — no auto-merge/trim;
 * - new-schema data never contains an un-noded visual crossing.
 */
import type {
	LayoutDocumentWallFirst,
	LayoutJunction,
	LayoutWall,
	LayoutWallRole
} from './layout-wall-first-types';
import type { LayoutVec2 } from './layout-types';
import { validateWallFirstLayoutDocument } from './layout-wall-first-codec';
import { compileWallFirstLayoutGeometry } from './layout-geometry';
import { hasBlockingLayoutIssues } from './layout-geometry-validation';
import {
	projectPointToSampledSegment
} from './layout-geometry-curve';
import {
	extractBoundaryCandidateFaces,
	type DerivedCandidateFace,
	type TopologyDiagnostic
} from './layout-face-extraction';
import {
	buildCorrespondenceComponents,
	interiorWitness,
	reconcileRooms,
	roomBoundaryPolygon,
	type ComponentLineage
} from './layout-room-reconciliation';
import { createAuthoringRoomAllocator } from './layout-wall-topology-ops';
import { classifyWallIntersection, type TopologySegment } from './layout-wall-topology';
import { detectWallCurveTopologyCrossings } from './layout-wall-first-precision';
import { WALL_AUTHORING_DEFAULT_HEIGHT, resolveWallBirthHeight } from './layout-wall-heights';
import { planWallCrossing, planWallSplitAtPoint, type NodingIdAllocator } from './layout-wall-noding';
import { wallCenterlineSamples } from './layout-wall-centerline';
import { resolveWallCurveSplit } from './layout-wall-curve-algebra';
import type { LayoutDocumentIssue } from './layout-codec';
import {
	coincidesAsJunction,
	JUNCTION_COINCIDENCE_EPSILON
} from './layout-junction-identity';

/**
 * Chain wall/junction defaults (same as the P23.0 seed helpers).
 *
 * P23.6I removed the Wall-birth height from this table: a new Wall's height comes
 * from `resolveWallBirthHeight()` (the named `WALL_AUTHORING_DEFAULT_HEIGHT` or a
 * deterministic incident-Wall inheritance), so no runtime Wall-birth path may
 * carry a literal height. Thickness stays a fixed sketch default (it is not a
 * vertical quantity).
 */
export const WALL_CHAIN_DEFAULTS = {
	thickness: 0.2
} as const;

/**
 * Identity supplied by the authoring snap resolver for one draft point.
 *
 * This is relationship acquisition, not geometry: a `wall-span` snap names
 * the host Wall explicitly. The noder may then normalize the sampled point to
 * the exact cubic, but it must never turn sampler flatness into a topology
 * radius for an unsnapped endpoint.
 */
export type WallEndpointHostSnap = {
	pointIndex: number;
	wallId: string;
};

/** Why a chain sketch rejected; stable machine codes. */
export type WallChainRejectionCode =
	| 'insufficient_chain'
	| 'non_finite_point'
	| 'zero_length_leg'
	| 'collinear_overlap'
	| 'self_intersecting_chain'
	| 'noding_rejected'
	| 'room_reconciliation_rejected'
	| 'invalid_candidate_document'
	| 'candidate_does_not_compile';

export type WallChainRejection = {
	code: WallChainRejectionCode;
	message: string;
	/** Involved authored IDs where available. */
	wallIds?: string[];
	/** Face-extraction diagnostics that caused the rejection, if any. */
	topology?: readonly TopologyDiagnostic[];
	/** The final canonical gate's issues, when validation rejects. */
	issues?: readonly LayoutDocumentIssue[];
};

export type WallChainPlan =
	| {
			kind: 'success';
			/** Exact committed document — allocated IDs and noded topology included. */
			document: LayoutDocumentWallFirst;
			/** Wall IDs created by the chain (retained split fragments keep their IDs). */
			createdWallIds: string[];
			/**
			 * Authored-segment lineage: the candidate segment's own Walls and
			 * their noding fragments. Pre-existing host fragments split by the
			 * candidate are NOT included (they are host-derived, reported via
			 * `createdWallIds`/`splitWallIds`). Never derive continuation or
			 * status from `createdWallIds` — crossing/noding can turn one
			 * candidate into several fragments.
			 */
			authoredWallIds: string[];
			/** Junction IDs created by the chain or by noding (reused ones excluded). */
			createdJunctionIds: string[];
			/** IDs of pre-existing walls subdivided by T/X noding. */
			splitWallIds: string[];
			/** Canonical resolved start junction of the committed candidate. */
			startJunctionId: string;
			/** Canonical resolved end junction of the committed candidate. */
			endJunctionId: string;
			/** `created` lineage records from the P23.8 reconciliation. */
			lineage: ReadonlyArray<{
				faceKey: string;
				roomId: string;
				kind: 'created';
			}>;
			retiredRoomIds: readonly string[];
	  }
	| {
			kind: 'rejected';
			rejection: WallChainRejection;
	  };

/**
 * Deterministic chain allocator contract. Compatible with the editor's
 * `NodingIdAllocator` shape; when omitted the planner allocates
 * collision-free deterministic IDs from fixed seeds.
 */
export type WallChainIdAllocator = {
	nextWallId(taken: ReadonlySet<string>, seed: string): string;
	nextJunctionId(taken: ReadonlySet<string>, seed: string): string;
};

function defaultChainAllocator(): WallChainIdAllocator {
	const allocate = (taken: ReadonlySet<string>, seed: string): string => {
		if (!taken.has(seed)) return seed;
		let index = 2;
		while (taken.has(`${seed}.${index}`)) index += 1;
		return `${seed}.${index}`;
	};
	return {
		nextWallId: (taken, seed) => allocate(taken, seed),
		nextJunctionId: (taken, seed) => allocate(taken, seed)
	};
}

/**
 * Deep-clone plain layout data for the candidate document.
 *
 * `structuredClone` is NOT usable here: the editor hands this planner a
 * Svelte `$state` proxy, which throws `DataCloneError` (and Node tests with
 * plain objects would never catch it). The wall-first schema is pure JSON
 * data, so a JSON round-trip is lossless apart from `undefined`-valued
 * optional keys, which the codec also omits.
 */
function cloneWallFirstDocument(document: LayoutDocumentWallFirst): LayoutDocumentWallFirst {
	return JSON.parse(JSON.stringify(document)) as LayoutDocumentWallFirst;
}

/**
 * Plan a sketched Wall/Partition chain over `baseline`.
 *
 * `points` are the draft vertices in click order; `close` appends the
 * closing leg back to the first vertex. A final point coinciding with the
 * chain's first junction closes the chain implicitly (the duplicate leg is
 * dropped, so clicking the start point to finish is the same operation as
 * pressing Close).
 */
export function planWallChain(options: {
	/** Pre-operation document; never mutated. */
	baseline: LayoutDocumentWallFirst;
	points: readonly LayoutVec2[];
	close: boolean;
	role: LayoutWallRole;
	thickness?: number;
	height?: number;
	allocator?: WallChainIdAllocator;
	/** Existing authoring snap identities, keyed by draft point index. */
	endpointHostSnaps?: readonly WallEndpointHostSnap[];
}): WallChainPlan {
	const allocator = options.allocator ?? defaultChainAllocator();
	const thickness = options.thickness ?? WALL_CHAIN_DEFAULTS.thickness;
	const reject = (rejection: WallChainRejection): WallChainPlan => ({ kind: 'rejected', rejection });

	// P23.6I birth semantics. `planWallChain` is the **bounded compound** planner
	// (Rectangle/Polygon and explicit multi-point callers): the whole generated
	// chain uses one explicit height or the named authoring default, deliberately
	// with no per-leg or per-vertex inheritance — one gesture must produce one
	// coherent height. Continuous segment-first authoring resolves the birth height
	// from canonical topology in `planWallSegment` (see `resolveWallBirthHeight`)
	// and passes it explicitly, which is why the default lives here rather than a
	// Floor-derived value: the canonical Floor has no vertical extent to inherit.
	const height = options.height ?? WALL_AUTHORING_DEFAULT_HEIGHT;

	// --- draft normalization -------------------------------------------------
	const points = options.points.map((point) => [...point] as LayoutVec2);
	if (points.some((point) => point.some((value) => !Number.isFinite(value)))) {
		return reject({ code: 'non_finite_point', message: 'Chain points must be finite coordinates' });
	}
	const junctionPoints = options.baseline.junctions.map((junction) => ({ id: junction.id, point: junction.point }));
	// Resolve each draft point to an existing junction when it coincides with
	// one (snap is a suggestion; explicit junction reuse is the commit
	// semantic). Reused points adopt the junction's stored coordinate, so a
	// tolerant match still yields exactly one spelling of the node.
	const resolved: Array<{ junctionId: string | null; point: LayoutVec2 }> = points.map((point) => {
		const existing = junctionPoints.find((junction) => coincidesAsJunction(junction.point, point));
		return existing ? { junctionId: existing.id, point: [...existing.point] as LayoutVec2 } : { junctionId: null, point };
	});

	// A final point coinciding with the chain's own first point closes the
	// chain implicitly (the duplicate leg would be zero-length anyway).
	let close = options.close;
	if (!close && resolved.length >= 2) {
		const firstPoint = resolved[0]!.point;
		const lastPoint = resolved.at(-1)!.point;
		if (coincidesAsJunction(firstPoint, lastPoint)) {
			close = true;
			resolved.pop();
		}
	}

	const minPoints = close ? 3 : 2;
	if (resolved.length < minPoints) {
		return reject({
			code: 'insufficient_chain',
			message: close
				? 'A closed chain needs at least three distinct vertices'
				: 'An open chain needs at least two distinct vertices'
		});
	}

	// Chain legs: consecutive resolved points, wrapping when closed.
	const legEndpoints: Array<{ start: { junctionId: string | null; point: LayoutVec2 }; end: { junctionId: string | null; point: LayoutVec2 } }> = [];
	const legCount = close ? resolved.length : resolved.length - 1;
	for (let index = 0; index < legCount; index += 1) {
		const start = resolved[index]!;
		const end = resolved[(index + 1) % resolved.length]!;
		if (coincidesAsJunction(start.point, end.point)) {
			return reject({ code: 'zero_length_leg', message: 'Chain legs must have non-zero length' });
		}
		legEndpoints.push({ start, end });
	}

	// --- self-intersection gate (chain against itself) ----------------------
	// Adjacent legs legitimately share the chain vertex; anything else — a
	// crossing, a T, an overlap, or a collinear self-touch — makes the
	// committed topology ambiguous, so the whole chain rejects.
	for (let first = 0; first < legEndpoints.length; first += 1) {
		for (let second = first + 1; second < legEndpoints.length; second += 1) {
			const a = legEndpoints[first]!;
			const b = legEndpoints[second]!;
			const adjacent = second === first + 1 || (close && first === 0 && second === legEndpoints.length - 1);
			// Linear adjacency shares a.end/b.start; the closing pair shares
			// a.start/b.end (the chain first vertex). IDs are only set for
			// pre-existing junctions here, so coordinate equality guards the test.
			const isWrapPair = close && first === 0 && second === legEndpoints.length - 1;
			const sharedJunctionId = isWrapPair ? a.start.junctionId : a.end.junctionId;
			const sharedPoint = isWrapPair ? a.start.point : a.end.point;
			const otherEndpointId = isWrapPair ? b.end.junctionId : b.start.junctionId;
			const otherPoint = isWrapPair ? b.end.point : b.start.point;
			const shared =
				adjacent &&
				sharedJunctionId !== null &&
				sharedJunctionId === otherEndpointId &&
				coincidesAsJunction(sharedPoint, otherPoint)
					? [sharedJunctionId]
					: [];
			const classified = classifyWallIntersection(
				{ id: `chain:${first}`, start: a.start.point, end: a.end.point },
				{ id: `chain:${second}`, start: b.start.point, end: b.end.point },
				shared
			);
			if (classified.kind === 'collinear-overlap' || classified.kind === 'collinear-endpoint-touch') {
				return reject({
					code: 'collinear_overlap',
					message: 'Chain legs overlap on one line; trim or redraw the overlapping span'
				});
			}
			if (classified.kind === 'proper-crossing' || classified.kind === 'endpoint-on-interior') {
				return reject({ code: 'self_intersecting_chain', message: 'Chain crosses itself; split the sketch into separate chains' });
			}
		}
	}

	// --- candidate construction ---------------------------------------------
	const candidate: LayoutDocumentWallFirst = cloneWallFirstDocument(options.baseline);
	const createdJunctionIds: string[] = [];
	const createdWallIds: string[] = [];

	// Allocate one junction per distinct unresolved chain point (resolved
	// entries carry the IDs forward; legs read them directly).
	resolved.forEach((entry) => {
		if (entry.junctionId) return entry.junctionId;
		const taken = new Set(candidate.junctions.map((junction) => junction.id));
		const id = allocator.nextJunctionId(taken, `junction-chain-${createdJunctionIds.length + 1}`);
		candidate.junctions.push({ id, point: entry.point });
		createdJunctionIds.push(id);
		entry.junctionId = id;
	});

	for (const [index] of legEndpoints.entries()) {
		const startId = resolved[close ? index % resolved.length : index]!.junctionId!;
		const endId = resolved[close ? (index + 1) % resolved.length : index + 1]!.junctionId!;
		const taken = new Set(candidate.walls.map((wall) => wall.id));
		const id = allocator.nextWallId(taken, `wall-chain-${index + 1}`);
		const wall: LayoutWall = {
			id,
			startJunctionId: startId,
			endJunctionId: endId,
			role: options.role,
			thickness,
			height,
			// P23.11 — authored chains are straight; curves arrive only through
			// the canonical curve planners.
			centerline: { kind: 'line' }
		};
		candidate.walls.push(wall);
		createdWallIds.push(id);
	}

	// --- noding against the full candidate graph -----------------------------
	// The chain may T into or cross pre-existing walls (and vice versa). Every
	// un-noded relationship is resolved through the P23.8 noding plans until
	// the graph is clean; distances are always recomputed against the current
	// candidate so a wall already fragmented by an earlier fix stays correct.
	//
	// Provenance: `authoredWallIds` tracks the candidate segment lineage
	// (initial legs plus fragments of authored walls). Host fragments split
	// off pre-existing walls stay host-derived and never enter this set —
	// they are still reported via `createdWallIds`/`splitWallIds` but they
	// must not participate as authored walls in later noding passes.
	const splitWallIds = new Set<string>();
	const nodedJunctionIds = new Set<string>();
	const authoredWallIds = new Set<string>(createdWallIds);
	const operationOwnedJunctionIds = new Set<string>(createdJunctionIds);
	const endpointHostWallIds = new Map<string, string>();
	for (const snap of options.endpointHostSnaps ?? []) {
		const junctionId = resolved[snap.pointIndex]?.junctionId;
		if (junctionId) endpointHostWallIds.set(junctionId, snap.wallId);
	}
	const baselineJunctionIds = new Set(options.baseline.junctions.map((junction) => junction.id));
	const junctionIdRedirects = new Map<string, string>();
	const resolveJunctionId = (junctionId: string): string => {
		let resolvedId = junctionId;
		const visited = new Set<string>();
		while (!visited.has(resolvedId)) {
			visited.add(resolvedId);
			const redirect = junctionIdRedirects.get(resolvedId);
			if (!redirect) break;
			resolvedId = redirect;
		}
		return resolvedId;
	};
	const MAX_NODING_PASSES = 64;
	let passes = 0;
	for (;;) {
		passes += 1;
		if (passes > MAX_NODING_PASSES) {
			return reject({ code: 'noding_rejected', message: 'Chain noding did not converge' });
		}
		const fix = nextNodingFix(
			candidate,
			[...authoredWallIds],
			operationOwnedJunctionIds,
			endpointHostWallIds
		);
		if (!fix) break;
		if (fix.kind === 'reject') return reject(fix.rejection);
		if (fix.kind === 'adopt') {
			// Two Junction records described one physical node (a chain point and
			// a crossing-derived point a hair apart). Adopt one identity instead
			// of splitting: geometry is untouched, only the duplicate record is
			// retired and every wall reference is remapped.
			const duplicates = new Set(fix.duplicateJunctionIds);
			for (const duplicateId of duplicates) {
				junctionIdRedirects.set(duplicateId, fix.keepJunctionId);
				operationOwnedJunctionIds.delete(duplicateId);
			}
			candidate.junctions = candidate.junctions.filter(
				(junction) => !duplicates.has(junction.id)
			);
			candidate.walls = candidate.walls.map((wall) => {
				const start = duplicates.has(wall.startJunctionId);
				const end = duplicates.has(wall.endJunctionId);
				if (!start && !end) return wall;
				return {
					...wall,
					startJunctionId: start ? fix.keepJunctionId : wall.startJunctionId,
					endJunctionId: end ? fix.keepJunctionId : wall.endJunctionId
				};
			});
			continue;
		}
		if (fix.kind === 'tee' && fix.projectOwnedEndpoint) {
			candidate.junctions = candidate.junctions.map((junction) =>
				junction.id === fix.endpointJunctionId
					? { ...junction, point: [fix.point[0], fix.point[1]] }
					: junction
			);
		}
		const plan =
			fix.kind === 'crossing'
				? planWallCrossing(candidate, fix.wallIds, fix.point, nodingAllocatorAdapter(allocator, candidate))
				: planWallSplitAtPoint(candidate, fix.interiorWallId, fix.splitDistance, fix.point, nodingAllocatorAdapter(allocator, candidate), {
						existingJunctionId: fix.endpointJunctionId
					});
		if (plan.kind === 'rejected') {
			return reject({ code: 'noding_rejected', message: plan.rejection.message, wallIds: plan.rejection.wallId ? [plan.rejection.wallId] : undefined });
		}
		const document = plan.document as LayoutDocumentWallFirst;
		const before = new Set(candidate.walls.map((wall) => wall.id));
		// Attribute new fragments by parent provenance: an authored parent's
		// child inherits authored lineage; a host parent's child stays host.
		if (fix.kind === 'crossing') {
			const ordered = [...fix.wallIds].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
			plan.createdWallIds.forEach((created, createdIndex) => {
				if (before.has(created)) return;
				createdWallIds.push(created);
				const parentId = ordered[createdIndex];
				if (parentId !== undefined && authoredWallIds.has(parentId)) {
					authoredWallIds.add(created);
				}
			});
		} else {
			for (const created of plan.createdWallIds) {
				if (before.has(created)) continue;
				createdWallIds.push(created);
				if (authoredWallIds.has(fix.interiorWallId)) {
					authoredWallIds.add(created);
				}
			}
		}
		for (const split of plan.splitWallIds) splitWallIds.add(split);
		if (!baselineJunctionIds.has(plan.junctionId)) {
			nodedJunctionIds.add(plan.junctionId);
			operationOwnedJunctionIds.add(plan.junctionId);
		}
		// planWallCrossing/planWallSplit return full documents; adopt them.
		candidate.junctions = document.junctions;
		candidate.walls = document.walls;
		candidate.rooms = document.rooms;
		candidate.openings = document.openings;
	}

	// --- topology gate: no un-noded crossing may survive ---------------------
	const topologyIssue = validateChainTopology(candidate);
	if (topologyIssue) return reject(topologyIssue);

	// --- room reconciliation (boundary chains only) --------------------------
	let lineage: Array<{ faceKey: string; roomId: string; kind: 'created' }> = [];
	let retiredRoomIds: string[] = [];
	if (options.role === 'boundary') {
		const extraction = extractBoundaryCandidateFaces(candidate);
		if (extraction.faces.length > 0 || options.baseline.rooms.length > 0) {
			const predecessorPolygons = new Map<string, readonly LayoutVec2[]>();
			const predecessorWitnesses = new Map<string, LayoutVec2>();
			for (const room of options.baseline.rooms) {
				const polygon = roomBoundaryPolygon(options.baseline, room.id);
				if (!polygon) {
					return reject({
						code: 'room_reconciliation_rejected',
						message: `Predecessor room '${room.id}' has an unresolvable boundary`
					});
				}
				predecessorPolygons.set(room.id, polygon);
				predecessorWitnesses.set(room.id, interiorWitness(polygon));
			}
			// True P23.8 correspondence components: connected components of
			// the bipartite predecessor-Room ↔ candidate-face graph. An edge
			// exists when the predecessor witness lies strictly inside the
			// face or the predecessor polygon overlaps the face with
			// positive area. Faces with no predecessor form independent
			// 0→1 birth components. Never one-component-per-face.
			const components = buildCorrespondenceComponents(
				extraction.faces,
				options.baseline.rooms.map((room) => room.id),
				predecessorWitnesses,
				predecessorPolygons
			);
			const result = reconcileRooms({
				baseline: options.baseline,
				candidateDocument: candidate,
				extraction,
				components,
				predecessorWitnesses,
				predecessorPolygons,
				allocator: createAuthoringRoomAllocator()
			});
			if ('rejection' in result) {
				return reject({
					code: 'room_reconciliation_rejected',
					message: result.rejection.message,
					...(result.rejection.roomIds ? { wallIds: result.rejection.roomIds } : {}),
					...(result.rejection.faceKey
						? { topology: extraction.diagnostics }
						: {})
				});
			}
			candidate.rooms = result.document.rooms;
			candidate.objects = result.document.objects;
			candidate.openings = result.document.openings;
			lineage = result.lineage
				.filter((record) => record.kind === 'created')
				.map((record) => ({ faceKey: record.faceKey, roomId: record.roomId, kind: 'created' as const }));
			retiredRoomIds = [...result.retiredRoomIds];
		}
	}

	// --- final canonical gates ----------------------------------------------
	const validated = validateWallFirstLayoutDocument(candidate);
	if (!validated.success) {
		return reject({
			code: 'invalid_candidate_document',
			message: `Candidate failed wall-first validation: ${validated.issues[0]?.message ?? 'unknown issue'}`,
			issues: validated.issues
		});
	}
	const compiled = compileWallFirstLayoutGeometry(validated.document);
	if (hasBlockingLayoutIssues(compiled.issues)) {
		return reject({
			code: 'candidate_does_not_compile',
			message: `Candidate document does not compile: ${compiled.issues[0]?.message ?? 'unknown geometry issue'}`,
			issues: compiled.issues
		});
	}

	const finalJunctionIds = new Set(validated.document.junctions.map((junction) => junction.id));
	const resolveFinalJunctionId = (entry: { junctionId: string | null; point: LayoutVec2 }): string | null => {
		if (!entry.junctionId) return null;
		const redirectedId = resolveJunctionId(entry.junctionId);
		if (finalJunctionIds.has(redirectedId)) return redirectedId;
		return validated.document.junctions.find((junction) =>
			coincidesAsJunction(junction.point, entry.point)
		)?.id ?? null;
	};
	const startJunctionId = resolveFinalJunctionId(resolved[0]!);
	const endJunctionId = resolveFinalJunctionId(close ? resolved[0]! : resolved[resolved.length - 1]!);
	if (!startJunctionId || !endJunctionId) {
		return reject({
			code: 'invalid_candidate_document',
			message: 'Committed candidate lost a resolved Junction identity'
		});
	}

	return {
		kind: 'success',
		document: validated.document,
		createdWallIds: [...new Set(createdWallIds)],
		authoredWallIds: [...authoredWallIds],
		createdJunctionIds: [...new Set([...createdJunctionIds, ...nodedJunctionIds])]
			.filter((junctionId) => finalJunctionIds.has(junctionId)),
		splitWallIds: [...splitWallIds],
		startJunctionId,
		endJunctionId,
		lineage,
		retiredRoomIds
	};
}

type NodingFix =
	| { kind: 'crossing'; wallIds: [string, string]; point: LayoutVec2 }
	| {
			kind: 'tee';
			interiorWallId: string;
			endpointJunctionId: string;
			splitDistance: number;
			point: LayoutVec2;
			projectOwnedEndpoint?: boolean;
	  }
	| { kind: 'adopt'; keepJunctionId: string; duplicateJunctionIds: string[] }
	| { kind: 'reject'; rejection: WallChainRejection };

/** The Junction whose point coincides with `point`, if any. */
function junctionAtPoint(
	document: LayoutDocumentWallFirst,
	point: LayoutVec2
): LayoutJunction | undefined {
	return document.junctions.find((junction) => coincidesAsJunction(junction.point, point));
}

/**
 * Junction records the given walls reference at `point` that are **not**
 * `keepJunctionId` — duplicate identities for one physical node, which noding
 * retires in favour of the kept record. Both walls of the classified
 * relationship are consulted, so the interior wall of a T contributes its own
 * coincident endpoint: retiring that record is what turns a would-be
 * degenerate split into an identity adoption.
 *
 * Scope is deliberate: only the records participating in this relationship are
 * retired. A baseline that already carried two records for one node is a
 * pre-existing identity defect, and a draw must not silently rewrite walls the
 * gesture never touched.
 */
function duplicateJunctionsAt(
	document: LayoutDocumentWallFirst,
	walls: readonly LayoutWall[],
	point: LayoutVec2,
	keepJunctionId: string
): string[] {
	const duplicates = new Set<string>();
	for (const wall of walls) {
		for (const junctionId of [wall.startJunctionId, wall.endJunctionId]) {
			if (junctionId === keepJunctionId || duplicates.has(junctionId)) continue;
			const junction = document.junctions.find((candidate) => candidate.id === junctionId);
			if (!junction) continue;
			if (coincidesAsJunction(junction.point, point)) duplicates.add(junctionId);
		}
	}
	return [...duplicates];
}

/**
 * Node a relationship that lands on an existing Junction by splitting the wall
 * the Junction is strictly interior to and reusing it. Returns `undefined`
 * when the Junction is an endpoint of every candidate wall, in which case the
 * walls already meet there and identity adoption is the correct fix.
 */
function teeThroughJunction(
	segments: readonly TopologySegment[],
	junction: LayoutJunction
): NodingFix | undefined {
	for (const segment of segments) {
		const length = Math.hypot(segment.end[0] - segment.start[0], segment.end[1] - segment.start[1]);
		const splitDistance = Math.hypot(
			junction.point[0] - segment.start[0],
			junction.point[1] - segment.start[1]
		);
		if (splitDistance <= JUNCTION_COINCIDENCE_EPSILON) continue;
		if (length - splitDistance <= JUNCTION_COINCIDENCE_EPSILON) continue;
		return {
			kind: 'tee',
			interiorWallId: segment.id,
			endpointJunctionId: junction.id,
			splitDistance,
			point: [junction.point[0], junction.point[1]]
		};
	}
	return undefined;
}

/**
 * Find the next un-noded relationship between a chain wall and any other
 * wall (chain walls themselves are already self-gated). Returns `null` when
 * the graph is clean.
 */
function nextNodingFix(
	document: LayoutDocumentWallFirst,
	chainDerivedWallIds: readonly string[],
	operationOwnedJunctionIds: ReadonlySet<string>,
	endpointHostWallIds: ReadonlyMap<string, string>
): NodingFix | null {
	const chainSet = new Set(chainDerivedWallIds);
	const segments = new Map<string, TopologySegment>();
	const junctionById = new Map(document.junctions.map((junction) => [junction.id, junction]));
	for (const wall of document.walls) {
		const start = junctionById.get(wall.startJunctionId);
		const end = junctionById.get(wall.endJunctionId);
		if (!start || !end) continue;
		segments.set(wall.id, { id: wall.id, start: start.point, end: end.point });
	}
	const walls = document.walls;
	for (let first = 0; first < walls.length; first += 1) {
		const a = walls[first]!;
		const segmentA = segments.get(a.id)!;
		for (let second = first + 1; second < walls.length; second += 1) {
			const b = walls[second]!;
			const oneIsChain = chainSet.has(a.id) || chainSet.has(b.id);
			if (!oneIsChain) continue; // pre-existing relationships are already noded
			const segmentB = segments.get(b.id)!;
			const shared = a.startJunctionId === b.startJunctionId || a.startJunctionId === b.endJunctionId
				? [a.startJunctionId]
				: a.endJunctionId === b.startJunctionId || a.endJunctionId === b.endJunctionId
					? [a.endJunctionId]
					: [];
			const classified = classifyWallIntersection(segmentA, segmentB, shared);
			if (classified.kind === 'collinear-overlap' || classified.kind === 'collinear-endpoint-touch') {
				return {
					kind: 'reject',
					rejection: {
						code: 'collinear_overlap',
						message: `Chain overlaps existing wall '${chainSet.has(a.id) ? b.id : a.id}' on one line; trim or redraw the overlapping span`,
						wallIds: [a.id, b.id]
					}
				};
			}
			// A wall-span snap is an ordinary floating-point projection. On an
			// oblique host its rounded coordinate can sit ~1e-16 m off the exact
			// supporting line, so the robust classifier truthfully returns `none`,
			// `invalid`, or a crossing infinitesimally before the authored endpoint.
			// Recover only an authored endpoint within the canonical Junction-identity
			// tolerance of a pre-existing host interior. This is snap normalization,
			// not a general intersection epsilon: geometry farther away remains
			// disconnected and the exact classifier still owns every other case.
			const projectedTee = projectedAuthoredEndpointTee(
				a,
				segmentA,
				b,
				segmentB,
				chainSet,
				operationOwnedJunctionIds,
				endpointHostWallIds,
				shared
			);
			if (projectedTee) return projectedTee;
			if (classified.kind === 'proper-crossing') {
				// A crossing that lands on an existing Junction is a node, not an X:
				// splitting a wall that already ends there has a degenerate
				// distance, so node through the Junction instead.
				const existing = junctionAtPoint(document, classified.point);
				if (existing) {
					const throughJunction = teeThroughJunction([segmentA, segmentB], existing);
					if (throughJunction) return throughJunction;
					const duplicates = duplicateJunctionsAt(document, [a, b], classified.point, existing.id);
					if (duplicates.length > 0) {
						return { kind: 'adopt', keepJunctionId: existing.id, duplicateJunctionIds: duplicates };
					}
					// `teeThroughJunction` skips a segment the Junction is already an
					// endpoint of, and duplicate records have just been ruled out, so
					// both walls already meet at this node: there is nothing left to
					// node, and a `crossing` fix here would request a zero-distance
					// split. Skip the pair and keep scanning for a real relationship.
					continue;
				}
				return { kind: 'crossing', wallIds: [a.id, b.id], point: classified.point };
			}
			if (classified.kind === 'endpoint-on-interior') {
				// The T junction is the endpoint wall's junction at the touch
				// point; the interior wall splits against it.
				const endpointWall = wallById(document, classified.endpointWallId);
				const endpointJunctionId =
					endpointWall &&
					coincidesAsJunction(segments.get(classified.endpointWallId)!.start, classified.point)
						? endpointWall.startJunctionId
						: endpointWall?.endJunctionId;
				if (!endpointJunctionId) continue;
				const interiorWall = wallById(document, classified.interiorWallId)!;
				// A touch point that coincides with an existing Junction is the same
				// physical node — including the interior wall's *own* endpoint (the
				// near-miss case: the click landed a hair short of the Junction it
				// meant). Adopt that identity instead of planning a split whose
				// distance would be degenerate (`Split distance …`).
				const coincident = junctionAtPoint(document, classified.point);
				if (coincident) {
					// `a`/`b` are the endpoint wall and the interior wall of this T.
					const duplicates = duplicateJunctionsAt(
						document,
						[a, b],
						classified.point,
						coincident.id
					);
					if (duplicates.length > 0) {
						return { kind: 'adopt', keepJunctionId: coincident.id, duplicateJunctionIds: duplicates };
					}
				}
				const interiorStart = junctionById.get(interiorWall.startJunctionId)!.point;
				const splitDistance = Math.hypot(
					classified.point[0] - interiorStart[0],
					classified.point[1] - interiorStart[1]
				);
				return {
					kind: 'tee',
					interiorWallId: classified.interiorWallId,
					endpointJunctionId,
					splitDistance,
					point: classified.point
				};
			}
		}
	}
	return null;
}

/**
 * Recover the semantic T encoded by an authored endpoint projected onto a
 * host Wall. The recovery is deliberately asymmetric: only Junctions created
 * by this command may move, and only onto a non-chain host. A chain Wall can
 * reuse a baseline Junction, so Wall lineage alone is not sufficient proof of
 * endpoint ownership.
 *
 * Straight hosts retain their existing chord projection. A curved host is a
 * bounded exception to the straight-only noding rule: the endpoint is first
 * projected against the canonical sampled centerline, then that sampled arc
 * distance is resolved once through the exact cubic split authority. The
 * normalized endpoint and the split distance both come from that resolved
 * result, so the subsequent split cannot fall back to chord arithmetic.
 */
function projectedAuthoredEndpointTee(
	a: LayoutWall,
	segmentA: TopologySegment,
	b: LayoutWall,
	segmentB: TopologySegment,
	chainSet: ReadonlySet<string>,
	operationOwnedJunctionIds: ReadonlySet<string>,
	endpointHostWallIds: ReadonlyMap<string, string>,
	sharedJunctionIds: readonly string[]
): NodingFix | undefined {
	if (sharedJunctionIds.length > 0) return undefined;
	const candidates: Array<{
		endpointWall: LayoutWall;
		endpointSegment: TopologySegment;
		hostWall: LayoutWall;
		hostSegment: TopologySegment;
	}> = [];
	if (chainSet.has(a.id) && !chainSet.has(b.id)) {
		candidates.push({ endpointWall: a, endpointSegment: segmentA, hostWall: b, hostSegment: segmentB });
	}
	if (chainSet.has(b.id) && !chainSet.has(a.id)) {
		candidates.push({ endpointWall: b, endpointSegment: segmentB, hostWall: a, hostSegment: segmentA });
	}
	for (const { endpointWall, endpointSegment, hostWall, hostSegment } of candidates) {
		const endpoints = [
			{ junctionId: endpointWall.startJunctionId, point: endpointSegment.start },
			{ junctionId: endpointWall.endJunctionId, point: endpointSegment.end }
		];
		for (const endpoint of endpoints) {
			if (!operationOwnedJunctionIds.has(endpoint.junctionId)) continue;
			const snappedHostWallId = endpointHostWallIds.get(endpoint.junctionId);
			if (snappedHostWallId !== undefined && snappedHostWallId !== hostWall.id) continue;
			const hostEndpoints = [
				{ junctionId: hostWall.startJunctionId, point: hostSegment.start },
				{ junctionId: hostWall.endJunctionId, point: hostSegment.end }
			];
			// The editor normally resolves a Junction snap before this planner. Keep
			// the same identity rule here for a direct/headless caller too: a host
			// endpoint is adoption, never a tiny fragment.
			const coincidentHostEndpoint = hostEndpoints.find((hostEndpoint) =>
				coincidesAsJunction(endpoint.point, hostEndpoint.point)
			);
			if (coincidentHostEndpoint) {
				return {
					kind: 'adopt',
					keepJunctionId: coincidentHostEndpoint.junctionId,
					duplicateJunctionIds: [endpoint.junctionId]
				};
			}

			if (hostWall.centerline.kind === 'cubic-chain') {
				const sampled = wallCenterlineSamples(
					hostWall,
					hostSegment.start,
					hostSegment.end,
					'forward'
				);
				if (!sampled) continue;
				const projection = projectPointToSampledSegment(endpoint.point, sampled);
				// A snapped `wall-span` identity already established the host
				// relationship. Without that identity, retain only the existing
				// Junction coincidence tolerance; sampler flatness is normalization
				// error and must not acquire topology by itself.
				const hasExplicitHostIdentity = snappedHostWallId === hostWall.id;
				if (!hasExplicitHostIdentity && projection.distanceToPath > JUNCTION_COINCIDENCE_EPSILON) continue;
				const resolution = resolveWallCurveSplit(
					{
						startPoint: hostSegment.start,
						endPoint: hostSegment.end,
						knots: hostWall.centerline.knots,
						spans: hostWall.centerline.spans
					},
					projection.distance
				);
				if (resolution.kind === 'rejected') continue;
				const resolved = resolution.result;
				// A projection at an existing host endpoint is identity adoption, not
				// an exact curved split with a near-zero fragment. The direct point
				// check above handles ordinary snapped endpoints; this also catches a
				// clamped sampled projection whose arc distance is at the boundary.
				const hostEndpointAtResolution = hostEndpoints.find((hostEndpoint) =>
					coincidesAsJunction(resolved.point, hostEndpoint.point)
				);
				if (hostEndpointAtResolution) {
					return {
						kind: 'adopt',
						keepJunctionId: hostEndpointAtResolution.junctionId,
						duplicateJunctionIds: [endpoint.junctionId]
					};
				}
				if (
					!hasExplicitHostIdentity &&
					Math.hypot(
						endpoint.point[0] - resolved.point[0],
						endpoint.point[1] - resolved.point[1]
					) > JUNCTION_COINCIDENCE_EPSILON
				) {
					continue;
				}
				return {
					kind: 'tee',
					interiorWallId: hostSegment.id,
					endpointJunctionId: endpoint.junctionId,
					splitDistance: resolved.distance,
					point: [resolved.point[0], resolved.point[1]],
					projectOwnedEndpoint: true
				};
			}

			const dx = hostSegment.end[0] - hostSegment.start[0];
			const dz = hostSegment.end[1] - hostSegment.start[1];
			const lengthSquared = dx * dx + dz * dz;
			if (!(lengthSquared > 0)) continue;
			const t =
				((endpoint.point[0] - hostSegment.start[0]) * dx +
					(endpoint.point[1] - hostSegment.start[1]) * dz) /
				lengthSquared;
			const length = Math.sqrt(lengthSquared);
			const endpointMargin = JUNCTION_COINCIDENCE_EPSILON / length;
			if (!(t > endpointMargin && t < 1 - endpointMargin)) continue;
			const projected: LayoutVec2 = [
				hostSegment.start[0] + dx * t,
				hostSegment.start[1] + dz * t
			];
			if (!coincidesAsJunction(endpoint.point, projected)) continue;
			return {
				kind: 'tee',
				interiorWallId: hostSegment.id,
				endpointJunctionId: endpoint.junctionId,
				splitDistance: t * length,
				point: projected,
				projectOwnedEndpoint: true
			};
		}
	}
	return undefined;
}

function wallById(document: LayoutDocumentWallFirst, wallId: string): LayoutWall | undefined {
	return document.walls.find((wall) => wall.id === wallId);
}

/**
 * Final topology gate over the committed candidate: every wall pair must
 * relate only through explicit shared junctions (or be disjoint). This is
 * the same bar `validatePrecisionTopology` holds P23.1 candidates to — the
 * P23.9 plan forbids un-noded visual crossings in committed data.
 */
function validateChainTopology(document: LayoutDocumentWallFirst): WallChainRejection | null {
	const junctionById = new Map(document.junctions.map((junction) => [junction.id, junction]));
	const entries: Array<{ wall: LayoutWall; segment: TopologySegment }> = [];
	for (const wall of document.walls) {
		const start = junctionById.get(wall.startJunctionId);
		const end = junctionById.get(wall.endJunctionId);
		if (!start || !end) continue;
		entries.push({ wall, segment: { id: wall.id, start: start.point, end: end.point } });
	}
	// P23.11 — the chord classifier below is exact for straight/straight
	// relationships and stays authoritative there. A curved Wall can bow across
	// a new straight Wall while its endpoint chord never intersects it, so the
	// canonical sampled crossing authority runs on the built candidate before
	// commit. It is the SAME gate `validateWallFirstTopology` runs — never a
	// second crossing algorithm — and any curve crossing that would need
	// automatic curved noding rejects the whole authoring command.
	const curveCrossing = detectWallCurveTopologyCrossings(
		document,
		new Map(entries.map((entry) => [entry.wall.id, entry.segment] as const))
	);
	if (curveCrossing) {
		return curveCrossing.kind === 'self'
			? {
					code: 'self_intersecting_chain',
					message: `Wall '${curveCrossing.wallId}' centerline intersects itself`,
					wallIds: [curveCrossing.wallId]
			  }
			: {
					code: 'self_intersecting_chain',
					message: `Walls '${curveCrossing.wallIds[0]}' and '${curveCrossing.wallIds[1]}' have unsupported ${
						curveCrossing.sharedJunctionId ? 'crossing away from their shared Junction' : 'centerline crossing'
					}`,
					wallIds: [...curveCrossing.wallIds]
			  };
	}
	const segments = entries.map((entry) => entry.segment);
	for (let first = 0; first < entries.length; first += 1) {
		for (let second = first + 1; second < entries.length; second += 1) {
			const a = entries[first]!.wall;
			const b = entries[second]!.wall;
			const shared = a.startJunctionId === b.startJunctionId || a.startJunctionId === b.endJunctionId
				? [a.startJunctionId]
				: a.endJunctionId === b.startJunctionId || a.endJunctionId === b.endJunctionId
					? [a.endJunctionId]
					: [];
			const classified = classifyWallIntersection(segments[first]!, segments[second]!, shared);
			if (classified.kind === 'shared-explicit-junction') {
				const geometric = classifyWallIntersection(segments[first]!, segments[second]!, []);
				if (geometric.kind === 'collinear-overlap') {
					return {
						code: 'collinear_overlap',
						message: `Walls '${a.id}' and '${b.id}' overlap beyond their explicit shared junction`,
						wallIds: [a.id, b.id]
					};
				}
				continue;
			}
			if (classified.kind !== 'none') {
				return {
					code: 'self_intersecting_chain',
					message: `Walls '${a.id}' and '${b.id}' have unsupported ${classified.kind}`,
					wallIds: [a.id, b.id]
				};
			}
		}
	}
	return null;
}

/** Oriented boundary polygon of a wall-first room (junction traversal order). */
/** Adapt the chain allocator to the noding allocator contract. */
function nodingAllocatorAdapter(allocator: WallChainIdAllocator, document: LayoutDocumentWallFirst): NodingIdAllocator {
	return {
		nextWallId(baseDocument, seed) {
			return allocator.nextWallId(new Set(baseDocument.walls.map((wall) => wall.id)), seed);
		},
		nextJunctionId(baseDocument, seed) {
			return allocator.nextJunctionId(new Set(baseDocument.junctions.map((junction) => junction.id)), seed);
		}
	};
}

/**
 * Segment-first canonical engine: one completed straight segment = one Wall
 * authoring command. Thin wrapper over `planWallChain` with exactly two
 * points and no implicit close. Callers use the returned `startJunctionId` /
 * `endJunctionId` for continuation — never `createdWallIds`.
 *
 * **Wall-birth height lives here, not in the editor (P23.6I).** A headless
 * caller and the human Plan interaction must execute the same semantic
 * operation, so the first-segment rule is resolved from canonical document
 * topology by `resolveWallBirthHeight()`:
 *
 * ```text
 * explicit height                                  → that height
 * start point on a Junction with one unique
 * incident Wall height                             → inherit it
 * isolated/new start, or mixed incident heights    → WALL_AUTHORING_DEFAULT_HEIGHT
 * ```
 *
 * The start Junction is resolved with the same exact-coordinate rule
 * `planWallChain` uses for point reuse, so the birth decision and the committed
 * topology cannot disagree. Continuation *inside one active draw run* stays an
 * explicit caller decision: the editor holds the run height as transient state
 * and passes it as `height`, which the explicit branch above honours.
 */
export function planWallSegment(options: {
	baseline: LayoutDocumentWallFirst;
	start: LayoutVec2;
	end: LayoutVec2;
	role: LayoutWallRole;
	thickness?: number;
	height?: number;
	allocator?: WallChainIdAllocator;
	/** Existing `wall-span` snap identity for the authored endpoint. */
	endpointHostWallId?: string;
}): WallChainPlan {
	const startJunction = options.baseline.junctions.find((junction) =>
		coincidesAsJunction(junction.point, options.start)
	);
	return planWallChain({
		baseline: options.baseline,
		points: [options.start, options.end],
		close: false,
		role: options.role,
		height: resolveWallBirthHeight(
			options.baseline,
			startJunction?.id ?? null,
			options.height
		),
		...(options.thickness !== undefined ? { thickness: options.thickness } : {}),
		...(options.endpointHostWallId
			? { endpointHostSnaps: [{ pointIndex: 1, wallId: options.endpointHostWallId }] }
			: {}),
		...(options.allocator !== undefined ? { allocator: options.allocator } : {})
	});
}

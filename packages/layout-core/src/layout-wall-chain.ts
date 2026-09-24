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
 * the P23.8 engine — DECLARED junction reuse (never coordinate coincidence),
 * endpoint-on-interior T noding, proper-crossing X noding, collinear-overlap
 * rejection, then the canonical validate → reconcile → compile gates — so one
 * bounded tool commits **one** history entry and an invalid candidate commits
 * nothing. Adoption and noding apply only inside the component(s) the operation
 * DECLARES (P23B.3a S6), so an overlap between independent groups is permitted
 * geometry and never a join. Nothing here mutates its inputs.
 *
 * Semantics ratified by the P23.9 plan:
 * - open chains are valid architecture and commit without producing a Room;
 * - `role: 'boundary'` chains invoke P23.8 face extraction and Room
 *   reconciliation (first-enclosure birth, 1→2 divider split, or no-op
 *   preservation per witness correspondence); `role: 'partition'` chains
 *   never touch Rooms;
 * - snapping is a suggestion (the editor resolves coordinates before this
 *   planner runs); committed topology here is explicit and DECLARED;
 * - collinear overlap rejects — no auto-merge/trim — WITHIN one connected
 *   component; two independent components may overlap freely;
 * - committed data never contains an un-noded visual crossing INSIDE one
 *   connected component. A crossing between independent components is permitted
 *   geometry (P23B.3a S4/S5) and is deliberately left un-noded;
 * - **authoring intent is DECLARED, never inferred from geometry** (P23B.3a S6,
 *   decision record §4.0.1 / M-3a-4). An operation that deliberately connects to
 *   existing geometry declares the identity it connects to
 *   (`endpointJunctionSnaps` / `endpointHostSnaps`) — operation class 3,
 *   extending a group it belongs to — and keeps today's adoption and noding
 *   inside that group. An operation that declares NOTHING is independent
 *   placement (class 2): it mints its own Junction records even at coordinates
 *   an existing Junction already occupies, splits no host Wall and adopts no
 *   identity, so spatial overlap never becomes connectivity by accident.
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
import {
	topologyComponentKeyByJunctionId,
	topologyComponentKeyByWallId,
	type JunctionTopologyComponentKey
} from './layout-topology-components';
import { WALL_AUTHORING_DEFAULT_HEIGHT, resolveWallBirthHeight } from './layout-wall-heights';
import { planWallCrossing, planWallSplitAtPoint, type NodingIdAllocator } from './layout-wall-noding';
import { wallCenterlineCarriesPoint, wallCenterlineSamples } from './layout-wall-centerline';
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
 * A DECLARED host-Wall connection for one draft point (P23B.3a S6).
 *
 * Relationship acquisition, not geometry: the caller names the host Wall
 * explicitly. `planWallChain` VALIDATES the claim before granting any authority
 * — the point exists, the Wall is in the baseline, at most one host per point,
 * a Junction anchor on the same point agrees about the component, and the named
 * Wall is genuinely part of this operation — and then authorizes noding inside
 * that host's connected component only. Normalizing a snapped endpoint onto the
 * host's centerline stays the curve authority's job; sampler flatness must never
 * become a topology radius by itself.
 */
export type WallEndpointHostSnap = {
	pointIndex: number;
	wallId: string;
};

/**
 * P23B.3a S6 — DECLARED CONNECTION ANCHOR, junction form.
 *
 * The operation's explicit statement that draft point `pointIndex` CONNECTS to
 * the existing Junction `junctionId`: operation class 3, extending an already
 * connected group. It is the Junction-form twin of `WallEndpointHostSnap`, which
 * declares the same thing for a host Wall's span.
 *
 * WHY IT EXISTS. Option E separates spatial placement from topological
 * connection, so coordinate coincidence can no longer mean connectivity: the
 * draft-point reuse this planner used to infer from a coincident coordinate is
 * now an EXPLICIT declaration, made by the caller that knows what the gesture
 * meant. `planWallChain` adopts an existing Junction id when — and only when —
 * this anchor declares it. A chain that declares nothing is INDEPENDENT
 * placement: it mints its own Junction records (even at coordinates an existing
 * Junction already occupies), acquires no shared topology, splits no host Wall,
 * and remains its own component to the validity gates.
 *
 * The declaration is the OPERATION's intent, never the geometry (decision
 * record §4.0.1 / M-3a-4): a caller that means "extend this group" says so; a
 * caller that means "place this independently" says nothing and therefore
 * cannot join anything by accident.
 */
export type WallEndpointJunctionSnap = {
	pointIndex: number;
	junctionId: string;
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
	/**
	 * P23B.3a S6 — DECLARED host-Wall connections, keyed by draft point index.
	 *
	 * The annotation names the point that expresses the attachment (the endpoint
	 * the author snapped onto a Wall's face); what it MEANS is that this operation
	 * joins the host Wall's connected group, which is why noding — host splits, X
	 * crossings and Ts — applies inside that group and nowhere else. An endpoint
	 * that lands on the host's span is the ordinary case; a caller may also declare
	 * a group whose geometry the operation CROSSES rather than touches, because the
	 * statement is about the GROUP. Either way it is validated first (see
	 * `validateEndpointHostSnaps`): the named Wall must exist and be genuinely part
	 * of this operation, so an arbitrary remote Wall id is refused rather than
	 * becoming blanket permission to node its group. With no declaration (and none
	 * of `endpointJunctionSnaps`) the chain is INDEPENDENT placement: a crossing is
	 * permitted overlap that creates no shared topology.
	 */
	endpointHostSnaps?: readonly WallEndpointHostSnap[];
	/**
	 * P23B.3a S6 — DECLARED Junction connection anchors, keyed by draft point
	 * index. Together with `endpointHostSnaps` this IS the operation's declared
	 * intent: supplying either one makes the chain an EXTENSION of the group(s)
	 * it names (class 3 — adoption and in-group noding apply); supplying neither
	 * declares INDEPENDENT placement (class 2 — no adoption, no noding, no
	 * fragmentation of any pre-existing Wall).
	 */
	endpointJunctionSnaps?: readonly WallEndpointJunctionSnap[];
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
	// P23B.3a S6 — DECLARED CONNECTION ANCHORS, never coordinate coincidence (the
	// D-9 authoring rule, decision record §4.0.1 classes 2 and 3). A draft point
	// adopts an existing Junction id only when the operation DECLARED that
	// identity; the draft point then normalizes onto the stored coordinate, so a
	// tolerant match still yields exactly one spelling of the node. Ordinary
	// spatial placement (class 2) declares no anchor, so a point whose coordinates
	// coincide with an existing Junction mints its own record at those same
	// coordinates: distinct Junction identity, no connectivity, no adoption —
	// which the component-scoped validity gates (S4/S5) permit between independent
	// components.
	//
	// A declared anchor that no longer coincides with its draft point is a stale
	// caller claim, not a hint: the chain REFUSES rather than silently building
	// topology the caller did not ask for.
	const baselineJunctionById = new Map(options.baseline.junctions.map((junction) => [junction.id, junction]));
	const declaredAnchorByPointIndex = new Map<number, string>();
	for (const snap of options.endpointJunctionSnaps ?? []) {
		if (declaredAnchorByPointIndex.has(snap.pointIndex)) {
			return reject({
				code: 'invalid_candidate_document',
				message: `Draft point ${snap.pointIndex} declares more than one Junction anchor`
			});
		}
		declaredAnchorByPointIndex.set(snap.pointIndex, snap.junctionId);
	}
	for (const [pointIndex, junctionId] of declaredAnchorByPointIndex) {
		const declared = baselineJunctionById.get(junctionId);
		const point = points[pointIndex];
		if (!declared || !point) {
			return reject({
				code: 'invalid_candidate_document',
				message: `Declared Junction anchor '${junctionId}' names draft point ${pointIndex}, which this chain does not have`
			});
		}
		if (!coincidesAsJunction(declared.point, point)) {
			return reject({
				code: 'invalid_candidate_document',
				message: `Declared Junction anchor '${junctionId}' does not coincide with draft point ${pointIndex}`
			});
		}
	}
	const resolved: Array<{ junctionId: string | null; point: LayoutVec2 }> = points.map((point, pointIndex) => {
		const declaredId = declaredAnchorByPointIndex.get(pointIndex);
		if (declaredId === undefined) return { junctionId: null, point };
		const declared = baselineJunctionById.get(declaredId)!;
		return { junctionId: declared.id, point: [...declared.point] as LayoutVec2 };
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

	// P23B.3a S6 (review correction) — the DECLARED host-Wall anchors are
	// validated BEFORE any of them grants noding authority. A declaration is a
	// claim about a real relationship, so a malformed one fails closed instead of
	// silently authorizing noding of an unrelated group (the same fail-closed rule
	// the Junction anchors above already follow).
	const hostValidation = validateEndpointHostSnaps({
		baseline: options.baseline,
		resolved,
		legs: legEndpoints.map((leg) => ({ start: leg.start.point, end: leg.end.point })),
		declaredJunctionByPointIndex: declaredAnchorByPointIndex,
		hostSnaps: options.endpointHostSnaps ?? []
	});
	if ('rejection' in hostValidation) return reject(hostValidation.rejection);
	const declaredHostByPointIndex = hostValidation.declaredHostByPointIndex;

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
	// The validated declarations, re-keyed onto the Junction each declared point
	// actually resolved to (a declared identity, or the chain's own minted node).
	const endpointHostWallIds = new Map<string, string>();
	for (const [pointIndex, wallId] of declaredHostByPointIndex) {
		const junctionId = resolved[pointIndex]?.junctionId;
		if (junctionId) endpointHostWallIds.set(junctionId, wallId);
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
			// the bipartite predecessor-Room ↕ candidate-face graph. An edge
			// exists when the predecessor witness lies strictly inside the
			// face or the predecessor polygon overlaps the face with
			// positive area — AND (P23B.3a D-12) authored identity puts both
			// sides in the same connected component, so an authored Wall
			// landing over an INDEPENDENT group can never claim its Rooms.
			// Faces with no predecessor form independent 0→1 birth
			// components. Never one-component-per-face.
			const components = buildCorrespondenceComponents({
				faces: extraction.faces,
				predecessorRoomIds: options.baseline.rooms.map((room) => room.id),
				predecessorWitnesses,
				predecessorPolygons,
				candidateDocument: candidate,
				baselineRooms: options.baseline.rooms
			});
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
	// P23B.3a S6 — the last-resort coordinate recovery may only reach identities in
	// the component this operation authored. Coincident records in unrelated
	// components are legal now, so an unrestricted lookup could hand a chain an
	// unrelated group's Junction as its own start/end — the implicit join this step
	// removes, leaking back out through the return value.
	const finalComponentKeyByWallId = topologyComponentKeyByWallId(validated.document);
	const finalJunctionComponentKeyById = topologyComponentKeyByJunctionId(
		validated.document,
		finalComponentKeyByWallId
	);
	const authoredComponentKeys = new Set<string | symbol>(
		[...authoredWallIds]
			.map((wallId) => finalComponentKeyByWallId.get(wallId))
			.filter((key): key is string => key !== undefined)
	);
	const resolveFinalJunctionId = (entry: { junctionId: string | null; point: LayoutVec2 }): string | null => {
		if (!entry.junctionId) return null;
		const redirectedId = resolveJunctionId(entry.junctionId);
		if (finalJunctionIds.has(redirectedId)) return redirectedId;
		return (
			validated.document.junctions.find((junction) => {
				if (!coincidesAsJunction(junction.point, entry.point)) return false;
				const key = finalJunctionComponentKeyById.get(junction.id);
				return key !== undefined && authoredComponentKeys.has(key);
			})?.id ?? null
		);
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

/**
 * P23B.3a S6 (review correction) — VALIDATE `endpointHostSnaps` before any
 * declaration grants noding authority.
 *
 * A host-Wall declaration is the operation's statement that it extends the host
 * Wall's connected group (operation class 3, §4.0.1 / M-3a-4). Because that
 * statement is what authorizes noding inside the group, a malformed one must
 * FAIL CLOSED rather than be silently dropped or silently honored — the same
 * rule the Junction anchors already follow. The checks, in order:
 *
 * ```text
 * point index        names an existing draft point
 * uniqueness         at most one host per draft point (never last-wins)
 * host identity      the named Wall exists in the baseline document
 * agreement          a Junction anchor on the same point is in that host's component
 * genuine relation   the declared point is on the host, OR the operation's own
 *                    geometry meets it, OR the host's component is already
 *                    reached by another declaration of this operation
 * ```
 *
 * The one claim this deliberately does NOT make is "the endpoint lies on the
 * host": a valid host declaration authorizes extension into the host's WHOLE
 * connected component, so an operation may declare a host whose Wall its own
 * geometry crosses away from the endpoint (the preserved P23.6e noding
 * regressions). What it must never be is an arbitrary remote Wall id, which is
 * exactly what the relation check rules out. Both meanings of a host declaration
 * — an endpoint span snap and a group-scoped connection — are therefore covered
 * by ONE predicate, and no discriminant is added to the transient input.
 *
 * Once the relation exists, noding anywhere inside that same component stays
 * authorized (`nextNodingFix`); an undeclared independent component is never
 * touched. Deterministic: the first failing declaration in list order rejects.
 */
function validateEndpointHostSnaps(input: {
	baseline: LayoutDocumentWallFirst;
	resolved: readonly { junctionId: string | null; point: LayoutVec2 }[];
	legs: readonly { start: LayoutVec2; end: LayoutVec2 }[];
	declaredJunctionByPointIndex: ReadonlyMap<number, string>;
	hostSnaps: readonly WallEndpointHostSnap[];
}): { rejection: WallChainRejection } | { declaredHostByPointIndex: Map<number, string> } {
	const { baseline, resolved, legs, declaredJunctionByPointIndex, hostSnaps } = input;
	const invalid = (message: string): { rejection: WallChainRejection } => ({
		rejection: { code: 'invalid_candidate_document', message }
	});
	const declaredHostByPointIndex = new Map<number, string>();
	for (const snap of hostSnaps) {
		if (!Number.isInteger(snap.pointIndex) || snap.pointIndex < 0 || snap.pointIndex >= resolved.length) {
			return invalid(
				`Declared host Wall '${snap.wallId}' names draft point ${snap.pointIndex}, which this chain does not have`
			);
		}
		if (declaredHostByPointIndex.has(snap.pointIndex)) {
			return invalid(`Draft point ${snap.pointIndex} declares more than one host Wall`);
		}
		declaredHostByPointIndex.set(snap.pointIndex, snap.wallId);
	}

	const componentKeyByWallId = topologyComponentKeyByWallId(baseline);
	const componentKeyByJunctionId = topologyComponentKeyByJunctionId(baseline, componentKeyByWallId);
	for (const [pointIndex, wallId] of declaredHostByPointIndex) {
		const host = wallById(baseline, wallId);
		if (!host) {
			return invalid(`Declared host Wall '${wallId}' is not part of the baseline document`);
		}
		// A Junction anchor on the same point is the stronger statement of the group
		// being extended, so host and Junction must agree about that group.
		const declaredJunctionId = declaredJunctionByPointIndex.get(pointIndex);
		if (declaredJunctionId !== undefined) {
			const junctionKey = componentKeyByJunctionId.get(declaredJunctionId);
			if (junctionKey === undefined || junctionKey !== componentKeyByWallId.get(wallId)) {
				return invalid(
					`Draft point ${pointIndex} declares a Junction and host Wall '${wallId}' in different connected components`
				);
			}
		}
	}

	// "Already-declared connection to its component": a declaration that does not
	// itself meet its host is still valid when another declaration of this same
	// operation already reaches that host's component (redundant, never a join).
	// Direct relationships are collected first, so the verdict is order-independent.
	const reachableComponentKeys = new Set<string | symbol>();
	for (const [pointIndex, wallId] of declaredHostByPointIndex) {
		if (declarationMeetsHost(baseline, legs, resolved[pointIndex]!.point, wallId)) {
			const key = componentKeyByWallId.get(wallId);
			if (key !== undefined) reachableComponentKeys.add(key);
		}
	}
	for (const junctionId of declaredJunctionByPointIndex.values()) {
		const key = componentKeyByJunctionId.get(junctionId);
		if (key !== undefined) reachableComponentKeys.add(key);
	}
	for (const [pointIndex, wallId] of declaredHostByPointIndex) {
		if (declarationMeetsHost(baseline, legs, resolved[pointIndex]!.point, wallId)) continue;
		const key = componentKeyByWallId.get(wallId);
		if (key !== undefined && reachableComponentKeys.has(key)) continue;
		return invalid(`Declared host Wall '${wallId}' is unrelated to draft point ${pointIndex}`);
	}
	return { declaredHostByPointIndex };
}

/**
 * Whether a host declaration names a Wall this operation genuinely relates to:
 * the declared point sits on the host's centerline, or one of the operation's own
 * legs meets it. Reuses the canonical straight classifier and the canonical
 * sampled projection — never a bespoke distance threshold.
 */
function declarationMeetsHost(
	baseline: LayoutDocumentWallFirst,
	legs: readonly { start: LayoutVec2; end: LayoutVec2 }[],
	point: LayoutVec2,
	wallId: string
): boolean {
	const host = wallById(baseline, wallId);
	if (!host) return false;
	const endpoints = wallEndpointPoints(baseline, host);
	if (!endpoints) return false;
	if (wallCenterlineCarriesPoint(host, endpoints.start, endpoints.end, point)) return true;
	return legs.some((leg) => legMeetsWall(host, endpoints, leg));
}

/** The canonical endpoint coordinates of `wall`, or `undefined` when unresolved. */
function wallEndpointPoints(
	baseline: LayoutDocumentWallFirst,
	wall: LayoutWall
): { start: LayoutVec2; end: LayoutVec2 } | undefined {
	const start = baseline.junctions.find((junction) => junction.id === wall.startJunctionId);
	const end = baseline.junctions.find((junction) => junction.id === wall.endJunctionId);
	if (!start || !end) return undefined;
	return { start: start.point, end: end.point };
}

/**
 * Does a straight draft leg meet this Wall? Straight hosts go through the
 * canonical pair classifier; a curved host is tested against its canonical
 * sampled centerline, so crossing detection stays with the curve authority.
 */
function legMeetsWall(
	host: LayoutWall,
	endpoints: { start: LayoutVec2; end: LayoutVec2 },
	leg: { start: LayoutVec2; end: LayoutVec2 }
): boolean {
	const legSegment: TopologySegment = { id: 'declared-host:leg', start: leg.start, end: leg.end };
	if (host.centerline.kind === 'line') {
		return relates(
			classifyWallIntersection(legSegment, { id: host.id, start: endpoints.start, end: endpoints.end }, [])
		);
	}
	const sampled = wallCenterlineSamples(host, endpoints.start, endpoints.end, 'forward');
	if (!sampled) return false;
	if (projectPointToSampledSegment(leg.start, sampled).distanceToPath <= JUNCTION_COINCIDENCE_EPSILON) return true;
	if (projectPointToSampledSegment(leg.end, sampled).distanceToPath <= JUNCTION_COINCIDENCE_EPSILON) return true;
	for (let index = 1; index < sampled.samples.length; index += 1) {
		const from = sampled.samples[index - 1]!.point;
		const to = sampled.samples[index]!.point;
		if (relates(classifyWallIntersection(legSegment, { id: host.id, start: from, end: to }, []))) return true;
	}
	return false;
}

/** A classified pair relates when it is anything but disjoint or numerically unstable. */
function relates(classification: { kind: string }): boolean {
	return classification.kind !== 'none' && classification.kind !== 'invalid';
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

/**
 * The Junction this operation may ADOPT at `point` (P23B.3a S6).
 *
 * A record is adoptable when it is an endpoint of one of the relationship's own
 * Walls, or when it belongs to the component those Walls are in. A coincident
 * record from an UNRELATED component is never adoptable: adopting it would be an
 * implicit cross-group join — the exact authoring reflex the declared-intent
 * split removes. Own endpoints are preferred over other component members, and
 * document order decides within each pass, so the choice stays deterministic.
 */
function adoptableJunctionAt(
	document: LayoutDocumentWallFirst,
	walls: readonly LayoutWall[],
	point: LayoutVec2,
	junctionComponentKeyById: ReadonlyMap<string, JunctionTopologyComponentKey>,
	componentKeyByWallId: ReadonlyMap<string, string>
): LayoutJunction | undefined {
	const ownJunctionIds = new Set<string>();
	const ownComponentKeys = new Set<string | symbol>();
	for (const wall of walls) {
		ownJunctionIds.add(wall.startJunctionId);
		ownJunctionIds.add(wall.endJunctionId);
		const key = componentKeyByWallId.get(wall.id);
		if (key !== undefined) ownComponentKeys.add(key);
	}
	const coincident = document.junctions.filter((junction) =>
		coincidesAsJunction(junction.point, point)
	);
	const ownEndpoint = coincident.find((junction) => ownJunctionIds.has(junction.id));
	if (ownEndpoint) return ownEndpoint;
	return coincident.find((junction) => {
		const key = junctionComponentKeyById.get(junction.id);
		return key !== undefined && ownComponentKeys.has(key);
	});
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
 * Find the next un-noded relationship this operation is AUTHORIZED to resolve: a
 * chain wall against a Wall it may acquire topology from — a DECLARED host, or a
 * Wall already in the chain's own connected component (P23B.3a S6). A pair
 * involving an independent, undeclared Wall is skipped outright, so a permitted
 * overlap never becomes a join. Returns `null` when no such relationship remains.
 */
function nextNodingFix(
	document: LayoutDocumentWallFirst,
	chainDerivedWallIds: readonly string[],
	operationOwnedJunctionIds: ReadonlySet<string>,
	endpointHostWallIds: ReadonlyMap<string, string>
): NodingFix | null {
	const chainSet = new Set(chainDerivedWallIds);
	// P23B.3a S6 — the operation's DECLARED scope. `declaredHostWallIds` are the
	// pre-existing Walls this chain explicitly anchored to; any other pre-existing
	// Wall is authorizable only by CONNECTIVITY (the chain is already in its
	// component, because it adopted one of that group's Junctions or earlier
	// noding joined them). With no anchors the chain is its own component, so no
	// pre-existing Wall is authorizable and this function finds no fix at all:
	// independent placement neither adopts nor splits, and its overlaps stay the
	// permitted geometry S4/S5 admit.
	const declaredHostWallIds = new Set(endpointHostWallIds.values());
	const componentKeyByWallId = topologyComponentKeyByWallId(document);
	const junctionComponentKeyById = topologyComponentKeyByJunctionId(document, componentKeyByWallId);
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
			// AUTHORIZATION (above): only a DECLARED host Wall, or a Wall the chain
			// is already connected to, may acquire topology from this operation. A
			// cross-group pair is skipped outright — no adoption, no split — which is
			// what keeps an independent overlap from becoming a join.
			const chainWallId = chainSet.has(a.id) ? a.id : b.id;
			const hostWallId = chainSet.has(a.id) ? b.id : a.id;
			if (
				!declaredHostWallIds.has(hostWallId) &&
				componentKeyByWallId.get(chainWallId) !== componentKeyByWallId.get(hostWallId)
			) {
				continue;
			}
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
				const existing = adoptableJunctionAt(
					document,
					[a, b],
					classified.point,
					junctionComponentKeyById,
					componentKeyByWallId
				);
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
				const coincident = adoptableJunctionAt(
					document,
					[a, b],
					classified.point,
					junctionComponentKeyById,
					componentKeyByWallId
				);
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
 * Final topology gate over the committed candidate: every wall pair IN ONE
 * CONNECTED COMPONENT must relate only through explicit shared junctions (or be
 * disjoint). This is the same bar `validateWallFirstTopology` holds the P23.1
 * precision and P23.6a Room-move candidates to — the P23.9 plan forbids un-noded
 * visual crossings in committed data — and, since P23B.3a S5, the same SUBJECT:
 * the connected component, not the document.
 *
 * Connectivity is the TRANSITIVE closure of explicit authored Junction identity,
 * never coordinates: two Walls with no Junction id in common can still be one
 * component through a third Wall, and two Walls whose endpoints merely coincide are
 * in different components. Labelling is the S2 general Wall/Junction test.
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
	//
	// P23B.3a S5 — SUBJECT: the sampled authority is called with ITS shipped subject
	// (the connected component); the transitional document-subject form S4 left for
	// this caller is gone. The chord loop below is scoped the same way, in the same
	// commit, so the two halves of this gate cannot disagree — and neither can this
	// gate and `validateWallFirstTopology`. NOT changed here: this planner's own
	// AUTHORING behaviour. Adoption and crossing-split still run exactly as they do
	// for an operation that DECLARES the group it extends; withdrawing them from
	// INDEPENDENT placement is the authoring-intent split S6 landed in the draft
	// normalization and `nextNodingFix` above/without touching this verdict.
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
	// P23B.3a S5 — the chord half takes the SAME subject as everything above it: a
	// pair from two different components is permitted geometry, so it is skipped
	// before the unchanged classifier sees it. Every pair that shares an explicit
	// Junction is in one component by construction, so the `shared-explicit-junction`
	// branch below is never skipped and no same-component verdict is lost.
	const keyByWallId = topologyComponentKeyByWallId(document);
	for (let first = 0; first < entries.length; first += 1) {
		for (let second = first + 1; second < entries.length; second += 1) {
			const a = entries[first]!.wall;
			const b = entries[second]!.wall;
			if (keyByWallId.get(a.id) !== keyByWallId.get(b.id)) continue;
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
 * Birth height is a vertical-coherence rule, not a topology rule, so it keeps a
 * coordinate fallback: the Junction `resolveWallBirthHeight` reads is the DECLARED
 * start anchor when the caller names one, else the Junction coinciding with the
 * start. Topology does NOT follow that fallback — adoption happens only through
 * the declared anchors on this signature (P23B.3a S6). Continuation *inside one active draw run* stays an
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
	/**
	 * P23B.3a S6 — DECLARED connection anchors (host-Wall form), keyed by point
	 * index exactly like `endpointJunctionSnaps`: a segment that terminates on an
	 * existing Wall's span (a divider landing on the enclosure) says so here, and
	 * that declaration is what authorizes noding inside that host's group.
	 *
	 * The Junction form is the stronger statement (it names the identity the
	 * operation extends); this form names the host span the author attached to and
	 * lets the canonical noding rule split that host, sharing the Junction it
	 * mints. `endpointHostWallId` is the single-end spelling of this same anchor
	 * and both are honoured together.
	 */
	endpointHostSnaps?: readonly WallEndpointHostSnap[];
	/**
	 * P23B.3a S6 — DECLARED connection anchors for this segment (junction form),
	 * keyed by point index: `0` is `start`, `1` is `end`. Supplying either one is
	 * the operation declaring that it EXTENDS the group it names (class 3), so
	 * adoption and noding apply inside that group; supplying neither — and no
	 * `endpointHostWallId` — declares INDEPENDENT placement (class 2), where no
	 * coordinate coincidence is adopted and no host Wall is split. A run
	 * continuation passes the run's own canonical Junction; a deliberate node
	 * snap passes the Junction the author snapped to.
	 */
	endpointJunctionSnaps?: readonly WallEndpointJunctionSnap[];
}): WallChainPlan {
	const declaredStartJunctionId = options.endpointJunctionSnaps?.find(
		(snap) => snap.pointIndex === 0
	)?.junctionId;
	// Birth height (P23.6I) is a vertical-coherence rule, not a topology rule, so
	// it keeps its coordinate fallback: a segment whose start sits on a Junction
	// inherits that Junction's height whether or not the operation declared the
	// identity. A declared anchor is authoritative when both are present.
	const coordinateStartJunction = options.baseline.junctions.find((junction) =>
		coincidesAsJunction(junction.point, options.start)
	);
	// S6 — one merged declaration list: the single-end spelling (`endpointHostWallId`,
	// what the editor passes for the endpoint the author snapped to) plus the
	// general per-point form a headless caller uses to declare both ends.
	const declaredHostSnaps: WallEndpointHostSnap[] = [
		...(options.endpointHostWallId ? [{ pointIndex: 1, wallId: options.endpointHostWallId }] : []),
		...(options.endpointHostSnaps ?? [])
	];
	return planWallChain({
		baseline: options.baseline,
		points: [options.start, options.end],
		close: false,
		role: options.role,
		height: resolveWallBirthHeight(
			options.baseline,
			declaredStartJunctionId ?? coordinateStartJunction?.id ?? null,
			options.height
		),
		...(options.thickness !== undefined ? { thickness: options.thickness } : {}),
		...(declaredHostSnaps.length > 0 ? { endpointHostSnaps: declaredHostSnaps } : {}),
		...(options.endpointJunctionSnaps && options.endpointJunctionSnaps.length > 0
			? { endpointJunctionSnaps: options.endpointJunctionSnaps }
			: {}),
		...(options.allocator !== undefined ? { allocator: options.allocator } : {})
	});
}

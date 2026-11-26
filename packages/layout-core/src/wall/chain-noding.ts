import type { LayoutDocumentWallFirst, LayoutJunction, LayoutWall } from './types';
import type { LayoutVec2 } from '../geometry/coordinates';
import { cubicBezierPoint, projectPointToSampledSegment } from '../geometry/curve';
import type { TopologySegment } from './topology';
import { classifyWallIntersection } from './topology';
import type { JunctionTopologyComponentKey } from '../room/topology-components';
import {
	topologyComponentKeyByJunctionId,
	topologyComponentKeyByWallId,
} from '../room/topology-components';
import type { NodingIdAllocator } from './noding';
import {
	wallCenterlineCarriesPoint,
	wallCenterlineCubics,
	wallCenterlineSamples,
} from './centerline';
import { isClosedWall } from './closed-wall';
import { JUNCTION_COINCIDENCE_EPSILON, coincidesAsJunction } from './junction-identity';
import type { WallChainIdAllocator, WallChainRejection, WallEndpointHostSnap } from './chain-types';
import type { NodingFix } from './chain-repair';

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
 * one component      ALL declarations (hosts and Junction anchors alike) resolve
 *                    to ONE pre-existing component — class 3, not the deferred
 *                    class-4 Join (D-10)
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
export function validateEndpointHostSnaps(input: {
	baseline: LayoutDocumentWallFirst;
	resolved: readonly { junctionId: string | null; point: LayoutVec2 }[];
	legs: readonly { start: LayoutVec2; end: LayoutVec2 }[];
	declaredJunctionByPointIndex: ReadonlyMap<number, string>;
	hostSnaps: readonly WallEndpointHostSnap[];
}): { rejection: WallChainRejection } | { declaredHostByPointIndex: Map<number, string> } {
	const { baseline, resolved, legs, declaredJunctionByPointIndex, hostSnaps } = input;
	const invalid = (message: string): { rejection: WallChainRejection } => ({
		rejection: { code: 'invalid_candidate_document', message },
	});
	const declaredHostByPointIndex = new Map<number, string>();
	for (const snap of hostSnaps) {
		if (
			!Number.isInteger(snap.pointIndex) ||
			snap.pointIndex < 0 ||
			snap.pointIndex >= resolved.length
		) {
			return invalid(
				`Declared host Wall '${snap.wallId}' names draft point ${snap.pointIndex}, which this chain does not have`,
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
					`Draft point ${pointIndex} declares a Junction and host Wall '${wallId}' in different connected components`,
				);
			}
		}
	}

	// ONE PRE-EXISTING COMPONENT PER OPERATION (ratified four-class model). Class 3
	// EXTENDS one already connected group; joining two previously independent groups
	// is class 4, the deliberate Join/Connect that D-10 defers. A single chain may
	// therefore name many Walls and Junctions — all of the SAME baseline component —
	// and any pair of independent components is a Join by another route: it is refused
	// deterministically, never bridged, and never silently narrowed to one of them.
	// (An UNRELATED component the chain merely crosses stays untouched: this check
	// reads declarations only, never the draft geometry.)
	const declarationComponentKeys = new Set<string | symbol>();
	const targetedClosedComponentKeys = new Set<string | symbol>();
	const wallByIdMap = new Map(baseline.walls.map((w) => [w.id, w] as const));
	for (const wallId of declaredHostByPointIndex.values()) {
		const key = componentKeyByWallId.get(wallId);
		if (key !== undefined) {
			declarationComponentKeys.add(key);
			const w = wallByIdMap.get(wallId);
			if (w && isClosedWall(w)) targetedClosedComponentKeys.add(key);
		}
	}
	for (const junctionId of declaredJunctionByPointIndex.values()) {
		const key = componentKeyByJunctionId.get(junctionId);
		if (key !== undefined) {
			declarationComponentKeys.add(key);
			for (const w of baseline.walls) {
				if (isClosedWall(w) && w.startJunctionId === junctionId) {
					targetedClosedComponentKeys.add(key);
				}
			}
		}
	}
	if (declarationComponentKeys.size > 1) {
		const nonClosedComponentKeys = [...declarationComponentKeys].filter(
			(key) => !targetedClosedComponentKeys.has(key),
		);
		// C2 multi-host attachment: explicitly targeted closed Walls are isolated
		// single-Wall components before first attachment, so bridging O–O (or R–O)
		// in one stroke is admitted whenever at most one non-closed component is
		// involved. Two or more independent non-closed groups still require either
		// re-closing one open Space (F3) or the deferred class-4 join (D-10).
		if (nonClosedComponentKeys.length > 1) {
			// F3 — one open Space is one authored group even when its surviving Walls
			// sit in several topology components (an opposite-Wall erase). A chain that
			// declares only that Space's own boundary Junctions/Walls re-closes the
			// Space; it is not the deferred class-4 join of two independent structures.
			const declaredJunctionIds = [...declaredJunctionByPointIndex.values()];
			const declaredHostWallIds = [...declaredHostByPointIndex.values()];
			if (!declarationsRecloseOneOpenSpace(baseline, declaredJunctionIds, declaredHostWallIds)) {
				return invalid(
					'Chain declarations name more than one connected component; joining independent groups is a deliberate join operation',
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
 * True when every declared Junction and host Wall belongs to the SAME open
 * Space's authored boundary. Such declarations re-close that one Space even
 * though its surviving Walls may sit in different topology components: F3
 * makes the Space, not the component labelling, the authored group.
 */
function declarationsRecloseOneOpenSpace(
	baseline: LayoutDocumentWallFirst,
	declaredJunctionIds: readonly string[],
	declaredHostWallIds: readonly string[],
): boolean {
	const junctionIds = new Set(declaredJunctionIds);
	const hostWallIds = new Set(declaredHostWallIds);
	for (const room of baseline.rooms) {
		if (room.virtualEdges.length === 0) continue;
		const roomJunctionIds = new Set<string>();
		const roomWallIds = new Set<string>();
		for (const ref of room.boundary) {
			roomWallIds.add(ref.wallId);
			const wall = wallById(baseline, ref.wallId);
			if (!wall) continue;
			roomJunctionIds.add(wall.startJunctionId);
			roomJunctionIds.add(wall.endJunctionId);
		}
		for (const edge of room.virtualEdges) {
			roomJunctionIds.add(edge.startJunctionId);
			roomJunctionIds.add(edge.endJunctionId);
		}
		if (![...junctionIds].every((junctionId) => roomJunctionIds.has(junctionId))) continue;
		if (![...hostWallIds].every((wallId) => roomWallIds.has(wallId))) continue;
		return true;
	}
	return false;
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
	wallId: string,
): boolean {
	const host = wallById(baseline, wallId);
	if (!host) return false;
	const endpoints = wallEndpointPoints(baseline, host);
	if (!endpoints) return false;
	if (wallCenterlineCarriesPoint(host, endpoints.start, endpoints.end, point)) return true;
	if (host.centerline.kind === 'cubic-chain') {
		const cubics = wallCenterlineCubics(host.centerline, endpoints.start, endpoints.end, 'forward');
		const ulp = Math.max(1, Math.abs(point[0]), Math.abs(point[1])) * Number.EPSILON;
		const tol = Math.max(JUNCTION_COINCIDENCE_EPSILON, 8 * ulp);
		const pad = Math.max(1e-3, tol);
		for (const cubic of cubics) {
			const xs = [cubic.start[0], cubic.handleOut[0], cubic.handleIn[0], cubic.end[0]];
			const zs = [cubic.start[1], cubic.handleOut[1], cubic.handleIn[1], cubic.end[1]];
			if (
				point[0] < Math.min(...xs) - pad ||
				point[0] > Math.max(...xs) + pad ||
				point[1] < Math.min(...zs) - pad ||
				point[1] > Math.max(...zs) + pad
			) {
				continue;
			}
			// Sample 16 coarse intervals, then ternary-refine the closest bracket.
			let bestT = 0;
			let bestDistSq = Infinity;
			for (let s = 0; s <= 16; s += 1) {
				const t = s / 16;
				const p = cubicBezierPoint(cubic, t);
				const dSq = (p[0] - point[0]) ** 2 + (p[1] - point[1]) ** 2;
				if (dSq < bestDistSq) {
					bestDistSq = dSq;
					bestT = t;
				}
			}
			let lo = Math.max(0, bestT - 1 / 16);
			let hi = Math.min(1, bestT + 1 / 16);
			for (let iter = 0; iter < 48; iter += 1) {
				const m1 = lo + (hi - lo) / 3;
				const m2 = hi - (hi - lo) / 3;
				const p1 = cubicBezierPoint(cubic, m1);
				const p2 = cubicBezierPoint(cubic, m2);
				const d1 = (p1[0] - point[0]) ** 2 + (p1[1] - point[1]) ** 2;
				const d2 = (p2[0] - point[0]) ** 2 + (p2[1] - point[1]) ** 2;
				if (d1 < d2) hi = m2;
				else lo = m1;
			}
			const bestPt = cubicBezierPoint(cubic, (lo + hi) * 0.5);
			if (Math.hypot(point[0] - bestPt[0], point[1] - bestPt[1]) <= tol) {
				return true;
			}
		}
	}
	return legs.some((leg) => legMeetsWall(host, endpoints, leg));
}

/** The canonical endpoint coordinates of `wall`, or `undefined` when unresolved. */
function wallEndpointPoints(
	baseline: LayoutDocumentWallFirst,
	wall: LayoutWall,
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
	leg: { start: LayoutVec2; end: LayoutVec2 },
): boolean {
	const legSegment: TopologySegment = { id: 'declared-host:leg', start: leg.start, end: leg.end };
	if (host.centerline.kind === 'line') {
		return relates(
			classifyWallIntersection(
				legSegment,
				{ id: host.id, start: endpoints.start, end: endpoints.end },
				[],
			),
		);
	}
	const sampled = wallCenterlineSamples(host, endpoints.start, endpoints.end, 'forward');
	if (!sampled) return false;
	if (
		projectPointToSampledSegment(leg.start, sampled).distanceToPath <= JUNCTION_COINCIDENCE_EPSILON
	)
		return true;
	if (projectPointToSampledSegment(leg.end, sampled).distanceToPath <= JUNCTION_COINCIDENCE_EPSILON)
		return true;
	for (let index = 1; index < sampled.samples.length; index += 1) {
		const from = sampled.samples[index - 1]!.point;
		const to = sampled.samples[index]!.point;
		if (relates(classifyWallIntersection(legSegment, { id: host.id, start: from, end: to }, [])))
			return true;
	}
	return false;
}

/** A classified pair relates when it is anything but disjoint or numerically unstable. */
function relates(classification: { kind: string }): boolean {
	return classification.kind !== 'none' && classification.kind !== 'invalid';
}

/**
 * The Junction this operation may ADOPT at `point`.
 *
 * A record is adoptable when it is an endpoint of one of the relationship's own
 * Walls, or when it belongs to the component those Walls are in. A coincident
 * record from an UNRELATED component is never adoptable: adopting it would be an
 * implicit cross-group join — the exact authoring reflex the declared-intent
 * split removes. Own endpoints are preferred over other component members, and
 * document order decides within each pass, so the choice stays deterministic.
 */
export function adoptableJunctionAt(
	document: LayoutDocumentWallFirst,
	walls: readonly LayoutWall[],
	point: LayoutVec2,
	junctionComponentKeyById: ReadonlyMap<string, JunctionTopologyComponentKey>,
	componentKeyByWallId: ReadonlyMap<string, string>,
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
		coincidesAsJunction(junction.point, point),
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
export function duplicateJunctionsAt(
	document: LayoutDocumentWallFirst,
	walls: readonly LayoutWall[],
	point: LayoutVec2,
	keepJunctionId: string,
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
export function teeThroughJunction(
	segments: readonly TopologySegment[],
	junction: LayoutJunction,
): NodingFix | undefined {
	for (const segment of segments) {
		const length = Math.hypot(segment.end[0] - segment.start[0], segment.end[1] - segment.start[1]);
		const splitDistance = Math.hypot(
			junction.point[0] - segment.start[0],
			junction.point[1] - segment.start[1],
		);
		if (splitDistance <= JUNCTION_COINCIDENCE_EPSILON) continue;
		if (length - splitDistance <= JUNCTION_COINCIDENCE_EPSILON) continue;
		return {
			kind: 'tee',
			interiorWallId: segment.id,
			endpointJunctionId: junction.id,
			splitDistance,
			point: [junction.point[0], junction.point[1]],
		};
	}
	return undefined;
}

export function wallById(
	document: LayoutDocumentWallFirst,
	wallId: string,
): LayoutWall | undefined {
	return document.walls.find((wall) => wall.id === wallId);
}

/** Oriented boundary polygon of a wall-first room (junction traversal order). */
/** Adapt the chain allocator to the noding allocator contract. */
export function nodingAllocatorAdapter(
	allocator: WallChainIdAllocator,
	_document: LayoutDocumentWallFirst,
): NodingIdAllocator {
	return {
		nextWallId(baseDocument, seed) {
			return allocator.nextWallId(new Set(baseDocument.walls.map((wall) => wall.id)), seed);
		},
		nextJunctionId(baseDocument, seed) {
			return allocator.nextJunctionId(
				new Set(baseDocument.junctions.map((junction) => junction.id)),
				seed,
			);
		},
	};
}

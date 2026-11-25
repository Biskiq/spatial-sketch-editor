import { cowSetWallCenterline } from '../world/cow'
import { ensureLayoutWorldIndex, peekLayoutWorldIndex } from '../world/lookups';
import type { LayoutDocumentWallFirst } from '../wall/types';
import type { LayoutWall } from '../wall/types';
import type { LayoutWallCenterline } from '../wall/types';
import type { LayoutWallCurveKnot } from '../wall/types';
import { nextWallCurveKnotId, wallCubicChain } from '../wall/centerline';
import { guardRoundRoomMemberGeometryEdit } from '../room/round-room';
import { deriveChainSpans } from '../geometry/curve';
import type { WallCurveChain, WallCurveEditRejection } from '../wall/curve-algebra';
import { insertWallCurveKnot, moveWallCurveKnot } from '../wall/curve-algebra';
import { coincidesAsJunction } from '../wall/junction-identity';
import type { LayoutVec2 } from '../geometry/coordinates';
import type { PrecisionOperation, PrecisionPlan, PrecisionRejection } from './types';
import { MAX_WALL_CURVE_KNOTS } from './types';
import { POINT_EPSILON } from '../vec2';
import { wallEndpoints } from './document';
import { finalizeWallGeometryCandidate, hasAnyTestObserverInPrecision } from './finalization';
import { finitePoint, reject, rejectRoundMember } from './rejections';
import { proposeWallKnotRemoval } from './wall-bends';

// =====================================================================
// Canonical curve operations.
//
// Every planner builds a candidate from the immutable baseline, mutates only
// canonical Layout data, allocates deterministic anchor IDs, runs the shared
// `finalizeWallGeometryCandidate` acceptance path, and returns either one
// accepted document or a stable rejection. Wall, Junction, Opening and Room
// identities are preserved throughout: a curve edit never births or retires
// anything, it only reshapes the Wall's own centerline.
//
// Rejections leave the baseline untouched — the caller commits the returned
// document or nothing at all.
// =====================================================================

/** The shared straight-only rejection so every curve gate reads identically. */
export function rejectCurvedWall(operation: string, wallId: string): PrecisionPlan {
	return reject(
		'curved_wall_unsupported',
		`Wall '${wallId}' is curved; ${operation} is supported for straight Walls only`,
		[wallId]
	);
}


/**
 * Resolved inputs shared by the bend-point planners.
 *
 * `chain` is the Wall's canonical chain as the algebra primitives see it: its
 * stored knots and spans, or — for a straight Wall when `allowStraight` is set —
 * the exact straight cubic on its chord, so the Bend gesture can curve a
 * straight Wall without a separate "convert first" step.
 */
export function resolveCurveTarget(
	document: LayoutDocumentWallFirst,
	wallId: string,
	options: { allowStraight?: boolean } = {}
):
	| { plan: PrecisionPlan }
	| {
			wall: LayoutWall;
			start: LayoutVec2;
			end: LayoutVec2;
			chain: WallCurveChain;
	  } {
	const worldIndex = peekLayoutWorldIndex(document);
	const wall = worldIndex
		? worldIndex.wallById.get(wallId)
		: document.walls.find((candidate) => candidate.id === wallId);
	if (!wall) return { plan: reject('unknown_wall', `Unknown wall '${wallId}'`, [wallId]) };
	const endpoints = wallEndpoints(document, wall, worldIndex?.pointById);
	if (!endpoints) {
		return {
			plan: reject('unsupported_geometry', `Wall '${wallId}' has unresolved junction geometry`, [wallId])
		};
	}
	if (wall.centerline.kind !== 'cubic-chain') {
		if (!options.allowStraight) {
			return {
				plan: reject(
					'unsupported_geometry',
					`Wall '${wallId}' is straight; convert it to a curve before editing its bend points`,
					[wallId]
				)
			};
		}
		return {
			wall,
			start: endpoints.start,
			end: endpoints.end,
			chain: {
				startPoint: endpoints.start,
				endPoint: endpoints.end,
				knots: [],
				spans: deriveChainSpans([endpoints.start, endpoints.end])
			}
		};
	}
	return {
		wall,
		start: endpoints.start,
		end: endpoints.end,
		chain: {
			startPoint: endpoints.start,
			endPoint: endpoints.end,
			knots: wall.centerline.knots,
			spans: wall.centerline.spans
		}
	};
}


/**
 * Map the shared curve-algebra rejections onto this module's stable codes. A
 * caller never sees an algebra-internal code, and every curve planner reports
 * the same rejection for the same condition.
 */
export function curveEditRejection(code: WallCurveEditRejection): PrecisionRejection['code'] {
	switch (code) {
		case 'knot_not_found':
			return 'unknown_curve_anchor';
		case 'knot_already_exists':
			return 'no_op';
		case 'split_out_of_range':
			return 'split_distance_out_of_range';
		case 'split_at_endpoint':
			return 'split_at_existing_endpoint';
		case 'invalid_point':
			return 'invalid_value';
		default:
			return 'unsupported_geometry';
	}
}


/**
 * Rebuild one Wall's cubic chain from a new bend-point list.
 *
 * This is the **write path**: the canonical smoothness rule runs here, once,
 * and its result is persisted. The read path (`centerline → cubics → samples`)
 * consumes the stored spans and never re-derives them, which is what keeps
 * subdivision and rigid translation exact.
 */
function chainFromKnots(
	knots: readonly LayoutWallCurveKnot[],
	start: LayoutVec2,
	end: LayoutVec2
): LayoutWallCenterline {
	const points: LayoutVec2[] = [start, ...knots.map((knot) => knot.point), end];
	return wallCubicChain(knots, deriveChainSpans(points));
}


/** Commit a candidate that only reshaped one Wall's own centerline. */
export function finalizeCurveCandidate(
	baseline: LayoutDocumentWallFirst,
	candidate: LayoutDocumentWallFirst,
	operation: PrecisionOperation,
	wallId: string
): PrecisionPlan {
	return finalizeWallGeometryCandidate({
		baseline,
		candidate,
		operation,
		changedJunctionIds: [],
		changedWallIds: [wallId]
	});
}


/** Write one Wall's centerline into a fresh candidate document. */
export function withWallCenterline(
	document: LayoutDocumentWallFirst,
	wallId: string,
	centerline: LayoutWall['centerline']
): LayoutDocumentWallFirst {
	const worldIndex = !hasAnyTestObserverInPrecision() ? ensureLayoutWorldIndex(document) : peekLayoutWorldIndex(document);
	return cowSetWallCenterline(document, wallId, centerline, worldIndex);
}


/**
 * Convert one straight Wall into a curved one, keeping every authored ID.
 *
 * The single initial control is planted on the exact Wall midpoint, so the
 * interpolating spline is degenerate-straight: the Wall keeps its length,
 * direction and every hosted Opening offset, and nothing moves on screen until
 * a control is actually dragged. Committing one history entry.
 */
export function planConvertWallToCurve(
	document: LayoutDocumentWallFirst,
	wallId: string
): PrecisionPlan {
	const worldIndex = peekLayoutWorldIndex(document);
	const wall = worldIndex
		? worldIndex.wallById.get(wallId)
		: document.walls.find((candidate) => candidate.id === wallId);
	if (!wall) return reject('unknown_wall', `Unknown wall '${wallId}'`, [wallId]);
	const curveRoundHit = guardRoundRoomMemberGeometryEdit(document, { wallIds: [wallId] });
	if (curveRoundHit) return rejectRoundMember(curveRoundHit);
	if (wall.centerline.kind === 'cubic-chain') {
		return reject('no_op', `Wall '${wallId}' is already curved`, [wallId]);
	}
	const endpoints = wallEndpoints(document, wall, worldIndex?.pointById);
	if (!endpoints) {
		return reject('unsupported_geometry', `Wall '${wallId}' has unresolved junction geometry`, [wallId]);
	}
	if (!(endpoints.length > POINT_EPSILON)) {
		return reject('unsupported_geometry', `Wall '${wallId}' has zero effective length`, [wallId]);
	}
	const midpoint: LayoutVec2 = [
		(endpoints.start[0] + endpoints.end[0]) / 2,
		(endpoints.start[1] + endpoints.end[1]) / 2
	];
	const knot: LayoutWallCurveKnot = {
		id: nextWallCurveKnotId(wallId, []),
		point: midpoint
	};
	const candidate = withWallCenterline(
		document,
		wallId,
		chainFromKnots([knot], endpoints.start, endpoints.end)
	);
	return finalizeCurveCandidate(document, candidate, 'wall-convert-to-curve', wallId);
}


/**
 * Convert one curved Wall back to a straight one, keeping every authored ID.
 * Endpoints are owned by the Junctions, so removing the controls cannot move
 * the Wall; the resulting straight Wall — and its hosted Openings — are
 * validated through the canonical acceptance path and reject atomically if the
 * straight form cannot host them.
 */
export function planConvertWallToLine(
	document: LayoutDocumentWallFirst,
	wallId: string
): PrecisionPlan {
	const worldIndex = peekLayoutWorldIndex(document);
	const wall = worldIndex
		? worldIndex.wallById.get(wallId)
		: document.walls.find((candidate) => candidate.id === wallId);
	if (!wall) return reject('unknown_wall', `Unknown wall '${wallId}'`, [wallId]);
	const lineRoundHit = guardRoundRoomMemberGeometryEdit(document, { wallIds: [wallId] });
	if (lineRoundHit) return rejectRoundMember(lineRoundHit);
	if (wall.centerline.kind === 'line') {
		return reject('no_op', `Wall '${wallId}' is already straight`, [wallId]);
	}
	const candidate = withWallCenterline(document, wallId, { kind: 'line' });
	return finalizeCurveCandidate(document, candidate, 'wall-convert-to-line', wallId);
}


/**
 * Insert one bend point at a physical arc distance **without moving the curve**.
 *
 * Insertion is the exact de Casteljau cut of the containing cubic, so the two
 * new spans together are the original span and every other span is untouched:
 * the Wall keeps its sampled centerline, its length and every hosted Opening
 * offset until the new bend point is actually dragged. Insertion is therefore
 * safe to commit on its own (context-menu / Inspector "Add Bend Point"), and it
 * is also the first half of the Bend gesture.
 *
 * A **straight** Wall needs no separate "Curved wall" step: the target chain is
 * the exactly-straight cubic on its chord, and the exact subdivision of that
 * cubic is again exactly straight, so one atomic candidate converts the Wall to
 * a cubic chain, plants the bend point at the clicked physical position and
 * leaves the geometry visually unchanged. The Bend gesture and the visible
 * "Add bend point here" action therefore share one insertion authority.
 */
export function planInsertWallCurveKnot(
	document: LayoutDocumentWallFirst,
	wallId: string,
	distance: number,
	options: { knotId?: string } = {}
): PrecisionPlan {
	const target = resolveCurveTarget(document, wallId, { allowStraight: true });
	if ('plan' in target) return target.plan;
	const insertRoundHit = guardRoundRoomMemberGeometryEdit(document, { wallIds: [wallId] });
	if (insertRoundHit) return rejectRoundMember(insertRoundHit);
	const { chain } = target;
	if (!Number.isFinite(distance)) {
		return reject('invalid_value', 'Bend point distance must be a finite number of meters', [wallId]);
	}
	if (chain.knots.length >= MAX_WALL_CURVE_KNOTS) {
		return reject(
			'curve_knot_limit',
			`Wall '${wallId}' already has ${MAX_WALL_CURVE_KNOTS} bend points, the maximum a new insertion may produce`,
			[wallId]
		);
	}
	const insertion = insertWallCurveKnot(
		chain,
		distance,
		options.knotId ?? nextWallCurveKnotId(wallId, chain.knots)
	);
	if (insertion.kind === 'rejected') {
		return reject(curveEditRejection(insertion.code), insertion.message, [wallId]);
	}
	const candidate = withWallCenterline(
		document,
		wallId,
		wallCubicChain(insertion.knots, insertion.spans)
	);
	return finalizeCurveCandidate(document, candidate, 'wall-curve-knot-insert', wallId);
}


/**
 * Move exactly one bend point, preserving its ID and every other knot position.
 *
 * The local algebra derives one coherent target tangent for the moved knot,
 * updates both knot-facing controls, and leaves the neighbour-facing controls
 * fixed. This preserves every join tangent vector without refitting stored
 * split/insertion geometry.
 */
export function planMoveWallCurveKnot(
	document: LayoutDocumentWallFirst,
	wallId: string,
	knotId: string,
	point: LayoutVec2
): PrecisionPlan {
	const target = resolveCurveTarget(document, wallId);
	if ('plan' in target) return target.plan;
	const moveRoundHit = guardRoundRoomMemberGeometryEdit(document, { wallIds: [wallId] });
	if (moveRoundHit) return rejectRoundMember(moveRoundHit);
	const { chain } = target;
	const existing = chain.knots.find((knot) => knot.id === knotId);
	if (!existing) {
		return reject('unknown_curve_anchor', `Wall '${wallId}' has no bend point '${knotId}'`, [wallId, knotId]);
	}
	if (!finitePoint(point)) return reject('invalid_value', 'Bend point X/Z must be finite', [wallId, knotId]);
	if (coincidesAsJunction(existing.point, point)) {
		return reject('no_op', `Bend point '${knotId}' is already at that point`, [wallId, knotId]);
	}

	// Local reshape: only the two spans incident to the moved knot change, and
	// only their knot-facing controls move. Every stored span the grab does not
	// touch — including exact split-derived or inserted spans — survives
	// byte-identically. Never a whole-chain refit.
	const moved = moveWallCurveKnot(chain, knotId, point);
	if (moved.kind === 'rejected') {
		return reject(curveEditRejection(moved.code), moved.message, [wallId, knotId]);
	}
	const candidate = withWallCenterline(document, wallId, wallCubicChain(moved.knots, moved.spans));
	return finalizeCurveCandidate(document, candidate, 'wall-curve-knot-move', wallId);
}


/**
 * Delete one bend point by merging its two adjacent cubics.
 *
 * The merge keeps the surviving outer handles and drops the pair that faced the
 * deleted knot — an explicit rule, never a refit — and the chain stays a cubic
 * chain even when it ends up knot-less (one cubic between the endpoints). It is
 * never collapsed to `line`: turning the Wall straight is a separate,
 * deliberate `planConvertWallToLine`.
 */
export function planDeleteWallCurveKnot(
	document: LayoutDocumentWallFirst,
	wallId: string,
	knotId: string
): PrecisionPlan {
	const removal = proposeWallKnotRemoval(document, wallId, knotId);
	if (removal.kind !== 'proposed') return removal;
	const candidate = withWallCenterline(
		document,
		wallId,
		removal.centerline
	);
	return finalizeCurveCandidate(document, candidate, 'wall-curve-knot-delete', wallId);
}

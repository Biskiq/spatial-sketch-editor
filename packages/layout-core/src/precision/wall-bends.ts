import { p2311Measure } from '../kernel/work-observer';
import type { LayoutDocumentWallFirst } from '../wall/types';
import type { LayoutWallCurveKnot } from '../wall/types';
import { wallCubicChain } from '../wall/centerline';
import { isClosedWall } from '../wall/closed-wall';
import { ROUND_ROOM_MEMBER_EDIT_MESSAGE, guardRoundRoomMemberGeometryEdit } from '../room/round-room';
import { deleteWallCurveKnot, moveWallCurveKnot, resolveWallCurveSplit } from '../wall/curve-algebra';
import { coincidesAsJunction } from '../wall/junction-identity';
import type { LayoutVec2 } from '../geometry/coordinates';
import type { PrecisionPlan, WallBendIntent } from './types';
import { MAX_WALL_CURVE_KNOTS } from './types';
import { curveEditRejection, finalizeCurveCandidate, resolveCurveTarget, withWallCenterline } from './curve-edits';
import { finitePoint, reject, rejectRoundMember } from './rejections';

/**
 * The composite Bend planner: one grab, one candidate, one history entry.
 *
 * A pointer-down on the Wall body resolves to a physical arc distance; by
 * threshold-crossing time the grabbed position is already a bend point, so this
 * planner inserts the knot there (exactly, so nothing moves yet) and then places
 * it at the pointer through the ordinary knot-move reshape. A straight Wall
 * becomes a chain in the same candidate — no "convert to curve first" step —
 * and a grab that resolves onto an existing bend point drags that knot instead
 * of inserting a duplicate.
 *
 * Both halves run on the one chain-algebra authority and produce a single
 * `finalizeWallGeometryCandidate` acceptance, so an invalid release rejects
 * atomically and a valid one is one Undo entry.
 */
export function prepareWallBend(
	document: LayoutDocumentWallFirst,
	wallId: string,
	distance: number,
	capturedKnotId: string
) {
	const target = resolveCurveTarget(document, wallId, { allowStraight: true });
	if ('plan' in target) return target.plan;
	const { wall, start, end, chain } = target;
	// The 16-span chain is the canonical circle, not an authored freeform
	// curve. Its shape is owned by the radius writer and preserve-angle placement;
	// a bend would break both invariants, so it refuses explicitly.
	if (isClosedWall(wall)) {
		return reject(
			'closed_wall_not_bendable',
			ROUND_ROOM_MEMBER_EDIT_MESSAGE,
			[wallId]
		);
	}
	const bendRoundHit = guardRoundRoomMemberGeometryEdit(document, { wallIds: [wallId] });
	if (bendRoundHit) return rejectRoundMember(bendRoundHit);
	if (!Number.isFinite(distance)) {
		return reject('invalid_value', 'Bend distance must be a finite number of meters', [wallId]);
	}
	if (typeof capturedKnotId !== 'string' || capturedKnotId.length === 0) {
		return reject('invalid_value', 'A Bend must capture the id of the bend point it may insert', [wallId]);
	}

	// One resolver call decides both halves: whether the grab promotes an
	// existing bend point, and where the inserted knot belongs.
	const resolution = p2311Measure('planner-exact-split', () => resolveWallCurveSplit(chain, distance));
	if (resolution.kind === 'rejected') {
		return reject(
			resolution.code === 'split_at_endpoint'
				? 'split_at_existing_endpoint'
				: resolution.code === 'degenerate_chain'
					? 'unsupported_geometry'
					: 'split_distance_out_of_range',
			resolution.message,
			[wallId]
		);
	}

	const promotedKnotId = resolution.result.promotedKnotId;
	if (!promotedKnotId && chain.knots.length >= MAX_WALL_CURVE_KNOTS) {
		return reject(
			'curve_knot_limit',
			`Wall '${wallId}' already has ${MAX_WALL_CURVE_KNOTS} bend points, the maximum a new insertion may produce`,
			[wallId]
		);
	}
	// Captured identity, never an occupancy count: a promoted knot keeps its
	// own id, and a freshly inserted one replays the id the intent captured.
	const knotId = promotedKnotId ?? capturedKnotId;
	const { fragments } = resolution.result;
	const insertedKnot: LayoutWallCurveKnot = {
		id: knotId,
		point: [resolution.result.point[0], resolution.result.point[1]] as LayoutVec2
	};
	const knots = promotedKnotId
		? chain.knots.map((knot) => ({ id: knot.id, point: [knot.point[0], knot.point[1]] as LayoutVec2 }))
		: [...fragments.a.knots, insertedKnot, ...fragments.b.knots];
	const grabbed = knots.find((knot) => knot.id === knotId)!;
	const spans = promotedKnotId ? chain.spans : [...fragments.a.spans, ...fragments.b.spans];
	return {
		kind: 'ready' as const,
		start,
		end,
		reshape(point: LayoutVec2) {
			if (!finitePoint(point)) return reject('invalid_value', 'Bend point X/Z must be finite', [wallId]);
			if (coincidesAsJunction(grabbed.point, point)) {
				return promotedKnotId
					? reject('no_op', `Bend point '${knotId}' is already at that point`, [wallId, knotId])
					: { kind: 'proposed' as const, centerline: wallCubicChain(knots, spans) };
			}
			const moved = moveWallCurveKnot({ startPoint: start, endPoint: end, knots, spans }, knotId, point);
			return moved.kind === 'rejected'
				? reject(curveEditRejection(moved.code), moved.message, [wallId, knotId])
				: { kind: 'proposed' as const, centerline: wallCubicChain(moved.knots, moved.spans) };
		}
	};
}


export function planBendWallCurveKnot(
	document: LayoutDocumentWallFirst,
	wallId: string,
	intent: WallBendIntent,
	options: { readonly knotId: string }
): PrecisionPlan {
	const prepared = prepareWallBend(document, wallId, intent.distance, options.knotId);
	if (prepared.kind !== 'ready') return prepared;
	const proposed = prepared.reshape(intent.point);
	if (proposed.kind !== 'proposed') return proposed;
	return finalizeCurveCandidate(
		document, withWallCenterline(document, wallId, proposed.centerline), 'wall-curve-knot-bend', wallId
	);
}


export function proposeWallKnotRemoval(document: LayoutDocumentWallFirst, wallId: string, knotId: string) {
	const target = resolveCurveTarget(document, wallId);
	if ('plan' in target) return target.plan;
	const removeRoundHit = guardRoundRoomMemberGeometryEdit(document, { wallIds: [wallId] });
	if (removeRoundHit) return rejectRoundMember(removeRoundHit);
	const moveRoundHit = guardRoundRoomMemberGeometryEdit(document, { wallIds: [wallId] });
	if (moveRoundHit) return rejectRoundMember(moveRoundHit);
	const deletion = deleteWallCurveKnot(target.chain, knotId);
	return deletion.kind === 'rejected'
		? reject(curveEditRejection(deletion.code), deletion.message, [wallId, knotId])
		: {
				kind: 'proposed' as const,
				centerline: wallCubicChain(deletion.knots, deletion.spans),
				start: target.start,
				end: target.end
			};
}

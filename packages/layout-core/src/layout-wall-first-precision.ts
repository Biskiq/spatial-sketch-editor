/**
 * P23.1 precise semantic operations for the wall-first Layout document.
 *
 * These planners are deliberately small and operation-specific. They build a
 * complete candidate from an immutable document, run the wall-first codec,
 * topology/opening checks, and the shared geometry compiler, then return one
 * result for the editor transaction runner to commit. There is no persistent
 * constraint solver and no snap state involved in an exact operation.
 *
 * P23.10 extends this module with `planRigidWallMove` and moves every
 * canonical Junction-coordinate operation (Junction position, Wall length,
 * Wall angle, rigid Wall move, exact rectangle dimensions and Wall
 * subdivision) onto `finalizeWallGeometryCandidate`, which adds explicit 1→1
 * Room reconciliation and the portal/Opening gates. Metadata and object
 * operations keep the generic `finalizeCandidate` path.
 *
 * Angles use the document's X/Z convention: `atan2(z, x)` in radians. A wall
 * keeps its canonical start → end direction for length and angle edits; the
 * selected fixed endpoint is never silently swapped.
 */
import type { LayoutDocumentIssue } from './layout-codec';
import { canonicalBoundaryCycleKey, extractBoundaryCandidateFaces } from './layout-face-extraction';
import { compileWallFirstLayoutGeometry } from './layout-geometry';
import { p2311Measure } from './p2311-perf';
import { LAYOUT_GEOMETRY_EPSILON } from './layout-geometry-openings';
import type { CompiledLayoutGeometryResult, LayoutGeometryIssue } from './layout-geometry-types';
import { hasBlockingLayoutIssues } from './layout-geometry-validation';
import { validateWallFirstLayoutDocument } from './layout-wall-first-codec';
import { validateWallFirstOpeningSet } from './layout-opening-set';
import { validateWallFirstPortalRelations } from './layout-portals';
import {
	reconcileRooms,
	type ComponentLineage,
	type ReconciliationFailure,
	type ReconciliationResult,
	type RoomIdAllocator
} from './layout-room-reconciliation';
import type {
	LayoutDocumentWallFirst,
	LayoutJunction,
	LayoutWall,
	LayoutWallCenterline,
	LayoutWallCurveKnot
} from './layout-wall-first-types';
import {
	cloneWallCenterline,
	nextWallCurveKnotId,
	translateWallCenterline,
	wallCenterlineSamples,
	wallCubicChain
} from './layout-wall-centerline';
import { deriveChainSpans } from './layout-geometry-curve';
import {
	deleteWallCurveKnot,
	insertWallCurveKnot,
	moveWallCurveKnot,
	resolveWallCurveSplit,
	type WallCurveChain,
	type WallCurveEditRejection
} from './layout-wall-curve-algebra';
import {
	planWallSplit,
	type NodingIdAllocator,
	type NodingPlan
} from './layout-wall-noding';
import { coincidesAsJunction } from './layout-junction-identity';
import {
	topologyComponentKeyByJunctionId,
	topologyComponentKeyByWallId
} from './layout-topology-components';
import {
	classifyWallIntersection,
	sampledWallSelfIntersects,
	sampledWallsCross,
	type SampledTopologyWall,
	type TopologySegment
} from './layout-wall-topology';
import type { CurveSample } from './layout-geometry-curve';
import type { LayoutObject, LayoutVec2 } from './layout-types';
import type { Vec3 } from './types';

const POINT_EPSILON = LAYOUT_GEOMETRY_EPSILON;

export type FixedWallEndpoint = 'start' | 'end';

export type WallLengthIntent = {
	wallId: string;
	length: number;
	fixed?: FixedWallEndpoint;
	fixedEndpoint?: FixedWallEndpoint;
};

export type WallAngleIntent = {
	wallId: string;
	angle: number;
	fixed?: FixedWallEndpoint;
	fixedEndpoint?: FixedWallEndpoint;
};

/**
 * P23.10 — one rigid Wall translation: both endpoint Junctions
 * receive the identical X/Z delta. Endpoint order, role, thickness, height,
 * length and angle are all preserved.
 */
export type WallMoveIntent = {
	wallId: string;
	delta: LayoutVec2;
};

export type RectangleResizeOptions = {
	/** Explicit anchor reference. Omission uses the smallest stable corner ID. */
	anchorJunctionId?: string;
	/** Explicit width edge reference. Omission uses the smallest stable edge ID. */
	widthWallId?: string;
};

export type ResolvedRectangle = {
	anchorJunctionId: string;
	widthEndpointId: string;
	depthEndpointId: string;
	corners: LayoutJunction[];
	roomWallIds: string[];
	widthWallId: string;
	depthWallId: string;
};

export type RectangleResolution = ResolvedRectangle | { rejection: PrecisionRejection };

export type LayoutObjectTransformPatch = Partial<
	Pick<LayoutObject, 'position' | 'rotation' | 'dimensions' | 'roomId'>
>;

export type PrecisionOperation =
	| 'junction-position'
	| 'wall-length'
	| 'wall-angle'
	/** P23.10 — rigid straight-Wall translation (planner: `planRigidWallMove`). */
	| 'wall-move'
	| 'wall-thickness'
	| 'wall-height'
	| 'wall-role'
	/** P23.6c — canonical Wall deletion (planner: `planDeleteWall`). */
	| 'wall-delete'
	/** P23 Junction dissolve — degree-2 Junction deletion via Wall join (planner: `planDissolveJunction`). */
	| 'junction-dissolve'
	/** P23.6d — canonical Room metadata update (planner: `planRoomMetadataUpdate`). */
	| 'room-metadata'
	/** P23.12 — canonical Wall metadata update (planner: `planWallMetadataUpdate`). */
	| 'wall-metadata'
	/** P23.12 — canonical Opening metadata update (planner: `planOpeningMetadataUpdate`). */
	| 'opening-metadata'
	/** P23.6d — Room removal through the Wall pipeline (planner: `planRemoveRoom`). */
	| 'room-remove'
	/** P23.11 — canonical curve operations (convert / knot insert / move / delete / bend). */
	| 'wall-convert-to-curve'
	| 'wall-convert-to-line'
	| 'wall-curve-knot-insert'
	| 'wall-curve-knot-move'
	| 'wall-curve-knot-delete'
	/** P23.11 — the Bend gesture: insert at a physical arc position and place it. */
	| 'wall-curve-knot-bend'
	| 'wall-subdivision'
	| 'rectangle-dimensions'
	| 'layout-object-transform'
	| 'layout-object-delete'
	| 'layout-object-preset-create';

export type PrecisionRejection = {
	code:
		| 'unknown_junction'
		| 'unknown_wall'
		| 'unknown_room'
		| 'unknown_object'
		| 'invalid_value'
		| 'invalid_endpoint'
		| 'invalid_reference'
		| 'unsupported_geometry'
		/**
		 * P23.11 — the operation is straight-only and the target Wall carries a
		 * curved centerline. Exact length, exact angle and subdivision all reject
		 * here rather than approximate a curve they cannot solve for.
		 */
		| 'curved_wall_unsupported'
		/** P23.11 — the named curve control does not exist on that Wall. */
		| 'unknown_curve_anchor'
		| 'shared_boundary_resize_ambiguous'
		| 'topology_invalid'
		/**
		 * P23.10 — the geometry edit could not map every baseline Room to exactly
		 * one candidate face through explicit boundary-cycle lineage. Direct
		 * coordinate edits and subdivision never authorize Room birth, retirement,
		 * split or merge.
		 */
		| 'room_identity_lost'
		/** P23.10 — the candidate failed the canonical whole-document Opening set. */
		| 'opening_set_invalid'
		/** P23.10 — the candidate failed the canonical portal-relation (adjacency) gate. */
		| 'portal_relation_invalid'
		/**
		 * P23.6H — the edit would cap a Wall below the top of a hosted Opening. The
		 * canonical Opening validator owns the rule; this code only names the
		 * rejection so the message stays actionable.
		 */
		| 'wall_height_below_opening'
		| 'geometry_invalid'
		| 'no_op'
		| 'split_at_existing_endpoint'
		| 'split_distance_out_of_range'
		| 'split_through_opening_interior'
		| 'junction_point_mismatch';
	message: string;
	targetIds?: readonly string[];
	issues?: readonly (LayoutDocumentIssue | LayoutGeometryIssue)[];
};

/**
 * The **acceptance compile** a successful geometry plan already paid for.
 *
 * `finalizeWallGeometryCandidate` compiles the accepted candidate to prove it
 * does not block, and then discards the result while the editor derives the
 * preview bundle by compiling the same document a second time. Carrying the
 * result here lets that caller install the identical geometry without a second
 * compile.
 *
 * `documentJson` is the accepted document's own canonical JSON (free — the
 * codec gate computed it), so a caller that installs a *re-parsed* copy of that
 * document can prove the re-parse preserved it before reusing anything. It is
 * never a licence to reuse geometry for a different document.
 */
export type WallFirstAcceptanceCompile = {
	documentJson: string;
	geometry: CompiledLayoutGeometryResult['geometry'];
	issues: CompiledLayoutGeometryResult['issues'];
};

export type PrecisionPlan =
	| {
			kind: 'success';
			document: LayoutDocumentWallFirst;
			operation: PrecisionOperation;
			changedJunctionIds: readonly string[];
			changedWallIds: readonly string[];
			changedObjectIds?: readonly string[];
			/** P23.5 — the object a preset create birthed (its stored ID). */
			createdObjectId?: string;
			/**
			 * Set only by the wall-geometry path, and only for the document in
			 * `document`: the compile result acceptance already produced.
			 */
			acceptance?: WallFirstAcceptanceCompile;
		}
	| {
			kind: 'rejected';
			rejection: PrecisionRejection;
		};

/** Move one canonical Junction exactly in document X/Z space. */
export function planExactJunctionMove(
	document: LayoutDocumentWallFirst,
	junctionId: string,
	point: LayoutVec2
): PrecisionPlan {
	const junction = document.junctions.find((candidate) => candidate.id === junctionId);
	if (!junction) return reject('unknown_junction', `Unknown junction '${junctionId}'`, [junctionId]);
	if (!finitePoint(point)) return reject('invalid_value', 'Junction X/Z must be finite', [junctionId]);
	if (coincidesAsJunction(junction.point, point)) return reject('no_op', `Junction '${junctionId}' is already at that point`, [junctionId]);

	const candidate = cloneDocument(document);
	const moved = candidate.junctions.find((entry) => entry.id === junctionId)!;
	moved.point = [point[0], point[1]];
	return finalizeWallGeometryCandidate({
		baseline: document,
		candidate,
		operation: 'junction-position',
		changedJunctionIds: [junctionId],
		changedWallIds: incidentWallIds(document, junctionId)
	});
}

/**
 * P23.10 — translate one canonical Wall rigidly in X/Z: both endpoint
 * Junctions receive the identical delta, so the Wall keeps its ID, role,
 * thickness, height, endpoint order, length and angle, and every hosted Opening
 * keeps its ID, host, offset, width and vertical/profile fields.
 *
 * Walls incident to either moved endpoint reshape because their shared Junction
 * IDs moved; the operation never detaches a shared endpoint. A candidate that
 * breaks a neighbour, an Opening, Room identity, a portal relation or the
 * compiler rejects atomically.
 */
export function planRigidWallMove(
	document: LayoutDocumentWallFirst,
	wallOrIntent: string | WallMoveIntent,
	deltaArgument?: LayoutVec2
): PrecisionPlan {
	const intent: WallMoveIntent = typeof wallOrIntent === 'string'
		? { wallId: wallOrIntent, delta: (deltaArgument ?? [0, 0]) as LayoutVec2 }
		: { wallId: wallOrIntent.wallId, delta: wallOrIntent.delta };
	const wall = document.walls.find((candidate) => candidate.id === intent.wallId);
	if (!wall) return reject('unknown_wall', `Unknown wall '${intent.wallId}'`, [intent.wallId]);
	if (!finitePoint(intent.delta)) return reject('invalid_value', 'Wall move delta must be finite X/Z', [wall.id]);
	if (intent.delta[0] === 0 && intent.delta[1] === 0) return reject('no_op', `Wall '${wall.id}' already has that position`, [wall.id]);

	const endpoints = wallEndpoints(document, wall);
	if (!endpoints) return reject('unsupported_geometry', `Wall '${wall.id}' has unresolved junction geometry`, [wall.id]);
	if (!(endpoints.length > POINT_EPSILON)) return reject('unsupported_geometry', `Wall '${wall.id}' has zero effective length`, [wall.id]);

	// Canonical endpoint order, de-duplicated: a degenerate self-loop Wall
	// carries one Junction, not two.
	const changedJunctionIds = [...new Set([wall.startJunctionId, wall.endJunctionId])];
	const candidate = cloneDocument(document);
	for (const junction of candidate.junctions) {
		if (!changedJunctionIds.includes(junction.id)) continue;
		junction.point = [junction.point[0] + intent.delta[0], junction.point[1] + intent.delta[1]];
	}
	// P23.11 — the moved Wall's own curve anchors are absolute document X/Z and
	// must receive the identical rigid delta, or the Wall would change SHAPE.
	// Anchors on neighbouring Walls stay put: those Walls reshape because their
	// shared Junction moved, which is the documented endpoint-move semantics.
	const moved = candidate.walls.find((entry) => entry.id === wall.id)!;
	moved.centerline = translateWallCenterline(moved.centerline, intent.delta);
	// Deterministic document-order union of every Wall incident to either moved
	// endpoint: those neighbours reshape because their shared Junction ID moved.
	const changedWallIds = document.walls
		.filter((candidate) =>
			changedJunctionIds.some(
				(junctionId) =>
					candidate.startJunctionId === junctionId || candidate.endJunctionId === junctionId
			)
		)
		.map((candidate) => candidate.id);
	return finalizeWallGeometryCandidate({
		baseline: document,
		candidate,
		operation: 'wall-move',
		changedJunctionIds,
		changedWallIds
	});
}

/** Set a straight Wall's exact physical length while keeping one endpoint fixed. */
export function planExactWallLength(
	document: LayoutDocumentWallFirst,
	wallOrIntent: string | WallLengthIntent,
	lengthArgument?: number,
	fixedArgument: FixedWallEndpoint = 'start'
): PrecisionPlan {
	const intent = typeof wallOrIntent === 'string'
		? { wallId: wallOrIntent, length: lengthArgument, fixed: fixedArgument }
		: {
				wallId: wallOrIntent.wallId,
				length: wallOrIntent.length,
				fixed: wallOrIntent.fixedEndpoint ?? wallOrIntent.fixed ?? 'start'
			};
	const wall = document.walls.find((candidate) => candidate.id === intent.wallId);
	if (!wall) return reject('unknown_wall', `Unknown wall '${intent.wallId}'`, [intent.wallId]);
	if (!validFixedEndpoint(intent.fixed)) return reject('invalid_endpoint', "Fixed endpoint must be 'start' or 'end'", [wall.id]);
	// P23.11 — an exact *length* is a chord solve: the endpoint moves along the
	// endpoint direction and the curve would have to be re-solved to keep its
	// shape. Curves use the canonical anchor planners instead.
	if (wall.centerline.kind !== 'line') return rejectCurvedWall('exact length', wall.id);
	if (!finitePositive(intent.length)) return reject('invalid_value', 'Wall length must be finite and greater than zero', [wall.id]);

	const endpoints = wallEndpoints(document, wall);
	if (!endpoints) return reject('unsupported_geometry', `Wall '${wall.id}' has unresolved junction geometry`, [wall.id]);
	if (!(endpoints.length > POINT_EPSILON)) return reject('unsupported_geometry', `Wall '${wall.id}' has zero effective length`, [wall.id]);
	if (intent.length === endpoints.length) return reject('no_op', `Wall '${wall.id}' already has that length`, [wall.id]);

	const direction: LayoutVec2 = [
		(endpoints.end[0] - endpoints.start[0]) / endpoints.length,
		(endpoints.end[1] - endpoints.start[1]) / endpoints.length
	];
	const movedJunctionId = intent.fixed === 'start' ? wall.endJunctionId : wall.startJunctionId;
	const fixedPoint = intent.fixed === 'start' ? endpoints.start : endpoints.end;
	const movedPoint: LayoutVec2 = intent.fixed === 'start'
		? [fixedPoint[0] + direction[0] * intent.length, fixedPoint[1] + direction[1] * intent.length]
		: [fixedPoint[0] - direction[0] * intent.length, fixedPoint[1] - direction[1] * intent.length];
	if (coincidesAsJunction(currentJunctionPoint(document, movedJunctionId), movedPoint)) return reject('no_op', `Wall '${wall.id}' already has that length`, [wall.id]);

	const candidate = moveJunction(document, movedJunctionId, movedPoint);
	return finalizeWallGeometryCandidate({
		baseline: document,
		candidate,
		operation: 'wall-length',
		changedJunctionIds: [movedJunctionId],
		changedWallIds: incidentWallIds(document, movedJunctionId)
	});
}

/** Set a supported straight Wall's exact X/Z angle in radians. */
export function planExactWallAngle(
	document: LayoutDocumentWallFirst,
	wallOrIntent: string | WallAngleIntent,
	angleArgument?: number,
	fixedArgument: FixedWallEndpoint = 'start'
): PrecisionPlan {
	const intent = typeof wallOrIntent === 'string'
		? { wallId: wallOrIntent, angle: angleArgument, fixed: fixedArgument }
		: {
				wallId: wallOrIntent.wallId,
				angle: wallOrIntent.angle,
				fixed: wallOrIntent.fixedEndpoint ?? wallOrIntent.fixed ?? 'start'
			};
	const wall = document.walls.find((candidate) => candidate.id === intent.wallId);
	if (!wall) return reject('unknown_wall', `Unknown wall '${intent.wallId}'`, [intent.wallId]);
	if (!validFixedEndpoint(intent.fixed)) return reject('invalid_endpoint', "Fixed endpoint must be 'start' or 'end'", [wall.id]);
	// P23.11 — an exact *angle* is the endpoint-chord direction of a straight
	// Wall; a curve has no single angle to set.
	if (wall.centerline.kind !== 'line') return rejectCurvedWall('exact angle', wall.id);
	const angle = intent.angle;
	if (typeof angle !== 'number' || !Number.isFinite(angle)) return reject('invalid_value', 'Wall angle must be finite radians', [wall.id]);

	const endpoints = wallEndpoints(document, wall);
	if (!endpoints) return reject('unsupported_geometry', `Wall '${wall.id}' has unresolved junction geometry`, [wall.id]);
	if (!(endpoints.length > POINT_EPSILON)) return reject('unsupported_geometry', `Wall '${wall.id}' has zero effective length`, [wall.id]);
	const direction: LayoutVec2 = [Math.cos(angle), Math.sin(angle)];
	const fixedPoint = intent.fixed === 'start' ? endpoints.start : endpoints.end;
	const movedJunctionId = intent.fixed === 'start' ? wall.endJunctionId : wall.startJunctionId;
	const movedPoint: LayoutVec2 = intent.fixed === 'start'
		? [fixedPoint[0] + direction[0] * endpoints.length, fixedPoint[1] + direction[1] * endpoints.length]
		: [fixedPoint[0] - direction[0] * endpoints.length, fixedPoint[1] - direction[1] * endpoints.length];
	if (coincidesAsJunction(currentJunctionPoint(document, movedJunctionId), movedPoint)) return reject('no_op', `Wall '${wall.id}' already has that angle`, [wall.id]);

	const candidate = moveJunction(document, movedJunctionId, movedPoint);
	return finalizeWallGeometryCandidate({
		baseline: document,
		candidate,
		operation: 'wall-angle',
		changedJunctionIds: [movedJunctionId],
		changedWallIds: incidentWallIds(document, movedJunctionId)
	});
}

/** Set a Wall-owned physical thickness, preserving Wall and Opening identity. */
export function planExactWallThickness(
	document: LayoutDocumentWallFirst,
	wallId: string,
	thickness: number
): PrecisionPlan {
	const wall = document.walls.find((candidate) => candidate.id === wallId);
	if (!wall) return reject('unknown_wall', `Unknown wall '${wallId}'`, [wallId]);
	if (!finitePositive(thickness)) return reject('invalid_value', 'Wall thickness must be finite and greater than zero', [wallId]);
	if (wall.thickness === thickness) return reject('no_op', `Wall '${wallId}' already has that thickness`, [wallId]);

	const candidate = cloneDocument(document);
	candidate.walls.find((entry) => entry.id === wallId)!.thickness = thickness;
	return finalizeCandidate(candidate, 'wall-thickness', [], [wallId]);
}

/**
 * Set a Wall's authoritative physical height (P23.6H, unbounded since P23.6I),
 * preserving Wall, Junction, Opening and Room identity.
 *
 * Height is independent of X/Z topology: the Wall stays the same authored Wall
 * with the same `role` and the same Room participation; only its vertical extent
 * changes (`topY = floor.elevation + height`). There is **no upper bound** — the
 * canonical Floor has no storey scalar to cap against — so any finite positive
 * value is accepted, including values taller than neighbouring Walls. A Wall
 * shortened below a hosted Opening's top still rejects atomically with the Opening
 * untouched (the canonical Opening validator owns that rule), and nothing is ever
 * clamped.
 */
export function planExactWallHeight(
	document: LayoutDocumentWallFirst,
	wallId: string,
	height: number
): PrecisionPlan {
	const wall = document.walls.find((candidate) => candidate.id === wallId);
	if (!wall) return reject('unknown_wall', `Unknown wall '${wallId}'`, [wallId]);
	if (!finitePositive(height)) return reject('invalid_value', 'Wall height must be finite and greater than zero', [wallId]);
	if (wall.height === height) return reject('no_op', `Wall '${wallId}' already has that height`, [wallId]);

	const candidate = cloneDocument(document);
	candidate.walls.find((entry) => entry.id === wallId)!.height = height;
	return finalizeCandidate(candidate, 'wall-height', [], [wallId]);
}

/**
 * Add one explicit Vertex by subdividing a Wall at a physical meter offset.
 * The existing P23.8 noder owns deterministic IDs, opening rebasing, and
 * forward/reverse Room-boundary rewrites; this planner adds the P23.1 final
 * candidate gates around that result.
 */
export function planWallSubdivision(
	document: LayoutDocumentWallFirst,
	wallId: string,
	splitDistance: number,
	allocator: NodingIdAllocator
): PrecisionPlan {
	// P23.11 — curved Walls split exactly through the same noder: the split
	// measures the canonical arc, resolves once, and hands both fragments their
	// own partition of the chain, so no flatten can happen here.
	const planned: NodingPlan = planWallSplit(document, wallId, splitDistance, allocator);
	if (planned.kind === 'rejected') {
		return reject(planned.rejection.code, planned.rejection.message, [wallId]);
	}
	return finalizeWallGeometryCandidate({
		baseline: document,
		candidate: planned.document,
		operation: 'wall-subdivision',
		changedJunctionIds: [planned.junctionId],
		changedWallIds: planned.splitWallIds,
		createdWallIds: planned.createdWallIds
	});
}

/** P23.1 naming alias for callers that describe the operation as Add Vertex. */
export const planAddWallVertex = planWallSubdivision;

// =====================================================================
// P23.11 — canonical curve operations.
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
function rejectCurvedWall(operation: string, wallId: string): PrecisionPlan {
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
function resolveCurveTarget(
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
	const wall = document.walls.find((candidate) => candidate.id === wallId);
	if (!wall) return { plan: reject('unknown_wall', `Unknown wall '${wallId}'`, [wallId]) };
	const endpoints = wallEndpoints(document, wall);
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
function curveEditRejection(code: WallCurveEditRejection): PrecisionRejection['code'] {
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
function finalizeCurveCandidate(
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
function withWallCenterline(
	document: LayoutDocumentWallFirst,
	wallId: string,
	centerline: LayoutWall['centerline']
): LayoutDocumentWallFirst {
	const candidate = cloneDocument(document);
	candidate.walls.find((entry) => entry.id === wallId)!.centerline = centerline;
	return candidate;
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
	const wall = document.walls.find((candidate) => candidate.id === wallId);
	if (!wall) return reject('unknown_wall', `Unknown wall '${wallId}'`, [wallId]);
	if (wall.centerline.kind === 'cubic-chain') {
		return reject('no_op', `Wall '${wallId}' is already curved`, [wallId]);
	}
	const endpoints = wallEndpoints(document, wall);
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
	const wall = document.walls.find((candidate) => candidate.id === wallId);
	if (!wall) return reject('unknown_wall', `Unknown wall '${wallId}'`, [wallId]);
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
	const { chain } = target;
	if (!Number.isFinite(distance)) {
		return reject('invalid_value', 'Bend point distance must be a finite number of meters', [wallId]);
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
	const target = resolveCurveTarget(document, wallId);
	if ('plan' in target) return target.plan;
	const { chain } = target;
	const deletion = deleteWallCurveKnot(chain, knotId);
	if (deletion.kind === 'rejected') {
		return reject(curveEditRejection(deletion.code), deletion.message, [wallId, knotId]);
	}
	const candidate = withWallCenterline(
		document,
		wallId,
		wallCubicChain(deletion.knots, deletion.spans)
	);
	return finalizeCurveCandidate(document, candidate, 'wall-curve-knot-delete', wallId);
}

// =====================================================================
// P23.11 — the pure curve PROPOSAL seam.
//
// Separate from canonical acceptance on purpose: a rejected drag must still
// render the attempted Wall while the immutable baseline is installed, and the
// only way to do that without a second interpolation authority is to run the
// SAME chain algebra the planners run, without finalizing.
// =====================================================================

/** Which curve edit a transient proposal describes. */
export type WallCurveProposeIntent =
	| { kind: 'knot-move'; knotId: string; point: LayoutVec2 }
	| { kind: 'bend'; distance: number; point: LayoutVec2 };

/** One sampled Wall centerline in a transient direct-edit proposal. */
export type WallFirstArchitectureProposalWall = {
	wallId: string;
	points: LayoutVec2[];
};

/** Pure direct-edit intent used only to derive invalid-drag overlay geometry. */
export type WallFirstArchitectureProposalIntent =
	| { kind: 'junction-move'; junctionId: string; point: LayoutVec2 }
	| { kind: 'wall-move'; wallId: string; delta: LayoutVec2 }
	| { kind: 'curve-control-move'; wallId: string; knotId: string; point: LayoutVec2 }
	| { kind: 'wall-bend'; wallId: string; distance: number; point: LayoutVec2 };

/**
 * P23.11 — pure, non-validating curve **proposal**.
 *
 * Runs the canonical chain algebra (`moveWallCurveKnot`, the exact subdivision
 * authority) WITHOUT acceptance and samples the result through the one
 * centerline adapter, so a rejected drag can render the attempted Wall shape
 * transiently. It installs no document, validates nothing and persists nothing:
 * the caller keeps the immutable baseline and draws this only as overlay truth.
 *
 * Returns the attempted centerline plus the endpoints it spans, or `undefined`
 * when the intent cannot even be proposed (unknown Wall or knot, a non-finite
 * point, an out-of-range bend distance, a split that resolves onto an
 * endpoint).
 *
 * It is the single intent→curve mapping: `proposeWallCurveShape` samples what
 * it returns, and `architectureCandidatePatch` below splices it, so the drawn
 * attempt and any preflight can never describe different geometry.
 */
export function resolveProposedCurveChain(
	document: LayoutDocumentWallFirst,
	wallId: string,
	intent: WallCurveProposeIntent
): { start: LayoutVec2; end: LayoutVec2; centerline: LayoutWallCenterline } | undefined {
	const target = resolveCurveTarget(document, wallId, { allowStraight: true });
	if ('plan' in target) return undefined;
	const { start, end, chain } = target;
	if (intent.kind === 'knot-move') {
		if (!finitePoint(intent.point)) return undefined;
		const moved = moveWallCurveKnot(chain, intent.knotId, intent.point);
		if (moved.kind === 'rejected') return undefined;
		return { start, end, centerline: wallCubicChain(moved.knots, moved.spans) };
	}
	if (!Number.isFinite(intent.distance) || !finitePoint(intent.point)) return undefined;
	const resolution = p2311Measure('proposal-exact-split', () => resolveWallCurveSplit(chain, intent.distance));
	if (resolution.kind === 'rejected') return undefined;
	const { fragments, promotedKnotId, point } = resolution.result;
	const knotId = promotedKnotId ?? nextWallCurveKnotId(wallId, chain.knots);
	const knots = promotedKnotId
		? chain.knots.map((knot) => ({ id: knot.id, point: [knot.point[0], knot.point[1]] as LayoutVec2 }))
		: [
				...fragments.a.knots,
				{ id: knotId, point: [point[0], point[1]] as LayoutVec2 } satisfies LayoutWallCurveKnot,
				...fragments.b.knots
		  ];
	const spans = promotedKnotId ? chain.spans : [...fragments.a.spans, ...fragments.b.spans];
	const moved = p2311Measure('proposal-curve-algebra', () =>
		moveWallCurveKnot({ startPoint: start, endPoint: end, knots, spans }, knotId, intent.point)
	);
	if (moved.kind === 'rejected') return undefined;
	return { start, end, centerline: wallCubicChain(moved.knots, moved.spans) };
}

/**
 * P23.11 — sample a proposed curve intent through the one canonical Wall
 * adapter, without acceptance. A thin sampler over `resolveProposedCurveChain`,
 * so the drawn attempt and the preflight below can never describe different
 * geometry.
 */
export function proposeWallCurveShape(
	document: LayoutDocumentWallFirst,
	wallId: string,
	intent: WallCurveProposeIntent
): LayoutVec2[] | undefined {
	const proposed = resolveProposedCurveChain(document, wallId, intent);
	if (!proposed) return undefined;
	return sampleProposedChain(wallId, proposed.start, proposed.end, proposed.centerline);
}

/**
 * Derive the complete local geometry requested by one direct architecture
 * edit, without validating or installing a candidate document.
 *
 * Junction moves reshape every incident Wall through the moved shared
 * Junction. Rigid Wall moves translate the selected Wall's complete centerline
 * and reshape neighbouring Walls through their moved shared Junctions. Curve
 * controls and Bend reuse the existing curve proposal authority. The result is
 * overlay truth only: callers must keep the canonical baseline installed.
 */export function proposeWallFirstArchitectureGeometry(
	document: LayoutDocumentWallFirst,
	intent: WallFirstArchitectureProposalIntent
): WallFirstArchitectureProposalWall[] | undefined {
	const patch = architectureCandidatePatch(document, intent);
	if (!patch) return undefined;
	const candidate = spliceWallFirstArchitectureCandidate(document, patch);
	const proposals: WallFirstArchitectureProposalWall[] = [];
	for (const wallId of patch.affectedWallIds) {
		const wall = candidate.walls.find((entry) => entry.id === wallId);
		const endpoints = wall ? wallEndpoints(candidate, wall) : undefined;
		if (!wall || !endpoints) continue;
		const sampled = wallCenterlineSamples(wall, endpoints.start, endpoints.end, 'forward');
		if (!sampled) continue;
		proposals.push({
			wallId,
			points: sampled.samples.map((sample) => [sample.point[0], sample.point[1]] as LayoutVec2)
		});
	}
	return proposals;
}

/**
 * One intent's structural effect on the baseline: the records it changes and
 * the Walls whose geometry it reshapes. Nothing here is validated, and nothing
 * is written back — this is the **single** intent→candidate mapping shared by
 * the render proposal and the preflight below, so neither can invent geometry
 * the other does not have.
 */
type ArchitectureCandidatePatch = {
	/** Junction point overrides, by Junction ID. */
	junctionPoints: ReadonlyMap<string, LayoutVec2>;
	/** Wall centerline overrides, by Wall ID. */
	wallCenterlines: ReadonlyMap<string, LayoutWallCenterline>;
	/** The Walls the intent reshapes, in document order. */
	affectedWallIds: readonly string[];
};

function architectureCandidatePatch(
	document: LayoutDocumentWallFirst,
	intent: WallFirstArchitectureProposalIntent
): ArchitectureCandidatePatch | undefined {
	if (intent.kind === 'curve-control-move') {
		const proposed = resolveProposedCurveChain(document, intent.wallId, {
			kind: 'knot-move',
			knotId: intent.knotId,
			point: intent.point
		});
		if (!proposed) return undefined;
		return {
			junctionPoints: new Map(),
			wallCenterlines: new Map([[intent.wallId, proposed.centerline]]),
			affectedWallIds: [intent.wallId]
		};
	}
	if (intent.kind === 'wall-bend') {
		const proposed = resolveProposedCurveChain(document, intent.wallId, {
			kind: 'bend',
			distance: intent.distance,
			point: intent.point
		});
		if (!proposed) return undefined;
		return {
			junctionPoints: new Map(),
			wallCenterlines: new Map([[intent.wallId, proposed.centerline]]),
			affectedWallIds: [intent.wallId]
		};
	}
	if (!finitePoint(intent.kind === 'junction-move' ? intent.point : intent.delta)) return undefined;

	if (intent.kind === 'junction-move') {
		const junction = document.junctions.find((entry) => entry.id === intent.junctionId);
		if (!junction) return undefined;
		return {
			junctionPoints: new Map([[intent.junctionId, [intent.point[0], intent.point[1]] as LayoutVec2]]),
			// A Junction move leaves every Wall's own anchors alone: a straight Wall
			// follows its shared endpoint, and a curved Wall's anchors are absolute.
			wallCenterlines: new Map(),
			affectedWallIds: incidentWallIds(document, intent.junctionId)
		};
	}
	const wall = document.walls.find((entry) => entry.id === intent.wallId);
	if (!wall) return undefined;
	const changedJunctionIds = [...new Set([wall.startJunctionId, wall.endJunctionId])];
	const junctionPoints = new Map<string, LayoutVec2>();
	for (const junctionId of changedJunctionIds) {
		const junction = document.junctions.find((entry) => entry.id === junctionId);
		if (!junction) continue;
		junctionPoints.set(junctionId, [
			junction.point[0] + intent.delta[0],
			junction.point[1] + intent.delta[1]
		]);
	}
	return {
		junctionPoints,
		// The moved Wall's own curve anchors are absolute document X/Z and receive
		// the identical rigid delta, or the Wall would change SHAPE.
		wallCenterlines: new Map([[wall.id, translateWallCenterline(wall.centerline, intent.delta)]]),
		affectedWallIds: document.walls
			.filter((entry) =>
				changedJunctionIds.some(
					(junctionId) =>
						entry.startJunctionId === junctionId || entry.endJunctionId === junctionId
				)
			)
			.map((entry) => entry.id)
	};
}

/**
 * Apply a patch as a **shallow** splice of the baseline: changed records are
 * replaced, everything else is shared.
 *
 * Sharing is deliberate and safe: the only consumers are the read-only
 * canonical gates below (and the render sampler), which read the document and
 * never write it. The deep clone the planner builds exists because planners
 * hand the candidate on to further mutation — a preflight does not.
 */
function spliceWallFirstArchitectureCandidate(
	document: LayoutDocumentWallFirst,
	patch: ArchitectureCandidatePatch
): LayoutDocumentWallFirst {
	return {
		...document,
		junctions: document.junctions.map((junction) => {
			const point = patch.junctionPoints.get(junction.id);
			return point ? { ...junction, point: [point[0], point[1]] as LayoutVec2 } : junction;
		}),
		walls: document.walls.map((wall) => {
			const centerline = patch.wallCenterlines.get(wall.id);
			return centerline ? { ...wall, centerline } : wall;
		})
	};
}

/** One cheap, canonical refutation of a live direct-edit attempt. */
export type WallFirstArchitecturePreflightFailure = {
	code: string;
	message: string;
};

/**
 * P23.11 — the **cheap canonical prefix** of the direct-edit transaction, for
 * live feedback. It applies the intent's patch and runs exactly one canonical
 * gate — `validateWallFirstTopology(..., { openingSet: 'defer' })`, the stage
 * the planner itself runs before Room reconciliation — then stops.
 *
 * Scope is the point:
 *
 * - it decides **unsupported crossing, self-intersection, duplicate Junction
 *   points, zero-length Walls and broken Room boundary structure** — the
 *   geometric rejections a pointermove can honestly know;
 * - it deliberately does **not** reconcile Rooms, validate the Opening set, the
 *   portal relations or compile, so anything that could only fail there stays
 *   *pending* and is decided by the release planner;
 * - it is **sound by construction**: it is the same function the planner calls
 *   with the same values (the splice preserves every field the gate reads, and
 *   the planner's own re-parse before it is value-preserving), so a failure
 *   here is a failure at release too. A miss is merely pending, never wrong.
 *
 * Returns the canonical issue, or `undefined` when nothing cheap rejects the
 * attempt (including when the intent cannot be derived at all — that is the
 * caller's own "underivable" state, not a verdict here).
 */
export function preflightWallFirstArchitectureCandidate(
	document: LayoutDocumentWallFirst,
	intent: WallFirstArchitectureProposalIntent
): WallFirstArchitecturePreflightFailure | undefined {
	const patch = architectureCandidatePatch(document, intent);
	if (!patch) return undefined;
	const candidate = spliceWallFirstArchitectureCandidate(document, patch);
	const failure = p2311Measure('preflight-topology', () =>
		validateWallFirstTopology(candidate, { openingSet: 'defer' })
	);
	if (!failure) return undefined;
	return { code: failure.code, message: failure.message };
}

/** Sample an attempted centerline through the one canonical Wall adapter. */
function sampleProposedChain(
	wallId: string,
	start: LayoutVec2,
	end: LayoutVec2,
	centerline: LayoutWallCenterline
): LayoutVec2[] | undefined {
	const sampled = wallCenterlineSamples({ id: wallId, centerline }, start, end, 'forward');
	if (!sampled) return undefined;
	return sampled.samples.map((sample) => [sample.point[0], sample.point[1]] as LayoutVec2);
}

/** Target of one Bend gesture: how far along the Wall it was grabbed, and where. */
export type WallBendIntent = {
	/** Physical arc distance of the grab point from the Wall's canonical start. */
	distance: number;
	/** Where the dragged bend point sits now (document X/Z meters). */
	point: LayoutVec2;
};

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
export function planBendWallCurveKnot(
	document: LayoutDocumentWallFirst,
	wallId: string,
	intent: WallBendIntent
): PrecisionPlan {
	const target = resolveCurveTarget(document, wallId, { allowStraight: true });
	if ('plan' in target) return target.plan;
	const { start, end, chain } = target;
	if (!Number.isFinite(intent.distance)) {
		return reject('invalid_value', 'Bend distance must be a finite number of meters', [wallId]);
	}
	if (!finitePoint(intent.point)) return reject('invalid_value', 'Bend point X/Z must be finite', [wallId]);

	// One resolver call decides both halves: whether the grab promotes an
	// existing bend point, and where the inserted knot belongs.
	const resolution = p2311Measure('planner-exact-split', () => resolveWallCurveSplit(chain, intent.distance));
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
	const knotId = promotedKnotId ?? nextWallCurveKnotId(wallId, chain.knots);
	const { fragments } = resolution.result;
	const insertedKnot: LayoutWallCurveKnot = {
		id: knotId,
		point: [resolution.result.point[0], resolution.result.point[1]] as LayoutVec2
	};
	const knots = promotedKnotId
		? chain.knots.map((knot) => ({ id: knot.id, point: [knot.point[0], knot.point[1]] as LayoutVec2 }))
		: [...fragments.a.knots, insertedKnot, ...fragments.b.knots];
	const grabbed = knots.find((knot) => knot.id === knotId)!;
	if (coincidesAsJunction(grabbed.point, intent.point)) {
		// Released exactly where it was grabbed. A rotated bend point is a real
		// no-op; a freshly inserted knot is not — the insertion itself is the
		// edit, and the exact partition must be persisted verbatim rather than
		// re-derived through the smoothness rule.
		if (promotedKnotId) {
			return reject('no_op', `Bend point '${knotId}' is already at that point`, [wallId, knotId]);
		}
		const partition = withWallCenterline(document, wallId, wallCubicChain(fragments.a.knots.concat(insertedKnot, fragments.b.knots), [...fragments.a.spans, ...fragments.b.spans]));
		return finalizeCurveCandidate(document, partition, 'wall-curve-knot-bend', wallId);
	}
	// Insert/promote through the exact subdivision authority, then move the
	// grabbed knot through the SAME local-move primitive an ordinary knot drag
	// uses — there is no Bend-specific interpolation. Only the two spans around
	// the grab reshape, so every other stored span (including exact
	// split-derived and previously inserted spans) survives byte-identically.
	const spans = promotedKnotId ? chain.spans : [...fragments.a.spans, ...fragments.b.spans];
	const moved = p2311Measure('curve-algebra', () =>
		moveWallCurveKnot({ startPoint: start, endPoint: end, knots, spans }, knotId, intent.point)
	);
	if (moved.kind === 'rejected') {
		return reject(curveEditRejection(moved.code), moved.message, [wallId, knotId]);
	}
	const candidate = p2311Measure('candidate-clone', () =>
		withWallCenterline(document, wallId, wallCubicChain(moved.knots, moved.spans))
	);
	return finalizeCurveCandidate(document, candidate, 'wall-curve-knot-bend', wallId);
}


/** Resize a four-edge straight Room boundary into an exact rectangle. */
export function planExactRectangleDimensions(
	document: LayoutDocumentWallFirst,
	roomId: string,
	width: number,
	depth: number,
	options: RectangleResizeOptions = {}
): PrecisionPlan {
	const room = document.rooms.find((candidate) => candidate.id === roomId);
	if (!room) return reject('unknown_room', `Unknown room '${roomId}'`, [roomId]);
	if (!finitePositive(width) || !finitePositive(depth)) return reject('invalid_value', 'Rectangle width and depth must be finite and greater than zero', [roomId]);
	if (room.boundary.length !== 4) return reject('unsupported_geometry', 'Exact rectangle dimensions require four straight boundary Walls', [roomId]);

	const resolved = resolveRectangle(document, roomId, options);
	if ('rejection' in resolved) return { kind: 'rejected', rejection: resolved.rejection };
	const { corners, roomWallIds, widthWallId, depthWallId } = resolved;
	if (roomWallIds.some((wallId) => document.walls.find((wall) => wall.id === wallId)?.role !== 'boundary')) {
		return reject('unsupported_geometry', 'Rectangle boundaries must use boundary Walls', [roomId]);
	}
	if (hasAmbiguousSharedBoundary(document, roomId, roomWallIds, corners.map((corner) => corner.id))) {
		return reject('shared_boundary_resize_ambiguous', 'Rectangle resize would ambiguously deform a shared Wall network', [roomId, ...roomWallIds]);
	}

	const anchor = corners.find((corner) => corner.id === resolved.anchorJunctionId)!;
	const widthCorner = corners.find((corner) => corner.id === resolved.widthEndpointId)!;
	const depthCorner = corners.find((corner) => corner.id === resolved.depthEndpointId)!;
	const opposite = corners.find((corner) =>
		corner.id !== anchor.id && corner.id !== widthCorner.id && corner.id !== depthCorner.id
	)!;
	const widthLength = distance(anchor.point, widthCorner.point);
	const depthLength = distance(anchor.point, depthCorner.point);
	if (!(widthLength > POINT_EPSILON) || !(depthLength > POINT_EPSILON)) return reject('unsupported_geometry', 'Rectangle edges must have non-zero length', [roomId]);
	const widthAxis = normalize(subtract(widthCorner.point, anchor.point));
	const depthAxis = normalize(subtract(depthCorner.point, anchor.point));
	if (!widthAxis || !depthAxis || Math.abs(dot(widthAxis, depthAxis)) > 1e-5) {
		return reject('unsupported_geometry', 'Rectangle edges must meet at a right angle', [roomId]);
	}
	const expectedOpposite = add(widthCorner.point, scale(depthAxis, depthLength));
	if (distance(expectedOpposite, opposite.point) > 1e-5) {
		return reject('unsupported_geometry', 'Room boundary is not a rectangle; exact rectangle resize is unsupported', [roomId]);
	}

	const targetPoints = new Map<string, LayoutVec2>([
		[anchor.id, [anchor.point[0], anchor.point[1]]],
		[widthCorner.id, add(anchor.point, scale(widthAxis, width))],
		[depthCorner.id, add(anchor.point, scale(depthAxis, depth))],
		[opposite.id, add(add(anchor.point, scale(widthAxis, width)), scale(depthAxis, depth))]
	]);
	if ([...targetPoints].every(([id, point]) => coincidesAsJunction(currentJunctionPoint(document, id), point))) {
		return reject('no_op', `Room '${roomId}' already has those rectangle dimensions`, [roomId]);
	}

	const candidate = cloneDocument(document);
	for (const junction of candidate.junctions) {
		const point = targetPoints.get(junction.id);
		if (point) junction.point = point;
	}
	return finalizeWallGeometryCandidate({
		baseline: document,
		candidate,
		operation: 'rectangle-dimensions',
		changedJunctionIds: [...targetPoints.keys()],
		changedWallIds: [...new Set([...roomWallIds, widthWallId, depthWallId])]
	});
}

// =====================================================================
// P23.5 — small architectural preset set (creation defaults only).
//
// A preset is never a serialized kind, linked instance, library service or
// renderer branch (P23.5 contract): it resolves to ONE ordinary document-level
// LayoutObject of an existing primitive kind with finite/positive default
// dimensions, floor-relative placement, and no roomId. After creation the
// object edits/compiles/renders through the exact same P23.1 object controls
// and canonical compiler as every manually created primitive.
// =====================================================================

/** P23.5 preset identifiers. No `Partition` preset: partitions are first-class wall-first Walls (P23.9). */
export type LayoutArchitecturalPresetId = 'column' | 'platform' | 'plinth';

export type LayoutArchitecturalPreset = {
	id: LayoutArchitecturalPresetId;
	/** Human label for tool buttons (toolbar / Inspector Place accordion). */
	label: string;
	/** Ordinary `LayoutObject.kind` the preset creates — never a new kind. */
	kind: 'cylinder' | 'box';
	/** Finite/positive X/Z/Y meters (eye-call defaults, not constraints). */
	dimensions: Vec3;
};

/**
 * The three shipped architectural presets.
 *
 * Column → cylinder (0.4 m diameter, 3 m tall); Platform → low wide box;
 * Plinth → small display base. Defaults are an implementation/product
 * eye-call and stay editable through the existing object dimension controls
 * after creation.
 */
export const LAYOUT_ARCHITECTURAL_PRESETS: readonly LayoutArchitecturalPreset[] = [
	{ id: 'column', label: 'Column', kind: 'cylinder', dimensions: [0.4, 3, 0.4] },
	{ id: 'platform', label: 'Platform', kind: 'box', dimensions: [3, 0.2, 3] },
	{ id: 'plinth', label: 'Plinth', kind: 'box', dimensions: [0.8, 1, 0.8] }
] as const;

export function layoutArchitecturalPreset(
	id: string
): LayoutArchitecturalPreset | undefined {
	return LAYOUT_ARCHITECTURAL_PRESETS.find((preset) => preset.id === id);
}

/**
 * Floor-relative placement for one preset: the object's stored world position
 * sits half a height above the floor elevation (matching how the compiler
 * centers primitives). Returns `undefined` for non-finite/zero-height input.
 */
export function layoutPresetPlacement(
	preset: LayoutArchitecturalPreset,
	point: LayoutVec2,
	floorElevation: number
): Vec3 | undefined {
	const height = preset.dimensions[1];
	if (!Number.isFinite(height) || !(height > 0) || !Number.isFinite(floorElevation)) return undefined;
	return [point[0], floorElevation + height / 2, point[1]];
}

/**
 * P23.5 — create one ordinary LayoutObject from a preset on a wall-first
 * document. Click point is the object's X/Z center (document meters); the
 * stored transform stays project/world-local with no Room containment and no
 * preset metadata. Rejection codes reuse the canonical set so the shared
 * status/message path needs no new surface.
 */
export function planCommitLayoutObjectPreset(
	document: LayoutDocumentWallFirst,
	presetId: LayoutArchitecturalPresetId,
	point: LayoutVec2,
	floorElevation: number
): PrecisionPlan {
	const preset = layoutArchitecturalPreset(presetId);
	if (!preset) return reject('invalid_reference', `Unknown architectural preset '${presetId}'`, [presetId]);
	if (!finitePoint(point)) return reject('invalid_value', 'Preset placement point must be finite', [presetId]);
	if (!preset.dimensions.every((value) => Number.isFinite(value) && value > 0)) {
		return reject('invalid_value', 'Preset dimensions must be finite and greater than zero', [presetId]);
	}
	const position = layoutPresetPlacement(preset, point, floorElevation);
	if (!position) return reject('invalid_value', 'Preset placement requires a finite floor elevation', [presetId]);

	const candidate = cloneDocument(document);
	const objectId = nextLayoutObjectIdIn(candidate);
	const object: LayoutObject = {
		id: objectId,
		kind: preset.kind,
		position,
		rotation: [0, 0, 0],
		dimensions: [...preset.dimensions] as Vec3
	};
	candidate.objects = [...candidate.objects, object];
	const finalized = finalizeCandidate(candidate, 'layout-object-preset-create', [], [], [objectId]);
	return finalized.kind === 'success' ? { ...finalized, createdObjectId: objectId } : finalized;
}

/** Deterministic `layout-object-N` allocation from the pre-commit candidate. */
function nextLayoutObjectIdIn(document: LayoutDocumentWallFirst): string {
	const taken = new Set(document.objects.map((object) => object.id));
	let index = document.objects.length + 1;
	while (taken.has(`layout-object-${index}`)) index += 1;
	return `layout-object-${index}`;
}

/** Set exact document-level LayoutObject transform fields in a wall-first document. */
export function planExactLayoutObjectTransform(
	document: LayoutDocumentWallFirst,
	objectId: string,
	patch: LayoutObjectTransformPatch
): PrecisionPlan {
	const object = document.objects.find((candidate) => candidate.id === objectId);
	if (!object) return reject('unknown_object', `Unknown layout object '${objectId}'`, [objectId]);
	const vectorFields = (['position', 'rotation', 'dimensions'] as const).filter((field) => patch[field] !== undefined);
	const roomChanged = 'roomId' in patch && patch.roomId !== object.roomId;
	if (patch.roomId && !document.rooms.some((room) => room.id === patch.roomId)) {
		return reject('invalid_reference', `Unknown roomId '${patch.roomId}'`, [objectId, patch.roomId]);
	}
	if (vectorFields.length === 0 && !roomChanged) return reject('no_op', `Layout object '${objectId}' has no transform changes`, [objectId]);
	if (patch.position && !finiteVector(patch.position)) return reject('invalid_value', 'Object position must be finite', [objectId]);
	if (patch.rotation && !finiteVector(patch.rotation)) return reject('invalid_value', 'Object rotation must be finite radians', [objectId]);
	if (patch.dimensions && (!finiteVector(patch.dimensions) || patch.dimensions.some((value) => value <= 0))) {
		return reject('invalid_value', 'Object dimensions must be finite and greater than zero', [objectId]);
	}
	const unchanged = vectorFields.every((field) => vectorEqual(object[field] as readonly number[], patch[field] as readonly number[]));
	if (unchanged && !roomChanged) return reject('no_op', `Layout object '${objectId}' already has those values`, [objectId]);

	const candidate = cloneDocument(document);
	const target = candidate.objects.find((entry) => entry.id === objectId)!;
	if (patch.position) target.position = [...patch.position] as typeof target.position;
	if (patch.rotation) target.rotation = [...patch.rotation] as typeof target.rotation;
	if (patch.dimensions) target.dimensions = [...patch.dimensions] as typeof target.dimensions;
	if ('roomId' in patch) {
		if (patch.roomId) target.roomId = patch.roomId;
		else delete target.roomId;
	}
	return finalizeCandidate(candidate, 'layout-object-transform', [], [], [objectId]);
}

/** Delete one editable document-level LayoutObject through the same candidate gates. */
export function planDeleteLayoutObject(
	document: LayoutDocumentWallFirst,
	objectId: string
): PrecisionPlan {
	const object = document.objects.find((candidate) => candidate.id === objectId);
	if (!object) return reject('unknown_object', `Unknown layout object '${objectId}'`, [objectId]);
	if (object.kind === 'profile') return reject('invalid_reference', 'Profile objects are read-only', [objectId]);

	const candidate = cloneDocument(document);
	candidate.objects = candidate.objects.filter((entry) => entry.id !== objectId);
	return finalizeCandidate(candidate, 'layout-object-delete', [], [], [objectId]);
}

function finalizeCandidate(
	candidate: LayoutDocumentWallFirst,
	operation: PrecisionOperation,
	changedJunctionIds: readonly string[],
	changedWallIds: readonly string[],
	changedObjectIds?: readonly string[],
	createdWallIds?: readonly string[]
): PrecisionPlan {
	const structural = validateWallFirstLayoutDocument(candidate);
	if (!structural.success) {
		return reject('geometry_invalid', `Candidate failed wall-first validation: ${structural.issues[0]?.message ?? 'unknown issue'}`, undefined, structural.issues);
	}
	const topologyIssue = validateWallFirstTopology(structural.document);
	if (topologyIssue) {
		// P23.6H — a Wall-vs-Opening vertical conflict keeps its own rejection
		// code; every other topology failure stays `topology_invalid`.
		const topologyCode: PrecisionRejection['code'] =
			topologyIssue.code === 'wall_height_below_opening'
				? 'wall_height_below_opening'
				: 'topology_invalid';
		return reject(topologyCode, topologyIssue.message, topologyIssue.targetId ? [topologyIssue.targetId] : undefined, [topologyIssue]);
	}
	const compiled = compileWallFirstLayoutGeometry(structural.document);
	if (hasBlockingLayoutIssues(compiled.issues)) {
		return reject('geometry_invalid', compiled.issues[0]?.message ?? 'Candidate geometry does not compile', undefined, compiled.issues);
	}
	return {
		kind: 'success',
		document: structural.document,
		operation,
		changedJunctionIds: [...changedJunctionIds],
		changedWallIds: [...new Set([...changedWallIds, ...(createdWallIds ?? [])])],
		...(changedObjectIds ? { changedObjectIds: [...changedObjectIds] } : {})
	};
}

/**
 * P23.8 result narrowing: `RoomReconciliation` carries no `kind` discriminant,
 * so a type predicate is what lets the success branch expose `document`.
 */
function isReconciliationFailure(
	result: ReconciliationResult
): result is ReconciliationFailure {
	return 'kind' in result && result.kind === 'rejected';
}

/**
 * P23.10 — the canonical **geometry-edit acceptance path**.
 *
 * Every operation that edits canonical Junction coordinates or subdivides a
 * Wall runs the same seam, so a pointer gesture and the Inspector's exact
 * fields can never reach acceptance by different routes:
 *
 * ```text
 * candidate (immutable baseline → cloned coordinate edit, or planWallSplit)
 *   → pre-reconciliation structural/topology gate (canonical rejection codes)
 *   → candidate faces (extractBoundaryCandidateFaces)
 *   → explicit 1→1 Room boundary-cycle lineage declared from authored IDs
 *   → reconcileRooms with an allocator that records — never grants — a birth
 *   → assert exact Room identity preservation (no birth/retire/split/merge)
 *   → wall-first codec → topology → Opening set → portal relations → compiler
 * ```
 *
 * Lineage is declared from the candidate document's own authored boundary
 * cycles, never from nearest-polygon geometry: a coordinate edit leaves every
 * cycle key invariant, and `planWallSplit` has already rewritten the split
 * Room's cycle to its successor fragments. Both therefore map 1→1 by key
 * equality, which is why arbitrarily large valid moves stay exact.
 *
 * The pre-reconciliation gate runs first so a malformed reference or an
 * invalid crossing/overlap keeps its canonical rejection instead of being
 * misreported as a correspondence failure. Metadata/object operations stay on
 * the generic `finalizeCandidate` path — Room reconciliation is never forced
 * onto an operation that cannot change topology.
 */
function finalizeWallGeometryCandidate(options: {
	baseline: LayoutDocumentWallFirst;
	candidate: LayoutDocumentWallFirst;
	operation: PrecisionOperation;
	changedJunctionIds: readonly string[];
	changedWallIds: readonly string[];
	createdWallIds?: readonly string[];
}): PrecisionPlan {
	const { baseline, candidate, operation, changedJunctionIds, changedWallIds } = options;

	const preStructural = p2311Measure('structural-pre', () => validateWallFirstLayoutDocument(candidate));
	if (!preStructural.success) {
		return reject('geometry_invalid', `Candidate failed wall-first validation: ${preStructural.issues[0]?.message ?? 'unknown issue'}`, undefined, preStructural.issues);
	}
	// Geometry edits own the stable Opening-set rejection contract below. The
	// topology helper still validates the same canonical rules, but must defer
	// translating Opening-set issues or every non-height Opening failure would
	// be consumed as `topology_invalid` before the explicit gate can classify it.
	const preTopology = p2311Measure('topology-pre', () => validateWallFirstTopology(preStructural.document, { openingSet: 'defer' }));
	if (preTopology) {
		return reject(
			preTopology.code === 'wall_height_below_opening' ? 'wall_height_below_opening' : 'topology_invalid',
			preTopology.message,
			preTopology.targetId ? [preTopology.targetId] : undefined,
			[preTopology]
		);
	}

	const document = preStructural.document;
	const extraction = p2311Measure('face-extraction', () => extractBoundaryCandidateFaces(document));
	const candidateRoomById = new Map(document.rooms.map((room) => [room.id, room]));
	const components: ComponentLineage[] = [];
	for (const room of baseline.rooms) {
		const candidateRoom = candidateRoomById.get(room.id);
		if (!candidateRoom) {
			return reject('room_identity_lost', `Room '${room.id}' has no candidate boundary`, [room.id]);
		}
		components.push({
			candidateFaceKeys: [canonicalBoundaryCycleKey(candidateRoom.boundary)],
			predecessorRoomIds: [room.id]
		});
	}

	const allocationAttempted = { value: false };
	const reconciliation: ReconciliationResult = p2311Measure('room-reconciliation', () => reconcileRooms({
		baseline,
		candidateDocument: document,
		extraction,
		components,
		allocator: guardedRoomAllocator(allocationAttempted)
	}));
	if (isReconciliationFailure(reconciliation)) {
		const { rejection } = reconciliation;
		return reject('room_identity_lost', rejection.message, rejection.roomIds);
	}

	const identityIssue = assertWallGeometryRoomIdentityPreserved(
		baseline,
		document,
		reconciliation,
		allocationAttempted.value
	);
	if (identityIssue) {
		return reject('room_identity_lost', identityIssue.message, identityIssue.targetIds);
	}

	const reconciled = reconciliation.document;
	const structural = p2311Measure('structural-post', () => validateWallFirstLayoutDocument(reconciled));
	if (!structural.success) {
		return reject('geometry_invalid', `Candidate failed wall-first validation: ${structural.issues[0]?.message ?? 'unknown issue'}`, undefined, structural.issues);
	}
	const topologyIssue = p2311Measure('topology-post', () => validateWallFirstTopology(structural.document, { openingSet: 'defer' }));
	if (topologyIssue) {
		return reject(
			topologyIssue.code === 'wall_height_below_opening' ? 'wall_height_below_opening' : 'topology_invalid',
			topologyIssue.message,
			topologyIssue.targetId ? [topologyIssue.targetId] : undefined,
			[topologyIssue]
		);
	}
	const setIssues = p2311Measure('opening-set', () => validateWallFirstOpeningSet(structural.document));
	if (setIssues.length > 0) {
		const first = setIssues[0]!;
		return reject(
			first.code === 'opening_exceeds_wall_height' ? 'wall_height_below_opening' : 'opening_set_invalid',
			first.message,
			[first.wallId, first.openingId],
			setIssues
		);
	}
	const relationIssues = p2311Measure('portal-relations', () => validateWallFirstPortalRelations(structural.document));
	if (relationIssues.length > 0) {
		const first = relationIssues[0]!;
		return reject('portal_relation_invalid', first.message, [first.openingId], relationIssues);
	}
	const compiled = p2311Measure('acceptance-compile', () => compileWallFirstLayoutGeometry(structural.document));
	if (hasBlockingLayoutIssues(compiled.issues)) {
		return reject('geometry_invalid', compiled.issues[0]?.message ?? 'Candidate geometry does not compile', undefined, compiled.issues);
	}
	return {
		kind: 'success',
		document: structural.document,
		operation,
		changedJunctionIds: [...changedJunctionIds],
		changedWallIds: [...new Set([...changedWallIds, ...(options.createdWallIds ?? [])])],
		acceptance: {
			documentJson: structural.canonicalJson,
			geometry: compiled.geometry,
			issues: compiled.issues
		}
	};
}

/**
 * An allocator that must never be reached: a coordinate edit or subdivision
 * preserves global Room identity, so a reconciliation branch that allocates a
 * Room ID/name is proof the operation was not identity-preserving. It records
 * the attempt instead of throwing so the planner rejects through its ordinary
 * result contract.
 */
function guardedRoomAllocator(attempted: { value: boolean }): RoomIdAllocator {
	return {
		nextRoomId(_document, faceKey) {
			attempted.value = true;
			return `unreachable-wall-edit.${faceKey}`;
		},
		nextRoomName() {
			attempted.value = true;
			return 'Unreachable Wall Edit';
		}
	};
}

/**
 * Prove the geometry edit preserved **global** Room identity: every baseline
 * Room survives with the same ID and name, no Room was born, retired, split or
 * merged, the declared candidate boundary cycle was honored, and reconciliation
 * never reached an allocating branch.
 */
function assertWallGeometryRoomIdentityPreserved(
	baseline: LayoutDocumentWallFirst,
	candidate: LayoutDocumentWallFirst,
	reconciliation: {
		document: LayoutDocumentWallFirst;
		lineage: readonly {
			faceKey: string;
			roomId: string;
			predecessorRoomIds: readonly string[];
			kind: 'preserved' | 'split-survivor' | 'merge-survivor' | 'created';
		}[];
		retiredRoomIds: readonly string[];
	},
	allocationAttempted: boolean
): { message: string; targetIds?: readonly string[] } | null {
	if (allocationAttempted) {
		return {
			message: 'Geometry edit reached a Room allocation branch; direct Wall/Junction edits preserve Room identity'
		};
	}
	if (reconciliation.retiredRoomIds.length > 0) {
		return {
			message: `Geometry edit retired Room(s) ${reconciliation.retiredRoomIds.join(', ')}`,
			targetIds: [...reconciliation.retiredRoomIds]
		};
	}
	if (reconciliation.lineage.length !== baseline.rooms.length) {
		return {
			message: `Geometry edit produced ${reconciliation.lineage.length} lineage record(s) for ${baseline.rooms.length} Room(s)`
		};
	}
	for (const record of reconciliation.lineage) {
		if (record.kind !== 'preserved' || record.predecessorRoomIds.length !== 1) {
			return {
				message: `Geometry edit produced a '${record.kind}' lineage record for Room '${record.roomId}'`,
				targetIds: [record.roomId]
			};
		}
	}
	if (reconciliation.document.rooms.length !== baseline.rooms.length) {
		return {
			message: `Room count changed during the geometry edit (${baseline.rooms.length} → ${reconciliation.document.rooms.length})`
		};
	}
	const finalByRoomId = new Map(reconciliation.document.rooms.map((room) => [room.id, room]));
	const candidateById = new Map(candidate.rooms.map((room) => [room.id, room]));
	for (const room of baseline.rooms) {
		const finalRoom = finalByRoomId.get(room.id);
		if (!finalRoom) {
			return { message: `Room '${room.id}' did not survive the geometry edit`, targetIds: [room.id] };
		}
		if (finalRoom.name !== room.name) {
			return { message: `Room '${room.id}' name changed during the geometry edit`, targetIds: [room.id] };
		}
		const declared = candidateById.get(room.id);
		if (
			!declared ||
			canonicalBoundaryCycleKey(finalRoom.boundary) !== canonicalBoundaryCycleKey(declared.boundary)
		) {
			return {
				message: `Room '${room.id}' boundary lineage changed during the geometry edit`,
				targetIds: [room.id]
			};
		}
	}
	return null;
}

/**
 * The one canonical **wall-first topology gate** for wall-first candidates:
 * no duplicate Junction points, non-zero Wall lengths, explicit-junction-only
 * Wall relationships (collinear overlap rejected), Room boundary
 * connectivity/role, and translation of the first canonical Opening-set
 * issue. Shared by the P23.1 precision planners (via `finalizeCandidate`) and
 * the P23.6a Room-move planner — never copied.
 *
 * P23B.3a S4/S5 — THE SUBJECT OF EVERY INTERSECTION CHECK IS THE CONNECTED
 * COMPONENT, not the document (Option E, decision record §2.10; M-3a-2). The
 * predicate, its verdict vocabulary, its messages and its diagnostic order are
 * UNCHANGED — only WHICH PAIRS reach it changed (INV-2):
 *
 * ```text
 * COMPONENT-SCOPED  the pairwise `classifyWallIntersection` loop, the sampled
 *                   crossing authority (`detectWallCurveTopologyCrossings`) and the
 *                   `duplicate_junction_point` coincidence rule (D-9). An
 *                   intersection or a coincident node BETWEEN two components is
 *                   PERMITTED geometry — an independent Room may be moved through
 *                   another, independent curved Walls may cross, collinear overlap
 *                   between independent groups is legal, and two independent
 *                   structures may sit at identical coordinates.
 * DOCUMENT-GLOBAL   zero-length Walls, Room boundary closure/role/minimum length,
 *                   a self-intersecting centerline, and the translated Opening-set
 *                   issue. These are INTRINSIC to one structural element, not
 *                   relationships between two elements, so Option E does not relax
 *                   them.
 * ```
 *
 * CONNECTIVITY IS THE TRANSITIVE CLOSURE of explicit authored Junction identity,
 * never coordinates: two Walls with no Junction id in common can still be ONE
 * component through a third Wall, and two Walls whose endpoints merely coincide are
 * in DIFFERENT components. Labelling is the S2 general Wall/Junction test — the
 * SAME authority the reconciliation authorization uses, never a second connectivity
 * recipe — so every same-component verdict this gate produced before is still
 * produced (OR-3a/OR-3b; see `layout-p23b3a-scoped-gate.test.ts`).
 */
export type WallFirstTopologyOptions = {
	/**
	 * Keep the Opening-set validator canonical, but let a caller that owns a
	 * later stable Opening rejection gate defer its translation. The default
	 * preserves the historical topology-gate contract.
	 */
	openingSet?: 'translate' | 'defer';
};

export function validateWallFirstTopology(
	document: LayoutDocumentWallFirst,
	options: WallFirstTopologyOptions = {}
): LayoutGeometryIssue | undefined {
	// P23B.3a S5 / D-9 — the coincidence rule is COMPONENT-SCOPED: a coincident node
	// is an ACCIDENT only where the two nodes describe one graph, so equal
	// coordinates are refused when the Junctions share a component and PERMITTED when
	// they do not. The code, path, message and document order below are unchanged —
	// only which pairs reach the predicate (INV-2).
	//
	// UNATTACHED JUNCTIONS keep the general test's deliberate rule: a Junction no Wall
	// references carries the single `UNATTACHED_JUNCTION_COMPONENT` label, so two
	// coincident unattached Junctions are STILL invalid, while an unattached Junction
	// coinciding with a Wall's Junction is permitted (D-9).
	const keyByJunctionId = topologyComponentKeyByJunctionId(document);
	for (let first = 0; first < document.junctions.length; first += 1) {
		for (let second = first + 1; second < document.junctions.length; second += 1) {
			if (
				keyByJunctionId.get(document.junctions[first]!.id) !==
				keyByJunctionId.get(document.junctions[second]!.id)
			) {
				continue;
			}
			if (coincidesAsJunction(document.junctions[first]!.point, document.junctions[second]!.point)) {
				return {
					path: `junctions[${second}].point`,
					code: 'duplicate_junction_point',
					message: `Junction '${document.junctions[second]!.id}' duplicates the point of '${document.junctions[first]!.id}'`,
					targetId: document.junctions[second]!.id
				};
			}
		}
	}

	const wallSegments = new Map<string, TopologySegment>();
	for (const wall of document.walls) {
		const endpoints = wallEndpoints(document, wall);
		if (!endpoints || !(endpoints.length > POINT_EPSILON)) {
			return {
				path: `walls.${wall.id}`,
				code: 'zero_length_wall',
				message: `Wall '${wall.id}' must have a non-zero effective length`,
				targetId: wall.id
			};
		}
		wallSegments.set(wall.id, { id: wall.id, start: endpoints.start, end: endpoints.end });
	}

	const walls = document.walls;
	// P23B.3a S4 — component-scoped SUBJECT (the transitive closure of explicit
	// Junction identity, never coordinates: two Walls with no Junction id in common
	// can still be one component through a third Wall). A pair from two different
	// components is skipped before the UNCHANGED predicate sees it, so the
	// `shared-explicit-junction` branch below is unreachable for a skipped pair and
	// no same-component verdict is dropped. The labelling is derived again inside the
	// sampled gate; that redundancy is deliberate — it keeps one public signature and
	// no way for a caller to hand in a labelling that disagrees with the document,
	// and sharing the derivation is the scoped-validation work's own concern.
	const keyByWallId = topologyComponentKeyByWallId(document);
	for (let first = 0; first < walls.length; first += 1) {
		for (let second = first + 1; second < walls.length; second += 1) {
			const a = walls[first]!;
			const b = walls[second]!;
			if (keyByWallId.get(a.id) !== keyByWallId.get(b.id)) continue;
			const segmentA = wallSegments.get(a.id)!;
			const segmentB = wallSegments.get(b.id)!;
			const shared = sharedJunctionIds(a, b);
			const intersection = classifyWallIntersection(segmentA, segmentB, shared);
			if (intersection.kind === 'shared-explicit-junction') {
				// The classifier intentionally gives explicit connectivity priority;
				// still reject two collinear spans that overlap beyond the shared
				// endpoint, which is not a valid graph edge.
				const geometric = classifyWallIntersection(segmentA, segmentB, []);
				if (geometric.kind === 'collinear-overlap') {
					return topologyFailure(a.id, b.id, 'Walls overlap beyond their explicit shared Junction');
				}
				continue;
			}
			if (intersection.kind !== 'none') {
				return topologyFailure(a.id, b.id, `Walls '${a.id}' and '${b.id}' have unsupported ${intersection.kind}`);
			}
		}
	}

	// P23.11 — canonical curve-level crossing gate (one implementation, shared
	// with the Wall-chain authoring path).
	const curveCrossing = detectWallCurveTopologyCrossings(document, wallSegments);
	if (curveCrossing) {
		if (curveCrossing.kind === 'self') {
			return topologyFailure(
				curveCrossing.wallId,
				curveCrossing.wallId,
				`Wall '${curveCrossing.wallId}' centerline intersects itself`
			);
		}
		const [firstCurve, secondCurve] = curveCrossing.wallIds;
		return topologyFailure(
			firstCurve,
			secondCurve,
			curveCrossing.sharedJunctionId
				? `Walls '${firstCurve}' and '${secondCurve}' cross away from their shared Junction`
				: `Walls '${firstCurve}' and '${secondCurve}' have unsupported centerline crossing`
		);
	}

	const wallById = new Map(document.walls.map((wall) => [wall.id, wall]));
	for (const room of document.rooms) {
		if (room.boundary.length < 3) {
			return topologyFailure(room.id, undefined, `Room '${room.id}' needs at least three boundary Walls`);
		}
		let previousEnd: string | undefined;
		let firstStart: string | undefined;
		for (const [index, ref] of room.boundary.entries()) {
			const wall = wallById.get(ref.wallId)!;
			if (wall.role !== 'boundary') {
				return topologyFailure(room.id, ref.wallId, `Room '${room.id}' references non-boundary Wall '${ref.wallId}'`);
			}
			const start = ref.direction === 'forward' ? wall.startJunctionId : wall.endJunctionId;
			const end = ref.direction === 'forward' ? wall.endJunctionId : wall.startJunctionId;
			if (index === 0) firstStart = start;
			if (previousEnd !== undefined && previousEnd !== start) {
				return topologyFailure(room.id, ref.wallId, `Room '${room.id}' boundary is disconnected at Wall '${ref.wallId}'`);
			}
			previousEnd = end;
		}
		if (previousEnd !== firstStart) return topologyFailure(room.id, undefined, `Room '${room.id}' boundary is not closed`);
	}

	if (options.openingSet !== 'defer') {
		// Whole-hosting-Wall opening set: ONE canonical validator shared with the
		// P23.3 opening create/edit/drag/resize paths (`layout-opening-set.ts`).
		// Do not duplicate fit/overlap/vertical checks here — this gate only
		// translates the first canonical issue.
		const openingIssue = validateWallFirstOpeningSet(document)[0];
		if (openingIssue) {
			// P23.6H — the host-Wall vertical-fit issue gets a dedicated code so a
			// Wall-height edit can report it as `wall_height_below_opening` instead of
			// a generic topology failure. The canonical Opening validator owns the
			// rule; this branch only translates its issue.
			if (openingIssue.code === 'opening_exceeds_wall_height') {
				return {
					path: `walls.${openingIssue.wallId}.height`,
					code: 'wall_height_below_opening',
					message: openingIssue.message,
					targetId: openingIssue.wallId
				};
			}
			return topologyFailure(
				openingIssue.openingId,
				openingIssue.wallId,
				openingIssue.message
			);
		}
	}
	return undefined;
}

/** Resolve the canonical rectangle anchor, incident width edge, and endpoints. */
export function resolveRectangle(
	document: LayoutDocumentWallFirst,
	roomId: string,
	options: RectangleResizeOptions = {}
): RectangleResolution {
	const room = document.rooms.find((candidate) => candidate.id === roomId);
	if (!room) return { rejection: makeRejection('unknown_room', `Unknown room '${roomId}'`, [roomId]) };
	if (room.boundary.length !== 4) {
		return { rejection: makeRejection('unsupported_geometry', 'Rectangle resize requires four straight boundary Walls', [roomId]) };
	}
	const wallById = new Map(document.walls.map((wall) => [wall.id, wall]));
	const directed = room.boundary.map((ref) => {
		const wall = wallById.get(ref.wallId);
		if (!wall) return undefined;
		return {
			wall,
			wallId: wall.id,
			startId: ref.direction === 'forward' ? wall.startJunctionId : wall.endJunctionId,
			endId: ref.direction === 'forward' ? wall.endJunctionId : wall.startJunctionId
		};
	});
	if (directed.some((entry) => !entry)) return { rejection: makeRejection('invalid_reference', `Room '${roomId}' has an unresolved boundary Wall`, [roomId]) };
	const edges = directed as Array<NonNullable<(typeof directed)[number]>>;
	if (new Set(edges.flatMap((edge) => [edge.startId, edge.endId])).size !== 4) {
		return { rejection: makeRejection('unsupported_geometry', 'Rectangle resize requires four distinct corner Junctions', [roomId]) };
	}
	for (let index = 0; index < edges.length; index += 1) {
		if (edges[index]!.endId !== edges[(index + 1) % edges.length]!.startId) {
			return { rejection: makeRejection('unsupported_geometry', `Room '${roomId}' boundary is not a connected four-edge cycle`, [roomId]) };
		}
	}

	const junctionById = new Map(document.junctions.map((junction) => [junction.id, junction]));
	const cornerIds = [...new Set(edges.flatMap((edge) => [edge.startId, edge.endId]))].sort((a, b) => a.localeCompare(b));
	const corners = cornerIds.map((id) => junctionById.get(id));
	if (corners.some((junction) => !junction)) {
		return { rejection: makeRejection('invalid_reference', `Room '${roomId}' has an unresolved corner Junction`, [roomId]) };
	}
	const anchorJunctionId = options.anchorJunctionId ?? cornerIds[0];
	if (!anchorJunctionId || !cornerIds.includes(anchorJunctionId)) {
		return { rejection: makeRejection('invalid_reference', `Anchor Junction '${options.anchorJunctionId ?? ''}' is not a corner of Room '${roomId}'`, [roomId]) };
	}
	const incident = edges.filter((edge) => edge.startId === anchorJunctionId || edge.endId === anchorJunctionId).sort((a, b) => a.wallId.localeCompare(b.wallId));
	if (incident.length !== 2) return { rejection: makeRejection('unsupported_geometry', `Room '${roomId}' anchor must have exactly two incident boundary Walls`, [roomId]) };
	const widthEdge = options.widthWallId
		? incident.find((edge) => edge.wallId === options.widthWallId)
		: incident[0];
	if (!widthEdge) return { rejection: makeRejection('invalid_reference', `Width Wall '${options.widthWallId ?? ''}' is not incident to the anchor`, [roomId]) };
	const depthEdge = incident.find((edge) => edge.wallId !== widthEdge.wallId)!;
	const widthEndpointId = widthEdge.startId === anchorJunctionId ? widthEdge.endId : widthEdge.startId;
	const depthEndpointId = depthEdge.startId === anchorJunctionId ? depthEdge.endId : depthEdge.startId;
	return {
		anchorJunctionId,
		widthEndpointId,
		depthEndpointId,
		corners: corners as LayoutJunction[],
		roomWallIds: edges.map((edge) => edge.wallId),
		widthWallId: widthEdge.wallId,
		depthWallId: depthEdge.wallId
	};
}

function hasAmbiguousSharedBoundary(
	document: LayoutDocumentWallFirst,
	roomId: string,
	roomWallIds: readonly string[],
	cornerIds: readonly string[]
): boolean {
	const roomWalls = new Set(roomWallIds);
	if (document.rooms.some((room) => room.id !== roomId && room.boundary.some((ref) => roomWalls.has(ref.wallId)))) return true;
	return cornerIds.some((junctionId) =>
		document.walls.some((wall) =>
			(wall.startJunctionId === junctionId || wall.endJunctionId === junctionId) && !roomWalls.has(wall.id)
		)
	);
}

/**
 * P23.11 — a Wall pair (or one Wall against itself) that only the **sampled**
 * centerlines reveal.
 */
export type WallCurveTopologyCrossing =
	| { kind: 'self'; wallId: string }
	| { kind: 'pair'; wallIds: [string, string]; sharedJunctionId?: string };

/**
 * P23.11 — the canonical **curve-level** Wall-crossing gate.
 *
 * `classifyWallIntersection` is exact for straight Walls but blind to
 * curvature: two Walls whose endpoint chords miss each other can still cross
 * where they bow, and one curved Wall can cross a straight host its chord never
 * reaches. This walks both sampled centerlines through the curve kernel's own
 * polyline predicate (never a second intersection recipe) and reports the first
 * offending Wall or pair, or `undefined` when the document is clear.
 *
 * Shared by `validateWallFirstTopology` and the P23.9 Wall-chain authoring path,
 * so a chain that would bow across an existing curved Wall — with a clear
 * endpoint chord — rejects before any commit through the same authority. A
 * straight Wall contributes just its two chord endpoints (a straight polyline
 * IS its chord), so a document with no curves pays nothing beyond one record
 * per Wall.
 *
 * P23B.3a S4/S5 — THE SUBJECT IS THE CONNECTED COMPONENT (M-3a-2, decision record
 * §2.10): a pair of Walls in different components is skipped BEFORE the sampled
 * predicate runs, so their crossing is permitted geometry rather than a verdict.
 * The predicate, the self scan, the first-crossing-in-`document.walls`-order rule
 * and the reported pair are unchanged (INV-2) — only which pairs are examined.
 *
 * Connectivity is the TRANSITIVE closure of explicit authored Junction identity,
 * never coordinates: two Walls can share a component through a third Wall, and
 * merely coincident endpoints never join anything. This gate is scoped ONCE, with
 * no pre-policy escape: every caller — the canonical gate and the Wall-chain gate
 * alike — gets the component subject (S5 removed the transitional document-subject
 * form S4 left for the chain path).
 */
export function detectWallCurveTopologyCrossings(
	document: LayoutDocumentWallFirst,
	wallSegments: ReadonlyMap<string, TopologySegment>
): WallCurveTopologyCrossing | undefined {
	const sampledWalls = new Map<string, SampledTopologyWall>();
	for (const wall of document.walls) {
		const segment = wallSegments.get(wall.id);
		if (!segment) continue;
		let samples: readonly CurveSample[];
		if (wall.centerline.kind === 'line') {
			samples = chordPolyline(segment);
		} else {
			const endpoints = wallEndpoints(document, wall);
			const sampled = endpoints
				? wallCenterlineSamples(wall, endpoints.start, endpoints.end, 'forward')
				: undefined;
			if (!sampled) continue;
			samples = sampled.samples;
		}
		sampledWalls.set(wall.id, {
			id: wall.id,
			startJunctionId: wall.startJunctionId,
			endJunctionId: wall.endJunctionId,
			samples
		});
	}
	for (const wall of document.walls) {
		if (wall.centerline.kind === 'line') continue;
		const sampled = sampledWalls.get(wall.id);
		if (sampled && sampledWallSelfIntersects(sampled)) {
			return { kind: 'self', wallId: wall.id };
		}
	}
	// P23B.3a S4 — two Walls from different components never reach the sampled
	// predicate. Every pair that does share a Junction id is in one component, so
	// `shared` below can never point at a pair this skips.
	const keyByWallId = topologyComponentKeyByWallId(document);
	for (let first = 0; first < document.walls.length; first += 1) {
		for (let second = first + 1; second < document.walls.length; second += 1) {
			const a = document.walls[first]!;
			const b = document.walls[second]!;
			if (keyByWallId.get(a.id) !== keyByWallId.get(b.id)) continue;
			// Two straight Walls are already fully decided by the chord gate.
			if (a.centerline.kind === 'line' && b.centerline.kind === 'line') continue;
			const sampledA = sampledWalls.get(a.id);
			const sampledB = sampledWalls.get(b.id);
			if (!sampledA || !sampledB) continue;
			const shared = sharedJunctionIds(a, b)[0];
			if (!sampledWallsCross(sampledA, sampledB, shared)) continue;
			return shared
				? { kind: 'pair', wallIds: [a.id, b.id], sharedJunctionId: shared }
				: { kind: 'pair', wallIds: [a.id, b.id] };
		}
	}
	return undefined;
}

function topologyFailure(firstId: string, secondId: string | undefined, message: string): LayoutGeometryIssue {
	return {
		path: `topology.${firstId}`,
		code: 'unsupported_wall_topology',
		message,
		targetId: secondId ?? firstId
	};
}

function wallEndpoints(
	document: LayoutDocumentWallFirst,
	wall: LayoutWall
): { start: LayoutVec2; end: LayoutVec2; length: number } | undefined {
	const start = document.junctions.find((junction) => junction.id === wall.startJunctionId)?.point;
	const end = document.junctions.find((junction) => junction.id === wall.endJunctionId)?.point;
	if (!start || !end) return undefined;
	return { start, end, length: distance(start, end) };
}

function currentJunctionPoint(document: LayoutDocumentWallFirst, junctionId: string): LayoutVec2 {
	return document.junctions.find((junction) => junction.id === junctionId)!.point;
}

function moveJunction(document: LayoutDocumentWallFirst, junctionId: string, point: LayoutVec2): LayoutDocumentWallFirst {
	const candidate = cloneDocument(document);
	candidate.junctions.find((junction) => junction.id === junctionId)!.point = [point[0], point[1]];
	return candidate;
}

function incidentWallIds(document: LayoutDocumentWallFirst, junctionId: string): string[] {
	return document.walls
		.filter((wall) => wall.startJunctionId === junctionId || wall.endJunctionId === junctionId)
		.map((wall) => wall.id);
}

/**
 * P23.11 — a straight Wall's centerline as a two-point polyline. Densifying a
 * line adds no information for crossing tests, so the chord endpoints are the
 * whole representation (and the shape `sampledWallsCross` already walks for
 * curved Walls).
 */
function chordPolyline(segment: TopologySegment): CurveSample[] {
	return [
		{ point: segment.start, distance: 0, tangent: [1, 0], normal: [0, 1], t: 0 },
		{ point: segment.end, distance: distance(segment.start, segment.end), tangent: [1, 0], normal: [0, 1], t: 1 }
	];
}

function sharedJunctionIds(a: LayoutWall, b: LayoutWall): string[] {
	return [a.startJunctionId, a.endJunctionId].filter((id) => id === b.startJunctionId || id === b.endJunctionId);
}

function cloneDocument(document: LayoutDocumentWallFirst): LayoutDocumentWallFirst {
	return {
		...document,
		floor: { ...document.floor },
		junctions: document.junctions.map((junction) => ({ ...junction, point: [junction.point[0], junction.point[1]] })),
		// P23.11 — Wall clones deep-copy the centerline so candidate planners
		// never share anchor arrays or points with the baseline.
		walls: document.walls.map((wall) => ({ ...wall, centerline: cloneWallCenterline(wall.centerline) })),
		rooms: document.rooms.map((room) => ({ ...room, boundary: room.boundary.map((ref) => ({ ...ref })) })),
		openings: document.openings.map((opening) => ({
			...opening,
			...(opening.connectsRoomIds ? { connectsRoomIds: [...opening.connectsRoomIds] as [string, string] } : {})
		})),
		objects: document.objects.map((object) => ({
			...object,
			position: [...object.position] as typeof object.position,
			rotation: [...object.rotation] as typeof object.rotation,
			dimensions: [...object.dimensions] as typeof object.dimensions,
			...(object.profile
				? {
						profile: {
							...object.profile,
							segments: object.profile.segments.map((segment) => ({
								...segment,
								start: [...segment.start] as LayoutVec2,
								end: [...segment.end] as LayoutVec2,
								...(segment.kind === 'auto-bezier'
									? { interiorAnchors: segment.interiorAnchors.map((anchor) => ({ ...anchor, point: [...anchor.point] as LayoutVec2 })) }
									: {})
							}))
						}
					}
				: {})
		}))
	};
}

function reject(
	code: PrecisionRejection['code'],
	message: string,
	targetIds?: readonly string[],
	issues?: readonly (LayoutDocumentIssue | LayoutGeometryIssue)[]
): PrecisionPlan {
	return { kind: 'rejected', rejection: makeRejection(code, message, targetIds, issues) };
}

function makeRejection(
	code: PrecisionRejection['code'],
	message: string,
	targetIds?: readonly string[],
	issues?: readonly (LayoutDocumentIssue | LayoutGeometryIssue)[]
): PrecisionRejection {
	return { code, message, ...(targetIds ? { targetIds } : {}), ...(issues ? { issues } : {}) };
}

function finitePositive(value: number | undefined): value is number {
	return typeof value === 'number' && Number.isFinite(value) && value > POINT_EPSILON;
}

function finitePoint(point: readonly number[]): point is LayoutVec2 {
	return point.length === 2 && point.every((value) => Number.isFinite(value));
}

function finiteVector(vector: readonly number[]): boolean {
	return vector.length === 3 && vector.every((value) => Number.isFinite(value));
}

function validFixedEndpoint(value: unknown): value is FixedWallEndpoint {
	return value === 'start' || value === 'end';
}

function distance(a: LayoutVec2, b: LayoutVec2): number {
	return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

function subtract(a: LayoutVec2, b: LayoutVec2): LayoutVec2 {
	return [a[0] - b[0], a[1] - b[1]];
}

function add(a: LayoutVec2, b: LayoutVec2): LayoutVec2 {
	return [a[0] + b[0], a[1] + b[1]];
}

function scale(a: LayoutVec2, factor: number): LayoutVec2 {
	return [a[0] * factor, a[1] * factor];
}

function normalize(a: LayoutVec2): LayoutVec2 | undefined {
	const length = Math.hypot(a[0], a[1]);
	return length > POINT_EPSILON ? [a[0] / length, a[1] / length] : undefined;
}

function dot(a: LayoutVec2, b: LayoutVec2): number {
	return a[0] * b[0] + a[1] * b[1];
}

function vectorEqual(a: readonly number[], b: readonly number[]): boolean {
	return a.length === b.length && a.every((value, index) => value === b[index]);
}

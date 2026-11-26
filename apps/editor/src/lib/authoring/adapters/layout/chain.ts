import { drawingRefusalWords } from './refusals';
/**
 * The straight Wall chain: draft state, deliberate targets and the
 * planner-derived consequence the creator sees before finishing.
 *
 * Framework-free and document-free: it owns **the draft** (which points the
 * creator has named, and what each point deliberately targets) and nothing else.
 * The canonical `planWallChain` remains the semantic authority — every preview
 * and every commit runs it over the accepted baseline, and this module never
 * builds geometry, never allocates an identity and never decides validity.
 *
 * ```text
 * tap on a Junction mark      → target junction  (declared de-jure connection)
 * tap on a Wall's interior    → target host      (the planner splits that Wall)
 * tap anywhere else           → free point       (independent placement)
 * ```
 *
 * "Nearness never adopts a coordinate" is mechanical here: a point carries a
 * target ONLY when the creator's gesture named that target (a mark, a Wall's
 * interior, or an exact typed coordinate that lands on one). A free point whose
 * coordinates happen to coincide with an existing Junction stays free, which is
 * exactly the planner's declared-vs-inferred rule.
 */
import {
	coincidesAsJunction,
	detectUnsupportedChainConnections,
	JUNCTION_COINCIDENCE_EPSILON,
	planWallChain,
	wallCenterlineCarriesPoint,
	type LayoutDocumentWallFirst,
	type WallChainArc,
	type WallChainPlan,
	type WallEndpointHostSnap,
	type WallEndpointJunctionSnap,
} from '@portfolio/layout-core/wall';
import { faceArea, type LayoutVec2 } from '@portfolio/layout-core/geometry';
import { roomBoundaryPolygon } from '@portfolio/layout-core/room';
import type { LayoutIdCapture } from '@portfolio/layout-core/plan';

/** What one draft point deliberately names, if anything. */
export type ChainPointTarget =
	| { readonly kind: 'free' }
	| { readonly kind: 'junction'; readonly junctionId: string }
	| { readonly kind: 'host'; readonly wallId: string };

export type ChainDraftPoint = {
	/** The exact point the planner is handed (a target's own coordinate wins). */
	readonly point: LayoutVec2;
	readonly target: ChainPointTarget;
};

export type ChainDraft = {
	readonly points: readonly ChainDraftPoint[];
	/** The creator asked to close the ring (or re-tapped the start point). */
	readonly closed: boolean;
};

export const EMPTY_CHAIN_DRAFT: ChainDraft = Object.freeze({
	points: Object.freeze([]),
	closed: false,
});

export type ChainDraftRefusal = { readonly kind: 'refused'; readonly message: string };

function hasPoint(draft: ChainDraft, point: LayoutVec2): boolean {
	return draft.points.some((entry) => entry.point[0] === point[0] && entry.point[1] === point[1]);
}

/**
 * Add one draft point.
 *
 * A point identical to the point before it names no leg, so it is refused in
 * words rather than silently dropped: the creator tapped twice, not once, and
 * the live chain stays exactly as it was.
 */
export function appendChainPoint(
	draft: ChainDraft,
	next: ChainDraftPoint,
): ChainDraft | ChainDraftRefusal {
	const last = draft.points[draft.points.length - 1];
	if (last !== undefined && last.point[0] === next.point[0] && last.point[1] === next.point[1]) {
		return { kind: 'refused', message: 'That point repeats the last one; name a new point.' };
	}
	return { points: [...draft.points, next], closed: draft.closed };
}

/** Remove the last live point (Backtrack). An empty draft is unchanged. */
export function backtrackChainPoint(draft: ChainDraft): ChainDraft {
	if (draft.points.length === 0) return draft;
	return { points: draft.points.slice(0, -1), closed: false };
}

/**
 * Close the ring. A ring needs three distinct vertices; the planner would refuse
 * fewer, and the live chain must not be replaced by a document that cannot be
 * committed.
 */
export function closeChainDraft(draft: ChainDraft): ChainDraft | ChainDraftRefusal {
	if (draft.points.length < 3) {
		return { kind: 'refused', message: 'A closed ring needs at least three points.' };
	}
	return { points: draft.points, closed: true };
}

/**
 * The deliberate target for a **typed** coordinate.
 *
 * The typed path is exact input, so an exact landing on a Junction or on a
 * Wall's interior is the creator naming that target; anything else is a free
 * point. A coordinate that merely comes close to neither adopts nothing.
 */
export function classifyTypedChainPoint(
	document: LayoutDocumentWallFirst,
	point: LayoutVec2,
): ChainDraftPoint {
	for (const junction of document.junctions) {
		if (coincidesAsJunction(point, junction.point)) {
			return {
				point: [junction.point[0], junction.point[1]],
				target: { kind: 'junction', junctionId: junction.id },
			};
		}
	}
	const junctionById = new Map(document.junctions.map((junction) => [junction.id, junction]));
	for (const wall of document.walls) {
		const start = junctionById.get(wall.startJunctionId)?.point;
		const end = junctionById.get(wall.endJunctionId)?.point;
		if (start === undefined || end === undefined) continue;
		// Interior only: a coordinate on the Wall's own endpoint is the Junction
		// case above, which the loop has already answered.
		if (!wallCenterlineCarriesPoint(wall, start, end, point)) continue;
		if (coincidesAsJunction(point, start) || coincidesAsJunction(point, end)) continue;
		return { point: [point[0], point[1]], target: { kind: 'host', wallId: wall.id } };
	}
	return { point: [point[0], point[1]], target: { kind: 'free' } };
}

/**
 * Ink's **Box** for the Wall reading: two opposite corners name the
 * closed four-point ring a creator would otherwise tap by hand.
 *
 * The two named corners keep the targets the gesture gave them (a Junction mark,
 * a Wall interior or a snapped free point). The two derived corners are exact
 * coordinates, so they name a target only by landing on one exactly, as a typed
 * point does. The ring runs first → (opposite x, first z) → opposite →
 * (first x, opposite z) and is closed, so it is the same draft — and the same
 * one `layout-wall-chain-commit` — as those four points tapped and closed by hand.
 *
 * A box with no extent on either axis would hand the planner zero-length legs;
 * it is refused in words here, before any preview or acceptance.
 */
export function boxChainDraft(
	document: LayoutDocumentWallFirst,
	first: ChainDraftPoint,
	opposite: ChainDraftPoint,
): ChainDraft | ChainDraftRefusal {
	const [ax, az] = first.point;
	const [cx, cz] = opposite.point;
	if (
		Math.abs(cx - ax) <= JUNCTION_COINCIDENCE_EPSILON ||
		Math.abs(cz - az) <= JUNCTION_COINCIDENCE_EPSILON
	) {
		return {
			kind: 'refused',
			message: 'A Box needs two corners apart on both axes; drag diagonally to open a rectangle.',
		};
	}
	return {
		points: [
			{ point: [ax, az], target: first.target },
			classifyTypedChainPoint(document, [cx, az]),
			{ point: [cx, cz], target: opposite.target },
			classifyTypedChainPoint(document, [ax, cz]),
		],
		closed: true,
	};
}

/** The planner input this draft names: points in order, plus its declarations. */
export function chainPlanRequest(draft: ChainDraft): {
	readonly points: readonly LayoutVec2[];
	readonly close: boolean;
	readonly endpointJunctionSnaps: readonly WallEndpointJunctionSnap[];
	readonly endpointHostSnaps: readonly WallEndpointHostSnap[];
} {
	const points: LayoutVec2[] = draft.points.map((entry) => [entry.point[0], entry.point[1]]);
	const endpointJunctionSnaps: WallEndpointJunctionSnap[] = [];
	const endpointHostSnaps: WallEndpointHostSnap[] = [];
	draft.points.forEach((entry, pointIndex) => {
		if (entry.target.kind === 'junction') {
			endpointJunctionSnaps.push({ pointIndex, junctionId: entry.target.junctionId });
		} else if (entry.target.kind === 'host') {
			endpointHostSnaps.push({ pointIndex, wallId: entry.target.wallId });
		}
	});
	// A ring that returns to its first vertex is already closed by that vertex;
	// `close` stays the creator's explicit statement either way.
	return { points, close: draft.closed, endpointJunctionSnaps, endpointHostSnaps };
}

/** The planner-derived consequence of one chain, in the creator's words. */
export type ChainConsequence = {
	readonly kind: 'free-standing' | 'encloses' | 'divides' | 'closes' | 'absorbs';
	readonly summary: string;
};

export type ChainPlanPreview =
	| {
			readonly kind: 'planned';
			/** The exact candidate document, for the ghost chain. */
			readonly document: LayoutDocumentWallFirst;
			readonly authoredWallIds: readonly string[];
			readonly createdWallIds: readonly string[];
			readonly createdJunctionIds: readonly string[];
			readonly splitWallIds: readonly string[];
			readonly createdRoomIds: readonly string[];
			readonly retiredRoomIds: readonly string[];
			/** Open Spaces this chain re-closes into Rooms. */
			readonly closedRoomIds?: readonly string[];
			/** Open Spaces this chain extended by joining part of an open side. */
			readonly absorbedRoomIds: readonly string[];
			readonly consequence: ChainConsequence;
	  }
	| {
			readonly kind: 'refused';
			readonly code: string;
			readonly message: string;
			/**
			 * Canonical gate diagnostics retained with the refusal. The Stage and the
			 * palette speak the creator-facing `message`; this evidence is what lets a
			 * test (and a future repair surface) prove the F.2 candidate was rejected
			 * for a specific reason instead of being dropped as a generic error.
			 */
			readonly diagnostics?: readonly {
				readonly code: string;
				readonly message: string;
			}[];
	  };

/** The area facts of a Space this chain re-closes, measured before and after. */
type ClosedSpaceFacts = {
	readonly name: string;
	readonly areaBefore: number;
	readonly areaAfter: number;
};

function consequenceOf(
	buildingRoomIds: readonly string[],
	retiredRoomIds: readonly string[],
	splitWallIds: readonly string[],
	baselineRooms: number,
	closedSpaces: readonly ClosedSpaceFacts[] = [],
	absorbedSpaceNames: readonly string[] = [],
): ChainConsequence {
	// Re-close is named for the Space it happens to: the identity the creator
	// already sees, never a newly minted Room they have to rediscover. A stroke
	// that leaves part of the old outline outside the new Room says how much
	// ground is left (ratified B3); any other area change is stated as the new
	// area. This is derived from the baseline and candidate outlines, never from
	// the number of Rooms that happened to be born.
	const closeLines = closedSpaces.map((space) => {
		const leftOutside = space.areaBefore - space.areaAfter;
		if (leftOutside > 0.005) {
			return `${space.name} becomes a room · ${leftOutside.toFixed(2)} m² left outside.`;
		}
		const changed =
			Math.abs(leftOutside) > 0.005 ? ` Area is now ${space.areaAfter.toFixed(2)} m².` : '';
		return `Closes ${space.name} — every side is a Wall again.${changed}`;
	});
	const closeNote = closeLines.length > 0 ? ` ${closeLines.join(' ')}` : '';
	const absorbNote =
		absorbedSpaceNames.length > 0
			? ` Extends ${absorbedSpaceNames.join(' and ')} — the Wall joins the open side.`
			: '';
	if (buildingRoomIds.length > 0 && baselineRooms === 0) {
		return {
			kind: 'encloses',
			summary:
				(buildingRoomIds.length === 1
					? 'Encloses one Room on finish.'
					: `Encloses ${buildingRoomIds.length} Rooms on finish.`) +
				closeNote +
				absorbNote,
		};
	}
	if (buildingRoomIds.length > 0) {
		return {
			kind: 'divides',
			summary:
				`Divides a Room — one accepted finish creates ${buildingRoomIds.length} Room${buildingRoomIds.length === 1 ? '' : 's'}.` +
				closeNote +
				absorbNote,
		};
	}
	const hostNote =
		splitWallIds.length > 0
			? ` Splits ${splitWallIds.length} existing Wall${splitWallIds.length === 1 ? '' : 's'} where the chain lands.`
			: '';
	const mergeNote =
		retiredRoomIds.length > 0
			? ` Merges ${retiredRoomIds.length} existing Room${retiredRoomIds.length === 1 ? '' : 's'}.`
			: '';
	if (closeLines.length > 0) {
		// A re-closing stroke is named for the closure, never as a free-standing
		// Wall: the chain did close a ring even though it minted no new Room id.
		return {
			kind: 'closes',
			summary: `${closeLines.join(' ')}${hostNote}${mergeNote}${absorbNote}`,
		};
	}
	if (absorbedSpaceNames.length > 0) {
		return {
			kind: 'absorbs',
			summary: `${absorbNote.trim()}${hostNote}${mergeNote}`,
		};
	}
	return {
		kind: 'free-standing',
		summary: `Free-standing Wall — closes no ring.${hostNote}${mergeNote}`,
	};
}

/** Convert a canonical rejection into the one refusal shape, retaining its evidence. */
export function refusedChainPreview(input: {
	readonly code: string;
	readonly issues?: readonly { readonly code: string; readonly message: string }[];
	readonly topology?: readonly { readonly code: string; readonly message: string }[];
}): Extract<ChainPlanPreview, { readonly kind: 'refused' }> {
	const diagnostics = [
		...(input.issues ?? []).map((issue) => ({ code: issue.code, message: issue.message })),
		...(input.topology ?? []).map((diagnostic) => ({
			code: diagnostic.code,
			message: diagnostic.message,
		})),
	];
	return {
		kind: 'refused',
		code: input.code,
		message: drawingRefusalWords(input.code),
		...(diagnostics.length === 0 ? {} : { diagnostics }),
	};
}

/**
 * Plan one draft through the canonical chain planner.
 *
 * The caller supplies the operation's captured identity (one capture per
 * operation, replayed by Redo) and the explicit working level; nothing here
 * mints an id from occupancy.
 */
export function planChainDraft(options: {
	readonly document: LayoutDocumentWallFirst;
	readonly draft: ChainDraft;
	readonly capture: LayoutIdCapture;
	readonly levelId: string;
	readonly thickness?: number;
	readonly height?: number;
	/** A3 — the one drawn Arc leg, when the Wall reading is in Arc mode. */
	readonly arc?: WallChainArc | null;
}): ChainPlanPreview {
	const request = chainPlanRequest(options.draft);
	if (request.points.length < 2) {
		return {
			kind: 'refused',
			code: 'insufficient_chain',
			message: 'A chain needs at least two points.',
		};
	}
	// Drawing policy: the refusals the document
	// format tolerates but a *drawing* gesture must not author are asked of the one
	// bounded policy predicate, before the planner builds anything.
	const policy = detectUnsupportedChainConnections({
		baseline: options.document,
		points: request.points,
		close: request.close,
		endpointJunctionSnaps: request.endpointJunctionSnaps,
		endpointHostSnaps: request.endpointHostSnaps,
	});
	if (policy !== null)
		return { kind: 'refused', code: policy.code, message: drawingRefusalWords(policy.code) };
	const plan: WallChainPlan = planWallChain({
		roomNamePrefix: 'Room',
		baseline: options.document,
		points: request.points,
		close: request.close,
		capture: options.capture,
		levelId: options.levelId,
		endpointJunctionSnaps: request.endpointJunctionSnaps,
		endpointHostSnaps: request.endpointHostSnaps,
		...(options.thickness === undefined ? {} : { thickness: options.thickness }),
		...(options.height === undefined ? {} : { height: options.height }),
		...(options.arc === undefined || options.arc === null ? {} : { arc: options.arc }),
	});
	if (plan.kind === 'rejected') return refusedChainPreview(plan.rejection);
	const createdRoomIds = plan.lineage.map((record) => record.roomId);
	const resultRoomById = new Map(plan.document.rooms.map((room) => [room.id, room] as const));
	const closedRoomIds = options.document.rooms
		.filter(
			(room) =>
				room.virtualEdges.length > 0 &&
				(resultRoomById.get(room.id)?.virtualEdges.length ?? -1) === 0,
		)
		.map((room) => room.id);
	const absorbedRoomIds = plan.absorbedRoomIds;
	const absorbedSpaceNames = absorbedRoomIds.map(
		(roomId) => options.document.rooms.find((room) => room.id === roomId)?.name ?? roomId,
	);
	const areaOf = (document: LayoutDocumentWallFirst, roomId: string): number | null => {
		const polygon = roomBoundaryPolygon(document, roomId);
		return polygon === null ? null : faceArea({ polygon });
	};
	const closedSpaces = closedRoomIds.map((roomId) => ({
		name: options.document.rooms.find((room) => room.id === roomId)?.name ?? roomId,
		areaBefore: areaOf(options.document, roomId) ?? 0,
		areaAfter: areaOf(plan.document, roomId) ?? 0,
	}));
	return {
		kind: 'planned',
		document: plan.document,
		authoredWallIds: plan.authoredWallIds,
		createdWallIds: plan.createdWallIds,
		createdJunctionIds: plan.createdJunctionIds,
		splitWallIds: plan.splitWallIds,
		createdRoomIds,
		retiredRoomIds: plan.retiredRoomIds,
		closedRoomIds,
		absorbedRoomIds,
		consequence: consequenceOf(
			createdRoomIds,
			plan.retiredRoomIds,
			plan.splitWallIds,
			options.document.rooms.length,
			closedSpaces,
			absorbedSpaceNames,
		),
	};
}

/** The straight legs of a **planned** candidate, for the ghost chain's overlay. */
export function plannedLegs(
	document: LayoutDocumentWallFirst,
	wallIds: readonly string[],
): readonly { readonly id: string; readonly start: LayoutVec2; readonly end: LayoutVec2 }[] {
	const junctionById = new Map(document.junctions.map((junction) => [junction.id, junction]));
	const legs: { id: string; start: LayoutVec2; end: LayoutVec2 }[] = [];
	for (const wallId of wallIds) {
		const wall = document.walls.find((candidate) => candidate.id === wallId);
		if (wall === undefined || wall.centerline.kind !== 'line') continue;
		const start = junctionById.get(wall.startJunctionId)?.point;
		const end = junctionById.get(wall.endJunctionId)?.point;
		if (start === undefined || end === undefined) continue;
		legs.push({ id: wall.id, start: [start[0], start[1]], end: [end[0], end[1]] });
	}
	return legs;
}

/** A pending leg's live length/angle facts for the overlay and the palette. */
export function pendingLegFacts(
	draft: ChainDraft,
	point: LayoutVec2,
): { readonly length: number; readonly angleDegrees: number } | null {
	const last = draft.points[draft.points.length - 1];
	if (last === undefined) return null;
	const dx = point[0] - last.point[0];
	const dz = point[1] - last.point[1];
	const length = Math.hypot(dx, dz);
	if (!(length > 0)) return null;
	return { length, angleDegrees: (Math.atan2(dz, dx) * 180) / Math.PI };
}

/**
 * Whether this tap finishes the chain by returning to its first point.
 *
 * Selecting the start Junction is the enclosure gesture: the planner reads a
 * repeated final vertex as the implicit close, so the draft is closed here and
 * the duplicate vertex is never appended.
 */
export function isDraftStart(
	draft: ChainDraft,
	point: LayoutVec2,
	toleranceMeters: number,
): boolean {
	const first = draft.points[0];
	if (first === undefined) return false;
	return Math.hypot(point[0] - first.point[0], point[1] - first.point[1]) <= toleranceMeters;
}

/** Whether the draft already names this exact point (a repeat tap is not a new point). */
export function chainDraftNamesPoint(draft: ChainDraft, point: LayoutVec2): boolean {
	return hasPoint(draft, point);
}

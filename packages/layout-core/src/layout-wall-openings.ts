/**
 * `layout-wall-openings.ts` — canonical wall-first Opening domain operations
 * (P23.3).
 *
 * One authored Opening record per physical opening, hosted by one canonical
 * Wall (`Opening.wallId`), `offset` in physical meters from the canonical Wall
 * start. Create/update/delete/move/center are pure planners over an immutable
 * document: build the exact candidate, run the canonical gates (codec →
 * whole-hosting-Wall opening set → portal adjacency for relations written by
 * this operation → shared compiler), and return one result for the editor
 * transaction runner to commit as exactly one history entry.
 *
 * **No clamping anywhere in this module.** An offset that does not fit its
 * hosting Wall (or overlaps a sibling opening, or exceeds the floor height)
 * rejects the whole candidate. Callers must never feed a clamped drag/snap
 * result into these planners expecting it to be accepted: a raw drag 2 m past
 * the Wall end rejects rather than becoming an end-placed commit.
 */
import type { LayoutDocumentIssue } from './layout-issue';
import { activeLayoutCompileSession, compileWallFirstLayoutGeometry } from './layout-geometry';
import { hasBlockingLayoutIssues } from './layout-geometry-validation';
import {
	type OpeningSetIssue,
	validateWallFirstOpeningSet,
	wallFirstWallLength
} from './layout-opening-set';
import { validateWallFirstPortalRelations } from './layout-wall-portals';
import { validateWallFirstLayoutDocument } from './layout-wall-first-codec';
import { exceedsLayoutDimension, LAYOUT_DIMENSION_LIMIT_MESSAGE } from './layout-geometry-limits';
import {
	cowUpdateOpening,
	ensureLayoutWorldIndex,
	getCowDocumentDelta,
	hasAnySamplingTestObserver,
	lookupIndexedOpening,
	peekLayoutWorldIndex,
	verifyOpeningUpdateDelta
} from './layout-world-index';
import {
	allocateCapturedId,
	layoutWorkingLevelIssue,
	LayoutIdCollisionError,
	type LayoutIdCapture
} from './layout-id-capture';
import type {
	LayoutDocumentWallFirst,
	LayoutWallOpening
} from './layout-wall-first-types';

/** Creation defaults (legacy parity: door 0.9×2.1 sill 0, window 1.2×1.2 sill 1). */
export const WALL_OPENING_DEFAULTS: Record<
	LayoutWallOpening['kind'],
	Pick<LayoutWallOpening, 'width' | 'height' | 'sillHeight'>
> = {
	door: { width: 0.9, height: 2.1, sillHeight: 0 },
	window: { width: 1.2, height: 1.2, sillHeight: 1 }
};

export type WallOpeningOperation =
	| 'opening-create'
	| 'opening-update'
	| 'opening-delete';

export type WallOpeningRejectionCode =
	| 'unknown_wall'
	| 'unknown_opening'
	| 'invalid_value'
	| 'dimension_out_of_range'
	| 'portal_relation_invalid'
	| 'no_op'
	| 'invalid_candidate_document'
	| 'opening_set_invalid'
	| 'candidate_does_not_compile'
	| 'captured_id_in_use';

export type WallOpeningRejection = {
	code: WallOpeningRejectionCode;
	message: string;
	targetIds?: readonly string[];
	issues?: readonly (LayoutDocumentIssue | OpeningSetIssue)[];
};

export type WallOpeningPlan =
	| {
			kind: 'success';
			document: LayoutDocumentWallFirst;
			operation: WallOpeningOperation;
			changedOpeningIds: readonly string[];
			changedWallIds: readonly string[];
	  }
	| { kind: 'rejected'; rejection: WallOpeningRejection };

export type WallFirstOpeningIntent = {
	wallId: string;
	kind: LayoutWallOpening['kind'];
	/** Raw candidate offset in meters from the canonical Wall start. Never clamped. */
	offset: number;
	width?: number;
	height?: number;
	sillHeight?: number;
	profile?: LayoutWallOpening['profile'];
	connectsRoomIds?: [string, string];
	/** Explicit ID (snapshot restore/import); omission allocates document-globally. */
	id?: string;
};

export type WallOpeningPatch = {
	offset?: number;
	width?: number;
	height?: number;
	sillHeight?: number;
	profile?: LayoutWallOpening['profile'];
	kind?: LayoutWallOpening['kind'];
	/** `null` clears the relation explicitly (`door→window`); omission preserves. */
	connectsRoomIds?: [string, string] | null;
};

/** Canonical metrics for one authored Opening (meters, canonical Wall frame). */
export type WallFirstOpeningMetrics = {
	openingId: string;
	wallId: string;
	wallLength: number;
	offset: number;
	width: number;
	height: number;
	sillHeight: number;
	/** Clearance between the Wall start and the opening's near edge (`offset`). */
	clearanceFromStart: number;
	/** Clearance between the opening's far edge and the Wall end. */
	clearanceFromEnd: number;
	/** Canonical offset that centers the opening on its hosting Wall. */
	centerOffset: number;
};

export function wallFirstOpeningMetrics(
	document: LayoutDocumentWallFirst,
	openingId: string
): WallFirstOpeningMetrics | undefined {
	const opening = document.openings.find((entry) => entry.id === openingId);
	if (!opening) return undefined;
	const wallLength = wallFirstWallLength(document, opening.wallId);
	if (wallLength === undefined) return undefined;
	return {
		openingId: opening.id,
		wallId: opening.wallId,
		wallLength,
		offset: opening.offset,
		width: opening.width,
		height: opening.height,
		sillHeight: opening.sillHeight,
		clearanceFromStart: opening.offset,
		clearanceFromEnd: wallLength - (opening.offset + opening.width),
		centerOffset: (wallLength - opening.width) / 2
	};
}

/**
 * Distance-from-start → canonical `offset`. Distances are measured to the
 * opening's near edge, so this is an identity — exposed so editors never
 * invent a second convention.
 */
export function wallFirstOffsetFromStartDistance(distanceFromStart: number): number {
	return distanceFromStart;
}

/** Distance-from-end → canonical `offset` (`length - width - distance`). */
export function wallFirstOffsetFromEndDistance(
	metrics: Pick<WallFirstOpeningMetrics, 'wallLength' | 'width'>,
	distanceFromEnd: number
): number {
	return metrics.wallLength - metrics.width - distanceFromEnd;
}

/** Center-on-Wall offset for the current width (meters, never normalized). */
export function wallFirstCenterOffset(
	metrics: Pick<WallFirstOpeningMetrics, 'wallLength' | 'width'>
): number {
	return (metrics.wallLength - metrics.width) / 2;
}

/** Clearance helper for the two Wall ends of one authored Opening. */
export function wallFirstOpeningClearances(
	document: LayoutDocumentWallFirst,
	openingId: string
): { fromStart: number; fromEnd: number } | undefined {
	const metrics = wallFirstOpeningMetrics(document, openingId);
	return metrics
		? { fromStart: metrics.clearanceFromStart, fromEnd: metrics.clearanceFromEnd }
		: undefined;
}

/**
 * Create one authored Opening on a canonical Wall. Never clamps.
 *
 * The Opening id derives from the operation's captured nonce plus its hosting
 * Wall and kind; an explicit `intent.id` remains the snapshot-restore/import
 * path. Occupancy is only the refusal check: a captured id already present
 * rejects instead of being suffixed.
 */
export function planCreateWallFirstOpening(
	document: LayoutDocumentWallFirst,
	intent: WallFirstOpeningIntent,
	capture: LayoutIdCapture,
	levelId: string
): WallOpeningPlan {
	const levelIssue = layoutWorkingLevelIssue(document, levelId);
	if (levelIssue !== null) return reject('invalid_value', levelIssue, [intent.wallId]);
	const wall = document.walls.find((candidate) => candidate.id === intent.wallId);
	if (!wall) {
		return reject('unknown_wall', `Unknown Wall '${intent.wallId}'`, [intent.wallId]);
	}
	if (!Number.isFinite(intent.offset) || intent.offset < 0) {
		return reject('invalid_value', 'Opening offset must be finite and non-negative', [
			intent.wallId
		]);
	}
	const defaults = WALL_OPENING_DEFAULTS[intent.kind];
	const width = intent.width ?? defaults.width;
	const height = intent.height ?? defaults.height;
	const sillHeight = intent.sillHeight ?? defaults.sillHeight;
	if ([intent.offset, width, height, sillHeight].some(exceedsLayoutDimension)) {
		return reject('dimension_out_of_range', LAYOUT_DIMENSION_LIMIT_MESSAGE, [intent.wallId]);
	}
	let id = intent.id;
	if (id === undefined) {
		try {
			id = allocateCapturedId(
				new Set(document.openings.map((candidate) => candidate.id)),
				`opening:${intent.kind}:${intent.wallId}`,
				capture
			);
		} catch (error) {
			if (error instanceof LayoutIdCollisionError) {
				return reject('captured_id_in_use', error.message, [intent.wallId]);
			}
			throw error;
		}
	}
	const opening: LayoutWallOpening = {
		id,
		wallId: intent.wallId,
		kind: intent.kind,
		offset: intent.offset,
		width,
		height,
		sillHeight,
		profile: intent.profile ?? 'rectangular',
		...(intent.connectsRoomIds
			? { connectsRoomIds: [...intent.connectsRoomIds] as [string, string] }
			: {})
	};
	if (document.openings.some((candidate) => candidate.id === opening.id)) {
		return reject('invalid_value', `Opening ID '${opening.id}' already exists`, [opening.id]);
	}
	const candidate: LayoutDocumentWallFirst = {
		...document,
		openings: [...document.openings, opening]
	};
	if (opening.connectsRoomIds) {
		const relationIssue = validateWallFirstPortalRelations(candidate).find(
			(issue) => issue.openingId === opening.id
		);
		if (relationIssue) {
			return reject('portal_relation_invalid', relationIssue.message, [
				opening.id,
				intent.wallId
			]);
		}
	}
	return finalize(candidate, 'opening-create', [opening.id], [intent.wallId]);
}

/**
 * Update one authored Opening's exact fields. The hosting Wall never changes
 * (P23.8 owns host/offset rebasing on topology edits). Relations written by
 * this operation are validated against the canonical adjacency rule;
 * pre-existing legacy relations authored elsewhere stay readable (P23.0
 * compatibility) and are only cleared/rewritten explicitly.
 */
export function planUpdateWallFirstOpening(
	document: LayoutDocumentWallFirst,
	openingId: string,
	patch: WallOpeningPatch
): WallOpeningPlan {
	const worldIndex = !hasAnySamplingTestObserver()
		? ensureLayoutWorldIndex(document)
		: peekLayoutWorldIndex(document);
	const current = lookupIndexedOpening(document, openingId);
	if (!current) {
		return reject('unknown_opening', `Unknown Opening '${openingId}'`, [openingId]);
	}
	const nextKind = patch.kind ?? current.kind;
	const relationProvided = patch.connectsRoomIds !== undefined;
	const clearedRelation = patch.connectsRoomIds === null;
	const nextRelation = clearedRelation
		? undefined
		: (patch.connectsRoomIds ?? current.connectsRoomIds);
	if (nextKind === 'window' && nextRelation) {
		return reject(
			'portal_relation_invalid',
			patch.connectsRoomIds === undefined
				? `Opening '${openingId}' carries a portal relation that must be cleared explicitly before it becomes a window`
				: 'Only door openings may define portal relations',
			[openingId]
		);
	}
	for (const [field, value] of [
		['offset', patch.offset],
		['width', patch.width],
		['height', patch.height],
		['sillHeight', patch.sillHeight]
	] as const) {
		if (value === undefined) continue;
		if (!Number.isFinite(value) || (field === 'offset' || field === 'sillHeight' ? value < 0 : value <= 0)) {
			return reject(
				'invalid_value',
				`Opening '${openingId}' ${field} must be a finite ${field === 'offset' || field === 'sillHeight' ? 'non-negative' : 'positive'} number`,
				[openingId]
			);
		}
		if (exceedsLayoutDimension(value)) {
			return reject('dimension_out_of_range', LAYOUT_DIMENSION_LIMIT_MESSAGE, [openingId]);
		}
	}
	const next: LayoutWallOpening = {
		...current,
		...(patch.offset !== undefined ? { offset: patch.offset } : {}),
		...(patch.width !== undefined ? { width: patch.width } : {}),
		...(patch.height !== undefined ? { height: patch.height } : {}),
		...(patch.sillHeight !== undefined ? { sillHeight: patch.sillHeight } : {}),
		...(patch.profile !== undefined ? { profile: patch.profile } : {}),
		kind: nextKind
	};
	if (nextRelation) next.connectsRoomIds = [...nextRelation] as [string, string];
	else delete next.connectsRoomIds;
	if (sameOpening(current, next)) {
		return reject('no_op', `Opening '${openingId}' already has those values`, [openingId]);
	}
	const candidate = cowUpdateOpening(document, openingId, next, worldIndex);
	// Only an explicitly written relation is adjacency-checked here (legacy
	// readable relations are resolved through the Save gate, never silently).
	if (relationProvided && !clearedRelation && next.connectsRoomIds) {
		const relationIssue = validateWallFirstPortalRelations(candidate).find(
			(issue) => issue.openingId === openingId
		);
		if (relationIssue) {
			return reject('portal_relation_invalid', relationIssue.message, [
				openingId,
				current.wallId
			]);
		}
	}
	return finalize(candidate, 'opening-update', [openingId], [current.wallId]);
}

/**
 * Explicit drag/move commit boundary: one raw candidate offset, validated
 * against the complete hosting-Wall opening set. Out-of-fit rejects.
 */
export function planMoveWallFirstOpening(
	document: LayoutDocumentWallFirst,
	openingId: string,
	offset: number
): WallOpeningPlan {
	return planUpdateWallFirstOpening(document, openingId, { offset });
}

/** Center one authored Opening on its hosting Wall (exact meter offset). */
export function planCenterWallFirstOpening(
	document: LayoutDocumentWallFirst,
	openingId: string
): WallOpeningPlan {
	const metrics = wallFirstOpeningMetrics(document, openingId);
	if (!metrics) {
		const exists = document.openings.some((opening) => opening.id === openingId);
		return exists
			? reject('invalid_value', `Opening '${openingId}' has an unresolved hosting Wall`, [openingId])
			: reject('unknown_opening', `Unknown Opening '${openingId}'`, [openingId]);
	}
	return planUpdateWallFirstOpening(document, openingId, {
		offset: metrics.centerOffset
	});
}

/**
 * Delete one authored Opening (the single physical record — shared Walls
 * never carry per-Room duplicates).
 */
export function planDeleteWallFirstOpening(
	document: LayoutDocumentWallFirst,
	openingId: string
): WallOpeningPlan {
	const opening = document.openings.find((candidate) => candidate.id === openingId);
	if (!opening) {
		return reject('unknown_opening', `Unknown Opening '${openingId}'`, [openingId]);
	}
	const candidate: LayoutDocumentWallFirst = {
		...document,
		openings: document.openings.filter((entry) => entry.id !== openingId)
	};
	return finalize(candidate, 'opening-delete', [openingId], [opening.wallId]);
}

function finalize(
	candidate: LayoutDocumentWallFirst,
	operation: WallOpeningOperation,
	changedOpeningIds: readonly string[],
	changedWallIds: readonly string[]
): WallOpeningPlan {
	const cowDelta =
		operation === 'opening-update' && !hasAnySamplingTestObserver()
			? getCowDocumentDelta(candidate)
			: undefined;
	if (cowDelta && changedOpeningIds.length === 1 && changedWallIds.length === 1) {
		const verdict = verifyOpeningUpdateDelta({
			baseline: cowDelta.baseline,
			candidate,
			openingId: changedOpeningIds[0]!,
			wallId: changedWallIds[0]!
		});
		if (verdict === 'certified-valid') {
			const compileSession = activeLayoutCompileSession();
			const compiled = compileSession
				? compileSession.compile(candidate)
				: compileWallFirstLayoutGeometry(candidate);
			if (hasBlockingLayoutIssues(compiled.issues)) {
				return reject(
					'candidate_does_not_compile',
					compiled.issues[0]?.message ?? 'Candidate geometry does not compile'
				);
			}
			return {
				kind: 'success',
				document: candidate,
				operation,
				changedOpeningIds: [...changedOpeningIds],
				changedWallIds: [...new Set(changedWallIds)]
			};
		}
	}

	const structural = validateWallFirstLayoutDocument(candidate);
	if (!structural.success) {
		return reject(
			'invalid_candidate_document',
			`Candidate failed wall-first validation: ${structural.issues[0]?.message ?? 'unknown issue'}`,
			undefined,
			structural.issues
		);
	}
	const setIssues = validateWallFirstOpeningSet(structural.document);
	if (setIssues.length > 0) {
		const first = setIssues[0]!;
		return reject('opening_set_invalid', first.message, [first.openingId, first.wallId], setIssues);
	}
	const compileSession = activeLayoutCompileSession();
	const compiled = compileSession
		? compileSession.compile(structural.document)
		: compileWallFirstLayoutGeometry(structural.document);
	if (hasBlockingLayoutIssues(compiled.issues)) {
		return reject(
			'candidate_does_not_compile',
			compiled.issues[0]?.message ?? 'Candidate geometry does not compile'
		);
	}
	return {
		kind: 'success',
		document: structural.document,
		operation,
		changedOpeningIds: [...changedOpeningIds],
		changedWallIds: [...new Set(changedWallIds)]
	};
}

function sameOpening(a: LayoutWallOpening, b: LayoutWallOpening): boolean {
	return (
		a.id === b.id &&
		a.wallId === b.wallId &&
		a.kind === b.kind &&
		a.offset === b.offset &&
		a.width === b.width &&
		a.height === b.height &&
		a.sillHeight === b.sillHeight &&
		a.profile === b.profile &&
		(a.connectsRoomIds?.[0] ?? '') === (b.connectsRoomIds?.[0] ?? '') &&
		(a.connectsRoomIds?.[1] ?? '') === (b.connectsRoomIds?.[1] ?? '')
	);
}

function reject(
	code: WallOpeningRejectionCode,
	message: string,
	targetIds?: readonly string[],
	issues?: readonly (LayoutDocumentIssue | OpeningSetIssue)[]
): WallOpeningPlan {
	return {
		kind: 'rejected',
		rejection: { code, message, ...(targetIds ? { targetIds } : {}), ...(issues ? { issues } : {}) }
	};
}

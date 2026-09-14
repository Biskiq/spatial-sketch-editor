import type { DraftSegment, LayoutDocument, LayoutRoom, LayoutVec2 } from '$lib/layout/layout-types';
import type { LayoutDocumentWallFirst } from '$lib/layout/layout-wall-first-types';
import type { LayoutRoomUnitTransform } from './layout-room-transform';
import { createPlanViewportState, snapToGrid, type PlanViewportState } from './layout-plan-transform';
import { EDITOR_DRAG_THRESHOLD_PX } from '../interaction-constants';
import type { Vec3 } from '$lib/types/scene';
import { LAYOUT_PLAN_GRID_STEP } from '$lib/layout/layout-wall-first-precision';
import { snapOwnerKey, type SnapFeatureKind } from '@portfolio/layout-core';
export type LayoutViewMode = 'plan' | '3d';
/** Scene → Plan's local authoring authority. Camera Plan never reads this. */
export type PlanViewMode = 'layout' | 'staging';
export type LayoutPrimitiveTool = 'box' | 'cylinder' | 'sphere';

/**
 * P23.5 — small architectural preset set (creation defaults over existing
 * LayoutObject kinds). A preset is only a creation default: it authors one
 * ordinary document-level object that then edits/compiles/renders like every
 * manually created primitive. No serialized preset kind ever exists.
 */
export type LayoutPresetTool = 'preset-column' | 'preset-platform' | 'preset-plinth';

export function isLayoutPresetTool(tool: LayoutDraftTool): tool is LayoutPresetTool {
	return tool === 'preset-column' || tool === 'preset-platform' || tool === 'preset-plinth';
}

export type LayoutDraftTool = 'select' | 'rectangle' | 'polygon' | 'door' | 'window' | 'wall-chain' | 'partition-chain' | LayoutPrimitiveTool | LayoutPresetTool;
export type LayoutRoomDragMode = 'room' | 'vertex';

/** P23.9 — role of the active wall-chain draft (Wall vs Partition tool). */
export type WallChainDraftRole = 'boundary' | 'partition';

export type LayoutRoomUnitDrag = LayoutRoomUnitTransform & {
	roomId: string;
	mode: 'translate' | 'rotate';
	startWorld: LayoutVec2;
	pivot: LayoutVec2;
	startAngle: number;
	/**
	 * P23.6a — did the **current** candidate resolve through the canonical
	 * planner? Reset on every update and set from the adapter result, so a
	 * rejected intermediate candidate can never be committed by a later release
	 * that resolves nothing. Transient session state only: never persisted,
	 * never part of an undo snapshot.
	 */
	candidateValid: boolean;
	/**
	 * P23.6a amendment A — every Room that travels with this drag (the connected
	 * Room group resolved at pointer down; the dragged Room is always a member).
	 * Presentation only: the plan overlay highlights each member so the whole
	 * moving unit is visible before release. `[]` on the legacy Room-unit path,
	 * which has no canonical group. Never persisted.
	 */
	groupRoomIds: readonly string[];
};

export type LayoutPrimitiveDraft = {
	kind: LayoutPrimitiveTool;
	start: LayoutVec2;
	current: LayoutVec2;
	roomId?: string;
	valid: boolean;
};

/**
 * P23.5 — one-click preset placement candidate (never persisted, never a
 * second selection store). The click point is the object's X/Z center in
 * document meters; validity is finite coordinates, not Room containment —
 * exterior placement stays valid where product geometry permits.
 */
export type LayoutPresetDraft = {
	tool: LayoutPresetTool;
	point: LayoutVec2;
	valid: boolean;
};

export type LayoutObjectDrag = {
	objectId: string;
	mode: 'translate' | 'rotate';
	originalPosition: Vec3;
	candidatePosition: Vec3;
	originalRotation: Vec3;
	candidateRotation: Vec3;
	/** Rotate-mode world X/Z pivot + starting pointer angle (P10 layout-object yaw). */
	pivot: LayoutVec2;
	startAngle: number;
};

/**
 * Session routing state for the owner-aware Arrange surface (P10).
 *
 * Arrange remembers its **last active owner** — never an object identity. The
 * actual selected ids live only in the canonical Layout / Scene slots; this
 * value just decides which slot is the active Arrange target on entry and
 * during a session.
 */
export type ArrangeOwner = 'layout-object' | 'scene' | null;

/** The derived active Arrange target — selected ids stay in the source slots. */
export type ArrangeTarget =
	| { owner: 'layout-object'; objectId: string }
	| { owner: 'scene'; ids: readonly string[]; primaryId: string };

/**
 * Derive the session's active Arrange target from the remembered owner + the
 * two canonical selection slots (P10 last-owner rule).
 *
 * - last owner = layout-object and the Layout slot holds an eligible object →
 *   that object activates; otherwise **no target** (never a Scene fallback).
 * - last owner = scene and the Scene slot is an eligible selection → that
 *   selection activates (multi-selection intact); otherwise **no target**.
 * - no remembered owner (first entry) → derive from the current slots,
 *   eligible Layout object first, then an eligible Scene selection.
 *
 * `eligibleLayoutObjectIds` / `eligibleSceneEntityIds` are the Arrange
 * eligibility refinements (non-profile objects / P2 footprint projections);
 * when omitted the shape checks alone decide.
 */	export function deriveArrangeTarget(input: {
	lastOwner: ArrangeOwner;
	layoutSelection: LayoutSelection;
	selectedPlacementIds: readonly string[];
	selectedClusterId: string | null;
	eligibleLayoutObjectIds?: ReadonlySet<string>;
	eligibleSceneEntityIds?: ReadonlySet<string>;
}): ArrangeTarget | null {
	const layoutObject = input.layoutSelection.kind === 'object' ? input.layoutSelection : null;
	const layoutObjectEligible =
		layoutObject !== null &&
		(!input.eligibleLayoutObjectIds ||
			input.eligibleLayoutObjectIds.has(layoutObject.objectId));
	const sceneEligible =
		input.selectedPlacementIds.length > 0 &&
		input.selectedClusterId === null &&
		(!input.eligibleSceneEntityIds ||
			input.selectedPlacementIds.every((id) => input.eligibleSceneEntityIds!.has(id)));

	if (input.lastOwner === 'layout-object') {
		return layoutObjectEligible && layoutObject
			? { owner: 'layout-object', objectId: layoutObject.objectId }
			: null;
	}
	if (input.lastOwner === 'scene') {
		return sceneEligible
			? { owner: 'scene', ids: input.selectedPlacementIds, primaryId: input.selectedPlacementIds.at(-1)! }
			: null;
	}
	if (layoutObjectEligible && layoutObject) {
		return { owner: 'layout-object', objectId: layoutObject.objectId };
	}
	if (sceneEligible) {
		return { owner: 'scene', ids: input.selectedPlacementIds, primaryId: input.selectedPlacementIds.at(-1)! };
	}
	return null;
}

export type LayoutAccordionState = {
	place: boolean;
	objects: boolean;
	selection: boolean;
};

/** Screen-pixel distance before a wall mid-span drag inserts a bend anchor. */
export const LAYOUT_WALL_BEND_DRAG_THRESHOLD_PX = EDITOR_DRAG_THRESHOLD_PX;

export type LayoutSelection =
	| { kind: 'none' }
	| { kind: 'room'; roomId: string }
	| { kind: 'wall'; roomId: string; segmentId: string }
	| { kind: 'opening'; roomId: string; segmentId: string; openingId: string }
	| { kind: 'interiorAnchor'; roomId: string; segmentId: string; anchorId: string }
	| { kind: 'object'; objectId: string }
	/**
	 * P23.3 — canonical wall-first opening target on the same selection
	 * authority: document-global `wallId` + `openingId`, no `roomId` and no
	 * `segmentId`. Legacy opening selection keeps its room-anchored shape.
	 */
	| { kind: 'wallOpening'; wallId: string; openingId: string }
	/**
	 * P23.6 — canonical wall-first Wall target on the same selection
	 * authority: document-global `wallId`, no `roomId` and no `segmentId`.
	 * Never a faked room-anchored `wall` hit. Junction selection is canonical;
	 * legacy `(roomId, segmentId)` retirement is tracked post-P23 by Issue #26.
	 */
	| { kind: 'physicalWall'; wallId: string }
	/**
	 * P23.6 — canonical wall-first Junction target on the same selection
	 * authority: document-global `junctionId`. Click-select only (exact moves
	 * stay in the Inspector); never a second store.
	 */
	| { kind: 'junction'; junctionId: string };

/** P23.3 — which part of a canonical Opening a drag gesture is moving. */
export type LayoutWallOpeningDragMode = 'body' | 'start-edge' | 'end-edge';

/**
 * P23.3 — transient canonical Opening drag session (never persisted, never a
 * second selection store). The baseline is immutable for the whole gesture;
 * `rawPointerOffset` is the unclamped pointer projection and
 * `candidateOffset`/`candidateWidth` are the suggested placement — from a real
 * P23.2 snap win when one is honored, otherwise from the raw candidate. A raw
 * candidate outside fit bounds stays `valid: false` and commits nothing.
 */
export type LayoutWallOpeningDrag = {
	mode: LayoutWallOpeningDragMode;
	wallId: string;
	openingId: string;
	/** Immutable gesture baseline (offset/width in canonical Wall meters). */
	baselineOffset: number;
	baselineWidth: number;
	wallLength: number;
	/** Unclamped pointer projection (body: opening start frame; edges: edge offset). */
	rawPointerOffset: number;
	candidateOffset: number;
	candidateWidth: number;
	/** True only when a real P23.2 snap candidate won (never set by clamping). */
	snapped: boolean;
	/** Candidate interval fit the hosting Wall (shape-only; the commit re-validates the whole set). */
	valid: boolean;
};

export type LayoutWallOpeningDragCandidate = {
	offset: number;
	width: number;
	snapped: boolean;
	valid: boolean;
};

/**
 * Pure candidate derivation for one drag update — the P23.3 raw-vs-snap
 * contract in one place. `snapOffset` carries a *honored* snap win only (an
 * offset that was reachable without clamping); `null` means the raw candidate
 * stands on its own merits.
 */
export function computeLayoutWallOpeningDragCandidate(
	drag: Pick<
		LayoutWallOpeningDrag,
		'mode' | 'baselineOffset' | 'baselineWidth' | 'wallLength'
	>,
	input: { rawPointerOffset: number; snapOffset: number | null }
): LayoutWallOpeningDragCandidate {
	const epsilon = 1e-6;
	const snapped = input.snapOffset !== null;
	const fits = (offset: number, width: number): boolean =>
		width > epsilon && offset >= -epsilon && offset + width <= drag.wallLength + epsilon;
	if (drag.mode === 'body') {
		// `rawPointerOffset` is the pointer's own center projection, while an
		// honored `snapOffset` is already a resolved start-edge offset (the P23.2
		// resolver clamps every candidate into `[0, length - width]`). Only the
		// raw path needs the half-width shift; the snapped path is final.
		const offset = input.snapOffset ?? input.rawPointerOffset - drag.baselineWidth / 2;
		return {
			offset,
			width: drag.baselineWidth,
			snapped,
			valid: snapsAfterClamp(input.snapOffset, offset, drag.baselineWidth, drag.wallLength) && fits(offset, drag.baselineWidth)
		};
	}
	const resolved = input.snapOffset ?? input.rawPointerOffset;
	const fixedRightEdge = drag.baselineOffset + drag.baselineWidth;
	if (drag.mode === 'end-edge') {
		const width = resolved - drag.baselineOffset;
		return {
			offset: drag.baselineOffset,
			width,
			snapped,
			valid: fits(drag.baselineOffset, width)
		};
	}
	// start-edge: the opposite (right) edge stays fixed.
	const width = fixedRightEdge - resolved;
	return {
		offset: resolved,
		width,
		snapped,
		valid: fits(resolved, width)
	};
}

/**
 * A snap win only counts when its own candidate interval is inside the Wall
 * (never when the resolver merely clamped a far-away pointer into range).
 */
function snapsAfterClamp(
	snapOffset: number | null,
	offset: number,
	width: number,
	wallLength: number
): boolean {
	if (snapOffset === null) return true;
	return snapOffset >= -1e-6 && snapOffset + width <= wallLength + 1e-6;
}

/** Begin one canonical Opening drag with an immutable baseline. */
export function beginLayoutWallOpeningDrag(
	state: LayoutInteractionState,
	input: {
		mode: LayoutWallOpeningDragMode;
		wallId: string;
		openingId: string;
		offset: number;
		width: number;
		wallLength: number;
	}
): void {
	state.wallOpeningDrag = {
		mode: input.mode,
		wallId: input.wallId,
		openingId: input.openingId,
		baselineOffset: input.offset,
		baselineWidth: input.width,
		wallLength: input.wallLength,
		rawPointerOffset: input.offset + input.width / 2,
		candidateOffset: input.offset,
		candidateWidth: input.width,
		snapped: false,
		valid: true
	};
}

/**
 * Update the transient candidate for one pointer move. `snapOffset` is an
 * honored snap win's offset (edge space for width handles, start space for
 * body drags) or `null`. Never mutates the document or history.
 */
export function updateLayoutWallOpeningDrag(
	state: LayoutInteractionState,
	input: { rawPointerOffset: number; snapOffset: number | null; wallLength: number }
): LayoutWallOpeningDragCandidate | null {
	const drag = state.wallOpeningDrag;
	if (!drag) return null;
	drag.wallLength = input.wallLength;
	drag.rawPointerOffset = input.rawPointerOffset;
	const candidate = computeLayoutWallOpeningDragCandidate(drag, input);
	drag.candidateOffset = candidate.offset;
	drag.candidateWidth = candidate.width;
	drag.snapped = candidate.snapped;
	drag.valid = candidate.valid;
	return candidate;
}

/** Cancel the drag session (Escape / pointer-cancel): the baseline was never applied. */
export function cancelLayoutWallOpeningDrag(state: LayoutInteractionState): void {
	state.wallOpeningDrag = null;
}

/**
 * P23.10 — one direct architecture edit gesture (transient, session-only).
 *
 * The state carries exactly enough baseline-derived intent to render an
 * invalid candidate *without* installing it; the complete document baseline
 * lives in the viewport's `LayoutPreviewSnapshot`, never duplicated here.
 * Every candidate value is derived from the immutable pointer-down values, so
 * move frequency can never accumulate error.
 *
 * `kind: 'junction-move'` is both the Junction-handle drag and the Wall
 * endpoint reshape — an endpoint handle **is** that canonical Junction, so it
 * never acquires Wall-private vertex state.
 */
export type LayoutArchitectureEditGesture =
	| {
			kind: 'junction-move';
			pointerId: number;
			junctionId: string;
			/** World-space pointer at pointer-down (immutable for the gesture). */
			startPointer: LayoutVec2;
			/** Canonical Junction point at pointer-down (grab offset preserved). */
			baselinePoint: LayoutVec2;
			/**
			 * Every baseline Junction coordinate (this one included), frozen at
			 * pointer-down. A candidate landing exactly on any of them would merge
			 * Junctions, which this slice does not do — and filtering the
			 * `'junction'` family is not sufficient, because a projective family
			 * (`'wall-span'`, `'wall-intersection'`) can land on the same coordinate.
			 */
			junctionExcludePoints: readonly LayoutVec2[];
			/** Every Wall incident to the Junction; frozen from the baseline. */
			affectedWallIds: readonly string[];
			/** Current raw candidate point (baseline + total displacement). */
			candidatePoint: LayoutVec2;
			valid: boolean;
			rejectionCode?: string;
			rejectionMessage?: string;
	  }
	| {
			kind: 'wall-move';
			pointerId: number;
			wallId: string;
			startPointer: LayoutVec2;
			/** The hit projection's world point at pointer-down. */
			baselineGrabPoint: LayoutVec2;
			startJunctionId: string;
			endJunctionId: string;
			baselineStart: LayoutVec2;
			baselineEnd: LayoutVec2;
			/** Selected Wall plus every Wall incident to either endpoint. */
			affectedWallIds: readonly string[];
			/** Current raw candidate delta (target − baseline grab point). */
			candidateDelta: LayoutVec2;
			valid: boolean;
			rejectionCode?: string;
			rejectionMessage?: string;
	  };

/**
 * P23.10 — the P23.2 families a Junction move may snap to. The `'junction'`
 * family is removed before winner selection because Junction merging is out of
 * scope: honoring it would let the highest-ranked family mask every
 * lower-ranked candidate with a target duplicate-Junction validation can never
 * accept. Rigid Wall translation keeps the full family set — it applies one
 * delta to two existing endpoint IDs and merges nothing.
 */
export const LAYOUT_ARCHITECTURE_JUNCTION_SNAP_KINDS: readonly SnapFeatureKind[] = [
	// NOTE: removing the family is necessary but not sufficient — see
	// `architectureEditExcludePoints`, which also excludes every baseline
	// Junction coordinate for a Junction move.
	'wall-intersection',
	'wall-midpoint',
	'opening-edge',
	'wall-span',
	'object-bounds-edge',
	'object-bounds-center',
	'grid'
];

export type LayoutArchitectureEditKind = LayoutArchitectureEditGesture['kind'];

/** Begin one direct architecture edit with an immutable baseline. */
export function beginLayoutArchitectureEdit(
	state: LayoutInteractionState,
	gesture: LayoutArchitectureEditGesture
): void {
	state.architectureEdit = gesture;
}

/**
 * Total candidate **target** from the immutable pointer-down values:
 * `target = grabPoint + (pointer − startPointer)`. Deriving the total (never
 * adding a per-move delta) makes the candidate order- and frequency-independent.
 *
 * For a Junction move the grab point is the Junction itself; for a rigid Wall
 * move it is the hit projection, so the Wall keeps the pointer's grab offset.
 */
export function architectureEditRawTarget(
	gesture: LayoutArchitectureEditGesture,
	pointer: LayoutVec2
): LayoutVec2 {
	const dx = pointer[0] - gesture.startPointer[0];
	const dz = pointer[1] - gesture.startPointer[1];
	const anchor = gesture.kind === 'junction-move' ? gesture.baselinePoint : gesture.baselineGrabPoint;
	return [anchor[0] + dx, anchor[1] + dz];
}

/**
 * Install one resolved candidate target on the gesture and return the value the
 * canonical planner receives: the Junction point, or the rigid delta. Validity
 * resets on every update so a rejected intermediate candidate can never be
 * committed by a later release that resolves nothing.
 */
export function updateLayoutArchitectureEdit(
	state: LayoutInteractionState,
	target: LayoutVec2
): LayoutVec2 | null {
	const gesture = state.architectureEdit;
	if (!gesture) return null;
	gesture.valid = false;
	delete gesture.rejectionCode;
	delete gesture.rejectionMessage;
	if (gesture.kind === 'junction-move') {
		gesture.candidatePoint = [target[0], target[1]];
		return [target[0], target[1]];
	}
	// One identical delta for both endpoint Junctions: never two independent
	// endpoint snaps, which would rotate or resize the Wall.
	const delta: LayoutVec2 = [
		target[0] - gesture.baselineGrabPoint[0],
		target[1] - gesture.baselineGrabPoint[1]
	];
	gesture.candidateDelta = delta;
	return delta;
}

/** Record the canonical planner's verdict for the current candidate. */
export function markLayoutArchitectureEditValidity(
	state: LayoutInteractionState,
	valid: boolean,
	rejectionCode?: string,
	rejectionMessage?: string
): void {
	const gesture = state.architectureEdit;
	if (!gesture) return;
	gesture.valid = valid;
	if (rejectionCode !== undefined) gesture.rejectionCode = rejectionCode;
	else delete gesture.rejectionCode;
	if (rejectionMessage !== undefined) gesture.rejectionMessage = rejectionMessage;
	else delete gesture.rejectionMessage;
}

/** Cancel the gesture (Escape / pointer-cancel / mode change). Nothing is written. */
export function cancelLayoutArchitectureEdit(state: LayoutInteractionState): void {
	state.architectureEdit = null;
}

/**
 * P23.10 — frozen moving-owner exclusion for one direct edit's snap query:
 * every affected Wall plus every Opening those Walls host. Built once at
 * pointer-down from the immutable baseline, so a live candidate can never
 * become its own snap authority.
 */
export function architectureEditExclusionOwners(
	gesture: LayoutArchitectureEditGesture,
	hostedOpeningIds: readonly string[]
): Set<string> {
	const owners = new Set<string>();
	for (const wallId of gesture.affectedWallIds) owners.add(snapOwnerKey({ kind: 'wall', id: wallId }));
	for (const openingId of hostedOpeningIds) owners.add(snapOwnerKey({ kind: 'opening', id: openingId }));
	return owners;
}

/**
 * P23.10 — exact world points that must never win their own snap: a Junction
 * move excludes **every baseline Junction coordinate**, not just its own.
 *
 * Removing the `'junction'` family is not enough: `'wall-span'` and
 * `'wall-intersection'` candidates are projective, so where a Junction sits on
 * another Wall's span they resolve to exactly that Junction's coordinate and
 * would be selected as the highest-ranked survivor — a position the planner
 * must then reject, because Junction merging is out of scope. The exclusion is
 * by point, so every family is covered.
 *
 * A rigid Wall move excludes nothing by point — its captured grab point may
 * legitimately align with a stationary Junction because one translation merges
 * no endpoint IDs.
 */
export function architectureEditExcludePoints(
	gesture: LayoutArchitectureEditGesture
): LayoutVec2[] {
	return gesture.kind === 'junction-move'
		? gesture.junctionExcludePoints.map((point) => [point[0], point[1]] as LayoutVec2)
		: [];
}

/**
 * P23.10 — the `allowedKinds` filter for one direct edit's snap query:
 * the Junction move removes the `'junction'` family before winner selection;
 * a rigid Wall move passes no filter (full P23.2 ranking).
 */
export function architectureEditAllowedKinds(
	gesture: LayoutArchitectureEditGesture
): readonly SnapFeatureKind[] | undefined {
	return gesture.kind === 'junction-move' ? LAYOUT_ARCHITECTURE_JUNCTION_SNAP_KINDS : undefined;
}

export type LayoutInteractionState = {
	viewMode: LayoutViewMode;
	planViewMode: PlanViewMode;
	tool: LayoutDraftTool;
	polygonPoints: LayoutVec2[];
	/**
	 * P23.9 segment-first continuation state (replaces the old whole-chain
	 * `wallChainPoints` array). Only the currently previewed next segment is
	 * transient; committed Walls live in the document, never here.
	 */
	wallChainStart: LayoutVec2 | null;
	/** Canonical start Junction after the first commit; null until then. */
	wallChainStartJunctionId: string | null;
	/** Canonical run-start Junction set once the first Wall commits. */
	wallChainRunStartJunctionId: string | null;
	/**
	 * P23.6I — transient height for the **continuation** of one active draw run.
	 *
	 * `null` until the first segment of a run commits; then the committed authored
	 * Wall's height, passed explicitly into every later segment so a turn arriving
	 * at a Junction with other incident heights keeps the run's height instead of
	 * re-resolving one. It is *not* a document rule — the first segment's height
	 * comes from the canonical `resolveWallBirthHeight()` topology rule — and it is
	 * not persisted, never enters history, and is cleared on every run-end path.
	 */
	wallChainRunHeight: number | null;
	/** Last committed segment direction (for exact-length defaulting). */
	wallChainLastDirection: LayoutVec2 | null;
	/**
	 * Last valid start→cursor hover direction (P23.9 exact-length memory).
	 * Updated on every cursor move; `pointerleave` clears only the visual
	 * cursor/snap preview, never this — moving to the Length input must not
	 * erase the direction typed precision uses.
	 */
	wallChainHoverDirection: LayoutVec2 | null;
	/** P23.9 — snapped cursor the pending segment is drawn to (rubber band). */
	wallChainCursor: LayoutVec2 | null;
	rectangleStart: LayoutVec2 | null;
	rectangleCurrent: LayoutVec2 | null;
	primitiveDraft: LayoutPrimitiveDraft | null;
	/** P23.5 — transient one-click preset candidate (session-only). */
	presetDraft: LayoutPresetDraft | null;
	selection: LayoutSelection;
	objectDrag: LayoutObjectDrag | null;
	roomUnitDrag: LayoutRoomUnitDrag | null;
	/** P23.3 canonical Opening drag session (transient; never persisted). */
	wallOpeningDrag: LayoutWallOpeningDrag | null;
	/** P23.10 direct Wall/Junction edit gesture (transient; never persisted). */
	architectureEdit: LayoutArchitectureEditGesture | null;
	/** P10 — the Arrange session's remembered last owner (routing, never identity). */
	arrangeOwner: ArrangeOwner;
	accordions: LayoutAccordionState;
	planView: PlanViewportState;
	editing: {
		mode: LayoutRoomDragMode;
		roomId: string;
		vertexIndex: number | null;
		startWorld: LayoutVec2;
		originalPoints: LayoutVec2[];
		currentPoints: LayoutVec2[];
	} | null;
};

export function createLayoutInteractionState(): LayoutInteractionState {
	return {
		viewMode: '3d',
		planViewMode: 'layout',
		tool: 'select',
		polygonPoints: [],
		wallChainStart: null,
		wallChainStartJunctionId: null,
		wallChainRunStartJunctionId: null,
		wallChainRunHeight: null,
		wallChainLastDirection: null,
		wallChainHoverDirection: null,
		wallChainCursor: null,
		rectangleStart: null,
		rectangleCurrent: null,
		primitiveDraft: null,
		presetDraft: null,
		selection: { kind: 'none' },
		objectDrag: null,
		roomUnitDrag: null,
		wallOpeningDrag: null,
		architectureEdit: null,
		arrangeOwner: null,
		accordions: { place: true, objects: true, selection: true },
		planView: createPlanViewportState(),
		editing: null
	};
}

/**
 * Change Scene Plan authority without changing either committed selection
 * slot. Transient Layout work is cleared; the caller owns any open history
 * transaction and must cancel it before calling this function.
 */
export function setPlanViewMode(state: LayoutInteractionState, mode: PlanViewMode): boolean {
	if (state.planViewMode === mode) return false;
	state.planViewMode = mode;
	setLayoutDraftTool(state, 'select');
	return true;
}

/** P10 — remember the Arrange session's last active owner (routing only). */
export function setArrangeOwner(state: LayoutInteractionState, owner: ArrangeOwner): void {
	state.arrangeOwner = owner;
}

/**
 * P10 — cross-owner modifier resolution for Scene picks in Arrange (plan
 * §Selection): a modifier-click that switches the active owner replaces the
 * active selection with the clicked target and never adds across owners.
 * `switchingFromLayout` means the pre-click active Arrange target was a layout
 * object, so the click is a cross-owner switch and additive/toggle are
 * suppressed regardless of modifiers.
 */
export function resolveArrangeSceneModifiers(input: {
	switchingFromLayout: boolean;
	metaKey: boolean;
	ctrlKey: boolean;
	shiftKey: boolean;
}): { toggle: boolean; additive: boolean } {
	const toggle = !input.switchingFromLayout && (input.metaKey || input.ctrlKey);
	const additive = !input.switchingFromLayout && input.shiftKey && !toggle;
	return { toggle, additive };
}

/**
 * P10 — full cross-owner Scene-pick resolution for a viewport click (plan
 * §Selection). On top of modifier suppression, a click that switches owner
 * from a layout target must also treat the clicked entity as unselected, so
 * the remembered Scene slot is replaced with a single entity instead of
 * being dragged or extended as a whole.
 */
export function resolveArrangeScenePick(input: {
	switchingFromLayout: boolean;
	metaKey: boolean;
	ctrlKey: boolean;
	shiftKey: boolean;
	clickedAlreadySelected: boolean;
}): { toggle: boolean; additive: boolean; alreadySelected: boolean } {
	const { toggle, additive } = resolveArrangeSceneModifiers(input);
	return {
		toggle,
		additive,
		alreadySelected: !input.switchingFromLayout && input.clickedAlreadySelected
	};
}

export function hasLayoutTransientInteraction(
	state: Pick<
		LayoutInteractionState,
		| 'polygonPoints'
		| 'rectangleStart'
		| 'primitiveDraft'
		| 'objectDrag'
		| 'roomUnitDrag'
		| 'wallOpeningDrag'
		| 'architectureEdit'
		| 'editing'
		| 'wallChainStart'
	>
): boolean {
	// P23.5 — `presetDraft` is hover-only footprint feedback (like the
	// wall-chain cursor, which is also excluded): a preset click commits
	// synchronously, so there is never an in-progress preset gesture to guard.
	return Boolean(
		state.polygonPoints.length > 0 ||
		state.wallChainStart !== null ||
		state.rectangleStart ||
		state.primitiveDraft ||
		state.objectDrag ||
		state.roomUnitDrag ||
		state.wallOpeningDrag ||
		state.architectureEdit ||
		state.editing
	);
}

export function setLayoutViewMode(state: LayoutInteractionState, viewMode: LayoutViewMode): void {
	state.viewMode = viewMode;
	clearLayoutDraft(state);
	cancelRoomEdit(state);
	state.objectDrag = null;
	state.roomUnitDrag = null;
	state.primitiveDraft = null;
	state.presetDraft = null;
	state.wallOpeningDrag = null;
	state.architectureEdit = null;
}

export function setLayoutDraftTool(state: LayoutInteractionState, tool: LayoutDraftTool): void {
	state.tool = tool;
	clearLayoutDraft(state);
	cancelRoomEdit(state);
	state.objectDrag = null;
	state.roomUnitDrag = null;
	state.primitiveDraft = null;
	state.presetDraft = null;
	state.wallOpeningDrag = null;
	state.architectureEdit = null;
}

export function toggleLayoutAccordion(
	state: LayoutInteractionState,
	section: keyof LayoutAccordionState
): void {
	state.accordions[section] = !state.accordions[section];
}

export type PlanViewportToggleOption = 'snapEnabled' | 'gridEnabled' | 'showTourOverlay';

export function togglePlanViewportOption(
	state: LayoutInteractionState,
	option: PlanViewportToggleOption
): void {
	state.planView[option] = !state.planView[option];
}

export function beginLayoutPrimitiveDraft(
	state: LayoutInteractionState,
	kind: LayoutPrimitiveTool,
	point: LayoutVec2,
	roomId?: string
): void {
	state.tool = kind;
	state.primitiveDraft = {
		kind,
		start: [...point],
		current: [...point],
		...(roomId ? { roomId } : {}),
		valid: false
	};
}

export function updateLayoutPrimitiveDraft(
	state: LayoutInteractionState,
	point: LayoutVec2,
	roomId?: string
): void {
	const draft = state.primitiveDraft;
	if (!draft) return;
	draft.current = [...point];
	draft.roomId = roomId;
	draft.valid = Boolean(roomId && primitiveDraftHasSize(draft));
}

export function primitiveDraftHasSize(draft: Pick<LayoutPrimitiveDraft, 'kind' | 'start' | 'current'>): boolean {
	if (draft.kind === 'box') {
		return Math.abs(draft.current[0] - draft.start[0]) > 1e-6 && Math.abs(draft.current[1] - draft.start[1]) > 1e-6;
	}
	return Math.hypot(draft.current[0] - draft.start[0], draft.current[1] - draft.start[1]) > 1e-6;
}

export function primitiveDraftFootprint(draft: LayoutPrimitiveDraft, circleSteps = 32): LayoutVec2[] {
	if (draft.kind === 'box') {
		const [startX, startZ] = draft.start;
		const [endX, endZ] = draft.current;
		return [[startX, startZ], [endX, startZ], [endX, endZ], [startX, endZ]];
	}
	const radius = Math.hypot(draft.current[0] - draft.start[0], draft.current[1] - draft.start[1]);
	return Array.from({ length: circleSteps }, (_, index) => {
		const angle = (index / circleSteps) * Math.PI * 2;
		return [draft.start[0] + Math.cos(angle) * radius, draft.start[1] + Math.sin(angle) * radius];
	});
}

export function primitiveDraftCenter(
	draft: Pick<LayoutPrimitiveDraft, 'kind' | 'start' | 'current'>
): LayoutVec2 {
	if (draft.kind !== 'box') return [...draft.start];
	return [
		(draft.start[0] + draft.current[0]) / 2,
		(draft.start[1] + draft.current[1]) / 2
	];
}

export function cancelLayoutPrimitiveDraft(state: LayoutInteractionState): void {
	state.primitiveDraft = null;
	if (state.tool === 'box' || state.tool === 'cylinder' || state.tool === 'sphere') state.tool = 'select';
}

/**
 * P23.5 — one click arms a preset candidate at the snapped point. No
 * document change, no history entry; the commit validates and writes once.
 */
export function beginLayoutPresetDraft(
	state: LayoutInteractionState,
	tool: LayoutPresetTool,
	point: LayoutVec2
): void {
	state.tool = tool;
	state.presetDraft = {
		tool,
		point: [...point],
		valid: point.every(Number.isFinite)
	};
}

/** P23.5 — clear the preset candidate; the tool re-arms for the next click. */
export function cancelLayoutPresetDraft(state: LayoutInteractionState): void {
	state.presetDraft = null;
}

export function beginRectangle(state: LayoutInteractionState, point: LayoutVec2): void {
	state.rectangleStart = [...point];
	state.rectangleCurrent = [...point];
}

export function updateRectangle(state: LayoutInteractionState, point: LayoutVec2): void {
	if (!state.rectangleStart) return;
	state.rectangleCurrent = [...point];
}

export function rectanglePoints(state: LayoutInteractionState): LayoutVec2[] | null {
	if (!state.rectangleStart || !state.rectangleCurrent) return null;
	const [startX, startZ] = state.rectangleStart;
	const [endX, endZ] = state.rectangleCurrent;
	return [[startX, startZ], [endX, startZ], [endX, endZ], [startX, endZ]];
}

export function addPolygonPoint(state: LayoutInteractionState, point: LayoutVec2): void {
	state.polygonPoints = [...state.polygonPoints, [...point]];
}

export function removeLastPolygonPoint(state: LayoutInteractionState): void {
	state.polygonPoints = state.polygonPoints.slice(0, -1);
}

/**
 * P23.9 segment-first — first click establishes the transient start. No
 * document change, no history entry, no Junction allocated yet.
 */
export function beginWallChain(state: LayoutInteractionState, point: LayoutVec2): void {
	state.wallChainStart = [...point];
	state.wallChainStartJunctionId = null;
	state.wallChainRunStartJunctionId = null;
	// P23.6I — a fresh run must not inherit the previous run's height: the
	// first segment resolves its own birth height from canonical topology.
	state.wallChainRunHeight = null;
	state.wallChainLastDirection = null;
	state.wallChainHoverDirection = null;
	state.wallChainCursor = null;
}

/** P23.9 — pending segment preview: the snapped cursor the run is drawn to. */
export function updateWallChainCursor(state: LayoutInteractionState, point: LayoutVec2 | null): void {
	if (point && state.wallChainStart) {
		const dx = point[0] - state.wallChainStart[0];
		const dz = point[1] - state.wallChainStart[1];
		if (Math.hypot(dx, dz) > 1e-9) state.wallChainHoverDirection = [dx, dz];
	}
	state.wallChainCursor = point ? [...point] : null;
}

/** P23.9 — true while a continuous run has a start (first click done). */
export function hasWallChainRun(state: Pick<LayoutInteractionState, 'wallChainStart'>): boolean {
	return state.wallChainStart !== null;
}

/**
 * P23.9 — advance continuation from the canonical commit result. The
 * committed end becomes the next start; the run-start is set once on the
 * first commit. Direction remembers the just-committed segment for
 * exact-length defaulting. Never derive from `createdWallIds`.
 */
export function advanceWallChainContinuation(
	state: LayoutInteractionState,
	result: {
		endPoint: LayoutVec2;
		endJunctionId: string;
		startJunctionId: string;
		/** P23.6I — height the committed segment actually authored, if reported. */
		wallHeight?: number;
	}
): void {
	const previousStart = state.wallChainStart;
	if (previousStart) {
		const dx = result.endPoint[0] - previousStart[0];
		const dz = result.endPoint[1] - previousStart[1];
		if (Math.hypot(dx, dz) > 1e-9) state.wallChainLastDirection = [dx, dz];
	}
	state.wallChainStart = [...result.endPoint];
	state.wallChainStartJunctionId = result.endJunctionId;
	if (state.wallChainRunStartJunctionId === null) {
		state.wallChainRunStartJunctionId = result.startJunctionId;
	}
	// P23.6I — set the run height exactly once, from the first committed segment,
	// so every later segment of this run (including turns) reuses it verbatim.
	if (state.wallChainRunHeight === null && result.wallHeight !== undefined) {
		state.wallChainRunHeight = result.wallHeight;
	}
	state.wallChainCursor = null;
	state.wallChainHoverDirection = null;
}

/** P23.9 — cancel only the active continuation preview/run (Escape). Committed Walls remain. */
export function cancelWallChainRun(state: LayoutInteractionState): void {
	state.wallChainStart = null;
	state.wallChainStartJunctionId = null;
	state.wallChainRunStartJunctionId = null;
	// P23.6I — Escape / closure / tool change / document reset all land here, so
	// clearing the run height with the rest of the run state is the one rule.
	state.wallChainRunHeight = null;
	state.wallChainLastDirection = null;
	state.wallChainHoverDirection = null;
	state.wallChainCursor = null;
}

export type WallChainRunSnapshot = {
	start: LayoutVec2;
	startJunctionId: string | null;
	runStartJunctionId: string | null;
	/** P23.6I — the run's continuation height (not history state). */
	runHeight: number | null;
	lastDirection: LayoutVec2 | null;
	hoverDirection: LayoutVec2 | null;
	cursor: LayoutVec2 | null;
};

/**
 * P23.9 — capture the active continuation for rejection retry. A rejected
 * segment rolls its history transaction back through snapshot restore (which
 * clears transient state as a side effect), so the caller re-installs the
 * saved run to keep the current start available for correction. Returns
 * `null` when no run is active. Never persisted.
 */
export function captureWallChainRun(state: LayoutInteractionState): WallChainRunSnapshot | null {
	if (!state.wallChainStart) return null;
	return {
		start: [...state.wallChainStart],
		startJunctionId: state.wallChainStartJunctionId,
		runStartJunctionId: state.wallChainRunStartJunctionId,
		runHeight: state.wallChainRunHeight,
		lastDirection: state.wallChainLastDirection ? [...state.wallChainLastDirection] : null,
		hoverDirection: state.wallChainHoverDirection ? [...state.wallChainHoverDirection] : null,
		cursor: state.wallChainCursor ? [...state.wallChainCursor] : null
	};
}

/** P23.9 — re-install a run saved by `captureWallChainRun` (rejection retry). */
export function restoreWallChainRun(state: LayoutInteractionState, snapshot: WallChainRunSnapshot): void {
	state.wallChainStart = [...snapshot.start];
	state.wallChainStartJunctionId = snapshot.startJunctionId;
	state.wallChainRunStartJunctionId = snapshot.runStartJunctionId;
	state.wallChainRunHeight = snapshot.runHeight;
	state.wallChainLastDirection = snapshot.lastDirection ? [...snapshot.lastDirection] : null;
	state.wallChainHoverDirection = snapshot.hoverDirection ? [...snapshot.hoverDirection] : null;
	state.wallChainCursor = snapshot.cursor ? [...snapshot.cursor] : null;
}

/**
 * P23.9 — direction a typed-length segment follows: the live cursor
 * direction when the pointer indicates one, otherwise the last hovered
 * direction (retained across `pointerleave`, which clears only the visual
 * cursor — the Length form lives outside the SVG), otherwise the last
 * committed segment's direction, otherwise +X. Exact entry is a precision
 * aid, not a constraint solver.
 */
export function wallChainPendingDirection(state: LayoutInteractionState): LayoutVec2 {
	const start = state.wallChainStart;
	const cursor = state.wallChainCursor;
	if (start && cursor) {
		const dx = cursor[0] - start[0];
		const dz = cursor[1] - start[1];
		if (Math.hypot(dx, dz) > 1e-9) return [dx, dz];
	}
	if (state.wallChainHoverDirection) {
		const [dx, dz] = state.wallChainHoverDirection;
		if (Math.hypot(dx, dz) > 1e-9) return [dx, dz];
	}
	if (state.wallChainLastDirection) {
		const [dx, dz] = state.wallChainLastDirection;
		if (Math.hypot(dx, dz) > 1e-9) return [dx, dz];
	}
	return [1, 0];
}

/**
 * P23.9 — resolve the current candidate endpoint at an exact typed meter
 * length, bypassing gesture grid snapping. Returns the endpoint; the caller
 * commits one segment transaction from the current start to it.
 */
export function resolveWallChainEndpointAtLength(
	state: LayoutInteractionState,
	length: number,
	direction?: LayoutVec2
): LayoutVec2 | null {
	const start = state.wallChainStart;
	if (!start) return null;
	if (!Number.isFinite(length) || length <= 0) return null;
	const dir = direction ?? wallChainPendingDirection(state);
	const norm = Math.hypot(dir[0], dir[1]);
	if (!(norm > 0)) return null;
	return [start[0] + (dir[0] / norm) * length, start[1] + (dir[1] / norm) * length];
}

/** P23.9 — role implied by the active chain tool ('boundary' for Wall). */
export function wallChainRoleForTool(tool: LayoutDraftTool): WallChainDraftRole | null {
	return tool === 'wall-chain' ? 'boundary' : tool === 'partition-chain' ? 'partition' : null;
}

export function selectLayoutRoom(state: LayoutInteractionState, roomId: string | null): void {
	state.selection = roomId ? { kind: 'room', roomId } : { kind: 'none' };
	cancelRoomEdit(state);
}

export function selectLayoutWall(state: LayoutInteractionState, roomId: string, segmentId: string): void {
	state.selection = { kind: 'wall', roomId, segmentId };
	cancelRoomEdit(state);
}

export function selectLayoutOpening(state: LayoutInteractionState, roomId: string, segmentId: string, openingId: string): void {
	state.selection = { kind: 'opening', roomId, segmentId, openingId };
	cancelRoomEdit(state);
}

export function selectLayoutInteriorAnchor(
	state: LayoutInteractionState,
	roomId: string,
	segmentId: string,
	anchorId: string
): void {
	state.selection = { kind: 'interiorAnchor', roomId, segmentId, anchorId };
	cancelRoomEdit(state);
}

/**
 * P23.3 — select one canonical wall-first Opening by document-global IDs on
 * the existing selection authority (no second store, no fake `roomId`).
 */
export function selectLayoutWallOpening(
	state: LayoutInteractionState,
	wallId: string,
	openingId: string
): void {
	state.selection = { kind: 'wallOpening', wallId, openingId };
	cancelRoomEdit(state);
}

/**
 * P23.6 — select one canonical wall-first Wall by document-global `wallId` on
 * the existing selection authority (no second store, no fake `roomId`).
 */
export function selectLayoutPhysicalWall(state: LayoutInteractionState, wallId: string): void {
	state.selection = { kind: 'physicalWall', wallId };
	cancelRoomEdit(state);
}

/**
 * P23.6 — select one canonical wall-first Junction by document-global
 * `junctionId` on the existing selection authority.
 */
export function selectLayoutJunction(state: LayoutInteractionState, junctionId: string): void {
	state.selection = { kind: 'junction', junctionId };
	cancelRoomEdit(state);
}

export function clearLayoutSelection(state: LayoutInteractionState): void {
	state.selection = { kind: 'none' };
	cancelRoomEdit(state);
}

export function selectLayoutObject(state: LayoutInteractionState, objectId: string): void {
	state.selection = { kind: 'object', objectId };
	cancelRoomEdit(state);
}

export function selectedLayoutRoomId(state: Pick<LayoutInteractionState, 'selection'>): string | null {
	return state.selection.kind === 'none' ||
		state.selection.kind === 'object' ||
		state.selection.kind === 'wallOpening' ||
		state.selection.kind === 'physicalWall' ||
		state.selection.kind === 'junction'
		? null
		: state.selection.roomId;
}

/** P23.3 — the canonical wall-first opening selection, or `null`. */
export function selectedLayoutWallOpening(
	state: Pick<LayoutInteractionState, 'selection'>
): { wallId: string; openingId: string } | null {
	return state.selection.kind === 'wallOpening'
		? { wallId: state.selection.wallId, openingId: state.selection.openingId }
		: null;
}

/** P23.6 — the canonical wall-first Wall selection, or `null`. */
export function selectedLayoutPhysicalWall(
	state: Pick<LayoutInteractionState, 'selection'>
): { wallId: string } | null {
	return state.selection.kind === 'physicalWall' ? { wallId: state.selection.wallId } : null;
}

/** P23.6 — the canonical wall-first Junction selection, or `null`. */
export function selectedLayoutJunction(
	state: Pick<LayoutInteractionState, 'selection'>
): { junctionId: string } | null {
	return state.selection.kind === 'junction' ? { junctionId: state.selection.junctionId } : null;
}

export function beginLayoutObjectDrag(
	state: LayoutInteractionState,
	objectId: string,
	position: Vec3,
	rotation: Vec3 = [0, 0, 0]
): void {
	state.objectDrag = {
		objectId,
		mode: 'translate',
		originalPosition: [...position],
		candidatePosition: [...position],
		originalRotation: [...rotation],
		candidateRotation: [...rotation],
		pivot: [0, 0],
		startAngle: 0
	};
}

/**
 * Start the P10 Plan layout-object yaw gesture around a world X/Z pivot.
 * Rotation is previewed as a render override and committed through the existing
 * Layout transaction on pointer-up; cancel restores the baseline.
 */
export function beginLayoutObjectRotateDrag(
	state: LayoutInteractionState,
	objectId: string,
	position: Vec3,
	rotation: Vec3,
	startWorld: LayoutVec2,
	pivot: LayoutVec2
): void {
	state.objectDrag = {
		objectId,
		mode: 'rotate',
		originalPosition: [...position],
		candidatePosition: [...position],
		originalRotation: [...rotation],
		candidateRotation: [...rotation],
		pivot: [...pivot],
		// Same pointer-yaw convention as the Plan rotation handle (`atan2(-dz, dx)`).
		startAngle: Math.atan2(-(startWorld[1] - pivot[1]), startWorld[0] - pivot[0])
	};
}

export function updateLayoutObjectDrag(
	state: LayoutInteractionState,
	point: LayoutVec2,
	snapEnabled: boolean,
	shiftKey = false,
	angleSnapEnabled = false
): void {
	const drag = state.objectDrag;
	if (!drag) return;
	if (drag.mode === 'translate') {
		const x = snapEnabled ? Math.round(point[0] / LAYOUT_PLAN_GRID_STEP) * LAYOUT_PLAN_GRID_STEP : point[0];
		const z = snapEnabled ? Math.round(point[1] / LAYOUT_PLAN_GRID_STEP) * LAYOUT_PLAN_GRID_STEP : point[1];
		drag.candidatePosition = [x, drag.originalPosition[1], z];
		return;
	}
	// Plan rotation-handle convention (matches the shipped Scene staging
	// handle): positive Three.js Y yaw, Shift = 15° snap on the gesture delta.
	let yaw = Math.atan2(-(point[1] - drag.pivot[1]), point[0] - drag.pivot[0]) - drag.startAngle;
	while (yaw > Math.PI) yaw -= Math.PI * 2;
	while (yaw <= -Math.PI) yaw += Math.PI * 2;
	if (shiftKey && angleSnapEnabled) {
		const increment = Math.PI / 12;
		yaw = Math.round(yaw / increment) * increment;
	}
	drag.candidateRotation = [drag.originalRotation[0], drag.originalRotation[1] + yaw, drag.originalRotation[2]];
}

export function cancelLayoutObjectDrag(state: LayoutInteractionState): void {
	state.objectDrag = null;
}

export function beginLayoutRoomUnitDrag(
	state: LayoutInteractionState,
	roomId: string,
	mode: 'translate' | 'rotate',
	startWorld: LayoutVec2,
	pivot: LayoutVec2,
	groupRoomIds: readonly string[] = []
): void {
	state.roomUnitDrag = {
		roomId,
		mode,
		startWorld: [...startWorld],
		pivot: [...pivot],
		startAngle: Math.atan2(startWorld[1] - pivot[1], startWorld[0] - pivot[0]),
		translation: [0, 0],
		yaw: 0,
		candidateValid: false,
		groupRoomIds: [...groupRoomIds]
	};
	state.editing = null;
}

export function updateLayoutRoomUnitDrag(
	state: LayoutInteractionState,
	currentWorld: LayoutVec2,
	snapEnabled: boolean,
	angleSnapEnabled: boolean,
	shiftKey = false
): void {
	const drag = state.roomUnitDrag;
	if (!drag) return;
	// The previous candidate was resolved against the previous pointer position.
	drag.candidateValid = false;
	if (drag.mode === 'translate') {
		const target = snapEnabled ? snapToGrid(currentWorld) : currentWorld;
		drag.translation = [target[0] - drag.startWorld[0], target[1] - drag.startWorld[1]];
		return;
	}
	let yaw = Math.atan2(currentWorld[1] - drag.pivot[1], currentWorld[0] - drag.pivot[0]) - drag.startAngle;
	while (yaw > Math.PI) yaw -= Math.PI * 2;
	while (yaw <= -Math.PI) yaw += Math.PI * 2;
	if (shiftKey && angleSnapEnabled) {
		const increment = Math.PI / 12;
		yaw = Math.round(yaw / increment) * increment;
	}
	drag.yaw = yaw;
}

export function cancelLayoutRoomUnitDrag(state: LayoutInteractionState): void {
	state.roomUnitDrag = null;
}

export function beginRoomEdit(state: LayoutInteractionState, mode: LayoutRoomDragMode, roomId: string, startWorld: LayoutVec2, originalPoints: readonly LayoutVec2[], vertexIndex: number | null = null): void {
	state.editing = { mode, vertexIndex, roomId, startWorld: [...startWorld], originalPoints: originalPoints.map((point) => [...point]), currentPoints: originalPoints.map((point) => [...point]) };
}

export function updateRoomEdit(state: LayoutInteractionState, currentWorld: LayoutVec2, snapEnabled = false): void {
	const edit = state.editing;
	if (!edit) return;
	if (edit.mode === 'room') {
		const target = snapEnabled ? snapToGrid(currentWorld) : currentWorld;
		const delta: LayoutVec2 = [
			target[0] - edit.startWorld[0],
			target[1] - edit.startWorld[1]
		];
		edit.currentPoints = edit.originalPoints.map(([x, z]) => [x + delta[0], z + delta[1]]);
		return;
	}
	edit.currentPoints = edit.originalPoints.map((point) => [...point]);
	if (edit.vertexIndex !== null) {
		const original = edit.originalPoints[edit.vertexIndex]!;
		const delta: LayoutVec2 = [
			currentWorld[0] - edit.startWorld[0],
			currentWorld[1] - edit.startWorld[1]
		];
		const candidate: LayoutVec2 = [original[0] + delta[0], original[1] + delta[1]];
		edit.currentPoints[edit.vertexIndex] = snapEnabled ? snapToGrid(candidate) : candidate;
	}
}

export function cancelRoomEdit(state: LayoutInteractionState): void {
	state.editing = null;
	state.roomUnitDrag = null;
}

export function clearLayoutDraft(state: LayoutInteractionState): void {
	state.polygonPoints = [];
	cancelWallChainRun(state);
	state.rectangleStart = null;
	state.rectangleCurrent = null;
}

export function screenDistance(a: LayoutVec2, b: LayoutVec2): number {
	return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

export function shouldBeginWallBend(
	originScreen: LayoutVec2,
	currentScreen: LayoutVec2,
	thresholdPx = LAYOUT_WALL_BEND_DRAG_THRESHOLD_PX
): boolean {
	return screenDistance(originScreen, currentScreen) >= thresholdPx;
}

// =====================================================================
// layout selection reconcile (pure).
//
// `LayoutInteractionState.selection` is shell-owned and is *not* part of the
// `LayoutPreviewState` undo snapshot, so every layout swap (undo/redo/commit/
// cancel/delete/reset/import) can leave a stale selection. The shell re-runs
// this against `layoutPreview.project.layout` after every swap. Demotion
// mirrors the scene-side convention (`anchor`→`connection`,
// `view-keyframe`→`connection`): a child selection degrades to its nearest
// surviving parent identity instead of vanishing outright.
// =====================================================================

function findLayoutRoomAnyFloor(
	layout: LayoutDocument,
	roomId: string
): LayoutRoom | undefined {
	for (const floor of layout.floors) {
		const room = floor.rooms.find((candidate) => candidate.id === roomId);
		if (room) return room;
	}
	return undefined;
}

function findLayoutWall(
	layout: LayoutDocument,
	roomId: string,
	segmentId: string
): DraftSegment | undefined {
	return findLayoutRoomAnyFloor(layout, roomId)?.boundary.segments.find(
		(segment) => segment.id === segmentId
	);
}

function findLayoutOpening(
	layout: LayoutDocument,
	roomId: string,
	segmentId: string,
	openingId: string
): boolean {
	return Boolean(
		findLayoutRoomAnyFloor(layout, roomId)?.openings.some(
			(opening) => opening.id === openingId && opening.segmentId === segmentId
		)
	);
}

function findLayoutInteriorAnchor(
	layout: LayoutDocument,
	roomId: string,
	segmentId: string,
	anchorId: string
): boolean {
	const segment = findLayoutWall(layout, roomId, segmentId);
	if (!segment || segment.kind !== 'auto-bezier') return false;
	return segment.interiorAnchors.some((anchor) => anchor.id === anchorId);
}

/**
 * Re-validate a layout selection against the current `LayoutDocument`.
 *
 * Contract: returns the **same input reference** when the selection is still
 * valid, and a fresh object only when it must change (demotion or clear).
 * Shell consumers rely on this identity for cheap change detection; do not
 * spread/clone the valid case.
 *
 * Demotes `opening` / `interiorAnchor` to their parent `wall` when the child is
 * gone but the wall survives; otherwise clears to `{ kind: 'none' }`.
 */
export function reconcileLayoutSelection(
	selection: LayoutSelection,
	layout: LayoutDocument
): LayoutSelection {
	// Wall-first documents have no `.floors`. The minimal P23.3 canonical
	// opening target survives when its own `(wallId, openingId)` record still
	// exists and the touch-drag invariant holds: an Opening that survives a
	// topology edit keeps its ID, so selection needs no re-derivation. P23.6
	// adds the canonical Wall target with the same rule: it survives while its
	// Wall record exists. Every other legacy target clears (the remaining
	// `(roomId, segmentId)` retirement is deferred); nothing here invents a
	// roomless-wall rich selection beyond these canonical slots.
	if ('formatVersion' in layout) {
		if (selection.kind === 'none' || selection.kind === 'object') return selection;
		if (selection.kind === 'room') {
			const wallFirst = layout as unknown as LayoutDocumentWallFirst;
			return wallFirst.rooms.some((candidate) => candidate.id === selection.roomId)
				? selection
				: { kind: 'none' };
		}
		if (selection.kind === 'wallOpening') {
			const wallFirst = layout as unknown as LayoutDocumentWallFirst;
			const opening = wallFirst.openings.find(
				(candidate) => candidate.id === selection.openingId
			);
			return opening && opening.wallId === selection.wallId
				? selection
				: { kind: 'none' };
		}
		if (selection.kind === 'physicalWall') {
			const wallFirst = layout as unknown as LayoutDocumentWallFirst;
			return wallFirst.walls.some((candidate) => candidate.id === selection.wallId)
				? selection
				: { kind: 'none' };
		}
		if (selection.kind === 'junction') {
			const wallFirst = layout as unknown as LayoutDocumentWallFirst;
			return wallFirst.junctions.some((candidate) => candidate.id === selection.junctionId)
				? selection
				: { kind: 'none' };
		}
		return { kind: 'none' };
	}
	switch (selection.kind) {
		case 'none':
			return selection;
		case 'room':
			return findLayoutRoomAnyFloor(layout, selection.roomId)
				? selection
				: { kind: 'none' };
		case 'wall':
			return findLayoutWall(layout, selection.roomId, selection.segmentId)
				? selection
				: { kind: 'none' };
		case 'opening': {
			// Parent-first, mirroring the scene side (anchor→connection): a dead
			// wall clears outright (no demotion target), a dead opening demotes
			// to its surviving wall.
			const wall = findLayoutWall(layout, selection.roomId, selection.segmentId);
			if (!wall) return { kind: 'none' };
			if (findLayoutOpening(layout, selection.roomId, selection.segmentId, selection.openingId)) {
				return selection;
			}
			return { kind: 'wall', roomId: selection.roomId, segmentId: selection.segmentId };
		}
		case 'interiorAnchor': {
			const wall = findLayoutWall(layout, selection.roomId, selection.segmentId);
			if (!wall) return { kind: 'none' };
			if (findLayoutInteriorAnchor(layout, selection.roomId, selection.segmentId, selection.anchorId)) {
				return selection;
			}
			return { kind: 'wall', roomId: selection.roomId, segmentId: selection.segmentId };
		}
		case 'object':
			return layout.objects.some((object) => object.id === selection.objectId)
				? selection
				: { kind: 'none' };
		// A canonical wall-first target cannot be validated against a legacy
		// Room-owned document: clear rather than guess.
		case 'wallOpening':
		case 'physicalWall':
		case 'junction':
			return { kind: 'none' };
	}
}
